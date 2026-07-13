// 三権タウン事件簿の各選択場面を4択に拡張する
const fs = require('fs');

// 追加する選択肢（既存の選択肢に追記する）。opinionEffectは既存と合わせて4択でバランスするよう設定。
const ADD = {
  case_juice_tax: {
    stage: [
      [ { label: '税率を下げる修正案を出す', opinionEffect: 3, outcome: '国会では法律案を修正しながら話し合うこともよくあります。修正案を出すのも国会議員の仕事（立法権）です。' },
        { label: '採決を先送りし、さらに議論を続ける', opinionEffect: -3, outcome: '議論を尽くすことも大切ですが、結論が出るまで時間がかかることもあります。' } ],
      [ { label: '対象を大きな会社の商品だけに限定する', opinionEffect: 4, outcome: '内閣は法律の目的を守りながら、実行の範囲を工夫することもできます（行政権）。' },
        { label: '業界の要望を優先し、基準をゆるめる', opinionEffect: -8, outcome: '実行のしかたによっては、法律の目的が十分に達成されないこともあります。' } ],
      [ { label: '一部だけ違憲と判断し、修正を求める', opinionEffect: 2, outcome: '裁判所は、法律の一部分だけを違憲と判断することもあります（違憲審査権）。' },
        { label: '結論を出さず審理を長引かせる', opinionEffect: -9, outcome: '裁判が長引くと、社会の混乱が続いてしまうこともあります。' } ]
    ],
    trouble: [ { label: '反対派も参加する公開討論会を開く', opinionEffect: 10, outcome: '異なる意見を持つ人たちが直接話し合うことで、たがいの理解が深まりました。' } ]
  },
  case_helmet: {
    stage: [
      [ { label: '「努力義務」にとどめる修正案を出す', opinionEffect: 4, outcome: '国会は法律の強さの度合いも話し合いで決めます（立法権）。' },
        { label: '採決を先送りし、様子を見る', opinionEffect: -3, outcome: '結論を先延ばしにすると、対策が遅れてしまうこともあります。' } ],
      [ { label: '通学路を重点的にパトロールする', opinionEffect: 5, outcome: '内閣（警察など）は、法律の実行方法を工夫することができます（行政権）。' },
        { label: '取り締まりを厳しくし、罰則を強める', opinionEffect: -7, outcome: '取り締まりの厳しさによっては、反発が強まることもあります。' } ],
      [ { label: '一部の年齢層だけ違憲と判断する', opinionEffect: 3, outcome: '裁判所は、法律の一部分について違憲かどうかを判断することもあります（違憲審査権）。' },
        { label: '判断をせず審理を長引かせる', opinionEffect: -8, outcome: '結論が出ないままだと、現場の混乱が続いてしまいます。' } ]
    ],
    trouble: [ { label: '事故にあった人の体験談を紹介する', opinionEffect: 9, outcome: '実際の体験が伝わることで、必要性への理解が深まりました。' } ]
  },
  case_factory: {
    stage: [
      [ { label: '基準を段階的に引き上げる修正案にする', opinionEffect: 4, outcome: '国会はさまざまな立場を考えながら法律の内容を調整します（立法権）。' },
        { label: '採決を先送りし、さらに調査する', opinionEffect: -3, outcome: '調査に時間がかかると、対応が遅れてしまうこともあります。' } ],
      [ { label: '検査結果を公開し、透明性を高める', opinionEffect: 5, outcome: '内閣は法律の実行方法にくふうを加えることができます（行政権）。' },
        { label: '工場の言い分を優先し、検査をゆるめる', opinionEffect: -8, outcome: '検査が甘くなると、法律の目的が達成されにくくなります。' } ],
      [ { label: '一部の基準だけ違憲と判断する', opinionEffect: 3, outcome: '裁判所は法律の一部分について判断することもあります（違憲審査権）。' },
        { label: '判断を保留し、審理を続ける', opinionEffect: -9, outcome: '結論が出ないままでは、川の環境改善も進みません。' } ]
    ],
    trouble: [ { label: '川の環境データを分かりやすく公開する', opinionEffect: 9, outcome: '客観的なデータを示したことで、多くの人が状況を正しく理解しました。' } ]
  },
  case_game: {
    stage: [
      [ { label: '上限額を年齢別に細かく設定する修正案にする', opinionEffect: 4, outcome: '国会は実情に合わせて法律の内容を調整します（立法権）。' },
        { label: '採決を先送りし、業界の意見を聞く', opinionEffect: -3, outcome: '意見を聞くことは大切ですが、対応が遅れることもあります。' } ],
      [ { label: '保護者向けの相談窓口を新しく作る', opinionEffect: 5, outcome: '内閣は法律の目的を達成するための具体策を考えます（行政権）。' },
        { label: '業界の要望を優先し、規制をゆるめる', opinionEffect: -7, outcome: '規制がゆるむと、法律の目的が十分に達成されないこともあります。' } ],
      [ { label: '一部の規定だけ違憲と判断する', opinionEffect: 3, outcome: '裁判所は法律の一部分について判断することもあります（違憲審査権）。' },
        { label: '判断を保留し、審理を長引かせる', opinionEffect: -8, outcome: '結論が出ないままでは、消費者も会社も困ってしまいます。' } ]
    ],
    trouble: [ { label: '実際に困った家庭の声を紹介する', opinionEffect: 9, outcome: '具体的な事例が伝わり、多くの人が必要性を理解しました。' } ]
  },
  case_overtime: {
    stage: [
      [ { label: '業種ごとに段階的に導入する修正案にする', opinionEffect: 4, outcome: '国会はさまざまな仕事の実情を考えながら法律を調整します（立法権）。' },
        { label: '採決を先送りし、さらに調査する', opinionEffect: -3, outcome: '調査に時間がかかると、対応が遅れてしまうこともあります。' } ],
      [ { label: '相談しやすい窓口を各地に増やす', opinionEffect: 5, outcome: '内閣は法律の実行方法にくふうを加えることができます（行政権）。' },
        { label: '会社の要望を優先し、監督をゆるめる', opinionEffect: -7, outcome: '監督がゆるむと、法律の目的が十分に達成されないこともあります。' } ],
      [ { label: '一部の業種だけ違憲と判断する', opinionEffect: 3, outcome: '裁判所は法律の一部分について判断することもあります（違憲審査権）。' },
        { label: '判断を保留し、審理を長引かせる', opinionEffect: -8, outcome: '結論が出ないままでは、働く人の負担が続いてしまいます。' } ]
    ],
    trouble: [ { label: '働く人と会社、両方の声を聞く場を作る', opinionEffect: 9, outcome: '両方の立場の話を聞いたことで、バランスの取れた理解が広まりました。' } ]
  },
  case_fushinnin: {
    stage: [
      [ { label: '不信任ではなく、政策の見直しを求める決議にする', opinionEffect: 3, outcome: '国会には不信任決議以外にも、内閣に方針の見直しを求める方法があります。' },
        { label: '態度を決めず、様子を見る', opinionEffect: -4, outcome: '重要な場面で態度を決めないと、政治が停滞してしまうこともあります。' } ],
      [ { label: '一部の政策だけを見直し、続投する', opinionEffect: 3, outcome: '不信任決議が否決された場合、内閣は政策を見直しながら続けることもできます。' },
        { label: '何も変えず、そのまま続ける', opinionEffect: -5, outcome: '国民の声に向き合わないままだと、信頼を失ってしまうこともあります。' } ]
    ],
    trouble: [ { label: '衆議院解散後の争点をていねいに説明する', opinionEffect: 9, outcome: '選挙で何が問われているのかが伝わり、関心が高まりました。' } ]
  },
  case_treaty: {
    stage: [
      [ { label: '国内の関係者の意見を聞いてから交渉する', opinionEffect: 4, outcome: '内閣は交渉にあたって国内の状況も考慮します（外交権）。' },
        { label: '相手国の要求をそのまま受け入れる', opinionEffect: -6, outcome: '交渉での判断によっては、国内の理解を得にくくなることもあります。' } ],
      [ { label: '条件付きで承認する', opinionEffect: 4, outcome: '国会は条約に条件をつけて承認することもあります（条約承認権）。' },
        { label: '審議をせず、そのまま可決する', opinionEffect: -5, outcome: '十分な審議がないと、あとで問題が起こることもあります。' } ]
    ],
    trouble: [ { label: '条約の内容を国民にわかりやすく説明する資料を作る', opinionEffect: 9, outcome: '分かりやすい説明によって、多くの人が条約の意義を理解しました。' } ]
  },
  case_shinsa: {
    stage: [
      [ { label: '法律の専門家の意見を聞いてから任命する', opinionEffect: 3, outcome: '内閣は慎重に手続きを進めながら裁判官を任命します。' },
        { label: '特に説明をせず、すぐに任命する', opinionEffect: -3, outcome: '説明が不足すると、あとで疑問の声が出ることもあります。' } ],
      [ { label: 'よく分からないので、投票せずに棄権する', opinionEffect: 2, outcome: '国民審査は義務ではありませんが、参加することで制度がより意味を持ちます。' } ]
    ],
    trouble: [ { label: '過去の主な判決をリストにして紹介する', opinionEffect: 8, outcome: '具体的な判断材料が増えたことで、制度への関心が高まりました。' } ]
  },
  case_dangai: {
    stage: [
      [ { label: '事実関係を第三者に調査してもらう', opinionEffect: 3, outcome: '公正な手続きのために、慎重な調査が行われることもあります。' } ],
      [ { label: '重大とまでは言えないとし、注意にとどめる', opinionEffect: 2, outcome: '弾劾裁判所は、問題の重さに応じてさまざまな判断をすることができます。' },
        { label: '証拠不十分として結論を先送りする', opinionEffect: -6, outcome: '結論が出ないままだと、司法への信頼が揺らいでしまうこともあります。' } ]
    ],
    trouble: [ { label: '弾劾裁判のしくみそのものを分かりやすく説明する', opinionEffect: 8, outcome: 'めずらしい制度についての理解が広がり、納得する人が増えました。' } ]
  },
  case_senkyo: {
    stage: [
      [ { label: '教育の充実とセットで実施する修正案にする', opinionEffect: 4, outcome: '国会は実施の条件も合わせて法律の内容を決めます（立法権）。' },
        { label: '採決を先送りし、さらに議論を続ける', opinionEffect: -3, outcome: '議論を重ねることは大切ですが、時間がかかりすぎることもあります。' } ],
      [ { label: '分かりやすい選挙ガイドを作成し配布する', opinionEffect: 5, outcome: '内閣は制度の周知方法をくふうすることができます（行政権）。' },
        { label: '特に準備をせず、そのまま実施する', opinionEffect: -6, outcome: '準備が不足すると、混乱が起きてしまうこともあります。' } ]
    ],
    trouble: [ { label: '若い世代の政治参加の意義を発信する', opinionEffect: 9, outcome: '多くの若者が政治への関心を持つきっかけになりました。' } ]
  }
};

for (const file of ['data/sanken_cases.json', 'scripts/sanken_cases.json']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const c of data) {
    const add = ADD[c.id];
    if (!add) continue;
    c.stages.forEach((s, si) => {
      const extra = add.stage[si];
      if (extra) s.options.push(...extra);
    });
    if (add.trouble) c.trouble.options.push(...add.trouble);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(file, 'expanded');
}

// 検証：各選択場面の選択肢数
const data = JSON.parse(fs.readFileSync('data/sanken_cases.json', 'utf8'));
let problems = [];
data.forEach(c => {
  c.stages.forEach((s, i) => { if (s.options.length !== 4) problems.push(c.id + ' stage' + i + ': ' + s.options.length + ' opts'); });
  if (c.trouble.options.length !== 4) problems.push(c.id + ' trouble: ' + c.trouble.options.length + ' opts');
});
console.log('problems:', problems.length);
problems.forEach(p => console.log(p));
