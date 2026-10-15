import React,{useEffect,useRef,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {SocialLogin, type GoogleLoginResponseOnline} from '@capgo/capacitor-social-login';
import './auth.css';
import {SaveSync, SAVE_KEY, META_KEY, LEGACY_SAVE_KEY, saveSummary, type CloudSave, type CloudStore, type SaveConflict, type SyncStatus} from './saveSync';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const native=Capacitor.isNativePlatform();
const callback='com.siliconhustle.game://auth/callback';
const googleWebClientId='665622953523-ohtb176bfvi3lau36teuunu60lbki0nd.apps.googleusercontent.com';
const googleIOSClientId='665622953523-143uatg5tp21h14sjnvgnbk8imdkifnt.apps.googleusercontent.com';
let nativeGoogleReady:Promise<void>|null=null;
function initializeNativeGoogle(){
 if(!nativeGoogleReady)nativeGoogleReady=SocialLogin.initialize({google:{webClientId:googleWebClientId,iOSClientId:googleIOSClientId,iOSServerClientId:googleWebClientId,mode:'online'}}).catch(error=>{nativeGoogleReady=null;throw error;});
 return nativeGoogleReady;
}
async function googleNonce(){
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 const raw=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 const hashed=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {raw,hashed};
}

export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:!native,flowType:'pkce'}}):null;

async function completeNativeLogin(link:string){
 if(!supabase||!link.startsWith(callback))return false;
 const parsed=new URL(link);
 const params=new URLSearchParams(parsed.search);
 const fragment=new URLSearchParams(parsed.hash.slice(1));
 const error=params.get('error_description')||fragment.get('error_description')||params.get('error')||fragment.get('error');
 if(error)throw new Error(error);
 const code=params.get('code')||fragment.get('code');
 if(code){const {error:authError}=await supabase.auth.exchangeCodeForSession(code);if(authError)throw authError;return true;}
 const access_token=fragment.get('access_token')||params.get('access_token');
 const refresh_token=fragment.get('refresh_token')||params.get('refresh_token');
 if(access_token&&refresh_token){const {error:authError}=await supabase.auth.setSession({access_token,refresh_token});if(authError)throw authError;return true;}
 throw new Error('Login link did not contain a session. Please try signing in again.');
}

const WELCOME_KEY='silicon-hustle-welcome-v09';
const cloudStore:CloudStore={
 async read(userId){
  const {data,error}=await supabase!.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',userId).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
  if(error)throw error;
  return data as CloudSave|null;
 },
 async write(userId,game_state,expected){
  // Existing schemas work too. The migration makes this token server-owned.
  const updated_at=new Date(Math.max(Date.now(),expected?Date.parse(expected)+1:0)).toISOString();
  const table=supabase!.from('game_saves');
  const result=expected
   ?await table.update({game_state,updated_at}).eq('user_id',userId).eq('updated_at',expected).select('user_id,game_state,updated_at').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
   :await table.insert({user_id:userId,game_state,updated_at}).select('user_id,game_state,updated_at').abortSignal(AbortSignal.timeout(12000)).single();
  if(result.error){if(result.error.code==='23505')return null;throw result.error;}
  return result.data as CloudSave|null;
 }
};

export default function AuthGate({children}:{children:React.ReactNode}){
 const [welcome,setWelcome]=useState(()=>localStorage.getItem(WELCOME_KEY)!=='yes');
 const [session,setSession]=useState<Session|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [email,setEmail]=useState('');
 const [showAuth,setShowAuth]=useState(false);
 const [conflict,setConflict]=useState<SaveConflict|null>(null);
 const [ready,setReady]=useState(false);
 const sync=useRef<SaveSync|null>(null);
 const authUser=useRef<string|null>(null);
 const [syncGeneration,setSyncGeneration]=useState(0);
 const [choosing,setChoosing]=useState(false);
 const [saveStatus,setSaveStatus]=useState<SyncStatus>('Saved on device');
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  let active=true,authEventSeen=false;
  const acceptSession=(next:Session|null)=>{
   if(!active)return;
   if(authUser.current!== (next?.user.id??null)){
    setNotice('');
    sync.current?.stop();sync.current=null;authUser.current=next?.user.id??null;
   }
   setSession(next);setReady(true);
  };
  supabase.auth.getSession().then(({data,error})=>{if(!active||authEventSeen)return;if(error)setNotice(error.message);acceptSession(data.session);}).catch(error=>{if(active&&!authEventSeen){setNotice(String(error));setReady(true);}});
  // Keep this callback synchronous; network work happens in the effect below.
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{authEventSeen=true;acceptSession(next);});
  let listener: { remove: () => Promise<void> } | undefined;
let cancelled = false;

