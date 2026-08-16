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

// 学年は算数ホーム(STEP1)で選択済みのものを使う（虎の巻で選び直させない）
const toraGradeNow = () => sansuState.grade || 6;
// その学年で読める巻物 = 学年以下のカード（小6は全部＝復習にも使える）
const toraVisible = (data, grade) => data.filter(c => (c.grade || 6) <= grade);

async function initToraHome() {
  showLoading();
  try {
    const data = await loadToraData();
    const toraGrade = toraGradeNow();
    // 旧HTMLキャッシュと混在してもカード表示を止めないようガード
    const label = document.getElementById('tora-grade-label');
    if (label) label.textContent = `いまは小${toraGrade}の巻物まで出ているよ（学年は算数ホームで変えられます）。`;

    const grid = document.getElementById('tora-cat-grid');
    grid.innerHTML = '';

    const visible = toraVisible(data, toraGrade);
    const counts = {};
    visible.forEach(card => { counts[card.category] = (counts[card.category] || 0) + 1; });

    Object.entries(TORA_CATEGORIES).forEach(([cat, info]) => {
      const n = counts[cat] || 0;
      if (n === 0) return; // その学年で読める巻物がないカテゴリは出さない
      const btn = document.createElement('button');
      btn.className = 'cat-card';
      btn.dataset.toraCat = cat;
      btn.innerHTML = `
        <span class="cat-icon">${info.icon}</span>
        <span class="cat-name">${info.label}</span>
        <span class="cat-count">${n}巻</span>
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
    // 学年でしぼり、やさしい学年の巻から順にならべる
    const cards = toraVisible(data, toraGradeNow())
      .filter(c => c.category === cat)
      .sort((a, b) => (a.grade || 6) - (b.grade || 6));
    const info = TORA_CATEGORIES[cat] || { label: cat, icon: '📕' };

    document.getElementById('tora-cat-title').textContent = `${info.icon} ${info.label}`;

    const chip = g => `<span class="tora-grade-chip tora-grade-chip-g${g}">小${g}</span>`;
    const nav = document.getElementById('tora-cat-nav');
    nav.innerHTML = cards.map((c, i) => `<a href="#tora-card-${i}" class="tora-nav-link">${chip(c.grade || 6)}${c.title}</a>`).join('') + '<p class="tora-card-zoom-hint">🔍 図をタップすると拡大できます</p>';

    const list = document.getElementById('tora-cat-list');
    if (!cards.length) {
      list.innerHTML = '<p class="tora-empty">このカテゴリはまだ準備中です。</p>';
    } else {
      list.innerHTML = cards.map((c, i) => `
        <section id="tora-card-${i}" class="tora-card">
          <h3 class="tora-card-title">${chip(c.grade || 6)}${c.title}</h3>
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
    // ★密度がちょうど1.0のときは浮きも沈みもせず水中で止まる。
    //   density < 1 の2分岐だと、この状態が「しずんだ」と表示されていた（400通りのうち20通り）。
    const state = density < 1 ? 'float' : (density > 1 ? 'sink' : 'balance');
    const floats = state === 'float';
    const finalY = state === 'float' ? 50 : (state === 'sink' ? 90 : 70);
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
      title: state === 'float' ? '🎈 浮いた！' : (state === 'sink' ? '⬇️ しずんだ…' : '⚖️ 水中で止まった！'),
      text: `密度（1cm³あたりの重さ）は ${v.weight}g ÷ ${v.volume}cm³ ＝ ${density}g/cm³ です。`
        + (state === 'balance'
            ? `水の密度（1g/cm³）と<b>ちょうど同じ</b>なので、浮きも沈みもせず水の中で止まります。`
            : `水の密度（1g/cm³）より${floats ? '小さい' : '大きい'}ので、この物体は${floats ? '浮きます' : 'しずみます'}。`)
        + `<br>このとき物体が押しのける水は ${v.volume}cm³ ＝ <b>${v.volume}g</b> で、これがそのまま<b>浮力</b>の大きさです。`
        + `物体の重さ${v.weight}gと浮力${v.volume}gをくらべて、${state === 'float' ? '浮力のほうが大きいから浮く' : (state === 'sink' ? '重さのほうが大きいから沈む' : '同じだからつり合って止まる')}——と考えても同じ答えになります。`
    };
  }
};
