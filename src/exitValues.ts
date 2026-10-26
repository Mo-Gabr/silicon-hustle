/** Existing displayed offer prices, now reusable when recording an accepted deal. */
export const ACQUIRERS:readonly string[]=['Microsoft','NVIDIA','AMD','Google','Amazon','Oracle','Salesforce'] as const;
export type ExitResult={version:1;kind:'acquisition'|'ipo';month:number;companyValuation:number;valuation:number;buyer:string};
export function acquisitionOffers(seed:number,valuation:number){
 return [0,1,2].map(n=>({buyer:ACQUIRERS[(Math.abs(seed)+n*3)%ACQUIRERS.length],valuation:Math.round(valuation*(1.08+n*.06))}));
}
export function completeExit<T extends {month:number;ended:boolean;cash:number;labs:number;seed:number;endingChoice?:string;gamble?:{decision:string}}>(s:T,name:string,value:number):T&{exitResult:ExitResult}{
 if(!s.ended||s.endingChoice||s.gamble?.decision==='pending'||!Number.isFinite(s.cash)||s.cash<0||(s.month>30&&s.gamble?.decision!=='extend')||!Number.isSafeInteger(Math.round(value))||!Number.isFinite(value)||value<1e8||!Number.isInteger(s.month)||s.month<1||s.month>42)throw Error('This company cannot close an exit.');
 const ipo=name==='Fictional IPO';
 const offer=acquisitionOffers(s.seed,value).find(o=>o.buyer===name);
 if(ipo?(value<150e6||s.labs*420000*12<12e6||s.labs*270000<=0):!offer)throw Error('This exit is not available.');
 const exitResult:ExitResult={version:1,kind:ipo?'ipo':'acquisition',month:s.month,companyValuation:value,valuation:ipo?Math.round(value):offer!.valuation,buyer:name};
 return {...s,endingChoice:name,ending:`${name} — deal signed (fictional).`,exitResult};
}
