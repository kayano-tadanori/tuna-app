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

// 🎒 いま持っている道具の数を iframe へ知らせる
function sendJump3DItems(f) {
  if (!f || !f.contentWindow || typeof getItems !== 'function') return;
  const it = getItems();
  f.contentWindow.postMessage({
    type: 'cj-items',
    items: { wing: it.wing || 0, rocket: it.rocket || 0 },
  }, '*');
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
    sendJump3DItems(f);

  } else if (d.type === 'cj-use-item') {
    // 🎒 道具（🪽つばさ / 🚀ロケット）の持ち主は本体。
    //   ★iframe の中では数を減らせない（減らしたつもりでも、本体の財布は減らない）。
    //     前はゲーム側が core.useItem を直に呼んでいて、**何回でも使えた**。
    //   財布は テトリス・おかんスイーパー・チッチジャンプ2 と共通で、
    //   勉強のごほうび（ガチャ）でしか増えない。ここだけ無限だと土台が崩れる。
    if (typeof addItem === 'function' && (d.kind === 'wing' || d.kind === 'rocket')) {
      const items = getItems();
      if ((items[d.kind] || 0) > 0) addItem(d.kind, -1);
      if (typeof updateItemButtons === 'function') updateItemButtons();
    }
    // ★減らしたあとの本当の数を返す。ゲーム側はこれで上書きする
    //   （押した手ごたえのために先に1つ減らして見せているので、必ず答え合わせをする）。
    sendJump3DItems(f);

  } else if (d.type === 'cj-start-request') {
    // プレイ開始のたびに遊び券を1まい
    if (spendGameTickets(JUMP3D_COST)) {
      f.contentWindow.postMessage({ type: 'cj-start-ok' }, '*');
      sendJump3DItems(f);      // 遊んでいる間にガチャで増えていることがある
    } else {
      f.contentWindow.postMessage({
        type: 'cj-start-deny',
        msg: `遊び券が${JUMP3D_COST}まい要るで（のこり${getGameTickets()}まい）`,
      }, '*');
    }

  } else if (d.type === 'cj-score') {
    // 🏆 兄弟ランキングは**3軸**（プラン §3.9 / §7）。
    //   生スコアだけの1本の表にすると、弟が構造的に勝てない＝離脱装置になる。
    //     ① 今週のシードチャレンジ（同じ地形。週がわりでリセット）
    //     ② 自己ベストの更新幅（伸びしろで勝てる＝弟が有利になりうる）
    //     ③ 協力メーター（2人の合計距離。「兄弟で土星へ」）
    //   ★1つの記録に3つの数字は入れられない（firestore.rules が
    //     keys().hasOnly(['value','lastUpdated']) で縛っている）。
    //     だから**ゲームIDを分ける**。rules 側の gameIdOk にも足すこと。
    if (typeof saveGameScore === 'function' && typeof state === 'object' && state && state.nickname) {
      const nick = state.nickname;
      saveGameScore('jump3d', nick, d.score, 'max');
      // 端末の自己ベスト。★app.js の BACKUP_KEYS と firestore.rules に
      //   'jump3dBest' が入っていること（入っていないと端末を変えた瞬間に消える）。
      try {
        const cur = Number(localStorage.getItem('jump3dBest') || 0);
        if (d.score > cur) localStorage.setItem('jump3dBest', String(d.score));
      } catch (e) {}
      if (d.weekNo) saveGameScore('jump3d_w' + d.weekNo, nick, d.score, 'max');
      if (d.gain > 0) saveGameScore('jump3d_gain', nick, d.gain, 'max');
      if (d.coop > 0) saveGameScore('jump3d_coop', nick, d.coop, 'max');
      // 🚩 旗を立てる高さ。**score ではなく progress（到達点）**。
      //   点は⭐やボーナスで増えるので、点の順に旗を立てると
      //   「点は高いのに、そこまで登っていない」旗が道に立ってしまう。
      if (d.reach > 0) saveGameScore('jump3d_reach', nick, d.reach, 'max');
    }

  } else if (d.type === 'cj-flags-request') {
    // 🚩 みんなの到達点を子に返す（プレイ中に道ばたへ旗を立てる）。
    //   ★jadepanic の jp-rank-request と同じ形にそろえてある。
    if (typeof getGameRanking !== 'function') return;
    getGameRanking('jump3d_reach', 'max').then(list => {
      if (!list || !f.contentWindow) return;
      f.contentWindow.postMessage({ type: 'cj-flags-data', list }, '*');
    }).catch(() => {});

  } else if (d.type === 'cj-rank') {
    if (typeof showGameRanking === 'function') showGameRanking('jump3d', 'チッチジャンプ3D', 'max');

  } else if (d.type === 'cj-exit') {
    stopChicchiJump3D();
    showScreen('subject');
  }
});
