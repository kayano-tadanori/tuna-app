// ============================================================
// おとんテトリス2 の橋渡し
//   本体は lab/tetris2/ にあり、iframe で隔離して読み込む。
//   （自作WebGL2レンダラ側のグローバル名やCSSが本体とぶつからないように）
//   ・1プレイごとに遊び券を1まい消費する（リトライも1プレイ）
//   ・2026-08-20: 3まい→1まいに変更（本人指示）。他の息抜きゲームと同じ枚数にそろえた
//   ・ゲームオーバーのスコアは saveGameScore('tetris2', …) へ
//   ・💣ボム・🐢スローは本体のお助けアイテム（勉強でもらう）を使う（2026-10-15）。
//     前は試作のまま毎回2こずつ配っていた。チッチジャンプ3D（js/jump3d-embed.js）と同じ形
// ============================================================

const TETRIS2_COST = 1;                     // 1プレイに必要な遊び券
const TETRIS2_SRC = 'lab/tetris2/index.html?embed=1';

function initTetris2() {
  const f = document.getElementById('t2-frame');
  if (!f) return;
  // 毎回読み直す（前回の音・ループを確実に止めるため）
  f.src = TETRIS2_SRC + '&t=' + Date.now();
}

// 🎒 いま持っているボム・スローの数を iframe へ知らせる
function sendTetris2Items(f) {
  if (!f || !f.contentWindow || typeof getItems !== 'function') return;
  const it = getItems();
  f.contentWindow.postMessage({
    type: 't2-items',
    items: { bomb: it.bomb || 0, slow: it.slow || 0 },
  }, '*');
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
    f.contentWindow.postMessage({ type: 't2-name', name: nick, cost: TETRIS2_COST }, '*');
    sendTetris2Items(f);

  } else if (d.type === 't2-use-item') {
    // 財布の持ち主は本体。iframe の中では減らせないので、ここで減らす
    if (typeof addItem === 'function' && (d.kind === 'bomb' || d.kind === 'slow')) {
      if ((getItems()[d.kind] || 0) > 0) addItem(d.kind, -1);
    }
    // ★減らしたあとの本当の数を返す（ゲーム側は先に1つ減らして見せている）
    sendTetris2Items(f);

  } else if (d.type === 't2-start-request') {
    // プレイ開始のたびに遊び券を1まい
    if (spendGameTickets(TETRIS2_COST)) {
      sendTetris2Items(f);     // 遊んでいる間にもらって増えていることがある（start-ok より先に）
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
