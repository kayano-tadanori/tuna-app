// ============================================================
// cloth.js — 紙の質点バネ物理エンジン(Position Based Dynamics)
//
//   2026-08-30 続き13：剛体ヒンジ(fold.js)だけだと、「まだ同期していない
//   隣接パネルとの継ぎ目」が裂けて見える問題を、頂点のブレンド(レンダリング上の
//   トリック)で誤魔化そうとしたが、本人の指摘「裂けようとする力が働いたら、
//   接続してる紙が曲がる仕組みがないと無理」で、本物の物理(質点バネ)が必要と
//   判明。紙を「伸びないバネで繋がった質点の集まり」としてシミュレーションし、
//   今アクティブに折っているヒンジだけ目標角度へ強く曲げ、それ以外の部分は
//   外から引っ張られたら素直にたわむようにする。
//
//   PBD(Müller et al. 2007の手法)を採用：力・加速度を積分するのではなく、
//   毎フレーム「予測位置へ動かす→制約(バネの自然長・曲げ角)を満たすよう
//   位置を直接補正する→補正後の位置と1フレーム前の位置の差분を速度とする」
//   という順序。力ベースの積分よりも数値的に安定していて発散しにくい
//   (ゲームエンジンの布シミュレーションで標準的に使われる手法)。
// ============================================================
'use strict';

