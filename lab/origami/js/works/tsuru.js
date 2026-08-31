// ============================================================
// works/tsuru.js — つる（完成：鳥の基本形＋首・尾・くちばし＋羽を開く＋膨らませ）
//
//   ★2026-08-29 全面書き直し。前回までのPhase1(座布団折り)+Phase2(独自花びら折り)は
//     幾何的に誤りだったため破棄した（座布団折りは「やっこさん」と同じブリンツ折りで、
//     フラップが外側の辺にくっつく1層構造。鶴の鳥の基本形に必要な
//     「2層フラップが中心から自由に開く」構造とは骨格が別物だった）。
//
//   正しい鳥の基本形の折り線パターンは、The Mathematics of Origami
//   (Bertschinger, Slote, Spencer, Vinitsky, Carleton College) の
//   Figure 2.2 から実測して得た（PDFのベクトル線データを直接抽出・
//   ダッシュパターンで山谷を判別。Kawasaki/Maekawaの定理を満たすことを検算済み）。
//
//   正方形の頂点(点が上向きのひし形として描く)：
//     N(0,0,1)[上] E(1,0,0)[右] S(0,0,-1)[下] W(-1,0,0)[左]  O(0,0,0)[中心]
//   花びら折りの内部点(N-W辺・N-E辺・S-W辺・S-E辺のそれぞれの中点方向、
//     Oからの距離が中心-頂点距離の(√2-1)倍)：
//     PNW=(-k,0,k) PNE=(k,0,k) PSW=(-k,0,-k) PSE=(k,0,-k)  k=(2-√2)/2≈0.2929
//
//   折り線(実測)：
//     N-O-S＝山折り(まっすぐ1本、模型の「背骨」)
//     N-PNW, N-PNE, S-PSW, S-PSE＝谷折り(4本、NとSがそれぞれ花びら折りされる)
//     W-PNW, W-PSW, E-PNE, E-PSE＝谷折り(4本、WとEは花びら折りされない単純フラップ)
//     PNW-PSW, PNE-PSE＝山折り(2本、小さい正方形の左右の辺)
//     PSW-PNE, PNW-PSE＝谷折り(2本、Oを通る対角線)
//
//   ボーン木は8枚の三角形パネル(F1〜F8)から成り、O点で6本・各内部点で4本の
//   折り線が交わる(全頂点でKawasaki・Maekawaの定理を満たすことを確認済み)。
//   全ヒンジを角度πまで折ると、8枚のパネルが N,S(同じ点) / PNW,PNE,PSW,PSE(2点に
//   集約) / W,E(同じ点) / O にきれいに集約し、細長い「たこ形」(鳥の基本形の断面)
//   になることを検算済み(隙間なし、面積の保存も一致)。
//
//   ★2026-08-29 続き：首・尾・くちばしの中割り折りを追加した。
//   全ヒンジπ後の最終形は「T(N&Sが同じ点)/L(PNW&PNEが同じ点)/R(PSW&PSEが同じ点)/
//   B(W&Eが同じ点)」の4つの外周の角＋内部にOという凧形(Wikipedia「Bird Base」の
//   "4 long points at the corners, one short point at the center"と一致)。
//   T側はpanel0(N,O,PNW)とpanel7(N,O,PNE)がNで重なる2層と、panel3(O,PSW,S)と
//   panel4(O,PSE,S)がSで重なる2層が合体した4層構造、B側はpanel2(W,PNW,PSW)と
//   panel6(E,PNE,PSE)が重なる単純な2層構造(scratchpad/origami/tsuru_full.pyで
//   全頂点座標を独立検算・一致確認済み)。
//
//   ★中割り折りの追加ボーンの設計で判明した点(要メモ)：
//   panel0/panel7(N側ペア)は「自分の辺に沿った有効な折り線」だけで、二層とも同じ
//   ワールド座標に着地させられる(検算OK)。だが panel3/panel4(S側ペア)は、
//   原点をpanel0側と共有させたまま同じ着地点に合わせようとすると、必要な回転軸が
//   panel3自身のどの辺の方向にもならない(=紙が破れる不正な折り線になる)ことが
//   数値的に判明した(originから終点までの距離保存という回転の制約と、
//   「軸は自分の辺の方向」という制約が両立しない)。よって首はN側の2層
//   (panel0,panel7)だけを中割り折りして作り、S側の2層(panel3,panel4)は
//   折らずに胴体内部に隠れたひだとして残す(実物の鶴でも首の可視部分は
//   4層の一部だけが表に出る)。尾はB側がもともと単純2層なのでこの問題は起きない。
// ============================================================
'use strict';

