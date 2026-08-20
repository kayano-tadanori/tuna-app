// ============================================================
// audio.js — 音。WebAudio で全部その場で合成する（音のファイルは持たない）
//
//  世界のきまり：**音は空気があるところだけ鳴る**。
//    マスターにローパスを1つ置き、高度が上がるほど cutoff を下げていく。
//    カーマンライン（1000m）で環境音が水の中に沈むように消える。
//    そこから先の音は「チッチの中で鳴っている音」という設定なので、
//    低くこもった音だけが鳴る。
//
//  完全な無音は使いどころを絞る（多用すると値打ちが落ちる）。
// ============================================================
'use strict';

class CJAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgmOn = true;
    this.master = null;
    this.lp = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.step = 0;
    this.nextNoteAt = 0;
    this.zone = 0;
    this.bounceStreak = 0;
    this.lastBounceAt = -9;
  }

  // 音は「最初に画面をさわった時」に起こす（ブラウザの決まり）
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;

    // 高度で効く「空気のフィルタ」
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 18000;
    this.lp.Q.value = 0.6;

    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.9;
    this.bgmGain = ctx.createGain(); this.bgmGain.gain.value = 0.32;

    this.sfxGain.connect(this.lp);
    this.bgmGain.connect(this.lp);
    this.lp.connect(this.master);
    this.master.connect(ctx.destination);

    this.nextNoteAt = ctx.currentTime + 0.1;
    return ctx;
  }

  // 高度に応じて空気を薄くする。1000m で環境音が沈み、宇宙では低い音だけ残る。
  setAltitude(m) {
    if (!this.ctx) return;
    const t = clamp(m / 1000, 0, 1);
    const cut = lerp(18000, 520, Math.pow(t, 0.7));
    this.lp.frequency.setTargetAtTime(cut, this.ctx.currentTime, 0.25);
    // 宇宙に入ったらBGMも静かに
    const g = m >= 1500 ? 0.20 : 0.32;
    this.bgmGain.gain.setTargetAtTime(this.bgmOn ? g : 0, this.ctx.currentTime, 0.4);
  }

  // ---------------- 部品 ----------------
  tone(freq, dur, opt = {}) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + (opt.delay || 0);
    const o = ctx.createOscillator();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + dur);
    const g = ctx.createGain();
    const peak = (opt.gain === undefined ? 0.25 : opt.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opt.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(opt.bus || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, opt = {}) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + (opt.delay || 0);
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.frequency.setValueAtTime(opt.freq || 900, t0);
    if (opt.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, opt.to), t0 + dur);
    f.Q.value = opt.q || 1.1;
    const g = ctx.createGain(); g.gain.value = (opt.gain === undefined ? 0.22 : opt.gain);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
  }

  // ---------------- 効果音 ----------------
  play(name, arg) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'bounce': {
        // 続けて跳ぶほど音が上がる＝コンボの気持ちよさ
        if (now - this.lastBounceAt < 1.4) this.bounceStreak = Math.min(this.bounceStreak + 1, 7);
        else this.bounceStreak = 0;
        this.lastBounceAt = now;
        const f = 300 * Math.pow(1.0595, this.bounceStreak * 2);
        this.tone(f, 0.11, { type: 'triangle', to: f * 1.7, gain: 0.22 });
        this.noise(0.05, { freq: 1400, to: 500, gain: 0.06 });
        break;
      }
      case 'spring':
        // びよーん：下がってから跳ね上がる
        this.tone(200, 0.09, { type: 'square', to: 140, gain: 0.16 });
        this.tone(150, 0.30, { type: 'triangle', to: 900, gain: 0.24, delay: 0.07 });
        break;
      case 'ice':
        this.tone(1180, 0.16, { type: 'sine', to: 1600, gain: 0.16 });
        this.tone(1760, 0.22, { type: 'sine', gain: 0.09, delay: 0.02 });
        break;
      case 'break':
        this.noise(0.26, { freq: 700, to: 140, gain: 0.20, filter: 'lowpass', q: 0.7 });
        this.tone(180, 0.16, { type: 'triangle', to: 90, gain: 0.12 });
        break;
      case 'star': {
        const c = clamp(arg || 1, 1, 5);
        const base = 660 * Math.pow(1.0595, (c - 1) * 3);
        this.tone(base, 0.10, { type: 'triangle', gain: 0.18 });
        this.tone(base * 1.5, 0.14, { type: 'triangle', gain: 0.14, delay: 0.055 });
        if (c >= 4) this.tone(base * 2, 0.18, { type: 'sine', gain: 0.12, delay: 0.11 });
        break;
      }
      case 'onigiri':
        this.tone(523, 0.18, { type: 'sine', gain: 0.20 });
        this.tone(784, 0.26, { type: 'sine', gain: 0.16, delay: 0.08 });
        this.tone(1046, 0.34, { type: 'sine', gain: 0.12, delay: 0.16 });
        break;
      case 'just':
        // 決まった感じの、短くて気持ちのいい合いの手
        this.tone(1320, 0.07, { type: 'triangle', gain: 0.17 });
        this.tone(1980, 0.12, { type: 'sine', gain: 0.13, delay: 0.04 });
        break;
      case 'unit':
        // 単位が1段あがった。上へ抜ける感じの和音。
        [0, 7, 12, 16].forEach((s, i) =>
          this.tone(392 * Math.pow(1.0595, s), 0.55, { type: 'sine', gain: 0.15, delay: i * 0.06 }));
        break;
      case 'voyLine':
        // セリフの合いの手。うるさくしない。
        this.tone(392, 0.5, { type: 'sine', gain: 0.055 });
        break;
      case 'record': {
        // 🛰 ゴールデンレコード。宇宙で唯一の音。
        // 地球の音（波・かみなり・心音・あいさつの母音）を、それらしく合成する。
        const t0 = this.ctx.currentTime;
        this.noise(2.2, { freq: 380, to: 180, gain: 0.10, filter: 'lowpass', q: 0.6 });      // 波
        this.noise(0.9, { freq: 120, to: 60, gain: 0.13, filter: 'lowpass', q: 0.7, delay: 1.0 }); // かみなり
        // 心音
        [0, 0.42, 1.30, 1.72].forEach(d => this.tone(56, 0.18, { type: 'sine', gain: 0.16, delay: d + 0.3 }));
        // 「あいさつ」の母音のような、やわらかい音のつらなり
        [523, 587, 659, 587, 523].forEach((f, i) =>
          this.tone(f, 0.42, { type: 'triangle', gain: 0.085, delay: 1.5 + i * 0.24 }));
        void t0;
        break;
      }
      case 'warn':
        // 予兆。危険は必ず音で先に知らせる（子ども向けの約束）
        this.tone(880, 0.10, { type: 'square', gain: 0.10 });
        this.tone(660, 0.14, { type: 'square', gain: 0.10, delay: 0.13 });
        break;
      case 'hit':
        this.noise(0.22, { freq: 400, to: 90, gain: 0.28, filter: 'lowpass', q: 0.8 });
        this.tone(140, 0.22, { type: 'sawtooth', to: 60, gain: 0.16 });
        break;
      case 'rocket':
        this.noise(0.85, { freq: 320, to: 1500, gain: 0.16, filter: 'bandpass', q: 0.8 });
        this.tone(120, 0.6, { type: 'sawtooth', to: 420, gain: 0.10 });
        break;
      case 'wing':
        this.tone(520, 0.5, { type: 'sine', to: 900, gain: 0.12 });
        break;
      case 'milestone':
        [0, 4, 7].forEach((s, i) =>
          this.tone(523 * Math.pow(1.0595, s), 0.24, { type: 'triangle', gain: 0.16, delay: i * 0.07 }));
        break;
      case 'goal':
        // 月・火星に着いたとき。いちばん派手に。
        [0, 4, 7, 12, 16, 19].forEach((s, i) =>
          this.tone(523 * Math.pow(1.0595, s), 0.5, { type: 'triangle', gain: 0.17, delay: i * 0.09 }));
        break;
      case 'over':
        [0, -3, -7, -12].forEach((s, i) =>
          this.tone(440 * Math.pow(1.0595, s), 0.38, { type: 'triangle', gain: 0.15, delay: i * 0.11 }));
        break;
    }
  }

  // ---------------- BGM ----------------
  // 「時間の伸び」：高度が上がるほど1拍を長くする。
  // 地上は軽快、宇宙へ行くほどゆっくりになり、距離がそのまま体感になる。
  updateBgm(meters) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || !this.bgmOn) return;
    const t = ctx.currentTime;
    if (t < this.nextNoteAt) return;

    const bpm = meters >= 3000 ? 44 : meters >= 1500 ? 58 : meters >= 780 ? 74 : meters >= 380 ? 92 : 116;
    const beat = 60 / bpm / 2;

    // 高度でコードが変わる（明るい→さみしい）
    const SETS = [
      [0, 4, 7, 11, 7, 4],        // 地上：あかるい
      [0, 3, 7, 10, 7, 3],        // 夕やけ
      [0, 3, 7, 12, 10, 7],       // 夜
      [0, 5, 7, 12, 7, 5],        // 宇宙：開いた響き
      [0, 7, 12, 19, 12, 7],      // 深宇宙：まばらで広い
    ];
    const zi = meters >= 3000 ? 4 : meters >= 1500 ? 3 : meters >= 780 ? 2 : meters >= 380 ? 1 : 0;
    const set = SETS[zi];
    const root = [130.81, 116.54, 110.0, 98.0, 87.31][zi];
    const s = set[this.step % set.length];
    const f = root * Math.pow(1.0595, s);

    this.tone(f, beat * 2.2, { type: 'sine', gain: 0.13, bus: this.bgmGain, attack: 0.05 });
    if (this.step % 4 === 0) {
      this.tone(f * 0.5, beat * 3.4, { type: 'sine', gain: 0.10, bus: this.bgmGain, attack: 0.09 });
    }
    // 深宇宙はチッチの心音だけが鳴りつづける（孤独と、生きていること）
    if (meters >= 3000 && this.step % 4 === 2) {
      this.tone(58, 0.16, { type: 'sine', gain: 0.16, bus: this.bgmGain, attack: 0.01 });
      this.tone(48, 0.22, { type: 'sine', gain: 0.12, bus: this.bgmGain, attack: 0.01, delay: 0.17 });
    }
    this.step++;
    this.nextNoteAt = t + beat;
  }

  // 見せ場の前後で使う「完全な無音」。多用しないこと。
  hush(seconds) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.10);
    this.master.gain.setValueAtTime(0.0001, t + seconds);
    this.master.gain.linearRampToValueAtTime(0.85, t + seconds + 0.5);
  }
}
