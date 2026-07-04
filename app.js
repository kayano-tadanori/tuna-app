// ============================================================
// 定数・設定
// ============================================================

const CATEGORIES = {
  kotowaza:   { label: 'ことわざ',   file: 'data/kotowaza.json' },
  kanyoku:    { label: '慣用句',     file: 'data/kanyoku.json'  },
  yojijukugo: { label: '四字熟語', file: 'data/yojijukugo.json'},
  gairaigo:   { label: '外来語',   file: 'data/gairaigo.json'  },
  kanji_kaki:     { label: '漢字の書き取り', file: 'data/kanji_kaki.json' },
  kanji_yomi:     { label: '漢字の読み',     file: 'data/kanji_yomi.json' },
  kokugo_keigo:   { label: '敬語・文法',     file: 'data/kokugo_keigo.json' },
  kokugo_goi:     { label: '語い',           file: 'data/kokugo_goi.json' },
  kokugo_bushu:   { label: '部首・画数',     file: 'data/kokugo_bushu.json' },
  kokugo_bungaku: { label: '文学史・季語',   file: 'data/kokugo_bungaku.json' },
};

// 漢字カテゴリ（学年選択あり・専用UI）
const KANJI_CATS = ['kanji_kaki', 'kanji_yomi'];

const MODES = {
  flash: 'フラッシュカード',
  quiz:  '四択クイズ',
  fill:  '虫食い問題'
};

const KOKUGO_DIFF_LABELS = { 1: 'やさしい', 2: '難しい', 3: 'チャレンジ', 4: '灘中レベル', all: 'ぜんぶ' };

// ============================================================
// 状態管理
// ============================================================

const state = {
  nickname: '',
  selectedCat: null,
  selectedMode: null,
  selectedDiff: null,  // 1-4 | 'all'
  grade: null,         // 漢字カテゴリ用
  weakOnly: false,
  questions: [],      // 読み込んだ全問題（データJSONのまま）
  sessionQs: [],      // 今回出題する問題リスト
  current: 0,         // セッション内の現在インデックス
  correct: 0,
  wrong: 0,
  retryQueue: [],     // フラッシュカードの「もう一度」キュー
  flipped: false
};

// ============================================================
// キャッシュ（カテゴリJSONを一度だけfetch）
// ============================================================

const questionCache = {};

async function loadQuestions(category) {
  if (questionCache[category]) return questionCache[category];
  const res = await fetch(CATEGORIES[category].file);
  const data = await res.json();
  // カスタム問題をLocalStorageからマージ
  const custom = getCustomQuestions(category);
  questionCache[category] = [...data, ...custom];
  return questionCache[category];
}

// ============================================================
// LocalStorage ユーティリティ
// ============================================================

function saveNickname(name) { localStorage.setItem('nickname', name); addNicknameHistory(name); }
function getNickname() { return localStorage.getItem('nickname') || ''; }

// 同じ端末で使った名前の履歴（最大5件・新しい順）
function getNicknameHistory() { return JSON.parse(localStorage.getItem('nicknameHistory') || '[]'); }
function addNicknameHistory(name) {
  const h = getNicknameHistory().filter(n => n !== name);
  h.unshift(name);
  localStorage.setItem('nicknameHistory', JSON.stringify(h.slice(0, 5)));
}

function getProgress() {
  return JSON.parse(localStorage.getItem('progress') || '{}');
}
function saveProgress(prog) {
  localStorage.setItem('progress', JSON.stringify(prog));
}

function recordResult(id, correct) {
  const prog = getProgress();
  if (!prog[id]) prog[id] = { correct: 0, total: 0 };
  prog[id].total++;
  if (correct) prog[id].correct++;
  saveProgress(prog);
}

function getRate(id) {
  const p = getProgress()[id];
  if (!p || p.total === 0) return null;
  return Math.round((p.correct / p.total) * 100);
}

function getCategoryRate(category) {
  const qs = questionCache[category];
  if (!qs || !qs.length) return null;
  const prog = getProgress();
  let c = 0, t = 0;
  qs.forEach(q => {
    const p = prog[q.id];
    if (p && p.total > 0) { c += p.correct; t += p.total; }
  });
  return t > 0 ? Math.round((c / t) * 100) : null;
}

function getWeakItems(category) {
  const qs = questionCache[category];
  if (!qs) return [];
  const prog = getProgress();
  return qs.filter(q => {
    const p = prog[q.id];
    return p && p.total >= 1 && (p.correct / p.total) <= 0.5;
  });
}

// ============================================================
// カスタム問題（LocalStorage）
// ============================================================

function getCustomQuestions(category) {
  return JSON.parse(localStorage.getItem('custom_' + category) || '[]');
}
function saveCustomQuestions(category, list) {
  localStorage.setItem('custom_' + category, JSON.stringify(list));
  delete questionCache[category]; // キャッシュをクリア
}

// ============================================================
// 回答チェック（ひらがな・カタカナ正規化）
// ============================================================

function normalize(str) {
  return str.trim()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)) // カタ→ひら
    .toLowerCase();
}

function checkAnswer(input, question) {
  return normalize(input) === normalize(question.answer);
}

// ============================================================
// 選択肢シャッフル（正解を必ず含む）
// ============================================================

function buildChoices(question, allQuestions) {
  const correctAns = question.answer;
  // JSONに選択肢があればそれを使い、ランダムにシャッフル
  if (question.choices && question.choices.length >= 4) {
    return shuffle([...question.choices]);
  }
  // なければ他問題の答えからランダムに3つ取る
  const pool = allQuestions
    .map(q => q.answer)
    .filter(a => a !== correctAns);
  const distractors = shuffle(pool).slice(0, 3);
  return shuffle([correctAns, ...distractors]);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// 画面切替
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + id);
  if (screen) { screen.classList.add('active'); screen.scrollTop = 0; }
  // プレイ時間計測（勉強画面に入ったら開始、出たら加算）
  currentScreenId = id;
  if (PLAY_SCREENS.includes(id)) {
    if (!playStart) playStart = Date.now();
  } else {
    flushPlayTime();
  }
}

// ============================================================
// トースト通知
// ============================================================

function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), duration);
}

// ============================================================
// ローディング
// ============================================================

function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading').classList.add('hidden'); }

// ============================================================
// ホーム画面
// ============================================================

function initHome() {
  state.selectedCat  = null;
  state.selectedMode = null;
  state.selectedDiff = null;
  state.grade        = null;
  state.weakOnly     = false;
  document.getElementById('start-zone').classList.add('hidden');
  document.getElementById('home-nickname').textContent = state.nickname;

  // ステップを初期状態に
  ['kokugo-step-grade', 'kokugo-step-mode', 'kokugo-step-diff'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });

  // カテゴリ正解率表示（キャッシュ済みのみ）
  Object.keys(CATEGORIES).forEach(cat => {
    const rate = getCategoryRate(cat);
    const el = document.getElementById('rate-' + cat);
    if (el) el.textContent = rate !== null ? rate + '% 正解' : '';
  });

  // ステップ表示ヘルパー
  const showStep = id => {
    const el = document.getElementById(id);
    const was = el.classList.contains('hidden');
    el.classList.remove('hidden');
    if (was) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  // STEP1: カテゴリ選択
  document.querySelectorAll('.cat-card').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedCat = btn.dataset.cat;
      state.weakOnly = false;
      if (KANJI_CATS.includes(state.selectedCat)) {
        // 漢字：学年→難易度（モードは固定）
        state.selectedMode = state.selectedCat === 'kanji_kaki' ? 'kaki' : 'yomi';
        document.getElementById('kokugo-step-mode').classList.add('hidden');
        showStep('kokugo-step-grade');
        if (state.grade) showStep('kokugo-step-diff');
      } else {
        // 言葉系：モード→難易度
        if (['kaki', 'yomi'].includes(state.selectedMode)) state.selectedMode = null;
        document.getElementById('kokugo-step-grade').classList.add('hidden');
        showStep('kokugo-step-mode');
        if (state.selectedMode) showStep('kokugo-step-diff');
      }
      maybeShowStart();
    };
  });

  // STEP2: 学年（漢字）
  document.querySelectorAll('.kokugo-grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.kokugo-grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.grade = Number(btn.dataset.grade);
      showStep('kokugo-step-diff');
      maybeShowStart();
    };
  });

  // STEP2': モード（言葉系）
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedMode = btn.dataset.mode;
      showStep('kokugo-step-diff');
      maybeShowStart();
    };
  });

  // STEP3: 難易度
  document.querySelectorAll('.kokugo-diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.kokugo-diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedDiff = btn.dataset.diff === 'all' ? 'all' : Number(btn.dataset.diff);
      maybeShowStart();
    };
  });

  // 苦手のみ
  document.getElementById('btn-weak').onclick = () => {
    if (!state.selectedCat) { showToast('カテゴリを選んでください'); return; }
    const weaks = getWeakItems(state.selectedCat);
    if (!weaks.length) { showToast('まだ苦手問題がありません'); return; }
    state.weakOnly = true;
    showToast('苦手問題のみ出題します');
    maybeShowStart();
  };

  document.getElementById('btn-progress').onclick = showProgressScreen;
  document.getElementById('btn-custom').onclick = showCustomScreen;
  document.getElementById('btn-ranking').onclick = showRankingScreen;

  // 終了バッジ（✅カテゴリ・👑漢字の学年）
  renderCatBadges('kokugo');
  renderGradeCrowns('kokugo');
}

function maybeShowStart() {
  const zone = document.getElementById('start-zone');

  // 外来語 × 虫食いの組み合わせは不可
  const fillBtn = document.querySelector('.mode-btn[data-mode="fill"]');
  if (state.selectedCat === 'gairaigo') {
    fillBtn.disabled = true;
    fillBtn.style.opacity = '0.35';
    if (state.selectedMode === 'fill') {
      state.selectedMode = null;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
      showToast('外来語は虫食い問題に対応していません');
    }
  } else {
    fillBtn.disabled = false;
    fillBtn.style.opacity = '';
  }

  const isKanji = KANJI_CATS.includes(state.selectedCat);
  const ready = isKanji
    ? state.selectedCat && state.grade && state.selectedDiff
    : state.selectedCat && state.selectedMode && state.selectedDiff;
  if (!ready) { zone.classList.add('hidden'); return; }

  zone.classList.remove('hidden');
  const catLabel = CATEGORIES[state.selectedCat].label + (isKanji ? `（小${state.grade}）` : '');
  const modeLabel = (isKanji ? (state.selectedCat === 'kanji_kaki' ? '手書き' : 'ひらがな入力') : MODES[state.selectedMode])
    + '・' + KOKUGO_DIFF_LABELS[state.selectedDiff];
  document.getElementById('start-cat-label').textContent = catLabel;
  document.getElementById('start-mode-label').textContent = modeLabel;
}

