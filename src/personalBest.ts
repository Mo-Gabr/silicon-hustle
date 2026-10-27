import {decodeLocal,GAME_KEYS,RECOVERY_KEY} from './localSaves';
import {personalBestValue,premium} from './foundersGamble';

type Store=Pick<Storage,'getItem'|'setItem'>;
export const PERSONAL_BEST_KEY='silicon-hustle-personal-best-v1';
const valid=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=1e12;
/** Display-only valuation, matching the playable game's existing fee-free company valuation. */
export function snapshotBest(raw:unknown):number|null{
 const s=decodeLocal(raw);if(!s)return null;
 const positions=s.positions as Record<string,{qty:number}>;
 const prices=s.prices as Record<string,number>;
 const holdings=Object.entries(positions).reduce((sum,[key,p])=>sum+p.qty*prices[key],0);
 const labs=Number(s.labs);
 const current=Math.max(0,20_000_000+Number(s.cash)+holdings+labs*420000*12*3.25+labs*270000*12*.3)+premium(s as Parameters<typeof premium>[0]);
 // A failed settlement must not mint a peak from its terminal valuation.
 if(Number(s.cash)<0||['fraud','bankrupt'].includes(String(s.endingChoice))){
  const reports=((s.reports||[]) as {month:number;valuation:number}[]).filter(r=>r.month<Number(s.month));
  const g=s.gamble as Record<string,unknown>|undefined;
  return personalBestValue({...s,reports,...(g?{gamble:{...g,extensionOutcome:undefined}}:{})},0);
 }
 const g=s.gamble as {extensionOutcome?:{month:number;reason:string}}|undefined;
 // Exiting immediately after Double Down still retains the qualified Month30 record.
 if(s.month===30&&g?.extensionOutcome?.month===30&&g.extensionOutcome.reason==='early')return personalBestValue({...s,gamble:{...g,extensionOutcome:undefined}},current);
 return personalBestValue(s,current);
}
function parse(raw:string|null){try{return raw===null?null:JSON.parse(raw);}catch{return null;}}
/** Read only the caller's scoped snapshots and archives. Never claim shared legacy data. */
export function savedPersonalBest(store:Store):number|null{
 const values:number[]=[];
 try{
  const recorded=parse(store.getItem(PERSONAL_BEST_KEY));if(valid(recorded))values.push(recorded);
  const snapshots=GAME_KEYS.map(key=>store.getItem(key));
  const archive=parse(store.getItem(RECOVERY_KEY));
  if(Array.isArray(archive))for(const item of archive)if(item&&GAME_KEYS.includes(item.key)&&typeof item.raw==='string')snapshots.push(item.raw);
  for(const raw of snapshots){const best=snapshotBest(parse(raw));if(best!==null)values.push(best);}
 }catch{/* Offline gameplay does not depend on optional record storage. */}
 return values.length?Math.max(...values):null;
}
export function rememberPersonalBest(store:Store,value:number|null){
 if(value===null)return;
 if(!valid(value))throw Error('Invalid personal best.');
 const raw=store.getItem(PERSONAL_BEST_KEY),previous=parse(raw);
 if(raw!==null&&!valid(previous))throw Error('Your personal best needs recovery. Its original is preserved.');
 if(valid(previous)&&previous>=value)return;
 const encoded=JSON.stringify(value);store.setItem(PERSONAL_BEST_KEY,encoded);
 if(store.getItem(PERSONAL_BEST_KEY)!==encoded)throw Error('Could not preserve your personal best.');
}
