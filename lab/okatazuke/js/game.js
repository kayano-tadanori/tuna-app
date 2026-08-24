// ============================================================
// game.js — オカンの おかたづけ（にもつを おす パズル）
//   ルールは core.js、絵は renderer.js/scene.js/okan.js、面は levels.js
//   ここは「つなぎ」＋カメラ＋入力＋演出＋画面のきりかえ
// ============================================================
'use strict';

const OKG = {
  R: null, rig: null, mesh: {}, okan: null,
  game: null, level: 0, tier: 0,
  screen: 'title',
  time: 0, last: 0,
  anim: null, queue: [],
  fx: [], cheer: 0, hitstop: 0,
  cam: { dist: 8, pitch: 0.86, tx: 0, tz: 0, oy: 0, oz: 0, shake: 0 },
  board: null,
  stuckMsgShown: false,
  embed: false, paid: false,
};

const OKG_KEY = 'okatazukeSave';
const OK_TIER_NAME = ['やさしい', 'ふつう', 'むずかしい', 'ゲキむず'];

// 見る角度（低い斜め → ま上）。★ま上に近づけても つぶれないように、
//   カメラの上向きは いつも「傾きに合わせた向き」を渡す（0,1,0 のままだと
//   視線と平行になって lookAt が壊れる）。
const OK_PITCH = [0.66, 0.86, 1.12, 1.50];
const OK_PITCH_NAME = ['ひくく', 'ふつう', 'たかく', 'ま上'];
const okCamUp = p => [0, Math.cos(p), -Math.sin(p)];

// ---- 保存（クリアした面と、いちばん少ない手数）--------------------------
function okLoad() {
  try { return JSON.parse(localStorage.getItem(OKG_KEY) || '{}'); } catch (e) { return {}; }
}
function okSave(d) {
  try { localStorage.setItem(OKG_KEY, JSON.stringify(d)); } catch (e) {}
}
// ---- とちゅうの状態（大きい面は1,000手を超えるので、抜けても続きから）----
const OKG_NOW = 'okatazukeNow';
function okSaveNow() {
  if (!OKG.game || OKG.screen !== 'play') return;
  const g = OKG.game;
  try {
    if (!g.history.length) { localStorage.removeItem(OKG_NOW); return; }
    localStorage.setItem(OKG_NOW, JSON.stringify({
      i: OKG.level, p: g.history.map(h => h.dir).join(''),
    }));
  } catch (e) {}
}
function okClearNow() {
  try { localStorage.removeItem(OKG_NOW); } catch (e) {}
}
function okLoadNow() {
  try { return JSON.parse(localStorage.getItem(OKG_NOW) || 'null'); } catch (e) { return null; }
}

function okRecord(idx, moves, pushes) {
  const d = okLoad();
  const k = 'L' + idx;
  const cur = d[k];
  if (!cur || pushes < cur.p || (pushes === cur.p && moves < cur.m)) {
    d[k] = { m: moves, p: pushes };
  }
  okSave(d);
  return d[k];
}

// ---- 立ちあげ ------------------------------------------------------------
function okBoot() {
  const cv = document.getElementById('cv');
  const R = new Renderer(cv);
  OKG.R = R;
  const gl = R.gl;
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  // ★取りこんだ面は大きい（20×13マスなど）。入れものを小さくすると
  //   はみ出したぶんが 描かれない＝盤が欠ける。多めに取る。
  R.initShadows(200);
  R.initParticles(600);
  OKG.mesh.tile = R.makeInstanced(SCN.tile(), 900);
  OKG.mesh.wall = R.makeInstanced(SCN.wall(), 900);
  OKG.mesh.box = R.makeInstanced(SCN.box(), 140);
  OKG.mesh.goal = R.makeInstanced(SCN.goal(), 140);
  okMakeOkan(R, gl, () => {
    try {
      const p = parseFloat(localStorage.getItem('okatazukePitch'));
      if (p > 0.3 && p < 1.6) OKG.cam.pitch = p;
    } catch (e) {}
    okBuildLevelList();
    okBindUI();
    okSetPitch(OKG.cam.pitch, false);
    OKG.last = performance.now();
    requestAnimationFrame(okFrame);
    window.__okReady = true;
  });
}

// ---- オカンの見た目を作る ------------------------------------------------
// 手組み（buildOkan）と、Tripoから取りこんだモデル（buildOkanFromModel）を切り替える。
// ★取りこんだほうは絵をファイルから読むので、そろってから残りを始める。
//   先に __okReady を立てると、絵の無いオカンを撮ってしまう。
function okMakeOkan(R, gl, done) {
  const useNew = okanUseImported() && window.OKAN_MODEL;
  if (!useNew) {
    OKG.okan = R.makeMesh(buildOkan().build(gl), okanFaceTexture());
    OKG.rig = new OkanRig();
    OKG.rig.scale = 1.42;   // マスに対して小さすぎたので大きくした（実測）
    return done();
  }
  const geo = buildOkanFromModel(window.OKAN_MODEL);
  OKG.rig = new OkanRig(window.OKAN_MODEL.dims);
  OKG.rig.scale = 1.42;
  const img = okanModelTexture();
  const go = () => {
    OKG.okan = R.makeMesh(geo, img);
    OKG.faceOn = true;                       // 表情を貼りかえてよいモデル
    if (window.OkanFace) OkanFace.load(done); else done();
  };
  if (img.complete && img.naturalWidth) go();
  else {
    img.onload = go;
    img.onerror = () => { OKG.okan = R.makeMesh(geo, null); done(); };
  }
}

