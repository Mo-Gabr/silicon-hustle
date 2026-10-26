import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const base='1fa23be';
const previous=path=>execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8'});
const protectedRead=f=>{
 const s=readFileSync(f,'utf8');
 if(f!=='src/foundersGamble.ts')return s;
 const a=s.indexOf('/** Highest eligible valuation in the current run');
 const b=s.indexOf('\n}\n\n',a);
 if(a<0||b<0)throw Error('Personal Best function missing');
 const allowed = s.slice(0,a)+s.slice(b+4);
 assert.ok(allowed.includes('strategicReliability: 4'),'Only the approved Major Partner threshold changes');
 return allowed.replace('strategicReliability: 4','strategicReliability: 5');
};

test('Founders revision permits only the approved partner threshold and preserves other economics and gameplay',()=>{
 for(const path of ['src/foundersGamble.ts','src/boardAttribution.ts','src/leaderboardCore.ts','src/rankingsApi.ts','src/ChipTradingPanel.tsx','src/chipTrading.ts','capacitor.config.ts','src/style.css'])assert.equal(protectedRead(path),previous(path),path);
 const functions=text=>{const ast=ts.createSourceFile('main.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const out={};const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name&&!['App','Root','AccountGame','load','update','reset'].includes(n.name.text))out[n.name.text]=n.getText(ast);if(ts.isTypeAliasDeclaration(n)&&['State','Report'].includes(n.name.text))out[n.name.text]=n.getText(ast);ts.forEachChild(n,visit);};visit(ast);return out;};
 const now=functions(readFileSync('src/main.tsx','utf8'));
 const old=functions(previous('src/main.tsx'));
 if(old.startTrading)old.startTrading=old.startTrading.replace("localStorage.setItem('silicon-hustle-tutorial-seen'","store.setItem('silicon-hustle-tutorial-seen'");
 assert.deepEqual(now,old);
});
test('native overlay geometry reserves outer safe areas rather than padding oversized content',()=>{
 const css=readFileSync('src/founders-gamble.css','utf8');assert.match(css,/env\(safe-area-inset-top/);assert.match(css,/env\(safe-area-inset-bottom/);assert.match(css,/100dvh - var\(--sh-safe-top\) - var\(--sh-safe-bottom\)/);assert.match(readFileSync('index.html','utf8'),/viewport-fit=cover/);
});
