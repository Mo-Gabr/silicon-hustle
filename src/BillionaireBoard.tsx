import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {supabase} from './AuthGate';
import {attributedPeak,sameBoardSnapshot,type BoardGame} from './boardAttribution';
import {BENCHMARK,BoardController,milestones,type BoardApi,type BoardView} from './leaderboardCore';
import './leaderboard.css';

const money=(value:number)=>'$'+value.toLocaleString('en-US');
const compact=(value:number)=>value>=1e9?'$'+(value/1e9).toLocaleString('en-US',{maximumFractionDigits:1})+'B':value>=1e6?'$'+(value/1e6).toLocaleString('en-US',{maximumFractionDigits:1})+'M':money(value);
const empty:BoardView={entries:[],self:null,total:0,peak:0,status:'loading',error:'',loadedAt:null,writing:false};
type BoardContextValue={view:BoardView;userId:string|null;authReady:boolean;refresh:(offset?:number)=>void;rename:(name:string)=>Promise<boolean>;offset:number};
const BoardContext=createContext<BoardContextValue|null>(null);
function useBoard(){const value=useContext(BoardContext);if(!value)throw new Error('Leaderboard provider missing.');return value;}
const api:BoardApi={
 async read(limit,offset){
  if(!supabase)throw {code:'PGRST202'};
  const {data,error}=await supabase.rpc('get_billionaire_board',{p_limit:limit,p_offset:offset}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;return data;
 },
 async submit(valuation,version,name,expectedUserId){
  if(!supabase)throw {code:'PGRST202'};
  const {data,error}=await supabase.rpc('submit_billionaire_score',{p_valuation:valuation,p_game_version:version,p_display_name:name??null,p_expected_user_id:expectedUserId}).retry(false).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;return data;
 }
};
let currentGame:BoardGame|null=null;
export function announceBoardPeak(value:number,snapshot:string){currentGame={value,snapshot};}
function displayedGame():BoardGame|null {
 try{const raw=localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04');if(!raw||!currentGame||!sameBoardSnapshot(JSON.parse(raw),JSON.parse(currentGame.snapshot)))return null;return currentGame;}catch{return null;}
}
export function BillionaireBoardProvider({children}:{children:React.ReactNode}){
 const [userId,setUserId]=useState<string|null>(null);
 const [authReady,setAuthReady]=useState(!supabase);
 const [view,setView]=useState<BoardView>(empty);
 const [offset,setOffset]=useState(0);
 const controller=useRef<BoardController|null>(null);
 const activeUser=useRef<string|null>(null);
 const publishing=useRef(false);
 useEffect(()=>{
  if(!supabase)return;
  let active=true,seen=false;
  const accept=(id:string|null)=>{if(!active)return;activeUser.current=id;if(controller.current?.userId!==id){controller.current?.stop();controller.current=null;}setUserId(id);setAuthReady(true);};
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{seen=true;accept(session?.user.id??null);});
  void supabase.auth.getSession().then(({data})=>{if(!seen)accept(data.session?.user.id??null);}).catch(()=>{if(active)setAuthReady(true);});
  return ()=>{active=false;activeUser.current=null;subscription.unsubscribe();controller.current?.stop();};
 },[]);
 useEffect(()=>{
  if(!authReady)return;
  const current=new BoardController(userId,api,localStorage,setView);
  controller.current=current;setView(current.view);setOffset(0);
  void current.refresh();
  return ()=>{current.stop();if(controller.current===current)controller.current=null;};
 },[userId,authReady]);
 const refresh=useCallback((next?:number)=>{const current=controller.current;if(!current)return;setOffset(next??current.offset);void current.refresh(next);},[]);
 const rename=useCallback(async(name:string)=>{
  const current=controller.current,id=current?.userId;
  if(!current||!id||!supabase||publishing.current)return false;
  publishing.current=true;
  try{
   const value=await attributedPeak(id,{
    identity:async()=>{const {data,error}=await supabase!.auth.getUser();if(error)throw Error('Account verification failed.');return data.user;},
    savedGame:async owner=>{const {data,error}=await supabase!.from('game_saves').select('user_id,game_state').eq('user_id',owner).abortSignal(AbortSignal.timeout(12000)).maybeSingle();if(error)throw Error('Could not verify your saved game. No score was submitted.');return data;},
    current:()=>activeUser.current===id&&controller.current===current?displayedGame():null
   });
   if(controller.current!==current||activeUser.current!==id)return false;
   current.observe(value);
   return await current.publish(name);
  }catch(error){if(controller.current===current)setView(v=>({...v,error:error instanceof Error?error.message:'Could not verify save ownership. No score was submitted.'}));return false;}
  finally{publishing.current=false;}
 },[]);
 return <BoardContext.Provider value={{view,userId,authReady,refresh,rename,offset}}>{children}</BoardContext.Provider>;
}
export default function BillionaireBoard(){
 const {view,userId,authReady,refresh,rename,offset}=useBoard();
 const [draft,setDraft]=useState('');
 const [editing,setEditing]=useState(false);
 const [message,setMessage]=useState('');
 const best=Math.max(view.peak,view.self?.best_valuation??0);
 const benchmarkPercent=Math.min(100,best/BENCHMARK*100);
 async function saveName(event:React.FormEvent){event.preventDefault();setMessage('');if(await rename(draft)){setEditing(false);setDraft('');setMessage('Founder name saved. Your personal best is kept.');}}
 return <section className="billionaire-board" aria-labelledby="board-title">
  <div className="board-heading"><div><p className="board-kicker">GLOBAL FOUNDER RANKINGS</p><h2 id="board-title">THE BILLIONAIRE<br/>BOARD<span>_</span></h2></div><button type="button" className="board-refresh" onClick={()=>refresh()} aria-label="Refresh leaderboard">↻ REFRESH</button></div>
  <article className="board-legend" aria-label="MOGABR developer benchmark">
   <div className="board-legend-top"><span>★ LEGEND</span><span>FOUNDER'S BENCHMARK</span></div><h3>MOGABR</h3><strong>{'$'+BENCHMARK.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><p>FOUNDER STATUS: LEGENDARY</p><small>The empire. The myth. The benchmark every founder dreams of reaching. Your investors called. They're wondering what's taking you so long.</small>
  </article>
  <p className="board-integrity"><b>UNVERIFIED · EARLY ACCESS</b> Player valuations are submitted by the game client and have not been independently verified.</p>
  <div className="board-personal"><div><span>YOUR PERSONAL BEST</span><strong>{best?money(best):'—'}</strong><small>{!userId?'Sign in through Account to keep a global personal best.':view.self?'Published best · updates are manual.':'Publish your synced game to join.'}</small></div><div><span>PUBLISHED POSITION</span><strong>{view.self?'#'+view.self.position:'—'}</strong><small>{view.total?`${view.total.toLocaleString()} public founders`:'No published position yet'}</small></div></div>
  {userId&&<div className="board-name"><span>PUBLIC FOUNDER NAME</span><small>Resolve cloud-save choices in Account first. Only a game matching your own cloud save can publish.</small>{view.self&&!editing?<div><b>{view.self.display_name}</b><button type="button" disabled={view.writing} onClick={()=>void rename(view.self!.display_name)}>PUBLISH SAVED PEAK</button><button type="button" onClick={()=>{setDraft(view.self!.display_name);setEditing(true);setMessage('');}}>EDIT NAME</button></div>:<form onSubmit={saveName}><label htmlFor="founder-name">Choose the name other players will see</label><div><input id="founder-name" type="text" minLength={3} maxLength={24} autoComplete="off" autoCapitalize="words" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Your founder name" required/><button disabled={view.writing||view.status==='unavailable'}>{view.writing?'SAVING…':view.self?'PUBLISH / SAVE NAME':'JOIN BOARD'}</button></div><small>3–24 characters. Letters, numbers, spaces, . _ - · Never use an email address. Publishing verifies that this game matches your account’s cloud save, then publishes its current or recorded report peak. Updates are manual. Names can be edited; your best never decreases.</small>{editing&&<button type="button" onClick={()=>setEditing(false)}>CANCEL</button>}</form>}</div>}
  {!authReady&&<p role="status">Checking your account…</p>}
  <section className="board-milestones" aria-labelledby="milestone-title"><div><h3 id="milestone-title">ROAD TO THE LEGEND</h3><b>{benchmarkPercent>0&&benchmarkPercent<0.01?'<0.01':benchmarkPercent.toFixed(2)}%</b></div><progress value={Math.min(best,BENCHMARK)} max={BENCHMARK} aria-label="Progress toward MOGABR benchmark"/><ol>{milestones(best).map(m=><li key={m.target} className={m.reached?'reached':''}><span aria-hidden="true">{m.reached?'✓':'○'}</span><span>{compact(m.target)}</span><small>{m.reached?'REACHED':m.target===BENCHMARK?'THE LEGEND':'MILESTONE'}</small></li>)}</ol></section>
  <div className="board-rank-heading"><h3>GLOBAL RANKINGS</h3><span>PERSONAL BEST · USD</span></div>
  {(view.error||message)&&<p className="board-notice" role="status">{view.error||message}</p>}
  {view.status==='loading'&&<p role="status">Loading founder rankings…</p>}
  {view.loadedAt&&<p className="board-loaded">{view.status==='error'?'Last loaded rankings':'Rankings loaded'} {new Date(view.loadedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · Unverified scores</p>}
  {view.entries.length>0?<ol className="board-rankings" aria-label="Global player rankings">{view.entries.map(player=><li key={player.public_id} className={player.public_id===view.self?.public_id?'is-you':''}><span className="board-position">#{player.position}</span><div><b>{player.display_name}{player.public_id===view.self?.public_id&&<em>YOU</em>}</b><small>UNVERIFIED · v{player.game_version} · {new Date(player.achieved_at).toLocaleDateString()}</small></div><strong>{money(player.best_valuation)}</strong></li>)}</ol>:view.status==='ready'&&<p className="board-empty">No public founders yet. Choose your name and publish your first personal best.</p>}
  {(view.total>50||offset>0)&&<div className="board-pages"><button disabled={offset===0} onClick={()=>refresh(Math.max(0,offset-50))}>← PREVIOUS</button><span>{offset+1}–{Math.min(offset+50,view.total)}</span><button disabled={offset+50>=view.total||offset>=1000000} onClick={()=>refresh(offset+50)}>NEXT →</button></div>}
  <p className="board-footnote">Highest-ever valuation wins. New games and device switches keep your published best. Equal scores are ordered by achievement time, then a stable public ID. MOGABR is a separate developer benchmark.</p>
 </section>;
}