// ---- 面をよみこむ --------------------------------------------------------
function okStartLevel(i) {
  OKG.level = i;
  const L = OK_LEVELS[i];
  OKG.game = new OKZ.Game(L.rows.join('\n'));
  OKG.anim = null; OKG.queue.length = 0; OKG.fx.length = 0;
  OKG.cheer = 0; OKG.stuckMsgShown = false;
  const g = OKG.game;
  const floor = g.floorCells();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of floor) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  for (const p of g.wallCells()) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  OKG.board = {
    x0, x1, y0, y1,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    w: x1 - x0 + 1, h: y1 - y0 + 1,
    floor, walls: g.wallCells(),
  };
  // ★はじめは かならず「盤ぜんぶ」から。
  //   パズルは 全体が見えないと 手順を考えられない（見えない所は考えようがない）。
  //   寄りたければ ＋ か ピンチで。
  OKG.cam.zoom = 1; OKG.cam.wholeOn = true;
  okFitCamera();
  OKG.cam.tx = 0; OKG.cam.tz = 0;
  OKG.cam.dist = OKG.cam.fitDist;
  const p = g.player;
  OKG.rig.pos = [okWX(p.x), 0, okWZ(p.y)];
  OKG.rig.yaw = 0;
  // とちゅうまでやってあれば、そこまで だまって もどす
  const now = okLoadNow();
  if (now && now.i === i && now.p && !OKG.skipResume) {
    for (const ch of now.p) if (!OKG.game.move(ch)) break;
    const q = OKG.game.player;
    OKG.rig.pos = [okWX(q.x), 0, okWZ(q.y)];
    OKG.rig.yaw = okDirYaw(OKG.game.face || 'D');
  }
  OKG.skipResume = false;
  okShow('play');
  okUpdateHUD();
  const L2 = OK_LEVELS[i];
  okSay(L2.hint || '', 2600);
}

// マスの中心 → ワールド座標
function okWX(x) { return x - OKG.board.cx; }
function okWZ(y) { return y - OKG.board.cy; }

// 盤ぜんぶが画面に入る距離を、実際に投影して二分探索で決める。
// ★上の見出しと 下の十字キーで 画面の上下は かくれる。そのぶんを のけた
//   「ほんとうに見えている帯」に おさめて、そのまんなかへ 盤を ずらす。
function okFitCamera() {
  const b = OKG.board, R = OKG.R, c = OKG.cam;
  const FOV = 42 * Math.PI / 180;
  // 画面のうち 実際に盤を置ける はんい（NDC）。
  //   上＝見出し、下＝十字キー、右＝カメラの道具ボタン のぶんを のけてある
  const NDC_TOP = 0.86, NDC_BOT = -0.52, NDC_XL = -0.96, NDC_XR = 0.76;
  const halfH = (NDC_TOP - NDC_BOT) / 2, midY = (NDC_TOP + NDC_BOT) / 2;
  const halfW2 = (NDC_XR - NDC_XL) / 2, midX = (NDC_XR + NDC_XL) / 2;
  const pts = [];
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [-0.5, 0.5]) {
      for (const h of [0, 1.0]) {
        pts.push([okWX(sx > 0 ? b.x1 : b.x0) + sx, h, okWZ(sy > 0 ? b.y1 : b.y0) + sy]);
      }
    }
  }
  const aspect = R.aspect || (R.canvas.clientWidth / Math.max(1, R.canvas.clientHeight));
  const fits = d => {
    const eye = [0, Math.sin(c.pitch) * d, Math.cos(c.pitch) * d];
    const vp = M4.mul(M4.perspective(FOV, aspect, 0.15, 400),
                      M4.lookAt(eye, [0, 0.25, 0], okCamUp(c.pitch)));
    for (const p of pts) {
      const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
      const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
      const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
      if (w <= 0.01) return false;
      if (Math.abs(x / w) > halfW2 || Math.abs(y / w) > halfH) return false;
    }
    return true;
  };
  let lo = 3, hi = 160;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  c.fitDist = hi;

  // ★大きい面は「盤ぜんぶ」を出すと マスが小さすぎて 指で押せない。
  //   1マスが 画面で これより小さくなるなら、寄って オカンを追いかける。
  const hpx = Math.max(1, R.canvas.clientHeight);
  const cellPx = d => hpx / (2 * d * Math.tan(FOV / 2));
  const MIN_CELL = 34;
  c.nearDist = hpx / (2 * MIN_CELL * Math.tan(FOV / 2));
  c.follow = cellPx(c.fitDist) < MIN_CELL;
  c.dist = c.follow ? Math.min(c.fitDist, c.nearDist) : c.fitDist;

  const shift = -midY * c.dist * Math.tan(FOV / 2);
  c.oy = Math.cos(c.pitch) * shift;
  c.oz = -Math.sin(c.pitch) * shift;
  c.ox = -midX * c.dist * Math.tan(FOV / 2) * aspect;

  // 寄っているときに カメラが動ける はんい（盤の外まで行かないように）
  const halfW = c.dist * Math.tan(FOV / 2) * aspect;
  const halfD = c.dist * Math.tan(FOV / 2) / Math.max(0.2, Math.sin(c.pitch));
  c.limX = Math.max(0, (b.w / 2) - halfW * 0.86);
  c.limZ = Math.max(0, (b.h / 2) - halfD * 0.70);

  const btn = document.getElementById('btn-whole');
  if (btn) {
    btn.style.display = c.follow ? '' : 'none';
    btn.classList.toggle('on', !!c.wholeOn);
  }
}

// 見る角度を 変える（ボタンで4段。2本指の上下でも 変えられる）
function okSetPitch(p, save) {
  const c = OKG.cam;
  c.pitch = clamp(p, OK_PITCH[0] - 0.10, OK_PITCH[OK_PITCH.length - 1]);
  if (OKG.board) okFitCamera();
  if (save !== false) {
    try { localStorage.setItem('okatazukePitch', String(c.pitch)); } catch (e) {}
  }
  const btn = document.getElementById('btn-view');
  if (btn) btn.textContent = c.pitch > 1.35 ? '⬛' : c.pitch > 1.0 ? '◤' : c.pitch > 0.76 ? '◱' : '▱';
}

function okCyclePitch() {
  const cur = OKG.cam.pitch;
  let i = 0;
  for (let k = 0; k < OK_PITCH.length; k++) if (Math.abs(OK_PITCH[k] - cur) < Math.abs(OK_PITCH[i] - cur)) i = k;
  const n = (i + 1) % OK_PITCH.length;
  okSetPitch(OK_PITCH[n]);
  okSay('見る角度：' + OK_PITCH_NAME[n], 1200);
}

