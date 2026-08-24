// ============================================================
// audio.js — 音（WebAudio で その場で合成する。音のファイルは使わない）
//   ・iPhone は 最初のタップまで 音が出ない決まりなので、そこで起こす
//   ・「おす」は 木のこすれる音、「入った」は 鈴の音、で 手ごたえを分ける
// ============================================================
'use strict';

const OKSnd = (function () {
  let ctx = null, master = null, on = true, noiseBuf = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    // ざらざらの音のもと（こすれ・ほこり用）
    const n = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  addEventListener('pointerdown', ensure, { once: false, passive: true });
  addEventListener('keydown', ensure, { passive: true });

  function tone(freq, t0, dur, type, vol, slideTo) {
    if (!on || !ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    const t = ctx.currentTime + t0;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(t0, dur, vol, f0, f1, q) {
    if (!on || !ensure()) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    const g = ctx.createGain();
    const t = ctx.currentTime + t0;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    bp.Q.value = q || 1.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  return {
    // ★BGMと同じ AudioContext を使う（2つ作ると iPhone で片方が鳴らなくなる）
    ctx() { return ensure(); },
    toggle() {
      on = !on;
      if (on) ensure();
      if (window.OKBgm) OKBgm.setOn(on);
      return on;
    },
    isOn() { return on; },
    // ぺた、と歩く
    step() { noise(0, 0.06, 0.10, 900, 320, 0.9); },
    // ずずっ、と おす（木のこすれ）
    push() {
      noise(0, 0.17, 0.20, 380, 180, 1.6);
      tone(120, 0, 0.13, 'triangle', 0.10, 92);
    },
    // おきばに ぴたっと入った
    fit() {
      tone(1046, 0, 0.20, 'sine', 0.16);
      tone(1568, 0.04, 0.24, 'sine', 0.11);
      noise(0, 0.10, 0.06, 3800, 1800, 2.0);
    },
    // ぜんぶ かたづいた
    clear() {
      const s = [523, 659, 784, 1046, 1318];
      s.forEach((f, i) => {
        tone(f, i * 0.085, 0.42, 'triangle', 0.16);
        tone(f * 2, i * 0.085 + 0.01, 0.30, 'sine', 0.06);
      });
      noise(0.42, 0.5, 0.05, 5000, 900, 1.0);
    },
    undo() { tone(520, 0, 0.11, 'sine', 0.11, 300); },
    reset() { noise(0, 0.28, 0.10, 300, 1800, 0.8); },
    // かべに当たった（罰ではなく「そっちは無理やで」の合図）
    bump() { tone(150, 0, 0.09, 'square', 0.07, 96); },
    // もう動かせない形になった
    stuck() {
      tone(392, 0, 0.20, 'triangle', 0.11);
      tone(311, 0.16, 0.34, 'triangle', 0.11);
    },
  };
})();

window.OKSnd = OKSnd;
