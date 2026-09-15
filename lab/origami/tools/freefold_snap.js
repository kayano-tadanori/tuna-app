/* Grab-and-carry input layer. Pure geometry on top of FreeFoldEngine; it never writes the recipe.
   Picking and aiming are measured in SCREEN pixels through view.toScreen: the paper is drawn tilted,
   so a paper-space radius is a different distance up the screen than across it, and a press that looks
   like it is on the corner would land on the edge. What the finger points at is a screen-space question.

   外周辺は「面ごとの線分」としてつかむ。つかんだ線分＋その線分を持つ面＋平行な行き先線、の3つで
   折りが決まる規則ひとつで、初期の正方形も折り目つきの平らな紙も、対辺への半分折りも部分的な辺折りも
   同じ道を通る（engine の proposeEdgePair は残してあるが、この入力層からは呼ばない）。 */
'use strict';
globalThis.FreeFoldSnap=(()=>{
const E=()=>globalThis.FreeFoldEngine,CORNER_PX=28,EDGE_PX=16,AIM_PX=84,HOLD_PX=144,HYST_PX=43,MIN_CARRY_PX=30,SNAP_PX=26,UNSNAP_PX=44,COMMIT=.5,SAME=.04;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),key=p=>Math.round(p[0]*1e6)+'|'+Math.round(p[1]*1e6);
const centroid=poly=>poly.reduce((s,v)=>[s[0]+v[0]/poly.length,s[1]+v[1]/poly.length],[0,0]);
function corners(state){const m=new Map();for(const f of state.cache.faces)for(const p of f.poly){const k=key(p);if(!m.has(k))m.set(k,[p[0],p[1]])}return[...m.values()]}
function onSegment(p,a,b){const d=[b[0]-a[0],b[1]-a[1]],L2=d[0]**2+d[1]**2||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/L2));return{t,point:[a[0]+t*d[0],a[1]+t*d[1]]}}
/* 外周辺をつかめるのは「いまの紙が平ら」なとき。手順の数では見ない＝折り目(crease)だけを付けた紙は
   面が分かれていても平らなのでつかめる。折った紙は cut 側の層が0でなくなるので、ここで外れる。 */
/* 紙が平ら＝どの面も layer 0 で、どの面の変換も「紙ぜんぶを裏返した分」しか入っていないこと。
   🔄flip は engine の replay で poly を鏡映し **xf に合成する**ので、裏返した紙の xf は恒等ではなく
   対角の符号だけが入れかわった形になる（例 [-1,0,0,1,0,0]）。ここを恒等だけに絞っていたせいで、
   **裏返すと外周の辺がつかめなくなっていた**（2026-09-13・本人が画像で指摘）。表裏で操作が変わっていた。
   🚨緩めてはいない：折れば必ずどこかの面が layer 0 から外れる（flip は layer の符号を返すだけ）ので、
   折った紙はここを通らない。回転・平行移動・せん断も通らない＝通るのは裏返しの合成だけ。 */
const flipOnly=xf=>Math.abs(Math.abs(xf[0])-1)<1e-9&&Math.abs(Math.abs(xf[3])-1)<1e-9&&
 [1,2,4,5].every(i=>Math.abs(xf[i])<1e-9);
function isFlat(state){const fs=state.cache.faces;
 return fs.every(f=>f.layer===0&&flipOnly(f.xf)&&f.xf.every((v,i)=>Math.abs(v-fs[0].xf[i])<1e-9))}
/* その線分が紙の外周（もとの正方形の4辺）の上に乗っているか。乗っていなければ紙の中の線＝折り目。 */
function outerLineOf(a,b){for(const e of E().outerEdges)if(Math.abs(E().side(a,e.a,e.b))<=1e-7&&Math.abs(E().side(b,e.a,e.b))<=1e-7)return e;return null}
/* 外周の辺を「面ごとの線分」で数え上げる。折り目で分かれていても、つかんだ線分から対象面が決まる。 */
function outerSegments(state){const out=[];
 for(const f of state.cache.faces)for(let i=0;i<f.poly.length;i++){const a=f.poly[i],b=f.poly[(i+1)%f.poly.length];
  if(dist(a,b)<=SAME)continue;const e=outerLineOf(a,b);if(!e)continue;
  out.push({faceId:f.faceId,poly:f.poly,id:e.id,label:e.label,a,b})}
 return out}
/* つかんだ線分から、その面の内側へ向かう単位法線。 */
function inwardNormal(a,b,poly){const d=[b[0]-a[0],b[1]-a[1]],L=Math.hypot(d[0],d[1]),u=[d[0]/L,d[1]/L],
 c=centroid(poly),v=[c[0]-a[0],c[1]-a[1]],t=v[0]*u[0]+v[1]*u[1],n=[v[0]-t*u[0],v[1]-t*u[1]],m=Math.hypot(n[0],n[1]);
 return[n[0]/m,n[1]/m]}
/* 🧭 ガイド＝スナップの候補になる線。集めるのは「同じ紙片(sheet)の外周辺」と「同じ紙片の折り目」だけ。
   別の紙片・別の層・重なった紙の外周は、入力が紙片ひとつぶんなので最初から入ってこない（除外表は書かない）。
   角も辺も、吸い付き先はここ一本から作る＝「つかんだ面の中だけ」で候補を作っていた頃の穴を塞ぐ。 */
function guidesOf(state,sheet){const ids=new Set(sheet.map(f=>f.faceId)),raw=[];
 for(const f of sheet)for(let i=0;i<f.poly.length;i++){const a=f.poly[i],b=f.poly[(i+1)%f.poly.length];
  if(dist(a,b)<=SAME)continue;const e=outerLineOf(a,b);if(!e)continue;
  raw.push({a:[a[0],a[1]],b:[b[0],b[1]],kind:'edge',id:e.id,label:e.label})}
 for(const c of state.cache.creases||[]){if(!ids.has(c.faceId))continue;
  if(dist(c.seg[0],c.seg[1])<=SAME)continue;
  raw.push({a:c.seg[0].slice(),b:c.seg[1].slice(),kind:'crease',id:'crease',label:'折り目'})}
 return mergeGuides(raw)}
const guideUnit=g=>{const d=[g.b[0]-g.a[0],g.b[1]-g.a[1]],L=Math.hypot(d[0],d[1]);return[d[0]/L,d[1]/L]};
function guideCollinear(o,g){const u=guideUnit(o),v=guideUnit(g);
 if(Math.abs(u[0]*v[1]-u[1]*v[0])>1e-9)return false;
 return Math.abs((g.a[0]-o.a[0])*u[1]-(g.a[1]-o.a[1])*u[0])<=1e-7}
/* 接している（または重なっている）ときだけ1本にする。離れた2本のあいだのすきまは埋めない。 */
function joinGuides(o,g){const u=guideUnit(o),base=o.a,t=p=>(p[0]-base[0])*u[0]+(p[1]-base[1])*u[1];
 const A=[t(o.a),t(o.b)].sort((x,y)=>x-y),B=[t(g.a),t(g.b)].sort((x,y)=>x-y);
 if(B[0]>A[1]+SAME||A[0]>B[1]+SAME)return null;
 const lo=Math.min(A[0],B[0]),hi=Math.max(A[1],B[1]);
 return{...o,a:[base[0]+u[0]*lo,base[1]+u[1]*lo],b:[base[0]+u[0]*hi,base[1]+u[1]*hi]}}
/* 🚨共線のつなぎ直しは「同じ kind どうし」だけ（本人指示 2026-09-12）。外周辺と既存の折り目は、
   たとえ同じ直線の上で接していても1本にしない＝吸いついた時の意味（ふち／折り目）と表示を保つため。
   折り目で割れて同じ距離に並んだ外周辺の片割れは、ここでつなぐ。捨てると片方の上で吸いつかなくなる。 */
