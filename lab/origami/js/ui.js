// ============================================================
// ui.js — 灘中対策コーナーの答え合わせUI
//   問題文表示・テンキー入力・採点・解説表示。
//   入力形式は「65.625」のような小数、または「65と5/8」のような帯分数のどちらも許す
//   （オトン学園本体のテンキー入力の慣習に合わせる）。
// ============================================================
'use strict';

const OrigamiUI = (function () {
  // 「65と5/8」「5/8」「65.625」のいずれも数値に変換する
  function parseAnswer(raw) {
    const s = String(raw).trim();
    if (s === '') return null;
    let m = s.match(/^(-?\d+)と(\d+)\/(\d+)$/); // 帯分数
    if (m) {
      const whole = Number(m[1]), num = Number(m[2]), den = Number(m[3]);
      if (den === 0) return null;
      return whole + (whole < 0 ? -1 : 1) * (num / den);
    }
    m = s.match(/^(-?\d+)\/(\d+)$/); // 単純分数
    if (m) {
      const den = Number(m[2]);
      if (den === 0) return null;
      return Number(m[1]) / den;
    }
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  function checkAnswer(problem, raw) {
    const v = parseAnswer(raw);
    if (v === null) return { ok: false, reason: 'unparsable' };
    const tol = problem.answer.tolerance !== undefined ? problem.answer.tolerance : 1e-6;
    const ok = Math.abs(v - problem.answer.value) <= tol;
    return { ok, reason: ok ? 'correct' : 'wrong', parsed: v };
  }

  // problemPanelEl 配下に問題文・入力欄・採点結果・解説を組み立てる。
  // onSubmit(rawText) はUI側から呼ばれるコールバック（本体側の記録用に空でも良い）
  //
  // ★本人指示（2026-08-30）で解説の出し方を変更：
  //   ①正解してもすぐには解説を出さない（パネルが大きくなって折り紙が見えなくなるため）。
  //     「解説を見る」ボタンを押した人だけ広げる。
  //   ②不正解のときも解説は出さない（ヒントにならず答えを教えるだけになるため）。
  //   ③「ギブアップ」ボタンでいつでも解説を見られるようにする（詰まったとき用）。
  //   ④パネル全体を折りたためるようにする（頭の部分をタップでたたむ/開く）。
  function mount(panelEl, problem, opts) {
    opts = opts || {};
    panelEl.innerHTML = `
      <div class="ori-prob-head" id="ori-prob-head">
        <span class="ori-prob-school">${problem.school}${problem.year ? ' ' + problem.year + '年' : ''}</span>
        <span class="ori-prob-name">${problem.name}</span>
        <button class="ori-prob-collapse-btn" id="ori-prob-collapse-btn" aria-label="たたむ/開く">▾</button>
      </div>
      <div class="ori-prob-body" id="ori-prob-body">
        <p class="ori-prob-text">${problem.promptText}</p>
        <div class="ori-prob-answer-row">
          <input type="text" inputmode="decimal" id="ori-answer-input" class="ori-answer-input" placeholder="例）65.625 または 65と5/8">
          <button id="ori-scratch-open" class="ori-scratch-open-btn">📝 計算用紙</button>
          <button id="ori-answer-submit" class="ori-answer-submit">こたえる</button>
        </div>
        <div id="ori-answer-result" class="ori-answer-result" hidden></div>
        <button id="ori-expl-toggle" class="ori-expl-toggle-btn" hidden>📖 解説を見る</button>
        <button id="ori-giveup-btn" class="ori-giveup-btn">🏳️ ギブアップして解説を見る</button>
        <div id="ori-explanation" class="ori-explanation" hidden></div>
      </div>
    `;
    const head = panelEl.querySelector('#ori-prob-head');
    const body = panelEl.querySelector('#ori-prob-body');
    const collapseBtn = panelEl.querySelector('#ori-prob-collapse-btn');
    const input = panelEl.querySelector('#ori-answer-input');
    const btn = panelEl.querySelector('#ori-answer-submit');
    const resultEl = panelEl.querySelector('#ori-answer-result');
    const explEl = panelEl.querySelector('#ori-explanation');
    const explToggleBtn = panelEl.querySelector('#ori-expl-toggle');
    const giveupBtn = panelEl.querySelector('#ori-giveup-btn');
    const scratchBtn = panelEl.querySelector('#ori-scratch-open');
    // 問題を開くたびに前の問題の書き込みを持ち越さない
    if (window.OrigamiScratch) OrigamiScratch.reset();
    scratchBtn.onclick = () => { if (window.OrigamiScratch) OrigamiScratch.open(); };

    function setCollapsed(collapsed) {
      panelEl.classList.toggle('ori-panel-collapsed', collapsed);
      collapseBtn.textContent = collapsed ? '▴' : '▾';
    }
    head.onclick = () => setCollapsed(!panelEl.classList.contains('ori-panel-collapsed'));

    function revealExplanation() {
      explEl.hidden = false;
      explToggleBtn.hidden = true;
      giveupBtn.hidden = true;
      explEl.innerHTML = '<p class="ori-expl-title">かいせつ</p><ol>'
        + problem.explanation.map(s => `<li>${s}</li>`).join('') + '</ol>';
      // ★解説を見た人だけ、補助点(P・Q)や補助線(垂線)を紙の上に出す（本人指示2026-08-30）。
      if (typeof opts.onRevealExplanation === 'function') opts.onRevealExplanation();
    }
    explToggleBtn.onclick = revealExplanation;
    giveupBtn.onclick = () => {
      resultEl.hidden = false;
      resultEl.textContent = `答えは ${problem.answer.display}${problem.answer.unit}`;
      resultEl.className = 'ori-answer-result ori-answer-warn';
      revealExplanation();
    };

    function submit() {
      const res = checkAnswer(problem, input.value);
      resultEl.hidden = false;
      if (res.reason === 'unparsable') {
        resultEl.textContent = '数字で入力してね（例：65.625 や 65と5/8）';
        resultEl.className = 'ori-answer-result ori-answer-warn';
      } else if (res.ok) {
        resultEl.textContent = `せいかい！（${problem.answer.display}${problem.answer.unit}）`;
        resultEl.className = 'ori-answer-result ori-answer-ok';
        // ★解説はここで自動的には広げない（パネルが伸びて折り紙が隠れるため）。
        //   見たい人だけ「解説を見る」を押す。
        explToggleBtn.hidden = false;
      } else {
        resultEl.textContent = 'おしい！もう一回、折り方を見直してみよう';
        resultEl.className = 'ori-answer-result ori-answer-ng';
      }
      if (typeof opts.onSubmit === 'function') opts.onSubmit(input.value, res);
    }
    btn.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  return { parseAnswer, checkAnswer, mount };
})();

if (typeof window !== 'undefined') window.OrigamiUI = OrigamiUI;
