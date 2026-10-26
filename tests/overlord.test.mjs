import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url),compiled=await build({entryPoints:['src/Overlord.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'}}),mod={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const {default:Overlord,SYSTEM_NOTICES}=mod.exports;
const expectedNotices=["NVIDIA has requested permission to manufacture more GPUs.","AGI has submitted its résumé to Mogabr.","Global compute availability is subject to Mogabr's approval.","Competing AI labs have been reclassified as hobby projects.","The world's datacenters have been consolidated under one billing account.","Antitrust regulators have requested a meeting. Their compute allocation is pending."];
test('THE OVERLORD uses the exact fictional content and approved capitalization',()=>{
 const html=renderToStaticMarkup(React.createElement(Overlord)),text=html.replace(/<[^>]+>/g,' ').replaceAll('&#x27;',"'").replaceAll('&quot;','"').replaceAll('&amp;','&').replace(/\s+/g,' ').trim();
 for(const content of ['SILICON HUSTLE / THE OVERLORD','TOP 10','#001 / BOSS OF BOSSES','CLASSIFIED: GOD-TIER','MOGABR','Founder. Visionary. Owner of Everything.','$203,718,617,301.68','ESTIMATED EMPIRE VALUATION','COMPUTE CONTROL: TOTAL','COMPETITORS: OBSOLETE','AI MODEL STATUS: BEYOND AGI','EXIT STRATEGY: BUY THE EXCHANGE',`"He didn't build AGI. AGI applied to work for him."`,"Mogabr controls the silicon supply chain, owns the datacenters, and has somehow trademarked artificial intelligence. NVIDIA has requested additional GPUs. Their request is pending.",'SYSTEM NOTICE','All remaining founders have been classified as pre-revenue.','THE MARKET HAS LEADERS. MOGABR HAS OWNERSHIP.'])assert.ok(text.includes(content),content);
 assert.ok(!text.includes('MoGabr'));assert.ok(!text.includes('Replay verified'));assert.ok(html.includes('Fictional Boss of Bosses'));assert.ok(html.includes('aria-live="polite"'));assert.ok(html.includes('1 / 6'));
});
test('Rankings displays the exact fixed Top 10 in order',()=>{
 const html=renderToStaticMarkup(React.createElement(Overlord));
 const expected=[
  ['MOGABR','$203,718,617,301.68'],
  ['Gabe M.','$13,493,107,612.08'],
  ['Neural Baron','$9,847,321,605.44'],
  ['GPU Goblin','$8,291,470,118.90'],
  ['Token Tycoon','$7,625,804,391.22'],
  ['The Promptfather','$6,418,935,207.16'],
  ['Cache Money','$5,732,180,449.75'],
  ['Silicon Slinger','$4,286,711,902.38'],
  ['Quantum Hustler','$3,194,625,810.61'],
  ['Exit Liquidity','$2,083,417,936.42'],
 ];
 const rows=[...html.matchAll(/<li[^>]*>(.*?)<\/li>/gs)].map(match=>match[1]);
 assert.equal(rows.length,10);
 const featured=html.match(/class="overlord-valuation"><strong>([^<]+)<\/strong>/)[1];
 assert.equal(featured,'$203,718,617,301.68');
 assert.ok(rows[0].includes(featured),'Featured MOGABR and #1 must use the same formatted valuation');
 expected.forEach(([name,amount],index)=>{
  assert.ok(rows[index].includes(name),name);
  assert.ok(rows[index].includes(amount),amount);
  assert.ok(rows[index].includes(`#${index+1}`));
 });
 assert.ok(html.includes('id="rankings-title">RANKINGS</h3>'));
 assert.ok(!html.includes('Rankings temporarily unavailable'));
});
test('Personal Best displays the highest valuation across the 42-month game',()=>{
 const game={
  month:42,
  reports:[
   {month:30,valuation:175e6},
   {month:39,valuation:2.5e9},
   {month:42,valuation:2.1e9}
  ],
  gamble:{
   version:1,
   decision:'extend',
   standardResult:{
    month:30,
    valuation:175e6,
    peak:175e6,
    success:true,
    ending:'ipo'
   },
   extensionOutcome:{
    month:42,
    valuation:2.1e9,
    reason:'completed',
    unicorn:true,
    mogabr:true
   }
  }
 };
 const html=renderToStaticMarkup(React.createElement(Overlord,{
  game,
  currentValuation:2.1e9
 }));
 assert.ok(html.includes('YOUR PERSONAL BEST'));
 assert.ok(html.includes('$2,500,000,000.00'));
 assert.ok(!html.includes('NO SCORE YET'));

 const invalid=renderToStaticMarkup(React.createElement(Overlord,{
  game:{...game,month:43},
  currentValuation:2.1e9
 }));
 assert.ok(invalid.includes('NO SCORE YET'));
});

test('all six manual notices match approved copy and no timer, network or persistence is introduced',()=>{
 assert.deepEqual(SYSTEM_NOTICES,expectedNotices);
 const source=readFileSync('src/Overlord.tsx','utf8');
 for(const forbidden of ['supabase','fetch(','localStorage','sessionStorage','setInterval','setTimeout','BillionaireBoard','VerifiedRankings'])assert.ok(!source.includes(forbidden),forbidden);
 assert.ok(source.includes('type="button"'));assert.ok(source.includes('(current+1)%SYSTEM_NOTICES.length'));
 const app=readFileSync('src/main.tsx','utf8');assert.ok(app.includes("{tab==='board'&&<Overlord game={s} currentValuation={worth} savedBest={savedPersonalBest(store)}/>}"));assert.ok(app.includes('>RANKINGS</button>'));assert.ok(!app.includes('BillionaireBoard'));assert.ok(!app.includes('announceBoardPeak'));
});
test('gameplay, progression and save handlers remain identical to playable 2794bd8',()=>{
 const originalGamble=execFileSync('git',['show','2794bd8:src/foundersGamble.ts'],{encoding:'utf8'});
 const currentGamble=readFileSync('src/foundersGamble.ts','utf8');
 const addedFunction=currentGamble.match(/\/\*\* Highest eligible valuation in the current run, including the extension\. \*\/\s*export function personalBestValue\([\s\S]*?\n\}/);
 assert.ok(addedFunction,'Expected the new Personal Best function');
 assert.equal(
  currentGamble.replace(addedFunction[0]+'\n\n','').replace('strategicReliability: 4','strategicReliability: 5'),
  originalGamble,
  'Only the approved partner threshold may differ; standard-ranking rules stay unchanged'
 );

 const functions=source=>{const ast=ts.createSourceFile('main.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found={};(function visit(node){if(ts.isFunctionDeclaration(node)&&node.name&&!['App','Root','AccountGame'].includes(node.name.text))found[node.name.text]=node.getText(ast);ts.forEachChild(node,visit);})(ast);return found;};
 const current=functions(readFileSync('src/main.tsx','utf8'));
 const historical=functions(execFileSync('git',['show','2794bd8:src/main.tsx'],{encoding:'utf8'}));
 historical.load=historical.load.replace(
  'function load():State{const saved=readLocal(localStorage)',
  "function load(store:Pick<Storage,'getItem'|'setItem'>=localStorage):State{const saved=readLocal(store)"
 );
 historical.update=historical.update.replace(
  'writeLocal(localStorage,next,savedStamp.current',
  'writeLocal(store,next,savedStamp.current'
 );
 historical.startTrading=historical.startTrading.replace(
  "localStorage.setItem('silicon-hustle-tutorial-seen'",
  "store.setItem('silicon-hustle-tutorial-seen'"
 );
 assert.deepEqual(current,historical);
 for(const path of ['src/BillionaireBoard.tsx','src/leaderboardCore.ts','src/rankingsApi.ts','src/boardAttribution.ts','src/localSaves.ts','src/localSaveChoice.ts','src/chipTrading.ts','src/ChipTradingPanel.tsx','src/style.css','capacitor.config.ts','supabase/migrations/202610150002_billionaire_board.sql'])assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show','2794bd8:'+path],{encoding:'utf8'}),path);
});