window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};

const TV = OGL.vecNorm;
const V_SUB = OGL.vecSub, V_ADD = OGL.vecAdd, V_SCALE = OGL.vecScale;
function lerp(a, b, t) { return V_ADD(a, V_SCALE(V_SUB(b, a), t)); }

const N = [0, 0, 1], E = [1, 0, 0], S = [0, 0, -1], W = [-1, 0, 0];
const O = [0, 0, 0];
const K = (2 - Math.SQRT2) / 2;
const PNW = [-K, 0, K], PNE = [K, 0, K], PSW = [-K, 0, -K], PSE = [K, 0, -K];

// ---- 中割り折りの折り線位置(scratchpad/origami/tsuru_full.pyで検算した比率) ----
const F_TAIL = 0.5;   // 尾：脚の付け根から先端までの中点で折り返す
const F_NECK1 = 0.42; // 首：Nの付け根から42%の位置で折り返す(首+くちばし用フラップの大きさ)
const F_NECK2 = 0.2;  // くちばし：首フラップの先端から20%の小さい折り返し

// ---- 羽を開く＝ヒンジではなく膨らませ(inflate)で表現する ----
// ★2026-08-30 続き4：backbone(hinge4=O-S軸)を折りステップとして固定角度(150°)で
// 開く実装をしたが、羽(panel1/5=大きな平らな三角形)が紙飛行機のように見え、
// つるらしいシルエットにならなかった。続けてhinge4をposeAdjustスライダーにして
// 30〜100°まで試したが、開くほど「くちばしの2層が引き裂かれてズレる」問題が
// 避けられなかった(hinge4より下流にくちばしのミラー側がぶら下がる木構造のため)。
//
// ★2026-08-30 続き6：本人から実物の写真を見せてもらい、「ネットの折り方通りに
// やればいいのでは」と指摘され、実際の折り方(たのしい折り紙.jp等)を確認しなおした。
// 「羽を開く」は独立した工程ではなく、**最後の1工程「下から空気を入れながら
// 羽を左右に広げる」**——つまり新しい折り筋を足すのでも、剛体のヒンジを
// 回転させるのでもなく、**息を吹き込んで胴体を丸くふくらませる動作そのもの**
// だった。これは元からある`inflate`(膨らませ、ふうせんと同じ仕組み)と
// 完全に同じ機構——**hinge4やposeAdjustは一切不要**で、下のinflateSignだけで
// 実機で見て明らかにつるらしい形になった(くちばしのズレも起きない。inflateは
// 頂点をその場の法線方向へ押し出すだけで、レイヤーを引き裂く回転を伴わないため)。
// 旧poseAdjust(wingOpen)・bone14(ひねり補正ボーン)は削除した。

