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
  const filled = q.question.includes('___')
    ? q.question.replace('___', q.answer)
    : q.answer;
  document.getElementById('flash-question').textContent = filled;
  document.getElementById('flash-answer').textContent = q.meaning || '';

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
  if (!val) { showToast('受験番号を入力してください'); return; }
  state.nickname = val;
  saveNickname(val);
  initSubject();
  showScreen('subject');
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
    loadQuestions('kotowaza').catch(() => {});
    loadQuestions('kanyoku').catch(() => {});
    loadQuestions('yojijukugo').catch(() => {});
    loadQuestions('gairaigo').catch(() => {});
    initSubject();
    showScreen('subject');
  } else {
    showScreen('nickname');
  }
}

function initSubject() {
  document.getElementById('subject-nickname').textContent = state.nickname;

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
    btn.onclick = () => {
      if (btn.classList.contains('coming-soon')) {
        showToast('もうすぐ追加されます！工事中🚧');
        return;
      }
      const subj = btn.dataset.subject;
      if (subj === 'sansu') {
        initSansuHome();
        showScreen('sansu-home');
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

const sansuCache = {};
const sansuState = {
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
  const key = cat;
  if (!sansuCache[key]) {
    const res = await fetch(SANSU_FILES[cat]);
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
  document.getElementById('sansu-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null;
  sansuState.mode = null; sansuState.drillType = null; sansuState.drillTime = null;

  // 戻るボタン
  document.querySelectorAll('[data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年
  document.querySelectorAll('.grade-btn').forEach(btn => {
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

  // STEP3: カテゴリ
  document.querySelectorAll('.sansu-cat-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.sansu-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.scat;
      showSansuStep('sansu-step-diff');
      updateSansuStart();
    };
  });

  // STEP4: 難易度
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
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

async function startSansuSession() {
  if (sansuState.mode === 'normal') {
    showLoading();
    try {
      const all = await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
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

// ── 算数クイズ（通常問題） ────────────────────────────
function startSansuQuiz() {
  const catLabel = SANSU_CAT_LABELS[sansuState.cat] || '算数';
  document.getElementById('sansu-quiz-title').textContent = catLabel;
  document.querySelectorAll('[data-back="sansu-home"]').forEach(b => b.onclick = () => { showScreen('sansu-home'); });
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

  // 余りあり判定
  sansuState.isRemainMode = q.answer && q.answer.includes('余り');
  document.getElementById('sq-remain-wrap').classList.toggle('hidden', !sansuState.isRemainMode);
  document.querySelector('#sq-numpad .numpad-rem').classList.toggle('hidden', !sansuState.isRemainMode);

  // テンキーリセット
  sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputPhase = 'main';
  updateNumpadPreview('sq');

  // フィードバック非表示
  document.getElementById('sq-feedback').classList.add('hidden');
  document.getElementById('sq-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = false);
}

function submitSansuAnswer() {
  const q = sansuState.questions[sansuState.current];
  let userAnswer = sansuState.inputVal.trim();
  if (sansuState.isRemainMode) {
    userAnswer = `${sansuState.inputVal.trim()}余り${sansuState.inputRemain.trim()}`;
  }
  if (!userAnswer || userAnswer === '余り') { showToast('答えを入力してください'); return; }

  const correct = checkSansuAnswer(userAnswer, q.answer);
  recordResult(q.id, correct);

  if (correct) { sansuState.correct++; document.getElementById('sq-correct').textContent = sansuState.correct; }
  else { sansuState.wrong++; document.getElementById('sq-wrong').textContent = sansuState.wrong; }

  const fb = document.getElementById('sq-feedback');
  document.getElementById('sq-feedback-text').textContent = correct ? '✅ 正解！' : '❌ 不正解';
  document.getElementById('sq-feedback-ans').textContent = correct ? (q.meaning || '') : `正解：${q.answer}　${q.meaning || ''}`;
  document.getElementById('sq-meaning').textContent = '';
  fb.classList.remove('hidden');
  document.getElementById('sq-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = true);

  document.getElementById('sq-btn-next').onclick = () => {
    sansuState.current++;
    renderSansuQuiz();
  };
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

  document.getElementById('btn-result-home').onclick = () => { initSansuHome(); showScreen('sansu-home'); };
  document.getElementById('btn-result-retry').onclick = () => {
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    sansuState.questions = shuffle([...sansuState.questions]);
    document.getElementById('sq-correct').textContent = '0';
    document.getElementById('sq-wrong').textContent = '0';
    startSansuQuiz();
  };

  showScreen('result');
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
  document.getElementById('tetris-back').onclick = () => { stopTetrisLoop(); showScreen('subject'); };
  document.getElementById('tetris-pause').onclick = toggleTetrisPause;
  document.getElementById('tetris-restart').onclick = startTetris;
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
  document.getElementById('tetris-overlay').classList.add('hidden');
  document.getElementById('tetris-pause').textContent = '⏸';
  tSpawn();
  updateTetrisInfo();
  drawTetris();
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
  } else {
    tetris.lastDrop = 0;
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
  }
}

function tGameOver() {
  tetris.over = true;
  stopTetrisLoop();
  const prevBest = Number(localStorage.getItem('tetrisBest') || 0);
  const isNewBest = tetris.score > prevBest;
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
  if (ts - tetris.lastDrop > tetris.dropInterval) {
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
  if (act === 'left' && !tCollide(tetris.cur.m, tetris.cur.x - 1, tetris.cur.y)) tetris.cur.x--;
  else if (act === 'right' && !tCollide(tetris.cur.m, tetris.cur.x + 1, tetris.cur.y)) tetris.cur.x++;
  else if (act === 'down') tSoftDrop(true);
  else if (act === 'rotate') tTryRotate();
  else if (act === 'drop') tHardDrop();
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
