// ============================================================
// 算数モード
// ============================================================

const SANSU_FILES = {
  bakuhatsu: 'data/sansu_bakuhatsu.json',
  keisan:  'data/sansu_keisan.json',
  bun:     'data/sansu_bun.json',
  zu:      'data/sansu_zu.json',
  kisoku:  'data/sansu_kisoku.json',
  tokusan: 'data/sansu_tokusan.json',
  baai:    'data/sansu_baai.json',
  kazu:    'data/sansu_kazu.json',
  wariai:  'data/sansu_wariai.json',
  hayasa:  'data/sansu_hayasa.json',
  rittai:  'data/sansu_rittai.json',
};
const SANSU_CAT_LABELS = {
  bakuhatsu:'バクハツ', keisan:'計算', bun:'文章題', zu:'平面図形', kisoku:'規則性',
  tokusan:'特殊算', baai:'場合の数', kazu:'数の性質',
  wariai:'割合と比', hayasa:'速さ', rittai:'立体図形', hama:'じゅくナビ'
};
const DIFF_LABELS = { 1:'やさしい', 2:'難しい', 3:'チャレンジ', 4:'激ムズ', 5:'灘中レベル', gachi:'灘中レベル（ガチ）', kaisetsu:'かんたん解説' };
const DRILL_TYPE_LABELS = {
  add:'足し算', sub:'引き算', mul:'かけ算', div:'割り算',
  divrem:'余りあり', decimal:'小数', fraction:'分数', mix:'ミックス'
};

// ── 計算ドリルのランキング（2026-07-28）────────────────────────
// 学年×種類×難易度×タイムで1本ずつ独立したランキングを持つ。
// 学年を混ぜないのは、同じ「足し算・激ムズ・60秒」でも学年で出る数の大きさが違うから。
// 無制限モードは対象外（時間の縛りがなく、1問だけ正解してやめれば満点になるので比べられない）。
function drillGameKey() {
  const s = sansuState;
  return `drill_g${s.grade}_${s.drillType}_d${s.drillDiff}_t${s.drillTime}`;
}
function drillRankTitle() {
  const s = sansuState;
  return `小${s.grade} ${DRILL_TYPE_LABELS[s.drillType]}・${DIFF_LABELS[s.drillDiff]}・${s.drillTime}秒`;
}
// 自己ベストは組み合わせごとに散らさず 'drillBest' 1つのJSONにまとめる。
// （キーが可変だと BACKUP_KEYS とFirestoreルールの許可リストに載せられずクラウド保存から漏れるため）
function getDrillBests() {
  try { return JSON.parse(localStorage.getItem('drillBest') || '{}'); } catch (e) { return {}; }
}
function getDrillBest(key) { return Number(getDrillBests()[key] || 0); }
function setDrillBest(key, v) {
  const b = getDrillBests();
  b[key] = v;
  localStorage.setItem('drillBest', JSON.stringify(b));
}

// 理科ファイル・ラベル
const RIKA_FILES = {
  shokubutsu:'data/rika_shokubutsu.json', doubutsu:'data/rika_doubutsu.json',
  jintai:'data/rika_jintai.json',
  sora:'data/rika_sora.json', tenki:'data/rika_tenki.json', daichi:'data/rika_daichi.json',
  mono:'data/rika_mono.json', kitai:'data/rika_kitai.json', suiyoueki:'data/rika_suiyoueki.json',
  denki:'data/rika_denki.json', chikara:'data/rika_chikara.json',
  hikari_oto:'data/rika_hikarioto.json',
};
const RIKA_CAT_LABELS = {
  shokubutsu:'植物', doubutsu:'動物', jintai:'人体', sora:'天体', tenki:'天気', daichi:'大地の変化',
  mono:'もののせいしつ', kitai:'気体', suiyoueki:'水よう液', denki:'電気と磁石', chikara:'力のつり合い',
  hikari_oto:'光と音',
};

// 社会ファイル・ラベル
const SHAKAI_FILES = {
  kokudo:'data/shakai_kokudo.json', sangyo:'data/shakai_sangyo.json',
  rekishi:'data/shakai_rekishi.json', komin:'data/shakai_komin.json',
};
const SHAKAI_CAT_LABELS = {
  kokudo:'国土と自然', sangyo:'産業とくらし', rekishi:'日本の歴史', komin:'政治と国際',
};

// ── 教科ごとの表は、ここ1か所で引く ──────────────────────
// 前は subject === 'rika' ? RIKA_FILES : subject === 'shakai' ? SHAKAI_FILES : SANSU_FILES
// という同じ三項演算子が6か所にコピーされていた。教科を1つ足すたびに6か所すべてを
// 直す必要があり、直し忘れると「データはあるのに画面に出ない」になる（2026-08-08に整理）。
// ★中身を関数で包んであるのは、表の定義より先に読まれても平気にするため。
const SUBJECT_TABLES = {
  sansu:  { files: () => SANSU_FILES,  labels: () => SANSU_CAT_LABELS,  home: 'sansu-home' },
  rika:   { files: () => RIKA_FILES,   labels: () => RIKA_CAT_LABELS,   home: 'rika-home' },
  shakai: { files: () => SHAKAI_FILES, labels: () => SHAKAI_CAT_LABELS, home: 'shakai-home' },
};
// 知らない教科（国語のじゅくナビ・灘合など）は算数の表にそろえる＝前と同じふるまい
const subjectTable  = (subject) => SUBJECT_TABLES[subject] || SUBJECT_TABLES.sansu;
const subjectFiles  = (subject) => subjectTable(subject).files();
const subjectLabels = (subject) => subjectTable(subject).labels();
const subjectHome   = (subject) => subjectTable(subject).home;

// 連鎖問題（難易度5・灘中レベル）ファイル
const CHAIN_FILES = {
  sansu: 'data/sansu_chain.json',
  rika: 'data/rika_chain.json',
  shakai: 'data/shakai_chain.json',
  gachi: 'data/sansu_gachi.json',  // 灘中レベル（ガチ）＝算数のパズル連鎖
  rikagachi: 'data/rika_gachi.json', // 灘中レベル（ガチ）＝理科のパズル連鎖
};
// 連鎖問題を出題する最低学年（教科ごと）。算数は小3から。
// ★理科は小4から（2026-07-27）：浜学園の小4公開理科は、大問4がゴムひも・みつど・かがみの重なりなど
//   毎回きっちり「表を読んで規則を見つけ、外へ延ばす」連鎖問題になっている（原簿 HG-1651〜1677）。
//   ここを小5からにしていたため、小4の連鎖を入れてもボタンが開かなかった。
const CHAIN_MIN_GRADE = { sansu: 3, rika: 4, shakai: 5, kokugo: 5, gachi: 3, rikagachi: 5 };
function chainMinGrade(subject) { return CHAIN_MIN_GRADE[subject] ?? 5; }

// 連鎖問題（灘中レベル）は、選んだ学年"ぴったり"の問題だけ出す。
// 通常問題は q.grade === grade で学年一致なので、それに合わせる。
// 以前は累積(<=)だったため、小3の灘問題が小4〜小6でも同じように出ていた（学年で変わらないバグ）。
function chainInGrade(chain, grade) { return (chain.grade || grade) === grade; }

// 答えが数値系（整数・小数・分数・帯分数・余り）ならテンキー入力にする。
// それ以外（語句）は4択のまま。
function isNumpadAnswer(a) {
  a = String(a).trim();
  return /^\d+(\.\d+)?$/.test(a)            // 整数・小数
      || /^\d+\/\d+$/.test(a)               // 分数
      || /^\d+と\d+\/\d+$/.test(a)          // 帯分数
      || /余り/.test(a);                     // 余りあり
}

// 連鎖問題1件（chain）を、フラットな問題オブジェクトの配列に展開する。
// 数値答えはchoicesを外してテンキー入力にする
function expandChain(chain, grade) {
  return chain.steps.map((step, i) => ({
    id: `${chain.id}_s${i + 1}`,
    question: `(${i + 1}) ${step.question}`,
    // ★題名は問題文に混ぜない（読みにくいので本人指示 2026-07-28）。出すのは設定文だけ。
    // ★設定文は(2)(3)でも出す（本人了承 2026-07-29）。
    //   紙の公開テストなら設定は最後まで目の前にあるのに、アプリでは(1)でしか出しておらず、
    //   本番より不利な条件で解かせていた。次男の落ち方は「(1)○→(2)✗→(3)✗」でまさにここ。
    chainIntro: chain.intro,
    // ★前の設問と その答えを持たせる（本人了承 2026-07-29）。
    //   誘導問題は①で見つけた見方を②③で使う。①が画面から消えると手がかりごと消えていた。
    //   答えは「正解」を出す。1問ずつ答え合わせして次へ進む形なので、ここに着く時点で既に見ている。
    //   （①を間違えた子も、正しい足場から②に進める）
    prevSteps: chain.steps.slice(0, i).map((s, j) => ({ n: j + 1, question: s.question, answer: s.answer })),
    // 図：設問ごとのsvg優先。無ければchainの共通図を全設問(①②③)で表示（②③でも図を見て考えられるように）
    svg: step.svg || chain.svg || '',
    answer: step.answer,
    choices: isNumpadAnswer(step.answer) ? undefined : step.choices,
    meaning: step.meaning,
    difficulty: 5,
    grade: chain.grade || grade,
    _cat: chain.category,
  }));
}

// 指定した教科・カテゴリ・学年で出題できる連鎖問題（step）の数を返す。
// 難易度5ボタンの有効/無効判定に使う（0なら問題なし）
async function countChainSteps(subject, cat, grade, unit) {
  if (grade < chainMinGrade(subject)) return 0;
  let data;
  try {
    if (subject === 'kokugo') {
      if (!kokugoChainCache) kokugoChainCache = await (await fetch(KOKUGO_CHAIN_FILE)).json();
      data = kokugoChainCache;
    } else {
      const key = `chain-${subject}`;
      if (!sansuCache[key]) sansuCache[key] = await (await fetch(CHAIN_FILES[subject])).json();
      data = sansuCache[key];
    }
  } catch { return 0; }
  // cat は文字列・配列どちらでもよい。unit を渡すと単元でしぼる（連鎖にも unit を付けた／2026-07-26）
  const cats = Array.isArray(cat) ? cat : [cat];
  const any = cats.includes('mix') || cats.includes(null);
  return data
    .filter(c => (any || cats.includes(c.category)) && chainInGrade(c, grade))
    .filter(c => !unit || c.unit === unit)
    .reduce((n, c) => n + c.steps.length, 0);
}

// 難易度5（連鎖問題）ボタンの有効/無効を切り替える。
// 問題が無ければロックし、その難易度が選択中なら選択を解除する
async function updateChainDiffButton(btns, subject, cat, grade, onLockSelected, unit) {
  // 難易度5＝発見算。算数はさらに 'gachi'（ガチ＝パズル連鎖、別ファイル）もロック管理する
  const targets = [{ diff: '5', subj: subject }];
  if (subject === 'sansu') targets.push({ diff: 'gachi', subj: 'gachi' });
  if (subject === 'rika') targets.push({ diff: 'gachi', subj: 'rikagachi' });
  for (const t of targets) {
    const chainBtn = [...btns].find(b => b.dataset.diff === t.diff);
    if (!chainBtn) continue;
    const n = await countChainSteps(t.subj, cat, grade, unit);
    const locked = n === 0;
    chainBtn.classList.toggle('diff-locked', locked);
    chainBtn.disabled = locked;
    // 連鎖（発見算・ガチ）は別ファイルなので通常の集計に乗らない。問題数だけ出す
    let b = chainBtn.querySelector('.clear-badge');
    if (locked) { if (b) b.remove(); }
    else {
      if (!b) { b = document.createElement('span'); b.className = 'clear-badge'; chainBtn.appendChild(b); }
      b.textContent = `${n}問`;
      b.classList.add('diff-prog');
    }
    if (locked && chainBtn.classList.contains('selected')) {
      chainBtn.classList.remove('selected');
      if (onLockSelected) onLockSelected();
    }
  }
}

// チェーン（連鎖問題）を読み込み、カテゴリでしぼって、chain単位はシャッフルしつつ
// 各chain内のstep順は維持したまま平らな問題配列に展開する
async function loadChainQuestions(subject, cat, grade, maxQuestions = 'all', unit) {
  // 連鎖問題は灘中レベル。教科ごとの最低学年より下では出題しない
  if (grade < chainMinGrade(subject)) return [];
  const key = `chain-${subject}`;
  if (!sansuCache[key]) {
    const res = await fetch(CHAIN_FILES[subject]);
    sansuCache[key] = await res.json();
  }
  // 単元モードでは cat が null。unit があれば単元でしぼる（連鎖にも unit を付けた／2026-07-26）
  const chains = shuffle(sansuCache[key].filter(c =>
    (unit ? c.unit === unit : (cat === 'mix' || c.category === cat)) && chainInGrade(c, grade)));
  // 選んだ出題数（問数）に合わせて連鎖を「丸ごと」詰める。1連鎖(①②③)は途中で切らない。
  return fillChains(chains, grade, maxQuestions);
}

// 連鎖の配列を、出題数(maxQuestions)に収まるだけ丸ごと展開する共通処理。
// 1連鎖は途中で分割しない。連鎖があるかぎり最低1連鎖は返す。
function fillChains(chains, grade, maxQuestions, expand = expandChain) {
  const max = maxQuestions === 'all' ? Infinity : Number(maxQuestions);
  const out = [];
  for (const chain of chains) {
    const steps = expand(chain, grade);
    if (out.length > 0 && out.length + steps.length > max) break;
    steps.forEach(q => out.push(q));
    if (out.length >= max) break;
  }
  return out;
}

// 発見算・ガチ（連鎖問題）を選んだときは「出題数」を「1セット(3問)／3セット(9問)」に
// 切りかえる。通常の難易度に戻したら、元の出題数リストへ復帰する。
// 連鎖は3問で1セット。値はfillChainsに渡す「問数」なので 1セット=3・3セット=9。
const _qCountOrig = {};
function setChainCountOptions(selectId, isChain) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  if (_qCountOrig[selectId] === undefined) _qCountOrig[selectId] = sel.innerHTML;
  const nowChain = sel.dataset.qmode === 'chain';
  if (isChain && !nowChain) {
    sel.dataset.qmode = 'chain';
    sel.innerHTML = '<option value="3">1セット（3問）</option>'
      + '<option value="9" selected>3セット（9問）</option>';
  } else if (!isChain && nowChain) {
    sel.dataset.qmode = 'normal';
    sel.innerHTML = _qCountOrig[selectId];
  }
}

const sansuCache = {};
const sansuState = {
  subject: 'sansu', // 'sansu' | 'rika'
  grade: null, diff: null, cat: null, unit: null, pick: 'cat',
  mode: null, // 'normal' | 'drill' | 'hama'
  hamaCourse: null, // じゅくナビのコース（master / sairei）
  hamaMode: null,   // 最レの引き方（no＝回番号 / unit＝単元名）
  hamaUnit: null,   // 単元でえらぶときの単元名
  drillType: null, drillDiff: null, drillTime: null,
  questions: [], current: 0, correct: 0, wrong: 0,
  // ドリル
  drillCorrect: 0, drillWrong: 0, drillTimerId: null, drillTimeLeft: 0,
  // テンキー
  inputVal: '', inputRemain: '', inputWhole: '', inputPhase: 'main', // 'main'|'remain'
  isRemainMode: false,
  // ★単元でさがす、から出題したセッションかどうか。daimonPickerCtxと同じ扱い＝
  //   startSansuQuizが毎回falseにリセットし、「もう一度」だけ明示的に退避・復元する（本人要望2026-08-17）
  searchReturnCtx: false,
};

async function loadSansuQuestions(cat, grade, diff) {
  const fileMap = subjectFiles(sansuState.subject);
  // 単元グループでしぼる場合は、カテゴリをまたいで集める
  // （同じ単元が bun/tokusan/kisoku などに分散しているため。本人要望 2026-07-26）
  // ★cat より先に見る。「単元でえらぶ」入り口では cat が null なので fileMap[cat] が引けない
  const gsel = sansuState.unit;
  if (gsel && UNIT_GROUPS[gsel] && sansuState.subject === 'sansu') {
    const pooled = [];
    for (const k of Object.keys(SANSU_FILES)) {
      if (k === 'mix') continue;
      let qs;
      try { qs = await ensureSansuFile('sansu', k); } catch (e) { continue; }
      const ov = overlapSource(grade, diff);
      for (const q of qs) {
        if (UNIT_TO_GROUP[q.unit] !== gsel) continue;
        // ★出身カテゴリ(_cat)を必ず持たせる。無いと成績が sansu_null: で記録され、
        //   達成率の集計から丸ごと捨てられる（2026-07-26 のバグ。本人報告で発覚）
        if (q.grade === grade && q.difficulty === diff) pooled.push({ ...q, _cat: k });
        else if (ov && q.grade === ov.grade && q.difficulty === ov.diff) pooled.push({ ...q, _cat: k });
      }
    }
    if (pooled.length) return pooled;
  }
  if (!cat || !fileMap[cat]) return [];
  const key = `${sansuState.subject}-${cat}`;
  if (!sansuCache[key]) {
    const res = await fetch(fileMap[cat]);
    sansuCache[key] = await res.json();
  }
  const ov = overlapSource(grade, diff);
  return sansuCache[key].filter(q =>
    (q.grade === grade && q.difficulty === diff) ||
    (ov && q.grade === ov.grade && q.difficulty === ov.diff));
}


// ── 単元グループ（しぼり込み用）──────────────────────
// 浜学園の単元名31種はそのまま各問題の unit に残す。しぼり込みだけはこの23グループで行う。
// 理由：同じ単元が複数カテゴリ（bun/tokusan/kisoku…）に分散していて、
// カテゴリ内だけで数えると1難易度あたり10問に届かないセルが多発するため（本人要望 2026-07-26）
const UNIT_GROUPS = {
  '計算のくふう': ['計算のくふう'],
  '和差算・分配算': ['和差算・分配算'],
  '消去算': ['消去算'],
  'つるかめ算': ['つるかめ算'],
  '過不足算・差集め算': ['過不足算・差集め算'],
  '年令算・平均算': ['年齢算', '平均算'],
  // 仕事算・ニュートン算は原簿（浜学園の実物）に0問＝教材にまだ来ていない単元。
  // 骨は「全体を1とみる」で相当算の親戚なので、しぼり込みではここに寄せる。
  // ただし unit は分けて持つ：仕事算＝複数で1つの仕事／ニュートン算＝増える量と減る量が同時（本人指摘 2026-07-26）
  '相当算・やりとり': ['相当算・還元算', '倍数算・やりとり', '仕事算', 'ニュートン算'],
  '割合・食塩水': ['割合', '食塩水・濃度'],
  // 売買損益は小5マスターNo.20が1回まるごとこの単元（実物）。骨は「もとにする量を仕入れ値に
  // 固定して倍率を掛け算でつなぐ」1つだけなので、割合とは分けて持つ（2026-08-01）
  '売買損益': ['売買損益'],
  // 比例・反比例は小5マスターNo.18の単元（実物の印字は「比例と反比例」）。比の親戚なのでここに寄せる
  '比': ['比', '比例・反比例'],
  '速さ（旅人算）': ['速さ（旅人算）'],
  '速さ（通過・流水・時計）': ['速さ（通過・流水・時計）'],
  '規則性・数列': ['規則性・数列', '群数列'],
  '周期算': ['周期算'],
  '植木算・方陣算': ['植木算', '方陣算'],
  '場合の数': ['場合の数', '最大最小・最適化', '不可能性・存在証明'],
  'なかま調べ・推理': ['なかま調べ（集合・ベン図）', '推理・論理'],
  '倍数・約数': ['倍数・約数'],
  '数の性質・N進法': ['数の性質', 'N進法', '記号定義（約束）'],
  '概数（がい数）': ['概数（がい数）'],
  '平面図形（面積）': ['平面図形（面積）'],
  '平面図形（角度）': ['平面図形（角度）'],
  '図形の相似と移動': ['平面図形（相似・比）', '図形の移動・対称'],
  '立体図形': ['立体図形（体積・表面積）', '展開図・投影図'],
};
const UNIT_TO_GROUP = {};
for (const [g, us] of Object.entries(UNIT_GROUPS)) for (const u of us) UNIT_TO_GROUP[u] = g;
// 4段 × 10問に届かないグループはしぼり込みに出さない（選んでも問題が足りないため）
const UNIT_GROUP_MIN = 40;
const UNIT_INDEX_FILE = 'data/sansu_unit_index.json';

