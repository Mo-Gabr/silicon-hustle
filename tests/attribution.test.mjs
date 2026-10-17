import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {attributedPeak}=await import('data:text/javascript;base64,'+Buffer.from(compile('../src/boardAttribution.ts')).toString('base64'));
const snapshot=JSON.stringify({month:3,seed:42,prices:{h100:34000},positions:{},cash:5000000});
function harness(){const calls=[];let current={snapshot,value:25000000};const api={current:()=>current,identity:async()=>{calls.push('identity');return {id:'alice'};},savedGame:async id=>{calls.push('read:'+id);return {user_id:id,game_state:JSON.parse(snapshot)};}};return {api,calls,setCurrent:value=>current=value};}
test('score attribution requires two fresh identity checks and own saved snapshot',async()=>{const h=harness();assert.equal(await attributedPeak('alice',h.api),25000000);assert.deepEqual(h.calls,['identity','read:alice','identity']);});
test('anonymous, unsigned and switched accounts cannot attribute a game',async()=>{for(const user of [null,{id:'alice',is_anonymous:true},{id:'bob'}]){const h=harness();h.api.identity=async()=>user;await assert.rejects(()=>attributedPeak('alice',h.api));assert.equal(h.calls.length,0);}});
test('unsynced local, missing cloud and other owner cannot publish',async()=>{for(const row of [null,{user_id:'bob',game_state:JSON.parse(snapshot)},{user_id:'alice',game_state:{month:8}}]){const h=harness();h.api.savedGame=async()=>row;await assert.rejects(()=>attributedPeak('alice',h.api));}});
test('canonical JSON comparison supports PostgreSQL key ordering',async()=>{const h=harness();h.api.savedGame=async()=>({user_id:'alice',game_state:Object.fromEntries(Object.entries(JSON.parse(snapshot)).reverse())});assert.equal(await attributedPeak('alice',h.api),25000000);});
test('game change during verification fails closed',async()=>{const h=harness();h.api.savedGame=async()=>{h.setCurrent({snapshot:'{}',value:10});return {user_id:'alice',game_state:JSON.parse(snapshot)};};await assert.rejects(()=>attributedPeak('alice',h.api));});
test('account change during verification fails closed',async()=>{const h=harness();let n=0;h.api.identity=async()=>({id:++n===1?'alice':'bob'});await assert.rejects(()=>attributedPeak('alice',h.api));});
test('missing displayed persisted game blocks all requests',async()=>{const h=harness();h.setCurrent(null);await assert.rejects(()=>attributedPeak('alice',h.api));assert.deepEqual(h.calls,[]);});
test('save read and identity errors never manufacture attribution',async()=>{for(const method of ['identity','savedGame']){const h=harness();h.api[method]=async()=>{throw Error('Synthetic request failure');};await assert.rejects(()=>attributedPeak('alice',h.api));}});
test('invalid valuations fail closed after ownership verification',async()=>{for(const value of [NaN,Infinity,-1,1.2,1000000000001]){const h=harness();h.setCurrent({snapshot,value});await assert.rejects(()=>attributedPeak('alice',h.api));}});
const base='62aa1706d2f5bfb97b56483fda4c1cf0d656f53d';
const baseline=path=>execFileSync('git',['show',base+':'+path],{encoding:'utf8'});
test('authentication, cloud-save implementation and schema are byte-identical to main',()=>{for(const path of ['src/AuthGate.tsx','supabase/schema.sql','src/auth.css'])assert.equal(readFileSync(path,'utf8'),baseline(path),path);});
function functions(text){const ast=ts.createSourceFile('main.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const result={};function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)result[n.name.text]=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);return result;}
test('original transactions, lab economics and persistence helpers remain unchanged',()=>{const old=functions(baseline('src/main.tsx')),now=functions(readFileSync('src/main.tsx','utf8'));for(const [name,body] of Object.entries(old)){if(['App','Root','advance','endingType','respondToThreat','update','reset'].includes(name))continue;const current=now[name];assert.equal(current,body,name);}});
test('release introduces no save engine, paused migration, automatic publishing or save writes from board modules',()=>{const board=readFileSync('src/BillionaireBoard.tsx','utf8');assert.ok(!/saveSync|META_KEY|setInterval|current\.publish\(\)/.test(board));assert.ok(!/\.from\('game_saves'\)[\s\S]*?\.(insert|update|delete|upsert)\(/.test(board));for(const f of ['src/boardAttribution.ts','src/leaderboardCore.ts'])assert.ok(!/silicon-hustle-v04|compute-empire-v04|silicon-hustle-sync-v1|silicon-hustle-recovery-v1/.test(readFileSync(f,'utf8')));});
test('deployed leaderboard migration is preserved exactly',()=>{assert.equal(createHash('sha256').update(readFileSync('supabase/migrations/202610150002_billionaire_board.sql')).digest('hex'),'3165d898173200615c76d45774e0a21b7f7ed2ad66dec732b0022f222408719c');assert.equal(existsSync('supabase/migrations/202610150001_save_revision_guard.sql'),false);assert.equal(existsSync('src/saveSync.ts'),false);});

test("crisis rules are unchanged apart from extension-aware valuation",()=>{const old=functions(baseline("src/main.tsx")),now=functions(readFileSync("src/main.tsx","utf8"));assert.equal(now.respondToThreat.replaceAll("companyValuation(","valuation("),old.respondToThreat);});
