// ============================================================
// 定数・設定
// ============================================================

const CATEGORIES = {
  kotowaza:   { label: 'ことわざ',   file: 'data/kotowaza.json' },
  kanyoku:    { label: '慣用句',     file: 'data/kanyoku.json'  },
  yojijukugo: { label: '四字熟語', file: 'data/yojijukugo.json'},
  gairaigo:   { label: '外来語',   file: 'data/gairaigo.json'  }
};

const MODES = {
  flash: 'フラッシュカード',
  quiz:  '四択クイズ',
  fill:  '虫食い問題'
};

// ============================================================
// 状態管理
// ============================================================

const state = {
  nickname: '',
  selectedCat: null,
  selectedMode: null,
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

function saveNickname(name) { localStorage.setItem('nickname', name); }
function getNickname() { return localStorage.getItem('nickname') || ''; }

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
  state.weakOnly     = false;
  document.getElementById('start-zone').classList.add('hidden');
  document.getElementById('home-nickname').textContent = state.nickname;

  // カテゴリ正解率表示（キャッシュ済みのみ）
  Object.keys(CATEGORIES).forEach(cat => {
    const rate = getCategoryRate(cat);
    const el = document.getElementById('rate-' + cat);
    el.textContent = rate !== null ? rate + '% 正解' : '';
  });

  // カテゴリ選択
  document.querySelectorAll('.cat-card').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedCat = btn.dataset.cat;
      state.weakOnly = false;
      maybeShowStart();
    };
  });

  // モード選択
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedMode = btn.dataset.mode;
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
  document.getElementById('btn-change-user').onclick = () => {
    localStorage.removeItem('nickname');
    state.nickname = '';
    document.getElementById('nickname-input').value = '';
    showScreen('nickname');
  };
}

function maybeShowStart() {
  const zone = document.getElementById('start-zone');
  if (!state.selectedCat || !state.selectedMode) { zone.classList.add('hidden'); return; }
  zone.classList.remove('hidden');
  document.getElementById('start-cat-label').textContent = CATEGORIES[state.selectedCat].label;
  document.getElementById('start-mode-label').textContent = MODES[state.selectedMode];
}

document.getElementById('btn-start').onclick = async () => {
  showLoading();
  try {
    const all = await loadQuestions(state.selectedCat);
    let pool = state.weakOnly ? getWeakItems(state.selectedCat) : shuffle([...all]);
    const countSel = document.getElementById('q-count').value;
    if (countSel !== 'all') pool = pool.slice(0, parseInt(countSel, 10));
    state.sessionQs = pool;
    state.questions  = all;
    state.current = 0;
    state.correct = 0;
    state.wrong   = 0;
    state.retryQueue = [];

    if (!pool.length) { showToast('問題がありません'); hideLoading(); return; }

    if (state.selectedMode === 'flash') startFlash();
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
  document.getElementById('flash-question').textContent = q.question;
  document.getElementById('flash-answer').textContent = q.answer;
  document.getElementById('flash-meaning').textContent = q.meaning || '';

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
  if (state.current >= state.sessionQs.length && state.retryQueue.length > 0) {
    state.sessionQs = [...state.retryQueue];
    state.retryQueue = [];
    state.current = 0;
    showToast('「もう一度」の問題をもう一周！');
  }
  renderFlash();
};

document.getElementById('btn-again').onclick = () => {
  recordResult(state.sessionQs[state.current].id, false);
  state.wrong++;
  state.retryQueue.push(state.sessionQs[state.current]);
  state.current++;
  if (state.current >= state.sessionQs.length && state.retryQueue.length > 0) {
    state.sessionQs = [...state.retryQueue];
    state.retryQueue = [];
    state.current = 0;
    showToast('「もう一度」の問題をもう一周！');
  }
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
  document.getElementById('fill-meaning').textContent  = q.meaning || '';

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
// セッション終了・結果画面
// ============================================================

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

  showScreen('result');

  // Firestoreに保存
  if (state.nickname) {
    saveScore(state.nickname, state.selectedCat, state.correct, total);
  }
  // ホーム用レート表示をクリア（再読み込み用）
  delete questionCache[state.selectedCat];
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
  if (!val) { showToast('ニックネームを入力してください'); return; }
  state.nickname = val;
  saveNickname(val);
  initHome();
  showScreen('home');
};

document.getElementById('nickname-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('nickname-btn').click();
});

// ============================================================
// 起動時処理
// ============================================================

async function boot() {
  const name = getNickname();
  if (name) {
    state.nickname = name;
    // よく使うカテゴリをバックグラウンドでキャッシュ
    loadQuestions('kotowaza').catch(() => {});
    loadQuestions('kanyoku').catch(() => {});
    loadQuestions('yojijukugo').catch(() => {});
    loadQuestions('gairaigo').catch(() => {});
    initHome();
    showScreen('home');
  } else {
    showScreen('nickname');
  }
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
