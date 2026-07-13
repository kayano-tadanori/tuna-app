// はかせの図鑑：光・音の性質（新カテゴリ）＋ 天球のしくみ（seizaに追加）を新規追加
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'rika_science.json');
const data = require(FILE);

const NEW_CARDS = [
  {
    id: 'sci_hikari_oto_01',
    category: 'hikari_oto',
    title: '光の反射と屈折',
    body: "<p>光はまっすぐ進む性質（直進）がありますが、ものに当たったり、ちがう物質に入ったりすると、進み方が変わります。</p><svg viewBox='0 0 240 140' style='display:block;margin:0 auto;max-width:240px'><line x1='10' y1='120' x2='230' y2='120' stroke='#eef2ff' stroke-width='2'/><line x1='120' y1='120' x2='120' y2='10' stroke='#eef2ff' stroke-width='1' stroke-dasharray='3,3'/><line x1='40' y1='30' x2='120' y2='120' stroke='#ffd166' stroke-width='2'/><line x1='120' y1='120' x2='200' y2='30' stroke='#ff6b6b' stroke-width='2'/><text x='55' y='25' font-family='sans-serif' font-size='11' fill='#ffd166'>入射光</text><text x='170' y='25' font-family='sans-serif' font-size='11' fill='#ff6b6b'>反射光</text><text x='125' y='45' font-family='sans-serif' font-size='10' fill='#eef2ff'>法線</text></svg><p><strong>反射の法則</strong>：光が鏡などに当たってはね返るとき、「入射角」と「反射角」は必ず<strong>同じ大きさ</strong>になります（角度は、当たる面ではなく面に垂直な線＝法線からはかります）。</p><p><strong>屈折</strong>：光が空気から水やガラスなど、ちがう物質に進むとき、境目で進む向きが折れ曲がります。これを屈折といいます。水の中のストローが曲がって見えたり、プールの底が実際より浅く見えたりするのは、この屈折が原因です。光は密度の大きい物質（水やガラス）に入るとき、法線に近づくように曲がります。</p><table><tr><th>現象</th><th>光のようす</th></tr><tr><td>反射</td><td>入射角＝反射角で、はね返る</td></tr><tr><td>屈折</td><td>物質の境目で進む向きが折れ曲がる</td></tr></table>"
  },
  {
    id: 'sci_hikari_oto_02',
    category: 'hikari_oto',
    title: '光の三原色と色の見え方',
    body: "<p>光の色のもとになる赤・緑・青の3色を「光の三原色」といいます。絵の具の三原色とはちがい、光は<strong>混ぜるほど明るく</strong>なり、3色すべてを重ねると白色になります。</p><svg viewBox='0 0 200 180' style='display:block;margin:0 auto;max-width:200px'><circle cx='85' cy='75' r='45' fill='#ff6b6b' opacity='0.7'/><circle cx='115' cy='75' r='45' fill='#4dd0e1' opacity='0.7'/><circle cx='100' cy='115' r='45' fill='#ffd166' opacity='0.7'/><text x='55' y='45' font-family='sans-serif' font-size='11' fill='#eef2ff'>赤</text><text x='140' y='45' font-family='sans-serif' font-size='11' fill='#eef2ff'>青</text><text x='100' y='165' font-family='sans-serif' font-size='11' fill='#eef2ff'>緑</text></svg><p><strong>色の組み合わせ</strong>：赤＋青＝赤紫（マゼンタ）、赤＋緑＝黄、青＋緑＝青緑（シアン）、赤＋緑＋青＝白</p><p><strong>ものの色が見える理由</strong>：太陽の光（白色光）には、いろいろな色の光が混ざっています。ものに光が当たると、そのものは一部の色の光を<strong>吸収</strong>し、残りの色の光を<strong>反射</strong>します。目に届いた反射光の色が、そのものの色として見えます。たとえば植物の葉が緑色に見えるのは、赤色や青色の光を吸収し、緑色の光を反射しているからです。</p><p><strong>例</strong>：赤色の光だけを当てた部屋で、青色の服を見ると、青は赤色の光をほとんど反射できないため、黒っぽく見えます。</p>"
  },
  {
    id: 'sci_hikari_oto_03',
    category: 'hikari_oto',
    title: 'とつレンズと虫めがね',
    body: "<p>虫めがねに使われているのは「とつレンズ」で、中心が厚く、ふちが薄いレンズです。とつレンズには、光を1点に集める性質があります。</p><svg viewBox='0 0 240 120' style='display:block;margin:0 auto;max-width:240px'><ellipse cx='120' cy='60' rx='14' ry='45' fill='none' stroke='#eef2ff' stroke-width='2'/><line x1='10' y1='30' x2='230' y2='90' stroke='#ffd166' stroke-width='1.5'/><line x1='10' y1='60' x2='230' y2='60' stroke='#ffd166' stroke-width='1.5'/><line x1='10' y1='90' x2='230' y2='30' stroke='#ffd166' stroke-width='1.5'/><circle cx='190' cy='60' r='3' fill='#ff6b6b'/><text x='195' y='50' font-family='sans-serif' font-size='11' fill='#ff6b6b'>焦点</text></svg><p>レンズの中心から、光が1点に集まる点までのきょりを「<strong>焦点きょり</strong>」といいます。とつレンズを使うと、日光を集めて黒い紙をこがすことができます（このとき光が集まる点が焦点です）。</p><p><strong>虫めがねで見える像</strong>：見るものを焦点より内側（レンズに近い位置）に置くと、実物より大きい「正立の虚像」が見えます。ものをレンズから遠ざけて焦点の外側に置くと、上下左右が逆さまの「倒立の実像」がスクリーンにうつるようになります。</p><p><strong>ピンホールカメラ</strong>：小さな穴（ピンホール）を通った光は直進するので、穴の向こう側のスクリーンには、上下左右が逆さまの像がうつります。これは光の直進性を利用したものです。</p>"
  },
  {
    id: 'sci_hikari_oto_04',
    category: 'hikari_oto',
    title: '音の伝わり方と音の3要素',
    body: "<p>音は、ものが<strong>ふるえる（振動する）</strong>ことで発生し、空気などの物質を次々にふるわせながら伝わっていきます。空気のような気体だけでなく、水などの液体、金属などの固体の中でも音は伝わります。伝わる速さは、一般に<strong>固体＞液体＞気体</strong>の順に速くなります。ただし、空気のない真空中では、音を伝えるものがないため、音は伝わりません。</p><p><strong>音の3要素</strong></p><table><tr><th>要素</th><th>決まるもの</th></tr><tr><td>大きさ（強弱）</td><td>ふるえの振れ幅（振幅）の大小</td></tr><tr><td>高さ</td><td>1秒間にふるえる回数（振動数）の多少</td></tr><tr><td>音色</td><td>ふるえ方のちがい（波形のちがい）</td></tr></table><svg viewBox='0 0 220 90' style='display:block;margin:0 auto;max-width:220px'><line x1='10' y1='45' x2='210' y2='45' stroke='#444' stroke-width='1'/><path d='M10,45 Q30,10 50,45 T90,45 T130,45 T170,45 T210,45' fill='none' stroke='#ffd166' stroke-width='2'/><text x='30' y='65' font-family='sans-serif' font-size='10' fill='#eef2ff'>ふるえ（振動）</text></svg><p><strong>モノコード実験</strong>：弦を張った実験器具で、弦が<strong>短い・細い・強く張る</strong>ほど、音は高くなります。逆に弦が<strong>長い・太い・ゆるい</strong>ほど、音は低くなります。</p>"
  },
  {
    id: 'sci_hikari_oto_05',
    category: 'hikari_oto',
    title: '音の速さの計算（やまびこ・かみなり）',
    body: "<p>空気中を伝わる音の速さは、気温によって変わりますが、中学受験では<strong>秒速約340m</strong>（または問題文で指定された値）として計算することが多いです。</p><p><strong>基本の式</strong></p><table><tr><td>きょり（m）＝音の速さ（m/秒）×時間（秒）</td></tr></table><p><strong>かみなりまでのきょり</strong>：光は一瞬で届くとみなせるので、光ってから音が聞こえるまでの時間を測れば、かみなりまでのきょりが分かります。たとえば音が聞こえるまで6秒かかった場合、音の速さを秒速340mとすると、きょりは340×6＝2040mです。</p><p><strong>やまびこ（こだま）</strong>：音が山やがけに当たってはね返ってくる現象です。音は「行き」と「帰り」で同じきょりを2回進むため、聞こえるまでの時間から山までのきょりを求めるときは、<strong>音の速さ×時間÷2</strong>で計算します。</p><p><strong>例題</strong>：がけに向かって音を出したところ、4秒後にやまびこが聞こえました。音の速さを秒速340mとすると、がけまでのきょりは340×4÷2＝<strong>680m</strong>です。</p><p><strong>風の影響</strong>：音が風にのって進むときは、風上に進む音は遅く、風下に進む音は速く伝わります。風がある場合の音の速さは「音そのものの速さ±風の速さ」で計算します。</p>"
  }
];