const C2 = lerp(PNW, W, F_TAIL), D2 = lerp(PSW, W, F_TAIL);   // panel2(尾・W側)の折り線
const C6 = lerp(PNE, E, F_TAIL), D6 = lerp(PSE, E, F_TAIL);   // panel6(尾・E側)の折り線
const CN0 = lerp(N, O, F_NECK1), CN0b = lerp(N, PNW, F_NECK1), CN7b = lerp(N, PNE, F_NECK1); // 首の折り線
const BK0 = lerp(N, CN0, F_NECK2), BK0b = lerp(N, CN0b, F_NECK2), BK1b = lerp(N, CN7b, F_NECK2); // くちばしの折り線
// S側の未加工ひだ(panel3,4)も、N側(panel0,7)と同じ比率で先端を切り落とし、
// 尾(panel2,6→8,9)と同じやり方で「別レイヤー(panel14,15)」として首と一緒に
// 折りたたむ。折りきった状態ではN側とS側は同じ点Tに重なる＝CN0とCS0(以下)も
// 同じ位置に重なるので、bone14/15はbone10/11とまったく同じ世界座標の軌跡を
// たどる(lerpの線形性から導ける。scratchpad/origami/tsuru_full.py系で検算済み)。
// ★2026-08-30 最初は「切り落として消す」だけで直したが、それだと平らな状態
// （折る前）で紙にその分の穴が開いてしまう不具合を生んでいた
// (たー実測「最初から手裏剣型」で発覚)。尾と同じ「切り取った角を別レイヤーの
// パネルにする」やり方に直した——消すのではなく、首と一緒にたたんで隠す。
const CS0 = lerp(S, O, F_NECK1), CS0w = lerp(S, PSW, F_NECK1), CS0e = lerp(S, PSE, F_NECK1);

// ★2026-08-30 続き8：内部点(PNW/PSW/PSE/PNE)のまわりに、どのパネルにも
// 属さない三角形の「すきま」が4か所あることが判明した(たー実測「最初から
// 手裏剣型」で発覚、面積を数値検算すると正方形の実に41%が未定義だった)。
// 例：PNWのまわりの4本の折り筋(O-PNW/N-PNW/W-PNW/PNW-PSW)は360°を4つの
// くさび形に分けるが、既存パネルは(O,N)側=panel0と(W,PSW)側=panel2と
// (PSW,O)側=panel1しかカバーしておらず、(N,W)側のくさび(三角形N-PNW-W)が
// 丸ごと未定義だった。
//
// NotebookLM(三谷純・舘知宏両氏の剛体折り紙理論を検索)に確認したところ、
// 「平面の展開図としては折り筋の要らない1枚の平らな面だが、剛体パネルのまま
// 角度を進めるシミュレーションでは、境界エッジ(ここではN-W)上に新しい頂点を
// 置いて内部の特異点(PNW)から補助線を引く三角分割が標準的な回避策」との
// 回答を得た。最初は「境界エッジの中点MをPNW軸にY軸(紙面に垂直)まわりへ
// 90°捻る」という1自由度の補正を試したが、これはM(境界の共有頂点)の
// 位置は合わせられても、くさびの「もう一つの角」(N側ならW、W側ならS)の
// 位置合わせと両立しない(1つの回転パラメータで2つの独立した点を同時に
// 合わせることは一般にできない)ことが実機の数値ダンプで発覚した。
//
// 正しい処方：くさびを2つの三角形(基準となる内部点PNWは共有)に割り、
// **両側それぞれに、もう片方の遠い角(N側ならN、W側ならW)を軸とする
// 独立した折り目を新設し、どちらも他の主要な折り筋とまったく同じ
// targetAngle=180°(π)まで回す**。Python行列計算で検算すると、この処方は
// 境界の共有点だけでなく、PNW自身(軸上なので不変)の位置も寸分違わず
// 一致することを確認した(4か所とも同じ構造で残差は浮動小数点誤差のみ)。
// 直感的には「花びら折りの本体だけでなく、隣り合うくさびも同じ折り筋の
// 延長として一緒に180°畳まれる」という、実物の花びら折りに近い動き。
const M_NW = lerp(N, W, 0.5), M_WS = lerp(W, S, 0.5), M_SE = lerp(S, E, 0.5), M_EN = lerp(E, N, 0.5);

// (x,z) ∈ [-1,1] を uv ∈ [0,1] へ（他ファイルと同じ変換式）
function uv(p) { return [(p[0] + 1) / 2, (p[2] + 1) / 2]; }

