// sanken_cases.json に「世論支持率」「トラブル対応」「エンディング」の要素を追加する
const fs = require('fs');
const cases = JSON.parse(fs.readFileSync('scripts/sanken_cases.json', 'utf8'));

// 各ケースのステージのoptionに与えるopinionEffect（世論への影響, -10〜+15）
// [ [stage1のoption毎], [stage2], [stage3] ]
const OPINION_PLAN = {
  case_juice_tax: [[10, 3], [8, 5], [10, 6]],
  case_helmet: [[8, 6], [6, 9], [9, 6]],
  case_factory: [[9, 5], [6, 10], [8, 7]],
  case_game: [[10, 6], [7, 8], [9, 6]],
  case_overtime: [[9, 6], [7, 9], [8, 7]],
  case_fushinnin: [[7, 5], [6, 9], [10]],
  case_treaty: [[6, 9], [10, 7], [8]],
  case_shinsa: [[8], [5, 8], [9]],
  case_dangai: [[7], [9, 6], [8]],
  case_senkyo: [[10, 6], [7, 9], [9]]
};

// トラブル発生イベント（各ケース1つずつ、stage2の後に発生）
const TROUBLES = {
  case_juice_tax: {
    icon: '📢', narrative: 'SNSで「甘い物を全部禁止する気だ」というまちがったうわさが広まり、世論が動揺しています。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '記者会見を開き、法律の正しい内容を説明する', opinionEffect: 10, outcome: '正確な情報を伝えたことで、誤解が解けていきました。政治では、国民に正しく説明する努力（説明責任）も大切です。' },
      { label: 'SNSで専門家に協力してもらい、発信する', opinionEffect: 7, outcome: '専門家の意見が加わったことで、信頼度が高まりました。' },
      { label: '特に何もせず、なりゆきを見守る', opinionEffect: -6, outcome: '誤解が広まったままになり、反対の声が大きくなってしまいました。' }
    ]
  },
  case_helmet: {
    icon: '📢', narrative: '「自転車通学の子どもがかわいそう」という声がテレビで取り上げられ、反対運動が起こりました。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '事故を防げたデータを示し、必要性を説明する', opinionEffect: 10, outcome: 'データにもとづいた説明で、多くの人が納得しました。' },
      { label: '安価なヘルメットを配る支援策を打ち出す', opinionEffect: 8, outcome: '負担を減らす工夫が評価され、理解が広がりました。' },
      { label: '反対の声を無視して押し切る', opinionEffect: -8, outcome: '一方的な態度に、さらに反発が強まってしまいました。' }
    ]
  },
  case_factory: {
    icon: '📢', narrative: '地元の工場ではたらく人たちから「仕事がなくなる」という不安の声が上がっています。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '住民説明会を開き、話し合いの場を持つ', opinionEffect: 10, outcome: '直接対話することで、不安が少しずつやわらぎました。' },
      { label: '国の補助金制度をわかりやすく紹介する', opinionEffect: 8, outcome: '支援があることが伝わり、理解が進みました。' },
      { label: '「決まったことだから」と説明を省略する', opinionEffect: -7, outcome: '説明不足への不満が広がってしまいました。' }
    ]
  },
  case_game: {
    icon: '📢', narrative: 'ゲーム会社の団体が「規制は行き過ぎだ」と大々的に反対キャンペーンを始めました。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '子どもを持つ保護者にアンケートを取り、結果を公表する', opinionEffect: 10, outcome: '実際の声を示したことで、多くの人の共感を得ました。' },
      { label: '業界団体と話し合いの場を持つ', opinionEffect: 8, outcome: '対話を重ねることで、落としどころが見えてきました。' },
      { label: '反対キャンペーンを一方的に批判する', opinionEffect: -6, outcome: '対立が深まり、世論も分かれてしまいました。' }
    ]
  },
  case_overtime: {
    icon: '📢', narrative: '「人手が足りない業界はどうすればいいのか」という現場の不満がニュースになりました。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '業界ごとに相談窓口を設け、実情を聞く', opinionEffect: 10, outcome: '現場の声を丁寧に聞いたことで、信頼が高まりました。' },
      { label: '成功している他の会社の例を紹介する', opinionEffect: 7, outcome: '前向きな事例が伝わり、理解が広がりました。' },
      { label: '「法律だから守るように」とだけ伝える', opinionEffect: -6, outcome: '一方的な姿勢に不満の声が広がってしまいました。' }
    ]
  },
  case_fushinnin: {
    icon: '📢', narrative: '内閣不信任決議をめぐり、世論はまっぷたつに分かれ、大きな議論になっています。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: 'なぜ不信任なのか、理由をていねいに説明する', opinionEffect: 10, outcome: '説明を尽くしたことで、多くの人が状況を理解しました。' },
      { label: 'テレビの討論番組に出演し、議論する', opinionEffect: 7, outcome: '議論の様子が伝わり、関心が高まりました。' },
      { label: '説明をせず、決定だけを伝える', opinionEffect: -7, outcome: '説明不足への不満が広がってしまいました。' }
    ]
  },
  case_treaty: {
    icon: '📢', narrative: '「その条約は本当に日本のためになるのか」と、国民の間で不安の声が広がっています。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '条約の内容とメリットを分かりやすく公表する', opinionEffect: 10, outcome: '具体的な説明によって、不安が少しずつ解消されました。' },
      { label: '専門家による解説の機会を設ける', opinionEffect: 8, outcome: '専門的な視点が加わり、理解が深まりました。' },
      { label: '「もう決まったこと」として説明を打ち切る', opinionEffect: -7, outcome: '不信感が広がり、反対の声が強まってしまいました。' }
    ]
  },
  case_shinsa: {
    icon: '📢', narrative: '「国民審査って何を基準に投票すればいいの？」という声が多く上がっています。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '裁判官のこれまでの判断をわかりやすく紹介する', opinionEffect: 10, outcome: '判断材料が増えたことで、多くの人が制度に関心を持ちました。' },
      { label: '学校などで国民審査のしくみを教える', opinionEffect: 8, outcome: '若い世代の理解が深まりました。' },
      { label: '特に情報を発信しない', opinionEffect: -5, outcome: 'よく分からないまま投票する人が多くなってしまいました。' }
    ]
  },
  case_dangai: {
    icon: '📢', narrative: '「その裁判官は本当にやめさせるべきなのか」と、世論が割れています。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '弾劾裁判の審理内容をできる範囲で公開する', opinionEffect: 9, outcome: '手続きの公正さが伝わり、納得する人が増えました。' },
      { label: '専門家に手続きの意味を解説してもらう', opinionEffect: 7, outcome: 'しくみへの理解が深まりました。' },
      { label: '何も説明せず結論だけ発表する', opinionEffect: -7, outcome: '不透明だという批判が広がってしまいました。' }
    ]
  },
  case_senkyo: {
    icon: '📢', narrative: '「18歳はまだ政治のことをよく分かっていないのでは」という慎重な意見が広がりました。',
    question: 'あなたはどう働きかけますか？',
    options: [
      { label: '高校での主権者教育の取り組みを紹介する', opinionEffect: 10, outcome: '若い世代への準備が伝わり、安心する人が増えました。' },
      { label: '実際に18歳で投票した人の声を紹介する', opinionEffect: 8, outcome: '具体的な体験談が、理解を後押ししました。' },
      { label: '「もう決まったことだから」と押し切る', opinionEffect: -6, outcome: '説明不足への不安が残ってしまいました。' }
    ]
  }
};

