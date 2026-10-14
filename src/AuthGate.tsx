import React,{useEffect,useRef,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {SocialLogin, type GoogleLoginResponseOnline} from '@capgo/capacitor-social-login';
import './auth.css';

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

const SAVE_KEY='silicon-hustle-v04';
const WELCOME_KEY='silicon-hustle-welcome-v09';
const saved=()=>localStorage.getItem(SAVE_KEY);
type CloudSave={user_id:string;game_state:unknown;updated_at:string};

export default function AuthGate({children}:{children:React.ReactNode}){
 const [welcome,setWelcome]=useState(()=>localStorage.getItem(WELCOME_KEY)!=='yes');
 const [session,setSession]=useState<Session|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [email,setEmail]=useState('');
 const [showAuth,setShowAuth]=useState(false);
 const [conflict,setConflict]=useState<CloudSave|null>(null);
 const [ready,setReady]=useState(false);
 const revision=useRef<string|null>(null);
 const syncing=useRef(false);
 const dirty=useRef(false);
 const resolved=useRef(false);
 const [saveStatus,setSaveStatus]=useState('');
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  supabase.auth.getSession().then(({data,error})=>{if(error)setNotice(error.message);setSession(data.session);setReady(true);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);});
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(!supabase||!session?.user.id)return;
  resolved.current=false;revision.current=null;dirty.current=false;
  let canceled=false;
  (async()=>{
   const {data,error}=await supabase.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',session.user.id).maybeSingle();
   if(canceled)return;
   if(error){setNotice('Cloud save unavailable: '+error.message);return;}
   if(data&&saved()){revision.current=data.updated_at;setConflict(data as CloudSave);return;}
   if(data){revision.current=data.updated_at;resolved.current=true;localStorage.setItem(SAVE_KEY,JSON.stringify(data.game_state));window.dispatchEvent(new Event('silicon-hustle-reload'));setSaveStatus('CLOUD SAVE LOADED');}
   else {resolved.current=true;if(saved())await pushSave(session.user.id);}
  })();
  return ()=>{canceled=true;};
 },[session?.user.id]);
 async function pushSave(userId:string){
  if(!supabase||!saved()||!resolved.current){dirty.current=true;return;}
  if(syncing.current){dirty.current=true;return;}
  syncing.current=true;dirty.current=false;
  try{
   const snapshot=saved()!;
   const game_state=JSON.parse(snapshot);
   const previous=revision.current;
   const nextTime=new Date().toISOString();
   if(previous){
    const {data,error}=await supabase.from('game_saves').update({game_state,updated_at:nextTime}).eq('user_id',userId).eq('updated_at',previous).select('updated_at').maybeSingle();
    if(error)throw error;
    if(!data){
     const latest=await supabase.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',userId).maybeSingle();
     if(latest.error)throw latest.error;
     if(latest.data){revision.current=latest.data.updated_at;resolved.current=false;setConflict(latest.data as CloudSave);setSaveStatus('SAVE CONFLICT — CHOOSE A VERSION');}
     else {revision.current=null;dirty.current=true;}
     return;
    }
    revision.current=data.updated_at;
   }else{
    const {data,error}=await supabase.from('game_saves').insert({user_id:userId,game_state,updated_at:nextTime}).select('updated_at').single();
    if(error){
     if(error.code==='23505'){
      const latest=await supabase.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',userId).maybeSingle();
      if(latest.data){revision.current=latest.data.updated_at;resolved.current=false;setConflict(latest.data as CloudSave);setSaveStatus('SAVE CONFLICT — CHOOSE A VERSION');return;}
     }
     throw error;
    }
    revision.current=data.updated_at;
   }
   setSaveStatus('CLOUD SAVE SYNCED');
   if(saved()!==snapshot)dirty.current=true;
  }catch(error){setSaveStatus('CLOUD SAVE FAILED');setNotice('Cloud save failed. Your progress remains on this device. '+(error instanceof Error?error.message:''));}
  finally{
   syncing.current=false;
   if(dirty.current&&resolved.current&&revision.current!==null)void pushSave(userId);
  }
 }
 useEffect(()=>{
  if(!supabase||!session?.user.id||conflict)return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const onSave=()=>{clearTimeout(timer);timer=setTimeout(()=>{void pushSave(session.user.id);},900);};
  window.addEventListener('silicon-hustle-save',onSave);
  return ()=>{window.removeEventListener('silicon-hustle-save',onSave);clearTimeout(timer);};
 },[session?.user.id,conflict]);
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
 async function chooseSave(useCloud:boolean){
  if(!conflict||!session||!supabase)return;
  const latest=await supabase.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',session.user.id).maybeSingle();
  if(latest.error){setNotice('Could not verify latest cloud save. Try again.');return;}
  if(latest.data&&latest.data.updated_at!==conflict.updated_at){revision.current=latest.data.updated_at;setConflict(latest.data as CloudSave);setNotice('Cloud save changed again. Review the latest version.');return;}
  revision.current=latest.data?.updated_at||null;
  if(useCloud){if(latest.data){localStorage.setItem(SAVE_KEY,JSON.stringify(latest.data.game_state));window.dispatchEvent(new Event('silicon-hustle-reload'));}resolved.current=true;setConflict(null);setSaveStatus('CLOUD SAVE LOADED');}
  else {resolved.current=true;setConflict(null);await pushSave(session.user.id);}
  setNotice(useCloud?'Cloud save loaded.':'Local save selected.');
 }
 return <>
  {!welcome&&<div className="sh-account"><span>{session?.user.email?'FOUNDER: '+session.user.email:'GUEST MODE · SAVED ON THIS DEVICE'}</span>{session&&<span role="status">{saveStatus}</span>}<button onClick={()=>{setNotice('');setShowAuth(true);}}>{session?'ACCOUNT':'SIGN IN / CLOUD SAVE'}</button></div>}
  {ready&&children}
  {welcome&&<div className="sh-gate" role="dialog" aria-modal="true" aria-label="Welcome to Silicon Hustle"><div className="sh-welcome"><div className="sh-eyebrow">SILICON HUSTLE // EST. 2026</div><h1>WELCOME, FOUNDER.</h1><div className="sh-portrait"><img src="/founder.png" alt="Pixel-art portrait of the Silicon Hustle founder" onError={e=>{e.currentTarget.style.display='none';}}/></div><p className="sh-quote">“Every unicorn starts with a questionable decision.”</p><p className="sh-sub">You've got $5 million, 30 months, and investors with opinions. What could possibly go wrong?</p><button className="sh-primary" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);}}>LET'S HUSTLE →</button><button className="sh-link" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);setShowAuth(true);}}>SIGN IN TO SAVE ACROSS DEVICES</button></div></div>}
  {showAuth&&<div className="sh-gate" role="presentation"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Founder account"><button className="sh-close" onClick={()=>setShowAuth(false)} aria-label="Close">✕</button><div className="sh-eyebrow">FOUNDER ACCESS</div><h2>{session?'YOUR ACCOUNT':'SAVE YOUR EMPIRE.'}</h2>{session?<><p>Signed in as {session.user.email||'founder'}.</p><p>Your progress can sync across devices when cloud saves are configured.</p><button className="sh-primary" onClick={()=>{setShowAuth(false);}}>CONTINUE PLAYING</button><button className="sh-link" onClick={async()=>{await supabase?.auth.signOut();setShowAuth(false);setNotice('Signed out. This device keeps its local save.');}}>SIGN OUT</button></>:<><p>Play for free without an account. Sign in when you want to keep your empire across devices.</p><button className="sh-google" onClick={signInGoogle} disabled={busy||!supabase}>CONTINUE WITH GOOGLE</button><div className="sh-divider">OR EMAIL A MAGIC LINK</div><form onSubmit={signInEmail}><label htmlFor="sh-email">EMAIL ADDRESS</label><input id="sh-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="founder@example.com" required/><button className="sh-primary" disabled={busy||!supabase} type="submit">EMAIL ME A SIGN-IN LINK</button></form>{!supabase&&<p className="sh-note">Account sign-in is being configured. Guest play works now.</p>}<button className="sh-link" onClick={()=>setShowAuth(false)}>KEEP PLAYING AS GUEST →</button></>}{notice&&<p className="sh-note" role="status">{notice}</p>}</section></div>}
  {conflict&&<div className="sh-gate"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Choose your game save"><div className="sh-eyebrow">SAVE CONFLICT</div><h2>WHICH EMPIRE?</h2><p>We found a cloud save and a save on this device. Choose which one to keep. The other will be replaced.</p><button className="sh-primary" onClick={()=>void chooseSave(true)}>USE CLOUD SAVE</button><button className="sh-google" onClick={()=>void chooseSave(false)}>KEEP THIS DEVICE'S SAVE</button></section></div>}
 </>;
}
