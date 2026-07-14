// 浜学園 小5 V クラス相当の「特殊算」問題を生成して sansu_tokusan.json に追記
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'sansu_tokusan.json');
const src = JSON.parse(fs.readFileSync(file, 'utf8'));

const out = [];
const add = (question, answer, meaning, grade, difficulty) =>
  out.push({ question, answer: String(answer), meaning, grade, difficulty });

/* ── 1. 過不足算（余り・不足） ───────────────── */
[[5,12,7,8],[6,15,8,9],[4,20,7,10],[8,14,11,10],[3,25,5,15],[12,15,15,47]].forEach(([a,ex,b,sh]) => {
  const n = (ex + sh) / (b - a);
  if (!Number.isInteger(n)) return;
  add(`みかんを何人かの子どもに ${a}個ずつ配ると ${ex}個あまり、${b}個ずつ配ると ${sh}個たりません。子どもは何人いますか？`,
      n,
      `1人あたり${b}－${a}＝${b-a}個ずつ多く配ると、必要なみかんは${ex}＋${sh}＝${ex+sh}個増えます。よって子どもの人数は${ex+sh}÷${b-a}＝${n}人です。`,
      4, 3);
});
[[5,12,7,8],[6,15,8,9],[4,20,7,10]].forEach(([a,ex,b,sh]) => {
  const n = (ex + sh) / (b - a);
  if (!Number.isInteger(n)) return;
  add(`あめを何人かの子どもに ${a}個ずつ配ると ${ex}個あまり、${b}個ずつ配ると ${sh}個たりません。あめは全部で何個ありますか？`,
      a*n + ex,
      `子どもの人数は（${ex}＋${sh}）÷（${b}－${a}）＝${n}人です。あめは${a}×${n}＋${ex}＝${a*n+ex}個あります。`,
      4, 3);
});
[[6,15,4,21],[8,10,5,25],[9,8,6,26]].forEach(([a,ex1,b,ex2]) => {
  const n = (ex2 - ex1) / (a - b);
  if (!Number.isInteger(n) || n <= 0) return;
  add(`色紙を何人かの子どもに ${a}枚ずつ配ると ${ex1}枚あまり、${b}枚ずつ配ると ${ex2}枚あまります。子どもは何人いますか？`,
      n,
      `1人あたり${a}－${b}＝${a-b}枚少なく配ると、あまりは${ex2}－${ex1}＝${ex2-ex1}枚増えます。よって人数は${ex2-ex1}÷${a-b}＝${n}人です。`,
      5, 3);
});

