import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Test the production TypeScript module without adding a runtime dependency.
const source=readFileSync(new URL('../src/saveSync.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const {SaveSync,SAVE_KEY,META_KEY,BACKUP_KEY,LEGACY_SAVE_KEY,canonical,persistLocal,validSave}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
const raw=JSON.stringify;
function game(month=1){return {month,cash:5000000-month,prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(id=>[id,34000])),positions:{},labs:0,headline:'Test',history:[],ended:false,ending:'',seed:42};}
function storage(initial={}){const values=new Map(Object.entries(initial));return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}
const row=(state,version=1,user='alice')=>({user_id:user,game_state:state,updated_at:new Date(1700000000000+version).toISOString()});
function cloud(initial){return {row:initial,reads:0,writes:0,fail:false,async read(){this.reads++;if(this.fail)throw Error('Offline');return structuredClone(this.row);},async write(user,state,expected){this.writes++;if(this.fail)throw Error('Offline');if((this.row?.updated_at??null)!==expected)return null;this.row=row(state,this.writes+10,user);return structuredClone(this.row);}};}
function harness({local=game(),base=null,owner='alice',remote=row(game()),store,server,user='alice'}={}){
 const disk=store??storage({...local!==null?{[SAVE_KEY]:raw(local)}:{},...base?{[META_KEY]:raw({owner,base:raw(base)})}:{}});
 const net=server??cloud(remote);const view={status:'',conflict:null,errors:[],reloads:0};
 const sync=new SaveSync(user,net,{storage:disk,reload:()=>view.reloads++,status:s=>view.status=s,conflict:c=>view.conflict=c,error:e=>view.errors.push(e)});
 return {disk,net,view,sync};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('same progress across JSON key order acknowledges without prompting',async()=>{
 const g=game();const h=harness({local:g,remote:row(Object.fromEntries(Object.entries(g).reverse()))});await h.sync.request();assert.equal(h.view.conflict,null);assert.equal(h.net.writes,0);assert.equal(h.view.status,'Cloud synced');assert.equal(JSON.parse(h.disk.getItem(META_KEY)).owner,'alice');
});
test('legacy device save participates without deleting its original key',async()=>{
 const disk=storage({[LEGACY_SAVE_KEY]:raw(game())});const h=harness({store:disk});await h.sync.request();assert.equal(h.view.status,'Cloud synced');assert.equal(disk.getItem(LEGACY_SAVE_KEY),raw(game()));
});
test('first sign-in with different saves prompts, no silent overwrite',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();assert.equal(h.view.conflict.cloud.game_state.month,4);assert.equal(h.net.writes,0);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,2);
});
test('cloud choice backs up device progress and replaces it',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();await h.sync.choose(true);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,4);assert.equal(JSON.parse(h.disk.getItem(BACKUP_KEY))[0].snapshot,raw(game(2)));assert.equal(h.view.conflict,null);assert.equal(h.view.reloads,1);
});
test('device choice backs up cloud branch before guarded upload',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();await h.sync.choose(false);assert.equal(h.net.row.game_state.month,2);assert.equal(JSON.parse(h.disk.getItem(BACKUP_KEY))[0].snapshot,raw(game(4)));assert.equal(h.view.conflict,null);
});
test('unchanged local automatically pulls newer cloud, even after restart',async()=>{
 const disk=storage();const first=harness({store:disk,local:null});await first.sync.request();first.sync.stop();const h=harness({store:disk,remote:row(game(5),2)});await h.sync.request();assert.equal(JSON.parse(disk.getItem(SAVE_KEY)).month,5);assert.equal(h.net.writes,0);assert.equal(h.view.conflict,null);
});
test('offline local actions upload on reconnect when cloud has not changed',async()=>{
 const h=harness({local:game(3),base:game(),remote:row(game())});h.net.fail=true;await h.sync.request();assert.equal(h.view.status,'Sync failed');assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,3);h.net.fail=false;await h.sync.request();assert.equal(h.net.row.game_state.month,3);assert.equal(h.view.status,'Cloud synced');
});
test('offline local and remote changes require an explicit choice',async()=>{
 const h=harness({local:game(3),base:game(),remote:row(game(4),2)});await h.sync.request();assert.equal(h.net.writes,0);assert.ok(h.view.conflict);assert.equal(h.net.row.game_state.month,4);
});
test('first cloud save uses insert; a simultaneous insert becomes conflict',async()=>{
 const h=harness({local:game(3),remote:null});const write=h.net.write.bind(h.net);h.net.write=async(...args)=>{h.net.row=row(game(5));return write(...args);};await h.sync.request();assert.ok(h.view.conflict);assert.equal(h.net.row.game_state.month,5);
});
test('concurrent update fails CAS and rereads rather than overwriting',async()=>{
 const h=harness({local:game(3),base:game()});const write=h.net.write.bind(h.net);h.net.write=async(...args)=>{h.net.row=row(game(6),99);return write(...args);};await h.sync.request();assert.equal(h.net.row.game_state.month,6);assert.equal(h.view.conflict.cloud.game_state.month,6);
});
test('cloud changes after conflict is displayed require reviewing again',async()=>{
 const h=harness({local:game(3),remote:row(game(4))});await h.sync.request();h.net.row=row(game(7),77);await h.sync.choose(false);assert.equal(h.net.writes,0);assert.equal(h.view.conflict.cloud.game_state.month,7);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,3);
});
test('cloud changes between choice reread and write still cannot be overwritten',async()=>{
 const h=harness({local:game(3),remote:row(game(4))});await h.sync.request();const write=h.net.write.bind(h.net);h.net.write=async(...args)=>{h.net.row=row(game(8),88);return write(...args);};await h.sync.choose(false);assert.equal(h.net.row.game_state.month,8);assert.equal(h.view.conflict.cloud.game_state.month,8);
});
test('local changes while reviewing a choice also require review again',async()=>{
 const h=harness({local:game(3),remote:row(game(4))});await h.sync.request();h.disk.setItem(SAVE_KEY,raw(game(6)));await h.sync.choose(true);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,6);assert.equal(JSON.parse(h.view.conflict.local).month,6);
});
test('a different account cannot silently receive the previous account’s game',async()=>{
 const h=harness({local:game(3),base:game(),owner:'bob',remote:null});await h.sync.request();assert.equal(h.net.writes,0);assert.equal(h.view.conflict.otherAccount,true);await h.sync.choose(false);assert.equal(h.net.row.user_id,'alice');assert.equal(JSON.parse(h.disk.getItem(META_KEY)).owner,'alice');
});
test('deleted cloud save is not automatically recreated from offline progress',async()=>{
 const h=harness({local:game(3),base:game(),remote:null});await h.sync.request();assert.ok(h.view.conflict);assert.equal(h.net.writes,0);
});
test('rapid actions serialize writes and drain the newest local snapshot',async()=>{
 const h=harness({local:game(2),base:game()});const entered=deferred(),release=deferred();const write=h.net.write.bind(h.net);let inFlight=0,max=0;h.net.write=async(...args)=>{inFlight++;max=Math.max(max,inFlight);if(args[1].month===2){entered.resolve();await release.promise;}const result=await write(...args);inFlight--;return result;};const request=h.sync.request();await entered.promise;for(let m=3;m<=10;m++){h.disk.setItem(SAVE_KEY,raw(game(m)));void h.sync.request();}release.resolve();await request;assert.equal(max,1);assert.equal(h.net.row.game_state.month,10);assert.equal(JSON.parse(JSON.parse(h.disk.getItem(META_KEY)).base).month,10);
});
test('actions during the initial cloud read are not lost',async()=>{
 const h=harness({local:null});const entered=deferred(),release=deferred();h.net.read=async()=>{entered.resolve();await release.promise;return row(game(4));};const request=h.sync.request();await entered.promise;h.disk.setItem(SAVE_KEY,raw(game(2)));release.resolve();await request;assert.ok(h.view.conflict);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,2);
});
test('sign-out/account change invalidates an in-flight cloud read',async()=>{
 const h=harness({local:null});const release=deferred();h.net.read=()=>release.promise;const request=h.sync.request();h.sync.stop();release.resolve(row(game(9)));await request;assert.equal(h.disk.getItem(SAVE_KEY),null);assert.equal(h.view.reloads,0);
});
test('sign-out invalidates in-flight write callbacks and prevents queued writes',async()=>{
 const h=harness({local:game(2),base:game()});const entered=deferred(),release=deferred();const write=h.net.write.bind(h.net);h.net.write=async(...args)=>{entered.resolve();await release.promise;return write(...args);};const request=h.sync.request();await entered.promise;h.sync.stop();h.disk.setItem(SAVE_KEY,raw(game(3)));release.resolve();await request;assert.equal(h.net.writes,1);assert.equal(JSON.parse(JSON.parse(h.disk.getItem(META_KEY)).base).month,1);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,3);
});
test('a lost upload response recovers by equality without duplicate writes',async()=>{
 const h=harness({local:game(2),base:game()});const write=h.net.write.bind(h.net);h.net.write=async(...args)=>{await write(...args);throw Error('Response lost');};await h.sync.request();assert.equal(h.view.status,'Sync failed');await h.sync.request();assert.equal(h.view.status,'Cloud synced');assert.equal(h.net.writes,1);
});
test('network failure retains conflict so retry can complete the choice',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();h.net.fail=true;await h.sync.choose(false);assert.ok(h.view.conflict);h.net.fail=false;await h.sync.choose(false);assert.equal(h.view.conflict,null);assert.equal(h.net.row.game_state.month,2);
});
test('simultaneous conflict button clicks perform only one resolution',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();await Promise.all([h.sync.choose(false),h.sync.choose(true)]);assert.equal(h.net.row.game_state.month,2);assert.equal(JSON.parse(h.disk.getItem(SAVE_KEY)).month,2);
});
test('invalid cloud saves never replace device progress',async()=>{
 const h=harness({local:game(),base:game(),remote:row({month:2})});await h.sync.request();assert.equal(h.view.status,'Sync failed');assert.equal(h.disk.getItem(SAVE_KEY),raw(game()));assert.equal(h.net.writes,0);
});
test('invalid local data can be recovered from cloud after explicit choice',async()=>{
 const disk=storage({[SAVE_KEY]:'invalid json'});const h=harness({store:disk,remote:row(game(4))});await h.sync.request();assert.ok(h.view.conflict);await h.sync.choose(true);assert.equal(JSON.parse(disk.getItem(SAVE_KEY)).month,4);assert.equal(JSON.parse(disk.getItem(BACKUP_KEY))[0].snapshot,'invalid json');
});
test('storage quota failure prevents destructive cloud load',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();const set=h.disk.setItem;h.disk.setItem=(k,v)=>{if(k===BACKUP_KEY)throw Error('Quota exceeded');set(k,v);};await h.sync.choose(true);assert.equal(h.disk.getItem(SAVE_KEY),raw(game(2)));assert.ok(h.view.conflict);assert.equal(h.view.reloads,0);
});
test('storage quota failure prevents an unbacked explicit cloud overwrite',async()=>{
 const h=harness({local:game(2),remote:row(game(4))});await h.sync.request();h.disk.setItem=()=>{throw Error('Quota exceeded');};await h.sync.choose(false);assert.equal(h.net.writes,0);assert.equal(h.net.row.game_state.month,4);
});
test('game actions preserve previous local save when persistence fails',()=>{
 const disk=storage({[SAVE_KEY]:raw(game())});disk.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>persistLocal(disk,game(2)));assert.equal(disk.getItem(SAVE_KEY),raw(game()));
});
test('legacy saves and existing game fields validate without migration/reset',()=>{
 assert.ok(validSave(game()));assert.ok(validSave({...game(),cash:-100,endingChoice:'bankrupt'}));assert.ok(!validSave({...game(),prices:{}}));assert.ok(!validSave({...game(),positions:{h100:{qty:-1,cost:0}}}));assert.ok(!validSave({...game(),reports:[{}]}));assert.equal(canonical(raw(game())),canonical(raw(Object.fromEntries(Object.entries(game()).reverse()))));
});

