import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const base='1fa23be';
const previous=path=>execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8'});
test('Founders UI revision preserves all economics, save, achievement, authentication and Rankings rules',()=>{
 for(const path of ['src/foundersGamble.ts','src/BillionaireBoard.tsx','src/boardAttribution.ts','src/leaderboardCore.ts','src/AuthGate.tsx','src/rankingsApi.ts','src/ChipTradingPanel.tsx','src/chipTrading.ts','capacitor.config.ts','src/style.css'])assert.equal(readFileSync(path,'utf8'),previous(path),path);
 const functions=text=>{const ast=ts.createSourceFile('main.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const out={};const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name&&n.name.text!=='App')out[n.name.text]=n.getText(ast);if(ts.isTypeAliasDeclaration(n)&&['State','Report'].includes(n.name.text))out[n.name.text]=n.getText(ast);ts.forEachChild(n,visit);};visit(ast);return out;};
 assert.deepEqual(functions(readFileSync('src/main.tsx','utf8')),functions(previous('src/main.tsx')));
});
test('native overlay geometry reserves outer safe areas rather than padding oversized content',()=>{
 const css=readFileSync('src/founders-gamble.css','utf8');assert.match(css,/env\(safe-area-inset-top/);assert.match(css,/env\(safe-area-inset-bottom/);assert.match(css,/100dvh - var\(--sh-safe-top\) - var\(--sh-safe-bottom\)/);assert.match(readFileSync('index.html','utf8'),/viewport-fit=cover/);
});
