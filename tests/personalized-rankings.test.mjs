import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const result=await build({stdin:{contents:`export * from './src/exitValues';export * from './src/personalRecords';export * from './src/personalBest';export * from './src/rankingsProfile';export * from './src/accountSaves';export * from './src/localSaves';`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node'});
const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const R=mod.exports;
const game=(cash=5e6,seed=42)=>({month:3,cash,labs:0,seed,ended:false,history:[],headline:'Synthetic',ending:'',prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{}});
const disk=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const save=(store,state,fresh=false)=>R.writeLocal(store,state,R.readLocal(store).stamp,{fresh});
const extended=(month=42,cash=3e9)=>({...game(cash),month,ended:month===42,gamble:{version:1,decision:'extend',standardResult:{month:30,valuation:150e6,peak:200e6,success:true,ending:'acquisition'},enterprise:{reliability:1,purchasedSlots:0,contracts:[],discountThrough:0,focus:'operate',ledger:[]},...(month===42?{extensionOutcome:{month,valuation:cash+20e6,reason:'completed',unicorn:true,mogabr:false}}:{})}});
test('permanent bosses cannot be displaced even above MOGABR; only one player and ten total entries',()=>{
 for(const value of [10e9,204e9,1e12]){const rows=R.personalizedRankings(value,'Founder X');assert.deepEqual(rows.slice(0,2).map(x=>x.name),['MOGABR','Gabe M.']);assert.equal(rows[2].id,'player');assert.equal(rows.length,10);assert.equal(rows.filter(x=>x.player).length,1);}
});
test('no qualifier and incumbent-first ties are stable, with no mutation of fixed records',()=>{
 assert.ok(R.personalizedRankings(null).every(x=>!x.player));assert.ok(R.personalizedRankings(2083417936).every(x=>!x.player));
 assert.equal(R.personalizedRankings(2083417937).at(-1).id,'player');
 const exact=R.personalizedRankings(8291470118.9);assert.equal(exact.find(x=>x.player).rank,5,'incumbent wins an exact tie');assert.ok(R.personalizedRankings(2083417936.42).every(x=>!x.player));
 const a=R.personalizedRankings(8291470119);assert.equal(a.find(x=>x.player).rank,4);assert.deepEqual(a,R.personalizedRankings(8291470119));
});
test('Founder names are normalized and bounded, reject markup, controls, reserved identities and common offensive text',()=>{
 assert.equal(R.founderName('  Renée   Labs  '),'Renée Labs');assert.equal(R.founderName('YOU'),'YOU');
 for(const bad of ['', 'x'.repeat(25),'<script>', 'x\ny','abc\u202e', 'MOGABR','Gabe M.','fuck'])assert.throws(()=>R.founderName(bad),bad);
});
test('name and congratulations preference survive restart and remain isolated across Guest/A/B',()=>{
 const d=disk();for(const [id,name] of [['guest','Guest Lab'],['user:A','Alpha'],['user:B','Beta']])R.saveRankingsProfile(R.accountStore(d,id),name,true);
 for(const [id,name] of [['guest','Guest Lab'],['user:A','Alpha'],['user:B','Beta']])assert.deepEqual(R.rankingsProfile(R.accountStore(d,id)),{version:1,name,welcomed:true});
 assert.equal(d.getItem(R.RANKINGS_PROFILE_KEY),null);assert.equal(R.rankingsProfile(R.accountStore(d,'user:C')).name,'YOU');
});
test('stale name callbacks and interrupted preference writes do not claim success or change game snapshots',()=>{
 const d=disk(),a=R.accountAuthority(),store=R.accountStore(d,'guest',a.select('guest'));save(store,game());const original=store.getItem(R.LOCAL_KEY);
 a.select('user:B');assert.throws(()=>R.saveRankingsProfile(store,'Old callback',true),/account changed/);assert.equal(store.getItem(R.LOCAL_KEY),original);
 const silent={getItem:()=>null,setItem:()=>{}};assert.throws(()=>R.saveRankingsProfile(silent,'Valid',true),/not be saved/);
});
test('existing numeric personal bests retain exact values with unknown provenance, and malformed records stay untouched',()=>{
 const d=disk(),s=R.accountStore(d,'guest');s.setItem(R.PERSONAL_BEST_KEY,JSON.stringify(15.8e9));assert.deepEqual(R.savedPersonalRecords(s).best,{value:15.8e9,source:'legacy',month:null});
 R.rememberPersonalRecords(s);assert.equal(s.getItem(R.PERSONAL_BEST_KEY),JSON.stringify(15.8e9));
 s.setItem(R.PERSONAL_RECORDS_KEY,'damaged');assert.throws(()=>R.rememberPersonalRecords(s));assert.equal(s.getItem(R.PERSONAL_RECORDS_KEY),'damaged');assert.equal(R.savedPersonalRecords(s).best.value,15.8e9);
});
test('standard and eligible Month42 report peaks retain their actual provenance without changing frozen Month30 result',()=>{
 const d=disk(),s=R.accountStore(d,'guest'),g=extended();g.reports=[{month:39,valuation:4e9}];const before=JSON.stringify(g.gamble.standardResult);save(s,g);
 assert.deepEqual(R.savedPersonalRecords(s).best,{value:4e9,source:'valuation',month:39});assert.equal(JSON.stringify(g.gamble.standardResult),before);
 save(s,game(),true);assert.deepEqual(R.savedPersonalRecords(s).best,{value:4e9,source:'valuation',month:39});
 assert.equal(R.snapshotRecords({...g,month:43}).best,null);assert.equal(R.snapshotRecords({...game(),month:42}).best,null);
});
test('acquisitions reuse each existing displayed price; recording does not alter cash, company valuation or frozen victory',()=>{
 const s=extended(),value=s.cash+20e6;const frozen=JSON.stringify(s.gamble.standardResult);
 R.acquisitionOffers(s.seed,value).forEach((offer,i)=>{
  assert.equal(offer.valuation,Math.round(value*(1.08+i*.06)));
  const closed=R.completeExit(s,offer.buyer,value),r=R.snapshotRecords(closed);
  assert.equal(closed.cash,s.cash);assert.equal(closed.exitResult.companyValuation,value);assert.equal(closed.exitResult.valuation,offer.valuation);
  assert.deepEqual(r.best,{value:offer.valuation,source:'acquisition',month:42});assert.equal(r.companyPeak.value,value);assert.equal(r.completedExit.value,offer.valuation);
  assert.equal(JSON.stringify(closed.gamble.standardResult),frozen);assert.throws(()=>R.completeExit(closed,offer.buyer,value));
 });
});
test('IPO uses existing company value with no invented multiplier and requires the original eligibility gates',()=>{
 const g={...game(200e6),labs:3,month:30,ended:true};const value=20e6+g.cash+3*420000*12*3.25+3*270000*12*.3;
 const closed=R.completeExit(g,'Fictional IPO',value),r=R.snapshotRecords(closed);assert.equal(closed.exitResult.valuation,Math.round(value));assert.equal(r.best.source,'ipo');assert.equal(r.completedExit.month,30);
 assert.throws(()=>R.completeExit({...g,labs:2},'Fictional IPO',value));assert.throws(()=>R.completeExit({...g,cash:-1},'Fictional IPO',value));
});
test('larger company peak remains overall best after a smaller exit, while exit metadata persists separately',()=>{
 const g=extended();g.reports=[{month:39,valuation:15.8e9}];const closed=R.completeExit(g,R.acquisitionOffers(g.seed,g.cash+20e6)[0].buyer,g.cash+20e6),d=disk(),s=R.accountStore(d,'guest');save(s,closed);
 let record=R.savedPersonalRecords(s);assert.deepEqual(record.best,{value:15.8e9,source:'valuation',month:39});assert.equal(record.completedExit.source,'acquisition');
 save(s,game(),true);record=R.savedPersonalRecords(R.accountStore(d,'guest'));assert.equal(record.best.value,15.8e9);assert.equal(record.completedExit.month,42);
});
test('new completed acquisition survives restart and new game with source and month',()=>{
 const d=disk(),s=R.accountStore(d,'user:A'),g=extended();const offer=R.acquisitionOffers(g.seed,g.cash+20e6)[2];save(s,R.completeExit(g,offer.buyer,g.cash+20e6));save(s,game(),true);
 assert.deepEqual(R.savedPersonalRecords(R.accountStore(d,'user:A')).best,{value:offer.valuation,source:'acquisition',month:42});assert.equal(R.savedPersonalRecords(R.accountStore(d,'guest')).completedExit,null);
});
test('eligible early exits qualify without awarding a completed IPO or acquisition; invalid exit metadata never awards a premium',()=>{
 const g=extended(38);g.ended=true;g.gamble.extensionOutcome={month:38,valuation:g.cash+20e6,reason:'early',unicorn:true,mogabr:false};assert.equal(R.snapshotRecords(g).completedExit.source,'early-exit');
 const bad={...g,endingChoice:'Microsoft',exitResult:{version:1,kind:'acquisition',month:38,companyValuation:1,valuation:999e9,buyer:'Microsoft'}};assert.equal(R.snapshotRecords(bad).best.value,g.cash+20e6);
});
test('bankruptcy/fraud terminal values cannot mint peaks; older legitimate personal bests remain',()=>{
 const d=disk(),s=R.accountStore(d,'guest');save(s,game(100e6));
 const failed={...game(-1),ended:true,endingChoice:'bankrupt',reports:[{month:2,valuation:30e6},{month:3,valuation:999e9}],positions:{h100:{qty:1000000,cost:1}}};save(s,failed);assert.equal(R.savedPersonalRecords(s).best.value,120e6);
 assert.equal(R.snapshotBest(failed),30e6);assert.equal(R.snapshotRecords({...failed,cash:1,endingChoice:'fraud'}).best.value,30e6);
});
test('metadata quota failures cannot block ordinary trade/month saves; reset waits if outgoing exit provenance is not durable',()=>{
 const d=disk(),s=R.accountStore(d,'guest');save(s,game());const set=d.setItem;d.setItem=(k,v)=>{if(k.endsWith(R.PERSONAL_RECORDS_KEY))throw Error('quota');set(k,v);};
 const g=extended(),closed=R.completeExit(g,R.acquisitionOffers(g.seed,g.cash+20e6)[0].buyer,g.cash+20e6);save(s,closed);assert.equal(R.readLocal(s).state.month,42);assert.equal(R.savedPersonalRecords(s).completedExit.source,'acquisition');
 const before=s.getItem(R.LOCAL_KEY);assert.throws(()=>save(s,game(5e6,99),true));assert.equal(s.getItem(R.LOCAL_KEY),before);
 d.setItem=set;save(s,game(5e6,99),true);assert.equal(R.savedPersonalRecords(s).best.source,'acquisition');
});
test('the actual exit handler updates UI only after the existing game save succeeds',()=>{
 const source=readFileSync('src/main.tsx','utf8');const body=source.match(/function resolveExit\(name:string\)\{(.*?)\}\n/s)[1];
 const run=new Function('completeExit','s','worth','update','setExitChoice','setGrowthError','name',body);
 const s=extended(),worth=s.cash+20e6,name=R.acquisitionOffers(s.seed,worth)[0].buyer;
 let selected=null,committed=null,error='';
 run(R.completeExit,s,worth,next=>{committed=next;return true;},v=>selected=v,v=>error=v,name);
 assert.equal(selected,name);assert.equal(committed.exitResult.kind,'acquisition');assert.equal(error,'');
 selected=null;run(R.completeExit,s,worth,()=>false,v=>selected=v,v=>error=v,name);assert.equal(selected,null);
 run(R.completeExit,{...s,cash:-1},worth,()=>assert.fail('invalid exit written'),v=>selected=v,v=>error=v,name);assert.equal(selected,null);assert.ok(error);

});
test('unrelated gameplay, authentication, backend and native configuration are unchanged from merged main',()=>{
 for(const path of ['src/foundersGamble.ts','src/AuthGate.tsx','src/localSaves.ts','src/fixedRankings.ts','src/chipTrading.ts','src/ChipTradingPanel.tsx','src/style.css','capacitor.config.ts','ios/App/App/AppDelegate.swift','ios/App/App/Info.plist','ios/App/App.xcodeproj/project.pbxproj','supabase/migrations/202610150002_billionaire_board.sql'])assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show','27d2dc9:'+path],{encoding:'utf8'}),path);
});

test('immediate Month30 extension exit preserves its qualified record without inventing extra months',()=>{
 const g=extended(30,130e6);g.ended=true;g.gamble.extensionOutcome={month:30,valuation:150e6,reason:'early',unicorn:false,mogabr:false};
 const r=R.snapshotRecords(g);assert.equal(r.best.value,200e6);assert.equal(r.completedExit.source,'early-exit');assert.equal(r.completedExit.month,30);
});
test('historical accepted buyer names without stored exit amounts do not invent acquisition prices',()=>{
 const g={...extended(),endingChoice:'Microsoft'};const r=R.snapshotRecords(g);assert.equal(r.completedExit,null);assert.equal(r.best.source,'valuation');
});
test('Guest sign-out preserves richer record and founder name without transferring another account',()=>{
 const d=disk(),guest=R.accountStore(d,'guest'),a=R.accountStore(d,'user:A'),g=extended();
 save(guest,R.completeExit(g,R.acquisitionOffers(g.seed,g.cash+20e6)[0].buyer,g.cash+20e6));R.saveRankingsProfile(guest,'Guest Lab',true);save(a,game());
 const expected=R.savedPersonalRecords(guest),prep=R.prepareGuestSignOut(d,game(5e6,99));R.writeLocal(prep.guest,prep.freshGame,prep.stamp,{fresh:true});
 assert.deepEqual(R.savedPersonalRecords(guest),expected);assert.equal(R.rankingsProfile(guest).name,'Guest Lab');assert.equal(R.savedPersonalRecords(a).completedExit,null);
});

test('equal IPO/company values prefer the completed exit without inflating the amount',()=>{
 const g={...game(200e6),labs:3,month:30,ended:true},value=20e6+g.cash+3*420000*12*3.25+3*270000*12*.3;
 const d=disk(),s=R.accountStore(d,'guest');save(s,g);save(s,R.completeExit(g,'Fictional IPO',value));
 const summary=R.savedPersonalRecords(s);assert.equal(summary.best.source,'ipo');assert.equal(summary.best.value,summary.companyPeak.value);assert.equal(summary.best.value,summary.completedExit.value);
});
test('unknown or corrupt snapshot data never gains exit provenance, and silent metadata failures preserve the committed game',()=>{
 assert.equal(R.snapshotRecords(null).best,null);assert.equal(R.snapshotRecords({...game(),prices:{}}).best,null);
 const d=disk(),s=R.accountStore(d,'guest');save(s,game());const set=d.setItem;d.setItem=(k,v)=>{if(!k.endsWith(R.PERSONAL_RECORDS_KEY))set(k,v);};save(s,game(100e6));assert.equal(R.savedPersonalRecords(s).best.value,120e6);assert.equal(R.readLocal(s).state.cash,100e6);
 assert.throws(()=>save(s,game(5e6,99),true));d.setItem=set;R.rememberPersonalRecords(s);save(s,game(5e6,99),true);assert.equal(R.savedPersonalRecords(s).best.value,120e6);
});

test('YOU is the default, and clearing/resetting a custom name retains scope, record and welcome history',()=>{
 const d=disk(),guest=R.accountStore(d,'guest'),a=R.accountStore(d,'user:A'),b=R.accountStore(d,'user:B');
 for(const store of [guest,a,b])assert.deepEqual(R.rankingsProfile(store),{version:1,name:'YOU',welcomed:false});
 save(guest,game(10e9));save(a,game(200e6));R.saveRankingsProfile(guest,'Nova Forge',true);R.saveRankingsProfile(a,'Alpha',false);R.saveRankingsProfile(b,'Beta',true);
 const raw=guest.getItem(R.LOCAL_KEY),best=R.savedPersonalRecords(guest);
 assert.deepEqual(R.saveRankingsProfile(guest,'',true),{version:1,name:'YOU',welcomed:true});
 assert.equal(R.rankingsProfile(R.accountStore(d,'guest')).name,'YOU');assert.equal(R.personalizedRankings(best.best.value,R.rankingsProfile(guest).name).find(x=>x.player).name,'YOU');
 R.saveRankingsProfile(guest,'Nova Forge',true);assert.equal(R.saveRankingsProfile(guest,'   ',true).name,'YOU');
 assert.equal(guest.getItem(R.LOCAL_KEY),raw);assert.deepEqual(R.savedPersonalRecords(guest),best);
 assert.equal(R.rankingsProfile(a).name,'Alpha');assert.equal(R.rankingsProfile(b).name,'Beta');
 for(const invalid of ['<script>','x'.repeat(25),'x\ny'])assert.throws(()=>R.saveRankingsProfile(guest,invalid,true));
 assert.equal(R.rankingsProfile(guest).name,'YOU');
});
test('record survives simulated in-place client update, new game and unrelated failure without changing original saves or archives',()=>{
 const d=disk(),s=R.accountStore(d,'guest'),g=extended(42,13e9),offer=R.acquisitionOffers(g.seed,g.cash+20e6)[2];
 const originalGame=JSON.stringify(g),originalArchive=JSON.stringify([{key:R.LOCAL_KEY,raw:originalGame}]);
 s.setItem(R.LOCAL_KEY,originalGame);s.setItem(R.RECOVERY_KEY,originalArchive);s.setItem(R.PERSONAL_BEST_KEY,JSON.stringify(15.8e9));
 const before=new Map(d.data);const adopted=R.savedPersonalRecords(s);assert.equal(adopted.best.value,15.8e9);assert.deepEqual(d.data,before,'new reader makes no game or archive writes');
 R.rememberPersonalRecords(s);assert.equal(s.getItem(R.LOCAL_KEY),originalGame);assert.equal(s.getItem(R.RECOVERY_KEY),originalArchive);
 const closed=R.completeExit(g,offer.buyer,g.cash+20e6);assert.deepEqual(closed.gamble,g.gamble,'entire standard/extension result is unchanged');save(s,closed);save(s,game(5e6,99),true);
 const expected=R.savedPersonalRecords(s),archive=s.getItem(R.RECOVERY_KEY);
 save(s,{...game(-1,99),ended:true,endingChoice:'bankrupt',reports:[{month:2,valuation:30e6},{month:3,valuation:999e9}]});
 assert.deepEqual(R.savedPersonalRecords(R.accountStore(d,'guest')),expected);assert.equal(s.getItem(R.RECOVERY_KEY),archive);
 assert.ok(JSON.parse(archive).some(x=>x.raw===originalGame));
});

// These fixtures use completed deals derived from the actual game rules, not
// hand-written dollar-only bests, so every assertion protects provenance too.
function storageFixFixture(kind='acquisition',higherPeak=false){
 const g=kind==='acquisition'?{...game(980e6),month:30,ended:true}:{...game(200e6),month:30,labs:3,ended:true};
 const current=20e6+g.cash+g.labs*420000*12*3.25+g.labs*270000*12*.3;
 if(higherPeak)g.reports=[{month:29,valuation:2e9}];
 const closed=R.completeExit(g,kind==='ipo'?'Fictional IPO':R.acquisitionOffers(g.seed,current)[2].buyer,current);
 const record=R.snapshotRecords(closed),d=disk();
 d.setItem(R.PERSONAL_RECORDS_KEY,JSON.stringify(record));d.setItem(R.PERSONAL_BEST_KEY,JSON.stringify(record.companyPeak.value));
 return {d,record,raw:d.getItem(R.PERSONAL_RECORDS_KEY)};
}
function secondReadFailure(d){
 let reads=0,writes=0;
 return {store:{getItem(k){if(k===R.PERSONAL_RECORDS_KEY&&++reads===2)throw Error('Synthetic second read failure');return d.getItem(k);},setItem(k,v){writes++;d.setItem(k,v);}},get writes(){return writes;}};
}
test('original $1.2B → $25M second-read regression preserves all achievement fields without a replacement write',()=>{
 const {d,record,raw}=storageFixFixture();assert.equal(record.best.value,1.2e9);assert.deepEqual(record.best,{value:1.2e9,source:'acquisition',month:30});
 const fault=secondReadFailure(d);R.rememberPersonalRecords(fault.store,game());
 assert.equal(fault.writes,0);assert.equal(d.getItem(R.PERSONAL_RECORDS_KEY),raw);assert.deepEqual(JSON.parse(d.getItem(R.PERSONAL_RECORDS_KEY)),record);
});
test('repeated second-read failures preserve acquisition/IPO records and independent higher company peaks, then recover normally',()=>{
 for(const kind of ['acquisition','ipo'])for(const higherPeak of [false,true]){
  const {d,record}=storageFixFixture(kind,higherPeak);
  for(let i=0;i<5;i++){R.rememberPersonalRecords(secondReadFailure(d).store,game(5e6,90+i));assert.deepEqual(JSON.parse(d.getItem(R.PERSONAL_RECORDS_KEY)),record,`${kind}, higherPeak=${higherPeak}, failure ${i}`);}
  const raised=game(3e9,99);R.rememberPersonalRecords(d,raised);let next=R.savedPersonalRecords(d);
  assert.deepEqual(next.best,{value:3020e6,source:'valuation',month:3});assert.deepEqual(next.completedExit,record.completedExit);assert.deepEqual(next.companyPeak,{value:3020e6,source:'valuation',month:3});
  for(let i=0;i<3;i++){R.rememberPersonalRecords(secondReadFailure(d).store,game());assert.deepEqual(R.savedPersonalRecords(d),next);}
 }
});
test('a higher update during the second-read failure still preserves the previous separate exit and source/month metadata',()=>{
 for(const kind of ['acquisition','ipo']){
  const {d,record}=storageFixFixture(kind);R.rememberPersonalRecords(secondReadFailure(d).store,game(3e9));
  const next=JSON.parse(d.getItem(R.PERSONAL_RECORDS_KEY));assert.deepEqual(next.completedExit,record.completedExit);assert.deepEqual(next.best,{value:3020e6,source:'valuation',month:3});assert.equal(next.companyPeak.value,3020e6);
 }
});
test('failed first reads and invalid records fail closed without writes or loss of any original data',()=>{
 const {d,raw}=storageFixFixture();let writes=0;
 const unavailable={getItem(){throw Error('Synthetic first read failure');},setItem(){writes++;}};
 for(let i=0;i<3;i++)assert.throws(()=>R.rememberPersonalRecords(unavailable,game(3e9)),/first read/);
 assert.equal(writes,0);assert.equal(d.getItem(R.PERSONAL_RECORDS_KEY),raw);
 for(const bad of ['damaged',JSON.stringify({version:99}),JSON.stringify({version:1,best:null,companyPeak:{value:1e9,source:'valuation',month:30},completedExit:null})]){
  d.setItem(R.PERSONAL_RECORDS_KEY,bad);assert.throws(()=>R.rememberPersonalRecords(d,game()),/recovery/);assert.equal(d.getItem(R.PERSONAL_RECORDS_KEY),bad);
 }
});
test('repeated rejected and silently ignored writes retain the prior complete record, and healthy retries preserve its exit',()=>{
 for(const mode of ['throw','silent'])for(const kind of ['acquisition','ipo']){
  const {d,record,raw}=storageFixFixture(kind);let attempts=0;
  const unavailable={getItem:k=>d.getItem(k),setItem(){attempts++;if(mode==='throw')throw Error('Synthetic quota failure');}};
  for(let i=0;i<3;i++){assert.throws(()=>R.rememberPersonalRecords(unavailable,game(3e9)));assert.equal(d.getItem(R.PERSONAL_RECORDS_KEY),raw);assert.deepEqual(R.savedPersonalRecords(d).completedExit,record.completedExit);}
  assert.equal(attempts,3);R.rememberPersonalRecords(d,game(3e9));assert.equal(R.savedPersonalRecords(d).best.value,3020e6);assert.deepEqual(R.savedPersonalRecords(d).completedExit,record.completedExit);
 }
});
test('a failed post-write verification leaves a safe merged record and recovers without removing earlier exit details',()=>{
 const {d,record}=storageFixFixture();let written=false;
 const unavailable={getItem(k){if(written&&k===R.PERSONAL_RECORDS_KEY)throw Error('Synthetic verification failure');return d.getItem(k);},setItem(k,v){d.setItem(k,v);written=true;}};
 assert.throws(()=>R.rememberPersonalRecords(unavailable,game(3e9)),/verification failure/);
 let next=R.savedPersonalRecords(d);assert.equal(next.best.value,3020e6);assert.deepEqual(next.completedExit,record.completedExit);R.rememberPersonalRecords(d,game());assert.deepEqual(R.savedPersonalRecords(d),next);
});
test('read-failure recovery leaves historical numeric records and original game/archive bytes intact',()=>{
 const {d,record}=storageFixFixture('ipo');const original=JSON.stringify(game(100e6)),archive=JSON.stringify([{key:R.LOCAL_KEY,raw:original}]);
 d.setItem(R.PERSONAL_BEST_KEY,JSON.stringify(5e9));d.setItem(R.LOCAL_KEY,original);d.setItem(R.RECOVERY_KEY,archive);
 R.rememberPersonalRecords(secondReadFailure(d).store,game());assert.deepEqual(JSON.parse(d.getItem(R.PERSONAL_RECORDS_KEY)),record);
 R.rememberPersonalRecords(d);const recovered=R.savedPersonalRecords(d);assert.deepEqual(recovered.best,{value:5e9,source:'legacy',month:null});assert.deepEqual(recovered.completedExit,record.completedExit);
 assert.equal(d.getItem(R.PERSONAL_BEST_KEY),JSON.stringify(5e9));assert.equal(d.getItem(R.LOCAL_KEY),original);assert.equal(d.getItem(R.RECOVERY_KEY),archive);
});
test('account changes reject stale record writes even when the valid record would otherwise be preserved',()=>{
 const d=disk(),authority=R.accountAuthority(),a=R.accountStore(d,'user:A',authority.select('user:A'));
 const g={...game(980e6),month:30,ended:true},closed=R.completeExit(g,R.acquisitionOffers(42,1e9)[2].buyer,1e9);save(a,closed);R.saveRankingsProfile(a,'Alpha',true);
 const beforeA=a.getItem(R.PERSONAL_RECORDS_KEY),b=R.accountStore(d,'user:B',authority.select('user:B'));save(b,game());R.saveRankingsProfile(b,'Beta',false);const beforeB=b.getItem(R.PERSONAL_RECORDS_KEY);
 assert.throws(()=>R.rememberPersonalRecords(a,game(3e9)),/account changed/);assert.equal(a.getItem(R.PERSONAL_RECORDS_KEY),beforeA);assert.equal(b.getItem(R.PERSONAL_RECORDS_KEY),beforeB);
 assert.equal(R.rankingsProfile(b).name,'Beta');assert.equal(R.rankingsProfile(R.accountStore(d,'guest')).name,'YOU');
});

test('real scoped New Game and later bankruptcy retain all record details through repeated second-read failures',()=>{
 const d=disk(),s=R.accountStore(d,'guest'),g={...game(980e6),month:30,ended:true};
 save(s,R.completeExit(g,R.acquisitionOffers(g.seed,1e9)[2].buyer,1e9));const expected=R.savedPersonalRecords(s);
 const get=d.getItem;let reads=0;
 d.getItem=k=>{if(k.endsWith(R.PERSONAL_RECORDS_KEY)&&++reads%2===0)throw Error('Synthetic repeated second read failure');return get(k);};
 save(s,{...game(5e6,99),month:1},true);
 assert.deepEqual(JSON.parse(get(R.accountKey('guest',R.PERSONAL_RECORDS_KEY))),expected);
 const archive=get(R.accountKey('guest',R.RECOVERY_KEY));
 reads=0;save(s,{...game(-1,99),ended:true,endingChoice:'bankrupt',reports:[{month:2,valuation:30e6},{month:3,valuation:999e9}]});
 assert.deepEqual(JSON.parse(get(R.accountKey('guest',R.PERSONAL_RECORDS_KEY))),expected);assert.equal(get(R.accountKey('guest',R.RECOVERY_KEY)),archive);
 d.getItem=get;R.rememberPersonalRecords(s);assert.deepEqual(R.savedPersonalRecords(R.accountStore(d,'guest')),expected);
 assert.equal(R.rankingsProfile(s).name,'YOU');assert.equal(R.savedPersonalRecords(R.accountStore(d,'user:B')).best,null);
});
