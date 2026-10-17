import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/enterprisePresentation.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {enterpriseActions,clientSlots}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
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
 const c=company();assert.equal(action(c,'enterprise').lockedCopy,'Unlock: Pilots 0/2 · Reliability 1/3');assert.equal(action(c,'strategic').lockedCopy,'Unlock: Big clients 0/2 · Reliability 1/5');
 c.gamble.enterprise.contracts.push({kind:'pilot',month:31});c.gamble.enterprise.reliability=2;
 assert.equal(action(c,'enterprise').lockedCopy,'Unlock: Pilots 1/2 · Reliability 2/3');
 c.gamble.enterprise.contracts.push({kind:'pilot',month:32});c.gamble.enterprise.reliability=3;
 assert.equal(action(c,'enterprise').disabled,false);assert.equal(action(c,'enterprise').lockedCopy,null);
 c.gamble.enterprise.contracts.push({kind:'enterprise',month:35},{kind:'enterprise',month:36});c.gamble.enterprise.purchasedSlots=4;c.gamble.enterprise.reliability=4;
 assert.equal(action(c,'strategic').lockedCopy,'Unlock: Big clients 2/2 · Reliability 4/5');c.gamble.enterprise.reliability=5;assert.equal(action(c,'strategic').disabled,false);
});
test('client slots count infrastructure usage, including two slots per major partner, not customer count',()=>{
 const c=company();assert.equal(clientSlots(c),'0 / 3 slots');c.gamble.enterprise.contracts=[{kind:'pilot',month:31},{kind:'strategic',month:40}];assert.equal(clientSlots(c),'3 / 3 slots');
 c.labs=8;c.gamble.enterprise.purchasedSlots=2;assert.equal(clientSlots(c),'3 / 6 slots');c.gamble.enterprise.purchasedSlots=20;assert.equal(clientSlots(c),'3 / 12 slots');
});
test('cash, slot and maximum-level blockers remain authoritative, with concise UI copy',()=>{
 const c=company();c.cash=1;assert.equal(action(c,'pilot').lockedCopy,'Not enough cash');
 c.cash=20e6;c.gamble.enterprise.contracts=Array.from({length:3},()=>({kind:'pilot',month:31}));assert.equal(action(c,'pilot').lockedCopy,'Need 1 free client slot');
 c.gamble.enterprise.reliability=5;assert.equal(action(c,'reliability').lockedCopy,'Already at maximum');
 for(const row of enterpriseActions(c))assert.equal(row.disabled,!!focusBlock(c,row.id));
});
test('operating revenue, incident risk and actual capacity gains update without mutating the game',()=>{
 const c=company();c.gamble.enterprise.contracts=[{kind:'pilot',month:31}];const before=JSON.stringify(c);
 assert.match(action(c,'operate').description,/keep \$1.5M\/month · 18% incident risk/);assert.match(action(c,'reliability').description,/12% incident risk/);assert.equal(JSON.stringify(c),before);
 c.gamble.enterprise.purchasedSlots=8;assert.match(action(c,'capacity').description,/\+1 client slots/);c.gamble.enterprise.reliability=4;assert.match(action(c,'reliability').description,/2% incident risk/);
});

test('major partners explain their two-slot requirement even when one slot is free',()=>{const c=company();c.labs=8;const e=c.gamble.enterprise;e.reliability=5;e.contracts=[{kind:'pilot',month:31},{kind:'pilot',month:32},{kind:'enterprise',month:35},{kind:'enterprise',month:36}];e.purchasedSlots=1;assert.equal(clientSlots(c),'4 / 5 slots');assert.equal(action(c,'strategic').lockedCopy,'Need 2 free client slots');assert.equal(action(c,'strategic').disabled,true);});
