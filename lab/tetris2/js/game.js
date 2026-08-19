// ============================================================
// game.js — 進行・入力・演出・描画データの組み立て
//   ロジック(core.js)と見た目(renderer.js)をつなぐ層
//   ・入力は即時処理／描画は rAF で1回だけ
//   ・ヒットストップ中も入力は取り、再開1フレーム目でまとめて処理
//   ・ライン消しは「論理は即時・見た目は後追い」
// ============================================================
'use strict';

// ---------------- 駒の色（拡散／発光／リム） ----------------
const COLORS = {
  I: { base: '#12C8F5', emis: '#7FF0FF' },
  O: { base: '#FFC21A', emis: '#FFE58A' },
  T: { base: '#9B3BFF', emis: '#D08CFF' },
  S: { base: '#12D47E', emis: '#79F5BE' },
  Z: { base: '#FF2E5B', emis: '#FF8AA3' },
  J: { base: '#3A46E8', emis: '#8AA6FF' },
  L: { base: '#FF7A14', emis: '#FFB673' },
};
for (const k in COLORS) { COLORS[k].rgb = hex2rgb(COLORS[k].base); COLORS[k].erg = hex2rgb(COLORS[k].emis); }

const WHITE = [1, 1, 1];
const WELL_EDGE = hex2rgb('#2A46C8');
const GRID_COL = hex2rgb('#161f4a');
const SLOW_EDGE = hex2rgb('#8FE9FF');   // I駒・S駒と混ざらない氷色

// 本体ではガチャの在庫を読む。試作では毎回この数だけ配る
const ITEM_START = { bomb: 2, slow: 2 };

const G = {
  mode: 'title',            // title | play | pause | over
  diff: 'easy',
  core: null,
  t: 0, last: 0,
  hitstop: 0,
  queueIn: [],
  trauma: 0,
  dolly: 0, fovKick: 0, pitchAdd: 0, boardRoll: 0,
  flash: 0, flashCol: [1, 1, 1],
  shock: [0.5, 0.5, 0, 0],
  fade: 0, sat: 1,
  intensity: 0,
  bgHue: 0.62, bgHueTarget: 0.62,
  danger: 0,
  best: Number(localStorage.getItem('tetris2Best') || 0),
  snapshot: null,
  clearFx: null,
  fallOff: new Float32Array(BOARD_H),
  fallT: 999,
  lockFlash: new Map(),     // 'x,y' -> t
  slotSpin: 0,
  frameMs: 16, slowCount: 0, fastCount: 0,
  overAnim: 0,
  yawSmooth: 0,
  beat: 0,
  overReady: false,
  waitingStart: false, waitTimer: null,
  items: { bomb: 0, slow: 0 },
  slowT: 0, slowMax: 15,
  bombArmed: false, bombTimer: null,
  ticks: 0,
  calm: localStorage.getItem('tetris2Calm') === '1',
};

let R, els = {};

// ============================================================
// オトン学園の中（iframe）で動いているときの作法
//   ・プレイ開始のたびに親へ「遊び券つかっていい？」と聞く
//   ・ゲームオーバーでスコアを親へ渡す（Firestoreのランキングへ）
// ============================================================
const EMBED = new URLSearchParams(location.search).has('embed');
function post(msg) { if (EMBED && window.parent !== window) window.parent.postMessage(msg, '*'); }

function requestStart() {
  if (!EMBED) { startGame(); return; }
  if (G.waitingStart) return;
  G.waitingStart = true;
  post({ type: 't2-start-request' });
  clearTimeout(G.waitTimer);
  G.waitTimer = setTimeout(() => { G.waitingStart = false; }, 4000);
}

window.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 't2-start-ok') { G.waitingStart = false; startGame(); }
  else if (d.type === 't2-start-deny') {
    G.waitingStart = false;
    const t = document.getElementById('cost-note');
    if (t) { t.textContent = d.msg || '遊び券がたりないで'; t.classList.remove('hidden'); }
    Snd.sfx('over');
  } else if (d.type === 't2-name' && d.name) {
    localStorage.setItem('tetris2Name', String(d.name).slice(0, 8));
    const i = document.getElementById('name-input');
    if (i) i.value = String(d.name).slice(0, 8);
  }
});

// ============================================================
// 起動
// ============================================================
window.addEventListener('load', () => {
  const cv = document.getElementById('gl');
  try {
    R = new Renderer(cv);
    R.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    R.resize(true);
  } catch (e) {
    document.body.innerHTML = '<div style="padding:40px;font-size:16px;line-height:2">' +
      'このブラウザでは WebGL2 が使えないため動きません<br><small>' + e.message + '</small></div>';
    return;
  }

  els = {
    stage: document.getElementById('stage'),
    score: document.getElementById('v-score'),
    level: document.getElementById('v-level'),
    lines: document.getElementById('v-lines'),
    best: document.getElementById('v-best'),
    big: document.getElementById('big-text'),
    sub: document.getElementById('sub-text'),
    combo: document.getElementById('combo-text'),
    bubble: document.getElementById('char-bubble'),
    title: document.getElementById('title-screen'),
    pause: document.getElementById('pause-screen'),
    over: document.getElementById('over-screen'),
    fps: document.getElementById('fps'),
    hud: document.getElementById('hud-top'),
    slowBtn: document.querySelector('.item-btn[data-item="slow"]'),
    slowRing: document.querySelector('.item-btn[data-item="slow"] .cool circle'),
    slowCount: document.getElementById('it-slow'),
    chars: document.getElementById('chars'),
  };
  els.best.textContent = G.best;
  if (EMBED) {
    document.getElementById('cost-note').classList.remove('hidden');
    ['btn-exit', 'btn-exit2'].forEach(id => {
      const el = document.getElementById(id);
      el.classList.remove('hidden');
      el.onclick = () => { Snd.stopBgm(0.1); Snd.sfx('ui'); post({ type: 't2-exit' }); };
    });
    post({ type: 't2-ready' });
  }

  Cheer.init(FLOOR_Y + 0.02);
  // AudioContextは停止状態で先に作れる。重いリバーブ生成を
  // 「スタート」タップの外へ追い出す（タップ時に固まらない）
  setTimeout(() => { try { Snd.init(); } catch (e) {} }, 60);
  Snd.wantBgm = () => G.mode === 'play';
  bindUI();
  bindInput();
  measureLayout();
  window.addEventListener('resize', () => { R.resize(); measureLayout(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { R.resize(true); measureLayout(); }, 300));

  // 画面を離れたら止める／戻ったら音を復帰させる（iOSはこれが無いと無音のまま）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (G.mode === 'play') togglePause();
      Snd.stopBgm(0.1);
    } else {
      Snd.resume();
      if (G.mode === 'play') Snd.startBgm();
      G.last = performance.now();
    }
  });
  window.addEventListener('pagehide', () => Snd.stopBgm(0.05));

  G.last = performance.now();
  requestAnimationFrame(loop);
});

// ============================================================
// 画面の矩形（CSSピクセル）
// ============================================================
let LAYOUT = { play: { x: 0, y: 0, w: 100, h: 100 }, slots: [] };

function measureLayout() {
  const hud = els.hud.getBoundingClientRect();
  const chars = els.chars.getBoundingClientRect();
  const top = hud.bottom + 4;
  const bottom = chars.top - 2;
  LAYOUT.play = { x: 0, y: top, w: window.innerWidth, h: Math.max(120, bottom - top) };
  LAYOUT.slots = [...document.querySelectorAll('.slot')].map(el => {
    const r = el.getBoundingClientRect();
    return { key: el.dataset.slot, rect: { x: r.left, y: r.top, w: r.width, h: r.height } };
  });
}