// ★ 学年をまたぐ難易度の重なり（本人の目安 2026-07-26）
//   「4年の難しいは5年のやさしいに相当します」
//   ＝ 小N の d4 と 小(N+1) の d1 は同じ重さ。絶対レベル A ＝ 3×学年 ＋ 難易度 で一致する
//     （小4d4 → 3×4+4＝16 ／ 小5d1 → 3×5+1＝16）
//   原簿（浜学園の実物593問）でも、同じ骨が「小3最レ★★ → 小4マスター★★ → 小4最レ★」と
//   コースをまたいで重なっており、1学年内で4段に刻まれてはいない。
//   → d1 を選んだときは、1つ下の学年の d4 も同じプールに入れる。
//     下の学年の問題は必ずその学年で解ける道具しか使っていないので、上に混ぜるのは安全。
//     逆（下の学年に上の学年の問題を混ぜる）は未習の道具が入るのでやらない。
function overlapSource(grade, diff) {
  if (diff !== 1 || !(grade > 1)) return null;
  return { grade: grade - 1, diff: 4 };
}

// 単元グループの問題数だけを先に持っておく索引（1.7KB）。
// これが無いと、単元チップを出すために算数の全ファイル（数MB）を先に落とすことになり、
// 初回だけ「単元をよみこんでいます…」が数秒つづく（本番で実測）。索引なら一瞬で出る。
let unitIndexCache = null;
async function loadUnitIndex() {
  if (unitIndexCache) return unitIndexCache;
  try {
    unitIndexCache = await (await fetch(UNIT_INDEX_FILE)).json();
  } catch (e) { unitIndexCache = {}; }
  return unitIndexCache;
}

// その学年で使える単元グループを、問題数つきで返す（カテゴリは横断する）
async function sansuUnitsFor(cat, grade) {
  if (sansuState.subject !== 'sansu') return [];
  // まず索引を見る。無い・空のときだけ実ファイルを数える（作りかけの学年でも動くように）
  const idx = await loadUnitIndex();
  const fromIdx = idx[String(grade)];
  if (fromIdx && Object.keys(fromIdx).length) {
    return Object.entries(fromIdx).sort((a, b) => b[1] - a[1]);
  }
  const c = {};
  for (const k of Object.keys(SANSU_FILES)) {
    if (k === 'mix') continue;
    let qs;
    try { qs = await ensureSansuFile('sansu', k); } catch (e) { continue; }
    for (const q of qs) {
      if (q.grade !== grade) continue;
      const g = UNIT_TO_GROUP[q.unit];
      if (!g) continue;
      c[g] = (c[g] || 0) + 1;
    }
  }
  return Object.entries(c)
    .filter(([, n]) => n >= UNIT_GROUP_MIN)     // 4段×10問に届かないグループは出さない
    .sort((a, b) => b[1] - a[1]);
}

