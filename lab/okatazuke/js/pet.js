// ============================================================
// pet.js — あたまに とまる ペット（チッチ／ジェイド／メイ）の動き
//   骨は tools/import_pet_glb.py が つめかえた7本：
//     0 からだ / 1 左羽の内 / 2 左羽の外 / 3 右羽の内 / 4 右羽の外 / 5 あたま / 6 しっぽ
//   ★羽は もらったモデルでは 広げた形。ここで たたんで、ときどき 羽ばたかせる。
//   ★バネと 遅れ（follow-through）は lab/_lib/motion.js を使う。
// ============================================================
'use strict';

const PET_BONE = { BODY: 0, WLI: 1, WLO: 2, WRI: 3, WRO: 4, HEAD: 5, TAIL: 6 };
const PET_NBONE = 7;

class PetRig {
  constructor(M) {
    const h = (M && M.height) || 0.135;
    this.P = (M && M.p) || {
      wli: [h * 0.12, h * 0.55, 0], wlo: [h * 0.28, h * 0.58, -0.02],
      wri: [-h * 0.12, h * 0.55, 0], wro: [-h * 0.28, h * 0.58, -0.02],
      head: [0, h * 0.62, 0], tail: [0, h * 0.35, -h * 0.2], h: h,
    };
    this.bones = [];
    for (let i = 0; i < PET_NBONE; i++) this.bones.push(M4.ident());
    this.t = 0;
    // 羽：内と外で 別のバネ。外は 遅れてついてくる＝羽の先が しなる
    this.wIn = { v: 1.0, d: 0 };
    this.wOut = { v: 1.0, d: 0 };
    this.body = { v: 0, d: 0 };        // 体の 上下のはずみ
    this.look = { v: 0, d: 0 };        // 首の 向き
    this.tail = { v: 0, d: 0 };
    this.flap = 0;                     // 羽ばたきの のこり時間
    this.next = 2.5;                   // つぎに 羽ばたくまで
    this.hop = 0;
  }

  // st … { walk, cheer, push, phase } … あそぶ人の いまの状態
  update(dt, st) {
    st = st || {};
    const t = (this.t += dt);
    const P = this.P;
    const walk = st.walk || 0, cheer = st.cheer || 0;

    // ---- いつ 羽ばたくか -------------------------------------------------
    // よろこんでいるときは ずっと。歩いているときは ときどき。
    // 止まっているときも たまに（生きているように見せる）
    this.next -= dt * (1 + walk * 1.6 + cheer * 6);
    if (this.next <= 0) {
      this.flap = 0.55 + Math.random() * 0.35;
      this.next = cheer > 0.4 ? 0.35 : (2.0 + Math.random() * 3.0) / (1 + walk);
      this.hop = 1;
    }
    if (this.flap > 0) this.flap -= dt;

    // 羽の目標角。1.05＝たたむ ／ −0.55＝上げる
    let want = 1.05;
    if (this.flap > 0) {
      // 羽ばたきは 上げが速く 下ろしが ゆっくり（本物もそう）
      const s = Math.sin(t * 26);
      want = s > 0 ? -0.55 : 0.75;
    } else if (cheer > 0.3) {
      want = 0.35 - cheer * 0.25;
    }
    MOTION.spring(this.wIn, want, dt, 260, 22);
    // ★外は 内より 遅れて追う。これだけで 羽が しなって見える
    MOTION.spring(this.wOut, this.wIn.v * 0.72 + 0.18, dt, 150, 15);

    // 体の はずみ（歩きに合わせて 上下、羽ばたくと ふわっと浮く）
    const bobT = Math.sin(t * 3.1) * 0.004 + (this.flap > 0 ? 0.012 : 0)
      + Math.abs(Math.sin(st.phase || 0)) * 0.006 * walk;
    MOTION.spring(this.body, bobT, dt, 180, 16);
    if (this.hop) { this.body.d += 0.55; this.hop = 0; }

    // 首：ときどき きょろきょろ。歩いていると 進む先を見る
    const lookT = Math.sin(t * 0.7) * 0.55 + Math.sin(t * 1.9) * 0.25 - walk * 0.35;
    MOTION.spring(this.look, lookT, dt, 40, 9);
    MOTION.spring(this.tail, -this.body.d * 0.10 + Math.sin(t * 2.3) * 0.10, dt, 90, 11);

    // ---- 骨を 組み立てる（ペットの中の座標系）---------------------------
    const body = mul(T(0, this.body.v, 0),
                     Rz(Math.sin(t * 1.7) * 0.03),
                     Rx(-this.body.d * 0.06 + walk * 0.05));
    this.bones[PET_BONE.BODY] = body;

    const wings = [[PET_BONE.WLI, PET_BONE.WLO, P.wli, P.wlo, 1],
                   [PET_BONE.WRI, PET_BONE.WRO, P.wri, P.wro, -1]];
    for (const [bi, bo, pi, po, sx] of wings) {
      // ★+X の羽を 下げるには Rz をマイナスに回す（逆にすると 背中で交差する）
      const inn = mul(body, T(pi[0], pi[1], pi[2]),
                      Rz(-sx * this.wIn.v),
                      Ry(sx * (0.25 + this.wIn.v * 0.30)),
                      T(-pi[0], -pi[1], -pi[2]));
      this.bones[bi] = inn;
      this.bones[bo] = mul(inn, T(po[0], po[1], po[2]),
                           Rz(-sx * (this.wOut.v - this.wIn.v)),
                           Ry(sx * (this.wOut.v - this.wIn.v) * 0.4),
                           T(-po[0], -po[1], -po[2]));
    }

    const H = P.head;
    this.bones[PET_BONE.HEAD] = mul(body, T(H[0], H[1], H[2]),
                                    Ry(this.look.v),
                                    Rx(Math.sin(t * 2.6) * 0.05 - walk * 0.08),
                                    T(-H[0], -H[1], -H[2]));
    const A = P.tail;
    this.bones[PET_BONE.TAIL] = mul(body, T(A[0], A[1], A[2]),
                                    Rx(this.tail.v),
                                    Ry(Math.sin(t * 1.3) * 0.12),
                                    T(-A[0], -A[1], -A[2]));
    return this.bones;
  }

  // 撮影用：時間を止めて 羽の角度だけ決める
  freeze(u) {
    this.flap = 0;
    this.wIn.v = u; this.wIn.d = 0;
    this.wOut.v = u * 0.72 + 0.18; this.wOut.d = 0;
    this.body.v = 0; this.body.d = 0;
    this.look.v = 0; this.tail.v = 0;
    this.update(0, {});
  }
}