/* ── 2. 差集め算（単価の差） ─────────────────── */
[[60,45,6,390],[80,50,5,250],[70,40,8,320],[90,60,4,300]].forEach(([pa,pb,more,diff]) => {
  // A: a本 pa円、B: (a+more)本 pb円、代金差 A-B = diff
  const a = (diff + pb*more) / (pa - pb);
  if (!Number.isInteger(a) || a <= 0) return;
  add(`太郎君は1本 ${pa}円のえんぴつを、次郎君は1本 ${pb}円のえんぴつを買いました。買った本数は次郎君の方が ${more}本多く、代金は太郎君の方が ${diff}円多かったそうです。太郎君はえんぴつを何本買いましたか？`,
      a,
      `もし次郎君も太郎君と同じ本数なら、次郎君の代金は${pb}×${more}＝${pb*more}円安くなり、代金の差は${diff}＋${pb*more}＝${diff+pb*more}円になります。同じ本数なら1本あたりの差は${pa}－${pb}＝${pa-pb}円なので、太郎君の本数は${diff+pb*more}÷${pa-pb}＝${a}本です。`,
      5, 5);
});
[[50,5,3,20]].forEach(([p,up,less,left]) => {
  // 予定: 全部でN本買える金額 M = p*N。実際: (p+up) 円で (N-less)本買って left円あまり
  // M = (p+up)*(N-less) + left → p*N = (p+up)N - (p+up)*less + left → 0 = up*N - (p+up)*less + left
  const N = ((p+up)*less - left) / up;
  add(`1本 ${p}円のえんぴつをちょうど何本か買えるだけのお金を持って店に行きましたが、1本につき ${up}円値上がりしていたので、予定より ${less}本少なくしか買うことができず、${left}円のおつりがありました。お店に持っていったお金は何円ですか？`,
      p*N,
      `値上がり後は1本${p}＋${up}＝${p+up}円です。実際に買えた本数を□本とすると、持っていたお金は ${p+up}×□＋${left} 円。また、予定では${p}円で□＋${less}本ちょうど買えたので ${p}×(□＋${less}) 円でもあります。${p+up}×□＋${left}＝${p}×□＋${p*less} より ${up}×□＝${p*less-left}、□＝${(p*less-left)/up}本。持っていったお金は${p}×${N}＝${p*N}円です。`,
      6, 5);
});
[[80,120,120]].forEach(([pa,pb,left]) => {
  // 同じ本数ずつ買う予定で 2760円。本数を反対にして 120円あまった → 実は同数なので…（V型）
  const total = 2760;
  const n = total / (pa + pb);
  add(`1本 ${pa}円のえんぴつと1本 ${pb}円のボールペンを、それぞれ何本かずつ買うつもりで ${total}円を持って店に行きましたが、買う本数を反対にしてしまったので ${left}円あまりました。えんぴつを何本買うつもりでしたか？`,
      (total - 0) / 1 && (() => {
        // えんぴつ x 本、ボールペン y 本の予定 → 80x+120y = 2760
        // 反対 → 80y+120x = 2760-120 = 2640 → 足すと 200(x+y)=5400 → x+y=27、引くと 40(y-x)=120 → y-x=3
        const sum = (total + (total - left)) / (pa + pb);
        const dif = left / (pb - pa);
        return (sum - dif) / 2;
      })(),
      `予定を「えんぴつ x 本、ボールペン y 本」とすると ${pa}x＋${pb}y＝${total}。本数を反対にすると ${pa}y＋${pb}x＝${total}－${left}＝${total-left}。2式をたすと ${pa+pb}×(x＋y)＝${total + total - left} なので x＋y＝${(total + total - left)/(pa+pb)}。2式をひくと ${pb-pa}×(y－x)＝${left} なので y－x＝${left/(pb-pa)}。よって x＝(${(total + total - left)/(pa+pb)}－${left/(pb-pa)})÷2＝${((total + total - left)/(pa+pb) - left/(pb-pa))/2}本です。`,
      6, 5);
});

/* ── 3. つるかめ算（発展） ───────────────────── */
[[46,28,25,970],[50,70,40,2200],[60,90,30,2100]].forEach(([pa,pb,n,total]) => {
  const a = (total - pb*n) / (pa - pb);
  if (!Number.isInteger(a) || a < 0 || a > n) return;
  add(`1個 ${pa}円のりんごと1個 ${pb}円のみかんをあわせて ${n}個買ったら、${total}円になりました。りんごは何個買いましたか？`,
      a,
      `全部みかんだったとすると${pb}×${n}＝${pb*n}円。実際との差は${total}－${pb*n}＝${total-pb*n}円です。みかん1個をりんご1個にかえるごとに${pa}－${pb}＝${pa-pb}円ふえるので、りんごは${total-pb*n}÷${pa-pb}＝${a}個です。`,
      5, 3);
});
[[20,60,300,4080]].forEach(([get,fine,n,pay]) => {
  const broken = (get*n - pay) / (get + fine);
  add(`コップを運ぶ仕事で、1個運ぶと運賃として ${get}円もらえますが、途中で1個こわすと運賃がもらえないばかりでなく ${fine}円のべんしょうをしなければなりません。いま ${n}個運んで ${pay}円もらいました。この人はコップを何個こわしましたか？`,
      broken,
      `全部無事に運べば${get}×${n}＝${get*n}円のはずですが、実際は${pay}円で、差は${get*n-pay}円です。1個こわすともらえるはずの${get}円がなくなり、さらに${fine}円はらうので、1個あたり${get}＋${fine}＝${get+fine}円へります。よってこわしたのは${get*n-pay}÷${get+fine}＝${broken}個です。`,
      5, 5);
});
[[90,70,60,52,3840,2]].forEach(([p1,p2,p3,n,total,k]) => {
  // 70円ノートは60円ノートの k倍。60円をx冊 → 70円 kx冊、90円 n-x-kx冊
  // 90(n - x - kx) + 70kx + 60x = total
  const x = (p1*n - total) / (p1*(1+k) - p2*k - p3);
  const c90 = n - x - k*x;
  add(`1冊の値段がそれぞれ ${p1}円、${p2}円、${p3}円の3種類のノートを合計 ${n}冊買って、${total}円支払いました。${p2}円のノートは、${p3}円のノートの ${k}倍だけ買いました。${p1}円のノートは何冊買いましたか？`,
      c90,
      `${p3}円のノートを x 冊とすると ${p2}円は ${k}x 冊、${p1}円は ${n}－${1+k}x 冊です。代金は ${p1}×(${n}－${1+k}x)＋${p2}×${k}x＋${p3}×x＝${total}。全部${p1}円とすると${p1*n}円で、差${p1*n-total}円は 1組(${p3}円1冊＋${p2}円${k}冊)を${p1}円${1+k}冊とかえたときの差 ${p1*(1+k)-p2*k-p3}円の x 倍。x＝${p1*n-total}÷${p1*(1+k)-p2*k-p3}＝${x}冊なので、${p1}円のノートは${n}－${(1+k)*x}＝${c90}冊です。`,
      6, 5);
});