// 単元しぼりのチップを描く。単元が1つしかないカテゴリでは出さない
async function renderSansuUnitRow() {
  const wrap = document.getElementById('sansu-unit-wrap');
  const row = document.getElementById('sansu-unit-row');
  if (!wrap || !row) return;
  // 単元グループはカテゴリを横断するので cat は要らない。学年だけあれば描ける
  const grade = sansuState.grade;
  if (!grade) { row.innerHTML = '<p class="muted">先に学年をえらんでください。</p>'; return; }
  row.innerHTML = '<p class="muted">単元をよみこんでいます…</p>';
  let units = [];
  try { units = await sansuUnitsFor(null, grade); } catch (e) { units = []; }
  if (sansuState.grade !== grade) return;   // 読み込み中に学年が変わっていたら破棄
  if (!units.length) { row.innerHTML = `<p class="muted">小${grade}で使える単元はまだありません。</p>`; return; }
  row.innerHTML =
    units.map(([u, n]) =>
      `<button class="sansu-cat-btn${sansuState.unit === u ? ' selected' : ''}" data-unit="${u}">${u}<br><span style="font-size:.72em;opacity:.7">${n}問</span></button>`
    ).join('');
  row.querySelectorAll('.sansu-cat-btn').forEach(b => {
    b.onclick = () => {
      row.querySelectorAll('.sansu-cat-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      sansuState.unit = b.dataset.unit || null;
      showSansuStep('sansu-step-diff');
      if (typeof updateSansuStart === 'function') updateSansuStart();
    };
  });
}

// ── じゅくナビ（塾の講義No.に合わせた出題） ──────────────
// data/hama_map.json に「講義No.→問題ID帯」の対応表を持ち、問題データ本体は変更しない。
// 現在No.は子ども（ニックネーム）ごとに保存し、週に1つ自動で進む。ズレたら±で直せる。
let hamaMap = null;
const HAMA_WINDOW = 12;      // 公開テストの範囲＝直近3ヶ月ぶん（週1回×12回）

// ── かんたん解説モード（じゅくナビ専用データ）─────────────────
// 浜学園は復習主義で先取りを推奨していないため、最レでは「先どり」を出さず
// 代わりに「かんたん解説」を置く（本人指示 2026-07-27）。
// 中身は 例題（解き方を見せる／入力させない）→ 類題（かんたんな問題を解かせる）の順。
// 次男は抽象概念がまだ弱いので「具体を手で持たせてから名前を付ける」順に並べてある。
// ── 大問モード（じゅくナビ専用データ）────────────────────────
// 「今週の復習テスト（大問）」＝その回の復習テストの良問を、原簿(HG-xxxx)の実物どおりに置く。
// 「公開テストのはんい（大問）」＝同じ時期の公開に実際に出た大問を、原簿どおりに置く。
// ★数値替えの類題ではなく、なるべく原簿そのまま（本人指示 2026-07-28）。出典は src:"HG-xxxx"。
// 形は連鎖(chain)と同じ {id,title,intro,svg,steps:[{question,answer,...}]} なので expandChain がそのまま使える。
//   grades[学年][コース].fukushu[回番号] = [大問, …]
//   grades[学年][コース].kokai[月]       = [大問, …]   ※月は "3"〜"12","1","2"
const HAMA_DAIMON_FILE = 'data/hama_daimon.json';
let hamaDaimonCache = null;
async function loadHamaDaimon() {
  if (hamaDaimonCache) return hamaDaimonCache;
  try { hamaDaimonCache = await (await fetch(HAMA_DAIMON_FILE)).json(); }
  catch (e) { hamaDaimonCache = { grades: {} }; }
  return hamaDaimonCache;
}
function hamaDaimonNode(d, grade, course) {
  const g = d.grades && d.grades[String(grade)];
  return (g && g[course]) || null;
}
// 講義No.→だいたい何月か。浜学園は3月開講で、マスターは年42回＝ならすと月3.5回。
// ★正確さより「だいたい合っていればよい」（本人指示 2026-07-28）。
// hama_map の回に month が書いてあればそれを優先する（あとで正確にしたくなったとき用）。
const HAMA_LESSONS_PER_MONTH = 3.5;
function hamaMonthOf(grade, course, no) {
  const courses = hamaCourses(grade);
  const lesson = courses && courses[course] &&
    courses[course].lessons.find(l => l.no === no);
  if (lesson && lesson.month) return Number(lesson.month);
  const off = Math.floor((Math.max(1, no) - 1) / HAMA_LESSONS_PER_MONTH);
  return ((3 - 1 + off) % 12) + 1;
}
// その回の復習テストの大問
async function hamaDaimonWeek(grade, course, no) {
  const node = hamaDaimonNode(await loadHamaDaimon(), grade, course);
  return (node && node.fukushu && node.fukushu[String(no)]) || [];
}
// ★マスターの宿題テキスト（大問）＝復習テストとは別物（3年マスター算数 第1分冊で追加・2026-08-17）。
//   「master」コースの兄弟コース「master_bunsatsu」に同じ回番号で入っている。
//   データが無い学年・回では自動で空になり、ボタンごと隠れる（学年の決め打ちなし）
//   ★2026-09-03：国語にも宿題テキスト（小3マスター国語「国語のとも」）ができたので、
//   コースごとに兄弟コース名を引けるようにした。ここに無いコースでは宿題ボタンは出ない。
const BUNSATSU_OF = { master: 'master_bunsatsu' };
async function hamaDaimonBunsatsu(grade, no, course) {
  const key = BUNSATSU_OF[course || 'master'];
  if (!key) return [];
  const node = hamaDaimonNode(await loadHamaDaimon(), grade, key);
  return (node && node.fukushu && node.fukushu[String(no)]) || [];
}
// ★講座の宿題（大問）＝復習テストとは別物の、授業テキストそのもの（小5最レ第3分冊で追加・2026-08-11）。
//   kouza は 1 か 2（第1講座／第2講座）。データがあるコースだけボタンが自動で出る（コース名の決め打ちなし）。
async function hamaDaimonKouza(grade, course, kouza, no) {
  const node = hamaDaimonNode(await loadHamaDaimon(), grade, course);
  const bucket = node && node['kouza' + kouza];
  return (bucket && bucket[String(no)]) || [];
}
function hamaHasKouza(node, kouza) {
  return !!(node && node['kouza' + kouza]);
}
// ★単元でえらぶモードの大問。
//   回番号＝去年までのカリキュラム／単元＝今年のカリキュラム、という分け方に合わせる。
//   刷新版（2026年度〜）の大問は回番号にひもづけられないので units 側に置く（2026-07-28）
// 単元でえらぶ に出す単元名の一覧（大問がある単元）
async function hamaDaimonUnits(grade, course) {
  const node = hamaDaimonNode(await loadHamaDaimon(), grade, course);
  return (node && node.units) ? Object.keys(node.units) : [];
}
async function hamaDaimonUnit(grade, course, unit) {
  const node = hamaDaimonNode(await loadHamaDaimon(), grade, course);
  if (!node || !node.units || !unit) return [];
  return node.units[unit] || node.units[await hamaPoolUnit(grade, course, unit)] || [];
}
// 公開の範囲は直近3ヶ月ぶん。月がひと月ずつずれて重なる（ラップする）ので、
// 月に1本ずつ置いておけば、いつ開いても3本＝9問そろう＝たくさん作らなくてよい（本人指摘 2026-07-28）
async function hamaDaimonKokai(grade, course, no) {
  const node = hamaDaimonNode(await loadHamaDaimon(), grade, course);
  if (!node || !node.kokai) return [];
  const m = hamaMonthOf(grade, course, no);
  const out = [];
  for (let k = 2; k >= 0; k--) {
    const mm = ((m - 1 - k) % 12 + 12) % 12 + 1;
    (node.kokai[String(mm)] || []).forEach(d => out.push(d));
  }
  return out;
}
function daimonSteps(sets) { return sets.reduce((n, d) => n + (d.steps || []).length, 0); }

// ── 国語の回別データ（じゅくナビ専用データ）────────────────────────
// 「今週の漢字」＝その回の大問4（カタカナ→漢字10問）を、原簿(HG-25xx)の実物どおりに置く。
// 算数のようなID帯も、理科のような単元名も使わない。回そのものが1セットだから。
//   grades[学年][コース].lessons[回番号].kanji = [問題, …]
// 1問の形は kanji_kaki.json とそろえてあるので、手書きの画面(renderKanji)がそのまま使える。
const HAMA_KOKUGO_FILE = 'data/hama_kokugo.json';
let hamaKokugoCache = null;
async function loadHamaKokugo() {
  if (hamaKokugoCache) return hamaKokugoCache;
  try { hamaKokugoCache = await (await fetch(HAMA_KOKUGO_FILE)).json(); }
  catch (e) { hamaKokugoCache = { grades: {} }; }
  return hamaKokugoCache;
}
function hamaKokugoNode(d, grade, course) {
  const g = d.grades && d.grades[String(grade)];
  return (g && g[course]) || null;
}
// 回のリストを、原簿にある順のまま1本につなぐ（シャッフルしない＝実物の1〜10の順）
async function hamaKokugoCollect(grade, course, lessons) {
  const node = hamaKokugoNode(await loadHamaKokugo(), grade, course);
  if (!node || !node.lessons) return [];
  const out = [];
  for (const l of lessons) {
    const rec = node.lessons[String(l.no)];
    (rec && rec.kanji || []).forEach(q => out.push({ ...q, grade, _cat: 'hama_kokugo' }));
  }
  return out;
}
// その回のマス目に「何を書くのか」を、問題そのものから決める。
// ★本科（小3・小4）は全部が漢字なので「今週の漢字」で合っていたが、最レ国語は回ごとに
//   中身がちがう（慣用表現・和語＝ひらがな／外来語＝カタカナ／漢字の問題＝漢字）。
//   固定にしていたので、ひらがなを書く回まで「今週の漢字」と名のっていた（本人指摘 2026-08-08）。
//   回ごとにデータへ種別を書き足すのではなく、問題文から見る＝原簿を足しても直す所が増えない。
function hamaKakiKind(q) {
  const t = String((q && q.question) || '');
  if (t.includes('カタカナを書')) return 'カタカナ';
  if (t.includes('ひらがなを書')) return 'ひらがな';
  if (t.includes('漢字')) return '漢字';        // 「漢字で書こう」「漢字1字を正しく直そう」
  return 'ことば';                              // 「この品詞の名前を書こう」など
}
// ★「今週のことば」は四択ボタン（📖）の名前なので、こちらでは使わない。
//   同じ名前が2つ並ぶと、手書きなのか四択なのか見分けがつかなくなる
const HAMA_KAKI_LABEL = {
  '漢字': '✍️ 今週の漢字',
  'ひらがな': '✍️ 今週の書き取り（ひらがな）',
  'カタカナ': '✍️ 今週の書き取り（カタカナ）',
  'ことば': '✍️ 今週の書き取り',
};
async function hamaKokugoKakiLabel(grade, course, no) {
  const node = hamaKokugoNode(await loadHamaKokugo(), grade, course);
  const rec = node && node.lessons && node.lessons[String(no)];
  const qs = (rec && rec.kanji) || [];
  if (!qs.length) return HAMA_KAKI_LABEL['漢字'];
  const kinds = new Set(qs.map(hamaKakiKind));
  // 1回の中でまざっている回は、どれか一つに寄せると うそになるので ひとまとめの名前にする
  return kinds.size === 1 ? HAMA_KAKI_LABEL[[...kinds][0]] : '✍️ 今週の書き取り';
}

// その回で習う「ことば」の単元。原簿に「1回まるごと◯◯の回」と書いてある回にだけ入っている
async function hamaKokugoUnitsOf(grade, course, no) {
  const node = hamaKokugoNode(await loadHamaKokugo(), grade, course);
  const rec = node && node.lessons && node.lessons[String(no)];
  return (rec && rec.units) || [];
}
// 「文のしくみ」からその単元の問題を集める。
// まぜないで、やさしい順に並べる（実物もA→B→C→Dで答え方が重くなっていく）
// ★じゅくナビの「ことば」は2つのバケツから引く（2026-08-08）。
//   kokugo_bun     … 小3・小4本科ぶん（文のしくみ／小4国語のことば）
//   kokugo_sairei5  … 小5最レぶん（文の成分・品詞。原簿 HG-2552/2556）
const KOKUGO_UNIT_CATS = ['kokugo_bun', 'kokugo_sairei5'];
async function kokugoBunFor(units) {
  if (!units || !units.length) return [];
  const out = [];
  for (const cat of KOKUGO_UNIT_CATS) {
    const all = await loadQuestions(cat).catch(() => []);
    out.push(...all.filter(q => units.includes(q.unit)));
  }
  return out.sort((a, b) => (a.difficulty - b.difficulty) || String(a.id).localeCompare(String(b.id)));
}

const HAMA_KAISETSU_FILE = 'data/hama_kaisetsu.json';
let hamaKaisetsuCache = null;
async function loadHamaKaisetsu() {
  if (hamaKaisetsuCache) return hamaKaisetsuCache;
  try { hamaKaisetsuCache = await (await fetch(HAMA_KAISETSU_FILE)).json(); }
  catch (e) { hamaKaisetsuCache = { grades: {} }; }
  return hamaKaisetsuCache;
}
// ★かんたん解説は「単元名」で引く。回番号では引かない。
// 最レの回番号は年度で中身が入れかわり、アプリに入っているのは去年までのカリキュラムなので
// 回番号にひもづけてはいけない（本人指示 2026-07-27）。
async function hamaKaisetsuFor(grade, course, unit) {
  const d = await loadHamaKaisetsu();
  const g = d.grades && d.grades[String(grade)];
  const c = g && g[course];
  return (c && c.units && c.units[unit]) || null;
}
// 「場合の数(1)」のような回ごとの名前から、通常問題を引くときの単元名を返す。
// 例：場合の数(1)／場合の数(2) → どちらも通常プールは「場合の数」から引く。
async function hamaPoolUnit(grade, course, unit) {
  const p = await hamaKaisetsuFor(grade, course, unit);
  return (p && p.poolUnit) || unit;
}

// その学年・コースで かんたん解説が用意されている単元名の一覧
async function hamaKaisetsuUnits(grade, course) {
  const d = await loadHamaKaisetsu();
  const g = d.grades && d.grades[String(grade)];
  const c = g && g[course];
  return (c && c.units) ? Object.keys(c.units) : [];
}

// ★回番号で引く（旧カリキュラム用）。
// 最レは2026年度に刷新されたが、旧カリキュラムの回番号ぶんも原簿から作ってある。
// 単元名で選ぶ＝新カリキュラム／回番号で選ぶ＝旧カリキュラム、と使い分ける（本人指示 2026-07-27）。
async function hamaKaisetsuForNo(grade, course, no) {
  const d = await loadHamaKaisetsu();
  const g = d.grades && d.grades[String(grade)];
  const c = g && g[course];
  return (c && c.lessons && c.lessons[String(no)]) || null;
}
// 例題＋類題を1本の出題リストに開く。例題には rei:true を立てて入力させない
function expandKaisetsu(pack, grade) {
  const out = [];
  (pack.items || []).forEach((it, i) => {
    const head = `📘 ${i + 1}. ${it.bone}`;
    out.push({
      id: `kx_${grade}_${i}_rei`,
      rei: true,
      question: it.rei.question,
      chainIntro: `${head}
まずは やり方を見てみよう`,
      svg: it.rei.svg || '',
      answer: it.rei.answer,
      kaisetsu: it.rei.kaisetsu || [],
      grade, _cat: 'kaisetsu',
    });
    (it.ruidai || []).forEach((r, j) => out.push({
      id: `kx_${grade}_${i}_r${j}`,
      question: r.question,
      chainIntro: j === 0 ? `${head}
おなじやり方で やってみよう` : '',
      svg: r.svg || '',
      answer: r.answer,
      choices: r.choices,
      meaning: r.meaning,
      grade, _cat: 'kaisetsu',
    }));
  });
  return out;
}
const HAMA_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ★force=true で必ず取り直す。
//   古いキャッシュ（＝国語のコースが入っていない対応表）をつかんだままだと
//   「この学年の対応表はまだありません」になるので、そのときは取り直せるようにした（2026-08-02）
async function loadHamaMap(force) {
  if (!hamaMap || force) {
    const res = await fetch('data/hama_map.json', { cache: 'no-cache' });
    hamaMap = await res.json();
  }
  return hamaMap;
}
// その教科のコースが対応表に見あたらないときだけ、対応表を取り直してもう一度見る
async function ensureHamaCourses(grade, subject) {
  if (hamaCourses(grade, subject)) return true;
  try { await loadHamaMap(true); } catch (e) { return false; }
  return !!hamaCourses(grade, subject);
}
// じゅくナビのパネル(sansu-step-hama)は1つしか作っていないので、
// 開く画面へ移動して使い回す。IDを複製しないための方法（2026-07-27・理科対応）
function moveHamaPanelTo(screenId, beforeId) {
  const panel = document.getElementById('sansu-step-hama');
  const target = document.getElementById(screenId);
  if (!panel || !target) return;
  const before = beforeId ? document.getElementById(beforeId) : null;
  if (before && before.parentElement === target) target.insertBefore(panel, before);
  else target.appendChild(panel);
}

// その学年・その教科のコースだけを返す。
// ★教科でしぼらないと、算数のじゅくナビに理科のコースが並んでしまう（2026-07-27）
function hamaCourses(grade, subject) {
  const g = hamaMap && hamaMap.grades && hamaMap.grades[String(grade)];
  if (!g || !g.courses) return null;
  const subj = subject || sansuState.subject || 'sansu';
  const out = {};
  for (const [k, v] of Object.entries(g.courses)) {
    if ((v.subject || 'sansu') === subj) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
function hamaStoreKey() { return `hamaNav_${state.nickname || 'guest'}`; }
function getHamaStore() {
  try { return JSON.parse(localStorage.getItem(hamaStoreKey()) || '{}'); } catch (e) { return {}; }
}
function saveHamaStore(s) { localStorage.setItem(hamaStoreKey(), JSON.stringify(s)); }

// 保存してある日付から経過週ぶんNo.を自動で進める（上限は対応表の最終回）
function hamaCurrent(grade, course) {
  const store = getHamaStore();
  const rec = (store[grade] || {})[course];
  const courses = hamaCourses(grade);
  const lessons = courses && courses[course] ? courses[course].lessons : [];
  if (!rec || !lessons.length) return null;
  const maxNo = lessons[lessons.length - 1].no;
  let no = rec.no;
  const weeks = Math.floor((Date.now() - rec.ts) / HAMA_WEEK_MS);
  if (weeks > 0) {
    no = Math.min(maxNo, no + weeks);
    setHamaCurrent(grade, course, no, rec.ts + weeks * HAMA_WEEK_MS);
  }
  return no;
}
function setHamaCurrent(grade, course, no, ts) {
  const store = getHamaStore();
  if (!store[grade]) store[grade] = {};
  store[grade][course] = { no, ts: ts || Date.now() };
  saveHamaStore(store);
}

// 指定した講義No.の範囲から問題を集める（sel の ID 帯に入るものだけ）
function hamaIdNum(id) { return Number(String(id).replace(/\D/g, '')); }
function hamaIdPrefix(id) { return String(id).replace(/[0-9]/g, ''); }
async function hamaCollect(grade, course, fromNo, toNo) {
  const courses = hamaCourses(grade);
  if (!courses || !courses[course]) return [];
  const lessons = courses[course].lessons.filter(l => l.no >= fromNo && l.no <= toNo);
  const subj = courses[course].subject;
  // ★国語は回そのものが1セット（実物の大問4）。ID帯でも単元名でもなく回番号で引く（2026-08-02）
  if (subj === 'kokugo') return await hamaKokugoCollect(grade, course, lessons);
  // ★理科などのコースは ID帯を持たない。回に書いてある単元名で集める（2026-07-27）
  if (subj && subj !== 'sansu') {
    const seen = new Set(); const out = [];
    for (const l of lessons) {
      // l.grade で学年を上書きできる（実力回＝小4の総復習）。算数の sel.grade と同じ考え方
      for (const u of (l.units || [])) {
        for (const q of await unitPoolFilled(subj, l.grade || grade, u)) {
          if (seen.has(q.id)) continue;
          seen.add(q.id); out.push(q);
        }
      }
    }
    return out;
  }
  // ブロックは cat と学年ごとにまとめる。s.grade で学年を上書きできる（実力回＝小4総復習など）。
  // s.all:true ならそのカテゴリ・学年の全問（ID帯を問わない）。
  const need = {};   // "cat@grade" -> {cat, g, ranges, all}
  lessons.forEach(l => (l.sel || []).forEach(s => {
    const g = s.grade || grade;
    const nk = `${s.cat}@${g}`;
    if (!need[nk]) need[nk] = { cat: s.cat, g, ranges: [], all: false };
    if (s.all) need[nk].all = true;
    (s.ids || []).forEach(([a, b]) => need[nk].ranges.push([hamaIdPrefix(a), hamaIdNum(a), hamaIdNum(b)]));
  }));
  const out = [];
  for (const nk of Object.keys(need)) {
    const info = need[nk];
    const key = `sansu-${info.cat}`;
    if (!sansuCache[key]) {
      if (!SANSU_FILES[info.cat]) continue;
      const res = await fetch(SANSU_FILES[info.cat]);
      sansuCache[key] = await res.json();
    }
    sansuCache[key].forEach(q => {
      if (q.grade !== info.g) return;   // その学年の問題だけ（ID帯が学年をまたいでも混ざらない）
      // ★出身カテゴリ(_cat)を持たせる。じゅくナビもカテゴリをまたいで集めるので、
      //   これが無いと成績が sansu_null: になり達成率に入らない
      if (info.all) { out.push({ ...q, _cat: info.cat }); return; }
      const p = hamaIdPrefix(q.id), n = hamaIdNum(q.id);
      if (info.ranges.some(([pre, a, b]) => pre === p && n >= a && n <= b)) out.push({ ...q, _cat: info.cat });
    });
  }
  return out;
}

// 単元名でその学年の問題を集める（最レ用。回番号がズレても引けるように）
async function hamaCollectUnit(grade, course, unit) {
  const courses = hamaCourses(grade);
  if (!courses || !courses[course] || !unit) return [];
  // ★理科などのコースは subject を持ち、ID帯ではなく単元名だけで引く（2026-07-27）
  const subj = courses[course].subject;
  if (subj && subj !== 'sansu') return await unitPoolFilled(subj, grade, unit);
  const nos = courses[course].lessons.filter(l => (l.units || []).includes(unit)).map(l => l.no);
  const seen = new Set();
  const out = [];
  for (const no of nos) {
    for (const q of await hamaCollect(grade, course, no, no)) {
      if (q.unit !== unit) continue;      // その単元の問題だけ
      if (seen.has(q.id)) continue;
      seen.add(q.id); out.push(q);
    }
  }
  if (out.length) return out;
  // 回に units が付いていない学年（小3最レなど）は、通常プールから単元名で集める。
  // 「単元名で復習させる」ため（本人指示 2026-07-27）。回番号にはたよらない。
  return await sansuUnitPool(grade, unit);
}

// その学年で、その単元（グループ名でも単元名でも可）の問題を全カテゴリから集める
async function sansuUnitPool(grade, unit) { return unitPool('sansu', grade, unit); }

// 単元名で問題を集める（教科をまたいで使える）。
// ★理科のじゅくナビはこちらを使う（2026-07-27）。理科は回番号→ID帯の対応表を持たず、
//   hama_map の lessons に units（単元名）だけを書いて、問題データの unit と突き合わせる方式にした。
//   こうすると問題データ側を触らずにカリキュラム連動でき、回の順序が変わっても壊れない。
async function unitPool(subject, grade, unit) {
  const files = subjectFiles(subject);
  const out = [];
  for (const k of Object.keys(files)) {
    if (k === 'mix') continue;
    let qs;
    try { qs = await ensureSansuFile(subject, k); } catch (e) { continue; }
    for (const q of qs) {
      if (q.grade !== grade) continue;
      // 算数は単元グループ(UNIT_GROUPS)でも引けるようにする。理科は単元名そのもの
      if (q.unit === unit || (subject === 'sansu' && UNIT_TO_GROUP[q.unit] === unit)) out.push({ ...q, _cat: k });
    }
  }
  return out;
}

// その学年のその単元が薄いときだけ、1つ下の学年からも足す（2026-07-29・小5理科用）。
// 浜学園はスパイラルなので、小5の回で扱う単元は小4でも習っている＝下の学年の問題は復習になる。
// 上の学年は混ぜない（まだ習っていない道具が入るため）。算数の overlapSource と同じ考え方。
const HAMA_UNIT_MIN = 20;
async function unitPoolFilled(subject, grade, unit) {
  const out = await unitPool(subject, grade, unit);
  if (out.length >= HAMA_UNIT_MIN || grade <= 1) return out;
  const seen = new Set(out.map(q => q.id));
  for (const q of await unitPool(subject, grade - 1, unit)) {
    if (!seen.has(q.id)) { seen.add(q.id); out.push(q); }
  }
  return out;
}

function hamaLessonTitle(grade, course, no) {
  const courses = hamaCourses(grade);
  const l = courses && courses[course] && courses[course].lessons.find(x => x.no === no);
  return l ? l.title : '';
}

// じゅくナビ画面の描画（コース切替・No.表示・各ボタンの問題数）
// じゅくナビのNo.を1つ動かす
function hamaShift(d) {
  const grade = sansuState.grade, course = sansuState.hamaCourse;
  const courses = hamaCourses(grade);
  if (!courses || !courses[course]) return;
  const lessons = courses[course].lessons;
  const cur = hamaCurrent(grade, course);
  if (cur === null) return;
  const next = Math.min(lessons[lessons.length - 1].no, Math.max(lessons[0].no, cur + d));
  if (next !== cur) { setHamaCurrent(grade, course, next); renderHamaPanel(); }
}

// じゅくナビの操作ボタンを配線する。
// ★以前は算数ホームの初期化(initSansuHome)の中でしか配線しておらず、
//   理科から入るとボタンに onclick が付かず、押しても何も起きなかった（2026-07-27）。
//   パネルを描くたびに呼ぶようにして、どの教科から入っても効くようにした。
function wireHamaButtons() {
  const m = document.getElementById('hama-minus'); if (m) m.onclick = () => hamaShift(-1);
  const p = document.getElementById('hama-plus');  if (p) p.onclick = () => hamaShift(1);
  document.querySelectorAll('.hama-act-btn').forEach(btn => {
    btn.onclick = () => startHamaSession(btn.dataset.hamaAct);
  });
}

async function renderHamaPanel() {
  wireHamaButtons();
  // 「今週のことば」は国語の回番号モードのときだけ出す。まず消しておいて、条件がそろったら下で出す
  const kotobaBtn = document.querySelector('.hama-act-btn[data-hama-act="kotoba"]');
  if (kotobaBtn) { kotobaBtn.classList.add('hidden'); kotobaBtn.disabled = true; }
  const grade = sansuState.grade;
  const courses = hamaCourses(grade);
  const row = document.getElementById('hama-course-row');
  const label = document.getElementById('hama-no-label');
  const title = document.getElementById('hama-no-title');
  const hint = document.getElementById('hama-hint');
  const acts = document.querySelectorAll('.hama-act-btn');
  if (!courses) {
    row.innerHTML = '';
    label.textContent = 'No.—';
    title.textContent = 'この学年の対応表はまだありません';
    hint.textContent = '小3のマスター／最レに対応しています。';
    acts.forEach(b => { b.disabled = true; });
    ['week', 'weekq', 'kokai', 'kokaiq'].forEach(k => {
      const el = document.getElementById('hama-cnt-' + k); if (el) el.textContent = '—';
    });
    return;
  }
  const keys = Object.keys(courses);
  if (!sansuState.hamaCourse || !courses[sansuState.hamaCourse]) sansuState.hamaCourse = keys[0];
  row.innerHTML = keys.map(k =>
    `<button class="hama-course-btn${k === sansuState.hamaCourse ? ' selected' : ''}" data-hama-course="${k}">${courses[k].label}</button>`
  ).join('');
  row.querySelectorAll('.hama-course-btn').forEach(b => {
    b.onclick = () => { sansuState.hamaCourse = b.dataset.hamaCourse; renderHamaPanel(); };
  });

  const course = sansuState.hamaCourse;
  const lessons = courses[course].lessons;

  // 最レは2026年度に内容が刷新され、回番号の中身が入れ替わった。
  // 回番号がズレても困らないよう、最レだけ「単元でえらぶ」も使えるようにする。
  const modeRow = document.getElementById('hama-mode-row');
  const unitWrap = document.getElementById('hama-unit-wrap');
  const unitSel = document.getElementById('hama-unit-sel');
  // かんたん解説がある単元だけでも「単元でえらぶ」を使えるようにする
  // （小3最レは lessons に units が無いが、かんたん解説は単元名で持っている）
  // ★新カリキュラム／旧カリキュラム の切り分け（本人指示 2026-07-28）
  //   回番号が「去年までのカリキュラム」を指しているコースだけ、単元でえらぶを出す。
  //   小5最レのように回番号がそのまま今年のカリキュラムなら、単元でえらぶは要らない。
  const curriculum = courses[course].curriculum || '新';
  const isOldCurr = (curriculum === '旧');
  // ★「単元でえらぶ」は回番号が旧カリキュラムを指すコース用。コース名で決めない
  //   （前は course === 'sairei' 決め打ちだった。対応表の curriculum を見れば足りる）
  const kxUnits = isOldCurr ? await hamaKaisetsuUnits(grade, course) : [];
  const dqUnits = isOldCurr ? await hamaDaimonUnits(grade, course) : [];
  const newUnits = [...new Set([...kxUnits, ...dqUnits])].sort();
  // 単元でえらぶ＝今年のカリキュラム用。今年ぶんの単元データがあるときだけ出す。
  //   回についている単元名は去年までのものなので使わない。
  const canUnit = isOldCurr && newUnits.length > 0;
  modeRow.style.display = canUnit ? 'flex' : 'none';
  modeRow.querySelectorAll('[data-hama-mode="no"]').forEach(b => { b.textContent = '回番号でえらぶ（去年まで）'; });
  modeRow.querySelectorAll('[data-hama-mode="unit"]').forEach(b => { b.textContent = '単元でえらぶ（今年）'; });
  if (!canUnit) sansuState.hamaMode = 'no';
  if (!sansuState.hamaMode) sansuState.hamaMode = 'no';
  modeRow.querySelectorAll('.hama-course-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.hamaMode === sansuState.hamaMode);
    b.onclick = () => { sansuState.hamaMode = b.dataset.hamaMode; renderHamaPanel(); };
  });

  if (canUnit && sansuState.hamaMode === 'unit') {
    // 単元でえらぶ：その学年の最レに出てくる単元＋かんたん解説がある単元を一覧にする
    const units = newUnits;
    if (!units.includes(sansuState.hamaUnit)) sansuState.hamaUnit = units[0];
    unitSel.innerHTML = units.map(u =>
      `<option value="${u}"${u === sansuState.hamaUnit ? ' selected' : ''}>${u}</option>`).join('');
    unitSel.onchange = () => { sansuState.hamaUnit = unitSel.value; renderHamaPanel(); };
    unitWrap.classList.remove('hidden');
    document.getElementById('hama-no-row').style.display = 'none';
    label.textContent = '単元でえらぶ';
    title.textContent = sansuState.hamaUnit || '—';
    hint.textContent = '今年のカリキュラムの単元です。回番号は去年までのものなので、単元でえらんでください。';
    const qs = await hamaCollectUnit(grade, course, await hamaPoolUnit(grade, course, sansuState.hamaUnit));
    const filtered = filterByBand(qs);
    const wk = document.getElementById('hama-cnt-week');
    wk.textContent = filtered.length ? `${sansuState.hamaUnit}・${filtered.length}問` : 'まだ問題なし';
    const wkB = document.querySelector('.hama-act-btn[data-hama-act="week"]');
    wkB.disabled = !filtered.length;
    wkB.classList.toggle('hidden', !filtered.length);   // 0問なら出さない（こわれて見えるので）
    document.querySelector('.hama-act-btn[data-hama-act="week"] .hama-act-name').textContent = '📝 この単元を復習';
    // ★かんたん解説はこの単元モードで出す（回番号には依存しない）
    const kxPack = await hamaKaisetsuFor(grade, course, sansuState.hamaUnit);
    const kxN = kxPack ? expandKaisetsu(kxPack, grade).length : 0;
    const kxB = document.querySelector('.hama-act-btn[data-hama-act="kaisetsu"]');
    if (kxB) {
      kxB.classList.remove('hidden');
      kxB.disabled = !kxN;
      document.getElementById('hama-cnt-kaisetsu').textContent =
        kxN ? `${kxPack.title}・${kxN}問` : 'この単元はまだ用意していません';
    }
    // ★大問は「今年のカリキュラム」ぶんを 単元にひもづけて出す（2026-07-28）。
    //   回番号＝去年までのカリキュラムなので、刷新版の大問は units 側に置いてある。
    const uSets = await hamaDaimonUnit(grade, course, sansuState.hamaUnit);
    const uN = daimonSteps(uSets);
    const wqB = document.querySelector('.hama-act-btn[data-hama-act="weekq"]');
    const wqEl = document.getElementById('hama-cnt-weekq');
    if (wqB && wqEl) {
      wqB.classList.toggle('hidden', !uN);
      wqB.disabled = !uN;
      wqEl.textContent = uN ? `${sansuState.hamaUnit}・大問${uSets.length}（${uN}問）` : '—';
    }
    // 公開の範囲は月にひもづくので、単元でえらぶモードでは出さない
    ['kokai', 'kokaiq'].forEach(k => {
      const el = document.getElementById('hama-cnt-' + k);
      if (el) el.textContent = '—';
      const b = document.querySelector(`.hama-act-btn[data-hama-act="${k}"]`);
      if (b) { b.disabled = true; b.classList.add('hidden'); }
    });
    return;
  }
  unitWrap.classList.add('hidden');
  document.getElementById('hama-no-row').style.display = 'flex';
  // 単元モードで書きかえたラベルを戻す。
  // ★算数2nd（木）は復習テストではなく演習プリント＝点数がA表に残らないぶん難度が高い。
  //   名前まで「復習テスト」にすると1stと混ざって見えるので、ここだけ言いかえる（本人指示 2026-08-01）
  const is2nd = (course === 'master2nd');
  // ★国語は実物の大問4（カタカナ→漢字10問）をそのまま出す＝手書きの書き取り（2026-08-02）
  const isKokugo = (courses[course].subject === 'kokugo');
  // ★灘合（灘中合格特訓）は「復習テスト」という考え方が無い。公開にも復習テストにも出ない別物で、
  //   通常問題プールも持たないので、出すのは大問だけ（本人決定 2026-08-05）
  // 算数の 'nadago' と 理科の 'nadago_rika' の両方をひろう（2026-08-09）
  const isNadago = String(courses[course].subject || '').startsWith('nadago');
  // 国語はこのあと、回がきまってから中身を見て名前をつけ直す（回ごとに書くものがちがうため）
  document.querySelector('.hama-act-btn[data-hama-act="week"] .hama-act-name').textContent =
    isKokugo ? '✍️ 今週の書き取り' : is2nd ? '🔥 今週の演習プリント' : '📝 今週の復習テスト';
  document.querySelector('.hama-act-btn[data-hama-act="weekq"] .hama-act-name').textContent =
    isNadago ? '🔥 この回の問題' : is2nd ? '🔥 今週の演習プリント（大問）' : '🧩 今週の復習テスト（大問）';
  document.querySelector('.hama-act-btn[data-hama-act="week"]').classList.toggle('hidden', isNadago);

  let no = hamaCurrent(grade, course);
  if (no === null) {
    // はじめて開いたときは、まん中あたりを初期値にして「合わせてね」と促す
    no = lessons[Math.floor(lessons.length / 2)].no;
    setHamaCurrent(grade, course, no);
    hint.textContent = isNadago
      ? 'やりたい回に −／＋ で合わせてね。'
      : 'つぎの講義の番号に −／＋ で合わせてね。あとは毎週じどうで1つ進みます。';
  } else {
    hint.textContent = isNadago
      ? '−／＋ で回をえらべます。'
      : '毎週じどうで1つ進みます。ズレたら −／＋ で直せます。';
  }
  label.textContent = isNadago ? `第${no}回` : `No.${no}`;
  const lessonTitle = hamaLessonTitle(grade, course, no) || '';
  title.textContent = lessonTitle || '—';

  // ★回がきまったので、マス目に何を書く回なのかで名前をつけ直す（本人指摘 2026-08-08）
  if (isKokugo) {
    document.querySelector('.hama-act-btn[data-hama-act="week"] .hama-act-name').textContent =
      await hamaKokugoKakiLabel(grade, course, no);
  }

  // ★国語だけ：その回で習う「ことば」（文のしくみ）。単元が分かっている回にだけ出す
  if (kotobaBtn) {
    const kUnits = isKokugo ? await hamaKokugoUnitsOf(grade, course, no) : [];
    const kQs = await kokugoBunFor(kUnits);
    kotobaBtn.classList.toggle('hidden', !kQs.length);
    kotobaBtn.disabled = !kQs.length;
    const el = document.getElementById('hama-cnt-kotoba');
    if (el) el.textContent = kQs.length ? `${kUnits.join('・')}・${kQs.length}問` : '—';
  }

  const minNo = lessons[0].no, maxNo = lessons[lessons.length - 1].no;
  document.getElementById('hama-minus').disabled = no <= minNo;
  document.getElementById('hama-plus').disabled = no >= maxNo;

  // 公開学力テストの出題範囲に最高レベル特訓の内容は含まれない（本人確認 2026-07-26）。
  // 最レを選んでいるときは「公開テストのはんい」ボタン自体を出さない。
  // 算数2nd も同じ。公開の範囲は1st（マスター）の回番号で数えるので、2ndの回番号で出すとズレる。
  // 国語は kokai:false（対応表）。公開の範囲は算数の回番号で数えるので国語の回では出せない
  // ★公開テストの範囲を出すかどうかは、対応表の kokai だけで決める。
  //   前は course !== 'sairei' && !is2nd という決め打ちが入っていた（コースを足すたびに
  //   ここを直す必要があった）。最レと算数2nd の対応表に kokai:false を書いて同じ結果にした
  const showKokai = (courses[course].kokai !== false);
  const kokaiBtn = document.querySelector('.hama-act-btn[data-hama-act="kokai"]');
  if (kokaiBtn) kokaiBtn.classList.toggle('hidden', !showKokai);

  // 「先どり」は廃止した（浜学園は復習主義／本人指示 2026-07-28）。その場所が大問モード。
  // かんたん解説は「単元でえらぶ」モードのほうに出す（回番号は旧カリキュラムなので使わない）
  const kxBtn = document.querySelector('.hama-act-btn[data-hama-act="kaisetsu"]');

  // ★大問モード（原簿どおりの3問1組）。まだ問題が無いところは暗転して残す（本人指示 2026-07-28）
  const byUnitMode = (sansuState.hamaMode === 'unit' && sansuState.hamaUnit);
  // ★以前は「国語なら問答無用で空」だった（読解の本文が著作物で大問を作れなかったため）。
  //   小3マスター国語の宿題テキスト（国語のとも）で国語にも大問ができたので、教科ではなく
  //   「そのコースが実際にデータを持っているか」で決めるようにした（2026-09-03）
  const weekSets = byUnitMode
    ? await hamaDaimonUnit(grade, course, sansuState.hamaUnit)
    : await hamaDaimonWeek(grade, course, no);
  const kokaiSets = showKokai ? await hamaDaimonKokai(grade, course, no) : [];
  const mNow = hamaMonthOf(grade, course, no);
  const mFrom = ((mNow - 1 - 2) % 12 + 12) % 12 + 1;
  // ★講座の宿題（大問）。単元でえらぶモードのときは出さない（回に結びつくデータのため）
  const daimonNode = hamaDaimonNode(await loadHamaDaimon(), grade, course);
  const hasKouza1 = !byUnitMode && !isKokugo && hamaHasKouza(daimonNode, 1);
  const hasKouza2 = !byUnitMode && !isKokugo && hamaHasKouza(daimonNode, 2);
  const kouza1Sets = hasKouza1 ? await hamaDaimonKouza(grade, course, 1, no) : [];
  const kouza2Sets = hasKouza2 ? await hamaDaimonKouza(grade, course, 2, no) : [];

  // ★講座の宿題ボタンは「第1講座の宿題（大問）」より「第1講座（単元名）」の方がわかりやすい
  //   （本人指摘 2026-08-11）。単元名は大問データ自身の unit から取る。
  //   ⚠ 以前は回タイトルを「・」で割っていたが、No.1〜20 のタイトルは復習テスト（去年の
  //   カリキュラム）の単元名なので、割ると講座の中身と食いちがう。最レは回番号でなく
  //   単元名でひもづける（feedback_jukunavi_rule ③）ため、データ側を正とする。
  const kouzaUnitName = (sets) => {
    const u = (sets || []).map((s) => s && s.unit).filter(Boolean);
    return u.length && u.every((x) => x === u[0]) ? u[0] : (u[0] || '');
  };
  // 回タイトルが「講座1単元・講座2単元」の形（No.21〜30）なら、そちらの方が
  // 単元名がくわしい（「数の性質(3)」）ので優先する。見分け方は
  // 「データの単元名が、そのタイトル部分の頭と一致するか」。
  // 一致しなければ復習テスト側のタイトル（No.1〜20）なので使わない。
  const titleParts = lessonTitle.split('・');
  const pick = (sets, part) => {
    const u = kouzaUnitName(sets);
    if (!u) return '';                       // データが無ければ既定の文言のまま
    return (part && part.indexOf(u) === 0) ? part : u;
  };
  const k1Name = pick(kouza1Sets, titleParts[0]);
  const k2Name = pick(kouza2Sets, titleParts[1]);
  const k1NameEl = document.querySelector('.hama-act-btn[data-hama-act="kouza1q"] .hama-act-name');
  const k2NameEl = document.querySelector('.hama-act-btn[data-hama-act="kouza2q"] .hama-act-name');
  if (k1NameEl) k1NameEl.textContent = k1Name ? `📚 第1講座（${k1Name}）` : '📚 第1講座の宿題（大問）';
  if (k2NameEl) k2NameEl.textContent = k2Name ? `📚 第2講座（${k2Name}）` : '📚 第2講座の宿題（大問）';
  // ★コース定義に weekLabel があれば「今週の復習テスト（大問）」の名前を差しかえる。
  //   国語のとも（宿題テキスト）は復習テストではないので「今週の宿題（大問）」と出す（2026-09-03）
  const wNameEl = document.querySelector('.hama-act-btn[data-hama-act="weekq"] .hama-act-name');
  if (wNameEl) wNameEl.textContent = (courses[course] && courses[course].weekLabel) || '🧩 今週の復習テスト（大問）';
  // ★マスターの宿題（大問）＝兄弟コース「master_bunsatsu」の同じ回番号から取る。
  //   復習テストより先にやるもの（本人指示 2026-08-17）なので weekq より前に置く。
  //   マスター以外のコースでは出さない／データが無い回は自動で空になりボタンが隠れる
  const isMaster = (course === 'master');
  const bunsatsuSets = (BUNSATSU_OF[course] && !byUnitMode) ? await hamaDaimonBunsatsu(grade, no, course) : [];
  const hasBunsatsu = bunsatsuSets.length > 0;
  const dq = [
    // 宿題は復習テストより先にやるもの（本人指示 2026-08-11）。国語には大問データが無い（読解の本文は
    // 著作物なので入れない）。ボタンごと出さない
    { k: 'kouza1q', show: hasKouza1, sets: kouza1Sets, span: `No.${no}` },
    { k: 'kouza2q', show: hasKouza2, sets: kouza2Sets, span: `No.${no}` },
    { k: 'bunsatsuq', show: hasBunsatsu, sets: bunsatsuSets, span: `No.${no}` },
    // 国語（本科）は復習テストの大問を持たないのでボタンごと隠す。ただし国語でも実際に
    // データがあるコース（国語のとも＝宿題テキスト）では出す（2026-09-03）
    { k: 'weekq', show: !isKokugo || weekSets.length > 0, sets: weekSets, span: byUnitMode ? sansuState.hamaUnit : `No.${no}` },
    { k: 'kokaiq', show: showKokai, sets: kokaiSets, span: `${mFrom}〜${mNow}月` },
  ];
  for (const d of dq) {
    const btn = document.querySelector(`.hama-act-btn[data-hama-act="${d.k}"]`);
    const el = document.getElementById('hama-cnt-' + d.k);
    if (!btn || !el) continue;
    btn.classList.toggle('hidden', !d.show);
    const n = daimonSteps(d.sets);
    btn.disabled = !n;
    el.textContent = n ? `${d.span}・大問${d.sets.length}（${n}問）` : `${d.span}・じゅんび中`;
  }
  // 回番号モードのかんたん解説＝旧カリキュラム（最レ）／同じカリキュラムがそのまま続く国語（原簿から作ったもの）
  if (kxBtn) {
    // ★かんたん解説があるかどうかは、データが持っているかで決める。
  //   前は (isSairei || isKokugo) の決め打ちで、最レ専用→国語を足すときに || を継ぎ足していた。
  //   hamaKaisetsuForNo は無ければ null を返すので、そのまま呼べばよい
  const pack = await hamaKaisetsuForNo(grade, course, no);
    const n2 = pack ? expandKaisetsu(pack, grade).length : 0;
    kxBtn.classList.toggle('hidden', !n2);
    kxBtn.disabled = !n2;
    if (n2) document.getElementById('hama-cnt-kaisetsu').textContent = `No.${no} ${pack.title}・${n2}問`;
  }
  // ★旧カリキュラムのコースは、回番号モードで必ず注意書きを出す（本人指示 2026-07-28）
  if (isOldCurr) {
    hint.textContent = canUnit
      ? '⚠ この回番号は 去年までのカリキュラム です。今年の内容は「単元でえらぶ（今年）」から。'
      : '⚠ この回番号は 去年までのカリキュラム です。今年の教材はまだ手もとにないので、単元でえらぶは出していません。';
    hint.classList.add('hama-warn');
  } else {
    hint.classList.remove('hama-warn');
  }

  const ranges = { week: [no, no] };
  if (showKokai) ranges.kokai = [Math.max(minNo, no - HAMA_WINDOW), no];
  for (const k of Object.keys(ranges)) {
    const [a, b] = ranges[k];
    const noRange = (a > b);   // 先どりで、まだ先の回が無いとき
    const qs = noRange ? [] : filterByBand(await hamaCollect(grade, course, a, b));
    const el = document.getElementById('hama-cnt-' + k);
    const btn = document.querySelector(`.hama-act-btn[data-hama-act="${k}"]`);
    const span = (k === 'week') ? `No.${no}` : `No.${a}〜${b}`;
    if (noRange) {
      el.textContent = 'はんい外';
    } else {
      el.textContent = qs.length ? `${span}・${qs.length}問` : `${span}・まだ問題なし`;
    }
    if (btn) btn.disabled = !qs.length;
  }
}

// ── クラス帯（浜学園のクラス編成に対応）──────────────────
// 浜学園のテキストは全クラス共通で、中が「やさしい／難しい／チャレンジ」とページで
// 区切られている。宿題としてやる範囲がクラスごとに決まっている（本人説明 2026-07-26）：
//   H＝やさしいのみ／SHH＝やさしい＋難しいのできる範囲／S＝難しいまで必須／V＝チャレンジまで
// 小規模校は生徒数が少ないのでクラスを合同にする。上から V／VSV／VSS／S／SHS／SHH／H。
// 合同クラスは「先頭2文字＝合同する2クラス、末尾1文字＝その中のどの帯か」。
//   例）SHH＝SとHの合同クラスのH帯、VSV＝VとSの合同クラスのV帯
// 合同の下帯（SHH・VSS）は、上の帯と同じ教室で同じテキストを持つので上の範囲に手を伸ばす。
const CLASS_BAND_DIFFS = {
  H:   [1],        // やさしい のみ
  SHH: [1, 2],     // やさしい ＋ 難しいのできる範囲（背伸びする帯）
  SHS: [2],        // S帯なので 難しい が主戦場
  S:   [2],        // 難しい まで必須
  VSS: [2, 3],     // Sだが V と同じ教室 → チャレンジに手を伸ばす
  VSV: [3],        // V帯
  V:   [3, 4],     // チャレンジ ＋ その上
};
function getClassBand() { try { return localStorage.getItem('otonClassBand') || ''; } catch (e) { return ''; } }
function setClassBand(v) { try { v ? localStorage.setItem('otonClassBand', v) : localStorage.removeItem('otonClassBand'); } catch (e) {} }
// クラス帯でしぼる。その帯に十分な数が無ければしぼらない（＝出題できなくならない安全弁）
function filterByBand(list, minWanted = 5) {
  const band = getClassBand();
  const diffs = CLASS_BAND_DIFFS[band];
  if (!diffs) return list;
  const only = list.filter(q => diffs.includes(q.difficulty));
  if (only.length >= minWanted) return only;
  // 足りないときは、となりのむずかしさまで1段だけ広げる。
  // いきなり全部に戻すと、Hの子に灘レベルが出てしまうため段階的にする。
  const lo = Math.min(...diffs) - 1, hi = Math.max(...diffs) + 1;
  const widened = list.filter(q => q.difficulty >= lo && q.difficulty <= hi);
  return widened.length >= minWanted ? widened : list;
}
function initClassBandUI() {
  const row = document.getElementById('class-band-row');
  if (!row) return;
  const cur = getClassBand();
  row.querySelectorAll('.sansu-cat-btn').forEach(b => {
    b.classList.toggle('selected', (b.dataset.band || '') === cur);
    b.onclick = () => {
      row.querySelectorAll('.sansu-cat-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      setClassBand(b.dataset.band || '');
      const band = b.dataset.band || '';
      const LABEL = { 1: 'やさしい', 2: '難しい', 3: 'チャレンジ', 4: 'その上' };
      const ds = CLASS_BAND_DIFFS[band];
      showToast(ds ? `${band}クラス：${ds.map(d => LABEL[d]).join('と')}を出します`
                   : 'ぜんぶのむずかしさから出します');
    };
  });
}

// ★1つの大問（sets中の1件）が、全問（steps全部）1度でも正解ずみかどうか。
//   記録キーは expandChain の id生成（`${chain.id}_s${i+1}`）と
//   recordResult の呼び出し（`${subject}_${cat}:${id}`、js/sansu.js:2133）に合わせる。
//   「クリア」の定義はアプリ全体で統一されている「一度でも正解（correct > 0）」に合わせる
//   （js/gamify.js の buildClearedSets と同じ考え方。正答率や最終回答では判定しない）。
function isDaimonSolved(s, hamaSubj, prog) {
  const n = (s.steps || []).length;
  if (!n) return false;
  for (let i = 1; i <= n; i++) {
    const p = prog[`${hamaSubj}_${s.category}:${s.id}_s${i}`];
    if (!p || !p.correct) return false;
  }
  return true;
}

// ★宿題（大問）の「大問をえらぶ」モーダル（2026-08-11）。
//   星順のおまかせで出すのではなく、大問番号を一覧で見て、やりたいものだけをその場で始められるようにする。
//   全問正解ずみの大問には✅を付けて、解き終わったものがひと目でわかるようにする（本人指示 2026-08-11）。
function openDaimonPicker(sets, grade, hamaSubj, label) {
  const modal = document.getElementById('daimon-pick-modal');
  const listEl = document.getElementById('daimon-pick-list');
  document.getElementById('daimon-pick-title').textContent = `${label}・大問をえらぶ`;
  const prog = getProgress();
  listEl.innerHTML = sets.map((s, i) => {
    const solved = isDaimonSolved(s, hamaSubj, prog);
    return `
    <button class="update-item daimon-pick-item${solved ? ' daimon-pick-solved' : ''}" type="button" data-idx="${i}">
      <div class="update-item-date">大問${i + 1}${s.star ? '　' + '★'.repeat(s.star) : ''}${solved ? '　✅' : ''}</div>
      <div class="update-item-title">${s.title || s.unit || ''}</div>
    </button>
  `;
  }).join('');
  listEl.querySelectorAll('.daimon-pick-item').forEach(btn => {
    btn.onclick = () => {
      modal.classList.add('hidden');
      startDaimonSets([sets[Number(btn.dataset.idx)]], grade, hamaSubj, label, sets);
    };
  });
  document.getElementById('daimon-pick-all').onclick = () => {
    modal.classList.add('hidden');
    startDaimonSets(sets, grade, hamaSubj, label, sets); // ★保存されている順（大問1→…）のまま。星順にしない
  };
  document.getElementById('daimon-pick-close').onclick = () => modal.classList.add('hidden');
  modal.classList.remove('hidden');
}
// 大問（1本 or 複数）をそのままクイズにして始める。fillChains で①②③の順に展開するだけ＝並べかえない。
// ★pickerSets・label があれば「解き終わったあと同じ大問えらびに戻る」ボタンを結果画面に出せるよう
//   sansuState に憶えておく（本人要望 2026-08-17）。openDaimonPicker 経由でないふつうの出題では渡さない
function startDaimonSets(sets, grade, hamaSubj, label, pickerSets) {
  const qs = fillChains(sets, grade, 'all');
  if (!qs.length) { showToast('この大問はまだ用意していません'); return; }
  sansuState.subject = hamaSubj;
  sansuState.cat = 'hama';
  sansuState.questions = qs;
  sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
  coinSessionEarned = 0;
  startSansuQuiz();
  sansuState.daimonPickerCtx = pickerSets ? { sets: pickerSets, grade, hamaSubj, label } : null;
}

// じゅくナビから出題を開始する
async function startHamaSession(kind) {
  const grade = sansuState.grade, course = sansuState.hamaCourse;
  const courses = hamaCourses(grade);
  if (!courses || !courses[course]) return;
  const lessons = courses[course].lessons;
  // ★このコースの教科（理科のじゅくナビ対応・2026-07-27）。
  //   以前は無条件に sansuState.subject='sansu' としていたため、理科で開いても算数に切りかわっていた
  const hamaSubj = courses[course].subject || 'sansu';

  // ★国語のじゅくナビは手書き＋自己採点（既存の漢字書き取り画面）に流す（2026-08-02）。
  //   実物の大問4がそのまま1セットなので、シャッフルも出題数のしぼりもしない。
  if (hamaSubj === 'kokugo') {
    // ことば＝四択の画面、漢字＝手書きの画面。同じ回でも出す画面がちがう
    // かんたん解説と公開テストのはんい（大問・kokaiq）は算数・理科と共通の画面（下の分岐）に流す。
    // ★以前は kind!=='kaisetsu' で全部ここに落としていたため、小3国語に「公開テストのはんい」
    //   を追加したあとも kokaiq クリックがここで横取りされ、大問ピッカーに一生たどりつけなかった
    //   （本人指摘 2026-08-15「そうはなってないよ」）。'week' のときだけ手書き画面へ流すように直した。
    if (kind === 'kotoba') { await startKokugoKotobaSession(grade, course); return; }
    if (kind === 'week') { await startKokugoHamaSession(grade, course); return; }
  }

  // かんたん解説モード：例題→類題の順にそのまま出す（シャッフルしない。順番が意味を持つ）
  if (kind === 'kaisetsu') {
    showLoading();
    try {
      const byUnit = (sansuState.hamaMode === 'unit' && sansuState.hamaUnit);
      const pack = byUnit
        ? await hamaKaisetsuFor(grade, course, sansuState.hamaUnit)
        : await hamaKaisetsuForNo(grade, course, hamaCurrent(grade, course));
      const qs = pack ? expandKaisetsu(pack, grade) : [];
      if (!qs.length) { showToast('ここのかんたん解説はまだ用意していません'); hideLoading(); return; }
      sansuState.subject = 'sansu';
      sansuState.cat = 'kaisetsu';
      sansuState.diff = 'kaisetsu';
      sansuState.questions = qs;      // ★順番どおりに出す
      sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
      coinSessionEarned = 0;
      hideLoading();
      startSansuQuiz();
    } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
    return;
  }

  // ★講座の宿題（大問）は、星順のおまかせで出さず、大問番号を見てえらべるようにする。
  //   「かんたんな問題から強制的にやらされるのは苦痛」という本人（長男）の声（2026-08-11）。
  //   宿題は復習テストと違って「あの回のあの大問をやり直したい」というピンポイントの使い方をするため。
  if (kind === 'kouza1q' || kind === 'kouza2q') {
    showLoading();
    try {
      const dno = hamaCurrent(grade, course);
      const sets = await hamaDaimonKouza(grade, course, kind === 'kouza1q' ? 1 : 2, dno);
      hideLoading();
      if (!sets.length) { showToast('ここの大問はまだ用意していません'); return; }
      // ボタン名（例：📚 第1講座の宿題（大問））から絵文字と「（大問）」を除いてモーダルの見出しにも使う
      const btnName = document.querySelector(`.hama-act-btn[data-hama-act="${kind}"] .hama-act-name`);
      const kouzaLabel = (btnName && btnName.textContent.replace(/^📚\s*/, '').replace(/（大問）\s*$/, '')) ||
        (kind === 'kouza1q' ? '第1講座の宿題' : '第2講座の宿題');
      openDaimonPicker(sets, grade, hamaSubj, `No.${dno}・${kouzaLabel}`);
    } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
    return;
  }

  // ★マスターの宿題（大問）＝兄弟コース「master_bunsatsu」から。kouza1q/kouza2qと同じ理由で
  //   大問番号を見てえらべるようにする（本人指示 2026-08-17）
  if (kind === 'bunsatsuq') {
    showLoading();
    try {
      const dno = hamaCurrent(grade, course);
      const sets = await hamaDaimonBunsatsu(grade, dno);
      hideLoading();
      if (!sets.length) { showToast('ここの宿題はまだ用意していません'); return; }
      openDaimonPicker(sets, grade, hamaSubj, `No.${dno}・今週の宿題`);
    } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
    return;
  }

  // 大問モード：講座の宿題（kouza1q/kouza2q）と同じく、星順のおまかせで出さず、
  // 大問番号を見てえらべるようにする（本人要望 2026-08-11「全ての大問系を最レの宿題のように」）。
  // シャッフルしない（①②③は順番に意味がある）。1本ぶんは途中で切らない＝fillChains にまかせる。
  if (kind === 'weekq' || kind === 'kokaiq') {
    showLoading();
    try {
      const dno = hamaCurrent(grade, course);
      const byUnit = (sansuState.hamaMode === 'unit' && sansuState.hamaUnit);
      const sets = kind === 'weekq'
        ? (byUnit ? await hamaDaimonUnit(grade, course, sansuState.hamaUnit)
                  : await hamaDaimonWeek(grade, course, dno))
        : await hamaDaimonKokai(grade, course, dno);
      hideLoading();
      if (!sets.length) { showToast('ここの大問はまだ用意していません'); return; }
      const btnName = document.querySelector(`.hama-act-btn[data-hama-act="${kind}"] .hama-act-name`);
      // ★絵文字は文字クラス[]にまとめるとサロゲートペアが分解されて誤マッチする（2026-08-11 発覚）。
      //   交替(|)で1つずつリテラルマッチさせること。
      const actLabel = (btnName && btnName.textContent.replace(/^(?:🧩|🎯)\s*/, '').replace(/（大問）\s*$/, '')) ||
        (kind === 'weekq' ? '今週の復習テスト' : '公開テストの過去問');
      const rangeLabel = byUnit ? sansuState.hamaUnit : `No.${dno}`;
      openDaimonPicker(sets, grade, hamaSubj, `${rangeLabel}・${actLabel}`);
    } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
    return;
  }

  // 単元でえらぶモードはここで出題する。
  // ★コース名で判定しない。hamaMode が 'unit' になるのは renderHamaPanel が
  //   canUnit（＝旧カリキュラム＋単元データあり）と判断したときだけで、
  //   そうでないときは 'no' に戻される
  if (sansuState.hamaMode === 'unit' && sansuState.hamaUnit) {
    showLoading();
    try {
      const all = filterByBand(await hamaCollectUnit(grade, course, await hamaPoolUnit(grade, course, sansuState.hamaUnit)));
      if (!all.length) { showToast('この単元にはまだ問題がありません'); hideLoading(); return; }
      const want = Number(document.getElementById('sansu-q-count').value) || 10;
      sansuState.subject = hamaSubj;
      sansuState.cat = 'hama';
      sansuState.questions = shuffle(all).slice(0, want === 0 ? all.length : want);
      sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
      coinSessionEarned = 0;
      hideLoading();
      startSansuQuiz();
    } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
    return;
  }

  const minNo = lessons[0].no, maxNo = lessons[lessons.length - 1].no;
  const no = hamaCurrent(grade, course);


  const range = kind === 'week' ? [no, no]
    : kind === 'kokai' ? [Math.max(minNo, no - HAMA_WINDOW), no]
      : [no + 1, Math.min(maxNo, no + HAMA_WINDOW)];
  if (range[0] > range[1]) { showToast('この範囲にはまだ問題がありません'); return; }
  showLoading();
  try {
    const raw = await hamaCollect(grade, course, range[0], range[1]);
    if (!raw.length) { showToast('この範囲にはまだ問題がありません'); hideLoading(); return; }
    const all = filterByBand(raw);   // クラス帯（H/S/V）に合うむずかしさだけ
    const want = Number(document.getElementById('sansu-q-count').value) || 10;
    const picked = shuffle(all).slice(0, want === 0 ? all.length : want);
    sansuState.subject = hamaSubj;
    sansuState.cat = 'hama';
    sansuState.questions = picked;
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) {
    showToast('問題の読み込みに失敗しました'); hideLoading();
  }
}

// 国語のじゅくナビ：その回の漢字を、原簿の順のまま手書きの画面へ流す。
// 実物の大問4は1〜10がひとつづきの1セットなので、まぜない・数を減らさない・クラス帯でしぼらない。
// 状態は「ナビ側＝sansuState／出題側＝state」で分ける（既存の関数がそれぞれを直に読むため）。
async function startKokugoHamaSession(grade, course) {
  showLoading();
  try {
    const no = hamaCurrent(grade, course);
    const qs = await hamaCollect(grade, course, no, no);
    if (!qs.length) { showToast('この回の書き取りはまだ用意していません'); hideLoading(); return; }
    state.grade = grade;
    state.selectedCat = 'hama_kokugo';   // CATEGORIES には入れない（結果画面・記録の振り分けキー）
    state.selectedMode = 'kaki';
    state.selectedDiff = null;
    coinSessionEarned = 0;
    hideLoading();
    startKanji(qs, `じゅくナビ No.${no}（${qs.length}問）`);
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

// 国語のじゅくナビ：その回で習う「ことば」を、いつもの四択の画面で出す（2026-08-02）。
// 種本は data/kokugo_bun.json（文のしくみ＝原簿 HG-2515/2521/2523/2525）。
// まぜないでやさしい順に出す＝実物と同じで、答え方がだんだん重くなる並びになる。
async function startKokugoKotobaSession(grade, course) {
  showLoading();
  try {
    const no = hamaCurrent(grade, course);
    const units = await hamaKokugoUnitsOf(grade, course, no);
    const qs = await kokugoBunFor(units);
    if (!qs.length) { showToast('この回のことばはまだ用意していません'); hideLoading(); return; }
    state.grade = grade;
    state.selectedCat = 'kokugo_bun';
    state.selectedMode = 'quiz';
    state.selectedDiff = 'all';
    state.weakOnly = false;
    state.fromHamaKotoba = true;      // 結果画面の「もう一度」でこの回に戻すため
    state.sessionQs = qs;
    state.questions = await loadQuestions('kokugo_bun');
    state.current = 0; state.correct = 0; state.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

// ── 算数ホーム初期化（階層式ステップUI） ──────────────────
function showSansuStep(id) {
  const el = document.getElementById(id);
  const wasHidden = el.classList.contains('hidden');
  el.classList.remove('hidden');
  if (wasHidden) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
}
function hideSansuSteps(...ids) {
  ids.forEach(id => document.getElementById(id).classList.add('hidden'));
}

function initSansuHome() {
  sansuState.subject = 'sansu';
  document.getElementById('sansu-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null; sansuState.unit = null;
  sansuState.mode = null; sansuState.drillType = null; sansuState.drillDiff = null; sansuState.drillTime = null;

  // 戻るボタン
  document.querySelectorAll('[data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年（算数ホーム内に限定）
  document.querySelectorAll('#screen-sansu-home .grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.grade = Number(btn.dataset.grade);
      sansuState.unit = null;
      // 学年で使える単元グループは変わるのでチップを描き直す
      if (sansuState.pick === 'unit') { renderSansuUnitRow(); document.getElementById('sansu-start-zone').classList.add('hidden'); }
      // カテゴリごとの履修開始学年（SAPIX/浜学園カリキュラム基準）に達したら表示
      document.querySelectorAll('.juken-only').forEach(el => {
        const minGrade = Number(el.dataset.minGrade) || 4;
        el.classList.toggle('hidden', sansuState.grade < minGrade);
      });
      // 上限学年つきカテゴリ（文章題は小1〜4のみ。小5〜6は特殊算・割合と比・速さでカバー）
      document.querySelectorAll('.sansu-cat-btn[data-max-grade]').forEach(el => {
        const maxGrade = Number(el.dataset.maxGrade);
        el.classList.toggle('hidden', sansuState.grade > maxGrade);
      });
      // 学年変更で選択中カテゴリが履修範囲外になったら解除
      const selectedCatBtn = document.querySelector(`.sansu-cat-btn[data-scat="${sansuState.cat}"]`);
      const outOfMin = selectedCatBtn && selectedCatBtn.classList.contains('juken-only') && sansuState.grade < (Number(selectedCatBtn.dataset.minGrade) || 4);
      const outOfMax = selectedCatBtn && selectedCatBtn.dataset.maxGrade && sansuState.grade > Number(selectedCatBtn.dataset.maxGrade);
      if (outOfMin || outOfMax) {
        sansuState.cat = null;
        document.querySelectorAll('.sansu-cat-btn[data-scat]').forEach(b => b.classList.remove('selected'));
        hideSansuSteps('sansu-step-diff');
      }
      refreshDrillTypeAvailability();
      showSansuStep('sansu-step-mode');
      updateSansuStart();
    };
  });

  // STEP2: モード
  document.querySelectorAll('.sansu-mode-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.sansu-mode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.mode = btn.dataset.sansuMode;
      if (sansuState.mode === 'normal') {
        hideSansuSteps('sansu-step-dtype', 'sansu-step-time', 'sansu-step-hama');
        showSansuStep('sansu-step-cat');
        if (sansuState.cat) showSansuStep('sansu-step-diff');
      } else if (sansuState.mode === 'hama') {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-drilldiff', 'sansu-step-time');
        // ★灘合を見たあとに戻ってくると subject が 'nadago' のままなので、必ず算数に戻す
        sansuState.subject = 'sansu';
        sansuState.hamaCourse = null;
        // 理科で使ったあとはパネルが理科ホームに移っているので、算数ホームへ戻す
        moveHamaPanelTo('screen-sansu-home', 'sansu-start-zone');
        loadHamaMap().then(() => { showSansuStep('sansu-step-hama'); renderHamaPanel(); })
          .catch(() => showToast('じゅくナビの読み込みに失敗しました'));
      } else if (sansuState.mode === 'nadago') {
        // ★灘合にチャレンジ（本人決定 2026-08-05）。じゅくナビと同じパネルを使い回すが、
        //   コースに subject:'nadago' を付けてあるので、算数・理科・国語のじゅくナビには
        //   構造上まざらない（⛔灘合は公開学力テストに出ない別物）
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-drilldiff', 'sansu-step-time');
        sansuState.subject = 'nadago';
        sansuState.hamaCourse = 'nadago';
        sansuState.hamaMode = 'no';
        sansuState.hamaUnit = null;
        moveHamaPanelTo('screen-sansu-home', 'sansu-start-zone');
        loadHamaMap()
          .then(() => ensureHamaCourses(sansuState.grade, 'nadago'))
          .then(() => { showSansuStep('sansu-step-hama'); renderHamaPanel(); })
          .catch(() => showToast('灘合の対応表が読みこめませんでした'));
      } else if (sansuState.mode === 'drill') {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-hama');
        refreshDrillTypeAvailability();
        showSansuStep('sansu-step-dtype');
        if (sansuState.drillType) showSansuStep('sansu-step-drilldiff');
        if (sansuState.drillType && sansuState.drillDiff) showSansuStep('sansu-step-time');
      } else if (sansuState.mode === 'tora') {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-drilldiff', 'sansu-step-time', 'sansu-step-hama');
        initToraHome();
        showScreen('tora-home');
      } else {
        hideSansuSteps('sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-drilldiff', 'sansu-step-time', 'sansu-step-hama');
        showToast('もうすぐ追加されます！工事中🚧');
      }
      // ドリルは出題数不要
      document.getElementById('sansu-qcount-wrap').classList.toggle('hidden', sansuState.mode === 'drill');
      updateSansuStart();
    };
  });

  // じゅくナビのボタン配線は wireHamaButtons() に出した（理科からも使うため・2026-07-27）
  wireHamaButtons();

  // STEP3: カテゴリ（算数ホーム内）
  // STEP3：入り口の切替（📚種類でえらぶ ／ 🎯単元でえらぶ）
  // 以前はカテゴリを選ばせた上で単元も選ばせていたが、単元はカテゴリを横断するため
  // 2つ選ばせて片方が無効になる状態だった（本人指摘 2026-07-26）→ 並列の入り口にした
  document.querySelectorAll('#pick-mode-row .sansu-cat-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#pick-mode-row .sansu-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.pick = btn.dataset.pick;
      const byUnit = sansuState.pick === 'unit';
      document.getElementById('pick-cat-wrap').classList.toggle('hidden', byUnit);
      document.getElementById('sansu-unit-wrap').classList.toggle('hidden', !byUnit);
      // 入り口を変えたら選択をリセット（片方だけが効く状態にする）
      sansuState.cat = null; sansuState.unit = null;
      document.querySelectorAll('#screen-sansu-home .sansu-cat-btn[data-scat]').forEach(b => b.classList.remove('selected'));
      document.getElementById('sansu-start-zone').classList.add('hidden');
      if (byUnit) renderSansuUnitRow();
      updateSansuStart();
    };
  });

  // ★ [data-scat] で限定する。限定しないと #pick-mode-row の入り口ボタン（同じクラス）まで
  //   このハンドラで onclick を上書きしてしまい、「単元でえらぶ」が反応しなくなる（2026-07-26）
  document.querySelectorAll('#screen-sansu-home .sansu-cat-btn[data-scat]').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#screen-sansu-home .sansu-cat-btn[data-scat]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.scat;
      sansuState.unit = null;
      showSansuStep('sansu-step-diff');
      updateSansuStart();
    };
  });

  // STEP4: 難易度（算数ホーム内・通常問題）
  document.querySelectorAll('#sansu-step-diff .diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#sansu-step-diff .diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // 'gachi'（灘中レベル・ガチ＝パズル連鎖）は文字列のまま持つ
      sansuState.diff = btn.dataset.diff === 'gachi' ? 'gachi' : Number(btn.dataset.diff);
      updateSansuStart();
    };
  });

  // STEP3': ドリル種類
  document.querySelectorAll('.drill-type-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.drill-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.drillType = btn.dataset.dtype;
      showSansuStep('sansu-step-drilldiff');
      updateSansuStart();
    };
  });

  // STEP4': 難易度（ドリル）
  document.querySelectorAll('#sansu-step-drilldiff .diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('#sansu-step-drilldiff .diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.drillDiff = Number(btn.dataset.diff);
      showSansuStep('sansu-step-time');
      updateSansuStart();
    };
  });

  // STEP5': 時間
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.drillTime = Number(btn.dataset.time);
      updateSansuStart();
    };
  });

  // スタートボタン
  document.getElementById('sansu-btn-start').onclick = () => startSansuSession();

  // 苦手問題のみ／詳細な進捗
  document.getElementById('sansu-btn-weak').classList.remove('active-weak');
  document.getElementById('sansu-btn-weak').onclick = (e) => startSansuWeakSession(e.currentTarget);
  document.getElementById('sansu-btn-progress').onclick = () => openProgressScreenFrom('sansu-home', 'sansu');
  document.getElementById('sansu-btn-search').onclick = () => openSearchScreen('sansu');

  // 全ステップを初期状態（STEP1のみ表示）に
  hideSansuSteps('sansu-step-mode', 'sansu-step-cat', 'sansu-step-diff', 'sansu-step-dtype', 'sansu-step-time');
  document.getElementById('sansu-start-zone').classList.add('hidden');

  // 終了バッジ（✅単元・👑学年）
  renderCatBadges('sansu');
  renderGradeCrowns('sansu');
}

