// ============================================================
// fold.js — 折る動作の核（ヒンジドラッグの数学＋ステップの状態機械）
//
//   ★手触り感の要（[[project_oton_gakuen]]計画より）：
//   ドラッグ中はspringを使わず、指の動きから出した角度を毎フレーム直接代入する。
//   指を離した瞬間だけ MOTION.spring を使う（近ければ高剛性でスナップ、
//   遠ければ低剛性でフワッと戻す）。ここに遅延を入れると「自分で折っている感」が消える。
// ============================================================
'use strict';

const FOLD = (function () {
  const G = OGL;

  // ---------- ボーンのワールド行列（剛体折り紙＝1頂点1ボーン、ウェイト無し） ----------
  // work.mesh.boneParent … 各ボーンの親index（ルートは-1）
  // work.mesh.hinge[i]   … ボーンiと親をつなぐヒンジ（フラット状態のローカル座標で定義）
  //                         { origin:[x,y,z], axis:[x,y,z] }（ルートはnull）
  // angles[i]            … いま適用したいボーンiの回転角（ラジアン）
  function computeBoneMatrices(work, angles) {
    const n = work.mesh.boneParent.length;
    const out = new Array(n);
    const order = boneOrder(work); // 親が先に来る順
    for (const i of order) {
      const parent = work.mesh.boneParent[i];
      const Mp = parent === -1 ? G.mat4Identity() : out[parent];
      const hinge = work.mesh.hinge[i];
      if (!hinge) { out[i] = Mp; continue; }
      // ★平行移動ヒンジ（2026-09-01追加）。{ slide:[x,y,z] } を持つヒンジは
      //   回転ではなく「その向きへ angles[i] だけ平行移動」を表す（angles[i]の単位はcm）。
      //   合同な図形をスライドさせて重ねる問題（折ったり重ねたり No.4・No.5）用。
      //   回転ヒンジには一切影響しない（slideを持つボーンだけ別扱い）。
      if (hinge.slide) {
        const dirW = G.vecNorm(G.vecApplyDir(Mp, hinge.slide));
        const tr = G.mat4Translate(G.vecScale(dirW, angles[i] || 0));
        out[i] = G.mat4Multiply(tr, Mp);
        continue;
      }
      const originW = G.vecApply(Mp, hinge.origin);
      const axisW = G.vecNorm(G.vecApplyDir(Mp, hinge.axis));
      const rot = G.mat4HingeRotate(originW, axisW, angles[i] || 0);
      out[i] = G.mat4Multiply(rot, Mp);
    }
    return out;
  }
  // 各ボーンの階層の深さ（祖先の数）。値がゼロ厚みの平面同士が完全に重なったときの
  // Zファイティング対策（renderer.jsで法線方向に深さ×微小量だけオフセットする）に使う。
  function computeLayerDepths(work) {
    const parent = work.mesh.boneParent;
    const depth = new Array(parent.length).fill(0);
    for (const i of boneOrder(work)) {
      depth[i] = parent[i] === -1 ? 0 : depth[parent[i]] + 1;
    }
    return depth;
  }

  function boneOrder(work) {
    // 単純な位相順（親index < 子indexで作品データを作る前提だが、念のため反復で確定させる）
    const parent = work.mesh.boneParent;
    const n = parent.length;
    const done = new Array(n).fill(false);
    const order = [];
    let guard = 0;
    while (order.length < n && guard++ < n * n + 5) {
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        if (parent[i] === -1 || done[parent[i]]) { done[i] = true; order.push(i); }
      }
    }
    return order;
  }

  // ---------- ステップ状態機械 ----------
  // state.mode: 'idle' | 'dragging' | 'settling' | 'springback'
  // state.liveAngle[boneId]     … 描画にそのまま使う「いまの角度」
  // state.committedAngle[boneId]… 確定して以後動かさない角度
  // state.springSt[boneId]      … MOTION.spring用 {v,d}
  // state.freeMode              … true＝手順を覚えた後の「自由に再現する」モード
  //   (stepIndexの一本道を外し、まだ済んでいないどのステップの折り筋でもつまめる。
  //   state.doneStepsに済んだステップのindexを集める。実物の紙と同じで、
  //   早すぎる折りを試しても止めない＝ただ変な形になるだけ)
  function createState(work, opts) {
    const n = work.mesh.boneParent.length;
    return {
      work,
      mode: 'idle',
      stepIndex: 0,
      freeMode: !!(opts && opts.freeMode),
      doneSteps: new Set(),
      // 灘中対策コーナー：「解説を見る」を押すまでは補助点(P・Q等)や補助線を隠す
      // （本人指示2026-08-30。先に答えの構成が見えてしまわないように）。
      explanationRevealed: false,
      liveAngle: new Array(n).fill(0),
      committedAngle: new Array(n).fill(0),
      springSt: Array.from({ length: n }, () => ({ v: 0, d: 0 })),
      grab: null, // {boneId, hingeOrigin, hingeAxis, v0, angle0, step, stepIndex}
    };
  }

  function activeStep(state) {
    return state.work.steps[state.stepIndex] || null;
  }

  // 「いま何がつまめるか」。通常モードは今のstepIndexの1つだけ、
  // 自由モードはまだdoneStepsに入っていない全ステップ。
  // renderer.jsのヒットテスト・ラベル表示が両モード共通でこれを使う。
  function pendingSteps(state) {
    if (!state.freeMode) {
      const step = activeStep(state);
      return step ? [{ step, index: state.stepIndex }] : [];
    }
    const out = [];
    state.work.steps.forEach((step, index) => {
      if (!state.doneSteps.has(index)) out.push({ step, index });
    });
    return out;
  }

  // ある折り筋が複数レイヤーにまたがって層ごとにボーンを分けた場合
  // （例：tsuru.jsの花びら折りで、1枚のフラップを新しい折り筋でさらに
  //   2ボーンに割った場合）、handle.linkedBoneIdsに従い同じ角度を複製する。
  //   ★片方だけ更新するとレイヤーがズレて見た目が破綻するため、
  //   liveAngleを書き換える箇所には必ずこれを呼ぶこと。
  //   linkedBoneIdsの要素は数値(従来通り・主ボーンと同じ角度をコピー)か
  //   {boneId,target}(主ボーンがcommittedAngle→step.targetAngleへ進む割合ぶんだけ、
  //   このボーンはcommittedAngle→targetへ進む＝比例だが別角度。tsuru.jsの
  //   「羽を開く」で、backboneの開き角と首の補正ひねり角が別値になるため追加)。
  function syncLinkedAngle(state, boneId, angle, step) {
    const linked = step && step.handle.boneId === boneId && step.handle.linkedBoneIds;
    if (!linked) return;
    const start = state.committedAngle[boneId] || 0;
    const span = step.targetAngle - start;
    const t = Math.abs(span) < 1e-9 ? 0 : (angle - start) / span;
    for (const lb of linked) {
      if (typeof lb === 'number') { state.liveAngle[lb] = angle; continue; }
      const lbStart = state.committedAngle[lb.boneId] || 0;
      state.liveAngle[lb.boneId] = lbStart + t * (lb.target - lbStart);
    }
  }

  function currentBoneMatrices(state) {
    return computeBoneMatrices(state.work, state.liveAngle);
  }

  // ヒンジ平面（原点=hingeOrigin, 法線=hingeAxis）とレイの交点。無ければnull。
  function rayHingePlane(ray, hingeOrigin, hingeAxis) {
    const denom = G.vecDot(ray.dir, hingeAxis);
    if (Math.abs(denom) < 1e-6) return null;
    const t = G.vecDot(G.vecSub(hingeOrigin, ray.origin), hingeAxis) / denom;
    if (t < 0) return null;
    return G.vecAdd(ray.origin, G.vecScale(ray.dir, t));
  }

  // つまみ点(handle)のワールド座標。ドラッグ開始前のヒットテストに使う。
  function handleWorldPos(state, step) {
    const mats = currentBoneMatrices(state);
    return G.vecApply(mats[step.handle.boneId], step.handle.local);
  }

  // ---------- ドラッグ開始 ----------
  // stepIndexを省略すると通常モードの「今のステップ」を掴む(従来通り)。
  // 自由モードでは、renderer.js側のヒットテストでどのステップの折り筋に
  // いちばん近いかを決めて、そのindexを明示的に渡す。
  function beginDrag(state, ray, stepIndex) {
    const idx = stepIndex === undefined ? state.stepIndex : stepIndex;
    const step = state.work.steps[idx];
    if (!step) return false;
    const boneId = step.handle.boneId;
    const parent = state.work.mesh.boneParent[boneId];
    const mats = currentBoneMatrices(state);
    const Mp = parent === -1 ? G.mat4Identity() : mats[parent];
    const hinge = state.work.mesh.hinge[boneId];
    // ★平行移動ヒンジ：回転の代わりに「紙の面の上で、決まった向きへどれだけ動かしたか」を
    //   持つ。指の位置は紙の面（親の面＝法線はローカルのY軸）に投影して測る。
    //   回転と同じく「前フレームからの増分の積算」にする（絶対位置だと指の初期ずれが
    //   そのまま飛びになるため）。
    if (hinge.slide) {
      const normalW = G.vecNorm(G.vecApplyDir(Mp, [0, 1, 0]));
      const dirW = G.vecNorm(G.vecApplyDir(Mp, hinge.slide));
      const handleW0 = G.vecApply(mats[boneId], step.handle.local);
      const p0s = rayHingePlane(ray, handleW0, normalW);
      if (!p0s) return false;
      state.mode = 'dragging';
      state.grab = {
        boneId, slideDir: dirW, planeP: handleW0, planeN: normalW, lastP: p0s,
        angle: state.liveAngle[boneId], step, stepIndex: idx,
      };
      return true;
    }
    const originW = G.vecApply(Mp, hinge.origin);
    const axisW = G.vecNorm(G.vecApplyDir(Mp, hinge.axis));
    // つまみ点(handle)は一般にヒンジの端点(originW)を通る垂直面の上には無い
    // （例：対角線ヒンジの遠い角をつまむ場合）。そのままoriginWを平面の原点にすると
    // レイとの交点がhandleの実際の回転円から外れ、角度がめちゃくちゃになる
    // （2026-08-29 実測で発覚：v0がhandle-originWと大きくずれていた）。
    // 正しくは「handleからヒンジ軸へ下ろした垂線の足」を回転の中心にする。
    const handleW = G.vecApply(mats[boneId], step.handle.local);
    const toHandle = G.vecSub(handleW, originW);
    const foot = G.vecAdd(originW, G.vecScale(axisW, G.vecDot(toHandle, axisW)));
    const p0 = rayHingePlane(ray, foot, axisW);
    if (!p0) return false;
    const v0 = G.vecSub(p0, foot);
    if (G.vecLen(v0) < 1e-4) return false;
    state.mode = 'dragging';
    // ★角度は「絶対角度」ではなく「前フレームからの増分を積算」で持つ。
    //   atan2ベースの絶対角度計算だと±πをまたぐ瞬間に符号が反転し、
    //   谷折り(target=π)の終盤でいきなり-0.35へ飛ぶ不具合が実測で発覚した
    //   （2026-08-29）。増分方式ならπをまたいでも連続に動く。
    state.grab = { boneId, hingeOrigin: foot, hingeAxis: axisW, lastV: v0, angle: state.liveAngle[boneId], step, stepIndex: idx };
    return true;
  }

  // ---------- ドラッグ更新（1:1、springを通さない） ----------
  function updateDrag(state, ray) {
    if (state.mode !== 'dragging' || !state.grab) return;
    const g = state.grab;
    // ★平行移動ヒンジ：指を紙の面へ投影し、決まった向きへの成分だけを足していく
    if (g.slideDir) {
      const ps = rayHingePlane(ray, g.planeP, g.planeN);
      if (!ps) return;
      g.angle += G.vecDot(G.vecSub(ps, g.lastP), g.slideDir);
      g.lastP = ps;
      const target = g.step.targetAngle;
      const slack = Math.abs(target) * 0.15;
      const clampedS = Math.max(Math.min(0, target) - slack, Math.min(Math.max(0, target), g.angle));
      state.liveAngle[g.boneId] = clampedS;
      syncLinkedAngle(state, g.boneId, clampedS, g.step);
      return;
    }
    const p = rayHingePlane(ray, g.hingeOrigin, g.hingeAxis);
    if (!p) return;
    const v = G.vecSub(p, g.hingeOrigin);
    if (G.vecLen(v) < 1e-4) return;
    const cross = G.vecCross(g.lastV, v);
    const dAngle = Math.atan2(G.vecDot(cross, g.hingeAxis), G.vecDot(g.lastV, v));
    g.angle += dAngle;
    g.lastV = v;
    const step = g.step;
    // ★紙は物理的に180°(targetAngle)より先には折れない。以前はここに+0.35の
    //   「行き過ぎても離せばスナップする」遊びを持たせていたが、行き過ぎた
    //   角度のままdrawされる一瞬(離すまでの間)に他レイヤーを突き抜けて見える
    //   原因になる（本人指摘・2026-08-30、精密58ステップ版で顕在化）。
    //   targetAngle側は超えさせず、開始側(0)だけ少し戻れる余地を残す
    //   （こちらは折り始め前の状態に近いだけで、貫通は起きない）。
    const lo = Math.min(0, step.targetAngle) - 0.35;
    const hi = Math.max(0, step.targetAngle);
    const clamped = Math.max(lo, Math.min(hi, g.angle));
    state.liveAngle[g.boneId] = clamped;
    syncLinkedAngle(state, g.boneId, clamped, step);
  }

  // ---------- ドラッグ終了（ここで初めてspring） ----------
  function endDrag(state) {
    if (state.mode !== 'dragging' || !state.grab) return;
    const step = state.grab.step;
    const boneId = state.grab.boneId;
    const diff = Math.abs(state.liveAngle[boneId] - step.targetAngle);
    state.springSt[boneId] = { v: state.liveAngle[boneId], d: 0 };
    state.settleStep = step;
    state.settleStepIndex = state.grab.stepIndex;
    // 平行移動ヒンジのしきい値は角度(rad)ではなく距離(cm)。step.snapDistで指定でき、
    // 省略時は動かす距離の12%（最低0.4cm）を「そこまで来たら吸いつく」範囲にする
    const hg = state.work.mesh.hinge[boneId];
    const snapThr = (hg && hg.slide)
      ? (step.snapDist !== undefined ? step.snapDist : Math.max(0.4, Math.abs(step.targetAngle) * 0.12))
      : (step.snapDeg || 0.35);
    if (diff < snapThr) {
      state.mode = 'settling';
      state.settleTarget = step.targetAngle;
      state.settleBone = boneId;
    } else {
      state.mode = 'springback';
      state.settleTarget = step.returnAngle !== undefined ? step.returnAngle : state.committedAngle[boneId];
      state.settleBone = boneId;
    }
    state.grab = null;
  }

  // ---------- 毎フレーム更新（settling/springback中のspring）----------
  function tick(state, dt) {
    if (state.mode !== 'settling' && state.mode !== 'springback') return;
    const boneId = state.settleBone;
    const step = state.settleStep;
    const k = state.mode === 'settling' ? 260 : 70;
    const damp = state.mode === 'settling' ? 18 : 12;
    MOTION.spring(state.springSt[boneId], state.settleTarget, dt, k, damp);
    state.liveAngle[boneId] = state.springSt[boneId].v;
    syncLinkedAngle(state, boneId, state.liveAngle[boneId], step);
    const close = Math.abs(state.springSt[boneId].v - state.settleTarget) < 0.01
      && Math.abs(state.springSt[boneId].d) < 0.02;
    if (close) {
      state.liveAngle[boneId] = state.settleTarget;
      syncLinkedAngle(state, boneId, state.settleTarget, step);
      if (state.mode === 'settling') {
        state.committedAngle[boneId] = state.settleTarget;
        // ★linkedBoneIdsぶんのcommittedAngleもここで確定させる。
        //   これを忘れると、そのボーンが別ステップで再登場したときに
        //   進捗の起点(committedAngle)が0のまま＝古いバグ(2026-08-30に発見・修正)。
        if (step.handle.linkedBoneIds) {
          for (const lb of step.handle.linkedBoneIds) {
            if (typeof lb === 'number') state.committedAngle[lb] = state.settleTarget;
            else state.committedAngle[lb.boneId] = lb.target;
          }
        }
        if (state.freeMode) state.doneSteps.add(state.settleStepIndex);
        else state.stepIndex = Math.min(state.stepIndex + 1, state.work.steps.length);
      }
      state.mode = 'idle';
    }
  }

  function isFinished(state) {
    if (state.freeMode) return state.doneSteps.size >= state.work.steps.length;
    return state.stepIndex >= state.work.steps.length;
  }

  // ---------- 折り手順の巻き戻し（灘中対策コーナー・伝承折り紙共通） ----------
  // 直前に確定したステップを「折る前」へなめらかに戻す。どの時点でどの性質
  // （対称性・直角など）が生まれたかをさかのぼって確認できるようにする機能。
  // ★自由モードには「直前の1つ」という概念が無いので今のところ非対応。
  function stepBack(state) {
    if (state.freeMode) return false;
    if (state.mode === 'dragging') return false; // ドラッグ中は操作しない
    if (state.stepIndex <= 0) return false;
    const prevIndex = state.stepIndex - 1;
    const step = state.work.steps[prevIndex];
    const boneId = step.handle.boneId;
    state.springSt[boneId] = { v: state.liveAngle[boneId], d: 0 };
    state.mode = 'springback';
    state.settleTarget = 0;
    state.settleBone = boneId;
    state.settleStep = step;
    state.committedAngle[boneId] = 0;
    state.stepIndex = prevIndex;
    return true;
  }

  return {
    computeBoneMatrices, currentBoneMatrices, handleWorldPos, computeLayerDepths,
    createState, activeStep, pendingSteps, beginDrag, updateDrag, endDrag, tick, isFinished, stepBack,
  };
})();

if (typeof window !== 'undefined') window.FOLD = FOLD;