document.getElementById('btn-start').onclick = async () => {
  showLoading();
  try {
    const all = await loadQuestions(state.selectedCat);
    let pool = state.weakOnly ? getWeakItems(state.selectedCat) : [...all];

    // 難易度フィルタ（「ぜんぶ」はフィルタなし）
    if (state.selectedDiff && state.selectedDiff !== 'all') {
      pool = pool.filter(q => q.difficulty === state.selectedDiff);
    }
    // 漢字カテゴリは学年フィルタ
    if (KANJI_CATS.includes(state.selectedCat) && state.grade) {
      pool = pool.filter(q => q.grade === state.grade);
    }
    pool = shuffle(pool);

    const countSel = document.getElementById('q-count').value;
    if (countSel !== 'all') pool = pool.slice(0, parseInt(countSel, 10));
    state.sessionQs = pool;
    state.questions  = all;
    state.current = 0;
    state.correct = 0;
    state.wrong   = 0;
    state.retryQueue = [];

    if (!pool.length) { showToast('問題がありません'); hideLoading(); return; }

    if (state.selectedCat === 'kanji_kaki') startKanji();
    else if (state.selectedCat === 'kanji_yomi') startFill();
    else if (state.selectedMode === 'flash') startFlash();
    else if (state.selectedMode === 'quiz') startQuiz();
    else startFill();
  } catch (e) {
    showToast('問題の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
};

// ============================================================
// フラッシュカード
// ============================================================

function startFlash() {
  document.getElementById('flash-title').textContent = CATEGORIES[state.selectedCat].label;
  showScreen('flash');
  state.flipped = false;
  renderFlash();
}

function renderFlash() {
  const q = state.sessionQs[state.current];
  if (!q) { endSession(); return; }

  const total = state.sessionQs.length;
  document.getElementById('flash-counter').textContent = (state.current + 1) + ' / ' + total;
  // 穴埋め形式は「完成形→意味」、質問形式（〜は？）は「問題文→答え＋解説」
  const isFill = q.question.includes('___');
  const isQType = !isFill && /[？?]/.test(q.question);
  let front, back, backSub;
  if (isFill) {
    front = q.question.replace('___', q.answer);
    back = q.meaning || '';
    backSub = '';
  } else {
    // 質問形式（〜は？）や外来語（単語のみ）：問題文→答え＋解説
    front = q.question;
    back = q.answer;
    backSub = (q.meaning && q.meaning !== q.answer) ? q.meaning : '';
  }
  const fq = document.getElementById('flash-question');
  fq.textContent = front;
  fq.classList.toggle('small', front.length > 16);
  const fa = document.getElementById('flash-answer');
  fa.textContent = back;
  fa.classList.toggle('small', back.length > 12);
  document.getElementById('flash-answer-sub').textContent = backSub;
  document.querySelector('#flash-card .flip-hint').textContent = isQType ? 'タップして答えを見る' : 'タップして意味を見る';

  const card = document.getElementById('flash-card');
  card.classList.remove('flipped');
  state.flipped = false;
  document.getElementById('flash-buttons').classList.add('hidden');

  const pct = Math.round((state.current / total) * 100);
  document.getElementById('flash-bar').style.width = pct + '%';
}

document.getElementById('flash-card').onclick = () => {
  const card = document.getElementById('flash-card');
  if (!state.flipped) {
    card.classList.add('flipped');
    state.flipped = true;
    document.getElementById('flash-buttons').classList.remove('hidden');
  }
};

document.getElementById('btn-remember').onclick = () => {
  recordResult(state.sessionQs[state.current].id, true);
  state.correct++;
  state.current++;
  renderFlash();
};

document.getElementById('btn-again').onclick = () => {
  const q = state.sessionQs[state.current];
  recordResult(q.id, false);
  state.wrong++;
  // 同じカードを3枚あとに差し込んでもう一度出す（残りが少なければ最後）
  const insertAt = Math.min(state.current + 3, state.sessionQs.length);
  state.sessionQs.splice(insertAt, 0, q);
  state.current++;
  showToast('このカードはすぐまた出ます');
  renderFlash();
};

// ============================================================
// 四択クイズ
// ============================================================

function startQuiz() {
  document.getElementById('quiz-title').textContent = CATEGORIES[state.selectedCat].label;
  document.getElementById('quiz-correct').textContent = '0';
  document.getElementById('quiz-wrong').textContent   = '0';
  showScreen('quiz');
  renderQuiz();
}

function renderQuiz() {
  const q = state.sessionQs[state.current];
  if (!q) { endSession(); return; }

  const total = state.sessionQs.length;
  document.getElementById('quiz-counter').textContent = (state.current + 1) + ' / ' + total;
  document.getElementById('quiz-question').textContent = q.question;
  document.getElementById('quiz-meaning').textContent  = q.meaning || '';

  const choices = buildChoices(q, state.questions);
  const grid = document.getElementById('quiz-choices');
  grid.innerHTML = '';
  choices.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = ch;
    btn.onclick = () => onQuizChoose(btn, ch, q, grid);
    grid.appendChild(btn);
  });

  document.getElementById('quiz-feedback').classList.add('hidden');
}

function onQuizChoose(btn, chosen, q, grid) {
  const correct = normalize(chosen) === normalize(q.answer);
  recordResult(q.id, correct);
  if (correct) {
    state.correct++;
    btn.classList.add('correct');
  } else {
    state.wrong++;
    btn.classList.add('wrong');
    // 正解ボタンをハイライト
    grid.querySelectorAll('.choice-btn').forEach(b => {
      if (normalize(b.textContent) === normalize(q.answer)) b.classList.add('correct');
    });
  }
  // ボタン無効化
  grid.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  document.getElementById('quiz-correct').textContent = state.correct;
  document.getElementById('quiz-wrong').textContent   = state.wrong;

  const fb = document.getElementById('quiz-feedback');
  document.getElementById('feedback-text').textContent = correct ? '⭕ 正解！' : '❌ 不正解';
  document.getElementById('feedback-ans').textContent = correct ? '' : '正解：' + q.answer;
  fb.classList.remove('hidden');
}

document.getElementById('btn-next-quiz').onclick = () => {
  state.current++;
  renderQuiz();
};

// ============================================================
// 虫食い問題
// ============================================================

function startFill() {
  document.getElementById('fill-title').textContent = CATEGORIES[state.selectedCat].label;
  document.getElementById('fill-correct').textContent = '0';
  document.getElementById('fill-wrong').textContent   = '0';
  showScreen('fill');
  renderFill();
}

function renderFill() {
  const q = state.sessionQs[state.current];
  if (!q) { endSession(); return; }

  const total = state.sessionQs.length;
  document.getElementById('fill-counter').textContent = (state.current + 1) + ' / ' + total;
  document.getElementById('fill-question').textContent = q.question;
  // 漢字の読みでは meaning に答えが含まれるため表示しない
  document.getElementById('fill-meaning').textContent = state.selectedCat === 'kanji_yomi' ? '' : (q.meaning || '');

  const input = document.getElementById('fill-input');
  input.value = '';
  input.disabled = false;
  setTimeout(() => input.focus(), 100);

  document.getElementById('fill-feedback').classList.add('hidden');
  document.getElementById('btn-fill-submit').disabled = false;
}

function submitFill() {
  const q = state.sessionQs[state.current];
  const input = document.getElementById('fill-input');
  const val = input.value;
  if (!val.trim()) return;

  const correct = checkAnswer(val, q);
  recordResult(q.id, correct);

  if (correct) {
    state.correct++;
    document.getElementById('fill-correct').textContent = state.correct;
  } else {
    state.wrong++;
    document.getElementById('fill-wrong').textContent = state.wrong;
  }

  input.disabled = true;
  document.getElementById('btn-fill-submit').disabled = true;

  const fb = document.getElementById('fill-feedback');
  document.getElementById('fill-feedback-text').textContent = correct ? '⭕ 正解！' : '❌ 不正解';
  document.getElementById('fill-feedback-ans').textContent  = correct ? '' : '正解：' + q.answer;
  fb.classList.remove('hidden');
}

document.getElementById('btn-fill-submit').onclick = submitFill;
document.getElementById('fill-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitFill();
});
document.getElementById('btn-next-fill').onclick = () => {
  state.current++;
  renderFill();
};

// ============================================================
// 漢字の書き取り（手書きキャンバス＋自己採点）
// ============================================================

const kanjiPad = { canvas: null, ctx: null, drawing: false, strokes: [], current: [] };

function initKanjiPad() {
  const cv = document.getElementById('kanji-canvas');
  kanjiPad.canvas = cv;
  kanjiPad.ctx = cv.getContext('2d');

  const pos = e => {
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (cv.width / r.width),
      y: (e.clientY - r.top) * (cv.height / r.height),
    };
  };
  cv.onpointerdown = e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    kanjiPad.drawing = true;
    kanjiPad.current = [pos(e)];
    drawKanjiPad();
  };
  cv.onpointermove = e => {
    if (!kanjiPad.drawing) return;
    kanjiPad.current.push(pos(e));
    drawKanjiPad();
  };
  const up = e => {
    if (!kanjiPad.drawing) return;
    kanjiPad.drawing = false;
    if (kanjiPad.current.length > 1) kanjiPad.strokes.push(kanjiPad.current);
    kanjiPad.current = [];
    drawKanjiPad();
  };
  cv.onpointerup = up;
  cv.onpointercancel = up;

  // iOS Safariはtouch-action:noneだけでは親のスクロールを止めきれないことがある
  cv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  cv.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  document.getElementById('kanji-undo').onclick = () => { kanjiPad.strokes.pop(); drawKanjiPad(); };
  document.getElementById('kanji-clear').onclick = () => { kanjiPad.strokes = []; kanjiPad.current = []; drawKanjiPad(); };
}

function clearKanjiPad() {
  kanjiPad.strokes = [];
  kanjiPad.current = [];
  drawKanjiPad();
}

