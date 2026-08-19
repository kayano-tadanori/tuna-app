// ============================================================
// chars.js — 応援キャラ（オトン・オカーン・チッチ・ジェイド）
//   ドット絵を「1ドット＝1ボクセル」で立体化して、盤面の下の
//   ステージでわちゃわちゃさせる。描画はブロックと同じ
//   インスタンシングに相乗りするので追加のドローコールは0。
// ============================================================
'use strict';

// パレット（キー1文字 → 色）。d は奥行き（ボクセル数）、zは前後のずらし。
const CHAR_DEF = {
  otton: {
    name: 'オトン',
    pal: { k:'#3a2a1e', w:'#ffffff', f:'#f5c9a2', e:'#1a1a1a', m:'#c0392b',
           s:'#4f7cff', p:'#233a7a', h:'#f5c9a2', g:'#20242e' },
    depth: { e:{d:1,z:1.6}, m:{d:1.5,z:1.2}, g:{d:1,z:1.8}, h:{d:3,z:0.6}, w:{d:5,z:0.2} },
    idle: [
      '............',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '..wwwwwwww..',
      '..ffffffff..',
      '..gggggggg..',
      '..ffffffff..',
      '..fffmmfff..',
      '...ffffff...',
      '..ssssssss..',
      '.hssssssssh.',
      '.h.ssssss.h.',
      '...pppppp...',
      '...pp..pp...',
    ],
    cheer: [
      '.h........h.',
      '.h.kkkkkk.h.',
      '..kkkkkkkk..',
      '..wwwwwwww..',
      '..ffffffff..',
      '..gggggggg..',
      '..ffffffff..',
      '..ffmmmmff..',
      '...ffffff...',
      '..ssssssss..',
      '..ssssssss..',
      '..ssssssss..',
      '...pppppp...',
      '...pp..pp...',
    ],
  },

  okan: {
    name: 'オカーン',
    pal: { w:'#ffffff', k:'#6b4a2f', f:'#f5c9a2', e:'#1a1a1a', m:'#c0392b',
           v:'#e63c82', a:'#f7b6ce', h:'#f5c9a2' },
    depth: { e:{d:1,z:1.6}, m:{d:1.5,z:1.2}, h:{d:3,z:0.6}, w:{d:4,z:0.4} },
    idle: [
      '....wwww....',
      '...wwwwww...',
      '..wwwwwwww..',
      '..kkkkkkkk..',
      '..ffffffff..',
      '..feffffef..',
      '..ffffffff..',
      '..fffmmfff..',
      '...ffffff...',
      '..vvvvvvvv..',
      '.hvvvvvvvvh.',
      '.h.aaaaaa.h.',
      '...aaaaaa...',
      '...aa..aa...',
    ],
    cheer: [
      '.h........h.',
      '.h..wwww..h.',
      '..wwwwwwww..',
      '..kkkkkkkk..',
      '..ffffffff..',
      '..feffffef..',
      '..ffffffff..',
      '..ffmmmmff..',
      '...ffffff...',
      '..vvvvvvvv..',
      '..vvvvvvvv..',
      '...aaaaaa...',
      '...aaaaaa...',
      '...aa..aa...',
    ],
  },

  chicchi: {
    name: 'チッチ',
    pal: { y:'#ffd93b', d:'#e8b923', o:'#ff9d5c', r:'#e84a2e', e:'#1a1a1a', l:'#ff9d5c' },
    depth: { e:{d:1,z:1.8}, r:{d:2.5,z:1.6}, d:{d:2,z:0.8} },
    idle: [
      '..........',
      '..........',
      '..........',
      '...yyyy...',
      '..yyyyyy..',
      '..oooooo..',
      '..oeooeo..',
      '...rrrr...',
      '..yyyyyy..',
      '.dyyyyyyd.',
      '.dyyyyyyd.',
      '..yyyyyy..',
      '..yyyyyy..',
      '...l..l...',
    ],
    cheer: [
      '..........',
      '.d......d.',
      '.d......d.',
      '.d.yyyy.d.',
      '..yyyyyy..',
      '..oooooo..',
      '..oeooeo..',
      '...rrrr...',
      '..yyyyyy..',
      '..yyyyyy..',
      '..yyyyyy..',
      '..yyyyyy..',
      '..yyyyyy..',
      '...l..l...',
    ],
  },

  // ジェイド：緑のインコ（頭とくちばしまわりがオレンジ）
  jade: {
    name: 'ジェイド',
    pal: { o:'#ff9d2e', O:'#e8791a', y:'#ffd23b', g:'#5cb03a', G:'#2f7a26',
           e:'#1a1a1a', k:'#4a4a4a' },
    depth: { e:{d:1,z:1.8}, k:{d:3,z:1.8}, G:{d:2,z:0.6} },
    idle: [
      '............',
      '............',
      '....oooo....',
      '...oooooo...',
      '..oooooooo..',
      '..oeooooeo..',
      '..oOOkkOOo..',
      '...yyyyyy...',
      '..gyyyyyyg..',
      '.Ggyyyyyygg.',
      '.Gggyyyyggg.',
      '..GggggggG..',
      '...GGGGGG...',
      '...k....k...',
    ],
    cheer: [
      '.G........G.',
      '.G..oooo..G.',
      '.G.oooooo.G.',
      '..oooooooo..',
      '..oeooooeo..',
      '..oOOkkOOo..',
      '...yyyyyy...',
      '..gyyyyyyg..',
      '..gyyyyyyg..',
      '..gyyyyyyg..',
      '..GggggggG..',
      '..GggggggG..',
      '...GGGGGG...',
      '...k....k...',
    ],
  },
};

