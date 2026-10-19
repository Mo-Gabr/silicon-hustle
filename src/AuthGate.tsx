import React,{useEffect,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {SocialLogin, type GoogleLoginResponseOnline} from '@capgo/capacitor-social-login';
import './auth.css';
import {rankingsConfiguration} from './rankingsApi';
import {readLocal,GAME_KEYS} from './localSaves';
import {localFounderName} from './gameProfile';

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

export const supabase=(()=>{if(!rankingsConfiguration(url,key).ready)return null;try{return createClient(url!,key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:!native,flowType:'pkce'}});}catch{return null;}})();

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

export default function AuthGate({children}:{children:React.ReactNode}){
 const [profileName,setProfileName]=useState(()=>localFounderName(readLocal(localStorage).state));
 useEffect(()=>{
  const refresh=()=>setProfileName(localFounderName(readLocal(localStorage).state));
  const storage=(event:StorageEvent)=>{if(event.key===null||GAME_KEYS.includes(event.key))refresh();};
  window.addEventListener('silicon-hustle-save',refresh);
  window.addEventListener('silicon-hustle-reload',refresh);
  window.addEventListener('storage',storage);
  return ()=>{window.removeEventListener('silicon-hustle-save',refresh);window.removeEventListener('silicon-hustle-reload',refresh);window.removeEventListener('storage',storage);};
 },[]);
 const [session,setSession]=useState<Session|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [email,setEmail]=useState('');
 const [showAuth,setShowAuth]=useState(false);
 useEffect(()=>{
  if(!supabase){return;}
  supabase.auth.getSession().then(({data,error})=>{if(error)setNotice(error.message);setSession(data.session);}).catch(()=>setNotice('Rankings sign-in is unavailable. Your game works on this device.'));
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);});
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
 return <>
  <div className="sh-account"><span data-testid="local-founder-name">{profileName}</span><button onClick={()=>{setNotice('');setShowAuth(true);}}>{session?'ACCOUNT':'RANKINGS SIGN IN'}</button></div>
  {children}
  {showAuth&&<div className="sh-gate"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Founder account"><button className="sh-close" onClick={()=>setShowAuth(false)} aria-label="Close">✕</button><h2>{session?'YOUR ACCOUNT':'RANKINGS SIGN IN'}</h2>{session?<><p>Signed in as {session.user.email||'founder'}.</p><p>Your game stays on this device. This account is only for optional Rankings.</p><button className="sh-primary" onClick={()=>setShowAuth(false)}>CONTINUE PLAYING</button><button className="sh-link" onClick={async()=>{await supabase?.auth.signOut();setShowAuth(false);}}>SIGN OUT</button></>:<><p>Sign-in is optional. Play and save on this device without an account.</p><button className="sh-google" onClick={signInGoogle} disabled={busy||!supabase}>CONTINUE WITH GOOGLE</button><div className="sh-divider">OR EMAIL A MAGIC LINK</div><form onSubmit={signInEmail}><label htmlFor="sh-email">EMAIL ADDRESS</label><input id="sh-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><button className="sh-primary" disabled={busy||!supabase}>EMAIL ME A SIGN-IN LINK</button></form><button className="sh-link" onClick={()=>setShowAuth(false)}>KEEP PLAYING</button></>}{notice&&<p role="status">{notice}</p>}</section></div>}
 </>;
}
