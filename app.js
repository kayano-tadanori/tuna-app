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
  tantei:         { label: 'こころの探偵',   file: 'data/kokugo_tantei.json' },
  youyaku:        { label: '要約記者',       file: 'data/kokugo_youyaku.json' },
};

// 漢字カテゴリ（学年選択あり・専用UI）
const KANJI_CATS = ['kanji_kaki', 'kanji_yomi'];

const MODES = {
  quiz: '四択クイズ'
};

const KOKUGO_DIFF_LABELS = { 1: 'やさしい', 2: '難しい', 3: 'チャレンジ', 4: '激ムズ', 5: '灘中レベル', all: 'ぜんぶ' };

// 国語：連鎖問題（灘中レベル＝難易度5）
const KOKUGO_CHAIN_FILE = 'data/kokugo_chain.json';
let kokugoChainCache = null;
async function loadKokugoChainQuestions(cat, grade) {
  // 連鎖問題は灘中レベル（小5・小6の内容）。小4以下では出題しない
  if (grade < chainMinGrade('kokugo')) return [];
  if (!kokugoChainCache) {
    const res = await fetch(KOKUGO_CHAIN_FILE);
    kokugoChainCache = await res.json();
  }
  const chains = shuffle(kokugoChainCache.filter(c => c.category === cat && chainInGrade(c, grade)));
  const out = [];
  chains.forEach(chain => {
    chain.steps.forEach((step, i) => {
      const intro = i === 0
        ? `<div class="tantei-passage">📘 <strong>${chain.title}</strong><br>${chain.intro}</div>`
        : '';
      out.push({
        id: `${chain.id}_s${i + 1}`,
        question: `${intro}<div class="tantei-q">(${i + 1}) ${step.question}</div>`,
        answer: step.answer,
        choices: step.choices,
        meaning: step.meaning,
        difficulty: 5,
        grade: chain.grade || grade,
      });
    });
  });
  return out;
}

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
  wrong: 0
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
  const isFirst = correct && prog[id].correct === 0;
  prog[id].total++;
  if (correct) prog[id].correct++;
  saveProgress(prog);
  if (correct) awardCoinForAnswer(id, isFirst);
}

function getRate(id) {
  const p = getProgress()[id];
  if (!p || p.total === 0) return null;
  return Math.round((p.correct / p.total) * 100);
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
  updateScratchDock();
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
  ['kokugo-step-topmode', 'kokugo-step-cat', 'kokugo-step-diff'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.querySelectorAll('.kokugo-grade-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.kokugo-topmode-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.cat-card').forEach(b => { b.classList.remove('selected'); b.classList.add('hidden'); });

  // ステップ表示ヘルパー
  const showStep = id => {
    const el = document.getElementById(id);
    const was = el.classList.contains('hidden');
    el.classList.remove('hidden');
    if (was) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  // STEP1: 学年選択
  document.querySelectorAll('.kokugo-grade-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.kokugo-grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.grade = Number(btn.dataset.grade);

      // 学年に応じてカテゴリの表示・非表示を切り替え
      document.querySelectorAll('.cat-card').forEach(cb => {
        const minGrade = Number(cb.dataset.minGrade || 1);
        cb.classList.toggle('hidden', state.grade < minGrade);
      });
      // 選べなくなったカテゴリはリセット
      if (state.selectedCat) {
        const selBtn = document.querySelector(`.cat-card[data-cat="${state.selectedCat}"]`);
        if (!selBtn || selBtn.classList.contains('hidden')) {
          state.selectedCat = null;
          state.selectedMode = null;
          document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
        }
      }
      state.selectedDiff = null;
      document.querySelectorAll('.kokugo-diff-btn').forEach(b => b.classList.remove('selected'));
      document.getElementById('kokugo-step-diff').classList.add('hidden');
      document.getElementById('kokugo-step-cat').classList.add('hidden');
      document.querySelectorAll('.kokugo-topmode-btn').forEach(b => b.classList.remove('selected'));
      showStep('kokugo-step-topmode');
      maybeShowStart();
    };
  });

  // STEP2: モード選択（通常問題 / こころの探偵）
  document.querySelectorAll('.kokugo-topmode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.kokugo-topmode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const topmode = btn.dataset.topmode;
      if (topmode === 'normal') {
        state.selectedCat = null;
        state.selectedMode = null;
        document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
        state.selectedDiff = null;
        document.querySelectorAll('.kokugo-diff-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('kokugo-step-diff').classList.add('hidden');
        showStep('kokugo-step-cat');
        maybeShowStart();
      } else if (topmode === 'tantei' || topmode === 'youyaku') {
        state.selectedCat = topmode;
        state.selectedMode = 'quiz';
        state.selectedDiff = null;
        document.querySelectorAll('.kokugo-diff-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('kokugo-step-cat').classList.add('hidden');
        showStep('kokugo-step-diff');
        maybeShowStart();
      }
    };
  });

  // STEP3: カテゴリ選択
  document.querySelectorAll('.cat-card').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedCat = btn.dataset.cat;
      state.weakOnly = false;
      // 漢字：モードは固定。言葉系：四択クイズで固定。どちらもそのまま難易度へ
      state.selectedMode = state.selectedCat === 'kanji_kaki' ? 'kaki'
        : state.selectedCat === 'kanji_yomi' ? 'yomi' : 'quiz';
      showStep('kokugo-step-diff');
      maybeShowStart();
    };
  });

  // STEP4: 難易度
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

  document.getElementById('btn-progress').onclick = () => showProgressScreen('kokugo');
  document.getElementById('btn-custom').onclick = showCustomScreen;
  document.getElementById('btn-ranking').onclick = showRankingScreen;

  // 終了バッジ（✅カテゴリ・👑漢字の学年）
  renderCatBadges('kokugo');
  renderGradeCrowns('kokugo');
}

function maybeShowStart() {
  renderDiffBadgesKokugo();
  const zone = document.getElementById('start-zone');

  const isKanji = KANJI_CATS.includes(state.selectedCat);
  const ready = state.selectedCat && state.grade && state.selectedDiff;
  if (!ready) { zone.classList.add('hidden'); return; }

  zone.classList.remove('hidden');
  const catLabel = CATEGORIES[state.selectedCat].label + `（小${state.grade}）`;
  const modeLabel = (isKanji ? (state.selectedCat === 'kanji_kaki' ? '手書き' : 'ひらがな入力') : MODES.quiz)
    + '・' + KOKUGO_DIFF_LABELS[state.selectedDiff];
  document.getElementById('start-cat-label').textContent = catLabel;
  document.getElementById('start-mode-label').textContent = modeLabel;
}

document.getElementById('btn-start').onclick = async () => {
  showLoading();
  try {
    const isChain = state.selectedDiff === 5;
    let pool;
    let all;
    if (isChain) {
      pool = await loadKokugoChainQuestions(state.selectedCat, state.grade);
      all = pool;
    } else {
      all = await loadQuestions(state.selectedCat);
      pool = state.weakOnly ? getWeakItems(state.selectedCat) : [...all];

      // 難易度フィルタ（「ぜんぶ」はフィルタなし）
      if (state.selectedDiff && state.selectedDiff !== 'all') {
        pool = pool.filter(q => q.difficulty === state.selectedDiff);
      }
      // 学年フィルタ（国語は全カテゴリで学年を選ぶ）
      if (state.grade) {
        pool = pool.filter(q => q.grade === state.grade);
      }
      pool = shuffle(pool);

      const countSel = document.getElementById('q-count').value;
      if (countSel !== 'all') pool = pool.slice(0, parseInt(countSel, 10));
    }
    state.sessionQs = pool;
    state.questions  = all;
    state.current = 0;
    state.correct = 0;
    state.wrong   = 0;
    coinSessionEarned = 0;

    if (!pool.length) { showToast('問題がありません'); hideLoading(); return; }

    if (state.selectedCat === 'kanji_kaki') startKanji();
    else if (state.selectedCat === 'kanji_yomi') startFill();
    else startQuiz();
  } catch (e) {
    showToast('問題の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
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
  document.getElementById('quiz-question').innerHTML = q.question;

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
  const ansLine = correct ? '' : `正解：${q.answer}<br>`;
  document.getElementById('feedback-ans').innerHTML = ansLine + (q.meaning || '');
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
  document.getElementById('fill-question').innerHTML = q.question;

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
  const ansLine = correct ? '' : `正解：${q.answer}<br>`;
  document.getElementById('fill-feedback-ans').innerHTML = ansLine + (q.meaning || '');
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
    document.getElementById('kanji-answer-meaning').innerHTML = q.meaning || '';
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
  awardSessionCoins(rate, total);
  awardSessionTicket(total);
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

// subject を指定すると、その教科だけの進捗を表示する（未指定なら全教科まとめて表示）
async function showProgressScreen(subject) {
  showScreen('progress');
  const label = subject ? SUBJECT_LABELS[subject] : null;
  document.getElementById('progress-user').textContent = state.nickname + ' さんの進捗' + (label ? `（${label}）` : '');

  const catsEl = document.getElementById('progress-cats');
  catsEl.innerHTML = '';

  const a = getAchievement();
  const entries = subject ? [[subject, a.subjects[subject]]] : Object.entries(a.subjects);
  for (const [s, data] of entries) {
    if (!data) continue;
    const subjWrap = document.createElement('div');
    subjWrap.className = 'progress-subject';
    subjWrap.innerHTML = `<h3 class="progress-subject-name">${SUBJECT_LABELS[s]}</h3>`;
    for (const [c, ci] of Object.entries(data.cats)) {
      if (!ci.count) continue;
      const done = ci.cleared >= ci.count;
      const div = document.createElement('div');
      div.className = 'progress-cat';
      div.innerHTML = `
        <div class="progress-cat-name">${gamiCatLabel(s, c)}${done ? ' ✅' : ''}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${ci.pct}%"></div></div>
        <div class="bar-label">${ci.cleared.toLocaleString()} / ${ci.count.toLocaleString()}問（${ci.pct}%）</div>
      `;
      subjWrap.appendChild(div);
    }
    catsEl.appendChild(subjWrap);
  }

  // 苦手リスト
  const weakEl = document.getElementById('weak-list');
  weakEl.innerHTML = '';
  if (subject && subject !== 'kokugo') {
    // 算数・理科・社会：ホームで選択中のカテゴリの苦手問題を表示
    if (!sansuState.cat || sansuState.cat === 'mix') {
      weakEl.textContent = 'ホームでカテゴリを選んでから見てください';
    } else {
      const weaks = await getWeakItemsForCat(subject, sansuState.cat);
      if (!weaks.length) {
        weakEl.textContent = '苦手問題はまだありません。問題を解いてみよう！';
      } else {
        const prog = getProgress();
        weaks.slice(0, 20).forEach(q => {
          const p = prog[q.id] || {};
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
      }
    }
  } else if (state.selectedCat) {
    // 国語：ホームで選択中のカテゴリの苦手問題を表示
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
    else if (target === 'sansu-home') { initSansuHome(); showScreen('sansu-home'); }
    else if (target === 'rika-home') { initRikaHome(); showScreen('rika-home'); }
    else if (target === 'shakai-home') { initShakaiHome(); showScreen('shakai-home'); }
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

// 科目カードの問題数を QUESTION_COUNTS から自動計算して表示（ハードコードしない）
function refreshSubjectCounts() {
  document.querySelectorAll('.subject-card[data-subject]').forEach(card => {
    const cats = QUESTION_COUNTS[card.dataset.subject];
    if (!cats) return;
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const el = card.querySelector('.subject-count');
    if (el) el.textContent = `${total.toLocaleString()}問`;
  });
}

function initSubject() {
  document.getElementById('subject-nickname').textContent = state.nickname;
  refreshSubjectCounts();

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
  document.getElementById('gacha-card-coins').textContent = getCoins();

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
        if (!spendGameTicket()) return;
        initTetris();
        showScreen('tetris');
      } else if (subj === 'mine') {
        if (!spendGameTicket()) return;
        initMine();
        showScreen('mine');
      } else if (subj === 'jump') {
        if (!spendGameTicket()) return;
        initJump();
        showScreen('jump');
      } else if (subj === 'gacha') {
        initGacha();
        showScreen('gacha');
      } else {
        initHome();
        showScreen('home');
      }
    };
  });

  document.getElementById('btn-subject-refresh').onclick = () => forceAppUpdate();
  document.getElementById('btn-subject-char').onclick = () => showScreen('character');
  document.getElementById('btn-subject-change').onclick = () => {
    localStorage.removeItem('nickname');
    state.nickname = '';
    document.getElementById('nickname-input').value = '';
    renderNicknameHistory();
    showScreen('nickname');
  };

  checkCloudRestore();
  backupLocalData();
  initUpdateBanner();
  updateGameTicketBadge();
}

// ============================================================
// アップデート情報（お知らせ）
// ============================================================
async function initUpdateBanner() {
  try {
    const res = await fetch('data/updates.json');
    const updates = await res.json(); // 新しい順の配列
    if (!updates.length) return;

    document.getElementById('update-banner-latest').textContent = updates[0].title;
    const lastSeen = localStorage.getItem('updateLastSeenDate') || '';
    document.getElementById('update-banner-badge').classList.toggle('hidden', !(updates[0].date > lastSeen));

    const listEl = document.getElementById('update-list');
    listEl.innerHTML = updates.map(u => `
      <div class="update-item">
        <div class="update-item-date">${u.date}</div>
        <div class="update-item-title">${u.title}</div>
        <div class="update-item-body">${u.body}</div>
      </div>
    `).join('');

    document.getElementById('btn-updates').onclick = () => {
      document.getElementById('update-modal').classList.remove('hidden');
      localStorage.setItem('updateLastSeenDate', updates[0].date);
      document.getElementById('update-banner-badge').classList.add('hidden');
    };
    document.getElementById('update-close').onclick = () => {
      document.getElementById('update-modal').classList.add('hidden');
    };
  } catch (e) {
    console.warn('アップデート情報の読み込みに失敗', e);
  }
}

// ============================================================
// 端末データのクラウドバックアップ・復元（コイン・ガチャ・アイテム等）
// ============================================================

// Firestoreに保存しない一時データ（達成率等）を除く、端末にしか無いデータ一式
const BACKUP_KEYS = [
  'coins', 'items', 'gacha', 'loginBonus', 'playTime', 'titleRank',
  'tetrisBest', 'jumpBest', 'mineBest_easy', 'mineBest_normal', 'mineBest_hard',
  'mapquizBest', 'timelineBest',
  'progress',
];

function backupLocalData() {
  if (!state.nickname || typeof saveLocalBackup !== 'function') return;
  const payload = {};
  BACKUP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) payload[k] = v;
  });
  saveLocalBackup(state.nickname, payload);
}

// 端末にローカルデータがほぼ無い（新しい端末・キャッシュ消去後）状態で、
// クラウドにバックアップがあれば復元をたずねる（一度断ったら同じニックネームでは聞き直さない）
async function checkCloudRestore() {
  if (!state.nickname || typeof getLocalBackup !== 'function') return;
  const hasLocalData = !!localStorage.getItem('progress') || !!localStorage.getItem('gacha');
  if (hasLocalData) return;
  if (localStorage.getItem('restoreDeclined_' + state.nickname)) return;
  const backup = await getLocalBackup(state.nickname);
  if (!backup) return;
  showRestoreConfirm(backup);
}

function showRestoreConfirm(backup) {
  document.getElementById('restore-modal').classList.remove('hidden');
  document.getElementById('restore-yes').onclick = () => {
    BACKUP_KEYS.forEach(k => { if (backup[k] !== undefined) localStorage.setItem(k, backup[k]); });
    document.getElementById('restore-modal').classList.add('hidden');
    showToast('復元したで！');
    location.reload();
  };
  document.getElementById('restore-no').onclick = () => {
    localStorage.setItem('restoreDeclined_' + state.nickname, '1');
    document.getElementById('restore-modal').classList.add('hidden');
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
  // 新しいservice workerが有効になったら自動でリロードして最新版を反映
  let swControllerChanged = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swControllerChanged) return;
    swControllerChanged = true;
    location.reload();
  });
}

// 科目選択画面の「🔄 最新版に更新」ボタン：新しいバージョンがないかチェックし、
// あればservice workerの更新→自動リロード（上のcontrollerchangeリスナー）で反映する
async function forceAppUpdate() {
  if (!('serviceWorker' in navigator)) { location.reload(); return; }
  showToast('最新版をチェック中…');
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { location.reload(); return; }
    await reg.update();
    setTimeout(() => showToast('最新の状態です！'), 1500);
  } catch (e) {
    location.reload();
  }
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
const DIFF_LABELS = { 1:'やさしい', 2:'難しい', 3:'チャレンジ', 4:'激ムズ', 5:'灘中レベル' };
const DRILL_TYPE_LABELS = {
  add:'足し算', sub:'引き算', mul:'かけ算', div:'割り算',
  divrem:'余りあり', decimal:'小数', fraction:'分数', mix:'ミックス'
};

// 理科ファイル・ラベル
const RIKA_FILES = {
  shokubutsu:'data/rika_shokubutsu.json', doubutsu:'data/rika_doubutsu.json',
  jintai:'data/rika_jintai.json',
  sora:'data/rika_sora.json', tenki:'data/rika_tenki.json', daichi:'data/rika_daichi.json',
  mono:'data/rika_mono.json', kitai:'data/rika_kitai.json', suiyoueki:'data/rika_suiyoueki.json',
  denki:'data/rika_denki.json', chikara:'data/rika_chikara.json',
  hikari_oto:'data/rika_hikarioto.json',
};
const RIKA_CAT_LABELS = {
  shokubutsu:'植物', doubutsu:'動物', jintai:'人体', sora:'天体', tenki:'天気', daichi:'大地の変化',
  mono:'もののせいしつ', kitai:'気体', suiyoueki:'水よう液', denki:'電気と磁石', chikara:'力のつり合い',
  hikari_oto:'光と音',
};

// 社会ファイル・ラベル
const SHAKAI_FILES = {
  kokudo:'data/shakai_kokudo.json', sangyo:'data/shakai_sangyo.json',
  rekishi:'data/shakai_rekishi.json', komin:'data/shakai_komin.json',
};
const SHAKAI_CAT_LABELS = {
  kokudo:'国土と自然', sangyo:'産業とくらし', rekishi:'日本の歴史', komin:'政治と国際',
};

// 連鎖問題（難易度5・灘中レベル）ファイル
const CHAIN_FILES = {
  sansu: 'data/sansu_chain.json',
  rika: 'data/rika_chain.json',
  shakai: 'data/shakai_chain.json',
};
// 連鎖問題を出題する最低学年（教科ごと）。算数は小3から、理科などは小5から
const CHAIN_MIN_GRADE = { sansu: 3, rika: 5, shakai: 5, kokugo: 5 };
function chainMinGrade(subject) { return CHAIN_MIN_GRADE[subject] ?? 5; }

// 連鎖問題を「その学年までの履修範囲」でしぼるための判定。
// chain.grade（その問題の対象学年）が選択学年以下なら出題対象
function chainInGrade(chain, grade) { return (chain.grade || grade) <= grade; }

// 答えが数値系（整数・小数・分数・帯分数・余り）ならテンキー入力にする。
// それ以外（語句）は4択のまま。
function isNumpadAnswer(a) {
  a = String(a).trim();
  return /^\d+(\.\d+)?$/.test(a)            // 整数・小数
      || /^\d+\/\d+$/.test(a)               // 分数
      || /^\d+と\d+\/\d+$/.test(a)          // 帯分数
      || /余り/.test(a);                     // 余りあり
}

// 連鎖問題1件（chain）を、フラットな問題オブジェクトの配列に展開する。
// 数値答えはchoicesを外してテンキー入力にする
function expandChain(chain, grade) {
  return chain.steps.map((step, i) => ({
    id: `${chain.id}_s${i + 1}`,
    question: `(${i + 1}) ${step.question}`,
    chainIntro: i === 0 ? `📘 ${chain.title}\n${chain.intro}` : '',
    // 図：設問ごとのsvg優先。無ければ最初の設問だけchainの共通図を表示
    svg: step.svg || (i === 0 ? chain.svg : '') || '',
    answer: step.answer,
    choices: isNumpadAnswer(step.answer) ? undefined : step.choices,
    meaning: step.meaning,
    difficulty: 5,
    grade: chain.grade || grade,
    _cat: chain.category,
  }));
}

