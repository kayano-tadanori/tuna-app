// ============================================================
// オカンの おかたづけ の橋渡し
//   本体は lab/okatazuke/ にあり、iframe で隔離して読み込む。
//   （自作WebGL2レンダラ側のグローバル名やCSSが本体とぶつからないように）
//
//   ★遊び券は「1まいで入場」。中では 何面でも・何回でも やりなおせる。
//     パズルは 試行錯誤そのものが 遊びなので、1面ごとに取ると
//     「まちがえるのがこわい」になってしまう（NotebookLM資料：詰んだら
//      もどす／やりなおすのが 前提の遊び）。
//
//   ・記録（クリアした面・最少手数）は localStorage の 'okatazukeSave'。
//     iframe と本体は 同じオリジンなので、そのまま本体からも読める。
//     ★BACKUP_KEYS と firestore.rules の両方に足してある（片方だけだと
//       hasOnly が丸ごと拒否して 記録が無言で消える）
// ============================================================

const OKATAZUKE_COST = 1;                    // 入場に必要な遊び券
const OKATAZUKE_SRC = 'lab/okatazuke/index.html?embed=1';

function initOkatazuke() {
  const f = document.getElementById('oz-frame');
  if (!f) return;
  // 毎回読み直す（前回の音・ループを確実に止めるため）
  f.src = OKATAZUKE_SRC + '&t=' + Date.now();
}

function stopOkatazuke() {
  const f = document.getElementById('oz-frame');
  if (!f) return;
  f.src = 'about:blank';
}

window.addEventListener('message', e => {
  const f = document.getElementById('oz-frame');
  if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
  const d = e.data || {};

  if (d.type === 'okz-ready') {
    const nick = (typeof state === 'object' && state && state.nickname) ? state.nickname : '';
    f.contentWindow.postMessage({ type: 'okz-name', name: nick, cost: OKATAZUKE_COST }, '*');

  } else if (d.type === 'okz-start-request') {
    // 入場のときだけ 券を1まい
    if (typeof spendGameTickets === 'function' && spendGameTickets(OKATAZUKE_COST)) {
      f.contentWindow.postMessage({ type: 'okz-start-ok' }, '*');
    } else {
      const left = (typeof getGameTickets === 'function') ? getGameTickets() : 0;
      f.contentWindow.postMessage({
        type: 'okz-start-deny',
        msg: `遊び券が${OKATAZUKE_COST}まい要るで（のこり${left}まい）`,
      }, '*');
    }

  } else if (d.type === 'okz-progress') {
    // クリアした面の数を きょうだいランキングへ
    if (typeof saveGameScore === 'function' && typeof state === 'object' && state && state.nickname) {
      saveGameScore('okatazuke', state.nickname, d.cleared | 0, 'max');
    }

  } else if (d.type === 'okz-exit') {
    stopOkatazuke();
    showScreen('subject');
  }
});
