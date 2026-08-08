// ============================================================
// おかんスイーパー（息抜きミニゲーム2）
// ============================================================

const MINE_LEVELS = {
  easy:   { cols: 9, rows: 9,  mines: 10, label: 'かんたん' },
  normal: { cols: 9, rows: 12, mines: 20, label: 'ふつう' },
  hard:   { cols: 9, rows: 14, mines: 32, label: 'むずかしい' },
};

const mineState = {
  diff: 'easy',
  board: [], cols: 9, rows: 9, mines: 10,
  started: false, over: false,
  flagMode: false, shieldOn: false,
  time: 0, timerId: null,
  bgmTimer: null, bgmStep: 0,
  longPressId: null, longPressed: false,
};

const mineChars = makeCharStrip('mine-chars');

// ── 効果音（tSound.sfx設定を共用） ──
function mSfx(kind) {
  if (!tSound.sfx) return;
  switch (kind) {
    case 'open':  tTone(520, 0.04, 'square', 0.05); break;
    case 'flood': tTone(660, 0.07, 'square', 0.06); break;
    case 'flag':  tTone(880, 0.06, 'triangle', 0.1); break;
    case 'boom':  tTone(140, 0.5, 'square', 0.2, 0, 40); break;
    case 'safe':  [660, 880].forEach((f, i) => tTone(f, 0.08, 'triangle', 0.12, i * 0.07)); break;
    case 'win':   [523, 659, 784, 1047, 1319].forEach((f, i) => tTone(f, 0.12, 'square', 0.12, i * 0.08)); break;
  }
}

// ── BGM（スイーパー用のゆったりオリジナルループ・tSound.bgm設定を共用） ──
const M_MELODY = [
  'C5', 0, 'E5', 0, 'G5', 0, 'E5', 0, 'A4', 0, 'C5', 0, 'E5', 0, 'C5', 0,
  'F4', 0, 'A4', 0, 'C5', 0, 'A4', 0, 'G4', 0, 'B4', 0, 'D5', 0, 'B4', 0,
  'C5', 0, 'E5', 0, 'G5', 0, 'A5', 0, 'G5', 0, 'E5', 0, 'D5', 0, 'C5', 0,
  'D5', 0, 'F5', 0, 'A5', 0, 'F5', 0, 'E5', 'D5', 'C5', 0, 'G4', 0, 0, 0,
];
const M_BASS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2', 'D3', 'F2', 'C3', 'G2'];

function mStartBgm() {
  mStopBgm();
  if (!tSound.bgm) return;
  tAudioCtx();
  mineState.bgmStep = 0;
  mineState.bgmTimer = setInterval(() => {
    const n = M_MELODY[mineState.bgmStep % M_MELODY.length];
    if (n) tTone(tNote(n), 0.24, 'triangle', 0.06);
    if (mineState.bgmStep % 4 === 0) {
      tTone(tNote(M_BASS[Math.floor(mineState.bgmStep / 4) % M_BASS.length]), 0.42, 'sine', 0.07);
    }
    mineState.bgmStep++;
  }, 260);
}
function mStopBgm() { clearInterval(mineState.bgmTimer); mineState.bgmTimer = null; }

// ── 初期化 ──
function initMine() {
  document.getElementById('mine-back').onclick = () => {
    mStopTimer(); mStopBgm(); mineChars.stop(); showScreen('subject');
  };
  document.getElementById('mine-bgm').onclick = () => {
    tSound.bgm = !tSound.bgm;
    localStorage.setItem('tetrisBgm', tSound.bgm ? '1' : '0');
    if (tSound.bgm && !mineState.over) mStartBgm(); else mStopBgm();
    mUpdateSoundBtns();
  };
  document.getElementById('mine-sfx').onclick = () => {
    tSound.sfx = !tSound.sfx;
    localStorage.setItem('tetrisSfx', tSound.sfx ? '1' : '0');
    if (tSound.sfx) mSfx('flag');
    mUpdateSoundBtns();
  };
  document.getElementById('mine-rank').onclick = () =>
    showGameRanking(`mine_${mineState.diff}`, `おかんスイーパー（${MINE_LEVELS[mineState.diff].label}）`, 'min');
  document.getElementById('mine-restart').onclick = () => startMine();
  document.getElementById('mine-mode').onclick = () => {
    mineState.flagMode = !mineState.flagMode;
    updateMineModeBtn();
  };
  document.querySelectorAll('.mine-diff-btn').forEach(btn => {
    btn.onclick = () => {
      mineState.diff = btn.dataset.mdiff;
      document.querySelectorAll('.mine-diff-btn').forEach(b => b.classList.toggle('selected', b === btn));
      startMine();
    };
    btn.classList.toggle('selected', btn.dataset.mdiff === mineState.diff);
  });
  document.querySelectorAll('#screen-mine .t-item-btn').forEach(btn => {
    btn.onclick = () => mineUseItem(btn.dataset.item);
  });
  mUpdateSoundBtns();
  updateItemButtons();
  startMine();
}

