import React,{useEffect,useRef,useState} from 'react';
import {selectLocalGame,type SaveChoice} from './localSaveChoice';
import {premium} from './foundersGamble';
const amount=(state:Record<string,unknown>)=>{
 const prices=state.prices as Record<string,number>,positions=state.positions as Record<string,{qty:number}>,labs=Number(state.labs);
 const holdings=Object.entries(positions).reduce((sum,[id,p])=>sum+p.qty*prices[id],0);
 return '$'+Math.round(Math.max(0,20e6+Number(state.cash)+holdings+labs*420000*12*3.25+labs*270000*12*.3)+premium(state as Parameters<typeof premium>[0])).toLocaleString('en-US');
};
export default function LocalSaveChoice({choice,done}:{choice:SaveChoice;done:()=>void}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),locked=useRef(false),first=useRef<HTMLButtonElement>(null);
 useEffect(()=>{first.current?.focus();},[]);
 const choose=(which:'historical'|'current')=>{if(locked.current)return;locked.current=true;setBusy(true);try{selectLocalGame(localStorage,choice,which);done();}catch(error){setError(error instanceof Error?error.message:'Could not preserve your games. Please reopen the app.');/* Never retry a possibly completed activation automatically. */}};
 return <div className="sh-gate"><section className="sh-dialog" role="dialog" aria-modal="true" aria-label="Choose your game" style={{maxHeight:'calc(100dvh - 80px)',overflowY:'auto',boxSizing:'border-box'}} onKeyDown={event=>{if(event.key==='Tab'){const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0]?.focus();}}}}><h2>CHOOSE YOUR GAME</h2><p>We found your earlier game and your current game. Both originals will be kept.</p><button ref={first} className="sh-primary" disabled={busy} onClick={()=>choose('historical')}>MONTH 42 · {amount(choice.historical)}<br/>RECOMMENDED · KEEP EARLIER GAME</button><button className="sh-google" disabled={busy} onClick={()=>choose('current')}>MONTH {String(choice.current.month)} · {amount(choice.current)}<br/>KEEP CURRENT GAME</button><p>One choice. Then straight back to your game.</p>{error&&<p role="alert">{error}</p>}</section></div>;
}
