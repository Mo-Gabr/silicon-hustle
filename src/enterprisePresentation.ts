/** Presentation only: availability always comes from the shared gameplay rules. */
import {ENTERPRISE_BALANCE as B,capacity,slots,recurringRevenue,focusBlock,type Company,type Focus} from './foundersGamble';
export const actionMoney=(value:number)=>value>=1e9?'$'+(value/1e9).toLocaleString('en-US',{maximumFractionDigits:2})+'B':value>=1e6?'$'+(value/1e6).toLocaleString('en-US',{maximumFractionDigits:2})+'M':'$'+value.toLocaleString('en-US');
const titles:Record<Focus,string>={pilot:'LAND A PILOT',enterprise:'LAND BIG CLIENT',strategic:'SIGN MAJOR PARTNER',capacity:'EXPAND CAPACITY',reliability:'IMPROVE RELIABILITY',operate:'OPERATE'};
export const enterpriseActionTitle=(focus:Focus)=>titles[focus];
const signed=(company:Company,kind:'pilot'|'enterprise'|'strategic')=>company.gamble!.enterprise.contracts.filter(c=>c.kind===kind).length;
export function clientSlots(company:Company){const e=company.gamble!.enterprise;return `${slots(e)} / ${capacity(e,company.labs)} slots`;}
export function enterpriseRequirements(company:Company,id:Focus){
 const e=company.gamble!.enterprise;
 const requirements:{key:string;met:boolean;text:string}[]=[];
 const add=(key:string,met:boolean,text:string)=>requirements.push({key,met,text});
 if(id==='enterprise')add('pilots',signed(company,'pilot')>=B.pilotsRequired,`Pilots ${signed(company,'pilot')}/${B.pilotsRequired}`);
 if(id==='strategic')add('clients',signed(company,'enterprise')>=B.enterprisesRequired,`Big clients ${signed(company,'enterprise')}/${B.enterprisesRequired}`);
 const reliability=id==='enterprise'?B.enterpriseReliability:id==='strategic'?B.strategicReliability:0;
 if(reliability)add('reliability',e.reliability>=reliability,`Reliability ${e.reliability}/${reliability}`);
 const cost=B.focuses[id].cost;
 if(cost)add('cash',company.cash>=cost,`Cash ${actionMoney(company.cash)} / ${actionMoney(cost)}`);
 if(id==='pilot'||id==='enterprise'||id==='strategic'){
  const free=capacity(e,company.labs)-slots(e),need=B.focuses[id].slots;
  add('slots',free>=need,`Free slots ${free}/${need}`);
 }
 if(id==='reliability')add('maximum',e.reliability<B.maxReliability,`Reliability already at maximum ${B.maxReliability}`);
 if(id==='capacity')add('maximum',capacity(e,company.labs)<B.maxCapacity,`Client slots already at maximum ${B.maxCapacity}`);
 return requirements;
}
/** Lower bound including the target attempt: bids all succeed, funding is available.
 * Existing AI Lab upgrades use no month, so allow their maximum capacity to avoid
 * declaring a path impossible when the player could still buy labs. */
export function minimumEnterpriseMoves(company:Company,id:'pilot'|'enterprise'|'strategic'){
 const e=company.gamble!.enterprise;
 const big=id==='strategic'?Math.max(0,B.enterprisesRequired-signed(company,'enterprise')):0;
 const pilots=id==='enterprise'||big>0?Math.max(0,B.pilotsRequired-signed(company,'pilot')):0;
 const reliability=id==='strategic'?B.strategicReliability:id==='enterprise'?B.enterpriseReliability:1;
 const upgrades=Math.max(0,reliability-e.reliability);
 const neededSlots=slots(e)+pilots+big+B.focuses[id].slots;
 if(neededSlots>B.maxCapacity)return Infinity;
 const expansions=Math.max(0,Math.ceil((neededSlots-capacity(e,8))/B.addedCapacity));
 return pilots+big+upgrades+expansions+1;
}
export function enterpriseActions(company:Company){
 const e=company.gamble!.enterprise;
 return (Object.keys(titles) as Focus[]).map(id=>{
  const cost=B.focuses[id].cost;
  let effect:string;
  if(id==='pilot'||id==='enterprise'||id==='strategic'){
   const rule=B.focuses[id];effect=`${rule.chance*100}% chance · +${actionMoney(rule.revenue)}/month`;
  }else if(id==='capacity')effect=`+${Math.max(0,Math.min(B.addedCapacity,B.maxCapacity-capacity(e,company.labs)))} client slots`;
  else if(id==='reliability')effect=`+${e.reliability<B.maxReliability?1:0} reliability · ${B.incidentChance[Math.min(e.reliability,B.maxReliability-1)]*100}% incident risk`;
  else effect=`keep ${actionMoney(recurringRevenue(e))}/month · ${B.incidentChance[e.reliability-1]*100}% incident risk`;
  const reason=focusBlock(company,id);
  const closed=company.gamble?.decision!=='extend'||company.ended||company.month>=B.finalMonth;
  const unmet=enterpriseRequirements(company,id).filter(r=>!r.met).map(r=>r.text);
  const lockedCopy=reason?(closed?['Chapter closed',...unmet]:unmet.length?unmet:[reason]).join(' · '):null;
  let warning:string|null=null;
  if(!closed&&(id==='pilot'||id==='enterprise'||id==='strategic')){
   const moves=minimumEnterpriseMoves(company,id),left=B.finalMonth-company.month;
   if(!Number.isFinite(moves))warning='No room for this path at maximum client capacity.';
   else if(moves>left)warning=`Not enough months: at least ${moves} moves needed, ${left} left—even if every bid succeeds.`;
  }
  return {id,title:titles[id],description:`Spend ${actionMoney(cost)} · ${effect}`,disabled:!!reason,lockedCopy,warning};
 });
}
export function enterpriseProgress(company:Company){
 return (['pilot','enterprise','strategic'] as const).map(id=>{
  const count=signed(company,id),target=id==='pilot'?B.pilotsRequired:id==='enterprise'?B.enterprisesRequired:1;
  const complete=count>=target;
  return {id,title:id==='pilot'?'Pilot':id==='enterprise'?'Big Client':'Major Partner',count,target,complete,requirements:enterpriseRequirements(company,id)};
 });
}
/** Opening planning phase only; loading a later save must never replay onboarding. */
export function showEnterpriseIntro(company:Company){
 return company.gamble?.decision==='extend'&&!company.ended&&company.month===B.standardMonth&&company.gamble.enterprise.ledger.length===0;
}
