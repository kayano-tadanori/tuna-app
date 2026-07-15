// 身近な現象 第7弾：①対流（エアコン・暖房）②虫めがねの焦点 ③川の曲がり（浸食と堆積）
// ④日食・月食 ⑤雷までの距離（光ってから音まで）⑥氷がとけても水位は変わらない
// 図つき・答えはコード検算。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', BR = '#c9975b', GR = '#9aa5c8', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// ① 対流（冷房：冷たい空気は下へ、暖房：暖かい空気は上へ）
function figConvection() {
  // 部屋の箱
  let body = `<rect x="20" y="16" width="200" height="90" fill="none" stroke="${WT}" stroke-width="2"/>`;
  // エアコン
  body += `<rect x="28" y="22" width="44" height="14" rx="3" fill="${GR}"/>` + txt(50, 32, 'エアコン', '#1b1b2b', 7);
  // 冷たい空気は下へ（青い下向き→そして横へ）
  body += `<path d="M50 38 q-6 20 -6 40 q0 12 24 12" fill="none" stroke="${BL}" stroke-width="2" marker-end="url(#arB7)"/>`;
  body += txt(40, 70, 'つめたい空気', BL, 8, 'start') + txt(46, 82, '（下へ）', BL, 8, 'start');
  // 暖かい空気は上へ
  body += `<path d="M188 96 q6 -20 6 -40 q0 -12 -20 -12" fill="none" stroke="${RD}" stroke-width="2" marker-end="url(#arR7)"/>`;
  body += txt(200, 74, 'あたたかい', RD, 8, 'end') + txt(200, 86, '空気は上へ', RD, 8, 'end');
  const defs = `<defs><marker id="arB7" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="${BL}"/></marker><marker id="arR7" markerWidth="7" markerHeight="7" refX="4" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="${RD}"/></marker></defs>`;
  return S('240 120', defs + body);
}

// ② 虫めがね（凸レンズ）で日光を集める → 焦点
function figLens() {
  let body = '';
  // 平行光線（太陽光）
  [30, 44, 58].forEach(y => body += `<line x1="10" y1="${y}" x2="110" y2="${y}" stroke="${YE}" stroke-width="1.5"/>`);
  // レンズ
  body += `<ellipse cx="110" cy="44" rx="10" ry="30" fill="${BL}" opacity="0.35" stroke="${BL}" stroke-width="1.5"/>`;
  // 屈折して1点（焦点）へ
  [30, 44, 58].forEach(y => body += `<line x1="110" y1="${y}" x2="190" y2="44" stroke="${YE}" stroke-width="1.5"/>`);
  // 焦点で光が集まって熱く
  body += `<circle cx="190" cy="44" r="5" fill="${RD}"/>` + `<circle cx="190" cy="44" r="9" fill="none" stroke="${OR}" stroke-width="1"/>`;
  body += txt(190, 30, '焦点（熱い！）', RD, 8);
  body += txt(60, 20, '日光（平行な光）', YE, 8);
  return S('240 84', body);
}

// ③ 川の曲がり：外側はけずられ（浸食）、内側は積もる（堆積）
function figRiverBend() {
  // 川（曲がった帯）
  let body = `<path d="M20 20 Q140 20 140 60 Q140 100 220 100 L220 78 Q160 78 160 60 Q160 42 20 42 Z" fill="${SEA}" opacity="0.4" stroke="${BL}" stroke-width="1"/>`;
  // 外側（曲がりの外＝速い・けずる）矢印
  body += `<circle cx="150" cy="60" r="4" fill="${RD}"/>` + txt(178, 48, '外側：速い→けずる', RD, 8, 'start');
  body += txt(150, 40, '（がけ）', RD, 8, 'start');
  // 内側（おそい・積もる）
  body += `<circle cx="128" cy="60" r="4" fill="${YE}"/>` + txt(60, 92, '内側：おそい→積もる（川原）', YE, 8, 'start');
  body += txt(30, 34, '川の流れ →', WT, 8, 'start');
  return S('240 116', body);
}

