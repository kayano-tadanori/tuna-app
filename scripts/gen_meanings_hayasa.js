const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'data', 'sansu_hayasa.json');
const data = require(srcPath);

function norm(q) {
  return q.replace(/[0-9０-９.]+/g, '#');
}

// Pattern definitions: regex captures numbers in order (integers, since no decimals appear in questions)
const patterns = [
  {
    key: '時速#kmは秒速何mですか？',
    re: /^時速(\d+)kmは秒速何mですか？$/,
    gen: ([A], answer) => {
      const Am = A * 1000;
      return `時速${A}kmとは、1時間で${A}km（${Am}m）進む速さのことです。1時間は3600秒なので、${Am}mを3600秒でわると、秒速は${A}×1000÷3600＝${answer}mになります。`;
    }
  },
  {
    key: '秒速#mは時速何kmですか？',
    re: /^秒速(\d+)mは時速何kmですか？$/,
    gen: ([A], answer) => {
      return `秒速${A}mとは、1秒間に${A}m進む速さのことです。1時間は3600秒あるので、${A}×3600で1時間に進む道のり（m）が求まり、それを1000でわってkmに直すと、${A}×3600÷1000＝${answer}kmになります。`;
    }
  },
  {
    key: '時速#kmで#時間進むと何km進みますか？（小数で答えよ）',
    re: /^時速(\d+)kmで(\d+)時間進むと何km進みますか？（小数で答えよ）$/,
    gen: ([A, B], answer) => {
      return `道のり＝速さ×時間の関係を使います。時速${A}kmで${B}時間進むので、${A}×${B}＝${answer}kmです。`;
    }
  },
  {
    key: '#kmを#時間で歩きました。時速何kmですか？（小数で答えよ）',
    re: /^(\d+)kmを(\d+)時間で歩きました。時速何kmですか？（小数で答えよ）$/,
    gen: ([A, B], answer) => {
      return `時速（1時間あたりに進む道のり）を求めるので、道のりを時間でわります。${A}km÷${B}時間＝${answer}より、時速${answer}kmです。`;
    }
  },
  {
    key: '#kmの道のりを#分で走りました。分速何mですか？',
    re: /^(\d+)kmの道のりを(\d+)分で走りました。分速何mですか？$/,
    gen: ([A, B], answer) => {
      const Am = A * 1000;
      return `分速（1分あたりに進む道のり）をmの単位で求めるには、道のりをmに直してから時間（分）でわる必要があります。${A}kmは${Am}mなので、${Am}÷${B}＝${A}×1000÷${B}＝${answer}より、分速${answer}mです。`;
    }
  },
  {
    key: '分速#mで#時間進むと何km進みますか？（小数で答えよ）',
    re: /^分速(\d+)mで(\d+)時間進むと何km進みますか？（小数で答えよ）$/,
    gen: ([A, B], answer) => {
      return `分速を使って、何時間分の道のりをまず求め、それをkmに直します。${B}時間は${B}×60分なので、${A}×60×${B}で進む道のり（m）が求まり、それを1000でわってkmに直すと、${A}×60×${B}÷1000＝${answer}kmです。`;
    }
  },
  {
    key: '時速#kmの自転車で#分走ると何km進みますか？（小数で答えよ）',
    re: /^時速(\d+)kmの自転車で(\d+)分走ると何km進みますか？（小数で答えよ）$/,
    gen: ([A, B], answer) => {
      return `時速を使って何分間で進む道のりを求めるので、まず${B}分を時間の単位に直します。${B}分は${B}÷60時間にあたるので、道のり＝速さ×時間より、${A}×${B}÷60＝${answer}kmです。`;
    }
  },
  {
    key: 'はじめ#mを#分で、続けて#mを#分で歩きました。全体の平均の速さは分速何mですか？',
    re: /^はじめ(\d+)mを(\d+)分で、続けて(\d+)mを(\d+)分で歩きました。全体の平均の速さは分速何mですか？$/,
    gen: ([A, B, C, D], answer) => {
      const sumM = A + C;
      const sumT = B + D;
      return `平均の速さは、全体の道のりを全体の時間でわって求めます。①歩いた道のりの合計は${A}＋${C}＝${sumM}m、②かかった時間の合計は${B}＋${D}＝${sumT}分です。よって、平均の速さは(${A}＋${C})÷(${B}＋${D})＝${answer}より、分速${answer}mです。`;
    }
  },
  {
    key: '静水での速さが時速#kmのA船と時速#kmのB船が、#kmはなれた川の両岸から同時に向かい合って出発しました。流れの影響がない区間だとすると、何時間後に出会いますか。',
    re: /^静水での速さが時速(\d+)kmのA船と時速(\d+)kmのB船が、(\d+)kmはなれた川の両岸から同時に向かい合って出発しました。流れの影響がない区間だとすると、何時間後に出会いますか。$/,
    gen: ([A, B, C], answer) => {
      const sum = A + B;
      return `①A船とB船は向かい合って進むので、1時間ごとに2隻の間の距離は2隻の速さの和だけ縮まります。その和は${A}＋${B}＝${sum}km/時です。②はじめの間の距離${C}kmをこの縮まる速さでわれば出会うまでの時間がわかるので、${C}÷(${A}＋${B})＝${answer}より、${answer}時間後に出会います。`;
    }
  },
  {
    key: '上りの速さが時速#km、下りの速さが時速#kmの船があります。この川の流れの速さは時速何kmですか。',
    re: /^上りの速さが時速(\d+)km、下りの速さが時速(\d+)kmの船があります。この川の流れの速さは時速何kmですか。$/,
    gen: ([A, B], answer) => {
      return `川を上るときは船の速さから流れの速さが引かれ、下るときは足されます。下りの速さと上りの速さの差は、流れの速さのちょうど2倍にあたるので、(${B}－${A})÷2＝${answer}より、流れの速さは時速${answer}kmです。`;
    }
  },
  {
    key: '上りの速さが時速#km、下りの速さが時速#kmの船があります。この船の静水での速さは時速何kmですか。',
    re: /^上りの速さが時速(\d+)km、下りの速さが時速(\d+)kmの船があります。この船の静水での速さは時速何kmですか。$/,
    gen: ([A, B], answer) => {
      return `川を上るときは船の速さから流れの速さが引かれ、下るときは足されます。上りの速さと下りの速さを合計すると、流れの速さ分が打ち消し合って船の速さの2倍になるので、(${A}＋${B})÷2＝${answer}より、静水（流れのないところ）での船の速さは時速${answer}kmです。`;
    }
  },
  {
    key: '分速#mの自転車が、分速#mで歩いている人を追いかけます。人が#m先を歩いているとき、自転車が追いつくのは何分後ですか。',
    re: /^分速(\d+)mの自転車が、分速(\d+)mで歩いている人を追いかけます。人が(\d+)m先を歩いているとき、自転車が追いつくのは何分後ですか。$/,
    gen: ([A, B, C], answer) => {
      const diff = A - B;
      return `これは追いつき算です。①自転車と人の速さの差（1分間で縮まる差）は${A}－${B}＝${diff}mです。②はじめの差${C}mをこの縮まる速さでわれば追いつくまでの時間がわかるので、${C}÷(${A}－${B})＝${answer}より、${answer}分後に追いつきます。`;
    }
  },
  {
    key: '分速#mで#分歩くと何m進みますか？',
    re: /^分速(\d+)mで(\d+)分歩くと何m進みますか？$/,
    gen: ([A, B], answer) => {
      return `道のり＝速さ×時間なので、分速${A}mで${B}分歩くと、${A}×${B}＝${answer}m進みます。`;
    }
  },
  {
    key: '時速#kmで#分歩くと何km進みますか？（小数で答えよ）',
    re: /^時速(\d+)kmで(\d+)分歩くと何km進みますか？（小数で答えよ）$/,
    gen: ([A, B], answer) => {
      return `時速を使って何分間で進む道のりを求めるので、まず${B}分を時間の単位に直します。${B}分は${B}÷60時間にあたるので、道のり＝速さ×時間より、${A}×${B}÷60＝${answer}kmです。`;
    }
  },
  {
    key: 'AとBが同時に反対方向へ歩き出しました。速さの比は#：#で、#人合わせて#km歩いたとき、Bは何km歩きましたか？',
    re: /^AとBが同時に反対方向へ歩き出しました。速さの比は(\d+)：(\d+)で、(\d+)人合わせて(\d+)km歩いたとき、Bは何km歩きましたか？$/,
    gen: ([a, b, n, total], answer) => {
      const sum = a + b;
      return `①同じ時間だけ歩くので、AとBが歩いた道のりの比も速さの比と同じ${a}：${b}になります。②2人合わせて${total}km歩いたので、これを比の和${a}＋${b}＝${sum}で等分してBの比${b}をかければBの道のりがわかります。${total}÷(${a}＋${b})×${b}＝${answer}より、Bは${answer}km歩きました。`;
    }
  },
  {
    key: '同じ船で、川を下る速さは時速#km、上る速さは時速#kmです。川の流れの速さは時速何kmですか？',
    re: /^同じ船で、川を下る速さは時速(\d+)km、上る速さは時速(\d+)kmです。川の流れの速さは時速何kmですか？$/,
    gen: ([A, B], answer) => {
      return `川を下るときは船の速さに流れの速さが足され、上るときは引かれます。下りの速さと上りの速さの差は、流れの速さのちょうど2倍にあたるので、(${A}－${B})÷2＝${answer}より、流れの速さは時速${answer}kmです。`;
    }
  },
  {
    key: '静水での速さが時速#kmの船が、流れの速さ時速#kmの川を上ります。上りの速さは時速何kmですか？',
    re: /^静水での速さが時速(\d+)kmの船が、流れの速さ時速(\d+)kmの川を上ります。上りの速さは時速何kmですか？$/,
    gen: ([A, B], answer) => {
      return `川を上るときは、静水での速さから流れの速さの分だけ遅くなります。よって、上りの速さは${A}－${B}＝${answer}kmです。`;
    }
  },
  {
    key: '同じ道のりを進むのに、AとBの速さの比は#：#です。Bが#分かかるとき、Aは何分かかりますか？',
    re: /^同じ道のりを進むのに、AとBの速さの比は(\d+)：(\d+)です。Bが(\d+)分かかるとき、Aは何分かかりますか？$/,
    gen: ([a, b, tB], answer) => {
      return `同じ道のりを進むとき、速さの比と時間の比は逆比になります。速さの比が${a}：${b}なので、時間の比は${b}：${a}です。Bが${tB}分かかるので、Aがかかる時間は${tB}×${b}÷${a}＝${answer}より、Aは${answer}分かかります。`;
    }
  },
  {
    key: '静水時速#kmの船が、流れ時速#kmの川を下ります。下りの速さは時速何kmですか？',
    re: /^静水時速(\d+)kmの船が、流れ時速(\d+)kmの川を下ります。下りの速さは時速何kmですか？$/,
    gen: ([A, B], answer) => {
      return `川を下るときは、静水での速さに流れの速さが足されます。よって、下りの速さは${A}＋${B}＝${answer}kmです。`;
    }
  }
];

const results = [];
const unmatched = [];

for (const item of data) {
  let matched = false;
  for (const p of patterns) {
    const m = item.question.match(p.re);
    if (m) {
      const nums = m.slice(1).map(Number);
      const meaning = p.gen(nums, item.answer);
      results.push({ id: item.id, meaning });
      matched = true;
      break;
    }
  }
  if (!matched) {
    unmatched.push(item);
  }
}

console.log('total items:', data.length);
console.log('matched:', results.length);
console.log('unmatched:', unmatched.length);
if (unmatched.length) {
  unmatched.slice(0, 10).forEach(x => console.log('UNMATCHED:', JSON.stringify(x)));
}

const outPath = path.join(__dirname, 'meanings_hayasa.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
console.log('wrote', outPath);
