const data = require('../data/sansu_bun.json').filter(q => q.grade >= 4);
let checked = 0, failed = 0;
const fail = (q, d) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer} [${d}]`); };

data.forEach(q => {
  let m;
  const qt = q.question;
  if ((m = qt.match(/^(.+)を(\d+)個持っていました。(\d+)個あげて、その後(\d+)個もらいました。今、.+は何個ありますか？$/))) {
    checked++; const [a, b, c] = [Number(m[2]), Number(m[3]), Number(m[4])]; if (String(a - b + c) !== q.answer) fail(q, `期待${a - b + c}`);
  } else if ((m = qt.match(/^1個(\d+)円の品物を、1日目に(\d+)個、2日目に(\d+)個買いました。代金の合計はいくらですか？$/))) {
    checked++; const [p, n1, n2] = m.slice(1).map(Number); if (String(p * (n1 + n2)) !== q.answer) fail(q, `期待${p * (n1 + n2)}`);
  } else if ((m = qt.match(/^.+が(\d+)個あります。1箱に(\d+)個ずつ入れると、何箱できて何個あまりますか？/))) {
    checked++; const [total, perBox] = m.slice(1).map(Number); const exp = `${Math.floor(total / perBox)}余り${total % perBox}`; if (exp !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^1個(\d+)円の.+を(\d+)個買って、(\d+)円出しました。おつりはいくらですか？$/))) {
    checked++; const [p, n, pay] = m.slice(1).map(Number); if (String(pay - p * n) !== q.answer) fail(q, `期待${pay - p * n}`);
  } else if ((m = qt.match(/^(\d+)人のうち(\d+)%が男子です。男子は何人ですか？$/))) {
    checked++; const [total, pct] = m.slice(1).map(Number); if (String(total * pct / 100) !== q.answer) fail(q, `期待${total * pct / 100}`);
  } else if ((m = qt.match(/^時速(\d+)kmで(\d+)時間走ると、何km進みますか？$/))) {
    checked++; const [s, t] = m.slice(1).map(Number); if (String(s * t) !== q.answer) fail(q, `期待${s * t}`);
  } else if ((m = qt.match(/^(\d+)ページの本があります。1日目に全体の(\d+)%を読み、2日目に残りの(\d+)%を読みました。まだ読んでいないページは何ページですか？$/))) {
    checked++; const [total, p1, p2] = m.slice(1).map(Number); const r1 = total * (100 - p1) / 100; const r2 = r1 * (100 - p2) / 100; if (String(r2) !== q.answer) fail(q, `期待${r2}`);
  } else if ((m = qt.match(/^時速(\d+)kmの自動車が、午前中に(\d+)時間、午後に(\d+)時間走りました。この日走った道のりの合計は何kmですか？$/))) {
    checked++; const [s, t1, t2] = m.slice(1).map(Number); if (String(s * t1 + s * t2) !== q.answer) fail(q, `期待${s * t1 + s * t2}`);
  } else if ((m = qt.match(/^(\d+)個のおはじきを、AさんとBさんで(\d+)：(\d+)の比で分けます。Aさんは何個もらえますか？$/))) {
    checked++; const [total, r1, r2] = m.slice(1).map(Number); const exp = total / (r1 + r2) * r1; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^原価(\d+)円の品物に、原価の(\d+)%の利益を見こんで定価をつけました。定価はいくらですか？$/))) {
    checked++; const [cost, pct] = m.slice(1).map(Number); const exp = cost * (100 + pct) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^原価(\d+)円の品物に原価の(\d+)%の利益を見こんで定価をつけましたが、売れなかったので定価の(\d+)%引きで売りました。利益はいくらですか？/))) {
    checked++;
    const [cost, markup, discount] = m.slice(1).map(Number);
    const price = cost * (100 + markup) / 100, sell = price * (100 - discount) / 100;
    if (String(sell - cost) !== q.answer) fail(q, `期待${sell - cost}`);
  } else if ((m = qt.match(/^原価(\d+)円の品Aと原価(\d+)円の品Bに、それぞれ原価の(\d+)%の利益を見こんで定価をつけました。2つとも定価の(\d+)%引きで売れたとき、2品合わせた利益はいくらですか？$/))) {
    checked++;
    const [ca, cb, markup, discount] = m.slice(1).map(Number);
    const pa = ca * (100 + markup) / 100, pb = cb * (100 + markup) / 100;
    const sa = pa * (100 - discount) / 100, sb = pb * (100 - discount) / 100;
    const exp = (sa - ca) + (sb - cb);
    if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else {
    console.log('UNMATCHED:', q.id, qt);
  }
});
console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
const all = require('../data/sansu_bun.json');
console.log('全体総数:', all.length);
const ids = new Set(all.map(q => q.id));
console.log('ID重複:', ids.size !== all.length ? 'あり' : 'なし');
