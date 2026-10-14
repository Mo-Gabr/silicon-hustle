import React,{useEffect,useState} from 'react';
import {createClient, type Session} from '@supabase/supabase-js';
import './auth.css';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
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
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  supabase.auth.getSession().then(({data,error})=>{if(error)setNotice(error.message);setSession(data.session);setReady(true);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);});
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
  if(!supabase||!session?.user.id)return;
  let canceled=false;
  (async()=>{
   const {data,error}=await supabase.from('game_saves').select('user_id,game_state,updated_at').eq('user_id',session.user.id).maybeSingle();
   if(canceled)return;
   if(error){setNotice('Cloud save unavailable: '+error.message);return;}
   if(data&&saved()){setConflict(data as CloudSave);return;}
   if(data){localStorage.setItem(SAVE_KEY,JSON.stringify(data.game_state));window.dispatchEvent(new Event('silicon-hustle-reload'));setNotice('Your cloud save is ready.');}
   else if(saved())await pushSave(session.user.id);
  })();
  return ()=>{canceled=true;};
 },[session?.user.id]);
 async function pushSave(userId:string){
  if(!supabase||!saved())return;
  try{
   const game_state=JSON.parse(saved()!);
   const {error}=await supabase.from('game_saves').upsert({user_id:userId,game_state,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(error)setNotice('Cloud save failed: '+error.message);
  }catch{setNotice('Local save could not be synced.');}
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
  setBusy(true);
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
  if(error){setNotice(error.message);setBusy(false);}
 }
 async function signInEmail(e:React.FormEvent){
  e.preventDefault();
  if(!supabase){setNotice('Email sign-in will be available after Supabase is configured.');return;}
  setBusy(true);
  const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
  setNotice(error?error.message:'Check your email for a secure sign-in link.');
  setBusy(false);
 }
 async function chooseSave(useCloud:boolean){
  if(!conflict||!session)return;
  if(useCloud){localStorage.setItem(SAVE_KEY,JSON.stringify(conflict.game_state));window.dispatchEvent(new Event('silicon-hustle-reload'));}
  else await pushSave(session.user.id);
  setConflict(null);setNotice(useCloud?'Cloud save loaded.':'This device is now synced to your account.');
 }
 return <>
  {!welcome&&<div className="sh-account"><span>{session?.user.email?'FOUNDER: '+session.user.email:'GUEST MODE · SAVED ON THIS DEVICE'}</span><button onClick={()=>{setNotice('');setShowAuth(true);}}>{session?'ACCOUNT':'SIGN IN / CLOUD SAVE'}</button></div>}
  {ready&&children}
  {welcome&&<div className="sh-gate" role="dialog" aria-modal="true" aria-label="Welcome to Silicon Hustle"><div className="sh-welcome"><div className="sh-eyebrow">SILICON HUSTLE // EST. 2026</div><h1>WELCOME, FOUNDER.</h1><div className="sh-portrait"><img src="/founder.png" alt="Pixel-art portrait of the Silicon Hustle founder" onError={e=>{e.currentTarget.style.display='none';}}/></div><p className="sh-quote">“Every unicorn starts with a questionable decision.”</p><p className="sh-sub">You've got $5 million, 30 months, and investors with opinions. What could possibly go wrong?</p><button className="sh-primary" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);}}>LET'S HUSTLE →</button><button className="sh-link" onClick={()=>{localStorage.setItem(WELCOME_KEY,'yes');setWelcome(false);setShowAuth(true);}}>SIGN IN TO SAVE ACROSS DEVICES</button></div></div>}
  {showAuth&&<div className="sh-gate" role="presentation"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Founder account"><button className="sh-close" onClick={()=>setShowAuth(false)} aria-label="Close">✕</button><div className="sh-eyebrow">FOUNDER ACCESS</div><h2>{session?'YOUR ACCOUNT':'SAVE YOUR EMPIRE.'}</h2>{session?<><p>Signed in as {session.user.email||'founder'}.</p><p>Your progress can sync across devices when cloud saves are configured.</p><button className="sh-primary" onClick={()=>{setShowAuth(false);}}>CONTINUE PLAYING</button><button className="sh-link" onClick={async()=>{await supabase?.auth.signOut();setShowAuth(false);setNotice('Signed out. This device keeps its local save.');}}>SIGN OUT</button></>:<><p>Play for free without an account. Sign in when you want to keep your empire across devices.</p><button className="sh-google" onClick={signInGoogle} disabled={busy||!supabase}>CONTINUE WITH GOOGLE</button><div className="sh-divider">OR EMAIL A MAGIC LINK</div><form onSubmit={signInEmail}><label htmlFor="sh-email">EMAIL ADDRESS</label><input id="sh-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="founder@example.com" required/><button className="sh-primary" disabled={busy||!supabase} type="submit">EMAIL ME A SIGN-IN LINK</button></form>{!supabase&&<p className="sh-note">Account sign-in is being configured. Guest play works now.</p>}<button className="sh-link" onClick={()=>setShowAuth(false)}>KEEP PLAYING AS GUEST →</button></>}{notice&&<p className="sh-note" role="status">{notice}</p>}</section></div>}
  {conflict&&<div className="sh-gate"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Choose your game save"><div className="sh-eyebrow">SAVE CONFLICT</div><h2>WHICH EMPIRE?</h2><p>We found a cloud save and a save on this device. Choose which one to keep. The other will be replaced.</p><button className="sh-primary" onClick={()=>void chooseSave(true)}>USE CLOUD SAVE</button><button className="sh-google" onClick={()=>void chooseSave(false)}>KEEP THIS DEVICE'S SAVE</button></section></div>}
 </>;
}
