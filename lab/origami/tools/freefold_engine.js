/* Free-fold authoring engine. The recipe is canonical; geometry is a replay cache. */
'use strict';
globalThis.FreeFoldEngine=(()=>{
const C=x=>JSON.parse(JSON.stringify(x)),E=1e-7,S=(p,a,b)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const inside=(p,q)=>{let h=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[i],b=q[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])h=!h}return h};
const ix=(p,q,a,b)=>{const u=S(p,a,b),v=S(q,a,b),t=u/(u-v);return[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]};
function split(poly,a,b){const k=[],c=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=S(p,a,b),v=S(q,a,b);if(u>=-E)k.push(p);if(u<=E)c.push(p);if((u>E&&v<-E)||(u<-E&&v>E)){const z=ix(p,q,a,b);k.push(z);c.push(z)}}return[k.length>2?k:null,c.length>2?c:null]}
const reflect=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y);return[2*(a[0]+t*x)-p[0],2*(a[1]+t*y)-p[1]]};
const apply=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]];
const inv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
const compose=(o,i)=>[o[0]*i[0]+o[1]*i[2],o[0]*i[1]+o[1]*i[3],o[2]*i[0]+o[3]*i[2],o[2]*i[1]+o[3]*i[3],o[0]*i[4]+o[1]*i[5]+o[4],o[2]*i[4]+o[3]*i[5]+o[5]];
const area=poly=>{let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1];return Math.abs(a)/2};
const sameXf=(x,y)=>x.every((v,i)=>Math.abs(v-y[i])<1e-9);
/* 表裏は層の偶奇ではなく変換の行列式で決める（本番の xf_is_flipped と同じ）。奇数回鏡映＝裏。 */
const detXf=m=>m[0]*m[3]-m[1]*m[2];
function segCrossSeg(a1,a2,b1,b2,tol=1e-9){const d1=S(b1,a1,a2),d2=S(b2,a1,a2),d3=S(a1,b1,b2),d4=S(a2,b1,b2);
 return((d1>tol)!==(d2>tol))&&((d3>tol)!==(d4>tol))}
/* 2つの多角形が少しでも重なっているか。「角がちょっとでもかかれば、それは上」＝点で調べず辺の交差で見る。 */
/* 🚨積み直しの pivot で使う点の判定は、**本番の `point_in_polygon` と同じ「ふちの上も中」**（2026-09-13）。
   レイキャストだけだと、**頂点がぜんぶ相手のふちに乗っている包含**（折った紙が背の上に
   ぴったり重なる形）を「重なっていない」と誤判定し、**層番号が本番と食い違う**
   （H2 の Python 突き合わせで発覚：JS 1 / 本番 3）。判定だけを本番にあわせる。 */
function insideOrOn(pt,poly,tol=1e-6){
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
  const cr=(b[0]-a[0])*(pt[1]-a[1])-(b[1]-a[1])*(pt[0]-a[0]);
  if(Math.abs(cr)<tol){const dot=(pt[0]-a[0])*(b[0]-a[0])+(pt[1]-a[1])*(b[1]-a[1]),L2=(b[0]-a[0])**2+(b[1]-a[1])**2;
   if(dot>=-tol&&dot<=L2+tol)return true}}
 return inside(pt,poly)}
function polysOverlap(p,q){for(const v of p)if(insideOrOn(v,q))return true;
 for(const v of q)if(insideOrOn(v,p))return true;
 for(let i=0;i<p.length;i++)for(let j=0;j<q.length;j++)
  if(segCrossSeg(p[i],p[(i+1)%p.length],q[j],q[(j+1)%q.length]))return true;
 return false}
/* ★重なりの問いは2つあって、答えも2つ要る。
   ①積み直しの pivot＝「角がちょっとでもかかれば、それは上」＝ふれあいも重なり（polysOverlap・本番と同じ）。
   ②折れるかの判定＝「面積のある重なり」だけ（overlapsArea）。ふれあいまで重なりにすると、
     折り目にそって折る（＝相手と辺を接する）ふつうの手が「上に紙がある」で断られる。 */
const centroidOf=poly=>poly.reduce((s2,v)=>[s2[0]+v[0]/poly.length,s2[1]+v[1]/poly.length],[0,0]);
const samplesOf=poly=>{const c=centroidOf(poly),out=[c];for(const v of poly)out.push([c[0]+(v[0]-c[0])*.6,c[1]+(v[1]-c[1])*.6]);return out};
/* 🚨「面積のある重なり」＝2枚（凸）の**交わりに幅があるか**（2026-09-14 に標本点から置きかえ）。
   交わり：p を q の各辺の半平面で切る（split を再利用。辺の向きを長さ100にそろえる＝辺からの距離 1e-9 以内は辺の上）。
   重なり ⇔ 交わりの最小幅（各辺の法線方向の厚みの最小）> OVERLAP_WIDTH。接する・辺が一直線に並ぶ・角が1点で触れる、は幅0＝重なりではない
   （E2で踏んだ「折り目の端で軸が相手の角に触れる」もここで幅0）。
   ⚠旧方式（重心と頂点寄りの5点＋きちんと交わる辺）は、標本点が両方とも重なりの外で、交点がぜんぶ「頂点が相手の辺の上」だと
     面積 0.1 の帯の重なりでも見逃した（test_overlap_area.js の R）。
   ⚠面積のしきいにしない＝角が線を 6.7e-4 越える細い三角（面積 5.8e-7）を捨てる。
   前提：q は凸。⚠「保つ仕組み」と「確かめた事実」は別：
     - 仕組み（構造上そうなる・実行時の検査は無い）＝面を作るのは 最初の正方形／split（凸を半平面で切る＝凸）／xf の剛体変換と裏返しの鏡映（凸のまま）
       ／袋折り v2 の splitFaces（同じ split で割るか、面を丸ごと運ぶだけ）の4つだけ。これ以外の道で面を作る機能を足したら前提を見直す。
       ⚠split は許容 1e-7 で頂点を拾うので、ほぼ一直線・重なった頂点を含む「許容の範囲で凸」な多角形になりうる。
     - 事実（探索で測った範囲だけ）＝test_overlap_area.js の C（探索・袋折り・袋折りのあとの面 653枚がすべて凸）。
   幅が 1e-7 前後の重なりは接触と区別しない。倍精度の浮動小数での判定。
   ⚠積み直しの pivot（polysOverlap）はこれまでどおり「ふれあいも重なり」＝本番と同じ規則のまま。 */
const OVERLAP_WIDTH=1e-7;
function overlapsArea(p,q){let cur=p,s=0;for(let i=0,j=q.length-1;i<q.length;j=i++)s+=q[j][0]*q[i][1]-q[i][0]*q[j][1];
 for(let i=0;i<q.length&&cur;i++){const a=q[i],b=q[(i+1)%q.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);if(l<1e-12)continue;
  cur=split(cur,a,[a[0]+dx*100/l,a[1]+dy*100/l])[s>0?0:1]}
 if(!cur)return false;
 let w=Infinity;for(let i=0;i<cur.length;i++){const a=cur[i],b=cur[(i+1)%cur.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<1e-9)continue;
  let lo=Infinity,hi=-Infinity;for(const v of cur){const d=S(v,a,b)/l;lo=Math.min(lo,d);hi=Math.max(hi,d)}w=Math.min(w,hi-lo)}
 return w!==Infinity&&w>OVERLAP_WIDTH}
/* ふちの上は「中」と数えない。隣り合うだけの紙を重なりと取りちがえないため（本番の_strictly_insideと同じ）。 */
function strictlyInside(pt,poly,eps=1e-3){if(!inside(pt,poly))return false;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
  if(L<1e-12)continue;
  const d=Math.abs(dx*(pt[1]-a[1])-dy*(pt[0]-a[0]))/L,t=((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/(L*L);
  if(t>=-.05&&t<=1.05&&d<eps)return false}
 return true}
/* 🚨層の積み直し。本番（fold2d.py の _stack ／ origami_recipe.js の order）とまったく同じ規則にする：
   着地先で重なっている「止まった紙」から pivot を取り、動いた紙を順序を逆にして積む。
   freefold独自の「面ごとに ±1」はここで捨てた＝第4の層モデルを持たない（2026-09-12・本人承認）。 */
function restack(next,moved,kind){const mv=next.filter(f=>moved.has(f));if(!mv.length)return;
 const st=next.filter(f=>!moved.has(f)),sign=kind==='V'?1:-1,pick=kind==='V'?Math.max:Math.min;
 let pivot=null;
 for(const p of mv)for(const q of st)if(polysOverlap(p.poly,q.poly))pivot=pivot===null?q.layer:pick(pivot,q.layer);
 if(pivot===null)pivot=pick(...mv.map(p=>p.layer))-sign;
 mv.sort((a,b)=>kind==='V'?b.layer-a.layer:a.layer-b.layer);
 mv.forEach((p,i)=>{p.layer=pivot+(i+1)*sign})}
function reflMat(a,b){const d=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...d),u=[d[0]/l,d[1]/l],r=[2*u[0]*u[0]-1,2*u[0]*u[1],2*u[0]*u[1],2*u[1]*u[1]-1,0,0];const ra=apply(r,a);r[4]=a[0]-ra[0];r[5]=a[1]-ra[1];return r}
/* A crease splits the face like a fold but leaves it flat (origami_recipe.py replays it with move=False).
   Its line is remembered so it can be drawn, snapped to, and carried along when a later fold moves the paper. */
function lineInPoly(poly,a,b){const pts=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=S(p,a,b),v=S(q,a,b);
 if(Math.abs(u)<=E)pts.push(p);else if((u>E&&v<-E)||(u<-E&&v>E))pts.push(ix(p,q,a,b))}
 let best=null,far=-1;for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const n=(pts[i][0]-pts[j][0])**2+(pts[i][1]-pts[j][1])**2;if(n>far){far=n;best=[pts[i],pts[j]]}}
 return far>E?best:null}
function cutSegment(seg,a,b){const u=S(seg[0],a,b),v=S(seg[1],a,b);
 if(u>=-E&&v>=-E)return{keep:seg,cut:null};
 if(u<=E&&v<=E)return{keep:null,cut:seg};
 const z=ix(seg[0],seg[1],a,b);return u>0?{keep:[seg[0],z],cut:[z,seg[1]]}:{keep:[z,seg[1]],cut:[seg[0],z]}}
/* 🧷 紙片(sheet)＝素材としてつながった面のかたまり。つながりは「面を split した時に記録した bond」だけで辿る。
   表示中の座標がたまたま一致するかでは繋がない＝重なった紙や誤差で別の紙を繋いでしまわない。
   bond の kind は split したときの手で決まる：crease＝折り目（素材は切れていない）／hinge＝そこで紙は曲がる。
   紙片は crease の bond だけで閉じる。bond の seg は「ひらいた紙（素材）の座標」なので、折っても動かない。 */
/* 結びの状態（結びの線が両側で同じ所へ写ることは、呼ぶ前に 1e-7 で確かめてある）。
   線分で一致する2つの剛体の置き方は「同じ」か「その線での鏡映」の2通りだけ＝**向き（det の符号）**で分ける：
   'folded'＝向きが逆（180°に畳まれている）／'open'＝向きが同じで xf が一致（0°に開いた）／null＝向きは同じなのに xf が 1e-9 で一致しない（開いたと言い切れない）。
   ⚠鏡映を行列で作って 1e-9 で比べる形は使わない：折線が角のすぐ横（2.5e-8）を通ると結びの素材区間の端が角へ丸められ、
     区間から作った鏡映の軸が 1e-8 傾いて、畳まれた背まで「どちらでもない」になった（実Chrome test_freefold_browser 17）。 */
function bondState(fx,fy,seg){void seg;
 const dx=fx.xf[0]*fx.xf[3]-fx.xf[1]*fx.xf[2],dy=fy.xf[0]*fy.xf[3]-fy.xf[1]*fy.xf[2];
 if(Math.sign(dx)!==Math.sign(dy))return'folded';
 return sameXf(fx.xf,fy.xf)?'open':null}
function sheetIds(bonds,faceId){const seen=new Set([faceId]),q=[faceId];
 while(q.length){const id=q.pop();for(const b of bonds){if(b.kind!=='crease')continue;
  const i=b.faceIds.indexOf(id);if(i<0)continue;const o=b.faceIds[1-i];if(!seen.has(o)){seen.add(o);q.push(o)}}}
 return seen}
/* v1スキーマの上限。ここを超える形は原本に書けないので、確定させない。 */
const MAX_STEPS=100,MAX_FACES=1024;
const round=n=>Math.round(n*1e9)/1e9;
function digest(cache){return JSON.stringify({faces:cache.faces.map(f=>({id:f.faceId,path:f.layerPath,poly:f.poly.map(p=>p.map(round)),xf:f.xf.map(round),layer:f.layer})),hinges:cache.hinges,creases:cache.creases.map(c=>({id:c.creaseId,face:c.faceId,seg:c.seg.map(p=>p.map(round)),kind:c.kind})),bonds:cache.bonds.map(b=>({faces:b.faceIds,kind:b.kind,seg:b.seg.map(p=>p.map(round)),...(b.openedBy?{opened:b.openedBy}:{}),...(b.closedBy?{closed:b.closedBy}:{})})),
 ...(cache.squash?{squash:{step:cache.squash.stepId,model:cache.squash.model,branch:cache.squash.branch,sectorFace:cache.squash.sectorFace,moving:cache.squash.moving,
  regions:cache.squash.regions.map(r=>({faces:r.faces,order:r.order,area:round(r.area)}))}}:{}),
 ...(cache.squashes?{squashes:cache.squashes.map(q=>({step:q.stepId,moving:q.moving,sectorFace:q.sectorFace,regions:q.regions.map(r=>({faces:r.faces,order:r.order,area:round(r.area)}))}))}:{}),
 /* 🌸 花弁折りがあるときだけ（無い原本のハッシュは変えない） */
 ...(cache.petals?{petals:cache.petals.map(q=>({step:q.stepId,model:q.model,faceOf:q.faceOf,moving:q.moving,regions:q.regions.map(r=>({faces:r.faces,order:r.order,area:round(r.area)}))}))}:{})})}
function baseRecipe(meta={}){return{format:'origami-recipe',version:1,coordinates:'unfolded-normalized-xy',work:{id:meta.id||'freefold_draft',name:meta.name||'自由折り',emoji:'📄',difficulty:1},source:{note:'3D自由折りで、平らな正方形から一直線の fold を記録。'},paper:{aspectRatio:1,colorDown:false},steps:[]}}
/* 1手を再生する。動かすのは reference ではなく targets ぜんぶ＝折り目でつながった面は一緒に動く。
   targets は同じ紙片の面でなければならず、reference はその中に入っていなければならない。 */
/* 🚨知らない操作は、ここで**はっきり断る**。
   ⚠以前は `op` を見るのが `st.op==='crease'` と `st.op==='flip'` の2か所だけで、
     それ以外は**ぜんぶ fold として素通し**していた（実測＝`op:'squash'` でも紙が2枚に割れた）。
     未対応の読み手が黙って別の紙を作るのがいちばん危ないので、入口で止める。
   ⚠これは**幾何の再生器**であって JSON スキーマの検査ではない。
     format／version／余分な項目は見ていない（そこは origami_recipe の validate の仕事）。
   🚨新しい op を足すときは、まずここに足すこと。 */
const OPS=['fold','crease','flip'];
function assertOp(st,where){
 if(!st||typeof st!=='object')throw Error(`${where}で手が読めません`);
 if(!Object.prototype.hasOwnProperty.call(st,'op'))throw Error(`${where}で op がありません`);
 /* 🌸 花弁折り（v2 の手）は、この v1 の再生器では読まない＝名前を出してはっきり断る（袋折りは下の「知らない操作」のまま＝既存の検査の文言）。 */
 if(st.op==='petal')throw Error(`${where}で花弁折り（op:petal）は version 2 の手です（v1 の再生器では読みません）`);
 if(typeof st.op!=='string'||!OPS.includes(st.op))
  throw Error(`${where}で知らない操作です（op: ${String(st.op).slice(0,40)}／使えるのは ${OPS.join(' / ')}）`)}
/* 🧺 start＝平らな紙でない所から続けるときの cache（faces／hinges／creases／bonds）。いまは袋折りの再生結果だけが渡す
   （SquashV2.replayWith＝袋折りのあとの手）。渡さなければ平らな紙から＝これまでと1文字も同じ。
   🚨手の再生（割る・運ぶ・積み直す・結びの付けかえ・裂けの見張り）は1本だけ＝袋折りのあと用の2つめの再生器を作らない。
   ⚠start は呼ぶ側が**作りたての** cache を渡す（配列にこの再生の中で書き足す。いまの呼び手 toCache は毎回新しく作る）。
   結びの番号は start にある b番号の続きから振る（名前がぶつからない）。 */
