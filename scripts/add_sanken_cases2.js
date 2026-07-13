const fs = require('fs');

const ENDINGS = [
  { min: 65, title: '🎉 政策は多くの人に理解され、実現しました！', text: 'あなたの働きかけによって世論の理解が広がり、政策はスムーズに実現へと進みました。政治は、国会・内閣・裁判所だけでなく、国民の理解や世論の後押しがあってこそ、うまく機能します。' },
  { min: 40, title: '👍 意見は分かれましたが、なんとか実現しました', text: '賛成・反対の意見が分かれる中でしたが、最終的には政策が実現しました。世の中の意見が完全に一致することはまれで、対立をこえて物事を進めていくのも政治の大事な役割です。' },
  { min: 0, title: '😥 世論の反対が強く、実現は難しくなりました', text: '世論の理解を十分に得られず、政策の実現は難しくなってしまいました。政治では、正しい手続きだけでなく、国民にきちんと説明し、納得してもらう努力（説明責任）もとても大切です。' }
];

const NEW_CASES = [
  {
    id: 'case_yosan',
    icon: '💰',
    title: '国の予算はどう決まる？',
    intro: '国のお金の使いみち（予算）が決まっていくようすを、3つの立場で体験します。',
    stages: [
      {
        branch: '内閣', branchIcon: '⚙️', role: 'あなたは内閣（財務省など）の一員です。',
        narrative: '来年度の国の使いみち（予算案）を決める時期になりました。限られたお金を、どこに重点的に使うか考えることになりました。',
        question: 'どの分野を重視した予算案を作りますか？',
        options: [
          { label: '子育て支援や教育に手厚く配分する', opinionEffect: 8, outcome: '内閣は、国の政策の方針にもとづいて予算案を作成します。これは内閣の重要な仕事（予算編成権）です。' },
          { label: '災害への備え（防災）に手厚く配分する', opinionEffect: 8, outcome: '予算の使いみちを決めることで、国の政策の方向性が具体的な形になります。' },
          { label: '各分野に均等に配分し、変化を小さくする', opinionEffect: 3, outcome: '大きな変更を避ける方針を取ることもできますが、めだった政策の実現にはつながりにくいこともあります。' },
          { label: '特定の業界の要望を優先して配分する', opinionEffect: -7, outcome: '一部の意見だけを優先すると、公平性への疑問の声が上がることもあります。' }
        ]
      },
      {
        branch: '国会', branchIcon: '🏛️', role: 'あなたは国会議員です。',
        narrative: '内閣が作った予算案が、国会に提出されました。予算は、衆議院が先に審議する決まりになっています（衆議院の予算先議権）。',
        question: 'あなたは予算案にどう対応しますか？',
        options: [
          { label: '内容を認め、賛成する', opinionEffect: 9, outcome: '予算が成立しました。予算を審議し、決定するのは国会の重要な仕事（予算の議決権）です。' },
          { label: '一部の使いみちを見直すよう修正を求める', opinionEffect: 4, outcome: '国会は予算の内容を検討し、必要があれば見直しを求めることができます。' },
          { label: '衆参で意見が分かれ、両院協議会を求める', opinionEffect: 2, outcome: '衆参で議決が異なる場合、両院協議会が開かれます。それでも一致しないときは、衆議院の議決が優先されます（衆議院の優越）。' },
          { label: '反対し、予算の抜本的な見直しを求める', opinionEffect: -6, outcome: '反対の立場を取ることもできますが、予算が決まらないと新年度の政治活動に支障が出ることもあります。' }
        ]
      },
      {
        branch: '内閣', branchIcon: '⚙️', role: 'ふたたび内閣の一員として。',
        narrative: '予算が成立し、いよいよ新年度から実際にお金を使っていく番です。',
        question: '予算をどのように執行しますか？',
        options: [
          { label: '決められた通りに、計画的に執行する', opinionEffect: 8, outcome: '内閣は国会で決まった予算にもとづいて、実際に政策を実行します（予算執行権）。' },
          { label: '執行状況を公開し、透明性を確保する', opinionEffect: 9, outcome: '使いみちを明らかにすることで、国民の信頼を得ることにつながります。' },
          { label: '状況を見ながら、一部の使いみちを調整する', opinionEffect: 3, outcome: '大きな変更がない範囲で、実情に応じた調整を行うこともあります。' },
          { label: '年度末に急いで使い切ろうとする', opinionEffect: -8, outcome: '予算を無理に使い切ろうとすると、むだづかいだと批判されることがあります。' }
        ]
      }
    ],
    trouble: {
      icon: '📢', narrative: '「予算の使いみちが偏っている」という批判がメディアで取り上げられました。',
      question: 'あなたはどう働きかけますか？',
      options: [
        { label: '予算編成の考え方を、データとともに説明する', opinionEffect: 14, outcome: '具体的な根拠を示したことで、多くの人が納得しました。' },
        { label: '国民からの意見を聞く場を新たに設ける', opinionEffect: 9, outcome: '意見を聞く姿勢が評価され、信頼が高まりました。' },
        { label: '批判の一部を認め、次年度の見直しを約束する', opinionEffect: 5, outcome: '誠実な対応として受け止められました。' },
        { label: '特に反応せず、静観する', opinionEffect: -15, outcome: '説明がないまま放置すると、不信感がさらに広がってしまいました。' }
      ]
    },
    endings: ENDINGS,
    summary: '予算は、内閣が案を作り（予算編成権）、国会が審議して決め（予算の議決権）、そして内閣が実際に使う（予算執行権）という流れで進みます。お金の使いみちを決めることも、国の重要な「行政」の仕事の1つです。'
  },
  {
    id: 'case_saigai',
    icon: '🌪️',
    title: '災害からの復旧・復興',
    intro: '大きな災害が起きたときの、行政の動き方を3つの立場で体験します。',
    stages: [
      {
        branch: '内閣', branchIcon: '⚙️', role: 'あなたは内閣の一員です。',
        narrative: '大きな地震が発生し、多くの地域で被害が出ました。内閣として、迅速な対応が求められています。',
        question: 'まず何を行いますか？',
        options: [
          { label: '災害対策本部を設置し、情報を集約する', opinionEffect: 9, outcome: '内閣は緊急時に対策本部を設置し、迅速に対応する体制を整えます（行政権）。' },
          { label: '自衛隊に災害派遣を要請する', opinionEffect: 8, outcome: '内閣総理大臣は、必要に応じて自衛隊に災害派遣を要請することができます。' },
          { label: 'ようすを見ながら慎重に動く', opinionEffect: 0, outcome: '慎重な判断も大切ですが、災害対応では迅速さも重要です。' },
          { label: '被災地の自治体にすべて対応を任せる', opinionEffect: -6, outcome: '大規模な災害では、国と自治体が協力することが欠かせません。すべて任せると対応が遅れることもあります。' }
        ]
      },
      {
        branch: '内閣', branchIcon: '⚙️', role: 'ふたたび内閣の一員として。',
        narrative: '避難した人たちのため、実際に支援を行う番です。',
        question: 'どのように支援を進めますか？',
        options: [
          { label: '避難所に食料・水・毛布などを届ける', opinionEffect: 9, outcome: '内閣（各省庁）は、実際の行政サービスとして被災者を支援します（行政権）。' },
          { label: '仮設住宅の建設を急ピッチで進める', opinionEffect: 8, outcome: '生活の基盤を早く整えることも、行政の重要な役割です。' },
          { label: '義援金を公平に届けるしくみを整える', opinionEffect: 6, outcome: '支援を公平に届けるためのしくみを作るのも内閣の仕事です。' },
          { label: '予算の都合を理由に支援を後回しにする', opinionEffect: -9, outcome: '支援が遅れると、被災者の生活再建がさらに難しくなってしまいます。' }
        ]
      },
      {
        branch: '裁判所', branchIcon: '⚖️', role: 'あなたは裁判官です。',
        narrative: '住宅を失った人たちの一部が「国の支援が不十分だ」として、裁判を起こしました。',
        question: 'あなたはこの裁判について、どう判断しますか？',
        options: [
          { label: '行政の対応は合理的な範囲だったと判断する', opinionEffect: 8, outcome: '裁判所は、行政の対応が状況に応じて合理的だったかを審査します（司法権）。' },
          { label: '一部の支援が不十分だったと認め、追加対応を促す', opinionEffect: 6, outcome: '裁判所の判断が、行政の対応を見直すきっかけになることもあります。' },
          { label: '国と原告、双方の言い分をさらに聞く', opinionEffect: 3, outcome: '裁判は複数回の審理を経ることもあります（三審制）。' },
          { label: '審理を長引かせ、判断を先送りする', opinionEffect: -8, outcome: '判断が遅れると、被災者の不安が長引いてしまいます。' }
        ]
      }
    ],
    trouble: {
      icon: '📢', narrative: '「復興が遅れている地域がある」という報道があり、住民の不満が広がっています。',
      question: 'あなたはどう働きかけますか？',
      options: [
        { label: '現地を訪れ、状況を直接確認して説明する', opinionEffect: 14, outcome: '現場の声を聞く姿勢が、信頼につながりました。' },
        { label: '復興の進み具合を定期的に公表する', opinionEffect: 9, outcome: '情報を公開することで、状況への理解が広がりました。' },
        { label: '追加の支援策を検討すると発表する', opinionEffect: 6, outcome: '前向きな姿勢が伝わり、不安がやわらぎました。' },
        { label: '特に説明せず、既存の計画のままとする', opinionEffect: -15, outcome: '説明不足が続き、不満がさらに大きくなってしまいました。' }
      ]
    },
    endings: ENDINGS,
    summary: '災害からの復旧・復興では、内閣（行政）が迅速に体制を整えて実際に支援を行い、その対応が十分だったかを裁判所がチェックすることもあります。行政は法律を実行するだけでなく、人々のくらしを実際に支える大きな役割を担っています。'
  }
];

for (const file of ['data/sanken_cases.json', 'scripts/sanken_cases.json']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.push(...NEW_CASES);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(file, 'now has', data.length, 'cases');
}

// 検証
const data = JSON.parse(fs.readFileSync('data/sanken_cases.json', 'utf8'));
let problems = [];
data.forEach(c => {
  if (!c.id || !c.icon || !c.title || !c.intro || c.stages.length !== 3 || !c.trouble || !c.endings || !c.summary) problems.push(c.id + ': missing field');
  c.stages.forEach((s, i) => {
    if (s.options.length !== 4) problems.push(c.id + ' stage' + i + ': not 4 opts');
    s.options.forEach(o => { if (!o.label || !o.outcome || o.opinionEffect === undefined) problems.push(c.id + ' stage' + i + ': missing option field'); });
  });
  if (c.trouble.options.length !== 4) problems.push(c.id + ': trouble not 4 opts');
});
const ids = data.map(c => c.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
console.log('total cases:', data.length, 'problems:', problems.length);
problems.forEach(p => console.log(p));
