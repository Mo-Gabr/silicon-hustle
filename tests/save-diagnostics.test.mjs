import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64');
const local=url(readFileSync('src/localSaves.ts','utf8')),rules=url(readFileSync('src/foundersGamble.ts','utf8'));
const code=readFileSync('src/saveDiagnostics.ts','utf8').replace("'./localSaves'",JSON.stringify(local)).replace("'./foundersGamble'",JSON.stringify(rules));
const {inspectSaves,diagnosticSummary}=await import(url(code));
const keys=['silicon-hustle-local-v1','silicon-hustle-v04','compute-empire-v04','silicon-hustle-local-originals-v1'];
const game=patch=>({month:22,cash:5e6,labs:0,seed:42,ended:false,prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{},...patch});
function reader(data){const calls=[];return {calls,getItem(k){calls.push(k);assert.ok(keys.includes(k));return data[k]??null;},setItem(){assert.fail('No writes allowed');},removeItem(){assert.fail('No deletion allowed');}};}
test('reads exactly the four approved keys; empty inspection never creates a save',()=>{const s=reader({}),rows=inspectSaves(s);assert.deepEqual(s.calls,keys);assert.ok(rows.every(r=>r.presence==='Absent'));});
test('exposes a new Month1 save shadowing valid historical progress without changing either',()=>{const data={[keys[0]]:JSON.stringify(game({month:1})),[keys[1]]:JSON.stringify(game())},before=JSON.stringify(data),rows=inspectSaves(reader(data));assert.equal(rows[0].selected,true);assert.equal(rows[1].selected,false);assert.equal(rows[1].month,22);assert.equal(rows[1].valuation,25e6);assert.equal(rows[1].version,'Not recorded');assert.equal(JSON.stringify(data),before);});
test('invalid active save remains selected by priority and older valid snapshot is still inspected',()=>{const rows=inspectSaves(reader({[keys[0]]:'{bad',[keys[1]]:JSON.stringify(game())}));assert.equal(rows[0].selected,true);assert.equal(rows[0].validation,'Unreadable JSON');assert.equal(rows[1].validation,'Valid for current client');});
test('archives are summarized individually with no raw contents or arbitrary names exposed',()=>{const raw=JSON.stringify(game({founderName:'PRIVATE-NAME',gameVersion:'0.9.0',note:'SECRET'}));const rows=inspectSaves(reader({[keys[3]]:JSON.stringify([{key:keys[1],raw}])})),summary=diagnosticSummary(rows);assert.equal(rows[4].month,22);assert.equal(rows[4].version,'0.9.0');assert.ok(!summary.includes('PRIVATE-NAME'));assert.ok(!summary.includes('SECRET'));assert.ok(!summary.includes('prices'));assert.equal(rows[4].selected,false);});
test('unsupported snapshots show available month without pretending valuation is known',()=>{const rows=inspectSaves(reader({[keys[2]]:JSON.stringify({month:12,version:'SECRET'})}));assert.equal(rows[2].month,12);assert.equal(rows[2].valuation,null);assert.equal(rows[2].version,'Not recorded');assert.match(rows[2].validation,/Unsupported/);});
test('storage and archive errors remain sanitized and never imply successful selection',()=>{const rows=inspectSaves({getItem(){throw Error('PRIVATE');}});assert.ok(rows.every(r=>!r.selected));assert.ok(!diagnosticSummary(rows).includes('PRIVATE'));assert.match(inspectSaves(reader({[keys[3]]:'bad'}))[3].validation,/Unreadable/);});
test('no diagnostic startup pause or account entry remains in the playable build',()=>{
 const main=readFileSync('src/main.tsx','utf8'),auth=readFileSync('src/AuthGate.tsx','utf8');
 assert.ok(!main.includes('SAVE_DIAGNOSTIC_BUILD'));assert.ok(!main.includes('SAVE INSPECTION BUILD'));assert.ok(!auth.includes('SaveDiagnostics'));assert.ok(main.includes('<App key={version} resumeDashboard={resumeDashboard}/>'));
});