function replayV1(recipe,start){
let faces=[{faceId:'paper',layerPath:[],poly:[[-1,-1],[1,-1],[1,1],[-1,1]],xf:[1,0,0,1,0,0],layer:0}],hinges=[],creases=[],bonds=[],bn=0;
if(start){({faces,hinges,creases,bonds}=start);
 for(const bd of bonds){const v=/^b(\d+)$/.exec(String(bd.bondId));if(v)bn=Math.max(bn,+v[1])}}
for(const st of recipe.steps){
 assertOp(st,'JSON再生');
 /* 🔄 flip＝紙ぜんぶの裏返し。規則は本番の fold2d.flip とまったく同じ：
    poly を鏡映／xf に合成（det が反転＝表裏が入れかわる）／layer の符号を反転／**折り筋は増えない**。
    ＝面は1枚も割れないので faceId・layerPath・結び(bond)・ヒンジは増えも減りもしない。
    🚨結びの線(bond.seg)とヒンジの sourceLine は**素材座標**なので触らない。
      折り目(crease.seg)だけは「いまの座標」なので、ここで一緒に写す。
    ⚠局所的な「うしろにおる」は op:'fold' の kind:'M'＝折線を持ち、動く側の面だけが動く。別物。 */
 if(st.op==='flip'){
  if(st.axis!=='v'&&st.axis!=='h')throw Error('JSON再生で裏返しの向きが v でも h でもありません');
  const F=st.axis==='v'?[-1,0,0,1,0,0]:[1,0,0,-1,0,0];
  faces=faces.map(f=>({...f,poly:f.poly.map(p=>apply(F,p)),xf:compose(F,f.xf),layer:-f.layer}));
  creases=creases.map(c=>({...c,seg:c.seg.map(p=>apply(F,p))}));
  continue}
 const ref=faces.find(f=>f.faceId===st.reference.faceId);if(!ref)throw Error('JSON再生で対象面が見つかりません');
 const ids=(st.targets&&st.targets.length?st.targets:[st.reference]).map(t=>t.faceId);
 if(new Set(ids).size!==ids.length)throw Error('JSON再生で targets が重複しています');
 if(!ids.includes(ref.faceId))throw Error('JSON再生で対象面が targets に入っていません');
 for(const id of ids)if(!faces.some(f=>f.faceId===id))throw Error('JSON再生で対象面が見つかりません');
 const a=apply(ref.xf,st.line[0]),b=apply(ref.xf,st.line[1]),moving=apply(ref.xf,st.movingSidePoint);
 let A=a,B=b;if(S(moving,A,B)>0)[A,B]=[B,A];
 /* 🚨targets は「紙片ひとつ」でなくてよい（重なった上からN枚は別の紙片にまたがる）。
    かわりに、原本を再生するたびに「その集合で一貫して折れるか」を見る＝上に乗った紙を置き去りにしない、
    折り目でつながった紙を置き去りにしない。B1の「別の紙片は不可」はこれに置きかわった（2026-09-12）。 */
 if(st.op!=='crease'){const chk=foldableSet(faces,bonds,ids,A,B,st.kind);
  if(!chk.ok)throw Error('JSON再生で'+chk.reason)}
 else{const chk=creasableSet(faces,bonds,ids,A,B);/* ✏️ 折り目だけも、提案・確定と同じ芯で見る */
  if(!chk.ok)throw Error('JSON再生で'+chk.reason)}
 /* 🚨結び(bond)の切り分けは「いまの座標」で見る。素材の座標で1本の折線を使ってよいのは、対象がぜんぶ
    同じ xf のとき（＝B1の紙片ひとつ）だけだった。重なった紙をまとめて折ると xf が面ごとに違うので、
    同じ現在の折線でも素材の折線は面ごとに別物になる（2026-09-12・B2aで踏んだ）。
    結びの線は両側の xf で同じ所へ写る（不変条件）ので、現在座標で切ってから戻せば、どちらの面から見ても同じ。 */
 const matLine=x=>[inv(x.xf,A),inv(x.xf,B)];
 const flat=st.op==='crease',R=reflMat(A,B),kids=new Map();let moved=false,stayed=false;const next=[],movedSet=new Set();
 for(const f of faces){
  if(!ids.includes(f.faceId)){next.push(f);stayed=true;continue}
  const [keep,cut]=split(f.poly,A,B);
  if(!keep&&!cut)throw Error('JSON再生で面を分割できません');
  if(keep&&cut){
   const kf={...f,faceId:`${f.faceId}/${st.id}.keep`,layerPath:[...f.layerPath,{stepId:st.id,side:'keep'}],poly:keep};
   const cf={...f,faceId:`${f.faceId}/${st.id}.cut`,layerPath:[...f.layerPath,{stepId:st.id,side:'cut'}],poly:flat?cut:cut.map(p=>apply(R,p)),
    ...(flat?{}:{xf:compose(R,f.xf)})};
   next.push(kf,cf);kids.set(f.faceId,{keep:kf,cut:cf});moved=true;stayed=true;if(!flat)movedSet.add(cf);
   /* 親子の隣接をここで明示的に記録する。素材座標なので、あとで紙が動いてもこの線は変わらない。 */
   const[ia,ib]=matLine(f),useg=lineInPoly(f.poly.map(p=>inv(f.xf,p)),ia,ib);
   bonds.push({bondId:`b${++bn}`,faceIds:[kf.faceId,cf.faceId],stepId:st.id,kind:flat?'crease':'hinge',seg:useg||[C(ia),C(ib)]});
   if(flat){const seg=lineInPoly(f.poly,A,B);if(!seg)throw Error('JSON再生で折り目が面の中に入りません');
    creases.push({creaseId:`c-${st.id}-${creases.length+1}`,stepId:st.id,faceId:kf.faceId,seg,kind:st.kind})}
   else hinges.push({hingeId:`h-${st.id}-${hinges.length+1}`,stepId:st.id,faceIds:[kf.faceId,cf.faceId],sourceLine:C(st.line),kind:st.kind})}
  else if(cut){/* 丸ごと動く。二つに分かれていないので faceId も layerPath も変えない（origami_recipe.py の assign_faces と同じ）。 */
   const mf=flat?f:{...f,poly:f.poly.map(p=>apply(R,p)),xf:compose(R,f.xf)};
   next.push(mf);kids.set(f.faceId,{keep:null,cut:mf});moved=true;if(!flat)movedSet.add(mf)}
  else{next.push(f);kids.set(f.faceId,{keep:f,cut:null});stayed=true}}
 if(!moved)throw Error('JSON再生で動く面がありません');
 if(!stayed)throw Error('JSON再生で折線が紙片を二つに分けていません');
 if(!flat)restack(next,movedSet,st.kind);/* 層は積み直しだけから決まる（面ごとの±1はしない）。 */
 /* 既にある折り目は紙といっしょに運ぶ。折線をまたぐものは切り分け、動いた側は同じ変換をかける。 */
 creases=creases.flatMap(c=>{const k=kids.get(c.faceId);if(!k)return[c];
  if(k.keep&&k.cut){const part=cutSegment(c.seg,A,B),out=[];
   if(part.keep)out.push({...c,faceId:k.keep.faceId,seg:part.keep});
   if(part.cut)out.push({...c,faceId:k.cut.faceId,seg:flat?part.cut:part.cut.map(p=>apply(R,p))});
   return out}
  if(k.cut)return[{...c,faceId:k.cut.faceId,seg:flat?c.seg:c.seg.map(p=>apply(R,p))}];
  return[{...c,faceId:k.keep.faceId,seg:c.seg}]});
 /* 隣接も同じように引き継ぐ。分かれた面の結びは折線で切り分け、分かれていない面はそのまま付け替える。 */
 const at=(id,side)=>{const k=kids.get(id);if(!k)return id;return k[side]?k[side].faceId:null};
 const wholeMoved=id=>{const k=kids.get(id);return!!(k&&k.cut&&!k.keep)};
 const onLineCur=p=>Math.abs(S(p,A,B))<=1e-7;
 bonds=bonds.flatMap(bd=>{const[x,y]=bd.faceIds,kx=kids.get(x),ky=kids.get(y);
  const sx=!!(kx&&kx.keep&&kx.cut),sy=!!(ky&&ky.keep&&ky.cut);
  /* 結びの線を「いまの座標」へ出すのに使う面。両側の xf は結びの線の上では同じ所へ写るので、どちらでもよい。 */
  const host=faces.find(f=>f.faceId===x)||faces.find(f=>f.faceId===y)
   ||next.find(f=>f.faceId===x)||next.find(f=>f.faceId===y);/* この手で生まれた結びは next にしかいない。 */
  if(!host)return[];
  const cur=bd.seg.map(q=>apply(host.xf,q));
  if(sx||sy){const part=cutSegment(cur,A,B),out=[];
   for(const side of['keep','cut']){const seg=part[side];if(!seg)continue;
    const fx=at(x,side),fy=at(y,side);if(fx&&fy&&fx!==fy)out.push({...bd,faceIds:[fx,fy],seg:seg.map(q=>inv(host.xf,q))})}
   return out}
  const fx=at(x,'keep')||at(x,'cut'),fy=at(y,'keep')||at(y,'cut');
  if(!fx||!fy||fx===fy)return[];
  /* 折り目そのものを折線にしたとき＝結びが折線の上にあり、両側が別々に行った。そこは折り目でなくヒンジになる。 */
  if(bd.kind==='crease'&&wholeMoved(x)!==wholeMoved(y)&&cur.every(onLineCur)){
   const hb={...bd,faceIds:[fx,fy],kind:'hinge',stepId:st.id};delete hb.openedBy;return[hb]}
  return[{...bd,faceIds:[fx,fy]}]});
 faces=next;
 /* 🔓 開いた背（2026-09-15・本人指示）：この手で動いた面に触れる背（hinge）を、**両側の素材の対応と向き（xf）**で分ける。
    同じ平面にあるだけでは 0°に開いた背と 180°に畳まれた背は区別できない（どちらも z=0）。
    - 両側の xf が同じ ＝ 素材が同じ所・同じ向きへ写る ＝ 0°に開いた → 折り目（crease）として扱う
    - 片側の xf が、結びの線（素材座標）での鏡映を合成したもう片側と同じ ＝ 180°に畳まれている → 背（hinge）のまま
    - 向きは同じなのに xf が 1e-9 で一致しない ＝ 開いたと言い切れない → 背のまま（新しい断りは足さない。切り離しは直後の結びの検査が見る）
    🚨由来は保持：bondId・stepId（背を作った手）・seg（素材の区間）は変えず、openedBy に開いた手を足す。原本は書きかえない＝再生するたびにここで決まる。
    折り目の表示用に cache.creases へも1本足す（stepId は由来の手＝creaseIntervals が結びと対応づけられる／openedBy に開いた手）。 */
 if(!flat){const byId=new Map(faces.map(f=>[f.faceId,f])),movedIds=new Set([...movedSet].map(f=>f.faceId));
  const kindOf=new Map(recipe.steps.map(s=>[s.id,s.kind]));
  bonds=bonds.map(bd=>{if(bd.kind!=='hinge')return bd;
   const[x,y]=bd.faceIds,fx=byId.get(x),fy=byId.get(y);
   if(!fx||!fy||!(movedIds.has(x)||movedIds.has(y)))return bd;
   const bs=bondState(fx,fy,bd.seg);
   if(bs!=='open')return bd;/* 畳まれている／開いたと言い切れない＝背のまま（今までと同じ） */
   const host=[fx,fy].sort((u,v)=>u.faceId<v.faceId?-1:1)[0];
   creases.push({creaseId:`c-${st.id}-${creases.length+1}`,stepId:bd.stepId,faceId:host.faceId,seg:bd.seg.map(q=>apply(host.xf,q)),
    kind:kindOf.get(bd.stepId)==='M'?'M':'V',openedBy:st.id});
   return{...bd,kind:'crease',openedBy:st.id}})}
 /* 🚨 紙は破れない。結び(bond)の線を両側それぞれの xf で写した所が一致しなければ、そこで紙は切れている。
    折り目(crease)は形を動かさないので、さらに両側の xf が同じでなければならない。
    ⚠層の一致は条件にしない＝本番の積み直しでは、折り目でつながった2枚が別の層番号になる（2026-09-12）。
    ⚠ヒンジもここで見る＝「重なった紙の手前1枚だけ折る」は、動く側にヒンジの線が入っていない時だけ成り立つ。 */
 for(const bd of bonds){
  const fx=faces.find(f=>f.faceId===bd.faceIds[0]),fy=faces.find(f=>f.faceId===bd.faceIds[1]);
  if(!fx||!fy)continue;
  if(bd.seg.some(q=>{const u=apply(fx.xf,q),v=apply(fy.xf,q);return Math.hypot(u[0]-v[0],u[1]-v[1])>1e-7}))
   throw Error(bd.kind==='crease'?'折り目にそって紙が切り離されました':'ヒンジにそって紙が切り離されました');
  if(bd.kind==='crease'&&!sameXf(fx.xf,fy.xf))throw Error('折り目にそって紙が切り離されました')}}
const cache={faces,hinges,creases,bonds};cache.hash=digest(cache);return cache}
/* ================= 🚪 再生の共通入口（format／version で v1・v2 を振り分ける） =================
   同期・確定・裏返し・巻き戻し・やり直し・保存前の照合は、ぜんぶこの `replay` を通る（入口は1本）。
   - version 1 → format を見てから `replayV1`（幾何の再生器。中身はこれまでと同じ）
   - version 2 → `SquashV2.replayWith(recipe, replayV1)`。v2 の中の通常の手は**引数で渡した replayV1** が再生する
     ＝v2 側から engine の入口（この関数）を呼び戻す道を作らない。`replayV1` は外へ出さない。
     ⚠v2 の format を含む v1 部分の検査は、v2 側が既存の検証器（origami_recipe.js＋schema）へ渡している
       ＝ここで format を二重に見ない（v1 の検証器はこの engine には無いので、v1 だけここで見る）。
   - それ以外の version は断る。
   🚨再入の見張り：入口の中から入口が呼ばれたら、循環として断る。 */
let replayDepth=0;
const squashSummary=o=>({stepId:o.stepId,model:o.model,branch:C(o.branch),
 regions:o.regions.map(r=>({faces:C(r.faces),order:C(r.order),area:r.area})),
 sectorFace:C(o.sectorFace),moving:o.faces.filter(f=>f.moving).map(f=>f.faceId).sort()});
const petalSummary=o=>({stepId:o.stepId,model:o.model,faceOf:C(o.faceOf),moving:o.moving.slice(),
 regions:o.regions.map(r=>({faces:C(r.faces),order:C(r.order),area:r.area}))});
function replayDetail(recipe){
 if(replayDepth)throw Error('JSON再生の入口が循環しました（v2 の中の手は内部の再生器へ渡してください）');
 if(!recipe||typeof recipe!=='object'||Array.isArray(recipe))throw Error('JSON再生で原本が読めません');
 replayDepth++;
 try{
  if(recipe.version===1){
   if(recipe.format!=='origami-recipe')throw Error(`JSON再生で format が origami-recipe ではありません（${String(recipe.format).slice(0,40)}）`);
   return{cache:replayV1(recipe),squash:null}}
  if(recipe.version===2){
   const V2=globalThis.SquashV2;
   if(!V2||typeof V2.replayWith!=='function')throw Error('JSON再生で version 2 の再生器（squash_v2.js）が読みこまれていません');
   const r=V2.replayWith(recipe,replayV1);
   const cache={faces:r.cache.faces,hinges:r.cache.hinges,creases:r.cache.creases,bonds:r.cache.bonds};
   if(r.squash)cache.squash=squashSummary(r.squash);/* いちばん新しい袋折り（1回だけなら今までと同じ） */
   if(r.squashes&&r.squashes.length>1)cache.squashes=r.squashes.map(squashSummary);/* 2回以上のときだけ全部（1回の原本のハッシュは変えない） */
   if(r.petals&&r.petals.length)cache.petals=r.petals.map(petalSummary);/* 🌸 花弁折りの手ごとの検算（動く面・領域の上下） */
   cache.hash=digest(cache);
   return{cache,squash:r.squash,petals:r.petals||[]}}
  throw Error(`JSON再生で知らない version です（${String(recipe.version).slice(0,20)}／使えるのは 1 / 2）`)
 }finally{replayDepth--}}
function replay(recipe){return replayDetail(recipe).cache}
/* 🧺 袋折りのあとの**もう一度の袋折り**（2026-09-15）：門で断るのをやめ、SquashV2 の読み方（readPocket）が決める。
   5枚以上の紙は「局所照合＋周囲の紙の検査」（squash_v2.js ②-L）を通ったときだけ候補になる。 */
/* 袋折りの候補（pending.inputMode==='squash'）には、折線・折る側・対象面が無い。折りの道へは入れない。 */
function foldPending(state,none){const q=state.pending;if(!q)throw Error(none);
 if(q.inputMode==='squash')throw Error('いまは袋折りの候補です（確定か取消をしてください）');
 if(q.inputMode==='petal')throw Error('いまは花弁折りの候補です（確定か取消をしてください）');return q}
function sync(state){state.cache=replay(state.recipe);state.cacheRevision=state.revision;state.committed=state.recipe.steps.length?state.cache:null;return state.cache}
/* redoStack＝undo で外した「原本の手」だけを積む置き場。面・結び・層・cache は1つも入れない
   （入れた瞬間、原本のほかに2つめの正本ができてしまう）。保存にも digest にも混ざらない。 */
const redoOf=state=>state.redoStack||[];
function create(meta){const state={recipe:baseRecipe(meta),revision:0,pending:null,cache:null,committed:null,redoStack:[]};sync(state);return state}
/* 紙片の面ぜんぶ（層の高い順）。UIも折り線の逆算も、面でなくこれを単位にする。 */
function sheetOf(state,faceId){const ids=sheetIds(state.cache.bonds,faceId);return state.cache.faces.filter(f=>ids.has(f.faceId))}
/* ================= B2a：重なりを読むAPI（画面からはまだ呼ばない） =================
   原本(recipe)が正本で、面・層順位・ヒンジ・表示状態はぜんぶ replay の作り直しから来る。
   ここにあるのは「いまのキャッシュを読む」関数だけで、原本は1文字も書かない。 */
const stepOf=f=>f.layerPath.length?f.layerPath[f.layerPath.length-1].stepId:null;
function sheetKey(state,faceId){return[...sheetIds(state.cache.bonds,faceId)].sort()[0]}
/* その場所にある面を、上から順に。ふちの上は数えない＝隣り合うだけの紙を重なりにしない。 */
function stackAt(state,p){const hit=state.cache.faces.filter(f=>strictlyInside(p,f.poly));
 hit.sort((a,b)=>b.layer-a.layer);
 return hit.map((f,i)=>({faceId:f.faceId,layerPath:C(f.layerPath),layer:f.layer,rank:i+1,
  back:detXf(f.xf)<0,sheetId:sheetKey(state,f.faceId),stepId:stepOf(f)}))}
/* その場所の層番号を上から順に。同じ層が2枚あったら順位が決まらないので、その印も返す。 */
function layersAt(state,p){const st=stackAt(state,p),layers=[],duplicated=[];
 for(const f of st){if(layers.includes(f.layer))duplicated.push(f.layer);else layers.push(f.layer)}
 return{layers,duplicated,stack:st}}
/* ================= E1：原本の再生だけから決まる「外周辺」と「折り目の区間」のID =================
   E2（辺を折り目へ合わせる）で、pointerdown のときに掴んだものを凍結するための土台。
   🚨ここは**読み取りだけ**＝原本も cache も1文字も書かない（stackAt たちと同じ立場）。
   🚨IDは保存しない・持ち回らない。**毎回いまの cache から作り直す**＝原本が同じなら、巻き戻しても
     やり直しても同じIDが出る（持ち回ると、そこが2つめの正本になる）。 */
/* 外周辺＝「素材座標で、もとの紙のふち（x=±1／y=±1）に乗っている面の辺」。
   面は正方形を直線で切っただけなので必ず凸＝ひとつの面が同じふちに2本乗ることはない
   ⇒ (ふちの名前, faceId) で一意。分割で親の辺が子へ短く受けつがれても、乗っているふちは変わらない
   ⇒ **親のedgeIdが子の区間へそのまま継承される**（追跡も対応表も要らない）。 */
const RIM=[{id:'bottom',axis:1,at:-1,label:'下辺'},{id:'right',axis:0,at:1,label:'右辺'},
 {id:'top',axis:1,at:1,label:'上辺'},{id:'left',axis:0,at:-1,label:'左辺'}];
const RIM_EPS=1e-6;
const rimOfSeg=(p,q)=>RIM.find(r=>Math.abs(p[r.axis]-r.at)<RIM_EPS&&Math.abs(q[r.axis]-r.at)<RIM_EPS)||null;
/* 線分を「並べ方によらない形」にそろえる＝並び順を決めるときの物差し。 */
const r6=v=>Math.round(v*1e6)/1e6+0;
const segKey=s=>{const p=[r6(s[0][0]),r6(s[0][1])],q=[r6(s[1][0]),r6(s[1][1])];
 return(p[0]<q[0]||(p[0]===q[0]&&p[1]<=q[1]))?[p,q]:[q,p]};
const segStr=s=>JSON.stringify(segKey(s));
function rimEdges(state){const out=[];
 for(const f of state.cache.faces){const src=f.poly.map(p=>inv(f.xf,p));
  for(let i=0;i<src.length;i++){const a=src[i],b=src[(i+1)%src.length];
   if(Math.hypot(a[0]-b[0],a[1]-b[1])<RIM_EPS)continue;
   const r=rimOfSeg(a,b);if(!r)continue;
   out.push({edgeId:`rim:${r.id}|${f.faceId}`,rimId:r.id,label:r.label,faceId:f.faceId,
    layerPath:C(f.layerPath),sheetId:sheetKey(state,f.faceId),layer:f.layer,
    srcSeg:segKey([a,b]),seg:[apply(f.xf,a),apply(f.xf,b)]})}}
 return out.sort((x,y)=>x.edgeId<y.edgeId?-1:x.edgeId>y.edgeId?1:0)}
/* 折り目の区間ID＝「どの手(stepId)でついた折り目の、素材で並べて何番目か」。
   ⚠cache.creases の creaseId は使えない＝1本の折り目があとの折りで切り分けられると、両方が
     同じ creaseId のまま増える。ここは毎回、**素材座標で並べ直して番号を振る**。 */
function creaseIntervals(state){
 const order=new Map(state.recipe.steps.map((s,i)=>[s.id,i]));
 const rows=state.cache.creases.map(c=>{const f=state.cache.faces.find(v=>v.faceId===c.faceId);
  const src=f?c.seg.map(p=>inv(f.xf,p)):C(c.seg);
  const bond=state.cache.bonds.find(b=>b.kind==='crease'&&b.stepId===c.stepId&&
   b.faceIds.includes(c.faceId)&&segStr(b.seg)===segStr(src));
  return{stepId:c.stepId,creaseId:c.creaseId,bondId:bond?bond.bondId:null,faceId:c.faceId,kind:c.kind,
   layerPath:f?C(f.layerPath):[],sheetId:f?sheetKey(state,c.faceId):null,layer:f?f.layer:null,
   srcSeg:segKey(src),seg:C(c.seg)}});
 const by=new Map();for(const r of rows){if(!by.has(r.stepId))by.set(r.stepId,[]);by.get(r.stepId).push(r)}
 const out=[];
 for(const stepId of[...by.keys()].sort((a,b)=>(order.get(a)??0)-(order.get(b)??0)||(a<b?-1:1))){
  const list=by.get(stepId).sort((a,b)=>{const x=segStr(a.srcSeg),y=segStr(b.srcSeg);
   return x<y?-1:x>y?1:(a.faceId<b.faceId?-1:a.faceId>b.faceId?1:0)});
  list.forEach((r,i)=>out.push({...r,index:i+1,intervalId:`${stepId}#${i+1}`}))}
 return out}
/* pointerdown で凍結する「入力の意図」。原本には書かない＝pending の中だけで生きる値。 */
function edgeIntent(state,faceId,rimId){const e=rimEdges(state).find(v=>v.faceId===faceId&&v.rimId===rimId);
 if(!e)throw Error('その面に、その外周辺はありません');
 return{kind:'edge',edgeId:e.edgeId,rimId:e.rimId,faceId:e.faceId,layerPath:C(e.layerPath),
  sheetId:e.sheetId,layer:e.layer,srcSeg:C(e.srcSeg),revision:state.revision}}
function creaseIntent(state,intervalId){const c=creaseIntervals(state).find(v=>v.intervalId===intervalId);
 if(!c)throw Error('その折り目の区間はありません');
 return{kind:'crease',intervalId:c.intervalId,stepId:c.stepId,index:c.index,bondId:c.bondId,faceId:c.faceId,
  layerPath:C(c.layerPath),sheetId:c.sheetId,srcSeg:C(c.srcSeg),revision:state.revision}}
/* 凍結した意図を、いまの紙で見つけ直す。見つからなければ null＝E2 はふつうの角折りへ戻す。
   🚨同じ原本の辺が複数の面へ分かれているときは、**紙片(sheetId)と層経路(layerPath)**で絞る＝
     重なった別の紙の同じふちを掴み直さない。最後に素材の区間が重なるものだけを残す。 */
const pathStr=p=>p.map(q=>q.stepId+'.'+q.side).join('>');
const startsWith=(a,b)=>pathStr(a).startsWith(pathStr(b));
function onSameLine(a,b){const d=[a[1][0]-a[0][0],a[1][1]-a[0][1]],L=Math.hypot(...d)||1;
 return b.every(p=>Math.abs(((p[0]-a[0][0])*d[1]-(p[1]-a[0][1])*d[0])/L)<1e-6)}
