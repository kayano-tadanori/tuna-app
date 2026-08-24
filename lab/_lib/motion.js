// ============================================================
// motion.js — 動きの共通部品（lab のゲームで 使いまわす）
//
//   置き場所は lab/_lib/。ゲームからは <script src="../_lib/motion.js"> で読む。
//   ★描画にも モデルにも よりかからない。数だけを あつかう。
//     なので テトリスでも チッチジャンプでも そのまま使える。
//
//   入っているもの
//     MOTION.curve / GAIT … 正常歩行の関節角の 標準曲線（当てずっぽうの sin をやめる）
//     MOTION.Phase        … 進んだ距離から 歩調を出す（足が地面をすべらない）
//     MOTION.spring       … バネで追う（パッと切りかわらない・行きすぎて もどる）
//     MOTION.Chain        … しっぽ・羽・髪の「遅れ」。二次的な動き
//     MOTION.ik2          … 2本の骨で 手先を 目標にとどかせる（体の大きさが違っても届く）
//     MOTION.Blend        … ポーズの重みを なめらかに 混ぜる
// ============================================================
'use strict';

const MOTION = (function () {
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- 輪になった曲線を 読む（Catmull-Rom＝点をちゃんと通る）-------------
  function curve(tab, u) {
    const n = tab.length;
    const x = (((u % 1) + 1) % 1) * n;
    const i = Math.floor(x);
    const f = x - i;
    const a = tab[(i - 1 + n) % n], b = tab[i % n];
    const c = tab[(i + 1) % n], d = tab[(i + 2) % n];
    return 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f
      + (-a + 3 * b - 3 * c + d) * f * f * f);
  }

  // ---- 正常歩行の 関節角（度）--------------------------------------------
  // ★歩行分析で よく使われる 正常歩行の曲線（0=かかと接地、0.6あたりで つま先が離れる）。
  //   ひざが 1周期に2回曲がる「二段膝」が 大事。これが無いと 竹馬の歩きに見える。
  const GAIT = {
    hip: [25, 20, 13, 5, -3, -10, -7, 5, 17, 24, 27, 26],     // +が前へ振り出し
    knee: [5, 15, 18, 12, 6, 8, 25, 50, 62, 55, 30, 10],      // +が曲げ（二段）
    ankle: [0, -4, -2, 5, 10, 4, -14, -19, -8, 0, 2, 0],      // +が背屈
    arm: [-18, -12, -4, 4, 12, 18, 16, 10, 2, -8, -15, -19],  // +が前
  };

  // ---- 歩調（進んだ距離から）--------------------------------------------
  // 1歩（＝半周期）で stride ぶん進む。時間で回すと 足が地面をすべる。
  class Phase {
    constructor(stride) {
      this.v = 0;             // 0..2π
      this.stride = stride || 0.5;
      this.px = 0; this.pz = 0;
      this.have = false;
    }
    // pos … いまの位置 ／ idle … 進んでいないときに 時間で回す速さ(rad/s)
    step(pos, dt, idle) {
      if (!this.have) { this.px = pos[0]; this.pz = pos[2]; this.have = true; }
      const d = Math.hypot(pos[0] - this.px, pos[2] - this.pz);
      this.px = pos[0]; this.pz = pos[2];
      let adv = (d / Math.max(1e-4, this.stride)) * Math.PI;
      if (adv < dt * 0.5) adv = dt * (idle || 0);
      this.v += Math.min(adv, Math.PI * 0.9);   // 1フレームで 回りすぎない
      return this.v;
    }
    get u() { return this.v / (Math.PI * 2); }  // 0..1 の 周期の位置
  }

  // ---- バネ（1自由度）----------------------------------------------------
  // st … {v: いまの値, d: いまの速さ}。行きすぎて もどるので 生きものらしくなる。
  function spring(st, target, dt, k, damp) {
    k = k === undefined ? 90 : k;
    damp = damp === undefined ? 14 : damp;
    // 安定のため こまかく刻む（dt が大きいと はじけ飛ぶ）
    let left = Math.min(dt, 0.1);
    while (left > 0) {
      const h = Math.min(left, 1 / 120);
      st.d += (-(k * (st.v - target)) - damp * st.d) * h;
      st.v += st.d * h;
      left -= h;
    }
    return st.v;
  }

  // ---- 遅れてついてくる くさり（しっぽ・羽・髪）--------------------------
  // 節ごとに 少しずつ遅れて 前の節を追う＝二次的な動き（follow-through）。
  class Chain {
    constructor(n, k, damp, lag) {
      this.st = [];
      for (let i = 0; i < n; i++) this.st.push({ v: 0, d: 0 });
      this.k = k || 120; this.damp = damp || 16; this.lag = lag === undefined ? 0.55 : lag;
    }
    step(target, dt) {
      let t = target;
      for (let i = 0; i < this.st.length; i++) {
        spring(this.st[i], t, dt, this.k, this.damp);
        t = lerp(t, this.st[i].v, this.lag);
      }
      return this.st.map(s => s.v);
    }
    get(i) { return this.st[i].v; }
  }

  // ---- 2本の骨の IK ------------------------------------------------------
  // 付け根から 目標までの 距離 dist で、上の骨 l1・下の骨 l2 を どれだけ曲げるか。
  //   aim  … 付け根で 目標の向きから さらに開く角（＋がひじ側）
  //   bend … 関節の曲げ角（0＝まっすぐ、＋ほど曲がる）
  // ★体の大きさが 人ごとに違っても、手が ちゃんと にもつに とどく。
  function ik2(l1, l2, dist) {
    const d = clamp(dist, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.999);
    const bend = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const aim = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    return { aim, bend, reach: d };
  }

  // ---- ポーズの重み（パッと切りかわらない）-------------------------------
  class Blend {
    constructor(names, rate) {
      this.w = {}; this.rate = rate || 7;
      for (const n of names) this.w[n] = 0;
    }
    step(target, dt) {
      for (const k in this.w) {
        const t = target && target[k] ? target[k] : 0;
        this.w[k] += (t - this.w[k]) * Math.min(1, dt * this.rate);
      }
      return this.w;
    }
  }

  return { D2R, clamp, lerp, curve, GAIT, Phase, spring, Chain, ik2, Blend };
})();

if (typeof window !== 'undefined') window.MOTION = MOTION;