function updateSansuStart() {
  renderDiffBadgesSansu();
  const zone = document.getElementById('sansu-start-zone');
  const info = document.getElementById('sansu-start-info');
  let ready = false;

  if (sansuState.mode === 'normal') {
    ready = sansuState.grade && (sansuState.cat || sansuState.unit) && sansuState.diff;
    if (ready) {
      const what = sansuState.unit ? sansuState.unit : SANSU_CAT_LABELS[sansuState.cat];
      info.textContent = `小${sansuState.grade} / ${what} / ${DIFF_LABELS[sansuState.diff]}`;
    }
  } else if (sansuState.mode === 'drill') {
    ready = sansuState.grade && sansuState.drillType && sansuState.drillDiff && sansuState.drillTime !== null;
    if (ready) {
      const timeStr = sansuState.drillTime === 0 ? '無制限' : `${sansuState.drillTime}秒`;
      info.textContent = `小${sansuState.grade} / ${DRILL_TYPE_LABELS[sansuState.drillType]} / ${DIFF_LABELS[sansuState.drillDiff]} / ${timeStr}`;
    }
  }

  setChainCountOptions('sansu-q-count', sansuState.mode === 'normal' && (sansuState.diff === 5 || sansuState.diff === 'gachi'));

  // 🏆 やる前にランキングを見られるようにする（タイムアタックのときだけ）
  const rankBtn = document.getElementById('sansu-btn-drillrank');
  const canRank = sansuState.mode === 'drill' && ready && sansuState.drillTime > 0;
  rankBtn.classList.toggle('hidden', !canRank);
  if (canRank) {
    const best = getDrillBest(drillGameKey());
    rankBtn.textContent = best ? `🏆 ランキング（自己ベスト ${best}問）` : '🏆 ランキングを見る';
    rankBtn.onclick = () => showGameRanking(drillGameKey(), drillRankTitle(), 'max', '問');
  }

  zone.classList.toggle('hidden', !ready);
}

