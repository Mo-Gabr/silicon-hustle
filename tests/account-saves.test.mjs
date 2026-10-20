import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/accountSaves.ts','utf8');
const js=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS}
}).outputText;

const exports={};
const module={exports};
const game=()=>({
 month:3,cash:5e6,labs:0,seed:42,ended:false,
 history:[],headline:'Synthetic',ending:'',
 prices:Object.fromEntries(
  ['l40s','a100','h100','h200','b200','mi300','mi325','gaudi']
   .map(key=>[key,34000])
 ),
 positions:{}
});
const original=JSON.stringify(game());

const require=()=>({
 GAME_KEYS:['silicon-hustle-local-v1','silicon-hustle-v04','compute-empire-v04'],
 RECOVERY_KEY:'silicon-hustle-local-originals-v1',
 CHOICE_KEY:'silicon-hustle-local-choice-v1',
 decodeLocal:value=>value&&typeof value==='object'
  &&value.month===3&&value.seed===42&&value.cash===5e6
  &&value.ended===false&&value.prices&&value.positions
  ?value:null
});
new Function('require','module','exports',js)(require,module,exports);

const {accountId,accountKey,accountStore,hasLegacySave}=module.exports;

test('each authenticated user and Guest have isolated storage',()=>{
 const data=new Map();
 const storage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>data.set(key,value)
 };
 const google=accountStore(storage,accountId('google-user'));
 const email=accountStore(storage,accountId('email-user'));
 const guest=accountStore(storage,accountId(null));

 google.setItem('silicon-hustle-local-v1','GOOGLE GAME');
 email.setItem('silicon-hustle-local-v1','EMAIL GAME');
 guest.setItem('silicon-hustle-local-v1','GUEST GAME');

 assert.equal(google.getItem('silicon-hustle-local-v1'),'GOOGLE GAME');
 assert.equal(email.getItem('silicon-hustle-local-v1'),'EMAIL GAME');
 assert.equal(guest.getItem('silicon-hustle-local-v1'),'GUEST GAME');
 assert.notEqual(accountKey(accountId('google-user'),'save'),accountKey(accountId('email-user'),'save'));
});

test('legacy saves are detected but never automatically assigned',()=>{
 const data=new Map([['silicon-hustle-local-v1','ORIGINAL GAME']]);
 const storage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>data.set(key,value)
 };
 assert.equal(hasLegacySave(storage),true);
 assert.equal(accountStore(storage,accountId(null)).getItem('silicon-hustle-local-v1'),null);
 assert.equal(storage.getItem('silicon-hustle-local-v1'),'ORIGINAL GAME');
});

test('explicit migration copies originals without deleting them',()=>{
 const data=new Map([['silicon-hustle-local-v1',original]]);
 const storage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>data.set(key,value)
 };
 const {claimLegacySave,LEGACY_DECISION_KEY}=module.exports;
 const id=accountId('google-user');

 claimLegacySave(storage,id);

 assert.equal(storage.getItem('silicon-hustle-local-v1'),original);
 assert.equal(accountStore(storage,id).getItem('silicon-hustle-local-v1'),original);
 assert.equal(storage.getItem(LEGACY_DECISION_KEY),id);
 assert.throws(()=>claimLegacySave(storage,accountId('email-user')));
});

test('interrupted migration can resume without overwriting changed data',()=>{
 const data=new Map([['silicon-hustle-local-v1',original]]);
 let fail=true;
 const storage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>{
   if(fail&&key===accountKey(accountId('google-user'),'silicon-hustle-local-v1')){
    fail=false;
    throw Error('Simulated interruption');
   }
   data.set(key,value);
  }
 };
 const {claimLegacySave,LEGACY_DECISION_KEY}=module.exports;
 const id=accountId('google-user');

 assert.throws(()=>claimLegacySave(storage,id));
 assert.equal(storage.getItem(LEGACY_DECISION_KEY),null);

 claimLegacySave(storage,id);
 assert.equal(accountStore(storage,id).getItem('silicon-hustle-local-v1'),original);

 const changed=new Map([['silicon-hustle-local-v1',original]]);
 let interrupted=true;
 const other={
  getItem:key=>changed.get(key)??null,
  setItem:(key,value)=>{
   changed.set(key,value);
   if(interrupted&&key===accountKey(id,'silicon-hustle-local-v1')){
    interrupted=false;
    throw Error('Interrupted after write');
   }
  }
 };

 assert.throws(()=>claimLegacySave(other,id));
 changed.set(accountKey(id,'silicon-hustle-local-v1'),'DIFFERENT GAME');
 assert.throws(()=>claimLegacySave(other,id),/changed/);
 assert.equal(other.getItem(accountKey(id,'silicon-hustle-local-v1')),'DIFFERENT GAME');
 assert.equal(other.getItem(LEGACY_DECISION_KEY),null);
});

test('migration never overwrites existing account recovery data',()=>{
 const id=accountId('google-user');
 const recoveryKey='silicon-hustle-local-originals-v1';
 const choiceKey='silicon-hustle-local-choice-v1';
 const {claimLegacySave,LEGACY_DECISION_KEY}=module.exports;

 for(const protectedKey of [recoveryKey,choiceKey]){
  const data=new Map([
   ['silicon-hustle-local-v1',original],
   [accountKey(id,protectedKey),'EXISTING ACCOUNT DATA']
  ]);
  const storage={
   getItem:key=>data.get(key)??null,
   setItem:(key,value)=>data.set(key,value)
  };

  assert.throws(
   ()=>claimLegacySave(storage,id),
   /already contains saved game or recovery data/
  );
  assert.equal(
   storage.getItem(accountKey(id,protectedKey)),
   'EXISTING ACCOUNT DATA'
  );
  assert.equal(storage.getItem('silicon-hustle-local-v1'),original);
  assert.equal(storage.getItem(LEGACY_DECISION_KEY),null);
  assert.equal(
   storage.getItem(accountKey(id,'legacy-migration-pending')),
   null
  );
 }
});

test('migration recovery archive contains only real saved strings',()=>{
 const data=new Map([['silicon-hustle-local-v1',original]]);
 const storage={
  getItem:key=>data.get(key)??null,
  setItem:(key,value)=>data.set(key,value)
 };
 const {claimLegacySave}=module.exports;
 const id=accountId('google-user');

 claimLegacySave(storage,id);

 const archive=JSON.parse(
  accountStore(storage,id).getItem('silicon-hustle-local-originals-v1')
 );

 assert.deepEqual(archive,[
  {key:'silicon-hustle-local-v1',raw:original}
 ]);
 assert.ok(archive.every(entry=>typeof entry.raw==='string'));
 assert.equal(storage.getItem('silicon-hustle-local-v1'),original);
});
