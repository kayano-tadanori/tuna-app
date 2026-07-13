// 連鎖問題（灘中レベル）の残りのうち、図が理解を助けるチェーンにSVGの図を追加する。
const fs = require('fs');
const path = require('path');
const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b', B = '#4dd0e1';
const wrap = (inner, vb = '0 0 220 155') => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:240px'>${inner}</svg>`;

// ===== 算数 =====
const sansuFigs = {
  // 三角形の面積分割（A頂点、BC上のD、AD上のE）
  sc_chain_03: wrap(
    `<polygon points='110,22 30,132 190,132' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<line x1='110' y1='22' x2='94' y2='132' stroke='${G}' stroke-width='1.5'/>` +
    `<circle cx='98' cy='104' r='3.5' fill='${R}'/>` +
    `<text x='110' y='16' font-size='12' fill='${S}' text-anchor='middle'>A</text>` +
    `<text x='22' y='143' font-size='12' fill='${S}'>B</text><text x='190' y='143' font-size='12' fill='${S}'>C</text>` +
    `<text x='90' y='145' font-size='11' fill='${G}'>D</text><text x='78' y='106' font-size='11' fill='${R}'>E</text>`
  ),
  // マッチ棒でつなげた五角形（3個分の模式図）
  sc_chain_04: wrap(
    `<polyline points='35,120 75,120 75,78 55,52 35,78 35,120' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<polyline points='75,120 115,120 115,78 95,52 75,78' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<polyline points='115,120 155,120 155,78 135,52 115,78' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<text x='110' y='143' font-size='11' fill='${G}' text-anchor='middle'>正五角形をつなげる</text>`
  ),
  // 出会いと折り返し（数直線 A↔B）
  sc_chain_09: wrap(
    `<line x1='30' y1='80' x2='190' y2='80' stroke='${S}' stroke-width='2'/>` +
    `<circle cx='30' cy='80' r='4' fill='${G}'/><circle cx='190' cy='80' r='4' fill='${G}'/>` +
    `<text x='24' y='72' font-size='12' fill='${G}'>A</text><text x='186' y='72' font-size='12' fill='${G}'>B</text>` +
    `<text x='110' y='72' font-size='11' fill='${S}' text-anchor='middle'>1800m</text>` +
    `<text x='52' y='102' font-size='10' fill='${R}'>P→ 分速100m</text>` +
    `<text x='118' y='118' font-size='10' fill='${B}'>←Q 分速80m</text>`, '0 0 220 130'
  ),
  // 立方体を3つの直方体に切り分ける
  sc_chain_10: wrap(
    `<polygon points='55,35 85,20 175,20 145,35' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<polygon points='145,35 175,20 175,128 145,143' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<rect x='55' y='35' width='90' height='108' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<line x1='55' y1='62' x2='145' y2='62' stroke='${G}' stroke-width='1.2'/>` +
    `<line x1='55' y1='98' x2='145' y2='98' stroke='${G}' stroke-width='1.2'/>` +
    `<text x='150' y='52' font-size='10' fill='${G}'>3cm</text><text x='150' y='84' font-size='10' fill='${G}'>4cm</text><text x='150' y='122' font-size='10' fill='${G}'>?cm</text>`
  ),
  // 水そうとおもり
  sc_chain_28: wrap(
    `<rect x='45' y='32' width='130' height='103' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<rect x='47' y='72' width='126' height='61' fill='${B}' opacity='0.25'/>` +
    `<line x1='47' y1='72' x2='173' y2='72' stroke='${B}' stroke-width='2'/>` +
    `<rect x='96' y='95' width='38' height='38' fill='none' stroke='${G}' stroke-width='2'/>` +
    `<text x='115' y='90' font-size='10' fill='${G}' text-anchor='middle'>おもり</text>` +
    `<text x='150' y='68' font-size='9' fill='${B}'>水面</text>`
  ),
};

