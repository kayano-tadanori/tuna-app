const fs = require('fs');

const ADD2 = {
  case_fushinnin: { 2: [
    { label: '新しい内閣のもとで、政策が見直される', opinionEffect: 6, outcome: '総選挙の結果によって、政治の方針が新しくなることもあります。国民の意思が政治に反映されるしくみです（国民主権）。' },
    { label: '同じ内閣が信任され、政策が続けられる', opinionEffect: 4, outcome: '選挙の結果、もとの内閣の方針が支持されることもあります。これも国民の判断の結果です。' },
    { label: '国会の議席の顔ぶれが大きく変わる', opinionEffect: 3, outcome: '総選挙によって国会議員が入れかわることで、国の政治の方向性が変化することがあります。' }
  ] },
  case_treaty: { 2: [
    { label: '条約の内容を国内の制度に反映させていく', opinionEffect: 5, outcome: '内閣は条約の内容にもとづいて、国内の政策も調整していきます（行政権）。' },
    { label: '相手国と協力しながら実施状況を確認する', opinionEffect: 4, outcome: '条約が結ばれたあとも、内閣は継続して外交の実務を担当します（外交権）。' },
    { label: '国会に実施の状況を報告する', opinionEffect: 3, outcome: '内閣は国会に対して、条約の実施状況を説明する責任も持っています。' }
  ] },
  case_shinsa: {
    0: [ { label: '複数の候補から慎重に選ぶ', opinionEffect: 4, outcome: '内閣は裁判官としてふさわしい人物を慎重に検討して任命します。' } ],
    1: [ { label: '事前に判決の内容を調べてから投票する', opinionEffect: 10, outcome: '調べたうえで投票することで、国民審査がより意味のあるものになります。' } ],
    2: [
      { label: '国民審査は義務投票ではないが、参加が大切だと分かった', opinionEffect: 5, outcome: '国民審査は強制ではありませんが、参加する人が増えるほど、司法への国民のチェックが実質的なものになります。' },
      { label: '裁判官も国民の目を意識する必要があると分かった', opinionEffect: 4, outcome: '国民審査があることで、裁判官も公正な判断を続ける意識を持つことにつながります。' },
      { label: '司法は完全に独立しているわけではないと分かった', opinionEffect: 3, outcome: '裁判所は独立して判断しますが、国民審査のようなしくみを通じて、間接的に国民の意思とつながっています。' }
    ]
  },
  case_dangai: {
    0: [
      { label: '他の裁判官にも相談し、状況を共有する', opinionEffect: 3, outcome: '裁判所内でも問題を共有し、公正に対応しようとする姿勢が大切です。' },
      { label: '問題を見過ごし、何もしない', opinionEffect: -6, outcome: '問題を見過ごすと、裁判所全体の信頼が損なわれてしまうこともあります。' }
    ],
    2: [
      { label: '弾劾裁判があることで、裁判官の責任が保たれると分かった', opinionEffect: 5, outcome: '弾劾裁判のしくみがあることで、裁判官は重い責任を持って仕事にあたることになります。' },
      { label: '三権はおたがいに完全に無関係ではないと分かった', opinionEffect: 4, outcome: '三権分立といっても、各機関がまったく無関係なわけではなく、必要なときはチェックし合います。' },
      { label: 'めったに使われない、特別なしくみだと分かった', opinionEffect: 3, outcome: '弾劾裁判は実際にはめったに行われませんが、いざというときのための大切なしくみです。' }
    ]
  },
  case_senkyo: { 2: [
    { label: '一票の大切さをあらためて感じた', opinionEffect: 6, outcome: '有権者が増えることで、より多くの世代の声が政治に届くようになります。これも国民主権の考え方です。' },
    { label: '同世代の友だちにも選挙の話をしてみようと思った', opinionEffect: 5, outcome: '関心を広げていくことも、主権者としての大切な行動の1つです。' },
    { label: '投票以外にも政治に参加する方法があると気づいた', opinionEffect: 4, outcome: '請願や意見の表明など、選挙以外にも国民が政治に関わる方法はいろいろあります。' }
  ] }
};

for (const file of ['data/sanken_cases.json', 'scripts/sanken_cases.json']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const c of data) {
    const add = ADD2[c.id];
    if (!add) continue;
    for (const [idx, extra] of Object.entries(add)) {
      c.stages[Number(idx)].options.push(...extra);
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(file, 'patched');
}

const data = JSON.parse(fs.readFileSync('data/sanken_cases.json', 'utf8'));
let problems = [];
data.forEach(c => {
  c.stages.forEach((s, i) => { if (s.options.length !== 4) problems.push(c.id + ' stage' + i + ': ' + s.options.length + ' opts'); });
  if (c.trouble.options.length !== 4) problems.push(c.id + ' trouble: ' + c.trouble.options.length + ' opts');
});
console.log('problems:', problems.length);
problems.forEach(p => console.log(p));