// ④ 日食・月食（太陽－地球－月の並び）
function figEclipse() {
  // 日食：太陽 — 月 — 地球（月が真ん中）
  let body = `<circle cx="24" cy="30" r="12" fill="${YE}"/>` + txt(24, 52, '太陽', YE, 8);
  body += `<circle cx="90" cy="30" r="5" fill="${GR}"/>` + txt(90, 48, '月', WT, 8);
  body += `<circle cx="150" cy="30" r="9" fill="${BL}"/>` + txt(150, 50, '地球', BL, 8);
  // 影
  body += `<polygon points="102,26 148,26 148,34 102,34" fill="${GR}" opacity="0.3"/>`;
  body += txt(120, 14, '日食：太陽－月－地球', WT, 9);
  // 月食：太陽 — 地球 — 月（地球が真ん中、地球の影に月）
  const y2 = 80;
  body += `<circle cx="24" cy="${y2}" r="12" fill="${YE}"/>` + txt(24, y2 + 22, '太陽', YE, 8);
  body += `<circle cx="110" cy="${y2}" r="9" fill="${BL}"/>` + txt(110, y2 + 20, '地球', BL, 8);
  body += `<circle cx="185" cy="${y2}" r="6" fill="${RD}" opacity="0.5"/>` + txt(185, y2 + 20, '月（影の中）', RD, 8);
  body += `<polygon points="119,${y2 - 5} 185,${y2 - 7} 185,${y2 + 7} 119,${y2 + 5}" fill="${GR}" opacity="0.3"/>`;
  body += txt(120, y2 - 18, '月食：太陽－地球－月', WT, 9);
  return S('240 112', body);
}

// ⑤ 雷までの距離（ピカッと光ってから音まで）
function figThunder() {
  // 雲と雷
  let body = `<ellipse cx="50" cy="26" rx="30" ry="12" fill="${GR}" opacity="0.6"/>`;
  body += `<polygon points="46,34 40,52 50,50 44,70 62,44 52,46 58,34" fill="${YE}"/>`;
  // 音の輪
  [0, 1, 2].forEach(i => body += `<path d="M96 40 A${18 + i * 16} ${18 + i * 16} 0 0 1 96 76" fill="none" stroke="${RD}" stroke-width="1.5" opacity="${0.8 - i * 0.2}"/>`);
  // 人
  body += `<circle cx="200" cy="52" r="6" fill="${WT}"/><line x1="200" y1="58" x2="200" y2="74" stroke="${WT}" stroke-width="2"/>` + txt(200, 90, 'きみ', WT, 8);
  body += `<line x1="14" y1="90" x2="230" y2="90" stroke="${WT}" stroke-width="1"/>`;
  body += txt(120, 16, '光は一瞬・音は1秒に約340m進む', WT, 9);
  return S('240 100', body);
}

// ⑥ 氷がとけても水位は変わらない（浮いた氷）
function figIceLevel() {
  // コップ
  let body = `<path d="M60 20 L70 100 L170 100 L180 20" fill="none" stroke="${WT}" stroke-width="2"/>`;
  // 水面
  body += `<line x1="63" y1="40" x2="177" y2="40" stroke="${BL}" stroke-width="1.5" stroke-dasharray="4 3"/>` + txt(120, 34, '水面（変わらない）', BL, 8);
  // 水
  body += `<path d="M64 40 L70 100 L170 100 L176 40 Z" fill="${SEA}" opacity="0.35"/>`;
  // 浮いた氷（一部が水面上）
  body += `<polygon points="100,26 140,26 146,52 94,52" fill="${WT}" opacity="0.6" stroke="${WT}" stroke-width="1"/>` + txt(120, 44, '氷', '#1b1b2b', 9);
  body += txt(120, 116, 'とけても水位は変わらない', YE, 9);
  return S('240 128', body);
}

function addTo(file, prefix, item) {
  const FILE = path.join(__dirname, '..', 'data', file + '.json');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const maxId = Math.max(...data.map(q => Number(String(q.id).replace(/\D/g, '')) || 0));
  item.id = prefix + String(maxId + 1).padStart(3, '0');
  item.answer = String(item.answer);
  data.push(item);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}
const ch = (ans, arr) => [...new Set([String(ans), ...arr.map(String)])].slice(0, 4);

