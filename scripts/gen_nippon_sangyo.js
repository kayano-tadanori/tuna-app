// 「ニッポンのあゆみ」産業とくらしカテゴリのデータ生成スクリプト
const fs = require('fs');
const path = require('path');

const cards = [];

// ------------------------------------------------------------------
// 共通パーツ：簡略化した日本列島の帯（南西=九州 → 北東=北海道）
// 実際の地図の代わりに、位置関係だけを正しく示す模式図として使う
// ------------------------------------------------------------------
function japanBand(dots, opts) {
  opts = opts || {};
  const w = opts.w || 300;
  const h = opts.h || 220;
  const title = opts.title || '';
  let s = `<svg viewBox="0 0 ${w} ${h}" style="display:block;margin:0 auto;max-width:${w}px">`;
  s += `<rect x="0" y="0" width="${w}" height="${h}" fill="#dff0ff"/>`;
  if (title) s += `<text x="${w/2}" y="16" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#173a63">${title}</text>`;
  s += `<polygon points="20,190 60,200 110,160 160,120 210,90 260,50 292,38 282,16 232,42 190,72 138,104 88,144 38,172" fill="#eef7ea" stroke="#bcd9b0" stroke-width="2"/>`;
  dots.forEach(d => {
    s += `<circle cx="${d.x}" cy="${d.y}" r="5" fill="${d.color || '#b23a3a'}" stroke="#333" stroke-width="1"/>`;
    const anchor = d.anchor || 'middle';
    const dx = d.lx !== undefined ? d.lx : d.x;
    const dy = d.ly !== undefined ? d.ly : d.y - 9;
    s += `<text x="${dx}" y="${dy}" font-family="sans-serif" font-size="9.5" font-weight="bold" text-anchor="${anchor}" fill="#20406b">${d.label}</text>`;
  });
  s += `</svg>`;
  return s;
}

// ------------------------------------------------------------------
// 1. 米作りの一年
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_01',
  category: 'sangyo',
  title: '米作りの一年',
  body: `
<p>日本の食料生産の中心は米作りです。<strong>米作りは1年を通して決まった作業の流れ</strong>があり、この順番を覚えておくと入試のグラフ問題やならべかえ問題にも対応できます。</p>
<svg viewBox="0 0 300 130" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="130" fill="#fff8e1"/>
<rect x="10" y="45" width="55" height="34" rx="6" fill="#fff" stroke="#c9a227" stroke-width="2"/>
<rect x="80" y="45" width="55" height="34" rx="6" fill="#fff" stroke="#c9a227" stroke-width="2"/>
<rect x="150" y="45" width="55" height="34" rx="6" fill="#fff" stroke="#c9a227" stroke-width="2"/>
<rect x="220" y="45" width="70" height="34" rx="6" fill="#fff" stroke="#c9a227" stroke-width="2"/>
<text x="37" y="58" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">育苗</text>
<text x="37" y="71" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">（なわしろ）</text>
<text x="107" y="58" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">代かき</text>
<text x="107" y="71" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">田植え</text>
<text x="177" y="65" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">稲かり・水の管理</text>
<text x="255" y="58" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">稲かり</text>
<text x="255" y="71" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">だっこく・出荷</text>
<text x="37" y="100" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#1d6fbf">4月ごろ</text>
<text x="107" y="100" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#1d6fbf">5月ごろ</text>
<text x="177" y="100" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#1d6fbf">夏（水の管理）</text>
<text x="255" y="100" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#1d6fbf">9〜10月ごろ</text>
<path d="M67,62 L78,62" stroke="#c9a227" stroke-width="2" marker-end="url(#a1)"/>
<path d="M137,62 L148,62" stroke="#c9a227" stroke-width="2"/>
<path d="M207,62 L218,62" stroke="#c9a227" stroke-width="2"/>
<polygon points="76,58 76,66 82,62" fill="#c9a227"/>
<polygon points="146,58 146,66 152,62" fill="#c9a227"/>
<polygon points="216,58 216,66 222,62" fill="#c9a227"/>
</svg>
<ul>
<li><strong>育苗（なわしろ）</strong>：もみをまいて苗を育てる。</li>
<li><strong>代かき・田植え</strong>：田に水を入れて土をやわらかくし、苗を植える。</li>
<li><strong>水の管理・中干し</strong>：夏の間、根をじょうぶにするため一度田の水をぬく「中干し」を行う。</li>
<li><strong>稲かり・だっこく</strong>：秋に稲をかり、もみを穂からはずして出荷する。</li>
</ul>
<p>米作りのさかんな地域は、<strong>大きな川が運んだ土でできた平野</strong>に集中しています。夏に日照時間が長く、昼と夜の気温差が大きい地域ほど、あまみの強いおいしい米ができやすいのも特徴です。</p>
<svg viewBox="0 0 300 150" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="150" fill="#fff8e1"/>
<text x="150" y="16" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#7a5c00">米の生産量が多い道県と代表的な銘柄米</text>
<rect x="15" y="30" width="270" height="20" fill="#ffe9a8"/>
<text x="150" y="44" font-family="sans-serif" font-size="9" text-anchor="middle" fill="#333">新潟県（越後平野）… コシヒカリ</text>
<rect x="15" y="55" width="270" height="20" fill="#fff3cf"/>
<text x="150" y="69" font-family="sans-serif" font-size="9" text-anchor="middle" fill="#333">北海道（石狩平野・上川盆地）… ゆめぴりか</text>
<rect x="15" y="80" width="270" height="20" fill="#ffe9a8"/>
<text x="150" y="94" font-family="sans-serif" font-size="9" text-anchor="middle" fill="#333">秋田県（秋田平野）… あきたこまち</text>
<rect x="15" y="105" width="270" height="20" fill="#fff3cf"/>
<text x="150" y="119" font-family="sans-serif" font-size="9" text-anchor="middle" fill="#333">山形県（庄内平野）… はえぬき</text>
<rect x="15" y="130" width="270" height="15" fill="#ffe9a8"/>
<text x="150" y="141" font-family="sans-serif" font-size="8.5" text-anchor="middle" fill="#333">宮城県・岩手県（仙台平野など）… ひとめぼれ</text>
</svg>
<p>米が余るようになったことから、国は米の作付けを減らして他の作物への転作をすすめる政策（かつての「減反政策」）をとってきました。近年は品種改良によって、暑さに強い品種や、輸出向けのブランド米づくりもさかんになっています。</p>`
});

