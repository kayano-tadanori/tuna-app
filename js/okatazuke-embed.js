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
//   ・🔍サーチ（ヒント）と 🛡おまもり（ひっぱる）は 本体のお助けアイテムを使う（2026-10-15）。
//     チッチジャンプ3D・テトリス2と同じ形：数を 'okz-items' で渡し、使ったら 'okz-use-item' で減らす
// ============================================================

const OKATAZUKE_COST = 1;                    // 入場に必要な遊び券
const OKATAZUKE_SRC = 'lab/okatazuke/index.html?embed=1';

function initOkatazuke() {
  const f = document.getElementById('oz-frame');
  if (!f) return;
  // 毎回読み直す（前回の音・ループを確実に止めるため）
  f.src = OKATAZUKE_SRC + '&t=' + Date.now();
}

// 🎒 いま持っている サーチ・おまもり の数を iframe へ知らせる
function sendOkatazukeItems(f) {
  if (!f || !f.contentWindow || typeof getItems !== 'function') return;
  const it = getItems();
  f.contentWindow.postMessage({
    type: 'okz-items',
    items: { search: it.search || 0, shield: it.shield || 0 },
  }, '*');
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
    sendOkatazukeItems(f);

  } else if (d.type === 'okz-use-item') {
    // 財布の持ち主は本体。iframe の中では減らせないので、ここで減らす
    if (typeof addItem === 'function' && (d.kind === 'search' || d.kind === 'shield')) {
      if ((getItems()[d.kind] || 0) > 0) addItem(d.kind, -1);
    }
    sendOkatazukeItems(f);   // ★減らしたあとの本当の数を返す

  } else if (d.type === 'okz-start-request') {
    // 入場のときだけ 券を1まい
    if (typeof spendGameTickets === 'function' && spendGameTickets(OKATAZUKE_COST)) {
      sendOkatazukeItems(f);   // 遊んでいる間に もらって増えていることがある
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