// ① 対流（もの・rm）
addTo('rika_mono', 'rm', { question: 'エアコンで部屋を「冷やす」とき、冷たい風の吹き出し口は上と下、どちらに向けると部屋全体が早く涼しくなりますか？', answer: '上（水平ぎみ）に向ける', choices: ['上（水平ぎみ）に向ける', '真下に向ける', '向きは関係ない', 'まどに向ける'], meaning: '冷たい空気は重くて下へさがります。だから吹き出し口を上向きにすると、冷気が上から下へ回って部屋全体が早く冷えます。暖房のときは逆に下向きが正解です。', grade: 5, difficulty: 3, svg: figConvection() });
addTo('rika_mono', 'rm', { question: 'ストーブで部屋を暖めると、天井近くと床近くではどちらが先にあたたかくなりますか？', answer: '天井近く', choices: ['天井近く', '床近く', '同時', 'どちらも変わらない'], meaning: 'あたためられた空気は軽くなって上へ動きます（対流）。だから天井近くから先にあたたまり、足もとは冷えたまま。サーキュレーターで空気をまぜると効率よく暖まります。', grade: 5, difficulty: 3, svg: figConvection() });
addTo('rika_mono', 'rm', { question: 'みそ汁をおわんに入れておくと、湯気とともにみそがゆっくり動いて回るのが見えます。これと同じ、あたたかい液体や空気が動いて熱を運ぶ現象を何といいますか？', answer: '対流（たいりゅう）', choices: ['対流（たいりゅう）', '伝導（でんどう）', '放射（ほうしゃ）', '蒸発（じょうはつ）'], meaning: 'あたためられた部分が軽くなって上がり、冷えた部分が下がる。この液体や気体の動きで熱が運ばれる伝わり方を「対流」といいます。金属を伝わるのは「伝導」、太陽の熱は「放射」です。', grade: 5, difficulty: 3, svg: figConvection() });

// ② 虫めがね（光と音・ho）
addTo('rika_hikarioto', 'ho', { question: '虫めがね（凸レンズ）で日光を黒い紙に集めると、明るい点はどんどん小さくなり、やがて紙がこげます。光が最も小さく集まる点を何といいますか？', answer: '焦点（しょうてん）', choices: ['焦点（しょうてん）', '原点', '中心点', '交点'], meaning: '凸レンズは平行な日光を1点に集めます。この点を「焦点」といい、光（と熱）が集中するので紙をこがすほど熱くなります。', grade: 5, difficulty: 3, svg: figLens() });
addTo('rika_hikarioto', 'ho', { question: '虫めがねで日光を集めて紙をこがすとき、いちばん早くこげるのはどんなときですか？', answer: '明るい点がいちばん小さくなるように高さを合わせたとき', choices: ['明るい点がいちばん小さくなるように高さを合わせたとき', '明るい点を大きく広げたとき', 'くもりの日', 'レンズを紙にぴったりつけたとき'], meaning: '点が小さいほど同じ量の光がせまい所に集まり、熱が集中します。焦点の位置（点が最も小さくなる高さ）に紙を置くといちばん早くこげます。', grade: 5, difficulty: 3, svg: figLens() });

// ③ 川の曲がり（大地・rg）
addTo('rika_daichi', 'rg', { question: '川が曲がって流れているところでは、曲がりの「外側」と「内側」で流れの速さがちがいます。速くて岸をけずるのはどちらですか？', answer: '外側', choices: ['外側', '内側', '同じ', '真ん中だけ'], meaning: '曲がりの外側は流れが速く、岸を強くけずって「がけ」になります。内側は流れがおそく、運ばれた砂や石が積もって「川原」ができます。', grade: 5, difficulty: 3, svg: figRiverBend() });
addTo('rika_daichi', 'rg', { question: '川の曲がったところの「内側」に、砂や小石が積もって川原ができるのはなぜですか？', answer: '流れがおそく、運ぶ力が弱いから', choices: ['流れがおそく、運ぶ力が弱いから', '流れが速いから', '水が深いから', '風が強いから'], meaning: '内側は流れがおそいので、水が運んできた砂や石を運びきれずに置いていきます（堆積）。だから内側に川原ができ、外側はけずられてがけになります。', grade: 5, difficulty: 3, svg: figRiverBend() });
addTo('rika_daichi', 'rg', { question: '山の中の川は谷が深く「V字」の形に、平地に出ると「三角州（さんかくす）」ができます。三角州ができるおもなはたらきはどれですか？', answer: 'たい積（積もる）', choices: ['たい積（積もる）', 'しん食（けずる）', '運ぱん（運ぶ）', 'じょう発'], meaning: '川が海や平地に出ると流れがおそくなり、運んできた土砂を積もらせます（堆積）。この土砂が河口に積もってできる平らな地形が三角州です。山では流れが速く、けずるはたらき（浸食）でV字谷ができます。', grade: 5, difficulty: 3, svg: figRiverBend() });

