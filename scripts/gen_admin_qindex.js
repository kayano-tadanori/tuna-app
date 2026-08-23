// ============================================================
// 管理ツール用の軽量索引 oton-admin/qindex.js を作る
//   目的：管理ツールで「この子は算数の小4のどの単元をよく解いているか」を出す。
//        クラウドに入っているのは progress（問題ID→正解数・のべ回数）だけで、
//        学年も単元も入っていないため、IDから引ける表をここで作る。
//   使い方：
//     node scripts/gen_admin_qindex.js          … 件数だけ表示（書き込まない）
//     node scripts/gen_admin_qindex.js --write  … oton-admin/qindex.js に書き出す
//   ★問題を足したら、ここも流し直すこと（新しいIDは索引に無いと「不明」に落ちる）。
//   ★出力は .json ではなく .js（window.OTON_QINDEX = {...}）。
//     PC版の管理ツールは file:// で直接ひらくので fetch が使えず、
//     <script src> でしか読めないため。
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// ── 教科・カテゴリ → データファイル（本体 app.js / js/sansu.js と同じ対応）──
const CATS = {
  kokugo: {
    kotowaza: ['kotowaza.json', 'ことわざ'],
    kanyoku: ['kanyoku.json', '慣用句'],
    yojijukugo: ['yojijukugo.json', '四字熟語'],
    gairaigo: ['gairaigo.json', '外来語'],
    kanji_kaki: ['kanji_kaki.json', '漢字の書き取り'],
    kanji_yomi: ['kanji_yomi.json', '漢字の読み'],
    kokugo_keigo: ['kokugo_keigo.json', '敬語・文法'],
    kokugo_goi: ['kokugo_goi.json', '語い'],
    kokugo_bushu: ['kokugo_bushu.json', '部首・画数'],
    kokugo_bungaku: ['kokugo_bungaku.json', '文学史・季語'],
    kokugo_bun: ['kokugo_bun.json', '文のしくみ'],
    kokugo_wago: ['kokugo_wago.json', '和語'],
    kokugo_sairei5: ['kokugo_sairei5.json', '最レ国語（文法）'],
    tantei: ['kokugo_tantei.json', 'こころの探偵'],
    youyaku: ['kokugo_youyaku.json', '要約記者'],
  },
  sansu: {
    bakuhatsu: ['sansu_bakuhatsu.json', 'バクハツ'],
    keisan: ['sansu_keisan.json', '計算'],
    bun: ['sansu_bun.json', '文章題'],
    zu: ['sansu_zu.json', '平面図形'],
    kisoku: ['sansu_kisoku.json', '規則性'],
    tokusan: ['sansu_tokusan.json', '特殊算'],
    baai: ['sansu_baai.json', '場合の数'],
    kazu: ['sansu_kazu.json', '数の性質'],
    wariai: ['sansu_wariai.json', '割合と比'],
    hayasa: ['sansu_hayasa.json', '速さ'],
    rittai: ['sansu_rittai.json', '立体図形'],
  },
  rika: {
    shokubutsu: ['rika_shokubutsu.json', '植物'],
    doubutsu: ['rika_doubutsu.json', '動物'],
    jintai: ['rika_jintai.json', '人体'],
    sora: ['rika_sora.json', '天体'],
    tenki: ['rika_tenki.json', '天気'],
    daichi: ['rika_daichi.json', '大地の変化'],
    mono: ['rika_mono.json', 'もののせいしつ'],
    kitai: ['rika_kitai.json', '気体'],
    suiyoueki: ['rika_suiyoueki.json', '水よう液'],
    denki: ['rika_denki.json', '電気と磁石'],
    chikara: ['rika_chikara.json', '力のつり合い'],
    hikari_oto: ['rika_hikarioto.json', '光と音'],
  },
  shakai: {
    kokudo: ['shakai_kokudo.json', '国土と自然'],
    sangyo: ['shakai_sangyo.json', '産業とくらし'],
    rekishi: ['shakai_rekishi.json', '日本の歴史'],
    komin: ['shakai_komin.json', '政治と国際'],
  },
};
const SUBJECT_LABELS = { kokugo: '国語', sansu: '算数', rika: '理科', shakai: '社会' };

