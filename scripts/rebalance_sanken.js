// 三権タウン事件簿の世論支持率バランスを再調整する。
// これまで全選択肢がプラスにしか働かず、失敗ルートがほぼ存在しなかったため、
// 各ステージに「支持が下がる」選択肢も用意し、実際に3つのエンディングすべてに
// 到達しうるようにする。
const fs = require('fs');

// [ステージ0の値配列, ステージ1, ステージ2] ※選択肢の順番はJSON内の順番のまま
// 1つしか選択肢がない場面は小さめの値のみ
const PLAN = {
  case_juice_tax: [[9, -6], [-7, 10], [11, -5]],
  case_helmet: [[8, -5], [-6, 9], [10, -4]],
  case_factory: [[-6, 9], [8, -6], [-5, 10]],
  case_game: [[9, -6], [-5, 8], [10, -6]],
  case_overtime: [[8, -6], [-6, 9], [9, -5]],
  case_fushinnin: [[9, -6], [-6, 9], [8]],
  case_treaty: [[-6, 9], [9, -6], [7]],
  case_shinsa: [[6], [-6, 9], [8]],
  case_dangai: [[6], [9, -7], [7]],
  case_senkyo: [[9, -6], [-5, 8], [8]]
};

const TROUBLE = {
  case_juice_tax: [15, 7, -17],
  case_helmet: [14, 8, -16],
  case_factory: [15, 8, -16],
  case_game: [14, 7, -15],
  case_overtime: [14, 8, -16],
  case_fushinnin: [15, 7, -16],
  case_treaty: [14, 8, -16],
  case_shinsa: [13, 8, -14],
  case_dangai: [13, 7, -15],
  case_senkyo: [14, 8, -15]
};

for (const file of ['data/sanken_cases.json', 'scripts/sanken_cases.json']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const c of data) {
    const plan = PLAN[c.id];
    c.stages.forEach((s, si) => {
      s.options.forEach((o, oi) => {
        if (plan[si] && plan[si][oi] !== undefined) o.opinionEffect = plan[si][oi];
      });
    });
    const tvals = TROUBLE[c.id];
    c.trouble.options.forEach((o, oi) => { if (tvals[oi] !== undefined) o.opinionEffect = tvals[oi]; });
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(file, 'rebalanced');
}

// 検証：各ケースの理論上の最小/最大到達点を確認
const data = JSON.parse(fs.readFileSync('data/sanken_cases.json', 'utf8'));
data.forEach(c => {
  let minTotal = 50, maxTotal = 50;
  c.stages.forEach(s => {
    const vals = s.options.map(o => o.opinionEffect);
    minTotal += Math.min(...vals); maxTotal += Math.max(...vals);
  });
  const tvals = c.trouble.options.map(o => o.opinionEffect);
  minTotal += Math.min(...tvals); maxTotal += Math.max(...tvals);
  console.log(c.id, 'range:', Math.max(0, minTotal), '-', Math.min(100, maxTotal));
});