function drawKanjiPad() {
  const { canvas: cv, ctx } = kanjiPad;
  if (!ctx) return;
  // 背景
  ctx.fillStyle = '#f8f6ef';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // 十字ガイド（点線）
  ctx.strokeStyle = 'rgba(120,120,120,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 7]);
  ctx.beginPath(); ctx.moveTo(cv.width / 2, 0); ctx.lineTo(cv.width / 2, cv.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cv.height / 2); ctx.lineTo(cv.width, cv.height / 2); ctx.stroke();
  ctx.setLineDash([]);
  // ストローク
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const paint = pts => {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  kanjiPad.strokes.forEach(paint);
  paint(kanjiPad.current);
}

function startKanji() {
  document.getElementById('kanji-title').textContent = `書き取り（小${state.grade}）`;
  document.getElementById('kanji-correct').textContent = '0';
  document.getElementById('kanji-wrong').textContent = '0';
  if (!kanjiPad.ctx) initKanjiPad();
  showScreen('kanji');
  renderKanji();
}

function renderKanji() {
  const q = state.sessionQs[state.current];
  if (!q) { endSession(); return; }

  document.getElementById('kanji-counter').textContent = `${state.current + 1} / ${state.sessionQs.length}`;
  document.getElementById('kanji-question').textContent = q.question;
  clearKanjiPad();

  // 答えパネルを隠し、コントロールを表示
  document.getElementById('kanji-answer').classList.add('hidden');
  document.getElementById('kanji-controls').classList.remove('hidden');

  document.getElementById('kanji-show').onclick = () => {
    document.getElementById('kanji-answer-char').textContent = q.answer;
    document.getElementById('kanji-answer-meaning').textContent = q.meaning || '';
    document.getElementById('kanji-answer').classList.remove('hidden');
    document.getElementById('kanji-controls').classList.add('hidden');
  };
  document.getElementById('kanji-ok').onclick = () => {
    recordResult(q.id, true);
    state.correct++;
    document.getElementById('kanji-correct').textContent = state.correct;
    state.current++;
    renderKanji();
  };
  document.getElementById('kanji-ng').onclick = () => {
    recordResult(q.id, false);
    state.wrong++;
    document.getElementById('kanji-wrong').textContent = state.wrong;
    state.current++;
    renderKanji();
  };
}

// ============================================================
// セッション終了・結果画面
// ============================================================

// 応援キャラ（オカーン・チッチ、満点時はオットンも）
// 80点以上=喜びポーズ(happy) / 80点未満=応援ポーズ(fight)
function renderResultCheer(pct) {
  const perfect = pct >= 100;
  const happy = pct >= 80;
  document.getElementById('result-tensai').classList.toggle('hidden', !perfect);
  document.getElementById('cheer-char-otton').classList.toggle('hidden', !perfect);
  document.getElementById('result-hanamaru').classList.toggle('hidden', pct < 90);
  document.getElementById('result-cheer').classList.toggle('jump', happy);

  const pose = happy ? 'happy' : 'fight';
  document.getElementById('cheer-img-okan').src = `images/okan-${pose}.png`;
  document.getElementById('cheer-img-chicchi').src = `images/chicchi-${pose}.png`;
  document.getElementById('cheer-img-otton').src = 'images/otton-happy.png';

  let okan, chicchi;
  if (perfect)        { okan = '満点や！ようがんばった！'; chicchi = 'ピピーッ！！'; }
  else if (happy)     { okan = 'ようがんばった！'; chicchi = 'ええ感じやで〜！'; }
  else if (pct >= 50) { okan = '復習したらもっと伸びるで！'; chicchi = 'ファイトやで！'; }
  else                { okan = '大丈夫、まちがいは宝や！'; chicchi = 'ドンマイ！'; }
  document.getElementById('cheer-bubble-okan').textContent = okan;
  document.getElementById('cheer-bubble-chicchi').textContent = chicchi;
  document.getElementById('cheer-bubble-otton').textContent = '天才や！';
}

function endSession() {
  const total = state.correct + state.wrong;
  const rate  = total > 0 ? Math.round((state.correct / total) * 100) : 0;

  document.getElementById('result-correct').textContent = state.correct;
  document.getElementById('result-total').textContent   = total;
  document.getElementById('result-rate').textContent    = rate + '% 正解';
  document.getElementById('result-emoji').textContent   = rate >= 90 ? '🎉' : rate >= 70 ? '👍' : rate >= 50 ? '😊' : '💪';
  document.getElementById('result-comment').textContent =
    rate >= 90 ? 'すばらしい！灘中合格間違いなし！' :
    rate >= 70 ? 'いい調子！この調子で続けよう！' :
    rate >= 50 ? 'もう少し！苦手問題を復習しよう' :
                 '基礎から見直してみよう。君ならできる！';

  renderResultCheer(rate);
  maybeAwardPerfect(rate, total);
  showScreen('result');
  checkTitlePromotion();
  pushAchievementToRanking();

  // Firestoreに保存
  if (state.nickname) {
    saveScore(state.nickname, state.selectedCat, state.correct, total);
  }
  // ホーム用レート表示をクリア（再読み込み用）
  delete questionCache[state.selectedCat];

  // 結果画面のボタンを国語用に結線（算数・理科・社会が上書きするため毎回再設定）
  document.getElementById('btn-result-home').onclick = async () => {
    await loadQuestions(state.selectedCat);
    initHome();
    showScreen('home');
  };
  document.getElementById('btn-result-retry').onclick = () => {
    document.getElementById('btn-start').click();
  };
}

document.getElementById('btn-result-home').onclick = async () => {
  // キャッシュを再取得してレート更新
  await loadQuestions(state.selectedCat);
  initHome();
  showScreen('home');
};

document.getElementById('btn-result-retry').onclick = () => {
  // 同じカテゴリ・モードで再スタート
  document.getElementById('btn-start').click();
};

// ============================================================
// 進捗画面
// ============================================================

async function showProgressScreen() {
  showScreen('progress');
  document.getElementById('progress-user').textContent = state.nickname + ' さんの進捗';

  const catsEl = document.getElementById('progress-cats');
  catsEl.innerHTML = '';

  for (const [cat, info] of Object.entries(CATEGORIES)) {
    const qs = questionCache[cat] || [];
    if (!qs.length) continue;
    const rate = getCategoryRate(cat) ?? 0;
    const div = document.createElement('div');
    div.className = 'progress-cat';
    div.innerHTML = `
      <div class="progress-cat-name">${info.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div>
      <div class="bar-label">${rate}% 正解</div>
    `;
    catsEl.appendChild(div);
  }

  // 苦手リスト
  const weakEl = document.getElementById('weak-list');
  weakEl.innerHTML = '';
  if (state.selectedCat) {
    getWeakItems(state.selectedCat).slice(0, 20).forEach(q => {
      const p = getProgress()[q.id] || {};
      const r = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0;
      const d = document.createElement('div');
      d.className = 'weak-item';
      d.innerHTML = `
        <div class="w-q">${q.question}</div>
        <div class="w-a">答え：${q.answer}</div>
        <div class="w-r">正解率 ${r}%（${p.correct||0}/${p.total||0}）</div>
      `;
      weakEl.appendChild(d);
    });
    if (!getWeakItems(state.selectedCat).length) {
      weakEl.textContent = '苦手問題はまだありません。問題を解いてみよう！';
    }
  } else {
    weakEl.textContent = 'ホームでカテゴリを選んでから見てください';
  }
}

// ============================================================
// ランキング画面
// ============================================================

let currentRankCat = 'kotowaza';

async function showRankingScreen() {
  showScreen('ranking');
  await loadRanking(currentRankCat);
}

async function loadRanking(cat) {
  currentRankCat = cat;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rcat === cat);
  });
  const list = document.getElementById('ranking-list');
  list.innerHTML = '<div style="color:var(--sub);text-align:center;padding:20px">読み込み中...</div>';
  const data = await getLeaderboard(cat);
  list.innerHTML = '';
  if (!data.length) {
    list.innerHTML = '<div style="color:var(--sub);text-align:center;padding:20px">まだランキングがありません</div>';
    return;
  }
  data.forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = 'rank-item' + (entry.nickname === state.nickname ? ' me' : '');
    const medals = ['🥇','🥈','🥉'];
    const numClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    div.innerHTML = `
      <div class="rank-num ${numClass}">${medals[i] || (i + 1)}</div>
      <div class="rank-name">${entry.nickname}${entry.nickname === state.nickname ? ' ★' : ''}</div>
      <div class="rank-rate">${entry.rate}%</div>
    `;
    list.appendChild(div);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => loadRanking(btn.dataset.rcat);
});

// ============================================================
// 問題追加画面
// ============================================================

function showCustomScreen() {
  showScreen('custom');
  renderCustomList();
}

function renderCustomList() {
  const cat  = document.getElementById('custom-cat').value;
  const list = getCustomQuestions(cat);
  const el   = document.getElementById('custom-list');
  el.innerHTML = '';
  if (!list.length) { el.textContent = 'まだ追加された問題はありません'; return; }
  list.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'custom-item';
    d.innerHTML = `
      <div class="custom-item-q">${q.question}（${q.answer}）</div>
      <button class="btn-del" data-idx="${i}">🗑</button>
    `;
    d.querySelector('.btn-del').onclick = () => {
      const arr = getCustomQuestions(cat);
      arr.splice(i, 1);
      saveCustomQuestions(cat, arr);
      renderCustomList();
    };
    el.appendChild(d);
  });
}

document.getElementById('custom-cat').onchange = renderCustomList;

document.getElementById('btn-custom-add').onclick = () => {
  const cat     = document.getElementById('custom-cat').value;
  const question = document.getElementById('custom-question').value.trim();
  const answer   = document.getElementById('custom-answer').value.trim();
  const meaning  = document.getElementById('custom-meaning').value.trim();
  const rawChoices = document.getElementById('custom-choices').value.trim();

  if (!question || !answer) { showToast('問題文と答えは必須です'); return; }

  const distractors = rawChoices.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const choices = shuffle([answer, ...distractors]);

  const list = getCustomQuestions(cat);
  const id   = 'c' + cat + '_' + Date.now();
  list.push({ id, question, answer, meaning, choices });
  saveCustomQuestions(cat, list);

  // フォームクリア
  ['custom-question','custom-answer','custom-meaning','custom-choices'].forEach(id => {
    document.getElementById(id).value = '';
  });

  showToast('問題を追加しました！');
  renderCustomList();
};

// ============================================================
// 戻るボタン共通
// ============================================================

document.querySelectorAll('.back-btn').forEach(btn => {
  btn.onclick = () => {
    const target = btn.dataset.back || 'home';
    if (target === 'home') { initHome(); showScreen('home'); }
    else showScreen(target);
  };
});

// ============================================================
// ニックネーム入力
// ============================================================

document.getElementById('nickname-btn').onclick = () => {
  const val = document.getElementById('nickname-input').value.trim();
  if (!val) { showToast('受験番号を入力してください'); return; }
  state.nickname = val;
  saveNickname(val);
  initSubject();
  showScreen('subject');
};

document.getElementById('nickname-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('nickname-btn').click();
});

function renderNicknameHistory() {
  const box = document.getElementById('nickname-history');
  const names = getNicknameHistory();
  box.innerHTML = '';
  if (names.length === 0) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const label = document.createElement('p');
  label.className = 'nick-history-label';
  label.textContent = 'タップでログイン';
  box.appendChild(label);
  const row = document.createElement('div');
  row.className = 'nick-history-row';
  names.forEach(n => {
    const b = document.createElement('button');
    b.className = 'nick-history-btn';
    b.textContent = '👤 ' + n;
    b.onclick = () => {
      state.nickname = n;
      saveNickname(n);
      initSubject();
      showScreen('subject');
    };
    row.appendChild(b);
  });
  box.appendChild(row);
}

// ============================================================
// 起動時処理
// ============================================================

async function boot() {
  const name = getNickname();
  if (name) {
    state.nickname = name;
    addNicknameHistory(name);
    loadQuestions('kotowaza').catch(() => {});
    loadQuestions('kanyoku').catch(() => {});
    loadQuestions('yojijukugo').catch(() => {});
    loadQuestions('gairaigo').catch(() => {});
    initSubject();
    showScreen('subject');
  } else {
    renderNicknameHistory();
    showScreen('nickname');
  }
}