// ------------------------------------------------------------------
// 2. 促成栽培と抑制栽培
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_02',
  category: 'sangyo',
  title: '促成栽培と抑制栽培',
  body: `
<p>野菜や花を、ふつうの出荷時期とずらして育てる農業を覚えましょう。<strong>「なぜそうするのか」は、出荷量が少ない時期をねらって高い値段で売るため</strong>という理由が共通しています。</p>
<svg viewBox="0 0 300 150" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="150" fill="#eef7ea"/>
<text x="150" y="16" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#2f6b2f">出荷時期と値段の関係（イメージ）</text>
<line x1="30" y1="120" x2="280" y2="120" stroke="#333" stroke-width="1.5"/>
<line x1="30" y1="30" x2="30" y2="120" stroke="#333" stroke-width="1.5"/>
<text x="10" y="35" font-family="sans-serif" font-size="8" fill="#333">高</text>
<text x="10" y="122" font-family="sans-serif" font-size="8" fill="#333">安</text>
<text x="150" y="135" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">出荷時期（ふつうの産地の出荷が少ない時期）</text>
<path d="M40,110 Q90,60 140,55 T260,50" stroke="#b23a3a" stroke-width="2.5" fill="none"/>
<text x="235" y="42" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#b23a3a">値段が高くなる時期をねらう</text>
<rect x="50" y="90" width="55" height="18" fill="#ffd9a0"/>
<text x="77" y="102" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">出荷が多い時期</text>
</svg>
${japanBand([
  { x: 190, y: 108, label: '高知平野', lx: 190, ly: 122, color: '#b23a3a' },
  { x: 205, y: 130, label: '宮崎平野', lx: 205, ly: 145, color: '#b23a3a' },
  { x: 152, y: 58, label: '野辺山原（長野）', lx: 100, ly: 58, color: '#1d6fbf' },
  { x: 165, y: 70, label: '嬬恋村（群馬）', lx: 108, ly: 78, color: '#1d6fbf' },
  { x: 210, y: 90, label: '渥美半島（愛知）', lx: 250, ly: 100, color: '#8a4fbf' },
], { title: '促成栽培（赤）・抑制栽培（青）・電照栽培（紫）の産地' })}
<table>
<tr><th>栽培方法</th><th>特徴</th><th>代表的な産地</th><th>主な作物</th></tr>
<tr><td><strong>促成栽培</strong></td><td>あたたかい気候を利用し、ビニールハウスなどで<strong>早づくり</strong>する</td><td>高知平野・宮崎平野（暖流の黒潮が近い）</td><td>ピーマン・なす・きゅうり</td></tr>
<tr><td><strong>抑制栽培</strong>（高冷地農業）</td><td>すずしい気候を利用し、出荷を<strong>遅らせる</strong></td><td>野辺山原（長野県）・嬬恋村（群馬県）</td><td>レタス・キャベツなどの高原野菜</td></tr>
<tr><td><strong>電照栽培</strong></td><td>夜も照明を当てて開花時期を遅らせる</td><td>渥美半島（愛知県）</td><td>電照ぎく</td></tr>
</table>
<p>促成栽培の産地が高知・宮崎に多いのは、<strong>冬でもあたたかい気候</strong>のためです。抑制栽培の産地が高地に多いのは、<strong>標高が100m上がるごとに気温が約0.6℃下がる</strong>ため、夏でもすずしく、平地より遅い時期に野菜が育つからです。</p>`
});

