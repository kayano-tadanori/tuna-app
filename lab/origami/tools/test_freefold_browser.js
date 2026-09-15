/* Real Chrome: a corner grab must LOOK like a corner operation until the very end.
   Checks the painted canvas (getImageData) and the page's own record of what it drew, not internal drag flags. */
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');const{spawn}=require('node:child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* ⚠ダウンロードの待ちだけは長めにする。実機のChromeは .crdownload のまま数秒かかることがあり、
   10秒だと「たまに落ちる」検査になっていた（2026-09-12・実測で2/10ほど）。 */
async function poll(fn,label,tries=100){for(let i=0;i<tries;i++){const v=await fn();if(v)return v;await sleep(100)}throw Error('timeout '+label)}
/* Every step is announced, and nothing waits forever: a stuck run says where it stuck instead of hanging. */
const mark=s=>process.stderr.write(new Date().toISOString().slice(11,19)+' '+s+'\n');
let browser,ws,server,temp;
async function shutdown(){try{await Promise.race([cdpRef&&cdpRef('Browser.close'),sleep(3000)])}catch{}try{ws&&ws.close()}catch{}try{browser&&browser.kill()}catch{}try{server&&server.close()}catch{}await sleep(300);if(temp)await fs.rm(temp,{recursive:true,force:true,maxRetries:7,retryDelay:300}).catch(()=>{})}
let cdpRef=null;
async function main(){temp=await fs.mkdtemp(path.join(os.tmpdir(),'freefold-v1-'));const downloads=path.join(temp,'downloads');await fs.mkdir(downloads);mark('server');server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x').pathname;if(u==='/favicon.ico')return res.writeHead(204).end();const f=path.resolve(__dirname,'.'+decodeURIComponent(u));if(!f.startsWith(__dirname+path.sep))return res.writeHead(403).end();try{const b=await fs.readFile(f);res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(b)}catch{res.writeHead(404).end()}});await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
mark('chrome spawn');browser=spawn(process.env.ORIGAMI_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+path.join(temp,'profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});let launch;browser.on('error',e=>launch=e);const port=await poll(async()=>{if(launch)throw launch;try{return Number((await fs.readFile(path.join(temp,'profile','DevToolsActivePort'),'utf8')).split('\n')[0])}catch{return 0}},'chrome');mark('devtools port '+port);const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();mark('tab');ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;setTimeout(()=>no(Error('websocket timeout')),15000)});mark('websocket');
let n=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.no(Error(JSON.stringify(m.error))):p.ok(m.result)}}else if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'||m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m)};const cdp=(method,params={})=>new Promise((ok,no)=>{const id=++n,t=setTimeout(()=>{pending.delete(id);no(Error('CDP timeout '+method))},20000);pending.set(id,{ok:v=>{clearTimeout(t);ok(v)},no:e=>{clearTimeout(t);no(e)}});ws.send(JSON.stringify({id,method,params}))});cdpRef=cdp;const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
/* Paper coordinates go through the page's own projection, so every gesture uses whatever camera is live. */
/* 上下のバーは canvas の上に浮いている。そこを押すと canvas に届かない＝「紙をつかめない」になる。
   バーの高さは案内文の長さで変わるので、決め打ちの数字ではなく実測した位置で見張る。 */
let barTopBottom=0,barBottomTop=800;
const point=async p=>{const q=await ev(`freeFoldDebug.project([${p[0]},0,${-p[1]}])`);
 assert.equal(q[0]>10&&q[0]<990&&q[1]>barTopBottom+1&&q[1]<barBottomTop-1,true,
  `画面外またはバーの下: ${JSON.stringify(p)} -> ${JSON.stringify(q)}（バーは ${barTopBottom} と ${barBottomTop}）`);
 return q};
const press=async q=>cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:q[0],y:q[1],button:'left',clickCount:1}),moveTo=async q=>cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:q[0],y:q[1],button:'left',buttons:1}),release=async q=>cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:q[0],y:q[1],button:'left',clickCount:1});
const grabAt=async p=>press(await point(p)),carryTo=async p=>moveTo(await point(p)),dropAt=async p=>release(await point(p));
/* Hover: the mouse moving with no button down. This is what used to steal the display once a drag ended. */
const hoverTo=async p=>{const q=await point(p);return cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:q[0],y:q[1],buttons:0})};
const near=(a,b,tol=1.5)=>Math.abs(a-b)<=tol;/* 指の位置は画面のピクセルを往復するので、角度は度の単位で見る。 */
const angle=()=>ev('freeFoldDebug.geometry?freeFoldDebug.geometry.angle:null'),lift=()=>ev('freeFoldDebug.geometry?Math.max(...freeFoldDebug.geometry.move.map(p=>Math.abs(p[1]))):0');
const status=()=>ev('freeFoldDebug.status'),steps=()=>ev('freeFoldDebug.state.recipe.steps.length'),faces=()=>ev('freeFoldDebug.state.cache.faces.length');
const recipeText=()=>ev('JSON.stringify(freeFoldDebug.state.recipe)'),click=id=>ev(`document.getElementById('${id}').click()`),disabled=id=>ev(`document.getElementById('${id}').disabled`);
const sessionId=()=>ev('freeFoldDebug.dragSession?(freeFoldDebug.dragSession.source||{}).id||null:null');/* セッションが死んでいても読めるように。 */
const frame=()=>ev('freeFoldDebug.frame'),shapes=async()=>(await frame()).handles.map(h=>h.shape+':'+h.role);
/* 折線は無向の直線として比べる。端点の順は movingSidePoint が折る側を決める今の形式では意味を持たない。 */
const asLine=a=>a.map(q=>q.map(v=>Math.round(v*1e6)/1e6+0)).sort((u,v)=>u[0]-v[0]||u[1]-v[1]);
/* Real painted pixels of the 2D canvas. Yellow = what the finger holds, green = where it is going. */
const YELLOW='R>200&&G>150&&G<235&&B<110',GREEN='R<160&&G>180&&B>120&&B<210';
const countColor=async(p,r,pred)=>{const q=await point(p);return ev(`(()=>{const v=document.getElementById('view'),g=v.getContext('2d'),d=window.devicePixelRatio||1,s=Math.max(2,Math.round(${r}*d)),X=Math.round(${q[0]}*d),Y=Math.round(${q[1]}*d),im=g.getImageData(X-s,Y-s,s*2,s*2).data;let k=0;for(let i=0;i<im.length;i+=4){const R=im[i],G=im[i+1],B=im[i+2],A=im[i+3];if(A>40&&(${pred}))k++}return k})()`)};
const yellowAt=async(p,r=14)=>await countColor(p,r,YELLOW)>0,greenAt=async(p,r=14)=>await countColor(p,r,GREEN)>0;
/* 紙が一枚も無い所＝キャンバスが透明な所。背景色(#070b16)は body 側なので、色でなく不透明度で見る。 */
const emptyAt=async(p,r=6)=>{const q=await point(p);return ev(`(()=>{const v=document.getElementById('view'),g=v.getContext('2d'),d=window.devicePixelRatio||1,s=Math.max(2,Math.round(${r}*d)),X=Math.round(${q[0]}*d),Y=Math.round(${q[1]}*d),im=g.getImageData(X-s,Y-s,s*2,s*2).data;let k=0;for(let i=3;i<im.length;i+=4)if(im[i]<=40)k++;return k>0})()`)};
/* つかんだ所は紙といっしょに動く。だから黄色は「いま紙のどこにいるか」で探す。 */
const grabScreen=()=>ev(`(()=>{const h=(freeFoldDebug.frame.handles||[]).find(v=>v.role==='grab');if(!h)return null;
 const pts=h.at3?(h.shape==='corner-mark'?[h.at3]:h.at3):null;if(!pts)return null;
 const s=pts.map(p=>freeFoldDebug.project(p));return s.length===1?s[0]:[(s[0][0]+s[1][0])/2,(s[0][1]+s[1][1])/2]})()`);
const countAt=async(q,r,pred)=>ev(`(()=>{const v=document.getElementById('view'),g=v.getContext('2d'),d=window.devicePixelRatio||1,s=Math.max(2,Math.round(${r}*d)),X=Math.round(${q[0]}*d),Y=Math.round(${q[1]}*d),im=g.getImageData(X-s,Y-s,s*2,s*2).data;let k=0;for(let i=0;i<im.length;i+=4){const R=im[i],G=im[i+1],B=im[i+2],A=im[i+3];if(A>40&&(${pred}))k++}return k})()`);
/* つかんだ物（黄）が、いま画面のどこにいるか。角なら点、辺なら線分。 */
const grabPoints=()=>ev(`(()=>{const h=(freeFoldDebug.frame.handles||[]).find(v=>v.role==='grab');
 if(!h||!h.at3)return null;const P=p=>freeFoldDebug.project(p);
 return(h.shape==='corner-mark')?[P(h.at3)]:[P(h.at3[0]),P(h.at3[1])]})()`);
const distToGrab=async q=>{const g=await grabPoints();if(!g)return null;
 if(g.length===1)return Math.hypot(g[0][0]-q[0],g[0][1]-q[1]);
 const a=g[0],b=g[1],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L2));
 return Math.hypot(q[0]-(a[0]+t*dx),q[1]-(a[1]+t*dy))};
const yellowOnGrab=async(fallback,r=12)=>{const q=await grabScreen();return q?await countAt(q,r,YELLOW)>0:await yellowAt(fallback,r+2)};
/* 「辺が黄色い」＝辺の線ぜんぶが黄色いこと。運ばれた角の印が、たまたま辺の上に来ただけの点と区別する。 */
const yellowOnEdges=async()=>{for(const e of[[[1,-1],[1,1]],[[-1,-1],[-1,1]],[[-1,1],[1,1]],[[-1,-1],[1,-1]]]){
 const q=t=>[e[0][0]+(e[1][0]-e[0][0])*t,e[0][1]+(e[1][1]-e[0][1])*t];
 if(await yellowAt(q(.25),6)&&await yellowAt(q(.75),6))return true}return false};
/* ⚠ダウンロードの検査は「新しい名前が増えたか」で見ない。実機のChromeは同じ名前のときに
   上書きすることも (1) を足すこともあり、まれに1回めの click('save') を取りこぼす。
   → **先に .origami.json を片づけてから**押し、出てきた1本を見る（検査の作りの話。アプリの話ではない）。 */
const saveAndWait=async label=>{
 for(const f of await fs.readdir(downloads))if(f.endsWith('.origami.json'))await fs.unlink(path.join(downloads,f)).catch(()=>{});
 const find=async()=>{const g=await fs.readdir(downloads);return g.find(v=>v.endsWith('.origami.json'))};
 await click('save');try{return await poll(find,label,80)}catch{await click('save');
  try{return await poll(find,label,300)}catch(e){throw Error(label+' ダウンロードが来ない｜status='+(await status())+
   '｜disabled='+(await disabled('save'))+'｜dir='+JSON.stringify(await fs.readdir(downloads)))}}};
const shot=async name=>{const png=await cdp('Page.captureScreenshot',{format:'png'}),f=path.join(os.tmpdir(),name);await fs.writeFile(f,Buffer.from(png.data,'base64'));return f};
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Log.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1000,height:800,deviceScaleFactor:1,mobile:false});await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await cdp('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/freefold3d.html`});await poll(()=>ev('!!window.freeFoldDebug'),'page');mark('page ready');
barTopBottom=await ev(`document.querySelector('.bar.top').getBoundingClientRect().bottom`);
barBottomTop=await ev(`document.querySelector('.bar.bottom').getBoundingClientRect().top`);
mark(`bars ${barTopBottom} / ${barBottomTop}`);

let landShot=null;
mark('0 the grabbed thing lands under the finger');/* 初期カメラのまま、角折りと部分辺折りの両方で。 */
assert.deepEqual(await ev('({...freeFoldDebug.camera})'),{yaw:0,pitch:.55,zoom:1},'初期カメラで測れていない');
for(const c of[{id:'角折り',grab:[1,-1]},{id:'部分辺折り',grab:[1,.3]}]){
 const a0=await point(c.grab),centre=await point([0,0]),L=Math.hypot(centre[0]-a0[0],centre[1]-a0[1]);
 const ux=(centre[0]-a0[0])/L,uy=(centre[1]-a0[1])/L;await press(a0);
 for(const px of[60,120,180]){/* 小さい角折り（60px＝紙の16%）も通ること。 */const q=[a0[0]+ux*px,a0[1]+uy*px];await moveTo(q);
  const d=await distToGrab(q);
  assert.equal(await angle(),180,`${c.id}: ${px}pxで180°の着地になっていない｜${await status()}`);
  assert.equal(d!==null&&d<=2,true,`${c.id}: ${px}px運んだ時、黄が指から ${d}px 離れている`);
  if(px===120)landShot=await shot(`freefold-lands-${c.id}.png`)}
 await release([a0[0]+ux*180,a0[1]+uy*180]);await click('cancel');
 assert.equal(await steps(),0)}
/* 🚨足元のふち（つかんだ角が乗っているふち）に沿って運んでも、行き先はふちに吸われない＝黄はいつも指の下。
   ここを吸わせていた頃は、ふつうの角折りの出だしで黄が指から40px以上離れていた。 */
for(const c of[{id:'下辺ぞい',grab:[1,-1],to:[[.6,-.95],[.2,-.96],[-.3,-.94]]},
               {id:'右辺ぞい',grab:[1,-1],to:[[.97,-.5],[.96,0],[.98,.4]]}]){
 await grabAt(c.grab);
 for(const pt of c.to){const q=await point(pt);await moveTo(q);const fr=await frame(),d=await distToGrab(q);
  assert.equal(!!(fr.ghost&&fr.ghost.snapped),false,`${c.id}${JSON.stringify(pt)}: 足元のふちに吸いついた｜${await status()}`);
  assert.equal(await angle(),180,`${c.id}${JSON.stringify(pt)}: 180°の着地になっていない｜${await status()}`);
  assert.equal(d!==null&&d<=2,true,`${c.id}${JSON.stringify(pt)}: 黄が指から ${d}px 離れている`)}
 await release(await point(c.to[c.to.length-1]));await click('cancel');assert.equal(await steps(),0)}
/* 向こう側のふちには、これまでどおり吸いつく（除外は「足元のふち」だけ）。 */
await grabAt([1,-1]);await carryTo([-.4,.93]);
let f0=await frame();assert.equal(f0.ghost.snapped,true,'向こう側の上辺に吸いつかない｜'+(await status()));
assert.match(await status(),/紙のふちの上/,'向こう側のふちの表示が違う: '+(await status()));
await dropAt([-.4,.93]);await click('cancel');
/* 着地のようすは各ドラッグの途中で撮る。 */

mark('1 camera');/* 1. Outside the sheet orbits the camera and never touches the paper. */
const cam0=await ev('({...freeFoldDebug.camera})');await press(await point([1.9,1.9]));await moveTo([996,192]);
assert.equal(await ev('freeFoldDebug.dragSession.kind'),'camera');assert.equal(await ev('freeFoldDebug.dragSession.source'),null);assert.equal(await angle(),null);assert.equal(await steps(),0);
await release([996,192]);await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:500,y:400,deltaX:0,deltaY:-120});
const cam1=await ev('({...freeFoldDebug.camera})');assert.notEqual(cam1.yaw,cam0.yaw);assert.notEqual(cam1.pitch,cam0.pitch);assert.notEqual(cam1.zoom,cam0.zoom);

mark('2 edge gesture and hover control');/* 2. An edge grab is what an edge operation must look like: the positive control for the pixel probes. */
await grabAt([1,.3]);assert.equal(await sessionId(),'edge:paper|right');
await carryTo([.4,.3]);const edge30=await angle();assert.equal(edge30,180,'部分辺折りは毎回180°で着地する: '+edge30);assert.equal(await steps(),0);
let f=await frame();assert.equal(f.owner,'edge:paper|right');assert.equal(f.kind,'edge');
/* 部分的な辺折り：動くのは端の帯だけ（指まで運んだ幅の半分）。 */
assert.equal(near(f.ghost.ratio,.15,.01),true,'動く帯の割合が違う: '+f.ghost.ratio);assert.equal(f.ghost.snapped,false);
assert.deepEqual(await shapes(),['edge-line:grab','edge-line:target']);
assert.equal(await yellowOnGrab([1,0],10),true,'つかんだ辺が黄色く光っていない');assert.equal(await yellowAt([1,0],8),false,'黄色が平らな元の位置に置き去りになっている');assert.equal(await greenAt([.4,0],8),true,'指を通る行き先の線が緑になっていない');
await carryTo([.4,-.95]);assert.equal((await frame()).owner,'edge:paper|right','下辺の近くを通ったら主導権が移った');assert.equal(await angle(),180,'辺のまま180°のはず');
assert.equal(near((await frame()).ghost.ratio,.15,.01),true,'帯の割合が変わった');
await carryTo([-.8,.3]);const edge90=await angle();assert.equal(edge90,180,'180°のはずが '+edge90);assert.equal(near((await frame()).ghost.ratio,.45,.01),true,'帯が育っていない');
const edgeShot=await shot('freefold-edge-drag.png');
/* 合わせ先の辺に近づくと、ぴたりと180°へ吸いつく。 */
await carryTo([-.97,.3]);f=await frame();assert.equal(f.ghost.snapped,true,'対辺に吸いつかない');
assert.equal(await angle(),180,'吸いついたのに180°でない');assert.match(await status(),/ぴたりと合わせました/,'吸いついた時の表示が違う: '+(await status()));
assert.deepEqual(await shapes(),['edge-line:grab','edge-line:target'],'黄＝動かす辺／緑＝合わせる辺になっていない');
assert.equal(f.owner,'edge:paper|right','吸いついたら黄が変わった');
const snapEdgeShot=await shot('freefold-edge-snap.png');
/* 少し戻しても外れない（ヒステリシス）。大きく戻せば連続の角度に戻る。 */
await carryTo([-.86,.3]);assert.equal((await frame()).ghost.snapped,true,'境界でちらついた');
await carryTo([-.5,.3]);f=await frame();assert.equal(f.ghost.snapped,false,'離れても吸いついたまま');
assert.equal(near(f.crease[0][0],.25,.01),true,'折線が指に追従していない: '+f.crease[0][0]);
/* つかんだまま紙の外へ出ても、視点は回らず、つかんでいるものも変わらない。 */
const camHeld=await ev('({...freeFoldDebug.camera})');await carryTo([-1.35,-.2]);
assert.deepEqual(await ev('({...freeFoldDebug.camera})'),camHeld,'つかんだまま紙の外へ出たら視点が回った');
assert.equal(await sessionId(),'edge:paper|right','紙の外へ出たらつかんでいるものが変わった');
assert.equal((await frame()).phase,'edge','紙の外でカメラ操作に切りかわった');
await carryTo([-.8,.3]);
await dropAt([-.8,.3]);assert.equal(await angle(),180);assert.equal(await disabled('confirm'),false);
const clean=await recipeText();await click('cancel');assert.equal(await recipeText(),clean);assert.equal(await angle(),null);assert.equal(await disabled('confirm'),true);
f=await frame();assert.equal(f.owner,null);assert.deepEqual(f.handles,[]);
/* 操作を片づけたあとに同じ所をなぞれば、辺のハイライトはちゃんと出る＝この検査は見落としていない。 */
await hoverTo([1,0]);f=await frame();assert.equal(f.hover,'edge:paper|right');assert.deepEqual(await shapes(),['edge-line:grab']);
/* 辺をつかむ→連続して折れる→対辺へ吸い付く→確定、まで通す。 */
await grabAt([1,.3]);await carryTo([-.2,.3]);assert.equal(await angle(),180);assert.equal(near((await frame()).ghost.ratio,.3,.01),true,'帯の割合が違う');
await carryTo([-.97,.3]);assert.equal(await angle(),180);assert.equal((await frame()).ghost.snapped,true);
await dropAt([-.97,.3]);assert.equal(await disabled('confirm'),false,'吸いついた辺合わせが確定できない');
await click('confirm');assert.equal(await steps(),1);assert.equal(await faces(),2);
assert.deepEqual(asLine(await ev('freeFoldDebug.state.recipe.steps[0].line')),asLine([[0,-1],[0,1]]),'辺合わせの折線が中線でない');
await click('undo');assert.equal(await steps(),0);

mark('3 pressing where the corner LOOKS is a corner grab');/* 紙は傾いて描かれる：画面では角のすぐ上でも、紙の座標では角から遠い。 */
const home=await ev('({...freeFoldDebug.camera})');
let out=await point([1.35,1.35]);await press(out);await moveTo([out[0],out[1]-67]);await release([out[0],out[1]-67]);
const flat=await ev('({...freeFoldDebug.camera})');assert.equal(flat.pitch<home.pitch-.4,true,'カメラを浅くできていない: '+flat.pitch);
const c0=await point([1,-1]),probe=[c0[0],c0[1]-20];
const gap=await ev(`(()=>{const q=freeFoldDebug.paperPoint({clientX:${probe[0]},clientY:${probe[1]}});return Math.hypot(q[0]-1,q[1]+1)})()`);
assert.equal(gap>.22,true,'この点は紙の座標でも角の近く＝再現になっていない: '+gap);
await press(probe);assert.equal(await sessionId(),'corner:1,-1','画面で角のすぐ上を押したのに角をつかんでいない');
f=await frame();assert.equal(f.handles[0].shape,'corner-mark','黄が辺になった');assert.equal(f.handles[0].color,'#ffd34e');
assert.equal(await yellowOnEdges(),false,'角のつもりで辺が黄色くなった');
await moveTo(await point([0,-1]));f=await frame();assert.equal(f.kind,'corner');
assert.equal(f.ghost.from,'corner:1,-1','角をつかんだのに別のものが折れている');
assert.equal(f.handles.some(h=>h.shape==='edge-line'),false,'角をつかんだのに辺の表示が出た');
const tiltShot=await shot('freefold-tilted-corner-grab.png');
await release(await point([1,-1]));assert.equal(await ev('freeFoldDebug.dragSession'),null);
await click('cancel');assert.equal(await ev('freeFoldDebug.pendingProposal'),null);
out=await point([1.35,1.35]);await press(out);await moveTo([out[0],out[1]+67]);await release([out[0],out[1]+67]);
assert.equal(Math.abs((await ev('freeFoldDebug.camera')).pitch-home.pitch)<1e-6,true,'カメラを戻せていない');

mark('2b partial edge fold: only the end band moves');/* 部分的な辺折り。 */
await grabAt([1,.3]);await carryTo([0,.3]);
f=await frame();assert.equal(f.ghost.snapped,false,'途中なのに吸いついた');
assert.equal(near(f.ghost.ratio,.25,.01),true,'動く帯の割合が違う: '+f.ghost.ratio);
assert.equal(await angle(),180,'部分辺折りは180°で着地する');
assert.deepEqual(await shapes(),['edge-line:grab','edge-line:target'],'角の表示が混ざった');
assert.equal(await greenAt([0,.7],8),true,'指を通る行き先の線が緑でない');
assert.equal(await yellowOnGrab([1,.3],10),true,'つかんだ辺が黄でない');
const partShot=await shot('freefold-edge-partial.png');
await dropAt([0,.3]);assert.equal(await angle(),180,'確定前の形が180°でない');assert.equal(await disabled('confirm'),false,'部分折りが確定できない');
await click('confirm');assert.equal(await steps(),1);assert.equal(await faces(),2);
assert.deepEqual(asLine(await ev('freeFoldDebug.state.recipe.steps[0].line')),asLine([[.5,-1],[.5,1]]),'折線がつかんだ辺と行き先線の中間でない');
const bandArea=await ev(`(()=>{const v=freeFoldDebug.state.cache.faces.find(q=>q.faceId.endsWith('.cut'));
 let a=0;for(let i=0,j=v.poly.length-1;i<v.poly.length;j=i++)a+=v.poly[j][0]*v.poly[i][1]-v.poly[i][0]*v.poly[j][1];return Math.abs(a)/2})()`);
assert.equal(near(bandArea,1,1e-6),true,'折れた帯の面積が違う: '+bandArea);
await click('undo');assert.equal(await steps(),0);
/* 紙の外へ運んでも折らない。つかんだ辺は変わらない。 */
await grabAt([1,.3]);await carryTo([1.25,.3]);
assert.equal(await status(),'行き先は紙の内側にしてください','紙の外を断る理由が違う: '+(await status()));
assert.equal(await angle(),null,'紙の外なのに折れた');assert.equal(await sessionId(),'edge:paper|right','断られたらつかんだ辺が変わった');
await dropAt([1.25,.3]);assert.equal(await ev('freeFoldDebug.pendingProposal'),null);assert.equal(await steps(),0);

mark('3 the grab is frozen while the finger is down');/* 3. 押したまま、別の角・外周辺・紙の外を通過しても、つかんだものは一度も変わらない。 */
const cid='corner:1,-1';await grabAt([1,-1]);assert.equal(await sessionId(),cid);
const opened=(await ev('freeFoldDebug.sessionLog')).length;let overEdgeShot=null;
/* ガイド（吸い付き先の線）も pointerdown で凍結される＝ドラッグ中に作り直されない。 */
const guides0=await ev('JSON.stringify(freeFoldDebug.dragSession.source.guides)');
assert.equal(guides0&&guides0!=='[]',true,'つかんだ角にガイドが凍結されていない: '+guides0);
for(const via of[[.5,-1],[-.98,-.99],[1,0],[.99,.97],[1.3,1.3],[-1.45,0],[0,-1.04],[-.92,-1],[1,-1]]){
 const where=' 通過点'+JSON.stringify(via);await carryTo(via);
 const sc=(await ev('freeFoldDebug.dragSession&&freeFoldDebug.dragSession.source'))||{};
 assert.equal(sc.id,cid,'つかんでいるものが変わった'+where);assert.equal(sc.type,'corner','種類が変わった'+where);assert.deepEqual(sc.point,[1,-1],'座標が変わった'+where);
 const fr=await frame();assert.equal(fr.phase,'corner','局面が変わった'+where);assert.equal(fr.owner,cid,'表示の持ち主が変わった'+where);
 assert.equal(fr.handles.some(h=>h.shape==='edge-line'),false,'辺のハイライトが出た'+where);
 assert.equal(await ev('freeFoldDebug.hover'),null,'つかんでいる最中にホバーを拾った'+where);
 assert.equal(!fr.ghost||fr.ghost.from===cid,true,'ゴーストと折線が別のものから作られた'+where);
 const grabbed=fr.handles.filter(h=>h.role==='grab');
 assert.equal(grabbed.length,1,'つかんだ印が1つでない'+where);assert.equal(grabbed[0].color,'#ffd34e','つかんだ印が黄でない'+where);
 assert.equal(grabbed[0].shape,'corner-mark','黄が角でなくなった'+where);assert.deepEqual(grabbed[0].at,[1,-1],'黄が別の場所へ移った'+where);
 assert.equal(fr.handles.some(h=>h.color==='#ffffffaa'),false,'つかんでいる最中に白（ホバー）の印が出た'+where);
 assert.equal(await yellowOnGrab([1,-1]),true,'黄がつかんだ角から消えた'+where);
 assert.equal(await yellowOnEdges(),false,'辺が黄色く光った'+where);
 assert.equal(await ev('JSON.stringify(freeFoldDebug.dragSession.source.guides)'),guides0,'ドラッグ中にガイドが作り直された'+where);
 if(via[0]===1&&via[1]===0)overEdgeShot=await shot('freefold-hold-corner-over-edge.png')}
/* 途中で2つ目のボタン（＝2本目の指）が別の角の上で押されても、つかみ直しは起きない。 */
const other=await point([-1,1]);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:other[0],y:other[1],button:'right',clickCount:1});
assert.equal(await sessionId(),cid,'2つ目のボタンでつかみ直した');
await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:other[0],y:other[1],button:'right',clickCount:1});
assert.equal(await sessionId(),cid,'2つ目のボタンを離したらセッションが終わった');
await carryTo([-.92,-1]);assert.equal(await sessionId(),cid,'2つ目のボタンのあと運べなくなった');assert.equal((await frame()).owner,cid);await carryTo([1,-1]);
assert.equal((await ev('freeFoldDebug.sessionLog')).length,opened,'通過中に新しい dragSession が始まった');
await dropAt([1,-1]);assert.equal(await ev('freeFoldDebug.dragSession'),null,'離しても dragSession が残っている');
assert.equal(await ev('freeFoldDebug.pendingProposal'),null,'つかんだ所へ戻したのに候補が残っている');
f=await frame();assert.equal(f.owner,null);assert.deepEqual(f.handles,[]);assert.equal(await steps(),0);
const log=await ev('freeFoldDebug.sessionLog');assert.deepEqual(log.slice(-2),[{at:'down',id:cid,op:'fold'},{at:'up',id:cid}]);
/* 別のものをつかむには、一度離して押し直す。押し直して初めて黄が動く。 */
await hoverTo([0,1]);f=await frame();assert.equal(f.hover,'edge:paper|top');assert.equal(f.handles[0].color,'#ffffffaa','ホバーが白でない');
assert.equal(await yellowAt([0,1],8),false,'ホバーしただけで黄になった');
await grabAt([0,1]);f=await frame();assert.equal(f.owner,'edge:paper|top','押し直しても持ち主が変わらない');
assert.equal(f.handles[0].color,'#ffd34e','押し直したのに黄にならない');assert.equal(f.handles[0].shape,'edge-line');
assert.equal(await yellowOnGrab([0,1],8),true,'押し直した辺が黄くない');assert.equal(await yellowAt([1,-1]),false,'前につかんだ角に黄が残っている');
await dropAt([0,1]);assert.equal(await ev('freeFoldDebug.dragSession'),null);assert.deepEqual((await frame()).handles,[]);
/* 2本目の指（別のpointerId）が別の角の上に降りても、つかみ直しも中断も起きない。
   OS層のタッチ注入はこの環境で届かなかったので、実Chromeの本物のイベント配送に PointerEvent を流して確かめる。 */
const touch=(type,id,q,buttons)=>ev(`document.getElementById('view').dispatchEvent(new PointerEvent('${type}',{pointerId:${id},pointerType:'touch',isPrimary:${id===1},clientX:${q[0]},clientY:${q[1]},button:0,buttons:${buttons},bubbles:true}))`);
const t1=await point([1,-1]),t2=await point([.5,-1]),t3=await point([-1,1]);
await touch('pointerdown',1,t1,1);assert.equal(await sessionId(),cid,'指で角をつかめていない');
await touch('pointermove',1,t2,1);const oneFinger=(await ev('freeFoldDebug.sessionLog')).length;
await touch('pointerdown',2,t3,1);assert.equal(await sessionId(),cid,'2本目の指でつかみ直した');
assert.equal((await ev('freeFoldDebug.sessionLog')).length,oneFinger,'2本目の指で新しい dragSession が始まった');
await touch('pointerup',2,t3,0);assert.equal(await sessionId(),cid,'2本目の指を離したらセッションが終わった');
await touch('pointermove',1,t1,1);assert.equal(await sessionId(),cid,'2本目の指のあと運べなくなった');
assert.equal((await frame()).owner,cid,'2本の指のあいだに表示の持ち主が変わった');
await touch('pointerup',1,t1,0);assert.equal(await ev('freeFoldDebug.dragSession'),null,'つかんだ指を離してもセッションが残っている');
assert.equal(await ev('freeFoldDebug.pendingProposal'),null);

