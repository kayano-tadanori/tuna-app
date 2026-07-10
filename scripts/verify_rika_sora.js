// rika_sora.json の新規計算問題(小5-6)を、問題文から独立に再計算して答えと照合する
const data = require('../data/rika_sora.json');

function toHalf(s) {
  return s.replace(/[０-９．]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

let checked = 0, errors = 0;

data.filter(q => q.grade >= 5).forEach(q => {
  const t = toHalf(q.question);
  let m;

  // 型: 時刻→位置 (nn時...mm時には、0°の位置から何度回転)
  if ((m = t.match(/(\d+)時に北極星を中心にして0°の位置に見えた.*?(\d+)時には、0°の位置から何度回転した位置に見えますか/))) {
    const start = Number(m[1]), end = Number(m[2]);
    const expected = String((end - start) * 15);
    checked++;
    if (expected !== q.answer) { console.log('NG(時刻→位置)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // 型: 年周運動 (nか月後の同じ時こくには、約何度動いて見えますか)
  if ((m = t.match(/(\d+)か月後の同じ時こくには、約何度動いて見えますか/))) {
    const months = Number(m[1]);
    const expected = String(months * 30);
    checked++;
    if (expected !== q.answer) { console.log('NG(年周運動)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // 型: 角度→時間 (90度から数えてNN度分だけ回転して見えました。何時間観察していた)
  if ((m = t.match(/90度から数えて(\d+)度分だけ回転して見えました。何時間観察していた/))) {
    const ang = Number(m[1]);
    const expected = String(ang / 15);
    checked++;
    if (expected !== q.answer) { console.log('NG(角度→時間)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // 型: 南中高度
  if ((m = t.match(/緯度(\d+)度の地点における(夏至|冬至|春分・秋分)の太陽の南中高度/))) {
    const lat = Number(m[1]); const season = m[2];
    let expected;
    if (season === '夏至') expected = lat === 90 ? 23.4 : 90 - lat + 23.4;
    else if (season === '冬至') expected = 90 - lat - 23.4;
    else expected = 90 - lat;
    expected = Math.round(expected * 10) / 10;
    checked++;
    if (String(expected) !== q.answer) { console.log('NG(南中高度)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // 型: 経度と時差
  if ((m = t.match(/東経135度の地点で太陽が南中する時こくは12時00分です。東経(\d+)度の地点で太陽が南中する時こくは何時何分/))) {
    const lon = Number(m[1]);
    const diffMin = (lon - 135) * 4;
    let ansMin = 12 * 60 - diffMin;
    let h = Math.floor(ansMin / 60), mi = ansMin % 60;
    const expected = `${h}時${mi === 0 ? '00' : String(mi).padStart(2, '0')}分`;
    checked++;
    if (expected !== q.answer) { console.log('NG(経度時差)', q.id, 'expected', expected, 'got', q.answer, 'lon', lon); errors++; }
    return;
  }

  // 型: 昼の長さ
  if ((m = t.match(/日の出は(\d+)時(\d+)分、日の入りは(\d+)時(\d+)分でした。この日の昼の長さは何時間何分/))) {
    const sr = Number(m[1]) * 60 + Number(m[2]);
    const ss = Number(m[3]) * 60 + Number(m[4]);
    const dur = ss - sr;
    const h = Math.floor(dur / 60), mi = dur % 60;
    const expected = `${h}時間${mi === 0 ? '0' : mi}分`;
    checked++;
    if (expected !== q.answer) { console.log('NG(昼の長さ)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // 型: 透明半球
  if ((m = t.match(/1時間ごとの点の間かくは([\d.]+)cmでした。日の出から南中（12時）までの弧の長さが([\d.]+)cmのとき、日の出の時こくは何時ですか/))) {
    const rate = Number(m[1]), arc = Number(m[2]);
    const hours = arc / rate;
    const expected = `${12 - hours}時`;
    checked++;
    if (expected !== q.answer) { console.log('NG(透明半球)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }

  // 型: 日周＋年周複合
  if ((m = t.match(/7月1日20時に、北極星を中心に0°の位置に見えた星座がありました。この星座を(\d+)か月後の8月1日から数えて、同じ日の20時から(\d+)時間後の時こくに観察すると、0°の位置から何度動いた位置に見えますか/))) {
    const mDiff = Number(m[1]), hDiff = Number(m[2]);
    const expected = String(hDiff * 15 + mDiff * 30);
    checked++;
    if (expected !== q.answer) { console.log('NG(複合)', q.id, 'expected', expected, 'got', q.answer); errors++; }
    return;
  }
});

console.log(`検算数: ${checked}, エラー: ${errors}`);
