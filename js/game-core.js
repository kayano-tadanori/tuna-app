// ============================================================
// ミニゲーム共通の土台（音・応援キャラのドット絵・スコアランキング）
//   使う側：オトンテトリス／おかんスイーパー／チッチジャンプ2、
//           ガチャ（tSfx）、がんばりの記録（tSfx・tCharsCheer）
//
//   ★2026-08-09に js/tetris.js と js/jump.js から「移しただけ」。中身は1行も変えていない。
//   ⚠ index.html では app.js の直後・どのゲームより先に読むこと。
//      tetris.js / sweeper.js / jump.js は読み込んだ瞬間に makeCharStrip() を呼ぶので、
//      この順番をくずすと ReferenceError で起動しなくなる。
//   ※ 名前の t／T は「もとがテトリスにあった」という由来。互換のためそのままにしてある。
// ============================================================

// ------------------------------------------------------------
// 音（Web Audioで自作・デフォルトOFF。設定キーは3ゲーム共用）
// ------------------------------------------------------------
const tSound = {
  bgm: localStorage.getItem('tetrisBgm') === '1',
  sfx: localStorage.getItem('tetrisSfx') === '1',
  ctx: null, bgmTimer: null, step: 0,
};

function tAudioCtx() {
  if (!tSound.ctx) tSound.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (tSound.ctx.state === 'suspended') tSound.ctx.resume();
  return tSound.ctx;
}