// ④ 日食・月食（空・rk）
addTo('rika_sora', 'rk', { question: '太陽が月にかくされて欠けて見える「日食」のとき、太陽・月・地球はどの順に一直線に並んでいますか？', answer: '太陽－月－地球', choices: ['太陽－月－地球', '太陽－地球－月', '月－太陽－地球', '地球－太陽－月'], meaning: '日食は「太陽－月－地球」の順に並び、月が太陽をかくすときに起こります。月が真ん中に入って太陽をさえぎるので、昼間に太陽が欠けて見えます。', grade: 6, difficulty: 4, svg: figEclipse() });
addTo('rika_sora', 'rk', { question: '満月が地球の影に入って暗くなる「月食」のとき、太陽・地球・月はどの順に並んでいますか？', answer: '太陽－地球－月', choices: ['太陽－地球－月', '太陽－月－地球', '地球－太陽－月', '月－地球－太陽'], meaning: '月食は「太陽－地球－月」の順に並び、地球の影の中に月が入るときに起こります。だから月食は必ず満月のときに起こります。', grade: 6, difficulty: 4, svg: figEclipse() });

// ⑤ 雷までの距離（光と音・ho）— 音340m/s、光は一瞬
addTo('rika_hikarioto', 'ho', { question: 'かみなりが「ピカッ」と光ってから「ゴロゴロ」と音が聞こえるまで、少し時間があくのはなぜですか？', answer: '光は一瞬で届くが、音は伝わるのに時間がかかるから', choices: ['光は一瞬で届くが、音は伝わるのに時間がかかるから', '音のほうが速いから', '光がおそいから', '耳がおくれて聞くから'], meaning: '光は1秒に約30万kmでほぼ一瞬に届きますが、音は1秒に約340mとゆっくり。だから遠いかみなりほど、光ってから音までの時間が長くなります。', grade: 5, difficulty: 3, svg: figThunder() });
[[3, 1020], [5, 1700], [2, 680], [10, 3400]].forEach(([t, d]) => {
  addTo('rika_hikarioto', 'ho', { question: `かみなりがピカッと光ってから${t}秒後にゴロゴロと音が聞こえました。音の速さを毎秒340mとすると、かみなりまでのきょりは約何mですか？`, answer: d, choices: ch(d, [340 * (t + 1), Math.round(340 * t / 2), d + 340, 340]), meaning: `光はほぼ一瞬で届くので、音が${t}秒かけて進んだきょり＝340×${t}＝${d}m。光ってから音までの秒数を数えると、かみなりまでのおよそのきょりがわかります。`, grade: 5, difficulty: 3, svg: figThunder() });
});

// ⑥ 氷がとけても水位は変わらない（力・rc）
addTo('rika_chikara', 'rc', { question: 'コップの水に氷を浮かべ、氷が全部とけたあと、水面の高さはどうなりますか？', answer: '変わらない', choices: ['変わらない', '上がってあふれる', '下がる', '半分になる'], meaning: '浮いた氷は「自分がおしのけた水の重さ」と同じ重さぶんだけ沈んでいます。とけると氷は同じ重さの水になり、ちょうどおしのけていた分をうめるので、水面の高さは変わりません。', grade: 6, difficulty: 4, svg: figIceLevel() });
addTo('rika_chikara', 'rc', { question: 'コップの水に浮いた氷は、全体の体積のうち水面から出ている部分はごく一部です。氷がおしのけている水の重さは、氷全体の重さと比べてどうなっていますか？', answer: '等しい（同じ）', choices: ['等しい（同じ）', '氷のほうが重い', '氷のほうが軽い', '関係ない'], meaning: '物が浮いて静止しているとき、おしのけた水の重さ（浮力）と物の重さはつり合っています。だから氷がおしのけた水の重さ＝氷の重さ。とけても水位が変わらないのはこのためです。', grade: 6, difficulty: 4, svg: figIceLevel() });

console.log('身近な現象 第7弾（対流・虫めがね・川の曲がり・日食月食・雷の距離・氷と水位）を追加しました。');