// 連鎖・ガチ・読みものなど、カテゴリを要素側の category に持つファイル。
// 教科はファイル名の頭から決める。
const EXTRA_FILES = [
  ['sansu', 'sansu_chain.json'], ['sansu', 'sansu_gachi.json'], ['sansu', 'sansu_toranomaki.json'],
  ['rika', 'rika_chain.json'], ['rika', 'rika_gachi.json'], ['rika', 'rika_science.json'],
  ['shakai', 'shakai_chain.json'], ['shakai', 'shakai_nippon.json'],
  ['kokugo', 'kokugo_chain.json'],
];
// じゅくナビの大問（設定＋設問の束）。中身は grades→コース→回→[大問] の入れ子。
// ★hama_kokugo.json はここに入れない。じゅくナビ国語は大問（steps）ではなく1問ずつなので、
//   walkDaimon の「steps を持つものだけ」という条件に落ちて1件も索引に載らなかった
//   （2026-08-23 発覚。1,022問まるごと「いまのデータに無い問題」になっていた）。下の④で読む。
const DAIMON_FILES = ['hama_daimon.json'];

// ── ここから組み立て ──
const units = [];
const unitIdx = new Map();
function unitNo(name) {
  const n = String(name || '').trim() || 'その他';
  if (!unitIdx.has(n)) { unitIdx.set(n, units.length); units.push(n); }
  return unitIdx.get(n);
}

const q = {};          // "教科_カテゴリ" → { 問題ID: "学年,単元番号" }
let count = 0, skipped = 0;
function put(subject, cat, id, grade, unit) {
  if (!id) { skipped++; return; }
  const bucket = `${subject}_${cat}`;
  (q[bucket] = q[bucket] || {})[id] = `${Number(grade) || 0},${unitNo(unit)}`;
  count++;
}
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch (e) { console.log('!! 読めません:', file, e.message); return null; }
}

// 1件の問題（または連鎖・大問）を積む。steps があれば本体の expandChain と同じ
// `${id}_s${i+1}` に展開する（記録キーがその形で残るため）。
function putItem(subject, cat, item, fallbackUnit, fallbackGrade) {
  const unit = item.unit || fallbackUnit;
  const grade = item.grade !== undefined ? item.grade : fallbackGrade;
  if (Array.isArray(item.steps) && item.steps.length) {
    item.steps.forEach((s, i) => put(subject, cat, `${item.id}_s${i + 1}`, grade, unit));
  } else {
    put(subject, cat, item.id, grade, unit);
  }
}

// ① 通常のカテゴリ別ファイル
for (const [subject, cats] of Object.entries(CATS)) {
  for (const [cat, [file, label]] of Object.entries(cats)) {
    const list = readJSON(file);
    if (!Array.isArray(list)) continue;
    list.forEach(item => item && item.id && putItem(subject, cat, item, label, 0));
  }
}

// ② 連鎖・ガチ・読みもの（category は要素が持つ）
for (const [subject, file] of EXTRA_FILES) {
  const list = readJSON(file);
  if (!Array.isArray(list)) continue;
  list.forEach(item => {
    if (!item || !item.id) return;
    const cat = item.category || 'その他';
    const label = ((CATS[subject] || {})[cat] || [null, cat])[1];
    putItem(subject, cat, item, label, 0);
  });
}