// 指定した教科・カテゴリ・学年で出題できる連鎖問題（step）の数を返す。
// 難易度5ボタンの有効/無効判定に使う（0なら問題なし）
async function countChainSteps(subject, cat, grade) {
  if (grade < chainMinGrade(subject)) return 0;
  let data;
  try {
    if (subject === 'kokugo') {
      if (!kokugoChainCache) kokugoChainCache = await (await fetch(KOKUGO_CHAIN_FILE)).json();
      data = kokugoChainCache;
    } else {
      const key = `chain-${subject}`;
      if (!sansuCache[key]) sansuCache[key] = await (await fetch(CHAIN_FILES[subject])).json();
      data = sansuCache[key];
    }
  } catch { return 0; }
  return data
    .filter(c => (cat === 'mix' || c.category === cat) && chainInGrade(c, grade))
    .reduce((n, c) => n + c.steps.length, 0);
}

// 難易度5（連鎖問題）ボタンの有効/無効を切り替える。
// 問題が無ければロックし、その難易度が選択中なら選択を解除する
async function updateChainDiffButton(btns, subject, cat, grade, onLockSelected) {
  const chainBtn = [...btns].find(b => b.dataset.diff === '5');
  if (!chainBtn) return;
  const n = await countChainSteps(subject, cat, grade);
  const locked = n === 0;
  chainBtn.classList.toggle('diff-locked', locked);
  chainBtn.disabled = locked;
  if (locked && chainBtn.classList.contains('selected')) {
    chainBtn.classList.remove('selected');
    if (onLockSelected) onLockSelected();
  }
}

// チェーン（連鎖問題）を読み込み、カテゴリでしぼって、chain単位はシャッフルしつつ
// 各chain内のstep順は維持したまま平らな問題配列に展開する
async function loadChainQuestions(subject, cat, grade) {
  // 連鎖問題は灘中レベル。教科ごとの最低学年より下では出題しない
  if (grade < chainMinGrade(subject)) return [];
  const key = `chain-${subject}`;
  if (!sansuCache[key]) {
    const res = await fetch(CHAIN_FILES[subject]);
    sansuCache[key] = await res.json();
  }
  const chains = shuffle(sansuCache[key].filter(c => (cat === 'mix' || c.category === cat) && chainInGrade(c, grade)));
  // 灘中レベル（連鎖問題）は1連鎖＝3問で重いので、1セッションは3連鎖(9問)まで。
  // 3連鎖に満たなければ1連鎖(3問)で終了し、ちょうど3問か9問で区切る。
  const nChains = chains.length >= 3 ? 3 : 1;
  const out = [];
  chains.slice(0, nChains).forEach(chain => {
    expandChain(chain, grade).forEach(q => out.push(q));
  });
  return out;
}

const sansuCache = {};
const sansuState = {
  subject: 'sansu', // 'sansu' | 'rika'
  grade: null, diff: null, cat: null,
  mode: null, // 'normal' | 'drill'
  drillType: null, drillDiff: null, drillTime: null,
  questions: [], current: 0, correct: 0, wrong: 0,
  // ドリル
  drillCorrect: 0, drillWrong: 0, drillTimerId: null, drillTimeLeft: 0,
  // テンキー
  inputVal: '', inputRemain: '', inputWhole: '', inputPhase: 'main', // 'main'|'remain'
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
  sansuState.mode = null; sansuState.drillType = null; sansuState.drillDiff = null; sansuState.drillTime = null;

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
      // カテゴリごとの履修開始学年（SAPIX/浜学園カリキュラム基準）に達したら表示
      document.querySelectorAll('.juken-only').forEach(el => {
        const minGrade = Number(el.dataset.minGrade) || 4;
        el.classList.toggle('hidden', sansuState.grade < minGrade);
      });
      // 学年変更で選択中カテゴリが履修範囲外になったら解除
      const selectedCatBtn = document.querySelector(`.sansu-cat-btn[data-scat="${sansuState.cat}"]`);
      if (selectedCatBtn && selectedCatBtn.classList.contains('juken-only') && sansuState.grade < (Number(selectedCatBtn.dataset.minGrade) || 4)) {
        sansuState.cat = null;
        document.querySelectorAll('.sansu-cat-btn').forEach(b => b.classList.remove('selected'));
        hideSansuSteps('sansu-step-diff');
      }
      refreshDrillTypeAvailability();
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
      } else if (sansuState.mode === 'drill') {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff');
        refreshDrillTypeAvailability();
        showSansuStep('sansu-step-dtype');
        if (sansuState.drillType) showSansuStep('sansu-step-drilldiff');
        if (sansuState.drillType && sansuState.drillDiff) showSansuStep('sansu-step-time');
      } else if (sansuState.mode === 'tora') {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-drilldiff', 'sansu-step-time');
        initToraHome();
        showScreen('tora-home');
      } else {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-drilldiff', 'sansu-step-time');
        showToast('もうすぐ追加されます！工事中🚧');
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

  // STEP4: 難易度（算数ホーム内・通常問題）
  document.querySelectorAll('#sansu-step-diff .diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#sansu-step-diff .diff-btn').forEach(b => b.classList.remove('selected'));
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
      showSansuStep('sansu-step-drilldiff');
      updateSansuStart();
    };
  });

  // STEP4': 難易度（ドリル）
  document.querySelectorAll('#sansu-step-drilldiff .diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#sansu-step-drilldiff .diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.drillDiff = Number(btn.dataset.diff);
      showSansuStep('sansu-step-time');
      updateSansuStart();
    };
  });

  // STEP5': 時間
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

  // 苦手問題のみ／詳細な進捗
  document.getElementById('sansu-btn-weak').onclick = () => startSansuWeakSession();
  document.getElementById('sansu-btn-progress').onclick = () => openProgressScreenFrom('sansu-home', 'sansu');

  // 全ステップを初期状態（STEP1のみ表示）に
  hideSansuSteps('sansu-step-mode', 'sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-time');
  document.getElementById('sansu-start-zone').classList.add('hidden');

  // 終了バッジ（✅単元・👑学年）
  renderCatBadges('sansu');
  renderGradeCrowns('sansu');
}

function updateSansuStart() {
  renderDiffBadgesSansu();
  const zone = document.getElementById('sansu-start-zone');
  const info = document.getElementById('sansu-start-info');
  let ready = false;

  if (sansuState.mode === 'normal') {
    ready = sansuState.grade && sansuState.cat && sansuState.diff;
    if (ready) {
      info.textContent = `小${sansuState.grade} / ${SANSU_CAT_LABELS[sansuState.cat]} / ${DIFF_LABELS[sansuState.diff]}`;
    }
  } else if (sansuState.mode === 'drill') {
    ready = sansuState.grade && sansuState.drillType && sansuState.drillDiff && sansuState.drillTime !== null;
    if (ready) {
      const timeStr = sansuState.drillTime === 0 ? '無制限' : `${sansuState.drillTime}秒`;
      info.textContent = `小${sansuState.grade} / ${DRILL_TYPE_LABELS[sansuState.drillType]} / ${DIFF_LABELS[sansuState.drillDiff]} / ${timeStr}`;
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
      if (sansuState.grade < 4 && ['daichi', 'suiyoueki', 'denki', 'chikara', 'hikari_oto', 'kitai', 'jintai'].includes(sansuState.cat)) {
        sansuState.cat = null;
        document.querySelectorAll('.rika-cat-btn').forEach(b => b.classList.remove('selected'));
        hideSansuSteps('rika-step-diff');
      }
      hideSansuSteps('rika-step-cat');
      document.querySelectorAll('.rika-topmode-btn').forEach(b => b.classList.remove('selected'));
      showSansuStep('rika-step-topmode');
      updateRikaStart();
    };
  });

  // STEP2: モード
  document.querySelectorAll('.rika-topmode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.rika-topmode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (btn.dataset.topmode === 'normal') {
        showSansuStep('rika-step-cat');
      } else if (btn.dataset.topmode === 'science') {
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        initScienceHome();
        showScreen('science-home');
      } else if (btn.dataset.topmode === 'lab') {
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        initLabHome();
        showScreen('lab-home');
      } else {
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        showToast('もうすぐ追加されます！工事中🚧');
      }
    };
  });

  // STEP3: カテゴリ
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

  document.getElementById('rika-btn-weak').onclick = () => startSansuWeakSession();
  document.getElementById('rika-btn-progress').onclick = () => openProgressScreenFrom('rika-home', 'rika');

  hideSansuSteps('rika-step-topmode', 'rika-step-cat', 'rika-step-diff');
  document.querySelectorAll('.rika-topmode-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('rika-start-zone').classList.add('hidden');

  renderCatBadges('rika');
  renderGradeCrowns('rika');
}

function updateRikaStart() {
  renderDiffBadgesSansu();
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
    const isChain = sansuState.diff === 5;
    const all = isChain
      ? await loadChainQuestions(sansuState.subject, sansuState.cat, sansuState.grade)
      : sansuState.cat === 'mix'
        ? await loadMixQuestions(sansuState.grade, sansuState.diff)
        : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
    if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
    if (isChain) {
      sansuState.questions = all;
    } else {
      const countVal = document.getElementById('rika-q-count').value;
      const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
      sansuState.questions = shuffle([...all]).slice(0, count);
    }
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
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
      hideSansuSteps('shakai-step-cat');
      document.querySelectorAll('.shakai-topmode-btn').forEach(b => b.classList.remove('selected'));
      showSansuStep('shakai-step-topmode');
      updateShakaiStart();
    };
  });

  // STEP2: モード
  document.querySelectorAll('.shakai-topmode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.shakai-topmode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (btn.dataset.topmode === 'normal') {
        showSansuStep('shakai-step-cat');
      } else if (btn.dataset.topmode === 'history') {
        hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
        initNipponHome();
        showScreen('nippon-home');
      } else if (btn.dataset.topmode === 'go') {
        hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
        showScreen('shakaigo-home');
      } else {
        hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
        showToast('もうすぐ追加されます！工事中🚧');
      }
    };
  });

  // STEP3: カテゴリ
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

  document.getElementById('shakai-btn-weak').onclick = () => startSansuWeakSession();
  document.getElementById('shakai-btn-progress').onclick = () => openProgressScreenFrom('shakai-home', 'shakai');

  hideSansuSteps('shakai-step-topmode', 'shakai-step-cat', 'shakai-step-diff');
  document.querySelectorAll('.shakai-topmode-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('shakai-start-zone').classList.add('hidden');

  renderCatBadges('shakai');
  renderGradeCrowns('shakai');
}