// 拡大・縮小（ボタン／ホイール／2本指ピンチ の3つとも ここを通す）
function okZoom(mul) {
  const c = OKG.cam;
  c.wholeOn = false;
  c.zoom = clamp(c.zoom * mul, 0.32, 1.6);
  const btn = document.getElementById('btn-whole');
  if (btn) btn.classList.remove('on');
}

// 「ぜんたい」ボタン：盤ぜんぶが見える位置まで 引く
function okToggleWhole() {
  const c = OKG.cam;
  c.zoom = 1;
  c.wholeOn = !c.wholeOn;
  const btn = document.getElementById('btn-whole');
  if (btn) btn.classList.toggle('on', c.wholeOn);
  okSay(c.wholeOn ? 'ぜんたい' : 'オカンに よる', 900);
}

// ---- 1手 ----------------------------------------------------------------
function okTryMove(dir) {
  if (OKG.screen !== 'play') return;
  // ★入力は捨てない。捨てると「おしたのに動かへん」になる（実測で2手 落ちた）
  if (OKG.anim) { if (OKG.queue.length < 5) OKG.queue.push(dir); return; }
  const g = OKG.game;
  const before = { x: g.player.x, y: g.player.y };
  const res = g.move(dir);
  OKG.rig.yaw = okDirYaw(dir);
  if (!res) {
    // 動けない。音と ちいさい ゆれ で「だめ」を伝える（罰はない）
    if (window.OKSnd) OKSnd.bump();
    OKG.cam.shake = 0.05;
    return;
  }
  const dur = res.pushed ? 0.20 : 0.155;
  OKG.anim = {
    t: 0, dur, kind: res.pushed ? 'push' : 'walk', dir,
    from: before, to: { x: g.player.x, y: g.player.y },
    box: res.pushed ? { i: res.boxIndex, from: res.from, to: res.to } : null,
    onGoal: !!res.onGoal, wasOnGoal: !!res.wasOnGoal, cleared: res.cleared,
  };
  if (window.OKSnd) res.pushed ? OKSnd.push() : OKSnd.step();
  okUpdateHUD();
  okSaveNow();
}

function okUndo() {
  if (OKG.screen !== 'play' || OKG.anim) return;
  const g = OKG.game;
  const before = { x: g.player.x, y: g.player.y };
  const u = g.undo();
  if (!u) return;
  OKG.anim = {
    t: 0, dur: 0.14, kind: 'undo', dir: u.dir,
    from: before, to: { x: g.player.x, y: g.player.y },
    box: u.box ? { i: u.box.index, from: u.box.from, to: u.box.to } : null,
  };
  OKG.rig.yaw = okDirYaw(u.dir) + Math.PI;
  OKG.stuckMsgShown = false;
  okSay('', 0);
  if (window.OKSnd) OKSnd.undo();
  okUpdateHUD();
  okSaveNow();
}

function okReset() {
  if (OKG.screen !== 'play') return;
  OKG.game.reset();
  OKG.anim = null; OKG.queue.length = 0;
  OKG.stuckMsgShown = false;
  okSay('', 0);
  const p = OKG.game.player;
  OKG.rig.pos = [okWX(p.x), 0, okWZ(p.y)];
  if (window.OKSnd) OKSnd.reset();
  okUpdateHUD();
  okClearNow();
}

function okDirYaw(d) {
  return d === 'U' ? Math.PI : d === 'D' ? 0 : d === 'L' ? -Math.PI / 2 : Math.PI / 2;
}

// タップした場所まで 歩く（にもつは動かさない道すじ）
function okWalkTo(tx, ty) {
  const g = OKG.game;
  if (g.isWall(tx, ty) || g.boxAt(tx, ty) >= 0) return;
  const start = g.player;
  if (start.x === tx && start.y === ty) return;
  const prev = new Map();
  const key = (x, y) => y * g.w + x;
  const q = [[start.x, start.y]];
  prev.set(key(start.x, start.y), null);
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const k in OKZ.DIRS) {
      const d = OKZ.DIRS[k];
      const nx = x + d.dx, ny = y + d.dy;
      if (g.isWall(nx, ny) || g.boxAt(nx, ny) >= 0) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y, k]);
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return;
  const path = [];
  let cur = [tx, ty];
  while (true) {
    const p = prev.get(key(cur[0], cur[1]));
    if (!p) break;
    path.push(p[2]);
    cur = [p[0], p[1]];
  }
  path.reverse();
  if (path.length > 60) return;              // あまり遠いところは やめておく（大きい面もあるので長め）
  OKG.queue.length = 0;
  for (const d of path) OKG.queue.push(d);
  if (!OKG.anim) { const d = OKG.queue.shift(); okTryMove(d); }
}

// ---- クリア --------------------------------------------------------------
function okClear() {
  const g = OKG.game, L = OK_LEVELS[OKG.level];
  OKG.screen = 'clear';
  OKG.cheer = 1;
  OKG.rig.cheer = 1;
  okClearNow();
  const best = okRecord(OKG.level, g.moves, g.pushes);
  const star = g.pushes <= L.par ? 3 : g.pushes <= Math.ceil(L.par * 1.4) ? 2 : 1;
  const d = okLoad(); d['S' + OKG.level] = Math.max(star, d['S' + OKG.level] || 0); okSave(d);
  for (let i = 0; i < 90; i++) okSpark(okWX(g.boxes[i % g.boxes.length].x),
                                      0.9, okWZ(g.boxes[i % g.boxes.length].y), 1.4);
  if (window.OKSnd) OKSnd.clear();
  if (window.OKBgm) OKBgm.flourish();
  const el = document.getElementById('clear-panel');
  document.getElementById('clear-title').textContent = ['', 'かたづいた！', 'ようできました！', 'かんぺき！'][star];
  document.getElementById('clear-stars').textContent = '★★★'.slice(0, star) + '☆☆☆'.slice(0, 3 - star);
  document.getElementById('clear-detail').innerHTML =
    `おした数 <b>${g.pushes}</b>（さいたん ${L.par}）　あるいた数 <b>${g.moves}</b>` +
    (best ? `<br>じぶんの さいこう記録：おした数 ${best.p}／あるいた数 ${best.m}` : '');
  document.getElementById('btn-next').style.display =
    (OKG.level + 1 < OK_LEVELS.length) ? '' : 'none';
  el.classList.add('show');
  okBuildLevelList();
  if (OKG.embed) {
    const sv = okLoad();
    const cleared = OK_LEVELS.filter((L, i) => sv['S' + i]).length;
    parent.postMessage({ type: 'okz-progress', cleared }, '*');
  }
}

