export const BENCHMARK = 74_610_431_012.27;
export const GAME_VERSION = '0.9.0';
export const MAX_SCORE = 1_000_000_000_000;
export const BOARD_COOLDOWN_MS = 10_000;
export const BOARD_CACHE_PREFIX = 'silicon-hustle-board-v1:';
export type BoardEntry = {public_id:string;display_name:string;best_valuation:number;game_version:string;achieved_at:string;position:number;verification:'unverified'};
export type BoardPage = {entries:BoardEntry[];self:BoardEntry|null;total:number};
export type BoardView = BoardPage & {peak:number;status:'loading'|'ready'|'unavailable'|'error';error:string;loadedAt:string|null;writing:boolean};
export type Peak = {valuation:number;game_version:string};
export type BoardStorage = Pick<Storage,'getItem'|'setItem'>;
export type BoardApi = {read(limit:number,offset:number):Promise<unknown>;submit(valuation:number,version:string,name:string|undefined,expectedUserId:string):Promise<unknown>};
const reserved = new Set(['mogabr','admin','system','moderator']);
export function founderName(value:string):string {
 const name=value.trim().replace(/ +/g,' ');
 if(!/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,23}$/.test(name))throw new Error('Use 3–24 letters, numbers, spaces, dots, hyphens or underscores. No email addresses.');
 if(reserved.has(name.toLowerCase().replace(/[^a-z0-9]/g,'')))throw new Error('That name is reserved. Choose your own founder name.');
 return name;
}
export function scoreValue(value:unknown):number {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>MAX_SCORE)throw new Error('Valuation is outside the supported range.');
 return value;
}
function achievementOrder(a:string,b:string){
 const millis=Date.parse(a)-Date.parse(b);
 if(millis)return millis;
 const micros=(value:string)=>Number((value.match(/\.(\d+)/)?.[1]??'').padEnd(6,'0').slice(3,6));
 return micros(a)-micros(b);
}
export function ranked(entries:Omit<BoardEntry,'position'>[]):BoardEntry[] {
 return [...entries].sort((a,b)=>b.best_valuation-a.best_valuation||achievementOrder(a.achieved_at,b.achieved_at)||(a.public_id<b.public_id?-1:a.public_id>b.public_id?1:0)).map((entry,i)=>({...entry,position:i+1}));
}
export function milestones(valuation:number) {
 return [100_000_000,1_000_000_000,10_000_000_000,BENCHMARK].map(target=>({target,reached:valuation>=target,percent:Math.min(100,Math.max(0,valuation/target*100))}));
}
export function readPeak(storage:BoardStorage,userId:string):Peak {
 const raw=storage.getItem(BOARD_CACHE_PREFIX+userId);
 if(!raw)return {valuation:0,game_version:GAME_VERSION};
 const data=JSON.parse(raw);
 scoreValue(data.valuation);
 if(typeof data.game_version!=='string')throw new Error('Device leaderboard history could not be read.');
 return data;
}
export function rememberPeak(storage:BoardStorage,userId:string,value:number,version=GAME_VERSION):Peak {
 scoreValue(value);
 const previous=readPeak(storage,userId);
 if(value<=previous.valuation)return previous;
 const next={valuation:value,game_version:version};
 storage.setItem(BOARD_CACHE_PREFIX+userId,JSON.stringify(next));
 return next;
}
function entry(value:unknown):BoardEntry {
 const e=value as BoardEntry;
 if(!e||typeof e.public_id!=='string'||typeof e.display_name!=='string'||founderName(e.display_name)!==e.display_name||typeof e.game_version!=='string'||!Number.isFinite(Date.parse(e.achieved_at))||!Number.isSafeInteger(e.position)||e.position<1||e.verification!=='unverified')throw new Error('Leaderboard returned an invalid entry.');
 scoreValue(e.best_valuation);
 // Pick public fields explicitly: never render an arbitrary user/email payload.
 return {public_id:e.public_id,display_name:e.display_name,best_valuation:e.best_valuation,game_version:e.game_version,achieved_at:e.achieved_at,position:e.position,verification:'unverified'};
}
export function boardPage(value:unknown):BoardPage {
 const data=value as BoardPage;
 if(!data||!Array.isArray(data.entries)||data.entries.length>50||!Number.isSafeInteger(data.total)||data.total<0)throw new Error('Leaderboard response could not be read.');
 return {entries:data.entries.map(entry),self:data.self?entry(data.self):null,total:data.total};
}
// Keep observed peaks for the same game while its account/save ownership is
// being resolved. A different game's seed cannot borrow the prior game's peak.
export class ObservedGamePeaks {
 private values=new Map<number,number>();
 record(seed:number,value:number){
  const peak=Math.max(this.values.get(seed)??0,scoreValue(value));
  this.values.set(seed,peak);
  if(this.values.size>32)this.values.delete(this.values.keys().next().value!);
  return peak;
 }
 value(seed:number){return this.values.get(seed)??0;}
}
export class BoardController {
 view:BoardView={entries:[],self:null,total:0,peak:0,status:'loading',error:'',loadedAt:null,writing:false};
 offset=0;
 private active=true;
 private reading=false;
 private mutation=0;
 private writing=false;
 private lastAttempt=-Infinity;
 constructor(readonly userId:string|null,private api:BoardApi,private storage:BoardStorage,private changed:(view:BoardView)=>void,private clock=()=>Date.now()){
  if(userId){try{this.view.peak=readPeak(storage,userId).valuation;}catch{this.view.error='Device leaderboard history could not be read; server best is kept.';}}
 }
 stop(){this.active=false;}
 private emit(patch:Partial<BoardView>){if(!this.active)return;this.view={...this.view,...patch};this.changed(this.view);}
 observe(value:number){
  if(!this.active||!this.userId)return;
  try{const next=rememberPeak(this.storage,this.userId,value);if(next.valuation>this.view.peak)this.emit({peak:next.valuation});}catch(error){this.emit({error:error instanceof Error?error.message:'Could not preserve device peak.'});}
 }
 private failure(error:unknown){
  const data=error as {code?:string;message?:string};
  const unavailable=['PGRST202','42P01','42883'].includes(data?.code??'');
  this.emit({status:unavailable?'unavailable':'error',error:unavailable?'Global scores are not enabled for this Supabase project yet. Your game and device peak are unchanged.':data?.message||'Leaderboard unavailable. Your game and best score are kept; retry when connected.'});
 }
 async refresh(offset=this.offset){
  if(!this.active||this.reading)return;
  const mutation=this.mutation;
  this.reading=true;this.offset=Math.max(0,offset);
  try{
   const data=boardPage(await this.api.read(50,this.offset));
   if(!this.active||mutation!==this.mutation)return;
   if(data.self&&this.userId)this.observe(data.self.best_valuation);
   this.emit({...data,status:'ready',error:'',loadedAt:new Date(this.clock()).toISOString()});
  }catch(error){if(this.active)this.failure(error);}finally{this.reading=false;}
 }
 async publish(name?:string):Promise<boolean>{
  if(!this.active||!this.userId)return false;
  if(this.writing)return false;
  if(name===undefined&&!this.view.self)return false; // Publishing is opt-in.
  let selected:string|undefined;
  try{selected=name===undefined?undefined:founderName(name);}catch(error){this.emit({error:(error as Error).message});return false;}
  if(this.clock()-this.lastAttempt<BOARD_COOLDOWN_MS){if(name!==undefined)this.emit({error:'Please wait 10 seconds between leaderboard updates.'});return false;}
  let peak:Peak;
  try{peak=readPeak(this.storage,this.userId);if(this.view.peak>peak.valuation)peak={valuation:this.view.peak,game_version:GAME_VERSION};}catch{this.emit({error:'Could not read your device peak. No leaderboard update was sent.'});return false;}
  if(peak.valuation===0){this.emit({error:'Play a saved game on this account before joining the board.'});return false;}
  if(selected===undefined&&this.view.self&&peak.valuation<=this.view.self.best_valuation)return false;
  this.writing=true;this.lastAttempt=this.clock();this.emit({writing:true,error:''});
  try{
   const result=await this.api.submit(peak.valuation,peak.game_version,selected,this.userId);
   if(!this.active)return false;
   const own=entry(result);
   this.mutation++;
   this.observe(own.best_valuation);
   this.emit({self:own,status:'ready',error:''});
   await this.refresh();
   return true;
  }catch(error){if(this.active)this.failure(error);return false;}
  finally{this.writing=false;this.emit({writing:false});}
 }
}
