// ============================================================
// 宇宙探究 SOLARIS の入口（2026-10-06・2026-10-15 変更）
//   SOLARIS は OTON LAB の公開先（otonlab.github.io/solaris/）へ移った。
//   バナーを押したら、SOLARIS のページへそのまま移動する（埋め込みはやめた＝SOLARIS 側の［‹ オトン学園へ戻る］も無い）。
//   戻るときはブラウザの戻る（ホーム画面のアプリでは、開いた画面の［完了］）。遊び券は消費しない。
// ============================================================

const SOLARIS_URL = 'https://otonlab.github.io/solaris/';

function initSolaris() {
  location.assign(SOLARIS_URL);
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