// ---- 見た目の演出 --------------------------------------------------------
function okSpark(x, y, z, pow) {
  const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
  OKG.fx.push({
    x: x + Math.cos(a) * r, y: y + Math.random() * 0.3, z: z + Math.sin(a) * r,
    vx: Math.cos(a) * rnd(0.4, 1.4) * pow, vy: rnd(1.2, 3.0) * pow, vz: Math.sin(a) * rnd(0.4, 1.4) * pow,
    life: rnd(0.5, 1.1), age: 0, size: rnd(5, 12),
    col: [1, rnd(0.6, 0.9), rnd(0.7, 0.95)],
  });
}
function okDust(x, y, z) {
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    OKG.fx.push({
      x, y: y + 0.04, z,
      vx: Math.cos(a) * rnd(0.3, 0.9), vy: rnd(0.2, 0.8), vz: Math.sin(a) * rnd(0.3, 0.9),
      life: rnd(0.25, 0.5), age: 0, size: rnd(6, 14), col: [0.86, 0.78, 0.66],
    });
  }
}

// いまの表情を 場面から決める
function okFaceState() {
  if (OKG.screen === 'clear') return 'happy';
  if (OKG.screen === 'title') return OKG.titleFace || 'smile';
  if (OKG.stuckMsgShown) return 'sad';
  if (OKG.anim && OKG.anim.kind === 'push') return 'effort';
  if (OKG.rig && OKG.rig.walk > 0.45) return 'smile';
  return 'normal';
}

// ---- 毎フレーム ----------------------------------------------------------
function okFrame(now) {
  const raw = Math.min(0.05, (now - OKG.last) / 1000);
  OKG.last = now;
  let dt = raw;
  if (OKG.hitstop > 0) { OKG.hitstop -= raw; dt = raw * 0.15; }
  OKG.time += dt;
  const R = OKG.R;
  R.resize();
  R.time = OKG.time;
  if (OKG.board && R.aspect !== OKG.lastAspect) { OKG.lastAspect = R.aspect; okFitCamera(); }

  if (OKG.screen === 'play' || OKG.screen === 'clear') {
    okStep(dt);
    okDraw();
  } else {
    okDrawTitle(dt);
  }
  if (OKG.faceOn && window.OkanFace) OkanFace.tick(R, OKG.okan, raw, okFaceState());
  requestAnimationFrame(okFrame);
}

function okStep(dt) {
  const a = OKG.anim, g = OKG.game;
  const rig = OKG.rig;

  if (a) {
    a.t += dt;
    if (a.t >= a.dur) {
      // 動きおわり
      if (a.kind === 'push') {
        okDust(okWX(a.box.to.x), 0.05, okWZ(a.box.to.y));
        if (a.onGoal && !a.wasOnGoal) {
          for (let i = 0; i < 16; i++) okSpark(okWX(a.box.to.x), 0.8, okWZ(a.box.to.y), 0.7);
          if (window.OKSnd) OKSnd.fit();
          OKG.hitstop = 0.035;
        }
      }
      const cleared = a.cleared;
      OKG.anim = null;
      if (cleared) { okClear(); return; }
      // 詰みの見はり（機械で はっきり言えるものだけ）
      if (OKG.screen === 'play') okCheckStuck();
      if (OKG.queue.length) { const d = OKG.queue.shift(); okTryMove(d); }
    }
  } else if (OKG.queue.length) {
    const d = OKG.queue.shift(); okTryMove(d);
  }

  // オカンの位置と ポーズ
  let px = g.player.x, py = g.player.y, walk = 0, push = 0;
  if (OKG.anim) {
    const k = Math.min(1, OKG.anim.t / OKG.anim.dur);
    const e = easeInOut(k);
    px = OKG.anim.from.x + (OKG.anim.to.x - OKG.anim.from.x) * e;
    py = OKG.anim.from.y + (OKG.anim.to.y - OKG.anim.from.y) * e;
    walk = 1;
    push = OKG.anim.kind === 'push' ? 1 : 0;
  }
  rig.pos = [okWX(px), 0, okWZ(py)];
  rig.walk += ((OKG.screen === 'clear' ? 0 : walk) - rig.walk) * Math.min(1, dt * 16);
  rig.push += (push - rig.push) * Math.min(1, dt * 14);
  rig.cheer += ((OKG.screen === 'clear' ? 1 : 0) - rig.cheer) * Math.min(1, dt * 6);
  rig.sad += ((OKG.stuckMsgShown && OKG.screen === 'play' ? 1 : 0) - rig.sad) * Math.min(1, dt * 5);
  if (OKG.anim) {
    const target = okDirYaw(OKG.anim.dir) + (OKG.anim.kind === 'undo' ? Math.PI : 0);
    let d = target - rig.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    rig.yaw += d * Math.min(1, dt * 18);
  }
  rig.update(dt);

  // カメラ
  const c = OKG.cam;
  const base = (c.wholeOn || !c.follow) ? c.fitDist : Math.min(c.fitDist, c.nearDist);
  const wantD = clamp(base * c.zoom, 3.5, c.fitDist * 1.5);
  c.dist += (wantD - c.dist) * Math.min(1, dt * 5);
  // 盤ぜんぶが入りきらないときだけ オカンを追いかける
  const chase = c.dist < c.fitDist * 0.96;
  const R2 = OKG.R;
  const aspect2 = R2.aspect || 0.5;
  const halfW = c.dist * Math.tan(21 * Math.PI / 180) * aspect2;
  const halfD = c.dist * Math.tan(21 * Math.PI / 180) / Math.max(0.25, Math.sin(c.pitch));
  const limX = Math.max(0, (OKG.board.w / 2) - halfW * 0.86);
  const limZ = Math.max(0, (OKG.board.h / 2) - halfD * 0.70);
  let wx = rig.pos[0] * (chase ? 1.0 : 0.18);
  let wz = rig.pos[2] * (chase ? 1.0 : 0.18);
  if (chase) { wx = clamp(wx, -limX, limX); wz = clamp(wz, -limZ, limZ); }
  c.tx += (wx - c.tx) * Math.min(1, dt * 4.5);
  c.tz += (wz - c.tz) * Math.min(1, dt * 4.5);
  c.shake = Math.max(0, c.shake - dt * 0.35);
  OKG.cheer = Math.max(0, OKG.cheer - dt * (OKG.screen === 'clear' ? 0.25 : 1.5));

  // つぶ
  for (let i = OKG.fx.length - 1; i >= 0; i--) {
    const p = OKG.fx[i];
    p.age += dt;
    if (p.age >= p.life) { OKG.fx.splice(i, 1); continue; }
    p.vy -= 6.5 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
  }
}