// ------------------------------------------------------------------
// 3. 日本の主な農産物と産地
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_03',
  category: 'sangyo',
  title: '日本の主な農産物と産地',
  body: `
<p>果物や野菜は、地形や気候に合わせて産地が決まっています。産地と作物をセットで覚えましょう。</p>
${japanBand([
  { x: 100, y: 130, label: 'みかん（愛媛・和歌山）', lx: 60, ly: 148, color: '#ff9f1c' },
  { x: 250, y: 45, label: 'りんご（青森）', lx: 250, ly: 30, color: '#b23a3a' },
  { x: 195, y: 82, label: 'りんご（長野）', lx: 235, ly: 78, color: '#b23a3a' },
  { x: 200, y: 90, label: 'もも・ぶどう（山梨）', lx: 150, ly: 100, color: '#8a4fbf' },
  { x: 260, y: 40, label: 'さくらんぼ（山形）', lx: 265, ly: 55, color: '#b23a3a', anchor: 'end' },
  { x: 60, y: 168, label: 'キャベツ（愛知）', lx: 60, ly: 182, color: '#2f6b2f' },
], { title: '主な果物・野菜の産地' })}
<table>
<tr><th>作物</th><th>都道府県1〜2位（例）</th><th>覚え方のポイント</th></tr>
<tr><td>みかん</td><td>和歌山県・愛媛県・静岡県</td><td>あたたかい・水はけのよい斜面</td></tr>
<tr><td>りんご</td><td>青森県・長野県</td><td>すずしい気候を好む</td></tr>
<tr><td>ぶどう・もも</td><td>山梨県</td><td>甲府盆地の扇状地（水はけがよい）</td></tr>
<tr><td>さくらんぼ</td><td>山形県</td><td>盆地の気候（寒暖差が大きい）</td></tr>
<tr><td>キャベツ・はくさい</td><td>愛知県・群馬県・長野県</td><td>大都市向けの近郊農業／高原野菜</td></tr>
</table>
<p><strong>扇状地</strong>（山から平地に出るところにできる、水はけのよい地形）は水田には向きませんが、果樹園には最適です。山梨県の甲府盆地はその代表例です。また大都市の近くで新鮮な野菜を作る農業を<strong>近郊農業</strong>といい、輸送費や時間がかからないという利点があります。</p>`
});

// ------------------------------------------------------------------
// 4. 日本の水産業とくらし
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_04',
  category: 'sangyo',
  title: '日本の水産業とくらし',
  body: `
<p>漁業は、漁をする場所（岸からのきょり）によって3つに分けられます。</p>
<svg viewBox="0 0 300 170" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="170" fill="#dff0ff"/>
<circle cx="150" cy="150" r="120" fill="#bfe0ff"/>
<circle cx="150" cy="150" r="75" fill="#9fd0ff"/>
<circle cx="150" cy="150" r="30" fill="#7fc0ff"/>
<rect x="120" y="150" width="60" height="20" fill="#c9a86a"/>
<text x="150" y="163" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">陸（港）</text>
<text x="150" y="132" font-family="sans-serif" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#20406b">沿岸漁業</text>
<text x="150" y="90" font-family="sans-serif" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#173a63">沖合漁業</text>
<text x="150" y="42" font-family="sans-serif" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#0d2b52">遠洋漁業</text>
<text x="150" y="18" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#0d2b52">外国の200海里水域の外側まで</text>
</svg>
<p>1970年代、多くの国が海岸から200海里（約370km）以内を「<strong>排他的経済水域</strong>」として自国の魚や資源を守るようになり、外国の海で自由に魚がとれなくなりました。そのため、遠くの海まで出かける<strong>遠洋漁業の漁獲量は大きく減少</strong>しました。</p>
<svg viewBox="0 0 300 110" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="110" fill="#eef7ea"/>
<text x="150" y="16" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#2f6b2f">「育てる漁業」の2つのちがい</text>
<rect x="15" y="28" width="130" height="70" rx="6" fill="#fff"/>
<text x="80" y="44" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">栽培漁業</text>
<text x="80" y="60" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">稚魚・稚貝を育てて</text>
<text x="80" y="72" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">海に放流し、大きく</text>
<text x="80" y="84" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">なってからとる</text>
<rect x="155" y="28" width="130" height="70" rx="6" fill="#fff"/>
<text x="220" y="44" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">養殖業</text>
<text x="220" y="60" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">いけすなどで</text>
<text x="220" y="72" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">出荷まで人の手で</text>
<text x="220" y="84" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">最後まで育てる</text>
</svg>
${japanBand([
  { x: 240, y: 55, label: '釧路（北海道）', lx: 240, ly: 40, color: '#b23a3a' },
  { x: 260, y: 30, label: '八戸（青森）', lx: 220, ly: 30, color: '#b23a3a' },
  { x: 200, y: 95, label: '銚子（千葉）', lx: 245, ly: 100, color: '#b23a3a' },
  { x: 175, y: 108, label: '焼津（静岡）', lx: 130, ly: 122, color: '#b23a3a' },
  { x: 45, y: 178, label: '長崎', lx: 45, ly: 195, color: '#b23a3a' },
], { title: '水あげ量の多い主な漁港' })}
<p>養殖業では、赤潮（プランクトンの異常発生）や、えさのやりすぎによる水質悪化が問題になることがあります。日本近海は暖流（黒潮・対馬海流）と寒流（親潮・リマン海流）がぶつかる<strong>潮目（潮境）</strong>があり、プランクトンが豊富で世界有数の好漁場となっています。</p>`
});