// ── 理科ホーム（学年→カテゴリ→難易度の階層式） ──────────
function initRikaHome() {
  sansuState.subject = 'rika';
  document.getElementById('rika-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null;

  document.querySelectorAll('#screen-rika-home [data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年
  document.querySelectorAll('.rika-grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.rika-grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.grade = Number(btn.dataset.grade);
      // 小4以上のみ受験カテゴリ表示
      document.querySelectorAll('.rika-juken-only').forEach(el => {
        el.classList.toggle('hidden', sansuState.grade < 4);
      });
      // 小1〜3で受験カテゴリ選択中なら解除
      if (sansuState.grade < 4 && ['daichi', 'suiyoueki', 'denki', 'chikara', 'hikari_oto', 'kitai', 'jintai'].includes(sansuState.cat)) {
        sansuState.cat = null;
        document.querySelectorAll('.rika-cat-btn').forEach(b => b.classList.remove('selected'));
        hideSansuSteps('rika-step-diff');
      }
      hideSansuSteps('rika-step-cat');
      document.querySelectorAll('.rika-topmode-btn').forEach(b => b.classList.remove('selected'));
      showSansuStep('rika-step-topmode');
      updateRikaStart();
    };
  });

  // STEP2: モード
  document.querySelectorAll('.rika-topmode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.rika-topmode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (btn.dataset.topmode === 'normal') {
        showSansuStep('rika-step-cat');
      } else if (btn.dataset.topmode === 'science') {
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        initScienceHome();
        showScreen('science-home');
      } else if (btn.dataset.topmode === 'lab') {
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        initLabHome();
        showScreen('lab-home');
      } else if (btn.dataset.topmode === 'hama') {
        // ★理科のじゅくナビ（2026-07-27）。算数と同じパネルを画面ごと移動して使い回す。
        //   理科は回番号→ID帯の表を持たず、hama_map の units（単元名）で問題を引く
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        document.getElementById('rika-start-zone').classList.add('hidden');
        sansuState.subject = 'rika';
        sansuState.hamaCourse = null;
        moveHamaPanelTo('screen-rika-home', 'rika-start-zone');
        loadHamaMap().then(() => { showSansuStep('sansu-step-hama'); renderHamaPanel(); })
          .catch(() => showToast('じゅくの対応表が読みこめませんでした'));
      } else if (btn.dataset.topmode === 'nadago') {
        // ★理科の灘合（本人指摘 2026-08-09）。算数の灘合に理科が混ざっていたので分けた。
        //   コースの subject を 'nadago_rika' にしてあるので、算数の灘合には出てこない
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        document.getElementById('rika-start-zone').classList.add('hidden');
        sansuState.subject = 'nadago_rika';
        sansuState.hamaCourse = 'nadago_rika';
        sansuState.hamaMode = 'no';
        sansuState.hamaUnit = null;
        moveHamaPanelTo('screen-rika-home', 'rika-start-zone');
        loadHamaMap()
          .then(() => ensureHamaCourses(sansuState.grade, 'nadago_rika'))
          .then(ok => {
            if (!ok) { showToast('この学年の理科の灘合はまだ準備中です'); return; }
            showSansuStep('sansu-step-hama'); renderHamaPanel();
          })
          .catch(() => showToast('灘合の対応表が読みこめませんでした'));
      } else {
        hideSansuSteps('rika-step-cat', 'rika-step-diff');
        showToast('もうすぐ追加されます！工事中🚧');
      }
    };
  });

  // STEP3: カテゴリ
  document.querySelectorAll('.rika-cat-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.rika-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.rcat;
      showSansuStep('rika-step-diff');
      updateRikaStart();
    };
  });

  // STEP3: 難易度
  document.querySelectorAll('.rika-diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.rika-diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.diff = btn.dataset.diff === 'gachi' ? 'gachi' : Number(btn.dataset.diff);
      updateRikaStart();
    };
  });

  document.getElementById('rika-btn-start').onclick = () => startRikaSession();

  document.getElementById('rika-btn-weak').classList.remove('active-weak');
  document.getElementById('rika-btn-weak').onclick = (e) => startSansuWeakSession(e.currentTarget);
  document.getElementById('rika-btn-progress').onclick = () => openProgressScreenFrom('rika-home', 'rika');
  document.getElementById('rika-btn-search').onclick = () => openSearchScreen('rika');

  hideSansuSteps('rika-step-topmode', 'rika-step-cat', 'rika-step-diff');
  document.querySelectorAll('.rika-topmode-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('rika-start-zone').classList.add('hidden');

  renderCatBadges('rika');
  renderGradeCrowns('rika');
}