function okCheckStuck() {
  const g = OKG.game;
  if (g.isClear()) return;
  const st = g.deadlockedBoxes();
  if (st.length && !OKG.stuckMsgShown) {
    OKG.stuckMsgShown = true;
    okSay('あー、それ もう動かへんわ。「もどす」で 戻してみ', 5200);
    document.getElementById('btn-undo').classList.add('blink');
    if (window.OKSnd) OKSnd.stuck();
  } else if (!st.length && OKG.stuckMsgShown) {
    OKG.stuckMsgShown = false;
    document.getElementById('btn-undo').classList.remove('blink');
  }
}

// ---- 描く ----------------------------------------------------------------
function okDraw() {
  const R = OKG.R, g = OKG.game, b = OKG.board, c = OKG.cam;
  const sh = c.shake > 0 ? c.shake : 0;
  const tgt = [c.tx + (c.ox || 0), 0.25 + c.oy, c.tz + c.oz];
  const eye = [
    tgt[0] + (Math.random() - 0.5) * sh,
    tgt[1] + Math.sin(c.pitch) * c.dist + (Math.random() - 0.5) * sh,
    tgt[2] + Math.cos(c.pitch) * c.dist,
  ];
  R.camera(eye, tgt, 42, okCamUp(c.pitch));
  R.bg([0.36, 0.30, 0.46], [0.86, 0.72, 0.72], OKG.cheer);

  // 盤の外の 床（ひろい倉庫の中に いるように見せる）
  // ★大きさは カメラの遠さに合わせる。決め打ちだと 引いたときに
  //   板のふちが見えて、空に四角い切れ目が出る（実測で出た）
  const gsz = Math.max(80, c.dist * 8);
  R.drawInstanced(OKG.mesh.tile,
    [{ x: c.tx, y: -0.62, z: c.tz, sx: gsz, sy: 5, sz: gsz, col: [0.44, 0.31, 0.34] }],
    { outline: false, rim: 0.02 });

  // ゆか
  const tiles = [];
  for (const p of b.floor) {
    const on = g.isGoal(p.x, p.y);
    const chk = ((p.x + p.y) & 1) ? 0.965 : 1.0;
    tiles.push({
      x: okWX(p.x), y: -0.05, z: okWZ(p.y),
      col: on ? [1.00 * chk, 0.93 * chk, 0.95 * chk] : [0.98 * chk, 0.90 * chk, 0.80 * chk],
    });
  }
  R.drawInstanced(OKG.mesh.tile, tiles, { outlineWidth: 0.0022, outlineCol: [0.42, 0.30, 0.24] });

  // おきば
  const goals = [];
  for (const p of b.floor) {
    if (!g.isGoal(p.x, p.y)) continue;
    const filled = g.boxAt(p.x, p.y) >= 0;
    goals.push({
      x: okWX(p.x), y: 0.048, z: okWZ(p.y),
      col: filled ? [1.05, 0.98, 1.02] : [1, 1, 1],
      glow: filled ? 0 : 0.12,
    });
  }
  R.drawInstanced(OKG.mesh.goal, goals, { outlineWidth: 0.0018, outlineCol: [0.60, 0.24, 0.36] });

  // かべ。★手前のいちばん下の列だけ 低くする。
  //   そうしないと 手前のかべが 1列目のマスを かくしてしまう（実測）
  const walls = b.walls.map(p => ({
    x: okWX(p.x), y: 0, z: okWZ(p.y),
    sy: p.y >= b.y1 ? 0.38 : 1,
    col: p.y >= b.y1 ? [0.94, 0.92, 0.94] : [1, 1, 1],
  }));
  R.drawInstanced(OKG.mesh.wall, walls, { outlineWidth: 0.0026, outlineCol: [0.26, 0.15, 0.09] });

  // 影
  const sh2 = [];
  for (const bx of g.boxes) sh2.push({ x: okWX(bx.x), y: 0.06, z: okWZ(bx.y), r: 0.86 });
  sh2.push({ x: OKG.rig.pos[0], y: 0.06, z: OKG.rig.pos[2], r: 0.62 });
  R.drawShadows(sh2, 0.26);

  // にもつ
  const stuck = OKG.stuckMsgShown ? g.deadlockedBoxes() : [];
  const boxes = [];
  for (let i = 0; i < g.boxes.length; i++) {
    const bx = g.boxes[i];
    let x = okWX(bx.x), z = okWZ(bx.y), y = 0.02, sy = 1, sx = 1;
    const a = OKG.anim;
    if (a && a.box && a.box.i === i) {
      const k = Math.min(1, a.t / a.dur), e = easeInOut(k);
      x = okWX(a.box.from.x + (a.box.to.x - a.box.from.x) * e);
      z = okWZ(a.box.from.y + (a.box.to.y - a.box.from.y) * e);
      // おされている あいだ すこし つぶれる（手ごたえ）
      const sq = Math.sin(k * Math.PI) * (a.kind === 'push' ? 0.06 : 0.03);
      sy = 1 - sq; sx = 1 + sq * 0.5;
    }
    const on = g.isGoal(bx.x, bx.y);
    const isStuck = stuck.includes(i);
    boxes.push({
      x, y, z, sx, sy, sz: sx,
      col: isStuck ? [1.00, 0.50, 0.50] : on ? [1.00, 0.72, 0.84] : [1, 1, 1],
      glow: on ? 0.10 : 0,
    });
  }
  R.drawInstanced(OKG.mesh.box, boxes, { outlineWidth: 0.0028, outlineCol: [0.40, 0.24, 0.14] });

  // オカン
  R.drawMesh(OKG.okan, OKG.rig.bones, { outlineWidth: 0.0034 });
  R.drawParticles(OKG.fx.map(p => ({
    x: p.x, y: p.y, z: p.z, size: p.size,
    col: p.col, alpha: Math.max(0, 1 - p.age / p.life),
  })));
}

