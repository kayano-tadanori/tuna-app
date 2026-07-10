// rika_suiyoueki.json の新規計算問題を、問題文から独立に再計算して答えと照合する
const data = require('../data/rika_suiyoueki.json');

function toHalf(s) {
  return s.replace(/[０-９．]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}
function fmt1(x) {
  const r = Math.round(x * 10) / 10;
  return String(r);
}

let checked = 0, errors = 0;

// このスクリプトは今回新規追加した項目（id > rs240）のみを検算対象とする。
// rs001〜rs240 は既存データであり、今回のタスクでは変更しない方針のため対象外
// （検算の過程で rs146〜rs150 に既存の答え不一致を発見したが、既存項目は変更しない）。
const newData = data.filter(q => parseInt(q.id.replace('rs', ''), 10) > 240);

newData.forEach(q => {
  const t = toHalf(q.question);
  let m;

  // ---- 小4：重さの保存 ----
  if ((m = t.match(/^水(\d+)gに食塩(\d+)gをとかしました。できた食塩水の重さは何g/))) {
    const w = Number(m[1]), s = Number(m[2]);
    const expected = String(w + s);
    checked++;
    if (expected !== q.answer) { console.log('NG(g4 massAddA)', q.id, expected, q.answer); errors++; }
    return;
  }
  if ((m = t.match(/^水(\d+)gに食塩をとかして(\d+)gの食塩水を作りました。とかした食塩は何g/))) {
    const w = Number(m[1]), t2 = Number(m[2]);
    const expected = String(t2 - w);
    checked++;
    if (expected !== q.answer) { console.log('NG(g4 massAddB)', q.id, expected, q.answer); errors++; }
    return;
  }
  if ((m = t.match(/^食塩水(\d+)gを加熱して水を全部蒸発させると、食塩(\d+)gが残りました。とけていた水は何g/))) {
    const t2 = Number(m[1]), s = Number(m[2]);
    const expected = String(t2 - s);
    checked++;
    if (expected !== q.answer) { console.log('NG(g4 massAddC)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小4/小5共通：20℃の水100gにあるものは○gまでとけます。水△gには何gまでとける（整数のみ、小数可の別パターンは下で処理） ----
  if ((m = t.match(/^20℃の水100gにあるものは(\d+)gまでとけます。同じ温度の水(\d+)gには何gまでとける？(（小数も可）)?$/))) {
    const val = Number(m[1]), w = Number(m[2]);
    const expected = fmt1((val * w) / 100);
    checked++;
    if (expected !== q.answer) { console.log('NG(scale)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：濃度%の計算（水W gに食塩S gをとかした） ----
  if ((m = t.match(/^水(\d+)gに食塩(\d+)gをとかしました。この食塩水の濃度は何%/))) {
    const w = Number(m[1]), s = Number(m[2]);
    const expected = fmt1((s * 100) / (w + s));
    checked++;
    if (expected !== q.answer) { console.log('NG(noudo)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：P%の食塩水TgにふくまれるgSは？ ----
  if ((m = t.match(/^(\d+)%の食塩水(\d+)gにふくまれる食塩は何g/))) {
    const p = Number(m[1]), tt = Number(m[2]);
    const expected = fmt1((tt * p) / 100);
    checked++;
    if (expected !== q.answer) { console.log('NG(solute)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：P%の食塩水に食塩がSgとけています。全体は？ ----
  if ((m = t.match(/^(\d+)%の食塩水に食塩が(\d+)gとけています。この食塩水全体の重さは何g/))) {
    const p = Number(m[1]), s = Number(m[2]);
    const expected = fmt1((s * 100) / p);
    checked++;
    if (expected !== q.answer) { console.log('NG(total)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：とけ残り（20℃の水100gにあるものは○gまでとけます。△gを入れて…とけ残りは？） ----
  if ((m = t.match(/^20℃の水100gにあるものは(\d+)gまでとけます。(\d+)gを入れてよくかき混ぜると、とけ残りは何g/))) {
    const val = Number(m[1]), M = Number(m[2]);
    const expected = String(M - val);
    checked++;
    if (expected !== q.answer) { console.log('NG(leftover)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：希釈（P0%の食塩水T0gに水Awgを加えると濃度は？） ----
  if ((m = t.match(/^(\d+)%の食塩水(\d+)gに水(\d+)gを加えると、濃度は何%になる？(（小数も可）)?$/))) {
    const p0 = Number(m[1]), t0 = Number(m[2]), aw = Number(m[3]);
    const s = (t0 * p0) / 100;
    const expected = fmt1((s * 100) / (t0 + aw));
    checked++;
    if (expected !== q.answer) { console.log('NG(dilution)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：再結晶（60℃の水100gにあるものは○gまでとけます。20℃(△gまでとける)に冷やすと結晶は？） ----
  if ((m = t.match(/^60℃の水100gにあるものは(\d+)gまでとけます。この温度でほう和させた水よう液を20℃（(\d+)gまでとける）に冷やすと、結晶は何g出てくる/))) {
    const v60 = Number(m[1]), v20 = Number(m[2]);
    const expected = String(v60 - v20);
    checked++;
    if (expected !== q.answer) { console.log('NG(recryst)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：飽和食塩水から一部蒸発（36g固定） ----
  if ((m = t.match(/^20℃のほう和食塩水（水100gに食塩36g）から水を(\d+)g蒸発させると、食塩は何g出てくる/))) {
    const wev = Number(m[1]);
    const expected = fmt1((36 * wev) / 100);
    checked++;
    if (expected !== q.answer) { console.log('NG(evapPartial)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：2種の食塩水を混ぜる ----
  if ((m = t.match(/^(\d+)%の食塩水(\d+)gと(\d+)%の食塩水(\d+)gを混ぜると何%になる/))) {
    const p1 = Number(m[1]), t1 = Number(m[2]), p2 = Number(m[3]), t2 = Number(m[4]);
    const s = (t1 * p1) / 100 + (t2 * p2) / 100;
    const expected = fmt1((s * 100) / (t1 + t2));
    checked++;
    if (expected !== q.answer) { console.log('NG(mix)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小5：食塩を追加でとかす ----
  if ((m = t.match(/^(\d+)%の食塩水(\d+)gに食塩(\d+)gを加えて全部とかすと、濃度は何%になる/))) {
    const p0 = Number(m[1]), t0 = Number(m[2]), add = Number(m[3]);
    const s0 = (t0 * p0) / 100;
    const expected = fmt1(((s0 + add) * 100) / (t0 + add));
    checked++;
    if (expected !== q.answer) { console.log('NG(addSolute)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小6：中和の体積比 ----
  if ((m = t.match(/^うすい塩酸(\d+)cm³と水酸化ナトリウム水よう液(\d+)cm³がちょうど中和します。塩酸(\d+)cm³をちょうど中和させるには水酸化ナトリウム水よう液は何cm³必要/))) {
    const a = Number(m[1]), b = Number(m[2]), x = Number(m[3]);
    const expected = String((b * x) / a);
    checked++;
    if (expected !== q.answer) { console.log('NG(nakawaVol)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小6：中和でできる食塩の質量比 ----
  if ((m = t.match(/^水酸化ナトリウム水よう液(\d+)cm³を塩酸でちょうど中和させると食塩が(\d+)gできます。同じ濃さの水酸化ナトリウム水よう液(\d+)cm³をちょうど中和させると食塩は何gできる/))) {
    const V = Number(m[1]), M = Number(m[2]), v2 = Number(m[3]);
    const expected = String((M * v2) / V);
    checked++;
    if (expected !== q.answer) { console.log('NG(saltMass)', q.id, expected, q.answer); errors++; }
    return;
  }

  // ---- 小6：中和後に余る水酸化ナトリウム水よう液の体積 ----
  if ((m = t.match(/^塩酸(\d+)cm³と水酸化ナトリウム水よう液(\d+)cm³がちょうど中和します。塩酸(\d+)cm³に水酸化ナトリウム水よう液(\d+)cm³を加えると、中和されずに残る水酸化ナトリウム水よう液は何cm³分/))) {
    const a = Number(m[1]), b = Number(m[2]), a2 = Number(m[3]), M = Number(m[4]);
    const expected = String(M - b);
    checked++;
    if (expected !== q.answer) { console.log('NG(excessRemain)', q.id, expected, q.answer); errors++; }
    return;
  }
});

console.log(`検算数: ${checked}, エラー: ${errors}`);
