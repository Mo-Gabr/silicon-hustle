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
const base='2794bd8eb05f1b4f98e21a67b6f839206e239bf2';
const uid='00000000-0000-4000-8000-000000000101';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',created_at:'2026-01-01T00:00:00Z'};
const game=()=>({month:3,cash:5000000,prices:Object.fromEntries(['l40s','a100','h100','h200','b200','mi300','mi325','gaudi'].map(k=>[k,34000])),positions:{},labs:0,headline:'SYNTHETIC ONLY',history:[],ended:false,ending:'',seed:42,threat:null,threatHistory:[],crisisResult:null});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let available=true;try{await access(chrome);}catch{available=false;}
test('offline browser: local gameplay parity, personalized Rankings and Founders Gamble',{skip:!available?'Chrome not installed; set CHROME_BIN':false,timeout:120000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'silicon-board-release-browser-'));
 for(const variant of ['main','release','missingurl','missingkey','missingboth','invalidurl']){
  await build({entryPoints:['src/main.tsx'],bundle:true,format:'esm',outdir:join(root,variant),entryNames:'app',jsx:'automatic',define:{'import.meta.env.VITE_SUPABASE_URL':(variant==='missingurl'||variant==='missingboth')?'undefined':variant==='invalidurl'?JSON.stringify('invalid-url'):JSON.stringify('https://supabase.test'),'import.meta.env.VITE_SUPABASE_ANON_KEY':(variant==='missingkey'||variant==='missingboth')?'undefined':JSON.stringify('sb_publishable_SYNTHETIC_ONLY')},plugins:variant==='main'?[{name:'baseline-main',setup(b){b.onLoad({filter:/\/src\/.*\.(tsx?|css)$/},args=>({contents:execFileSync('git',['show',base+':'+args.path.slice(process.cwd().length+1)],{encoding:'utf8'}),loader:args.path.endsWith('.css')?'css':args.path.endsWith('.tsx')?'tsx':'ts'}));}}]:[]});
 }
 const server=http.createServer(async(req,res)=>{const m=req.url.match(/^\/(main|release|missingurl|missingkey|missingboth|invalidurl)\/(app\.(?:js|css))$/);if(m){res.setHeader('Content-Type',m[2].endsWith('js')?'text/javascript':'text/css');res.end(await readFile(join(root,m[1],m[2])));return;}if(/^\/(main|release|missingurl|missingkey|missingboth|invalidurl)\/$/.test(req.url)){const v=req.url.split('/')[1];res.setHeader('Content-Type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><div id="root"></div><link rel="stylesheet" href="/${v}/app.css"><script type="module" src="/${v}/app.js"></script>`);return;}res.writeHead(404);res.end();});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const profile=join(root,'fresh-profile');
 const child=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  let port,route;for(let i=0;i<70;i++){try{[port,route]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');break;}catch{await sleep(100);}}
  assert.ok(port,'Chrome unavailable');ws=new WebSocket(`ws://127.0.0.1:${port}${route}`);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let seq=0;const pending=new Map(),states=new Map();
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject,sessionId});ws.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
  ws.onmessage=async e=>{
   const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?(/Session with given id not found/.test(m.error.message)&&(!states.has(p.sessionId)||states.get(p.sessionId)?.disposing)?p.resolve({}):p.reject(Error(m.error.message))):p.resolve(m.result);}return;}
   const state=states.get(m.sessionId);if(!state||state.disposing)return;
   if(m.method==='Runtime.exceptionThrown')state.errors.push('runtime exception');
   if(m.method!=='Fetch.requestPaused')return;
   const {requestId,request}=m.params,url=new URL(request.url);
   if(url.protocol!=='https:'){await send('Fetch.continueRequest',{requestId},m.sessionId);return;}
   if(url.pathname.startsWith('/rest/v1/rpc/')||url.pathname.startsWith('/functions/v1/'))(state.rankingRequests??=[]).push(url.pathname);
   let body=null,status=200;
   try{
    assert.equal(url.origin,'https://supabase.test');
    if(state.offline){status=503;body={message:'Synthetic offline'};}
    else if(request.method==='OPTIONS')body={};
    else if(url.pathname==='/auth/v1/user'){body=state.authUser??user;}
    else if(url.pathname==='/auth/v1/logout'){body={};state.signed=false;}
    else if(url.pathname==='/rest/v1/game_saves'){state.saves.push(request.method);throw Error('Save API must never be used');}
    else if(url.pathname==='/rest/v1/rpc/get_billionaire_board'){
     state.reads++;if(state.readError){status=404;body={code:'PGRST202',message:'SYNTHETIC_PRIVATE_BACKEND_DETAIL'};}else body={entries:state.posted?[state.posted]:[],self:state.signed?state.posted:null,total:state.posted?1:0};
    }else if(url.pathname==='/rest/v1/rpc/submit_billionaire_score'){state.submits++;throw Error('Publishing must be paused');}else throw Error('Unexpected external endpoint');
   }catch{state.errors.push('unexpected intercepted request');status=500;body={message:'Synthetic route rejected'};}
   await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PATCH,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')},m.sessionId);
  };
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:join(root,'downloads')});
  async function scenario(variant,{signed=false,empty=false,board=false,error=false,deviceChoice=false,noLocal=false,legacy=false,differentCloud=false,configurationMissing=false,readError=false,publicEntry=false,interactive=null,rankingsCase=null,boardWidth=null,gambleCase=false,localCase=null,profileCase=null,recoveryChoice=null,accountCase=false}={}){
   const {browserContextId}=await send('Target.createBrowserContext');const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
   const state={signed,row:empty?null:{user_id:uid,game_state:(deviceChoice||differentCloud)?{...game(),month:4,cash:4000000}:game(),updated_at:'2026-10-15T00:00:00.123456Z'},posted:null,submits:0,reads:0,saves:[],errors:[],submitError:error,readError};states.set(sessionId,state);
   if(rankingsCase){state.posted={public_id:'00000000-0000-4000-8000-000000000202',display_name:'Synthetic Founder',best_valuation:['published','rename'].includes(rankingsCase)?30000000:1000000,game_version:'0.9.0',position:1,achieved_at:'2026-10-16T00:00:00Z',verification:'unverified'};state.submitError=rankingsCase==='failed';state.manualRetry=rankingsCase==='failed';state.editName=rankingsCase==='rename';}
   if(localCase==='offline')state.offline=true;
   if(publicEntry)state.posted={public_id:'00000000-0000-4000-8000-000000000303',display_name:'Synthetic Public Founder',best_valuation:1000,game_version:'0.9.0',position:1,achieved_at:'2026-10-16T00:00:00Z',verification:'unverified'};
   const scope='silicon-hustle-account-v1:'+encodeURIComponent(signed?'user:'+uid:'guest')+':';
   const scopedKey=key=>scope+key;
   // Existing parity scenarios now inspect their selected profile's real storage keys.
   // Baseline remains unscoped; app code and the native Storage implementation are unchanged.
   const evaluate=async (expression,raw=false)=>{if(variant!=='main'&&!raw)expression=expression.replace(/(['"])(silicon-hustle-(?:local-v1|v04|local-originals-v1|local-choice-v1|tutorial-seen)|compute-empire-v04)\1/g,(_match,quote,key)=>quote+scopedKey(key)+quote);const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error('Browser assertion expression failed');return r.result.value;};
   const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('Timed out: '+expression+'; sanitized status='+await evaluate(`document.querySelector('.sh-account [role="status"]')?.textContent`)+'; board notice='+await evaluate(`document.querySelector('.board-notice')?.textContent`)+'; submit count='+state.submits+'; test errors='+state.errors.join(',')+'; intercepted methods='+state.saves.map(x=>x.method).join(','));};
   await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);await send('Fetch.enable',{patterns:[{urlPattern:'https://*',requestStage:'Request'}]},sessionId);
   if(boardWidth)await send('Emulation.setDeviceMetricsOverride',{width:boardWidth,height:boardWidth===1280?900:boardWidth===320?568:844,deviceScaleFactor:1,mobile:boardWidth!==1280},sessionId);
   if(interactive==='desktop')await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false},sessionId);
   if(interactive==='mobile'||interactive==='small')await send('Emulation.setDeviceMetricsOverride',{width:interactive==='small'?320:390,height:interactive==='small'?568:844,deviceScaleFactor:1,mobile:true},sessionId);
   const entries={'silicon-hustle-welcome-v09':'yes','silicon-hustle-tutorial-seen':'yes','silicon-hustle-v04':JSON.stringify(game())};
   if(recoveryChoice){const historical={...game(),month:42,cash:253577280,ended:true,gamble:{version:1,decision:'extend',standardResult:{month:30,valuation:100000000,peak:100000000,success:true,ending:'ipo'},enterprise:{reliability:1,purchasedSlots:0,contracts:[],discountThrough:0,focus:'operate',ledger:[]},extensionOutcome:{month:42,valuation:273577280,reason:'completed',unicorn:false,mogabr:false}}};entries['silicon-hustle-v04']=JSON.stringify(historical);entries['silicon-hustle-local-v1']=JSON.stringify({...game(),month:5});entries['silicon-hustle-local-originals-v1']=JSON.stringify([{key:'silicon-hustle-v04',raw:JSON.stringify(historical)}]);}
   if(interactive){const g=game();g.month=2;entries['silicon-hustle-v04']=JSON.stringify(g);}
   if(profileCase==='chosen')entries['silicon-hustle-v04']=JSON.stringify({...game(),profile:{displayName:'Device Atelier'}});
   if(profileCase==='legacy')entries['silicon-hustle-v04']=JSON.stringify({...game(),founder_name:'Legacy Atelier'});
   if(noLocal)delete entries['silicon-hustle-v04'];
   if(localCase==='first'||localCase==='offline')delete entries['silicon-hustle-tutorial-seen'];
   if(localCase==='invalid')entries['silicon-hustle-v04']='UNREADABLE ORIGINAL';
   if(localCase==='future')entries['silicon-hustle-v04']=JSON.stringify({...game(),month:43,gamble:{version:99}});
   if(legacy){entries['compute-empire-v04']=entries['silicon-hustle-v04'];delete entries['silicon-hustle-v04'];if(variant==='release')delete entries['silicon-hustle-tutorial-seen'];}
   if(signed){const payload=Buffer.from(JSON.stringify({sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');entries['sb-supabase-auth-token']=JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.SYNTHETIC',refresh_token:'SYNTHETIC_ONLY',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user});}
   if(variant!=='main'){
    for(const key of Object.keys(entries))if(/^(silicon-hustle-(local-v1|v04|local-originals-v1|local-choice-v1|tutorial-seen)|compute-empire-v04)$/.test(key)){entries[scopedKey(key)]=entries[key];delete entries[key];}
    // Fixture ownership is explicit; legacy assignment itself is tested separately.
    entries['silicon-hustle-legacy-assignment-v1']=signed?'user:'+uid:'guest';
   }
   if(accountCase){entries['silicon-hustle-account-v1:guest:silicon-hustle-local-v1']=JSON.stringify({...game(),cash:100e6});}
   await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!localStorage.getItem('__synthetic_seeded')){for(const [k,v] of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);localStorage.setItem('__synthetic_seeded','yes');}`},sessionId);
   if(localCase==='quota')await send('Page.addScriptToEvaluateOnNewDocument',{source:`const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===${JSON.stringify(scopedKey('silicon-hustle-local-v1'))})throw new DOMException('Synthetic quota','QuotaExceededError');return set.call(this,k,v);};`},sessionId);
   await send('Page.navigate',{url:origin+'/'+variant+'/'},sessionId);
   if(accountCase){
    const raw=expression=>evaluate(expression,true);
    await wait(`!!document.querySelector('.shell')`);
    assert.equal(await raw(`localStorage.getItem('silicon-hustle-account-v1:guest:silicon-hustle-local-v1')`),entries['silicon-hustle-account-v1:guest:silicon-hustle-local-v1'],'auth readiness must not initialize or change Guest');
    const press=async text=>{await raw(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);await sleep(80);};
    const boardBest=async()=>{await press('RANKINGS');return raw(`document.querySelector('.overlord-personal strong').textContent`);};
    await raw(`localStorage.setItem(${JSON.stringify(scopedKey('silicon-hustle-local-v1'))},${JSON.stringify(JSON.stringify({...game(),cash:200e6}))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);await sleep(80);
    assert.equal(await boardBest(),'$220,000,000.00');
    await press('NEW GAME');await press('YES');assert.equal(await boardBest(),'$220,000,000.00');
    await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);assert.equal(await boardBest(),'$220,000,000.00');
    const previousGuest=entries['silicon-hustle-account-v1:guest:silicon-hustle-local-v1'];
    await press('ACCOUNT');await press('SIGN OUT');await wait(`!!document.querySelector('.shell')&&!document.querySelector('[aria-label="Founder account"]')`);
    assert.equal(await boardBest(),'$120,000,000.00');
    assert.ok((await raw(`localStorage.getItem('silicon-hustle-account-v1:guest:silicon-hustle-local-originals-v1')`)).includes(JSON.stringify(previousGuest).slice(1,-1)));
    const switchTo=async id=>{
     state.authUser={...user,id};
     const payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
     const session=JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.SYNTHETIC',refresh_token:'SYNTHETIC_ONLY',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:state.authUser});
     await raw(`(async()=>{const key='sb-supabase-auth-token',newValue=${JSON.stringify(session)};localStorage.setItem(key,newValue);const channel=new BroadcastChannel(key);channel.postMessage({event:'SIGNED_IN',session:JSON.parse(newValue)});await new Promise(resolve=>setTimeout(resolve,50));channel.close();})()`);await sleep(200);await wait(`!!document.querySelector('.shell')`);
    };
    await switchTo('00000000-0000-4000-8000-000000000102');
    await raw(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='START BUILDING →')?.click()`);
    assert.equal(await boardBest(),'$25,000,000.00');
    await switchTo(uid);assert.equal(await boardBest(),'$220,000,000.00');
    assert.equal(state.saves.length,0);assert.equal(state.submits,0);assert.deepEqual(state.rankingRequests??[],[]);assert.deepEqual(state.errors,[]);
    console.log('PASS: real browser account readiness, persistent best/reset/restart, Guest sign-out archives, account B and return to A');
    state.disposing=true;await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);return;
   }
   if(recoveryChoice){
    await wait(`!!document.querySelector('[aria-label="Choose your game"]')`);
    assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),entries[scopedKey('silicon-hustle-local-v1')]);
    assert.equal(await evaluate(`!!document.querySelector('.shell')`),false);
    const press=async prefix=>{await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith(${JSON.stringify(prefix)})).click()`);await sleep(70);};
    await press(recoveryChoice==='historical'?'MONTH 42':'MONTH 5');
    await wait(`!!document.querySelector('.shell')`);
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Choose your game"]')`),false);
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Founder account"]')`),false);
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Save diagnostics"]')`),false);
    const active=JSON.parse(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`));
    assert.equal(active.month,recoveryChoice==='historical'?42:5);
    assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-v04')`),(entries[scopedKey('silicon-hustle-v04')]??entries['silicon-hustle-v04']));
    const archives=JSON.parse(await evaluate(`localStorage.getItem('silicon-hustle-local-originals-v1')`));
    assert.ok(archives.some(e=>e.raw===(entries[scopedKey('silicon-hustle-local-v1')]??entries['silicon-hustle-local-v1'])));assert.ok(archives.some(e=>e.raw===(entries[scopedKey('silicon-hustle-v04')]??entries['silicon-hustle-v04'])));
    if(recoveryChoice==='historical'){
     assert.equal(active.ended,true);assert.equal(await evaluate(`!!document.querySelector('.final-cover')`),false);
     assert.equal(await evaluate(`!!document.querySelector('.next:not(:disabled)')`),true);
     await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);
     assert.equal(await evaluate(`!!document.querySelector('[aria-label="Choose your game"]')`),false);
     await press('PLAY AGAIN');await wait(`!!document.querySelector('.market')`);
    }
    await evaluate(`document.querySelectorAll('.market .asset')[2].click()`);
    await wait(`!!document.querySelector('.chip-trading-panel')`);
    await evaluate(`document.querySelector('.chip-trading-panel button[aria-label="Close trading panel"]').click()`);
    await press('BUY ·');await wait(`JSON.parse(localStorage.getItem('silicon-hustle-local-v1')).positions.h100?.qty===1`);
    await press('SELL ·');await wait(`JSON.parse(localStorage.getItem('silicon-hustle-local-v1')).positions.h100?.qty===0`);
    const month=JSON.parse(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`)).month;
    await press('NEXT MONTH');await wait(`JSON.parse(localStorage.getItem('silicon-hustle-local-v1')).month===${month+1}`);
    await press('CONTINUE PLAYING');await press('AI LAB');await wait(`document.body.textContent.includes('AI LAB')`);
    const saved=await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`);
    await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);
    assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),saved);
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Choose your game"], [aria-label="Founder account"], [aria-label="Save diagnostics"]')`),false);
    assert.equal(state.saves.length,0);assert.equal(state.submits,0);
    state.disposing=true;await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);
    console.log('PASS: '+recoveryChoice+' choice, preserved originals, playable buy/sell/month/lab, restart width '+boardWidth);return;
   }
   if(localCase){
    const original=entries[variant==='main'?'silicon-hustle-v04':scopedKey('silicon-hustle-v04')]??null;
    if(localCase==='invalid'||localCase==='future'){
     await wait(`!!document.querySelector('[aria-label="Saved game help"]')`);assert.equal(await evaluate(`!!document.querySelector('.shell')`),false);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-v04')`),original);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),null);
     await evaluate(`document.querySelectorAll('.local-game-recovery p,.local-game-recovery button').forEach(e=>e.style.fontSize='20px')`);assert.equal(await evaluate(`document.querySelector('.local-game-recovery').scrollWidth>document.querySelector('.local-game-recovery').clientWidth`),false);
     await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='TRY AGAIN').click()`);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-v04')`),original);
     await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='SAVE A COPY').click()`);await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='START A NEW GAME')`);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='START A NEW GAME').click()`);await wait(`!!document.querySelector('.shell')`);
     assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-v04')`),original);assert.ok(JSON.parse(await evaluate(`localStorage.getItem('silicon-hustle-local-originals-v1')`)).some(copy=>copy.raw===original));
    }else{
     await wait(`!!document.querySelector('.shell')`);
     if(localCase!=='quota')await wait(`!!localStorage.getItem('silicon-hustle-local-v1')`);
     await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='START BUILDING →')?.click()`);
     const before=await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`);
     await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('BUY ·')).click()`);
     if(localCase==='quota'){await wait(`!!document.querySelector('[role="alert"]')`);assert.ok(await evaluate(`document.querySelector('.foot').textContent.includes('Saving paused')`));assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),before);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-v04')`),original);}
     else{
      await wait(`JSON.parse(localStorage.getItem('silicon-hustle-local-v1')).positions.h100?.qty===1`);const saved=await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`);await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),saved);
      if(signed){await wait(`Array.from(document.querySelectorAll('.sh-account button')).some(b=>b.textContent==='ACCOUNT')`);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='ACCOUNT').click()`);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='SIGN OUT').click()`);await wait(`Array.from(document.querySelectorAll('.sh-account button')).some(b=>b.textContent==='ACCOUNT')`);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),saved);}
     }
    }
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Choose your game save"]')`),false);assert.ok(!await evaluate(`/cloud save|SAVE REVIEW NEEDED|WHICH EMPIRE/i.test(document.body.innerText)`));assert.equal(state.saves.length,0);assert.equal(state.submits,0);assert.deepEqual(state.errors,[]);assert.equal(state.reads,0,'Normal gameplay does not request even public Rankings');console.log('PASS: local-only '+localCase+' signed='+signed+'; saves preserved and no save API');state.disposing=true;await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);return;
   }

   await wait(`!!document.querySelector('.shell')`);
   if(signed)await wait(`Array.from(document.querySelectorAll('.sh-account button')).some(b=>b.textContent==='ACCOUNT')`);
   if(profileCase){
    const expected=profileCase==='chosen'?'Device Atelier':profileCase==='legacy'?'Legacy Atelier':'Founder';
    await wait(`document.querySelector('[data-testid="local-founder-name"]')?.textContent===${JSON.stringify(expected)}`);
    assert.ok(!await evaluate(`/ONE DEVICE[.] ONE GAME[.]/i.test(document.body.innerText)`));
    const original=await evaluate(`JSON.stringify(['silicon-hustle-local-v1','silicon-hustle-v04','compute-empire-v04'].map(k=>localStorage.getItem(k)))`);
    await send('Page.reload',{},sessionId);await wait(`document.querySelector('[data-testid="local-founder-name"]')?.textContent===${JSON.stringify(expected)}`);
    assert.equal(await evaluate(`JSON.stringify(['silicon-hustle-local-v1','silicon-hustle-v04','compute-empire-v04'].map(k=>localStorage.getItem(k)))`),original,'Displaying a profile name cannot rewrite saves');
    const base=await evaluate(`JSON.parse(localStorage.getItem('silicon-hustle-local-v1')||localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04'))`);
    const changed={...base,profile:{displayName:'Updated Device Profile'}};
    await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(changed))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);
    await wait(`document.querySelector('[data-testid="local-founder-name"]')?.textContent==='Updated Device Profile'`);
    assert.deepEqual(JSON.parse(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`)),changed);
    assert.equal(state.saves.length,0);assert.equal(state.submits,0);assert.equal(state.reads,0);assert.deepEqual(state.errors,[]);
    assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
    console.log('PASS: local profile header '+profileCase+' signed='+signed+' legacy='+legacy+' without account lookup or save mutation');
    state.disposing=true;await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);return;
   }

   if(gambleCase){
    const fixture={...game(),month:29,cash:14540000,labs:8};
    const safeTop=boardWidth===1280?0:59,safeBottom=boardWidth===1280?0:34;
    const saved=()=>evaluate(`JSON.parse((localStorage.getItem('silicon-hustle-local-v1')||localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04')))`);
    const press=async text=>{await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith(${JSON.stringify(text)})).click()`);await sleep(60);};
    const reload=async()=>{const before=await saved();await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);assert.deepEqual(await saved(),before,'Restart resumes the local snapshot without any account or server-save check');assert.equal(await evaluate(`!!document.querySelector('[aria-label="Choose your game save"]')`),false);await sleep(100);await evaluate(`document.documentElement.style.setProperty('--sh-safe-top','${safeTop}px');document.documentElement.style.setProperty('--sh-safe-bottom','${safeBottom}px')`);};
    const openingBefore=JSON.stringify(await saved());
    await press('HOW TO PLAY');assert.match(await evaluate(`document.querySelector('.tutorialgoal').textContent`),/Reach \$100M in 30 months. Make it, and you can cash out or risk everything for something bigger./);
    assert.equal(await evaluate(`document.querySelector('.starttrade').textContent`),'START BUILDING →');assert.equal(await evaluate(`document.querySelector('.tutorial').textContent.includes('Month 42')`),false);assert.equal(await evaluate(`document.querySelector('.more-rules').open`),false);
    await press('START BUILDING');assert.equal(await evaluate(`!!document.querySelector('.market')`),true);assert.equal(JSON.stringify(await saved()),openingBefore,'How to Play and START BUILDING do not change the saved game');
    await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(fixture))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);await sleep(120);
    await press('NEXT MONTH');await wait(`!!document.querySelector('.company-dialog[open]')`);
    let result=await saved();assert.equal(result.gamble.decision,'pending');assert.equal(result.month,30);const standard=structuredClone(result.gamble.standardResult);const pending=JSON.stringify(result);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);assert.equal(JSON.stringify(await saved()),pending);assert.equal(await evaluate(`document.querySelector('.company-dialog').open`),true);
    await reload();assert.equal(await evaluate(`document.querySelector('.company-dialog').open`),true);
    const capture=async name=>{const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);const path=join(root,name+'-'+boardWidth+'.png');await writeFile(path,Buffer.from(shot.data,'base64'));console.log('UI screenshot: '+path);};
    await evaluate(`document.documentElement.style.setProperty('--sh-safe-top','${safeTop}px');document.documentElement.style.setProperty('--sh-safe-bottom','${safeBottom}px')`);
    const assertDialogSafe=async()=>{const rect=await evaluate(`(()=>{const d=document.querySelector('.company-dialog'),r=d.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:d.clientWidth,scrollWidth:d.scrollWidth,height:innerHeight};})()`);assert.ok(rect.top>=safeTop+11);assert.ok(rect.bottom<=rect.height-safeBottom-11);assert.ok(rect.scrollWidth<=rect.width+1);};
    assert.equal(await evaluate(`document.querySelector('.gamble-valuation strong').textContent`),'$175.52M');
    assert.equal(await evaluate(`document.querySelector('.company-dialog details').open`),false);
    assert.match(await evaluate(`document.querySelector('.company-dialog').textContent`),/You hit \$100M. The board wants an exit. Your ego wants a billion./);
    await assertDialogSafe();await capture('choice-compact');
    if(!signed){await evaluate(`document.documentElement.style.fontSize='32px'`);await assertDialogSafe();await evaluate(`document.querySelector('.gamble-actions button:last-child').scrollIntoView({block:'center'})`);await capture('choice-large-text');await evaluate(`document.documentElement.style.fontSize=''`);}

    await press('DOUBLE DOWN ·');assert.equal((await saved()).gamble.decision,'extend');await wait(`!!document.querySelector('.enterprise')`);
    const introCopy='12 months. One move per month. Land clients, grow revenue, and build toward $1 billion.';
    assert.equal(await evaluate(`document.querySelector('.enterprise-intro').textContent`),introCopy);assert.equal(await evaluate(`document.querySelectorAll('.company-dialog[open]').length`),0,'No extra onboarding modal or confirmation');
    const openingExtension=JSON.stringify(await saved());await reload();await press('BUILD THE ENTERPRISE');assert.equal(await evaluate(`document.querySelector('.enterprise-intro').textContent`),introCopy);assert.equal(JSON.stringify(await saved()),openingExtension,'Restoring the introduction does not write a flag or change the save');

    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    assert.equal(await evaluate(`document.querySelectorAll('.enterprise-focuses input').length`),6);
    assert.equal(await evaluate(`document.querySelectorAll('.enterprise-metrics>div').length`),3);
    assert.equal(await evaluate(`document.querySelector('.enterprise-details').open`),false);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.focus-heading b'),e=>e.textContent)`),['LAND A PILOT','LAND BIG CLIENT','SIGN MAJOR PARTNER','EXPAND CAPACITY','IMPROVE RELIABILITY','OPERATE']);
    assert.equal(await evaluate(`document.querySelector('input[value="enterprise"]').disabled`),true);
    assert.equal(await evaluate(`document.querySelector('.enterprise-metrics>div:nth-child(2) small').textContent`),'CLIENT SLOTS');
    assert.equal(await evaluate(`document.querySelector('.enterprise-metrics>div:nth-child(2) b').textContent`),'0 / 4 slots');
    assert.match(await evaluate(`document.querySelector('input[value="enterprise"]').closest('label').textContent`),/Spend \$4M · 65% chance · \+\$2.5M\/month/);
    assert.equal(await evaluate(`document.querySelector('input[value="enterprise"]').closest('label').querySelector('.focus-block').textContent`),'Pilots 0/2 · Reliability 1/3');
    assert.equal(await evaluate(`document.querySelector('input[value="strategic"]').closest('label').querySelector('.focus-block').textContent`),'Big clients 0/2 · Reliability 1/4');

    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.next')).filter(e=>e.textContent.startsWith('NEXT MONTH')).length`),1);
    const compact=await evaluate(`(()=>{const e=document.querySelector('.enterprise');const intro=e.querySelector('.enterprise-intro');const introHeight=intro?.getBoundingClientRect().height??0;return {height:e.getBoundingClientRect().height,progressSpace:Array.from(e.querySelectorAll('.enterprise-path,.enterprise-plan'),n=>n.getBoundingClientRect().height+parseFloat(getComputedStyle(n).marginTop)+parseFloat(getComputedStyle(n).marginBottom)).reduce((a,b)=>a+b,0),introHeight,introSpace:intro?introHeight+parseFloat(getComputedStyle(intro).marginTop)+parseFloat(getComputedStyle(intro).marginBottom):0,maxRow:Math.max(...Array.from(e.querySelectorAll('.enterprise-focuses label'),r=>r.getBoundingClientRect().height))};})()`);
    assert.ok(compact.height-compact.introSpace-compact.progressSpace<700,JSON.stringify(compact));assert.ok(compact.introHeight<=64,'Introduction must stay within three short lines at normal text size');assert.ok(compact.maxRow<110);assert.ok(compact.progressSpace<350,'New path and scheduled plan remain compact');console.log('Compact enterprise '+boardWidth+': '+JSON.stringify(compact));
    const beforeDetails=JSON.stringify(await saved());
    await evaluate(`document.querySelector('.enterprise-details summary').click()`);assert.equal(await evaluate(`document.querySelector('.enterprise-details').open`),true);assert.equal(JSON.stringify(await saved()),beforeDetails);
    await evaluate(`document.querySelector('.enterprise-details summary').click();document.querySelector('.enterprise').scrollIntoView({block:'start'})`);await capture('enterprise-compact');
    if(!signed){await evaluate(`document.documentElement.style.fontSize='32px'`);assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);assert.equal(await evaluate(`Array.from(document.querySelectorAll('.enterprise-focuses label')).every(e=>e.getBoundingClientRect().height>=44&&e.scrollWidth<=e.clientWidth+1)`),true);assert.equal(await evaluate(`Array.from(document.querySelectorAll('.enterprise-metrics>div')).every(e=>e.scrollWidth<=e.clientWidth+1)`),true);await capture('enterprise-large-text');await evaluate(`document.documentElement.style.fontSize=''`);}

    assert.ok(await evaluate(`document.querySelector('.enterprise-plan').textContent.includes('No clients or upgrades')`));assert.equal(await evaluate(`document.querySelectorAll('.enterprise-path li').length`),3);
    await evaluate(`document.querySelector('input[value="pilot"]').click()`);await sleep(60);assert.equal((await saved()).gamble.enterprise.focus,'pilot');assert.ok(await evaluate(`document.querySelector('.enterprise-plan').textContent.includes('NEXT MONTH · LAND A PILOT')`));assert.ok(await evaluate(`document.querySelector('.enterprise-plan').textContent.includes('85% chance')`));assert.ok(await evaluate(`document.querySelector('.extension-controls').textContent.includes('Next focus: LAND A PILOT')`));
    await press('NEXT MONTH');assert.equal((await saved()).month,31);assert.equal((await saved()).gamble.enterprise.ledger.length,1);assert.equal((await saved()).gamble.enterprise.focus,'operate');await press('CONTINUE PLAYING');assert.ok(await evaluate(`document.querySelector('.enterprise-plan').textContent.includes('resets to OPERATE')`));assert.equal(await evaluate(`!!document.querySelector('.enterprise-intro')`),false,'Introduction disappears after the first settled extension month');
    result=await saved();await reload();assert.equal(JSON.stringify(await saved()),JSON.stringify(result),'Reload cannot replay settlement or fees');
    const putEnterprise=async snapshot=>{await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(snapshot))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);await sleep(100);await press('BUILD THE ENTERPRISE');};
    const late={...result,month:39,cash:1,labs:0,gamble:{...result.gamble,enterprise:{...result.gamble.enterprise,reliability:1,purchasedSlots:0,contracts:[{kind:'pilot',month:31},{kind:'pilot',month:32}]}}};
    await putEnterprise(late);
    const blockedCopy=await evaluate(`document.querySelector('input[value="strategic"]').closest('label').textContent`);
    for(const text of ['Big clients 0/2','Reliability 1/4','Cash $1 / $8M','Free slots 0/2','Not enough months'])assert.ok(blockedCopy.includes(text),text);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);await evaluate(`document.querySelector('input[value="strategic"]').closest('label').scrollIntoView({block:'center'})`);await capture('enterprise-blockers');
    const ready={...late,cash:20e6,labs:8,gamble:{...late.gamble,enterprise:{...late.gamble.enterprise,reliability:4,purchasedSlots:2,contracts:[...late.gamble.enterprise.contracts,{kind:'enterprise',month:35},{kind:'enterprise',month:36}]}}};
    await putEnterprise(ready);assert.equal(await evaluate(`document.querySelector('input[value="strategic"]').disabled`),false);
    await evaluate(`document.querySelector('input[value="strategic"]').click()`);await sleep(60);assert.equal((await saved()).gamble.enterprise.focus,'strategic');assert.ok(await evaluate(`document.querySelector('.enterprise-plan').textContent.includes('30% chance')`));
    await putEnterprise(result);
    await press('BUILD THE ENTERPRISE');assert.equal(await evaluate(`!!document.querySelector('.enterprise-intro')`),false,'Later cloud/device snapshots must not replay the introduction');await press('EXIT THIS CHAPTER');assert.equal(await evaluate(`document.querySelector('.company-dialog').open`),true);const beforeCancel=JSON.stringify(await saved());await press('KEEP BUILDING');assert.equal(JSON.stringify(await saved()),beforeCancel);
    await press('EXIT THIS CHAPTER');await press('CONFIRM EXTENDED EXIT');result=await saved();assert.equal(result.ended,true);assert.equal(result.gamble.extensionOutcome.reason,'early');assert.deepEqual(result.gamble.standardResult,standard);assert.equal(result.gamble.extensionOutcome.mogabr,false);assert.ok(await evaluate(`document.querySelector('.dual-result').textContent.includes('STANDARD MONTH 30: VICTORY')`));
    await press('VIEW FINAL DASHBOARD');assert.equal(await evaluate(`!!document.querySelector('button.next')&&document.querySelector('button.next').textContent.includes('VIEW FINAL COVER')`),true);
    const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(join(root,'enterprise-'+boardWidth+'.png'),Buffer.from(shot.data,'base64'));
    if(signed){await press('RANKINGS');await wait(`!!document.getElementById('overlord-title')`);assert.equal(state.saves.length,0);assert.equal(state.submits,0);assert.deepEqual(state.rankingRequests??[],[]);assert.equal(await evaluate(`document.getElementById('overlord-title').textContent`),'MOGABR');}
    else{assert.equal(state.submits,0);assert.equal(state.saves.length,0);const failure={...result,cash:-1,endingChoice:'bankrupt',gamble:{...result.gamble,unicornMonth:31,extensionOutcome:{...result.gamble.extensionOutcome,reason:'bankrupt',unicorn:true,mogabr:false}}};await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(failure))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);await wait(`!!document.querySelector('.final-cover')`);assert.ok(await evaluate(`document.querySelector('.final-cover .story-graphic').textContent.includes('SHUTDOWN')`));assert.ok(await evaluate(`document.querySelector('.dual-result').textContent.includes('UNICORN EARNED')`));assert.deepEqual((await saved()).gamble.standardResult,standard);}
    assert.deepEqual(state.errors,[]);state.disposing=true;await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);console.log('PASS: enterprise '+boardWidth+' signed='+signed+' choice/reload/settlement/cancel/exit/score isolation; screenshot '+join(root,'enterprise-'+boardWidth+'.png'));return;
   }
   await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('BUY ·')).click()`);
   await wait(`JSON.parse((localStorage.getItem('silicon-hustle-local-v1')||localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04'))).positions.h100?.qty===1`);
   await sleep(50);
   const afterGame=await evaluate(`JSON.parse((localStorage.getItem('silicon-hustle-local-v1')||localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04')))`);
   if(rankingsCase==='blocked')state.row.game_state={...afterGame,cash:afterGame.cash+1};
   const saveTraffic=structuredClone(state.saves),savedBefore=JSON.stringify(state.row),localBefore=JSON.stringify(afterGame);
   if(board){
    const allStorage=()=>evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])))`);
    const beforeOverlord=await allStorage();
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='RANKINGS').click()`);await wait(`!!document.getElementById('overlord-title')`);
    assert.equal(await evaluate(`document.getElementById('overlord-title').textContent`),'MOGABR');
    assert.equal(await evaluate(`document.querySelector('.overlord-heading p').getClientRects().length>0`),true,'Primary heading must remain visible under mobile header rules');
    assert.ok(await evaluate(`document.querySelector('.overlord').innerText.includes('SILICON HUSTLE / THE OVERLORD')`));
    assert.equal(await evaluate(`document.querySelector('.overlord-valuation strong').textContent`),'$203,718,617,301.68');
    assert.equal(await evaluate(`document.querySelector('[data-testid="personal-best-taunt"]').textContent`),"You're calling this a startup? Your investors are calling it a tax write-off.");
    assert.equal(await evaluate(`document.querySelector('.overlord-rankings li:first-child .overlord-score').textContent`),'$203,718,617,301.68');
    assert.ok(await evaluate(`(()=>{const e=document.querySelector('.overlord-valuation strong'),r=document.createRange();r.selectNodeContents(e);const box=r.getBoundingClientRect(),container=e.getBoundingClientRect();return e.scrollWidth<=e.clientWidth+1&&box.left>=container.left-1&&box.right<=container.right+1&&box.height<=parseFloat(getComputedStyle(e).lineHeight)+1;})()`),'The entire fictional valuation fits on one line without clipping');
    assert.ok(await evaluate(`document.querySelector('.overlord-coming').textContent==='TOP 10'`));
    assert.equal(await evaluate(`!!document.querySelector('.board-refresh')||!!document.querySelector('.board-publish')||!!document.querySelector('.board-rankings')`),false);
    const notices=["NVIDIA has requested permission to manufacture more GPUs.","AGI has submitted its résumé to Mogabr.","Global compute availability is subject to Mogabr's approval.","Competing AI labs have been reclassified as hobby projects.","The world's datacenters have been consolidated under one billing account.","Antitrust regulators have requested a meeting. Their compute allocation is pending."];
    const key=async(key,code,n)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:n,text:key==='Enter'?'\r':key===' '?' ':'',unmodifiedText:key==='Enter'?'\r':key===' '?' ':''},sessionId);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:n},sessionId);await sleep(30);};
    for(let index=0;index<6;index++){
     assert.equal(await evaluate(`document.querySelector('.overlord-notice p').textContent`),notices[index]);assert.equal(await evaluate(`document.querySelector('.overlord-notice>span').textContent`),(index+1)+' / 6');
     await evaluate(`document.querySelector('.overlord-system button').focus()`);assert.equal(await evaluate(`document.activeElement===document.querySelector('.overlord-system button')`),true);
     if(index===0)await key('Enter','Enter',13);else if(index===1)await key(' ','Space',32);else{await evaluate(`document.querySelector('.overlord-system button').click()`);await sleep(20);}
     await wait(`document.querySelector('.overlord-notice>span').textContent==='${(index+1)%6+1} / 6'`);
    }
    assert.equal(await evaluate(`document.querySelector('.overlord-notice p').textContent`),notices[0]);
    assert.equal(await allStorage(),beforeOverlord,'Opening and cycling THE OVERLORD cannot write any storage');
    await sleep(100);assert.deepEqual(state.rankingRequests??[],[],'No leaderboard or Edge requests');assert.equal(state.reads,0);assert.equal(state.submits,0);assert.equal(state.saves.length,0);
    assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
    assert.ok(await evaluate(`document.querySelector('.overlord-system button').getBoundingClientRect().height>=44`));
    if(boardWidth){
     await evaluate(`document.querySelector('.overlord').scrollIntoView({block:'start'})`);
     assert.ok(await evaluate(`getComputedStyle(document.querySelector('.overlord')).fontFamily.includes('Arial')`),'Mobile and desktop retain the reference sans-serif identity');
     assert.ok(await evaluate(`!!document.querySelector('.overlord-crown path')`),'Reference crown remains present');
     const clip=await evaluate(`(()=>{const r=document.querySelector('.overlord').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()`);
     const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip},sessionId);const imagePath=join(root,'overlord-'+boardWidth+(signed?'-signed':'')+'.png');await writeFile(imagePath,Buffer.from(shot.data,'base64'));console.log('Overlord screenshot: '+imagePath);
     await evaluate(`document.querySelector('.overlord').style.fontSize='20px';document.querySelectorAll('.overlord p,.overlord dd,.overlord dt,.overlord button').forEach(e=>e.style.fontSize='20px')`);
     assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'Enlarged text does not overflow');
     assert.ok(await evaluate(`Array.from(document.querySelectorAll('.overlord-metrics dd')).every(e=>e.scrollWidth<=e.clientWidth+1)`));
    }
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='MARKET').click()`);await wait(`!!document.querySelector('.market')`);assert.equal(await allStorage(),beforeOverlord);
    if(boardWidth){
     // Local-only fixtures. No provider or real account traffic is permitted.
     const qualifier={...game(),cash:10e9};
     await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(qualifier))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);await sleep(80);
     await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='RANKINGS').click()`);await wait(`!!document.querySelector('.overlord-player')`);
     assert.equal(await evaluate(`document.querySelector('.overlord-player .overlord-rank').textContent`),'#3');assert.equal(await evaluate(`document.querySelector('.overlord-name-row b').textContent`),'YOU');assert.ok(await evaluate(`document.querySelector('.overlord-player .overlord-founder').textContent.startsWith('YOU')`));
     assert.equal(await evaluate(`document.querySelectorAll('.overlord-rankings li').length`),10);
     assert.equal(await evaluate(`document.querySelector('[data-testid="personal-best-taunt"]').textContent`),"Third place. Two people still own the room, and you're paying for the coffee.");
     assert.ok(await evaluate(`document.querySelector('.overlord-profile').textContent.includes('You made the Top 10')`));
     const gameBeforeName=await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`);
     await evaluate(`Array.from(document.querySelectorAll('.overlord-profile button')).find(b=>b.textContent==='Skip').click()`);await wait(`!document.querySelector('.overlord-profile').textContent.includes('You made the Top 10')`);
     assert.equal(await evaluate(`document.querySelector('.overlord-name-row b').textContent`),'YOU');

     await evaluate(`Array.from(document.querySelectorAll('.overlord-profile button')).find(b=>b.textContent==='Edit Name').click()`);
     assert.equal(await evaluate(`document.activeElement.id`),'rankings-founder-name');
     await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
     await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);
     await wait(`!document.getElementById('rankings-founder-name')`);assert.equal(await evaluate(`document.activeElement.textContent`),'Edit Name');
     await evaluate(`Array.from(document.querySelectorAll('.overlord-profile button')).find(b=>b.textContent==='Edit Name').click()`);await wait(`document.activeElement.id==='rankings-founder-name'`);
     await evaluate(`(()=>{const e=document.getElementById('rankings-founder-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'<script>');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(30);
     await evaluate(`document.querySelector('.overlord-profile form').requestSubmit()`);await wait(`!!document.querySelector('.overlord-profile [role="alert"]')`);
     assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),gameBeforeName);

     await evaluate(`(()=>{const e=document.getElementById('rankings-founder-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Nova Forge');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(30);
     await evaluate(`document.querySelector('.overlord-profile form').requestSubmit()`);await wait(`document.querySelector('.overlord-player .overlord-founder').textContent.includes('Nova Forge')`);
     assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),gameBeforeName,'Name changes cannot change the game snapshot');assert.equal(await evaluate(`document.activeElement.textContent`),'Edit Name');
     assert.ok(!await evaluate(`document.querySelector('.overlord-profile').textContent.includes('You made the Top 10')`));
     // Exercise the real final-cover handler, not a synthesized exitResult.
     const exitGame={...game(),month:42,cash:13e9,ended:true,gamble:{version:1,decision:'extend',standardResult:{month:30,valuation:100e6,peak:100e6,success:true,ending:'acquisition'},enterprise:{reliability:1,purchasedSlots:0,contracts:[],discountThrough:0,focus:'operate',ledger:[]},extensionOutcome:{month:42,valuation:13020e6,reason:'completed',unicorn:true,mogabr:false}}};
     await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(exitGame))});window.dispatchEvent(new Event('silicon-hustle-reload'))`);await wait(`!!document.querySelector('.final-cover .offers button')`);
     await evaluate(`document.querySelectorAll('.final-cover .offers button')[2].click()`);await wait(`document.querySelector('.accepted')?.textContent.includes('exit value')`);
     const completed=await evaluate(`JSON.parse(localStorage.getItem('silicon-hustle-local-v1'))`);
     assert.equal(completed.exitResult.valuation,15624e6);assert.equal(completed.cash,13e9);assert.deepEqual(completed.gamble.standardResult,exitGame.gamble.standardResult);
     await evaluate(`document.querySelector('.final-actions button').click();Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='RANKINGS').click()`);await wait(`!!document.querySelector('.overlord-player')`);
     assert.ok(await evaluate(`document.querySelector('.overlord-personal').textContent.includes('$15,624,000,000.00')`));
     assert.equal(await evaluate(`document.querySelector('[data-testid="personal-best-taunt"]').textContent`),"You're worth more than Gabe M. He's still #2. Welcome to corporate governance.");
     assert.ok(await evaluate(`document.querySelector('.overlord-record-details').textContent.includes('Acquisition')&&document.querySelector('.overlord-record-details').textContent.includes('Month 42')`));
     assert.equal(await evaluate(`document.querySelectorAll('.overlord-rankings li').length`),10);
     assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
     await evaluate(`document.querySelector('.overlord').scrollIntoView({block:'start'})`);
     const clip=await evaluate(`(()=>{const r=document.querySelector('.overlord').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()`);
     const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip},sessionId);await writeFile(join(root,'personalized-rankings-'+boardWidth+'.png'),Buffer.from(shot.data,'base64'));
     await evaluate(`document.documentElement.style.fontSize='24px';document.querySelectorAll('.overlord p,.overlord dd,.overlord dt,.overlord button,.overlord-founder,.overlord-score').forEach(e=>e.style.fontSize='20px')`);
     assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'Personalized records and name controls fit enlarged text');
     await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.final-actions button')`);await evaluate(`document.querySelector('.final-actions button').click();Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='RANKINGS').click()`);await wait(`!!document.querySelector('.overlord-player')`);
     assert.ok(await evaluate(`document.querySelector('.overlord-player').textContent.includes('Nova Forge')`));
     assert.ok(await evaluate(`document.querySelector('.overlord-record-details').textContent.includes('Acquisition')`));
     assert.ok(!await evaluate(`document.querySelector('.overlord-profile').textContent.includes('You made the Top 10')`));
     const bestBeforeReset=await evaluate(`document.querySelector('.overlord-personal strong').textContent`),gameBeforeReset=await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`);
     await evaluate(`Array.from(document.querySelectorAll('.overlord-profile button')).find(b=>b.textContent==='Reset Name').click()`);await wait(`document.querySelector('.overlord-name-row b').textContent==='YOU'`);
     assert.ok(await evaluate(`document.querySelector('.overlord-player .overlord-founder').textContent.startsWith('YOU')`));
     await evaluate(`Array.from(document.querySelectorAll('.overlord-profile button')).find(b=>b.textContent==='Edit Name').click()`);await wait(`!!document.getElementById('rankings-founder-name')`);
     await evaluate(`(()=>{const e=document.getElementById('rankings-founder-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await sleep(30);await evaluate(`document.querySelector('.overlord-profile form').requestSubmit()`);await wait(`!document.getElementById('rankings-founder-name')`);
     assert.equal(await evaluate(`document.querySelector('.overlord-name-row b').textContent`),'YOU');assert.equal(await evaluate(`document.querySelector('.overlord-personal strong').textContent`),bestBeforeReset);assert.equal(await evaluate(`localStorage.getItem('silicon-hustle-local-v1')`),gameBeforeReset);
     await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.final-actions button')`);await evaluate(`document.querySelector('.final-actions button').click();Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='RANKINGS').click()`);await wait(`!!document.querySelector('.overlord-player')`);
     assert.equal(await evaluate(`document.querySelector('.overlord-name-row b').textContent`),'YOU');assert.ok(await evaluate(`document.querySelector('.overlord-player .overlord-founder').textContent.startsWith('YOU')`));
     assert.ok(!await evaluate(`document.querySelector('.overlord-profile').textContent.includes('You made the Top 10')`));
     assert.equal(state.submits,0);assert.equal(state.saves.length,0);assert.deepEqual(state.rankingRequests??[],[]);
     console.log('PASS: personalized local rank/name/restart/real acquisition/provenance/no-network at width '+boardWidth);
    }

   }
   if(interactive){
    const saved=()=>evaluate(`JSON.parse((localStorage.getItem('silicon-hustle-local-v1')||localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04')))`);
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
     const compact=await evaluate(`(()=>{for(const sheet of document.styleSheets){const index=Array.from(sheet.cssRules).findIndex(rule=>rule.cssText.includes('.mobile-layout .holdings-table tbody tr'));if(index>=0){const css=sheet.cssRules[index].cssText;sheet.deleteRule(index);const before=document.querySelector('.holdings').getBoundingClientRect().height;sheet.insertRule(css,index);const after=document.querySelector('.holdings').getBoundingClientRect().height;return {before,after,reduction:(before-after)/before*100};}}throw Error('Compact rule missing');})()`);
     console.log('Portfolio height '+interactive+': '+JSON.stringify(compact));assert.ok(compact.reduction>=28&&compact.reduction<=38,'Expanded portfolio is approximately one-third shorter');
     const portfolioShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:await evaluate(`(()=>{const r=document.querySelector('.holdings').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()`)},sessionId);await writeFile(join(root,'portfolio-'+interactive+'.png'),Buffer.from(portfolioShot.data,'base64'));console.log('Portfolio screenshot: '+join(root,'portfolio-'+interactive+'.png'));

     assert.equal(await evaluate(`Array.from(document.querySelectorAll('.holdings-table td')).filter(cell=>cell.getClientRects().length).every(cell=>cell.scrollWidth<=cell.clientWidth+1)`),true,'Every financial cell fits without clipping');
     assert.equal(await evaluate(`document.querySelectorAll('.holdings-table tbody td').length`),6);
     assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.holdings-table tbody td')).map(cell=>cell.textContent.trim())`),['NVIDIA H100 SXM','1','$34,340','$34,000','$33,660','−$680'],'All figures retain their fee-aware values');
     assert.equal(await evaluate(`Array.from(document.querySelectorAll('.holdings-table tfoot td')).filter(cell=>cell.getClientRects().length).length`),2,'Totals strip contains only cost basis and net sale value');
     assert.equal(await evaluate(`(()=>{const cells=document.querySelectorAll('.holdings-table tbody td');return Math.abs(cells[0].getBoundingClientRect().top-cells[1].getBoundingClientRect().top)<1;})()`),true,'Quantity sits beside the hardware name');

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
    const previous=(await saved()).prices;await evaluate(`Array.from(document.querySelectorAll('button.next')).find(b=>b.textContent.startsWith('NEXT MONTH')).click()`);await wait(`JSON.parse((localStorage.getItem('silicon-hustle-local-v1')||localStorage.getItem('silicon-hustle-v04')||localStorage.getItem('compute-empire-v04'))).month===3`);
    g=await saved();assert.deepEqual(g.previousMarket,{forMonth:3,prices:previous});
    await click(`document.querySelector('.close-report')`);await sleep(40);await open();
    const change=g.prices.h100-previous.h100;assert.ok((await text('chip-monthly-change')).includes(Math.abs(change).toLocaleString('en-US')));assert.equal(await text('chip-previous-price'),'$34,000');
    const screenshot=await send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(join(root,'chip-panel-'+interactive+'.png'),Buffer.from(screenshot.data,'base64'));console.log('Panel screenshot: '+join(root,'chip-panel-'+interactive+'.png'));
    await key('Escape','Escape',27);await wait(`!document.querySelector('.chip-trading-panel')`);
    await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);await sleep(80);await open();
    assert.equal(await text('chip-previous-price'),'$34,000','Monthly baseline survives reload');
    await key('Escape','Escape',27);await wait(`!document.querySelector('.chip-trading-panel')`);
    await evaluate(`Array.from(document.querySelectorAll('.foot button')).find(b=>b.textContent==='NEW GAME').click()`);await sleep(30);await evaluate(`Array.from(document.querySelectorAll('.foot button')).find(b=>b.textContent==='YES').click()`);await sleep(30);assert.equal((await saved()).previousMarket,undefined,'New game cannot inherit a previous game baseline');
    const loadFixture=async fixture=>{await evaluate(`localStorage.setItem('silicon-hustle-local-v1',${JSON.stringify(JSON.stringify(fixture))})`);await send('Page.reload',{},sessionId);await wait(`!!document.querySelector('.shell')`);await sleep(80);};
    const large=game();large.positions.h100={qty:1500,cost:1500*34340};await loadFixture(large);await open();await evaluate(`Array.from(document.querySelectorAll('.chip-sides button')).find(b=>b.textContent==='SELL').click()`);await sleep(30);await evaluate(`Array.from(document.querySelectorAll('.chip-trading-panel button')).find(b=>b.textContent==='ALL').click()`);await sleep(30);assert.equal(await evaluate(`document.getElementById('chip-quantity').value`),'999');assert.ok(await evaluate(`document.querySelector('.chip-order').textContent.includes('ALL selects the maximum 999')`));await click(`document.getElementById('chip-confirm')`);await wait(`document.querySelector('[data-testid="chip-owned"]').textContent==='501'`);assert.equal((await saved()).positions.h100.cost,501*34340);await key('Escape','Escape',27);
    const unknown=game();unknown.positions.h100={qty:1};await loadFixture(unknown);const unknownBefore=JSON.stringify(await saved());await open();assert.equal(await text('chip-average'),'Unavailable');assert.equal(await text('chip-unrealized'),'Unavailable');assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);await click(`document.getElementById('chip-confirm')`);assert.equal(JSON.stringify(await saved()),unknownBefore);await key('Escape','Escape',27);
    const ended=game();ended.ended=true;ended.ending='Synthetic end';await loadFixture(ended);await click(`document.querySelector('.final-actions button')`);await sleep(30);await open();assert.equal(await evaluate(`document.getElementById('chip-confirm').disabled`),true);assert.ok(await evaluate(`document.querySelector('.chip-order-error').textContent.includes('Trading is closed')`));await key('Escape','Escape',27);assert.deepEqual(await saved(),ended);
    await loadFixture(game());await open();const beforeConflict=JSON.stringify(await saved());await evaluate(`(()=>{const overlay=document.createElement('div');overlay.className='sh-gate';document.body.append(overlay);})()`);await wait(`!document.querySelector('.chip-trading-panel')`);assert.equal(JSON.stringify(await saved()),beforeConflict,'Existing account/conflict UI dismisses sheet without a write');
    assert.equal(state.submits,0);assert.equal(state.saves.length,0);

    console.log('PASS: interactive chip panel '+interactive+' buy/sell fees, MAX/ALL, quantities, legacy baseline, monthly snapshot, focus, dismissal and layout');
   }
   assert.deepEqual(state.errors,[]);state.disposing=true;await send('Target.disposeBrowserContext',{browserContextId});states.delete(sessionId);return {afterGame,saveTraffic,reads:state.reads};
  }
  if(!process.env.GAMBLE_BROWSER_ONLY){
  for(const options of [{signed:false},{signed:false,legacy:true},{signed:true}]){
   const original=await scenario('main',options),release=await scenario('release',{...options,board:true});assert.deepEqual(release.afterGame,original.afterGame);assert.deepEqual(release.saveTraffic,original.saveTraffic,'Original save request shapes and payloads must match main');console.log('PASS: baseline gameplay/save parity '+JSON.stringify(options));
  }
  for(const options of [{profileCase:'chosen'},{profileCase:'chosen',signed:true},{profileCase:'legacy',legacy:true},{profileCase:'fallback',signed:true}])await scenario('release',{...options,boardWidth:320});
  for(const localCase of ['first','offline','invalid','future','quota'])await scenario('release',{localCase,noLocal:['first','offline'].includes(localCase),boardWidth:320});
  await scenario('release',{localCase:'first',noLocal:true,signed:true,boardWidth:390});
  await scenario('release',{localCase:'offline',noLocal:true,signed:true,boardWidth:390});
  for(const interactive of ['desktop','mobile','small'])await scenario('release',{interactive});
  for(const boardWidth of [1280,390,320])await scenario('release',{board:true,publicEntry:true,boardWidth});console.log('PASS: THE OVERLORD exact value, manual accessible notices, unchanged storage and zero RPCs at desktop/mobile widths');
  for(const variant of ['missingurl','missingkey','missingboth','invalidurl']){await scenario(variant,{board:true,configurationMissing:true});console.log('PASS: missing Preview configuration '+variant+' opens THE OVERLORD with no RPC or configuration dependency');}
  await scenario('release',{board:true,readError:true});console.log('PASS: THE OVERLORD never requests a potentially unavailable Rankings backend');
  await scenario('release',{signed:true,board:true,publicEntry:true,boardWidth:390});console.log('PASS: signed-in THE OVERLORD remains fictional with zero requests or storage writes');

  }
  for(const boardWidth of [1280,390,320])await scenario('release',{gambleCase:true,boardWidth});
  await scenario('release',{signed:true,empty:true,gambleCase:true,boardWidth:390});
  for(const boardWidth of [320,390])for(const recoveryChoice of ['current','historical'])await scenario('release',{boardWidth,recoveryChoice});
  await scenario('release',{signed:true,accountCase:true,boardWidth:390});
  await send('Browser.close');
 }finally{ws?.close();child.kill('SIGTERM');await new Promise(r=>server.close(r));}
});
