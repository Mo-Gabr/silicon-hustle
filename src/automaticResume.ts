/** Local-only bookkeeping. Game snapshots and the cloud schema stay unchanged. */
export const DEVICE_KEY='silicon-hustle-v04';
export const LEGACY_KEY='compute-empire-v04';
export const HISTORY_PREFIX='silicon-hustle-resume-v1:';
const BINDING_KEY=HISTORY_PREFIX+'active';
export const DEVICE_RECOVERY_KEY=HISTORY_PREFIX+'device-recovery';
export type Store=Pick<Storage,'getItem'|'setItem'>;
export type CloudSave={user_id:string;game_state:unknown;updated_at:string};
export type ResumeApi={identity():Promise<{id:string;is_anonymous?:boolean}|null>;read():Promise<CloudSave|null>;write(expected:CloudSave|null,snapshot:unknown):Promise<CloudSave|null>};
/** AbortController also works in older supported iOS WebViews without AbortSignal.timeout. */
export async function withSaveTimeout<T>(request:(signal:AbortSignal)=>Promise<T>,milliseconds=12000):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),milliseconds);
 try{return await request(controller.signal);}finally{clearTimeout(timer);}
}
export type ResumeView={status:string;notice:string;choice:boolean;device:string|null;cloud:CloudSave|null;checking:boolean};
type History={version:1;account:string;base:CloudSave|null;head:string|null;pending:boolean;divergent:boolean;recovery:string[];lastWrite:{before:CloudSave|null;after:string}|null};
const assets=['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'];
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export type SaveInspection={state:Record<string,unknown>|null;issue:string;reason:string};
/** Financial/progression fields are required; missing presentation fields have safe defaults.
 * Inspect without mutating the stored snapshot or discarding unknown metadata. */
export function inspectSave(x:unknown):SaveInspection{
 const fail=(issue:string,reason:string):SaveInspection=>({state:null,issue,reason});
 if(!object(x))return fail('format','This save uses a format this version cannot open.');
 if(x.gamble!=null||finite(x.month)&&x.month>30)return fail('game-version','This save needs the matching game version, including any extended run.');
 for(const key of ['month','cash','seed','labs'])if(!finite(x[key]))return fail(key,`This save needs a compatible ${key} field. The original is kept.`);
 if(!Number.isInteger(x.month)||Number(x.month)<1||Number(x.month)>30)return fail('month','This save has an unsupported month. The original is kept.');
 if(!Number.isInteger(x.labs)||Number(x.labs)<0||Number(x.labs)>8)return fail('labs','This save has an unsupported lab level. The original is kept.');
 if(typeof x.ended!=='boolean')return fail('ended','This save’s completion status cannot be established safely.');
 if(!object(x.prices)||!assets.every(key=>finite((x.prices as Record<string,unknown>)[key])&&Number((x.prices as Record<string,unknown>)[key])>0))return fail('prices','This save’s hardware prices cannot be read safely.');
 if(!object(x.positions)||!Object.entries(x.positions).every(([key,p])=>assets.includes(key)&&object(p)&&Number.isInteger(p.qty)&&Number(p.qty)>=0&&(p.cost===undefined||finite(p.cost)&&p.cost>=0)))return fail('positions','This save’s holdings cannot be read safely.');
 if(x.history!=null&&(!Array.isArray(x.history)||!x.history.every(h=>typeof h==='string')))return fail('history','This save’s history uses an unsupported format.');
 for(const key of ['headline','ending'])if(x[key]!=null&&typeof x[key]!=='string')return fail(key,`This save’s ${key} uses an unsupported format.`);
 if(x.reports!=null&&(!Array.isArray(x.reports)||!x.reports.every(r=>object(r)&&Number.isInteger(r.month)&&Number(r.month)>=1&&Number(r.month)<=30&&finite(r.valuation))))return fail('reports','This save’s reports use an unsupported format.');
 return {state:{...x,history:x.history??[],headline:x.headline??'',ending:x.ending??'',...(x.reports===null?{reports:[]}: {})},issue:'',reason:''};
}
export const validSave=(x:unknown)=>inspectSave(x).state!==null;
/** Equality, cloud guards and backups always use original, unnormalized data. */
export function parseSave(raw:string|null):unknown|null{try{const x=raw===null?null:JSON.parse(raw);return validSave(x)?x:null;}catch{return null;}}
export function saveFromRaw(raw:string|null):SaveInspection{try{return inspectSave(raw===null?null:JSON.parse(raw));}catch{return {state:null,issue:'json',reason:'This device save cannot be decoded. Its original data is kept.'};}}
function ordered(x:unknown):unknown{return Array.isArray(x)?x.map(ordered):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;}
export const sameSave=(a:unknown,b:unknown)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const sameRaw=(a:string|null,b:string|null)=>{try{return a!==null&&b!==null&&sameSave(JSON.parse(a),JSON.parse(b));}catch{return false;}};
export function deviceRaw(store:Store){return store.getItem(DEVICE_KEY)||store.getItem(LEGACY_KEY);}
/** Called before applying an economic action: a failed device write must not claim success. */
let otherTabChanged=false;
export function pauseDeviceWrites(){otherTabChanged=true;}
export function persistDevice(raw:string){
 if(otherTabChanged){window.dispatchEvent(new CustomEvent('silicon-hustle-save-error',{detail:'changed'}));return false;}
 if(!parseSave(raw)){window.dispatchEvent(new CustomEvent('silicon-hustle-save-error',{detail:'format'}));return false;}
 try{
  const previous=deviceRaw(localStorage);
  if(previous&&!parseSave(previous)){
   const copies=JSON.parse(localStorage.getItem(DEVICE_RECOVERY_KEY)||'[]') as string[];
   if(!Array.isArray(copies)||!copies.every(x=>typeof x==='string'))throw Error('recovery');
   if(!copies.includes(previous)){copies.push(previous);localStorage.setItem(DEVICE_RECOVERY_KEY,JSON.stringify(copies));}
   window.dispatchEvent(new CustomEvent('silicon-hustle-save-error',{detail:'format'}));return false;
  }
  localStorage.setItem(DEVICE_KEY,raw);return true;
 }catch{window.dispatchEvent(new Event('silicon-hustle-save-error'));return false;}
}