// ------------------------------------------------------------------
// 5. 日本の主な工業地帯・工業地域
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_05',
  category: 'sangyo',
  title: '日本の主な工業地帯・工業地域',
  body: `
<p>工業がさかんな地域は、太平洋側の海ぞいに帯のようにつながっています。これを<strong>太平洋ベルト</strong>と呼びます。港が近いと、原料の輸入や製品の輸出に便利だからです。</p>
${japanBand([
  { x: 45, y: 180, label: '北九州工業地帯（地域）', lx: 45, ly: 196, color: '#b23a3a' },
  { x: 95, y: 148, label: '瀬戸内工業地域', lx: 95, ly: 133, color: '#b23a3a' },
  { x: 140, y: 118, label: '阪神工業地帯', lx: 100, ly: 118, color: '#b23a3a' },
  { x: 175, y: 100, label: '中京工業地帯', lx: 175, ly: 115, color: '#b23a3a' },
  { x: 195, y: 85, label: '関東内陸工業地域', lx: 230, ly: 92, color: '#b23a3a' },
  { x: 235, y: 60, label: '京浜工業地帯', lx: 265, ly: 62, color: '#b23a3a' },
  { x: 195, y: 92, label: '東海工業地域', lx: 160, ly: 78, color: '#b23a3a' },
], { title: '太平洋ベルトと主な工業地帯・工業地域' })}
<table>
<tr><th>工業地帯・地域</th><th>中心都市</th><th>特色</th></tr>
<tr><td>京浜工業地帯</td><td>東京・横浜・川崎</td><td>印刷業の割合が高い。近年は内陸へ工場移転が進み出荷額はやや減少</td></tr>
<tr><td>中京工業地帯</td><td>名古屋・豊田</td><td>製造品出荷額<strong>全国1位</strong>。自動車を中心に機械工業の割合が6〜7割</td></tr>
<tr><td>阪神工業地帯</td><td>大阪・神戸</td><td>金属工業の割合が高め。中小工場が多い</td></tr>
<tr><td>北九州工業地帯（地域）</td><td>北九州市</td><td>八幡製鉄所から発展した鉄鋼の町。かつての四大工業地帯の一つ</td></tr>
<tr><td>瀬戸内工業地域</td><td>倉敷・広島など</td><td>石油化学コンビナートが多く、化学工業の割合が高い</td></tr>
<tr><td>関東内陸工業地域</td><td>群馬・栃木・埼玉</td><td>高速道路のIC付近に工場が多く、機械工業がさかん</td></tr>
</table>
<p>工業地帯・地域の名前は、中心となる都市の名前からとられていることが多いです（例：京浜＝東「京」＋横「浜」、阪神＝大「阪」＋「神」戸）。名前の由来を意識すると位置も覚えやすくなります。</p>`
});

