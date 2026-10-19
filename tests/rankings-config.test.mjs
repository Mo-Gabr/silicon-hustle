import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/rankingsApi.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const {rankingsConfiguration,requireRankingsClient,rankingsFailure}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
const url='https://synthetic.supabase.co',key='SYNTHETIC_PUBLIC_KEY';
test('Preview missing either variable or both is a configuration failure, never a fabricated PostgREST error',()=>{
 for(const [u,k,names] of [[undefined,key,['VITE_SUPABASE_URL']],[url,undefined,['VITE_SUPABASE_ANON_KEY']],[undefined,undefined,['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY']]]){
  const cfg=rankingsConfiguration(u,k);assert.equal(cfg.ready,false);assert.deepEqual(cfg.missing,names);assert.throws(()=>requireRankingsClient(null,cfg),e=>e.code==='RANKINGS_CONFIGURATION'&&e.code!=='PGRST202');
  const failure=rankingsFailure({code:'RANKINGS_CONFIGURATION'});assert.equal(failure.status,'unavailable');assert.match(failure.error,/not configured for this deployment/);
 }
});
test('configuration diagnostic contains names/booleans only, never supplied values',()=>{const cfg=rankingsConfiguration(url,key);assert.equal(cfg.ready,true);assert.deepEqual(cfg,{ready:true,missing:[],invalid:false});assert.ok(!JSON.stringify(cfg).includes(key)&&!JSON.stringify(cfg).includes(url));const client={};assert.equal(requireRankingsClient(client,cfg),client);});
test('whitespace variables, malformed URL, embedded credentials and non-HTTPS targets fail closed',()=>{for(const u of [' ','not a url','http://synthetic.test','https://user:pass@synthetic.test','https://synthetic.test/path'])assert.equal(rankingsConfiguration(u,key).ready,false);assert.equal(rankingsConfiguration(url,' ').ready,false);});
test('genuine missing RPC/schema uses a distinct service-unavailable message',()=>{for(const code of ['PGRST202','42P01','42883']){const e=rankingsFailure({code});assert.equal(e.status,'unavailable');assert.match(e.error,/could not be reached in the configured service/);assert.ok(!e.error.includes('not configured'));}});
test('permission, network and validation errors are distinct and never echo raw backend data',()=>{for(const code of ['42501','PGRST301','PGRST302','PGRST303','22023','P0001',undefined]){const e=rankingsFailure({code,message:'SYNTHETIC_PRIVATE_BACKEND_DETAIL'});assert.equal(e.status,'error');assert.ok(!e.error.includes('SYNTHETIC_PRIVATE_BACKEND_DETAIL'));assert.ok(!e.error.includes('not enabled'));}});
test('web and Capacitor share Rankings naming while RPC identifiers remain unchanged',()=>{
 const board=readFileSync('src/BillionaireBoard.tsx','utf8'),main=readFileSync('src/main.tsx','utf8'),core=readFileSync('src/leaderboardCore.ts','utf8');
 assert.match(main,/>RANKINGS<\/button>/);assert.match(board,/<h2 id="board-title">RANKINGS<\/h2>/);assert.match(board,/Refresh Rankings/);assert.match(board,/Score publishing is paused/);assert.match(board,/No Rankings entries yet/);
 for(const text of [board,main,core])assert.ok(!/THE BILLIONAIRE|BILLIONAIRE BOARD|JOIN BOARD|Refresh leaderboard|Global scores are not enabled/.test(text));
 assert.match(board,/rpc\('get_billionaire_board'/);assert.ok(!board.includes("rpc('submit_billionaire_score'"));assert.match(readFileSync('capacitor.config.ts','utf8'),/webDir:'dist'/);
});

test('the configuration guard does not reject a configured client or alter the RPC contract',()=>{
 const client={rpc:(name,args)=>({name,args})};
 const selected=requireRankingsClient(client,rankingsConfiguration(url,key));
 assert.deepEqual(selected.rpc('get_billionaire_board',{p_limit:50,p_offset:0}),{name:'get_billionaire_board',args:{p_limit:50,p_offset:0}});
 const source=readFileSync('src/BillionaireBoard.tsx','utf8');
 assert.ok(!/throw\s*\{code:'PGRST202'\}/.test(source));
 assert.ok(source.includes('requireRankingsClient(supabase,configuration)'));
});
