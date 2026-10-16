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
test('offline browser: gameplay/cloud-save parity with main plus isolated board flows',{skip:!available?'Chrome not installed; set CHROME_BIN':false,timeout:90000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'silicon-board-release-browser-'));
 for(const variant of ['main','release','missingurl','missingkey','missingboth']){
  await build({entryPoints:['src/main.tsx'],bundle:true,format:'esm',outdir:join(root,variant),entryNames:'app',jsx:'automatic',define:{'import.meta.env.VITE_SUPABASE_URL':(variant==='missingurl'||variant==='missingboth')?'undefined':JSON.stringify('https://supabase.test'),'import.meta.env.VITE_SUPABASE_ANON_KEY':(variant==='missingkey'||variant==='missingboth')?'undefined':JSON.stringify('sb_publishable_SYNTHETIC_ONLY')},plugins:variant==='main'?[{name:'baseline-main',setup(b){b.onLoad({filter:/\/src\/main\.tsx$/},()=>({contents:execFileSync('git',['show',base+':src/main.tsx'],{encoding:'utf8'}),loader:'tsx'}));}}]:[]});
 }
 const server=http.createServer(async(req,res)=>{const m=req.url.match(/^\/(main|release|missingurl|missingkey|missingboth)\/(app\.(?:js|css))$/);if(m){res.setHeader('Content-Type',m[2].endsWith('js')?'text/javascript':'text/css');res.end(await readFile(join(root,m[1],m[2])));return;}if(/^\/(main|release|missingurl|missingkey|missingboth)\/$/.test(req.url)){const v=req.url.split('/')[1];res.setHeader('Content-Type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${v}/app.css"><script type="module" src="/${v}/app.js"></script>`);return;}res.writeHead(404);res.end();});
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
     state.reads++;if(state.readError){status=404;body={code:'PGRST202',message:'SYNTHETIC_PRIVATE_BACKEND_DETAIL'};}else body={entries:state.posted?[state.posted]:[],self:state.signed?state.posted:null,total:state.posted?1:0};
    }else if(url.pathname==='/rest/v1/rpc/submit_billionaire_score'){
     state.submits++;assert.ok(state.signed);assert.equal(state.submits,1);const p=JSON.parse(request.postData);assert.equal(p.p_expected_user_id,uid);assert.equal(p.p_game_version,'0.9.0');assert.equal(p.p_display_name,'Synthetic Founder');assert.equal(p.p_valuation,Math.round(20000000+state.row.game_state.cash+state.row.game_state.positions.h100.qty*state.row.game_state.prices.h100));
     if(state.submitError){status=403;body={code:'42501',message:'Synthetic permission denied'};}
     else {state.posted={public_id:'00000000-0000-4000-8000-000000000202',display_name:p.p_display_name,best_valuation:p.p_valuation,game_version:'0.9.0',position:1,achieved_at:'2026-10-16T00:00:00Z',verification:'unverified'};body=state.posted;}
    }else throw Error('Unexpected external endpoint');
   }catch{state.errors.push('unexpected intercepted request');status=500;body={message:'Synthetic route rejected'};}
   await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')},m.sessionId);
  };
  async function scenario(variant,{signed=false,empty=false,board=false,error=false,deviceChoice=false,noLocal=false,legacy=false,differentCloud=false,configurationMissing=false,readError=false,publicEntry=false,interactive=null}={}){
   const {browserContextId}=await send('Target.createBrowserContext');const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
   const state={signed,row:empty?null:{user_id:uid,game_state:(deviceChoice||differentCloud)?{...game(),month:4,cash:4000000}:game(),updated_at:'2026-10-15T00:00:00.123456Z'},posted:null,submits:0,reads:0,saves:[],errors:[],submitError:error,readError};states.set(sessionId,state);
   if(publicEntry)state.posted={public_id:'00000000-0000-4000-8000-000000000303',display_name:'Synthetic Public Founder',best_valuation:1000,game_version:'0.9.0',position:1,achieved_at:'2026-10-16T00:00:00Z',verification:'unverified'};
   const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error('Browser assertion expression failed');return r.result.value;};
   const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Timed out: '+expression+'; sanitized status='+await evaluate(`document.querySelector('.sh-account [role="status"]')?.textContent`)+'; board notice='+await evaluate(`document.querySelector('.board-notice')?.textContent`)+'; submit count='+state.submits+'; test errors='+state.errors.join(',')+'; intercepted methods='+state.saves.map(x=>x.method).join(','));};
   await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);await send('Fetch.enable',{patterns:[{urlPattern:'https://*',requestStage:'Request'}]},sessionId);
   if(interactive==='desktop')await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false},sessionId);
   if(interactive==='mobile'||interactive==='small')await send('Emulation.setDeviceMetricsOverride',{width:interactive==='small'?320:390,height:interactive==='small'?568:844,deviceScaleFactor:1,mobile:true},sessionId);
   const entries={'silicon-hustle-welcome-v09':'yes','silicon-hustle-tutorial-seen':'yes','silicon-hustle-v04':JSON.stringify(game())};
   if(interactive){const g=game();g.month=2;entries['silicon-hustle-v04']=JSON.stringify(g);}
   if(noLocal)delete entries['silicon-hustle-v04'];
   if(legacy){entries['compute-empire-v04']=entries['silicon-hustle-v04'];delete entries['silicon-hustle-v04'];}
   if(signed){const payload=Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');entries['sb-supabase-auth-token']=JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.SYNTHETIC',refresh_token:'SYNTHETIC_ONLY',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user});}
   await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('__synthetic_seeded')){for(const [k,v] of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);localStorage.setItem('__synthetic_seeded','yes');}`},sessionId);
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
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='RANKINGS').click()`);await wait(`!!document.querySelector('.board-empty')||!!document.querySelector('.board-rankings')||!!document.querySelector('.board-notice')`);
    assert.equal(await evaluate(`document.getElementById('board-title').textContent`),'RANKINGS');
    assert.equal(await evaluate(`document.querySelector('.board-refresh').getAttribute('aria-label')`),'Refresh Rankings');
    if(configurationMissing){assert.equal(state.reads,0);assert.match(await evaluate(`document.querySelector('.board-notice').textContent`),/Rankings is not configured for this deployment/);}
    if(readError){assert.equal(state.reads,1);const notice=await evaluate(`document.querySelector('.board-notice').textContent`);assert.match(notice,/Rankings could not be reached/);assert.ok(!notice.includes('SYNTHETIC_PRIVATE_BACKEND_DETAIL'));}
    assert.equal(state.submits,0,'Login/page/game actions cannot publish automatically');
    if(publicEntry){assert.equal(state.reads,1);assert.equal(await evaluate(`document.querySelector('.board-rankings b')?.textContent`),'Synthetic Public Founder');assert.equal(await evaluate(`document.querySelector('.board-position')?.textContent`),'#1');assert.equal(await evaluate(`document.querySelector('.board-notice')?.textContent??''`),'');}
    if(signed){
     await evaluate(`const i=document.querySelector('#founder-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Synthetic Founder');i.dispatchEvent(new Event('input',{bubbles:true}));`);
     await sleep(50);await evaluate(`document.querySelector('.board-name form').requestSubmit()`);
     if(error){await wait(`!!document.querySelector('.board-notice')&&document.querySelector('.board-notice').textContent.includes('Rankings access was denied')`);assert.equal(state.posted,null);}
     else {await wait(`!!document.querySelector('.board-rankings')`);assert.equal(state.posted.position,1);}
     assert.equal(state.submits,1);assert.equal(JSON.stringify(state.row),savedBefore,'Publishing cannot mutate cloud save');assert.equal(await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('silicon-hustle-v04')))`),localBefore,'Publishing cannot mutate device save');
     assert.equal(await evaluate(`document.querySelector('.board-rankings')?.textContent.includes('synthetic@example.invalid')??false`),false);
    }else {assert.equal(await evaluate(`!!document.querySelector('#founder-name')`),false);assert.equal(state.submits,0);}
   }
   if(interactive){
    const saved=()=>evaluate(`JSON.parse(localStorage.getItem('silicon-hustle-v04'))`);
    const text=id=>evaluate(`document.querySelector('[data-testid="${id}"]')?.textContent`);
    const click=expression=>evaluate(`(${expression}).click()`);
    const setQuantity=async n=>{await evaluate(`(()=>{const q=document.getElementById('chip-quantity');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(q,${JSON.stringify(String(n))});q.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(40);};
    const open=async()=>{await evaluate(`(()=>{const card=document.querySelectorAll('.market .asset')[2];card.focus();card.click();})()`);await wait(`!!document.querySelector('.chip-trading-panel[open]')`);};
    const key=async(key,code,vk,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,modifiers},sessionId);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk,modifiers},sessionId);};
    if(interactive!=='desktop'){
     const beforeLayout=JSON.stringify(await saved());
     const layout=await evaluate(`(()=>{const r=document.querySelector('.market .asset').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
     assert.ok(layout.top<430&&layout.bottom<layout.height,'Market first row is visible without scrolling');assert.equal(layout.overflow,false,'Page fits viewport');
     assert.equal(await evaluate(`document.querySelector('.market-nav').hidden`),true);
     assert.equal(await evaluate(`document.querySelector('.portfolio-toggle').getAttribute('aria-expanded')`),'false');
     assert.equal(await evaluate(`document.getElementById('portfolio-content').hidden`),true);
     assert.ok(await evaluate(`document.querySelector('.market').compareDocumentPosition(document.querySelector('.holdings'))&Node.DOCUMENT_POSITION_FOLLOWING`));
     await click(`document.querySelector('.portfolio-toggle')`);await sleep(30);
     assert.equal(await evaluate(`document.getElementById('portfolio-content').hidden`),false);
     assert.equal(await evaluate(`Array.from(document.querySelectorAll('.holdings-table td')).every(cell=>cell.scrollWidth<=cell.clientWidth+1)`),true,'Every financial cell fits without clipping');
     assert.equal(await evaluate(`document.querySelectorAll('.holdings-table tbody td').length`),6);
     assert.equal(await evaluate(`getComputedStyle(document.querySelector('.chip-name-button')).minHeight`),'44px');
     await click(`document.querySelector('.portfolio-toggle')`);await click(`document.querySelector('.wire-toggle')`);await sleep(30);
     assert.equal(await evaluate(`document.getElementById('wire-content').hidden`),false);await click(`document.querySelector('.wire-toggle')`);
     await evaluate(`Array.from(document.querySelectorAll('.topnav button')).find(b=>b.textContent.startsWith('AI LAB')).click()`);await sleep(30);
     assert.equal(await evaluate(`document.querySelector('.market-nav').hidden`),false,'Market remains reachable from other tabs');await click(`document.querySelector('.market-nav')`);await sleep(30);
     assert.equal(JSON.stringify(await saved()),beforeLayout,'Layout controls never save or mutate game state');
     await evaluate(`document.querySelector('.market .asset').scrollIntoView({block:'center'})`);const touch=await evaluate(`(()=>{const r=document.querySelector('.market .asset').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]},sessionId);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sessionId);await wait(`!!document.querySelector('.chip-trading-panel[open]')`);assert.ok(await evaluate(`document.getElementById('chip-panel-title').textContent.includes('L40S')`));await click(`document.querySelector('.chip-close')`);await wait(`!document.querySelector('.chip-trading-panel')`);assert.equal(JSON.stringify(await saved()),beforeLayout,'Touch selection never saves');
     await evaluate(`window.scrollTo(0,0)`);
     const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(join(root,'mobile-market-'+interactive+'.png'),Buffer.from(shot.data,'base64'));console.log('Mobile market screenshot: '+join(root,'mobile-market-'+interactive+'.png'));
    }else {
     assert.equal(await evaluate(`!!document.querySelector('.portfolio-toggle')`),false);
     assert.ok(await evaluate(`document.querySelector('.holdings').compareDocumentPosition(document.querySelector('.market'))&Node.DOCUMENT_POSITION_FOLLOWING`),'Desktop keeps portfolio first');
    }
    const beforeOpen=JSON.stringify(await saved());await open();
    assert.equal(JSON.stringify(await saved()),beforeOpen,'Opening a chip must not save or trade');
    assert.equal(await text('chip-monthly-change'),'Unavailable');
    assert.equal(await text('chip-average'),'$34,340');
    assert.equal(await text('chip-owned'),'1');
    await key('Tab','Tab',9,8);assert.equal(await evaluate(`document.querySelector('.chip-trading-panel').contains(document.activeElement)`),true);
    await key('Escape','Escape',27);await wait(`!document.querySelector('.chip-trading-panel')`);
    assert.equal(await evaluate(`document.activeElement===document.querySelectorAll('.market .asset')[2]`),true,'Escape restores focus to opener');
    assert.equal(JSON.stringify(await saved()),beforeOpen,'Dismissal must not mutate game state');
    await open();await setQuantity('');assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);
    await setQuantity('1000');assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);
    await setQuantity('1.5');assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);
    await click(`document.querySelector('[aria-label="Increase quantity"]')`);await sleep(30);
    assert.equal(await evaluate(`document.getElementById('chip-quantity').value`),'2');
    await click(`document.querySelector('[aria-label="Decrease quantity"]')`);await sleep(30);
    const beforeBuy=await saved();const maximum=Math.floor(beforeBuy.cash/34340);
    await evaluate(`Array.from(document.querySelectorAll('.chip-trading-panel button')).find(b=>b.textContent==='MAX').click()`);await sleep(50);
    assert.equal(Number(await evaluate(`document.getElementById('chip-quantity').value`)),maximum);
    assert.equal(await text('chip-order-total'),'$'+(maximum*34340).toLocaleString('en-US'));
    await click(`document.getElementById('chip-confirm')`);await wait(`document.querySelector('[data-testid="chip-owned"]').textContent==='${maximum+1}'`);
    let g=await saved();assert.equal(g.cash,beforeBuy.cash-maximum*34340);assert.equal(g.positions.h100.cost,beforeBuy.positions.h100.cost+maximum*34340);
    assert.equal(await evaluate(`document.querySelector('.chip-trading-panel').open`),true);
    assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true,'Insufficient cash blocks another MAX-size buy');
    await evaluate(`Array.from(document.querySelectorAll('.chip-sides button')).find(b=>b.textContent==='SELL').click()`);await sleep(30);
    await evaluate(`Array.from(document.querySelectorAll('.chip-trading-panel button')).find(b=>b.textContent==='ALL').click()`);await sleep(30);
    assert.equal(Number(await evaluate(`document.getElementById('chip-quantity').value`)),maximum+1);
    const proceeds=Math.round((maximum+1)*34000*.99),profit=proceeds-g.positions.h100.cost;
    assert.equal(await text('chip-order-total'),'$'+proceeds.toLocaleString('en-US'));
    assert.ok((await text('chip-realized')).includes(Math.abs(profit).toLocaleString('en-US')));
    const cashBeforeSale=g.cash;await click(`document.getElementById('chip-confirm')`);await wait(`document.querySelector('[data-testid="chip-owned"]').textContent==='0'`);
    g=await saved();assert.equal(g.cash,cashBeforeSale+proceeds);assert.deepEqual(g.positions.h100,{qty:0,cost:0});assert.equal(g.realized[2],profit);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.chip-sides button')).find(b=>b.textContent==='SELL').disabled`),true);
    await key('Escape','Escape',27);await wait(`!document.querySelector('.chip-trading-panel')`);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('BUY ·')).click()`);await sleep(40);
    if(interactive!=='desktop'){await click(`document.querySelector('.portfolio-toggle')`);await sleep(30);}await click(`document.querySelector('.chip-name-button')`);await wait(`!!document.querySelector('.chip-trading-panel[open]')`);
    const rect=await evaluate(`JSON.stringify((()=>{const r=document.querySelector('.chip-trading-panel').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};})())`);const r=JSON.parse(rect);assert.ok(r.left>=0&&r.right<=r.width+1&&r.bottom<=r.height+1);if(interactive!=='desktop')assert.ok(Math.abs(r.bottom-r.height)<2,'Mobile sheet is anchored at the bottom');
    const beforeBackdrop=JSON.stringify(await saved());await send('Input.dispatchMouseEvent',{type:'mousePressed',x:1,y:1,button:'left',clickCount:1},sessionId);await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1,y:1,button:'left',clickCount:1},sessionId);await wait(`!document.querySelector('.chip-trading-panel')`);assert.equal(JSON.stringify(await saved()),beforeBackdrop);
    const previous=(await saved()).prices;await evaluate(`Array.from(document.querySelectorAll('button.next')).find(b=>b.textContent.startsWith('NEXT MONTH')).click()`);await wait(`JSON.parse(localStorage.getItem('silicon-hustle-v04')).month===3`);
    g=await saved();assert.deepEqual(g.previousMarket,{forMonth:3,prices:previous});
    await click(`document.querySelector('.close-report')`);await sleep(40);await open();
    const change=g.prices.h100-previous.h100;assert.ok((await text('chip-monthly-change')).includes(Math.abs(change).toLocaleString('en-US')));assert.equal(await text('chip-previous-price'),'$34,000');
    const screenshot=await send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(join(root,'chip-panel-'+interactive+'.png'),Buffer.from(screenshot.data,'base64'));console.log('Panel screenshot: '+join(root,'chip-panel-'+interactive+'.png'));
    await key('Escape','Escape',27);await wait(`!document.querySelector('.chip-trading-panel')`);
    await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);await sleep(80);await open();
    assert.equal(await text('chip-previous-price'),'$34,000','Monthly baseline survives reload');
    await key('Escape','Escape',27);await wait(`!document.querySelector('.chip-trading-panel')`);
    await evaluate(`Array.from(document.querySelectorAll('.foot button')).find(b=>b.textContent==='NEW GAME').click()`);await sleep(30);await evaluate(`Array.from(document.querySelectorAll('.foot button')).find(b=>b.textContent==='YES').click()`);await sleep(30);assert.equal((await saved()).previousMarket,undefined,'New game cannot inherit a previous game baseline');
    const loadFixture=async fixture=>{await evaluate(`localStorage.setItem('silicon-hustle-v04',${JSON.stringify(JSON.stringify(fixture))})`);await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);await sleep(80);};
    const large=game();large.positions.h100={qty:1500,cost:1500*34340};await loadFixture(large);await open();await evaluate(`Array.from(document.querySelectorAll('.chip-sides button')).find(b=>b.textContent==='SELL').click()`);await sleep(30);await evaluate(`Array.from(document.querySelectorAll('.chip-trading-panel button')).find(b=>b.textContent==='ALL').click()`);await sleep(30);assert.equal(await evaluate(`document.getElementById('chip-quantity').value`),'999');assert.ok(await evaluate(`document.querySelector('.chip-order').textContent.includes('ALL selects the maximum 999')`));await click(`document.getElementById('chip-confirm')`);await wait(`document.querySelector('[data-testid="chip-owned"]').textContent==='501'`);assert.equal((await saved()).positions.h100.cost,501*34340);await key('Escape','Escape',27);
    const unknown=game();unknown.positions.h100={qty:1};await loadFixture(unknown);const unknownBefore=JSON.stringify(await saved());await open();assert.equal(await text('chip-average'),'Unavailable');assert.equal(await text('chip-unrealized'),'Unavailable');assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);await click(`document.getElementById('chip-confirm')`);assert.equal(JSON.stringify(await saved()),unknownBefore);await key('Escape','Escape',27);
    const ended=game();ended.ended=true;ended.ending='Synthetic end';await loadFixture(ended);await click(`document.querySelector('.final-actions button')`);await sleep(30);await open();assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);assert.ok(await evaluate(`document.querySelector('.chip-order-error').textContent.includes('Trading is closed')`));await key('Escape','Escape',27);assert.deepEqual(await saved(),ended);
    await loadFixture(game());await open();const beforeConflict=JSON.stringify(await saved());await evaluate(`(()=>{const overlay=document.createElement('div');overlay.className='sh-gate';document.body.append(overlay);})()`);await wait(`!document.querySelector('.chip-trading-panel')`);assert.equal(JSON.stringify(await saved()),beforeConflict,'Existing account/conflict UI dismisses sheet without a write');
    assert.equal(state.submits,0);assert.equal(state.saves.length,0);

    console.log('PASS: interactive chip panel '+interactive+' buy/sell fees, MAX/ALL, quantities, legacy baseline, monthly snapshot, focus, dismissal and layout');
   }
   assert.deepEqual(state.errors,[]);await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);return {afterGame,saveTraffic,reads:state.reads};
  }
  for(const options of [{signed:false},{signed:false,legacy:true},{signed:true},{signed:true,noLocal:true},{signed:true,differentCloud:true},{signed:true,empty:true},{signed:true,deviceChoice:true}]){
   const original=await scenario('main',options),release=await scenario('release',{...options,board:true});assert.deepEqual(release.afterGame,original.afterGame);assert.deepEqual(release.saveTraffic,original.saveTraffic,'Original save request shapes and payloads must match main');console.log('PASS: baseline gameplay/save parity '+JSON.stringify(options));
  }
  for(const interactive of ['desktop','mobile','small'])await scenario('release',{interactive});
  await scenario('release',{board:true,publicEntry:true});console.log('PASS: configured anonymous client renders a populated Rankings response with rank, without sign-in, save requests or score writes');
  for(const variant of ['missingurl','missingkey','missingboth']){await scenario(variant,{board:true,configurationMissing:true});console.log('PASS: missing Preview configuration '+variant+' makes no RPC and shows configuration error');}
  await scenario('release',{board:true,readError:true});console.log('PASS: real RPC-not-found is distinct from missing configuration and does not echo backend details');
  await scenario('release',{signed:true,board:true,error:true});console.log('PASS: synthetic submit permission error has no retries or save mutations');
  await send('Browser.close');
 }finally{ws?.close();child.kill('SIGTERM');await new Promise(r=>server.close(r));}
});