const CLOTH = (function () {

  // work.mesh.verts(ローカル座標,重複あり=パネルごとに別頂点)から、
  // 「同じ元の折り紙の点」をキーに質点をマージして作る。
  //   points[i] = { x,y,z (ワールド), px,py,pz (前フレーム位置), invMass }
  //   vertToPoint[meshVertIndex] = points配列のindex
  function buildPoints(mesh) {
    // 質点はメッシュ頂点ごとに1つ(パネル間の継ぎ目はseam constraintで結ぶ。
    // マージすると「パネルごとに独立して動く」という剛体ヒンジの良さが消えるため、
    // あえてマージしない=各パネルの頂点はそれぞれ独立した質点)。
    const points = [];
    for (let i = 0; i < mesh.verts.length; i++) {
      const p = mesh.verts[i];
      points.push({ x: p[0], y: p[1], z: p[2], px: p[0], py: p[1], pz: p[2], invMass: 1 });
    }
    return points;
  }

  // 三角形の各辺から「伸びないバネ」制約を作る(自然長=フラット状態の長さ)。
  function buildEdgeConstraints(mesh) {
    const seen = new Set();
    const cons = [];
    for (const tri of mesh.tris) {
      const pairs = [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]];
      for (const [a, b] of pairs) {
        const k = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const pa = mesh.verts[a], pb = mesh.verts[b];
        const rest = Math.hypot(pa[0]-pb[0], pa[1]-pb[1], pa[2]-pb[2]);
        cons.push({ a, b, rest });
      }
    }
    return cons;
  }

  // 「継ぎ目(seam)」制約：異なるパネルに属する、フラット状態で同じ座標だった
  // 頂点同士を、強いバネで結ぶ(紙が裂けて大きく離れるのを防ぐ)。
  function buildSeamConstraints(mesh) {
    const byPos = new Map();
    for (let i = 0; i < mesh.verts.length; i++) {
      const p = mesh.verts[i];
      const k = `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
      if (!byPos.has(k)) byPos.set(k, []);
      byPos.get(k).push(i);
    }
    const cons = [];
    for (const ids of byPos.values()) {
      if (ids.length < 2) continue;
      for (let i = 1; i < ids.length; i++) cons.push({ a: ids[0], b: ids[i], rest: 0 });
    }
    return cons;
  }

  // パネルどうしの隣接関係(継ぎ目を共有するパネルのペア)。
  // ★本人指摘(2026-08-30)：「手順と関係ないヒンジは絶対に動いてはいけない」
  //   ——たわみは「今の手順で動かしているパネルの、直接の継ぎ目相手」だけに
  //   限定する必要がある(renderer.jsのphysBoneWeightsで使う)。
  function buildPanelAdjacency(mesh) {
    const adj = new Map();
    const byPos = new Map();
    for (let i = 0; i < mesh.verts.length; i++) {
      const p = mesh.verts[i];
      const k = `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
      if (!byPos.has(k)) byPos.set(k, []);
      byPos.get(k).push(i);
    }
    for (const ids of byPos.values()) {
      if (ids.length < 2) continue;
      for (const i of ids) {
        const pi = mesh.panel[i];
        for (const j of ids) {
          if (i === j) continue;
          const pj = mesh.panel[j];
          if (pi === pj) continue;
          if (!adj.has(pi)) adj.set(pi, new Set());
          adj.get(pi).add(pj);
        }
      }
    }
    return adj;
  }

  function createSim(work) {
    const mesh = work.mesh;
    const points = buildPoints(mesh);
    const edgeCons = buildEdgeConstraints(mesh);
    const seamCons = buildSeamConstraints(mesh);
    const panelAdjacency = buildPanelAdjacency(mesh);
    return { work, points, edgeCons, seamCons, panelAdjacency, velDamp: 0.98 };
  }

  // ★「曲がる仕組み」の核心：質点を、剛体ヒンジ計算(fold.jsのFK)が出す
  //   「目標位置」へ、そのボーンが今どれだけ確定/アクティブかに応じた強さで
  //   引き寄せる(attachment constraint)。強く引けば剛体そのもの、弱く引けば
  //   周りの辺・継ぎ目の制約に負けて自然にたわむ——これが「引っ張られたら
  //   曲がる」の実体（本人指摘・2026-08-30）。
  //   boneWeights: {boneId: 0..1} 1=完全固定(剛体目標へスナップしinvMass=0)、
  //   0=自由(引力なし、辺・継ぎ目の制約だけに従う)。
  //   ★確定済みパネルを「ソフトな引力」のままにしていると、矛盾する隣接部の
  //   力で少しずつ位置がずれてしまう(2026-08-30実測)。目標=1のときは直接
  //   スナップしてinvMassを0にし、以後の距離制約の反復で絶対に動かない
  //   「本当の固定点」にする——これで初めて「確定済みは動かず、まだ折って
  //   いない部分だけがその固定点に向かって自然にたわむ」が成立する。
  function applyAttachment(sim, boneMatrices, boneWeights) {
    const mesh = sim.work.mesh;
    for (let i = 0; i < mesh.verts.length; i++) {
      const panel = mesh.panel[i];
      const w = boneWeights[panel];
      const pt = sim.points[i];
      if (w >= 1) {
        const M = boneMatrices[panel];
        const p = mesh.verts[i];
        pt.x = M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12];
        pt.y = M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13];
        pt.z = M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14];
        pt.px = pt.x; pt.py = pt.y; pt.pz = pt.z;
        pt.invMass = 0;
      } else {
        pt.invMass = 1;
        if (w > 0) {
          const M = boneMatrices[panel];
          const p = mesh.verts[i];
          const tx = M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12];
          const ty = M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13];
          const tz = M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14];
          pt.x += (tx - pt.x) * w;
          pt.y += (ty - pt.y) * w;
          pt.z += (tz - pt.z) * w;
        }
      }
    }
  }

  function solveDistance(points, a, b, rest, stiffness) {
    const pa = points[a], pb = points[b];
    let dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
    const len = Math.hypot(dx, dy, dz) || 1e-9;
    const diff = (len - rest) / len * stiffness * 0.5;
    dx *= diff; dy *= diff; dz *= diff;
    const wa = pa.invMass / (pa.invMass + pb.invMass || 1e-9);
    const wb = pb.invMass / (pa.invMass + pb.invMass || 1e-9);
    pa.x -= dx * wa * 2; pa.y -= dy * wa * 2; pa.z -= dz * wa * 2;
    pb.x += dx * wb * 2; pb.y += dy * wb * 2; pb.z += dz * wb * 2;
  }

  // 1ステップ進める。
  // ★本人指摘(2026-08-30)：実物の紙は「裂ける」よりずっと「たわむ」方が簡単
  //   (引張強度は高いが曲げ剛性は低い)。継ぎ目(seam=裂け防止)を、辺の伸び抵抗
  //   (edge)より明確に優先して解く必要がある——同じ反復回数で並べただけでは、
  //   矛盾する力がかかったとき継ぎ目側が押し負けて開いてしまう(実測で確認)。
  //   継ぎ目だけ複数回(SEAM_PASSES)重ねて解くことで「たわむ力 << 裂ける力」
  //   というバランスを実現する。
  const SEAM_PASSES = 4;
  // ★2026-08-30 続き14：「膨らませ」をパネルごとの符号(inflateSign)を手動で
  //   割り当てる方式ではなく、本物の内部圧力として実装する(本人提案)。
  //   「中心から外向きに押す」だけで、閉じた袋構造(お腹の下)は辺の長さを
  //   保ちながら自然に丸く膨らみ、開いた羽は単に外へ押されるだけになる——
  //   区別は物理的に自動で生まれるはずで、パネルごとの符号を人力で
  //   分類する必要がない。
  function applyPressure(sim, center, strength) {
    if (!strength) return;
    for (const p of sim.points) {
      if (p.invMass === 0) continue;
      const dx = p.x - center[0], dy = p.y - center[1], dz = p.z - center[2];
      const len = Math.hypot(dx, dy, dz) || 1e-9;
      p.x += (dx / len) * strength;
      p.y += (dy / len) * strength;
      p.z += (dz / len) * strength;
    }
  }
  // ★「なかに見えないボールを入れる感じ」（本人 2026-09-03）。
  //   中心から一様に押す圧力(applyPressure)だと、袋になっていない所——
  //   かぶとのツノ・はちまき、コップの折り込んだ角——まで押し出されて
  //   ばらけてしまう（本人「ふくろ構造以外の部分がばらけないようにしないと」）。
  //   球なら**球に触れた紙だけ**が外へよけるので、
  //   「かぶとのかたちのまま、頭の入る空間だけができる」。
  function applyBall(sim, center, radius) {
    if (!(radius > 0)) return;
    for (const p of sim.points) {
      if (p.invMass === 0) continue;
      const dx = p.x - center[0], dy = p.y - center[1], dz = p.z - center[2];
      const len = Math.hypot(dx, dy, dz) || 1e-9;
      if (len >= radius) continue;          // 球の外にいる紙はさわらない
      const k = radius / len;
      p.x = center[0] + dx * k;
      p.y = center[1] + dy * k;
      p.z = center[2] + dz * k;
    }
  }

  // ★折り重なって貼りついている紙どうしを結ぶ。
  //   実物の紙は、折り重なった所は一体になって動く。これが無いと、袋の壁が
  //   ふくらんだときに、その上に乗っている紙（ツノなど）だけが取り残されて
  //   ばらける（本人 2026-09-03）。
  //   ⚠**折り目で直接つながっている2枚は結ばない**——そこが開いて袋になる所。
  function buildStickConstraints(sim, boneMatrices, tol) {
    const mesh = sim.work.mesh;
    const parent = mesh.boneParent || [];
    const w = [];
    for (let i = 0; i < mesh.verts.length; i++) {
      const M = boneMatrices[mesh.panel[i]], p = mesh.verts[i];
      w.push([M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],
              M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],
              M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14]]);
    }
    const cons = [];
    for (let i = 0; i < w.length; i++) {
      for (let j = i + 1; j < w.length; j++) {
        const pa = mesh.panel[i], pb = mesh.panel[j];
        if (pa === pb) continue;
        if (parent[pa] === pb || parent[pb] === pa) continue;   // 折り目＝開いてよい
        const d = Math.hypot(w[i][0]-w[j][0], w[i][1]-w[j][1], w[i][2]-w[j][2]);
        if (d > tol) continue;
        cons.push({ a: i, b: j, rest: d });
      }
    }
    return cons;
  }

  // ★「かぶとのかたちのまま、かぶれる形にする」（本人 2026-09-03）。
  //   球にさわっていない紙まで自由にすると、ツノやはちまきが崩れて山になる。
  //   **球から遠い紙は、折り上がりの形にピン留めして一切動かさない。**
  //   動くのは球にさわっている（＝頭が当たる）紙だけ。
  function pinOutsideBall(sim, boneMatrices, center, radius, hold) {
    // hold は数ひとつでも、紙切れごとの配列でもよい（枚数でかたさを変えるため）
    const holdOf = Array.isArray(hold) ? ((pnl) => hold[pnl] !== undefined ? hold[pnl] : 1)
                                       : ((_) => (hold === undefined ? 1 : hold));
    const mesh = sim.work.mesh;
    const r2 = (radius * 1.15) * (radius * 1.15);
    for (let i = 0; i < mesh.verts.length; i++) {
      const M = boneMatrices[mesh.panel[i]], p = mesh.verts[i];
      const tx = M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12];
      const ty = M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13];
      const tz = M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14];
      const dx = tx-center[0], dy = ty-center[1], dz = tz-center[2];
      if (dx*dx + dy*dy + dz*dz <= r2) continue;   // 球の近く＝動いてよい
      const pt = sim.points[i];
      const h = holdOf(mesh.panel[i]);
      if (h >= 1) {                 // かちっと固定（板のように硬い）
        pt.x = tx; pt.y = ty; pt.z = tz;
        pt.px = tx; pt.py = ty; pt.pz = tz;
        pt.invMass = 0;
      } else {                          // ★紙らしく：形を覚えているが、やわらかい
        pt.x += (tx - pt.x) * h;
        pt.y += (ty - pt.y) * h;
        pt.z += (tz - pt.z) * h;
      }
    }
  }

  function step(sim, dt, iterations, pressure) {
    const pts = sim.points;
    for (const p of pts) {
      const vx = (p.x - p.px) * sim.velDamp, vy = (p.y - p.py) * sim.velDamp, vz = (p.z - p.pz) * sim.velDamp;
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.x += vx; p.y += vy; p.z += vz;
    }
    if (pressure && pressure.strength) applyPressure(sim, pressure.center, pressure.strength);
    if (pressure && pressure.ball) applyBall(sim, pressure.ball.center, pressure.ball.radius);
    for (let it = 0; it < iterations; it++) {
      for (const c of sim.edgeCons) solveDistance(pts, c.a, c.b, c.rest, 0.9);
      for (let s = 0; s < SEAM_PASSES; s++) {
        for (const c of sim.seamCons) solveDistance(pts, c.a, c.b, c.rest, 1.0);
      }
      // 貼りついている紙は一緒に動く（ばらけない）
      if (sim.stickCons) {
        for (const c of sim.stickCons) solveDistance(pts, c.a, c.b, c.rest, 1.0);
      }
    }
  }

  return { createSim, buildPoints, buildEdgeConstraints, buildSeamConstraints, pinOutsideBall,
           buildStickConstraints, applyBall, applyAttachment, step, solveDistance };
})();

if (typeof window !== 'undefined') window.CLOTH = CLOTH;
