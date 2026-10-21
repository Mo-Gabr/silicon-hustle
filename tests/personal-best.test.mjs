import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const bundle=await build({stdin:{contents:`export * from './src/accountSaves';export * from './src/personalBest';export * from './src/localSaves';export * from './src/localSaveChoice';`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'});
const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {accountId,accountKey,accountStore,accountAuthority,prepareGuestSignOut,claimLegacySave,readLocal,writeLocal,savedPersonalBest,rememberPersonalBest,snapshotBest,PERSONAL_BEST_KEY,LOCAL_KEY,RECOVERY_KEY,pendingSaveChoice,selectLocalGame}=module.exports;
const game=(cash=5e6,seed=42)=>({month:3,cash,labs:0,seed,ended:false,history:[],headline:'Synthetic',ending:'',prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{}});
function memory(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);}};}
const save=(store,state,fresh=false)=>writeLocal(store,state,readLocal(store).stamp,{fresh});
test('personal best survives lower separate runs, resets, restart and account switching',()=>{
 const disk=memory(),guest=accountStore(disk,accountId(null)),a=accountStore(disk,accountId('A')),b=accountStore(disk,accountId('B'));
 save(guest,game(100e6));save(a,game(200e6));save(b,game(300e6));
 for(const [id,store,best] of [[null,guest,120e6],['A',a,220e6],['B',b,320e6]]){
  save(store,game(5e6,99),true);assert.equal(savedPersonalBest(accountStore(disk,accountId(id))),best);
 }
 assert.equal(disk.getItem(LOCAL_KEY),null);
});
test('Guest sign-out preserves earlier Guest snapshot and record without touching account or shared legacy saves',()=>{
 const disk=memory(),guest=accountStore(disk,'guest'),user=accountStore(disk,accountId('A'));
 save(guest,game(100e6));save(user,game(200e6));disk.setItem(LOCAL_KEY,'UNASSIGNED ORIGINAL');
 const original=guest.getItem(LOCAL_KEY),userBefore=user.getItem(LOCAL_KEY);
 const prepared=prepareGuestSignOut(disk,game(5e6,99));
 assert.equal(guest.getItem(LOCAL_KEY),original,'preparation has no writes');
 writeLocal(prepared.guest,prepared.freshGame,prepared.stamp,{fresh:true});
 assert.ok(JSON.parse(guest.getItem(RECOVERY_KEY)).some(item=>item.raw===original));
 assert.equal(savedPersonalBest(guest),120e6);assert.equal(user.getItem(LOCAL_KEY),userBefore);assert.equal(disk.getItem(LOCAL_KEY),'UNASSIGNED ORIGINAL');
});
test('interrupted record writes cannot erase a best or prevent ordinary gameplay saves',()=>{
 const disk=memory(),store=accountStore(disk,'guest');save(store,game(100e6));
 const set=disk.setItem;disk.setItem=(key,value)=>{if(key.endsWith(PERSONAL_BEST_KEY))throw Error('quota');set(key,value);};
 save(store,game(150e6));assert.equal(readLocal(store).state.cash,150e6);assert.equal(savedPersonalBest(store),170e6);
 const before=store.getItem(LOCAL_KEY);assert.throws(()=>save(store,game(5e6,99),true));assert.equal(store.getItem(LOCAL_KEY),before,'reset waits until outgoing best is durable');
 disk.setItem=set;rememberPersonalBest(store,savedPersonalBest(store));save(store,game(5e6,99),true);assert.equal(savedPersonalBest(accountStore(disk,'guest')),170e6);
});
test('write interruption after committing a snapshot recovers its best on restart',()=>{
 const disk=memory(),store=accountStore(disk,'guest');save(store,game());
 const set=disk.setItem;let once=true;disk.setItem=(key,value)=>{set(key,value);if(once&&key===accountKey('guest',LOCAL_KEY)){once=false;throw Error('interrupted');}};
 assert.throws(()=>save(store,game(200e6)));assert.equal(savedPersonalBest(accountStore(disk,'guest')),220e6);
});
test('unready authentication and account transitions invalidate stale writes including return to the same account',()=>{
 const disk=memory(),authority=accountAuthority(),a=accountId('A');
 const unready=accountStore(disk,'guest',authority.select(null));assert.throws(()=>save(unready,game()),/account changed/);assert.equal(disk.data.size,0);
 const oldA=accountStore(disk,a,authority.select(a));save(oldA,game());
 const b=accountStore(disk,accountId('B'),authority.select(accountId('B')));save(b,game(100e6));
 assert.throws(()=>save(oldA,game(200e6)),/account changed/);
 const newA=accountStore(disk,a,authority.select(a));assert.throws(()=>save(oldA,game(200e6)),/account changed/);save(newA,game(50e6));
 authority.select(null);assert.throws(()=>newA.setItem(RECOVERY_KEY,'stale'),/account changed/);
 assert.equal(savedPersonalBest(b),120e6);
});
test('Guest sign-out refuses stale stamps and leaves invalid Guest data intact',()=>{
 const disk=memory(),guest=accountStore(disk,'guest');save(guest,game());
 const pending=prepareGuestSignOut(disk,game(5e6,99));save(guest,game(100e6));const newer=guest.getItem(LOCAL_KEY);
 assert.throws(()=>writeLocal(pending.guest,pending.freshGame,pending.stamp,{fresh:true}),/changed/);assert.equal(guest.getItem(LOCAL_KEY),newer);
 disk.setItem(accountKey('guest',LOCAL_KEY),'UNREADABLE ORIGINAL');assert.throws(()=>prepareGuestSignOut(disk,game()));assert.equal(guest.getItem(LOCAL_KEY),'UNREADABLE ORIGINAL');
});
test('existing scoped recovery copies seed the best without assigning another account or modifying archives',()=>{
 const disk=memory(),a=accountStore(disk,accountId('A')),b=accountStore(disk,accountId('B'));
 const archive=JSON.stringify([{key:LOCAL_KEY,raw:JSON.stringify(game(200e6))}]);a.setItem(RECOVERY_KEY,archive);
 disk.setItem(LOCAL_KEY,JSON.stringify(game(900e6)));assert.equal(savedPersonalBest(a),220e6);assert.equal(savedPersonalBest(b),null);assert.equal(a.getItem(RECOVERY_KEY),archive);
});
test('invalid personal best data is preserved and cannot silently overwrite a record',()=>{
 const disk=memory(),store=accountStore(disk,'guest');disk.setItem(accountKey('guest',PERSONAL_BEST_KEY),'damaged');
 assert.throws(()=>rememberPersonalBest(store,120e6));assert.equal(store.getItem(PERSONAL_BEST_KEY),'damaged');assert.equal(snapshotBest({...game(),month:43}),null);
});
test('Month42 archive remains selectable after explicit legacy assignment and its peak survives a new game',()=>{
 const disk=memory(),old={...game(253577280),month:42,ended:true,gamble:{version:1,decision:'extend',standardResult:{month:30,valuation:1e8,peak:1e8,success:true,ending:'ipo'},enterprise:{reliability:1,purchasedSlots:0,contracts:[],discountThrough:0,focus:'operate',ledger:[]},extensionOutcome:{month:42,valuation:273577280,reason:'completed',unicorn:false,mogabr:false}}};
 disk.setItem(LOCAL_KEY,JSON.stringify({...game(),month:5}));const archive=JSON.stringify([{key:LOCAL_KEY,raw:JSON.stringify(old)}]);disk.setItem(RECOVERY_KEY,archive);
 claimLegacySave(disk,'guest');const guest=accountStore(disk,'guest'),choice=pendingSaveChoice(guest);assert.ok(choice);selectLocalGame(guest,choice,'historical');assert.equal(readLocal(guest).state.month,42);
 save(guest,game(5e6,99),true);assert.equal(savedPersonalBest(guest),273577280);assert.equal(disk.getItem(RECOVERY_KEY),archive);
});
test('authentication and native login implementation stay byte-identical to approved starting commit',async()=>{
 const {execFileSync}=await import('node:child_process');assert.equal(readFileSync('src/AuthGate.tsx','utf8'),execFileSync('git',['show','8645dce:src/AuthGate.tsx'],{encoding:'utf8'}));
 const app=readFileSync('src/main.tsx','utf8');assert.ok(app.indexOf('if(!ready)return')<app.indexOf('return <AccountGame'));assert.ok(app.includes('authority.current.select(ready?accountId(userId):null)'));
});

