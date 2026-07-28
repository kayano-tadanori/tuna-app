// ============================================================
// 【保管】チッチジャンプ v1（レトロゲー枠でいつか使う・2026-07-28 凍結）
//
// これは「チッチジャンプ2」に作り変える前の、初代チッチジャンプまるごとです。
// 凍結版なので直しません。復活させるときのためにメモを残します。
//
// ■ v1 はどんなゲームだったか
//   ・スコア ＝ 高さ(m) そのもの（maxHeight ÷ 10）
//   ・3000m の月に着いたらエンディングで終了 ＝ 上手い子は全員 3000点でならぶ
//   ・⭐は maxHeight に +30 するだけ（＝3点ぶん）。上限3000のせいで実質意味なし
//   ・バネ雲は 28m を超えると抽選条件が重なって一度も出なかった（v2で修正）
//
// ■ 復活させるときに必要なもの（app.js 側にある共通部品）
//   T_SPRITES / tDrawSprite / makeCharStrip / tSound / tTone / tNote / tAudioCtx
//   getItems / addItem / updateItemButtons / showScreen / showToast
//   saveGameScore / showGameRanking / state.nickname / awardSessionTicket
//   画像：images/chicchi*.png
//
// ■ 復活のさせ方（案）
//   1. この中の関数名を j → j1、jumpState → jump1State などに一括で置きかえる
//   2. index.html に「レトロ版」の画面を足して、initJump1() を呼ぶ
//   3. ランキングのキーは 'jump' ではなく 'jump_retro' にする（v2と混ざらないように）
//      ※ firestore.rules のゲーム名ホワイトリストに 'jump_retro' を足すのを忘れずに
// ============================================================


// ============================================================
// チッチジャンプ（息抜きミニゲーム3）
// ============================================================

const J_W = 260, J_H = 420;
const J_PLAYER_W = 24, J_PLAYER_H = 34, J_PLAYER_S = 2.4;
const J_PLATFORM_W = 54, J_PLATFORM_MIN_W = 30, J_PLATFORM_H = 12;
const J_PLATFORM_SHRINK_SCORE = 300; // このスコアで最小幅まで縮む
const J_GRAVITY = 0.32;
const J_JUMP_V = -9.5;
const J_ROCKET_V = -17;         // ロケット発射の初速
const J_ROCKET_MS = 850;        // 噴射している時間（この間は落下中でも上へ・炎も出る）
const J_ROCKET_THRUST_V = -13;  // 噴射中の上向き速度（重力に負けない）
const J_WING_V = -3;
const J_WING_MS = 6000;
const J_GAP_MIN = 60, J_GAP_MAX = 105;
const J_SCROLL_Y = J_H * 0.42;
const J_HAWK_MIN_SCORE = 15;
const J_HAWK_SPEED = 1.8;
const J_HAWK_SIZE = 26;
const J_KNOCKBACK_VX = 4.5;
const J_KNOCKBACK_VY = -4;
const J_KNOCKBACK_FRICTION = 0.92;
const J_STUN_MS = 500;
const J_SPRING_V = -15.5;      // バネ雲：ふつうより高く飛ぶ
const J_ICE_DRIFT = 1.7;       // 氷雲：着地するとツルッとすべる
const J_BREAK_FADE_MS = 260;   // こわれ雲：踏んだあと消えるまで
const J_BARRIER_MS = 6000;     // オカーンのおにぎりバリア時間
const J_MILESTONE_STEP = 50;   // 到達演出（○m）の間隔
const J_GOAL = 3000;           // ゴール：3000mで月に到着（エンディング）
const J_BALLOON_M = 1000;      // 1000m〜：じゃま役が気球に
const J_SPACE_M = 1500;        // これ以上は宇宙（じゃま役が宇宙人に変わる）
const J_STATION_M = 2000;      // 2000mあたりで宇宙ステーションが背景を通過
const J_UFO_M = 2500;          // 2500mあたりでUFOが背景を通過
const J_SHOOT_M = 2500;        // 2500m超で多めの流れ星が邪魔をしてくる
// 高度で変わる空（スコア＝m のしきい値・上下グラデ色）。宇宙は1500m、月は2000m
const J_SKY_TIERS = [
  { min: 0,    top: '#1a2f6e', bot: '#0a1128' }, // 昼
  { min: 250,  top: '#7a3f2e', bot: '#2c1636' }, // 夕やけ
  { min: 650,  top: '#0e1230', bot: '#05060f' }, // 夜
  { min: 1500, top: '#0a0512', bot: '#000000' }, // 宇宙
];
const J_MILESTONE_CHEERS = [
  'オットン：ようやったチッチ！', 'オカーン：その調子や〜！', 'チッチ：ピピーッ！！',
  'オットン：まだまだいけるで！', 'オカーン：えらいぞ〜！', 'チッチ：たかいピヨ〜！',
];

function jLerpHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// スコアから空の色（ティア間をなめらかに補間）を返す
function jSkyColors(score) {
  let i = 0;
  for (let k = 0; k < J_SKY_TIERS.length; k++) if (score >= J_SKY_TIERS[k].min) i = k;
  const cur = J_SKY_TIERS[i], nxt = J_SKY_TIERS[i + 1];
  if (!nxt) return [cur.top, cur.bot];
  const t = Math.min((score - cur.min) / (nxt.min - cur.min), 1);
  return [jLerpHex(cur.top, nxt.top, t), jLerpHex(cur.bot, nxt.bot, t)];
}

const jumpState = {
  player: { x: J_W / 2 - J_PLAYER_W / 2, y: 0, vy: 0, vx: 0 },
  platforms: [], coins: [], hawk: null, hawkCooldown: 0, stunUntil: 0,
  spawnY: 0, score: 0, maxHeight: 0, starsCollected: 0,
  over: false, dragging: false,
  rafId: null, controlsReady: false,
};

const jumpChars = makeCharStrip('jump-chars');

function jRandGap() { return J_GAP_MIN + Math.random() * (J_GAP_MAX - J_GAP_MIN); }

// 登るほど（スコアが上がるほど）足場が徐々に小さくなる
function jPlatformWidth(score) {
  const t = Math.min(score / J_PLATFORM_SHRINK_SCORE, 1);
  return J_PLATFORM_W - t * (J_PLATFORM_W - J_PLATFORM_MIN_W);
}

function jGenPlatformAt(y) {
  const score = jumpState.score;
  const w = jPlatformWidth(score);
  const x = Math.random() * (J_W - w);
  // 足場タイプの抽選：登るほど特殊足場が出やすくなる
  let type = 'normal';
  const r = Math.random();
  if (score > 45 && r < 0.14) type = 'ice';
  else if (score > 28 && r < 0.28) type = 'break';
  else if (r < (score > 10 ? 0.14 : 0.08)) type = 'spring';
  // 動く足場はふつうの雲だけ（特殊足場は止めておく：難しすぎ防止）
  const moving = type === 'normal' && score > 20 && Math.random() < 0.3;
  jumpState.platforms.push({ x, y, w, type, used: false, breakAt: 0, seed: Math.random(), vx: moving ? (Math.random() < 0.5 ? 1 : -1) * 0.8 : 0 });
  // アイテム抽選：まれにオカーンのおにぎり🍙、そこそこ⭐
  const ir = Math.random();
  if (ir < 0.05) jumpState.coins.push({ x: x + w / 2, y: y - 16, taken: false, kind: 'onigiri' });
  else if (ir < 0.38) jumpState.coins.push({ x: x + w / 2, y: y - 16, taken: false, kind: 'star' });
}