// ============================================================
// UI
// ============================================================
function bindUI() {
  document.querySelectorAll('.diff').forEach(b => b.onclick = () => {
    document.querySelectorAll('.diff').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); G.diff = b.dataset.diff; Snd.sfx('ui');
  });
  document.getElementById('btn-start').onclick = () => { Snd.resume(); requestStart(); };
  document.getElementById('btn-retry').onclick = () => { Snd.sfx('ui'); requestStart(); };
  document.getElementById('btn-title').onclick = () => { Snd.sfx('ui'); toTitle(); };
  document.getElementById('btn-pause').onclick = () => togglePause();
  document.getElementById('btn-resume').onclick = () => togglePause();
  document.getElementById('btn-quit').onclick = () => { togglePause(); toTitle(); };
  document.getElementById('btn-bgm').onclick = e => {
    Snd.bgmOn = !Snd.bgmOn; e.target.classList.toggle('on', Snd.bgmOn);
    if (Snd.bgmOn && G.mode === 'play') Snd.startBgm(); else Snd.stopBgm();
  };
  const calmBtns = [document.getElementById('btn-calm'), document.getElementById('btn-calm2')];
  const syncCalm = () => calmBtns.forEach(b => b && b.classList.toggle('on', !G.calm));
  calmBtns.forEach(b => b && (b.onclick = () => {
    G.calm = !G.calm;
    localStorage.setItem('tetris2Calm', G.calm ? '1' : '0');
    syncCalm(); Snd.sfx('ui');
  }));
  syncCalm();
  const nameInput = document.getElementById('name-input');
  if (nameInput) {
    nameInput.value = localStorage.getItem('tetris2Name') || '';
    nameInput.addEventListener('input', () => Rank.setName(nameInput.value));
    nameInput.addEventListener('blur', () => { nameInput.value = localStorage.getItem('tetris2Name') || ''; });
  }
  document.getElementById('btn-rank').onclick = () => { Snd.sfx('ui'); Rank.show(); };
  document.getElementById('btn-rank2').onclick = () => { Snd.sfx('ui'); Rank.show(); };
  document.getElementById('btn-rank-close').onclick = () => { Snd.sfx('ui'); Rank.hide(); };

  document.querySelectorAll('.item-btn').forEach(btn => {
    btn.addEventListener('pointerdown', e => { e.preventDefault(); useItem(btn.dataset.item); }, { passive: false });
  });

  const trackBtns = [document.getElementById('btn-track'), document.getElementById('btn-track2')];
  const syncTrack = () => {
    const koro = Snd.track === 'koro';
    trackBtns.forEach(b => { if (!b) return; b.classList.add('on'); b.classList.toggle('koro', koro); });
    const t1 = document.getElementById('btn-track');
    if (t1) t1.textContent = koro ? '♪ コロブチカ' : '♪ オトン';
    const t2 = document.getElementById('btn-track2');
    if (t2) t2.textContent = koro ? '♪ BGM：コロブチカ' : '♪ BGM：オトン';
  };
  trackBtns.forEach(b => b && (b.onclick = () => {
    Snd.resume();
    Snd.setTrack(Snd.track === 'koro' ? 'neon' : 'koro');
    syncTrack(); Snd.sfx('ui');
    if (G.mode === 'title') Snd.preview();   // どんな曲か聴かせてから選ばせる
  }));
  syncTrack();
  document.getElementById('btn-sfx').onclick = e => {
    Snd.sfxOn = !Snd.sfxOn; e.target.classList.toggle('on', Snd.sfxOn);
    if (Snd.sfxOn) Snd.sfx('ui');
  };
}

function toTitle() {
  G.mode = 'title';
  Rank.hide();
  els.stage.classList.add('title-mode');
  els.stage.classList.remove('over-mode');
  Snd.stopBgm();
  els.over.classList.add('hidden');
  els.pause.classList.add('hidden');
  els.title.classList.remove('hidden');
  G.fade = 0; G.sat = 1; G.overAnim = 0;
  setTimeout(measureLayout, 30);
}

function startGame() {
  Snd.resume();
  Rank.hide();
  els.stage.classList.remove('title-mode');
  els.stage.classList.remove('over-mode');
  els.title.classList.add('hidden');
  els.over.classList.add('hidden');
  els.pause.classList.add('hidden');
  G.core = new TetrisCore(HOOKS, G.diff);
  G.mode = 'play';
  G.trauma = 0; G.dolly = 0; G.fovKick = 0; G.boardRoll = 0;
  G.flash = 0; G.fade = 0; G.sat = 1; G.overAnim = 0;
  G.intensity = 0; G.clearFx = null; G.fallT = 999; G.lockFlash.clear();
  G.overReady = false;
  G.hitstop = 0; G.queueIn.length = 0;
  R.parts.length = 0;
  Snd.stopBgm(0.05);
  Snd.setLevel(1);
  Snd.startBgm();
  Cheer.reset(G.t);
  G.items = { bomb: ITEM_START.bomb, slow: ITEM_START.slow };
  G.slowT = 0; G.slowMax = SLOW_MS / 1000;
  G.bombArmed = false; clearTimeout(G.bombTimer);
  document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('armed'));
  updateItemUI(); updateSlowRing();
  updateHud(true);
  setTimeout(measureLayout, 30);
  say('いくで！', 1400);
}

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'pause';
    els.pause.classList.remove('hidden');
    Snd.stopBgm();
  } else if (G.mode === 'pause') {
    G.mode = 'play';
    els.pause.classList.add('hidden');
    Snd.startBgm();
    G.last = performance.now();
  }
}

function updateHud(force) {
  const c = G.core; if (!c) return;
  if (force || els.score._v !== c.score) {
    const big = force || c.score - (els.score._v || 0) >= 20;
    els.score.textContent = c.score;
    els.score._v = c.score;
    if (big) { els.score.classList.remove('pop'); void els.score.offsetWidth; els.score.classList.add('pop'); }
  }
  els.level.textContent = c.level;
  els.lines.textContent = c.lines;
  els.best.textContent = Math.max(G.best, c.score);
}

function bigText(main, sub, cls) {
  els.big.textContent = main;
  if (main.length > 10) cls = (cls || '') + ' long';
  els.big.className = ''; void els.big.offsetWidth; els.big.className = 'show ' + (cls || '');
  els.sub.textContent = sub || '';
  els.sub.className = ''; void els.sub.offsetWidth; if (sub) els.sub.className = 'show';
}

function comboText(n) {
  els.combo.textContent = 'COMBO ×' + n;
  els.combo.style.color = n >= 12 ? '#fff' : n >= 8 ? '#FF3DDA' : n >= 5 ? '#FF9A3C' : '#FFD447';
  els.combo.className = ''; void els.combo.offsetWidth; els.combo.className = 'show';
}

let sayTimer = null;
function say(msg, ms) {
  els.bubble.textContent = msg;
  els.bubble.classList.add('show');
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => els.bubble.classList.remove('show'), ms || 1600);
}

function cheer(power) {
  Cheer.cheer(power === undefined ? 0.6 : power, G.t);
}

// ============================================================
// 入力
// ============================================================
const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
  ArrowUp: 'rotR', KeyX: 'rotR', KeyZ: 'rotL', Space: 'drop',
  KeyC: 'hold', ShiftLeft: 'hold', KeyP: 'pause', Escape: 'pause',
};
const held = { left: 0, right: 0, down: false, dir: 0, t: 0, rep: false };

