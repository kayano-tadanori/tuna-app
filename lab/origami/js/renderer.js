// ============================================================
// renderer.js — WebGL2描画・カメラ操作・ドラッグ判定
//   otton3d.js の attachPointer/viewMat をフォーク。
//   シングルタッチは「handleに当たれば折りドラッグ／外れればカメラオービット」に分岐する
//   （otton3d.jsはシングルタッチ=常にオービットだったので、ここだけ構造を変えた）。
// ============================================================
'use strict';

const OrigamiRenderer = (function () {
  const G = OGL;

  // 凸多角形どうしの共通部分（Sutherland–Hodgman）。2Dの[x,z]配列で受け渡す。
  // 「重ね合わせ」問題で、いま重なっている部分を斜線で示すために使う。
  // 入力は反時計回り・時計回りどちらでもよいよう、クリップ辺の内外判定に符号を合わせる。
  function clipPolygon(subject, clip) {
    const area2 = (poly) => {
      let s = 0;
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        s += x1 * y2 - x2 * y1;
      }
      return s;
    };
    const sign = area2(clip) >= 0 ? 1 : -1;
    let out = subject.slice();
    for (let i = 0; i < clip.length && out.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length];
      const inside = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-9;
      const inter = (p, q) => {
        const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
        const t = d1 / (d1 - d2);
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      };
      const next = [];
      for (let j = 0; j < out.length; j++) {
        const cur = out[j], prev = out[(j + out.length - 1) % out.length];
        const ci = inside(cur), pi = inside(prev);
        if (ci) { if (!pi) next.push(inter(prev, cur)); next.push(cur); }
        else if (pi) next.push(inter(prev, cur));
      }
      out = next;
    }
    return out;
  }

  const VS = `#version 300 es
  in vec3 aPos; in vec2 aUv; in float aPanel; in float aPanel2; in float aBlend;
  in vec3 aNormal; // 物理シム(CLOTH)モード専用：CPU側でフラット計算した法線
  uniform mat4 uVP;
  uniform mat4 uBones[64];
  uniform float uLayer[64];
  uniform float uInflate;          // 0..1（スライダー/マイクで動かす目標値、springで追従済み）
  uniform float uInflateSign[64];  // パネルごとの膨らむ向き（+1/-1/0。0なら膨らまない）
  uniform float uPhysicsMode;      // 0=剛体ヒンジ(既存) / 1=質点バネ物理(aPosが既にワールド座標)
  uniform float uPanelAlpha[64];   // パネルごとの不透明度（既定1.0）。「重ね合わせ」問題で
                                   // 動く方の紙を半透明にし、重なった部分を見せるために使う
  uniform float uFlatStackStep;    // >0なら「平らな紙の重なり」モード：層を世界+Y方向へ
                                   // この厚みぶん積む（0なら従来どおり面法線方向へ微小オフセット）
  out vec2 vUv; out vec3 vWorldNrm; out vec3 vWorldPos; out float vAlpha;
  void main(){
    int panel = int(aPanel);
    vAlpha = uPanelAlpha[panel];
    vec3 wp; vec3 n;
    if (uPhysicsMode > 0.5) {
      // ★2026-08-30 続き13：質点バネ物理(cloth.js)モード。renderer.js側で
      // 毎フレームCPUがシミュレーション後のワールド座標をaPosに直接書き込む
      // (剛体ボーン変換は使わない)。「裂けない」は頂点ブレンドの見た目トリック
      // ではなく、継ぎ目を強いバネで結ぶ本物の力で実現している(本人指摘の
      // 「曲がる仕組みがないと無理」を受けて設計)。
      wp = aPos;
      n = aNormal;
    } else {
      // ★「裂けない仕組み」旧版(見た目のみの頂点ブレンド)。物理モードを使わない
      // 既存作品(だまし舟・やっこさん・ふうせん・かぶと・tsuru.js)はこちらのまま。
      mat4 M = uBones[panel];
      if (aBlend > 0.0001) {
        mat4 M2 = uBones[int(aPanel2)];
        M = mat4(
          mix(M[0], M2[0], aBlend), mix(M[1], M2[1], aBlend),
          mix(M[2], M2[2], aBlend), mix(M[3], M2[3], aBlend)
        );
      }
      vec4 wp4 = M * vec4(aPos, 1.0);
      wp = wp4.xyz;
      n = normalize(mat3(M) * vec3(0.0, 1.0, 0.0));
      // 紙の厚みゼロのパネル同士が完全に重なるとZファイティングでちらつくので、
      // 折り重なりの層(uLayer)ぶんだけ現在の面法線方向へごくわずかに持ち上げる
      // （実測でジグザグの縞が出たのを2026-08-29に確認して追加）。
      // ★ただし自分の法線を使うと、180°折り返して裏返ったパネルは法線が下を向くため
      //   「折り返した紙が土台の下に潜って隠れる」（＝赤い土台しか見えず、裏の白が
      //   見えない）不具合になる。本人の指摘「紙には表と裏がある」「厚みを持たせて
      //   いないのが原因」2026-08-31。平らな折り返し問題(uFlatStackStep>0)では、
      //   層を必ず世界の上方向へ紙の厚みぶん積み上げる＝実物の紙と同じ重なり方にする。
      if (uFlatStackStep > 0.0) {
        wp += vec3(0.0, 1.0, 0.0) * uLayer[panel] * uFlatStackStep;
      } else {
        wp += n * uLayer[panel] * 0.0015;
      }
      // 膨らませ：パネルごとの符号(uInflateSign)ぶん、法線方向にオフセット
      // （鶴・ふうせんの「空気を入れてふくらます」演出。プランの§技術設計より）。
      wp += n * uInflateSign[panel] * uInflate * 0.5;
    }
    vWorldPos = wp;
    vWorldNrm = n;
    vUv = aUv;
    gl_Position = uVP * vec4(wp, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec3 vWorldNrm; in vec3 vWorldPos; in float vAlpha;
  uniform vec3 uColorFront; uniform vec3 uColorBack; uniform vec3 uCameraPos;
  out vec4 outColor;
  void main(){
    // gl_FrontFacingは頂点の巻き順頼みで、剛体折り紙のヒンジ回転では
    // カメラ向きと食い違うことがある（裏返っても常に片面色になるバグの元）。
    // 実際のカメラ方向との内積で表裏を判定する。
    vec3 nrm = normalize(vWorldNrm);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    bool isFront = dot(nrm, viewDir) > 0.0;
    vec3 base = isFront ? uColorFront : uColorBack;
    vec3 n = isFront ? nrm : -nrm;
    vec3 key = normalize(vec3(0.4, 0.85, 0.5));
    float kd = max(dot(n, key), 0.0);
    vec3 lit = base * (0.55 + 0.55 * kd);
    outColor = vec4(lit, vAlpha);
  }`;

  function create(canvas, work) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) throw new Error('WebGL2非対応');
    const prog = G.link(gl, VS, FS);
    const loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aUv: gl.getAttribLocation(prog, 'aUv'),
      aPanel: gl.getAttribLocation(prog, 'aPanel'),
      aPanel2: gl.getAttribLocation(prog, 'aPanel2'),
      aBlend: gl.getAttribLocation(prog, 'aBlend'),
      aNormal: gl.getAttribLocation(prog, 'aNormal'),
      uPhysicsMode: gl.getUniformLocation(prog, 'uPhysicsMode'),
      uVP: gl.getUniformLocation(prog, 'uVP'),
      uBones: gl.getUniformLocation(prog, 'uBones'),
      uLayer: gl.getUniformLocation(prog, 'uLayer'),
      uInflate: gl.getUniformLocation(prog, 'uInflate'),
      uInflateSign: gl.getUniformLocation(prog, 'uInflateSign'),
      uPanelAlpha: gl.getUniformLocation(prog, 'uPanelAlpha'),
      uFlatStackStep: gl.getUniformLocation(prog, 'uFlatStackStep'),
      uColorFront: gl.getUniformLocation(prog, 'uColorFront'),
      uColorBack: gl.getUniformLocation(prog, 'uColorBack'),
      uCameraPos: gl.getUniformLocation(prog, 'uCameraPos'),
    };

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuf = gl.createBuffer();
    const normalBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    const panelBuf = gl.createBuffer();
    const panel2Buf = gl.createBuffer();
    const blendBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();

    function uploadMesh(mesh) {
      const flatPos = new Float32Array(mesh.verts.flat());
      const flatUv = new Float32Array(mesh.uv.flat());
      const flatPanel = new Float32Array(mesh.panel);
      // 「裂けない仕組み」用：無ければ従来通り(panel2=panel, blend=0=ブレンドなし)
      const flatPanel2 = new Float32Array(mesh.panel2 || mesh.panel);
      const flatBlend = new Float32Array(mesh.blend || new Array(mesh.panel.length).fill(0));
      const idx = new Uint16Array(mesh.tris.flat());

      // ★posはCLOTH物理モードだと毎フレームCPUが書き換える(DYNAMIC_DRAW)。
      //   剛体モードの作品はここで設定した値のまま(uBones変換されるので無問題)。
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, flatPos, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.aPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.verts.length * 3), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.aNormal);
      gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.bufferData(gl.ARRAY_BUFFER, flatUv, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc.aUv);
      gl.vertexAttribPointer(loc.aUv, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, panel2Buf);
      gl.bufferData(gl.ARRAY_BUFFER, flatPanel2, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc.aPanel2);
      gl.vertexAttribPointer(loc.aPanel2, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, blendBuf);
      gl.bufferData(gl.ARRAY_BUFFER, flatBlend, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc.aBlend);
      gl.vertexAttribPointer(loc.aBlend, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, panelBuf);
      gl.bufferData(gl.ARRAY_BUFFER, flatPanel, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc.aPanel);
      gl.vertexAttribPointer(loc.aPanel, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      return idx.length;
    }
    let indexCount = uploadMesh(work.mesh);

    const state = FOLD.createState(work);
    // ★物理シム(質点バネ)を使う作品(work.usePhysics)は、剛体ヒンジFKの結果を
    //   「今アクティブ/確定したパネルの目標位置」としてだけ使い、実際の描画位置は
    //   CLOTHのシミュレーション結果を使う。まだ折られていないパネルは目標を
    //   持たず、辺・継ぎ目の制約に従って自然にたわむ(本人指摘「曲がる仕組みが
    //   ないと無理」への対応、tools/gen_steps.py・test_cloth_tsuru.htmlで検証済み)。
    let physSim = work.usePhysics ? CLOTH.createSim(work) : null;
    // 64パネル分の余裕を持って確保(既存のuBones上限と同じ)しておき、作品切り替え
    // (setWork)で頂点数が変わっても配列を作り直さずに済むようにする。
    let physNormalFlat = new Float32Array(4096 * 3);
    let physPosFlat = new Float32Array(4096 * 3);
    // ★2026-08-30 続き13、本人の強い指摘で設計を反転：
    //   旧版は「まだ触れていない全パネル」をweight=0(自由)にしていたため、
    //   手順と無関係な、遠く離れた部分まで継ぎ目の力で勝手にたわんで暴れて
    //   しまっていた(「なってない！」「手順と関係ない場面のヒンジはどうしても
    //   ダメ」)。正しくは「デフォルトは全部固定」、例外は「今アクティブに
    //   動かしているヒンジの、直接の継ぎ目相手(隣接パネル)」だけ——本物の
    //   紙を1箇所折るとき、たわむのはその折り目のすぐ近くだけで、遠くの
    //   部分は動かないのと同じ。
    function physBoneWeights(w, st) {
      const n = w.mesh.boneParent.length;
      // ★折り終わった後(できあがり)は「手順」という概念自体が無いので、
      //   全部固定してしまうと膨らませ(圧力)も羽の手動角度調整も一切効かない
      //   (2026-08-30実測：inflateを上げても無反応だった)。かといって完全に
      //   自由(weight=0)にすると、折り目を覚えておく力が無くなり、紙が
      //   ペラッと平らに開いてしまった(2026-08-30実測)。正しくは「折れた形を
      //   弱い力で覚えておきつつ、圧力や手の操作にはちゃんと逆らえる」——
      //   ソフトな引力(0と1の中間)にする。
      if (FOLD.isFinished(st)) {
        const bwFin = new Array(n).fill(0.12);
        for (let i = 0; i < n; i++) if (w.mesh.boneParent[i] === -1) bwFin[i] = 1;
        return bwFin;
      }
      const bw = new Array(n).fill(1); // デフォルト：全部固定
      // ★「今のヒンジ(例:32)を折る」と、その子孫(木構造でぶら下がる、まだ
      //   折られていない紙全体)は、剛体的に一緒に回転する(FKがそう計算する)。
      //   子孫の隣接パネル(例:32の孫22/46と継ぎ目を持つ10)まで含めて
      //   「アクティブ」扱いしないと、その二次的な継ぎ目だけが取り残されて
      //   裂ける(2026-08-30、本人「1工程目から紙が切れてる」の実機報告で発覚。
      //   panel10↔22/46のneed_linkがUnion-Find上は正しく存在するのに、
      //   32単独グループが先に処理され、10側は完全固定のままだった)。
      const rootActive = new Set();
      const step = w.steps[st.stepIndex];
      if (step) {
        rootActive.add(step.handle.boneId);
        if (step.handle.linkedBoneIds) {
          for (const lb of step.handle.linkedBoneIds) rootActive.add(typeof lb === 'number' ? lb : lb.boneId);
        }
      }
      if (st.grab) rootActive.add(st.grab.boneId);
      if (st.settleBone !== undefined && st.settleBone !== null) rootActive.add(st.settleBone);
      const active = new Set(rootActive);
      for (const a of rootActive) {
        for (let i = 0; i < n; i++) {
          if (active.has(i)) continue;
          // iの祖先をたどってaに辿り着けば子孫
          let x = w.mesh.boneParent[i];
          while (x !== -1 && x !== a) x = w.mesh.boneParent[x];
          if (x === a) active.add(i);
        }
      }
      const adj = physSim ? physSim.panelAdjacency : null;
      if (adj) {
        for (const a of Array.from(active)) {
          const nbrs = adj.get(a);
          if (!nbrs) continue;
          for (const nb of nbrs) {
            // 継ぎ目相手が「まだ確定していない」場合だけたわみを許す。
            // 既に確定済みの隣は、そちらの目標角度で既に安定しているので固定のまま。
            // ★完全に自由(0)にすると、継ぎ目の頂点だけでなく「そのパネル全体」
            //   (継ぎ目から遠い、外側の頂点も含め)が拘束を失い、実測で予測不能な
            //   方向へちぎれ飛んだ(2026-08-30、本人「1工程目から紙が切れてる」で
            //   発覚)。パネル全体には弱い引力(フラット位置へ)を残しつつ、継ぎ目
            //   バネの強い力(SEAM_PASSES)で継ぎ目の頂点だけが実質的に追従できる
            //   ようにする——「継ぎ目は動くが、パネルの残りは大きくは動かない」。
            if (st.committedAngle[nb] === 0 && st.liveAngle[nb] === 0) bw[nb] = 0.08;
          }
        }
      }
      for (const a of active) bw[a] = 1; // アクティブ自身は自分の目標角度へ強く固定
      return bw;
    }
    // 三角形ごとのフラット法線をpos配列から直接計算し、頂点attributeへ複製する。
    function computeFlatNormals(mesh, points, out) {
      for (const tri of mesh.tris) {
        const a = points[tri[0]], b = points[tri[1]], c = points[tri[2]];
        const ux = b.x-a.x, uy = b.y-a.y, uz = b.z-a.z;
        const vx = c.x-a.x, vy = c.y-a.y, vz = c.z-a.z;
        let nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
        const len = Math.hypot(nx,ny,nz) || 1e-9;
        nx/=len; ny/=len; nz/=len;
        for (const vi of tri) { out[vi*3]=nx; out[vi*3+1]=ny; out[vi*3+2]=nz; }
      }
    }
    let layerFlat = new Float32Array(64);
    function updateLayers(w) {
      const depths = FOLD.computeLayerDepths(w);
      layerFlat = new Float32Array(64);
      for (let i = 0; i < depths.length; i++) layerFlat[i] = depths[i];
    }
    updateLayers(work);
    // 紙のサイズが作品ごとに違う（正方形-1..1／長方形cm単位など）ので、
    // 頂点のバウンディング半幅・半奥行きを見てカメラ距離を自動フィットさせる。
    // ★横長の紙を縦長スマホ画面(aspect<1)で見ると横方向の視野角が特にきびしくなるので、
    //   単純な原点距離だけでなく横幅もチェックする（2026-08-29、長方形問題で画面外に
    //   はみ出るバグを実測して発覚・修正）。
    // ★カメラの注視点は「頂点の広がりの中心」にする（ワールド原点固定ではない）。
    //   原点固定だと、中心が原点にない作品（清教学園＝正方形の角が原点、
    //   重ね合わせ問題＝2枚目が右上にずれる）で図が画面のすみに寄る。
    //   見下ろし角を立てたとたん、下半分が画面外に出て発覚した（2026-09-01）。
    let fitHalfW = 1.4, fitHalfD = 1.4, fitCX = 0, fitCZ = 0;
    function updateFit(w) {
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      const acc = (x, z) => {
        minx = Math.min(minx, x); maxx = Math.max(maxx, x);
        minz = Math.min(minz, z); maxz = Math.max(maxz, z);
      };
      for (const v of w.mesh.verts) acc(v[0], v[2]);
      // ★注視点は「折る前（静止時）の紙の中心」に置く。
      //   以前は折り終わりの形も混ぜて中心を出していたが、折り返し先が紙の外へ
      //   大きくはみ出す問題（No.15の帯など）では中心が片側へ寄り、
      //   **折る前の図が下の問題文パネルに潜って読めなくなっていた**（2026-09-01実測）。
      //   折り終わりの形は、下で「収める大きさ」にだけ効かせる。
      fitCX = (minx + maxx) / 2; fitCZ = (minz + maxz) / 2;
      let halfW = Math.max((maxx - minx) / 2, 0.2);
      let halfD = Math.max((maxz - minz) / 2, 0.2);
      // ★折り終わった形も入れて「大きさ」を測る。対角線で折り返す問題（2003年灘中・No.7など）は、
      //   折り返した紙がもとの紙の外へ大きくはみ出すので、折る前の大きさだけで
      //   カメラを合わせると折ったとたん画面からはみ出す（2026-09-01実測で発覚）。
      try {
        const n = w.mesh.boneParent.length;
        const angles = new Array(n).fill(0);
        for (const st of (w.steps || [])) {
          angles[st.handle.boneId] = st.targetAngle;
          for (const lb of (st.linkedBoneIds || [])) {
            const id = (typeof lb === 'object') ? lb.boneId : lb;
            angles[id] = (typeof lb === 'object') ? lb.target : st.targetAngle;
          }
        }
        const mats = FOLD.computeBoneMatrices(w, angles);
        for (let i = 0; i < w.mesh.verts.length; i++) {
          const p = G.vecApply(mats[w.mesh.panel[i]] || mats[0], w.mesh.verts[i]);
          // 注視点(fitCX,fitCZ)からの距離として測る＝中心はずらさず、はみ出すぶんだけ引く
          if (isFinite(p[0])) halfW = Math.max(halfW, Math.abs(p[0] - fitCX));
          if (isFinite(p[2])) halfD = Math.max(halfD, Math.abs(p[2] - fitCZ));
        }
      } catch (e) { /* 折り終わりが計算できない作品はそのまま静止時の大きさで合わせる */ }
      fitHalfW = halfW;
      fitHalfD = halfD;
    }
    updateFit(work);
    let inflateSignFlat = new Float32Array(64);
    function updateInflateSign(w) {
      inflateSignFlat = new Float32Array(64);
      if (w.mesh.inflateSign) w.mesh.inflateSign.forEach((s, i) => { inflateSignFlat[i] = s; });
    }
    updateInflateSign(work);
    // パネルごとの不透明度。既定は全部1.0（＝従来と同じ完全不透明）。
    // 「重ね合わせ」問題(No.1〜3)だけ mesh.panelAlpha で動く紙を半透明にし、
    // 2枚が重なった部分が濃く見えるようにする（本人指示2026-08-31）。
    let panelAlphaFlat = new Float32Array(64).fill(1);
    function updatePanelAlpha(w) {
      panelAlphaFlat = new Float32Array(64).fill(1);
      if (w.mesh.panelAlpha) w.mesh.panelAlpha.forEach((a, i) => { panelAlphaFlat[i] = a; });
    }
    updatePanelAlpha(work);
    // 平らな折り返し問題の「紙の厚み」（1層あたりのワールド単位）。
    // 紙の大きさに比例させるので、-1..1の伝承折り紙でもcm単位の入試問題でも同じ見え方になる。
    let flatStackStep = 0;
    function updateFlatStack(w) {
      flatStackStep = w.mesh.flatStack ? Math.max(fitHalfW, fitHalfD) * 0.014 : 0;
    }
    updateFlatStack(work);
    // 膨らませの目標値(inflateTarget)へspringでなめらかに追従（ドラッグ折りと同じ考え方）
    let inflateTarget = 0;
    const inflateSt = { v: 0, d: 0 };

    // ---------- カメラ ----------
    let dragYaw = 0.5, dragPitch = 0.55, spin = 0, zoom = 1;
    // ★灘中対策コーナーの「平らな折り返し問題」(mesh.flatStack)は、原本の図と同じ
    //   ほぼ真上から見た平面図で始める。斜め見下ろし(pitch=0.55)のままだと長方形が
    //   細い菱形につぶれ、図が小さくなって、角や辺の関係が読み取れない
    //   （本人指摘2026-09-01「角度アがわかりにくい」の一因）。余白も詰めて紙を大きく写す。
    //   指でドラッグすれば今まで通り自由に回せる（初期の見え方だけを変えている）。
    let flatView = false;
    function updateCamera(w) {
      // 「平面図として見せてよい作品」＝折り終わってもぺたんこのままのもの。
      //  ・180°の折り返し（紙が裏返って重なるだけ）
      //  ・紙面に垂直な軸まわりの回転（重ね合わせ問題）
      // 灘中2026の大問10のように「直角に谷折り」して立体になる問題は当てはまらない
      //  ——真上から見ると立ち上がった面がつぶれて、空間把握という問題の core が消える。
      flatView = !!(w.mesh && w.mesh.flatStack) && (w.steps || []).every(st => {
        const h = w.mesh.hinge[st.handle.boneId];
        const spin = h && h.axis && Math.abs(h.axis[1]) > 0.9;   // 紙面に垂直な軸
        // 紙の面の上での平行移動（No.4・No.5の「ずらして重ねる」）もぺたんこのまま
        const slide = h && h.slide && Math.abs(h.slide[1]) < 0.01;
        return spin || slide || Math.abs(Math.abs(st.targetAngle) - Math.PI) < 0.05;
      });
      dragYaw = flatView ? 0 : 0.5;
      dragPitch = flatView ? 1.34 : 0.55;
      zoom = 1;
    }
    updateCamera(work);
    let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, downT = 0;
    let mode = 'idle'; // 'idle' | 'orbit' | 'fold'
    const clampPitch = v => Math.max(0.12, Math.min(1.45, v));
    const clampZoom = v => Math.max(0.6, Math.min(2.6, v));

    let lastVP = G.mat4Identity();

    function worldToScreen(p, rect) {
      const clip = G.vecApplyW(lastVP, [p[0], p[1], p[2], 1]);
      if (clip[3] <= 0.0001) return null;
      const ndcX = clip[0] / clip[3], ndcY = clip[1] / clip[3];
      return { x: (ndcX * 0.5 + 0.5) * rect.width, y: (1 - (ndcY * 0.5 + 0.5)) * rect.height };
    }
    function screenRay(clientX, clientY, rect) {
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
      return G.screenToRay(ndcX, ndcY, lastVP);
    }
    // 通常モードは「今のステップ」1つだけ判定。自由モードは、まだ済んでいない
    // 全ステップの中から画面上いちばん近い折り筋を選ぶ（実物の紙で好きな角を
    // つまむのと同じ）。当たった折り筋のstepIndexを返す（無ければnull）。
    function handleHitTest(clientX, clientY, rect) {
      let best = null, bestDist = 44; // タッチ誤差を考慮しやや広め
      for (const { step, index } of FOLD.pendingSteps(state)) {
        const p = FOLD.handleWorldPos(state, step);
        const s = worldToScreen(p, rect);
        if (!s) continue;
        const dx = clientX - rect.left - s.x, dy = clientY - rect.top - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) { bestDist = dist; best = index; }
      }
      return best;
    }

    function down(e) {
      if (e.touches && e.touches.length >= 2) { mode = 'idle'; dragging = false; return; }
      const pt = e.touches ? e.touches[0] : e;
      const rect = canvas.getBoundingClientRect();
      lastX = downX = pt.clientX; lastY = downY = pt.clientY; downT = Date.now();
      spin = 0;
      const hitIndex = handleHitTest(pt.clientX, pt.clientY, rect);
      if (hitIndex !== null) {
        const ray = screenRay(pt.clientX, pt.clientY, rect);
        if (FOLD.beginDrag(state, ray, hitIndex)) { mode = 'fold'; return; }
      }
      mode = 'orbit'; dragging = true;
    }
    function move(e) {
      if (e.touches && e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        return; // ピンチズームは今後追加（フェーズA最小実装では省略）
      }
      const pt = e.touches ? e.touches[0] : e;
      const rect = canvas.getBoundingClientRect();
      if (mode === 'fold') {
        const ray = screenRay(pt.clientX, pt.clientY, rect);
        FOLD.updateDrag(state, ray);
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (mode !== 'orbit' || !dragging) return;
      const dx = pt.clientX - lastX, dy = pt.clientY - lastY;
      lastX = pt.clientX; lastY = pt.clientY;
      dragYaw += dx * 0.012;
      dragPitch = clampPitch(dragPitch + dy * 0.008);
      spin = dx * 0.012;
      if (e.cancelable) e.preventDefault();
    }
    function up() {
      if (mode === 'fold') FOLD.endDrag(state);
      mode = 'idle'; dragging = false;
    }
    function wheel(e) {
      zoom = clampZoom(zoom * (1 - e.deltaY * 0.0012));
      if (e.cancelable) e.preventDefault();
    }
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move);
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchend', up);
    canvas.addEventListener('touchcancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });

    // ---------- 描画ループ ----------
    let raf = 0, t0 = 0;
    const boneMatFlat = new Float32Array(64 * 16);
    let paperColor = { front: [0.94, 0.35, 0.38], back: [1, 1, 1] };

    let lastAspect = 1;
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      // ★fold画面が非表示のあいだもこのループは回り続け、canvasの表示サイズが0×0になる。
      //   aspect=0だとperspective()内でf/aspect=Infinityになり、次に画面を開いた瞬間
      //   1フレームだけ折り線がNaN座標になる不具合があった(2026-08-31実測で発覚)。
      //   非表示中(幅か高さが0)は直前の有効な値をそのまま使う。
      const aspect = (r.width > 0 && r.height > 0) ? r.width / r.height : lastAspect;
      lastAspect = aspect;
      return { width: r.width, height: r.height, aspect, top: r.top };
    }

    // canvasは画面いっぱいに広がっているが、上はヒントの吹き出し、下は問題文パネルに
    // かぶられて実際には見えない（500×900の画面で、見えるのはおよそ y=80〜612 の帯だけ）。
    // カメラをcanvas全体に合わせると、図の上下がその帯の外＝隠れてしまう（2026-09-01実測。
    // 見下ろし角を立てて図を大きくしたとたん、No.14の上辺とラベルEが吹き出しに隠れた）。
    // → 帯の中心へ寄せる量(shift)と、帯のぶん引きぎみにする係数(ratio)の両方を返す。
    // 伝承折り紙モードのようにパネルが無いときは shift=0・ratio=1（＝従来と同じ）。
    function visibleBand(rect) {
      if (!(rect.height > 0)) return { shift: 0, ratio: 1 };
      let top = 0, bottom = rect.height;
      const below = document.getElementById('ori-problem-panel');
      if (below && below.offsetParent !== null) {
        const b = below.getBoundingClientRect();
        const y = b.top - rect.top;
        if (b.height > 0 && y > 0 && y < rect.height) bottom = y;
      }
      const above = document.getElementById('ori-hint');
      if (above && above.offsetParent !== null) {
        const b = above.getBoundingClientRect();
        const y = b.bottom - rect.top;
        if (b.height > 0 && y > 0 && y < rect.height) top = y;
      }
      // ★以前はここで「帯が狭すぎたら画面全体を使う」としていたが、それだと
      //   shift=0＝図が画面のまん中＝**下半分の問題文パネルに潜って読めなくなる**
      //   （2026-09-01実測。No.15はヒントの吹き出しが4行で帯が画面の39%しかなく、
      //    この安全弁が働いて図がパネルの下に隠れていた）。
      //   寄せること自体はやめず、「収める大きさ」の計算にだけ下限を置く。
      return {
        shift: ((rect.height / 2) - (top + bottom) / 2) * 2 / rect.height,
        ratio: Math.max((bottom - top) / rect.height, 0.4),
      };
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!t0) t0 = now;
      const dt = Math.min((now - (frame.prev || now)) / 1000, 0.05);
      frame.prev = now;

      if (mode !== 'orbit') {
        dragYaw += spin;
        spin *= 0.94;
        if (Math.abs(spin) < 0.0002) spin = 0;
      }
      FOLD.tick(state, dt);
      MOTION.spring(inflateSt, inflateTarget, dt, 90, 14);

      const rect = resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      // 半透明パネル(mesh.panelAlpha)を持つ作品のためのブレンド。
      // 既定はalpha=1.0なので、従来の作品の見た目は一切変わらない。
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const fovY = 34 * Math.PI / 180;
      const tanHalf = Math.tan(fovY / 2);
      // 横方向はaspectで視野角が縮む点まで考慮、縦(奥行き)方向はpitchで見下ろすぶん
      // 実際は余裕があるがここでは安全側にそのまま使う。マージン1.35倍。
      const band = visibleBand(rect);
      // ★カメラの引き具合は折っているあいだも変えない。
      //   「折る前は静止時の大きさ、折るにつれて引く」を試したが、
      //   **ドラッグ中に紙が動いてしまい、折る操作そのものが難しくなった**
      //   （2026-09-01実測。4問が最後まで折れなくなった）。
      //   折り終わりまで入る大きさで固定し、注視点だけ折る前の紙の中心に置く。
      const distForWidth = fitHalfW / (tanHalf * Math.max(rect.aspect, 0.3));
      const distForDepth = fitHalfD / (tanHalf * band.ratio); // 見えている帯にだけ収める
      const dist = (Math.max(distForWidth, distForDepth) * (flatView ? 1.3 : 1.7)) / zoom;
      // 見えている帯の中心に紙が来るよう、ビュー空間で上下にずらす
      const eyeY = -band.shift * dist * tanHalf;
      // 図の中心(fitCX,0,fitCZ)を注視点にする＝先にワールドを中心ぶん平行移動してから見る
      const view = G.mat4Multiply(
        G.viewMat(eyeY, dist, dragPitch, dragYaw),
        G.mat4Translate([-fitCX, 0, -fitCZ]));
      // ★near/farは固定値(0.05/160)だったが、紙の座標がcm単位で大きい作品
      //   （例：塾技No.7は96×48cm＝カメラ距離578）では紙全体がfar=160の外に出て
      //   画面が真っ黒になっていた（2026-08-31、本人が浅野中とNo.7で発見）。
      //   カメラ距離に追従させれば、-1..1の伝承折り紙でもcm単位の入試問題でも
      //   同じコードで破綻しない（深度バッファの精度もdistに比例して最適化される）。
      const proj = G.perspective(fovY, rect.aspect, Math.max(0.05, dist * 0.01), dist * 4);
      lastVP = G.mat4Multiply(proj, view);
      // カメラのワールド位置（viewMatの逆変換の直感的な等価式）
      const cp = Math.cos(dragPitch), sp = Math.sin(dragPitch);
      const cy = Math.cos(dragYaw), sy = Math.sin(dragYaw);
      // ライティング用のカメラ位置（eyeYはビュー空間の上下シフトなのでここには足さない）
      const cameraPos = [fitCX - sy * cp * dist, sp * dist, fitCZ + cy * cp * dist];

      const mats = FOLD.currentBoneMatrices(state);

      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(loc.uVP, false, lastVP);
      gl.uniform3fv(loc.uColorFront, paperColor.front);
      gl.uniform3fv(loc.uColorBack, paperColor.back);
      gl.uniform3fv(loc.uCameraPos, cameraPos);
      gl.uniform1f(loc.uInflate, inflateSt.v);
      gl.uniform1fv(loc.uInflateSign, inflateSignFlat);
      gl.uniform1fv(loc.uPanelAlpha, panelAlphaFlat);
      gl.uniform1f(loc.uFlatStackStep, flatStackStep);

      if (physSim) {
        // 剛体FK(mats)は「今アクティブ/確定したパネルの目標位置」としてのみ使い、
        // 実描画位置は質点バネのシミュレーション結果(physSim.points)を使う。
        const w = state.work;
        const bw = physBoneWeights(w, state);
        CLOTH.applyAttachment(physSim, mats, bw);
        // ★「膨らませ」= 中心から外向きへの本物の内部圧力(本人提案・2026-08-30)。
        //   パネルごとの符号(inflateSign)を人力で割り当てなくても、閉じた袋構造は
        //   辺の長さを保ちながら自然に丸く膨らみ、開いた部分は単に押し出されるだけ
        //   になる——区別は物理的に自動で生まれる。中心は今の全質点の重心。
        let cx = 0, cy = 0, cz = 0;
        for (const p of physSim.points) { cx += p.x; cy += p.y; cz += p.z; }
        const npt = physSim.points.length || 1;
        const pressure = { center: [cx / npt, cy / npt, cz / npt], strength: inflateSt.v * 0.08 };
        CLOTH.step(physSim, Math.min(dt, 1/30), 10, pressure);
        const pts = physSim.points;
        const posSub = physPosFlat.subarray(0, pts.length * 3);
        const nrmSub = physNormalFlat.subarray(0, pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
          posSub[i*3] = pts[i].x; posSub[i*3+1] = pts[i].y; posSub[i*3+2] = pts[i].z;
        }
        computeFlatNormals(w.mesh, pts, nrmSub);
        // ★厚みゼロの質点は複数の層がほぼ同じ場所に重なりZファイティングで
        //   ジグザグのノイズになる(剛体モードのuLayerと同じ問題が物理モードにも
        //   起きる、2026-08-30実測)。法線方向へ層の深さぶんだけ微小オフセット。
        for (let i = 0; i < pts.length; i++) {
          const d = layerFlat[w.mesh.panel[i]] || 0;
          if (!d) continue;
          posSub[i*3]   += nrmSub[i*3]   * d * 0.0015;
          posSub[i*3+1] += nrmSub[i*3+1] * d * 0.0015;
          posSub[i*3+2] += nrmSub[i*3+2] * d * 0.0015;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, posSub);
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, nrmSub);
        gl.uniform1f(loc.uPhysicsMode, 1);
      } else {
        for (let i = 0; i < mats.length && i < 64; i++) boneMatFlat.set(mats[i], i * 16);
        gl.uniformMatrix4fv(loc.uBones, false, boneMatFlat);
        gl.uniform1fv(loc.uLayer, layerFlat);
        gl.uniform1f(loc.uPhysicsMode, 0);
      }
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }
    raf = requestAnimationFrame(frame);

    // ★`atTarget: <boneId>` … そのボーンが「折り終わり（目標角度）」に達したときだけ出す印。
    //   `afterFold`（折り始めてから出す）との違いは、途中の状態では出さないこと。
    //   2枚の図形が交わってできる点（三角定規の重なり・折り目と辺の交点）に付ける角は、
    //   途中の位置では交点そのものが別の場所にあるので、動かしている間は出してはいけない
    //   （2026-09-01追加。関西創価中・05.pdf「5」で必要になった）。
    function reachedTargetBone(b) {
      const step = (state.work.steps || []).find(st => st.handle.boneId === b);
      if (!step) return false;
      return Math.abs((state.liveAngle[b] || 0) - step.targetAngle) < 0.02;
    }

    return {
      state,
      setWork(newWork) {
        indexCount = uploadMesh(newWork.mesh);
        Object.assign(state, FOLD.createState(newWork));
        updateLayers(newWork); updateFit(newWork); updateInflateSign(newWork);
        updatePanelAlpha(newWork); updateFlatStack(newWork); updateCamera(newWork);
        inflateTarget = 0; inflateSt.v = 0; inflateSt.d = 0;
        physSim = newWork.usePhysics ? CLOTH.createSim(newWork) : null;
      },
      setColor(front, back) { paperColor = { front, back: back || front }; },
      // 覚えた手順を自由な順番で再現するモードに切り替える(またはガイド付きに戻す)。
      // ★途中状態を引きずるとdoneSteps/stepIndexが噛み合わなくなるため、
      //   切り替え時は必ず折りかけの状態をリセットする(setWorkと同じ考え方)。
      setFreeMode(v) {
        Object.assign(state, FOLD.createState(state.work, { freeMode: !!v }));
      },
      setInflate(v) { inflateTarget = Math.max(0, Math.min(1, v)); },
      // ワールド座標→画面座標。検証（Playwrightで実際に指で折れるか確かめる）に使う
      worldToScreen(p) { return worldToScreen(p, canvas.getBoundingClientRect()); },
      getInflate() { return inflateSt.v; },
      destroy() { cancelAnimationFrame(raf); },
      getPhysSim() { return physSim; },
      // 対応する頂点ラベル（A,B,C,D等）の現在のスクリーン位置一覧。
      // 灘中対策コーナーの「等しい部分に同じ印をつける」定石の可視化に使う。
      labelScreenPositions() {
        const w = state.work;
        if (!w.labelPoints) return [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        // ★折り返しで名前が変わる頂点（例：芝中のCは折るとEになる）は、
        //   折る前と後で別の文字を出す。`C(E)`のように両方を1つの丸に詰めると
        //   文字がはみ出て読めないうえ、折る前からEが存在するように見えてしまう
        //   （本人指摘2026-08-31「Eの文字がへんだよね」）。
        //   判定はliveDistanceLabelsと同じ「そのボーンが目標角度に達したか」。
        const reachedTarget = (boneId) => {
          const step = w.steps.find(st => st.handle.boneId === boneId);
          if (!step) return false;
          return Math.abs((state.liveAngle[boneId] || 0) - step.targetAngle) < 0.02;
        };
        return w.labelPoints
          // ★kind:'helper'(P・Q等の補助点)は「解説を見る」を押すまで隠す
          .filter(lp => lp.kind !== 'helper' || state.explanationRevealed)
          // ★`atTarget: <boneId>`＝重ね終わってからだけ出す記号。2枚の合同な図形を
          //   回して重ねる問題では、回す前は2枚がぴったり同じ位置にあるので、
          //   両方の頂点に記号を置くと3組とも完全に重なって読めない（No.13）
          .filter(lp => lp.atTarget === undefined || reachedTargetBone(lp.atTarget))
          .map(lp => {
            const p = G.vecApply(mats[lp.boneId], lp.local);
            const s = worldToScreen(p, rect);
            if (!s) return null;
            const label = (lp.foldedLabel && reachedTarget(lp.boneId)) ? lp.foldedLabel : lp.label;
            return { label, x: s.x, y: s.y, kind: lp.kind };
          }).filter(Boolean);
      },
      // 角の弧（例：「ア=32°」がどの角のことかを示す）。
      // work.angleMarks: [{ boneId, vertex:[x,y,z], from:[x,y,z], to:[x,y,z], label, radius? }]
      // 角の頂点vertexから、2本の辺の向き(from方向・to方向)の間を弧で結ぶ。
      // ★弧が無いと「どの角を答えるのか」が図から分からない（本人指示2026-08-31）。
      //   紙は3Dで動くので、弧はワールド空間で作ってから射影する（真上以外から見ても正しい）。
      angleMarkScreenPositions() {
        const w = state.work;
        if (!w.angleMarks) return [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        const defR = Math.max(fitHalfW, fitHalfD) * 0.16;
        const started = (b) => Math.abs(state.liveAngle[b] || 0) > 0.05;
        return w.angleMarks.map(am => {
          // 折ったあとにできる角（例：清教学園のFはAの折り返し先）は
          // afterFold を付けて、折り始めてからだけ出す。
          if (am.afterFold !== undefined && !started(am.afterFold)) return null;
          // 交点にできる角は、折り（回し）終わってからだけ出す
          if (am.atTarget !== undefined && !reachedTargetBone(am.atTarget)) return null;
          const M = mats[am.boneId];
          // 辺の向きを別のパネルの点で指定できる（折って動く頂点を指すため）
          const Mf = mats[am.fromBone !== undefined ? am.fromBone : am.boneId];
          const Mt = mats[am.toBone !== undefined ? am.toBone : am.boneId];
          const V = G.vecApply(M, am.vertex);
          const u = G.vecNorm(G.vecSub(G.vecApply(Mf, am.from), V));
          const v = G.vecNorm(G.vecSub(G.vecApply(Mt, am.to), V));
          const dot = Math.max(-1, Math.min(1, G.vecDot(u, v)));
          const ang = Math.acos(dot);
          if (!(ang > 1e-4)) return null;
          // uと直交し、vと同じ側を向く単位ベクトル（この2本で弧の平面を張る）
          const perp = G.vecNorm(G.vecSub(v, G.vecScale(u, dot)));
          const r = am.radius || defR;
          const N = 14;
          const pts = [];
          for (let i = 0; i <= N; i++) {
            const t = ang * (i / N);
            const d = G.vecAdd(G.vecScale(u, Math.cos(t)), G.vecScale(perp, Math.sin(t)));
            const s = worldToScreen(G.vecAdd(V, G.vecScale(d, r)), rect);
            if (s) pts.push(s);
          }
          if (pts.length < 2) return null;
          // ラベルは弧の外側（頂点から見て弧の中点の少し先）に置く
          const midT = ang / 2;
          const midD = G.vecAdd(G.vecScale(u, Math.cos(midT)), G.vecScale(perp, Math.sin(midT)));
          const labelPos = worldToScreen(G.vecAdd(V, G.vecScale(midD, r * 1.45)), rect);
          return { pts, label: am.label, labelPos };
        }).filter(Boolean);
      },
      // 「求める面積」を斜線で示す領域（本人指示2026-08-31「どの面積を計算したらいいか
      // わからない」）。work.areaMarks: [{ points:[{boneId,local},...] }]
      // 折った後の形で示したいので、点ごとにboneIdを指定できる（動く側の頂点も混ぜられる）。
      // `afterFold: <boneId>` を付けると、その折りを始めてからだけ出す。
      areaMarkScreenPositions() {
        const w = state.work;
        const out = [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        const started = (b) => Math.abs(state.liveAngle[b] || 0) > 0.05;
        for (const am of (w.areaMarks || [])) {
          if (am.afterFold !== undefined && !started(am.afterFold)) continue;
          // 動かしている途中は領域の形が変わってしまう斜線（No.4のように、
          // 重ね終わった配置ではじめて意味を持つ領域）は、終わってからだけ出す
          if (am.atTarget !== undefined && !reachedTargetBone(am.atTarget)) continue;
          const pts = am.points
            .map(p => worldToScreen(G.vecApply(mats[p.boneId], p.local), rect))
            .filter(Boolean);
          if (pts.length >= 3) out.push({ pts });
        }
        // 「重ね合わせ」問題は、答えの領域＝2枚の紙が重なった部分そのもの。
        // 回すたびに形が変わるので、その場で多角形の共通部分を計算して斜線にする
        // （Sutherland–Hodgman）。work.overlapMark: { panelA:[[x,y,z]..], panelB:[...] }
        if (w.overlapMark) {
          const toXZ = (boneId, p) => { const q = G.vecApply(mats[boneId], p); return [q[0], q[2]]; };
          const A = w.overlapMark.panelA.map(p => toXZ(0, p));
          const B = w.overlapMark.panelB.map(p => toXZ(1, p));
          const clipped = clipPolygon(A, B);
          if (clipped.length >= 3) {
            const pts = clipped
              .map(([x, z]) => worldToScreen([x, 0, z], rect))
              .filter(Boolean);
            if (pts.length >= 3) out.push({ pts });
          }
        }
        return out;
      },
      // 補助線（例：AからPへの垂線）。「解説を見る」を押した後だけ表示する。
      // work.helperLines: [{ from:{boneId,local}, to:{boneId,local} }, ...]
      helperLineScreenPositions() {
        const w = state.work;
        if (!w.helperLines || !state.explanationRevealed) return [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        return w.helperLines.map(hl => {
          const a = worldToScreen(G.vecApply(mats[hl.from.boneId], hl.from.local), rect);
          const b = worldToScreen(G.vecApply(mats[hl.to.boneId], hl.to.local), rect);
          return (a && b) ? { a, b } : null;
        }).filter(Boolean);
      },
      // 今の折り具合での実際の距離を、その場で計算して表示する（例：ACの現在の長さ）。
      // work.liveDistanceLabels: [{ from:{boneId,local}, to:{boneId,local}, prefix:'AC=' }, ...]
      // 「紙を折ったらAとCの間の7cm表示はした方がいい」（本人指示2026-08-30）。
      // ★「問題のどこにもAC=30.8なんて書いてない」「折った時だけ見せればいい、
      //   書いてないものを見せるのはダメ」（本人指摘2026-08-30）——折っている途中の
      //   中間値(例：15.3cm)も同じ理由で問題文に無い数値。関係する折り目が
      //   ちゃんと目標の角度(＝図2の状態)まで折れたときだけ表示する。
      liveDistanceScreenPositions() {
        const w = state.work;
        if (!w.liveDistanceLabels) return [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        const targetOf = (boneId) => {
          const step = w.steps.find(st => st.handle.boneId === boneId);
          return step ? step.targetAngle : 0; // ヒンジを持たないボーンは常に0(動かない=常にOK)
        };
        return w.liveDistanceLabels.filter(dl => {
          const okFrom = Math.abs((state.liveAngle[dl.from.boneId] || 0) - targetOf(dl.from.boneId)) < 0.02;
          const okTo = Math.abs((state.liveAngle[dl.to.boneId] || 0) - targetOf(dl.to.boneId)) < 0.02;
          return okFrom && okTo;
        }).map(dl => {
          const pa = G.vecApply(mats[dl.from.boneId], dl.from.local);
          const pb = G.vecApply(mats[dl.to.boneId], dl.to.local);
          const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
          const s = worldToScreen(mid, rect);
          if (!s) return null;
          const dist = G.vecLen(G.vecSub(pa, pb));
          // 2点が近いと（灘中2026のAC=7cmなど）中点のラベルが両端の点の丸に
          // かぶって全部読めなくなる。screenOffsetで画面上を少しずらせるようにする。
          const off = dl.screenOffset || [0, 0];
          return { label: `${dl.prefix || ''}${dist.toFixed(1)}cm`, x: s.x + off[0], y: s.y + off[1] };
        }).filter(Boolean);
      },
      // 辺の長さ（「20cm」等）を、その辺の中点に追従させて表示する。
      // dimensionLabelsは各要素 { boneId, local:[x,y,z], label:'20cm' } を持つ
      // （localはそのボーンのフラット姿勢での中点座標＝labelPointsと同じ考え方）。
      dimensionScreenPositions() {
        const w = state.work;
        if (!w.dimensionLabels) return [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        // ★`afterFold: <boneId>` を付けた寸法は、その折りを始めてからだけ出す
        //   （折ってはじめて現れる辺の長さ＝例：No.8の「EC=12cm」。折る前は
        //   その辺はまだ「CD」なので、先に見せると図と名前が食いちがう）。
        const started = (b) => Math.abs(state.liveAngle[b] || 0) > 0.05;
        return w.dimensionLabels
          .filter(dl => dl.afterFold === undefined || started(dl.afterFold))
          .filter(dl => dl.atTarget === undefined || reachedTargetBone(dl.atTarget))
          .map(dl => {
            const p = G.vecApply(mats[dl.boneId], dl.local);
            const s = worldToScreen(p, rect);
            return s ? { label: dl.label, x: s.x, y: s.y } : null;
          }).filter(Boolean);
      },
      // アクティブなステップの折り線（山折り/谷折り）をスクリーン座標の線分の配列で返す。
      // ヨシザワ・ランドールシステム準拠：谷折り=青の破線、山折り=赤の一点鎖線
      // （kindが省略された既存データは谷折り扱い。実データはworksの多くが谷折りのため）。
      // ★複数の折り筋が同時に連動する複合ステップ(例：つるの四角基本形いっき折り)の
      //   ために、単数`creaseLine`と複数`creaseLines`の両方に対応する(2026-08-30)。
      activeCreaseLines() {
        // ★自由モードは「今のステップ」が無い(どれからでも折れる)ので、
        //   1本だけのクリース表示は今のところ出さない
        //   (全候補を重ねて出す案は今後のUI改善候補)。
        if (state.freeMode) return [];
        const step = FOLD.activeStep(state);
        const activeList = step ? (step.creaseLines || (step.creaseLine ? [step.creaseLine] : [])) : [];
        // work.previewCreases：ステップの進み具合に関係なく常に見せておきたい折り線
        // （灘中対策コーナーで、原本の図1のように複数の折り目を最初から見せたい場合に使う。
        //   本人指示2026-08-30「折れ線DFも点線欲しい」）。伝承作品は使わない＝挙動は変わらない。
        // ★`afterFold: <boneId>` が付いた線は、そのボーンを折り始めてからだけ出す。
        //   「紙を折ったときに隠れた下の紙の辺は破線で表示したほうがいい」（本人指示
        //   2026-08-31）＝折る前の紙の輪郭を破線で残し、どこが折り返されて隠れたのかを
        //   見えるようにする（算数の図で隠れた辺を点線で描く作法と同じ）。
        const started = (boneId) => Math.abs(state.liveAngle[boneId] || 0) > 0.05;
        const list = [...(state.work.previewCreases || []), ...activeList]
          .filter(cl => cl.afterFold === undefined || started(cl.afterFold))
          .filter(cl => cl.atTarget === undefined || reachedTargetBone(cl.atTarget));
        if (!list.length) return [];
        const mats = FOLD.currentBoneMatrices(state);
        const rect = canvas.getBoundingClientRect();
        // ★端点ごとに別のボーンを指せる（`aBone`/`bBone`、既定は`boneId`）。
        //   折ってできた点と、動かない側の頂点を結ぶ補助線を引くために要る
        //   （本人指摘2026-09-01「清教学園みたいな問題はCF間に破線の補助線がいる。
        //   角度アがわかりにくい」＝角の2辺のうち片方が図に無いと角が読めない）。
        return list.map(cl => {
          const Ma = mats[cl.aBone !== undefined ? cl.aBone : cl.boneId];
          const Mb = mats[cl.bBone !== undefined ? cl.bBone : cl.boneId];
          const a = worldToScreen(G.vecApply(Ma, cl.a), rect);
          const b = worldToScreen(G.vecApply(Mb, cl.b), rect);
          return (a && b) ? { a, b, kind: cl.kind || 'valley' } : null;
        }).filter(Boolean);
      },
      // つまむ点（handle）の現在のスクリーン位置一覧。
      // ★どこを指でつまめばいいか画面上に何も出ていなかった（テキストのヒントと
      //   折り線だけでは「つまむ点」がどれか伝わらない）ため追加（2026-08-30実測で判明）。
      // 通常モードはアクティブな1ステップぶん、自由モードはまだ済んでいない
      // 全ステップぶん（どれからでもつまめるので候補を全部見せる）。
      handleScreenPositions() {
        const rect = canvas.getBoundingClientRect();
        const steps = state.freeMode
          ? FOLD.pendingSteps(state).map(x => x.step)
          : [FOLD.activeStep(state)].filter(Boolean);
        return steps.map(step => {
          const p = FOLD.handleWorldPos(state, step);
          const s = worldToScreen(p, rect);
          return s ? { x: s.x, y: s.y } : null;
        }).filter(Boolean);
      },
      // ---- 開発・自動テスト用（本番UIからは使わない） ----
      debugWorldToScreen(boneId, local) {
        const mats = FOLD.currentBoneMatrices(state);
        const p = G.vecApply(mats[boneId], local);
        const rect = canvas.getBoundingClientRect();
        const s = worldToScreen(p, rect);
        return s ? { x: rect.left + s.x, y: rect.top + s.y } : null;
      },
      debugHandleScreenPos() {
        const step = FOLD.activeStep(state);
        if (!step) return null;
        const p = FOLD.handleWorldPos(state, step);
        const rect = canvas.getBoundingClientRect();
        const s = worldToScreen(p, rect);
        return s ? { x: rect.left + s.x, y: rect.top + s.y } : null;
      },
      // 与えた角度でボーンを試算したときの handle スクリーン位置（実際のstateは変えない）
      debugAngleScreenPos(angle) {
        const step = FOLD.activeStep(state);
        if (!step) return null;
        const angles = state.liveAngle.slice();
        angles[step.handle.boneId] = angle;
        const mats = FOLD.computeBoneMatrices(state.work, angles);
        const p = G.vecApply(mats[step.handle.boneId], step.handle.local);
        const rect = canvas.getBoundingClientRect();
        const s = worldToScreen(p, rect);
        return s ? { x: rect.left + s.x, y: rect.top + s.y } : null;
      },
    };
  }

  return { create };
})();

if (typeof window !== 'undefined') window.OrigamiRenderer = OrigamiRenderer;