/* ── 4. 平均算 ───────────────────────────────── */
[[[72,85,68],4,80],[[64,78,90,72],5,80],[[88,76],3,85]].forEach(([sc,n,target]) => {
  const need = target*n - sc.reduce((a,b)=>a+b,0);
  add(`${sc.length}科目のテストの点数は ${sc.join('点、')}点 でした。${n}科目全部の平均を ${target}点にするには、残り1科目で何点取ればよいですか？`,
      need,
      `${n}科目の合計は${target}×${n}＝${target*n}点必要です。いままでの合計は${sc.join('＋')}＝${sc.reduce((a,b)=>a+b,0)}点なので、あと${target*n}－${sc.reduce((a,b)=>a+b,0)}＝${need}点必要です。`,
      5, 3);
});
[[18,72,22,67],[20,85,30,75],[15,90,25,74],[24,68,16,78]].forEach(([na,pa,nb,pb]) => {
  const avg = (na*pa + nb*pb) / (na + nb);
  if (!Number.isInteger(avg*10)) return;
  add(`男子 ${na}人の平均点は ${pa}点、女子 ${nb}人の平均点は ${pb}点でした。クラス全体の平均点は何点ですか？`,
      Math.round(avg*100)/100,
      `合計点は${na}×${pa}＋${nb}×${pb}＝${na*pa}＋${nb*pb}＝${na*pa+nb*pb}点。人数は${na}＋${nb}＝${na+nb}人なので、平均は${na*pa+nb*pb}÷${na+nb}＝${Math.round(avg*100)/100}点です。`,
      5, 3);
});
[[5,76,82],[4,68,75],[6,80,86]].forEach(([n,avg,next]) => {
  const newAvg = (n*avg + next) / (n + 1);
  if (!Number.isInteger(newAvg*100)) return;
  add(`これまでに ${n}回のテストを受け、平均は ${avg}点でした。次のテストで ${next}点を取ると、平均は何点になりますか？`,
      Math.round(newAvg*100)/100,
      `いままでの合計は${avg}×${n}＝${n*avg}点。次を加えると${n*avg}＋${next}＝${n*avg+next}点で、回数は${n+1}回。平均は${n*avg+next}÷${n+1}＝${Math.round(newAvg*100)/100}点です。`,
      5, 3);
});