function updateShakaiStart() {
  renderDiffBadgesSansu();
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
    const isChain = sansuState.diff === 5;
    const all = isChain
      ? await loadChainQuestions(sansuState.subject, sansuState.cat, sansuState.grade)
      : sansuState.cat === 'mix'
        ? await loadMixQuestions(sansuState.grade, sansuState.diff)
        : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
    if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
    if (isChain) {
      sansuState.questions = all;
    } else {
      const countVal = document.getElementById('shakai-q-count').value;
      const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
      sansuState.questions = shuffle([...all]).slice(0, count);
    }
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

async function startSansuSession() {
  if (sansuState.mode === 'normal') {
    showLoading();
    try {
      const isChain = sansuState.diff === 5;
      const all = isChain
        ? await loadChainQuestions(sansuState.subject, sansuState.cat, sansuState.grade)
        : sansuState.cat === 'mix'
          ? await loadMixQuestions(sansuState.grade, sansuState.diff)
          : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
      if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
      if (isChain) {
        sansuState.questions = all;
      } else {
        const countVal = document.getElementById('sansu-q-count').value;
        const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
        sansuState.questions = shuffle([...all]).slice(0, count);
      }
      sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
      coinSessionEarned = 0;
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

// カテゴリの全問題（学年・難易度を問わず）から苦手問題（正解率50%以下）を集める
// loadSansuQuestions と同じキャッシュキー（`${subject}-${cat}`）を使い、二重取得を避ける
async function getWeakItemsForCat(subject, cat) {
  const key = `${subject}-${cat}`;
  if (!sansuCache[key]) {
    const fileMap = subject === 'rika' ? RIKA_FILES : subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES;
    const res = await fetch(fileMap[cat]);
    sansuCache[key] = await res.json();
  }
  const prog = getProgress();
  return sansuCache[key].filter(q => {
    const p = prog[q.id];
    return p && p.total >= 1 && (p.correct / p.total) <= 0.5;
  });
}

// 算数・理科・社会共通：選択中カテゴリの苦手問題だけで即スタート
async function startSansuWeakSession() {
  if (!sansuState.cat || sansuState.cat === 'mix') { showToast('カテゴリを選んでください'); return; }
  showLoading();
  try {
    const weaks = await getWeakItemsForCat(sansuState.subject, sansuState.cat);
    if (!weaks.length) { showToast('まだ苦手問題がありません'); hideLoading(); return; }
    sansuState.questions = shuffle(weaks);
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

// 算数・理科・社会共通：進捗画面を開く（戻るボタンは呼び出し元の画面に戻す）
function openProgressScreenFrom(screenId, subject) {
  const backBtn = document.querySelector('#screen-progress .back-btn');
  if (backBtn) backBtn.dataset.back = screenId;
  showProgressScreen(subject);
}

function startSansuQuiz() {
  const catLabel = subjectCatLabels()[sansuState.cat] || '問題';
  document.getElementById('sansu-quiz-title').textContent = catLabel;
  const homeScreen = subjectHomeScreen();
  document.querySelectorAll('[data-back="sansu-home"]').forEach(b => b.onclick = () => { showScreen(homeScreen); });
  initNumpad('sq');
  setupQuizExtras('sq');
  // 正解／不正解カウンターの表示をリセット（前回セッションの数が残らないように）
  document.getElementById('sq-correct').textContent = sansuState.correct;
  document.getElementById('sq-wrong').textContent = sansuState.wrong;
  renderSansuQuiz();
  showScreen('sansu-quiz');
}

function renderSansuQuiz() {
  const total = sansuState.questions.length;
  if (sansuState.current >= total) { endSansuSession(); return; }
  resetQuizExtras('sq');

  const q = sansuState.questions[sansuState.current];
  document.getElementById('sansu-quiz-counter').textContent = `${sansuState.current + 1}/${total}`;
  document.getElementById('sq-question').textContent = q.question;
  document.getElementById('sq-meaning').textContent = '';
  const introEl = document.getElementById('sq-chain-intro');
  if (q.chainIntro) { introEl.textContent = q.chainIntro; introEl.classList.remove('hidden'); }
  else { introEl.textContent = ''; introEl.classList.add('hidden'); }
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

  // 理科の数値で答える問題は、4択ではなくテンキー入力にする
  const forceNumpad = sansuState.subject === 'rika' && isNumpadAnswer(q.answer);

  if (q.choices && q.choices.length && !forceNumpad) {
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
    numpad.querySelector('.numpad-frac').classList.toggle('hidden', !(q.answer && String(q.answer).includes('/')));
    numpad.querySelector('.numpad-mixed').classList.toggle('hidden', !(q.answer && String(q.answer).includes('と')));
    sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputWhole = ''; sansuState.inputPhase = 'main';
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
  } else if (sansuState.inputWhole) {
    userAnswer = `${sansuState.inputWhole.trim()}と${sansuState.inputVal.trim()}`;
  }
  if (!userAnswer || userAnswer === '余り' || userAnswer === 'と') { showToast('答えを入力してください'); return; }
  if (userAnswer.endsWith('/')) { showToast('分母を入力してください'); return; }

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
  awardSessionCoins(score, total);
  awardSessionTicket(total);

  document.getElementById('btn-result-home').onclick = () => {
    if (sansuState.subject === 'rika') { initRikaHome(); showScreen('rika-home'); }
    else if (sansuState.subject === 'shakai') { initShakaiHome(); showScreen('shakai-home'); }
    else { initSansuHome(); showScreen('sansu-home'); }
  };
  document.getElementById('btn-result-retry').onclick = () => {
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    sansuState.questions = shuffle([...sansuState.questions]);
    document.getElementById('sq-correct').textContent = '0';
    document.getElementById('sq-wrong').textContent = '0';
    startSansuQuiz();
  };

  showScreen('result');
  checkTitlePromotion();
  pushAchievementToRanking();
}

// ── 問題への書き込み・計算用紙（算数・理科クイズ／ドリル共通） ──────────
function createDrawPad(canvas, opts = {}) {
  const grid = !!opts.grid;
  const penColor = opts.penColor || '#1a1a1a';
  const lineWidth = opts.lineWidth || 5;
  const pad = { canvas, ctx: canvas.getContext('2d'), strokes: [], current: [], drawing: false, suppressed: false };

  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  canvas.onpointerdown = e => {
    if (pad.suppressed) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pad.drawing = true;
    pad.current = [pos(e)];
    draw();
  };
  canvas.onpointermove = e => { if (!pad.drawing) return; pad.current.push(pos(e)); draw(); };
  const up = () => {
    if (!pad.drawing) return;
    pad.drawing = false;
    if (pad.current.length > 1) pad.strokes.push(pad.current);
    pad.current = [];
    draw();
  };
  canvas.onpointerup = up;
  canvas.onpointercancel = up;
  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  function draw() {
    const { ctx } = pad;
    if (grid) {
      ctx.fillStyle = '#f8f6ef';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(120,120,120,0.18)';
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = step; x < canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = step; y < canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      // 紙の端をはっきりさせる縁取り（ピクセルとして直接描くのでCSSに左右されない）
      const bw = Math.max(4, Math.round(canvas.width / 100));
      ctx.strokeStyle = '#4f7cff';
      ctx.lineWidth = bw;
      ctx.strokeRect(bw / 2, bw / 2, canvas.width - bw, canvas.height - bw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const paint = pts => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    pad.strokes.forEach(paint);
    paint(pad.current);
  }
  pad.clear = () => { pad.strokes = []; pad.current = []; draw(); };
  pad.undo = () => { pad.strokes.pop(); draw(); };
  // 描いている途中のストロークを、履歴に残さず取り消す（2本指ジェスチャー開始時などに使用）
  pad.cancelCurrent = () => { pad.drawing = false; pad.current = []; draw(); };
  draw();
  return pad;
}

const drawPads = {}; // prefix('sq'|'drill') -> { write }

// セッション開始時に1回だけ呼ぶ（ボタン結線・キャンバス初期化）
function setupQuizExtras(prefix) {
  if (drawPads[prefix]) return;
  const writeCanvas = document.getElementById(`${prefix}-write-canvas`);
  const write = createDrawPad(writeCanvas, { penColor: '#ffe066', lineWidth: 4 });
  drawPads[prefix] = { write };

  const questionBox = document.getElementById(`${prefix}-question-box`);
  const btnWrite = document.getElementById(`${prefix}-btn-write`);
  const btnErase = document.getElementById(`${prefix}-btn-erase`);
  const btnScratch = document.getElementById(`${prefix}-btn-scratch`);
  const inputArea = document.getElementById(`${prefix}-input-area`);

  btnWrite.onclick = () => {
    const active = questionBox.classList.toggle('write-active');
    btnWrite.classList.toggle('active', active);
    btnWrite.textContent = active ? '✅ 書き込み終了' : '✏️ 書き込み';
    btnErase.classList.toggle('hidden', !active);
    inputArea.classList.toggle('hidden', active);
  };
  btnErase.onclick = () => write.clear();
  btnScratch.onclick = () => openScratchFullscreen();
}

// 問題が切り替わるたびに呼ぶ（書き込み・計算用紙をリセットし、問題画面に戻す）
function resetQuizExtras(prefix) {
  const pads = drawPads[prefix];
  if (!pads) return;
  pads.write.clear();
  document.getElementById(`${prefix}-question-box`).classList.remove('write-active');
  const btnWrite = document.getElementById(`${prefix}-btn-write`);
  btnWrite.classList.remove('active');
  btnWrite.textContent = '✏️ 書き込み';
  document.getElementById(`${prefix}-btn-erase`).classList.add('hidden');
  document.getElementById(`${prefix}-input-area`).classList.remove('hidden');
  if (!scratchDocked) closeScratchFullscreen(); // ドッキング表示中は開いたままにする
  if (scratchPad) scratchPad.clear();
}

// ── 計算用紙（全画面・画面の4倍の広さ・2本指でパン＆ピンチズーム） ──────────
let scratchPad = null;
let scratchView = null; // { virtualW, virtualH, vw, vh, panX, panY, zoom }
let scratchDocked = false; // 横向きタブレットなどで常時ドッキング表示中か

const scratchDockQuery = window.matchMedia('(min-width: 700px) and (orientation: landscape)');

// 算数・理科クイズ／計算ドリル画面で横向きの広い画面なら、計算用紙を常時ドッキング表示する
function updateScratchDock() {
  const overlay = document.getElementById('scratch-fullscreen');
  const isQuizScreen = currentScreenId === 'sansu-quiz' || currentScreenId === 'drill';
  const shouldDock = isQuizScreen && scratchDockQuery.matches;
  if (shouldDock && !scratchDocked) {
    scratchDocked = true;
    overlay.classList.add('docked');
    openScratchFullscreen();
  } else if (!shouldDock && scratchDocked) {
    scratchDocked = false;
    overlay.classList.remove('docked');
    closeScratchFullscreen();
  }
}
scratchDockQuery.addEventListener('change', updateScratchDock);
window.addEventListener('resize', updateScratchDock);

const SCRATCH_MIN_ZOOM = 0.25;
const SCRATCH_MAX_ZOOM = 3;

function scratchApplyTransform(canvas) {
  const v = scratchView;
  canvas.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
}

function scratchClampView() {
  const v = scratchView;
  v.zoom = Math.min(SCRATCH_MAX_ZOOM, Math.max(SCRATCH_MIN_ZOOM, v.zoom));
  const dispW = v.virtualW * v.zoom, dispH = v.virtualH * v.zoom;
  // 表示中の紙が画面から大きくはみ出しすぎない程度に余裕を持たせてクランプ
  const marginX = Math.max(dispW, v.vw) * 0.5;
  const marginY = Math.max(dispH, v.vh) * 0.5;
  v.panX = Math.min(marginX, Math.max(v.vw - dispW - marginX, v.panX));
  v.panY = Math.min(marginY, Math.max(v.vh - dispH - marginY, v.panY));
}

function openScratchFullscreen() {
  const overlay = document.getElementById('scratch-fullscreen');
  const viewport = document.getElementById('scratch-fs-viewport');
  const canvas = document.getElementById('scratch-fs-canvas');

  if (!scratchPad) {
    const dpr = window.devicePixelRatio || 1;
    const vw = viewport.clientWidth || window.innerWidth;
    const vh = viewport.clientHeight || window.innerHeight;
    // 画面の縦横それぞれ2倍＝面積で4倍の仮想キャンバス
    const virtualW = vw * 2;
    const virtualH = vh * 2;
    canvas.style.width = virtualW + 'px';
    canvas.style.height = virtualH + 'px';
    // 古いiPad等では巨大なcanvas（縦横×dprで1000万px超）が確保できず、
    // キャンバスが真っ白のまま描画されないことがあるため、実際のピクセル数に上限を設ける
    const MAX_CANVAS_PIXELS = 4000000;
    const rawPixels = virtualW * dpr * virtualH * dpr;
    const effDpr = rawPixels > MAX_CANVAS_PIXELS ? dpr * Math.sqrt(MAX_CANVAS_PIXELS / rawPixels) : dpr;
    canvas.width = Math.round(virtualW * effDpr);
    canvas.height = Math.round(virtualH * effDpr);
    scratchPad = createDrawPad(canvas, { grid: true, penColor: '#1a1a1a', lineWidth: 4 * effDpr });

    // 初期表示：仮想キャンバスの中央が画面中央に来るように配置（zoom=1）
    scratchView = { virtualW, virtualH, vw, vh, panX: -(virtualW - vw) / 2, panY: -(virtualH - vh) / 2, zoom: 1 };
    scratchApplyTransform(canvas);

    document.getElementById('fs-scratch-undo').onclick = () => scratchPad.undo();
    document.getElementById('fs-scratch-clear').onclick = () => scratchPad.clear();
    document.getElementById('fs-scratch-close').onclick = () => closeScratchFullscreen();
    document.getElementById('fs-scratch-reset').onclick = () => {
      // そのときの実際の画面サイズに合わせて、紙全体が収まる縮小率にする
      const curVw = viewport.clientWidth || scratchView.vw;
      const curVh = viewport.clientHeight || scratchView.vh;
      const fitZoom = Math.min(curVw / scratchView.virtualW, curVh / scratchView.virtualH, 1);
      scratchView.zoom = Math.max(SCRATCH_MIN_ZOOM, fitZoom);
      scratchView.panX = (curVw - scratchView.virtualW * scratchView.zoom) / 2;
      scratchView.panY = (curVh - scratchView.virtualH * scratchView.zoom) / 2;
      scratchApplyTransform(canvas);
    };

    // ── 2本指ジェスチャー（パン＋ピンチズーム） ──
    const pointers = new Map(); // pointerId -> {x, y}（viewport基準の座標）
    let gestureActive = false;
    let prevMid = null, prevDist = null;

    const viewportPos = e => {
      const r = viewport.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const midOf = pts => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
    const distOf = pts => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

    viewport.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, viewportPos(e));
      if (pointers.size === 2) {
        gestureActive = true;
        scratchPad.suppressed = true; // キャンバス側の描画処理を止める
        scratchPad.cancelCurrent(); // 描きかけの線があれば取り消す
        const pts = [...pointers.values()];
        prevMid = midOf(pts);
        prevDist = distOf(pts);
      }
    }, { capture: true });

    viewport.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, viewportPos(e));
      if (!gestureActive || pointers.size !== 2) return;
      e.preventDefault();
      const pts = [...pointers.values()];
      const mid = midOf(pts);
      const dist = distOf(pts);
      const v = scratchView;
      const newZoom = Math.min(SCRATCH_MAX_ZOOM, Math.max(SCRATCH_MIN_ZOOM, v.zoom * (dist / prevDist)));
      // ピンチの中心点がそのまま同じ場所に留まるようパンを補正しつつ、指の移動分も加算
      v.panX = mid.x - (newZoom / v.zoom) * (prevMid.x - v.panX);
      v.panY = mid.y - (newZoom / v.zoom) * (prevMid.y - v.panY);
      v.zoom = newZoom;
      scratchApplyTransform(canvas);
      prevMid = mid;
      prevDist = dist;
    }, { capture: true });

    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && gestureActive) {
        gestureActive = false;
        prevMid = null; prevDist = null;
        scratchClampView();
        scratchApplyTransform(canvas);
        scratchPad.suppressed = false; // 描画を再開できるようにする
      }
    };
    viewport.addEventListener('pointerup', endPointer, { capture: true });
    viewport.addEventListener('pointercancel', endPointer, { capture: true });
  }

  overlay.classList.remove('hidden');
}

function closeScratchFullscreen() {
  document.getElementById('scratch-fullscreen').classList.add('hidden');
}

// ── 汎用：指1本でパン・2本指でピンチズーム（地図・図の拡大表示で共用） ──────
function createPinchZoomController(viewport, content, opts = {}) {
  const state = { zoom: opts.initialZoom || 1, panX: 0, panY: 0, minZoom: opts.minZoom || 1, maxZoom: opts.maxZoom || 5 };
  const apply = () => { content.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`; };
  const reset = () => { state.zoom = opts.initialZoom || 1; state.panX = 0; state.panY = 0; apply(); };

  const pointers = new Map();
  let mode = null; // 'pan' | 'pinch'
  let lastPt = null, prevMid = null, prevDist = null;

  const pos = e => { const r = viewport.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const midOf = pts => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
  const distOf = pts => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

  viewport.addEventListener('pointerdown', e => {
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, pos(e));
    if (pointers.size === 1) {
      mode = 'pan'; lastPt = pos(e);
    } else if (pointers.size === 2) {
      mode = 'pinch';
      const pts = [...pointers.values()];
      prevMid = midOf(pts); prevDist = distOf(pts);
    }
  });
  viewport.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, pos(e));
    if (mode === 'pan' && pointers.size === 1) {
      e.preventDefault();
      const p = pos(e);
      state.panX += p.x - lastPt.x;
      state.panY += p.y - lastPt.y;
      lastPt = p;
      apply();
    } else if (mode === 'pinch' && pointers.size === 2) {
      e.preventDefault();
      const pts = [...pointers.values()];
      const mid = midOf(pts), dist = distOf(pts);
      const newZoom = Math.min(state.maxZoom, Math.max(state.minZoom, state.zoom * (dist / prevDist)));
      state.panX = mid.x - (newZoom / state.zoom) * (prevMid.x - state.panX);
      state.panY = mid.y - (newZoom / state.zoom) * (prevMid.y - state.panY);
      state.zoom = newZoom;
      apply();
      prevMid = mid; prevDist = dist;
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size === 1) { mode = 'pan'; lastPt = [...pointers.values()][0]; }
    else if (pointers.size === 0) { mode = null; }
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  apply();
  return { apply, reset, state };
}

// ── 図の拡大表示（虎の巻・はかせの図鑑・ニッポンのあゆみのカード内の図を共通でタップ拡大） ──
let diagramViewerController = null;
function openDiagramViewer(svgEl) {
  const overlay = document.getElementById('diagram-viewer');
  const content = document.getElementById('diagram-viewer-content');
  content.innerHTML = svgEl.outerHTML;
  const innerSvg = content.querySelector('svg');
  if (innerSvg) { innerSvg.style.width = '100%'; innerSvg.style.height = 'auto'; innerSvg.style.maxHeight = 'none'; innerSvg.style.cursor = 'default'; }
  if (!diagramViewerController) {
    diagramViewerController = createPinchZoomController(
      document.getElementById('diagram-viewer-viewport'),
      content,
      { minZoom: 1, maxZoom: 6 }
    );
    document.getElementById('diagram-viewer-close').onclick = () => overlay.classList.add('hidden');
    document.getElementById('diagram-viewer-reset').onclick = () => diagramViewerController.reset();
  }
  diagramViewerController.reset();
  overlay.classList.remove('hidden');
}
document.addEventListener('click', e => {
  const svg = e.target.closest('.tora-card-body svg');
  if (svg) openDiagramViewer(svg);
});

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
  if (key === 'frac') {
    // 分数の「／」：分子入力後に1回だけ・小数とは併用不可
    if (!sansuState.inputVal || sansuState.inputVal.includes('/') || sansuState.inputVal.includes('.')) return;
    sansuState.inputVal += '/';
    updateNumpadPreview(prefix);
    return;
  }
  if (key === 'mixedSep') {
    // 帯分数の「と」：整数部を確定して分数部の入力に切り替える（1回だけ）
    if (!sansuState.inputVal || sansuState.inputWhole || sansuState.inputVal.includes('/') || sansuState.inputVal.includes('.')) return;
    sansuState.inputWhole = sansuState.inputVal;
    sansuState.inputVal = '';
    updateNumpadPreview(prefix);
    return;
  }
  if (key === 'del') {
    if (sansuState.inputPhase === 'remain') {
      sansuState.inputRemain = sansuState.inputRemain.slice(0, -1);
    } else if (!sansuState.inputVal && sansuState.inputWhole) {
      // 分数部が空の状態で削除→整数部の確定を取り消して編集に戻す
      sansuState.inputVal = sansuState.inputWhole;
      sansuState.inputWhole = '';
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
    if (key === '.' && (sansuState.inputVal.includes('.') || sansuState.inputVal.includes('/'))) return;
    sansuState.inputVal += key;
  }
  updateNumpadPreview(prefix);
}

function updateNumpadPreview(prefix) {
  const mainEl = document.getElementById(`${prefix}-preview`);
  const remainEl = document.getElementById(`${prefix}-remain-preview`);
  mainEl.textContent = sansuState.inputWhole
    ? `${sansuState.inputWhole}と${sansuState.inputVal || '＿'}`
    : (sansuState.inputVal || '＿');
  if (remainEl) remainEl.textContent = sansuState.inputRemain || '＿';
}

// ── 計算ドリル ──────────────────────────────────────────
// 学年(1〜6)×難易度(1〜4)で範囲を変える。添字は [grade-1][diff-1]
const DRILL_ADDSUB_RANGE = [
  [[1,5],[3,9],[5,15],[10,20]],
  [[10,20],[15,40],[30,70],[50,99]],
  [[50,150],[100,300],[200,600],[400,999]],
  [[300,700],[500,1500],[1000,3000],[2000,4999]],
  [[2000,5000],[4000,9999],[8000,15000],[12000,29999]],
  [[10000,30000],[20000,50000],[40000,80000],[60000,99999]],
];
// [ [a範囲, b範囲], ... ]
const DRILL_MUL_RANGE = [
  [[[2,4],[2,4]], [[2,6],[2,6]], [[3,9],[3,9]], [[5,9],[5,9]]],
  [[[2,9],[2,9]], [[5,9],[5,9]], [[10,20],[2,9]], [[10,30],[2,9]]],
  [[[10,30],[2,9]], [[10,50],[2,9]], [[10,99],[2,15]], [[10,99],[10,30]]],
  [[[10,50],[10,30]], [[10,99],[10,50]], [[10,99],[10,99]], [[100,300],[10,50]]],
  [[[10,99],[10,99]], [[100,300],[10,50]], [[100,500],[10,99]], [[100,999],[10,99]]],
  [[[100,500],[10,99]], [[100,999],[10,99]], [[100,999],[100,300]], [[100,999],[100,999]]],
];
// [ [除数範囲, 商範囲], ... ]（あまりありも共用、あまりは 1〜除数-1 で別途生成）
const DRILL_DIV_RANGE = [
  [[[2,5],[2,5]], [[2,9],[2,5]], [[2,9],[2,9]], [[2,9],[5,12]]],
  [[[2,9],[2,9]], [[2,9],[5,12]], [[2,12],[5,15]], [[2,20],[5,20]]],
  [[[2,12],[5,20]], [[2,20],[5,30]], [[2,30],[10,40]], [[2,50],[10,50]]],
  [[[2,30],[10,50]], [[2,50],[10,99]], [[10,50],[10,99]], [[10,99],[10,99]]],
  [[[10,50],[10,99]], [[10,99],[10,99]], [[10,99],[50,200]], [[10,99],[100,500]]],
  [[[10,99],[50,200]], [[10,99],[100,500]], [[100,300],[10,99]], [[100,999],[10,99]]],
];
// 小数は小4以上のみ。{int:整数部の最大桁数, dec:小数点以下の桁数}
const DRILL_DECIMAL_RANGE = [
  [{int:1,dec:1}, {int:2,dec:1}, {int:2,dec:2}, {int:2,dec:2}],
  [{int:2,dec:2}, {int:3,dec:1}, {int:3,dec:2}, {int:3,dec:2}],
  [{int:3,dec:2}, {int:3,dec:2}, {int:4,dec:2}, {int:5,dec:2}],
];
// 分数は小5以上のみ。denは分母の範囲、allowImproperは答えが1を超える（帯分数）のを許すか
const DRILL_FRAC_RANGE = [
  [{den:[3,6],allowImproper:false}, {den:[3,9],allowImproper:false}, {den:[4,12],allowImproper:true}, {den:[4,12],allowImproper:true}],
  [{den:[4,9],allowImproper:false}, {den:[4,12],allowImproper:true}, {den:[6,15],allowImproper:true}, {den:[6,15],allowImproper:true}],
];

// 問題自動生成
function generateDrillProblem() {
  const g = sansuState.grade;
  const d = sansuState.drillDiff || 1;
  let type = sansuState.drillType;
  if (type === 'mix') {
    const types = getAvailableDrillTypes(g);
    type = types[Math.floor(Math.random() * types.length)];
  }

  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const gcdFn = (a, b) => b === 0 ? a : gcdFn(b, a % b);

  if (type === 'add') {
    const [lo, hi] = DRILL_ADDSUB_RANGE[g - 1][d - 1];
    const a = rnd(lo, hi), b = rnd(lo, hi);
    return { question: `${a} ＋ ${b} ＝`, answer: String(a + b) };
  }
  if (type === 'sub') {
    const [lo, hi] = DRILL_ADDSUB_RANGE[g - 1][d - 1];
    const b = rnd(lo, hi), a = b + rnd(1, hi - lo + 1);
    return { question: `${a} － ${b} ＝`, answer: String(a - b) };
  }
  if (type === 'mul') {
    const [[aLo, aHi], [bLo, bHi]] = DRILL_MUL_RANGE[g - 1][d - 1];
    const a = rnd(aLo, aHi), b = rnd(bLo, bHi);
    return { question: `${a} × ${b} ＝`, answer: String(a * b) };
  }
  if (type === 'div') {
    const [[dLo, dHi], [qLo, qHi]] = DRILL_DIV_RANGE[g - 1][d - 1];
    const dv = rnd(dLo, dHi), q = rnd(qLo, qHi), n = dv * q;
    return { question: `${n} ÷ ${dv} ＝`, answer: String(q) };
  }
  if (type === 'divrem') {
    const [[dLo, dHi], [qLo, qHi]] = DRILL_DIV_RANGE[g - 1][d - 1];
    const dv = rnd(Math.max(dLo, 2), dHi), q = rnd(qLo, qHi), r = rnd(1, dv - 1), n = dv * q + r;
    return { question: `${n} ÷ ${dv} ＝ □ あまり □`, answer: `${q}余り${r}`, isRemain: true };
  }
  if (type === 'decimal') {
    const gi = Math.min(Math.max(g, 4), 6) - 4;
    const { int, dec } = DRILL_DECIMAL_RANGE[gi][d - 1];
    const decDenom = Math.pow(10, dec);
    const randDec = () => {
      const v = rnd(1, Math.pow(10, int) * decDenom - 1);
      return v / decDenom;
    };
    const a = randDec(), b = randDec();
    const ans = Number((a + b).toFixed(dec)).toString();
    return { question: `${a.toFixed(dec)} ＋ ${b.toFixed(dec)} ＝`, answer: ans };
  }
  if (type === 'fraction') {
    // 分数はテンキーの「╱分数」「と」キーで入力（約分した形で判定）
    const gi = Math.min(Math.max(g, 5), 6) - 5;
    const cell = DRILL_FRAC_RANGE[gi][d - 1];
    const den = rnd(cell.den[0], cell.den[1]);
    let n1, n2, num, op;
    if (Math.random() < 0.5) {
      op = '＋';
      n1 = rnd(1, den - 1);
      n2 = cell.allowImproper ? rnd(1, den - 1) : rnd(1, den - n1);
      num = n1 + n2;
    } else {
      op = '−';
      n1 = rnd(1, den - 1); n2 = rnd(1, n1);
      num = n1 - n2;
    }
    const gc = gcdFn(num, den) || 1;
    const redNum = num / gc, redDen = den / gc;
    if (redDen === 1) {
      return { question: `${n1}/${den} ${op} ${n2}/${den} ＝\n（約分できるときは約分してね）`, answer: String(redNum), isFrac: true };
    }
    if (redNum > redDen) {
      const whole = Math.floor(redNum / redDen), rem = redNum - whole * redDen;
      return { question: `${n1}/${den} ${op} ${n2}/${den} ＝\n（約分できるときは約分してね）`, answer: `${whole}と${rem}/${redDen}`, isMixed: true, isFrac: true };
    }
    return { question: `${n1}/${den} ${op} ${n2}/${den} ＝\n（約分できるときは約分してね）`, answer: `${redNum}/${redDen}`, isFrac: true };
  }
  // fallback add
  const a = rnd(1, 9), b = rnd(1, 9);
  return { question: `${a} ＋ ${b} ＝`, answer: String(a + b) };
}

function getAvailableDrillTypes(grade) {
  const base = ['add','sub'];
  if (grade >= 2) base.push('mul');
  if (grade >= 3) base.push('div','divrem');
  if (grade >= 4) base.push('decimal');
  if (grade >= 5) base.push('fraction');
  return base;
}

// 学年に合わない計算の種類（例：小1の小数）をボタンごと隠す
function refreshDrillTypeAvailability() {
  if (!sansuState.grade) return;
  const available = getAvailableDrillTypes(sansuState.grade);
  document.querySelectorAll('.drill-type-btn').forEach(btn => {
    const dtype = btn.dataset.dtype;
    const ok = dtype === 'mix' || available.includes(dtype);
    btn.classList.toggle('hidden', !ok);
  });
  // 選択中の種類が学年変更で選べなくなったら解除してやり直し
  if (sansuState.drillType && sansuState.drillType !== 'mix' && !available.includes(sansuState.drillType)) {
    sansuState.drillType = null;
    sansuState.drillDiff = null;
    document.querySelectorAll('.drill-type-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('#sansu-step-drilldiff .diff-btn').forEach(b => b.classList.remove('selected'));
    hideSansuSteps('sansu-step-drilldiff', 'sansu-step-time');
  }
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
  setupQuizExtras('drill');
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
  resetQuizExtras('drill');
  _currentDrillQ = generateDrillProblem();
  document.getElementById('drill-question').textContent = _currentDrillQ.question;

  sansuState.isRemainMode = !!_currentDrillQ.isRemain;
  document.getElementById('drill-remain-wrap').classList.toggle('hidden', !sansuState.isRemainMode);
  document.querySelector('#drill-numpad .numpad-rem').classList.toggle('hidden', !sansuState.isRemainMode);
  document.querySelector('#drill-numpad .numpad-frac').classList.toggle('hidden', !_currentDrillQ.isFrac);
  document.querySelector('#drill-numpad .numpad-mixed').classList.toggle('hidden', !_currentDrillQ.isMixed);

  sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputWhole = ''; sansuState.inputPhase = 'main';
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
  else if (sansuState.inputWhole) userAnswer = `${sansuState.inputWhole.trim()}と${sansuState.inputVal.trim()}`;
  if (!userAnswer || userAnswer === '余り' || userAnswer === 'と') { showToast('答えを入力してください'); return; }
  if (userAnswer.endsWith('/')) { showToast('分母を入力してください'); return; }

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
  awardSessionTicket(total);

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
// 虎の巻（中学受験算数の知識まとめ）
// ============================================================

const TORA_CATEGORIES = {
  kioku:   { label: '暗記の宝庫', icon: '💎' },
  keisan:  { label: '計算',       icon: '🧮' },
  bun:     { label: '文章題',     icon: '📝' },
  zu:      { label: '平面図形',   icon: '📐' },
  kisoku:  { label: '規則性',     icon: '🔁' },
  tokusan: { label: '特殊算',     icon: '🎯' },
  baai:    { label: '場合の数',   icon: '🎲' },
  kazu:    { label: '数の性質',   icon: '🔢' },
  wariai:  { label: '割合と比',   icon: '⚖️' },
  hayasa:  { label: '速さ',       icon: '🏃' },
  rittai:  { label: '立体図形',   icon: '📦' },
};

let toraData = null;
async function loadToraData() {
  if (toraData) return toraData;
  const res = await fetch('data/sansu_toranomaki.json');
  toraData = await res.json();
  return toraData;
}

async function initToraHome() {
  showLoading();
  try {
    const data = await loadToraData();
    const counts = {};
    data.forEach(card => { counts[card.category] = (counts[card.category] || 0) + 1; });

    const grid = document.getElementById('tora-cat-grid');
    grid.innerHTML = '';
    Object.entries(TORA_CATEGORIES).forEach(([cat, info]) => {
      const n = counts[cat] || 0;
      const btn = document.createElement('button');
      btn.className = 'cat-card';
      btn.dataset.toraCat = cat;
      btn.innerHTML = `
        <span class="cat-icon">${info.icon}</span>
        <span class="cat-name">${info.label}</span>
        <span class="cat-count">${n}件</span>
      `;
      btn.onclick = () => showToraCategory(cat);
      grid.appendChild(btn);
    });
  } catch (e) {
    showToast('虎の巻の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function showToraCategory(cat) {
  showLoading();
  try {
    const data = await loadToraData();
    const cards = data.filter(c => c.category === cat);
    const info = TORA_CATEGORIES[cat] || { label: cat, icon: '📕' };

    document.getElementById('tora-cat-title').textContent = `${info.icon} ${info.label}`;

    const nav = document.getElementById('tora-cat-nav');
    nav.innerHTML = cards.map((c, i) => `<a href="#tora-card-${i}" class="tora-nav-link">${c.title}</a>`).join('') + '<p class="tora-card-zoom-hint">🔍 図をタップすると拡大できます</p>';

    const list = document.getElementById('tora-cat-list');
    if (!cards.length) {
      list.innerHTML = '<p class="tora-empty">このカテゴリはまだ準備中です。</p>';
    } else {
      list.innerHTML = cards.map((c, i) => `
        <section id="tora-card-${i}" class="tora-card">
          <h3 class="tora-card-title">${c.title}</h3>
          <div class="tora-card-body">${c.body}</div>
        </section>
      `).join('');
    }

    showScreen('tora-cat');
  } catch (e) {
    showToast('虎の巻の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

// ============================================================
// サイエンス（中学受験理科の図鑑・知識まとめ）
// ============================================================

const SCIENCE_CATEGORIES = {
  shokubutsu: { label: '植物のからだ',       icon: '🌱' },
  konchu:     { label: '昆虫・生き物のからだ', icon: '🐛' },
  jintai:     { label: '人体のしくみ',       icon: '🫀' },
  seiza:      { label: '星座・天体',         icon: '✨' },
  tenki:      { label: '天気・気象',         icon: '🌦️' },
  daichi:     { label: '大地・地層',         icon: '🪨' },
  mono:       { label: 'もの・水溶液',       icon: '🧪' },
  denki:      { label: '電気・力',           icon: '⚡' },
  hikari_oto: { label: '光・音の性質',       icon: '🔦' },
  zukan:      { label: '生き物・植物図鑑',   icon: '📖' },
};

let scienceData = null;
async function loadScienceData() {
  if (scienceData) return scienceData;
  const res = await fetch('data/rika_science.json');
  scienceData = await res.json();
  return scienceData;
}

async function initScienceHome() {
  showLoading();
  try {
    const data = await loadScienceData();
    const counts = {};
    data.forEach(card => { counts[card.category] = (counts[card.category] || 0) + 1; });

    const grid = document.getElementById('science-cat-grid');
    grid.innerHTML = '';
    Object.entries(SCIENCE_CATEGORIES).forEach(([cat, info]) => {
      const n = counts[cat] || 0;
      const btn = document.createElement('button');
      btn.className = 'cat-card';
      btn.dataset.scienceCat = cat;
      btn.innerHTML = `
        <span class="cat-icon">${info.icon}</span>
        <span class="cat-name">${info.label}</span>
        <span class="cat-count">${n}件</span>
      `;
      btn.onclick = () => showScienceCategory(cat);
      grid.appendChild(btn);
    });
  } catch (e) {
    showToast('はかせの図鑑の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function showScienceCategory(cat) {
  showLoading();
  try {
    const data = await loadScienceData();
    const cards = data.filter(c => c.category === cat);
    const info = SCIENCE_CATEGORIES[cat] || { label: cat, icon: '🔬' };

    document.getElementById('science-cat-title').textContent = `${info.icon} ${info.label}`;

    const nav = document.getElementById('science-cat-nav');
    nav.innerHTML = cards.map((c, i) => `<a href="#science-card-${i}" class="tora-nav-link">${c.title}</a>`).join('') + '<p class="tora-card-zoom-hint">🔍 図をタップすると拡大できます</p>';

    const list = document.getElementById('science-cat-list');
    if (!cards.length) {
      list.innerHTML = '<p class="tora-empty">このカテゴリはまだ準備中です。</p>';
    } else {
      list.innerHTML = cards.map((c, i) => `
        <section id="science-card-${i}" class="tora-card">
          <h3 class="tora-card-title">${c.title}</h3>
          <div class="tora-card-body">${c.body}</div>
        </section>
      `).join('');
    }

    showScreen('science-cat');
  } catch (e) {
    showToast('はかせの図鑑の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

// ============================================================
// ニッポンのあゆみ（中学受験社会の図鑑・知識まとめ）
// ============================================================

const NIPPON_CATEGORIES = {
  kokudo: { label: '国土と自然',   icon: '🗾' },
  sangyo: { label: '産業とくらし', icon: '🏭' },
  rekishi: { label: '日本の歴史',  icon: '⛩️' },
  komin:  { label: '政治と国際',   icon: '🏛️' },
};

let nipponData = null;
async function loadNipponData() {
  if (nipponData) return nipponData;
  const res = await fetch('data/shakai_nippon.json');
  nipponData = await res.json();
  return nipponData;
}

async function initNipponHome() {
  showLoading();
  try {
    const data = await loadNipponData();
    const counts = {};
    data.forEach(card => { counts[card.category] = (counts[card.category] || 0) + 1; });

    const grid = document.getElementById('nippon-cat-grid');
    grid.innerHTML = '';
    Object.entries(NIPPON_CATEGORIES).forEach(([cat, info]) => {
      const n = counts[cat] || 0;
      const btn = document.createElement('button');
      btn.className = 'cat-card';
      btn.dataset.nipponCat = cat;
      btn.innerHTML = `
        <span class="cat-icon">${info.icon}</span>
        <span class="cat-name">${info.label}</span>
        <span class="cat-count">${n}件</span>
      `;
      btn.onclick = () => showNipponCategory(cat);
      grid.appendChild(btn);
    });
  } catch (e) {
    showToast('ニッポンのあゆみの読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function showNipponCategory(cat) {
  showLoading();
  try {
    const data = await loadNipponData();
    const cards = data.filter(c => c.category === cat);
    const info = NIPPON_CATEGORIES[cat] || { label: cat, icon: '🧭' };

    document.getElementById('nippon-cat-title').textContent = `${info.icon} ${info.label}`;

    const nav = document.getElementById('nippon-cat-nav');
    nav.innerHTML = cards.map((c, i) => `<a href="#nippon-card-${i}" class="tora-nav-link">${c.title}</a>`).join('') + '<p class="tora-card-zoom-hint">🔍 図をタップすると拡大できます</p>';

    const list = document.getElementById('nippon-cat-list');
    if (!cards.length) {
      list.innerHTML = '<p class="tora-empty">このカテゴリはまだ準備中です。</p>';
    } else {
      list.innerHTML = cards.map((c, i) => `
        <section id="nippon-card-${i}" class="tora-card">
          <h3 class="tora-card-title">${c.title}</h3>
          <div class="tora-card-body">${c.body}</div>
        </section>
      `).join('');
    }

    showScreen('nippon-cat');
  } catch (e) {
    showToast('ニッポンのあゆみの読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

// ============================================================
// 実験室（中学受験理科のバーチャル実験）
// ============================================================

function renderOttonSprite(mood) {
  const src = mood === 'excited' ? 'images/otton-happy.png' : 'images/otton.png';
  return `<img src="${src}" alt="オットン" class="lab-otton-img" onerror="this.style.display='none'">`;
}

function renderLabBenchScene() {
  const bottles = [
    { x: 190, color: '#ff6b6b', h: 26 },
    { x: 215, color: '#4fd1c5', h: 34 },
    { x: 240, color: '#ffd166', h: 22 },
    { x: 263, color: '#a78bfa', h: 30 }
  ];
  const bottleEls = bottles.map(b => `
    <rect x="${b.x}" y="${70 - b.h}" width="16" height="${b.h}" rx="3" fill="${b.color}" fill-opacity="0.85"/>
    <rect x="${b.x + 4}" y="${70 - b.h - 6}" width="8" height="8" fill="#cfd8dc"/>
  `).join('');
  const planks = Array.from({ length: 8 }).map((_, i) => `<line x1="${i * 40}" y1="80" x2="${i * 40}" y2="118" stroke="#5a3d24" stroke-width="1"/>`).join('');
  return `<svg viewBox="0 0 300 118" shape-rendering="crispEdges" style="display:block;width:100%;height:auto">
    <rect width="300" height="118" fill="#1a2340"/>
    <rect x="18" y="14" width="46" height="36" fill="#0e1830" stroke="#4f9eff" stroke-width="2"/>
    <rect x="18" y="30" width="46" height="2" fill="#4f9eff"/>
    <rect x="39" y="14" width="2" height="36" fill="#4f9eff"/>
    <rect x="20" y="16" width="42" height="32" fill="#ffe9a8" fill-opacity="0.18"/>
    <rect x="170" y="70" width="120" height="2" fill="#8d6e63"/>
    ${bottleEls}
    <rect x="0" y="80" width="300" height="38" fill="#7a4a2a"/>
    ${planks}
    <rect x="30" y="60" width="26" height="20" fill="#37474f"/>
    <rect x="38" y="46" width="10" height="16" fill="#455a64"/>
    <polygon points="43,30 38,46 48,46" fill="#ff8c42"/>
    <polygon points="43,36 40,46 46,46" fill="#ffd166"/>
    <rect x="90" y="58" width="24" height="22" rx="4" fill="#8ecbff" fill-opacity="0.55" stroke="#4f9eff" stroke-width="1.5"/>
    <circle cx="97" cy="70" r="2" fill="#fff"/>
    <circle cx="104" cy="65" r="1.5" fill="#fff"/>
  </svg>`;
}

let labData = null;
async function loadLabData() {
  if (labData) return labData;
  const res = await fetch('data/rika_lab.json');
  labData = await res.json();
  return labData;
}

let labCurrentExp = null;
let labVarValues = {};

async function initLabHome() {
  showLoading();
  try {
    document.getElementById('lab-bench-banner').innerHTML = renderLabBenchScene();
    const data = await loadLabData();
    const grid = document.getElementById('lab-home-grid');
    grid.innerHTML = '';
    data.forEach(exp => {
      const btn = document.createElement('button');
      btn.className = 'cat-card';
      btn.innerHTML = `
        <span class="cat-icon">${exp.icon}</span>
        <span class="cat-name">${exp.title}</span>
      `;
      btn.onclick = () => showLabDetail(exp.id);
      grid.appendChild(btn);
    });
  } catch (e) {
    showToast('実験室の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

async function showLabDetail(id) {
  showLoading();
  try {
    const data = await loadLabData();
    const exp = data.find(x => x.id === id);
    if (!exp) { showToast('実験が見つかりません'); hideLoading(); return; }
    labCurrentExp = exp;
    labVarValues = {};

    const ottonEl = document.getElementById('lab-otton-portrait');
    ottonEl.innerHTML = renderOttonSprite('idle');
    ottonEl.classList.remove('lab-otton-running', 'lab-otton-excited');
    document.getElementById('lab-otton-speech').textContent = 'じゅんびOK！道具を選んでね。';

    document.getElementById('lab-detail-title').textContent = `${exp.icon} ${exp.title}`;
    document.getElementById('lab-detail-intro').textContent = exp.intro;
    document.getElementById('lab-control-label').textContent = exp.controlLabel || '';

    const resultEl = document.getElementById('lab-result');
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';

    const optionsEl = document.getElementById('lab-choice-options');
    const varsEl = document.getElementById('lab-calc-vars');
    const runBtn = document.getElementById('lab-run-btn');
    optionsEl.innerHTML = '';
    varsEl.innerHTML = '';
    runBtn.classList.add('hidden');
    optionsEl.classList.add('hidden');
    varsEl.classList.add('hidden');

    if (exp.type === 'choice') {
      optionsEl.classList.remove('hidden');
      exp.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'lab-choice-btn';
        b.innerHTML = `<span class="lab-choice-icon">${opt.icon || '🔬'}</span><span class="lab-choice-label">${opt.label}</span>`;
        b.onclick = () => runLabChoice(i);
        optionsEl.appendChild(b);
      });
    } else if (exp.type === 'calc') {
      varsEl.classList.remove('hidden');
      exp.vars.forEach(v => {
        labVarValues[v.id] = v.default;
        const row = document.createElement('div');
        row.className = 'lab-var-row';
        row.innerHTML = `
          <span class="lab-var-label">${v.label}</span>
          <div class="lab-var-ctrl">
            <button class="lab-var-btn" data-dir="-1">−</button>
            <span class="lab-var-value" id="lab-var-${v.id}">${v.default}${v.unit || ''}</span>
            <button class="lab-var-btn" data-dir="1">＋</button>
          </div>
        `;
        const [minusBtn, plusBtn] = row.querySelectorAll('.lab-var-btn');
        const update = dir => {
          let nv = labVarValues[v.id] + dir * v.step;
          nv = Math.min(v.max, Math.max(v.min, nv));
          labVarValues[v.id] = nv;
          document.getElementById(`lab-var-${v.id}`).textContent = `${nv}${v.unit || ''}`;
        };
        minusBtn.onclick = () => update(-1);
        plusBtn.onclick = () => update(1);
        varsEl.appendChild(row);
      });
      runBtn.classList.remove('hidden');
      runBtn.onclick = runLabCalc;
    }

    showScreen('lab-detail');
  } catch (e) {
    showToast('実験の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

function labStartRunning() {
  const ottonEl = document.getElementById('lab-otton-portrait');
  ottonEl.classList.remove('lab-otton-excited');
  ottonEl.classList.add('lab-otton-running');
  document.getElementById('lab-otton-speech').textContent = 'じっけん中…どうなるかな？';
  const resultEl = document.getElementById('lab-result');
  resultEl.classList.add('hidden');
}

function labFinishRunning(speech) {
  const ottonEl = document.getElementById('lab-otton-portrait');
  ottonEl.classList.remove('lab-otton-running');
  ottonEl.classList.add('lab-otton-excited');
  ottonEl.innerHTML = renderOttonSprite('excited');
  document.getElementById('lab-otton-speech').textContent = speech;
  const resultEl = document.getElementById('lab-result');
  resultEl.classList.remove('hidden');
  setTimeout(() => resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
}

function runLabChoice(i) {
  const opt = labCurrentExp.options[i];
  document.querySelectorAll('#lab-choice-options .lab-choice-btn').forEach((b, bi) => {
    b.classList.toggle('selected', bi === i);
  });
  labStartRunning();
  const resultEl = document.getElementById('lab-result');
  resultEl.innerHTML = `
    <div class="lab-result-icon" style="background:${opt.color || '#4f9eff'}">${opt.resultIcon || opt.icon || '🔬'}</div>
    <div class="lab-result-title">${opt.resultTitle}</div>
    <div class="lab-result-text">${opt.resultText}</div>
  `;
  setTimeout(() => labFinishRunning('できた！見てみて！'), 900);
}

function runLabCalc() {
  const exp = labCurrentExp;
  const fn = LAB_FORMULAS[exp.formula];
  if (!fn) return;
  const r = fn(labVarValues);
  labStartRunning();
  const resultEl = document.getElementById('lab-result');
  resultEl.classList.remove('lab-anim-run');
  resultEl.innerHTML = `
    <div class="lab-result-svg">${r.svg}</div>
    <div class="lab-result-title">${r.title}</div>
    <div class="lab-result-text">${r.text}</div>
  `;
  setTimeout(() => {
    labFinishRunning('できた！見てみて！');
    requestAnimationFrame(() => requestAnimationFrame(() => resultEl.classList.add('lab-anim-run')));
  }, 900);
}

const LAB_FORMULAS = {
  lever(v) {
    const lm = v.ld * v.lw, rm = v.rd * v.rw;
    const balanced = lm === rm;
    const tiltLeft = lm > rm;
    const angle = balanced ? 0 : (tiltLeft ? -12 : 12);
    const lr = 8 + Math.min(20, v.lw / 3);
    const rr = 8 + Math.min(20, v.rw / 3);
    const unit = 15;
    const lx = 120 - v.ld * unit;
    const rx = 120 + v.rd * unit;
    const svg = `<svg viewBox="0 0 240 150" style="display:block;margin:0 auto;max-width:260px">
      <rect width="240" height="150" fill="#eef2ff"/>
      <polygon points="110,120 130,120 120,100" fill="#4f9eff"/>
      <g class="lab-lever-arm" style="--lab-angle:${angle}deg">
        <rect x="${lx}" y="97" width="${rx - lx}" height="6" rx="3" fill="#8ecbff"/>
        <circle cx="${lx}" cy="100" r="${lr}" fill="#ff8fa3"/>
        <circle cx="${rx}" cy="100" r="${rr}" fill="#ffd166"/>
      </g>
      <text x="${lx}" y="40" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#1a2340">左 ${v.ld}×${v.lw}=${lm}</text>
      <text x="${rx}" y="40" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#1a2340">右 ${v.rd}×${v.rw}=${rm}</text>
    </svg>`;
    return {
      svg,
      title: balanced ? '⚖️ つり合った！' : (tiltLeft ? '⬅️ 左にかたむいた' : '➡️ 右にかたむいた'),
      text: balanced
        ? `左は「うでの長さ${v.ld}×おもり${v.lw}g＝${lm}」、右は「${v.rd}×${v.rw}＝${rm}」で、同じ数字になったのでつり合いました。てこは「支点からの距離×おもりの重さ」が左右で等しいときにつり合います。`
        : `左は${v.ld}×${v.lw}＝${lm}、右は${v.rd}×${v.rw}＝${rm}で、${tiltLeft ? '左' : '右'}の方が大きいので${tiltLeft ? '左' : '右'}にかたむきます。数字が同じになるように、うでの長さかおもりを調整してみよう。`
    };
  },
  spring(v) {
    const ext = Math.round((v.force / 10) * 2 * 10) / 10;
    const scale = (70 + ext * 3) / 70;
    const svg = `<svg viewBox="0 0 160 200" style="display:block;margin:0 auto;max-width:180px">
      <rect width="160" height="200" fill="#eef2ff"/>
      <rect x="70" y="10" width="20" height="10" fill="#8d6e63"/>
      <g class="lab-spring-coil" style="--lab-scale:${scale}">
        <path d="M80,20 L65,32 L95,44 L65,56 L95,68 L65,80 L80,90" stroke="#4f9eff" stroke-width="3" fill="none"/>
      </g>
      <g class="lab-spring-weight" style="--lab-ty:${ext * 3}px">
        <circle cx="80" cy="104" r="14" fill="#ffd166"/>
        <text x="80" y="108" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#1a2340">${v.force}g</text>
      </g>
    </svg>`;
    return {
      svg,
      title: `📏 のびは ${ext}cm`,
      text: `このばねは10gで2cmのびる性質があります。ばねののびは、つるしたおもりの重さに比例します（フックの法則）。${v.force}gをつるすと、${v.force}÷10×2＝${ext}cmのびます。`
    };
  },
  pendulum(v) {
    const period = (2 * Math.PI * Math.sqrt(v.length / 100 / 9.8)).toFixed(1);
    const len = Math.min(150, 20 + v.length * 1.3);
    const svg = `<svg viewBox="0 0 200 180" style="display:block;margin:0 auto;max-width:220px">
      <rect width="200" height="180" fill="#eef2ff"/>
      <circle cx="100" cy="20" r="5" fill="#4f9eff"/>
      <g class="lab-pendulum-arm" style="animation-duration:${period}s">
        <line x1="100" y1="20" x2="100" y2="${20 + len}" stroke="#8ecbff" stroke-width="2"/>
        <circle cx="100" cy="${20 + len}" r="12" fill="#ff8fa3"/>
      </g>
      <text x="100" y="165" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#1a2340">糸の長さ ${v.length}cm</text>
    </svg>`;
    return {
      svg,
      title: `⏱️ 1往復 約${period}秒`,
      text: `振り子が1往復する時間は、糸の長さだけで決まり、おもりの重さやふれはばには関係しません。糸を長くするほど1往復する時間は長くなります（糸の長さ${v.length}cmのとき、約${period}秒）。絵の揺れる速さも、この周期に合わせています。`
    };
  },
  buoyancy(v) {
    const density = Math.round((v.weight / v.volume) * 100) / 100;
    const floats = density < 1;
    const finalY = floats ? 50 : 90;
    const svg = `<svg viewBox="0 0 200 160" style="display:block;margin:0 auto;max-width:220px">
      <rect width="200" height="160" fill="#dff3ff"/>
      <rect y="70" width="200" height="90" fill="#7fc7ff"/>
      <ellipse class="lab-ripple" cx="100" cy="70" rx="30" ry="6" fill="none" stroke="#fff" stroke-width="2"/>
      <g class="lab-buoy-obj" style="--lab-ty:${finalY}px">
        <rect x="80" y="0" width="40" height="40" fill="#ffd166"/>
      </g>
      <text x="100" y="145" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#1a2340">重さ${v.weight}g／体積${v.volume}cm³</text>
    </svg>`;
    return {
      svg,
      title: floats ? '🎈 浮いた！' : '⬇️ しずんだ…',
      text: `密度（1cm³あたりの重さ）は ${v.weight}g ÷ ${v.volume}cm³ ＝ ${density}g/cm³ です。水の密度（1g/cm³）より${floats ? '小さい' : '大きい'}ので、この物体は${floats ? '浮きます' : 'しずみます'}。`
    };
  }
};

// ============================================================
// 社会でGO!（地図たんけん・タイムトラベル日本史・三権タウン事件簿）
// ============================================================

document.getElementById('btn-open-mapquiz').onclick = () => { initMapQuiz(); showScreen('map-quiz'); };
document.getElementById('btn-open-timeline').onclick = () => { initTimelineGame(); showScreen('timeline-game'); };
document.getElementById('btn-open-sanken').onclick = () => { initSankenHome(); showScreen('sanken-home'); };

// ── 三権タウン事件簿 ──────────────────────────────
let sankenData = null;
async function loadSankenData() {
  if (sankenData) return sankenData;
  const res = await fetch('data/sanken_cases.json');
  sankenData = await res.json();
  return sankenData;
}

async function initSankenHome() {
  showLoading();
  try {
    const data = await loadSankenData();
    const grid = document.getElementById('sanken-home-grid');
    grid.innerHTML = '';
    data.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'cat-card';
      btn.innerHTML = `<span class="cat-icon">${c.icon}</span><span class="cat-name">${c.title}</span>`;
      btn.onclick = () => startSankenCase(c.id);
      grid.appendChild(btn);
    });
  } catch (e) {
    showToast('読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

let sankenCase = null, sankenFlow = [], sankenFlowIdx = 0, sankenOpinion = 50;

function startSankenCase(id) {
  sankenCase = sankenData.find(c => c.id === id);
  sankenOpinion = 50;
  sankenFlow = [
    { type: 'stage', data: sankenCase.stages[0] },
    { type: 'stage', data: sankenCase.stages[1] },
    { type: 'trouble', data: sankenCase.trouble },
    { type: 'stage', data: sankenCase.stages[2] },
    { type: 'ending' }
  ];
  sankenFlowIdx = 0;
  document.getElementById('sanken-title').textContent = `${sankenCase.icon} ${sankenCase.title}`;
  showScreen('sanken-play');
  renderSankenStep();
}

function sankenUpdateOpinionBar() {
  const fill = document.getElementById('sanken-opinion-fill');
  fill.style.width = `${sankenOpinion}%`;
  fill.style.background = sankenOpinion >= 65 ? '#4caf50' : sankenOpinion >= 40 ? '#ffd166' : '#ff5252';
  document.getElementById('sanken-opinion-label').textContent = `世論支持率 ${sankenOpinion}%`;
}

function renderSankenStep() {
  const step = sankenFlow[sankenFlowIdx];
  sankenUpdateOpinionBar();
  document.getElementById('sanken-result').classList.add('hidden');

  if (step.type === 'ending') {
    renderSankenEnding();
    return;
  }

  const d = step.data;
  const body = document.getElementById('sanken-body');
  const badgeLabel = step.type === 'trouble' ? '📢 トラブル発生！' : `${d.branchIcon} ${d.branch}`;
  body.innerHTML = `
    <div class="sanken-branch-badge${step.type === 'trouble' ? ' sanken-trouble-badge' : ''}">${badgeLabel}</div>
    ${d.role ? `<p class="sanken-role">${d.role}</p>` : ''}
    <p class="sanken-narrative">${d.narrative}</p>
    <p class="sanken-question">${d.question}</p>
    <div id="sanken-options" class="lab-choice-grid sanken-options"></div>
  `;
  const optionsEl = document.getElementById('sanken-options');
  d.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'lab-choice-btn sanken-choice-btn';
    b.innerHTML = `<span class="lab-choice-label">${opt.label}</span>`;
    b.onclick = () => sankenChoose(opt);
    optionsEl.appendChild(b);
  });
  setTimeout(() => body.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
}

function sankenChoose(opt) {
  sankenOpinion = Math.max(0, Math.min(100, sankenOpinion + (opt.opinionEffect || 0)));
  sankenUpdateOpinionBar();
  const resultEl = document.getElementById('sanken-result');
  resultEl.classList.remove('hidden');
  const d = opt.opinionEffect > 0 ? `世論支持率 +${opt.opinionEffect}` : opt.opinionEffect < 0 ? `世論支持率 ${opt.opinionEffect}` : '';
  resultEl.innerHTML = `
    ${d ? `<div class="lab-result-title">${d}</div>` : ''}
    <div class="lab-result-text">${opt.outcome}</div>
    <button id="sanken-next-btn" class="lab-run-btn" style="margin-top:12px">➡️ つぎへ</button>
  `;
  document.getElementById('sanken-next-btn').onclick = () => {
    sankenFlowIdx++;
    renderSankenStep();
  };
  setTimeout(() => resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
}

function renderSankenEnding() {
  const ending = sankenCase.endings.find(e => sankenOpinion >= e.min) || sankenCase.endings[sankenCase.endings.length - 1];
  const body = document.getElementById('sanken-body');
  body.innerHTML = `
    <div class="lab-result-icon" style="background:#ffd166">🏁</div>
    <div class="lab-result-title">${ending.title}</div>
    <div class="lab-result-text">${ending.text}</div>
    <div class="lab-result-text sanken-summary"><strong>まとめ：</strong>${sankenCase.summary}</div>
    <button id="sanken-again-btn" class="lab-run-btn" style="margin-top:14px">🔁 べつの事案をえらぶ</button>
  `;
  document.getElementById('sanken-again-btn').onclick = () => { initSankenHome(); showScreen('sanken-home'); };
  setTimeout(() => body.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
}

// ── タイムトラベル日本史 ──────────────────────────────
const TIMELINE_ROUNDS = [
  { title: '縄文〜奈良時代', items: [
    { label: '縄文時代：狩りや漁、木の実採集のくらしが広まる', order: 1 },
    { label: '弥生時代：稲作が広まり、むらができる', order: 2 },
    { label: '聖徳太子が摂政になり、十七条の憲法を定める', order: 3 },
    { label: '大化の改新が始まる', order: 4 },
    { label: '都が平城京（奈良）に移される', order: 5 }
  ]},
  { title: '奈良〜平安時代', items: [
    { label: '都が平城京に移される', order: 1 },
    { label: '都が平安京（京都）に移される', order: 2 },
    { label: '藤原氏による摂関政治が全盛をむかえる', order: 3 },
    { label: '平将門の乱がおこる', order: 4 },
    { label: '源平の争いで平氏がほろびる', order: 5 }
  ]},
  { title: '平安〜鎌倉時代', items: [
    { label: '平清盛が太政大臣になる', order: 1 },
    { label: '壇ノ浦の戦いで平氏がほろびる', order: 2 },
    { label: '源頼朝が征夷大将軍になり、鎌倉幕府が開かれる', order: 3 },
    { label: '元寇（元軍の襲来）がおこる', order: 4 },
    { label: '鎌倉幕府がほろびる', order: 5 }
  ]},
  { title: '鎌倉〜室町時代', items: [
    { label: '鎌倉幕府がほろびる', order: 1 },
    { label: '足利尊氏が征夷大将軍になり、室町幕府が開かれる', order: 2 },
    { label: '足利義満が金閣を建てる', order: 3 },
    { label: '応仁の乱がおこる', order: 4 },
    { label: '戦国時代が始まる', order: 5 }
  ]},
  { title: '戦国の三英雄', items: [
    { label: '織田信長が桶狭間の戦いで勝利する', order: 1 },
    { label: '織田信長が本能寺の変でたおれる', order: 2 },
    { label: '豊臣秀吉が全国を統一する', order: 3 },
    { label: '関ヶ原の戦いがおこる', order: 4 },
    { label: '徳川家康が征夷大将軍になり、江戸幕府を開く', order: 5 }
  ]},
  { title: '江戸時代', items: [
    { label: '江戸幕府が開かれる', order: 1 },
    { label: '参勤交代の制度が定められる', order: 2 },
    { label: '鎖国が完成する（オランダ・中国以外との貿易を禁止）', order: 3 },
    { label: '享保の改革が行われる（徳川吉宗）', order: 4 },
    { label: '黒船（ペリー）が浦賀に来航する', order: 5 }
  ]},
  { title: '幕末〜明治時代', items: [
    { label: 'ペリーが来航し、開国を求める', order: 1 },
    { label: '日米和親条約が結ばれる', order: 2 },
    { label: '江戸幕府がほろび、明治政府ができる（大政奉還）', order: 3 },
    { label: '廃藩置県が行われる', order: 4 },
    { label: '大日本帝国憲法が発布される', order: 5 }
  ]},
  { title: '明治〜大正時代', items: [
    { label: '大日本帝国憲法が発布される', order: 1 },
    { label: '日清戦争がおこる', order: 2 },
    { label: '日露戦争がおこる', order: 3 },
    { label: '第一次世界大戦が始まる', order: 4 },
    { label: '大正デモクラシーの風潮が広まる', order: 5 }
  ]},
  { title: '昭和（戦前〜戦後）', items: [
    { label: '満州事変がおこる', order: 1 },
    { label: '日中戦争が始まる', order: 2 },
    { label: '太平洋戦争が始まる', order: 3 },
    { label: '太平洋戦争が終わる（日本が降伏する）', order: 4 },
    { label: '日本国憲法が施行される', order: 5 }
  ]},
  { title: '戦後〜現代', items: [
    { label: '日本国憲法が施行される', order: 1 },
    { label: 'サンフランシスコ平和条約が結ばれ、独立を回復する', order: 2 },
    { label: '東京オリンピックが開かれる（1964年）', order: 3 },
    { label: '昭和から平成に元号が変わる', order: 4 },
    { label: '平成から令和に元号が変わる', order: 5 }
  ]}
];

let timelineRoundIdx = -1;
let timelineDisplayItems = []; // シャッフルされた表示順
let timelineAnswer = []; // タップした順（timelineDisplayItemsのインデックス配列）
let timelineTotalScore = 0;
const TIMELINE_POINTS_PER_CARD = 20;
const TIMELINE_PERFECT_BONUS = 50;

function timelineUpdateScoreLabel() {
  const best = Number(localStorage.getItem('timelineBest') || 0);
  document.getElementById('timeline-score').textContent = `🏆 ${timelineTotalScore}てん（さいこう ${Math.max(best, timelineTotalScore)}）`;
}

function initTimelineGame() {
  timelineRoundIdx = Math.floor(Math.random() * TIMELINE_ROUNDS.length);
  timelineTotalScore = 0;
  timelineUpdateScoreLabel();
  timelineStartRound();
  document.getElementById('timeline-check-btn').onclick = timelineCheck;
}

function timelineStartRound() {
  const round = TIMELINE_ROUNDS[timelineRoundIdx];
  timelineDisplayItems = shuffle(round.items.map((item, i) => ({ ...item, origIndex: i })));
  timelineAnswer = [];
  document.getElementById('timeline-round-title').textContent = `📖 ${round.title}`;
  document.getElementById('timeline-result').classList.add('hidden');
  document.getElementById('timeline-result').innerHTML = '';
  timelineUpdateScoreLabel();
  renderTimelineCards();
}

function renderTimelineCards() {
  const wrap = document.getElementById('timeline-cards');
  wrap.innerHTML = '';
  timelineDisplayItems.forEach((item, i) => {
    const pos = timelineAnswer.indexOf(i);
    const btn = document.createElement('button');
    btn.className = 'timeline-card' + (pos >= 0 ? ' selected' : '');
    btn.innerHTML = `${pos >= 0 ? `<span class="timeline-card-num">${pos + 1}</span>` : ''}<span class="timeline-card-label">${item.label}</span>`;
    btn.onclick = () => {
      const idx = timelineAnswer.indexOf(i);
      if (idx >= 0) {
        timelineAnswer.splice(idx, 1);
      } else if (timelineAnswer.length < timelineDisplayItems.length) {
        timelineAnswer.push(i);
      }
      renderTimelineCards();
    };
    wrap.appendChild(btn);
  });
}

function timelineCheck() {
  if (timelineAnswer.length < timelineDisplayItems.length) {
    showToast('すべてのカードをタップして順番をつけてね');
    return;
  }
  const wrap = document.getElementById('timeline-cards');
  let correctCount = 0;
  [...wrap.children].forEach((btn, i) => {
    const item = timelineDisplayItems[timelineAnswer[i]];
    const ok = item.order === i + 1;
    if (ok) correctCount++;
    btn.classList.add(ok ? 'correct' : 'wrong');
  });
  const round = TIMELINE_ROUNDS[timelineRoundIdx];
  const correctOrderText = [...round.items].sort((a, b) => a.order - b.order).map((it, i) => `${i + 1}. ${it.label}`).join('<br>');
  const isPerfect = correctCount === timelineDisplayItems.length;
  const roundScore = correctCount * TIMELINE_POINTS_PER_CARD + (isPerfect ? TIMELINE_PERFECT_BONUS : 0);
  timelineTotalScore += roundScore;
  const best = Number(localStorage.getItem('timelineBest') || 0);
  const isNewBest = timelineTotalScore > best;
  if (isNewBest) localStorage.setItem('timelineBest', timelineTotalScore);
  timelineUpdateScoreLabel();

  const resultEl = document.getElementById('timeline-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="lab-result-title">${isPerfect ? '🎉 ぜんぶ正解！' : `${correctCount} / ${timelineDisplayItems.length} 問正解`} ＋${roundScore}てん${isPerfect ? '（パーフェクトボーナス+' + TIMELINE_PERFECT_BONUS + '）' : ''}${isNewBest ? '<br>🏆 自己ベスト更新！' : ''}</div>
    <div class="lab-result-text">正しい順番：<br>${correctOrderText}</div>
    <button id="timeline-next-btn" class="lab-run-btn" style="margin-top:12px">➡️ つぎのラウンドへ</button>
  `;
  document.getElementById('timeline-next-btn').onclick = () => {
    timelineRoundIdx = (timelineRoundIdx + 1) % TIMELINE_ROUNDS.length;
    timelineStartRound();
  };
  setTimeout(() => resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
}

// ── ニッポン地図たんけん ──────────────────────────────
let mapQuizData = null; // { svgHtml, regions: {prefName: regionName} }
let mapQuizScore = { correct: 0, total: 0, points: 0, streak: 0 };
let mapQuizTarget = null;
const MAPQUIZ_BASE_POINTS = 10;
const MAPQUIZ_STREAK_BONUS = 5;

async function loadMapQuizData() {
  if (mapQuizData) return mapQuizData;
  const [svgRes, regionsRes] = await Promise.all([
    fetch('data/japan_map.svg'),
    fetch('data/japan_pref_regions.json')
  ]);
  const svgHtml = await svgRes.text();
  const regions = await regionsRes.json();
  mapQuizData = { svgHtml, regions };
  return mapQuizData;
}

let mapQuizZoomCtl = null;
const MAPQUIZ_ZOOM_STEP = 0.5;

function mapQuizUpdateZoomLabel() {
  document.getElementById('mapquiz-zoom-label').textContent = `${Math.round(mapQuizZoomCtl.state.zoom * 100)}%`;
}

async function initMapQuiz() {
  showLoading();
  try {
    const data = await loadMapQuizData();
    const wrap = document.getElementById('mapquiz-map-wrap');
    wrap.innerHTML = data.svgHtml;
    const svg = wrap.querySelector('svg');
    if (svg) {
      svg.querySelectorAll('[data-pref]').forEach(path => {
        path.classList.add('mapquiz-pref');
        path.onclick = () => mapQuizAnswer(path.dataset.pref);
      });
    }
    mapQuizScore = { correct: 0, total: 0, points: 0, streak: 0 };
    if (!mapQuizZoomCtl) {
      mapQuizZoomCtl = createPinchZoomController(
        document.getElementById('mapquiz-map-viewport'),
        document.getElementById('mapquiz-map-wrap'),
        { minZoom: 1, maxZoom: 4 }
      );
    }
    mapQuizZoomCtl.reset();
    mapQuizUpdateZoomLabel();
    document.getElementById('mapquiz-restart').onclick = () => { mapQuizScore = { correct: 0, total: 0, points: 0, streak: 0 }; mapQuizNext(); };
    document.getElementById('mapquiz-zoom-in').onclick = () => {
      mapQuizZoomCtl.state.zoom = Math.min(mapQuizZoomCtl.state.maxZoom, mapQuizZoomCtl.state.zoom + MAPQUIZ_ZOOM_STEP);
      mapQuizZoomCtl.apply();
      mapQuizUpdateZoomLabel();
    };
    document.getElementById('mapquiz-zoom-out').onclick = () => {
      mapQuizZoomCtl.state.zoom = Math.max(mapQuizZoomCtl.state.minZoom, mapQuizZoomCtl.state.zoom - MAPQUIZ_ZOOM_STEP);
      mapQuizZoomCtl.apply();
      mapQuizUpdateZoomLabel();
    };
    document.getElementById('mapquiz-zoom-reset').onclick = () => {
      mapQuizZoomCtl.reset();
      mapQuizUpdateZoomLabel();
    };
    mapQuizNext();
  } catch (e) {
    showToast('地図の読み込みに失敗しました');
    console.error(e);
  } finally {
    hideLoading();
  }
}

function mapQuizUpdateScoreLabel() {
  const best = Number(localStorage.getItem('mapquizBest') || 0);
  document.getElementById('mapquiz-score').textContent = `🏆 ${mapQuizScore.points}てん（さいこう ${Math.max(best, mapQuizScore.points)}）・せいかい ${mapQuizScore.correct}/${mapQuizScore.total}`;
}

function mapQuizNext() {
  const prefs = Object.keys(mapQuizData.regions);
  mapQuizTarget = prefs[Math.floor(Math.random() * prefs.length)];
  document.getElementById('mapquiz-question').textContent = `❓「${mapQuizTarget}」はどこ？`;
  mapQuizUpdateScoreLabel();
  document.getElementById('mapquiz-feedback').classList.add('hidden');
  const svg = document.querySelector('#mapquiz-map-wrap svg');
  if (svg) svg.querySelectorAll('.mapquiz-pref').forEach(p => p.classList.remove('mapquiz-correct', 'mapquiz-wrong'));
}

function mapQuizAnswer(pref) {
  const svg = document.querySelector('#mapquiz-map-wrap svg');
  const feedback = document.getElementById('mapquiz-feedback');
  const ok = pref === mapQuizTarget;
  mapQuizScore.total++;
  let gained = 0;
  if (ok) {
    mapQuizScore.correct++;
    mapQuizScore.streak++;
    gained = MAPQUIZ_BASE_POINTS + (mapQuizScore.streak - 1) * MAPQUIZ_STREAK_BONUS;
    mapQuizScore.points += gained;
  } else {
    mapQuizScore.streak = 0;
  }
  const best = Number(localStorage.getItem('mapquizBest') || 0);
  const isNewBest = mapQuizScore.points > best;
  if (isNewBest) localStorage.setItem('mapquizBest', mapQuizScore.points);

  const targetPath = svg.querySelector(`[data-pref="${mapQuizTarget}"]`);
  const tappedPath = svg.querySelector(`[data-pref="${pref}"]`);
  if (targetPath) targetPath.classList.add('mapquiz-correct');
  if (!ok && tappedPath) tappedPath.classList.add('mapquiz-wrong');
  feedback.classList.remove('hidden');
  const region = mapQuizData.regions[mapQuizTarget] || '';
  feedback.innerHTML = ok
    ? `<div class="lab-result-title">🎉 せいかい！ +${gained}てん${mapQuizScore.streak >= 2 ? `（${mapQuizScore.streak}連続！）` : ''}${isNewBest ? '<br>🏆 自己ベスト更新！' : ''}</div><div class="lab-result-text">「${mapQuizTarget}」は${region}にあります。</div><button id="mapquiz-next-btn" class="lab-run-btn" style="margin-top:10px">➡️ つぎの問題</button>`
    : `<div class="lab-result-title">❌ ざんねん…（連続記録リセット）</div><div class="lab-result-text">正解は「${mapQuizTarget}」（${region}）でした。金色に光っている場所です。</div><button id="mapquiz-next-btn" class="lab-run-btn" style="margin-top:10px">➡️ つぎの問題</button>`;
  document.getElementById('mapquiz-next-btn').onclick = mapQuizNext;
  mapQuizUpdateScoreLabel();
  setTimeout(() => feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
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
    case 'gachaShake': [180, 220, 180, 220].forEach((f, i) => tTone(f, 0.06, 'square', 0.07, i * 0.12)); break;
    case 'gachaOpen':  [440, 660, 880].forEach((f, i) => tTone(f, 0.1, 'triangle', 0.1, i * 0.08)); break;
    case 'gachaSR':    [523, 659, 784, 1047, 1319].forEach((f, i) => tTone(f, 0.12, 'square', 0.13, i * 0.09)); break;
    case 'gachaUR':    [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tTone(f, 0.14, 'square', 0.14, i * 0.08)); break;
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
function makeCharStrip(canvasId) {
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
      tDrawSprite(ctx, frame, sp.pal, x, y, s);
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

// ============================================================
// ガチャ図鑑（コイン集め→キャラガチャ→図鑑コンプ）
// ============================================================

// ドット絵の形状ライブラリ（モチーフ別）。ほとんどの形状は y/o/r/d/l/e の6キー役割で統一し、
// gPalette()による自動配色と互換。フラッグシップ級は形状もパレットも専用デザイン。
const G_TEMPLATE = [ // 鳥系（ひよこ）・汎用フォールバック
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
];
const G_SHAPE_ANIMAL = [ // 丸耳どうぶつ（ねこ・いぬ・たぬき・かえる・はむすたー等）
  '..d....d..',
  '.ddyyyydd.',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.yyorroyy.',
  '.yyyyyyyy.',
  '..yyyyyy..',
  '.oyyyyyyo.',
  '.oyyyyyyo.',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_SHELL = [ // こうら系（かめ・かぶとむし・だんごむし）
  '..dyyyyd..',
  '.dyyyyyyd.',
  'dyyyyyyyyd',
  'oyyyyyyyyo',
  'oyeyyyyeyo',
  'oyyyyyyyyo',
  '..llllll..',
  '..l....l..',
  '..........',
];
const G_SHAPE_FISH = [ // さかな（金魚）
  '....oo....',
  'dd.yyyyyy.',
  'd.yyyyyye.',
  'dd.yyyyyy.',
  '....oo....',
  '..........',
];
const G_SHAPE_OBJECT_TALL = [ // 縦長の道具（えんぴつ・じょうぎ・タイマー等）
  '..oyyo..',
  '.oyyyyo.',
  '.yeyyey.',
  '.yyrryy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.dddddd.',
  '.ll..ll.',
  '........',
];
const G_SHAPE_OBJECT_FLAT = [ // 平たい道具（消しゴム・ノート・カバン等）
  '..dyyyyyyd..',
  '.dyyyyyyyyd.',
  'dyyeyyyyeyyd',
  'dyyyyrryyyyd',
  'dyyyyyyyyyyd',
  '.dyyyyyyyyd.',
  '..dllllll...',
  '............',
];
const G_SHAPE_FOOD = [ // 食べもの・飲みもの（カレー・牛乳）
  '..oyyyo..',
  '.oyyyyyo.',
  'oyyeyeyyo',
  'oyyyrryyo',
  'oyyyyyyyo',
  '.ddddddd.',
  '..dd.dd..',
  '.........',
];
const G_SHAPE_VEHICLE = [ // 箱型の車両（ダンプ・ミキサー・ローラー・ブルドーザー等）
  '...oyyyyo...',
  '..oyyyyyyo..',
  '..yeyyyyey..',
  'dyyyyyyyyyyd',
  'dyyyyrryyyyd',
  'dyyyyyyyyyyd',
  '..dddddddd..',
  '.ll......ll.',
  '............',
];
const G_SHAPE_PERSON_M = [ // 人物（男性コード：先生・スタッフ等）
  '..oooooo..',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '.yyyyyyyy.',
  '..dddddd..',
  '.dddddddd.',
  '.dddddddd.',
  '.dddrrddd.',
  '.dddddddd.',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_PERSON_F = [ // 人物（女性コード：先生・スタッフ等）
  '..oooooo..',
  '.ooyyyyoo.',
  '.oyeyyeyo.',
  '.oyyyrryo.',
  '.oyyyyyyo.',
  '..dddddd..',
  '.dddddddd.',
  '.dddrrddd.',
  '.dlllllld.',
  'dlllllllld',
  '..ll..ll..',
  '..........',
  '..........',
];
// 以下はキー文字が独自の専用デザイン（常に個別パレットとセットで使う）
const G_SHAPE_CRANE = [ // クレーン車（クレーンキング専用）
  'd.........',
  'dooooooo..',
  'd........l',
  'd.........',
  'd.........',
  'dyyyyyyyd.',
  'dyeyyyeyd.',
  'dyyyyyyyd.',
  'ddddddddd.',
  '.ll....ll.',
  '..........',
  '..........',
];
const G_SHAPE_ROBE = [ // 女神・巫女風ローブ（合格の女神系専用）
  '.....gg.....',
  '...gg..gg...',
  '..hhhhhhhh..',
  '..hffffffh..',
  '..hfeffefh..',
  '..hffffffh..',
  '..hhhhhhhh..',
  '...rrrrrr...',
  '..rrrrrrrr..',
  '..rryyyyrr..',
  '..rrrrrrrr..',
  '...rrrrrr...',
  '...rr..rr...',
  '............',
];
const G_SHAPE_GUARD = [ // 警備員・門番系専用（帽子＋ベスト＋誘導灯）
  '...cccccc...',
  '..cccccccc..',
  '..cffffffc..',
  '..cfeffefc..',
  '..cffffffc..',
  '...vvvvvv..g',
  '..vvssssvv.g',
  '...vvvvvv..g',
  '...bbbbbb...',
  '...bbbbbb...',
  '...pppppp...',
  '...pp..pp...',
  '............',
];
const G_SHAPE_DARUMA = [ // だるま（合格だるま大明神専用）
  '..dyyyyd..',
  '.dyyyyyyd.',
  'dyyyyyyyyd',
  'dyeyyyyeyd',
  'dyyyrrryyd',
  'dyyyyyyyyd',
  'dyyyyyyyyd',
  'dyyoooyyyd',
  '.dyyyyyyd.',
  '..dyyyyd..',
];
const G_SHAPE_DRAGON = [ // ちびドラゴン（赤本ドラゴン専用）
  '...d....d...',
  '..oyyyyyyo..',
  '.oyeyyyeyo..',
  '.oyyyrryyo..',
  '..oyyyyyyo..',
  '.ddoyyyyodd.',
  '..oyyyyyyo..',
  '..oyyyyyyo..',
  '...dyyyyd...',
  '....dyyd....',
  '.....dd.....',
];
const G_SHAPE_ROBOT = [ // 重機合体ロボ（ケンセツンダー専用）
  '..kk....kk..',
  '..kkkkkkkk..',
  '..oo....oo..',
  '..oooooooo..',
  '..kkkkkkkk..',
  '..yyyyyyyy..',
  '..bbbbbbbb..',
  '..bbrrrrbb..',
  '..bbbbbbbb..',
  '..yyyyyyyy..',
  '.kk......kk.',
  'kkkkkkkkkkkk',
  '............',
  '............',
];

function gHashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function gHslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
// レアリティが高いほど彩度・明度をリッチに
const G_RARITY_TONE = { N: [50, 42], R: [62, 48], SR: [76, 54], UR: [90, 58] };
function gPalette(ch) {
  const hue = gHashStr(ch.id) % 360;
  const [sat, light] = G_RARITY_TONE[ch.rarity] || G_RARITY_TONE.N;
  return {
    y: gHslToHex(hue, sat, Math.min(light + 18, 92)),
    o: gHslToHex(hue, sat, light),
    r: gHslToHex((hue + 30) % 360, sat, Math.max(light - 15, 25)),
    d: gHslToHex(hue, sat, Math.max(light - 20, 18)),
    l: gHslToHex((hue + 180) % 360, Math.min(sat + 10, 92), light),
    e: '#222222',
  };
}

// id→形状（モチーフに合わせて割り当て。未指定はG_TEMPLATEにフォールバック）
const G_CHAR_SHAPE = {
  piyo: G_TEMPLATE, chun: G_TEMPLATE, daiya_chicchi: G_TEMPLATE, god_chicchi: G_TEMPLATE,
  nyankichi: G_SHAPE_ANIMAL, wanzou: G_SHAPE_ANIMAL, ponkichi: G_SHAPE_ANIMAL, kaerunosuke: G_SHAPE_ANIMAL, hamuta: G_SHAPE_ANIMAL,
  kamekichi: G_SHAPE_SHELL, kabutomaru: G_SHAPE_SHELL, dangorou: G_SHAPE_SHELL, keshikasu: G_SHAPE_SHELL,
  kingyohime: G_SHAPE_FISH,
  enpitsu: G_SHAPE_OBJECT_TALL, jougi: G_SHAPE_OBJECT_TALL, recorder: G_SHAPE_OBJECT_TALL, cone: G_SHAPE_OBJECT_TALL,
  scoop: G_SHAPE_OBJECT_TALL, timer: G_SHAPE_OBJECT_TALL, sharpbushi: G_SHAPE_OBJECT_TALL, compass: G_SHAPE_OBJECT_TALL,
  hensachi: G_SHAPE_OBJECT_TALL, akapen: G_SHAPE_OBJECT_TALL,
  keshigomu: G_SHAPE_OBJECT_FLAT, randoseru: G_SHAPE_OBJECT_FLAT, noteshi: G_SHAPE_OBJECT_FLAT, gunte: G_SHAPE_OBJECT_FLAT,
  ankicard: G_SHAPE_OBJECT_FLAT, shukudai: G_SHAPE_OBJECT_FLAT, fusenhime: G_SHAPE_OBJECT_FLAT, kakomon: G_SHAPE_OBJECT_FLAT,
  shitajiki: G_SHAPE_OBJECT_FLAT, jukubag: G_SHAPE_OBJECT_FLAT, helmet: G_SHAPE_OBJECT_FLAT, soroban: G_SHAPE_OBJECT_FLAT,
  jisho: G_SHAPE_OBJECT_FLAT, tobibako: G_SHAPE_OBJECT_FLAT, manten: G_SHAPE_OBJECT_FLAT,
  curry: G_SHAPE_FOOD, gyunyu: G_SHAPE_FOOD, jukuben: G_SHAPE_FOOD,
  shovel: G_SHAPE_VEHICLE, dump: G_SHAPE_VEHICLE, mixer: G_SHAPE_VEHICLE, roller: G_SHAPE_VEHICLE, fork: G_SHAPE_VEHICLE, buru_musashi: G_SHAPE_VEHICLE,
  kocho: G_SHAPE_PERSON_M, kyoto: G_SHAPE_PERSON_M, kinjiro: G_SHAPE_PERSON_M, jukucho: G_SHAPE_PERSON_M,
  keisan_oni: G_SHAPE_PERSON_M, moshi: G_SHAPE_PERSON_M, jishu: G_SHAPE_PERSON_M, ojiin: G_SHAPE_PERSON_M,
  genba_otton: G_SHAPE_PERSON_M, charisma: G_SHAPE_PERSON_M, sairekun: G_SHAPE_PERSON_M,
  gold_otton: G_SHAPE_PERSON_M, hensachi70: G_SHAPE_PERSON_M, god_otton: G_SHAPE_PERSON_M,
  kyushoku: G_SHAPE_PERSON_F, hoken: G_SHAPE_PERSON_F, tutor: G_SHAPE_PERSON_F, obaan: G_SHAPE_PERSON_F,
  super_okan: G_SHAPE_PERSON_F, platina_okan: G_SHAPE_PERSON_F, god_okan: G_SHAPE_PERSON_F,
  crane_king: G_SHAPE_CRANE,
  a_hantei: G_SHAPE_ROBE, nada_megami: G_SHAPE_ROBE,
  guard: G_SHAPE_GUARD, tunnel_mori: G_SHAPE_GUARD, nada_mon: G_SHAPE_GUARD,
  goukaku_daruma: G_SHAPE_DARUMA,
  akahon_dragon: G_SHAPE_DRAGON,
  kensetsunder: G_SHAPE_ROBOT,
};

// id→固定パレット（フラッグシップ級・専用デザインの色。未指定は自動配色gPalette()）
const G_CHAR_PAL = {
  kinjiro: { o: '#8d6e3a', y: '#a67c4a', e: '#3a2a1a', r: '#6b5030', d: '#7a5a35', l: '#5a4025' },
  guard: { c: '#1a3d6e', w: '#ffffff', f: '#f5c9a2', e: '#222222', v: '#ff9a2e', s: '#ffffff', b: '#274b7a', p: '#12283d', g: '#ff3b3b' },
  obaan: { o: '#d8d8d8', y: '#f5c9a2', e: '#222222', r: '#e08a9a', d: '#b39ddb', l: '#8e7cc3' },
  ojiin: { o: '#c9c9c9', y: '#f5c9a2', e: '#222222', r: '#8a8a8a', d: '#7a8b99', l: '#55636e' },
  genba_otton: { o: '#ffd166', y: '#f5c9a2', e: '#222222', r: '#ff9a2e', d: '#1a3d6e', l: '#12283d' },
  super_okan: { o: '#6b4a2f', y: '#f5c9a2', e: '#222222', r: '#ff4466', d: '#e63c82', l: '#c2185b' },
  buru_musashi: { o: '#ffd166', y: '#b71c1c', e: '#222222', d: '#1a1a1a', r: '#ffd166', l: '#1a1a1a' },
  tunnel_mori: { c: '#5a6b5a', w: '#8faa8f', f: '#c9b896', e: '#222222', v: '#4a6b4a', s: '#a8c9a8', b: '#3a4a3a', p: '#2a3a2a', g: '#7fff9a' },
  akapen: { o: '#ff4466', y: '#ff6b81', e: '#222222', r: '#c0392b', d: '#8a8a8a', l: '#8a8a8a' },
  nada_mon: { c: '#1a1a2e', w: '#555577', f: '#d9a066', e: '#ff0000', v: '#2a2a3e', s: '#8888aa', b: '#1a1a2e', p: '#0a0a1a', g: '#6666ff' },
  charisma: { o: '#7c4fff', y: '#f5c9a2', e: '#222222', r: '#ffd166', d: '#2a1a4a', l: '#1a0f33' },
  sairekun: { o: '#ffd166', y: '#f5c9a2', e: '#222222', r: '#c0392b', d: '#5e35b1', l: '#4527a0' },
  a_hantei: { h: '#4a6fa5', f: '#f8d9c0', e: '#222222', r: '#e8f4ff', y: '#38c8f0', g: '#cceeff' },
  manten: { d: '#ffd166', y: '#fffbe8', e: '#222222', r: '#ff4466', l: '#ffd166' },
  gold_otton: { o: '#ffd700', y: '#ffe98a', e: '#222222', r: '#ff8f00', d: '#b8860b', l: '#8a6d00' },
  crane_king: { d: '#37474f', o: '#ffd166', l: '#1a1a1a', y: '#38c8f0', e: '#222222' },
  platina_okan: { o: '#e8e8e8', y: '#f5c9a2', e: '#222222', r: '#c0c0ff', d: '#dcdcff', l: '#b8b8e8' },
  daiya_chicchi: { y: '#e0f7ff', o: '#a8e8ff', e: '#222222', r: '#5ec8e8', d: '#c8f0ff', l: '#7fd8f0' },
  hensachi70: { o: '#f5f5f5', y: '#f0d0b0', e: '#222222', r: '#ffd166', d: '#fffaf0', l: '#e8c85a' },
  akahon_dragon: { d: '#8b0000', o: '#c0392b', y: '#ff6b6b', e: '#ffd166', r: '#ffd166' },
  goukaku_daruma: { d: '#1a1a1a', y: '#d32f2f', e: '#1a1a1a', r: '#fff8e1', o: '#ffd166' },
  nada_megami: { h: '#3a1a5e', f: '#f8d9c0', e: '#222222', r: '#fff6e0', y: '#ffd166', g: '#ffe98a' },
  kensetsunder: { k: '#1a1a1a', o: '#ff9a2e', b: '#4a5568', r: '#ff3b3b', y: '#ffd166' },
  god_chicchi: { y: '#ffb3ff', o: '#b3ffec', e: '#222222', r: '#ffe066', d: '#b3d9ff', l: '#d9b3ff' },
  god_okan: { o: '#fff2b3', y: '#fffaf0', e: '#222222', r: '#ffd166', d: '#ffe98a', l: '#ffca66' },
  god_otton: { o: '#ffd700', y: '#fff2cc', e: '#222222', r: '#ff6b6b', d: '#66d9ff', l: '#b366ff' },
};

function gDrawChar(ctx, ch, ox, oy, s) {
  const rows = G_CHAR_SHAPE[ch.id] || G_TEMPLATE;
  const pal = G_CHAR_PAL[ch.id] || gPalette(ch);
  tDrawSprite(ctx, rows, pal, ox, oy, s);
}
function gDrawSilhouette(ctx, ch, ox, oy, s) {
  const rows = G_CHAR_SHAPE[ch.id] || G_TEMPLATE;
  const pal = G_CHAR_PAL[ch.id] || gPalette(ch);
  const dark = {};
  for (const k in pal) dark[k] = '#2a2f45';
  tDrawSprite(ctx, rows, dark, ox, oy, s);
}

// キャラ図鑑マスタ（75体＋シークレット3体）
const GACHA_CHARS = [
  // ── N（どうぶつ・がくよう品・じゅく道具、33体） ──
  { id:'piyo',         name:'ピヨ太',         rarity:'N', desc:'チッチにあこがれるひよこ。',     voice:'ピヨッ！' },
  { id:'nyankichi',    name:'ニャン吉',       rarity:'N', desc:'気まぐれな学園の人気者。',       voice:'にゃんにゃん！' },
  { id:'wanzou',       name:'ワン蔵',         rarity:'N', desc:'忠犬、いつも一緒に勉強する。',   voice:'ワンワン！' },
  { id:'ponkichi',     name:'ぽん吉',         rarity:'N', desc:'ちょっとおっちょこちょい。',     voice:'ぽんぽこぽん！' },
  { id:'kamekichi',    name:'カメ吉',         rarity:'N', desc:'コツコツ型、実は足がはやい。',   voice:'急がば回れやで' },
  { id:'chun',         name:'チュン',         rarity:'N', desc:'朝はやくから鳴いてくれる。',     voice:'チュンチュン！' },
  { id:'kaerunosuke',  name:'カエル之助',     rarity:'N', desc:'雨の日も元気いっぱい。',         voice:'ケロケロ！' },
  { id:'hamuta',       name:'ハム太',         rarity:'N', desc:'ほおぶくろにお菓子満タン。',     voice:'キュッ！' },
  { id:'kingyohime',   name:'金魚姫',         rarity:'N', desc:'水そうの中のお姫様。',           voice:'パクッ' },
  { id:'kabutomaru',   name:'カブト丸',       rarity:'N', desc:'力持ちの甲虫の戦士。',           voice:'ガオー！' },
  { id:'dangorou',     name:'ダンゴロウ',     rarity:'N', desc:'丸まって身を守る名人。',         voice:'コロン' },
  { id:'keshigomu',    name:'消しゴムくん',   rarity:'N', desc:'まちがいをそっと消してくれる。', voice:'スッキリ！' },
  { id:'enpitsu',      name:'えんぴつ君',     rarity:'N', desc:'芯をとがらせてやる気満々。',     voice:'書くで〜' },
  { id:'randoseru',    name:'ランドセルさん', rarity:'N', desc:'6年間の相棒、頑丈自慢。',       voice:'背負ってこ！' },
  { id:'noteshi',      name:'ノート氏',       rarity:'N', desc:'びっしり書き込まれた自信作。',   voice:'メモメモ' },
  { id:'jougi',        name:'じょうぎマン',   rarity:'N', desc:'まっすぐ線を引くプロ。',         voice:'ピシッ！' },
  { id:'recorder',     name:'リコーダーくん', rarity:'N', desc:'音楽の時間の主役。',             voice:'ピーヒャラ' },
  { id:'cone',         name:'コーンくん',     rarity:'N', desc:'工事現場の道しるべ。',           voice:'こっちやで！' },
  { id:'scoop',        name:'スコップくん',   rarity:'N', desc:'土をほるのが得意。',             voice:'ザクッ！' },
  { id:'gunte',        name:'軍手くん',       rarity:'N', desc:'手を守る現場の相棒。',           voice:'がっちりや' },
  { id:'curry',        name:'給食カレー',     rarity:'N', desc:'みんな大好き金曜日の主役。',     voice:'いいにおい〜' },
  { id:'gyunyu',       name:'牛乳くん',       rarity:'N', desc:'給食の必須アイテム。',           voice:'ごくごく' },
  { id:'jukuben',      name:'塾弁くん',       rarity:'N', desc:'塾の合間のエネルギー補給。',     voice:'おなかすいた〜' },
  { id:'ankicard',     name:'暗記カードちゃん', rarity:'N', desc:'めくるたびに知識が増える。',   voice:'めくって！' },
  { id:'shukudai',     name:'宿題プリント',   rarity:'N', desc:'毎日コツコツ配られる。',         voice:'やってや〜' },
  { id:'fusenhime',    name:'ふせん姫',       rarity:'N', desc:'大事なページに貼りつく。',       voice:'ここ大事！' },
  { id:'timer',        name:'タイマーくん',   rarity:'N', desc:'時間を計るお助け役。',           voice:'ピピッ、終了！' },
  { id:'sharpbushi',   name:'シャーペン侍',   rarity:'N', desc:'芯を一本も無駄にしない。',       voice:'参る！' },
  { id:'compass',      name:'コンパス伯爵',   rarity:'N', desc:'きれいな円を描く紳士。',         voice:'優雅にくるり' },
  { id:'kakomon',      name:'過去問くん',     rarity:'N', desc:'本番の空気を教えてくれる。',     voice:'これ出るで' },
  { id:'keshikasu',    name:'消しカス丸',     rarity:'N', desc:'気づけば机の上にいる。',         voice:'コロコロ' },
  { id:'shitajiki',    name:'下じきさん',     rarity:'N', desc:'ノートの下でしっかり支える。',   voice:'まかせて' },
  { id:'jukubag',      name:'塾バッグ大将',   rarity:'N', desc:'教材をぎっしり詰め込む。',       voice:'重いけど頑張る！' },

  // ── R（工事・学校・じゅくスタッフ、21体） ──
  { id:'guard',        name:'警備員さん',     rarity:'R', desc:'現場の交通整理をしてくれる。',   voice:'とまってくださーい！' },
  { id:'helmet',       name:'ヘル男',         rarity:'R', desc:'現場の安全を守るヒーロー。',     voice:'ご安全に！' },
  { id:'shovel',       name:'ショベルくん',   rarity:'R', desc:'ミニユンボで土をすくう。',       voice:'ガガガッ！' },
  { id:'dump',         name:'ダンプ姫',       rarity:'R', desc:'荷台いっぱいの土砂を運ぶ。',     voice:'任せて！' },
  { id:'mixer',        name:'ミキちゃん',     rarity:'R', desc:'コンクリートをまぜまぜ。',       voice:'ぐるぐる〜' },
  { id:'roller',       name:'ローラー丸',     rarity:'R', desc:'道をぺったんこにならす。',       voice:'ゴロゴロ〜' },
  { id:'fork',         name:'フォークン',     rarity:'R', desc:'重い荷物もひょいっと持ち上げ。', voice:'リフトアップ！' },
  { id:'kocho',        name:'校長せんせい',   rarity:'R', desc:'朝礼のお話がちょっと長い。',     voice:'えー、それではー' },
  { id:'kyoto',        name:'教頭せんせい',   rarity:'R', desc:'縁の下の力持ち。',               voice:'しっかりね' },
  { id:'kyushoku',     name:'給食のおばちゃん', rarity:'R', desc:'おかわりをよそってくれる。',   voice:'おかわりある？' },
  { id:'kinjiro',      name:'金次郎ぞう',     rarity:'R', desc:'歩きながら本を読む勤勉家。',     voice:'こつこつが一番や' },
  { id:'hoken',        name:'ほけん室のせんせい', rarity:'R', desc:'けがも心もケアしてくれる。', voice:'だいじょうぶ？' },
  { id:'soroban',      name:'そろばん仙人',   rarity:'R', desc:'暗算の達人、指がはやい。',       voice:'願いましては〜' },
  { id:'jisho',        name:'辞書ハカセ',     rarity:'R', desc:'分厚い辞書を軽々めくる。',       voice:'調べてみよか' },
  { id:'tobibako',     name:'とび箱マスター', rarity:'R', desc:'体育の日の主役。',               voice:'とべ！とべ！' },
  { id:'jukucho',      name:'塾長せんせい',   rarity:'R', desc:'熱血指導で有名。',               voice:'気合いや！' },
  { id:'tutor',        name:'チューターお姉さん', rarity:'R', desc:'やさしく質問に答えてくれる。', voice:'一緒に解こか' },
  { id:'keisan_oni',   name:'計算テストの鬼', rarity:'R', desc:'制限時間はいつも厳しい。',       voice:'時間やで！' },
  { id:'moshi',        name:'模試判定マン',   rarity:'R', desc:'A〜Eの判定を告げる。',           voice:'今回の判定は…' },
  { id:'jishu',        name:'自習室のヌシ',   rarity:'R', desc:'誰よりも長く居座る。',           voice:'静かにするで' },
  { id:'hensachi',     name:'偏差値くん',     rarity:'R', desc:'上下する数字そのもの。',         voice:'今日は上がったで！' },

  // ── SR（家族・現場・じゅくエース、12体） ──
  { id:'obaan',        name:'オバーン',       rarity:'SR', desc:'優しい笑顔のおばあちゃん。',     voice:'無理せんとな' },
  { id:'ojiin',        name:'オジーン',       rarity:'SR', desc:'昔話が得意なおじいちゃん。',     voice:'わしの若い頃はな〜' },
  { id:'genba_otton',  name:'現場オットン',   rarity:'SR', desc:'作業服姿の頼れる父。',           voice:'現場は任せとけ！' },
  { id:'super_okan',   name:'スーパーオカーン', rarity:'SR', desc:'割烹着でなんでもこなす。',     voice:'おたま無双や！' },
  { id:'buru_musashi', name:'ブル武蔵',       rarity:'SR', desc:'地面をならす力の化身。',         voice:'ならしたるで！' },
  { id:'tunnel_mori',  name:'トンネル守',     rarity:'SR', desc:'山をつらぬく守り神。',           voice:'貫通や！' },
  { id:'akapen',       name:'赤ペン先生',     rarity:'SR', desc:'びっしり丸をつけてくれる。',     voice:'よう書けたな' },
  { id:'nada_mon',     name:'灘の門番',       rarity:'SR', desc:'合格の扉を守っている。',         voice:'覚悟はええか' },
  { id:'charisma',     name:'カリスマ講師',   rarity:'SR', desc:'一言で教室の空気を変える。',     voice:'ここ、出るで' },
  { id:'sairekun',     name:'最レ王',         rarity:'SR', desc:'最高レベル問題を極めた者。',     voice:'この程度朝飯前や' },
  { id:'a_hantei',     name:'A判定の女神',   rarity:'SR', desc:'合格をそっと後押しする。',       voice:'きっと大丈夫' },
  { id:'manten',       name:'満点答案',       rarity:'SR', desc:'赤字ゼロの奇跡の一枚。',         voice:'パーフェクトや' },

  // ── UR（伝説級、9体） ──
  { id:'gold_otton',    name:'ゴールドオットン', rarity:'UR', desc:'金色に輝く伝説の父。',         voice:'常在戦場、黄金の意志！' },
  { id:'crane_king',    name:'クレーンキング',   rarity:'UR', desc:'現場を見下ろす鋼鉄の王。',     voice:'つり上げたるで！' },
  { id:'platina_okan',  name:'プラチナオカーン', rarity:'UR', desc:'白金の割烹着をまとう母。',     voice:'愛情も無限大や' },
  { id:'daiya_chicchi', name:'ダイヤチッチ',     rarity:'UR', desc:'ダイヤより硬い意志のひな。',   voice:'ピカーッ！' },
  { id:'hensachi70',    name:'偏差値70仙人',     rarity:'UR', desc:'極限の領域に住む賢者。',       voice:'その先を見せたる' },
  { id:'akahon_dragon', name:'赤本ドラゴン',     rarity:'UR', desc:'過去問を食べて育った竜。',     voice:'全問暗記したで' },
  { id:'goukaku_daruma', name:'合格だるま大明神', rarity:'UR', desc:'願いを一つだけ叶える。',      voice:'目に魂を入れよ' },
  { id:'nada_megami',   name:'灘中合格の大女神', rarity:'UR', desc:'灘中合格を約束する最強の女神。', voice:'きみの努力、ぜんぶ見てたで' },
  { id:'kensetsunder',  name:'無敵重機ロボ ケンセツンダー', rarity:'UR', desc:'全部の重機が合体した伝説のロボ。', voice:'ケンセツンダー、参上！' },

  // ── シークレット（排出なし・図鑑コンプ報酬） ──
  { id:'god_chicchi', name:'神チッチ',   rarity:'UR', secret:true, desc:'N・Rを極めた者だけが出会える。', voice:'ピピーッ！！！' },
  { id:'god_okan',    name:'神オカーン', rarity:'UR', secret:true, desc:'SR・URを極めた者だけが出会える。', voice:'全部お見通しやで' },
  { id:'god_otton',   name:'神オットン', rarity:'UR', secret:true, desc:'ずかんコンプリートの証。',       voice:'灘中合格、間違いなしや！' },
];

const GACHA_RATES = { N: 60, R: 28, SR: 9, UR: 3 };
const DUPE_REFUND = { N: 5, R: 10, SR: 20, UR: 50 };
const GACHA_COST = 30, GACHA_COST_10 = 270;
const GACHA_PITY = 30; // 30連引いてもURが出なければ次で確定
const RARITY_ORDER = { N: 0, R: 1, SR: 2, UR: 3 };

function charsByRarity(rarity) { return GACHA_CHARS.filter(c => c.rarity === rarity && !c.secret); }

function getGacha() {
  const g = JSON.parse(localStorage.getItem('gacha') || '{}');
  return Object.assign({ owned: {}, pulls: 0, pityUR: 0, compRewarded: [], secretUnlocked: [] }, g);
}
function saveGachaData(g) { localStorage.setItem('gacha', JSON.stringify(g)); }

function rollRarity() {
  const r = Math.random() * 100;
  if (r < GACHA_RATES.UR) return 'UR';
  if (r < GACHA_RATES.UR + GACHA_RATES.SR) return 'SR';
  if (r < GACHA_RATES.UR + GACHA_RATES.SR + GACHA_RATES.R) return 'R';
  return 'N';
}

function rollGacha(g, forceRarity) {
  const rarity = forceRarity || (g.pityUR >= GACHA_PITY - 1 ? 'UR' : rollRarity());
  const pool = charsByRarity(rarity);
  const unowned = pool.filter(c => !g.owned[c.id]);
  const pick = unowned.length ? unowned[Math.floor(Math.random() * unowned.length)]
                               : pool[Math.floor(Math.random() * pool.length)];
  const isDupe = !!g.owned[pick.id];
  g.owned[pick.id] = (g.owned[pick.id] || 0) + 1;
  g.pulls++;
  g.pityUR = rarity === 'UR' ? 0 : g.pityUR + 1;
  return { char: pick, isDupe };
}

// n回ガチャを回す（コイン消費・保存込み）。10連はSR以上を1体保証
function doGacha(n) {
  const cost = n === 10 ? GACHA_COST_10 : GACHA_COST;
  if (getCoins() < cost) { showToast('コインが足りへんで！勉強してためよう！'); return null; }
  addCoins(-cost);
  const g = getGacha();
  const results = [];
  let gotSRPlus = false;
  for (let i = 0; i < n; i++) {
    const forceRarity = (n === 10 && i === 9 && !gotSRPlus) ? (Math.random() < 0.3 ? 'UR' : 'SR') : null;
    const res = rollGacha(g, forceRarity);
    if (RARITY_ORDER[res.char.rarity] >= RARITY_ORDER.SR) gotSRPlus = true;
    let refund = 0;
    if (res.isDupe) { refund = DUPE_REFUND[res.char.rarity]; addCoins(refund); }
    results.push({ char: res.char, isDupe: res.isDupe, refund });
  }
  saveGachaData(g);
  return results;
}

// 図鑑コンプ報酬・シークレット解放（ガチャ結果表示後に呼ぶ。冪等）
function checkZukanRewards() {
  const g = getGacha();
  const rewardMap = { N: 50, R: 80, SR: 100, UR: 150 };
  ['N', 'R', 'SR', 'UR'].forEach(rarity => {
    const pool = charsByRarity(rarity);
    const owned = pool.filter(c => g.owned[c.id]).length;
    if (owned >= pool.length && !g.compRewarded.includes(rarity)) {
      g.compRewarded.push(rarity);
      addCoins(rewardMap[rarity]);
      showGamiModal({ emoji: '📖', title: `${rarity}レア図鑑コンプ！`, lines: [`${rarity}レアぜんぶ集めたで！`, `🪙${rewardMap[rarity]}まいゲット！`] });
    }
  });
  const secretDefs = [
    { id: 'god_chicchi', need: ['N', 'R'] },
    { id: 'god_okan',    need: ['SR', 'UR'] },
    { id: 'god_otton',   need: 'all' },
  ];
  const totalOwned = GACHA_CHARS.filter(c => !c.secret && g.owned[c.id]).length;
  const totalAll = GACHA_CHARS.filter(c => !c.secret).length;
  secretDefs.forEach(def => {
    if (g.secretUnlocked.includes(def.id)) return;
    const ok = def.need === 'all' ? totalOwned >= totalAll : def.need.every(r => g.compRewarded.includes(r));
    if (ok) {
      g.secretUnlocked.push(def.id);
      g.owned[def.id] = 1;
      const ch = GACHA_CHARS.find(c => c.id === def.id);
      showGamiModal({ emoji: '✨', title: 'シークレット解放！', lines: [`${ch.name}が図鑑に加わった！`, `「${ch.voice}」`] });
    }
  });
  saveGachaData(g);
}

// ── ガチャ画面 ────────────────────────────────────────────
function initGacha() {
  document.getElementById('gacha-coins').textContent = getCoins();
  document.getElementById('gacha-btn-1').onclick = () => runGachaAnim(1);
  document.getElementById('gacha-btn-10').onclick = () => runGachaAnim(10);
  document.getElementById('gacha-btn-zukan').onclick = () => { initZukan(); showScreen('zukan'); };
  document.querySelectorAll('#screen-gacha [data-back="subject"]').forEach(b => { b.onclick = () => showScreen('subject'); });
  document.getElementById('gacha-capsule').className = 'gacha-capsule';
  document.getElementById('gacha-result').classList.add('hidden');
  const cv = document.getElementById('gacha-canvas');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}

async function runGachaAnim(n) {
  const cost = n === 10 ? GACHA_COST_10 : GACHA_COST;
  if (getCoins() < cost) { showToast('コインが足りへんで！勉強してためよう！'); return; }
  const btn1 = document.getElementById('gacha-btn-1'), btn10 = document.getElementById('gacha-btn-10');
  btn1.disabled = true; btn10.disabled = true;

  const results = doGacha(n);
  document.getElementById('gacha-coins').textContent = getCoins();
  if (!results) { btn1.disabled = false; btn10.disabled = false; return; }

  const capsule = document.getElementById('gacha-capsule');
  const maxRarity = results.reduce((m, r) => RARITY_ORDER[r.char.rarity] > RARITY_ORDER[m] ? r.char.rarity : m, 'N');
  capsule.className = 'gacha-capsule shake-' + maxRarity;
  tSfx('gachaShake');
  await new Promise(r => setTimeout(r, { N: 800, R: 1200, SR: 1800, UR: 2500 }[maxRarity]));
  capsule.classList.add('open-' + maxRarity);
  tSfx(maxRarity === 'UR' ? 'gachaUR' : maxRarity === 'SR' ? 'gachaSR' : 'gachaOpen');
  await new Promise(r => setTimeout(r, 350));

  await showGachaResults(results);
  checkZukanRewards();
  document.getElementById('gacha-coins').textContent = getCoins();

  capsule.className = 'gacha-capsule';
  btn1.disabled = false; btn10.disabled = false;
}

function showGachaResults(results) {
  return new Promise(resolveAll => {
    const box = document.getElementById('gacha-result');
    const cv = document.getElementById('gacha-canvas');
    const ctx = cv.getContext('2d');
    box.classList.remove('hidden');

    let i = 0;
    const showOne = () => {
      const { char, isDupe, refund } = results[i];
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = { N: '#3a3f55', R: '#1c3f7a', SR: '#7a5a10', UR: '#4a1c7a' }[char.rarity];
      ctx.fillRect(0, 0, cv.width, cv.height);
      gDrawChar(ctx, char, cv.width / 2 - 44, 14, 8);

      const rarityEl = document.getElementById('gacha-result-rarity');
      rarityEl.textContent = char.rarity;
      rarityEl.className = 'gacha-rarity-badge rarity-' + char.rarity;
      const tagEl = document.getElementById('gacha-result-tag');
      tagEl.textContent = isDupe ? `かぶり！🪙+${refund}` : 'NEW!';
      tagEl.className = 'gacha-tag ' + (isDupe ? 'dupe' : 'new');
      document.getElementById('gacha-result-name').textContent = char.name;
      document.getElementById('gacha-result-desc').textContent = char.desc;
      document.getElementById('gacha-result-count').textContent = `${i + 1} / ${results.length}`;
      const tapBtn = document.getElementById('gacha-btn-tap');
      tapBtn.textContent = i === results.length - 1 ? 'かくにん！' : '次へ ›';
      tapBtn.onclick = () => {
        i++;
        if (i < results.length) showOne();
        else { box.classList.add('hidden'); resolveAll(); }
      };
    };
    showOne();
  });
}

// ── 図鑑画面 ──────────────────────────────────────────────
function initZukan() {
  const g = getGacha();
  document.querySelectorAll('#screen-zukan [data-back="gacha"]').forEach(b => { b.onclick = () => { initGacha(); showScreen('gacha'); }; });

  const totalOwned = GACHA_CHARS.filter(c => !c.secret && g.owned[c.id]).length;
  const totalAll = GACHA_CHARS.filter(c => !c.secret).length;
  document.getElementById('zukan-pct').textContent = `${totalOwned} / ${totalAll}`;
  document.getElementById('zukan-bar').style.width = `${Math.round(totalOwned / totalAll * 100)}%`;

  const grid = document.getElementById('zukan-grid');
  grid.innerHTML = '';
  [['N', 'N'], ['R', 'R'], ['SR', 'SR'], ['UR', 'UR'], ['秘', '？？？ シークレット']].forEach(([rarity, label]) => {
    const list = rarity === '秘' ? GACHA_CHARS.filter(c => c.secret) : charsByRarity(rarity);
    if (!list.length) return;
    const h = document.createElement('h3');
    h.className = 'zukan-rarity-h rarity-' + (rarity === '秘' ? 'UR' : rarity);
    h.textContent = rarity === '秘' ? label : `${rarity}レア`;
    grid.appendChild(h);
    const row = document.createElement('div');
    row.className = 'zukan-row';
    list.forEach(ch => {
      const owned = !!g.owned[ch.id];
      const cell = document.createElement('button');
      cell.className = 'zukan-cell' + (owned ? '' : ' unowned');
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      cell.appendChild(cv);
      const label2 = document.createElement('span');
      label2.textContent = owned ? ch.name : '？？？';
      cell.appendChild(label2);
      const ctx = cv.getContext('2d');
      if (owned) gDrawChar(ctx, ch, 8, 4, 6); else gDrawSilhouette(ctx, ch, 8, 4, 6);
      cell.onclick = () => showZukanModal(ch, owned, g.owned[ch.id] || 0);
      row.appendChild(cell);
    });
    grid.appendChild(row);
  });
}

function showZukanModal(ch, owned, count) {
  const modal = document.getElementById('zukan-modal');
  const cv = document.getElementById('zukan-modal-canvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (owned) gDrawChar(ctx, ch, cv.width / 2 - 55, 8, 10); else gDrawSilhouette(ctx, ch, cv.width / 2 - 55, 8, 10);
  document.getElementById('zukan-modal-rarity').textContent = ch.secret ? 'シークレット' : ch.rarity;
  document.getElementById('zukan-modal-rarity').className = 'gacha-rarity-badge rarity-' + (ch.secret ? 'UR' : ch.rarity);
  document.getElementById('zukan-modal-name').textContent = owned ? ch.name : '？？？';
  document.getElementById('zukan-modal-desc').textContent = owned ? ch.desc : 'まだ出会っていない…';
  document.getElementById('zukan-modal-voice').textContent = owned ? `「${ch.voice}」` : '';
  document.getElementById('zukan-modal-count').textContent = owned ? `所持数：${count}` : '';
  modal.classList.remove('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('zukan-modal-close').onclick = () => document.getElementById('zukan-modal').classList.add('hidden');
});

// ============================================================
// ゲーミフィケーション（達成率・称号・ログインボーナス・アイテム）
// ============================================================

// 教科→カテゴリ→問題数（データは静的なのでハードコード。問題追加時はここを更新）
const QUESTION_COUNTS = {
  kokugo: { kotowaza: 654, kanyoku: 651, yojijukugo: 582, gairaigo: 587, kanji_kaki: 480, kanji_yomi: 480,
            kokugo_keigo: 232, kokugo_goi: 447, kokugo_bushu: 389, kokugo_bungaku: 359 },   // 4,861
  sansu:  { keisan: 874, bun: 1100, zu: 547, kisoku: 605, tokusan: 466, baai: 888, kazu: 400,
            wariai: 537, hayasa: 397, rittai: 256 },                                         // 6,070
  rika:   { shokubutsu: 960, doubutsu: 855, jintai: 105, sora: 733, tenki: 217, mono: 804, kitai: 116,
            daichi: 490, suiyoueki: 488, denki: 482, chikara: 552, hikari_oto: 156 },        // 5,958
  shakai: { kokudo: 640, sangyo: 649, rekishi: 640, komin: 645 },                            // 2,574
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
  rs: ['rika:suiyoueki'], rc: ['rika:chikara'], ho: ['rika:hikari_oto'],
  tk: ['rika:tenki'], kt: ['rika:kitai'], jt: ['rika:jintai'],
  ss: ['shakai:sangyo'], sm: ['shakai:komin'],
};

const TITLES = [
  { name: '普通の小学生', pct: 0,  icon: '🎒' },
  { name: '優等生',       pct: 1,  icon: '📝' },
  { name: 'Hクラス',      pct: 3,  icon: '📗' },
  { name: 'SHHクラス',    pct: 5,  icon: '📔' },
  { name: 'SHSクラス',    pct: 7,  icon: '📒' },
  { name: 'Sクラス',      pct: 9,  icon: '📘' },
  { name: 'VSSクラス',    pct: 12, icon: '📓' },
  { name: 'VSVクラス',    pct: 15, icon: '🔖' },
  { name: '最レ受講生',   pct: 18, icon: '📙' },
  { name: 'V2クラス',     pct: 23, icon: '📕' },
  { name: 'V1クラス',     pct: 28, icon: '🏵️' },
  { name: '100傑',        pct: 35, icon: '🥉' },
  { name: '灘合2組',      pct: 45, icon: '🥈' },
  { name: '灘合1組',      pct: 55, icon: '🏆' },
  { name: '10傑',         pct: 72, icon: '🥇' },
  { name: 'スーパーウルトラ神ゴッド', pct: 95, icon: '👑' },
];

const ITEM_DEFS = {
  bomb:   { icon: '💣', label: 'ボム',     desc: 'テトリス：下2行を消す' },
  slow:   { icon: '🐢', label: 'スロー',   desc: 'テトリス：15秒ゆっくり' },
  search: { icon: '🔍', label: 'サーチ',   desc: 'スイーパー：安全なマスを1つ開く' },
  shield: { icon: '🛡', label: 'おまもり', desc: 'スイーパー：ゴキブリを1回セーフ' },
  wing:   { icon: '🪽', label: 'つばさ',   desc: 'チッチジャンプ：6秒ミス無効で浮く' },
  rocket: { icon: '🚀', label: 'ロケット', desc: 'チッチジャンプ：一気に高くジャンプ' },
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
const PLAY_SCREENS = ['quiz', 'fill', 'kanji', 'sansu-quiz', 'drill'];
let playStart = null;
let currentScreenId = '';
function flushPlayTime() {
  if (playStart) { addPlayTime((Date.now() - playStart) / 1000); playStart = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { flushPlayTime(); backupLocalData(); }
  else if (PLAY_SCREENS.includes(currentScreenId) && !playStart) playStart = Date.now();
});
window.addEventListener('pagehide', () => { flushPlayTime(); backupLocalData(); });

// ── アイテム ──────────────────────────────────────────────
function getItems() {
  return JSON.parse(localStorage.getItem('items') || '{"bomb":0,"slow":0,"search":0,"shield":0,"wing":0,"rocket":0}');
}
function addItem(kind, n) {
  const items = getItems();
  items[kind] = Math.max(0, Math.min(99, (items[kind] || 0) + n));
  localStorage.setItem('items', JSON.stringify(items));
  return items[kind];
}
function randomItemKind() {
  const kinds = Object.keys(ITEM_DEFS);
  return kinds[Math.floor(Math.random() * kinds.length)];
}

// ── コイン（ガチャ用） ────────────────────────────────────
function getCoins() {
  return Math.max(0, Math.min(9999, Number(localStorage.getItem('coins') || 0)));
}
function addCoins(n) {
  const v = Math.max(0, Math.min(9999, getCoins() + n));
  localStorage.setItem('coins', String(v));
  return v;
}
const COIN_DAILY_CAP = 100;
const COIN_PER_Q_CAP = 2;
function getCoinDaily() {
  const d = JSON.parse(localStorage.getItem('coinDaily') || 'null');
  if (!d || d.date !== todayStr()) return { date: todayStr(), earned: 0, perQ: {}, cappedNotified: false };
  return d;
}
function saveCoinDaily(d) { localStorage.setItem('coinDaily', JSON.stringify(d)); }

let coinSessionEarned = 0;

// 正解のたびにrecordResultから呼ばれる。同一問題1日2枚まで・初正解+2ボーナス・1日上限100枚
function awardCoinForAnswer(id, isFirst) {
  const d = getCoinDaily();
  const used = d.perQ[id] || 0;
  if (used >= COIN_PER_Q_CAP || d.earned >= COIN_DAILY_CAP) { saveCoinDaily(d); return; }
  const gain = Math.min(1 + (isFirst ? 2 : 0), COIN_DAILY_CAP - d.earned);
  d.perQ[id] = used + 1;
  d.earned += gain;
  addCoins(gain);
  coinSessionEarned += gain;
  if (d.earned >= COIN_DAILY_CAP && !d.cappedNotified) {
    d.cappedNotified = true;
    showToast('🪙 今日はもう満タンや！また明日な！');
  }
  saveCoinDaily(d);
}

// セッション終了時（満点+10）。maybeAwardPerfectの直後に呼ぶ
function awardSessionCoins(pct, totalQ) {
  if (pct >= 100 && totalQ >= 5) { addCoins(10); coinSessionEarned += 10; }
  const banner = document.getElementById('result-coin-banner');
  if (banner) {
    if (coinSessionEarned > 0) {
      banner.textContent = `🪙 このセッションで${coinSessionEarned}まいゲット！（いま${getCoins()}まい）`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
  coinSessionEarned = 0;
}

// ── 息抜きゲームの遊び券（勉強しないと遊べないようにする） ──
function getGameTickets() {
  return Math.max(0, Math.min(99, Number(localStorage.getItem('gameTickets') || 0)));
}
function addGameTickets(n) {
  const v = Math.max(0, Math.min(99, getGameTickets() + n));
  localStorage.setItem('gameTickets', String(v));
  updateGameTicketBadge();
  return v;
}
function updateGameTicketBadge() {
  const el = document.getElementById('game-ticket-badge');
  if (el) el.textContent = `🎟 ${getGameTickets()}枚`;
}

const TICKET_DAILY_CAP = 8;
function getTicketDaily() {
  const d = JSON.parse(localStorage.getItem('ticketDaily') || 'null');
  if (!d || d.date !== todayStr()) return { date: todayStr(), earned: 0 };
  return d;
}
function saveTicketDaily(d) { localStorage.setItem('ticketDaily', JSON.stringify(d)); }

// セッション終了時（5問以上で1枚、1日8枚まで）に呼ぶ
function awardSessionTicket(totalQ) {
  if (totalQ < 5) return;
  const d = getTicketDaily();
  if (d.earned >= TICKET_DAILY_CAP) return;
  d.earned += 1;
  saveTicketDaily(d);
  addGameTickets(1);
  showToast(`🎟 遊び券を1まいゲット！（のこり${getGameTickets()}まい）`, 2500);
}

// 息抜きゲームに入る前に呼ぶ。券がなければ入れずtoastだけ出す
function spendGameTicket() {
  if (getGameTickets() <= 0) {
    showToast('🎟 遊び券が足りないよ！問題を解いてゲットしよう！', 2500);
    return false;
  }
  addGameTickets(-1);
  return true;
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
  addCoins(10);
  showGamiModal({
    emoji: '🔥',
    title: lb.streak >= 2 ? `${lb.streak}日連続ログイン！` : 'ログインボーナス！',
    lines: [note, `お助けアイテム ${got.join(' ')} をゲット！`, '🪙10まいもらった！', 'テトリスで使えるで！'],
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
      // 国語は全カテゴリの学年別集計
      for (const cat of Object.keys(CATEGORIES)) {
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

// 難易度ボタン用: 全問クリアで✅、途中なら「12/20」の進み具合を表示
function setDiffProgress(btn, cleared, total) {
  let b = btn.querySelector('.clear-badge');
  if (total > 0 && cleared >= total) {
    if (!b) { b = document.createElement('span'); b.className = 'clear-badge'; btn.appendChild(b); }
    b.textContent = '✅';
    b.classList.remove('diff-prog');
  } else if (cleared > 0) {
    if (!b) { b = document.createElement('span'); b.className = 'clear-badge'; btn.appendChild(b); }
    b.textContent = `${cleared}/${total}`;
    b.classList.add('diff-prog');
  } else if (b) {
    b.remove();
  }
}

// ── 難易度ボタンの✅（選択中の学年×単元で全問クリア） ──────
async function ensureSansuFile(subject, cat) {
  const key = `${subject}-${cat}`;
  if (!sansuCache[key]) {
    const fileMap = subject === 'rika' ? RIKA_FILES : subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES;
    const res = await fetch(fileMap[cat]);
    sansuCache[key] = await res.json();
  }
  return sansuCache[key];
}

async function renderDiffBadgesSansu() {
  const subject = sansuState.subject;
  const btnSel = {
    sansu: '#screen-sansu-home .diff-btn',
    rika: '.rika-diff-btn',
    shakai: '.shakai-diff-btn',
  }[subject];
  const btns = document.querySelectorAll(btnSel);
  btns.forEach(b => setClearBadge(b, false));
  const cat = sansuState.cat, grade = sansuState.grade;
  if (!cat || !grade) return;
  try {
    const sets = buildClearedSets();
    const byDiff = {};
    const tally = (q, set) => {
      if (q.grade !== grade) return;
      const d = q.difficulty;
      if (!byDiff[d]) byDiff[d] = { total: 0, cleared: 0 };
      byDiff[d].total++;
      if (set && set.has(q.id)) byDiff[d].cleared++;
    };
    const cats = cat === 'mix'
      ? Object.keys(subject === 'rika' ? RIKA_FILES : subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES)
      : [cat];
    for (const c of cats) {
      const qs = await ensureSansuFile(subject, c);
      const set = sets[`${subject}:${c}`];
      qs.forEach(q => tally(q, set));
    }
    // 非同期の間に選択が変わっていたら破棄
    if (sansuState.cat !== cat || sansuState.grade !== grade || sansuState.subject !== subject) return;
    btns.forEach(b => {
      const info = byDiff[Number(b.dataset.diff)] || { total: 0, cleared: 0 };
      setDiffProgress(b, info.cleared, info.total);
    });
    // 難易度5（連鎖問題）は問題が無ければロック
    const zoneId = { sansu: 'sansu-start-zone', rika: 'rika-start-zone', shakai: 'shakai-start-zone' }[subject];
    await updateChainDiffButton(btns, subject, cat, grade, () => {
      sansuState.diff = null;
      if (zoneId) document.getElementById(zoneId).classList.add('hidden');
    });
  } catch (e) { /* バッジは飾りなので失敗しても無視 */ }
}

async function renderDiffBadgesKokugo() {
  const btns = document.querySelectorAll('.kokugo-diff-btn');
  btns.forEach(b => setClearBadge(b, false));
  const cat = state.selectedCat;
  if (!cat || !CATEGORIES[cat]) return;
  const isKanji = KANJI_CATS.includes(cat);
  const grade = state.grade;
  if (!grade) return;
  try {
    const qs = await loadQuestions(cat);
    if (state.selectedCat !== cat || state.grade !== grade) return;
    const sets = buildClearedSets();
    const set = sets[`kokugo:${cat}`];
    const byDiff = {};
    let total = 0, cleared = 0;
    qs.forEach(q => {
      if (q.id && q.id[0] === 'c') return;              // カスタム問題は対象外
      if (q.grade !== grade) return;
      const ok = !!(set && set.has(q.id));
      total++; if (ok) cleared++;
      const d = q.difficulty;
      if (!d) return;
      if (!byDiff[d]) byDiff[d] = { total: 0, cleared: 0 };
      byDiff[d].total++;
      if (ok) byDiff[d].cleared++;
    });
    btns.forEach(b => {
      if (b.dataset.diff === 'all') {
        setDiffProgress(b, cleared, total);
      } else {
        const info = byDiff[Number(b.dataset.diff)] || { total: 0, cleared: 0 };
        setDiffProgress(b, info.cleared, info.total);
      }
    });
    // 難易度5（連鎖問題）は問題が無ければロック
    await updateChainDiffButton(btns, 'kokugo', cat, grade, () => {
      state.selectedDiff = null;
      document.getElementById('start-zone').classList.add('hidden');
    });
  } catch (e) { /* 無視 */ }
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

// ============================================================
// チッチジャンプ（息抜きミニゲーム3）
// ============================================================

const J_W = 260, J_H = 420;
const J_PLAYER_W = 24, J_PLAYER_H = 34, J_PLAYER_S = 2.4;
const J_PLATFORM_W = 54, J_PLATFORM_MIN_W = 30, J_PLATFORM_H = 12;
const J_PLATFORM_SHRINK_SCORE = 300; // このスコアで最小幅まで縮む
const J_GRAVITY = 0.32;
const J_JUMP_V = -9.5;
const J_ROCKET_V = -16;
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
const J_SPACE_M = 1500;        // これ以上は宇宙（じゃま役がタカ→宇宙人に変わる）
const J_STATION_M = 2000;      // 2000mあたりで宇宙ステーションが背景を通過
const J_UFO_M = 2500;          // 2500mあたりでUFOが背景を通過
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
    btn.onclick = () => jumpUseItem(btn.dataset.item);
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
  area.addEventListener('pointerdown', e => {
    if (isControl(e)) return;
    e.preventDefault();
    jumpState.dragging = true;
    setFromEvent(e);
  });
  area.addEventListener('pointermove', e => { if (jumpState.dragging) setFromEvent(e); });
  const stop = () => { jumpState.dragging = false; };
  area.addEventListener('pointerup', stop);
  area.addEventListener('pointerleave', stop);
  area.addEventListener('pointercancel', stop);
}

function startJump() {
  stopJumpLoop();
  jumpState.platforms = [];
  jumpState.coins = [];
  jumpState.score = 0;
  jumpState.maxHeight = 0;
  jumpState.starsCollected = 0;
  jumpState.over = false;
  jumpState.wingUntil = 0;
  jumpState.barrierUntil = 0;
  jumpState.ending = false;
  jumpState.hawk = null;
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

  if (wingOn) {
    p.vy = J_WING_V;
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
  } else if (jumpState.score >= J_HAWK_MIN_SCORE) {
    jumpState.hawkCooldown--;
    if (jumpState.hawkCooldown <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      jumpState.hawk = { x: dir === 1 ? -J_HAWK_SIZE : J_W + J_HAWK_SIZE, y: 40 + Math.random() * (J_H * 0.5), dir };
      jSfx('hawkWarn');
      jumpChars.cheer(jumpState.score >= J_SPACE_M ? '👽 宇宙人や！じゃまするで！' : '🦅 タカや！気をつけて！', 1500);
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

  if (jumpState.hawk) {
    const h = jumpState.hawk;
    // 宇宙（1500m以上）ではじゃま役がタカ→宇宙人に
    const emoji = jumpState.score >= J_SPACE_M ? '👽' : '🦅';
    ctx.save();
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (h.dir === 1) { ctx.translate(h.x, h.y); ctx.scale(-1, 1); ctx.fillText(emoji, 0, 0); }
    else { ctx.fillText(emoji, h.x, h.y); }
    ctx.restore();
  }

  const wingOn = now < jumpState.wingUntil;
  const barrierOn = now < jumpState.barrierUntil;
  const px = jumpState.player.x, py = jumpState.player.y;
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
  const glow = wingOn || barrierOn;
  // 羽ばたき：いつも速くバタバタ。つばさ発動中はさらに速く
  const flapMs = wingOn ? 45 : 65;
  const frame = Math.floor(now / flapMs) % 2 ? sp.flapUp : sp.flapDown;
  if (glow) { ctx.save(); ctx.shadowColor = wingOn ? '#ffd166' : '#ff8cbe'; ctx.shadowBlur = 12; }
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
    jumpState.player.vy = J_ROCKET_V;
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
    case 'rocket': tTone(160, 0.3, 'sawtooth', 0.12, 0, 900); break;
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

// ============================================================
// ミニゲーム共通スコアランキングモーダル
// ============================================================

function showGameRanking(game, title, dir) {
  const modal = document.getElementById('game-rank-modal');
  document.getElementById('game-rank-title').textContent = `🏆 ${title}`;
  const list = document.getElementById('game-rank-list');
  list.innerHTML = '<p class="record-rank-empty">読み込み中…</p>';
  modal.classList.remove('hidden');
  const fmt = dir === 'min' ? (v => `${v}秒`) : (v => Number(v).toLocaleString());
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
