// Local progress is durable before any network request. A baseline records the
// last common ancestor, so offline edits are never mistaken for cloud progress.
export const SAVE_KEY='silicon-hustle-v04';
export const LEGACY_SAVE_KEY='compute-empire-v04';
export const META_KEY='silicon-hustle-sync-v1';
export const BACKUP_KEY='silicon-hustle-recovery-v1';
export type CloudSave={user_id:string;game_state:unknown;updated_at:string};
export type SaveConflict={cloud:CloudSave|null;local:string|null;otherAccount:boolean};
export type SyncStatus='Checking cloud'|'Cloud synced'|'Cloud loaded'|'Saved on device'|'Sync pending'|'Sync failed'|'Choose save';
export interface CloudStore{
 read(userId:string):Promise<CloudSave|null>;
 // Return null if the row no longer matches, including concurrent first insert.
 write(userId:string,snapshot:unknown,expected:string|null):Promise<CloudSave|null>;
}
export interface SaveEnvironment{
 storage:Pick<Storage,'getItem'|'setItem'>;
 reload():void;
 status(value:SyncStatus):void;
 conflict(value:SaveConflict|null):void;
 error(message:string):void;
}
type Metadata={owner:string;base:string|null;pending?:string};
const assetIds=['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'];
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function validSave(v:unknown):v is Record<string,unknown>{
 if(!record(v)||!finite(v.month)||!Number.isInteger(v.month)||v.month<1||v.month>30||!finite(v.cash)||!finite(v.seed)||!finite(v.labs)||!Number.isInteger(v.labs)||v.labs<0||v.labs>8||typeof v.ended!=='boolean'||typeof v.ending!=='string'||typeof v.headline!=='string'||!Array.isArray(v.history)||!v.history.every(x=>typeof x==='string')||!record(v.prices)||!record(v.positions))return false;
 if(!assetIds.every(id=>finite((v.prices as Record<string,unknown>)[id])&&Number((v.prices as Record<string,unknown>)[id])>0))return false;
 if(!Object.entries(v.positions).every(([id,p])=>assetIds.includes(id)&&record(p)&&finite(p.qty)&&Number.isInteger(p.qty)&&p.qty>=0&&finite(p.cost)&&p.cost>=0))return false;
 if(v.reports!==undefined&&(!Array.isArray(v.reports)||!v.reports.every(r=>record(r)&&typeof r.headline==='string'&&['month','year','cash','portfolio','valuation','labRevenue','labExpenses','labProfit','realized','ytdRealized','ytdLabProfit','ytdValuationChange','valuationChange','portfolioChange'].every(k=>finite(r[k])))))return false;
 if(v.threat!=null&&(!record(v.threat)||!finite(v.threat.month)||!['activist','takeover','vote'].includes(String(v.threat.kind))||typeof v.threat.title!=='string'||typeof v.threat.story!=='string'))return false;
 if(v.crisisResult!=null&&(!record(v.crisisResult)||typeof v.crisisResult.title!=='string'||typeof v.crisisResult.choice!=='string'||typeof v.crisisResult.success!=='boolean'||typeof v.crisisResult.summary!=='string'||!['month','cost','extraLoss','cashBefore','cashAfter','valuationBefore','valuationAfter'].every(k=>finite((v.crisisResult as Record<string,unknown>)[k]))))return false;
 if(v.threatHistory!==undefined&&(!Array.isArray(v.threatHistory)||!v.threatHistory.every(x=>typeof x==='string')))return false;
 if(v.realized!==undefined&&(!record(v.realized)||!Object.values(v.realized).every(finite)))return false;
 return v.endingChoice===undefined||typeof v.endingChoice==='string';
}
function ordered(v:unknown):unknown{
 if(Array.isArray(v))return v.map(ordered);
 if(record(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));
 return v;
}
export function canonical(raw:string):string{return JSON.stringify(ordered(JSON.parse(raw)));}
function same(a:string|null,b:string|null){
 if(a===b)return true;
 try{return a!==null&&b!==null&&canonical(a)===canonical(b);}catch{return false;}
}
export function localSave(storage:SaveEnvironment['storage']):string|null{return storage.getItem(SAVE_KEY)??storage.getItem(LEGACY_SAVE_KEY);}
export function backup(storage:SaveEnvironment['storage'],snapshot:string|null,source:string){
 if(snapshot===null)return;
 const raw=storage.getItem(BACKUP_KEY);
 const previous=raw?JSON.parse(raw):[];
 if(!Array.isArray(previous))throw new Error('Recovery history is unreadable. Export device storage before continuing.');
 // Keep the most recent eight replacements, including the discarded cloud branch.
 storage.setItem(BACKUP_KEY,JSON.stringify([{at:new Date().toISOString(),source,snapshot},...previous].slice(0,8)));
}
export class SaveChangedError extends Error{constructor(){super('Saved progress changed in another tab or from cloud sync. The latest save was kept. Please retry your action.');}}
export function persistLocal(storage:SaveEnvironment['storage'],state:unknown,expected?:unknown){
 if(!validSave(state))throw new Error('The game save is invalid. Previous progress was kept.');
 const before=localSave(storage);
 if(before!==null){
  let valid=false;try{valid=validSave(JSON.parse(before));}catch{/* preserve unreadable saves too */}
  if(valid&&expected!==undefined&&!same(before,JSON.stringify(expected)))throw new SaveChangedError();
  if(!valid)backup(storage,before,'unreadable-device-save');
 }
 storage.setItem(SAVE_KEY,JSON.stringify(state));
}
export function saveSummary(raw:string|null):string{
 if(!raw)return 'No saved game';
 try{const s=JSON.parse(raw);if(validSave(s))return `Month ${s.month} · $${Math.round(Number(s.cash)).toLocaleString('en-US')} cash · Lab ${s.labs}`;}catch{/* keep raw data for recovery */}
 return 'Unreadable save (kept on this device)';
}
export class SaveSync{
 private stopped=false;
 private running:Promise<void>|null=null;
 private pending=false;
 private choosing=false;
 private currentConflict:SaveConflict|null=null;
 constructor(readonly userId:string,private cloud:CloudStore,private env:SaveEnvironment){}
 stop(){this.stopped=true;this.pending=false;}
 private metadata():Metadata|null{
  const raw=this.env.storage.getItem(META_KEY);
  if(!raw)return null;
  const m=JSON.parse(raw);
  if(!record(m)||typeof m.owner!=='string'||!(m.base===null||typeof m.base==='string')||(m.pending!==undefined&&typeof m.pending!=='string'))throw new Error('Sync history is unreadable. Local progress has been kept.');
  return m as Metadata;
 }
 private acknowledge(snapshot:string){
  const value=JSON.stringify({owner:this.userId,base:snapshot});
  if(this.env.storage.getItem(META_KEY)!==value)this.env.storage.setItem(META_KEY,value);
 }
 private setConflict(cloud:CloudSave|null,local:string|null){
  const meta=this.metadata();
  this.currentConflict={cloud,local,otherAccount:!!meta&&meta.owner!==this.userId};
  this.env.conflict(this.currentConflict);this.env.status('Choose save');
 }
 private checkCloud(row:CloudSave|null){
  if(row&&(row.user_id!==this.userId||!validSave(row.game_state)||!Number.isFinite(Date.parse(row.updated_at))))throw new Error('Cloud save could not be validated. Device progress has been kept.');
 }
 private replaceLocal(snapshot:string){
  backup(this.env.storage,localSave(this.env.storage),'device-before-cloud-load');
  this.env.storage.setItem(SAVE_KEY,snapshot);
  this.acknowledge(snapshot);
  this.env.reload();this.env.status('Cloud loaded');
 }
 request():Promise<void>{
  if(this.stopped)return Promise.resolve();
  this.pending=true;
  if(!this.running){
   this.running=this.drain().finally(()=>{this.running=null;if(this.pending&&!this.stopped)void this.request();});
  }
  return this.running;
 }
 private async drain(){
  let attempts=0;
  while(this.pending&&!this.stopped){
   if(++attempts>8){
    this.pending=false;this.env.status('Sync pending');this.env.error('Cloud saves are busy or updates are unavailable. Device progress is safe; sync will retry.');break;
   }
   this.pending=false;
   try{await this.reconcile();}catch(error){
    if(!this.stopped){this.env.status('Sync failed');this.env.error((error instanceof Error?error.message:'Cloud save unavailable.')+' Progress remains saved on this device. Retry when connected.');}
    // A periodic/online/resume retry will reread cloud before attempting a write.
    this.pending=false;
   }
  }
 }
 private async reconcile(){
  if(this.currentConflict)return;
  this.env.status('Checking cloud');
  const row=await this.cloud.read(this.userId);
  if(this.stopped)return;
  this.checkCloud(row);
  // Read local AFTER the network wait, including actions taken during sign-in.
  const local=localSave(this.env.storage);
  if(local!==null){
   let valid=false;try{valid=validSave(JSON.parse(local));}catch{/* offer valid cloud recovery */}
   if(!valid){if(row){this.setConflict(row,local);return;}throw new Error('Device save could not be validated; no save was overwritten.');}
  }
  const remote=row?JSON.stringify(row.game_state):null;
  const meta=this.metadata();
  if(local!==null&&remote!==null&&same(local,remote)){
   this.acknowledge(local);this.env.status('Cloud synced');this.env.error('');return;
  }
  if(local===null){
   if(remote!==null)this.replaceLocal(remote);else this.env.status('Saved on device');
   return;
  }
  // A request may have committed before its response was lost or iOS stopped us.
  // Its durable intent proves the common ancestor even if more actions followed.
  let ownBase=meta?.owner===this.userId?meta.base:null;
  if(meta?.owner===this.userId&&meta.pending&&same(remote,meta.pending)){
   ownBase=meta.pending;this.acknowledge(ownBase);
  }
  if(meta&&meta.owner!==this.userId){this.setConflict(row,local);return;}
  if(remote===null){
   if(ownBase!==null){this.setConflict(null,local);return;}
   await this.upload(local,null);return;
  }
  if(ownBase===null){this.setConflict(row,local);return;}
  if(same(local,ownBase)){this.replaceLocal(remote);return;}
  if(same(remote,ownBase)){await this.upload(local,row!.updated_at);return;}
  this.setConflict(row,local);
 }
 private rememberAttempt(snapshot:string){
  const meta=this.metadata();
  this.env.storage.setItem(META_KEY,JSON.stringify({owner:this.userId,base:meta?.owner===this.userId?meta.base:null,pending:snapshot}));
 }
 private async upload(snapshot:string,expected:string|null){
  this.rememberAttempt(snapshot);
  const result=await this.cloud.write(this.userId,JSON.parse(snapshot),expected);
  if(this.stopped)return;
  if(!result){this.pending=true;return;}
  this.checkCloud(result);
  if(!same(JSON.stringify(result.game_state),snapshot))throw new Error('Cloud returned a different save; sync paused.');
  // The acknowledged snapshot is the exact request, never a later local action.
  this.acknowledge(snapshot);this.env.status('Cloud synced');this.env.error('');
  if(!same(localSave(this.env.storage),snapshot)){this.env.status('Sync pending');this.pending=true;}
 }
 async choose(useCloud:boolean):Promise<void>{
  if(this.stopped||!this.currentConflict||this.choosing)return;
  this.choosing=true;
  try{await this.resolveChoice(useCloud);}finally{this.choosing=false;}
 }
 private async resolveChoice(useCloud:boolean){
  // Conflict resolution runs on the same queue as automatic writes.
  await this.running;
  if(this.stopped||!this.currentConflict)return;
  const shown=this.currentConflict;
  try{
   const latest=await this.cloud.read(this.userId);
   if(this.stopped)return;
   this.checkCloud(latest);
   const local=localSave(this.env.storage);
   if(latest?.updated_at!==shown.cloud?.updated_at||!same(local,shown.local)){
    this.setConflict(latest,local);this.env.error('Progress changed while you were choosing. Review both versions again.');return;
   }
   if(useCloud){
    if(!latest)throw new Error('No cloud save is available. Choose device progress to upload it.');
    this.replaceLocal(JSON.stringify(latest.game_state));
   }else{
    if(!local||!validSave(JSON.parse(local)))throw new Error('Device save is unreadable. No progress was replaced.');
    backup(this.env.storage,latest?JSON.stringify(latest.game_state):null,'cloud-before-device-choice');
    this.rememberAttempt(local);
    const result=await this.cloud.write(this.userId,JSON.parse(local),latest?.updated_at??null);
    if(this.stopped)return;
    if(!result){
     const changed=await this.cloud.read(this.userId);
     if(this.stopped)return;
     this.checkCloud(changed);this.setConflict(changed,localSave(this.env.storage));this.env.error('Cloud progress changed again. Review the updated versions.');return;
    }
    this.checkCloud(result);
    if(!same(JSON.stringify(result.game_state),local))throw new Error('Cloud returned a different save; sync paused.');
    this.acknowledge(local);this.env.status('Cloud synced');
   }
   this.currentConflict=null;this.env.conflict(null);this.env.error('');
   await this.request();
  }catch(error){if(!this.stopped){this.env.status('Choose save');this.env.error((error instanceof Error?error.message:'Could not resolve saves.')+' Your choice has not been completed.');}}
 }
}