function overlapLen(a,b){if(!onSameLine(a,b))return 0;
 const d=[a[1][0]-a[0][0],a[1][1]-a[0][1]],L=Math.hypot(...d)||1,u=[d[0]/L,d[1]/L];
 const t=p=>(p[0]-a[0][0])*u[0]+(p[1]-a[0][1])*u[1];
 const lo=Math.max(0,Math.min(t(b[0]),t(b[1]))),hi=Math.min(L,Math.max(t(b[0]),t(b[1])));
 return Math.max(0,hi-lo)}
/* 🚨見つけ方は2段。①**紙が動いていないあいだ（＝しぐさの最中。revision が同じ）**は、
     edgeId＋紙片＋層経路が**ぴたり一致**するものだけ＝同じ原本の辺が複数の面に分かれていても取りちがえない。
     無ければ null（そこはもう無い）。
   ②紙が進んだあと（確定・巻き戻し・やり直し）は、**凍結した面の子**（faceId と層経路が前方一致）で、
     素材の区間が重なるものへ橋渡しする。子は素材でその親の一部なので、別の紙片には決して行かない。 */
const descends=(id,anc)=>id===anc||id.startsWith(anc+'/');
function resolveRimEdge(state,ref){if(!ref||ref.kind!=='edge')return null;
 const all=rimEdges(state).filter(e=>e.rimId===ref.rimId);
 const exact=all.find(e=>e.edgeId===ref.edgeId&&e.sheetId===ref.sheetId&&pathStr(e.layerPath)===pathStr(ref.layerPath));
 if(exact)return exact;
 if(ref.revision===state.revision)return null;
 const kin=all.filter(e=>descends(e.faceId,ref.faceId)&&startsWith(e.layerPath,ref.layerPath)&&overlapLen(ref.srcSeg,e.srcSeg)>1e-6);
 if(!kin.length)return null;
 return kin.sort((x,y)=>overlapLen(ref.srcSeg,y.srcSeg)-overlapLen(ref.srcSeg,x.srcSeg))[0]}
function resolveCreaseInterval(state,ref){if(!ref||ref.kind!=='crease')return null;
 const all=creaseIntervals(state).filter(c=>c.stepId===ref.stepId);
 const exact=all.find(c=>c.intervalId===ref.intervalId&&c.faceId===ref.faceId&&c.sheetId===ref.sheetId);
 if(exact)return exact;
 if(ref.revision===state.revision)return null;
 const kin=all.filter(c=>descends(c.faceId,ref.faceId)&&startsWith(c.layerPath,ref.layerPath)&&overlapLen(ref.srcSeg,c.srcSeg)>1e-6);
 if(!kin.length)return null;
 return kin.sort((x,y)=>overlapLen(ref.srcSeg,y.srcSeg)-overlapLen(ref.srcSeg,x.srcSeg))[0]}
/* ================= 🦴 H1：折った紙の「背(hinge)」を、安定したIDの区間として読む =================
   本人の要望（2026-09-13）＝**白と赤のあいだの長い境界**＝折った背を、あとで吸着先にできるようにする土台。
   ⚠ここは**読み取りだけ**。原本も cache も1文字も書かない。軸・吸着・プレビュー・確定は H2（まだ作らない）。

   ★identity の作り方（本人指示）
   - cache の配列番号・bondId は**使わない**。**由来 stepId ＋ 素材座標で安定ソートした区間番号**から作る
     ＝`hinge:s3#1`。後続の折りで背が分割されても、素材座標の並びから**同じIDが再生成**される。
   - 区間の切り直しは `replay` がやっている（bonds は後続の折線で切り分けられて引き継がれる）＝ここでは数え直すだけ。
   - IDも intent も**原本JSONにも cache.hash にも入らない**（`digest` は無変更）。

   ★可視の決め方（本人指示。layer番号の大小では決めない）
   - 区間を24点に刻み、各点で**線の両側へ微小にずらした点**を作り、両側で `layersAt/stackAt` を引く。
   - **両側の最上面が、ちょうどこの背の2面**であるときだけ「画面で背として見えている」とする。
     上に別の紙が乗っていれば見えていない。同じ層が重なって順位が決まらないときは理由をつけて候補にしない。
   - 一部だけ見えるときは、**見えている連続部分ごとに**区間を分ける（`visibleParts`）。
   - 見かけの輪郭や、ふつうの material seam（折り目・外周辺）は**ここでは返さない**（bond の kind が 'hinge' のものだけ）。 */
const HINGE_SAMPLES=24,HINGE_PROBE=[.012,.006,.003,.0016];
const sideInfo=f=>f?{faceId:f.faceId,layerPath:C(f.layerPath),layer:f.layer,back:detXf(f.xf)<0}:null;
/* この背が「いま画面で背として見えている」区間を返す。
   🚨180°の平ら折りでは、**背の両側に1面ずつ**ではない＝折り返した面は**土台と同じ側に重なる**。
      だから「両側の最上面がこの2面」では決まらない（最初これで書いて、画像の長い境界が取れなかった）。
   > 決めた形＝**線の両側で「いちばん上に見えている紙」が変わり、そのどちらかがこの背の面**であること。
     片側に紙が無い（背景）のもふつう＝そこが「折った紙のふちに見える」所。
     上に別の紙が乗っていれば、両側で同じ紙が見える＝見えていない。同じ層が重なって順位が決まらなければ理由をつけて外す。 */
/* 🚀 背の可視判定で「その点の一番上の面」と「同じ層が2枚あるか」だけを読む（2026-09-15）。
   答えは layersAt（stackAt）から読んでいた値と同じ：
   - 中にある面＝strictlyInside（同じ関数・同じ許容 1e-3）。外接矩形の**外**の点は ray-cast でも必ず外なので、その面は判定を省く（境界ちょうどは省かない）。
   - dup＝同じ layer の面が2枚以上（layersAt の duplicated が空でない）／top＝layer がいちばん大きい面（dup が無いときだけ使う）。
   - stackAt が作っていた紙片ID（sheetKey）・layerPath の複製・並べ替えは、可視判定では使っていなかった＝作らない。
   標本点（HINGE_SAMPLES）・探り幅（HINGE_PROBE）・見える条件は変えていない。
   同じ座標の点は1回だけ判定する（座標の数値そのものを鍵にする＝丸めない）。1回の computeHingeIntervals の中だけで使う。 */
function hingeProbe(state){const faces=state.cache.faces,memo=new Map();
 const box=faces.map(f=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of f.poly){x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1])}return[x0,y0,x1,y1]});
 return p=>{const k=p[0]+','+p[1];let r=memo.get(k);if(r)return r;
  let top=null,dup=false;const seen=new Set();
  for(let i=0;i<faces.length;i++){const b=box[i];if(p[0]<b[0]||p[0]>b[2]||p[1]<b[1]||p[1]>b[3])continue;
   const f=faces[i];if(!strictlyInside(p,f.poly))continue;
   if(seen.has(f.layer))dup=true;else seen.add(f.layer);
   if(!top||f.layer>top.layer)top=f}
  r={dup,top:top?top.faceId:null};memo.set(k,r);return r}}
function hingeVisibleParts(state,row,probe){
 const X=state.cache.faces.find(f=>f.faceId===row.faceIds[0]);
 const Y=state.cache.faces.find(f=>f.faceId===row.faceIds[1]);
 if(!X||!Y)return{parts:[],reason:'背の片側の面が、いまの紙にありません'};
 const P=row.seg[0],Q=row.seg[1],d=[Q[0]-P[0],Q[1]-P[1]],L=Math.hypot(d[0],d[1]);
 if(L<1e-9)return{parts:[],reason:'背がつぶれています'};
 const n=[-d[1]/L,d[0]/L],pair=new Set(row.faceIds),ok=[],owner=[],why=[];
 const at=probe||hingeProbe(state);
 for(let i=0;i<HINGE_SAMPLES;i++){
  const t=(i+.5)/HINGE_SAMPLES,p=[P[0]+d[0]*t,P[1]+d[1]*t];
  let seen=false,own=null,note=null;
  for(const eps of HINGE_PROBE){
   const la=at([p[0]+n[0]*eps,p[1]+n[1]*eps]);
   const lb=at([p[0]-n[0]*eps,p[1]-n[1]*eps]);
   if(la.dup||lb.dup){note='同じ層の紙が重なっていて順位が決まりません';continue}
   const ta=la.top,tb=lb.top;
   if(ta===null&&tb===null){note='背の両側に紙がありません';continue}
   if(ta===tb){note='上に別の紙が乗っていて、背が見えていません';continue}
   if(!(pair.has(ta)||pair.has(tb))){note='上に別の紙が乗っていて、背が見えていません';continue}
   seen=true;own=pair.has(ta)?ta:tb;note=null;break}
  ok.push(seen);owner.push(own);if(!seen&&note)why.push(note)}
 const parts=[];let i=0;
 while(i<HINGE_SAMPLES){
  if(!ok[i]){i++;continue}
  let j=i;while(j+1<HINGE_SAMPLES&&ok[j+1]&&owner[j+1]===owner[i])j++;
  const t0=i/HINGE_SAMPLES,t1=(j+1)/HINGE_SAMPLES;
  const seg=[[P[0]+d[0]*t0,P[1]+d[1]*t0],[P[0]+d[0]*t1,P[1]+d[1]*t1]];
  parts.push({t0:round(t0),t1:round(t1),seg,ownerFaceId:owner[i],
   srcSeg:segKey([inv(X.xf,seg[0]),inv(X.xf,seg[1])]),
   len:round(Math.hypot(seg[1][0]-seg[0][0],seg[1][1]-seg[0][1]))});
  i=j+1}
 return{parts,reason:parts.length?null:(why[0]||null)}}
/* 折った背の区間ぜんぶ。ID＝`hinge:<stepId>#<素材座標で並べて何番目か>`。
   🚨結びの線を**両側の xf で写した所が一致**しない区間は候補にしない（`consistent:false` と理由を付けて報告する）。 */
/* 🚀 背の区間と可視判定の再利用（2026-09-15）。
   依存する値＝state.cache の中身（faces・bonds・hinges・creases＝digest）と、手の並び（id・diagramStep・kind）だけ。
   カメラ・ズーム・pending・revision には依存しない（可視判定は紙の座標で見る。画面の距離は呼び手が毎回測る）。
   鍵＝cache オブジェクト（WeakMap）＋ digest ＋ 手の並び。確定・取消・派生状態・undo/redo で cache が作り直されれば別の鍵、
   同じ cache が中身ごと書きかえられても digest が変わるので古い結果は使わない。
   返すのは毎回 JSON の複製（呼び手が書きかえても、ためた結果は汚れない。初回も同じ形で返す）。 */
const HINGE_MEMO=new WeakMap(),hingeMemoStats={hit:0,miss:0};
function hingeIntervals(state){
 const key=digest(state.cache)+'|'+JSON.stringify(state.recipe.steps.map(s=>[s.id,s.diagramStep||null,s.kind||null]));
 const hit=HINGE_MEMO.get(state.cache);
 if(hit&&hit.key===key){hingeMemoStats.hit++;return C(hit.rows)}
 hingeMemoStats.miss++;
 const rows=C(computeHingeIntervals(state));HINGE_MEMO.set(state.cache,{key,rows});return C(rows)}
function computeHingeIntervals(state){
 const order=new Map(state.recipe.steps.map((s,i)=>[s.id,i]));
 const stepOf=new Map(state.recipe.steps.map(s=>[s.id,s]));
 const rows=state.cache.bonds.filter(b=>b.kind==='hinge').map(b=>{
  const[x,y]=b.faceIds;
  const fx=state.cache.faces.find(f=>f.faceId===x),fy=state.cache.faces.find(f=>f.faceId===y);
  const sx=fx?b.seg.map(q=>apply(fx.xf,q)):null,sy=fy?b.seg.map(q=>apply(fy.xf,q)):null;
  const gap=sx&&sy?Math.max(Math.hypot(sx[0][0]-sy[0][0],sx[0][1]-sy[0][1]),Math.hypot(sx[1][0]-sy[1][0],sx[1][1]-sy[1][1])):Infinity;
  const consistent=!!(sx&&sy&&gap<=1e-6);
  const h=(state.cache.hinges||[]).find(v=>v.stepId===b.stepId&&v.faceIds.some(id=>descends(x,id))&&v.faceIds.some(id=>descends(y,id)));
  const st=stepOf.get(b.stepId)||{};
  return{stepId:b.stepId,bondId:b.bondId,hingeId:h?h.hingeId:null,
   faceIds:[x,y],sides:[sideInfo(fx),sideInfo(fy)],
   srcSeg:segKey(b.seg),seg:sx?C(sx):null,
   len:sx?round(Math.hypot(sx[1][0]-sx[0][0],sx[1][1]-sx[0][1])):0,
   paperRoot:paperRootOf(x),diagramStep:st.diagramStep||null,foldKind:st.kind||null,
   consistent,gap:consistent?0:round(gap)}});
 const probe=hingeProbe(state);
 const by=new Map();for(const r of rows){if(!by.has(r.stepId))by.set(r.stepId,[]);by.get(r.stepId).push(r)}
 const out=[];
 for(const stepId of[...by.keys()].sort((a,b)=>(order.get(a)??0)-(order.get(b)??0)||(a<b?-1:1))){
  /* 素材座標で安定ソート＝cache の並び順にも bondId にも依らない。 */
  const list=by.get(stepId).sort((a,b)=>{const x=segStr(a.srcSeg),y=segStr(b.srcSeg);
   return x<y?-1:x>y?1:(a.faceIds.join()<b.faceIds.join()?-1:a.faceIds.join()>b.faceIds.join()?1:0)});
  list.forEach((r,i)=>{const row={...r,index:i+1,intervalId:`hinge:${stepId}#${i+1}`};
   const v=row.consistent?hingeVisibleParts(state,row,probe):{parts:[],reason:'結びの線が両側で一致しません（紙が切り離されています）'};
   row.visibleParts=v.parts;row.visible=v.parts.length>0;row.reason=v.reason;out.push(row)})}
 return out}
/* pointerdown で凍結する意図。原本には書かない＝pending の中と画面の中だけで生きる値。
   ⚠`bondId` は入れない（cache の番号で解決させない）。区間のどこを指したかは**素材座標の部分線分**で持つ。 */
function hingeIntent(state,ref){
 const id=typeof ref==='string'?ref:(ref&&ref.intervalId);
 const h=hingeIntervals(state).find(v=>v.intervalId===id);
 if(!h)throw Error('そのヒンジの区間はありません');
 const part=(ref&&typeof ref==='object'&&ref.partSrcSeg)?C(ref.partSrcSeg):C(h.srcSeg);
 return{kind:'hinge',intervalId:h.intervalId,stepId:h.stepId,index:h.index,hingeId:h.hingeId,
  faceIds:C(h.faceIds),layerPaths:h.sides.map(s=>s?C(s.layerPath):null),
  srcSeg:C(h.srcSeg),partSrcSeg:part,paperRoot:h.paperRoot,revision:state.revision}}
/* 凍結した意図を、いまの紙で見つけ直す（rim/crease と同じ2段）。
   ①しぐさの最中（revision が同じ）＝intervalId と両側 faceId がぴたり一致するものだけ。
   ②紙が進んだあと＝**凍結した面の子**で、素材の区間が重なるものへ橋渡し。 */
function resolveHingeInterval(state,ref){if(!ref||ref.kind!=='hinge')return null;
 const all=hingeIntervals(state).filter(h=>h.stepId===ref.stepId&&h.consistent);
 const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
 const exact=all.find(h=>h.intervalId===ref.intervalId&&same(h.faceIds,ref.faceIds));
 if(exact)return exact;
 if(ref.revision===state.revision)return null;
 const kin=all.filter(h=>{
  const fwd=ref.faceIds.every((id,i)=>descends(h.faceIds[i],id));
  const rev=ref.faceIds.every((id,i)=>descends(h.faceIds[1-i],id));
  return(fwd||rev)&&overlapLen(ref.partSrcSeg,h.srcSeg)>1e-6});
 if(!kin.length)return null;
 return kin.sort((x,y)=>overlapLen(ref.partSrcSeg,y.srcSeg)-overlapLen(ref.partSrcSeg,x.srcSeg))[0]}
/* ================= E2：外周辺を折り目へ合わせる（幾何と検証。画面のことは知らない） =================
   180°折り返したとき、つかんだ外周辺**ぜんぶ**が、狙った折り目の**区間の中**へ乗る折りだけを候補にする。
   軸は2種類しかない：source と target が平行なら**2本の中央の平行線**、交わるなら**2本の角二等分線**。 */
const E2_ON_LINE=1e-6,E2_IN_SPAN=1e-6,E2_MIN_MOVE=.06;
const dirOf=s=>{const d=[s[1][0]-s[0][0],s[1][1]-s[0][1]],L=Math.hypot(d[0],d[1]);return L<1e-12?null:[d[0]/L,d[1]/L]};
const distLine=(p,s)=>{const u=dirOf(s);return u?Math.abs((p[0]-s[0][0])*u[1]-(p[1]-s[0][1])*u[0]):Infinity};
const spanOn=(p,s)=>{const u=dirOf(s),L=Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1]);
 return u&&L>1e-12?((p[0]-s[0][0])*u[0]+(p[1]-s[0][1])*u[1])/L:NaN};
function crossPoint(a,b){const u=dirOf(a),v=dirOf(b);if(!u||!v)return null;
 const den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<1e-9)return null;
 const t=((b[0][0]-a[0][0])*v[1]-(b[0][1]-a[0][1])*v[0])/den;
 return[a[0][0]+u[0]*t,a[0][1]+u[1]*t]}
function axesEdgeToCrease(src,tgt){const u=dirOf(src),v=dirOf(tgt);if(!u||!v)return[];
 if(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-9){/* 平行＝2本の中央の平行線…は1本だけ（向きは同じ） */
  const d=distLine(src[0],tgt);if(d<1e-9)return[];/* 同じ直線＝自分自身への一致 */
  const n=[-u[1],u[0]],sgn=((tgt[0][0]-src[0][0])*n[0]+(tgt[0][1]-src[0][1])*n[1])>=0?1:-1;
  const m=[src[0][0]+n[0]*sgn*d/2,src[0][1]+n[1]*sgn*d/2];
  return[{kind:'parallel',line:[[m[0]-u[0],m[1]-u[1]],[m[0]+u[0],m[1]+u[1]]]}]}
 const X=crossPoint(src,tgt);if(!X)return[];const out=[];
 for(const w of[[u[0]+v[0],u[1]+v[1]],[u[0]-v[0],u[1]-v[1]]]){const L=Math.hypot(w[0],w[1]);
  if(L<1e-9)continue;const d=[w[0]/L,w[1]/L];
  out.push({kind:'bisector',line:[[X[0]-d[0],X[1]-d[1]],[X[0]+d[0],X[1]+d[1]]]})}
 return out}
/* その軸で180°折り返したとき、辺の両端が折り目の線に乗り、辺ぜんぶが折り目の区間に収まるか。 */
function checkEdgeToCrease(axis,src,tgt){
 if(!dirOf(axis))return{ok:false,reason:'折軸が退化しています'};
 const a=reflect(src[0],axis[0],axis[1]),b=reflect(src[1],axis[0],axis[1]);
 const ends=[distLine(a,tgt),distLine(b,tgt)];
 if(Math.max(...ends)>E2_ON_LINE)return{ok:false,reason:'折り返しても辺が折り目の上に乗りません',ends};
 const sa=spanOn(a,tgt),sb=spanOn(b,tgt),lo=Math.min(sa,sb),hi=Math.max(sa,sb);
 if(lo<-E2_IN_SPAN||hi>1+E2_IN_SPAN)
  return{ok:false,reason:'辺の全体が折り目の区間に収まりません（部分的な重なりでは合わせません）',ends,span:[lo,hi]};
 const move=Math.max(Math.hypot(a[0]-src[0][0],a[1]-src[0][1]),Math.hypot(b[0]-src[1][0],b[1]-src[1][1]));
 if(move<E2_MIN_MOVE)return{ok:false,reason:'折り量が小さすぎます',ends,span:[lo,hi],move};
 return{ok:true,reason:null,ends,span:[lo,hi],move,reflected:[a,b]}}
/* 動く側の印＝「動く帯の重心より、つかんだ辺寄り6割」（角折り・辺折りと同じ規則）。 */
function sidePointFor(face,axis,src){
 const mid=[(src[0][0]+src[1][0])/2,(src[0][1]+src[1][1])/2];
 let A=axis[0],B=axis[1];if(S(mid,A,B)>0)[A,B]=[B,A];
 const part=split(face.poly,A,B)[1];if(!part||area(part)<1e-9)return null;
 const c=centroidOf(part);return[c[0]+(mid[0]-c[0])*.6,c[1]+(mid[1]-c[1])*.6]}
/* 凍結した edgeIntent から、いまの紙で「合わせられる折り目」を数え上げる。
   🚨target は**同じ原紙(paper)の crease 区間**ならよい。紙片(sheetId)が違っても、
      下の層に見えている折り目へ辺を合わせるのは折り紙のふつうの目印（2026-09-12・本人指示）。
      ⚠将来ほんとうに別の紙を扱うときに混ざらないよう、**faceId の根（原紙のID）**で確かめる。
      ⚠同じ紙片かどうかは `sameSheet` として残す＝吸着のときに優先するため（判定は緩めない）。 */