function mergeGuides(list){const out=[];
 for(const g of list){let cur={...g,a:g.a.slice(),b:g.b.slice()};
  for(let again=true;again;){again=false;
   for(let i=0;i<out.length;i++){const o=out[i];
    if(o.kind!==cur.kind||!guideCollinear(o,cur))continue;
    const j=joinGuides(o,cur);if(!j)continue;
    out.splice(i,1);cur=j;again=true;break}}
  out.push(cur)}
 return out}
/* つかんだ角を持つ面。重なっているときは、いちばん上（creaseForCorners と同じ選び方）。 */
function faceAtCorner(state,p){return state.cache.faces.filter(f=>f.poly.some(q=>dist(q,p)<=SAME)).sort((a,b)=>b.layer-a.layer)[0]||null}
function guidesAtCorner(state,p){const f=faceAtCorner(state,p);return f?guidesOf(state,E().sheetOf(state,f.faceId)):[]}
/* つかんだ線分と平行なガイド＝辺折りの行き先。距離は法線方向、近い順。 */
function parallelGuides(guides,a,b,n){const d=[b[0]-a[0],b[1]-a[1]];
 return guides.filter(t=>Math.abs((t.b[0]-t.a[0])*d[1]-(t.b[1]-t.a[1])*d[0])<=1e-9)
  .map(t=>({...t,d:(t.a[0]-a[0])*n[0]+(t.a[1]-a[1])*n[1]}))
  .filter(t=>t.d>SAME).sort((x,y)=>x.d-y.d)}
/* pointerdown decides corner or edge once, in pixels, and freezes what that grab may snap to.
   Within CORNER_PX of a corner it is always the corner, even when an outer edge runs closer. */
function grab(state,screen,view){const all=corners(state);let z=null;
 for(const q of all){const d=dist(view.toScreen(q),screen);if(!z||d<z.d)z={point:q,d}}
 /* ガイドも pointerdown のこの瞬間に確定させる＝ドラッグ中に候補が作り直されない。 */
 if(z&&z.d<=CORNER_PX){const f=faceAtCorner(state,z.point);
  return{type:'corner',point:z.point,faceId:f&&f.faceId,guides:f?guidesOf(state,E().sheetOf(state,f.faceId)):[],
   targets:all.filter(q=>dist(q,z.point)>SAME)}}
 if(isFlat(state)){let y=null;
  for(const s of outerSegments(state)){const d=dist(onSegment(screen,view.toScreen(s.a),view.toScreen(s.b)).point,screen);if(!y||d<y.d)y={seg:s,d}}
  if(y&&y.d<=EDGE_PX){const s=y.seg,n=inwardNormal(s.a,s.b,s.poly),sheet=E().sheetOf(state,s.faceId);
   /* 運べる幅も行き先の候補も「紙片ぜんぶ」から。折り目は行き先の候補にはなるが、そこで止まらない。 */
   let span=0;for(const f of sheet)for(const v of f.poly)span=Math.max(span,(v[0]-s.a[0])*n[0]+(v[1]-s.a[1])*n[1]);
   const guides=guidesOf(state,sheet),targets=parallelGuides(guides,s.a,s.b,n);
   if(span>SAME)return{type:'edge',faceId:s.faceId,edge:{id:s.id,label:s.label,a:s.a,b:s.b},normal:n,span,guides,targets,
    opposite:targets.length?targets[targets.length-1]:null}}}
 return null}
/* Has the finger left the spot it pressed on? Below this nothing is proposed and nothing folds. */
function movedEnough(originScreen,screen){return dist(originScreen,screen)>=MIN_CARRY_PX}
/* Which corner the drag aims at, and how far along the way the finger is (0 to 1).
   A corner grab only ever snaps to corners, and the aim holds: AIM_PX to take a target, HOLD_PX before
   letting it go, and a rival must win by more than HYST_PX to steal it. The projection is affine, so the
   travelled fraction is the same on screen as on the paper. */
function aimCorner(g,screen,currentKey,view){if(!g||g.type!=='corner')throw Error('角をつかんでいません');
 const from=view.toScreen(g.point);
 if(!movedEnough(from,screen))return null;
 const list=g.targets.map(q=>{const s=onSegment(screen,from,view.toScreen(q));return{target:q,progress:s.t,offset:dist(screen,s.point),key:key(q)}}).sort((a,b)=>a.offset-b.offset);
 if(!list.length)return null;const best=list[0],held=currentKey?list.find(z=>z.key===currentKey):null;
 if(held&&held.offset<=HOLD_PX&&held.offset<=best.offset+HYST_PX)return held;
 return best.offset<=AIM_PX?best:null}
/* An edge grab only ever snaps to a line parallel to itself, fixed at pointerdown. The carried fraction is
   a ratio along the paper's own normal, so it stays in paper coordinates. */
function edgeProgress(g,p){if(!g||g.type!=='edge')throw Error('辺をつかんでいません');return Math.max(0,Math.min(1,((p[0]-g.edge.a[0])*g.normal[0]+(p[1]-g.edge.a[1])*g.normal[1])/g.span))}
/* 辺の行き先＝指を通る平行線。ただし平行な境界線（対辺・折り目）の近くに入ったら、そこへ固定する。
   角の foldTarget とまったく同じ規則：入るのは SNAP_PX、離れるのは UNSNAP_PX。 */
function edgeTarget(g,screen,paper,view,wasSnapped){if(!g||g.type!=='edge')throw Error('辺をつかんでいません');
 const R=wasSnapped?UNSNAP_PX:SNAP_PX;let best=null;
 for(const t of g.targets){const px=dist(onSegment(screen,view.toScreen(t.a),view.toScreen(t.b)).point,screen);
  if(px<=R&&(!best||px<best.px))best={...t,px}}
 if(best)return{target:[g.edge.a[0]+g.normal[0]*best.d,g.edge.a[1]+g.normal[1]*best.d],snapped:true,snapKind:best.kind,label:best.label,distance:best.d};
 return{target:[paper[0],paper[1]],snapped:false,snapKind:null,label:null,distance:null}}
function clip(m,d){let lo=-Infinity,hi=Infinity;for(const i of[0,1]){if(Math.abs(d[i])<1e-12){if(m[i]<-1-1e-9||m[i]>1+1e-9)return null;continue}let t0=(-1-m[i])/d[i],t1=(1-m[i])/d[i];if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1)}
 if(!(hi-lo>1e-9))return null;return[[m[0]+lo*d[0],m[1]+lo*d[1]],[m[0]+hi*d[0],m[1]+hi*d[1]]]}
/* 直線を「その面の中」だけに切る。紙全体でなく対象面に合わせるので、折線が折り目の向こうへ伸びない。
   点は d の向きに並べて返す＝紙全体が1面のときは clip と同じ並びになる。 */
function clipToPoly(poly,m,d){const b=[m[0]+d[0],m[1]+d[1]],pts=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=E().side(p,m,b),v=E().side(q,m,b);
  if(Math.abs(u)<=1e-9)pts.push(p);
  else if((u>1e-9&&v<-1e-9)||(u<-1e-9&&v>1e-9)){const t=u/(u-v);pts.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}
 if(pts.length<2)return null;
 let lo=pts[0],hi=pts[0],tl=Infinity,th=-Infinity;
 for(const p of pts){const t=(p[0]-m[0])*d[0]+(p[1]-m[1])*d[1];if(t<tl){tl=t;lo=p}if(t>th){th=t;hi=p}}
 return dist(lo,hi)>1e-9?[lo,hi]:null}
/* 紙片ぜんぶを覆う長さに折線を切る。面ごとに切ってから、いちばん外側の2点をとる。
   折り目でいくつに割れていても、折線は紙片ひとつぶんの長さになる。 */
function clipToSheet(sheet,m,d){let lo=null,hi=null,tl=Infinity,th=-Infinity;
 for(const f of sheet){const seg=clipToPoly(f.poly,m,d);if(!seg)continue;
  for(const p of seg){const t=(p[0]-m[0])*d[0]+(p[1]-m[1])*d[1];if(t<tl){tl=t;lo=p}if(t>th){th=t;hi=p}}}
 return lo&&hi&&dist(lo,hi)>1e-9?[lo,hi]:null}