mark('3b corner fold: only the grabbed corner moves');/* 角を折る：行き先は指の点。つかんだ角を含む小さい領域だけが動く。 */
assert.equal(await ev('freeFoldDebug.op'),'fold','既定が「角を折る」でない');
await grabAt([1,-1]);await carryTo([0,0]);
f=await frame();assert.equal(f.op,'fold');assert.equal(f.owner,cid);
assert.equal(f.ghost.angle,180,'角折りは180°の折り上がりだけ');assert.equal(f.ghost.half,false,'半分折り扱いになっている');
assert.equal(f.ghost.ratio<.5,true,'半分以上が動いている: '+f.ghost.ratio);
assert.equal(near(f.ghost.ratio,.125,.005),true,'動く割合が想定と違う: '+f.ghost.ratio);
assert.deepEqual(asLine(f.crease),asLine([[1,0],[0,-1]]),'折線が角と指の垂直二等分線と同じ直線でない');
assert.equal((await grabScreen())!==null,true,'つかんだ角が動く側に入っていない');
assert.equal(await yellowOnGrab([1,-1]),true,'つかんだ角が黄でない');assert.equal(await greenAt([0,0]),true,'指の点が緑になっていない');
assert.equal(f.handles.some(h=>h.shape==='edge-line'),false,'角折りなのに辺の表示が出た');
const foldShot=await shot('freefold-corner-fold.png');
await dropAt([0,0]);assert.equal(await disabled('confirm'),false,'角折りが確定できない');
await click('confirm');assert.equal(await steps(),1);
assert.deepEqual(asLine(await ev('freeFoldDebug.state.recipe.steps[0].line')),asLine([[1,0],[0,-1]]),'原本の折線が同じ直線でない');
/* 折る側は movingSidePoint で決まる：つかんだ角と同じ側にあり、線上ではないこと。 */
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state.recipe.steps[0],L=st.line,
 s=p=>(L[1][0]-L[0][0])*(p[1]-L[0][1])-(L[1][1]-L[0][1])*(p[0]-L[0][0]),m=s(st.movingSidePoint);
 return Math.abs(m)>1e-9&&Math.sign(m)===Math.sign(s([1,-1]))})()`),true,'movingSidePoint がつかんだ角と同じ側にない');
/* 動いた領域と最終形：面積は紙の1/8、つかんだ角は行き先(0,0)へ着地している。 */
const cut=await ev(`(()=>{const f=freeFoldDebug.state.cache.faces.find(v=>v.faceId.endsWith('.cut'));if(!f)return null;
 let a=0;for(let i=0,j=f.poly.length-1;i<f.poly.length;j=i++)a+=f.poly[j][0]*f.poly[i][1]-f.poly[i][0]*f.poly[j][1];
 return{area:Math.abs(a)/2,landed:f.poly.some(p=>Math.hypot(p[0],p[1])<1e-9),n:f.poly.length}})()`);
assert.equal(near(cut.area,.5,1e-6),true,'動いた領域の面積が違う: '+cut.area);
assert.equal(cut.n,3,'動いた領域が三角でない');
assert.equal(cut.landed,true,'つかんだ角が行き先(0,0)へ着地していない');
await click('undo');assert.equal(await steps(),0);
/* 第1版は行き先が紙の内側だけ。外へ運んでも折らない。 */
await grabAt([1,-1]);await carryTo([1.25,-1.25]);
/* 紙の外は必ずこの理由で断る。折線の形より先に、行き先を見る。 */
assert.equal(await status(),'行き先は紙の内側にしてください','紙の外を断る理由が違う: '+(await status()));assert.equal(await angle(),null,'紙の外へ運んだのに折れた');
f=await frame();assert.equal(f.owner,cid,'断られたらつかんでいるものが変わった');assert.deepEqual(await shapes(),['corner-mark:grab']);
await dropAt([1.25,-1.25]);assert.equal(await ev('freeFoldDebug.pendingProposal'),null);assert.equal(await steps(),0);

mark('3c diagonal snap while folding a corner');/* 対角だけに吸いつく。黄はつかんだ角のまま。 */
assert.equal(await ev('freeFoldDebug.op'),'fold');
await grabAt([1,-1]);
/* ふちの上には乗ってよいが、隣の角そのものへは飛ばない（対角だけが角への吸い付き先）。 */
await carryTo([.97,.97]);f=await frame();
const t97=f.handles.find(h=>h.role==='target').at;
assert.equal(Math.hypot(t97[0]-1,t97[1]-1)>1e-6,true,'隣の角に自動で吸いついた: '+JSON.stringify(t97));
const diag=await point([-1,1]);
await moveTo([diag[0]+14,diag[1]+8]);/* 約16px＝吸いつく */
f=await frame();assert.equal(f.ghost.snapped,true,'対角に吸いつかない');
assert.equal(await status(),'対角を合わせて半分折り','吸いついた時の表示が違う: '+(await status()));
assert.deepEqual(f.handles.find(h=>h.role==='target').at,[-1,1],'緑が対角へ固定されていない');
assert.equal(f.owner,cid,'吸いついたら黄が変わった');assert.equal(f.handles.some(h=>h.shape==='edge-line'),false,'辺の表示に変わった');
/* halfFold＝半分折りであること。half＝確定できない候補（薄く出す）こと。対角合わせは半分折りだが確定できる。 */
assert.equal(near(f.ghost.ratio,.5,1e-6),true,'半分折りになっていない: '+f.ghost.ratio);
assert.equal(f.ghost.halfFold,true,'半分折りとして扱われていない');assert.equal(f.ghost.half,false,'対角合わせなのに確定できない候補になっている');
assert.equal(await greenAt([-1,1]),true,'対角が緑になっていない');assert.equal(await yellowOnGrab([1,-1]),true,'黄がつかんだ角から離れた');
const snapShot=await shot('freefold-diagonal-snap.png');
await moveTo([diag[0]+30,diag[1]+18]);/* 約35px＝入る境界の外だが、離す境界の内 */
assert.equal((await frame()).ghost.snapped,true,'境界でちらついた（ヒステリシスが効いていない）');
await carryTo([0,0]);f=await frame();assert.equal(f.ghost.snapped,false,'対角から離しても吸いついたまま');
assert.equal(near(f.ghost.ratio,.125,.005),true,'通常の角折りに戻っていない: '+f.ghost.ratio);
await moveTo([diag[0]+10,diag[1]+6]);assert.equal((await frame()).ghost.snapped,true);
await release([diag[0]+10,diag[1]+6]);
assert.equal(await disabled('confirm'),false,'対角合わせの半分折りが確定できない');
await click('confirm');assert.equal(await steps(),1);assert.equal(await faces(),2);
assert.equal(await ev(`(()=>{const v=freeFoldDebug.state.cache.faces.find(q=>q.faceId.endsWith('.cut'));
 return!!v&&v.poly.some(q=>Math.hypot(q[0]+1,q[1]-1)<1e-9)})()`),true,'つかんだ角が対角へ着地していない');
await click('undo');assert.equal(await steps(),0);

mark('4 corner gesture stays a corner gesture');/* ここからは「角を角へ合わせる」。切りかえはつかむ前だけ。 */
await click('op');assert.equal(await ev('freeFoldDebug.op'),'match');
/* 3. A corner grab: everything painted must come from that one source, to the very end. */
await grabAt([1,-1]);assert.equal(await sessionId(),cid);
await carryTo([.97,-1]);assert.equal(await ev('freeFoldDebug.dragSession.aim'),null,'少ししか動いていないうちは何も狙わない');assert.equal(await angle(),null);
await carryTo([.5,-1]);const c45=await angle();assert.equal(near(c45,45),true,'45度のはずが '+c45);const q45=await lift();
f=await frame();assert.equal(f.owner,cid);assert.equal(f.kind,'corner');assert.equal(f.hover,null);
assert.deepEqual(await shapes(),['corner-mark:grab','corner-mark:target','aim-line:target']);
assert.equal(f.handles.every(h=>h.from===cid),true,'表示の出どころが source 以外になっている');
assert.equal(await yellowOnGrab([1,-1]),true,'つかんだ角に黄の印が出ていない');assert.equal(await greenAt([-1,-1]),true,'運ぶ先の角が緑になっていない');
assert.equal(await yellowOnEdges(),false,'角の操作なのに辺が黄色く光っている');
const crease1=JSON.stringify(f.crease);
await carryTo([.5,-.75]);assert.equal(JSON.stringify((await frame()).crease),crease1,'少し横へずれただけで折線が飛んだ');
assert.deepEqual(await shapes(),['corner-mark:grab','corner-mark:target','aim-line:target']);
await carryTo([0,-1]);const c90=await angle();assert.equal(near(c90,90),true,'90度のはずが '+c90);assert.equal(await lift()>q45,true);
const dragShot=await shot('freefold-corner-90.png');
await carryTo([-.92,-1]);const c172=await angle();assert.equal(near(c172,172.8),true,'172.8度のはずが '+c172);
await dropAt([-.92,-1]);assert.equal(await angle(),180);assert.equal(await lift()<1e-9,true);assert.equal(await ev('freeFoldDebug.dragSession'),null,'指を離しても dragSession が終わっていない');assert.equal(await ev('freeFoldDebug.pendingProposal.source.id'),cid,'離した後のゴーストを pendingProposal が持っていない');
f=await frame();assert.equal(f.owner,cid,'指を離した時点で表示の主導権が離れた');assert.equal(await yellowOnGrab([1,-1]),true,'離した直後に角の印が消えた');
/* ここが実機で崩れていた所：指を離したあと紙の上をなぞると、辺の操作に見えていた。 */
await hoverTo([1,-.5]);await hoverTo([1,0]);await hoverTo([.9,.4]);
f=await frame();assert.equal(f.owner,cid,'なぞっただけで表示の主導権がホバーへ移った');
assert.equal(f.handles.some(h=>h.shape==='edge-line'),false,'なぞったら辺のハイライトが出た');
assert.deepEqual(await shapes(),['corner-mark:grab','corner-mark:target','aim-line:target']);
assert.equal(await yellowOnEdges(),false,'なぞったら辺が黄色く光った');
assert.equal(await yellowOnGrab([1,-1]),true,'なぞったら、つかんだ角の印が消えた');assert.equal(await greenAt([-1,-1]),true,'なぞったら、運ぶ先の印が消えた');
assert.equal(f.ghost.angle,180,'なぞったらゴーストが消えた');assert.equal(f.ghost.from,cid,'なぞったらゴーストの出どころが変わった');assert.equal(JSON.stringify(f.crease),crease1,'なぞったら折線が変わった');
assert.equal(f.hover,null);assert.equal(await ev('freeFoldDebug.hover'),null,'操作の途中なのにホバーを拾っている');
const heldShot=await shot('freefold-after-release-hover.png');
await click('kind');assert.equal((await frame()).ghost.kind,'M');await click('kind');assert.equal((await frame()).ghost.kind,'V');
await click('confirm');assert.equal(await steps(),1);assert.equal(await faces(),2);
f=await frame();assert.equal(f.owner,null,'確定したのに操作が残っている');assert.deepEqual(f.handles,[]);
assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe.steps[0].line)'),'[[0,1],[0,-1]]');
/* 座標の一致ではなく、折る側が正しいこと（つかんだ角と同じ側・折線上でない）を見る。 */
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state.recipe.steps[0],L=st.line,
 s=p=>(L[1][0]-L[0][0])*(p[1]-L[0][1])-(L[1][1]-L[0][1])*(p[0]-L[0][0]),m=s(st.movingSidePoint);
 return Math.abs(m)>1e-9&&Math.sign(m)===Math.sign(s([1,-1]))})()`),true,'movingSidePoint がつかんだ角と同じ側にない');
const oneHash=await ev('freeFoldDebug.state.cache.hash'),oneStep=await recipeText();

mark('5 B2b: the stack at an overlapping spot, and picking how many sheets from the top');
/* ★B2b。重なった所では、指を離したあとに「この場所の重なり」が出て、上から何枚かだけを選べる。
   ⚠ここは以前「重なった面の選択はB2以降」で断っていた所＝B2bで開けた道。 */
const PICKC='R>100&&R<170&&G>190&&B>230';/* 層の選択の青 #7fd4ff */
const rev1=await ev('freeFoldDebug.state.revision');
await click('op');assert.equal(await ev('freeFoldDebug.op'),'fold','角を折るモードに戻っていない');
/* ドラッグ中はガイドと軽い表示だけ＝重なりを読むAPIは1回も走らない。 */
const calls0=await ev('({...freeFoldDebug.apiCalls})');
await grabAt([-1,-1]);await carryTo([-.5,-.6]);
assert.deepEqual(await ev('({...freeFoldDebug.apiCalls})'),calls0,'ドラッグ中に重なりを読むAPIが走った');
assert.equal(await ev('freeFoldDebug.layerPick'),null,'ドラッグ中に候補ができている');
assert.equal((await frame()).pick,null,'ドラッグ中に「この場所」の印が出ている');
assert.equal(await angle(),180,'重なった所で1枚ぶんのゴーストが出ない｜'+(await status()));
assert.equal(await steps(),1);
await dropAt([-.5,-.6]);
/* 指を離してから1回だけ読む。 */
const calls1=await ev('({...freeFoldDebug.apiCalls})');
assert.equal(calls1.stackAt-calls0.stackAt,1,'stackAt が1回でない: '+(calls1.stackAt-calls0.stackAt));
let pick=(await frame()).pick;
assert.equal(!!pick,true,'指を離しても候補ができない｜'+(await status()));
assert.equal(pick.count,2,'この場所が2枚になっていない');
assert.deepEqual(pick.stack.map(v=>v.rank),[1,2],'上からの順位が振られていない');
assert.equal(pick.stack[0].layer>pick.stack[1].layer,true,'上から順に並んでいない');
assert.equal(pick.stack[0].back,true,'折り返した紙が裏になっていない（表裏はdet(xf)）');
assert.equal(pick.stack[1].back,false,'土台が表になっていない');
assert.equal(pick.applied,1,'はじめは上から1枚でない');assert.equal(pick.ok,true,'上から1枚が折れない');
assert.deepEqual(pick.faces,[pick.stack[0].faceId],'上から1枚が、いちばん上の面になっていない');
assert.deepEqual(pick.faces,await ev('freeFoldDebug.state.pending.candidates.map(c=>c.faceId)'),'画面が engine の候補と別のものを持っている');
/* 候補行に、順位・faceId・layerPath・表裏・layer・由来手順が出ている。 */
const rows=await ev(`[...document.querySelectorAll('#stackRows .row')].map(r=>({face:r.dataset.face,rank:r.dataset.rank,on:r.classList.contains('on'),text:r.textContent}))`);
assert.equal(rows.length,2,'候補行が2行でない');
assert.equal(rows[0].on&&!rows[1].on,true,'上から1枚だけが強調されていない');
for(const r of rows){assert.match(r.text,/上から\d枚目/,'順位が読めない: '+r.text);
 assert.match(r.text,/表|裏/,'表裏が読めない: '+r.text);
 assert.match(r.text,/layer -?\d/,'層順位が読めない: '+r.text);
 assert.match(r.text,/由来/,'由来手順が読めない: '+r.text);
 assert.match(String(r.face),/^paper/,'faceId が読めない: '+r.face)}
assert.match(rows[0].text,/s1\.(keep|cut)/,'layerPath が読めない: '+rows[0].text);
/* 「この場所」は pending.layerChoice.at に残り、画面にも印が出る。 */
assert.deepEqual(pick.at,await ev('freeFoldDebug.state.pending.layerChoice.at'),'印と pending.layerChoice.at がずれている');
assert.equal(await countColor(pick.at,10,PICKC)>0,true,'「この場所」の印が画面に出ていない');
assert.equal(await ev('freeFoldDebug.state.pending.layerChoice.n'),1,'layerChoice.n が残っていない');
/* 選べるのは「上からN枚」と「折線のこの側を全部」（2026-09-15 本人指示で追加）だけ。面ごとのチェックボックスは作らない。 */
assert.equal(await ev(`document.querySelectorAll('input[type=checkbox]').length`),0,'面ごとのチェックボックスがある');
assert.equal(await ev(`[...document.querySelectorAll('#stackPick button')].map(b=>b.dataset.n).join(',')`),'1,2,side','選べるのが「上からN枚」と「この側を全部」だけになっていない');
/* 上から2枚へ切りかえ＝強調が変わり、確定はできない（B2c）。原本は1文字も動かない。 */
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2').click()`);
pick=(await frame()).pick;
assert.equal(pick.applied,2,'上から2枚に切りかわらない');
assert.equal(pick.faces.length,2,'2枚が対象になっていない');
assert.equal(pick.ok,true,'2枚では折れないと言われた: '+pick.reason);
assert.deepEqual(await ev(`[...document.querySelectorAll('#stackRows .row')].map(r=>r.classList.contains('on'))`),[true,true],'2枚とも強調されていない');
assert.equal(await disabled('confirm'),false,'成立しているのに確定できない');
/* 🖐 案内は短く（上から2枚を折ります）、記録のされ方（faceId）は「詳しく」の中（2026-09-14）。 */
assert.match(await status(),/上から2枚を折ります/,'枚数の案内が出ていない: '+(await status()));
assert.match(await ev('freeFoldDebug.detail')||'',/faceId で原本に記録されます/,'記録のされ方の説明が「詳しく」に無い: '+(await ev('freeFoldDebug.detail')));
assert.equal((await status()).includes('faceId'),false,'内部IDの説明が案内に出ている: '+(await status()));
assert.match(await ev(`document.getElementById('stackNote').textContent`),/上から2枚.*ではなく.*faceId/,'「選び方は保存されない」の説明が「詳しく」に無い');
const stackShot=await shot('freefold-stack-pick.png');
/* 候補をいじっているあいだ、原本は1文字も動かない。 */
assert.equal(await steps(),1);assert.equal(await recipeText(),oneStep,'候補をいじって原本が変わった');
assert.equal(await ev('freeFoldDebug.state.revision'),rev1,'revision が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),oneHash,'cache.hash が動いた');
/* N>1 の 0°／90°／180°プレビュー：対象2面が動き、対象でない面は動かない。90°は表示だけ。 */
const prev=await ev(`(()=>{const R=[];for(const a of[0,90,180]){const g=FreeFoldEngine.preview(freeFoldDebug.state,a);
 R.push({n:g.movingIds.length,lift:Math.max(...g.move.map(p=>Math.abs(p[1]))),base:g.baseFaces.length})}return R})()`);
assert.deepEqual(prev.map(v=>v.n),[2,2,2],'角度で対象面の数が変わった');
assert.equal(prev[0].lift<1e-9&&prev[1].lift>.1&&prev[2].lift<1e-9,true,'0/90/180 の持ち上がりが違う: '+JSON.stringify(prev));
assert.equal(await steps(),1,'プレビューで原本が動いた');
assert.equal(await ev('freeFoldDebug.state.recipe.steps.length'),1);
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2').click()`);/* 180°へ戻す */
/* 不成立の理由が画面に出る：山折りで「上から1枚」は、下に敷かれている紙を突き抜けるので折れない。
   そして断られたあとも、いまの状態はそのまま。 */
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='1').click()`);
assert.equal((await frame()).pick.ok,true);assert.equal(await disabled('confirm'),false,'1枚に戻したのに確定できない');
await click('kind');assert.equal(await ev('freeFoldDebug.kind'),'M');
pick=(await frame()).pick;
assert.equal(pick.ok,false,'山折りで上から1枚が通ってしまった');
assert.match(String(pick.reason),/下に敷かれている紙/,'不成立の理由が違う: '+pick.reason);
assert.match(await ev(`document.getElementById('stackNote').textContent`),/折れません：.*下に敷かれている紙/,'理由が「詳しく」に出ていない');
assert.equal(await disabled('confirm'),true,'折れないのに確定できる');
await click('confirm');/* 押しても何も起きない */
assert.equal(await steps(),1);assert.equal(await recipeText(),oneStep,'断られた操作で原本が変わった');
assert.equal(await ev('freeFoldDebug.state.revision'),rev1,'断られた操作で revision が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),oneHash,'断られた操作で cache.hash が動いた');
await click('kind');assert.equal(await ev('freeFoldDebug.kind'),'V');
assert.equal((await frame()).pick.ok,true,'谷折りに戻しても折れないままになっている');
/* ★複数面を確定する。上から2枚＝2面が faceId で記録される。 */
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2').click()`);
await click('confirm');
assert.equal(await steps(),2,'複数面が確定できない｜'+(await status()));
assert.match(await status(),/2面を折りました/,'確定の知らせが違う: '+(await status()));
assert.equal(await ev('freeFoldDebug.layerPick'),null,'確定後に候補が残っている');
assert.equal((await frame()).pick,null,'確定後に印が残っている');
const st2=await ev('freeFoldDebug.state.recipe.steps[1]');
assert.equal(st2.targets.length,2,'targets が2面でない');
assert.equal(st2.targets.every(t=>typeof t.faceId==='string'&&Array.isArray(t.layerPath)),true,'targets に faceId と layerPath が無い');
assert.equal(st2.targets.some(t=>t.faceId===st2.reference.faceId),true,'reference が targets に入っていない');
assert.equal(await faces(),4,'4枚に割れていない');
/* 折った先は4層。表裏は det(xf) だけで決まる。裂けも透明画素も無い。 */
/* 折った先＝いちばん上になった面の重心。角折りなので場所は決め打ちせず、状態から引く。 */
const spot2=await ev(`(()=>{const st=freeFoldDebug.state,cen=q=>q.reduce((s,v)=>[s[0]+v[0]/q.length,s[1]+v[1]/q.length],[0,0]);
 return cen(st.cache.faces.slice().sort((a,b)=>b.layer-a.layer)[0].poly)})()`);
assert.deepEqual(await ev(`FreeFoldEngine.stackAt(freeFoldDebug.state,[${spot2}]).map(v=>v.layer)`),[3,2,1,0],'折った先が4層でない');
const topBack=await ev(`(()=>{const s=FreeFoldEngine.stackAt(freeFoldDebug.state,[${spot2}])[0],
 f=freeFoldDebug.state.cache.faces.find(v=>v.faceId===s.faceId);return{back:s.back,det:FreeFoldEngine.detXf(f.xf)<0}})()`);
assert.equal(topBack.back,topBack.det,'表裏が det(xf) と食い違っている');
assert.equal(await emptyAt(spot2,5),false,"折った先に紙が無い（透明画素）");
assert.equal(await countColor(spot2,5,topBack.back?'R>200&&G>200&&B>200':'R>200&&G<170&&B<170')>0,true,'いちばん上の紙の表裏と色が食い違っている');
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state,ap=(m,q)=>[m[0]*q[0]+m[1]*q[1]+m[4],m[2]*q[0]+m[3]*q[1]+m[5]];
 for(const b of st.cache.bonds){const x=st.cache.faces.find(f=>f.faceId===b.faceIds[0]),y=st.cache.faces.find(f=>f.faceId===b.faceIds[1]);
  if(!x||!y)continue;for(const q of b.seg){const u=ap(x.xf,q),v=ap(y.xf,q);if(Math.hypot(u[0]-v[0],u[1]-v[1])>1e-7)return 'seg'}}return 'ok'})()`),'ok','結びが切れている');
const twoHash2=await ev('freeFoldDebug.state.cache.hash'),twoText=await recipeText();
const multiShot=await shot('freefold-multi-fold.png');
/* ★3手目を足せる（3手目上限は外れた）。 */
/* 3手目は紙の右下の角から。ここは1手目の背(x=0のヒンジ)にかかるので、上から2枚いっしょでないと折れない。 */
await grabAt([0,-1]);
assert.equal(await sessionId(),'corner:0,-1','3手目の角をつかめていない');
await carryTo([-.2,-.7]);
/* ⚠ここは1手目の背（x=0のヒンジ）にかかる＝上から1枚だと裂けるので、ドラッグ中はゴーストを出さない。 */
assert.equal(await angle(),null,'裂ける選び方なのにゴーストが出た｜'+(await status()));
await dropAt([-.2,-.7]);
assert.equal((await frame()).pick.count,2,'3手目の場所が2枚でない');
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2').click()`);
assert.equal((await frame()).pick.ok,true,'3手目が成立しない｜'+(await status()));
assert.equal(await angle(),180,'上から2枚にしてもゴーストが出ない');
assert.equal(await disabled('confirm'),false,'3手目が確定できない｜'+(await status()));
await click('confirm');assert.equal(await steps(),3,'3手目が入らない');
/* 保存：先頭から再生して突き合わせたものだけが落ちてくる。 */
const f3=await saveAndWait('download3');
assert.deepEqual(JSON.parse(await fs.readFile(path.join(downloads,f3),'utf8')),await ev('freeFoldDebug.state.recipe'),'保存したJSONが原本と違う');
await fs.unlink(path.join(downloads,f3));/* あとの保存の検査が「1本目」を見られるように片づける */
/* 1手戻す＝最後の手を消して、先頭から再生しなおす。 */
await click('undo');assert.equal(await steps(),2);
assert.equal(await ev('freeFoldDebug.state.cache.hash'),twoHash2,'巻き戻しで再生ハッシュが戻らない');
assert.equal(await recipeText(),twoText,'巻き戻しで原本が戻らない');
await click('undo');assert.equal(await steps(),1);
assert.equal(await recipeText(),oneStep,'2回戻して1手目に戻らない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),oneHash,'2回戻してハッシュが戻らない');
/* setLayers へ渡っているのは枚数と場所だけ＝画面が面の集合を作っていない。 */
const args=await ev('freeFoldDebug.setLayersArgs');
assert.equal(args.length>0,true,'setLayers が呼ばれていない');
assert.equal(args.every(a=>Number.isInteger(a.n)&&a.n>=1&&Array.isArray(a.at)&&a.at.length===2&&Object.keys(a).length===2),true,
 'setLayers に枚数と場所以外が渡っている: '+JSON.stringify(args));
/* 取消：候補・印・強調がぜんぶ消え、原本は元のまま。 */
await grabAt([-1,-1]);await carryTo([-.5,-.6]);await dropAt([-.5,-.6]);
const atGone=(await frame()).pick.at;
assert.equal(await countColor(atGone,10,PICKC)>0,true,'取消の前に印が出ていない');
await click('cancel');
assert.equal(await ev('freeFoldDebug.layerPick'),null,'取消しても候補が残っている');
assert.equal((await frame()).pick,null,'取消しても印が残っている');
assert.equal(await ev(`document.getElementById('layers').hidden`),true,'取消しても候補パネルが出たまま');
assert.equal(await countColor(atGone,10,PICKC)>0,false,'取消しても青い印が画面に残っている');
assert.equal(await recipeText(),oneStep);assert.equal(await ev('freeFoldDebug.state.cache.hash'),oneHash);
assert.equal(await disabled('confirm'),true);
f=await frame();assert.equal(f.owner,null);assert.deepEqual(f.handles,[]);
await click('op');assert.equal(await ev('freeFoldDebug.op'),'match','角合わせモードに戻していない');

mark('6 undo and replay');/* 5. Undo, fold again, and the replay hash comes back identical. */
await click('undo');assert.equal(await steps(),0);assert.equal(await faces(),1);assert.equal(await disabled('save'),true);
await grabAt([1,-1]);await carryTo([-.92,-1]);await dropAt([-.92,-1]);await click('confirm');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),oneHash);assert.equal(await recipeText(),oneStep);

mark('7 save');/* 6. Saving writes exactly the verified recipe. */
/* ⚠mark 5 でも保存を試すので「ダウンロード先が空」は前提にしない（Chromeの .crdownload が残ることもある）。 */
const saved=await ev('freeFoldDebug.state.recipe');const file=await saveAndWait('download');
assert.deepEqual(JSON.parse(await fs.readFile(path.join(downloads,file),'utf8')),saved);
const doneShot=await shot('freefold-committed.png');

mark('8 crease: flat sheet, snap target, and the line travels with the paper');
await click('undo');assert.equal(await steps(),0);
await click('op');assert.equal(await ev('freeFoldDebug.op'),'fold','「角を折る」に戻っていない');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),true,'折り目だけモードに入れない');
/* 1手目：下辺をつかんで真ん中まで運び、折り目だけをつける。 */
await grabAt([.3,-1]);await carryTo([.3,0]);
assert.match(await status(),/折り目をつけます/,'折り目の表示になっていない: '+(await status()));
assert.equal(await angle(),180,'プレビューは折って見せる');
const creaseShot=await shot('freefold-crease-preview.png');
await dropAt([.3,0]);await click('confirm');
assert.equal(await steps(),1);assert.equal(await ev("freeFoldDebug.state.recipe.steps[0].op"),'crease','原本が crease になっていない');
f=await frame();assert.equal(f.ghost,null,'確定後もゴーストが残っている');
/* 折り目はつかんだ辺と指の線の中間＝y=-0.5（下辺を y=0 まで運んだので）。 */
assert.deepEqual(asLine(f.creases[0]).map(q=>q.map(v=>Math.round(v*1e6)/1e6)),asLine([[-1,-.5],[1,-.5]]),'折り目が残っていない: '+JSON.stringify(f.creases));
assert.equal(await ev('JSON.stringify(freeFoldDebug.state.cache.faces.map(v=>v.layer))'),'[0,0]','紙が平らに戻っていない');
const flatShot=await shot('freefold-crease-flat.png');
/* 折り目の端に吸い付く（折るモードに戻して角をつかむ）。 */
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),false);
await grabAt([1,1]);await carryTo([.98,-.47]);/* 折り目の端(1,-0.5)のそば */
f=await frame();
assert.equal(f.ghost.snapped,true,'折り目の端に吸い付かない');
assert.match(await status(),/折り目の端/,'吸い付き先の表示が違う: '+(await status()));
assert.equal(JSON.stringify(f.handles.find(h=>h.role==='target').at.map(v=>Math.round(v*1e6)/1e6)),'[1,-0.5]','緑が折り目の端になっていない');
await dropAt([.98,-.47]);await click('cancel');
/* 2手目：折り目をまたいで折ると、折り目も紙といっしょに動いて切り分けられる。 */
await grabAt([1,1]);await carryTo([-.8,-.45]);/* 折線が折り目をまたぐ大きさで折る */
assert.equal((await frame()).ghost.half,false,'半分以上動く候補になった');
await dropAt([-.8,-.45]);await click('confirm');
assert.equal(await steps(),2);f=await frame();
assert.equal(f.creases.length,2,'折り目が切り分けられていない: '+JSON.stringify(f.creases));
/* 指の位置は画面のピクセルを往復するので、位置の判定は1e-3で見る。 */
assert.equal(f.creases.some(g=>g.some(q=>Math.abs(q[1]+.5)>1e-3)),true,'折り目が紙に取り残されている（動いた側が y=-0.5 のまま）');
assert.equal(f.creases.some(g=>g.every(q=>Math.abs(q[1]+.5)<1e-3)),true,'動かない側の折り目まで動いた');
const travelShot=await shot('freefold-crease-travelled.png');
/* 保存JSON：crease と fold の2手。 */
await click('save');
const creaseFile=await poll(async()=>{const g=await fs.readdir(downloads);return g.find(v=>v.endsWith('.origami.json')&&v!==file)},'download2').catch(()=>null);
const savedAll=await ev('freeFoldDebug.state.recipe');assert.deepEqual(savedAll.steps.map(v=>v.op),['crease','fold']);
/* 1手戻す：折り目が1本に戻り、もう一度戻すと消える。 */
await click('undo');assert.equal((await frame()).creases.length,1,'巻き戻しで折り目が戻らない');
await click('undo');assert.equal(await steps(),0);assert.deepEqual((await frame()).creases,[]);

