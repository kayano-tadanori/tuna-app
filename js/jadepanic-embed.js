// ============================================================
// ジェイドパニック の橋渡し
//   本体は lab/jadepanic/ にあり、iframe で隔離して読み込む。
//   （自作WebGL2レンダラ側の R / G / Snd などのグローバル名が
//     本体の Snd などとぶつからないように）
//   ・1プレイごとに遊び券を1まい消費する（リトライも1プレイ）
//   ・ゲームオーバーのスコアは saveGameScore('jadepanic_モード_難易度', …) へ
//   ・クラウドのランキングを子に渡すと、プレイ中の「ライバル表示」に出る
// ============================================================

const JADEPANIC_COST = 1;                   // 1プレイに必要な遊び券
const JADEPANIC_SRC = 'lab/jadepanic/index.html?embed=1';

function initJadePanic() {
  const f = document.getElementById('jp-frame');
  if (!f) return;
  // 毎回読み直す（前回の音・ループを確実に止めるため）
  f.src = JADEPANIC_SRC + '&t=' + Date.now();
}

function stopJadePanic() {
  const f = document.getElementById('jp-frame');
  if (!f) return;
  f.src = 'about:blank';
}

// ランキングはモード×難易度ごとに分ける（混ぜると難易度差が意味を失う）
function jadePanicScoreKey(mode, diff) {
  const m = (mode === 'timeattack') ? 'time' : 'surv';
  const d = (diff === 'easy' || diff === 'hard') ? diff : 'normal';
  return `jadepanic_${m}_${d}`;
}

// iframe からの連絡
window.addEventListener('message', e => {
  const f = document.getElementById('jp-frame');
  if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
  const d = e.data || {};

  if (d.type === 'jp-ready') {
    // ニックネームを渡してランキングの名前をそろえる
    const nick = (typeof state === 'object' && state && state.nickname) ? state.nickname : '';
    f.contentWindow.postMessage({ type: 'jp-name', name: nick, cost: JADEPANIC_COST }, '*');

  } else if (d.type === 'jp-start-request') {
    // プレイ開始のたびに遊び券を1まい
    if (spendGameTicket()) {
      f.contentWindow.postMessage({ type: 'jp-start-ok' }, '*');
    } else {
      f.contentWindow.postMessage({
        type: 'jp-start-deny',
        msg: `遊び券が${JADEPANIC_COST}まい要るで（のこり${getGameTickets()}まい）`,
      }, '*');
    }

  } else if (d.type === 'jp-score') {
    if (typeof saveGameScore === 'function' && typeof state === 'object' && state && state.nickname) {
      saveGameScore(jadePanicScoreKey(d.mode, d.diff), state.nickname, d.score, 'max');
    }

  } else if (d.type === 'jp-rank-request') {
    // みんなの記録を子に返す（プレイ中のライバル表示と結果画面で使う）
    if (typeof getGameRanking !== 'function') return;
    getGameRanking(jadePanicScoreKey(d.mode, d.diff), 'max').then(list => {
      if (!list || !f.contentWindow) return;
      f.contentWindow.postMessage({
        type: 'jp-rank-data', mode: d.mode, diff: d.diff, list,
      }, '*');
    }).catch(() => {});

  } else if (d.type === 'jp-exit') {
    stopJadePanic();
    showScreen('subject');
  }
});