function initSubject() {
  document.getElementById('subject-nickname').textContent = state.nickname;

  // 称号バッジ・がんばりの記録カード
  const ach = getAchievement();
  const title = getTitleInfo(ach.titlePct);
  document.getElementById('subject-title-badge').textContent = `${title.icon} ${title.name}`;
  const lb = getLoginInfo();
  document.getElementById('record-mini').textContent =
    `達成率 ${Math.floor(ach.titlePct * 10) / 10}%・🔥${lb.streak || 0}日連続`;
  document.getElementById('btn-record').onclick = () => { initRecord(); showScreen('record'); };

  // ログインボーナス＆問題追加チェック（どちらも冪等）
  checkNewQuestions();
  checkLoginBonus();

  // 日付とあいさつ（時間帯で変化）
  const now = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  document.getElementById('otton-date').textContent =
    `${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;
  const h = now.getHours();
  let msg;
  if (h >= 5 && h < 10)       msg = '「おはようさん！<br>朝の勉強は頭に入るで！」';
  else if (h >= 10 && h < 17) msg = '「科目を選んで、<br>今日も一緒に頑張ろうや！」';
  else if (h >= 17 && h < 22) msg = '「おかえり！夜の勉強も<br>オトンが見守っとるで！」';
  else                        msg = '「遅うまでえらいなあ。<br>無理せんとな！」';
  document.getElementById('otton-msg').innerHTML = msg;

  document.querySelectorAll('.subject-card').forEach(btn => {
    if (btn.id === 'btn-record') return; // 記録カードは専用ハンドラ
    btn.onclick = () => {
      if (btn.classList.contains('coming-soon')) {
        showToast('もうすぐ追加されます！工事中🚧');
        return;
      }
      const subj = btn.dataset.subject;
      if (subj === 'sansu') {
        initSansuHome();
        showScreen('sansu-home');
      } else if (subj === 'rika') {
        initRikaHome();
        showScreen('rika-home');
      } else if (subj === 'shakai') {
        initShakaiHome();
        showScreen('shakai-home');
      } else if (subj === 'game') {
        initTetris();
        showScreen('tetris');
      } else {
        initHome();
        showScreen('home');
      }
    };
  });

  document.getElementById('btn-subject-char').onclick = () => showScreen('character');
  document.getElementById('btn-subject-change').onclick = () => {
    localStorage.removeItem('nickname');
    state.nickname = '';
    document.getElementById('nickname-input').value = '';
    renderNicknameHistory();
    showScreen('nickname');
  };
}

document.addEventListener('DOMContentLoaded', boot);

// ============================================================
// Service Worker 登録
// ============================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW登録失敗:', e));
  });
}

// ============================================================
// 算数モード
// ============================================================

const SANSU_FILES = {
  keisan:  'data/sansu_keisan.json',
  bun:     'data/sansu_bun.json',
  zu:      'data/sansu_zu.json',
  kisoku:  'data/sansu_kisoku.json',
  tokusan: 'data/sansu_tokusan.json',
  baai:    'data/sansu_baai.json',
  kazu:    'data/sansu_kazu.json',
  wariai:  'data/sansu_wariai.json',
  hayasa:  'data/sansu_hayasa.json',
  rittai:  'data/sansu_rittai.json',
};
const SANSU_CAT_LABELS = {
  keisan:'計算', bun:'文章題', zu:'平面図形', kisoku:'規則性',
  tokusan:'特殊算', baai:'場合の数', kazu:'数の性質',
  wariai:'割合と比', hayasa:'速さ', rittai:'立体図形'
};
const DIFF_LABELS = { 1:'やさしい', 2:'難しい', 3:'チャレンジ', 4:'灘中レベル' };
const DRILL_TYPE_LABELS = {
  add:'足し算', sub:'引き算', mul:'かけ算', div:'割り算',
  divrem:'余りあり', decimal:'小数', fraction:'分数', mix:'ミックス'
};

// 理科ファイル・ラベル
const RIKA_FILES = {
  shokubutsu:'data/rika_shokubutsu.json', doubutsu:'data/rika_doubutsu.json',
  sora:'data/rika_sora.json', daichi:'data/rika_daichi.json',
  mono:'data/rika_mono.json', suiyoueki:'data/rika_suiyoueki.json',
  denki:'data/rika_denki.json', chikara:'data/rika_chikara.json',
};
const RIKA_CAT_LABELS = {
  shokubutsu:'植物', doubutsu:'動物と人体', sora:'天体と気象', daichi:'大地の変化',
  mono:'もののせいしつ', suiyoueki:'水よう液', denki:'電気と磁石', chikara:'力のつり合い',
};

// 社会ファイル・ラベル
const SHAKAI_FILES = {
  kokudo:'data/shakai_kokudo.json', sangyo:'data/shakai_sangyo.json',
  rekishi:'data/shakai_rekishi.json', komin:'data/shakai_komin.json',
};
const SHAKAI_CAT_LABELS = {
  kokudo:'国土と自然', sangyo:'産業とくらし', rekishi:'日本の歴史', komin:'政治と国際',
};

const sansuCache = {};
const sansuState = {
  subject: 'sansu', // 'sansu' | 'rika'
  grade: null, diff: null, cat: null,
  mode: null, // 'normal' | 'drill'
  drillType: null, drillTime: null,
  questions: [], current: 0, correct: 0, wrong: 0,
  // ドリル
  drillCorrect: 0, drillWrong: 0, drillTimerId: null, drillTimeLeft: 0,
  // テンキー
  inputVal: '', inputRemain: '', inputPhase: 'main', // 'main'|'remain'
  isRemainMode: false,
};

async function loadSansuQuestions(cat, grade, diff) {
  const fileMap = sansuState.subject === 'rika' ? RIKA_FILES
    : sansuState.subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES;
  const key = `${sansuState.subject}-${cat}`;
  if (!sansuCache[key]) {
    const res = await fetch(fileMap[cat]);
    sansuCache[key] = await res.json();
  }
  return sansuCache[key].filter(q => q.grade === grade && q.difficulty === diff);
}

// ── 算数ホーム初期化（階層式ステップUI） ──────────────────
function showSansuStep(id) {
  const el = document.getElementById(id);
  const wasHidden = el.classList.contains('hidden');
  el.classList.remove('hidden');
  if (wasHidden) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
}
function hideSansuSteps(...ids) {
  ids.forEach(id => document.getElementById(id).classList.add('hidden'));
}

function initSansuHome() {
  sansuState.subject = 'sansu';
  document.getElementById('sansu-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null;
  sansuState.mode = null; sansuState.drillType = null; sansuState.drillTime = null;

  // 戻るボタン
  document.querySelectorAll('[data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年（算数ホーム内に限定）
  document.querySelectorAll('#screen-sansu-home .grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.grade = Number(btn.dataset.grade);
      // 小4以上なら中学受験カテゴリ表示
      document.querySelectorAll('.juken-only').forEach(el => {
        el.classList.toggle('hidden', sansuState.grade < 4);
      });
      // 受験専用カテゴリ選択中に小1〜3へ変えたら解除
      if (sansuState.grade < 4 && ['kazu', 'rittai', 'wariai', 'hayasa', 'tokusan', 'baai'].includes(sansuState.cat)) {
        sansuState.cat = null;
        document.querySelectorAll('.sansu-cat-btn').forEach(b => b.classList.remove('selected'));
        hideSansuSteps('sansu-step-diff');
      }
      showSansuStep('sansu-step-mode');
      updateSansuStart();
    };
  });

  // STEP2: モード
  document.querySelectorAll('.sansu-mode-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.sansu-mode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.mode = btn.dataset.sansuMode;
      if (sansuState.mode === 'normal') {
        hideSansuSteps('sansu-step-dtype', 'sansu-step-time');
        showSansuStep('sansu-step-cat');
        if (sansuState.cat) showSansuStep('sansu-step-diff');
      } else {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff');
        showSansuStep('sansu-step-dtype');
        if (sansuState.drillType) showSansuStep('sansu-step-time');
      }
      // ドリルは出題数不要
      document.getElementById('sansu-qcount-wrap').classList.toggle('hidden', sansuState.mode === 'drill');
      updateSansuStart();
    };
  });

  // STEP3: カテゴリ（算数ホーム内）
  document.querySelectorAll('#screen-sansu-home .sansu-cat-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#screen-sansu-home .sansu-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.scat;
      showSansuStep('sansu-step-diff');
      updateSansuStart();
    };
  });

  // STEP4: 難易度（算数ホーム内）
  document.querySelectorAll('#screen-sansu-home .diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#screen-sansu-home .diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.diff = Number(btn.dataset.diff);
      updateSansuStart();
    };
  });

  // STEP3': ドリル種類
  document.querySelectorAll('.drill-type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.drill-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.drillType = btn.dataset.dtype;
      showSansuStep('sansu-step-time');
      updateSansuStart();
    };
  });

  // STEP4': 時間
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.drillTime = Number(btn.dataset.time);
      updateSansuStart();
    };
  });

  // スタートボタン
  document.getElementById('sansu-btn-start').onclick = () => startSansuSession();

  // 全ステップを初期状態（STEP1のみ表示）に
  hideSansuSteps('sansu-step-mode', 'sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-time');
  document.getElementById('sansu-start-zone').classList.add('hidden');

  // 終了バッジ（✅単元・👑学年）
  renderCatBadges('sansu');
  renderGradeCrowns('sansu');
}

function updateSansuStart() {
  const zone = document.getElementById('sansu-start-zone');
  const info = document.getElementById('sansu-start-info');
  let ready = false;

  if (sansuState.mode === 'normal') {
    ready = sansuState.grade && sansuState.cat && sansuState.diff;
    if (ready) {
      info.textContent = `小${sansuState.grade} / ${SANSU_CAT_LABELS[sansuState.cat]} / ${DIFF_LABELS[sansuState.diff]}`;
    }
  } else if (sansuState.mode === 'drill') {
    ready = sansuState.grade && sansuState.drillType && sansuState.drillTime !== null;
    if (ready) {
      const timeStr = sansuState.drillTime === 0 ? '無制限' : `${sansuState.drillTime}秒`;
      info.textContent = `小${sansuState.grade} / ${DRILL_TYPE_LABELS[sansuState.drillType]} / ${timeStr}`;
    }
  }

  zone.classList.toggle('hidden', !ready);
}

// ── 理科ホーム（学年→カテゴリ→難易度の階層式） ──────────
function initRikaHome() {
  sansuState.subject = 'rika';
  document.getElementById('rika-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null;

  document.querySelectorAll('#screen-rika-home [data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年
  document.querySelectorAll('.rika-grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.rika-grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.grade = Number(btn.dataset.grade);
      // 小4以上のみ受験カテゴリ表示
      document.querySelectorAll('.rika-juken-only').forEach(el => {
        el.classList.toggle('hidden', sansuState.grade < 4);
      });
      // 小1〜3で受験カテゴリ選択中なら解除
      if (sansuState.grade < 4 && ['daichi', 'suiyoueki', 'denki', 'chikara'].includes(sansuState.cat)) {
        sansuState.cat = null;
        document.querySelectorAll('.rika-cat-btn').forEach(b => b.classList.remove('selected'));
        hideSansuSteps('rika-step-diff');
      }
      showSansuStep('rika-step-cat');
      updateRikaStart();
    };
  });

  // STEP2: カテゴリ
  document.querySelectorAll('.rika-cat-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.rika-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.rcat;
      showSansuStep('rika-step-diff');
      updateRikaStart();
    };
  });

  // STEP3: 難易度
  document.querySelectorAll('.rika-diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.rika-diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.diff = Number(btn.dataset.diff);
      updateRikaStart();
    };
  });

  document.getElementById('rika-btn-start').onclick = () => startRikaSession();

  hideSansuSteps('rika-step-cat', 'rika-step-diff');
  document.getElementById('rika-start-zone').classList.add('hidden');

  renderCatBadges('rika');
  renderGradeCrowns('rika');
}

function updateRikaStart() {
  const zone = document.getElementById('rika-start-zone');
  const info = document.getElementById('rika-start-info');
  const ready = sansuState.grade && sansuState.cat && sansuState.diff;
  if (ready) {
    info.textContent = `小${sansuState.grade} / ${RIKA_CAT_LABELS[sansuState.cat]} / ${DIFF_LABELS[sansuState.diff]}`;
  }
  zone.classList.toggle('hidden', !ready);
}

async function startRikaSession() {
  showLoading();
  try {
    const all = sansuState.cat === 'mix'
      ? await loadMixQuestions(sansuState.grade, sansuState.diff)
      : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
    if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
    const countVal = document.getElementById('rika-q-count').value;
    const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
    sansuState.questions = shuffle([...all]).slice(0, count);
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

// ── 社会ホーム（学年→カテゴリ→難易度の階層式） ──────────
function initShakaiHome() {
  sansuState.subject = 'shakai';
  document.getElementById('shakai-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null;

  document.querySelectorAll('#screen-shakai-home [data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年（小3〜6）
  document.querySelectorAll('.shakai-grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.shakai-grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.grade = Number(btn.dataset.grade);
      showSansuStep('shakai-step-cat');
      updateShakaiStart();
    };
  });

  // STEP2: カテゴリ
  document.querySelectorAll('.shakai-cat-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.shakai-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.hcat;
      showSansuStep('shakai-step-diff');
      updateShakaiStart();
    };
  });

  // STEP3: 難易度
  document.querySelectorAll('.shakai-diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.shakai-diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.diff = Number(btn.dataset.diff);
      updateShakaiStart();
    };
  });

  document.getElementById('shakai-btn-start').onclick = () => startShakaiSession();

  hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
  document.getElementById('shakai-start-zone').classList.add('hidden');

  renderCatBadges('shakai');
  renderGradeCrowns('shakai');
}

function updateShakaiStart() {
  const zone = document.getElementById('shakai-start-zone');
  const info = document.getElementById('shakai-start-info');
  const ready = sansuState.grade && sansuState.cat && sansuState.diff;
  if (ready) {
    info.textContent = `小${sansuState.grade} / ${SHAKAI_CAT_LABELS[sansuState.cat]} / ${DIFF_LABELS[sansuState.diff]}`;
  }
  zone.classList.toggle('hidden', !ready);
}

async function startShakaiSession() {
  showLoading();
  try {
    const all = sansuState.cat === 'mix'
      ? await loadMixQuestions(sansuState.grade, sansuState.diff)
      : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
    if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
    const countVal = document.getElementById('shakai-q-count').value;
    const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
    sansuState.questions = shuffle([...all]).slice(0, count);
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

async function startSansuSession() {
  if (sansuState.mode === 'normal') {
    showLoading();
    try {
      const all = sansuState.cat === 'mix'
        ? await loadMixQuestions(sansuState.grade, sansuState.diff)
        : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
      if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
      const countVal = document.getElementById('sansu-q-count').value;
      const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
      sansuState.questions = shuffle([...all]).slice(0, count);
      sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
      hideLoading();
      startSansuQuiz();
    } catch(e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
  } else {
    startDrill();
  }
}

// ── 算数・理科クイズ（通常問題） ──────────────────────
function subjectCatLabels() {
  return sansuState.subject === 'rika' ? RIKA_CAT_LABELS
    : sansuState.subject === 'shakai' ? SHAKAI_CAT_LABELS : SANSU_CAT_LABELS;
}
function subjectHomeScreen() {
  return sansuState.subject === 'rika' ? 'rika-home'
    : sansuState.subject === 'shakai' ? 'shakai-home' : 'sansu-home';
}

function startSansuQuiz() {
  const catLabel = subjectCatLabels()[sansuState.cat] || '問題';
  document.getElementById('sansu-quiz-title').textContent = catLabel;
  const homeScreen = subjectHomeScreen();
  document.querySelectorAll('[data-back="sansu-home"]').forEach(b => b.onclick = () => { showScreen(homeScreen); });
  initNumpad('sq');
  renderSansuQuiz();
  showScreen('sansu-quiz');
}

function renderSansuQuiz() {
  const total = sansuState.questions.length;
  if (sansuState.current >= total) { endSansuSession(); return; }

  const q = sansuState.questions[sansuState.current];
  document.getElementById('sansu-quiz-counter').textContent = `${sansuState.current + 1}/${total}`;
  document.getElementById('sq-question').textContent = q.question;
  document.getElementById('sq-meaning').textContent = '';
  const figEl = document.getElementById('sq-figure');
  if (q.svg) { figEl.innerHTML = q.svg; figEl.classList.remove('hidden'); }
  else { figEl.innerHTML = ''; figEl.classList.add('hidden'); }

  // バッジ
  document.getElementById('sq-grade-badge').textContent = `小${sansuState.grade}`;
  const diffBadge = document.getElementById('sq-diff-badge');
  diffBadge.textContent = DIFF_LABELS[sansuState.diff] || '';
  diffBadge.dataset.level = sansuState.diff;
  const typeBadge = document.getElementById('sq-type-badge');
  if (q.type) { typeBadge.textContent = q.type; typeBadge.classList.remove('hidden'); }
  else { typeBadge.classList.add('hidden'); }

  // フィードバック非表示
  document.getElementById('sq-feedback').classList.add('hidden');

  const numpad = document.getElementById('sq-numpad');
  const previewWrap = document.getElementById('sq-preview-wrap');
  const remainWrap = document.getElementById('sq-remain-wrap');
  const choicesWrap = document.getElementById('sq-choices');

  if (q.choices && q.choices.length) {
    // 4択モード：テンキー系を隠して選択肢を表示
    numpad.classList.add('hidden');
    previewWrap.classList.add('hidden');
    remainWrap.classList.add('hidden');
    choicesWrap.classList.remove('hidden');
    choicesWrap.innerHTML = '';
    shuffle([...q.choices]).forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'sq-choice-btn';
      btn.textContent = ch;
      btn.onclick = () => submitChoiceAnswer(ch, btn);
      choicesWrap.appendChild(btn);
    });
  } else {
    // テンキーモード
    choicesWrap.classList.add('hidden');
    numpad.classList.remove('hidden');
    previewWrap.classList.remove('hidden');
    sansuState.isRemainMode = q.answer && q.answer.includes('余り');
    remainWrap.classList.toggle('hidden', !sansuState.isRemainMode);
    numpad.querySelector('.numpad-rem').classList.toggle('hidden', !sansuState.isRemainMode);
    sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputPhase = 'main';
    updateNumpadPreview('sq');
    numpad.querySelectorAll('.numpad-btn').forEach(b => b.disabled = false);
  }
}

// 正誤フィードバックの共通表示
function showSqFeedback(q, correct) {
  // 教科間でIDが衝突するため subject_cat:id 形式で記録（ミックスは出身カテゴリq._cat）
  recordResult(`${sansuState.subject}_${q._cat || sansuState.cat}:${q.id}`, correct);
  if (correct) { sansuState.correct++; document.getElementById('sq-correct').textContent = sansuState.correct; }
  else { sansuState.wrong++; document.getElementById('sq-wrong').textContent = sansuState.wrong; }

  const fb = document.getElementById('sq-feedback');
  document.getElementById('sq-feedback-text').textContent = correct ? '✅ 正解！' : '❌ 不正解';
  document.getElementById('sq-feedback-ans').textContent = correct ? (q.meaning || '') : `正解：${q.answer}　${q.meaning || ''}`;
  document.getElementById('sq-meaning').textContent = '';
  fb.classList.remove('hidden');

  document.getElementById('sq-btn-next').onclick = () => {
    sansuState.current++;
    renderSansuQuiz();
  };
}

function submitSansuAnswer() {
  const q = sansuState.questions[sansuState.current];
  let userAnswer = sansuState.inputVal.trim();
  if (sansuState.isRemainMode) {
    userAnswer = `${sansuState.inputVal.trim()}余り${sansuState.inputRemain.trim()}`;
  }
  if (!userAnswer || userAnswer === '余り') { showToast('答えを入力してください'); return; }

  const correct = checkSansuAnswer(userAnswer, q.answer);
  document.getElementById('sq-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = true);
  showSqFeedback(q, correct);
}

function submitChoiceAnswer(chosen, btn) {
  const q = sansuState.questions[sansuState.current];
  const correct = checkSansuAnswer(chosen, q.answer);
  // 全ボタンを無効化し、正解を緑・誤答を赤で示す
  document.querySelectorAll('#sq-choices .sq-choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('choice-correct');
    else if (b === btn) b.classList.add('choice-wrong');
  });
  showSqFeedback(q, correct);
}

function checkSansuAnswer(input, correct) {
  const normalize = s => String(s).trim().replace(/\s/g, '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).toLowerCase();
  return normalize(input) === normalize(correct);
}

function endSansuSession() {
  const total = sansuState.questions.length;
  const score = total > 0 ? Math.round(sansuState.correct / total * 100) : 0;
  let emoji, comment;
  if (score === 100) { emoji = '🏆'; comment = '満点！常在戦場！'; }
  else if (score >= 80) { emoji = '⭐'; comment = 'よくできました！'; }
  else if (score >= 60) { emoji = '👍'; comment = 'もう一息！'; }
  else { emoji = '💪'; comment = 'もう一度チャレンジ！'; }

  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-correct').textContent = sansuState.correct;
  document.getElementById('result-total').textContent = total;
  document.getElementById('result-rate').textContent = `${score}点`;
  document.getElementById('result-comment').textContent = comment;
  renderResultCheer(score);
  maybeAwardPerfect(score, total);

  document.getElementById('btn-result-home').onclick = () => {
    if (sansuState.subject === 'rika') { initRikaHome(); showScreen('rika-home'); }
    else if (sansuState.subject === 'shakai') { initShakaiHome(); showScreen('shakai-home'); }
    else { initSansuHome(); showScreen('sansu-home'); }
  };
  document.getElementById('btn-result-retry').onclick = () => {
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    sansuState.questions = shuffle([...sansuState.questions]);
    document.getElementById('sq-correct').textContent = '0';
    document.getElementById('sq-wrong').textContent = '0';
    startSansuQuiz();
  };

  showScreen('result');
  checkTitlePromotion();
  pushAchievementToRanking();
}

// ── テンキー共通 ────────────────────────────────────────
function initNumpad(prefix) {
  const numpad = document.getElementById(`${prefix}-numpad`);
  numpad.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => handleNumpadKey(prefix, btn.dataset.key);
  });
}

function handleNumpadKey(prefix, key) {
  if (key === 'submit') {
    if (prefix === 'sq') submitSansuAnswer();
    else if (prefix === 'drill') submitDrillAnswer();
    return;
  }
  if (key === 'rem') {
    sansuState.inputPhase = 'remain';
    updateNumpadPreview(prefix);
    return;
  }
  if (key === 'del') {
    if (sansuState.inputPhase === 'remain') {
      sansuState.inputRemain = sansuState.inputRemain.slice(0, -1);
    } else {
      sansuState.inputVal = sansuState.inputVal.slice(0, -1);
    }
    updateNumpadPreview(prefix);
    return;
  }
  // 数字・小数点
  if (sansuState.inputPhase === 'remain') {
    if (key === '.') return; // 余りに小数点不要
    sansuState.inputRemain += key;
  } else {
    if (key === '.' && sansuState.inputVal.includes('.')) return;
    sansuState.inputVal += key;
  }
  updateNumpadPreview(prefix);
}

function updateNumpadPreview(prefix) {
  const mainEl = document.getElementById(`${prefix}-preview`);
  const remainEl = document.getElementById(`${prefix}-remain-preview`);
  mainEl.textContent = sansuState.inputVal || '＿';
  if (remainEl) remainEl.textContent = sansuState.inputRemain || '＿';
}

// ── 計算ドリル ──────────────────────────────────────────

// 問題自動生成
function generateDrillProblem() {
  const g = sansuState.grade;
  let type = sansuState.drillType;
  if (type === 'mix') {
    const types = getAvailableDrillTypes(g);
    type = types[Math.floor(Math.random() * types.length)];
  }

  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  if (type === 'add') {
    const ranges = [[1,9],[10,99],[100,500],[100,999],[1000,9999],[1000,9999]];
    const [lo,hi] = ranges[g-1];
    const a=rnd(lo,hi), b=rnd(1,hi);
    return { question: `${a} ＋ ${b} ＝`, answer: String(a+b) };
  }
  if (type === 'sub') {
    const ranges = [[1,9],[10,99],[100,500],[100,999],[1000,9999],[1000,9999]];
    const [lo,hi] = ranges[g-1];
    const b=rnd(lo,hi), a=b+rnd(1,hi);
    return { question: `${a} － ${b} ＝`, answer: String(a-b) };
  }
  if (type === 'mul') {
    if (g <= 2) { const a=rnd(2,9),b=rnd(2,9); return { question:`${a} × ${b} ＝`, answer:String(a*b) }; }
    if (g === 3) { const a=rnd(2,9),b=rnd(10,50); return { question:`${a} × ${b} ＝`, answer:String(a*b) }; }
    const a=rnd(10,99),b=rnd(10,99); return { question:`${a} × ${b} ＝`, answer:String(a*b) };
  }
  if (type === 'div') {
    const d=rnd(2,9), q2=rnd(2,12), n=d*q2;
    return { question:`${n} ÷ ${d} ＝`, answer:String(q2) };
  }
  if (type === 'divrem') {
    const d=rnd(2,9), q2=rnd(2,12), r=rnd(1,d-1), n=d*q2+r;
    return { question:`${n} ÷ ${d} ＝ □ あまり □`, answer:`${q2}余り${r}`, isRemain:true };
  }
  if (type === 'decimal') {
    const a=(rnd(1,99)/10).toFixed(1), b=(rnd(1,99)/10).toFixed(1);
    const ans=(parseFloat(a)+parseFloat(b)).toFixed(1).replace(/\.0$/,'');
    return { question:`${a} ＋ ${b} ＝`, answer:ans };
  }
  if (type === 'fraction') {
    const den=rnd(2,8), n1=rnd(1,den-1), n2=rnd(1,den-n1);
    const num=n1+n2;
    const g2 = (a,b) => b===0?a:g2(b,a%b);
    const gc = g2(num,den);
    const ans = gc===den ? String(num/gc) : `${num/gc}/${den/gc}`;
    return { question:`${n1}/${den} ＋ ${n2}/${den} ＝`, answer:ans };
  }
  // fallback add
  const a=rnd(1,9),b=rnd(1,9);
  return { question:`${a} ＋ ${b} ＝`, answer:String(a+b) };
}

function getAvailableDrillTypes(grade) {
  const base = ['add','sub'];
  if (grade >= 2) base.push('mul');
  if (grade >= 3) base.push('div','divrem');
  if (grade >= 4) base.push('decimal');
  if (grade >= 5) base.push('fraction');
  return base;
}

function startDrill() {
  sansuState.drillCorrect = 0; sansuState.drillWrong = 0;
  sansuState.drillTimeLeft = sansuState.drillTime;
  sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputPhase = 'main';

  document.getElementById('drill-correct').textContent = '0';
  document.getElementById('drill-wrong').textContent = '0';
  document.getElementById('drill-result').classList.add('hidden');
  document.getElementById('drill-numpad').classList.remove('hidden');
  document.getElementById('drill-timer-wrap').classList.toggle('hidden', sansuState.drillTime === 0);
  document.getElementById('drill-score-label').textContent = '';
  document.getElementById('drill-feedback').classList.add('hidden');

  document.querySelectorAll('[data-back="sansu-home"]').forEach(b => b.onclick = () => {
    clearInterval(sansuState.drillTimerId);
    showScreen('sansu-home');
  });

  initNumpad('drill');
  showScreen('drill');
  renderDrillProblem();

  // タイムアタックのみタイマー起動
  if (sansuState.drillTime > 0) {
    updateDrillTimer();
    sansuState.drillTimerId = setInterval(() => {
      sansuState.drillTimeLeft--;
      updateDrillTimer();
      if (sansuState.drillTimeLeft <= 0) {
        clearInterval(sansuState.drillTimerId);
        endDrill();
      }
    }, 1000);
  }
}

function updateDrillTimer() {
  document.getElementById('drill-timer-sec').textContent = sansuState.drillTimeLeft;
  const pct = (sansuState.drillTimeLeft / sansuState.drillTime) * 100;
  document.getElementById('drill-timer-bar').style.width = `${pct}%`;
  document.getElementById('drill-timer-bar').style.background =
    pct > 50 ? 'var(--grad-accent)' : pct > 20 ? 'var(--grad-gold)' : 'var(--grad-red)';
}

let _currentDrillQ = null;

function renderDrillProblem() {
  _currentDrillQ = generateDrillProblem();
  document.getElementById('drill-question').textContent = _currentDrillQ.question;

  sansuState.isRemainMode = !!_currentDrillQ.isRemain;
  document.getElementById('drill-remain-wrap').classList.toggle('hidden', !sansuState.isRemainMode);
  document.querySelector('#drill-numpad .numpad-rem').classList.toggle('hidden', !sansuState.isRemainMode);

  sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputPhase = 'main';
  updateNumpadPreview('drill');
  document.getElementById('drill-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = false);

  // 無制限モードの場合フィードバックを非表示
  if (sansuState.drillTime === 0) {
    document.getElementById('drill-feedback').classList.add('hidden');
  }
}

function submitDrillAnswer() {
  if (!_currentDrillQ) return;
  let userAnswer = sansuState.inputVal.trim();
  if (sansuState.isRemainMode) userAnswer = `${sansuState.inputVal.trim()}余り${sansuState.inputRemain.trim()}`;
  if (!userAnswer || userAnswer === '余り') { showToast('答えを入力してください'); return; }

  const correct = checkSansuAnswer(userAnswer, _currentDrillQ.answer);

  if (correct) {
    sansuState.drillCorrect++;
    document.getElementById('drill-correct').textContent = sansuState.drillCorrect;
    // タイムアタックは即次の問題、無制限はフィードバック表示
    if (sansuState.drillTime > 0) {
      renderDrillProblem();
    } else {
      showDrillFeedback(true, _currentDrillQ.answer);
    }
  } else {
    sansuState.drillWrong++;
    document.getElementById('drill-wrong').textContent = sansuState.drillWrong;
    showDrillFeedback(false, _currentDrillQ.answer);
  }
}

function showDrillFeedback(correct, correctAnswer) {
  const fb = document.getElementById('drill-feedback');
  document.getElementById('drill-feedback-text').textContent = correct ? '✅ 正解！' : '❌ 不正解';
  document.getElementById('drill-feedback-ans').textContent = correct ? '' : `正解：${correctAnswer}`;
  fb.classList.remove('hidden');
  document.getElementById('drill-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = true);
  document.getElementById('drill-btn-next').onclick = () => {
    fb.classList.add('hidden');
    renderDrillProblem();
  };
  // タイムアタックの場合は短時間表示後自動次へ
  if (sansuState.drillTime > 0) {
    setTimeout(() => { fb.classList.add('hidden'); renderDrillProblem(); }, 800);
  }
}

function endDrill() {
  document.getElementById('drill-numpad').classList.add('hidden');
  document.getElementById('drill-feedback').classList.add('hidden');

  const score = sansuState.drillCorrect;
  const total = sansuState.drillCorrect + sansuState.drillWrong;
  const rate = total > 0 ? Math.round(score / total * 100) : 0;

  let emoji, comment;
  if (sansuState.drillTime === 0) {
    // 無制限は正解率
    if (rate === 100) { emoji = '🏆'; comment = '満点！常在戦場！'; }
    else if (rate >= 80) { emoji = '⭐'; comment = 'よくできました！'; }
    else if (rate >= 60) { emoji = '👍'; comment = 'もう一息！'; }
    else { emoji = '💪'; comment = 'もう一度チャレンジ！'; }
    document.getElementById('drill-result-score').textContent = `${rate}点（${score}/${total}問正解）`;
  } else {
    // タイムアタックは正解数がスコア
    if (score >= 30) { emoji = '🏆'; comment = '常在戦場！すごい！'; }
    else if (score >= 20) { emoji = '⭐'; comment = 'よくできました！'; }
    else if (score >= 10) { emoji = '👍'; comment = 'もう一息！'; }
    else { emoji = '💪'; comment = 'もう一度チャレンジ！'; }
    document.getElementById('drill-result-score').textContent = `${score}点！（${sansuState.drillTime}秒で${score}問正解）`;
  }

  document.getElementById('drill-result-emoji').textContent = emoji;
  document.getElementById('drill-result-comment').textContent = comment;
  document.getElementById('drill-result').classList.remove('hidden');

  // 無制限モードで5問以上の満点ならアイテムボーナス
  if (sansuState.drillTime === 0 && rate === 100 && total >= 5) {
    const kind = randomItemKind();
    addItem(kind, 1);
    showToast(`${ITEM_DEFS[kind].icon} 満点ボーナス！「${ITEM_DEFS[kind].label}」ゲット！`, 3000);
  }

  document.getElementById('drill-btn-again').onclick = () => startDrill();
  document.getElementById('drill-btn-home').onclick = () => { initSansuHome(); showScreen('sansu-home'); };
}

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
  document.querySelectorAll('.t-item-btn').forEach(btn => {
    btn.onclick = () => tUseItem(btn.dataset.item);
  });
  updateItemButtons();
  if (!tetris.controlsReady) { initTetrisControls(); tetris.controlsReady = true; }
  startTetris();
}

function startTetris() {
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
  document.getElementById('tetris-best').textContent = Math.max(tetris.score, prevBest);
  document.getElementById('tetris-overlay-emoji').textContent = isNewBest ? '🏆' : '💥';
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
// テトリス サウンド（Web Audioで自作・デフォルトOFF）
// ============================================================

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
  }
}

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
// テトリス 応援キャラ（ドット絵：オットン・オカーン・チッチ）
// ============================================================

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
  },
};

const T_CHEERS = ['ええぞ！', 'やったな！', 'ナイスや！', 'その調子！', 'ピピッ♪', 'がんばってるやん！'];

const tChars = { timer: null, tick: 0, mood: 'idle', moodUntil: 0, bubble: '' };

function tDrawSprite(ctx, rows, pal, ox, oy, s) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (col) { ctx.fillStyle = col; ctx.fillRect(ox + c * s, oy + r * s, s, s); }
    }
  });
}

function tDrawChars() {
  const cv = document.getElementById('tetris-chars');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (tChars.mood === 'cheer' && Date.now() > tChars.moodUntil) { tChars.mood = 'idle'; tChars.bubble = ''; }

  const s = 4;
  [T_SPRITES.otton, T_SPRITES.okan, T_SPRITES.chicchi].forEach((sp, i) => {
    const cheer = tChars.mood === 'cheer';
    const frame = cheer && tChars.tick % 2 === 0 ? sp.cheer : sp.idle;
    const bounce = cheer
      ? (tChars.tick % 2 === 0 ? -5 : 0)
      : Math.round(Math.sin((tChars.tick + i * 2) / 2) * 2);
    const x = 32 + i * 104;
    const y = cv.height - frame.length * s - 2 + bounce;
    tDrawSprite(ctx, frame, sp.pal, x, y, s);
  });

  if (tChars.bubble) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = tChars.mood === 'cheer' ? '#ffd166' : '#9db2e8';
    ctx.fillText(tChars.bubble, cv.width / 2, 13);
  }
  tChars.tick++;
}

function tStartChars() {
  clearInterval(tChars.timer);
  tChars.timer = setInterval(tDrawChars, 160);
  tDrawChars();
}

function tStopChars() { clearInterval(tChars.timer); tChars.timer = null; }

function tCharsCheer(lines) {
  tChars.mood = 'cheer';
  tChars.moodUntil = Date.now() + (lines >= 4 ? 3000 : 1500);
  tChars.bubble = lines >= 4 ? '4ライン！すごいで！' : T_CHEERS[Math.floor(Math.random() * T_CHEERS.length)];
}

// ============================================================
// ゲーミフィケーション（達成率・称号・ログインボーナス・アイテム）
// ============================================================

// 教科→カテゴリ→問題数（データは静的なのでハードコード。問題追加時はここを更新）
const QUESTION_COUNTS = {
  kokugo: { kotowaza: 500, kanyoku: 500, yojijukugo: 500, gairaigo: 400, kanji_kaki: 480, kanji_yomi: 480,
            kokugo_keigo: 160, kokugo_goi: 160, kokugo_bushu: 160, kokugo_bungaku: 160 },   // 3,500
  sansu:  { keisan: 480, bun: 480, zu: 480, kisoku: 480, tokusan: 240, baai: 240, kazu: 240,
            wariai: 240, hayasa: 240, rittai: 240 },                                         // 3,360
  rika:   { shokubutsu: 480, doubutsu: 480, sora: 480, mono: 480, daichi: 240, suiyoueki: 240,
            denki: 240, chikara: 240 },                                                      // 2,880
  shakai: { kokudo: 320, sangyo: 320, rekishi: 320, komin: 320 },                            // 1,280
};
const SUBJECT_LABELS = { kokugo: '国語', sansu: '算数', rika: '理科', shakai: '社会' };
// 称号判定は灘中3教科（社会は表示のみ）
const TITLE_SUBJECTS = ['kokugo', 'sansu', 'rika'];

// 旧形式の素ID→カテゴリ振り分け表（衝突プレフィックスは複数カテゴリに寛大加算）
const ID_PREFIX_MAP = {
  k: ['kokugo:kotowaza'], y: ['kokugo:kanyoku'], j: ['kokugo:yojijukugo'], g: ['kokugo:gairaigo'],
  kk: ['kokugo:kanji_kaki'], ky: ['kokugo:kanji_yomi'], kg: ['kokugo:kokugo_keigo'],
  gi: ['kokugo:kokugo_goi'], bs: ['kokugo:kokugo_bushu'], bg: ['kokugo:kokugo_bungaku'],
  sk: ['sansu:keisan', 'shakai:kokudo'],
  sr: ['sansu:kisoku', 'sansu:rittai', 'shakai:rekishi'],
  rd: ['rika:doubutsu', 'rika:denki'],
  sb: ['sansu:bun'], sz: ['sansu:zu'], st: ['sansu:tokusan'], sc: ['sansu:baai'],
  sn: ['sansu:kazu'], sw: ['sansu:wariai'], sh: ['sansu:hayasa'],
  rp: ['rika:shokubutsu'], rk: ['rika:sora'], rg: ['rika:daichi'], rm: ['rika:mono'],
  rs: ['rika:suiyoueki'], rc: ['rika:chikara'],
  ss: ['shakai:sangyo'], sm: ['shakai:komin'],
};

const TITLES = [
  { name: '普通の小学生', pct: 0,  icon: '🎒' },
  { name: '優等生',       pct: 1,  icon: '📝' },
  { name: 'Hクラス',      pct: 3,  icon: '📗' },
  { name: 'Sクラス',      pct: 8,  icon: '📘' },
  { name: '最レ受講生',   pct: 11, icon: '📙' },
  { name: 'Vクラス',      pct: 15, icon: '📕' },
  { name: '100傑',        pct: 30, icon: '🥉' },
  { name: '灘合受講者',   pct: 50, icon: '🥈' },
  { name: '10傑',         pct: 75, icon: '🥇' },
  { name: 'スーパーウルトラ神ゴッド', pct: 95, icon: '👑' },
];

const ITEM_DEFS = {
  bomb: { icon: '💣', label: 'ボム',   desc: '盤面の下2行を消す' },
  slow: { icon: '🐢', label: 'スロー', desc: '15秒間ゆっくり落ちる' },
};

// ── 達成率の集計（一度でも正解した問題＝クリア） ──────────
function buildClearedSets() {
  const sets = {};
  for (const [s, cats] of Object.entries(QUESTION_COUNTS)) {
    for (const c of Object.keys(cats)) sets[`${s}:${c}`] = new Set();
  }
  const prog = getProgress();
  for (const [key, p] of Object.entries(prog)) {
    if (!p || !p.correct) continue;
    const ci = key.indexOf(':');
    if (ci > 0) {
      // 新形式 subject_cat:id
      const head = key.slice(0, ci);
      const ui = head.indexOf('_');
      if (ui < 0) continue;
      const bucket = `${head.slice(0, ui)}:${head.slice(ui + 1)}`;
      if (sets[bucket]) sets[bucket].add(key.slice(ci + 1));
    } else {
      // 旧素ID：プレフィックスで振り分け（Setなので新キーと重複しても二重計上されない）
      const m = key.match(/^[a-zA-Z]+/);
      if (!m) continue;
      const targets = ID_PREFIX_MAP[m[0]];
      if (targets) targets.forEach(b => { if (sets[b]) sets[b].add(key); });
    }
  }
  return sets;
}

function getAchievement() {
  const sets = buildClearedSets();
  const subjects = {};
  let titleCleared = 0, titleCount = 0;
  for (const [s, cats] of Object.entries(QUESTION_COUNTS)) {
    let sc = 0, st = 0;
    const catInfo = {};
    for (const [c, n] of Object.entries(cats)) {
      const cleared = Math.min(sets[`${s}:${c}`].size, n);
      catInfo[c] = { cleared, count: n, pct: n ? Math.floor((cleared / n) * 100) : 0 };
      sc += cleared; st += n;
    }
    subjects[s] = { cleared: sc, count: st, pct: st ? Math.floor((sc / st) * 100) : 0, cats: catInfo };
    if (TITLE_SUBJECTS.includes(s)) { titleCleared += sc; titleCount += st; }
  }
  const titlePct = titleCount ? (titleCleared / titleCount) * 100 : 0;
  return { titlePct, titleCleared, titleCount, subjects };
}

function getTitleInfo(titlePct) {
  let idx = 0;
  for (let i = TITLES.length - 1; i >= 0; i--) {
    if (titlePct >= TITLES[i].pct) { idx = i; break; }
  }
  const next = TITLES[idx + 1] || null;
  return { idx, name: TITLES[idx].name, icon: TITLES[idx].icon,
           next: next ? next.name : null, nextPct: next ? next.pct : null };
}

// ── 日付・プレイ時間 ──────────────────────────────────────
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPlayTimeData() {
  return JSON.parse(localStorage.getItem('playTime') || '{"total":0,"byDate":{}}');
}
function addPlayTime(sec) {
  sec = Math.min(Math.max(0, Math.round(sec)), 3600); // 放置ガード
  if (!sec) return;
  const pt = getPlayTimeData();
  pt.total += sec;
  const t = todayStr();
  pt.byDate[t] = (pt.byDate[t] || 0) + sec;
  const keys = Object.keys(pt.byDate).sort();
  while (keys.length > 30) delete pt.byDate[keys.shift()]; // 直近30日のみ保持
  localStorage.setItem('playTime', JSON.stringify(pt));
}
function getPlayTime() {
  const pt = getPlayTimeData();
  return { total: pt.total || 0, today: pt.byDate[todayStr()] || 0 };
}
function formatMinutes(sec) {
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60}分`;
}