function continuous(previous:string,next:string){
 const a=parseSave(previous),b=parseSave(next);if(!object(a)||!object(b))return false;
 // These are vetoes, never evidence for choosing the highest month/value/seed.
 if(a.seed!==b.seed||Number(b.month)<Number(a.month)||a.ended===true&&b.ended!==true)return false;
 for(const key of ['achievements','standardResult','extensionOutcome'])if(a[key]!==undefined&&!sameSave(a[key],b[key]))return false;
 return true;
}
export class ResumeCoordinator{
 view:ResumeView={status:'CHECKING CLOUD SAVE',notice:'',choice:false,device:null,cloud:null,checking:false};
 private stopped=false;private busy=false;private rerun=false;private dismissed=false;
 constructor(readonly account:string,private store:Store,private api:ResumeApi,private changed:(view:ResumeView)=>void,private reload:()=>void){}
 stop(){this.stopped=true;}
 private emit(patch:Partial<ResumeView>){if(this.stopped)return;this.view={...this.view,...patch};this.changed(this.view);}
 private raw(){return deviceRaw(this.store);}
 private history():History{
  const raw=this.store.getItem(HISTORY_PREFIX+this.account);if(!raw)return {version:1,account:this.account,base:null,head:null,pending:false,divergent:true,recovery:[],lastWrite:null};
  const h=JSON.parse(raw) as History;
  if(h.version!==1||h.account!==this.account||!Array.isArray(h.recovery)||!h.recovery.every(x=>typeof x==='string')||(h.head!==null&&typeof h.head!=='string')||typeof h.pending!=='boolean'||typeof h.divergent!=='boolean'||h.base!==null&&(!object(h.base)||h.base.user_id!==this.account||typeof h.base.updated_at!=='string'))throw Error('history');
  return h;
 }
 private save(h:History){this.store.setItem(HISTORY_PREFIX+this.account,JSON.stringify(h));}
 private binding(h:History){try{const b=JSON.parse(this.store.getItem(BINDING_KEY)||'null');return b?.account===this.account&&sameRaw(b.head,h.head);}catch{return false;}}
 private bind(h:History){this.store.setItem(BINDING_KEY,JSON.stringify({account:this.account,head:h.head}));}
 private archive(h:History,...raws:(string|null)[]){for(const raw of raws)if(raw!==null&&!h.recovery.some(x=>sameRaw(x,raw)||x===raw))h.recovery.push(raw);}
 private async identity(){const user=await this.api.identity();if(this.stopped||user?.id!==this.account||user.is_anonymous)throw Error('account');}
 private validCloud(row:CloudSave|null){if(row&&(row.user_id!==this.account||typeof row.updated_at!=='string'))throw Error('account');return row;}
 private failure(){this.emit({status:'DEVICE PLAY · SYNC PAUSED',notice:'Cloud synchronization is paused. Device progress is kept. Reconnect or open Saved Games to review.',checking:false});}
 private storageFailure(){this.emit({status:'DEVICE STORAGE NEEDS ATTENTION',notice:'Could not finish save bookkeeping. Sync is paused. Free storage or export your saves, then retry.',checking:false});}
 /** Records only observed game edits rooted in the acknowledged snapshot. No metadata enters game_state. */
 noteDeviceChange(newRun=false){
  if(this.stopped)return;
  try{const raw=this.raw(),h=this.history();const known=this.binding(h)&&h.head!==null&&raw!==null&&continuous(h.head,raw)&&!newRun&&!h.divergent;
   if(!known)this.archive(h,h.head,raw);h.pending=known;h.divergent=!known;h.head=raw;this.save(h);if(known){this.bind(h);this.emit({status:'DEVICE CHANGES PENDING',notice:''});}
   if(this.busy)this.rerun=true;
  }catch{this.storageFailure();}
 }
 async check(){
  if(this.stopped)return;
  if(this.busy){this.rerun=true;return;}
  this.busy=true;this.rerun=false;this.emit({checking:true});
  try{
   this.emit({device:this.raw()});await this.identity();const row=this.validCloud(await this.api.read());if(this.stopped)return;await this.identity();
   const raw=this.raw(),local=parseSave(raw),cloud=row&&validSave(row.game_state)?row.game_state:null;
   this.emit({device:raw,cloud:row,checking:false,notice:''});
   if(local&&cloud&&sameSave(local,cloud)){this.acknowledge(row!,raw!);return;}
   if(!local&&cloud){if(raw!==null){this.recordConflict(raw,row);this.emit({status:'SAVE REVIEW NEEDED',choice:!this.dismissed});return;}this.loadCloud(row!,raw);return;}
   if(local&&!row){
    const h=this.history();
    if(h.base===null&&h.pending&&!h.divergent&&this.binding(h)&&sameRaw(h.head,raw)){await this.upload(null,raw!);return;}
    this.emit({status:'DEVICE SAVE READY',choice:false,notice:'Playing on this device. Open Saved Games to enable cloud sync for this account.'});return;
   }
   if(local&&cloud){
    const h=this.history();
    if(h.base&&sameSave(h.base.game_state,cloud)&&h.pending&&!h.divergent&&this.binding(h)&&sameRaw(h.head,raw)){await this.upload(row,raw!);return;}
   }
   if(!raw&&!row){this.emit({status:'DEVICE PLAY · NO SAVED GAME',choice:false});return;}
   this.recordConflict(raw,row);this.emit({status:'SAVE REVIEW NEEDED',choice:!this.dismissed});
  }catch{if(!this.stopped)this.failure();}
  finally{this.busy=false;this.emit({checking:false});if(this.rerun&&!this.stopped&&!this.view.choice){this.rerun=false;void this.check();}}
 }
 private recordConflict(raw:string|null,row:CloudSave|null){const h=this.history();this.archive(h,raw,row?JSON.stringify(row.game_state):null);this.save(h);}
 private acknowledge(row:CloudSave,raw:string){
  try{const h=this.history();h.base=row;h.head=raw;h.pending=false;h.divergent=false;this.save(h);this.bind(h);this.emit({status:'CLOUD SAVE SYNCED',choice:false,notice:'',device:raw,cloud:row});}catch{this.storageFailure();}
 }
 private loadCloud(row:CloudSave,expected:string|null){
  try{
   if(this.raw()!==expected){this.emit({choice:true,status:'SAVE REVIEW NEEDED'});return;}
   const h=this.history(),raw=JSON.stringify(row.game_state);this.archive(h,expected,raw);this.save(h);
   // Verify local state again after the recovery write, before replacing it.
   if(this.raw()!==expected){this.emit({choice:true,status:'SAVE REVIEW NEEDED'});return;}
   this.store.setItem(DEVICE_KEY,raw);this.acknowledge(row,raw);this.reload();
  }catch{this.storageFailure();}
 }
 private async upload(expected:CloudSave|null,raw:string){
  const snapshot=parseSave(raw);if(!snapshot){this.emit({choice:true,status:'SAVE REVIEW NEEDED'});return;}
  try{
   const h=this.history();h.lastWrite={before:expected,after:raw};this.save(h); // Durable before/after pair, retained after acknowledgment.
  }catch{this.storageFailure();return;}
  await this.identity();if(this.raw()!==raw){this.rerun=true;return;}
  const result=this.validCloud(await this.api.write(expected,snapshot));if(this.stopped)return;await this.identity();
  if(!result){const latest=this.validCloud(await this.api.read());await this.identity();this.recordConflict(this.raw(),latest);this.emit({cloud:latest,device:this.raw(),status:'SAVE REVIEW NEEDED',choice:!this.dismissed});return;}
  if(!sameSave(result.game_state,snapshot))throw Error('write');
  try{const h=this.history();h.base=result;
   const current=this.raw();
   if(sameRaw(current,raw)){h.head=current;h.pending=false;h.divergent=false;}
   else if(!this.binding(h)||!sameRaw(h.head,current)){h.pending=false;h.divergent=true;}
   this.save(h);this.bind(h);this.emit({status:h.pending?'DEVICE CHANGES PENDING':'CLOUD SAVE SYNCED',choice:false,notice:'',device:current,cloud:result});
   if(h.pending)this.rerun=true;
  }catch{this.storageFailure();}
 }
 async review(){
  if(this.stopped||this.busy)return;this.dismissed=false;this.busy=true;this.emit({checking:true,choice:true,device:this.raw()});
  try{await this.identity();const row=this.validCloud(await this.api.read());await this.identity();if(!this.stopped)this.emit({cloud:row,device:this.raw(),notice:'',status:'SAVED GAMES'});}catch{this.failure();}finally{this.busy=false;this.emit({checking:false});}
 }
 closeReview(){this.dismissed=true;this.emit({choice:false,notice:'Continuing on this device. Cloud synchronization stays paused for unresolved saves.'});}
 async choose(source:'cloud'|'device'){
  if(this.stopped||this.busy)return;
  this.busy=true;this.emit({checking:true});
  try{
   await this.identity();const row=this.validCloud(await this.api.read());if(this.stopped)return;await this.identity();
   const displayed=this.view.cloud;
   if((!!row!==!!displayed)||row&&displayed&&(row.updated_at!==displayed.updated_at||!sameSave(row.game_state,displayed.game_state))){this.emit({cloud:row,device:this.raw(),choice:true,notice:'The cloud save changed. Review the latest version before choosing.'});return;}
   const raw=this.raw();if(raw!==this.view.device){this.emit({device:raw,choice:true,notice:'The device save changed. Review it before choosing.'});return;}const h=this.history();this.archive(h,raw,row?JSON.stringify(row.game_state):null);this.save(h);
   if(source==='cloud'){
    if(!row||!validSave(row.game_state)){this.emit({choice:true,notice:'This cloud save cannot be loaded by this version. Its original data is preserved.'});return;}
    this.loadCloud(row,raw);
   }else{
    if(!parseSave(raw)){this.emit({choice:true,notice:'This device save cannot be opened here. Open Saved Games for recovery.'});return;}
    if(row&&!validSave(row.game_state)){this.emit({choice:true,notice:'The cloud save needs review in its matching version. It has not been replaced.'});return;}
    h.base=row;h.head=raw;h.pending=true;h.divergent=false;this.save(h);this.bind(h);await this.upload(row,raw!);
   }
  }catch{if(!this.stopped)this.failure();}
  finally{this.busy=false;this.emit({checking:false});}
 }
 /** Explicit resets break continuation; a matching seed is not a unique run identity. */
 newGame(){this.noteDeviceChange(true);}
 exportRecovery(){return JSON.stringify({version:1,device:this.raw(),cloud:this.view.cloud,deviceRecovery:this.store.getItem(DEVICE_RECOVERY_KEY),history:this.store.getItem(HISTORY_PREFIX+this.account)},null,2);}
}