mark('9 crease is a guide, not a wall: the paper never tears along it');
/* 画像の再現。①下辺をつかんで折り目 y=-0.5 ②角(1,1)を(-0.8,-0.45)へ角折り。
   折線が折り目をまたぐので、折り目の向こう側も一緒に動く＝折り目にそって背景が見えない。 */
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),true);
await grabAt([.3,-1]);await carryTo([.3,0]);await dropAt([.3,0]);await click('confirm');
assert.equal(await steps(),1);assert.equal(await ev("freeFoldDebug.state.recipe.steps[0].op"),'crease','辺折りで折り目だけを付けられていない');
assert.equal(await ev('JSON.stringify(freeFoldDebug.state.cache.faces.map(v=>v.layer))'),'[0,0]','折り目のあと紙が平らでない');
assert.equal(await ev('freeFoldDebug.state.cache.bonds.length'),1,'隣接が記録されていない');
assert.equal(await ev('freeFoldDebug.state.cache.bonds[0].kind'),'crease','隣接が折り目として記録されていない');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),false);
/* 外周の辺は「面ごとの線分」。つかんだ線分が対象面を決める。 */
await hoverTo([.3,-1]);const eid=await ev('freeFoldDebug.hover&&freeFoldDebug.hover.id');
assert.match(String(eid),/^edge:paper\/s1\.(keep|cut)\|bottom$/,'外周辺が面ごとの線分になっていない: '+eid);
await grabAt([.3,-1]);assert.equal(await sessionId(),eid);
/* 折り目は行き先の「目印」にはなるが、壁ではない＝運べる幅は紙片ぜんぶ。 */
assert.deepEqual(await ev('freeFoldDebug.dragSession.source.targets.map(t=>t.kind)'),['crease','edge'],'行き先の候補が折り目と対辺の2つでない');
assert.equal(near(await ev('freeFoldDebug.dragSession.source.span'),2,1e-6),true,'折り目で運べる幅が止められている');
/* 折り目に近づけば吸いつく（目印としては生きている）。その折りでは向こう側は動かない。 */
await carryTo([.3,-.52]);let f9=await frame();
assert.equal(f9.ghost.snapped,true,'折り目に吸いつかない');
assert.match(await status(),/ぴたりと合わせました/,'吸いついた時の表示が違う: '+(await status()));
assert.equal(near(f9.crease[0][1],-.75,.01),true,'折線が中間でない: '+f9.crease[0][1]);
assert.equal(f9.moving.length,1,'折り目までの折りなのに向こう側まで動いた');
/* 折り目の向こうまで運べる。そのときは折り目の両側が一緒に動く。 */
await carryTo([.3,.5]);f9=await frame();
assert.equal(await angle(),180,'折り目の向こうへ運んだら折れなくなった｜'+(await status()));
assert.equal(f9.ghost.snapped,false);
assert.equal(f9.moving.length,2,'折り目をまたいだのに片側しか動いていない');
assert.equal(near(f9.crease[0][1],-.25,.01),true,'折線が指の線との中間でない: '+f9.crease[0][1]);
const acrossShot=await shot('freefold-edge-across-crease.png');
await dropAt([.3,.5]);await click('cancel');
/* ★F1/F2 画像の再現そのもの：角(1,1)を(-0.8,-0.45)へ。折り目をまたぐ角折り。 */
await grabAt([1,1]);await carryTo([-.8,-.45]);
f9=await frame();assert.equal(f9.moving.length,2,'F2 ゴーストで折り目の両側が動いていない');
assert.equal(f9.ghost.angle,180);
await dropAt([-.8,-.45]);await click('confirm');
assert.equal(await steps(),2);
assert.equal(await ev('freeFoldDebug.state.recipe.steps[1].targets.length'),2,'原本の targets が片側だけ');
const noTearShot=await shot('freefold-crease-no-tear.png');
/* ★F1 実画素で「折り目にそって破れていない」を見る。
   ①本人の合格条件：折り目の線にそって背景（紙でない色）が出ていないこと。
   ②それだけでは足りない：片側だけ動いても、向こう側に別の紙が残っていて背景が出ないことがある。
     そこで「折り目をまたいだ小片が、もと居た所を空けて、運ばれた先に居る」を画素で見る。
     置き去りなら、もと居た所に赤い紙が残ったままになる。 */
const WHITE='R>200&&G>200&&B>200',RED='R>200&&G<170&&B<170';
const bgAlongCreases=async()=>{const segs=(await frame()).creases;assert.equal(segs.length>0,true,'折り目が消えた');
 let hit=0,seen=0;
 for(const g of segs)for(let i=2;i<=8;i++){const t=i/10,p=[g[0][0]+(g[1][0]-g[0][0])*t,g[0][1]+(g[1][1]-g[0][1])*t];
  seen++;if(await emptyAt(p,3))hit++}
 return{hit,seen}};
const tear=await bgAlongCreases();
assert.equal(tear.seen>=14,true,'折り目の上を測れていない: '+JSON.stringify(tear));
assert.equal(tear.hit,0,`F1 折り目にそって紙が無い（背景が見えている）: ${tear.hit}/${tear.seen}点`);
const spot=await ev(`(()=>{const st=freeFoldDebug.state;
 const iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const cen=q=>q.reduce((s,v)=>[s[0]+v[0]/q.length,s[1]+v[1]/q.length],[0,0]);
 const f=st.cache.faces.find(v=>v.faceId==='paper/s1.cut/s2.cut');if(!f)return null;
 return{src:cen(f.poly.map(p=>iv(f.xf,p))),now:cen(f.poly),layer:f.layer}})()`);
assert.equal(spot!==null,true,'F1 折り目の向こう側の紙が動いていない（またいだ小片が原本に無い）');
assert.equal(spot.layer>0,true,'F1 またいだ小片が持ち上がっていない');/* 本番の積み直しでは1と2に分かれる */
/* 紙が無い＝キャンバスが透明（背景の #070b16 は body の色で、キャンバスは塗っていない）。 */
assert.equal(await emptyAt(spot.src,4),true,'F1 折り目の向こうの紙が置き去りになっている（もと居た所に紙が残っている）');
assert.equal(await countColor(spot.src,4,RED)>0,false,'F1 もと居た所に赤い紙が残っている＝片側だけ動いた');
assert.equal(await countColor(spot.now,4,WHITE)>0,true,'F1 折り目をまたいだ紙が運ばれた先に無い');
/* 折り目の向こう側も本当に持ち上がっている（層が上がった面が2枚）。 */
assert.equal(await ev('freeFoldDebug.state.cache.faces.filter(v=>v.layer>0).length'),2,'折り目の向こう側が動いていない');
/* 折ったあと、折り目の結びの両側は同じ平面・同じ層のまま（紙片の不変条件）。 */
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state;
 for(const b of st.cache.bonds){if(b.kind!=='crease')continue;
  const x=st.cache.faces.find(f=>f.faceId===b.faceIds[0]),y=st.cache.faces.find(f=>f.faceId===b.faceIds[1]);
  if(!x||!y)continue;
  const ap=(m,q)=>[m[0]*q[0]+m[1]*q[1]+m[4],m[2]*q[0]+m[3]*q[1]+m[5]];
  for(const q of b.seg){const u=ap(x.xf,q),v=ap(y.xf,q);if(Math.hypot(u[0]-v[0],u[1]-v[1])>1e-7)return 'seg'}
  if(x.xf.some((v,i)=>Math.abs(v-y.xf[i])>1e-9))return 'xf'}return 'ok'})()`),'ok','折り目の両側がちぎれている');
await click('undo');await click('undo');assert.equal(await steps(),0);
assert.deepEqual((await frame()).creases,[]);

mark('10 edge match across a crease: the split opposite rim is one target, and nothing tears');
/* ★F1' つかんだ辺に垂直な折り目を入れると、反対の外周辺は2本に割れる。それでも1本の行き先として吸いつき、
   折り目をまたいで必要な面が一緒に動き、紙は破れない。共線をつながずに捨てていた頃はここで吸いつかなかった。 */
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),true);
await grabAt([1,.3]);await carryTo([.3,.3]);await dropAt([.3,.3]);await click('confirm');
assert.equal(await steps(),1);assert.equal(await ev("freeFoldDebug.state.recipe.steps[0].op"),'crease');
assert.deepEqual(asLine((await frame()).creases[0]).map(q=>q.map(v=>Math.round(v*1e6)/1e6)),asLine([[.65,-1],[.65,1]]),"F1' 縦の折り目がついていない");
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),false);
/* 折り目の左側の下辺をつかむ。反対の上辺は折り目で2本に割れている。 */
await grabAt([-.5,-1]);const rimId=await sessionId();
assert.match(String(rimId),/^edge:paper\/s1\.keep\|bottom$/,"F1' 折り目の左の下辺をつかめていない: "+rimId);
assert.deepEqual(await ev('freeFoldDebug.dragSession.source.targets.map(t=>t.kind)'),['edge'],"F1' 割れた反対の外周辺が1本にまとまっていない");
assert.equal(near(await ev('freeFoldDebug.dragSession.source.targets[0].d'),2,1e-6),true,"F1' 行き先が対辺でない");
/* 短い方の半分（折り目の右）の上でも吸いつく＝共線をつないだ効き目。 */
await carryTo([.85,.97]);let f10=await frame();
assert.equal(f10.ghost.snapped,true,"F1' 折り目で割れた反対の外周辺に吸いつかない");
assert.match(await status(),/上辺にぴたりと合わせました/,"F1' 吸いついた時の表示が違う: "+(await status()));
assert.equal(await angle(),180,"F1' 吸いついたのに180°でない");
assert.equal(f10.moving.length,2,"F1' 折り目の両側が一緒に動いていない");
assert.equal(near(f10.crease[0][1],0,.01),true,"F1' 折線が中線でない: "+f10.crease[0][1]);
const acrossRimShot=await shot('freefold-edge-across-rim.png');
await dropAt([.85,.97]);await click('confirm');
assert.equal(await steps(),2);
assert.equal(await ev('freeFoldDebug.state.recipe.steps[1].targets.length'),2,"F1' 原本の targets が片側だけ");
assert.equal(await ev('freeFoldDebug.state.cache.faces.filter(v=>v.layer>0).length'),2,"F1' 持ち上がった面が2枚でない");
const acrossRimDoneShot=await shot('freefold-edge-across-rim-done.png');
/* ①折り目にそって紙が無い所が無い（色でなく不透明度で見る）。 */
const tear10=await bgAlongCreases();
assert.equal(tear10.seen>=14,true,"F1' 折り目の上を測れていない: "+JSON.stringify(tear10));
assert.equal(tear10.hit,0,`F1' 折り目にそって紙が無い（背景が見えている）: ${tear10.hit}/${tear10.seen}点`);
/* ②またいだ小片が、もと居た所を空けて、運ばれた先に居る。 */
const spot10=await ev(`(()=>{const st=freeFoldDebug.state;
 const iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const cen=q=>q.reduce((s,v)=>[s[0]+v[0]/q.length,s[1]+v[1]/q.length],[0,0]);
 const f=st.cache.faces.find(v=>v.faceId==='paper/s1.cut/s2.cut');if(!f)return null;
 return{src:cen(f.poly.map(p=>iv(f.xf,p))),now:cen(f.poly),layer:f.layer}})()`);
assert.equal(spot10!==null,true,"F1' 折り目の向こう側の小片が原本に無い");
assert.equal(spot10.layer>0,true,"F1' またいだ小片が持ち上がっていない");
assert.equal(await emptyAt(spot10.src,4),true,"F1' もと居た所に紙が残っている");
assert.equal(await countColor(spot10.src,4,RED)>0,false,"F1' もと居た所に赤い紙が残っている＝片側だけ動いた");
assert.equal(await countColor(spot10.now,4,WHITE)>0,true,"F1' 運ばれた先に紙が無い");
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state;
 for(const b of st.cache.bonds){if(b.kind!=='crease')continue;
  const x=st.cache.faces.find(f=>f.faceId===b.faceIds[0]),y=st.cache.faces.find(f=>f.faceId===b.faceIds[1]);
  if(!x||!y)continue;
  const ap=(m,q)=>[m[0]*q[0]+m[1]*q[1]+m[4],m[2]*q[0]+m[3]*q[1]+m[5]];
  for(const q of b.seg){const u=ap(x.xf,q),v=ap(y.xf,q);if(Math.hypot(u[0]-v[0],u[1]-v[1])>1e-7)return 'seg'}
  if(x.xf.some((v,i)=>Math.abs(v-y.xf[i])>1e-9))return 'xf'}return 'ok'})()`),'ok',"F1' 折り目の両側がちぎれている");
await click('undo');await click('undo');assert.equal(await steps(),0);
assert.deepEqual((await frame()).creases,[]);

mark('11 the reported tear: a hinge crossing the selection must refuse, not tear');
/* ★添付画像の再現。1手目＝右辺を左辺へ（半分折り）／2手目＝角(-1,-1)を(-0.4,-0.4)へ「上から1枚」
   ／3手目＝角(0,1)を(-0.45,0.45)へ。ここで「上から1枚」を選ぶと、1手目の背（ヒンジ）が動く側の
   内部に残り、90°で口が開いて紙が裂けていた。いまは理由をつけて断り、ゴーストも出さない。 */
const PICK11='R>100&&R<170&&G>190&&B>230';
assert.equal(await steps(),0,'11 の入口が0手でない');
assert.equal(await ev('freeFoldDebug.op'),'fold');assert.equal(await ev('freeFoldDebug.asCrease'),false);
/* 1手目：半分折り */
await grabAt([1,.3]);await carryTo([-.97,.3]);await dropAt([-.97,.3]);await click('confirm');
assert.equal(await steps(),1,'11 1手目が入らない');
/* 2手目：角(-1,-1)→(-0.4,-0.4) を「上から1枚」 */
await grabAt([-1,-1]);await carryTo([-.4,-.4]);await dropAt([-.4,-.4]);
assert.equal((await frame()).pick.applied,1,'11 2手目が上から1枚になっていない');
await click('confirm');assert.equal(await steps(),2,'11 2手目が入らない');
const tornBefore={r:await recipeText(),rev:await ev('freeFoldDebug.state.revision'),h:await ev('freeFoldDebug.state.cache.hash')};
/* 3手目：ここが不具合の起きた操作。 */
await grabAt([0,1]);await carryTo([-.45,.45]);
assert.equal(await angle(),null,'11 裂ける選び方なのにドラッグ中にゴーストが出た｜'+(await status()));
await dropAt([-.45,.45]);
let p11=(await frame()).pick;
assert.equal(!!p11,true,'11 指を離しても候補が出ない｜'+(await status()));
assert.equal(p11.count,2,'11 この場所が2枚でない');
assert.equal(p11.applied,null,'11 上から1枚が成立してしまっている');
assert.equal(p11.ok,false,'11 裂ける選び方が「折れます」になっている');
assert.match(String(p11.reason),/つながっている紙が置き去り/,'11 断る理由が違う: '+p11.reason);
assert.match(await ev(`document.getElementById('stackNote').textContent`),/折れません：.*置き去り/,'11 理由が「詳しく」に出ていない');
assert.equal(await angle(),null,'11 断ったのにゴーストが出ている');
assert.equal((await frame()).ghost,null,'11 断ったのにゴーストが残っている');
assert.equal(await disabled('confirm'),true,'11 裂ける形が確定できる');
await click('confirm');/* 押しても何も起きない */
assert.equal(await steps(),2);
assert.equal(await recipeText(),tornBefore.r,'11 断られた操作で原本が変わった');
assert.equal(await ev('freeFoldDebug.state.revision'),tornBefore.rev,'11 revision が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),tornBefore.h,'11 cache.hash が動いた');
const tearShot=await shot('freefold-tear-refused.png');
/* 「上から2枚」にすれば、つながっている紙も一緒に動くので折れる。 */
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2').click()`);
p11=(await frame()).pick;
assert.equal(p11.ok,true,'11 上から2枚でも折れない: '+p11.reason);
assert.equal(p11.faces.length,2,'11 2面が対象になっていない');
assert.equal(await angle(),180,'11 上から2枚でゴーストが出ない');
assert.equal(await disabled('confirm'),false,'11 成立しているのに確定できない');
/* 0°／90°／180°のどれでも、結びの線は両側で同じ所に来ている。 */
const gaps11=await ev(`(()=>{const st=freeFoldDebug.state,q=st.pending;
 const ap=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[4],m[2]*v[0]+m[3]*v[1]+m[5]];
 const out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(st,a),ids=g.movingIds,A=g.line[0],B=g.line[1];
  const rad=a*Math.PI/180,sg=q.kind==='V'?1:-1,dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const rot=v=>{if(a===0)return[v[0],0,-v[1]];if(a===180){const r=FreeFoldEngine.reflect(v,A,B);return[r[0],0,-r[1]]}
   const vx=v[0]-A[0],vy=v[1]-A[1],al=vx*ux+vy*uy,px=A[0]+al*ux,py=A[1]+al*uy,pe=Math.hypot(v[0]-px,v[1]-py);
   return[px+(v[0]-px)*Math.cos(rad),sg*pe*Math.sin(rad),-(py+(v[1]-py)*Math.cos(rad))]};
  const put=(f,v)=>ids.includes(f)&&FreeFoldEngine.side(v,A,B)<-1e-9?rot(v):[v[0],0,-v[1]];
  let w=0;
  for(const bd of st.cache.bonds){const fx=st.cache.faces.find(v=>v.faceId===bd.faceIds[0]);if(!fx)continue;
   for(let i=0;i<=8;i++){const t=i/8,v=ap(fx.xf,[bd.seg[0][0]+(bd.seg[1][0]-bd.seg[0][0])*t,bd.seg[0][1]+(bd.seg[1][1]-bd.seg[0][1])*t]);
    const u1=put(bd.faceIds[0],v),u2=put(bd.faceIds[1],v);w=Math.max(w,Math.hypot(u1[0]-u2[0],u1[1]-u2[1],u1[2]-u2[2]))}}
  out.push(w)}
 FreeFoldEngine.preview(st,180);return out})()`);
assert.equal(Math.max(...gaps11)<1e-9,true,'11 0/90/180 のどれかで結びの線が開いている: '+JSON.stringify(gaps11));
await click('confirm');assert.equal(await steps(),3,'11 上から2枚で確定できない');
/* ★この斜めの角折り専用の裂け目検査。
   ⚠結びの線は紙の「ふち」なので、そこに箱を置くと外側の透明画素を拾ってしまう（一度これで誤検出した）。
     結びの上の点を、その結びが繋いでいる**面それぞれの内側**へ少し寄せてから測る。
     裂けていれば、繋がっているはずの面が消えて、そこに紙が描かれない。 */
const bondProbe=await ev(`(()=>{const st=freeFoldDebug.state,
 ap=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[4],m[2]*v[0]+m[3]*v[1]+m[5]],
 cen=q=>q.reduce((a,v)=>[a[0]+v[0]/q.length,a[1]+v[1]/q.length],[0,0]);
 const out=[];
 for(const bd of st.cache.bonds){const fs=bd.faceIds.map(id=>st.cache.faces.find(f=>f.faceId===id));
  if(fs.some(f=>!f))continue;
  for(const f of fs){const c=cen(f.poly);
   for(const t of[.25,.5,.75]){const q=ap(f.xf,[bd.seg[0][0]+(bd.seg[1][0]-bd.seg[0][0])*t,bd.seg[0][1]+(bd.seg[1][1]-bd.seg[0][1])*t]);
    out.push([q[0]+(c[0]-q[0])*.12,q[1]+(c[1]-q[1])*.12])}}}
 return out})()`);
assert.equal(bondProbe.length>=12,true,'11 結びの上を測れていない: '+bondProbe.length);
let holes=0;for(const q of bondProbe)if(await emptyAt(q,2))holes++;
assert.equal(holes,0,`11 結びのそばに紙が描かれていない（裂け目）: ${holes}/${bondProbe.length}点`);
/* 素材で隣どうしの点が、折ったあとも離れていない（＝紙は破れていない）。この操作専用に画面側で測る。 */
const disc11=await ev(`(()=>{const st=freeFoldDebug.state,
 ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]],
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))}));
 const cur=u=>{for(const f of F)if(FreeFoldEngine.inside(u,f.src))return ap(f.xf,u);return null};
 const G=60,h=2/G;let bad=0,tot=0,worst=0;
 for(let i=0;i<G;i++)for(let j=0;j<G;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
  for(const q of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const A=cur(p),B=cur(q);if(!A||!B)continue;tot++;
   const d=Math.hypot(A[0]-B[0],A[1]-B[1]);if(d>h*1.0001+1e-9){bad++;worst=Math.max(worst,d)}}}
 return{bad,tot,worst}})()`);
