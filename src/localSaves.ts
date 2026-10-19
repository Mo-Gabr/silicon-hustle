/** One device, one game. No network, account identifiers, or cloud metadata. */
export const LOCAL_KEY='silicon-hustle-local-v1';
export const OLD_KEY='silicon-hustle-v04';
export const LEGACY_KEY='compute-empire-v04';
export const RECOVERY_KEY='silicon-hustle-local-originals-v1';
export const GAME_KEYS=[LOCAL_KEY,OLD_KEY,LEGACY_KEY];
type Store=Pick<Storage,'getItem'|'setItem'>;
export type LocalSave={kind:'empty'|'ready'|'blocked';state:Record<string,unknown>|null;copies:Record<string,string|null>;stamp:string;reason:string};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const integer=(x:unknown,min:number,max:number)=>finite(x)&&Number.isInteger(x)&&x>=min&&x<=max;
const assets=['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'];
const focuses=['operate','pilot','enterprise','strategic','capacity','reliability'];
/** Defaults concern presentation only. Never invent money, holdings, a seed, or an ending. */
export function decodeLocal(x:unknown):Record<string,unknown>|null{
 if(!object(x)||!integer(x.month,1,42)||!finite(x.cash)||!finite(x.seed)||!integer(x.labs,0,8)||typeof x.ended!=='boolean'||!object(x.prices)||!object(x.positions))return null;
 if(!assets.every(k=>finite((x.prices as Record<string,unknown>)[k])&&Number((x.prices as Record<string,unknown>)[k])>0))return null;
 if(!Object.entries(x.positions).every(([k,p])=>assets.includes(k)&&object(p)&&integer(p.qty,0,Number.MAX_SAFE_INTEGER)&&(p.cost===undefined||finite(p.cost)&&p.cost>=0)))return null;
 if(x.history!=null&&(!Array.isArray(x.history)||!x.history.every(h=>typeof h==='string')))return null;
 if(['headline','ending'].some(k=>x[k]!=null&&typeof x[k]!=='string'))return null;
 if(x.reports!=null&&(!Array.isArray(x.reports)||!x.reports.every(r=>object(r)&&integer(r.month,1,42)&&finite(r.valuation))))return null;
 if(x.threatHistory!=null&&(!Array.isArray(x.threatHistory)||!x.threatHistory.every(h=>typeof h==='string')))return null;
 if(x.realized!=null&&(!object(x.realized)||!Object.values(x.realized).every(finite)))return null;
 if(x.threat!=null&&(!object(x.threat)||!integer(x.threat.month,1,42)||!['activist','takeover','vote'].includes(String(x.threat.kind))||typeof x.threat.title!=='string'||typeof x.threat.story!=='string'))return null;
 if(x.crisisResult!=null&&(!object(x.crisisResult)||['title','choice','summary'].some(k=>typeof (x.crisisResult as Record<string,unknown>)[k]!=='string')||typeof x.crisisResult.success!=='boolean'||!['month','cost','extraLoss','cashBefore','cashAfter','valuationBefore','valuationAfter'].every(k=>finite((x.crisisResult as Record<string,unknown>)[k]))))return null;
 const g=x.gamble;
 if(g!=null){
  if(!object(g)||g.version!==1||!['pending','exit','extend'].includes(String(g.decision))||Number(x.month)<30||(g.decision!=='extend'&&x.month!==30))return null;
  const r=g.standardResult,e=g.enterprise;
  if(!object(r)||r.month!==30||r.success!==true||!finite(r.valuation)||r.valuation<1e8||!integer(r.peak,Math.round(r.valuation),1e12)||!['ipo','acquisition'].includes(String(r.ending)))return null;
  if(!object(e)||!integer(e.reliability,1,5)||!integer(e.purchasedSlots,0,Number.MAX_SAFE_INTEGER)||!integer(e.discountThrough,0,43)||!focuses.includes(String(e.focus))||!Array.isArray(e.contracts)||!e.contracts.every(c=>object(c)&&['pilot','enterprise','strategic'].includes(String(c.kind))&&integer(c.month,30,42))||!Array.isArray(e.ledger)||!e.ledger.every(l=>object(l)&&integer(l.month,31,42)&&focuses.includes(String(l.focus))&&typeof l.won==='boolean'&&typeof l.incident==='boolean'&&typeof l.message==='string'&&['investment','billed','variable','fixed','profit'].every(k=>finite(l[k]))))return null;
  if(g.unicornMonth!==undefined&&!integer(g.unicornMonth,31,Number(x.month)))return null;
  const o=g.extensionOutcome;if(o!==undefined&&(!object(o)||!integer(o.month,30,42)||!finite(o.valuation)||!['completed','early','bankrupt','fraud'].includes(String(o.reason))||typeof o.unicorn!=='boolean'||typeof o.mogabr!=='boolean'))return null;
 }else if(Number(x.month)>30||(Array.isArray(x.reports)&&x.reports.some(r=>Number(r.month)>30)))return null;
 return {...x,history:x.history??[],headline:x.headline??'',ending:x.ending??'',...(x.reports===null?{reports:[]}:{}),...(g===null?{gamble:undefined}:{})};
}
export function readLocal(store:Store):LocalSave{
 const copies:Record<string,string|null>={};
 try{
  for(const key of GAME_KEYS)copies[key]=store.getItem(key);
  const stamp=JSON.stringify(copies),raw=GAME_KEYS.map(k=>copies[k]).find(x=>x!==null);
  if(raw===undefined)return {kind:'empty',state:null,copies,stamp,reason:''};
  let state=null;try{state=decodeLocal(JSON.parse(raw));}catch{}
  return {kind:state?'ready':'blocked',state,copies,stamp,reason:state?'':'This version can’t open your saved game. The original is still here.'};
 }catch{return {kind:'blocked',state:null,copies,stamp:'',reason:'Your device can’t access saved progress. Check available storage and try again.'};}
}
function preserve(store:Store,copies:Record<string,string|null>){
 const raw=store.getItem(RECOVERY_KEY),originals=raw?JSON.parse(raw):[];
 if(!Array.isArray(originals)||!originals.every(x=>object(x)&&typeof x.key==='string'&&typeof x.raw==='string'))throw Error('Keep your saved copy and try again after updating.');
 for(const [key,value] of Object.entries(copies))if(value!==null&&!originals.some(x=>x.key===key&&x.raw===value))originals.push({key,raw:value});
 const encoded=JSON.stringify(originals);store.setItem(RECOVERY_KEY,encoded);if(store.getItem(RECOVERY_KEY)!==encoded)throw Error('Your device could not keep the original game.');
}
export function writeLocal(store:Store,state:unknown,expected:string,{fresh=false,recover=false}={}){
 if(!decodeLocal(state))throw Error('This game could not be saved. Your previous progress is kept.');
 const current=readLocal(store);
 if(!current.stamp||current.stamp!==expected)throw Error('Your game changed in another window. Reopen it before playing.');
 if(current.kind==='blocked'&&!recover)throw Error('Your saved game needs attention. The original is kept.');
 if(fresh||recover)preserve(store,current.copies);
 if(readLocal(store).stamp!==expected)throw Error('Your game changed in another window. Reopen it before playing.');
 // Existing historical snapshot keys are never changed or removed.
 const encoded=JSON.stringify(state);store.setItem(LOCAL_KEY,encoded);
 if(store.getItem(LOCAL_KEY)!==encoded)throw Error('Your device could not save progress. Please free some space and try again.');
 return JSON.stringify({...current.copies,[LOCAL_KEY]:encoded});
}
export function recoveryFile(store:Store){
 const save=readLocal(store);return JSON.stringify({format:'silicon-hustle-local-copy-v1',snapshots:save.copies,originals:store.getItem(RECOVERY_KEY)},null,2);
}
