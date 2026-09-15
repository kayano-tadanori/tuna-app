/* Real headless Chrome integration test. No third-party packages or source images. */
'use strict';
const fs=require('node:fs/promises'), path=require('node:path'), os=require('node:os');
const http=require('node:http'), {spawn}=require('node:child_process'), assert=require('node:assert/strict');
const chrome=process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function poll(fn,description){for(let i=0;i<100;i++){const result=await fn();if(result)return result;await sleep(100);}throw Error('Timed out: '+description);}
async function main(){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'origami-authoring-'));
  const server=http.createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://local').pathname;
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    const file=path.resolve(__dirname,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(__dirname+path.sep)){res.writeHead(403).end();return;}
    try{const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(bytes);}
    catch{res.writeHead(404).end();}
  });
  let browser,ws;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const url=`http://127.0.0.1:${server.address().port}/fold2d_editor.html`;
    const profile=path.join(temp,'profile'),downloads=path.join(temp,'downloads');await fs.mkdir(downloads);
    browser=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
    let launchError;browser.on('error',e=>launchError=e);
    const port=await poll(async()=>{if(launchError)throw launchError;try{return Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return null;}},'Chrome debug port');
    const tab=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let next=0;const pending=new Map(), errors=[];
    ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
      else if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'||m.method==='Log.entryAdded'&&m.params.entry.level==='error') errors.push(m);};
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    const evaluate=async(expression)=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
    const fill=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const upload=async(selector,file)=>{const {root}=await cdp('DOM.getDocument');const {nodeId}=await cdp('DOM.querySelector',{nodeId:root.nodeId,selector});await cdp('DOM.setFileInputFiles',{nodeId,files:[file]});};
    const stamp=()=>evaluate('JSON.stringify(LAB.importState)');
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Log.enable');
    await cdp('Emulation.setDeviceMetricsOverride',{width:1480,height:980,deviceScaleFactor:1,mobile:false});
    await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    await cdp('Page.navigate',{url});await poll(()=>evaluate('!!window.oriAuthor'),'authoring mounted');
    if(process.argv.includes('--lion')){
      await require('./test_lion_recipe_browser.js')({cdp,evaluate,click,fill,upload,poll,temp,downloads,errors});
      await cdp('Browser.close').catch(()=>{});return;
    }
    // Make a test raster in memory; never read or alter _zu reference images.
    const png=await evaluate(`(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#eee4ce';x.fillRect(0,0,320,240);x.strokeStyle='#305ca0';x.lineWidth=5;x.strokeRect(45,25,230,190);x.beginPath();x.moveTo(45,25);x.lineTo(275,215);x.stroke();return c.toDataURL('image/png').split(',')[1];})()`);
    const imageFile=path.join(temp,'private-reference.png');await fs.writeFile(imageFile,Buffer.from(png,'base64'));
    const initial=await stamp();await upload('#a-image',imageFile);await poll(()=>evaluate('oriAuthor.imageVisible'),'local image decoded');
    assert.equal(await stamp(),initial,'image load changed editing state');
    const raster=()=>evaluate('document.getElementById("cA").toDataURL()');
    const shown=await raster();await click('a-visible');assert.notEqual(await raster(),shown,'hide did not affect pixels');await click('a-visible');
    await fill('a-opacity',0);const transparent=await raster();await fill('a-opacity',.8);assert.notEqual(await raster(),transparent,'opacity did not affect pixels');
    await fill('a-scale',1.5);assert.notEqual(await raster(),shown,'scale did not affect pixels');
    await click('a-image-mode');const beforeDrag=await raster();
    const rect=await evaluate(`(()=>{const r=cA.getBoundingClientRect();return {x:r.x+120,y:r.y+200};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+65,y:rect.y+35,button:'left',buttons:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+65,y:rect.y+35,button:'left',clickCount:1});
    assert.notEqual(await raster(),beforeDrag,'image drag did not affect pixels');assert.equal(await stamp(),initial,'image controls changed editing state');
    await click('a-line-mode');assert.equal(await evaluate('oriAuthor.imageMode'),false);
    await click('a-reset-image');
    const sample=JSON.parse(await fs.readFile(path.join(__dirname,'recipe_examples/triangle.origami.json'),'utf8'));
    await fill('a-work-id',sample.work.id);await fill('a-work-name',sample.work.name);await fill('a-emoji',sample.work.emoji);await fill('a-note',sample.source.note);
    await click('a-new');await poll(()=>evaluate('oriAuthor.active'),'new authoring draft');
    assert.equal(await evaluate('LAB.importState.importedRecipe'),null,'empty draft became exportable');
    const enter=async s=>{
      await fill('a-step-id',s.id);await fill('a-diagram',s.diagramStep);await fill('a-instruction',s.instruction);
      await fill('a-op',s.op);await fill('a-kind',s.kind);
      const ref=s.reference.faceId==='paper'&&s.reference.layerPath?'paper'+s.reference.layerPath.map(p=>`/${p.stepId}.${p.side}`).join(''):s.reference.faceId;
      await fill('a-reference',ref);await fill('a-point-a',s.line[0].join(', '));await fill('a-point-b',s.line[1].join(', '));await fill('a-point-moving',s.movingSidePoint.join(', '));
      await evaluate(`document.querySelectorAll('#a-faces input').forEach(e=>{e.checked=${JSON.stringify(s.targets.map(t=>t.faceId))}.includes(e.value);e.dispatchEvent(new Event('change',{bubbles:true}));})`);
    };
    for(let i=0;i<2;i++){
      await enter(sample.steps[i]);const before=await stamp();await click('a-validate');
      assert.equal(await evaluate('document.getElementById("a-confirm").disabled'),false,'validation did not succeed');
      assert.equal(await stamp(),before,'validation committed state');const beforePixels=await raster();
      await click('a-after');assert.notEqual(await raster(),beforePixels,'before/after preview identical');assert.equal(await stamp(),before,'preview committed state');
      await click('a-before');assert.equal(await raster(),beforePixels);
      await click('a-confirm');assert.equal(await evaluate('LAB.st.steps.length'),i+1);
      if(i===0){
        // A current-space click on the reflected face must become original coordinates.
        await fill('a-reference','paper/s1.cut');await click('a-pick-moving');
        const q=await evaluate(`(()=>{const p=W2S(viewBox(cA,LAB.st),[-.6,.2]),r=cA.getBoundingClientRect();return {x:p[0]+r.x,y:p[1]+r.y};})()`);
        await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...q,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...q,button:'left',clickCount:1});
        const picked=(await evaluate('document.getElementById("a-point-moving").value')).split(',').map(Number);
        assert.ok(Math.abs(picked[0]-.2)<.025&&Math.abs(picked[1]+.6)<.025,'picked coordinates are not original-space');
      }
    }
    const twoSteps=await stamp();
    await fill('a-point-a','0, 0');await fill('a-point-b','0, 0');await click('a-validate');
    assert.equal(await evaluate('document.getElementById("a-confirm").disabled'),true);assert.equal(await stamp(),twoSteps,'invalid input altered committed state');
    await click('a-remove');assert.equal(await evaluate('LAB.st.steps.length'),1);await click('a-validate');await click('a-after');await click('a-confirm');
    assert.equal(await stamp(),twoSteps,'remove/re-enter did not recover original state');
    await click('a-save');const saved=path.join(downloads,sample.work.id+'.origami.json');
    await poll(async()=>{try{return await fs.readFile(saved,'utf8');}catch{return null;}},'recipe download');
    const text=await fs.readFile(saved,'utf8'),output=JSON.parse(text);
    // Reference shorthand can normalize to full IDs; compare actual replay as well as metadata.
    assert.deepEqual(output.work,sample.work);assert.deepEqual(output.source,sample.source);
    assert.equal(output.steps.length,2);assert.ok(!/private-reference|blob:|data:image|imageScale|opacity|offset/.test(text));
    assert.deepEqual(Object.keys(output).sort(),Object.keys(sample).sort());
    const savedState=await evaluate('JSON.stringify(LAB.st.clone())');await upload('#fileIn',saved);
    await poll(()=>evaluate('!oriAuthor.active'),'import ends authoring');assert.equal(await evaluate('JSON.stringify(LAB.st.clone())'),savedState);
    assert.equal(await evaluate('oriAuthor.imageVisible'),true,'import should not serialize or reset transient image');
    // Malformed file and unsupported operation still preserve the phase-1 import state.
    const bad=path.join(temp,'broken.json');await fs.writeFile(bad,'{ broken');const beforeBad=await stamp();await upload('#fileIn',bad);
    await poll(()=>evaluate('document.getElementById("status").textContent.includes("読み込みに失敗")'),'malformed error');assert.equal(await stamp(),beforeBad);
    await click('a-adopt');await poll(()=>evaluate('oriAuthor.active'),'adopt imported recipe');
    await evaluate(`(()=>{const o=document.createElement('option');o.value='squash';o.textContent='unsupported test';document.getElementById('a-op').appendChild(o);})()`);
    await fill('a-op','squash');await click('a-validate');assert.equal(await evaluate('document.getElementById("a-confirm").disabled'),true);
    assert.match(await evaluate('document.getElementById("a-message").textContent'),/未対応/);
    await fill('a-op','fold');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("a-flip-fields")).display'),'none','flip fields visible for fold');
    await fill('a-op','flip');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("a-fold-fields")).display'),'none','fold fields visible for flip');
    assert.notEqual(await evaluate('getComputedStyle(document.getElementById("a-flip-fields")).display'),'none');
    await fill('a-op','fold');
    assert.equal(await evaluate('document.getElementById("side").scrollWidth<=document.getElementById("side").clientWidth'),true,'sidebar overflows horizontally');
    await evaluate('document.getElementById("a-reference").scrollIntoView({block:"start"})');
    const formShot=await cdp('Page.captureScreenshot',{format:'png'});
    await fs.writeFile(path.join(os.tmpdir(),'origami-authoring-form.png'),Buffer.from(formShot.data,'base64'));
    // Save one screenshot outside the repository for visual inspection.
    await evaluate('document.getElementById("side").scrollTop=0');
    const shot=await cdp('Page.captureScreenshot',{format:'png'});
    const screenshot=path.join(os.tmpdir(),'origami-authoring-browser.png');await fs.writeFile(screenshot,Buffer.from(shot.data,'base64'));
    await cdp('Page.reload',{ignoreCache:true});await poll(()=>evaluate('!!window.oriAuthor'),'reload');
    assert.equal(await evaluate('oriAuthor.imageVisible'),false,'image survived reload');assert.equal(await evaluate('oriAuthor.active'),false);
    assert.deepEqual(errors,[],'browser console errors');
    console.log(JSON.stringify({result:'PASS',checks:['local image, visibility, drag, scale, opacity','image/input mode isolation','2 steps: validate, before/after preview, confirm','original-coordinate picking on reflected face','invalid input atomicity and tail replacement','v1 save/reimport and no image information','malformed JSON and unsupported operation rejection','reload discards image','console errors: 0'],screenshot},null,2));
    await cdp('Browser.close').catch(()=>{});
  }finally{
    ws?.close();browser?.kill();server.close();await sleep(500);
    await fs.rm(temp,{recursive:true,force:true,maxRetries:6,retryDelay:300});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
