// ============================================================
// game.js — 入力・ループ・演出・core と renderer のつなぎ
// ============================================================
'use strict';

(function () {
const CJ_QS = new URLSearchParams(location.search);
// 今週の番号（木曜起点のISO週に近い数え方）。兄弟で同じ数になる。
// 週の通し番号（1970年からの週数）。ランキングのキーに使う。
function cjWeekNo() { return Math.floor((Math.floor(Date.now() / 86400000) + 3) / 7); }
function cjWeekSeed() {
  return ((cjWeekNo() * 2654435761) >>> 0) || 1;
}
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
    buildingFar: R.makeProp(buildBuildingFarMesh()),
    skytree:  R.makeProp(buildSkytreeMesh()),
    fuji:     R.makeProp(buildFujiMesh()),
    moon:     R.makeProp(buildMoonMesh()),
    mars:     R.makeProp(buildMarsMesh()),
    jupiter:  R.makeProp(buildJupiterMesh()),
    saturn:   R.makeProp(buildSaturnMesh()),
    satRing:  R.makeProp(buildSaturnRingMesh()),
    uranus:   R.makeProp(buildUranusMesh()),
    uraRing:  R.makeProp(buildUranusRingMesh()),
    neptune:  R.makeProp(buildNeptuneMesh()),
    pluto:    R.makeProp(buildPlutoMesh()),
    // ☄️ 彗星。しっぽのかたむき違いを3つ。iRot は Y軸まわりしか回せないので、
    //    画面の中での傾きは**メッシュに焼きこむ**しかない。
    comet0:   R.makeProp(buildCometMesh( 0.00)),
    comet1:   R.makeProp(buildCometMesh( 0.36)),
    comet2:   R.makeProp(buildCometMesh(-0.28)),
    plane:    R.makeProp(buildPlaneMesh()),
    jumbo:    R.makeProp(buildJumboMesh()),   // ✈️ 高度1万mをかすめる
    meteor:   R.makeProp(buildMeteorMesh()),  // 🌠 流れ星
    debris:   R.makeProp(buildDebrisMesh()),  // 🪨 目の前を横切る岩（近景）
    // ★地球の球は buildEarthMesh（日本が上を向く本物のほう）を使う。
    //   buildGroundMesh は島が大きすぎて、200km上空だと画面が一面みどりになった。
    ground:   R.makeProp(buildEarthMesh()),
    flat:     R.makeProp(buildFlatGroundMesh()),
    atmo:     R.makeProp(buildAtmoMesh()),
    // 🌙 到着シーン（月・火星の地面／うさぎ／旗）
    moonSurf: R.makeProp(buildSurfaceMesh('moon')),
    marsSurf: R.makeProp(buildSurfaceMesh('mars')),
    rover:    R.makeProp(buildCuriosityMesh()),
    helioWall: R.makeProp(buildHelioWallMesh()),
    pillar:   R.makeProp(buildPillarMesh()),
    flag:     R.makeProp(buildFlagMesh()),
    usflag:   R.makeProp(buildUsFlagMesh()),        // 🇺🇸 アポロの星条旗（月）
    steps:    R.makeProp(buildFootprintsMesh()),    // 👣 月の足あと
    marsbase: R.makeProp(buildMarsBaseMesh()),      // 🏠 火星の居住ドーム
    // はじまりの公園
    park:     R.makeProp(buildParkGroundMesh()),
    tree:     R.makeProp(buildParkTreeMesh()),
    bench:    R.makeProp(buildParkBenchMesh()),
    radio:    R.makeProp(buildParkRadioMesh()),
    ride:     R.makeProp(buildParkSpringRideMesh()),
    lamp:     R.makeProp(buildParkLampMesh()),
  };
  foes.satellite = R.makeProp(buildSatelliteMesh());
  helmet     = R.makeProp(buildHelmetMesh());
  helmetRing = R.makeProp(buildHelmetRingMesh());
  rig  = new ChicchiRig();
  // 天気は日付から決める（兄弟が同じ日に同じ条件で競える）。
  // 地形の乱数だけは毎回変える。
  // 種。ふだんは毎回ちがうが、?seed=… を付けると同じ道のりになる。
  // ★確かめるときは必ず種を決める。毎回ちがう景色だと、直したのか
  //   たまたまなのかが分からなくなる。
  // 🏆 今週のシード（プラン §7 その1）。
  // ★毎回ちがう地形だと「運が悪かった」で終わってしまう。
  //   週がわりの同じ地形にすると、兄弟が**同じ条件**で比べられる。
  //   天気は日がわりのままなので、毎日ちがう手ざわりにはなる。
  core = new ChicchiCore(
    CJ_QS.has('seed') ? (+CJ_QS.get('seed') >>> 0) : cjWeekSeed(),
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
  normal: hex2rgb('#b6c0cd'), spring: hex2rgb('#63d68a'),
  // ★こわれ雲は灰色をやめる。青い地球のふちとも、灰色の岩とも
  //   明るさが近くて、どちらの背景でも沈んでいた（実測1.0台）。
  //   色みでも分かれるよう、あたたかい茶灰にする。
  ice: hex2rgb('#bfe9ff'), break: hex2rgb('#a08776'),
};
const MARS_COL = {
  normal: hex2rgb('#c47a5c'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#e0c4b4'), break: hex2rgb('#6e5a4e'),
};
// 火星より先。太陽から遠いので、岩は冷たい灰青になる。
const DEEP_COL = {
  normal: hex2rgb('#b9c4d6'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#dcf1ff'), break: hex2rgb('#b39a86'),
};
// もっと先。氷と塵の世界。
const ICEFIELD_COL = {
  normal: hex2rgb('#cbdeed'), spring: hex2rgb('#63d68a'),
  ice: hex2rgb('#f0faff'), break: hex2rgb('#b79c86'),
};

// 足場の厚み。ぺらいと板に見えるので、しっかり厚くする。
// ★見た目の「上のめん」は、当たり判定の上のめん（pl.y + CJ_PLAT_H）に必ずそろえること。
//   ずれると、チッチが雲に めりこんだり 浮いたり して見える。
// 足場は登るほど横はばが縮む（元の仕様）ので、厚くしすぎると
// 高い所で「毛玉」になってしまう。横：縦がだいたい 1.7:1 に収まる値にする。
// ★宇宙ゾーンは厚くする。
//   雲はふわっとしていて薄くても「雲」に見えるが、岩が薄いと板に見える。
//   厚みがあるぶん陰影も出るので、暗い宇宙でも形が読めるようになる。
let PLAT_THICK = 3.3;           // 雲（地上のあたり）
let PLAT_THICK_HIGH = 4.42;     // 雲（宇宙のすぐ手前）★岩とは切りはなして持つ
let PLAT_THICK_ROCK = 5.6;      // 小惑星
// 🪨 岩の奥ゆき（2026-08-21）。
//   本人「宇宙の足場（岩）が薄い」。厚み(y)だけ上げてもここは直らなかった。
//   **実測で分かった本当の原因は 奥ゆき(z) だった。**
//     いままでの岩の実寸 … はば0.93 × 高さ1.05 × **奥ゆき0.37**（world）
//     ＝ 立てた板。筒を回りこんだ足場は横から見ることになるので、そのとき
//        目に入るのは はば(x) ではなく奥ゆき(z)。z がうすいと紙きれになる。
//   y だけ 4.8→7.6 に上げた絵も撮ったが、**塔のように背が高くなるだけ**で
//   「うすい」は直らなかった（tools/rock_ab.py の d/e）。
//   ★チッチは足場より 0.24 手前に立つ。岩の前面は 0.371×(はば×奥ゆき) なので、
//     ここを上げすぎるとチッチの足もとに岩が かぶる。1.10 で前面 0.28（実測で確認ずみ）。
let PLAT_DEPTH_ROCK = 1.10;
// 足場の明るさの床。太陽から遠くても、ここより暗くしない（可読性の保険）。
// ★1つの色で「黒い空」と「明るい地球」の両方に3.0以上のコントラストは出せない。
//   カートゥーンの答えは2枚構え：**明るい本体**（暗い背景で抜ける）＋
//   **濃い輪郭線**（明るい背景で抜ける）。両方そろえてはじめて読める。
// 足場の明るさの床。0 だと黒い宇宙に沈み、上げすぎると陰影がつぶれて
// 「岩」ではなく「白い破片」に見えた（実測で 0.82→0.45 に下げた）。
let PLAT_FLOOR = 0.45;
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
// 足場の厚み。
// 🚨 **高いところほど厚くする。**（本人「高度上がってくると足場が薄っぺらくて見にくい」）
//   理由：登るほど空が暗くなり、雲の白と背景の差が小さくなる。そこで同じ厚みだと
//   「白い板」になって、上のめん（＝乗るところ）がどこか読めなくなる。
//   厚みがあれば横の面に影が出るので、**立体として**見える＝乗る場所が分かる。
// ★岩の厚みと雲の厚みは**別々に持つ**こと。前は雲の行き先を
//   「岩の 0.92倍」と書いていたので、岩をいじると雲まで動いた。
//   宇宙に入る所では形（雲→岩）ごと入れかわるので、数字が段でも見えない。
function zoneThick(m) {
  if (m >= CJ_SPACE_M) return PLAT_THICK_ROCK;
  // 街のあいだ（薄くてよい）→ 宇宙の手前（しっかり厚い）へ、なだらかに
  return lerp(PLAT_THICK, PLAT_THICK_HIGH, smoothstep(300, CJ_SPACE_M, m));
}

// ---------------- 入力 ----------------
// 元の操作は「指の位置に鳥が来る」（相対ドラッグではない）。そこは変えない。
//
// 🚨 **ただし「置いただけ」では動かさない**（本人の指摘 2026-08-22）
//   ジャストジャンプは「着地の前後 0.13秒に **指を置きなおす**」操作。
//   置きなおす場所は、前に置いていた場所と ぴったり同じにはならない。
//   絶対位置の操作なので、そのズレのぶん **チッチが指の下へ瞬間移動する**。
//   ＝いちばん正確さが要る瞬間に、いちばん大きく横へ飛んでいた。
//   → 指を置いただけでは動かさない。TAP_SLOP を超えて動かして
//     「なぞる気だ」と分かってから、いままでどおり指の位置へ合わせる。
//   ★スワイプの感度・向き・当たりかたは何も変えていない。
//     変えたのは「置いた瞬間に合わせるかどうか」だけ。
const TAP_SLOP = 10;              // px。これ以内は「タップ」＝チッチを動かさない
let dragId = null;
let downX = 0, downY = 0, dragging = false;
let lastMoveAt = 0, lastMoveX = 0, flickUsed = false;
const setFromEvent = e => {
  const r = cv.getBoundingClientRect();
  core.setTargetFromScreen((e.clientX - r.left) / r.width);
};
cv.addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('button')) return;
  e.preventDefault();
  Snd.ensure();                 // 音は最初に画面をさわった時に起こす
  // 公園のあいだは、さわると飛ばせる（毎回おなじ演出を待たせない）
  if (intro) { skipIntro(); return; }
  if (letter) { nextLetter(); return; }
  if (arriveTalk) { endArriveTalk(); return; }   // 読みたくない子は飛ばせる
  if (outro) { endOutro(); return; }
  // 🔵 地球の点をさわったとき。**説明はしない。光だけ。**
  if (earthDot && running) {
    const sp = screenOf(earthDot.w);
    if (sp && !sp.behind) {
      const r = cv.getBoundingClientRect();
      const sx = (sp.x * 0.5 + 0.5) * r.width, sy = (0.5 - sp.y * 0.5) * r.height;
      if (Math.hypot(e.clientX - r.left - sx, e.clientY - r.top - sy) < 46) {
        R.burst(earthDot.w[0], earthDot.w[1], earthDot.w[2], [1.0, 0.94, 0.62], 7,
                { speed: 0.45, up: 0.3, size: 0.032, life: 1.1, kind: 3, drag: 0.8 });
        Snd.tone(1760, 0.5, { type: 'sine', gain: 0.035 });
      }
    }
  }
  dragId = e.pointerId;
  downX = e.clientX; downY = e.clientY; dragging = false;
  core.tap();                   // ジャストジャンプの判定
  // ★ここで setFromEvent(e) を呼ばない（上の TAP_SLOP の説明を見ること）。
  //   逆フリックの物差しだけ、置いたところで引きなおしておく。
  //   引きなおさないと、前に指を離した場所との差が「速いはらい」に見えて
  //   置いた瞬間に⚡が暴発する。
  {
    const r0 = cv.getBoundingClientRect();
    lastMoveAt = performance.now();
    lastMoveX = (e.clientX - r0.left) / r0.width;
  }
  cv.setPointerCapture(e.pointerId);
});
// 👀 指を止めると、カメラが上へパンして先が見える（プラン §3.1）。
//    ★そのあいだ横には動けない。情報と時間のトレード。
//    ⚡ 速く逆へはらうと、慣性を消して逆向きに ぐっと寄れる（着地まで1回だけ）。
cv.addEventListener('pointermove', e => {
  if (dragId !== e.pointerId) return;
  // ★指のブレでは動かさない。TAP_SLOP を超えたら「なぞっている」と決める。
  //   ここを超えるまでは、逆フリックの判定にも入れない。
  if (!dragging) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < TAP_SLOP) return;
    dragging = true;
  }
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const dt2 = (performance.now() - lastMoveAt) / 1000;
  const dx = x - lastMoveX;
  // ⚡ 逆フリック：速くはらった向きが、いま流れている向きと逆なら
  if (!flickUsed && running && dt2 > 0 && dt2 < 0.12 && Math.abs(dx) > 0.14 &&
      Math.sign(dx) !== Math.sign(core.player.vx) && Math.abs(core.player.vx) > 0.5) {
    flickUsed = true;
    core.player.vx = Math.sign(dx) * CJ_KNOCK_VX * 0.42;
    Snd.play('just');
    const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
    R.burst(P[0], P[1], P[2], [0.85, 0.95, 1.0], 8,
            { speed: 2.4, up: 0.2, size: 0.10, life: 0.32, kind: 1, drag: 2.2 });
  }
  lastMoveAt = performance.now(); lastMoveX = x;
  setFromEvent(e);
});
const stopDrag = e => {
  if (e && dragId !== null && e.pointerId !== dragId) return;
  dragId = null;
  core.release();               // 指を離す＝たたむ（急降下）
};
cv.addEventListener('pointerup', stopDrag);
cv.addEventListener('pointercancel', stopDrag);

// ============================================================
//  ⌨️ キーボード（PCで遊ぶとき）
//   ★操作は増やさない。指1本でできることを、そのままキーに割りあてるだけ。
//     ← →      … チッチが行く先（指の位置とおなじ意味）
//     ↓ / Shift … たたむ（指を離す＝急降下）
//     Space     … 置きなおす（ジャストジャンプ）
//     1 / 2     … つばさ / ロケット
//     Enter     … はじめる・もう一回
// ============================================================
// ✨演出トグル（プラン §2.3 酔い対策）。切ると、ゆれ半分・カメラの呼吸なし。
let FX = localStorage.getItem('cjFx') !== 'off';
{
  const tg = document.getElementById('tg-fx');
  if (tg) {
    tg.classList.toggle('on', FX);
    tg.onclick = () => {
      FX = !FX;
      localStorage.setItem('cjFx', FX ? 'on' : 'off');
      tg.classList.toggle('on', FX);
    };
  }
}

const keyHeld = new Set();
let keyX = 0.5;              // 指の位置に相当（0=左はし 1=右はし）
let keyUsed = false;         // キーで遊んでいるあいだだけ、キーの位置を使う

function keyStep(dt) {
  if (!keyUsed) return;
  const L = keyHeld.has('ArrowLeft') || keyHeld.has('KeyA');
  const Rr = keyHeld.has('ArrowRight') || keyHeld.has('KeyD');
  if (L === Rr) return;                       // 両方 or どちらも押していない
  // 画面はばを 0.85秒 で横切る速さ
  keyX = clamp(keyX + (Rr ? 1 : -1) * dt * 1.18, 0, 1);
  core.setTargetFromScreen(keyX);
}

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.code;
  // 🩺 F2 で診断表示（チカチカの原因さがし用）
  if (k === 'F2') { e.preventDefault(); DIAG = !DIAG; return; }
  // 🔬 F3 で「重ねてある字」をぜんぶ消す。消してチカチカが止まるなら、
  //    犯人は3Dの絵ではなく、字と絵の重ねかた（合成）のほう。
  if (k === 'F3') { e.preventDefault(); setDomOff(!DOMOFF); return; }
  // 🔁 F4 で「前の作り（desynchronized）」に入れかえて開きなおす。
  //    こちらでチカチカして、ふつうの方でしないなら、犯人はそれで確定。
  if (k === 'F4') {
    e.preventDefault();
    const u = new URL(location.href);
    if (u.searchParams.get('desync') === '1') u.searchParams.delete('desync');
    else u.searchParams.set('desync', '1');
    location.replace(u.toString());
    return;
  }
  // 📖 あそびかた／スタンプ帳を ひらいているあいだは、キーはとじるだけ。
  //    ★ここで返さないと Enter が ov-go を押して、読んでいる途中で始まってしまう。
  if (sheetOpen()) {
    if (k === 'Escape' || k === 'Enter' || k === 'Space') { e.preventDefault(); closeSheet(); }
    return;
  }
  if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space','ShiftLeft','ShiftRight',
       'KeyA','KeyD','KeyS','KeyW','Digit1','Digit2','Enter'].includes(k)) e.preventDefault();
  keyHeld.add(k);
  Snd.ensure();

  if (k === 'Enter') {
    if (!ov.classList.contains('show')) return;
    if (!ovMore.hidden) ovMore.click(); else ovGo.click();
    return;
  }
  if (intro) { skipIntro(); return; }
  if (letter) { nextLetter(); return; }
  if (arriveTalk) { endArriveTalk(); return; }
  if (!running) return;

  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD') {
    if (!keyUsed) {                    // キーを使いはじめた瞬間は、いまの位置から
      keyUsed = true;
      keyX = 0.5 + cjWrapDelta(core.player.px, core.camPx) / CJ_VIEW_W;
      keyX = clamp(keyX, 0, 1);
    }
    core.tap();                        // 指を置いた＝ジャストジャンプの受付
  } else if (k === 'ArrowDown' || k === 'KeyS' || k === 'ShiftLeft' || k === 'ShiftRight') {
    core.release();                    // たたむ（急降下）
  } else if (k === 'Space') {
    core.tap();                        // 置きなおす
  } else if (k === 'Digit1') {
    tryUseItem('wing');           // ★ボタンと同じ道を通す（数を見ずに使わせない）
  } else if (k === 'Digit2') {
    tryUseItem('rocket');
  }
});

window.addEventListener('keyup', e => {
  keyHeld.delete(e.code);
  if (!running) return;
  // たたむのをやめる＝指を置きなおす
  if (['ArrowDown','KeyS','ShiftLeft','ShiftRight'].includes(e.code)) {
    core.tap();
    core.setTargetFromScreen(keyX);
  }
});
// 画面をさわったら、指のほうを優先に戻す
cv.addEventListener('pointerdown', () => { keyUsed = false; });

// ============================================================
//  🎒 道具ののこり（🪽つばさ / 🚀ロケット）
//
//  🚨 前は `core.useItem()` を直に呼んでいたので、**何回でも使えた**
//     （本人の指摘 2026-08-22「無限に使えるようになってる」）。
//     2D版（js/jump.js の jumpUseItem）は getItems() で数を見て addItem(kind,-1)
//     している。同じ財布（本体の localStorage['items']）を使う。
//     ★この財布は テトリス・おかんスイーパー・チッチジャンプ2 と共通で、
//       勉強のごほうび（ガチャ）でしか増えない。だからここだけ無限だと、
//       「勉強すると道具がもらえる」という土台がまるごと効かなくなる。
//
//  持ち主は**本体**。iframe の中からは、親に頼んで減らしてもらう。
//  単体で開いたときは、同じ鍵をそのまま読み書きする（置き場が同じなのでズレない）。
// ============================================================
let itemStock = { wing: 0, rocket: 0 };

function stockDirectRead() {
  try {
    const o = JSON.parse(localStorage.getItem('items') || '{}');
    return { wing: Math.max(0, o.wing | 0), rocket: Math.max(0, o.rocket | 0) };
  } catch (e) { return { wing: 0, rocket: 0 }; }
}
function stockDirectWrite(s) {
  try {
    const o = JSON.parse(localStorage.getItem('items') || '{}');
    o.wing = s.wing; o.rocket = s.rocket;
    localStorage.setItem('items', JSON.stringify(o));
  } catch (e) {}
}
function setStock(s) {
  itemStock = { wing: Math.max(0, (s && s.wing) | 0), rocket: Math.max(0, (s && s.rocket) | 0) };
  drawItemButtons();
}
function drawItemButtons() {
  document.querySelectorAll('[data-item]').forEach(btn => {
    const n = itemStock[btn.dataset.item] || 0;
    const b = btn.querySelector('b');
    if (b) b.textContent = n;
    btn.disabled = n <= 0;
  });
}
// ★効いているあいだは、もう1つ使わない（連打で数だけ減るのを防ぐ）。
//   2D版と同じ決まり。
function tryUseItem(kind) {
  if (!running || core.over || core.ending || letter) return;
  if ((itemStock[kind] || 0) <= 0) return;
  const now = core.time * 1000;
  if (kind === 'wing'   && now < core.wingUntil)   return;
  if (kind === 'rocket' && now < core.rocketUntil) return;
  core.useItem(kind);
  // 先に減らして見せ、あとで持ち主の数で上書きする（押した手ごたえを遅らせない）
  itemStock[kind] = Math.max(0, itemStock[kind] - 1);
  drawItemButtons();
  if (EMBED) post('cj-use-item', { kind });
  else stockDirectWrite(itemStock);
}