function mUpdateSoundBtns() {
  document.getElementById('mine-bgm').classList.toggle('on', tSound.bgm);
  document.getElementById('mine-sfx').classList.toggle('on', tSound.sfx);
}

function updateMineModeBtn() {
  const btn = document.getElementById('mine-mode');
  btn.textContent = mineState.flagMode ? '🚩 はたモード' : '⛏ ほるモード';
  btn.classList.toggle('flag-mode', mineState.flagMode);
}

function startMine() {
  if (!spendGameTicket()) return; // 1プレイ＝遊び券1まい
  const lv = MINE_LEVELS[mineState.diff];
  mineState.cols = lv.cols; mineState.rows = lv.rows; mineState.mines = lv.mines;
  mineState.board = Array.from({ length: lv.rows * lv.cols }, () => ({ mine: false, open: false, flag: false, num: 0 }));
  mineState.started = false; mineState.over = false;
  mineState.flagMode = false; mineState.shieldOn = false;
  mStopTimer();
  mineState.time = 0;
  document.getElementById('mine-time').textContent = '0';
  document.getElementById('mine-best').textContent = localStorage.getItem('mineBest_' + mineState.diff) || '-';
  document.getElementById('mine-overlay').classList.add('hidden');
  document.querySelectorAll('#screen-mine .t-item-btn').forEach(b => b.classList.remove('item-active'));
  updateMineModeBtn();
  updateMineLeft();
  buildMineGrid();
  mineChars.idle();
  mineChars.start();
  mStartBgm();
}

function buildMineGrid() {
  const grid = document.getElementById('mine-grid');
  grid.style.gridTemplateColumns = `repeat(${mineState.cols}, 1fr)`;
  grid.innerHTML = '';
  for (let i = 0; i < mineState.rows * mineState.cols; i++) {
    const btn = document.createElement('button');
    btn.className = 'mine-cell';
    // 長押し(350ms)で旗
    btn.addEventListener('pointerdown', () => {
      mineState.longPressed = false;
      clearTimeout(mineState.longPressId);
      mineState.longPressId = setTimeout(() => {
        mineState.longPressed = true;
        mToggleFlag(i);
      }, 350);
    });
    const cancel = () => clearTimeout(mineState.longPressId);
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.onclick = () => {
      if (mineState.longPressed) { mineState.longPressed = false; return; }
      if (mineState.flagMode) mToggleFlag(i);
      else mDig(i);
    };
    grid.appendChild(btn);
  }
}

function mNeighbors(i) {
  const c = i % mineState.cols, r = Math.floor(i / mineState.cols);
  const res = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < mineState.rows && nc >= 0 && nc < mineState.cols) res.push(nr * mineState.cols + nc);
    }
  }
  return res;
}

// 初手セーフ：最初に掘ったマスと周囲8マスを避けて地雷を配置
function mPlaceMines(firstIdx) {
  const banned = new Set([firstIdx, ...mNeighbors(firstIdx)]);
  const candidates = [];
  for (let i = 0; i < mineState.board.length; i++) if (!banned.has(i)) candidates.push(i);
  shuffle(candidates).slice(0, mineState.mines).forEach(i => { mineState.board[i].mine = true; });
  mineState.board.forEach((cell, i) => {
    cell.num = mNeighbors(i).filter(n => mineState.board[n].mine).length;
  });
  mineState.started = true;
  mStartTimer();
}

function mDig(i) {
  if (mineState.over) return;
  const cell = mineState.board[i];
  if (cell.open || cell.flag) return;
  if (!mineState.started) mPlaceMines(i);

  if (cell.mine) {
    if (mineState.shieldOn) {
      // おまもり発動：地雷を1回だけ無効化（旗を立てて開示扱い）
      mineState.shieldOn = false;
      cell.flag = true;
      document.querySelectorAll('#screen-mine .t-item-btn[data-item="shield"]').forEach(b => b.classList.remove('item-active'));
      renderMineCell(i);
      updateMineLeft();
      mSfx('safe');
      mineChars.cheer('あぶなかったな！', 2000);
      showToast('🛡 おまもりが守ってくれた！');
      return;
    }
    mGameOver(i);
    return;
  }

  const before = mCountOpen();
  mReveal(i);
  const opened = mCountOpen() - before;
  mSfx(opened > 6 ? 'flood' : 'open');
  if (opened > 8) mineChars.cheer(null, 1200);
  renderMineAll();
  updateMineLeft();
  checkMineWin();
}

function mReveal(i) {
  const stack = [i];
  while (stack.length) {
    const idx = stack.pop();
    const cell = mineState.board[idx];
    if (cell.open || cell.flag || cell.mine) continue;
    cell.open = true;
    if (cell.num === 0) {
      mNeighbors(idx).forEach(n => {
        const nc = mineState.board[n];
        if (!nc.open && !nc.mine) stack.push(n);
      });
    }
  }
}

