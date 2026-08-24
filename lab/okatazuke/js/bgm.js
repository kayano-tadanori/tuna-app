// ============================================================
// bgm.js — 音楽（WebAudio でその場で合成。音のファイルは使わない）
//
// ★パズルの音楽でいちばん大事なのは「考えているあいだ 邪魔をしない」こと。
//   ・あそび中は 旋律を鳴らさない（和音とベースと まばらな鈴だけ）
//   ・タイトルと クリアのときだけ 旋律が入る
//   ・音の数は 1拍に1つまで。にぎやかにすると 30分ねばる面で つらくなる
//
// ★曲は ぜんぶ自作。既存曲の写しではない。
//   ハ長調・92拍／分・8小節でひと回り（約21秒）。
//   和音は C → Am → F → G の くり返し（日本の童謡でいちばん耳なじみのある並び）。
//
// 使いかた：
//   OKBgm.play('title')   … タイトル（旋律あり・明るい）
//   OKBgm.play('game')    … あそび中（旋律なし・静か）
//   OKBgm.play(null)      … 止める
//   OKBgm.setOn(true/false)
// ============================================================
'use strict';

const OKBgm = (function () {
  const BPM = 92;
  const STEP = 60 / BPM / 2;          // 8分音符 1つぶん（秒）
  const BARS = 8;
  const STEPS = BARS * 8;             // 8小節 × 8分音符8つ

  // 和音（小節ごと）。数字は MIDI ノート番号。
  const CHORDS = [
    [48, 55, 64],   // C
    [45, 52, 60],   // Am
    [41, 48, 57],   // F
    [43, 50, 59],   // G
    [48, 55, 64],   // C
    [45, 52, 60],   // Am
    [41, 48, 57],   // F
    [43, 50, 62],   // G（さいごは 上へ開いて つなぐ）
  ];

  // 旋律（8分音符64こ。0＝休み）。わらべ歌のような 上がって下がる形。
  const MELODY = [
    67, 0, 69, 67,  0, 64, 0, 0,      // ソ・ラソ  ミ
    64, 0, 62, 64,  0, 60, 0, 0,      // ミ・レミ  ド
    65, 0, 67, 69,  0, 67, 0, 0,      // ファ・ソラ ソ
    67, 0, 0, 0,    0, 0, 0, 0,       // ソ（のばす）
    72, 0, 71, 69,  0, 67, 0, 0,      // ド・シラ  ソ
    67, 0, 64, 67,  0, 69, 0, 0,      // ソ・ミソ  ラ
    69, 0, 67, 65,  0, 64, 0, 0,      // ラ・ソファ ミ
    64, 0, 0, 0,    0, 62, 60, 0,     // ミ …… レド（もどる）
  ];

  let ctx = null, master = null, bus = null, noiseBuf = null;
  let on = true, mode = null, step = 0, nextTime = 0, timer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // ★効果音（audio.js）と 同じ AudioContext を使う。2つ作ると
    //   iPhone で 片方が鳴らなくなることがある
    ctx = (window.OKSnd && OKSnd.ctx && OKSnd.ctx()) || new AC();
    master = ctx.createGain();
    master.gain.value = 0.0;
    // 角をまるめる（合成の音は そのままだと 耳にささる）
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    master.connect(lp);
    lp.connect(ctx.destination);
    bus = master;
    const n = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function voice(freq, t, dur, type, vol, atk, detune) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (atk || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function shaker(t, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 6200; bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    s.connect(bp); bp.connect(g); g.connect(bus);
    s.start(t); s.stop(t + 0.1);
  }

  // 1つぶん 鳴らす
  function playStep(i, t) {
    const bar = (i / 8) | 0;
    const beat = i % 8;
    const ch = CHORDS[bar % CHORDS.length];
    const title = mode === 'title';

    // ベース（1拍目と 5つ目の8分）
    if (beat === 0 || beat === 4) {
      voice(hz(ch[0] - 12), t, beat === 0 ? 0.55 : 0.34, 'sine',
            title ? 0.15 : 0.11, 0.02);
    }
    // 和音（小節あたま。やわらかい三角波を2枚 かさねる）
    if (beat === 0) {
      for (const m of ch) {
        voice(hz(m), t, 1.5, 'triangle', title ? 0.045 : 0.035, 0.12);
        voice(hz(m), t, 1.5, 'triangle', title ? 0.028 : 0.020, 0.12, 7);
      }
    }
    // ころころした分散和音（8分の裏。あそび中は まばらに）
    if (title ? (beat % 2 === 1) : (beat === 3 || beat === 7)) {
      const m = ch[(i * 3) % ch.length] + 12;
      voice(hz(m), t, 0.30, 'sine', title ? 0.05 : 0.035, 0.01);
    }
    // 旋律（タイトルだけ）
    if (title) {
      const m = MELODY[i % MELODY.length];
      if (m) {
        voice(hz(m), t, 0.42, 'triangle', 0.085, 0.03);
        voice(hz(m + 12), t, 0.30, 'sine', 0.022, 0.03);   // 1オクターブ上を うっすら
      }
    }
    // シャカシャカ（拍の裏。あそび中は 半分の数）
    if (title ? (beat % 2 === 1) : (beat === 3 || beat === 7)) {
      shaker(t, beat === 3 ? 0.030 : 0.020);
    }
  }

  function scheduler() {
    if (!ctx || !mode) return;
    while (nextTime < ctx.currentTime + 0.30) {
      playStep(step, nextTime);
      step = (step + 1) % STEPS;
      nextTime += STEP;
    }
  }

  function fade(to, sec) {
    if (!master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.linearRampToValueAtTime(to, t + sec);
  }

  return {
    setOn(v) {
      on = v;
      if (!on) {
        fade(0.0, 0.25);
      } else if (mode) {
        this.play(mode, true);
      }
    },
    isOn() { return on; },
    play(m, force) {
      if (!on) { mode = m; return; }
      if (m === mode && !force) return;
      if (!m) { mode = null; fade(0.0, 0.5); clearInterval(timer); timer = null; return; }
      if (!ensure()) return;
      const restart = !mode;
      mode = m;
      if (restart) {
        step = 0;
        nextTime = ctx.currentTime + 0.08;
      }
      if (!timer) timer = setInterval(scheduler, 60);
      fade(m === 'title' ? 0.30 : 0.22, 0.6);
    },
    // クリアのとき ひとこと 明るくする
    flourish() {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      [72, 76, 79, 84].forEach((m, k) => voice(hz(m), t + k * 0.08, 0.5, 'triangle', 0.07, 0.01));
    },
  };
})();

window.OKBgm = OKBgm;
