import React,{useEffect,useRef,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {SocialLogin, type GoogleLoginResponseOnline} from '@capgo/capacitor-social-login';
import './auth.css';
import './automatic-resume.css';
import {ResumeCoordinator,validSave,inspectSave,saveFromRaw,sameSave,deviceRaw,pauseDeviceWrites,withSaveTimeout,DEVICE_RECOVERY_KEY,type ResumeView} from './automaticResume';

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

function parseOriginal(raw:string|null|undefined){try{return raw?JSON.parse(raw):null;}catch{return null;}}
type SaveValuation=(snapshot:Record<string,unknown>)=>number;
function saveSummary(state:Record<string,unknown>,valuationOf?:SaveValuation){
 let valuation:number|undefined;try{const value=valuationOf?.(state);if(typeof value==='number'&&Number.isFinite(value))valuation=value;}catch{/* Only show a valuation calculated by the game's existing handler. */}
 return `Month ${state.month}${state.ended?' · completed':''}${valuation===undefined?'':' · Valuation $'+Math.round(valuation).toLocaleString('en-US')}`;
}
function SaveOption({source,state,valuationOf,choose,checking}:{source:'cloud'|'device';state:Record<string,unknown>;valuationOf?:SaveValuation;choose:(source:'cloud'|'device')=>void;checking:boolean}){
 return <button type="button" className="sh-google sh-save-option" data-save-source={source} disabled={checking} onClick={()=>choose(source)}><strong>{source==='cloud'?'CLOUD SAVE':'DEVICE SAVE'}</strong><span>{saveSummary(state,valuationOf)}</span></button>;
}

export default function AuthGate({children,valuationOf}:{children:React.ReactNode;valuationOf?:SaveValuation}){
 const [welcome,setWelcome]=useState(()=>localStorage.getItem(WELCOME_KEY)!=='yes');
 const [session,setSession]=useState<Session|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [email,setEmail]=useState('');
 const [showAuth,setShowAuth]=useState(false);
 const [saveManager,setSaveManager]=useState(false);
 const [resume,setResume]=useState<ResumeView|null>(null);
 const [deviceError,setDeviceError]=useState('');
 const coordinator=useRef<ResumeCoordinator|null>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  supabase.auth.getSession().then(({data,error})=>{if(error)setNotice(error.message);setSession(data.session);setReady(true);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(coordinator.current?.account!==next?.user.id)coordinator.current?.stop();setSession(next);});
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
  void listener?.remove();
  subscription.unsubscribe();
};
 },[]);
 useEffect(()=>{
  const failed=(event:Event)=>setDeviceError((event as CustomEvent).detail==='changed'?'A save changed in another tab. Reload before playing; the newer saved copy is unchanged.':(event as CustomEvent).detail==='format'?'This save needs a different game version or recovery. Export it or open Saved Games; the original is unchanged.':'Device storage is unavailable. Your last saved game is unchanged. Free storage before continuing.');
  window.addEventListener('silicon-hustle-save-error',failed);
  return ()=>window.removeEventListener('silicon-hustle-save-error',failed);
 },[]);
 useEffect(()=>{
  setResume(null);
  const id=session?.user.id;if(!supabase||!id)return;
  let active=true;
  const current=new ResumeCoordinator(id,localStorage,{
   identity:async()=>{const {data,error}=await supabase!.auth.getUser();if(error)throw error;return data.user;},
   read:()=>withSaveTimeout(async signal=>{const {data,error}=await supabase!.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',id).retry(false).abortSignal(signal).maybeSingle();if(error)throw error;return data;}),
   write:(expected,snapshot)=>withSaveTimeout(async signal=>{
    const payload={game_state:snapshot,updated_at:new Date().toISOString()};
    // Both comparisons are atomic PostgREST filters; no timestamp ordering or upsert.
    const query=expected?supabase!.from('game_saves').update(payload).eq('user_id',id).eq('updated_at',expected.updated_at).eq('game_state',JSON.stringify(expected.game_state)):supabase!.from('game_saves').insert({...payload,user_id:id});
    const {data,error}=await query.select('user_id,game_state,updated_at').retry(false).abortSignal(signal).maybeSingle();
    if(error){if(error.code==='23505')return null;throw error;}return data;
   })
  },view=>{if(active)setResume(view);},()=>{if(active)window.dispatchEvent(new Event('silicon-hustle-reload'));});
  coordinator.current=current;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const saved=()=>{setDeviceError('');current.noteDeviceChange();clearTimeout(timer);timer=setTimeout(()=>void current.check(),900);};
  const newGame=()=>current.newGame();
  const refresh=()=>{if(document.visibilityState!=='hidden')void current.check();};
  const otherTab=()=>{pauseDeviceWrites();current.stop();if(active)setResume({status:'SAVE REVIEW NEEDED',notice:'A save changed in another tab. Reload before syncing.',choice:false,checking:false,device:null,cloud:null});};
  const storage=(event:StorageEvent)=>{if(event.key==='silicon-hustle-v04'||event.key?.startsWith('silicon-hustle-resume-v1:'))otherTab();};
  window.addEventListener('silicon-hustle-save',saved);window.addEventListener('silicon-hustle-new-game',newGame);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('storage',storage);
  let nativeListener:{remove():Promise<void>}|undefined;
  if(native)void App.addListener('appStateChange',state=>{if(state.isActive)refresh();}).then(handle=>{if(!active)void handle.remove();else nativeListener=handle;});
  void current.check();
  return ()=>{active=false;current.stop();if(coordinator.current===current)coordinator.current=null;clearTimeout(timer);window.removeEventListener('silicon-hustle-save',saved);window.removeEventListener('silicon-hustle-new-game',newGame);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('storage',storage);void nativeListener?.remove();};
 },[session?.user.id]);
 useEffect(()=>{
  if(!resume?.choice)return;
  const dialog=document.querySelector<HTMLElement>('.sh-save-picker');
  const previous=document.activeElement as HTMLElement|null;
  const buttons=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),summary')||[]).filter(element=>element.getClientRects().length>0);
  (buttons()[0]??dialog)?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!coordinator.current?.view.checking){event.preventDefault();closeSaves();}
   if(event.key!=='Tab')return;
   const available=buttons(),first=available[0],last=available.at(-1);
   if(!first)return;
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  dialog?.addEventListener('keydown',key);
  return ()=>{dialog?.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[resume?.choice,resume?.checking,saveManager]);
 function closeSaves(){setSaveManager(false);coordinator.current?.closeReview();}
 function exportSaves(){try{const text=coordinator.current?.exportRecovery()??JSON.stringify({device:deviceRaw(localStorage),deviceRecovery:localStorage.getItem(DEVICE_RECOVERY_KEY)},null,2);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='silicon-hustle-save-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setDeviceError('Could not export recovery copies. Device storage may be unavailable.');}}
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
 const deviceSave=saveFromRaw(resume?.device??null),cloudSave=inspectSave(resume?.cloud?.game_state);
 const cloudUnavailable=resume?.status==='DEVICE PLAY · SYNC PAUSED';
 const bothValid=!!deviceSave.state&&!!cloudSave.state;
 const genuineConflict=bothValid&&!sameSave(parseOriginal(resume?.device),resume?.cloud?.game_state);
 const choose=(source:'cloud'|'device')=>void coordinator.current?.choose(source);
 return <>
  {!welcome&&<div className="sh-account"><span>{session?.user.email?'FOUNDER: '+session.user.email:'GUEST MODE · SAVED ON THIS DEVICE'}</span>{session&&<span role="status">{resume?.status}</span>}<button onClick={()=>{setNotice('');setShowAuth(true);}}>{session?'ACCOUNT':'SIGN IN / CLOUD SAVE'}</button></div>}
  {deviceError&&<div className="sh-note" role="alert">{deviceError}<button className="sh-link" onClick={exportSaves}>EXPORT DEVICE SAVE</button></div>}
  {session&&resume?.notice&&!resume.choice&&<p className="sh-note" role="status">{resume.notice}</p>}
  {ready&&children}
  {welcome&&<div className="sh-gate" role="dialog" aria-modal="true" aria-label="Welcome to Silicon Hustle"><div className="sh-welcome"><div className="sh-eyebrow">SILICON HUSTLE // EST. 2026</div><h1>WELCOME, FOUNDER.</h1><div className="sh-portrait"><img src="/founder.png" alt="Pixel-art portrait of the Silicon Hustle founder" onError={e=>{e.currentTarget.style.display='none';}}/></div><p className="sh-quote">“Every unicorn starts with a questionable decision.”</p><p className="sh-sub">You've got $5 million, 30 months, and investors with opinions. What could possibly go wrong?</p><button className="sh-primary" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);}}>LET'S HUSTLE →</button><button className="sh-link" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);setShowAuth(true);}}>SIGN IN TO SAVE ACROSS DEVICES</button></div></div>}
  {showAuth&&<div className="sh-gate" role="presentation"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Founder account"><button className="sh-close" onClick={()=>setShowAuth(false)} aria-label="Close">✕</button><div className="sh-eyebrow">FOUNDER ACCESS</div><h2>{session?'YOUR ACCOUNT':'SAVE YOUR EMPIRE.'}</h2>{session?<><p>Signed in as {session.user.email||'founder'}.</p><p>Your progress can sync across devices when cloud saves are configured.</p><button className="sh-primary" onClick={()=>{setShowAuth(false);}}>CONTINUE PLAYING</button><button className="sh-primary" onClick={()=>{setShowAuth(false);setSaveManager(true);void coordinator.current?.review();}}>SAVED GAMES</button><button className="sh-link" onClick={async()=>{coordinator.current?.stop();await supabase?.auth.signOut();setShowAuth(false);setNotice('Signed out. This device keeps its local save.');}}>SIGN OUT</button></>:<><p>Play for free without an account. Sign in when you want to keep your empire across devices.</p><button className="sh-google" onClick={signInGoogle} disabled={busy||!supabase}>CONTINUE WITH GOOGLE</button><div className="sh-divider">OR EMAIL A MAGIC LINK</div><form onSubmit={signInEmail}><label htmlFor="sh-email">EMAIL ADDRESS</label><input id="sh-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="founder@example.com" required/><button className="sh-primary" disabled={busy||!supabase} type="submit">EMAIL ME A SIGN-IN LINK</button></form>{!supabase&&<p className="sh-note">Account sign-in is being configured. Guest play works now.</p>}<button className="sh-link" onClick={()=>setShowAuth(false)}>KEEP PLAYING AS GUEST →</button></>}{notice&&<p className="sh-note" role="status">{notice}</p>}</section></div>}
  {resume?.choice&&session&&<div className="sh-gate"><section className="sh-dialog sh-save-picker" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Choose your game save">
   <h2>{saveManager?'SAVED GAMES':genuineConflict?'CHOOSE YOUR SAVE':'SAVE NEEDS REVIEW'}</h2>
   {genuineConflict&&!saveManager&&<p>We found two different games. Which one should we keep?</p>}
   {resume.checking&&<p role="status">Checking saves…</p>}
   {cloudUnavailable&&<p role="status">Cloud unavailable · reconnect to check. Your saves have not been replaced.</p>}
   {!resume.checking&&!cloudUnavailable&&<>
    {cloudSave.state&&<SaveOption source="cloud" state={cloudSave.state} valuationOf={valuationOf} choose={choose} checking={false}/>}
    {deviceSave.state&&(!resume.cloud||cloudSave.state)&&<SaveOption source="device" state={deviceSave.state} valuationOf={valuationOf} choose={choose} checking={false}/>}
    {resume.device!==null&&!deviceSave.state&&<p className="sh-save-issue">Device: {deviceSave.reason}</p>}
    {resume.cloud&&!cloudSave.state&&<p className="sh-save-issue">Cloud: {cloudSave.reason}</p>}
    {!resume.device&&!resume.cloud&&<p>No saved games found.</p>}
    {saveManager&&!resume.device&&resume.cloud&&<p>No device save found.</p>}
    {saveManager&&deviceSave.state&&!resume.cloud&&<p>No cloud save found.</p>}
    {deviceSave.state&&resume.cloud&&!cloudSave.state&&<p>Device: {saveSummary(deviceSave.state,valuationOf)}. Continue locally while the cloud save is reviewed.</p>}
   </>}
   {resume.notice&&<p className="sh-note" role="status">{resume.notice}</p>}
   {saveManager?<details className="sh-save-recovery"><summary>Recovery &amp; save details</summary><p>Original copies are kept on this device before a replacement. Export them before clearing app storage.</p>{deviceSave.issue&&resume.device!==null&&<p>Device format check: {deviceSave.issue}</p>}{cloudSave.issue&&resume.cloud&&!cloudUnavailable&&<p>Cloud format check: {cloudSave.issue}</p>}<button className="sh-link" onClick={exportSaves}>EXPORT RECOVERY COPIES</button></details>:!genuineConflict&&<button className="sh-link" onClick={()=>setSaveManager(true)}>OPEN SAVED GAMES</button>}
   <button className="sh-link" disabled={resume.checking} onClick={closeSaves}>{deviceSave.state?'CONTINUE ON THIS DEVICE':'CLOSE'}</button>
  </section></div>}

 </>;
}
