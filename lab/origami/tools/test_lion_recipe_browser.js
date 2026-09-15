/* Lion-specific real-editor fixture. Invoked by test_origami_authoring_browser.js --lion. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
module.exports=async({cdp,evaluate,click,fill,upload,poll,temp,downloads,errors})=>{
  const recipePath=path.join(__dirname,'recipe_examples/lion.origami.json');
  const reference=path.join(__dirname,'../_zu/lion.png');
  const original=await fs.readFile(reference),recipe=JSON.parse(await fs.readFile(recipePath,'utf8'));
  await upload('#a-image',reference);await poll(()=>evaluate('oriAuthor.imageVisible'),'lion reference');
  await fill('a-work-id',recipe.work.id);await fill('a-work-name',recipe.work.name);await fill('a-emoji',recipe.work.emoji);
  await fill('a-difficulty',recipe.work.difficulty);await fill('a-note',recipe.source.note);
  await click('a-new');await poll(()=>evaluate('oriAuthor.active'),'lion authoring');
  const frames=[];
  for(const step of recipe.steps){
    await fill('a-step-id',step.id);await fill('a-diagram',step.diagramStep);await fill('a-instruction',step.instruction);
    await fill('a-op',step.op);await fill('a-kind',step.kind);await fill('a-reference',step.reference.faceId);
    await fill('a-point-a',step.line[0].join(', '));await fill('a-point-b',step.line[1].join(', '));await fill('a-point-moving',step.movingSidePoint.join(', '));
    await evaluate(`document.querySelectorAll('#a-faces input').forEach(e=>{e.checked=${JSON.stringify(step.targets.map(r=>r.faceId))}.includes(e.value);e.dispatchEvent(new Event('change',{bubbles:true}));})`);
    const before=await evaluate('JSON.stringify(LAB.importState)');await click('a-validate');
    assert.equal(await evaluate('document.getElementById("a-confirm").disabled'),false,await evaluate('document.getElementById("a-message").textContent'));
    await click('a-after');assert.equal(await evaluate('JSON.stringify(LAB.importState)'),before);
    await click('a-confirm');
    const frame=await evaluate(`({panels:LAB.st.panels,steps:LAB.st.steps,cp:LAB.st.cp})`);frames.push(frame);
    assert.ok(frame.panels.every(p=>p.poly.flat().every(Number.isFinite)));
    const materialArea=frame.panels.reduce((sum,p)=>sum+Math.abs(p.poly.reduce((a,q,i)=>a+q[0]*p.poly[(i+1)%p.poly.length][1]-q[1]*p.poly[(i+1)%p.poly.length][0],0))/2,0);
    assert.ok(Math.abs(materialArea-4)<1e-8,'paper area changed');
    // Face/stack review in diagram orientation. Source image is deliberately omitted.
    const png=await evaluate(`(()=>{const c=document.createElement('canvas');c.width=600;c.height=650;const x=c.getContext('2d');x.fillStyle='#c9cdd3';x.fillRect(0,0,600,650);x.fillStyle='#111';x.font='20px sans-serif';x.fillText(${JSON.stringify('図'+step.diagramStep+' / '+step.id)},15,25);const at=p=>[300+(p[0]-p[1])*120,320-(p[0]+p[1])*120];for(const p of [...LAB.st.panels].sort((a,b)=>a.layer-b.layer)){x.beginPath();p.poly.forEach((q,i)=>{const z=at(q);i?x.lineTo(...z):x.moveTo(...z);});x.closePath();x.fillStyle=(p.xf[0]*p.xf[3]-p.xf[1]*p.xf[2])>0?'#f5c745':'#fff';x.fill();x.strokeStyle='#777';x.lineWidth=1;x.stroke();}return c.toDataURL('image/png').split(',')[1];})()`);
    await fs.writeFile(path.join(os.tmpdir(),'lion-'+step.id+'.png'),Buffer.from(png,'base64'));
  }
  assert.deepEqual(recipe.steps.map(s=>s.op),['crease','crease','fold','fold','fold','fold']);
  assert.equal(recipe.steps[5].kind,'M');
  // The bottom flap must remain fixed: this is a local mountain fold, never a flip.
  for(const side of ['keep','cut']){
    const id=`paper/s1.${side}/s2.cut/s3.cut`;
    assert.deepEqual(frames[5].panels.find(p=>p.recipeFace.faceId===id),frames[4].panels.find(p=>p.recipeFace.faceId===id));
  }
  const colors=await evaluate(`[[.07,-.25],[-.48,-.5],[.48,-.5],[.06,-1]].map(([x,y])=>{const candidates=LAB.st.panels.filter(p=>pointInPolygon([x+y,y-x],p.poly)).sort((a,b)=>b.layer-a.layer);const p=candidates[0];return p?Math.sign(p.xf[0]*p.xf[3]-p.xf[1]*p.xf[2]):null;})`);
  assert.deepEqual(colors,[1,-1,-1,-1],'front/back differs from diagram: center, left, right, chin');
  await click('a-visible'); // No source-image copy in saved diagnostic screenshots.
  const editorShot=await cdp('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(path.join(os.tmpdir(),'lion-editor-final.png'),Buffer.from(editorShot.data,'base64'));
  await click('a-save');const saved=path.join(downloads,recipe.work.id+'.origami.json');
  await poll(async()=>{try{return await fs.readFile(saved,'utf8');}catch{return null;}},'lion download');
  const downloaded=JSON.parse(await fs.readFile(saved,'utf8'));assert.deepEqual(downloaded,recipe);
  const beforeReload=await evaluate('JSON.stringify(LAB.st.clone())');await upload('#fileIn',saved);
  await poll(()=>evaluate('!oriAuthor.active'),'lion reimport');assert.equal(await evaluate('JSON.stringify(LAB.st.clone())'),beforeReload);
  assert.ok(!/blob:|data:image|lion\.png|_zu/.test(JSON.stringify(downloaded)));
  assert.deepEqual(await fs.readFile(reference),original,'reference image changed');
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(os.tmpdir(),'lion-browser-frames.json'),JSON.stringify(frames));
  console.log(JSON.stringify({result:'PASS',steps:recipe.steps.length,saveAndReimport:true,referenceUnchanged:true,consoleErrors:errors.length,frames:path.join(os.tmpdir(),'lion-browser-frames.json')},null,2));
};