function bindInput() {
  // --- キーボード ---
  window.addEventListener('keydown', e => {
    const a = KEYMAP[e.code]; if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    press(a, 'key');
  });
  window.addEventListener('keyup', e => {
    const a = KEYMAP[e.code]; if (!a) return;
    release(a);
  });

  // --- パッド ---
  document.querySelectorAll('.pkey').forEach(btn => {
    const a = btn.dataset.k;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault(); btn.setPointerCapture(e.pointerId);
      btn.classList.add('on'); press(a, 'touch');
    }, { passive: false });
    const up = e => { btn.classList.remove('on'); release(a); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  // --- 盤面のスワイプ（補助） ---
  const stage = document.getElementById('stage');
  let sw = null;
  stage.addEventListener('pointerdown', e => {
    if (G.mode !== 'play') return;
    if (e.target.closest('.pkey, .corner-btn, .screen-ov, .item-btn')) return;
    const p = LAYOUT.play;
    if (e.clientY < p.y || e.clientY > p.y + p.h) return;
    sw = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, done: false, id: e.pointerId };
  }, { passive: false });
  stage.addEventListener('pointermove', e => {
    if (!sw || e.pointerId !== sw.id || sw.done) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    sw.moved += Math.abs(dx) + Math.abs(dy);
    // 横：24pxごとに1マス
    while (Math.abs(e.clientX - sw.x) >= 24) {
      const s = Math.sign(e.clientX - sw.x);
      press(s > 0 ? 'right' : 'left', 'swipe'); release(s > 0 ? 'right' : 'left');
      sw.x += 24 * s;
    }
    // 下：速い＝ハードドロップ／遅い＝ソフトドロップ
    const totalY = e.clientY - sw.y0, totalX = Math.abs(e.clientX - sw.x0);
    const dt = performance.now() - sw.t0;
    if (totalY > 60 && dt < 170 && totalY > totalX * 2) {
      press('drop', 'swipe'); release('drop'); sw.done = true;
    } else if (e.clientY - sw.y >= 24) {
      press('down', 'swipe'); release('down'); sw.y = e.clientY;
    }
  }, { passive: false });
  const swEnd = e => {
    if (!sw || sw.done) { sw = null; return; }
    const dt = performance.now() - sw.t0;
    if (sw.moved < 12 && dt < 220) { press('rotR', 'tap'); release('rotR'); }
    sw = null;
  };
  stage.addEventListener('pointerup', swEnd);
  stage.addEventListener('pointercancel', swEnd);
  stage.addEventListener('contextmenu', e => e.preventDefault());
}

function press(a, src) {
  if (a === 'pause') { togglePause(); return; }
  if (G.mode === 'title') { if (a === 'drop') requestStart(); return; }
  if (G.mode === 'over') { if (G.overReady) requestStart(); return; }
  if (G.mode !== 'play') return;

  if (a === 'left' || a === 'right') {
    held[a] = 1; held.dir = (a === 'left' ? -1 : 1);
    held.t = 0; held.rep = false;
    const cfg = (G.core && G.core.cfg) || { das: 0.133, arr: 0.033 };
    held.das = cfg.das * (src === 'key' ? 1 : 1.22);
    held.arr = cfg.arr * (src === 'key' ? 1 : 1.22);
  }
  if (a === 'down') held.down = true;
  act(a);
}

function release(a) {
  if (a === 'left' || a === 'right') {
    held[a] = 0;
    if (held.left) held.dir = -1; else if (held.right) held.dir = 1; else held.dir = 0;
  }
  if (a === 'down') held.down = false;
}

// 実際の操作（ヒットストップ中はキューへ）
function act(a) {
  if (a.startsWith('item:')) { useItem(a.slice(5)); return; }
  if (G.hitstop > 0) { if (G.queueIn.length < 6) G.queueIn.push(a); return; }
  const c = G.core;
  if (!c || c.over) return;
  switch (a) {
    case 'left':  if (c.move(-1)) Snd.sfx('move'); break;
    case 'right': if (c.move(1))  Snd.sfx('move'); break;
    case 'down':  if (c.softDrop()) Snd.sfx('soft'); break;
    case 'rotL':  if (c.rotate(-1)) Snd.sfx(c.lastKick ? 'kick' : 'rotate'); break;
    case 'rotR':  if (c.rotate(1))  Snd.sfx(c.lastKick ? 'kick' : 'rotate'); break;
    case 'drop':  c.hardDrop(); break;
    case 'hold':  if (c.holdPiece()) Snd.sfx('hold'); break;
  }
}

// ============================================================
// ゲームからの通知（＝演出のトリガ）
// ============================================================
const HOOKS = {
  onSpawn() { /* スポーンごとの演出はなし（テンポ優先） */ },

  onHardDrop(from, to) {
    const c = G.core;
    Snd.sfx('harddrop');
    // 落下の軌跡（縦に伸びる加算の板）
    const col = COLORS[c.cur.type].erg;
    for (const [cx, cy] of c.cellsOf(c.cur.type, c.cur.rot, c.cur.x, to)) {
      const len = (to - from);
      if (len < 1) continue;
      R.spawn({
        x: cellX(cx), y: cellY(cy) + len / 2, z: 0.15,
        vx: 0, vy: 0, g: 0, drag: 0.01,
        col, alpha: 0.5, life: 0.18, kind: 2,
        size: len * 0.5, aspect: 0.9 / (len * 0.5), rot: Math.PI / 2, fade: 'out',
      });
    }
    addTrauma(0.30);
    G.dolly -= 0.35;
    const px = cellX(c.cur.x + 1.5);
    let near = null, best = 1e9;
    for (const ch of Cheer.list) { const d = Math.abs(ch.x - px); if (d < best) { best = d; near = ch; } }
    if (near && near.mood !== 'sad') { near.hop = 0.0001; near.hopPow = 0.42; }
  },

  onLock(placed, hard) {
    const c = G.core;
    // 直前の盤面（ライン消し前）を控える
    G.snapshot = c.board.map(r => r.slice());
    const col = COLORS[c.cur.type].erg;
    for (const [cx, cy] of placed) {
      if (cy < 0) continue;
      G.lockFlash.set(cx + ',' + cy, 0);
    }
    if (hard) {
      Snd.sfx('impact');
      buzz(18);
      for (const [cx, cy] of placed) {
        if (cy !== Math.max(...placed.filter(p => p[0] === cx).map(p => p[1]))) continue;
        R.burst(cellX(cx), cellY(cy) - 0.45, 0.2, col, 5, { speed: 5, life: 0.5, size: 0.55, g: -14 });
      }
      G.hitstop = Math.max(G.hitstop, 0.045);
      G.dolly += 0.9;
    } else {
      Snd.sfx('lock');
    }
  },

  onResolve(res) {
    const c = G.core;
    if (res.n > 0) startClearFx(res);
    if (res.n === 0 && res.tspin) {
      bigText('T-SPIN', '', 'tspin');
      Snd.sfx('tspin');
      addTrauma(0.35);
    }
    updateHud();
  },

  onLevelUp(lv) {
    Snd.setLevel(lv);
    Snd.sfx('levelup');
    bigText('LEVEL ' + lv, 'SPEED UP');
    G.bgHueTarget = levelHue(lv);
    G.dolly += 2.4;
    cheer(0.85);
    for (const sx of [-1, 1]) {
      R.spawn({ x: sx * (BOARD_W / 2 + 0.3), y: -BOARD_H / 2, z: 0.5,
        vx: 0, vy: 26, g: 0, drag: 0.02, col: [0.6, 0.95, 1.4], alpha: 0.9,
        life: 0.55, kind: 2, size: 1.6, aspect: 0.25, rot: Math.PI / 2, fade: 'inout' });
    }
    say('レベル' + lv + '！', 1600);
  },

  onGameOver() {
    G.mode = 'over';
    els.stage.classList.add('over-mode');
    Cheer.sad(G.t);
    Snd.stopBgm(0.6);
    Snd.sfx('over');
    G.hitstop = 0.26;
    addTrauma(0.75);
    const c = G.core;
    const isBest = c.score > G.best;
    if (isBest) { G.best = c.score; localStorage.setItem('tetris2Best', c.score); }
    // 盤面をくずす
    for (let r = 0; r < BOARD_H; r++) for (let x = 0; x < BOARD_W; x++) {
      if (!c.board[r][x]) continue;
      if (Math.random() < 0.5) continue;
      R.burst(cellX(x), cellY(r), 0, COLORS[c.board[r][x]].rgb, 2, { speed: 4, life: 1.1, size: 0.7, g: -16 });
    }
    const rank = Rank.submit(c.score, c.lines, c.level);
    post({ type: 't2-score', score: c.score, lines: c.lines, level: c.level });
    setTimeout(() => {
      document.getElementById('over-title').textContent = isBest ? 'NEW RECORD!' : 'GAME OVER';
      const msg = document.getElementById('r-rankmsg');
      msg.textContent = rank ? `🏆 ${rank}位にランクイン！` : '';
      document.getElementById('r-score').textContent = c.score;
      document.getElementById('r-lines').textContent = c.lines;
      document.getElementById('r-level').textContent = c.level;
      document.getElementById('r-best').textContent = G.best;
      els.over.classList.remove('hidden');
      if (isBest) Snd.sfx('best');
      setTimeout(() => { G.overReady = true; }, 400);   // 連打で結果を見ずに再開しない
    }, 1200);
    say(isBest ? 'ベスト更新や！' : 'ドンマイ！', 3000);
  },
};

