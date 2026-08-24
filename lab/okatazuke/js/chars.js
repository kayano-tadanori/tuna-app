// ============================================================
// chars.js — あそぶ人（7人）と ペット（3羽）の きりかえ
//   モデルは tools/import_char_glb.py / import_pet_glb.py が作る
//   js/char_*.js と js/pet_*.js。★1人ぶんで 500〜700KB あるので、
//   えらばれたものだけ あとから読む（最初に全部読むと 3MB になる）。
// ============================================================
'use strict';

const OK_CHARS = [
  { id: 'okan2', name: 'オカーン', tag: 'おかん' },
  { id: 'otton', name: 'オットン', tag: 'おとん' },
  { id: 'taitsu', name: 'タイツマン', tag: 'ヒーロー' },
  { id: 'g3', name: '小3男子', tag: 'おとうと' },
  { id: 'g3b', name: '小3男子②', tag: 'おとうと' },
  { id: 'g5', name: '小5男子', tag: 'おにいちゃん' },
  { id: 'g5b', name: '小5男子②', tag: 'おにいちゃん' },
];
const OK_PETS = [
  { id: 'none', name: 'なし', tag: '' },
  { id: 'chicchi', name: 'チッチ', tag: '小鳥' },
  { id: 'jade', name: 'ジェイド', tag: 'あいぼう' },
  { id: 'mei', name: 'メイ', tag: 'なかよし' },
];

const OK_CHAR_KEY = 'okatazukeChar';
const OK_PET_KEY = 'okatazukePet';

function okQuery(k) {
  try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; }
}
function okPick(list, key, qk, dflt) {
  const q = okQuery(qk);
  if (q && list.some(c => c.id === q)) return q;
  try {
    const v = localStorage.getItem(key);
    if (v && list.some(c => c.id === v)) return v;
  } catch (e) {}
  return dflt;
}
function okCharId() { return okPick(OK_CHARS, OK_CHAR_KEY, 'char', 'okan2'); }
function okPetId() { return okPick(OK_PETS, OK_PET_KEY, 'pet', 'chicchi'); }
function okSetCharId(id) { try { localStorage.setItem(OK_CHAR_KEY, id); } catch (e) {} }
function okSetPetId(id) { try { localStorage.setItem(OK_PET_KEY, id); } catch (e) {} }

// ---- 追加のスクリプトを あとから読む ------------------------------------
const OK_LOADED = {};
function okLoadScript(src, done) {
  if (OK_LOADED[src] === 'ok') return done(true);
  if (OK_LOADED[src]) { OK_LOADED[src].push(done); return; }
  OK_LOADED[src] = [done];
  const s = document.createElement('script');
  s.src = src;
  s.onload = () => { const w = OK_LOADED[src]; OK_LOADED[src] = 'ok'; w.forEach(f => f(true)); };
  s.onerror = () => { const w = OK_LOADED[src]; OK_LOADED[src] = null; w.forEach(f => f(false)); };
  document.head.appendChild(s);
}

// ---- ペット：骨を動かさないので、そのまま渡す ---------------------------
//   ★キャラと違って bind の逆行列をかけない。
//     ペットの骨0番には「頭のてっぺんの行列（OK_BONE.CHI）」を そのまま入れる。
function buildPetFromModel(M) {
  if (!M) return null;
  return {
    pos: okanB64(M.pos, Float32Array),
    nrm: okanB64(M.nrm, Float32Array),
    onrm: okanB64(M.onrm, Float32Array),
    uv: okanB64(M.uv, Float32Array),
    col: okanB64(M.col, Float32Array),
    param: okanB64(M.param, Float32Array),
    bone: okanB64(M.bone, Float32Array),
    bone2: M.bone2 ? okanB64(M.bone2, Float32Array)
      : new Float32Array(M.n * 4),
    idx: okanB64(M.idx, M.idx32 ? Uint32Array : Uint16Array),
    count: M.count,
  };
}

// ---- 絵ができるまで待ってから mesh を作る -------------------------------
function okMeshWithTex(R, geo, texName, done) {
  const img = new Image();
  const go = ok => done(R.makeMesh(geo, ok ? img : null));
  img.onload = () => go(true);
  img.onerror = () => go(false);
  img.src = texName;
}

// ---- あそぶ人を 差しかえる ----------------------------------------------
//   done(true) … できた ／ done(false) … 読めなかった（呼んだ側で手組みに落とす）
function okApplyChar(R, id, done) {
  okLoadScript('js/char_' + id + '.js', ok => {
    const M = ok && window.CHAR_MODELS && window.CHAR_MODELS[id];
    if (!M) return done(false);
    const geo = buildOkanFromModel(M);
    okMeshWithTex(R, geo, M.tex, mesh => {
      OKG.okan = mesh;
      OKG.rig = new OkanRig(M.dims);
      OKG.rig.scale = 1.42;      // マスに対して小さすぎたので大きくした（実測）
      OKG.rig.stride = 1.0;      // ★盤は 1マス＝1歩。ここを合わせないと 足がすべる
      OKG.charId = id;
      done(true);
    });
  });
}

// ---- ペットを 差しかえる（どっちを選んでも 頭にとまる）------------------
function okApplyPet(R, id, done) {
  OKG.petId = id;
  if (id === 'none') { OKG.pet = null; OKG.petRig = null; return done(true); }
  okLoadScript('js/pet_' + id + '.js', ok => {
    const M = ok && window.PET_MODELS && window.PET_MODELS[id];
    if (!M) { OKG.pet = null; OKG.petRig = null; return done(false); }
    const geo = buildPetFromModel(M);
    okMeshWithTex(R, geo, M.tex, mesh => {
      OKG.pet = mesh;
      OKG.petRig = new PetRig(M);
      done(true);
    });
  });
}

// ---- ペットを描く（頭のてっぺんの骨に そのまま乗せる）-------------------
function okDrawPet(R, rig, dt) {
  if (!OKG.pet || !rig || !OKG.petRig) return;
  // ★ペットの骨は「ペットの中の座標」で作ってある。
  //   頭のてっぺんの行列（OK_BONE.CHI）を かければ 頭に乗る。
  const base = rig.bones[OK_BONE.CHI];
  const local = OKG.petRig.update(dt === undefined ? 0.016 : dt, {
    walk: rig.walk, cheer: rig.cheer, push: rig.push, phase: rig.walkPhase,
  });
  const B = [];
  for (let i = 0; i < PET_NBONE; i++) B.push(M4.mul(base, local[i]));
  R.drawMesh(OKG.pet, B, { outlineWidth: 0.0030 });
}