// プレイ時間の計測（勉強画面に入ったら開始、出たら加算。テトリスは含めない）
const PLAY_SCREENS = ['flash', 'quiz', 'fill', 'kanji', 'sansu-quiz', 'drill'];
let playStart = null;
let currentScreenId = '';
function flushPlayTime() {
  if (playStart) { addPlayTime((Date.now() - playStart) / 1000); playStart = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushPlayTime();
  else if (PLAY_SCREENS.includes(currentScreenId) && !playStart) playStart = Date.now();
});
window.addEventListener('pagehide', flushPlayTime);

// ── アイテム ──────────────────────────────────────────────
function getItems() {
  return JSON.parse(localStorage.getItem('items') || '{"bomb":0,"slow":0}');
}
function addItem(kind, n) {
  const items = getItems();
  items[kind] = Math.max(0, Math.min(99, (items[kind] || 0) + n));
  localStorage.setItem('items', JSON.stringify(items));
  return items[kind];
}
function randomItemKind() {
  return Math.random() < 0.5 ? 'bomb' : 'slow';
}

// ── 汎用演出モーダル（連続表示はキューで順番に） ──────────
const gamiQueue = [];
function showGamiModal(data) {
  const modal = document.getElementById('gami-modal');
  if (!modal.classList.contains('hidden')) { gamiQueue.push(data); return; }
  document.getElementById('gami-emoji').textContent = data.emoji || '🎉';
  document.getElementById('gami-title').textContent = data.title || '';
  const body = document.getElementById('gami-lines');
  body.innerHTML = '';
  (data.lines || []).forEach(l => {
    const p = document.createElement('p');
    p.textContent = l;
    body.appendChild(p);
  });
  modal.classList.remove('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gami-close').onclick = () => {
    document.getElementById('gami-modal').classList.add('hidden');
    if (gamiQueue.length) setTimeout(() => showGamiModal(gamiQueue.shift()), 150);
  };
});

