import React,{createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {supabase} from './AuthGate';
import {rankingsConfiguration,requireRankingsClient} from './rankingsApi';
import type {BoardGame} from './boardAttribution';
import {BENCHMARK,BoardController,milestones,type BoardApi,type BoardView} from './leaderboardCore';
import './leaderboard.css';
import {standardRankingValue} from './foundersGamble';

const money=(value:number)=>'$'+value.toLocaleString('en-US');
const compact=(value:number)=>value>=1e9?'$'+(value/1e9).toLocaleString('en-US',{maximumFractionDigits:1})+'B':value>=1e6?'$'+(value/1e6).toLocaleString('en-US',{maximumFractionDigits:1})+'M':money(value);
const empty:BoardView={entries:[],self:null,total:0,peak:0,status:'loading',error:'',loadedAt:null,writing:false};
type BoardContextValue={view:BoardView;userId:string|null;authReady:boolean;refresh:(offset?:number)=>void;offset:number;};
const BoardContext=createContext<BoardContextValue|null>(null);
function useBoard(){const value=useContext(BoardContext);if(!value)throw new Error('Rankings provider missing.');return value;}
const configuration=rankingsConfiguration(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const api:BoardApi={
 async read(limit,offset){
  const client=requireRankingsClient(supabase,configuration);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const {data,error}=await client.rpc('get_billionaire_board',{p_limit:limit,p_offset:offset}).abortSignal(controller.signal);if(error)throw error;return data;}finally{clearTimeout(timer);}
 },
 async submit(){throw Error('Score publishing is paused for local-only games.');}
};
let currentGame:BoardGame|null=null;
const gameListeners=new Set<()=>void>();
const subscribeGame=(listener:()=>void)=>{gameListeners.add(listener);return ()=>{gameListeners.delete(listener);};};
const gameSnapshot=()=>currentGame;
export function announceBoardPeak(value:number,snapshot:string){try{const standard=standardRankingValue(JSON.parse(snapshot),value);currentGame=standard===null?null:{value:standard,snapshot};}catch{currentGame=null;}gameListeners.forEach(listener=>listener());}
export function BillionaireBoardProvider({children}:{children:React.ReactNode}){
 const [userId,setUserId]=useState<string|null>(null);
 const [authReady,setAuthReady]=useState(!supabase);
 const [view,setView]=useState<BoardView>(empty);
 const [offset,setOffset]=useState(0);
 const controller=useRef<BoardController|null>(null);
 const requested=useRef(false);
 const activeUser=useRef<string|null>(null);
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
  if(requested.current)void current.refresh();
  return ()=>{current.stop();if(controller.current===current)controller.current=null;};
 },[userId,authReady]);
 const refresh=useCallback((next?:number)=>{requested.current=true;const current=controller.current;if(!current)return;setOffset(next??current.offset);void current.refresh(next);},[]);
 useEffect(()=>{
  const observe=()=>{if(currentGame)controller.current?.observe(currentGame.value);};observe();return subscribeGame(observe);
 },[userId,authReady]);
 return <BoardContext.Provider value={{view,userId,authReady,refresh,offset}}>{children}</BoardContext.Provider>;
}
export default function BillionaireBoard(){
 const {view,userId,authReady,refresh,offset}=useBoard();
 useEffect(()=>{if(authReady)refresh();},[refresh,userId,authReady]);
 const game=useSyncExternalStore(subscribeGame,gameSnapshot);
 const best=Math.max(view.peak,view.self?.best_valuation??0,game?.value??0);
 const notice=view.error;
 const benchmarkPercent=Math.min(100,best/BENCHMARK*100);
 return <section className="billionaire-board" aria-labelledby="board-title">
  <div className="board-heading"><div><p className="board-kicker">GLOBAL FOUNDER RANKINGS</p><h2 id="board-title">RANKINGS</h2></div><button type="button" className="board-refresh" onClick={()=>refresh()} aria-label="Refresh Rankings">↻ REFRESH</button></div>
  <article className="board-legend" aria-label="MOGABR developer benchmark">
   <div className="board-legend-top"><span>★ LEGEND</span><span>FOUNDER'S BENCHMARK</span></div><h3>MOGABR</h3><strong>{'$'+BENCHMARK.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><p>FOUNDER STATUS: LEGENDARY</p><small>The empire. The myth. The benchmark every founder dreams of reaching. Your investors called. They're wondering what's taking you so long.</small>
  </article>
  <div className="board-personal"><div><span>YOUR PERSONAL BEST</span><strong>{best?money(best):'—'}</strong><small>{view.self?'Published best is kept.':'Your standard-game best on this device.'}</small></div><div><span>PUBLISHED POSITION</span><strong>{view.self?'#'+view.self.position:'—'}</strong><small>{view.total?`${view.total.toLocaleString()} public founders`:'No published position yet'}</small></div></div>
  {userId&&view.self&&<section className="board-name"><h3>YOUR FOUNDER NAME</h3><strong>{view.self.display_name}</strong></section>}
  <p className="board-footnote">Score publishing and name editing are paused for local-only games. Existing published scores are kept.</p>
  {!authReady&&<p role="status">Checking your account…</p>}
  <div className="board-rank-heading"><h3>GLOBAL RANKINGS</h3><span>PERSONAL BEST · USD</span></div>
  {notice&&<p className="board-notice" role="status">{notice}</p>}
  {view.status==='loading'&&<p role="status">Loading founder rankings…</p>}
  {view.loadedAt&&<p className="board-loaded">{view.status==='error'?'Last loaded rankings':'Rankings loaded'} {new Date(view.loadedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>}
  {view.entries.length>0?<ol className="board-rankings" aria-label="Global player rankings">{view.entries.map(player=><li key={player.public_id} className={player.public_id===view.self?.public_id?'is-you':''}><span className="board-position">#{player.position}</span><div><b>{player.display_name}{player.public_id===view.self?.public_id&&<em>YOU</em>}</b><small>{new Date(player.achieved_at).toLocaleDateString()}</small></div><strong>{money(player.best_valuation)}</strong></li>)}</ol>:view.status==='ready'&&<p className="board-empty">No Rankings entries yet. Keep building your company.</p>}
  {(view.total>50||offset>0)&&<div className="board-pages"><button disabled={offset===0} onClick={()=>refresh(Math.max(0,offset-50))}>← PREVIOUS</button><span>{offset+1}–{Math.min(offset+50,view.total)}</span><button disabled={offset+50>=view.total||offset>=1000000} onClick={()=>refresh(offset+50)}>NEXT →</button></div>}
  <p className="board-disclosure">Early Access · Rankings are based on player-submitted scores.</p>
  <section className="board-milestones" aria-labelledby="milestone-title"><div><h3 id="milestone-title">ROAD TO THE LEGEND</h3><b>{benchmarkPercent>0&&benchmarkPercent<0.01?'<0.01':benchmarkPercent.toFixed(2)}%</b></div><progress value={Math.min(best,BENCHMARK)} max={BENCHMARK} aria-label="Progress toward MOGABR benchmark"/><ol>{milestones(best).map(m=><li key={m.target} className={m.reached?'reached':''}><span aria-hidden="true">{m.reached?'✓':'○'}</span><span>{compact(m.target)}</span><small>{m.reached?'REACHED':m.target===BENCHMARK?'THE LEGEND':'MILESTONE'}</small></li>)}</ol></section>
  <p className="board-footnote">Highest-ever valuation wins. New games and device switches keep your published best. Equal scores are ordered by achievement time, then a stable public ID. MOGABR is a separate developer benchmark.</p>
 </section>;
}
