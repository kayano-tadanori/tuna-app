// ============================================================
// progress.js — 灘中対策コーナーの正解記録（端末内localStorageのみ、本体Firestoreとは無関係）
// ============================================================
'use strict';

const OrigamiProgress = (function () {
  const KEY = 'ori-nada-correct-v1';
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function markCorrect(id) {
    try {
      const data = load();
      data[id] = true;
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* プライベートモード等で書けなくても無視 */ }
  }
  function isCorrect(id) {
    return !!load()[id];
  }
  return { markCorrect, isCorrect };
})();

if (typeof window !== 'undefined') window.OrigamiProgress = OrigamiProgress;
