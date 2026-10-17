/** Presentation only: availability always comes from the shared gameplay rules. */
import {ENTERPRISE_BALANCE as B,capacity,slots,recurringRevenue,focusBlock,type Company,type Focus} from './foundersGamble';
export const actionMoney=(value:number)=>value>=1e9?'$'+(value/1e9).toLocaleString('en-US',{maximumFractionDigits:2})+'B':value>=1e6?'$'+(value/1e6).toLocaleString('en-US',{maximumFractionDigits:2})+'M':'$'+value.toLocaleString('en-US');
const titles:Record<Focus,string>={pilot:'LAND A PILOT',enterprise:'LAND BIG CLIENT',strategic:'SIGN MAJOR PARTNER',capacity:'EXPAND CAPACITY',reliability:'IMPROVE RELIABILITY',operate:'OPERATE'};
export const enterpriseActionTitle=(focus:Focus)=>titles[focus];
function blockedCopy(reason:string|null,id:Focus){
 if(!reason)return null;
 if(reason.includes('cash'))return 'Not enough cash';
 if(reason.includes('before promising')&&(id==='pilot'||id==='enterprise'||id==='strategic'))return `Need ${B.focuses[id].slots} free client ${B.focuses[id].slots===1?'slot':'slots'}`;
 if(reason.includes('already'))return 'Already at maximum';
 return 'Chapter closed';
}
export function clientSlots(company:Company){const e=company.gamble!.enterprise;return `${slots(e)} / ${capacity(e,company.labs)} slots`;}
export function enterpriseActions(company:Company){
 const e=company.gamble!.enterprise;
 return (Object.keys(titles) as Focus[]).map(id=>{
  const cost=B.focuses[id].cost;
  let effect:string;
  if(id==='pilot'||id==='enterprise'||id==='strategic'){
   const rule=B.focuses[id];
   effect=`${rule.chance*100}% chance · +${actionMoney(rule.revenue)}/month`;
  }else if(id==='capacity')effect=`+${Math.max(0,Math.min(B.addedCapacity,B.maxCapacity-capacity(e,company.labs)))} client slots`;
  else if(id==='reliability')effect=`+${e.reliability<B.maxReliability?1:0} reliability · ${B.incidentChance[Math.min(e.reliability,B.maxReliability-1)]*100}% incident risk`;
  else effect=`keep ${actionMoney(recurringRevenue(e))}/month · ${B.incidentChance[e.reliability-1]*100}% incident risk`;
  const reason=focusBlock(company,id);
  let lockedCopy=blockedCopy(reason,id);
  if(reason&&company.gamble?.decision==='extend'&&!company.ended&&company.month<B.finalMonth){
   if(id==='enterprise'&&(e.contracts.filter(c=>c.kind==='pilot').length<B.pilotsRequired||e.reliability<B.enterpriseReliability))lockedCopy=`Unlock: Pilots ${e.contracts.filter(c=>c.kind==='pilot').length}/${B.pilotsRequired} · Reliability ${e.reliability}/${B.enterpriseReliability}`;
   if(id==='strategic'&&(e.contracts.filter(c=>c.kind==='enterprise').length<B.enterprisesRequired||e.reliability<B.strategicReliability))lockedCopy=`Unlock: Big clients ${e.contracts.filter(c=>c.kind==='enterprise').length}/${B.enterprisesRequired} · Reliability ${e.reliability}/${B.strategicReliability}`;
  }
  return {id,title:titles[id],description:`Spend ${actionMoney(cost)} · ${effect}`,disabled:!!reason,lockedCopy};
 });
}
