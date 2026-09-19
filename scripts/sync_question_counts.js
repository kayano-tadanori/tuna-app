// データファイルの実際の問題数から app.js の QUESTION_COUNTS を自動更新する。
// データを追加・削除したらこのスクリプトを実行すれば件数がそろう。
// （科目選択の表示は QUESTION_COUNTS から自動計算されるので、ここを直せば表示も直る）
const fs = require('fs');
const path = require('path');
// ⚠ QUESTION_COUNTS は app.js 分割（2026-08-08）で js/gamify.js に移った。
//    app.js を見ていたので「見つかりません」で落ちていた
const APP = path.join(__dirname, '..', 'js', 'gamify.js');
const DATA = path.join(__dirname, '..', 'data');

// カテゴリ → データファイル名（拡張子なし）
// ★QUESTION_COUNTS にあるのにここに無いカテゴリは、件数も科目合計も更新されない。
//   実際 kokugo で4つ・sansu で1つ抜けていて、国語の合計コメントが
//   6,307 のところ 4,986（=1,321問ぶん少ない）になっていた（2026-08-08 に足した）。
//   ★下の「対応表の抜け」検査が、足し忘れたら落ちるようにしてある
const MAP = {
  kokugo: { kotowaza: 'kotowaza', kanyoku: 'kanyoku', yojijukugo: 'yojijukugo', gairaigo: 'gairaigo', kanji_kaki: 'kanji_kaki', kanji_yomi: 'kanji_yomi', kokugo_keigo: 'kokugo_keigo', kokugo_goi: 'kokugo_goi', kokugo_bushu: 'kokugo_bushu', kokugo_bungaku: 'kokugo_bungaku', kokugo_bun: 'kokugo_bun', kokugo_wago: 'kokugo_wago', kokugo_sairei5: 'kokugo_sairei5', hama_kokugo: 'hama_kokugo', tantei: 'kokugo_tantei', youyaku: 'kokugo_youyaku' },
  sansu: { keisan: 'sansu_keisan', bun: 'sansu_bun', zu: 'sansu_zu', kisoku: 'sansu_kisoku', tokusan: 'sansu_tokusan', baai: 'sansu_baai', kazu: 'sansu_kazu', wariai: 'sansu_wariai', hayasa: 'sansu_hayasa', rittai: 'sansu_rittai', bakuhatsu: 'sansu_bakuhatsu' },
  rika: { shokubutsu: 'rika_shokubutsu', doubutsu: 'rika_doubutsu', jintai: 'rika_jintai', sora: 'rika_sora', tenki: 'rika_tenki', mono: 'rika_mono', kitai: 'rika_kitai', daichi: 'rika_daichi', suiyoueki: 'rika_suiyoueki', denki: 'rika_denki', chikara: 'rika_chikara', hikari_oto: 'rika_hikarioto' },
  shakai: { kokudo: 'shakai_kokudo', sangyo: 'shakai_sangyo', rekishi: 'shakai_rekishi', komin: 'shakai_komin' },
};

// ★「いちばん外の配列の長さ」では数えられないファイルがある。
//   hama_kokugo.json は grades→コース→lessons→回→kanji[] の入れ子で、
//   素朴に取ると grades の中の配列（7件）を拾ってしまう。
//   問題らしい形（id と answer と question を持つ）を数え上げる
const count = (file) => {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, file + '.json'), 'utf8'));
  if (Array.isArray(d)) return d.length;
  let n = 0;
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if ('id' in o && 'answer' in o && 'question' in o) { n++; return; }
    Object.values(o).forEach(walk);
  };
  walk(d);
  return n;
};

let src = fs.readFileSync(APP, 'utf8');
// QUESTION_COUNTS ブロックを取り出す
const m = src.match(/const QUESTION_COUNTS = \{[\s\S]*?\n\};/);
if (!m) { console.error('QUESTION_COUNTS が見つかりません'); process.exit(1); }
let block = m[0];
const orig = block;
const changes = [];

// ★対応表の抜けを先に見る。抜けたカテゴリは件数も合計も更新されないまま静かに古くなる。
//   実際これで国語の合計が1,321問ぶん少なくなっていた（2026-08-08）
{
  const missing = [];
  for (const mb of block.matchAll(/(\w+):\s*\{([\s\S]*?)\}/g)) {
    const subj = mb[1];
    if (!MAP[subj]) { missing.push(`科目 ${subj} が対応表に無い`); continue; }
    const body = mb[2].replace(/\/\/[^\n]*/g, '');
    for (const cm of body.matchAll(/(\w+)\s*:\s*\d+/g)) {
      if (!(cm[1] in MAP[subj])) missing.push(`${subj}.${cm[1]}`);
    }
  }
  if (missing.length) {
    console.error('✗ QUESTION_COUNTS にあるのに対応表(MAP)に無いカテゴリがあります：');
    for (const x of missing) console.error('   ・' + x);
    console.error('  → MAP に足してから流し直してください（足さないと件数が古いまま残ります）');
    process.exit(1);
  }
}