// ---- パネル定義から verts/tris/panel/uv を組み立てる ----
// (帯構造が二段の四角形に分かれるパネル(0,2,6,7,10,11)があるため、
//  手書きの頂点インデックスよりビルダーの方が事故が少ない)
const PANEL_DEFS = [
  { bone: 0, tris: [[O, PNW, CN0b], [O, CN0b, CN0]] },       // F1(根)：N側の角を首用に切り取った残り
  { bone: 1, tris: [[O, PNW, PSW]] },                        // F2：羽の帯(L-R)
  { bone: 2, tris: [[PNW, PSW, D2], [PNW, D2, C2]] },        // F3：Wの単純フラップ、尾用に角を切り取った残り
  { bone: 3, tris: [[O, PSW, CS0w], [O, CS0w, CS0]] },       // F4(胴体内部のひだ：首用に先端を切り落とした残り)
  { bone: 4, tris: [[O, PSE, CS0e], [O, CS0e, CS0]] },       // F8(胴体内部のひだ：首用に先端を切り落とした残り)
  { bone: 5, tris: [[O, PNE, PSE]] },                        // F6：羽の帯(L-R)
  { bone: 6, tris: [[PNE, PSE, D6], [PNE, D6, C6]] },        // F7：Eの単純フラップ、尾用に角を切り取った残り
  { bone: 7, tris: [[O, PNE, CN7b], [O, CN7b, CN0]] },       // F5：N側の角を首用に切り取った残り
  { bone: 8, tris: [[C2, D2, W]] },                          // 尾(W側レイヤー)
  { bone: 9, tris: [[C6, D6, E]] },                          // 尾(E側レイヤー)
  { bone: 10, tris: [[CN0, CN0b, BK0b], [CN0, BK0b, BK0]] }, // 首(N側)：くちばし用に先端を切り取った残り
  { bone: 11, tris: [[CN0, CN7b, BK1b], [CN0, BK1b, BK0]] }, // 首(N側ミラー)：同上
  { bone: 12, tris: [[BK0, BK0b, N]] },                      // くちばし(レイヤーA)
  { bone: 13, tris: [[BK0, BK1b, N]] },                      // くちばし(レイヤーB)
  { bone: 14, tris: [[S, CS0w, CS0]] },                      // S側の切り取り分：首と一緒にたたむ(N側と同じ軌跡)
  { bone: 15, tris: [[S, CS0e, CS0]] },                      // S側の切り取り分(ミラー)：同上
  // ---- すきま4か所、それぞれ2枚(N-W/W-S/S-E/E-N)。各ペアの片方は既存の
  //      主要パネル(0,2,4,6,3,7)を親に、もう片方の遠い角を軸に180°折る ----
  { bone: 16, tris: [[N, PNW, M_NW]] },                      // すきま(N-PNW-W)：N側半分、親bone0、PNW-N軸に180°
  { bone: 17, tris: [[PNW, W, M_NW]] },                      // すきま(N-PNW-W)：W側半分、親bone2、PNW-W軸に180°
  { bone: 18, tris: [[W, PSW, M_WS]] },                      // すきま(W-PSW-S)：W側半分、親bone2、PSW-W軸に180°
  { bone: 19, tris: [[PSW, S, M_WS]] },                      // すきま(W-PSW-S)：S側半分、親bone3、PSW-S軸に180°
  { bone: 20, tris: [[S, PSE, M_SE]] },                      // すきま(S-PSE-E)：S側半分、親bone4、PSE-S軸に180°
  { bone: 21, tris: [[PSE, E, M_SE]] },                      // すきま(S-PSE-E)：E側半分、親bone6、PSE-E軸に180°
  { bone: 22, tris: [[E, PNE, M_EN]] },                      // すきま(E-PNE-N)：E側半分、親bone6、PNE-E軸に180°
  { bone: 23, tris: [[PNE, N, M_EN]] },                      // すきま(E-PNE-N)：N側半分、親bone7、PNE-N軸に180°
];

const verts = [], tris = [], panel = [], uvArr = [];
for (const def of PANEL_DEFS) {
  for (const tri of def.tris) {
    const base = verts.length;
    for (const p of tri) { verts.push(p); panel.push(def.bone); uvArr.push(uv(p)); }
    tris.push([base, base + 1, base + 2]);
  }
}

