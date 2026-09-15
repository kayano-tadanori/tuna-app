/* Minimal real-Chrome test for recipe_examples/suika2.origami.json only.
   Types the six steps into the authoring form, replays, saves and re-imports.
   No third-party packages; _zu reference images are never opened. */
'use strict';
const fs=require('node:fs/promises'), path=require('node:path'), os=require('node:os');
const http=require('node:http'), {spawn}=require('node:child_process'), assert=require('node:assert/strict');
const chrome=process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RECIPE=path.join(__dirname,'recipe_examples/suika2.origami.json');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const poll=async(fn,what)=>{for(let i=0;i<100;i++){const r=await fn();if(r)return r;await sleep(100);}throw Error('Timed out: '+what);};
const area=panels=>panels.reduce((sum,p)=>sum+Math.abs(p.poly.reduce((a,q,i)=>{const n=p.poly[(i+1)%p.poly.length];return a+q[0]*n[1]-q[1]*n[0];},0))/2,0);
const near=(a,b,tol=1e-9)=>Math.abs(a-b)<tol;
const facing=p=>Math.sign(p.xf[0]*p.xf[3]-p.xf[1]*p.xf[2]);

async function main(){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'origami-suika2-'));
  const recipeText=await fs.readFile(RECIPE,'utf8'), recipe=JSON.parse(recipeText);
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
    const profile=path.join(temp,'profile'), downloads=path.join(temp,'downloads');await fs.mkdir(downloads);
    browser=spawn(chrome,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
    let launchError;browser.on('error',e=>launchError=e);
    const port=await poll(async()=>{if(launchError)throw launchError;try{return Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return null;}},'Chrome debug port');
    const tab=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let next=0;const pending=new Map(), errors=[];
    ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
      else if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'||m.method==='Log.entryAdded'&&m.params.entry.level==='error') errors.push(m);};
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
    const fill=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const upload=async(selector,file)=>{const {root}=await cdp('DOM.getDocument');const {nodeId}=await cdp('DOM.querySelector',{nodeId:root.nodeId,selector});await cdp('DOM.setFileInputFiles',{nodeId,files:[file]});};
    const stamp=()=>evaluate('JSON.stringify(LAB.importState)');
    // Topmost face under a point of the current view; side +1 = colour up, -1 = white up.
    const topFace=([x,y])=>evaluate(`(()=>{const p=LAB.st.panels.filter(p=>pointInPolygon([${x},${y}],p.poly)).sort((a,b)=>b.layer-a.layer)[0];
      return p?{id:p.recipeFace.faceId,layer:p.layer,side:Math.sign(p.xf[0]*p.xf[3]-p.xf[1]*p.xf[2])}:null;})()`);
    await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Log.enable');
    await cdp('Emulation.setDeviceMetricsOverride',{width:1480,height:980,deviceScaleFactor:1,mobile:false});
    await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    await cdp('Page.navigate',{url});await poll(()=>evaluate('!!window.oriAuthor'),'authoring mounted');

    // --- input: work header, then every step, through the real form ---
    await fill('a-work-id',recipe.work.id);await fill('a-work-name',recipe.work.name);
    await fill('a-emoji',recipe.work.emoji);await fill('a-difficulty',recipe.work.difficulty);
    await fill('a-ratio',recipe.paper.aspectRatio);await fill('a-note',recipe.source.note);
    assert.equal(await evaluate('document.getElementById("a-color").checked'),recipe.paper.colorDown,'colorDown differs from the form');
    await click('a-new');await poll(()=>evaluate('oriAuthor.active'),'authoring started');
    const frames=[];
    for(const step of recipe.steps){
      await fill('a-step-id',step.id);await fill('a-diagram',step.diagramStep);
      await fill('a-instruction',step.instruction);await fill('a-op',step.op);
      if(step.op==='flip'){
        await fill('a-axis',step.axis);
        assert.equal(await evaluate('document.getElementById("a-axis").value'),step.axis,'flip axis not accepted: '+step.id);
        assert.equal(await evaluate('getComputedStyle(document.getElementById("a-fold-fields")).display'),'none','fold fields shown for a flip');
      }else{
        await fill('a-kind',step.kind);await fill('a-reference',step.reference.faceId);
        assert.equal(await evaluate('document.getElementById("a-reference").value'),step.reference.faceId,'reference face missing: '+step.reference.faceId);
        await fill('a-point-a',step.line[0].join(', '));await fill('a-point-b',step.line[1].join(', '));
        await fill('a-point-moving',step.movingSidePoint.join(', '));
        await evaluate(`document.querySelectorAll('#a-faces input').forEach(e=>{e.checked=${JSON.stringify(step.targets.map(t=>t.faceId))}.includes(e.value);e.dispatchEvent(new Event('change',{bubbles:true}));})`);
      }
      // --- replay: validate, inspect both sides of the fold, then commit ---
      const before=await stamp();await click('a-validate');
      assert.equal(await evaluate('document.getElementById("a-confirm").disabled'),false,await evaluate('document.getElementById("a-message").textContent'));
      await click('a-after');assert.equal(await stamp(),before,'preview committed state: '+step.id);
      await click('a-before');assert.equal(await stamp(),before,'preview committed state: '+step.id);
      await click('a-confirm');
      const frame=await evaluate('({panels:LAB.st.panels,steps:LAB.st.steps.length})');
      assert.equal(frame.steps,frames.length+1,'step not committed: '+step.id);
      assert.ok(frame.panels.every(p=>p.poly.flat().every(Number.isFinite)),'non-finite geometry: '+step.id);
      assert.ok(near(area(frame.panels),4),'paper area changed at '+step.id);
      frames.push(frame);
    }

    // --- this work: crease, rind fold, turn over, two separate diagonals, turn over ---
    assert.deepEqual(recipe.steps.map(s=>s.op),['crease','fold','flip','fold','fold','flip']);
    assert.deepEqual(recipe.steps.filter(s=>s.op==='flip').map(s=>s.axis),['v','v'],'diagrams 3 and 5 turn the paper left-right');
    assert.deepEqual(recipe.steps.filter(s=>s.op!=='flip').map(s=>s.kind),['V','V','V','V'],'every drawn line is dashed = valley');
    const [s4,s5]=recipe.steps.filter(s=>s.diagramStep.startsWith('4'));
    assert.deepEqual([s4.line,s5.line],[[[0,1],[-1,-0.5]],[[0,1],[1,-0.5]]],'diagram 4 diagonals run from the top centre to each end of the diagram-1 crease');
    assert.ok(s4.movingSidePoint[0]<0&&s5.movingSidePoint[0]>0,'diagram 4 must fold opposite sides, one step each');
    // Turning over never splits a face, and the rind is never carried by a diagonal.
    for(const i of [2,5]) assert.equal(frames[i].panels.length,frames[i-1].panels.length,'a turn-over split a face');
    const rind=f=>frames[f].panels.filter(p=>p.recipeFace.faceId.startsWith('paper/s1.cut/')).sort((a,b)=>a.recipeFace.faceId<b.recipeFace.faceId?-1:1);
    assert.equal(rind(2).length,2,'the rind is not two layers after the turn-over');
    assert.deepEqual(rind(3),rind(2),'the first diagonal moved the rind');
    assert.deepEqual(rind(4),rind(2),'the second diagonal moved the rind');
    // Diagram 5: both flaps show their colour side, the later one lies on top and its
    // free corner is the one drawn on the left of that (turned-over) view.
    const flaps=['paper/s1.keep/s4.cut','paper/s1.keep/s4.keep/s5.cut'].map(id=>frames[4].panels.find(p=>p.recipeFace.faceId===id));
    assert.ok(flaps.every(p=>p&&facing(p)>0),'diagram 5 flaps are not colour side up');
    assert.ok(flaps[1].layer>flaps[0].layer,'the flap folded second must lie on top (diagram 5)');
    const corner=flaps[1].poly.find(q=>!near(Math.abs(q[0]),1,1e-6)&&!near(q[1],1,1e-6));
    assert.ok(near(corner[0],5/13,1e-6)&&near(corner[1],1/13,1e-6),'free corner of the top flap: '+JSON.stringify(corner));
    // Diagram 6: one colour triangle over the white rind, both flaps hidden behind.
    assert.deepEqual(await topFace([0,0.2]),{id:'paper/s1.keep/s4.keep/s5.keep',layer:0,side:1},'the melon face is not colour side up');
    assert.deepEqual(await topFace([0,-0.62]),{id:'paper/s1.cut/s2.cut',layer:1,side:-1},'the rind is not the white band');
    assert.ok(frames[5].panels.filter(p=>/s4\.cut|s5\.cut/.test(p.recipeFace.faceId)).every(p=>p.layer<0),'a flap stayed on the visible side');

    // --- save and read back ---
    await click('a-save');const saved=path.join(downloads,recipe.work.id+'.origami.json');
    await poll(async()=>{try{return await fs.readFile(saved,'utf8');}catch{return null;}},'download');
    const downloaded=JSON.parse(await fs.readFile(saved,'utf8'));
    assert.deepEqual(downloaded,recipe,'saved recipe differs from the file on disk');
    assert.ok(!/blob:|data:image|_zu|\.png/i.test(JSON.stringify(downloaded.steps)+JSON.stringify(downloaded.work)),'image information leaked into the recipe');
    const beforeReload=await evaluate('JSON.stringify(LAB.st.clone())');
    await upload('#fileIn',saved);await poll(()=>evaluate('!oriAuthor.active'),'re-import');
    assert.equal(await evaluate('JSON.stringify(LAB.st.clone())'),beforeReload,'re-import produced a different state');
    assert.equal(await fs.readFile(RECIPE,'utf8'),recipeText,'the recipe file was modified');
    assert.deepEqual(errors,[],'browser console errors');
    const shot=await cdp('Page.captureScreenshot',{format:'png'});
    const screenshot=path.join(os.tmpdir(),'suika2-editor-final.png');await fs.writeFile(screenshot,Buffer.from(shot.data,'base64'));
    console.log(JSON.stringify({result:'PASS',steps:recipe.steps.length,faces:frames[5].panels.length,
      checks:['form input of 6 steps incl. 2 turn-overs','replay: area 4, preview non-destructive','diagram 4 split into two opposite diagonals','rind never carried by the diagonals','diagram 5 stacking order','diagram 6 colour/white sides','save == file on disk','re-import identical'],
      consoleErrors:errors.length,screenshot},null,2));
    await cdp('Browser.close').catch(()=>{});
  }finally{
    ws?.close();browser?.kill();server.close();await sleep(500);
    await fs.rm(temp,{recursive:true,force:true,maxRetries:6,retryDelay:300});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