// 色を先に数値化しておく
for (const k in CHAR_DEF) {
  const d = CHAR_DEF[k];
  d.rgb = {};
  for (const key in d.pal) d.rgb[key] = hex2rgb(d.pal[key]);
  d.w = Math.max(...d.idle.map(r => r.length));
  d.h = d.idle.length;
}

const CHAR_Z = 2.5;                      // 盤面より手前に立たせる
const VOX = 0.170;                       // 1ドットの大きさ（ワールド単位）
const CHAR_ORDER = ['otton', 'okan', 'chicchi', 'jade'];

// 応援団の状態
const Cheer = {
  list: [],
  stageY: 0,

  init(stageY) {
    this.stageY = stageY;
    this.list = CHAR_ORDER.map((key, i) => ({
      key,
      home: (i - 1.5) * 2.9,            // 横に4体ならべる
      x: (i - 1.5) * 2.9,
      phase: i * 1.7,
      hop: 0, hopPow: 0,                // ジャンプ中の進み具合
      spin: 0,                          // くるっと回る
      face: 0,                          // 向き（左右）
      mood: 'idle',                     // idle | cheer | sad
      moodUntil: 0,
      next: 1 + i * 0.6,                // 次に何かする時刻
      dash: 0,                          // 横に走る
    }));
  },

  // 盛り上げ（power 0..1）
  cheer(power, now) {
    for (const c of this.list) {
      c.mood = 'cheer';
      c.moodUntil = now + 0.9 + power * 1.6;
      c.hop = 0.0001;
      c.hopPow = 0.45 + power * 0.5 + Math.random() * 0.15;
      if (power > 0.7) c.spin = 0.0001;
      c.next = now + 0.3;
    }
  },

  sad(now) {
    for (const c of this.list) { c.mood = 'sad'; c.moodUntil = now + 99; c.hop = 0; c.spin = 0; }
  },

  reset(now) {
    for (const c of this.list) { c.mood = 'idle'; c.moodUntil = 0; c.hop = 0; c.spin = 0; c.x = c.home; }
  },

  update(dt, now, danger) {
    for (const c of this.list) {
      if (c.mood !== 'sad' && now > c.moodUntil) c.mood = 'idle';

      // ジャンプ（放物線）
      if (c.hop > 0) { c.hop += dt * 2.6; if (c.hop >= 1) c.hop = 0; }
      if (c.spin > 0) { c.spin += dt * 1.9; if (c.spin >= 1) c.spin = 0; }

      // ときどき勝手に動く＝わちゃわちゃ
      if (c.mood !== 'sad' && now > c.next) {
        const r = Math.random();
        if (r < 0.42) { c.hop = 0.0001; c.hopPow = 0.3 + Math.random() * 0.35; }
        else if (r < 0.62) { c.dash = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random()); }
        else if (r < 0.72) { c.spin = 0.0001; }
        c.next = now + (danger > 0.3 ? 0.5 : 1.1) + Math.random() * 2.2;
      }

      // 走ったあとは自分の場所へ戻る
      if (c.dash) {
        c.x += c.dash * dt * 2.4;
        c.dash *= Math.exp(-dt * 2.2);
        if (Math.abs(c.dash) < 0.05) c.dash = 0;
      }
      c.x += (c.home - c.x) * Math.min(1, dt * 1.4);
      c.x = clamp(c.x, -5.6, 5.6);
      c.face = (c.home - c.x) * 0.35;
    }
  },

  // ブロックのインスタンスとして積む（mirror=trueで床への映り込み）
  build(R, t, danger, mirror) {
    for (const c of this.list) {
      const def = CHAR_DEF[c.key];
      const rows = (c.mood === 'cheer' ? def.cheer : def.idle);
      const hop = c.hop > 0 ? Math.sin(c.hop * Math.PI) * c.hopPow * 0.80 : 0;
      const bob = Math.sin(t * 2.2 + c.phase) * 0.055 + (danger > 0.3 ? Math.sin(t * 9) * 0.03 : 0);
      const squash = c.hop > 0 ? 1 + Math.sin(c.hop * Math.PI) * 0.10 : 1 - Math.sin(t * 2.2 + c.phase) * 0.02;
      const lean = Math.sin(t * 1.3 + c.phase) * 0.05 + c.face;
      const spin = c.spin > 0 ? c.spin * Math.PI * 2 : 0;
      const sad = c.mood === 'sad';
      const rz = sad ? 0.12 : lean * 0.35;
      const ry = sad ? 0.5 : spin + Math.sin(t * 0.9 + c.phase) * 0.18;
      const rx = sad ? 0.35 : -hop * 0.06;

      const baseX = c.x;
      const baseY = Cheer.stageY + hop + bob - (sad ? 0.35 : 0);
      const cx = def.w / 2 - 0.5;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let i = 0; i < row.length; i++) {
          const key = row[i];
          const col = def.rgb[key];
          if (!col) continue;
          const dz = def.depth[key] || { d: 4.6, z: 0 };
          // ローカル座標（キャラの足元が原点）
          const lx = (i - cx) * VOX;
          const ly = (rows.length - 1 - r + 0.5) * VOX * squash;
          const lz = dz.z * VOX;
          const v = rot3([lx, ly, lz], rx, ry, rz);
          if (mirror) {
            const my = 2 * Cheer.stageY - (baseY + v[1]);
            if (my < Cheer.stageY - 2.6) continue;
            R.addBlock(baseX + v[0], my, CHAR_Z + v[2],
              VOX * 1.02, VOX * 1.02 * squash, dz.d * VOX,
              col, 0, 0.20 * clamp(1 - (baseY + v[1] - Cheer.stageY) / 2.6, 0, 1), 0.1,
              i + r, -rx, ry, -rz);
          } else {
            R.addBlock(baseX + v[0], baseY + v[1], CHAR_Z + v[2],
              VOX * 1.02, VOX * 1.02 * squash, dz.d * VOX,
              col, sad ? 0.01 : 0.05, 1, 0.22, i + r, rx, ry, rz);
          }
        }
      }
    }
  },

  // 足元の影（半透明なので別パス）
  buildShadows(R) {
    for (const c of this.list) {
      const def = CHAR_DEF[c.key];
      const lift = c.hop > 0 ? Math.sin(c.hop * Math.PI) * c.hopPow * 0.80 : 0;
      const k = clamp(1 - lift * 0.45, 0.35, 1);
      R.addBlock(c.x, Cheer.stageY + 0.02, CHAR_Z, def.w * VOX * 0.95 * k, 0.05, 0.9 * k,
        [0.0, 0.0, 0.012], 0, 0.55 * k, -1, 1);
    }
  },
};