function updateRikaStart() {
  renderDiffBadgesSansu();
  const zone = document.getElementById('rika-start-zone');
  const info = document.getElementById('rika-start-info');
  const ready = sansuState.grade && sansuState.cat && sansuState.diff;
  if (ready) {
    info.textContent = `小${sansuState.grade} / ${RIKA_CAT_LABELS[sansuState.cat]} / ${DIFF_LABELS[sansuState.diff]}`;
  }
  setChainCountOptions('rika-q-count', sansuState.diff === 5 || sansuState.diff === 'gachi');
  zone.classList.toggle('hidden', !ready);
}

async function startRikaSession() {
  showLoading();
  try {
    const isChain = sansuState.diff === 5 || sansuState.diff === 'gachi';
    const all = isChain
      ? await loadChainQuestions(sansuState.diff === 'gachi' ? 'rikagachi' : sansuState.subject, sansuState.cat, sansuState.grade, document.getElementById('rika-q-count').value)
      : sansuState.cat === 'mix'
        ? await loadMixQuestions(sansuState.grade, sansuState.diff)
        : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
    if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
    if (isChain) {
      sansuState.questions = all;
    } else {
      const countVal = document.getElementById('rika-q-count').value;
      const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
      sansuState.questions = shuffle([...all]).slice(0, count);
    }
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

// ── 社会ホーム（学年→カテゴリ→難易度の階層式） ──────────
function initShakaiHome() {
  sansuState.subject = 'shakai';
  document.getElementById('shakai-nickname').textContent = state.nickname;
  sansuState.grade = null; sansuState.diff = null; sansuState.cat = null;

  document.querySelectorAll('#screen-shakai-home [data-back="subject"]').forEach(b => {
    b.onclick = () => showScreen('subject');
  });

  // STEP1: 学年（小3〜6）
  document.querySelectorAll('.shakai-grade-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.shakai-grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.grade = Number(btn.dataset.grade);
      hideSansuSteps('shakai-step-cat');
      document.querySelectorAll('.shakai-topmode-btn').forEach(b => b.classList.remove('selected'));
      showSansuStep('shakai-step-topmode');
      updateShakaiStart();
    };
  });

  // STEP2: モード
  document.querySelectorAll('.shakai-topmode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.shakai-topmode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (btn.dataset.topmode === 'normal') {
        showSansuStep('shakai-step-cat');
      } else if (btn.dataset.topmode === 'history') {
        hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
        initNipponHome();
        showScreen('nippon-home');
      } else if (btn.dataset.topmode === 'go') {
        hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
        showScreen('shakaigo-home');
      } else {
        hideSansuSteps('shakai-step-cat', 'shakai-step-diff');
        showToast('もうすぐ追加されます！工事中🚧');
      }
    };
  });

  // STEP3: カテゴリ
  document.querySelectorAll('.shakai-cat-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.shakai-cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.cat = btn.dataset.hcat;
      showSansuStep('shakai-step-diff');
      updateShakaiStart();
    };
  });

  // STEP3: 難易度
  document.querySelectorAll('.shakai-diff-btn').forEach(btn => {
    btn.classList.remove('selected');
    btn.onclick = () => {
      document.querySelectorAll('.shakai-diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      sansuState.diff = Number(btn.dataset.diff);
      updateShakaiStart();
    };
  });

  document.getElementById('shakai-btn-start').onclick = () => startShakaiSession();

  document.getElementById('shakai-btn-weak').classList.remove('active-weak');
  document.getElementById('shakai-btn-weak').onclick = (e) => startSansuWeakSession(e.currentTarget);
  document.getElementById('shakai-btn-progress').onclick = () => openProgressScreenFrom('shakai-home', 'shakai');

  hideSansuSteps('shakai-step-topmode', 'shakai-step-cat', 'shakai-step-diff');
  document.querySelectorAll('.shakai-topmode-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('shakai-start-zone').classList.add('hidden');

  renderCatBadges('shakai');
  renderGradeCrowns('shakai');
}

function updateShakaiStart() {
  renderDiffBadgesSansu();
  const zone = document.getElementById('shakai-start-zone');
  const info = document.getElementById('shakai-start-info');
  const ready = sansuState.grade && sansuState.cat && sansuState.diff;
  if (ready) {
    info.textContent = `小${sansuState.grade} / ${SHAKAI_CAT_LABELS[sansuState.cat]} / ${DIFF_LABELS[sansuState.diff]}`;
  }
  setChainCountOptions('shakai-q-count', sansuState.diff === 5);
  zone.classList.toggle('hidden', !ready);
}

async function startShakaiSession() {
  showLoading();
  try {
    const isChain = sansuState.diff === 5;
    const all = isChain
      ? await loadChainQuestions(sansuState.subject, sansuState.cat, sansuState.grade, document.getElementById('shakai-q-count').value)
      : sansuState.cat === 'mix'
        ? await loadMixQuestions(sansuState.grade, sansuState.diff)
        : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
    if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
    if (isChain) {
      sansuState.questions = all;
    } else {
      const countVal = document.getElementById('shakai-q-count').value;
      const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
      sansuState.questions = shuffle([...all]).slice(0, count);
    }
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
}

async function startSansuSession() {
  if (sansuState.mode === 'normal') {
    showLoading();
    try {
      const isChain = sansuState.diff === 5 || sansuState.diff === 'gachi';
      const all = isChain
        ? await loadChainQuestions(sansuState.diff === 'gachi' ? 'gachi' : sansuState.subject, sansuState.cat, sansuState.grade, document.getElementById('sansu-q-count').value, sansuState.unit)
        : (sansuState.cat === 'mix' && !sansuState.unit)
          ? await loadMixQuestions(sansuState.grade, sansuState.diff)
          : await loadSansuQuestions(sansuState.cat, sansuState.grade, sansuState.diff);
      if (all.length === 0) { showToast('この組み合わせの問題はまだ準備中です'); hideLoading(); return; }
      if (isChain) {
        sansuState.questions = all;
      } else {
        const countVal = document.getElementById('sansu-q-count').value;
        const count = countVal === 'all' ? all.length : Math.min(Number(countVal), all.length);
        sansuState.questions = shuffle([...all]).slice(0, count);
      }
      sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
      coinSessionEarned = 0;
      hideLoading();
      startSansuQuiz();
    } catch(e) { showToast('問題の読み込みに失敗しました'); hideLoading(); }
  } else {
    startDrill();
  }
}

// ── 算数・理科クイズ（通常問題） ──────────────────────
function subjectCatLabels() { return subjectLabels(sansuState.subject); }
function subjectHomeScreen() { return subjectHome(sansuState.subject); }

// カテゴリの全問題（学年・難易度を問わず）から苦手問題（正解率50%以下）を集める
// loadSansuQuestions と同じキャッシュキー（`${subject}-${cat}`）を使い、二重取得を避ける
async function getWeakItemsForCat(subject, cat) {
  const key = `${subject}-${cat}`;
  if (!sansuCache[key]) {
    const fileMap = subjectFiles(subject);
    const res = await fetch(fileMap[cat]);
    sansuCache[key] = await res.json();
  }
  const prog = getProgress();
  return sansuCache[key].filter(q => {
    const p = prog[q.id];
    return p && p.total >= 1 && (p.correct / p.total) <= 0.5;
  });
}

// 算数・理科・社会共通：選択中カテゴリの苦手問題だけで即スタート
async function startSansuWeakSession(btn) {
  if (!sansuState.cat || sansuState.cat === 'mix') { showToast('カテゴリを選んでください'); return; }
  if (btn) btn.classList.add('active-weak');
  showLoading();
  try {
    const weaks = await getWeakItemsForCat(sansuState.subject, sansuState.cat);
    if (!weaks.length) {
      showToast('まだ苦手問題がありません');
      hideLoading();
      if (btn) btn.classList.remove('active-weak');
      return;
    }
    sansuState.questions = shuffle(weaks);
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    hideLoading();
    startSansuQuiz();
  } catch (e) {
    showToast('問題の読み込みに失敗しました');
    hideLoading();
    if (btn) btn.classList.remove('active-weak');
  }
}

// 算数・理科・社会共通：進捗画面を開く（戻るボタンは呼び出し元の画面に戻す）
function openProgressScreenFrom(screenId, subject) {
  const backBtn = document.querySelector('#screen-progress .back-btn');
  if (backBtn) backBtn.dataset.back = screenId;
  showProgressScreen(subject);
}

function startSansuQuiz() {
  // ★大問モードの「えらびなおす」ボタン用の憶え書き。既定では毎回クリアし、
  //   startDaimonSets がこの直後に（必要なときだけ）上書きする（本人要望 2026-08-17）
  sansuState.daimonPickerCtx = null;
  sansuState.searchReturnCtx = false;
  const catLabel = subjectCatLabels()[sansuState.cat] || '問題';
  document.getElementById('sansu-quiz-title').textContent = catLabel;
  const homeScreen = subjectHomeScreen();
  document.querySelectorAll('[data-back="sansu-home"]').forEach(b => b.onclick = () => { showScreen(homeScreen); });
  initNumpad('sq');
  setupQuizExtras('sq');
  // 正解／不正解カウンターの表示をリセット（前回セッションの数が残らないように）
  document.getElementById('sq-correct').textContent = sansuState.correct;
  document.getElementById('sq-wrong').textContent = sansuState.wrong;
  renderSansuQuiz();
  showScreen('sansu-quiz');
}

// **ここ** と書いた所を強調する。原簿から作った 問題文・設定文・解説は この書き方で
// 大事な所を囲んである（じゅくナビのデータに 1,600か所以上）。
// ★算数の文には 60×□<450 のような不等号が生で入っているので、
//   先に < > & を打ち消してから、強調のタグだけ HTML に戻す。逆順だと不等号がタグとして消える。
function sqEm(t, cls) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<em class="' + (cls || 'rei-em') + '">$1</em>')
    // ★紙のテストの「——線部」を再現する下線。__ことば__ と書くと <u> になる
    //   （本人指摘2026-08-15「線が引けるならそのほうがいい」。「」で囲むだけより実物に近い）
    .replace(/__(.+?)__/g, '<u>$1</u>');
}

function renderSansuQuiz() {
  const total = sansuState.questions.length;
  if (sansuState.current >= total) { endSansuSession(); return; }
  const q = sansuState.questions[sansuState.current];
  // 🚩 通報ボタン用に「いま出ている問題」を控える。
  //    qid は showSqFeedback の recordResult と同じキーにそろえる（管理ツールで突き合わせるため）
  setReportCtx({
    qid: `${sansuState.subject}_${q._cat || sansuState.cat}:${q.id}`,
    subject: sansuState.subject, cat: q._cat || sansuState.cat, unit: q.unit,
    grade: sansuState.grade, difficulty: String(sansuState.diff ?? ''),
    question: reportPlainQ(q.question), answer: q.answer, screen: 'sansu-quiz',
  });
  // ★大問の(2)(3)＝同じ設定の続きでは、計算用紙を消さない（本人指示 2026-07-29）。
  //   紙のテストなら①で書いた筆算や数え上げは最後まで手元に残っている。
  resetQuizExtras('sq', !!(q.prevSteps && q.prevSteps.length));
  document.getElementById('sansu-quiz-counter').textContent = `${sansuState.current + 1}/${total}`;
  document.getElementById('sq-question').innerHTML = sqEm(q.question, 'sq-em');
  document.getElementById('sq-meaning').textContent = '';
  const introEl = document.getElementById('sq-chain-intro');
  if (q.chainIntro) { introEl.innerHTML = sqEm(q.chainIntro, 'sq-em'); introEl.classList.remove('hidden'); }
  else { introEl.textContent = ''; introEl.classList.add('hidden'); }
  const figEl = document.getElementById('sq-figure');
  if (q.svg) { figEl.innerHTML = q.svg; figEl.classList.remove('hidden'); }
  else { figEl.innerHTML = ''; figEl.classList.add('hidden'); }
  // ★大問の(2)(3)では、前の設問と その答えを上に残す（2026-07-29）。
  //   紙のテストなら①の問題と自分の書き込みは目の前にある。アプリでは消えていた。
  const prevEl = document.getElementById('sq-prev-steps');
  if (q.prevSteps && q.prevSteps.length) {
    prevEl.innerHTML = q.prevSteps.map(p =>
      `<div class="prev-step"><span class="prev-step-n">(${p.n})</span>` +
      `<span class="prev-step-q">${sqEm(p.question, 'sq-em')}</span>` +
      `<span class="prev-step-a">答え ${sqEm(p.answer, 'sq-em')}</span></div>`
    ).join('');
    prevEl.classList.remove('hidden');
  } else { prevEl.innerHTML = ''; prevEl.classList.add('hidden'); }

  // バッジ
  document.getElementById('sq-grade-badge').textContent = `小${sansuState.grade}`;
  const diffBadge = document.getElementById('sq-diff-badge');
  diffBadge.textContent = DIFF_LABELS[sansuState.diff] || '';
  diffBadge.dataset.level = sansuState.diff;
  const typeBadge = document.getElementById('sq-type-badge');
  if (q.type) { typeBadge.textContent = q.type; typeBadge.classList.remove('hidden'); }
  else { typeBadge.classList.add('hidden'); }

  // フィードバック非表示
  document.getElementById('sq-feedback').classList.add('hidden');
  // 「わかった！やってみる →」は例題(q.rei)専用のラベル。例題を1問見たあと
  // 通常問題に戻ってもラベルが残り、正解したのに「わかった！やってみる」と出ていた（本人報告 2026-07-27）。
  // 毎問ここで既定にもどす。例題のときは下で上書きされる。
  document.getElementById('sq-btn-next').textContent = '次へ →';

  const numpad = document.getElementById('sq-numpad');
  const previewWrap = document.getElementById('sq-preview-wrap');
  const remainWrap = document.getElementById('sq-remain-wrap');
  const choicesWrap = document.getElementById('sq-choices');

  // ★例題（かんたん解説モード）＝解き方を見せるだけ。入力させず、採点もしない
  if (q.rei) {
    numpad.classList.add('hidden');
    previewWrap.classList.add('hidden');
    remainWrap.classList.add('hidden');
    choicesWrap.classList.add('hidden');
    const fb = document.getElementById('sq-feedback');
    document.getElementById('sq-feedback-text').textContent = '💡 やり方';
    const ansEl = document.getElementById('sq-feedback-ans');
    const em = sqEm;   // **ここ** の強調は sqEm にまとめた（不等号も安全に出せる）
    ansEl.innerHTML = (q.kaisetsu || []).map((k, i) =>
      `<span class="rei-step"><b>${i + 1}</b>${em(k)}</span>`).join('')
      + `<span class="rei-ans">答え　${q.answer}</span>`;
    fb.classList.remove('hidden');
    const nextBtn = document.getElementById('sq-btn-next');
    nextBtn.textContent = 'わかった！やってみる →';
    nextBtn.onclick = () => {
      nextBtn.textContent = '次へ →';
      sansuState.current++;
      renderSansuQuiz();
    };
    return;
  }

  // 理科の数値で答える問題は、4択ではなくテンキー入力にする
  const forceNumpad = sansuState.subject === 'rika' && isNumpadAnswer(q.answer);

  if (q.choices && q.choices.length && !forceNumpad) {
    // 4択モード：テンキー系を隠して選択肢を表示
    numpad.classList.add('hidden');
    previewWrap.classList.add('hidden');
    remainWrap.classList.add('hidden');
    choicesWrap.classList.remove('hidden');
    choicesWrap.innerHTML = '';
    shuffle([...q.choices]).forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'sq-choice-btn';
      btn.textContent = ch;
      btn.onclick = () => submitChoiceAnswer(ch, btn);
      choicesWrap.appendChild(btn);
    });
  } else {
    // テンキーモード
    choicesWrap.classList.add('hidden');
    numpad.classList.remove('hidden');
    previewWrap.classList.remove('hidden');
    sansuState.isRemainMode = q.answer && q.answer.includes('余り');
    remainWrap.classList.toggle('hidden', !sansuState.isRemainMode);
    numpad.querySelector('.numpad-rem').classList.toggle('hidden', !sansuState.isRemainMode);
    numpad.querySelector('.numpad-frac').classList.toggle('hidden', !(q.answer && String(q.answer).includes('/')));
    numpad.querySelector('.numpad-mixed').classList.toggle('hidden', !(q.answer && String(q.answer).includes('と')));
    sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputWhole = ''; sansuState.inputPhase = 'main';
    updateNumpadPreview('sq');
    numpad.querySelectorAll('.numpad-btn').forEach(b => b.disabled = false);
  }
}

// 正誤フィードバックの共通表示
function showSqFeedback(q, correct) {
  Snd.answer(correct);
  // 教科間でIDが衝突するため subject_cat:id 形式で記録（ミックスは出身カテゴリq._cat）
  recordResult(`${sansuState.subject}_${q._cat || sansuState.cat}:${q.id}`, correct);
  if (correct) { sansuState.correct++; document.getElementById('sq-correct').textContent = sansuState.correct; }
  else { sansuState.wrong++; document.getElementById('sq-wrong').textContent = sansuState.wrong; }

  const fb = document.getElementById('sq-feedback');
  document.getElementById('sq-feedback-text').textContent = correct ? '✅ 正解！' : '❌ 不正解';
  document.getElementById('sq-feedback-ans').innerHTML = correct ? sqEm(q.meaning)
    : '正解：' + sqEm(q.answer) + '　' + sqEm(q.meaning);
  document.getElementById('sq-meaning').textContent = '';
  fb.classList.remove('hidden');

  document.getElementById('sq-btn-next').onclick = () => {
    sansuState.current++;
    renderSansuQuiz();
  };
}

