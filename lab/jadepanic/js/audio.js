// ============================================================
// audio.js — 音はすべて WebAudio の合成（音源ファイルなし）
//   BGM: Aマイナーのサイバー系。緊張度でレイヤーが 8段まで増える。
//   SE : 撃つ／当たる／こわす／ビットをついばむ／ボム／やられる …
//
//   映像との同期のため、キックを鳴らした時刻を lastKick に残す。
//   （画面の脈・ブルーム・グリッドの拍打ちがこれを見る）
// ============================================================
'use strict';

const A_MINOR = [0, 2, 3, 5, 7, 8, 10];         // ナチュラルマイナー
const CHORDS = [                                 // 2小節ずつ Am - F - C - G
  { root: 57, tri: [0, 3, 7] },   // Am (A3)
  { root: 53, tri: [0, 4, 7] },   // F
  { root: 48, tri: [0, 4, 7] },   // C
  { root: 55, tri: [0, 4, 7] },   // G
];

// リード（16分×32ステップ。null=休み。数字はAマイナー音階の度数）
const LEAD = [
  7, null, 6, null, 4, null, null, 3,
  4, null, 6, null, 7, null, null, null,
  9, null, 7, null, 6, null, null, 4,
  6, null, 4, null, 3, null, 2, null,
];
// アルペジオ（コードトーンを刻む）
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