const paperRootOf=id=>String(id).split('/')[0];
/* 🦴✋ 見えている外形の背（2026-09-16・本人指示・つる⑫）＝辺合わせの「つかむ元」に加える。
   条件：①背の区間が一致している（consistent）②**見えている部分**（hingeVisibleParts）③**外形**＝その部分の両脇の片側に紙が1枚も無く、
   もう片側のいちばん上がその背の面（紙の内部の背・隠れた背はつかまない）。
   返す形は rimEdges の行と同じ項目（seg・faceId・sheetId・layerPath・edgeId）＋ kind:'hingeEdge'＝辺合わせの幾何（E2/H2/E3）はそのまま使える。 */
const OUTLINE_PROBE=[.004,.0015];
function outlineHingeEdges(state){const out=[];
 for(const h of hingeIntervals(state)){if(!h.consistent||!h.visible)continue;
  for(const part of h.visibleParts){const a=part.seg[0],b=part.seg[1],d=[b[0]-a[0],b[1]-a[1]],L=Math.hypot(d[0],d[1]);if(L<1e-9)continue;
   const n=[-d[1]/L,d[0]/L];let owner=null,ok=true;
   for(const t of[.2,.5,.8]){const m=[a[0]+d[0]*t,a[1]+d[1]*t];let seen=false;
    for(const eps of OUTLINE_PROBE){const sa=stackAt(state,[m[0]+n[0]*eps,m[1]+n[1]*eps]),sb=stackAt(state,[m[0]-n[0]*eps,m[1]-n[1]*eps]);
     if(!!sa.length===!!sb.length)continue;/* 両側に紙がある（内部）・両側とも無い＝決めない */
     const top=(sa.length?sa:sb)[0].faceId;if(!h.faceIds.includes(top))continue;
     if(owner&&owner!==top){ok=false;break}owner=top;seen=true;break}
    if(!seen||!ok){ok=false;break}}
   if(!ok||!owner)continue;
   const f=state.cache.faces.find(v=>v.faceId===owner);
   out.push({kind:'hingeEdge',edgeId:`hingeEdge:${h.intervalId}@${part.t0}-${part.t1}`,rimId:null,label:'外形の背',intervalId:h.intervalId,stepId:h.stepId,
    faceIds:C(h.faceIds),faceId:owner,layerPath:C(f.layerPath),sheetId:sheetKey(state,owner),layer:f.layer,
    srcSeg:segKey([inv(f.xf,a),inv(f.xf,b)]),partSrcSeg:C(part.srcSeg),seg:[C(a),C(b)]})}}
 return out.sort((x,y)=>x.edgeId<y.edgeId?-1:x.edgeId>y.edgeId?1:0)}
/* pointerdown で凍結する意図（rim の edgeIntent と同じ役目）。 */
function hingeEdgeIntent(state,edgeId){const e=outlineHingeEdges(state).find(v=>v.edgeId===edgeId);
 if(!e)throw Error('その外形の背はありません');
 return{kind:'hingeEdge',edgeId:e.edgeId,intervalId:e.intervalId,stepId:e.stepId,faceIds:C(e.faceIds),faceId:e.faceId,
  layerPath:C(e.layerPath),sheetId:e.sheetId,layer:e.layer,srcSeg:C(e.srcSeg),partSrcSeg:C(e.partSrcSeg),revision:state.revision}}
/* つかむ元の辺を、いまの紙で見つけ直す。rim は今までどおり resolveRimEdge（1文字も変えない）。
   外形の背は ①しぐさの最中（revision が同じ）＝edgeId と面がぴたり一致 ②紙が進んだあと＝同じ背（resolveHingeInterval の橋渡し）の外形の部分で、素材の区間が重なるもの。 */
function resolveSourceEdge(state,ref){if(!ref)return null;
 if(ref.kind==='edge')return resolveRimEdge(state,ref);
 if(ref.kind!=='hingeEdge')return null;
 const all=outlineHingeEdges(state);
 const exact=all.find(e=>e.edgeId===ref.edgeId&&e.faceId===ref.faceId&&e.sheetId===ref.sheetId);
 if(exact)return exact;
 if(ref.revision===state.revision)return null;
 const h=resolveHingeInterval(state,{kind:'hinge',stepId:ref.stepId,intervalId:ref.intervalId,faceIds:ref.faceIds,partSrcSeg:ref.partSrcSeg,revision:ref.revision});
 if(!h)return null;
 const kin=all.filter(e=>e.intervalId===h.intervalId&&overlapLen(ref.partSrcSeg,e.partSrcSeg)>1e-6);
 return kin.sort((x,y)=>overlapLen(ref.partSrcSeg,y.partSrcSeg)-overlapLen(ref.partSrcSeg,x.partSrcSeg))[0]||null}
/* 🦴✋ 外形の背から折り目へ合わせるときだけ、合わせ先の折り目の区間を「同じ直線上で途切れずに続く見えている目印」まで延ばす。
   目印＝折り目の区間（E2 の相手と同じ）と、最上面に見えている外周辺（E3 の相手と同じ rimEdgeVisible）。同じ原紙だけ。
   つる⑫：中心線は「生のふち」と「折り目」が1点で続いた線＝どちらか1本の区間には外形の背の全体が収まらない。
   🚨「辺の全体が目印の上に乗る」（checkEdgeToCrease）は変えない＝延ばした線からはみ出る合わせ方は今までどおり断る。
   ⚠rim（生のふち）をつかむ既存の道では延ばさない＝既存の候補・理由は1文字も変わらない。 */
function extendGuide(state,seg,root){
 const u=dirOf(seg);if(!u)return C(seg);
 const guides=[...creaseIntervals(state).filter(c=>paperRootOf(c.faceId)===root).map(c=>c.seg),
  ...rimEdges(state).filter(e=>paperRootOf(e.faceId)===root&&rimEdgeVisible(state,e)).map(e=>e.seg)]
  .filter(g=>onSameLine(seg,g)&&onSameLine(g,seg));
 const t=p=>(p[0]-seg[0][0])*u[0]+(p[1]-seg[0][1])*u[1];
 let lo=Math.min(t(seg[0]),t(seg[1])),hi=Math.max(t(seg[0]),t(seg[1])),grew=true;
 while(grew){grew=false;
  for(const g of guides){const a=Math.min(t(g[0]),t(g[1])),b=Math.max(t(g[0]),t(g[1]));
   if(a<lo-1e-9&&b>=lo-1e-9){lo=a;grew=true}
   if(b>hi+1e-9&&a<=hi+1e-9){hi=b;grew=true}}}
 const at=v=>[seg[0][0]+u[0]*v,seg[0][1]+u[1]*v];
 return[at(lo),at(hi)]}
function edgeToCreaseOptions(state,edgeRef){
 const e=resolveSourceEdge(state,edgeRef);
 if(!e)return{source:null,options:[],reason:'つかんだ辺が、いまの紙にありません'};
 const face=state.cache.faces.find(f=>f.faceId===e.faceId);
 if(!face)return{source:null,options:[],reason:'つかんだ辺の面が、いまの紙にありません'};
 const root=paperRootOf(e.faceId),options=[];
 for(const c of creaseIntervals(state)){
  if(paperRootOf(c.faceId)!==root)continue;
  const tseg=e.kind==='hingeEdge'?extendGuide(state,c.seg,root):c.seg;
  for(const ax of axesEdgeToCrease(e.seg,c.seg)){
   const v=checkEdgeToCrease(ax.line,e.seg,tseg);
   const sp=v.ok?sidePointFor(face,ax.line,e.seg):null;
   options.push({target:e.kind==='hingeEdge'?{...c,seg:tseg,creaseSeg:C(c.seg)}:c,axis:ax.line,kind:ax.kind,sidePoint:sp,sameSheet:c.sheetId===e.sheetId,
    ...v,ok:!!(v.ok&&sp),reason:v.ok&&!sp?'折線が面を二つに分けません':v.reason})}}
 return{source:e,face,options,reason:null}}
/* 確定の直前に、凍結した意図から**軸を作り直して**突き合わせる。画面が作った線は信じない。
   🚨`corner` を渡したときだけ、**凍結した角が「合わせる辺の端」であること**も確かめる
      （角セッションから E2 を使う道。辺を直接つかむ道は corner を渡さない＝1文字も変わらない）。 */
function verifyEdgeToCrease(state,edgeRef,creaseRef,a,b,corner){
 const e=resolveSourceEdge(state,edgeRef);if(!e)return{ok:false,reason:'つかんだ辺が、いまの紙にありません'};
 if(corner&&!e.seg.some(p=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<1e-6))
  return{ok:false,reason:'つかんだ角が、合わせる辺の端にありません'};
 const c=resolveCreaseInterval(state,creaseRef);if(!c)return{ok:false,reason:'合わせる折り目が、いまの紙にありません'};
 if(paperRootOf(c.faceId)!==paperRootOf(e.faceId))return{ok:false,reason:'別の紙の折り目へは合わせられません'};
 const want=[[a[0],a[1]],[b[0],b[1]]];
 for(const ax of axesEdgeToCrease(e.seg,c.seg)){
  if(distLine(want[0],ax.line)>1e-6||distLine(want[1],ax.line)>1e-6)continue;/* 同じ直線でない */
  const v=checkEdgeToCrease(ax.line,e.seg,e.kind==='hingeEdge'?extendGuide(state,c.seg,paperRootOf(c.faceId)):c.seg);
  if(v.ok)return{ok:true,reason:null,source:e,target:c,axis:ax.line,kind:ax.kind,ends:v.ends,span:v.span,move:v.move};
  return{ok:false,reason:v.reason}}
 return{ok:false,reason:'折軸が、つかんだ辺と折り目から作り直せません'}}
/* 「この場所の上からn枚」→ 動く側に面積のある面ぜんぶ＋折り目でつながった紙片の閉包。
   🚨「上からn枚」は**この場所の重なりの上からn枚**であって、「layer番号が同じ面ぜんぶ」ではない。
      層番号は積み直しで場所ごとに決まるので、紙の別の所にも同じ番号の面がふつうに居る。そこまで
      対象に入れると、一度のしぐさで**指の下にない離れた紙が別々に持ち上がり、紙が開いて見える**
      （2026-09-12・本人が画像で指摘）。素材でつながっていないので破れ検査には出ない＝L群では掴めない。
      折り目でつながった紙だけは、離れていても一緒に動かないと裂けるので、下の閉包で足す。 */
/* ================= 🦴📐 H2：つかんだ外周辺を、見えている「折った背」へ合わせる =================
   幾何は E2 のまま（`axesEdgeToCrease`・`checkEdgeToCrease`・`sidePointFor`を再利用）。
   変えるのは **target が crease 区間から H1 の visible hinge 区間になる**ところだけ。
   🚨背は「2面の境目」なので、crease には無い関門が1つ増える：
   > **合わせ先の背は、0°／90°／180°のどこでも提案前の位置に居ること。**
   接している面が動くかどうかだけでは断らない（軸の上にある背は、面が回っても動かない）。
   一部だけが固定なら、**固定部分へ切り分けて**そこに収まるかで見る（黙って短縮しない）。 */
const H2_STATIONARY=1e-9;
/* 「この折りで動く面」を、setSide と同じ規則で先読みする（pending は触らない）。 */
function movingIdsFor(state,faceId,a,b,sidePoint){
 const sheet=sheetOf(state,faceId);let A=a,B=b;if(S(sidePoint,A,B)>0)[A,B]=[B,A];
 return sheet.filter(f=>{const c=split(f.poly,A,B)[1];return!!(c&&area(c)>1e-9)}).map(f=>f.faceId)}
/* target の区間のうち、この折りで**動かない部分**。接している面がどちらも動かなければ全体。
   動く面が絡むなら、折軸の上（回しても動かない）か、折軸の止まる側の断片だけ。 */
function fixedHingePart(partSeg,faceIds,ids,a,b,sidePoint){
 const set=new Set(ids);
 if(!faceIds.some(id=>set.has(id)))return{seg:[C(partSeg[0]),C(partSeg[1])],cut:false};
 let A=a,B=b;if(S(sidePoint,A,B)>0)[A,B]=[B,A];/* 動く側を S<0 へ */
 if(partSeg.every(p=>Math.abs(S(p,A,B))<=1e-9))return{seg:[C(partSeg[0]),C(partSeg[1])],cut:false};
 const part=cutSegment(partSeg,A,B),keep=part.keep;/* keep＝S>=0＝止まる側 */
 if(!keep||Math.hypot(keep[1][0]-keep[0][0],keep[1][1]-keep[0][1])<1e-9)
  return{seg:null,cut:true,reason:'合わせ先の背が、この折りで動いてしまいます'};
 return{seg:[C(keep[0]),C(keep[1])],cut:true}}
/* ★背の不変条件：0°／90°／180°のそれぞれで、区間の**両端と内部の点**が提案前と同じ位置か。
   置き方の規則は geometry と同じ（`foldRotator`）。軸の上なら自然に不動になる。 */
function hingeStaysUnderFold(seg,faceIds,ids,a,b,kind,sidePoint){
 const set=new Set(ids);
 if(!faceIds.some(id=>set.has(id)))return{ok:true,reason:null,worst:0};
 let A=a,B=b;if(S(sidePoint,A,B)>0)[A,B]=[B,A];
 let worst=0;
 for(const ang of[0,90,180]){const rot=foldRotator(A,B,ang,kind);
  for(let i=0;i<=4;i++){const u=i/4,p=[seg[0][0]+(seg[1][0]-seg[0][0])*u,seg[0][1]+(seg[1][1]-seg[0][1])*u];
   const stay=[p[0],0,-p[1]],put=S(p,A,B)<-1e-9?rot(p):stay;
   worst=Math.max(worst,Math.hypot(put[0]-stay[0],put[1]-stay[1],put[2]-stay[2]))}}
 return worst<=H2_STATIONARY?{ok:true,reason:null,worst}
  :{ok:false,reason:'合わせ先の背が、この折りで動いてしまいます',worst}}
/* 凍結した edgeIntent から、いまの紙で「合わせられる見えている背」を数え上げる。 */
function edgeToHingeOptions(state,edgeRef){
 const e=resolveSourceEdge(state,edgeRef);
 if(!e)return{source:null,options:[],reason:'つかんだ辺が、いまの紙にありません'};
 const face=state.cache.faces.find(f=>f.faceId===e.faceId);
 if(!face)return{source:null,options:[],reason:'つかんだ辺の面が、いまの紙にありません'};
 const root=paperRootOf(e.faceId),options=[];
 for(const h of hingeIntervals(state)){
  if(!h.consistent||!h.visible)continue;
  if(paperRootOf(h.faceIds[0])!==root)continue;
  if(h.faceIds.includes(e.faceId)&&onSameLine(h.seg,e.seg))continue;/* 自分の面の足元の線は相手にしない */
  for(const part of h.visibleParts){/* 🚨見えている部分だけ＝覚えていない背はこのループが0回 */
   for(const ax of axesEdgeToCrease(e.seg,part.seg)){
    const sp=sidePointFor(face,ax.line,e.seg);
    const cuts=sp?axisSplitsSheet(state,face.faceId,ax.line[0],ax.line[1]):false;
    let ok=!!(sp&&cuts),reason=!sp?'折線が面を二つに分けません':(cuts?null:'折線が紙を二つに分けません'),fix=null,stay=null,v=null;
    if(ok){const ids=movingIdsFor(state,face.faceId,ax.line[0],ax.line[1],sp);
     fix=fixedHingePart(part.seg,h.faceIds,ids,ax.line[0],ax.line[1],sp);
     if(!fix.seg){ok=false;reason=fix.reason}
     else{stay=hingeStaysUnderFold(fix.seg,h.faceIds,ids,ax.line[0],ax.line[1],'V',sp);
      /* 谷でも山でも「動くか」は同じ（山は高さの符号だけ）ので V で見れば足りる。
         ⚠ここは fixedHingePart で切ったあとなので必ず通る（保险）。
         独立した意味を持つのは **confirm の verifyEdgeToHinge**＝対象面が増えているかもしれない場面。 */
      if(!stay.ok){ok=false;reason=stay.reason}
      else{v=checkEdgeToCrease(ax.line,e.seg,fix.seg);
       if(!v.ok){ok=false;reason=v.reason}}}}
    options.push({target:{...h,part,fixedSeg:fix?fix.seg:null,cut:!!(fix&&fix.cut)},
     axis:ax.line,kind:ax.kind,sidePoint:sp,sameSheet:h.faceIds.some(id=>sheetKey(state,id)===e.sheetId),
     stationary:stay?stay.worst:null,...(v||{}),ok,reason})}}}
 return{source:e,face,options,reason:null}}
/* 確定の直前に、凍結した意図（辺・背・角）から**軸を作り直して**突き合わせる。
   画面が作った線は信じない。背の不変条件も、確定する**対象面の集合そのもの**で見直す。 */
function verifyEdgeToHinge(state,edgeRef,hingeRef,a,b,corner,ids,kind){
 const e=resolveSourceEdge(state,edgeRef);if(!e)return{ok:false,reason:'つかんだ辺が、いまの紙にありません'};
 if(corner&&!e.seg.some(p=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<1e-6))
  return{ok:false,reason:'つかんだ角が、合わせる辺の端にありません'};
 const h=resolveHingeInterval(state,hingeRef);
 if(!h)return{ok:false,reason:'合わせ先の背が、いまの紙にありません'};
 if(!h.consistent||!h.visible)return{ok:false,reason:'合わせ先の背が、いまは見えていません'};
 if(paperRootOf(h.faceIds[0])!==paperRootOf(e.faceId))return{ok:false,reason:'別の紙の背へは合わせられません'};
 /* 凍結した部分区間が、いまも**同じ可視区間の中**にあること（後続分割で別の区間になったら断る）。 */
 const want=hingeRef.partSrcSeg,wantLen=Math.hypot(want[1][0]-want[0][0],want[1][1]-want[0][1]);
 const part=h.visibleParts.find(q=>overlapLen(q.srcSeg,want)>=wantLen-1e-6);
 if(!part)return{ok:false,reason:'合わせ先の背が、いまは同じ区間ではありません'};
 const set=ids&&ids.length?ids:[e.faceId];
 for(const ax of axesEdgeToCrease(e.seg,part.seg)){
  if(distLine(a,ax.line)>1e-6||distLine(b,ax.line)>1e-6)continue;/* 画面が持っている線と同じ直線か */
  const sp=sidePointFor(state.cache.faces.find(f=>f.faceId===e.faceId),ax.line,e.seg);
  if(!sp)return{ok:false,reason:'折線が面を二つに分けません'};
  if(!axisSplitsSheet(state,e.faceId,ax.line[0],ax.line[1]))return{ok:false,reason:'折線が紙を二つに分けません'};
  const fix=fixedHingePart(part.seg,h.faceIds,set,ax.line[0],ax.line[1],sp);
  if(!fix.seg)return{ok:false,reason:fix.reason};
  const stay=hingeStaysUnderFold(fix.seg,h.faceIds,set,ax.line[0],ax.line[1],kind||'V',sp);
  if(!stay.ok)return{ok:false,reason:stay.reason};
  const v=checkEdgeToCrease(ax.line,e.seg,fix.seg);
  if(!v.ok)return{ok:false,reason:v.reason};
  return{ok:true,reason:null,source:e,target:h,part,fixedSeg:fix.seg,axis:ax.line,kind:ax.kind,
   ends:v.ends,span:v.span,move:v.move,stationary:stay.worst}}
 return{ok:false,reason:'折軸が、つかんだ辺と折った背から作り直せません'}}
/* ================= 🪚 E3：つかんだ外周辺を、見えている**別の外周辺**へ合わせる =================
   幾何と関門は E2/H2 のまま（`axesEdgeToCrease`・`checkEdgeToCrease`・`sidePointFor`・
   `movingIdsFor`・`fixedHingePart`・`hingeStaysUnderFold` を再利用）。変えるのは target の種類だけ。
   target の条件（本人指示）：①同じ原紙②source とは別の区間③**最上面に見えている**
   ④**提案している間も動かない**（一部だけ固定なら固定部分へ切り分けて、そこに収まるかで見る）。
   内部辺・隠れた下層の辺・見かけの輮郭は `rimEdges` がそもそも返さない。 */
const E3_PROBE=[.01,.004,.0015];
/* 🚨軸が**紙片を二つに分けない**候補は折りでない（面を丸ごと裏返すだけ）。
   `proposeOnFace` の `validateSheet` が同じ規則で断るので、候補の時点で同じものを見る
   （さもないと、吸着はするのに提案で例外になる←E3で踏んだ）。 */
function axisSplitsSheet(state,faceId,a,b){let k=false,c=false;
 for(const f of sheetOf(state,faceId)){const p=split(f.poly,a,b);if(p[0])k=true;if(p[1])c=true}
 return k&&c}
