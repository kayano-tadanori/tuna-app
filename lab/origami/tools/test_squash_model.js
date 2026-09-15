'use strict';
/* 試作画面の幾何モデル（squash_model.js）の検査。
   ★画面が渡すのと**同じ配列**を作らせて、そこに検証をかける。
   ⛔ 既存の自由折り画面・エンジン・作品・JSON形式は触らない。
   使い方：  node test_squash_model.js
*/
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const HERE = __dirname;
vm.runInThisContext(fs.readFileSync(path.join(HERE, 'squash_model.js'), 'utf8'),
                    { filename: 'squash_model.js' });
const M = globalThis.SquashModel;

let ok_all = true;
const check = (name, ok, extra) => {
 ok_all = ok_all && !!ok;
 console.log((ok ? 'OK  ' : 'NG  ') + name + (extra ? ' … ' + extra : ''));
};

/* ① 連動式そのもの（tan(γ1/2)·tan(γ2/2)=√2）。安定形の atan2 で書けているか。 */
let worstRel = 0;
for (let k = 1; k < 200; k++) {
 const t = k / 200, g2 = Math.PI * (1 - t), g1 = M.gamma1(g2);
 worstRel = Math.max(worstRel, Math.abs(Math.tan(g1 / 2) * Math.tan(g2 / 2) - Math.SQRT2));
}
check('連動式は tan(γ1/2)·tan(γ2/2)=√2 を満たす', worstRel < 1e-9, worstRel.toExponential(2));
check('駆動と従属の割りつけ（ρ4=ρ2・ρ1=ρ3・固定は ρ5=ρ7=180 / ρ0=ρ6=0）', (() => {
 for (const t of [0, .13, .5, .77, 1]) {
  const r = M.rhoOf(t);
  if (Math.abs(r[4] - r[2]) > 1e-12 || Math.abs(r[1] - r[3]) > 1e-12) return false;
  if (Math.abs(r[5] - Math.PI) > 1e-12 || Math.abs(r[7] - Math.PI) > 1e-12) return false;
  if (r[0] !== 0 || r[6] !== 0) return false;
 }
 return true;
})());
check('直線補間ではない（ρ2=90°のとき ρ1=70.53°）',
 Math.abs(M.rhoOf(0.5)[1] * 180 / Math.PI - 70.5288) < 1e-3,
 (M.rhoOf(0.5)[1] * 180 / Math.PI).toFixed(4) + '°');

/* ② 素材の幾何（厚み0）を細かい刻みで検証する。★合格基準はここだけ。
      共有境界は「離れない（0）」で見る＝隙間を許容する基準は使わない。 */
{
 let bad = [], worstPen = [], worstShare = 0;
 for (let k = 0; k <= 400; k++) {
  const t = k / 400, v = M.verify(t);
  if (!v.ok) bad.push('t=' + t.toFixed(3) + ':' + v.checks.filter(c => !c.ok).map(c => c.name).join('/'));
  if (v.penetration.length) worstPen.push('t=' + t.toFixed(3) + ':' + v.penetration.join(','));
  const pl = M.panels(t);
  for (const [a, b] of M.SHARED) worstShare = Math.max(worstShare,
   Math.hypot(pl[a][2][0]-pl[b][1][0], pl[a][2][1]-pl[b][1][1], pl[a][2][2]-pl[b][1][2]));
 }
 check('401コマ通し（素材の幾何・厚み0）で検証がぜんぶ通る', bad.length === 0, bad.slice(0, 2).join(' '));
 check('　共有境界8本が全コマで離れない（紙がつながっている）', worstShare < 1e-9, worstShare.toExponential(2));
 check('　そのあいだ紙の交差は見つからない（⛔非貫通の保証ではない）', worstPen.length === 0, worstPen.slice(0, 2).join(' '));
}

/* ③ renderVertices が panels と一致＝画面へ渡す Float32Array が本物（既定＝持ち上げ0） */
{
 const rv = M.renderVertices(0.37), pl = M.panels(0.37);
 let same = rv.positions.length === 72 && rv.lift === 0;
 for (let i = 0; i < 8 && same; i++) for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++)
  if (Math.abs(rv.positions[i * 9 + k * 3 + c] - pl[i][k][c]) > 1e-6) same = false;
 check('renderVertices の既定は素材の幾何そのまま（持ち上げ0・画面と検証がずれない）', same);
}

/* ③-b 描画上の調整は**素材の幾何から分かれている**。合格基準には入らない。 */
{
 const L = 0.006;
 check('verify は引数に持ち上げを取らない＝合格基準に表示の都合が入らない',
  M.verify.length === 1, 'verify の引数 ' + M.verify.length + ' 個');
 const base = M.panels(0.3), shown = M.displayPanels(0.3, L);
 check('持ち上げても xy は素材のまま（動くのは基準面の法線だけ）',
  shown.every((p, i) => p.every((v, k) => Math.abs(v[0]-base[i][k][0]) < 1e-15 && Math.abs(v[1]-base[i][k][1]) < 1e-15)));
 check('持ち上げると見た目の共有境界はひらく＝だから合格基準には使わない', (() => {
  let g = 0; for (const [a, b] of M.SHARED) g = Math.max(g,
   Math.hypot(shown[a][2][0]-shown[b][1][0], shown[a][2][1]-shown[b][1][1], shown[a][2][2]-shown[b][1][2]));
  return g > 1e-3; })());
 check('持ち上げを入れても、素材の幾何の検証は変わらず通る', M.verify(0.3).ok);
 const insp = M.inspectDisplay(0.3, L);
 check('inspectDisplay は「層順どおり」「xy は素材のまま」を見る（別立て）',
  insp.filter(c => c.ok === true).length >= 2 && insp.some(c => c.ok === null));
}