function initJump() {
  document.getElementById('jump-best').textContent = localStorage.getItem('jumpBest') || '0';
  document.getElementById('jump-back').onclick = () => { stopJumpLoop(); jStopBgm(); jumpChars.stop(); showScreen('subject'); };
  document.getElementById('jump-restart').onclick = startJump;
  document.getElementById('jump-rank').onclick = () => showGameRanking('jump', 'チッチジャンプ', 'max');
  document.getElementById('jump-bgm').onclick = () => {
    tSound.bgm = !tSound.bgm;
    localStorage.setItem('tetrisBgm', tSound.bgm ? '1' : '0');
    if (tSound.bgm && !jumpState.over) jStartBgm(); else jStopBgm();
    jUpdateSoundBtns();
  };
  document.getElementById('jump-sfx').onclick = () => {
    tSound.sfx = !tSound.sfx;
    localStorage.setItem('tetrisSfx', tSound.sfx ? '1' : '0');
    if (tSound.sfx) jSfx('coin');
    jUpdateSoundBtns();
  };
  jUpdateSoundBtns();
  document.querySelectorAll('#screen-jump .t-item-btn').forEach(btn => {
    // pointerdownで即発動。操作（ドラッグ）中でも別の指でアイテムを使えるように
    btn.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); jumpUseItem(btn.dataset.item); };
  });
  updateItemButtons();
  if (!jumpState.controlsReady) { initJumpControls(); jumpState.controlsReady = true; }
  startJump();
}

function initJumpControls() {
  const cv = document.getElementById('jump-canvas');
  const area = document.getElementById('screen-jump');
  const setFromEvent = e => {
    if (Date.now() < jumpState.stunUntil) return; // タカに吹っ飛ばされている間は操作を受け付けない
    const r = cv.getBoundingClientRect();
    const relX = (e.clientX - r.left) * (cv.width / r.width);
    jumpState.player.x = Math.max(0, Math.min(J_W - J_PLAYER_W, relX - J_PLAYER_W / 2));
  };
  // ボタン類（戻る・アイテム・もう一回等）の上は移動操作にしない
  const isControl = e => !!e.target.closest('button');
  // 操作している指を pointerId で覚えておき、別の指（アイテム操作など）で移動が止まらないようにする
  let dragId = null;
  area.addEventListener('pointerdown', e => {
    if (isControl(e)) return;
    e.preventDefault();
    dragId = e.pointerId;
    jumpState.dragging = true;
    setFromEvent(e);
  });
  area.addEventListener('pointermove', e => { if (jumpState.dragging && e.pointerId === dragId) setFromEvent(e); });
  // 操作中の指以外が離れても移動は止めない
  const stop = e => { if (e && dragId !== null && e.pointerId !== dragId) return; jumpState.dragging = false; dragId = null; };
  area.addEventListener('pointerup', stop);
  area.addEventListener('pointerleave', stop);
  area.addEventListener('pointercancel', stop);
}

function startJump() {
  if (!spendGameTicket()) return; // 1プレイ＝遊び券1まい
  stopJumpLoop();
  jumpState.platforms = [];
  jumpState.coins = [];
  jumpState.score = 0;
  jumpState.maxHeight = 0;
  jumpState.starsCollected = 0;
  jumpState.over = false;
  jumpState.wingUntil = 0;
  jumpState.barrierUntil = 0;
  jumpState.rocketUntil = 0;
  jumpState.ending = false;
  jumpState.hawk = null;
  jumpState.shooters = [];
  jumpState.shootCooldown = 0;
  jumpState.shootWarned = false;
  jumpState.hawkCooldown = 150;
  jumpState.stunUntil = 0;
  jumpState.nextMilestone = J_MILESTONE_STEP;
  jumpState.milestoneText = '';
  jumpState.milestoneUntil = 0;
  // 夜・宇宙でまたたく星（背景用）
  jumpState.stars = Array.from({ length: 44 }, () => ({ x: Math.random() * J_W, y: Math.random() * J_H, r: Math.random() * 1.2 + 0.4 }));
  document.querySelectorAll('#screen-jump .t-item-btn').forEach(b => b.classList.remove('item-active'));
  const ov = document.getElementById('jump-overlay');
  ov.classList.add('hidden'); ov.classList.remove('ending');

  const startPlatY = J_H - 40;
  jumpState.platforms.push({ x: J_W / 2 - J_PLATFORM_W / 2, y: startPlatY, w: J_PLATFORM_W, type: 'normal', used: false, breakAt: 0, seed: Math.random(), vx: 0 });
  jumpState.player.x = J_W / 2 - J_PLAYER_W / 2;
  jumpState.player.y = startPlatY - J_PLAYER_H;
  jumpState.player.vy = J_JUMP_V;
  jumpState.player.vx = 0;

  jumpState.spawnY = startPlatY - jRandGap();
  while (jumpState.spawnY > -20) {
    jGenPlatformAt(jumpState.spawnY);
    jumpState.spawnY -= jRandGap();
  }

  updateJumpInfo();
  drawJump();
  jumpChars.idle();
  jumpChars.start();
  jStartBgm();
  jumpState.rafId = requestAnimationFrame(jLoop);
}

function stopJumpLoop() { cancelAnimationFrame(jumpState.rafId); }

function jLoop() {
  if (jumpState.over) return;
  if (jumpState.ending) { jDrawEnding(); jumpState.rafId = requestAnimationFrame(jLoop); return; }
  jUpdatePhysics();
  updateJumpInfo();
  drawJump();
  if (jumpState.score >= J_GOAL) { jReachMoon(); jumpState.rafId = requestAnimationFrame(jLoop); return; }
  if (jumpState.player.y > J_H + 20) { jGameOver(); return; }
  jumpState.rafId = requestAnimationFrame(jLoop);
}