// ============================================================
// タイトル画面の オカン（演目をひと通り くり返す）
//   ★このモデルは 脇が閉じていて 上腕を大きく上げると 布が裂ける。
//     手をふるのは ひじから先だけ（OkanRig.wave）。
// ============================================================
const OK_TITLE_ACTS = [
  { n: 'walkin',  d: 2.4 },   // 左から歩いてくる
  { n: 'turn',    d: 0.6 },   // こちらを向く
  { n: 'wave',    d: 2.2 },   // 手をふる
  { n: 'chicchi', d: 1.8 },   // 頭のチッチを 見あげる
  { n: 'push',    d: 3.6 },   // にもつを おす
  { n: 'cheer',   d: 1.7 },   // よろこぶ
  { n: 'bow',     d: 1.5 },   // おじぎ
  { n: 'walkout', d: 2.2 },   // 歩いて はけていく
];

function okTitleReset() {
  OKG.tAct = 0; OKG.tT = 0; OKG.tTitle = 0;
  OKG.titleFace = 'smile';
  OKG.tBox = null;
}

function okDrawTitle(dt) {
  const R = OKG.R, rig = OKG.rig;
  if (OKG.tAct === undefined) okTitleReset();
  OKG.tTitle += dt;
  OKG.tT += dt;
  let act = OK_TITLE_ACTS[OKG.tAct];
  if (OKG.tT > act.d) {
    OKG.tT = 0;
    OKG.tAct = (OKG.tAct + 1) % OK_TITLE_ACTS.length;
    act = OK_TITLE_ACTS[OKG.tAct];
    if (act.n === 'push') OKG.tBox = { x: 0.10, z: 0 };
    if (act.n === 'cheer') OKG.tBox = null;
  }
  const k = Math.min(1, OKG.tT / act.d);        // 0→1 その演目の進みぐあい
  const e = easeInOut(k);

  // 目標のポーズ（バネで追わせるので パッと切りかわらない）
  let walk = 0, push = 0, cheer = 0, wave = 0, bow = 0;
  let px = 0, pz = 0, yaw = 0, face = 'smile';

  switch (act.n) {
    case 'walkin':
      walk = 1; px = -0.92 + e * 0.82; yaw = 1.15; face = 'smile';
      break;
    case 'turn':
      yaw = 1.15 * (1 - e); face = 'smile';
      break;
    case 'wave':
      wave = Math.min(1, k * 3); face = 'happy';
      break;
    case 'chicchi':
      face = 'normal';
      // 見あげる（首は rig が持たないので 体をすこし そらせる）
      bow = -0.35 * Math.sin(k * Math.PI);
      yaw = Math.sin(OKG.tTitle * 1.6) * 0.25;
      break;
    case 'push':
      walk = 1; push = 1; yaw = 1.05; face = 'effort';
      px = -0.72 + e * 0.82;
      if (OKG.tBox) OKG.tBox.x = px + 0.66;
      break;
    case 'cheer':
      cheer = 1; face = 'happy'; px = 0.08;
      break;
    case 'bow':
      bow = Math.sin(k * Math.PI); face = 'smile'; px = 0.08;
      break;
    case 'walkout':
      walk = 1; yaw = 1.15; px = 0.10 + e * 1.05; face = 'smile';
      break;
  }
  OKG.titleFace = face;

  const sp = (a, b, r) => a + (b - a) * Math.min(1, dt * r);
  rig.walk = sp(rig.walk, walk, 9);
  rig.push = sp(rig.push, push, 8);
  rig.cheer = sp(rig.cheer, cheer, 7);
  rig.wave = sp(rig.wave, wave, 10);
  rig.bow = sp(rig.bow, bow, 8);
  rig.sad = 0;
  rig.pos = [sp(rig.pos[0], px, 6), 0, sp(rig.pos[2], pz, 6)];
  let dy = yaw - rig.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  rig.yaw += dy * Math.min(1, dt * 7);
  rig.update(dt);

  // カメラは ゆっくり ゆれるだけ
  const t = OKG.tTitle;
  R.resize();
  // ★見えるはばは 半分で 0.82 しかない。ここを外れると オカンが画面の外に立つ（実測）。
  //   演目の px は ぜんぶ ±0.98 におさめてある。
  const cx = Math.sin(t * 0.16) * 0.10;
  R.camera([cx, 2.20 + Math.sin(t * 0.21) * 0.05, 5.4], [cx * 0.3, 1.30, 0], 40);
  R.bg([0.36, 0.30, 0.46], [0.86, 0.72, 0.72], rig.cheer * 0.5);

  // 足もとの床（うっすら）
  R.drawInstanced(OKG.mesh.tile,
    [{ x: 0, y: -0.10, z: 0, sx: 26, sy: 1.6, sz: 26, col: [0.52, 0.38, 0.40] }],
    { outline: false, rim: 0.02 });

  const sh = [{ x: rig.pos[0], y: 0.02, z: rig.pos[2], r: 0.66 }];
  if (OKG.tBox) sh.push({ x: OKG.tBox.x, y: 0.02, z: OKG.tBox.z, r: 0.8 });
  R.drawShadows(sh, 0.24);

  if (OKG.tBox) {
    R.drawInstanced(OKG.mesh.box, [{
      x: OKG.tBox.x, y: 0.02, z: OKG.tBox.z, sx: 0.86, sy: 0.86, sz: 0.86,
      col: [1, 1, 1],
    }], { outlineWidth: 0.0028, outlineCol: [0.40, 0.24, 0.14] });
  }
  R.drawMesh(OKG.okan, rig.bones, { outlineWidth: 0.0034 });
}