// ------------------------------------------------------------------
// 6. 工業地帯・地域の出荷額グラフ比較
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_06',
  category: 'sangyo',
  title: '工業種類別の出荷額グラフの見分け方',
  body: `
<p>入試では、工業地帯・地域を示す<strong>帯グラフ（工業種類別の割合）</strong>を見分ける問題がよく出ます。グラフを見分けるコツは「どの工業の割合が特にとびぬけて高いか」に注目することです。</p>
<svg viewBox="0 0 300 200" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="200" fill="#fdf6e3"/>
<text x="150" y="14" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#7a5c00">工業種類別出荷額の割合（イメージ）</text>
<text x="15" y="38" font-family="sans-serif" font-size="9" fill="#333">中京</text>
<rect x="45" y="28" width="140" height="16" fill="#1d6fbf"/>
<rect x="185" y="28" width="35" height="16" fill="#8ecbff"/>
<rect x="220" y="28" width="45" height="16" fill="#c9c9c9"/>
<text x="115" y="40" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">機械 約7割</text>
<text x="15" y="68" font-family="sans-serif" font-size="9" fill="#333">阪神</text>
<rect x="45" y="58" width="90" height="16" fill="#1d6fbf"/>
<rect x="135" y="58" width="55" height="16" fill="#b23a3a"/>
<rect x="190" y="58" width="75" height="16" fill="#c9c9c9"/>
<text x="90" y="70" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">機械</text>
<text x="162" y="70" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">金属多め</text>
<text x="15" y="98" font-family="sans-serif" font-size="9" fill="#333">瀬戸内</text>
<rect x="45" y="88" width="80" height="16" fill="#1d6fbf"/>
<rect x="125" y="88" width="80" height="16" fill="#2f6b2f"/>
<rect x="205" y="88" width="60" height="16" fill="#c9c9c9"/>
<text x="165" y="100" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">化学が多め</text>
<text x="15" y="128" font-family="sans-serif" font-size="9" fill="#333">京浜</text>
<rect x="45" y="118" width="105" height="16" fill="#1d6fbf"/>
<rect x="150" y="118" width="30" height="16" fill="#f2c14e"/>
<rect x="180" y="118" width="85" height="16" fill="#c9c9c9"/>
<text x="165" y="130" font-family="sans-serif" font-size="7.3" text-anchor="middle" fill="#333">印刷業の割合が高い</text>
<rect x="20" y="150" width="14" height="12" fill="#1d6fbf"/>
<text x="40" y="160" font-family="sans-serif" font-size="8" fill="#333">機械</text>
<rect x="80" y="150" width="14" height="12" fill="#b23a3a"/>
<text x="100" y="160" font-family="sans-serif" font-size="8" fill="#333">金属</text>
<rect x="140" y="150" width="14" height="12" fill="#2f6b2f"/>
<text x="160" y="160" font-family="sans-serif" font-size="8" fill="#333">化学</text>
<rect x="200" y="150" width="14" height="12" fill="#f2c14e"/>
<text x="220" y="160" font-family="sans-serif" font-size="8" fill="#333">食料品・印刷など</text>
<rect x="20" y="170" width="14" height="12" fill="#c9c9c9"/>
<text x="40" y="180" font-family="sans-serif" font-size="8" fill="#333">その他せんい・食品など</text>
</svg>
<ul>
<li><strong>機械の割合がとびぬけて高い（6〜7割）</strong>→ 中京工業地帯（自動車工業がさかん）</li>
<li><strong>金属の割合が比較的高い</strong>→ 阪神工業地帯</li>
<li><strong>化学の割合が高い</strong>→ 瀬戸内工業地域（石油化学コンビナート）</li>
<li><strong>印刷業がふくまれる／割合が高い</strong>→ 京浜工業地帯（出版社・新聞社が多い東京がある）</li>
</ul>
<p>全体としては、日本の工業は<strong>機械工業の割合がもっとも高い</strong>のが特徴です。自動車・電気製品・精密機械などが日本の工業の中心となっています。</p>`
});

// ------------------------------------------------------------------
// 7. 日本の貿易のとくちょう
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_07',
  category: 'sangyo',
  title: '日本の貿易のとくちょう',
  body: `
<p>日本は資源が少ないため、外国から原材料や燃料を輸入し、それを工場で製品に加工して輸出する<strong>加工貿易</strong>で発展してきました。ただし近年は、工場を海外に移す企業が増え（<strong>海外生産の拡大・産業の空洞化</strong>）、加工貿易の性格は以前より弱まっています。</p>
<svg viewBox="0 0 300 130" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="130" fill="#eef7ea"/>
<text x="150" y="16" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#2f6b2f">加工貿易のしくみ</text>
<rect x="15" y="35" width="80" height="40" rx="6" fill="#fff"/>
<text x="55" y="52" font-family="sans-serif" font-size="8.5" text-anchor="middle" fill="#333">原料・燃料</text>
<text x="55" y="65" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#1d6fbf">（輸入）</text>
<path d="M98,55 L138,55" stroke="#333" stroke-width="2"/>
<polygon points="136,50 136,60 145,55" fill="#333"/>
<rect x="148" y="35" width="80" height="40" rx="6" fill="#fff"/>
<text x="188" y="52" font-family="sans-serif" font-size="8.5" text-anchor="middle" fill="#333">日本の工場</text>
<text x="188" y="65" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#333">（加工・組み立て）</text>
<path d="M231,55 L271,55" stroke="#333" stroke-width="2"/>
<polygon points="269,50 269,60 278,55" fill="#333"/>
<text x="280" y="45" font-family="sans-serif" font-size="8.5" text-anchor="middle" fill="#b23a3a">製品</text>
<text x="280" y="65" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#b23a3a">（輸出）</text>
<text x="150" y="100" font-family="sans-serif" font-size="8.3" text-anchor="middle" fill="#333">例：原油・鉄鉱石 → 自動車・機械 として輸出</text>
</svg>
<svg viewBox="0 0 300 190" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="190" fill="#fdf6e3"/>
<text x="150" y="14" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#7a5c00">日本の主な輸出品・輸入品</text>
<text x="15" y="32" font-family="sans-serif" font-size="9" font-weight="bold" fill="#1d6fbf">輸出品目</text>
<rect x="15" y="38" width="150" height="12" fill="#1d6fbf"/><text x="170" y="48" font-family="sans-serif" font-size="8" fill="#333">自動車</text>
<rect x="15" y="54" width="110" height="12" fill="#1d6fbf"/><text x="130" y="64" font-family="sans-serif" font-size="8" fill="#333">自動車部品</text>
<rect x="15" y="70" width="95" height="12" fill="#1d6fbf"/><text x="115" y="80" font-family="sans-serif" font-size="8" fill="#333">半導体等製造装置</text>
<rect x="15" y="86" width="80" height="12" fill="#1d6fbf"/><text x="100" y="96" font-family="sans-serif" font-size="8" fill="#333">鉄鋼</text>
<text x="15" y="118" font-family="sans-serif" font-size="9" font-weight="bold" fill="#b23a3a">輸入品目</text>
<rect x="15" y="124" width="150" height="12" fill="#b23a3a"/><text x="170" y="134" font-family="sans-serif" font-size="8" fill="#333">原油</text>
<rect x="15" y="140" width="120" height="12" fill="#b23a3a"/><text x="140" y="150" font-family="sans-serif" font-size="8" fill="#333">液化天然ガス(LNG)</text>
<rect x="15" y="156" width="100" height="12" fill="#b23a3a"/><text x="120" y="166" font-family="sans-serif" font-size="8" fill="#333">医薬品</text>
<rect x="15" y="172" width="85" height="12" fill="#b23a3a"/><text x="105" y="182" font-family="sans-serif" font-size="8" fill="#333">衣類・石炭</text>
</svg>
<p>原油・石炭・液化天然ガス（LNG）などの<strong>燃料資源はほぼ100％輸入</strong>にたよっています。輸出では自動車と自動車部品を合わせた輸送機械が大きな割合をしめ、近年は半導体をつくる機械（半導体等製造装置）の輸出も増えています。</p>`
});

