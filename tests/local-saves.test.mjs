import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const module=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const {decodeLocal,readLocal,writeLocal,recoveryFile,LOCAL_KEY,OLD_KEY,LEGACY_KEY,RECOVERY_KEY}=await module('src/localSaves.ts');
const rules=await module('src/foundersGamble.ts');
const game=(patch={})=>({month:3,cash:5e6,labs:0,seed:42,ended:false,history:[],headline:'Synthetic',ending:'',prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{},...patch});
class Disk{map=new Map();fail=null;getItem(k){if(this.fail==='read')throw Error('unavailable');return this.map.get(k)??null;}setItem(k,v){if(this.fail===k)throw Error('quota');this.map.set(k,v);}}
function active(){const s=game({month:30,cash:1e8,labs:8,ended:true});s.gamble=rules.freezeStandard(s,2e8);return rules.decideGamble(s,'extend');}
const protectedRead=f=>{
 const s=readFileSync(f,'utf8');
 if(f!=='src/foundersGamble.ts')return s;
 const a=s.indexOf('/** Highest eligible valuation in the current run');
 const b=s.indexOf('\n}\n\n',a);
 if(a<0||b<0)throw Error('Personal Best function missing');
 return s.slice(0,a)+s.slice(b+4);
};

test('empty first launch saves a new local game and resumes its exact seed/state',()=>{const d=new Disk(),empty=readLocal(d);assert.equal(empty.kind,'empty');writeLocal(d,game(),empty.stamp);assert.deepEqual(readLocal(d).state,game());assert.equal(d.getItem(OLD_KEY),null);assert.equal(d.getItem(LEGACY_KEY),null);});
test('historical primary and legacy snapshots load without being rewritten',()=>{for(const key of [OLD_KEY,LEGACY_KEY]){const d=new Disk(),old=game({ended:true,month:30,achievements:['saved']});d.setItem(key,JSON.stringify(old));const saved=readLocal(d);assert.equal(saved.kind,'ready');assert.deepEqual(saved.state,old);assert.equal(d.getItem(LOCAL_KEY),null);writeLocal(d,{...old,headline:'Next action'},saved.stamp);assert.equal(d.getItem(key),JSON.stringify(old));assert.deepEqual(readLocal(d).state.achievements,['saved']);}});
test('local-only key takes priority without deleting either historical snapshot',()=>{const d=new Disk();d.setItem(OLD_KEY,JSON.stringify(game()));d.setItem(LEGACY_KEY,JSON.stringify(game({seed:1})));writeLocal(d,game({seed:2}),readLocal(d).stamp);assert.equal(readLocal(d).state.seed,2);assert.equal(JSON.parse(d.getItem(OLD_KEY)).seed,42);assert.equal(JSON.parse(d.getItem(LEGACY_KEY)).seed,1);});
test('legacy display defaults do not invent financial/progression data',()=>{const old=game({reports:null,gamble:null});delete old.headline;delete old.ending;delete old.history;const decoded=decodeLocal(old);assert.deepEqual(decoded.history,[]);assert.equal(decoded.ending,'');assert.deepEqual(decoded.reports,[]);for(const key of ['month','cash','labs','seed','ended']){const copy={...old};delete copy[key];assert.equal(decodeLocal(copy),null,key);}assert.equal(old.history,undefined);});
test('incompatible first-choice snapshot is preserved rather than hidden by an older valid backup',()=>{const d=new Disk();d.setItem(LOCAL_KEY,'unsupported original');d.setItem(OLD_KEY,JSON.stringify(game()));const before=new Map(d.map),save=readLocal(d);assert.equal(save.kind,'blocked');assert.throws(()=>writeLocal(d,game(),save.stamp));assert.deepEqual(d.map,before);assert.ok(recoveryFile(d).includes('unsupported original'));});
test('extended game version, unknown assets and unsafe financial fields fail safely',()=>{for(const patch of [{month:43},{cash:NaN},{prices:{}},{positions:{unknown:{qty:1,cost:1}}},{gamble:{version:2}},{ended:undefined},{reports:[{month:3,valuation:Infinity}]}])assert.equal(decodeLocal(game(patch)),null);});
test('normal completed legacy games remain completed and never acquire an extension',()=>{const d=new Disk(),s=game({month:30,ended:true});d.setItem(OLD_KEY,JSON.stringify(s));assert.deepEqual(readLocal(d).state,s);assert.equal(readLocal(d).state.gamble,undefined);});
test('Month30 decisions, frozen victories and every extension month survive local restart unchanged',()=>{let s=active();const frozen=structuredClone(s.gamble.standardResult),d=new Disk();for(let month=30;month<=42;month++){s={...s,month,ended:month===42,achievements:['preserve-me']};writeLocal(d,s,readLocal(d).stamp);const restarted=readLocal(d);assert.equal(restarted.kind,'ready');assert.deepEqual(restarted.state.gamble.standardResult,frozen);assert.deepEqual(restarted.state.achievements,['preserve-me']);assert.deepEqual(restarted.state,s);}});
test('real enterprise settlements, Unicorn and Legendary MOGABR outcome remain compatible',()=>{let s=active();const settled=rules.settleEnterprise(s);s={...s,month:31,gamble:{...s.gamble,enterprise:settled.enterprise}};s=rules.recordMilestones(s,1e9);assert.ok(decodeLocal(s));s={...s,month:42,ended:true};s=rules.recordMilestones(s,2e9,'completed');assert.ok(decodeLocal(s));assert.equal(decodeLocal(s).gamble.extensionOutcome.mogabr,true);assert.equal(decodeLocal(s).gamble.standardResult.success,true);});
test('unknown achievement metadata is retained exactly and no account is required',()=>{const d=new Disk(),s=game({achievements:{unicorn:true,custom:['x']}});d.setItem('sb-synthetic-auth-token','DO_NOT_EXPORT');writeLocal(d,s,readLocal(d).stamp);assert.deepEqual(readLocal(d).state,s);assert.ok(!recoveryFile(d).includes('auth-token'));assert.ok(!recoveryFile(d).includes('DO_NOT_EXPORT'));});
test('read/storage failures block unsafe resets and failed writes retain the previous game',()=>{const d=new Disk();d.setItem(OLD_KEY,JSON.stringify(game()));const old=readLocal(d);d.fail=LOCAL_KEY;assert.throws(()=>writeLocal(d,game({cash:1}),old.stamp));assert.equal(d.getItem(OLD_KEY),JSON.stringify(game()));assert.equal(d.getItem(LOCAL_KEY),null);d.fail='read';assert.equal(readLocal(d).kind,'blocked');assert.throws(()=>writeLocal(d,game(),old.stamp));});
test('explicit fresh start preserves original raw snapshots before replacing an unreadable active game',()=>{const d=new Disk();d.setItem(LOCAL_KEY,'incompatible raw');d.setItem(OLD_KEY,JSON.stringify(game()));const s=readLocal(d);writeLocal(d,game({seed:99}),s.stamp,{recover:true,fresh:true});assert.equal(readLocal(d).state.seed,99);const copies=JSON.parse(d.getItem(RECOVERY_KEY));assert.ok(copies.some(x=>x.raw==='incompatible raw'));assert.equal(d.getItem(OLD_KEY),JSON.stringify(game()));});
test('recovery/quota failure prevents a fresh start and does not prune previous copies',()=>{const d=new Disk();d.setItem(LOCAL_KEY,'incompatible raw');d.fail=RECOVERY_KEY;assert.throws(()=>writeLocal(d,game(),readLocal(d).stamp,{recover:true,fresh:true}));assert.equal(d.getItem(LOCAL_KEY),'incompatible raw');});
test('stale tabs cannot overwrite a changed local game',()=>{const d=new Disk(),old=readLocal(d);writeLocal(d,game(),old.stamp);assert.throws(()=>writeLocal(d,game({cash:1}),old.stamp),/another window/);assert.equal(readLocal(d).state.cash,5e6);});
test('reset preserves the previous completed game before creating a new run',()=>{const d=new Disk(),old=game({ended:true,month:30});writeLocal(d,old,readLocal(d).stamp);writeLocal(d,game(),readLocal(d).stamp,{fresh:true});assert.ok(JSON.parse(d.getItem(RECOVERY_KEY)).some(x=>x.raw===JSON.stringify(old)));});
test('cloud APIs, selection and automatic-resume branch modules are absent from the runtime',()=>{for(const file of ['src/main.tsx','src/AuthGate.tsx','src/BillionaireBoard.tsx','src/localSaves.ts','src/LocalRecovery.tsx']){const code=readFileSync(file,'utf8');assert.ok(!code.includes(".from('game_saves')"),file);assert.ok(!code.includes('automaticResume'),file);assert.ok(!code.includes('SAVE REVIEW NEEDED'),file);}assert.ok(!readFileSync('src/AuthGate.tsx','utf8').includes('Choose your game save'));});
test('enterprise economics and shared trading handlers remain byte-identical to Founders Gamble',()=>{for(const f of ['src/foundersGamble.ts','src/enterprisePresentation.ts','src/EnterprisePanel.tsx','src/ChipTradingPanel.tsx','src/chipTrading.ts','capacitor.config.ts'])assert.equal(protectedRead(f),execFileSync('git',['show','ae346d9:'+f],{encoding:'utf8'}));});

