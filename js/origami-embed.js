// ============================================================
// 折り紙アプリ(みんなで作ろう) の橋渡し
//   本体は lab/origami/ にあり、iframe で隔離して読み込む。
//   （自作WebGL2レンダラ側のグローバル名やCSSが本体とぶつからないように）
//
//   ★遊び券は消費しない。灘中入試には毎年折り紙がらみの図形問題が出る＝
//     この折り紙アプリの最大の目的（灘中対策コーナー）であり、
//     息抜きゲームという体裁とは別に、誰でも何度でも使えるようにする
//     （2026-08-29本人指示。他の息抜きゲームのokz-start-request型の
//      遊び券ハンドシェイクは実装しない）。
// ============================================================

const ORIGAMI_SRC = 'lab/origami/index.html?embed=1';

function initOrigami() {
  const f = document.getElementById('ori-frame');
  if (!f) return;
  f.src = ORIGAMI_SRC + '&t=' + Date.now();
}

function stopOrigami() {
  const f = document.getElementById('ori-frame');
  if (!f) return;
  f.src = 'about:blank';
}

window.addEventListener('message', e => {
  const f = document.getElementById('ori-frame');
  if (!f || !f.contentWindow || e.source !== f.contentWindow) return;
  const d = e.data || {};

  if (d.type === 'ori-ready') {
    const nick = (typeof state === 'object' && state && state.nickname) ? state.nickname : '';
    f.contentWindow.postMessage({ type: 'ori-name', name: nick }, '*');

  } else if (d.type === 'ori-exit') {
    stopOrigami();
    showScreen('subject');
  }
});