// ------------------------------------------------------------------
// 8. 日本の貿易相手国と貿易港
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_08',
  category: 'sangyo',
  title: '日本の貿易相手国と貿易港',
  body: `
<p>日本の貿易相手として特に重要なのは<strong>中国とアメリカ</strong>です。この2つの国で、日本の貿易額の大きな部分をしめています。原料の輸入先は、資源をとる国によって決まっている点にも注目しましょう。</p>
<table>
<tr><th>相手国</th><th>日本が多く輸入するもの</th></tr>
<tr><td>オーストラリア</td><td>石炭・鉄鉱石・液化天然ガス</td></tr>
<tr><td>サウジアラビア・アラブ首長国連邦</td><td>原油</td></tr>
<tr><td>中国</td><td>機械類・衣類</td></tr>
<tr><td>アメリカ合衆国</td><td>とうもろこし・大豆・医薬品</td></tr>
</table>
<p>貿易港には、それぞれ得意な品目があります。理由は、<strong>船は重くて安いものを大量に、飛行機は軽くて高いものを速く</strong>運ぶのに向いているからです。</p>
<svg viewBox="0 0 300 155" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="155" fill="#dff0ff"/>
<text x="150" y="16" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#173a63">主な貿易港と得意な品目</text>
<rect x="15" y="26" width="130" height="55" rx="6" fill="#fff"/>
<text x="80" y="42" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">成田国際空港</text>
<text x="80" y="56" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">軽くて高価なもの</text>
<text x="80" y="68" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">（半導体・医薬品）</text>
<rect x="155" y="26" width="130" height="55" rx="6" fill="#fff"/>
<text x="220" y="42" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">名古屋港</text>
<text x="220" y="56" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">自動車の輸出額</text>
<text x="220" y="68" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">全国トップクラス</text>
<rect x="15" y="88" width="130" height="55" rx="6" fill="#fff"/>
<text x="80" y="104" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">横浜港・東京港</text>
<text x="80" y="118" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">自動車・機械類など</text>
<text x="80" y="130" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">取扱品目が幅広い</text>
<rect x="155" y="88" width="130" height="55" rx="6" fill="#fff"/>
<text x="220" y="104" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">千葉港</text>
<text x="220" y="118" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">石油・液化ガスなど</text>
<text x="220" y="130" font-family="sans-serif" font-size="7.8" text-anchor="middle" fill="#333">工業原料の輸入が中心</text>
</svg>
<p>成田国際空港は、輸出入額（貿易額）で日本の港・空港の中でも上位に入りますが、これは重さではなく「金額」で見ているためです。半導体や医薬品は小さくても高価なので、飛行機で運んでも十分にもとがとれるのです。</p>`
});