// ===== 理科 =====
const rikaFigs = {
  // 音の速さ（がけとやまびこ）
  rchain04: wrap(
    `<rect x='168' y='30' width='34' height='105' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<line x1='168' y1='40' x2='202' y2='55' stroke='${S}'/><line x1='168' y1='70' x2='202' y2='85' stroke='${S}'/><line x1='168' y1='100' x2='202' y2='115' stroke='${S}'/>` +
    `<circle cx='35' cy='95' r='8' fill='none' stroke='${G}' stroke-width='2'/><line x1='35' y1='103' x2='35' y2='125' stroke='${G}' stroke-width='2'/>` +
    `<path d='M50,85 Q60,95 50,105' fill='none' stroke='${R}'/><path d='M60,80 Q75,95 60,110' fill='none' stroke='${R}'/>` +
    `<line x1='30' y1='140' x2='168' y2='140' stroke='${B}' stroke-width='1' stroke-dasharray='4,3'/>` +
    `<text x='95' y='136' font-size='10' fill='${B}' text-anchor='middle'>きょり</text>` +
    `<text x='183' y='150' font-size='11' fill='${S}' text-anchor='middle'>がけ</text>`
  ),
  // 状態変化の温度グラフ
  rchain05: wrap(
    `<line x1='30' y1='25' x2='30' y2='130' stroke='${S}' stroke-width='1.5'/>` +
    `<line x1='30' y1='130' x2='205' y2='130' stroke='${S}' stroke-width='1.5'/>` +
    `<polyline points='30,118 60,80 130,80 200,35' fill='none' stroke='${G}' stroke-width='2'/>` +
    `<line x1='30' y1='80' x2='130' y2='80' stroke='${S}' stroke-width='0.5' stroke-dasharray='3,3'/>` +
    `<text x='14' y='84' font-size='10' fill='${S}'>0℃</text>` +
    `<text x='20' y='20' font-size='10' fill='${S}'>温度</text><text x='200' y='148' font-size='10' fill='${S}'>時間</text>` +
    `<text x='75' y='74' font-size='9' fill='${B}'>とけている間</text>`
  ),
  // 気体の発生と水上置換
  rchain08: wrap(
    `<path d='M55,55 L55,95 Q55,115 75,115 Q95,115 95,95 L95,55 Z' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<rect x='68' y='45' width='14' height='12' fill='none' stroke='${S}'/>` +
    `<path d='M55,100 Q60,110 70,108' fill='${S}' opacity='0.2'/>` +
    `<line x1='82' y1='50' x2='150' y2='50' stroke='${S}' stroke-width='1.5'/><line x1='150' y1='50' x2='150' y2='95' stroke='${S}' stroke-width='1.5'/>` +
    `<rect x='120' y='90' width='70' height='45' fill='${B}' opacity='0.2' stroke='${S}'/>` +
    `<rect x='140' y='60' width='20' height='45' fill='none' stroke='${S}' stroke-width='1.5'/>` +
    `<text x='75' y='135' font-size='9' fill='${S}' text-anchor='middle'>二酸化マンガン</text>` +
    `<text x='150' y='148' font-size='9' fill='${G}' text-anchor='middle'>酸素を集める</text>`
  ),
  // 電磁石（電池＋コイル＋鉄しん）
  rchain10: wrap(
    `<line x1='40' y1='70' x2='180' y2='70' stroke='${S}' stroke-width='6'/>` +
    `<path d='M55,70 q8,-22 16,0 M71,70 q8,-22 16,0 M87,70 q8,-22 16,0 M103,70 q8,-22 16,0 M119,70 q8,-22 16,0 M135,70 q8,-22 16,0' fill='none' stroke='${G}' stroke-width='2'/>` +
    `<line x1='40' y1='70' x2='40' y2='115' stroke='${G}' stroke-width='2'/><line x1='180' y1='70' x2='180' y2='115' stroke='${G}' stroke-width='2'/>` +
    `<line x1='40' y1='115' x2='90' y2='115' stroke='${G}' stroke-width='2'/><line x1='130' y1='115' x2='180' y2='115' stroke='${G}' stroke-width='2'/>` +
    `<line x1='90' y1='105' x2='90' y2='125' stroke='${S}' stroke-width='2'/><line x1='130' y1='108' x2='130' y2='122' stroke='${S}' stroke-width='3'/>` +
    `<text x='110' y='135' font-size='10' fill='${S}' text-anchor='middle'>かん電池</text>` +
    `<text x='110' y='55' font-size='10' fill='${G}' text-anchor='middle'>コイル（鉄しん）</text>`
  ),
  // アサガオの花のつくり（たて断面）
  rchain11: wrap(
    `<line x1='110' y1='120' x2='110' y2='60' stroke='#4caf50' stroke-width='2'/>` +
    `<path d='M70,90 Q110,30 150,90' fill='none' stroke='${R}' stroke-width='2'/>` +
    `<line x1='95' y1='95' x2='95' y2='62' stroke='${G}' stroke-width='1.5'/><circle cx='95' cy='60' r='3' fill='${G}'/>` +
    `<line x1='125' y1='95' x2='125' y2='62' stroke='${G}' stroke-width='1.5'/><circle cx='125' cy='60' r='3' fill='${G}'/>` +
    `<line x1='110' y1='100' x2='110' y2='55' stroke='${S}' stroke-width='1.5'/><circle cx='110' cy='53' r='3' fill='${S}'/>` +
    `<text x='150' y='72' font-size='9' fill='${R}'>花びら</text>` +
    `<text x='128' y='108' font-size='9' fill='${G}'>おしべ</text>` +
    `<text x='110' y='138' font-size='9' fill='${S}' text-anchor='middle'>中央：めしべ</text>`
  ),
  // こん虫の完全変態（卵→幼虫→さなぎ→成虫）
  rchain12: wrap(
    `<circle cx='35' cy='70' r='9' fill='none' stroke='${S}' stroke-width='2'/>` +
    `<ellipse cx='90' cy='70' rx='20' ry='8' fill='none' stroke='${G}' stroke-width='2'/>` +
    `<ellipse cx='150' cy='70' rx='11' ry='16' fill='none' stroke='${B}' stroke-width='2'/>` +
    `<path d='M195,60 Q185,70 195,80 M195,60 Q205,70 195,80' fill='none' stroke='${R}' stroke-width='2'/><line x1='195' y1='60' x2='195' y2='80' stroke='${R}' stroke-width='1.5'/>` +
    `<text x='55' y='74' font-size='11' fill='${S}'>→</text><text x='115' y='74' font-size='11' fill='${S}'>→</text><text x='167' y='74' font-size='11' fill='${S}'>→</text>` +
    `<text x='35' y='100' font-size='9' fill='${S}' text-anchor='middle'>卵</text><text x='90' y='100' font-size='9' fill='${G}' text-anchor='middle'>幼虫</text>` +
    `<text x='150' y='100' font-size='9' fill='${B}' text-anchor='middle'>さなぎ</text><text x='195' y='100' font-size='9' fill='${R}' text-anchor='middle'>成虫</text>`, '0 0 220 115'
  ),
};

function apply(file, figs) {
  const full = path.join(__dirname, '..', 'data', file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  let n = 0;
  data.forEach(c => { if (figs[c.id]) { c.svg = figs[c.id]; n++; } });
  fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
  const withFig = data.filter(c => c.svg).length;
  console.log(file + ': +' + n + '図 → 合計' + withFig + '/' + data.length + 'チェーンが図つき');
}
apply('sansu_chain.json', sansuFigs);
apply('rika_chain.json', rikaFigs);