const boneParent = [-1, 0, 1, 1, 3, 4, 5, 5, 2, 6, 0, 7, 10, 11, 3, 4, 0, 2, 2, 3, 4, 6, 6, 7];
const hinge = [
  null,                                              // 0: F1(根)
  { origin: O, axis: TV(PNW) },                       // 1: F2 … O-PNW（谷）
  { origin: PNW, axis: TV([0, 0, -1]) },              // 2: F3 … PNW-PSW（山）
  { origin: O, axis: TV(PSW) },                       // 3: F4 … O-PSW（谷）
  { origin: O, axis: TV(S) },                         // 4: F8 … O-S（山）
  { origin: O, axis: TV(PSE) },                       // 5: F6 … O-PSE（谷）
  { origin: PSE, axis: TV([0, 0, 1]) },               // 6: F7 … PSE-PNE（山）
  { origin: O, axis: TV(PNE) },                       // 7: F5 … O-PNE（谷）
  { origin: C2, axis: TV(V_SUB(D2, C2)) },            // 8: 尾（W側）中割り
  { origin: C6, axis: TV(V_SUB(D6, C6)) },            // 9: 尾（E側）中割り
  { origin: CN0, axis: TV(V_SUB(CN0b, CN0)) },        // 10: 首（N側）中割り
  { origin: CN0, axis: TV(V_SUB(CN7b, CN0)) },        // 11: 首（N側ミラー）中割り
  { origin: BK0, axis: TV(V_SUB(BK0b, BK0)) },        // 12: くちばし 中割り
  { origin: BK0, axis: TV(V_SUB(BK1b, BK0)) },        // 13: くちばし ミラー 中割り
  { origin: CS0, axis: TV(V_SUB(CS0w, CS0)) },        // 14: S側切り取り分（首と同じ軌跡）
  { origin: CS0, axis: TV(V_SUB(CS0e, CS0)) },        // 15: S側切り取り分ミラー（首と同じ軌跡）
  { origin: PNW, axis: TV(V_SUB(N, PNW)) },           // 16: すきま(N-PNW-W)のN側半分、親bone0
  { origin: PNW, axis: TV(V_SUB(W, PNW)) },           // 17: すきま(N-PNW-W)のW側半分、親bone2
  { origin: PSW, axis: TV(V_SUB(W, PSW)) },           // 18: すきま(W-PSW-S)のW側半分、親bone2
  { origin: PSW, axis: TV(V_SUB(S, PSW)) },           // 19: すきま(W-PSW-S)のS側半分、親bone3
  { origin: PSE, axis: TV(V_SUB(S, PSE)) },           // 20: すきま(S-PSE-E)のS側半分、親bone4
  { origin: PSE, axis: TV(V_SUB(E, PSE)) },           // 21: すきま(S-PSE-E)のE側半分、親bone6
  { origin: PNE, axis: TV(V_SUB(E, PNE)) },           // 22: すきま(E-PNE-N)のE側半分、親bone6
  { origin: PNE, axis: TV(V_SUB(N, PNE)) },           // 23: すきま(E-PNE-N)のN側半分、親bone7
];