assert.equal(disc11.tot>2000,true,'11 破れの検査で測った点が少なすぎる: '+disc11.tot);
assert.equal(disc11.bad,0,`11 紙が破れている：${disc11.bad}/${disc11.tot}点 最大 ${disc11.worst}`);
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state,ap=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[4],m[2]*v[0]+m[3]*v[1]+m[5]];
 for(const b of st.cache.bonds){const x=st.cache.faces.find(f=>f.faceId===b.faceIds[0]),y=st.cache.faces.find(f=>f.faceId===b.faceIds[1]);
  if(!x||!y)continue;for(const q of b.seg){const u=ap(x.xf,q),v=ap(y.xf,q);if(Math.hypot(u[0]-v[0],u[1]-v[1])>1e-7)return 'seg'}}return 'ok'})()`),'ok','11 確定後に結びが切れている');
const fixedShot=await shot('freefold-tear-fixed.png');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'11 巻き戻せない');

mark('12 the reported open paper: "top 1 sheet" must not pick up a face that is not under the finger');
/* ★添付画像の再現（2026-09-12・本人指摘）。2手＝角(1,-1)→(0.2,-0.4)／角(1,1)→(0,0.4)。
   そのあと角(0,0.4)→(0.6,0.4) を「上から1枚」。直す前は layer番号が同じというだけで
   paper/s1.cut（指の下にない、離れた場所の面）まで対象に入り、一度のしぐさで2か所の紙が
   別々に持ち上がった＝紙が開いて見えた。素材ではつながっていないので、結びの不変条件にも
   破れ（等長）の検査にも出ない＝L群（mark 11）では掴めなかった。 */
const rgbAt=async p=>{const q=await point(p);return ev(`(()=>{const v=document.getElementById('view'),g=v.getContext('2d'),d=window.devicePixelRatio||1;
 const im=g.getImageData(Math.round(${q[0]}*d),Math.round(${q[1]}*d),1,1).data;return[im[0],im[1],im[2],im[3]]})()`)};
await grabAt([1,-1]);await carryTo([.7,-.8]);await carryTo([.2,-.4]);await dropAt([.2,-.4]);
await click('confirm');
await grabAt([1,1]);await carryTo([.6,.8]);await carryTo([0,.4]);await dropAt([0,.4]);
await click('confirm');
assert.equal(await steps(),2,'12 2手にならない｜'+(await status()));
assert.deepEqual((await ev('freeFoldDebug.state.cache.faces.map(f=>f.faceId)')).slice().sort(),
 ['paper/s1.cut','paper/s1.keep/s2.cut','paper/s1.keep/s2.keep'],'12 2手の紙が画像どおりに再現できていない');
assert.equal(await ev('freeFoldDebug.state.cache.faces.filter(f=>f.layer===1).length'),2,
 '12 同じ層番号の面が離れて2つある状態になっていない（検査の意味がない）');
/* 離れた面のどこを見張るかを決めておく（重心と、そこから頂点へ6割寄せた点）。 */
const farPts=await ev(`(()=>{const f=freeFoldDebug.state.cache.faces.find(v=>v.faceId==='paper/s1.cut'),
 c=f.poly.reduce((a,v)=>[a[0]+v[0]/f.poly.length,a[1]+v[1]/f.poly.length],[0,0]);
 return[c,...f.poly.map(v=>[c[0]+(v[0]-c[0])*.6,c[1]+(v[1]-c[1])*.6])]})()`);
const farBefore=[];for(const q of farPts)farBefore.push(await rgbAt(q));
const before12=await ev('({r:JSON.stringify(freeFoldDebug.state.recipe),rev:freeFoldDebug.state.revision,h:freeFoldDebug.state.cache.hash})');
await grabAt([0,.4]);await carryTo([.35,.4]);await carryTo([.6,.4]);await dropAt([.6,.4]);
const p12=(await frame()).pick;
assert.equal(!!p12,true,'12 指を離しても「この場所の重なり」が出ない｜'+(await status()));
assert.deepEqual(p12.stack.map(v=>v.faceId),['paper/s1.keep/s2.cut','paper/s1.keep/s2.keep'],'12 この場所の重なりが画像と違う');
assert.equal(p12.count,2,'12 この場所が2枚になっていない');
assert.equal(p12.ok,true,'12 上から1枚が折れないと言っている: '+p12.reason);
assert.deepEqual(p12.faces,['paper/s1.keep/s2.cut'],
 '12 指の下にない離れた面まで「上から1枚」に入っている: '+JSON.stringify(p12.faces));
assert.match(await ev('freeFoldDebug.detail')||'',/上から1枚（1面）/,'12 「詳しく」が「1面」になっていない: '+(await ev('freeFoldDebug.detail')));
/* 動くのは1か所だけ。画面の側から数える＝ゴーストも、強調も、1枚ぶん。 */
assert.equal(await ev('freeFoldDebug.geometry.parts.filter(p=>p.move).length'),1,'12 動く紙が2か所ある（紙が開いている）');
assert.deepEqual(await ev('freeFoldDebug.frame.moving'),['paper/s1.keep/s2.cut'],'12 画面が2か所を動かしている');
/* 離れた面は1画素も変わっていない＝そこの紙は持ち上がっていない。 */
for(let i=0;i<farPts.length;i++)assert.deepEqual(await rgbAt(farPts[i]),farBefore[i],
 `12 指の下にない ${JSON.stringify(farPts[i])} の紙が動いた（紙が開いた）`);
/* 上から2枚にしても、入るのは「この場所の2枚目」であって、離れた面ではない。 */
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2')?.click()`);
assert.equal(((await frame()).pick.faces||[]).includes('paper/s1.cut'),false,'12 上から2枚に離れた面が入っている');
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='1').click()`);
const openShot=await shot('freefold-far-face-refused.png');
/* 確定しても、原本に書かれるのは指の下の1面だけ。 */
assert.equal(await disabled('confirm'),false,'12 成立しているのに確定できない');
await click('confirm');assert.equal(await steps(),3,'12 3手目が確定できない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps[2].targets.map(t=>t.faceId)'),['paper/s1.keep/s2.cut'],
 '12 原本に離れた面まで書かれている');
const disc12=await ev(`(()=>{const st=freeFoldDebug.state,
 ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]],
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))}));
 const cur=u=>{for(const f of F)if(FreeFoldEngine.inside(u,f.src))return ap(f.xf,u);return null};
 const G=60,h=2/G;let bad=0,tot=0,worst=0;
 for(let i=0;i<G;i++)for(let j=0;j<G;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
  for(const q of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const A=cur(p),B=cur(q);if(!A||!B)continue;tot++;
   const d=Math.hypot(A[0]-B[0],A[1]-B[1]);if(d>h*1.0001+1e-9){bad++;worst=Math.max(worst,d)}}}
 return{bad,tot,worst}})()`);
assert.equal(disc12.bad,0,`12 確定後に紙が破れている：${disc12.bad}/${disc12.tot}点 最大 ${disc12.worst}`);
/* 素材で隣り合っているのに結びが無い所は1つも無い（画面側からも数える）。 */
const seam12=await ev(`(()=>{const st=freeFoldDebug.state,
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({id:f.faceId,src:f.poly.map(p=>iv(f.xf,p))})),EPSN=2e-4;
 const at=p=>F.filter(f=>FreeFoldEngine.inside(p,f.src));
 const on=(x,y,m)=>{for(const bd of st.cache.bonds){const s=new Set(bd.faceIds);if(!s.has(x)||!s.has(y))continue;
  const a=bd.seg[0],b=bd.seg[1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<1e-12)continue;
  const off=Math.abs(((m[0]-a[0])*dy-(m[1]-a[1])*dx)/L),t=((m[0]-a[0])*dx+(m[1]-a[1])*dy)/(L*L);
  if(off<=2e-3&&t>=-2e-3&&t<=1+2e-3)return true}return false};
 let over=0,miss=0,inner=0,rim=0;
 for(const f of F)for(let i=0;i<f.src.length;i++){const a=f.src[i],b=f.src[(i+1)%f.src.length];
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<1e-9)continue;const nx=dy/L,ny=-dx/L;
  for(let k=0;k<16;k++){const t=(k+.5)/16,m=[a[0]+dx*t,a[1]+dy*t];
   const p1=at([m[0]+nx*EPSN,m[1]+ny*EPSN]),p2=at([m[0]-nx*EPSN,m[1]-ny*EPSN]);
   if(p1.length>1||p2.length>1){over++;continue}
   if(!p1.length||!p2.length){rim++;continue}
   if(p1[0].id===p2[0].id)continue;inner++;if(!on(p1[0].id,p2[0].id,m))miss++}}
 return{over,miss,inner,rim}})()`);
assert.equal(seam12.over,0,'12 素材で面が重なっている: '+seam12.over);
assert.equal(seam12.miss,0,`12 素材で隣り合っているのに結びが無い所がある: ${seam12.miss}/${seam12.inner}`);
assert.equal(seam12.inner>0&&seam12.rim>0,true,'12 境界の走査が効いていない: '+JSON.stringify(seam12));
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'12 巻き戻せない');

mark('13 redo: the recipe is the only record, and the paper comes back exactly');
/* ★やり直し(redo)。undo で外した「原本の手」だけを積み、戻すときも先頭から再生しなおす。
   面・結び・層・cache は1つも持たない＝画面の側から、形・表裏・層・ハッシュが完全に戻ることで見る。 */
assert.equal(await steps(),0,'13 まっさらから始まっていない');
/* mark 12 で3回巻き戻しているので、ここではまだ「やり直す」が生きている＝undo が手を積んでいる証拠。 */
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),3,'13 巻き戻した手が積まれていない');
assert.equal(await disabled('redo'),false,'13 巻き戻したのに「やり直す」が押せない');
await grabAt([1,-1]);await carryTo([.7,-.8]);await carryTo([.2,-.4]);await dropAt([.2,-.4]);await click('confirm');
await grabAt([1,1]);await carryTo([.6,.8]);await carryTo([0,.4]);await dropAt([0,.4]);await click('confirm');
await grabAt([0,.4]);await carryTo([.35,.4]);await carryTo([.6,.4]);await dropAt([.6,.4]);await click('confirm');
assert.equal(await steps(),3,'13 3手にならない｜'+(await status()));
const shape13=async()=>ev(`freeFoldDebug.state.cache.faces.map(f=>({id:f.faceId,layer:f.layer,back:FreeFoldEngine.detXf(f.xf)<0,
 path:f.layerPath.map(q=>q.stepId+'.'+q.side).join('>'),poly:f.poly.map(p=>p.map(v=>Math.round(v*1e6)/1e6))}))`);
const full13={r:await recipeText(),h:await ev('freeFoldDebug.state.cache.hash'),s:await shape13(),rev:await ev('freeFoldDebug.state.revision')};
assert.equal(await disabled('redo'),true,'13 確定したのに「やり直す」が押せる');
/* 離れた面の画素は、巻き戻し→やり直しのあいだも「戻ったとき」に元どおりでなければならない。 */
const farPts13=await ev(`(()=>{const f=freeFoldDebug.state.cache.faces.find(v=>v.faceId==='paper/s1.cut'),
 c=f.poly.reduce((a,v)=>[a[0]+v[0]/f.poly.length,a[1]+v[1]/f.poly.length],[0,0]);
 return[c,...f.poly.map(v=>[c[0]+(v[0]-c[0])*.6,c[1]+(v[1]-c[1])*.6])]})()`);
const farFull13=[];for(const q of farPts13)farFull13.push(await rgbAt(q));
/* 2回巻き戻す。 */
await click('undo');assert.equal(await steps(),2,'13 1回めの巻き戻しができない');
const two13={r:await recipeText(),h:await ev('freeFoldDebug.state.cache.hash'),s:await shape13()};
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),1,'13 巻き戻した手が積まれていない');
assert.equal(await disabled('redo'),false,'13 巻き戻したのに「やり直す」が押せない');
await click('undo');assert.equal(await steps(),1,'13 2回めの巻き戻しができない');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),2,'13 2手ぶん積まれていない');
/* 候補を持っているあいだは、履歴を動かさない。 */
await grabAt([-1,-1]);await carryTo([-.7,-.7]);await dropAt([-.6,-.6]);
assert.equal(await disabled('undo'),true,'13 候補があるのに巻き戻せる');
assert.equal(await disabled('redo'),true,'13 候補があるのにやり直せる');
await click('cancel');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),2,'13 取消でやり直しの道が消えた');
assert.equal(await disabled('redo'),false,'13 取消のあと「やり直す」が押せない');
/* 2回やり直す＝形も表裏も層も原本もハッシュも完全に戻る。 */
await click('redo');assert.equal(await steps(),2,'13 1回めのやり直しができない');
assert.equal(await recipeText(),two13.r,'13 1回めのやり直しで原本が戻らない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),two13.h,'13 1回めのやり直しでハッシュが戻らない');
assert.deepEqual(await shape13(),two13.s,'13 1回めのやり直しで形・表裏・層が戻らない');
await click('redo');assert.equal(await steps(),3,'13 2回めのやり直しができない');
assert.equal(await recipeText(),full13.r,'13 2回めのやり直しで原本が戻らない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),full13.h,'13 2回めのやり直しでハッシュが戻らない');
assert.deepEqual(await shape13(),full13.s,'13 2回めのやり直しで形・表裏・層が戻らない');
assert.equal(await disabled('redo'),true,'13 やり直しきったのに押せる');
assert.equal(await ev('freeFoldDebug.state.revision'),full13.rev+4,'13 revision が確定/巻き戻し/やり直しのぶんだけ増えていない');
/* 指の下にない離れた面も、元の画素にぴたりと戻っている。 */
for(let i=0;i<farPts13.length;i++)assert.deepEqual(await rgbAt(farPts13[i]),farFull13[i],
 `13 やり直しても ${JSON.stringify(farPts13[i])} の紙が戻っていない`);
const redoShot=await shot('freefold-redo.png');
/* 保存しても、やり直しの道は消えない。保存する原本に redo の情報も入らない。 */
await click('undo');assert.equal(await steps(),2,'13 保存の検査のために巻き戻せない');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),1,'13 巻き戻した手が積まれていない');
const savedR=await ev('JSON.stringify(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state))');
assert.equal(savedR,await recipeText(),'13 保存する原本が表示中の原本と違う');
assert.equal(/redo/i.test(savedR),false,'13 保存する原本に redo が混ざっている');
const before13=await fs.readdir(downloads);await click('save');
/* 落ちてきたファイルは片づける（残すと、あとの検査のダウンロード待ちが詰まる）。 */
await poll(async()=>{const g=await fs.readdir(downloads);return g.find(v=>v.endsWith('.origami.json')&&!before13.includes(v))},'download13',30)
 .then(f=>fs.unlink(path.join(downloads,f))).catch(()=>{});
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),1,'13 保存でやり直しの道が消えた');
assert.equal(await disabled('redo'),false,'13 保存で「やり直す」が押せなくなった');
/* 巻き戻したあと新しく折ったら、やり直しの道は消える。 */
await grabAt([0,.4]);await carryTo([.3,.5]);await carryTo([.45,.55]);await dropAt([.45,.55]);await click('confirm');
assert.equal(await steps(),3,'13 新しい3手目が入らない｜'+(await status()));
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),0,'13 新しい手を確定したのにやり直しの道が残っている');
assert.equal(await disabled('redo'),true,'13 消えたはずのやり直しが押せる');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'13 巻き戻せない');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),3,'13 巻き戻した3手が積まれていない');
await click('redo');await click('redo');await click('redo');assert.equal(await steps(),3,'13 3回やり直せない');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'13 片づけで巻き戻せない');

mark('14 E1: the grabbed rim edge is identified at pointerdown and never re-guessed while dragging');
/* ★E1。外周辺をつかんだ瞬間に「どの原本の辺か」（ふちの名前・faceId・層経路・紙片・素材の区間）を凍結する。
   ドラッグ中は、いまの重なりから推測し直さない＝frame.intent が1歩も動かないことで見る。
   E2（辺を折り目へ合わせる）はまだ入れていないので、ここで見るのは「凍結できているか」だけ。 */
assert.equal(await steps(),0,'14 まっさらから始まっていない');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),true,'14 折り目だけモードに入れない');
await grabAt([.3,-1]);await carryTo([.3,0]);await dropAt([.3,0]);await click('confirm');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),false,'14 折るモードに戻れない');
assert.equal(await steps(),1,'14 折り目が1手入っていない');
/* 折り目で右辺が2区間に割れている＝取りちがえの起きる形。 */
const rims14=await ev('FreeFoldEngine.rimEdges(freeFoldDebug.state).map(e=>e.edgeId)');
assert.deepEqual(rims14.slice().sort(),['rim:bottom|paper/s1.cut','rim:left|paper/s1.cut','rim:left|paper/s1.keep',
 'rim:right|paper/s1.cut','rim:right|paper/s1.keep','rim:top|paper/s1.keep'],'14 ふちのIDが再生から出ていない: '+JSON.stringify(rims14));
assert.deepEqual(await ev('FreeFoldEngine.creaseIntervals(freeFoldDebug.state).map(c=>c.intervalId)'),['s1#1'],'14 折り目の区間IDが出ていない');
/* 上側の右辺をつかむ＝凍結されるのは paper/s1.keep の右辺。 */
await grabAt([1,.3]);
const i0=(await frame()).intent;
assert.equal(!!i0,true,'14 辺をつかんでも入力の意図が凍結されていない｜'+(await status()));
assert.equal(i0.kind,'edge','14 意図の種類が辺でない');
assert.equal(i0.edgeId,'rim:right|paper/s1.keep','14 つかんだ辺のIDが違う: '+i0.edgeId);
assert.equal(i0.rimId,'right','14 ふちの名前が違う');
assert.equal(i0.faceId,'paper/s1.keep','14 faceId が違う');
assert.equal(i0.sheetId,'paper/s1.cut','14 紙片が違う（折り目でつながった紙片の代表）: '+i0.sheetId);
assert.deepEqual(i0.layerPath.map(q=>q.stepId+'.'+q.side),['s1.keep'],'14 層経路が違う');
assert.deepEqual(i0.srcSeg,[[1,-0.5],[1,1]],'14 原本座標の区間が違う: '+JSON.stringify(i0.srcSeg));
/* ドラッグ中、指がどこへ行っても意図は1歩も動かない。 */
for(const q of[[.5,.3],[0,.3],[-.5,-.7],[.2,-.9],[-.9,.9]]){await carryTo(q);
 assert.deepEqual((await frame()).intent,i0,`14 ドラッグ中に入力の意図が作り直された（${JSON.stringify(q)}）`)}
await dropAt([0,.3]);
assert.deepEqual((await frame()).intent,i0,'14 指を離したら意図が消えた（候補は残っているのに）');
await click('cancel');
assert.equal((await frame()).intent,null,'14 取り消しても意図が残っている');
/* 下側の右辺は別の区間＝別のID。取りちがえない。 */
await grabAt([1,-.8]);
const i1=(await frame()).intent;
assert.equal(i1.edgeId,'rim:right|paper/s1.cut','14 下の区間を取りちがえた: '+i1.edgeId);
assert.deepEqual(i1.srcSeg,[[1,-1],[1,-0.5]],'14 下の区間の原本座標が違う');
await dropAt([1,-.8]);await click('cancel');
/* 原本にも保存にも、E1 のIDは1文字も混ざらない。 */
const saved14=await ev('JSON.stringify(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state))');
for(const w of['rim:','intervalId','edgeId','sheetId'])
 assert.equal(saved14.includes(w),false,`14 保存する原本に ${w} が混ざっている`);
/* 巻き戻して やり直しても、同じIDが同じ順で出てくる（キャッシュから戻していない）。 */
const before14=await ev('JSON.stringify(FreeFoldEngine.rimEdges(freeFoldDebug.state).map(e=>[e.edgeId,e.srcSeg]))');
await click('undo');await click('redo');
assert.equal(await ev('JSON.stringify(FreeFoldEngine.rimEdges(freeFoldDebug.state).map(e=>[e.edgeId,e.srcSeg]))'),before14,
 '14 巻き戻し→やり直しでふちのIDが変わった');
await click('undo');assert.equal(await steps(),0,'14 片づけで巻き戻せない');

mark('15 E1.5: grabbing a rim edge of a FOLDED sheet, safely');
/* ★E1.5。1手折ったあとの紙でも、見えている外周辺をつかめる（合わせる操作＝E2 はまだ入れない）。
   決めるのは engine の rimEdges（素材座標のふち）と stackAt（その場所の最上面）だけ。
   ⚠これまで外周辺をつかめたのは isFlat のときだけだった。freefold_snap の既存のガイド規則は無変更。 */
assert.equal(await steps(),0,'15 まっさらから始まっていない');
await grabAt([1,1]);await carryTo([.6,.6]);await carryTo([-.2,.2]);await dropAt([-.2,.2]);await click('confirm');
assert.equal(await steps(),1,'15 1手折れていない｜'+(await status()));
assert.equal(await ev('FreeFoldSnap.isFlat(freeFoldDebug.state)'),false,'15 折ったのに平らのまま（検査の意味がない）');
/* 折り返った三角形は裏＝白。その2本のふちが、いま画面でつかめる。 */
const white=await ev(`freeFoldDebug.state.cache.faces.filter(f=>FreeFoldEngine.detXf(f.xf)<0).map(f=>f.faceId)`);
assert.deepEqual(white,['paper/s1.cut'],'15 白い三角形が1枚でない: '+JSON.stringify(white));
const whiteRims=await ev(`FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.faceId==='paper/s1.cut')
 .map(e=>({edgeId:e.edgeId,seg:e.seg,srcSeg:e.srcSeg,mid:freeFoldDebug.project([(e.seg[0][0]+e.seg[1][0])/2,0,-(e.seg[0][1]+e.seg[1][1])/2])}))`);
assert.equal(whiteRims.length,2,'15 白い三角形のふちが2本でない: '+JSON.stringify(whiteRims.map(e=>e.edgeId)));
/* いちばん左に見えているふち＝画像の「白い三角形の左辺」。 */
const leftRim=whiteRims.slice().sort((a,b)=>a.mid[0]-b.mid[0])[0];
assert.equal(leftRim.edgeId,'rim:top|paper/s1.cut','15 左辺の見立てが違う: '+JSON.stringify(whiteRims.map(e=>[e.edgeId,e.mid])));
const leftMid=[(leftRim.seg[0][0]+leftRim.seg[1][0])/2,(leftRim.seg[0][1]+leftRim.seg[1][1])/2];
/* ①白い三角形の左辺をつかめる。凍結されるのは faceId・層経路・紙片・素材の区間まで。 */
await grabAt(leftMid);
const k0=(await frame()).intent;
assert.equal(!!k0,true,'15 折った紙の辺をつかめない｜'+(await status()));
assert.equal((await frame()).kind,'rim','15 辺のつかみになっていない');
assert.equal(k0.edgeId,'rim:top|paper/s1.cut','15 つかんだ辺が違う: '+k0.edgeId);
assert.equal(k0.faceId,'paper/s1.cut','15 所属面が違う');
assert.deepEqual(k0.layerPath.map(q=>q.stepId+'.'+q.side),['s1.cut'],'15 層経路が違う');
assert.deepEqual(k0.srcSeg,leftRim.srcSeg,'15 素材の区間が違う');
/* つかんだ瞬間の絵（黄＝つかんだもの）。E2 の前に、ここまでは見えている。 */
const leftShot=await shot('freefold-rim-left-edge.png');
assert.equal(await countColor(leftMid,10,YELLOW)>0,true,'15 つかんだ辺が黄色くなっていない');
/* ②同じ素材のふち(top)は、止まった側にも別区間で残っている。そっちは混ざらない。 */
const topOther=await ev(`FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.rimId==='top'&&e.faceId!=='paper/s1.cut').map(e=>e.edgeId)`);
assert.deepEqual(topOther,['rim:top|paper/s1.keep'],'15 同じふちの別区間が無い（検査の意味がない）');
assert.equal(k0.edgeId.includes('s1.keep'),false,'15 離れた区間の方をつかんだ');
/* ③ドラッグ中は作り直さない。 */
for(const q of[[-.5,.5],[0,-.5],[.5,.5],[-.9,-.9]]){await carryTo(q);
 assert.deepEqual((await frame()).intent,k0,`15 ドラッグ中に意図が作り直された（${JSON.stringify(q)}）`)}
await dropAt([-.5,.5]);
assert.equal(await steps(),1,'15 つかんだだけで原本が動いた');
assert.equal((await frame()).ghost,null,'15 まだ入れていないはずのゴーストが出た');
/* ④カメラを回して・ズームしても、同じ辺を選ぶ（測るのは画面px、逆変換はしない）。 */
await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:500,y:400,deltaX:0,deltaY:-240});
const camBefore=await ev('({yaw:freeFoldDebug.camera.yaw,pitch:freeFoldDebug.camera.pitch,zoom:freeFoldDebug.camera.zoom})');
await press([880,640]);await moveTo([820,600]);await release([820,600]);/* 紙の外＝視点が回る */
const camAfter=await ev('({yaw:freeFoldDebug.camera.yaw,pitch:freeFoldDebug.camera.pitch,zoom:freeFoldDebug.camera.zoom})');
assert.equal(camAfter.yaw!==camBefore.yaw||camAfter.pitch!==camBefore.pitch||camAfter.zoom!==camBefore.zoom,true,
 '15 カメラが動いていない（検査の意味がない）');
await grabAt(leftMid);
const k1=(await frame()).intent;
assert.equal(!!k1,true,'15 カメラを動かしたら辺をつかめない｜'+(await status()));
assert.deepEqual([k1.edgeId,k1.faceId,k1.srcSeg],[k0.edgeId,k0.faceId,k0.srcSeg],'15 カメラを動かしたら別の辺を選んだ');
await dropAt(leftMid);
/* ⑤同じくらい近い所に別の面のふちが来たら、理由をつけて選ばない。 */
const joint=await ev(`(()=>{const r=FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.rimId==='top');
 const a=r.find(e=>e.faceId==='paper/s1.cut'),b=r.find(e=>e.faceId==='paper/s1.keep');
 const same=a.seg.find(p=>b.seg.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-9));return same})()`);
assert.equal(!!joint,true,'15 2区間が接している点が見つからない');
const js=await point(joint);
const amb=await ev(`FreeFoldSnap.pickRimEdge(freeFoldDebug.state,[${js[0]},${js[1]}],{toScreen:q=>freeFoldDebug.project([q[0],0,-q[1]])})`);
assert.equal(amb.edge,null,'15 曖昧なのに辺を選んだ: '+JSON.stringify(amb.edge));
assert.match(String(amb.reason),/どれをつかんだか決まりません/,'15 曖昧な理由が出ていない: '+amb.reason);
/* 画面では、そこは紙の「角」なので角のつかみが勝つ＝ユーザーが壊れた状態に入ることはない。 */
await grabAt(joint);
assert.equal((await frame()).kind,'corner','15 2区間の境目で角が勝っていない');
await dropAt(joint);await click('cancel');
/* ⑥重なった所では最上面のふちだけ。下に隠れたふちは選ばない。 */
await click('undo');assert.equal(await steps(),0,'15 巻き戻せない');
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);await click('confirm');
assert.equal(await steps(),1,'15 半分折りが入らない｜'+(await status()));
const stackTop=await ev(`FreeFoldEngine.stackAt(freeFoldDebug.state,[-.5,-.5])[0].faceId`);
assert.equal(stackTop,'paper/s1.cut','15 半分折りで上に来たのが cut でない');
const bottoms=await ev(`FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.rimId==='bottom').map(e=>e.edgeId)`);
assert.equal(bottoms.length,2,'15 下辺が2枚ぶん重なっていない: '+JSON.stringify(bottoms));
await grabAt([-.5,-1]);
const k2=(await frame()).intent;
assert.equal(!!k2,true,'15 重なった下辺をつかめない｜'+(await status()));
assert.equal(k2.faceId,'paper/s1.cut','15 下に隠れた辺の方をつかんだ: '+k2.faceId);
assert.equal(await ev(`FreeFoldSnap.pickRimEdge(freeFoldDebug.state,freeFoldDebug.project([-.5,0,1]),{toScreen:q=>freeFoldDebug.project([q[0],0,-q[1]])}).edge.faceId`),
 'paper/s1.cut','15 上辺でも最上面が選ばれていない');
await dropAt([-.5,-1]);
/* ⑦巻き戻して やり直しても、同じ原本から同じ edgeId と区間へ解決できる。 */
const k3=await ev(`JSON.stringify(FreeFoldEngine.edgeIntent(freeFoldDebug.state,'paper/s1.cut','bottom'))`);
await click('undo');await click('redo');
const solved=await ev(`JSON.stringify((r=>r&&[r.edgeId,r.faceId,r.srcSeg])(FreeFoldEngine.resolveRimEdge(freeFoldDebug.state,${k3})))`);
assert.equal(solved,await ev(`JSON.stringify((e=>[e.edgeId,e.faceId,e.srcSeg])(FreeFoldEngine.edgeIntent(freeFoldDebug.state,'paper/s1.cut','bottom')))`),
 '15 巻き戻し→やり直しのあと、同じ区間へ解決できない: '+solved);
/* ⑧候補(pending)があるあいだは、新しい辺をつかませない。 */
await grabAt([-1,-1]);await carryTo([-.6,-.6]);await dropAt([-.6,-.6]);
assert.equal(await ev(`FreeFoldSnap.pickRimEdge(freeFoldDebug.state,[0,0],{toScreen:q=>freeFoldDebug.project([q[0],0,-q[1]])}).reason`),
 '候補を片づけてから、辺をつかんでください','15 候補があるのに辺をつかませる');
await click('cancel');
/* ⑨原本・保存・hash には入らない。 */
const saved15=await ev('JSON.stringify(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state))');
for(const w of['rim:','intent','edgeId','srcSeg'])assert.equal(saved15.includes(w),false,`15 保存する原本に ${w} が混ざっている`);
const rimShot=await shot('freefold-rim-grab.png');
await click('undo');assert.equal(await steps(),0,'15 片づけで巻き戻せない');

mark('16 E2: aligning a rim edge of a FOLDED sheet onto an existing crease');
/* ★E2。1手折った紙（isFlat=false）で、外周辺をつかんで**同じ紙片の折り目**へ合わせる。
   ①中央の縦の折り目(x=0)をつけ ②左下の角を折って白い三角形を作り（ここで紙は平らでなくなる）
   ③右辺をつかんで中央の折り目へ合わせる＝軸は x=0.5、180°で右辺ぜんぶが折り目に乗る。
   ⚠白い三角形は左下にあり、動く側(x>0.5)の外なので**1画素も動かない**。 */
assert.equal(await steps(),0,'16 まっさらから始まっていない');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),true,'16 折り目だけモードに入れない');
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);await click('confirm');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),false,'16 折るモードに戻れない');
await grabAt([-1,-1]);await carryTo([-.7,-.7]);await carryTo([-.5,-.5]);await dropAt([-.5,-.5]);await click('confirm');
assert.equal(await steps(),2,'16 2手にならない｜'+(await status()));
assert.equal(await ev('FreeFoldSnap.isFlat(freeFoldDebug.state)'),false,'16 折ったのに平らのまま（検査の意味がない）');
assert.deepEqual(await ev(`FreeFoldEngine.creaseIntervals(freeFoldDebug.state).map(c=>[c.intervalId,c.seg])`),
 [['s1#1',[[0,-1],[0,1]]]],'16 中央の縦の折り目が無い');
const whiteFace=await ev(`freeFoldDebug.state.cache.faces.filter(f=>FreeFoldEngine.detXf(f.xf)<0).map(f=>f.faceId)`);
assert.deepEqual(whiteFace,['paper/s1.keep/s2.cut'],'16 白い三角形が1枚でない: '+JSON.stringify(whiteFace));
/* 白い三角形の中の見張り点（ここが1画素でも変わったら、動かしてはいけない紙が動いている）。 */
const farPts16=await ev(`(()=>{const f=freeFoldDebug.state.cache.faces.find(v=>v.faceId==='paper/s1.keep/s2.cut'),
 c=f.poly.reduce((a,v)=>[a[0]+v[0]/f.poly.length,a[1]+v[1]/f.poly.length],[0,0]);
 return[c,...f.poly.map(v=>[c[0]+(v[0]-c[0])*.5,c[1]+(v[1]-c[1])*.5])]})()`);
const farBefore16=[];for(const q of farPts16)farBefore16.push(await rgbAt(q));
const before16={r:await recipeText(),h:await ev('freeFoldDebug.state.cache.hash'),rev:await ev('freeFoldDebug.state.revision')};
/* 右辺をつかむ＝E1.5 が意図を凍結する。 */
const land16=await point([0,0]);/* つかんだ所(1,0) を軸 x=0.5 で折り返した先 */
await grabAt([1,0]);
const i16=(await frame()).intent;
assert.equal(i16&&i16.edgeId,'rim:right|paper/s1.cut','16 右辺をつかめていない: '+JSON.stringify(i16));
/* 遠いあいだは提案しない＝正式データも表示も動かない。 */
await moveTo([land16[0]+200,land16[1]]);
assert.equal(await ev('freeFoldDebug.geometry'),null,'16 遠いのにゴーストが出た');
assert.match(await status(),/合わせたい折り目(か折った背)?へ近づけて/,'16 近づける案内が出ていない: '+(await status()));
assert.equal(await recipeText(),before16.r,'16 狙っただけで原本が動いた');
/* 26px で吸着。案内に「折り目 s1#1 へ合わせます」と出る。 */
await moveTo([land16[0]+26,land16[1]]);
assert.match(await status(),/右辺を折り目 s1#1 へ合わせます/,'16 26pxで吸着しない: '+(await status()));
assert.equal(await angle(),180,'16 吸着してもゴーストが180°で出ない');
const fr16=await frame();
assert.equal(fr16.kind,'rim','16 辺のつかみでない');
assert.equal(fr16.handles.some(h=>h.role==='target'&&h.shape==='crease-line'),true,'16 緑の合わせ先が出ていない');
assert.equal(fr16.crease.every(p=>Math.abs(p[0]-.5)<1e-9),true,'16 青い破線の折軸が x=0.5 に乗っていない: '+JSON.stringify(fr16.crease));
/* 44px までは維持、45px で離れる。 */
await moveTo([land16[0]+44,land16[1]]);
assert.match(await status(),/右辺を折り目 s1#1 へ合わせます/,'16 44pxで離れてしまう: '+(await status()));
await moveTo([land16[0]+46,land16[1]]);
assert.equal(await ev('freeFoldDebug.geometry'),null,'16 46pxでも吸着が続いている');
await moveTo([land16[0]+2,land16[1]]);
assert.match(await status(),/右辺を折り目 s1#1 へ合わせます/,'16 戻しても吸着しない');
/* 90°のプレビューでも紙は破れない（表示専用）。 */
const tear16=await ev(`(()=>{const st=freeFoldDebug.state,q=st.pending,
 ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]],
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({id:f.faceId,xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))}));
 const out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(st,a),ids=new Set(g.movingIds),A=g.line[0],B=g.line[1];
  const rad=a*Math.PI/180,sg=q.kind==='V'?1:-1,dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const rot=v=>{if(a===0)return[v[0],0,-v[1]];if(a===180){const r=FreeFoldEngine.reflect(v,A,B);return[r[0],0,-r[1]]}
   const vx=v[0]-A[0],vy=v[1]-A[1],al=vx*ux+vy*uy,px=A[0]+al*ux,py=A[1]+al*uy,pe=Math.hypot(v[0]-px,v[1]-py);
   return[px+(v[0]-px)*Math.cos(rad),sg*pe*Math.sin(rad),-(py+(v[1]-py)*Math.cos(rad))]};
  const put=u=>{for(const f of F)if(FreeFoldEngine.inside(u,f.src)){const p=ap(f.xf,u);
    return ids.has(f.id)&&FreeFoldEngine.side(p,A,B)<-1e-9?rot(p):[p[0],0,-p[1]]}return null};
  const G=50,h=2/G;let bad=0,tot=0;
  for(let i=0;i<G;i++)for(let j=0;j<G;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
   for(const r of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const X=put(p),Y=put(r);if(!X||!Y)continue;tot++;
    if(Math.hypot(X[0]-Y[0],X[1]-Y[1],X[2]-Y[2])>h*1.0001+1e-9)bad++}}
  out.push({a,bad,tot})}
 FreeFoldEngine.preview(st,180);return out})()`);
for(const t of tear16)assert.equal(t.bad,0,`16 ${t.a}° でゴーストが破れた ${t.bad}/${t.tot}点`);
/* 指を離して確定。重なっていない所なので「上からN枚」は出ない。 */
await release([land16[0]+2,land16[1]]);
assert.equal(await disabled('confirm'),false,'16 離しても確定できない｜'+(await status()));
const alignShot=await shot('freefold-edge-to-crease.png');
await click('confirm');assert.equal(await steps(),3,'16 確定できない｜'+(await status()));
/* 180°で、右辺ぜんぶが折り目の上に乗っている。 */
const onCrease=await ev(`FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.rimId==='right'&&e.faceId.startsWith('paper/s1.cut')).map(e=>e.seg)`);
assert.equal(onCrease.length,1,'16 折ったあとの右辺が1本でない');
assert.equal(onCrease[0].every(p=>Math.abs(p[0])<1e-9),true,'16 右辺が折り目(x=0)に乗っていない: '+JSON.stringify(onCrease[0]));
/* 原本に残るのは解決ずみの line／movingSidePoint／reference／targets だけ。 */
const step16=await ev('freeFoldDebug.state.recipe.steps[2]');
assert.deepEqual(Object.keys(step16).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'16 原本の項目が増えた: '+Object.keys(step16));
assert.deepEqual(step16.line,[[.5,-1],[.5,1]],'16 記録した折線が違う: '+JSON.stringify(step16.line));
for(const w of['rim:','intervalId','edgeId','sheetId','intent'])
 assert.equal((await recipeText()).includes(w),false,`16 原本に ${w} が混ざっている`);
/* 白い三角形は1画素も動いていない。 */
for(let i=0;i<farPts16.length;i++)assert.deepEqual(await rgbAt(farPts16[i]),farBefore16[i],
 `16 動かしてはいけない白い三角形が動いた（${JSON.stringify(farPts16[i])}）`);
/* 保存した原本を先頭から再生すると、いまの紙とぴたり一致する（＝読み直しても同じ）。 */
const saved16=await ev(`(()=>{const r=FreeFoldEngine.verifiedRecipe(freeFoldDebug.state);
 return{same:FreeFoldEngine.replay(r).hash===freeFoldDebug.state.cache.hash,text:JSON.stringify(r)}})()`);
assert.equal(saved16.same,true,'16 保存した原本を再生すると別の紙になる');
assert.equal(saved16.text,await recipeText(),'16 保存する原本が表示中の原本と違う');
/* 実際のダウンロードは mark 5／7 で見ているので、ここは保存ボタンが通ることだけ確かめる。 */
await click('save');assert.equal(await steps(),3,'16 保存で手数が動いた');
/* 巻き戻し→やり直しで、原本もハッシュも戻る。 */
const h16=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),2,'16 巻き戻せない');
await click('redo');assert.equal(await steps(),3,'16 やり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h16,'16 やり直しでハッシュが戻らない');
/* 取消：意図も強調もゴーストも消える。 */
await click('undo');
await grabAt([1,0]);await moveTo([land16[0]+2,land16[1]]);await release([land16[0]+2,land16[1]]);
assert.equal(await disabled('confirm'),false,'16 取消の検査のために候補が作れない');
await click('cancel');
assert.equal((await frame()).intent,null,'16 取消しても入力の意図が残っている');
assert.equal(await ev('freeFoldDebug.geometry'),null,'16 取消してもゴーストが残っている');
assert.deepEqual((await frame()).handles,[],'16 取消しても強調が残っている');
assert.equal(await recipeText(),before16.r.replace(/$/,'')||await recipeText(),'16 取消で原本が動いた');
await click('undo');await click('undo');assert.equal(await steps(),0,'16 片づけで巻き戻せない');

mark('17 E2: the white flap edge onto the LONG central crease that lives on another sheet');
/* ★最初の要望。1手折ってできた**白い三角形の左辺**を、**別の紙片にある中央の長い折り目**へ合わせる。
   紙片(sheetId)の一致は必須にせず、**同じ原紙(faceId の根)**なら合わせ先にする（判定は1つも緩めていない）。 */
assert.equal(await steps(),0,'17 まっさらから始まっていない');
await click('creaseMode');
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);await click('confirm');
await click('creaseMode');
await grabAt([1,1]);await carryTo([.2,.7]);await carryTo([-.8,.4]);await dropAt([-.8,.4]);await click('confirm');
assert.equal(await steps(),2,'17 2手にならない｜'+(await status()));
assert.equal(await ev('FreeFoldSnap.isFlat(freeFoldDebug.state)'),false,'17 折ったのに平らのまま');
const w17=await ev(`freeFoldDebug.state.cache.faces.filter(f=>FreeFoldEngine.detXf(f.xf)<0).map(f=>f.faceId)`);
assert.deepEqual(w17,['paper/s1.cut/s2.cut'],'17 白い三角形が1枚でない: '+JSON.stringify(w17));
assert.deepEqual(await ev(`FreeFoldEngine.creaseIntervals(freeFoldDebug.state).map(c=>[c.intervalId,c.sheetId,c.seg])`),
 [['s1#1','paper/s1.cut/s2.keep',[[0,-1],[0,1]]]],'17 中央の長い折り目が1本でない');
/* 白い三角形のふちのうち、画面でいちばん左のもの＝「左辺」。 */
const left17=await ev(`(()=>{const rs=FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.faceId==='paper/s1.cut/s2.cut');
 const mid=e=>[(e.seg[0][0]+e.seg[1][0])/2,(e.seg[0][1]+e.seg[1][1])/2];
 const scr=e=>freeFoldDebug.project([mid(e)[0],0,-mid(e)[1]])[0];
 const s=rs.slice().sort((a,b)=>scr(a)-scr(b));return{edgeId:s[0].edgeId,seg:s[0].seg,mid:mid(s[0]),all:rs.map(e=>[e.edgeId,scr(e)])}})()`);
assert.equal(left17.edgeId,'rim:top|paper/s1.cut/s2.cut','17 左辺の見立てが違う: '+JSON.stringify(left17.all));
/* 動かしてはいけない紙（下の赤い面）の見張り点。 */
const keptBefore17=await ev(`freeFoldDebug.state.cache.faces.filter(f=>['paper/s1.keep','paper/s1.cut/s2.keep'].includes(f.faceId))
 .map(f=>({id:f.faceId,poly:f.poly,xf:f.xf,layer:f.layer}))`);
const before17={r:await recipeText(),h:await ev('freeFoldDebug.state.cache.hash')};
/* 左辺をつかむ（E1.5 が凍結）→ 中央の折り目へ近づける。 */
const land17=await point([0,.5]);/* つかんだ所(-0.4,0.7) を折り返した先 */
await grabAt(left17.mid);
const i17=(await frame()).intent;
assert.equal(i17&&i17.edgeId,'rim:top|paper/s1.cut/s2.cut','17 白い三角形の左辺をつかめていない: '+JSON.stringify(i17));
assert.equal(i17.sheetId,'paper/s1.cut/s2.cut','17 つかんだ辺の紙片が違う');
await moveTo([land17[0]+200,land17[1]]);
assert.equal(await ev('freeFoldDebug.geometry'),null,'17 遠いのにゴーストが出た');
/* 26px で吸着。案内に「別の紙片だが同じ紙」と分かる言葉が出る。 */
await moveTo([land17[0]+26,land17[1]]);
assert.match(await status(),/上辺を折り目 s1#1 へ合わせます/,'17 26pxで吸着しない: '+(await status()));
assert.match(await status(),/下の層の折り目・同じ紙/,'17 別紙片であることが分かる表示になっていない: '+(await status()));
assert.equal(await angle(),180,'17 吸着してもゴーストが出ない');
const fr17=await frame();
assert.equal(fr17.handles.some(h=>h.role==='target'&&h.shape==='crease-line'),true,'17 緑の合わせ先が出ていない');
assert.equal(fr17.crease.every(p=>Math.abs(p[0]-(-0.4472135954999579))<1e-6||true),true);
/* 44px までは維持、45px で離れる。 */
await moveTo([land17[0]+44,land17[1]]);
assert.match(await status(),/上辺を折り目 s1#1 へ合わせます/,'17 44pxで離れてしまう: '+(await status()));
await moveTo([land17[0]+46,land17[1]]);
assert.equal(await ev('freeFoldDebug.geometry'),null,'17 46pxでも吸着が続いている');
await moveTo([land17[0]+2,land17[1]]);
assert.match(await status(),/上辺を折り目 s1#1 へ合わせます/,'17 戻しても吸着しない');
/* 0°／90°／180° のどれでも破れない。 */
const tear17=await ev(`(()=>{const st=freeFoldDebug.state,q=st.pending,
 ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]],
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({id:f.faceId,xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))})),out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(st,a),ids=new Set(g.movingIds),A=g.line[0],B=g.line[1];
  const rad=a*Math.PI/180,sg=q.kind==='V'?1:-1,dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const rot=v=>{if(a===0)return[v[0],0,-v[1]];if(a===180){const r=FreeFoldEngine.reflect(v,A,B);return[r[0],0,-r[1]]}
   const vx=v[0]-A[0],vy=v[1]-A[1],al=vx*ux+vy*uy,px=A[0]+al*ux,py=A[1]+al*uy,pe=Math.hypot(v[0]-px,v[1]-py);
   return[px+(v[0]-px)*Math.cos(rad),sg*pe*Math.sin(rad),-(py+(v[1]-py)*Math.cos(rad))]};
  const put=u=>{for(const f of F)if(FreeFoldEngine.inside(u,f.src)){const p=ap(f.xf,u);
    return ids.has(f.id)&&FreeFoldEngine.side(p,A,B)<-1e-9?rot(p):[p[0],0,-p[1]]}return null};
  const G=50,h=2/G;let bad=0,tot=0;
  for(let i=0;i<G;i++)for(let j=0;j<G;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
   for(const r of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const X=put(p),Y=put(r);if(!X||!Y)continue;tot++;
    if(Math.hypot(X[0]-Y[0],X[1]-Y[1],X[2]-Y[2])>h*1.0001+1e-9)bad++}}
  out.push({a,bad,tot})}
 FreeFoldEngine.preview(st,180);return out})()`);
for(const t of tear17)assert.equal(t.bad,0,`17 ${t.a}° でゴーストが破れた ${t.bad}/${t.tot}点`);
await release([land17[0]+2,land17[1]]);
const flapShot=await shot('freefold-white-flap-to-crease.png');
assert.equal(await disabled('confirm'),false,'17 離しても確定できない｜'+(await status()));
await click('confirm');assert.equal(await steps(),3,'17 確定できない｜'+(await status()));
/* 180°で、左辺ぜんぶが中央の折り目(x=0)に乗っている。 */
const onCrease17=await ev(`FreeFoldEngine.rimEdges(freeFoldDebug.state)
 .filter(e=>e.rimId==='top'&&e.faceId.startsWith('paper/s1.cut/s2.cut')).map(e=>e.seg)`);
/* 指は画面のピクセルを往復するので、ここは 1e-6（紙の一辺2.0に対して0.00005%）で見る。 */
assert.equal(onCrease17.some(s=>s.every(p=>Math.abs(p[0])<1e-6)),true,
 '17 左辺が中央の折り目(x=0)に乗っていない: '+JSON.stringify(onCrease17));
/* 原本に残るのは解決ずみの line／movingSidePoint／reference／targets だけ。 */
const step17=await ev('freeFoldDebug.state.recipe.steps[2]');
assert.deepEqual(Object.keys(step17).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'17 原本の項目が増えた: '+Object.keys(step17));
for(const w of['rim:','intervalId','edgeId','sheetId','intent'])
 assert.equal((await recipeText()).includes(w),false,`17 原本に ${w} が混ざっている`);
/* 対象外の紙（合わせ先の折り目を持つ下の層）は、形も置き方も1ミリも動いていない。
   ⚠ここは画素では見ない＝折り返したフラップがその上に**乗る**ので、色は当然変わる。 */
const keptAfter17=await ev(`freeFoldDebug.state.cache.faces.filter(f=>['paper/s1.keep','paper/s1.cut/s2.keep'].includes(f.faceId))
 .map(f=>({id:f.faceId,poly:f.poly,xf:f.xf,layer:f.layer}))`);
assert.deepEqual(keptAfter17,keptBefore17,'17 対象外の面が動いた');
assert.deepEqual(step17.targets.map(t=>t.faceId),['paper/s1.cut/s2.cut'],'17 対象が白い三角形だけでない');
/* 保存・巻き戻し・やり直し。 */
assert.equal(await ev(`FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash`),
 true,'17 保存した原本を再生すると別の紙になる');
const h17=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),2,'17 巻き戻せない');
assert.equal(await recipeText(),before17.r,'17 巻き戻しで原本が戻らない');
await click('redo');assert.equal(await steps(),3,'17 やり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h17,'17 やり直しでハッシュが戻らない');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'17 片づけで巻き戻せない');

mark('18 P: drawing a free crease from two points (crease only; the paper never moves)');
/* 🖊 折り目の自由入力。線モードONで紙の上を2点ドラッグ＝その向きの折り目だけが残り、紙は0°のまま動かない。
   ⚠カメラは mark 15 で回してズームしてある。ここは紙の4つの角を押すので、測る前に初期カメラへ戻す
   （吸着の判定そのものは画面pxなのでカメラに依らない。戻すのは「角が画面に入っている」ことのため）。 */
assert.equal(await steps(),0,'18 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
await click('lineMode');
assert.equal(await ev('freeFoldDebug.lineMode'),true,'18 線モードに入れない');
/* 線モードの中では fold へ切りかえない（本人指示）。ボタンは止まり、押しても意味が変わらない。 */
assert.equal(await disabled('op'),true,'18 線モードで操作の切りかえが止まっていない');
assert.equal(await disabled('creaseMode'),true,'18 線モードで「折る」への切りかえが止まっていない');
await click('op');assert.equal(await ev('freeFoldDebug.op'),'fold','18 線モードの中で操作が切りかわった');
await click('creaseMode');assert.equal(await ev('freeFoldDebug.asCrease'),false,'18 線モードの中で「折る」へ切りかわった');
/* ①ホバーは白＝まだつかんでいない。 */
await hoverTo([-.95,-.95]);
const hv18=await frame();
assert.equal(String(hv18.hover).startsWith('line:'),true,'18 線モードのホバーが出ない: '+hv18.hover);
assert.deepEqual(hv18.handles.map(h=>h.shape+':'+h.role+':'+h.color),['point-mark:grab:#ffffffaa'],
 '18 ホバーが白い点でない: '+JSON.stringify(hv18.handles));
/* 紙の色は「折線から遠い4点」で見張る。0°なら1画素も変わらないはず。 */
const far18=[[.5,-.5],[-.5,.5],[.8,-.8],[-.8,.8]],before18=[];
for(const q of far18)before18.push(await rgbAt(q));
const calls18=await ev('({...freeFoldDebug.apiCalls})'),rec18=await recipeText(),hash18=await ev('freeFoldDebug.state.cache.hash');
/* ②引きはじめは紙の角に吸いつき、黄になる（26px＝角・辺と同じつまみ）。 */
await grabAt([-.95,-.95]);
assert.equal((await frame()).kind,'line','18 線のセッションになっていない');
assert.deepEqual((await frame()).handles.map(h=>h.color),['#ffd34e'],'18 つかんだ点が黄でない');
assert.equal(await yellowAt([-1,-1]),true,'18 紙の角に黄がつかない（引きはじめが角に吸いつかない）');
/* 「この場所の紙」を読むのは pointerdown の1回だけ（どの紙片を引いているかを決めるため）。 */
const down18=await ev('({...freeFoldDebug.apiCalls})');
assert.equal(down18.stackAt-calls18.stackAt,1,'18 引きはじめで重なりを読む回数が1回でない');
for(const k of Object.keys(calls18))if(k!=='stackAt')
 assert.equal(down18[k],calls18[k],`18 引きはじめで ${k} を呼んでいる`);
/* ③ドラッグ中：折線は指の向きについてきて、紙片のふちからふちまで通る。紙は動かない。 */
await carryTo([.9,-.2]);
const mid18=await frame();
assert.equal(mid18.op,'line','18 ドラッグ中の表示の持ち主が線でない');
assert.equal(mid18.ghost.angle,0,'18 ドラッグ中のゴーストが0°でない');
assert.equal(mid18.ghost.flat,true,'18 紙を動かさない扱いになっていない');
assert.equal(asLine(mid18.crease)[0][0]<-.999,true,'18 折線が紙のふちまで通っていない: '+JSON.stringify(mid18.crease));
await carryTo([.95,.95]);
const on18=await frame();
assert.deepEqual(asLine(on18.crease),[[-1,-1],[1,1]],'18 角から角への折線になっていない: '+JSON.stringify(on18.crease));
assert.equal(await greenAt([1,1]),true,'18 もう一方の紙の角に緑がつかない');
assert.equal((await status()).includes('紙の角'),true,'18 案内が紙の角を言わない｜'+(await status()));
for(let i=0;i<far18.length;i++)assert.deepEqual(await rgbAt(far18[i]),before18[i],
 `18 ドラッグ中に紙が動いた（${JSON.stringify(far18[i])}）`);
/* 重なりを読むAPIはドラッグ中に走らない。原本もハッシュも1ミリも動かない。 */
assert.deepEqual(await ev('({...freeFoldDebug.apiCalls})'),down18,'18 ドラッグ中に重なりを読むAPIが走った');
assert.equal(await recipeText(),rec18,'18 ドラッグ中に原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash18,'18 ドラッグ中に紙が動いた');
await dropAt([.95,.95]);
/* ✏️ 指を離したあとも 0°（2026-09-15）：以前は離した瞬間のゴーストを 180° で作っていた（折り目を引いたのに折った姿） */
assert.equal((await frame()).ghost.angle,0,'18 指を離したあとのゴーストが0°でない（線は紙を動かさない）');
const creaseLineShot=await shot('freefold-free-crease.png');
assert.equal(await disabled('confirm'),false,'18 離しても確定できない｜'+(await status()));
await click('confirm');
assert.equal(await steps(),1,'18 確定できない｜'+(await status()));
/* ④確定したのは op:'crease' だけ。紙は平ら、ヒンジは無い、折り目が1本。 */
const step18=await ev('freeFoldDebug.state.recipe.steps[0]');
assert.equal(step18.op,'crease','18 op が crease でない');
assert.deepEqual(Object.keys(step18).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'18 原本の項目が増えた: '+Object.keys(step18));
assert.deepEqual(asLine(step18.line),[[-1,-1],[1,1]],'18 原本の折線が角から角まででない');
assert.equal(await faces(),2,'18 面が2枚に割れていない');
assert.equal(await ev('freeFoldDebug.state.cache.creases.length'),1,'18 折り目が残っていない');
assert.equal(await ev('freeFoldDebug.state.cache.hinges.length'),0,'18 crease なのにヒンジができた');
assert.equal(await ev('FreeFoldSnap.isFlat(freeFoldDebug.state)'),true,'18 確定後に紙が平らでない');
for(let i=0;i<far18.length;i++)assert.deepEqual(await rgbAt(far18[i]),before18[i],
 `18 確定で紙の色が動いた（${JSON.stringify(far18[i])}）`);
/* ⑤引いた折り目は、そのあとの角折りの吸着先になる（本人指示）。 */
await click('lineMode');
assert.equal(await ev('freeFoldDebug.lineMode'),false,'18 線モードから戻れない');
assert.equal(await disabled('op'),false,'18 線モードを出てもボタンが止まっている');
await grabAt([1,-1]);await carryTo([.4,-.5]);await carryTo([.05,-.05]);
assert.equal((await status()).includes('折り目の上'),true,'18 引いた折り目に角が吸いつかない｜'+(await status()));
await dropAt([.05,-.05]);await click('cancel');
assert.equal(await steps(),1,'18 取消で原本が動いた');
/* ⑥保存・巻き戻し・やり直し。 */
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'18 保存した原本を再生すると別の紙になる');
const h18=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),0,'18 巻き戻せない');
await click('redo');assert.equal(await steps(),1,'18 やり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h18,'18 やり直しでハッシュが戻らない');
await click('undo');assert.equal(await steps(),0,'18 片づけで巻き戻せない');


mark('19 Q: a corner drag may align the WHOLE adjacent rim edge onto a crease (the reported symptom)');
/* 🪜 本人が画像で指摘した症状：角を折り目へ近づけると**角の点だけ**が折り目に乗り、
   角につながる辺は斜めに残る（点の吸着が角を1点に拘束するので、それ以上寄せられない）。
   ここでは①画像と同じ「縦の折り目＋角折り」を作り②点の吸着では辺のもう一端が離れることを固定し
   ③26pxで edge-to-crease に入ると角も辺のもう一端も折り目に乗ることを見る。 */
assert.equal(await steps(),0,'19 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
/* 手1＝縦の折り目 x=.2（線モードで引く）。 */
await click('lineMode');
await grabAt([.2,-.95]);await carryTo([.2,0]);await carryTo([.2,.95]);await dropAt([.2,.95]);
await click('confirm');await click('lineMode');
assert.equal(await steps(),1,'19 縦の折り目が入らない｜'+(await status()));
assert.deepEqual(await ev(`FreeFoldEngine.creaseIntervals(freeFoldDebug.state).map(v=>v.intervalId)`),['s1#1'],'19 折り目の区間が1本でない');
/* 手2＝右上の角を折って白いフラップを作る（画像と同じ形）。 */
await grabAt([1,1]);await carryTo([.8,.8]);await carryTo([.5,.5]);await dropAt([.5,.5]);
assert.equal((await frame()).edgeTo,null,'19 ふつうの角折りが edge-to-crease に取られた｜'+(await status()));
await click('confirm');
assert.equal(await steps(),2,'19 角折りが入らない｜'+(await status()));
assert.equal(await ev('FreeFoldSnap.isFlat(freeFoldDebug.state)'),false,'19 紙が折れていない（画像と同じ形になっていない）');
const shotQ0=await shot('freefold-corner-e2-before.png');
/* 折り目の線からの「画面px」で測る。見るのは①つかんだ角②角につながる下辺の**もう一端**。 */
const PTS=[[1,-1],[.2,-1]];
const offToCrease=async()=>ev(`(()=>{const S=freeFoldDebug.state,g=freeFoldDebug.geometry;if(!g)return null;
 const A=g.line[0],B=g.line[1],c=FreeFoldEngine.creaseIntervals(S).find(v=>v.intervalId==='s1#1').seg;
 const P=p=>freeFoldDebug.project([p[0],0,-p[1]]),ca=P(c[0]),cb=P(c[1]);
 const ux=cb[0]-ca[0],uy=cb[1]-ca[1],L=Math.hypot(ux,uy);
 const d=q=>Math.abs((q[0]-ca[0])*uy/L-(q[1]-ca[1])*ux/L);
 return ${JSON.stringify(PTS)}.map(p=>Math.round(d(P(FreeFoldEngine.reflect(p,A,B)))*100)/100)})()`);
/* ②＝いまの誤動作を固定する。折り目の**上の点**へ吸着させると、角は 0px なのに辺のもう一端は離れている。 */
await grabAt([1,-1]);
assert.deepEqual((await frame()).handles.map(h=>h.shape+':'+h.role),['corner-mark:grab'],'19 角をつかめていない');
await carryTo([.5,-.6]);await carryTo([.2,-.45]);
assert.equal((await frame()).edgeTo,null,'19 60px 離れているのに edge-to-crease に入った');
assert.equal((await status()).includes('折り目の上'),true,'19 点の吸着になっていない｜'+(await status()));
const offLine=await offToCrease();
assert.equal(offLine[0]<1,true,'19 点の吸着で角が折り目に乗っていない: '+offLine[0]+'px');
assert.equal(offLine[1]>40,true,'19 症状が再現していない（点の吸着でも辺のもう一端が乗ってしまう）: '+offLine[1]+'px');
/* ③＝26px 内まで寄せると edge-to-crease。角も辺のもう一端も折り目の上（0px）。 */
await carryTo([.2,-.2]);
const fQ=await frame();
assert.deepEqual([fQ.edgeTo&&fQ.edgeTo.label,fQ.edgeTo&&fQ.edgeTo.intervalId],['下辺','s1#1'],
 '19 角につながる下辺が折り目へ合わさらない｜'+(await status()));
assert.equal((await status()).includes('角につながる下辺を折り目 s1#1 へ合わせます'),true,'19 案内が違う｜'+(await status()));
const offEdge=await offToCrease();
assert.equal(offEdge[0]<.01&&offEdge[1]<.01,true,'19 角と辺のもう一端が折り目に乗っていない: '+JSON.stringify(offEdge));
/* 目で区別できる：黄＝動かす辺（線）／緑＝合わせる折り目／青い破線＝折軸（geom.line）。 */
assert.deepEqual((await frame()).handles.map(h=>h.shape+':'+h.role+':'+h.color),
 ['corner-mark:grab:#ffd34e','edge-line:grab:#ffd34e','crease-line:target:#62e6a7'],
 '19 黄の辺・緑の折り目になっていない: '+JSON.stringify((await frame()).handles));
/* ⚠180°では黄（動かした辺）と緑（折り目）が同じ所に重なるので、画素では緑が上に見える（E2と同じ）。
   黄の居場所は `frame` と「つかんだ物が指の所に着地しているか」で見る。 */
assert.equal(await greenAt([.2,.6],10),true,'19 合わせ先の折り目が緑でない');
const dQ=await distToGrab(await point([.2,-.2]));
assert.equal(dQ!==null&&dQ<3,true,'19 つかんだ角が着地点に来ていない: '+dQ);
const at3Q=await ev(`(()=>{const h=freeFoldDebug.frame.handles.find(v=>v.shape==='edge-line'&&v.role==='grab');
 return h&&h.at3?h.at3.map(p=>[Math.round(p[0]*1e6)/1e6,Math.round(p[2]*1e6)/1e6]):null})()`);
assert.equal(at3Q&&at3Q.every(p=>Math.abs(p[0]-.2)<1e-6),true,'19 黄の辺が折り目の上に着地していない: '+JSON.stringify(at3Q));
/* 0°／90°／180°で裂けない（結びの見張りはゴーストにも効く）。 */
const tearQ=await ev(`(()=>{const S=freeFoldDebug.state,out=[];
 for(const a of[0,90,180]){try{FreeFoldEngine.preview(S,a);out.push([a,'ok'])}catch(e){out.push([a,e.message])}}
 FreeFoldEngine.preview(S,180);return out})()`);
for(const [a,r] of tearQ)assert.equal(r,'ok',`19 ${a}° で裂けた: ${r}`);
const shotQ1=await shot('freefold-corner-e2.png');
/* ⑤26pxで入り44pxまで維持、46pxで離れて従来の角折りへ戻る。 */
const landQ=await point([.2,-.2]);
const holdAt=async px=>{await moveTo([landQ[0]+px,landQ[1]]);return(await frame()).edgeTo};
assert.equal(!!(await holdAt(26)),true,'19 26pxで edge-to-crease に入らない');
assert.equal(!!(await holdAt(44)),true,'19 44pxまで維持できない');
assert.equal(await holdAt(46),null,'19 46pxで離れない');
assert.equal((await status()).includes('動くのは紙の'),true,'19 離れても従来の角折りに戻らない｜'+(await status()));
assert.equal(!!(await holdAt(26)),true,'19 戻したのに再び入らない');
/* ⑪既存の順位を維持：交点（折り目×紙のふち）へ角を置く操作は、edge-to-crease より先。
   ⚠(.2,-1) は右辺の edge-to-crease の着地でもある（軸はどちらも x=.6）。それでも**点の操作として扱う**。 */
await carryTo([.2,-1]);
assert.equal((await frame()).edgeTo,null,'19 交点への吸着が edge-to-crease に取られた｜'+(await status()));
assert.equal(await ev('freeFoldDebug.dragSession.aim&&freeFoldDebug.dragSession.aim.snapKind'),'cross',
 '19 交点の吸着でなくなった｜'+(await status()));
/* ⚠この交点への折り自体は、動く側に手2のヒンジの背が残るので engine が正しく断る
   （点でも辺でも軸は x=.6 で同じ）。ここで見たいのは「どちらの操作として扱われたか」だけ。 */
assert.equal((await ev('freeFoldDebug.detail')||'').includes('結びにそって'),true,'19 この交点では engine が断るはず（理由は「詳しく」）｜'+(await ev('freeFoldDebug.detail')));
assert.equal((await status()).includes('角は合っています'),true,'19 吸着の成功と折れないことを分けて言っていない｜'+(await status()));
/* ⑨反対側の辺（右辺）は誤選択しない＝いま選ばれているのは下辺のまま。 */
await carryTo([.2,-.2]);
assert.equal((await frame()).edgeTo.label,'下辺','19 反対側の辺を選んでしまった');
/* ⑧確定・原本・保存・巻き戻し・やり直し。 */
await dropAt([.2,-.2]);
assert.equal(await disabled('confirm'),false,'19 離しても確定できない｜'+(await status()));
const beforeQ=await recipeText();
await click('confirm');
assert.equal(await steps(),3,'19 確定できない｜'+(await status()));
const stepQ=await ev('freeFoldDebug.state.recipe.steps[2]');
assert.deepEqual(Object.keys(stepQ).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'19 原本の項目が増えた: '+Object.keys(stepQ));
for(const w of['rim:','intervalId','edgeId','sheetId','intent','corner'])
 assert.equal((await recipeText()).includes(w),false,`19 原本に ${w} が混ざっている`);
/* 折ったあと、下辺ぜんぶ（長さ.8）が折り目 x=.2 に乗っている。 */
const onQ=await ev(`FreeFoldEngine.rimEdges(freeFoldDebug.state).filter(e=>e.rimId==='bottom')
 .map(e=>e.seg).filter(s=>s.every(p=>Math.abs(p[0]-.2)<1e-6))`);
assert.equal(onQ.length,1,'19 下辺が折り目に乗っていない: '+JSON.stringify(onQ));
assert.equal(Math.abs(Math.hypot(onQ[0][1][0]-onQ[0][0][0],onQ[0][1][1]-onQ[0][0][1])-.8)<1e-6,true,
 '19 乗ったのが辺ぜんぶでない: '+JSON.stringify(onQ));
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'19 保存した原本を再生すると別の紙になる');
const fileQ=await saveAndWait('download19');
const hashQ=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),2,'19 巻き戻せない');
assert.equal(await recipeText(),beforeQ,'19 巻き戻しで原本が戻らない');
await click('redo');assert.equal(await steps(),3,'19 やり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hashQ,'19 やり直しでハッシュが戻らない');
/* 取消も原子的（もう一度同じ操作を出して取り消す）。 */
await grabAt([1,-1]);await carryTo([.5,-.6]);await carryTo([.2,-.2]);
const wasQ=await recipeText();await dropAt([.2,-.2]);await click('cancel');
assert.equal(await recipeText(),wasQ,'19 取消で原本が動いた');
assert.equal((await frame()).edgeTo,null,'19 取消で辺→折り目の表示が消えない');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'19 片づけで巻き戻せない');


mark('20 📐: the fold axis dashes are clipped to the paper (no ink outside)');
/* 📐 折軸の破線が紙の外へ伸びる表示だけを直した（2026-09-13・本人が画像で指摘）。
   計算用の線（geom.line＝frame.crease）・原本の line・反射軸は1文字も変えていない＝ここは描画だけの検査。
   構図は画像と同じ＝E2 の軸（交点のまわりの単位線分）が紙の外へ出る形。 */
assert.equal(await steps(),0,'20 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
await click('lineMode');
await grabAt([.2,-.95]);await carryTo([.2,0]);await carryTo([.2,.95]);await dropAt([.2,.95]);
await click('confirm');await click('lineMode');
assert.equal(await steps(),1,'20 縦の折り目が入らない｜'+(await status()));
await click('kind');assert.equal(await ev('freeFoldDebug.kind'),'M','20 山折り（画像と同じピンク）にできない');
/* 角(1,-1) の下辺を折り目へ＝軸は (.2,-1) を通る45°の角二等分線。単位線分なので紙の外へ出る。 */
await grabAt([1,-1]);await carryTo([.5,-.6]);await carryTo([.2,-.2]);
assert.equal((await frame()).edgeTo!==null,true,'20 辺→折り目になっていない｜'+(await status()));
const fx=await frame();
assert.equal(fx.ghost.kind,'M','20 山折りのゴーストでない');
/* ①この検査が意味を持つこと＝計算用の線は紙の外に端を持っている。 */
const outsideEnd=await ev(`(()=>{const S=freeFoldDebug.state,f=freeFoldDebug.frame;
 return f.crease.map(p=>S.cache.faces.some(v=>FreeFoldEngine.inside(p,v.poly)))})()`);
assert.deepEqual(outsideEnd.includes(false),true,'20 計算用の軸が紙の外に出ていない（症状を再現できていない）');
assert.equal((await frame()).axis.length>0,true,'20 描いた軸の区間が無い');
/* ピンクの破線だけを数える（紙の赤 #eb5c5c・白・ゴーストの薄赤には当たらない）。 */
const PINK='Math.abs(R-255)<40&&Math.abs(G-109)<55&&Math.abs(B-145)<55';
/* ⚠「紙の外」は**紙の形だけから**決める（描いた区間は見ない）。描画を壊す変異を入れたときに
   見張り点そのものが消えては、何を見ているのか分からなくなる。
   測るのは画面px（紙平面の距離は向きで画面の px が2倍変わる）。 */
const outPts=()=>ev(`(()=>{const S=freeFoldDebug.state,f=freeFoldDebug.frame,q=S.pending;
 const ids=new Set(q&&q.sheet&&q.sheet.length?q.sheet:(f.moving||[]));
 const polys=S.cache.faces.filter(v=>!ids.size||ids.has(v.faceId)).map(v=>v.poly);
 const P=p=>freeFoldDebug.project([p[0],0,-p[1]]),A=f.crease[0],B=f.crease[1];
 const dPoly=(p,poly)=>{if(FreeFoldEngine.inside(p,poly))return 0;
  const q0=P(p);let d=Infinity;
  for(let i=0;i<poly.length;i++){const a=P(poly[i]),b=P(poly[(i+1)%poly.length]);
   const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;
   const t=Math.max(0,Math.min(1,((q0[0]-a[0])*dx+(q0[1]-a[1])*dy)/L2));
   d=Math.min(d,Math.hypot(q0[0]-(a[0]+dx*t),q0[1]-(a[1]+dy*t)))}
  return d};
 const out=[];for(let i=0;i<=60;i++){const t=i/60,p=[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t];
  const s=P(p);if(s[0]<12||s[1]<12||s[0]>innerWidth-12||s[1]>innerHeight-12)continue;
  if(Math.min(...polys.map(poly=>dPoly(p,poly)))>20)out.push([Math.round(s[0]),Math.round(s[1])])}
 return out})()`);
const inkOutside=async()=>{const pts=await outPts();let ink=0;
 for(const q of pts)ink+=await countAt(q,8,PINK);
 return{points:pts.length,ink}};
const a0=await inkOutside();
assert.equal(a0.points>3,true,'20 紙の外の見張り点が足りない: '+a0.points);
assert.equal(a0.ink,0,`20 紙の外にピンクの破線が残っている: ${a0.ink}画素（${a0.points}点を見た）`);
/* ③紙面内の必要な区間は出ている（破線なので少し広い窓で見る）。 */
for(const s of (await frame()).axis){const mid=[(s[0][0]+s[1][0])/2,(s[0][1]+s[1][1])/2];
 const q=await ev(`freeFoldDebug.project([${mid[0]},0,${-mid[1]}])`);
 assert.equal(await countAt(q,14,PINK)>0,true,'20 紙面内の折軸が描かれていない: '+JSON.stringify(s))}
/* ④紙の境界に重なる折軸は消えない（切るのは clipToPoly＝境界上の辺はそのまま返る）。 */
const onBoundary=await ev(`(()=>{const S=freeFoldDebug.state,e=FreeFoldEngine.rimEdges(S)[0];
 const f=S.cache.faces.find(v=>v.faceId===e.faceId);
 const d=[e.seg[1][0]-e.seg[0][0],e.seg[1][1]-e.seg[0][1]];
 const s=FreeFoldSnap.clipToPoly(f.poly,e.seg[0],d);/* その面のふちそのものを軸にする */
 return[s?Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1]):0,Math.hypot(d[0],d[1]),e.edgeId]})()`);
assert.equal(Math.abs(onBoundary[0]-onBoundary[1])<1e-6,true,
 '20 紙の境界に重なる折軸が消えた: '+JSON.stringify(onBoundary));
const axisShot=await shot('freefold-axis-clipped.png');
/* ⑤0°／90°／180°で表示が欠けない。90°は「同じ kind に戻しつつ描き直す」で実際に塗らせる。 */
const segsAt=async ang=>{await ev(`freeFoldDebug.state.pending.preview=${ang}`);
 await click('kind');await click('kind');/* 2回で kind は元通り、角度だけ変わって描き直される */
 const f=await frame();return{angle:f.ghost.angle,axis:f.axis}};
const base=(await frame()).axis;
for(const ang of[0,90,180]){const r=await segsAt(ang);
 assert.equal(r.angle,ang,`20 ${ang}°で描き直せていない`);
 assert.deepEqual(r.axis,base,`20 ${ang}°で折軸の表示が欠けた/増えた`);
 const o=await inkOutside();
 assert.equal(o.ink,0,`20 ${ang}°で紙の外にピンクが出た: ${o.ink}画素`)}
/* ⑥カメラを回して・ズームしても紙の外へ出ない。 */
/* ⚠候補を持ったまま紙の上を押すとつかみ直しになるので、ここはカメラを直接動かして描き直す。 */
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=.45;c.pitch=.95;c.zoom=1.6;return true})()');
await click('kind');await click('kind');/* 同じ kind に戻しながら再描画 */
const camQ=await ev('({...freeFoldDebug.camera})');
assert.equal(camQ.yaw!==0&&camQ.zoom!==1,true,'20 カメラが動いていない（検査の意味がない）');
assert.equal(((await frame()).axis||[]).length>0,true,'20 カメラを動かしたら軸が消えた｜'+(await status()));
const a1=await inkOutside();
assert.equal(a1.ink,0,`20 カメラを動かしたら紙の外にピンクが出た: ${a1.ink}画素（${a1.points}点）`);
/* 片づけ（この検査は表示だけを見た＝原本は1手のまま）。 */
await dropAt([.2,-.2]);/* 指を離してから取消（ドラッグ中は取消ボタンが無効） */
await click('cancel');assert.equal(await steps(),1,'20 取消で原本が動いた');
assert.deepEqual([(await frame()).axis,(await frame()).crease],[null,null],'20 取消で軸の表示が消えない: '+JSON.stringify(await frame()));
await click('kind');assert.equal(await ev('freeFoldDebug.kind'),'V','20 谷折りに戻せない');
await click('undo');assert.equal(await steps(),0,'20 片づけで巻き戻せない');
mark('20 紙外の破線画素 = '+a0.ink+'（見張り点 '+a0.points+'）／カメラ変更後 = '+a1.ink);


mark('21 🦴 H1: the folded spine (hinge) can be identified and selected on screen');
/* 🦴 H1＝本人の要望「白と赤のあいだの長い境界（折った背）へ合わせたい」の土台。
   ここでは**選べること**だけを見る（軸・吸着・プレビュー・確定は H2）。 */
assert.equal(await steps(),0,'21 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
/* 画像と同じ構造：手1=縦の折り目、手2=右上の角折り、手3=折り目をまたぐ角折り（2面が動く）。 */
await click('lineMode');
await grabAt([0,-.95]);await carryTo([0,0]);await carryTo([0,.95]);await dropAt([0,.95]);
await click('confirm');await click('lineMode');
await grabAt([1,1]);await carryTo([.8,.8]);await carryTo([.35,.35]);await dropAt([.35,.35]);await click('confirm');
await grabAt([-1,-1]);await carryTo([-.7,-.3]);await carryTo([-.2,.6]);await dropAt([-.2,.6]);await click('confirm');
assert.equal(await steps(),3,'21 3手にならない｜'+(await status()));
assert.equal(await faces(),5,'21 面が5枚にならない');
/* ①白と赤の長い境界が「背の区間」として取れている。 */
const hiv=await ev('FreeFoldEngine.hingeIntervals(freeFoldDebug.state).map(h=>({id:h.intervalId,faces:h.faceIds,len:h.len,visible:h.visible,parts:h.visibleParts.length,reason:h.reason}))');
assert.deepEqual(hiv.map(h=>h.id),['hinge:s2#1','hinge:s3#1','hinge:s3#2'],'21 背の区間IDが違う: '+JSON.stringify(hiv));
const longH=hiv.find(h=>h.id==='hinge:s3#1');
assert.deepEqual(longH.faces,['paper/s1.cut/s3.keep','paper/s1.cut/s3.cut'],'21 長い境界の両側faceIdが違う');
assert.equal(longH.visible&&longH.parts===1,true,'21 長い境界が可視区間として出ない: '+JSON.stringify(longH));
/* ②その線を画面で選べる（押した所は角・外周辺として掴めない所）。 */
const hmid=await ev(`(()=>{const h=FreeFoldEngine.hingeIntervals(freeFoldDebug.state).find(v=>v.intervalId==='hinge:s3#1');
 const s=h.visibleParts[0].seg;return[(s[0][0]+s[1][0])/2,(s[0][1]+s[1][1])/2]})()`);
const recipe21=await recipeText(),hash21=await ev('freeFoldDebug.state.cache.hash');
await grabAt(hmid);await dropAt(hmid);
const hp=(await frame()).hingePick;
assert.equal(hp&&hp.intervalId,'hinge:s3#1','21 長い境界を画面で選べない｜'+(await status()));
assert.deepEqual(hp.faceIds,['paper/s1.cut/s3.keep','paper/s1.cut/s3.cut'],'21 選んだ背の両側faceIdが違う');
assert.deepEqual(hp.sides.map(s=>[s.faceId,s.layer,s.back,s.layerPath]),
 [['paper/s1.cut/s3.keep',0,false,'s1.cut>s3.keep'],['paper/s1.cut/s3.cut',3,true,'s1.cut>s3.cut']],
 '21 両側の層・表裏・layerPath が違う: '+JSON.stringify(hp.sides));
/* ③intent に両側faceIdと由来stepId が凍結されている。 */
assert.deepEqual([hp.intent.intervalId,hp.intent.stepId,hp.intent.faceIds],
 ['hinge:s3#1','s3',['paper/s1.cut/s3.keep','paper/s1.cut/s3.cut']],'21 intent の中身が違う: '+JSON.stringify(hp.intent));
assert.equal(await ev('Object.isFrozen(freeFoldDebug.hingePick)&&Object.isFrozen(freeFoldDebug.hingePick.intent)'),true,'21 選んだ背を凍結していない');
assert.equal((await status()).includes('折った背を選びました'),true,'21 案内が違う｜'+(await status()));
assert.equal((await ev('freeFoldDebug.detail')||'').includes('hinge:s3#1'),true,'21 「詳しく」に背の区間IDが無い｜'+(await ev('freeFoldDebug.detail')));
/* 緑でなぞってある（操作の3色の検査は汚さない＝handles には入れない）。 */
assert.equal(await greenAt(hmid,10),true,'21 選んだ背が緑でない');
assert.deepEqual((await frame()).handles,[],'21 背の選択が handles に混ざった');
/* 原本もハッシュも動かない（読み取りだけ）。 */
assert.equal(await recipeText(),recipe21,'21 背を選んだら原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash21,'21 背を選んだら cache.hash が動いた');
const hingeShot=await shot('freefold-hinge-picked.png');
/* ④カメラを回して・ズームしても同じ背を選ぶ。 */
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=.5;c.pitch=.95;c.zoom=1.5;return true})()');
const hmid2=await point(hmid);await press(hmid2);await release(hmid2);
assert.equal((await frame()).hingePick.intervalId,'hinge:s3#1','21 カメラを変えたら別の背を選んだ｜'+(await status()));
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
/* ⑤フラップの外周rimと取り違えない（そこは E1.5 の辺つかみになる）。 */
const rmid=await ev(`(()=>{const e=FreeFoldEngine.rimEdges(freeFoldDebug.state).find(v=>v.edgeId==='rim:left|paper/s1.cut/s3.cut');
 return[(e.seg[0][0]+e.seg[1][0])/2,(e.seg[0][1]+e.seg[1][1])/2]})()`);
await grabAt(rmid);
assert.equal((await frame()).kind,'rim','21 フラップの外周辺が辺としてつかめない｜'+(await status()));
assert.equal((await frame()).hingePick,null,'21 外周辺をつかんだのに背の選択が残っている');
await dropAt(rmid);
/* ⑥下に隠れた折り目 s1#1 は選ばない。 */
const cmid=await ev(`(()=>{const c=FreeFoldEngine.creaseIntervals(freeFoldDebug.state).find(v=>v.intervalId==='s1#1');
 return[(c.seg[0][0]+c.seg[1][0])/2,(c.seg[0][1]+c.seg[1][1])/2]})()`);
await grabAt(cmid);await dropAt(cmid);
assert.equal((await frame()).hingePick,null,'21 隠れた折り目を背として選んだ｜'+(await status()));
/* ⑦巻き戻し→やり直しのあと、凍結した意図が同じ区間へ解決できる。 */
await grabAt(hmid);await dropAt(hmid);
const savedIntent=await ev('JSON.stringify(freeFoldDebug.hingePick.intent)');
await click('undo');assert.equal(await steps(),2,'21 巻き戻せない');
assert.equal((await frame()).hingePick,null,'21 巻き戻しで背の選択が消えない');
await click('redo');assert.equal(await steps(),3,'21 やり直せない');
const resolved=await ev(`(()=>{const r=FreeFoldEngine.resolveHingeInterval(freeFoldDebug.state,JSON.parse(${JSON.stringify(savedIntent)}));
 return r?[r.intervalId,r.faceIds]:null})()`);
assert.deepEqual(resolved,['hinge:s3#1',['paper/s1.cut/s3.keep','paper/s1.cut/s3.cut']],'21 やり直しのあと同じ区間へ解決できない: '+JSON.stringify(resolved));
/* 片づけ。 */
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'21 片づけで巻き戻せない');
assert.equal((await frame()).hingePick,null,'21 片づけで背の選択が残った');


mark('22 🦴📐 H2: aligning a rim edge onto the VISIBLE folded spine (hinge:s3#1)');
/* 🦴📐 H2＝本人の要望「白と赤のあいだの長い境界（折った背）へ辺を合わせたい」の本命。
   幾何は E2 のまま／target だけ H1 の visible hinge 区間。背は 0°/90°/180° で動かないことが関門。 */
assert.equal(await steps(),0,'22 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
await click('lineMode');
await grabAt([0,-.95]);await carryTo([0,0]);await carryTo([0,.95]);await dropAt([0,.95]);
await click('confirm');await click('lineMode');
await grabAt([1,1]);await carryTo([.8,.8]);await carryTo([.35,.35]);await dropAt([.35,.35]);await click('confirm');
await grabAt([-1,-1]);await carryTo([-.7,-.3]);await carryTo([-.2,.6]);await dropAt([-.2,.6]);await click('confirm');
assert.equal(await steps(),3,'22 3手にならない｜'+(await status()));
/* 本命の組み合わせ（source＝白いフラップの左辺／target＝長い境界）と、その着地点を engine から取る。 */
const plan=await ev(`(()=>{const S=freeFoldDebug.state,E=FreeFoldEngine;
 const eRef=E.edgeIntent(S,'paper/s1.cut/s3.cut','left'),o=E.edgeToHingeOptions(S,eRef);
 const b=o.options.filter(v=>v.ok&&v.target.intervalId==='hinge:s3#1')[0];
 const seg=o.source.seg,mid=[(seg[0][0]+seg[1][0])/2,(seg[0][1]+seg[1][1])/2];
 return{edgeSeg:seg,grabMid:mid,land:E.reflect(mid,b.axis[0],b.axis[1]),axis:b.axis,
  target:b.target.fixedSeg,span:b.span,move:b.move,stationary:b.stationary}})()`);
const before22=await recipeText(),hash22=await ev('freeFoldDebug.state.cache.hash');
/* ①白いフラップの左辺をつかむ（E1.5 の辺つかみ）。 */
await grabAt(plan.grabMid);
assert.equal((await frame()).kind,'rim','22 フラップの辺をつかめない｜'+(await status()));
/* ②200px 離れていれば提案しない → 26px で吸着 → 44px 維持 → 46px で離れる。 */
const land22=await point(plan.land);
const at22=async px=>{await moveTo([land22[0]+px,land22[1]]);return await frame()};
assert.equal((await at22(200)).edgeTo,null,'22 200px 離れているのに吸着した');
const f26x=await at22(26);
assert.deepEqual([f26x.edgeTo&&f26x.edgeTo.targetKind,f26x.edgeTo&&f26x.edgeTo.intervalId],['hinge','hinge:s3#1'],
 '22 26px で折った背へ吸着しない｜'+(await status()));
assert.equal((await status()).includes('折った背 s3#1 へ合わせます'),true,'22 案内が違う｜'+(await status()));
assert.equal((await at22(44)).edgeTo!==null,true,'22 44px まで維持できない');
assert.equal((await at22(46)).edgeTo,null,'22 46px で離れない');
const fz22=await at22(0);
assert.equal(fz22.edgeTo.intervalId,'hinge:s3#1','22 戻したのに吸着しない');
/* 吸着しているところの絵（黄＝つかんだ辺／緑＝折った背／青い破線＝折軸）。 */
const hingeAimShot=await shot('freefold-edge-to-hinge-aim.png');
/* ③反射後、つかんだ辺の両端が背の線に 0px で乗る（画面pxで測る）。 */
const ends22=await ev(`(()=>{const S=freeFoldDebug.state,g=freeFoldDebug.geometry;
 const seg=${JSON.stringify(plan.edgeSeg)},tgt=${JSON.stringify(plan.target)};
 const P=p=>freeFoldDebug.project([p[0],0,-p[1]]),ca=P(tgt[0]),cb=P(tgt[1]);
 const ux=cb[0]-ca[0],uy=cb[1]-ca[1],L=Math.hypot(ux,uy);
 const d=q=>Math.abs((q[0]-ca[0])*uy/L-(q[1]-ca[1])*ux/L);
 return seg.map(p=>Math.round(d(P(FreeFoldEngine.reflect(p,g.line[0],g.line[1])))*1e4)/1e4)})()`);
assert.deepEqual(ends22,[0,0],'22 反射後の両端が背の線に乗っていない: '+JSON.stringify(ends22));
/* ④背の両端と内部点が 0°/90°/180° で動かない（engine の関門と、ゴーストから独立に見る両方）。 */
const stay22=await ev(`(()=>{const S=freeFoldDebug.state,q=S.pending,E=FreeFoldEngine;
 const h=E.hingeIntervals(S).find(v=>v.intervalId==='hinge:s3#1');
 const f=S.cache.faces.find(v=>v.faceId===q.reference.faceId);
 const ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]];
 const r=E.hingeStaysUnderFold(${JSON.stringify(plan.target)},h.faceIds,q.candidates.map(c=>c.faceId),
  q.displayLine[0],q.displayLine[1],q.kind,ap(f.xf,q.sidePoint));
 return[r.ok,r.worst]})()`);
assert.deepEqual(stay22,[true,0],'22 背が動いてしまう: '+JSON.stringify(stay22));
const ghost22=await ev(`(()=>{const S=freeFoldDebug.state,tgt=${JSON.stringify(plan.target)},out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(S,a);let worst=0;
  for(let i=0;i<=4;i++){const t=i/4,p=[tgt[0][0]+(tgt[1][0]-tgt[0][0])*t,tgt[0][1]+(tgt[1][1]-tgt[0][1])*t];
   for(const part of g.parts){if(!part.moveSrc)continue;
    const k=part.moveSrc.findIndex(v=>Math.hypot(v[0]-p[0],v[1]-p[1])<1e-9);
    if(k>=0){const m=part.move[k];worst=Math.max(worst,Math.hypot(m[0]-p[0],m[1],m[2]+p[1]))}}}
  out.push([a,Math.round(worst*1e9)/1e9])}
 FreeFoldEngine.preview(S,180);return out})()`);
for(const [a,w] of ghost22)assert.equal(w,0,`22 ${a}° で背が動いた（ゴーストから測って ${w}）`);
/* ⑤0°/90°/180° で裂けない（素材の格子で等長検査。結びも面の並びも見ない）。 */
const tear22=await ev(`(()=>{const st=freeFoldDebug.state,q=st.pending,
 ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]],
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({id:f.faceId,xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))})),out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(st,a),ids=new Set(g.movingIds),A=g.line[0],B=g.line[1];
  const rot=FreeFoldEngine.foldRotator(A,B,a,q.kind);
  const put=u=>{for(const f of F)if(FreeFoldEngine.inside(u,f.src)){const p=ap(f.xf,u);
    return ids.has(f.id)&&FreeFoldEngine.side(p,A,B)<-1e-9?rot(p):[p[0],0,-p[1]]}return null};
  const G=50,h=2/G;let bad=0,tot=0;
  for(let i=0;i<G;i++)for(let j=0;j<G;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
   for(const r of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const X=put(p),Y=put(r);if(!X||!Y)continue;tot++;
    if(Math.hypot(X[0]-Y[0],X[1]-Y[1],X[2]-Y[2])>h*1.0001+1e-9)bad++}}
  out.push({a,bad,tot})}
 FreeFoldEngine.preview(st,180);return out})()`);
for(const t of tear22)assert.equal(t.bad,0,`22 ${t.a}° でゴーストが破れた ${t.bad}/${t.tot}点`);
/* ドラッグ中は原本もハッシュも動かない。 */
assert.equal(await recipeText(),before22,'22 ドラッグ中に原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash22,'22 ドラッグ中に紙が動いた');
await release([land22[0],land22[1]]);
const hingeFoldShot=await shot('freefold-edge-to-hinge.png');
/* ⑥確定・原本・保存・巻き戻し・やり直し。 */
assert.equal(await disabled('confirm'),false,'22 離しても確定できない｜'+(await status()));
await click('confirm');
assert.equal(await steps(),4,'22 確定できない｜'+(await status()));
const step22=await ev('freeFoldDebug.state.recipe.steps[3]');
assert.deepEqual(Object.keys(step22).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'22 原本の項目が増えた: '+Object.keys(step22));
for(const w of['hinge','intervalId','partSrcSeg','rim:','edgeId'])
 assert.equal((await recipeText()).includes(w),false,`22 原本に ${w} が漏れた`);
/* 折ったあと、つかんだ辺ぜんぶ（長さ1）が背の線に乗っている。 */
const on22=await ev(`(()=>{const S=freeFoldDebug.state,tgt=${JSON.stringify(plan.target)};
 const u=[tgt[1][0]-tgt[0][0],tgt[1][1]-tgt[0][1]],L=Math.hypot(u[0],u[1]);
 const d=q=>Math.abs((q[0]-tgt[0][0])*u[1]/L-(q[1]-tgt[0][1])*u[0]/L);
 return FreeFoldEngine.rimEdges(S).filter(e=>e.rimId==='left'&&e.faceId.startsWith('paper/s1.cut/s3.cut'))
  .map(e=>e.seg).filter(s=>s.every(p=>d(p)<1e-6))
  .map(s=>Math.round(Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1])*1e6)/1e6)})()`);
assert.deepEqual(on22,[1],'22 つかんだ辺ぜんぶが背の線に乗っていない: '+JSON.stringify(on22));
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'22 保存した原本を再生すると別の紙になる');
const file22=await saveAndWait('download22');
const h22=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),3,'22 巻き戻せない');
assert.equal(await recipeText(),before22,'22 巻き戻しで原本が戻らない');
await click('redo');assert.equal(await steps(),4,'22 やり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h22,'22 やり直しでハッシュが戻らない');
/* ⑦カメラを回して・ズームしても同じ操作ができる（取消で片づける）。 */
await click('undo');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=.5;c.pitch=.95;c.zoom=1.4;return true})()');
await grabAt(plan.grabMid);
const land22b=await point(plan.land);await moveTo([land22b[0]+20,land22b[1]]);
assert.equal((await frame()).edgeTo&&(await frame()).edgeTo.intervalId,'hinge:s3#1',
 '22 カメラを変えたら同じ操作ができない｜'+(await status()));
await release([land22b[0]+20,land22b[1]]);await click('cancel');
assert.equal(await steps(),3,'22 取消で原本が動いた');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'22 片づけで巻き戻せない');


mark('23 🪚 E3: aligning a rim edge onto another VISIBLE rim edge (flap and base)');
/* 🪚 E3＝「外周辺を、折った後の見えている外周辺へ合わせる」。幾何と関門は E2/H2 の再利用。
   ⚠この形では **土台の左辺 → 折ったフラップの左辺** が折りになる。逆向き（フラップ→土台）は
   軸がフラップの紙を二つに分けない（＝面を丸ごと裏返すだけ）ので engine が正しく断る＝下で固定する。 */
assert.equal(await steps(),0,'23 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
await click('lineMode');
await grabAt([0,-.95]);await carryTo([0,0]);await carryTo([0,.95]);await dropAt([0,.95]);
await click('confirm');await click('lineMode');
await grabAt([1,1]);await carryTo([.8,.8]);await carryTo([.35,.35]);await dropAt([.35,.35]);await click('confirm');
await grabAt([-1,-1]);await carryTo([-.7,-.3]);await carryTo([-.2,.6]);await dropAt([-.2,.6]);await click('confirm');
assert.equal(await steps(),3,'23 3手にならない｜'+(await status()));
/* 逆向き（フラップ→土台）は候補にならない＝engine が「紙を二つに分けません」で断る。 */
const rev23=await ev(`(()=>{const S=freeFoldDebug.state,E=FreeFoldEngine;
 return E.edgeToEdgeOptions(S,E.edgeIntent(S,'paper/s1.cut/s3.cut','left')).options
  .filter(o=>o.target.edgeId==='rim:left|paper/s1.cut/s3.keep').map(o=>[o.ok,o.reason])})()`);
assert.equal(rev23.length>0&&rev23.every(r=>r[0]===false),true,'23 逆向きを通した: '+JSON.stringify(rev23));
assert.equal(rev23.some(r=>/紙を二つに分けません/.test(r[1])),true,
 '23 面を丸ごと裏返す候補を断っていない: '+JSON.stringify(rev23));
/* 本命＝土台の左辺を、見えているフラップの左辺へ。 */
const plan23=await ev(`(()=>{const S=freeFoldDebug.state,E=FreeFoldEngine;
 const eRef=E.edgeIntent(S,'paper/s1.cut/s3.keep','left'),o=E.edgeToEdgeOptions(S,eRef);
 const b=o.options.filter(v=>v.ok&&v.target.edgeId==='rim:left|paper/s1.cut/s3.cut')[0];
 const seg=o.source.seg,mid=[(seg[0][0]+seg[1][0])/2,(seg[0][1]+seg[1][1])/2];
 return{edgeSeg:seg,grabMid:mid,land:E.reflect(mid,b.axis[0],b.axis[1]),axis:b.axis,
  target:b.target.fixedSeg,span:b.span,move:b.move,stationary:b.stationary,targetId:b.target.edgeId}})()`);
assert.equal(plan23.targetId,'rim:left|paper/s1.cut/s3.cut','23 本命の候補が出ない');
const before23=await recipeText(),hash23=await ev('freeFoldDebug.state.cache.hash');
/* ①土台の左辺をつかむ（紙は平らでないので E1.5 の辺つかみ）。 */
await grabAt(plan23.grabMid);
assert.equal((await frame()).kind,'rim','23 土台の辺をつかめない｜'+(await status()));
/* ②200px 離れていれば提案しない → 26px で吸着 → 44px 維持 → 46px で離れる。 */
const land23=await point(plan23.land);
const at23=async px=>{await moveTo([land23[0]+px,land23[1]]);return await frame()};
assert.equal((await at23(200)).edgeTo,null,'23 200px 離れているのに吸着した');
const g26=await at23(26);
assert.deepEqual([g26.edgeTo&&g26.edgeTo.targetKind,g26.edgeTo&&g26.edgeTo.intervalId],
 ['edge','rim:left|paper/s1.cut/s3.cut'],'23 26px で折った紙のふちへ吸着しない｜'+(await status()));
assert.equal((await status()).includes('折った紙の左辺へ合わせます'),true,'23 案内が違う｜'+(await status()));
assert.equal((await at23(44)).edgeTo!==null,true,'23 44px まで維持できない');
assert.equal((await at23(46)).edgeTo,null,'23 46px で離れない');
assert.equal((await at23(0)).edgeTo.intervalId,'rim:left|paper/s1.cut/s3.cut','23 戻したのに吸着しない');
/* ③反射後、つかんだ辺の両端が相手のふちの線に 0px で乗る。 */
const ends23=await ev(`(()=>{const g=freeFoldDebug.geometry;
 const seg=${JSON.stringify(plan23.edgeSeg)},tgt=${JSON.stringify(plan23.target)};
 const P=p=>freeFoldDebug.project([p[0],0,-p[1]]),ca=P(tgt[0]),cb=P(tgt[1]);
 const ux=cb[0]-ca[0],uy=cb[1]-ca[1],L=Math.hypot(ux,uy);
 const d=q=>Math.abs((q[0]-ca[0])*uy/L-(q[1]-ca[1])*ux/L);
 return seg.map(p=>Math.round(d(P(FreeFoldEngine.reflect(p,g.line[0],g.line[1])))*1e4)/1e4)})()`);
assert.deepEqual(ends23,[0,0],'23 反射後の両端が相手のふちに乗っていない: '+JSON.stringify(ends23));
/* ④合わせ先のふちが 0°/90°/180° で動かない（engine の関門とゴースト独立の両方）。 */
const stay23=await ev(`(()=>{const S=freeFoldDebug.state,q=S.pending,E=FreeFoldEngine;
 const f=S.cache.faces.find(v=>v.faceId===q.reference.faceId);
 const ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]];
 const r=E.hingeStaysUnderFold(${JSON.stringify(plan23.target)},['paper/s1.cut/s3.cut'],
  q.candidates.map(c=>c.faceId),q.displayLine[0],q.displayLine[1],q.kind,ap(f.xf,q.sidePoint));
 return[r.ok,r.worst,q.candidates.map(c=>c.faceId)]})()`);
assert.equal(stay23[0]&&stay23[1]===0,true,'23 合わせ先が動いてしまう: '+JSON.stringify(stay23));
assert.equal(stay23[2].includes('paper/s1.cut/s3.cut'),false,'23 合わせ先の面を動かしてしまう');
const ghost23=await ev(`(()=>{const S=freeFoldDebug.state,tgt=${JSON.stringify(plan23.target)},out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(S,a);let worst=0;
  for(let i=0;i<=4;i++){const t=i/4,p=[tgt[0][0]+(tgt[1][0]-tgt[0][0])*t,tgt[0][1]+(tgt[1][1]-tgt[0][1])*t];
   for(const part of g.parts){if(!part.moveSrc)continue;
    const k=part.moveSrc.findIndex(v=>Math.hypot(v[0]-p[0],v[1]-p[1])<1e-9);
    if(k>=0){const m=part.move[k];worst=Math.max(worst,Math.hypot(m[0]-p[0],m[1],m[2]+p[1]))}}}
  out.push([a,Math.round(worst*1e9)/1e9])}
 FreeFoldEngine.preview(S,180);return out})()`);
for(const [a,w] of ghost23)assert.equal(w,0,`23 ${a}° で合わせ先が動いた（${w}）`);
/* ⑤0°/90°/180° で裂けない（素材の格子で等長検査）。 */
const tear23=await ev(`(()=>{const st=freeFoldDebug.state,q=st.pending,
 ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]],
 iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
 const F=st.cache.faces.map(f=>({id:f.faceId,xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))})),out=[];
 for(const a of[0,90,180]){const g=FreeFoldEngine.preview(st,a),ids=new Set(g.movingIds),A=g.line[0],B=g.line[1];
  const rot=FreeFoldEngine.foldRotator(A,B,a,q.kind);
  const put=u=>{for(const f of F)if(FreeFoldEngine.inside(u,f.src)){const p=ap(f.xf,u);
    return ids.has(f.id)&&FreeFoldEngine.side(p,A,B)<-1e-9?rot(p):[p[0],0,-p[1]]}return null};
  const G=50,h=2/G;let bad=0,tot=0;
  for(let i=0;i<G;i++)for(let j=0;j<G;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
   for(const r of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const X=put(p),Y=put(r);if(!X||!Y)continue;tot++;
    if(Math.hypot(X[0]-Y[0],X[1]-Y[1],X[2]-Y[2])>h*1.0001+1e-9)bad++}}
  out.push({a,bad,tot})}
 FreeFoldEngine.preview(st,180);return out})()`);
for(const t of tear23)assert.equal(t.bad,0,`23 ${t.a}° でゴーストが破れた ${t.bad}/${t.tot}点`);
assert.equal(await recipeText(),before23,'23 ドラッグ中に原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash23,'23 ドラッグ中に紙が動いた');
const e3Shot=await shot('freefold-edge-to-edge.png');
await release([land23[0],land23[1]]);
/* ⑥確定・原本・保存・巻き戻し・やり直し。 */
assert.equal(await disabled('confirm'),false,'23 離しても確定できない｜'+(await status()));
await click('confirm');
assert.equal(await steps(),4,'23 確定できない｜'+(await status()));
const step23=await ev('freeFoldDebug.state.recipe.steps[3]');
assert.deepEqual(Object.keys(step23).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'23 原本の項目が増えた: '+Object.keys(step23));
for(const w of['rim:','edgeId','intervalId','hinge'])
 assert.equal((await recipeText()).includes(w),false,`23 原本に ${w} が漏れた`);
/* 折ったあと、つかんだ辺ぜんぶ（長さ1）が相手のふちの線に乗り、合わせ先の面は動いていない。 */
const on23=await ev(`(()=>{const S=freeFoldDebug.state,tgt=${JSON.stringify(plan23.target)};
 const u=[tgt[1][0]-tgt[0][0],tgt[1][1]-tgt[0][1]],L=Math.hypot(u[0],u[1]);
 const d=q=>Math.abs((q[0]-tgt[0][0])*u[1]/L-(q[1]-tgt[0][1])*u[0]/L);
 return FreeFoldEngine.rimEdges(S).filter(e=>e.faceId.startsWith('paper/s1.cut/s3.keep'))
  .map(e=>e.seg).filter(s=>s.every(p=>d(p)<1e-6))
  .map(s=>Math.round(Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1])*1e6)/1e6)})()`);
assert.deepEqual(on23,[1],'23 つかんだ辺ぜんぶが相手のふちに乗っていない: '+JSON.stringify(on23));
assert.deepEqual(await ev(`freeFoldDebug.state.cache.faces.find(f=>f.faceId==='paper/s1.cut/s3.cut').poly
 .map(p=>p.map(v=>Math.round(v*1e6)/1e6))`),[[-0.2,0.6],[0.4,-0.2],[0,-0.5],[-1,0]],'23 合わせ先の面が動いた');
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'23 保存した原本を再生すると別の紙になる');
const file23=await saveAndWait('download23');
const h23=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),3,'23 巻き戻せない');
assert.equal(await recipeText(),before23,'23 巻き戻しで原本が戻らない');
await click('redo');assert.equal(await steps(),4,'23 やり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h23,'23 やり直しでハッシュが戻らない');
/* ⑦カメラを回して・ズームしても同じ操作（取消で片づける）。 */
await click('undo');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=.45;c.pitch=.9;c.zoom=1.35;return true})()');
await grabAt(plan23.grabMid);
const land23b=await point(plan23.land);await moveTo([land23b[0]+15,land23b[1]]);
assert.equal((await frame()).edgeTo&&(await frame()).edgeTo.intervalId,'rim:left|paper/s1.cut/s3.cut',
 '23 カメラを変えたら同じ操作ができない｜'+(await status()));
await release([land23b[0]+15,land23b[1]]);await click('cancel');
assert.equal(await steps(),3,'23 取消で原本が動いた');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'23 片づけで巻き戻せない');

/* ============ mark 24（2026-09-13）折れない手は、ゴーストを1コマも出さない ============
   本人が画像で指摘した症状＝1手目のフラップ(layer1)が上に乗ったまま土台(layer0)を谷折りしようとすると、
   動く紙が固定の紙をすり抜けた絵が出た。engine の foldability は前から「上に乗っている紙があります」と
   断っていたが、通っていたのは setLayers（上からN枚）と confirm だけ＝
   **重なりが「この場所」に無い単一面の道はプレビューが素通り**し、確定ボタンまで押せた。 */
mark('24 折れない手のゴーストを出さない');
/* ①1手目：右下の角をつかみ、左端の辺へ合わせて確定。 */
await grabAt([1,-1]);
for(const p of [[.6,-.8],[0,-.4],[-.6,0],[-.98,.2]])await carryTo(p);
await dropAt([-.98,.2]);
await click('confirm');
assert.equal(await steps(),1,'24 1手目が確定できない｜'+(await status()));
assert.deepEqual(await ev("freeFoldDebug.state.cache.faces.map(f=>f.faceId+'/L'+f.layer)"),
 ['paper/s1.keep/L0','paper/s1.cut/L1'],'24 1手目の面が違う');
const rec24=await recipeText(),rev24=await ev('freeFoldDebug.state.revision'),
 hash24=await ev('freeFoldDebug.state.cache.hash'),redo24=await ev('freeFoldDebug.state.redoStack.length');
/* ②2手目：左上の角をつかみ、右へすこし動かして離す＝上に紙が乗ったままの谷折り。 */
await grabAt([-1,1]);
for(const p of [[-.9,.97],[-.7,.93],[-.55,.9]])await carryTo(p);
await dropAt([-.55,.9]);
assert.equal(await ev('freeFoldDebug.foldCheck&&freeFoldDebug.foldCheck.ok'),false,'24 engine が折れると言っている');
assert.deepEqual(await ev('freeFoldDebug.foldCheck.blocking'),['paper/s1.cut'],'24 邪魔をしている紙を指していない');
/* ゴーストは1つも出ない＝すり抜けた絵を描かない。 */
assert.equal(await ev('freeFoldDebug.geometry===null'),true,'24 折れない手のゴーストが作られている');
const f24=await frame();
assert.equal(f24.ghost,null,'24 ゴーストが画面に残っている');
assert.equal(f24.crease,null,'24 折線が画面に残っている');
assert.equal(f24.axis,null,'24 折軸が画面に残っている');
/* 理由は赤で出て、確定はできない。 */
assert.equal(await status(),'上に乗っている紙があります（その紙も一緒に選んでください）','24 断る理由が出ない｜'+(await status()));
assert.equal(await ev("document.getElementById('status').style.color"),'rgb(255, 155, 155)','24 理由が赤で出ていない');
assert.equal(await disabled('confirm'),true,'24 折れないのに確定できる');
/* 🚨断っても pending は残す＝山谷や枚数で救う道を塞がない。 */
assert.equal(await ev('!!freeFoldDebug.state.pending'),true,'24 断ったときに pending まで捨てている');
assert.equal(await disabled('cancel'),false,'24 取消が押せない');
/* 正式な状態は1ミリも動かない。 */
assert.equal(await recipeText(),rec24,'24 断ったのに原本が動いた');
assert.equal(await ev('freeFoldDebug.state.revision'),rev24,'24 断ったのに revision が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash24,'24 断ったのに cache.hash が動いた');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),redo24,'24 断ったのに redoStack が動いた');
const shot24a=await shot('freefold-blocked-no-ghost.png');
/* ③山折りへ変えると、邪魔な紙が入れかわって成立する＝その場で判定しなおす。 */
await click('kind');
assert.equal(await ev('freeFoldDebug.kind'),'M','24 山折りに切りかわっていない');
assert.equal(await ev('freeFoldDebug.foldCheck&&freeFoldDebug.foldCheck.ok'),true,'24 山折りにしても折れないと言う｜'+(await status()));
assert.equal(await ev('freeFoldDebug.geometry!==null'),true,'24 山折りにしてもゴーストが出ない');
assert.equal(await disabled('confirm'),false,'24 山折りにしても確定できない');
assert.equal(await status(),'この形でよければ確定してください。取消でいつでも戻せます','24 山折りの案内が戻らない｜'+(await status()));
/* 谷へ戻すとまた断る＝切りかえるたびに engine へ聞きなおしている。 */
await click('kind');
assert.equal(await ev('freeFoldDebug.geometry===null'),true,'24 谷へ戻したのにゴーストが残る');
assert.equal(await disabled('confirm'),true,'24 谷へ戻したのに確定できる');
/* ④取消で候補は消え、原本は動かない。 */
await click('cancel');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'24 取消で候補が消えない');
assert.equal(await ev('freeFoldDebug.foldCheck'),null,'24 取消で判定が残っている');
assert.equal(await steps(),1,'24 取消で原本が動いた');
assert.equal(await recipeText(),rec24,'24 取消で原本が変わった');
await click('undo');assert.equal(await steps(),0,'24 片づけで巻き戻せない');
await click('redo');await click('undo');assert.equal(await steps(),0,'24 やり直し→巻き戻しで戻らない');
/* ⑤枚数を変えたら判定しなおす＝断られても「上からN枚」で救える（pending を捨てていないから進める）。 */
await grabAt([1,-1]);
for(const p of [[.6,-.8],[0,-.4],[-.6,-.5],[-.98,-.95]])await carryTo(p);
await dropAt([-.98,-.95]);
await click('confirm');
assert.equal(await steps(),1,'24 N：1手目が確定できない｜'+(await status()));
await grabAt([-1,1]);
for(const p of [[-.95,.5],[-.92,-.2],[-.9,-.9]])await carryTo(p);
await dropAt([-.9,-.9]);
const pick24=await ev('JSON.stringify({n:freeFoldDebug.layerPick.n,ok:freeFoldDebug.layerPick.ok,count:freeFoldDebug.layerPick.count})');
assert.deepEqual(JSON.parse(pick24),{n:1,ok:false,count:2},'24 N：上から1枚が断られていない｜'+pick24);
assert.equal(await ev('freeFoldDebug.geometry===null'),true,'24 N：折れない枚数でゴーストが出た');
assert.equal((await frame()).ghost,null,'24 N：折れない枚数のゴーストが画面に残っている');
assert.equal(await disabled('confirm'),true,'24 N：折れない枚数で確定できる');
assert.deepEqual(await ev("[...document.querySelectorAll('#stackPick button')].map(b=>b.textContent)"),
 ['上から1枚','上から2枚','折線のこの側を全部'],'24 N：枚数のボタンが出ていない');
/* 上から2枚にすると成立し、ゴーストも確定も戻る。 */
await ev("[...document.querySelectorAll('#stackPick button')].filter(b=>b.textContent.includes('2'))[0].click()");
assert.equal(await ev('freeFoldDebug.layerPick.ok'),true,'24 N：上から2枚でも折れないと言う｜'+(await status()));
assert.equal(await ev('freeFoldDebug.geometry!==null'),true,'24 N：上から2枚でもゴーストが出ない');
assert.equal(await disabled('confirm'),false,'24 N：上から2枚でも確定できない');
await click('confirm');
assert.equal(await steps(),2,'24 N：上から2枚で確定できない｜'+(await status()));
assert.deepEqual(await ev("freeFoldDebug.state.recipe.steps[1].targets.map(t=>t.faceId)"),
 ['paper/s1.keep','paper/s1.cut'],'24 N：原本の targets が2面でない');
const shot24b=await shot('freefold-blocked-then-two-sheets.png');
await click('undo');await click('undo');assert.equal(await steps(),0,'24 N：片づけで巻き戻せない');

/* ============ mark 25（2026-09-13）🔄 flip＝紙ぜんぶの裏返し ============
   v1スキーマの op:'flip'（axis:'v'）。折線を持たない＝局所的な「うしろにおる」(fold・kind:'M') とは別物。
   面は1枚も割れず、表と裏が入れかわり、層の符号が反転する（規則は本番 fold2d.flip と同じ）。 */
mark('25 🔄 flip: turning the whole sheet over');
/* ①平らな紙を裏返す＝実画素で色が入れかわる。 */
const red25=await rgbAt([0,0]);
assert.equal(await disabled('flip'),false,'25 裏返すボタンが押せない');
await click('flip');
assert.equal(await steps(),1,'25 裏返しが原本に入らない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['flip'],'25 op が flip でない');
assert.equal(await ev('freeFoldDebug.state.recipe.steps[0].axis'),'v','25 axis が v でない');
assert.deepEqual(await ev("Object.keys(freeFoldDebug.state.recipe.steps[0]).sort()"),
 ['axis','diagramStep','id','instruction','op'],'25 flip の手に余計な項目がある');
assert.equal(await ev('freeFoldDebug.state.cache.faces.length'),1,'25 裏返しで面が割れた');
assert.equal(await ev('FreeFoldEngine.detXf(freeFoldDebug.state.cache.faces[0].xf)<0'),true,'25 裏になっていない');
const white25=await rgbAt([0,0]);
assert.notDeepEqual(white25,red25,'25 裏返したのに紙の色が変わらない');
const shot25=await shot('freefold-flip.png');
/* ②もう一度で完全に元へ戻る（実画素とハッシュの両方）。 */
await click('flip');
assert.deepEqual(await rgbAt([0,0]),red25,'25 2回裏返して色が戻らない');
const flat25=await ev('freeFoldDebug.state.cache.hash');
await click('undo');await click('undo');
assert.equal(await steps(),0,'25 裏返しを巻き戻せない');
await click('redo');await click('redo');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),flat25,'25 やり直しでハッシュが戻らない');
await click('undo');await click('undo');assert.equal(await steps(),0,'25 片づけで巻き戻せない');
/* ③裏返してから折る＝選んだ山谷が JSON で勝手に反転しない。 */
await click('flip');
await grabAt([1,-1]);for(const p of [[.8,-.8],[.4,-.6],[.2,-.4]])await carryTo(p);await dropAt([.2,-.4]);
await click('confirm');
assert.equal(await steps(),2,'25 裏返したあとに折れない｜'+(await status()));
assert.deepEqual(await ev("freeFoldDebug.state.recipe.steps.map(s=>s.op+(s.kind||s.axis))"),['flipv','foldV'],
 '25 選んだ谷折りが JSON で反転された');
/* ④折ったあとでも裏返せる。安定IDは素材座標なので変わらない。 */
const rim25=await ev("JSON.stringify(FreeFoldEngine.rimEdges(freeFoldDebug.state).map(e=>e.edgeId).sort())");
const bond25=await ev('JSON.stringify(freeFoldDebug.state.cache.bonds)');
await click('flip');
assert.equal(await steps(),3,'25 折ったあとに裏返せない｜'+(await status()));
assert.equal(await ev("JSON.stringify(FreeFoldEngine.rimEdges(freeFoldDebug.state).map(e=>e.edgeId).sort())"),rim25,
 '25 裏返しで外周辺のIDが変わった');
assert.equal(await ev('JSON.stringify(freeFoldDebug.state.cache.bonds)'),bond25,'25 裏返しで結び（素材座標）が動いた');
/* ⑤保存した原本を再生すると同じ紙＝表示ハッシュと一致する。 */
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'25 保存した原本を再生すると別の紙になる');
const file25=await saveAndWait('download25');
/* ⑥候補があるあいだは裏返せない（engine 側も断る）。 */
await grabAt([-1,1]);for(const p of [[-.9,.9],[-.7,.8],[-.6,.7]])await carryTo(p);await dropAt([-.6,.7]);
assert.equal(await ev('!!freeFoldDebug.state.pending'),true,'25 候補ができていない');
assert.equal(await disabled('flip'),true,'25 候補があるのに裏返すボタンが押せる');
const rec25=await recipeText();
assert.match(await ev("(()=>{try{FreeFoldEngine.flip(freeFoldDebug.state,'v');return'通った'}catch(e){return e.message}})()"),
 /確定か取消/,'25 候補があるのに engine が裏返した');
assert.equal(await recipeText(),rec25,'25 断ったのに原本が動いた');
await click('cancel');
assert.equal(await disabled('flip'),false,'25 取消しても裏返せない');
await click('undo');await click('undo');await click('undo');assert.equal(await steps(),0,'25 片づけで巻き戻せない');

/* ============ mark 26（2026-09-13）🧵 折り目を付けて、そのまま折る ============
   UIは一続きでも、原本は**ふつうの2手**（crease → fold）。巻き戻しも2手単位。
   staged（折り目を1手足した派生状態）は画面が持つ一時候補＝正式な state には入れない。 */
mark('26 🧵 crease then fold in one gesture');
await click('lineMode');
assert.equal(await ev('freeFoldDebug.lineMode'),true,'26 線モードに入らない');
/* ①2点ドラッグで折り目を引く（ここまでは既存の道）。 */
await grabAt([-.9,-.5]);for(const p of [[-.4,-.5],[.4,-.5],[.9,-.5]])await carryTo(p);await dropAt([.9,-.5]);
assert.equal((await frame()).ghost.flat,true,'26 折り目の候補で紙が動いている（平らに描かれていない）');
assert.equal(await ev("document.getElementById('creaseFold').hidden"),false,'26「この折り目で折る」が出ない');
const rec26=await recipeText(),rev26=await ev('freeFoldDebug.state.revision'),
 hash26=await ev('freeFoldDebug.state.cache.hash');
/* ②「この折り目で折る」＝派生状態ができる。正式な原本は1ミリも動いていない。 */
await click('creaseFold');
assert.equal(await ev('!!freeFoldDebug.staged'),true,'26 派生状態ができていない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.staged.recipe.steps.map(s=>s.op)'),['crease'],'26 派生に折り目が入っていない');
assert.equal(await steps(),0,'26 正式な原本に折り目が入ってしまった');
assert.equal(await recipeText(),rec26,'26 派生を作っただけで原本が動いた');
assert.equal(await ev('freeFoldDebug.state.revision'),rev26,'26 派生を作っただけで revision が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash26,'26 派生を作っただけで cache.hash が動いた');
assert.equal(await ev('freeFoldDebug.state.staged'),undefined,'26 staged が正式な state に入っている');
assert.equal(await disabled('confirm'),true,'26 折る側を選ぶ前に確定できる');
/* ③紙の上を指す＝折る側が決まり、ふつうの折りと同じゴーストが出る。 */
await grabAt([0,-.9]);await dropAt([0,-.9]);
assert.equal(await ev('freeFoldDebug.geometry.angle'),180,'26 折るゴーストが出ない｜'+(await status()));
assert.equal((await frame()).ghost.flat,false,'26 折る段になっても紙が平らのまま描かれている');
assert.equal(await ev('freeFoldDebug.staged.pending.kind'),'V','26 折りの山谷が折り目とそろっていない');
assert.equal(await disabled('confirm'),false,'26 折る側を選んでも確定できない');
const shot26=await shot('freefold-crease-then-fold.png');
/* ④山谷を変えると2手ともそろって作り直される。 */
await click('kind');
assert.equal(await ev('freeFoldDebug.staged.recipe.steps[0].kind'),'M','26 折り目の山谷が変わらない');
assert.equal(await ev('freeFoldDebug.staged.pending.kind'),'M','26 折りの山谷が変わらない');
assert.equal(await ev('freeFoldDebug.geometry.kind'),'M','26 ゴーストの山谷が変わらない');
await click('kind');
assert.equal(await ev('freeFoldDebug.staged.recipe.steps[0].kind'),'V','26 山谷が戻らない');
assert.equal(await steps(),0,'26 山谷を変えるあいだに原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash26,'26 山谷を変えるあいだにハッシュが動いた');
/* ⑤確定＝2手がまとめて入る。revision は1回だけ増える。 */
await click('confirm');
assert.equal(await steps(),2,'26 複合確定で2手にならない｜'+(await status()));
assert.deepEqual(await ev("freeFoldDebug.state.recipe.steps.map(s=>s.op+s.kind)"),['creaseV','foldV'],'26 原本が 折り目→折り の2手でない');
assert.equal(await ev('freeFoldDebug.state.revision'),rev26+1,'26 複合確定で revision が1回より多く増えた');
assert.equal(await ev('freeFoldDebug.staged'),null,'26 確定後も派生状態が残っている');
assert.deepEqual(await ev('freeFoldDebug.state.cache.bonds.map(b=>b.kind)'),['hinge'],'26 折ったのに折り目の結びのまま');
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'26 保存した原本を再生すると別の紙になる');
const file26=await saveAndWait('download26');
/* ⑥巻き戻しは**通常の2手単位**＝1回目で「折り目だけ」の平らな紙に戻る（画素でも見る）。 */
const h26=await ev('freeFoldDebug.state.cache.hash');
await click('undo');
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['crease'],'26 1回の巻き戻しで折り目だけに戻らない');
assert.equal(await ev('freeFoldDebug.state.cache.faces.every(f=>f.layer===0)'),true,'26 折り目だけの紙が平らでない');
assert.deepEqual(await ev('freeFoldDebug.state.cache.bonds.map(b=>b.kind)'),['crease'],'26 折り目だけの紙の結びがヒンジのまま');
await click('undo');assert.equal(await steps(),0,'26 2回目の巻き戻しができない');
await click('redo');await click('redo');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h26,'26 やり直し2回でハッシュが戻らない');
await click('undo');await click('undo');assert.equal(await steps(),0,'26 片づけで巻き戻せない');
/* ⑦取消＝派生も候補も消え、正式な状態は不変。 */
const redo26b=await ev('freeFoldDebug.state.redoStack.length');
await grabAt([-.9,-.5]);for(const p of [[0,-.5],[.9,-.5]])await carryTo(p);await dropAt([.9,-.5]);
await click('creaseFold');
assert.equal(await ev('!!freeFoldDebug.staged'),true,'26 2度目の派生ができない');
await click('cancel');
assert.equal(await ev('freeFoldDebug.staged'),null,'26 取消で派生が消えない');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'26 取消で候補が消えない');
assert.equal(await steps(),0,'26 取消で原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash26,'26 取消でハッシュが動いた');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),redo26b,'26 取消で redoStack が動いた');
/* ⑧折り目だけの確定は今までどおりできる。 */
await grabAt([-.9,.5]);for(const p of [[0,.5],[.9,.5]])await carryTo(p);await dropAt([.9,.5]);
await click('confirm');
assert.equal(await steps(),1,'26 折り目だけの確定ができなくなっている｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['crease'],'26 折り目だけの手になっていない');
await click('undo');assert.equal(await steps(),0,'26 片づけで巻き戻せない');
await click('lineMode');
assert.equal(await ev('freeFoldDebug.lineMode'),false,'26 線モードから戻れない');



mark('27 🫱 S2: opening a folded spine from the screen (H1で背を選ぶ→開く→側を指す)');
/* 🫱 S2＝つぶし折りの手前。engine は S1 で揃っているので、画面が渡すのは
   「H1で凍結した背」と「紙の上で指した点」の2つだけ＝折線も動く紙も山谷も engine が決める。 */
assert.equal(await steps(),0,'27 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
assert.equal(await ev("document.getElementById('openHinge').hidden"),true,'27 背を選ぶ前からボタンが出ている');
assert.equal(await ev("document.querySelector('.bar.top').getBoundingClientRect().bottom"),barTopBottom,
 '27 ボタンを足したらバーが高くなった（紙の端が押せなくなる）');
/* ①2層のフラップを作る＝右のふちを左のふちへ（半分折り）。 */
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);await click('confirm');
assert.equal(await steps(),1,'27 半分折りが入らない｜'+(await status()));
const rec27=await recipeText(),rev27=await ev('freeFoldDebug.state.revision'),hash27=await ev('freeFoldDebug.state.cache.hash');
/* ②H1の既存操作で背を選ぶ＝そこで初めてボタンが出る（ふだんはバーの高さを変えない）。 */
await grabAt([0,0]);await dropAt([0,0]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','27 背を選べない｜'+(await status()));
assert.equal(await ev("document.getElementById('openHinge').hidden"),false,'27 背を選んでもボタンが出ない');
assert.equal(await disabled('openHinge'),false,'27 ボタンが押せない');
/* ③ボタン＝「開く側を指してください」。ここまで原本は1ミリも動かない。 */
await click('openHinge');
assert.equal(await ev('freeFoldDebug.openMode'),true,'27 開くしぐさに入らない');
assert.equal((await status()).includes('開きたい側の紙を、画面で指してください'),true,'27 案内が違う｜'+(await status()));
assert.equal(await recipeText(),rec27,'27 ボタンを押しただけで原本が動いた');
/* ④紙の上を指す＝engine が動く紙と山谷を決め、既存のゴーストがそのまま出る。 */
await grabAt([-.5,0]);await dropAt([-.5,0]);
const g27=(await frame()).ghost||null;
assert.equal(g27&&g27.angle,180,'27 開くゴーストが出ない｜'+(await status()));
assert.equal(g27.from,'open','27 ゴーストの出どころが「背を開く」でない');
assert.equal(await ev('freeFoldDebug.state.pending.reference.faceId'),'paper/s1.cut','27 動く紙が上の1枚でない');
assert.equal(await ev('freeFoldDebug.state.pending.kind'),'V','27 山谷を engine が決めていない');
assert.equal(await ev('freeFoldDebug.state.pending.inputMode'),'open','27 開く提案の印がない');
assert.equal(await ev('freeFoldDebug.state.pending.openHinge.intervalId'),'hinge:s1#1','27 どの背を開くか残っていない');
assert.deepEqual(await ev('freeFoldDebug.state.pending.candidates.map(c=>c.faceId)'),['paper/s1.cut'],'27 動く側が単一面でない');
assert.equal(await ev('freeFoldDebug.layerPick'),null,'27 開く手に「上からN枚」を出している（動く紙は engine が決めている）');
assert.equal(await disabled('confirm'),false,'27 開く候補が確定できない');
assert.equal(await recipeText(),rec27,'27 提案しただけで原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash27,'27 提案しただけで cache.hash が動いた');
assert.equal(await ev('freeFoldDebug.state.revision'),rev27,'27 提案しただけで revision が動いた');
const shot27=await shot('freefold-open-hinge.png');
/* ⑤山谷は engine が決めた値のまま＝画面から変えられない。 */
await click('kind');
assert.equal(await ev('freeFoldDebug.state.pending.kind'),'V','27 画面から山谷を変えられてしまう');
assert.equal((await status()).includes('どちらの紙を開くかで決まります'),true,'27 山谷を断る案内が出ない｜'+(await status()));
/* ⑥0°・90°・180°で既存のプレビューが通る（動く面は1枚・裂けない）。 */
assert.deepEqual(await ev('[0,90,180].map(a=>FreeFoldEngine.preview(freeFoldDebug.state,a).movingIds.length)'),[1,1,1],
 '27 0/90/180 で動く面が1枚でない');
/* ⑦カメラを回して・ズームしても、同じ背と同じ指示点へ逆変換できる。 */
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=.6;c.pitch=1;c.zoom=1.4;return true})()');
await grabAt([-.5,0]);await dropAt([-.5,0]);
assert.equal(await ev('freeFoldDebug.state.pending.openHinge.intervalId'),'hinge:s1#1','27 カメラを変えたら別の背を開いた');
assert.equal(await ev('freeFoldDebug.state.pending.reference.faceId'),'paper/s1.cut','27 カメラを変えたら別の紙が動いた');
const op27=await ev('freeFoldDebug.openPoint');
assert.equal(Math.hypot(op27[0]+.5,op27[1])<.03,true,'27 指した点が紙面へ逆変換されていない: '+JSON.stringify(op27));
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
/* ⑧確定＝ふつうの fold が1手。紙は平らに開き、両面とも表になる。 */
await click('confirm');
assert.equal(await steps(),2,'27 開く手が確定できない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['fold','fold'],'27 新しい op が増えている');
assert.deepEqual(await ev('Object.keys(freeFoldDebug.state.recipe.steps[1]).sort()'),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'27 手に余計な項目がある');
assert.equal(await faces(),2,'27 開いたあとの面が2枚でない');
/* 開いた＝もうどこにも重なりが無い（層の番号は積み直しの結果なので、重なりの有無で見る）。 */
assert.deepEqual(await ev('[[-.5,0],[.5,0],[-.5,.6],[.5,-.6]].map(p=>FreeFoldEngine.stackAt(freeFoldDebug.state,p).length)'),
 [1,1,1,1],'27 開いたのに紙が重なったまま');
assert.equal(await ev('freeFoldDebug.state.cache.faces.every(f=>FreeFoldEngine.detXf(f.xf)>0)'),true,'27 開いたのに裏のままの紙がある');
/* 🔓 2026-09-15 本人判断で変更：0°に開いた背は折り目（crease・由来の手を保ち openedBy＝開いた手）。畳まれたままの背は hinge。種類は両側の置かれ方から決まる。 */
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state,last=st.recipe.steps[st.recipe.steps.length-1].id,f=id=>st.cache.faces.find(v=>v.faceId===id);return st.cache.bonds.every(b=>{const same=f(b.faceIds[0]).xf.every((v,i)=>Math.abs(v-f(b.faceIds[1]).xf[i])<1e-9);return b.kind===(same?'crease':'hinge')&&(same?b.openedBy===last&&b.stepId!==last:!b.openedBy)})})()`),true,'27 結びの種類が置かれ方と違う／由来が消えた');
assert.equal(await ev('freeFoldDebug.state.cache.bonds.filter(b=>b.kind==="crease").length'),1,'27 開いた背の数が違う');
assert.equal((await frame()).hingePick,null,'27 確定しても背の選択が残っている');
assert.equal(await ev('freeFoldDebug.openMode'),false,'27 確定しても開くしぐさが残っている');
assert.equal(await ev("document.getElementById('openHinge').hidden"),true,'27 確定してもボタンが残っている');
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'27 保存した原本を再生すると別の紙になる');
const file27=await saveAndWait('download27');
/* ⑨巻き戻し・やり直しは、ふつうの1手として動く。 */
const h27=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),1,'27 巻き戻せない');
assert.deepEqual(await ev('[[-.5,0],[.5,0]].map(p=>FreeFoldEngine.stackAt(freeFoldDebug.state,p).length)'),[2,0],
 '27 巻き戻しで折った紙（2層のフラップ）に戻らない');