test('a concurrent change during recovery preservation aborts replacement',()=>{const d=new Disk();d.setItem(LOCAL_KEY,'old unreadable');const before=readLocal(d),set=d.setItem.bind(d);d.setItem=(key,value)=>{set(key,value);if(key===RECOVERY_KEY)set(LOCAL_KEY,JSON.stringify(game({seed:77})));};assert.throws(()=>writeLocal(d,game({seed:99}),before.stamp,{fresh:true,recover:true}),/another window/);assert.equal(readLocal(d).state.seed,77);});

test('a successful write returns its own stamp rather than adopting an unrelated concurrent snapshot',()=>{const d=new Disk(),before=readLocal(d),set=d.setItem.bind(d);d.setItem=(key,value)=>{set(key,value);if(key===LOCAL_KEY)set(LEGACY_KEY,JSON.stringify(game({seed:123})));};const stamp=writeLocal(d,game(),before.stamp);assert.equal(JSON.parse(stamp)[LEGACY_KEY],null);assert.throws(()=>writeLocal(d,game({cash:1}),stamp),/another window/);assert.equal(readLocal(d).state.cash,5e6);});

test('Guest fresh start archives previous progress and rejects invalid replacements',()=>{
 const d=new Disk();
 const previous=game({month:12,cash:9e6,seed:123});
 writeLocal(d,previous,readLocal(d).stamp);

 const before=new Map(d.map);
 assert.throws(()=>writeLocal(d,{month:1},readLocal(d).stamp,{fresh:true}));
 assert.deepEqual(d.map,before);

 const fresh=game({month:1,seed:456});
 writeLocal(d,fresh,readLocal(d).stamp,{fresh:true});

 assert.equal(readLocal(d).state.month,1);
 assert.equal(readLocal(d).state.seed,456);
 assert.ok(
  JSON.parse(d.getItem(RECOVERY_KEY)).some(
   copy=>copy.raw===JSON.stringify(previous)
  )
 );
});
