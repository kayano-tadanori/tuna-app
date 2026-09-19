'use strict';const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');vm.runInThisContext(fs.readFileSync(path.join(__dirname,'freefold_engine.js'),'utf8'));vm.runInThisContext(fs.readFileSync(path.join(__dirname,'freefold_snap.js'),'utf8'));const C0=x=>JSON.parse(JSON.stringify(x));const E=FreeFoldEngine,N=FreeFoldSnap,ref=s=>s.pending.candidates,rd=p=>p.map(v=>Math.round(v*1e9)/1e9+0);
function commit(s,a,b,side,kind='V'){E.propose(s,a,b);s.pending.kind=kind;E.setSide(s,side);E.select(s,ref(s));return E.confirm(s)}
const s=E.create();assert.equal(s.recipe.steps.length,0);assert.equal(s.cache.faces.length,1);const first=commit(s,[[.5,-1],[.5,1]][0],[[.5,-1],[.5,1]][1],[.8,0]);assert.equal(s.recipe.steps.length,1);assert.equal(first.faces.length,2);assert.equal(first.hinges.length,1);assert.equal(s.revision,1);
/* ⚠2手目は「ヒンジの線をまたがない」折りでなければならない。以前ここは y=0 で左半分ぜんぶを折っていたが、
   それは1手目のヒンジ(x=.5)を動く側に丸ごと含む＝実物では紙が破れる手だった（実測 39/12640点・最大1.975）。
   結びの不変条件を入れたので、左上の角だけを折る手に取りかえた。 */
const canonical=JSON.stringify(s.recipe);E.propose(s,[-1,.4],[-.4,1]);assert.equal(s.pending.reference.faceId,'paper/s1.keep');assert.deepEqual(s.pending.line,[[-1,.4],[-.4,1]]);E.setSide(s,[-.9,.9]);E.select(s,ref(s));assert.equal(E.preview(s,90).move.some(p=>Math.abs(p[1])>.3),true);E.cancel(s);assert.equal(JSON.stringify(s.recipe),canonical);assert.equal(s.revision,1);
const second=commit(s,[-1,.4],[-.4,1],[-.9,.9],'M');assert.equal(s.recipe.steps.length,2);assert.equal(second.faces.length,3);assert.equal(second.hinges.length,2);assert.equal(s.recipe.steps[1].reference.faceId,'paper/s1.keep');assert.deepEqual(s.recipe.steps[1].targets,[{faceId:'paper/s1.keep',layerPath:[{stepId:'s1',side:'keep'}]}]);assert.equal(E.verifiedRecipe(s).steps.length,2);const twoHash=s.cache.hash;
assert.equal(s.cacheRevision,s.revision);
/* B2c：3手目以降が入れられるようになった。残るのは原本(v1)の100手上限だけ。 */
E.propose(s,[-.9,-.5],[-.2,-.5]);assert.equal(s.pending.revision,s.revision,'3手目が提案できない');E.cancel(s);
const capped={...s,recipe:{...s.recipe,steps:Array.from({length:E.MAX_STEPS},()=>s.recipe.steps[0])}};
assert.throws(()=>E.propose(capped,[-.9,-.5],[-.2,-.5]),/100手/,'100手の上限が効いていない');
E.undo(s);assert.equal(s.recipe.steps.length,1);assert.equal(s.cache.faces.length,2);assert.equal(s.revision,3);commit(s,[-1,.4],[-.4,1],[-.9,.9],'M');assert.equal(s.cache.hash,twoHash);
const tampered=s.cache.hash;s.cache.hash='bad';assert.throws(()=>E.verifiedRecipe(s),/一致しない/);s.cache.hash=tampered;
const ov=E.create();commit(ov,[.5,-1],[.5,1],[.8,0]);const overlap=E.hitFaces(ov,[.25,-.5]);assert.equal(overlap.length>1,true);assert.throws(()=>E.propose(ov,[.1,-.5],[.4,-.5]),/重なった面/);assert.throws(()=>E.propose(E.create(),[0,0],[.001,0]),/短すぎ/);assert.throws(()=>E.propose(E.create(),[0,-1],[0,1],{operation:'squash'}),/つぶし折り/);
const edge=E.create();E.proposeEdgePair(edge,'right','left');assert.deepEqual(edge.pending.displayLine,[[0,-1],[0,1]]);assert.throws(()=>E.proposeEdgePair(s,'top','bottom'),/B2/);assert.throws(()=>E.proposeEdgePair(E.create(),'right','top'),/平行でない/);
/* 連続プレビューは表示だけ。recipeは1歩も動かない。 */
const cont=E.create();E.propose(cont,[0,-1],[0,1]);E.setSide(cont,[.5,0]);const h=a=>Math.max(...E.preview(cont,a).move.map(p=>Math.abs(p[1]))),mnx=a=>Math.min(...E.preview(cont,a).move.map(p=>p[0]));
assert.equal(h(0)<1e-9,true);assert.equal(h(37.5)>.1,true);assert.equal(h(90)>h(45),true);assert.equal(h(45)>h(20),true);assert.equal(h(135)<h(90),true);assert.equal(h(180)<1e-9,true);assert.equal(mnx(135)<mnx(45)-.5,true);
assert.throws(()=>E.preview(cont,-1),/0°〜180°/);assert.throws(()=>E.preview(cont,181),/0°〜180°/);assert.throws(()=>E.preview(cont,'90'),/0°〜180°/);assert.throws(()=>E.preview(cont,NaN),/0°〜180°/);assert.equal(cont.recipe.steps.length,0);
/* つかんで運ぶ入力層。折線はここで逆算し、原本はエンジンだけが書く。 */
const V={toScreen:p=>[p[0]*240,-p[1]*240]},S=p=>V.toScreen(p);/* つかむ判定は画面のピクセル。ここでは1単位=240px。 */
const sn=E.create(),gc=N.grab(sn,S([.98,-.97]),V);assert.equal(gc.type,'corner');assert.deepEqual(gc.point,[1,-1]);assert.equal(N.grab(sn,S([1.9,1.9]),V),null);
const g1=N.grab(sn,S([1,-1]),V);assert.equal(g1.type,'corner');assert.equal(g1.targets.length,3);
const aimed=N.aimCorner(g1,S([0,-1]),null,V);assert.deepEqual(aimed.target,[-1,-1]);assert.equal(Math.abs(aimed.progress-.5)<1e-9,true);
const diag=N.aimCorner(g1,S([0,0]),null,V);assert.deepEqual(diag.target,[-1,1]);assert.equal(Math.abs(diag.progress-.5)<1e-9,true);assert.equal(N.aimCorner(g1,S([.2,.6]),null,V),null);
/* 角の近くは常に角。辺の上に乗っていても角が勝つ。 */
assert.equal(N.grab(sn,S([1,-.93]),V).type,'corner');assert.equal(N.grab(sn,S([1,-.5]),V).type,'edge');
/* 画面で角のすぐ上なら、紙の座標では遠くても角。傾いた紙で「角のつもりが辺」になっていた所。 */
const Vtilt={toScreen:p=>[p[0]*240,-p[1]*60]},tilted=N.grab(sn,[240,40],Vtilt);
assert.equal(tilted.type,'corner');assert.deepEqual(tilted.point,[1,-1]);assert.equal(Math.hypot(240/240-1,40/60+1)>.22,true);
/* 種類は混ざらない。角のつかみに辺の計算は通らないし、その逆も通らない。 */
assert.throws(()=>N.edgeProgress(g1,[0,0]),/辺をつかんでいません/);assert.throws(()=>N.aimCorner(N.grab(sn,S([1,-.5]),V),S([0,0]),null,V),/角をつかんでいません/);
/* 少ししか動いていないうちは、まだ何も狙わない。 */
assert.equal(N.aimCorner(g1,S([.95,-.98]),null,V),null);assert.equal(N.aimCorner(g1,S([.95,-.98]),aimed.key,V),null);assert.equal(N.movedEnough(S([1,-1]),S([.95,-.98])),false);
/* ヒステリシス：いちど狙った先は、少し動いただけでは乗りかえない。 */
assert.deepEqual(N.aimCorner(g1,S([.5,-.75]),null,V).target,[-1,1]);assert.deepEqual(N.aimCorner(g1,S([.5,-.75]),aimed.key,V).target,[-1,-1]);
/* はっきり別の方向へ運べば乗りかえる。 */
assert.deepEqual(N.aimCorner(g1,S([0,0]),aimed.key,V).target,[-1,1]);
const cr=N.creaseForCorners(sn,[1,-1],[-1,-1]);assert.deepEqual(cr.line.map(rd),[[0,1],[0,-1]]);assert.deepEqual(rd(cr.sidePoint),[.8,-.6]);/* 重心(.5,0)より角寄り */
E.propose(sn,cr.line[0],cr.line[1]);E.setSide(sn,cr.sidePoint);E.select(sn,ref(sn));E.confirm(sn);assert.equal(sn.recipe.steps.length,1);assert.deepEqual(sn.recipe.steps[0].line.map(rd),[[0,1],[0,-1]]);assert.deepEqual(rd(sn.recipe.steps[0].movingSidePoint),[.8,-.6]);assert.equal(sn.cache.faces.length,2);
const cr2=N.creaseForCorners(sn,[-1,-1],[0,-1]);assert.throws(()=>E.propose(sn,cr2.line[0],cr2.line[1]),/重なった面/);assert.equal(sn.recipe.steps.length,1);
/* 角を折るときの吸い付き先＝対角と、同じ紙片のガイド（外周辺・折り目）。隣の角そのものには吸いつかない。
   対角は rank で線上に勝つので、44px の中にいるかぎりガイドに取られない。入るのは26px、離れるのは44px。 */
const dg=E.create(),dgrab=N.grab(dg,S([1,-1]),V);assert.deepEqual(N.diagonalOf(dg,dgrab),[-1,1]);
const near26=[S([-1,1])[0]+18,S([-1,1])[1]+12];/* 約22px */
assert.deepEqual(N.foldTarget(dg,dgrab,near26,[0,0],V,false),{target:[-1,1],snapped:true,snapKind:'diagonal',snapOn:'corner',snapAtCreaseEnd:false});
const near35=[S([-1,1])[0]+30,S([-1,1])[1]+18];/* 対角から約35px＝入る境界の外、離す境界の内 */
assert.notEqual(N.foldTarget(dg,dgrab,near35,[.1,.2],V,false).snapKind,'diagonal');
assert.equal(N.foldTarget(dg,dgrab,near35,[.1,.2],V,true).snapKind,'diagonal');
const far=[S([-1,1])[0]+60,S([-1,1])[1]+40];assert.notEqual(N.foldTarget(dg,dgrab,far,[.1,.2],V,true).snapKind,'diagonal');
/* 隣の角のそばでも自由点のまま。右辺は「つかんだ角(1,-1)が乗っている足元のふち」なので線上候補が出ない。 */
assert.deepEqual(N.foldTarget(dg,dgrab,S([1,.97]),[1,.97],V,false),{target:[1,.97],snapped:false,snapKind:null,snapOn:null,snapAtCreaseEnd:false});
const folded2=E.create();E.proposeEdgePair(folded2,'right','left');E.select(folded2,ref(folded2));E.confirm(folded2);
/* 🔺2026-09-14：折ったあとも、いまの紙の外形の角から候補を作る（原点対称は使わない）。半分に折った長方形で (-1,-1) の相手は
   足元のふち（下辺・左辺）に乗っていない角 (0,1) だけ。 */
assert.deepEqual(N.diagonalOf(folded2,{type:'corner',point:[-1,-1],targets:[[-1,1],[0,-1],[0,1]]}),[0,1]);
/* 部分的な辺折り：折線はつかんだ辺と「指を通る平行線」の中間、動くのは端の帯だけ。 */
const es0=E.create(),eg0=N.grab(es0,S([1,.3]),V),ce=N.creaseForEdge(es0,eg0,[0,0]);
assert.deepEqual(ce.line.map(rd),[[.5,-1],[.5,1]]);assert.deepEqual(rd(ce.sidePoint),[.9,0]);/* 重心(.75,0)よりつかんだ辺寄り6割 */
assert.equal(Math.abs(ce.ratio-.25)<1e-9,true);assert.deepEqual(ce.targetLine.map(rd),[[0,-1],[0,1]]);assert.equal(ce.distance,1);
assert.equal(Math.abs(ce.progress-.5)<1e-9,true);
assert.equal(Math.abs(N.creaseForEdge(es0,eg0,[-.5,0]).ratio-.375)<1e-9,true);/* 遠くへ運ぶほど帯は太る */
assert.throws(()=>N.creaseForEdge(es0,eg0,[1.2,0]),/紙の内側/);/* 紙の外は折らない */
assert.throws(()=>N.creaseForEdge(es0,eg0,[-1.2,0]),/紙の内側/);/* 対辺より向こうも折らない */
assert.throws(()=>N.creaseForEdge(es0,dgrab,[0,0]),/辺をつかんでいません/);
/* 辺の吸いつき：平行な行き先線（対辺・折り目）に近づいたら、そこへ固定。入る26px、離れる44px。 */
const esnap=E.create(),eg2=N.grab(esnap,S([1,.3]),V),et=q=>N.edgeTarget(eg2,S(q),q,V,false),eth=q=>N.edgeTarget(eg2,S(q),q,V,true);
assert.equal(et([-.98,0]).snapped,true);assert.equal(et([-.85,0]).snapped,false);
assert.equal(eth([-.85,0]).snapped,true);assert.equal(eth([-.8,0]).snapped,false);
assert.equal(et([-.98,0]).snapKind,'edge');assert.equal(et([-.98,0]).label,'左辺');
assert.deepEqual(N.creaseForEdge(esnap,eg2,et([-.98,0]).target).line.map(rd),[[0,-1],[0,1]]);/* 吸いついたら折線は中線 */
assert.throws(()=>N.edgeTarget(dgrab,S([0,0]),[0,0],V,false),/辺をつかんでいません/);
const eg=N.grab(E.create(),S([1,.3]),V);assert.equal(eg.type,'edge');assert.equal(eg.edge.id,'right');assert.equal(eg.opposite.id,'left');assert.equal(eg.span,2);
assert.equal(Math.abs(N.edgeProgress(eg,[.4,.3])-.3)<1e-9,true);assert.equal(N.edgeProgress(eg,[-1.5,0]),1);assert.equal(N.edgeProgress(eg,[1.5,0]),0);
const folded=E.create();E.proposeEdgePair(folded,'right','left');E.select(folded,ref(folded));E.confirm(folded);assert.equal(N.grab(folded,S([1,.3]),V),null);const gf=N.grab(folded,S([-.98,.99]),V);assert.equal(gf.type,'corner');assert.deepEqual(gf.point,[-1,1]);
/* ★確認1：折り目のない初期紙での対辺半分折りは、新しい経路（つかんだ線分＋対象面＋平行な行き先線）でも
   従来の proposeEdgePair と同じ原本JSON＝折線・movingSidePoint・対象面が一致すること。 */
const legacy=E.create();E.proposeEdgePair(legacy,'right','left');E.select(legacy,ref(legacy));E.confirm(legacy);
const unified=E.create(),ug=N.grab(unified,S([1,.3]),V),ut=N.edgeTarget(ug,S([-.99,.3]),[-.99,.3],V,false);
assert.equal(ut.snapped,true);assert.equal(ug.faceId,'paper');
const ucr=N.creaseForEdge(unified,ug,ut.target);
E.proposeOnFace(unified,ucr.line[0],ucr.line[1],ug.faceId);E.setSide(unified,ucr.sidePoint);E.select(unified,ref(unified));E.confirm(unified);
const step=n=>({line:n.recipe.steps[0].line.map(rd),side:rd(n.recipe.steps[0].movingSidePoint),face:n.recipe.steps[0].reference.faceId,targets:n.recipe.steps[0].targets});
assert.deepEqual(step(unified),step(legacy),'対辺半分折りの原本が従来と違う');
assert.deepEqual(unified.recipe.steps[0].line,[[0,-1],[0,1]]);assert.deepEqual(rd(unified.recipe.steps[0].movingSidePoint),[.8,0]);
assert.equal(unified.cache.hash,legacy.cache.hash,'対辺半分折りの再生結果が従来と違う');

/* ================= 手を組み立てる小道具（UIと同じ道を通す） ================= */
function creaseAt(a,b,side){const st=E.create();E.propose(st,a,b);E.setSide(st,side);E.select(st,ref(st));E.confirm(st,{op:'crease'});return st}
function foldCorner(st,from,target){const g=N.creaseForCorners(st,from,target,{requireInside:true});
 E.proposeOnFace(st,g.line[0],g.line[1],g.faceId);E.setSide(st,g.sidePoint);E.select(st,ref(st));E.confirm(st);return g}
function foldEdge(st,grabAt,to){const gb=N.grab(st,S(grabAt),V);if(!gb||gb.type!=='edge')throw Error('辺をつかめていません');
 const t=N.edgeTarget(gb,S(to),to,V,false),g=N.creaseForEdge(st,gb,t.target);
 E.proposeOnFace(st,g.line[0],g.line[1],gb.faceId);E.setSide(st,g.sidePoint);E.select(st,ref(st));E.confirm(st);return{grab:gb,cr:g}}
const ap=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[4],m[2]*p[0]+m[3]*p[1]+m[5]];
const iv=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
/* ★A2 「紙は破れない」の機械化。折りはぜんぶ「うつし（等長）」なので、もとの紙で距離 h の2点は、
   折ったあとも距離 h 以下でなければならない。破れると、そこだけ一気に離れる。
   面の素材座標（xf の逆）で格子を掃くので、面の持ち方に依らず、外から見える性質だけで測る。 */
function discontinuity(state,grid=80){const F=state.cache.faces.map(f=>({xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))}));
 const cur=u=>{for(const f of F)if(E.inside(u,f.src))return ap(f.xf,u);return null};
 const h=2/grid;let bad=0,tot=0,worst=0;
 for(let i=0;i<grid;i++)for(let j=0;j<grid;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
  for(const q of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const A=cur(p),B=cur(q);if(!A||!B)continue;tot++;
   const d=Math.hypot(A[0]-B[0],A[1]-B[1]);if(d>h*1.0001+1e-9){bad++;worst=Math.max(worst,d)}}}
 return{bad,tot,worst,h}}

/* ================= A 折り目にそって紙が破れない ================= */
/* A1 画像の再現：折り目 y=-0.5 →角(1,1)を(-0.8,-0.45)へ。折線が折り目をまたぐので、両側が一緒に動く。 */
const rep=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
const rcr=N.creaseForCorners(rep,[1,1],[-.8,-.45],{requireInside:true});
E.proposeOnFace(rep,rcr.line[0],rcr.line[1],rcr.faceId);E.setSide(rep,rcr.sidePoint);
assert.deepEqual(rep.pending.candidates.map(c=>c.faceId).slice().sort(),['paper/s1.cut','paper/s1.keep'],'A1 折り目の両側が対象になっていない');
E.select(rep,ref(rep));E.confirm(rep);
assert.deepEqual(rep.recipe.steps[1].targets.map(t=>t.faceId).slice().sort(),['paper/s1.cut','paper/s1.keep'],'A1 原本の targets が片側だけ');
const dRep=discontinuity(rep);
assert.equal(dRep.tot>4000,true,'A1 測った点が少なすぎる: '+dRep.tot);
assert.equal(dRep.bad,0,`A1 再現ケースで紙が破れている：${dRep.bad}/${dRep.tot}点 最大 ${dRep.worst}`);
/* 折り目の向こう側も、動く側のぶんだけ本当に動いている（層が上がった面が2枚ある）。 */
assert.equal(rep.cache.faces.filter(f=>f.layer>0).length,2,'A1 折り目の向こう側が動いていない');
/* ⚠本番の積み直しでは、折り目でつながった2枚は別の層番号（1と2）になる。だから ===1 では数えない。 */
/* A3 折線と折り目の関係：交差／端点を通る／平行で不一致。どれでも破れない。 */
const END_TARGET=[1-Math.sqrt(3)/4,-.25];
for(const[name,act,want]of[['交差',st=>foldCorner(st,[1,1],[-.8,-.45]),2],
  /* 折り目の端(1,-0.5)をちょうど通る折線＝その点から角(1,-1)までと等距離の行き先を選ぶ。 */
  ['端点を通る',st=>foldCorner(st,[1,-1],END_TARGET),1],
  ['平行で不一致',st=>foldEdge(st,[.3,-1],[.3,.5]),2]]){
 const st=creaseAt([-1,-.5],[1,-.5],[0,-.9]);act(st);
 const d=discontinuity(st);assert.equal(d.bad,0,`A3 ${name}：紙が破れた ${d.bad}/${d.tot}点 最大 ${d.worst}`);
 assert.equal(st.recipe.steps[1].targets.length,want,`A3 ${name}：targets の数が違う`)}
/* A4 辺折りでも折り目をまたげる。折り目は行き先の目印にはなるが、壁ではない。 */
const a4=creaseAt([-1,-.5],[1,-.5],[0,-.9]),a4g=N.grab(a4,S([.3,-1]),V);
assert.equal(a4g.type,'edge');assert.equal(a4g.faceId,'paper/s1.cut','A4 つかんだ線分の面が対象になっていない');
assert.equal(Math.abs(a4g.span-2)<1e-9,true,'A4 折り目で運べる幅が止められている: '+a4g.span);
assert.deepEqual(a4g.targets.map(t=>t.kind),['crease','edge'],'A4 行き先の候補が折り目と対辺の2つでない');
assert.equal(Math.abs(a4g.targets[0].d-.5)<1e-9,true);assert.equal(Math.abs(a4g.targets[1].d-2)<1e-9,true);
const a4cr=N.creaseForEdge(a4,a4g,[.3,.5]);/* 折り目の向こうまで運ぶ */
assert.deepEqual(a4cr.line.map(rd),[[-1,-.25],[1,-.25]],'A4 折線が指の線との中間になっていない');
assert.equal(Math.abs(a4cr.ratio-.375)<1e-9,true,'A4 動く割合が紙片ぜんぶで数えられていない: '+a4cr.ratio);
E.proposeOnFace(a4,a4cr.line[0],a4cr.line[1],a4g.faceId);E.setSide(a4,a4cr.sidePoint);
assert.deepEqual(a4.pending.candidates.map(c=>c.faceId).slice().sort(),['paper/s1.cut','paper/s1.keep'],'A4 折り目の両側が対象になっていない');
E.select(a4,ref(a4));E.confirm(a4);
const dA4=discontinuity(a4);assert.equal(dA4.bad,0,`A4 紙が破れた ${dA4.bad}/${dA4.tot}点 最大 ${dA4.worst}`);

/* ================= B 折り目そのものを折線にしたときだけ、両側が別々に回る ================= */
const bst=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
const upBefore=JSON.stringify(bst.cache.faces.find(f=>f.faceId==='paper/s1.keep'));
foldEdge(bst,[.3,-1],[.3,0]);/* 下辺を y=0 まで運ぶ＝折線は中間の y=-0.5＝折り目そのもの */
assert.deepEqual(bst.recipe.steps[1].line.map(rd).slice().sort(),[[-1,-.5],[1,-.5]].map(rd).slice().sort(),'B1 折線が折り目と一致していない');
assert.deepEqual(bst.recipe.steps[1].targets.map(t=>t.faceId),['paper/s1.cut'],'B1 折り目そのものなのに両側が対象になった');
assert.equal(JSON.stringify(bst.cache.faces.find(f=>f.faceId==='paper/s1.keep')),upBefore,'B1 反対側の面が動いた');
/* D2 割れなかった対象面は faceId も layerPath も変わらない（origami_recipe.py の assign_faces と同じ） */
assert.equal(bst.cache.faces.some(f=>f.faceId==='paper/s1.cut'),true,'D2 丸ごと動いた面の faceId が変わった');
assert.equal(bst.cache.faces.length,2,'B1 割れていないのに面が増えた');
const dB=discontinuity(bst);assert.equal(dB.bad,0,`B1 紙が破れた ${dB.bad}/${dB.tot}点`);
/* 折り目だった所は、折ったあとはヒンジ＝そこで紙片は切れる（曲がっているので同じ平面ではない） */
assert.deepEqual(bst.cache.bonds.map(b=>b.kind),['hinge'],'B1 折ったのに折り目の結びのままになっている');
assert.equal(E.sheetOf(bst,'paper/s1.cut').length,1,'B1 折ったのに同じ紙片のまま');
/* B2 折り目なしで同じ線を折った時と、出来上がり（層・変換・形）が同じ */
const plain=E.create();foldEdge(plain,[.3,-1],[.3,0]);
const shape=st=>st.cache.faces.map(f=>JSON.stringify({l:f.layer,xf:f.xf.map(v=>Math.round(v*1e9)/1e9),
 poly:f.poly.map(p=>p.map(v=>Math.round(v*1e9)/1e9)).slice().sort()})).slice().sort();
assert.deepEqual(shape(bst),shape(plain),'B2 折り目ありと無しで出来上がりが違う');
/* B3 山折りでも同じ＝片側だけが、逆向きに回る */
const bm=creaseAt([-1,-.5],[1,-.5],[0,-.9]),bmg=N.grab(bm,S([.3,-1]),V);
const bmt=N.edgeTarget(bmg,S([.3,0]),[.3,0],V,false),bmc=N.creaseForEdge(bm,bmg,bmt.target);
E.proposeOnFace(bm,bmc.line[0],bmc.line[1],bmg.faceId);bm.pending.kind='M';E.setSide(bm,bmc.sidePoint);E.select(bm,ref(bm));E.confirm(bm);
assert.deepEqual(bm.recipe.steps[1].targets.map(t=>t.faceId),['paper/s1.cut'],'B3 山折りだと両側が対象になった');
assert.equal(bm.cache.faces.find(f=>f.faceId==='paper/s1.cut').layer,-1,'B3 山折りで層が下がっていない');
assert.equal(discontinuity(bm).bad,0,'B3 山折りで紙が破れた');

/* ================= C 紙片(sheet)の定義 ================= */
const c1=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
assert.equal(E.sheetOf(c1,'paper/s1.keep').length,2,'C1 折り目だけの紙が1つの紙片になっていない');
assert.equal(c1.cache.bonds.length,1,'C1 隣接が記録されていない');
assert.equal(c1.cache.bonds[0].kind,'crease');
assert.deepEqual(c1.cache.bonds[0].seg.map(rd).slice().sort(),[[-1,-.5],[1,-.5]].map(rd).slice().sort(),'C1 隣接の線が折り目そのものでない');
assert.equal(N.isFlat(c1),true);
/* C2 折ったら別の紙片。ヒンジは紙片をつながない＝重なり(B2)の穴を開けていない */
const c2=E.create();foldCorner(c2,[1,-1],[0,0]);
assert.equal(c2.cache.bonds.length,1);assert.equal(c2.cache.bonds[0].kind,'hinge','C2 折りの境目が折り目扱いになっている');
for(const f of c2.cache.faces)assert.equal(E.sheetOf(c2,f.faceId).length,1,'C2 ヒンジをまたいで紙片が繋がった');
/* C3 層経路では別なのに素材ではひと続き、という面どうしが同じ紙片になる（経路から機械的に出すと落ちる反例） */
const c3=creaseAt([-1,-.5],[1,-.5],[0,-.9]);foldCorner(c3,[1,-1],END_TARGET);
const flatIds=c3.cache.faces.filter(f=>f.layer===0).map(f=>f.faceId).slice().sort();
assert.deepEqual(flatIds,['paper/s1.cut/s2.keep','paper/s1.keep'],'C3 反例の形になっていない: '+flatIds);
assert.equal(E.sheetOf(c3,flatIds[0]).length,2,'C3 層経路が違う2枚が同じ紙片になっていない');
assert.equal(E.sheetOf(c3,flatIds[1]).length,2);
assert.equal(E.sheetOf(c3,'paper/s1.cut/s2.cut').length,1,'C3 折られた面まで紙片に入った');
/* C4 紙片ぜんぶの面積は、折り目を無視した紙の面積と同じ */
const sheetArea=st=>E.sheetOf(st,st.cache.faces.find(f=>f.layer===0).faceId).reduce((a,f)=>a+N.area(f.poly),0);
assert.equal(Math.abs(sheetArea(c1)-4)<1e-9,true,'C4 折り目つきの紙片の面積が紙ぜんぶでない');
/* C5 結び(bond)の不変条件。crease も hinge も「結びの線を両側の xf で写した所が一致する」。
   crease はさらに形を動かさない＝両側の xf が同じ。
   ⚠層の一致は条件にしない：本番の積み直しでは折り目でつながった2枚が別の層番号になる（2026-09-12）。 */
function bondInvariant(st,tag){const ap2=(m,q)=>[m[0]*q[0]+m[1]*q[1]+m[4],m[2]*q[0]+m[3]*q[1]+m[5]];
 for(const b of st.cache.bonds){
 const x=st.cache.faces.find(f=>f.faceId===b.faceIds[0]),y=st.cache.faces.find(f=>f.faceId===b.faceIds[1]);
 if(!x||!y)continue;
 for(const q of b.seg){const u=ap2(x.xf,q),v=ap2(y.xf,q);
  assert.equal(Math.hypot(u[0]-v[0],u[1]-v[1])<1e-7,true,`C5 ${tag} ${b.kind}の結びの線が両側で一致しない`)}
 if(b.kind==='crease')assert.deepEqual(x.xf.map(v=>Math.round(v*1e9)/1e9),y.xf.map(v=>Math.round(v*1e9)/1e9),`C5 ${tag} 折り目の両側で変換が違う`)}}
[['c1',c1],['c2',c2],['c3',c3],['rep',rep],['a4',a4],['bst',bst],['bm',bm]].forEach(v=>bondInvariant(v[1],v[0]));

/* ================= E 断るべきものは断り続ける ================= */
/* E1 重なった所は、折り目でつながっていても折れない（紙片の成長ですり抜けない） */
const e1=creaseAt([-1,-.5],[1,-.5],[0,-.9]);foldCorner(e1,[1,1],[-.8,-.45]);
const over=[];for(let i=0;i<400;i++){const p=[-1+2*((i%20)+.5)/20,-1+2*(Math.floor(i/20)+.5)/20];
 const h=E.hitFaces(e1,p);if(h.length>1&&new Set(h.map(v=>v.layer)).size>1)over.push(p)}
assert.equal(over.length>0,true,'E1 重なった所が見つからない（再現になっていない）');
/* 重なった2枚は、折り目でつながった紙片としては絶対に一つにならない＝B2の穴を開けていない。 */
const sheetKey=id=>[...E.sheetIds(e1.cache.bonds,id)].slice().sort().join('|');
const hitsOver=E.hitFaces(e1,over[0]);
assert.equal(hitsOver.length>1,true);
assert.notEqual(sheetKey(hitsOver[0].faceId),sheetKey(hitsOver[1].faceId),'E1 重なった2枚が同じ紙片になった');
/* 1手目の紙でも、重なった所の折りは今までどおり断る（紙片の成長ですり抜けない）。 */
const e1b=E.create();foldCorner(e1b,[1,-1],[0,0]);
const ov2=[];for(let i=0;i<400;i++){const p=[-1+2*((i%20)+.5)/20,-1+2*(Math.floor(i/20)+.5)/20];
 const h=E.hitFaces(e1b,p);if(h.length>1&&new Set(h.map(v=>v.layer)).size>1)ov2.push(p)}
assert.equal(ov2.length>0,true,'E1 1手目で重なった所が見つからない');
assert.throws(()=>E.propose(e1b,[ov2[0][0]-.15,ov2[0][1]],[ov2[0][0]+.15,ov2[0][1]]),/重なった面/,'E1 重なった所で折れてしまう');
/* E4 動く側の面を1枚だけ選ぶことはできない＝破れる選び方を断る */
const e4=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
const g4=N.creaseForCorners(e4,[1,1],[-.8,-.45],{requireInside:true});
E.proposeOnFace(e4,g4.line[0],g4.line[1],g4.faceId);E.setSide(e4,g4.sidePoint);
assert.equal(e4.pending.candidates.length,2);
assert.throws(()=>E.select(e4,[e4.pending.candidates[0]]),/全部選んで/,'E4 1枚だけ選べてしまう');
assert.throws(()=>E.confirm(e4),/未選択/);E.cancel(e4);
/* E5 別の紙片の面を targets に混ぜた原本は再生できない */
const badRecipe=C0(rep.recipe);badRecipe.steps[1].targets=[{faceId:'paper/s1.keep',layerPath:[]},{faceId:'paper',layerPath:[]}];
assert.throws(()=>E.replay(badRecipe),/対象面が見つかりません|別の紙片/,'E5 でたらめな targets が通った');

/* ============ H スナップ候補は「同じ紙片のガイド」から作る（2026-09-12 本人指示） ============ */
/* H0 共線のつなぎ直しは「同じ kind どうし」だけ。外周辺と折り目は、同じ直線の上で接していても1本にしない。 */
const hMerge=N.mergeGuides([
 {a:[-1,-1],b:[0,-1],kind:'edge',id:'bottom',label:'下辺'},
 {a:[0,-1],b:[1,-1],kind:'edge',id:'bottom',label:'下辺'},
 {a:[-1,1],b:[0,1],kind:'crease',id:'crease',label:'折り目'},
 {a:[0,1],b:[1,1],kind:'edge',id:'top',label:'上辺'}]);
assert.equal(hMerge.length,3,'H0 つないだ本数が違う: '+JSON.stringify(hMerge.map(g=>[g.kind,rd(g.a),rd(g.b)])));
const hBottom=hMerge.find(g=>g.kind==='edge'&&g.id==='bottom');
assert.deepEqual([rd(hBottom.a),rd(hBottom.b)].slice().sort(),[[-1,-1],[1,-1]].map(rd).slice().sort(),'H0 同じ kind の共線がつながっていない');
assert.equal(hMerge.filter(g=>Math.abs(g.a[1]-1)<1e-9&&Math.abs(g.b[1]-1)<1e-9).length,2,'H0 外周辺と折り目が1本に統合された');
/* すきまのある共線は埋めない。 */
assert.equal(N.mergeGuides([{a:[-1,-1],b:[-.5,-1],kind:'edge',id:'bottom',label:'下辺'},
 {a:[.5,-1],b:[1,-1],kind:'edge',id:'bottom',label:'下辺'}]).length,2,'H0 離れた共線までつないだ');

/* H1 つかんだ辺に垂直な折り目があると、反対の外周辺は「同じ距離の2本」に割れる。
   長い方だけ残す作りだと、短い方の上では吸いつかなくなっていた＝ここでつなぐ。 */
const h1=creaseAt([.3,-1],[.3,1],[.8,0]),h1g=N.grab(h1,S([-.5,-1]),V);
assert.equal(h1g&&h1g.type,'edge','H1 外周辺をつかめていない');
assert.equal(h1g.targets.length,1,'H1 反対の外周辺が1本につながっていない: '+JSON.stringify(h1g.targets.map(t=>[t.kind,t.d])));
assert.equal(h1g.targets[0].kind,'edge');assert.equal(Math.abs(h1g.targets[0].d-2)<1e-9,true);
assert.deepEqual([rd(h1g.targets[0].a),rd(h1g.targets[0].b)].slice().sort(),[[-1,1],[1,1]].map(rd).slice().sort(),'H1 行き先の線が紙片ぜんぶに伸びていない');
for(const x of[-.7,-.1,.5,.9]){const q=[x,.98],t=N.edgeTarget(h1g,S(q),q,V,false);
 assert.equal(t.snapped,true,`H1 反対の外周辺(x=${x})の上で吸いつかない`);
 assert.equal(t.snapKind,'edge');assert.equal(Math.abs(t.distance-2)<1e-9,true,`H1 x=${x} の行き先の距離が違う: `+t.distance)}
/* H2 つかんだ辺と平行な折り目：候補は「折り目」「反対の外周辺」の2本、近い順（距離が違うのでつながらない）。 */
const h2=creaseAt([-1,-.5],[1,-.5],[0,-.9]),h2g=N.grab(h2,S([.3,-1]),V);
assert.deepEqual(h2g.targets.map(t=>t.kind),['crease','edge'],'H2 候補が折り目と対辺の2本でない');
assert.deepEqual(h2g.targets.map(t=>Math.round(t.d*1e6)/1e6),[.5,2],'H2 候補の距離が違う');
assert.deepEqual([rd(h2g.targets[1].a),rd(h2g.targets[1].b)].slice().sort(),[[-1,1],[1,1]].map(rd).slice().sort(),'H2 反対の外周辺が紙片ぜんぶに伸びていない');

/* ★H3 折り目をまたいで反対の外周辺へ辺合わせ。紙は破れず、必要な面が一緒に動く。 */
const h3=creaseAt([.3,-1],[.3,1],[.8,0]),h3g=N.grab(h3,S([-.5,-1]),V);
const h3t=N.edgeTarget(h3g,S([.9,.98]),[.9,.98],V,false);
assert.equal(h3t.snapped,true,'H3 折り目で割れた反対の外周辺に吸いつかない');
const h3cr=N.creaseForEdge(h3,h3g,h3t.target);
assert.deepEqual(h3cr.line.map(rd).slice().sort(),[[-1,0],[1,0]].map(rd).slice().sort(),'H3 折線が中線でない');
assert.equal(Math.abs(h3cr.ratio-.5)<1e-9,true,'H3 動く割合が紙片の半分でない: '+h3cr.ratio);
E.proposeOnFace(h3,h3cr.line[0],h3cr.line[1],h3g.faceId);E.setSide(h3,h3cr.sidePoint);
assert.deepEqual(h3.pending.candidates.map(c=>c.faceId).slice().sort(),['paper/s1.cut','paper/s1.keep'],'H3 折り目の両側が動く面になっていない');
assert.throws(()=>E.select(h3,[h3.pending.candidates[0]]),/全部選んで/,'H3 片側だけ選べてしまう');
E.select(h3,ref(h3));E.confirm(h3);
assert.deepEqual(h3.recipe.steps[1].targets.map(t=>t.faceId).slice().sort(),['paper/s1.cut','paper/s1.keep'],'H3 原本の targets が片側だけ');
const dH3=discontinuity(h3);
assert.equal(dH3.tot>4000,true,'H3 測った点が少なすぎる: '+dH3.tot);
assert.equal(dH3.bad,0,`H3 折り目をまたぐ辺合わせで紙が破れた：${dH3.bad}/${dH3.tot}点 最大 ${dH3.worst}`);
assert.equal(h3.cache.faces.filter(f=>f.layer>0).length,2,'H3 折り目の両側が持ち上がっていない');
assert.equal(h3.cache.creases.length,2,'H3 折り目が折線で切り分けられていない');
bondInvariant(h3,'h3');

/* H5 角をつかんだとき、外周辺の「線分の途中」に緑が乗る。ふちと折り目の交点は線上に勝つ。 */
const h5=E.create(),h5g=N.grab(h5,S([1,-1]),V);
const h5t=N.foldTarget(h5,h5g,S([-.4,.97]),[-.4,.97],V,false);
assert.equal(h5t.snapped,true,'H5 向こう側の外周辺の途中に吸いつかない');
assert.equal(h5t.snapKind,'line');assert.equal(h5t.snapOn,'edge');
assert.deepEqual(rd(h5t.target),[-.4,1],'H5 緑が上辺の上に乗っていない');
/* 🚨つかんだ角が乗っている「足元のふち」には吸いつかない（角をふちに沿って滑らせるだけの折りになるため）。
   つかんだ角(1,-1)の足元＝下辺と右辺。どちらも26pxの中に入れても自由点のまま。 */
for(const[q,tag]of[[[.2,-.9],'下辺'],[[.98,.3],'右辺']]){
 const t=N.foldTarget(h5,h5g,S(q),q,V,false);
 assert.equal(t.snapped,false,`H5 足元の${tag}に吸いついた: `+JSON.stringify(t));
 assert.deepEqual(rd(t.target),rd(q),`H5 足元の${tag}で行き先が指から動いた`)}
/* 別の角をつかめば、さっきの「足元」も向こう側のふちになる＝除外は角ごとに決まる。 */
const h5c=N.grab(h5,S([-1,1]),V),h5ct=N.foldTarget(h5,h5c,S([.2,-.9]),[.2,-.9],V,false);
assert.equal(h5ct.snapped,true,'H5 別の角から見た下辺に吸いつかない');
assert.deepEqual(rd(h5ct.target),[.2,-1],'H5 緑が下辺の上に乗っていない');
const h5b=creaseAt([-1,-.5],[1,-.5],[0,-.9]),h5bg=N.grab(h5b,S([1,1]),V);
const h5bt=N.foldTarget(h5b,h5bg,S([-.98,-.48]),[-.98,-.48],V,false);
assert.equal(h5bt.snapKind==='cross'||h5bt.snapKind==='end',true,'H5 交点・端点が線上に負けた: '+h5bt.snapKind);
assert.deepEqual(rd(h5bt.target),[-1,-.5],'H5 緑がふちと折り目の交点にない');
/* 座標も順位も変えず、表示だけ「折り目の端」と言えるようにした印。 */
assert.equal(h5bt.snapAtCreaseEnd,true,'H5 折り目の端だと分かる印が立っていない');
const h5mid=N.foldTarget(h5b,h5bg,S([0,-.5]),[0,-.5],V,false);
assert.equal(h5mid.snapKind,'line');assert.equal(h5mid.snapOn,'crease');
assert.equal(h5mid.snapAtCreaseEnd,false,'H5 折り目の途中まで「端」になっている');
/* 26px入る・44px離れるは折り目でも同じ（ふちから遠いまん中で測る）。 */
const mid35=[0,-.5+35/240],mid20=[0,-.5+20/240];
assert.equal(N.foldTarget(h5b,h5bg,S(mid35),mid35,V,false).snapped,false,'H5 26pxより遠いのに吸いついた');
assert.equal(N.foldTarget(h5b,h5bg,S(mid35),mid35,V,true).snapKind,'line','H5 44pxの内で離れた');
assert.equal(N.foldTarget(h5b,h5bg,S(mid20),mid20,V,false).snapKind,'line','H5 26pxの内で吸いつかない');

/* H6 別の紙片・別の層のガイドは混ざらない（除外表ではなく、入力が紙片ひとつぶんだから）。 */
const h6=creaseAt([-1,-.5],[1,-.5],[0,-.9]);foldCorner(h6,[1,1],[-.8,-.45]);
assert.equal(h6.cache.creases.length,2,'H6 折り目が切り分けられていない');
const segOf=g=>JSON.stringify([rd(g.a),rd(g.b)].slice().sort());
const topFace=h6.cache.faces.filter(f=>f.layer>0).sort((a,b)=>N.area(b.poly)-N.area(a.poly))[0];
const topSheet=E.sheetOf(h6,topFace.faceId),lowSheet=E.sheetOf(h6,h6.cache.faces.find(f=>f.layer===0).faceId);
assert.equal(topSheet.length,2,'H6 動いた側が2枚ひと続きの紙片になっていない');
const gTop=N.guidesOf(h6,topSheet),gLow=N.guidesOf(h6,lowSheet);
assert.equal(gTop.filter(g=>g.kind==='crease').length,1,'H6 上の紙片のガイドに折り目が1本でない: '+gTop.filter(g=>g.kind==='crease').length);
assert.equal(gLow.filter(g=>g.kind==='crease').length,1,'H6 下の紙片のガイドに折り目が1本でない');
assert.notEqual(segOf(gTop.find(g=>g.kind==='crease')),segOf(gLow.find(g=>g.kind==='crease')),'H6 別の紙片の折り目が同じものになっている');
const hg6=N.grab(h6,S(topFace.poly[0]),V);
assert.equal(hg6&&hg6.type,'corner','H6 動いた面の角をつかめていない');
assert.deepEqual(hg6.guides.map(segOf).slice().sort(),gTop.map(segOf).slice().sort(),'H6 つかんだ角に凍結されたガイドが、その紙片のものでない');

/* ================= I（B2a）重なりを読むAPI：画面からはまだ呼ばない ================= */
/* 「上からn枚」で1手を組み立てる小道具。UIと同じ順路（propose→setSide→setLayers→select→confirm）。 */
function commitLayers(st,a,b,side,n,kind='V'){const at=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 const hits=E.hitFaces(st,at);if(!hits.length)throw Error('折線の下に紙がありません');
 E.proposeOnFace(st,a,b,hits[0].faceId,{layers:n});st.pending.kind=kind;E.setSide(st,side);E.setLayers(st,n);
 E.select(st,ref(st));return E.confirm(st)}
/* 手で組んだ紙（APIの単体検査用）。原本は持たないので、キャッシュを読む関数だけに使う。 */
const fake=faces=>({recipe:{steps:[]},cache:{faces:faces.map((f,i)=>({faceId:'f'+i,layerPath:[],xf:[1,0,0,1,0,0],...f})),bonds:[]}});
const SQ=[[-1,-1],[1,-1],[1,1],[-1,1]];

/* I1 stackAt／layersAt：上から順・表裏(det)・層順位・由来手順・紙片。ふちの上は数えない。 */
const t2=E.create();commit(t2,[0,-1],[0,1],[.8,0]);
const i1=E.stackAt(t2,[-.5,0]);
assert.equal(i1.length,2,'I1 その場所が2枚になっていない');
assert.deepEqual(i1.map(v=>v.rank),[1,2],'I1 順位が振られていない');
assert.equal(i1[0].layer>i1[1].layer,true,'I1 上から順でない');
assert.equal(i1[0].faceId,'paper/s1.cut');assert.equal(i1[1].faceId,'paper/s1.keep');
assert.equal(i1[0].back,true,'I1 折り返した紙が裏になっていない（表裏はdet(xf)で決める）');
assert.equal(i1[1].back,false,'I1 土台が表になっていない');
assert.equal(i1[0].stepId,'s1','I1 由来手順が出ていない');
assert.deepEqual(i1[0].layerPath,[{stepId:'s1',side:'cut'}],'I1 layerPath が出ていない');
assert.notEqual(i1[0].sheetId,i1[1].sheetId,'I1 重なった2枚が同じ紙片になっている');
assert.equal(E.stackAt(t2,[-1,0]).length,0,'I1 ふちの上を重なりに数えた');
assert.deepEqual(E.layersAt(t2,[-.5,0]).layers,[1,0],'I1 層の並びが上からでない');
assert.deepEqual(E.layersAt(t2,[-.5,0]).duplicated,[],'I1 同層が誤検出された');

/* I2 「上からn枚」は場所でなく折線ぜんぶで決まる。点では1枚に見えても、動く側に上の紙があれば断る。 */
const i2=E.create();foldCorner(i2,[1,-1],[0,0]);/* 三角が層1で乗っている紙 */
const LA=[-1,-.6],LB=[1,-.6];/* 動く側は y<-0.6（S<0 側） */
assert.equal(E.split([[-1,-1],[1,-1],[1,1],[-1,1]],LA,LB)[1].every(q=>q[1]<=-.6+1e-9),true,'I2 動く側の向きが逆');
const onlyBase=E.topFaces(i2,[-.5,-.8],1,LA,LB);
assert.deepEqual(onlyBase,['paper/s1.keep'],'I2 その点の一番上が拾えていない');
const v2=E.foldability(i2,onlyBase,LA,LB,'V',[-.5,-.8]);
assert.equal(v2.ok,false,'I2 折線の先に乗っている紙を見逃した');
assert.match(v2.reason,/上に乗っている紙/,'I2 断る理由が違う: '+v2.reason);
assert.deepEqual(v2.blocking,['paper/s1.cut'],'I2 じゃまな紙を指せていない');
const both2=E.topFaces(i2,[.1,-.8],2,LA,LB).slice().sort();
assert.deepEqual(both2,['paper/s1.cut','paper/s1.keep'],'I2 上から2枚が拾えていない');
assert.equal(E.foldability(i2,both2,LA,LB,'V',[.1,-.8]).ok,true,'I2 2枚一緒なら折れるはず');

/* I3 中間層だけ・飛び飛び・同層重なりを、理由つきで断る。 */
const t4=E.create();commit(t4,[0,-1],[0,1],[.8,0]);commitLayers(t4,[-.5,-1],[-.5,1],[-.8,0],2);
assert.equal(t4.cache.faces.length,4,'I3 4枚になっていない');
const st4=E.stackAt(t4,[-.25,0]);
assert.deepEqual(st4.map(v=>v.layer),[3,2,1,0],'I3 4層に積み直されていない: '+JSON.stringify(st4.map(v=>v.layer)));
const MA=[-.25,1],MB=[-.25,-1];/* 動く側は x<-0.25 */
const mid=st4[1].faceId;/* 上から2枚目だけ＝中間層 */
const v3=E.foldability(t4,[mid],MA,MB,'V',[-.25,0]);
assert.equal(v3.ok,false,'I3 中間層だけの選択が通った');
assert.match(v3.reason,/上に乗っている紙|上から続けて/,'I3 断る理由が違う: '+v3.reason);
assert.equal(v3.blocking.includes(st4[0].faceId),true,'I3 上に乗っている紙を指せていない');
/* 飛び飛び（1枚目と3枚目）も断る。 */
const v3b=E.foldability(t4,[st4[0].faceId,st4[2].faceId],MA,MB,'V',[-.25,0]);
assert.equal(v3b.ok,false,'I3 飛び飛びの選択が通った');
/* 🚨動く側に「背（ヒンジ）」を含むかどうかで、通る枚数が変わる。
   背側（2手目のヒンジ x=-0.5 を動く側に含む）は、全部いっしょ(N=4)でないと紙が裂ける。 */
for(const n of[1,2,3]){const v=E.foldability(t4,E.topFaces(t4,[-.4,0],n,MA,MB),MA,MB,'V',[-.4,0]);
 assert.equal(v.ok,false,`I3 背側の上から${n}枚が通った`);
 assert.match(v.reason,/つながっている紙が置き去り/,'I3 断る理由が違う: '+v.reason)}
assert.equal(E.foldability(t4,E.topFaces(t4,[-.4,0],4,MA,MB),MA,MB,'V',[-.4,0]).ok,true,'I3 背側でも4枚なら折れるはず');
/* 開き側（ふちが自由な側）は、上から1枚・2枚が通る。3枚だと1手目の背をまたぐので断られる。 */
const OA=[-.25,-1],OB=[-.25,1];
assert.equal(E.foldability(t4,E.topFaces(t4,[-.15,0],1,OA,OB),OA,OB,'V',[-.15,0]).ok,true,'I3 開き側の上から1枚が折れない');
assert.equal(E.foldability(t4,E.topFaces(t4,[-.15,0],2,OA,OB),OA,OB,'V',[-.15,0]).ok,true,'I3 開き側の上から2枚が折れない');
assert.equal(E.foldability(t4,E.topFaces(t4,[-.15,0],3,OA,OB),OA,OB,'V',[-.15,0]).ok,false,'I3 開き側の3枚が通った（1手目の背をまたぐ）');
assert.throws(()=>E.topFaces(t4,[-.25,0],5,MA,MB),/上から5枚は選べません/,'I3 枚数の上限を見ていない');
assert.throws(()=>E.topFaces(t4,[-.25,0],0,MA,MB),/上から0枚は選べません/);
/* 同じ層が同じ場所に2枚＝順位が決まらないので断る。 */
const dup=fake([{poly:SQ,layer:1},{poly:SQ,layer:1},{poly:SQ,layer:0}]);
assert.deepEqual(E.layersAt(dup,[0,0]).duplicated,[1],'I3 同層の重なりを見つけられない');
assert.throws(()=>E.topFaces(dup,[0,0],1,[0,1],[0,-1]),/順位が決まりません/,'I3 同層重なりが素通りした');
/* ①の見張り（同じ層の紙が動く側で重なっている）が先に捕まえる。どちらの理由でも「断る」ことが要点。 */
const vd=E.foldability(dup,['f0'],[0,1],[0,-1],'V',[0,0]);
assert.equal(vd.ok,false,'I3 同層の重なりが素通りした');
assert.match(vd.reason,/順位が決まりません|上に乗っている紙/,'I3 断る理由が違う: '+vd.reason);
/* 「上から続けて」の見張りが単独で効くこと＝じゃまな紙が動く側に無くても、飛び飛びは断る。 */
const gap=fake([{poly:SQ,layer:3},{poly:[[.2,-1],[.9,-1],[.9,1],[.2,1]],layer:2},{poly:SQ,layer:1},{poly:SQ,layer:0}]);
const GA=[0,1],GB=[0,-1];/* 動く側は x<0。層2の紙は x>=0.2 にしか無いので、じゃまはしない */
const vg=E.foldability(gap,['f0','f2'],GA,GB,'V',[.5,0]);
assert.equal(vg.ok,false,'I3 飛び飛びが「上から続けて」で断られない');
assert.match(vg.reason,/上から続けて/,'I3 断る理由が違う: '+vg.reason);
assert.equal(E.foldability(gap,['f0'],GA,GB,'V',[.5,0]).ok,true,'I3 上から1枚は通るはず');

/* I4 紙片(crease)の閉包は層をまたいで連れて行く。本番の積み直しでは、折り目でつながった2枚が
   別の層番号（1と2）になるので、「同じ層だけ集める」では相手が置き去りになる。 */
const i4=creaseAt([-1,-.5],[1,-.5],[0,-.9]);foldCorner(i4,[1,1],[-.8,-.45]);
const topF=i4.cache.faces.slice().sort((a,b)=>b.layer-a.layer)[0];
const cen4=topF.poly.reduce((z,v)=>[z[0]+v[0]/topF.poly.length,z[1]+v[1]/topF.poly.length],[0,0]);
const A4=[-1,.95],B4=[1,.95];/* 動く側は y<0.95＝ほぼ紙ぜんぶ */
const ids4=E.topFaces(i4,cen4,1,A4,B4);
assert.equal(ids4.includes(topF.faceId),true,'I4 いちばん上の面が入っていない');
const mate=E.sheetOf(i4,topF.faceId).map(f=>f.faceId).filter(v=>v!==topF.faceId);
assert.equal(mate.length,1,'I4 折り目の相手が1枚でない');
assert.notEqual(i4.cache.faces.find(f=>f.faceId===mate[0]).layer,topF.layer,'I4 相手が同じ層番号＝閉包の出番になっていない');
assert.equal(ids4.includes(mate[0]),true,'I4 折り目でつながった相手（別の層番号）が置き去りになった');

/* I5 2層折りでも紙は破れず、結び(crease/hinge)の線は両側で一致する。 */
const dI5=discontinuity(t4);
assert.equal(dI5.tot>4000,true,'I5 測った点が少なすぎる: '+dI5.tot);
assert.equal(dI5.bad,0,`I5 2層折りで紙が破れた：${dI5.bad}/${dI5.tot}点 最大 ${dI5.worst}`);
bondInvariant(t4,'t4');
/* ヒンジの見張りは本物：折る側にヒンジの線を丸ごと含む手は再生できない（実測で破れる形）。 */
const tear=E.create();commit(tear,[.5,-1],[.5,1],[.8,0]);
assert.throws(()=>commit(tear,[-.8,0],[-.2,0],[-.5,.5],'M'),/置き去りになって裂けます|ヒンジにそって紙が切り離されました/,'I5 ヒンジの破れが素通りした');
/* 手で書いた原本でも、再生の時点で断る（最後の見張り）。 */
const rawTear=C0(tear.recipe);
rawTear.steps.push({id:'s2',diagramStep:'2',op:'fold',kind:'M',reference:{faceId:'paper/s1.keep',layerPath:[{stepId:'s1',side:'keep'}]},
 line:[[-.8,0],[-.2,0]],movingSidePoint:[-.5,.5],targets:[{faceId:'paper/s1.keep',layerPath:[{stepId:'s1',side:'keep'}]}],instruction:'ヒンジをまたぐ手'});
assert.throws(()=>E.replay(rawTear),/置き去りになって裂けます|ヒンジにそって紙が切り離されました/,'I5 原本の再生で破れが素通りした');

/* I6 原本に書けるかを、書く前に判定して理由を返す。 */
const i6=E.create();commit(i6,[0,-1],[0,1],[.8,0]);
E.proposeOnFace(i6,[-.5,-1],[-.5,1],'paper/s1.cut',{layers:2});E.setSide(i6,[-.8,0]);E.setLayers(i6,2);
const okRec=E.recordable(i6,i6.pending.candidates.map(c=>c.faceId),'paper/s1.cut',[-.5,1],[-.5,-1],[-.8,0]);
assert.equal(okRec.ok,true,'I6 書けるはずの形が断られた: '+okRec.reason);
assert.equal(okRec.line.every(q=>Math.abs(q[0])<=1&&Math.abs(q[1])<=1),true,'I6 記録する折線が紙の外に出ている');
assert.match(E.recordable(i6,['paper/s1.cut'],'paper/s1.keep',[-.5,1],[-.5,-1],[-.8,0]).reason,/基準の面が対象に入っていません/);
assert.match(E.recordable(i6,['paper/s1.cut'],'paper/s1.cut',[-.5,1],[-.5,-1],[9,9]).reason,/折る側の点が基準の面の外/);
/* 折線が基準面を通っていなくてもよい（紙片の別の面の上を通る折りはふつうにある）。
   断るのは「どう書いても原紙の座標が±1に収まらない」とき＝丸めもクランプもしない。 */
assert.match(E.recordable(i6,['paper/s1.cut'],'paper/s1.cut',[5,1],[5,-1],[-.8,0],[[5,0],[5,1]]).reason,
 /原紙の座標に戻すと紙の外/,'書けない折線を断っていない');
assert.equal(E.recordable(i6,['paper/s1.cut'],'paper/s1.cut',[-.5,1],[-.5,-1],[-.8,0],[[.5,-1],[.5,1]]).ok,true,
 'いまの折線が±1に収まるのに断られた');
E.cancel(i6);

/* I7 単一面の道は1文字も変えていない：層を指定しなければ、重なりは今までどおり断る。 */
const i7=E.create();commit(i7,[0,-1],[0,1],[.8,0]);
assert.throws(()=>E.propose(i7,[-.5,-1],[-.5,1]),/重なった面/,'I7 層を指定していないのに重なりが通った');
assert.throws(()=>E.proposeOnFace(i7,[-.5,-1],[-.5,1],'paper/s1.cut'),/重なった面/,'I7 面を名指ししたら重なりが通った');

/* ★確認4：短い外周線分でも細い帯でも、movingSidePoint は必ず「動く側の面の内部」にあり、折線の上には出ない。
   動く側は頂点の近さでなく「つかんだ線分と折線の同じ側」で選ぶ（近さで選ぶと細い帯で止まる側を掴む）。
   ⚠線分が 2×CORNER_PX より短いと、まん中を押しても「角」が勝つ（設計どおり）ので、ここでは掃かない。 */
const sideOf=(p,L)=>(L[1][0]-L[0][0])*(p[1]-L[0][1])-(L[1][1]-L[0][1])*(p[0]-L[0][0]);
const cen=q=>q.reduce((a,v)=>[a[0]+v[0]/q.length,a[1]+v[1]/q.length],[0,0]);
const marginIn=(poly,p)=>{let m=Infinity,sg=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(L<1e-12)continue;const d=sideOf(p,[a,b])/L;if(!sg)sg=Math.sign(d);m=Math.min(m,sg*d)}return m};
function grabOuter(st,id,shortest){const segs=N.outerSegments(st).filter(v=>v.id===id).sort((x,y)=>Math.hypot(x.a[0]-x.b[0],x.a[1]-x.b[1])-Math.hypot(y.a[0]-y.b[0],y.a[1]-y.b[1]));
 const v=shortest?segs[0]:segs[segs.length-1];return N.grab(st,S([(v.a[0]+v.b[0])/2,(v.a[1]+v.b[1])/2]),V)}
const sweep=[['正方形/下辺',()=>E.create(),'bottom',false],['正方形/右辺',()=>E.create(),'right',false],
 ['正方形/上辺',()=>E.create(),'top',false],['正方形/左辺',()=>E.create(),'left',false],
 ['短い線分(角を落とす.3)',()=>creaseAt([1,-.7],[.7,-1],[0,0]),'bottom',true],
 ['短い線分(角を落とす.8)',()=>creaseAt([1,-.2],[.2,-1],[0,0]),'bottom',true],
 ['折り目つき h=.05',()=>creaseAt([-1,-.95],[1,-.95],[0,0]),'bottom',false],
 ['折り目つき h=.2',()=>creaseAt([-1,-.8],[1,-.8],[0,0]),'bottom',false],
 ['折り目つき h=.6',()=>creaseAt([-1,-.4],[1,-.4],[0,0]),'bottom',false],
 ['斜めの折り目',()=>creaseAt([-1,-.8],[1,-.4],[0,.9]),'bottom',false]];
let swept=0,refusedSmall=0,minMargin=Infinity,minOffLine=Infinity;
for(const[name,make,id,shortest]of sweep){const st=make(),g=grabOuter(st,id,shortest);
 assert.equal(g&&g.type,'edge',name+'：外周線分をつかめていない');
 const f=st.cache.faces.find(v=>v.faceId===g.faceId),mid=[(g.edge.a[0]+g.edge.b[0])/2,(g.edge.a[1]+g.edge.b[1])/2];
 for(const fr of[1e-3,.005,.02,.1,.3,.6,.9,1]){const d=g.span*fr,tag=`${name} d/span=${fr}`;
  const cr=N.creaseForEdge(st,g,[g.edge.a[0]+g.normal[0]*d,g.edge.a[1]+g.normal[1]*d]);
  /* 対象面は二つに割れることも、丸ごと動く側に入ることもある（折線が紙片ぜんぶを切るため）。 */
  const parts=E.split(f.poly,cr.line[0],cr.line[1]).filter(Boolean);
  assert.equal(parts.length>=1,true,tag+'：対象面が消えた');
  const grabSide=Math.sign(sideOf(mid,cr.line)),moving=parts.find(q=>Math.sign(sideOf(cen(q),cr.line))===grabSide);
  assert.equal(!!moving,true,tag+'：つかんだ線分の側が無い');
  const margin=marginIn(moving,cr.sidePoint),off=Math.abs(sideOf(cr.sidePoint,cr.line))/Math.hypot(cr.line[0][0]-cr.line[1][0],cr.line[0][1]-cr.line[1][1]);
  assert.equal(margin>0,true,`${tag}：movingSidePoint が動く側の内部にない（余白 ${margin}）`);
  assert.equal(off>0,true,tag+'：movingSidePoint が折線の上に乗っている');
  assert.equal(Math.sign(sideOf(cr.sidePoint,cr.line)),grabSide,tag+'：movingSidePoint が止まる側にある');
  const staying=parts.find(q=>q!==moving);
  if(staying)assert.equal(marginIn(staying,cr.sidePoint)<0,true,tag+'：movingSidePoint が止まる側の内部に入った');
  minMargin=Math.min(minMargin,margin);minOffLine=Math.min(minOffLine,off);swept++;
  const gate=Math.abs(sideOf(cr.sidePoint,cr.line));let msg=null;
  try{E.proposeOnFace(st,cr.line[0],cr.line[1],g.faceId);E.setSide(st,cr.sidePoint)}catch(e){msg=e.message}
  E.cancel(st);
  if(gate>=.03)assert.equal(msg,null,tag+`：折れるはずが断られた（|S|=${gate}）: `+msg);
  else{assert.match(String(msg),/折線から離れた側/,tag+`：小さすぎる折り（|S|=${gate}）が素通りした`);refusedSmall++}}}
console.error('   [掃き] 断られた小ささ:',refusedSmall,'/',swept,' 最小余白',minMargin.toExponential(2));assert.equal(swept,80,'掃いた組み合わせの数が変わった: '+swept);
assert.equal(minMargin>0&&minOffLine>0,true);
/* エンジンの見張り＝|折線長×離れ| が .03 未満なら断る。境目が黙って動かないよう数まで固定する。
   折線を紙片ぜんぶの長さに切るようになったので、断られる小ささは 36通り→20通り に減った。 */
assert.equal(refusedSmall,20,'エンジンが断る小ささの境目が動いた: '+refusedSmall);
/* 角折りも同じ規則（つかんだ物と折線の同じ側）。逆の側を選んだら落ちる。 */
let cornerSwept=0;
for(const from of[[1,-1],[-1,-1],[1,1],[-1,1]])for(const ang of[15,45,75])for(const L of[.05,.12,.4,1]){
 const ux=from[0]>0?-1:1,uy=from[1]>0?-1:1,r=ang*Math.PI/180;
 const target=[from[0]+ux*L*Math.cos(r),from[1]+uy*L*Math.sin(r)],tag=`角折り ${JSON.stringify(from)} ${ang}° L=${L}`;
 const cc=N.creaseForCorners(E.create(),from,target),parts=E.split([[-1,-1],[1,-1],[1,1],[-1,1]],cc.line[0],cc.line[1]).filter(Boolean);
 assert.equal(parts.length,2,tag+'：面が二つに割れていない');
 const mv=parts.find(q=>q.some(v=>Math.hypot(v[0]-from[0],v[1]-from[1])<1e-9));
 assert.equal(!!mv,true,tag+'：つかんだ角を持つ側が無い');
 assert.equal(marginIn(mv,cc.sidePoint)>0,true,tag+'：movingSidePoint が動く側の内部にない');
 assert.equal(marginIn(parts.find(q=>q!==mv),cc.sidePoint)<0,true,tag+'：movingSidePoint が止まる側に入った');
 assert.equal(Math.abs(sideOf(cc.sidePoint,cc.line))>0,true,tag+'：movingSidePoint が折線の上に乗っている');
 cornerSwept++}
assert.equal(cornerSwept,48,'角折りで掃いた組み合わせの数が変わった: '+cornerSwept);
/* ================= K（B2c）重なりを本当に折る ================= */
/* 「上からN枚」で1手を組み立てる（UIと同じ順路。at は movingSidePoint）。 */
function foldTop(st,a,b,side,n,kind='V'){const hits=E.hitFaces(st,side);
 if(!hits.length)throw Error('折る側の点の下に紙がありません');
 E.proposeOnFace(st,a,b,hits[0].faceId,{layers:n});st.pending.kind=kind;E.setSide(st,side);E.setLayers(st,n);
 const picked=C0(st.pending.candidates);E.select(st,ref(st));E.confirm(st);return picked}
const snap=st=>({recipe:JSON.stringify(st.recipe),rev:st.revision,hash:st.cache.hash,
 faces:JSON.stringify(st.cache.faces.map(f=>[f.faceId,f.layer]))});
const same=(a,b,tag)=>{assert.equal(a.recipe,b.recipe,tag+' 原本が変わった');assert.equal(a.rev,b.rev,tag+' revision が動いた');
 assert.equal(a.hash,b.hash,tag+' cache.hash が動いた');assert.equal(a.faces,b.faces,tag+' 表示状態が変わった')};

/* K1 2層の「上から2枚」を確定する。 */
const k2=E.create();commit(k2,[0,-1],[0,1],[.8,0]);
assert.equal(E.stackAt(k2,[-.8,-.5]).length,2,'K1 2層になっていない');
const kPicked=foldTop(k2,[-.5,-1],[-.5,1],[-.8,-.5],2);
assert.equal(k2.recipe.steps.length,2,'K1 2手目が入っていない');
const kStep=k2.recipe.steps[1];
assert.equal(kStep.targets.length,2,'K1 targets が2枚でない');
assert.deepEqual(kStep.targets.map(t=>t.faceId),kPicked.map(c=>c.faceId),'K1 targets の並びが engine の候補と違う');
for(const t of kStep.targets){assert.equal(typeof t.faceId,'string');assert.equal(Array.isArray(t.layerPath),true,'K1 layerPath が無い')}
assert.equal(kStep.targets.some(t=>t.faceId===kStep.reference.faceId),true,'K1 reference が targets に入っていない');
/* reference＝選んだ中で「この場所」を含むいちばん上の面。 */
const kTop=E.stackAt({cache:E.replay({...k2.recipe,steps:k2.recipe.steps.slice(0,1)})},[-.8,-.5]);
assert.equal(kStep.reference.faceId,kTop[0].faceId,'K1 reference が最上面でない');
assert.equal(k2.cache.faces.length,4,'K1 4枚に割れていない');
assert.deepEqual(E.stackAt(k2,[-.25,-.5]).map(v=>v.layer),[3,2,1,0],'K1 折り返した先が4層に積み直されていない');
const dK1=discontinuity(k2);assert.equal(dK1.bad,0,`K1 2層折りで紙が破れた ${dK1.bad}/${dK1.tot}`);
bondInvariant(k2,'k2');
/* K1b 確定→1手戻す→同じ手をやり直すと、再生ハッシュが戻る。 */
const kHash=k2.cache.hash;E.undo(k2);assert.equal(k2.recipe.steps.length,1);
foldTop(k2,[-.5,-1],[-.5,1],[-.8,-.5],2);
assert.equal(k2.cache.hash,kHash,'K1b 巻き戻してやり直すとハッシュが変わった');
assert.equal(E.verifiedRecipe(k2).steps.length,2,'K1b 保存前の突き合わせが通らない');

/* K1c 基準の面は「この場所を含む、選んだ中でいちばん上の面」にそろえられる＝下の面を名指ししても直る。
   ここがずれると Python の「movingSidePoint は基準面の内部」に落ちる。 */
const kr=E.create();commit(kr,[0,-1],[0,1],[.8,0]);
E.proposeOnFace(kr,[-.5,-1],[-.5,1],'paper/s1.keep',{layers:2});kr.pending.kind='V';E.setSide(kr,[-.8,-.5]);
assert.equal(kr.pending.reference.faceId,'paper/s1.keep','K1c 下の面を名指しできていない');
E.setLayers(kr,2);
assert.equal(kr.pending.reference.faceId,'paper/s1.cut','K1c 基準が最上面にそろわない');
E.select(kr,ref(kr));E.confirm(kr);
assert.equal(kr.recipe.steps[1].reference.faceId,'paper/s1.cut','K1c 原本の基準が最上面でない');
assert.equal(kr.cache.hash,kHash,'K1c 上の面を名指しした時と出来上がりが違う');

/* K2 4層のうち「上から2枚」だけを、3手目として折る（3手目上限は外れている）。 */
const k3=E.create();commit(k3,[0,-1],[0,1],[.8,0]);foldTop(k3,[-.5,-1],[-.5,1],[-.8,0],2);
assert.deepEqual(E.stackAt(k3,[-.4,0]).map(v=>v.layer),[3,2,1,0],'K2 4層になっていない');
/* ⚠動く側は「開いているふち」の側にする。折り目(ヒンジ)の背側を動かすと、相手を置き去りにして紙が裂ける
   ＝エンジンが正しく断る（x=-0.5 は2手目のヒンジ）。 */
const k3Picked=foldTop(k3,[-.25,-1],[-.25,1],[-.1,0],2,'V');
assert.equal(k3.recipe.steps.length,3,'K2 3手目が入っていない');
assert.equal(k3.recipe.steps[2].targets.length,2,'K2 上から2枚になっていない');
assert.deepEqual(k3.recipe.steps[2].targets.map(t=>t.faceId),k3Picked.map(c=>c.faceId),'K2 targets の並びが違う');
const dK2=discontinuity(k3);assert.equal(dK2.bad,0,`K2 3手目で紙が破れた ${dK2.bad}/${dK2.tot}`);
bondInvariant(k3,'k3');

/* K3 プレビュー：対象面ぜんぶが 0°／90°／180° で動き、対象でない面は動かない。 */
const kp=E.create();commit(kp,[0,-1],[0,1],[.8,0]);
E.proposeOnFace(kp,[-.5,-1],[-.5,1],'paper/s1.cut',{layers:2});kp.pending.kind='V';E.setSide(kp,[-.8,-.5]);E.setLayers(kp,2);
const lift=g=>Math.max(...g.move.map(v=>Math.abs(v[1])));
const g0=E.preview(kp,0),g90=E.preview(kp,90),g180=E.preview(kp,180);
assert.equal(g90.movingIds.length,2,'K3 90°で動く面が2枚でない');
assert.deepEqual(g0.movingIds,g180.movingIds,'K3 角度で対象面が変わった');
assert.equal(lift(g0)<1e-9,true,'K3 0°で浮いている');
assert.equal(lift(g90)>.1,true,'K3 90°で持ち上がっていない');
assert.equal(lift(g180)<1e-9,true,'K3 180°で平らに戻っていない');
assert.equal(g90.parts.filter(v=>v.move).length,2,'K3 動く小片が2つでない');
/* 対象でない面は、どの角度でも1ミリも動かない。 */
const fixed=JSON.stringify(kp.cache.faces.filter(f=>!g90.movingIds.includes(f.faceId)).map(f=>f.poly));
for(const g of[g0,g90,g180])assert.equal(JSON.stringify(g.baseFaces.map(f=>f.poly)),fixed,'K3 対象でない面が動いた');
assert.equal(kp.recipe.steps.length,1,'K3 プレビューで原本が動いた');

/* K4 断るものは断る。しかも断ったら、原本も表示も1ミリも動かない（原子的）。 */
const before=snap(kp);
/* 中間層だけ／飛び飛びを selected に入れても確定できない。 */
const kst=E.stackAt(kp,[-.8,-.5]);
kp.pending.selected=[{faceId:kst[1].faceId,layerPath:[]}];
assert.throws(()=>E.confirm(kp),/上に乗っている紙|上から続けて|全部選んで/,'K4 中間層だけが確定できてしまう');
same(snap(kp),before,'K4 中間層');
/* 逆向き（山折り）で「上から1枚」は通らない＝下に敷かれている紙を突き抜けることになる。
   ⚠2枚とも選べば下に何も残らないので通る。断られるのは「下に紙を残したまま裏へ折る」形。 */
E.setLayers(kp,1);E.select(kp,ref(kp));kp.pending.kind='M';
assert.throws(()=>E.confirm(kp),/下に敷かれている紙/,'K4 山折りで上から1枚が通った');
same(snap(kp),before,'K4 山折り');
kp.pending.kind='V';E.setLayers(kp,2);E.select(kp,ref(kp));
/* 折る側の点が基準面の外＝原本には書けない（Python の「movingSidePoint は基準面の内部」に落ちる形）。
   ここは recordable だけが塞いでいる穴で、replay は素通りさせてしまう。 */
const keepSide=C0(kp.pending.sidePoint);
kp.pending.sidePoint=[.8,1.5];/* 素材座標。いまの座標では [-0.8,1.5]＝動く側だが面の外 */
assert.throws(()=>E.confirm(kp),/折る側の点が基準の面の外/,'K4 基準面の外の movingSidePoint が原本に書けてしまう');
same(snap(kp),before,'K4 折る側の点が面の外');kp.pending.sidePoint=keepSide;
/* recordable が断る形（100手上限）でも、確定は起きず何も動かない。 */
const full={...kp,recipe:{...kp.recipe,steps:Array.from({length:E.MAX_STEPS},()=>kp.recipe.steps[0])},cache:kp.cache,pending:kp.pending};
assert.throws(()=>E.confirm(full),/100手/,'K4 100手を超えて確定できた');
same(snap(kp),before,'K4 100手');
E.cancel(kp);assert.equal(kp.pending,null);

/* K5 結びを切る形は、確定の中の再生で捕まる（原本には残らない）。 */
const k5=E.create();commit(k5,[.5,-1],[.5,1],[.8,0]);const b5=snap(k5);
assert.throws(()=>commit(k5,[-.8,0],[-.2,0],[-.5,.5],'M'),/置き去りになって裂けます|ヒンジにそって紙が切り離されました/,'K5 ヒンジの破れが確定できた');
same(snap(k5),b5,'K5 ヒンジ');

/* ========== L 添付画像の再現：結びをまたぐ「上から1枚」は裂ける（2026-09-12の不具合） ==========
   1手目＝右辺を左辺へ（半分折り）／2手目＝角(-1,-1)を(-0.4,-0.4)へ（上から1枚）
   3手目＝角(0,1)を(-0.45,0.45)へ。ここで「上から1枚」を選ぶと、1手目の背
   （paper/s1.keep と paper/s1.cut/s2.keep を結ぶ hinge）が動く側の内部に残り、
   90°で0.5・180°で0.71 の口が開いていた。foldability は「上に乗っている紙」規則を
   すり抜けた（置き去りになる相手が“下の層”だったため）。 */
/* 結びの線が、その角度でどれだけ開くか。0°でも90°でも180°でも0でなければ、そこで紙は裂けている。 */
function bondGap(st,angle){const q=st.pending,g=E.preview(st,angle),ids=g.movingIds;
 const A=g.line[0],B=g.line[1],rad=angle*Math.PI/180,sg=q.kind==='V'?1:-1;
 const dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
 const rot=v=>{if(angle===0)return[v[0],0,-v[1]];if(angle===180){const r=E.reflect(v,A,B);return[r[0],0,-r[1]]}
  const vx=v[0]-A[0],vy=v[1]-A[1],al=vx*ux+vy*uy,px=A[0]+al*ux,py=A[1]+al*uy,pe=Math.hypot(v[0]-px,v[1]-py);
  return[px+(v[0]-px)*Math.cos(rad),sg*pe*Math.sin(rad),-(py+(v[1]-py)*Math.cos(rad))]};
 const put=(fid,v)=>ids.includes(fid)&&E.side(v,A,B)<-1e-9?rot(v):[v[0],0,-v[1]];
 let worst=0;
 for(const bd of st.cache.bonds){const fx=st.cache.faces.find(v=>v.faceId===bd.faceIds[0]);
  if(!fx||!st.cache.faces.some(v=>v.faceId===bd.faceIds[1]))continue;
  for(let i=0;i<=8;i++){const t=i/8,
   v=ap(fx.xf,[bd.seg[0][0]+(bd.seg[1][0]-bd.seg[0][0])*t,bd.seg[0][1]+(bd.seg[1][1]-bd.seg[0][1])*t]);
   const u1=put(bd.faceIds[0],v),u2=put(bd.faceIds[1],v);
   worst=Math.max(worst,Math.hypot(u1[0]-u2[0],u1[1]-u2[1],u1[2]-u2[2]))}}
 return worst}
function pendCorner(st,from,to,n){const cr=N.creaseForCorners(st,from,to,{requireInside:true});
 E.proposeOnFace(st,cr.line[0],cr.line[1],cr.faceId,{layers:n});st.pending.kind='V';E.setSide(st,cr.sidePoint);
 E.setLayers(st,n);return cr}
function tornFixture(){const st=E.create();
 const g=N.grab(st,S([1,.3]),V),t=N.edgeTarget(g,S([-.99,.3]),[-.99,.3],V,false),c0=N.creaseForEdge(st,g,t.target);
 E.proposeOnFace(st,c0.line[0],c0.line[1],g.faceId);st.pending.kind='V';E.setSide(st,c0.sidePoint);
 E.select(st,ref(st));E.confirm(st);
 pendCorner(st,[-1,-1],[-.4,-.4],1);E.select(st,ref(st));E.confirm(st);
 return st}
const L1=tornFixture();
assert.equal(L1.recipe.steps.length,2,'L1 2手の紙になっていない');
const lBefore=snap(L1);
/* 上から1枚＝断られる。理由と、置き去りになる紙まで示す。 */
let lReason=null;try{pendCorner(L1,[0,1],[-.45,.45],1)}catch(e){lReason=e.message}
assert.match(String(lReason),/つながっている紙が置き去り/,'L1 結びをまたぐ「上から1枚」が通ってしまう: '+lReason);
same(snap(L1),lBefore,'L1 断ったとき');
/* 断る理由の中身：どの紙が置き去りになるかを指せている。 */
const lf=L1.cache.faces.find(x=>x.faceId===L1.pending.reference.faceId),lsp=ap(lf.xf,L1.pending.sidePoint);
let lA=L1.pending.displayLine[0],lB=L1.pending.displayLine[1];if(E.side(lsp,lA,lB)>0)[lA,lB]=[lB,lA];
const lOne=E.topFaces(L1,L1.pending.at,1,lA,lB),lv=E.foldability(L1,lOne,lA,lB,'V',L1.pending.at);
assert.equal(lv.ok,false,'L1 foldability が成立と言っている');
assert.equal(lv.blocking.length>0,true,'L1 置き去りになる紙を指せていない');
assert.equal(lv.blocking.every(id=>!lOne.includes(id)),true,'L1 blocking が選択集合そのものになっている');
/* 上から2枚＝つながっている紙も一緒に動くので折れる。0°／90°／180°のどれでも結びは開かない。 */
E.cancel(L1);pendCorner(L1,[0,1],[-.45,.45],2);
for(const a of[0,90,180])assert.equal(bondGap(L1,a)<1e-9,true,`L1 上から2枚なのに ${a}° で結びが開く: `+bondGap(L1,a));
E.select(L1,ref(L1));E.confirm(L1);
assert.equal(L1.recipe.steps.length,3,'L1 上から2枚で確定できない');
assert.equal(L1.recipe.steps[2].targets.length,2,'L1 targets が2面でない');
const dL=discontinuity(L1);assert.equal(dL.bad,0,`L1 確定後に紙が破れた ${dL.bad}/${dL.tot}点 最大 ${dL.worst}`);
bondInvariant(L1,'L1');
/* 結びの線の上を折るのは通す／結び全体が止まる側に残るのも通す（②の許可条件）。 */
const L2=E.create();const lg=N.grab(L2,S([1,.3]),V),lt=N.edgeTarget(lg,S([-.99,.3]),[-.99,.3],V,false);
const lc=N.creaseForEdge(L2,lg,lt.target);
E.proposeOnFace(L2,lc.line[0],lc.line[1],lg.faceId);L2.pending.kind='V';E.setSide(L2,lc.sidePoint);
E.select(L2,ref(L2));E.confirm(L2);/* 背は x=0 */
const L2f=E.stackAt(L2,[-.5,0])[0].faceId;
/* 背から離れた所を、上から1枚だけ折る＝結びは止まる側に丸ごと残る→通る。 */
E.proposeOnFace(L2,[-.5,-1],[-.5,1],L2f,{layers:1});L2.pending.kind='V';E.setSide(L2,[-.8,0]);E.setLayers(L2,1);
assert.equal(bondGap(L2,90)<1e-9,true,'L2 結びが止まる側に残っているのに開いた');
E.cancel(L2);

/* ========== M 「上からN枚」は“この場所の重なり”から選ぶ／素材の境界は外から数え直す（2026-09-12） ==========
   添付画像の再現＝2手（角(1,-1)→(0.2,-0.4)／角(1,1)→(0,0.4)）のあと、角(0,0.4)→(0.6,0.4) を「上から1枚」。
   直す前は layer番号が同じというだけで `paper/s1.cut`（指の下にない、離れた場所の面）まで対象に入り、
   一度のしぐさで2か所の紙が別々に持ち上がった＝紙が開いて見えた。素材ではつながっていないので、
   結びの不変条件にも等長の検査にも出ない＝L群では掴めなかった。 */
/* ★素材の境界(material seam)を、結びにも面の並びにも頼らず外から作り直す。
   各面の素材座標の辺を刻み、法線に ±EPSN ずらした点がどの面に入るかで隣接を決める＝
   共線の許容差に頼らないので、数値が動いても取りこぼさない。 */
const EPSN=2e-4;
const srcOf=st=>st.cache.faces.map(f=>({id:f.faceId,layer:f.layer,xf:f.xf,src:f.poly.map(p=>iv(f.xf,p))}));
const facesAtSrc=(F,p)=>F.filter(f=>E.inside(p,f.src));
function materialSeams(st,M=24){const F=srcOf(st),out=[];
 for(const f of F)for(let i=0;i<f.src.length;i++){const a=f.src[i],b=f.src[(i+1)%f.src.length];
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<1e-9)continue;
  const nx=dy/L,ny=-dx/L;
  for(let k=0;k<M;k++){const t=(k+.5)/M,m=[a[0]+dx*t,a[1]+dy*t];
   out.push({mid:m,plus:facesAtSrc(F,[m[0]+nx*EPSN,m[1]+ny*EPSN]),minus:facesAtSrc(F,[m[0]-nx*EPSN,m[1]-ny*EPSN])})}}
 return out}
/* その素材の点が、その2面をつなぐ結びの線の上にあるか。 */
function bondOn(st,x,y,m){for(const bd of st.cache.bonds){const s=new Set(bd.faceIds);if(!s.has(x)||!s.has(y))continue;
 const a=bd.seg[0],b=bd.seg[1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<1e-12)continue;
 const off=Math.abs(((m[0]-a[0])*dy-(m[1]-a[1])*dx)/L),t=((m[0]-a[0])*dx+(m[1]-a[1])*dy)/(L*L);
 if(off<=2e-3&&t>=-2e-3&&t<=1+2e-3)return true}return false}
/* ①素材で面が重ならない ②内部の境界は必ず2面で、その2面は結ばれている ③外周は1面 ④面積の合計は元の紙のまま。 */
function seamAudit(st,tag){let internal=0,rim=0;
 for(const s of materialSeams(st)){
  assert.equal(s.plus.length<=1,true,`M ${tag} 素材で面が重なっている: ${s.plus.map(f=>f.id)}`);
  assert.equal(s.minus.length<=1,true,`M ${tag} 素材で面が重なっている: ${s.minus.map(f=>f.id)}`);
  const x=s.plus[0],y=s.minus[0];
  if(!x||!y){rim++;continue}/* 片側が紙の外＝外周辺（1面にだけ属する） */
  if(x.id===y.id)continue;/* 辺の上を横切っていない＝同じ面の中 */
  internal++;
  assert.equal(bondOn(st,x.id,y.id,s.mid),true,
   `M ${tag} 素材で隣り合っているのに結びが無い: ${x.id} | ${y.id} @${s.mid.map(v=>v.toFixed(4))}`)}
 const ar=p=>{let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j][0]*p[i][1]-p[i][0]*p[j][1];return Math.abs(a)/2};
 const tot=srcOf(st).reduce((n,f)=>n+ar(f.src),0);
 assert.equal(Math.abs(tot-4)<1e-9,true,`M ${tag} 素材の面積の合計が元の紙と違う: ${tot}`);
 assert.equal(rim>0,true,`M ${tag} 外周がひとつも見つからない`);
 assert.equal(internal>0||st.cache.faces.length===1,true,`M ${tag} 内部の境界がひとつも見つからない`);
 return{internal,rim}}
/* ★ゴーストの等長検査。結びも面の並びも見ず「素材で近い2点は、動かしたあとも近い」だけを見る。 */
function ghostTear(st,angle,grid=60){const q=st.pending,g=E.preview(st,angle),ids=new Set(g.movingIds);
 const A=g.line[0],B=g.line[1],rad=angle*Math.PI/180,sg=q.kind==='V'?1:-1;
 const dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
 const rot=v=>{if(angle===0)return[v[0],0,-v[1]];if(angle===180){const r=E.reflect(v,A,B);return[r[0],0,-r[1]]}
  const vx=v[0]-A[0],vy=v[1]-A[1],al=vx*ux+vy*uy,px=A[0]+al*ux,py=A[1]+al*uy,pe=Math.hypot(v[0]-px,v[1]-py);
  return[px+(v[0]-px)*Math.cos(rad),sg*pe*Math.sin(rad),-(py+(v[1]-py)*Math.cos(rad))]};
 const F=srcOf(st),put=u=>{for(const f of F)if(E.inside(u,f.src)){const p=ap(f.xf,u);
   return ids.has(f.id)&&E.side(p,A,B)<-1e-9?rot(p):[p[0],0,-p[1]]}return null};
 const h=2/grid;let bad=0,worst=0,where=null;
 for(let i=0;i<grid;i++)for(let j=0;j<grid;j++){const p=[-1+(i+.5)*h,-1+(j+.5)*h];
  for(const r of[[p[0]+h,p[1]],[p[0],p[1]+h]]){const X=put(p),Y=put(r);if(!X||!Y)continue;
   const d=Math.hypot(X[0]-Y[0],X[1]-Y[1],X[2]-Y[2]);
   if(d>h*1.0001+1e-9){bad++;if(d>worst){worst=d;where=p.slice()}}}}
 return{bad,worst,where}}

/* M1 画像の再現。「上から1枚」は、指の下の重なりの1枚だけ。離れた場所の面は入らない。 */
const M1=E.create();
pendCorner(M1,[1,-1],[.2,-.4],1);E.select(M1,ref(M1));E.confirm(M1);
pendCorner(M1,[1,1],[0,.4],1);E.select(M1,ref(M1));E.confirm(M1);
assert.deepEqual(M1.cache.faces.map(f=>f.faceId).slice().sort(),
 ['paper/s1.cut','paper/s1.keep/s2.cut','paper/s1.keep/s2.keep'],'M1 2手の紙が画像どおりに再現できていない');
assert.equal(M1.cache.faces.filter(f=>f.layer===1).length,2,'M1 同じ層番号の面が離れて2つある状態になっていない');
const mBefore=snap(M1);
pendCorner(M1,[0,.4],[.6,.4],1);
const mAt=M1.pending.at,mStack=E.stackAt(M1,mAt).map(v=>v.faceId);
assert.deepEqual(mStack,['paper/s1.keep/s2.cut','paper/s1.keep/s2.keep'],'M1 この場所の重なりが画像と違う');
assert.deepEqual(M1.pending.candidates.map(c=>c.faceId),['paper/s1.keep/s2.cut'],
 'M1 指の下にない離れた面まで「上から1枚」に入っている: '+JSON.stringify(M1.pending.candidates.map(c=>c.faceId)));
/* 候補は「この場所の重なり」か、そこから折り目でつながった紙からしか来ない。 */
const mHere=new Set(mStack);
assert.equal(M1.pending.candidates.every(c=>mHere.has(c.faceId)||[...E.sheetIds(M1.cache.bonds,c.faceId)].some(q=>mHere.has(q))),
 true,'M1 この場所とつながっていない面が選ばれている');
/* 上から2枚＝この場所の2枚。離れた面ではない。 */
let mA=M1.pending.displayLine[0],mB=M1.pending.displayLine[1];
const mRef=M1.cache.faces.find(x=>x.faceId===M1.pending.reference.faceId);
if(E.side(ap(mRef.xf,M1.pending.sidePoint),mA,mB)>0)[mA,mB]=[mB,mA];
assert.deepEqual(E.topFaces(M1,mAt,2,mA,mB).slice().sort(),
 ['paper/s1.keep/s2.cut','paper/s1.keep/s2.keep'],'M1 上から2枚が、この場所の2枚になっていない');
for(const a of[0,90,180]){const t=ghostTear(M1,a);assert.equal(t.bad,0,`M1 ${a}° でゴーストが破れた ${t.bad}点 最大${t.worst}`)}
E.cancel(M1);same(snap(M1),mBefore,'M1 候補を作って取り消したとき');
pendCorner(M1,[0,.4],[.6,.4],1);E.select(M1,ref(M1));E.confirm(M1);
assert.equal(M1.recipe.steps.length,3,'M1 3手目が確定できない');
assert.deepEqual(M1.recipe.steps[2].targets.map(t=>t.faceId),['paper/s1.keep/s2.cut'],'M1 原本に離れた面まで書かれている');
const dM1=discontinuity(M1);assert.equal(dM1.bad,0,`M1 確定後に紙が破れた ${dM1.bad}/${dM1.tot}点`);
bondInvariant(M1,'M1');

/* M2 折り目でつながった紙は、離れていても一緒に選ばれる＝閉包は絞りこみで壊れていない。 */
const M2=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
const m2cr=N.creaseForCorners(M2,[1,1],[-.8,-.45],{requireInside:true});
E.proposeOnFace(M2,m2cr.line[0],m2cr.line[1],m2cr.faceId,{layers:1});M2.pending.kind='V';E.setSide(M2,m2cr.sidePoint);
E.setLayers(M2,1);
const m2Here=new Set(E.stackAt(M2,M2.pending.at).map(v=>v.faceId));
assert.equal(M2.pending.candidates.length,2,'M2 折り目の向こう側が一緒に選ばれない: '+JSON.stringify(M2.pending.candidates.map(c=>c.faceId)));
assert.equal(M2.pending.candidates.some(c=>!m2Here.has(c.faceId)),true,'M2 閉包で足された面がない（検査の意味がない）');
for(const a of[0,90,180]){const t=ghostTear(M2,a);assert.equal(t.bad,0,`M2 ${a}° でゴーストが破れた ${t.bad}点 最大${t.worst}`)}
E.cancel(M2);

/* M3 素材の境界の監査。結びに載っていない隣接が1つでもあれば、そこが裂ける口になる。 */
for(const[tag,st]of[['s',s],['unified',unified],['a4',a4],['rep',rep],['bst',bst],['h3',h3],['t4',t4],
 ['k2',k2],['k3',k3],['kr',kr],['L1',L1],['M1',M1],['M2',M2]])seamAudit(st,tag);

/* ========== R やり直し(redo)＝原本だけを持つ。戻すときも、やり直すときも、先頭から再生する（2026-09-12） ==========
   redoStack に積むのは undo で外した**原本の手だけ**。面・結び・層・cache は1つも持たない
   （持てば原本のほかに2つめの正本ができる）。やり直しは確定とまったく同じ関門を通してから入れかえる。 */
/* R1 複数targetsを含む3手を、2回巻き戻して2回やり直す。原本もハッシュも完全に一致する。 */
const R1=tornFixture();
pendCorner(R1,[0,1],[-.45,.45],2);E.select(R1,ref(R1));E.confirm(R1);
assert.equal(R1.recipe.steps.length,3,'R1 3手にならない');
assert.equal(R1.recipe.steps[2].targets.length,2,'R1 3手目が複数targetsでない');
assert.deepEqual(R1.redoStack,[],'R1 確定したのに redoStack が空でない');
const rFaces=st=>st.cache.faces.map(f=>[f.faceId,f.layerPath.map(q=>q.stepId+'.'+q.side).join('>'),f.layer]);
const r3={recipe:JSON.stringify(R1.recipe),hash:R1.cache.hash,faces:rFaces(R1)};
E.undo(R1);const r2={recipe:JSON.stringify(R1.recipe),hash:R1.cache.hash,faces:rFaces(R1)};
assert.equal(R1.redoStack.length,1,'R1 巻き戻した手が積まれていない');
E.undo(R1);
assert.equal(R1.redoStack.length,2,'R1 2手ぶん積まれていない');
assert.equal(R1.recipe.steps.length,1,'R1 2回巻き戻して1手になっていない');
E.redo(R1);
assert.equal(JSON.stringify(R1.recipe),r2.recipe,'R1 1回めのやり直しで原本が戻らない');
assert.equal(R1.cache.hash,r2.hash,'R1 1回めのやり直しでハッシュが戻らない');
E.redo(R1);
assert.equal(JSON.stringify(R1.recipe),r3.recipe,'R1 2回めのやり直しで原本が戻らない');
assert.equal(R1.cache.hash,r3.hash,'R1 2回めのやり直しでハッシュが戻らない');
assert.deepEqual(R1.redoStack,[],'R1 やり直しきったのに残っている');
/* reference の差しかえ・faceId・layerPath・層・targets の並びまで、そのまま。 */
assert.deepEqual(rFaces(R1),r3.faces,'R1 faceId／layerPath／層がやり直しで変わった');
assert.equal(R1.recipe.steps[2].reference.faceId,JSON.parse(r3.recipe).steps[2].reference.faceId,'R1 reference が変わった');
assert.deepEqual(R1.recipe.steps[2].targets,JSON.parse(r3.recipe).steps[2].targets,'R1 targets の並びが変わった');
bondInvariant(R1,'R1');seamAudit(R1,'R1');
const dR1=discontinuity(R1);assert.equal(dR1.bad,0,`R1 やり直したあとに紙が破れた ${dR1.bad}/${dR1.tot}点`);

/* R2 巻き戻したあと新しく折ったら、やり直しの道は消える（分かれた歴史を持たない）。 */
const R2=tornFixture();E.undo(R2);
assert.equal(R2.redoStack.length,1,'R2 巻き戻した手が積まれていない');
pendCorner(R2,[-1,-1],[-.5,-.5],1);E.select(R2,ref(R2));E.confirm(R2);
assert.deepEqual(R2.redoStack,[],'R2 新しい手を確定したのに redoStack が残っている');
assert.throws(()=>E.redo(R2),/やり直す手順がありません/,'R2 消えたはずのやり直しができる');

/* R3 壊れたやり直しは原子的に断る＝原本も revision も cache も redoStack も1ミリも動かない。 */
const R3=tornFixture();E.undo(R3);
const b3=snap(R3),s3=JSON.stringify(R3.redoStack);
R3.redoStack[0].reference={faceId:'paper/そんな面はない'};
assert.throws(()=>E.redo(R3),/基準面がいまの紙にありません/,'R3 壊れた手をやり直してしまう');
same(snap(R3),b3,'R3 断ったとき');
assert.equal(R3.redoStack.length,1,'R3 断ったのに redoStack が減った');
const R3b=tornFixture();E.undo(R3b);const b3b=snap(R3b);
R3b.redoStack[0].movingSidePoint=[9,9];
assert.throws(()=>E.redo(R3b),/折る側の点が基準の面の外/,'R3b 書けない手をやり直してしまう');
same(snap(R3b),b3b,'R3b 断ったとき');
/* 結び・面の検査に引っかかる手も、原子的に断る（複数targetsから1枚落として裂ける選び方にする）。 */
const R3c=tornFixture();
pendCorner(R3c,[0,1],[-.45,.45],2);E.select(R3c,ref(R3c));E.confirm(R3c);
E.undo(R3c);const b3c=snap(R3c);
const drop3=R3c.redoStack[0].targets.find(t=>t.faceId!==R3c.redoStack[0].reference.faceId);
R3c.redoStack[0].targets=R3c.redoStack[0].targets.filter(t=>t.faceId!==drop3.faceId);/* 基準は残したまま、つながっている紙だけ落とす */
assert.throws(()=>E.redo(R3c),/置き去りになって裂けます/,'R3c 裂ける選び方をやり直してしまう');
same(snap(R3c),b3c,'R3c 断ったとき');
assert.equal(R3c.redoStack.length,1,'R3c 断ったのに redoStack が減った');
/* 手順の上限を超えるやり直しも断る。 */
const R3d=tornFixture();E.undo(R3d);
const capped3=Object.assign(Object.create(Object.getPrototypeOf(R3d)),R3d,
 {recipe:{...R3d.recipe,steps:Array.from({length:E.MAX_STEPS},()=>R3d.recipe.steps[0])}});
assert.throws(()=>E.redo(capped3),new RegExp(`${E.MAX_STEPS}手まで`),'R3d 上限を超えてやり直せる');

/* R4 候補(pending)があるあいだは、巻き戻しもやり直しもしない。 */
const R4=tornFixture();E.undo(R4);
pendCorner(R4,[-1,-1],[-.4,-.4],1);
assert.throws(()=>E.undo(R4),/確定か取消をしてから/,'R4 候補があるのに巻き戻せる');
assert.throws(()=>E.redo(R4),/確定か取消をしてから/,'R4 候補があるのにやり直せる');
assert.equal(R4.redoStack.length,1,'R4 断られたのに redoStack が動いた');
E.cancel(R4);
assert.equal(E.redo(R4).faces.length>0,true,'R4 取消したあとにやり直せない');
assert.equal(R4.recipe.steps.length,2,'R4 やり直しで2手に戻らない');

/* R5 保存する原本に、やり直しの情報は1文字も入らない。 */
const R5=tornFixture();E.undo(R5);
const saved5=E.verifiedRecipe(R5);
assert.equal('redoStack' in saved5,false,'R5 保存する原本に redoStack がある');
assert.equal(/redo/i.test(JSON.stringify(saved5)),false,'R5 保存JSONに redo の文字が混ざっている');
assert.equal(R5.redoStack.length,1,'R5 保存でやり直しの道が消えた');

/* R6 プレビュー・N切替・取消・保存では、やり直しの道は消えない。 */
const R6=tornFixture();E.undo(R6);const keep6=JSON.stringify(R6.redoStack);
pendCorner(R6,[-1,-1],[-.4,-.4],1);E.preview(R6,90);E.setLayers(R6,1);E.preview(R6,180);
assert.equal(JSON.stringify(R6.redoStack),keep6,'R6 プレビュー／N切替でやり直しの道が消えた');
E.cancel(R6);E.verifiedRecipe(R6);
assert.equal(JSON.stringify(R6.redoStack),keep6,'R6 取消／保存でやり直しの道が消えた');

/* R7 revision が増えるのは、成功した確定・巻き戻し・やり直しのときだけ。 */
const R7=E.create();
const g7=N.creaseForCorners(R7,[1,-1],[-.2,-.2],{requireInside:true});
E.proposeOnFace(R7,g7.line[0],g7.line[1],g7.faceId);R7.pending.kind='V';E.setSide(R7,g7.sidePoint);E.preview(R7,90);
assert.equal(R7.revision,0,'R7 プレビューで revision が動いた');
E.cancel(R7);assert.equal(R7.revision,0,'R7 取消で revision が動いた');
foldCorner(R7,[1,-1],[-.2,-.2]);assert.equal(R7.revision,1,'R7 確定で1つ増えない');
E.undo(R7);assert.equal(R7.revision,2,'R7 巻き戻しで増えない');
assert.throws(()=>E.undo(R7),/巻き戻す手順がありません/);assert.equal(R7.revision,2,'R7 失敗した巻き戻しで増えた');
E.redo(R7);assert.equal(R7.revision,3,'R7 やり直しで増えない');
assert.throws(()=>E.redo(R7),/やり直す手順がありません/);assert.equal(R7.revision,3,'R7 失敗したやり直しで増えた');
E.verifiedRecipe(R7);assert.equal(R7.revision,3,'R7 保存で増えた');

/* R8 画面は「やり直す」ボタンを持ち、engine の redo だけを呼ぶ（原文で見張る）。 */
const redoSrc=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.match(redoSrc,/id="redo"[^>]*>やり直す</,'R8 「やり直す」ボタンが無い');
assert.match(redoSrc,/redoBtn\.disabled=busy\|\|!state\.redoStack\.length/,'R8 候補がないときに無効になっていない');
assert.match(redoSrc,/undoBtn\.disabled=busy\|\|!state\.recipe\.steps\.length/,'R8 pending 中に巻き戻しが無効になっていない');
for(const m of redoSrc.matchAll(/E\.redo\(([^)]*)\)/g))
 assert.equal(m[1].replace(/\s/g,''),'state','R8 redo に state 以外を渡している: '+m[1]);
assert.equal(/redoStack\s*=/.test(redoSrc),false,'R8 画面が redoStack を書きかえている');

/* ========== E1群 原本の再生だけから決まる「外周辺ID」と「折り目の区間ID」（2026-09-12） ==========
   E2（辺を折り目へ合わせる）の土台。IDは**保存しない・持ち回らない**＝毎回いまの cache から作り直す。
   原本が同じなら、巻き戻しても やり直しても、同じIDが同じ順で出ることをここで固定する。 */
const idsOf=st=>({rims:E.rimEdges(st).map(e=>[e.edgeId,e.rimId,e.faceId,e.sheetId,JSON.stringify(e.srcSeg)]),
 creases:E.creaseIntervals(st).map(c=>[c.intervalId,c.stepId,c.index,c.faceId,c.bondId,c.sheetId,JSON.stringify(c.srcSeg)])});
/* ID1 まっさらな紙＝ふちは4本。名前はふちそのもの。 */
const D0=E.create();
assert.deepEqual(E.rimEdges(D0).map(e=>e.edgeId),
 ['rim:bottom|paper','rim:left|paper','rim:right|paper','rim:top|paper'],'ID1 初期のふちが4本でない');
assert.deepEqual(E.creaseIntervals(D0),[],'ID1 折り目が無いのに区間がある');
/* ID2 折っても折り目をつけても、ふちの名前は変わらず、区間だけが子へ受けつがれる。 */
const D1=creaseAt([-1,-.5],[1,-.5],[0,-.9]);/* 折り目 y=-0.5 */
const d1=E.rimEdges(D1);
assert.deepEqual(d1.map(e=>e.edgeId).slice().sort(),
 ['rim:bottom|paper/s1.cut','rim:left|paper/s1.cut','rim:left|paper/s1.keep',
  'rim:right|paper/s1.cut','rim:right|paper/s1.keep','rim:top|paper/s1.keep'],'ID2 ふちの継承が違う');
/* 親のふちは、子の区間に分かれても「長さの合計」が親のまま＝取りこぼしも重複もない。 */
for(const rim of['left','right']){
 const parts=d1.filter(e=>e.rimId===rim),len=parts.reduce((n,e)=>n+Math.hypot(e.srcSeg[1][0]-e.srcSeg[0][0],e.srcSeg[1][1]-e.srcSeg[0][1]),0);
 assert.equal(Math.abs(len-2)<1e-9,true,`ID2 ${rim} の区間の合計が親と違う: ${len}`);
 assert.equal(parts.length,2,`ID2 ${rim} が2区間に分かれていない`)}
for(const rim of['top','bottom'])assert.equal(d1.filter(e=>e.rimId===rim).length,1,`ID2 ${rim} が割れている`);
/* ID2b ★どんな紙でも、素材で見たふちの長さの合計は、もとの紙の一辺（2）のまま。
   折っても素材のふちは減らないので、ここが2でなくなったら「いまの座標」で見てしまっている合図。 */
const rimTotals=st=>{const t={bottom:0,right:0,top:0,left:0};
 for(const e of E.rimEdges(st))t[e.rimId]+=Math.hypot(e.srcSeg[1][0]-e.srcSeg[0][0],e.srcSeg[1][1]-e.srcSeg[0][1]);
 return t};
const D1b=E.create();foldCorner(D1b,[1,1],[-.8,-.45]);/* 動いた面のふちも、もとの紙のふちのまま */
const moved=E.rimEdges(D1b).filter(e=>e.faceId.endsWith('.cut'));
assert.equal(moved.length>0,true,'ID2b 動いた面のふちが1本も見つからない');
assert.equal(moved.every(e=>['bottom','right','top','left'].includes(e.rimId)),true,'ID2b 動いた面のふちの名前がおかしい');
for(const[tag,st]of[['s',s],['rep',rep],['a4',a4],['bst',bst],['h3',h3],['t4',t4],['k2',k2],['k3',k3],
 ['L1',L1],['M1',M1],['R1',R1],['D1',D1],['D1b',D1b]]){const t=rimTotals(st);
 for(const r of['bottom','right','top','left'])
  assert.equal(Math.abs(t[r]-2)<1e-9,true,`ID2b ${tag} の ${r} の素材の長さの合計が2でない: ${t[r]}`)}
/* ID3 折り目の区間は stepId と区間番号で名前がつく。あとの折りで切り分けられたら2区間になり、別のIDになる。 */
assert.deepEqual(E.creaseIntervals(D1).map(c=>[c.intervalId,c.faceId]),[['s1#1','paper/s1.keep']],'ID3 折り目の区間が1本でない');
const D2=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
foldCorner(D2,[1,1],[-.8,-.45]);/* 折り目をまたぐ角折り＝折り目が切り分けられる */
const ci=E.creaseIntervals(D2);
assert.equal(ci.length,2,'ID3 折り目が2区間に切り分けられていない: '+JSON.stringify(ci.map(c=>c.intervalId)));
assert.deepEqual(ci.map(c=>c.intervalId),['s1#1','s1#2'],'ID3 区間番号が振られていない');
assert.equal(new Set(ci.map(c=>c.faceId)).size,2,'ID3 2区間が同じ面のまま');
/* ⚠cache.creases の creaseId は切り分けで重複する＝そこを識別に使ってはいけない（この事実を固定しておく）。 */
assert.equal(new Set(D2.cache.creases.map(c=>c.creaseId)).size<D2.cache.creases.length,true,
 'ID3 cache.creases の creaseId が重複しなくなった（識別の前提が変わったので E1 を見直すこと）');
/* ID4 再生安定性：同じ原本なら、作り直しても・巻き戻して やり直しても、同じIDが同じ順で出る。 */
const fresh={...D2,cache:E.replay(D2.recipe)};
assert.deepEqual(idsOf(fresh),idsOf(D2),'ID4 原本を再生し直すとIDが変わる');
const idBefore=idsOf(D2);
E.undo(D2);const idMid=idsOf(D2);
assert.notDeepEqual(idMid,idBefore,'ID4 巻き戻しても同じID（検査の意味がない）');
E.redo(D2);
assert.deepEqual(idsOf(D2),idBefore,'ID4 やり直したらIDが戻らない（キャッシュから戻していないか確認）');
/* 2回呼んでも同じ＝並べ方が決まっている。 */
assert.deepEqual(idsOf(D2),idsOf(D2),'ID4 呼ぶたびに並びが変わる');
/* ID5 凍結した意図を、いまの紙で見つけ直す。面が割れたら、紙片と層経路と素材の重なりで絞る。 */
/* ①しぐさの最中（revision が同じ）＝ぴたり一致だけ。同じふちが複数の面に分かれていても取りちがえない。 */
const D3=creaseAt([-1,-.5],[1,-.5],[0,-.9]);/* 右辺が2区間に割れている紙 */
const upper=E.edgeIntent(D3,'paper/s1.keep','right'),lower=E.edgeIntent(D3,'paper/s1.cut','right');
assert.notDeepEqual(upper.srcSeg,lower.srcSeg,'ID5 右辺が2区間に分かれていない（検査の意味がない）');
assert.equal(E.resolveRimEdge(D3,upper).faceId,'paper/s1.keep','ID5 上の区間を取りちがえた');
assert.equal(E.resolveRimEdge(D3,lower).faceId,'paper/s1.cut','ID5 下の区間を取りちがえた');
assert.equal(E.resolveRimEdge(D3,{...upper,sheetId:'よその紙片'}),null,'ID5 別の紙片のふちを返した');
assert.equal(E.resolveRimEdge(D3,{...upper,layerPath:[{stepId:'s9',side:'cut'}]}),null,'ID5 別の層経路のふちを返した');
assert.equal('revision' in upper,true,'ID5 意図に revision が入っていない');
assert.deepEqual(E.edgeIntent(E.create(),'paper','right').srcSeg,[[1,-1],[1,1]],'ID5 初期の右辺が違う');
/* ②紙が進んだあと＝凍結した面の子へ橋渡しする（別の紙片へは決して行かない）。 */
const D3b=E.create();const want=E.edgeIntent(D3b,'paper','right');
foldCorner(D3b,[1,1],[-.8,-.45]);/* paper が割れる */
const got=E.resolveRimEdge(D3b,want);
assert.equal(!!got,true,'ID5 割れたあとに右辺を見つけ直せない');
assert.equal(got.rimId,'right','ID5 別のふちを返した');
assert.equal(got.faceId.startsWith('paper/'),true,'ID5 消えた親の面を返した');
assert.equal(E.resolveRimEdge(D3b,{...want,faceId:'よその面'}),null,'ID5 子でない面へ橋渡しした');
/* 折り目の区間も同じ。切り分けられても、素材の重なりで親から子を辿れる。 */
const D4=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
const cWant=E.creaseIntent(D4,'s1#1');
assert.equal(cWant.stepId,'s1');assert.equal(cWant.index,1);assert.equal(typeof cWant.bondId,'string');
assert.equal(E.resolveCreaseInterval(D4,cWant).intervalId,'s1#1','ID5 同じ紙で折り目を見つけ直せない');
assert.equal(E.resolveCreaseInterval(D4,{...cWant,sheetId:'よその紙片'}),null,'ID5 別の紙片の折り目を返した');
foldCorner(D4,[1,1],[-.8,-.45]);
const cGot=E.resolveCreaseInterval(D4,cWant);
assert.equal(!!cGot,true,'ID5 切り分けられた折り目を見つけ直せない');
assert.equal(cGot.stepId,'s1','ID5 別の手の折り目を返した');
assert.equal(E.resolveCreaseInterval(D4,{...cWant,faceId:'よその面'}),null,'ID5 子でない面へ橋渡しした');
/* ID6 見つからなければ null＝E2 はふつうの角折りへ戻せる。 */
assert.equal(E.resolveRimEdge(D4,{kind:'edge',rimId:'right',edgeId:'rim:right|そんな面',sheetId:'x',layerPath:[],srcSeg:[[9,9],[9,8]]}),null,'ID6 でたらめな意図に何か返した');
assert.equal(E.resolveRimEdge(D4,null),null,'ID6 null に落ちる');
assert.equal(E.resolveCreaseInterval(D4,null),null,'ID6 null に落ちる');
/* ID7 IDは原本にも保存にも digest にも漏れない＝pending の中だけの値。 */
const savedD=JSON.stringify(E.verifiedRecipe(D4));
for(const w of['rim:','intervalId','edgeId','sheetId'])
 assert.equal(savedD.includes(w),false,`ID7 保存する原本に ${w} が混ざっている`);
assert.equal(/rim:|intervalId|edgeId/.test(D4.cache.hash),false,'ID7 cache.hash に E1 のIDが混ざっている');

/* ========== E2群 外周辺を折り目へ合わせる（2026-09-12） ==========
   180°折り返したとき、つかんだ外周辺**ぜんぶ**が折り目の**区間の中**に乗る折りだけを候補にする。
   軸は平行なら中央の平行線、交わるなら角二等分線2本。選ぶのは「つかんだ所を折り返した先と指の画面px距離」。 */
/* ★E2-0 純幾何：角二等分線は2本とも出て、両方とも辺を折り目の線へ乗せる。選ぶのは指の近さ。 */
const ax0=E.axesEdgeToCrease([[0,0],[1,0]],[[0,-5],[0,5]]);
assert.equal(ax0.length,2,'E2-0 角二等分線が2本でない');
assert.deepEqual(ax0.map(a=>a.kind),['bisector','bisector'],'E2-0 種類が角二等分線でない');
const chk0=ax0.map(a=>E.checkEdgeToCrease(a.line,[[0,0],[1,0]],[[0,-5],[0,5]]));
assert.equal(chk0.every(c=>c.ok),true,'E2-0 どちらの角二等分線でも成立しない: '+JSON.stringify(chk0.map(c=>c.reason)));
assert.deepEqual(chk0.map(c=>c.reflected[1].map(v=>+v.toFixed(9))),[[0,1],[0,-1]],'E2-0 反射後の行き先が違う');
assert.equal(chk0.every(c=>Math.max(...c.ends)<1e-12),true,'E2-0 反射後の両端が折り目の線に乗らない');
/* 平行なら1本＝中央の平行線。同じ直線（自分自身）なら候補にしない。 */
assert.deepEqual(E.axesEdgeToCrease([[0,0],[1,0]],[[0,2],[1,2]]).map(a=>[a.kind,a.line[0][1]]),[['parallel',1]],'E2-0 中央の平行線が違う');
assert.deepEqual(E.axesEdgeToCrease([[0,0],[1,0]],[[0,0],[2,0]]),[],'E2-0 自分自身への一致を候補にした');
/* 角二等分線でない軸を与えたら、折り返しても折り目の線に乗らないので断る（この見張りが効いていること）。 */
assert.match(String(E.checkEdgeToCrease([[0,0],[1,.2]],[[0,0],[1,0]],[[0,-5],[0,5]]).reason),/乗りません/,'E2-0 折り目の線に乗らない軸を通した');
assert.equal(E.checkEdgeToCrease([[0,0],[0,0]],[[0,0],[1,0]],[[0,-5],[0,5]]).reason,'折軸が退化しています','E2-0 退化した軸を通した');
/* 微小な折りと、はみ出しは断る。 */
assert.match(String(E.checkEdgeToCrease([[0,.01],[1,.01]],[[0,0],[1,0]],[[0,.02],[1,.02]]).reason),/小さすぎ/,'E2-0 微小な折りを通した');
assert.match(String(E.checkEdgeToCrease(ax0[0].line,[[0,0],[1,0]],[[0,0],[0,.5]]).reason),/収まりません/,'E2-0 はみ出しを通した');

/* ★E2-1 平行：折り目 x=0.5 に、右辺(x=1)を合わせる＝軸は x=0.75。 */
function creaseVertical(){const st=E.create();
 const gb=N.grab(st,S([1,.3]),V),t=N.edgeTarget(gb,S([0,.3]),[0,.3],V,false),cr=N.creaseForEdge(st,gb,t.target);
 E.proposeOnFace(st,cr.line[0],cr.line[1],gb.faceId);st.pending.kind='V';E.setSide(st,cr.sidePoint);
 E.select(st,ref(st));E.confirm(st,{op:'crease'});return st}
const F1=creaseVertical();
const fe=E.rimEdges(F1).find(e=>e.rimId==='right'),fi=E.edgeIntent(F1,fe.faceId,'right');
const fo=E.edgeToCreaseOptions(F1,fi);
assert.equal(fo.options.length,1,'E2-1 候補が1本でない: '+JSON.stringify(fo.options.map(o=>[o.target.intervalId,o.kind,o.reason])));
const o1=fo.options[0];
assert.equal(o1.ok,true,'E2-1 成立しない: '+o1.reason);
assert.equal(o1.kind,'parallel','E2-1 平行でない');
assert.equal(o1.target.intervalId,'s1#1','E2-1 合わせ先が違う');
assert.equal(Math.abs(o1.axis[0][0]-.75)<1e-9&&Math.abs(o1.axis[1][0]-.75)<1e-9,true,'E2-1 軸が x=0.75 でない: '+JSON.stringify(o1.axis));
assert.equal(Math.max(...o1.ends)<1e-9,true,'E2-1 反射後の両端が折り目の線に乗らない: '+o1.ends);
assert.deepEqual(o1.reflected.map(p=>p.map(v=>+v.toFixed(9))),[[.5,-1],[.5,1]],'E2-1 反射後の位置が違う');
assert.equal(o1.span[0]>=-1e-9&&o1.span[1]<=1+1e-9,true,'E2-1 折り目の区間からはみ出す: '+JSON.stringify(o1.span));
/* 確定：原本に残るのは line／movingSidePoint／reference／targets だけ。入力の意図は1文字も入らない。 */
E.proposeOnFace(F1,o1.axis[0],o1.axis[1],fe.faceId,{layers:1});F1.pending.kind='V';E.setSide(F1,o1.sidePoint);
E.select(F1,ref(F1));
E.confirm(F1,{edgeToCrease:{edge:fi,crease:E.creaseIntent(F1,o1.target.intervalId)}});
assert.equal(F1.recipe.steps.length,2,'E2-1 確定できない');
const fstep=F1.recipe.steps[1];
assert.deepEqual(Object.keys(fstep).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'E2-1 原本の項目が増えた: '+Object.keys(fstep));
for(const w of['rim:','intervalId','edgeId','sheetId','srcSeg','intent'])
 assert.equal(JSON.stringify(F1.recipe).includes(w),false,`E2-1 原本に ${w} が混ざっている`);
assert.deepEqual(fstep.line.map(p=>p.map(v=>+v.toFixed(9))),[[.75,-1],[.75,1]],'E2-1 記録した折線が違う: '+JSON.stringify(fstep.line));
/* 折り返した右辺が、折り目の上にぴたりと乗っている。 */
const afterF1=E.rimEdges(F1).find(e=>e.rimId==='right'&&e.faceId.startsWith(fe.faceId));
assert.equal(afterF1.seg.every(p=>Math.abs(p[0]-.5)<1e-9),true,'E2-1 折ったあと右辺が折り目(x=0.5)に乗っていない: '+JSON.stringify(afterF1.seg));
const dF1=discontinuity(F1);assert.equal(dF1.bad,0,`E2-1 紙が破れた ${dF1.bad}/${dF1.tot}点`);
bondInvariant(F1,'F1');seamAudit(F1,'F1');
const hF1=F1.cache.hash;E.undo(F1);E.redo(F1);
assert.equal(F1.cache.hash,hF1,'E2-1 やり直しでハッシュが戻らない');

/* ★E2-2 非平行：斜めの折り目へ下辺を合わせる＝角二等分線が選ばれ、はみ出す方は断られる。 */
const F2=creaseAt([-1,-1],[1,1],[.6,-.6]);
const f2e=E.rimEdges(F2).find(e=>e.rimId==='bottom'),f2i=E.edgeIntent(F2,f2e.faceId,'bottom');
const f2o=E.edgeToCreaseOptions(F2,f2i);
assert.equal(f2o.options.length,2,'E2-2 角二等分線が2本出ていない: '+JSON.stringify(f2o.options.map(o=>o.kind)));
const good2=f2o.options.filter(o=>o.ok);
assert.equal(good2.length,1,'E2-2 成立するのが1本でない: '+JSON.stringify(f2o.options.map(o=>[o.kind,o.ok,o.reason])));
assert.equal(good2[0].kind,'bisector','E2-2 角二等分線でない');
assert.equal(Math.max(...good2[0].ends)<1e-9,true,'E2-2 反射後の両端が折り目に乗らない');
assert.match(String(f2o.options.find(o=>!o.ok).reason),/収まりません|乗りません/,'E2-2 断る理由が違う');
const ang2=Math.atan2(good2[0].axis[1][1]-good2[0].axis[0][1],good2[0].axis[1][0]-good2[0].axis[0][0])*180/Math.PI;
assert.equal(Math.abs(((ang2%180)+180)%180-22.5)<1e-6,true,'E2-2 角二等分線の角度が違う: '+ang2);
E.proposeOnFace(F2,good2[0].axis[0],good2[0].axis[1],f2e.faceId,{layers:1});F2.pending.kind='V';E.setSide(F2,good2[0].sidePoint);
for(const a of[0,90,180]){const t=ghostTear(F2,a);assert.equal(t.bad,0,`E2-2 ${a}度でゴーストが破れた`)}
E.select(F2,ref(F2));E.confirm(F2,{edgeToCrease:{edge:f2i,crease:E.creaseIntent(F2,good2[0].target.intervalId)}});
const dF2=discontinuity(F2);assert.equal(dF2.bad,0,`E2-2 紙が破れた ${dF2.bad}/${dF2.tot}点`);
seamAudit(F2,'F2');

/* ★E2-3 吸着＝つかんだ所(t)を折り返した先と指の画面px。26pxで入り、44pxまで維持。 */
const F3=creaseVertical();
const f3e=E.rimEdges(F3).find(e=>e.rimId==='right');
const src3={intent:E.edgeIntent(F3,f3e.faceId,'right'),grabT:.5};
const land3=[.5,0];
const aimAt=(d,snapped)=>N.edgeToCreaseAim(F3,src3,[V.toScreen(land3)[0]+d,V.toScreen(land3)[1]],V,snapped);
assert.equal(!!aimAt(0,false).aim,true,'E2-3 ぴたりでも吸着しない');
assert.deepEqual(aimAt(0,false).aim.grabTo.map(v=>Math.round(v*1e9)/1e9+0),[.5,0],'E2-3 折り返した先が違う');
assert.deepEqual(aimAt(0,false).aim.grabPoint.map(v=>Math.round(v*1e9)/1e9+0),[1,0],'E2-3 つかんだ所(t=0.5)が違う');
assert.equal(!!aimAt(26,false).aim,true,'E2-3 26pxで入らない');
assert.equal(!!aimAt(27,false).aim,false,'E2-3 27pxで入ってしまう');
assert.equal(!!aimAt(44,true).aim,true,'E2-3 吸着中に44pxで離れてしまう');
assert.equal(!!aimAt(45,true).aim,false,'E2-3 45pxでも離れない');
/* つかんだ所(t)で測っている＝辺の中点ではない。 */
const src3b={intent:E.edgeIntent(F3,f3e.faceId,'right'),grabT:.25},land3b=[.5,-.5];
const a3b=N.edgeToCreaseAim(F3,src3b,V.toScreen(land3b),V,false);
assert.equal(!!a3b.aim,true,'E2-3 t=0.25 で吸着しない');
assert.deepEqual(a3b.aim.grabPoint.map(v=>Math.round(v*1e9)/1e9+0),[1,-.5],'E2-3 t=0.25 のつかんだ所が違う');
assert.deepEqual(a3b.aim.grabTo.map(v=>Math.round(v*1e9)/1e9+0),[.5,-.5],'E2-3 t=0.25 の折り返した先が違う');
assert.equal(!!N.edgeToCreaseAim(F3,{intent:src3b.intent,grabT:.5},V.toScreen(land3b),V,false).aim,false,
 'E2-3 つかんだ所(t)でなく辺の中点で測っている');
const V2={toScreen:p=>{const c=Math.cos(.7),s2=Math.sin(.7);return[(p[0]*c-p[1]*s2)*390,-(p[0]*s2+p[1]*c)*390*.52]}};
const aim2=(d,snapped)=>N.edgeToCreaseAim(F3,src3,[V2.toScreen(land3)[0]+d,V2.toScreen(land3)[1]],V2,snapped);
assert.equal(!!aim2(26,false).aim,true,'E2-3 カメラを変えたら26pxで入らない');
assert.equal(!!aim2(27,false).aim,false,'E2-3 カメラを変えたら27pxで入ってしまう');
assert.equal(aim2(0,false).aim.target.intervalId,aimAt(0,false).aim.target.intervalId,'E2-3 カメラで合わせ先が変わった');
const bF3=snap(F3);assert.equal(aimAt(200,false).aim,null,'E2-3 遠くでも吸着した');same(snap(F3),bF3,'E2-3 狙っただけのとき');

/* ★E2-4 断るもの：折り目が無い／別の紙片。 */
const F4=E.create();
foldCorner(F4,[1,1],[-.8,-.45]);
const f4e=E.rimEdges(F4).find(e=>e.faceId.endsWith('.cut'));
assert.equal(E.edgeToCreaseOptions(F4,E.edgeIntent(F4,f4e.faceId,f4e.rimId)).options.length,0,'E2-4 折り目が無いのに候補が出た');
const F5=creaseVertical();foldCorner(F5,[-1,-1],[-.4,-.4]);
assert.equal(new Set(E.rimEdges(F5).map(e=>e.sheetId)).size>1,true,'E2-4 紙片が2つになっていない（検査の意味がない）');
/* 🚨紙片(sheetId)の一致は必須ではない（E2-6）。見るのは**原紙(faceId の根)**。 */
for(const e of E.rimEdges(F5)){const opt=E.edgeToCreaseOptions(F5,E.edgeIntent(F5,e.faceId,e.rimId));
 assert.equal(opt.options.every(o=>E.paperRootOf(o.target.faceId)===E.paperRootOf(e.faceId)),true,'E2-4 別の原紙の折り目が候補に入った')}

/* ★E2-5 確定の再検証：凍結した意図から軸を作り直して突き合わせる。合わないものは原子的に断る。 */
const F6=creaseVertical();
const f6e=E.rimEdges(F6).find(e=>e.rimId==='right'),f6i=E.edgeIntent(F6,f6e.faceId,'right');
const o6=E.edgeToCreaseOptions(F6,f6i).options[0],c6=E.creaseIntent(F6,o6.target.intervalId);
assert.equal(E.verifyEdgeToCrease(F6,f6i,c6,o6.axis[0],o6.axis[1]).ok,true,'E2-5 正しい軸を断った');
assert.match(String(E.verifyEdgeToCrease(F6,f6i,c6,[.6,-1],[.6,1]).reason),/作り直せません/,'E2-5 でたらめな軸を通した');
E.proposeOnFace(F6,[.6,-1],[.6,1],f6e.faceId,{layers:1});F6.pending.kind='V';E.setSide(F6,[.9,0]);E.select(F6,ref(F6));
const b6=snap(F6);
assert.throws(()=>E.confirm(F6,{edgeToCrease:{edge:f6i,crease:c6}}),/作り直せません/,'E2-5 合っていない軸で確定できた');
same(snap(F6),b6,'E2-5 断ったとき');
assert.equal(F6.redoStack.length,0,'E2-5 断ってredoStackが動いた');
E.cancel(F6);

/* ★E2-6 本命：白い三角形の左辺を、**別の紙片にある「中央の長い折り目」**へ合わせる（2026-09-12）。
   紙片(sheetId)の一致は必須にしない。**同じ原紙(faceId の根)**なら合わせ先にする。
   ⚠ここは「下の層に見えている折り目へ辺を合わせる」＝折り紙のふつうの目印。判定は1つも緩めていない。 */
function whiteFlapFixture(to){const st=E.create();
 const gb=N.grab(st,S([1,.3]),V),t=N.edgeTarget(gb,S([-.99,.3]),[-.99,.3],V,false),cr=N.creaseForEdge(st,gb,t.target);
 E.proposeOnFace(st,cr.line[0],cr.line[1],gb.faceId);st.pending.kind='V';E.setSide(st,cr.sidePoint);
 E.select(st,ref(st));E.confirm(st,{op:'crease'});/* 中央の縦の折り目 x=0 */
 pendCorner(st,[1,1],to,1);E.select(st,ref(st));E.confirm(st);/* 白い三角形ができる */
 return st}
/* E2-6a 幾何としては成立する（軸 x=-0.2・反射後 [[0,-0.4],[0,0.6]]）が、動く側に**別の紙のヒンジ**が
   残るので engine が正しく断る＝安全側の関門は1つも緩んでいない。 */
const Wa=whiteFlapFixture([-.4,-.4]);
const waEdge=E.rimEdges(Wa).find(e=>e.edgeId==='rim:top|paper/s1.cut/s2.cut');
const waIntent=E.edgeIntent(Wa,waEdge.faceId,'top');
const wao=E.edgeToCreaseOptions(Wa,waIntent).options.filter(o=>o.ok);
assert.equal(wao.length,1,'E2-6a 候補が1本でない');
assert.equal(wao[0].sameSheet,false,'E2-6a 同じ紙片になっている');
assert.equal(wao[0].axis.every(q=>Math.abs(q[0]+.2)<1e-9),true,'E2-6a 折軸が x=-0.2 でない: '+JSON.stringify(wao[0].axis));
assert.deepEqual(wao[0].reflected.map(q=>q.map(v=>Math.round(v*1e9)/1e9+0)),[[0,-.4],[0,.6]],'E2-6a 反射後の辺が違う');
const waBefore=snap(Wa);
E.proposeOnFace(Wa,wao[0].axis[0],wao[0].axis[1],waEdge.faceId,{layers:1});Wa.pending.kind='V';E.setSide(Wa,wao[0].sidePoint);
assert.throws(()=>E.preview(Wa,180),/切り離されます/,'E2-6a 結びが裂ける折りを通した');
E.cancel(Wa);same(snap(Wa),waBefore,'E2-6a 断ったとき');

/* ★E2-6 本命：白い三角形の左辺を、**別の紙片にある「中央の長い折り目」**へ合わせて、実際に折る。 */
const W=whiteFlapFixture([-.8,.4]);
const wEdge=E.rimEdges(W).find(e=>e.edgeId==='rim:top|paper/s1.cut/s2.cut');
assert.equal(!!wEdge,true,'E2-6 白い三角形の左辺が無い');
assert.equal(E.detXf(W.cache.faces.find(f=>f.faceId===wEdge.faceId).xf)<0,true,'E2-6 その面が裏(白)でない');
const wWhite=W.cache.faces.filter(f=>E.detXf(f.xf)<0).map(f=>f.faceId);
const wLeft=E.rimEdges(W).filter(e=>wWhite.includes(e.faceId))
 .sort((a,b)=>S([(a.seg[0][0]+a.seg[1][0])/2,0])[0]-S([(b.seg[0][0]+b.seg[1][0])/2,0])[0])[0];
assert.equal(wLeft.edgeId,wEdge.edgeId,'E2-6 画面でいちばん左のふちが違う: '+wLeft.edgeId);
assert.deepEqual(wEdge.seg.map(q=>q.map(v=>Math.round(v*1e9)/1e9+0)),[[-.8,.4],[0,1]],'E2-6 左辺の現在座標が違う');
const wIntent=E.edgeIntent(W,wEdge.faceId,'top');
const wAll=E.edgeToCreaseOptions(W,wIntent).options,wOpt=wAll.filter(o=>o.ok);
assert.equal(wOpt.length,1,'E2-6 成立する候補が1本でない: '+JSON.stringify(wAll.map(o=>[o.target.intervalId,o.ok,o.reason])));
const wo=wOpt[0];
assert.equal(wo.target.intervalId,'s1#1','E2-6 合わせ先が中央の長い折り目でない');
assert.deepEqual(wo.target.seg.map(q=>q.map(v=>Math.round(v*1e9)/1e9+0)),[[0,-1],[0,1]],'E2-6 中央の折り目の位置が違う');
assert.equal(wo.sameSheet,false,'E2-6 同じ紙片になっている（検査の意味がない）');
assert.notEqual(wo.target.sheetId,wEdge.sheetId,'E2-6 sheetId が同じ');
assert.equal(E.paperRootOf(wo.target.faceId),E.paperRootOf(wEdge.faceId),'E2-6 原紙が違う');
assert.equal(wo.kind,'bisector','E2-6 角二等分線でない');
assert.deepEqual(wo.reflected.map(q=>q.map(v=>Math.round(v*1e9)/1e9+0)),[[0,0],[0,1]],'E2-6 180°反射後の辺が違う');
assert.equal(Math.max(...wo.ends)<1e-9,true,'E2-6 両端が折り目の線に乗らない: '+wo.ends);
assert.equal(wo.span[0]>=-1e-9&&wo.span[1]<=1+1e-9,true,'E2-6 折り目の区間からはみ出す: '+JSON.stringify(wo.span));
const wSrc={intent:wIntent,grabT:.5},wLand=[0,.5];
const wAim=(d,sn)=>N.edgeToCreaseAim(W,wSrc,[V.toScreen(wLand)[0]+d,V.toScreen(wLand)[1]],V,sn);
assert.equal(!!wAim(0,false).aim,true,'E2-6 ぴたりでも吸着しない: '+wAim(0,false).reason);
assert.equal(wAim(0,false).aim.target.intervalId,'s1#1','E2-6 別の折り目に吸着した');
assert.deepEqual(wAim(0,false).aim.grabTo.map(v=>Math.round(v*1e9)/1e9+0),[0,.5],'E2-6 折り返した先が違う');
assert.equal(!!wAim(26,false).aim,true,'E2-6 26pxで入らない');
assert.equal(!!wAim(27,false).aim,false,'E2-6 27pxで入ってしまう');
assert.equal(!!wAim(44,true).aim,true,'E2-6 44pxで離れてしまう');
assert.equal(!!wAim(45,true).aim,false,'E2-6 45pxでも離れない');
assert.equal(wAim(300,false).reason,null,'E2-6 遠いだけなのに理由を出した');
E.proposeOnFace(W,wo.axis[0],wo.axis[1],wEdge.faceId,{layers:1});W.pending.kind='V';E.setSide(W,wo.sidePoint);
for(const a of[0,90,180]){const tt=ghostTear(W,a);assert.equal(tt.bad,0,'E2-6 '+a+'度でゴーストが破れた '+tt.bad+'点')}
E.select(W,ref(W));
E.confirm(W,{edgeToCrease:{edge:wIntent,crease:E.creaseIntent(W,wo.target.intervalId)}});
assert.equal(W.recipe.steps.length,3,'E2-6 確定できない');
assert.deepEqual(Object.keys(W.recipe.steps[2]).slice().sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'E2-6 原本の項目が増えた');
for(const w of['rim:','intervalId','edgeId','sheetId','intent'])
 assert.equal(JSON.stringify(W.recipe).includes(w),false,'E2-6 原本に '+w+' が混ざっている');
const dW=discontinuity(W);assert.equal(dW.bad,0,'E2-6 紙が破れた '+dW.bad+'/'+dW.tot+'点');
bondInvariant(W,'W');seamAudit(W,'W');
const wAfter=E.rimEdges(W).filter(e=>e.rimId==='top'&&e.faceId.startsWith(wEdge.faceId));
assert.equal(wAfter.some(e=>e.seg.every(q=>Math.abs(q[0])<1e-9)),true,
 'E2-6 折ったあと左辺が中央の折り目(x=0)に乗っていない: '+JSON.stringify(wAfter.map(e=>e.seg)));
const hW=W.cache.hash;E.undo(W);E.redo(W);
assert.equal(W.cache.hash,hW,'E2-6 やり直しでハッシュが戻らない');
assert.equal(JSON.stringify(E.verifiedRecipe(W)).includes('rim:'),false,'E2-6 保存する原本に入力の意図が混ざっている');

/* ★E2-7 別の「原紙」の折り目は候補にしない＝単なる continue 削除ではなく、faceId の根で確かめる。 */
assert.equal(E.paperRootOf('paper/s1.cut/s2.cut'),'paper','E2-7 原紙のIDの出し方が違う');
const W2=whiteFlapFixture([-.8,.4]),w2i=E.edgeIntent(W2,wEdge.faceId,'top');
const alienFace={faceId:'washi',layerPath:[],poly:[[2,-1],[3,-1],[3,1],[2,1]],xf:[1,0,0,1,0,0],layer:0};
const alienCrease={creaseId:'c-w-1',stepId:'s1',faceId:'washi',seg:[[2.5,-1],[2.5,1]],kind:'V'};
const W2a={...W2,cache:{...W2.cache,faces:[...W2.cache.faces,alienFace],creases:[...W2.cache.creases,alienCrease]}};
assert.equal(E.creaseIntervals(W2a).some(c=>c.faceId==='washi'),true,'E2-7 別の原紙の折り目を置けていない（検査の意味がない）');
assert.equal(E.edgeToCreaseOptions(W2a,w2i).options.some(o=>o.target.faceId==='washi'),false,'E2-7 別の原紙の折り目が候補に入った');

/* ★E2-8 同じ幾何軸・同じ線分を指す重複候補は1件にまとめる（同じ折りを二度数えない）。 */
const dupCrease={creaseId:'c-dup',stepId:'s1',faceId:'paper/s1.keep',seg:[[0,-1],[0,1]],kind:'V'};
const W2b={...W2,cache:{...W2.cache,creases:[...W2.cache.creases,dupCrease]}};
assert.equal(E.edgeToCreaseOptions(W2b,w2i).options.filter(o=>o.ok).length,2,'E2-8 重複した候補が2本になっていない（検査の意味がない）');
const dupAim=N.edgeToCreaseAim(W2b,{intent:w2i,grabT:.5},V.toScreen([0,.5]),V,false);
assert.equal(!!dupAim.aim,true,'E2-8 重複を曖昧と取りちがえた: '+dupAim.reason);
assert.equal(dupAim.hints.length,1,'E2-8 重複が1件にまとまっていない: '+JSON.stringify(dupAim.hints.map(h=>h.intervalId)));

/* ★E2-9 別々の紙片に同じ近さで別の軸ができたら、紙片が違っても決めない（順番で黙って選ばない）。 */
const rivalCrease={creaseId:'c-rival',stepId:'s1',faceId:'paper/s1.cut/s2.keep',seg:[[.15,-1],[.15,1]],kind:'V'};
const W2c={...W2,cache:{...W2.cache,creases:[...W2.cache.creases,rivalCrease]}};
const tieAim=N.edgeToCreaseAim(W2c,{intent:w2i,grabT:.5},V.toScreen([.075,.4625]),V,false);
assert.equal(tieAim.aim,null,'E2-9 同点の別軸なのに1件を選んだ');
assert.match(String(tieAim.reason),/合わせる折り目を特定できません/,'E2-9 曖昧の理由が違う: '+tieAim.reason);
/* 同じ紙片の候補があれば、そちらを優先して決まる。 */
const mineCrease={creaseId:'c-mine',stepId:'s1',faceId:'paper/s1.cut/s2.cut',seg:[[.15,-1],[.15,1]],kind:'V'};
const W2d={...W2,cache:{...W2.cache,creases:[...W2.cache.creases,mineCrease]}};
const preferAim=N.edgeToCreaseAim(W2d,{intent:w2i,grabT:.5},V.toScreen([.075,.4625]),V,false);
assert.equal(!!preferAim.aim,true,'E2-9 同じ紙片を優先できていない: '+preferAim.reason);
assert.equal(preferAim.aim.sameSheet,true,'E2-9 優先されたのが同じ紙片でない');

/* ★E2-10 候補が本当に0件のときの言い方。 */
const none=N.edgeToCreaseAim(E.create(),{intent:E.edgeIntent(E.create(),'paper','right'),grabT:.5},[0,0],V,false);
assert.equal(none.aim,null,'E2-10 折り目が無いのに吸着した');
assert.equal(none.reason,'この辺を合わせられる折り目がありません','E2-10 言い方が違う: '+none.reason);
/* 幾何の候補はあるが指が遠いときに理由を出さないことは、E2-6 の中で確かめている。 */

/* ============ P（🖊 折り目の自由入力）＝任意の2点で crease を引く ============
   決めごと（本人指示 2026-09-12）
   ①作るのは op:'crease' だけ。②紙は0°のまま動かさない。③movingSidePoint は画面で選ばせず
   engine の `creaseSidePoint` が決定論的に作る。④作れなければ提案しない（丸めもクランプもしない）。
   ⑤2点は線の向きだけを決める＝折り目は紙片のふちからふちまで通る。⑥引いた折り目は、そのあとの
   角折り・辺合わせの吸着先になる。⑦線モードの中では fold へ切りかえない（原文で見張る＝P6）。 */
const Pp=q=>[q[0]/240,-q[1]/240];/* この検査だけの画面→紙（V の逆。engine も入力層も逆変換は持たない）。 */
/* ★P0 creaseSidePoint 単体。両側でいちばん深い点を選び、同じ答えを返す（呼ぶ順にも折線の向きにもよらない）。
   期待値は samplesOf（重心＋頂点を6割寄せ）＋「同じ深さなら x,y の小さい方」から決まる＝ここを固定する。 */
const p0=E.create(),pf0=p0.cache.faces[0].poly;
const sp0=E.creaseSidePoint(p0,'paper',[0,-1],[0,1]);
assert.deepEqual(rd(sp0.point),[-.8,-.6],'P0 いちばん深い点を選んでいない');
assert.equal(E.inside(sp0.point,pf0),true,'P0 作った点が基準面の外');
assert.equal(Math.abs(E.side(sp0.point,[0,-1],[0,1]))>.03,true,'P0 折線に近すぎる点を作った');
assert.deepEqual(E.creaseSidePoint(p0,'paper',[0,1],[0,-1]).point,sp0.point,'P0 折線の向きで答えが変わる');
assert.deepEqual(E.creaseSidePoint(p0,'paper',[0,-1],[0,1]).point,sp0.point,'P0 2回呼ぶと答えが変わる');
assert.deepEqual(rd(E.creaseSidePoint(p0,'paper',[-1,.5],[1,.5]).point),[-.6,-.7],'P0 かたよった折線で深い側を選んでいない');
assert.match(E.creaseSidePoint(p0,'paper',[1,-1],[1,1]).reason,/二つに分けていません/,'P0 面を分けない線を通した');
assert.match(E.creaseSidePoint(p0,'none',[0,-1],[0,1]).reason,/いまの紙にありません/,'P0 無い面を通した');
/* 小さすぎる面では「記録できる点」が作れない＝断る。setSide／recordable の .03 と同じ物差し。 */
const tinyState={cache:{faces:[{faceId:'tiny',poly:[[0,0],[.1,0],[.1,.1],[0,.1]],xf:[1,0,0,1,0,0],layer:0}]}};
const spTiny=E.creaseSidePoint(tinyState,'tiny',[0,.05],[.1,.05]);
assert.equal(spTiny.point,null,'P0 小さすぎる面で点を作ってしまった');
assert.match(spTiny.reason,/近すぎて/,'P0 断る理由が違う: '+spTiny.reason);
/* 画面と同じ順に engine を呼ぶ（pointerdown で始点を凍結 → 2点目を吸着 → 線 → 提案 → 折る側 → 0°）。 */
function lineDraw(st,startPaper,endPaper,kind='V'){
 const start=N.freeCreaseStart(st,V.toScreen(startPaper),startPaper,V);
 if(!start.point)throw Error('引きはじめられません');
 const src=Object.freeze({type:'line',point:start.point,faceId:start.faceId,guides:start.guides,corners:start.corners});
 const aim=N.linePointAim(src.corners,src.guides,V.toScreen(endPaper),endPaper,V,false);
 const cr=N.freeCreaseLine(st,src,aim.point);
 E.proposeOnFace(st,cr.line[0],cr.line[1],cr.faceId,{layers:1});
 st.pending.kind=kind;E.setSide(st,cr.sidePoint);
 return{start,src,aim,cr,geom:E.preview(st,0)}}
const lineCommit=(st,a,b,kind)=>{const r=lineDraw(st,a,b,kind);
 E.select(st,st.pending.candidates);E.confirm(st,{op:'crease'});return r};
/* ★P1 本命＝平らな紙で、角から角へ対角の折り目を引く。 */
const FC=E.create(),pd1=lineDraw(FC,[-.95,-.95],[.95,.95]);
assert.deepEqual(rd(pd1.start.point),[-1,-1],'P1 引きはじめが紙の角に吸いつかない');
assert.equal(pd1.start.snapKind,'corner','P1 引きはじめの吸着が紙の角でない');
assert.deepEqual(rd(pd1.aim.point),[1,1],'P1 もう一方が紙の角に吸いつかない');
assert.equal(pd1.aim.snapKind,'corner','P1 もう一方の吸着が紙の角でない');
assert.deepEqual(rd(pd1.cr.line[0]).concat(rd(pd1.cr.line[1])),[-1,-1,1,1],'P1 折線が角から角まででない');
/* 紙は0°のまま＝「動く側」も1ミリも動いていない（crease は形を変えない）。 */
assert.equal(pd1.geom.angle,0,'P1 プレビューが0°でない');
for(const part of pd1.geom.parts)if(part.move)part.move.forEach((q,i)=>{
 assert.equal(Math.abs(q[0]-part.moveSrc[i][0])<1e-12&&Math.abs(q[1])<1e-12&&Math.abs(q[2]+part.moveSrc[i][1])<1e-12,
  true,'P1 0°なのに紙が動いた')});
E.select(FC,FC.pending.candidates);E.confirm(FC,{op:'crease'});
const stP1=FC.recipe.steps[0];
assert.equal(FC.recipe.steps.length,1);
assert.equal(stP1.op,'crease','P1 op が crease でない');
assert.deepEqual(Object.keys(stP1).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],
 'P1 原本の項目が増えた: '+Object.keys(stP1));
assert.deepEqual(rd(stP1.line[0]).concat(rd(stP1.line[1])),[-1,-1,1,1],'P1 原本の折線が角から角まででない');
assert.equal(N.isFlat(FC),true,'P1 crease なのに紙が平らでない');
assert.equal(FC.cache.faces.length,2,'P1 面が2枚に割れていない');
assert.equal(FC.cache.creases.length,1,'P1 折り目が1本残っていない');
assert.equal(FC.cache.hinges.length,0,'P1 crease なのにヒンジができた');
const cseg=FC.cache.creases[0].seg;
assert.equal(Math.abs(Math.hypot(cseg[1][0]-cseg[0][0],cseg[1][1]-cseg[0][1])-2*Math.SQRT2)<1e-9,true,
 'P1 折り目がふちからふちまで通っていない');
/* 巻き戻し→やり直しで、原本もハッシュも完全に戻る（原本だけを積む決まりのまま）。 */
const hashP1=FC.cache.hash;E.undo(FC);assert.equal(FC.cache.creases.length,0,'P1 巻き戻せていない');
E.redo(FC);assert.equal(FC.cache.hash,hashP1,'P1 やり直しで元に戻らない');
assert.equal(E.verifiedRecipe(FC).steps.length,1);
/* ★P2 2点は「線の向き」だけを決める＝紙の内側の短い2点でも、折り目は紙片のふちからふちまで通る。 */
const FC2=E.create(),d2=lineDraw(FC2,[-.3,-.3],[.3,.3]);
assert.equal(d2.start.snapped,false,'P2 遠いのに引きはじめが吸着した');
assert.deepEqual(rd(d2.start.point),[-.3,-.3]);
assert.equal(d2.aim.snapped,false,'P2 遠いのに2点目が吸着した');
assert.deepEqual(rd(d2.cr.line[0]).concat(rd(d2.cr.line[1])),[-1,-1,1,1],
 'P2 2点の間だけの短い折線になっている（紙片のふちまで通っていない）');
E.cancel(FC2);assert.equal(FC2.recipe.steps.length,0);
/* ★P3 吸着＝26px入る／44px離れる（角・辺と同じつまみ）。順位は 交点 > 紙の角 > 折り目の端 > 線上。 */
const FC3=E.create(),sh3=E.sheetOf(FC3,'paper'),gd3=N.guidesOf(FC3,sh3),vx3=N.sheetVertices(sh3);
const cs3=V.toScreen([-1,-1]);
const aim3=(px,snapped)=>{const sc=[cs3[0]+px/Math.SQRT2,cs3[1]-px/Math.SQRT2];
 return N.linePointAim(vx3,gd3,sc,Pp(sc),V,snapped)};
assert.equal(aim3(26,false).snapKind,'corner','P3 26pxで紙の角に入らない');
assert.deepEqual(rd(aim3(26,false).point),[-1,-1]);
assert.equal(aim3(27,false).snapKind,'line','P3 27pxで紙の角から離れない');
assert.equal(aim3(44,true).snapKind,'corner','P3 44pxまで紙の角を保てない');
assert.equal(aim3(45,true).snapKind,'line','P3 45pxで紙の角から離れない');
/* 紙の角を足したのは線モードだけ＝角折りの「隣の角へは吸いつかない」は1つも変えていない。 */
const g3c=N.grab(FC3,V.toScreen([1,-1]),V);
const n3=N.foldTarget(FC3,g3c,V.toScreen([.96,.96]),[.96,.96],V,false);/* 隣の角(1,1)のすぐそば */
assert.equal(n3.snapKind==='corner',false,'P3 角折りが隣の角に吸いついた（線モードの候補が漏れている）');
assert.equal(rd(n3.target).join()==='1,1',false,'P3 角折りの行き先が隣の角になった');
/* 対角（原点対称の角）だけは今までどおり吸いつく。 */
const dg3=N.foldTarget(FC3,g3c,V.toScreen([-.96,.96]),[-.96,.96],V,false);
assert.equal(dg3.snapKind,'diagonal','P3 対角の吸着が壊れた');
assert.deepEqual(rd(dg3.target),[-1,1]);
/* ★P4 引いた折り目は、そのあとの角折り・辺合わせ（E2）の吸着先になる。 */
const FC4=E.create();lineCommit(FC4,[.5,-.9],[.5,.9]);
assert.equal(FC4.cache.creases.length,1,'P4 折り目が残っていない');
assert.deepEqual(rd(FC4.cache.creases[0].seg[0]).concat(rd(FC4.cache.creases[0].seg[1])).sort(),
 [-1,.5,.5,1].sort(),'P4 引いた折り目が x=.5 でない');
const pg4=N.grab(FC4,V.toScreen([1,-1]),V);
const pt4=N.foldTarget(FC4,pg4,V.toScreen([.5,0]),[.5,0],V,false);
assert.equal(pt4.snapped,true,'P4 引いた折り目に角が吸いつかない');
assert.equal(pt4.snapOn,'crease','P4 吸着先が折り目でない');
assert.deepEqual(rd(pt4.target),[.5,0]);
assert.deepEqual(E.creaseIntervals(FC4).map(v=>v.intervalId),['s1#1'],'P4 折り目の区間IDが出ない');
const rim4=E.rimEdges(FC4).find(v=>v.rimId==='right');
const opt4=E.edgeToCreaseOptions(FC4,E.edgeIntent(FC4,rim4.faceId,'right'));
assert.equal(opt4.options.some(o=>o.ok),true,'P4 引いた折り目へ辺を合わせられない: '+opt4.reason);
/* 交点は「紙の角」にも「線上」にも勝つ（折り目とふちが出あう所）。 */
const sh4=E.sheetOf(FC4,rim4.faceId);
const at4=N.linePointAim(N.sheetVertices(sh4),N.guidesOf(FC4,sh4),V.toScreen([.5,-1]),[.5,-1],V,false);
assert.deepEqual(rd(at4.point),[.5,-1]);
assert.equal(at4.snapKind,'cross','P4 交点が紙の角・線上に勝っていない');
/* ★P4b 折り目を折り目で横切る＝紙片の中の面が増えても、同じ道で引ける。 */
const FCX=E.create();lineCommit(FCX,[.5,-.9],[.5,.9]);lineCommit(FCX,[-.9,0],[.9,0]);
assert.equal(FCX.recipe.steps.length,2);
assert.equal(FCX.cache.faces.length,4,'P4b 折り目どうしの交差で4面に割れていない');
assert.equal(N.isFlat(FCX),true,'P4b 折り目だけなのに紙が平らでない');
/* 1本めは2本目で切り分けられ、2本目は割れた面ごとに記録される＝合わせて4本・4区間。 */
assert.equal(FCX.cache.creases.length,4,'P4b 折り目の本数が合わない（横切った側が切り分けられていない）');
assert.deepEqual(E.creaseIntervals(FCX).map(v=>v.intervalId),['s1#1','s1#2','s2#1','s2#2'],'P4b 折り目の区間IDが合わない');
assert.equal(FCX.cache.hinges.length,0,'P4b crease なのにヒンジができた');
/* ★P5 断るものは断る。 */
const FC5=E.create();
const s5=N.freeCreaseStart(FC5,V.toScreen([0,0]),[0,0],V);
const src5=Object.freeze({type:'line',point:s5.point,faceId:s5.faceId,guides:s5.guides,corners:s5.corners});
assert.throws(()=>N.freeCreaseLine(FC5,src5,[.02,.02]),/もう少し離れた/,'P5 短すぎる線を通した');
assert.equal(N.freeCreaseStart(FC5,V.toScreen([1.5,1.5]),[1.5,1.5],V).point,null,'P5 紙の外で引きはじめた');
E.proposeOnFace(FC5,[0,-1],[0,1],'paper');
assert.equal(N.freeCreaseStart(FC5,V.toScreen([0,0]),[0,0],V).point,null,'P5 候補があるのに引きはじめた');
E.cancel(FC5);
const s5b=N.freeCreaseStart(FC5,V.toScreen([.95,.95]),[.95,.95],V);
assert.deepEqual(rd(s5b.point),[1,1],'P5 角に吸いついていない');
const src5b=Object.freeze({type:'line',point:s5b.point,faceId:s5b.faceId,guides:s5b.guides,corners:s5b.corners});
assert.throws(()=>N.freeCreaseLine(FC5,src5b,[1,0]),/引きはじめた所の紙を折り目が通りません/,
 'P5 紙を通らない向き（ふちに沿う線）を通した');
assert.equal(FC5.recipe.steps.length,0,'P5 断ったのに原本が動いた');
/* ★P6 画面の原文で見張る（J群と同じ流儀）。 */
const uiLine=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.equal(/let lineMode=false;/.test(uiLine),true,'P6 線モードが無い');
assert.equal(/opBtn\.onclick=\(\)=>\{if\(lineMode\)return;/.test(uiLine),true,'P6 線モードの中で操作を切りかえられる');
assert.equal(/creaseBtn\.onclick=\(\)=>\{if\(lineMode\)return;/.test(uiLine),true,'P6 線モードの中で「折る」へ切りかえられる');
assert.equal(/opBtn\.disabled=lineMode;creaseBtn\.disabled=lineMode;/.test(uiLine),true,'P6 線モードでボタンを止めていない');
assert.equal(/geom=E\.preview\(state,0\)/.test(uiLine),true,'P6 折り目の自由入力が0°でプレビューしていない');
/* 画面は「折る側の点」を自分で作らない＝engine が作った点をそのまま渡すだけ。 */
for(const m of uiLine.matchAll(/E\.setSide\(([^)]*)\)/g))
 assert.match(m[1].replace(/\s/g,''),/^state,[A-Za-z0-9_.]+$/,'P6 画面が折る側の点を組み立てている: '+m[1]);
assert.equal(/E\.creaseSidePoint/.test(uiLine),false,'P6 画面が creaseSidePoint を直に呼んでいる（入力層を通す）');
assert.equal(/freeCreaseLine|freeCreaseStart|linePointAim/.test(uiLine),true,'P6 画面が折り目の自由入力を呼んでいない');

/* ============ Q（🪜 角セッションから E2＝角につながる辺を折り目へ合わせる）============
   症状（本人が画像で指摘）：角を折り目へ近づけると**角の点だけ**が折り目に乗り、角につながる辺は斜めに残る。
   点の吸着(line)は角を1点に拘束するので、それ以上寄せられない。
   直し方＝**E2の幾何と関門をそのまま**角セッションから使う（新しい幾何は作らない／辺を直接つかむE2は無変更）。
   順位は **cross > end > edge-to-crease > diagonal > line**。 */
const qState=()=>{const st=E.create();/* 縦の折り目 x=.2（画像と同じ「縦のcrease」） */
 E.proposeOnFace(st,[.2,-1],[.2,1],'paper');st.pending.kind='V';E.setSide(st,[.6,0]);
 E.select(st,st.pending.candidates);E.confirm(st,{op:'crease'});return st};
const qSrc=(st,corner)=>{const g=N.grab(st,V.toScreen(corner),V),f=N.faceAtCorner(st,g.point);
 return Object.freeze(Object.assign(g,{edges:N.cornerRimEdges(st,f.faceId,g.point)}))};
/* ★Q0 角につながる外周辺＝多くて2本。つかんだ所 t は**角そのもの**（0か1）。 */
const Q=qState(),qs=qSrc(Q,[1,-1]);
assert.deepEqual(qs.edges.map(e=>[e.rimId,e.label,e.grabT]),[['bottom','下辺',1],['right','右辺',0]],
 'Q0 角につながる辺が2本そろわない: '+JSON.stringify(qs.edges.map(e=>e.rimId)));
for(const e of qs.edges){assert.deepEqual(rd(e.seg[e.grabT]),rd(qs.point),'Q0 grabT が角を指していない');
 assert.equal(e.intent.kind,'edge','Q0 intent を凍結していない');
 assert.equal(e.intent.revision,Q.revision,'Q0 intent の revision が今の紙でない')}
const qFace=N.faceAtCorner(Q,qs.point).faceId;
assert.equal(N.cornerRimEdges(Q,qFace,[.6,-1]).length,0,'Q0 辺の途中を「角につながる辺」にした');
assert.equal(N.cornerRimEdges(Q,'paper/s1.keep',qs.point).length<=2,true,'Q0 2本を超えて返した');
/* ★Q1 本命。点吸着では角だけが乗り、辺のもう一端は折り目から離れる。辺合わせなら両方0。 */
const qcs=E.creaseIntervals(Q)[0].seg;
const qoff=q=>{const u=[qcs[1][0]-qcs[0][0],qcs[1][1]-qcs[0][1]],L=Math.hypot(u[0],u[1]);
 return Math.abs((q[0]-qcs[0][0])*u[1]/L-(q[1]-qcs[0][1])*u[0]/L)*240};/* 折り目の線からの画面px */
const qbot=qs.edges.find(e=>e.rimId==='bottom'),qother=qbot.seg[1-qbot.grabT];
const qPoint=[.2,-.45];/* 折り目の上・e2 の着地からは 60px 離れている＝従来の点吸着になる所 */
const qt=N.foldTarget(Q,qs,V.toScreen(qPoint),qPoint,V,false);
assert.equal(qt.snapKind,'line','Q1 ここは点(線上)の吸着でなければ検査の意味がない');
assert.equal(N.preferPointSnap(qt),false,'Q1 線上の吸着が edge-to-crease に勝ってしまう');
const qcr=N.creaseForCorners(Q,qs.point,qt.target,{requireInside:!qt.snapped});
assert.equal(qoff(E.reflect(qs.point,qcr.line[0],qcr.line[1]))<1e-6,true,'Q1 点吸着で角が折り目に乗らない');
assert.equal(qoff(E.reflect(qother,qcr.line[0],qcr.line[1]))>60,true,
 'Q1 症状が再現していない（点吸着でも辺のもう一端が折り目に乗ってしまう）');
/* 辺合わせ：軸で折り返すと角も辺のもう一端も折り目の線の上（0px）。 */
const qa=N.cornerEdgeToCreaseAim(Q,qs,V.toScreen([.2,-.2]),V,false);
assert.equal(!!qa.aim,true,'Q1 辺→折り目の候補が出ない: '+qa.reason);
assert.equal(qa.aim.edge.label,'下辺','Q1 動かす辺が下辺でない');
assert.equal(qa.aim.target.intervalId,'s1#1','Q1 合わせ先の折り目が違う');
assert.equal(qoff(E.reflect(qs.point,qa.aim.axis[0],qa.aim.axis[1]))<1e-6,true,'Q1 角が折り目に乗らない');
assert.equal(qoff(E.reflect(qother,qa.aim.axis[0],qa.aim.axis[1]))<1e-6,true,'Q1 辺のもう一端が折り目に乗らない');
/* 画面と同じ順に engine を呼んで確定する。 */
E.proposeOnFace(Q,qa.aim.axis[0],qa.aim.axis[1],qa.aim.edge.faceId,{layers:1});
Q.pending.kind='V';E.setSide(Q,qa.aim.sidePoint);
for(const ang of[0,90,180]){const gm=E.preview(Q,ang);assert.equal(gm.move.length>0,true,`Q1 ${ang}°でゴーストが出ない`)}
E.select(Q,Q.pending.candidates);
E.confirm(Q,{edgeToCrease:{edge:qa.aim.edge.intent,crease:E.creaseIntent(Q,qa.aim.target.intervalId),corner:qs.point.slice()}});
assert.equal(Q.recipe.steps.length,2,'Q1 確定できない');
const qstep=Q.recipe.steps[1];
assert.deepEqual(Object.keys(qstep).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'Q1 原本の項目が増えた: '+Object.keys(qstep));
assert.equal(JSON.stringify(Q.recipe).includes('rim:')||JSON.stringify(Q.recipe).includes('intervalId'),false,'Q1 原本に意図が漏れた');
/* 確定後、動いた面の下辺ぜんぶが折り目(x=.2)の上にある。 */
const qafter=E.rimEdges(Q).filter(e=>e.rimId==='bottom').map(e=>e.seg);
const qon=qafter.filter(s=>s.every(p=>Math.abs(p[0]-.2)<1e-6));
assert.equal(qon.length,1,'Q1 下辺が折り目(x=.2)に乗っていない: '+JSON.stringify(qafter));
/* 点でなく、つかんだ辺ぜんぶ（長さ .8）が乗っている。 */
assert.equal(Math.abs(Math.hypot(qon[0][1][0]-qon[0][0][0],qon[0][1][1]-qon[0][0][1])-.8)<1e-6,true,
 'Q1 折り目に乗ったのが辺ぜんぶでない: '+JSON.stringify(qon));
/* 巻き戻し→やり直しでハッシュまで戻る。 */
const qhash=Q.cache.hash;E.undo(Q);assert.equal(Q.recipe.steps.length,1);E.redo(Q);
assert.equal(Q.cache.hash,qhash,'Q1 やり直しで元に戻らない');
/* ★Q2 26px入る／27px入らない／44px維持／45px離れる＝「軸で折り返した角」と指の距離で測る。 */
const Q2=qState(),q2s=qSrc(Q2,[1,-1]),q2land=[.2,-.2];
const q2aim=(px,snapped)=>N.cornerEdgeToCreaseAim(Q2,q2s,[V.toScreen(q2land)[0]+px,V.toScreen(q2land)[1]],V,snapped);
assert.equal(!!q2aim(26,false).aim,true,'Q2 26pxで入らない');
assert.equal(!!q2aim(27,false).aim,false,'Q2 27pxで入ってしまう');
assert.equal(!!q2aim(44,true).aim,true,'Q2 44pxまで保てない');
assert.equal(!!q2aim(45,true).aim,false,'Q2 45pxで離れない');
assert.equal(q2aim(200,false).reason,null,'Q2 遠いだけで理由を出した');
/* ★Q3 順位の決まりそのもの（cross・end は勝つ／diagonal・line・自由な点には負ける）。 */
assert.equal(N.preferPointSnap({snapped:true,snapKind:'cross'}),true,'Q3 交点が勝たない');
assert.equal(N.preferPointSnap({snapped:true,snapKind:'end'}),true,'Q3 端点が勝たない');
assert.equal(N.preferPointSnap({snapped:true,snapKind:'diagonal'}),false,'Q3 対角が edge-to-crease に勝ってしまう');
assert.equal(N.preferPointSnap({snapped:true,snapKind:'line'}),false,'Q3 線上が edge-to-crease に勝ってしまう');
assert.equal(N.preferPointSnap({snapped:false,snapKind:null}),false,'Q3 吸着なしが勝ってしまう');
/* ★Q4 角につながる2辺が別々の有効軸を同程度で作るときは、勝手に選ばない。
   実例＝角(-1,-1)を切り落とす折り目。下辺の断片と左辺の断片が、36.7px 離れた2つの着地を作る。 */
const Q4=E.create();
E.proposeOnFace(Q4,[-.8,-1],[-1,-.6],'paper');Q4.pending.kind='V';
E.setSide(Q4,E.creaseSidePoint(Q4,'paper',[-.8,-1],[-1,-.6]).point);
E.select(Q4,Q4.pending.candidates);E.confirm(Q4,{op:'crease'});
const q4s=qSrc(Q4,[-1,-1]);
assert.equal(q4s.edges.length,2,'Q4 角につながる辺が2本でない');
const q4A=N.edgeToCreaseAim(Q4,{intent:q4s.edges[0].intent,grabT:q4s.edges[0].grabT},V.toScreen([-9,-9]),V,false);
const q4to=q4s.edges.map(e=>{const o=E.edgeToCreaseOptions(Q4,e.intent).options.filter(v=>v.ok)[0];
 return E.reflect(e.seg[e.grabT],o.axis[0],o.axis[1])});
const q4mid=[(q4to[0][0]+q4to[1][0])/2,(q4to[0][1]+q4to[1][1])/2];
const q4tie=N.cornerEdgeToCreaseAim(Q4,q4s,V.toScreen(q4mid),V,false);
assert.equal(q4tie.aim,null,'Q4 同点なのに勝手に選んだ');
assert.equal(q4tie.reason,'合わせる辺を特定できません','Q4 理由が違う: '+q4tie.reason);
/* 片方へ寄れば決まる（同点でなくなる）。 */
const q4near=N.cornerEdgeToCreaseAim(Q4,q4s,V.toScreen(q4to[0]),V,false);
assert.equal(!!q4near.aim,true,'Q4 寄せても決まらない: '+q4near.reason);
assert.equal(q4near.aim.edge.rimId,q4s.edges[0].rimId,'Q4 寄せた側の辺が選ばれない');
/* ★Q5 同じ軸・同じ折り目を指す重複は1件にまとめる（同じ辺を2回渡しても「同点で拒否」にならない）。 */
const qdup=N.cornerEdgeToCreaseAim(Q2,{edges:[q2s.edges[0],q2s.edges[0]]},V.toScreen(q2land),V,false);
assert.equal(!!qdup.aim,true,'Q5 同じ軸・同じ折り目の重複で拒否した: '+qdup.reason);
/* ★Q6 確定の関門。凍結した角が合わせる辺の端でなければ engine が断る（原本は動かない）。 */
const Q6=qState(),q6s=qSrc(Q6,[1,-1]);
const q6a=N.cornerEdgeToCreaseAim(Q6,q6s,V.toScreen([.2,-.2]),V,false);
E.proposeOnFace(Q6,q6a.aim.axis[0],q6a.aim.axis[1],q6a.aim.edge.faceId,{layers:1});
Q6.pending.kind='V';E.setSide(Q6,q6a.aim.sidePoint);E.select(Q6,Q6.pending.candidates);
const q6rec=JSON.stringify(Q6.recipe),q6rev=Q6.revision;
assert.throws(()=>E.confirm(Q6,{edgeToCrease:{edge:q6a.aim.edge.intent,
 crease:E.creaseIntent(Q6,q6a.aim.target.intervalId),corner:[0,0]}}),/つかんだ角が、合わせる辺の端にありません/,
 'Q6 偽の角を通した');
assert.equal(JSON.stringify(Q6.recipe),q6rec,'Q6 断ったのに原本が動いた');
assert.equal(Q6.revision,q6rev,'Q6 断ったのに revision が動いた');
/* 角を渡さない道（辺を直接つかむE2）は1文字も変わっていない＝corner 無しでも通る。 */
assert.equal(E.verifyEdgeToCrease(Q6,q6a.aim.edge.intent,E.creaseIntent(Q6,q6a.aim.target.intervalId),
 q6a.aim.axis[0],q6a.aim.axis[1]).ok,true,'Q6 辺を直接つかむE2の道が壊れた');
E.cancel(Q6);
/* ★Q7 画面の原文で見張る。 */
const uiQ=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.equal(/N\.cornerRimEdges\(/.test(uiQ),true,'Q7 画面が角につながる辺を凍結していない');
assert.equal(/N\.cornerTargetAim\(/.test(uiQ),true,'Q7 画面が角からの合わせ先の候補を見ていない（折り目＞背の合成）');
assert.equal(/const pointFirst=N\.preferPointSnap\(t\);/.test(uiQ),true,'Q7 順位の決まりを画面が自分で書いている');
assert.equal(/N\.foldTarget\(/.test(uiQ),true,'Q7 従来の点の吸着を呼んでいない');
assert.equal(/corner:src\.point\.slice\(\)/.test(uiQ),true,'Q7 確定時に凍結した角を engine へ渡していない');
assert.equal(/E\.verifyEdgeToCrease/.test(uiQ),false,'Q7 画面が軸の作り直しを自分でやっている（confirm に任せる）');

/* ============ T（🦴 H1＝折った背(hinge)を安定IDの区間として読む）============
   本人の要望（2026-09-13）＝白と赤のあいだの長い境界＝**折った背**を、あとで吸着先にできるようにする土台。
   ここは読み取りだけ＝軸・吸着・プレビュー・確定（H2）は作らない。
   ID＝`hinge:<由来stepId>#<素材座標で並べて何番目か>`。cache の配列番号・bondId は使わない。 */
const tState=()=>{/* 画像と同じ構造：縦の折り目＋角折り＋2面が動く折り */
 const st=E.create();
 const tDraw=(a,b)=>{const s0=N.freeCreaseStart(st,V.toScreen(a),a,V);
  const src={point:s0.point,faceId:s0.faceId,guides:s0.guides,corners:s0.corners};
  const aim=N.linePointAim(src.corners,src.guides,V.toScreen(b),b,V,false);
  const cr=N.freeCreaseLine(st,src,aim.point);
  E.proposeOnFace(st,cr.line[0],cr.line[1],cr.faceId,{layers:1});st.pending.kind='V';
  E.setSide(st,cr.sidePoint);E.select(st,st.pending.candidates);E.confirm(st,{op:'crease'})};
 const tFold=(from,to)=>{const g=N.grab(st,V.toScreen(from),V);
  const t=N.foldTarget(st,g,V.toScreen(to),to,V,false);
  const cr=N.creaseForCorners(st,g.point,t.target,{requireInside:!t.snapped});
  E.proposeOnFace(st,cr.line[0],cr.line[1],cr.faceId,{layers:1});st.pending.kind='V';
  E.setSide(st,cr.sidePoint);E.select(st,st.pending.candidates);E.confirm(st,{})};
 tDraw([0,-.95],[0,.95]);tFold([1,1],[.35,.35]);tFold([-1,-1],[-.2,.6]);return st};
/* ★T0 画像と同じ状態で、長い境界が「背の区間」として出る。 */
const T=tState();
assert.equal(T.recipe.steps.length,3,'T0 3手になっていない');
const tiv=E.hingeIntervals(T);
assert.deepEqual(tiv.map(h=>h.intervalId),['hinge:s2#1','hinge:s3#1','hinge:s3#2'],
 'T0 背の区間IDが違う: '+JSON.stringify(tiv.map(h=>h.intervalId)));
const tlong=tiv.find(h=>h.intervalId==='hinge:s3#1');
assert.deepEqual(tlong.faceIds,['paper/s1.cut/s3.keep','paper/s1.cut/s3.cut'],'T0 両側のfaceIdが違う');
assert.equal(Math.abs(tlong.len-Math.hypot(1,.5))<1e-6,true,'T0 長さが違う: '+tlong.len);
assert.equal(tlong.stepId,'s3','T0 由来手順が違う');
assert.equal(tlong.paperRoot,'paper','T0 原紙が違う');
assert.equal(tlong.consistent,true,'T0 両側のxfで写した線分が一致していない');
assert.equal(tlong.visible,true,'T0 画面で見えている判定にならない: '+tlong.reason);
assert.deepEqual(tlong.visibleParts.map(p=>[p.t0,p.t1]),[[0,1]],'T0 可視区間が全長でない');
assert.equal(tlong.visibleParts[0].ownerFaceId,'paper/s1.cut/s3.cut','T0 見えている側の面が違う');
/* 両側の layerPath・layer・表裏が入っている。 */
assert.deepEqual(tlong.sides.map(s=>[s.faceId,s.layer,s.back]),
 [['paper/s1.cut/s3.keep',0,false],['paper/s1.cut/s3.cut',2,true]],'T0 層・表裏が違う: '+JSON.stringify(tlong.sides));
assert.deepEqual(tlong.sides.map(s=>s.layerPath.map(q=>q.stepId+'.'+q.side).join('>')),
 ['s1.cut>s3.keep','s1.cut>s3.cut'],'T0 layerPath が違う');
/* ★T1 背が後続の折りで2区間に分かれる／一部が隠れる／丸ごと覆われる。 */
const T1=E.create();commit(T1,[0,-1],[0,1],[.8,0]);
E.proposeOnFace(T1,[-1,.3],[1,.3],'paper/s1.cut',{layers:1});T1.pending.kind='V';E.setSide(T1,[-.5,.8]);
E.setLayers(T1,2,T1.pending.at);E.select(T1,ref(T1));E.confirm(T1,{});
const t1iv=E.hingeIntervals(T1);
assert.deepEqual(t1iv.map(h=>h.intervalId),['hinge:s1#1','hinge:s1#2','hinge:s2#1','hinge:s2#2'],
 'T1 分割後のIDが違う: '+JSON.stringify(t1iv.map(h=>h.intervalId)));
const t1a=t1iv[0],t1b=t1iv[1];
assert.equal(Math.abs(t1a.len-1.3)<1e-9&&Math.abs(t1b.len-.7)<1e-9,true,
 'T1 1手目の背が 1.3 と 0.7 に切り分かれていない: '+[t1a.len,t1b.len]);
assert.equal(t1a.len+t1b.len>1.999,true,'T1 切り分けで長さが減った');
/* 一部だけ見える背は、見えている所だけが区間になる。 */
assert.equal(t1a.visible&&t1a.visibleParts.length===1&&t1a.visibleParts[0].t1<.999,true,
 'T1 途中から隠れる背が全長のまま: '+JSON.stringify(t1a.visibleParts));
/* 丸ごと覆われた背は候補外（理由つき）。 */
const tcovered=t1iv.find(h=>h.intervalId==='hinge:s2#2');
assert.equal(tcovered.visible,false,'T1 覆われた背が見えている判定になった');
assert.equal(tcovered.visibleParts.length,0,'T1 覆われた背に可視区間が出た');
assert.match(tcovered.reason,/上に別の紙が乗って/,'T1 覆われた理由が違う: '+tcovered.reason);
/* ★T2 端点で接している2区間は「どちらか決まらない」と断る（T字・端点接触）。 */
const tj=t1a.visibleParts[0].seg[1];/* s1#1 の可視区間の端＝s1#2 との継ぎ目側 */
const ttie=N.pickVisibleHinge(T1,V.toScreen(tj),V);
assert.equal(ttie.hinge,null,'T2 端点で接する2区間なのに選んでしまった');
assert.match(ttie.reason,/どれを選んだか決まりません/,'T2 断る理由が違う: '+ttie.reason);
/* 区間の真ん中なら決まる。 */
const mid1b=[(t1b.seg[0][0]+t1b.seg[1][0])/2,(t1b.seg[0][1]+t1b.seg[1][1])/2];
const pick1b=N.pickVisibleHinge(T1,V.toScreen(mid1b),V);
assert.equal(pick1b.hinge&&pick1b.hinge.intervalId,'hinge:s1#2','T2 区間の真ん中で選べない: '+pick1b.reason);
/* ★T3 画面から選ぶ：長い境界をつかめる／カメラを変えても同じ／pending 中は選ばせない。 */
const tmid=[(tlong.seg[0][0]+tlong.seg[1][0])/2,(tlong.seg[0][1]+tlong.seg[1][1])/2];
const tgot=N.pickVisibleHinge(T,V.toScreen(tmid),V);
assert.equal(tgot.hinge&&tgot.hinge.intervalId,'hinge:s3#1','T3 長い境界を選べない: '+tgot.reason);
assert.deepEqual(tgot.hinge.faceIds,['paper/s1.cut/s3.keep','paper/s1.cut/s3.cut'],'T3 両側のfaceIdが違う');
assert.equal(tgot.intent.kind,'hinge','T3 intent の種類が違う');
assert.deepEqual([tgot.intent.intervalId,tgot.intent.stepId,tgot.intent.revision],
 ['hinge:s3#1','s3',T.revision],'T3 intent に凍結された値が違う');
assert.deepEqual(tgot.intent.faceIds,tlong.faceIds,'T3 intent に両側のfaceIdが入っていない');
assert.equal(tgot.intent.bondId,undefined,'T3 intent に cache の番号(bondId)が入っている');
const Vt2={toScreen:p=>{const c=Math.cos(.7),s2=Math.sin(.7);return[(p[0]*c-p[1]*s2)*390,-(p[0]*s2+p[1]*c)*390*.52]}};
const tgot2=N.pickVisibleHinge(T,Vt2.toScreen(tmid),Vt2);
assert.equal(tgot2.hinge&&tgot2.hinge.intervalId,'hinge:s3#1','T3 カメラを変えたら別の背になった: '+tgot2.reason);
/* 少し離れれば選ばない（画面pxで見ている）。 */
assert.equal(N.pickVisibleHinge(T,[V.toScreen(tmid)[0]+40,V.toScreen(tmid)[1]],V).hinge,null,'T3 遠いのに選んだ');
/* フラップの外周rim・下に隠れた折り目は「背」として返さない。 */
const trim=E.rimEdges(T).find(e=>e.edgeId==='rim:left|paper/s1.cut/s3.cut');
const rmid=[(trim.seg[0][0]+trim.seg[1][0])/2,(trim.seg[0][1]+trim.seg[1][1])/2];
assert.equal(N.pickVisibleHinge(T,V.toScreen(rmid),V).hinge,null,'T3 外周rimを背として返した');
const tc=E.creaseIntervals(T).find(c=>c.intervalId==='s1#1');
const cmid=[(tc.seg[0][0]+tc.seg[1][0])/2,(tc.seg[0][1]+tc.seg[1][1])/2];
assert.equal(N.pickVisibleHinge(T,V.toScreen(cmid),V).hinge,null,'T3 折り目を背として返した');
/* pending があるあいだは選ばせない。 */
E.proposeOnFace(T,[-1,-.9],[1,-.9],'paper/s1.cut/s3.keep',{layers:1});
assert.equal(N.pickVisibleHinge(T,V.toScreen(tmid),V).hinge,null,'T3 候補があるのに選んだ');
assert.match(N.pickVisibleHinge(T,V.toScreen(tmid),V).reason,/候補を片づけて/,'T3 断る理由が違う');
E.cancel(T);
/* ★T4 素材の線分は crease・rim と混ざらない（種類の取りちがえをしない）。 */
const hs=new Set(E.hingeIntervals(T).map(h=>JSON.stringify(h.srcSeg)));
for(const c of E.creaseIntervals(T))assert.equal(hs.has(JSON.stringify(c.srcSeg)),false,'T4 折り目と同じ素材線分を背として出した');
for(const e of E.rimEdges(T))assert.equal(hs.has(JSON.stringify(e.srcSeg)),false,'T4 外周辺と同じ素材線分を背として出した');
const creaseOnly=E.create();
{const s0=N.freeCreaseStart(creaseOnly,V.toScreen([0,-.95]),[0,-.95],V);
 const src={point:s0.point,faceId:s0.faceId,guides:s0.guides,corners:s0.corners};
 const aim=N.linePointAim(src.corners,src.guides,V.toScreen([0,.95]),[0,.95],V,false);
 const cr=N.freeCreaseLine(creaseOnly,src,aim.point);
 E.proposeOnFace(creaseOnly,cr.line[0],cr.line[1],cr.faceId,{layers:1});creaseOnly.pending.kind='V';
 E.setSide(creaseOnly,cr.sidePoint);E.select(creaseOnly,creaseOnly.pending.candidates);E.confirm(creaseOnly,{op:'crease'})}
assert.equal(E.hingeIntervals(creaseOnly).length,0,'T4 折り目だけの紙に背ができた');
/* ★T5 IDと順序が安定：作り直し・巻き戻し→やり直し・保存した原本からの再生で同じ。 */
const hIdsOf=st=>E.hingeIntervals(st).map(h=>h.intervalId+'|'+h.faceIds.join('/')+'|'+JSON.stringify(h.srcSeg));
const tbase=hIdsOf(T);
const tRebuilt={...T,cache:E.replay(T.recipe)};
assert.deepEqual(hIdsOf(tRebuilt),tbase,'T5 同じ原本から作り直すと別のIDになった');
const tsaved=E.create();tsaved.recipe=C0(E.verifiedRecipe(T));tsaved.cache=E.replay(tsaved.recipe);
assert.deepEqual(hIdsOf(tsaved),tbase,'T5 保存→再読込でIDが変わった');
const tfrozen=E.hingeIntent(T,'hinge:s3#1');
E.undo(T);E.redo(T);
assert.deepEqual(hIdsOf(T),tbase,'T5 巻き戻し→やり直しでIDが変わった');
const tback=E.resolveHingeInterval(T,tfrozen);
assert.equal(tback&&tback.intervalId,'hinge:s3#1','T5 やり直しのあと同じ区間へ解決できない');
assert.deepEqual(tback.faceIds,tfrozen.faceIds,'T5 解決先の両側faceIdが違う');
/* ★T6 紙が進んだあと（背が切り分けられたあと）も、凍結した意図は子の区間へ橋渡しされる。 */
const T6=E.create();commit(T6,[0,-1],[0,1],[.8,0]);
const tspine=E.hingeIntervals(T6);
assert.deepEqual(tspine.map(h=>h.intervalId),['hinge:s1#1'],'T6 1手目の背が1本でない');
const spineIntent=E.hingeIntent(T6,'hinge:s1#1');
E.proposeOnFace(T6,[-1,.3],[1,.3],'paper/s1.cut',{layers:1});T6.pending.kind='V';E.setSide(T6,[-.5,.8]);
E.setLayers(T6,2,T6.pending.at);E.select(T6,ref(T6));E.confirm(T6,{});
const bridged=E.resolveHingeInterval(T6,spineIntent);
assert.equal(!!bridged,true,'T6 切り分けのあと解決できない');
assert.equal(bridged.stepId,'s1','T6 別の手順の背へ橋渡しした');
assert.equal(Math.abs(bridged.len-1.3)<1e-9,true,'T6 素材の重なりが大きい区間へ橋渡ししていない: '+bridged.len);
/* 同じしぐさの最中（revision が同じ）は、ぼんやり一致を許さない。 */
const tstrict=E.resolveHingeInterval(T6,{...spineIntent,revision:T6.revision});
assert.equal(tstrict,null,'T6 しぐさの最中にぼんやり一致を許した');
/* ★T7 結びの線が両側で一致しない区間は候補に出さず、理由をつけて報告する。 */
const tbad={...T,cache:{...T.cache,faces:T.cache.faces.map(f=>
 f.faceId==='paper/s1.cut/s3.cut'?{...f,xf:[f.xf[0],f.xf[1],f.xf[2],f.xf[3],f.xf[4]+.05,f.xf[5]]}:f)}};
const badIv=E.hingeIntervals(tbad).find(h=>h.intervalId==='hinge:s3#1');
assert.equal(badIv.consistent,false,'T7 ずれている結びを一致と報告した');
assert.equal(badIv.visible,false,'T7 ずれている結びを候補に出した');
assert.match(badIv.reason,/切り離されて/,'T7 報告の理由が違う: '+badIv.reason);
assert.equal(N.pickVisibleHinge(tbad,V.toScreen(tmid),V).hinge,null,'T7 ずれている結びを選べてしまった');
assert.equal(E.resolveHingeInterval(tbad,tfrozen),null,'T7 ずれている結びへ解決した');
/* ★T8 IDも intent も、原本JSON・保存・cache.hash に漏れない。 */
const hashBefore=T.cache.hash;
E.hingeIntervals(T);E.hingeIntent(T,'hinge:s3#1');N.pickVisibleHinge(T,V.toScreen(tmid),V);
assert.equal(T.cache.hash,hashBefore,'T8 背を読んだら cache.hash が動いた');
assert.equal(JSON.stringify(E.verifiedRecipe(T)).includes('hinge'),false,'T8 原本に hinge の語が混ざった');
for(const w of['intervalId','partSrcSeg','hinge:'])
 assert.equal(JSON.stringify(T.recipe).includes(w),false,`T8 原本に ${w} が漏れた`);
/* ★T9 画面の原文：選択の確認だけ＝H2（軸・吸着・プレビュー・確定）は作っていない。 */
const uiT=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.equal(/N\.pickVisibleHinge\(/.test(uiT),true,'T9 画面が背の選択を呼んでいない');
assert.equal(/Object\.freeze\(\{\.\.\.hp\.hinge,intent:Object\.freeze\(hp\.intent\)\}\)/.test(uiT),true,'T9 選んだ背を凍結していない');
/* H2 実装ごとにここは「通してあること」の見張りになった（背へ合わせる道）。 */
assert.equal(/N\.rimTargetAim\(/.test(uiT)&&/N\.cornerTargetAim\(/.test(uiT),true,'T9 画面が合わせ先（折り目・背）の候補を見ていない');
assert.equal(/E\.hingeIntervals\(/.test(uiT),false,'T9 画面が背の数え上げを直に呼んでいる（入力層を通す）');

/* ============ U（🦴📐 H2＝つかんだ外周辺を「見えている折った背」へ合わせる）============
   幾何は E2 のまま（角二等分線・26/44px・原子的確定）。**target だけ** crease 区間→H1の visible hinge 区間。
   🚨背は「2面の境目」なので、crease には無い関門が1つ増える＝
   **合わせ先の背は 0°/90°/180° のどこでも提案前の位置に居ること**（`hingeStaysUnderFold`）。
   一部だけ固定なら固定部分へ切り分けて、そこに収まるかで見る（黙って短縮しない）。 */
const uState=()=>{/* H1 と同じ3手（画像と同じ構造） */
 const st=E.create();
 const dr=(a,b)=>{const s0=N.freeCreaseStart(st,V.toScreen(a),a,V);
  const src={point:s0.point,faceId:s0.faceId,guides:s0.guides,corners:s0.corners};
  const aim=N.linePointAim(src.corners,src.guides,V.toScreen(b),b,V,false);
  const cr=N.freeCreaseLine(st,src,aim.point);
  E.proposeOnFace(st,cr.line[0],cr.line[1],cr.faceId,{layers:1});st.pending.kind='V';
  E.setSide(st,cr.sidePoint);E.select(st,st.pending.candidates);E.confirm(st,{op:'crease'})};
 const fd=(f,t)=>{const g=N.grab(st,V.toScreen(f),V);const tt=N.foldTarget(st,g,V.toScreen(t),t,V,false);
  const cr=N.creaseForCorners(st,g.point,tt.target,{requireInside:!tt.snapped});
  E.proposeOnFace(st,cr.line[0],cr.line[1],cr.faceId,{layers:1});st.pending.kind='V';
  E.setSide(st,cr.sidePoint);E.select(st,st.pending.candidates);E.confirm(st,{})};
 dr([0,-.95],[0,.95]);fd([1,1],[.35,.35]);fd([-1,-1],[-.2,.6]);return st};
const uOff=(p,seg)=>{const u=[seg[1][0]-seg[0][0],seg[1][1]-seg[0][1]],L=Math.hypot(u[0],u[1]);
 return Math.abs((p[0]-seg[0][0])*u[1]/L-(p[1]-seg[0][1])*u[0]/L)};
/* ★U0 本命＝白いフラップの左辺を、長い境界 hinge:s3#1 へ。 */
const U=uState(),uEdge=E.edgeIntent(U,'paper/s1.cut/s3.cut','left');
const uOpt=E.edgeToHingeOptions(U,uEdge);
const uBest=uOpt.options.filter(o=>o.ok&&o.target.intervalId==='hinge:s3#1')[0];
assert.equal(!!uBest,true,'U0 本命の候補が出ない: '+JSON.stringify(uOpt.options.map(o=>[o.target.intervalId,o.reason])));
assert.equal(uBest.kind,'bisector','U0 軸が角二等分線でない');
assert.equal(uBest.stationary,0,'U0 背が動かない検査を通っていない: '+uBest.stationary);
/* 🚨target は**固定部分へ切り分けて**評価する（黙って短縮しない）。 */
assert.equal(uBest.target.cut,true,'U0 固定部分への切り分けを通っていない');
assert.equal(uBest.target.fixedSeg.every((p,i)=>Math.abs(p[0]-uBest.target.part.seg[i][0])<1e-9&&Math.abs(p[1]-uBest.target.part.seg[i][1])<1e-9),true,
 'U0 固定部分が可視区間と別の線になっている');
/* 反射後、つかんだ辺の両端が背の線に乗り、辺ぜんぶが（固定部分の）区間に収まる。 */
const uRef=uOpt.source.seg.map(p=>E.reflect(p,uBest.axis[0],uBest.axis[1]));
for(const p of uRef)assert.equal(uOff(p,uBest.target.fixedSeg)<1e-9,true,'U0 反射後の端が背の線に乗らない');
assert.equal(uBest.span[0]>=-1e-6&&uBest.span[1]<=1+1e-6,true,'U0 辺が区間に収まっていない: '+uBest.span);
/* 画面と同じ順に engine を呼ぶ＝提案→折る側→0/90/180。背の両端と内部点が1ミリも動かない。 */
E.proposeOnFace(U,uBest.axis[0],uBest.axis[1],uOpt.source.faceId,{layers:1});
U.pending.kind='V';E.setSide(U,uBest.sidePoint);
const uIds=U.pending.candidates.map(c=>c.faceId);
const uStay=E.hingeStaysUnderFold(uBest.target.fixedSeg,uBest.target.faceIds,uIds,uBest.axis[0],uBest.axis[1],'V',uBest.sidePoint);
assert.deepEqual([uStay.ok,uStay.worst],[true,0],'U0 背が動いてしまう: '+JSON.stringify(uStay));
for(const ang of[0,90,180])assert.equal(E.preview(U,ang).move.length>0,true,`U0 ${ang}°のゴーストが出ない`);
/* 確定＝凍結した意図から軸を作り直して通す。原本には解決後の値だけ。 */
E.select(U,U.pending.candidates);
const uHinge=E.hingeIntent(U,{intervalId:'hinge:s3#1',partSrcSeg:uBest.target.part.srcSeg});
E.confirm(U,{edgeToHinge:{edge:uEdge,hinge:uHinge}});
assert.equal(U.recipe.steps.length,4,'U0 確定できない');
const uStep=U.recipe.steps[3];
assert.deepEqual(Object.keys(uStep).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'U0 原本の項目が増えた: '+Object.keys(uStep));
for(const w of['hinge','intervalId','partSrcSeg','rim:'])
 assert.equal(JSON.stringify(U.recipe).includes(w),false,`U0 原本に ${w} が漏れた`);
/* 折ったあと、つかんだ辺ぜんぶが背の線に乗っている。 */
const uOn=E.rimEdges(U).filter(e=>e.rimId==='left'&&e.faceId.startsWith('paper/s1.cut/s3.cut'))
 .map(e=>e.seg).filter(s=>s.every(p=>uOff(p,uBest.target.fixedSeg)<1e-6));
assert.equal(uOn.length,1,'U0 つかんだ辺が背の線に乗っていない');
assert.equal(Math.abs(Math.hypot(uOn[0][1][0]-uOn[0][0][0],uOn[0][1][1]-uOn[0][0][1])-1)<1e-6,true,
 'U0 乗ったのが辺ぜんぶ（長さ1）でない: '+JSON.stringify(uOn));
/* 巻き戻し→やり直しでハッシュまで戻る。 */
const uHash=U.cache.hash;E.undo(U);assert.equal(U.recipe.steps.length,3);E.redo(U);
assert.equal(U.cache.hash,uHash,'U0 やり直しで元に戻らない');
/* ★U1 吸着＝26px入る／27px入らない／44px維持／45px離れる（E2と同じ grab parameter）。 */
const U1=uState(),u1Edge=E.edgeIntent(U1,'paper/s1.cut/s3.cut','left');
const u1Src={intent:u1Edge,grabT:.5};
const u1Opt=E.edgeToHingeOptions(U1,u1Edge).options.filter(o=>o.ok&&o.target.intervalId==='hinge:s3#1')[0];
const u1Seg=E.resolveRimEdge(U1,u1Edge).seg;
const u1Grab=[(u1Seg[0][0]+u1Seg[1][0])/2,(u1Seg[0][1]+u1Seg[1][1])/2];
const u1Land=E.reflect(u1Grab,u1Opt.axis[0],u1Opt.axis[1]);
const u1Aim=(px,snapped)=>N.edgeToHingeAim(U1,u1Src,[V.toScreen(u1Land)[0]+px,V.toScreen(u1Land)[1]],V,snapped);
assert.equal(!!u1Aim(26,false).aim,true,'U1 26pxで入らない');
assert.equal(!!u1Aim(27,false).aim,false,'U1 27pxで入ってしまう');
assert.equal(!!u1Aim(44,true).aim,true,'U1 44pxまで保てない');
assert.equal(!!u1Aim(45,true).aim,false,'U1 45pxで離れない');
assert.equal(u1Aim(26,false).aim.target.intervalId,'hinge:s3#1','U1 吸着先が違う');
/* ★U2 完全に隠れた背は候補に入らない（見えている区間だけを相手にする）。 */
const U2=E.create();commit(U2,[0,-1],[0,1],[.8,0]);
E.proposeOnFace(U2,[-1,.3],[1,.3],'paper/s1.cut',{layers:1});U2.pending.kind='V';E.setSide(U2,[-.5,.8]);
E.setLayers(U2,2,U2.pending.at);E.select(U2,ref(U2));E.confirm(U2,{});
const u2Hidden=E.hingeIntervals(U2).find(h=>!h.visible);
assert.equal(u2Hidden.intervalId,'hinge:s2#2','U2 隠れた背が想定と違う');
for(const e of E.rimEdges(U2)){const o=E.edgeToHingeOptions(U2,E.edgeIntent(U2,e.faceId,e.rimId));
 assert.equal(o.options.some(v=>v.target.intervalId===u2Hidden.intervalId),false,
  'U2 隠れた背が候補に入った: '+e.edgeId)}
/* ★U3 一部しか見えない区間は、はみ出す辺を断る（可視部分だけで見る）。 */
const u3Part=E.hingeIntervals(U2).find(h=>h.intervalId==='hinge:s1#1');
assert.equal(u3Part.visible&&u3Part.visibleParts[0].t1<.999,true,'U3 一部だけ見える背になっていない');
let u3Over=0;
for(const e of E.rimEdges(U2)){const o=E.edgeToHingeOptions(U2,E.edgeIntent(U2,e.faceId,e.rimId));
 for(const v of o.options)if(v.target.intervalId==='hinge:s1#1'){
  if(v.ok){/* 通ったものは必ず「可視部分の中」に収まっている */
   assert.equal(v.span[0]>=-1e-6&&v.span[1]<=1+1e-6,true,'U3 可視部分からはみ出したのに通った');
   const len=Math.hypot(v.target.fixedSeg[1][0]-v.target.fixedSeg[0][0],v.target.fixedSeg[1][1]-v.target.fixedSeg[0][1]);
   assert.equal(len<=u3Part.visibleParts[0].len+1e-9,true,'U3 見えていない所まで相手にした')}
  else if(/収まりません/.test(v.reason||''))u3Over++}}
assert.equal(u3Over>0,true,'U3 はみ出しを断った例が無い（検査の意味がない）');
/* ★U4 別の原紙の背は候補にしない。 */
const U4=uState();
U4.cache.faces.push({faceId:'washi',layerPath:[],poly:[[-1,-1],[1,-1],[1,1],[-1,1]],xf:[1,0,0,1,0,0],layer:9});
U4.cache.bonds.push({bondId:'bx',faceIds:['washi','washi2'],stepId:'s1',kind:'hinge',seg:[[-1,-1],[1,-1]]});
const u4=E.edgeToHingeOptions(U4,E.edgeIntent(U4,'paper/s1.cut/s3.cut','left'));
assert.equal(u4.options.some(o=>String(o.target.faceIds[0]).startsWith('washi')),false,'U4 別の原紙の背が候補に入った');
/* ★U5 target 自身が動いてしまう候補は断る。 */
const u5=E.edgeToHingeOptions(U,E.edgeIntent(U,'paper/s1.cut/s3.cut/s4.keep','bottom'));
const u5moves=(u5.options||[]).filter(o=>/動いてしまいます/.test(o.reason||''));
const U5=uState();
const u5b=E.edgeToHingeOptions(U5,E.edgeIntent(U5,'paper/s1.cut/s3.cut','bottom'));
/* ⚠E3 で入れた「軸が紙を二つに分けるか」の関門が先に効くので、ここの理由はそれになる。
   「背が動く」の物差しそのものは U5b で直接固めている。 */
assert.equal(u5b.options.some(o=>!o.ok&&/紙を二つに分けません/.test(o.reason||'')),true,
 'U5 面を丸ごと裏返す候補（折りにならない）を断っていない: '+JSON.stringify(u5b.options.map(o=>[o.target.intervalId,o.ok,o.reason])));
assert.equal(u5b.options.every(o=>o.ok||/紙を二つに分けません|収まりません|動いてしまいます|小さすぎ|面を二つに分けません|乗りません/.test(o.reason||'')),true,
 'U5 知らない理由で断っている');
/* ★U5b 背の不変条件そのもの。**合わせ先が動く側にある形**は、切り分けもできず断る。
   （本命は「背が止まる側にある」から通る。ここでは逆の配置を直接作って見る。） */
const u5Seg=E.hingeIntervals(U5).find(h=>h.intervalId==='hinge:s3#1').visibleParts[0].seg;
const u5Faces=E.hingeIntervals(U5).find(h=>h.intervalId==='hinge:s3#1').faceIds;
const u5Axis=[[-2,-2],[2,-2]],u5Side=[0,0];/* 線 y=-2 で、背も印も同じ側＝背は丸ごと動く側 */
const u5fix=E.fixedHingePart(u5Seg,u5Faces,[u5Faces[1]],u5Axis[0],u5Axis[1],u5Side);
assert.equal(u5fix.seg,null,'U5b 動く側にある背を固定部分として返した');
assert.match(u5fix.reason,/動いてしまいます/,'U5b 断る理由が違う: '+u5fix.reason);
const u5stay=E.hingeStaysUnderFold(u5Seg,u5Faces,[u5Faces[1]],u5Axis[0],u5Axis[1],'V',u5Side);
assert.equal(u5stay.ok,false,'U5b 0°/90°/180°の不動検査が通ってしまった');
assert.equal(u5stay.worst>.1,true,'U5b いくら動いたかを測っていない: '+u5stay.worst);
/* 接している面がどちらも動かなければ、当然不動（機械的に断らない）。 */
assert.deepEqual([E.hingeStaysUnderFold(u5Seg,u5Faces,[],u5Axis[0],u5Axis[1],'V',u5Side).ok,
 E.fixedHingePart(u5Seg,u5Faces,[],u5Axis[0],u5Axis[1],u5Side).cut],[true,false],
 'U5b 動かない面だけのときに断った');
/* 本命の配置（背は止まる側）は、対象面に両側が入っていても不動で通る。 */
const u5ok=E.verifyEdgeToHinge(U5,E.edgeIntent(U5,'paper/s1.cut/s3.cut','left'),
 E.hingeIntent(U5,{intervalId:'hinge:s3#1',
  partSrcSeg:E.hingeIntervals(U5).find(h=>h.intervalId==='hinge:s3#1').visibleParts[0].srcSeg}),
 uBest.axis[0],uBest.axis[1],null,['paper/s1.cut/s3.cut'],'V');
assert.equal(u5ok.ok,true,'U5b 本命を断った: '+u5ok.reason);
assert.equal(u5ok.stationary,0,'U5b 本命の不動誤差が0でない: '+u5ok.stationary);
/* ★U5c 順位の決めごとそのもの（同じ軸なら折り目／同点なら選ばない）。 */
const ax1=[[0,0],[1,0]],ax2=[[0,0],[0,1]];
assert.equal(N.preferCreaseOverHinge({axis:ax1,px:10},{axis:ax1,px:1}),'crease','U5c 同じ軸で折り目が勝たない');
assert.equal(N.preferCreaseOverHinge({axis:ax1,px:10},{axis:ax2,px:11}),'ambiguous','U5c 別軸の同点を選んでしまう');
assert.equal(N.preferCreaseOverHinge({axis:ax1,px:30},{axis:ax2,px:10}),'hinge','U5c はっきり近い背を選べない');
assert.equal(N.preferCreaseOverHinge(null,{axis:ax2,px:10}),'hinge','U5c 背だけのとき選べない');
assert.equal(N.preferCreaseOverHinge({axis:ax1,px:10},null),'crease','U5c 折り目だけのとき選べない');
/* ★U6 微小な折り・自己一致は断る（E2の関門そのまま）。 */
assert.equal(E.axesEdgeToCrease([[0,0],[1,0]],[[0,0],[1,0]]).length,0,'U6 自分自身への一致を候補にした');
const u6=E.checkEdgeToCrease([[0,-.001],[1,-.001]],[[0,0],[1,0]],[[0,-.002],[1,-.002]]);
assert.equal(u6.ok,false,'U6 微小な折りを通した');
assert.match(u6.reason,/小さすぎ/,'U6 断る理由が違う: '+u6.reason);
/* ★U7 別の軸が同点なら選ばない（背が2つ）。 */
const U7=uState(),u7Edge=E.edgeIntent(U7,'paper/s1.keep/s2.keep/s3.keep','top');
const u7=E.edgeToHingeOptions(U7,u7Edge).options.filter(o=>o.ok);
assert.equal(new Set(u7.map(o=>o.target.intervalId)).size>=2,true,'U7 別軸の候補が2つ出ない');
const u7Seg=E.resolveRimEdge(U7,u7Edge).seg,u7Grab=[(u7Seg[0][0]+u7Seg[1][0])/2,(u7Seg[0][1]+u7Seg[1][1])/2];
const u7Lands=u7.map(o=>V.toScreen(E.reflect(u7Grab,o.axis[0],o.axis[1])));
const u7Mid=[(u7Lands[0][0]+u7Lands[1][0])/2,(u7Lands[0][1]+u7Lands[1][1])/2];
const u7Aim=N.edgeToHingeAim(U7,{intent:u7Edge,grabT:.5},u7Mid,V,false);
assert.equal(u7Aim.aim,null,'U7 同点なのに選んだ');
assert.equal(u7Aim.reason,'合わせる背を特定できません','U7 断る理由が違う: '+u7Aim.reason);
/* ★U8 rim セッションの順位＝同じ幾何軸なら折り目を優先／別軸が同点なら選ばない。 */
assert.equal(N.rimTargetAim(U7,{intent:u7Edge,grabT:.5},u7Mid,V,false).reason,'合わせる背を特定できません',
 'U8 背の曖昧さが rim の合成で消えた');
/* ★U9 確定の関門：偽の角・古い候補・別区間への誤解決を断る（断っても原本は動かない）。 */
const U9=uState(),u9Edge=E.edgeIntent(U9,'paper/s1.cut/s3.cut','left');
const u9Best=E.edgeToHingeOptions(U9,u9Edge).options.filter(o=>o.ok&&o.target.intervalId==='hinge:s3#1')[0];
E.proposeOnFace(U9,u9Best.axis[0],u9Best.axis[1],'paper/s1.cut/s3.cut',{layers:1});
U9.pending.kind='V';E.setSide(U9,u9Best.sidePoint);E.select(U9,U9.pending.candidates);
const u9Hinge=E.hingeIntent(U9,{intervalId:'hinge:s3#1',partSrcSeg:u9Best.target.part.srcSeg});
const u9Rec=JSON.stringify(U9.recipe),u9Rev=U9.revision;
assert.throws(()=>E.confirm(U9,{edgeToHinge:{edge:u9Edge,hinge:u9Hinge,corner:[0,0]}}),
 /つかんだ角が、合わせる辺の端にありません/,'U9 偽の角を通した');
assert.equal(JSON.stringify(U9.recipe),u9Rec,'U9 断ったのに原本が動いた');
assert.equal(U9.revision,u9Rev,'U9 断ったのに revision が動いた');
/* 別の背（別区間）を渡したら、軸が作り直せないので断る。 */
assert.throws(()=>E.confirm(U9,{edgeToHinge:{edge:u9Edge,hinge:E.hingeIntent(U9,'hinge:s2#1')}}),
 /折軸が、つかんだ辺と折った背から作り直せません|合わせ先の背/,'U9 別の背を通した');
E.cancel(U9);
/* 古い候補は確定できない（revision の見張りは従来どおり）。 */
const U9b=uState();
E.proposeOnFace(U9b,u9Best.axis[0],u9Best.axis[1],'paper/s1.cut/s3.cut',{layers:1});
U9b.pending.kind='V';E.setSide(U9b,u9Best.sidePoint);E.select(U9b,U9b.pending.candidates);
U9b.revision++;
assert.throws(()=>E.confirm(U9b,{edgeToHinge:{edge:u9Edge,hinge:u9Hinge}}),/古くなっています/,'U9 古い候補を確定した');
/* ★U10 後続の分割で別区間になった背への誤解決を断る。 */
const U10=E.create();commit(U10,[0,-1],[0,1],[.8,0]);
const u10Intent=E.hingeIntent(U10,'hinge:s1#1');
E.proposeOnFace(U10,[-1,.3],[1,.3],'paper/s1.cut',{layers:1});U10.pending.kind='V';E.setSide(U10,[-.5,.8]);
E.setLayers(U10,2,U10.pending.at);E.select(U10,ref(U10));E.confirm(U10,{});
const u10v=E.verifyEdgeToHinge(U10,E.edgeIntent(U10,'paper/s1.keep/s2.cut','left'),u10Intent,[0,0],[1,0],null,[],'V');
assert.equal(u10v.ok,false,'U10 切り分けられた背へ誤って解決した');
assert.match(u10v.reason,/同じ区間ではありません|折軸が/,'U10 断る理由が違う: '+u10v.reason);
/* ★U11 画面の原文。 */
const uiU=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.equal(/N\.rimTargetAim\(/.test(uiU),true,'U11 辺セッションが折り目と背を比べていない');
assert.equal(/N\.cornerTargetAim\(/.test(uiU),true,'U11 角セッションが背を見ていない');
assert.equal(/meta\.edgeToHinge=\{edge:/.test(uiU),true,'U11 確定時に背の意図を渡していない');
assert.equal(/'折った背'/.test(uiU),true,'U11 説明文で「折った背」と書き分けていない');
assert.equal(/E\.edgeToHingeOptions\(|E\.hingeStaysUnderFold\(/.test(uiU),false,'U11 画面が幾何の判定を直に呼んでいる');

/* ============ V（🪚 E3＝つかんだ外周辺を「見えている別の外周辺」へ合わせる）============
   幾何と関門は E2/H2 の再利用（角二等分線・包含・26/44px・曖昧拒否・原子的確定・固定部分への切り分け）。
   target の条件＝①同じ原紙②別の区間（別の面）③最上面に見えている④提案中も動かない。 */
const vState=uState;/* H2 と同じ3手（画像と同じ構造） */
/* ★E3a 本命＝土台の左辺を、**折ったフラップの見えている左辺**へ。
   ⚠逆向き（フラップ→土台）は、この形では**軸がフラップの紙を二つに分けない**
   （面を丸ごと裏返すだけで折りにならない）ので、engine が正しく断る→下の E3a-rev で固定。 */
const E3a=vState(),vEdge=E.edgeIntent(E3a,'paper/s1.cut/s3.keep','left');
const vOpt=E.edgeToEdgeOptions(E3a,vEdge);
const vBest=vOpt.options.filter(e3_o=>e3_o.ok&&e3_o.target.edgeId==='rim:left|paper/s1.cut/s3.cut')[0];
/* 逆向きは全候補が「紙を二つに分けません」で断られる（E3a-rev）。 */
const vRevOpt=E.edgeToEdgeOptions(E3a,E.edgeIntent(E3a,'paper/s1.cut/s3.cut','left'))
 .options.filter(e3_o=>e3_o.target.edgeId==='rim:left|paper/s1.cut/s3.keep');
assert.equal(vRevOpt.length>0&&vRevOpt.every(e3_o=>!e3_o.ok&&/紙を二つに分けません/.test(e3_o.reason||'')),true,
 'E3a-rev 面を丸ごと裏返す候補を通した: '+JSON.stringify(vRevOpt.map(e3_o=>[e3_o.ok,e3_o.reason])));
assert.equal(!!vBest,true,'E3a 本命の候補が出ない: '+JSON.stringify(vOpt.options.map(e3_o=>[e3_o.target.edgeId,e3_o.reason])));
assert.equal(vBest.kind,'bisector','E3a 軸が角二等分線でない');
assert.equal(vBest.stationary,0,'E3a 合わせ先が動かない検査を通っていない: '+vBest.stationary);
assert.equal(vBest.span[0]>=-1e-6&&vBest.span[1]<=1+1e-6,true,'E3a 辺ぜんぶが相手の区間に収まっていない: '+vBest.span);
const vRef=vOpt.source.seg.map(e3_p=>E.reflect(e3_p,vBest.axis[0],vBest.axis[1]));
for(const e3_p of vRef)assert.equal(uOff(e3_p,vBest.target.fixedSeg)<1e-9,true,'E3a 反射後の端が相手のふちに乗らない');
/* 画面と同じ順に engine を呼ぶ。 */
E.proposeOnFace(E3a,vBest.axis[0],vBest.axis[1],vOpt.source.faceId,{layers:1});
E3a.pending.kind='V';E.setSide(E3a,vBest.sidePoint);
for(const e3_ang of[0,90,180])assert.equal(E.preview(E3a,e3_ang).move.length>0,true,`E3a ${e3_ang}°のゴーストが出ない`);
const vIds=E3a.pending.candidates.map(c=>c.faceId);
assert.equal(vIds.includes('paper/s1.cut/s3.cut'),false,'E3a 合わせ先の面を動かしてしまう');
E.select(E3a,E3a.pending.candidates);
const vTgt=E.edgeIntent(E3a,'paper/s1.cut/s3.cut','left');
E.confirm(E3a,{edgeToEdge:{edge:vEdge,target:vTgt}});
assert.equal(E3a.recipe.steps.length,4,'E3a 確定できない');
const vStep=E3a.recipe.steps[3];
assert.deepEqual(Object.keys(vStep).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'E3a 原本の項目が増えた: '+Object.keys(vStep));
for(const e3_w of['rim:','edgeId','intervalId','hinge'])
 assert.equal(JSON.stringify(E3a.recipe).includes(e3_w),false,`E3a 原本に ${e3_w} が漏れた`);
/* 折ったあと、つかんだ辺ぜんぶ（長さ1）が土台の左辺の線に乗っている。 */
const vOn=E.rimEdges(E3a).filter(e3_e=>e3_e.faceId.startsWith('paper/s1.cut/s3.keep'))
 .map(e3_e=>e3_e.seg).filter(s=>s.every(e3_p=>uOff(e3_p,vBest.target.fixedSeg)<1e-6));
assert.equal(vOn.length,1,'E3a つかんだ辺が相手のふちの線に乗っていない');
assert.equal(Math.abs(Math.hypot(vOn[0][1][0]-vOn[0][0][0],vOn[0][1][1]-vOn[0][0][1])-1)<1e-6,true,
 'E3a 乗ったのが辺ぜんぶ（長さ1）でない: '+JSON.stringify(vOn));
/* 合わせ先の面は形も置き方も1ミリも動いていない。 */
const vKept=E3a.cache.faces.find(f=>f.faceId==='paper/s1.cut/s3.cut');
assert.deepEqual(rd(vKept.poly.flat()),rd([[-.2,.6],[.4,-.2],[0,-.5],[-1,0]].flat()),'E3a 合わせ先の面が動いた');
const vHash=E3a.cache.hash;E.undo(E3a);assert.equal(E3a.recipe.steps.length,3);E.redo(E3a);
assert.equal(E3a.cache.hash,vHash,'E3a やり直しで元に戻らない');
/* ⚠以下は確定前の紙で見る（E3a の状態はもう4手目が入っている）。 */
const E3g=vState(),vgOpt=E.edgeToEdgeOptions(E3g,E.edgeIntent(E3g,'paper/s1.cut/s3.keep','left'));
/* ★E3a-2 同じ面の足元の辺は相手にしない（基準の面には他のふちもある）。 */
assert.equal(E.rimEdges(E3g).filter(e3_e=>e3_e.faceId===vgOpt.source.faceId).length>1,true,
 'E3a-2 基準の面にふちが1本しかない（検査の意味がない）');
assert.equal(vgOpt.options.every(e3_o=>e3_o.target.faceId!==vgOpt.source.faceId),true,
 'E3a-2 同じ面の足元の辺を相手にした: '+JSON.stringify(vgOpt.options.map(e3_o=>e3_o.target.edgeId)));
/* ★E3a-3 合わせ先が一部だけ固定なら、**固定部分へ切り分けて**評価する（黙って短縮しない）。 */
const vCutOpt=E.edgeToEdgeOptions(E3g,E.edgeIntent(E3g,'paper/s1.cut/s3.keep','top'))
 .options.filter(e3_o=>e3_o.ok&&e3_o.target.edgeId==='rim:right|paper/s1.keep/s2.keep/s3.keep')[0];
assert.equal(!!vCutOpt,true,'E3a-3 切り分けの例が出ない');
assert.equal(vCutOpt.target.cut,true,'E3a-3 固定部分への切り分けを通っていない');
/* 切り分けそのもの：軸が相手の真ん中を横切るときは、**止まる側の半分だけ**になる。 */
const vHalf=E.fixedHingePart([[0,-1],[0,1]],['f'],['f'],[-1,0],[1,0],[0,-.5]);
assert.deepEqual([vHalf.cut,rd(vHalf.seg[0]),rd(vHalf.seg[1])],[true,[0,0],[0,1]],
 'E3a-3 固定部分への切り分けが違う: '+JSON.stringify(vHalf));
/* ★E3a-4 別の軸が同点なら選ばない（ふちが2つ）。 */
const vTieEdge=E.edgeIntent(E3g,'paper/s1.keep/s2.keep/s3.keep','top');
const vTie=E.edgeToEdgeOptions(E3g,vTieEdge).options.filter(e3_o=>e3_o.ok);
assert.equal(new Set(vTie.map(e3_o=>e3_o.target.edgeId)).size>=2,true,'E3a-4 別軸の候補が2つ出ない');
const vTieSeg=E.resolveRimEdge(E3g,vTieEdge).seg;
const vTieGrab=[(vTieSeg[0][0]+vTieSeg[1][0])/2,(vTieSeg[0][1]+vTieSeg[1][1])/2];
const vTieLands=vTie.map(e3_o=>V.toScreen(E.reflect(vTieGrab,e3_o.axis[0],e3_o.axis[1])));
const vTieMid=[(vTieLands[0][0]+vTieLands[1][0])/2,(vTieLands[0][1]+vTieLands[1][1])/2];
const vTieAim=N.edgeToEdgeAim(E3g,{intent:vTieEdge,grabT:.5},vTieMid,V,false);
assert.equal(vTieAim.aim,null,'E3a-4 同点なのに選んだ');
assert.equal(vTieAim.reason,'合わせるふちを特定できません','E3a-4 断る理由が違う: '+vTieAim.reason);
/* ★E3b 吸着＝26/27/44/45px（E2/H2 と同じ grab parameter）。 */
const E3b=vState(),v1Edge=E.edgeIntent(E3b,'paper/s1.cut/s3.keep','left');
const v1Best=E.edgeToEdgeOptions(E3b,v1Edge).options.filter(e3_o=>e3_o.ok&&e3_o.target.edgeId==='rim:left|paper/s1.cut/s3.cut')[0];
const v1Seg=E.resolveRimEdge(E3b,v1Edge).seg,v1Grab=[(v1Seg[0][0]+v1Seg[1][0])/2,(v1Seg[0][1]+v1Seg[1][1])/2];
const v1Land=E.reflect(v1Grab,v1Best.axis[0],v1Best.axis[1]);
const v1Aim=(px,sn)=>N.edgeToEdgeAim(E3b,{intent:v1Edge,grabT:.5},[V.toScreen(v1Land)[0]+px,V.toScreen(v1Land)[1]],V,sn);
assert.equal(!!v1Aim(26,false).aim,true,'E3b 26pxで入らない');
assert.equal(!!v1Aim(27,false).aim,false,'E3b 27pxで入ってしまう');
assert.equal(!!v1Aim(44,true).aim,true,'E3b 44pxまで保てない');
assert.equal(!!v1Aim(45,true).aim,false,'E3b 45pxで離れない');
assert.equal(v1Aim(26,false).aim.target.edgeId,'rim:left|paper/s1.cut/s3.cut','E3b 吸着先が違う');
/* ★E3c 隠れたふちは候補にしない（半分折りで下になった面のふち）。 */
const E3c=E.create();commit(E3c,[0,-1],[0,1],[.8,0]);
const v2Hidden=E.rimEdges(E3c).filter(e3_e=>!E.rimEdgeVisible(E3c,e3_e));
assert.equal(v2Hidden.length>0,true,'E3c 隠れたふちが無い（検査の意味がない）');
assert.equal(v2Hidden.every(e3_e=>e3_e.faceId==='paper/s1.keep'),true,'E3c 隠れた側が下の面でない: '+JSON.stringify(v2Hidden.map(e3_e=>e3_e.edgeId)));
for(const e3_e of E.rimEdges(E3c)){const e3_o=E.edgeToEdgeOptions(E3c,E.edgeIntent(E3c,e3_e.faceId,e3_e.rimId));
 for(const e3_v of e3_o.options)assert.equal(v2Hidden.some(h=>h.edgeId===e3_v.target.edgeId),false,
  'E3c 隠れたふちが候補に入った: '+e3_v.target.edgeId)}
/* ★E3d 別の原紙のふちは候補にしない。 */
const E3d=vState();
E3d.cache.faces.push({faceId:'washi',layerPath:[],poly:[[-1,-1],[1,-1],[1,1],[-1,1]],xf:[1,0,0,1,0,0],layer:9});
const e3_v3=E.edgeToEdgeOptions(E3d,E.edgeIntent(E3d,'paper/s1.cut/s3.keep','left'));
assert.equal(e3_v3.options.some(e3_o=>String(e3_o.target.faceId).startsWith('washi')),false,'E3d 別の原紙のふちが候補に入った');
/* ★V4 部分包含（はみ出し）は断る。 */
let v4=0;
for(const e3_e of E.rimEdges(E3a)){const e3_o=E.edgeToEdgeOptions(E3a,E.edgeIntent(E3a,e3_e.faceId,e3_e.rimId));
 for(const e3_v of e3_o.options)if(!e3_v.ok&&/収まりません/.test(e3_v.reason||''))v4++}
assert.equal(v4>0,true,'V4 はみ出しを断った例が無い（検査の意味がない）');
/* ★E3e 合わせ先が動く候補は断る（実測の例）。 */
const E3e=vState();
const v5=E.edgeToEdgeOptions(E3e,E.edgeIntent(E3e,'paper/s1.keep/s2.keep/s3.keep','top'));
/* ⚠この向きでは「軸が紙を二つに分けるか」の関門が先に効く（面を丸ごと裏返す候補）。
   「合わせ先が動く」の物差しそのものはすぐ下で直接固める。 */
assert.equal(v5.options.some(e3_o=>!e3_o.ok&&/紙を二つに分けません/.test(e3_o.reason||'')),true,
 'E3e 面を丸ごと裏返す候補を断っていない: '+JSON.stringify(v5.options.map(e3_o=>[e3_o.target.edgeId,e3_o.ok,e3_o.reason])));
assert.equal(v5.options.every(e3_o=>e3_o.ok||/紙を二つに分けません|収まりません|動いてしまいます|小さすぎ|面を二つに分けません|乗りません/.test(e3_o.reason||'')),true,
 'E3e 知らない理由で断っている');
/* 不動の物差しそのもの（H2 と同じ関数を使っている）。 */
const v5Tg=E.rimEdges(E3e).find(e3_e=>e3_e.edgeId==='rim:left|paper/s1.cut/s3.keep');
const v5bad=E.fixedHingePart(v5Tg.seg,[v5Tg.faceId],[v5Tg.faceId],[-2,-2],[2,-2],[0,0]);
assert.equal(v5bad.seg,null,'E3e 動く側にある合わせ先を固定部分として返した');
/* ★V6 順位＝折り目 > 折った背 > 紙のふち。同じ軸なら意味の強い方、別軸の同点は選ばない。 */
const vax1=[[0,0],[1,0]],vax2=[[0,0],[0,1]];
assert.equal(N.preferTargetAim([{targetKind:'edge',axis:vax1,px:1},{targetKind:'hinge',axis:vax1,px:2}]).pick.targetKind,
 'hinge','V6 同じ軸で背がふちに勝たない');
assert.equal(N.preferTargetAim([{targetKind:'edge',axis:vax1,px:1},{targetKind:'crease',axis:vax1,px:3}]).pick.targetKind,
 'crease','V6 同じ軸で折り目がふちに勝たない');
assert.equal(N.preferTargetAim([{targetKind:'edge',axis:vax1,px:10},{targetKind:'hinge',axis:vax2,px:11}]).reason,
 '合わせ先を特定できません','V6 別軸の同点を選んでしまう');
assert.equal(N.preferTargetAim([{targetKind:'edge',axis:vax1,px:10},{targetKind:'crease',axis:vax2,px:40}]).pick.targetKind,
 'edge','V6 はっきり近いふちを選べない');
assert.equal(N.preferTargetAim([]).pick,null,'V6 候補なしで何かを選んだ');
/* ★E3f 確定の関門。 */
const E3f=vState(),v7Edge=E.edgeIntent(E3f,'paper/s1.cut/s3.keep','left');
const v7Best=E.edgeToEdgeOptions(E3f,v7Edge).options.filter(e3_o=>e3_o.ok&&e3_o.target.edgeId==='rim:left|paper/s1.cut/s3.cut')[0];
E.proposeOnFace(E3f,v7Best.axis[0],v7Best.axis[1],'paper/s1.cut/s3.keep',{layers:1});
E3f.pending.kind='V';E.setSide(E3f,v7Best.sidePoint);E.select(E3f,E3f.pending.candidates);
const v7Tgt=E.edgeIntent(E3f,'paper/s1.cut/s3.cut','left'),v7Rec=JSON.stringify(E3f.recipe),v7Rev=E3f.revision;
assert.throws(()=>E.confirm(E3f,{edgeToEdge:{edge:v7Edge,target:v7Tgt,corner:[0,0]}}),
 /つかんだ角が、合わせる辺の端にありません/,'E3f 偽の角を通した');
assert.throws(()=>E.confirm(E3f,{edgeToEdge:{edge:v7Edge,target:v7Edge}}),/同じ辺へは合わせられません/,'E3f 同じ辺を通した');
assert.equal(JSON.stringify(E3f.recipe),v7Rec,'E3f 断ったのに原本が動いた');
assert.equal(E3f.revision,v7Rev,'E3f 断ったのに revision が動いた');
/* 正しい意図なら通る。 */
assert.equal(E.verifyEdgeToEdge(E3f,v7Edge,v7Tgt,v7Best.axis[0],v7Best.axis[1],null,['paper/s1.cut/s3.keep'],'V').ok,
 true,'E3f 本命を断った');
/* 隠れているふちを相手にした意図は、確定の関門で断る（半分折りで下になったふち）。 */
const v7h=E.create();commit(v7h,[0,-1],[0,1],[.8,0]);
const v7hid=E.rimEdges(v7h).filter(e3_e=>!E.rimEdgeVisible(v7h,e3_e))[0];
const v7v=E.verifyEdgeToEdge(v7h,E.edgeIntent(v7h,'paper/s1.cut','top'),
 E.edgeIntent(v7h,v7hid.faceId,v7hid.rimId),[0,0],[1,0],null,['paper/s1.cut'],'V');
assert.equal(v7v.ok,false,'E3f 隠れているふちを通した');
assert.match(v7v.reason,/見えていません/,'E3f 断る理由が違う: '+v7v.reason);
E.cancel(E3f);
/* ★V8 画面の原文。 */
const uiV=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.equal(/meta\.edgeToEdge=\{edge:/.test(uiV),true,'V8 確定時にふちの意図を渡していない');
assert.equal(/targetKind==='edge'/.test(uiV),true,'V8 ふち相手の言い分けが無い');
assert.equal(/E\.edgeToEdgeOptions\(|E\.rimEdgeVisible\(/.test(uiV),false,'V8 画面が幾何の判定を直に呼んでいる');

/* ============ J（B2b）画面は面の集合を自分で作らない。原文で見張る ============ */
const uiSrc=fs.readFileSync(path.join(__dirname,'freefold3d.html'),'utf8');
assert.equal(/E\.select\(/.test(uiSrc),true,'J 画面が select を呼んでいない');
for(const m of uiSrc.matchAll(/E\.select\(([^)]*)\)/g))
 assert.equal(m[1].replace(/\s/g,''),'state,state.pending.candidates','J engine の候補以外を select に渡している: '+m[1]);
/* setLayers に渡してよいのは「枚数」と「この場所」だけ＝faceId の集合を画面が組み立てない。 */
/* ⚠いま見せている紙は state か、複合操作の派生状態（ST()）。どちらでも渡すのは枚数と場所だけ。 */
for(const m of uiSrc.matchAll(/E\.setLayers\((.*?)\);/g))
 assert.match(m[1].replace(/\s/g,''),/^(state|ST\(\)),[A-Za-z0-9_.]+,layerPick\.at$/,'J setLayers に枚数と場所以外が渡っている: '+m[1]);
/* 🗂 「折線のこの側を全部」（2026-09-15）も同じ＝渡すのは紙と「この場所」だけ（面の集合は engine の setSideAll が紙全体から求める）。 */
assert.equal(/E\.setSideAll\(/.test(uiSrc),true,'J 画面が setSideAll を呼んでいない');
for(const m of uiSrc.matchAll(/E\.setSideAll\(([^()]*(?:\(\))?[^()]*)\)/g))
 assert.match(m[1].replace(/\s/g,''),/^(state|ST\(\)),layerPick\.at$/,'J setSideAll に場所以外が渡っている: '+m[1]);
/* 🪶 「つながっているフラップ」（2026-09-16）も同じ＝渡すのは紙と「この場所」だけ（面の集合は engine の setFlap がたどる）。 */
assert.equal(/E\.setFlap\(/.test(uiSrc),true,'J 画面が setFlap を呼んでいない');
for(const m of uiSrc.matchAll(/E\.setFlap\(([^()]*(?:\(\))?[^()]*)\)/g))
 assert.match(m[1].replace(/\s/g,''),/^(state|ST\(\)),layerPick\.at$/,'J setFlap に場所以外が渡っている: '+m[1]);
/* ✏️ 2026-09-15（本人判断）：折り目だけ（crease）は候補の操作 op を engine が持ち、提案・枚数選び・プレビュー・確定・再生で同じ芯（creasableSet）を通る。
   画面が proposeOnFace に渡すのは操作の種類（凍結したセッションの asCrease から opOf、線は 'crease'）だけ。成立は E.pendingCheck が決める。 */
for(const m of uiSrc.matchAll(/E\.proposeOnFace\(state,(.*?)\);/g))
 assert.match(m[1].replace(/\s/g,''),/,\{(layers:1,)?op:(opOf\(dragSession\)|'crease')\}$/,'J 提案に操作の種類が渡っていない: '+m[1]);
assert.equal(/E\.foldability\(/.test(uiSrc),false,'J 画面が折りの判定を直に選んでいる（E.pendingCheck を使う）');
assert.equal(/E\.pendingCheck\(ST\(\)\)/.test(uiSrc),true,'J 画面の成立判定が engine の pendingCheck を通っていない');
/* 面ごとに選ばせる入力は作らない＝中間層・飛び飛びを選べるUIそのものを置かない。 */
assert.equal(/type\s*=\s*['"]?checkbox/.test(uiSrc),false,'J 面ごとのチェックボックスがある');
assert.equal(/createElement\(['"]input['"]\)/.test(uiSrc),false,'J 画面が入力欄を作って面を選ばせている');
assert.equal(/topFaces\(/.test(uiSrc),false,'J 画面が topFaces を直に呼んでいる（枚数は setLayers 経由だけにする）');
/* 🚧 foldability だけは画面から直に聞いてよい（2026-09-13）＝「折れるか」の答えを engine 以外が作らないため。
   ⚠ただし呼ぶのは1か所だけ／渡すのは **engine が作った候補そのもの** だけ＝画面は面の集合を組み立てない。 */
/* ✏️ 2026-09-15：画面が聞くのは E.pendingCheck(ST()) の1か所だけ（engine がいまの候補の candidates・操作 op で foldability／creasability を選ぶ）。
   画面は面の集合も判定の種類も渡さない。 */
const fold5=[...uiSrc.matchAll(/E\.pendingCheck\(((?:[^()]|\([^()]*\))*)\)/g)];
assert.equal(fold5.length,1,'J 画面が成立判定を1か所より多く呼んでいる: '+fold5.length);
assert.equal(fold5[0][1].replace(/\s/g,''),'ST()','J pendingCheck に候補以外を渡している: '+fold5[0][1]);

/* ============ X（2026-09-13）flip＝紙ぜんぶの裏返し ============
   v1スキーマの op:'flip'（axis:"v"|"h"）をそのまま使う。規則は本番 fold2d.flip と同じ：
   poly を鏡映／xf に合成（det が反転＝表裏が入れかわる）／layer の符号を反転／**折り筋は増えない**。
   ⚠局所的な「うしろにおる」は op:'fold' の kind:'M'。flip は折線も動く側も持たない（スキーマが禁じている）。 */
/* X0 1回の裏返し＝面は1枚も割れない。 */
const X0=E.create();const x0before=C0(X0.cache);
const x0=E.flip(X0,'v');
assert.deepEqual(X0.recipe.steps.map(s=>s.op),['flip'],'X0 op が flip でない');
assert.deepEqual(Object.keys(X0.recipe.steps[0]).sort(),['axis','diagramStep','id','instruction','op'],
 'X0 flip の手に余計な項目がある: '+JSON.stringify(X0.recipe.steps[0]));
assert.equal(X0.recipe.steps[0].axis,'v','X0 axis が v でない');
assert.equal(x0.faces.length,x0before.faces.length,'X0 裏返しで面が増えた');
assert.deepEqual(x0.faces.map(f=>f.faceId),x0before.faces.map(f=>f.faceId),'X0 faceId が変わった');
assert.deepEqual(x0.faces.map(f=>f.layerPath),x0before.faces.map(f=>f.layerPath),'X0 layerPath が変わった');
assert.deepEqual(x0.faces[0].xf,[-1,0,0,1,0,0],'X0 xf が鏡映になっていない');
assert.equal(E.detXf(x0.faces[0].xf)<0,true,'X0 裏になっていない');
assert.deepEqual(rd(x0.faces[0].poly.map(p=>p)[0]),[1,-1],'X0 poly が鏡映になっていない');
/* X1 2回で完全に元へ戻る（ハッシュまで）。 */
const X1=E.create();const hx1=X1.cache.hash;
E.flip(X1,'v');assert.notEqual(X1.cache.hash,hx1,'X1 1回でハッシュが動かない');
E.flip(X1,'v');assert.equal(X1.cache.hash,hx1,'X1 2回で元に戻らない');
assert.equal(X1.recipe.steps.length,2,'X1 手数が2でない');
/* X2 flip のあとに折る＝**JSON の kind はユーザーが選んだまま**（勝手に反転しない）。
   表裏を含む再生結果が本番と一致するかは、Python 突き合わせ（原本 flipped）が見る。 */
const FL=E.create();E.flip(FL,'v');
const fx1=N.creaseForCorners(FL,[1,-1],[.2,-.4]);
commit(FL,fx1.line[0],fx1.line[1],fx1.sidePoint,'V');
assert.equal(FL.recipe.steps[1].kind,'V','X2 選んだ谷折りが JSON で反転された');
E.flip(FL,'h');
const fx2=N.creaseForCorners(FL,[-1,1],[-.4,.5]);
E.proposeOnFace(FL,fx2.line[0],fx2.line[1],fx2.faceId,{layers:1});FL.pending.kind='M';
E.setSide(FL,fx2.sidePoint);E.select(FL,ref(FL));E.confirm(FL);
assert.deepEqual(FL.recipe.steps.map(s=>s.op),['flip','fold','flip','fold'],'X2 手順の並びが違う');
assert.deepEqual(FL.recipe.steps.filter(s=>s.op==='fold').map(s=>s.kind),['V','M'],'X2 選んだ山谷が JSON で変わった');
assert.equal(FL.recipe.steps[2].axis,'h','X2 2回目の axis が h でない');
/* X3 巻き戻し・やり直しが flip をまたいでも効く（redo は折りの関門を通さない道を持つ）。 */
const hFL=FL.cache.hash,recFL=JSON.stringify(FL.recipe);
E.undo(FL);E.undo(FL);assert.equal(FL.recipe.steps.length,2,'X3 巻き戻せない');
assert.doesNotThrow(()=>{E.redo(FL);E.redo(FL)},'X3 裏返しをまたぐやり直しができない');
assert.equal(FL.cache.hash,hFL,'X3 やり直しでハッシュが戻らない');
assert.equal(JSON.stringify(FL.recipe),recFL,'X3 やり直しで原本が戻らない');
/* X4 表裏は det で決まる＝裏返すたびに入れかわる。 */
const X4=E.create();
assert.deepEqual(X4.cache.faces.map(f=>E.detXf(f.xf)<0),[false],'X4 最初が裏になっている');
E.flip(X4,'v');assert.deepEqual(X4.cache.faces.map(f=>E.detXf(f.xf)<0),[true],'X4 裏返して裏にならない');
E.flip(X4,'h');assert.deepEqual(X4.cache.faces.map(f=>E.detXf(f.xf)<0),[false],'X4 2回裏返して表に戻らない');
/* X5 安定IDは素材座標で作るので裏返しても変わらない。折り目の線は「いまの座標」なので写っている。 */
const X5=E.create();
commit(X5,[0,-1],[0,1],[.5,0]);/* 半分折り＝ヒンジができる */
const X5b=E.create();commit(X5b,[.4,-1],[.4,1],[.8,0],'V');
const cx5=N.creaseForCorners(X5b,[-1,-1],[-1,1]);void cx5;
const X5c=E.create();E.propose(X5c,[-.3,-1],[-.3,1]);X5c.pending.kind='V';E.setSide(X5c,[.5,0]);
E.select(X5c,ref(X5c));E.confirm(X5c,{op:'crease'});
const idsBefore={rim:E.rimEdges(X5c).map(e=>e.edgeId),cre:E.creaseIntervals(X5c).map(c=>c.intervalId)};
const segBefore=X5c.cache.creases.map(c=>C0(c.seg));
const bondBefore=C0(X5c.cache.bonds);
E.flip(X5c,'v');
assert.deepEqual(E.rimEdges(X5c).map(e=>e.edgeId),idsBefore.rim,'X5 裏返しで外周辺のIDが変わった');
assert.deepEqual(E.creaseIntervals(X5c).map(c=>c.intervalId),idsBefore.cre,'X5 裏返しで折り目の区間IDが変わった');
assert.deepEqual(X5c.cache.bonds,bondBefore,'X5 裏返しで結び（素材座標）が動いた');
assert.deepEqual(X5c.cache.creases.map(c=>rd(c.seg[0])),segBefore.map(s=>rd([-s[0][0],s[0][1]])),
 'X5 折り目の線（いまの座標）が鏡映されていない');
const X5h=E.create();commit(X5h,[0,-1],[0,1],[.5,0]);
const hx5=E.hingeIntervals(X5h).map(h=>h.intervalId);
E.flip(X5h,'v');
assert.deepEqual(E.hingeIntervals(X5h).map(h=>h.intervalId),hx5,'X5 裏返しで背のIDが変わった');
/* X6 断るもの。断ったら原本も revision も cache も1ミリも動かない。 */
const X6=E.create();E.propose(X6,[0,-1],[0,1]);
const x6rec=JSON.stringify(X6.recipe),x6rev=X6.revision,x6hash=X6.cache.hash;
assert.throws(()=>E.flip(X6,'v'),/確定か取消/,'X6 候補があるのに裏返せた');
E.cancel(X6);
assert.throws(()=>E.flip(X6,'z'),/向きは v か h/,'X6 知らない向きを通した');
assert.equal(JSON.stringify(X6.recipe),x6rec,'X6 断ったのに原本が動いた');
assert.equal(X6.revision,x6rev,'X6 断ったのに revision が動いた');
assert.equal(X6.cache.hash,x6hash,'X6 断ったのに cache.hash が動いた');
const capFlip={...X6,recipe:{...X6.recipe,steps:Array.from({length:E.MAX_STEPS},()=>({id:'s1',diagramStep:'1',op:'flip',axis:'v',instruction:'紙を左右に裏返す'}))}};
assert.throws(()=>E.flip(capFlip,'v'),/100手/,'X6 手順の上限が効いていない');
/* X7 再生で断るもの＝原本に知らない向きが書かれていたら通さない。 */
assert.throws(()=>E.replay({...E.create().recipe,steps:[{id:'s1',diagramStep:'1',op:'flip',axis:'x',instruction:'x'}]}),
 /v でも h でも/,'X7 知らない向きの原本を再生した');
/* X8 保存できる形＝再生と表示が一致する（verifiedRecipe の関門を通る）。 */
assert.equal(E.verifiedRecipe(FL).steps.length,4,'X8 裏返しを含む原本が保存できない');

/* X9 画面の原文＝裏返しに渡すのは「向き」だけ。画面は面も層も作らない。 */
const flipCalls=[...uiSrc.matchAll(/E\.flip\(([^)]*)\)/g)];
assert.equal(flipCalls.length,1,'X9 画面が flip を1か所より多く呼んでいる: '+flipCalls.length);
assert.equal(flipCalls[0][1].replace(/\s/g,''),"state,'v'",'X9 flip に向き以外を渡している: '+flipCalls[0][1]);
assert.match(uiSrc,/flipBtn\.disabled=busy/,'X9 候補があるあいだに裏返せてしまう');
assert.match(uiSrc,/id="flip"/,'X9 裏返すボタンが無い');

/* ============ Y（2026-09-13）🧵 折り目を付けて、そのまま折る（複合操作） ============
   原本には**ふつうの2手**（crease → fold）を足すだけ。新しい op もフィールドも作らない。
   🚨staged（crease を1手足した派生状態）は正式な state に入れない＝画面が持つ一時候補。
   ⚠2手目は「1手目で割れたあとの面」で解き直す（reference・targets・line・movingSidePoint）。 */
const yCrease=(st,a,b,side)=>{E.propose(st,a,b);E.setSide(st,side);E.select(st,ref(st));return st};
/* Y0 本命＝原本は2手、山谷はそろい、折線は同じ、結びは hinge になる。 */
const Y0=E.create();yCrease(Y0,[-1,-.5],[1,-.5],[0,-.9]);
const y0before={rec:JSON.stringify(Y0.recipe),rev:Y0.revision,hash:Y0.cache.hash,redo:Y0.redoStack.length};
const Y0d=E.stage(Y0,'V');
assert.equal(Y0.recipe.steps.length,0,'Y0 stage が正式な原本を書いた');
assert.equal(Y0.revision,y0before.rev,'Y0 stage で revision が動いた');
assert.equal(Y0.cache.hash,y0before.hash,'Y0 stage で cache.hash が動いた');
assert.deepEqual(Y0d.recipe.steps.map(s=>s.op),['crease'],'Y0 派生に折り目が入っていない');
assert.deepEqual(Y0d.cache.faces.map(f=>f.faceId),['paper/s1.keep','paper/s1.cut'],'Y0 折り目で面が割れていない');
E.stageSide(Y0d,[0,-.9]);
assert.equal(Y0d.pending.reference.faceId,'paper/s1.cut','Y0 指した側の面が基準になっていない');
assert.equal(Y0d.pending.kind,'V','Y0 折りの山谷が折り目とそろっていない');
E.confirmStaged(Y0,Y0d,{});
assert.deepEqual(Y0.recipe.steps.map(s=>s.op+s.kind),['creaseV','foldV'],'Y0 原本が 折り目→折り の2手でない');
assert.equal(Y0.revision,y0before.rev+1,'Y0 複合確定で revision が1回より多く増えた');
assert.deepEqual(Y0.recipe.steps[0].line.map(rd),Y0.recipe.steps[1].line.map(rd),'Y0 2手の折線が違う');
assert.equal(Y0.recipe.steps[1].reference.faceId,'paper/s1.cut','Y0 2手目が割れたあとの面で書かれていない');
assert.deepEqual(Y0.recipe.steps[1].targets.map(t=>t.faceId),['paper/s1.cut'],'Y0 2手目の対象が指した側だけでない');
assert.deepEqual(Object.keys(Y0.recipe.steps[1]).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'Y0 手に余計な項目がある');
/* Y1 結びは折り目からヒンジへ入れかわり、紙は破れない。 */
assert.deepEqual(Y0.cache.bonds.map(b=>b.kind),['hinge'],'Y1 折ったのに折り目の結びのまま');
const dY=discontinuity(Y0);assert.equal(dY.bad,0,`Y1 紙が破れた ${dY.bad}/${dY.tot}点`);
assert.deepEqual(Y0.cache.faces.map(f=>f.faceId+'/L'+f.layer),['paper/s1.keep/L0','paper/s1.cut/L1'],'Y1 層が違う');
/* Y2 原子性＝折りが成立しないなら、折り目も入らない。 */
const Y2=E.create();yCrease(Y2,[-1,-.5],[1,-.5],[0,-.9]);
const y2before={rec:JSON.stringify(Y2.recipe),rev:Y2.revision,hash:Y2.cache.hash,redo:Y2.redoStack.length,
 faces:JSON.stringify(Y2.cache.faces)};
const Y2d=E.stage(Y2,'V');
assert.throws(()=>E.confirmStaged(Y2,Y2d,{}),/どちら側/,'Y2 折る側を選ばずに確定できた');
assert.equal(JSON.stringify(Y2.recipe),y2before.rec,'Y2 断ったのに原本が動いた');
assert.equal(Y2.revision,y2before.rev,'Y2 断ったのに revision が動いた');
assert.equal(Y2.cache.hash,y2before.hash,'Y2 断ったのに cache.hash が動いた');
assert.equal(Y2.redoStack.length,y2before.redo,'Y2 断ったのに redoStack が動いた');
assert.equal(JSON.stringify(Y2.cache.faces),y2before.faces,'Y2 断ったのに紙が動いた');
/* 🚨断っても staged は残る＝折る側・山谷・枚数を変えてやり直せる（本人指示）。 */
assert.equal(!!Y2d.staged,true,'Y2 断ったら staged まで消えた');
E.stageSide(Y2d,[0,-.9]);E.confirmStaged(Y2,Y2d,{});
assert.equal(Y2.recipe.steps.length,2,'Y2 やり直したのに確定できない');
/* Y3 巻き戻し・やり直しは**通常の2手単位**。1回目で「折り目だけ」の紙に戻る。 */
const hY=Y0.cache.hash,recY=JSON.stringify(Y0.recipe);
E.undo(Y0);
assert.deepEqual(Y0.recipe.steps.map(s=>s.op),['crease'],'Y3 1回の巻き戻しで折り目だけに戻らない');
assert.equal(Y0.cache.faces.every(f=>f.layer===0),true,'Y3 折り目だけの紙が平らでない');
assert.deepEqual(Y0.cache.bonds.map(b=>b.kind),['crease'],'Y3 折り目だけの紙の結びがヒンジのまま');
E.undo(Y0);assert.equal(Y0.recipe.steps.length,0,'Y3 2回目の巻き戻しができない');
E.redo(Y0);E.redo(Y0);
assert.equal(Y0.cache.hash,hY,'Y3 やり直しでハッシュが戻らない');
assert.equal(JSON.stringify(Y0.recipe),recY,'Y3 やり直しで原本が戻らない');
/* Y4 山谷はそろう。staged を作り直すと2手とも変わる。 */
const Y4=E.create();yCrease(Y4,[-1,-.5],[1,-.5],[0,-.9]);
const Y4d=E.stage(Y4,'M');E.stageSide(Y4d,[0,-.9]);
assert.equal(Y4d.recipe.steps[0].kind,'M','Y4 折り目の山谷が指定どおりでない');
assert.equal(Y4d.pending.kind,'M','Y4 折りの山谷が折り目とそろっていない');
E.confirmStaged(Y4,Y4d,{});
assert.deepEqual(Y4.recipe.steps.map(s=>s.kind),['M','M'],'Y4 2手の山谷がそろっていない');
const Y4x=E.create();yCrease(Y4x,[-1,-.5],[1,-.5],[0,-.9]);
assert.throws(()=>E.stage(Y4x,'X'),/山谷は V か M/,'Y4 知らない山谷を通した');
/* Y5 残りが2手未満なら始められない（折り目だけの確定は今までどおりできる）。 */
const Y5=E.create();yCrease(Y5,[-1,-.5],[1,-.5],[0,-.9]);
const nearCap={...Y5,recipe:{...Y5.recipe,steps:Array.from({length:E.MAX_STEPS-1},()=>Y5.recipe.steps[0]||
 {id:'s1',diagramStep:'1',op:'flip',axis:'v',instruction:'紙を左右に裏返す'})}};
assert.throws(()=>E.stage(nearCap,'V'),/残りが1手/,'Y5 残り1手でも複合操作を始められた');
assert.equal(E.confirm(Y5,{op:'crease'}).faces.length,2,'Y5 折り目だけの確定までできなくなっている');
/* Y6 断るもの。 */
assert.throws(()=>E.stage(E.create(),'V'),/先に折り目を引いて/,'Y6 候補が無いのに始められた');
assert.throws(()=>E.stageSide({},[0,0]),/折り目を付けてから折る候補ではありません/,'Y6 派生でないものに側を渡せた');
assert.throws(()=>E.confirmStaged(E.create(),{},{}),/折り目を付けてから折る候補ではありません/,'Y6 派生でないものを確定できた');
const Y6=E.create();yCrease(Y6,[-1,-.5],[1,-.5],[0,-.9]);
const Y6d=E.stage(Y6,'V');E.stageSide(Y6d,[0,-.9]);
E.cancel(Y6);/* 正式な紙が先へ進んだ別の紙で、古い派生を使ってみる */
const Y6b=E.create();yCrease(Y6b,[-1,-.5],[1,-.5],[0,-.9]);E.confirm(Y6b,{op:'crease'});
assert.throws(()=>E.confirmStaged(Y6b,Y6d,{}),/古くなって/,'Y6 古い派生で確定できた');
/* Y7 deepestInFace 相当＝折線に近すぎる面では側を作らない。 */
const Y7=E.create();yCrease(Y7,[-1,-.985],[1,-.985],[0,0]);/* 折る側は広いほう＝折り目はできる */
const Y7d=E.stage(Y7,'V');
assert.throws(()=>E.stageSide(Y7d,[0,-.9925]),/折線から離れた点が、この面の中に作れません/,'Y7 細すぎる帯でも折る側の点を作った');
E.stageSide(Y7d,[0,0]);/* 広いほうなら作れる */
assert.equal(E.stackAt(Y7d,[0,0])[0].faceId,Y7d.pending.reference.faceId,'Y7 指した側の面が基準にならない');
/* Y8 画面の原文＝画面は指した点を渡すだけ。面の集合も側の点も作らない。 */
const stageCalls=[...uiSrc.matchAll(/E\.stage\((.*?)\);/g)];
assert.equal(stageCalls.length,2,'Y8 画面が stage を2か所以外で呼んでいる: '+stageCalls.length);
for(const m of stageCalls)assert.equal(m[1].replace(/\s/g,''),'state,kindValue','Y8 stage に山谷以外を渡している: '+m[1]);
const sideCalls=[...uiSrc.matchAll(/E\.stageSide\((.*?)\);/g)];
assert.equal(sideCalls.length,1,'Y8 画面が stageSide を1か所より多く呼んでいる');
assert.equal(sideCalls[0][1].replace(/\s/g,''),'staged,p','Y8 stageSide に指した点以外を渡している: '+sideCalls[0][1]);
assert.match(uiSrc,/E\.confirmStaged\(state,staged,meta\)/,'Y8 複合確定が engine を通っていない');
assert.match(uiSrc,/let staged=null,stagedAt=null;/,'Y8 staged が画面の持ちものになっていない');
assert.equal(/state\.staged/.test(uiSrc),false,'Y8 staged を正式な state に入れている');
/* 🚨Y9 原子性②＝**confirm を通ったあとの検査**（手数・並び・山谷・上限・ハッシュ）で断ったときも、
   正式だけでなく**渡された派生も1ミリも動かない**（2026-09-13）。
   ⚠ここが無いと、正式は不変でも派生だけが1手進んで pending が消え、**選び直しも取消もできなくなる**。
   ⚠幾何を変える書きかえは手前の再生・foldability が先に断るので、
     「再生は通るのに後段で断る」形＝折り目の山谷だけを書きかえて、この守りへ届かせる。 */
const dSnap=d=>JSON.stringify({rec:d.recipe,rev:d.revision,pend:d.pending,st:d.staged,
 redo:d.redoStack.length,hash:d.cache.hash,cacheRev:d.cacheRevision});
const Y9=E.create();yCrease(Y9,[-1,-.5],[1,-.5],[0,-.9]);
const Y9d=E.stage(Y9,'V');E.stageSide(Y9d,[0,-.9]);
Y9d.recipe.steps[0]={...Y9d.recipe.steps[0],kind:'M'};
const y9before={rec:JSON.stringify(Y9.recipe),rev:Y9.revision,hash:Y9.cache.hash,redo:Y9.redoStack.length},
 y9d0=dSnap(Y9d);
assert.throws(()=>E.confirmStaged(Y9,Y9d,{}),/折り目と折りの山谷が違います/,'Y9 山谷の違う2手が通った');
assert.equal(JSON.stringify(Y9.recipe),y9before.rec,'Y9 後段で断ったのに原本が動いた');
assert.equal(Y9.revision,y9before.rev,'Y9 後段で断ったのに revision が動いた');
assert.equal(Y9.cache.hash,y9before.hash,'Y9 後段で断ったのに cache.hash が動いた');
assert.equal(Y9.redoStack.length,y9before.redo,'Y9 後段で断ったのに redoStack が動いた');
assert.equal(dSnap(Y9d),y9d0,'Y9 後段で断ったのに派生が動いた');
assert.equal(!!Y9d.pending,true,'Y9 後段で断ったら派生の候補が消えた');
/* 書きかえを戻せば、**同じ派生のまま**確定できる＝選び直し・やり直しの道が残っている。 */
Y9d.recipe.steps[0]={...Y9d.recipe.steps[0],kind:'V'};
E.confirmStaged(Y9,Y9d,{});
assert.deepEqual(Y9.recipe.steps.map(v=>v.op+v.kind),['creaseV','foldV'],'Y9 やり直したのに確定できない');
assert.equal(Y9.revision,y9before.rev+1,'Y9 revision が1回より多く増えた');
/* 成功しても engine は派生を読むだけ＝渡した派生は staged のまま（画面が捨てる）。 */
assert.equal(Y9d.recipe.steps.length,1,'Y9 確定で渡した派生が書きかえられた');
assert.equal(!!Y9d.pending,true,'Y9 確定で渡した派生の候補が消えた');
/* 2度押しは「古くなっています」で断る＝同じ派生で2手ぶん入らない。 */
assert.throws(()=>E.confirmStaged(Y9,Y9d,{}),/古くなっています/,'Y9 同じ派生で二重に確定できた');
assert.equal(Y9.recipe.steps.length,2,'Y9 二重確定を断ったのに原本が動いた');

/* ============ Z（S1・2026-09-13）🫱 既存ヒンジの「背を開く」専用提案 ============
   つぶし折りの構成要素。記録されるのは**ふつうの `op:'fold'`**（選んだ面が折線の片側に丸ごとあり、その側が動く）。
   🚨折線は呼ぶ側が渡せない＝**H1 の安定した背から engine が取る**（任意の境界線で開ける抜け道を作らない）。
   🚨v1＝背で直接つながった**2層**のフラップで、動く側が**単一面**のときだけ。 */
const zCommit=(s,a,b,side,kind='V')=>{E.propose(s,a,b);s.pending.kind=kind;E.setSide(s,side);E.select(s,ref(s));return E.confirm(s)};
const zLayers=(s,a,b,side,n,kind='V')=>{const top=E.stackAt(s,side)[0];
 E.proposeOnFace(s,a,b,top.faceId,{layers:1});s.pending.kind=kind;E.setSide(s,side);
 if(n>1)E.setLayers(s,n,s.pending.at);E.select(s,ref(s));return E.confirm(s)};
const zSnap=s=>({rec:JSON.stringify(s.recipe),rev:s.revision,hash:s.cache.hash,redo:s.redoStack.length});
const zSame=(s,b,label)=>{assert.equal(JSON.stringify(s.recipe),b.rec,label+' 原本が動いた');
 assert.equal(s.revision,b.rev,label+' revision が動いた');
 assert.equal(s.cache.hash,b.hash,label+' cache.hash が動いた');
 assert.equal(s.redoStack.length,b.redo,label+' redoStack が動いた')};
/* Z0 成立例＝半分折りの背を開く（2層・動く側は単一面）。 */
const Z0=E.create();zCommit(Z0,[0,-1],[0,1],[-.5,0]);
const zh=E.hingeIntervals(Z0);
assert.deepEqual(zh.map(h=>h.intervalId),['hinge:s1#1'],'Z0 背が1本でない');
assert.deepEqual(zh[0].faceIds,['paper/s1.keep','paper/s1.cut'],'Z0 背の両側が違う');
const z0before=zSnap(Z0);
const zp=E.proposeOpen(Z0,E.hingeIntent(Z0,'hinge:s1#1'),[.5,0]);
/* 🚨提案は読み取りだけ＝正式な状態は1ミリも動かない。 */
zSame(Z0,z0before,'Z0 提案しただけで');
assert.equal(zp.reference.faceId,'paper/s1.cut','Z0 動く面が上の1枚でない');
assert.equal(zp.kind,'V','Z0 上の紙を開くのに谷になっていない');
assert.deepEqual(zp.displayLine.map(rd),[[0,-1],[0,1]].map(rd),'Z0 折線が背そのものでない');
assert.deepEqual(zp.candidates.map(c=>c.faceId),['paper/s1.cut'],'Z0 動く側が単一面でない');
assert.equal(zp.inputMode,'open','Z0 開く提案の印がない');
assert.equal(zp.openHinge.intervalId,'hinge:s1#1','Z0 どの背を開くか残っていない');
/* 0°・90°・180°でヒンジも素材の境界も裂けない（geometry の見張りを通っている）。 */
for(const a of[0,90,180])assert.equal(E.preview(Z0,a).movingIds.length,1,'Z0 '+a+'°で動く面が1枚でない');
E.select(Z0,ref(Z0));E.confirm(Z0);
assert.equal(Z0.recipe.steps.length,2,'Z0 開く手が確定できない');
assert.deepEqual(Z0.recipe.steps[1].op,'fold','Z0 新しい op が増えている');
assert.deepEqual(Object.keys(Z0.recipe.steps[1]).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'Z0 手に余計な項目がある');
assert.deepEqual(Z0.cache.faces.map(f=>f.faceId+'/'+(E.detXf(f.xf)<0?'裏':'表')),
 ['paper/s1.keep/表','paper/s1.cut/表'],'Z0 開いたのに裏のままの紙がある');
assert.deepEqual(Z0.cache.faces.find(f=>f.faceId==='paper/s1.cut').poly.map(rd),
 [[-1,-1],[0,-1],[0,1],[-1,1]].map(rd),'Z0 開いた先の形が違う');
/* 🔓 2026-09-15 本人判断で変更：0°に開いた背は折り目（crease）として扱う（旧＝hinge のまま）。由来の手・素材の区間は保持し、開いた手を openedBy に残す。 */
assert.deepEqual(Z0.cache.bonds.map(b=>[b.kind,b.stepId,b.openedBy]),[['crease','s1','s2']],'Z0 開いた背が折り目にならない／由来が消えた');
assert.deepEqual(Z0.cache.bonds[0].seg.map(rd),[[0,-1],[0,1]].map(rd),'Z0 開いた背の素材の区間が変わった');
assert.deepEqual(Z0.cache.creases.map(c=>[c.stepId,c.openedBy,c.seg.map(rd)]),[['s1','s2',[[0,-1],[0,1]].map(rd)]],'Z0 開いた背の折り目が表示に足されない');
assert.equal(E.hingeIntervals(Z0).length,0,'Z0 開いた背がまだ背として数えられている');
assert.deepEqual(E.creaseIntervals(Z0).map(c=>[c.intervalId,c.bondId]),[['s1#1','b1']],'Z0 開いた背の折り目が結びと対応しない');
const dZ=discontinuity(Z0);assert.equal(dZ.bad,0,`Z0 紙が破れた ${dZ.bad}/${dZ.tot}点`);
/* 巻き戻し・やり直しはふつうの1手として動く。 */
const zHash=Z0.cache.hash;E.undo(Z0);assert.equal(Z0.recipe.steps.length,1,'Z0 巻き戻せない');
E.redo(Z0);assert.equal(Z0.cache.hash,zHash,'Z0 やり直しでハッシュが戻らない');
/* Z1 抜け道を作らない＝知らない背・折り目の結び・古い意図は断る。 */
const Z1=E.create();zCommit(Z1,[0,-1],[0,1],[-.5,0]);const z1b=zSnap(Z1);
assert.throws(()=>E.proposeOpen(Z1,{kind:'hinge',stepId:'s9',intervalId:'hinge:s9#1',faceIds:['a','b'],revision:Z1.revision},[.5,0]),
 /選んだ背が、いまの紙にありません/,'Z1 知らない背で開けた');
assert.throws(()=>E.proposeOpen(Z1,null,[.5,0]),/選んだ背が、いまの紙にありません/,'Z1 背を渡さずに開けた');
assert.throws(()=>E.proposeOpen(Z1,E.hingeIntent(Z1,'hinge:s1#1'),null),/紙の上で指してください/,'Z1 場所を渡さずに開けた');
zSame(Z1,z1b,'Z1 断ったのに');
/* 折り目(crease)の結びは背ではない＝開く対象にならない。 */
const Z1c=E.create();E.propose(Z1c,[-1,0],[1,0]);Z1c.pending.kind='V';E.setSide(Z1c,[0,.5]);
E.select(Z1c,ref(Z1c));E.confirm(Z1c,{op:'crease'});
assert.equal(E.hingeIntervals(Z1c).length,0,'Z1 折り目が背として数えられている');
const cIv=E.creaseIntervals(Z1c)[0];
assert.throws(()=>E.proposeOpen(Z1c,E.creaseIntent(Z1c,cIv.intervalId),[0,.5]),
 /選んだ背が、いまの紙にありません/,'Z1 折り目の結びを開けた');
/* Z2 ★2026-09-13（S4）＝**層の枚数では断らない**。この形が断られるのは枚数ではなく
   「指した所の最上面がその背の面でない」か「軸の外の結びが動く側に残る（foldableSet④）」から。
   4層でも条件がそろえば開ける例は P群（P3・P4）で押さえる。 */
const Z2=E.create();zLayers(Z2,[0,-1],[0,1],[-.5,0],1);zLayers(Z2,[-1,0],[1,0],[.5,.5],2);
const z2b=zSnap(Z2);
/* ★2026-09-14（複数面）＝2手目で一緒に折った2層（背 s2#1・s2#2 は同じ軸 y=0）は、2面まとめて開ける。
   1手目の背（x=0）は、上下に止まる紙があるので①で断る。 */
for(const h of E.hingeIntervals(Z2)){
 if(h.stepId==='s1'){assert.throws(()=>E.proposeOpen(Z2,E.hingeIntent(Z2,h.intervalId),[.5,-.5]),
  /上に乗っている紙があります|下に敷かれている紙があります/,'Z2 この形で '+h.intervalId+' が断られない');zSame(Z2,z2b,'Z2 断ったのに');continue}
 const q=E.proposeOpen(Z2,E.hingeIntent(Z2,h.intervalId),[.5,-.5]);
 assert.deepEqual(q.candidates.map(c=>c.faceId).sort(),['paper/s1.cut/s2.cut','paper/s1.keep/s2.cut'],'Z2 2面まとめて開く集合でない: '+h.intervalId);
 assert.equal(q.kind,'V');zSame(Z2,z2b,'Z2 提案だけで');E.cancel(Z2)}
/* Z3 指した所の2枚が、その背の両側でないときは断る。 */
const Z3=E.create();
E.propose(Z3,[-1,.5],[1,.5]);Z3.pending.kind='V';E.setSide(Z3,[0,.8]);E.select(Z3,ref(Z3));E.confirm(Z3,{op:'crease'});
zCommit(Z3,[0,-1],[0,1],[-.5,0]);
/* ★2026-09-14（複数面）＝折り目の入ったフラップは、折り目でつながった2面が**1つのフラップとして**同じ背の軸で開く。
   動く集合は engine が結びから決める（背の面から、動く側の内部へ入る結び＝ここでは折り目 y=.5 をたどる）。
   Z3＝背の面でない上の紙（折り目の向こう側）を指しても、同じ集合なので開ける／Z4＝背の面を指しても同じ提案。 */
const z3b=zSnap(Z3);
const z3a=E.proposeOpen(Z3,E.hingeIntent(Z3,'hinge:s2#1'),[.5,.8]);E.cancel(Z3);
const z4a=E.proposeOpen(Z3,E.hingeIntent(Z3,'hinge:s2#1'),[.5,0]);E.cancel(Z3);
assert.deepEqual(z3a.candidates.map(c=>c.faceId).sort(),['paper/s1.cut/s2.cut','paper/s1.keep/s2.cut'],'Z3 折り目でつながったフラップが一緒に動かない');
assert.deepEqual(z4a.candidates,z3a.candidates,'Z4 指した場所で動く集合が変わった');
assert.equal(z3a.kind,'V');zSame(Z3,z3b,'Z3 提案だけで');
{const t=E.create();t.recipe=C0(Z3.recipe);t.cache=E.replay(t.recipe);t.cacheRevision=t.revision;t.committed=t.cache;
 E.proposeOpen(t,E.hingeIntent(t,'hinge:s2#1'),[.5,.8]);E.select(t,t.pending.candidates);E.confirm(t);
 assert.equal(t.cache.faces.filter(f=>f.poly.every(p=>p[0]<=1e-9)).length,2,'Z3 2面とも左へ開いていない');
 assert.equal(E.replay(E.verifiedRecipe(t)).hash,t.cache.hash,'Z3 開いた原本を再生すると別の紙になる')}
/* Z5 ほかの結びが動く側に残る形（degree-4 のように背が集まる形）は断る。 */
const Z5=E.create();zCommit(Z5,[0,-1],[0,1],[-.5,0]);
E.proposeOnFace(Z5,[.6,1],[1,.6],'paper/s1.cut',{layers:1});Z5.pending.kind='V';
E.setSide(Z5,[.9,.9]);E.select(Z5,ref(Z5));E.confirm(Z5);
const z5b=zSnap(Z5);
/* ★2026-09-13（S4）＝結びの本数ではなく、**上に乗っている紙がある**（foldableSet①）で断る。 */
/* ★2026-09-14（複数面）＝上に乗っている角は**背(b2)でフラップとつながっている**＝一緒に動く集合に入り、フラップごと開く。
   結びでつながっていない紙が上下にあるときに①で断るのは Z2（s1#1・s1#2）が押さえる。 */
const z5q=E.proposeOpen(Z5,E.hingeIntent(Z5,'hinge:s1#1'),[.3,0]);E.cancel(Z5);
assert.deepEqual(z5q.candidates.map(c=>c.faceId).sort(),['paper/s1.cut/s2.cut','paper/s1.cut/s2.keep'],'Z5 上の角がフラップと一緒に動かない');
zSame(Z5,z5b,'Z5 提案だけで');
/* Z6 既存の fold の提案経路は1文字も変えていない＝背の線をふつうに渡すと今までどおり断られる。 */
const Z6=E.create();zCommit(Z6,[0,-1],[0,1],[-.5,0]);
assert.throws(()=>E.proposeOnFace(Z6,[0,-1],[0,1],'paper/s1.cut',{layers:1}),
 /折線が選択面を二つに分けていません/,'Z6 ふつうの提案経路で背の線が通ってしまう');
/* Z7 退化した反転（背が短すぎる・形が変わらない）は断る。 */
const Z7=E.create();zCommit(Z7,[0,-1],[0,1],[-.5,0]);
const shortRef={...E.hingeIntent(Z7,'hinge:s1#1')};
assert.equal(typeof E.proposeOpen,'function','Z7 proposeOpen が無い');
assert.equal(E.proposeOpen.length,3,'Z7 proposeOpen の引数が3つでない（折線を渡せる抜け道がある）');

/* Z7 「丸ごと片側にあるか」の物差しそのものを直接固定する（proposeOpen から届かない形も含めて）。 */
const zSq=[[0,-1],[1,-1],[1,1],[0,1]];/* x>=0 の四角 */
assert.deepEqual(E.wholeSideOf(zSq,[0,-1],[0,1]),[[0,-1],[0,1]],'Z7 片側にある面で動く向きを返さない');
assert.deepEqual(E.wholeSideOf(zSq,[0,1],[0,-1]),[[0,-1],[0,1]],'Z7 線の向きを変えても同じ側を動かさない');
assert.equal(E.wholeSideOf([[-1,-1],[1,-1],[1,1],[-1,1]],[0,-1],[0,1]),null,'Z7 またいでいる面を丸ごと扱った');
assert.equal(E.wholeSideOf(zSq,[0,0],[0,0]),null,'Z7 退化した線を通した');
assert.equal(E.wholeSideOf([[0,0],[1,0]],[0,-1],[0,1]),null,'Z7 面でないものを通した');
assert.equal(E.wholeSideOf([[0,0],[1,0],[2,0]],[0,-1],[0,1]),null,'Z7 面積のない面を丸ごと扱った');
/* ⚠split は無限直線＝結びの線分の外まで伸ばした所でまたぐ形も、ここで null になる。 */
assert.equal(E.wholeSideOf([[-1,-1],[1,-1],[1,1],[-1,1]],[0,-.2],[0,.2]),null,'Z7 線分の外で交わる形を見落とした');

/* ★Z8（S2・2026-09-13）画面の原文＝背を開く画面は「選んだ背」と「指した点」しか渡さない。
   🚨折線・面の集合・山谷を画面が作らない（作れてしまうと、任意の線で開ける抜け道になる）。 */
const openCalls=[...uiSrc.matchAll(/E\.proposeOpen\((.*?)\);/g)];
assert.equal(openCalls.length,1,'Z8 画面が proposeOpen を1か所より多く呼んでいる: '+openCalls.length);
assert.equal(openCalls[0][1].replace(/\s/g,''),'ST(),hingePick.intent,p',
 'Z8 proposeOpen に「背と指した点」以外を渡している: '+openCalls[0][1]);
/* 指した点は紙面へ逆変換した点そのもの＝カメラを回しても同じ道を通る。 */
assert.match(uiSrc,/if\(openMode&&hingePick\)\{const p=paperPoint\(ev\);/,'Z8 指した点を紙面へ逆変換していない');
/* 開く候補のあいだ、画面は幾何を1つも作らない（既存の提案経路を呼ばない）。 */
const openFn=uiSrc.slice(uiSrc.indexOf('function openSideAt('),uiSrc.indexOf('function discardProposal('));
assert.equal(openFn.length>0,true,'Z8 openSideAt が無い');
assert.equal(/E\.propose\(|E\.proposeOnFace\(|E\.setSide\(|E\.setLayers\(|pending\.kind=/.test(openFn),false,
 'Z8 開く候補を画面が組み立てている: '+openFn);
assert.match(openFn,/E\.preview\(ST\(\),ghostAngle\(\)\)/,'Z8 既存のプレビューを通っていない');
assert.match(openFn,/applyFoldability\(\)/,'Z8 ゴーストの前に foldability を通していない');
/* 山谷は engine が決めた値を見せるだけ＝画面から切りかえない。 */
assert.match(uiSrc,/kindBtn\.onclick=\(\)=>\{[\s\S]{0,320}?if\(pendingProposal&&pendingProposal\.op==='open'\)\{[^}]*return\}/,
 'Z8 背を開く候補の山谷を画面から変えられる');
/* ボタンは「背を選んだときだけ」出る＝ふだんはバーの高さを変えない（⚠下バーに置くと紙の端が押せなくなる）。 */
assert.match(uiSrc,/<button id="openHinge" hidden>/,'Z8 背を開くボタンが無い（または最初から見えている）');
assert.match(uiSrc,/openBtn\.hidden=!hingePick;openBtn\.disabled=!!staged\|\|!!ST\(\)\.pending/,'Z8 ボタンの出し方が違う');
assert.match(uiSrc,/class="bar top"[^]*?id="openHinge"[^]*?<div id="status"/,'Z8 背を開くボタンが上バーに無い');
/* 取消・確定・つかみ直し・モード切りかえで、背の選択も開くしぐさも消える。 */
assert.match(uiSrc,/function clearHingePick\(\)\{hingePick=null;openMode=false;openPoint=null;syncOpenBtn\(\)\}/,
 'Z8 取消で背の選択と開く側が消えない');
for(const b of['cancelBtn','lineBtn','opBtn','creaseBtn','flipBtn','undoBtn','redoBtn'])
 assert.match(uiSrc,new RegExp(b+'\\.onclick=[\\s\\S]{0,300}?clearHingePick\\(\\)'),'Z8 '+b+' で背の選択が残る');


/* ============ W（2026-09-13）折れない手は、ゴーストを描く前に断る ============
   画像の症状＝1手目のフラップ(layer1)が上に乗ったまま、土台(layer0)を谷折りしようとした手。
   🚨engine の foldability は前から正しく断っていた。通っていなかったのは**画面のプレビュー**で、
     foldability を通るのは setLayers（上からN枚）と confirm だけ＝重なりが「この場所」に無いと素通りしていた。
   ここでは engine 側の契約（断る／N を増やせば通る／山谷で入れかわる／断っても何も動かない）を固定する。 */
const wCorner=(s,from,to,kind)=>{const cr=N.creaseForCorners(s,from,to);
 E.proposeOnFace(s,cr.line[0],cr.line[1],cr.faceId,{layers:1});s.pending.kind=kind;E.setSide(s,cr.sidePoint);return cr};
/* 画面の pendingFoldGeom と同じ式＝engine が持っている値だけから折線と折る側の点を出す。 */
const wGeom=s=>{const q=s.pending,f=s.cache.faces.find(v=>v.faceId===q.reference.faceId);
 const ap=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[4],m[2]*v[0]+m[3]*v[1]+m[5]],sp=ap(f.xf,q.sidePoint);
 let A=q.displayLine[0],B=q.displayLine[1];if(E.side(sp,A,B)>0)[A,B]=[B,A];return{A,B,sp}};
const wAble=s=>{const g=wGeom(s);return E.foldability(s,s.pending.candidates.map(v=>v.faceId),g.A,g.B,s.pending.kind,s.pending.at)};
/* W0 本命：右下の角を左端の辺へ → 左上の角を右へすこし（谷）。 */
const W0=E.create(),w1=N.creaseForCorners(W0,[1,-1],[-1,.6]);
commit(W0,w1.line[0],w1.line[1],w1.sidePoint);
assert.deepEqual(W0.cache.faces.map(f=>f.faceId+'/L'+f.layer),['paper/s1.keep/L0','paper/s1.cut/L1'],'W0 1手目の面が違う');
const wBefore={rec:JSON.stringify(W0.recipe),rev:W0.revision,hash:W0.cache.hash,redo:W0.redoStack.length,faces:JSON.stringify(W0.cache.faces)};
wCorner(W0,[-1,1],[-.55,.95],'V');
assert.deepEqual(W0.pending.candidates.map(v=>v.faceId),['paper/s1.keep'],'W0 1枚で選ばれる面が違う');
const wA1=wAble(W0);
assert.equal(wA1.ok,false,'W0 折れない手を engine が通した');
assert.equal(wA1.reason,'上に乗っている紙があります（その紙も一緒に選んでください）','W0 断る理由が違う: '+wA1.reason);
assert.deepEqual(wA1.blocking,['paper/s1.cut'],'W0 邪魔をしている面を指していない');
/* この場所は2枚＝画面に「上からN枚」が出る形。断っているあいだ、正式な状態は1ミリも動かない。 */
assert.deepEqual(rd(W0.pending.at),[-0.976666667,0.6],'W0「この場所」が違う');
assert.deepEqual(E.stackAt(W0,W0.pending.at).map(v=>v.faceId),['paper/s1.cut','paper/s1.keep'],'W0 この場所の重なりが違う');
assert.equal(JSON.stringify(W0.recipe),wBefore.rec,'W0 断っているのに原本が動いた');
assert.equal(W0.revision,wBefore.rev,'W0 断っているのに revision が動いた');
assert.equal(W0.cache.hash,wBefore.hash,'W0 断っているのに cache.hash が動いた');
assert.equal(W0.redoStack.length,wBefore.redo,'W0 断っているのに redoStack が動いた');
assert.equal(JSON.stringify(W0.cache.faces),wBefore.faces,'W0 断っているのに紙が動いた');
/* W1 「上から2枚」にすれば成立し、そのまま確定できる。 */
E.setLayers(W0,2,W0.pending.at);
assert.deepEqual(W0.pending.candidates.map(v=>v.faceId),['paper/s1.keep','paper/s1.cut'],'W1 2枚の候補が違う');
assert.equal(wAble(W0).ok,true,'W1 2枚にしても折れないと言う');
E.select(W0,W0.pending.candidates);E.confirm(W0);
assert.equal(W0.recipe.steps.length,2,'W1 2枚で確定できない');
assert.deepEqual(W0.recipe.steps[1].targets.map(t=>t.faceId),['paper/s1.keep','paper/s1.cut'],'W1 原本の targets が2面でない');
/* WM 山谷を変えると邪魔な紙が入れかわる＝同じ手が成立する（この場所は1枚＝N では救えない形）。 */
const WM=E.create(),w2=N.creaseForCorners(WM,[1,-1],[-1,-.95]);
commit(WM,w2.line[0],w2.line[1],w2.sidePoint);
wCorner(WM,[-1,1],[-.95,.75],'V');
assert.equal(wAble(WM).ok,false,'W2 谷折りで通ってしまう');
assert.deepEqual(E.stackAt(WM,WM.pending.at).map(v=>v.faceId),['paper/s1.keep'],'W2 この場所が1枚でない');
WM.pending.kind='M';
assert.equal(wAble(WM).ok,true,'W2 山折りにしても折れないと言う｜'+wAble(WM).reason);
assert.deepEqual(WM.pending.candidates.map(v=>v.faceId),['paper/s1.keep'],'W2 山折りで候補が変わった');
/* W3 画面の原文＝ゴーストを出す前に engine へ聞き、断っても pending は残す。 */
assert.match(uiSrc,/applyFoldability\(\);\s*\n?\s*computeLayerPick\(\)/,'W3 ゴーストの前に foldability を通していない');
const wAt=uiSrc.indexOf('function applyFoldability()');
assert.equal(wAt>0,true,'W3 applyFoldability が無い');
const wFn=uiSrc.slice(wAt).split('\n').slice(0,5).join('\n');
assert.match(wFn,/geom=null/,'W3 折れないときにゴーストを消していない');
assert.match(wFn,/confirmBtn\.disabled=true/,'W3 折れないときに確定ボタンを止めていない');
assert.equal(/discardProposal\(\)|E\.cancel\(/.test(wFn),false,'W3 折れないときに pending を捨てている（枚数・山谷で救う道が塞がる）');
/* ✏️ 2026-09-15（本人判断）：以前は折り目だけを素通しにしていた（confirm も判定を持たなかった）。
   いまは折り目だけも engine の芯（creasableSet）を通す＝画面は素通しにせず E.pendingCheck に聞く。 */
assert.match(uiSrc,/function foldableNow\(\)\{[\s\S]{0,200}?return E\.pendingCheck\(ST\(\)\)\}/,'W3 画面の成立判定が engine の pendingCheck を通っていない');
assert.equal(/function foldableNow\([^)]*\)\{[\s\S]{0,120}?if\(crease/.test(uiSrc),false,'W3 折り目だけを画面で素通しにしている');
assert.match(uiSrc,/kindBtn\.onclick[\s\S]{0,1600}?applyFoldability\(\)/,'W3 山谷を変えたときに聞きなおしていない');

/* ★D1 Python(origami_recipe.py)との突き合わせ用。原本と、JS側が出した面IDと、面の素材座標を渡す。
   Python が同じ面IDの集合・同じ形に割るかを、向こう側で突き合わせる。 */
const iv2=(m,p)=>{const d=m[0]*m[3]-m[1]*m[2],x=p[0]-m[4],y=p[1]-m[5];return[(m[3]*x-m[1]*y)/d,(-m[2]*x+m[0]*y)/d]};
const dump=st=>({recipe:E.verifiedRecipe(st),ops:st.recipe.steps.map(v=>v.op),
 faces:st.cache.faces.map(f=>f.faceId).slice().sort(),
 layers:Object.fromEntries(st.cache.faces.map(f=>[f.faceId,f.layer])),
 sourcePolys:Object.fromEntries(st.cache.faces.map(f=>[f.faceId,f.poly.map(p=>iv2(f.xf,p).map(v=>Math.round(v*1e6)/1e6))]))});
/* ============ SQ（S3・2026-09-13）🥟 ふつうの折りを派生状態へ適用して、そこにできた背を開く ============
   つぶし折りの最小形。原本に足すのは**ふつうの fold が2手**だけ＝新しい op もフィールドも作らない。
   🚨正式な state には1文字も書かない（派生を持つのは画面）。背は自動で選ばず、**派生の上でユーザーが選ぶ**。
   🚨2手の山谷はそれぞれの折りのまま（1手目＝押した山谷／2手目＝proposeOpen の決定）＝**そろえない**。 */
const sqPropose=(s,a,b,side,kind)=>{E.propose(s,a,b);s.pending.kind=kind;E.setSide(s,side);return s.pending};
/* SQ0 本命＝山折りで半分に折り、その背を開く（山谷がそろわないことも、ここで固定する）。 */
const SQ0=E.create();sqPropose(SQ0,[0,-1],[0,1],[.5,0],'M');
const sq0before=zSnap(SQ0);
const SQ0d=E.stageFold(SQ0);
zSame(SQ0,sq0before,'SQ0 派生を作っただけで');
assert.equal(SQ0.recipe.steps.length,0,'SQ0 正式な原本に1手目が入ってしまった');
assert.deepEqual(SQ0d.recipe.steps.map(v=>v.op+v.kind),['foldM'],'SQ0 派生に1手目が入っていない');
assert.equal(SQ0d.staged.mode,'squash','SQ0 派生の印が squash でない');
assert.equal(SQ0d.staged.base,SQ0.revision,'SQ0 派生の土台が今の revision でない');
assert.equal(SQ0d.pending,null,'SQ0 派生に候補が残っている');
/* 背は派生の上に新しくできたもの＝engine は選ばない（数え上げられるだけ）。 */
const sqh=E.hingeIntervals(SQ0d);
assert.deepEqual(sqh.map(h=>h.intervalId),['hinge:s1#1'],'SQ0 派生に新しい背が1本できていない');
assert.deepEqual(sqh[0].faceIds,['paper/s1.keep','paper/s1.cut'],'SQ0 新しい背の両側が違う');
/* 2手目＝proposeOpen。1手目で割れたあとの faceId・layerPath・背から解く。 */
const sqOpen=E.proposeOpen(SQ0d,E.hingeIntent(SQ0d,'hinge:s1#1'),[-.5,0]);
assert.equal(sqOpen.inputMode,'open','SQ0 2手目が「背を開く」提案でない');
assert.equal(sqOpen.reference.faceId,'paper/s1.keep','SQ0 2手目の基準面が1手目のあとの faceId でない');
assert.equal(sqOpen.kind,'V','SQ0 2手目の山谷を engine が決めていない');
for(const a of[0,90,180])assert.equal(E.preview(SQ0d,a).movingIds.length,1,'SQ0 '+a+'°で動く面が1枚でない');
zSame(SQ0,sq0before,'SQ0 2手目を提案しただけで');
const sq0rev=SQ0.revision;
E.confirmStagedFold(SQ0,SQ0d,{name:'つぶし'});
assert.equal(SQ0.recipe.steps.length,2,'SQ0 複合確定で2手にならない');
assert.deepEqual(SQ0.recipe.steps.map(v=>v.op),['fold','fold'],'SQ0 新しい op が増えている');
assert.deepEqual(SQ0.recipe.steps.map(v=>v.kind),['M','V'],'SQ0 2手の山谷を勝手にそろえている');
assert.equal(SQ0.revision,sq0rev+1,'SQ0 revision が1回より多く増えた');
assert.equal(SQ0.pending,null,'SQ0 確定後に候補が残っている');
assert.deepEqual(Object.keys(SQ0.recipe.steps[1]).sort(),
 ['diagramStep','id','instruction','kind','line','movingSidePoint','op','reference','targets'],'SQ0 2手目に余計な項目がある');
/* 🔓 2026-09-15 本人判断で変更：開いた背は折り目（由来 s1・開いた手 s2）。 */
assert.deepEqual(SQ0.cache.bonds.map(b=>[b.kind,b.stepId,b.openedBy]),[['crease','s1','s2']],'SQ0 開いた背が折り目にならない／由来が消えた');
const dSQ=discontinuity(SQ0);assert.equal(dSQ.bad,0,`SQ0 紙が破れた ${dSQ.bad}/${dSQ.tot}点`);
/* 巻き戻しは**通常の1手単位**＝1回戻すと1手目の折りだけが残る。やり直し2回でハッシュが戻る。 */
const sqHash=SQ0.cache.hash;
E.undo(SQ0);assert.deepEqual(SQ0.recipe.steps.map(v=>v.op+v.kind),['foldM'],'SQ0 1回の巻き戻しで1手目だけに戻らない');
E.undo(SQ0);assert.equal(SQ0.recipe.steps.length,0,'SQ0 2回目の巻き戻しができない');
E.redo(SQ0);E.redo(SQ0);assert.equal(SQ0.cache.hash,sqHash,'SQ0 やり直し2回でハッシュが戻らない');
/* 保存の中身は**ふつうの fold 2手だけ**＝派生の印も背のIDも混じらない。 */
const sqSaved=JSON.stringify(E.verifiedRecipe(SQ0));
for(const w of['staged','squash','hinge','intervalId','openHinge'])
 assert.equal(sqSaved.includes(w),false,`SQ0 保存JSONに ${w} が漏れた`);
/* SQ1 原子性＝2手目が無いあいだは1手も入らない。派生はそのまま残って選び直せる。 */
const SQ1=E.create();sqPropose(SQ1,[0,-1],[0,1],[.5,0],'V');
const SQ1d=E.stageFold(SQ1);const sq1b=zSnap(SQ1);
assert.throws(()=>E.confirmStagedFold(SQ1,SQ1d,{}),/開く背と、開く側を選んでください/,'SQ1 2手目なしで確定できた');
zSame(SQ1,sq1b,'SQ1 断ったのに');
assert.equal(!!SQ1d.staged,true,'SQ1 断ったら派生まで消えた');
assert.throws(()=>E.proposeOpen(SQ1d,E.hingeIntent(SQ1d,'hinge:s1#1'),[.5,0]),
 /そこには紙がありません/,'SQ1 紙のない所で開けた');
E.proposeOpen(SQ1d,E.hingeIntent(SQ1d,'hinge:s1#1'),[-.5,0]);
E.confirmStagedFold(SQ1,SQ1d,{});
assert.equal(SQ1.recipe.steps.length,2,'SQ1 選び直したあとに確定できない');
/* SQ2 2手目は「背を開く」提案だけ＝派生の上でふつうの折りをもう1手足す抜け道を作らない。 */
const SQ2=E.create();sqPropose(SQ2,[0,-1],[0,1],[.5,0],'V');
const SQ2d=E.stageFold(SQ2);
E.proposeOnFace(SQ2d,[-.5,-1],[-.5,1],'paper/s1.keep',{layers:1});SQ2d.pending.kind='V';E.setSide(SQ2d,[-.8,0]);
const sq2b=zSnap(SQ2);
assert.throws(()=>E.confirmStagedFold(SQ2,SQ2d,{}),/2手目は「背を開く」提案だけです/,'SQ2 ふつうの折りを2手目にできた');
zSame(SQ2,sq2b,'SQ2 断ったのに');
/* SQ3 派生の取りちがえ＝🧵（折り目→折り）の道と混ざらない。古い派生も断る。 */
const SQ3=E.create();sqPropose(SQ3,[0,-1],[0,1],[.5,0],'V');
const SQ3d=E.stageFold(SQ3);
assert.throws(()=>E.stageSide(SQ3d,[-.5,0]),/折り目を付けてから折る候補ではありません/,'SQ3 squash の派生を 🧵 の道に渡せた');
assert.throws(()=>E.confirmStaged(SQ3,SQ3d,{}),/折り目を付けてから折る候補ではありません/,'SQ3 squash の派生を 🧵 の確定に渡せた');
const SQ3c=E.create();E.propose(SQ3c,[-1,0],[1,0]);SQ3c.pending.kind='V';E.setSide(SQ3c,[0,.5]);
const SQ3cd=E.stage(SQ3c,'V');
assert.throws(()=>E.confirmStagedFold(SQ3c,SQ3cd,{}),/「続けてつぶす」の候補ではありません/,'SQ3 🧵 の派生を squash の確定に渡せた');
assert.throws(()=>E.confirmStagedFold(SQ3,null,{}),/「続けてつぶす」の候補ではありません/,'SQ3 派生なしで確定できた');
E.proposeOpen(SQ3d,E.hingeIntent(SQ3d,'hinge:s1#1'),[-.5,0]);
const SQ3b=E.create();zCommit(SQ3b,[0,-1],[0,1],[-.5,0]);/* 別の紙＝土台の revision が違う */
assert.throws(()=>E.confirmStagedFold(SQ3b,SQ3d,{}),/古くなっています/,'SQ3 古い派生で確定できた');
/* SQ4 残り手数が2手に足りないときは始められない。 */
const SQ4={...E.create()};
SQ4.recipe={...SQ4.recipe,steps:Array.from({length:E.MAX_STEPS-1},()=>({id:'s1',diagramStep:'1',op:'flip',axis:'v',instruction:'紙を左右に裏返す'}))};
sqPropose(SQ4,[0,-1],[0,1],[.5,0],'V');
assert.throws(()=>E.stageFold(SQ4),/「続けてつぶす」は始められません/,'SQ4 残り1手でも始められた');
const SQ4b=E.create();
assert.throws(()=>E.stageFold(SQ4b),/先に折る候補を作ってください/,'SQ4 候補なしで始められた');
/* SQ5 断る形は、派生の上でも**既存の判定の理由がそのまま出る**（層の枚数では断らない：S4で置きかえた）。 */
const SQ5=E.create();zCommit(SQ5,[0,-1],[0,1],[.5,0]);/* 半分折り＝右半分を左へ（2層） */
const sqTop=E.stackAt(SQ5,[-.5,.5])[0];
E.proposeOnFace(SQ5,[-1,.3],[0,.3],sqTop.faceId,{layers:1});SQ5.pending.kind='V';E.setSide(SQ5,[-.5,.6]);
E.setLayers(SQ5,2,SQ5.pending.at);/* 上から2枚＝折ると4層になる */
const SQ5d=E.stageFold(SQ5);
/* ★2026-09-14（複数面）＝2手目で一緒に折った2層の背（s2#1・s2#2 は同じ軸 y=.3）は、2面まとめて開ける（派生の上でも同じ規則）。 */
for(const h of E.hingeIntervals(SQ5d)){
 if(h.stepId==='s1'){assert.throws(()=>E.proposeOpen(SQ5d,E.hingeIntent(SQ5d,h.intervalId),[-.5,-.5]),
  /上に乗っている紙があります|下に敷かれている紙があります/,'SQ5 この派生で '+h.intervalId+' が断られない');continue}
 const q=E.proposeOpen(SQ5d,E.hingeIntent(SQ5d,h.intervalId),[-.5,-.5]);
 assert.equal(q.candidates.length,2,'SQ5 2面まとめて開く集合でない: '+h.intervalId);E.cancel(SQ5d)}
assert.equal(SQ5.recipe.steps.length,1,'SQ5 断っているあいだに正式な原本が動いた');

/* SQ7 1手目が入れかわった派生は通さない（派生は画面の持ちものなので、確定のときに engine が見直す）。 */
const SQ7=E.create();sqPropose(SQ7,[0,-1],[0,1],[.5,0],'V');
const SQ7d=E.stageFold(SQ7);
E.proposeOpen(SQ7d,E.hingeIntent(SQ7d,'hinge:s1#1'),[-.5,0]);
/* ⚠幾何を変える書きかえ（山谷・折線）は、手前の再生・foldability が先に断る。ここで見たいのは
   「再生は通るのに1手目が差しかわっている」形なので、案内文だけを書きかえてこの守りへ届かせる。 */
SQ7d.recipe.steps[0]={...SQ7d.recipe.steps[0],instruction:'こっそり書きかえた'};
const sq7b=zSnap(SQ7);
assert.throws(()=>E.confirmStagedFold(SQ7,SQ7d,{}),/1手目が入れかわっています/,'SQ7 入れかわった1手目で確定できた');
zSame(SQ7,sq7b,'SQ7 断ったのに');

/* 🚨SQ8 原子性②＝**confirm を通ったあとの検査**で断ったときも、派生まで不変（2026-09-13・→Y9 と対）。
   SQ7 は正式が不変なことだけを見ていた＝そのあいだ**派生は1手進んで pending が消え**、選び直せなかった。 */
const SQ8=E.create();sqPropose(SQ8,[0,-1],[0,1],[.5,0],'V');
const SQ8d=E.stageFold(SQ8);
E.proposeOpen(SQ8d,E.hingeIntent(SQ8d,'hinge:s1#1'),[-.5,0]);
SQ8d.recipe.steps[0]={...SQ8d.recipe.steps[0],instruction:'こっそり書きかえた'};
const sq8b=zSnap(SQ8),sq8d0=dSnap(SQ8d);
assert.throws(()=>E.confirmStagedFold(SQ8,SQ8d,{}),/1手目が入れかわっています/,'SQ8 入れかわった1手目で確定できた');
zSame(SQ8,sq8b,'SQ8 後段で断ったのに');
assert.equal(dSnap(SQ8d),sq8d0,'SQ8 後段で断ったのに派生が動いた');
assert.equal(!!SQ8d.pending,true,'SQ8 後段で断ったら派生の候補が消えた');
assert.equal(SQ8d.pending.inputMode,'open','SQ8 断ったら開く提案が壊れた');
/* 書きかえを戻せば、**同じ派生のまま**確定できる＝背も開く側も選び直せる。 */
SQ8d.recipe.steps[0]={...SQ8d.recipe.steps[0],instruction:'選んだ面を谷折りする'};
E.confirmStagedFold(SQ8,SQ8d,{});
assert.equal(SQ8.recipe.steps.length,2,'SQ8 やり直したのに確定できない');
assert.equal(SQ8.revision,sq8b.rev+1,'SQ8 revision が1回より多く増えた');
assert.equal(SQ8d.recipe.steps.length,1,'SQ8 確定で渡した派生が書きかえられた');
assert.equal(!!SQ8d.pending,true,'SQ8 確定で渡した派生の候補が消えた');
assert.throws(()=>E.confirmStagedFold(SQ8,SQ8d,{}),/古くなっています/,'SQ8 同じ派生で二重に確定できた');
assert.equal(SQ8.recipe.steps.length,2,'SQ8 二重確定を断ったのに原本が動いた');
/* 巻き戻し・やり直し・保存は2手のまま（後段で断った派生を持ちこしても壊れない）。 */
const sq8h=SQ8.cache.hash;E.undo(SQ8);E.redo(SQ8);
assert.equal(SQ8.cache.hash,sq8h,'SQ8 巻き戻し→やり直しでハッシュが戻らない');
assert.equal(JSON.stringify(E.verifiedRecipe(SQ8)).includes('こっそり'),false,'SQ8 書きかえが保存JSONに漏れた');

/* ★SQ6 画面の原文＝画面は派生と提案を持つだけ。面の集合も折線も背も作らない。 */
const sqCalls=[...uiSrc.matchAll(/E\.stageFold\((.*?)\)/g)];
assert.equal(sqCalls.length,1,'SQ6 画面が stageFold を1か所より多く呼んでいる: '+sqCalls.length);
assert.equal(sqCalls[0][1].replace(/\s/g,''),'state','SQ6 stageFold に正式な state 以外を渡している: '+sqCalls[0][1]);
assert.equal(uiSrc.includes('E.confirmStagedFold(state,squash,meta)'),true,'SQ6 複合確定が engine を通っていない');
assert.equal(uiSrc.includes('let squash=null;'),true,'SQ6 派生が画面の持ちものになっていない');
assert.equal(uiSrc.includes('const ST=()=>staged||squash||state;'),true,'SQ6 見せている紙が派生になっていない');
assert.equal(/state\.squash/.test(uiSrc),false,'SQ6 派生を正式な state に入れている');
/* 派生を見せているあいだ、紙の上は「背を選ぶ」だけ＝角・辺・折り目のつかみを通さない。 */
assert.equal(uiSrc.includes('if(squash){pickHingeAt(screen);hover=null;'),true,
 'SQ6 派生中に角・辺のつかみが通ってしまう（見せている紙とつかむ相手がずれる）');
/* 背を選ぶのは1か所＝入力層（pickVisibleHinge）だけ。画面は背を作らない。 */
const pvh=[...uiSrc.matchAll(/N\.pickVisibleHinge\((.*?)\);/g)];
assert.equal(pvh.length,1,'SQ6 画面が背の選択を1か所より多く呼んでいる: '+pvh.length);
assert.equal(pvh[0][1].replace(/\s/g,''),'ST(),screen,VIEW','SQ6 背の選択に「いま見せている紙」以外を渡している: '+pvh[0][1]);
/* ボタン＝ふつうの折りのゴーストが出ているときだけ（ふだんはバーの高さを変えない）。 */
assert.equal(uiSrc.includes('<button id="squash" hidden>'),true,'SQ6 「続けてつぶす」が無い（または最初から見えている）');
assert.match(uiSrc,/class="bar top"[^]*?id="squash"[^]*?<div id="status"/,'SQ6 「続けてつぶす」が上バーに無い');
assert.equal(uiSrc.includes("squashBtn.hidden=!(!squash&&!staged&&!!state.pending&&!!pendingProposal"),true,
 'SQ6 ボタンの出し方が違う');
/* 取消・つかみ直しで派生はまるごと消える。派生のあいだ山谷は変えられない。 */
assert.equal(uiSrc.includes('staged=null;stagedAt=null;squash=null;'),true,'SQ6 取消で派生が消えない');
assert.equal(uiSrc.includes("if(squash){ok('「続けてつぶす」のあいだは山谷を変えられません"),true,
 'SQ6 派生を作ったあとに山谷を変えられる');
/* 「続けてつぶす」を押す所で、画面が幾何を作っていない。 */
const sqFn=uiSrc.slice(uiSrc.indexOf('squashBtn.onclick='),uiSrc.indexOf('flipBtn.onclick='));
assert.equal(sqFn.length>0,true,'SQ6 「続けてつぶす」のボタンが無い');
assert.equal(/E\.propose\(|E\.proposeOnFace\(|E\.setSide\(|E\.hingeIntervals\(|pending\.kind=/.test(sqFn),false,
 'SQ6 画面が1手目や背を組み立てている: '+sqFn);

/* ============ P（S4・2026-09-13）既存ヒンジを軸に「単一面を丸ごと開く」条件 ============
   🚨**層の枚数・輪・degree-4・結びの本数では断らない**（本人指示）。決めるのは：
   ①指した場所のいちばん上の紙が、選んだ背の面であること（**相手は背から解く**。`stack[1]` と決めうちしない）
   ②その面が軸の片側に丸ごとあること（`wholeSideOf`・既存）
   ③止まる相手につながる結びが、**軸の上に全区間おさまっている**こと
     ＝**既存の `foldableSet`④ がそのまま見る**（`S(q,a,b)/線分長` で正規化／正規化距離 1e-9・区間長 1e-7）。
      ここに別の関数・別の許容差・独立した成否規則は足していない。
   ④層の規則（`foldableSet`①②）⑤書ける形（`recordable`）⑥再生（`replay`・`digest`）⑦0/90/180（`geometry`）。
   ⛔一般の途中衝突（紙どうしの貫通・紙厚）は**保証しない**。ここで見るのは結びと層の規則だけ。 */
const pHalf=()=>{const s=E.create();E.propose(s,[0,-1],[0,1]);s.pending.kind='V';E.setSide(s,[.5,0]);
 E.select(s,ref(s));E.confirm(s);return s};
const pFold=(s,a,b,side,n=1,kind='V')=>{const t=E.stackAt(s,side)[0];
 E.proposeOnFace(s,a,b,t.faceId,{layers:1});s.pending.kind=kind;E.setSide(s,side);
 if(n>1)E.setLayers(s,n,s.pending.at);E.select(s,ref(s));E.confirm(s);return s};
const pFoldAll=(s,c,dir)=>{const side=[c+dir*.4,0],t=E.stackAt(s,side)[0];
 E.proposeOnFace(s,[c,-1],[c,1],t.faceId,{layers:1});s.pending.kind='V';E.setSide(s,side);
 const n=E.layersAt(s,s.pending.at).layers.length;if(n>1)E.setLayers(s,n,s.pending.at);
 E.select(s,ref(s));E.confirm(s);return s};
/* 成立例は同じ手順で確かめる＝層数だけが違う。 */
const pOpens=(name,s,at,hingeId,expectFace,expectKind,expectStack)=>{
 assert.equal(E.stackAt(s,at).length,expectStack,name+' 層の数が違う');
 assert.equal(E.stackAt(s,at)[0].faceId,expectFace,name+' 指した所の最上面が違う');
 const before=zSnap(s),steps=s.recipe.steps.length;
 const q=E.proposeOpen(s,E.hingeIntent(s,hingeId),at);
 zSame(s,before,name+' 提案しただけで');
 assert.equal(q.reference.faceId,expectFace,name+' 動く面が指した所の最上面でない');
 assert.equal(q.kind,expectKind,name+' 山谷を engine が決めていない');
 assert.deepEqual(q.candidates.map(c=>c.faceId),[expectFace],name+' 動く側が単一面でない');
 assert.equal(q.openHinge.intervalId,hingeId,name+' どの背を開くか残っていない');
 for(const a of[0,90,180])assert.equal(E.preview(s,a).movingIds.length,1,name+' '+a+'°で動く面が1枚でない');
 E.select(s,s.pending.candidates);E.confirm(s);
 assert.equal(s.recipe.steps.length,steps+1,name+' 開く手が確定できない');
 assert.equal(s.recipe.steps[steps].op,'fold',name+' ふつうの fold で記録されていない');
 const d=discontinuity(s);assert.equal(d.bad,0,name+` 紙が破れた ${d.bad}/${d.tot}点`);
 const h=s.cache.hash;E.undo(s);assert.equal(s.recipe.steps.length,steps,name+' 巻き戻せない');
 E.redo(s);assert.equal(s.cache.hash,h,name+' やり直しでハッシュが戻らない');
 return q};
/* P1 2層（いままで通っていた形） */
pOpens('P1 2層',pHalf(),[-.5,0],'hinge:s1#1','paper/s1.cut','V',2);
/* P2 3層 */
const P2=pHalf();pFold(P2,[-.5,-1],[-.5,1],[-.8,0]);
pOpens('P2 3層',P2,[-.25,0],'hinge:s2#1','paper/s1.cut/s2.cut','V',3);
/* P3 4層（じゃばら） */
const P3=E.create();pFoldAll(P3,-.5,-1);pFoldAll(P3,0,1);pFoldAll(P3,-.5,-1);
pOpens('P3 4層',P3,[-.45,0],'hinge:s3#1','paper/s1.keep/s2.cut/s3.cut','V',4);
/* P4 5層＝**輪と degree-4 が同じ紙にあっても**、選んだ面の結びが軸上なら開ける。 */
const P4=pHalf();pFold(P4,[-1,0],[0,0],[-.5,.5],2);pFold(P4,[-1,0],[0,-1],[-.8,-.8],1);
assert.equal(P4.cache.bonds.length>=P4.cache.faces.length,true,'P4 結びのグラフに輪が無い（前提が崩れた）');
const pDeg=P4.cache.bonds.filter(b=>{const f=P4.cache.faces.find(g=>g.faceId===b.faceIds[0]);
 return b.seg.map(q=>[f.xf[0]*q[0]+f.xf[1]*q[1]+f.xf[4],f.xf[2]*q[0]+f.xf[3]*q[1]+f.xf[5]])
  .some(p=>Math.hypot(p[0],p[1])<1e-9)}).length;
assert.equal(pDeg>=4,true,'P4 頂点(0,0)に4本の折線が集まっていない（前提が崩れた）: '+pDeg);
pOpens('P4 5層（輪・degree-4あり）',P4,[-1/3,-1/3],'hinge:s3#1','paper/s1.keep/s2.cut/s3.cut','V',5);
/* P5 ★2026-09-14（複数面）＝degree-4 の壁（2手目で一緒に折った2層）。
   1面だけでは軸の外の結びが裂けたが、engine が結びから集めた**2面まとめて**なら同じ軸 y=0 で開ける。
   1手目の背（x=0）は、上下に止まる紙が残るので①で断る（層数ではなく結びと層の位置で決まる）。 */
const P5=pHalf();pFold(P5,[-1,0],[0,0],[-.5,.5],2);
const p5b=zSnap(P5),p5at=[-.5,-.5];
assert.equal(E.stackAt(P5,p5at).length,4,'P5 4層になっていない');
assert.throws(()=>E.proposeOpen(P5,E.hingeIntent(P5,'hinge:s1#1'),p5at),/下に敷かれている紙があります/,'P5 x=0 の背を開けた');
assert.throws(()=>E.proposeOpen(P5,E.hingeIntent(P5,'hinge:s1#2'),p5at),/上に乗っている紙があります/,'P5 x=0 の背を開けた');
zSame(P5,p5b,'P5 断ったのに');
assert.equal(P5.pending,null,'P5 断ったのに候補が残った');
for(const hid of['hinge:s2#1','hinge:s2#2']){const q=E.proposeOpen(P5,E.hingeIntent(P5,hid),p5at);
 assert.deepEqual(q.candidates.map(c=>c.faceId).sort(),['paper/s1.cut/s2.cut','paper/s1.keep/s2.cut'],'P5 2面まとめて開く集合でない: '+hid);
 zSame(P5,p5b,'P5 提案しただけで');E.cancel(P5)}
/* P6 ★同じ軸上に結びが何本あっても断らない＝**関数の単体テスト**（実作品の状態とは別に、直接固定する）。
   いまの作品・いまの手順では「1面に同じ軸の結びが2本」は出てこないので、届かない守りは
   `foldableSet` に人工の入力を直接渡して押さえる（`wholeSideOf` の Z7 と同じ運用）。 */
const pI=[1,0,0,1,0,0];
const pFaces=[{faceId:'m',poly:[[0,-1],[1,-1],[1,1],[0,1]],layer:1,xf:pI,layerPath:[]},
 {faceId:'f1',poly:[[-1,-1],[0,-1],[0,-.2],[-1,-.2]],layer:0,xf:pI,layerPath:[]},
 {faceId:'f2',poly:[[-1,.2],[0,.2],[0,1],[-1,1]],layer:0,xf:pI,layerPath:[]}];
const pBonds=segs=>segs.map((seg,i)=>({faceIds:['m','f'+(i+1)],kind:'hinge',seg}));
const pSame=E.foldableSet(pFaces,pBonds([[[0,-1],[0,-.2]],[[0,.2],[0,1]]]),['m'],[0,-1],[0,1],'V');
assert.equal(pSame.ok,true,'P6 同じ軸上の結びが2本あるだけで断った: '+pSame.reason);
const pOff=E.foldableSet(pFaces,pBonds([[[0,-1],[0,-.2]],[[.3,.2],[.3,1]]]),['m'],[0,-1],[0,1],'V');
assert.equal(pOff.ok,false,'P6 軸の外の結びを通した');
assert.match(String(pOff.reason),/つながっている紙が置き去りになって裂けます/,'P6 断る理由が違う');
assert.deepEqual(pOff.blocking,['f2'],'P6 どの紙が置き去りかを指していない');
/* P8 原本に書く折線は、結びが持っている**素材座標そのもの**（丸めない・原紙の±1を外れない）。
   ⚠`hingeIntervals` の `srcSeg` は並べ替えの鍵なので6桁に丸めてある＝それを書くと再生が断る。
   ⚠いまの座標を `inv(xf,…)` で戻すと、原紙の端で `1.0000000000000004` になり本番スキーマに入らない。 */
const P8=pHalf();
{const cr=N.creaseForCorners(P8,[-1,1],[-.3,.35],{requireInside:true});
 E.proposeOnFace(P8,cr.line[0],cr.line[1],cr.faceId,{layers:1});P8.pending.kind='V';E.setSide(P8,cr.sidePoint);
 E.select(P8,ref(P8));E.confirm(P8);}
const p8Bond=P8.cache.bonds.find(b=>b.faceIds.includes('paper/s1.cut/s2.cut'));
const p8Iv=E.hingeIntervals(P8).find(h=>h.intervalId==='hinge:s2#1');
assert.notDeepEqual(p8Iv.srcSeg,p8Bond.seg,'P8 前提が崩れた（srcSeg が丸められていない）');
E.proposeOpen(P8,E.hingeIntent(P8,'hinge:s2#1'),[-.549,.549]);
E.select(P8,P8.pending.candidates);E.confirm(P8);
const p8Line=P8.recipe.steps[2].line;
assert.equal(p8Line.every(q=>q.every(v=>Math.abs(v)<=1)),true,'P8 折線が原紙の±1を外れた: '+JSON.stringify(p8Line));
assert.equal(JSON.stringify(p8Line.slice().sort()),JSON.stringify(C0(p8Bond.seg).slice().sort()),
 'P8 折線が結びの素材座標そのものでない（丸めた鍵を書いている）: '+JSON.stringify(p8Line));
assert.equal(E.replay(E.verifiedRecipe(P8)).hash,P8.cache.hash,'P8 保存した原本を再生すると別の紙になる');

/* P7 原文＝新しい判定も新しい許容差も足していない（既存の foldableSet を通すだけ）。 */
const engSrc=fs.readFileSync(path.join(__dirname,'freefold_engine.js'),'utf8');
const pOpenSrc=engSrc.slice(engSrc.indexOf('function proposeOpen('),engSrc.indexOf('/* ================= 🧵'));
assert.equal(pOpenSrc.length>0,true,'P7 proposeOpen が読めない');
/* コメントを外して「コードとして残っているか」だけを見る。 */
const pCode=pOpenSrc.replace(/\/\*[\s\S]*?\*\//g,'');
assert.equal(/stack\.length!==2|この場所は2層ではありません/.test(pCode),false,'P7 層の枚数のゲートが残っている');
assert.equal(/stack\[1\]/.test(pCode),false,'P7 相手の面を stack[1] と決めうちしている');
assert.equal(/bondsOnAxis|onAxis|axisTol/.test(pCode),false,'P7 独立した軸判定を足している（foldableSet④と重複）');
assert.equal(/ほかにも結び|extra=/.test(pCode),false,'P7 結びの本数で断る規則が残っている');
assert.match(pCode,/C\(bond\.seg\)/,'P7 原本の折線を結びの素材座標から書いていない');
assert.match(pOpenSrc,/foldability\(state,ids,oa,ob,kind,at\)/,'P7 既存の層・結び判定を通っていない');
assert.match(pOpenSrc,/wholeSideOf\(f\.poly,A,B\)/,'P7 丸ごと片側かの判定を通っていない');
/* ★2026-09-14（複数面）＝一緒に動く紙は movingSetOf が集め、ぜんぶ同じ側に丸ごとあるかも wholeSideOf で見る。
   集めるときの物差しは foldableSet④ と**同じ関数** bondInMovingSide（軸の判定・許容差を二重に持たない）。 */
assert.match(pOpenSrc,/movingSetOf\(state\.cache,f\.faceId,w\[0\],w\[1\]\)/,'P7 動く紙の集合を engine の結びから集めていない');
assert.match(pOpenSrc,/wholeSideOf\(g\.poly,oa,ob\)/,'P7 一緒に動く紙が同じ側に丸ごとあるかを見ていない');
const msSrc=engSrc.slice(engSrc.indexOf('function movingSetOf('),engSrc.indexOf('function proposeOpen('));
assert.match(msSrc,/bondInMovingSide\(cache\.faces,bd,a,b\)/,'P7 movingSetOf が④と同じ物差しを使っていない');
const fsSrc=engSrc.slice(engSrc.indexOf('function foldableSet('),engSrc.indexOf('function recordable('));
assert.match(fsSrc,/bondInMovingSide\(all,bd,a,b\)/,'P7 foldableSet④ が共用の物差しを使っていない');
assert.equal(/1e-9|1e-7/.test(msSrc),false,'P7 movingSetOf が独自の許容差を持っている');
assert.match(pOpenSrc,/recordable\(state,ids,mover\.faceId/,'P7 書ける形の判定を通っていない');
assert.match(pOpenSrc,/for\(const a of\[0,90,180\]\)geometry\(state,a\)/,'P7 0/90/180 の見張りが無い');
/* ⑥（単一面の決まり）の面積しきい 1e-9 は⑥ごと無くなった（2026-09-14）＝proposeOpen の中の許容差は0個。 */
assert.equal((pCode.match(/1e-9/g)||[]).length,0,'P7 proposeOpen が独自の許容差を増やしている');

/* ============ OP（2026-09-13）🚪 知らない操作は入口で断る ============
   ⚠これが無いと、`op` を見るのは `crease` と `flip` の2か所だけで、**それ以外はぜんぶ fold として
     素通し**していた（実測＝`op:'squash'` の1手で紙が2枚に割れた）。未対応の読み手が黙って
     **別の紙**を作るのがいちばん危ない。新しい op を足すときは、まず engine の OPS に足すこと。
   🚨これは幾何の再生器の門であって、JSONスキーマの検査ではない（format／version／余分な項目は見ない）。 */
const opBase=()=>{const t=E.create();
 E.propose(t,[-.5,-1],[-.5,1]);t.pending.kind='V';E.setSide(t,[-.8,0]);E.select(t,ref(t));E.confirm(t,{op:'crease'});
 E.propose(t,[0,-1],[0,1]);t.pending.kind='V';E.setSide(t,[.5,0]);E.select(t,ref(t));E.confirm(t);
 E.flip(t,'v');
 return C0(t.recipe)};
/* OP0 土台＝fold・flip・crease の3つとも入った原本が、これまでどおり通る（回帰）。 */
const opOK=opBase();
assert.deepEqual(opOK.steps.map(v=>v.op),['crease','fold','flip'],'OP0 土台に3つの op が入っていない');
const opCache=E.replay(opOK);
assert.equal(opCache.faces.length>=3,true,'OP0 正常な原本が再生できない');
/* OP1 知らない op は断る。🚨**正常な fold の全フィールドを付けたまま**op だけ差しかえる
   ＝「必須項目が足りないから落ちた」ではないことを、同じJSONで両方見て固定する。 */
const opFold=C0(opOK);opFold.steps=[C0(opOK.steps[0])];
assert.equal(E.replay(opFold).faces.length,2,'OP1 土台の1手が通らない');
for(const bad of['squash','squashFold','open-pocket','FOLD','Fold',' fold','fold ','']){
 const t=C0(opFold);t.steps[0].op=bad;
 assert.throws(()=>E.replay(t),/知らない操作です/,`OP1 op:'${bad}' が断られない`)}
/* 同じ手の op を fold に戻すと通る＝落ちていたのは op のせいだけ。 */
{const t=C0(opFold);t.steps[0].op='squashFold';
 assert.throws(()=>E.replay(t),/知らない操作です/,'OP1 未知opが通った');
 t.steps[0].op=opFold.steps[0].op;
 assert.equal(E.replay(t).faces.length,2,'OP1 op を戻しても通らない＝項目不足で落ちていた')}
/* OP2 op の欠落・型ちがい・手そのものが読めない形。 */
{const t=C0(opFold);delete t.steps[0].op;
 assert.throws(()=>E.replay(t),/op がありません/,'OP2 op の欠落が断られない')}
for(const bad of[null,0,1,true,{},[],['fold']]){
 const t=C0(opFold);t.steps[0].op=bad;
 assert.throws(()=>E.replay(t),/知らない操作です/,`OP2 op:${JSON.stringify(bad)} が断られない`)}
for(const bad of[null,'fold',7]){
 const t=C0(opFold);t.steps[0]=bad;
 assert.throws(()=>E.replay(t),/手が読めません|op がありません/,`OP2 手が ${JSON.stringify(bad)} でも通った`)}
/* OP3 知らない op が**途中の手**にあっても断る（前の手が通っていても止まる）。 */
for(const i of[0,1,2]){const t=C0(opOK);t.steps[i]={...t.steps[i],op:'squashFold'};
 assert.throws(()=>E.replay(t),/知らない操作です/,`OP3 ${i+1}手目の未知opが断られない`)}
/* OP4 読込（replay）が失敗しても、いま持っている state は1ミリも動かない。
   ＝replay は純関数で state を受け取らない。verifiedRecipe 経由でも同じ。 */
const OPs=E.create();zCommit(OPs,[0,-1],[0,1],[.5,0]);E.undo(OPs);/* redoStack に1手・紙は平ら */
E.propose(OPs,[-.5,-1],[-.5,1]);OPs.pending.kind='V';E.setSide(OPs,[-.8,0]);/* pending も持たせる */
const opBefore={rec:JSON.stringify(OPs.recipe),rev:OPs.revision,hash:OPs.cache.hash,
 pend:JSON.stringify(OPs.pending),redo:JSON.stringify(OPs.redoStack),cRev:OPs.cacheRevision,
 com:JSON.stringify(OPs.committed)};
const opSame=label=>{assert.equal(JSON.stringify(OPs.recipe),opBefore.rec,label+' recipe が動いた');
 assert.equal(OPs.revision,opBefore.rev,label+' revision が動いた');
 assert.equal(OPs.cache.hash,opBefore.hash,label+' cache が動いた');
 assert.equal(JSON.stringify(OPs.pending),opBefore.pend,label+' pending が動いた');
 assert.equal(JSON.stringify(OPs.redoStack),opBefore.redo,label+' redoStack が動いた');
 assert.equal(OPs.cacheRevision,opBefore.cRev,label+' cacheRevision が動いた');
 assert.equal(JSON.stringify(OPs.committed),opBefore.com,label+' committed が動いた')};
{const t=C0(opOK);t.steps[0]={...t.steps[0],op:'squashFold'};
 assert.throws(()=>E.replay(t),/知らない操作です/,'OP4 未知opの読込が通った');opSame('OP4 読込に失敗しても')}
{const t=C0(opOK);delete t.steps[0].op;
 assert.throws(()=>E.replay(t),/op がありません/,'OP4 op欠落の読込が通った');opSame('OP4 op欠落でも')}
/* 正しい原本の読込（成功）でも、いまの state は動かない＝replay は state を受け取らない純関数。 */
{assert.equal(E.replay(opOK).faces.length>=3,true,'OP4 正常な原本が読めない');opSame('OP4 読込に成功しても')}
/* OP5 やり直し（redo）も同じ門を通る。🚨ここも `op==='flip'` 以外は fold の道へ行っていた。 */
const OPr=E.create();zCommit(OPr,[0,-1],[0,1],[.5,0]);E.flip(OPr,'v');
E.undo(OPr);/* redoStack に flip が1つ乗る */
const rBefore={rec:JSON.stringify(OPr.recipe),rev:OPr.revision,hash:OPr.cache.hash,
 redo:JSON.stringify(OPr.redoStack),pend:JSON.stringify(OPr.pending)};
const rSame=label=>{assert.equal(JSON.stringify(OPr.recipe),rBefore.rec,label+' recipe が動いた');
 assert.equal(OPr.revision,rBefore.rev,label+' revision が動いた');
 assert.equal(OPr.cache.hash,rBefore.hash,label+' cache が動いた');
 assert.equal(JSON.stringify(OPr.redoStack),rBefore.redo,label+' redoStack が動いた');
 assert.equal(JSON.stringify(OPr.pending),rBefore.pend,label+' pending が動いた')};
OPr.redoStack[OPr.redoStack.length-1]={...OPr.redoStack[OPr.redoStack.length-1],op:'squashFold'};
assert.throws(()=>E.redo(OPr),/知らない操作です/,'OP5 未知opをやり直せた');
assert.equal(JSON.stringify(OPr.recipe),rBefore.rec,'OP5 断ったのに recipe が動いた');
assert.equal(OPr.revision,rBefore.rev,'OP5 断ったのに revision が動いた');
assert.equal(OPr.cache.hash,rBefore.hash,'OP5 断ったのに cache が動いた');
delete OPr.redoStack[OPr.redoStack.length-1].op;
assert.throws(()=>E.redo(OPr),/op がありません/,'OP5 op欠落をやり直せた');
/* op を戻せば、これまでどおりやり直せる＝門は正しい手を止めていない。 */
OPr.redoStack[OPr.redoStack.length-1].op='flip';
E.redo(OPr);
assert.deepEqual(OPr.recipe.steps.map(v=>v.op),['fold','flip'],'OP5 op を戻してもやり直せない');
/* OP6 原文＝知っている op はこの1か所にまとまっていて、新しい op を足すと必ずここを通る。 */
assert.match(engSrc,/const OPS=\['fold','crease','flip','reverse'\]/,'OP6 OPS の一覧が engine に無い');/* 2026-09-18 中割り（reverse）を足した */
assert.match(engSrc,/for\(const st of recipe\.steps\)\{\n?\s*assertOp\(st,'JSON再生'\)/,
 'OP6 replay の頭で assertOp を通っていない');
assert.match(engSrc,/assertOp\(step,'やり直し'\)/,'OP6 redo で assertOp を通っていない');

/* ================= FP 裏返した紙でも、表と同じ操作ができる（2026-09-13・本人が画像で指摘） =================
   症状は2つで、どちらも flip の写しかたを snap 側が知らなかったことが元だった。
   ①**裏返すと外周の辺がつかめない**＝`isFlat` が xf を恒等とだけ比べていた（flip は xf に鏡映を合成する）
   ②**裏返すと通常の角ドラッグから対角へ吸いつかない**＝`diagonalOf` が手数を数えていて、flip も1手だった
   → 「角を角へ合わせる」ボタンを押すしか道がなくなり、表と裏で操作が変わっていた。
   ⛔判定そのもの（原点対称・SAME・26px入る/44px離れる・層・成立の関門）は1文字も変えていない。 */
const FPa=E.create();
assert.equal(N.isFlat(FPa),true,'FP0 新しい紙が平らでない');
assert.equal(N.grab(FPa,S([1,-.5]),V).type,'edge','FP0 表で外周の辺をつかめない');
assert.deepEqual(N.diagonalOf(FPa,N.grab(FPa,S([1,-1]),V)),[-1,1],'FP0 表で対角が候補に出ない');
E.flip(FPa,'v');
assert.deepEqual(FPa.cache.faces.map(f=>f.xf),[[-1,0,0,1,0,0]],'FP1 裏返しの xf が前提と違う（検査の土台）');
assert.equal(N.isFlat(FPa),true,'FP1 裏返しただけで紙が平らでなくなった');
assert.equal(N.grab(FPa,S([1,-.5]),V).type,'edge','FP1 裏返すと外周の辺をつかめない');
const FPg=N.grab(FPa,S([1,-1]),V);
assert.equal(FPg.type,'corner','FP1 裏で角をつかめない');
assert.deepEqual(N.diagonalOf(FPa,FPg),[-1,1],'FP1 裏返すと対角が候補から消えた（表だけの操作になっている）');
/* 吸着の出入りは既存のまま＝対角の近くでだけ diagonal、離れれば通常の角折りへ戻る。 */
assert.equal(N.foldTarget(FPa,FPg,S([-1,1]),[-1,1],V,false).snapKind,'diagonal','FP1 裏で対角に吸いつかない');
assert.equal(N.foldTarget(FPa,FPg,S([-.5,.5]),[-.5,.5],V,true).snapped,false,'FP1 対角から離れても吸着が外れない');
/* FP2 その対角合わせが、裏のままちゃんと半分折りとして確定できる。 */
const FPc=N.creaseForCorners(FPa,FPg.point,[-1,1]);
assert.equal(FPc.half,true,'FP2 対角合わせが半分折りになっていない');
E.proposeOnFace(FPa,FPc.line[0],FPc.line[1],FPc.faceId);E.setSide(FPa,FPc.sidePoint);E.select(FPa,ref(FPa));E.confirm(FPa);
assert.deepEqual(FPa.recipe.steps.map(v=>v.op),['flip','fold'],'FP2 裏返した紙を対角で折れない');
assert.equal(FPa.cache.faces.length,2,'FP2 面が2枚にならない');
assert.equal(discontinuity(FPa).bad,0,'FP2 裏返して対角で折ったら紙が破れた');
assert.equal(N.isFlat(FPa),false,'FP2 折ったのに平らのまま（isFlat が緩んでいる）');
assert.equal(N.diagonalOf(FPa,N.grab(FPa,S([1,-1]),V)),null,'FP2 折ったあとも対角が候補に残った');
/* FP3 裏返した紙で外周の辺をつかんで、対辺へ合わせる半分折り。 */
const FPb=E.create();E.flip(FPb,'h');
assert.equal(N.isFlat(FPb),true,'FP3 上下に裏返すと平らでなくなった');
const FPe=foldEdge(FPb,[1,-.5],[-1,-.5]);
assert.equal(Math.abs(FPe.cr.ratio-.5)<1e-9,true,'FP3 裏返した紙の対辺合わせが半分折りになっていない');
assert.deepEqual(FPb.recipe.steps.map(v=>v.op),['flip','fold'],'FP3 裏返した紙で辺折りができない');
assert.equal(discontinuity(FPb).bad,0,'FP3 裏返して辺で折ったら紙が破れた');
/* 🚨FP4 合成入力で直接鳴らす。「裏返しの合成かどうか」を見る所は、自然な手順では届かない
   （折れば layer が 0 でなくなり、手前の門が先に断つ）。門が二重で鳴らない状態にしないため、ここで単体で見る。 */
const synth=xf=>({recipe:{steps:[]},cache:{faces:[{faceId:'paper',layer:0,xf,poly:[[-1,-1],[1,-1],[1,1],[-1,1]]}]}});
for(const[xf,why]of[[[1,0,0,1,0,0],'恒等'],[[-1,0,0,1,0,0],'左右の裏返し'],[[1,0,0,-1,0,0],'上下の裏返し'],[[-1,0,0,-1,0,0],'2回裏返した形']])
 assert.equal(N.isFlat(synth(xf)),true,'FP4 '+why+'を平らと認めない');
for(const[xf,why]of[[[0,-1,1,0,0,0],'回転'],[[1,0,0,1,.5,0],'平行移動'],[[1,.5,0,1,0,0],'せん断'],[[2,0,0,1,0,0],'拡大'],[[-1,0,0,1,0,1e-6],'わずかなずれ']])
 assert.equal(N.isFlat(synth(xf)),false,'FP4 '+why+'を平らと認めた');
const FPmix=synth([-1,0,0,1,0,0]);FPmix.cache.faces.push({faceId:'x',layer:0,xf:[1,0,0,1,0,0],poly:[[0,0],[1,0],[1,1]]});
assert.equal(N.isFlat(FPmix),false,'FP4 面ごとに違う変換なのに平らと認めた（flip は紙ぜんぶに同じものが掛かる）');
const FPlay=synth([-1,0,0,1,0,0]);FPlay.cache.faces[0].layer=1;
assert.equal(N.isFlat(FPlay),false,'FP4 層が0でないのに平らと認めた');
/* FP5 折り目だけの紙：外形は正方形のまま＝対角は (-1,1) だけ（折り目の端はふちの途中なので角ではない）。
   🔺2026-09-14 に「flip 以外の手があれば候補なし」から「いまの紙の外形の角」へ変えた（本人指示）。 */
const FPcr=creaseAt([-1,-.5],[1,-.5],[0,-.9]);
assert.equal(N.isFlat(FPcr),true,'FP5 折り目だけの紙が平らでない');
assert.deepEqual(N.diagonalsOf(FPcr,N.grab(FPcr,S([1,-1]),V)),[[-1,1]],'FP5 折り目つきの正方形で、対角以外（折り目の端など）が候補に出た');
E.flip(FPcr,'v');
assert.equal(N.isFlat(FPcr),true,'FP5 折り目だけの紙を裏返すと平らでなくなった');
assert.equal(N.grab(FPcr,S([1,-.8]),V).type,'edge','FP5 折り目だけの紙を裏返すと外周の辺をつかめない');
assert.deepEqual(N.diagonalsOf(FPcr,N.grab(FPcr,S([1,-1]),V)),[[-1,1]],'FP5 裏返した折り目つきの正方形で、対角が1つにならない');
/* FP6 原文＝裏返しを手数から外すのはこの1か所。新しい op を足すときに必ずここを見る。 */
const snapSrc=fs.readFileSync(path.join(__dirname,'freefold_snap.js'),'utf8');
/* 🔺2026-09-14：対角は「いまの紙の外形の角」から作る。原点対称（折っていない正方形でだけ成り立つ）は使わない。 */
assert.equal(snapSrc.includes('q[0]+g.point[0]'),false,'FP6 対角に原点対称の計算が残っている');
assert.equal(snapSrc.includes("for(const d of diagonalsOf(state,g))list.push({point:d,type:'diagonal'"),true,'FP6 foldTarget が外形の角の候補を使っていない');

console.log(JSON.stringify({recipe:dump(s),edgeHalf:dump(unified),creaseEdge:dump(a4),creaseCross:dump(rep),creaseAlong:dump(bst),edgeAcrossCrease:dump(h3),twoLayer:dump(t4),topTwoOfTwo:dump(k2),topTwoOfFour:dump(k3),referenceRetargeted:dump(kr),tornThenFixed:dump(L1),farFaceOne:dump(M1),redone:dump(R1),edgeToCreaseAcrossSheets:dump(W),freeCrease:dump(FC),freeCreaseCross:dump(FCX),cornerEdgeToCrease:dump(Q),edgeToHinge:dump(U),flipped:dump(FL),creaseThenFold:dump(Y0),openHinge:dump(Z0),squashed:dump(SQ0),pocket3:dump(P2),pocket5:dump(P4)}));