function tTone(freq, dur, type, vol, delay, endFreq) {
  const ac = tAudioCtx();
  const t0 = ac.currentTime + (delay || 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(vol || 0.1, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(ac.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function tNote(n) {
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  return 440 * Math.pow(2, (semis[n[0]] + (Number(n[n.length - 1]) - 4) * 12) / 12);
}

function tSfx(kind) {
  if (!tSound.sfx) return;
  switch (kind) {
    case 'move':   tTone(220, 0.05, 'square', 0.05); break;
    case 'rotate': tTone(440, 0.07, 'square', 0.07); break;
    case 'soft':   tTone(180, 0.04, 'triangle', 0.07); break;
    case 'drop':   tTone(160, 0.15, 'square', 0.13, 0, 55); break;
    case 'clear1': [660, 880].forEach((f, i) => tTone(f, 0.09, 'square', 0.11, i * 0.08)); break;
    case 'clear4': [523, 659, 784, 1047, 1319].forEach((f, i) => tTone(f, 0.1, 'square', 0.12, i * 0.07)); break;
    case 'over':   [392, 330, 262, 196].forEach((f, i) => tTone(f, 0.22, 'triangle', 0.13, i * 0.18)); break;
    case 'best':   [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tTone(f, 0.12, 'square', 0.12, i * 0.1)); break;
    case 'gachaShake': [180, 220, 180, 220].forEach((f, i) => tTone(f, 0.06, 'square', 0.07, i * 0.12)); break;
    case 'gachaOpen':  [440, 660, 880].forEach((f, i) => tTone(f, 0.1, 'triangle', 0.1, i * 0.08)); break;
    case 'gachaSR':    [523, 659, 784, 1047, 1319].forEach((f, i) => tTone(f, 0.12, 'square', 0.13, i * 0.09)); break;
    case 'gachaUR':    [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tTone(f, 0.14, 'square', 0.14, i * 0.08)); break;
  }
}

// ------------------------------------------------------------
// 応援キャラの帯（ドット絵：オットン・オカーン・チッチ）
//   第2引数に true を渡した時だけ jump.js の描いた絵を使う（今はどこも渡していない）
// ------------------------------------------------------------
const T_SPRITES = {
  otton: {
    pal: { k: '#3a2a1e', w: '#ffffff', f: '#f5c9a2', e: '#222222', m: '#c0392b', s: '#4f7cff', p: '#233a7a', h: '#f5c9a2' },
    idle: [
      '............',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '..wwwwwwww..',
      '..ffffffff..',
      '..feffffef..',
      '..ffffffff..',
      '..fffmmfff..',
      '...ffffff...',
      '..ssssssss..',
      '.hssssssssh.',
      '.h.ssssss.h.',
      '...pppppp...',
      '...pp..pp...',
    ],
    cheer: [
      '.h........h.',
      '.h.kkkkkk.h.',
      '..kkkkkkkk..',
      '..wwwwwwww..',
      '..ffffffff..',
      '..feffffef..',
      '..ffffffff..',
      '..ffmmmmff..',
      '...ffffff...',
      '..ssssssss..',
      '..ssssssss..',
      '..ssssssss..',
      '...pppppp...',
      '...pp..pp...',
    ],
  },
  okan: {
    pal: { w: '#ffffff', k: '#6b4a2f', f: '#f5c9a2', e: '#222222', m: '#c0392b', v: '#e63c82', a: '#f7b6ce', h: '#f5c9a2' },
    idle: [
      '....wwww....',
      '...wwwwww...',
      '..wwwwwwww..',
      '..kkkkkkkk..',
      '..ffffffff..',
      '..feffffef..',
      '..ffffffff..',
      '..fffmmfff..',
      '...ffffff...',
      '..vvvvvvvv..',
      '.hvvvvvvvvh.',
      '.h.aaaaaa.h.',
      '...aaaaaa...',
      '...aa..aa...',
    ],
    cheer: [
      '.h........h.',
      '.h..wwww..h.',
      '..wwwwwwww..',
      '..kkkkkkkk..',
      '..ffffffff..',
      '..feffffef..',
      '..ffffffff..',
      '..ffmmmmff..',
      '...ffffff...',
      '..vvvvvvvv..',
      '..vvvvvvvv..',
      '...aaaaaa...',
      '...aaaaaa...',
      '...aa..aa...',
    ],
  },
  chicchi: {
    pal: { y: '#ffd93b', d: '#e8b923', o: '#ff9d5c', r: '#e84a2e', e: '#222222', l: '#ff9d5c' },
    idle: [
      '..........',
      '..........',
      '..........',
      '..........',
      '...yyyy...',
      '..yyyyyy..',
      '..oooooo..',
      '..oeooeo..',
      '...rrrr...',
      '..yyyyyy..',
      '.dyyyyyyd.',
      '.dyyyyyyd.',
      '..yyyyyy..',
      '...l..l...',
    ],
    cheer: [
      '..........',
      '..........',
      '..........',
      '..........',
      '.d......d.',
      '.d.yyyy.d.',
      '..yyyyyy..',
      '..oooooo..',
      '..oeooeo..',
      '...rrrr...',
      '..yyyyyy..',
      '..yyyyyy..',
      '..yyyyyy..',
      '...l..l...',
    ],
    // 羽ばたき（下→上の2コマ）。頭・体はそのままで、翼（d）だけ体の横で動かす
    flapDown: [
      '..........',
      '..........',
      '..........',
      '..........',
      '...yyyy...',
      '..yyyyyy..',
      '..oooooo..',
      '..oeooeo..',
      '...rrrr...',
      '..yyyyyy..',
      '..yyyyyy..',
      '.dyyyyyyd.',
      'ddyyyyyydd',
      '.d.l..l.d.',
    ],
    flapUp: [
      '..........',
      '..........',
      '..........',
      '..........',
      '...yyyy...',
      '..yyyyyy..',
      '..oooooo..',
      '..oeooeo..',
      '.d.rrrr.d.',
      'ddyyyyyydd',
      '.dyyyyyyd.',
      '..yyyyyy..',
      '..yyyyyy..',
      '...l..l...',
    ],
    // ロケット噴射中の加速ポーズ（上を見上げる顔＋翼を下向きにすぼめた流線形）
    rocket: [
      '...yyyy...',
      '..yyyyyy..',
      '..oeooeo..',
      '..oooooo..',
      '..oooooo..',
      '...rrrr...',
      '..yyyyyy..',
      '.dyyyyyyd.',
      'd.yyyyyy.d',
      'd..yyyy..d',
      '...yyyy...',
      '....yy....',
      '....ll....',
      '..........',
    ],
  },
};

const T_CHEERS = ['ええぞ！', 'やったな！', 'ナイスや！', 'その調子！', 'ピピッ♪', 'がんばってるやん！'];

function tDrawSprite(ctx, rows, pal, ox, oy, s) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (col) { ctx.fillStyle = col; ctx.fillRect(ox + c * s, oy + r * s, s, s); }
    }
  });
}