/* ── 5. 消去算 ───────────────────────────────── */
[[5,3,470,7,6,820],[3,2,530,5,4,910],[4,5,760,6,3,780]].forEach(([a1,b1,t1,a2,b2,t2]) => {
  // a1*M + b1*R = t1 ; a2*M + b2*R = t2 → 解く
  const det = a1*b2 - a2*b1;
  const M = (t1*b2 - t2*b1) / det;
  const R = (a1*t2 - a2*t1) / det;
  if (!Number.isInteger(M) || !Number.isInteger(R) || M <= 0 || R <= 0) return;
  add(`みかん ${a1}個とりんご ${b1}個では ${t1}円ですが、みかん ${a2}個とりんご ${b2}個では ${t2}円です。りんご1個の値段は何円ですか？`,
      R,
      `2つの式をそろえて消去します。みかんの個数を${a1}と${a2}の最小公倍数にそろえると、りんごの個数の差から、りんご1個は${R}円、みかん1個は${M}円と分かります。`,
      5, 4);
});
[[5,2,3,1,770]].forEach(([a1,b1,a2,b2,t]) => {
  // みかん5個＝りんご2個の値段、みかん3個＋りんご1個 = 770
  // M*5 = R*2 → R = 2.5M ; 3M + 2.5M = 5.5M = 770 → M=140, R=350
  const M = t / (a2 + b2*a1/b1);
  const R = M*a1/b1;
  add(`みかん ${a1}個とりんご ${b1}個の値段が等しく、また、みかん ${a2}個とりんご ${b2}個の値段の和が ${t}円のとき、みかん1個の値段は何円ですか？`,
      M,
      `みかん${a1}個＝りんご${b1}個 なので、りんご1個はみかん${a1}/${b1}個分にあたります。みかん${a2}個＋りんご${b2}個 ＝ みかん${a2}＋${a1*b2/b1}＝${a2 + a1*b2/b1}個分 が${t}円。よってみかん1個は${t}÷${a2 + a1*b2/b1}＝${M}円です。`,
      6, 5);
});

/* ── 6. 周期算（鐘・花火・くり返し） ─────────── */
[[108,7],[36,5],[60,4],[21,9]].forEach(([n,gap]) => {
  const t = (n - 1) * gap;
  add(`除夜の鐘を ${n}回つきます。1回目をついてから次をつくまで ${gap}秒かかるとすると、${n}回つき終わるまでに何秒かかりますか？`,
      t,
      `鐘と鐘の「間」の数は${n}－1＝${n-1}個です（植木算の考え方）。よって${gap}×${n-1}＝${t}秒かかります。`,
      4, 3);
});
[[6,8],[4,10],[5,12],[9,6]].forEach(([a,b]) => {
  const l = a*b/(function g(x,y){return y?g(y,x%y):x;})(a,b);
  add(`2種類の花火があり、A は ${a}秒ごとに、B は ${b}秒ごとに上がります。同時に上がったあと、次に同時に上がるのは何秒後ですか？`,
      l,
      `${a}と${b}の最小公倍数を求めます。${a}と${b}の最小公倍数は${l}なので、${l}秒後に次に同時に上がります。`,
      5, 3);
});
[[7,100],[5,73],[6,150],[4,99]].forEach(([p,n]) => {
  const r = n % p === 0 ? p : n % p;
  add(`「1、2、3、…、${p}」の ${p}個の数がこの順にくり返し並んでいます。左から ${n}番目の数はいくつですか？`,
      r,
      `${p}個で1周期です。${n}÷${p}＝${Math.floor(n/p)}あまり${n%p}なので、${n%p === 0 ? `ちょうど割り切れて周期の最後の数、つまり${p}です` : `${Math.floor(n/p)}周期のあと${n%p}番目、つまり${r}です`}。`,
      5, 3);
});

/* ── 7. 分配算（差と倍） ─────────────────────── */
[[3800,4,120,3,160]].forEach(([s,ma,pa,mb,pb]) => {
  // B = A*4 - 120, C = B/3 + 160 ; A+B+C = 3800
  // C = (4A-120)/3 + 160 → A + 4A -120 + (4A-120)/3 + 160 = 3800
  // ×3: 3A + 12A - 360 + 4A - 120 + 480 = 11400 → 19A = 11400 → A = 600
  const A = (s*3 - (-360 - 120 + 480)) / 19;
  const B = 4*A - 120, C = (B/3) + 160;
  add(`${s}円を A、B、C の3人で分けるのに、B は A の ${ma}倍より ${pa}円少なく、C は B の 1/${mb} より ${pb}円多くなるようにしたいと思います。A は何円もらえばよいですか？`,
      A,
      `A を①とすると B＝④－${pa}円、C＝(④－${pa})÷${mb}＋${pb}円。3人の合計が${s}円になる式を作って解くと、①＝${A}円です（B＝${B}円、C＝${C}円）。`,
      6, 5);
});
[[6900,4,5,5,4,5400]].forEach(([total,na,da,nb,db,part]) => {
  // 兄+弟 = 6900、兄*4/5 + 弟*3/4 = 5400 …実際のV問題を数値変更
  // 兄 = x, 弟 = 6900-x ; (4/5)x + (3/4)(6900-x) = 5400
  const x = (part - (3/4)*total) / (4/5 - 3/4);
  const otouto = total - x;
  add(`兄弟の所持金の合計は ${total}円で、兄の所持金の 4/5 と弟の所持金の 3/4 の合計は ${part}円になります。弟の所持金はいくらですか？`,
      Math.round(otouto),
      `もし2人とも 3/4 ずつなら ${total}×3/4＝${total*3/4}円のはずですが、実際は${part}円で${part - total*3/4}円多いです。この差は兄の分だけ 4/5－3/4＝1/20 多いことから生まれるので、兄は${part - total*3/4}÷(1/20)＝${Math.round(x)}円。弟は${total}－${Math.round(x)}＝${Math.round(otouto)}円です。`,
      6, 5);
});

