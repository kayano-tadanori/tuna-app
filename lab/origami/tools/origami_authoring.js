/* Local reference pixels never enter the recipe model or its history. */
'use strict';
globalThis.OrigamiAuthoring=(()=>{
  const copy=x=>JSON.parse(JSON.stringify(x));
  function createModel(adapter,FoldState,schema,initial){
    let recipe=copy(initial), pending=null;
    function replay(r){
      if(r.steps.length) return adapter.replay(r,schema);
      // Empty authoring drafts are not exported as valid v1 recipes.
      const validation=copy(r);
      validation.steps=[{id:'draft',diagramStep:'draft',instruction:'draft',op:'flip',axis:'v'}];
      OrigamiRecipe.validate(validation,schema);
      const state=new FoldState(1,1/r.paper.aspectRatio);
      state.panels[0].recipeFace={faceId:'paper',layerPath:[]};
      return {state,timeline:[state.clone()],recipe:copy(r)};
    }
    let result=replay(recipe);
    return {
      get recipe(){return copy(recipe);}, get result(){return result;}, get pending(){return pending;},
      invalidate(){pending=null;},
      prepare(step){
        pending=null;
        const draft=copy(recipe); draft.steps.push(copy(step));
        pending=replay(draft); return pending;
      },
      confirm(commit){
        if(!pending) throw new Error('先に入力を検証してください');
        commit(pending); recipe=copy(pending.recipe); result=pending; pending=null;
      },
      removeLast(commit){
        if(!recipe.steps.length) throw new Error('取り消す手順がありません');
        const draft=copy(recipe), last=draft.steps.pop(), next=replay(draft);
        commit(next); recipe=draft; result=next; pending=null; return last;
      },
      export(){
        if(pending) throw new Error('プレビュー中の手順を確定するか、入力を修正してください');
        if(!recipe.steps.length) throw new Error('1手以上を確定してから保存してください');
        adapter.replay(recipe,schema); return copy(recipe);
      },
    };
  }
  function mount(root,host){
    root.innerHTML=`
      <style>
        #authoring{font-size:12px;margin-bottom:14px}
        #authoring input:not([type=checkbox]),#authoring select{max-width:100%;min-width:0;background:#171b21;color:#eee;border:1px solid #505967;border-radius:4px;padding:5px}
        #authoring label{display:block;margin:6px 0}
        #authoring [hidden]{display:none!important}
        #authoring label>input:not([type=checkbox]),#authoring label>select{width:100%;margin-top:3px}
        #authoring fieldset{border:1px solid #48515f;margin:8px 0;padding:8px;min-width:0}
        #authoring .row{flex-wrap:wrap}
        #authoring button{white-space:normal}
        #a-faces{max-height:150px;overflow:auto;background:#14161a;padding:5px}
        #a-faces label{overflow-wrap:anywhere}
        #a-message{white-space:pre-wrap;padding:8px;background:#131820;border-radius:5px;min-height:35px}
        #a-message[data-error=true]{color:#ffb0aa}
        #a-json{height:140px}
        #cA{touch-action:none}
      </style>
      <h3>折り図を下敷きにする</h3>
      <label>ローカル画像（PNG・JPEG・WebP）<input id="a-image" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label><input id="a-visible" type="checkbox" checked> 画像を表示</label>
      <div class="row"><button id="a-image-mode" type="button">画像を動かす</button><button id="a-line-mode" type="button" class="on">折線を入力</button></div>
      <label>画像の倍率 <output id="a-scale-value">1.00</output><input id="a-scale" type="range" min="0.1" max="5" step="0.05" value="1"></label>
      <label>画像の透明度 <output id="a-opacity-value">50%</output><input id="a-opacity" type="range" min="0" max="1" step="0.05" value="0.5"></label>
      <button id="a-reset-image" type="button">画像の位置・倍率をリセット</button>
      <p class="hint">画像は表示中だけ保持し、保存・送信・JSONへの同梱はしません。画像を含む画面を共有する場合は、作者の利用条件を確認してください。</p>
      <h3>原本JSONを手入力</h3>
      <details><summary>新規作品の情報</summary>
        <label>作品ID<input id="a-work-id" value="my_origami"></label>
        <label>作品名<input id="a-work-name" value="新しい折り紙"></label>
        <label>絵文字<input id="a-emoji" value="📄"></label>
        <label>難しさ（1〜5）<input id="a-difficulty" type="number" min="1" max="5" value="1"></label>
        <label>幅÷高さ<input id="a-ratio" type="number" min="0.1" max="10" step="0.01" value="1"></label>
        <label><input id="a-color" type="checkbox"> 色面を下にして開始</label>
        <label>出典・作者・利用条件の注記（任意）<input id="a-note" value=""></label>
      </details>
      <div class="row"><button id="a-new">新規原本を開始</button><button id="a-adopt">読み込んだ原本に追加</button><button id="a-end">入力を終了</button></div>
      <p class="hint">末尾の手だけ追加・取り消しできます。入力中は上部の従来操作を停止します。座標は展開状態の正規化座標（−1〜1）です。</p>
      <fieldset id="a-fields" disabled><legend>次の1手</legend>
        <label>手順ID<input id="a-step-id" value="s1"></label>
        <label>折り図番号<input id="a-diagram" value="1"></label>
        <label>説明<input id="a-instruction" value="折り線で折る"></label>
        <label>操作<select id="a-op"><option value="fold">折る（180°）</option><option value="crease">折り目を付ける</option><option value="flip">裏返す</option></select></label>
        <div id="a-fold-fields">
          <label>山谷<select id="a-kind"><option value="V">谷折り</option><option value="M">山折り</option></select></label>
          <label>座標の参照面<select id="a-reference"></select></label>
          <label>折り線A（x, y）<input id="a-point-a" value="-1, -1"></label>
          <label>折り線B（x, y）<input id="a-point-b" value="1, 1"></label>
          <label>折る側 movingSidePoint（x, y）<input id="a-point-moving" value="0.75, -0.75"></label>
          <div class="row"><button id="a-pick-a">Aを画面で指定</button><button id="a-pick-b">Bを画面で指定</button><button id="a-pick-moving">折る側を指定</button></div>
          <div>対象層（選択面を強調）</div><div id="a-faces"></div>
        </div>
        <label id="a-flip-fields" hidden>裏返す軸<select id="a-axis"><option value="v">左右</option><option value="h">上下</option></select></label>
        <button id="a-validate">入力を検証・プレビュー</button>
      </fieldset>
      <div class="row"><button id="a-before" disabled>折る前</button><button id="a-after" disabled>折った後</button><button id="a-confirm" disabled>この手を確定</button></div>
      <div class="row"><button id="a-remove" disabled>最後の手を取り消す</button><button id="a-save" disabled>原本JSONを保存</button></div>
      <div id="a-message" role="status" aria-live="polite">原本を開始するか、読み込んだ原本に追加してください。</div>
      <label>原本JSON（プレビュー中は未確定の手も表示）<textarea id="a-json" readonly></textarea></label>`;
    const $=id=>document.getElementById('a-'+id);
    let model=null, display=null, image=null, imageMode=false, visible=true;
    let imageScale=1, opacity=.5, offset=[0,0], imageSequence=0, drag=null, pickField=null;
    let fingerprint='', showingAfter=false;
    const schemaReady=fetch('origami_recipe.schema.json').then(r=>{
      if(!r.ok) throw new Error('原本スキーマを読み込めません');return r.json();
    });
    const message=(text,error=false)=>{$('message').textContent=text;$('message').dataset.error=String(error);};
    schemaReady.catch(e=>message(e.message,true));
    const stateKey=()=>JSON.stringify(host.getState().clone());
    // A zero-step draft is editable, but must not become a stage-1 exportable recipe.
    const commit=result=>host.commit({...result,recipe:result.recipe.steps.length?result.recipe:null});
    const guard=()=>{if(!model) throw new Error('先に原本入力を開始してください');if(stateKey()!==fingerprint) throw new Error('編集状態が変わりました。入力を終了して原本を読み直してください');};
    const run=fn=>async()=>{try{await fn();}catch(e){message(e.message,true);}};
    function update(){
      $('fields').disabled=!model;
      $('confirm').disabled=!model?.pending;
      $('before').disabled=$('after').disabled=!model?.pending;
      $('remove').disabled=!model?.recipe.steps.length;
      $('save').disabled=!model || !!model.pending || !model.recipe.steps.length;
      $('json').value=model ? JSON.stringify(model.pending?.recipe || model.recipe,null,2):'';
      $('fold-fields').hidden=$('op').value==='flip';
      $('flip-fields').hidden=$('op').value!=='flip';
      document.querySelectorAll('#bar button,#bar select,#bar input').forEach(el=>el.disabled=!!model);
      host.redraw();
    }
    function invalidate(){model?.invalidate();display=null;showingAfter=false;update();}
    function setMode(isImage){imageMode=isImage;drag=null;pickField=null;
      $('image-mode').classList.toggle('on',isImage);$('line-mode').classList.toggle('on',!isImage);
      host.canvas.style.cursor=isImage?'move':'crosshair';}
    function refreshFaces(){
      const previous=$('reference').value;
      $('reference').replaceChildren();$('faces').replaceChildren();
      for(const p of model.result.state.panels){
        const id=p.recipeFace.faceId;
        const option=document.createElement('option');option.value=id;option.textContent=id;$('reference').appendChild(option);
        const label=document.createElement('label'), box=document.createElement('input');
        box.type='checkbox';box.value=id;box.checked=true;
        label.append(box,document.createTextNode(` ${id} ／ 重なり ${p.layer}`));
        label.title=JSON.stringify(p.recipeFace.layerPath);$('faces').appendChild(label);
      }
      if([...$('reference').options].some(o=>o.value===previous)) $('reference').value=previous;
    }
    function nextStep(){
      let i=model.recipe.steps.length+1;
      while(model.recipe.steps.some(s=>s.id==='s'+i)) i++;
      $('step-id').value='s'+i;$('diagram').value=String(model.recipe.steps.length+1);
    }
    async function start(adopt){
      const schema=await schemaReady;
      let recipe;
      if(adopt) recipe=host.exportRecipe();
      else {
        recipe={format:'origami-recipe',version:1,coordinates:'unfolded-normalized-xy',
          work:{id:$('work-id').value,name:$('work-name').value,emoji:$('emoji').value,difficulty:Number($('difficulty').value)},
          paper:{aspectRatio:Number($('ratio').value),colorDown:$('color').checked},steps:[]};
        if($('note').value) recipe.source={note:$('note').value};
      }
      const next=createModel(host.adapter,host.FoldState,schema,recipe);
      commit(next.result); model=next;fingerprint=stateKey();display=null;showingAfter=false;
      nextStep();refreshFaces();setMode(false);update();message('次の手順を入力し、検証してください。');
    }
    function point(id){
      const text=$(id).value.trim(), parts=text.split(',').map(v=>v.trim());
      if(parts.length!==2 || parts.some(v=>!v || !Number.isFinite(Number(v)))) throw new Error(id+': x, y の2数値で入力してください');
      return parts.map(Number);
    }
    function readStep(){
      const s={id:$('step-id').value,diagramStep:$('diagram').value,instruction:$('instruction').value,op:$('op').value};
      if(s.op==='flip') s.axis=$('axis').value;
      else Object.assign(s,{kind:$('kind').value,reference:{faceId:$('reference').value},
        line:[point('point-a'),point('point-b')],movingSidePoint:point('point-moving'),
        targets:[...$('faces').querySelectorAll('input:checked')].map(el=>({faceId:el.value}))});
      return s;
    }
    function validate(){
      guard();invalidate();
      model.prepare(readStep());display=model.result.state;showingAfter=false;pickField=null;update();
      message('検証成功：折る前を表示中です。折った後を確認して確定してください。');
    }
    function confirm(){
      guard();model.confirm(commit);fingerprint=stateKey();display=null;showingAfter=false;
      refreshFaces();nextStep();update();message('手順を確定しました。');
    }
    function fillStep(s){
      $('step-id').value=s.id;$('diagram').value=s.diagramStep;$('instruction').value=s.instruction;$('op').value=s.op;
      if(s.op==='flip') $('axis').value=s.axis;
      else {
        $('kind').value=s.kind;
        const full=ref=>ref.faceId==='paper'&&ref.layerPath?'paper'+ref.layerPath.map(p=>`/${p.stepId}.${p.side}`).join(''):ref.faceId;
        $('reference').value=full(s.reference);
        $('point-a').value=s.line[0].join(', ');$('point-b').value=s.line[1].join(', ');$('point-moving').value=s.movingSidePoint.join(', ');
        const ids=s.targets.map(full);$('faces').querySelectorAll('input').forEach(el=>el.checked=ids.includes(el.value));
      }
    }
    const api={
      get active(){return !!model;},get displayState(){return display;},get imageMode(){return imageMode;},
      get imageVisible(){return !!image&&visible;},
      end(){model=null;display=null;pickField=null;showingAfter=false;update();message('入力を終了しました。確定済みの状態は保持されています。');},
      pick(p){
        if(!model||!pickField||showingAfter)return;
        try{
          guard();const ref=model.result.state.panels.find(p=>p.recipeFace.faceId===$('reference').value);
          if(!ref)throw new Error('参照面を選択してください');
          const q=host.xfInv(ref.xf,p);q[1]*=model.recipe.paper.aspectRatio;
          $(pickField).value=q.map(v=>Number(v.toFixed(8))).join(', ');pickField=null;invalidate();message('原本座標を入力しました。');
        }catch(e){message(e.message,true);}
      },
      drawImage(ctx,canvas){
        if(!image||!visible)return;
        const fit=Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight)*.9*imageScale;
        const w=image.naturalWidth*fit,h=image.naturalHeight*fit;
        ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(image,(canvas.width-w)/2+offset[0],(canvas.height-h)/2+offset[1],w,h);ctx.restore();
      },
      drawOverlay(ctx,screen){
        if(!model||showingAfter)return;
        ctx.save();
        const selected=new Set([...$('faces').querySelectorAll('input:checked')].map(el=>el.value));
        for(const p of model.result.state.panels) if(selected.has(p.recipeFace.faceId)){
          ctx.beginPath();p.poly.forEach((v,i)=>{const q=screen(v);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();
          ctx.strokeStyle='#69e5ab';ctx.lineWidth=2;ctx.stroke();
        }
        const step=model.pending?.recipe.steps.at(-1);
        if(step && step.op!=='flip'){
          const ref=model.result.state.panels.find(p=>p.recipeFace.faceId===step.reference.faceId);
          const current=p=>host.xfApply(ref.xf,[p[0],p[1]/model.recipe.paper.aspectRatio]);
          const [a,b]=step.line.map(current),from=current(step.movingSidePoint),to=host.reflectPoint(from,a,b);
          ctx.strokeStyle=step.kind==='V'?'#68b2ff':'#ff7770';ctx.lineWidth=3;ctx.setLineDash(step.kind==='V'?[7,5]:[11,4,2,4]);
          ctx.beginPath();ctx.moveTo(...screen(a));ctx.lineTo(...screen(b));ctx.stroke();ctx.setLineDash([]);
          const p=screen(from),q=screen(to),angle=Math.atan2(q[1]-p[1],q[0]-p[0]);ctx.strokeStyle='#ffe07b';
          ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.moveTo(q[0]-12*Math.cos(angle-.4),q[1]-12*Math.sin(angle-.4));ctx.lineTo(...q);
          ctx.lineTo(q[0]-12*Math.cos(angle+.4),q[1]-12*Math.sin(angle+.4));ctx.stroke();
          ctx.beginPath();ctx.arc(...p,5,0,Math.PI*2);ctx.fillStyle='#ffe07b';ctx.fill();
        }
        ctx.restore();
      },
    };
    $('new').onclick=run(()=>start(false));$('adopt').onclick=run(()=>start(true));$('end').onclick=()=>api.end();
    $('validate').onclick=run(validate);$('confirm').onclick=run(confirm);
    $('before').onclick=()=>{if(model?.pending){display=model.result.state;showingAfter=false;update();message('折る前を表示中です。');}};
    $('after').onclick=()=>{if(model?.pending){display=model.pending.state;showingAfter=true;update();message('折った後を表示中です（未確定）。');}};
    $('remove').onclick=run(()=>{guard();const last=model.removeLast(commit);fingerprint=stateKey();display=null;showingAfter=false;refreshFaces();fillStep(last);update();message('最後の手を取り消しました。修正して再検証できます。');});
    $('save').onclick=run(()=>{guard();const r=model.export();host.download(r.work.id+'.origami.json',JSON.stringify(r,null,2));message('画像を含まない原本JSONを保存しました。');});
    $('fields').addEventListener('input',()=>{invalidate();message('入力が変わりました。再検証してください。');});
    $('fields').addEventListener('change',invalidate);
    for(const key of ['a','b','moving']) $('pick-'+key).onclick=()=>{setMode(false);invalidate();pickField='point-'+key;message('左の紙をクリックしてください。参照面の原本座標へ変換します。');};
    $('image-mode').onclick=()=>setMode(true);$('line-mode').onclick=()=>setMode(false);
    $('visible').onchange=()=>{visible=$('visible').checked;host.redraw();};
    $('scale').oninput=()=>{imageScale=Number($('scale').value);$('scale-value').textContent=imageScale.toFixed(2);host.redraw();};
    $('opacity').oninput=()=>{opacity=1-Number($('opacity').value);$('opacity-value').textContent=Math.round((1-opacity)*100)+'%';host.redraw();};
    $('reset-image').onclick=()=>{offset=[0,0];imageScale=1;$('scale').value='1';$('scale-value').textContent='1.00';host.redraw();};
    $('image').onchange=run(async()=>{
      const file=$('image').files[0];$('image').value='';if(!file)return;
      const sequence=++imageSequence;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('20MiB以下のPNG・JPEG・WebPを選んでください');
      const url=URL.createObjectURL(file),next=new Image();
      try{
        await new Promise((resolve,reject)=>{next.onload=resolve;next.onerror=()=>reject(new Error('画像を読み込めません'));next.src=url;});
        if(sequence!==imageSequence)return;
        if(next.naturalWidth*next.naturalHeight>40_000_000)throw new Error('画像は4000万画素以下にしてください');
        image=next;offset=[0,0];imageScale=1;visible=true;$('visible').checked=true;$('scale').value='1';$('scale-value').textContent='1.00';
        host.redraw();message('参照画像を表示しました。画像は原本JSONには保存されません。');
      }finally{URL.revokeObjectURL(url);}
    });
    host.canvas.addEventListener('pointerdown',e=>{if(!imageMode||!image||e.button!==0)return;drag=[e.clientX,e.clientY];host.canvas.setPointerCapture(e.pointerId);e.preventDefault();});
    host.canvas.addEventListener('pointermove',e=>{if(!drag||!imageMode)return;offset[0]+=e.clientX-drag[0];offset[1]+=e.clientY-drag[1];drag=[e.clientX,e.clientY];host.redraw();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])host.canvas.addEventListener(event,()=>drag=null);
    host.canvas.addEventListener('wheel',e=>{if(!imageMode)return;e.preventDefault();imageScale=Math.max(.1,Math.min(5,imageScale*(e.deltaY<0?1.1:1/1.1)));$('scale').value=String(imageScale);$('scale-value').textContent=imageScale.toFixed(2);host.redraw();},{passive:false});
    window.addEventListener('pagehide',()=>{image=null;imageSequence++;});
    update();return api;
  }
  return {createModel,mount};
})();
