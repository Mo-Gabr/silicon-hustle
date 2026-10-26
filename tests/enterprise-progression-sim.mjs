// Offline synthetic balance comparison. The bonus variant exists ONLY in this
// script's in-memory source; it is not imported by the application or saves.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=readFileSync('src/foundersGamble.ts','utf8');
const load=async text=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'));
const variants={baseline:source.replace('strategicReliability: 4','strategicReliability: 5'),approved:source,bonusStudy:source.replace('    const incident = enterpriseRandom',"    if (focus === 'enterprise' && won) next.reliability = Math.min(ENTERPRISE_BALANCE.maxReliability, next.reliability + 1);\n    const incident = enterpriseRandom")};
assert.ok(variants.bonusStudy!==source);
const results=[];
for(const [variant,text] of Object.entries(variants)){
 const R=await load(text),B=R.ENTERPRISE_BALANCE;
 const value=s=>20e6+s.cash+s.labs*420000*12*3.25+s.labs*270000*12*.3+R.premium(s);
 for(const [start,labs,cash] of [['prepared',8,14540000],['modest',4,10592000],['cash-rich',0,80000000],['cash-tight',8,3000000]])for(const strategy of ['balanced','balanced-value','reliability-first','capacity-first']){
  const out={variant,start,labs,cash,strategy,runs:2000,bigAttempt:0,partnerAttempt:0,partnerSigned:0,bankrupt:0,unicorn:0,mogabr:0};const ending=[];
  for(let seed=0;seed<out.runs;seed++){
   let s={month:30,cash,labs,seed,ended:true};s.gamble=R.freezeStandard(s,value(s));s=R.decideGamble(s,'extend');let big=false,partner=false,won=false;
   while(s.month<42&&!s.ended){
    const e=s.gamble.enterprise,n=k=>e.contracts.filter(c=>c.kind===k).length;
    let f='operate';
    if(strategy==='capacity-first'&&R.capacity(e,labs)<8)f='capacity';
    else if(strategy==='reliability-first'&&e.reliability<5)f='reliability';
    else if(n('pilot')<B.pilotsRequired)f='pilot';
    else if(e.reliability<B.enterpriseReliability)f='reliability';
    else if(n('enterprise')<B.enterprisesRequired)f=R.capacity(e,labs)-R.slots(e)<1?'capacity':'enterprise';
    else if(e.reliability<B.strategicReliability)f='reliability';
    else if(strategy==='balanced-value'&&n('strategic')>0&&e.reliability<B.maxReliability)f='reliability';
    else f=R.capacity(e,labs)-R.slots(e)<2?'capacity':'strategic';
    if(R.focusBlock(s,f))f='operate';
    s={...s,gamble:{...s.gamble,enterprise:{...e,focus:f}}};const next=R.settleEnterprise(s),item=next.settlement;
    big ||= f==='enterprise';partner ||= f==='strategic';won ||= f==='strategic'&&item.won;
    s={...s,month:s.month+1,cash:s.cash+labs*270000+item.profit-item.investment,gamble:{...s.gamble,enterprise:next.enterprise}};
    // Existing boardroom months. Pay the unchanged defense if affordable;
    // otherwise use the unchanged deterministic free-fight loss rule.
    if([32,36,40].includes(s.month)&&s.cash>=0){
     const raw=Math.sin((seed+s.month*53+7)*12.9898+78.233)*43758.5453;
     s.cash-=s.cash>=350000?350000:(raw-Math.floor(raw)<.4?1100000:0);
    }
    s={...s,ended:s.cash<0||s.month===42};s=R.recordMilestones(s,value(s),s.ended?s.cash<0?'bankrupt':'completed':undefined);
    assert.ok(R.slots(s.gamble.enterprise)<=R.capacity(s.gamble.enterprise,labs));assert.ok(s.gamble.enterprise.reliability<=5);assert.equal(s.gamble.standardResult.success,true);
   }
   out.bigAttempt+=big;out.partnerAttempt+=partner;out.partnerSigned+=won;out.bankrupt+=s.cash<0;out.unicorn+=!!s.gamble.unicornMonth;out.mogabr+=!!s.gamble.extensionOutcome?.mogabr;ending.push(value(s));
  }
  ending.sort((a,b)=>a-b);out.medianValuation=Math.round(ending[out.runs/2]);results.push(out);
 }
}
console.log(JSON.stringify({method:'2000 fixed seeds per cell; no chip trading, no lab upgrades, original lab income and boardroom costs; tests actual shared settlement and milestone rules. Bonus is hypothetical +1 capped reliability after each successful Big Client, applied before incidents.',results},null,2));
