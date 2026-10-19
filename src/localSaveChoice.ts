import {readLocal,decodeLocal,writeLocal,LOCAL_KEY,OLD_KEY,LEGACY_KEY,RECOVERY_KEY} from './localSaves';
export const CHOICE_KEY='silicon-hustle-local-choice-v1';
type Store=Pick<Storage,'getItem'|'setItem'>;
export type SaveChoice={stamp:string;current:Record<string,unknown>;historical:Record<string,unknown>;historicalRaw:string};
/** Resolve only the confirmed migration case: a completed Month42 run hidden by an earlier local game. */
export function pendingSaveChoice(store:Store):SaveChoice|null{
 try{
  if(store.getItem(CHOICE_KEY)==='resolved')return null;
  const saved=readLocal(store),raw=saved.copies[LOCAL_KEY];
  if(saved.kind!=='ready'||!raw||!saved.state||Number(saved.state.month)>=42)return null;
  const candidates=[saved.copies[OLD_KEY],saved.copies[LEGACY_KEY]];
  const archive=store.getItem(RECOVERY_KEY);
  if(archive){const entries=JSON.parse(archive);if(Array.isArray(entries))for(const entry of entries)if(entry&&[LOCAL_KEY,OLD_KEY,LEGACY_KEY].includes(entry.key)&&typeof entry.raw==='string')candidates.push(entry.raw);}
  for(const candidate of candidates){
   if(!candidate)continue;
   let old=null;try{old=decodeLocal(JSON.parse(candidate));}catch{}
   if(old?.month===42)return {stamp:saved.stamp,current:saved.state,historical:old,historicalRaw:candidate};
  }
 }catch{/* Unavailable storage never authorizes replacement. Existing recovery remains available. */}
 return null;
}
export function selectLocalGame(store:Store,choice:SaveChoice,which:'historical'|'current'){
 // Re-read both sources immediately before consent is applied. Do not replace a concurrent change.
 const fresh=pendingSaveChoice(store);
 if(!fresh||fresh.stamp!==choice.stamp||fresh.historicalRaw!==choice.historicalRaw)throw Error('Your saves changed. Reopen the app to choose safely.');
 // This preserves all raw gameplay keys in the existing archive before changing the active key.
 writeLocal(store,which==='historical'?fresh.historical:fresh.current,fresh.stamp,{fresh:true});
 store.setItem(CHOICE_KEY,'resolved');
 if(store.getItem(CHOICE_KEY)!=='resolved')throw Error('Your game is saved, but this device could not remember your choice. Free some space before reopening.');
}