const NEW_SEIZA = [
  {
    id: 'sci_seiza_11',
    category: 'seiza',
    title: '天球のしくみ（天の北極・天の赤道）',
    body: "<p>星や太陽は、実際にはさまざまなきょりにありますが、地球からは、まるで同じ大きな球体の内側にはりついているように見えます。この見かけ上の球を「<strong>天球</strong>」といいます。</p><svg viewBox='0 0 200 200' style='display:block;margin:0 auto;max-width:200px'><circle cx='100' cy='100' r='85' fill='none' stroke='#eef2ff' stroke-width='1.5'/><line x1='100' y1='15' x2='100' y2='185' stroke='#ffd166' stroke-width='1.5'/><ellipse cx='100' cy='100' rx='85' ry='20' fill='none' stroke='#4dd0e1' stroke-width='1.5'/><circle cx='100' cy='15' r='3' fill='#ff6b6b'/><text x='108' y='18' font-family='sans-serif' font-size='10' fill='#ff6b6b'>天の北極</text><circle cx='100' cy='185' r='3' fill='#ff6b6b'/><text x='60' y='198' font-family='sans-serif' font-size='10' fill='#ff6b6b'>天の南極</text><text x='140' y='95' font-family='sans-serif' font-size='10' fill='#4dd0e1'>天の赤道</text></svg><p>地球の地じくをそのまま北と南にのばして天球にぶつかった点を、それぞれ「<strong>天の北極</strong>」「<strong>天の南極</strong>」といいます。北極星は、天の北極のすぐ近くにあるため、1日じゅうほとんど位置が動かないように見えます。</p><p>地球の赤道をそのまま広げて天球にぶつかる大きな円を「<strong>天の赤道</strong>」といいます。</p><p><strong>北極星の高度と緯度の関係</strong>：北極星が見える高さ（高度）は、観測地の<strong>緯度と等しく</strong>なります。たとえば北緯35度の地点では、北極星はほぼ高度35度の位置に見えます。これは、天の北極が地じくの延長線上にあり、観測地の緯度によって地平線からの見上げる角度が変わるためです。</p><p>星座早見盤は、この天球の考え方をもとに、観測地・時刻・月日を合わせることで、そのときどきに見える星座を表せるようになっています。</p>"
  }
];

data.push(...NEW_CARDS, ...NEW_SEIZA);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(FILE, 'now has', data.length, 'cards');

// 検証
let problems = [];
const ids = data.map(c => c.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
data.forEach(c => {
  if (!c.id || !c.category || !c.title || !c.body) problems.push(c.id + ': missing field');
});
console.log('problems:', problems.length);
problems.forEach(p => console.log(p));