function submitSansuAnswer() {
  const q = sansuState.questions[sansuState.current];
  let userAnswer = sansuState.inputVal.trim();
  if (sansuState.isRemainMode) {
    userAnswer = `${sansuState.inputVal.trim()}余り${sansuState.inputRemain.trim()}`;
  } else if (sansuState.inputWhole) {
    userAnswer = `${sansuState.inputWhole.trim()}と${sansuState.inputVal.trim()}`;
  }
  if (!userAnswer || userAnswer === '余り' || userAnswer === 'と') { showToast('答えを入力してください'); return; }
  if (userAnswer.endsWith('/')) { showToast('分母を入力してください'); return; }

  const correct = checkSansuAnswer(userAnswer, q.answer);
  document.getElementById('sq-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = true);
  showSqFeedback(q, correct);
}

function submitChoiceAnswer(chosen, btn) {
  const q = sansuState.questions[sansuState.current];
  const correct = checkSansuAnswer(chosen, q.answer);
  // 全ボタンを無効化し、正解を緑・誤答を赤で示す
  document.querySelectorAll('#sq-choices .sq-choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('choice-correct');
    else if (b === btn) b.classList.add('choice-wrong');
  });
  showSqFeedback(q, correct);
}

function checkSansuAnswer(input, correct) {
  const normalize = s => String(s).trim().replace(/\s/g, '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).toLowerCase();
  return normalize(input) === normalize(correct);
}

function endSansuSession() {
  const total = sansuState.questions.length;
  const score = total > 0 ? Math.round(sansuState.correct / total * 100) : 0;
  let emoji, comment;
  if (score === 100) { emoji = '🏆'; comment = '満点！常在戦場！'; }
  else if (score >= 80) { emoji = '⭐'; comment = 'よくできました！'; }
  else if (score >= 60) { emoji = '👍'; comment = 'もう一息！'; }
  else { emoji = '💪'; comment = 'もう一度チャレンジ！'; }

  document.getElementById('result-emoji').textContent = emoji;
  document.getElementById('result-correct').textContent = sansuState.correct;
  document.getElementById('result-total').textContent = total;
  document.getElementById('result-rate').textContent = `${score}点`;
  document.getElementById('result-comment').textContent = comment;
  renderResultCheer(score);
  maybeAwardPerfect(score, total);
  awardSessionCoins(score, total);
  awardSessionTicket(total);

  document.getElementById('btn-result-home').onclick = () => {
    if (sansuState.subject === 'rika') { initRikaHome(); showScreen('rika-home'); }
    else if (sansuState.subject === 'shakai') { initShakaiHome(); showScreen('shakai-home'); }
    else { initSansuHome(); showScreen('sansu-home'); }
  };
  document.getElementById('btn-result-retry').onclick = () => {
    const keepDaimonCtx = sansuState.daimonPickerCtx; // startSansuQuizが毎回クリアするので退避して戻す
    const keepSearchCtx = sansuState.searchReturnCtx; // 同上（本人要望 2026-08-17）
    sansuState.current = 0; sansuState.correct = 0; sansuState.wrong = 0;
    coinSessionEarned = 0;
    sansuState.questions = shuffle([...sansuState.questions]);
    document.getElementById('sq-correct').textContent = '0';
    document.getElementById('sq-wrong').textContent = '0';
    startSansuQuiz();
    sansuState.daimonPickerCtx = keepDaimonCtx;
    sansuState.searchReturnCtx = keepSearchCtx;
  };

  // ★大問（じゅくナビの宿題・復習テスト（大問）など）を解き終えたときだけ、
  //   同じ大問えらびの一覧に戻れるボタンを出す（本人要望 2026-08-17）
  const daimonBtn = document.getElementById('btn-result-daimon');
  if (daimonBtn) {
    const ctx = sansuState.daimonPickerCtx;
    daimonBtn.classList.toggle('hidden', !ctx);
    if (ctx) {
      daimonBtn.onclick = () => {
        showScreen(subjectHomeScreen());
        openDaimonPicker(ctx.sets, ctx.grade, ctx.hamaSubj, ctx.label);
      };
    }
  }

  // ★「単元でさがす」から出題したときだけ、検索結果の一覧に戻れるボタンを出す（本人要望 2026-08-17）
  const searchBtn = document.getElementById('btn-result-search');
  if (searchBtn) {
    searchBtn.classList.toggle('hidden', !sansuState.searchReturnCtx);
    if (sansuState.searchReturnCtx) searchBtn.onclick = () => showScreen('search');
  }

  showScreen('result');
  Snd.result(score);
  checkTitlePromotion();
  pushAchievementToRanking();
}

// ── 問題への書き込み・計算用紙（算数・理科クイズ／ドリル共通） ──────────
function createDrawPad(canvas, opts = {}) {
  const grid = !!opts.grid;
  const penColor = opts.penColor || '#1a1a1a';
  const lineWidth = opts.lineWidth || 5;
  const pad = { canvas, ctx: canvas.getContext('2d'), strokes: [], current: [], drawing: false, suppressed: false };

  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };
  canvas.onpointerdown = e => {
    if (pad.suppressed) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pad.drawing = true;
    pad.current = [pos(e)];
    draw();
  };
  canvas.onpointermove = e => { if (!pad.drawing) return; pad.current.push(pos(e)); draw(); };
  const up = () => {
    if (!pad.drawing) return;
    pad.drawing = false;
    if (pad.current.length > 1) pad.strokes.push(pad.current);
    pad.current = [];
    draw();
  };
  canvas.onpointerup = up;
  canvas.onpointercancel = up;
  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  function draw() {
    const { ctx } = pad;
    if (grid) {
      ctx.fillStyle = '#f8f6ef';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(120,120,120,0.18)';
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = step; x < canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = step; y < canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      // 紙の端をはっきりさせる縁取り（ピクセルとして直接描くのでCSSに左右されない）
      const bw = Math.max(4, Math.round(canvas.width / 100));
      ctx.strokeStyle = '#4f7cff';
      ctx.lineWidth = bw;
      ctx.strokeRect(bw / 2, bw / 2, canvas.width - bw, canvas.height - bw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const paint = pts => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    pad.strokes.forEach(paint);
    paint(pad.current);
  }
  pad.clear = () => { pad.strokes = []; pad.current = []; draw(); };
  pad.undo = () => { pad.strokes.pop(); draw(); };
  // 描いている途中のストロークを、履歴に残さず取り消す（2本指ジェスチャー開始時などに使用）
  pad.cancelCurrent = () => { pad.drawing = false; pad.current = []; draw(); };
  draw();
  return pad;
}

const drawPads = {}; // prefix('sq'|'drill') -> { write }

// セッション開始時に1回だけ呼ぶ（ボタン結線・キャンバス初期化）
function setupQuizExtras(prefix) {
  if (drawPads[prefix]) return;
  const writeCanvas = document.getElementById(`${prefix}-write-canvas`);
  const write = createDrawPad(writeCanvas, { penColor: '#ffe066', lineWidth: 4 });
  drawPads[prefix] = { write };

  const questionBox = document.getElementById(`${prefix}-question-box`);
  const btnWrite = document.getElementById(`${prefix}-btn-write`);
  const btnErase = document.getElementById(`${prefix}-btn-erase`);
  const btnScratch = document.getElementById(`${prefix}-btn-scratch`);
  const inputArea = document.getElementById(`${prefix}-input-area`);

  btnWrite.onclick = () => {
    const active = questionBox.classList.toggle('write-active');
    btnWrite.classList.toggle('active', active);
    btnWrite.textContent = active ? '✅ 書き込み終了' : '✏️ 書き込み';
    btnErase.classList.toggle('hidden', !active);
    inputArea.classList.toggle('hidden', active);
  };
  btnErase.onclick = () => write.clear();
  btnScratch.onclick = () => openScratchFullscreen();
}

// 問題が切り替わるたびに呼ぶ（書き込み・計算用紙をリセットし、問題画面に戻す）
// keepScratch＝計算用紙の中身を残す。大問の(2)(3)のように「同じ設定の続き」で使う（2026-07-29）。
// ★書き込み(write)のほうは毎問クリアする。あれは問題文の上に重ねるもので、
//   設問が変わると文の高さが変わり、書いた線が図とずれてしまうため。
function resetQuizExtras(prefix, keepScratch) {
  const pads = drawPads[prefix];
  if (!pads) return;
  pads.write.clear();
  document.getElementById(`${prefix}-question-box`).classList.remove('write-active');
  const btnWrite = document.getElementById(`${prefix}-btn-write`);
  btnWrite.classList.remove('active');
  btnWrite.textContent = '✏️ 書き込み';
  document.getElementById(`${prefix}-btn-erase`).classList.add('hidden');
  document.getElementById(`${prefix}-input-area`).classList.remove('hidden');
  if (!scratchDocked) closeScratchFullscreen(); // ドッキング表示中は開いたままにする
  if (scratchPad && !keepScratch) scratchPad.clear();
}

// ── 計算用紙（全画面・画面の4倍の広さ・2本指でパン＆ピンチズーム） ──────────
let scratchPad = null;
let scratchView = null; // { virtualW, virtualH, vw, vh, panX, panY, zoom }
let scratchDocked = false; // 横向きタブレットなどで常時ドッキング表示中か

const scratchDockQuery = window.matchMedia('(min-width: 700px) and (orientation: landscape)');

// 算数・理科クイズ／計算ドリル画面で横向きの広い画面なら、計算用紙を常時ドッキング表示する
function updateScratchDock() {
  const overlay = document.getElementById('scratch-fullscreen');
  const isQuizScreen = currentScreenId === 'sansu-quiz' || currentScreenId === 'drill';
  const shouldDock = isQuizScreen && scratchDockQuery.matches;
  if (shouldDock && !scratchDocked) {
    scratchDocked = true;
    overlay.classList.add('docked');
    openScratchFullscreen();
  } else if (!shouldDock && scratchDocked) {
    scratchDocked = false;
    overlay.classList.remove('docked');
    closeScratchFullscreen();
  }
}
scratchDockQuery.addEventListener('change', updateScratchDock);
window.addEventListener('resize', updateScratchDock);

const SCRATCH_MIN_ZOOM = 0.25;
const SCRATCH_MAX_ZOOM = 3;

function scratchApplyTransform(canvas) {
  const v = scratchView;
  canvas.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`;
}

function scratchClampView() {
  const v = scratchView;
  v.zoom = Math.min(SCRATCH_MAX_ZOOM, Math.max(SCRATCH_MIN_ZOOM, v.zoom));
  const dispW = v.virtualW * v.zoom, dispH = v.virtualH * v.zoom;
  // 表示中の紙が画面から大きくはみ出しすぎない程度に余裕を持たせてクランプ
  const marginX = Math.max(dispW, v.vw) * 0.5;
  const marginY = Math.max(dispH, v.vh) * 0.5;
  v.panX = Math.min(marginX, Math.max(v.vw - dispW - marginX, v.panX));
  v.panY = Math.min(marginY, Math.max(v.vh - dispH - marginY, v.panY));
}

function openScratchFullscreen() {
  const overlay = document.getElementById('scratch-fullscreen');
  const viewport = document.getElementById('scratch-fs-viewport');
  const canvas = document.getElementById('scratch-fs-canvas');

  if (!scratchPad) {
    const dpr = window.devicePixelRatio || 1;
    const vw = viewport.clientWidth || window.innerWidth;
    const vh = viewport.clientHeight || window.innerHeight;
    // 画面の縦横それぞれ2倍＝面積で4倍の仮想キャンバス
    const virtualW = vw * 2;
    const virtualH = vh * 2;
    canvas.style.width = virtualW + 'px';
    canvas.style.height = virtualH + 'px';
    // 古いiPad等では巨大なcanvas（縦横×dprで1000万px超）が確保できず、
    // キャンバスが真っ白のまま描画されないことがあるため、実際のピクセル数に上限を設ける
    const MAX_CANVAS_PIXELS = 4000000;
    const rawPixels = virtualW * dpr * virtualH * dpr;
    const effDpr = rawPixels > MAX_CANVAS_PIXELS ? dpr * Math.sqrt(MAX_CANVAS_PIXELS / rawPixels) : dpr;
    canvas.width = Math.round(virtualW * effDpr);
    canvas.height = Math.round(virtualH * effDpr);
    scratchPad = createDrawPad(canvas, { grid: true, penColor: '#1a1a1a', lineWidth: 4 * effDpr });

    // 初期表示：仮想キャンバスの中央が画面中央に来るように配置（zoom=1）
    scratchView = { virtualW, virtualH, vw, vh, panX: -(virtualW - vw) / 2, panY: -(virtualH - vh) / 2, zoom: 1 };
    scratchApplyTransform(canvas);

    document.getElementById('fs-scratch-undo').onclick = () => scratchPad.undo();
    document.getElementById('fs-scratch-clear').onclick = () => scratchPad.clear();
    document.getElementById('fs-scratch-close').onclick = () => closeScratchFullscreen();
    document.getElementById('fs-scratch-reset').onclick = () => {
      // そのときの実際の画面サイズに合わせて、紙全体が収まる縮小率にする
      const curVw = viewport.clientWidth || scratchView.vw;
      const curVh = viewport.clientHeight || scratchView.vh;
      const fitZoom = Math.min(curVw / scratchView.virtualW, curVh / scratchView.virtualH, 1);
      scratchView.zoom = Math.max(SCRATCH_MIN_ZOOM, fitZoom);
      scratchView.panX = (curVw - scratchView.virtualW * scratchView.zoom) / 2;
      scratchView.panY = (curVh - scratchView.virtualH * scratchView.zoom) / 2;
      scratchApplyTransform(canvas);
    };

    // ── 2本指ジェスチャー（パン＋ピンチズーム） ──
    const pointers = new Map(); // pointerId -> {x, y}（viewport基準の座標）
    let gestureActive = false;
    let prevMid = null, prevDist = null;

    const viewportPos = e => {
      const r = viewport.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const midOf = pts => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
    const distOf = pts => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

    viewport.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, viewportPos(e));
      if (pointers.size === 2) {
        gestureActive = true;
        scratchPad.suppressed = true; // キャンバス側の描画処理を止める
        scratchPad.cancelCurrent(); // 描きかけの線があれば取り消す
        const pts = [...pointers.values()];
        prevMid = midOf(pts);
        prevDist = distOf(pts);
      }
    }, { capture: true });

    viewport.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, viewportPos(e));
      if (!gestureActive || pointers.size !== 2) return;
      e.preventDefault();
      const pts = [...pointers.values()];
      const mid = midOf(pts);
      const dist = distOf(pts);
      const v = scratchView;
      const newZoom = Math.min(SCRATCH_MAX_ZOOM, Math.max(SCRATCH_MIN_ZOOM, v.zoom * (dist / prevDist)));
      // ピンチの中心点がそのまま同じ場所に留まるようパンを補正しつつ、指の移動分も加算
      v.panX = mid.x - (newZoom / v.zoom) * (prevMid.x - v.panX);
      v.panY = mid.y - (newZoom / v.zoom) * (prevMid.y - v.panY);
      v.zoom = newZoom;
      scratchApplyTransform(canvas);
      prevMid = mid;
      prevDist = dist;
    }, { capture: true });

    const endPointer = e => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && gestureActive) {
        gestureActive = false;
        prevMid = null; prevDist = null;
        scratchClampView();
        scratchApplyTransform(canvas);
        scratchPad.suppressed = false; // 描画を再開できるようにする
      }
    };
    viewport.addEventListener('pointerup', endPointer, { capture: true });
    viewport.addEventListener('pointercancel', endPointer, { capture: true });
  }

  overlay.classList.remove('hidden');
}

function closeScratchFullscreen() {
  document.getElementById('scratch-fullscreen').classList.add('hidden');
}

// ── 汎用：指1本でパン・2本指でピンチズーム（地図・図の拡大表示で共用） ──────
function createPinchZoomController(viewport, content, opts = {}) {
  const state = { zoom: opts.initialZoom || 1, panX: 0, panY: 0, minZoom: opts.minZoom || 1, maxZoom: opts.maxZoom || 5 };
  const apply = () => { content.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`; };
  const reset = () => { state.zoom = opts.initialZoom || 1; state.panX = 0; state.panY = 0; apply(); };

  const pointers = new Map();
  let mode = null; // 'pan' | 'pinch'
  let lastPt = null, prevMid = null, prevDist = null;

  const pos = e => { const r = viewport.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const midOf = pts => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
  const distOf = pts => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

  viewport.addEventListener('pointerdown', e => {
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, pos(e));
    if (pointers.size === 1) {
      mode = 'pan'; lastPt = pos(e);
    } else if (pointers.size === 2) {
      mode = 'pinch';
      const pts = [...pointers.values()];
      prevMid = midOf(pts); prevDist = distOf(pts);
    }
  });
  viewport.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, pos(e));
    if (mode === 'pan' && pointers.size === 1) {
      e.preventDefault();
      const p = pos(e);
      state.panX += p.x - lastPt.x;
      state.panY += p.y - lastPt.y;
      lastPt = p;
      apply();
    } else if (mode === 'pinch' && pointers.size === 2) {
      e.preventDefault();
      const pts = [...pointers.values()];
      const mid = midOf(pts), dist = distOf(pts);
      const newZoom = Math.min(state.maxZoom, Math.max(state.minZoom, state.zoom * (dist / prevDist)));
      state.panX = mid.x - (newZoom / state.zoom) * (prevMid.x - state.panX);
      state.panY = mid.y - (newZoom / state.zoom) * (prevMid.y - state.panY);
      state.zoom = newZoom;
      apply();
      prevMid = mid; prevDist = dist;
    }
  });
  const endPointer = e => {
    pointers.delete(e.pointerId);
    if (pointers.size === 1) { mode = 'pan'; lastPt = [...pointers.values()][0]; }
    else if (pointers.size === 0) { mode = null; }
  };
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  apply();
  return { apply, reset, state };
}

// ── 図の拡大表示（虎の巻・はかせの図鑑・ニッポンのあゆみのカード内の図を共通でタップ拡大） ──
let diagramViewerController = null;
function openDiagramViewer(svgEl) {
  const overlay = document.getElementById('diagram-viewer');
  const content = document.getElementById('diagram-viewer-content');
  content.innerHTML = svgEl.outerHTML;
  const innerSvg = content.querySelector('svg');
  if (innerSvg) { innerSvg.style.width = '100%'; innerSvg.style.height = 'auto'; innerSvg.style.maxHeight = 'none'; innerSvg.style.cursor = 'default'; }
  if (!diagramViewerController) {
    diagramViewerController = createPinchZoomController(
      document.getElementById('diagram-viewer-viewport'),
      content,
      { minZoom: 1, maxZoom: 6 }
    );
    document.getElementById('diagram-viewer-close').onclick = () => overlay.classList.add('hidden');
    document.getElementById('diagram-viewer-reset').onclick = () => diagramViewerController.reset();
  }
  diagramViewerController.reset();
  overlay.classList.remove('hidden');
}
document.addEventListener('click', e => {
  const svg = e.target.closest('.tora-card-body svg');
  if (svg) openDiagramViewer(svg);
});

// ── テンキー共通 ────────────────────────────────────────
function initNumpad(prefix) {
  const numpad = document.getElementById(`${prefix}-numpad`);
  numpad.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => handleNumpadKey(prefix, btn.dataset.key);
  });
}

