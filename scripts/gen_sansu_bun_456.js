// sansu_bun.json の小4〜6を作り直す（小1〜3はそのまま維持）
// 小4は割合をまだ習っていない前提で純粋な四則混合文章題、小5-6は割合・速さ・比を段階的に

const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
const ITEMS = ['りんご', 'みかん', 'クッキー', 'あめ', 'ノート', '色えんぴつ'];

// ===== 小4：純粋な四則混合の文章題（割合はまだ使わない） =====
function g4_d1() { // 2段階のたし算・ひき算
  const item = pick(ITEMS);
  const a = randInt(10, 40), b = randInt(1, 20), c = randInt(1, 15);
  const total = a - b + c;
  if (total <= 0) return null;
  return { question: `${item}を${a}個持っていました。${b}個あげて、その後${c}個もらいました。今、${item}は何個ありますか？`, answer: String(total), meaning: `${a}－${b}＋${c}＝${total}` };
}
function g4_d2() { // かけ算を含む文章題（単価×個数の複合）
  const price = randInt(30, 200), n1 = randInt(2, 8), n2 = randInt(2, 8);
  const total = price * (n1 + n2);
  return { question: `1個${price}円の品物を、1日目に${n1}個、2日目に${n2}個買いました。代金の合計はいくらですか？`, answer: String(total), meaning: `${price}×(${n1}＋${n2})＝${total}` };
}
function g4_d3() { // わり算（あまりのある等分・包含除）を含む文章題
  const item = pick(ITEMS);
  const perBox = randInt(4, 12), boxes = randInt(3, 15), extra = randInt(1, perBox - 1);
  const total = perBox * boxes + extra;
  return { question: `${item}が${total}個あります。1箱に${perBox}個ずつ入れると、何箱できて何個あまりますか？（「〇余り〇」の形で答えなさい）`, answer: `${boxes}余り${extra}`, meaning: `${total}÷${perBox}＝${boxes}あまり${extra}` };
}
function g4_d4() { // 複合（かけ算＋たし算・ひき算の2ステップ）
  const item = pick(ITEMS);
  const price = randInt(50, 300), n = randInt(2, 10), pay = (price * n) + randInt(100, 1000);
  const change = pay - price * n;
  return { question: `1個${price}円の${item}を${n}個買って、${pay}円出しました。おつりはいくらですか？`, answer: String(change), meaning: `${pay}－${price}×${n}＝${change}` };
}

// ===== 小5：割合・速さの基礎〜応用 =====
function g5_d1() { // 割合の基礎（1ステップ）
  const total = randInt(20, 200), pct = pick([10, 20, 25, 30, 40, 50, 60, 75]);
  const val = total * pct / 100;
  if (!Number.isInteger(val)) return null;
  return { question: `${total}人のうち${pct}%が男子です。男子は何人ですか？`, answer: String(val), meaning: `${total}×${pct}÷100＝${val}` };
}
function g5_d2() { // 速さの基礎（1ステップ）
  const speed = randInt(30, 90), time = randInt(2, 8);
  const dist = speed * time;
  return { question: `時速${speed}kmで${time}時間走ると、何km進みますか？`, answer: String(dist), meaning: `${speed}×${time}＝${dist}` };
}
function g5_d3() { // 割合の応用（2ステップ：割合の合成）
  const total = randInt(100, 500);
  const pct1 = pick([10, 20, 25, 40, 50]);
  const remain1 = total * (100 - pct1) / 100;
  if (!Number.isInteger(remain1)) return null;
  const pct2 = pick([10, 20, 25, 40, 50]);
  const remain2 = remain1 * (100 - pct2) / 100;
  if (!Number.isInteger(remain2)) return null;
  return { question: `${total}ページの本があります。1日目に全体の${pct1}%を読み、2日目に残りの${pct2}%を読みました。まだ読んでいないページは何ページですか？`, answer: String(remain2), meaning: `${total}×(1－${pct1}/100)＝${remain1}、${remain1}×(1－${pct2}/100)＝${remain2}` };
}
function g5_d4() { // 速さ＋割合の複合、または2ステップ文章題
  const speed = randInt(40, 100), time1 = randInt(2, 5), time2 = randInt(1, 4);
  const dist1 = speed * time1, dist2 = speed * time2, total = dist1 + dist2;
  return { question: `時速${speed}kmの自動車が、午前中に${time1}時間、午後に${time2}時間走りました。この日走った道のりの合計は何kmですか？`, answer: String(total), meaning: `${speed}×${time1}＋${speed}×${time2}＝${total}` };
}

