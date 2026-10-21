import React,{useState} from 'react';
import './overlord.css';
import {FIXED_RANKINGS,rankingMoney} from './fixedRankings';
import {personalBestValue} from './foundersGamble';

export const SYSTEM_NOTICES=[
 "NVIDIA has requested permission to manufacture more GPUs.",
 "AGI has submitted its résumé to Mogabr.",
 "Global compute availability is subject to Mogabr's approval.",
 "Competing AI labs have been reclassified as hobby projects.",
 "The world's datacenters have been consolidated under one billing account.",
 "Antitrust regulators have requested a meeting. Their compute allocation is pending."
] as const;

/** Fixed fictional Rankings with a caller-supplied local best; no storage or API access. */
export default function Overlord({game,currentValuation,savedBest=null}:{game?:unknown;currentValuation?:number;savedBest?:number|null}){
 const [notice,setNotice]=useState(0);
 const runBest=game!==undefined&&currentValuation!==undefined
  ?personalBestValue(game,currentValuation)
  :null;
 const personalBest=runBest===null?savedBest:savedBest===null?runBest:Math.max(runBest,savedBest);
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
    {FIXED_RANKINGS.map(founder=><li key={founder.rank}>
     <span className="overlord-rank">#{founder.rank}</span>
     <strong className="overlord-founder">{founder.name}</strong>
     <span className="overlord-score">{rankingMoney(founder.valuation)}</span>
    </li>)}
   </ol>
  </section>
  <section className="overlord-personal" aria-labelledby="personal-best-title">
   <h3 id="personal-best-title">YOUR PERSONAL BEST</h3>
   <strong>{personalBest===null?'NO SCORE YET':rankingMoney(personalBest)}</strong>
  </section>
  <section className="overlord-system" aria-labelledby="overlord-system-title">
   <h3 id="overlord-system-title"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/></svg>SYSTEM NOTICE</h3>
   <p className="overlord-unavailable">All remaining founders have been classified as pre-revenue.</p>
   <div className="overlord-notice" role="status" aria-live="polite" aria-atomic="true"><p>{SYSTEM_NOTICES[notice]}</p><span aria-label={`Notice ${notice+1} of ${SYSTEM_NOTICES.length}`}>{notice+1} / {SYSTEM_NOTICES.length}</span></div>
   <button type="button" onClick={()=>setNotice(current=>(current+1)%SYSTEM_NOTICES.length)}>NEXT NOTICE</button>
  </section>
  <p className="overlord-footer">THE MARKET HAS LEADERS. MOGABR HAS OWNERSHIP.</p>
 </section>;
}