/* 折線の「動く側」にある面積を紙片ぜんぶで数える。動く割合＝これ÷紙片ぜんぶの面積。 */
function movingArea(sheet,line,sg){let mv=0,all=0;
 for(const f of sheet){all+=area(f.poly);
  const p=E().split(f.poly,line[0],line[1]).find(q=>q&&Math.sign(E().side(centroid(q),line[0],line[1]))===sg);
  if(p)mv+=area(p)}
 return{moving:mv,total:all,ratio:all>0?mv/all:0}}
/* ガイドの上の吸い付き先：交点・端点・線上の最近点。角をつかんだときだけ使う。 */
function segCross(a,b){const r=[a[1][0]-a[0][0],a[1][1]-a[0][1]],s2=[b[1][0]-b[0][0],b[1][1]-b[0][1]],d=r[0]*s2[1]-r[1]*s2[0];
 if(Math.abs(d)<1e-9)return null;const q=[b[0][0]-a[0][0],b[0][1]-a[0][1]],t=(q[0]*s2[1]-q[1]*s2[0])/d,u=(q[0]*r[1]-q[1]*r[0])/d;
 return(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)?[a[0][0]+t*r[0],a[0][1]+t*r[1]]:null}
/* ふちどうしが交わる点＝紙片の「角」。ここへは吸いつかない＝角を折るとき、行き先が隣の角へ飛ばない。
   ⚠「いまの紙の頂点ぜんぶ」で弾いてはいけない：折り目の端も頂点なので、折り目の端への吸い付きまで消える。 */
function rimCorners(guides){const out=[];
 for(let i=0;i<guides.length;i++){if(guides[i].kind!=='edge')continue;
  for(let j=i+1;j<guides.length;j++){if(guides[j].kind!=='edge')continue;
   const x=segCross([guides[i].a,guides[i].b],[guides[j].a,guides[j].b]);if(x)out.push(x)}}
 return out}
/* ⚠外周辺どうしの交点と、外周辺の端点は候補にしない。どちらも「紙の角」で、
     『角を折るときに隣の角へは吸いつかない』という決めごとを壊してしまう（対角だけは別枠で足す）。
     外周辺は「線分の途中」として効く＝要件どおり、ふちの好きな場所に緑が乗る。 */
function guidePoints(guides,screen,view){const out=[];
 for(let i=0;i<guides.length;i++){const g=guides[i];
  if(g.kind==='crease')out.push({point:g.a.slice(),type:'end',on:'crease'},{point:g.b.slice(),type:'end',on:'crease'});
  for(let j=i+1;j<guides.length;j++){const h=guides[j];
   if(g.kind==='edge'&&h.kind==='edge')continue;
   const x=segCross([g.a,g.b],[h.a,h.b]);if(x)out.push({point:x,type:'cross',on:g.kind===h.kind?g.kind:'mixed'})}}
 guides.forEach((g,i)=>{const n=onSegment(screen,view.toScreen(g.a),view.toScreen(g.b));
  out.push({point:[g.a[0]+(g.b[0]-g.a[0])*n.t,g.a[1]+(g.b[1]-g.a[1])*n.t],type:'line',on:g.kind,gi:i})});
 return out}
/* その点がガイドの線分の上に乗っているか（端点も含む）。 */
function onGuideSeg(v,p){const d=[v.b[0]-v.a[0],v.b[1]-v.a[1]],L=Math.hypot(d[0],d[1]);
 if(L<1e-12)return false;
 const u=[d[0]/L,d[1]/L],w=[p[0]-v.a[0],p[1]-v.a[1]],t=w[0]*u[0]+w[1]*u[1];
 if(t<-1e-7||t>L+1e-7)return false;
 return Math.abs(w[0]*u[1]-w[1]*u[0])<=1e-7}
/* 角を折るときの吸い付き先は、最初の正方形の「対角の角」だけ。隣の角には吸いつかせない。
   原点対称の角が対角＝**折っていない正方形**でだけ成り立つので、1手でも折ったら候補は無い。
   🔄裏返し(flip)だけは手数に数えない＝紙ぜんぶの鏡映なので角は角のまま・原点対称もそのまま成り立つ。
   数えていたせいで、裏返すと通常の角ドラッグから対角へ吸いつかず、「角を角へ合わせる」を押すしか
   道がなくなっていた（2026-09-13・本人が画像で指摘）。判定そのもの（原点対称・SAME）は無変更。 */
/* 🔺 2026-09-14（本人が画像で指摘）：1回半分に折った三角形で、角をもう一方の角へ運んでも角に吸いつかず、
   足元でない方のふちの「線上」に吸いついて折線がずれていた（実Chrome：行き先 y=-0.952、折線が対角から 0.012 ずれた）。
   原因は上の「原点対称の角」＝**折っていない正方形でだけ**成り立つ計算を候補にしていたこと（1手でも折ると候補0）。
   → 候補は**いまの紙の実際の頂点**から作る：
     ①紙の外形の角＝面ごとの「その頂点での内角のくさび」を合わせた広がりが、360°（紙の内側）でも
       一直線の180°（ふちの途中・折り目の端）でもない点（outlineCorners）。
     ②つかんだ角が乗っている外周ガイド（足元のふち）の上にある角は除く＝隣の角へは吸いつかない（従来の決めごと）。
   折っていない正方形では、①が4隅・②で隣の2つが消える＝従来と同じ対角1つだけになる（裏返しても同じ）。
   ⚠名前（diagonalOf・snapKind 'diagonal'）と順位（交点 > 端点 > 角 > 線上）、26/44px は変えない。 */
function outlineCorners(state){const faces=state.cache.faces,TAU=2*Math.PI,EPS=1e-6,out=[];
 const ang=v=>{let a=Math.atan2(v[1],v[0]);return a<0?a+TAU:a};
 const signedArea=p=>{let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return s/2};
 for(const q of corners(state)){const arcs=[];let inner=false;
  for(const f of faces){const p=f.poly,n=p.length,k=p.findIndex(v=>dist(v,q)<=SAME);
   if(k>=0){const prev=p[(k+n-1)%n],next=p[(k+1)%n],dp=[prev[0]-q[0],prev[1]-q[1]],dn=[next[0]-q[0],next[1]-q[1]];
    /* 反時計回りの面なら、内側は next の向きから反時計回りに prev の向きまで。 */
    const[s0,s1]=signedArea(p)>0?[ang(dn),ang(dp)]:[ang(dp),ang(dn)];
    arcs.push([s0,((s1-s0)%TAU+TAU)%TAU]);continue}
   /* 頂点ではないが辺の途中に乗っている面は半平面、内部にある面は全周。 */
   let onEdge=null;for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%n],o=onSegment(q,a,b);
    if(dist(o.point,q)<=1e-9&&o.t>1e-9&&o.t<1-1e-9){onEdge=[a,b];break}}
   if(onEdge){const d=[onEdge[1][0]-onEdge[0][0],onEdge[1][1]-onEdge[0][1]],s=signedArea(p)>0?ang(d):ang([-d[0],-d[1]]);arcs.push([s,Math.PI]);continue}
   if(E().inside(q,p)){inner=true;break}}
  if(inner||!arcs.length)continue;
  /* くさびの和集合（円周上）。始まりの角で並べ、つながる所をまとめる。 */
  const segs=[];for(const[s,w]of arcs){if(w<=EPS)continue;if(s+w>TAU+EPS){segs.push([s,TAU]);segs.push([0,s+w-TAU])}else segs.push([s,Math.min(TAU,s+w)])}
  segs.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const g of segs){const m=merged[merged.length-1];if(m&&g[0]<=m[1]+EPS)m[1]=Math.max(m[1],g[1]);else merged.push(g.slice())}
  if(merged.length>1&&merged[0][0]<=EPS&&merged[merged.length-1][1]>=TAU-EPS){const last=merged.pop();merged[0][0]=last[0]-TAU}
  const cover=merged.reduce((s,g)=>s+g[1]-g[0],0);
  if(cover>=TAU-EPS)continue;/* 紙の内側 */
  if(merged.length===1&&Math.abs(cover-Math.PI)<=EPS)continue;/* ふちの途中（一直線） */
  out.push(q)}
 return out}