// ── ログインボーナス（initSubjectから毎回呼ばれても冪等） ──
function getLoginInfo() {
  return JSON.parse(localStorage.getItem('loginBonus') || 'null') || { lastDate: '', streak: 0, best: 0 };
}
function checkLoginBonus() {
  const today = todayStr();
  const lb = getLoginInfo();
  if (lb.lastDate === today) return;
  const yesterday = todayStr(new Date(Date.now() - 86400000));
  lb.streak = lb.lastDate === yesterday ? lb.streak + 1 : 1;
  lb.best = Math.max(lb.best || 0, lb.streak);
  lb.lastDate = today;
  localStorage.setItem('loginBonus', JSON.stringify(lb));

  // 個数：通常1、3日連続=2、7の倍数=3、30日=5
  let n = 1, note = '今日もようきたな！';
  if (lb.streak === 30) { n = 5; note = '30日連続！ほんまにえらいで！'; }
  else if (lb.streak >= 7 && lb.streak % 7 === 0) { n = 3; note = `${lb.streak}日連続はすごいで！`; }
  else if (lb.streak === 3) { n = 2; note = '3日連続ボーナスや！'; }
  const got = [];
  for (let i = 0; i < n; i++) {
    const kind = randomItemKind();
    addItem(kind, 1);
    got.push(ITEM_DEFS[kind].icon);
  }
  showGamiModal({
    emoji: '🔥',
    title: lb.streak >= 2 ? `${lb.streak}日連続ログイン！` : 'ログインボーナス！',
    lines: [note, `お助けアイテム ${got.join(' ')} をゲット！`, 'テトリスで使えるで！'],
  });
}

