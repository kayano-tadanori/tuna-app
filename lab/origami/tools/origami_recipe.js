/* v1 recipe adapter for fold2d_editor. Uses only original coordinates and face provenance. */
'use strict';
globalThis.OrigamiRecipe = (() => {
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = message => { throw new Error(message); };
  function check(v, r, schema, path='$') {
    if (r===false) fail(`${path}: field is not allowed for this operation`);
    if (r.$ref) return check(v, schema.$defs[r.$ref.split('/').pop()], schema, path);
    const types = {object:x=>x!==null && typeof x==='object' && !Array.isArray(x),
      array:Array.isArray, string:x=>typeof x==='string', boolean:x=>typeof x==='boolean',
      number:x=>typeof x==='number' && Number.isFinite(x), integer:Number.isInteger};
    if (r.type && !types[r.type](v)) fail(`${path}: expected ${r.type}`);
    if ('const' in r && v!==r.const) fail(`${path}: expected ${r.const}`);
    if (r.enum && !r.enum.includes(v)) fail(`${path}: invalid value`);
    if (v!==null && typeof v==='object' && !Array.isArray(v)) {
      for (const key of r.required||[]) if (!Object.hasOwn(v,key)) fail(`${path}.${key}: required`);
      for (const [key,item] of Object.entries(v)) {
        if (Object.hasOwn(r.properties||{},key)) check(item,r.properties[key],schema,`${path}.${key}`);
        else if (r.additionalProperties===false) fail(`${path}.${key}: unknown field`);
      }
    }
    if (Array.isArray(v)) {
      if (v.length<(r.minItems??0) || v.length>(r.maxItems??Infinity)) fail(`${path}: invalid array length`);
      if (r.items) v.forEach((item,i)=>check(item,r.items,schema,`${path}[${i}]`));
    }
    if (typeof v==='string') {
      const n=Array.from(v).length;
      if (n<(r.minLength??0) || n>(r.maxLength??Infinity)) fail(`${path}: invalid text length`);
      if (r.pattern && !new RegExp(r.pattern).test(v)) fail(`${path}: invalid identifier`);
    }
    if (typeof v==='number' && (!Number.isFinite(v) || v<(r.minimum??-Infinity) || v>(r.maximum??Infinity))) fail(`${path}: number out of range`);
    if (r.oneOf) {
      let n=0;
      for (const branch of r.oneOf) { try { check(v,branch,schema,path); n++; } catch {} }
      if (n!==1) fail(`${path}: fields do not match operation`);
    }
  }
  function validate(recipe,schema) {
    if (Array.isArray(recipe?.steps)) recipe.steps.forEach((s,i)=> {
      if (s && !['fold','crease','flip'].includes(s.op)) fail(`steps[${i}] / 図${s.diagramStep??'?'}: 未対応の操作 ${s.op}（つぶし折り・袋を開く操作は第1段階では未対応）`);
    });
    check(recipe,schema,schema);
    const ids=new Set();
    recipe.steps.forEach((s,i)=> {
      if (ids.has(s.id)) fail(`steps[${i}].id: duplicate step ID`);
      ids.add(s.id);
      const allowed=['id','diagramStep','op','instruction',...(s.op==='flip'?['axis']:['kind','reference','line','movingSidePoint','targets'])];
      if (Object.keys(s).some(k=>!allowed.includes(k))) fail(`steps[${i}]: fields do not match operation`);
    });
    return recipe;
  }
  function resolve(panels,ref) {
    let id=ref.faceId;
    if (id==='paper' && ref.layerPath) id+=ref.layerPath.map(p=>`/${p.stepId}.${p.side}`).join('');
    const found=panels.filter(p=>p.recipeFace.faceId===id);
    if (found.length!==1) fail(`unknown or retired faceId: ${id}`);
    if (ref.layerPath && JSON.stringify(found[0].recipeFace.layerPath)!==JSON.stringify(ref.layerPath)) {
      // Compare members, independent of JSON object key order.
      const a=found[0].recipeFace.layerPath, b=ref.layerPath;
      if (a.length!==b.length || a.some((p,i)=>p.stepId!==b[i].stepId || p.side!==b[i].side)) fail(`layerPath does not match faceId: ${id}`);
    }
    return found[0];
  }
  function createAdapter(G) {
    const {FoldState,xfApply,xfInv,pointInPolygon,sideOfLine,splitPolygon}=G;
    const source=p=>p.poly.map(q=>xfInv(p.xf,q));
    const center=poly=>[0,1].map(k=>poly.reduce((sum,p)=>sum+p[k],0)/poly.length);
    function assign(state,prev,step,a,b) {
      const groups=new Map(prev.map(p=>[p,[]]));
      for (const p of state.panels) {
        const c=center(source(p)), parents=prev.filter(q=>pointInPolygon(c,source(q)));
        if (parents.length!==1) fail('ambiguous face provenance');
        groups.get(parents[0]).push([p,c]);
      }
      for (const [parent,children] of groups) for (const [p,c] of children) {
        p.recipeFace=clone(parent.recipeFace);
        if (children.length>1) {
          const side=sideOfLine(xfApply(parent.xf,c),a,b)<0?'cut':'keep';
          p.recipeFace.faceId+=`/${step.id}.${side}`;
          p.recipeFace.layerPath.push({stepId:step.id,side});
        }
      }
    }
    // Match fold2d.py's local overlap ordering, without changing legacy editor folds.
    function overlap(p,q) {
      if (p.some(v=>pointInPolygon(v,q)) || q.some(v=>pointInPolygon(v,p))) return true;
      for(let i=0;i<p.length;i++) for(let j=0;j<q.length;j++) {
        const a=p[i],b=p[(i+1)%p.length],c=q[j],d=q[(j+1)%q.length];
        if ((sideOfLine(c,a,b)>1e-9)!==(sideOfLine(d,a,b)>1e-9) &&
            (sideOfLine(a,c,d)>1e-9)!==(sideOfLine(b,c,d)>1e-9)) return true;
      }
      return false;
    }
    function order(state,prev,kind) {
      const moved=[],stay=[];
      for(const p of state.panels) {
        const parent=prev.find(q=>pointInPolygon(center(source(p)),source(q)));
        if (!parent) fail('missing parent');
        p.layer=parent.layer;
        (p.xf.some((v,i)=>Math.abs(v-parent.xf[i])>1e-9)?moved:stay).push(p);
      }
      if (!moved.length) return;
      let pivot=null;
      const choose=kind==='V'?Math.max:Math.min;
      for(const p of moved) for(const q of stay) if(overlap(p.poly,q.poly)) pivot=pivot===null?q.layer:choose(pivot,q.layer);
      const sign=kind==='V'?1:-1;
      if(pivot===null) pivot=choose(...moved.map(p=>p.layer))-sign;
      moved.sort((a,b)=>kind==='V'?b.layer-a.layer:a.layer-b.layer);
      moved.forEach((p,i)=>p.layer=pivot+(i+1)*sign);
    }
    function replay(recipe,schema) {
      validate(recipe,schema);
      const ratio=recipe.paper.aspectRatio, state=new FoldState(1,1/ratio);
      state.panels[0].recipeFace={faceId:'paper',layerPath:[]};
      const timeline=[state.clone()];
      recipe.steps.forEach((s,i)=> {
        try {
          if(s.op==='flip') state.flip(s.axis);
          else {
            const ref=resolve(state.panels,s.reference), targets=s.targets.map(r=>resolve(state.panels,r));
            if(new Set(targets).size!==targets.length) fail('duplicate targets');
            if(!targets.includes(ref)) fail('reference face must be a target');
            const current=p=>xfApply(ref.xf,[p[0],p[1]/ratio]);
            let [a,b]=s.line.map(current); const moving=current(s.movingSidePoint);
            if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8) fail('zero-length fold line');
            if(!pointInPolygon(moving,ref.poly)) fail('movingSidePoint is outside reference face');
            const side=sideOfLine(moving,a,b);
            if(Math.abs(side)<1e-8) fail('movingSidePoint lies on fold line');
            if(side>0) [a,b]=[b,a];
            if(!targets.some(p=>splitPolygon(p.poly,a,b)[1])) fail('operation moves no face');
            const prev=clone(state.panels);
            if(!state.fold(a,b,s.kind,null,s.op==='fold',s.instruction,p=>targets.includes(p))) fail('operation produced no step');
            assign(state,prev,s,a,b);
            if(s.op==='fold') order(state,prev,s.kind);
          }
          if(state.panels.length>1024) fail('face limit exceeded (1024)');
          timeline.push(state.clone());
        } catch(e) { fail(`steps[${i}] / 図${s.diagramStep}: ${e.message}`); }
      });
      return {state,timeline,recipe:clone(recipe)};
    }
    return {replay};
  }
  return {validate,createAdapter};
})();
