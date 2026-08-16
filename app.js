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
  // 和語＝浜学園 小5最高レベル特訓 国語《演習プリントII》の和語(1)(2)(3)（原簿 HG-2546/2550/2557）。
  // あ〜わを一周する78語を、意味→語／語→意味の2通りで出す。実物は□の穴うめ（記述）なので、
  // そちらは じゅくナビ側（手書き＋自己採点）で再現する
  kokugo_wago:    { label: '和語',           file: 'data/kokugo_wago.json' },
  // 小5最レ国語の「記号で答える大問」（原簿 HG-2552/2556）。じゅくナビが unit で引くだけで、
  // カテゴリの画面には出さない（index.html にボタンを作らない）
  kokugo_sairei5:  { label: '最レ国語（文法）', file: 'data/kokugo_sairei5.json' },
  // 文のしくみ＝浜学園 小3国語 本科教材（原簿 HG-2515/2521/2523/2525）。小3の内容だけなので小3限定
  kokugo_bun:     { label: '文のしくみ',     file: 'data/kokugo_bun.json' },
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
async function loadKokugoChainQuestions(cat, grade, maxQuestions = 'all') {
  // 連鎖問題は灘中レベル（小5・小6の内容）。小4以下では出題しない
  if (grade < chainMinGrade('kokugo')) return [];
  if (!kokugoChainCache) {
    const res = await fetch(KOKUGO_CHAIN_FILE);
    kokugoChainCache = await res.json();
  }
  const chains = shuffle(kokugoChainCache.filter(c => c.category === cat && chainInGrade(c, grade)));
  const expand = (chain, g) => chain.steps.map((step, i) => ({
    id: `${chain.id}_s${i + 1}`,
    question: `${i === 0 ? `<div class="tantei-passage">📘 <strong>${chain.title}</strong><br>${chain.intro}</div>` : ''}<div class="tantei-q">(${i + 1}) ${step.question}</div>`,
    answer: step.answer,
    choices: step.choices,
    meaning: step.meaning,
    difficulty: 5,
    grade: chain.grade || g,
  }));
  // 出題数に合わせて連鎖を丸ごと詰める
  return fillChains(chains, grade, maxQuestions, expand);
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
function removeNicknameHistory(name) {
  const h = getNicknameHistory().filter(n => n !== name);
  localStorage.setItem('nicknameHistory', JSON.stringify(h));
  renderNicknameHistory();
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
// フィードバック：いま出ている問題（🚩 通報ボタン用）
// ============================================================
// 出題している画面は quiz / fill / kanji / sansu-quiz の4つだけ。
// それぞれの描画関数の頭で setReportCtx() を1行呼び、通報モーダルはここだけを見る。
// （sansu-quiz の1枚が算数・理科・社会・じゅくナビを全部さばいているので4か所で足りる）

let reportCtx = null;
const REPORT_SCREENS = ['quiz', 'fill', 'kanji', 'sansu-quiz'];

function setReportCtx(ctx) { reportCtx = ctx; }

// 問題文はそのまま送らない。連鎖問題は <div class="tantei-passage"> を含み、
// 算数は **強調** __下線__ の記法が生で入っているので、剥がしてから200字で切る。
// （問題IDが変わっても、この文で data/*.json を grep して元問題を探せるようにするための保険）
function reportPlainQ(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
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
  // JSONに選択肢があればそれを使い、ランダムにシャッフル。
  // ★2個以上で採用する（以前は4個以上だった）。実物には二択・三択の大問があり
  //   （常体文/敬体文の2択・単文/重文/複文の3択）、4個未満だと選択肢が捨てられて
  //   他の問題の答えが誤答として混ざってしまっていた（2026-08-08）
  if (question.choices && question.choices.length >= 2) {
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
  // 出題画面から出たら「いま出ている問題」を捨てる。
  // 残したままだと、ホームに戻ってから通報したときに前の問題が送られてしまう。
  if (!REPORT_SCREENS.includes(id)) reportCtx = null;
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
  if (window.Snd) Snd.onScreen(id);
}

// ============================================================
// トースト通知
// ============================================================

let _toastTimer = null;
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  // 前のトーストのタイマーを止める。止めないと「送信中…→送信完了」のように
  // 続けて出したとき、前のタイマーが後のトーストを消してしまう。
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
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
  document.getElementById('btn-weak').classList.remove('active-weak');
  document.getElementById('start-zone').classList.add('hidden');
  document.getElementById('home-nickname').textContent = state.nickname;

  // ステップを初期状態に
  ['kokugo-step-topmode', 'kokugo-step-cat', 'kokugo-step-diff', 'sansu-step-hama'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');   // じゅくナビのパネルは教科をまたいで使い回すので毎回たたむ
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
      // ★data-max-grade：その学年ぶんしか問題が無いカテゴリを、上の学年に出さないため。
      //   出したまま0問だと「問題がありません」で行き止まりになる（2026-08-02・文のしくみ）
      document.querySelectorAll('.cat-card').forEach(cb => {
        const minGrade = Number(cb.dataset.minGrade || 1);
        const maxGrade = Number(cb.dataset.maxGrade || 6);
        cb.classList.toggle('hidden', state.grade < minGrade || state.grade > maxGrade);
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
      document.getElementById('sansu-step-hama').classList.add('hidden');
      // ★じゅくナビ国語は「対応表にその学年の国語コースがある学年」だけに出す。
      //   小3(HG-2501〜2543)に小4(HG-2431〜2473)が加わったので、学年の決め打ちをやめた（2026-08-08）。
      //   ensureHamaCourses は、古い対応表をつかんでいたら取り直してからもう一度見てくれる
      const kHama = document.querySelector('.kokugo-topmode-btn[data-topmode="hama"]');
      if (kHama) {
        kHama.classList.add('hidden');
        const g = state.grade;
        ensureHamaCourses(g, 'kokugo')
          .then(ok => { if (state.grade === g) kHama.classList.toggle('hidden', !ok); })
          .catch(() => {});
      }
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
      // ★じゅくナビのパネルは国語ホームに置きっぱなしになるので、
      //   ほかのモードを選んだら必ずたたむ（2026-08-02・「通常問題なのに下にじゅくナビが出る」）
      if (topmode !== 'hama') document.getElementById('sansu-step-hama').classList.add('hidden');
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
      } else if (topmode === 'hama') {
        // ★国語のじゅくナビ（2026-08-02）。算数・理科と同じパネルを画面ごと移して使い回す。
        //   国語は回番号→漢字10問を hama_kokugo.json から直接引く（ID帯でも単元名でもない）
        state.selectedCat = null;
        state.selectedMode = null;
        state.selectedDiff = null;
        document.querySelectorAll('.cat-card').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('.kokugo-diff-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('kokugo-step-cat').classList.add('hidden');
        document.getElementById('kokugo-step-diff').classList.add('hidden');
        document.getElementById('start-zone').classList.add('hidden');
        sansuState.subject = 'kokugo';   // ★hamaCourses/hamaCurrent がこれを見る
        sansuState.grade = state.grade;
        sansuState.hamaMode = 'no';
        sansuState.hamaUnit = null;
        moveHamaPanelTo('screen-home', 'start-zone');
        loadHamaMap()
          .then(() => ensureHamaCourses(state.grade, 'kokugo'))   // 古い対応表をつかんでいたら取り直す
          .then(() => { showSansuStep('sansu-step-hama'); renderHamaPanel(); })
          .catch(() => showToast('じゅくの対応表が読みこめませんでした'));
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
      document.getElementById('btn-weak').classList.remove('active-weak');
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

  // 苦手のみ（もう一度押すとオフ）
  document.getElementById('btn-weak').onclick = () => {
    if (!state.selectedCat) { showToast('カテゴリを選んでください'); return; }
    const btn = document.getElementById('btn-weak');
    if (state.weakOnly) {
      state.weakOnly = false;
      btn.classList.remove('active-weak');
      showToast('通常の出題にもどします');
      maybeShowStart();
      return;
    }
    const weaks = getWeakItems(state.selectedCat);
    if (!weaks.length) { showToast('まだ苦手問題がありません'); return; }
    state.weakOnly = true;
    btn.classList.add('active-weak');
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
  setChainCountOptions('q-count', state.selectedDiff === 5);
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
  state.fromHamaKotoba = false;   // ふつうの出題。じゅくナビの「今週のことば」ではない
  try {
    const isChain = state.selectedDiff === 5;
    let pool;
    let all;
    if (isChain) {
      pool = await loadKokugoChainQuestions(state.selectedCat, state.grade, document.getElementById('q-count').value);
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

  setReportCtx({ qid: q.id, subject: 'kokugo', cat: state.selectedCat, grade: q.grade,
                 difficulty: String(q.difficulty ?? state.selectedDiff ?? ''),
                 question: reportPlainQ(q.question), answer: q.answer, screen: 'quiz' });

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
  Snd.answer(correct);
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

  setReportCtx({ qid: q.id, subject: 'kokugo', cat: state.selectedCat, grade: q.grade,
                 difficulty: String(q.difficulty ?? state.selectedDiff ?? ''),
                 question: reportPlainQ(q.question), answer: q.answer, screen: 'fill' });

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
  Snd.answer(correct);
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

// qs を渡すと、その配列をそのままの順で出題する（じゅくナビ国語＝実物の1〜10の順を崩さない）。
// 引数なしの呼び出し（btn-start 経由）は これまでどおり state.sessionQs をそのまま使う。
function startKanji(qs, title) {
  if (qs) {
    state.sessionQs = qs;
    state.current = 0; state.correct = 0; state.wrong = 0;
  }
  document.getElementById('kanji-title').textContent = title || `書き取り（小${state.grade}）`;
  document.getElementById('kanji-correct').textContent = '0';
  document.getElementById('kanji-wrong').textContent = '0';
  if (!kanjiPad.ctx) initKanjiPad();
  showScreen('kanji');
  renderKanji();
}

function renderKanji() {
  const q = state.sessionQs[state.current];
  if (!q) { endSession(); return; }

  setReportCtx({ qid: q.id, subject: 'kokugo', cat: state.selectedCat, grade: q.grade,
                 difficulty: String(q.difficulty ?? state.selectedDiff ?? ''),
                 question: reportPlainQ(q.question), answer: q.answer, screen: 'kanji' });

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
    Snd.answer(true);
    recordResult(q.id, true);
    state.correct++;
    document.getElementById('kanji-correct').textContent = state.correct;
    state.current++;
    renderKanji();
  };
  document.getElementById('kanji-ng').onclick = () => {
    Snd.answer(false);
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
  Snd.result(rate);
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
    // ★じゅくナビ国語(hama_kokugo)は CATEGORIES に無い＝loadQuestions に渡すと落ちる
    if (CATEGORIES[state.selectedCat]) await loadQuestions(state.selectedCat);
    initHome();
    showScreen('home');
  };
  document.getElementById('btn-result-retry').onclick = () => {
    // ★じゅくナビ国語は通常の出題フロー(btn-start)に戻せないので、同じ回をもう一度出す
    if (state.selectedCat === 'hama_kokugo') {
      startKokugoHamaSession(sansuState.grade, sansuState.hamaCourse);
      return;
    }
    if (state.fromHamaKotoba) {
      startKokugoKotobaSession(sansuState.grade, sansuState.hamaCourse);
      return;
    }
    document.getElementById('btn-start').click();
  };
}

document.getElementById('btn-result-home').onclick = async () => {
  // キャッシュを再取得してレート更新
  if (CATEGORIES[state.selectedCat]) await loadQuestions(state.selectedCat);
  initHome();
  showScreen('home');
};

document.getElementById('btn-result-retry').onclick = () => {
  if (state.selectedCat === 'hama_kokugo') {
    startKokugoHamaSession(sansuState.grade, sansuState.hamaCourse);
    return;
  }
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
    const item = document.createElement('div');
    item.className = 'nick-history-item';
    const b = document.createElement('button');
    b.className = 'nick-history-btn';
    b.textContent = '👤 ' + n;
    b.onclick = () => {
      state.nickname = n;
      saveNickname(n);
      initSubject();
      showScreen('subject');
    };
    const del = document.createElement('button');
    del.className = 'nick-history-del';
    del.textContent = '✕';
    del.setAttribute('aria-label', n + 'の履歴を消す');
    del.onclick = (e) => {
      e.stopPropagation();
      removeNicknameHistory(n);
    };
    item.appendChild(b);
    item.appendChild(del);
    row.appendChild(item);
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

// ★国語のSTEP3カテゴリボタン（ことわざ・慣用句…）だけ、算数/理科/社会と違って
//   ボタンをJSで動的生成しておらずHTMLに数字を直書きしていたため、ここも同じズレの
//   温床だった（本人指摘 2026-08-15）。QUESTION_COUNTSを単一の参照元にして、
//   「◯◯問」の先頭の数字だけを実数に置きかえる（「・手書き」「・小5」等の
//   末尾の説明はテキストをそのまま残す）。
function refreshCategoryCardCounts() {
  const flat = {};
  for (const cats of Object.values(QUESTION_COUNTS)) {
    for (const [cat, n] of Object.entries(cats)) flat[cat] = n;
  }
  document.querySelectorAll('[data-cat]').forEach(card => {
    const n = flat[card.dataset.cat];
    const el = card.querySelector('.cat-count');
    if (el && typeof n === 'number') {
      el.textContent = el.textContent.replace(/^[\d,]+/, n.toLocaleString());
    }
  });
}

function initSubject() {
  document.getElementById('subject-nickname').textContent = state.nickname;
  refreshSubjectCounts();
  refreshCategoryCardCounts();

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

  document.querySelectorAll('#screen-subject .subject-card').forEach(btn => {
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
        if (!hasGameTicket()) return;
        initTetris();
        showScreen('tetris');
      } else if (subj === 'mine') {
        if (!hasGameTicket()) return;
        initMine();
        showScreen('mine');
      } else if (subj === 'jump') {
        if (!hasGameTicket()) return;
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

  // 💾 セーブは科目えらびと「がんばりの記録」の両方から押せる
  ['btn-subject-save', 'btn-record-save'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.onclick = () => saveNow(b);
  });
  document.getElementById('btn-subject-refresh').onclick = () => forceAppUpdate();
  document.getElementById('btn-subject-settings').onclick = () => { initSettingsScreen(); showScreen('settings'); };
  document.getElementById('btn-subject-change').onclick = async () => {
    // ⚠️このボタンは端末のきろくを消す。子どもが押しただけで消えないよう必ず確認する。
    //   （2026-08-04・ずっと同じiPadを使っていた子の記録が消えた原因がこれ）
    const NL = String.fromCharCode(10);
    let solved = 0;
    try { solved = Object.keys(JSON.parse(localStorage.getItem('progress') || '{}')).length; } catch (e) {}
    if (solved > 0 && !confirm(
        '受験番号を かえると、この iPad の きろく（' + solved + '問ぶん）は 消えます。' + NL +
        'さきに 💾セーブ してから かえます。' + NL +
        'セーブして あれば、おなじ 受験番号で 入りなおせば もどせます。' + NL + NL +
        'セーブして つづけますか？')) {
      return;
    }
    // 切り替え前に必ずセーブ。結果を画面に出すので、送れたかどうかが子どもにも見える。
    const skipped = await saveNow(document.getElementById('btn-subject-save'));
    // 保存できていないのに消すと、その記録はどこにも残らない。
    if (solved > 0 && !isSaveSafe(skipped) && !confirm(
        'いま クラウドに セーブできませんでした。' + NL +
        'このまま かえると、この iPad の きろく（' + solved + '問ぶん）は もどせなく なります。' + NL + NL +
        'それでも つづけますか？')) {
      return;
    }
    BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('nickname');
    state.nickname = '';
    document.getElementById('nickname-input').value = '';
    renderNicknameHistory();
    showScreen('nickname');
  };

  checkCloudRestore();
  applyPendingGrants();
  backupLocalData();
  initUpdateBanner();
  updateGameTicketBadge();
  initDebugTool();
}

// ============================================================
// 設定画面（サウンド設定・キャラクター紹介）
// ============================================================

function initSettingsScreen() {
  initClassBandUI();
  const c = Snd.get();
  const st = document.getElementById('snd-sfx-toggle');
  const mt = document.getElementById('snd-music-toggle');
  st.textContent = c.sfxOn ? 'ON' : 'OFF'; st.classList.toggle('off', !c.sfxOn);
  mt.textContent = c.musicOn ? 'ON' : 'OFF'; mt.classList.toggle('off', !c.musicOn);
  document.getElementById('snd-sfx-vol').value = Math.round(c.sfxVol * 100);
  document.getElementById('snd-music-vol').value = Math.round(c.musicVol * 100);
  const dg = document.getElementById('snd-diag');
  if (dg) dg.textContent = Snd.diag();
}

// 設定画面を開いている間は診断表示を自動更新（音楽ためす中のBGM状態も見える）
setInterval(() => {
  if (currentScreenId !== 'settings') return;
  const dg = document.getElementById('snd-diag');
  if (dg && window.Snd) dg.textContent = Snd.diag();
}, 800);

document.getElementById('snd-sfx-toggle').onclick = () => {
  Snd.set('sfxOn', !Snd.get().sfxOn);
  initSettingsScreen();
  if (Snd.get().sfxOn) Snd.correct();
};
document.getElementById('snd-music-toggle').onclick = () => {
  Snd.set('musicOn', !Snd.get().musicOn);
  initSettingsScreen();
};
document.getElementById('snd-sfx-vol').oninput = e => Snd.set('sfxVol', e.target.value / 100);
document.getElementById('snd-sfx-vol').onchange = () => Snd.correct();
document.getElementById('snd-music-vol').oninput = e => Snd.set('musicVol', e.target.value / 100);
document.getElementById('snd-sfx-test').onclick = () => Snd.fanfare('good');
let _sndTestTimer = null;
document.getElementById('snd-music-test').onclick = () => {
  if (!Snd.get().musicOn) { showToast('音楽がOFFになっています'); return; }
  Snd.bgm('sansu');
  clearTimeout(_sndTestTimer);
  _sndTestTimer = setTimeout(() => { if (currentScreenId === 'settings') Snd.stopBgm(); }, 5000);
};
document.getElementById('btn-settings-back').onclick = () => showScreen('subject');
document.getElementById('btn-settings-char').onclick = () => showScreen('character');
document.getElementById('btn-settings-feedback').onclick = () => { initFeedbackScreen(); showScreen('feedback'); };
document.getElementById('btn-char-back').onclick = () => showScreen('settings');

// ── 使い方ガイド ──
document.getElementById('btn-settings-help').onclick = () => { initHelpScreen(); showScreen('help'); };
document.getElementById('btn-help-back').onclick = () => showScreen('settings');

// 目次チップ → その節を開いてスクロール。閉じたまま飛ぶと何も見えないので必ず open にする
document.querySelectorAll('[data-help-jump]').forEach(chip => {
  chip.onclick = () => {
    const sec = document.getElementById(chip.dataset.helpJump);
    if (!sec) return;
    sec.open = true;
    document.querySelectorAll('.help-chip').forEach(c => c.classList.toggle('is-on', c === chip));
    // details を開いた直後は高さが確定していないので、1フレーム待ってから位置を測る
    requestAnimationFrame(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    if (window.Snd) Snd.tap();
  };
});

// クレジットに、いま動いている版数を出す（不具合の問い合わせのときに効く）。
// 版数は initUpdateBanner が updates.json を読んだときに latestAppVer に控えてある
function initHelpScreen() {
  const el = document.getElementById('credits-ver');
  if (!el) return;
  el.textContent = latestAppVer ? `オトン学園 ${latestAppVer}` : 'オトン学園';
  refreshHelpGuideCounts();
}

// ★使い方ガイドの問題数は、以前は本文に数字を直書きしていたため、
//   問題を追加するたびに手で直す必要があり、直し忘れて実際の件数と大きくズレていた
//   （本人指摘 2026-08-15「設定の使い方ガイドに表記してある問題数とかズレが出てきてる」）。
//   科目カード（refreshSubjectCounts）と同じ QUESTION_COUNTS を単一の参照元にして、
//   ここが二度とズレないようにする。要素が無い（HTML未対応）IDは黙って無視する。
function refreshHelpGuideCounts() {
  const setTxt = (id, n) => {
    const el = document.getElementById(id);
    if (el && typeof n === 'number') el.textContent = n.toLocaleString();
  };
  for (const subj of Object.keys(QUESTION_COUNTS)) {
    const total = Object.values(QUESTION_COUNTS[subj]).reduce((a, b) => a + b, 0);
    setTxt('hg-cnt-' + subj, total);
  }
  for (const [subj, cats] of Object.entries(QUESTION_COUNTS)) {
    for (const [cat, n] of Object.entries(cats)) {
      setTxt('hg-cnt-' + cat, n);
    }
  }
}

// クイズ中のヘッダー右上の音トグル（効果音🔔/🔕・音楽🎵）
function updateSndMini() {
  const c = Snd.get();
  document.querySelectorAll('.snd-mini-sfx').forEach(b => {
    b.textContent = c.sfxOn ? '🔔' : '🔕';
    b.classList.toggle('snd-off', !c.sfxOn);
  });
  document.querySelectorAll('.snd-mini-music').forEach(b => b.classList.toggle('snd-off', !c.musicOn));
}
document.querySelectorAll('.snd-mini-sfx').forEach(b => b.onclick = () => {
  Snd.set('sfxOn', !Snd.get().sfxOn);
  updateSndMini();
  if (Snd.get().sfxOn) Snd.tap();
});
document.querySelectorAll('.snd-mini-music').forEach(b => b.onclick = () => {
  Snd.set('musicOn', !Snd.get().musicOn);
  updateSndMini();
});
updateSndMini();

// ============================================================
// 管理ツール（デバッグ・保護者用）：ホームのロゴ長押しで開く
// ============================================================
function renderDebugItems() {
  const items = getItems();
  const el = document.getElementById('debug-items');
  if (!el) return;
  el.innerHTML = Object.entries(ITEM_DEFS).map(([k, d]) => `
    <div class="debug-item">
      <span class="debug-item-name">${d.icon} ${d.label}</span>
      <span class="debug-item-count" id="debug-cnt-${k}">${items[k] || 0}</span>
      <button class="debug-give" data-give="${k}" data-n="1">＋1</button>
      <button class="debug-give" data-give="${k}" data-n="10">＋10</button>
      <button class="debug-give" data-give="${k}" data-n="99">MAX</button>
      <button class="debug-give" data-give="${k}" data-n="0">0</button>
    </div>`).join('');
  const coinEl = document.getElementById('debug-coin-now');
  if (coinEl) coinEl.textContent = getCoins();
  const tkEl = document.getElementById('debug-ticket-now');
  if (tkEl) tkEl.textContent = getGameTickets();
}

let debugReturnScreen = 'subject';
function openDebugTool() {
  debugReturnScreen = currentScreenId || 'subject';
  bindDebugHandlers();
  renderDebugItems();
  showScreen('debug');
}

// ボタン類の結線（開くたびに呼んでも安全＝冪等）
function bindDebugHandlers() {
  const backBtn = document.getElementById('debug-back');
  if (backBtn) backBtn.onclick = () => showScreen(debugReturnScreen);

  const itemsEl = document.getElementById('debug-items');
  if (itemsEl && !itemsEl.dataset.dbgBound) {
    itemsEl.dataset.dbgBound = '1';
    itemsEl.addEventListener('click', e => {
      const b = e.target.closest('.debug-give');
      if (!b) return;
      const kind = b.dataset.give, n = Number(b.dataset.n);
      if (n === 0) { const it = getItems(); it[kind] = 0; localStorage.setItem('items', JSON.stringify(it)); }
      else addItem(kind, n);
      renderDebugItems();
      if (typeof updateItemButtons === 'function') updateItemButtons();
    });
  }
  // ☁️ バックアップの状態（管理ツールで progress が見えない件の切り分け用）
  const bkBtn = document.getElementById('debug-backup-now');
  if (bkBtn && !bkBtn.dataset.dbgBound) {
    bkBtn.dataset.dbgBound = '1';
    bkBtn.onclick = async () => {
      const el = document.getElementById('debug-backup-state');
      el.style.whiteSpace = 'pre-wrap';
      el.textContent = '送信中…';
      const NL0 = String.fromCharCode(10);
      const skipped = await backupLocalData();
      // 送らなかったとき（クラウドのデータを守るためのガード）は理由を出す。
      // 以前はここも「Firebaseにつながっていません」と出ていて誤解のもとだった。
      if (skipped === 'no-local-data') {
        el.textContent = '⏸ この端末にはまだデータが無いので送っていません' + NL0 +
          '（空で上書きしてクラウドの記録を消さないための安全装置）' + NL0 +
          '※クラウドに記録があるなら、下の「☁️ クラウドから復元する」で戻せます';
        return;
      }
      if (skipped === 'lower-achievement') {
        el.textContent = '⏸ この端末の達成率がクラウドより低いので送っていません' + NL0 +
          '（少ないデータで本物の記録を消さないための安全装置）';
        return;
      }
      if (skipped === 'fewer-records') {
        el.textContent = '⏸ 解いた問題の数がクラウドより大幅に少ないので送っていません' + NL0 +
          '（本物の記録を上書きしないための安全装置）' + NL0 +
          '※この端末を使い続けるなら、先に「☁️ クラウドから復元する」を押してください';
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
      const i = window.lastBackupInfo;
      if (!i) { el.textContent = 'Firebaseにつながっていません（オフラインか設定なし）'; return; }
      const sz = Object.entries(i.sizes || {}).map(([k, v]) => `${k}:${v}`).join(' / ');
      const NL = String.fromCharCode(10);
      el.textContent = i.ok
        ? '✅ 成功（' + i.at.slice(0, 19) + '）' + NL + '送った中身の大きさ → ' + sz
        : '❌ 失敗 [' + i.code + '] ' + i.message + NL + '送ろうとした中身 → ' + sz +
          NL + '※失敗すると、この回のぶんはクラウドに保存されません（前の内容は消えません）';
      el.style.whiteSpace = 'pre-wrap';
    };
  }

  const rcBtn = document.getElementById('debug-restore-check');
  if (rcBtn && !rcBtn.dataset.dbgBound) {
    rcBtn.dataset.dbgBound = '1';
    rcBtn.onclick = async () => {
      const el = document.getElementById('debug-restore-state');
      el.textContent = '調べています…';
      const NL = String.fromCharCode(10);
      const hasProgress = !!localStorage.getItem('progress');
      const hasGacha = !!localStorage.getItem('gacha');
      const declined = !!localStorage.getItem('restoreDeclined_' + state.nickname);
      let cloudLine = 'Firebaseにつながっていません';
      if (typeof getLocalBackup === 'function') {
        try {
          const backup = await getLocalBackup(state.nickname);
          if (!backup) {
            cloudLine = 'なし（このニックネームのバックアップはクラウドに無い）';
          } else {
            const t = backup.lastUpdated && backup.lastUpdated.toDate ? backup.lastUpdated.toDate().toISOString().slice(0, 19) : '不明';
            cloudLine = 'あり（最終更新 ' + t + '）';
          }
        } catch (e) {
          cloudLine = 'エラー: ' + e.message;
        }
      }
      el.textContent =
        'ニックネーム: ' + state.nickname + NL +
        'ローカルにprogress: ' + (hasProgress ? 'あり' : 'なし') + NL +
        'ローカルにgacha: ' + (hasGacha ? 'あり' : 'なし') + NL +
        '「復元しない」済みフラグ: ' + (declined ? 'あり（次から聞かれません）' : 'なし') + NL +
        'クラウドのバックアップ: ' + cloudLine;
      el.style.whiteSpace = 'pre-wrap';
    };
  }

  // ☁️ クラウドから復元する（「復元しない」を押したあとの救済。フラグを無視して復元する）
  const rnBtn = document.getElementById('debug-restore-now');
  if (rnBtn && !rnBtn.dataset.dbgBound) {
    rnBtn.dataset.dbgBound = '1';
    rnBtn.onclick = async () => {
      const el = document.getElementById('debug-restore-state');
      el.style.whiteSpace = 'pre-wrap';
      if (!state.nickname || typeof getLocalBackup !== 'function') {
        el.textContent = 'クラウドにつながっていないので復元できません';
        return;
      }
      el.textContent = 'クラウドから読んでいます…';
      let backup;
      try {
        backup = await getLocalBackup(state.nickname);
      } catch (e) {
        el.textContent = 'エラー: ' + e.message;
        return;
      }
      if (!backup) {
        el.textContent = '「' + state.nickname + '」のバックアップはクラウドにありません';
        return;
      }
      const NL = String.fromCharCode(10);
      const t = backup.lastUpdated && backup.lastUpdated.toDate
        ? backup.lastUpdated.toDate().toISOString().slice(0, 19) : '不明';
      if (!confirm('「' + state.nickname + '」のクラウドのデータ（最終更新 ' + t + '）で' + NL +
                   'この端末のデータを上書きします。よろしいですか？')) {
        el.textContent = '復元をやめました';
        return;
      }
      BACKUP_KEYS.forEach(k => { if (backup[k] !== undefined) localStorage.setItem(k, backup[k]); });
      // 次から起動時にも聞かれるように、断った記録を消しておく
      localStorage.removeItem('restoreDeclined_' + state.nickname);
      el.textContent = '✅ 復元しました。読み込み直します…';
      showToast('復元したで！');
      setTimeout(() => location.reload(), 800);
    };
  }

  const allmax = document.getElementById('debug-allmax');
  if (allmax) allmax.onclick = () => {
    Object.keys(ITEM_DEFS).forEach(k => addItem(k, 99));
    renderDebugItems();
    if (typeof updateItemButtons === 'function') updateItemButtons();
    showToast('全アイテムをMAXにしました');
  };
  document.querySelectorAll('.debug-coin-btn').forEach(b => {
    b.onclick = () => {
      const n = Number(b.dataset.coin);
      if (n === 0) localStorage.setItem('coins', '0');
      else if (n === 9999) localStorage.setItem('coins', '9999');
      else addCoins(n);
      renderDebugItems();
    };
  });
  document.querySelectorAll('.debug-ticket-btn').forEach(b => {
    b.onclick = () => {
      const n = Number(b.dataset.ticket);
      if (n === 0) { localStorage.setItem('gameTickets', '0'); updateGameTicketBadge(); }
      else if (n === 99) { localStorage.setItem('gameTickets', '99'); updateGameTicketBadge(); }
      else addGameTickets(n);
      renderDebugItems();
    };
  });
}

function initDebugTool() {
  // メニュー上部のロゴを長押し（約0.9秒）で管理ツールを開く
  const logo = document.querySelector('.top-logo-img');
  if (logo && !logo.dataset.dbgBound) {
    logo.dataset.dbgBound = '1';
    let timer = null;
    const start = e => { if (e) e.preventDefault(); clearTimeout(timer); timer = setTimeout(openDebugTool, 5000); };
    const cancel = () => { clearTimeout(timer); timer = null; };
    logo.addEventListener('pointerdown', start);
    logo.addEventListener('pointerup', cancel);
    logo.addEventListener('pointerleave', cancel);
    logo.addEventListener('pointercancel', cancel);
  }
  bindDebugHandlers();
}

// ============================================================
// アップデート情報（お知らせ）
// ============================================================
let latestAppVer = ''; // 使い方ガイドのクレジットに出す版数

async function initUpdateBanner() {
  try {
    const res = await fetch('data/updates.json');
    const updates = await res.json(); // 新しい順の配列
    if (!updates.length) return;
    latestAppVer = updates[0].ver || '';

    document.getElementById('update-banner-latest').textContent = updates[0].title;
    const lastSeen = localStorage.getItem('updateLastSeenDate') || '';
    document.getElementById('update-banner-badge').classList.toggle('hidden', !(updates[0].date > lastSeen));

    const listEl = document.getElementById('update-list');
    // 日付ごとにまとめて要約表示（1日1カード・その日の変更点をタイトルで箇条書き）
    const days = [];
    const dmap = {};
    for (const u of updates) {
      if (!dmap[u.date]) { dmap[u.date] = { date: u.date, ver: u.ver || '', items: [] }; days.push(dmap[u.date]); }
      if (u.ver && !dmap[u.date].ver) dmap[u.date].ver = u.ver; // その日の最新（先頭）のバージョン
      dmap[u.date].items.push(u);
    }
    listEl.innerHTML = days.map(d => `
      <div class="update-item">
        <div class="update-item-date">${d.date}${d.ver ? ` <span class="update-item-ver">${d.ver}</span>` : ''}</div>
        <ul class="update-day-list" style="margin:6px 0 0;padding-left:1.15em;line-height:1.6">
          ${d.items.map(u => `<li style="margin:3px 0">${u.title}</li>`).join('')}
        </ul>
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
  'drillBest',   // 計算ドリルの自己ベスト（組み合わせごとのJSON・2026-07-28）
  'progress',
];

async function backupLocalData() {
  if (!state.nickname) return 'no-nickname';
  if (typeof saveLocalBackup !== 'function' || typeof firebaseReady === 'undefined' || !firebaseReady) {
    return 'no-firebase';
  }
  const payload = {};
  BACKUP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) payload[k] = v;
  });
  // 端末にまだ実データが無い（新しい端末・復元前）ときは書き込まない。
  // .set()は上書きなので、空のpayloadで書くと同じニックネームの人の
  // クラウドバックアップを消してしまう（2026-08-02・実被害あり）。
  if (!payload.progress && !payload.gacha) return 'no-local-data';
  // この端末の達成率が、クラウドに保存済みの達成率より明らかに低いときも書き込まない。
  // 別の人が同じニックネームを使った・復元前に少しだけ遊んだ、などで
  // 少ないデータのほうが後勝ちで本物の記録を消してしまう事故を防ぐ（本人提案・2026-08-02）。
  if (typeof getAchievementDoc === 'function') {
    try {
      const localPct = getAchievement().titlePct;
      const remote = await getAchievementDoc(state.nickname);
      if (remote && typeof remote.pct === 'number' && localPct < remote.pct - 0.5) {
        console.warn('バックアップ保留：達成率がクラウドより低い', localPct, remote.pct);
        return 'lower-achievement';
      }
    } catch (e) { /* 比較に失敗したときは通常どおり保存を続ける */ }
  }
  // ★クラウドのバックアップ本体（解いた問題の数）とも比べる。
  //   上の達成率チェックだけでは守れない。達成率は「先に保存 → その値と比べる」順なので、
  //   自分で判定基準を下げてしまうため（2026-08-04・実際にこれで94問ぶんの記録が
  //   15問ぶんに上書きされた）。こちらは他人の書き込みに依存しないので確実。
  if (typeof getLocalBackup === 'function') {
    try {
      const cloud = await getLocalBackup(state.nickname);
      if (cloud && typeof cloud.progress === 'string') {
        const mine   = Object.keys(JSON.parse(payload.progress || '{}')).length;
        const theirs = Object.keys(JSON.parse(cloud.progress || '{}')).length;
        // ★クラウドのほうが1問でも多ければ書かない（本人指示・2026-08-04）。
        //   以前は theirs*0.6 まで許していたが、それだと「クラウド100問・端末70問」で
        //   30問ぶんが消えてしまう。同じ端末で遊び続けているかぎり端末のほうが必ず多いので、
        //   少ないということは「この端末が知らない記録がクラウドにある」＝守るべき状態。
        if (theirs >= 5 && mine < theirs) {
          console.warn('バックアップ保留：解いた問題の数がクラウドより少ない', mine, theirs);
          return 'fewer-records';
        }
      }
    } catch (e) { /* 比較に失敗したときは通常どおり保存を続ける */ }
  }
  // ★保存できたかどうかを呼び出し元に返す。「消してから切り替える」処理が、
  //   保存に失敗したまま端末のデータを消してしまわないようにするため（2026-08-04）。
  await saveLocalBackup(state.nickname, payload);
  if (!window.lastBackupInfo || !window.lastBackupInfo.ok) return 'save-failed';
}

// ============================================================
// 💾 手動セーブ（いつでも押せるボタン）
// ============================================================
// 自動バックアップ（画面を閉じたとき・問題を解き終えたとき）は前からあるが、
// 「ちゃんと保存できたのか」が見えないので、押して確かめられるボタンを置いた。
// 2026-08-04・記録が消えた件のあと、本人の希望。

const SAVE_RESULT_MSG = {
  'ok':                '✅ セーブ かんりょう！',
  'no-nickname':       '受験番号が わかりません',
  'no-firebase':       '❌ ネットに つながっていません',
  'save-failed':       '❌ おくれませんでした。もう一度おしてね',
  'no-local-data':     'まだ セーブする きろくが ありません',
  'lower-achievement': '🛡 クラウドの きろくのほうが 多いので 上書きしません',
  'fewer-records':     '🛡 クラウドの きろくのほうが 多いので 上書きしません',
};

// 押されたら送って、結果をはっきり出す。戻り値は結果コード（'ok' か理由）。
async function saveNow(btn) {
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  showToast('☁️ 送信中…', 8000);
  let code;
  try {
    code = (await backupLocalData()) || 'ok';
  } catch (e) {
    code = 'save-failed';
  }
  if (btn) { btn.disabled = false; btn.textContent = label; }
  showToast(SAVE_RESULT_MSG[code] || ('おくれませんでした（' + code + '）'), 2600);
  if (code === 'ok' && window.Snd) Snd.correct();
  return code;
}

// セーブできたと言い切れるかどうか。
// ガードで見送ったとき（クラウドのほうが記録が多い）は、消えて困るものが無いので「安全」に含める。
function isSaveSafe(code) {
  return code === 'ok' || code === 'no-local-data'
      || code === 'lower-achievement' || code === 'fewer-records';
}

// 端末にローカルデータがほぼ無い（新しい端末・キャッシュ消去後）状態で、
// クラウドにバックアップがあれば復元をたずねる（一度断ったら同じニックネームでは聞き直さない）
// 管理ツール（保護者用）からの「プレゼント」付与予約を取り込む。
// クラウドの users/{nickname}/backup/grants を読み、アイテム・コイン・遊び券を
// ローカルに加算 → 予約を削除（1回だけ反映）。能動ユーザーでも確実に届く。
async function applyPendingGrants() {
  if (!state.nickname || typeof getPendingGrants !== 'function') return;
  let g;
  try { g = await getPendingGrants(state.nickname); } catch (e) { return; }
  if (!g) return;
  const msg = [];
  if (g.items) {
    for (const [k, v] of Object.entries(g.items)) {
      const c = Number(v);
      if (c > 0 && ITEM_DEFS[k]) { addItem(k, c); msg.push(`${ITEM_DEFS[k].icon}×${c}`); }
    }
  }
  if (g.coins) { const c = Number(g.coins); if (c > 0) { addCoins(c); msg.push(`🪙×${c}`); } }
  if (g.tickets) { const c = Number(g.tickets); if (c > 0) { addGameTickets(c); msg.push(`🎟×${c}`); } }
  await clearPendingGrants(state.nickname);
  backupLocalData();
  if (msg.length) showToast('🎁 プレゼントがとどいたよ！ ' + msg.join(' '));
}

async function checkCloudRestore() {
  if (!state.nickname || typeof getLocalBackup !== 'function') return;
  const hasLocalData = !!localStorage.getItem('progress') || !!localStorage.getItem('gacha');
  if (hasLocalData) return;
  const backup = await getLocalBackup(state.nickname);
  if (!backup) return;
  let solved = 0;
  try { solved = Object.keys(JSON.parse(backup.progress || '{}')).length; } catch (e) { /* 数えられなくても聞く */ }
  // ★中身のある記録が残っているときは、前に「あとで」を押していても毎回たずねる。
  //   別の端末で空のまま遊び始めるのが、記録が消える一番の原因だったため
  //   （2026-08-04・断った記録が永久に残り、復元をたずねなくなっていた）。
  if (solved < 5 && localStorage.getItem('restoreDeclined_' + state.nickname)) return;
  showRestoreConfirm(backup, solved);
}

function showRestoreConfirm(backup, solved) {
  const detail = document.getElementById('restore-detail');
  if (detail) {
    let when = '';
    try {
      if (backup.lastUpdated && backup.lastUpdated.toDate) {
        const d = backup.lastUpdated.toDate();
        when = `（さいご に あそんだ 日：${d.getMonth() + 1}月${d.getDate()}日）`;
      }
    } catch (e) { /* 日付が読めなくても本文は出す */ }
    detail.innerHTML = solved
      ? `「${state.nickname}」の きろくが <b>${solved}問ぶん</b> クラウドに あります。${when}`
      : `「${state.nickname}」の きろくが クラウドに あります。${when}`;
  }
  document.getElementById('restore-modal').classList.remove('hidden');
  document.getElementById('restore-yes').onclick = () => {
    BACKUP_KEYS.forEach(k => { if (backup[k] !== undefined) localStorage.setItem(k, backup[k]); });
    localStorage.removeItem('restoreDeclined_' + state.nickname);
    document.getElementById('restore-modal').classList.add('hidden');
    showToast('復元したで！');
    location.reload();
  };
  document.getElementById('restore-no').onclick = () => {
    const NL = String.fromCharCode(10);
    if (solved >= 5 && !confirm(
        '復元しないと、この端末の きろくは クラウドの ' + solved + '問ぶんとは 別に なります。' + NL + NL +
        'あとから 管理ツールの「☁️ クラウドから復元する」でも もどせます。' + NL +
        'このまま 始めますか？')) {
      return;
    }
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

// ============================================================
// 📮 フィードバック（もんだいの通報・いけんばこ）
// ============================================================
// 送り先は Firestore の feedback コレクション。読めるのは管理ツール（オトン）だけ。
// ドキュメントIDが 20260816_たろう_0 の形で、末尾の連番をルールが 0〜5 に縛っているので、
// サーバー側でも「受験番号ごとに1日6件」が上限になっている。
// ここのローカル制御は、その上限に当たる前に やさしく止めるためのもの。

const FB_DAILY_LIMIT = 6;      // ルール側の連番 [0-5] と必ず揃えること
const FB_COOLDOWN_MS = 60000;  // 連投の間隔
const FB_LOG_MAX     = 20;     // 「おくったもの」に残す件数

const FB_REASON_LABEL = {
  answer:  '❌ こたえが ちがう',
  text:    '❓ もんだいの ぶんが わからない',
  kaisetsu:'💡 かんたんな せつめいが ほしい',
  level:   '😵 むずかしさが あわない',
  request: '🙋 こうして ほしい',
  bug:     '🐛 うまく うごかない',
  other:   '💬 そのほか',
};

function fbTodayKey()  { return todayStr().replace(/-/g, ''); }        // 2026-08-16 → 20260816
function fbSeqKey()    { return 'fbSeq_' + todayStr(); }
function fbSeq()       { return Number(localStorage.getItem(fbSeqKey()) || 0); }
function fbQuotaLeft() { return Math.max(0, FB_DAILY_LIMIT - fbSeq()); }

// ドキュメントIDに使えない文字（/ . # [ ] *）を潰し、20字で切る。
// ここを忘れるとFirestoreがIDを受け付けず、原因の分かりにくい失敗になる。
function fbDocId(nickname, seq) {
  const nick = String(nickname).replace(/[\/\.\#\[\]\*]/g, '_').slice(0, 20);
  return `${fbTodayKey()}_${nick}_${seq}`;
}

function fbGetLog() {
  try { return JSON.parse(localStorage.getItem('fbSentLog') || '[]'); } catch (e) { return []; }
}
function fbPushLog(entry) {
  const log = fbGetLog();
  log.unshift(entry);
  localStorage.setItem('fbSentLog', JSON.stringify(log.slice(0, FB_LOG_MAX)));
}

// 送ってよいか。だめなら理由の文言を返す（子どもを責めない言い方にする）
function fbBlockReason(kind, qid, reason) {
  if (!state.nickname) return '受験番号が わかりません';
  if (fbQuotaLeft() <= 0) return 'きょうは たくさん おしえて くれたね！つづきは あした きかせてな😊';
  const last = Number(localStorage.getItem('fbLastSentAt') || 0);
  if (Date.now() - last < FB_COOLDOWN_MS) return 'ちょっと まってね（1分あけて おくれるよ）';
  if (kind === 'question' && fbGetLog().some(e => e.qid === qid && e.reason === reason)) {
    return 'もう おしえて くれてるよ！ありがとう🙏';
  }
  return null;
}

// 実際に送る。ローカルの連番がズレていたら1回だけ +1 して やり直す。
// （端末のキャッシュを消すと連番が0に戻り、すでに埋まっているIDを叩いてしまうため）
async function fbSend(payload, kind) {
  let seq = fbSeq();
  let code = await saveFeedback(state.nickname, fbDocId(state.nickname, seq), payload);
  if (code === 'duplicate' && seq + 1 < FB_DAILY_LIMIT) {
    seq += 1;
    code = await saveFeedback(state.nickname, fbDocId(state.nickname, seq), payload);
  }
  if (code === 'ok') {
    localStorage.setItem(fbSeqKey(), String(seq + 1));
    localStorage.setItem('fbLastSentAt', String(Date.now()));
    fbPushLog({ ts: Date.now(), kind, qid: payload.qid || '', reason: payload.reason,
                comment: String(payload.comment || '').slice(0, 30) });
  }
  return code;
}

// オフラインのとき、compat SDK は書き込みをローカルに溜めて await が返ってこない。
// 待ち続けると画面が固まって見えるので、8秒で切り上げて「あとで とどく」と伝える。
function fbWithTimeout(promise) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve('queued'), 8000)),
  ]);
}

const FB_RESULT_MSG = {
  'queued':      '📶 いま ネットが ないみたい。つながったら とどくよ',
  'no-firebase': '📶 ネットに つながっていません',
  'no-nickname': '受験番号が わかりません',
  'duplicate':   'きょうは たくさん おしえて くれたね！つづきは あした😊',
  'save-failed': '❌ おくれませんでした。もう一度おしてね',
};

// 送信ボタンの共通処理（押しっぱなしの二重送信を止める）
async function fbSubmit(btn, payload, kind, okMsg) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳';
  showToast('📮 おくっています…', 8000);
  let code;
  try {
    code = await fbWithTimeout(fbSend(payload, kind));
  } catch (e) {
    code = 'save-failed';
  }
  btn.disabled = false; btn.textContent = label;
  if (code === 'ok') {
    showToast(okMsg, 2600);
    if (window.Snd) Snd.correct();
  } else {
    showToast(FB_RESULT_MSG[code] || 'おくれませんでした', 3000);
  }
  return code;
}

// 端末・版数を付ける（どの版で起きたかが分からないと不具合を追えない）
function fbEnv() {
  return { ver: String(latestAppVer || '').slice(0, 24),
           ua:  String(navigator.userAgent || '').slice(0, 160) };
}

// 理由ボタン（1つだけ選べる）。選択中は .on。
function fbWireReasonRow(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.querySelectorAll('.fb-reason-btn').forEach(btn => {
    btn.onclick = () => {
      row.querySelectorAll('.fb-reason-btn').forEach(b => b.classList.toggle('on', b === btn));
      if (window.Snd) Snd.tap();
    };
  });
}
function fbPickedReason(rowId) {
  const el = document.querySelector('#' + rowId + ' .fb-reason-btn.on');
  return el ? el.dataset.reason : null;
}
function fbClearReason(rowId) {
  document.querySelectorAll('#' + rowId + ' .fb-reason-btn').forEach(b => b.classList.remove('on'));
}

// ── 🚩 もんだいの通報 ──────────────────────────────

function openReportModal() {
  if (!reportCtx) { showToast('いま といてる もんだいが ないよ'); return; }
  const meta = [
    reportCtx.grade ? '小' + reportCtx.grade : '',
    { kokugo:'国語', sansu:'算数', rika:'理科', shakai:'社会' }[reportCtx.subject] || reportCtx.subject,
    reportCtx.unit || reportCtx.cat || '',
  ].filter(Boolean).join('・');
  document.getElementById('report-q-preview').textContent =
    reportCtx.question ? reportCtx.question.slice(0, 60) + (reportCtx.question.length > 60 ? '…' : '')
                       : '（もんだい文が とれませんでした）';
  document.getElementById('report-q-meta').textContent = meta;
  document.getElementById('report-comment').value = '';
  fbClearReason('report-reason-row');
  document.getElementById('report-modal').classList.remove('hidden');
  if (window.Snd) Snd.tap();
}

function closeReportModal() {
  document.getElementById('report-modal').classList.add('hidden');
}

async function sendReport(btn) {
  const reason = fbPickedReason('report-reason-row');
  if (!reason)    { showToast('どこが へんか えらんでね'); return; }
  if (!reportCtx) { showToast('いま といてる もんだいが ないよ'); closeReportModal(); return; }

  const blocked = fbBlockReason('question', reportCtx.qid, reason);
  if (blocked) { showToast(blocked, 3000); return; }

  // 空文字のフィールドは送らない。ルールは長さしか見ていないが、
  // 管理ツールで「値が無い」と「空文字」が混ざると読みにくいため。
  const payload = { kind: 'question', reason, ...fbEnv() };
  const comment = document.getElementById('report-comment').value.trim();
  if (comment) payload.comment = comment.slice(0, 500);
  for (const k of ['qid','subject','cat','unit','difficulty','question','answer','screen']) {
    if (reportCtx[k]) payload[k] = String(reportCtx[k]);
  }
  if (typeof reportCtx.grade === 'number') payload.grade = reportCtx.grade;

  const code = await fbSubmit(btn, payload, 'question', '🚩 おしえてくれて ありがとう！');
  if (code === 'ok' || code === 'queued') closeReportModal();
}

// ── 📮 いけんばこ ────────────────────────────────

function initFeedbackScreen() {
  fbClearReason('fb-reason-row');
  document.getElementById('fb-comment').value = '';
  document.getElementById('fb-subject').value = 'app';
  document.getElementById('fb-quota').textContent =
    `きょうは あと ${fbQuotaLeft()}かい おくれるよ`;
  renderFbSentList();
}

// クラウドの feedback は管理者しか読めないので、一覧はローカルの控えから描く
function renderFbSentList() {
  const box = document.getElementById('fb-sent-list');
  const log = fbGetLog();
  box.innerHTML = '';
  if (log.length === 0) {
    const p = document.createElement('p');
    p.className = 'fb-sent-empty';
    p.textContent = 'まだ なにも おくっていません。';
    box.appendChild(p);
    return;
  }
  log.forEach(e => {
    const d = new Date(e.ts);
    const item = document.createElement('div');
    item.className = 'fb-sent-item';
    const head = document.createElement('p');
    head.className = 'fb-sent-head';
    head.textContent = `${d.getMonth() + 1}/${d.getDate()} ${e.kind === 'question' ? '🚩 もんだい' : '📮 いけん'}`
                     + '　' + (FB_REASON_LABEL[e.reason] || '');
    const body = document.createElement('p');
    body.className = 'fb-sent-body';
    body.textContent = e.comment || e.qid || '';
    item.appendChild(head);
    if (body.textContent) item.appendChild(body);
    box.appendChild(item);
  });
}

async function sendIdea(btn) {
  const reason = fbPickedReason('fb-reason-row');
  if (!reason) { showToast('どんな はなしか えらんでね'); return; }
  const comment = document.getElementById('fb-comment').value.trim();
  if (!comment) { showToast('なにか かいてね'); return; }

  const blocked = fbBlockReason('idea', '', reason);
  if (blocked) { showToast(blocked, 3000); return; }

  const payload = {
    kind: 'idea', reason,
    comment: comment.slice(0, 500),
    subject: document.getElementById('fb-subject').value,
    screen: 'feedback',
    ...fbEnv(),
  };
  const code = await fbSubmit(btn, payload, 'idea', '📮 おくったで！ありがとう');
  if (code === 'ok') {
    document.getElementById('fb-comment').value = '';
    fbClearReason('fb-reason-row');
    initFeedbackScreen();
  }
}

// ── 配線 ───────────────────────────────────────
// 通報ボタンは4画面に置いてあるので、まとめて1回だけつなぐ（.back-btn と同じ流儀）
document.querySelectorAll('.btn-report').forEach(btn => { btn.onclick = openReportModal; });
fbWireReasonRow('report-reason-row');
fbWireReasonRow('fb-reason-row');
document.getElementById('report-close').onclick = closeReportModal;
document.getElementById('report-send').onclick  = function () { sendReport(this); };
document.getElementById('btn-fb-send').onclick  = function () { sendIdea(this); };

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