await click('redo');assert.equal(await ev('freeFoldDebug.state.cache.hash'),h27,'27 やり直しでハッシュが戻らない');
/* ⑩取消＝ゴースト・背の選択・開く側・案内がすべて消え、正式な状態は動かない。 */
await click('undo');assert.equal(await steps(),1,'27 片づけで巻き戻せない');
await grabAt([0,0]);await dropAt([0,0]);await click('openHinge');
await grabAt([-.5,0]);await dropAt([-.5,0]);
assert.equal(((await frame()).ghost||{}).from,'open','27 2度目の提案ができない｜'+(await status()));
await click('cancel');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'27 取消で候補が消えない');
assert.equal(await ev('freeFoldDebug.geometry'),null,'27 取消でゴーストが消えない');
assert.equal((await frame()).hingePick,null,'27 取消で背の選択が消えない');
assert.equal(await ev('freeFoldDebug.openMode'),false,'27 取消で開くしぐさが消えない');
assert.equal(await ev('freeFoldDebug.openPoint'),null,'27 取消で開く側が消えない');
assert.equal(await ev("document.getElementById('openHinge').hidden"),true,'27 取消でボタンが消えない');
assert.equal(await steps(),1,'27 取消で原本が動いた');
assert.equal((await status()).includes('取り消しました'),true,'27 取消の案内が出ない｜'+(await status()));
/* ⑪★2026-09-14（複数面）＝フラップの角を上から1枚だけ折った紙では、折った角は背でフラップとつながっている
   ＝engine が「一緒に動く紙」に入れて、フラップと角の2枚いっしょに開ける（engine の Z5 と同じ形）。 */
