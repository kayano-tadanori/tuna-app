// ============================================================
// オトンテトリス（息抜きミニゲーム）
// ============================================================

const T_COLS = 10, T_ROWS = 20, T_CELL = 20;

const TETROMINOES = [
  { c: '#38c8f0', m: [[1, 1, 1, 1]] },           // I
  { c: '#ffd166', m: [[1, 1], [1, 1]] },          // O
  { c: '#a06bff', m: [[0, 1, 0], [1, 1, 1]] },    // T
  { c: '#28c88a', m: [[0, 1, 1], [1, 1, 0]] },    // S
  { c: '#ff4466', m: [[1, 1, 0], [0, 1, 1]] },    // Z
  { c: '#4f7cff', m: [[1, 0, 0], [1, 1, 1]] },    // J
  { c: '#ff9a44', m: [[0, 0, 1], [1, 1, 1]] },    // L
];

const tetris = {
  board: [], cur: null, next: null,
  score: 0, lines: 0, level: 1,
  dropInterval: 800, lastDrop: 0,
  over: false, paused: false,
  rafId: null, repeatId: null,
  controlsReady: false,
};

function initTetris() {
  document.getElementById('tetris-best').textContent = localStorage.getItem('tetrisBest') || '0';
  document.getElementById('tetris-back').onclick = () => { stopTetrisLoop(); tStopBgm(); tStopChars(); showScreen('subject'); };
  document.getElementById('tetris-pause').onclick = toggleTetrisPause;
  document.getElementById('tetris-restart').onclick = startTetris;
  document.getElementById('tetris-rank').onclick = () => showGameRanking('tetris', 'オトンテトリス', 'max');
  document.getElementById('tetris-bgm').onclick = () => {
    tSound.bgm = !tSound.bgm;
    localStorage.setItem('tetrisBgm', tSound.bgm ? '1' : '0');
    if (tSound.bgm && !tetris.over && !tetris.paused) tStartBgm(); else tStopBgm();
    tUpdateSoundBtns();
  };
  document.getElementById('tetris-sfx').onclick = () => {
    tSound.sfx = !tSound.sfx;
    localStorage.setItem('tetrisSfx', tSound.sfx ? '1' : '0');
    if (tSound.sfx) tSfx('rotate'); // 確認音
    tUpdateSoundBtns();
  };
  tUpdateSoundBtns();
  document.querySelectorAll('#screen-tetris .t-item-btn').forEach(btn => {
    btn.onclick = () => tUseItem(btn.dataset.item);
  });
  updateItemButtons();
  if (!tetris.controlsReady) { initTetrisControls(); tetris.controlsReady = true; }
  startTetris();
}

function startTetris() {
  if (!spendGameTicket()) return; // 1プレイ＝遊び券1まい
  stopTetrisLoop();
  tetris.board = Array.from({ length: T_ROWS }, () => Array(T_COLS).fill(null));
  tetris.score = 0; tetris.lines = 0; tetris.level = 1;
  tetris.dropInterval = 800; tetris.lastDrop = 0;
  tetris.over = false; tetris.paused = false;
  tetris.next = null;
  tetris.slowUntil = 0;
  document.querySelectorAll('.t-item-btn').forEach(b => b.classList.remove('item-active'));
  document.getElementById('tetris-overlay').classList.add('hidden');
  document.getElementById('tetris-pause').textContent = '⏸';
  tSpawn();
  updateTetrisInfo();
  drawTetris();
  tChars.mood = 'idle'; tChars.bubble = '';
  tStartChars();
  tStartBgm();
  tetris.rafId = requestAnimationFrame(tLoop);
}

function stopTetrisLoop() {
  cancelAnimationFrame(tetris.rafId);
  clearInterval(tetris.repeatId);
}

function toggleTetrisPause() {
  if (tetris.over) return;
  tetris.paused = !tetris.paused;
  document.getElementById('tetris-pause').textContent = tetris.paused ? '▶' : '⏸';
  if (tetris.paused) {
    stopTetrisLoop();
    tStopBgm();
  } else {
    tetris.lastDrop = 0;
    tStartBgm();
    tetris.rafId = requestAnimationFrame(tLoop);
  }
}

function tRandPiece() {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return { m: t.m.map(r => [...r]), c: t.c, x: 0, y: 0 };
}

function tSpawn() {
  tetris.cur = tetris.next || tRandPiece();
  tetris.next = tRandPiece();
  tetris.cur.x = Math.floor((T_COLS - tetris.cur.m[0].length) / 2);
  tetris.cur.y = 0;
  drawTetrisNext();
  if (tCollide(tetris.cur.m, tetris.cur.x, tetris.cur.y)) tGameOver();
}

function tCollide(m, x, y) {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= T_COLS || ny >= T_ROWS) return true;
      if (ny >= 0 && tetris.board[ny][nx]) return true;
    }
  }
  return false;
}

function tRotate(m) {
  return m[0].map((_, i) => m.map(r => r[i]).reverse());
}

