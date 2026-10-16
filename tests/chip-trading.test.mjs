import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/chipTrading.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
const {monthlyChange,maxBuyQuantity,positionMetrics,reliablePosition,chipCode,ORDER_LIMIT}=await import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
test('monthly movement uses the previous price only for the matching month',()=>{
 assert.deepEqual(monthlyChange(3,'h100',110,{forMonth:3,prices:{h100:100}}),{previous:100,dollars:10,percent:10});
 assert.deepEqual(monthlyChange(3,'h100',90,{forMonth:3,prices:{h100:100}}),{previous:100,dollars:-10,percent:-10});
 assert.deepEqual(monthlyChange(3,'h100',100,{forMonth:3,prices:{h100:100}}),{previous:100,dollars:0,percent:0});
});
test('legacy, first-month and stale historical data are unavailable, never reconstructed',()=>{for(const history of [undefined,null,{},[],{forMonth:2,prices:{h100:100}},{forMonth:3,prices:{}},{forMonth:3,prices:{h100:0}},{forMonth:3,prices:{h100:Infinity}},{forMonth:3,prices:{h100:'100'}}])assert.equal(monthlyChange(3,'h100',110,history),null);assert.equal(monthlyChange(1,'h100',110,{forMonth:1,prices:{h100:100}}),null);});
test('position metrics retain purchase fees and fee-aware liquidation rounding',()=>{const m=positionMetrics(110,{qty:10,cost:1010},.01);assert.equal(m.average,101);assert.equal(m.marketValue,1100);assert.equal(m.profit,79);assert.equal(m.percent,79/1010*100);assert.equal(positionMetrics(1.005,{qty:1,cost:1},.01).profit,Math.round(1.005*.99)-1);});
test('empty, unknown and zero cost positions avoid invented averages or infinite percentages',()=>{assert.equal(positionMetrics(100,{qty:0,cost:0},.01).average,null);assert.equal(positionMetrics(100,{qty:2},.01).profit,null);assert.equal(positionMetrics(100,{qty:2,cost:0},.01).percent,null);assert.equal(positionMetrics(100,{qty:2,cost:0},.01).profit,198);});
test('malformed positions cannot enable an order',()=>{for(const p of [{qty:-1,cost:1},{qty:1.5,cost:1},{qty:1,cost:NaN},{qty:1},{qty:1,cost:-1},{qty:Infinity,cost:0}])assert.equal(reliablePosition(p),false);assert.equal(reliablePosition({qty:0,cost:0}),true);});
test('MAX follows rounded affordability at exact and fractional cash boundaries',()=>{for(const price of [.51,1,9.5,34000,56000])for(const target of [1,2,17,998]){const cash=Math.round(target*price*1.01);const q=maxBuyQuantity(cash,price,.01);assert.ok(Math.round(q*price*1.01)<=cash);assert.ok(q===ORDER_LIMIT||Math.round((q+1)*price*1.01)>cash);}assert.equal(maxBuyQuantity(34339,34000,.01),0);assert.equal(maxBuyQuantity(34340,34000,.01),1);});
test('MAX respects the existing 999 cap and rejects invalid prices/cash',()=>{assert.equal(maxBuyQuantity(1e12,1,.01),999);for(const [cash,price] of [[-1,1],[NaN,1],[Infinity,1],[100,0],[100,-1],[100,NaN]])assert.equal(maxBuyQuantity(cash,price,.01),0);});
test('hardware codes reflect chip models',()=>{assert.equal(chipCode('h100'),'H100');assert.equal(chipCode('mi300'),'MI300X');assert.equal(chipCode('mi325'),'MI325X');assert.equal(chipCode('gaudi'),'GAUDI 3');});