// 応援キャラ帯（テトリス・スイーパー共用のファクトリ）
function makeCharStrip(canvasId, useImages) {
  const st = { timer: null, tick: 0, mood: 'idle', moodUntil: 0, bubble: '' };

  function draw() {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (st.mood === 'cheer' && Date.now() > st.moodUntil) { st.mood = 'idle'; st.bubble = ''; }

    const s = 4;
    [T_SPRITES.otton, T_SPRITES.okan, T_SPRITES.chicchi].forEach((sp, i) => {
      const cheer = st.mood === 'cheer';
      const frame = cheer && st.tick % 2 === 0 ? sp.cheer : sp.idle;
      const bounce = cheer
        ? (st.tick % 2 === 0 ? -5 : 0)
        : Math.round(Math.sin((st.tick + i * 2) / 2) * 2);
      const x = 32 + i * 104;
      const y = cv.height - frame.length * s - 2 + bounce;
      // チッチジャンプ2だけ、描いた絵の3人で応援する（他のゲームは今までのドット絵のまま）
      const holder = useImages ? [J_IMG.otton, J_IMG.okan, J_CHICCHI_FRAMES[0]][i] : null;
      if (holder && holder.ready) {
        jDrawImg(ctx, holder, x + 22, cv.height - 34 + bounce, 66, 66);
      } else {
        tDrawSprite(ctx, frame, sp.pal, x, y, s);
      }
    });

    if (st.bubble) {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = st.mood === 'cheer' ? '#ffd166' : '#9db2e8';
      ctx.fillText(st.bubble, cv.width / 2, 13);
    }
    st.tick++;
  }

  return {
    state: st,
    start() { clearInterval(st.timer); st.timer = setInterval(draw, 160); draw(); },
    stop() { clearInterval(st.timer); st.timer = null; },
    idle() { st.mood = 'idle'; st.bubble = ''; },
    cheer(bubble, ms) {
      st.mood = 'cheer';
      st.moodUntil = Date.now() + (ms || 1500);
      st.bubble = bubble || T_CHEERS[Math.floor(Math.random() * T_CHEERS.length)];
    },
  };
}

// ============================================================
// ミニゲーム共通スコアランキングモーダル
// ============================================================

// unit：max系で値に付ける単位（計算ドリルは「問」）。省略すると今までどおり数値だけ。
function showGameRanking(game, title, dir, unit) {
  const modal = document.getElementById('game-rank-modal');
  document.getElementById('game-rank-title').textContent = `🏆 ${title}`;
  const list = document.getElementById('game-rank-list');
  list.innerHTML = '<p class="record-rank-empty">読み込み中…</p>';
  modal.classList.remove('hidden');
  const fmt = dir === 'min' ? (v => `${v}秒`) : (v => `${Number(v).toLocaleString()}${unit || ''}`);
  const req = typeof getGameRanking === 'function' ? getGameRanking(game, dir) : Promise.resolve(null);
  req.then(rows => {
    list.innerHTML = '';
    if (!rows) { list.innerHTML = '<p class="record-rank-empty">オフラインでは見られへんで</p>'; return; }
    if (!rows.length) { list.innerHTML = '<p class="record-rank-empty">まだ記録がないで。1位を取るチャンスや！</p>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    rows.forEach((e, i) => {
      const div = document.createElement('div');
      div.className = 'rank-item' + (e.nickname === state.nickname ? ' me' : '');
      div.innerHTML = `<div class="rank-num"></div><div class="rank-name"></div><div class="rank-rate"></div>`;
      const numEl = div.querySelector('.rank-num');
      numEl.textContent = medals[i] || (i + 1);
      if (i < 3) numEl.classList.add(['gold', 'silver', 'bronze'][i]);
      div.querySelector('.rank-name').textContent = `${e.nickname}${e.nickname === state.nickname ? ' ★' : ''}`;
      div.querySelector('.rank-rate').textContent = fmt(e.value);
      list.appendChild(div);
    });
  }).catch(() => { list.innerHTML = '<p class="record-rank-empty">読み込みに失敗したで</p>'; });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('game-rank-close').onclick = () =>
    document.getElementById('game-rank-modal').classList.add('hidden');
});