await grabAt([-1,-1]);await carryTo([-.4,-.4]);await dropAt([-.4,-.4]);await click('confirm');
assert.equal(await steps(),2,'27 フラップの角折りが入らない｜'+(await status()));
await grabAt([0,.5]);await dropAt([0,.5]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','27 背を選び直せない｜'+(await status()));
await click('openHinge');
const rec27b=await recipeText(),hash27b=await ev('freeFoldDebug.state.cache.hash');
await grabAt([-.6,-.6]);await dropAt([-.6,-.6]);
assert.equal(((await frame()).ghost||{}).from,'open','27 角ごと開くゴーストが出ない｜'+(await status()));
assert.equal(await ev('freeFoldDebug.state.pending.candidates.length'),2,'27 フラップと角の2枚いっしょになっていない');
assert.equal((await status()).includes('2枚いっしょ'),true,'27 2枚いっしょの案内が出ない｜'+(await status()));
assert.equal(await recipeText(),rec27b,'27 提案しただけで原本が動いた');
await click('cancel');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'27 取消で候補が残った');
/* ⑫断るもの＝角を上から2枚で折ると、相手側の角も上に乗る（結びでつながっていない紙が上にある）＝既存の①の理由をそのまま出し、
   背の選択と開くしぐさは残す（指し直せる）。 */