for (const [subj, cats] of Object.entries(MAP)) {
  let subjTotal = 0;
  for (const [cat, file] of Object.entries(cats)) {
    const n = count(file);
    subjTotal += n;
    // ブロック内の「cat: 数字」を実件数に置換（cat名の前は非英数字＝別カテゴリ名の一部を誤置換しない）
    block = block.replace(new RegExp('([^\\w])(' + cat + ': )\\d+'), (mm, pre, key) => pre + key + n);
  }
  // 各科目行末のコメント（// 4,861 など）を合計に更新
  const label = subj; // コメントは各科目の最後のカテゴリ行の末尾
  block = block.replace(new RegExp('(' + subj + ':\\s*\\{[\\s\\S]*?\\},\\s*//\\s*)[\\d,]+'), '$1' + subjTotal.toLocaleString('en-US'));
  changes.push(`${subj}: ${subjTotal.toLocaleString('en-US')}`);
}

// ── EXTRA_COUNTS（通常問題の外＝大問・連鎖・ガチの「小問」の数）を実データから数える ──
//   ★表示専用（科目カード・使い方ガイド）。達成率の QUESTION_COUNTS／ACH_BASE とは別。
//   daimon の科目わけ＝コースのキーで決める（rika/nadago_rika＝理科、kokugo/kokugo_bunsatsu＝国語、他＝算数）
{
  const steps = (o) => {           // steps を持つもの（大問・連鎖1本）の小問を数える
    let n = 0;
    const walk = (x) => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (!x || typeof x !== 'object') return;
      if (Array.isArray(x.steps)) { n += x.steps.length; return; }
      Object.values(x).forEach(walk);
    };
    walk(o);
    return n;
  };
  const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f + '.json'), 'utf8'));
  const RIKA = new Set(['rika', 'nadago_rika']), KOKUGO = new Set(['kokugo', 'kokugo_bunsatsu']);
  const dm = { kokugo: 0, sansu: 0, rika: 0 };
  for (const G of Object.values(load('hama_daimon').grades)) {
    for (const [course, C] of Object.entries(G)) {
      const subj = RIKA.has(course) ? 'rika' : KOKUGO.has(course) ? 'kokugo' : 'sansu';
      dm[subj] += steps(C);
    }
  }
  const ex = {
    kokugo: { chain: steps(load('kokugo_chain')), daimon: dm.kokugo },
    sansu:  { chain: steps(load('sansu_chain')), gachi: steps(load('sansu_gachi')), daimon: dm.sansu },
    rika:   { chain: steps(load('rika_chain')), gachi: steps(load('rika_gachi')), daimon: dm.rika },
    shakai: { chain: steps(load('shakai_chain')) },
  };
  const fmt = (o) => '{ ' + Object.entries(o).map(([k, v]) => k + ': ' + v).join(', ') + ' }';
  const NL = String.fromCharCode(10);
  const exBlock = 'const EXTRA_COUNTS = {' + NL
    + Object.entries(ex).map(([k, v]) => '  ' + (k + ':').padEnd(7) + ' ' + fmt(v) + ',').join(NL) + NL + '};';
  const em = src.match(/const EXTRA_COUNTS = \{[\s\S]*?\n\};/);
  if (!em) { console.error('EXTRA_COUNTS が見つかりません（js/gamify.js）'); process.exit(1); }
  if (em[0] !== exBlock) {
    src = src.replace(em[0], exBlock);
    fs.writeFileSync(APP, src, 'utf8');
    console.log('EXTRA_COUNTS を更新しました。');
  }
  console.log('大問・連鎖・ガチの小問:', Object.entries(ex).map(([k, v]) => k + ' ' + JSON.stringify(v)).join(' / '));
}

if (block !== orig) {
  src = src.replace(orig, block);
  fs.writeFileSync(APP, src, 'utf8');
  console.log('QUESTION_COUNTS を更新しました。');
} else {
  console.log('変更なし（すでに一致）。');
}
console.log('科目合計:', changes.join(' / '));