function jUpdatePhysics() {
  const p = jumpState.player;
  const now = Date.now();
  const wingOn = now < jumpState.wingUntil;
  const barrierOn = now < jumpState.barrierUntil;
  const rocketOn = now < jumpState.rocketUntil;

  if (wingOn) {
    p.vy = J_WING_V;
  } else if (rocketOn) {
    p.vy = J_ROCKET_THRUST_V;   // 噴射中は落下中でも強制的に上へ吹っ飛ぶ
  } else {
    p.vy += J_GRAVITY;
    if (p.vy > 0) {
      for (const plat of jumpState.platforms) {
        if (plat.used) continue; // こわれ雲は一度きり
        if (p.x + J_PLAYER_W > plat.x && p.x < plat.x + plat.w &&
            p.y + J_PLAYER_H >= plat.y && p.y + J_PLAYER_H <= plat.y + J_PLATFORM_H + 8) {
          if (plat.type === 'spring') {
            p.vy = J_SPRING_V; jSfx('spring'); jumpChars.cheer('びよーん！', 800);
          } else if (plat.type === 'break') {
            p.vy = J_JUMP_V; plat.used = true; plat.breakAt = now; jSfx('break');
          } else if (plat.type === 'ice') {
            p.vy = J_JUMP_V; p.vx = (Math.random() < 0.5 ? -1 : 1) * J_ICE_DRIFT; jSfx('bounce');
          } else {
            p.vy = J_JUMP_V; jSfx('bounce');
          }
          break;
        }
      }
    }
  }
  p.y += p.vy;

  if (p.vx) {
    p.x += p.vx;
    p.vx *= J_KNOCKBACK_FRICTION;
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
    p.x = Math.max(0, Math.min(J_W - J_PLAYER_W, p.x));
  }

  jumpState.platforms.forEach(plat => {
    if (!plat.vx) return;
    plat.x += plat.vx;
    if (plat.x <= 0 || plat.x + plat.w >= J_W) plat.vx *= -1;
  });

  jumpState.coins.forEach(c => {
    if (c.taken) return;
    if (p.x + J_PLAYER_W > c.x - 9 && p.x < c.x + 9 && p.y + J_PLAYER_H > c.y - 9 && p.y < c.y + 9) {
      c.taken = true;
      if (c.kind === 'onigiri') {
        jumpState.barrierUntil = now + J_BARRIER_MS;
        jSfx('onigiri');
        jumpChars.cheer('オカーンのおにぎり！バリアや！', 1400);
      } else {
        jumpState.maxHeight += 30; // スコアボーナスのみ。ガチャ用コインとは切り離す（周回稼ぎ対策）
        jumpState.starsCollected++;
        jSfx('coin');
      }
    }
  });

  // タカ（お邪魔キャラ）：一定スコア以降、時々画面を横切る。触れると吹っ飛ばされる
  if (jumpState.hawk) {
    const h = jumpState.hawk;
    h.x += h.dir * J_HAWK_SPEED;
    const hitHawk = p.x + J_PLAYER_W > h.x - J_HAWK_SIZE / 2 && p.x < h.x + J_HAWK_SIZE / 2 &&
        p.y + J_PLAYER_H > h.y - J_HAWK_SIZE / 2 && p.y < h.y + J_HAWK_SIZE / 2;
    if (hitHawk && (wingOn || barrierOn)) {
      // つばさ・バリア中はタカをはね返す
      jumpState.hawk = null;
      jSfx('onigiri');
      jumpChars.cheer('バリアではね返した！', 1000);
      jumpState.hawkCooldown = 180 + Math.random() * 150;
    } else if (hitHawk) {
      jumpState.hawk = null;
      p.vx = -h.dir * J_KNOCKBACK_VX;
      p.vy = J_KNOCKBACK_VY;
      jumpState.stunUntil = Date.now() + J_STUN_MS;
      jSfx('hawkHit');
      jumpChars.cheer('ふっとばされた！', 1200);
      jumpState.hawkCooldown = 150 + Math.random() * 150;
    } else if (h.x < -J_HAWK_SIZE || h.x > J_W + J_HAWK_SIZE) {
      jumpState.hawk = null;
      jumpState.hawkCooldown = 200 + Math.random() * 200;
    }
  } else if (jumpState.score >= J_HAWK_MIN_SCORE && jumpState.score < J_SHOOT_M) {
    jumpState.hawkCooldown--;
    if (jumpState.hawkCooldown <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      jumpState.hawk = { x: dir === 1 ? -J_HAWK_SIZE : J_W + J_HAWK_SIZE, y: 40 + Math.random() * (J_H * 0.5), dir };
      jSfx('hawkWarn');
      const s = jumpState.score;
      jumpChars.cheer(s >= J_SPACE_M ? '👽 宇宙人や！じゃまするで！' : s >= J_BALLOON_M ? '🎈 気球や！ぶつからんように！' : '🦅 タカや！気をつけて！', 1500);
    }
  }

  // 流れ星（2500m超・多めに降ってきて邪魔をする）
  if (jumpState.score >= J_SHOOT_M) {
    if (!jumpState.shootWarned) { jumpState.shootWarned = true; jSfx('hawkWarn'); jumpChars.cheer('☄️ 流れ星の雨や！気をつけて！', 1800); }
    jumpState.shootCooldown--;
    if (jumpState.shooters.length < 6 && jumpState.shootCooldown <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const sx = dir === 1 ? Math.random() * J_W * 0.45 : J_W - Math.random() * J_W * 0.45;
      jumpState.shooters.push({ x: sx, y: -12, vx: dir * (1.4 + Math.random() * 1.3), vy: 2.6 + Math.random() * 1.8 });
      jumpState.shootCooldown = 12 + Math.random() * 16; // 多め＝短い間隔
    }
  }
  // 流れ星の移動・当たり判定
  for (let i = jumpState.shooters.length - 1; i >= 0; i--) {
    const sh = jumpState.shooters[i];
    sh.x += sh.vx; sh.y += sh.vy;
    const hit = p.x + J_PLAYER_W > sh.x - 6 && p.x < sh.x + 6 && p.y + J_PLAYER_H > sh.y - 6 && p.y < sh.y + 6;
    if (hit && (wingOn || barrierOn)) {
      jumpState.shooters.splice(i, 1); jSfx('onigiri');
    } else if (hit) {
      jumpState.shooters.splice(i, 1);
      p.vx = (p.x + J_PLAYER_W / 2 < sh.x ? -1 : 1) * J_KNOCKBACK_VX;
      p.vy = J_KNOCKBACK_VY;
      jumpState.stunUntil = now + J_STUN_MS;
      jSfx('hawkHit');
      jumpChars.cheer('流れ星にぶつかった！', 1000);
    } else if (sh.y > J_H + 20 || sh.x < -20 || sh.x > J_W + 20) {
      jumpState.shooters.splice(i, 1);
    }
  }

  if (p.y < J_SCROLL_Y && p.vy < 0) {
    const dy = J_SCROLL_Y - p.y;
    p.y = J_SCROLL_Y;
    jumpState.platforms.forEach(plat => { plat.y += dy; });
    jumpState.coins.forEach(c => { c.y += dy; });
    jumpState.spawnY += dy;
    jumpState.maxHeight += dy;
  }

  jumpState.platforms = jumpState.platforms.filter(plat =>
    plat.y < J_H + 30 && !(plat.used && now - plat.breakAt > J_BREAK_FADE_MS));
  jumpState.coins = jumpState.coins.filter(c => !c.taken && c.y < J_H + 30);
  while (jumpState.spawnY > -20) {
    jGenPlatformAt(jumpState.spawnY);
    jumpState.spawnY -= jRandGap();
  }
}

function updateJumpInfo() {
  jumpState.score = Math.floor(jumpState.maxHeight / 10);
  // 到達演出：○mごとに家族が応援（ゴール手前まで）
  if (jumpState.score >= jumpState.nextMilestone && jumpState.nextMilestone < J_GOAL) {
    const m = jumpState.nextMilestone;
    jumpState.milestoneText = `⛰ ${m}m とうたつ！`;
    jumpState.milestoneUntil = Date.now() + 1600;
    jSfx('milestone');
    jumpChars.cheer(J_MILESTONE_CHEERS[(m / J_MILESTONE_STEP - 1) % J_MILESTONE_CHEERS.length], 1600);
    jumpState.nextMilestone += J_MILESTONE_STEP;
  }
  document.getElementById('jump-score').textContent = jumpState.score;
  document.getElementById('jump-coins').textContent = jumpState.starsCollected;
}