/* その外周辺が「いま最上面に見えている」か＝E1.5 のつかみと同じ規則（内向きに少し入った点の stackAt）。 */
function rimEdgeVisible(state,e){
 const f=state.cache.faces.find(v=>v.faceId===e.faceId);if(!f)return false;
 const a=e.seg[0],b=e.seg[1],d=[b[0]-a[0],b[1]-a[1]],L=Math.hypot(d[0],d[1]);
 if(L<1e-9)return false;
 const c=centroidOf(f.poly),u=[d[0]/L,d[1]/L];
 const w=[c[0]-a[0],c[1]-a[1]],tt=w[0]*u[0]+w[1]*u[1];
 const n0=[w[0]-tt*u[0],w[1]-tt*u[1]],m=Math.hypot(n0[0],n0[1]);
 if(m<1e-12)return false;
 const n=[n0[0]/m,n0[1]/m];
 for(const t of[.5,.25,.75]){const p=[a[0]+d[0]*t,a[1]+d[1]*t];
  for(const eps of E3_PROBE){const q=[p[0]+n[0]*eps,p[1]+n[1]*eps];
   if(!strictlyInside(q,f.poly))continue;
   const st=stackAt(state,q);
   if(st.length&&st[0].faceId===e.faceId)return true;
   break}}
 return false}
function edgeToEdgeOptions(state,edgeRef){
 const e=resolveSourceEdge(state,edgeRef);
 if(!e)return{source:null,options:[],reason:'つかんだ辺が、いまの紙にありません'};
 const face=state.cache.faces.find(f=>f.faceId===e.faceId);
 if(!face)return{source:null,options:[],reason:'つかんだ辺の面が、いまの紙にありません'};
 const root=paperRootOf(e.faceId),options=[];
 for(const tg of rimEdges(state)){
  if(tg.edgeId===e.edgeId)continue;/* 同じ区間は相手にしない */
  if(tg.faceId===e.faceId)continue;/* 同じ面の足元の辺は相手にしない */
  if(paperRootOf(tg.faceId)!==root)continue;/* 同じ原紙だけ */
  if(!rimEdgeVisible(state,tg))continue;/* 最上面に見えている区間だけ */
  for(const ax of axesEdgeToCrease(e.seg,tg.seg)){
   const sp=sidePointFor(face,ax.line,e.seg);
   const cuts=sp?axisSplitsSheet(state,face.faceId,ax.line[0],ax.line[1]):false;
   let ok=!!(sp&&cuts),reason=!sp?'折線が面を二つに分けません':(cuts?null:'折線が紙を二つに分けません'),fix=null,stay=null,v=null;
   if(ok){const ids=movingIdsFor(state,face.faceId,ax.line[0],ax.line[1],sp);
    fix=fixedHingePart(tg.seg,[tg.faceId],ids,ax.line[0],ax.line[1],sp);
    if(!fix.seg){ok=false;reason='合わせ先のふちが、この折りで動いてしまいます'}
    else{stay=hingeStaysUnderFold(fix.seg,[tg.faceId],ids,ax.line[0],ax.line[1],'V',sp);
     if(!stay.ok){ok=false;reason='合わせ先のふちが、この折りで動いてしまいます'}
     else{v=checkEdgeToCrease(ax.line,e.seg,fix.seg);
      if(!v.ok){ok=false;reason=v.reason}}}}
   options.push({target:{...tg,fixedSeg:fix?fix.seg:null,cut:!!(fix&&fix.cut)},
    axis:ax.line,kind:ax.kind,sidePoint:sp,sameSheet:tg.sheetId===e.sheetId,
    stationary:stay?stay.worst:null,...(v||{}),ok,reason})}}
 return{source:e,face,options,reason:null}}
/* 確定の直前に、凍結した意図（source の辺・target の辺・角）から**軸を作り直して**突き合わせる。 */
function verifyEdgeToEdge(state,edgeRef,targetRef,a,b,corner,ids,kind){
 const e=resolveSourceEdge(state,edgeRef);if(!e)return{ok:false,reason:'つかんだ辺が、いまの紙にありません'};
 if(corner&&!e.seg.some(p=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<1e-6))
  return{ok:false,reason:'つかんだ角が、合わせる辺の端にありません'};
 const tg=resolveRimEdge(state,targetRef);
 if(!tg)return{ok:false,reason:'合わせ先のふちが、いまの紙にありません'};
 if(tg.edgeId===e.edgeId||tg.faceId===e.faceId)return{ok:false,reason:'同じ辺へは合わせられません'};
 if(paperRootOf(tg.faceId)!==paperRootOf(e.faceId))return{ok:false,reason:'別の紙のふちへは合わせられません'};
 if(!rimEdgeVisible(state,tg))return{ok:false,reason:'合わせ先のふちが、いまは見えていません'};
 const set=ids&&ids.length?ids:[e.faceId];
 for(const ax of axesEdgeToCrease(e.seg,tg.seg)){
  if(distLine(a,ax.line)>1e-6||distLine(b,ax.line)>1e-6)continue;
  const sp=sidePointFor(state.cache.faces.find(f=>f.faceId===e.faceId),ax.line,e.seg);
  if(!sp)return{ok:false,reason:'折線が面を二つに分けません'};
  if(!axisSplitsSheet(state,e.faceId,ax.line[0],ax.line[1]))return{ok:false,reason:'折線が紙を二つに分けません'};
  const fix=fixedHingePart(tg.seg,[tg.faceId],set,ax.line[0],ax.line[1],sp);
  if(!fix.seg)return{ok:false,reason:'合わせ先のふちが、この折りで動いてしまいます'};
  const stay=hingeStaysUnderFold(fix.seg,[tg.faceId],set,ax.line[0],ax.line[1],kind||'V',sp);
  if(!stay.ok)return{ok:false,reason:'合わせ先のふちが、この折りで動いてしまいます'};
  const v=checkEdgeToCrease(ax.line,e.seg,fix.seg);
  if(!v.ok)return{ok:false,reason:v.reason};
  return{ok:true,reason:null,source:e,target:tg,fixedSeg:fix.seg,axis:ax.line,kind:ax.kind,
   ends:v.ends,span:v.span,move:v.move,stationary:stay.worst}}
 return{ok:false,reason:'折軸が、つかんだ辺と合わせ先のふちから作り直せません'}}
function topFaces(state,at,n,a,b){const{layers,duplicated,stack}=layersAt(state,at);
 if(duplicated.length)throw Error('同じ層の紙が重なっていて順位が決まりません');
 if(!layers.length)throw Error('その場所に紙がありません');
 if(!Number.isInteger(n)||n<1||n>layers.length)throw Error(`上から${n}枚は選べません（この場所は${layers.length}枚です）`);
 const want=new Set(layers.slice(0,n)),movingArea=f=>{const c=split(f.poly,a,b)[1];return!!(c&&area(c)>1e-9)};
 const here=new Set(stack.map(v=>v.faceId));/* この場所にある面だけ＝指の下の重なりから選ぶ。 */
 const ids=new Set(state.cache.faces.filter(f=>want.has(f.layer)&&here.has(f.faceId)&&movingArea(f)).map(f=>f.faceId));
 if(!ids.size)throw Error('折線の動く側に、選んだ層の紙がありません');
 for(const id of[...ids])for(const q of sheetIds(state.cache.bonds,id)){
  const f=state.cache.faces.find(v=>v.faceId===q);if(f&&movingArea(f))ids.add(q)}
 return[...ids]}
/* 選んだ面の集合が、折線ぜんぶで一貫して折れるか。断るときは理由を返す（throwしない）。
   ★芯は foldableSet（面と結びだけを見る）。原本の再生も、UIの候補判定も、同じここを通る。 */
function foldability(state,ids,a,b,kind,at){const r=foldableSet(state.cache.faces,state.cache.bonds,ids,a,b,kind);
 if(!r.ok)return r;
 if(at){const c=contiguousAt(state,ids,at);if(!c.ok)return c}
 return r}
/* その場所で「上から続けて」選んでいること＝中の紙だけ・飛び飛びを断る（画面で選ぶときだけの決まり）。折りと折り目だけで同じ1つの規則。 */
function contiguousAt(state,ids,at){const set=new Set(ids),{layers,duplicated}=layersAt(state,at);
 if(duplicated.length)return{ok:false,reason:'同じ層の紙が重なっていて順位が決まりません',blocking:[]};
 const here=stackAt(state,at).filter(v=>set.has(v.faceId)).map(v=>v.layer);
 if(!here.length)return{ok:false,reason:'その場所の紙が選ばれていません',blocking:[]};
 const want=layers.slice(0,here.length);
 if(here.some((v,i)=>v!==want[i]))return{ok:false,reason:'上から続けて選んでください（中の紙だけ・飛び飛びは折れません）',blocking:[]};
 return{ok:true,reason:null,blocking:[]}}
/* ✏️ 折り目だけ（op:'crease'）の候補の判定（2026-09-15）。
   🚨紙は動かない＝確定（confirm の crease）と再生（replayV1 の crease）は foldableSet（上に乗る紙・裂け）をかけない。
     ⚠以前は「上からN枚」（setLayers）だけが折りの foldability をかけていた＝確定なら通る折り目を、枚数を選ぶ段で断っていた
       （つる⑦の上の三角 P→P'：上から1枚＝一番上の紙の左右の半分と凧形の外側の4面。一番上と2枚目の脇をつなぐ背 P-B を「動く側に残った結び」と数えて裂けとした）。
   ここで見るのは折り目に意味のある3つだけ（折りの判定は1文字も変えない）：
     ①その場所で上から続けて選んでいる（contiguousAt＝折りと同じ規則）
     ②選んだ紙の中に、折り目の線で二つに分かれる面がある（折り目が1本も入らない選び方を断る）
     ③線で二つに分かれる面と平らな折り目でつながり、同じ線で二つに分かれる面は、ぜんぶ入っている（折り目が紙の途中で途切れない） */
function creasability(state,ids,a,b,at){const r=creasableSet(state.cache.faces,state.cache.bonds,ids,a,b);
 if(!r.ok)return r;
 if(at){const c=contiguousAt(state,ids,at);if(!c.ok)return c}
 return r}
/* 芯（面と結びだけを見る）＝提案・枚数選び・確定（creasability 経由）と原本の再生（replayV1）が同じここを通る。 */
function creasableSet(all,bonds,ids,a,b){const set=new Set(ids);
 const missing=[...set].filter(i=>!all.some(f=>f.faceId===i));
 if(missing.length)return{ok:false,reason:'いまの紙にない面が選ばれています',blocking:missing};
 const cuts=f=>{const p=split(f.poly,a,b);return!!(p[0]&&p[1]&&area(p[0])>1e-9&&area(p[1])>1e-9)};
 const split2=all.filter(f=>set.has(f.faceId)&&cuts(f));
 if(!split2.length)return{ok:false,reason:'折り目の線が、選んだ紙を二つに分けていません',blocking:[]};
 const miss=[];
 for(const f of split2)for(const q of sheetIds(bonds,f.faceId)){if(set.has(q))continue;
  const g=all.find(v=>v.faceId===q);if(g&&cuts(g))miss.push(q)}
 if(miss.length)return{ok:false,reason:'折り目でつながった紙が選ばれていません（折り目が途中で途切れます）',blocking:[...new Set(miss)]};
 return{ok:true,reason:null,blocking:[]}}
/* いまの候補（pending）の成立を、候補の操作（q.op）で決める＝画面は判定を選ばない。
   op が 'crease' なら creasability、それ以外（'fold'・指定なし）は今までどおり foldability。 */
function pendingCheck(state){const q=foldPending(state,'先に折線を引いてください');
 if(!q.sidePoint||!q.candidates.length)return{ok:false,reason:'対象面または折る側が未選択です',blocking:[]};
 const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId);if(!f)return{ok:false,reason:'基準の面がいまの紙にありません',blocking:[]};
 const sp=apply(f.xf,q.sidePoint);let A=q.displayLine[0],B=q.displayLine[1];if(S(sp,A,B)>0)[A,B]=[B,A];
 const ids=q.candidates.map(c=>c.faceId);
 return q.op==='crease'?creasability(state,ids,A,B,q.at):foldability(state,ids,A,B,q.kind,q.at)}
/* ④の物差し＝結び bd の線（いまの座標）が、折線 a→b の動く側（S<0）の**内部**に区間として入るか。
   正規化距離 1e-9 より内側に端があり、動く側に切り出した区間が 1e-7 より長いときだけ「入る」。軸の線の上に乗っているだけは入らない。
   🚨foldableSet④（裂ける）と proposeOpen（動く面の集合をたどる）が**同じこの1本**を使う＝軸の判定と許容差を二重に持たない。 */
function bondInMovingSide(all,bd,a,b){
 const fx=all.find(v=>v.faceId===bd.faceIds[0]),fy=all.find(v=>v.faceId===bd.faceIds[1]);if(!fx||!fy)return false;
 const nd=Math.hypot(b[0]-a[0],b[1]-a[1])||1,sideN=q=>S(q,a,b)/nd;
 const cur=bd.seg.map(q=>apply(fx.xf,q));
 if(sideN(cur[0])>=-1e-9&&sideN(cur[1])>=-1e-9)return false;/* 動く側の内部に入っていない */
 const part=cutSegment(cur,a,b);
 return!!(part.cut&&Math.hypot(part.cut[0][0]-part.cut[1][0],part.cut[0][1]-part.cut[1][1])>1e-7)}
function foldableSet(all,bonds,ids,a,b,kind){const set=new Set(ids);
 const missing=[...set].filter(i=>!all.some(f=>f.faceId===i));
 if(missing.length)return{ok:false,reason:'いまの紙にない面が選ばれています',blocking:missing};
 const area2=poly=>{let n=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)n+=poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1];return Math.abs(n)/2};
 const chosen=all.filter(f=>set.has(f.faceId)),piece=f=>{const c=split(f.poly,a,b)[1];return c&&area2(c)>1e-9?c:null};
 const parts=chosen.map(f=>({f,p:piece(f)}));
 const idle=parts.filter(v=>!v.p).map(v=>v.f.faceId);
 if(idle.length===parts.length)return{ok:false,reason:'折線の動く側に、選んだ紙がありません',blocking:[]};
 if(idle.length)return{ok:false,reason:'動く側に面積のない面が選ばれています',blocking:idle};
 /* ①上に乗っている紙を置き去りにしない。谷折りなら選ばなかった紙は必ず下、山折りなら必ず上。 */
 const block=[];
 for(const{f,p}of parts)for(const u of all){if(set.has(u.faceId))continue;
  if(!overlapsArea(p,u.poly))continue;
  if(u.layer===f.layer||(kind==='V'?u.layer>f.layer:u.layer<f.layer))block.push(u.faceId)}
 if(block.length)return{ok:false,blocking:[...new Set(block)],
  reason:kind==='V'?'上に乗っている紙があります（その紙も一緒に選んでください）':'下に敷かれている紙があります（その紙も一緒に選んでください）'};
 /* ②紙片はちぎれない＝折り目でつながっていて動く側に面積がある面は、全部入っていること。 */
 const miss=[];
 for(const f of chosen)for(const q of sheetIds(bonds,f.faceId)){if(set.has(q))continue;
  const g=all.find(v=>v.faceId===q);if(g&&piece(g))miss.push(q)}
 if(miss.length)return{ok:false,reason:'折り目でつながった紙が選ばれていません',blocking:[...new Set(miss)]};
 /* 🚨④結び(hinge も crease も)が「選んだ側／選ばなかった側」にまたがったまま、動く側の内部に残っていないか。
    残っていたら、動く紙が隣の紙から引きちぎられる（90°で口が開き、180°でも開いたまま）。
    ⚠②の紙片の閉包は crease しかたどらないので、hinge をここで見ないと素通りする。
      実際これで抜けた：選ばれていない相手が「下の層」だと①（上に乗っている紙）にも引っかからない。
    ⚠端点だけでなく線分ぜんぶで見る＝折線の上に乗っているだけの結びは、そこで折れるので通す。
      結び全体が止まる側に残る場合も通す。 */
 const torn=[];
 for(const bd of bonds){const[x,y]=bd.faceIds,hx=set.has(x),hy=set.has(y);
  if(hx===hy)continue;/* 両方動く・両方止まる＝またいでいない */
  if(!bondInMovingSide(all,bd,a,b))continue;
  torn.push(hx?y:x)}
 if(torn.length)return{ok:false,blocking:[...new Set(torn)],
  reason:'つながっている紙が置き去りになって裂けます（上からの枚数を増やして、つながっている紙も一緒に選んでください）'};
 return{ok:true,reason:null,blocking:[]}}
/* この選び方を v1 の原本JSONに書けるか。書けないなら理由を返す＝無理に書かない。
   記録する折線は基準面に切る：split は無限直線として使うので長さは結果に影響せず、原紙座標が±1に収まる。 */
function recordable(state,ids,refId,a,b,sidePoint,materialLine){
 if(!ids.includes(refId))return{ok:false,reason:'基準の面が対象に入っていません'};
 const f=state.cache.faces.find(v=>v.faceId===refId);
 if(!f)return{ok:false,reason:'基準の面がいまの紙にありません'};
 if(state.recipe.steps.length>=MAX_STEPS)return{ok:false,reason:`原本は${MAX_STEPS}手までです`};
 if(ids.length>MAX_FACES)return{ok:false,reason:`原本の対象面は${MAX_FACES}枚までです`};
 if(!inside(sidePoint,f.poly))return{ok:false,reason:'折る側の点が基準の面の外にあります'};
 if(Math.abs(S(sidePoint,a,b))<.03)return{ok:false,reason:'折線から離れた側を選んでください'};
 /* 書く折線は2択。①いま持っている線（基準面の素材座標）が±1に収まるならそのまま。
    ②収まらないなら基準面に切りなおす（split は無限直線として使うので、切っても折りの結果は同じ）。
    ⚠折線が基準面を通っていなくてもよい＝紙片の別の面の上を通る折りは、ふつうにある。
    どちらも±1に収まらないときだけ、理由をつけて断る。
    🧷 原紙の外周（±1）の外へ RIM_FP_TOL 以内だけはみ出た値は、外周の上の点＝±1 ちょうどとして書く（onRim）。
      ⚠以前は ±1 を 1e-6 まで許して**はみ出た値のまま**書いていた＝保存した原本が schema（-1〜1）に入らなかった
        （実Chrome：対角で折った紙を上から2枚で折ると -1.0000000000000002。対角の鏡映 reflMat の xf に √2 由来の 2.2e-16 が乗り、
         素材座標へ戻す inv で外周の値がはみ出す）。
      ⛔桁の丸め・クランプではない：±1 より内側の値と、外へ RIM_FP_TOL を超える値は1ビットも変えない（超えたら使わない）。 */
 const fits=q=>Math.abs(q[0])<=1&&Math.abs(q[1])<=1;
 const seg=lineInPoly(f.poly,a,b),cut=seg?seg.map(q=>inv(f.xf,q)):null;
 /* 外周へ戻したことで、現在座標の点が RIM_AXIS_TOL より動いたら使わない＝補正で折軸を変えない。
    ⚠見るのは「補正による移動」だけ。線そのものの作り方（lineInPoly は E=1e-7 で頂点を拾う）には口を出さない。 */
 const kept=(r,l)=>r.every((q,i)=>{const u=apply(f.xf,q),v=apply(f.xf,l[i]);return Math.hypot(u[0]-v[0],u[1]-v[1])<=RIM_AXIS_TOL});
 const usable=l=>{if(!l)return null;const r=l.map(onRim);return r.every(fits)&&kept(r,l)?r:null};
 const line=usable(materialLine)||usable(cut);
 if(!line)return{ok:false,reason:'折線を原紙の座標に戻すと紙の外に出ます（この形は v1 の原本に書けません）'};
 return{ok:true,reason:null,line}}
/* 🧷 外周の浮動小数誤差の許容差と根拠（2026-09-14）
   - RIM_FP_TOL=1e-12：実測の誤差は 2.2e-16〜4.4e-16（reflMat が作る xf の成分）。1手ごとに鏡映を1つ合成し、
     誤差はおおむね手数に比例して積もる＝MAX_STEPS(100)手・成分4つで見積もっても 100×4×2.2e-16≈1e-13。
     一方、engine のいちばん細かい幾何の許容差は 1e-9（H2_STATIONARY・foldableSet の正規化距離）＝その 1/1000 より小さい。
     ＝「積もった丸め誤差」より大きく、「意味のある幾何のずれ」より十分小さい所に置く。
   - RIM_AXIS_TOL=1e-9：外周へ戻す前と後で、端点の**現在座標**が動いた距離の上限（engine の幾何の許容差 1e-9 と同じ）。
     xf は剛体（伸び縮みしない）なので、1e-12 の補正で動くのは 1e-12 程度＝ふつうは必ず通る。通らないのは xf が壊れているとき。
     補正のあとも**同じ折軸**であることの見張り。折る側は movingSidePoint（変えない）が決める。 */
const RIM_FP_TOL=1e-12,RIM_AXIS_TOL=1e-9;
const onRim=q=>q.map(v=>{const d=Math.abs(v)-1;return d>0&&d<=RIM_FP_TOL?Math.sign(v):v});
/* 「上からn枚」で候補を作り直す。setSide のあとに呼ぶ＝動く側が決まらないと層は選べない。
   枚数の意味は折りでも折り目だけでも同じ（この場所の重なりの上からn枚＋平らな折り目でつながる紙＝topFaces）。
   成立の判定だけを候補の操作（q.op）で分ける：'crease' は creasability（確定・再生の crease と同じ芯）、それ以外は今までどおり foldability。 */