function levelHue(lv) {
  // 藍 → 紫 → 赤紫 → 緋 → …と少しずつ回す
  return (0.62 + (lv - 1) * 0.045) % 1;
}

// ---------------- ライン消しの演出 ----------------
function startClearFx(res) {
  const rows = res.rows.slice().sort((a, b) => a - b);
  const nRaw = rows.length;
  const n = Math.min(nRaw, 4);   // 演出用（5行以上は理論上ないが、念のため頭打ち）
  const cells = [];
  for (const r of rows) for (let x = 0; x < BOARD_W; x++) {
    const t = G.snapshot ? G.snapshot[r][x] : null;
    if (!t) continue;                      // 空セルは光らせない（💣は満杯でない行も消すため）
    cells.push({ x, y: r, type: t });
  }
  // 光が左から右へ走り抜け、通ったセルから消えていく
  for (const cell of cells) {
    cell.at = rows.indexOf(cell.y) * 0.022 + (cell.x + 0.5) / BOARD_W * 0.155;
    cell.done = false;
  }
  G.clearFx = { rows, n, cells, t: 0, burst: false, bars: 0,
                tspin: res.tspin, perfect: res.perfect, bomb: !!res.bomb };

  // 上の段の「見た目だけ」の落下量。
  // まだ前回の落下アニメが残っているときは、その残り分を引き継ぐ
  // （引き継がないと、💣連打などで山が一瞬で2マス飛ぶ）
  const prevOff = new Float32Array(BOARD_H);
  if (G.fallT < 1) {
    const fp = G.fallT < 0.24 ? 0 : easeOut(clamp((G.fallT - 0.24) / 0.11, 0, 1));
    for (let r = 0; r < BOARD_H; r++) prevOff[r] = G.fallOff[r] * (1 - fp);
  }
  const survivors = [];
  for (let r = 0; r < BOARD_H; r++) if (!rows.includes(r)) survivors.push(r);
  G.fallOff.fill(0);
  for (let k = 0; k < survivors.length; k++) {
    const post = nRaw + k, pre = survivors[k];
    G.fallOff[post] = (post - pre) + prevOff[pre];
  }
  G.fallT = 0;

  // ---- 段階的な盛り上げ ----
  const damp = G.intensity > 2.2 ? 0.8 : 1.0;
  const weight = res.perfect ? 1.5 : res.tspin ? 1.05 : [0, 0.30, 0.45, 0.65, 1.0][n];
  G.intensity += weight;

  let stop = [0, 0.03, 0.05, 0.08, 0.13][n];
  let tr = [0, 0.34, 0.44, 0.58, 0.85][n];
  if (res.tspin) { stop = 0.13; tr = 0.90; }
  if (res.b2b) { stop += 0.025; tr += 0.05; }
  if (res.combo >= 5) stop += 0.02;
  if (res.bomb) { stop = 0.10; tr = 0.50; }   // 画面は静かに、手ごたえは重く
  G.hitstop = Math.max(G.hitstop, stop);
  addTrauma(tr * damp);

  if (res.bomb) { Snd.sfx('bomb'); }
  else { Snd.sfx('clear', { n, combo: Math.max(res.combo, 0) }); buzz(n >= 4 ? [20, 30, 60] : 25); }
  if (res.tspin) Snd.sfx('tspin');

  // カメラ
  if (n >= 2) G.dolly -= [0, 0, 0.5, 0.9, 1.8][n] * damp;
  if (n >= 4) G.fovKick += 0.09 * damp;
  if (res.tspin) { G.boardRoll = 4.5 * Math.PI / 180; G.fovKick += 0.05; }

  // 画面フラッシュ（テトリス以上のみ・80ms）
  if (n >= 4 || res.perfect) { G.flash = res.perfect ? 0.55 : 0.45; G.flashCol = res.perfect ? [1, 1, 1] : [0.75, 0.95, 1]; }

  // 衝撃波
  if (n >= 3 || res.tspin) {
    const rowPx = LAYOUT.play.y + (rows[0] + 0.5) / BOARD_H * LAYOUT.play.h * 0.8 + LAYOUT.play.h * 0.06;
    G.shock = [0.5, 1 - rowPx / window.innerHeight, 0.001, n >= 4 ? 1 : 0.6];
  }

  // 文字
  const label = res.tspin
    ? ['T-SPIN', ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][n]]
    : [['', '1 LINE', 'DOUBLE!', 'TRIPLE!!', 'TETRIS!!!'][n], res.b2b ? 'BACK-TO-BACK' : ''];
  if (res.bomb) bigText('BOOM!', `したの${nRaw}れつ`, 'item');
  else if (res.perfect) bigText('PERFECT CLEAR', 'すごい！', 'perfect');
  else bigText(label[0], label[1], res.tspin ? 'tspin' : 'n' + n);

  if (!res.bomb && res.combo >= 2) comboText(res.combo);
  cheer(res.perfect ? 1 : res.tspin ? 0.9 : Math.min(1, n / 4));
  if (res.perfect) { Snd.sfx('perfect'); G.hitstop = 0.2; addTrauma(1.0); say('パーフェクト！！', 2600); }
  else if (n >= 4) say('テトリス！', 2000);
}