// ── 問題追加の検知（総問題数が増えたらトースト） ──────────
function checkNewQuestions() {
  const total = Object.values(QUESTION_COUNTS)
    .reduce((a, cats) => a + Object.values(cats).reduce((x, y) => x + y, 0), 0);
  const seen = Number(localStorage.getItem('qTotalSeen') || 0);
  if (seen && total > seen) {
    showToast(`🎉 新しい問題が${(total - seen).toLocaleString()}問追加されたで！`, 3500);
  }
  if (total !== seen) localStorage.setItem('qTotalSeen', String(total));
}

// ── 称号昇格チェック ──────────────────────────────────────
function checkTitlePromotion() {
  const a = getAchievement();
  const info = getTitleInfo(a.titlePct);
  const seen = Number(localStorage.getItem('titleRank') || 0);
  if (info.idx > seen) {
    localStorage.setItem('titleRank', String(info.idx));
    showGamiModal({
      emoji: info.icon,
      title: '称号アップ！',
      lines: [`きみは今日から『${info.name}』や！`, 'この調子で全問制覇を目指そう！'],
    });
  } else if (info.idx < seen) {
    localStorage.setItem('titleRank', String(info.idx));
  }
  return info;
}

// ── 100点報酬（5問以上のセッションのみ） ──────────────────
function maybeAwardPerfect(pct, totalQ) {
  const banner = document.getElementById('result-item-banner');
  if (banner) banner.classList.add('hidden');
  if (pct < 100 || totalQ < 5) return;
  const kind = randomItemKind();
  addItem(kind, 1);
  if (banner) {
    banner.textContent = `${ITEM_DEFS[kind].icon} 満点ボーナス！テトリスで使える「${ITEM_DEFS[kind].label}」をゲット！`;
    banner.classList.remove('hidden');
  }
}

