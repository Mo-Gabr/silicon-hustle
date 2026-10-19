import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const {localFounderName}=await load('src/gameProfile.ts');
const {readLocal,writeLocal,LOCAL_KEY,OLD_KEY,LEGACY_KEY}=await load('src/localSaves.ts');
const game=()=>({month:3,cash:5e6,labs:0,seed:42,ended:false,history:[],headline:'Synthetic',ending:'',prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{}});
test('unnamed games use Founder without borrowing account or Rankings identity',()=>{
 for(const value of [null,undefined,[],{}, {email:'synthetic@example.invalid',user_metadata:{full_name:'Account Identity'}},{self:{display_name:'Published Identity'}}])assert.equal(localFounderName(value),'Founder');
});
test('chosen game-profile name takes precedence over older root metadata',()=>{
 assert.equal(localFounderName({profile:{displayName:'  Atelier Ω  '},founderName:'Older Choice',user_metadata:{full_name:'Account Identity'}}),'Atelier Ω');
 assert.equal(localFounderName({profile:{name:'Guest Founder'}}),'Guest Founder');
});
test('legacy local founder/player/display spellings remain readable',()=>{
 for(const key of ['founderName','displayName','playerName','founder_name','display_name','player_name']){
  assert.equal(localFounderName({[key]:'Legacy Choice'}),'Legacy Choice',key);
  assert.equal(localFounderName({profile:{[key]:'Profile Choice'}}),'Profile Choice',key);
 }
});
test('empty and non-text names never produce object labels or undefined',()=>{
 for(const name of ['', '   ',null,undefined,42,{},[]])assert.equal(localFounderName({profile:{displayName:name}}),'Founder');
 assert.equal(localFounderName({profile:{displayName:' '},founderName:'Earlier Choice'}),'Earlier Choice');
});
test('name lookup is read-only and chosen names survive historical-save upgrades',()=>{
 for(const key of [LOCAL_KEY,OLD_KEY,LEGACY_KEY]){
  const disk=new Map(),raw=JSON.stringify({...game(),founder_name:'Legacy Choice',profile:{displayName:'Game Profile'}});disk.set(key,raw);let writes=0;
  const store={getItem:k=>disk.get(k)??null,setItem(k,v){writes++;disk.set(k,v);}};
  const saved=readLocal(store);assert.equal(localFounderName(saved.state),'Game Profile');assert.equal(writes,0);assert.equal(disk.get(key),raw);
  writeLocal(store,{...saved.state,cash:4999999},saved.stamp);assert.equal(localFounderName(readLocal(store).state),'Game Profile');assert.equal(JSON.parse(disk.get(LOCAL_KEY)).founder_name,'Legacy Choice');
  if(key!==LOCAL_KEY)assert.equal(disk.get(key),raw);
 }
});
test('playable recovery preserves persistence, Rankings and game economics',()=>{
 for(const file of ['src/localSaves.ts','src/LocalRecovery.tsx','src/BillionaireBoard.tsx','src/boardAttribution.ts','src/leaderboardCore.ts','src/foundersGamble.ts','src/auth.css'])assert.equal(readFileSync(file,'utf8'),execFileSync('git',['show','25aa122:'+file],{encoding:'utf8'}),file);
 assert.ok(!readFileSync('src/main.tsx','utf8').includes('SAVE_DIAGNOSTIC_BUILD'));
 assert.ok(!readFileSync('src/AuthGate.tsx','utf8').includes('SAVE DIAGNOSTICS'));
});