const Snd = {
  ctx: null, ready: false,
  master: null, bgmGain: null, sfxGain: null, revGain: null, conv: null,
  bgmOn: true, sfxOn: true,
  playing: false,
  step: 0, nextTime: 0, timer: null,
  bpm: 140, tempoScale: 1,
  level: 0, levelTarget: 0,
  lastKick: -10,
  _shootAt: 0, _warnAt: 0, _killCount: 0, _killFrame: -1,
  layerGain: {},

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.20;
    this.master.connect(comp).connect(c.destination);

    this.bgmGain = c.createGain(); this.bgmGain.gain.value = 0.55;
    this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.85;
    this.bgmGain.connect(this.master);
    this.sfxGain.connect(this.master);

    // リバーブ（起動時に作っておく。プレイ中に作ると固まる）
    this.conv = c.createConvolver();
    this.conv.buffer = this._makeIR(1.15, 2.6, 0.005);
    this.revGain = c.createGain(); this.revGain.gain.value = 0.30;
    this.conv.connect(this.revGain).connect(this.master);

    // BGMのレイヤーごとの音量つまみ
    for (const k of ['sub', 'kick', 'hat', 'bass', 'pad', 'arp', 'lead', 'snare']) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.bgmGain);
      this.layerGain[k] = g;
    }
    this.ready = true;
  },

  _makeIR(sec, decay, pre) {
    const c = this.ctx, sr = c.sampleRate;
    const len = Math.floor(sr * sec);
    const buf = c.createBuffer(2, len, sr);
    const preN = Math.floor(sr * pre);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        if (i < preN) { d[i] = 0; continue; }
        const t = (i - preN) / (len - preN);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  },

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  now() { return this.ctx ? this.ctx.currentTime : 0; },

  // ---------------- 音のもと ----------------
  _env(g, t0, o) {
    const a = o.a === undefined ? 0.004 : o.a;
    const d = o.d === undefined ? 0.10 : o.d;
    const v = o.v === undefined ? 0.3 : o.v;
    const s = o.s === undefined ? 0 : o.s;
    const r = o.r === undefined ? 0.06 : o.r;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + a);
    if (s > 0) {
      g.gain.linearRampToValueAtTime(v * s, t0 + a + d);
      g.gain.setValueAtTime(v * s, t0 + a + d + (o.hold || 0));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + (o.hold || 0) + r);
      return t0 + a + d + (o.hold || 0) + r;
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    return t0 + a + d;
  },

  // 単音（波形・周波数スイープ・フィルタつき）
  tone(t0, o) {
    if (!this.ready) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) {
      if (o.expo === false) osc.frequency.linearRampToValueAtTime(o.f2, t0 + (o.sweep || 0.1));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.sweep || 0.1));
    }
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.cut || 900, t0);
      if (o.cut2) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.cut2), t0 + (o.sweep || 0.1));
      f.Q.value = o.q === undefined ? 1 : o.q;
      node.connect(f); node = f;
    }
    node.connect(g);
    const end = this._env(g, t0, o);
    g.connect(o.dest || this.sfxGain);
    if (o.rev) {
      const rg = c.createGain();
      rg.gain.value = o.rev;
      g.connect(rg); rg.connect(this.conv);
    }
    osc.start(t0);
    osc.stop(end + 0.05);
  },

  noise(t0, o) {
    if (!this.ready) return;
    const c = this.ctx;
    const len = Math.max(0.03, o.len || 0.15);
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    let node = src;
    if (o.filter !== 'none') {
      const f = c.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.f || 1200, t0);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.f2), t0 + (o.sweep || len));
      f.Q.value = o.q === undefined ? 1.2 : o.q;
      node.connect(f); node = f;
    }
    const g = c.createGain();
    node.connect(g);
    const end = this._env(g, t0, o);
    g.connect(o.dest || this.sfxGain);
    if (o.rev) {
      const rg = c.createGain(); rg.gain.value = o.rev;
      g.connect(rg); rg.connect(this.conv);
    }
    src.start(t0);
    src.stop(end + 0.05);
  },

  // ---------------- 効果音 ----------------
  sfx(kind, arg) {
    if (!this.ready || !this.sfxOn) return;
    const t = this.now() + 0.001;
    switch (kind) {
      case 'shoot': {
        // 連射なので軽く・重ならないように間引く
        if (t - this._shootAt < 0.035) return;
        this._shootAt = t;
        const f = 900 + rnd(-70, 70);
        this.tone(t, { type: 'square', f, f2: f * 0.45, sweep: 0.05, a: 0.001, d: 0.055, v: 0.055,
                       filter: 'lowpass', cut: 3800, cut2: 1400 });
        this.tone(t, { type: 'sine', f: f * 2, f2: f, sweep: 0.03, a: 0.001, d: 0.03, v: 0.028 });
        break;
      }
      case 'hit':
        this.noise(t, { filter: 'highpass', f: 2600, len: 0.05, a: 0.001, d: 0.045, v: 0.05 });
        break;
      case 'kill': {
        // 同じフレームに何十匹も死ぬので上限をかける
        const fr = arg && arg.frame;
        if (fr !== undefined) {
          if (fr !== this._killFrame) { this._killFrame = fr; this._killCount = 0; }
          if (++this._killCount > 3) return;
        }
        const p = (arg && arg.pitch) || 1;
        this.noise(t, { filter: 'bandpass', f: 1500 * p, f2: 260 * p, sweep: 0.16, q: 1.4,
                        len: 0.2, a: 0.001, d: 0.17, v: 0.13, rev: 0.10 });
        this.tone(t, { type: 'triangle', f: 380 * p, f2: 90 * p, sweep: 0.14, a: 0.001, d: 0.15, v: 0.09 });
        break;
      }
      case 'bit': {
        // ついばむ音。倍率が上がるほど音階が上がっていく（気持ちよさの主役）
        const n = clamp(arg || 0, 0, 24);
        const semi = A_MINOR[n % 7] + 12 * Math.floor(n / 7);
        const f = 660 * Math.pow(2, semi / 12);
        this.tone(t, { type: 'sine', f, a: 0.001, d: 0.09, v: 0.075, rev: 0.14 });
        this.tone(t + 0.005, { type: 'triangle', f: f * 2, a: 0.001, d: 0.05, v: 0.030 });
        break;
      }
      case 'multi': {
        // 倍率の節目。ちいさなコード
        const base = 330 * Math.pow(2, clamp(arg || 0, 0, 12) / 12);
        [0, 4, 7, 12].forEach((s, i) => {
          this.tone(t + i * 0.035, { type: 'triangle', f: base * Math.pow(2, s / 12),
                                     a: 0.004, d: 0.3, v: 0.075, rev: 0.3 });
        });
        break;
      }
      case 'bomb':
        this.tone(t, { type: 'sine', f: 180, f2: 28, sweep: 0.7, a: 0.002, d: 0.75, v: 0.34 });
        this.noise(t, { filter: 'lowpass', f: 5000, f2: 200, sweep: 0.6, len: 0.75,
                        a: 0.002, d: 0.7, v: 0.22, rev: 0.4 });
        this.noise(t + 0.01, { filter: 'highpass', f: 3000, len: 0.25, a: 0.001, d: 0.22, v: 0.10 });
        break;
      case 'death':
        this.tone(t, { type: 'sawtooth', f: 420, f2: 44, sweep: 0.8, a: 0.002, d: 0.85, v: 0.20,
                       filter: 'lowpass', cut: 2600, cut2: 200, rev: 0.5 });
        this.noise(t, { filter: 'bandpass', f: 900, f2: 120, sweep: 0.7, len: 0.8,
                        a: 0.002, d: 0.75, v: 0.15, rev: 0.4 });
        break;
      case 'respawn':
        this.tone(t, { type: 'triangle', f: 180, f2: 900, sweep: 0.35, a: 0.01, d: 0.4, v: 0.11, rev: 0.25 });
        this.tone(t + 0.34, { type: 'sine', f: 1320, a: 0.002, d: 0.2, v: 0.09, rev: 0.3 });
        break;
      case 'warn':
        if (t - this._warnAt < 0.08) return;   // 群れで湧くと一度に何発も鳴る
        this._warnAt = t;
        this.tone(t, { type: 'sine', f: 1600, f2: 2400, sweep: 0.12, a: 0.004, d: 0.14, v: 0.030 });
        break;
      case 'alert':
        this.tone(t, { type: 'square', f: 880, a: 0.004, d: 0.12, v: 0.07, filter: 'lowpass', cut: 2200 });
        this.tone(t + 0.13, { type: 'square', f: 1174, a: 0.004, d: 0.20, v: 0.07, filter: 'lowpass', cut: 2600, rev: 0.25 });
        break;
      case 'life':
        [0, 4, 7, 12, 16].forEach((s, i) => {
          this.tone(t + i * 0.06, { type: 'triangle', f: 440 * Math.pow(2, s / 12),
                                    a: 0.004, d: 0.28, v: 0.10, rev: 0.35 });
        });
        break;
      case 'ui':
        this.tone(t, { type: 'square', f: 1200, a: 0.001, d: 0.05, v: 0.05, filter: 'lowpass', cut: 3000 });
        break;
      case 'tick':
        this.tone(t, { type: 'square', f: arg ? 1560 : 780, a: 0.001, d: 0.08, v: 0.08, filter: 'lowpass', cut: 4000 });
        break;
      case 'gameover':
        [0, -3, -5, -12].forEach((s, i) => {
          this.tone(t + i * 0.18, { type: 'sawtooth', f: 440 * Math.pow(2, s / 12),
                                    a: 0.01, d: 0.6, v: 0.10, filter: 'lowpass', cut: 1400, rev: 0.5 });
        });
        break;
      case 'clear':
        [0, 7, 12, 19, 24].forEach((s, i) => {
          this.tone(t + i * 0.08, { type: 'triangle', f: 330 * Math.pow(2, s / 12),
                                    a: 0.004, d: 0.5, v: 0.11, rev: 0.45 });
        });
        break;
    }
  },

  // ---------------- BGM ----------------
  startBgm() {
    if (!this.ready || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.now() + 0.08;
    this.applyLevel(this.level, 0.05);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this._schedule(), 25);
  },

  stopBgm(fade = 0.3) {
    if (!this.ready) return;
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const t = this.now();
    for (const k in this.layerGain) {
      const g = this.layerGain[k].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + fade);
    }
  },

  // 緊張度 0..7。上げるほどレイヤーが増える
  setLevel(lv) {
    lv = clamp(Math.round(lv), 0, 7);
    if (lv === this.level) return;
    this.level = lv;
    if (this.playing) this.applyLevel(lv, 0.9);
  },

  applyLevel(lv, ramp) {
    if (!this.ready) return;
    const t = this.now();
    const on = {
      sub:   1,
      kick:  lv >= 1 ? 1 : 0,
      hat:   lv >= 2 ? 1 : 0,
      bass:  lv >= 3 ? 1 : 0,
      pad:   lv >= 4 ? 1 : 0,
      arp:   lv >= 5 ? 1 : 0,
      lead:  lv >= 6 ? 1 : 0,
      snare: lv >= 7 ? 1 : 0,
    };
    const vol = { sub: 0.55, kick: 0.95, hat: 0.35, bass: 0.70, pad: 0.30, arp: 0.32, lead: 0.34, snare: 0.55 };
    for (const k in on) {
      const g = this.layerGain[k].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(on[k] * vol[k] * (this.bgmOn ? 1 : 0), t + ramp);
    }
  },

  setBgmOn(v) {
    this.bgmOn = v;
    if (this.ready) this.applyLevel(this.level, 0.15);
  },

  setTempoScale(s) { this.tempoScale = clamp(s, 0.7, 1.35); },

  // 拍のうねり（0..1）を映像に渡す
  beatPulse() {
    const dt = this.now() - this.lastKick;
    if (dt < 0 || dt > 0.6) return 0;
    return Math.pow(1 - dt / 0.6, 3);
  },

  _schedule() {
    if (!this.playing) return;
    const spb = 60 / (this.bpm * this.tempoScale) / 4;   // 16分音符
    const t = this.now();
    while (this.nextTime < t + 0.12) {
      this._playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 128;                 // 8小節ループ
      this.nextTime += spb;
    }
  },

  _playStep(s, t) {
    const L = this.layerGain;
    const bar = Math.floor(s / 16);
    const ch = CHORDS[Math.floor(bar / 2) % 4];
    const beat = s % 4;
    const inBar = s % 16;

    // --- サブベース（コードの根音を伸ばす）---
    if (inBar === 0) {
      this.tone(t, { type: 'sine', f: this._mf(ch.root - 24), a: 0.02, d: 0.10, v: 0.5,
                     s: 0.7, hold: 0.55, r: 0.25, dest: L.sub });
    }

    // --- キック（4つ打ち）---
    if (inBar % 4 === 0) {
      this.lastKick = t;
      this.tone(t, { type: 'sine', f: 150, f2: 44, sweep: 0.09, a: 0.001, d: 0.20, v: 0.9, dest: L.kick });
      this.noise(t, { filter: 'lowpass', f: 900, len: 0.05, a: 0.001, d: 0.04, v: 0.25, dest: L.kick });
    }

    // --- ハイハット ---
    if (s % 2 === 1) {
      this.noise(t, { filter: 'highpass', f: 7200, len: 0.045, a: 0.001,
                      d: (s % 8 === 3 ? 0.07 : 0.032), v: (s % 4 === 3 ? 0.22 : 0.13), dest: L.hat });
    }

    // --- スネア（2・4拍）---
    if (inBar === 4 || inBar === 12) {
      this.noise(t, { filter: 'bandpass', f: 1900, q: 0.8, len: 0.16, a: 0.001, d: 0.14, v: 0.5,
                      dest: L.snare, rev: 0.15 });
      this.tone(t, { type: 'triangle', f: 220, f2: 150, sweep: 0.08, a: 0.001, d: 0.09, v: 0.25, dest: L.snare });
    }

    // --- ベース（8分の裏でうねる）---
    if (s % 2 === 0) {
      const oct = (inBar === 6 || inBar === 14) ? 12 : 0;
      this.tone(t, { type: 'sawtooth', f: this._mf(ch.root - 12 + oct), a: 0.004, d: 0.13, v: 0.35,
                     filter: 'lowpass', cut: 420 + (this.level >= 5 ? 320 : 0), q: 6, cut2: 220,
                     sweep: 0.13, dest: L.bass });
    }

    // --- パッド（小節あたま。三和音を薄く）---
    if (inBar === 0) {
      ch.tri.forEach((iv, i) => {
        this.tone(t + i * 0.01, { type: 'sawtooth', f: this._mf(ch.root + iv), detune: i * 6 - 6,
                                  a: 0.25, d: 0.2, v: 0.10, s: 0.6, hold: 0.7, r: 0.6,
                                  filter: 'lowpass', cut: 1500, dest: L.pad, rev: 0.35 });
      });
    }

    // --- アルペジオ（16分）---
    {
      const iv = ch.tri[ARP[s % 8] % ch.tri.length];
      this.tone(t, { type: 'square', f: this._mf(ch.root + 12 + iv), a: 0.002, d: 0.08, v: 0.16,
                     filter: 'lowpass', cut: 2600, q: 2, dest: L.arp, rev: 0.18 });
    }

    // --- リード（32ステップのメロディ）---
    {
      const deg = LEAD[s % 32];
      if (deg !== null && deg !== undefined) {
        const semi = A_MINOR[deg % 7] + 12 * Math.floor(deg / 7);
        const f = this._mf(57 + semi);
        this.tone(t, { type: 'sawtooth', f, a: 0.006, d: 0.10, v: 0.22, s: 0.5, hold: 0.05, r: 0.14,
                       filter: 'lowpass', cut: 3200, cut2: 1600, sweep: 0.2, q: 3,
                       dest: L.lead, rev: 0.3 });
        this.tone(t + 0.012, { type: 'sawtooth', f: f * 1.005, detune: 7, a: 0.006, d: 0.10, v: 0.12,
                               s: 0.5, hold: 0.05, r: 0.14, filter: 'lowpass', cut: 2600, dest: L.lead });
      }
    }
  },

  _mf(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },
};