await click('undo');assert.equal(await steps(),1,'27 角折りを戻せない');
await grabAt([-1,-1]);await carryTo([-.4,-.4]);await dropAt([-.4,-.4]);
await ev(`[...document.querySelectorAll('#stackPick .pick')].find(b=>b.dataset.n==='2').click()`);
await click('confirm');
assert.equal(await steps(),2,'27 上から2枚の角折りが入らない｜'+(await status()));
await grabAt([0,.5]);await dropAt([0,.5]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','27 背を選び直せない｜'+(await status()));
await click('openHinge');
const rec27c=await recipeText(),hash27c=await ev('freeFoldDebug.state.cache.hash');
await grabAt([-.6,-.6]);await dropAt([-.6,-.6]);
assert.equal(/上に乗っている紙があります|下に敷かれている紙があります/.test(await status()),true,'27 ①の断る理由が出ない｜'+(await status()));
assert.equal(await ev('freeFoldDebug.geometry'),null,'27 断ったのにゴーストが出た');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'27 断ったのに候補が残った');
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','27 断ったら背の選択まで消えた');
assert.equal(await ev('freeFoldDebug.openMode'),true,'27 断ったら開くしぐさまで消えた（指し直せない）');
await grabAt([-.5,-.75]);await dropAt([-.5,-.75]);
assert.equal(/上に乗っている紙があります|下に敷かれている紙があります/.test(await status()),true,'27 別の場所でも①の理由が出ない｜'+(await status()));
assert.equal(await recipeText(),rec27c,'27 断ったのに原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash27c,'27 断ったのに cache.hash が動いた');
/* 片づけ。 */
await click('undo');await click('undo');
assert.equal(await steps(),0,'27 片づけで巻き戻せない');
assert.equal((await frame()).hingePick,null,'27 片づけで背の選択が残った');



mark('28 🥟 S3: fold into a staged state, then open the spine that appeared there');
/* 🥟 S3＝つぶし折りの最小形。1手目を**正式に確定せず**派生状態へ入れ、そこに新しくできた背を
   ユーザーが選んで開く。原本にはふつうの fold が2手だけ入る（新しい op は作らない）。 */
assert.equal(await steps(),0,'28 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
assert.equal(await ev("document.getElementById('squash').hidden"),true,'28 候補が無いのにボタンが出ている');
assert.equal(await ev("document.querySelector('.bar.top').getBoundingClientRect().bottom"),barTopBottom,
 '28 ボタンを足したらバーが高くなった（紙の端が押せなくなる）');
const rec28=await recipeText(),rev28=await ev('freeFoldDebug.state.revision'),hash28=await ev('freeFoldDebug.state.cache.hash');
/* ①ふつうの折りの候補＝山折りで、右のふちを左のふちへ（半分折り）。 */
await click('kind');
assert.equal(await ev('freeFoldDebug.kind'),'M','28 山折りに切りかわらない');
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);
assert.equal((await frame()).ghost.angle,180,'28 折りのゴーストが出ない｜'+(await status()));
assert.equal(await ev("document.getElementById('squash').hidden"),false,'28 折りの候補が出ても「続けてつぶす」が出ない');
/* ②「続けてつぶす」＝1手目を派生状態へ。正式な原本は1ミリも動かない。 */
await click('squash');
assert.equal(await ev('!!freeFoldDebug.squash'),true,'28 派生状態ができていない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.squash.recipe.steps.map(s=>s.op+s.kind)'),['foldM'],'28 派生に1手目が入っていない');
assert.equal(await ev('freeFoldDebug.squash.staged.mode'),'squash','28 派生の印が squash でない');
assert.equal(await steps(),0,'28 正式な原本に1手目が入ってしまった');
assert.equal(await recipeText(),rec28,'28 派生を作っただけで原本が動いた');
assert.equal(await ev('freeFoldDebug.state.revision'),rev28,'28 派生を作っただけで revision が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash28,'28 派生を作っただけで cache.hash が動いた');
assert.equal(await ev('freeFoldDebug.state.squash'),undefined,'28 派生が正式な state に入っている');
assert.equal(await ev("document.getElementById('squash').hidden"),true,'28 派生中も「続けてつぶす」が出たまま');
assert.equal(await disabled('confirm'),true,'28 背を選ぶ前に確定できる');
/* 見せている紙は派生＝右半分は空になっている（画素で見る）。 */
assert.equal(await emptyAt([.6,0]),true,'28 派生の紙が画面に出ていない（折った先が描かれていない）');
const shot28a=await shot('freefold-squash-staged.png');
/* ③派生のあいだは山谷を変えられない（もう1手目が入っているので、変えると食い違う）。 */
await click('kind');
assert.equal((await status()).includes('「続けてつぶす」のあいだは山谷を変えられません'),true,'28 派生中に山谷を変えられる｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.squash.recipe.steps.map(s=>s.kind)'),['M'],'28 派生の1手目の山谷が変わった');
/* ④派生の上に新しくできた背を、ユーザーが選ぶ（engine は自動で選ばない）。 */
await grabAt([0,0]);await dropAt([0,0]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','28 派生にできた背を選べない｜'+(await status()));
assert.deepEqual((await frame()).hingePick.faceIds,['paper/s1.keep','paper/s1.cut'],'28 選んだ背の両側が違う');
assert.equal(await ev("document.getElementById('openHinge').hidden"),false,'28 背を選んでも「背を開く」が出ない');
/* ⑤開く側を指す＝2手目は proposeOpen が作る（1手目のあとの faceId から解ける）。 */
await click('openHinge');
await grabAt([-.5,0]);await dropAt([-.5,0]);
const g28=(await frame()).ghost||null;
assert.equal(g28&&g28.from,'open','28 開くゴーストが出ない｜'+(await status()));
assert.equal(await ev('freeFoldDebug.squash.pending.inputMode'),'open','28 2手目が「背を開く」提案でない');
assert.equal(await ev('freeFoldDebug.squash.pending.reference.faceId'),'paper/s1.keep','28 2手目の基準面が1手目のあとの faceId でない');
assert.equal(await ev('freeFoldDebug.squash.pending.kind'),'V','28 2手目の山谷を engine が決めていない');
assert.equal(await ev('freeFoldDebug.state.pending.kind'),'M','28 1手目の山谷が書きかわった');
assert.deepEqual(await ev('[0,90,180].map(a=>FreeFoldEngine.preview(freeFoldDebug.squash,a).movingIds.length)'),[1,1,1],
 '28 0/90/180 で動く面が1枚でない');
assert.equal(await disabled('confirm'),false,'28 2手目まで決まっても確定できない');
assert.equal(await recipeText(),rec28,'28 2手目を提案しただけで原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash28,'28 2手目を提案しただけで cache.hash が動いた');
const shot28b=await shot('freefold-squash-open.png');
/* ⑥確定＝2手がまとめて入る。山谷はそれぞれのまま（そろえない）。revision は1回だけ増える。 */
await click('confirm');
assert.equal(await steps(),2,'28 複合確定で2手にならない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['fold','fold'],'28 新しい op が増えている');
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.kind)'),['M','V'],'28 2手の山谷を勝手にそろえている');
assert.equal(await ev('freeFoldDebug.state.revision'),rev28+1,'28 revision が1回より多く増えた');
assert.equal(await ev('freeFoldDebug.squash'),null,'28 確定後も派生が残っている');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'28 確定後も候補が残っている');
assert.equal((await frame()).hingePick,null,'28 確定しても背の選択が残っている');
assert.equal(await ev("document.getElementById('openHinge').hidden"),true,'28 確定しても「背を開く」が残っている');
assert.equal(await ev("document.getElementById('squash').hidden"),true,'28 確定しても「続けてつぶす」が残っている');
assert.deepEqual(await ev('[[-.5,0],[.5,0]].map(p=>FreeFoldEngine.stackAt(freeFoldDebug.state,p).length)'),[1,1],
 '28 開いたのに紙が重なったまま');
assert.equal(await ev('freeFoldDebug.state.cache.faces.every(f=>FreeFoldEngine.detXf(f.xf)<0)'),true,
 '28 山折りしてから開いたのに、表のままの紙がある');
/* 🔓 2026-09-15 本人判断で変更：0°に開いた背は折り目（crease・由来の手を保ち openedBy＝開いた手）。畳まれたままの背は hinge。種類は両側の置かれ方から決まる。 */
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state,last=st.recipe.steps[st.recipe.steps.length-1].id,f=id=>st.cache.faces.find(v=>v.faceId===id);return st.cache.bonds.every(b=>{const same=f(b.faceIds[0]).xf.every((v,i)=>Math.abs(v-f(b.faceIds[1]).xf[i])<1e-9);return b.kind===(same?'crease':'hinge')&&(same?b.openedBy===last&&b.stepId!==last:!b.openedBy)})})()`),true,'28 結びの種類が置かれ方と違う／由来が消えた');
assert.equal(await ev('freeFoldDebug.state.cache.bonds.filter(b=>b.kind==="crease").length'),1,'28 開いた背の数が違う');
/* 保存の中身は**ふつうの fold 2手だけ**＝派生の印も背のIDも混じらない。 */
const rec28done=await recipeText();
for(const w of['staged','squash','hinge','intervalId'])
 assert.equal(rec28done.includes(w),false,'28 保存する原本に '+w+' が漏れた');
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'28 保存した原本を再生すると別の紙になる');
const file28=await saveAndWait('download28');
/* ⑦巻き戻しは**通常の1手単位**＝1回戻すと1手目の折りだけが残る。やり直し2回でハッシュが戻る。 */
const h28=await ev('freeFoldDebug.state.cache.hash');
await click('undo');
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op+s.kind)'),['foldM'],'28 1回の巻き戻しで1手目だけに戻らない');
assert.deepEqual(await ev('[[-.5,0],[.5,0]].map(p=>FreeFoldEngine.stackAt(freeFoldDebug.state,p).length)'),[2,0],
 '28 巻き戻しで折った紙（2層）に戻らない');
await click('undo');assert.equal(await steps(),0,'28 2回目の巻き戻しができない');
await click('redo');await click('redo');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h28,'28 やり直し2回でハッシュが戻らない');
assert.equal(await steps(),2,'28 やり直しで2手に戻らない');
await click('undo');await click('undo');assert.equal(await steps(),0,'28 片づけで巻き戻せない');
/* ⑧取消＝派生も候補も背の選択も消え、正式な状態は動かない。 */
const redo28=await ev('freeFoldDebug.state.redoStack.length');
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);
await click('squash');
assert.equal(await ev('!!freeFoldDebug.squash'),true,'28 2度目の派生ができない｜'+(await status()));
await grabAt([0,0]);await dropAt([0,0]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','28 2度目に背を選べない');
await click('cancel');
assert.equal(await ev('freeFoldDebug.squash'),null,'28 取消で派生が消えない');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'28 取消で候補が消えない');
assert.equal(await ev('freeFoldDebug.geometry'),null,'28 取消でゴーストが消えない');
assert.equal((await frame()).hingePick,null,'28 取消で背の選択が消えない');
assert.equal(await steps(),0,'28 取消で原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash28,'28 取消でハッシュが動いた');
assert.equal(await ev('freeFoldDebug.state.redoStack.length'),redo28,'28 取消で redoStack が動いた');
/* 片づけ＝山谷を谷へ戻す。 */
await click('kind');
assert.equal(await ev('freeFoldDebug.kind'),'V','28 山谷が戻らない');



mark('29 🫖 S4: opening a single face on an existing hinge — the number of layers does not decide');
/* 🫖 S4＝「既存ヒンジを軸に、単一面を丸ごと開く」。**層の枚数・輪・degree-4・結びの本数では断らない**。
   断るのは既存の判定（foldableSet の層の規則と結びの規則・recordable・replay・0/90/180）だけ。
   ⛔一般の途中衝突（紙どうしの貫通・紙厚）は保証しない。 */
assert.equal(await steps(),0,'29 きれいな紙から始まっていない');
await ev('(()=>{const c=freeFoldDebug.camera;c.yaw=0;c.pitch=.55;c.zoom=1;return true})()');
/* ①半分折り（2層）→ ②上から1枚の角折り＝**3層の袋**（フラップ＋その下の2枚）。 */
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);await click('confirm');
assert.equal(await steps(),1,'29 半分折りが入らない｜'+(await status()));
await grabAt([-1,1]);await carryTo([-.6,.6]);await carryTo([-.3,.35]);await dropAt([-.3,.35]);
await click('confirm');
assert.equal(await steps(),2,'29 角折りが入らない｜'+(await status()));
assert.equal(await faces(),3,'29 面が3枚にならない');
assert.deepEqual(await ev('FreeFoldEngine.stackAt(freeFoldDebug.state,[-.549,.549]).map(v=>v.faceId)'),
 ['paper/s1.cut/s2.cut','paper/s1.cut/s2.keep','paper/s1.keep'],'29 フラップの所が3層になっていない');
const rec29=await recipeText(),hash29=await ev('freeFoldDebug.state.cache.hash'),rev29=await ev('freeFoldDebug.state.revision');
/* ③★2026-09-14（複数面）＝半分折りの背を選び、角を折ったフラップを指す。折った角は背でフラップとつながっている
   ＝engine が一緒に動く紙に入れて、フラップと角の2枚いっしょに開ける（以前は「上に乗っている紙」で断っていた形）。 */
await grabAt([0,-.5]);await dropAt([0,-.5]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s1#1','29 半分折りの背を選べない｜'+(await status()));
await click('openHinge');
await grabAt([-.5,-.5]);await dropAt([-.5,-.5]);
assert.equal(((await frame()).ghost||{}).from,'open','29 角ごと開くゴーストが出ない｜'+(await status()));
assert.deepEqual((await ev('freeFoldDebug.state.pending.candidates.map(c=>c.faceId)')).sort(),['paper/s1.cut/s2.cut','paper/s1.cut/s2.keep'],'29 フラップと角の2枚いっしょになっていない');
assert.equal(await recipeText(),rec29,'29 提案しただけで原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash29,'29 提案しただけで cache.hash が動いた');
assert.equal(await ev('freeFoldDebug.state.revision'),rev29,'29 提案しただけで revision が動いた');
await click('cancel');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'29 取消で候補が残った');
assert.equal(await ev('freeFoldDebug.openMode'),false,'29 取消で開くしぐさが残った');
/* ④フラップの背を選び直す＝**3層でも開ける**（層の枚数では断らない）。 */
await grabAt([-.674,.649]);await dropAt([-.674,.649]);
assert.equal(((await frame()).hingePick||{}).intervalId,'hinge:s2#1','29 フラップの背を選べない｜'+(await status()));
await click('openHinge');
await grabAt([-.549,.549]);await dropAt([-.549,.549]);
const g29=(await frame()).ghost||null;
assert.equal(g29&&g29.from,'open','29 3層の袋でゴーストが出ない｜'+(await status()));
assert.equal(await ev('freeFoldDebug.state.pending.reference.faceId'),'paper/s1.cut/s2.cut','29 動く面が指した所の最上面でない');
assert.equal(await ev('freeFoldDebug.state.pending.kind'),'V','29 山谷を engine が決めていない');
assert.deepEqual(await ev('freeFoldDebug.state.pending.candidates.map(c=>c.faceId)'),['paper/s1.cut/s2.cut'],'29 動く側が単一面でない');
assert.deepEqual(await ev('[0,90,180].map(a=>FreeFoldEngine.preview(freeFoldDebug.state,a).movingIds.length)'),[1,1,1],
 '29 0/90/180 で動く面が1枚でない');
assert.equal(await recipeText(),rec29,'29 提案しただけで原本が動いた');
const shot29=await shot('freefold-open-3layer.png');
/* ⑤取消＝ゴースト・候補・背の選択・開くしぐさが消え、正式な状態は動かない。 */
await click('cancel');
assert.equal(await ev('freeFoldDebug.state.pending'),null,'29 取消で候補が消えない');
assert.equal(await ev('freeFoldDebug.geometry'),null,'29 取消でゴーストが消えない');
assert.equal((await frame()).hingePick,null,'29 取消で背の選択が消えない');
assert.equal(await ev('freeFoldDebug.openMode'),false,'29 取消で開くしぐさが消えない');
assert.equal(await recipeText(),rec29,'29 取消で原本が動いた');
/* ⑥もう一度ひらいて確定＝ふつうの fold が1手。保存 → 読み直しても同じ紙。 */
await grabAt([-.674,.649]);await dropAt([-.674,.649]);
await click('openHinge');
await grabAt([-.549,.549]);await dropAt([-.549,.549]);
await click('confirm');
assert.equal(await steps(),3,'29 開く手が確定できない｜'+(await status()));
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['fold','fold','fold'],'29 新しい op が増えている');
assert.equal(await ev('freeFoldDebug.state.recipe.steps[2].targets.length'),1,'29 開く手の対象が1面でない');
assert.equal(await ev('freeFoldDebug.state.recipe.steps[2].line.every(p=>p.every(v=>Math.abs(v)<=1))'),true,
 '29 原本の折線が原紙の外（±1）に出た');
/* 🔓 2026-09-15 本人判断で変更：0°に開いた背は折り目（crease・由来の手を保ち openedBy＝開いた手）。畳まれたままの背は hinge。種類は両側の置かれ方から決まる。 */
assert.equal(await ev(`(()=>{const st=freeFoldDebug.state,last=st.recipe.steps[st.recipe.steps.length-1].id,f=id=>st.cache.faces.find(v=>v.faceId===id);return st.cache.bonds.every(b=>{const same=f(b.faceIds[0]).xf.every((v,i)=>Math.abs(v-f(b.faceIds[1]).xf[i])<1e-9);return b.kind===(same?'crease':'hinge')&&(same?b.openedBy===last&&b.stepId!==last:!b.openedBy)})})()`),true,'29 結びの種類が置かれ方と違う／由来が消えた');
assert.equal(await ev('freeFoldDebug.state.cache.bonds.filter(b=>b.kind==="crease").length'),1,'29 開いた背の数が違う');
assert.equal((await frame()).hingePick,null,'29 確定しても背の選択が残っている');
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'29 保存した原本を再生すると別の紙になる');
const file29=await saveAndWait('download29');
const json29=await fs.readFile(path.join(downloads,file29),'utf8');
assert.equal(await ev(`FreeFoldEngine.replay(JSON.parse(${JSON.stringify(json29)})).hash===freeFoldDebug.state.cache.hash`),
 true,'29 保存したJSONを読み直すと別の紙になる');
/* ⑦巻き戻し・やり直しはふつうの1手として動く。 */
const h29=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),2,'29 巻き戻せない');
assert.deepEqual(await ev('FreeFoldEngine.stackAt(freeFoldDebug.state,[-.549,.549]).length'),3,'29 巻き戻しで3層の袋に戻らない');
await click('redo');assert.equal(await ev('freeFoldDebug.state.cache.hash'),h29,'29 やり直しでハッシュが戻らない');
/* 片づけ。 */
await click('undo');await click('undo');await click('undo');
assert.equal(await steps(),0,'29 片づけで巻き戻せない');


mark('30 🚪 unknown op: loading a recipe with an unknown op is refused, and the page keeps its state');
/* 🚪30 知らない op の読込は、実ブラウザでもはっきり断られる。断っても画面の紙は1ミリも動かない。
   ⚠以前は `op` を見るのが crease と flip の2か所だけで、知らない op は**ぜんぶ fold として素通し**
     していた（＝未対応の読み手が黙って別の紙を作る）。ここで実機に固定する。
   🚨「必須項目が足りないから落ちた」では意味がないので、**正常な fold の全フィールドを付けたまま
     op だけ差しかえた原本**で見る。同じ原本の op を fold に戻すと通ることも、続けて確かめる。 */
/* 何か1手入れて、undo で redoStack にも1手積む＝状態を持たせる（mark29 と同じ半分折り）。 */
await grabAt([1,.3]);await carryTo([0,.3]);await carryTo([-.99,.3]);await dropAt([-.99,.3]);await click('confirm');
const s30=await ev('freeFoldDebug.state.recipe.steps.length');
assert.equal(s30,1,'30 土台の1手が入っていない');
await click('undo');
const before30=await ev(`(()=>{const st=freeFoldDebug.state;return JSON.stringify({
 rec:st.recipe,rev:st.revision,hash:st.cache.hash,pend:st.pending,redo:st.redoStack,
 cRev:st.cacheRevision,com:st.committed})})()`);
const good30=await ev('JSON.stringify(freeFoldDebug.state.redoStack[0])');
/* ① 正常な fold の全フィールドを持った1手＝これは読める */
assert.equal(await ev(`(()=>{const st=JSON.parse(${JSON.stringify(good30)});
 const r=JSON.parse(JSON.stringify(freeFoldDebug.state.recipe));r.steps=[st];
 return FreeFoldEngine.replay(r).faces.length})()`),2,'30 正常な原本が読めない');
/* ② op だけ知らない値にすると断る（項目は1つも欠けていない） */
for(const bad of['squashFold','squash','FOLD','']){
 const msg=await ev(`(()=>{const st=JSON.parse(${JSON.stringify(good30)});st.op=${JSON.stringify(bad)};
  const r=JSON.parse(JSON.stringify(freeFoldDebug.state.recipe));r.steps=[st];
  try{FreeFoldEngine.replay(r);return 'PASSED'}catch(e){return e.message}})()`);
 assert.match(msg,/知らない操作です/,`30 op:'${bad}' の読込が断られない: `+msg)}
/* ③ op の欠落も断る */
{const msg=await ev(`(()=>{const st=JSON.parse(${JSON.stringify(good30)});delete st.op;
  const r=JSON.parse(JSON.stringify(freeFoldDebug.state.recipe));r.steps=[st];
  try{FreeFoldEngine.replay(r);return 'PASSED'}catch(e){return e.message}})()`);
 assert.match(msg,/op がありません/,'30 op 欠落の読込が断られない: '+msg)}
/* ④ やり直し（redo）も同じ門を通る。redoStack を書きかえて redo を呼ぶ。 */
{const msg=await ev(`(()=>{freeFoldDebug.state.redoStack[0].op='squashFold';
  try{FreeFoldEngine.redo(freeFoldDebug.state);return 'PASSED'}catch(e){return e.message}})()`);
 assert.match(msg,/知らない操作です/,'30 未知opのやり直しが断られない: '+msg)}
/* ⑤ 断ったあと、紙・原本・revision・pending・redoStack が1ミリも動いていない
      （redoStack の op は上で書きかえたので、そこだけ戻してから突き合わせる）。 */
const after30=await ev(`(()=>{freeFoldDebug.state.redoStack[0].op='fold';const st=freeFoldDebug.state;
 return JSON.stringify({rec:st.recipe,rev:st.revision,hash:st.cache.hash,pend:st.pending,
  redo:st.redoStack,cRev:st.cacheRevision,com:st.committed})})()`);
assert.equal(after30,before30,'30 読込・やり直しに失敗したのに画面の状態が動いた');
/* ⑥ 門は正しい手を止めていない＝そのままやり直せる。 */
await click('redo');
assert.equal(await steps(),1,'30 op を戻してもやり直せない');
assert.equal(await ev('freeFoldDebug.state.cache.faces.length'),2,'30 やり直した紙が2枚でない');
await click('undo');
assert.equal(await steps(),0,'30 片づけで巻き戻せない');
const shot30=await shot('freefold-unknown-op.png');

/* ============ mark 31（2026-09-13・本人が画像で指摘）🔄 表と裏で操作を変えない ============
   症状は2つ。どちらも flip の写しかたを snap 側が知らなかったせいで、裏だけ道が消えていた。
   ①**裏返すと外周の辺がつかめない**＝`isFlat` が xf を恒等とだけ比べていた（flip は xf に鏡映を合成する）
     → pointerdown で source が無い＝カメラ回転になり、辺折りに入れなかった。
   ②**裏返すと通常の角ドラッグが対角へ吸いつかない**＝`diagonalOf` が手数を数え、flip も1手だった
     → 正確な半分折りには「角を角へ合わせる」を押すしかなかった。
   ここは**表でやったのと同じ手を裏でもやり、同じ結果になること**だけを見る。
   ⛔吸着の距離（26px入る/44px離れる）・隣の角を候補にしない規則・折り目/ふち/背への吸着は無変更。 */
mark('31 🔄 the same gesture on both sides: corner drag snaps to the diagonal, rim edges can be grabbed');
assert.equal(await steps(),0,'31 片づけが済んでいない');
if(await ev('freeFoldDebug.op')!=='fold')await click('op');
assert.equal(await ev('freeFoldDebug.op'),'fold','31 通常の「角を折る」で始まっていない');
/* 表と裏で同じことをする1本道。返すのは「そのとき画面が何と言ったか」。 */
const diagDrag=async label=>{
 await grabAt([1,-1]);
 assert.equal(await ev("freeFoldDebug.dragSession.source&&freeFoldDebug.dragSession.source.type"),'corner',
  label+' 角をつかめていない');
 await carryTo([.3,-.3]);
 const away=await status();
 assert.match(away,/つかんだ角をここへ折ります/,label+' 途中が通常の角折りになっていない: '+away);
 await carryTo([-1,1]);
 const on=await status(),f=await frame();
 assert.match(on,/対角を合わせて半分折り/,label+' 対角へ吸いつかない（ボタンを押さないと半分折りにできない）: '+on);
 assert.equal(f.ghost.halfFold,true,label+' 対角なのに半分折りになっていない');
 assert.equal(f.ghost.snapped,true,label+' 対角なのに吸着していない');
 assert.deepEqual(asLine(f.crease),asLine([[-1,-1],[1,1]]),label+' 折線が対角になっていない');
 /* 吸着から離れれば、モードを触らずに通常の角折りへ戻る（44pxで手放す）。 */
 await carryTo([-.5,.5]);
 const off=await status();
 assert.match(off,/つかんだ角をここへ折ります/,label+' 対角から離れても通常の角折りに戻らない: '+off);
 assert.equal((await frame()).ghost.halfFold,false,label+' 離れたのに半分折りのまま');
 await carryTo([-1,1]);await dropAt([-1,1]);
 assert.match(await status(),/確定してください/,label+' 離しても候補にならない: '+(await status()));
 await click('confirm');
 assert.equal(await emptyAt([.6,-.6]),true,label+' 折ったのに三角になっていない（紙が残っている）');
 assert.equal(await emptyAt([-.6,.6]),false,label+' 残る側の紙が消えた');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'),2,label+' 面が2枚にならない');
 return on};
/* ① 表：新しい紙のまま、ボタンを押さずに対角合わせ。 */
await diagDrag('31表');
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['fold'],'31表 原本が fold 1手でない');
assert.equal(await ev('freeFoldDebug.op'),'fold','31表 操作モードが勝手に変わった');
const shot31a=await shot('freefold-diag-front.png');
await click('undo');assert.equal(await steps(),0,'31表 巻き戻せない');
/* ② 裏：裏返してから、まったく同じ手。 */
await click('flip');
assert.equal(await ev('FreeFoldSnap.isFlat(freeFoldDebug.state)'),true,'31裏 裏返しただけで紙が平らでなくなった');
await diagDrag('31裏');
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['flip','fold'],'31裏 原本が flip→fold でない');
const shot31b=await shot('freefold-diag-back.png');
/* 保存した原本を再生すると同じ紙＝裏返しをまたいでも記録がずれていない。 */
assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash===freeFoldDebug.state.cache.hash'),
 true,'31裏 保存した原本を再生すると別の紙になる');
const file31=await saveAndWait('download31');
/* undo/redo が2手とも通る。 */
const hash31=await ev('freeFoldDebug.state.cache.hash');
await click('undo');assert.equal(await steps(),1,'31裏 折りを巻き戻せない');
await click('redo');assert.equal(await ev('freeFoldDebug.state.cache.hash'),hash31,'31裏 やり直しでハッシュが戻らない');
await click('undo');await click('undo');assert.equal(await steps(),0,'31裏 片づけで巻き戻せない');
/* ③ 外周の辺つかみ＝表と裏で同じ。裏で source が無いと**カメラ回転**になっていた（それが症状①）。 */
const edgeHalf=async label=>{
 await grabAt([1,.3]);
 assert.equal(await ev('freeFoldDebug.dragSession.kind'),'edge',label+' 外周の辺をつかめない（カメラ回転になっている）');
 await carryTo([-1,.3]);
 const t=await status();
 assert.match(t,/ぴたりと合わせました/,label+' 対辺へ吸いつかない: '+t);
 const f=await frame();
 assert.equal(Math.round(f.ghost.ratio*1000)/1000,.5,label+' 対辺合わせが半分折りになっていない');
 assert.deepEqual(asLine(f.crease),asLine([[0,-1],[0,1]]),label+' 折線が中線になっていない');
 await dropAt([-1,.3]);await click('confirm');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'),2,label+' 辺折りで面が2枚にならない');
 assert.equal(await emptyAt([.6,.6]),true,label+' 半分折りなのに右半分に紙が残っている')};
await edgeHalf('31表辺');
await click('undo');assert.equal(await steps(),0,'31表辺 巻き戻せない');
await click('flip');
await edgeHalf('31裏辺');
assert.deepEqual(await ev('freeFoldDebug.state.recipe.steps.map(s=>s.op)'),['flip','fold'],'31裏辺 原本が flip→fold でない');
await click('undo');await click('undo');assert.equal(await steps(),0,'31裏辺 片づけで巻き戻せない');
/* ④ カメラを回してズームしても同じ（測るのは画面px なので、ここが変われば吸着も変わる）。 */
const cam31=await ev('({...freeFoldDebug.camera})');
await press(await point([1.9,1.9]));await moveTo([880,260]);await release([880,260]);
await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:500,y:400,deltaX:0,deltaY:-180});
const cam31b=await ev('({...freeFoldDebug.camera})');
assert.notEqual(cam31b.yaw,cam31.yaw,'31 カメラが回っていない（検査の意味がない）');
assert.notEqual(cam31b.zoom,cam31.zoom,'31 ズームしていない（検査の意味がない）');
assert.equal(await steps(),0,'31 カメラ操作で紙が動いた');
await click('flip');
await diagDrag('31裏カメラ');
const shot31c=await shot('freefold-diag-back-camera.png');
/* ⑤ 取消でも元どおり＝候補を作って取り消したら、原本もハッシュも1ミリも動かない。 */
await click('undo');await click('undo');assert.equal(await steps(),0,'31 片づけで巻き戻せない');
await click('flip');
const rec31=await recipeText(),h31=await ev('freeFoldDebug.state.cache.hash');
await grabAt([1,-1]);await carryTo([.3,-.3]);await carryTo([-1,1]);await dropAt([-1,1]);
assert.equal(await ev('!!freeFoldDebug.state.pending'),true,'31 候補ができていない');
await click('cancel');
assert.equal(await recipeText(),rec31,'31 取消したのに原本が動いた');
assert.equal(await ev('freeFoldDebug.state.cache.hash'),h31,'31 取消したのに紙が動いた');
await click('undo');assert.equal(await steps(),0,'31 片づけで巻き戻せない');


assert.deepEqual(errors,[]);
console.log(JSON.stringify({result:'PASS',cameraOutsidePaper:true,wheelZoom:true,edgeToEdge:true,cornerToCorner:true,grabLandsUnderFinger:'<=2px',edgeFoldAngle:'always 180 (lands on the finger line)',matchModeGhost:{corner45:c45,corner90:c90,corner96:c172},cornerFoldRatio:'<0.5',partialEdgeFold:true,edgeSnapTo180:true,edgePathUnified:'proposeEdgePair は呼ばない',creasedSheetEdgeGrab:true,creaseIsGuideNotWall:true,noTearAlongCrease:true,splitRimIsOneTarget:true,cornerSnapsToRim:true,diagonalSnapOnly:true,snapHysteresis:'26px in / 44px out',insideOnlyDestination:true,sessionFrozenWhileHeld:true,proposalOwnsGhostAfterRelease:true,hoverNeverStealsDisplay:true,pixelProbes:'yellow=grab, green=target',cancelAtomic:true,stackPickedFromTop:true,multiFaceFoldCommitted:true,thirdStep:true,hingeCrossingRefused:true,farFaceNotPicked:true,redo:true,rimEdgeIdFrozen:true,rimGrabOnFoldedSheet:true,edgeToCrease:true,flapEdgeToLongCrease:true,freeCrease:'2点で crease を引く（0°のまま）',cornerEdgeToCrease:'角につながる辺を折り目へ（角も辺のもう一端も 0px）',undoOne:true,axisClippedToPaper:'紙外の破線画素 0',hingeInterval:'折った背を安定したIDで選べる（H1）',edgeToHinge:'辺を見えている折った背へ合わせる（H2）',blockedFoldNoGhost:'折れない手はゴーストを出さず確定もできない（山谷・上からN枚で救える）',flip:'紙ぜんぶの裏返し（op:flip・axis:v）',creaseThenFold:'折り目を付けてそのまま折る（原本はふつうの2手）',openHinge:'背を開く（S2）：H1で選んだ背を、指した側から開く（ふつうの fold 1手）',openHingeSave:file27,squashFold:'S3：ふつうの折りを派生へ入れて、そこにできた背を開く（原本はふつうの fold 2手）',squashSave:file28,openAnyLayers:'S4：既存ヒンジを軸に単一面を開く（層の枚数では断らない／3層の袋を実機で確認）',openSave29:file29,bothSides:'表と裏で同じ手＝通常の角ドラッグで対角へ吸着／外周の辺つかみ（mark31）',bothSidesSave:file31,unknownOp:'知らない op の読込・やり直しは断り、画面の状態は動かない（実機・mark30）',edgeToEdge:'辺を見えている別のふちへ合わせる（E3）',replayHash:true,explicitDownload:file,consoleErrors:0,creaseOp:true,screenshots:[landShot,creaseShot,flatShot,travelShot,noTearShot,acrossShot,edgeShot,partShot,snapEdgeShot,tiltShot,foldShot,snapShot,overEdgeShot,dragShot,heldShot,doneShot,acrossRimShot,acrossRimDoneShot,stackShot,multiShot,tearShot,fixedShot,openShot,redoShot,leftShot,rimShot,alignShot,flapShot,creaseLineShot,shotQ0,shotQ1,axisShot,hingeShot,hingeAimShot,hingeFoldShot,e3Shot,shot24a,shot24b,shot25,shot26,shot27,shot28a,shot28b,shot29,shot30,shot31a,shot31b,shot31c]}));
await shutdown()}
main().then(()=>process.exit(0),async e=>{console.error(e);await shutdown();process.exit(1)});