function mCountOpen() { return mineState.board.filter(c => c.open).length; }

function mToggleFlag(i) {
  if (mineState.over) return;
  const cell = mineState.board[i];
  if (cell.open) return;
  cell.flag = !cell.flag;
  mSfx('flag');
  renderMineCell(i);
  updateMineLeft();
}

function renderMineCell(i) {
  const btn = document.getElementById('mine-grid').children[i];
  if (!btn) return;
  const cell = mineState.board[i];
  btn.className = 'mine-cell';
  btn.textContent = '';
  if (cell.open) {
    btn.classList.add('open');
    if (cell.num > 0) { btn.textContent = cell.num; btn.classList.add('n' + cell.num); }
  } else if (cell.flag) {
    btn.textContent = '🚩';
  }
}
function renderMineAll() {
  for (let i = 0; i < mineState.board.length; i++) renderMineCell(i);
}

function updateMineLeft() {
  const flags = mineState.board.filter(c => c.flag).length;
  document.getElementById('mine-left').textContent = Math.max(0, mineState.mines - flags);
}

function mStartTimer() {
  mStopTimer();
  mineState.timerId = setInterval(() => {
    mineState.time++;
    document.getElementById('mine-time').textContent = mineState.time;
  }, 1000);
}
function mStopTimer() { clearInterval(mineState.timerId); mineState.timerId = null; }

function checkMineWin() {
  if (mineState.over) return;
  if (!mineState.board.every(c => c.mine || c.open)) return;
  mineState.over = true;
  mStopTimer(); mStopBgm();
  mSfx('win');
  const t = Math.max(1, mineState.time);
  const prevBest = Number(localStorage.getItem('mineBest_' + mineState.diff) || 0);
  const isBest = !prevBest || t < prevBest;
  if (isBest) localStorage.setItem('mineBest_' + mineState.diff, String(t));
  document.getElementById('mine-best').textContent = localStorage.getItem('mineBest_' + mineState.diff);
  if (typeof saveGameScore === 'function') saveGameScore(`mine_${mineState.diff}`, state.nickname, t, 'min');
  // 全地雷に旗
  mineState.board.forEach((c, i) => { if (c.mine && !c.flag) { c.flag = true; renderMineCell(i); } });
  updateMineLeft();
  mineChars.cheer('ようやった！', 4000);
  document.getElementById('mine-overlay-img').src = 'images/okan-happy.png';
  document.getElementById('mine-overlay-text').textContent = isBest ? 'ベスト更新や！' : 'クリア！ようやった！';
  document.getElementById('mine-overlay-sub').textContent = `タイム ${t}秒`;
  document.getElementById('mine-overlay').classList.remove('hidden');
}

function mGameOver(boomIdx) {
  mineState.over = true;
  mStopTimer(); mStopBgm();
  mSfx('boom');
  // 全地雷を表示
  mineState.board.forEach((c, i) => {
    if (c.mine) {
      const btn = document.getElementById('mine-grid').children[i];
      btn.className = 'mine-cell open' + (i === boomIdx ? ' boom' : '');
      btn.textContent = '🪳';
    }
  });
  mineChars.state.bubble = 'ドンマイ！もう一回や！';
  document.getElementById('mine-overlay-img').src = 'images/okan-scared.png';
  document.getElementById('mine-overlay-text').textContent = 'ギョエーッ！';
  document.getElementById('mine-overlay-sub').textContent = 'もう一回チャレンジや！';
  document.getElementById('mine-overlay').classList.remove('hidden');
}

function mineUseItem(kind) {
  if (mineState.over) return;
  const items = getItems();
  if ((items[kind] || 0) <= 0) return;

  if (kind === 'search') {
    if (!mineState.started) { showToast('まず1マス開けてから使ってな！'); return; }
    const candidates = [];
    mineState.board.forEach((c, i) => { if (!c.open && !c.mine && !c.flag) candidates.push(i); });
    if (!candidates.length) { showToast('開けるマスがないで！'); return; }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    mReveal(pick);
    renderMineAll();
    const btn = document.getElementById('mine-grid').children[pick];
    if (btn) { btn.classList.add('safe'); setTimeout(() => btn.classList.remove('safe'), 1200); }
    mSfx('safe');
    mineChars.cheer('ここ安全やで！', 1500);
    updateMineLeft();
    addItem(kind, -1);
    updateItemButtons();
    checkMineWin();
  } else if (kind === 'shield') {
    if (mineState.shieldOn) { showToast('おまもりはもう発動中やで！'); return; }
    mineState.shieldOn = true;
    document.querySelectorAll('#screen-mine .t-item-btn[data-item="shield"]').forEach(b => b.classList.add('item-active'));
    mSfx('flag');
    showToast('🛡 おまもり発動！ゴキブリを1回だけ防ぐで');
    addItem(kind, -1);
    updateItemButtons();
  }
}
