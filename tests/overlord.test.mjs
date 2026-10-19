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
 for(const content of ['SILICON HUSTLE / THE OVERLORD','COMING SOON','#001 / BOSS OF BOSSES','CLASSIFIED: GOD-TIER','MOGABR','Founder. Visionary. Owner of Everything.','$999,999,999,999,999.99','ESTIMATED EMPIRE VALUATION','COMPUTE CONTROL: TOTAL','COMPETITORS: OBSOLETE','AI MODEL STATUS: BEYOND AGI','EXIT STRATEGY: BUY THE EXCHANGE',`"He didn't build AGI. AGI applied to work for him."`,"Mogabr controls the silicon supply chain, owns the datacenters, and has somehow trademarked artificial intelligence. NVIDIA has requested additional GPUs. Their request is pending.",'SYSTEM NOTICE','Rankings temporarily unavailable. All remaining founders have been classified as pre-revenue.','THE MARKET HAS LEADERS. MOGABR HAS OWNERSHIP.'])assert.ok(text.includes(content),content);
 assert.ok(!text.includes('MoGabr'));assert.ok(!text.includes('Replay verified'));assert.ok(html.includes('Fictional Boss of Bosses'));assert.ok(html.includes('aria-live="polite"'));assert.ok(html.includes('1 / 6'));
});
test('all six manual notices match approved copy and no timer, network or persistence is introduced',()=>{
 assert.deepEqual(SYSTEM_NOTICES,expectedNotices);
 const source=readFileSync('src/Overlord.tsx','utf8');
 for(const forbidden of ['supabase','fetch(','localStorage','sessionStorage','setInterval','setTimeout','BillionaireBoard','VerifiedRankings'])assert.ok(!source.includes(forbidden),forbidden);
 assert.ok(source.includes('type="button"'));assert.ok(source.includes('(current+1)%SYSTEM_NOTICES.length'));
 const app=readFileSync('src/main.tsx','utf8');assert.ok(app.includes("{tab==='board'&&<Overlord/>}"));assert.ok(app.includes('>RANKINGS</button>'));assert.ok(!app.includes('BillionaireBoard'));assert.ok(!app.includes('announceBoardPeak'));
});
test('gameplay, progression and save handlers remain identical to playable 2794bd8',()=>{
 const functions=source=>{const ast=ts.createSourceFile('main.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found={};(function visit(node){if(ts.isFunctionDeclaration(node)&&node.name&&!['App','Root'].includes(node.name.text))found[node.name.text]=node.getText(ast);ts.forEachChild(node,visit);})(ast);return found;};
 assert.deepEqual(functions(readFileSync('src/main.tsx','utf8')),functions(execFileSync('git',['show','2794bd8:src/main.tsx'],{encoding:'utf8'})));
 for(const path of ['src/BillionaireBoard.tsx','src/leaderboardCore.ts','src/rankingsApi.ts','src/boardAttribution.ts','src/localSaves.ts','src/localSaveChoice.ts','src/SaveChoicePanel.tsx','src/LocalRecovery.tsx','src/AuthGate.tsx','src/foundersGamble.ts','src/EnterprisePanel.tsx','src/chipTrading.ts','src/ChipTradingPanel.tsx','src/style.css','capacitor.config.ts','supabase/migrations/202610150002_billionaire_board.sql'])assert.equal(readFileSync(path,'utf8'),execFileSync('git',['show','2794bd8:'+path],{encoding:'utf8'}),path);
});
