// ============================================================
// 単元でさがす（算数・理科の検索）
// data/search_index.json（scripts/gen_search_index.py --write で生成）を読み、
// 単元名（例：つるかめ算）と本文でヒットした問題を一覧にし、
// タップした1問を既存の算数クイズ画面（sansuState / renderSansuQuiz）にそのまま流し込む。
// 「検索結果にもどる」は sansuState.searchReturnCtx（js/sansu.js の daimonPickerCtx と同型）で制御する。
// ============================================================

let searchIndexCache = null;
let searchGrade = 'all';
let searchFromSubject = 'sansu'; // どちらのホームから開いたか（戻る先の判定用）

async function loadSearchIndex() {
  if (searchIndexCache) return searchIndexCache;
  const res = await fetch('data/search_index.json');
  searchIndexCache = await res.json();
  return searchIndexCache;
}

// カタカナ→ひらがな、全角英数→半角、小文字化。scripts/gen_search_index.py の normalize と対にする
function normalizeSearchText(s) {
  s = String(s || '');
  let out = '';
  for (const c of s) {
    const code = c.codePointAt(0);
    out += (code >= 0x30A1 && code <= 0x30F6) ? String.fromCodePoint(code - 0x60) : c;
  }
  out = out.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  return out.toLowerCase();
}

function openSearchScreen(subject) {
  searchFromSubject = subject;
  const backBtn = document.querySelector('#screen-search .back-btn');
  if (backBtn) backBtn.dataset.back = subjectHome(subject);
  showScreen('search');
  document.getElementById('search-input').focus();
}

async function doSearch(query) {
  const list = document.getElementById('search-result-list');
  const status = document.getElementById('search-status');
  const norm = normalizeSearchText(query);
  if (!norm) {
    list.innerHTML = '';
    status.textContent = '';
    return;
  }
  status.textContent = 'さがしています…';
  const index = await loadSearchIndex();
  const gradeNum = searchGrade === 'all' ? null : Number(searchGrade);
  const matchGrade = (item) => gradeNum === null || item.grade === gradeNum;
  // ★算数ホームから開いたら算数だけ、理科ホームから開いたら理科だけを出す（本人要望2026-08-17）
  const matchSubject = (item) => item.subject === searchFromSubject;

  const unitHits = [];
  const textHits = [];
  for (const item of index) {
    if (!matchSubject(item) || !matchGrade(item)) continue;
    if (item.ut && item.ut.includes(norm)) { unitHits.push(item); continue; }
    if (item.t.includes(norm)) textHits.push(item);
  }

  if (!unitHits.length && !textHits.length) {
    status.textContent = 'みつかりませんでした';
    list.innerHTML = '';
    return;
  }
  status.textContent = `${unitHits.length + textHits.length}件みつかりました`;
  renderSearchResults(unitHits, textHits, query);
}

const SUBJECT_LABEL = { sansu: '算数', rika: '理科' };
const DIFF_LABEL_SEARCH = { 1: 'やさしい', 2: '難しい', 3: 'チャレンジ', 4: '激ムズ' };

function searchResultItemHtml(item, idx) {
  const diffLabel = DIFF_LABEL_SEARCH[item.difficulty] || '';
  return `<button class="custom-item search-result-item" type="button" data-idx="${idx}">
    <span class="search-result-badges">
      <span class="badge-subject" data-subject="${item.subject}">${SUBJECT_LABEL[item.subject] || item.subject}</span>
      <span class="badge-grade">小${item.grade}</span>
      ${diffLabel ? `<span class="badge-diff" data-level="${item.difficulty}">${diffLabel}</span>` : ''}
    </span>
    <span class="custom-item-q">${item.q}</span>
  </button>`;
}

function renderSearchResults(unitHits, textHits, query) {
  const list = document.getElementById('search-result-list');
  const flat = unitHits.concat(textHits);
  let html = '';
  if (unitHits.length) {
    // ★unitHitsは「文字と式」のようなtagsで複数の異なるunitをまたぐことがあるので、
    //   1件目のunit名ではなく、入力された検索語そのものを見出しにする（本人要望2026-08-17で追加したtags対応）
    html += `<div class="search-result-group-label">「${query}」に近い単元（${unitHits.length}問）</div>`;
    html += unitHits.map((item, i) => searchResultItemHtml(item, i)).join('');
  }
  if (textHits.length) {
    html += `<div class="search-result-group-label">本文にことばがある問題（${textHits.length}問）</div>`;
    html += textHits.map((item, i) => searchResultItemHtml(item, unitHits.length + i)).join('');
  }
  list.innerHTML = html;
  list.querySelectorAll('.search-result-item').forEach(btn => {
    btn.onclick = () => startSansuFromSearch(flat[Number(btn.dataset.idx)]);
  });
}

async function startSansuFromSearch(item) {
  const full = await ensureSansuFile(item.subject, item.cat);
  const q = full.find(x => x.id === item.id);
  if (!q) { showToast('問題が見つかりませんでした'); return; }
  sansuState.subject = item.subject;
  sansuState.cat = item.cat;
  sansuState.grade = item.grade;
  sansuState.diff = item.difficulty;
  sansuState.mode = 'normal';
  sansuState.questions = [q];
  sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
  coinSessionEarned = 0;
  startSansuQuiz();
  sansuState.searchReturnCtx = true; // startSansuQuizのリセットの後でセット（daimonPickerCtxと同じ順序）
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ★他のscript（app.js等）と同じく、bodyの末尾で読まれる前提の即時配線。
//   DOMContentLoaded待ちにすると、このscriptタグ自体がDOM構築の最後に来るため
//   イベントが既に発火済みでハンドラが一生呼ばれない事故になる（このアプリの規約）。
(() => {
  const input = document.getElementById('search-input');
  if (!input) return; // #screen-search が無いページ（無いはずだが念のため）
  const runSearch = debounce(() => doSearch(input.value), 200);
  input.addEventListener('input', runSearch);

  document.querySelectorAll('#screen-search [data-search-grade]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#screen-search [data-search-grade]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      searchGrade = btn.dataset.searchGrade;
      doSearch(input.value);
    };
  });
})();