function setLayers(state,n,at){const q=foldPending(state,'先に折線を引いてください');
 if(!q.sidePoint)throw Error('折る側を選択してください');
 const p=at||q.at;if(!p)throw Error('「この場所」が決まっていません');
 const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId);
 let A=q.displayLine[0],B=q.displayLine[1];
 if(S(apply(f.xf,q.sidePoint),A,B)>0)[A,B]=[B,A];
 const ids=topFaces(state,p,n,A,B);
 return applyChoice(state,q,ids,A,B,p,{n,at:C(p),faceIds:ids.slice().sort()})}
/* 🗂 「折線のこの側を全部」（2026-09-15・本人指示）＝「上からN枚」とは別の選び方。
   対象＝紙全体のうち、折線の動く側に面積がある面ぜんぶ（指した場所の下に無い面・左右に分かれた面も入る）。engine が紙から求める＝画面は面を渡さない。
   成立の判定は枚数の道とまったく同じ（折り＝foldability・折り目だけ＝creasability、「この場所」で上から続けて）。緩めない。
   原本に残るのは解決した面の faceId だけ（枚数の道と同じ）。 */
function sideAllFaces(state,a,b){return state.cache.faces.filter(f=>{const c=split(f.poly,a,b)[1];return!!(c&&area(c)>1e-9)}).map(f=>f.faceId)}
function setSideAll(state,at){const q=foldPending(state,'先に折線を引いてください');
 if(!q.sidePoint)throw Error('折る側を選択してください');
 const p=at||q.at;if(!p)throw Error('「この場所」が決まっていません');
 const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId);
 let A=q.displayLine[0],B=q.displayLine[1];
 if(S(apply(f.xf,q.sidePoint),A,B)>0)[A,B]=[B,A];
 const ids=sideAllFaces(state,A,B);
 if(!ids.length)throw Error('折線の動く側に紙がありません');
 return applyChoice(state,q,ids,A,B,p,{mode:'side',at:C(p),faceIds:ids.slice().sort()})}
/* 🪶 「つながっているフラップ」（2026-09-16・本人指示・つる⑫）＝「上からN枚」「この側を全部」とは別の3つめの選び方。
   指定した折線の動く側で、その場所のいちばん上の面から、**動く側の内部へ入る結び**をたどって集める（背を開くときの movingSetOf と同じ辿り方を共用）。
   面の数・面ID・手番号は条件にしない。集めたあとの判定は枚数の道と同じ芯（applyChoice＝foldability／creasability・この場所で上から続けて）で、緩めない。 */
function flapFaces(state,at,a,b){const top=stackAt(state,at)[0];if(!top)throw Error('その場所に紙がありません');
 return[...movingSetOf(state.cache,top.faceId,a,b)]}
function setFlap(state,at){const q=foldPending(state,'先に折線を引いてください');
 if(!q.sidePoint)throw Error('折る側を選択してください');
 const p=at||q.at;if(!p)throw Error('「この場所」が決まっていません');
 const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId);
 let A=q.displayLine[0],B=q.displayLine[1];
 if(S(apply(f.xf,q.sidePoint),A,B)>0)[A,B]=[B,A];
 const ids=flapFaces(state,p,A,B);
 return applyChoice(state,q,ids,A,B,p,{mode:'flap',at:C(p),faceIds:ids.slice().sort()})}
function applyChoice(state,q,ids,A,B,p,choice){
 const v=q.op==='crease'?creasability(state,ids,A,B,p):foldability(state,ids,A,B,q.kind,p);
 if(!v.ok)throw Error(v.reason);
 /* 基準の面＝選んだ中で「この場所」を含む、いちばん上の面。原本の line と movingSidePoint は
    この面の素材座標で書くので、ここがずれていると Python 側の「movingSidePoint は基準面の内部」に落ちる。 */
 const here=state.cache.faces.filter(x=>ids.includes(x.faceId)&&strictlyInside(p,x.poly)).sort((x,y)=>y.layer-x.layer);
 if(!here.length)throw Error('「この場所」に、選んだ紙がありません');
 const top=here[0];
 if(top.faceId!==q.reference.faceId){
  /* 基準を差しかえる＝折線と折る側の点をその面の素材座標で書きなおすだけ。画面の線も折りの形も動かない。 */
  q.reference={faceId:top.faceId};
  q.line=[inv(top.xf,q.displayLine[0]),inv(top.xf,q.displayLine[1])];
  q.sidePoint=inv(top.xf,p)}
 q.at=C(p);q.layerChoice=choice;q.stack=stackAt(state,p);
 q.sheet=ids.slice();
 q.candidates=ids.map(id=>({faceId:id,layerPath:C(state.cache.faces.find(x=>x.faceId===id).layerPath)}));
 q.selected=[];/* 候補が変わったら選択はやり直し＝古い選択のまま確定できない。 */
 return preview(state,q.preview)}
/* 🖊 折り目の自由入力で使う「動く側の点」を、**エンジンが決定論的に作る**（2026-09-12・本人指示）。
   crease は形も層も動かさないので「どちら側か」は記録の向きだけの話＝画面に3つめの入力を足さない。
   規則：基準面を折線で切った2枚それぞれで samplesOf（重心＋頂点を6割寄せた点）を測り、
   **折線からいちばん深い点**を選ぶ。同じ深さなら座標の小さい方＝どの順で呼んでも同じ答えになる。
   返す点は必ず①基準面の内部②折線から .03 より離れている（setSide／recordable と同じ物差し）。
   作れなければ理由だけを返す＝呼ぶ側は提案そのものをやめる（丸めもクランプもしない）。 */
function creaseSidePoint(state,faceId,a,b){
 const f=state.cache.faces.find(v=>v.faceId===faceId);
 if(!f)return{point:null,reason:'基準の面がいまの紙にありません'};
 const parts=split(f.poly,a,b);
 if(!parts[0]||!parts[1]||area(parts[0])<1e-9||area(parts[1])<1e-9)
  return{point:null,reason:'折り目の線が、引きはじめた面を二つに分けていません'};
 let best=null;
 for(const part of parts)for(const p of samplesOf(part)){
  if(!inside(p,f.poly))continue;
  const d=Math.abs(S(p,a,b));
  const better=!best||d>best.d+1e-12
   ||(Math.abs(d-best.d)<=1e-12&&(p[0]<best.point[0]-1e-12
     ||(Math.abs(p[0]-best.point[0])<=1e-12&&p[1]<best.point[1]-1e-12)));
  if(better)best={point:[p[0],p[1]],d}}
 if(!best)return{point:null,reason:'折り目の線から離れた点が、基準の面の中に作れません'};
 if(best.d<=.03)return{point:null,reason:'折り目の線が紙のふちに近すぎて、記録できる点が作れません'};
 return{point:best.point,reason:null}}
function validateLine(poly,a,b){if(!a||!b||Math.hypot(a[0]-b[0],a[1]-b[1])<.03)throw Error('折線が短すぎます');const p=split(poly,a,b);if(!p[0]||!p[1])throw Error('折線が選択面を二つに分けていません');return p}
/* 折線は「紙片を」二つに分けていればよい。紙片の中の1枚が片側に寄っているのは構わない。 */
function validateSheet(sheet,a,b){if(!a||!b||Math.hypot(a[0]-b[0],a[1]-b[1])<.03)throw Error('折線が短すぎます');
 let k=false,c=false;for(const f of sheet){const p=split(f.poly,a,b);if(p[0])k=true;if(p[1])c=true}
 if(!k||!c)throw Error('折線が選択面を二つに分けていません')}
function assertSupported(c={}){if(c.operation&&c.operation!=='fold')throw Error(c.operation==='squash'?'つぶし折りは未対応です':'B1で確定できるのは一直線の fold だけです');if((c.layerCount||1)>1)throw Error('重なり面の選択はB2以降で対応します')}
const OUTER=[{id:'bottom',label:'下辺',a:[-1,-1],b:[1,-1],inside:[0,-.8]},{id:'right',label:'右辺',a:[1,-1],b:[1,1],inside:[.8,0]},{id:'top',label:'上辺',a:[1,1],b:[-1,1],inside:[0,.8]},{id:'left',label:'左辺',a:[-1,1],b:[-1,-1],inside:[-.8,0]}];
function pickOuterEdge(p,max=.18){let z;for(const e of OUTER){const d=[e.b[0]-e.a[0],e.b[1]-e.a[1]],t=Math.max(0,Math.min(1,((p[0]-e.a[0])*d[0]+(p[1]-e.a[1])*d[1])/(d[0]**2+d[1]**2))),q=[e.a[0]+t*d[0],e.a[1]+t*d[1]],n=Math.hypot(p[0]-q[0],p[1]-q[1]);if(!z||n<z.distance)z={id:e.id,label:e.label,distance:n}}if(z.distance>max)throw Error('紙の外周辺を選んでください');return z}
function proposeEdgePair(state,movingId,targetId,context){const moving=OUTER.find(e=>e.id===movingId);assertSupported(context);if(state.recipe.steps.length)throw Error('折った後の外周辺合わせはB2以降で対応します');const target=OUTER.find(e=>e.id===targetId);if(!moving||!target)throw Error('紙の外周辺だけを選べます');const md=[moving.b[0]-moving.a[0],moving.b[1]-moving.a[1]],td=[target.b[0]-target.a[0],target.b[1]-target.a[1]];if(Math.abs(md[0]*td[1]-md[1]*td[0])>E)throw Error('平行でない辺の辺合わせは未対応です');const line=Math.abs(md[0])>Math.abs(md[1])?[[-1,(moving.a[1]+target.a[1])/2],[1,(moving.a[1]+target.a[1])/2]]:[[(moving.a[0]+target.a[0])/2,-1],[(moving.a[0]+target.a[0])/2,1]];proposeOnFace(state,line[0],line[1],'paper');state.pending.inputMode='edge-to-edge';state.pending.edgePair={moving:moving.id,target:target.id};setSide(state,moving.inside);return C(state.pending)}
function hitFaces(state,p){return state.cache.faces.filter(f=>inside(p,f.poly)).sort((a,b)=>b.layer-a.layer).map(f=>({faceId:f.faceId,layerPath:C(f.layerPath),layer:f.layer}))}
function proposeOnFace(state,a,b,faceId,context){assertSupported(context);if(state.recipe.steps.length>=MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);const f=state.cache.faces.find(x=>x.faceId===faceId);if(!f)throw Error('現在の紙にない対象面です');
 /* 重なりの見張りは「別の紙片が2つ下にある」で見る。同じ紙片の2面（＝折り目で割れただけ）は重なりではない。 */
 const hits=hitFaces(state,[(a[0]+b[0])/2,(a[1]+b[1])/2]);
 /* B2a：context.layers を渡したときだけ重なりを通す。渡さない今までの道は1文字も変えない。 */
 if(!(context&&context.layers)&&hits.length&&new Set(hits.map(h=>[...sheetIds(state.cache.bonds,h.faceId)].sort().join('|'))).size>1)throw Error('重なった面の選択はB2以降で対応します');
 const sheet=sheetOf(state,faceId);validateSheet(sheet,a,b);const sa=inv(f.xf,a),sb=inv(f.xf,b);
 state.pending={line:[sa,sb],displayLine:[C(a),C(b)],sidePoint:null,kind:'V',selected:[],preview:0,
  sheet:sheet.map(x=>x.faceId),candidates:sheet.map(x=>({faceId:x.faceId,layerPath:C(x.layerPath)})),reference:{faceId:f.faceId},revision:state.revision,
  at:null,stack:null,layerChoice:null,
  /* ✏️ 操作（2026-09-15）：'crease'＝紙を動かさず折り目を記録する／'fold'＝折る。指定しない呼び手（今までの道）は null＝判定は折り。 */
  op:context&&(context.op==='crease'||context.op==='fold')?context.op:null};/* at は setSide で movingSidePoint が決まってから入る。 */
 return C(state.pending)}
/* 重なりの拒否は「面が2枚」ではなく「別の紙片が2つ」で見る。同じ紙片の2面は重なりではない。 */
function propose(state,a,b,context){if(state.recipe.steps.length>=MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);const hits=hitFaces(state,[(a[0]+b[0])/2,(a[1]+b[1])/2]);
 if(!hits.length)throw Error('折線の下に対象面がありません');
 return proposeOnFace(state,a,b,hits[0].faceId,context)}
/* 折る側が決まって初めて「どの面が動くか」が決まる。候補＝紙片のうち動く側に面積がある面ぜんぶ。 */
function setSide(state,p){const q=foldPending(state,'先に折線を引いてください');const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId);if(!inside(p,f.poly))throw Error('折る側は対象面の内側を選んでください');if(Math.abs(S(p,...q.displayLine))<.03)throw Error('折線から離れた側を選んでください');q.sidePoint=inv(f.xf,p);
 /* 🚨「この場所」は折線の上の点ではなく movingSidePoint にする（2026-09-12・B2c）。
    折線の上は両側の境目なので、そこで重なりを数えると「どちらの側の紙か」があいまいになる。
    動く側の中の点で数えれば、そのまま「この紙を何枚めくるか」になる。 */
 q.at=C(p);
 let A=q.displayLine[0],B=q.displayLine[1];if(S(p,A,B)>0)[A,B]=[B,A];
 q.candidates=q.sheet.map(id=>state.cache.faces.find(x=>x.faceId===id)).filter(x=>{const c=split(x.poly,A,B)[1];return c&&area(c)>1e-9}).map(x=>({faceId:x.faceId,layerPath:C(x.layerPath)}));
 if(!q.candidates.some(c=>c.faceId===q.reference.faceId))throw Error('つかんだ面が動く側にありません');
 return preview(state,q.preview)}
/* 動く側の面は「ぜんぶ」選ぶ。1枚だけ選べると、折り目でつながった紙が置き去りになって破れる。 */
function select(state,refs){const q=foldPending(state,'候補がありません');if(!Array.isArray(refs)||!refs.length)throw Error('対象面を選択してください');
 const want=q.candidates.map(c=>c.faceId).slice().sort(),got=refs.map(r=>r.faceId).slice().sort();
 if(want.length!==got.length||want.some((v,i)=>v!==got[i]))throw Error('折線の動く側にある面を全部選んでください');
 q.selected=C(refs)}
/* 折りの「置き方」をここだけにする（geometry と、target が動かないかの検査が同じ規則を使うため）。
   A,B は「動く側が S<0」に向きをそろえてから渡す。 */
function foldRotator(A,B,angle,kind){
 const rad=angle*Math.PI/180,sg=kind==='V'?1:-1,dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
 return p=>{if(angle===0)return[p[0],0,-p[1]];if(angle===180){const r=reflect(p,A,B);return[r[0],0,-r[1]]}
  const vx=p[0]-A[0],vy=p[1]-A[1],along=vx*ux+vy*uy,px=A[0]+along*ux,py=A[1]+along*uy,perp=Math.hypot(p[0]-px,p[1]-py);
  return[px+(p[0]-px)*Math.cos(rad),sg*perp*Math.sin(rad),-(py+(p[1]-py)*Math.cos(rad))]}}
function geometry(state,angle){const q=state.pending;if(!q||!q.sidePoint)throw Error('折る側を選択してください');
 const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId),a=apply(f.xf,q.line[0]),b=apply(f.xf,q.line[1]),m=apply(f.xf,q.sidePoint);
 let A=a,B=b;if(S(m,A,B)>0)[A,B]=[B,A];
 const rot=foldRotator(A,B,angle,q.kind);
 const ids=q.candidates.map(c=>c.faceId),parts=[],move=[];
 for(const id of ids){const x=state.cache.faces.find(v=>v.faceId===id),[k,c]=split(x.poly,A,B);
  const mv=c?c.map(rot):null;parts.push({faceId:id,stay:k?k.map(p=>[p[0],0,-p[1]]):null,move:mv,moveSrc:c?C(c):null});
  if(mv)move.push(...mv)}
 if(!move.length)throw Error('折線が選択面を二つに分けていません');
 /* 🚨0°でも90°でも180°でも、結びの線は両側で同じ所に来ていなければならない。
    ここが開いた瞬間、紙は裂けている＝ゴーストにも出さない（確定前の最後の見張り）。
    動く面でも、折線の止まる側にある所は動かない＝置き方は put で揃える。 */
 const put=(fid,p)=>ids.includes(fid)&&S(p,A,B)<-1e-9?rot(p):[p[0],0,-p[1]];
 for(const bd of state.cache.bonds){const[x,y]=bd.faceIds;
  const fx=state.cache.faces.find(v=>v.faceId===x);
  if(!fx||!state.cache.faces.some(v=>v.faceId===y))continue;
  for(let i=0;i<=4;i++){const t=i/4,
   p=apply(fx.xf,[bd.seg[0][0]+(bd.seg[1][0]-bd.seg[0][0])*t,bd.seg[0][1]+(bd.seg[1][1]-bd.seg[0][1])*t]);
   const u=put(x,p),v=put(y,p);
   if(Math.hypot(u[0]-v[0],u[1]-v[1],u[2]-v[2])>1e-6)
    throw Error('結びにそって紙が切り離されます（つながっている紙も一緒に選んでください）')}}
 return{line:[A,B],parts,move,movingIds:ids,angle,kind:q.kind,baseFaces:state.cache.faces.filter(x=>!ids.includes(x.faceId))}}
/* The preview angle is display only. confirm() always records the flat 180-degree fold. */
function preview(state,a){foldPending(state,'折る側を選択してください');if(typeof a!=='number'||!isFinite(a)||a<0||a>180)throw Error('プレビュー角度は0°〜180°です');state.pending.preview=a;
 /* ✏️ 折り目だけ（q.op==='crease'）は紙を動かさない＝折った姿は「どこに折り目が入るか」を見せる表示だけ。
    その姿で結びが開いて見える（折って戻す途中が成り立たない）ときは、平らな姿（0°）で見せる。成立は creasability が決める。 */
 if(state.pending.op==='crease'&&a>0){try{return geometry(state,a)}catch(e){const g=geometry(state,0);g.shownFlat=true;g.flatReason=e.message;return g}}
 return geometry(state,a)}
function cancel(state){state.pending=null}
/* 🚨確定は原子的に。原本を複製して1手足し、再生・折れるか・書けるか・結び・層順位・ハッシュを全部見て、
   ぜんぶ通ってから初めて入れかえる。途中で断ったら recipe も revision も cache も表示も1ミリも動かない。 */
