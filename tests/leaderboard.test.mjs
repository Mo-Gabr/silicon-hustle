import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const options={compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}};
const rankingsModule='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(new URL('../src/rankingsApi.ts',import.meta.url),'utf8'),options).outputText).toString('base64');
const coreSource=readFileSync(new URL('../src/leaderboardCore.ts',import.meta.url),'utf8').replace("from './rankingsApi'","from '"+rankingsModule+"'");
const {outputText}=ts.transpileModule(coreSource,options);
const {BENCHMARK,GAME_VERSION,MAX_SCORE,BOARD_CACHE_PREFIX,BoardController,founderName,scoreValue,ranked,milestones,readPeak,rememberPeak,boardPage}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};};
const entry=(id='a',score=25000000,time='2026-10-15T12:00:00Z')=>({public_id:id,display_name:'Founder '+id,best_valuation:score,game_version:GAME_VERSION,achieved_at:time,position:1,verification:'unverified'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(disk=storage(),user='alice'){
 let time=0,server=null,calls=0;const views=[];
 const api={async read(){return {entries:server?[server]:[],self:user?server:null,total:server?1:0};},async submit(value,version,name){calls++;server={...entry(),best_valuation:Math.max(server?.best_valuation??0,value),display_name:name??server?.display_name??'Founder a',game_version:version,achieved_at:value>(server?.best_valuation??0)?new Date(time).toISOString():server.achieved_at};return server;}};
 const board=new BoardController(user,api,disk,v=>views.push(v),()=>time);
 return {board,api,disk,views,tick:()=>time+=15000,get calls(){return calls;},get server(){return server;},set server(v){server=v;}};
}
test('game version matches the release package',()=>{assert.equal(GAME_VERSION,JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);});
test('developer benchmark is exactly $74,610,431,012.27 and never a player row',()=>{assert.equal(BENCHMARK,74610431012.27);assert.throws(()=>founderName('MOGABR'));assert.throws(()=>founderName('M.O.G.A.B.R'));});
test('rank order is score descending, achievement ascending, then stable public ID',()=>{
 const items=[entry('c',100),entry('b',100,'2026-10-15T11:00:00Z'),entry('a',100,'2026-10-15T11:00:00Z'),entry('d',200)];const order=ranked(items);assert.deepEqual(order.map(x=>x.public_id),['d','a','b','c']);assert.deepEqual(order.map(x=>x.position),[1,2,3,4]);assert.equal(items[0].public_id,'c');
});
test('personal best survives new games, module restarts and lower observations',()=>{
 const disk=storage();rememberPeak(disk,'alice',150000000);rememberPeak(disk,'alice',25000000);const restarted=harness(disk);assert.equal(restarted.board.view.peak,150000000);assert.equal(readPeak(disk,'alice').valuation,150000000);
});
test('personal best vaults are isolated by authenticated account',()=>{const disk=storage();rememberPeak(disk,'alice',900000000);rememberPeak(disk,'bob',25000000);assert.equal(readPeak(disk,'alice').valuation,900000000);assert.equal(readPeak(disk,'bob').valuation,25000000);assert.ok(disk.getItem(BOARD_CACHE_PREFIX+'alice'));});
test('whole-dollar bounds reject unsafe numbers, negatives, fractions and NaN',()=>{for(const value of [-1,NaN,Infinity,1.5,MAX_SCORE+1,'100'])assert.throws(()=>scoreValue(value));assert.equal(scoreValue(MAX_SCORE),MAX_SCORE);});
test('public names reject emails, markup, reserved identities and invalid lengths',()=>{for(const name of ['a','a'.repeat(25),'a@b.com','<img>','SYSTEM','Admin','M O G A B R','🤑 Founder'])assert.throws(()=>founderName(name));assert.equal(founderName('  Ada   Lovelace  '),'Ada Lovelace');});
test('milestones cap at 100% and distinguish the founder target',()=>{const values=milestones(100000000);assert.equal(values[0].reached,true);assert.equal(values.at(-1).target,BENCHMARK);assert.equal(milestones(BENCHMARK+1).at(-1).percent,100);});
test('public response parsing discards emails and private user IDs',()=>{const own={...entry(),email:'hidden@example.invalid',user_id:'private'};const page=boardPage({entries:[own],self:own,total:1});assert.equal('email' in page.entries[0],false);assert.equal('user_id' in page.self,false);});
test('no fake player entries are invented for an empty board',async()=>{const h=harness();await h.board.refresh();assert.deepEqual(h.board.view.entries,[]);assert.equal(h.board.view.total,0);});
test('observing a peak does not publish before choosing a public name',async()=>{const h=harness();h.board.observe(25000000);await h.board.refresh();await h.board.publish();assert.equal(h.calls,0);assert.equal(h.board.view.peak,25000000);});
test('joining publishes the actual observed peak and chosen normalized name',async()=>{const h=harness();h.board.observe(37500000);assert.equal(await h.board.publish('  Ada  Lab  '),true);assert.equal(h.server.best_valuation,37500000);assert.equal(h.server.display_name,'Ada Lab');assert.equal(h.board.view.self.position,1);});
test('a new game cannot lower the published personal best',async()=>{const h=harness();h.board.observe(150000000);await h.board.publish('Ada Lab');h.board.observe(25000000);h.tick();await h.board.publish();assert.equal(h.calls,1);assert.equal(h.server.best_valuation,150000000);});
test('server best restores a higher account peak on another device',async()=>{const h=harness();h.server=entry('a',500000000);h.board.observe(25000000);await h.board.refresh();assert.equal(readPeak(h.disk,'alice').valuation,500000000);assert.equal(h.board.view.peak,500000000);});
test('renaming retains the personal best and achievement time',async()=>{const h=harness();h.board.observe(200000000);await h.board.publish('Ada Lab');const time=h.server.achieved_at;h.tick();assert.equal(await h.board.publish('New Founder'),true);assert.equal(h.server.display_name,'New Founder');assert.equal(h.server.best_valuation,200000000);assert.equal(h.server.achieved_at,time);});
test('a higher peak during cooldown is retained for a later retry',async()=>{const h=harness();h.board.observe(30000000);await h.board.publish('Ada Lab');h.board.observe(80000000);assert.equal(await h.board.publish(),false);assert.equal(h.server.best_valuation,30000000);h.tick();await h.board.publish();assert.equal(h.server.best_valuation,80000000);});
test('failed offline submission preserves the peak across restart',async()=>{const h=harness();h.board.observe(30000000);h.api.submit=async()=>{throw Error('Offline');};await h.board.publish('Ada Lab');assert.equal(h.board.view.status,'error');const restarted=harness(h.disk);assert.equal(restarted.board.view.peak,30000000);});
test('an authenticated server permission denial is surfaced, not treated as success',async()=>{const h=harness();h.board.observe(30000000);h.api.submit=async()=>{throw {code:'42501',message:'permission denied'};};assert.equal(await h.board.publish('Ada Lab'),false);assert.match(h.board.view.error,/Rankings access was denied/);assert.equal(h.board.view.self,null);});
test('anonymous visitors cannot publish',async()=>{const h=harness(storage(),null);h.board.observe(100000000);assert.equal(await h.board.publish('Ada Lab'),false);assert.equal(h.calls,0);});
test('missing SQL migration displays unavailable and keeps an empty real board',async()=>{const h=harness();h.api.read=async()=>{throw {code:'PGRST202'};};await h.board.refresh();assert.equal(h.board.view.status,'unavailable');assert.deepEqual(h.board.view.entries,[]);});
test('an in-flight result after account switch cannot affect the new account',async()=>{const h=harness();h.board.observe(100000000);const pending=deferred();h.api.submit=()=>pending.promise;const sent=h.board.publish('Ada Lab');h.board.stop();pending.resolve(entry('a',900000000));await sent;assert.equal(readPeak(h.disk,'alice').valuation,100000000);assert.equal(readPeak(h.disk,'bob').valuation,0);});
test('an intermediate peak is kept even when later gameplay drops valuation',()=>{const h=harness();h.board.observe(45000000);h.board.observe(41000000);assert.equal(readPeak(h.disk,'alice').valuation,45000000);});
test('a failed local peak write does not falsely claim the peak was durable',()=>{const h=harness();h.disk.setItem=()=>{throw Error('Quota exceeded');};h.board.observe(100000000);assert.equal(h.board.view.peak,0);assert.match(h.board.view.error,/Quota/);});
test('a higher peak during a pending submission survives its response',async()=>{const h=harness();h.board.observe(30000000);const pending=deferred();h.api.submit=()=>pending.promise;const sent=h.board.publish('Ada Lab');h.board.observe(90000000);pending.resolve(entry('a',30000000));await sent;assert.equal(readPeak(h.disk,'alice').valuation,90000000);});
test('leaderboard SQL has no cloud-save or private identity API changes',()=>{const sql=readFileSync(new URL('../supabase/migrations/202610150002_billionaire_board.sql',import.meta.url),'utf8');assert.ok(!/game_saves|save_revision_guard|auth\.users.*(?:insert|update)/i.test(sql.replace(/^--.*$/gm,'')));});

test('a stale ranking fetch cannot roll back a newly published own record',async()=>{const h=harness();h.board.observe(90000000);const waiting=deferred();h.api.read=()=>waiting.promise;const read=h.board.refresh();const posted=h.board.publish('Ada Lab');await posted;waiting.resolve({entries:[],self:null,total:0});await read;assert.equal(h.board.view.self.best_valuation,90000000);});

test('submission binds the expected account even if the SDK auth token changes later',async()=>{const h=harness();h.board.observe(25000000);let expected;h.api.submit=async(value,version,name,user)=>{expected=user;return entry('a',value);};await h.board.publish('Ada Lab');assert.equal(expected,'alice');});

test('ranking retains PostgreSQL microsecond achievement ordering',()=>{const order=ranked([entry('a',100,'2026-10-15T12:00:00.000002Z'),entry('b',100,'2026-10-15T12:00:00.000001Z')]);assert.deepEqual(order.map(x=>x.public_id),['b','a']);});

test('a stale failed fetch cannot mark a successful publication as failed',async()=>{
 const h=harness();h.board.observe(90000000);
 let reject;h.api.read=()=>new Promise((_resolve,fail)=>{reject=fail;});
 const read=h.board.refresh();
 assert.equal(await h.board.publish('Ada Lab'),true);
 reject(new Error('Old read failed'));await read;
 assert.equal(h.board.view.status,'ready');assert.equal(h.board.view.error,'');
 assert.equal(h.board.view.self.best_valuation,90000000);
});
