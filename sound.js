// ============================================================
// オトン学園 サウンドエンジン（Web Audio・外部ファイル不使用）
// 効果音（タップ/正解/不正解/連続正解/結果ファンファーレ）と
// 科目別BGM（国語/算数/理科/社会/ドリル）を合成で鳴らす。
// 設定は localStorage 'oton_snd_v1' に保存。
// ============================================================

const Snd = (() => {
  const DEFAULTS = { sfxOn: true, musicOn: true, sfxVol: 0.7, musicVol: 0.5 };
  let cfg = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('oton_snd_v1'));
    if (saved && typeof saved === 'object') cfg = { ...DEFAULTS, ...saved };
  } catch (e) { /* 既定値のまま */ }

  let ctx = null, sfxGain = null, musicGain = null;
  let streak = 0;

  function save() { localStorage.setItem('oton_snd_v1', JSON.stringify(cfg)); }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = cfg.sfxVol;
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = cfg.musicVol;
    musicGain.connect(ctx.destination);
    return true;
  }

  // iOSのマナーモード（横の消音スイッチ）でもWeb Audioが鳴るよう、再生カテゴリを指定
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 非対応環境は無視 */ }

  // 旧iOS（audioSession非対応）向け：無音の<audio>をループ再生すると
  // 再生セッションが「メディア再生」扱いになり、マナーモードでもWeb Audioが鳴る
  let silentAudio = null;
  function unlockHtmlAudio() {
    if (silentAudio) return;
    try {
      // 0.05秒の無音WAV（44.1kHz・16bit・モノラル）
      silentAudio = new Audio('data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
      silentAudio.loop = true;
      const p = silentAudio.play();
      if (p && p.catch) p.catch(() => { silentAudio = null; });
    } catch (e) { silentAudio = null; }
  }

  // iOSはユーザー操作がないと音が出ないので、タップのたびに起こす
  const unlock = () => {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!navigator.audioSession) unlockHtmlAudio();
    if (bgmName && cfg.musicOn) startScheduler();
  };
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('click', unlock, { capture: true });
  // PWAがバックグラウンドから復帰したときに再開
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume();
  });

  // ---------- 基本波形ヘルパー ----------
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12); // MIDIノート→周波数

  function tone(dest, { freq, at = 0, dur = 0.15, type = 'sine', vol = 0.5, slide = 0, attack = 0.005, release = null }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    const rel = release == null ? dur * 0.6 : release;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dest, { at = 0, dur = 0.1, vol = 0.3, hp = 4000 }) {
    const t0 = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0);
  }

  const canSfx = () => cfg.sfxOn && ensure();

  // ---------- 効果音 ----------
  function tap() {
    if (!canSfx()) return;
    tone(sfxGain, { freq: 1250, dur: 0.045, type: 'triangle', vol: 0.25 });
  }

  function correct() {
    if (!canSfx()) return;
    // ピンポン♪（明るい長三度）
    tone(sfxGain, { freq: NOTE(81), at: 0,    dur: 0.12, type: 'sine', vol: 0.5 });     // A5
    tone(sfxGain, { freq: NOTE(85), at: 0.10, dur: 0.28, type: 'sine', vol: 0.5 });     // C#6
    tone(sfxGain, { freq: NOTE(81), at: 0,    dur: 0.12, type: 'triangle', vol: 0.2 });
    tone(sfxGain, { freq: NOTE(85), at: 0.10, dur: 0.28, type: 'triangle', vol: 0.2 });
  }

  function wrong() {
    if (!canSfx()) return;
    // ブッブー（低い減5度で下がる）
    tone(sfxGain, { freq: 220, at: 0,    dur: 0.16, type: 'square', vol: 0.18 });
    tone(sfxGain, { freq: 165, at: 0.17, dur: 0.30, type: 'square', vol: 0.18 });
    tone(sfxGain, { freq: 110, at: 0.17, dur: 0.30, type: 'sawtooth', vol: 0.10 });
  }

  function combo(n) {
    if (!canSfx()) return;
    // 連続正解：上昇アルペジオ＋キラキラ。連続数が増えるほど高く長く派手に
    const base = [60, 64, 67, 72]; // Cメジャー
    const lift = Math.min(n - 2, 7); // 3連続=+1度ずつ上がる（上限あり）
    for (let i = 0; i < 4; i++) {
      tone(sfxGain, { freq: NOTE(base[i] + 12 + lift), at: i * 0.06, dur: 0.14, type: 'square', vol: 0.22 });
      tone(sfxGain, { freq: NOTE(base[i] + 24 + lift), at: i * 0.06, dur: 0.14, type: 'sine', vol: 0.3 });
    }
    tone(sfxGain, { freq: NOTE(84 + lift), at: 0.26, dur: 0.4, type: 'sine', vol: 0.4 });
    noiseBurst(sfxGain, { at: 0.26, dur: 0.25, vol: 0.15, hp: 6000 });
    if (n >= 5) { // 5連続以上はさらにキラッ
      tone(sfxGain, { freq: NOTE(96), at: 0.34, dur: 0.3, type: 'sine', vol: 0.28 });
      noiseBurst(sfxGain, { at: 0.4, dur: 0.3, vol: 0.12, hp: 8000 });
    }
  }

  // 結果画面：成績に応じたファンファーレ
  function fanfare(kind) {
    if (!canSfx()) return;
    const play = (seq, type = 'square', vol = 0.22) =>
      seq.forEach(([note, at, dur]) => {
        tone(sfxGain, { freq: NOTE(note), at, dur, type, vol });
        tone(sfxGain, { freq: NOTE(note + 12), at, dur, type: 'sine', vol: vol * 0.8 });
      });
    if (kind === 'perfect') {
      // 満点：パパパパーン！
      play([[72, 0, 0.12], [72, 0.14, 0.12], [72, 0.28, 0.12], [76, 0.42, 0.5], [79, 0.72, 0.7]]);
      tone(sfxGain, { freq: NOTE(48), at: 0.42, dur: 0.9, type: 'sawtooth', vol: 0.12 });
      noiseBurst(sfxGain, { at: 0.42, dur: 0.4, vol: 0.18, hp: 5000 });
      noiseBurst(sfxGain, { at: 0.9, dur: 0.5, vol: 0.14, hp: 7000 });
    } else if (kind === 'good') {
      // 高得点：明るいファンファーレ
      play([[67, 0, 0.14], [72, 0.16, 0.14], [76, 0.32, 0.4], [79, 0.6, 0.5]]);
      noiseBurst(sfxGain, { at: 0.6, dur: 0.35, vol: 0.12, hp: 6000 });
    } else if (kind === 'ok') {
      // まずまず：短い明るめジングル
      play([[64, 0, 0.15], [67, 0.17, 0.15], [72, 0.34, 0.45]], 'triangle', 0.3);
    } else {
      // 残念：やさしく励ます下降→上昇
      play([[64, 0, 0.2], [62, 0.22, 0.2], [60, 0.44, 0.3], [67, 0.78, 0.5]], 'sine', 0.35);
    }
  }

  // ---------- 正誤の共通入口（連続正解を管理） ----------
  function answer(isCorrect) {
    if (isCorrect) {
      streak++;
      if (streak >= 3) combo(streak); else correct();
    } else {
      streak = 0;
      wrong();
    }
  }

  // 結果画面：0-100の成績→ファンファーレ
  function result(rate) {
    stopBgm();
    if (rate >= 100) fanfare('perfect');
    else if (rate >= 80) fanfare('good');
    else if (rate >= 50) fanfare('ok');
    else fanfare('sad');
  }

  // ---------- BGM（16ステップのループシーケンサ） ----------
  // b:ベース m:メロディ h:ハット（各[step, note(midi), durSteps]）
  const BGM = {
    // 算数：明るくリズミカル（ハ長調ポップ）
    sansu: {
      bpm: 128, type: { b: 'triangle', m: 'square' }, vol: { b: 0.20, m: 0.10, h: 0.05 },
      b: [[0, 48, 2], [4, 55, 2], [8, 45, 2], [12, 55, 2]],
      m: [[0, 72, 1], [2, 76, 1], [4, 79, 2], [8, 76, 1], [10, 72, 1], [12, 74, 1], [14, 76, 2]],
      h: [0, 4, 8, 12],
    },
    // 国語：和風（陽音階の琴づま弾き）
    kokugo: {
      bpm: 92, type: { b: 'sine', m: 'triangle' }, vol: { b: 0.22, m: 0.16, h: 0 },
      b: [[0, 50, 4], [8, 45, 4]],
      m: [[0, 74, 1], [2, 76, 1], [4, 79, 2], [8, 81, 1], [10, 79, 1], [12, 76, 1], [14, 74, 2]],
      h: [],
      pluck: true,
    },
    // 理科：ふしぎな宇宙シンセ（マイナーadd9のアルペジオ）
    rika: {
      bpm: 108, type: { b: 'sine', m: 'sine' }, vol: { b: 0.22, m: 0.14, h: 0 },
      b: [[0, 45, 4], [8, 41, 4]],
      m: [[0, 69, 1], [2, 72, 1], [4, 76, 1], [6, 79, 1], [8, 76, 1], [10, 72, 1], [12, 71, 1], [14, 74, 1]],
      h: [],
      echo: true,
    },
    // 社会：旅のマーチ（行進のベース＋ラッパ風）
    shakai: {
      bpm: 116, type: { b: 'triangle', m: 'sawtooth' }, vol: { b: 0.24, m: 0.08, h: 0.04 },
      b: [[0, 43, 2], [2, 50, 2], [4, 43, 2], [6, 50, 2], [8, 43, 2], [10, 50, 2], [12, 47, 2], [14, 50, 2]],
      m: [[0, 67, 2], [4, 71, 1], [6, 72, 1], [8, 74, 3], [12, 71, 1], [14, 67, 2]],
      h: [0, 8],
    },
    // 算数ドリル：緊張感（速い短調オスティナート＋刻み）
    drill: {
      bpm: 150, type: { b: 'sawtooth', m: 'square' }, vol: { b: 0.16, m: 0.07, h: 0.06 },
      b: [[0, 45, 1], [2, 45, 1], [4, 48, 1], [6, 45, 1], [8, 45, 1], [10, 48, 1], [12, 51, 1], [14, 50, 1]],
      m: [[0, 69, 1], [4, 69, 1], [6, 71, 1], [8, 72, 2], [12, 71, 1], [14, 68, 1]],
      h: [0, 2, 4, 6, 8, 10, 12, 14],
    },
  };

  let bgmName = null, schedTimer = null, nextStepTime = 0, stepIdx = 0;

  function scheduleStep(def, step, when) {
    const stepDur = 60 / def.bpm / 2; // 8分音符=1ステップ
    for (const [s, note, len] of def.b) {
      if (s === step) tone(musicGain, { freq: NOTE(note), at: when - ctx.currentTime, dur: stepDur * len * 0.95, type: def.type.b, vol: def.vol.b, release: stepDur * len * 0.4 });
    }
    for (const [s, note, len] of def.m) {
      if (s !== step) continue;
      const dur = def.pluck ? Math.min(stepDur * len, 0.35) : stepDur * len * 0.9;
      tone(musicGain, { freq: NOTE(note), at: when - ctx.currentTime, dur, type: def.type.m, vol: def.vol.m, release: def.pluck ? dur * 0.9 : dur * 0.4 });
      if (def.echo) tone(musicGain, { freq: NOTE(note + 12), at: when - ctx.currentTime + stepDur, dur: dur * 0.8, type: 'sine', vol: def.vol.m * 0.35 });
    }
    if (def.h.includes(step) && def.vol.h > 0) noiseBurst(musicGain, { at: when - ctx.currentTime, dur: 0.03, vol: def.vol.h, hp: 7000 });
  }

  function startScheduler() {
    if (schedTimer || !bgmName || !cfg.musicOn) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    nextStepTime = ctx.currentTime + 0.1;
    stepIdx = 0;
    schedTimer = setInterval(() => {
      const def = BGM[bgmName];
      if (!def) return;
      const stepDur = 60 / def.bpm / 2;
      while (nextStepTime < ctx.currentTime + 0.3) {
        scheduleStep(def, stepIdx % 16, nextStepTime);
        nextStepTime += stepDur;
        stepIdx++;
      }
    }, 100);
  }

  function stopScheduler() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  function bgm(name) {
    if (name === bgmName) { if (name) startScheduler(); return; }
    bgmName = name || null;
    stopScheduler();
    if (bgmName && cfg.musicOn && ctx) startScheduler();
  }

  function stopBgm() { bgm(null); }

  // 画面遷移からBGMを決める（app.jsのshowScreenが呼ぶ）
  function onScreen(id) {
    const wasPlay = !!bgmName;
    if (id === 'drill') bgm('drill');
    else if (id === 'sansu-quiz') {
      const subj = (typeof sansuState !== 'undefined' && sansuState.subject) || 'sansu';
      bgm(BGM[subj] ? subj : 'sansu');
    } else if (id === 'quiz' || id === 'fill' || id === 'kanji') bgm('kokugo');
    // 科目のホーム画面でも、その科目の雰囲気の曲を流す
    else if (id === 'home') bgm('kokugo');
    else if (id === 'sansu-home') bgm('sansu');
    else if (id === 'rika-home') bgm('rika');
    else if (id === 'shakai-home') bgm('shakai');
    else stopBgm();
    // 勉強画面に入り直したら連続正解カウントをリセット
    if (!wasPlay && bgmName) streak = 0;
    if (!bgmName) streak = 0;
  }

  // ---------- 設定用API ----------
  function set(key, val) {
    cfg[key] = val;
    save();
    if (key === 'sfxVol' && sfxGain) sfxGain.gain.value = val;
    if (key === 'musicVol' && musicGain) musicGain.gain.value = val;
    if (key === 'musicOn') { if (!val) stopScheduler(); else if (bgmName) startScheduler(); }
  }
  function get() { return { ...cfg }; }

  // 設定画面に出す診断情報（不具合の切り分け用）
  function diag() {
    const eng = ctx ? ctx.state : '未起動（画面をタップすると起動）';
    const mute = navigator.audioSession ? '対応(audioSession)' : (silentAudio ? '対応(無音再生)' : '未対策');
    return `音声エンジン: ${eng}／マナーモード対策: ${mute}／BGM: ${bgmName || '停止中'}`;
  }

  // ---------- 全ボタン共通のタップ音（キャプチャで委譲） ----------
  document.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn && !btn.disabled) tap();
  }, true);

  return { tap, correct, wrong, combo, fanfare, answer, result, bgm, stopBgm, onScreen, set, get, diag };
})();