function buzz(ms) { if (!G.calm && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

// ============================================================
// スコアランキング
//   本体に組み込んだときは Firestore（saveGameScore/getGameRanking）へ、
//   この試作単体では localStorage に上位10件を残す。どちらも「1人1つの自己ベスト」。
// ============================================================
const Rank = {
  key: 'tetris2Ranking',
  max: 10,

  name() { return (localStorage.getItem('tetris2Name') || '').trim() || 'ななし'; },
  setName(v) { localStorage.setItem('tetris2Name', (v || '').trim().slice(0, 8)); },

  load() {
    try { const a = JSON.parse(localStorage.getItem(this.key)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  },
  store(list) { localStorage.setItem(this.key, JSON.stringify(list.slice(0, this.max))); },

  // 記録して順位を返す（10位以内に入らなければ 0）
  submit(score, lines, level) {
    // 本体（オトン学園）の中で動いているときはオンラインにも送る
    if (typeof window.saveGameScore === 'function' && typeof window.state === 'object' && window.state) {
      try { window.saveGameScore('tetris2', window.state.nickname, score, 'max'); } catch (e) {}
    }
    if (score <= 0) return 0;
    const list = this.load();
    const nm = this.name();
    const prev = list.findIndex(e => e.name === nm);
    if (prev >= 0) {
      if (score <= list[prev].score) return 0;      // 自己ベスト更新のときだけ
      list.splice(prev, 1);
    }
    const d = new Date();
    const entry = { name: nm, score, lines, level,
      date: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, mine: true };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const rank = list.indexOf(entry) + 1;
    this.store(list);
    return rank <= this.max ? rank : 0;
  },

  render() {
    const box = document.getElementById('rank-list');
    const list = this.load();
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<p class="rank-empty">まだ記録がないで。<br>1位をとるチャンスや！</p>';
      return;
    }
    const nm = this.name();
    const medals = ['🥇', '🥈', '🥉'];
    list.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row' + (i < 3 ? ' g' + (i + 1) : '') + (e.name === nm ? ' me' : '');
      const no = document.createElement('div'); no.className = 'no';
      no.textContent = medals[i] || (i + 1);
      const name = document.createElement('div'); name.className = 'nm';
      name.textContent = e.name;
      const sc = document.createElement('div'); sc.className = 'sc';
      sc.textContent = Number(e.score).toLocaleString();
      const sub = document.createElement('div'); sub.className = 'sub';
      sub.textContent = `Lv${e.level || 1}・${e.lines || 0}列 ${e.date || ''}`;
      row.append(no, name, sc, sub);
      box.appendChild(row);
    });
  },

  show() { this.render(); document.getElementById('rank-screen').classList.remove('hidden'); },
  hide() { document.getElementById('rank-screen').classList.add('hidden'); },
};

// ============================================================
// アイテム（💣 下2行を消す ／ 🐢 15秒スロー）
// ============================================================
// 🐢の残り時間リング（毎フレーム同じ処理をするので、状態が残らない）
function updateSlowRing() {
  const btn = els.slowBtn;
  if (!btn) return;
  const on = G.slowT > 0;
  btn.classList.toggle('active', on);
  if (els.slowRing) {
    const frac = on ? Math.min(G.slowT / (G.slowMax || SLOW_MS / 1000), 1) : 0;
    els.slowRing.style.strokeDashoffset = (113 * (1 - frac)).toFixed(1);
  }
  if (els.slowCount) els.slowCount.textContent = on ? Math.ceil(G.slowT) : G.items.slow;
}

function updateItemUI() {
  for (const k of ['bomb', 'slow']) {
    const el = document.getElementById('it-' + k);
    if (el) el.textContent = G.items[k];
    const btn = document.querySelector(`.item-btn[data-item="${k}"]`);
    if (btn) btn.classList.toggle('empty', G.items[k] <= 0);
  }
}

function useItem(kind) {
  if (G.mode !== 'play' || !G.core || G.core.over) return;
  // 演出で止まっているあいだは、他の操作と同じくキューに積む
  if (G.hitstop > 0) { if (G.queueIn.length < 6) G.queueIn.push('item:' + kind); return; }
  if (G.items[kind] <= 0) { Snd.sfx('move'); return; }
  const btn = document.querySelector(`.item-btn[data-item="${kind}"]`);
  const fire = () => { if (!btn) return; btn.classList.remove('fire'); void btn.offsetWidth; btn.classList.add('fire'); };

  if (kind === 'bomb') {
    // 押しまちがえると取り返しがつかないので、1回目は「かまえる」だけ
    if (!G.bombArmed) {
      G.bombArmed = true;
      if (btn) btn.classList.add('armed');
      say('もういっかい おして！', 1400);
      Snd.sfx('ui');
      clearTimeout(G.bombTimer);
      G.bombTimer = setTimeout(() => {
        G.bombArmed = false;
        const b = document.querySelector('.item-btn[data-item="bomb"]');
        if (b) b.classList.remove('armed');
      }, 1600);
      return;
    }
    G.bombArmed = false;
    clearTimeout(G.bombTimer);
    if (btn) btn.classList.remove('armed');
    const c = G.core;
    const rows = [];
    for (let r = BOARD_H - 2; r < BOARD_H; r++) if (c.board[r].some(v => v)) rows.push(r);
    if (!rows.length) { say('まだ消すものが無いで', 1400); return; }
    G.items.bomb--; fire(); updateItemUI();
    buzz([16, 24, 40]);

    G.snapshot = c.board.map(r => r.slice());
    for (const r of rows) { c.board.splice(r, 1); c.board.unshift(Array(BOARD_W).fill(null)); }
    c.combo = -1;                                  // 自力で消したわけではないのでコンボは切る
    startClearFx({ rows, n: rows.length, tspin: null, combo: -1, b2b: false, perfect: false, bomb: true });

    // 爆発の火の玉
    for (const r of rows) for (let x = 0; x < BOARD_W; x++) {
      R.burst(cellX(x), cellY(r), 0.2, [1.4, 0.55, 0.12], 4, { speed: 11, life: 0.8, size: 1.6, g: -14 });
    }
    R.spawn({ x: 0, y: cellY(BOARD_H - 1) + 0.5, z: 0.6, vx: 0, vy: 0, g: 0, drag: 0.1,
      col: [2.4, 0.9, 0.2], alpha: 1, life: 0.34, kind: 1, size: 1.0, size1: 7.0, fade: 'out' });
    updateHud();

  } else if (kind === 'slow') {
    G.items.slow--; fire(); updateItemUI();
    buzz(30);
    G.core.slowLeft = Math.min(G.core.slowLeft + SLOW_MS / 1000, 30);   // 重ねがけは30秒まで
    G.slowT = G.core.slowLeft;
    G.slowMax = G.core.slowLeft;                                          // リングの分母
    Snd.sfx('slowon');
    bigText('SLOW', 'じかんがのびる', 'slow');
    say('ゆっくりいこ！', 2000);
    // 時間の膜がひろがる
    R.spawn({ x: 0, y: 0, z: 0.8, vx: 0, vy: 0, g: 0, drag: 0.1,
      col: [0.3, 1.3, 1.15], alpha: 0.9, life: 0.7, kind: 1, size: 1.0, size1: 11.0, fade: 'out' });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 6;
      R.spawn({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 1.4, z: 0.5,
        vx: 0, vy: 1.2, g: 0, drag: 0.6, col: [0.35, 1.2, 1.05],
        life: 1.1, size: 0.34, kind: 3, fade: 'out' });
    }
  }
}

const SLOW_MS = 15000;

function addTrauma(v) { G.trauma = clamp(G.trauma + v * (G.calm ? 0.45 : 1), 0, 1); }

