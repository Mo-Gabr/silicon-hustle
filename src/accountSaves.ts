import {savedPersonalBest,rememberPersonalBest,snapshotBest} from './personalBest';
import {LOCAL_KEY,GAME_KEYS,RECOVERY_KEY,decodeLocal,readLocal} from './localSaves';
import {CHOICE_KEY} from './localSaveChoice';

export const ACCOUNT_PREFIX='silicon-hustle-account-v1:';
export const GUEST_ID='guest';

export function accountId(userId:string|null|undefined){
 return userId?`user:${userId}`:GUEST_ID;
}

export function accountKey(id:string,key:string){
 return `${ACCOUNT_PREFIX}${encodeURIComponent(id)}:${key}`;
}

/** Each account transition invalidates old callbacks, including A → B → A. */
export function accountAuthority(){
 let selected:string|null=null;
 let token=()=>false;
 return {select(id:string|null){
  if(selected!==id){selected=id;const guard=()=>selected===id&&token===guard&&id!==null;token=guard;}
  return token;
 }};
}

/** Adapt the existing local save engine without changing its validation. */
export function accountStore(storage:Pick<Storage,'getItem'|'setItem'>,id:string,isActive:()=>boolean=()=>true){
 const scoped={getItem:(key:string)=>storage.getItem(accountKey(id,key)),setItem:(key:string,value:string)=>storage.setItem(accountKey(id,key),value)};
 return {
  getItem(key:string){
   return storage.getItem(accountKey(id,key));
  },
  setItem(key:string,value:string){
   if(!isActive())throw Error('Your account changed. Reopen the game before saving.');
   if(key!==LOCAL_KEY){scoped.setItem(key,value);return;}
   const current=readLocal(scoped);
   let next:Record<string,unknown>|null=null;try{next=decodeLocal(JSON.parse(value));}catch{}
   // Preserve a confirmed outgoing best before a reset, recovery choice or sign-out replaces it.
   const replacing=current.state&&next&&(current.state.seed!==next.seed||Number(next.month)<Number(current.state.month));
   try{rememberPersonalBest(scoped,savedPersonalBest(scoped));}catch(error){if(replacing)throw error;}
   scoped.setItem(key,value);
   if(scoped.getItem(key)!==value)throw Error('Your device could not save progress.');
   // An interrupted metadata write is recoverable from the committed snapshot on restart.
   try{rememberPersonalBest(scoped,snapshotBest(next));}catch{/* Never block ordinary gameplay saves. */}

  }
 };
}

export function accountSaveKeys(id:string){
 return [...GAME_KEYS,RECOVERY_KEY,CHOICE_KEY].map(key=>accountKey(id,key));
}

/** Legacy saves remain untouched until a player explicitly claims them. */
export function hasLegacySave(storage:Pick<Storage,'getItem'>){
 return GAME_KEYS.some(key=>storage.getItem(key)!==null);
}

export const LEGACY_DECISION_KEY='silicon-hustle-legacy-assignment-v1';

/** Copy a legacy game only after the player explicitly chooses its destination. */
export function claimLegacySave(
 storage:Pick<Storage,'getItem'|'setItem'>,
 destinationId:string
){
 if(storage.getItem(LEGACY_DECISION_KEY)!==null){
  throw new Error('The existing game has already been assigned.');
 }
 const destination=accountStore(storage,destinationId);
 const pendingKey=accountKey(destinationId,'legacy-migration-pending');
 const pending=storage.getItem(pendingKey);
 if(pending===null&&(
  GAME_KEYS.some(key=>destination.getItem(key)!==null)
  ||destination.getItem(RECOVERY_KEY)!==null
  ||destination.getItem(CHOICE_KEY)!==null
  ||storage.getItem(pendingKey)!==null
 )){
  throw new Error('This account already contains saved game or recovery data. Nothing was overwritten.');
 }

 const originals=GAME_KEYS.map(key=>({key,raw:storage.getItem(key)}));
 if(!originals.some(item=>item.raw!==null)){
  throw new Error('No existing game was found.');
 }
 // Never activate a legacy save that the game cannot decode.
 const active=originals.find(item=>item.raw!==null);
 try{
  if(!active||!decodeLocal(JSON.parse(active.raw!))){
   throw new Error('invalid');
  }
 }catch{
  throw new Error('The existing game cannot be opened. Its original data was preserved.');
 }

 // Preserve every original save before marking the migration complete.
 const preserved=originals.filter((item):item is {key:string,raw:string}=>item.raw!==null);
 const legacyArchive=storage.getItem(RECOVERY_KEY);
 if(legacyArchive!==null){
  let entries:unknown;try{entries=JSON.parse(legacyArchive);}catch{throw Error('The existing recovery copy needs attention. Nothing was overwritten.');}
  if(!Array.isArray(entries)||!entries.every(item=>item&&typeof item.key==='string'&&typeof item.raw==='string'))throw Error('The existing recovery copy needs attention. Nothing was overwritten.');
  for(const entry of entries)if(!preserved.some(item=>item.key===entry.key&&item.raw===entry.raw))preserved.push(entry);
 }
 const archive=JSON.stringify(preserved);
 // On retry, only accept data that matches the original migration.
 if(pending!==null){
  if(pending!==archive){
   throw new Error('The original saves changed during migration. Nothing was overwritten.');
  }
  for(const {key,raw} of originals){
   const existing=destination.getItem(key);
   if(existing!==null&&existing!==raw){
    throw new Error('An account save changed during migration. Nothing was overwritten.');
   }
  }
  const existingArchive=destination.getItem(RECOVERY_KEY);
  if(existingArchive!==null&&existingArchive!==archive){
   throw new Error('The migration backup changed. Nothing was overwritten.');
  }
 }
 // Record an incomplete migration before copying any game data.
 // A retry can safely finish copying the same original saves.
 if(pending!==null&&pending!==archive){
  throw new Error('A different migration is pending. Existing data was preserved.');
 }
 storage.setItem(pendingKey,archive);
 if(storage.getItem(pendingKey)!==archive){
  throw new Error('Could not record migration progress.');
 }
 destination.setItem(RECOVERY_KEY,archive);
 if(destination.getItem(RECOVERY_KEY)!==archive){
  throw new Error('Could not verify the backup. Nothing was assigned.');
 }

 for(const {key,raw} of originals){
  if(raw!==null){
   destination.setItem(key,raw);
   if(destination.getItem(key)!==raw){
    throw new Error('Could not verify the copied game.');
   }
  }
 }

 storage.setItem(LEGACY_DECISION_KEY,destinationId);
 if(storage.getItem(LEGACY_DECISION_KEY)!==destinationId){
  throw new Error('Could not record the migration choice.');
 }
}

/**
 * Prepare a fresh Guest game before an authenticated user signs out.
 * Preserve the previous Guest game using the existing recovery mechanism.
 * The caller must not sign out if this operation fails.
 */
export function prepareGuestSignOut(
 storage:Pick<Storage,'getItem'|'setItem'>,
 freshGame:unknown
){
 if(!decodeLocal(freshGame)){
  throw new Error('The new Guest game is invalid. Existing progress was preserved.');
 }
 const guest=accountStore(storage,GUEST_ID);
 const current=readLocal(guest);

 if(current.kind==='blocked'){
  throw new Error('Guest progress needs recovery before sign-out. Nothing was overwritten.');
 }

 return {guest,stamp:current.stamp,freshGame};
}
