/* Real Chrome A2 check: rendering, crease state, undo, persistence, no console errors. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function poll(fn,label){for(let i=0;i<120;i++){const x=await fn();if(x)return x;await sleep(100)}throw Error('timeout: '+label)}
async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'origami-a2-'));let browser,ws;
 const server=http.createServer(async(req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://x').pathname);if(pathname==='/favicon.ico'){res.writeHead(204).end();return}const p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return}try{const b=await fs.readFile(p);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(b)}catch{res.writeHead(404).end()}});
 try{
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
  browser=spawn(process.env.ORIGAMI_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+path.join(temp,'profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
  let launchError;browser.on('error',e=>launchError=e);const port=await poll(async()=>{if(launchError)throw launchError;try{return Number((await fs.readFile(path.join(temp,'profile','DevToolsActivePort'),'utf8')).split('\n')[0])}catch{return 0}},'Chrome');
  const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
  let seq=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.no(Error(JSON.stringify(m.error))):p.ok(m.result)}}else if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'||m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m)};
  const cdp=(method,params={})=>new Promise((ok,no)=>{const id=++seq;pending.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}))});
  const evalx=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Log.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1,mobile:false});
  const url=`http://127.0.0.1:${server.address().port}/origami/index.html`;await cdp('Page.navigate',{url});await poll(()=>evalx('!!window._origamiDebug&&!!ORIGAMI_WORKS.proto_lion_v1'),'app');
  await evalx("_origamiDebug.openFold('work',ORIGAMI_WORKS.proto_lion_v1)");
  assert.equal(await evalx('document.querySelector("#ori-hint").textContent'),await evalx('ORIGAMI_WORKS.proto_lion_v1.steps[0].hintLabel'));
  let seen=[],screenshots=[];
  for(let i=0;i<6;i++){
   const info=await evalx(`(()=>{const s=_origamiDebug.inst.state,st=s.work.steps[s.stepIndex];return {i:s.stepIndex,op:st&&st.op,lines:_origamiDebug.inst.activeCreaseLines().length,button:!document.getElementById('ori-crease-done').hidden,layers:_origamiDebug.inst.debugLayers()}})()`);
   assert.equal(info.i,i);assert.ok(info.lines>0);seen.push(info);
   const frameShot=await cdp('Page.captureScreenshot',{format:'png'}),framePath=path.join(os.tmpdir(),`proto-lion-v1-a2-step-${i+1}.png`);await fs.writeFile(framePath,Buffer.from(frameShot.data,'base64'));screenshots.push(framePath);
   if(info.op==='crease')await evalx("document.getElementById('ori-crease-done').click()");
   else await evalx(`(()=>{const s=_origamiDebug.inst.state,st=s.work.steps[s.stepIndex];s.liveAngle[st.handle.boneId]=st.targetAngle;FOLD.syncLinkedAngle(s,st.handle.boneId,st.targetAngle,st);s.committedAngle[st.handle.boneId]=st.targetAngle;for(const x of st.handle.linkedBoneIds||[]){const b=typeof x==='number'?x:x.boneId;s.committedAngle[b]=s.liveAngle[b]}s.stepIndex++;s.mode='idle'})()`);
   await sleep(120);
  }
  assert.equal(await evalx('_origamiDebug.inst.state.stepIndex'),6);assert.equal(await evalx('_origamiDebug.inst.state.recordedCreases.size'),2);
  assert.ok(new Set((await evalx('_origamiDebug.inst.debugLayers()')).map(x=>x.toFixed(4))).size>1,'face layers absent');
  const finalShot=await cdp('Page.captureScreenshot',{format:'png'}),finalScreenshot=path.join(os.tmpdir(),'proto-lion-v1-a2-final.png');await fs.writeFile(finalScreenshot,Buffer.from(finalShot.data,'base64'));
  await evalx("document.getElementById('ori-step-back').click()");await sleep(150);assert.equal(await evalx('_origamiDebug.inst.state.stepIndex'),5);
  assert.deepEqual(await evalx('_origamiDebug.inst.state.liveAngle'),await evalx('ORIGAMI_WORKS.proto_lion_v1.recipePlayback.frames[5].boneAngles'));
  // Return to the second crease and verify that undo removes only its record.
  await evalx(`(()=>{const s=_origamiDebug.inst.state,p=s.work.recipePlayback.frames[2];s.stepIndex=2;s.liveAngle=p.boneAngles.slice();s.committedAngle=p.boneAngles.slice();s.recordedCreases=new Set(p.recordedCreases);s.mode='idle'})()`);
  await evalx("document.getElementById('ori-step-back').click()");assert.deepEqual(await evalx('Array.from(_origamiDebug.inst.state.recordedCreases)'),['s1']);
  await evalx("document.getElementById('ori-crease-done').click()");await sleep(150);const saved=await evalx("localStorage.getItem('origami.recipePlayback.v1.proto_lion_v1')");assert.ok(saved);
  await cdp('Page.reload',{ignoreCache:true});await poll(()=>evalx('!!window._origamiDebug&&!!ORIGAMI_WORKS.proto_lion_v1'),'reload');await evalx("_origamiDebug.openFold('work',ORIGAMI_WORKS.proto_lion_v1)");
  assert.equal(await evalx('_origamiDebug.inst.state.stepIndex'),2);assert.deepEqual(await evalx('Array.from(_origamiDebug.inst.state.recordedCreases)'),['s1','s2']);
  const shot=await cdp('Page.captureScreenshot',{format:'png'}),screenshot=path.join(os.tmpdir(),'proto-lion-v1-a2.png');await fs.writeFile(screenshot,Buffer.from(shot.data,'base64'));
  assert.equal(await evalx('ORIGAMI_WORKS.lion.id'), 'lion');assert.equal(await evalx('ORIGAMI_WORKS.lion.recipePlayback===undefined'),true);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',steps:seen,undo:true,saveReload:true,existingLionUnchanged:true,consoleErrors:0,screenshots,finalScreenshot,restoredScreenshot:screenshot},null,2));await cdp('Browser.close').catch(()=>{});
 }finally{ws?.close();browser?.kill();server.close();await sleep(500);if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir()))throw Error('unsafe temp');await fs.rm(temp,{recursive:true,force:true,maxRetries:7,retryDelay:300})}
}
main().catch(e=>{console.error(e);process.exitCode=1});