document.querySelectorAll('[data-item]').forEach(btn => {
  btn.onpointerdown = e => {
    e.preventDefault(); e.stopPropagation();
    tryUseItem(btn.dataset.item);
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
const ovMore = document.getElementById('ov-more');
let running = false;
let nickname = '';
// 🚨 記録は**その子ごと**に持つ。
//   1台の端末を兄弟でつかうので、共通にすると
//   ・手紙が「1台に1回」になり、弟が一生見られない
//   ・「きのうの自分の標」が兄の記録になり、弟に兄の壁を自分の過去として見せる
//   ことになる（プラン §3.9「絶望的な差を正面から見せない」に真っ向から反する）。
const K = n => 'cj:' + (nickname || 'guest') + ':' + n;
const lsGet = n => { try { return localStorage.getItem(K(n)); } catch (e) { return null; } };
const lsSet = (n, v) => { try { localStorage.setItem(K(n), v); } catch (e) {} };
let best = 0;
let waitingTicket = false;

const post = (type, extra) => {
  if (EMBED && parent !== window) parent.postMessage(Object.assign({ type }, extra || {}), '*');
};

// ============================================================
//  🏅 天体スタンプ帳（プラン §3.7）
//   初めて着いた天体を、ずっと残す。
//   ★負けたプレイにも「木星に初めて着いた日」が残るようにする。
//     これがあると、記録が伸びない日でも手ぶらで終わらない。
// ============================================================
function loadStamps() {
  try { return JSON.parse(lsGet('stamps') || '{}'); } catch (e) { return {}; }
}
let stamps = loadStamps();
let newStamps = [];            // このプレイで初めて着いたもの
function addStamp(name) {
  if (stamps[name]) return false;
  stamps[name] = new Date().toISOString().slice(0, 10);
  newStamps.push(name);
  lsSet('stamps', JSON.stringify(stamps));
  return true;
}

// 🎁 このプレイの「持ち帰るもの」を1つだけ選ぶ（プラン §3.6）
//   ★手ぶらで終わるランを作らない。順に見て、最初に見つかったものを渡す。
function takeaway() {
  if (newStamps.length) {
    return `🏅 はじめて着いた　<b>${newStamps[newStamps.length - 1]}</b>`;
  }
  if (core.score > best) return `🎉 じこベスト こうしん！`;
  if (core.bestCombo >= 3) return `⭐ さいこう ${core.bestCombo} れんぞく`;
  if (core.justJumpCount >= 3) return `✨ ジャスト ${core.justJumpCount} かい`;
  if (core.reached.length) return `📍 ${core.reached[core.reached.length - 1]} まで とどいた`;
  return `🐦 きょうも とんだ`;
}

// 🚩 どこから始めるか（プラン §5.4）。
//   ★一度でも**自分の足で着いた場所**だけが出る。強くはならない。
//     これが無いと、ボイジャーも深宇宙も手紙も「17分ノーミス」の向こう側のまま。
let startFromP = 0;
function buildStartButtons() {
  const el = document.getElementById('ov-starts');
  if (!el) return;
  const avail = CJ_START_POINTS.filter(sp => !sp.stamp || stamps[sp.stamp]);
  if (!CJ_START_POINTS.some(sp => sp.stamp && stamps[sp.stamp])) { el.innerHTML = ''; return; }
  if (!avail.some(sp => sp.p === startFromP)) startFromP = 0;
  el.innerHTML = avail.map(sp =>
    `<button type="button" class="st${sp.p === startFromP ? ' on' : ''}" data-p="${sp.p}">${sp.icon} ${sp.name}</button>`
  ).join('');
  el.querySelectorAll('.st').forEach(b => {
    b.onclick = () => { startFromP = +b.dataset.p; buildStartButtons(); };
  });
}

// ============================================================
//  📖 あそびかた ／ 🏅 スタンプ帳（タイトルからひらく）
//
//   ★スタンプは前から溜まっていたのに、**見るところが無かった**。
//     押される28か所のうち画面に出ていたのは
//     「そのプレイで新しく押した1個」と「始める場所の3つ」だけで、
//     残りは押されたまま、どこにも出てこなかった（2026-08-22 に気づいた）。
//   ★まだ着いていない場所は **名前を伏せて枠だけ** 見せる（????）。
//     空いた枠が見えているほうが、次に行く理由になる。
//     ただし「あと何個」とは言わない。せかす言葉は置かない。
// ============================================================
const CJ_STAMP_ICON = {
  'ビルの上': '🏙', '雲の上': '☁️', '富士山より高く': '🗻', 'カーマンライン': '🚀',
  '宇宙ステーション': '🧑‍🚀', '月': '🌙', '火星': '🔴', '小惑星帯': '☄️',
  '木星': '🪐', '土星': '💍', '天王星': '🔵', '海王星': '🌊', '冥王星': '❄️',
  'ヘリオポーズ': '🛑', 'ボイジャー1号': '🛰', 'オールトの雲': '🌫',
  'プロキシマ・ケンタウリ': '✨', 'ご近所の恒星': '⭐', 'オリオン大星雲': '🌸',
  '天の川の中心': '🌟', '天の川を出る': '🌌', 'アンドロメダ銀河': '🌀',
  '局部銀河群': '👥', 'おとめ座銀河団': '♍', 'ラニアケア超銀河団': '🌐',
  '宇宙の大きなあみ目': '🕸', 'いちばん遠い銀河': '🔭', '観測できる宇宙のはて': '🌠',
};
// スタンプの対象＝名まえのある到達点（地上はのぞく）
const CJ_STAMP_LIST = CJ_ANCHORS.filter(a => a[0] > 0).map(a => ({ p: a[0], name: a[2] }));

const sheetEl   = document.getElementById('sheet');
const sheetBody = document.getElementById('sheet-body');
const sheetTtl  = document.getElementById('sheet-title');
const sheetSub  = document.getElementById('sheet-sub');

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---- あそびかた ----
//  ★実際のコードに合わせて書くこと。ここが本当とちがうと、
//    子どもは「書いてあるのに できない」で自分のせいにする。
function helpHTML() {
  const row = (icon, t, d) => `<div class="hrow"><u>${icon}</u><div><b>${t}</b><span>${d}</span></div></div>`;
  const key = k => `<span class="hkey">${k}</span>`;
  return (
    `<div class="hsec"><h4>ゆびで うごかす</h4>` +
      row('🫳', '画面を なぞる', 'チッチは、ゆびのところへ 行く。おしっぱなしで ずっと動く。') +
      row('✋', 'ゆびを はなす', 'つばさを たたんで 急降下（きゅうこうか）。<b>速く落ちるほど、バネが強くはねる。</b>') +
      row('👀', 'ゆびを 止める', 'カメラが 上へ動いて、先が 見える。そのあいだ 横には 動けない。') +
      row('⚡', '速く 逆へ はらう', 'いきおいを 消して、逆へ ぐっと寄る。<b>着地するまでに 1回だけ。</b>') +
      row('✨', 'ジャストジャンプ', '着地の 前後 0.13びょうに ゆびを 置きなおすと、いつもより 高く とぶ。') +
    `</div>` +
    `<div class="hsec"><h4>足場（あしば）</h4>` +
      row('☁️', 'ふつうの雲', 'そのまま はねる。') +
      row('🌀', 'バネ', 'ぐんと 高く とぶ。落ちてきた 速さが 強いほど よく のびる。') +
      row('🧊', '氷の雲', 'つるつる すべる。乗ったあと 横に ながされる。') +
      row('💥', 'こわれる雲', '一度 乗ると 落ちていく。すぐ 次へ。') +
      row('🪨', '宇宙の岩', '空気の ないところの 足場。ここから先は 雲が ない。') +
    `</div>` +
    `<div class="hsec"><h4>出てくるもの</h4>` +
      row('⭐', 'ほし', '点になる。つづけて とると どんどん 増える。') +
      row('🍙', 'おにぎり', '1回だけ バリア。じゃま役を はね返す。') +
      row('🌈', '光の柱', '2本 立つので、寄ったほうの 力が 手に入る。<b>そのプレイのあいだ だけ・3つまで。</b>') +
      row('🦅', 'じゃま役', '低いところは タカ、上は 🎈気球 → 🛰人工衛星 → 👽宇宙人。ぶつかると 落ちる。') +
    `</div>` +
    `<div class="hsec"><h4>どうぐ（本体のガチャでもらう）</h4>` +
      row('🪽', 'つばさ', 'しばらく 落ちない。') +
      row('🚀', 'ロケット', 'ひとっとびで 上へ。') +
      `<div class="stamp-note">★どうぐを つかっている あいだは、<b>点が 入らない</b>。<br>だから「使っても ずるく ならない」。</div>` +
    `</div>` +
    `<div class="hsec"><h4>キーボード（パソコンのとき）</h4>` +
      `<div class="hrow"><u>⌨️</u><div><b>${key('←')}${key('→')} うごく　${key('↓')}${key('Shift')} たたむ</b>` +
      `<span>${key('Space')} 置きなおす　${key('1')} つばさ　${key('2')} ロケット　${key('Enter')} はじめる</span></div></div>` +
    `</div>`
  );
}

// ---- スタンプ帳 ----
function stampHTML() {
  const got = Object.keys(stamps).length;
  const all = CJ_STAMP_LIST.length;
  // 最前線＝押してあるスタンプのうち いちばん遠いもの
  let tip = '';
  for (const s of CJ_STAMP_LIST) if (stamps[s.name]) tip = s.name;
  const pct = Math.round((got / all) * 100);
  const cells = CJ_STAMP_LIST.map(s => {
    const day = stamps[s.name];
    const cls = 'stamp' + (day ? ' got' : '') + (s.name === tip ? ' tip' : '');
    if (!day) return `<div class="${cls}"><u>❔</u><b>？？？？</b><i>—</i></div>`;
    const md = day.slice(5).replace('-', '/').replace(/^0/, '');
    return `<div class="${cls}"><u>${CJ_STAMP_ICON[s.name] || '⭐'}</u>` +
           `<b>${escapeHtml(s.name)}</b><i>${md}</i></div>`;
  }).join('');
  return (
    `<div class="stamp-bar"><i>${got} / ${all}</i><u><b style="width:${pct}%"></b></u></div>` +
    `<div class="stamp-grid">${cells}</div>` +
    `<div class="stamp-note">はじめて 着いた 日が のこる。<br>` +
    (got ? 'いちど 着いた ところは、消えない。' : 'まだ ひとつも ない。ここからや。') + `</div>`
  );
}

function openSheet(kind) {
  if (!sheetEl) return;
  stamps = loadStamps();                 // ★ひらく直前に読み直す（別の子に切りかわっていることがある）
  if (kind === 'stamp') {
    sheetTtl.textContent = '🏅 スタンプ帳';
    sheetSub.textContent = 'TRAVEL LOG';
    sheetBody.innerHTML = stampHTML();
  } else {
    sheetTtl.textContent = '🎮 あそびかた';
    sheetSub.textContent = 'HOW TO PLAY';
    sheetBody.innerHTML = helpHTML();
  }
  sheetEl.classList.add('show');
  // 🚨 **見せてから いちばん上へ戻すこと。**
  //   display:none のあいだに scrollTop を書いても効かない。
  //   前に開いたシートの位置が residual で残り、スタンプ帳が
  //   「いきなり ？？？？ の途中から」開いた（実測で見つけた）。
  sheetBody.scrollTop = 0;
  Snd.ensure();
}
function closeSheet() { if (sheetEl) sheetEl.classList.remove('show'); }
const sheetOpen = () => !!(sheetEl && sheetEl.classList.contains('show'));

{
  const bh = document.getElementById('tg-help');
  const bs = document.getElementById('tg-stamp');
  const bx = document.getElementById('sheet-close');
  if (bh) bh.onclick = () => openSheet('help');
  if (bs) bs.onclick = () => openSheet('stamp');
  if (bx) bx.onclick = closeSheet;
  // 幕を さわっても とじる（中の箱を さわったときは とじない）
  if (sheetEl) sheetEl.addEventListener('pointerdown', e => { if (e.target === sheetEl) closeSheet(); });
}

// タイトルのボタンに「いくつ集まったか」を出す
function updateStampBadge() {
  const n = document.getElementById('tg-stamp-n');
  if (!n) return;
  const got = Object.keys(loadStamps()).length;
  n.textContent = got ? `${got}/${CJ_STAMP_LIST.length}` : '';
}

function showOverlay(mode) {
  // ★画面ごとに見せるものを切りかえる（CSS の側で出し分ける）
  // 'start' はタイトル画面のこと（CSS は .title で出し分けている）
  ov.className = 'show ' + (mode === 'start' ? 'title' : mode);
  ovMore.hidden = true;
  const wx = document.getElementById('ov-weather');
  const hint = document.getElementById('ov-hint');

  if (mode === 'moon' || mode === 'mars') {
    // 🌙 到着。2D版と同じく「ここでやめる」と「もっと先へ」の2択。
    const moon = mode === 'moon';
    ovSub.textContent = moon ? '🌙 月（つき）にとうちゃく！' : '🔴 火星（かせい）にとうちゃく！';
    ovScore.innerHTML =
      `<b>${core.score.toLocaleString()}</b><br>` +
      `${moon ? '3,000' : '5,000'} とうたつ　+${(moon ? CJ_MOON_BONUS : CJ_MARS_BONUS).toLocaleString()}点<br>` +
      `<span style="opacity:.7">⭐${core.starsCollected}</span>`;
    ovGo.textContent = 'ここでやめる';
    // ★2D版では火星が最後だったが、3D版は**その先が本番**。
    //   ここで止めたら、ボイジャーにも深宇宙にも一生たどり着けない。
    ovMore.hidden = false;
    ovMore.textContent = moon ? 'もっと先へ 🚀' : 'ボイジャーへ 🛰'
    if (wx) wx.className = 'weather';
    if (hint) hint.textContent = moon
      ? 'まだ先がある。行くかどうかは、きみが決める。'
      : 'ここから先は、だれも行ったことがない。';
    ovGo.disabled = false;
    return;
  }

  if (mode === 'over') {
    ovSub.textContent = core.marsCleared ? '火星をこえた！'
                      : core.moonCleared ? '月にとどいた！'
                      : 'また いってみよう';
    const tl = cjTravelLines(core.dist.km)
      .map(([e, w, t]) => `<i>${e} ${w}　<u>${t}</u></i>`).join('');
    ovScore.innerHTML =
      `<b>${core.score.toLocaleString()}</b><br>` +
      `${core.dist.value}${core.dist.unit} ／ ⭐${core.starsCollected}<br>` +
      `<span style="opacity:.7">ベスト ${best.toLocaleString()}</span>` +
      `<div class="travel">${tl}</div>` +
      (lastGain > 0 ? `<div class="gain">🏆 じこベストを <b>+${lastGain.toLocaleString()}</b> こうしん</div>` : '') +
      `<div class="takeaway">${takeaway()}</div>` +
      // 締めの文言は毎回おなじでいい（プラン §5.7）。
      // ★はげまさない。事実だけ置いて、あとは子どもの取り分にする。
      `<div class="closing">きょうは、ここまで。宇宙（うちゅう）は、まだつづく。</div>`;
    ovGo.textContent = 'もう一回';
    // 🔁 復活は1ランに1回だけ。**遊び券は取らない**（プラン §3.6）。
    //   代償は「これから増える点が半分」。取り消しではないので、
    //   ここまで登ったぶんは そのまま残る。
    if (core.canRevive()) {
      ovMore.hidden = false;
      ovMore.textContent = '🔁 そこから もう一回（点は半分）';
    }
    if (wx) wx.className = 'weather';
    if (hint) hint.textContent = '画面を指でなぞる／← → で うごく';
  } else {
    buildStartButtons();
    updateStampBadge();
    const bestEl = document.getElementById('ov-best');
    if (bestEl) bestEl.textContent = best ? `BEST  ${best.toLocaleString()}` : '';
    ovGo.textContent = 'はじめる';
    if (hint) hint.textContent = '画面を指でなぞる／← → で うごく　Space＝置きなおす';
  }
  // 今日の宇宙天気。えらべない・すぐ始まる。
  // ★結果では出さない。タイトルで見せたカードを、もう一度見せる意味はない。
  const w = core.weather;
  if (wx && mode !== 'over') {
    wx.innerHTML = `<span class="wx-icon">${w.icon}</span>` +
      `<span class="wx-text"><b>${w.name}</b><i>${w.desc}</i></span>`;
    wx.className = 'weather show';
  }
  ovGo.disabled = false;
}

function beginPlay() {
  core.reset();
  rig = new ChicchiRig();
  popText = ''; hitStop = 0; hurtFlash = 0; justFlash = 0;
  helmetOn = false; helmetT = 0;
  newStamps = []; stamps = loadStamps();
  resetQuality();              // 🖥 画質は毎回いちばん上から。段は遊んでいる間は下げるだけ
  coopPosted = 0;              // 🤝 協力メーターの二重加算よけ
  if (startFromP > 0) core.startFrom(startFromP);
  bestMark = loadBestMark(); bestMarkPassed = false;
  resetGhost();
  rebuildFlags();          // 🚩 標を立て直す（bestMark が変わっているので）
  ov.className = '';
  if (startFromP > 0) {
    // 途中から始めるときは、公園の演出をしない（もう飛び立ったあとなので）
    running = true;
    intro = null;
  } else {
    running = false;          // ★飛び出すまで、ゲームの時間は止めておく
    startIntro();
  }
}

// ============================================================
//  🌳 はじまりの公園（イントロ）
//
//   ベンチのラジオから、ボイジャー1号の声が聞こえてくる。
//   その声は 23時間まえの声。電波では返事が間に合わない。
//   だから、自分で行く。
//
//  ★毎回この長さを見せない。2回目からは短い版になる。
//    息抜きのゲームで、遊ぶまでに6秒待たせるのは長すぎる。
//    どちらも「画面をさわれば すぐ飛べる」。
// ============================================================
const PARK_LINES_FULL = [
  [0.55, '📻 ザーッ……　こちら ボイジャー1号（ごう）。'],
  [2.00, '📻 だれか、聞（き）いていますか。'],
  [3.40, 'その声（こえ）は、23時間（じかん）まえの声。'],
  [4.80, 'へんじを、しに行（い）こう。'],
];
const PARK_LAUNCH_FULL = 6.00;
const PARK_LINES_SHORT = [[0.10, '📻 ……こちら ボイジャー1号（ごう）。']];
const PARK_LAUNCH_SHORT = 1.30;

let intro = null;           // { t, lines, at, idx }
let parkCrouch = 0;         // 0=立っている 1=いちばん沈んだ
const introOn = () => !!intro;

function startIntro() {
  const seen = lsGet('seenIntro') === '1';
  intro = {
    t: 0,
    lines: seen ? PARK_LINES_SHORT : PARK_LINES_FULL,
    at: seen ? PARK_LAUNCH_SHORT : PARK_LAUNCH_FULL,
    idx: 0,
  };
  parkCrouch = 0;
  Snd.play('radio');
}

function skipIntro() {
  if (!intro) return;
  // 飛び出す直前まで一気に送る（いきなり発射だと、何が起きたか分からない）
  intro.t = Math.max(intro.t, intro.at - 0.42);
  intro.idx = intro.lines.length;
  voyLineUntil = 0;
}

function updateIntro(dt) {
  intro.t += dt;
  const t = intro.t;
  // セリフ
  while (intro.idx < intro.lines.length && t >= intro.lines[intro.idx][0]) {
    voyLineText = intro.lines[intro.idx][1];
    voyLineUntil = performance.now() + 1600;
    intro.idx++;
    Snd.play('voyLine');
  }
  // 空を見上げる → しゃがむ
  const crouchFrom = intro.at - 0.40;
  parkCrouch = t > crouchFrom ? clamp((t - crouchFrom) / 0.40, 0, 1) : 0;
  if (parkCrouch > 0) rig.squash = lerp(1, 0.62, easeOut(parkCrouch));

  if (t >= intro.at) {
    // ズギューン
    intro = null;
    parkCrouch = 0;
    lsSet('seenIntro', '1');
    running = true;
    core.launch();
    rig.spring(); rig.flip(0.62);
    R.addTrauma(0.55);
    Snd.play('zugyun');
    voyLineUntil = 0;
    const P = worldAt(core.player.px, CJ_PARK_TOP, CHICCHI_FRONT);
    R.burst(P[0], P[1], P[2], [0.72, 0.92, 0.55], 16,
            { speed: 3.2, up: 0.9, size: 0.16, life: 0.55, kind: 0, drag: 1.8 });
    R.burst(P[0], P[1], P[2], [1.0, 0.95, 0.62], 12,
            { speed: 4.2, up: 1.4, size: 0.13, life: 0.42, kind: 1, drag: 1.4 });
  }
}

ovMore.onclick = () => {
  ov.className = '';
  ovMore.hidden = true;
  running = true;
  // 🔁 落ちたあとの画面なら「復活」、月・火星の到着なら「もっと先へ」
  if (core.over && core.canRevive()) {
    core.revive();
    hud.classList.remove('dim');
    Snd.play('unit');
  } else {
    core.continueFromMoon();
    Snd.play('rocket');
  }
};

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
    // ★名前が分かった時点で、その子の記録に読みかえる
    loadProfile();
    updateStampBadge();
    // 🚩 みんなの到達点をもらう。★自分の名前が分かってからでないと、
    //    自分の旗を自分の道に立ててしまう。
    post('cj-flags-request');
  } else if (d.type === 'cj-flags-data') {
    setFlagData(d.list);
  } else if (d.type === 'cj-items') {
    // 🎒 道具ののこり。持ち主は本体なので、来た数がいつでも正しい。
    setStock(d.items);
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
// 単体で開いたときは、本体からの返事が来ないので自分で読む
if (!EMBED) setStock(stockDirectRead());
showOverlay('start');

// ---------------- 演出の状態 ----------------
let popText = '', popUntil = 0, hurtFlash = 0;
// ✨ ジャストジャンプが決まった合図。チッチ自身が一瞬光る。
//   ★点滅させない（1回きり・0.25秒で消える）。子ども向けの「明滅は2Hz以下」を守る。
let justFlash = 0;
// 🪖 宇宙服のヘルメット。宇宙ステーション（2000m）でつける。
let helmetOn = false, helmetT = 0;
// ヒットストップ（秒）。当たった瞬間だけ時間を止めると、打撃が「効いた」感じになる。
let hitStop = 0;
const Snd = new CJAudio();

// ---------------- ✨ ジャストジャンプの合図 ----------------
//  ★HUDの小さい pop（左上）では「決まった」が伝わらない。まんなかに大きく出す。
//    ただし **0.6秒で消える**。次の足場を読む目のじゃまをしない。
const justEl = document.getElementById('just');
function showJust(n) {
  if (!justEl) return;
  justEl.querySelector('b').textContent = n >= 2 ? 'ジャスト' : '✨ ジャスト！';
  // つづけて決めたときだけ ×N を出す（1回めから出すと ただの飾りになる）
  justEl.querySelector('i').textContent = n >= 2 ? `×${n}` : '';
  // ★アニメを掛けなおすには、いちど class を外して レイアウトを踏ませる。
  //   外すだけでは 同じアニメが再生されない（連続で決めたとき2回めが出ない）。
  justEl.classList.remove('show');
  void justEl.offsetWidth;
  justEl.classList.toggle('hot', n >= 3);
  justEl.classList.add('show');
}

// ---------------- 単位が上がる演出 ----------------
// 数字は背景ではなく主人公。桁が変わる瞬間だけ、しっかり見せる。
let unitUpUntil = 0, unitUpText = '', unitUpNote = '';
// 🎰 桁が変わる瞬間だけ、数字を回してから着地させる（プラン §4.4）。
//   ★**数字は背景ではなく主人公**。ふだんは静かに、ここだけ動かす。
//   左の桁から順に止まっていく（全部いっぺんに止めると「バグ」に見える）。
let rouletteUntil = 0;
const ROULETTE_MS = 520;
function rouletteValue(v) {
  const t = 1 - clamp((rouletteUntil - performance.now()) / ROULETTE_MS, 0, 1);
  const lock = Math.floor(v.length * easeOut(t) + 0.0001);
  let out = '';
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    out += (i < lock || c < '0' || c > '9') ? c : String(Math.floor(Math.random() * 10));
  }
  return out;
}

function showUnitUp(unit, note) {
  unitUpText = unit; unitUpNote = note || '';
  unitUpUntil = performance.now() + 1900;
  const el = document.getElementById('unitup');
  el.innerHTML = `<b>${unit}</b>${note ? `<i>${note}</i>` : ''}`;
  el.classList.remove('show');
  void el.offsetWidth;          // アニメを頭から流しなおす
  el.classList.add('show');
}

// ============================================================
//  🌙🔴 着いた場所で、ほんとうのことを1行ずつ置いていく
//
//   ★原則（プラン §5.5）：**数字は本物、言葉はやさしく、感想は書かない。**
//     「すごい」「がんばれ」は書かない。それは子ども側の取り分。
//   ★1画面1事実。ボタンより先に、まず景色と事実を見せる。さわれば飛ばせる。
//
//   月は アポロ（もう行った）→ アルテミス（これから行く）の順に置く。
//   火星は キュリオシティ（いま走っている）→ 人が住む計画、の順。
//   **アルテミスで月に住めたら、つぎは火星**——ここがつながると、
//   月と火星が別々の話ではなくなる。
// ============================================================
const ARRIVE_LINES = {
  moon: [
    'アポロ11号（ごう）が、1969年（ねん）にここへ来た。',
    '月に風（かぜ）はない。足あとは、いまも消えていない。',
    '旗（はた）は、上の棒（ぼう）で ぴんと張（は）ってある。',
    'つぎは アルテミス計画（けいかく）。また人が月へ行く。',
    '目ざすのは 月の南極（なんきょく）。そこには氷（こおり）がある。',
    '氷は、水（みず）にもなる。ロケットの燃料（ねんりょう）にもなる。',
  ],
  mars: [
    'キュリオシティ。2012年（ねん）から、ここを走（はし）っている。',
    'アルテミスで 月に住（す）めたら、つぎは火星（かせい）。',
    '片道（かたみち）で 7か月（かげつ）。人が住む計画（けいかく）がある。',
  ],
  // 🌌 観測できる宇宙のはて。**ここが本当のおしまい。**
  //   ★むずかしいのは「宇宙は138億才なのに、はては465億光年」というところ。
  //     光が走っているあいだに、宇宙のほうも広がった——それだけは伝える。
  //   ★このあと、手紙が出る。
  edge: [
    'ここが、見（み）える宇宙のはて。465億光年（おくこうねん）。',
    '宇宙が生まれてから、138億年（おくねん）。',
    'そのあいだに光が走（はし）ったぶんだけ、見えている。',
    '走っているあいだに、宇宙のほうも広（ひろ）がった。だから465億光年。',
    'これより遠くの光は、まだ 届（とど）いていない。',
    'だから、ここから先は だれにも見えない。',
  ],
};
const ARRIVE_SEC = 2.6;
let arriveTalk = null;      // { kind, i, t }
function startArriveTalk(kind) {
  arriveTalk = { kind, i: -1, t: ARRIVE_SEC };
}
function updateArriveTalk(dt) {
  if (!arriveTalk) return;
  arriveTalk.t += dt;
  if (arriveTalk.t < ARRIVE_SEC) return;
  arriveTalk.t = 0;
  arriveTalk.i++;
  const lines = ARRIVE_LINES[arriveTalk.kind] || [];
  if (arriveTalk.i >= lines.length) { endArriveTalk(); return; }
  voyLineText = lines[arriveTalk.i];
  voyLineUntil = performance.now() + ARRIVE_SEC * 1000 + 400;
  Snd.play('voyLine');
}
function endArriveTalk() {
  if (!arriveTalk) return;
  const kind = arriveTalk.kind;
  arriveTalk = null;
  voyLineUntil = 0;
  // 🌌 宇宙のはてを読みおえたら、そのまま手紙へ（ボタンは出さない）
  if (kind === 'edge') { startLetter(); return; }
  showOverlay(kind);
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
function altM() { return Math.max(cjDistanceKm(viewProgress()) * 1000, 45); }

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
// ★カメラを引く（ひと休み中）と、この3つが全部変わる。
//   背景の置き場所は CAM_AXIS を基準にしているので、**同じ値を使い回すこと**。
//   片方だけ変えると、背景だけがガクッとずれる。
let CAM_DIST  = CJ_VIEW_H / (2 * Math.tan(CAM_FOVY / 2));          // ≒ 7.37
let CAM_AXIS  = CJ_RADIUS + Math.cos(CAM_PITCH) * CAM_DIST;        // ≒ 9.65（軸からの距離）
let CAM_LIFT  = Math.sin(CAM_PITCH) * CAM_DIST;                    // 見おろすぶんの持ち上げ

// ============================================================
//  ☀️ 光の逆二乗（プラン §5.1）
//
//   太陽から遠ざかるほど、当たる光は距離の2乗に反比例して減る。
//   実データそのまま：地球1.0／火星0.43／木星0.037／土星0.011／海王星0.001。
//
//   ★実装は1行だが、**チッチの体が本当に暗くなっていく**。
//     数字で「遠い」と書くより、これ1つのほうが よほど遠さが伝わる。
//
//   ★ただし 0.037 をそのまま当てると、足場が背景に沈んで死ぬ。
//     「次に乗る足場が見えること」は、きれいさより先に守る（プラン §10-4）。
//     そこで下限を 0.34 で止め、そのかわり **土星から先はチッチ自身が
//     うっすら光りはじめる**（プランの「チッチのからだが、じぶんで光りはじめた」）。
// ============================================================
const SUN_TINT_MIN = 0.34;
function updateSunLight() {
  const au = cjDistanceKm(core.progress) / AU_KM;
  // 地上〜地球圏は 1.0 のまま（地球は太陽から1AU）
  const d = Math.max(au, 1);
  const raw = 1 / (d * d);
  // ★1/d² をそのまま当てると、木星(5.2AU)で0.037＝ほぼ真っ暗になり、
  //   「だんだん暗くなる」が一瞬で終わってしまう。
  //   暗くなる順番（地球→火星→木星→土星）はそのままに、効きをゆるめる。
  //   1.0 → 0.85(火星) → 0.51(木星) → 0.40(土星) → 0.34(天王星から先)
  const k = clamp(Math.pow(raw, 0.20), SUN_TINT_MIN, 1);
  // 影の色は、光が弱くなるほど青紫へ寄る（明度を落とすのではなく色相で見せる）
  R.look.baseTint[0] = k;
  R.look.baseTint[1] = k * (0.98 + 0.02 * k);
  R.look.baseTint[2] = k * (1.06 - 0.06 * k);
  // 🌟 土星（9.5AU）より先で、チッチ自身がうっすら光りはじめる
  R.look.emis = smoothstep(9.5, 40, au) * 0.16;
  // 遠いほどリムライトを強くする（暗い中でも輪郭が抜ける＝可読性の保険）
  R.look.rimAmt = 0.40 + (1 - k) * 0.34;
}

// ☕ ひと休み中はカメラを少し引く。数字で「休んでいい」と書かずに、
//    視界が広がることで体に伝える。
let camZoom = 1, camZoomV = 0;
let unitPull = 0;          // 🎰 単位が上がった瞬間だけカメラを引く（プラン §4.4）
let biomePull = 0;         // 🌌 新しい場所に入った一瞬だけ引く（プラン §5.1-6）
                           //    チッチが小さくなる＝自分が小さくなる。2秒で戻す。
function updateCamZoom(dt) {
  unitPull = Math.max(0, unitPull - dt / 0.9);
  biomePull = Math.max(0, biomePull - dt / 2.0);
  // ☕ひと休み ＋ 🎯調子（ミスなしが続くと視界が広がる） ＋ 🎬落ちたあとの引き
  let want = FX ? 1 + 0.10 * (core.breakAmt || 0) + 0.09 * (core.calm || 0)
                    + 0.12 * unitPull * unitPull
                    + 0.16 * Math.sin(biomePull * Math.PI) : 1;
  if (outro) want = lerp(1, 4.2, easeOut(Math.min(outro.t / 2.6, 1)));
  [camZoom, camZoomV] = spring(camZoom, camZoomV, want, 26, dt);
  CAM_DIST = CJ_VIEW_H / (2 * Math.tan(CAM_FOVY / 2)) * camZoom;
  CAM_AXIS = CJ_RADIUS + Math.cos(CAM_PITCH) * CAM_DIST;
  CAM_LIFT = Math.sin(CAM_PITCH) * CAM_DIST;
}

// カメラの目の高さ（world）
const eyeY = () => core.camY + CJ_VIEW_H * 0.5 + CAM_LIFT;

// 「カメラから水平に depth、横へ角度 lat、見上げ角 elev」を
// インスタンスの置き場所（角度・半径・高さ）に直す。
// ☄️ 彗星の置き場所。[横, 奥ゆき, 大きさ, 流れる速さ, メッシュの種類]
//  ★奥ゆきをばらすのが要点。同じ奥ゆきに並べると、全部が同じ速さで動いて
//    「貼り紙が滑っている」ように見える。
//  ★横のずれ `lat` は **±0.15 まで**。bgPlace は横のずれを `depth*lat` で置くので、
//    0.24 にすると、横の画角（±0.17rad）の外へ出て**一度も画面に映らない**（実測）。
const CJ_COMETS = [
  [-0.10, 26, 4.60, 0.048, 1],   // 手前。大きくて速い＝主役
  [ 0.13, 42, 3.00, 0.030, 0],
  [ 0.04, 64, 1.90, 0.019, 2],
  [-0.14, 86, 1.20, 0.013, 0],   // いちばん奥。ほとんど止まって見える
];

// ☄️ 彗星が出る決まった場所（プラン §6.3）。
//  ★深宇宙の巡回（30,000〜）だけに置くと、ふつうに遊んで**一度も見られない**。
//    それに、彗星がやって来るのは本当にこのあたり＝**カイパーベルトと
//    オールトの雲**。事実のとおりに置けば、届く場所にも自然に出せる。
//  [はじまり, おわり, 濃さ]
const CJ_COMET_ZONES = [
  // ★おわりは 13,000 の手前で切ること。13,000 からは**ヘリオポーズ**で、
  //   そこは「見せ場（ボイジャー）の前の静けさ」なので、何も出してはいけない。
  [11300, 12700, 1.00],   // カイパーベルト。冥王星のとなり
  [20000, 30000, 0.60],   // オールトの雲。ここは「ゆっくり漂う」ので薄く
];

// いまどれくらい彗星が見えるか（0〜1）。
// ★境目でぱっと出さない。彗星は**その場所に入る前から見えていて**、
//   出たあともしばらく見えているほうが、通りすぎている感じになる。
function cometAmount() {
  const p = core.progress;
  let a = 0;
  // 入りは長く（遠くから近づいてくる）、出はみじかく（すっと居なくなる）
  const band = (from, to, amt) => {
    if (p < from - 900 || p > to + 350) return;
    a = Math.max(a, amt * smoothstep(from - 900, from + 250, p) *
                          (1 - smoothstep(to - 250, to + 350, p)));
  };
  for (const [from, to, amt] of CJ_COMET_ZONES) band(from, to, amt);
  const tl = core.biomeTL;
  if (tl) for (const seg of tl) if (seg.key === 'comet') band(seg.from, seg.to, 1);
  return a;
}

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

// ---------------- 🌳 はじまりの公園 ----------------
// ★ここだけは「向こうがわ」ではなく、カメラのまわりに置く。
//   bgPlace は筒の向こうがわ専用なので、公園には使えない。
//   カメラから見て「前へ d、横へ x」の地面の点を、そのまま筒の座標に直す。
function parkPlace(d, x) {
  const a = cjAngle(core.camPx);
  const sa = Math.sin(a), ca = Math.cos(a);
  // カメラの位置（軸から CAM_AXIS）と、前向き・右向き
  const ex = sa * CAM_AXIS, ez = ca * CAM_AXIS;
  const wx = ex - sa * d + ca * x;
  const wz = ez - ca * d - sa * x;
  return { ang: Math.atan2(wx, wz), radius: Math.hypot(wx, wz) };
}

// カメラから「前へ d・横へ x・見上げ角 elev」の点を、筒の座標に直す。
// ★bgPlace は「筒の向こうがわ」専用（半径 = depth − CAM_AXIS が 1 で下げ止まる）。
//   カメラの近くのもの（つぶ・きらめき）に使うと、ぜんぶ筒の裏に行ってしまう。
function camPlace(d, x, elev) {
  const a = cjAngle(core.camPx);
  const sa = Math.sin(a), ca = Math.cos(a);
  const wx = sa * CAM_AXIS - sa * d + ca * x;
  const wz = ca * CAM_AXIS - ca * d - sa * x;
  return { ang: Math.atan2(wx, wz), radius: Math.hypot(wx, wz),
           y: eyeY() + Math.tan(elev) * d };
}

// [奥ゆき, 横, 大きさ] の木。同じ大きさで並べない。
// ★横の画角は片側 0.34rad しかない。横 ≒ 奥ゆき×0.30 を超えると画面の外。
//   はじめ 13.5 先に 5.2 横（0.37rad）へ置いて、1本も見えなかった。
const PARK_TREES = [
  [12.0, -2.6, 3.2], [14.5,  2.9, 3.8], [18.0, -4.4, 4.1], [22.0,  4.8, 3.5],
  [27.0, -1.2, 4.6], [31.0,  6.6, 4.0], [16.5,  5.0, 2.9], [24.0, -6.6, 3.3],
  [36.0, -9.0, 4.4], [40.0,  9.5, 4.2],
];

function buildPark(push, h) {
  // 公園は、飛び立ってしばらく下に見えている。ビルのあいだを登るあいだ、
  // ずっと足もとに木立が見えているのが最序盤の絵。やがて地図のほうへ渡す。
  const f = 1 - smoothstep(150, 500, h);
  if (f <= 0.02) return;

  // 芝生（大きな円ばん）。まん中に土の広場。
  push(scn.park, {
    ang: cjAngle(core.camPx), y: -0.02, radius: 0,
    // ★地面のふちは「本当の地平線」に届いていないといけない。
    //   小さい円ばんだと、ふちが地平線よりずっと下に来て、
    //   同じ地面の上にあるはずの 富士山やビルが 空に浮いて見える（実際そうなった）。
    sx: 420, sy: 1, sz: 420, rot: 0.4, col: [1, 1, 1], fade: f,
  });

  // 木。★ぜんぶ同じ緑にしない。何本かは色づいた木にする。
  //   （メッシュの緑にかける倍率なので、色を変えるだけで葉の形は同じまま）
  const TREE_TINT = [
    [1, 1, 1], [1, 1, 1], [3.2, 1.15, 0.42], [1, 1, 1],
    [1, 1, 1], [2.4, 1.30, 0.50], [1, 1, 1], [1.15, 1.05, 0.85],
    [1, 1, 1], [2.9, 1.20, 0.46],
  ];
  for (let i = 0; i < PARK_TREES.length; i++) {
    const [d, x, s] = PARK_TREES[i];
    const P = parkPlace(d, x);
    push(scn.tree, { ang: P.ang, y: 0, radius: P.radius,
                     sx: s, sy: s, sz: s, rot: d * 0.7,
                     col: TREE_TINT[i % TREE_TINT.length], fade: f });
  }
  // 街灯
  {
    const P = parkPlace(9.5, 2.4);
    push(scn.lamp, { ang: P.ang, y: 0, radius: P.radius,
                     sx: 1.9, sy: 1.9, sz: 1.9, rot: 0, col: [1, 1, 1], fade: f });
  }
  // ベンチ ＋ そこに置き忘れられたラジオ
  {
    const P = parkPlace(7.6, -1.9);
    const s = 1.7;
    push(scn.bench, { ang: P.ang, y: 0, radius: P.radius,
                      sx: s, sy: s, sz: s, rot: 0.32, col: [1, 1, 1], fade: f });
    // ラジオはベンチの座面（0.26×s）の上。声はここから出ている。
    const pulse = 1 + Math.sin(core.time * 9) * 0.06 * (introOn() ? 1 : 0);
    push(scn.radio, { ang: P.ang, y: 0.26 * s, radius: P.radius,
                      sx: s * 0.9, sy: s * 0.9 * pulse, sz: s * 0.9,
                      rot: 0.32, col: [1, 1, 1], fade: f });
  }
  // バネの遊具（チッチが乗っているもの）。チッチの真下に置く。
  {
    const s = CJ_PARK_TOP / PARK_RIDE_TOP;
    // 沈みこみは、乗る面がチッチの足の高さに合うよう、高さだけ縮める
    const sy = s * (1 - parkCrouch * 0.42);
    push(scn.ride, {
      ang: cjAngle(core.player.px), y: 0, radius: CJ_RADIUS + CHICCHI_FRONT,
      sx: s, sy, sz: s, rot: 0, col: [1, 1, 1], fade: f,
    });
  }
}

// ---------------- 🌙 到着シーン ----------------
// 月に着いたら、いったん降り立つ。空には地球。となりでうさぎがお餅をついている。
// （2D版 jump.js の jDrawEnding をそのまま3Dに置きかえたもの）
function buildArrival(push) {
  const moon = core.ending === 'moon';
  const gy = core.player.y;                    // 足の高さ＝地面の高さ
  // 地面（円周ぜんぶ）
  push(moon ? scn.moonSurf : scn.marsSurf, {
    ang: cjAngle(core.camPx), y: gy, radius: 0,
    sx: 46, sy: 1, sz: 46, rot: 0.3, col: [1, 1, 1], fade: 1,
  });
  // 🚩 旗。月は**アポロの星条旗**（横の棒でぴんと張ってある）、火星は基地の旗。
  {
    const P = camPlace(6.2, 1.5, 0);
    push(moon ? scn.usflag : scn.flag, { ang: P.ang, y: gy, radius: P.radius,
                     sx: 1.5, sy: 1.5, sz: 1.5, rot: -0.5, col: [1, 1, 1], fade: 1 });
  }
  // 👣 月の足あと。**風がないから、いまも消えていない。**
  if (moon) {
    const P = camPlace(5.0, -0.4, 0);
    push(scn.steps, { ang: P.ang, y: gy + 0.01, radius: P.radius,
                      sx: 1.5, sy: 1.5, sz: 1.5, rot: 0.55, col: [1, 1, 1], fade: 1 });
  }
  // 🐰 月のうさぎは**置かない**（本人の指示 2026-08-21
  //    「動いてないし何かわからんので消しましょう」）。
  //    2D版にはいたが、この大きさでは もちをつく動きが読めず、白いかたまりに見える。
  //    月の見どころは 星条旗・足あと・地球にしぼる。
  // 🤖 キュリオシティ／👾 出迎えの宇宙人（火星だけ）
  //    2D版の火星エンディングに居るので、そのまま踏襲する。
  if (!moon) {
    // 🏠 移住計画。ドームがあるだけで「人が住むつもりだ」と分かる。
    // ★探査車（手前・左）と旗（手前・右）のあいだの、奥に置く。
    //   手前に置くと主役をふさぐし、横へ寄せすぎると画面の外へ出る。
    const B1 = camPlace(15.0, 2.6, 0);
    push(scn.marsbase, { ang: B1.ang, y: gy, radius: B1.radius,
                         sx: 3.4, sy: 3.4, sz: 3.4, rot: 0.35, col: [1, 1, 1], fade: 1 });
    const R1 = camPlace(6.2, -1.5, 0);
    push(scn.rover, { ang: R1.ang, y: gy, radius: R1.radius,
                      sx: 1.6, sy: 1.6, sz: 1.6, rot: 1.1, col: [1, 1, 1], fade: 1 });
    const A1 = camPlace(6.6, 2.9, 0);   // 旗と重ならない場所へ
    // ふわふわ浮いている（2D版と同じ動き）。
    // ★じゃま役のときと同じ大きさにそろえる（1.5 だとチッチの倍の巨人になった）
    push(foes.alien, { ang: A1.ang, y: gy + 0.42 + Math.sin(core.time * 1.6) * 0.09,
                       radius: A1.radius, sx: 0.72, sy: 0.72, sz: 0.72,
                       rot: -0.4, col: [1, 1, 1], fade: 1 });
  }

  // 🌍 空の地球（月では大きく、火星では小さな点）。月からも地球からも
  //    「ここまで来た」が一目で分かるようにする。火星では月もならべる。
  {
    const depth = 40;
    const P = bgPlace(depth, moon ? -0.20 : 0.16, 0);
    const size = moon ? 3.0 : 0.58;            // 火星から見た地球は、もう小さい
    const y = core.camY + CJ_VIEW_H * (moon ? 1.02 : 1.16);
    push(scn.ground, {
      ang: P.ang, y, radius: P.radius,
      sx: size, sy: size, sz: size, rot: -1.1, col: [1, 1, 1], fade: 1,
    });
    const rs = size * 1.055;
    atmoList.push({
      ang: P.ang, y, radius: P.radius, sx: rs, sy: rs, sz: rs, rot: 0,
      col: [0.42, 0.86, 1.85], fade: 0.95,
    });
    arrivalLabel.earth = moon ? null : worldOfInst(P, y);
    arrivalLabel.moon = null;
    if (!moon) {
      // 地球のとなりに月。2D版と同じく、ならべて置く。
      const P2 = bgPlace(depth, 0.235, 0);
      const y2 = y - CJ_VIEW_H * 0.085;
      push(scn.moon, { ang: P2.ang, y: y2, radius: P2.radius,
                       sx: 0.17, sy: 0.17, sz: 0.17, rot: 0.6, col: [1, 1, 1], fade: 1 });
      arrivalLabel.moon = worldOfInst(P2, y2);
    }
  }
}

// 円筒座標のインスタンス位置 → ワールド座標（ラベルを画面に置くのに使う）
function worldOfInst(P, y) {
  return [Math.sin(P.ang) * P.radius, y, Math.cos(P.ang) * P.radius];
}

// 空の天体につける名まえ（火星の「地球」「月」）。
// ★3Dの中に字を描くのは高くつくので、DOMの字を投影した位置へ置く。
const arrivalLabel = { earth: null, moon: null };
const labEarth = document.getElementById('lab-earth');
const labMoon  = document.getElementById('lab-moon');
function updateSkyLabels() {
  for (const [el, w, dy] of [[labEarth, arrivalLabel.earth, 26], [labMoon, arrivalLabel.moon, 14]]) {
    if (!el) continue;
    const s = w && core.ending ? screenOf(w) : null;
    const on = !!s && !s.behind && Math.abs(s.x) < 1 && Math.abs(s.y) < 1;
    if (on) {
      const r = cv.getBoundingClientRect();
      el.style.left = `${r.left + (s.x * 0.5 + 0.5) * r.width}px`;
      el.style.top  = `${r.top + (0.5 - s.y * 0.5) * r.height + dy}px`;
    }
    el.classList.toggle('show', on);
  }
}

// ---------------- 街（東京のつもり）----------------
const CITY = [];
{
  const r = mulberry32(20260820);
  // ★遠景を増やす（本人の指示 2026-08-21）。72棟だと、富士山の手前が
  //   すかすかで「street が続いている」感じが出なかった。
  //   遠いビルは1棟あたりが小さいので、数を足しても重さはほとんど変わらない。
  // ★見えるのは「地平線より上に屋上が出ている」ものだけ。低いところでは
  //   手前のビルが主役、少し登ると手前は足もとへ沈んで、遠景だけが残る。
  //   だから**遠景を厚くする**のが効く（本人の指示）。
  // ★増やすのは**遠景**だけにすること。手前のビルは画面をいっぱいに覆うので、
  //   数を増やすとぬりつぶす面積がそのまま重さになる（実測で3倍になった）。
  //   本人の指示も「遠景のビル群を増やして」だった。
  for (let i = 0; i < 634; i++) {
    // ★手前をもっと近づける（本人の指示 2026-08-21）。
    //   「ビルのあいだを昇っていく」ところが序盤の見せ場なので、
    //   ここが遠いと ただの背景になる。**画面からはみ出すくらい近い棟**を混ぜる。
    //   ★ビルは bgPlace で**筒の向こうがわ**に置いてある＝足場をふさがない。
    //     だから近づけても「見えなくて落ちた」は起きない（プラン §2.2）。
    // ★近づけすぎない。26〜90mでは**壁**になって、空もすき間も消えた（実測）。
    //   見せ場は「ビルのあいだ」なので、**あいだが見えないと成立しない**。
    // ★数は少なく。画面いっぱいを覆うので、1棟あたりの塗りつぶしが そのまま重さになる
    //   （9棟・60m で 195ms → 6棟・75m で下げた。swiftshader の実測）。
    const vnear = i < 6;                               // すぐそば。てっぺんは画面の外へ
    const near  = !vnear && i < 66;                    // 手前
    const mid   = !vnear && !near && i < 254;          // 中景
    CITY.push({
      // 水平きょり(m)。遠景は 12km 先まで伸ばして、街が地平まで続いて見えるように
      D: vnear ? 75 + r() * 130 : near ? 95 + r() * 420
                                : mid ? 900 + r() * 2600 : 3200 + r() * 8800,
      H: vnear ? 130 + r() * 220 : near ? 70 + r() * 200
                                : mid ? 90 + r() * 170  : 70 + r() * 210,
      W: vnear ? 22 + r() * 26   : near ? 26 + r() * 34
                                : mid ? 30 + r() * 40   : 34 + r() * 52,
      px: r() * CJ_CIRC,
      rot: r() * 1.57,
      tone: 0.84 + r() * 0.32,
      // ★同じ色のビルばかりだと「壁紙」に見える。3種類の家族に分ける。
      fam: Math.floor(r() * 3),
    });
  }
  CITY.sort((a, b) => b.D - a.D);        // 遠いものから描く
}
// 🗼 スカイツリー：634m、8km 先
// 🗼 スカイツリー：634m。★遠くに置くと「爪ようじ」にしか見えない。
//   本物は根もと68mだが、8km先だと画面で1〜2pxの縦線になる。
//   街のはずれ（3km）に置いて、根もとも少し太らせて、塔として読ませる。
const SKYTREE = { D: 3000, H: 634, W: 105, px: CJ_CIRC * 0.30 };
// 🗻 富士山
//  ★実物どおりでは、この画面では絶対に大きくならない。
//    本物は 3776m・100km 先＝見こみ角 0.038rad。縦の画角は 1.16rad なので
//    画面の高さの3%しかない。しかも横は 0.38rad ＝ 画面の横幅（0.34rad）より広い。
//    **横は画面からはみ出すのに、縦はぺったんこ**＝「平たい灰色のくさび」になる。
//  ★だから、距離を寄せたうえで**裾を実物より狭く（＝斜面を急に）**する。
//    見なれた「富士山の絵」は、写真よりも急な山になっている。そちらに合わせる。
//  ★lateral は 0 に近いとチッチの真後ろに来て、山頂が隠れる。左へよける。
//    lateral は **＋（右）**にする。チッチは登るほど画面の左へ寄っていく
//    （climb.py で x が 0.00→-0.72）ので、左に置くと山頂がずっと隠れる。
const FUJI = { D: 36000, H: 3776, W: 16000, lateral: 0.10 };

// ビルの色の家族。ガラス（青みの濃いの）／白いコンクリ／ベージュ。
const BUILDING_FAM = [
  [0.62, 0.72, 0.88],   // ガラス張り。空をうつして青い
  [1.02, 1.02, 1.04],   // 白いコンクリ
  [1.00, 0.92, 0.80],   // ベージュ・タイル
];

// 🌈 レリックの色。柱の色とアイコンで、何が手に入るかを見せる。
const PILLAR_COL = {
  star2:      [1.6, 1.3, 0.35],
  wide:       [0.9, 1.5, 1.6],
  ice2spring: [0.6, 1.2, 1.7],
  noFoe:      [1.5, 1.5, 1.5],
  dive:       [1.5, 0.8, 1.5],
  softBreak:  [1.5, 1.0, 0.6],
};

const scnList = [], ringList = [], planeList = [], atmoList = [], cometList = [], jumboList = [];
const meteorList = [], debrisList = [];
const scnBatch = [];      // 同じメッシュをまとめて描くための入れもの（毎フレーム使いまわす）
let earthDot = null;      // 🔵 いまの地球の点（さわれるように場所を覚えておく）

function buildScenery() {
  scnList.length = 0; ringList.length = 0; planeList.length = 0; atmoList.length = 0;
  cometList.length = 0; jumboList.length = 0;
  meteorList.length = 0; debrisList.length = 0;
  pushMeteors(); pushDebris();
  pushJumbo();                 // ✈️ かすめて飛ぶジャンボ（出ているときだけ）
  const m = viewProgress();      // 🎬 エンディング中は巻きもどした値で描く
  const h = altM();
  const dip = horizonDip(h);
  const push = (prop, o) => scnList.push(Object.assign({ prop }, o));

  // ---- 🌍 地面 ----
  // 高度で2つを使い分け、あいだで受けわたす。
  //   低い（〜2万m） … 平らな円ばん。丸みはどうせ見えない。
  //   高い（1万m〜）  … 地球の球。角の半径 alpha = asin(R/(R+h))。
  //
  // ★低いところで球を使ってはいけない。ワールド半径150の球だと、
  //   高度60mではカメラが球の面に乗ってしまい、地面が真横から見た
  //   薄い帯になって下が黒く抜ける（実際にそうなった）。
  {
    // 🚨 ここは一度こわした。**目の高さのすぐ下（0.36）に半径330の板を置いていた**ので、
    //    画面の下半分がまるごと地面になり、チッチが地面に埋もれて見えた。
    //    平らな面は、どれだけ遠くに置いても「地平線まで埋まる」。
    //    だから距離ではなく **見込み角** で決める。
    //      板を目の下 Dg に置き、半径を Dg×tan(θ) にすると、
    //      板のふちがちょうど「真下から θ 傾いたところ」に来る。
    //      画面の下のはしは -0.75rad（見おろし0.17＋縦の画角0.58）なので、
    //      θ が 0.82 より小さいうちは画面に入らない＝低いところでは空しか映らない。
    //    元の2Dのチッチジャンプも、地上では空とビルだけ。それにそろえる。
    // 平らな地面 → 地球の球 の受けわたし。
    // ★実際の写真だと、地平線が丸く見えはじめるのは高度2万m あたりから。
    //   10万m（カーマンライン）では、もう「地球のふち」の絵になっている。
    // ★平らな地図は 10万m でもまだ正しい（地平線が丸く見えるだけ）。
    //   球に渡すのは「地球のふちが1枚の絵に収まる」20万m あたりから。
    // ★地図は早く出す。地平線を作っているのは地図なので、これが無いと
    //   「地面が無いのに富士山とビルだけ空に浮いている」絵になる（実際そうなった）。
    //   公園の芝生は近くだけを受けもち、その外がわは地図が引きうける。
    const flatF  = smoothstep(60, 220, h) * (1 - smoothstep(90000, 220000, h));
    const globeF = smoothstep(120000, 300000, h) * (1 - smoothstep(2500, 3000, m));
    if (flatF > 0.02) {
      const Dg = 40;                                   // 目の高さから板までの距離
      // ★大きさは「地平線がどこに見えるか」から決める。
      //   高度 h から見た地平線は、水平から dip だけ下がったところ。
      //   板のふちがちょうどそこに来る大きさは Dg / tan(dip)。
      //   ここを勝手な見込み角で決めていたせいで、地面のふちが地平線より
      //   下に来て、富士山とビルだけ空に浮いていた。
      const Rg = Dg / Math.tan(Math.max(dip, 0.0035));
      push(scn.flat, {
        ang: cjAngle(core.camPx), y: eyeY() - Dg, radius: CAM_AXIS,
        sx: Rg, sy: 1, sz: Rg, rot: -0.6,
        col: [1, 1, 1], fade: flatF,
      });
    }
    if (globeF > 0.02) {
      const D_E = 150;                            // 中心をカメラの真下、この距離に置く
      const alpha = Math.asin(clamp(R_EARTH_M / (R_EARTH_M + h), -1, 1));
      const r = D_E * Math.sin(alpha);
      push(scn.ground, {
        ang: cjAngle(core.camPx), y: eyeY() - D_E, radius: CAM_AXIS,
        sx: r, sy: r, sz: r,
        rot: -1.1 + m * 0.00002,
        col: [1, 1, 1], fade: globeF,
      });
      // 🌏 大気の層。地球のふちが青く光る、あの帯。
      // 低いところほど分厚く見える（すぐ上に空気があるから）。
      // ★カメラは中心から D_E のところにいる。からを厚くしすぎると
      //   カメラがからの内がわに入ってしまい、裏面カリングで丸ごと消える
      //   （実際、低いところで大気がまったく出なかった）。
      //   すき間（D_E − r）の半分までしか厚くしない。
      const rs = r + Math.min(r * 0.055, (D_E - r) * 0.5);
      atmoList.push({
        ang: cjAngle(core.camPx), y: eyeY() - D_E, radius: CAM_AXIS,
        sx: rs, sy: rs, sz: rs, rot: 0,
        col: [0.42, 0.86, 1.85], fade: globeF * 0.95,
      });
    }
  }

  // ---- 🌙 到着シーン（月・火星）----
  // ★2D版と同じ絵をそろえる：月面・空に大きな地球・うさぎのお餅つき・旗。
  if (core.ending) {
    buildArrival(push);
    return;                       // 到着のあいだは、ふだんの風景は描かない
  }

  // ---- 🛑 ヘリオポーズの壁 ----
  // 近づくと上に光る膜が見えてきて、突きぬけると足もとへ流れ去る。
  {
    const dp = core.progress - CJ_HELIO_P;
    if (dp > -900 && dp < 500) {
      // 壁のワールド高さ（そこに着いたときのカメラの高さ）
      const wallY = cjRawFromProgress(CJ_HELIO_P) / CJ_M_PER_WORLD + CJ_SCROLL_OFF;
      const f = (1 - smoothstep(300, 500, Math.abs(dp))) * 0.9;
      if (f > 0.02) {
        push(scn.helioWall, {
          ang: cjAngle(core.camPx), y: wallY, radius: 0,
          sx: 150, sy: 1, sz: 150, rot: core.time * 0.02,
          col: [1, 1, 1], fade: f,
        });
      }
    }
  }

  // ---- 🌳 はじまりの公園 ----
  buildPark(push, h);

  // ---- 🏢 街 ----
  // 地平線の下に沈んだら自動で消える。高度で手当てする必要はない。
  for (const b of CITY) {
    // ★横の画角は ±0.17rad しかない。latPx は ±0.41rad まで返すので、
    //   そのまま描くと**画面の外のビルを6割ちかく描いていた**（実測で3倍重かった）。
    const lat = latPx(b.px, 0.055);
    if (Math.abs(lat) > 0.22) continue;
    const base = groundView(h, b.D, 0);
    const top  = groundView(h, b.D, b.H);
    if (top.elev < -dip - 0.02) continue;        // 屋上まで地平線の下＝もう見えない
    // 奥ゆきは重なり順のためだけ。CAM_AXIS より手前には置けないので下限をとる。
    const depth = 14 + (b.D / 4200) * 34;
    const hw = sizeAt(b.H, base.distM, depth);
    if (hw < 0.02) continue;                     // 小さすぎる＝描かない
    const w = sizeAt(b.W, base.distM, depth);
    const far = clamp((b.D - 120) / 4000, 0, 1);
    const k = b.tone * lerp(1.0, 0.86, far);
    const fam = BUILDING_FAM[b.fam];
    // ★遠いビルは**暗く**なるのではなく、空気にとけて**明るく青く**なる。
    //   暗くすると、地平線に黒い棒がならんだように見えて、街に見えない。
    //   富士山（同じく遠くのもの）と同じ方向へそろえる。
    //   ★色は「頂点の色 × ここで渡す色」なので、空の色をそのまま渡すと暗くなる。
    //     頂点側が平均0.55くらいなので、1.8倍ほどにしてやっと空になじむ。
    const haze = smoothstep(900, 9000, b.D) * 0.70;
    const HZ = [1.14, 1.32, 1.64];
    const P = bgPlace(depth, lat, base.elev);
    // 小さくしか映らないものは軽いメッシュで描く。CITY は遠い順なので、
    // 軽いほうが先にかたまって並ぶ＝まとめ描きが効く。
    // 🚨 遠景の判定に hw（その奥ゆきでの world の大きさ）を使ってはいけない。
    //    depth は距離とともに増えるので、hw は遠くなってもほとんど小さくならない。
    //    **見こみ角**（実物の高さ ÷ 実きょり）で決めること。縦の画角は 1.16rad。
    const ang = b.H / base.distM;                 // 0.030 ≒ 画面で37px
    push(ang < 0.030 ? scn.buildingFar : scn.building, {
      ang: P.ang, y: P.y, radius: P.radius,
      sx: w, sy: hw, sz: w,
      rot: b.rot,
      col: [lerp(k * fam[0], HZ[0], haze),
            lerp(k * fam[1], HZ[1], haze),
            lerp(k * fam[2], HZ[2], haze)], fade: 1,
    });
  }

  // ---- 🗼 スカイツリー ----
  {
    const base = groundView(h, SKYTREE.D, 0);
    const top  = groundView(h, SKYTREE.D, SKYTREE.H);
    if (top.elev > -dip - 0.02) {
      const depth = 58;
      const hw = sizeAt(SKYTREE.H, base.distM, depth);
      if (hw > 0.03) {
        const P = bgPlace(depth, latPx(SKYTREE.px, 0.030), base.elev);
        // 高いところへ行くと、街ごと もや に溶ける
        const fade = 1 - smoothstep(2500, 9000, h);
        if (fade > 0.02) push(scn.skytree, {
          ang: P.ang, y: P.y, radius: P.radius,
          sx: hw * 1.35, sy: hw, sz: hw * 1.35, rot: 0,
          col: [0.92, 0.95, 1.06], fade,
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
      const depth = 92;
      const hw = sizeAt(FUJI.H, base.distM, depth);
      if (hw > 0.04) {
        const w = sizeAt(FUJI.W, base.distM, depth) * 0.5;
        const P = bgPlace(depth, FUJI.lateral, base.elev);
        push(scn.fuji, {
          ang: P.ang, y: P.y, radius: P.radius,
          sx: w, sy: hw, sz: w, rot: 0,
          col: [1, 1, 1], fade: 1,
        });
      }
    }
  }

  // ☀️ 富士山に沈む太陽は**置かない**（本人の指示 2026-08-21）。
  //   序盤の主役は「街のあいだを登っていく」ことと、その向こうの富士山。
  //   夕日を足すと、そこへ目が行って、登る先が読みにくくなる。

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
    const depth = 40;
    const P = bgPlace(depth, side * 0.24, 0);
    const y = core.camY + CJ_VIEW_H * lerp(1.15, -0.55, t);
    push(prop, { ang: P.ang, y, radius: P.radius, sx: size, sy: size, sz: size,
                 rot: core.time * 0.03 + side, col: [1, 1, 1], fade: f });
    if (ring) {
      ringList.push({ prop: ring, ang: P.ang, y, radius: P.radius,
                      sx: size, sy: size, sz: size,
                      rot: core.time * 0.03 + side, col: [1, 1, 1], fade: f });
    }
  }

  // ---- ☄️ 彗星の群れ（プラン §6.4）----
  //  ★背景シェーダではなく「もの」として置く。彗星は動くから。
  //  ★奥ゆきちがいに4つ置くと、登るにつれて手前と奥がちがう速さで流れる
  //    （視差）。これだけで空に**奥ゆき**が出る。
  {
    const amt = cometAmount();
    if (amt > 0.02) {
      for (let i = 0; i < CJ_COMETS.length; i++) {
        const [lat, depth, size, sp, kind] = CJ_COMETS[i];
        // ゆっくり下へ流れて、端まで行ったらまた上から。
        const ph = ((core.time * sp + i * 0.41) % 1 + 1) % 1;
        // ★出入りの端は必ず消してから回すこと。消さないと、画面のまん中で
        //   ぽんと消えてぽんと出る（前に富士山で同じ失敗をした）。
        const edge = smoothstep(0, 0.10, ph) * (1 - smoothstep(0.88, 1, ph));
        if (edge <= 0.02) continue;
        // 上の画角の外から入って、下の画角の外へ抜ける（画面を横切らせる）
        const P = bgPlace(depth, lat, lerp(0.50, -0.72, ph));
        cometList.push({
          prop: [scn.comet0, scn.comet1, scn.comet2][kind],
          ang: P.ang, y: P.y, radius: P.radius,
          sx: size, sy: size, sz: size,
          // Y軸まわりの回転＝しっぽが手前/奥へ寝る＝見かけの長さが変わる
          rot: 0.5 + i * 1.3, col: [1, 1, 1], fade: amt * edge,
        });
      }
    }
  }

  // ---- 🔵 地球の青い点 ----
  // ★何光年行っても、1pxで残す（プラン §3.7）。
  //   帰る場所が画面から消えたら、「遠くまで来た」も測れなくなる。
  if (m > 2600) {
    const depth = 40;
    const P = bgPlace(depth, 0.30, 0.15);
    const km = Math.max(core.dist.km, 1);
    // ★下限を小さくしすぎない。0.028 だと 0.4px になって、実際には消える。
    //   1〜2px の点として必ず残るところで止める。
    const size = clamp(2.2 * (384400 / km), 0.16, 2.2);
    const y = core.camY + CJ_VIEW_H * 0.92;
    push(scn.ground, {
      ang: P.ang, y, radius: P.radius,
      sx: size, sy: size, sz: size, rot: -1.1, col: [1.15, 1.15, 1.25], fade: 1,
    });
    earthDot = { w: [Math.sin(P.ang) * P.radius, y, Math.cos(P.ang) * P.radius], size };
  } else {
    earthDot = null;
  }

  // ---- 🌍 実寸の比較ゴースト（プラン §5.1）----
  // 木星のとなりに、地球を11個ならべる。**文字での説明はしない。**
  {
    const f = smoothstep(6900, 7300, m) * (1 - smoothstep(8100, 8500, m));
    if (f > 0.02) {
      const depth = 40;
      const jup = 1.6 + (6.4 - 1.6) * Math.sin(clamp((m - 6600) / 2000, 0, 1) * Math.PI);
      const e = jup / 11;                       // 木星は地球11個ぶん（本当の比）
      // ★木星と同じ奥ゆきに置くと、深度が同じで描かれない（実際に消えた）。
      //   少し手前・少し横にずらして、木星の下にならべる。
      // ★木星のとなりではなく、**暗いところ**にならべる。
      //   木星の上に重ねると、模様にまぎれて数えられない。
      //   数えられなければ「11個」は伝わらない。
      // ★大事なのは「ならべた11個の幅が、木星の直径とぴったり同じ」こと。
      //   そこが合っていないと、ただ地球が11個ならんでいるだけの絵になる。
      //   木星の見かけの半径は jup/depth[rad]。地球1個はその 1/11。
      const dep2 = 26;
      const ang1 = (jup / depth) / 11;          // 地球1個の見かけの半径[rad]
      const es = ang1 * dep2;                   // その大きさになる world 半径
      for (let i = 0; i < 11; i++) {
        const P = bgPlace(dep2, (i - 5) * ang1 * 2, 0);
        // ★木星の「下」に置く。木星は上から下へ降りてくるので、固定の高さだと
        //   途中で重なって、数珠つなぎが模様にまぎれて数えられなくなる。
        const jt = clamp((m - 6600) / 2000, 0, 1);
        const jupY = core.camY + CJ_VIEW_H * lerp(1.15, -0.55, jt);
        push(scn.ground, {
          ang: P.ang, y: jupY - jup * 1.45, radius: P.radius,
          sx: es, sy: es, sz: es, rot: -1.1,
          col: [1.45, 1.45, 1.55], fade: f * 0.95,
        });
      }
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
        const depth = 46 + i * 16;
        const cross = ((core.time * 0.05 + i * 0.37) % 1) * 2 - 1;
        const sz = sizeAt(60, v.distM, depth) * 3.2;   // 60m級。少し大きめに見せる
        const P = bgPlace(depth, dir * cross * 0.30, v.elev);
        planeList.push({
          ang: P.ang, y: P.y + Math.sin(core.time * 0.5 + i) * 0.10,
          radius: P.radius,
          sx: sz, sy: sz, sz: sz,
          rot: dir > 0 ? 0 : Math.PI,
          col: [1, 1, 1], fade: planeF,
        });
      }
    }
  }
}

// ============================================================
//  ✈️ ジャンボが かすめて飛んでいく（高度およそ1万m）
//
//   ★CJ_ANCHORS の [500, 10km, 'ヒコーキの高さ'] とちょうど同じ場所。
//     ここは**ジェット気流**が吹いている高さでもある（core.js の cjJetWind）。
//     だからジャンボは**風と同じ 西→東**へ飛ばす。追い風に乗って早く着く、が本当。
//   ★1回のプレイで1度だけ。何度も通ると、ただの背景になってしまう。
// ============================================================
const JUMBO_AT = 470;          // ここを通りすぎたら飛ばす
const JUMBO_SEC = 5.6;         // 遠くから、頭の上をこえるまで
let jumbo = null;              // { t }
function updateJumbo(dt) {
  if (!jumbo) {
    if (running && !core.jumboDone && core.progress > JUMBO_AT && core.progress < JUMBO_AT + 260) {
      core.jumboDone = true;
      jumbo = { t: 0 };
      Snd.play('jumbo');
    }
    return;
  }
  jumbo.t += dt;
  // いちばん近づくとき（まん中）に、後流でカメラが少しゆれる
  const k = jumbo.t / JUMBO_SEC;
  if (!jumbo.shook && k > 0.52) { jumbo.shook = true; R.addTrauma(0.30); }
  if (k >= 1) jumbo = null;
}
// ✈️ 遠くから**こちらへ向かって**飛んでくる（本人の指示 2026-08-21）。
//   横切らせるより、正面から来て、頭の上をかすめて抜けていくほうが近い。
//   ★機首は「実際に進む向き」から計算する。手で角度を書くと、
//     軌道を変えたとたんに**しっぽから飛ぶ**（実際にそうなった）。
// 向きの合わせしろ。
// 🚨 **見わけかたを決めておくこと。**「なんとなく飛行機に見える」で決めると必ず外す
//    （2回まちがえて、2回とも本人に「後ろ向き」と指摘された）。
//    ジャンボは**二階席のこぶが機首寄り**にある。だから
//    **こぶが垂直尾翼より手前に見えていれば、こちらを向いている。**
//    尾翼がまるごと大きく見えているときは、うしろ姿。
let JUMBO_ROT_OFF = Math.PI;
// 🚨 **軌道を曲げてはいけない。**（本人「近くに来たらドリフトしてバックで飛ぶ」）
//   本物の飛行機は、すぐそばを通るときも**まっすぐ飛んでいる**。
//   見かけの角度がぐんぐん変わるのは遠近のせいで、**機体は向きを変えない**。
//   ここを「見こみ角で曲がる道」にしたら、近づいたところで機首がぐるんと回って
//   「ドリフトしながらバックで飛ぶ」ように見えた。
//   → **3次元の直線**にして、機首の角度は**その直線の向き（＝ずっと同じ）**にする。
//
//   カメラから見て：d＝前方向のきょり／x＝横／up＝高さ（どれも world）
const JUMBO_P0 = { d: 96, x: 1.5, up: 0.8 };    // 遠く、ほぼ正面、少し上
// ★上へ逃がしすぎないこと。いちばん大きく見える前に画面から出てしまう。
//   横 ±0.17rad・上 +0.41rad の画角に、ぎりぎりまで残す寸法にしてある。
const JUMBO_P1 = { d: -10, x: 3.5, up: 7.0 };   // 頭の上をこえて、うしろへ
function jumboPath(k) {
  const d  = lerp(JUMBO_P0.d,  JUMBO_P1.d,  k);
  const x  = lerp(JUMBO_P0.x,  JUMBO_P1.x,  k);
  const up = lerp(JUMBO_P0.up, JUMBO_P1.up, k);
  // camPlace の elev は「角度」なので、高さ÷きょり で直す
  return { d, x, e: Math.atan2(up, Math.max(d, 0.5)) };
}
// 機首の向きは**1回だけ**決める（直線なので、ずっと同じ）
const JUMBO_ROT = Math.atan2(JUMBO_P1.d - JUMBO_P0.d, JUMBO_P1.x - JUMBO_P0.x);

function pushJumbo() {
  if (!jumbo) return;
  const k = clamp(jumbo.t / JUMBO_SEC, 0, 1);
  const a = jumboPath(k);
  if (a.d < 6) return;                 // 真横まで来たら、もう描かない（画面の外）
  const P = camPlace(a.d, a.x, a.e);
  const sz = 3.4;                      // 大きさは一定。近づけば遠近が大きくしてくれる
  jumboList.push({
    ang: P.ang, y: P.y, radius: P.radius,
    sx: sz, sy: sz, sz: sz, rot: JUMBO_ROT + JUMBO_ROT_OFF,
    col: [1, 1, 1], fade: 1,
  });
}

// ============================================================
//  🌠 流れ星（プラン §6.5）と 🪨 目の前を横切る岩（プラン §6.1 の L4）
//
//   ★どちらも**まん中には出さない**。プランの決めごと「近景L4がプレイヤーを
//     隠さない」「画面中央±35%のセーフ回廊には近景物を置かない」を守る。
//     見えなかったから落ちた、が この遊びの最悪の事故。
//   ★どちらも決まった式で動かす（乱数で毎フレーム作らない）。
//     同じところに同じものが出るので、目で追える。
// ============================================================
// ★出す高さは、本物に合わせる。**流れ星が光るのは高度100kmくらい**＝
//   ちょうどカーマンライン（progress 1,000）のあたり。そこを通るとき、
//   チッチは流れ星と**同じ高さ**にいる。だから小さく遠くではなく、近くを走らせる。
const CJ_METEOR_FROM = 600, CJ_METEOR_TO = 2000;
const METEORS = [
  // [周期(秒), 位相, 奥ゆき, 高さの角度, 大きさ]
  //  ★遠くに小さく置くと、青い空では白い点にしかならない（実測）。近くを大きく。
  [ 9.0, 0.00, 20, 0.26, 11.0],
  [14.0, 0.42, 30, 0.38, 15.0],
  [22.0, 0.71, 42, 0.16, 19.0],
];
function pushMeteors() {
  const m = viewProgress();
  const amt = smoothstep(CJ_METEOR_FROM, CJ_METEOR_FROM + 180, m) *
              (1 - smoothstep(CJ_METEOR_TO - 300, CJ_METEOR_TO, m));
  if (amt < 0.02) return;
  for (let i = 0; i < METEORS.length; i++) {
    const [per, ph, depth, elev, sz] = METEORS[i];
    const k = ((core.time / per + ph) % 1 + 1) % 1;
    if (k > 0.22) continue;                     // 出ているのは、周期のうちのほんの少し
    const t = k / 0.22;                         // 0→1 で流れきる
    // 左上から右下へ。まん中は通らせない（上のほうを横切る）
    const lat = lerp(-0.16, 0.16, t);
    const P = camPlace(depth, lat * depth, elev - t * 0.10);
    const fade = amt * Math.sin(t * Math.PI);   // 出はじめと消えぎわは うすく
    meteorList.push({
      ang: P.ang, y: P.y, radius: P.radius,
      sx: sz, sy: sz, sz: sz,
      // 🚨 `iRot` は **Y軸まわり**。π/2 にすると、しっぽが画面の奥へ向いて
      //    ただの丸い光になる（実測でそうなった）。0 で横に寝る＝すじに見える。
      // ★0 だと しっぽから飛ぶ（頭が左・しっぽが右で、動くのは右）。π で頭が先。
      rot: Math.PI,
      col: [1, 1, 1], fade,
    });
  }
}

// 🪨 近景の岩。宇宙に出てから、画面の**はし**をゆっくり流れる。
const DEBRIS = [
  // [周期(秒), 位相, 奥ゆき, 横（±のどちら側か）, 大きさ]
  [13.0, 0.10, 7.5, -1, 1.5],
  [19.0, 0.55, 9.5,  1, 1.9],
  [27.0, 0.80, 6.0, -1, 1.1],
];
function pushDebris() {
  const m = viewProgress();
  // 小惑星帯（6,500）から先。深宇宙でもずっと少し出る。
  const amt = smoothstep(6000, 7200, m);
  if (amt < 0.02) return;
  for (const [per, ph, depth, side, sz] of DEBRIS) {
    const k = ((core.time / per + ph) % 1 + 1) % 1;
    // 上から下へ落ちてくる（登っているので、下へ流れて見える）
    const elev = lerp(0.42, -0.55, k);
    // ★横は 0.22〜0.30rad。画角のはし（0.17）より外から、かすめる程度に入れる。
    const lat = side * (0.20 + 0.06 * Math.sin(core.time * 0.4 + ph * 9));
    const P = camPlace(depth, lat * depth, elev);
    const fade = amt * smoothstep(0, 0.08, k) * (1 - smoothstep(0.90, 1, k));
    if (fade < 0.02) continue;
    debrisList.push({
      ang: P.ang, y: P.y, radius: P.radius,
      sx: sz, sy: sz, sz: sz,
      rot: core.time * 0.5 + ph * 6,
      col: [1, 1, 1], fade,
    });
  }
}

// ---------------- ✨ 中景の塵 ----------------
// ★宇宙で「進んでいる感じ」を作るのは、遠景ではなく中景。
//   星や銀河はどれだけ登っても動かない（遠すぎるから）。
//   そのかわり、目の前を塵が高速で流れていく。
//   こんなに流れているのに景色が変わらない ＝ 宇宙の広さの体感になる。
//
//  ★まん中には出さない。チッチと次の足場は、何にも隠されてはいけない。
let dustAcc = 0, trailAcc = 0;
let hidePlatsFlag = false;    // 測定用：足場を描かない
let lookAhead = 0, lookAheadV = 0;   // 👀 先読みのパン量
function spaceDust(dt) {
  // 惑星のあいだ（火星の先）からうっすら、深宇宙では biome ごとの濃さで。
  const amt = Math.max(core.biome.dustAmt, smoothstep(5200, 9000, core.progress) * 0.35);
  if (amt <= 0.01) return;
  const col = core.biome.dustAmt > 0.01 ? core.biome.dustCol : [0.72, 0.78, 0.95];
  dustAcc += amt * 26 * dt;
  const n = Math.floor(dustAcc);
  dustAcc -= n;
  for (let i = 0; i < n; i++) {
    const depth = 4.5 + Math.random() * 11;
    // 横は、まん中（±0.16）をよけて置く
    const side = Math.random() < 0.5 ? -1 : 1;
    const lat = side * (0.17 + Math.random() * 0.42);
    // 画面の上のふちのすぐ外から出す（急にわいて見えないように）。
    // 縦の画角は 1.16rad なので、上のふちは 0.58rad のところ。
    const P = camPlace(depth, lat * depth, 0.60 + Math.random() * 0.10);
    const k = 0.55 + Math.random() * 0.65;
    R.spawn({
      x: Math.sin(P.ang) * P.radius, y: P.y, z: Math.cos(P.ang) * P.radius,
      // ★ヘリオポーズが近づくと、太陽風の粒が急に減速して滞る（予兆）
      vy: -(5.5 + Math.random() * 7.5) * (1 - helioNear * 0.88), vx: 0, vz: 0,
      life: clamp(depth * 0.15, 0.9, 2.3) * (0.8 + Math.random() * 0.5),
      size: 0.030 + Math.random() * 0.045,
      kind: 1, drag: 0, g: 0,
      col: [col[0] * k, col[1] * k, col[2] * k],
    });
  }
}

// 空のもの（無限に遠い向き）が、画面のどこに映るか。
// -1..+1 が画面のなか。★「たぶん映っている」と言わずに、数で確かめるために置く。
function skyScreen(d) {
  const v = R.view, pr = R.proj;
  if (!v) return null;
  const vx = v[0] * d[0] + v[4] * d[1] + v[8]  * d[2];
  const vy = v[1] * d[0] + v[5] * d[1] + v[9]  * d[2];
  const vz = v[2] * d[0] + v[6] * d[1] + v[10] * d[2];
  const w = -vz;
  if (w <= 1e-6) return { x: 99, y: 99, behind: true };
  return { x: (pr[0] * vx) / w, y: (pr[5] * vy) / w, behind: false };
}

// ワールドの1点が画面のどこに映るか（-1..+1 が画面のなか）。確認用。
function screenOf(p) {
  const v = R.view, pr = R.proj;
  if (!v) return null;
  const vx = v[0]*p[0] + v[4]*p[1] + v[8] *p[2] + v[12];
  const vy = v[1]*p[0] + v[5]*p[1] + v[9] *p[2] + v[13];
  const vz = v[2]*p[0] + v[6]*p[1] + v[10]*p[2] + v[14];
  const w = -vz;
  if (w <= 1e-6) return { x: 99, y: 99, behind: true };
  return { x: (pr[0] * vx) / w, y: (pr[5] * vy) / w, behind: false };
}

// ---------------- 🧭 次に乗る足場の向き ----------------
//  ★バネで一気に上がると、次の足場がタワーの裏がわに行ってしまい
//    「どっちへ寄ればいいのか」が分からなくなる（本人の指摘）。
//    そこで、画面の外にあるときだけ、はしに向きを出す。
//  ★見えているときは何も出さない。見れば分かることを教えると、
//    見る力を育てるどころか奪ってしまう。
const navEl = document.getElementById('nav');
let navShown = false;

// いま向かうべき足場。上がっているなら「上の いちばん近いもの」、
// 落ちているなら「下の いちばん近いもの」。
function navTarget() {
  const p = core.player;
  let best = null;
  if (p.vy >= 0) {
    for (const pl of core.platforms) {
      if (pl.used || pl.y <= p.y + 0.4) continue;
      if (!best || pl.y < best.y) best = pl;
    }
  }
  if (!best) {
    for (const pl of core.platforms) {
      if (pl.used || pl.y > p.y - 0.1) continue;
      if (!best || pl.y > best.y) best = pl;
    }
  }
  return best;
}

function updateNav() {
  if (!navEl) return;
  let show = false, nx = 0, ny = 0, rot = 0;
  const t = running && !intro ? navTarget() : null;
  if (t) {
    const s = screenOf(worldAt(t.px, t.y + CJ_PLAT_H, 0));
    // タワーの裏がわ（カメラの後ろ）は、円周の近いほうの向きで左右を決める
    const behind = !s || s.behind;
    const x = behind ? (cjWrapDelta(t.px, core.camPx) > 0 ? 3 : -3) : s.x;
    const y = behind ? 0 : s.y;
    if (Math.abs(x) > 0.60 || y > 1.0) {
      show = true;
      const k = Math.max(Math.abs(x) / 0.80, Math.abs(y) / 0.84, 1e-3);
      nx = x / k; ny = y / k;
      rot = Math.atan2(-y, x) * 180 / Math.PI;   // 画面は上が＋、CSSは下が＋
    }
  }
  if (show) {
    navEl.style.left = `${(nx * 0.5 + 0.5) * 100}%`;
    navEl.style.top  = `${(0.5 - ny * 0.5) * 100}%`;
    navEl.querySelector('b').style.transform = `translateX(2px) rotate(${rot.toFixed(1)}deg)`;
  }
  if (show !== navShown) { navEl.classList.toggle('show', show); navShown = show; }
}

// ============================================================
//  ✉️ 父から息子への手紙（プラン §5.6 最後の1つ）
//
//   アンドロメダ銀河（250万光年）に着いた、その一度だけ。
//   ★これは私が書いた文ではない。本人の言葉を、画面の幅に合わせて
//     区切っただけ。**言いまわしを勝手に整えないこと。**
//   ★署名はしない（プラン §5.6 の線引き (b)）。
//   ★勉強の話はしない（同 (c)）。
//   さわるたびに1枚ずつ進む。読む速さは、読む人が決める。
// ============================================================
const LETTER = [
  ['ここまで来（き）たね。'],
  ['さっきの、青（あお）い点（てん）。'],
  ['小（ちい）さな星（ほし）の、', '小さな島（しま）。'],
  ['なやみは、ぜんぶ', 'あそこで 起（お）きる。'],
  ['まだ来ていない 先（さき）のこと。', 'もう変（か）えられない 前（まえ）のこと。'],
  ['たいていは、', '時間（じかん）が かたづけてくれる。'],
  ['きみにできるのは、', 'いまを 一生（いっしょう）けんめい やることだけ。'],
  ['一生けんめい やっていたら、', '悪（わる）いほうへは 行（い）かない。'],
  ['人（ひと）に会（あ）ったら、', 'ニコッと わらって あいさつ。'],
  ['悪かったなぁと 思（おも）ったら、', '心（こころ）から あやまる。'],
  ['なにかしてもらったら、', 'ありがとう。'],
  ['それが できたら、', '生（い）きていくのに 何（なに）も こまらない。'],
  ['いまを、後悔（こうかい）のないように。', '心に 火（ひ）を ともして。'],
  ['立派（りっぱ）な人に なってほしい。'],
  ['何が立派かは、', '自分（じぶん）で 考（かんが）えなさい。'],
];
let letter = null;         // { i }
const letterEl = document.getElementById('letter');
// ★手紙のあいだは、画面から**数字とボタンを全部消す**。
//   #strip / #items / #topbar / #unitup / #voyline は #hud の子ではないので、
//   hud を薄くするだけでは残る。実際、父の言葉のとなりで7桁のスコアが光っていた。
//   このゲームで唯一「点にしてはいけない場面」なので、ここは徹底する。
const LETTER_HIDE = ['hud', 'strip', 'items', 'topbar', 'unitup', 'voyline', 'nav'];
function letterChrome(hide) {
  for (const id of LETTER_HIDE) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hide', hide);
  }
}
function startLetter() {
  letter = { i: 0 };
  running = false;
  letterChrome(true);
  Snd.hush(2.0);
  drawLetter();
}
function drawLetter() {
  if (!letterEl) return;
  const page = LETTER[letter.i];
  letterEl.innerHTML = page.map(x => `<p>${x}</p>`).join('') +
    `<span class="letter-next">${letter.i < LETTER.length - 1 ? '▸ さわる' : '▸ おわり'}</span>`;
  letterEl.classList.add('show');
}
// ★手紙は画面をぜんぶ覆うので、canvas のタップが届かない。
//   手紙そのものが、さわられたら1枚すすむ。
if (letterEl) letterEl.addEventListener('pointerdown', e => { e.preventDefault(); nextLetter(); });

function nextLetter() {
  if (!letter) return;
  letter.i++;
  if (letter.i >= LETTER.length) {
    // ★読み終わってすぐ空中へ戻さない（落ちて死ぬ）。
    //   静かに暗くして、そのままこの回を終える。
    letter = null;
    letterEl.classList.add('fade');
    setTimeout(() => {
      letterEl.classList.remove('show', 'fade');
      letterChrome(false);
      core.over = true;
      finishRun();
      showOverlay('over');
    }, 2500);
    return;
  }
  drawLetter();
}

// ============================================================
//  🐦 2匹目のチッチ（プラン §5.6）
//   ★説明を一切出さない。ある日から、小さいのが後ろをついてくる。
//     兄弟は自分で気づく。気づいたときに、それは兄弟のものになる。
//   一度でもボイジャーまで行った人にだけ現れる。
// ============================================================
const buddyOn = () => bestMark && bestMark.p >= CJ_VOYAGER_P;
const buddyTrail = [];        // 少し前の居場所をためて、遅れてついてこさせる
function updateBuddy() {
  if (!buddyOn() || !running || core.ending) { buddyTrail.length = 0; return; }
  buddyTrail.push({ px: core.player.px, y: core.player.y });
  if (buddyTrail.length > 22) buddyTrail.shift();
}
function drawBuddy(cModel) {
  if (!buddyOn() || buddyTrail.length < 22) return;
  const b = buddyTrail[0];
  const a = cjAngle(b.px);
  const r = CJ_RADIUS + CHICCHI_FRONT * 0.6;
  const m = M4.compose(
    [Math.sin(a) * r, b.y, Math.cos(a) * r],
    [0, -a + Math.PI, 0],
    [CJ_PLAYER_H * 0.58, CJ_PLAYER_H * 0.58, CJ_PLAYER_H * 0.58]);
  R.drawChicchi(chicchiSkin, rig, faceTex, m, 0);
}

// ============================================================
//  📶 通ってきた天体の帯（プラン §3.7）
//   ★常設のUIはこれ1本だけにする。数字を増やさない。
//     下から順に灯っていくのを見れば、どこまで来たかが分かる。
// ============================================================
const stripEl = document.getElementById('strip');
const stripMe = document.getElementById('strip-me');
const STRIP_ANCHORS = CJ_ANCHORS.filter(a => a[0] > 0);
const stripDots = [];
let stripIdx = -2, stripBot = null;      // 変わったときだけ触るための控え
if (stripEl) {
  STRIP_ANCHORS.forEach((a, i) => {
    const d = document.createElement('i');
    d.style.bottom = `${4 + (i / (STRIP_ANCHORS.length - 1)) * 92}%`;
    d.title = a[2];
    stripEl.appendChild(d);
    stripDots.push(d);
  });
}
function updateStrip() {
  if (!stripEl) return;
  let idx = -1;
  for (let i = 0; i < STRIP_ANCHORS.length; i++) if (core.progress >= STRIP_ANCHORS[i][0]) idx = i;
  // ★点の on/off は、変わった時だけ触る（毎フレーム全部の点を触らない）
  if (idx !== stripIdx) {
    for (let i = 0; i < stripDots.length; i++) stripDots[i].classList.toggle('on', i <= idx);
    stripIdx = idx;
  }
  // いまの位置（点と点のあいだを ゆるく 補間する）
  const n = STRIP_ANCHORS.length - 1;
  let f;
  if (idx < 0) f = core.progress / STRIP_ANCHORS[0][0] * (1 / n);
  else if (idx >= n) f = 1;
  else {
    const a0 = STRIP_ANCHORS[idx][0], a1 = STRIP_ANCHORS[idx + 1][0];
    f = (idx + (core.progress - a0) / (a1 - a0)) / n;
  }
  // ★`#strip-me` には `transition: bottom .25s linear` がかかっている。
  //   毎フレーム別の値を入れると、そのたびに補間がやり直しになる。
  //   0.1% きざみにまるめて、変わったときだけ書く。
  const bot = (4 + clamp(f, 0, 1) * 92).toFixed(1) + '%';
  if (bot !== stripBot) { stripBot = bot; stripMe.style.bottom = bot; }
}

// ============================================================
//  🏳 きのうの自分の標（プラン §3.7）
//   ★自己ベストの地点に、静かに標が立つ。抜いた瞬間だけ、金色に光る。
//     順位ではなく「自分の過去」と競わせる。
// ============================================================
function loadBestMark() {
  try { return JSON.parse(lsGet('bestMark') || 'null'); } catch (e) { return null; }
}
// その子の記録をぜんぶ読みこむ（名前が変わったら呼びなおす）
function loadProfile() {
  best = Number(lsGet('best') || 0);
  stamps = loadStamps();
  bestMark = loadBestMark();
  const el = document.getElementById('ov-best');
  if (el && ov.classList.contains('title')) el.textContent = best ? `BEST  ${best.toLocaleString()}` : '';
  buildStartButtons();
}
let bestMark = loadBestMark();
let lastGain = 0;      // 🏆 このプレイで自己ベストをどれだけ更新したか
let bestMarkPassed = false;
function updateBestMark() {
  if (!bestMark || bestMarkPassed || !running || core.ending) return;
  if (core.progress < bestMark.p) return;
  bestMarkPassed = true;
  popText = `🏳 ${bestMark.date} の チッチを こえた`;
  popUntil = core.time * 1000 + 2600;
  Snd.play('milestone');
  R.addTrauma(0.22);
  const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
  R.burst(P[0], P[1], P[2], [1.0, 0.86, 0.35], 22,
          { speed: 3.0, up: 0.9, size: 0.13, life: 0.7, kind: 3, drag: 1.5 });
}
// ============================================================
//  👻 自己ベストのゴースト（プラン §3.7）
//
//   前のいちばん良かった回の「何秒のとき どこまで登っていたか」を残しておき、
//   次のプレイで**同じ時刻の高さ**に線を出す＝過去の自分と並走する。
//   抜いた瞬間だけ、金色に光る。
//
//   ★鳥の姿では出さない。2匹目のチッチ（§5.6）と見わけがつかなくなる。
//   ★抜けなくても責めない。線が上にあるだけで、何も言わない。
// ============================================================
const GHOST_STEP = 0.4;        // 何秒ごとに記録するか
const GHOST_MAX  = 900;        // 点の数の上限（6分ぶん）
let ghostPath = null;          // 前回のベスト [[秒, progress], ...]
let ghostRec  = [];            // 今回ぶん
let ghostT = 0, ghostPassed = false, ghostEl = null;

function loadGhost() { try { return JSON.parse(lsGet('ghost') || 'null'); } catch (e) { return null; } }
function saveGhost() {
  // ★「いちばん遠くまで行った回」を残す。時間ではなく到達点で選ぶ。
  if (ghostRec.length < 4) return;
  const cur = loadGhost();
  const mine = ghostRec[ghostRec.length - 1][1];
  if (cur && cur.length && cur[cur.length - 1][1] >= mine) return;
  lsSet('ghost', JSON.stringify(ghostRec));
}
function resetGhost() {
  ghostPath = loadGhost(); ghostRec = []; ghostT = 0; ghostPassed = false;
}
// いまの時刻に、ゴーストはどこまで登っていたか
function ghostProgress() {
  const g = ghostPath;
  if (!g || g.length < 2) return null;
  if (ghostT > g[g.length - 1][0]) return null;    // ゴーストはもう落ちている
  let i = 0;
  while (i < g.length - 2 && g[i + 1][0] < ghostT) i++;
  const a = g[i], b = g[i + 1];
  const t = b[0] > a[0] ? clamp((ghostT - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  return lerp(a[1], b[1], t);
}
function updateGhost(dt) {
  if (!ghostEl) ghostEl = document.getElementById('ghost');
  if (!running || core.ending || core.over) { if (ghostEl) ghostEl.classList.remove('show'); return; }
  ghostT += dt;
  const last = ghostRec.length ? ghostRec[ghostRec.length - 1][0] : -1;
  if (ghostT - last >= GHOST_STEP && ghostRec.length < GHOST_MAX) {
    ghostRec.push([Math.round(ghostT * 10) / 10, Math.round(core.progress)]);
  }

  const gp = ghostProgress();
  if (gp == null) { ghostEl.classList.remove('show'); return; }

  // 画面のどこに出るか。世界の高さ → 画面の縦位置。
  // 🚨 cjYAtProgress ではなく cjFlagY を使うこと。前者は「カメラの基準の高さ」で、
  //    そのまま引くと **画面の46%ぶん下**に線が出る（実測 4.50／9.69）。
  //    ゴーストは「同じ時刻に 過去の自分が **居た高さ**」の線なので、
  //    チッチの高さでそろえないと、こえた瞬間と絵が合わない。
  //    （🚩の標を入れたとき、同じ式のズレとして見つけた。2026-08-22）
  const gy = cjFlagY(gp);
  const sc = screenOf(worldAt(core.camPx, gy, 0));
  // ★出したり消したりの境目を分ける。ひとつの値で切ると、画面のはしで
  //   毎フレーム点滅する（チカチカのもとを、あらかじめ潰しておく）。
  const on = ghostEl.classList.contains('show');
  const lim = on ? 1.16 : 1.02;
  if (!sc || sc.behind || Math.abs(sc.y) > lim) { ghostEl.classList.remove('show'); return; }
  ghostEl.style.top = `${(0.5 - sc.y * 0.5) * 100}%`;
  ghostEl.classList.add('show');

  // 抜いた瞬間だけ、金色に光る。1回だけ。
  if (!ghostPassed && core.progress > gp + 40) {
    ghostPassed = true;
    popText = '👻 きのうの チッチを こえた';
    popUntil = core.time * 1000 + 2400;
    Snd.play('milestone');
    R.addTrauma(0.26);
    const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
    R.burst(P[0], P[1], P[2], [1.0, 0.84, 0.30], 26,
            { speed: 3.2, up: 1.0, size: 0.14, life: 0.8, kind: 3, drag: 1.5 });
  }
}

// 🤝 協力メーター（プラン §7 その3）。この端末で積み上げた合計の進行度。
//    ★本当の「兄弟の合計」は本体（Firestore）で足す。ここは自分のぶんを貯めて渡すだけ。
// ★足すのは「前に足したところからの差」。1回のプレイで何度呼ばれても
//   合計が二重にならないようにする（月に着いたとき／落ちたとき の両方で呼ぶため）。
let coopPosted = 0;
function addCoop(p) {
  const add = Math.max(0, Math.round(p) - coopPosted);
  coopPosted = Math.max(coopPosted, Math.round(p));
  const cur = Number(lsGet('coop') || 0) + add;
  lsSet('coop', String(cur));
  return cur;
}

// ============================================================
//  🏁 1回のプレイの終わり（プラン §7 兄弟ランキングの3軸）
//
//   ★終わりかたは3つある。①落ちた ②月・火星で「ここでやめる」を選んだ
//   ③手紙を読みおえた。どれでも同じものを本体へ渡さないと、
//   「月でやめた回だけ記録に残らない」という穴があく（実際そうなっていた）。
//   ★何度呼ばれてもよいように書くこと。月→続行→落下、で2回通る。
// ============================================================
// ============================================================
//  🚩 標（しるべ）— 自分のいちばん遠く と、ほかの子の旗
//
//   兄弟ランキングの表は、子どもは見ない。**道の途中に立っている旗**なら、
//   見ないほうが無理。抜いた瞬間に、その1回が語りぐさになる。
//
//   ★見せかたの決めごと（プラン §3.9「絶望的な差を正面から見せない」）
//     ・旗は**画面に映る高さに来たときだけ**出す。ずっと先の旗は、
//       そこまで自分で登るまで、一度も見えない。
//     ・抜けなくても何も言わない。ゴーストと同じで、責める言葉は置かない。
//     ・自分の旗は白、ほかの子は水色。こえたら金。ゴースト（金の線・右寄せ）
//       と見わけがつくよう、旗は左寄せにしてある。
//   ★出どころは本体の Firestore（jump3d_reach）。単体で開いたときは
//     自分の標だけが立つ。
// ============================================================
const FLAG_MAX = 8;            // 立てる旗の数（多いと道が線だらけになる）
let flagRows = [];             // 本体から届いた [{nickname, value}]
let flags = [];                // 画面に立てたもの [{name, p, mine, passed, el}]
let flagsEl = null;

function setFlagData(rows) {
  flagRows = Array.isArray(rows) ? rows : [];
  rebuildFlags();
}

function rebuildFlags() {
  if (!flagsEl) flagsEl = document.getElementById('flags');
  if (!flagsEl) return;
  flagsEl.innerHTML = '';
  flags = [];

  const add = (label, p, mine) => {
    if (!(p > 0)) return;
    const el = document.createElement('div');
    el.className = 'flag' + (mine ? ' me' : '');
    el.innerHTML = `<span>${mine ? '🏳' : '🚩'} ${escapeHtml(label)}</span>`;
    flagsEl.appendChild(el);
    // ★始める場所を選んで途中から出たときは、その下の旗は**もう こえたこと**に
    //   しておく（通っていないのに「こえた！」と出るのは うそになる）。
    flags.push({ name: label, p, mine, passed: core.progress >= p, el });
  };

  if (bestMark && bestMark.p > 0) add(`${bestMark.date} の じぶん`, bestMark.p, true);
  flagRows
    .filter(r => r && r.nickname && r.nickname !== nickname && Number(r.value) > 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, FLAG_MAX)
    .forEach(r => add(r.nickname, Math.round(Number(r.value)), false));
}

// 旗を引く高さ。
//  🚨 **cjYAtProgress をそのまま使ってはいけない。**
//    あれが返すのは「カメラの基準の高さ」で、CJ_SCROLL_OFF に
//    公園ぶんのズレ（CJ_PARK_CAMY）が入っている。そのまま線を引くと
//    **画面のおよそ4割ぶん下**に出て、
//    「線をこえたのに『ぬいた』が出ない → しばらくして急に出る」になる。
//    （実測：progress がちょうど旗の数と同じとき、線 83% ／ チッチ 43%）
//  ★ここで要るのは「progress がその数になったとき、チッチが居る高さ」。
function cjFlagY(p) {
  return cjRawFromProgress(Math.max(0, p)) / CJ_M_PER_WORLD + CJ_VIEW_H * (1 - CJ_SCROLL_FRAC);
}

function updateFlags() {
  if (!flags.length) return;
  const hide = !running || core.ending || core.over || !!letter;
  for (const f of flags) {
    if (hide) { f.el.classList.remove('show'); continue; }
    const sc = screenOf(worldAt(core.camPx, cjFlagY(f.p), 0));
    // ★出す／消すの境目を分ける。ひとつの値で切ると画面のはしで毎フレーム
    //   点滅する（ゴーストで踏んだのと同じチカチカ）。
    const on = f.el.classList.contains('show');
    const lim = on ? 1.16 : 1.02;
    if (!sc || sc.behind || Math.abs(sc.y) > lim) { f.el.classList.remove('show'); continue; }
    f.el.style.top = `${(0.5 - sc.y * 0.5) * 100}%`;
    f.el.classList.add('show');
  }
  // こえた瞬間。1本につき1回だけ。
  for (const f of flags) {
    if (f.passed || hide || core.progress < f.p) continue;
    f.passed = true;
    f.el.classList.add('passed');
    f.el.querySelector('span').textContent = `${f.mine ? '🏳' : '🚩'} ${f.name} を こえた`;
    popText = f.mine ? `🏳 ${f.name}を こえた` : `🚩 ${f.name}を ぬいた！`;
    popUntil = core.time * 1000 + 2400;
    Snd.play('milestone');
    R.addTrauma(0.26);
    const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
    R.burst(P[0], P[1], P[2], f.mine ? [1.0, 1.0, 0.95] : [0.55, 0.85, 1.0], 26,
            { speed: 3.2, up: 1.0, size: 0.14, life: 0.8, kind: 3, drag: 1.5 });
  }
}

function finishRun() {
  if (core.score > best) { best = core.score; lsSet('best', String(best)); }
  lastGain = bestMark ? Math.max(0, Math.round(core.progress - bestMark.p))
                      : Math.round(core.progress);
  const coop = addCoop(core.progress);
  // 🚩 reach＝**どこまで登ったか（progress）**。score とは別もの。
  //    旗は「点」ではなく「到達点」に立てるので、この数字が要る。
  post('cj-score', { score: core.score, meters: core.meters, reach: Math.round(core.progress),
                     week: cjWeekSeed(), weekNo: cjWeekNo(), gain: lastGain, coop });
  saveBestMark();
  saveGhost();
  post('cj-flags-request');    // 次のプレイに向けて、みんなの旗を取り直す
}

function saveBestMark() {
  // いちばん遠くまで行った地点を残す
  if (!bestMark || core.progress > bestMark.p) {
    const d = new Date();
    bestMark = { p: Math.round(core.progress), date: `${d.getMonth() + 1}月${d.getDate()}日` };
    lsSet('bestMark', JSON.stringify(bestMark));
  }
}

// ============================================================
//  🎬 落ちたあとの、ひと呼吸（プラン §3.6）
//
//   落ちるのは「死」ではなく「もどる」。だから急がせない。
//   カメラが静かに引いて、登ってきた高さを見せてから、結果を出す。
//   ★ただし毎回のことなので長すぎてはいけない。
//     引きは3.5秒。画面をさわれば、すぐ結果へ飛ばせる。
// ============================================================
let outro = null;       // { t }
// 🎬 落ちたあとの「毎回のエンディング」（プラン §3.6）。
//   ぐっと引いて、**来た道を少しだけ戻って見せて**、到達点にもどって止まる。
//
//   ★来た道を 0 まで巻きもどしたくなるが、やってはいけない。
//     深宇宙では 1秒に 600progress 進むので、全部戻すと biome が
//     コマ送りで切りかわって**画面が明滅する**（子ども向けの 2Hz 以下に違反する）。
//     戻すのは「およそ45秒ぶん＝biome ひとつぶん」だけにして、2.5秒かける＝0.4Hz。
const OUTRO_HOLD  = 1.2;    // 止まって引く
const OUTRO_BACK  = 2.5;    // 来た道を戻る
const OUTRO_FWD   = 2.5;    // 到達点へもどる
const OUTRO_END   = 1.4;    // 到達点で止まって、場所の名まえを出す
const OUTRO_ALL   = OUTRO_HOLD + OUTRO_BACK + OUTRO_FWD + OUTRO_END;
let outroBiome = null;

function startOutro() {
  const p0 = core.progress;
  // 45秒ぶん戻す。ただし出発点より前には戻らない。
  const back = Math.min(p0 * 0.9, cjProgressPerSec(p0) * 45);
  outro = { t: 0, p0, back, p: p0, name: core.reached[core.reached.length - 1] || '' };
  outroBiome = cjBiomeOut();
  cjBiomeAt(core.biomeTL, p0, outroBiome);
  hud.classList.add('dim');
}

// 背景がいま見るべき進行度。ふだんは core.progress、エンディング中は巻きもどした値。
function viewProgress() { return outro ? outro.p : core.progress; }
function viewBiome()    { return outro ? outroBiome : core.biome; }

function updateOutro(dt) {
  if (!outro) return;
  outro.t += dt;
  // ゆっくり回りながら引く（止め絵にしない）
  core.camPx = cjWrap(core.camPx + dt * 0.30);

  const t = outro.t;
  let k = 0;                                   // 0=到達点 1=いちばん戻ったところ
  if (t > OUTRO_HOLD + OUTRO_BACK + OUTRO_FWD) k = 0;
  else if (t > OUTRO_HOLD + OUTRO_BACK)
    k = 1 - easeOut((t - OUTRO_HOLD - OUTRO_BACK) / OUTRO_FWD);
  else if (t > OUTRO_HOLD)
    k = easeOut((t - OUTRO_HOLD) / OUTRO_BACK);
  outro.p = outro.p0 - outro.back * k;
  cjBiomeAt(core.biomeTL, outro.p, outroBiome);

  // 最後に、いちばん遠くまで来た場所の名まえを置く。感想は書かない。
  if (t > OUTRO_HOLD + OUTRO_BACK + OUTRO_FWD && !outro.named && outro.name) {
    outro.named = true;
    popText = `📍 ${outro.name}`;
    popUntil = performance.now() + 1600;
  }
  if (t > OUTRO_ALL) endOutro();
}
function endOutro() {
  if (!outro) return;
  outro = null;
  outroBiome = null;
  hud.classList.remove('dim');
  showOverlay('over');
}

// ============================================================
//  🛑 ヘリオポーズ ― 物語の分水嶺（プラン §5.3）
//
//   ① 予兆：下から上へ流れていた太陽風の粒が、急に減速して滞る
//   ② 壁 ：光る薄い膜。突きぬける瞬間、ずっと鳴っていた低い音がプツッと切れる
//   ③ 無音3秒。UIも消す。操作は効くが、何も起きない
//   ④ 星図：星が一面に出て、そのうちの1つに小さなリングが付く
//
//   「ここまでが、太陽の国（くに）。」
//   「太陽がふいた風は、ここでとまる。」
//   （リングが付いて）「これが、太陽。」
//
//  ★核心は「ずっと画面の下にあった太陽が、星の1つに紛れる」こと。
//    ここでチッチが**全編で唯一、自分から振り返る**。1回だけだから効く。
// ============================================================
const HELIO_LINES = [
  [1.20, 'ここまでが、太陽（たいよう）の国（くに）。'],
  [3.60, '太陽がふいた風（かぜ）は、ここでとまる。'],
  [6.20, 'これが、太陽。'],
];
let helio = null;        // { t, idx } 突きぬけたあとの進行
let helioNear = 0;       // 0..1 予兆（粒が滞る）
let helioLook = 0;       // 0..1 チッチが振り返る量

function updateHelio(dt) {
  // 予兆：壁に近づくほど、太陽風の粒がゆっくりになる
  const d = CJ_HELIO_P - core.progress;
  helioNear = (!core.helioDone && d > 0 && d < 600) ? 1 - d / 600 : 0;

  if (!helio) { helioLook = Math.max(0, helioLook - dt * 1.4); return; }
  helio.t += dt;
  const t = helio.t;
  while (helio.idx < HELIO_LINES.length && t >= HELIO_LINES[helio.idx][0]) {
    voyLineText = HELIO_LINES[helio.idx][1];
    voyLineUntil = performance.now() + 2400;
    helio.idx++;
  }
  // ④ 太陽に小さなリング（3行目に合わせて）
  R.sunRing = smoothstep(6.1, 6.6, t) * (1 - smoothstep(9.4, 10.4, t));
  // チッチが振り返る（1回だけ）
  helioLook = smoothstep(5.6, 6.4, t) * (1 - smoothstep(9.0, 10.0, t));
  // UI（HUD）を消して、また戻す
  const hide = t < 8.6;
  hud.style.opacity = hide ? '0' : '';
  const tb = document.getElementById('topbar');
  if (tb) tb.style.opacity = hide ? '0' : '';
  if (t > 11) {
    helio = null; R.sunRing = 0;
    hud.style.opacity = ''; if (tb) tb.style.opacity = '';
  }
}

// ✨ 光と並走（プラン §5.1）
//   恒星間空間に、光の粒を1つだけ流す。チッチより速く、静かに追い抜いていく。
//   ★年に数回しか出なくていい。めったに無いから、見たときに残る。
let lightAt = 0;
function passingLight(dt) {
  if (core.progress < 15000 || !running || core.ending) return;
  if (core.time < lightAt) return;
  if (Math.random() > dt * 0.02) return;        // 平均50秒に1回くらい
  lightAt = core.time + 40;
  const P = camPlace(7 + Math.random() * 5, rnd(-1.6, 1.6), -0.55);
  for (let i = 0; i < 26; i++) {
    R.spawn({
      x: Math.sin(P.ang) * P.radius, y: P.y - i * 0.10, z: Math.cos(P.ang) * P.radius,
      vy: 26, vx: 0, vz: 0,
      life: 1.5, size: 0.075 - i * 0.002, kind: i < 3 ? 3 : 1, drag: 0,
      col: [1.0, 1.0, 0.94],
    });
  }
}

// ☕ ひと休み中の きらめき。上からゆっくり降ってくる。
// ★「安全だよ」と字で書かない。見れば分かるようにする。
let sparkAcc = 0;
function breakSparkle(dt) {
  const bk = core.breakAmt || 0;
  if (bk <= 0.05) return;
  sparkAcc += bk * 14 * dt;
  const n = Math.floor(sparkAcc);
  sparkAcc -= n;
  for (let i = 0; i < n; i++) {
    const depth = 5 + Math.random() * 9;
    const P = camPlace(depth, rnd(-0.42, 0.42) * depth, 0.58 + Math.random() * 0.10);
    R.spawn({
      x: Math.sin(P.ang) * P.radius, y: P.y, z: Math.cos(P.ang) * P.radius,
      vy: -(1.2 + Math.random() * 1.4), vx: 0, vz: 0,
      life: rnd(1.6, 2.8), size: 0.05 + Math.random() * 0.05,
      kind: 3, drag: 0, g: 0,
      col: [1.0, 0.92 - Math.random() * 0.12, 0.55],
    });
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
        flickUsed = false;          // ⚡ 逆フリックは、着地までに1回だけ
        rig.land(ev.impact);
        R.addTrauma(0.10 + ev.impact * 0.22);
        // ヒットストップ。これを挟まないと「潰れ」が1フレームで消えて見えない。
        hitStop = Math.max(hitStop, ev.kind === 'spring' ? 0.060 : 0.040);
        {
          // 着地のけむり。数は落ちてきた速さに比例させる（軽い着地は静かに）
          const P = worldAt(ev.px, ev.y + CJ_PLAT_H, CHICCHI_FRONT * 0.6);
          const n = Math.round(4 + ev.impact * 10);
          if (ev.kind === 'spring') {
            // 🌀 バネの宙返りは **ゆっくり**（本人「もっとゆっくり回したほうが
            //    ボヨーンって感じがする」2026-08-22）。
            //    ★秒数を決め打ちにしない。バネの威力は落ちてきた速さで変わるので、
            //      決め打ちだと 弱いバネのときに 回りきる前に着地する。
            //      いまの上向きの速さから 滞空時間（2v/g）を出し、その6割で回る。
            {
              const airT = 2 * Math.max(core.player.vy, 1) / CJ_GRAVITY;
              rig.spring(); R.addTrauma(0.30); rig.flip(airT * 0.60); Snd.play('spring');
            }
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
      case 'pillars':
        // ★どちらが何かは、色と字で先に見せる。選ばせる画面は作らない。
        popText = `🌈 ${ev.a.icon}${ev.a.name}　／　${ev.b.icon}${ev.b.name}`;
        popUntil = now + 3200;
        Snd.play('warn');
        break;

      case 'relic':
        popText = `${ev.relic.icon} ${ev.relic.name}`;
        popUntil = now + 2200;
        Snd.play('onigiri');
        R.addTrauma(0.20);
        {
          const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
          R.burst(P[0], P[1], P[2], PILLAR_COL[ev.relic.key] || [1, 1, 1], 16,
                  { speed: 2.6, up: 0.8, size: 0.12, life: 0.6, kind: 3, drag: 1.6 });
        }
        break;

      case 'skate':
        // ⛸ 氷を乗りついだ。すべる足場を「使いこなした」ことをちゃんと返す。
        popText = `⛸ スケート×${ev.n}　+${ev.gained.toLocaleString()}`;
        popUntil = now + 900;
        Snd.play('ice');
        {
          const P = worldAt(ev.px, ev.y, 0.12);
          R.burst(P[0], P[1], P[2], [0.72, 0.95, 1.0], 10 + ev.n * 2,
                  { speed: 2.8, up: 0.7, size: 0.11, life: 0.5, kind: 3, drag: 1.6 });
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
      case 'mars': {
        addStamp(ev.type === 'moon' ? '月' : '火星');
        // ★ここで「ここでやめる」を選ぶ子がいる。渡すものは落ちたときと同じにする。
        finishRun();
        // 🌙 いったん降り立つ。足を地面にそろえて、カメラを止める。
        const arrived = ev.type;
        popText = ''; hitStop = 0; voyLineUntil = 0;
        core.player.vy = 0; core.player.vx = 0;
        core.player.y = core.camY + CJ_VIEW_H * (1 - CJ_SCROLL_FRAC);
        // ★正面に立たせる。どこで着いたかで、旗や探査車と重なってしまう。
        core.player.px = core.camPx;
        running = false;
        R.addTrauma(0.45);
        Snd.play('goal');
        // 着地のけむり
        {
          const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT * 0.6);
          R.burst(P[0], P[1], P[2], arrived === 'moon' ? [0.86, 0.86, 0.90] : [1.0, 0.62, 0.42], 18,
                  { speed: 2.0, up: 0.5, size: 0.16, life: 0.9, kind: 0, drag: 1.4 });
        }
        // ★すぐボタンを出さない。まず景色と、本当のことを1行ずつ。
        setTimeout(() => startArriveTalk(arrived), 1400);
        break;
      }
      case 'leaveMoon':
        popText = core.marsCleared ? '🛰 つぎは ボイジャー1号や！' : '🚀 つぎは火星（かせい）や！';
        popUntil = now + 2200;
        rig.launch(1); R.addTrauma(0.35);
        break;

      case 'anchor':
        addStamp(ev.name);
        // ★ここで止める。これ以上は書かない（プラン §5.6）。
        // ✉️ **何度でも見られる**（本人の指示 2026-08-21）。
        //   ★プランは「一度きり」だったが、宇宙のはてまで登るのに10分ちかくかかる。
        //     一度きりにすると、見のがしたら二度と読めないし、
        //     兄弟に見せることもできない。**着いた人には、いつでも見せる。**
        //   （読んだことがあるかどうかは記録しておく。帯とスタンプで使う）
        if (ev.name === CJ_LETTER_AT) {
          lsSet('letter', '1');
          running = false;
          startArriveTalk('edge');     // はての話をしてから、手紙
          break;
        }
        if (ev.name === 'プロキシマ・ケンタウリ') {
          voyLineText = 'いちばん近い、となりの星（ほし）。それでも4.2光年（こうねん）。';
          voyLineUntil = performance.now() + 5200;
        }
        // 名まえのある地点に着いた。どの到達にも意味が宿るようにしている。
        if (ev.name === '月' || ev.name === '火星') break;   // 上で出しているので二重にしない
        popText = `📍 ${ev.name}${ev.bonus ? `　+${ev.bonus.toLocaleString()}` : ''}`;
        popUntil = now + 2200;
        Snd.play('milestone');
        R.addTrauma(0.2);
        break;

      // 🔇 完全な無音は3回だけ（プラン §5.2）。多用すると値打ちが落ちる。
      //    ①カーマンライン ②ヘリオポーズ ③ボイジャーを追いこした直後
      case 'helioNear':
        // 予兆。音だけ先に細くする（何かが来る、と体が気づく）
        Snd.play('warn');
        break;

      case 'helio':
        // 突きぬけた。ここから11秒、世界を止めて見せる。
        helio = { t: 0, idx: 0 };
        R.addTrauma(0.30);
        popText = ''; popUntil = 0;
        break;

      case 'silence':
        Snd.hush(ev.sec || 2.2);
        break;

      case 'unitUp':
        // 単位が上がった＝スケールが1段あがった瞬間。ここは演出の主役。
        showUnitUp(ev.unit, ev.note);
        hitStop = Math.max(hitStop, 0.060);
        R.addTrauma(0.35);
        rouletteUntil = performance.now() + ROULETTE_MS;
        unitPull = 1;                       // カメラが少しだけ引く（×1.12）
        Snd.play('unit');
        break;

      case 'revive':
        // 🔁 助けたことを、静かに1行だけ。責めない。
        popText = '🔁 ここから もう一度';
        popUntil = now + 1800;
        R.addTrauma(0.25);
        break;

      case 'chainBreak':
        // 💥 落ちてきた岩が下の足場を巻きこんだ。**下を見る理由**（プラン §3.2）。
        breakSparkle(ev.px, ev.y);
        Snd.play('break');
        popText = `💥 まきこんだ  +300`;
        popUntil = now + 1200;
        break;

      case 'biome':
        // どんな場所を通っているか。静かに1行だけ。
        // ★「すごい」「きれい」は書かない。感じるぶんは子どもの取り分。
        popText = `🌌 ${ev.name}`;
        popUntil = now + 2400;
        biomePull = 1;                 // 一瞬だけカメラが引く（自分が小さくなる）
        // 📖 **名前だけでなく、その場所のほんとうのことも1行置く。**
        //    （本人「景色の名前も教えてあげると 宇宙に興味わくよね」）
        //    ★感想は書かない。「すごい」「きれい」は子ども側の取り分（プラン §5.5）。
        {
          const def = CJ_BIOME_DEFS[ev.key];
          if (def && def.fact) { voyLineText = def.fact; voyLineUntil = now + 6200; }
        }
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
        // ✨ ジャストジャンプ。**決まったことが ひと目で分かる**ようにする
        //    （本人「決まったら派手なエフェクト出したほうがわかりやすい」2026-08-22）。
        //    前は 小さい文字と つぶ10個だけで、決まったのか分からなかった。
        //  ★派手にするのは「決まった一瞬」だけ。ここを長く引っぱると、
        //    次の足場を読む目のじゃまになる。ぜんぶ 0.6秒以内に消える。
        const n = ev.n || 1;
        showJust(n);
        Snd.play('just', n);
        R.addTrauma(0.26);
        justFlash = 1;                    // チッチ自身が一瞬光る
        const P = worldAt(core.player.px, core.player.y, CHICCHI_FRONT);
        // ① 衝撃波のリング。**画面に正面を向く面**に、ぐるり等間隔で置く。
        //    円周の接線（T）と 上（Y）が作る面がそれ。
        //    ★burst はばらばらに散らすので、リングにはならない。ここは spawn を直に使う。
        //  🚨 **小さく作らない。** はじめ 粒0.115・速さ4.6・drag5.2 で作ったら、
        //     実測の絵では チッチの足もとの こまかい きらきら にしかならず、
        //     「派手」になっていなかった。チッチの背たけが約0.6なので、
        //     リングの半径（速さ÷drag）は **その3倍** を目安にする。
        const ang = cjAngle(core.player.px);
        const T = [Math.cos(ang), 0, -Math.sin(ang)];
        const RING = 26, rs = 7.0 + Math.min(n, 5) * 0.5;   // 半径 ≒ rs/drag ≒ 2.2
        for (let i = 0; i < RING; i++) {
          const th = (i / RING) * Math.PI * 2, c = Math.cos(th), s2 = Math.sin(th);
          R.spawn({
            x: P[0], y: P[1], z: P[2],
            vx: T[0] * c * rs, vy: s2 * rs, vz: T[2] * c * rs,
            life: 0.40, size: 0.22, kind: 1, drag: 3.2, g: 0,
            col: [1.0, 0.94, 0.62], add: true,
          });
        }
        // ② 内がわの ふくらみ（リングだけだと まんなかが すかすかに見える）
        R.burst(P[0], P[1], P[2], [1.0, 1.0, 0.90], 10,
                { speed: 2.0, up: 0.8, size: 0.30, life: 0.26, kind: 0, drag: 4.0, add: true });
        // ③ 上へ抜ける光の筋（「上へ行くぞ」という向きを絵で出す）
        R.burst(P[0], P[1], P[2], [1.0, 0.98, 0.80], 16,
                { speed: 2.6, up: 3.4, size: 0.21, life: 0.62, kind: 3, drag: 1.4, add: true });
        // ④ 足もとに散る火花
        R.burst(P[0], P[1], P[2], [1.0, 0.82, 0.32], 14,
                { speed: 4.2, up: 0.3, size: 0.15, life: 0.48, kind: 3, drag: 2.2, add: true });
        break;
      }
      case 'gameover': {
        Snd.play('over');
        running = false;
        finishRun();
        // 落ちきってから結果を出す（すぐ出すと「今の何？」になる）
        startOutro();
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
const VOY_SPAN = CJ_VOY_SPAN;   // ★出どころは core.js。ここで別の数字を書かない
// ★右下は 🪽🚀 のボタンがある。そこへ置くと、いちばんの見せ場がUIで隠れる。
//   左へ寄せる（左端の帯は幅12pxなので当たらない）。
//   さらに**足場より奥**に置く。手前に置くと、次に乗る足場を隠して落とす。
const VOY_SIDE = -0.95;

// 追いこすまでに、1行ずつ間をあけて出す。
// ★事実だけを書いて、感想は一切書かない。速さでなく「時間」と「向き」で語る。
const VOY_LINES = [
  [-380, 'なにか 光っている…'],
  [-250, 'ボイジャー1号。1977年、地球を出た。'],
  [-150, 'だれもむかえに行かない。だれも止めない。'],
  [ -95, 'Voyager〜♡　こんにちは！'],
  [ -60, '金のレコードに、地球の音が入っている。'],
  [  10, '波（なみ）の音。かみなり。赤（あか）ちゃんの泣（な）き声。'],
  [  38, '55の言葉（ことば）で あいさつ。'],
  [  60, '……そして、名前（なまえ）のない1曲（きょく）。'],
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
  const alt = altM();
  const skyCols = cjSkyColors(core.meters, alt);
  const sky = skyCols[0];

  // ============================================================
  //  🚨 足場が背景に溶けないようにする（プラン §9 観点6）
  //
  //   実測でこうなっていた（WCAGのコントラスト比）:
  //     岩 vs 地球のふち  1.03 ← ほぼ同じ明るさ。輪郭線1本で浮いているだけ
  //     岩 vs 地面の地図  1.09
  //     黒い雲 vs 黒い空  1.59
  //
  //   ★空の側の頭打ち（shaders.js の CEIL）は **深宇宙の空にしか効いていない**。
  //     低いところの地面・地球の球・大気のふちは素通しだった。
  //     「直した場所が違った」ので、こんどは**足場の側**で担保する。
  //
  //   やることは1つ：**背景が明るければ足場を暗く、暗ければ明るく**振る。
  //   「次に乗る足場が見えること」は、きれいさより先に守る。
  // ============================================================
  const bgLum = (x => 0.30 * x[0] + 0.59 * x[1] + 0.11 * x[2])(
    [(skyCols[0][0] + skyCols[1][0]) * 0.5,
     (skyCols[0][1] + skyCols[1][1]) * 0.5,
     (skyCols[0][2] + skyCols[1][2]) * 0.5]);
  // 地面・地球が下半分を占めている高さでは、空の色だけでは足りない。
  // 平らな地図と地球が出ているあいだは、明るい背景とみなす。
  const groundBright = smoothstep(200, 900, alt) * (1 - smoothstep(120000, 400000, alt));
  const bg = Math.max(bgLum, groundBright * 0.42);
  const contrast = bg > 0.30 ? -0.24 : 0.26 * (1 - bg / 0.30);
  const zp0 = zoneProps(core.meters);

  for (const pl of core.platforms) {
    const d = cjWrapDelta(pl.px, core.camPx);
    const far = Math.abs(d);
    // ★タワーの裏側もうすく描く。これが「円筒を登っている」ことを見せる唯一の手がかり。
    //   ただし濃さははっきり分ける。明るい＝今ねらえる足場、うすい＝裏側、と
    //   ひと目で分かるようにしておかないと「乗れると思った」で落ちて理不尽になる。
    const near = 1 - smoothstep(CJ_VIEW_W * 0.44, CJ_VIEW_W * 0.62, far);
    let fade = lerp(0.34, 1.0, near);
    // 💥 こわれた足場：落ちているあいだは見せつづける（消すと巻きこみが見えない）。
    //    落ちきるころにゆっくり消える。
    if (pl.used) {
      fade *= pl.falling
        ? 1 - clamp((now - pl.breakAt - 4200) / 2800, 0, 1)
        : 1 - clamp((now - pl.breakAt) / CJ_BREAK_FADE_MS, 0, 1);
    }
    const c0 = col[pl.type];
    const k = (1 - near) * 0.62;             // 遠いほど空の色に溶かす
    // ★一律に明るさを足し引きしない。1枚の画面に「明るい地球」と「黒い空」が
    //   同居するので、どちらかを必ず殺してしまう。
    //   暗くなりすぎない床（uFloor）＋輪郭線で担保する。
    const c = [lerp(c0[0], sky[0], k), lerp(c0[1], sky[1], k), lerp(c0[2], sky[2], k)];
    // seed で少しずつ形を変えると、同じメッシュでも並んで見えない
    const s = 0.85 + pl.seed * 0.3;
    const sy = CJ_PLAT_H * zoneThick(core.meters) * s;
    // ★見た目の上のめんを、当たり判定の上のめんに実測でそろえる
    const meshTop = zp0[pl.type].top;
    platLists[pl.type].push({
      ang: cjAngle(pl.px), y: pl.y + CJ_PLAT_H - meshTop * sy, radius: CJ_RADIUS,
      sx: pl.w, sy, sz: pl.w * (core.meters >= CJ_SPACE_M ? PLAT_DEPTH_ROCK : 0.72),
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
        radius: CJ_RADIUS - 1.20,
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

// ============================================================
//  🩺 チカチカの原因さがし（?diag=1 のときだけ出る）
//
//   ★swiftshader（検証用のCPU描画）では**一度も再現できない**種類の不具合。
//     だから「実機で数字を見る」ための窓を用意する。
//   見るところ
//     size  … canvas を作り直した回数。増えつづけていたら**それが原因**
//     q     … 画質の段。行ったり来たりしていたら 自動調整が犯人
//     css   … 見た目の大きさ。小数がゆれていたら**スクロールバーの出入り**が犯人
// ============================================================
// ★URLを打ち直さなくても出せるように、F2 でも切りかえられるようにする
//   （本人が「そんなの出てない」＝?diag=1 を付けずに開いていた）。
let DIAG = CJ_QS.has('diag');
let diagEl = null, diagN = 0, diagLastW = 0, diagLastH = 0, diagT = 0, diagFps = 0, diagFrames = 0;
// コマの間かくを見る（明滅の正体が「コマ落ち」なのかを切り分ける）
let diagMin = 999, diagMax = 0, diagLong = 0, diagVsync = 16.7, diagShowT = 0;
// 🔬 F3 … 画面に重ねている**字と絵（DOM）をぜんぶ消す**。
//   これで直るなら、犯人は3Dの絵ではなく「重ねかた（合成）」のほう。
let DOMOFF = false;
const DIAG_OVERLAYS = ['hud', 'strip', 'nav', 'skylab', 'voyline', 'ghost', 'flags', 'topbar', 'items', 'unitup', 'just'];
function setDomOff(v) {
  DOMOFF = v;
  for (const id of DIAG_OVERLAYS) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = v ? 'hidden' : '';
  }
}
function updateDiag(realMs) {
  if (!DIAG) { if (diagEl) diagEl.style.display = 'none'; return; }
  if (!diagEl) {
    diagEl = document.createElement('div');
    diagEl.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99;font:11px/1.5 monospace;' +
      'color:#9fe;background:rgba(0,0,0,.72);padding:6px 8px;border-radius:6px;white-space:pre;pointer-events:none';
    document.body.appendChild(diagEl);
  }
  diagEl.style.display = '';
  if (cv.width !== diagLastW || cv.height !== diagLastH) {
    diagN++; diagLastW = cv.width; diagLastH = cv.height;
  }
  // モニタの1コマぶん（＝いちばん短かった間かく）を目安にして、
  // その1.7倍より長いコマを「落ちコマ」と数える。165Hzなら6.1ms が目安。
  if (realMs > 0.5) {
    if (realMs < diagVsync) diagVsync = diagVsync * 0.9 + realMs * 0.1;
    if (realMs > diagVsync * 1.7) diagLong++;
    if (realMs < diagMin) diagMin = realMs;
    if (realMs > diagMax) diagMax = realMs;
  }
  diagFrames++; diagT += realMs;
  if (diagT > 500) { diagFps = Math.round(diagFrames * 1000 / diagT); diagT = 0; diagFrames = 0; }
  // ★診断そのものが毎フレームDOMを書きかえたら、犯人さがしのじゃまになる。
  //   表示は0.25秒に1回だけ。
  diagShowT += realMs;
  if (diagShowT < 250) return;
  diagShowT = 0;
  const r = cv.getBoundingClientRect();
  const gl = R.gl;
  diagEl.textContent =
    `size ${cv.width}x${cv.height}  作りなおし ${diagN}回
` +
    `css  ${r.width.toFixed(2)} x ${r.height.toFixed(2)}
` +
    `q ${R.quality}  dpr ${(window.devicePixelRatio||1).toFixed(2)}
` +
    `fps ${diagFps}  frame ${frameMs.toFixed(1)}ms
` +
    `コマ ${diagMin.toFixed(1)}〜${diagMax.toFixed(1)}ms  落ちコマ ${diagLong}回
` +
    `desync ${gl && gl.desync ? 'ON(前の作り)' : 'OFF(いまの作り)'}  F4で入れかえ
` +
    `F3で字を消す:${DOMOFF ? 'いま消えてる' : 'ふつう'}
` +
    `body ${document.body.scrollWidth}x${document.body.scrollHeight}`;
  diagMin = 999; diagMax = 0;
}

// ---------------- ループ ----------------
let prev = performance.now();
let frameMs = 16;
// HUD は中身が変わったときだけ書きかえる（上の loop() を見ること）
let hudHtml = null, voyShownText = null;
// 画質の段。行ったり来たりしないよう、決まった値だけを使う。
//
// 🚨 **遊んでいるあいだは、下げることしかしない。**（2026-08-21・本人「画面チカチカ」）
//   前の直し（1.2秒平均＋4段）でも足りなかった。理由はこう：
//     ① 立ちあがりの数フレームは必ず重い → いちど段が下がる
//     ② 下がると軽くなる → 「12ms未満」で段が上がる
//     ③ 上がるとまた重い → 下がる …… **1.2秒ごとに canvas を作り直す＝チカチカ**
//   ★とくに **120Hz・144Hz のモニタ**で起きる。1フレームが 7〜8ms なので
//     「12ms未満＝余裕がある」に必ず当てはまり、上げ下げが止まらない。
//   ★swiftshader（この環境の検証用CPU描画）は**常に重い**ので、
//     ここでは一度も再現できない。だから「再現してから直す」ではなく、
//     **振動が起きえない作り**にする。
// 決めごと
//   ・段を上げるのは「遊んでいないとき」だけ（タイトル・リザルト）
//   ・下げるのは2回続けて重かったときだけ
//   ・始めの3秒は数えない（読みこみの山を拾わない）
const Q_LEVELS = [0.62, 0.75, 0.88, 1.0];
let qLevel = Q_LEVELS.length - 1, qTimer = 0, qAcc = 0, qN = 0, qSlow = 0, qWarm = 0;
function resetQuality() {
  qLevel = Q_LEVELS.length - 1; R.quality = Q_LEVELS[qLevel];
  qTimer = 0; qAcc = 0; qN = 0; qSlow = 0; qWarm = 0;
}

function loop(now) {
  // ★実際にかかった時間と、物理に渡す dt は別もの。
  //   dt は 1/20秒で頭打ちにする（重いときに世界が飛ばないように）。
  //   でも**画質の判定は実時間で数える**。dt を使うと、重い端末ほど
  //   「3秒待つ」が19秒になって、いつまでも画質が下がらない（実測で発覚）。
  const realMs = now - prev;
  const dt = Math.min(realMs / 1000, 1 / 20);
  prev = now;
  frameMs = frameMs * 0.9 + realMs * 0.1;

  // ヒットストップ中はゲームの時間だけ止める（描画とカメラのゆれは動かす）
  if (intro) {
    updateIntro(dt);
    core.time += dt;              // 演出（ラジオのゆれなど）のために時計だけ進める
    core.events.length = 0;
  } else if (!running) {
    core.events.length = 0;
  } else if (hitStop > 0) {
    hitStop = Math.max(0, hitStop - dt);
    core.events.length = 0;
  } else {
    core.step(dt);
    handleEvents();
  }
  // タイトルのあいだは、カメラがゆっくり公園をまわる（うしろの絵を見せる）
  if (!running && !intro && !core.over) core.camPx = cjWrap(core.camPx + dt * 0.42);
  keyStep(dt);
  Snd.setAltitude(core.meters);
  Snd.updateBgm(core.meters);

  const p = core.player;
  rig.update(dt, {
    vy: -p.vy,                        // rig は「画面座標＝下向きが正」で書いてある
    vMax: CJ_SPRING_V,
    vx: p.vx, vxMax: CJ_KNOCK_VX,
    // 🪽 つばさを使っているあいだは滑空のポーズ（羽ばたかず、大きく開いて傾く）
    glide: core.time * 1000 < core.wingUntil,
    // 公園にいるあいだは空を見上げている（声の出どころ＝ラジオ、そして行き先の空）
    lookX: 0, lookY: intro ? 0.75 : (p.vy > 0 ? 0.45 : -0.35),
  });
  hurtFlash = Math.max(0, hurtFlash - dt * 3.2);
  justFlash = Math.max(0, justFlash - dt * 3.0);   // 0.33秒で消える（1回きり・点滅させない）

  R.resize();
  // 👀 指を止めているあいだ、カメラが少し上を向く（先が見える）
  const still = running && !core.ending && dragId !== null &&
                performance.now() - lastMoveAt > 300;
  [lookAhead, lookAheadV] = spring(lookAhead, lookAheadV, still ? 1.35 : 0, 34, dt);
  R.fxScale = FX ? 1 : 0.5;
  updateCamZoom(dt);
  updateSunLight();
  updateHelio(dt);
  updateOutro(realMs / 1000);      // 🎬 エンディングも実時間（重い端末で間のびさせない）
  R.setCamera(cjAngle(core.camPx), core.camY + lookAhead, dt, camZoom);
  R.beginFrame();
  R.drawSky(Math.floor(viewProgress()), core.time, viewBiome(), altM());
  spaceDust(dt);
  breakSparkle(dt);
  passingLight(dt);

  // 背景の風景（足場より先に描く）
  buildScenery();
  // 同じメッシュが続くところは、まとめて1回で描く。
  // ★ビルを増やすと、1つずつ描いていては描画呼び出しが数百回になる。
  // ★順番は変えないこと。奥から手前へ積んであるので、並べかえると重なりが壊れる。
  for (let i = 0; i < scnList.length; ) {
    const prop = scnList[i].prop;
    scnBatch.length = 0;
    while (i < scnList.length && scnList[i].prop === prop && scnBatch.length < 512) {
      scnBatch.push(scnList[i++]);
    }
    // 遠景のビルだけ輪郭を描かない（数pxなので見えないのに倍のジオメトリになる）
    R.drawInstances(prop, scnBatch, prop === scn.buildingFar ? { noOutline: true } : null);
  }
  for (const o of ringList)  R.drawInstances(o.prop, [o]);
  if (planeList.length)      R.drawInstances(scn.plane, planeList);
  if (jumboList.length)      R.drawInstances(scn.jumbo, jumboList);
  if (debrisList.length)     R.drawInstances(scn.debris, debrisList);
  // 🌠 流れ星は自分で光る（加算＋陰影なし）。ふつうに描くと灰色の棒になる。
  if (meteorList.length)     R.drawInstances(scn.meteor, meteorList,
                                             { noDepthWrite: true, additive: true, glass: 3 });
  // 大気のふちは、地球のあとに「明るくするだけ」で重ねる
  if (atmoList.length)       R.drawInstances(scn.atmo, atmoList,
                                             { noDepthWrite: true, additive: true, glass: 2 });
  // ☄️ 彗星。**加算合成**でにじませる。ふつうの半とうめいだと、黒い空の上では
  //    しっぽが灰色の板になる（ヘルメットで同じ失敗をした）。
  for (const o of cometList) R.drawInstances(o.prop, [o],
                                             { noDepthWrite: true, additive: true, glass: 3 });

  // 🌈 光の柱（プラン §3.4）。2本立って、どちらへ寄るかで力が決まる。
  if (core.pillars.length) {
    for (let i = 0; i < core.pillars.length; i++) {
      const pl = core.pillars[i];
      const c = PILLAR_COL[pl.relic.key] || [1, 1, 1];
      const puls = 0.85 + 0.15 * Math.sin(core.time * 4 + i * 2);
      R.drawInstances(scn.pillar, [{
        ang: cjAngle(pl.ang), y: pl.y - 1.0, radius: CJ_RADIUS,
        sx: 1, sy: 1, sz: 1, rot: 0,
        col: [c[0] * puls, c[1] * puls, c[2] * puls], fade: 0.55,
      }], { noDepthWrite: true, additive: true });
    }
  }

  buildDrawLists();
  // 測るとき用：足場だけ消した同じ絵を撮れるようにする（コントラストの実測）
  if (hidePlatsFlag) { for (const k in platLists) platLists[k].length = 0; }
  if (core.ending) { platLists.normal.length = 0; platLists.break.length = 0;
                     platLists.ice.length = 0; platLists.spring.length = 0;
                     itemStarList.length = 0; itemOnigiriList.length = 0;
                     foeList.length = 0; }
  const zp = zoneProps(core.meters);
  for (const k of ['normal', 'break', 'ice', 'spring']) {
    if (platLists[k].length) R.drawInstances(zp[k], platLists[k], { floor: PLAT_FLOOR });
  }
  if (itemStarList.length)    R.drawInstances(propStar, itemStarList, { floor: PLAT_FLOOR });
  if (itemOnigiriList.length) R.drawInstances(propOnigiri, itemOnigiriList, { floor: PLAT_FLOOR });
  if (foeList.length)         R.drawInstances(foes[foeList[0].kind], foeList, { floor: PLAT_FLOOR });
  if (voyagerList.length)     R.drawInstances(propVoyager, voyagerList);

  // 着地点の影 → そのあとチッチ（影が先。奥ゆきの手がかりになる）
  const tgt = core.ending ? null : shadowTarget();
  if (tgt) {
    const ang = cjAngle(p.px);
    const h = clamp((p.y - tgt.y) / 6, 0, 1);
    R.drawBlob(
      [Math.sin(ang) * (CJ_RADIUS + 0.02), tgt.y + CJ_PLAT_H * 0.9, Math.cos(ang) * (CJ_RADIUS + 0.02)],
      0.34 - h * 0.12, 0.24 - h * 0.08, 0.5 - h * 0.32);
  }
  // 🛑 ヘリオポーズでだけ、チッチが自分から振り返る（全編で1回きり）
  const cModel = chicchiModel();
  if (helioLook > 0.001) {
    const back = M4.compose([0, 0, 0], [0, Math.PI * helioLook, 0], [1, 1, 1]);
    const m = M4.mul(cModel, back);
    for (let i = 0; i < 16; i++) cModel[i] = m[i];
  }
  R.drawChicchi(chicchiSkin, rig, faceTex, cModel,
                Math.max(hurtFlash * 0.6, justFlash * 0.85));
  drawBuddy(cModel);          // 🐦 2匹目（説明はしない）

  // 🪖 宇宙服のヘルメット。宇宙ステーションでつける。
  // ★頭の位置は骨から引く。決め打ちにすると、潰れたり回ったりしたときに頭だけ置いていかれる。
  if (!helmetOn && core.progress >= CJ_STATION_M && (running || core.ending)) {
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
    // ★大きさは頭に合わせる。頭の半径は 0.25 くらいしかないので、
    //   0.62 だと2倍以上あって「かぶりもの」に見えてしまう（実際そう見えていた）。
    // ★頭にぴったり寄せること。大きいと 頭の上に「うすい灰色の空きスペース」が
    //   でき、遠目に**黒いかぶりもの**に見える（実測・本人からも指摘された）。
    const R_DOME = 0.385 * scale;                  // ドームの半径（world）
    const put = { ang, y: hy + 0.145 * scale + drop, radius: rad,
                  sx: R_DOME, sy: R_DOME, sz: R_DOME,
                  rot: 0, col: [1, 1, 1], fade: 1 };
    // 首まわりのリング（不とうめい）。ドームの口の高さと太さにそろえる。
    //   sphereGeometry の vFrom=0.30 → 口は中心から下へ 0.588R、口の半径は 0.809R
    const openY = put.y - 0.588 * R_DOME;
    const openR = 0.809 * R_DOME;
    R.drawInstances(helmetRing, [Object.assign({}, put, {
      y: openY, sx: openR / 0.325, sy: 0.30 * scale, sz: openR / 0.325 })]);
    // ドームはガラス。ふちだけ光り、まん中はほとんど透ける（顔が見えないと台なし）。
    // 「明るくするだけ」の合成にする。ふつうの半とうめいだと黒い円ばんになる。
    R.drawInstances(helmet, [Object.assign({}, put, { fade: 0.55 })],
                    { noDepthWrite: true, additive: true, glass: true });
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

  // ✨ 金の軌跡（キーアートのとおり）。上がっているあいだだけ、後ろへ伸びる。
  //    ★出しっぱなしにしない。速いときだけ出すと「速さ」の合図になる。
  if (running && !core.ending && core.player.vy > CJ_JUMP_V * 0.45) {
    trailAcc += dt * 62 * Math.min(core.player.vy / CJ_SPRING_V, 1.2);
    const n = Math.floor(trailAcc); trailAcc -= n;
    for (let i = 0; i < n; i++) {
      const P = worldAt(core.player.px, core.player.y + CJ_PLAYER_H * (0.10 + Math.random() * 0.35),
                        CHICCHI_FRONT * 0.5);
      R.spawn({
        x: P[0] + rnd(-0.11, 0.11), y: P[1], z: P[2] + rnd(-0.08, 0.08),
        vy: -core.player.vy * 0.16, vx: rnd(-0.25, 0.25), vz: 0,
        life: rnd(0.35, 0.85), size: 0.035 + Math.random() * 0.055,
        kind: Math.random() < 0.32 ? 3 : 1, drag: 1.1,
        col: [1.0, 0.80 + Math.random() * 0.18, 0.32 + Math.random() * 0.22],
      });
    }
  }

  R.updateParticles(dt);
  R.drawParticles();

  // ---- HUD ----
  updateVoyagerLines();
  // 🛰 ボイジャーと並走しているあいだは、道具ボタンを引っこめる
  //    （見せ場を隠さない／ここで道具を使わせない）
  {
    const it = document.getElementById('items');
    if (it) it.classList.toggle('hide', voyagerList.length > 0 || !!letter);
  }
  updateNav();
  updateSkyLabels();
  updateStrip();
  updateBestMark();
  updateGhost(dt);
  updateFlags();
  // 🚨 **読ませる／見せるための時計は、実時間で進めること。**
  //   dt は 1/20秒で頭打ちにしてあるので、重い端末では
  //   「2.6秒で次の行」が 15秒かかる（実測。swiftshaderで手紙まで進まなかった）。
  //   ★ゴーストだけは game の dt のまま。過去の自分と同じ時計で走らせないと
  //     くらべものにならない（重い端末が不利にならない）。
  const rdt = realMs / 1000;
  updateArriveTalk(rdt);
  updateJumbo(rdt);
  updateDiag(realMs);
  updateBuddy();

  const nowMs = core.time * 1000;
  const d = core.dist;
  // 🚨 **中身が変わったときだけ書きかえる**（2026-08-21）。
  //   前は毎フレーム innerHTML を作り直していた。165Hz のモニタでは
  //   **1秒に165回、HUDのDOMを丸ごと捨てて作り直していた**ことになる。
  //   ・作り直すたびに `.pop` の popin アニメが0にもどる＝出るはずの字が出ない
  //   ・字の下に置いた3Dの絵と、字の出るタイミングがそろわない＝チカチカに見える
  //   文字列を作るのは安いので、くらべてから書く。
  const html =
    `<div class="row"><span>スコア</span><b>${core.score.toLocaleString()}</b></div>` +
    `<div class="row"><span>きょり</span><b>` +
      `${performance.now() < rouletteUntil ? rouletteValue(d.value) : d.value}` +
      `<u>${d.unit}</u></b></div>` +
    (d.sub ? `<div class="sub2">${d.sub}</div>` : '') +
    `<div class="row"><span>⭐</span><b>${core.starsCollected}</b></div>` +
    (core.relics.length ? `<div class="relics">${core.relics.map(r => r.icon).join('')}</div>` : '') +
    (core.assisting ? `<div class="assist">🚀 どうぐ中は 点が入らない</div>` : '') +
    (nowMs < popUntil ? `<div class="pop">${popText}</div>` : '');
  if (html !== hudHtml) { hudHtml = html; hud.innerHTML = html; }

  // ボイジャーのことば（画面の下のほう、大きめに）
  const vl = document.getElementById('voyline');
  const showing = performance.now() < voyLineUntil;
  const vtext = showing ? voyLineText : '';
  if (vtext !== voyShownText) { voyShownText = vtext; vl.textContent = vtext; }
  vl.classList.toggle('show', showing);

  // 重かったら解像度を落とす。
  // 🚨 ★毎フレーム判定してはいけない。
  //   PCは1フレームが16ms前後なので「13未満」と「20超」を行ったり来たりして、
  //   そのたびに canvas.width を書きかえる＝キャンバスが作り直されて真っ黒が挟まり、
  //   **画面がチカチカする**（PCで発生。本人に指摘された）。
  //   1.2秒ぶんの平均で、決まった段（4段）だけを動かす。
  qWarm += realMs / 1000;
  qAcc += frameMs; qN++;
  qTimer += realMs / 1000;
  if (qTimer > 1.2) {
    const avg = qAcc / Math.max(1, qN);
    qTimer = 0; qAcc = 0; qN = 0;
    // ★立ちあがりは5秒ぶん数えない。3秒だと読みこみの山をまだ拾って、
    //   **最初の1回だけ段が落ちる**（実機の診断で「作りなおし1回」として見えた）。
    if (qWarm < 5) { qSlow = 0; }
    else if (avg > 21) {
      qSlow++;
      // ★3回続けて重かったときだけ落とす（＝3.6秒ずっと重い）。
      //   たまたま重いだけで落とすと、そのたびに canvas を作り直して1回チカッとする。
      if (qSlow >= 3 && qLevel > 0) { qLevel--; R.quality = Q_LEVELS[qLevel]; qSlow = 0; }
    } else {
      qSlow = 0;
      // ★上げるのは「遊んでいないとき」だけ。遊びながら上げ下げすると必ずチカチカする。
      if (!running && avg < 10 && qLevel < Q_LEVELS.length - 1) {
        qLevel++; R.quality = Q_LEVELS[qLevel];
      }
    }
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// テスト用の口
window.__cj = {
    setFloor: v => { PLAT_FLOOR = v; },
  // 🪨 厚み・奥ゆきを走らせたまま変える（見くらべ用。tools/rock.py が使う）
  setThick(cloud, rock, depth) {
    if (cloud) PLAT_THICK = cloud;
    if (rock) PLAT_THICK_ROCK = rock;
    if (depth) PLAT_DEPTH_ROCK = depth;
  },
  thickInfo() { return { cloud: PLAT_THICK, high: PLAT_THICK_HIGH,
                         rock: PLAT_THICK_ROCK, depth: PLAT_DEPTH_ROCK }; },
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
  // 進行度（表示のほうの数字）を指定して、その場所へ飛ぶ
  warpP(progress) {
    // ★確かめ用に飛ぶときは、公園のイントロを終わらせる。
    //   イントロ中はできごと（到着など）を捨てる作りなので、
    //   終わらせずに飛ぶと「月に着いたのに何も起きない」ことになる（実際そうなった）。
    if (intro) { intro = null; parkCrouch = 0; voyLineUntil = 0; running = true; }
    this.warp(cjRawFromProgress(progress));
    return { progress: core.progress, biome: core.biome.key, name: core.biome.name };
  },
  // 空の見どころ（銀河・ブラックホール・明るい星・天の川）へカメラを向ける。
  // ★空のものは向きが毎回ちがうので、確認のときはこれで正面に持ってくる。
  //   カメラは筒の外から中心を見ているので、見たい向きの反対がわに立つ。
  lookAtSky(kind) {
    const b = core.biome;
    const d = kind === 'gal' ? b.galDir : kind === 'lens' ? b.lensDir
            : kind === 'bA' ? b.bA.dir : kind === 'bB' ? b.bB.dir
            : kind === 'band' ? [b.bandDir[2], 0, -b.bandDir[0]]   // 帯は「面の向き」なので90°ずらす
            : b.galDir;
    const ang = Math.atan2(-d[0], -d[2]);
    core.camPx = cjWrap(ang / (Math.PI * 2) * CJ_CIRC);
    core.player.px = core.camPx;
    return { kind, dir: d, camPx: core.camPx, screen: skyScreen(d) };
  },
  skyScreen(d) { return skyScreen(d); },
  // チッチが画面のどこに居るか（-1〜+1）。カメラの検証（climb.py）で使う。
  // ☄️ いま何個の彗星が出ているか（検証用）
  cometCount() { return cometList.length; },
  meteorCount() { return meteorList.length; },
  // ✈️ ジャンボを好きな時点で見る（検証用）
  jumboAt(k) { jumbo = { t: k * JUMBO_SEC, shook: true }; core.jumboDone = true; },
  jumboRot(v) { JUMBO_ROT_OFF = v; },
  talkState() { return arriveTalk ? { kind: arriveTalk.kind, i: arriveTalk.i,
                                      t: +arriveTalk.t.toFixed(2) } : null; },
  // 🏁 プレイの終わりを手で呼ぶ（検証用）
  finishRun() { finishRun(); },
  coopValue() { return Number(lsGet('coop') || 0); },
  // 👻 ゴーストの中身（検証用）
  ghostInfo() {
    const gp = ghostProgress();
    return { path: ghostPath ? ghostPath.length : 0, t: +ghostT.toFixed(1), gp,
             running, ending: !!core.ending, over: core.over,
             y: gp == null ? null : cjYAtProgress(gp), py: core.player.y };
  },
  // 🚩 標の実測用（tools/ui.py が使う）。
  //   ★「立てたつもり」で終わらせない。画面に本当に出ているか（shown）と
  //     縦の位置（top）を、絵といっしょに数字でも見る。
  setFlags(rows) { setFlagData(rows); },
  flagY(p) { return cjFlagY(p); },
  // 👆 タップ・⚡逆フリックの実測用（tools/ui.py）
  flickUsed() { return flickUsed; },
  setFlick(v) { flickUsed = !!v; },
  dragging() { return dragging; },
  // ✨ ジャストの合図を、実際のイベントと同じ道すじで出す
  // ★handleEvents は行列を空にしない（空にするのは core.step の頭）。
  //   ここで消しておかないと、次のコマでもう一度 鳴る。
  fireJust(n) {
    core.events.push({ type: 'just', n: n || 1 });
    handleEvents();
    core.events.length = 0;
  },
  justFlash() { return justFlash; },
  partCount() { return R.parts.filter(p => p.life > 0).length; },
  // 🌀 バネの宙返り：いまの上向きの速さから、回る秒数と滞空時間を出す
  springFlipInfo(vy) {
    const v = vy || CJ_SPRING_V;
    const airT = 2 * Math.max(v, 1) / CJ_GRAVITY;
    return { vy: v, airT, dur: clamp(airT * 0.60, 0.30, 1.25) };
  },
  flagInfo() {
    return flags.map(f => ({
      name: f.name, p: f.p, mine: f.mine, passed: f.passed,
      shown: f.el.classList.contains('show'), top: f.el.style.top,
    }));
  },
  stampInfo() { return { got: Object.keys(loadStamps()).length, all: CJ_STAMP_LIST.length }; },
  chicchiScreen() {
    return screenOf(worldAt(core.player.px, core.player.y, 0)) || { x: 99, y: 99 };
  },
  // 足場が画面のどこに映っているか（コントラストを測るのに使う）
  // ★推測で位置を出さない。**実際に描いている座標そのもの**（platLists）を使う。
  //   自前で計算しなおすと、メッシュの高さぶんずれて、空を測ってしまう。
  // 測定用：足場だけ消す（背景そのものの色を測るため）
  hidePlats(v) { hidePlatsFlag = !!v; },
  platScreens() {
    buildDrawLists();
    const out = [];
    for (const k in platLists) {
      for (const o of platLists[k]) {
        if (o.fade < 0.85) continue;          // 裏側のうすいものは対象外
        const w = [Math.sin(o.ang) * o.radius, o.y, Math.cos(o.ang) * o.radius];
        const sc = screenOf(w);
        if (!sc || sc.behind || Math.abs(sc.x) > 0.72 || Math.abs(sc.y) > 0.66) continue;
        out.push({ type: k, x: sc.x, y: sc.y, fade: +o.fade.toFixed(2) });
      }
    }
    return out;
  },
  // 🪨 足場が画面で何pxに見えているか（幅・高さ）を数える。
  //    ★「厚くした」を見た目の印象で言わないための物差し。tools/rock.py が使う。
  //      高さ÷幅 が小さいほど「板」に見える。雲と岩を同じ物差しで比べられる。
  //    メッシュの実寸は**その場で作りなおして頂点から数える**（決まった形なので毎回同じ）。
  //    本番の描画には一切かかわらないので、重さの心配は要らない。
  platBoxes() {
    buildDrawLists();
    const B = (core.meters >= CJ_SPACE_M)
      ? { normal: buildRockMesh, spring: buildRockSpringMesh, ice: buildRockIceMesh, break: buildRockBreakMesh }
      : { normal: buildCloudMesh, spring: buildSpringMesh, ice: buildIceMesh, break: buildBreakMesh };
    const box = m => {
      const v = m.vertices;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < v.length; i += P_STRIDE) {
        if (v[i] < x0) x0 = v[i];
        if (v[i] > x1) x1 = v[i];
        if (v[i + 1] < y0) y0 = v[i + 1];
        if (v[i + 1] > y1) y1 = v[i + 1];
      }
      return { x0, x1, y0, y1 };
    };
    const cache = {}, out = [];
    const W = cv.width, H = cv.height;
    for (const k in platLists) {
      const bx = cache[k] || (cache[k] = box(B[k]()));
      for (const o of platLists[k]) {
        if (o.fade < 0.85) continue;          // 裏がわのうすいものは対象外
        const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
        // 筒の接線ぞいに lx、たてに ly ずらした所を画面に落とす
        const at = (lx, ly) => screenOf([
          sa * o.radius + ca * lx * o.sx, o.y + ly * o.sy, ca * o.radius - sa * lx * o.sx]);
        const t = at(0, bx.y1), b2 = at(0, bx.y0), l = at(bx.x0, 0), r = at(bx.x1, 0);
        if (!t || !b2 || !l || !r || t.behind || b2.behind || l.behind || r.behind) continue;
        // 🚨 筒の横がわに回りこんだ足場は**斜めから見ている**ので、
        //    横はばが遠近でつぶれる（実測で 6px になった）。厚みの物差しにならない。
        //    こちらを向いている足場だけ数える。
        if (Math.abs(t.x) > 0.15) continue;
        const hPx = Math.abs(b2.y - t.y) * H * 0.5;
        const wPx = Math.abs(r.x - l.x) * W * 0.5;
        if (wPx < 1) continue;
        out.push({ type: k, wPx: +wPx.toFixed(1), hPx: +hPx.toFixed(1),
                   ratio: +(hPx / wPx).toFixed(3) });
      }
    }
    return { thick: +zoneThick(core.meters).toFixed(2), m: Math.round(core.meters), plats: out };
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
