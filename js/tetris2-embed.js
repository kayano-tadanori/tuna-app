// ============================================================
// おとんテトリス2 の橋渡し
//   本体は lab/tetris2/ にあり、iframe で隔離して読み込む。
//   （自作WebGL2レンダラ側のグローバル名やCSSが本体とぶつからないように）
//   ・1プレイごとに遊び券を3まい消費する（リトライも1プレイ）
//   ・ゲームオーバーのスコアは saveGameScore('tetris2', …) へ
// ============================================================

const TETRIS2_COST = 3;                     // 1プレイに必要な遊び券
const TETRIS2_SRC = 'lab/tetris2/index.html?embed=1';

function initTetris2() {
  const f = document.getElementById('t2-frame');
  if (!f) return;
  // 毎回読み直す（前回の音・ループを確実に止めるため）
  f.src = TETRIS2_SRC + '&t=' + Date.now();
}

function stopTetris2() {
  const f = document.getElementById('t2-frame');
  if (!f) return;
  f.src = 'about:blank';
}

// iframe からの連絡
window.addEventListener('message', e => {
  const f = document.getElementById('t2-frame');
  if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
  const d = e.data || {};

  if (d.type === 't2-ready') {
    // ニックネームを渡してランキングの名前をそろえる
    const nick = (typeof state === 'object' && state && state.nickname) ? state.nickname : '';
    f.contentWindow.postMessage({ type: 't2-name', name: nick }, '*');

  } else if (d.type === 't2-start-request') {
    // プレイ開始のたびに遊び券を3まい
    if (spendGameTickets(TETRIS2_COST)) {
      f.contentWindow.postMessage({ type: 't2-start-ok' }, '*');
    } else {
      f.contentWindow.postMessage({
        type: 't2-start-deny',
        msg: `遊び券が${TETRIS2_COST}まい要るで（のこり${getGameTickets()}まい）`,
      }, '*');
    }

  } else if (d.type === 't2-score') {
    if (typeof saveGameScore === 'function' && typeof state === 'object' && state && state.nickname) {
      saveGameScore('tetris2', state.nickname, d.score, 'max');
    }

  } else if (d.type === 't2-exit') {
    stopTetris2();
    showScreen('subject');
  }
});