function diagonalOf(state,g){const all=diagonalsOf(state,g);return all.length?all[0]:null}
/* つかんだ角から吸いつける「相手の角」（いまの紙の外形の角のうち、足元のふちに乗っていないもの）。 */
function diagonalsOf(state,g){if(!g||g.type!=='corner')return[];
 const guides=g.guides||guidesAtCorner(state,g.point);
 const foot=guides.filter(v=>v.kind==='edge'&&onGuideSeg(v,g.point));
 return outlineCorners(state).filter(q=>dist(q,g.point)>SAME&&!foot.some(v=>onGuideSeg(v,q)))}
/* 行き先＝指の点。ただし同じ紙片のガイド（外周辺・折り目）と対角の近くに入ったら、そこへ固定する。
   入るのは SNAP_PX、離れるのは UNSNAP_PX。ガイドは pointerdown で凍結したものを使う。 */
function foldTarget(state,g,screen,paper,view,wasSnapped){const R=wasSnapped?UNSNAP_PX:SNAP_PX,list=[];
 for(const d of diagonalsOf(state,g))list.push({point:d,type:'diagonal',on:'corner'});
 const guides=g.guides||guidesAtCorner(state,g.point),rim=rimCorners(guides);
 /* 🚨つかんだ角が乗っている外周ガイドは「線上」の候補を出さない（2026-09-12・実測で決めた）。
    足元のふちへ吸いつくと、角をふちに沿って滑らせるだけの折りになる。しかも MIN_CARRY_PX を越えた直後は
    まだ必ず足元のふちの26px内にいるので、ふつうの角折りが毎回そこで持っていかれていた
    （実測：角(1,-1)→まん中で20歩中5歩が吸着、黄が指から最大43.9px離れた）。
    向こう側のふち・折り目・交点・端点・対角はそのまま＝優先順位は1つも変えない。 */
 const foot=new Set();guides.forEach((v,i)=>{if(v.kind==='edge'&&onGuideSeg(v,g.point))foot.add(i)});
 for(const t of guidePoints(guides,screen,view)){
  if(dist(t.point,g.point)<=SAME)continue;/* つかんだ角そのものへは吸いつかない。 */
  if(t.type==='line'&&foot.has(t.gi))continue;/* 足元のふちの上には乗せない。 */
  if(rim.some(q=>dist(q,t.point)<=1e-9))continue;/* 隣の角へは吸いつかない（対角だけは上で別に足してある）。 */
  list.push(t)}
 /* 交点 > 端点 > 対角 > 線上。同じ種類なら画面で近い方。 */
 const rank={cross:0,end:1,diagonal:2,line:3};
 let best=null;for(const t of list){const px=dist(view.toScreen(t.point),screen);
  if(px>R)continue;if(!best||rank[t.type]<rank[best.type]||(rank[t.type]===rank[best.type]&&px<best.px))best={...t,px}}
 /* 選んだ点が折り目の端と同じなら、表示だけ「折り目の端」と言う。
    ⚠候補の順位も座標も変えない＝`snapKind` はそのまま（ふちの上の交点なら cross のまま）。
    折り目の端は必ずふちか別の折り目の上にあるので、交点が端点に勝ち、言葉だけが分かりにくくなっていた。 */
 if(best){const atEnd=guides.some(v=>v.kind==='crease'&&(dist(v.a,best.point)<=1e-9||dist(v.b,best.point)<=1e-9));
  return{target:best.point,snapped:true,snapKind:best.type,snapOn:best.on||null,snapAtCreaseEnd:atEnd}}
 return{target:[paper[0],paper[1]],snapped:false,snapKind:null,snapOn:null,snapAtCreaseEnd:false}}
const area=poly=>{let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1];return Math.abs(a)/2};
/* 辺折り：つかんだ線分と行き先線の中間が折線、動くのは線分がいる側の帯だけ。対象面は「つかんだ線分を
   持っている面」＝折り目の向こう側の面は、折線が同じ直線上にあっても最初から相手にしない。
   行き先が対辺なら折線は中線＝従来の対辺どうしの半分折りと、折線も movingSidePoint も対象面も同じ。 */
function creaseForEdge(state,g,target){if(!g||g.type!=='edge')throw Error('辺をつかんでいません');
 const f=state.cache.faces.find(v=>v.faceId===g.faceId);
 if(!f)throw Error('つかんだ辺が今の紙にありません');
 /* 折り目は行き先の目印にはなるが、壁ではない＝運べる幅も折線の長さも紙片ぜんぶで見る。 */
 const sheet=E().sheetOf(state,g.faceId);
 const a=g.edge.a,n=g.normal,d=(target[0]-a[0])*n[0]+(target[1]-a[1])*n[1];
 if(d<=1e-6)throw Error('行き先は紙の内側にしてください');
 if(d>g.span+1e-6)throw Error('行き先は紙の内側にしてください');
 const dir=[g.edge.b[0]-g.edge.a[0],g.edge.b[1]-g.edge.a[1]];
 const line=clipToSheet(sheet,[a[0]+n[0]*d/2,a[1]+n[1]*d/2],dir);
 if(!line)throw Error('折線が紙の中に入りません');
 /* 動く側は「つかんだ線分と折線の同じ側」で選ぶ。頂点が近いかで選ぶと、細い帯や短い線分では
    止まる側の頂点まで範囲に入って、止まる側を動く側と取りちがえる（＝紙の外に印が出る）。 */
 const mid=[(g.edge.a[0]+g.edge.b[0])/2,(g.edge.a[1]+g.edge.b[1])/2],sg=Math.sign(E().side(mid,line[0],line[1]));
 const piece=E().split(f.poly,line[0],line[1]).find(q=>q&&Math.sign(E().side(centroid(q),line[0],line[1]))===sg);
 if(!piece)throw Error('つかんだ辺が動く側になりません');
 /* 動く側の点は、角折りと同じく重心より「つかんだ物寄り6割」。折線から遠ざかるので細い帯でも
    エンジンの「折線から離れた側を選んでください」に当たりにくい。しかも対辺まで運んだ半分折りでは、
    これがちょうど従来の proposeEdgePair の movingSidePoint（辺の inside 点）と一致する。 */
 const c=centroid(piece);
 const sidePoint=[c[0]+(mid[0]-c[0])*.6,c[1]+(mid[1]-c[1])*.6];
 return{line,sidePoint,ratio:movingArea(sheet,line,sg).ratio,targetLine:clipToSheet(sheet,[a[0]+n[0]*d,a[1]+n[1]*d],dir),
  distance:d,progress:Math.max(0,Math.min(1,d/g.span))}}
/* Carrying the grabbed corner onto a point is the perpendicular bisector, clipped to the unfolded sheet.
   The moving side is the piece that holds that corner. `ratio` is how much of the face moves:
   half or more is a half fold, not a corner fold. `requireInside` keeps the destination on the paper. */