/* ── 8. 和差算（V型） ───────────────────────── */
[[900,30,90],[1200,60,60],[600,20,40]].forEach(([s,p,q]) => {
  // A は B より p 多く、B は C より q 多い
  const C = (s - (p+q) - q) / 3;
  if (!Number.isInteger(C)) return;
  add(`${s}円を A、B、C の3人で分けたところ、A は B より ${p}円多く、B は C より ${q}円多くなりました。C の取り分は何円ですか？`,
      C,
      `C を基準にすると B＝C＋${q}、A＝C＋${p+q}。合計は C×3＋${q}＋${p+q}＝${s}円なので、C×3＝${s-q-(p+q)}、C＝${C}円です。`,
      4, 3);
});
[[270,35,5,12]].forEach(([now,diff0,less,more]) => {
  // 去年: 男 = 女 + 35。今年: 男 -5、女 +12、合計 270
  // (男-5)+(女+12) = 270 → 男+女 = 263 ; 男 = 女+35 → 女 = 114、男 = 149 → 今年の男 = 144
  const sumLast = now + less - more;
  const girlLast = (sumLast - diff0) / 2;
  const boyLast = sumLast - girlLast;
  add(`ある学校の生徒数は、男子が女子より ${diff0}人多かったのですが、今年は昨年に比べて男子が ${less}人少なくなり、女子が ${more}人多くなったので、合計 ${now}人になりました。今年の男子は何人ですか？`,
      boyLast - less,
      `昨年の合計は${now}＋${less}－${more}＝${sumLast}人です。和差算より、昨年の女子は(${sumLast}－${diff0})÷2＝${girlLast}人、男子は${boyLast}人。今年の男子は${boyLast}－${less}＝${boyLast - less}人です。`,
      5, 4);
});

/* ── 9. 植木算（間の数） ─────────────────────── */
[[40,60,25],[30,50,20],[20,50,18]].forEach(([g1,g2,diff]) => {
  // 距離D: D/g1 - D/g2 = diff (両端に立てるなら +1 が打ち消し合う)
  const D = diff / (1/g1 - 1/g2);
  if (!Number.isInteger(D)) return;
  add(`A、B 両地間に電柱を立てます。${g1}m 間かくで立てるのと ${g2}m 間かくで立てるのとでは ${diff}本のちがいがあります。A、B 間の距離は何 m ですか？`,
      D,
      `本数の差は間の数の差と同じです。距離を D とすると D÷${g1}－D÷${g2}＝${diff}。1mあたり 1/${g1}－1/${g2}＝${(g2-g1)}/${g1*g2} 本の差なので、D＝${diff}÷(${g2-g1}/${g1*g2})＝${D}mです。`,
      5, 5);
});

/* ── 保存 ───────────────────────────────────── */
const start = src.length;
const added = out.map((q, i) => ({
  id: 'st' + String(start + i + 1).padStart(3, '0'),
  question: q.question, answer: q.answer, meaning: q.meaning,
  grade: q.grade, difficulty: q.difficulty,
}));
const all = src.concat(added);
if (new Set(all.map(q => q.id)).size !== all.length) throw new Error('ID重複');
added.forEach(q => {
  if (!/^\d+(\.\d+)?$/.test(q.answer)) throw new Error('答えが不正: ' + q.id + ' = ' + q.answer);
});
fs.writeFileSync(file, JSON.stringify(all, null, 2), 'utf8');
console.log('追加:', added.length, '/ 合計:', all.length);