// ------------------------------------------------------------------
// 9. 資源とエネルギー
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_09',
  category: 'sangyo',
  title: '資源とエネルギー',
  body: `
<p>日本は石油・石炭・天然ガスなどの資源にとぼしく、エネルギー資源の多くを外国からの輸入にたよっています。発電方法にはいくつかの種類があり、それぞれ長所と短所があります。</p>
<svg viewBox="0 0 300 190" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="190" fill="#fdf6e3"/>
<text x="150" y="16" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#7a5c00">日本の発電量の内わけ（イメージ）</text>
<rect x="20" y="30" width="260" height="30" fill="#e0e0e0"/>
<rect x="20" y="30" width="185" height="30" fill="#a35a1a"/>
<text x="112" y="50" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#fff">火力（約7割）</text>
<rect x="205" y="30" width="45" height="30" fill="#8ecbff"/>
<text x="227" y="50" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#173a63">再エネ</text>
<rect x="250" y="30" width="18" height="30" fill="#2f6b2f"/>
<rect x="268" y="30" width="12" height="30" fill="#c9c9c9"/>
<rect x="20" y="70" width="14" height="12" fill="#a35a1a"/><text x="40" y="80" font-family="sans-serif" font-size="8" fill="#333">火力（石油・石炭・天然ガス）</text>
<rect x="20" y="88" width="14" height="12" fill="#8ecbff"/><text x="40" y="98" font-family="sans-serif" font-size="8" fill="#333">再生可能エネルギー（太陽光・風力など）</text>
<rect x="20" y="106" width="14" height="12" fill="#2f6b2f"/><text x="40" y="116" font-family="sans-serif" font-size="8" fill="#333">水力</text>
<rect x="20" y="124" width="14" height="12" fill="#c9c9c9"/><text x="40" y="134" font-family="sans-serif" font-size="8" fill="#333">原子力</text>
<text x="20" y="155" font-family="sans-serif" font-size="7.8" fill="#333">※2011年の東日本大震災・福島第一原発の事故のあと、</text>
<text x="20" y="168" font-family="sans-serif" font-size="7.8" fill="#333">　多くの原子力発電所が停止し、火力への依存が高まった。</text>
</svg>
<table>
<tr><th>発電方法</th><th>長所</th><th>短所</th></tr>
<tr><td>火力発電</td><td>すぐに発電量を調整しやすい</td><td>燃料はほぼ輸入。二酸化炭素を多く出す</td></tr>
<tr><td>水力発電</td><td>燃料がいらず二酸化炭素を出さない</td><td>ダム建設に適した山地が必要。自然を大きく変える</td></tr>
<tr><td>原子力発電</td><td>少ない燃料で大量の電気を作れる</td><td>事故が起きたときの被害が大きい。放射性廃棄物の処理</td></tr>
<tr><td>再生可能エネルギー</td><td>くり返し使え、資源が枯れない</td><td>天候に左右される。発電量が天気まかせで安定しにくい</td></tr>
</table>
<p>再生可能エネルギーには、太陽光・風力・地熱・バイオマス（生物資源）発電などがあります。日本は火山が多いため<strong>地熱発電</strong>の可能性が高い国のひとつですが、開発できる場所の多くが国立公園や温泉地と重なるため、まだ十分に活用されていません。</p>`
});

// ------------------------------------------------------------------
// 10. 四大公害病と公害問題の歴史
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_10',
  category: 'sangyo',
  title: '四大公害病と公害問題の歴史',
  body: `
<p>1950〜1970年代の高度経済成長の時期、工場からの排水やけむりによって人々の健康や自然環境に大きな被害が出ました。特に被害が大きかった4つの公害病を<strong>四大公害病</strong>といい、入試でも頻出です。</p>
${japanBand([
  { x: 45, y: 175, label: '水俣病（熊本県）', lx: 45, ly: 190, color: '#8a4fbf' },
  { x: 195, y: 100, label: 'イタイイタイ病（富山県）', lx: 230, ly: 100, color: '#b23a3a' },
  { x: 190, y: 108, label: '四日市ぜんそく（三重県）', lx: 150, ly: 130, color: '#2f6b2f' },
  { x: 218, y: 78, label: '新潟水俣病（新潟県）', lx: 255, ly: 68, color: '#8a4fbf' },
], { title: '四大公害病が発生した場所' })}
<table>
<tr><th>公害病</th><th>発生地域</th><th>原因物質</th><th>おもな症状</th></tr>
<tr><td>水俣病</td><td>熊本県（水俣湾周辺）</td><td>有機水銀（工場排水）</td><td>手足のしびれ、神経のまひ</td></tr>
<tr><td>新潟水俣病</td><td>新潟県（阿賀野川流域）</td><td>有機水銀（工場排水）</td><td>水俣病と同じ症状</td></tr>
<tr><td>イタイイタイ病</td><td>富山県（神通川流域）</td><td>カドミウム（鉱山排水）</td><td>骨がもろくなり激しい痛み</td></tr>
<tr><td>四日市ぜんそく</td><td>三重県（四日市市）</td><td>亜硫酸ガス（石油化学コンビナートのけむり）</td><td>のどや気管支の病気</td></tr>
</table>
<p>これらの公害病がきっかけとなり、国は<strong>公害対策基本法</strong>（1967年）を定め、1971年には<strong>環境庁</strong>（2001年から環境省）が作られました。「経済の発展」と「人々の健康・自然環境」のどちらを優先するかが問われた出来事として理解しておきましょう。</p>`
});