// 宇宙ステーション（2000mあたりの背景を通過する）
function jDrawSpaceStation(ctx, cx, cy, now) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(now / 1600) * 0.06);
  // トラス（中央の横棒）
  ctx.strokeStyle = '#9aa5c8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.stroke();
  // ソーラーパネル（左右）
  const panel = (px) => {
    ctx.fillStyle = '#173463'; ctx.fillRect(px - 16, -13, 32, 26);
    ctx.strokeStyle = '#3a6fc0'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(px - 16 + i * 8, -13); ctx.lineTo(px - 16 + i * 8, 13); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(px - 16, 0); ctx.lineTo(px + 16, 0); ctx.stroke();
    ctx.strokeStyle = '#5a8fe0'; ctx.lineWidth = 1.2; ctx.strokeRect(px - 16, -13, 32, 26);
  };
  panel(-30); panel(30);
  // 中央モジュール（白い円筒）
  ctx.fillStyle = '#e6e9f2'; ctx.fillRect(-11, -6, 22, 12);
  ctx.fillStyle = '#cdd6f4'; ctx.fillRect(-11, -6, 22, 3);
  ctx.strokeStyle = '#aab4d4'; ctx.lineWidth = 1; ctx.strokeRect(-11, -6, 22, 12);
  // 先端のドッキング部＋アンテナ
  ctx.fillStyle = '#dfe4f0'; ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9aa5c8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -23); ctx.stroke();
  ctx.fillStyle = '#cdd6f4'; ctx.beginPath(); ctx.arc(0, -25, 2, 0, Math.PI * 2); ctx.fill();
  // 点滅ライト（赤）
  if (Math.floor(now / 500) % 2 === 0) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(0, 7, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// UFO（2500mあたりの背景を通過する空飛ぶ円盤）
function jDrawUFO(ctx, cx, cy, now) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(now / 1300) * 0.05);
  // 下向きビーム（うっすら）
  ctx.fillStyle = 'rgba(120,255,180,0.12)';
  ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(10, 6); ctx.lineTo(22, 44); ctx.lineTo(-22, 44); ctx.closePath(); ctx.fill();
  // 円盤の本体
  ctx.fillStyle = '#8791b0';
  ctx.beginPath(); ctx.ellipse(0, 4, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8d0e8';
  ctx.beginPath(); ctx.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  // ドーム
  ctx.fillStyle = 'rgba(160,220,255,0.85)';
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(200,235,255,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, Math.PI, 0); ctx.stroke();
  // 下の点滅ライト
  const cols = ['#ff6b6b', '#ffd166', '#38d9a9', '#ffd166', '#ff6b6b'];
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = (Math.floor(now / 180) + i) % 5 === 0 ? 1 : 0.5;
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.arc(-16 + i * 8, 8, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// 気球（1000〜1500mのじゃま役。横切って邪魔してくる）
function jDrawBalloon(ctx, x, y, now) {
  ctx.save();
  ctx.translate(x, y + Math.sin(now / 600) * 1.5);
  const rx = 13, ry = 16, cy = -4;
  // ふうせん（しま模様）
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
  const cols = ['#ff6b6b', '#ffd166', '#4f9eff', '#38d9a9'];
  const bw = 2 * rx / cols.length;
  for (let i = 0; i < cols.length; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(-rx + i * bw, cy - ry, bw + 0.6, 2 * ry); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  // 首（下のすぼまり）
  ctx.fillStyle = '#e0c089';
  ctx.beginPath(); ctx.moveTo(-4, cy + ry - 2); ctx.lineTo(4, cy + ry - 2); ctx.lineTo(3, cy + ry + 3); ctx.lineTo(-3, cy + ry + 3); ctx.closePath(); ctx.fill();
  // ロープ＋かご
  ctx.strokeStyle = 'rgba(220,220,230,0.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-3, cy + ry + 3); ctx.lineTo(-4, cy + ry + 10); ctx.moveTo(3, cy + ry + 3); ctx.lineTo(4, cy + ry + 10); ctx.stroke();
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-5, cy + ry + 10, 10, 7);
  ctx.fillStyle = '#6e4620'; ctx.fillRect(-5, cy + ry + 10, 10, 2);
  ctx.restore();
}

// 街のビル群（スタート地点の背景。登るほど下へスクロールして消える）
function jDrawCity(ctx, W, H, off, alpha, now) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const baseY = H + off;
  // [x, 高さ, 幅]
  const blds = [[2, 74, 26], [32, 50, 22], [58, 100, 30], [92, 62, 20], [116, 116, 30], [150, 46, 24], [178, 88, 28], [210, 66, 22], [236, 96, 24]];
  blds.forEach(([bx, bh, bw], idx) => {
    ctx.fillStyle = '#141b33';
    ctx.fillRect(bx, baseY - bh, bw, bh);
    // 灯りのついた窓
    ctx.fillStyle = 'rgba(255,214,120,0.85)';
    for (let wy = baseY - bh + 6; wy < baseY - 5; wy += 9) {
      for (let wx = bx + 4; wx < bx + bw - 3; wx += 8) {
        if (((wx * 3 + wy * 7 + idx * 5) % 4) < 2) ctx.fillRect(wx, wy, 3, 4);
      }
    }
  });
  ctx.restore();
}

// 足場を雲っぽいもこもこ形で描く。タイプごとに色を変える
const J_CLOUD_COLORS = {
  normal: ['rgba(255,255,255,0.95)', 'rgba(170,195,230,0.5)'],
  moving: ['rgba(255,224,140,0.95)', 'rgba(230,170,60,0.45)'],
  spring: ['rgba(120,240,170,0.96)', 'rgba(46,180,110,0.5)'],
  break:  ['rgba(206,198,214,0.9)', 'rgba(140,130,155,0.55)'],
  ice:    ['rgba(200,236,255,0.97)', 'rgba(120,195,240,0.55)'],
};
function jDrawCloud(ctx, x, y, w, h, type) {
  const r = h * 0.85;
  const [main, base] = J_CLOUD_COLORS[type] || J_CLOUD_COLORS.normal;
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.arc(x + r * 0.55, y + h * 0.5, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x + w * 0.38, y + h * 0.32, r * 0.65, 0, Math.PI * 2);
  ctx.arc(x + w * 0.65, y + h * 0.32, r * 0.62, 0, Math.PI * 2);
  ctx.arc(x + w - r * 0.55, y + h * 0.5, r * 0.5, 0, Math.PI * 2);
  ctx.rect(x + r * 0.25, y + h * 0.42, Math.max(w - r * 0.5, 2), h * 0.58);
  ctx.fill();
  ctx.fillStyle = base;
  ctx.fillRect(x + r * 0.25, y + h * 0.72, Math.max(w - r * 0.5, 2), h * 0.28);
  const cx = x + w / 2, cy = y + h * 0.5;
  if (type === 'spring') {
    // 上向き三角（ジャンプ台の目じるし）
    ctx.fillStyle = '#1b6b45';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 4, cy + 2); ctx.lineTo(cx + 4, cy + 2); ctx.closePath(); ctx.fill();
  } else if (type === 'break') {
    // ヒビ
    ctx.strokeStyle = 'rgba(90,80,100,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 6, cy - 3); ctx.lineTo(cx - 1, cy + 1); ctx.lineTo(cx + 3, cy - 2); ctx.lineTo(cx + 7, cy + 2); ctx.stroke();
  } else if (type === 'ice') {
    // きらっと光る点
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 1.2, 0, Math.PI * 2); ctx.arc(cx + 5, cy + 1, 1, 0, Math.PI * 2); ctx.fill();
  }
}

