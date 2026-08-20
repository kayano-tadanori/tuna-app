// ============================================================
// チッチジャンプ3D の橋渡し
//   本体は lab/chicchi-jump-3d/ にあり、iframe で隔離して読み込む。
//   （自作WebGL2レンダラ側のグローバル名やCSSが本体とぶつからないように）
//   ・1プレイごとに遊び券を1まい消費する（リトライも1プレイ）
//   ・ゲームオーバーのスコアは saveGameScore('jump3d', …) へ
//   ・2D版（チッチジャンプ2 / js/jump.js）はそのまま残してある。別ゲーム扱い。
// ============================================================

const JUMP3D_COST = 1;                      // 1プレイに必要な遊び券
const JUMP3D_SRC = 'lab/chicchi-jump-3d/index.html?embed=1';

function initChicchiJump3D() {
  const f = document.getElementById('cj-frame');
  if (!f) return;
  // 毎回読み直す（前回の音・ループを確実に止めるため）
  f.src = JUMP3D_SRC + '&t=' + Date.now();
}

function stopChicchiJump3D() {
  const f = document.getElementById('cj-frame');
  if (!f) return;
  f.src = 'about:blank';
}

// iframe からの連絡
window.addEventListener('message', e => {
  const f = document.getElementById('cj-frame');
  if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
  const d = e.data || {};

  if (d.type === 'cj-ready') {
    // ニックネームを渡してランキングの名前をそろえる
    const nick = (typeof state === 'object' && state && state.nickname) ? state.nickname : '';
    f.contentWindow.postMessage({ type: 'cj-name', name: nick, cost: JUMP3D_COST }, '*');

  } else if (d.type === 'cj-start-request') {
    // プレイ開始のたびに遊び券を1まい
    if (spendGameTickets(JUMP3D_COST)) {
      f.contentWindow.postMessage({ type: 'cj-start-ok' }, '*');
    } else {
      f.contentWindow.postMessage({
        type: 'cj-start-deny',
        msg: `遊び券が${JUMP3D_COST}まい要るで（のこり${getGameTickets()}まい）`,
      }, '*');
    }

  } else if (d.type === 'cj-score') {
    if (typeof saveGameScore === 'function' && typeof state === 'object' && state && state.nickname) {
      saveGameScore('jump3d', state.nickname, d.score, 'max');
    }

  } else if (d.type === 'cj-rank') {
    if (typeof showGameRanking === 'function') showGameRanking('jump3d', 'チッチジャンプ3D', 'max');

  } else if (d.type === 'cj-exit') {
    stopChicchiJump3D();
    showScreen('subject');
  }
});