test('a lost response followed by more actions uses durable upload intent after restart',async()=>{
 const h=harness({local:game(2),base:game()});const write=h.net.write.bind(h.net);
 h.net.write=async(...args)=>{await write(...args);throw Error('Response lost');};
 await h.sync.request();h.sync.stop();h.disk.setItem(SAVE_KEY,raw(game(3)));h.net.write=write;
 const next=harness({store:h.disk,server:h.net});await next.sync.request();
 assert.equal(next.view.conflict,null);assert.equal(next.net.row.game_state.month,3);
});
test('first upload claims account ownership before its response arrives',async()=>{
 const h=harness({local:game(2),remote:null});const entered=deferred(),release=deferred();const write=h.net.write.bind(h.net);
 h.net.write=async(...args)=>{entered.resolve();await release.promise;return write(...args);};
 const request=h.sync.request();await entered.promise;h.sync.stop();
 const bob=harness({user:'bob',store:h.disk,remote:null});await bob.sync.request();
 assert.equal(bob.net.writes,0);assert.equal(bob.view.conflict.otherAccount,true);
 release.resolve();await request;
});

test('repeated conditional-write rejection is bounded rather than a tight retry loop',async()=>{
 const h=harness({local:game(2),base:game()});let attempts=0;h.net.write=async()=>{attempts++;return null;};await h.sync.request();
 assert.equal(attempts,8);assert.equal(h.view.status,'Sync pending');assert.equal(h.disk.getItem(SAVE_KEY),raw(game(2)));
});

test('an action from a stale browser tab cannot overwrite a newer shared device save',()=>{
 const disk=storage({[SAVE_KEY]:raw(game(4))});assert.throws(()=>persistLocal(disk,game(2),game(1)),/Saved progress changed/);assert.equal(disk.getItem(SAVE_KEY),raw(game(4)));
});
test('local action preconditions compare content rather than JSON key order',()=>{
 const disk=storage({[SAVE_KEY]:raw(Object.fromEntries(Object.entries(game()).reverse()))});persistLocal(disk,game(2),game());assert.equal(disk.getItem(SAVE_KEY),raw(game(2)));
});