// タイトル画面の3Dデモ（7種の駒がゆっくり回りながら流れる）
function buildTitleDemo(t) {
  for (let i = 0; i < 14; i++) {
    const type = PIECE_KEYS[i % 7];
    const ph = i * 0.92;
    const px = Math.sin(t * 0.21 + ph) * 7.6;
    const py = ((t * 0.9 + i * 2.2) % 32) - 16;
    const pz = 1.0 + Math.sin(t * 0.29 + ph) * 7.0;
    const rx = t * 0.42 + ph, ry = t * 0.31 + ph * 0.6, rz = t * 0.19;
    const cells = PIECES[type].cells[0];
    const xs = cells.map(v => v[0]), ys = cells.map(v => v[1]);
    const ox = (Math.min(...xs) + Math.max(...xs)) / 2;
    const oy = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const [cx, cy] of cells) {
      const v = rot3([cx - ox, -(cy - oy), 0], rx, ry, rz);
      R.addBlock(px + v[0], py + v[1], pz + v[2], 0.92, 0.92, 0.92,
        COLORS[type].rgb, 0.30, 1, 1.2, i + cx, rx, ry, rz);
    }
  }
}

// ============================================================
// メインループ
// ============================================================
function loop(ts) {
  requestAnimationFrame(loop);
  let dt = (ts - G.last) / 1000;
  G.last = ts;
  if (dt > 0.1) dt = 0.1;          // タブ復帰などの巨大なdtを潰す
  G.t += dt;
  G.ticks++;

  // ---- 描画負荷に応じた解像度の自動調整 ----
  G.frameMs = G.frameMs * 0.9 + (dt * 1000) * 0.1;
  if (G.frameMs > 18) { if (++G.slowCount > 30) { R.setQuality(Math.max(0.6, R.quality - 0.1)); G.slowCount = 0; } }
  else G.slowCount = 0;
  if (G.frameMs < 13) { if (++G.fastCount > 180) { R.setQuality(Math.min(1, R.quality + 0.05)); G.fastCount = 0; } }
  else G.fastCount = 0;
  if (G.ticks % 30 === 0) {
    els.fps.textContent = (1000 / Math.max(G.frameMs, 1)).toFixed(0) + 'fps  x' + R.quality.toFixed(2);
    measureLayout();
  }

  // ---- ロジック ----
  if (G.mode === 'play') {
    if (G.hitstop > 0) {
      G.hitstop -= dt;
      if (G.hitstop <= 0) {
        G.hitstop = 0;
        // 先に取り出してから流す。act() の中で積み直されると
        // 永久に減らなくなる（＝タブが固まる）
        const q = G.queueIn.splice(0);
        for (const a of q) act(a);
      }
    } else {
      stepInput(dt);
      G.core.step(dt, held.down);
    }
    updateHud();
    const hi = G.core.highest();
    G.danger = clamp((4 - hi) / 4, 0, 1);
    Snd.setDanger(G.danger);
    if (G.slowT > 0) Snd.targetBpm = Snd.baseBpm() * 0.86;   // スロー中は曲もゆるむ
    els.stage.classList.toggle('danger', G.danger > 0.05);
  }

  updateFx(dt);
  Cheer.update(dt, G.t, G.mode === 'play' ? G.danger : 0);
  R.updateParts(dt);
  build();
  R.render(renderParams());
}

function stepInput(dt) {
  if (!held.dir) return;
  held.t += dt;
  if (!held.rep) {
    if (held.t >= held.das) { held.rep = true; held.t -= held.das; act(held.dir < 0 ? 'left' : 'right'); }
  } else {
    let guard = 0;
    while (held.t >= held.arr && guard++ < 4) { held.t -= held.arr; act(held.dir < 0 ? 'left' : 'right'); }
  }
}

function updateFx(dt) {
  G.trauma = Math.max(0, G.trauma - dt / 0.42);
  G.dolly *= Math.exp(-dt * 6.5);
  G.fovKick *= Math.exp(-dt * 5.0);
  G.boardRoll *= Math.exp(-dt * 6.0);
  G.flash = Math.max(0, G.flash - dt * 5.5);
  G.intensity = Math.max(0, G.intensity - dt * 0.55);
  G.bgHue += (G.bgHueTarget - G.bgHue) * Math.min(1, dt * 1.6);
  if (G.shock[2] > 0) { G.shock[2] += dt * 1.9; if (G.shock[2] > 1) G.shock[2] = 0; }
  if (G.fallT < 1) {
    const before = G.fallT;
    G.fallT += dt;
    // 上の段が落ちきった瞬間に「ドン」と重みを出す
    if (before < 0.35 && G.fallT >= 0.35) {
      const n = G.clearFx ? G.clearFx.n : 1;
      addTrauma(0.08 + 0.04 * n);
      Snd.sfx('lock');
      const r = G.core ? G.core.highest() : BOARD_H;
      if (r < BOARD_H) for (let x = 0; x < BOARD_W; x++) {
        R.spawn({ x: cellX(x) + rnd(-0.3, 0.3), y: cellY(r) - 0.5, z: 0.25,
          vx: rnd(-1.4, 1.4), vy: 2.2, g: -9, drag: 2.2,
          col: [0.7, 0.85, 1.0], alpha: 0.45, life: 0.32, size: 0.5, kind: 0 });
      }
    }
  }
  G.slotSpin += dt * 0.9;
  G.beat = Math.pow(1 - Snd.beatPhase(), 2.4);   // キックで1、拍の間に0へ

  // 🐢スローの残り時間（ゲームが進んでいるあいだだけ減る）
  const prevSlow = G.slowT;
  G.slowT = (G.core && G.mode !== 'over') ? G.core.slowLeft : 0;
  updateSlowRing();
  if (prevSlow > 0 && G.slowT === 0) Snd.sfx('slowoff');
  const curX = (G.core && G.core.cur) ? (G.core.cur.x + 1.5) : 4.5;
  G.yawSmooth += (((curX - 4.5) * -0.011) - G.yawSmooth) * Math.min(1, dt * 8);

  for (const [k, v] of G.lockFlash) {
    const nv = v + dt;
    if (nv > 0.2) G.lockFlash.delete(k); else G.lockFlash.set(k, nv);
  }

  // ライン消しのタイムライン
  const f = G.clearFx;
  if (f) {
    f.t += dt;
    // 掃引が通り過ぎたセルから順に砕ける
    for (const c of f.cells) {
      if (c.done || f.t < c.at + 0.025) continue;
      c.done = true;
      const cc = COLORS[c.type];
      const col = f.bomb
        ? [lerp(cc.rgb[0], 1.5, 0.65), lerp(cc.rgb[1], 0.55, 0.65), lerp(cc.rgb[2], 0.12, 0.65)]
        : [lerp(cc.rgb[0], cc.erg[0], 0.35), lerp(cc.rgb[1], cc.erg[1], 0.35), lerp(cc.rgb[2], cc.erg[2], 0.35)];
      R.burst(cellX(c.x), cellY(c.y), 0, col, 4 + f.n * 2,
        { speed: 8 + f.n * 4, life: 0.9 + f.n * 0.15, size: 1.2 + f.n * 0.2, g: -18 });
    }
    if (!f.burst && f.t >= 0.06) {
      f.burst = true;
      // 消えた行を横切る光の帯
      for (const r of f.rows) {
        R.spawn({ x: 0, y: cellY(r), z: 0.3, vx: 0, vy: 0, g: 0, drag: 0.1,
          col: f.perfect ? [1.4, 1.4, 1.4] : [0.95, 1.25, 1.5], alpha: 1.0, life: 0.30,
          kind: 2, size: 1.5, size1: 0.2, aspect: 5.0, fade: 'out' });
      }
      // パーフェクトクリアは光の柱
      if (f.perfect) for (let x = 0; x < BOARD_W; x++) {
        R.spawn({ x: cellX(x), y: -8, z: 0, vx: 0, vy: 14, g: 0, drag: 0.02,
          col: [1, 1, 1], alpha: 0.85, life: 1.2, kind: 2, size: 2.2, aspect: 0.35,
          rot: Math.PI / 2, fade: 'inout' });
      }
      if (f.tspin) for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2;
        R.spawn({ x: Math.cos(a) * 1.2, y: cellY(f.rows[0]) + Math.sin(a) * 1.2, z: 0.4,
          vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, g: 0, drag: 1.2,
          col: hex2rgb('#FF3DDA'), life: 0.9, size: 0.3, kind: 3, fade: 'out' });
      }
      // コンボのリング
      const cb = G.core ? G.core.combo : 0;
      if (cb >= 2) R.spawn({ x: 0, y: cellY(f.rows[0]), z: 0.5, vx: 0, vy: 0, g: 0, drag: 0.1,
        col: cb >= 8 ? hex2rgb('#FF3DDA') : hex2rgb('#FFD447'), alpha: 0.9, life: 0.45,
        kind: 1, size: 1.0, size1: 9.0, fade: 'out' });
    }
    if (f.t > 1.0) G.clearFx = null;
  }

  // ゲームオーバー：俯瞰へ引いて色を抜く
  if (G.mode === 'over') {
    G.overAnim = Math.min(1, G.overAnim + dt / 1.5);
    G.sat = lerp(1, 0.15, easeOut(Math.min(1, G.overAnim * 1.6)));
  } else if (G.mode === 'title') {
    G.overAnim = 0; G.sat = 1;
  }
}

