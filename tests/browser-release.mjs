// Offline end-to-end proof: fresh Chrome profile, synthetic SDK sessions,
// .test project, DNS blocked and every HTTPS request intercepted before dispatch.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
const chrome=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base='62aa1706d2f5bfb97b56483fda4c1cf0d656f53d';
const uid='00000000-0000-4000-8000-000000000101';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',created_at:'2026-01-01T00:00:00Z'};
const game=()=>({month:3,cash:5000000,prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{},labs:0,headline:'SYNTHETIC ONLY',history:[],ended:false,ending:'',seed:42,threat:null,threatHistory:[],crisisResult:null});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let available=true;try{await access(chrome);}catch{available=false;}
test('offline browser: gameplay/cloud-save parity with main plus isolated board flows',{skip:!available?'Chrome not installed; set CHROME_BIN':false,timeout:60000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'silicon-board-release-browser-'));
 for(const variant of ['main','release']){
  await build({entryPoints:['src/main.tsx'],bundle:true,format:'esm',outdir:join(root,variant),entryNames:'app',jsx:'automatic',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://supabase.test'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('sb_publishable_SYNTHETIC_ONLY')},plugins:variant==='main'?[{name:'baseline-main',setup(b){b.onLoad({filter:/\/src\/main\.tsx$/},()=>({contents:execFileSync('git',['show',base+':src/main.tsx'],{encoding:'utf8'}),loader:'tsx'}));}}]:[]});
 }
 const server=http.createServer(async(req,res)=>{const m=req.url.match(/^\/(main|release)\/(app\.(?:js|css))$/);if(m){res.setHeader('Content-Type',m[2].endsWith('js')?'text/javascript':'text/css');res.end(await readFile(join(root,m[1],m[2])));return;}if(/^\/(main|release)\/$/.test(req.url)){const v=req.url.split('/')[1];res.setHeader('Content-Type','text/html');res.end(`<div id="root"></div><link rel="stylesheet" href="/${v}/app.css"><script type="module" src="/${v}/app.js"></script>`);return;}res.writeHead(404);res.end();});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const profile=join(root,'fresh-profile');
 const child=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  let port,route;for(let i=0;i<70;i++){try{[port,route]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
  assert.ok(port,'Chrome unavailable');ws=new WebSocket(`ws://127.0.0.1:${port}${route}`);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let seq=0;const pending=new Map(),states=new Map();
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
  ws.onmessage=async e=>{
   const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}return;}
   const state=states.get(m.sessionId);if(!state)return;
   if(m.method==='Runtime.exceptionThrown')state.errors.push('runtime exception');
   if(m.method!=='Fetch.requestPaused')return;
   const {requestId,request}=m.params,url=new URL(request.url);
   if(url.protocol!=='https:'){await send('Fetch.continueRequest',{requestId},m.sessionId);return;}
   let body=null,status=200;
   try{
    assert.equal(url.origin,'https://supabase.test');
    if(request.method==='OPTIONS')body={};
    else if(url.pathname==='/auth/v1/user'){body=user;}
    else if(url.pathname==='/rest/v1/game_saves'){
     const payload=request.postData?JSON.parse(request.postData):null;
     state.saves.push({method:request.method,owner:url.searchParams.get('user_id'),payload:payload?{user_id:payload.user_id,game_state:payload.game_state}:null});
     if(request.method==='GET')body=state.row;
     else if(request.method==='POST'){assert.equal(payload.user_id,uid);assert.equal(state.row,null);state.row={...payload};body={updated_at:state.row.updated_at};}
     else if(request.method==='PATCH'){assert.equal(url.searchParams.get('updated_at'),'eq.'+state.row.updated_at);state.row={...state.row,...payload};body={updated_at:state.row.updated_at};}
     else throw Error('Unexpected save method');
    }else if(url.pathname==='/rest/v1/rpc/get_billionaire_board'){
     state.reads++;body={entries:state.posted?[state.posted]:[],self:state.signed?state.posted:null,total:state.posted?1:0};
    }else if(url.pathname==='/rest/v1/rpc/submit_billionaire_score'){
     state.submits++;assert.ok(state.signed);assert.equal(state.submits,1);const p=JSON.parse(request.postData);assert.equal(p.p_expected_user_id,uid);assert.equal(p.p_game_version,'0.9.0');assert.equal(p.p_display_name,'Synthetic Founder');assert.equal(p.p_valuation,Math.round(20000000+state.row.game_state.cash+state.row.game_state.positions.h100.qty*state.row.game_state.prices.h100));
     if(state.submitError){status=403;body={code:'42501',message:'Synthetic permission denied'};}
     else {state.posted={public_id:'00000000-0000-4000-8000-000000000202',display_name:p.p_display_name,best_valuation:p.p_valuation,game_version:'0.9.0',position:1,achieved_at:'2026-10-16T00:00:00Z',verification:'unverified'};body=state.posted;}
    }else throw Error('Unexpected external endpoint');
   }catch{state.errors.push('unexpected intercepted request');status=500;body={message:'Synthetic route rejected'};}
   await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')},m.sessionId);
  };
  async function scenario(variant,{signed=false,empty=false,board=false,error=false,deviceChoice=false,noLocal=false,legacy=false,differentCloud=false}={}){
   const {browserContextId}=await send('Target.createBrowserContext');const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
   const state={signed,row:empty?null:{user_id:uid,game_state:(deviceChoice||differentCloud)?{...game(),month:4,cash:4000000}:game(),updated_at:'2026-10-15T00:00:00.123456Z'},posted:null,submits:0,reads:0,saves:[],errors:[],submitError:error};states.set(sessionId,state);
   const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error('Browser assertion expression failed');return r.result.value;};
   const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Timed out: '+expression+'; sanitized status='+await evaluate(`document.querySelector('.sh-account [role="status"]')?.textContent`)+'; board notice='+await evaluate(`document.querySelector('.board-notice')?.textContent`)+'; submit count='+state.submits+'; test errors='+state.errors.join(',')+'; intercepted methods='+state.saves.map(x=>x.method).join(','));};
   await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);await send('Fetch.enable',{patterns:[{urlPattern:'https://*',requestStage:'Request'}]},sessionId);
   const entries={'silicon-hustle-welcome-v09':'yes','silicon-hustle-tutorial-seen':'yes','silicon-hustle-v04':JSON.stringify(game())};
   if(noLocal)delete entries['silicon-hustle-v04'];
   if(legacy){entries['compute-empire-v04']=entries['silicon-hustle-v04'];delete entries['silicon-hustle-v04'];}
   if(signed){const payload=Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');entries['sb-supabase-auth-token']=JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.SYNTHETIC',refresh_token:'SYNTHETIC_ONLY',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user});}
   await send('Page.addScriptToEvaluateOnNewDocument',{source:`for(const [k,v] of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);`},sessionId);
   await send('Page.navigate',{url:origin+'/'+variant+'/'},sessionId);
   await wait(`!!document.querySelector('.shell')`);
   if(signed&&!empty&&!noLocal){await wait(`!!document.querySelector('[aria-label="Choose your game save"]')`);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(deviceChoice?"KEEP THIS DEVICE'S SAVE":"USE CLOUD SAVE")}).click()`);await wait(`!document.querySelector('[aria-label="Choose your game save"]')`);}
   if(signed&&noLocal)await wait(`!!localStorage.getItem('silicon-hustle-v04')&&JSON.parse(localStorage.getItem('silicon-hustle-v04')).seed===42`);
   if(signed&&empty)await wait(`!!document.querySelector('.sh-account [role="status"]')&&document.querySelector('.sh-account [role="status"]').textContent.includes('SYNCED')`);
   await sleep(150); // Let main's existing conflict-dependent save listener effect attach.
   await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('BUY ·')).click()`);
   await wait(`JSON.parse(localStorage.getItem('silicon-hustle-v04')).positions.h100?.qty===1`);
   if(signed)await wait(`document.querySelector('.sh-account [role="status"]').textContent.includes('SYNCED')`);
   await sleep(signed?1100:50);
   const afterGame=await evaluate(`JSON.parse(localStorage.getItem('silicon-hustle-v04'))`);
   const saveTraffic=structuredClone(state.saves),savedBefore=JSON.stringify(state.row),localBefore=JSON.stringify(afterGame);
   if(board){
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='BILLIONAIRE BOARD').click()`);await wait(`!!document.querySelector('.board-empty')`);
    assert.equal(state.submits,0,'Login/page/game actions cannot publish automatically');
    if(signed){
     await evaluate(`const i=document.querySelector('#founder-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Synthetic Founder');i.dispatchEvent(new Event('input',{bubbles:true}));`);
     await sleep(50);await evaluate(`document.querySelector('.board-name form').requestSubmit()`);
     if(error){await wait(`!!document.querySelector('.board-notice')&&document.querySelector('.board-notice').textContent.includes('Synthetic permission denied')`);assert.equal(state.posted,null);}
     else {await wait(`!!document.querySelector('.board-rankings')`);assert.equal(state.posted.position,1);}
     assert.equal(state.submits,1);assert.equal(JSON.stringify(state.row),savedBefore,'Publishing cannot mutate cloud save');assert.equal(await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('silicon-hustle-v04')))`),localBefore,'Publishing cannot mutate device save');
     assert.equal(await evaluate(`document.querySelector('.board-rankings')?.textContent.includes('synthetic@example.invalid')??false`),false);
    }else {assert.equal(await evaluate(`!!document.querySelector('#founder-name')`),false);assert.equal(state.submits,0);}
   }
   assert.deepEqual(state.errors,[]);await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);return {afterGame,saveTraffic,reads:state.reads};
  }
  for(const options of [{signed:false},{signed:false,legacy:true},{signed:true},{signed:true,noLocal:true},{signed:true,differentCloud:true},{signed:true,empty:true},{signed:true,deviceChoice:true}]){
   const original=await scenario('main',options),release=await scenario('release',{...options,board:true});assert.deepEqual(release.afterGame,original.afterGame);assert.deepEqual(release.saveTraffic,original.saveTraffic,'Original save request shapes and payloads must match main');console.log('PASS: baseline gameplay/save parity '+JSON.stringify(options));
  }
  await scenario('release',{signed:true,board:true,error:true});console.log('PASS: synthetic submit permission error has no retries or save mutations');
  await send('Browser.close');
 }finally{ws?.close();child.kill('SIGTERM');await new Promise(r=>server.close(r));}
});