// 世論支持率にもとづくエンディング（3段階）
const ENDINGS = [
  { min: 65, title: '🎉 政策は多くの人に理解され、実現しました！', text: 'あなたの働きかけによって世論の理解が広がり、政策はスムーズに実現へと進みました。政治は、国会・内閣・裁判所だけでなく、国民の理解や世論の後押しがあってこそ、うまく機能します。' },
  { min: 40, title: '👍 意見は分かれましたが、なんとか実現しました', text: '賛成・反対の意見が分かれる中でしたが、最終的には政策が実現しました。世の中の意見が完全に一致することはまれで、対立をこえて物事を進めていくのも政治の大事な役割です。' },
  { min: 0, title: '😥 世論の反対が強く、実現は難しくなりました', text: '世論の理解を十分に得られず、政策の実現は難しくなってしまいました。政治では、正しい手続きだけでなく、国民にきちんと説明し、納得してもらう努力（説明責任）もとても大切です。' }
];

let updated = 0;
for (const c of cases) {
  // 誤って混入したタイプミスキーを除去
  c.stages.forEach(s => { if (s.narrature) delete s.narrature; });

  const plan = OPINION_PLAN[c.id];
  if (plan) {
    c.stages.forEach((s, si) => {
      s.options.forEach((o, oi) => {
        if (plan[si] && plan[si][oi] !== undefined) o.opinionEffect = plan[si][oi];
      });
    });
  }
  if (TROUBLES[c.id]) c.trouble = TROUBLES[c.id];
  c.endings = ENDINGS;
  updated++;
}

fs.writeFileSync('scripts/sanken_cases.json', JSON.stringify(cases, null, 2), 'utf8');
console.log('updated cases:', updated);

// 検証
let problems = [];
for (const c of cases) {
  c.stages.forEach((s, si) => {
    s.options.forEach((o, oi) => {
      if (o.opinionEffect === undefined) problems.push(c.id + ' stage' + si + ' option' + oi + ': missing opinionEffect');
    });
  });
  if (!c.trouble) problems.push(c.id + ': missing trouble');
  c.trouble.options.forEach((o, oi) => { if (o.opinionEffect === undefined) problems.push(c.id + ' trouble option' + oi + ': missing opinionEffect'); });
}
console.log('problems:', problems.length);
problems.forEach(p => console.log(p));