// ===== 小6：比・原価定価売価の複合（灘中レベルへ段階的に） =====
function g6_d1() { // 比を使った分配文章題（基礎）
  const total = randInt(20, 100), r1 = randInt(1, 5), r2 = randInt(1, 5);
  if (r1 === r2 || total % (r1 + r2) !== 0) return null;
  const unit = total / (r1 + r2);
  return { question: `${total}個のおはじきを、AさんとBさんで${r1}：${r2}の比で分けます。Aさんは何個もらえますか？`, answer: String(unit * r1), meaning: `${total}÷(${r1}＋${r2})×${r1}＝${unit * r1}` };
}
function g6_d2() { // 原価・定価・売価の基礎関係
  const cost = randInt(200, 2000);
  const markupPct = pick([10, 20, 30, 40, 50]);
  const price = Math.round(cost * (100 + markupPct) / 100);
  if (cost * (100 + markupPct) % 100 !== 0) return null;
  return { question: `原価${cost}円の品物に、原価の${markupPct}%の利益を見こんで定価をつけました。定価はいくらですか？`, answer: String(price), meaning: `${cost}×(1＋${markupPct}/100)＝${price}` };
}
function g6_d3() { // 原価・定価・売価の応用（値引き後利益）
  const cost = randInt(200, 2000);
  const markupPct = pick([20, 30, 40, 50, 60]);
  const price = cost * (100 + markupPct) / 100;
  if (!Number.isInteger(price)) return null;
  const discountPct = pick([10, 20, 25]);
  const sell = price * (100 - discountPct) / 100;
  if (!Number.isInteger(sell)) return null;
  const profit = sell - cost;
  if (profit <= 0) return null; // 損にならない組み合わせのみ出題
  return { question: `原価${cost}円の品物に原価の${markupPct}%の利益を見こんで定価をつけましたが、売れなかったので定価の${discountPct}%引きで売りました。利益はいくらですか？`, answer: String(profit), meaning: `定価＝${cost}×${(100 + markupPct) / 100}＝${price}、売価＝${price}×${(100 - discountPct) / 100}＝${sell}、利益＝${sell}－${cost}＝${profit}` };
}
function g6_d4() { // 灘中レベル：比＋原価定価売価の複合（3ステップ）
  const costA = randInt(200, 800), costB = costA + randInt(50, 400);
  const markupPct = pick([20, 30, 40]);
  const priceA = costA * (100 + markupPct) / 100, priceB = costB * (100 + markupPct) / 100;
  if (!Number.isInteger(priceA) || !Number.isInteger(priceB)) return null;
  const discountPct = pick([10, 20]);
  const sellA = priceA * (100 - discountPct) / 100, sellB = priceB * (100 - discountPct) / 100;
  if (!Number.isInteger(sellA) || !Number.isInteger(sellB)) return null;
  if (sellA <= costA || sellB <= costB) return null; // どちらも損にならない組み合わせのみ出題
  const totalProfit = (sellA - costA) + (sellB - costB);
  return {
    question: `原価${costA}円の品Aと原価${costB}円の品Bに、それぞれ原価の${markupPct}%の利益を見こんで定価をつけました。2つとも定価の${discountPct}%引きで売れたとき、2品合わせた利益はいくらですか？`,
    answer: String(totalProfit),
    meaning: `A：定価${priceA}→売価${sellA}→利益${sellA - costA}／B：定価${priceB}→売価${sellB}→利益${sellB - costB}／合計${totalProfit}`,
  };
}

const GENERATORS = { 4: [g4_d1, g4_d2, g4_d3, g4_d4], 5: [g5_d1, g5_d2, g5_d3, g5_d4], 6: [g6_d1, g6_d2, g6_d3, g6_d4] };

function genN(fn, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 60000) {
    tries++;
    const r = fn();
    if (!r) continue;
    if (seen.has(r.question)) continue;
    seen.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問`);
  return out;
}

const filePath = path.join(__dirname, '..', 'data', 'sansu_bun.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const kept = existing.filter(q => q.grade < 4);
let idCounter = Math.max(...existing.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = existing[0].id.replace(/\d+$/, '');

const newItems = [];
[4, 5, 6].forEach(grade => {
  for (let diff = 1; diff <= 4; diff++) {
    const items = genN(GENERATORS[grade][diff - 1], 20);
    items.forEach(it => {
      newItems.push({ id: `${prefix}${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
});

const all = [...kept, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