// ------------------------------------------------------------------
// 11. くらしと環境・リサイクル
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_11',
  category: 'sangyo',
  title: 'くらしと環境・リサイクル',
  body: `
<p>大量に作り、大量に使い、大量に捨てる社会から、ごみをできるだけ出さずに資源をくり返し使う<strong>循環型社会</strong>への転換が進められています。そのカギとなる考え方が「3R」です。</p>
<svg viewBox="0 0 300 190" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="190" fill="#eef7ea"/>
<text x="150" y="16" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#2f6b2f">3R（スリーアール）</text>
<path d="M150,35 A60,60 0 1 1 92,80" stroke="#1d6fbf" stroke-width="4" fill="none"/>
<polygon points="92,80 78,72 100,66" fill="#1d6fbf"/>
<path d="M92,120 A60,60 0 0 1 150,175" stroke="#b23a3a" stroke-width="4" fill="none"/>
<polygon points="150,175 138,163 162,160" fill="#b23a3a"/>
<path d="M208,120 A60,60 0 0 1 150,35" stroke="#2f6b2f" stroke-width="4" fill="none"/>
<polygon points="150,35 165,42 148,52" fill="#2f6b2f"/>
<circle cx="150" cy="30" r="20" fill="#1d6fbf"/>
<text x="150" y="34" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#fff">Reduce</text>
<circle cx="90" cy="130" r="20" fill="#b23a3a"/>
<text x="90" y="134" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#fff">Reuse</text>
<circle cx="210" cy="130" r="20" fill="#2f6b2f"/>
<text x="210" y="134" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#fff">Recycle</text>
<text x="150" y="60" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#333">ごみを減らす</text>
<text x="90" y="165" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#333">くり返し使う</text>
<text x="210" y="165" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#333">資源として再利用</text>
</svg>
<ul>
<li><strong>リデュース（Reduce）</strong>：ごみそのものを減らす（例：マイバッグを使う、つめかえ用を選ぶ）</li>
<li><strong>リユース（Reuse）</strong>：ものをくり返し使う（例：びんを回収して再利用する）</li>
<li><strong>リサイクル（Recycle）</strong>：ごみを資源にもどして再び製品にする（例：ペットボトル→衣類、缶→新しい金属製品）</li>
</ul>
<p>日本には、容器包装・家電・食品・自動車などについて、それぞれリサイクルを義務づける法律（家電リサイクル法など）があります。また、地球温暖化を防ぐため、二酸化炭素などの<strong>温室効果ガス</strong>の排出を減らす取り組みも世界的に進められています。</p>`
});

// ------------------------------------------------------------------
// 12. 情報・運輸・通信の発達
// ------------------------------------------------------------------
cards.push({
  id: 'sha_sangyo_12',
  category: 'sangyo',
  title: '情報・運輸・通信の発達',
  body: `
<p>交通網の発達によって、人や物の移動にかかる時間は大きく短縮されました。新幹線や高速道路のほか、貨物輸送の方法にも変化が見られます。</p>
<svg viewBox="0 0 300 170" style="display:block;margin:0 auto;max-width:300px">
<rect x="0" y="0" width="300" height="170" fill="#fdf6e3"/>
<text x="150" y="16" font-family="sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#7a5c00">国内の貨物輸送量の割合（イメージ）</text>
<text x="15" y="38" font-family="sans-serif" font-size="9" fill="#333">重さ（トン）</text>
<rect x="90" y="28" width="180" height="16" fill="#1d6fbf"/>
<text x="180" y="40" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#fff">自動車（トラック）の割合が非常に高い</text>
<text x="15" y="70" font-family="sans-serif" font-size="9" fill="#333">きょり×重さ</text>
<rect x="90" y="60" width="90" height="16" fill="#1d6fbf"/>
<rect x="180" y="60" width="60" height="16" fill="#2f6b2f"/>
<rect x="240" y="60" width="30" height="16" fill="#b23a3a"/>
<text x="135" y="72" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">自動車</text>
<text x="210" y="72" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">船</text>
<text x="255" y="72" font-family="sans-serif" font-size="7.5" text-anchor="middle" fill="#fff">鉄道</text>
<text x="20" y="100" font-family="sans-serif" font-size="8" fill="#333">・重さだけで見るとトラック輸送が圧倒的に多い</text>
<text x="20" y="115" font-family="sans-serif" font-size="8" fill="#333">・長いきょりを運ぶ量まで考えると、船も大きな役割</text>
<text x="20" y="135" font-family="sans-serif" font-size="8" fill="#333">・トラックから船や鉄道に切りかえる取り組みを</text>
<text x="20" y="148" font-family="sans-serif" font-size="8" fill="#333">　「モーダルシフト」といい、CO2削減にもつながる</text>
</svg>
<p>トラック輸送は少量の荷物を戸口から戸口へ速く運べる長所がありますが、二酸化炭素の排出量が多く、運転手不足も課題になっています。そこで、環境への負担が少ない船や鉄道に輸送手段を切りかえる<strong>モーダルシフト</strong>が進められています。</p>
<p>また、インターネットの普及によって<strong>情報化社会</strong>が進み、買い物や仕事、学習など生活のあらゆる場面でICT（情報通信技術）が使われるようになりました。一方で、正しい情報を見分ける力（メディアリテラシー）や、個人情報の管理など、新しい課題も生まれています。</p>`
});

// ------------------------------------------------------------------
// 出力
// ------------------------------------------------------------------
const outPath = path.join(__dirname, 'nippon_sangyo.json');
fs.writeFileSync(outPath, JSON.stringify(cards, null, 2), 'utf8');
console.log('wrote', cards.length, 'cards to', outPath);