/* ④ 端点の形と層順が、検証ずみの表（build_tsuru_base.py）と同じ出どころか */
{
 const src = fs.readFileSync(path.join(HERE, 'build_tsuru_base.py'), 'utf8');
 check('層の表 [0, 3, 3, 2, 2, 1, 1, 0] / [0, 0, 3, 3, 2, 1, 1, 0] が build_tsuru_base.py にある',
  src.includes('[0, 3, 3, 2, 2, 1, 1, 0]') && src.includes('[0, 0, 3, 3, 2, 1, 1, 0]'));
 check('モデルの層の表が、その2行と同じ',
  JSON.stringify(M.LAYER_START) === '[0,3,3,2,2,1,1,0]' &&
  JSON.stringify(M.LAYER_END) === '[0,0,3,3,2,1,1,0]');
}

/* ⑤ 貫通の見張りが、わざと貫かせたら鳴る（鳴らない見張りは見張りでない） */
{
 const pl = M.panels(0.5);
 /* P0（三角 O,E,NE）の内側 (0.85,0.25) を真上から突き抜ける三角 */
 const stab = [[0.8, 0.2, -1], [0.9, 0.3, 1], [1.6, 0.2, 0]];
 const fake = pl.slice(); fake[6] = stab;
 check('貫通の見張りは、わざと突き抜けさせるとちゃんと鳴る',
  M.probePenetration(fake).length > 0, M.probePenetration(fake).join(' '));
}

/* ⑥ 画面の原文＝画面は自分で幾何を作らず、モデルの配列をそのまま WebGL へ渡している */
{
 const ui = fs.readFileSync(path.join(HERE, 'squash_preview.html'), 'utf8');
 /* WebGL の描画は squash_gl.js（自由折り画面と共用・2026-09-14）。画面がそれを読み、配列をそのまま渡しているかを見る。 */
 const glSrc = fs.readFileSync(path.join(HERE, 'squash_gl.js'), 'utf8');
 check('画面は描画を squash_gl.js から読んでいる', /<script src="squash_gl\.js"><\/script>/.test(ui) && /SquashGL\.create\(cv,/.test(ui));
 check('画面は renderVertices の配列をそのまま bufferData に渡している',
  /const rv = M\.renderVertices\(t, lift\);/.test(ui) && /GL\.draw\(rv\.positions, m\)/.test(ui) &&
  /function draw\(positions, mvp\)[\s\S]{0,400}gl\.bufferData\(gl\.ARRAY_BUFFER, positions/.test(glSrc));
 check('画面の既定は持ち上げ0（素材の幾何そのまま）', /let lift = 0;/.test(ui));
 check('画面の合格基準は厚み0の検証（M.verify(t) を持ち上げ抜きで呼ぶ）',
  /M\.verify\(t\)/.test(ui) && !/M\.verify\(t,/.test(ui));
 check('持ち上げは検証表示の中の実験設定（ふだんの操作に出さない）',
  /id="expLift"/.test(ui) && !/id="expLift"[\s\S]{0,80}<\/div>\s*<\/div>\s*<canvas/.test(ui));
 check('画面は depth バッファを使っている（面の固定の描画順で並べていない）',
  /gl\.enable\(gl\.DEPTH_TEST\)/.test(glSrc) && !/sort\(/.test(ui) && !/sort\(/.test(glSrc));
 check('画面は表裏を描き分けている（gl_FrontFacing）', /gl_FrontFacing/.test(glSrc));
 check('画面は保存も読込もしない（実験用の別データ）',
  !/FileReader|download|localStorage|fetch\(/.test(ui));
 check('画面は既存のエンジンを読みこんでいない',
  !/freefold_engine|origami_recipe|FreeFoldEngine/.test(ui));
 check('検証表示に「非貫通は未検証」と出している', /非貫通/.test(ui) && /未検証/.test(ui));
 check('検証表示は既定で隠れている（子どもには紙とボタンだけ）',
  /let t = 0, dir = 0, showInsp = false;/.test(ui) && /id="panel"[^>]*>/.test(ui));
}

console.log('');
console.log('― この検査が言っていないこと ―');
console.log('  ⛔ 紙どうしの貫通は**未検証**。⑤は見張りが生きているかを見ただけ');
console.log('  ⛔ 実際の画面の見えかたは test_squash_preview_browser.js（実Chrome）で見る');
console.log('');
/* --write-motion：check_squash_motion.py（袋折りの途中の非貫通を τ の多項式で厳密に見る）が、τ の式とこのモデルの座標を突き合わせるためのコマ */
if (process.argv.includes('--write-motion')) {
  const frames = []; for (let k = 0; k <= 40; k++) { const t = k / 40; frames.push({ t, panels: SquashModel.panels(t) }); }
  fs.writeFileSync(path.join(__dirname, 'squash_motion_js.json'), JSON.stringify({ note: 'node test_squash_model.js --write-motion が書く（squash_model.panels を 41コマ）。check_squash_motion.py が τ の式と突き合わせる。', frames }));
  console.log('  wrote squash_motion_js.json');
}
console.log(ok_all ? 'ALL OK' : '★NGあり');
process.exit(ok_all ? 0 : 1);
