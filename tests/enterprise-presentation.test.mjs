import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/enterprisePresentation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {enterpriseActions,enterpriseRequirements,enterpriseProgress,minimumEnterpriseMoves,clientSlots,showEnterpriseIntro}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const ruleBuild=await build({entryPoints:['src/foundersGamble.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {freshEnterprise,focusBlock,ENTERPRISE_BALANCE:B}=await import('data:text/javascript;base64,'+Buffer.from(ruleBuild.outputFiles[0].text).toString('base64'));
const company=()=>({month:30,cash:20e6,labs:4,seed:42,ended:false,gamble:{version:1,decision:'extend',enterprise:freshEnterprise(),standardResult:{month:30,valuation:100e6,peak:100e6,success:true,ending:'acquisition'}}});
const action=(c,id)=>enterpriseActions(c).find(a=>a.id===id);
test('all six actions stay visible with readable names and actual cost, gain and bid risk',()=>{
 const c=company();const rows=enterpriseActions(c);
 assert.deepEqual(rows.map(a=>a.title),['LAND A PILOT','LAND BIG CLIENT','SIGN MAJOR PARTNER','EXPAND CAPACITY','IMPROVE RELIABILITY','OPERATE']);
 for(const id of ['pilot','enterprise','strategic']){const rule=B.focuses[id];const row=action(c,id);assert.match(row.description,new RegExp(`${rule.chance*100}% chance`));assert.ok(row.description.includes('Spend $'+rule.cost/1e6+'M'));assert.ok(row.description.includes('+$'+rule.revenue/1e6+'M/month'));}
 assert.equal(action(c,'enterprise').description,'Spend $4M · 65% chance · +$2.5M/month');
 assert.equal(action(c,'strategic').description,'Spend $8M · 30% chance · +$5M/month');
});
test('unlock progress reflects signed contracts and reliability, and clears only when rules allow',()=>{
 const c=company();assert.equal(action(c,'enterprise').lockedCopy,'Pilots 0/2 · Reliability 1/3');assert.equal(action(c,'strategic').lockedCopy,'Big clients 0/2 · Reliability 1/4');
 c.gamble.enterprise.contracts.push({kind:'pilot',month:31});c.gamble.enterprise.reliability=2;
 assert.equal(action(c,'enterprise').lockedCopy,'Pilots 1/2 · Reliability 2/3');
 c.gamble.enterprise.contracts.push({kind:'pilot',month:32});c.gamble.enterprise.reliability=3;
 assert.equal(action(c,'enterprise').disabled,false);assert.equal(action(c,'enterprise').lockedCopy,null);
 c.gamble.enterprise.contracts.push({kind:'enterprise',month:35},{kind:'enterprise',month:36});c.gamble.enterprise.purchasedSlots=4;c.gamble.enterprise.reliability=4;
 assert.equal(action(c,'strategic').lockedCopy,null);assert.equal(action(c,'strategic').disabled,false);
});
test('client slots count infrastructure usage, including two slots per major partner, not customer count',()=>{
 const c=company();assert.equal(clientSlots(c),'0 / 3 slots');c.gamble.enterprise.contracts=[{kind:'pilot',month:31},{kind:'strategic',month:40}];assert.equal(clientSlots(c),'3 / 3 slots');
 c.labs=8;c.gamble.enterprise.purchasedSlots=2;assert.equal(clientSlots(c),'3 / 6 slots');c.gamble.enterprise.purchasedSlots=20;assert.equal(clientSlots(c),'3 / 12 slots');
});
test('cash, slot and maximum-level blockers remain authoritative, with concise UI copy',()=>{
 const c=company();c.cash=1;assert.equal(action(c,'pilot').lockedCopy,'Cash $1 / $2M');
 c.cash=20e6;c.gamble.enterprise.contracts=Array.from({length:3},()=>({kind:'pilot',month:31}));assert.equal(action(c,'pilot').lockedCopy,'Free slots 0/1');
 c.gamble.enterprise.reliability=5;assert.equal(action(c,'reliability').lockedCopy,'Reliability already at maximum 5');
 for(const row of enterpriseActions(c))assert.equal(row.disabled,!!focusBlock(c,row.id));
});
test('operating revenue, incident risk and actual capacity gains update without mutating the game',()=>{
 const c=company();c.gamble.enterprise.contracts=[{kind:'pilot',month:31}];const before=JSON.stringify(c);
 assert.match(action(c,'operate').description,/keep \$1.5M\/month · 18% incident risk/);assert.match(action(c,'reliability').description,/12% incident risk/);assert.equal(JSON.stringify(c),before);
 c.gamble.enterprise.purchasedSlots=8;assert.match(action(c,'capacity').description,/\+1 client slots/);c.gamble.enterprise.reliability=4;assert.match(action(c,'reliability').description,/2% incident risk/);
});

test('major partners explain their two-slot requirement even when one slot is free',()=>{const c=company();c.labs=8;const e=c.gamble.enterprise;e.reliability=5;e.contracts=[{kind:'pilot',month:31},{kind:'pilot',month:32},{kind:'enterprise',month:35},{kind:'enterprise',month:36}];e.purchasedSlots=1;assert.equal(clientSlots(c),'4 / 5 slots');assert.equal(action(c,'strategic').lockedCopy,'Free slots 1/2');assert.equal(action(c,'strategic').disabled,true);});

test('extension introduction is derived only from the opening saved planning phase',()=>{
 const c=company();const before=JSON.stringify(c);
 assert.equal(showEnterpriseIntro(c),true);assert.equal(showEnterpriseIntro(JSON.parse(before)),true);assert.equal(JSON.stringify(c),before);
 for(const month of [1,29,31,35,42])assert.equal(showEnterpriseIntro({...c,month}),false);
 for(const decision of ['pending','exit'])assert.equal(showEnterpriseIntro({...c,gamble:{...c.gamble,decision}}),false);
 assert.equal(showEnterpriseIntro({...c,ended:true}),false);assert.equal(showEnterpriseIntro({...c,gamble:undefined}),false);
 assert.equal(showEnterpriseIntro({...c,gamble:{...c.gamble,enterprise:{...c.gamble.enterprise,ledger:[{month:31}]}}}),false);
});

test('all unmet blockers remain visible together, with no state changes',()=>{
 const c=company();c.cash=1;c.labs=0;c.gamble.enterprise.contracts=[{kind:'pilot',month:31}];c.gamble.enterprise.purchasedSlots=0;
 const before=JSON.stringify(c);const row=action(c,'strategic');
 for(const expected of ['Big clients 0/2','Reliability 1/4','Cash $1 / $8M','Free slots 1/2'])assert.ok(row.lockedCopy.includes(expected),expected);
 assert.equal(row.disabled,true);assert.equal(JSON.stringify(c),before);
 c.gamble.enterprise.contracts.push({kind:'pilot',month:32});assert.ok(action(c,'enterprise').lockedCopy.includes('Free slots 0/1'));assert.ok(action(c,'enterprise').lockedCopy.includes('Cash $1 / $4M'));assert.ok(action(c,'enterprise').lockedCopy.includes('Reliability 1/3'));
});
test('progress tracks contracts and met and unmet prerequisites, including legacy reliability five',()=>{
 const c=company();let progress=enterpriseProgress(c);assert.deepEqual(progress.map(x=>x.title),['Pilot','Big Client','Major Partner']);assert.ok(progress.every(x=>!x.complete));
 c.gamble.enterprise.contracts=[{kind:'pilot',month:31},{kind:'pilot',month:32}];c.gamble.enterprise.reliability=3;
 progress=enterpriseProgress(c);assert.equal(progress[0].complete,true);assert.equal(progress[1].requirements.find(x=>x.key==='reliability').met,true);assert.equal(progress[2].requirements.find(x=>x.key==='reliability').met,false);
 c.gamble.enterprise.contracts.push({kind:'enterprise',month:35},{kind:'enterprise',month:36});c.gamble.enterprise.purchasedSlots=4;
 for(const reliability of [4,5]){c.gamble.enterprise.reliability=reliability;assert.equal(action(c,'strategic').disabled,false);}
 c.gamble.enterprise.contracts.push({kind:'strategic',month:40});assert.ok(enterpriseProgress(c).every(x=>x.complete));
});
test('minimum moves include prerequisites, capacity and the final attempt without double-counting',()=>{
 const c=company();assert.equal(minimumEnterpriseMoves(c,'enterprise'),5);assert.equal(minimumEnterpriseMoves(c,'strategic'),9);
 c.gamble.enterprise.contracts=[{kind:'pilot',month:31},{kind:'pilot',month:32}];c.gamble.enterprise.purchasedSlots=4;c.month=39;
 assert.equal(minimumEnterpriseMoves(c,'strategic'),6);assert.match(action(c,'strategic').warning,/at least 6 moves needed, 3 left/);
 assert.equal(minimumEnterpriseMoves(c,'enterprise'),3);assert.equal(action(c,'enterprise').warning,null);
 c.month=40;assert.match(action(c,'enterprise').warning,/3 moves needed, 2 left/);
 c.month=41;c.gamble.enterprise.reliability=3;assert.equal(action(c,'enterprise').warning,null);
 c.month=42;c.ended=true;assert.equal(action(c,'enterprise').warning,null);assert.match(action(c,'enterprise').lockedCopy,/Chapter closed/);
});
test('optimistic warnings allow existing lab upgrades without spending a monthly move',()=>{
 const c=company();c.labs=0;c.month=37;c.gamble.enterprise.reliability=4;c.gamble.enterprise.contracts=[{kind:'pilot',month:31},{kind:'pilot',month:32}];
 assert.equal(minimumEnterpriseMoves(c,'strategic'),4);assert.equal(action(c,'strategic').warning,null);
 c.gamble.enterprise.contracts=Array.from({length:12},()=>({kind:'pilot',month:31}));assert.equal(minimumEnterpriseMoves(c,'strategic'),Infinity);assert.match(action(c,'strategic').warning,/maximum client capacity/);
});
