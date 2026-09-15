/* Runs the real editor script with a minimal DOM/canvas double. No generated works. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'origami_recipe.schema.json'),'utf8'));
const recipe=JSON.parse(fs.readFileSync(path.join(__dirname,'recipe_examples/triangle.origami.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const elements=new Map();
function element(id) {
  if(elements.has(id)) return elements.get(id);
  const canvas=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  const el={value:id==='paperSel'?'1,1':'8',checked:true,clientWidth:600,clientHeight:600,
    width:600,height:600,style:{},classList:{toggle(){}},addEventListener(){},appendChild(){},
    getContext:()=>canvas,getBoundingClientRect:()=>({left:0,top:0,width:600,height:600}),
    setPointerCapture(){},textContent:'',innerHTML:''};
  elements.set(id,el); return el;
}
const context=vm.createContext({console,setTimeout:()=>0,clearTimeout(){},Blob,URL,
  document:{getElementById:element,createElement:()=>element(Symbol()),body:{appendChild(){}}},
  fetch:async()=>({ok:true,json:async()=>clone(schema)})});
context.window=context; context.addEventListener=()=>{};
vm.runInContext(fs.readFileSync(path.join(__dirname,'origami_recipe.js'),'utf8'),context);
const html=fs.readFileSync(path.join(__dirname,'fold2d_editor.html'),'utf8');
const editor=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
vm.runInContext(editor,context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'origami_authoring.js'),'utf8'),context);
const LAB=context.LAB;
async function loadObject(obj) {
  const text=JSON.stringify(obj);
  await context.loadSteps({target:{files:[{size:Buffer.byteLength(text),text:async()=>text}],value:'x'}});
}
async function main() {
  // Stage 2: append-only authoring uses the exact v1 replay and export contract.
  const draft=clone(recipe);draft.steps=[];
  const model=context.OrigamiAuthoring.createModel(LAB.recipeAdapter,LAB.FoldState,schema,draft);
  const commits=[];
  assert.throws(()=>model.export(),/1手以上/);
  assert.throws(()=>model.confirm(()=>{}),/検証/);
  model.prepare(recipe.steps[0]);
  assert.equal(model.recipe.steps.length,0,'preview must not commit');
  assert.throws(()=>model.export(),/プレビュー/);
  assert.throws(()=>model.confirm(()=>{throw Error('commit failure');}),/commit failure/);
  assert.equal(model.recipe.steps.length,0);
  model.confirm(r=>commits.push(r));
  const broken=clone(recipe.steps[1]);broken.reference.faceId='missing';
  assert.throws(()=>model.prepare(broken));
  assert.equal(model.pending,null);
  assert.equal(model.recipe.steps.length,1);
  model.prepare(recipe.steps[1]);model.invalidate();
  assert.throws(()=>model.confirm(()=>{}));
  model.prepare(recipe.steps[1]);model.confirm(r=>commits.push(r));
  assert.deepEqual(clone(model.export()),recipe);
  assert.deepEqual(clone(model.result.state.clone()),clone(LAB.recipeAdapter.replay(recipe,schema).state.clone()));
  const removed=model.removeLast(()=>{});
  assert.deepEqual(clone(removed),recipe.steps[1]);
  model.prepare(removed);model.confirm(()=>{});
  assert.deepEqual(clone(model.export()),recipe);
  const payload=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):null;
  const recipes=payload?.recipes??[recipe];
  const frames=recipes.map(r=>clone(LAB.recipeAdapter.replay(r,schema).timeline));
  await loadObject(recipe);
  assert.deepEqual(clone(LAB.exportRecipe()),recipe);
  const first=clone(LAB.importState);
  // If refreshing the UI throws during commit, restore the whole editing state.
  const draw=context.draw;
  context.draw=()=>{throw new Error('render failure');};
  assert.throws(()=>LAB.commitImport(LAB.prepareImport(recipe,schema)),/render failure/);
  assert.deepEqual(clone(LAB.importState),first);
  context.draw=draw;
  const roundTrip=clone(LAB.exportRecipe());
  await loadObject(roundTrip);
  assert.deepEqual(clone(LAB.importState),first);
  const invalid=[];
  function bad(edit) {const r=clone(recipe);edit(r);invalid.push(r);}
  bad(r=>r.version=2);
  bad(r=>r.steps[1].op='squash');
  bad(r=>r.steps[1].op='open-pocket');
  bad(r=>r.steps[1].reference.faceId='missing');
  bad(r=>r.steps[1].line=[[0,0],[0,0]]);
  bad(r=>r.steps[1].targets.push(r.steps[1].targets[0]));
  bad(r=>r.steps[1].id='s1');
  bad(r=>r.steps[1].movingSidePoint=[2,0]);
  bad(r=>r.steps[1].axis='v');
  bad(r=>r.steps[1].targets=[{faceId:'paper'}]);
  bad(r=>r.paper.aspectRatio=0);
  for(const r of invalid) {
    assert.throws(()=>LAB.prepareImport(r,schema));
    const before=clone(LAB.importState);
    await loadObject(r);
    assert.deepEqual(clone(LAB.importState),before,'failed import changed live editor state');
    assert.match(element('status').textContent,/読み込みに失敗/);
  }
  const before=clone(LAB.importState);
  await context.loadSteps({target:{files:[{size:10,text:async()=>'{invalid'}],value:''}});
  assert.deepEqual(clone(LAB.importState),before);
  // A file read must not overwrite edits made while awaiting the read.
  let finish;
  const pending=context.loadSteps({target:{files:[{size:100,text:()=>new Promise(r=>finish=r)}],value:''}});
  context.undo(); const edited=clone(LAB.importState);
  finish(JSON.stringify(recipe)); await pending;
  assert.deepEqual(clone(LAB.importState),edited);
  assert.throws(()=>LAB.exportRecipe(),/第1段階/);
  context.redo(); assert.deepEqual(clone(LAB.exportRecipe()),recipe);
  // An older import finishing later cannot replace a newer selection.
  const old=context.loadSteps({target:{files:[{size:100,text:()=>new Promise(r=>finish=r)}],value:''}});
  const newer=clone(recipe);newer.work.name='newer';await loadObject(newer);
  finish(JSON.stringify(recipe));await old;
  assert.equal(LAB.exportRecipe().work.name,'newer');
  // Legacy export shape and import remain usable, including atomic failure.
  const legacy={paper:{hw:1,hh:1},steps:[{op:'fold',a:[-1,-1],b:[1,1],kind:'V',only:null,name:'legacy'}]};
  await loadObject(legacy);
  assert.equal(LAB.st.steps.length,1);
  const legacyState=clone(LAB.importState);
  await loadObject({...legacy,steps:[...legacy.steps,{op:'unknown'}]});
  assert.deepEqual(clone(LAB.importState),legacyState);
  assert.throws(()=>LAB.exportRecipe(),/先に/);
  const result={frames,checks:invalid.length+11};
  process.stdout.write(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