test('silently failed game writes never record an uncommitted higher score',()=>{
 const disk=memory(),store=accountStore(disk,'guest');save(store,game());
 const set=disk.setItem;disk.setItem=(key,value)=>{if(key!==accountKey('guest',LOCAL_KEY))set(key,value);};
 assert.throws(()=>save(store,game(200e6)),/could not save/);assert.equal(savedPersonalBest(store),25e6);assert.equal(readLocal(store).state.cash,5e6);
});
test('an interrupted archive copy can resume and preserves all prior original recovery entries',()=>{
 const disk=memory();disk.setItem(LOCAL_KEY,JSON.stringify(game()));const originalArchive=JSON.stringify([{key:LOCAL_KEY,raw:JSON.stringify(game(200e6,99))}]);disk.setItem(RECOVERY_KEY,originalArchive);
 const set=disk.setItem;let once=true;disk.setItem=(key,value)=>{if(once&&key===accountKey('guest',LOCAL_KEY)){once=false;throw Error('interrupted');}set(key,value);};
 assert.throws(()=>claimLegacySave(disk,'guest'));claimLegacySave(disk,'guest');const guest=accountStore(disk,'guest');assert.equal(savedPersonalBest(guest),220e6);assert.equal(disk.getItem(RECOVERY_KEY),originalArchive);
});
