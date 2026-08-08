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