function creaseForCorners(state,from,target,opts={}){
 const f=state.cache.faces.filter(v=>v.poly.some(q=>dist(q,from)<=SAME)).sort((a,b)=>b.layer-a.layer)[0];
 if(!f)throw Error('つかんだ角が今の紙にありません');
 const sheet=E().sheetOf(state,f.faceId);
 /* 断る理由は行き先から先に見る。紙の外なら、折線の形より先に「内側にしてください」と言う。
    ここでいう「紙」は面ひとつでなく紙片ぜんぶ＝折り目の向こうへ運んでもよい。 */
 if(opts.requireInside&&!sheet.some(x=>E().inside(target,x.poly)))throw Error('行き先は紙の内側にしてください');
 const m=[(from[0]+target[0])/2,(from[1]+target[1])/2],line=clipToSheet(sheet,m,[-(target[1]-from[1]),target[0]-from[0]]);
 if(!line)throw Error('折線が紙の中に入りません');
 /* 辺折りと同じ規則：動く側は「つかんだ角と折線の同じ側」。頂点の近さでは、小さい折りで取りちがえる。 */
 const sg=Math.sign(E().side(from,line[0],line[1]));
 const piece=E().split(f.poly,line[0],line[1]).find(q=>q&&Math.sign(E().side(centroid(q),line[0],line[1]))===sg);
 if(!piece)throw Error('つかんだ角が動く側になりません');
 const g=centroid(piece),ratio=movingArea(sheet,line,sg).ratio;
 /* 動く側の点は重心より「つかんだ角寄り」へ寄せる。小さい三角だと重心が折線に近すぎて、
    エンジンの「折線から離れた側を選んでください」に当たり、小さな角折りが断られるため。
    どちら側かを示す点なので、折りの形も記録される折線も変わらない。 */
 const sidePoint=[g[0]+(from[0]-g[0])*.6,g[1]+(from[1]-g[1])*.6];
 return{line,sidePoint,ratio,half:ratio>=.5-1e-9,faceId:f.faceId}}
/* ================= E1.5：折った紙でも、見えている外周辺をつかむ =================
   これまで外周辺をつかめたのは isFlat のときだけだった（outerSegments は「いまの座標」が
   もとの正方形のふちに乗っているかで見るので、折った紙では外れる）。
   ここは engine の rimEdges（**素材座標**で決まる、原本の再生だけから出るふち）を使うので、
   何手折ったあとでも効く。⚠既存の guidesOf／outerSegments／grab の規則は1文字も変えていない。

   決めごと（本人指示 2026-09-12）
   ①確定ずみの平らな状態だけ（候補=pending があるあいだはつかませない）
   ②いま画面に見えている区間だけ／③指にいちばん近い**表示上の線分**を選ぶ（測るのは画面px）
   ④同じ所に重なっているときは stackAt の**最上面に属する辺**だけを候補にする
   ⑤同じくらい近い辺が別の面にもあるなら**選ばない**（理由を返す）
   ⑥紙の内部辺・hinge・crease は候補にしない（rimEdges がそもそも外周辺しか返さない）
   ⑦素材では続いていても、いま**表示で離れている区間はまとめない**（区間は面ごと＝またがない） */
const TIE_PX=4,PROBE=[.01,.004,.0015];
/* その線分の「指にいちばん近い所」から、自分の面の内側へ少し入った点。重なりを数えるのはそこ。 */
function insideProbe(face,a,b,t){const n=inwardNormal(a,b,face.poly),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 for(const d of PROBE){const q=[p[0]+n[0]*d,p[1]+n[1]*d];if(E().strictlyInside(q,face.poly))return q}
 return null}
function pickRimEdge(state,screen,view){
 if(state.pending)return{edge:null,intent:null,reason:'候補を片づけてから、辺をつかんでください'};
 const eng=E(),faces=new Map(state.cache.faces.map(f=>[f.faceId,f]));
 const near=[];
 for(const e of eng.rimEdges(state)){const f=faces.get(e.faceId);if(!f)continue;
  const A=view.toScreen(e.seg[0]),B=view.toScreen(e.seg[1]);
  if(dist(A,B)<1)continue;/* 画面でつぶれている＝見えていない */
  const s=onSegment(screen,A,B),px=dist(screen,s.point);
  if(px>EDGE_PX)continue;
  near.push({...e,face:f,px,t:s.t,scr:[A,B]})}
 if(!near.length)return{edge:null,intent:null,reason:null};
 near.sort((x,y)=>x.px-y.px);
 /* 最上面に属する辺だけ。下に隠れている辺はつかめない。 */
 /* ⚠重なりを数える点は、線分の**端に寄せない**。端は角なので、内向きの法線で押し出すと隣の辺から
    外へ出てしまい「自分の面が見つからない」になる（区間の継ぎ目でこれを踏んだ）。 */
 const probeOf=e=>insideProbe(e.face,e.seg[0],e.seg[1],Math.min(.9,Math.max(.1,e.t)))
  ||insideProbe(e.face,e.seg[0],e.seg[1],.5);
 const top=near.filter(e=>{const q=probeOf(e);if(!q)return false;
  const st=eng.stackAt(state,q);return st.length>0&&st[0].faceId===e.faceId});
 if(!top.length)return{edge:null,intent:null,reason:'下に隠れている辺はつかめません'};
 const best=top[0];
 /* 同じくらいの近さで、別の面・別の紙片の辺が並んでいたら決めない。 */
 const rival=top.find(e=>e!==best&&e.px-best.px<TIE_PX&&e.faceId!==best.faceId);
 if(rival)return{edge:null,intent:null,
  reason:`辺が重なっていて、どれをつかんだか決まりません（${best.label}と${rival.label}）`};
 const st=eng.stackAt(state,probeOf(best));
 return{edge:{rimId:best.rimId,label:best.label,faceId:best.faceId,seg:[best.seg[0].slice(),best.seg[1].slice()],
   srcSeg:best.srcSeg,px:best.px,t:best.t,layer:best.layer,back:st.length?st[0].back:false,sheetId:best.sheetId},
  intent:eng.edgeIntent(state,best.faceId,best.rimId),reason:null}}
/* 角セッションの従来の入口（折り目相手）。中身は上の共通形。 */
const cornerEdgeToCreaseAim=(state,source,screen,view,snapped)=>cornerAimWith(state,source,screen,view,snapped,edgeToCreaseAim);
/* ================= 🦴📐 H2：つかんだ外周辺を「見えている背」へ合わせる（画面pxの判定）=================
   幾何と成立の判定は engine（`edgeToHingeOptions`）。ここがやるのは「どれを狙っているか」だけ。
   測るのは E2 と同じ＝**つかんだ所を180°反射した先と、いまの指の画面px距離**、26px入る／44px離れる。 */
function edgeToHingeAim(state,source,screen,view,snapped){
 const eng=E(),r=eng.edgeToHingeOptions(state,source.intent);
 if(!r.source)return{aim:null,hints:[],reason:r.reason};
 const good=r.options.filter(o=>o.ok);
 if(!good.length)return{aim:null,hints:[],reason:'この辺を合わせられる背がありません'};
 const s0=r.source.seg[0],s1=r.source.seg[1],t=source.grabT;
 const g=[s0[0]+(s1[0]-s0[0])*t,s0[1]+(s1[1]-s0[1])*t];
 const scored=good.map(o=>{const p=eng.reflect(g,o.axis[0],o.axis[1]);
   return{...o,grabPoint:g,grabTo:p,px:dist(screen,view.toScreen(p))}}).sort((a,b)=>a.px-b.px);
 /* 同じ幾何軸で、同じ背の（固定部分の）線分を指しているものは1件にまとめる。 */
 const uniq=[];for(const o of scored)
  if(!uniq.some(u=>sameAxis(u.axis,o.axis)&&sameSeg(u.target.fixedSeg,o.target.fixedSeg)))uniq.push(o);
 const hints=[];for(const o of uniq)
  if(!hints.some(h=>h.intervalId===o.target.intervalId))hints.push({intervalId:o.target.intervalId,seg:o.target.fixedSeg});
 let near=uniq.filter(o=>o.px-uniq[0].px<TIE_PX);
 const axes=[];for(const o of near)if(!axes.some(a=>sameAxis(a,o.axis)))axes.push(o.axis);
 if(axes.length>1)return{aim:null,hints,reason:'合わせる背を特定できません'};
 const best=near[0];
 if(best.px>(snapped?UNSNAP_PX:SNAP_PX)+1e-3)return{aim:null,hints,reason:null};
 return{aim:best,hints,reason:null}}