// 達成率をFirestoreランキングへ（オフライン時はfirebase.js側でスキップ）
function pushAchievementToRanking() {
  if (!state.nickname || typeof saveAchievement !== 'function') return;
  const a = getAchievement();
  const t = getTitleInfo(a.titlePct);
  saveAchievement(state.nickname, Math.round(a.titlePct * 10) / 10, a.titleCleared, t.idx);
}

// ── テトリスお助けアイテム ────────────────────────────────
function updateItemButtons() {
  const items = getItems();
  document.querySelectorAll('.t-item-btn').forEach(btn => {
    const kind = btn.dataset.item;
    const n = items[kind] || 0;
    const b = btn.querySelector('b');
    if (b) b.textContent = n;
    btn.disabled = n <= 0;
  });
}

function tUseItem(kind) {
  if (tetris.over || tetris.paused) return;
  const items = getItems();
  if ((items[kind] || 0) <= 0) return;

  if (kind === 'bomb') {
    const bottom = tetris.board.slice(T_ROWS - 2);
    if (bottom.every(row => row.every(v => !v))) { showToast('下がカラやから今は使えへんで！'); return; }
    tetris.board.splice(T_ROWS - 2, 2);
    tetris.board.unshift(Array(T_COLS).fill(null), Array(T_COLS).fill(null));
    tSfx('clear1');
    tCharsCheer(1);
  } else if (kind === 'slow') {
    if (performance.now() < (tetris.slowUntil || 0)) { showToast('スローはもう効いてるで！'); return; }
    tetris.slowUntil = performance.now() + 15000;
    const btn = document.querySelector('.t-item-btn[data-item="slow"]');
    if (btn) {
      btn.classList.add('item-active');
      setTimeout(() => btn.classList.remove('item-active'), 15000);
    }
    tSfx('rotate');
  }
  addItem(kind, -1);
  updateItemButtons();
  drawTetris();
}

// ── ミックス出題（算数・理科・社会） ──────────────────────
SANSU_CAT_LABELS.mix = 'ミックス';
RIKA_CAT_LABELS.mix = 'ミックス';
SHAKAI_CAT_LABELS.mix = 'ミックス';

async function loadMixQuestions(grade, diff) {
  const fileMap = sansuState.subject === 'rika' ? RIKA_FILES
    : sansuState.subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES;
  const cats = Object.keys(fileMap);
  const lists = await Promise.all(cats.map(c => loadSansuQuestions(c, grade, diff).catch(() => [])));
  const all = [];
  lists.forEach((qs, i) => qs.forEach(q => all.push({ ...q, _cat: cats[i] })));
  return all;
}

// ── 終了バッジ（単元✅・学年👑） ──────────────────────────
function setClearBadge(btn, on, icon) {
  let b = btn.querySelector('.clear-badge');
  if (on) {
    if (!b) { b = document.createElement('span'); b.className = 'clear-badge'; btn.appendChild(b); }
    b.textContent = icon;
  } else if (b) {
    b.remove();
  }
}

function renderCatBadges(subject) {
  const sets = buildClearedSets();
  const counts = QUESTION_COUNTS[subject];
  const conf = {
    kokugo: ['#screen-home .cat-card', 'cat'],
    sansu:  ['#screen-sansu-home .sansu-cat-btn', 'scat'],
    rika:   ['.rika-cat-btn', 'rcat'],
    shakai: ['.shakai-cat-btn', 'hcat'],
  }[subject];
  document.querySelectorAll(conf[0]).forEach(btn => {
    const cat = btn.dataset[conf[1]];
    if (!cat || cat === 'mix' || !counts[cat]) { setClearBadge(btn, false); return; }
    const set = sets[`${subject}:${cat}`];
    setClearBadge(btn, !!set && set.size >= counts[cat], '✅');
  });
}

// 学年👑：その学年の全問題（教科内全カテゴリ）をコンプしたら表示
async function renderGradeCrowns(subject) {
  try {
    const sets = buildClearedSets();
    const byGrade = {};
    if (subject === 'kokugo') {
      // 国語は漢字2カテゴリの学年別のみ
      for (const cat of KANJI_CATS) {
        const qs = await loadQuestions(cat);
        const set = sets[`kokugo:${cat}`];
        qs.forEach(q => {
          if (!q.grade) return;
          if (!byGrade[q.grade]) byGrade[q.grade] = { total: 0, cleared: 0 };
          byGrade[q.grade].total++;
          if (set && set.has(q.id)) byGrade[q.grade].cleared++;
        });
      }
    } else {
      const fileMap = subject === 'rika' ? RIKA_FILES : subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES;
      for (const [cat, file] of Object.entries(fileMap)) {
        const key = `${subject}-${cat}`;
        if (!sansuCache[key]) {
          const res = await fetch(file);
          sansuCache[key] = await res.json();
        }
        const set = sets[`${subject}:${cat}`];
        sansuCache[key].forEach(q => {
          if (!q.grade) return;
          if (!byGrade[q.grade]) byGrade[q.grade] = { total: 0, cleared: 0 };
          byGrade[q.grade].total++;
          if (set && set.has(q.id)) byGrade[q.grade].cleared++;
        });
      }
    }
    const btnSel = {
      kokugo: '.kokugo-grade-btn',
      sansu:  '#screen-sansu-home .grade-btn',
      rika:   '.rika-grade-btn',
      shakai: '.shakai-grade-btn',
    }[subject];
    document.querySelectorAll(btnSel).forEach(btn => {
      const g = Number(btn.dataset.grade);
      const info = byGrade[g];
      setClearBadge(btn, !!(info && info.total > 0 && info.cleared >= info.total), '👑');
    });
  } catch (e) { /* バッジは飾りなので失敗しても無視 */ }
}

// ── がんばりの記録画面 ────────────────────────────────────
function gamiCatLabel(subject, cat) {
  if (subject === 'kokugo') return (CATEGORIES[cat] || {}).label || cat;
  const map = subject === 'rika' ? RIKA_CAT_LABELS : subject === 'shakai' ? SHAKAI_CAT_LABELS : SANSU_CAT_LABELS;
  return map[cat] || cat;
}

function initRecord() {
  const a = getAchievement();
  const info = checkTitlePromotion();

  // 称号ヒーロー
  document.getElementById('record-title-icon').textContent = info.icon;
  document.getElementById('record-title-name').textContent = info.name;
  document.getElementById('record-nickname').textContent = state.nickname ? `${state.nickname} さん` : '';

  // 達成率
  document.getElementById('record-total-pct').textContent = Math.floor(a.titlePct * 10) / 10;
  document.getElementById('record-total-bar').style.width = Math.min(100, a.titlePct) + '%';
  document.getElementById('record-cleared').textContent =
    `クリアした問題：${a.titleCleared.toLocaleString()} / ${a.titleCount.toLocaleString()}問（一度でも正解した問題）`;
  const nextEl = document.getElementById('record-next');
  if (info.next) {
    const remain = Math.max(1, Math.ceil((info.nextPct / 100) * a.titleCount) - a.titleCleared);
    nextEl.textContent = `次の称号『${info.next}』まで あと${remain.toLocaleString()}問！`;
  } else {
    nextEl.textContent = '最高称号を制覇！でんせつの小学生や！';
  }

  // 教科別（タップで単元内訳を開閉）
  const subjEl = document.getElementById('record-subjects');
  subjEl.innerHTML = '';
  for (const [s, data] of Object.entries(a.subjects)) {
    const wrap = document.createElement('div');
    wrap.className = 'record-subject';

    const head = document.createElement('div');
    head.className = 'record-subj-head';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${SUBJECT_LABELS[s]}${TITLE_SUBJECTS.includes(s) ? '' : '（称号判定外）'}`;
    const numSpan = document.createElement('span');
    numSpan.className = 'rs-num';
    numSpan.textContent = `${data.cleared.toLocaleString()}/${data.count.toLocaleString()}（${data.pct}%）▾`;
    head.appendChild(nameSpan); head.appendChild(numSpan);

    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = data.pct + '%';
    track.appendChild(fill);

    const catsDiv = document.createElement('div');
    catsDiv.className = 'record-cats hidden';
    for (const [c, ci] of Object.entries(data.cats)) {
      const row = document.createElement('div');
      row.className = 'record-cat-row';
      row.innerHTML = `<span class="rc-name"></span><div class="bar-track"><div class="bar-fill"></div></div><span class="rc-num"></span>`;
      row.querySelector('.rc-name').textContent = gamiCatLabel(s, c);
      row.querySelector('.bar-fill').style.width = ci.pct + '%';
      row.querySelector('.rc-num').textContent = `${ci.cleared}/${ci.count}${ci.cleared >= ci.count ? ' ✅' : ''}`;
      catsDiv.appendChild(row);
    }

    wrap.onclick = () => catsDiv.classList.toggle('hidden');
    wrap.appendChild(head); wrap.appendChild(track); wrap.appendChild(catsDiv);
    subjEl.appendChild(wrap);
  }

  // 勉強時間
  const pt = getPlayTime();
  document.getElementById('record-time-today').textContent = formatMinutes(pt.today);
  document.getElementById('record-time-total').textContent = formatMinutes(pt.total);

  // 連続ログイン
  const lb = getLoginInfo();
  document.getElementById('record-login').textContent =
    `🔥 ${lb.streak || 0}日連続べんきょう中！（最長 ${lb.best || 0}日）`;

  // アイテム
  const items = getItems();
  const itemsEl = document.getElementById('record-items');
  itemsEl.innerHTML = '';
  for (const [kind, def] of Object.entries(ITEM_DEFS)) {
    const div = document.createElement('div');
    div.className = 'record-item';
    div.innerHTML = `<span class="ri-icon"></span><span class="ri-count"></span><span class="ri-desc"></span>`;
    div.querySelector('.ri-icon').textContent = def.icon;
    div.querySelector('.ri-count').textContent = `${def.label} ×${items[kind] || 0}`;
    div.querySelector('.ri-desc').textContent = def.desc;
    itemsEl.appendChild(div);
  }

  // ランキング（Firestore・非同期）
  const rankEl = document.getElementById('record-ranking');
  rankEl.innerHTML = '<p class="record-rank-empty">読み込み中…</p>';
  pushAchievementToRanking();
  if (typeof getAchievementRanking === 'function') {
    getAchievementRanking().then(renderRecordRanking).catch(() => renderRecordRanking(null));
  } else {
    renderRecordRanking(null);
  }
}

function renderRecordRanking(list) {
  const el = document.getElementById('record-ranking');
  el.innerHTML = '';
  if (!list) {
    el.innerHTML = '<p class="record-rank-empty">オフラインでは見られへんで</p>';
    return;
  }
  if (list.length === 0) {
    el.innerHTML = '<p class="record-rank-empty">まだデータがないで。1回テストしてみよう！</p>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  list.forEach((e, i) => {
    const t = TITLES[e.titleIdx] || TITLES[0];
    const div = document.createElement('div');
    div.className = 'rank-item' + (e.nickname === state.nickname ? ' me' : '');
    const numClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    div.innerHTML = `<div class="rank-num ${numClass}"></div><div class="rank-name"></div><div class="rank-rate"></div>`;
    div.querySelector('.rank-num').textContent = medals[i] || (i + 1);
    div.querySelector('.rank-name').textContent = `${t.icon} ${e.nickname}${e.nickname === state.nickname ? ' ★' : ''}`;
    div.querySelector('.rank-rate').textContent = `${e.pct}%`;
    el.appendChild(div);
  });
}
