import {decodeLocal,GAME_KEYS,RECOVERY_KEY} from './localSaves';
import {savedPersonalBest,snapshotBest} from './personalBest';
import {premium} from './foundersGamble';
import {completeExit} from './exitValues';
export type RecordSource='valuation'|'acquisition'|'ipo'|'early-exit'|'legacy';
export type BestRecord={value:number;source:RecordSource;month:number|null};
export type PersonalRecords={version:1;best:BestRecord|null;companyPeak:BestRecord|null;completedExit:BestRecord|null};
type Store=Pick<Storage,'getItem'|'setItem'>;
export const PERSONAL_RECORDS_KEY='silicon-hustle-personal-records-v1';
const empty=():PersonalRecords=>({version:1,best:null,companyPeak:null,completedExit:null});
const amount=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const priorities:Record<RecordSource,number>={legacy:0,valuation:1,'early-exit':2,ipo:3,acquisition:4};
function valid(r:unknown):r is BestRecord{const x=r as BestRecord;return !!x&&amount(x.value)&&Object.hasOwn(priorities,x.source)&&(x.month===null||Number.isInteger(x.month)&&x.month>=1&&x.month<=42);}
function choose(a:BestRecord|null,b:BestRecord|null):BestRecord|null{
 if(!a)return b;if(!b)return a;
 if(b.value!==a.value)return b.value>a.value?b:a;
 if(priorities[b.source]!==priorities[a.source])return priorities[b.source]>priorities[a.source]?b:a;
 if(a.month===null)return b;if(b.month===null)return a;return b.month<a.month?b:a;
}
function merge(a:PersonalRecords,b:PersonalRecords):PersonalRecords{
 return {version:1,best:choose(a.best,b.best),companyPeak:choose(a.companyPeak,b.companyPeak),completedExit:choose(a.completedExit,b.completedExit)};
}
function parse(raw:string|null):unknown{try{return raw===null?null:JSON.parse(raw);}catch{return null;}}
function decode(raw:unknown):PersonalRecords|null{
 const r=raw as PersonalRecords;
 if(!r||r.version!==1||!['best','companyPeak','completedExit'].every(k=>r[k as keyof PersonalRecords]===null||valid(r[k as keyof PersonalRecords])))return null;
 if(r.companyPeak&&r.companyPeak.source!=='valuation'||r.completedExit&&!['ipo','acquisition','early-exit'].includes(r.completedExit.source))return null;
 if((r.companyPeak?.value??0)>(r.best?.value??0)||(r.completedExit?.value??0)>(r.best?.value??0))return null;
 return r;
}
/** New metadata is derived only from valid snapshots; no guessed historical deal prices. */
export function snapshotRecords(raw:unknown):PersonalRecords{
 const out=empty(),s=decodeLocal(raw);if(!s)return out;
 const peak=snapshotBest(s);if(peak===null)return out;
 const failed=Number(s.cash)<0||['fraud','bankrupt'].includes(String(s.endingChoice));
 const reports=(s.reports||[]) as {month:number;valuation:number}[];
 const known=reports.filter(r=>r.valuation>=0&&r.month<=Number(s.month)&&(!failed||r.month<Number(s.month)));
 let best:BestRecord={value:peak,source:'valuation',month:null};
 const match=known.filter(r=>Math.round(r.valuation)===peak).sort((a,b)=>a.month-b.month)[0];
 if(match)best.month=match.month;
 const positions=s.positions as Record<string,{qty:number}>,prices=s.prices as Record<string,number>,labs=Number(s.labs);
 const current=Math.max(0,20e6+Number(s.cash)+Object.entries(positions).reduce((n,[k,p])=>n+p.qty*prices[k],0)+labs*420000*12*3.25+labs*270000*12*.3)+premium(s as Parameters<typeof premium>[0]);
 if(!failed&&Math.round(current)===peak)best.month=best.month??Number(s.month);
 out.best=out.companyPeak=best;
 const g=s.gamble as {extensionOutcome?:{month:number;valuation:number;reason:string}}|undefined;
 if(!failed&&s.ended&&g?.extensionOutcome?.reason==='early'){
  const x=g.extensionOutcome;
  if(x.month===s.month&&Math.round(x.valuation)===Math.round(current))out.completedExit={value:Math.round(current),source:'early-exit',month:Number(s.month)};
 }
 if(!failed&&s.exitResult){
  try{
   const expected=completeExit({...s,endingChoice:undefined} as Parameters<typeof completeExit>[0],String(s.endingChoice),current).exitResult;
   const actual=s.exitResult as typeof expected;
   if(Object.entries(expected).every(([key,value])=>actual[key as keyof typeof expected]===value))out.completedExit={value:expected.valuation,source:expected.kind,month:expected.month};
  }catch{/* Unknown or malformed exit metadata never creates a score. */}
 }
 out.best=choose(out.best,out.completedExit);return out;
}
export function savedPersonalRecords(store:Store):PersonalRecords{
 let out=empty();
 try{
  out=decode(parse(store.getItem(PERSONAL_RECORDS_KEY)))??out;
  const legacy=savedPersonalBest(store);if(legacy!==null)out.best=choose(out.best,{value:legacy,source:'legacy',month:null});
  const snapshots=GAME_KEYS.map(k=>store.getItem(k));const archive=parse(store.getItem(RECOVERY_KEY));
  if(Array.isArray(archive))for(const x of archive)if(x&&GAME_KEYS.includes(x.key)&&typeof x.raw==='string')snapshots.push(x.raw);
  for(const raw of snapshots)out=merge(out,snapshotRecords(parse(raw)));
 }catch{/* Optional Rankings must not block gameplay. */}
 return out;
}
/** Caller supplies the existing account-scoped store, including stale-account guards. */
export function rememberPersonalRecords(store:Store,snapshot?:unknown){
 const raw=store.getItem(PERSONAL_RECORDS_KEY),previous=decode(parse(raw));
 if(raw!==null&&!previous)throw Error('Your record details need recovery. The original is preserved.');
 // A later failed read must never discard the record already validated above.
 const out=merge(previous??empty(),merge(savedPersonalRecords(store),snapshotRecords(snapshot)));if(!out.best)return;
 const text=JSON.stringify(out);if(raw===text)return;
 store.setItem(PERSONAL_RECORDS_KEY,text);if(store.getItem(PERSONAL_RECORDS_KEY)!==text)throw Error('Could not preserve record details.');
}
export const recordSource=(source:RecordSource)=>({valuation:'Company Valuation',acquisition:'Acquisition',ipo:'IPO','early-exit':'Early Exit',legacy:'Previously Recorded Best'})[source];
