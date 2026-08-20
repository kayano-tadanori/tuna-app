// ============================================================
// game.js — 入力・ループ・演出・core と renderer のつなぎ
// ============================================================
'use strict';

(function () {
const cv  = document.getElementById('c');
const hud = document.getElementById('hud');
const errBox = document.getElementById('err');
const show = m => { if (errBox) errBox.textContent = String(m && m.stack || m); console.error(m); };
window.addEventListener('error', e => show(e.error || e.message));

let R, core, rig, chicchiSkin, faceTex, props, propStar, propOnigiri, foes, propVoyager;
let scn, helmet, helmetRing;
try {
  R = new Renderer(cv);
  chicchiSkin = R.makeSkinned(buildChicchiMesh());
  faceTex = R.makeTexture(makeChicchiFaceTexture(512));
  // 足場は種類ごとに別のモデル。色だけ変えると、なぜ跳ねるのか・なぜ滑るのかが
  // 見た目から伝わらず、とたんに安っぽくなる。
  props = {
    cloud: {
      normal: R.makeProp(buildCloudMesh()),
      spring: R.makeProp(buildSpringMesh()),
      ice:    R.makeProp(buildIceMesh()),
      break:  R.makeProp(buildBreakMesh()),
    },
    // ★宇宙ゾーンは「色ちがいの雲」にしない。形そのものを小惑星にする。
    rock: {
      normal: R.makeProp(buildRockMesh()),
      spring: R.makeProp(buildRockSpringMesh()),
      ice:    R.makeProp(buildRockIceMesh()),
      break:  R.makeProp(buildRockBreakMesh()),
    },
  };
  propStar    = R.makeProp(buildStarMesh());
  propOnigiri = R.makeProp(buildOnigiriMesh());
  // じゃま役は高度で姿が変わる（中身は同じひとつのオブジェクト）
  foes = {
    hawk:    R.makeProp(buildHawkMesh()),
    balloon: R.makeProp(buildBalloonMesh()),
    alien:   R.makeProp(buildAlienMesh()),
  };
  propVoyager = R.makeProp(buildVoyagerMesh());
  // 背景の風景。地上→大気圏→宇宙で見えるものが移りかわる。
  scn = {
    building: R.makeProp(buildBuildingMesh()),
    skytree:  R.makeProp(buildSkytreeMesh()),
    fuji:     R.makeProp(buildFujiMesh()),
    sun:      R.makeProp(buildSunMesh()),
    earth:    R.makeProp(buildEarthMesh()),
    moon:     R.makeProp(buildMoonMesh()),
    mars:     R.makeProp(buildMarsMesh()),
    jupiter:  R.makeProp(buildJupiterMesh()),
    saturn:   R.makeProp(buildSaturnMesh()),
    satRing:  R.makeProp(buildSaturnRingMesh()),
    uranus:   R.makeProp(buildUranusMesh()),
    uraRing:  R.makeProp(buildUranusRingMesh()),
    neptune:  R.makeProp(buildNeptuneMesh()),
    pluto:    R.makeProp(buildPlutoMesh()),
    plane:    R.makeProp(buildPlaneMesh()),
    ground:   R.makeProp(buildGroundMesh()),
  };
  foes.satellite = R.makeProp(buildSatelliteMesh());
  helmet     = R.makeProp(buildHelmetMesh());
  helmetRing = R.makeProp(buildHelmetRingMesh());
  rig  = new ChicchiRig();
  // 天気は日付から決める（兄弟が同じ日に同じ条件で競える）。
  // 地形の乱数だけは毎回変える。
  core = new ChicchiCore(Math.floor(Math.random() * 1e9),
                         Math.floor(Date.now() / 86400000));
} catch (e) { show(e); return; }

// ---------------- 足場の見た目 ----------------
const PLAT_COL = {
  normal: hex2rgb('#f4fbff'),   // ふつうの雲
  spring: hex2rgb('#63d68a'),   // バネ雲
  ice:    hex2rgb('#a9e4ff'),   // 氷雲
  break:  hex2rgb('#c8c6cf'),   // こわれ雲
};
const ROCK_COL = {
  normal: hex2rgb('#9aa0ad'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#bfe9ff'), break: hex2rgb('#7d7a86'),
};
const MARS_COL = {
  normal: hex2rgb('#b4674a'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#e0c4b4'), break: hex2rgb('#8a4f3c'),
};
// 火星より先。太陽から遠いので、岩は冷たい灰青になる。
const DEEP_COL = {
  normal: hex2rgb('#7e8798'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#cfeaff'), break: hex2rgb('#5b616f'),
};
// もっと先。氷と塵の世界。
const ICEFIELD_COL = {
  normal: hex2rgb('#a8c4d8'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#e6f6ff'), break: hex2rgb('#78909f'),
};

// 足場の厚み。ぺらいと板に見えるので、しっかり厚くする。
// ★見た目の「上のめん」は、当たり判定の上のめん（pl.y + CJ_PLAT_H）に必ずそろえること。
//   ずれると、チッチが雲に めりこんだり 浮いたり して見える。
// 足場は登るほど横はばが縮む（元の仕様）ので、厚くしすぎると
// 高い所で「毛玉」になってしまう。横：縦がだいたい 1.7:1 に収まる値にする。
const PLAT_THICK = 3.3;
// チッチは足場より少し手前に立たせる。同じ奥ゆきだと前後の順番が決まらず、
// 雲がチッチの顔にかぶってしまう。
const CHICCHI_FRONT = 0.24;

// 高度でゾーンが変わる（元の zone 判定と同じ考え方）
function zoneColors(m) {
  if (m >= 11500) return ICEFIELD_COL;   // 冥王星〜カイパーベルトより先
  if (m >= 5600)  return DEEP_COL;       // 火星をはなれてから
  if (m >= 4000)  return MARS_COL;
  if (m >= CJ_SPACE_M) return ROCK_COL;
  return PLAT_COL;
}
function zoneProps(m) {
  return m >= CJ_SPACE_M ? props.rock : props.cloud;
}

// ---------------- 入力 ----------------
// 元の操作は「指の位置に鳥が来る」（相対ドラッグではない）。そこは変えない。
let dragId = null;
const setFromEvent = e => {
  const r = cv.getBoundingClientRect();
  core.setTargetFromScreen((e.clientX - r.left) / r.width);
};
cv.addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('button')) return;
  e.preventDefault();
  Snd.ensure();                 // 音は最初に画面をさわった時に起こす
  dragId = e.pointerId;
  core.tap();                   // ジャストジャンプの判定
  setFromEvent(e);
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => { if (dragId === e.pointerId) setFromEvent(e); });
const stopDrag = e => {
  if (e && dragId !== null && e.pointerId !== dragId) return;
  dragId = null;
  core.release();               // 指を離す＝たたむ（急降下）
};
cv.addEventListener('pointerup', stopDrag);
cv.addEventListener('pointercancel', stopDrag);

document.querySelectorAll('[data-item]').forEach(btn => {
  btn.onpointerdown = e => {
    e.preventDefault(); e.stopPropagation();
    if (running) core.useItem(btn.dataset.item);
  };
});

// ============================================================
//  本体との橋わたし（iframe / postMessage）
//   親（tuna app）とのやりとりは js/jump3d-embed.js の cj-* に対応する。
//   単体で開いたときは遊び券のやりとりをせず、すぐ遊べる。
// ============================================================
const EMBED = new URLSearchParams(location.search).has('embed');
const ov = document.getElementById('overlay');
const ovSub = document.getElementById('ov-sub');
const ovScore = document.getElementById('ov-score');
const ovGo = document.getElementById('ov-go');
let running = false;
let nickname = '';
let best = Number(localStorage.getItem('jump3dBest') || 0);
let waitingTicket = false;

const post = (type, extra) => {
  if (EMBED && parent !== window) parent.postMessage(Object.assign({ type }, extra || {}), '*');
};

function showOverlay(mode) {
  ov.classList.add('show');
  if (mode === 'over') {
    ovSub.textContent = core.meters >= CJ_MARS_M ? '火星をこえた！'
                      : core.meters >= CJ_GOAL_M ? '月にとどいた！'
                      : 'また いってみよう';
    ovScore.innerHTML =
      `<b>${core.score.toLocaleString()}</b><br>` +
      `たかさ ${core.meters}m ／ ⭐${core.starsCollected}<br>` +
      `<span style="opacity:.7">ベスト ${best.toLocaleString()}</span>`;
    ovGo.textContent = 'もう一回';
  } else {
    ovSub.textContent = 'タワーをぐるぐる登って、宇宙へ。';
    ovScore.innerHTML = best ? `<span style="opacity:.7">ベスト ${best.toLocaleString()}</span>` : '';
    ovGo.textContent = 'はじめる';
  }
  // 今日の宇宙天気。えらべない・すぐ始まる。
  const wx = core.weather;
  const el = document.getElementById('ov-weather');
  if (el) {
    el.innerHTML = `<span class="wx-icon">${wx.icon}</span>` +
      `<span class="wx-text"><b>${wx.name}</b><i>${wx.desc}</i></span>`;
    el.className = 'weather show';
  }
  ovGo.disabled = false;
}

function beginPlay() {
  core.reset();
  rig = new ChicchiRig();
  popText = ''; hitStop = 0; hurtFlash = 0;
  helmetOn = false; helmetT = 0;
  running = true;
  ov.classList.remove('show');
}

ovGo.onclick = () => {
  Snd.ensure();
  if (!EMBED) { beginPlay(); return; }
  // 本体につながっているときは、1プレイぶんの遊び券をもらってから始める
  waitingTicket = true;
  ovGo.disabled = true;
  post('cj-start-request');
};

document.getElementById('btn-back').onclick = () => { post('cj-exit'); };
document.getElementById('btn-rank').onclick = () => { post('cj-rank'); };
const btnSound = document.getElementById('btn-sound');
btnSound.onclick = () => {
  Snd.ensure();
  Snd.bgmOn = !Snd.bgmOn;
  Snd.enabled = Snd.bgmOn;
  btnSound.textContent = Snd.bgmOn ? '🔊' : '🔇';
  if (Snd.ctx) Snd.setAltitude(core.meters);
};

window.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'cj-name') {
    nickname = d.name || '';
  } else if (d.type === 'cj-start-ok') {
    waitingTicket = false;
    beginPlay();
  } else if (d.type === 'cj-start-deny') {
    waitingTicket = false;
    ovGo.disabled = false;
    ovSub.textContent = d.msg || '遊び券がたりません';
  }
});

post('cj-ready');
showOverlay('start');

// ---------------- 演出の状態 ----------------
let popText = '', popUntil = 0, hurtFlash = 0;
// 🪖 宇宙服のヘルメット。宇宙ステーション（2000m）でつける。
let helmetOn = false, helmetT = 0;
// ヒットストップ（秒）。当たった瞬間だけ時間を止めると、打撃が「効いた」感じになる。
let hitStop = 0;
const Snd = new CJAudio();

// ---------------- 単位が上がる演出 ----------------
// 数字は背景ではなく主人公。桁が変わる瞬間だけ、しっかり見せる。
let unitUpUntil = 0, unitUpText = '', unitUpNote = '';
function showUnitUp(unit, note) {
  unitUpText = unit; unitUpNote = note || '';
  unitUpUntil = performance.now() + 1900;
  const el = document.getElementById('unitup');
  el.innerHTML = `<b>${unit}</b>${note ? `<i>${note}</i>` : ''}`;
  el.classList.remove('show');
  void el.offsetWidth;          // アニメを頭から流しなおす
  el.classList.add('show');
}

// ボイジャーのセリフ（1行ずつ、間をあけて出す）
let voyLineIdx = 0, voyLineText = '', voyLineUntil = 0;
function updateVoyagerLines() {
  if (core.progress < CJ_VOYAGER_P - VOY_SPAN - 60) return;
  while (voyLineIdx < VOY_LINES.length &&
         core.progress >= CJ_VOYAGER_P + VOY_LINES[voyLineIdx][0]) {
    voyLineText = VOY_LINES[voyLineIdx][1];
    voyLineUntil = performance.now() + 4200;
    voyLineIdx++;
    Snd.play('voyLine');
  }
}

// ============================================================
//  背景の風景 ── 実寸と実きょりから見え方を計算する
//
//  ★手で「この高度で消す」と決めるのをやめた。
//    それをやると、少し数字がずれただけで富士山が地球の上に浮く。
//
//  ここでは、ほんとうの大きさ(m)・ほんとうのきょり(m)・いまの本当の高度(m)から、
//      ・水平から何度のところに見えるか（見上げ角）
//      ・どれくらいの大きさに見えるか
//    を球の地球の幾何で出し、そのとおりに置く。
//    こうすると、地平線の下へ沈むのも、小さくなって消えるのも、
//    ぜんぶ勝手に正しくなる。手で合わせる数字が要らない。
//
//  奥ゆき（radius）は「前後の重なり順」を決めるためだけに使う。
//  大きさは角度から出すので、奥ゆきをいくつにしても見た目は変わらない。
// ============================================================
const R_EARTH_M = 6371000;

// いまの本当の高度（m）。地上ちょうどだと計算が縮退するので、少しだけ持ち上げる。
function altM() { return Math.max(cjDistanceKm(core.progress) * 1000, 45); }

// 地表の一点（水平きょり D[m]、高さ H[m]）が、高度 h[m] からどう見えるか
//   elev  … 水平から何度のところに見えるか（上が＋）。地平線より下なら負
//   distM … そこまでの実きょり
function groundView(h, D, H) {
  const th = D / R_EARTH_M;                 // 地球の中心から見た角
  const rO = R_EARTH_M + h, rT = R_EARTH_M + H;
  const x = rT * Math.sin(th);              // 観測者を原点、天頂を +Y とした平面で
  const y = rT * Math.cos(th) - rO;
  return { elev: Math.atan2(y, x), distM: Math.hypot(x, y) };
}
// 地平線が水平から何度下がって見えるか
function horizonDip(h) { return Math.acos(clamp(R_EARTH_M / (R_EARTH_M + h), -1, 1)); }

// ★カメラは筒の軸から離れたところにいる。ここを忘れると、
//   「カメラから 78 のところ」のつもりで置いたものが実際は 88 になり、
//   計算で出した大きさと見え方がずれる。基準は必ず「カメラから」にそろえる。
const CAM_FOVY  = 1.16;
const CAM_PITCH = 0.17;
const CAM_DIST  = CJ_VIEW_H / (2 * Math.tan(CAM_FOVY / 2));          // ≒ 7.37
const CAM_AXIS  = CJ_RADIUS + Math.cos(CAM_PITCH) * CAM_DIST;        // ≒ 9.65（軸からの距離）
const CAM_LIFT  = Math.sin(CAM_PITCH) * CAM_DIST;                    // 見おろすぶんの持ち上げ

// カメラの目の高さ（world）
const eyeY = () => core.camY + CJ_VIEW_H * 0.5 + CAM_LIFT;

// 「カメラから水平に depth、横へ角度 lat、見上げ角 elev」を
// インスタンスの置き場所（角度・半径・高さ）に直す。
function bgPlace(depth, lat, elev) {
  const R = Math.max(1, depth - CAM_AXIS);        // 軸からの距離
  return {
    // 横のずれは depth×lat。それを半径で割ると、その半径での角度になる。
    ang: cjAngle(core.camPx) + Math.PI - (depth * lat) / R,
    radius: R,
    y: eyeY() + Math.tan(elev) * depth,
  };
}
// 実サイズ sizeM・実きょり distM のものを、奥ゆき depth に置いたときの world サイズ
const sizeAt = (sizeM, distM, depth) => depth * (sizeM / distM);
// 世界に固定されたものの横の角度（円周の位置から）
const latPx = (px, spread) => cjWrapDelta(px, core.camPx) * spread;

// ---------------- 街（東京のつもり）----------------
const CITY = [];
{
  const r = mulberry32(20260820);
  for (let i = 0; i < 54; i++) {
    const near = i < 30;
    CITY.push({
      D: near ? 120 + r() * 900 : 1100 + r() * 3200,   // 水平きょり(m)
      H: near ? 60 + r() * 190  : 90 + r() * 160,      // 高さ(m)
      W: near ? 26 + r() * 34   : 30 + r() * 40,       // 横はば(m)
      px: r() * CJ_CIRC,
      rot: r() * 1.57,
      tone: 0.84 + r() * 0.32,
    });
  }
  CITY.sort((a, b) => b.D - a.D);        // 遠いものから描く
}
// 🗼 スカイツリー：634m、8km 先
const SKYTREE = { D: 8000, H: 634, W: 68, px: CJ_CIRC * 0.30 };
// 🗻 富士山：3776m、100km 先
const FUJI = { D: 100000, H: 3776, W: 38000, lateral: -0.30 };

const scnList = [], ringList = [], planeList = [];

function buildScenery() {
  scnList.length = 0; ringList.length = 0; planeList.length = 0;
  const m = core.progress;
  const h = altM();
  const dip = horizonDip(h);
  const push = (prop, o) => scnList.push(Object.assign({ prop }, o));

  // ---- 🌍 地球（地面）----
  // 高いところでは球、低いところでは「ほぼ平らな地面」。同じ式で両方になる。
  //   角の半径 alpha = asin(R/(R+h))
  //     h=0     → 90°  → 目の高さに地平線＝平らな地面
  //     h=400km → 70°  → 地平線が20°下がって、丸みが見える
  //     月から  → 1°   → 小さな球
  {
    const D_E = 150;                              // 置く奥ゆき（重なり順のため）
    const alpha = Math.asin(clamp(R_EARTH_M / (R_EARTH_M + h), -1, 1));
    const r = D_E * Math.sin(alpha);
    const fade = 1 - smoothstep(2500, 3000, m);   // 月に着くころには見えなくなる
    if (fade > 0.02) {
      push(scn.ground, {
        ang: angOff(0), y: eyeY() - D_E, radius: D_E,
        sx: r, sy: r, sz: r,
        rot: -1.1 + m * 0.00002,
        col: [1, 1, 1], fade,
      });
    }
  }

  // ---- 🏢 街 ----
  // 地平線の下に沈んだら自動で消える。高度で手当てする必要はない。
  for (const b of CITY) {
    const base = groundView(h, b.D, 0);
    const top  = groundView(h, b.D, b.H);
    if (top.elev < -dip - 0.02) continue;        // 屋上まで地平線の下＝もう見えない
    const depth = 9 + (b.D / 4200) * 26;         // 遠いものほど奥に（重なり順）
    const hw = sizeAt(b.H, base.distM, depth);
    if (hw < 0.02) continue;                     // 小さすぎる＝描かない
    const w = sizeAt(b.W, base.distM, depth);
    const far = clamp((b.D - 120) / 4000, 0, 1);
    const k = b.tone * lerp(1.0, 0.62, far);
    push(scn.building, {
      ang: angPx(b.px, 0.10 + far * 0.06),
      y: yAtElev(base.elev, depth), radius: depth,
      sx: w, sy: hw, sz: w,
      rot: b.rot, col: [k, k, k * 1.06], fade: 1,
    });
  }

  // ---- 🗼 スカイツリー ----
  {
    const base = groundView(h, SKYTREE.D, 0);
    const top  = groundView(h, SKYTREE.D, SKYTREE.H);
    if (top.elev > -dip - 0.02) {
      const depth = 40;
      const hw = sizeAt(SKYTREE.H, base.distM, depth);
      if (hw > 0.03) {
        push(scn.skytree, {
          ang: angPx(SKYTREE.px, 0.05),
          y: yAtElev(base.elev, depth), radius: depth,
          sx: hw, sy: hw, sz: hw, rot: 0,
          col: [0.92, 0.95, 1.06], fade: 1,
        });
      }
    }
  }

  // ---- 🗻 富士山 ----
  // 100km 先の 3776m。低いところでは山頂だけ、登るほど全体が見え、
  // やがて小さくなって消える。ぜんぶ幾何が決めてくれる。
  {
    const base = groundView(h, FUJI.D, 0);
    const top  = groundView(h, FUJI.D, FUJI.H);
    if (top.elev > -dip - 0.03) {
      const depth = 78;
      const hw = sizeAt(FUJI.H, base.distM, depth);
      if (hw > 0.04) {
        const w = sizeAt(FUJI.W, base.distM, depth) * 0.5;
        push(scn.fuji, {
          ang: angOff(FUJI.lateral),
          y: yAtElev(base.elev, depth), radius: depth,
          sx: w, sy: hw, sz: w, rot: 0,
          col: [1, 1, 1], fade: 1,
        });
      }
    }
  }

  // ---- ☀️ 太陽。富士山の向こうへ沈んでいく ----
  const sunFade = 1 - smoothstep(620, 820, m);
  if (sunFade > 0.02) {
    const t = clamp((m - 60) / 480, 0, 1);
    const depth = 110;
    const top = groundView(h, FUJI.D, FUJI.H);
    const sunElev = lerp(0.22, top.elev + 0.010, t);   // 山の頂きへ降りていく
    const warm = 1 - t;
    push(scn.sun, {
      ang: angOff(FUJI.lateral + lerp(0.10, -0.005, t)),
      y: yAtElev(sunElev, depth), radius: depth,
      sx: 3.0, sy: 3.0, sz: 3.0, rot: 0,
      col: [3.4, 2.1 + warm * 0.7, 0.6 + warm * 1.0], fade: sunFade,
    });
  }

  // ---- 🌙 月・🔴 火星・惑星たち ----
  const bodies = [
    [scn.moon,    1600, 3400, [1.0, 4.6],  0.35, null],
    [scn.mars,    3600, 5600, [1.0, 4.2], -0.55, null],
    [scn.jupiter, 6600, 8600, [1.6, 6.4],  0.45, null],
    [scn.saturn,  7800, 9600, [1.4, 4.6], -0.40, scn.satRing],
    [scn.uranus,  8900, 10400,[1.0, 2.8],  0.55, scn.uraRing],
    [scn.neptune, 9900, 11400,[1.0, 2.6], -0.45, null],
    [scn.pluto,  11000, 12600,[0.6, 1.5],  0.50, null],
  ];
  for (const [prop, from, to, sz, side, ring] of bodies) {
    const f = smoothstep(from, from + (to - from) * 0.18, m) *
              (1 - smoothstep(to - (to - from) * 0.18, to, m));
    if (f <= 0.02) continue;
    const t = clamp((m - from) / (to - from), 0, 1);
    const grow = Math.sin(t * Math.PI);
    const size = lerp(sz[0], sz[1], grow);
    const y = core.camY + CJ_VIEW_H * lerp(1.15, -0.55, t);
    const rad = 30;
    const ang = angOff(side * 0.24);
    push(prop, { ang, y, radius: rad, sx: size, sy: size, sz: size,
                 rot: core.time * 0.03 + side, col: [1, 1, 1], fade: f });
    if (ring) {
      ringList.push({ prop: ring, ang, y, radius: rad,
                      sx: size, sy: size, sz: size,
                      rot: core.time * 0.03 + side, col: [1, 1, 1], fade: f });
    }
  }

  // ---- ✈️ 飛行機。高度1万mを横切る ----
  {
    const planeF = smoothstep(380, 520, m) * (1 - smoothstep(900, 1100, m));
    if (planeF > 0.02) {
      for (let i = 0; i < 2; i++) {
        const dir = i ? -1 : 1;
        const D = 9000 + i * 7000;
        const v = groundView(h, D, 10000);
        if (v.elev < -dip - 0.02) continue;
        const depth = 34 + i * 12;
        const cross = ((core.time * 0.05 + i * 0.37) % 1) * 2 - 1;
        const sz = sizeAt(60, v.distM, depth) * 3.2;   // 60m級。少し大きめに見せる
        planeList.push({
          ang: angOff(dir * cross * 0.30),
          y: yAtElev(v.elev, depth) + Math.sin(core.time * 0.5 + i) * 0.10,
          radius: depth,
          sx: sz, sy: sz, sz: sz,
          rot: dir > 0 ? 0 : Math.PI,
          col: [1, 1, 1], fade: planeF,
        });
      }
    }
  }
}

// 円周上の位置＋高さ → ワールド座標（つぶを出す場所に使う）
function worldAt(px, y, radiusOffset) {
  const a = cjAngle(px), r = CJ_RADIUS + (radiusOffset || 0);
  return [Math.sin(a) * r, y, Math.cos(a) * r];
}

function handleEvents() {
  const now = core.time * 1000;
  for (const ev of core.events) {
    switch (ev.type) {
      case 'land':
        rig.land(ev.impact);
        R.addTrauma(0.10 + ev.impact * 0.22);
        // ヒットストップ。これを挟まないと「潰れ」が1フレームで消えて見えない。
        hitStop = Math.max(hitStop, ev.kind === 'spring' ? 0.060 : 0.040);
        {
          // 着地のけむり。数は落ちてきた速さに比例させる（軽い着地は静かに）
          const P = worldAt(ev.px, ev.y + CJ_PLAT_H, CHICCHI_FRONT * 0.6);
          const n = Math.round(4 + ev.impact * 10);
          if (ev.kind === 'spring') {
            rig.spring(); R.addTrauma(0.30); rig.flip(0.5); Snd.play('spring');
            R.burst(P[0], P[1], P[2], [0.62, 1.0, 0.72], 12,
                    { speed: 3.4, up: 1.6, size: 0.13, life: 0.5, kind: 1, drag: 1.2 });
          } else if (ev.kind === 'break') {
            Snd.play('break');
            // 崩れるかけらは下へ落とす
            R.burst(P[0], P[1], P[2], [0.80, 0.78, 0.86], 14,
                    { speed: 2.2, up: 0.5, size: 0.12, life: 0.8, kind: 2, g: 5.5, drag: 0.5 });
          } else if (ev.kind === 'ice') {
            Snd.play('ice');
            R.burst(P[0], P[1], P[2], [0.72, 0.94, 1.0], 10,
                    { speed: 2.6, up: 0.8, size: 0.10, life: 0.55, kind: 3, drag: 1.4 });
          } else {
            Snd.play('bounce');
            R.burst(P[0], P[1], P[2], zoneDust(core.meters), n,
                    { speed: 1.9, up: 0.7, size: 0.15, life: 0.45, kind: 0, drag: 2.4 });
          }
        }
        break;
      case 'star':
        popText = ev.combo > 1 ? `⭐×${ev.combo}  +${ev.gained.toLocaleString()}`
                               : `⭐ +${ev.gained.toLocaleString()}`;
        popUntil = now + 900;
        Snd.play('star', ev.combo);
        {
          const P = worldAt(ev.px, ev.y, 0.10);
          R.burst(P[0], P[1], P[2], [1.0, 0.88, 0.35], 8 + ev.combo * 2,
                  { speed: 2.4, up: 0.9, size: 0.12, life: 0.5, kind: 3, drag: 1.8 });
        }
        break;
      case 'onigiri':
        popText = '🍙 バリア！'; popUntil = now + 1200; Snd.play('onigiri');
        break;
      case 'hurt': {
        rig.hurt(); R.addTrauma(0.6); hurtFlash = 1;
        hitStop = Math.max(hitStop, 0.090);
        Snd.play('hit');
        const P = worldAt(ev.px, ev.y, 0.16);
        R.burst(P[0], P[1], P[2], [1.0, 0.55, 0.68], 16,
                { speed: 3.6, up: 0.8, size: 0.14, life: 0.55, kind: 1, drag: 1.5 });
        break;
      }
      case 'repel':
        popText = '🍙 はね返した！'; popUntil = now + 900; Snd.play('onigiri');
        break;
      case 'hawkWarn':
        Snd.play('warn');
        popText = ev.m >= 2600 ? '👽 宇宙人や！じゃまするで！'
                : ev.m >= CJ_SPACE_M ? '🛰 人工衛星や！ぶつかるな！'
                : ev.m >= CJ_BALLOON_M ? '🎈 気球や！ぶつからんように！'
                : '🦅 タカや！気をつけて！';
        popUntil = now + 1500;
        break;
      case 'milestone':
        popText = `⛰ ${ev.m}m とうたつ！`; popUntil = now + 1500;
        R.addTrauma(0.25); Snd.play('milestone');
        break;
      case 'moon':
        popText = '🌙 月にとうちゃく！'; popUntil = now + 2600;
        R.addTrauma(0.5); hitStop = 0.12; Snd.play('goal'); break;
      case 'mars':
        popText = '🔴 火星にとうちゃく！'; popUntil = now + 2600;
        R.addTrauma(0.5); hitStop = 0.12; Snd.play('goal'); break;

      case 'anchor':
        // 名まえのある地点に着いた。どの到達にも意味が宿るようにしている。
        if (ev.name === '月' || ev.name === '火星') break;   // 上で出しているので二重にしない
        popText = `📍 ${ev.name}${ev.bonus ? `　+${ev.bonus.toLocaleString()}` : ''}`;
        popUntil = now + 2200;
        Snd.play('milestone');
        R.addTrauma(0.2);
        break;

      case 'unitUp':
        // 単位が上がった＝スケールが1段あがった瞬間。ここは演出の主役。
        showUnitUp(ev.unit, ev.note);
        hitStop = Math.max(hitStop, 0.060);
        R.addTrauma(0.35);
        Snd.play('unit');
        break;

      case 'voyagerNear':
        voyLineIdx = 0;
        break;

      case 'voyager':
        // 1回きりの、いちばんの見せ場。ここだけ思いきり止める。
        hitStop = 0.16;
        R.addTrauma(0.5);
        Snd.play('record');
        break;
      case 'rocket': rig.launch(1); rig.flip(0.6); Snd.play('rocket'); break;
      case 'wing': Snd.play('wing'); break;
      case 'just': {
        // ジャストジャンプ。決まったことが分かるように、光と音でしっかり返す。
        popText = ev.n >= 3 ? `✨ ジャスト×${ev.n}！` : '✨ ジャスト！';
        popUntil = now + 700;
        Snd.play('just');
        R.addTrauma(0.14);
        const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
        R.burst(P[0], P[1], P[2], [1.0, 0.95, 0.65], 10,
                { speed: 3.0, up: 0.4, size: 0.11, life: 0.4, kind: 3, drag: 2.0 });
        break;
      }
      case 'gameover': {
        Snd.play('over');
        running = false;
        if (core.score > best) { best = core.score; localStorage.setItem('jump3dBest', String(best)); }
        post('cj-score', { score: core.score, meters: core.meters });
        // 落ちきってから結果を出す（すぐ出すと「今の何？」になる）
        setTimeout(() => showOverlay('over'), 700);
        break;
      }
    }
  }
}

// ---------------- 描画データの組み立て ----------------
// 足場は種類ごとに別のモデルなので、種類ごとにまとめて描く
const platLists = { normal: [], spring: [], ice: [], break: [] };
const itemStarList = [], itemOnigiriList = [], foeList = [], voyagerList = [];

// ボイジャーが見えている進行度のはば（±）。約34秒ぶん並走する。
const VOY_SPAN = 450;
const VOY_SIDE = 0.80;    // タワーの中心から少し横へずらして置く（HUDにかぶらない位置）

// 追いこすまでに、1行ずつ間をあけて出す。
// ★事実だけを書いて、感想は一切書かない。速さでなく「時間」と「向き」で語る。
const VOY_LINES = [
  [-380, 'なにか 光っている…'],
  [-250, 'ボイジャー1号。1977年、地球を出た。'],
  [-150, 'だれもむかえに行かない。だれも止めない。'],
  [ -60, '金のレコードに、地球の音が入っている。'],
  [  10, '波の音。かみなり。赤ちゃんの泣き声。55の言葉であいさつ。'],
  [ 110, 'もし、いつか、だれかがひろったら。'],
  [ 260, 'ボイジャーのアンテナは、いまも地球のほうを向いている。'],
];

// 高度でじゃま役の姿が変わる（元の jump.js と同じしきい値）
function foeKind(m) {
  if (m >= 2600) return 'alien';        // ずっと先は宇宙人
  if (m >= CJ_SPACE_M) return 'satellite';  // 大気圏を出たら人工衛星
  if (m >= CJ_BALLOON_M) return 'balloon';
  return 'hawk';
}
// 着地のけむりの色。雲は白、岩は茶、火星は赤茶。
function zoneDust(m) {
  if (m >= 4000) return [0.86, 0.58, 0.44];
  if (m >= CJ_SPACE_M) return [0.74, 0.74, 0.78];
  return [0.98, 0.99, 1.0];
}

const FOE_COL = {
  hawk:      hex2rgb('#a8825f'),
  balloon:   hex2rgb('#ff6f7a'),
  satellite: hex2rgb('#e8e6ee'),
  alien:     hex2rgb('#8fe6a6'),
};

function buildDrawLists() {
  for (const k in platLists) platLists[k].length = 0;
  itemStarList.length = 0; itemOnigiriList.length = 0; foeList.length = 0;
  const now = core.time * 1000;
  const col = zoneColors(core.meters);

  // 空の色。遠い足場をこれに向けてかすませると、奥ゆきが出る。
  const sky = cjSkyColors(core.meters)[0];
  const zp0 = zoneProps(core.meters);

  for (const pl of core.platforms) {
    const d = cjWrapDelta(pl.px, core.camPx);
    const far = Math.abs(d);
    // ★タワーの裏側もうすく描く。これが「円筒を登っている」ことを見せる唯一の手がかり。
    //   ただし濃さははっきり分ける。明るい＝今ねらえる足場、うすい＝裏側、と
    //   ひと目で分かるようにしておかないと「乗れると思った」で落ちて理不尽になる。
    const near = 1 - smoothstep(CJ_VIEW_W * 0.44, CJ_VIEW_W * 0.62, far);
    let fade = lerp(0.34, 1.0, near);
    if (pl.used) fade *= 1 - clamp((now - pl.breakAt) / CJ_BREAK_FADE_MS, 0, 1);
    const c0 = col[pl.type];
    const k = (1 - near) * 0.62;             // 遠いほど空の色に溶かす
    const c = [lerp(c0[0], sky[0], k), lerp(c0[1], sky[1], k), lerp(c0[2], sky[2], k)];
    // seed で少しずつ形を変えると、同じメッシュでも並んで見えない
    const s = 0.85 + pl.seed * 0.3;
    const sy = CJ_PLAT_H * PLAT_THICK * s;
    // ★見た目の上のめんを、当たり判定の上のめんに実測でそろえる
    const meshTop = zp0[pl.type].top;
    platLists[pl.type].push({
      ang: cjAngle(pl.px), y: pl.y + CJ_PLAT_H - meshTop * sy, radius: CJ_RADIUS,
      sx: pl.w, sy, sz: pl.w * 0.72,
      rot: (pl.seed - 0.5) * 0.5,
      col: c, fade, _far: far,
    });
  }
  // 半とうめいを重ねるので、遠いものから先に描く
  for (const k in platLists) platLists[k].sort((a, b) => b._far - a._far);

  for (const c of core.coins) {
    if (c.taken) continue;
    const d = cjWrapDelta(c.px, core.camPx);
    if (Math.abs(d) > CJ_CIRC * 0.32) continue;
    if (c.kind === 'star') {
      // ★くるくる一周させると、真横を向いた瞬間にペラい板になって見えなくなる。
      //   左右に振るだけにして、いつでも星の形が読めるようにする。
      const tilt = Math.sin(core.time * 2.2 + c.px) * 0.7;
      itemStarList.push({
        ang: cjAngle(c.px), y: c.y + Math.sin(core.time * 2 + c.px) * 0.05,
        radius: CJ_RADIUS + 0.10,
        sx: 0.46, sy: 0.46, sz: 0.46, rot: tilt,
        col: hex2rgb('#ffd94a'), fade: 1,
      });
    } else {
      itemOnigiriList.push({
        ang: cjAngle(c.px), y: c.y, radius: CJ_RADIUS + 0.10,
        sx: 0.42, sy: 0.42, sz: 0.42,
        rot: Math.sin(core.time * 1.4 + c.px) * 0.5,
        col: hex2rgb('#fdfdfb'), fade: 1,
      });
    }
  }

  // --- 🛰 ボイジャー1号 ---
  // すれちがいは一瞬でも、並走は記憶に残る。
  // 進行度で位置を決めるので、追いこす瞬間が必ず progress 15,000 とそろう。
  {
    const t = (core.progress - (CJ_VOYAGER_P - VOY_SPAN)) / (VOY_SPAN * 2);
    if (t > -0.05 && t < 1.05) {
      const e = clamp(t, 0, 1);
      voyagerList.length = 0;
      voyagerList.push({
        ang: cjAngle(core.camPx + VOY_SIDE),
        y: core.camY + CJ_VIEW_H * lerp(1.30, -0.40, easeInOut(e)),
        // 手前すぎるとプレイの邪魔、奥すぎると小さくて何か分からない。
        // 「はっきり見えるが、足場とは別の層にいる」距離にする。
        radius: CJ_RADIUS + 1.70,
        sx: 1.15, sy: 1.15, sz: 1.15,
        // ★皿はカメラのほうへ向ける。真横だと、ただの白い楕円になって
        //   パラボラアンテナだと分からない。少しだけ傾けて立体を見せる。
        rot: 1.35 + Math.sin(core.time * 0.22) * 0.10,
        col: [1, 1, 1], fade: 1,
      });
    } else {
      voyagerList.length = 0;
    }
  }

  // じゃま役。当たると痛いものが見えていないのは、いちばんやってはいけない事故。
  const h = core.hawk;
  if (h) {
    const kind = foeKind(core.meters);
    // 進む向きを向かせる。dir=+1 なら円周の進む向き＝ローカル +X。
    const bob = Math.sin(core.time * 6.5) * (kind === 'hawk' ? 0.07 : 0.03);
    foeList.push({
      kind,
      ang: cjAngle(h.px), y: h.y + bob, radius: CJ_RADIUS + 0.16,
      sx: 0.92, sy: 0.92, sz: 0.92,
      // 気球・宇宙人は正面を向かせる。タカだけ進行方向へ。
      rot: kind === 'hawk' ? (h.dir > 0 ? 0 : Math.PI)
         : kind === 'satellite' ? core.time * 0.35 : 0,
      col: FOE_COL[kind], fade: 1,
    });
  }
}

// チッチを円筒の上のどこに置くかの行列
function chicchiModel() {
  const p = core.player;
  // 位置は自分の角度。向きだけはカメラ寄りにする。
  // ★自分の角度のまま立たせると、画面のはしにいるとき横や背中を向いてしまい、
  //   いちばん見せたい顔が見えなくなる。カメラの向きへ7割寄せて、
  //   「タワーに立っている」感じを残しつつ顔を見せる。
  const posAng = cjAngle(p.px);
  const faceAng = posAng - cjWrapDelta(p.px, core.camPx) / CJ_CIRC * Math.PI * 2 * 0.7;
  const sp = Math.sin(posAng), cp = Math.cos(posAng);
  const sf = Math.sin(faceAng), cf = Math.cos(faceAng);
  const scale = CJ_PLAYER_H / 1.0;             // モデルの高さ1.0 → 実寸へ
  const m = new Float32Array(16);
  // X = 接線, Y = 上, Z = 外向き（向きは faceAng で作る）
  m[0] = cf * scale;  m[1] = 0;      m[2] = -sf * scale; m[3] = 0;
  m[4] = 0;           m[5] = scale;  m[6] = 0;           m[7] = 0;
  m[8] = sf * scale;  m[9] = 0;      m[10] = cf * scale; m[11] = 0;
  const rr = CJ_RADIUS + CHICCHI_FRONT;
  m[12] = sp * rr; m[13] = p.y; m[14] = cp * rr; m[15] = 1;
  return m;
}

// 真下にある足場を探して、そこに影を落とす（＝着地点の予告）
function shadowTarget() {
  const p = core.player;
  let best = null;
  for (const pl of core.platforms) {
    if (pl.used) continue;
    if (pl.y > p.y) continue;
    if (Math.abs(cjWrapDelta(p.px, pl.px)) > (CJ_PLAYER_W + pl.w) / 2) continue;
    if (!best || pl.y > best.y) best = pl;
  }
  return best;
}

// ---------------- ループ ----------------
let prev = performance.now();
let frameMs = 16;

function loop(now) {
  const dt = Math.min((now - prev) / 1000, 1 / 20);
  prev = now;
  frameMs = frameMs * 0.9 + (dt * 1000) * 0.1;

  // ヒットストップ中はゲームの時間だけ止める（描画とカメラのゆれは動かす）
  if (!running) {
    core.events.length = 0;
  } else if (hitStop > 0) {
    hitStop = Math.max(0, hitStop - dt);
    core.events.length = 0;
  } else {
    core.step(dt);
    handleEvents();
  }
  Snd.setAltitude(core.meters);
  Snd.updateBgm(core.meters);

  const p = core.player;
  rig.update(dt, {
    vy: -p.vy,                        // rig は「画面座標＝下向きが正」で書いてある
    vMax: CJ_SPRING_V,
    vx: p.vx, vxMax: CJ_KNOCK_VX,
    lookX: 0, lookY: p.vy > 0 ? 0.45 : -0.35,
  });
  hurtFlash = Math.max(0, hurtFlash - dt * 3.2);

  R.resize();
  R.setCamera(cjAngle(core.camPx), core.camY, dt);
  R.beginFrame();
  R.drawSky(core.meters, core.time);

  // 背景の風景（足場より先に描く）
  buildScenery();
  for (const o of scnList)   R.drawInstances(o.prop, [o]);
  for (const o of ringList)  R.drawInstances(o.prop, [o]);
  if (planeList.length)      R.drawInstances(scn.plane, planeList);

  buildDrawLists();
  const zp = zoneProps(core.meters);
  for (const k of ['normal', 'break', 'ice', 'spring']) {
    if (platLists[k].length) R.drawInstances(zp[k], platLists[k]);
  }
  if (itemStarList.length)    R.drawInstances(propStar, itemStarList);
  if (itemOnigiriList.length) R.drawInstances(propOnigiri, itemOnigiriList);
  if (foeList.length)         R.drawInstances(foes[foeList[0].kind], foeList);
  if (voyagerList.length)     R.drawInstances(propVoyager, voyagerList);

  // 着地点の影 → そのあとチッチ（影が先。奥ゆきの手がかりになる）
  const tgt = shadowTarget();
  if (tgt) {
    const ang = cjAngle(p.px);
    const h = clamp((p.y - tgt.y) / 6, 0, 1);
    R.drawBlob(
      [Math.sin(ang) * (CJ_RADIUS + 0.02), tgt.y + CJ_PLAT_H * 0.9, Math.cos(ang) * (CJ_RADIUS + 0.02)],
      0.34 - h * 0.12, 0.24 - h * 0.08, 0.5 - h * 0.32);
  }
  const cModel = chicchiModel();
  R.drawChicchi(chicchiSkin, rig, faceTex, cModel, hurtFlash * 0.6);

  // 🪖 宇宙服のヘルメット。宇宙ステーションでつける。
  // ★頭の位置は骨から引く。決め打ちにすると、潰れたり回ったりしたときに頭だけ置いていかれる。
  if (!helmetOn && core.progress >= CJ_STATION_M && running) {
    helmetOn = true; helmetT = 0;
    popText = '🪖 宇宙ステーションで ヘルメットをもらった！';
    popUntil = core.time * 1000 + 2600;
    Snd.play('onigiri');
    R.addTrauma(0.25);
  }
  if (helmetOn) {
    helmetT = Math.min(1, helmetT + dt * 2.2);
    // model行列 × 頭の骨 で、頭の中心のワールド位置を出す
    const hm = M4.mul(cModel, rig.world[BONE.head]);
    const hx = hm[12], hy = hm[13], hz = hm[14];
    const scale = CJ_PLAYER_H;
    // かぶさる動き（上から降りてくる）
    const drop = (1 - easeOutBack(helmetT, 1.4)) * 0.9 * scale;
    const ang = Math.atan2(hx, hz);
    const rad = Math.hypot(hx, hz);
    const put = { ang, y: hy + 0.16 * scale + drop, radius: rad,
                  sx: 0.62 * scale, sy: 0.62 * scale, sz: 0.62 * scale,
                  rot: 0, col: [1, 1, 1], fade: 1 };
    // 首まわりのリングは不とうめい
    R.drawInstances(helmetRing, [Object.assign({}, put, {
      y: hy - 0.16 * scale + drop, sy: 0.62 * scale })]);
    // ドームは半とうめい（顔が見えないと台なしなので、うすく）
    // ガラスは「明るくするだけ」。ふつうの半とうめいだと黒い円盤になる。
    R.drawInstances(helmet, [Object.assign({}, put, { fade: 0.22 })],
                    { noDepthWrite: true, additive: true });
  }

  // ロケットの噴射炎（出しっぱなしにせず、噴いている間だけ）
  if (core.time * 1000 < core.rocketUntil) {
    const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
    for (let i = 0; i < 3; i++) {
      const c = i === 0 ? [0.75, 0.92, 1.0] : i === 1 ? [1.0, 0.84, 0.35] : [1.0, 0.55, 0.16];
      R.spawn({
        x: P[0] + rnd(-0.06, 0.06), y: P[1] - 0.05, z: P[2] + rnd(-0.05, 0.05),
        vy: rnd(-4.5, -2.6), vx: rnd(-0.7, 0.7), vz: rnd(-0.5, 0.5),
        life: rnd(0.18, 0.34), size: 0.16 - i * 0.035, kind: i === 0 ? 1 : 0,
        col: c, drag: 2.2,
      });
    }
  }

  R.updateParticles(dt);
  R.drawParticles();

  // ---- HUD ----
  updateVoyagerLines();

  const nowMs = core.time * 1000;
  const d = core.dist;
  hud.innerHTML =
    `<div class="row"><span>スコア</span><b>${core.score.toLocaleString()}</b></div>` +
    `<div class="row"><span>きょり</span><b>${d.value}<u>${d.unit}</u></b></div>` +
    (d.sub ? `<div class="sub2">${d.sub}</div>` : '') +
    `<div class="row"><span>⭐</span><b>${core.starsCollected}</b></div>` +
    (nowMs < popUntil ? `<div class="pop">${popText}</div>` : '');

  // ボイジャーのことば（画面の下のほう、大きめに）
  const vl = document.getElementById('voyline');
  const showing = performance.now() < voyLineUntil;
  vl.textContent = showing ? voyLineText : '';
  vl.classList.toggle('show', showing);

  // 重かったら解像度を落とす（tetris2 と同じ考え方）
  if (frameMs > 20 && R.quality > 0.62) { R.quality = Math.max(0.62, R.quality - 0.06); }
  else if (frameMs < 13 && R.quality < 1) { R.quality = Math.min(1, R.quality + 0.03); }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// テスト用の口
window.__cj = {
  core, R,
  get rig() { return rig; },
  setRunning(v) { running = v; if (v) ov.classList.remove('show'); },
  step(n, dt) { for (let i = 0; i < (n || 1); i++) core.step(dt || 1/60); },
  moveTo(frac) { core.setTargetFromScreen(frac); },
  // 高さを一気に進める（見た目の確認用）
  // ★カメラと足場もいっしょに運ぶこと。climb だけ書きかえると、
  //   数字だけ進んでカメラは地上に居すわり、実際とちがう絵で確認してしまう。
  warp(m) {
    const climb = m / CJ_M_PER_WORLD;
    core.climb = climb;
    core.camY = climb;                       // camY は climb と同じだけ増える
    core.player.y = climb + CJ_VIEW_H * (1 - CJ_SCROLL_FRAC);
    core.player.vy = 0;
    core.platforms.length = 0;
    core.coins.length = 0;
    core.hawk = null;
    core.updateInfo();
    // その高さの足場を敷きなおす
    core.spawnY = climb - CJ_VIEW_H * 0.2;
    const top = climb + CJ_VIEW_H * 1.4;
    while (core.spawnY < top) {
      core.genPlatformAt(core.spawnY);
      core.spawnY += core.randGap();
    }
  },
  // 4種類の足場を並べて見る（モデルの確認用）
  gallery() {
    core.platforms.length = 0;
    core.coins.length = 0;
    const types = ['normal', 'spring', 'ice', 'break'];
    types.forEach((t, i) => {
      core.platforms.push({
        px: cjWrap(core.camPx + (i - 1.5) * 1.55), y: core.camY + CJ_VIEW_H * 0.30,
        w: CJ_PLAT_W, type: t, risky: false, used: false, breakAt: 0, seed: 0.5, vx: 0,
      });
    });
    core.coins.push({ px: cjWrap(core.camPx - 0.8), y: core.camY + CJ_VIEW_H * 0.60, taken: false, kind: 'star' });
    core.coins.push({ px: cjWrap(core.camPx + 0.8), y: core.camY + CJ_VIEW_H * 0.60, taken: false, kind: 'onigiri' });
    core.player.y = core.camY + CJ_VIEW_H * 0.72;
    core.player.vy = 0;
    core.over = false;
    core.spawnY = 1e9;          // 追加生成を止める
  },
};
window.__cjReady = true;
})();
