import React,{useEffect,useRef,useState} from 'react';
import {accountId,claimLegacySave} from './accountSaves';

export default function LegacySaveChoice({
 userId,done
}:{
 userId:string|null;
 done:()=>void;
}){
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const first=useRef<HTMLButtonElement>(null);
 const locked=useRef(false);

 useEffect(()=>{first.current?.focus();},[]);

 function assign(destination:string){
  if(locked.current)return;
  locked.current=true;
  setBusy(true);
  try{
   claimLegacySave(localStorage,destination);
   done();
  }catch(cause){
   setError(cause instanceof Error?cause.message:'Could not copy the existing game.');
   locked.current=false;
   setBusy(false);
  }
 }

 return <div className="sh-gate">
  <section className="sh-dialog" role="dialog" aria-modal="true"
   aria-label="Assign existing game">
   <h2>WE FOUND YOUR EXISTING GAME</h2>
   <p>
    Silicon Hustle now keeps separate games for each account.
    Choose where your existing game belongs.
   </p>
   <p>Your original save will remain on this device.</p>

   {userId&&<button ref={first} className="sh-primary"
    disabled={busy} onClick={()=>assign(accountId(userId))}>
    KEEP WITH THIS ACCOUNT
   </button>}

   <button ref={userId?undefined:first} className="sh-google"
    disabled={busy} onClick={()=>assign(accountId(null))}>
    KEEP WITH GUEST
   </button>

   <button className="sh-link" disabled={busy} onClick={done}>
    NOT NOW · LEAVE EXISTING SAVE UNCHANGED
   </button>

   {error&&<p role="alert">{error}</p>}
  </section>
 </div>;
}