/* ================= 🪚 E3：つかんだ外周辺を、見えている別の外周辺へ（画面pxの判定）=================
   幾何と成立の判定は engine（`edgeToEdgeOptions`）。測るのは E2/H2 と同じ
   「つかんだ所を180°反射した先と、いまの指の画面px距離」、26px入る／44px離れる。 */
function edgeToEdgeAim(state,source,screen,view,snapped){
 const eng=E(),r=eng.edgeToEdgeOptions(state,source.intent);
 if(!r.source)return{aim:null,hints:[],reason:r.reason};
 const good=r.options.filter(o=>o.ok);
 if(!good.length)return{aim:null,hints:[],reason:'この辺を合わせられるふちがありません'};
 const s0=r.source.seg[0],s1=r.source.seg[1],t=source.grabT;
 const g=[s0[0]+(s1[0]-s0[0])*t,s0[1]+(s1[1]-s0[1])*t];
 const scored=good.map(o=>{const p=eng.reflect(g,o.axis[0],o.axis[1]);
   return{...o,grabPoint:g,grabTo:p,px:dist(screen,view.toScreen(p))}}).sort((a,b)=>a.px-b.px);
 const uniq=[];for(const o of scored)
  if(!uniq.some(u=>sameAxis(u.axis,o.axis)&&sameSeg(u.target.fixedSeg,o.target.fixedSeg)))uniq.push(o);
 const hints=[];for(const o of uniq)
  if(!hints.some(h=>h.edgeId===o.target.edgeId))hints.push({edgeId:o.target.edgeId,seg:o.target.fixedSeg});
 const near=uniq.filter(o=>o.px-uniq[0].px<TIE_PX);
 const axes=[];for(const o of near)if(!axes.some(a=>sameAxis(a,o.axis)))axes.push(o.axis);
 if(axes.length>1)return{aim:null,hints,reason:'合わせるふちを特定できません'};
 const best=near[0];
 if(best.px>(snapped?UNSNAP_PX:SNAP_PX)+1e-3)return{aim:null,hints,reason:null};
 return{aim:best,hints,reason:null}}
/* 辺を直接つかむセッション：折り目と背とふちを比べる。
   🚨**同じ幾何軸なら折り目を優先**（意味が1つに決まる線だから）。
   異なる軸が TIE_PX の中に並んだら**選ばない**。 */
/* 折り目と背が両方候補のときの決めごと（1つの名前にする）。
   ①**同じ幾何軸なら折り目**（意味が1つに決まる線だから）②別の軸が TIE_PX の中なら**選ばない**
   ③はっきり近い方があるならそれ。 */
/* 合わせ先の強さ（意味が1つに決まる順）：**折り目 > 折った背 > 紙のふち**。 */
const TARGET_RANK={crease:0,hinge:1,edge:2};
function preferTargetAim(cands){
 const list=(cands||[]).filter(Boolean).slice()
  .sort((a,b)=>a.px-b.px||TARGET_RANK[a.targetKind]-TARGET_RANK[b.targetKind]);
 if(!list.length)return{pick:null,reason:null};
 /* 同じ幾何軸なら、意味の強い相手に寄せる（同じ折りを二度数えない）。 */
 const best=list[0],same=list.filter(o=>sameAxis(o.axis,best.axis))
  .sort((a,b)=>TARGET_RANK[a.targetKind]-TARGET_RANK[b.targetKind]);
 const win=same[0];
 /* 別の軸が TIE_PX の中に残っていたら選ばない。 */
 if(list.some(o=>!sameAxis(o.axis,win.axis)&&Math.abs(o.px-win.px)<TIE_PX))
  return{pick:null,reason:'合わせ先を特定できません'};
 return{pick:win,reason:null}}
/* 折り目と背だけのときの入口（既存の契約をそのまま保つ）。 */
function preferCreaseOverHinge(c,h){
 const r=preferTargetAim([c&&{...c,targetKind:'crease'},h&&{...h,targetKind:'hinge'}]);
 return r.reason?'ambiguous':(r.pick?r.pick.targetKind:'none')}
function rimTargetAim(state,source,screen,view,snapped){
 const c=edgeToCreaseAim(state,source,screen,view,snapped);
 const h=edgeToHingeAim(state,source,screen,view,snapped);
 const g=edgeToEdgeAim(state,source,screen,view,snapped);
 const hints=[...(c.hints||[]).map(t=>({kind:'crease',intervalId:t.intervalId,seg:t.seg})),
              ...(h.hints||[]).map(t=>({kind:'hinge',intervalId:t.intervalId,seg:t.seg})),
              ...(g.hints||[]).map(t=>({kind:'edge',intervalId:t.edgeId,seg:t.seg}))];
 const amb=[c.reason,h.reason,g.reason].find(x=>x&&/特定できません/.test(x));
 if(amb)return{aim:null,hints,reason:amb};
 const C=c.aim?{...c.aim,targetKind:'crease'}:null,H=h.aim?{...h.aim,targetKind:'hinge'}:null,
       G=g.aim?{...g.aim,targetKind:'edge'}:null;
 const r=preferTargetAim([C,H,G]);
 if(r.reason)return{aim:null,hints,reason:r.reason};
 if(r.pick)return{aim:r.pick,hints,reason:null};
 /* ⚠「候補はあるが届いていない」（reason が null）を、もう一方の「1つも無い」で上書きしない。
    両方とも「無い」ときだけ理由を出す（さもなくば既存の「近づけてください」の案内が消える）。 */
 if(c.reason===null||h.reason===null||g.reason===null)return{aim:null,hints,reason:null};
 return{aim:null,hints,reason:c.reason||h.reason||g.reason||null}}
/* 角セッション：**折り目 > 背**の順（全体の順位は
   cross > end > edge-to-crease > edge-to-hinge > diagonal > line。最後の合成は画面側）。 */
function cornerTargetAim(state,source,screen,view,snapped){
 const c=cornerAimWith(state,source,screen,view,snapped,edgeToCreaseAim);
 if(c.reason)return{aim:null,hints:c.hints,reason:c.reason};/* あいまいはそのまま伝える */
 if(c.aim)return{aim:{...c.aim,targetKind:'crease'},hints:c.hints,reason:null};
 const h=cornerAimWith(state,source,screen,view,snapped,edgeToHingeAim);
 if(h.reason)return{aim:null,hints:[...c.hints,...h.hints],reason:h.reason};
 if(h.aim)return{aim:{...h.aim,targetKind:'hinge'},hints:[...c.hints,...h.hints],reason:null};
 const g=cornerAimWith(state,source,screen,view,snapped,edgeToEdgeAim);
 const hints=[...c.hints,...h.hints,...g.hints];
 if(g.reason)return{aim:null,hints,reason:g.reason};
 return{aim:g.aim?{...g.aim,targetKind:'edge'}:null,hints,reason:null}}
/* ================= 🦴 H1：画面で見えている「折った背」をつかむ（2026-09-13・本人指示） =================
   決めごと
   ①候補(pending)があるあいだ・プレビュー中はつかませない（新しい target を掴み直さない）
   ②測るのは**表示中の線分までの画面px**（`view.toScreen` だけ＝カメラ回転・ズームがそのまま効く）
   ③候補は engine の `hingeIntervals` の**見えている部分区間**だけ（覆われた背・結びが一致しない背は入らない）
   ④TIE_PX の中に**別の区間**が並んだら、理由をつけて選ばない
   ⑤返した intent は画面側で `Object.freeze` して凍結する＝ドラッグ中に再探索しない
   ⚠`hingeIntervals` は両側の重なりを読むので**軽くない**。呼ぶのは pointerdown の1回だけ（ホバーでは呼ばない）。 */
