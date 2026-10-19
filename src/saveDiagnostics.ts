import {decodeLocal,GAME_KEYS,RECOVERY_KEY} from './localSaves';
import {premium} from './foundersGamble';
type Reader={getItem:(key:string)=>string|null};
export type DiagnosticRow={key:string;presence:string;selected:boolean;month:number|null;valuation:number|null;version:string;validation:string};
function snapshot(key:string,raw:string,selected:boolean):DiagnosticRow{
 let value:unknown;try{value=JSON.parse(raw);}catch{return {key,presence:'Present',selected,month:null,valuation:null,version:'Unavailable',validation:'Unreadable JSON'};}
 const x=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const state=decodeLocal(value);
 let valuation:number|null=null;
 if(state){
  const positions=state.positions as Record<string,{qty:number}>,prices=state.prices as Record<string,number>,labs=state.labs as number;
  const holdings=Object.entries(positions).reduce((sum,[id,p])=>sum+p.qty*prices[id],0);
  const total=Math.max(0,20e6+Number(state.cash)+holdings+labs*420000*12*3.25+labs*270000*12*.3)+premium(state as Parameters<typeof premium>[0]);
  if(Number.isFinite(total))valuation=total;
 }
 // Never echo arbitrary strings from snapshots (names, notes, or possible secrets).
 const version=[x.gameVersion,x.game_version,x.version].find(v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v));
 return {key,presence:'Present',selected,month:typeof x.month==='number'&&Number.isFinite(x.month)?x.month:null,valuation,version:typeof version==='string'?version:'Not recorded',validation:state?'Valid for current client':'Unsupported by current validator; original retained'};
}
export function inspectSaves(store:Reader):DiagnosticRow[]{
 const rows:DiagnosticRow[]=[];let selected=false,selectionUnknown=false;
 for(const key of [...GAME_KEYS,RECOVERY_KEY]){
  let raw:string|null;try{raw=store.getItem(key);}catch{rows.push({key,presence:'Read unavailable',selected:false,month:null,valuation:null,version:'Unavailable',validation:'Storage access failed'});selectionUnknown=true;continue;}
  const base={key,presence:'Absent',selected:false,month:null,valuation:null,version:'Unavailable',validation:'No snapshot'};
  if(raw===null){rows.push(base);continue;}
  if(key===RECOVERY_KEY){
   try{const archive=JSON.parse(raw);if(!Array.isArray(archive))throw Error();rows.push({...base,presence:'Present',validation:`Archive: ${archive.length} entries`});archive.forEach((entry,i)=>{if(entry&&GAME_KEYS.includes(entry.key)&&typeof entry.raw==='string')rows.push(snapshot(`${RECOVERY_KEY} [${i+1}: ${entry.key}]`,entry.raw,false));else rows.push({...base,key:`${RECOVERY_KEY} [${i+1}]`,presence:'Present',validation:'Unsupported archive entry'});});}
   catch{rows.push({...base,presence:'Present',validation:'Unreadable archive'});}continue;
  }
  rows.push(snapshot(key,raw,!selected&&!selectionUnknown));selected=true;
 }
 if(selectionUnknown)for(const row of rows)row.selected=false;
 return rows;
}
export function diagnosticSummary(rows:DiagnosticRow[]):string{
 return ['Silicon Hustle — read-only save diagnostics','Gameplay and autosave paused in this temporary build.','Valuation calculated with current game rules; missing version is not inferred.',...rows.map(r=>`${r.key}: ${r.presence}; ${r.selected?'SELECTED (key priority; may be blocked)':'not selected'}; month ${r.month??'Unavailable'}; valuation ${r.valuation===null?'Unavailable':'$'+Math.round(r.valuation).toLocaleString('en-US')}; version ${r.version}; ${r.validation}`)].join('\n');
}