ORIGAMI_WORKS.tsuru = {
  id: 'tsuru', name: 'つる', emoji: '🕊️', difficulty: 3,
  mesh: {
    verts, tris, uv: uvArr, panel, boneParent, hinge,
    // 膨らませ：羽(1,2,8=前側)と(5,6,9=後ろ側)を互い違いの向きへ、
    // 首・尾・くちばし・胴内部のひだは動かさない(0)。実機で1.0だと各パネルが
    // バラバラに離れて見えたため(2026-08-30実測)、0.4に弱めてある。
    inflateSign: [0, -0.4, -0.4, 0, 0, 0.4, 0.4, 0, -0.4, 0.4, 0, 0, 0, 0, 0, 0,
      0, -0.4, -0.4, 0, 0, 0.4, 0.4, 0],
  },
  steps: [
    // ★2026-08-30 続き7で「7本まとめて1ステップ」に統合したが、続き10で
    //   たーから「アニメーションを見せられてるだけで、子供は何が起きてるか
    //   わからない」と指摘され、7本の個別ステップに戻した。
    //   代わりに実測で確認したこと（`indiv_boneN_50pct.png`）：紙を貫通して
    //   見える不具合が起きるのは**bone1(最初の一手)だけ**——bone1はまだ何も
    //   折られていない残り全部(2〜7の祖先)を1枚の平板として引き連れるため。
    //   bone2以降は、直前までに折られた分がすでに立体になっているので、
    //   個別に動かしても大きな貫通は起きない（本物の折り紙でも「まず4すみを
    //   まとめて中心に集める」動作だけは1つのまとまった手の動きで、
    //   そこから先の花びら折りは1本ずつ形を作っていくのと合う）。
    //   すきま埋め(bone16〜23)は、両側の親ボーンが**両方**折り終わった時点の
    //   ステップに乗せる（例：GAP1は親がbone0(常に準備済み)とbone2→bone2の
    //   ステップに。GAP3は親がbone4とbone6→遅い方のbone6のステップに）。
    { id: 1, handle: { boneId: 1, local: PSW }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '4つの角を中心に集めるように、まず1つ目を谷折り',
      creaseLine: { boneId: 0, a: O, b: PNW, kind: 'valley' } },
    { id: 2, handle: { boneId: 2, local: W, linkedBoneIds: [16, 17] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '左の角を、まん中に合わせて山折り',
      creaseLine: { boneId: 1, a: PNW, b: PSW, kind: 'mountain' } },
    { id: 3, handle: { boneId: 3, local: S, linkedBoneIds: [18, 19] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '中心から下の点まで、谷折り',
      creaseLine: { boneId: 1, a: O, b: PSW, kind: 'valley' } },
    { id: 4, handle: { boneId: 4, local: PSE }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '下の角を、まん中に合わせて山折り',
      creaseLine: { boneId: 3, a: O, b: S, kind: 'mountain' } },
    { id: 5, handle: { boneId: 5, local: PNE }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '中心から右下の点まで、谷折り',
      creaseLine: { boneId: 4, a: O, b: PSE, kind: 'valley' } },
    { id: 6, handle: { boneId: 6, local: E, linkedBoneIds: [20, 21] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '右の角を、まん中に合わせて山折り',
      creaseLine: { boneId: 5, a: PSE, b: PNE, kind: 'mountain' } },
    { id: 7, handle: { boneId: 7, local: N, linkedBoneIds: [22, 23] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '中心から上の点まで、谷折り（鳥の基本形 かんせい）',
      creaseLine: { boneId: 5, a: O, b: PNE, kind: 'valley' } },
    { id: 8, handle: { boneId: 8, local: W, linkedBoneIds: [9] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '下の脚を、中わり折りで尾にする',
      creaseLine: { boneId: 2, a: C2, b: D2, kind: 'valley' } },
    { id: 9, handle: { boneId: 10, local: N, linkedBoneIds: [11, 14, 15] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '上の脚を、中わり折りで首にする',
      creaseLine: { boneId: 0, a: CN0, b: CN0b, kind: 'valley' } },
    { id: 10, handle: { boneId: 12, local: N, linkedBoneIds: [13] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '首の先を、中わり折りでくちばしにする（かんせい）',
      creaseLine: { boneId: 10, a: BK0, b: BK0b, kind: 'valley' } },
    // ★「羽を開く」は折り手順(steps)には含めない。実物の折り方でも独立した
    //   工程ではなく、最後の1工程「下から空気を入れながら羽を左右に広げる」＝
    //   下のinflate(膨らませ)そのものだったため（理由は上のコメント「続き6」）。
  ],
  labelPoints: [
    { boneId: 0, local: N, label: 'N' },
    { boneId: 0, local: O, label: 'O' },
  ],
  poseAdjust: {},
  inflate: { min: 0, max: 1, default: 0 },
  cutSlots: [],
};
