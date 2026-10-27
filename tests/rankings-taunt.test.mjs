import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const compiled=await build({stdin:{contents:`export * from './src/rankingsTaunt';export * from './src/rankingsProfile';export * from './src/fixedRankings';export {default as Overlord} from './src/Overlord';`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'}});
const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {personalBestTaunt,personalizedRankings,FIXED_RANKINGS,Overlord}=mod.exports;
const text={
 none:"You haven't built an empire. You've barely opened the spreadsheet. Welcome to Silicon Hustle.",
 small:"You're calling this a startup? Your investors are calling it a tax write-off.",
 millions:"You built a hundred-million-dollar company. Unfortunately, nobody here is impressed by millions.",
 billions:"You built a billion-dollar company and still didn't crack the Top 10. Welcome to Silicon Hustle.",
 low:"Congratulations, you made the Top 10. You're also one bad quarter away from being forgotten.",
 middle:"You're climbing the rankings. Your investors are already asking why you're not higher.",
 third:"Third place. Two people still own the room, and you're paying for the coffee.",
 gabe:"You're worth more than Gabe M. He's still #2. Welcome to corporate governance.",
 mogabr:"You outvalued MOGABR. He's still #1. You thought this was a democracy?"
};
const actual=value=>{const rows=personalizedRankings(value);return personalBestTaunt(value,rows.find(x=>x.player)?.rank);};
test('all nine approved messages match exact copy using actual ranking positions',()=>{
 for(const [value,key] of [[null,'none'],[25e6,'small'],[100e6,'millions'],[1e9,'billions'],[2.1e9,'low'],[6.5e9,'middle'],[10e9,'third'],[14e9,'gabe'],[204e9,'mogabr']])assert.equal(actual(value),text[key]);
});
test('valuation boundaries are strict and no eligible zero is confused with no record',()=>{
 assert.equal(actual(0),text.small);assert.equal(actual(99999999),text.small);assert.equal(actual(100000000),text.millions);
 assert.equal(actual(999999999),text.millions);assert.equal(actual(1000000000),text.billions);
 assert.equal(actual(FIXED_RANKINGS[1].valuation),text.third);assert.equal(actual(FIXED_RANKINGS[1].valuation+.01),text.gabe);
 assert.equal(actual(FIXED_RANKINGS[0].valuation),text.gabe);assert.equal(actual(FIXED_RANKINGS[0].valuation+.01),text.mogabr);
});
test('each actual rank band uses rank rather than a guessed valuation tier',()=>{
 for(let i=2;i<10;i++){
  const value=Math.ceil(FIXED_RANKINGS[i].valuation),rows=personalizedRankings(value),rank=rows.find(x=>x.player)?.rank;
  assert.equal(rank,i+1);assert.equal(personalBestTaunt(value,rank),rank===3?text.third:rank<=6?text.middle:text.low);
 }
 const threshold=FIXED_RANKINGS[9].valuation;
 assert.equal(personalizedRankings(threshold).find(x=>x.player),undefined);assert.equal(actual(threshold),text.billions);
});
test('boss overrides take priority over rank and invalid/absent records cannot imply a ranking',()=>{
 for(const rank of [undefined,3,5,10]){assert.equal(personalBestTaunt(204e9,rank),text.mogabr);assert.equal(personalBestTaunt(14e9,rank),text.gabe);}
 for(const bad of [null,NaN,Infinity,-1])assert.equal(personalBestTaunt(bad,3),text.none);
 for(const rank of [undefined,0,1,2,11,4.5])assert.equal(personalBestTaunt(1e9,rank),text.billions);
});
test('taunts are deterministic and never mutate rankings, snapshots, preferences or pinned bosses',()=>{
 const before=JSON.stringify(FIXED_RANKINGS);
 for(let i=0;i<30;i++)assert.equal(actual(10e9),text.third);
 assert.equal(JSON.stringify(FIXED_RANKINGS),before);assert.deepEqual(personalizedRankings(204e9).slice(0,2).map(x=>x.name),['MOGABR','Gabe M.']);
});
test('the rendered Personal Best replaces the disclaimer with one accessible exact taunt and leaves YOU unchanged',()=>{
 for(const [value,key] of [[null,'none'],[25e6,'small'],[100e6,'millions'],[1e9,'billions'],[2.1e9,'low'],[6.5e9,'middle'],[10e9,'third'],[14e9,'gabe'],[204e9,'mogabr']]){
  const writes=[],store={getItem:k=>k==='silicon-hustle-personal-best-v1'&&value!==null?JSON.stringify(value):null,setItem:(...args)=>writes.push(args)};
  const html=renderToStaticMarkup(React.createElement(Overlord,{store}));
  const found=html.match(/<p[^>]*data-testid="personal-best-taunt"[^>]*>(.*?)<\/p>/s);
  assert.ok(found);assert.equal(found[1].replaceAll('&#x27;',"'"),text[key]);
  assert.ok(found[0].includes('aria-live="polite"'));assert.equal(html.match(/data-testid="personal-best-taunt"/g).length,1);
  assert.ok(!html.includes('Personalized fictional opponents'));assert.ok(html.includes('overlord-name-row"><b>YOU</b>'));assert.deepEqual(writes,[]);
 }
});