// 宇宙の足場は隕石（岩）。seedで大きさ・形・クレーターがバラける
function jDrawMeteor(ctx, x, y, w, h, type, seed) {
  const cx = x + w / 2, cy = y + h / 2 + 2;
  const rxBase = w / 2 + 3;
  const ry = h / 2 + 4 + seed * 4;   // 縦の大きさをseedでばらつかせる
  let base, dark, edge;
  if (type === 'spring') { base = '#5a7a5f'; dark = '#3c563f'; edge = '#8fe0a5'; }
  else if (type === 'break') { base = '#6b5f57'; dark = '#463d36'; edge = '#9a8b80'; }
  else if (type === 'ice') { base = '#7f9fc0'; dark = '#56769c'; edge = '#cfe8ff'; }
  else if (type === 'moving') { base = '#8a7a5c'; dark = '#65563d'; edge = '#e0c089'; }
  else { base = '#7a736e'; dark = '#4e4844'; edge = '#a89f98'; }
  // 不規則な岩の輪郭
  const pts = 11;
  ctx.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wob = 0.72 + 0.28 * Math.sin(seed * 30 + i * 1.7);
    const px = cx + Math.cos(a) * rxBase * wob;
    const py = cy + Math.sin(a) * ry * (0.72 + 0.28 * Math.cos(seed * 17 + i * 2.1));
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = base; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke();
  // クレーター
  ctx.fillStyle = dark;
  const nc = 2 + Math.floor(seed * 3);
  for (let k = 0; k < nc; k++) {
    const ca = seed * 40 + k * 2.3;
    const cr = rxBase * (0.16 + (Math.sin(seed * 13 + k) * 0.5 + 0.5) * 0.18);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(ca) * rxBase * 0.35, cy + Math.sin(ca) * ry * 0.35, cr, cr * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // タイプの目じるし（雲と同じ位置）
  if (type === 'spring') { ctx.fillStyle = '#8fe0a5'; ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 4, cy + 2); ctx.lineTo(cx + 4, cy + 2); ctx.closePath(); ctx.fill(); }
  else if (type === 'ice') { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(cx - 4, cy - 2, 1.2, 0, Math.PI * 2); ctx.arc(cx + 5, cy + 1, 1, 0, Math.PI * 2); ctx.fill(); }
  else if (type === 'break') { ctx.strokeStyle = 'rgba(20,15,12,0.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 6, cy - 3); ctx.lineTo(cx - 1, cy + 1); ctx.lineTo(cx + 3, cy - 2); ctx.lineTo(cx + 7, cy + 2); ctx.stroke(); }
}

// チッチのお尻からのジェット噴射（fx,fy＝噴射口。下向きに炎）
function jDrawJet(ctx, fx, fy, now) {
  const flick = 0.7 + 0.3 * Math.sin(now / 45) + 0.12 * Math.sin(now / 13);
  const len = 27 * flick, w = 8;
  const flame = (ww, ll, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(fx - ww, fy);
    ctx.quadraticCurveTo(fx - ww * 0.5, fy + ll * 0.6, fx, fy + ll);
    ctx.quadraticCurveTo(fx + ww * 0.5, fy + ll * 0.6, fx + ww, fy);
    ctx.quadraticCurveTo(fx, fy - 3, fx - ww, fy);
    ctx.closePath(); ctx.fill();
  };
  flame(w, len, 'rgba(255,140,40,0.9)');                 // 外炎（オレンジ）
  flame(w * 0.62, len * 0.78, 'rgba(255,214,90,0.95)');  // 中炎（黄）
  flame(w * 0.32, len * 0.5, 'rgba(190,235,255,0.95)');  // 芯（白青）
  // 火花
  ctx.fillStyle = 'rgba(255,190,90,0.9)';
  for (let i = 0; i < 3; i++) {
    const t = (now / 60 + i * 0.5);
    ctx.beginPath();
    ctx.arc(fx + Math.sin(t * 5 + i) * 6, fy + len * (0.5 + (t % 1) * 0.7), 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawJump() {
  const cv = document.getElementById('jump-canvas');
  const ctx = cv.getContext('2d');
  const now = Date.now();
  // 高度で変わる空
  const [skyTop, skyBot] = jSkyColors(jumpState.score);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, skyTop); g.addColorStop(1, skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);

  // スタート地点の街並み（低いところだけ。登るほど下へスクロールしてフェード）
  if (jumpState.score < 450) {
    jDrawCity(ctx, J_W, J_H, jumpState.score * 0.6, Math.max(0, 1 - jumpState.score / 450), now);
  }

  // 夜〜宇宙でまたたく星（夜＝650mに近づくと現れる）
  const nightFactor = Math.min(Math.max((jumpState.score - 450) / 200, 0), 1);
  if (nightFactor > 0 && jumpState.stars) {
    jumpState.stars.forEach((s, i) => {
      ctx.globalAlpha = nightFactor * (0.5 + 0.5 * Math.sin(now / 350 + i));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // 宇宙ステーション：2000mあたりを背景でゆっくり通過（上→下へスクロール）
  const stBand = 200; // ±200mの範囲で見える
  if (jumpState.score > J_STATION_M - stBand && jumpState.score < J_STATION_M + stBand) {
    const tt = (jumpState.score - (J_STATION_M - stBand)) / (stBand * 2); // 0..1
    const stX = J_W * 0.66 + Math.sin(now / 2200) * 10;
    const stY = -30 + tt * (J_H + 60);
    ctx.globalAlpha = Math.min(1, Math.min(tt, 1 - tt) * 5 + 0.2); // 端でうっすらフェード
    jDrawSpaceStation(ctx, stX, stY, now);
    ctx.globalAlpha = 1;
  }

  // UFO：2500mあたりを背景でゆっくり通過
  const ufoBand = 200;
  if (jumpState.score > J_UFO_M - ufoBand && jumpState.score < J_UFO_M + ufoBand) {
    const tt = (jumpState.score - (J_UFO_M - ufoBand)) / (ufoBand * 2);
    const ux = J_W * 0.34 + Math.sin(now / 1700) * 16; // 左寄りをふらふら
    const uy = -30 + tt * (J_H + 60);
    ctx.globalAlpha = Math.min(1, Math.min(tt, 1 - tt) * 5 + 0.2);
    jDrawUFO(ctx, ux, uy, now);
    ctx.globalAlpha = 1;
  }

  const inSpace = jumpState.score >= J_SPACE_M;
  jumpState.platforms.forEach(plat => {
    const type = plat.used ? 'break' : (plat.vx && plat.type === 'normal' ? 'moving' : plat.type);
    if (plat.used) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (now - plat.breakAt) / J_BREAK_FADE_MS); }
    if (inSpace) jDrawMeteor(ctx, plat.x, plat.y, plat.w, J_PLATFORM_H, type, plat.seed != null ? plat.seed : 0.5);
    else jDrawCloud(ctx, plat.x, plat.y, plat.w, J_PLATFORM_H, type);
    if (plat.used) ctx.restore();
  });

  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  jumpState.coins.forEach(c => { if (!c.taken) ctx.fillText(c.kind === 'onigiri' ? '🍙' : '⭐', c.x, c.y); });

  // 流れ星（尾を引いて落ちてくる）
  if (jumpState.shooters && jumpState.shooters.length) {
    ctx.lineCap = 'round';
    jumpState.shooters.forEach(sh => {
      const mag = Math.hypot(sh.vx, sh.vy) || 1;
      const ux = sh.vx / mag, uy = sh.vy / mag, tail = 24;
      const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - ux * tail, sh.y - uy * tail);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(150,190,255,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - ux * tail, sh.y - uy * tail); ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,190,0.5)'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 2.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.lineCap = 'butt';
  }

  if (jumpState.hawk) {
    const h = jumpState.hawk;
    const s = jumpState.score;
    if (s >= J_BALLOON_M && s < J_SPACE_M) {
      // 1000〜1500mは気球
      jDrawBalloon(ctx, h.x, h.y, now);
    } else {
      // 〜1000mはタカ、宇宙（1500m以上）は宇宙人
      const emoji = s >= J_SPACE_M ? '👽' : '🦅';
      ctx.save();
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (h.dir === 1) { ctx.translate(h.x, h.y); ctx.scale(-1, 1); ctx.fillText(emoji, 0, 0); }
      else { ctx.fillText(emoji, h.x, h.y); }
      ctx.restore();
    }
  }

  const wingOn = now < jumpState.wingUntil;
  const barrierOn = now < jumpState.barrierUntil;
  const rocketOn = now < jumpState.rocketUntil;
  const px = jumpState.player.x, py = jumpState.player.y;
  // ロケット噴射：お尻からジェット炎＋スピードライン
  if (rocketOn) {
    jDrawJet(ctx, px + J_PLAYER_W / 2, py + J_PLAYER_H - 2, now);
    ctx.strokeStyle = 'rgba(185,225,255,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const lx = px + (i ? J_PLAYER_W + 5 : -5);
      const off = (now / 22 + i * 9) % 16;
      ctx.beginPath(); ctx.moveTo(lx, py + 8 + off); ctx.lineTo(lx, py + 18 + off); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  // おにぎりバリアの輪（残り時間が短くなると点滅）
  if (barrierOn) {
    const left = jumpState.barrierUntil - now;
    const blink = left > 1500 || Math.floor(now / 150) % 2 === 0;
    if (blink) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,140,190,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px + J_PLAYER_W / 2, py + J_PLAYER_H / 2, 23, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  const sp = T_SPRITES.chicchi;
  const glow = wingOn || barrierOn || rocketOn;
  // 羽ばたき：いつも速くバタバタ。つばさ発動中はさらに速く。ロケット中は加速ポーズ
  const flapMs = wingOn ? 45 : 65;
  const frame = rocketOn ? sp.rocket : (Math.floor(now / flapMs) % 2 ? sp.flapUp : sp.flapDown);
  if (glow) { ctx.save(); ctx.shadowColor = rocketOn ? '#ff8c3a' : wingOn ? '#ffd166' : '#ff8cbe'; ctx.shadowBlur = rocketOn ? 6 : 12; }
  tDrawSprite(ctx, frame, sp.pal, px, py, J_PLAYER_S);
  if (glow) ctx.restore();

  // 到達演出のバナー
  if (now < jumpState.milestoneUntil) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, J_H * 0.33, J_W, 34);
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(jumpState.milestoneText, J_W / 2, J_H * 0.33 + 17);
    ctx.restore();
  }
}

function jumpUseItem(kind) {
  if (jumpState.over) return;
  const items = getItems();
  if ((items[kind] || 0) <= 0) return;

  if (kind === 'wing') {
    if (Date.now() < jumpState.wingUntil) { showToast('つばさはもう発動中やで！'); return; }
    jumpState.wingUntil = Date.now() + J_WING_MS;
    const btn = document.querySelector('#screen-jump .t-item-btn[data-item="wing"]');
    if (btn) { btn.classList.add('item-active'); setTimeout(() => btn.classList.remove('item-active'), J_WING_MS); }
    jSfx('wing');
  } else if (kind === 'rocket') {
    // 噴射中はもう1個消費しない（連打しても数は減らない）
    if (Date.now() < jumpState.rocketUntil) return;
    // 落下中でも一気に上へ。初速＋しばらく噴射（重力に負けない）
    jumpState.rocketUntil = Date.now() + J_ROCKET_MS;
    jumpState.player.vy = J_ROCKET_V;
    const btn = document.querySelector('#screen-jump .t-item-btn[data-item="rocket"]');
    if (btn) { btn.classList.add('item-active'); setTimeout(() => btn.classList.remove('item-active'), J_ROCKET_MS); }
    jSfx('rocket');
    jumpChars.cheer('ロケット発射や！', 1500);
  }
  addItem(kind, -1);
  updateItemButtons();
}

function jGameOver() {
  jumpState.over = true;
  stopJumpLoop();
  jStopBgm();
  const prevBest = Number(localStorage.getItem('jumpBest') || 0);
  const isNewBest = jumpState.score > prevBest;
  jSfx(isNewBest ? 'best' : 'over');
  if (isNewBest) {
    jumpChars.state.mood = 'cheer';
    jumpChars.state.moodUntil = Date.now() + 5000;
    jumpChars.state.bubble = 'ベスト更新や！すごいで！';
    localStorage.setItem('jumpBest', jumpState.score);
  } else {
    jumpChars.state.bubble = 'ドンマイ！もう一回や！';
    setTimeout(() => { if (jumpState.over) jumpChars.state.bubble = ''; }, 4000);
  }
  if (jumpState.score > 0 && typeof saveGameScore === 'function') saveGameScore('jump', state.nickname, jumpState.score, 'max');
  document.getElementById('jump-best').textContent = Math.max(jumpState.score, prevBest);
  document.getElementById('jump-overlay-emoji').classList.toggle('hidden', !isNewBest);
  document.getElementById('jump-overlay-emoji').textContent = '🏆';
  document.getElementById('jump-overlay-img').classList.toggle('hidden', isNewBest);
  document.getElementById('jump-overlay-text').textContent = isNewBest ? 'ベスト更新！' : 'おっこちた！';
  document.getElementById('jump-overlay-score').textContent = `スコア ${jumpState.score}`;
  const ov = document.getElementById('jump-overlay');
  ov.classList.remove('ending'); ov.classList.remove('hidden');
}

// ============================================================
// エンディング：3000mで月に到着（地球が見える）
// ============================================================
function jReachMoon() {
  if (jumpState.ending) return;
  jumpState.ending = true;
  jStopBgm();
  jSfx('moon');
  const prevBest = Number(localStorage.getItem('jumpBest') || 0);
  if (jumpState.score > prevBest) localStorage.setItem('jumpBest', jumpState.score);
  document.getElementById('jump-best').textContent = Math.max(jumpState.score, prevBest);
  if (jumpState.score > 0 && typeof saveGameScore === 'function') saveGameScore('jump', state.nickname, jumpState.score, 'max');
  jumpChars.state.mood = 'cheer';
  jumpChars.state.moodUntil = Date.now() + 8000;
  jumpChars.state.bubble = 'チッチ：月についたピヨ〜！🌙';
  // オーバーレイは「もう一回」ボタンだけ出す（月面シーンはキャンバスに描く）
  const ov = document.getElementById('jump-overlay');
  ov.classList.add('ending'); ov.classList.remove('hidden');
}

// 地球（青い惑星）— 球の陰影・大陸・極の氷・雲つきでそれらしく
function jDrawEarth(ctx, cx, cy, r, now) {
  // 大気のグロー
  const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.45);
  glow.addColorStop(0, 'rgba(130,190,255,0.45)');
  glow.addColorStop(1, 'rgba(130,190,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();

  // 海（左上を明るく＝球の立体感）
  const oc = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.2, cx, cy, r * 1.15);
  oc.addColorStop(0, '#4aa3f0'); oc.addColorStop(0.6, '#2e77d8'); oc.addColorStop(1, '#123a86');
  ctx.fillStyle = oc; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

  // 大陸（不規則な陸地。r基準の相対座標で描く）
  const land = (pts, fill) => {
    ctx.fillStyle = fill; ctx.beginPath();
    pts.forEach(([dx, dy], i) => { const x = cx + dx * r, y = cy + dy * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.fill();
  };
  const G1 = '#3fae5c', G2 = '#2f8f4a';
  // アフリカ／ユーラシア風（中央〜右）
  land([[-0.12, -0.5], [0.18, -0.52], [0.42, -0.22], [0.34, 0.08], [0.5, 0.32], [0.26, 0.56], [0.06, 0.32], [-0.08, 0.5], [-0.22, 0.16], [-0.06, -0.08], [-0.26, -0.28]], G1);
  // 南アメリカ風（左下）
  land([[-0.54, -0.02], [-0.34, -0.12], [-0.28, 0.2], [-0.42, 0.52], [-0.58, 0.34], [-0.6, 0.08]], G1);
  // 北の陸地・島（上）
  land([[-0.34, -0.58], [-0.08, -0.66], [0.02, -0.48], [-0.24, -0.44]], G2);
  land([[0.48, 0.04], [0.6, -0.02], [0.58, 0.2], [0.44, 0.22]], G2);

  // 極の氷（上下の白）
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.9, r * 0.5, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.9, r * 0.56, r * 0.19, 0, 0, Math.PI * 2); ctx.fill();

  // 雲（白いうずまき）
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  [[-0.22, -0.18, 0.3, 0.08, -0.5], [0.26, 0.16, 0.32, 0.09, 0.4], [0.02, 0.46, 0.22, 0.07, 0.15]]
    .forEach(([dx, dy, w, h, rot]) => { ctx.save(); ctx.translate(cx + dx * r, cy + dy * r); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, w * r, h * r, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });

  // 球の陰（右下を暗く＝立体感）
  const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.5, cx, cy, r * 1.1);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,25,0.42)');
  ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

  ctx.restore();

  // 大気のふち
  ctx.strokeStyle = 'rgba(185,218,255,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

// 月面（下から3分の1くらい。ボタンより上にチッチが立てる高さ）
function jDrawMoonGround(ctx, W, H) {
  const top = H - 150;
  ctx.fillStyle = '#c9ccd6';
  ctx.beginPath();
  ctx.moveTo(0, top + 18);
  ctx.quadraticCurveTo(W * 0.5, top - 14, W, top + 18);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(150,155,172,0.6)';
  [[42, top + 32, 10], [95, top + 46, 7], [150, top + 28, 9], [205, top + 42, 8], [232, top + 20, 6], [118, top + 54, 6]]
    .forEach(([x, y, rr]) => { ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.5, 0, 0, Math.PI * 2); ctx.fill(); });
}

// 月に立てる旗
function jDrawFlag(ctx, x, y) {
  ctx.strokeStyle = '#e8e8ef'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke();
  ctx.fillStyle = '#ff6688';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y + 5); ctx.lineTo(x, y + 11); ctx.closePath(); ctx.fill();
}

// 角丸パス（roundRint 未対応ブラウザでも動くよう自前で）
function jRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 月のうさぎ（2羽でお餅つき：つき手＋返し手）＋湯気・伸びる餅・セリフ
function jDrawMoonRabbit(ctx, x, gy, now) {
  const t = Math.sin(now / 240);
  const up = t > 0 ? t : 0;        // 杵をふり上げる量 0..1
  const kineY = gy - 26 - up * 14; // 杵の高さ（先に計算：伸びる餅に使う）
  // うす（臼）とお餅
  ctx.fillStyle = '#5b3d28';
  ctx.beginPath();
  ctx.moveTo(x + 9, gy); ctx.lineTo(x + 29, gy); ctx.lineTo(x + 26, gy + 13); ctx.lineTo(x + 12, gy + 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4f4fa';
  ctx.beginPath(); ctx.ellipse(x + 19, gy + 1, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  // お餅が杵に伸びる（杵が上がるほど伸びる）
  if (up > 0.12) {
    const topY = kineY + 8;
    const midY = (gy + 1 + topY) / 2;
    ctx.fillStyle = '#f4f4fa';
    ctx.beginPath();
    ctx.moveTo(x + 13, gy + 1);
    ctx.quadraticCurveTo(x + 15, midY, x + 17, topY);
    ctx.lineTo(x + 21, topY);
    ctx.quadraticCurveTo(x + 23, midY, x + 25, gy + 1);
    ctx.closePath(); ctx.fill();
  }

  // ── つき手うさぎ（左・立って杵をふる）──
  const bob = up * 3;
  const rx = x - 7, ry = gy - 20 - bob;    // 頭の中心あたり
  ctx.fillStyle = '#f2f2f7';
  ctx.beginPath(); ctx.ellipse(rx, ry + 13, 8, 11, 0, 0, Math.PI * 2); ctx.fill();   // 体
  ctx.beginPath(); ctx.arc(rx, ry, 6.5, 0, Math.PI * 2); ctx.fill();                 // 頭
  [[-3, -0.18], [3, 0.18]].forEach(([ex, rot]) => {
    ctx.save(); ctx.translate(rx + ex, ry - 4); ctx.rotate(rot);
    ctx.fillStyle = '#f2f2f7'; ctx.beginPath(); ctx.ellipse(0, -8, 2.6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9db1'; ctx.beginPath(); ctx.ellipse(0, -8, 1.1, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = '#e84a2e'; ctx.beginPath(); ctx.arc(rx + 2.5, ry, 1.3, 0, Math.PI * 2); ctx.fill();
  // 杵（きね）
  ctx.strokeStyle = '#c9975b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 19, kineY + 8); ctx.lineTo(x + 19, gy - 2); ctx.stroke();   // 柄
  ctx.fillStyle = '#e0c089';
  ctx.fillRect(x + 14, kineY, 10, 8);                                                          // 杵の頭
  ctx.strokeStyle = '#f2f2f7'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(rx + 5, ry + 10); ctx.lineTo(x + 17, kineY + 6); ctx.stroke();   // 腕

  // ── 返し手うさぎ（右・しゃがんでお餅をこねる。杵が上がった時に手を入れる）──
  const tx = x + 41, ty = gy - 4;
  ctx.fillStyle = '#e6e6ef';
  ctx.beginPath(); ctx.ellipse(tx, ty, 7, 6.5, 0, 0, Math.PI * 2); ctx.fill();       // 体（しゃがみ）
  ctx.beginPath(); ctx.arc(tx - 1, ty - 6, 5.5, 0, Math.PI * 2); ctx.fill();         // 頭
  [[-2, -0.5], [2.5, -0.95]].forEach(([ex, rot]) => {
    ctx.save(); ctx.translate(tx - 1 + ex, ty - 9); ctx.rotate(rot);
    ctx.fillStyle = '#e6e6ef'; ctx.beginPath(); ctx.ellipse(0, -5, 2.2, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9db1'; ctx.beginPath(); ctx.ellipse(0, -5, 0.9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = '#e84a2e'; ctx.beginPath(); ctx.arc(tx - 3, ty - 6, 1.2, 0, Math.PI * 2); ctx.fill();
  // 腕：杵が上がっている時（up大）だけお餅へ手を入れ、下りる時は引っこめる
  const handX = x + 21 + (1 - up) * 9;
  const handY = gy + 1 + (1 - up) * 3;
  ctx.strokeStyle = '#e6e6ef'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(tx - 3, ty + 1); ctx.lineTo(handX, handY); ctx.stroke();

  // ── 湯気（お餅からゆらゆら立ちのぼる）──
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let s = 0; s < 3; s++) {
    const phase = (now / 900 + s * 0.33) % 1;   // 0→1でのぼる
    const baseY = gy - 6 - phase * 28;
    const bx = x + 13 + s * 6;
    const sway = 4 * Math.sin(now / 200 + s * 2);
    ctx.globalAlpha = 0.7 * (1 - phase);
    ctx.beginPath();
    ctx.moveTo(bx, baseY);
    ctx.quadraticCurveTo(bx + sway, baseY - 7, bx - sway * 0.5, baseY - 14);
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';

  // ── うさぎのセリフ（数秒ごとに切りかわる）──
  const lines = ['ぺったん♪', 'よいしょ！', 'いらっしゃい', 'おいしいよ', 'もちどうぞ'];
  const msg = lines[Math.floor(now / 2600) % lines.length];
  ctx.font = 'bold 11px sans-serif';
  const bw = ctx.measureText(msg).width + 14;
  const bx = x - 4, by = gy - 54;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  jRoundRect(ctx, bx, by, bw, 18, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx + 12, by + 18); ctx.lineTo(bx + 8, by + 25); ctx.lineTo(bx + 19, by + 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2a1e'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(msg, bx + 7, by + 9);
}

function jDrawEnding() {
  const cv = document.getElementById('jump-canvas');
  const ctx = cv.getContext('2d');
  const now = Date.now();
  // 宇宙の背景
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#05010f'); g.addColorStop(1, '#000000');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  // 星
  if (jumpState.stars) {
    jumpState.stars.forEach((s, i) => {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 400 + i));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  // 地球（お空に大きく見える）
  jDrawEarth(ctx, 84, 132, 44, now);
  // 月面
  jDrawMoonGround(ctx, cv.width, cv.height);
  // 月のうさぎ（お餅つき）
  jDrawMoonRabbit(ctx, 48, J_H - 132, now);
  // チッチ（月面でぴょこぴょこ喜ぶ）＋旗
  const sp = T_SPRITES.chicchi;
  const bob = Math.abs(Math.sin(now / 220)) * 5;
  const cx = J_W / 2 - (10 * J_PLAYER_S) / 2 + 16;   // うさぎ＆吹き出しに場所をゆずって少し右へ
  const cy = J_H - 182 - bob;
  jDrawFlag(ctx, cx + 30, cy - 2);
  const frame = Math.floor(now / 160) % 2 ? sp.cheer : sp.flapUp;
  ctx.save(); ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 10;
  tDrawSprite(ctx, frame, sp.pal, cx, cy, J_PLAYER_S);
  ctx.restore();
  // お祝いテキスト
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 22, J_W, 68);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 21px sans-serif';
  ctx.fillText('🌙 月にとうちゃく！', J_W / 2, 46);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${J_GOAL}m 達成！おめでとう！`, J_W / 2, 74);
}

// ── サウンド（tSound設定・tTone/tNoteエンジンを共用） ──
function jSfx(kind) {
  if (!tSound.sfx) return;
  switch (kind) {
    case 'bounce': tTone(300, 0.06, 'square', 0.08, 0, 500); break;
    case 'coin':   tTone(880, 0.05, 'square', 0.08); tTone(1320, 0.05, 'square', 0.06, 0.05); break;
    case 'wing':   [440, 660, 880].forEach((f, i) => tTone(f, 0.08, 'triangle', 0.09, i * 0.06)); break;
    case 'rocket':
      tTone(110, 0.85, 'sawtooth', 0.13, 0, 55);   // 低い轟音（ゴォー…）
      tTone(220, 0.85, 'square', 0.05, 0, 130);     // 中音のうなり
      tTone(1400, 0.55, 'sawtooth', 0.06, 0, 320);  // シューッという噴射
      tTone(320, 0.2, 'sawtooth', 0.1, 0, 1200);    // 発射の「キュイン」
      break;
    case 'hawkWarn': tTone(1200, 0.12, 'sawtooth', 0.1, 0, 700); break;
    case 'hawkHit':  tTone(120, 0.25, 'square', 0.18, 0, 40); break;
    case 'spring':   [660, 990, 1320].forEach((f, i) => tTone(f, 0.08, 'square', 0.09, i * 0.05)); break;
    case 'break':    tTone(220, 0.14, 'sawtooth', 0.12, 0, 70); break;
    case 'onigiri':  [523, 659, 784, 1047].forEach((f, i) => tTone(f, 0.1, 'triangle', 0.1, i * 0.06)); break;
    case 'milestone':[784, 988, 1175, 1568].forEach((f, i) => tTone(f, 0.11, 'square', 0.1, i * 0.07)); break;
    case 'moon':     [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) => tTone(f, 0.16, 'square', 0.12, i * 0.13)); break;
    case 'over':   [392, 330, 262, 196].forEach((f, i) => tTone(f, 0.22, 'triangle', 0.13, i * 0.18)); break;
    case 'best':   [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tTone(f, 0.12, 'square', 0.12, i * 0.1)); break;
  }
}

const J_MELODY = [
  'E5', 0, 'G5', 0, 'C6', 0, 'G5', 0, 'A5', 0, 'C6', 0, 'E6', 0, 'C6', 0,
  'D5', 0, 'F5', 0, 'A5', 0, 'F5', 0, 'G5', 0, 'B5', 0, 'D6', 0, 'B5', 0,
];
const J_BASS = ['C3', 'G2', 'A2', 'F2'];

function jStartBgm() {
  jStopBgm();
  if (!tSound.bgm) return;
  tAudioCtx();
  jumpState.bgmStep = 0;
  jumpState.bgmTimer = setInterval(() => {
    const n = J_MELODY[jumpState.bgmStep % J_MELODY.length];
    if (n) tTone(tNote(n), 0.16, 'triangle', 0.05);
    if (jumpState.bgmStep % 8 === 0) {
      tTone(tNote(J_BASS[Math.floor(jumpState.bgmStep / 8) % J_BASS.length]), 0.4, 'sine', 0.08);
    }
    jumpState.bgmStep++;
  }, 200);
}
function jStopBgm() { clearInterval(jumpState.bgmTimer); jumpState.bgmTimer = null; }

function jUpdateSoundBtns() {
  document.getElementById('jump-bgm').classList.toggle('on', tSound.bgm);
  document.getElementById('jump-sfx').classList.toggle('on', tSound.sfx);
}