function tTryRotate() {
  const rotated = tRotate(tetris.cur.m);
  // 壁蹴り：そのまま→左右に1〜2マスずらして試す
  for (const dx of [0, -1, 1, -2, 2]) {
    if (!tCollide(rotated, tetris.cur.x + dx, tetris.cur.y)) {
      tetris.cur.m = rotated;
      tetris.cur.x += dx;
      return;
    }
  }
}

function tSoftDrop(byPlayer) {
  if (!tCollide(tetris.cur.m, tetris.cur.x, tetris.cur.y + 1)) {
    tetris.cur.y++;
    if (byPlayer) tetris.score += 1;
  } else {
    tMerge();
    tClearLines();
    tSpawn();
  }
}

function tHardDrop() {
  while (!tCollide(tetris.cur.m, tetris.cur.x, tetris.cur.y + 1)) {
    tetris.cur.y++;
    tetris.score += 2;
  }
  tMerge();
  tClearLines();
  tSpawn();
}

function tMerge() {
  const { m, c, x, y } = tetris.cur;
  m.forEach((row, r) => row.forEach((v, cc) => {
    if (v && y + r >= 0) tetris.board[y + r][x + cc] = c;
  }));
}

function tClearLines() {
  let cleared = 0;
  for (let r = T_ROWS - 1; r >= 0; r--) {
    if (tetris.board[r].every(v => v)) {
      tetris.board.splice(r, 1);
      tetris.board.unshift(Array(T_COLS).fill(null));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    tetris.score += [0, 100, 300, 500, 800][cleared] * tetris.level;
    tetris.lines += cleared;
    tetris.level = Math.floor(tetris.lines / 10) + 1;
    tetris.dropInterval = Math.max(120, 800 - (tetris.level - 1) * 70);
    tSfx(cleared >= 4 ? 'clear4' : 'clear1');
    tCharsCheer(cleared);
  }
}

function tGameOver() {
  tetris.over = true;
  stopTetrisLoop();
  tStopBgm();
  const prevBest = Number(localStorage.getItem('tetrisBest') || 0);
  const isNewBest = tetris.score > prevBest;
  tSfx(isNewBest ? 'best' : 'over');
  if (isNewBest) {
    tChars.mood = 'cheer';
    tChars.moodUntil = Date.now() + 5000;
    tChars.bubble = 'ベスト更新や！すごいで！';
  } else {
    tChars.mood = 'idle';
    tChars.bubble = 'ドンマイ！もう一回や！';
    setTimeout(() => { if (tetris.over) tChars.bubble = ''; }, 4000);
  }
  if (isNewBest) localStorage.setItem('tetrisBest', tetris.score);
  if (tetris.score > 0 && typeof saveGameScore === 'function') saveGameScore('tetris', state.nickname, tetris.score, 'max');
  document.getElementById('tetris-best').textContent = Math.max(tetris.score, prevBest);
  document.getElementById('tetris-overlay-emoji').classList.toggle('hidden', !isNewBest);
  document.getElementById('tetris-overlay-emoji').textContent = '🏆';
  document.getElementById('tetris-overlay-img').classList.toggle('hidden', isNewBest);
  document.getElementById('tetris-overlay-text').textContent = isNewBest ? 'ベスト更新！' : 'ゲームオーバー';
  document.getElementById('tetris-overlay-score').textContent = `スコア ${tetris.score}`;
  document.getElementById('tetris-overlay').classList.remove('hidden');
}

function tLoop(ts) {
  if (tetris.over || tetris.paused) return;
  if (!tetris.lastDrop) tetris.lastDrop = ts;
  // スローアイテム効果中は落下1/3速
  const slowFactor = performance.now() < (tetris.slowUntil || 0) ? 3 : 1;
  if (ts - tetris.lastDrop > tetris.dropInterval * slowFactor) {
    tSoftDrop(false);
    tetris.lastDrop = ts;
  }
  updateTetrisInfo();
  drawTetris();
  tetris.rafId = requestAnimationFrame(tLoop);
}

function updateTetrisInfo() {
  document.getElementById('tetris-score').textContent = tetris.score;
  document.getElementById('tetris-lines').textContent = tetris.lines;
  document.getElementById('tetris-level').textContent = tetris.level;
}

function tCellDraw(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * T_CELL + 1, y * T_CELL + 1, T_CELL - 2, T_CELL - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x * T_CELL + 1, y * T_CELL + 1, T_CELL - 2, 5);
}

function drawTetris() {
  const cv = document.getElementById('tetris-canvas');
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a1128';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // うすいグリッド線
  ctx.strokeStyle = 'rgba(120,150,220,0.08)';
  ctx.lineWidth = 1;
  for (let c = 1; c < T_COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * T_CELL, 0); ctx.lineTo(c * T_CELL, cv.height); ctx.stroke();
  }
  for (let r = 1; r < T_ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * T_CELL); ctx.lineTo(cv.width, r * T_CELL); ctx.stroke();
  }

  // 固定ブロック
  for (let r = 0; r < T_ROWS; r++) {
    for (let c = 0; c < T_COLS; c++) {
      if (tetris.board[r][c]) tCellDraw(ctx, c, r, tetris.board[r][c]);
    }
  }

  if (!tetris.cur) return;
  const { m, c: color, x, y } = tetris.cur;

  // ゴースト（落下予測位置）
  let gy = y;
  while (!tCollide(m, x, gy + 1)) gy++;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  m.forEach((row, r) => row.forEach((v, cc) => {
    if (v && gy + r >= 0) ctx.strokeRect((x + cc) * T_CELL + 2, (gy + r) * T_CELL + 2, T_CELL - 4, T_CELL - 4);
  }));

  // 現在のピース
  m.forEach((row, r) => row.forEach((v, cc) => {
    if (v && y + r >= 0) tCellDraw(ctx, x + cc, y + r, color);
  }));
}