if (native) {
  App.addListener('appUrlOpen', async ({ url }) => {
    try {
      const completed = await completeNativeLogin(url);
      if (completed) {
        setShowAuth(false);
        setNotice('Signed in successfully.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Email sign-in failed.');
    }
  }).then(handle => {
    if (cancelled) void handle.remove();
    else listener = handle;
  });

  App.getLaunchUrl().then(async result => {
    if (result?.url) {
      try {
        const completed = await completeNativeLogin(result.url);
        if (completed) {
          setShowAuth(false);
          setNotice('Signed in successfully.');
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Email sign-in failed.');
      }
    }
  });
}

return () => {
  cancelled = true;
  active=false;
  sync.current?.stop();
  void listener?.remove();
  subscription.unsubscribe();
};
 },[]);
 useEffect(()=>{
  setConflict(null);
  if(!supabase||!session?.user.id){setSaveStatus('Saved on device');return;}
  const engine=new SaveSync(session.user.id,cloudStore,{
   storage:localStorage,reload:()=>window.dispatchEvent(new Event('silicon-hustle-reload')),
   status:setSaveStatus,conflict:setConflict,error:setNotice
  });
  sync.current=engine;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let disposed=false;
  let nativeListener:{remove:()=>Promise<void>}|undefined;
  const flush=()=>{clearTimeout(timer);void engine.request();};
  const onSave=()=>{if(authUser.current!==session.user.id)return;setSaveStatus('Sync pending');clearTimeout(timer);timer=setTimeout(flush,500);};
  const visible=flush;
  const onStorage=(event:StorageEvent)=>{
   if(event.storageArea!==localStorage)return;
   if(event.key===SAVE_KEY||event.key===LEGACY_SAVE_KEY||event.key===null)window.dispatchEvent(new Event('silicon-hustle-reload'));
   if(event.key===SAVE_KEY||event.key===LEGACY_SAVE_KEY||event.key===META_KEY||event.key===null)flush();
  };
  window.addEventListener('silicon-hustle-save',onSave);
  window.addEventListener('online',flush);window.addEventListener('focus',flush);
  window.addEventListener('pagehide',flush);window.addEventListener('storage',onStorage);
  document.addEventListener('visibilitychange',visible);
  const retry=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)flush();},30000);
  if(native){
   App.addListener('appStateChange',({isActive})=>{
    if(isActive){supabase!.auth.startAutoRefresh();}else{supabase!.auth.stopAutoRefresh();}
    flush();
   }).then(handle=>{if(disposed)void handle.remove();else nativeListener=handle;}).catch(error=>setNotice('App lifecycle listener unavailable: '+String(error)));
  }
  flush();
  return ()=>{
   disposed=true;engine.stop();if(sync.current===engine)sync.current=null;
   clearTimeout(timer);clearInterval(retry);void nativeListener?.remove();
   window.removeEventListener('silicon-hustle-save',onSave);window.removeEventListener('online',flush);
   window.removeEventListener('focus',flush);window.removeEventListener('pagehide',flush);window.removeEventListener('storage',onStorage);
   document.removeEventListener('visibilitychange',visible);
  };
 },[session?.user.id,syncGeneration]);
 async function signOut(){
  if(busy)return;
  setBusy(true);
  const engine=sync.current;
  try{
   // Best effort flush, with a bounded wait offline. Local save/baseline survive.
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([engine?.request(),new Promise<void>(resolve=>{timer=setTimeout(resolve,3000);})]);}finally{clearTimeout(timer);}
   engine?.stop();
   const {error}=await supabase!.auth.signOut({scope:'local'});
   if(error)throw error;
   setShowAuth(false);setNotice('Signed out. Progress remains on this device.');
  }catch(error){setNotice('Could not sign out: '+(error instanceof Error?error.message:String(error)));setSyncGeneration(v=>v+1);}
  finally{setBusy(false);}
 }
 async function signInGoogle(){
  if(!supabase){setNotice('Google sign-in will be available after Supabase is configured.');return;}
  setBusy(true);setNotice('');
  try{
   if(native){
    await initializeNativeGoogle();
    const {raw,hashed}=await googleNonce();
    const response=await SocialLogin.login({provider:'google',options:{scopes:['email','profile'],nonce:hashed}});
    if(response.result.responseType!=='online')throw new Error('Google did not return an online sign-in result.');
    const token=(response.result as GoogleLoginResponseOnline).idToken;
    if(!token)throw new Error('Google did not return an ID token.');
    const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) as {nonce?:string};
    if(payload.nonce&&payload.nonce!==hashed)throw new Error('Google sign-in nonce did not match.');
    const {error}=await supabase.auth.signInWithIdToken({provider:'google',token,...(payload.nonce?{nonce:raw}:{})});
    if(error)throw error;
    setShowAuth(false);setNotice('Signed in successfully.');
   }else{
    const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
    if(error)throw error;
   }
  }catch(error){setNotice(error instanceof Error?error.message:'Google sign-in failed.');}
  finally{setBusy(false);}
 }
 async function signInEmail(e:React.FormEvent){
  e.preventDefault();
  if(!supabase){setNotice('Email sign-in will be available after Supabase is configured.');return;}
  setBusy(true);setNotice('');
  try{
   const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:native?callback:window.location.origin+window.location.pathname}});
   if(error)throw error;
   setNotice('Check your email for a secure sign-in link. Open it on this iPhone to return to Silicon Hustle.');
  }catch(error){setNotice(error instanceof Error?error.message:'Could not send sign-in email.');}
  finally{setBusy(false);}
 }
 function exportRecovery(){
  try{
   const payload={device:localStorage.getItem(SAVE_KEY)??localStorage.getItem(LEGACY_SAVE_KEY),history:localStorage.getItem('silicon-hustle-recovery-v1')};
   const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='silicon-hustle-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setNotice('Could not export recovery copies: '+String(error));}
 }
 async function chooseSave(useCloud:boolean){
  if(choosing||!sync.current)return;
  setChoosing(true);
  try{await sync.current.choose(useCloud);}finally{setChoosing(false);}
 }

 return <>
  {!welcome&&<div className="sh-account"><span className="sh-account-desktop">{session?.user.email?'FOUNDER: '+session.user.email:'GUEST MODE · SAVED ON THIS DEVICE'}</span>{session&&<span className="sh-account-desktop" role="status">{saveStatus}</span>}<span className="sh-account-mobile">Founder</span><span className="sh-account-mobile sh-sync-status" role="status">{!session?'Device save':saveStatus}</span><button onClick={()=>{setNotice('');setShowAuth(true);}}><span className="sh-account-desktop">{session?'ACCOUNT':'SIGN IN / CLOUD SAVE'}</span><span className="sh-account-mobile">Account</span></button></div>}
  {ready&&children}
  {welcome&&<div className="sh-gate" role="dialog" aria-modal="true" aria-label="Welcome to Silicon Hustle"><div className="sh-welcome"><div className="sh-eyebrow">SILICON HUSTLE // EST. 2026</div><h1>WELCOME, FOUNDER.</h1><div className="sh-portrait"><img src="/founder.png" alt="Pixel-art portrait of the Silicon Hustle founder" onError={e=>{e.currentTarget.style.display='none';}}/></div><p className="sh-quote">“Every unicorn starts with a questionable decision.”</p><p className="sh-sub">You've got $5 million, 30 months, and investors with opinions. What could possibly go wrong?</p><button className="sh-primary" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);}}>LET'S HUSTLE →</button><button className="sh-link" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);setShowAuth(true);}}>SIGN IN TO SAVE ACROSS DEVICES</button></div></div>}
  {showAuth&&<div className="sh-gate" role="presentation"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Founder account"><button className="sh-close" onClick={()=>setShowAuth(false)} aria-label="Close">✕</button><div className="sh-eyebrow">FOUNDER ACCESS</div><h2>{session?'YOUR ACCOUNT':'SAVE YOUR EMPIRE.'}</h2>{session?<><p>Signed in as {session.user.email||'founder'}.</p><p role="status">{saveStatus}. Progress is saved on this device first.</p><button className="sh-google" disabled={busy} onClick={()=>void sync.current?.request()}>RETRY CLOUD SYNC</button><button className="sh-primary" onClick={()=>{setShowAuth(false);}}>CONTINUE PLAYING</button><button className="sh-link" disabled={busy} onClick={()=>void signOut()}>SIGN OUT</button></>:<><p>Play for free without an account. Sign in when you want to keep your empire across devices.</p><button className="sh-google" onClick={signInGoogle} disabled={busy||!supabase}>CONTINUE WITH GOOGLE</button><div className="sh-divider">OR EMAIL A MAGIC LINK</div><form onSubmit={signInEmail}><label htmlFor="sh-email">EMAIL ADDRESS</label><input id="sh-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="founder@example.com" required/><button className="sh-primary" disabled={busy||!supabase} type="submit">EMAIL ME A SIGN-IN LINK</button></form>{!supabase&&<p className="sh-note">Account sign-in is being configured. Guest play works now.</p>}<button className="sh-link" onClick={()=>setShowAuth(false)}>KEEP PLAYING AS GUEST →</button></>}<button className="sh-link" onClick={exportRecovery}>EXPORT DEVICE RECOVERY COPIES</button>{notice&&<p className="sh-note" role="status">{notice}</p>}</section></div>}
  {conflict&&<div className="sh-gate"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Choose your game save"><div className="sh-eyebrow">SAVE CONFLICT</div><h2>CHOOSE YOUR PROGRESS</h2><p>{conflict.otherAccount?'This device has progress from another account. Choose what to use for your current account.':'Device and cloud progress differ. They cannot be merged. Choose the version to continue.'}</p><p><b>THIS DEVICE</b><br/>{saveSummary(conflict.local)}</p><p><b>CLOUD</b><br/>{saveSummary(conflict.cloud?JSON.stringify(conflict.cloud.game_state):null)}{conflict.cloud&&<><br/>Saved {new Date(conflict.cloud.updated_at).toLocaleString()}</>}</p><p>A recovery copy is kept on this device before either version is replaced.</p><button className="sh-primary" disabled={choosing||!conflict.cloud} onClick={()=>void chooseSave(true)}>USE CLOUD PROGRESS</button><button className="sh-google" disabled={choosing||!conflict.local} onClick={()=>void chooseSave(false)}>USE DEVICE PROGRESS</button>{notice&&<p className="sh-note" role="status">{notice}</p>}</section></div>}

 </>;
}