// ③ じゅくナビの大問。category からどの教科のものかを引く
//    （hama_kokugo は国語、hama_daimon は算数・理科がまざる）
const CAT_OWNER = {};
for (const [subject, cats] of Object.entries(CATS)) {
  for (const cat of Object.keys(cats)) if (!CAT_OWNER[cat]) CAT_OWNER[cat] = subject;
}
function walkDaimon(node, subjectHint) {
  if (Array.isArray(node)) {
    node.forEach(s => {
      if (!s || !s.id || !Array.isArray(s.steps)) return;
      const cat = s.category || 'その他';
      const subject = CAT_OWNER[cat] || subjectHint;
      const label = ((CATS[subject] || {})[cat] || [null, cat])[1];
      putItem(subject, cat, s, s.unit || label, s.grade);
    });
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_')) continue;
      walkDaimon(v, k === 'kokugo' ? 'kokugo' : subjectHint);
    }
  }
}
for (const file of DAIMON_FILES) {
  const j = readJSON(file);
  if (j) walkDaimon(j.grades || j, 'sansu');
}

// ④ じゅくナビ国語（hama_kokugo.json）。形は grades[学年][コース].lessons[回] = { title, kanji:[…] }で、
//    1問ずつ並んでいる（steps を持たない）ので walkDaimon では拾えない。ここで直接読む。
//    ・バケツは kokugo_hama_kokugo。js/gamify.js の ID_PREFIX_MAP（hk → kokugo:hama_kokugo）と同じ名前にする
//    ・単元は回ごとに刻まず、ほかの国語カテゴリ（ことわざ・外来語…）と同じ「学年 × 1行」の粗さにそろえる。
//      回ごとにすると97行に散って、管理ツールの上位20から消えてしまう
//    ・★最レ（sairei_kokugo）は年度で回の中身が入れかわるので、回番号にひもづけない
{
  const j = readJSON('hama_kokugo.json');
  for (const [grade, courses] of Object.entries((j && j.grades) || {})) {
    for (const [course, cv] of Object.entries(courses)) {
      if (course.startsWith('_')) continue;
      const unit = course === 'sairei_kokugo' ? '最レ国語' : 'じゅくナビ漢字';
      for (const lesson of Object.values((cv && cv.lessons) || {})) {
        (lesson.kanji || []).forEach(q => {
          if (q && q.id) put('kokugo', 'hama_kokugo', q.id, q.grade || grade, unit);
        });
      }
    }
  }
}

// ── 出力 ──
const labels = { _subjects: SUBJECT_LABELS };
for (const [subject, cats] of Object.entries(CATS)) {
  for (const [cat, [, label]] of Object.entries(cats)) labels[`${subject}_${cat}`] = label;
}
// 問題プールを持たない出しかたのラベル。記録キーには出てくるが data/*.json には並んでいない。
//   kaisetsu … かんたん解説（IDが kx_5_0_r0 の形で、単元名を持たない＝索引に載せられない）
//   hama / null … じゅくナビ経由でカテゴリが取れなかった記録
Object.assign(labels, {
  sansu_kaisetsu: 'かんたん解説', rika_kaisetsu: 'かんたん解説', kokugo_kaisetsu: 'かんたん解説',
  sansu_hama: 'じゅくナビ', rika_hama: 'じゅくナビ', kokugo_hama: 'じゅくナビ',
  kokugo_hama_kokugo: 'じゅくナビ国語',   // 小3・小4本科の漢字＋小5最レのことば（data/hama_kokugo.json）
  sansu_null: 'カテゴリ不明', rika_null: 'カテゴリ不明', kokugo_null: 'カテゴリ不明',
});
const stamp = process.env.QINDEX_DATE || new Date().toISOString().slice(0, 10);
const out = { ver: stamp, units, labels, q };
const js = 'window.OTON_QINDEX = ' + JSON.stringify(out) + ';\n';

console.log('問題ID:', count, '件 ／ 単元:', units.length, '種 ／ バケツ:', Object.keys(q).length);
console.log('サイズ:', Math.round(js.length / 1024), 'KB');
for (const [k, v] of Object.entries(q)) console.log('  ', k, Object.keys(v).length);

if (process.argv.includes('--write')) {
  const dest = path.join(ROOT, 'oton-admin', 'qindex.js');
  fs.writeFileSync(dest, js, 'utf8');
  console.log('書き出し:', dest);
} else {
  console.log('（--write を付けると oton-admin/qindex.js に書き出します）');
}