function drawTetrisNext() {
  const cv = document.getElementById('tetris-next');
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a1128';
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!tetris.next) return;
  const { m, c } = tetris.next;
  const offX = (cv.width - m[0].length * T_CELL) / 2;
  const offY = (cv.height - m.length * T_CELL) / 2;
  m.forEach((row, r) => row.forEach((v, cc) => {
    if (!v) return;
    ctx.fillStyle = c;
    ctx.fillRect(offX + cc * T_CELL + 1, offY + r * T_CELL + 1, T_CELL - 2, T_CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(offX + cc * T_CELL + 1, offY + r * T_CELL + 1, T_CELL - 2, 5);
  }));
}

function tetrisAction(act) {
  if (tetris.over || tetris.paused || !tetris.cur) return;
  if (act === 'left' && !tCollide(tetris.cur.m, tetris.cur.x - 1, tetris.cur.y)) { tetris.cur.x--; tSfx('move'); }
  else if (act === 'right' && !tCollide(tetris.cur.m, tetris.cur.x + 1, tetris.cur.y)) { tetris.cur.x++; tSfx('move'); }
  else if (act === 'down') { tSfx('soft'); tSoftDrop(true); }
  else if (act === 'rotate') { tSfx('rotate'); tTryRotate(); }
  else if (act === 'drop') { tSfx('drop'); tHardDrop(); }
  updateTetrisInfo();
  drawTetris();
}

function initTetrisControls() {
  document.querySelectorAll('.tetris-btn').forEach(btn => {
    const act = btn.dataset.t;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      tetrisAction(act);
      // 長押しリピート（移動系のみ）
      if (act === 'left' || act === 'right' || act === 'down') {
        clearInterval(tetris.repeatId);
        tetris.repeatId = setInterval(() => tetrisAction(act), 110);
      }
    });
    const stopRepeat = () => clearInterval(tetris.repeatId);
    btn.addEventListener('pointerup', stopRepeat);
    btn.addEventListener('pointerleave', stopRepeat);
    btn.addEventListener('pointercancel', stopRepeat);
  });
}

// ============================================================
// テトリスのBGM（メロディは自作。音そのものの土台は js/game-core.js）
// ============================================================


// オリジナルのチップチューン風ループ（8分音符・0は休符）
const T_MELODY = [
  'A4','C5','E5','A5','G5','E5','F5','D5',
  'E5','C5','D5','B4','C5','A4','B4','G4',
  'A4','C5','E5','A5','B5','A5','G5','E5',
  'F5','G5','A5','G5','E5','D5','C5','B4',
  'A4','C5','E5','A5','G5','E5','F5','D5',
  'E5','C5','D5','B4','C5','A4','B4','G4',
  'C5','E5','G5','C6','B5','G5','A5','F5',
  'E5','D5','C5','D5','E5',0,'A4',0,
];
const T_BASS = ['A2','F2','C3','G2','A2','F2','D3','E3',
                'A2','F2','C3','G2','C3','G2','A2','A2'];

function tStartBgm() {
  tStopBgm();
  if (!tSound.bgm) return;
  tAudioCtx();
  tSound.step = 0;
  tSound.bgmTimer = setInterval(() => {
    const n = T_MELODY[tSound.step % T_MELODY.length];
    if (n) tTone(tNote(n), 0.18, 'square', 0.045);
    if (tSound.step % 4 === 0) {
      tTone(tNote(T_BASS[Math.floor(tSound.step / 4) % T_BASS.length]), 0.32, 'triangle', 0.08);
    }
    tSound.step++;
  }, 220);
}

function tStopBgm() { clearInterval(tSound.bgmTimer); tSound.bgmTimer = null; }

function tUpdateSoundBtns() {
  document.getElementById('tetris-bgm').classList.toggle('on', tSound.bgm);
  document.getElementById('tetris-sfx').classList.toggle('on', tSound.sfx);
}

// ============================================================
// テトリスの応援キャラ（帯そのものは js/game-core.js の makeCharStrip）
// ============================================================


const tetrisChars = makeCharStrip('tetris-chars');
const tChars = tetrisChars.state; // 既存コード互換のエイリアス

function tStartChars() { tetrisChars.start(); }
function tStopChars() { tetrisChars.stop(); }
function tCharsCheer(lines) {
  tetrisChars.cheer(
    lines >= 4 ? '4ライン！すごいで！' : null,
    lines >= 4 ? 3000 : 1500
  );
}