function pickVisibleHinge(state,screen,view){
 if(state.pending)return{hinge:null,intent:null,reason:'候補を片づけてから、折った背を選んでください'};
 const eng=E(),near=[];
 for(const h of eng.hingeIntervals(state)){
  if(!h.consistent||!h.visible)continue;
  for(const part of h.visibleParts){
   const A=view.toScreen(part.seg[0]),B=view.toScreen(part.seg[1]);
   if(dist(A,B)<1)continue;/* 画面でつぶれている＝見えていない */
   const o=onSegment(screen,A,B),px=dist(screen,o.point);
   if(px>EDGE_PX)continue;
   near.push({row:h,part,px,t:o.t})}}
 if(!near.length)return{hinge:null,intent:null,reason:null};
 /* 同じ近さなら**長い可視部分**を優先し、それも同じなら intervalId の順＝呼ぶたびに変わらない。 */
 near.sort((x,y)=>x.px-y.px||y.part.len-x.part.len||(x.row.intervalId<y.row.intervalId?-1:1));
 const best=near[0];
 const rival=near.find(v=>v!==best&&v.px-best.px<TIE_PX&&v.row.intervalId!==best.row.intervalId);
 if(rival)return{hinge:null,intent:null,
  reason:`折った背が重なっていて、どれを選んだか決まりません（${best.row.intervalId}と${rival.row.intervalId}）`};
 const r=best.row;
 return{hinge:{intervalId:r.intervalId,stepId:r.stepId,diagramStep:r.diagramStep,hingeId:r.hingeId,
   faceIds:r.faceIds.slice(),sides:r.sides,paperRoot:r.paperRoot,
   seg:[best.part.seg[0].slice(),best.part.seg[1].slice()],srcSeg:best.part.srcSeg,
   whole:[r.seg[0].slice(),r.seg[1].slice()],px:best.px,t:best.t,partial:best.part.len<r.len-1e-9},
  intent:eng.hingeIntent(state,{intervalId:r.intervalId,partSrcSeg:best.part.srcSeg}),reason:null}}
/* ================= E2：つかんだ外周辺を、同じ紙片の折り目へ合わせる（画面px の判定） =================
   軸の作り方と成立の判定は engine（edgeToCreaseOptions）。ここがやるのは「どれを狙っているか」だけ。
   ★測るのは**つかんだ所を180°反射した先と、いまの指の、画面px距離**＝カメラを回しても同じ感覚になる。
   入る26px／離れる44px は角・辺のスナップと同じつまみ。 */
const samePt=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
const sameSeg=(a,b)=>(samePt(a[0],b[0])&&samePt(a[1],b[1]))||(samePt(a[0],b[1])&&samePt(a[1],b[0]));
function sameAxis(a,b){const u=[a[1][0]-a[0][0],a[1][1]-a[0][1]],L=Math.hypot(u[0],u[1])||1;
 const d=p=>Math.abs((p[0]-a[0][0])*u[1]/L-(p[1]-a[0][1])*u[0]/L);
 return d(b[0])<1e-6&&d(b[1])<1e-6}
function edgeToCreaseAim(state,source,screen,view,snapped){
 const eng=E(),r=eng.edgeToCreaseOptions(state,source.intent);
 if(!r.source)return{aim:null,hints:[],reason:r.reason};
 const good=r.options.filter(o=>o.ok);
 if(!good.length)return{aim:null,hints:[],reason:'この辺を合わせられる折り目がありません'};
 /* つかんだ所（pointerdown で凍結した t）を、その軸で折り返した先。 */
 const s0=r.source.seg[0],s1=r.source.seg[1],t=source.grabT;
 const g=[s0[0]+(s1[0]-s0[0])*t,s0[1]+(s1[1]-s0[1])*t];
 const scored=good.map(o=>{const p=eng.reflect(g,o.axis[0],o.axis[1]);
   return{...o,grabPoint:g,grabTo:p,px:dist(screen,view.toScreen(p))}}).sort((a,b)=>a.px-b.px);
 /* ①同じ幾何軸で、同じ折り目の線分を指しているものは1件にまとめる（同じ折りを二度数えない）。 */
 const uniq=[];for(const o of scored)
  if(!uniq.some(u=>sameAxis(u.axis,o.axis)&&sameSeg(u.target.seg,o.target.seg)))uniq.push(o);
 const hints=[];for(const o of uniq)if(!hints.some(h=>h.intervalId===o.target.intervalId))hints.push(o.target);
 /* ②いちばん近いものから TIE_PX の中を見て、**同じ紙片の折り目を優先**する。 */
 let near=uniq.filter(o=>o.px-uniq[0].px<TIE_PX);
 if(near.some(o=>o.sameSheet))near=near.filter(o=>o.sameSheet);
 /* ③それでも別々の軸が残るなら、紙片が違っても決めない＝並び順や層の順で黙って1件を選ばない。 */
 const axes=[];for(const o of near)if(!axes.some(a=>sameAxis(a,o.axis)))axes.push(o.axis);
 if(axes.length>1)return{aim:null,hints,reason:'合わせる折り目を特定できません'};
 const best=near[0];
 /* ⚠つまみの比べ方は「ぴったり26px」を落とさない。つかんだ所の t は画面のピクセルから出すので、
    反射した先の投影が 1e-3px ほどずれる（実測1.5e-6px）。見た目に意味のない差で境目を割らない。 */
 if(best.px>(snapped?UNSNAP_PX:SNAP_PX)+1e-3)return{aim:null,hints,reason:null};
 return{aim:best,hints,reason:null}}
/* ================= 🖊 折り目の自由入力（crease だけ・2026-09-12・本人指示） =================
   任意の2点で折り目を引く。決めごと
   ①作るのは op:'crease' だけ＝紙は 0° のまま動かさない（この道から fold へは行かない）
   ②2点は**線の向きだけ**を決める。折り目は紙片のふちからふちまで通る（split は無限直線＝実物の折り目と同じ）
   ③吸着先は既存の `guidesOf` ただ1本＋**紙の角**。角折りの「隣の角へは吸いつかない」は角折り専用のまま
     （あちらは `foldTarget` で rimCorners を弾く。ここはそれを1文字も触らず、別の候補づくりを持つ）
   ④movingSidePoint は画面で選ばせない＝engine の `creaseSidePoint` が決定論的に作り、作れなければ提案しない
   ⑤引きはじめられるのは**紙の上**だけ（紙の外＝これまでどおり視点が回る）。角へは 26px の吸着で届く */
const linePointRank={cross:0,corner:1,end:2,line:3};
/* 紙片の面の頂点＝「紙の角」。折り目や別の面との継ぎ目でできた角も入る（素材で繋がった紙片ひとつ分だけ）。 */
function sheetVertices(sheet){const m=new Map();
 for(const f of sheet)for(const p of f.poly){const k=key(p);if(!m.has(k))m.set(k,[p[0],p[1]])}
 return[...m.values()]}
/* 折り目の端の2点を決める吸着。交点 > 紙の角 > 折り目の端 > 線上、同じ種類なら画面で近い方。
   26px入る／44px離れる＝角・辺と同じつまみ。 */
function linePointAim(corners,guides,screen,paper,view,wasSnapped){
 const R=wasSnapped?UNSNAP_PX:SNAP_PX,list=[];
 for(const q of corners)list.push({point:q,type:'corner',on:'corner'});
 for(const t of guidePoints(guides,screen,view))list.push(t);
 let best=null;
 /* ⚠つまみの比べ方に 1e-3px の余裕を入れる（E2 と同じ理由）。紙の角は斜めにあるので、
    「ぴったり26px」が hypot の丸めで 26.000000000000004 になると、見た目に意味のない差で境目が割れる。 */
 for(const t of list){const px=dist(view.toScreen(t.point),screen);
  if(px>R+1e-3)continue;
  if(!best||linePointRank[t.type]<linePointRank[best.type]
   ||(linePointRank[t.type]===linePointRank[best.type]&&px<best.px))best={...t,px}}
 if(best){const atEnd=guides.some(v=>v.kind==='crease'&&(dist(v.a,best.point)<=1e-9||dist(v.b,best.point)<=1e-9));
  return{point:best.point,snapped:true,snapKind:best.type,snapOn:best.on||null,snapAtCreaseEnd:atEnd}}
 return{point:[paper[0],paper[1]],snapped:false,snapKind:null,snapOn:null,snapAtCreaseEnd:false}}
