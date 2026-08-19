// ============================================================
// audio.js — WebAudio だけで作る音（音源ファイルなし）
//   バス: 音源 → (dry / reverb) → busSFX|busMusic → compressor → limiter → 出力
//   BGM: ctx.currentTime 基準の先読みスケジューラ（setIntervalのドリフト対策）
//        レベルが上がるとレイヤーが増える
// ============================================================
'use strict';

// ============================================================
// BGM その2「コロブチカ」
//   ロシア民謡（19世紀の行商人の歌）。曲そのものは著作権が切れている。
//   ベース・ドラム・和音づけ（編曲）はこのファイルで自作したもの。
//   16分音符を1ステップとして、16小節＝256ステップで1周する。
// ============================================================
const NOTE_SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function nf(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  const midi = NOTE_SEMI[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// [音名 または 0(休符), 長さ(16分いくつ分)]
const KORO_NOTES = [
  // ── A（速いところ）8小節 ──
  ['E5',4],['B4',2],['C5',2],['D5',4],['C5',2],['B4',2],
  ['A4',4],['A4',2],['C5',2],['E5',4],['D5',2],['C5',2],
  ['B4',6],['C5',2],['D5',4],['E5',4],
  ['C5',4],['A4',4],['A4',4],[0,4],
  [0,2],['D5',4],['F5',2],['A5',4],['G5',2],['F5',2],
  ['E5',6],['C5',2],['E5',4],['D5',2],['C5',2],
  ['B4',4],['B4',2],['C5',2],['D5',4],['E5',4],
  ['C5',4],['A4',4],['A4',4],[0,4],
  // ── B（ゆったりしたところ）8小節 ──
  ['E5',8],['C5',8],
  ['D5',8],['B4',8],
  ['C5',8],['A4',8],
  ['G#4',8],['B4',8],
  ['E5',8],['C5',8],
  ['D5',8],['B4',8],
  ['C5',4],['E5',4],['A5',8],
  ['G#5',12],[0,4],
];

// 小節ごとの根音（自作の和音づけ）。旋律の長い音と半音でぶつからないように取り直した。
// Em と Am を行き来し、B部の終わりだけ E7（G#）で締める。
const KORO_ROOTS = ['E','A','E','A','D','A','E','A',
                    'A','E','A','E7','A','E','A','E7'];
// 根音に対する和音の構成音（半音）
const KORO_CHORD = { E: [0, 3, 7], A: [0, 3, 7], D: [0, 3, 7], E7: [0, 4, 7, 10] };

// ステップ表に展開しておく（毎回計算しない）
const KORO_MEL = new Array(256).fill(null);
(function () {
  let step = 0;
  for (const [n, d] of KORO_NOTES) {
    if (n && step < 256) KORO_MEL[step] = { f: nf(n), dur: d };
    step += d;
  }
})();

const Snd = {
  ctx: null, ready: false,
  bgmOn: true, sfxOn: true,
  wantBgm: () => true,          // 「今BGMを鳴らしてよいか」をゲーム側から差しかえる
  track: localStorage.getItem('tetris2Track') || 'neon',   // neon | koro
  voices: 0, lastAt: {},
  bpm: 128, targetBpm: 128,
  step: 0, nextTime: 0, timer: null, playing: false,
  level: 1, danger: 0,

  // ---------------- 初期化 ----------------
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.5; limiter.knee.value = 0;
    limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.06;
    limiter.connect(ctx.destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 8;
    comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    comp.connect(limiter);
    this.master = comp;

    this.busSfx = ctx.createGain(); this.busSfx.gain.value = 0.9; this.busSfx.connect(comp);
    this.busMus = ctx.createGain(); this.busMus.gain.value = 0.55; this.busMus.connect(comp);

    // リバーブ（IRはノイズから生成）
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeIR(1.5, 3.6, 0.012);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 1.0;
    this.verb.connect(this.verbGain); this.verbGain.connect(comp);

    this.hall = ctx.createConvolver();
    this.hall.buffer = this.makeIR(3.0, 2.2, 0.02);
    this.hallGain = ctx.createGain(); this.hallGain.gain.value = 0.9;
    this.hall.connect(this.hallGain); this.hallGain.connect(comp);

    // 使い回すノイズ（毎回生成するとGCが走る）
    const nlen = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

    // BGMレイヤーの音量
    this.layers = {};
    for (const k of ['bass', 'kick', 'hat', 'pad', 'arp', 'mel', 'snare', 'lead']) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.busMus);
      this.layers[k] = g;
    }
    // アルペジオ用ディレイ
    const dly = ctx.createDelay(1.0);
    dly.delayTime.value = (60 / this.bpm) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2600;
    dly.connect(damp); damp.connect(fb); fb.connect(dly); dly.connect(this.layers.arp);
    this.arpDelay = dly;

    this.ready = true;
  },

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  makeIR(sec, decay, pre) {
    const ctx = this.ctx, rate = ctx.sampleRate;
    const len = Math.floor(rate * sec), pd = Math.floor(rate * pre);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        if (i < pd) { d[i] = 0; continue; }
        const t = (i - pd) / (len - pd);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (0.55 + 0.45 * Math.pow(1 - t, 1.6));
      }
    }
    return buf;
  },

  // ---------------- 部品 ----------------
  now() { return this.ctx.currentTime; },

  env(g, t0, o) {
    const peak = o.peak === undefined ? 1 : o.peak;
    const a = o.a === undefined ? 0.004 : o.a;
    const d = o.d === undefined ? 0.06 : o.d;
    const sus = Math.max(o.sus || 0, 0.0001);
    const dur = o.dur === undefined ? 0.2 : o.dur;
    const r = o.r === undefined ? 0.12 : o.r;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(sus, t0 + a + d);
    g.gain.setValueAtTime(sus, t0 + Math.max(dur, a + d));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + d) + r);
  },

  // 単音（sendでリバーブ量）
  tone(t0, o) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const dest = o.dest || this.busSfx;
    g.connect(dest);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(o.hall ? this.hall : this.verb); }
    let node = g;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.f0, t0);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t0 + (o.fdur || o.dur || 0.2));
      f.connect(g); node = f;
    }
    const count = o.unison || 1;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.freq1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq1), t0 + (o.sweep || o.dur || 0.2));
      if (count > 1) osc.detune.value = (i - (count - 1) / 2) * (o.detune || 12);
      osc.connect(node);
      osc.start(t0);
      osc.stop(t0 + (o.dur || 0.2) + (o.r === undefined ? 0.12 : o.r) + 0.08);
      if (!o.dest || o.dest === this.busSfx) { this.voices++; osc.onended = () => { this.voices--; }; }
    }
    this.env(g, t0, { peak: (o.peak || 0.1) / Math.sqrt(count), a: o.a, d: o.d, sus: o.sus, dur: o.dur, r: o.r });
    return g;
  },

  noise(t0, o) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'highpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1 || o.f0), t0 + (o.dur || 0.1));
    const g = ctx.createGain();
    const dest = o.dest || this.busSfx;
    src.connect(f); f.connect(g); g.connect(dest);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(this.verb); }
    this.env(g, t0, { peak: o.vol || 0.1, a: 0.002, d: (o.dur || 0.1) * 0.5, dur: (o.dur || 0.1) * 0.4, r: (o.dur || 0.1) * 0.6 });
    src.start(t0);
    src.stop(t0 + (o.dur || 0.1) * 2.2 + 0.1);
    if (!o.dest || o.dest === this.busSfx) { this.voices++; src.onended = () => { this.voices--; }; }
  },

  // FM（金属質のベル）
  fmBell(t0, freq, ratio, index, o = {}) {
    const ctx = this.ctx;
    const carrier = ctx.createOscillator(); carrier.type = 'sine'; carrier.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * ratio;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(index, t0);
    modGain.gain.exponentialRampToValueAtTime(40, t0 + (o.dur || 0.5));
    mod.connect(modGain); modGain.connect(carrier.frequency);
    const g = ctx.createGain();
    carrier.connect(g); g.connect(this.busSfx);
    const s = ctx.createGain(); s.gain.value = o.send === undefined ? 0.45 : o.send;
    g.connect(s); s.connect(this.verb);
    this.env(g, t0, { peak: o.peak || 0.16, a: 0.002, d: 0.25, sus: 0.02, dur: o.dur || 0.35, r: o.r || 0.9 });
    mod.start(t0); carrier.start(t0);
    const stop = t0 + (o.dur || 0.35) + (o.r || 0.9) + 0.1;
    mod.stop(stop); carrier.stop(stop);
    this.voices += 2;
    carrier.onended = () => { this.voices -= 2; };
  },

  // ---------------- 効果音 ----------------
  sfx(kind, arg) {
    if (!this.sfxOn || !this.ready) return;
    // 同時発音の上限（超えると音が割れる。大事な音だけ通す）
    const important = kind === 'clear' || kind === 'tspin' || kind === 'perfect' ||
                      kind === 'over' || kind === 'best' || kind === 'levelup';
    if (this.voices > (important ? 48 : 26)) return;
    const t = this.now() + 0.001;
    // 同じ音の連射を間引く
    const gap = { move: 0.025, rotate: 0.035, soft: 0.03 }[kind];
    if (gap) { if (this.lastAt[kind] && t - this.lastAt[kind] < gap) return; this.lastAt[kind] = t; }

    switch (kind) {
      case 'move':
        this.tone(t, { type: 'square', freq: 1180, dur: 0.012, r: 0.02, peak: 0.032, filter: 'lowpass', f0: 3200 });
        break;
      case 'rotate':
        this.tone(t, { type: 'square', freq: 660, freq1: 990, sweep: 0.03, dur: 0.03, r: 0.045, peak: 0.07, send: 0.06 });
        this.tone(t, { type: 'sine', freq: 1980, dur: 0.025, r: 0.04, peak: 0.03 });
        break;
      case 'kick':
        this.sfx('rotate');
        this.noise(t, { f0: 5200, f1: 2200, dur: 0.05, vol: 0.05 });
        break;
      case 'soft':
        this.tone(t, { type: 'triangle', freq: 200, dur: 0.018, r: 0.02, peak: 0.035 });
        break;
      case 'hold':
        this.tone(t, { type: 'triangle', freq: 520, freq1: 780, sweep: 0.08, dur: 0.07, r: 0.1, peak: 0.07, send: 0.12 });
        break;
      case 'harddrop':
        this.tone(t, { type: 'sawtooth', freq: 900, freq1: 70, sweep: 0.1, dur: 0.09, r: 0.05, peak: 0.14,
                       filter: 'lowpass', f0: 5000, f1: 400, fdur: 0.12 });
        break;
      case 'impact':
        this.tone(t, { type: 'sine', freq: 130, freq1: 42, sweep: 0.14, dur: 0.12, r: 0.1, peak: 0.30, send: 0.18 });
        this.noise(t, { filter: 'lowpass', f0: 1400, f1: 300, dur: 0.1, vol: 0.13 });
        break;
      case 'lock':
        this.tone(t, { type: 'triangle', freq: 140, freq1: 110, sweep: 0.04, dur: 0.045, r: 0.05, peak: 0.09 });
        this.noise(t, { filter: 'bandpass', f0: 900, f1: 700, q: 3, dur: 0.03, vol: 0.05 });
        break;
      case 'clear': {
        const n = arg.n, combo = Math.min(arg.combo || 0, 12);
        const f0 = 523.25 * Math.pow(2, combo / 12);
        if (n >= 4) { this.tetrisChord(t, f0); break; }
        const set = n === 1 ? [1, 1.5] : n === 2 ? [1, 1.25, 1.5] : [1, 1.25, 1.5, 2];
        set.forEach((m, i) => {
          this.tone(t + i * 0.05, { type: i % 2 ? 'triangle' : 'square', freq: f0 * m,
            dur: 0.1, r: 0.18, peak: 0.10, send: 0.16, unison: 2, detune: 10 });
        });
        if (n >= 2) this.tone(t, { type: 'sine', freq: 90, freq1: 50, sweep: 0.12, dur: 0.1, r: 0.1, peak: 0.2 });
        if (n >= 3) for (let i = 0; i < 8; i++)
          this.noise(t + i * 0.02, { f0: 4000, f1: 3600, dur: 0.02, vol: 0.035 + i * 0.007 });
        break;
      }
      case 'tspin':
        this.fmBell(t, 880, 3.51, 1400, { dur: 0.35, r: 0.9, peak: 0.17, send: 0.45 });
        this.tone(t, { type: 'sawtooth', freq: 200, freq1: 2400, sweep: 0.3, dur: 0.3, a: 0.28, r: 0.2, peak: 0.07, send: 0.3 });
        break;
      case 'perfect':
        this.perfect(t);
        break;
      case 'levelup': {
        [392, 523.25, 659.25].forEach((f, i) =>
          this.tone(t + i * 0.08, { type: i === 2 ? 'triangle' : 'square', freq: f, dur: 0.12, r: 0.25,
            peak: 0.11, send: 0.25, unison: 2, detune: 9 }));
        this.noise(t - 0.0, { f0: 200, f1: 8000, dur: 0.45, vol: 0.07 });
        break;
      }
      case 'best':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(t + i * 0.09, { type: 'square', freq: f, dur: 0.12, r: 0.3, peak: 0.1, send: 0.3, unison: 2 }));
        break;
      case 'over':
        [392, 330, 262].forEach((f, i) =>
          this.tone(t + i * 0.16, { type: 'triangle', freq: f, dur: 0.2, r: 0.4, peak: 0.12, send: 0.5, unison: 2, detune: 10 }));
        this.tone(t + 0.48, { type: 'triangle', freq: 196, freq1: 130, sweep: 1.2, dur: 1.2, r: 0.9,
          peak: 0.12, send: 0.55, unison: 2, detune: 12 });
        break;
      case 'bomb':
        // 低い衝撃＋空気の破裂＋金属片
        this.tone(t, { type: 'sine', freq: 180, freq1: 38, sweep: 0.14, dur: 0.16, r: 0.2, peak: 0.24, send: 0.25 });
        this.noise(t, { filter: 'lowpass', f0: 2600, f1: 140, dur: 0.20, vol: 0.17, send: 0.2 });
        [1, 1.47, 1.92, 2.61].forEach(m => this.tone(t + 0.015, { type: 'square', freq: 340 * m,
          dur: 0.06, a: 0.001, r: 0.55, peak: 0.035, filter: 'bandpass', f0: 3800, q: 0.8, send: 0.3 }));
        this.tone(t + 0.14, { type: 'sawtooth', freq: 300, freq1: 2200, sweep: 0.3, dur: 0.28,
          r: 0.2, peak: 0.05, send: 0.3 });
        break;
      case 'slowon':
        // 時間がのびる感じ（下降＋ゆっくり開く和音）
        this.tone(t, { type: 'sawtooth', freq: 900, freq1: 170, sweep: 0.55, dur: 0.5, r: 0.4,
          peak: 0.10, filter: 'lowpass', f0: 4200, f1: 500, fdur: 0.6, send: 0.4 });
        [329.63, 440.00, 493.88].forEach((f, i) => this.tone(t + 0.05 + i * 0.04, { type: 'sine', freq: f,
          unison: 2, detune: 9, a: 0.12, dur: 0.7, r: 0.7, peak: 0.09, send: 0.55, hall: true }));
        break;
      case 'slowoff':
        [523.25, 659.25].forEach((f, i) => this.tone(t + i * 0.06, { type: 'triangle', freq: f,
          dur: 0.09, r: 0.14, peak: 0.07, send: 0.2 }));
        break;
      case 'ui':
        this.tone(t, { type: 'square', freq: 880, freq1: 1320, sweep: 0.05, dur: 0.05, r: 0.08, peak: 0.06, send: 0.1 });
        break;
    }
  },

  tetrisChord(t, f0) {
    // 同時発音の和音＋サブベース＋シンバル＋余韻のスイープ
    [1, 1.26, 1.5, 2].forEach(m => {
      this.tone(t, { type: 'sawtooth', freq: f0 * m, unison: 3, detune: 12,
        dur: 0.35, a: 0.006, d: 0.1, sus: 0.06, r: 0.55, peak: 0.16, send: 0.35,
        filter: 'lowpass', f0: 400, f1: 8000, fdur: 0.08 });
    });
    this.tone(t, { type: 'sine', freq: 65.4, dur: 0.5, r: 0.3, peak: 0.22 });
    this.tone(t, { type: 'sine', freq: 32.7, dur: 0.5, r: 0.3, peak: 0.1 });
    this.noise(t, { filter: 'lowpass', f0: 3000, f1: 120, dur: 0.26, vol: 0.18 });
    // 金属音＝非整数倍音
    [1, 1.41, 1.73, 2.24, 2.83, 3.16].forEach(m => {
      this.tone(t + 0.01, { type: 'square', freq: 520 * m, dur: 0.05, a: 0.001, r: 1.0, peak: 0.022,
        filter: 'bandpass', f0: 7000, q: 0.7, send: 0.3 });
    });
    this.tone(t + 0.18, { type: 'sawtooth', freq: 400, freq1: 3200, sweep: 0.25, dur: 0.25, r: 0.2, peak: 0.06, send: 0.3 });
  },

  perfect(t) {
    // BGMを一度落として、静寂のあとに開放和音
    const g = this.busMus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + 0.06);
    [261.63, 329.63, 392.0, 493.88, 587.33].forEach(f => {
      this.tone(t + 0.25, { type: 'sine', freq: f, unison: 3, detune: 8, a: 0.35, d: 0.5, sus: 0.5,
        dur: 1.8, r: 1.6, peak: 0.14, send: 0.7, hall: true });
      this.tone(t + 0.25, { type: 'triangle', freq: f * 2, unison: 2, detune: 8, a: 0.4, dur: 1.5, r: 1.4,
        peak: 0.05, send: 0.6, hall: true });
    });
    for (let i = 0; i < 10; i++) {
      this.tone(t + 0.6 + Math.random() * 1.2, { type: 'sine', freq: 2000 + Math.random() * 4000,
        dur: 0.06, r: 0.2, peak: 0.045, send: 0.5, hall: true });
    }
    g.setValueAtTime(0.0001, t + 2.4);
    g.linearRampToValueAtTime(0.55, t + 3.6);
  },

  // ---------------- BGM ----------------
  //  16分音符スケジューラ。レベルでレイヤーを解禁する。
  startBgm() {
    if (!this.ready || this.playing || !this.bgmOn) return;
    this.playing = true;
    this.step = 0;
    this.bpm = this.baseBpm();
    if (this.arpDelay) this.arpDelay.delayTime.value = (60 / this.baseBpm()) * 0.75;
    this.targetBpm = this.baseBpm() + this.danger * 20;
    this.nextTime = this.now() + 0.08;
    this.applyLayers(this.level, 0.01);
    this.busMus.gain.cancelScheduledValues(this.now());
    this.busMus.gain.setValueAtTime(this.bgmOn ? 0.55 : 0.0001, this.now());
    this.timer = setInterval(() => this.schedule(), 25);
  },

  stopBgm(fade = 0.25) {
    clearTimeout(this.restartTimer); this.restartTimer = null;
    clearTimeout(this.previewTimer); this.previewTimer = null;
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
    if (this.ready) {
      const t = this.now();
      this.busMus.gain.cancelScheduledValues(t);
      this.busMus.gain.setValueAtTime(Math.max(this.busMus.gain.value, 0.0001), t);
      this.busMus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    }
  },

  setLevel(lv) {
    if (lv === this.level) return;
    this.level = lv;
    if (this.ready) this.applyLayers(lv, 0.8);
  },

  applyLayers(lv, ramp) {
    // 曲ごとに「増えていく順番」を変える。
    // コロブチカは旋律が主役なので最初から鳴らす（レベルで伴奏が厚くなる）
    const on = this.track === 'koro' ? {
      bass: 1, kick: 1, mel: 1,
      pad: lv >= 2 ? 1 : 0,
      hat: lv >= 3 ? 1 : 0,
      snare: lv >= 4 ? 1 : 0,
      arp: lv >= 6 ? 1 : 0,
      lead: lv >= 8 ? 1 : 0,
    } : {
      bass: 1, kick: 1,
      hat: lv >= 2 ? 1 : 0,
      pad: lv >= 3 ? 1 : 0,
      arp: lv >= 4 ? 1 : 0,
      mel: lv >= 6 ? 1 : 0,
      snare: lv >= 8 ? 1 : 0,
      lead: lv >= 10 ? 1 : 0,
    };
    const vol = { bass: 0.55, kick: 0.75, hat: 0.35, pad: 0.30, arp: 0.28, mel: 0.34, snare: 0.5, lead: 0.18 };
    const t = this.now();
    for (const k in on) {
      const g = this.layers[k].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(g.value, 0.0001), t);
      g.linearRampToValueAtTime(on[k] ? vol[k] : 0.0001, t + ramp);
    }
  },

  // 0 = キックの瞬間 → 1 = 次の拍
  beatPhase() {
    if (!this.playing || !this.ready) return 1;
    return clamp((this.now() - (this.kickTime || 0)) / (60 / this.bpm), 0, 1);
  },

  baseBpm() { return this.track === 'koro' ? 150 : 128; },

  // タイトルでどんな曲か聴かせる（2小節ほど）
  preview() {
    if (!this.ready || !this.bgmOn) return;
    clearTimeout(this.previewTimer);
    this.stopBgm(0.05);
    setTimeout(() => {
      if (this.wantBgm()) return;              // ゲームが始まっていたら試聴しない
      this.startBgm();
      this.applyLayers(4, 0.05);
      this.previewTimer = setTimeout(() => this.stopBgm(0.4), 2600);
    }, 90);
  },

  setTrack(name) {
    if (this.track === name) return;
    this.track = name;
    localStorage.setItem('tetris2Track', name);
    this.bpm = this.baseBpm();
    this.targetBpm = this.baseBpm() + this.danger * 20;
    if (this.arpDelay) this.arpDelay.delayTime.value = (60 / this.baseBpm()) * 0.75;
    if (this.playing) {
      this.stopBgm(0.08);
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (this.bgmOn && this.wantBgm()) this.startBgm();   // その間にポーズ等になったら鳴らさない
      }, 120);
    }
  },

  setDanger(d) {
    this.danger = d;
    this.targetBpm = this.baseBpm() + d * 20;
  },

  schedule() {
    if (!this.playing) return;
    const ahead = 0.1;
    // BPMをなめらかに寄せる
    this.bpm += (this.targetBpm - this.bpm) * 0.06;
    const spb = 60 / this.bpm / 4;    // 16分音符
    let guard = 0;
    while (this.nextTime < this.now() + ahead && guard++ < 40) {
      if (this.track === 'koro') this.playKoro(this.step, this.nextTime);
      else this.playStep(this.step, this.nextTime);
      this.nextTime += spb;
      this.step++;
    }
  },

  // ---------------- コロブチカ ----------------
  playKoro(s, t) {
    const L = this.layers;
    const i = s % 256;
    const bar = Math.floor(i / 16);
    const i16 = i % 16;
    const rootName = KORO_ROOTS[bar];
    const rootF = nf(rootName.replace('7', '') + '2');
    // 和音は旋律とかぶらない音域に固定する
    let pf = rootF * 4;
    while (pf > 260) pf /= 2;
    while (pf < 130) pf *= 2;
    const slow = bar >= 8;              // B（ゆったり）のあいだは手数を減らす

    // メロディ（角ばった音＋1オクターブ下を重ねて厚みを出す）
    const m = KORO_MEL[i];
    if (m) {
      const len = m.dur * (60 / this.bpm / 4);
      this.tone(t, { dest: L.mel, type: 'square', freq: m.f,
        dur: Math.max(0.06, len * 0.86), r: 0.07, peak: 0.34, send: 0.14 });
      this.tone(t, { dest: L.mel, type: 'triangle', freq: m.f / 2,
        dur: Math.max(0.06, len * 0.86), r: 0.07, peak: 0.15 });
      // レベルが上がると3度上のハモリが増える
      if (this.level >= 8) {
        this.tone(t, { dest: L.lead, type: 'square', freq: m.f * 1.1892,
          dur: Math.max(0.05, len * 0.7), r: 0.06, peak: 0.16 });
      }
    }

    // ベース（8分の刻み。ゆったりする所は4分）
    const bassEvery = slow ? 4 : 2;
    if (i16 % bassEvery === 0) {
      const oct = (i16 % 8 === 4 && !slow) ? 2 : 1;
      this.tone(t, { dest: L.bass, type: 'sawtooth', freq: rootF * oct,
        dur: 0.12, r: 0.06, peak: 0.42, filter: 'lowpass', f0: 600, f1: 1200, fdur: 0.1 });
      this.tone(t, { dest: L.bass, type: 'sine', freq: rootF / 2 * oct, dur: 0.13, r: 0.06, peak: 0.32 });
    }

    // ドラム
    if (i16 % 4 === 0) {
      this.kickTime = t;
      this.tone(t, { dest: L.kick, type: 'sine', freq: 120, freq1: 45, sweep: 0.12,
        dur: 0.11, r: 0.05, peak: 0.9 });
    }
    if (this.level >= 3 && i16 % 2 === 0) {
      this.noise(t, { dest: L.hat, f0: 8200, f1: 7200, dur: 0.024,
        vol: (i16 % 4 === 2) ? 0.45 : 0.22 });
    }
    if (this.level >= 4 && (i16 === 4 || i16 === 12)) {
      this.noise(t, { dest: L.snare, filter: 'bandpass', f0: 1800, q: 1.5, dur: 0.09, vol: 0.5 });
      this.tone(t, { dest: L.snare, type: 'triangle', freq: 190, freq1: 150, sweep: 0.06,
        dur: 0.05, r: 0.06, peak: 0.38 });
    }

    // 和音（小節のあたま。レベル3から）
    if (this.level >= 2 && i16 === 0) {
      for (const semi of KORO_CHORD[rootName]) {
        this.tone(t, { dest: L.pad, type: 'sawtooth', freq: pf * Math.pow(2, semi / 12),
          unison: 2, detune: 13, a: 0.06, d: 0.3, sus: 0.35, dur: 1.1, r: 0.5, peak: 0.20,
          filter: 'lowpass', f0: 900, f1: 1700 + this.danger * 1500, fdur: 1.0 });
      }
    }

    // 裏打ち（オムパ）。この曲だけの手ざわり
    if (this.level >= 2 && !slow && i16 % 4 === 2) {
      for (const semi of KORO_CHORD[rootName]) {
        this.tone(t, { dest: L.pad, type: 'square', freq: pf * 2 * Math.pow(2, semi / 12),
          dur: 0.05, a: 0.002, r: 0.05, peak: 0.075, filter: 'lowpass', f0: 2600 });
      }
    }

    // 最後の小節はフィルで戻る
    if (this.level >= 4 && bar === 15 && i16 >= 12) {
      this.noise(t, { dest: L.snare, filter: 'bandpass', f0: 1500 + (i16 - 12) * 400,
        q: 1.4, dur: 0.07, vol: 0.32 });
    }

    // 裏で刻むアルペジオ（速いところだけ）
    if (this.level >= 6 && !slow) {
      const ch = KORO_CHORD[rootName];
      const semi = ch[(i16 % 3)];
      this.tone(t, { dest: this.arpDelay, type: 'square',
        freq: rootF * 16 * Math.pow(2, semi / 12), dur: 0.05, r: 0.05, peak: 0.10 });
    }
  },

  playStep(s, t) {
    const L = this.layers;
    const bar = Math.floor(s / 16) % 4;
    const i16 = s % 16;
    // Aマイナー進行
    const roots = [55.0, 43.65, 65.41, 49.0];   // A1 F1 C2 G1
    const root = roots[bar];

    // ベース（8分）
    if (i16 % 2 === 0) {
      const f = root * (i16 % 8 === 4 ? 1.5 : 1);
      this.tone(t, { dest: L.bass, type: 'triangle', freq: f * 2, dur: 0.11, r: 0.06, peak: 0.5,
        filter: 'lowpass', f0: 700 });
      this.tone(t, { dest: L.bass, type: 'sine', freq: f, dur: 0.12, r: 0.06, peak: 0.35 });
    }
    // キック（4つ打ち）※映像の脈動もこの時刻に合わせる
    if (i16 % 4 === 0) {
      this.kickTime = t;
      this.tone(t, { dest: L.kick, type: 'sine', freq: 120, freq1: 45, sweep: 0.12, dur: 0.11, r: 0.05, peak: 0.9 });
    }
    // ハイハット（8分・裏拍強め）
    if (i16 % 2 === 0) {
      this.noise(t, { dest: L.hat, f0: 8000, f1: 7000, dur: 0.025, vol: (i16 % 4 === 2) ? 0.5 : 0.25 });
    }
    // スネア（2・4拍）
    if (i16 === 4 || i16 === 12) {
      this.noise(t, { dest: L.snare, filter: 'bandpass', f0: 1800, q: 1.5, dur: 0.09, vol: 0.55 });
      this.tone(t, { dest: L.snare, type: 'triangle', freq: 190, freq1: 150, sweep: 0.06, dur: 0.05, r: 0.06, peak: 0.4 });
    }
    // パッド（小節頭）
    if (i16 === 0) {
      [1, 1.5, 2.52].forEach(m => {
        this.tone(t, { dest: L.pad, type: 'sawtooth', freq: root * 4 * m, unison: 3, detune: 14,
          a: 0.08, d: 0.4, sus: 0.5, dur: 1.4, r: 0.6, peak: 0.22,
          filter: 'lowpass', f0: 900, f1: 1800 + this.danger * 1600, fdur: 1.2 });
      });
    }
    // アルペジオ（16分）
    if (this.level >= 4) {
      const arp = [1, 1.5, 2, 2.52, 3, 2.52, 2, 1.5];
      const f = root * 8 * arp[i16 % 8];
      this.tone(t, { dest: this.arpDelay, type: 'square', freq: f, dur: 0.06, r: 0.06, peak: 0.22 });
    }
    // メロディ（8分・既存おとんテトリスのフレーズ）
    if (i16 % 2 === 0 && this.level >= 6) {
      const MEL = [440, 523.25, 659.25, 880, 783.99, 659.25, 698.46, 587.33,
                   659.25, 523.25, 587.33, 493.88, 523.25, 440, 493.88, 392,
                   440, 523.25, 659.25, 880, 987.77, 880, 783.99, 659.25,
                   698.46, 783.99, 880, 783.99, 659.25, 587.33, 523.25, 493.88];
      const n = MEL[(Math.floor(s / 2)) % MEL.length];
      this.tone(t, { dest: L.mel, type: 'square', freq: n, dur: 0.13, r: 0.1, peak: 0.3, send: 0.16 });
      this.tone(t, { dest: L.mel, type: 'triangle', freq: n / 2, dur: 0.13, r: 0.1, peak: 0.16 });
      if (this.level >= 10) this.tone(t, { dest: L.lead, type: 'sawtooth', freq: n * 1.5, unison: 2,
        detune: 12, dur: 0.13, r: 0.1, peak: 0.3 });
    }
  },
};
