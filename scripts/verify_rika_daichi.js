// rika_daichi.json の新規追加分（id rg241〜）にある小6の計算問題を、
// 問題文から独立に再計算して答えと照合する。
const data = require('../data/rika_daichi.json');

function toHalf(s) {
  return s.replace(/[０-９．]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

const NEW_ID_START = 241;
const newItems = data.filter(q => Number(q.id.replace(/\D/g, '')) >= NEW_ID_START && q.grade === 6);

let checked = 0, errors = 0;

newItems.forEach(q => {
  const t = toHalf(q.question);
  let m;

  // パターンA: P波の速さ・きょり→到達秒数
  if ((m = t.match(/^P波の速さは秒速(\d+)kmです。震源から(\d+)kmはなれた地点にP波が届くのは地震発生から何秒後？$/))) {
    const v = Number(m[1]), d = Number(m[2]);
    const expected = String(d / v);
    checked++;
    if (expected !== q.answer) { console.log('NG(P波到達)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンB: S波の速さ・きょり→到達秒数
  if ((m = t.match(/^S波の速さは秒速(\d+)kmです。震源から(\d+)kmはなれた地点にS波が届くのは地震発生から何秒後？$/))) {
    const v = Number(m[1]), d = Number(m[2]);
    const expected = String(d / v);
    checked++;
    if (expected !== q.answer) { console.log('NG(S波到達)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンC: P波・S波の速さ・きょり→初期び動継続時間
  if ((m = t.match(/^P波は秒速(\d+)km、S波は秒速(\d+)kmです。震源から(\d+)kmの地点での初期び動継続時間は何秒？$/))) {
    const pv = Number(m[1]), sv = Number(m[2]), d = Number(m[3]);
    const expected = String(d / sv - d / pv);
    checked++;
    if (expected !== q.answer) { console.log('NG(継続時間)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンD: P波・S波の速さ・初期び動継続時間→きょり
  if ((m = t.match(/^P波は秒速(\d+)km、S波は秒速(\d+)kmです。初期び動継続時間が(\d+)秒の地点は、震源から何km？$/))) {
    const pv = Number(m[1]), sv = Number(m[2]), tt = Number(m[3]);
    // pv*sv/(pv-sv) の形で整数計算の丸め誤差を避ける
    const raw = tt * pv * sv / (pv - sv);
    const expected = String(Math.round(raw * 1e6) / 1e6);
    checked++;
    if (expected !== q.answer) { console.log('NG(距離逆算)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンI: 大森公式的な比例（1地点の実測値から別地点のきょりを逆算）
  if ((m = t.match(/^ある地震で、震源から(\d+)kmの地点の初期び動継続時間は(\d+)秒でした。同じ地震で、初期び動継続時間が(\d+)秒だった地点は、震源から何kmですか/))) {
    const d1 = Number(m[1]), t1 = Number(m[2]), t2 = Number(m[3]);
    const expected = String(d1 * t2 / t1);
    checked++;
    if (expected !== q.answer) { console.log('NG(大森比例)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンJ: 大森定数（きょり÷継続時間）
  if ((m = t.match(/^ある地震で、震源から(\d+)kmの地点の初期び動継続時間は(\d+)秒でした。この地震の大森定数（きょり÷継続時間）はいくつですか？$/))) {
    const d = Number(m[1]), tt = Number(m[2]);
    const expected = String(d / tt);
    checked++;
    if (expected !== q.answer) { console.log('NG(大森定数)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンE: P波到達時刻(時計)から発生時刻を逆算
  if ((m = t.match(/^P波は秒速(\d+)kmです。震源から(\d+)km地点にP波が届いたのは10時0分(\d+)秒でした。地震が発生したのは10時0分何秒？$/))) {
    const v = Number(m[1]), d = Number(m[2]), arrival = Number(m[3]);
    const travel = d / v;
    const expected = String(arrival - travel);
    checked++;
    if (expected !== q.answer) { console.log('NG(発生時刻P)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // パターンK: S波到達時刻(時計)から発生時刻を逆算
  if ((m = t.match(/^S波は秒速(\d+)kmです。震源から(\d+)km地点にS波が届いたのは10時0分(\d+)秒でした。地震が発生したのは10時0分何秒？$/))) {
    const v = Number(m[1]), d = Number(m[2]), arrival = Number(m[3]);
    const travel = d / v;
    const expected = String(arrival - travel);
    checked++;
    if (expected !== q.answer) { console.log('NG(発生時刻S)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }
});

console.log(`検算数: ${checked}, エラー: ${errors}`);

// ===== 追加の整合性チェック（新規追加分全体） =====
const newAll = data.filter(q => Number(q.id.replace(/\D/g, '')) >= NEW_ID_START);
let structErrors = 0;

// 1. 質問文の重複チェック（ファイル全体）
const qMap = new Map();
data.forEach(q => {
  qMap.set(q.question, (qMap.get(q.question) || 0) + 1);
});
const dupQuestions = [...qMap.entries()].filter(([, c]) => c > 1);
if (dupQuestions.length > 0) {
  console.log('重複した質問文:', dupQuestions.length, '件');
  dupQuestions.slice(0, 10).forEach(([q, c]) => console.log(' -', q, 'x', c));
  structErrors += dupQuestions.length;
} else {
  console.log('質問文の重複: なし');
}

// 2. choices の妥当性チェック（新規分）
newAll.forEach(q => {
  if (!Array.isArray(q.choices) || q.choices.length !== 4) {
    console.log('NG(choices数)', q.id, q.choices);
    structErrors++;
    return;
  }
  const uniq = new Set(q.choices);
  if (uniq.size !== 4) {
    console.log('NG(choices重複)', q.id, q.choices);
    structErrors++;
  }
  if (!q.choices.includes(q.answer)) {
    console.log('NG(answer未含有)', q.id, q.answer, q.choices);
    structErrors++;
  }
});

// 3. NaN チェック
newAll.forEach(q => {
  const s = JSON.stringify(q);
  if (/NaN/.test(s)) {
    console.log('NG(NaN検出)', q.id);
    structErrors++;
  }
});

// 4. grade/difficulty範囲チェック
data.forEach(q => {
  if (![4, 5, 6].includes(q.grade)) { console.log('NG(grade範囲外)', q.id, q.grade); structErrors++; }
  if (![1, 2, 3, 4].includes(q.difficulty)) { console.log('NG(difficulty範囲外)', q.id, q.difficulty); structErrors++; }
});

console.log(`構造チェックエラー: ${structErrors}`);
console.log(`新規追加問題数: ${newAll.length}`);
