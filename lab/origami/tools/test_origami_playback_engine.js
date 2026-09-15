/* Uses the unchanged app's actual matrix functions. --browser runs real Chrome. */
'use strict';
const fs=require('node:fs/promises'), path=require('node:path'), vm=require('node:vm');
const os=require('node:os'), {spawn}=require('node:child_process');

function checkPlayback(data) {
  const work={mesh:{boneParent:data.bones.map(b=>b.parent),hinge:data.bones.map(b=>b.hinge)}};
  let maximum=0;
  const near=(a,b,label)=>{const e=Math.abs(a-b);maximum=Math.max(maximum,e);if(e>1e-5)throw Error(label+': '+e);};
  const transform=(m,p)=>m.slice(0,3).map(row=>row[0]*p[0]+row[1]*p[1]+row[2]*p[2]+row[3]);
  for(const frame of data.frames){
    const matrices=FOLD.computeBoneMatrices(work,frame.boneAngles);
    data.faces.forEach((face,j)=>{
      const a=frame.faceStates[j].oracleAffine;
      for(const vi of face.vertexIds){
        const v=data.mesh.verts[vi];
        const actual=transform(frame.bodyPose,OGL.vecApply(matrices[face.boneId],v));
        const x=v[0],y=-v[2],expected=[a[0]*x+a[1]*y+a[4],0,-(a[2]*x+a[3]*y+a[5])];
        actual.forEach((q,k)=>near(q,expected[k],'position'));
      }
      const n=OGL.vecApplyDir(matrices[face.boneId],[0,1,0]);
      const normal=frame.bodyPose[1].slice(0,3).reduce((sum,x,k)=>sum+x*n[k],0);
      near(normal,a[0]*a[3]-a[1]*a[2],'front/back');
      near(frame.bodyLayerRanks[j]*frame.bodyPose[1][1],frame.faceStates[j].layerRank,'layer transfer');
    });
  }
  return {frames:data.frames.length,maxError:maximum};
}

async function main(){
  const browserMode=process.argv.includes('--browser');
  const files=process.argv.slice(2).filter(s=>s!=='--browser');
  if(!files.length)throw Error('Pass one or more intermediate JSON files');
  const data=await Promise.all(files.map(async f=>JSON.parse(await fs.readFile(f,'utf8'))));
  const sources=await Promise.all(['gl.js','fold.js'].map(f=>fs.readFile(path.join(__dirname,'../js',f),'utf8')));
  const expression=`${sources.join('\n')}\n(${checkPlayback.toString()});\n(${JSON.stringify(data)}).map(${checkPlayback.toString()})`;
  if(!browserMode){console.log(JSON.stringify({engine:'existing FOLD/OGL in Node',results:vm.runInNewContext(expression,{console})}));return;}
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'origami-a1-browser-'));
  let browser,ws;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  try{
    browser=spawn(process.env.ORIGAMI_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ['--headless=new','--remote-debugging-port=0','--user-data-dir='+temp,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
    let launchError;browser.on('error',e=>launchError=e);
    let port;
    for(let i=0;i<100&&!port;i++){
      if(launchError)throw launchError;
      try{port=Number((await fs.readFile(path.join(temp,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{}
      if(!port)await sleep(100);
    }
    if(!port)throw Error('Chrome launch timed out');
    const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    ws=new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let next=0;const pending=new Map(),errors=[];
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
      else if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m);};
    const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
    await cdp('Runtime.enable');
    const result=await cdp('Runtime.evaluate',{expression,returnByValue:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    if(errors.length)throw Error(JSON.stringify(errors));
    console.log(JSON.stringify({engine:'real headless Chrome / unchanged FOLD and OGL',results:result.result.value,consoleErrors:errors.length,appUI:'not exercised in A1'}));
    await cdp('Browser.close').catch(()=>{});
  }finally{
    ws?.close();browser?.kill();await sleep(700);
    // Only the exact directory returned by mkdtemp, under the OS temp root.
    if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir()))throw Error('Unsafe temp path');
    await fs.rm(temp,{recursive:true,force:true,maxRetries:8,retryDelay:300});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