// ---- 画面のきりかえ ------------------------------------------------------
function okShow(name) {
  OKG.screen = name;
  // 音楽：タイトルと面えらびは 旋律あり、あそび中は 静かなほう
  if (window.OKBgm) OKBgm.play(name === 'play' ? 'game' : 'title');
  if (name === 'title') {
    okTitleReset();
    const d = okLoad();
    const done = OK_LEVELS.filter((L, i) => d['S' + i]).length;
    const bc = document.getElementById('btn-continue');
    if (bc) {
      bc.style.display = done ? '' : 'none';
      const now = okLoadNow();
      bc.style.display = (done || now) ? '' : 'none';
      bc.textContent = now ? `とちゅうから（第${now.i + 1}面）` : `つづきから（${done}／${OK_LEVELS.length}面）`;
    }
  }
  for (const id of ['scr-title', 'scr-select', 'scr-play']) {
    document.getElementById(id).classList.toggle('show', id === 'scr-' + (name === 'clear' ? 'play' : name));
  }
  if (name !== 'clear') document.getElementById('clear-panel').classList.remove('show');
}

function okUpdateHUD() {
  const g = OKG.game, L = OK_LEVELS[OKG.level];
  if (!g) return;
  // ★面に名前は付けない（本人の指示）。番号と むずかしさの段だけ出す。
  document.getElementById('hud-name').innerHTML =
    `第 <b>${OKG.level + 1}</b> 面　<span class="tier-tag t${L.t}">${OK_TIER_NAME[L.t]}</span>`;
  const left = g.boxes.filter(b => !g.isGoal(b.x, b.y)).length;
  document.getElementById('hud-count').innerHTML =
    `のこり <b>${left}</b> こ　おした <b>${g.pushes}</b>　あるいた <b>${g.moves}</b>`;
  document.getElementById('btn-undo').classList.toggle('off', g.history.length === 0);
}

let okSayTimer = null;
function okSay(text, ms) {
  const el = document.getElementById('say');
  if (okSayTimer) clearTimeout(okSayTimer);
  if (!text) { el.classList.remove('show'); return; }
  el.textContent = text;
  el.classList.add('show');
  if (ms) okSayTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---- 面のいちらん --------------------------------------------------------
function okBuildLevelList() {
  const wrap = document.getElementById('level-list');
  if (!wrap) return;
  const d = okLoad();
  wrap.innerHTML = '';
  let lastTier = -1;
  OK_LEVELS.forEach((L, i) => {
    if (L.t !== lastTier) {
      lastTier = L.t;
      const h = document.createElement('div');
      h.className = 'tier-head';
      const n = OK_LEVELS.filter(x => x.t === L.t).length;
      h.innerHTML = `${OK_TIER_NAME[L.t]} <span class="tier-sub">${n}面</span>`;
      wrap.appendChild(h);
      const g = document.createElement('div');
      g.className = 'tier-grid';
      g.dataset.tier = L.t;
      wrap.appendChild(g);
    }
    const grid = wrap.querySelector(`.tier-grid[data-tier="${L.t}"]`);
    const b = document.createElement('button');
    const star = d['S' + i] || 0;
    b.className = 'lv-btn t' + L.t + (star ? ' done' : '');
    b.innerHTML = `<span class="lv-no">${i + 1}</span>` +
                  `<span class="lv-nm">にもつ ${L.b}こ</span>` +
                  `<span class="lv-st">${star ? '★'.repeat(star) : '・・・'}</span>`;
    b.onclick = () => okStartLevel(i);
    grid.appendChild(b);
  });
  const done = OK_LEVELS.filter((L, i) => d['S' + i]).length;
  const el = document.getElementById('progress');
  if (el) el.textContent = `${done} / ${OK_LEVELS.length} 面 クリア`;
}

// ---- 入力 ----------------------------------------------------------------
function okBindUI() {
  const cv = document.getElementById('cv');
  let down = null;
  const holdState = { dir: null, t0: 0, timer: null };

  // 2本指：上下で 見る角度、広げる/せばめるで 遠近
  const pts = new Map();
  let two = null;
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b2] = [...pts.values()];
      two = {
        pitch: OKG.cam.pitch, zoom: OKG.cam.zoom,
        y: (a.y + b2.y) / 2, d: Math.hypot(a.x - b2.x, a.y - b2.y),
      };
      down = null;
      return;
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  const endPointer = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) two = null;
  };
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);
  cv.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (two && pts.size === 2) {
      const [a, b2] = [...pts.values()];
      const y = (a.y + b2.y) / 2, d = Math.hypot(a.x - b2.x, a.y - b2.y);
      okSetPitch(two.pitch + (two.y - y) * 0.006, false);
      if (two.d > 20) {
        OKG.cam.wholeOn = false;
        OKG.cam.zoom = clamp(two.zoom * (two.d / Math.max(20, d)), 0.32, 1.6);
      }
      return;
    }
    if (!down || OKG.screen !== 'play') return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    const L = Math.hypot(dx, dy);
    if (L < 30) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
    okTryMove(dir);
    down = { x: e.clientX, y: e.clientY, t: performance.now() };   // 続けてなぞれる
  });
  cv.addEventListener('pointerup', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    const moved = Math.hypot(dx, dy);
    const quick = performance.now() - down.t < 400;
    if (OKG.screen === 'play' && moved < 14 && quick) okTapCell(e.clientX, e.clientY);
    down = null;
  });
  cv.addEventListener('pointercancel', () => { down = null; });

  addEventListener('keydown', e => {
    if (OKG.screen === 'clear') {
      if (e.key === 'Enter' || e.key === ' ') { okNext(); e.preventDefault(); }
      return;
    }
    const m = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R' };
    if (m[e.key]) { okTryMove(m[e.key]); e.preventDefault(); }
    else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { okUndo(); e.preventDefault(); }
    else if (e.key === 'r' || e.key === 'R') okReset();
    else if (e.key === 'Escape') okShow('select');
  });

  // 十字ボタン（おしっぱなしで つづけて動く）
  for (const dir of ['U', 'D', 'L', 'R']) {
    const el = document.getElementById('pad-' + dir);
    if (!el) continue;
    const start = e => {
      e.preventDefault();
      okTryMove(dir);
      holdState.dir = dir;
      clearTimeout(holdState.timer);
      holdState.timer = setTimeout(function rep() {
        if (holdState.dir !== dir) return;
        okTryMove(dir);
        holdState.timer = setTimeout(rep, 115);
      }, 280);
    };
    const stop = () => { holdState.dir = null; clearTimeout(holdState.timer); };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
  }

  cv.addEventListener('wheel', e => {
    if (OKG.screen !== 'play') return;
    e.preventDefault();
    okZoom(e.deltaY > 0 ? 1.12 : 0.89);
  }, { passive: false });
  const bzi = document.getElementById('btn-zoomin');
  if (bzi) bzi.onclick = () => okZoom(0.80);
  const bzo = document.getElementById('btn-zoomout');
  if (bzo) bzo.onclick = () => okZoom(1.25);
  const bv = document.getElementById('btn-view');
  if (bv) bv.onclick = okCyclePitch;
  const bw = document.getElementById('btn-whole');
  if (bw) bw.onclick = okToggleWhole;
  const bc = document.getElementById('btn-continue');
  if (bc) bc.onclick = () => {
    if (OKG.embed && !OKG.paid) { OKG.afterPay = 'continue'; parent.postMessage({ type: 'okz-start-request' }, '*'); return; }
    okContinue();
  };
  document.getElementById('btn-undo').onclick = okUndo;
  document.getElementById('btn-reset').onclick = okReset;
  document.getElementById('btn-list').onclick = () => okShow('select');
  document.getElementById('btn-next').onclick = okNext;
  document.getElementById('btn-retry').onclick = () => { OKG.skipResume = true; okStartLevel(OKG.level); };
  document.getElementById('btn-tolist').onclick = () => okShow('select');
  document.getElementById('btn-start').onclick = () => {
    // オトン学園の中では、入場のときに 遊び券を1まい払う。
    // ★中に入ってからは 何面でも やりなおしても ただ（パズルは試行錯誤が遊びそのもの）
    if (OKG.embed && !OKG.paid) { parent.postMessage({ type: 'okz-start-request' }, '*'); return; }
    okShow('select');
  };
  document.getElementById('btn-back-title').onclick = () => okShow('title');
  const bs = document.getElementById('btn-sound');
  if (bs) bs.onclick = () => {
    const on = window.OKSnd ? OKSnd.toggle() : false;
    bs.textContent = on ? '🔊' : '🔈';
  };
  const bx = document.getElementById('btn-exit');
  if (bx) bx.onclick = () => {
    if (window.OKBgm) OKBgm.play(null);
    if (OKG.embed) parent.postMessage({ type: 'okz-exit' }, '*');
    else okShow('title');
  };
}

