// データファイルの実際の問題数から app.js の QUESTION_COUNTS を自動更新する。
// データを追加・削除したらこのスクリプトを実行すれば件数がそろう。
// （科目選択の表示は QUESTION_COUNTS から自動計算されるので、ここを直せば表示も直る）
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app.js');
const DATA = path.join(__dirname, '..', 'data');

// カテゴリ → データファイル名（拡張子なし）
const MAP = {
  kokugo: { kotowaza: 'kotowaza', kanyoku: 'kanyoku', yojijukugo: 'yojijukugo', gairaigo: 'gairaigo', kanji_kaki: 'kanji_kaki', kanji_yomi: 'kanji_yomi', kokugo_keigo: 'kokugo_keigo', kokugo_goi: 'kokugo_goi', kokugo_bushu: 'kokugo_bushu', kokugo_bungaku: 'kokugo_bungaku' },
  sansu: { keisan: 'sansu_keisan', bun: 'sansu_bun', zu: 'sansu_zu', kisoku: 'sansu_kisoku', tokusan: 'sansu_tokusan', baai: 'sansu_baai', kazu: 'sansu_kazu', wariai: 'sansu_wariai', hayasa: 'sansu_hayasa', rittai: 'sansu_rittai' },
  rika: { shokubutsu: 'rika_shokubutsu', doubutsu: 'rika_doubutsu', jintai: 'rika_jintai', sora: 'rika_sora', tenki: 'rika_tenki', mono: 'rika_mono', kitai: 'rika_kitai', daichi: 'rika_daichi', suiyoueki: 'rika_suiyoueki', denki: 'rika_denki', chikara: 'rika_chikara', hikari_oto: 'rika_hikarioto' },
  shakai: { kokudo: 'shakai_kokudo', sangyo: 'shakai_sangyo', rekishi: 'shakai_rekishi', komin: 'shakai_komin' },
};

const count = file => {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, file + '.json'), 'utf8'));
  const a = Array.isArray(d) ? d : Object.values(d).find(Array.isArray);
  return a.length;
};

let src = fs.readFileSync(APP, 'utf8');
// QUESTION_COUNTS ブロックを取り出す
const m = src.match(/const QUESTION_COUNTS = \{[\s\S]*?\n\};/);
if (!m) { console.error('QUESTION_COUNTS が見つかりません'); process.exit(1); }
let block = m[0];
const orig = block;
const changes = [];

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

if (block !== orig) {
  src = src.replace(orig, block);
  fs.writeFileSync(APP, src, 'utf8');
  console.log('QUESTION_COUNTS を更新しました。');
} else {
  console.log('変更なし（すでに一致）。');
}
console.log('科目合計:', changes.join(' / '));
