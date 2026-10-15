// Local-only committed fixtures are necessary for independent-session visibility.
// No migration, environment files, saves, or external services are accessed.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const bin='/Applications/Postgres.app/Contents/Versions/18/bin/';
const connection=['-h','127.0.0.1','-p','5432','-d','silicon_hustle_test'];
const runId=randomUUID();
const env={PATH:process.env.PATH,PGPASSFILE:'/nonexistent/silicon-hustle-no-password-file',PGCONNECT_TIMEOUT:'5',PGAPPNAME:'board-stress-'+runId,PGOPTIONS:'-c statement_timeout=15000 -c lock_timeout=5000'};
const children=new Set();
function session(label){
 const child=spawn(bin+'psql',['-X','-w','-qAt',...connection,'-v','ON_ERROR_STOP=1'],{env:{...env,PGAPPNAME:label},stdio:['pipe','pipe','pipe'],timeout:20000});
 children.add(child);let out='',err='';
 child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>err+=v);
 child.stdin.on('error',()=>{});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{children.delete(child);resolve({code,out,err});});});
 return {child,done,write:sql=>child.stdin.write(sql+'\n'),end:sql=>child.stdin.end(sql+'\n'),output:()=>out};
}
async function sql(query){
 const s=session(env.PGAPPNAME);s.end(query);const r=await s.done;
 assert.equal(r.code,0,r.err);return r.out.trim();
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){
 const deadline=Date.now()+4000;
 while(Date.now()<deadline){if(await check())return;await pause(20);}
 throw Error('Timeout: '+label);
}
const fingerprint=()=>sql(`select jsonb_build_object('board',coalesce((select jsonb_agg(to_jsonb(b) order by user_id) from public.billionaire_board b),'[]'::jsonb),'users',coalesce((select jsonb_agg(id order by id) from auth.users),'[]'::jsonb));`);
const ids=Array.from({length:10004},()=>randomUUID());
const quoted=values=>values.map(id=>`('${id}'::uuid)`).join(',');
const idList=()=>ids.map(id=>`'${id}'::uuid`).join(',');
const auth=id=>`set local role authenticated; select set_config('request.jwt.claim.sub','${id}',true);`;
const submit=(id,value)=>`select public.submit_billionaire_score(${value},'0.9.0','Concurrent Founder','${id}');`;
const row=async id=>JSON.parse(await sql(`select to_json(b) from public.billionaire_board b where user_id='${id}';`));
async function overlap(id,first,second,initial=false){
 if(!initial)await sql(`update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id='${id}';`);
 const leader=session('board-leader-'+runId),follower=session('board-follower-'+runId);
 leader.write(`begin;set local statement_timeout='10s';${auth(id)}${submit(id,first)}\n\\echo LEADER_READY`);
 await until(()=>leader.output().includes('LEADER_READY'),'leader holds uncommitted score');
 // Other connections cannot observe an uncommitted insert/update through public RPC.
 const visible=JSON.parse(await sql(`begin;set local role anon;select public.get_billionaire_board(50,0);rollback;`));
 assert.ok(!visible.entries.some(e=>e.best_valuation===first&&e.display_name==='Concurrent Founder'&&initial));
 follower.end(`begin;set local lock_timeout='8s';set local statement_timeout='10s';${auth(id)}${submit(id,second)}commit;`);
 await until(async()=>await sql(`select exists(select 1 from pg_stat_activity where application_name='board-follower-${runId}' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0);`)==='t','follower actually blocked by leader');
 leader.end('commit;');
 const [a,b]=await Promise.all([leader.done,follower.done]);
 assert.equal(a.code,0,a.err);assert.notEqual(b.code,0,'second concurrent write must be rate limited');
 assert.match(b.err,/Please wait 10 seconds/);
 assert.equal((await row(id)).best_valuation,Math.max(initial?0:100,first));
 console.log(`PASS: ${initial?'initial insert':'existing player'} overlap ${first} then ${second}; second gets cooldown`);
}
async function benchmark(label){
 const file=join(work,label+'.sql');
 writeFileSync(file,`\\set page random(0,199)\nbegin;\nset local role anon;\nselect public.get_billionaire_board(50,:page * 50);\ncommit;\n`);
 const prefix=join(work,label+'-latency');
 const args=['-n',...connection,'-c','4','-j','2','-t','250','-r','-l','--log-prefix='+prefix,'-f',file];
 const start=performance.now();
 const result=await new Promise((resolve,reject)=>{
  const c=spawn(bin+'pgbench',args,{env,timeout:45000});children.add(c);let out='',err='';
  c.stdout.on('data',v=>out+=v);c.stderr.on('data',v=>err+=v);c.on('error',reject);
  c.on('close',code=>{children.delete(c);resolve({code,out,err});});
 });
 assert.equal(result.code,0,result.err);
 assert.match(result.out,/number of transactions actually processed: 1000\/1000/);
 assert.match(result.out,/number of failed transactions: 0/);
 const latencies=readdirSync(work).filter(f=>f.startsWith(label+'-latency')).flatMap(f=>readFileSync(join(work,f),'utf8').trim().split('\n').filter(Boolean).map(line=>Number(line.trim().split(/\s+/)[2])/1000)).sort((a,b)=>a-b);
 assert.equal(latencies.length,1000);assert.ok(latencies.every(Number.isFinite));
 const p95=latencies[Math.ceil(latencies.length*.95)-1];
 assert.ok(p95<1000,`local smoke threshold exceeded: p95=${p95}ms`);
 const metrics={label,clients:4,transactions:1000,failed:0,p50_ms:latencies[499],p95_ms:p95,max_ms:latencies.at(-1),elapsed_ms:Math.round(performance.now()-start),pgbench:result.out.trim()};
 console.log('PASS: load '+JSON.stringify(metrics));return metrics;
}
const work=mkdtempSync(join(tmpdir(),'silicon-board-validation-'));
writeFileSync(join(work,'fixture-ids.json'),JSON.stringify(ids));
let before;
try{
 await sql(`do $$begin
 if current_database()<>'silicon_hustle_test' or inet_server_addr()<>inet '127.0.0.1' then raise exception 'Wrong target';end if;
 if exists(select 1 from pg_trigger where tgrelid in ('auth.users'::regclass,'public.billionaire_board'::regclass) and not tgisinternal) then raise exception 'Unexpected fixture side effects: user triggers';end if;
 if exists(select 1 from pg_constraint where confrelid='auth.users'::regclass and conrelid<>'public.billionaire_board'::regclass) then raise exception 'Unexpected auth dependencies';end if;
 end$$;`);
 before=await fingerprint();
 await sql(`begin;insert into auth.users(id) values ${quoted(ids.slice(0,4))};commit;`);
 // Initial unique-key conflict, followed by both existing-row winner orders.
 await overlap(ids[0],500,900,true);
 await sql(`begin;${auth(ids[1])}${submit(ids[1],100)}commit;`);
 await overlap(ids[1],900,50);
 const higher=await row(ids[1]);
 await sql(`update public.billionaire_board set last_submission_at=clock_timestamp()-interval '11 seconds' where user_id='${ids[1]}';begin;${auth(ids[1])}${submit(ids[1],50)}commit;`);
 const lower=await row(ids[1]);
 assert.equal(lower.best_valuation,900);assert.equal(lower.public_id,higher.public_id);assert.equal(lower.achieved_at,higher.achieved_at);
 console.log('PASS: lower retry preserves best, public ID and achievement');
 await sql(`begin;${auth(ids[2])}${submit(ids[2],100)}commit;`);
 await overlap(ids[2],50,900);
 const lowWinner=await row(ids[2]);assert.equal(lowWinner.best_valuation,100);
 // Exercise the actual cooldown interval, rather than backdating this retry.
 const remaining=Math.max(0,Date.parse(lowWinner.last_submission_at)+10100-Date.now());await pause(remaining);
 await sql(`begin;${auth(ids[2])}${submit(ids[2],900)}commit;`);
 const retry=await row(ids[2]);assert.equal(retry.best_valuation,900);assert.equal(retry.public_id,lowWinner.public_id);assert.ok(Date.parse(retry.achieved_at)>Date.parse(lowWinner.achieved_at));
 console.log('PASS: higher score rejected behind lower winner succeeds after real cooldown');
 const baseline=await benchmark('baseline');
 await sql(`begin;set local statement_timeout='20s';
 create temp table load_ids(id uuid) on commit drop;insert into load_ids values ${quoted(ids.slice(4))};
 insert into auth.users(id) select id from load_ids;
 insert into public.billionaire_board(user_id,display_name,best_valuation,game_version,achieved_at)
 select id,'Load Founder',row_number() over(order by id)*1000000,'0.9.0',timestamptz '2026-01-01' from load_ids;commit;`);
 const populated=await benchmark('ten-thousand');
 const page=JSON.parse(await sql(`begin;set local role anon;select public.get_billionaire_board(50,9950);rollback;`));
 assert.equal(page.entries.length,50);assert.equal(page.entries[0].position,9951);
 assert.ok(page.entries.every(e=>!('user_id' in e)&&!('email' in e)));
 console.log('PASS: deep page has global ranks and no private fields');
 writeFileSync(join(work,'results.json'),JSON.stringify({date:'2026-10-15',server:'local PostgreSQL 18.6',fixturePlayers:10000,threshold:'p95 < 1000ms, zero failures; local smoke only',baseline,populated},null,2)+'\n');
}finally{
 for(const child of children)child.kill('SIGTERM');
 await until(()=>children.size===0,'test connections close');
 if(before!==undefined){
  // Only IDs generated by this run. No other dependencies/triggers passed preflight.
  await sql(`begin;set local lock_timeout='5s';set local statement_timeout='20s';delete from public.billionaire_board where user_id in (${idList()});delete from auth.users where id in (${idList()});commit;`);
  assert.equal(await fingerprint(),before,'original records changed or fixture cleanup incomplete');
  console.log('PASS: fixtures removed; original leaderboard/auth fingerprint unchanged');
 }
 console.log('Local latency logs and fixture manifest: '+work);
}