function confirm(state,meta={}){const q=state.pending;
 if(q&&q.inputMode==='squash')return confirmSquash(state,meta);
 if(q&&q.inputMode==='petal')return confirmPetal(state,meta);
 if(!q||q.revision!==state.revision)throw Error('確定候補が古くなっています');
 if(!q.sidePoint||!q.selected.length)throw Error('対象面または折る側が未選択です');
 const f=state.cache.faces.find(x=>x.faceId===q.reference.faceId);
 if(!f)throw Error('基準の面がいまの紙にありません');
 const crease=meta.op==='crease',sp=apply(f.xf,q.sidePoint);
 let A=q.displayLine[0],B=q.displayLine[1];if(S(sp,A,B)>0)[A,B]=[B,A];
 /* E2：辺を折り目へ合わせた手は、凍結した意図から**軸を作り直して**突き合わせる。画面が作った線は信じない。 */
 if(meta.edgeToCrease){const v=verifyEdgeToCrease(state,meta.edgeToCrease.edge,meta.edgeToCrease.crease,A,B,meta.edgeToCrease.corner);
  if(!v.ok)throw Error(v.reason)}
 const ids=q.selected.map(t=>t.faceId);
 /* 🦴📐 H2：辺を「見えている背」へ合わせた手は、凍結した意図から軸を作り直し、
    背が 0°/90°/180° で動かないことを**確定する対象面の集合で**見直す。 */
 if(meta.edgeToHinge){const v=verifyEdgeToHinge(state,meta.edgeToHinge.edge,meta.edgeToHinge.hinge,A,B,
   meta.edgeToHinge.corner,ids,q.kind);
  if(!v.ok)throw Error(v.reason)}
 /* 🪚 E3：辺を**別の外周辺**へ合わせた手も、凍結した意図から軸を作り直して見直す。 */
 if(meta.edgeToEdge){const v=verifyEdgeToEdge(state,meta.edgeToEdge.edge,meta.edgeToEdge.target,A,B,
   meta.edgeToEdge.corner,ids,q.kind);
  if(!v.ok)throw Error(v.reason)}
 if(q.op&&q.op!==(crease?'crease':'fold'))throw Error(`候補は${q.op==='crease'?'折り目だけ':'折り'}なのに、${crease?'折り目だけ':'折り'}として確定しようとしています`);
 if(!crease){const able=foldability(state,ids,A,B,q.kind,q.at);if(!able.ok)throw Error(able.reason)}
 else{const able=creasability(state,ids,A,B,q.at);if(!able.ok)throw Error(able.reason)}
 const rec=recordable(state,ids,q.reference.faceId,A,B,sp,q.line);
 if(!rec.ok)throw Error(rec.reason);
 const line=rec.line;
 const trial=C(state.recipe);
 if(meta.name)trial.work.name=meta.name;if(meta.id)trial.work.id=meta.id;
 const id=`s${trial.steps.length+1}`;
 trial.steps.push({id,diagramStep:String(trial.steps.length+1),op:crease?'crease':'fold',kind:q.kind,
  reference:C(q.reference),line,movingSidePoint:C(q.sidePoint),targets:C(q.selected),
  instruction:crease?'選んだ面に折り目をつける':q.kind==='V'?'選んだ面を谷折りする':'選んだ面を山折りする'});
 if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(trial);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 /* 新しい手を確定したら、やり直しの道は閉じる＝分かれた歴史を持たない。 */
 state.recipe=trial;state.redoStack=[];state.revision++;state.pending=null;state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* 🔄 紙ぜんぶを裏返す（op:'flip'）。折線を持たないので setSide／select／recordable／foldability は通らない
   （スキーマ側も flip に kind/reference/line/movingSidePoint/targets を禁じている）。
   🚨確定の枠は fold とまったく同じ＝原本を複製して1手足し、**再生・手順と面の上限・ハッシュ再照合**を
   ぜんぶ通してから入れかえる。途中で断ったら recipe も revision も cache も redoStack も1ミリも動かない。
   ⚠これは紙ぜんぶの裏返しで、局所的な「うしろにおる」(op:'fold'・kind:'M') とは別物。 */
function flip(state,axis='v'){
 if(state.pending)throw Error('確定か取消をしてから裏返してください');
 if(axis!=='v'&&axis!=='h')throw Error('裏返しの向きは v か h です');
 const trial=C(state.recipe),id=`s${trial.steps.length+1}`;
 trial.steps.push({id,diagramStep:String(trial.steps.length+1),op:'flip',axis,
  instruction:axis==='v'?'紙を左右に裏返す':'紙を上下に裏返す'});
 if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(trial);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 state.recipe=trial;state.redoStack=[];state.revision++;state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* ================= 🫱 S1：既存ヒンジの「背を開く」専用提案 =================
   つぶし折りの構成要素。**新しい op は作らない**＝記録されるのはふつうの `op:'fold'` で、
   選んだ面が折線の片側に丸ごとあり、その側が動く形（`replay` は前から丸ごと動かせる）。
   🚨任意の境界線を許す抜け道にしない＝**折線は H1 の背から engine が取る**（呼ぶ側は線を渡せない）。
   🚨v1の範囲＝**背で直接つながった2層のフラップ**で、**動く側が単一面**に解決できるときだけ。
   4層・中間層・枝分かれした面集合・ほかの結びが動く側に残る形は、理由をつけて断る。 */
/* 🚨「その面が折線の片側に丸ごとあるか」だけを決める（⚠split は**無限直線**なので、
   結びの線分の外まで伸ばした所でまたいでいないかも、ここで一緒に見る）。
   丸ごとあるなら「その側が動く側」になる向き [a,b] を返し、またいでいる・退化しているなら null。 */
function wholeSideOf(poly,a,b){if(!poly||poly.length<3)return null;
 if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-12)return null;
 const[k,c]=split(poly,a,b),ka=k?area(k):0,ca=c?area(c):0;
 if(ka<=1e-9&&ca>1e-9)return[a,b];
 if(ca<=1e-9&&ka>1e-9)return[b,a];
 return null}
/* 背を開くときに一緒に動く紙＝面 startId から「動く側の内部へ入る結び」をたどって集める（foldableSet④と同じ物差し）。
   軸の線の上だけに乗る結びはたどらない。集合が軸の片側に丸ごとあるか・相手が入っていないかは呼ぶ側が見る。 */
function movingSetOf(cache,startId,a,b){const set=new Set([startId]),q=[startId];
 while(q.length){const x=q.pop();
  for(const bd of cache.bonds){if(!bd.faceIds.includes(x))continue;const y=bd.faceIds.find(id=>id!==x);
   if(y===undefined||set.has(y)||!bondInMovingSide(cache.faces,bd,a,b))continue;set.add(y);q.push(y)}}
 return set}
function proposeOpen(state,hingeRef,at){
 if(state.recipe.steps.length>=MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 if(!at||!Array.isArray(at))throw Error('どちら側を開くか、紙の上で指してください');
 /* ①H1の安定したIDを、いまの cache へ再解決できること。 */
 const iv=resolveHingeInterval(state,hingeRef);
 if(!iv)throw Error('選んだ背が、いまの紙にありません');
 if(!iv.consistent)throw Error('結びの線が両側で一致しません（紙が切り離されています）');
 /* ②折線は背そのもの。呼ぶ側は渡せない＝境界線ならどこでも開ける抜け道を作らない。 */
 /* 🚨原本に書く折線は、結びが持っている**素材座標そのもの**（`bond.seg`）を使う。
    ⚠`iv.srcSeg` は並べ替えの鍵なので丸めてある＝それを書くと折線がずれて再生が断る（実測）。
    ⚠いまの座標を `inv(xf,…)` で戻すと丸め誤差が原紙の端で ±1 を外れ、本番スキーマに入らない（実測）。
    どちらでもない「結びが最初から持っている線」を、そのまま書く。 */
 const bond=state.cache.bonds.find(b=>b.kind==='hinge'&&b.faceIds.length===2
  &&b.faceIds.every(id=>iv.faceIds.includes(id))&&segStr(segKey(b.seg))===segStr(iv.srcSeg));
 if(!bond)throw Error('選んだ背の結びが、いまの紙にありません');
 const A=iv.seg[0],B=iv.seg[1];
 if(Math.hypot(B[0]-A[0],B[1]-A[1])<.03)throw Error('背が短すぎて開けません');
 /* ③動く紙の集合は engine が結びから決める（2026-09-14・複数面）。
    背の片側の面 X から、「動く側の内部へ入る結び」（foldableSet④と同じ物差し bondInMovingSide）をたどって集める＝movingSetOf。
    軸の線の上に乗っている結び（開く背そのもの・同じ軸の上の折り目や背）はたどらない＝止まる紙とのつながりは全部この軸の上に残る。
    🚨指した場所のいちばん上の紙が、その集合に入っていること（「上の紙を開く」の決まりは単一面のときと同じ）。
    🚨層の枚数・結びの本数・面の枚数では断らない。 */
 const stack=stackAt(state,at);
 if(!stack.length)throw Error('そこには紙がありません（開きたい側の紙を指してください）');
 const top=state.cache.faces.find(f=>f.faceId===stack[0].faceId);
 if(!top)throw Error('指した所の紙がいまの紙にありません');
 const sides=iv.faceIds.map(id=>{const f=state.cache.faces.find(v=>v.faceId===id),w=f&&wholeSideOf(f.poly,A,B);
  return{f,w,set:w?movingSetOf(state.cache,f.faceId,w[0],w[1]):null}});
 const pick=sides.find(v=>v.set&&v.set.has(top.faceId));
 if(!pick){if(!iv.faceIds.includes(top.faceId))throw Error(`指した所のいちばん上の紙は、選んだ背で開く紙ではありません（${top.faceId}）`);
  throw Error('選んだ紙が背の両側にまたがっています（丸ごと開ける形ではありません）')}
 const mover=pick.f,moving=pick.set;
 const other=state.cache.faces.find(f=>f.faceId===iv.faceIds.find(id=>id!==mover.faceId));
 if(!other)throw Error('選んだ背の相手の面がいまの紙にありません');
 /* 背の相手まで集合に入る＝軸の外の結びで一周してつながっている＝この背の軸1本では開けない（複数の軸を同時に動かす形は対象外）。 */
 if(moving.has(other.faceId))throw Error('背の軸の外でも紙がつながっていて、この背の軸1本では開けません（複数の軸を同時に動かす形です）');
 /* ④上なら谷、下なら山＝engine が決める（画面に選ばせない）。比べるのは**背でつながった2枚**。 */
 const kind=mover.layer>other.layer?'V':'M';
 /* ⑤動く紙がぜんぶ、軸の同じ側に丸ごとあること＝退化していない180°の反転になること。 */
 const[oa,ob]=pick.w;
 const astride=[...moving].filter(id=>{const g=state.cache.faces.find(v=>v.faceId===id),w=g&&wholeSideOf(g.poly,oa,ob);return!w||w[0]!==oa});
 if(astride.length)throw Error('いっしょに動く紙が背の両側にまたがっています（この背の軸1本では開けません）: '+astride.join(', '));
 const back=mover.poly.map(p=>reflect(p,oa,ob));
 if(!back.some((p,i)=>Math.hypot(p[0]-mover.poly[i][0],p[1]-mover.poly[i][1])>1e-6))
  throw Error('開いても形が変わりません（退化した反転です）');
 /* ⑦🚨結びの本数では断らない（2026-09-13・本人指示）。
    動く面につながる結びのうち、相手が止まる側にあるものが「回転軸の上に全区間おさまっているか」は
    **既存の `foldableSet`④ がそのまま見ている**（`S(q,a,b)/線分長` で正規化し、動く側の内部に入る
    区間を `cutSegment` で取り出す。許容差は正規化距離 1e-9 と区間長 1e-7）。
    ＝ここに別の関数・別の許容差・独立した成否規則を足さない。⑨でそのまま通す。 */
 /* ⑧動く側の点は engine が作る（折線からいちばん深い点。creaseSidePoint と同じ規則）。 */
 const sp=deepestInFace(mover,oa,ob);if(!sp.point)throw Error(sp.reason);
 const before={rec:JSON.stringify(state.recipe),rev:state.revision,hash:state.cache.hash,redo:redoOf(state).length};
 const ids=[mover.faceId,...[...moving].filter(id=>id!==mover.faceId).sort()];
 /* ⑨既存の関門をそのまま通す＝foldability／recordable／replay（結び・層順位・digest）。 */
 const able=foldability(state,ids,oa,ob,kind,at);
 if(!able.ok)throw Error(able.reason);
 /* 🚨原本に書く折線は、**背がもともと持っている素材座標**（`iv.srcSeg`）をそのまま使う。
    いまの座標を `inv(xf,…)` で戻すと丸め誤差が乗り、原紙の端で `1.0000000000000004` のような値になって
    本番スキーマの範囲（±1）を外れる（実測：5層の例で `$.steps[3].line[0][1]: number out of range`）。
    ⚠折線そのものは変えていない＝同じ結びの、同じ線を、誤差の乗らない側から書いているだけ。 */
 const rec=recordable(state,ids,mover.faceId,oa,ob,sp.point,C(bond.seg));
 if(!rec.ok)throw Error(rec.reason);
 const trial=C(state.recipe),id=`s${trial.steps.length+1}`;
 trial.steps.push({id,diagramStep:String(trial.steps.length+1),op:'fold',kind,
  reference:{faceId:mover.faceId,layerPath:C(mover.layerPath)},line:rec.line,
  movingSidePoint:inv(mover.xf,sp.point),
  targets:ids.map(id=>({faceId:id,layerPath:C(state.cache.faces.find(v=>v.faceId===id).layerPath)})),
  instruction:'背を開く'});
 if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(trial);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 /* ⑩0°・90°・180°で、結びも素材の境界も裂けないこと（geometry の見張りをそのまま使う）。 */
 const saved=state.pending;
 state.pending={line:C(bond.seg),displayLine:[C(oa),C(ob)],sidePoint:null,kind,selected:[],preview:0,
  sheet:C(ids),candidates:ids.map(id=>({faceId:id,layerPath:C(state.cache.faces.find(v=>v.faceId===id).layerPath)})),
  reference:{faceId:mover.faceId},revision:state.revision,at:null,stack:null,layerChoice:null,inputMode:'open',
  openHinge:{intervalId:iv.intervalId,faceIds:C(iv.faceIds),stepId:iv.stepId}};
 /* 🚨「この場所」（q.at）は**指した点**に戻す。setSide は動く側の点（sp.point）を入れるが、開く手の「上から続けて」は
    指した所で見ている（⑨）＝確定（confirm の foldability）も同じ所で見直す。複数面では2つの点で積み重なりが違う（K2 で踏んだ）。 */
 try{setSide(state,sp.point);state.pending.at=C(at);for(const a of[0,90,180])geometry(state,a)}
 catch(e){state.pending=saved;throw e}
 /* 🚨読み取りだけ＝原本・revision・cache.hash・redoStack は1ミリも動かさない。 */
 if(JSON.stringify(state.recipe)!==before.rec||state.revision!==before.rev
  ||state.cache.hash!==before.hash||redoOf(state).length!==before.redo){state.pending=saved;throw Error('背を開く提案が正式な状態を変えました')}
 return C(state.pending)}
/* ================= 🧵 折り目を付けて、そのまま折る（複合操作） =================
   原本には**ふつうの2手**（crease → fold）を足すだけ＝新しい op もフィールドも作らない。
   🚨正式な state には1文字も書かない。`stage` が返す「派生状態」を持つのは画面側で、
     そこで既存の propose／setSide／select／preview／setLayers／foldability を**そのまま**使う。
   ⚠2手目は「1手目で割れたあとの面」で解く必要があるので、派生状態の上で解き直す。 */
/* その面の中で、折線からいちばん深い点。creaseSidePoint と同じ規則（重心＋頂点を6割寄せ／同じ深さなら x,y の小さい方）。 */
function deepestInFace(f,a,b){let best=null;
 for(const p of samplesOf(f.poly)){if(!inside(p,f.poly))continue;
  const d=Math.abs(S(p,a,b));
  const better=!best||d>best.d+1e-12
   ||(Math.abs(d-best.d)<=1e-12&&(p[0]<best.point[0]-1e-12||(Math.abs(p[0]-best.point[0])<=1e-12&&p[1]<best.point[1]-1e-12)));
  if(better)best={point:[p[0],p[1]],d}}
 if(!best||best.d<=.03)return{point:null,reason:'折線から離れた点が、この面の中に作れません'};
 return{point:best.point,reason:null}}
/* 指した点 at の側にある、面の部分の中で折線からいちばん深い点（規則は deepestInFace と同じ）。 */
function deepestOnSide(f,a,b,at){const sg=S(at,a,b);
 if(Math.abs(sg)<1e-9)return{point:null,reason:'線の上ではなく、折る側の紙を指してください'};
 const part=split(f.poly,a,b)[sg>0?0:1];if(!part||area(part)<1e-9)return{point:null,reason:'指した側に、この面がありません'};
 let best=null;
 for(const p of samplesOf(part)){if(!inside(p,f.poly)||S(p,a,b)*sg<=0)continue;
  const d=Math.abs(S(p,a,b));
  const better=!best||d>best.d+1e-12
   ||(Math.abs(d-best.d)<=1e-12&&(p[0]<best.point[0]-1e-12||(Math.abs(p[0]-best.point[0])<=1e-12&&p[1]<best.point[1]-1e-12)));
  if(better)best={point:[p[0],p[1]],d}}
 if(!best||best.d<=.03)return{point:null,reason:'線から離れた点が、指した側の面の中に作れません'};
 return{point:best.point,reason:null}}
/* 折り目を1手足した派生状態を作って返す。**state は読むだけ**。 */
function stage(state,kind){
 const q=foldPending(state,'先に折り目を引いてください');
 if(!q.sidePoint||!q.candidates.length)throw Error('対象面または折る側が未選択です');
 if(kind!=='V'&&kind!=='M')throw Error('山谷は V か M です');
 const left=MAX_STEPS-state.recipe.steps.length;
 if(left<2)throw Error(`残りが${left}手なので「この折り目で折る」は始められません（折り目と折りで2手いります）`);
 const derived={recipe:C(state.recipe),revision:state.revision,pending:C(q),
  cache:state.cache,committed:state.committed,cacheRevision:state.revision,redoStack:[]};
 derived.pending.kind=kind;derived.pending.op='crease';/* 前半は折り目だけ（creasability）。後半の折りは stageSide が op:'fold' で作り、confirm の foldability を必ず通る */
 select(derived,derived.pending.candidates);
 confirm(derived,{op:'crease'});/* ← 折り目の1手。既存の関門を全部通る */
 derived.staged={base:state.revision,mode:'crease-fold',kind,line:[C(q.displayLine[0]),C(q.displayLine[1])],
  creaseStep:C(derived.recipe.steps[derived.recipe.steps.length-1])};
 return derived}
/* ✋ 引いた線で、そのまま折る（2026-09-15・つる⑦の上の三角を実際に折るため）＝原本に足すのは**ふつうの fold 1手**。
   2点を通る線（「折り目を引く」で P→P' のように端へ吸いついた線）を、折り目の手を入れずに折線として使う。
   しくみは 🧵 と同じ派生状態（state は読むだけ）：折る側は指した所・面と枚数は engine（stageSide／setLayers／setSideAll）・確定は confirm の foldability。
   🧵 との違いは、折り目の1手を入れないことだけ（mode:'line-fold'）。 */
function stageLine(state,kind){
 const q=foldPending(state,'先に線を引いてください');
 if(kind!=='V'&&kind!=='M')throw Error('山谷は V か M です');
 if(state.recipe.steps.length>=MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const derived={recipe:C(state.recipe),revision:state.revision,pending:null,
  cache:state.cache,committed:state.committed,cacheRevision:state.revision,redoStack:[]};
 derived.staged={base:state.revision,mode:'line-fold',kind,line:[C(q.displayLine[0]),C(q.displayLine[1])]};
 return derived}
/* 折り目のどちら側を折るかは「指のある側」で決める＝画面は指した点を渡すだけ。面も折る側の点も engine が選ぶ。 */
function stageSide(derived,at){
 const sg=derived&&derived.staged;if(!sg||(sg.mode!=='crease-fold'&&sg.mode!=='line-fold'))throw Error('折り目を付けてから折る候補ではありません');
 const hit=stackAt(derived,at);if(!hit.length)throw Error('折り目のどちら側を折るか、紙の上で指してください');
 const f=derived.cache.faces.find(v=>v.faceId===hit[0].faceId);
 /* ✋ 線で折る（line-fold）は、面がまだ線で割れていない＝面の中でいちばん深い点が指した側の反対にあることがある。
    指した側の部分（split）の中だけから選ぶ。🧵（折り目→折り）は1手目で面が割れているので、今までどおり面ぜんぶから（1文字も変えない）。 */
 const p=sg.mode==='line-fold'?deepestOnSide(f,sg.line[0],sg.line[1],at):deepestInFace(f,sg.line[0],sg.line[1]);if(!p.point)throw Error(p.reason);
 let A=sg.line[0],B=sg.line[1];if(S(p.point,A,B)>0)[A,B]=[B,A];
 derived.pending=null;
 proposeOnFace(derived,A,B,f.faceId,{layers:1,op:'fold'});
 derived.pending.kind=sg.kind;/* 🚨折り目と折りは同じ山谷（本人指示） */
 setSide(derived,p.point);
 return C(derived.pending)}
/* 🚨2手をまとめて原子的に入れかえる。revision が増えるのは**1回だけ**。
   fold が断られたら例外が出て**派生状態もそのまま残る**＝山谷・折る側・枚数を変えてやり直せる。
   そのあいだ正式な recipe／revision／cache.hash／redoStack は1ミリも動かない。 */
/* 🚨派生も原子的に扱う＝2手目と**後段の検査**は「派生の複製」の上で通し、ぜんぶ通ってから正式へ入れかえる。
   ⚠これが無いと、confirm を通ったあとの検査（手数・並び・山谷・1手目の一致・上限・ハッシュ）で断ったとき、
     正式は不変でも**渡された派生だけが1手進んで pending が消え**、選び直しも取消もできなくなる。
   cache／committed は誰も中身を書きかえない（付けかえるだけ）ので、stage と同じく参照を共有する。 */
function cloneDerived(d){return{recipe:C(d.recipe),revision:d.revision,pending:d.pending?C(d.pending):null,
 cache:d.cache,committed:d.committed,cacheRevision:d.cacheRevision,
 redoStack:C(d.redoStack||[]),staged:C(d.staged)}}
function confirmStaged(state,derived,meta={}){
 const sg=derived&&derived.staged;if(!sg||(sg.mode!=='crease-fold'&&sg.mode!=='line-fold'))throw Error('折り目を付けてから折る候補ではありません');
 if(sg.base!==state.revision)throw Error('確定候補が古くなっています');
 if(!derived.pending)throw Error('折り目のどちら側を折るか選んでください');
 const work=cloneDerived(derived);
 const before=work.recipe.steps.length;
 select(work,work.pending.candidates);/* 候補は engine が作ったものだけ（「上からN枚」で増えていてもここを通る） */
 confirm(work,meta);/* ← 折りの1手。recordable／foldability／結び／層順位／ハッシュはここで全部見る */
 const steps=work.recipe.steps;
 if(sg.mode==='line-fold'){
  if(steps.length!==before+1||steps.length!==state.recipe.steps.length+1)throw Error('線で折る手が1手になっていません');
  if(steps[steps.length-1].op!=='fold'||steps[steps.length-1].kind!==sg.kind)throw Error('線で折る手が、選んだ山谷の fold になっていません')}
 else{
 if(steps.length!==before+1||steps.length!==state.recipe.steps.length+2)throw Error('複合操作が2手になっていません');
 if(steps[steps.length-2].op!=='crease'||steps[steps.length-1].op!=='fold')throw Error('複合操作の並びが 折り目→折り になっていません');
 if(steps[steps.length-2].kind!==steps[steps.length-1].kind)throw Error('折り目と折りの山谷が違います')}
 if(steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(work.recipe);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(work.recipe))!==cache.hash)throw Error('JSON再生結果が安定しません');
 state.recipe=C(work.recipe);state.redoStack=[];state.revision++;state.pending=null;
 state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* ================= 🥟 S3：ふつうの折りを派生状態へ applyして、そこにできた背を開く =================
   つぶし折りの最小形（2層だけ）。原本に足すのは**ふつうの fold が2手**で、新しい op もフィールドも作らない。
   🚨正式な state には1文字も書かない＝派生状態を持つのは画面（🧵 の staged と同じ決めごと）。
   🚨**背は自動で選ばない。**派生の上に新しくできた背を、ユーザーが H1 の道で選ぶ
     ＝2手目は「1手目で割れたあとの faceId・layerPath・その背」から解かれる。
   🚨**2手の山谷はそれぞれの折りのまま**（1手目＝ユーザーが押した山谷／2手目＝proposeOpen が決めた向き）。
     🧵（折り目→折り）は同じ山谷にそろえるが、ここは**そろえない**＝別の操作。 */
function stageFold(state){
 const q=foldPending(state,'先に折る候補を作ってください');
 if(!q.sidePoint||!q.candidates.length)throw Error('対象面または折る側が未選択です');
 if(q.revision!==state.revision)throw Error('確定候補が古くなっています');
 const left=MAX_STEPS-state.recipe.steps.length;
 if(left<2)throw Error(`残りが${left}手なので「続けてつぶす」は始められません（折りと折りで2手いります）`);
 const derived={recipe:C(state.recipe),revision:state.revision,pending:C(q),
  cache:state.cache,committed:state.committed,cacheRevision:state.revision,redoStack:[]};
 select(derived,derived.pending.candidates);
 confirm(derived,{op:'fold'});/* ← 1手目。foldability／recordable／結び／層順位／ハッシュは既存の関門がぜんぶ見る */
 derived.staged={base:state.revision,mode:'squash',kind:q.kind,
  foldStep:C(derived.recipe.steps[derived.recipe.steps.length-1])};
 return derived}
/* 🚨2手をまとめて原子的に入れかえる。revision が増えるのは**1回だけ**。
   2手目が断られたら例外が出て**派生状態はそのまま残る**＝背や開く側を選び直せる。
   そのあいだ正式な recipe／revision／cache.hash／redoStack は1ミリも動かない。 */
function confirmStagedFold(state,derived,meta={}){
 const sg=derived&&derived.staged;
 if(!sg||sg.mode!=='squash')throw Error('「続けてつぶす」の候補ではありません');
 if(sg.base!==state.revision)throw Error('確定候補が古くなっています');
 if(!derived.pending)throw Error('開く背と、開く側を選んでください');
 /* 2手目は「背を開く」提案だけ＝派生の上でふつうの折りをもう1手足す抜け道にしない。 */
 if(derived.pending.inputMode!=='open')throw Error('2手目は「背を開く」提案だけです');
 const work=cloneDerived(derived);/* 🚨後段の検査まで複製の上で通す（→ cloneDerived の注） */
 const before=work.recipe.steps.length;
 select(work,work.pending.candidates);
 confirm(work,meta);/* ← 2手目。関門はぜんぶ既存のまま */
 const steps=work.recipe.steps;
 if(steps.length!==before+1||steps.length!==state.recipe.steps.length+2)throw Error('複合操作が2手になっていません');
 if(steps[steps.length-2].op!=='fold'||steps[steps.length-1].op!=='fold')throw Error('複合操作の並びが 折り→折り になっていません');
 if(JSON.stringify(steps[steps.length-2])!==JSON.stringify(sg.foldStep))throw Error('1手目が入れかわっています');
 if(steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(work.recipe);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(work.recipe))!==cache.hash)throw Error('JSON再生結果が安定しません');
 state.recipe=C(work.recipe);state.redoStack=[];state.revision++;state.pending=null;
 state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* ================= 🧺 袋折り（つる③）の候補と確定 =================
   🚨候補を作るだけでは原本・revision・cache・redoStack を1ミリも動かさない（置くのは pending だけ）。
   🚨候補になるのは **SquashV2 が検証ずみのつる③と認めた状態だけ**。手の中身（軸・役割・基準面・枝・stack）は
     いまの cache から SquashV2 が組み、共通入口で先頭から再生して通ったものだけを候補にする。
   🚨原本を v1 → v2 へ移すのは **confirm の時だけ**（明示的な確定）。1手＝1回の revision＝undo/redo も1回。 */
/* 候補の手を組み、共通入口で先頭から再生する（読むだけ）。候補・画面の袋・プレビューはみんなここを通る。 */
function buildSquash(state){
 if(state.recipe.steps.length>=MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const V2=globalThis.SquashV2;
 if(!V2||typeof V2.candidateStep!=='function')throw Error('袋折りの再生器（squash_v2.js）が読みこまれていません');
 const trial=C(state.recipe),n=trial.steps.length+1;
 const step=V2.candidateStep(state.cache,`s${n}`,String(n));
 trial.version=2;trial.steps.push(step);
 const r=replayDetail(trial);
 if(r.cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==r.cache.hash)throw Error('JSON再生結果が安定しません');
 return{step,cache:r.cache,detail:r.squash}}
const pocketIdOf=step=>`pocket:${step.model}@${step.vertex.join(',')}`;
/* 🧺 画面に出す「袋」の候補（読むだけ）。袋＝この手で割れて開く2枚（engine の再生結果の splits の親）。
   🚨画面は軸も対象面も層順も組み立てない＝強調する面の名前と、いまの形（poly）をここで渡す。 */
function squashOptions(state){
 if(state.pending)return{options:[],reason:'確定か取消をしてから袋を選んでください'};
 let b;try{b=buildSquash(state)}catch(e){return{options:[],reason:e.message}}
 const ids=[...new Set(b.detail.splits.map(s=>s.parent))];
 const faces=ids.map(id=>state.cache.faces.find(f=>f.faceId===id));
 if(faces.some(f=>!f))return{options:[],reason:'袋の面が、いまの紙にありません'};
 return{options:[{pocketId:pocketIdOf(b.step),stepId:b.step.id,faceIds:ids,outline:faces.map(f=>C(f.poly)),
  moving:b.detail.faces.filter(f=>f.moving).map(f=>f.faceId).sort()}],reason:null}}
/* 指した所に袋があるか（読むだけ）。その場所の重なりに、袋の面が入っていれば、その袋。 */
function squashOptionAt(state,at){const o=squashOptions(state);if(!o.options.length)return null;
 const here=new Set(stackAt(state,at).map(v=>v.faceId));
 return C(o.options.find(op=>op.faceIds.some(id=>here.has(id)))||null)}
function proposeSquash(state,pocketId){
 const before={rec:JSON.stringify(state.recipe),rev:state.revision,hash:state.cache.hash,redo:JSON.stringify(redoOf(state))};
 const b=buildSquash(state),id=pocketIdOf(b.step);
 if(pocketId!==undefined&&pocketId!==id)throw Error('選んだ袋が、いまの紙の袋と違います');
 if(JSON.stringify(state.recipe)!==before.rec||state.revision!==before.rev
  ||state.cache.hash!==before.hash||JSON.stringify(redoOf(state))!==before.redo)throw Error('袋折りの候補が正式な状態を変えました');
 state.pending={inputMode:'squash',revision:state.revision,step:C(b.step),hash:b.cache.hash,pocketId:id};
 return C(state.pending)}
/* 袋折りの候補のプレビュー（読むだけ）。途中の座標は squash_model の連動運動を v2 の再生結果の割りつけで並べたもの
   （SquashV2.positions）。両端は engine の面（t=0＝いまの紙／t=1＝候補の再生結果）と層。
   positions の三角形は**上の層から描く順**（drawOrder）＝厚み0で同着の面は、直前の層順どおりに depth で勝つ。
   ⛔厚みは0。非貫通は未検証。 */
function squashPreview(state){const q=state.pending;
 if(!q||q.inputMode!=='squash')throw Error('袋折りの候補がありません');
 if(q.revision!==state.revision)throw Error('確定候補が古くなっています');
 const trial=C(state.recipe);trial.version=2;trial.steps.push(C(q.step));
 const r=replayDetail(trial);
 if(r.cache.hash!==q.hash)throw Error('袋折りの候補を作ったときと再生結果が違います');
 const V2=globalThis.SquashV2,d=r.squash;
 return{pocketId:q.pocketId,before:C(state.cache.faces),after:C(r.cache.faces),sectorFace:C(d.sectorFace),
  moving:d.faces.filter(f=>f.moving).map(f=>f.faceId).sort(),drawOrder:V2.drawOrder(d),positions:t=>V2.positions(d,t,V2.drawOrder(d)),
  note:'厚み0。非貫通は未検証'}}
/* 🚨確定は原子的に。原本を複製して version 2 にし、候補の手を足して**共通入口で先頭から再生**・上限・ハッシュ再照合・
   候補を作ったときの結果との一致をぜんぶ見てから入れかえる。途中で断ったら recipe も revision も cache も
   redoStack も**候補（pending）も**そのまま。 */
function confirmSquash(state,meta={}){const q=state.pending;
 if(!q||q.inputMode!=='squash')throw Error('袋折りの候補がありません');
 if(q.revision!==state.revision)throw Error('確定候補が古くなっています');
 const trial=C(state.recipe);
 if(meta.name)trial.work.name=meta.name;if(meta.id)trial.work.id=meta.id;
 trial.version=2;trial.steps.push(C(q.step));
 if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(trial);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 if(cache.hash!==q.hash)throw Error('袋折りの候補を作ったときと再生結果が違います');
 state.recipe=trial;state.redoStack=[];state.revision++;state.pending=null;state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* ================= 🌸 花弁折り（つる⑧⑨・1回目）の候補と確定 =================
   袋折りと同じ規則：候補を作るだけでは原本・revision・cache・redoStack を動かさない（pending だけ）。
   手の中身（base・pivots・axes・branch・stack）は PetalV2 がいまの cache から組み、共通入口で先頭から再生して通ったものだけを候補にする。
   確定は原子的（原本を複製して v2 にし、1手足して再生・上限・ハッシュ再照合・候補との一致を見てから入れかえる）。 */
function buildPetals(state){
 if(state.recipe.steps.length>=MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const P=globalThis.PetalV2;
 if(!P||typeof P.candidateSteps!=='function')throw Error('花弁折りの再生器（petal_v2.js）が読みこまれていません');
 if(!globalThis.SquashV2||typeof globalThis.SquashV2.replayWith!=='function')throw Error('v2 の再生器（squash_v2.js）が読みこまれていません');
 const n=state.recipe.steps.length+1,c=P.candidateSteps(state.cache,`s${n}`,String(n));
 const out=[];
 for(const step of c.steps){const trial=C(state.recipe);trial.version=2;trial.steps.push(step);
  const r=replayDetail(trial);
  if(r.cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
  if(digest(replay(trial))!==r.cache.hash)throw Error('JSON再生結果が安定しません');
  out.push({step,cache:r.cache,detail:r.petals[r.petals.length-1]})}
 return{items:out,reason:c.reason}}
function petalOptions(state){
 if(state.pending)return{options:[],reason:'確定か取消をしてから花弁を選んでください'};
 let b;try{b=buildPetals(state)}catch(e){return{options:[],reason:e.message}}
 if(!b.items.length)return{options:[],reason:b.reason};
 return{options:b.items.map(it=>{const ids=[it.detail.faceOf.T2R,it.detail.faceOf.T2L];
  return{petalId:it.detail.petalId,stepId:it.step.id,faceIds:ids,outline:ids.map(id=>C(state.cache.faces.find(f=>f.faceId===id).poly)),moving:it.detail.moving.slice()}}),reason:null}}
/* 指した所に花弁があるか（読むだけ）。その場所の重なりに花弁の面が入っていれば、その花弁。 */
function petalOptionAt(state,at){const o=petalOptions(state);if(!o.options.length)return null;
 const here=new Set(stackAt(state,at).map(v=>v.faceId));
 return C(o.options.find(op=>op.faceIds.some(id=>here.has(id)))||null)}
function proposePetal(state,petalId){
 if(state.pending)throw Error('確定か取消をしてから花弁を選んでください');
 const before={rec:JSON.stringify(state.recipe),rev:state.revision,hash:state.cache.hash,redo:JSON.stringify(redoOf(state))};
 const b=buildPetals(state);
 if(!b.items.length)throw Error(b.reason||'いまの紙には、選べる花弁がありません');
 const it=petalId===undefined?(b.items.length===1?b.items[0]:null):b.items.find(v=>v.detail.petalId===petalId);
 if(!it)throw Error(petalId===undefined?'花弁が1つに決まりません（選んでください）':'選んだ花弁が、いまの紙の花弁と違います');
 if(JSON.stringify(state.recipe)!==before.rec||state.revision!==before.rev
  ||state.cache.hash!==before.hash||JSON.stringify(redoOf(state))!==before.redo)throw Error('花弁折りの候補が正式な状態を変えました');
 state.pending={inputMode:'petal',revision:state.revision,step:C(it.step),hash:it.cache.hash,petalId:it.detail.petalId};
 return C(state.pending)}
/* プレビュー（読むだけ）。途中の座標は PetalV2.positions（検証モデルと同じ式）、両端は engine の面（t=0 いまの紙／t=1 候補の再生結果）。 */
function petalPreview(state){const q=state.pending;
 if(!q||q.inputMode!=='petal')throw Error('花弁折りの候補がありません');
 if(q.revision!==state.revision)throw Error('確定候補が古くなっています');
 const trial=C(state.recipe);trial.version=2;trial.steps.push(C(q.step));
 const r=replayDetail(trial);
 if(r.cache.hash!==q.hash)throw Error('花弁折りの候補を作ったときと再生結果が違います');
 const P=globalThis.PetalV2,d=r.petals[r.petals.length-1];
 return{petalId:q.petalId,before:C(state.cache.faces),after:C(r.cache.faces),moving:d.moving.slice(),faceOf:C(d.faceOf),
  drawOrder:P.drawOrder(d),frames:t=>P.frames(d,t),positions:t=>P.positions(d,t),note:'厚み0。受理は検証ずみの1回目の花弁折りだけ'}}
function confirmPetal(state,meta={}){const q=state.pending;
 if(!q||q.inputMode!=='petal')throw Error('花弁折りの候補がありません');
 if(q.revision!==state.revision)throw Error('確定候補が古くなっています');
 const trial=C(state.recipe);
 if(meta.name)trial.work.name=meta.name;if(meta.id)trial.work.id=meta.id;
 trial.version=2;trial.steps.push(C(q.step));
 if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 const cache=replay(trial);
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 if(cache.hash!==q.hash)throw Error('花弁折りの候補を作ったときと再生結果が違います');
 state.recipe=trial;state.redoStack=[];state.revision++;state.pending=null;state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* 🚨巻き戻しは「最後の1手を外して、先頭から再生しなおす」。外した手はそのまま redoStack へ積む
   ＝残すのは**原本の手だけ**。pending があるあいだは断る＝画面の候補と原本がずれたまま履歴を動かさない。 */
function undo(state){if(state.pending)throw Error('確定か取消をしてから巻き戻してください');
 if(!state.recipe.steps.length)throw Error('巻き戻す手順がありません');
 const trial=C(state.recipe),step=trial.steps.pop();
 const cache=replay(trial);/* 巻き戻した先も必ず作り直し、通ったものだけを入れかえる。 */
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 state.recipe=trial;state.redoStack=[...redoOf(state),C(step)];state.revision++;
 state.cache=cache;state.cacheRevision=state.revision;state.committed=trial.steps.length?cache:null;
 return C(cache)}
/* やり直し＝undo で外した手を原本の複製に戻し、**先頭から再生**する。確定とまったく同じ関門
   （recordable／手順と面の上限／foldableSet／結び／層順位／ハッシュ）を通してから入れかえる＝原子的。
   ⚠redoStack に持っているのは手だけなので、面も層も「作り直した結果」しか信じない。 */
function redo(state){if(state.pending)throw Error('確定か取消をしてからやり直してください');
 const stack=redoOf(state);if(!stack.length)throw Error('やり直す手順がありません');
 const step=stack[stack.length-1];
 /* 🧺 袋折りの手＝折線を持たないので折りの関門は通さない。共通入口で先頭から再生し、上限とハッシュ再照合を通してから入れかえる。
    ⚠原本の version は変えない（undo で squash が0手になった v2 は v2 のまま戻ってくる）。 */
 if(step&&(step.op==='squash'||step.op==='petal')){const trial=C(state.recipe);trial.steps.push(C(step));
  if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
  const sc=replay(trial);
  if(sc.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
  if(digest(replay(trial))!==sc.hash)throw Error('JSON再生結果が安定しません');
  state.recipe=trial;state.redoStack=stack.slice(0,-1);state.revision++;
  state.cache=sc;state.cacheRevision=state.revision;state.committed=sc;
  return C(sc)}
 /* 🚨ここも `op==='flip'` 以外は fold の道へ行く＝知らない操作を素通ししていた。replay と同じ門を通す。 */
 assertOp(step,'やり直し');
 const trial=C(state.recipe);trial.steps.push(C(step));
 if(trial.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 /* 🔄 裏返しは折線を持たない＝基準面も movingSidePoint も無いので、折りの関門は通さない。
    再生・面の上限・ハッシュ再照合は下で同じように通る＝原子的なのは fold と変わらない。 */
 if(step.op==='flip'){const fc=replay(trial);
  if(fc.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
  if(digest(replay(trial))!==fc.hash)throw Error('JSON再生結果が安定しません');
  state.recipe=trial;state.redoStack=stack.slice(0,-1);state.revision++;
  state.cache=fc;state.cacheRevision=state.revision;state.committed=fc;
  return C(fc)}
 const f=state.cache.faces.find(x=>x.faceId===step.reference.faceId);
 if(!f)throw Error('やり直す手の基準面がいまの紙にありません');
 const sp=apply(f.xf,step.movingSidePoint);
 let A=apply(f.xf,step.line[0]),B=apply(f.xf,step.line[1]);if(S(sp,A,B)>0)[A,B]=[B,A];
 const ids=(step.targets&&step.targets.length?step.targets:[step.reference]).map(t=>t.faceId);
 const rec=recordable(state,ids,step.reference.faceId,A,B,sp,step.line);
 if(!rec.ok)throw Error(rec.reason);
 if(JSON.stringify(rec.line)!==JSON.stringify(step.line))throw Error('やり直す手の折線が原本と合いません');
 const cache=replay(trial);/* 結び・層順位・faceId・foldableSet はここで全部見る。 */
 if(cache.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(digest(replay(trial))!==cache.hash)throw Error('JSON再生結果が安定しません');
 state.recipe=trial;state.redoStack=stack.slice(0,-1);state.revision++;
 state.cache=cache;state.cacheRevision=state.revision;state.committed=cache;
 return C(cache)}
/* 保存の直前に、原本を先頭から再生して表示と突き合わせる。digest には面ID・layerPath・面の形・xf・層順位・
   折り目・ヒンジ・結びが入っているので、ひとつでも違えばここで止まる＝食い違ったものは書き出さない。 */
function verifiedRecipe(state){const fresh=replay(state.recipe);
 if(fresh.faces.length>MAX_FACES)throw Error(`面が${MAX_FACES}枚を超えます`);
 if(state.recipe.steps.length>MAX_STEPS)throw Error(`原本は${MAX_STEPS}手までです`);
 if(fresh.hash!==state.cache.hash)throw Error('JSON再生結果と表示状態が一致しないため保存できません');
 return C(state.recipe)}
return{create,replay,replayDetail,proposeSquash,squashOptions,squashOptionAt,squashPreview,petalOptions,petalOptionAt,proposePetal,petalPreview,propose,proposeOnFace,setSide,select,preview,cancel,confirm,flip,stage,stageSide,confirmStaged,stageFold,confirmStagedFold,proposeOpen,wholeSideOf,undo,redo,verifiedRecipe,hitFaces,split,reflect,inside,side:S,area,sheetOf,sheetIds,assertSupported,outerEdges:C(OUTER),pickOuterEdge,proposeEdgePair,
 stackAt,layersAt,topFaces,rimEdges,creaseIntervals,edgeIntent,creaseIntent,resolveRimEdge,resolveCreaseInterval,hingeIntervals,hingeIntent,resolveHingeInterval,axesEdgeToCrease,checkEdgeToCrease,edgeToCreaseOptions,verifyEdgeToCrease,edgeToHingeOptions,verifyEdgeToHinge,edgeToEdgeOptions,verifyEdgeToEdge,rimEdgeVisible,axisSplitsSheet,hingeStaysUnderFold,fixedHingePart,movingIdsFor,foldRotator,paperRootOf,foldability,foldableSet,creasability,creasableSet,contiguousAt,pendingCheck,recordable,setLayers,setSideAll,sideAllFaces,stageLine,setFlap,flapFaces,outlineHingeEdges,hingeEdgeIntent,resolveSourceEdge,extendGuide,creaseSidePoint,MAX_STEPS,MAX_FACES,polysOverlap,overlapsArea,strictlyInside,detXf,hingeMemoStats:()=>({...hingeMemoStats})};
})();