/* その点が面にふれているか（内部でも、ふちの上でも）。⚠始点が角や辺に吸着すると境界の上に乗るので、
   「その点を含む面」は inside だけでは決まらない。 */
function touchesPoly(p,poly){if(E().inside(p,poly))return true;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
  if(dist(p,onSegment(p,a,b).point)<=1e-6)return true}
 return false}
const splitsFace=(f,line)=>{const q=E().split(f.poly,line[0],line[1]);
 return!!(q[0]&&q[1]&&area(q[0])>1e-9&&area(q[1])>1e-9)};
/* pointerdown：引きはじめの点を決めて凍結する。ガイドと紙の角もここで凍結＝ドラッグ中は作り直さない。 */
function freeCreaseStart(state,screen,paper,view){
 if(state.pending)return{point:null,reason:null};/* 候補があるあいだは引きはじめない（E1.5と同じ） */
 const st=E().stackAt(state,paper);
 if(!st.length)return{point:null,reason:null};/* 紙の上でない＝今までどおり視点が回る */
 const faceId=st[0].faceId,sheet=E().sheetOf(state,faceId),guides=guidesOf(state,sheet);
 const a=linePointAim(sheetVertices(sheet),guides,screen,paper,view,false);
 return{point:a.point,snapped:a.snapped,snapKind:a.snapKind,snapOn:a.snapOn,snapAtCreaseEnd:a.snapAtCreaseEnd,
  faceId,guides,corners:sheetVertices(sheet),reason:null}}
/* 2点目から折り目の線を作る。線は紙片に切る（clipToSheet）＝ふちからふちまで。
   基準の面は「引きはじめた所にふれていて、その線が二つに分ける、いちばん上の面」。
   ⚠ここは凍結した source を読むだけ＝始点は動かさない。動くのは2点目だけ。 */
function freeCreaseLine(state,source,target){
 const eng=E(),sheet=eng.sheetOf(state,source.faceId);
 const d=[target[0]-source.point[0],target[1]-source.point[1]];
 if(Math.hypot(d[0],d[1])<.03)throw Error('もう少し離れた所まで引いてください');
 const line=clipToSheet(sheet,source.point,d);
 if(!line)throw Error('折線が紙の中に入りません');
 const here=sheet.filter(f=>touchesPoly(source.point,f.poly)&&splitsFace(f,line))
  .sort((a,b)=>b.layer-a.layer||(a.faceId<b.faceId?-1:1));
 if(!here.length)throw Error('この向きでは、引きはじめた所の紙を折り目が通りません');
 const f=here[0],sp=eng.creaseSidePoint(state,f.faceId,line[0],line[1]);
 if(!sp.point)throw Error(sp.reason);
 return{line,sidePoint:sp.point,faceId:f.faceId}}
/* ================= 🪜 角セッションから E2（辺→折り目）を使う（2026-09-12・本人指示）=================
   症状：角を折り目へ近づけると「角の点」だけが折り目に乗り、**角につながる辺は斜めに残る**。
   点の吸着(line)は角を1点に拘束するので、それ以上寄せられない（本人が画像で指摘）。
   直し方＝**E2 の幾何と関門をそのまま**角セッションから使う。新しい幾何は1つも作らない。
   ①pointerdown で「その角につながる、いま見えている外周辺」を**最大2本**、intent ごと凍結する
   ②ドラッグ中は辺ごとに既存の `edgeToCreaseAim` を回す。**つかんだ所 t は角そのもの**（0か1）
      ＝26px入る/44px離れるの判定が、自然に「軸で折り返した**角**の画面位置と指の距離」になる
   ③180°反射後に**辺ぜんぶが crease 区間に収まる**候補だけが残る（`checkEdgeToCrease` そのまま）
   ④同じ軸・同じ折り目の線分を指す**重複だけ統合**。別々の有効軸が TIE_PX の中に並んだら**選ばない**
   ⑤順位の合成（cross > end > edge-to-crease > diagonal > line）は**画面側**でやる＝`foldTarget` は1文字も変えない。 */
function cornerRimEdges(state,faceId,point){
 const out=[];
 for(const e of E().rimEdges(state)){
  if(e.faceId!==faceId)continue;
  const i=e.seg.findIndex(q=>dist(q,point)<=1e-6);/* 角は辺の端。真ん中へはつながらない。 */
  if(i<0)continue;
  let intent=null;try{intent=E().edgeIntent(state,e.faceId,e.rimId)}catch{continue}
  out.push({faceId:e.faceId,rimId:e.rimId,label:e.label,edgeId:e.edgeId,
   seg:[e.seg[0].slice(),e.seg[1].slice()],grabT:i,intent})}
 /* 面は必ず凸＝同じふちに2本は乗らないので、つながる外周辺は多くても2本。順は rimId で固定。 */
 return out.sort((a,b)=>a.rimId<b.rimId?-1:a.rimId>b.rimId?1:0).slice(0,2)}
/* 順位の決まりごと、1つの名前にする：**cross > end > edge-to-crease > diagonal > line**。
   交点・端へ「角を正確に置く」操作は従来どおり優先し、それ以外（対角・線上・自由な点）より
   辺全体を折り目へ寄せる方を取る。ここだけが判定の出どころ（画面はこれを呼ぶだけ）。 */
const preferPointSnap=t=>!!(t&&t.snapped&&(t.snapKind==='cross'||t.snapKind==='end'));
function cornerAimWith(state,source,screen,view,snapped,aimFn){
 const edges=(source&&source.edges)||[],hints=[],list=[];let ambiguous=null;
 for(const e of edges){
  const r=aimFn(state,{intent:e.intent,grabT:e.grabT},screen,view,snapped);
  for(const h of r.hints||[])if(!hints.some(x=>x.intervalId===h.intervalId))hints.push(h);
  /* その辺の中ですでにあいまいなら、そのまま伝える（黄を黄でないものへ勝手に寄せない）。 */
  if(r.reason&&/特定できません/.test(r.reason)){ambiguous=r.reason;continue}
  if(r.aim)list.push({...r.aim,edge:e})}
 if(ambiguous)return{aim:null,hints,reason:ambiguous};
 if(!list.length)return{aim:null,hints,reason:null};
 list.sort((a,b)=>a.px-b.px);
 const uniq=[];for(const o of list)
  if(!uniq.some(u=>sameAxis(u.axis,o.axis)&&sameSeg(u.target.seg,o.target.seg)))uniq.push(o);
 if(uniq.length>1&&uniq[1].px-uniq[0].px<TIE_PX)
  return{aim:null,hints,reason:'合わせる辺を特定できません'};
 return{aim:uniq[0],hints,reason:null}}
return{grab,pickRimEdge,pickVisibleHinge,edgeToCreaseAim,edgeToHingeAim,edgeToEdgeAim,rimTargetAim,preferCreaseOverHinge,preferTargetAim,cornerTargetAim,cornerAimWith,cornerRimEdges,cornerEdgeToCreaseAim,preferPointSnap,freeCreaseStart,freeCreaseLine,linePointAim,sheetVertices,sameAxis,sameSeg,aimCorner,edgeProgress,edgeTarget,movedEnough,creaseForCorners,creaseForEdge,diagonalOf,diagonalsOf,outlineCorners,foldTarget,guidePoints,segCross,corners,clip,clipToPoly,clipToSheet,movingArea,area,isFlat,outerSegments,guidesOf,mergeGuides,parallelGuides,rimCorners,onGuideSeg,faceAtCorner,guidesAtCorner,
 CORNER_PX,EDGE_PX,TIE_PX,AIM_PX,HOLD_PX,HYST_PX,MIN_CARRY_PX,SNAP_PX,UNSNAP_PX,COMMIT,SAME};
})();
