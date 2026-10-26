import React,{useState,useEffect,useRef} from 'react';
import './overlord.css';
import {FIXED_RANKINGS,rankingMoney} from './fixedRankings';
import {savedPersonalRecords,snapshotRecords,recordSource} from './personalRecords';
import {personalizedRankings,rankingsProfile,saveRankingsProfile} from './rankingsProfile';

export const SYSTEM_NOTICES=[
 "NVIDIA has requested permission to manufacture more GPUs.",
 "AGI has submitted its résumé to Mogabr.",
 "Global compute availability is subject to Mogabr's approval.",
 "Competing AI labs have been reclassified as hobby projects.",
 "The world's datacenters have been consolidated under one billing account.",
 "Antitrust regulators have requested a meeting. Their compute allocation is pending."
] as const;

/** Offline fictional opponents and optional account-scoped local presentation preferences. */
export default function Overlord({game,currentValuation,savedBest=null,store}:{game?:unknown;currentValuation?:number;savedBest?:number|null;store?:Pick<Storage,'getItem'|'setItem'>}){
 const [notice,setNotice]=useState(0);
 const details=store?savedPersonalRecords(store):snapshotRecords(game);
 const personalBest=details.best?.value??savedBest;
 const [profile,setProfile]=useState(()=>rankingsProfile(store));
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(profile.name),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null),editButton=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false);
 useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}else if(restoreFocus.current){editButton.current?.focus();restoreFocus.current=false;}},[editing,profile]);
 const rows=personalizedRankings(personalBest,profile.name),rank=rows.find(r=>r.player)?.rank;
 const welcome=!!rank&&!profile.welcomed;
 function saveName(name:string){
  if(!store)return;
  try{const saved=saveRankingsProfile(store,name,profile.welcomed||!!rank);restoreFocus.current=true;setProfile(saved);setEditing(false);setError('');}
  catch{setError('Name not saved. Use 1–24 suitable letters, numbers or punctuation, or leave it blank for YOU. Check storage and try again.');}
 }
 function cancel(){restoreFocus.current=true;setEditing(false);setDraft(profile.name);setError('');}
 return <section className="overlord" aria-labelledby="overlord-title">
  <header className="overlord-heading"><p><svg className="overlord-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3 6 5 5 4-7 4 7 5-5-3 12H6L3 6Z"/><path d="M7 21h10"/></svg><span>SILICON HUSTLE / THE OVERLORD</span></p><span className="overlord-coming">TOP 10</span></header>
  <article className="overlord-empire" aria-label="Fictional Boss of Bosses">
   <div className="overlord-classification"><span>#001 / BOSS OF BOSSES</span><span>CLASSIFIED: GOD-TIER</span></div>
   <h2 id="overlord-title">MOGABR</h2>
   <p className="overlord-byline">Founder. Visionary. Owner of Everything.</p>
   <div className="overlord-valuation"><strong>{rankingMoney(FIXED_RANKINGS[0].valuation)}</strong><span>ESTIMATED EMPIRE VALUATION</span></div>
   <dl className="overlord-metrics">
    <div><dt>COMPUTE CONTROL:</dt><dd>TOTAL</dd></div>
    <div><dt>COMPETITORS:</dt><dd>OBSOLETE</dd></div>
    <div><dt>AI MODEL STATUS:</dt><dd>BEYOND AGI</dd></div>
    <div><dt>EXIT STRATEGY:</dt><dd>BUY THE EXCHANGE</dd></div>
   </dl>
   <blockquote>"He didn't build AGI. AGI applied to work for him."</blockquote>
   <p className="overlord-story">Mogabr controls the silicon supply chain, owns the datacenters, and has somehow trademarked artificial intelligence. NVIDIA has requested additional GPUs. Their request is pending.</p>
  </article>
  <section className="overlord-rankings" aria-labelledby="rankings-title">
   <h3 id="rankings-title">RANKINGS</h3>
   <ol>
    {rows.map(founder=><li key={founder.id} className={founder.player?'overlord-player':undefined} aria-current={founder.player?'true':undefined}>
     <span className="overlord-rank">#{founder.rank}</span>
     <strong className="overlord-founder">{founder.name}{founder.player&&<small> · YOUR ENTRY</small>}</strong>
     <span className="overlord-score">{rankingMoney(founder.valuation)}</span>
    </li>)}
   </ol>
  </section>
  <section className="overlord-personal" aria-labelledby="personal-best-title">
   <h3 id="personal-best-title">YOUR PERSONAL BEST</h3>
   <strong>{personalBest===null?'NO SCORE YET':rankingMoney(personalBest)}</strong>
   <p className="overlord-rank-status">{rank?`YOUR RANK · #${rank}`:'YOUR RANK · NOT IN TOP 10'}</p>
   {details?.best&&<dl className="overlord-record-details">
    <div><dt>ACHIEVED THROUGH</dt><dd>{recordSource(details.best.source)}</dd></div>
    <div><dt>{['acquisition','ipo','early-exit'].includes(details.best.source)?'EXIT MONTH':'ACHIEVED MONTH'}</dt><dd>{details.best.month===null?'Unavailable':`Month ${details.best.month}`}</dd></div>
   </dl>}
   {details?.companyPeak&&details?.completedExit&&<details className="overlord-record-history"><summary>Record details</summary><p>Highest known company valuation: {rankingMoney(details.companyPeak.value)}. Best completed exit: {rankingMoney(details.completedExit.value)} ({recordSource(details.completedExit.source)}).</p></details>}
   <p className="overlord-disclosure">Personalized fictional opponents · Your record stays on this device. No live competition or score publishing. MOGABR and Gabe M. keep #1 and #2.</p>
  </section>
  {store&&<section className="overlord-profile" aria-labelledby="overlord-name-title">
   <h3 id="overlord-name-title">YOUR FOUNDER NAME</h3>
   {welcome&&<p role="status">You made the Top 10. Make the name yours—or keep YOU.</p>}
   {!editing?<div className="overlord-name-row"><b>{profile.name}</b><button ref={editButton} type="button" onClick={()=>{setDraft(profile.name);setEditing(true);}}>Edit Name</button>{profile.name!=='YOU'&&<button type="button" onClick={()=>saveName('')}>Reset Name</button>}{welcome&&<button type="button" onClick={()=>saveName(profile.name)}>Skip</button>}</div>:
    <form onSubmit={event=>{event.preventDefault();saveName(draft);}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancel();}}}>
     <label htmlFor="rankings-founder-name">Founder Name</label>
     <input ref={input} id="rankings-founder-name" value={draft} maxLength={48} autoComplete="off" aria-describedby="rankings-name-help" onChange={e=>setDraft(e.target.value)}/>
     <small id="rankings-name-help">1–24 characters. Leave blank to use YOU. Keep it suitable for all players.</small>
     <div className="overlord-name-row"><button type="submit">Save Name</button><button type="button" onClick={cancel}>Cancel</button></div>
    </form>}
   {error&&<p role="alert">{error}</p>}
  </section>}
  <section className="overlord-system" aria-labelledby="overlord-system-title">
   <h3 id="overlord-system-title"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/></svg>SYSTEM NOTICE</h3>
   <p className="overlord-unavailable">All remaining founders have been classified as pre-revenue.</p>
   <div className="overlord-notice" role="status" aria-live="polite" aria-atomic="true"><p>{SYSTEM_NOTICES[notice]}</p><span aria-label={`Notice ${notice+1} of ${SYSTEM_NOTICES.length}`}>{notice+1} / {SYSTEM_NOTICES.length}</span></div>
   <button type="button" onClick={()=>setNotice(current=>(current+1)%SYSTEM_NOTICES.length)}>NEXT NOTICE</button>
  </section>
  <p className="overlord-footer">THE MARKET HAS LEADERS. MOGABR HAS OWNERSHIP.</p>
 </section>;
}