function handleNumpadKey(prefix, key) {
  if (key === 'submit') {
    if (prefix === 'sq') submitSansuAnswer();
    else if (prefix === 'drill') submitDrillAnswer();
    return;
  }
  if (key === 'rem') {
    sansuState.inputPhase = 'remain';
    updateNumpadPreview(prefix);
    return;
  }
  if (key === 'frac') {
    // 分数の「／」：分子入力後に1回だけ・小数とは併用不可
    if (!sansuState.inputVal || sansuState.inputVal.includes('/') || sansuState.inputVal.includes('.')) return;
    sansuState.inputVal += '/';
    updateNumpadPreview(prefix);
    return;
  }
  if (key === 'mixedSep') {
    // 帯分数の「と」：整数部を確定して分数部の入力に切り替える（1回だけ）
    if (!sansuState.inputVal || sansuState.inputWhole || sansuState.inputVal.includes('/') || sansuState.inputVal.includes('.')) return;
    sansuState.inputWhole = sansuState.inputVal;
    sansuState.inputVal = '';
    updateNumpadPreview(prefix);
    return;
  }
  if (key === 'del') {
    if (sansuState.inputPhase === 'remain') {
      sansuState.inputRemain = sansuState.inputRemain.slice(0, -1);
    } else if (!sansuState.inputVal && sansuState.inputWhole) {
      // 分数部が空の状態で削除→整数部の確定を取り消して編集に戻す
      sansuState.inputVal = sansuState.inputWhole;
      sansuState.inputWhole = '';
    } else {
      sansuState.inputVal = sansuState.inputVal.slice(0, -1);
    }
    updateNumpadPreview(prefix);
    return;
  }
  // 数字・小数点
  if (sansuState.inputPhase === 'remain') {
    // ★あまりにも小数点が要る。小数のわり算では「5.6余り0.02」のように
    //   あまりが小数になる（小4マスター No.6・No.33）。ここで '.' を捨てていたため、
    //   その形の答えは物理的に入力できず、必ず不正解になっていた（2026-09-01に実測で発覚）
    if (key === '.' && sansuState.inputRemain.includes('.')) return;
    sansuState.inputRemain += key;
  } else {
    if (key === '.' && (sansuState.inputVal.includes('.') || sansuState.inputVal.includes('/'))) return;
    sansuState.inputVal += key;
  }
  updateNumpadPreview(prefix);
}

function updateNumpadPreview(prefix) {
  const mainEl = document.getElementById(`${prefix}-preview`);
  const remainEl = document.getElementById(`${prefix}-remain-preview`);
  mainEl.textContent = sansuState.inputWhole
    ? `${sansuState.inputWhole}と${sansuState.inputVal || '＿'}`
    : (sansuState.inputVal || '＿');
  if (remainEl) remainEl.textContent = sansuState.inputRemain || '＿';
}

// ── 計算ドリル ──────────────────────────────────────────
// 学年(1〜6)×難易度(1〜4)で範囲を変える。添字は [grade-1][diff-1]
const DRILL_ADDSUB_RANGE = [
  [[1,5],[3,9],[5,15],[10,20]],
  [[10,20],[15,40],[30,70],[50,99]],
  [[50,150],[100,300],[200,600],[400,999]],
  [[300,700],[500,1500],[1000,3000],[2000,4999]],
  [[2000,5000],[4000,9999],[8000,15000],[12000,29999]],
  [[10000,30000],[20000,50000],[40000,80000],[60000,99999]],
];
// [ [a範囲, b範囲], ... ]
const DRILL_MUL_RANGE = [
  [[[2,4],[2,4]], [[2,6],[2,6]], [[3,9],[3,9]], [[5,9],[5,9]]],
  [[[2,9],[2,9]], [[5,9],[5,9]], [[10,20],[2,9]], [[10,30],[2,9]]],
  [[[10,30],[2,9]], [[10,50],[2,9]], [[10,99],[2,15]], [[10,99],[10,30]]],
  [[[10,50],[10,30]], [[10,99],[10,50]], [[10,99],[10,99]], [[100,300],[10,50]]],
  [[[10,99],[10,99]], [[100,300],[10,50]], [[100,500],[10,99]], [[100,999],[10,99]]],
  [[[100,500],[10,99]], [[100,999],[10,99]], [[100,999],[100,300]], [[100,999],[100,999]]],
];
// [ [除数範囲, 商範囲], ... ]（あまりありも共用、あまりは 1〜除数-1 で別途生成）
const DRILL_DIV_RANGE = [
  [[[2,5],[2,5]], [[2,9],[2,5]], [[2,9],[2,9]], [[2,9],[5,12]]],
  [[[2,9],[2,9]], [[2,9],[5,12]], [[2,12],[5,15]], [[2,20],[5,20]]],
  [[[2,12],[5,20]], [[2,20],[5,30]], [[2,30],[10,40]], [[2,50],[10,50]]],
  [[[2,30],[10,50]], [[2,50],[10,99]], [[10,50],[10,99]], [[10,99],[10,99]]],
  [[[10,50],[10,99]], [[10,99],[10,99]], [[10,99],[50,200]], [[10,99],[100,500]]],
  [[[10,99],[50,200]], [[10,99],[100,500]], [[100,300],[10,99]], [[100,999],[10,99]]],
];
// 小数は小4以上のみ。{int:整数部の最大桁数, dec:小数点以下の桁数}
const DRILL_DECIMAL_RANGE = [
  [{int:1,dec:1}, {int:2,dec:1}, {int:2,dec:2}, {int:2,dec:2}],
  [{int:2,dec:2}, {int:3,dec:1}, {int:3,dec:2}, {int:3,dec:2}],
  [{int:3,dec:2}, {int:3,dec:2}, {int:4,dec:2}, {int:5,dec:2}],
];
// 分数は小5以上のみ。denは分母の範囲、allowImproperは答えが1を超える（帯分数）のを許すか
const DRILL_FRAC_RANGE = [
  [{den:[3,6],allowImproper:false}, {den:[3,9],allowImproper:false}, {den:[4,12],allowImproper:true}, {den:[4,12],allowImproper:true}],
  [{den:[4,9],allowImproper:false}, {den:[4,12],allowImproper:true}, {den:[6,15],allowImproper:true}, {den:[6,15],allowImproper:true}],
];

// 問題自動生成
function generateDrillProblem() {
  const g = sansuState.grade;
  const d = sansuState.drillDiff || 1;
  let type = sansuState.drillType;
  if (type === 'mix') {
    const types = getAvailableDrillTypes(g);
    type = types[Math.floor(Math.random() * types.length)];
  }

  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const gcdFn = (a, b) => b === 0 ? a : gcdFn(b, a % b);

  if (type === 'add') {
    const [lo, hi] = DRILL_ADDSUB_RANGE[g - 1][d - 1];
    const a = rnd(lo, hi), b = rnd(lo, hi);
    return { question: `${a} ＋ ${b} ＝`, answer: String(a + b) };
  }
  if (type === 'sub') {
    const [lo, hi] = DRILL_ADDSUB_RANGE[g - 1][d - 1];
    const b = rnd(lo, hi), a = b + rnd(1, hi - lo + 1);
    return { question: `${a} － ${b} ＝`, answer: String(a - b) };
  }
  if (type === 'mul') {
    const [[aLo, aHi], [bLo, bHi]] = DRILL_MUL_RANGE[g - 1][d - 1];
    const a = rnd(aLo, aHi), b = rnd(bLo, bHi);
    return { question: `${a} × ${b} ＝`, answer: String(a * b) };
  }
  if (type === 'div') {
    const [[dLo, dHi], [qLo, qHi]] = DRILL_DIV_RANGE[g - 1][d - 1];
    const dv = rnd(dLo, dHi), q = rnd(qLo, qHi), n = dv * q;
    return { question: `${n} ÷ ${dv} ＝`, answer: String(q) };
  }
  if (type === 'divrem') {
    const [[dLo, dHi], [qLo, qHi]] = DRILL_DIV_RANGE[g - 1][d - 1];
    const dv = rnd(Math.max(dLo, 2), dHi), q = rnd(qLo, qHi), r = rnd(1, dv - 1), n = dv * q + r;
    return { question: `${n} ÷ ${dv} ＝ □ あまり □`, answer: `${q}余り${r}`, isRemain: true };
  }
  if (type === 'decimal') {
    const gi = Math.min(Math.max(g, 4), 6) - 4;
    const { int, dec } = DRILL_DECIMAL_RANGE[gi][d - 1];
    const decDenom = Math.pow(10, dec);
    const randDec = () => {
      const v = rnd(1, Math.pow(10, int) * decDenom - 1);
      return v / decDenom;
    };
    const a = randDec(), b = randDec();
    const ans = Number((a + b).toFixed(dec)).toString();
    return { question: `${a.toFixed(dec)} ＋ ${b.toFixed(dec)} ＝`, answer: ans };
  }
  if (type === 'fraction') {
    // 分数はテンキーの「╱分数」「と」キーで入力（約分した形で判定）
    const gi = Math.min(Math.max(g, 5), 6) - 5;
    const cell = DRILL_FRAC_RANGE[gi][d - 1];
    const den = rnd(cell.den[0], cell.den[1]);
    let n1, n2, num, op;
    if (Math.random() < 0.5) {
      op = '＋';
      n1 = rnd(1, den - 1);
      n2 = cell.allowImproper ? rnd(1, den - 1) : rnd(1, den - n1);
      num = n1 + n2;
    } else {
      op = '−';
      n1 = rnd(1, den - 1); n2 = rnd(1, n1);
      num = n1 - n2;
    }
    const gc = gcdFn(num, den) || 1;
    const redNum = num / gc, redDen = den / gc;
    if (redDen === 1) {
      return { question: `${n1}/${den} ${op} ${n2}/${den} ＝\n（約分できるときは約分してね）`, answer: String(redNum), isFrac: true };
    }
    if (redNum > redDen) {
      const whole = Math.floor(redNum / redDen), rem = redNum - whole * redDen;
      return { question: `${n1}/${den} ${op} ${n2}/${den} ＝\n（約分できるときは約分してね）`, answer: `${whole}と${rem}/${redDen}`, isMixed: true, isFrac: true };
    }
    return { question: `${n1}/${den} ${op} ${n2}/${den} ＝\n（約分できるときは約分してね）`, answer: `${redNum}/${redDen}`, isFrac: true };
  }
  // fallback add
  const a = rnd(1, 9), b = rnd(1, 9);
  return { question: `${a} ＋ ${b} ＝`, answer: String(a + b) };
}

function getAvailableDrillTypes(grade) {
  const base = ['add','sub'];
  if (grade >= 2) base.push('mul');
  if (grade >= 3) base.push('div','divrem');
  if (grade >= 4) base.push('decimal');
  if (grade >= 5) base.push('fraction');
  return base;
}

// 学年に合わない計算の種類（例：小1の小数）をボタンごと隠す
function refreshDrillTypeAvailability() {
  if (!sansuState.grade) return;
  const available = getAvailableDrillTypes(sansuState.grade);
  document.querySelectorAll('.drill-type-btn').forEach(btn => {
    const dtype = btn.dataset.dtype;
    const ok = dtype === 'mix' || available.includes(dtype);
    btn.classList.toggle('hidden', !ok);
  });
  // 選択中の種類が学年変更で選べなくなったら解除してやり直し
  if (sansuState.drillType && sansuState.drillType !== 'mix' && !available.includes(sansuState.drillType)) {
    sansuState.drillType = null;
    sansuState.drillDiff = null;
    document.querySelectorAll('.drill-type-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('#sansu-step-drilldiff .diff-btn').forEach(b => b.classList.remove('selected'));
    hideSansuSteps('sansu-step-drilldiff', 'sansu-step-time');
  }
}

function startDrill() {
  sansuState.drillCorrect = 0; sansuState.drillWrong = 0;
  sansuState.drillTimeLeft = sansuState.drillTime;
  sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputPhase = 'main';

  document.getElementById('drill-correct').textContent = '0';
  document.getElementById('drill-wrong').textContent = '0';
  document.getElementById('drill-result').classList.add('hidden');
  document.getElementById('drill-numpad').classList.remove('hidden');
  document.getElementById('drill-timer-wrap').classList.toggle('hidden', sansuState.drillTime === 0);
  document.getElementById('drill-score-label').textContent = '';
  document.getElementById('drill-feedback').classList.add('hidden');

  document.querySelectorAll('[data-back="sansu-home"]').forEach(b => b.onclick = () => {
    clearInterval(sansuState.drillTimerId);
    showScreen('sansu-home');
  });

  initNumpad('drill');
  setupQuizExtras('drill');
  showScreen('drill');
  renderDrillProblem();

  // タイムアタックのみタイマー起動
  if (sansuState.drillTime > 0) {
    updateDrillTimer();
    sansuState.drillTimerId = setInterval(() => {
      sansuState.drillTimeLeft--;
      updateDrillTimer();
      if (sansuState.drillTimeLeft <= 0) {
        clearInterval(sansuState.drillTimerId);
        endDrill();
      }
    }, 1000);
  }
}

function updateDrillTimer() {
  document.getElementById('drill-timer-sec').textContent = sansuState.drillTimeLeft;
  const pct = (sansuState.drillTimeLeft / sansuState.drillTime) * 100;
  document.getElementById('drill-timer-bar').style.width = `${pct}%`;
  document.getElementById('drill-timer-bar').style.background =
    pct > 50 ? 'var(--grad-accent)' : pct > 20 ? 'var(--grad-gold)' : 'var(--grad-red)';
}

let _currentDrillQ = null;

function renderDrillProblem() {
  resetQuizExtras('drill');
  _currentDrillQ = generateDrillProblem();
  document.getElementById('drill-question').textContent = _currentDrillQ.question;

  sansuState.isRemainMode = !!_currentDrillQ.isRemain;
  document.getElementById('drill-remain-wrap').classList.toggle('hidden', !sansuState.isRemainMode);
  document.querySelector('#drill-numpad .numpad-rem').classList.toggle('hidden', !sansuState.isRemainMode);
  document.querySelector('#drill-numpad .numpad-frac').classList.toggle('hidden', !_currentDrillQ.isFrac);
  document.querySelector('#drill-numpad .numpad-mixed').classList.toggle('hidden', !_currentDrillQ.isMixed);

  sansuState.inputVal = ''; sansuState.inputRemain = ''; sansuState.inputWhole = ''; sansuState.inputPhase = 'main';
  updateNumpadPreview('drill');
  document.getElementById('drill-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = false);

  // 無制限モードの場合フィードバックを非表示
  if (sansuState.drillTime === 0) {
    document.getElementById('drill-feedback').classList.add('hidden');
  }
}

function submitDrillAnswer() {
  if (!_currentDrillQ) return;
  let userAnswer = sansuState.inputVal.trim();
  if (sansuState.isRemainMode) userAnswer = `${sansuState.inputVal.trim()}余り${sansuState.inputRemain.trim()}`;
  else if (sansuState.inputWhole) userAnswer = `${sansuState.inputWhole.trim()}と${sansuState.inputVal.trim()}`;
  if (!userAnswer || userAnswer === '余り' || userAnswer === 'と') { showToast('答えを入力してください'); return; }
  if (userAnswer.endsWith('/')) { showToast('分母を入力してください'); return; }

  const correct = checkSansuAnswer(userAnswer, _currentDrillQ.answer);
  Snd.answer(correct);

  if (correct) {
    sansuState.drillCorrect++;
    document.getElementById('drill-correct').textContent = sansuState.drillCorrect;
    // タイムアタックは即次の問題、無制限はフィードバック表示
    if (sansuState.drillTime > 0) {
      renderDrillProblem();
    } else {
      showDrillFeedback(true, _currentDrillQ.answer);
    }
  } else {
    sansuState.drillWrong++;
    document.getElementById('drill-wrong').textContent = sansuState.drillWrong;
    showDrillFeedback(false, _currentDrillQ.answer);
  }
}

function showDrillFeedback(correct, correctAnswer) {
  const fb = document.getElementById('drill-feedback');
  document.getElementById('drill-feedback-text').textContent = correct ? '✅ 正解！' : '❌ 不正解';
  document.getElementById('drill-feedback-ans').textContent = correct ? '' : `正解：${correctAnswer}`;
  fb.classList.remove('hidden');
  document.getElementById('drill-numpad').querySelectorAll('.numpad-btn').forEach(b => b.disabled = true);
  document.getElementById('drill-btn-next').onclick = () => {
    fb.classList.add('hidden');
    renderDrillProblem();
  };
  // タイムアタックの場合は短時間表示後自動次へ
  if (sansuState.drillTime > 0) {
    setTimeout(() => { fb.classList.add('hidden'); renderDrillProblem(); }, 800);
  }
}

function endDrill() {
  document.getElementById('drill-numpad').classList.add('hidden');
  document.getElementById('drill-feedback').classList.add('hidden');

  const score = sansuState.drillCorrect;
  const total = sansuState.drillCorrect + sansuState.drillWrong;
  const rate = total > 0 ? Math.round(score / total * 100) : 0;
  awardSessionTicket(total);

  let emoji, comment;
  if (sansuState.drillTime === 0) {
    // 無制限は正解率
    if (rate === 100) { emoji = '🏆'; comment = '満点！常在戦場！'; }
    else if (rate >= 80) { emoji = '⭐'; comment = 'よくできました！'; }
    else if (rate >= 60) { emoji = '👍'; comment = 'もう一息！'; }
    else { emoji = '💪'; comment = 'もう一度チャレンジ！'; }
    document.getElementById('drill-result-score').textContent = `${rate}点（${score}/${total}問正解）`;
  } else {
    // タイムアタックは正解数がスコア
    if (score >= 30) { emoji = '🏆'; comment = '常在戦場！すごい！'; }
    else if (score >= 20) { emoji = '⭐'; comment = 'よくできました！'; }
    else if (score >= 10) { emoji = '👍'; comment = 'もう一息！'; }
    else { emoji = '💪'; comment = 'もう一度チャレンジ！'; }
    document.getElementById('drill-result-score').textContent = `${score}点！（${sansuState.drillTime}秒で${score}問正解）`;
  }

  // 🏆 ランキング（タイムアタックのみ）。自己ベストは端末に、順位はFirestoreに。
  const bestEl = document.getElementById('drill-result-best');
  const rankBtn = document.getElementById('drill-btn-rank');
  if (sansuState.drillTime > 0) {
    const key = drillGameKey();
    const prevBest = getDrillBest(key);
    const isNewBest = score > prevBest;
    if (isNewBest) setDrillBest(key, score);
    if (score > 0 && typeof saveGameScore === 'function') saveGameScore(key, state.nickname, score, 'max');
    if (isNewBest && prevBest > 0) { emoji = '🏆'; comment = `自己ベスト更新！（前は ${prevBest}問）`; }
    else if (isNewBest) { emoji = '🏆'; comment = 'はじめての記録や！'; }
    bestEl.textContent = isNewBest
      ? `🏆 自己ベスト更新！ ${score}問`
      : `自己ベスト ${Math.max(prevBest, score)}問`;
    bestEl.classList.toggle('is-new', isNewBest);
    bestEl.classList.remove('hidden');
    rankBtn.onclick = () => showGameRanking(key, drillRankTitle(), 'max', '問');
    rankBtn.classList.remove('hidden');
  } else {
    bestEl.classList.add('hidden');
    rankBtn.classList.add('hidden');
  }

  document.getElementById('drill-result-emoji').textContent = emoji;
  document.getElementById('drill-result-comment').textContent = comment;
  document.getElementById('drill-result').classList.remove('hidden');

  // 成績に応じたファンファーレ（タイムアタックは正解数を成績に換算）
  const sndRate = sansuState.drillTime === 0 ? rate
    : score >= 30 ? 100 : score >= 20 ? 85 : score >= 10 ? 60 : 30;
  Snd.result(sndRate);

  // 無制限モードで5問以上の満点ならアイテムボーナス
  if (sansuState.drillTime === 0 && rate === 100 && total >= 5) {
    const kind = randomItemKind();
    addItem(kind, 1);
    showToast(`${ITEM_DEFS[kind].icon} 満点ボーナス！「${ITEM_DEFS[kind].label}」ゲット！`, 3000);
  }

  document.getElementById('drill-btn-again').onclick = () => startDrill();
  document.getElementById('drill-btn-home').onclick = () => { initSansuHome(); showScreen('sansu-home'); };
}