// まだ ★の付いていない いちばん前の面へ
function okContinue() {
  const now = okLoadNow();
  if (now && now.p && now.i >= 0 && now.i < OK_LEVELS.length) { okStartLevel(now.i); return; }
  const d = okLoad();
  let i = 0;
  while (i < OK_LEVELS.length - 1 && d['S' + i]) i++;
  okStartLevel(i);
}

function okNext() {
  const n = OKG.level + 1;
  if (n < OK_LEVELS.length) okStartLevel(n);
  else okShow('select');
}

// 画面のタップ位置 → マス（ゆかの板と 光線の あたり判定）
function okTapCell(sx, sy) {
  const R = OKG.R, cv = R.canvas, c = OKG.cam;
  const rect = cv.getBoundingClientRect();
  const ndcX = ((sx - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((sy - rect.top) / rect.height) * 2;
  const inv = M4.invert(M4.mul(R.proj, R.view), new Float32Array(16));
  if (!inv) return;
  const un = (x, y, z) => {
    const w = inv[3] * x + inv[7] * y + inv[11] * z + inv[15];
    return [
      (inv[0] * x + inv[4] * y + inv[8] * z + inv[12]) / w,
      (inv[1] * x + inv[5] * y + inv[9] * z + inv[13]) / w,
      (inv[2] * x + inv[6] * y + inv[10] * z + inv[14]) / w,
    ];
  };
  const p0 = un(ndcX, ndcY, -1), p1 = un(ndcX, ndcY, 1);
  const dy = p1[1] - p0[1];
  if (Math.abs(dy) < 1e-6) return;
  const t = (0.05 - p0[1]) / dy;      // ゆかの高さ
  if (t < 0) return;
  const wx = p0[0] + (p1[0] - p0[0]) * t;
  const wz = p0[2] + (p1[2] - p0[2]) * t;
  const cx = Math.round(wx + OKG.board.cx);
  const cy = Math.round(wz + OKG.board.cy);
  okWalkTo(cx, cy);
}

// ---- オトン学園に組みこんだときの やりとり（iframe）----------------------
addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'okz-name') {
    OKG.nickname = d.name || '';
    OKG.cost = d.cost || 1;
  } else if (d.type === 'okz-start-ok') {
    OKG.paid = true;
    okTitleMsg('');
    if (OKG.afterPay === 'continue') { OKG.afterPay = null; okContinue(); }
    else okShow('select');
  } else if (d.type === 'okz-start-deny') {
    okTitleMsg(d.msg || '遊び券が たりひんわ');
  }
});

function okTitleMsg(t) {
  const el = document.getElementById('title-msg');
  if (!el) return;
  el.textContent = t;
  el.classList.toggle('show', !!t);
}
if (/[?&]embed=1/.test(location.search)) {
  OKG.embed = true;
  addEventListener('load', () => parent.postMessage({ type: 'okz-ready' }, '*'));
}

addEventListener('DOMContentLoaded', okBoot);