// シェーダの rotMat と同じ順（Rz*Ry*Rx）でベクトルを回す
function rot3(v, rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  let x = v[0], y = v[1], z = v[2];
  let y1 = cx * y - sx * z, z1 = sx * y + cx * z;
  let x2 = cy * x + sy * z1, z2 = -sy * x + cy * z1;
  return [cz * x2 - sz * y1, sz * x2 + cz * y1, z2];
}

// 連続なノイズ（Math.random だと安っぽいジッターになる）
function vnoise(x) {
  const i = Math.floor(x), f = x - i;
  const h = n => { const s = Math.sin(n * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

// ============================================================
// 描画データの組み立て
// ============================================================
const T = { x: 0, y: 0 };   // 盤面のロール適用後の座標を入れる作業用

function put(x, y) {
  const a = G.boardRoll;
  if (!a) { T.x = x; T.y = y; return T; }
  const c = Math.cos(a), s = Math.sin(a);
  T.x = x * c - y * s; T.y = x * s + y * c;
  return T;
}

function build() {
  R.clearInstances();
  const c = G.core;
  const t = G.t;

  // タイトル中は駒がゆっくり回りながら漂う（デモ）
  if (G.mode === 'title') buildTitleDemo(t);

  const opaqueStart = 0;

  // ---------------- ウェル（枠・床・背面グリッド） ----------------
  const hue = G.bgHue;
  const edge = WELL_EDGE;
  const halfW = BOARD_W / 2, halfH = BOARD_H / 2;
  // 側面レール
  const slow = G.slowT > 0;
  const edgeCol = slow ? SLOW_EDGE : edge;
  const railE = 0.05 + G.beat * 0.30 + G.intensity * 0.04
              + (slow ? 0.10 + 0.10 * Math.sin(G.t * 3.0) : 0);
  const showWell = G.mode !== 'title';
  const railH = BOARD_H + 0.7;
  // スロー中は「レールの水色が下から減っていく」＝残り時間の目もり
  const slowFrac = slow ? clamp(G.slowT / (G.slowMax || 15), 0, 1) : 0;
  if (showWell) for (const sx of [-1, 1]) {
    const rx = sx * (halfW + 0.28);
    if (!slow) {
      const p = put(rx, 0);
      R.addBlock(p.x, p.y, 0, 0.34, railH, 1.1, edgeCol, railE, 1, 0.45, sx + 2);
    } else {
      const lowH = railH * slowFrac;
      if (lowH > 0.05) {
        const p = put(rx, -railH / 2 + lowH / 2);
        R.addBlock(p.x, p.y, 0, 0.36, lowH, 1.12, SLOW_EDGE, railE, 1, 0.5, sx + 2);
      }
      const upH = railH - lowH;
      if (upH > 0.05) {
        const q = put(rx, railH / 2 - upH / 2);
        R.addBlock(q.x, q.y, 0, 0.34, upH, 1.1, edge, 0.05 + G.beat * 0.25, 1, 0.45, sx + 4);
      }
    }
  }
  // 底
  if (showWell) {
    const p = put(0, -halfH - 0.28);
    R.addBlock(p.x, p.y, 0, BOARD_W + 1.2, 0.34, 1.1, edgeCol, railE, 1, 0.5, 5);
  }
  // 背面のグリッド（列を数えられるように必ず出す）
  for (let x = 1; showWell && x < BOARD_W; x++) {
    const p = put(cellX(x) - 0.5, 0);
    R.addBlock(p.x, p.y, -0.62, 0.05, BOARD_H, 0.05, GRID_COL, 0.03, 1, 0.10, x);
  }
  for (let y = 1; showWell && y < BOARD_H; y++) {
    const p = put(0, cellY(y) + 0.5);
    R.addBlock(p.x, p.y, -0.62, BOARD_W, 0.05, 0.05, GRID_COL, 0.03, 1, 0.10, y);
  }
  // 背面パネル
  if (showWell) {
    const p = put(0, 0);
    R.addBlock(p.x, p.y, -0.85, BOARD_W, BOARD_H, 0.35, [0.012, 0.017, 0.048], 0.0, 1, 0.10, 9);
  }
  // 床（反射をのせる板）
  R.addBlock(0, FLOOR_Y - 0.20, 0.6, BOARD_W + 6.0, 0.4, 7.0, [0.014, 0.020, 0.055], 0.0, 1, 0.08, 3);
  // ステージの手前のふち（ネオン）
  R.addBlock(0, FLOOR_Y - 0.02, 4.05, BOARD_W + 6.0, 0.10, 0.16, WELL_EDGE, 0.05, 1, 0.6, 7);

  // ---------------- 応援団（ボクセル） ----------------
  Cheer.build(R, t, G.mode === 'play' ? G.danger : 0, false);

  // ---------------- 積みブロック ----------------
  if (c) {
    const fallP = G.fallT < 0.24 ? 0 : easeOut(clamp((G.fallT - 0.24) / 0.11, 0, 1));
    for (let r = 0; r < BOARD_H; r++) {
      const yoff = G.fallT < 1 ? G.fallOff[r] * (1 - fallP) : 0;
      for (let x = 0; x < BOARD_W; x++) {
        const tp = c.board[r][x];
        if (!tp) continue;
        let col = COLORS[tp].rgb.slice();
        let emis = 0.10;
        // 天井近くは危険色を混ぜる
        if (r < 4) { const k = (4 - r) / 4 * 0.25; col = col.map((v, i) => lerp(v, [1, 0.18, 0.36][i], k)); }
        // 置いた直後の光り
        const lf = G.lockFlash.get(x + ',' + r);
        if (lf !== undefined) emis += (1 - lf / 0.2) * 0.55;
        const p = put(cellX(x), cellY(r) + yoff);
        R.addBlock(p.x, p.y, 0, 0.94, 0.94, 0.94, col, emis, 1, 1.0, x * 3 + r);
      }
    }
    // デッドライン（ここまで積んだら終わり）
    if (G.danger > 0.001 && G.mode === 'play') {
      const p = put(0, cellY(4) + 0.5);
      R.addBlock(p.x, p.y, -0.1, BOARD_W, 0.08, 0.08, [1, 0.12, 0.25],
        (0.35 + 0.35 * Math.sin(G.t * 5.0)) * G.danger, 1, 1.0, 7);
    }
    // 穴（上にブロックがある空セル）を暗く示す
    for (let x = 0; x < BOARD_W; x++) {
      let seen = false;
      for (let r = 0; r < BOARD_H; r++) {
        if (c.board[r][x]) { seen = true; continue; }
        if (!seen) continue;
        const hoff = G.fallT < 1 ? G.fallOff[r] * (1 - fallP) : 0;
        const p = put(cellX(x), cellY(r) + hoff);
        R.addBlock(p.x, p.y, -0.20, 0.42, 0.42, 0.08, [0.55, 0.07, 0.18], 0, 0.55, -1, r);
      }
    }
    // 消える行（白く飽和 → 90msで消える）
    const f = G.clearFx;
    if (f && f.t < 0.30) {
      for (const cell of f.cells) {
        if (cell.done) continue;
        const k = Math.exp(-Math.pow((f.t - cell.at) / 0.024, 2));   // 光の山（せまいほど「走る」）
        const p = put(cellX(cell.x), cellY(cell.y));
        R.addBlock(p.x, p.y, 0, 0.94 + k * 0.22, 0.94 + k * 0.22, 0.94,
          COLORS[cell.type].erg, 0.15 + k * (1.5 + f.n * 0.9), 1, 1.0, cell.x);
      }
    }
    // ---------------- 操作中の駒 ----------------
    if (c.cur && !c.over) {
      const type = c.cur.type;
      const col = COLORS[type].rgb;
      // ロック直前は脈打つ（2Hz）
      let emis = 0.28;
      if (c.grounded) emis = lerp(0.32, 0.85, 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 2));
      for (const [cx, cy] of c.curCells()) {
        if (cy < 0) continue;
        const p = put(cellX(cx), cellY(cy));
        R.addBlock(p.x, p.y, 0.06, 1.0, 1.0, 1.0, col, emis, 1, 1.25, cx + cy * 0.7);
      }
    }
  }
  const opaqueCount = R.instCount - opaqueStart;

  // ---------------- 半透明（反射・ゴースト） ----------------
  const transStart = R.instCount;
  Cheer.buildShadows(R);
  if (R.quality > 0.75) Cheer.build(R, t, 0, true);   // 床への映り込み
  if (c) {
    // ゴースト＋着地面の光る枠
    if (c.cur && !c.over) {
      const gy = c.ghostY();
      const col = COLORS[c.cur.type].rgb;
      const erg = COLORS[c.cur.type].erg;
      for (const [cx, cy] of c.cellsOf(c.cur.type, c.cur.rot, c.cur.x, gy)) {
        if (cy < 0) continue;
        const p = put(cellX(cx), cellY(cy));
        R.addBlock(p.x, p.y, 0, 1.02, 1.02, 1.02, erg, 0.03, 0.13, 2.2, cx);
      }
      // 落ちる先の列をウェルの底で示す（応援ステージの床ではない）
      const cols = new Set(c.cellsOf(c.cur.type, c.cur.rot, c.cur.x, gy).map(v => v[0]));
      for (const cx of cols) {
        const p = put(cellX(cx), -BOARD_H / 2 + 0.08);
        R.addBlock(p.x, p.y, 0.2, 0.86, 0.06, 1.2, erg, 0.35, 0.6, 0.9, cx);
      }
    }
  }
  const transCount = R.instCount - transStart;

  // ---------------- HUDの3Dピース ----------------
  const slots = [];
  if (c) {
    const list = [
      { key: 'hold', type: c.hold, dim: c.holdUsed },
      { key: 'next0', type: c.queue[0] },
      { key: 'next1', type: c.queue[1] },
      { key: 'next2', type: c.queue[2] },
    ];
    for (const it of list) {
      const slot = LAYOUT.slots.find(s => s.key === it.key);
      if (!slot || !it.type) continue;
      const base = R.instCount;
      const cells = PIECES[it.type].cells[0];
      const xs = cells.map(v => v[0]), ys = cells.map(v => v[1]);
      const cx0 = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy0 = (Math.min(...ys) + Math.max(...ys)) / 2;
      const col = it.dim ? [0.25, 0.28, 0.35] : COLORS[it.type].rgb;
      for (const [x, y] of cells) {
        R.addBlock((x - cx0) * 1.02, -(y - cy0) * 1.02, 0, 0.95, 0.95, 0.95,
          col, it.dim ? 0.02 : 0.12, 1, it.dim ? 0.4 : 0.8, x + y);
      }
      slots.push({ rect: slot.rect, base, count: R.instCount - base, spin: G.slotSpin * 0.6 + base });
    }
  }

  G._groups = { opaque: [opaqueStart, opaqueCount], trans: [transStart, transCount] };
  G._slots = slots;
}

function renderParams() {
  const cellPx = LAYOUT.play.h / (BOARD_H + 2);
  const s = G.trauma * G.trauma;
  const amp = 11 / Math.max(cellPx, 1);      // 画面11px相当をワールド単位に
  const shakeX = amp * s * vnoise(G.t * 38.0);
  const shakeY = amp * s * vnoise(G.t * 38.0 + 91.3) * 0.75;

  // タイトル中はゆっくり回すデモカメラ
  const titleMode = G.mode === 'title';
  const overK = easeOut(G.overAnim);

  const cam = {
    halfH: 12.9, halfW: 6.1,
    zoom: 1 + G.fovKick * -1 + (G.dolly * 0.03) + (titleMode ? 0.06 : 0) + overK * 0.55,
    pitch: 0.115 + Math.sin(G.t * 0.17) * 0.010 + (titleMode ? 0.06 : 0) + overK * 0.30,
    yaw: titleMode ? Math.sin(G.t * 0.25) * 0.22 : G.yawSmooth + Math.sin(G.t * 0.21) * 0.006,
    roll: 0,
    targetY: -1.95 + Math.sin(G.t * 0.13) * 0.05,
    shakeX, shakeY,
  };

  return {
    time: G.t,
    rect: LAYOUT.play,
    cam,
    groups: G._groups,
    slots: G._slots,
    bg: {
      hue: G.bgHue,
      pulse: G.beat,
      speed: (clamp(((G.core ? G.core.level : 1) - 1) / 12, 0, 1) * 0.8 + G.trauma * 0.2) * (G.slowT > 0 ? 0.3 : 1),
      danger: G.danger * (G.mode === 'play' ? 1 : 0),
    },
    post: {
      threshold: 1.32,
      bloom: (G.calm ? 0.32 : 0.45) + G.trauma * 0.15 + G.beat * (G.calm ? 0.03 : 0.09) + G.intensity * 0.03,
      ca: G.calm ? 0.12 : (0.20 + G.trauma * 0.55),
      flash: G.flash * (G.calm ? 0.55 : 1),
      flashCol: G.flashCol,
      vignette: 0.42 + 0.28 * G.danger,
      grain: G.calm ? 0 : 0.018,
      shock: G.calm ? [0.5, 0.5, 0, 0] : G.shock,
      sat: G.sat * 1.12 * (1 - 0.30 * G.danger),
      fade: 0,
    },
  };
}
