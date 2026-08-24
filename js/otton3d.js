// ============================================================
// オットン3Dビューア
//   ログイン画面とトップ画面のキャラを、静止画から3Dモデルに差し替える。
//   外部ライブラリは使わない（チッチジャンプ3D／おとんテトリス2と同じ方針）。
//
//   ★キャンバスは1枚だけ作って、表示中の画面へ引っ越しさせる。
//     画面ごとに作るとWebGLコンテキストが増えてiPhoneで落ちるため。
//
//   ★モデル(models/otton.glb)は骨つきだがアニメは入っていない。
//     Tポーズのままだと突っ立って見えるので、姿勢も動きもここのコードで作る。
//     モデルの作り直しは scripts/build_otton3d.js。
// ============================================================

(function () {
  'use strict';

  const MODEL_URL = 'models/otton.glb';

  // どの画面のどこに置くか。showScreen() から onScreen() で呼ばれる
  //
  // ★トップ画面(subject)は既定で入れない。置き場所の .otton-small-wrap に
  //   backdrop-filter: blur(14px) が掛かっていて、そのすりガラスの箱の中で
  //   毎フレーム描くWebGLキャンバスを回すと、iOS Safari がページごと落ちる。
  //   （2026-08-24。受験番号を保存ずみだと起動直後がトップ画面なので、
  //     アプリが毎回そこで落ちて「問題が繰り返し起きました」になった）
  //   → style.css の .otton-small-wrap から backdrop-filter を外して直した。
  //     ★あそこに すりガラスを戻すなら、この枠も同時に外すこと。
  //   調べたいときは URLに ?otton3d=nosmall で、トップ画面だけ静止画に戻せる。
  const ALL_SLOTS = {
    nickname:  { sel: '#otton-3d-hero',  focus: 'body', sway: 0.40, shadow: true },
    subject:   { sel: '#otton-3d-small', focus: 'head', sway: 0.55, shadow: false },
    character: { sel: '#otton-3d-char',  focus: 'body', sway: 0.40, shadow: true },
  };
  const SLOTS = {};
  for (const k in ALL_SLOTS) {
    if (k === 'subject' && window.OTTON3D_MODE === 'nosmall') continue;
    SLOTS[k] = ALL_SLOTS[k];
  }

  // ---- しぐさ（POSEの角度を置きかえる。時間をかけて混ぜる）----
  //  腕の骨は「0＝真横（Tポーズ）」。左腕はマイナスで下がりプラスで上がる。右腕は逆。
  //  ここの数値は _otton_preview.html で1つずつ描いて見比べて決めた（2026-08-24）
  const GESTURES = {
    // ハチマキを締め直す。オットンらしくて顔アップでも手が画面に入る
    hachimaki: {
      in: 0.45, hold: 0.75, out: 0.55, head: true,
      bones: {
        L_Upperarm: [0, 0, -0.35], R_Upperarm: [0, 0, 0.35],
        L_Forearm: [0, 0, 2.40], R_Forearm: [0, 0, -2.40],
        Spine02: [-0.13, 0, 0], Head: [0.02, 0, 0],
      },
    },
    // ガッツポーズ
    guts: {
      in: 0.28, hold: 0.85, out: 0.45,
      bones: {
        L_Upperarm: [0, 0, -0.55], R_Upperarm: [0, 0, 0.55],
        L_Forearm: [0, 0, 1.55], R_Forearm: [0, 0, -1.55],
        Spine01: [-0.16, 0, 0], Spine02: [-0.26, 0, 0], Head: [0.12, 0, 0],
      },
    },
    // 手をふる（右手を上げて、ひじから左右にふる）
    wave: {
      in: 0.40, hold: 1.70, out: 0.50, head: true,
      bones: {
        R_Upperarm: [0, 0, -1.30], R_Forearm: [0, 0, 0.30], R_Clavicle: [0, 0, -0.18],
        Head: [0.10, -0.13, 0],
      },
      swing: { bone: 'R_Forearm', axis: 2, amp: 0.34, hz: 2.4 },
    },
    // うなずく
    nod: {
      in: 0.22, hold: 0.30, out: 0.30, head: true,
      bones: { Head: [0.42, 0, 0], NeckTwist01: [0.30, 0, 0], Spine02: [-0.06, 0, 0] },
    },
    // 万歳（オーッ！）
    banzai: {
      in: 0.20, hold: 0.70, out: 0.40,
      bones: {
        L_Upperarm: [0, 0, 1.40], R_Upperarm: [0, 0, -1.40],
        L_Forearm: [0, 0, 0.02], R_Forearm: [0, 0, -0.02],
        Spine01: [-0.16, 0, 0], Spine02: [-0.24, 0, 0], Head: [-0.10, 0, 0],
      },
      root: () => ({ y: 0.02 }),
    },
    // 背のび（ぐーっと伸びる）
    stretch: {
      in: 0.65, hold: 0.80, out: 0.70,
      bones: {
        L_Upperarm: [0, 0, 1.30], R_Upperarm: [0, 0, -1.30],
        L_Forearm: [0, 0, -0.20], R_Forearm: [0, 0, 0.20],
        Spine01: [-0.22, 0, 0], Spine02: [-0.30, 0, 0], Head: [-0.18, 0, 0],
      },
      root: () => ({ y: 0.03, sy: 1.04 }),
    },
    // お辞儀
    bow: {
      in: 0.35, hold: 0.40, out: 0.45,
      bones: {
        Spine01: [0.26, 0, 0], Spine02: [0.20, 0, 0], Head: [0.24, 0, 0], NeckTwist01: [0.16, 0, 0],
        L_Upperarm: [0.14, 0, -1.30], R_Upperarm: [-0.14, 0, 1.30],
      },
    },
    // 首をかしげる
    tilt: {
      in: 0.30, hold: 0.55, out: 0.40, head: true,
      bones: { Head: [0.04, 0.12, 0.30], NeckTwist01: [0, 0.06, 0.16] },
    },
    // あごに手（考える）
    think: {
      in: 0.40, hold: 0.90, out: 0.45, head: true,
      bones: {
        R_Upperarm: [0, 0, 0.42], R_Forearm: [0, 0, -2.25],
        Head: [0.06, -0.10, 0.10], Spine02: [-0.10, 0, 0],
      },
    },
    // その場でジャンプ（しゃがむ→跳ぶ→着地でぷにっとつぶれる）
    jump: {
      in: 0.18, hold: 0.55, out: 0.22,
      bones: {
        L_Upperarm: [0, 0, 0.55], R_Upperarm: [0, 0, -0.55],
        L_Forearm: [0, 0, 0.35], R_Forearm: [0, 0, -0.35],
        Spine02: [-0.10, 0, 0],
      },
      root: u => {
        // 0〜.22 しゃがむ / .22〜.78 跳ぶ / .78〜1 着地
        if (u < 0.22) { const k = u / 0.22; return { y: -0.03 * k, sy: 1 - 0.07 * k, sx: 1 + 0.05 * k }; }
        if (u < 0.78) {
          const k = (u - 0.22) / 0.56, h = Math.sin(k * Math.PI);
          return { y: -0.03 + 0.20 * h, sy: 1 + 0.06 * h, sx: 1 - 0.04 * h };
        }
        const k = (u - 0.78) / 0.22, d = Math.sin(k * Math.PI);
        return { y: -0.035 * d, sy: 1 - 0.09 * d, sx: 1 + 0.07 * d };
      },
    },
    // くるっと一回転
    spin: {
      in: 0.15, hold: 0.85, out: 0.15,
      bones: {
        L_Upperarm: [0, 0, -0.85], R_Upperarm: [0, 0, 0.85],
        L_Forearm: [0, 0, 0.55], R_Forearm: [0, 0, -0.55],
      },
      root: u => ({ y: 0.012 * Math.sin(u * Math.PI), yaw: u * u * (3 - 2 * u) * Math.PI * 2 }),
    },
  };
  const GESTURE_KEYS = Object.keys(GESTURES);
  const GESTURE_KEYS_HEAD = GESTURE_KEYS.filter(k => GESTURES[k].head);   // 顔アップで見えるもの

  // ---- 立ち姿（骨のローカル軸まわりに X→Y→Z の順で足す角度・ラジアン）----
  //  Tポーズ（腕が真横）から、胸を張った「常在戦場」の構えにする
  const POSE = {
    Spine01:     [-0.10, 0.00, 0.00],   // 背すじを起こす
    Spine02:     [-0.18, 0.00, 0.00],   // 胸を張る
    NeckTwist01: [0.14, 0.00, 0.00],    // 反らせたぶん、あごが上がらないよう戻す
    Head:        [0.08, 0.00, 0.00],
    L_Clavicle:  [0.00, 0.00, 0.10],    // 肩を後ろに引く
    R_Clavicle:  [0.00, 0.00, -0.10],
    L_Upperarm:  [0.00, 0.00, -1.20],   // Tポーズから腕を下ろす
    R_Upperarm:  [0.00, 0.00, 1.20],
    L_Forearm:   [0.00, 0.00, -0.22],
    R_Forearm:   [0.00, 0.00, 0.22],
    L_Hand:      [0.00, 0.00, -0.10],
    R_Hand:      [0.00, 0.00, 0.10],
  };

  let gl = null, canvas = null, prog = null, shadowProg = null;
  let mesh = null, tex = null, skel = null, ready = false, failed = false;
  let host = null, opts = null, raf = 0, t0 = 0;
  let dragging = false, lastX = 0, dragYaw = 0, spin = 0;
  let uLoc = {}, uLocS = {};

  // ---------- 行列・クォータニオン ----------
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  // out = a * b。out に直接書く（毎フレーム配列を作らないため）
  function mulInto(out, a, b, ao, bo, oo) {
    ao = ao || 0; bo = bo || 0; oo = oo || 0;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[ao + k * 4 + r] * b[bo + c * 4 + k];
      out[oo + c * 4 + r] = s;
    }
    return out;
  }
  // Y軸まわりに回して平行移動とスケールをかける行列。
  // sy を別に渡せるのは、ジャンプの「つぶれ／のび」を作るため
  function trs(tx, ty, tz, yaw, s, sy) {
    if (sy == null) sy = s;
    const c = Math.cos(yaw), n = Math.sin(yaw);
    return [c * s, 0, -n * s, 0, 0, sy, 0, 0, n * s, 0, c * s, 0, tx, ty, tz, 1];
  }
  // カメラはZ軸の正面に固定。高さと距離だけ変える
  function viewMat(eyeY, dist) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -eyeY, -dist, 1];
  }
  function qmul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }
  function qeuler(x, y, z) {  // X→Y→Z の順に回す
    const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
    return qmul(qmul([sx, 0, 0, cx], [0, sy, 0, cy]), [0, 0, sz, cz]);
  }
  function composeInto(out, t, q, s) {
    const [x, y, z, w] = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0], sy = s[1], sz = s[2];
    out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
    out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
    out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
    out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
    return out;
  }

  // ---------- シェーダー ----------
  const VS = `#version 300 es
  in vec3 aPos; in vec3 aNrm; in vec2 aUv; in vec4 aJnt; in vec4 aWgt;
  uniform mat4 uMVP, uModel;
  uniform mat4 uBones[42];
  uniform bool uSkin;
  out vec3 vNrm; out vec2 vUv;
  void main(){
    vec4 p = vec4(aPos, 1.0);
    vec3 n = aNrm;
    if (uSkin) {
      mat4 sk = uBones[int(aJnt.x)] * aWgt.x + uBones[int(aJnt.y)] * aWgt.y
              + uBones[int(aJnt.z)] * aWgt.z + uBones[int(aJnt.w)] * aWgt.w;
      p = sk * p;
      n = mat3(sk) * n;
    }
    vNrm = mat3(uModel) * n;
    vUv = aUv;
    gl_Position = uMVP * p;
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec3 vNrm; in vec2 vUv;
  uniform sampler2D uTex;
  out vec4 outColor;
  void main(){
    vec3 base = texture(uTex, vUv).rgb;
    vec3 n = normalize(vNrm);
    vec3 key = normalize(vec3(0.45, 0.75, 0.85));
    vec3 fill = normalize(vec3(-0.7, 0.15, 0.5));
    // ハーフランバート。子ども向けなので影を落としすぎない
    float kd = dot(n, key) * 0.5 + 0.5;
    float fd = max(dot(n, fill), 0.0);
    vec3 lit = base * (0.62 + 0.55 * kd * kd + 0.18 * fd);
    // アプリの青いネオンに合わせたリムライト
    float rim = pow(1.0 - max(n.z, 0.0), 3.0);
    lit += vec3(0.31, 0.49, 1.0) * rim * 0.55;
    outColor = vec4(lit, 1.0);
  }`;

  // 影：カメラを水平に構えているので地面の板を置くと真横から見て消えてしまう。
  // 画面の上で直接だ円を描く（uRect = 中心x,中心y,横半径,縦半径。すべてNDC）
  const SHADOW_VS = `#version 300 es
  in vec2 aXz;
  uniform vec4 uRect;
  out vec2 vXz;
  void main(){ vXz = aXz; gl_Position = vec4(uRect.x + aXz.x * uRect.z, uRect.y + aXz.y * uRect.w, 0.0, 1.0); }`;

  const SHADOW_FS = `#version 300 es
  precision mediump float;
  in vec2 vXz; out vec4 outColor;
  void main(){
    float d = length(vXz);
    float a = smoothstep(1.0, 0.0, d);
    outColor = vec4(0.05, 0.12, 0.32, a * a * 0.34);
  }`;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  // ---------- GLBを読む（scripts/build_otton3d.js が書き出した形だけ対応） ----------
  async function loadGLB(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('model fetch ' + res.status);
    const buf = await res.arrayBuffer();
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not glb');
    const total = dv.getUint32(8, true);
    let off = 12, json = null, binOff = 0;
    while (off < total) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      else if (type === 0x004e4942) binOff = off + 8;
      off += 8 + len;
    }
    const view = i => {
      const bv = json.bufferViews[i];
      return { start: binOff + (bv.byteOffset || 0), len: bv.byteLength };
    };
    const TAs = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
    const read = i => {
      const a = json.accessors[i], v = view(a.bufferView);
      const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
      return new TAs[a.componentType](buf, v.start + (a.byteOffset || 0), a.count * nc);
    };
    const pr = json.meshes[0].primitives[0];
    const iAcc = json.accessors[pr.indices];
    const img = view(json.images[0].bufferView);
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(buf, img.start, img.len)], { type: json.images[0].mimeType }));
    return {
      pos: read(pr.attributes.POSITION),
      nrm: read(pr.attributes.NORMAL),
      uv: read(pr.attributes.TEXCOORD_0),
      jnt: pr.attributes.JOINTS_0 != null ? read(pr.attributes.JOINTS_0) : null,
      wgt: pr.attributes.WEIGHTS_0 != null ? read(pr.attributes.WEIGHTS_0) : null,
      idx: read(pr.indices),
      idxType: iAcc.componentType === 5123 ? 0x1403 : 0x1405,
      skeleton: json.extras && json.extras.skeleton,
      bitmap,
    };
  }

  // 骨を扱いやすい形にほぐす
  function buildSkeleton(sk) {
    const n = sk.nodes.length;
    const parent = new Int32Array(n).fill(-1);
    sk.nodes.forEach((nd, i) => (nd.children || []).forEach(c => { parent[c] = i; }));
    const byName = {};
    sk.nodes.forEach((nd, i) => { byName[nd.name] = i; });
    return {
      nodes: sk.nodes,
      parent,
      byName,
      joints: sk.joints,
      ibm: new Float32Array(sk.ibm),
      local: Array.from({ length: n }, () => new Float32Array(16)),
      world: Array.from({ length: n }, () => new Float32Array(16)),
      palette: new Float32Array(sk.joints.length * 16),
      extra: {},                                   // 骨名 -> [x,y,z] 追加回転
    };
  }

  // 姿勢＋動きから骨の行列をつくる
  function poseSkeleton(t) {
    const s = skel;
    for (let i = 0; i < s.nodes.length; i++) {
      const nd = s.nodes[i];
      const add = s.extra[nd.name];
      let q = nd.rotation || [0, 0, 0, 1];
      if (add) q = qmul(q, qeuler(add[0], add[1], add[2]));
      composeInto(s.local[i], nd.translation || [0, 0, 0], q, nd.scale || [1, 1, 1]);
      const p = s.parent[i];
      if (p < 0) s.world[i].set(s.local[i]);
      else mulInto(s.world[i], s.world[p], s.local[i]);
    }
    for (let j = 0; j < s.joints.length; j++) {
      mulInto(s.palette, s.world[s.joints[j]], s.ibm, 0, j * 16, j * 16);
    }
  }

  // ---- しぐさの進行 ----
  let gesture = null;      // { key, start }
  let nextGestureAt = 0;
  // しぐさが体ごと動かすぶん（updatePose が入れて frame が使う）
  const rootFx = { y: 0, yaw: 0, sx: 1, sy: 1 };

  function playGesture(key) {
    const list = (opts && opts.focus === 'head') ? GESTURE_KEYS_HEAD : GESTURE_KEYS;
    if (!key) key = list[(Math.random() * list.length) | 0];
    if (!GESTURES[key]) return;
    gesture = { key, start: -1 };   // 次のフレームの時刻を開始にする
  }

  // しぐさの重み（0→1→0）。角がとがらないように両端をなめらかにする
  function gestureWeight(g, dt) {
    if (dt < 0) return 0;
    if (dt < g.in) { const u = dt / g.in; return u * u * (3 - 2 * u); }
    if (dt < g.in + g.hold) return 1;
    const u = (dt - g.in - g.hold) / g.out;
    if (u >= 1) return -1;                       // 終わり
    return 1 - u * u * (3 - 2 * u);
  }

  // 立ち姿に、呼吸・体重移動・しぐさをのせる
  function updatePose(t) {
    const e = skel.extra;
    for (const k in POSE) e[k] = POSE[k].slice();
    rootFx.y = 0; rootFx.yaw = 0; rootFx.sx = 1; rootFx.sy = 1;

    // 待機の動き（止まって見えないよう、はっきりめに）
    const breathe = Math.sin(t * 1.15);
    const shift = Math.sin(t * 0.62);            // 体重移動
    if (e.Spine01) { e.Spine01[0] += breathe * 0.022; e.Spine01[2] = (e.Spine01[2] || 0) + shift * 0.035; }
    if (e.Spine02) { e.Spine02[0] += breathe * 0.030; e.Spine02[2] = (e.Spine02[2] || 0) + shift * 0.025; }
    if (e.Head) {
      e.Head[0] += -breathe * 0.020;
      e.Head[1] += Math.sin(t * 0.47) * 0.13;
      e.Head[2] = (e.Head[2] || 0) - shift * 0.045;
    }
    const swayArm = Math.sin(t * 0.9);
    if (e.L_Upperarm) e.L_Upperarm[2] -= swayArm * 0.055 + shift * 0.05;
    if (e.R_Upperarm) e.R_Upperarm[2] += swayArm * 0.055 + shift * 0.05;
    if (e.L_Forearm) e.L_Forearm[2] -= Math.sin(t * 0.9 + 0.6) * 0.07;
    if (e.R_Forearm) e.R_Forearm[2] += Math.sin(t * 0.9 + 0.6) * 0.07;

    // 何もしないと飽きるので、数秒おきにしぐさを入れる
    if (!gesture && t > nextGestureAt) playGesture();
    if (!gesture) return;
    if (gesture.start < 0) gesture.start = t;
    const g = GESTURES[gesture.key];
    const w = gestureWeight(g, t - gesture.start);
    if (w < 0) {
      gesture = null;
      nextGestureAt = t + 3.2 + Math.random() * 4.5;   // しぐさが11種あるので少し詰める
      return;
    }
    for (const b in g.bones) {
      const from = e[b] || [0, 0, 0], to = g.bones[b];
      e[b] = [from[0] + (to[0] - from[0]) * w,
              from[1] + (to[1] - from[1]) * w,
              from[2] + (to[2] - from[2]) * w];
    }
    if (g.swing) {
      const arr = e[g.swing.bone];
      if (arr) arr[g.swing.axis] += Math.sin((t - gesture.start) * g.swing.hz * 6.283) * g.swing.amp * w;
    }
    if (g.root) {
      // 進み具合を 0→1 で渡す（跳ぶ・回る・つぶれる はここで作る）
      const dur = g.in + g.hold + g.out;
      const r = g.root(Math.min(1, (t - gesture.start) / dur), w);
      rootFx.y = (r.y || 0) * w;
      rootFx.yaw = (r.yaw || 0) * w;
      rootFx.sx = 1 + ((r.sx || 1) - 1) * w;
      rootFx.sy = 1 + ((r.sy || 1) - 1) * w;
    }
  }

  function buildGL(data) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bind = (arr, name, size, type, norm) => {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, type, !!norm, 0, 0);
    };
    bind(data.pos, 'aPos', 3, gl.FLOAT);
    bind(data.nrm, 'aNrm', 3, gl.FLOAT);
    bind(data.uv, 'aUv', 2, gl.FLOAT);
    if (data.jnt) {
      bind(data.jnt, 'aJnt', 4, gl.UNSIGNED_BYTE, false);
      bind(data.wgt, 'aWgt', 4, gl.UNSIGNED_BYTE, true);
    }
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, data.bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    if (data.bitmap.close) data.bitmap.close();

    // 足元の影の板
    const svao = gl.createVertexArray();
    gl.bindVertexArray(svao);
    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const sl = gl.getAttribLocation(shadowProg, 'aXz');
    gl.enableVertexAttribArray(sl);
    gl.vertexAttribPointer(sl, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    mesh = { vao, svao, count: data.idx.length, idxType: data.idxType };
  }

  // ---------- 初期化 ----------
  let initPromise = null;
  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      canvas = document.createElement('canvas');
      canvas.className = 'otton3d-canvas';
      gl = canvas.getContext('webgl2', {
        alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power',
      });
      if (!gl) throw new Error('no webgl2');
      // GPUがつらくなって落ちたら、あきらめて静止画に戻す（落ちたまま回し続けない）
      canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        failed = true;
        ready = false;
        console.warn('[otton3d] WebGLコンテキストが落ちた。静止画に戻す');
        // あとで原因を見分けられるように残す（otton3d-check.html で読める）
        try { localStorage.setItem('otton3d_note', 'contextlost ' + new Date().toLocaleString('ja-JP')); } catch (err) {}
        detach();
      });
      prog = link(VS, FS);
      shadowProg = link(SHADOW_VS, SHADOW_FS);
      const data = await loadGLB(MODEL_URL);
      if (data.skeleton) skel = buildSkeleton(data.skeleton);
      buildGL(data);
      uLoc = {
        mvp: gl.getUniformLocation(prog, 'uMVP'),
        model: gl.getUniformLocation(prog, 'uModel'),
        tex: gl.getUniformLocation(prog, 'uTex'),
        skin: gl.getUniformLocation(prog, 'uSkin'),
        bones: gl.getUniformLocation(prog, 'uBones'),
      };
      uLocS = { rect: gl.getUniformLocation(shadowProg, 'uRect') };
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      attachPointer();
      ready = true;
    })().catch(e => { failed = true; console.warn('[otton3d]', e); throw e; });
    return initPromise;
  }

  function attachPointer() {
    let downX = 0, downT = 0;
    const down = e => {
      dragging = true;
      lastX = downX = (e.touches ? e.touches[0] : e).clientX;
      downT = Date.now();
      spin = 0;
    };
    const move = e => {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0] : e).clientX;
      const dx = x - lastX;
      lastX = x;
      dragYaw += dx * 0.012;
      spin = dx * 0.012;
      if (e.cancelable) e.preventDefault();
    };
    const up = e => {
      // ほとんど動かさずに離したら「さわった」＝しぐさを出す
      if (dragging && Math.abs(lastX - downX) < 8 && Date.now() - downT < 400) playGesture();
      dragging = false;
    };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move);
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchend', up);
  }

  // ---------- 描画 ----------
  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return r.width / Math.max(r.height, 1);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ready || !host) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const aspect = resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!dragging) {
      dragYaw += spin;
      spin *= 0.94;
      if (Math.abs(spin) < 0.0002) spin = 0;
    }
    if (skel) updatePose(t);          // 体ごとの動き(rootFx)も ここで決まる
    const yaw = Math.sin(t * 0.55) * opts.sway + dragYaw + rootFx.yaw;
    const bob = Math.sin(t * 1.15) * 0.006 + rootFx.y;

    // 画づくり：全身は少し引き、顔アップは頭の高さに寄せる
    const head = opts.focus === 'head';
    const eyeY = head ? 0.80 : 0.52;
    const fov = 32 * Math.PI / 180;
    const fitH = head ? 0.42 : 1.06;                  // 縦に収めたい高さ
    let dist = (fitH / 2) / Math.tan(fov / 2) + 0.55;
    if (aspect < 1) dist /= Math.max(aspect, 0.45);   // 縦長のときは引く

    const proj = perspective(fov, aspect, 0.05, 12);
    const view = viewMat(eyeY, dist);
    const model = trs(0, bob, 0, yaw, rootFx.sx, rootFx.sy);
    const mvp = mul(proj, mul(view, model));

    if (opts.shadow) {
      // 足元(原点)と、そこから横に0.22の点を画面に写して、だ円の大きさを決める
      const pj = (x, y, z) => {
        const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        return [(mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w,
                (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w];
      };
      const c0 = pj(0, 0, 0), c1 = pj(0.22, 0, 0);
      const hw = Math.abs(c1[0] - c0[0]) * 1.5;
      const hh = hw * (canvas.width / Math.max(canvas.height, 1)) * 0.36;
      gl.useProgram(shadowProg);
      gl.uniform4f(uLocS.rect, c0[0], c0[1] + hh * 0.15, hw, hh);
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(mesh.svao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.DEPTH_TEST);
    }

    gl.useProgram(prog);
    gl.uniformMatrix4fv(uLoc.mvp, false, new Float32Array(mvp));
    gl.uniformMatrix4fv(uLoc.model, false, new Float32Array(model));
    gl.uniform1i(uLoc.skin, skel ? 1 : 0);
    if (skel) {
      poseSkeleton(t);
      gl.uniformMatrix4fv(uLoc.bones, false, skel.palette);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uLoc.tex, 0);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.idxType, 0);

    gl.bindVertexArray(null);
  }

  // ---------- 画面の出入り ----------
  function detach() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.classList.remove('otton3d-on');
      canvas.parentNode.removeChild(canvas);
    }
    host = null;
  }

  function onScreen(id) {
    const slot = SLOTS[id];
    if (!slot) { detach(); return; }
    if (failed) return;                        // WebGL2が無い端末は静止画のまま
    if (!document.querySelector(slot.sel)) { detach(); return; }
    init().then(() => {
      const target = document.querySelector(slot.sel);
      if (!target) return;
      host = target;
      opts = slot;
      if (canvas.parentNode !== target) {
        detach();
        host = target;
        target.appendChild(canvas);
      }
      target.classList.add('otton3d-on');      // 静止画を隠す
      t0 = 0;
      dragYaw = 0;
      gesture = null;
      nextGestureAt = 1.8;        // 画面に入って少ししたら1回動く
      if (!raf) raf = requestAnimationFrame(frame);
    }).catch(() => {});
  }

  // 姿勢の微調整用（コンソールから Otton3D.tune({Spine02:[-0.2,0,0]}) で試せる）
  function tune(obj) {
    for (const k in obj) POSE[k] = obj[k];
  }

  window.Otton3D = { onScreen, detach, tune, play: playGesture, POSE, GESTURES };
})();
