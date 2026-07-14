// はかせの図鑑に「天気・気象」「人体のしくみ」の解説記事を追加する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_science.json');
const data = require(FILE);

const NEW = [
  // ───────── 天気・気象 ─────────
  {
    id: 'sci_tenki_01', category: 'tenki', title: '雲と天気の変化',
    body: "<p>空をおおう雲の量で天気が決まります。空全体を10としたとき、雲の量が<strong>0〜8なら「晴れ」</strong>（0〜1は快晴）、<strong>9〜10なら「くもり」</strong>です。雨や雪がふっていれば、雲の量に関係なく「雨」「雪」となります。</p><svg viewBox='0 0 240 90' style='display:block;margin:6px auto;max-width:240px'><path d='M40,55 q-14,0 -14,-14 q0,-14 16,-12 q4,-14 20,-10 q16,-8 20,10 q14,-2 12,12 q0,14 -14,14 Z' fill='#eef2ff' opacity='0.85'/><circle cx='185' cy='40' r='16' fill='#ffd166'/><g stroke='#ffd166' stroke-width='2'><line x1='185' y1='12' x2='185' y2='20'/><line x1='185' y1='60' x2='185' y2='68'/><line x1='157' y1='40' x2='165' y2='40'/><line x1='205' y1='40' x2='213' y2='40'/></g></svg><p><strong>雲のおもな種類</strong></p><table><tr><th>雲</th><th>とくちょう</th></tr><tr><td>積乱雲（入道雲）</td><td>夏に高くもり上がり、強い雨・かみなり・ひょうをふらせる</td></tr><tr><td>乱層雲（雨雲）</td><td>空一面に広がり、長く雨や雪をふらせる</td></tr><tr><td>巻雲（すじ雲）</td><td>高い空にできる白いすじ状の雲。天気が変わる前ぶれ</td></tr></table><p><strong>天気の移り変わり</strong>：日本の上空には強い西風（偏西風）がふいているため、雲や雨の区域は<strong>西から東へ</strong>移動します。そのため天気も西の地方から順に変わっていきます。夕焼けの次の日が晴れやすいのは、西の空が晴れているためです。</p>"
  },
  {
    id: 'sci_tenki_02', category: 'tenki', title: '前線と天気',
    body: "<p>あたたかい空気（暖気）と冷たい空気（寒気）がぶつかる境目を<strong>前線</strong>といいます。前線の近くでは雲ができやすく、天気が悪くなります。</p><svg viewBox='0 0 240 70' style='display:block;margin:6px auto;max-width:240px'><line x1='20' y1='40' x2='220' y2='40' stroke='#eef2ff' stroke-width='2'/><polygon points='60,40 68,28 76,40' fill='#4f7cff'/><polygon points='90,40 98,28 106,40' fill='#4f7cff'/><path d='M140,40 a8,8 0 0 1 16,0' fill='none' stroke='#ff6b6b' stroke-width='2'/><path d='M165,40 a8,8 0 0 1 16,0' fill='none' stroke='#ff6b6b' stroke-width='2'/><text x='70' y='58' font-size='9' fill='#4f7cff' text-anchor='middle'>寒冷前線</text><text x='162' y='58' font-size='9' fill='#ff6b6b' text-anchor='middle'>温暖前線</text></svg><table><tr><th>前線</th><th>天気のようす</th></tr><tr><td>寒冷前線</td><td>寒気が暖気の下にもぐりこむ。積乱雲ができ、せまい範囲で強い雨が短時間。通過後は気温が下がる</td></tr><tr><td>温暖前線</td><td>暖気が寒気の上にはい上がる。乱層雲ができ、広い範囲でおだやかな雨が長時間。通過後は気温が上がる</td></tr><tr><td>停滞前線</td><td>暖気と寒気の力がつり合って動かない。梅雨（つゆ）や秋雨の長雨の原因</td></tr></table>"
  },
  {
    id: 'sci_tenki_03', category: 'tenki', title: '台風のしくみ',
    body: "<p><strong>台風</strong>は、あたたかい南の海の上で発生した熱帯低気圧が発達したものです。強い風と大量の雨をもたらします。</p><svg viewBox='0 0 200 120' style='display:block;margin:6px auto;max-width:200px'><g fill='none' stroke='#4dd0e1' stroke-width='3'><path d='M100,60 q-30,-40 -55,-10 q-20,25 20,30'/><path d='M100,60 q30,40 55,10 q20,-25 -20,-30'/></g><circle cx='100' cy='60' r='8' fill='none' stroke='#eef2ff' stroke-width='2'/><text x='100' y='63' font-size='7' fill='#eef2ff' text-anchor='middle'>目</text></svg><ul><li>中心には「<strong>台風の目</strong>」があり、そこは風が弱く雲も少ない。</li><li>風は中心に向かって<strong>反時計回り</strong>にふきこむ。</li><li>日本には夏〜秋（とくに8〜9月）に、南の海上から北上して近づく。</li><li>進行方向の<strong>右側</strong>は、台風自身の風と台風を動かす風が同じ向きになるため、風が特に強くなる。</li></ul><p>気圧が低いほど台風は強く、中心の気圧が低い台風ほど風が強くなります。</p>"
  },
  {
    id: 'sci_tenki_04', category: 'tenki', title: '気温と湿度のはかり方',
    body: "<p><strong>気温</strong>は、風通しのよい日かげで、地面から1.2〜1.5mの高さではかります。この条件を整えた白い箱を<strong>百葉箱（ひゃくようばこ）</strong>といいます。とびらが北向きなのは、開けたときに日光が直接入らないようにするためです。白くぬってあるのは日光の熱を反射するためです。</p><svg viewBox='0 0 240 110' style='display:block;margin:6px auto;max-width:220px'><line x1='20' y1='95' x2='220' y2='95' stroke='#eef2ff' stroke-width='1.5'/><line x1='30' y1='30' x2='30' y2='95' stroke='#eef2ff' stroke-width='1'/><line x1='30' y1='30' x2='210' y2='30' stroke='#ffd166' stroke-width='1' stroke-dasharray='3,3'/><polyline points='30,80 60,70 90,45 120,38 150,42 180,55 210,72' fill='none' stroke='#ffd166' stroke-width='2'/><text x='120' y='108' font-size='9' fill='#eef2ff' text-anchor='middle'>1日の気温の変化</text></svg><p><strong>1日の気温</strong>は、太陽が最も高くなる正午よりおくれて<strong>午後2時ごろ</strong>に最高になります（地面があたたまってから空気があたたまるため）。最低は日の出のころです。</p><p><strong>湿度</strong>は空気のしめり具合で、乾湿計（かんしつけい）ではかります。かわいた温度計とぬれた温度計の差が大きいほど、湿度は低い（かんそうしている）ことを表します。</p>"
  },
  // ───────── 人体のしくみ ─────────
  {
    id: 'sci_jintai_01', category: 'jintai', title: '消化と吸収',
    body: "<p>食べ物を、体に吸収できる小さな養分に変えるはたらきを<strong>消化</strong>といいます。口→食道→胃→小腸→大腸と続く1本の管を<strong>消化管</strong>といいます。</p><svg viewBox='0 0 160 150' style='display:block;margin:6px auto;max-width:150px'><ellipse cx='80' cy='20' rx='14' ry='10' fill='none' stroke='#eef2ff' stroke-width='1.5'/><text x='100' y='23' font-size='8' fill='#eef2ff'>口</text><line x1='80' y1='30' x2='80' y2='50' stroke='#eef2ff' stroke-width='2'/><path d='M80,50 q22,4 14,26 q-6,14 -20,8' fill='none' stroke='#ffd166' stroke-width='2'/><text x='100' y='62' font-size='8' fill='#ffd166'>胃</text><path d='M74,84 q-18,10 -6,26 q14,16 30,4 q10,-10 0,-20' fill='none' stroke='#ff6b6b' stroke-width='2'/><text x='104' y='104' font-size='8' fill='#ff6b6b'>小腸</text></svg><p><strong>消化液</strong>：だ液（口）、胃液（胃）、たん液（かん臓でつくられ胆のうにためる）、すい液（すい臓）、腸液（小腸）などがあり、それぞれ養分を分解します。だ液はデンプンを、胃液はタンパク質を消化します。</p><p><strong>吸収</strong>：消化された養分は、おもに<strong>小腸</strong>のかべから吸収されます。小腸の内側には<strong>柔毛（じゅうもう）</strong>という小さな突起がびっしりあり、表面積を大きくして効率よく養分を吸収します。水分はおもに大腸で吸収され、残りが便になります。</p>"
  },
  {
    id: 'sci_jintai_02', category: 'jintai', title: '呼吸のしくみ',
    body: "<p><strong>呼吸</strong>は、空気中の酸素を取り入れ、二酸化炭素を出すはたらきです。鼻や口から入った空気は、気管を通り、左右の<strong>肺</strong>に入ります。</p><svg viewBox='0 0 160 130' style='display:block;margin:6px auto;max-width:150px'><line x1='80' y1='15' x2='80' y2='50' stroke='#eef2ff' stroke-width='3'/><text x='86' y='30' font-size='8' fill='#eef2ff'>気管</text><path d='M80,50 q-30,0 -34,35 q-2,25 20,25 q16,0 14,-25 Z' fill='none' stroke='#ffd166' stroke-width='2'/><path d='M80,50 q30,0 34,35 q2,25 -20,25 q-16,0 -14,-25 Z' fill='none' stroke='#ffd166' stroke-width='2'/><text x='30' y='95' font-size='8' fill='#ffd166'>肺</text></svg><p>気管は肺の中で細かく枝分かれし、その先には<strong>肺ほう（はいほう）</strong>という小さなふくろがたくさんあります。ここで、空気中の酸素が血液に取りこまれ、血液中の二酸化炭素が空気中に出されます。肺ほうがたくさんあることで、気体を交かんする表面積が大きくなっています。</p><p>肺には筋肉がないので、自分でふくらむことはできません。ろっ骨と<strong>横かくまく（横隔膜）</strong>が動くことで、胸の中を広げたりせばめたりして空気を出し入れします。息を吸うとき横かくまくは下がり、はくときは上がります。</p>"
  },
  {
    id: 'sci_jintai_03', category: 'jintai', title: '血液の循環と心臓',
    body: "<p><strong>心臓</strong>は血液を全身に送り出すポンプで、休みなく縮んだりゆるんだりして動いています（はく動）。心臓は<strong>4つの部屋</strong>（右心房・右心室・左心房・左心室）に分かれています。</p><svg viewBox='0 0 160 120' style='display:block;margin:6px auto;max-width:150px'><rect x='45' y='30' width='70' height='70' rx='10' fill='none' stroke='#ff6b6b' stroke-width='2'/><line x1='80' y1='30' x2='80' y2='100' stroke='#eef2ff' stroke-width='1'/><line x1='45' y1='60' x2='115' y2='60' stroke='#eef2ff' stroke-width='1'/><text x='62' y='50' font-size='8' fill='#eef2ff' text-anchor='middle'>心房</text><text x='98' y='50' font-size='8' fill='#eef2ff' text-anchor='middle'>心房</text><text x='62' y='85' font-size='8' fill='#eef2ff' text-anchor='middle'>心室</text><text x='98' y='85' font-size='8' fill='#eef2ff' text-anchor='middle'>心室</text></svg><p><strong>血管</strong>には、心臓から送り出される血液が流れる<strong>動脈</strong>と、心臓へもどる血液が流れる<strong>静脈</strong>があります。動脈は厚くて丈夫、静脈には血液の逆流を防ぐ弁があります。</p><p><strong>2つの循環</strong></p><ul><li><strong>肺循環</strong>：心臓→肺→心臓。肺で酸素を受け取る。</li><li><strong>体循環</strong>：心臓→全身→心臓。全身に酸素と養分を届ける。</li></ul><p>酸素を多くふくむ血液を動脈血、二酸化炭素を多くふくむ血液を静脈血といいます。</p>"
  },
  {
    id: 'sci_jintai_04', category: 'jintai', title: '骨と筋肉',
    body: "<p>体をささえ、脳や内ぞうを守っているのが<strong>骨（ほね）</strong>です。大人の体には約200個の骨があります。骨と骨のつなぎ目で、曲げることができる部分を<strong>関節</strong>といいます。</p><svg viewBox='0 0 160 120' style='display:block;margin:6px auto;max-width:150px'><line x1='40' y1='30' x2='75' y2='60' stroke='#eef2ff' stroke-width='4'/><line x1='75' y1='60' x2='120' y2='75' stroke='#eef2ff' stroke-width='4'/><circle cx='75' cy='60' r='5' fill='none' stroke='#ffd166' stroke-width='2'/><text x='82' y='55' font-size='8' fill='#ffd166'>関節</text><path d='M42,35 q-8,15 28,28' fill='none' stroke='#ff6b6b' stroke-width='3'/><text x='30' y='60' font-size='8' fill='#ff6b6b'>筋肉</text></svg><p>体を動かすのは<strong>筋肉</strong>のはたらきです。筋肉は骨に両はしがつながっていて、<strong>縮む</strong>ことで骨を引っぱり、関節を曲げます。筋肉は縮むことはできますが、自分でのびることはできません。</p><p>そのため、うでを曲げるときは内側の筋肉が縮み、外側の筋肉がゆるみます。のばすときはその逆になります。このように、筋肉は<strong>2つが対になって</strong>反対のはたらきをすることで、関節を曲げたりのばしたりしています。</p>"
  }
];

data.push(...NEW);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
const cats = {};
data.forEach(c => cats[c.category] = (cats[c.category] || 0) + 1);
console.log('図鑑 記事数:', data.length, JSON.stringify(cats));
let problems = [];
const ids = data.map(c => c.id);
if (new Set(ids).size !== ids.length) problems.push('DUP IDS');
data.forEach(c => { if (!c.id || !c.category || !c.title || !c.body) problems.push(c.id); });
console.log('problems:', problems.length);
