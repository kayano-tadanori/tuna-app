// ============================================================
// 宇宙探究 SOLARIS の橋渡し（2026-10-06）
//   本体は別の置き場（GitHub Pages の /solaris/）にあり、折ONと同じく iframe で隔離して読み込む。
//   SOLARIS の［‹ オトン学園］を押すと 'solaris-exit' が届く → iframe を空にして（描画も音も止まる）ホームへ戻る。
//   遊び券は消費しない。
// ============================================================

const SOLARIS_URL = 'https://kayano-tadanori.github.io/solaris/';

function solarisSrc() {
  // 同じ github.io の上なら相対で（/tuna-app/ → /solaris/）。手元の確認では本番の URL を読む
  const base = /github\.io$/.test(location.hostname) ? '../solaris/' : SOLARIS_URL;
  return base + '?embed=1';
}

function initSolaris() {
  const f = document.getElementById('sol-frame');
  if (!f) return;
  // 折ONと同じ理由：本体の演出モーダルが開いたままだと iframe の中が押せない
  document.querySelectorAll('.gami-modal:not(.hidden)')
    .forEach(m => m.classList.add('hidden'));
  f.src = solarisSrc();
}

function stopSolaris() {
  const f = document.getElementById('sol-frame');
  if (!f) return;
  f.src = 'about:blank';
}

window.addEventListener('message', e => {
  const f = document.getElementById('sol-frame');
  if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
  const d = e.data || {};
  if (d.type === 'solaris-exit') {
    stopSolaris();
    showScreen('subject');
  }
});
