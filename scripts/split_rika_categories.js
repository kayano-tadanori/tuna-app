// 理科の複合カテゴリから、独立した大単元を分離する。
//  ・天体と気象 → 気象(天気) を分離
//  ・もののせいしつ → 気体 を分離
//  ・動物と人体 → 人体 を分離
// 抽出した問題は元ファイルから取り除き、新ファイルへ移す（idは新プレフィックスに振り直す）。
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const save = (f, d) => fs.writeFileSync(path.join(dir, f), JSON.stringify(d, null, 2), 'utf8');

function split(srcFile, newFile, prefix, incRe, excRe) {
  const src = load(srcFile);
  const moved = src.filter(q => incRe.test(q.question) && !(excRe && excRe.test(q.question)));
  const rest = src.filter(q => !(incRe.test(q.question) && !(excRe && excRe.test(q.question))));
  const renum = moved.map((q, i) => ({ ...q, id: prefix + String(i + 1).padStart(3, '0') }));
  save(newFile, renum);
  save(srcFile, rest);
  return { moved: renum.length, rest: rest.length };
}

// 気象（天気）
const tenki = split('rika_sora.json', 'rika_tenki.json', 'tk',
  /天気|気温|雲|湿度|しつ度|前線|台風|気圧|百葉箱|快晴|くもり|雨量|季節風|つゆ|梅雨|偏西風|高気圧|低気圧|風向|風速|露点|飽和水蒸気|きり|しも|天気図|あたたか.*日|さむ.*日/,
  null);
// 気体
const kitai = split('rika_mono.json', 'rika_kitai.json', 'kt',
  /酸素|水素|ちっ素|窒素|二酸化炭素|アンモニア|気体の集め方|上方置換|下方置換|水上置換|石灰水|燃焼|ものの燃え方|集気びん|気体を|の気体|塩化水素|火の ついた|燃やす/,
  /水よう液.*酸素|光|音/);
// 人体
const jintai = split('rika_doubutsu.json', 'rika_jintai.json', 'jt',
  /人体|心臓|血液|血管|動脈|静脈|消化|小腸|大腸|胃|かん臓|肝臓|じん臓|腎臓|ぼうこう|肺|気管|横かくまく|だ液|消化液|養分.*吸収|はく動|脈はく|ヒトの|人の.*(体|骨|ほね|筋肉|きん肉|血)|大人の 体の ほね|せぼね/,
  null);

console.log('天気:', tenki.moved, '問（天体 残り', tenki.rest, '）');
console.log('気体:', kitai.moved, '問（もの 残り', kitai.rest, '）');
console.log('人体:', jintai.moved, '問（動物 残り', jintai.rest, '）');

// 検証
['rika_tenki.json', 'rika_kitai.json', 'rika_jintai.json'].forEach(f => {
  const d = load(f);
  const bad = d.filter(q => !q.question || !q.answer || !q.choices || q.choices.length !== 4).length;
  const ids = d.map(q => q.id);
  console.log(f, d.length, '問 / choices不正', bad, '/ id重複', ids.length - new Set(ids).size);
});
