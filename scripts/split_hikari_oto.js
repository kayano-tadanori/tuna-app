// 「もののせいしつ」(rika_mono)に混在している光・音の問題を抽出し、
// 独立カテゴリ用のファイル data/rika_hikarioto.json を作成する。
// 抽出した問題は rika_mono.json から取り除く（重複防止）。
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const mono = JSON.parse(fs.readFileSync(path.join(dir, 'rika_mono.json'), 'utf8'));

const INC = /光|音|鏡|レンズ|虫めがね|ピンホール|反射|屈折|三原色|モノコード|やまびこ|焦点|スクリーン|弦|おんさ|こだま|凸レンズ|入射/;
const EXC = /魔法びん|まほうびん|保温|まとめる 力|あそびを した|熱を 何によって/;
const isHO = t => INC.test(t) && !EXC.test(t);

const hoRaw = mono.filter(q => isHO(q.question));
const rest = mono.filter(q => !isHO(q.question));

// 光→音の順にゆるく並べ、id を ho### に振り直す
hoRaw.sort((a, b) => {
  const soundA = /音|モノコード|やまびこ|おんさ|弦|こだま/.test(a.question) ? 1 : 0;
  const soundB = /音|モノコード|やまびこ|おんさ|弦|こだま/.test(b.question) ? 1 : 0;
  return soundA - soundB;
});
const ho = hoRaw.map((q, i) => {
  const n = String(i + 1).padStart(3, '0');
  return { ...q, id: 'ho' + n };
});

fs.writeFileSync(path.join(dir, 'rika_hikarioto.json'), JSON.stringify(ho, null, 2), 'utf8');
fs.writeFileSync(path.join(dir, 'rika_mono.json'), JSON.stringify(rest, null, 2), 'utf8');

console.log('光・音カテゴリ:', ho.length, '問 / もののせいしつ 残り:', rest.length, '問');
// 検証
let problems = [];
ho.forEach(q => { if (!q.question || !q.answer || !q.choices || q.choices.length !== 4) problems.push(q.id); });
console.log('問題のある項目:', problems.length);
// 光/音の内訳
console.log('音系:', ho.filter(q => /音|モノコード|やまびこ|おんさ|弦|こだま/.test(q.question)).length, '/ 光系:', ho.filter(q => !/音|モノコード|やまびこ|おんさ|弦|こだま/.test(q.question)).length);
