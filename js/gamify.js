// ============================================================
// ゲーミフィケーション（達成率・称号・ログインボーナス・アイテム）
// ============================================================

// 教科→カテゴリ→問題数（データは静的なのでハードコード。問題追加時はここを更新）
const QUESTION_COUNTS = {
  kokugo: { kotowaza: 473, kanyoku: 536, yojijukugo: 529, gairaigo: 587, kanji_kaki: 480, kanji_yomi: 480,
            kokugo_keigo: 232, kokugo_goi: 447, kokugo_bushu: 389, kokugo_bungaku: 359,
            // 文のしくみ＝浜学園 小3国語 本科教材（原簿 HG-2515/2521/2523/2525）。data/kokugo_bun.json
            kokugo_bun: 201,
            // 和語＝浜学園 小5最レ国語の演習プリントII（原簿 HG-2546/2550/2557）。data/kokugo_wago.json
            // 78語 × 2通り（意味→語／語→意味）＝156問。★grade は全部5（実物が小5の教材）
            kokugo_wago: 156,
            // じゅくナビ国語＝小3本科教材の大問4（原簿 HG-2501〜2543）。data/hama_kokugo.json。
            // ★kanji_kaki に相乗りさせない。480問の分母に混ぜると、本物の書き取りを1問も
            //   解かないまま達成率が9割近くまで上がってしまう。
            // ⚠ scripts/sync_question_counts.js の MAP には足さないこと（入れ子JSONで落ちる）
            // ⚠2026-08-08：418 は小3ぶんだけの数で、小4の404問が分母に入っていなかった
            //   （＝小4をやっても達成率が上がらない）。実データに合わせて直した。
            //   内わけ＝小3 418 ＋ 小4 404 ＋ 小5最レ国語 185。入れ子JSONなので sync では数えられず手で直す
            hama_kokugo: 1007,
            // こころの探偵・要約記者。★以前はここに登録が無く、IDの先頭2文字が偶然
            //   kanji_yomi(ky001…)・rika:kitai(kt001…)と同じ"ky"/"kt"だったせいで、
            //   その2カテゴリの達成率に誤って積み上がっていた（2026-08-02に発覚・修正）
            tantei: 123, youyaku: 128 },                                                     // 6,127
  sansu:  { bakuhatsu: 160, keisan: 1284, bun: 779, zu: 1040, kisoku: 988, tokusan: 557, baai: 556, kazu: 597,
            wariai: 418, hayasa: 170, rittai: 375 },                                         // 6,764（2026-07-31 比例・反比例40問）
  rika:   { shokubutsu: 987, doubutsu: 1021, jintai: 250, sora: 781, tenki: 490, mono: 874, kitai: 298,
            daichi: 490, suiyoueki: 507, denki: 518, chikara: 594, hikari_oto: 308 },        // 7,118（2026-07-28 小4理科の全42回を30問以上に）
  shakai: { kokudo: 640, sangyo: 649, rekishi: 640, komin: 645 },                            // 2,574
};
const SUBJECT_LABELS = { kokugo: '国語', sansu: '算数', rika: '理科', shakai: '社会' };
// 称号判定は灘中3教科（社会は表示のみ）
const TITLE_SUBJECTS = ['kokugo', 'sansu', 'rika'];

// 旧形式の素ID→カテゴリ振り分け表（衝突プレフィックスは複数カテゴリに寛大加算）
const ID_PREFIX_MAP = {
  k: ['kokugo:kotowaza'], y: ['kokugo:kanyoku'], j: ['kokugo:yojijukugo'], g: ['kokugo:gairaigo'],
  kk: ['kokugo:kanji_kaki'], ky: ['kokugo:kanji_yomi'], kg: ['kokugo:kokugo_keigo'],
  gi: ['kokugo:kokugo_goi'], bs: ['kokugo:kokugo_bushu'], bg: ['kokugo:kokugo_bungaku'],
  hk: ['kokugo:hama_kokugo'],   // じゅくナビ国語（hk3_04_01 …）。hd＝大問／ho＝光と音 とは別
  kb: ['kokugo:kokugo_bun'],    // 文のしくみ（kb001 …）
  wg: ['kokugo:kokugo_wago'],   // 和語（wg001 …）
  // ★こころの探偵(kt1_01_1…)・要約記者(ky1_01_1…)は、素の先頭文字だけで見ると
  //   rika:kitai（kt001…）・kanji_yomi（ky001…）と同じ "kt"/"ky" になってしまう。
  //   「英字＋数字のすぐ後に _ が続く」ものだけ別ものと見なす（extractIdPrefix）ので、
  //   ここは "_" ありの形（kt1_・ky1_ …）だけを登録する（2026-08-02・達成率の誤加算を修正）
  kt1_: ['kokugo:tantei'], kt2_: ['kokugo:tantei'], kt3_: ['kokugo:tantei'],
  kt4_: ['kokugo:tantei'], kt5_: ['kokugo:tantei'], kt6_: ['kokugo:tantei'],
  ky1_: ['kokugo:youyaku'], ky2_: ['kokugo:youyaku'], ky3_: ['kokugo:youyaku'],
  ky4_: ['kokugo:youyaku'], ky5_: ['kokugo:youyaku'], ky6_: ['kokugo:youyaku'],

  sk: ['sansu:keisan', 'shakai:kokudo'],
  sr: ['sansu:kisoku', 'sansu:rittai', 'shakai:rekishi'],
  rd: ['rika:doubutsu', 'rika:denki'],
  sb: ['sansu:bun'], sz: ['sansu:zu'], st: ['sansu:tokusan'], sc: ['sansu:baai'],
  sn: ['sansu:kazu'], sw: ['sansu:wariai'], sh: ['sansu:hayasa'],
  rp: ['rika:shokubutsu'], rk: ['rika:sora'], rg: ['rika:daichi'], rm: ['rika:mono'],
  rs: ['rika:suiyoueki'], rc: ['rika:chikara'], ho: ['rika:hikari_oto'],
  tk: ['rika:tenki'], kt: ['rika:kitai'], jt: ['rika:jintai'],
  ss: ['shakai:sangyo'], sm: ['shakai:komin'],
};

const TITLES = [
  { name: '普通の小学生', pct: 0,  icon: '🎒' },
  { name: '優等生',       pct: 1,  icon: '📝' },
  { name: 'Hクラス',      pct: 3,  icon: '📗' },
  { name: 'SHHクラス',    pct: 5,  icon: '📔' },
  { name: 'SHSクラス',    pct: 7,  icon: '📒' },
  { name: 'Sクラス',      pct: 9,  icon: '📘' },
  { name: 'VSSクラス',    pct: 12, icon: '📓' },
  { name: 'VSVクラス',    pct: 15, icon: '🔖' },
  { name: '最レ受講生',   pct: 18, icon: '📙' },
  { name: 'V2クラス',     pct: 23, icon: '📕' },
  { name: 'V1クラス',     pct: 28, icon: '🏵️' },
  { name: '100傑',        pct: 35, icon: '🥉' },
  { name: '灘合2組',      pct: 45, icon: '🥈' },
  { name: '灘合1組',      pct: 55, icon: '🏆' },
  { name: '10傑',         pct: 72, icon: '🥇' },
  { name: 'スーパーウルトラ神ゴッド', pct: 95, icon: '👑' },
];

const ITEM_DEFS = {
  bomb:   { icon: '💣', label: 'ボム',     desc: 'テトリス：下2行を消す' },
  slow:   { icon: '🐢', label: 'スロー',   desc: 'テトリス：15秒ゆっくり' },
  search: { icon: '🔍', label: 'サーチ',   desc: 'スイーパー：安全なマスを1つ開く' },
  shield: { icon: '🛡', label: 'おまもり', desc: 'スイーパー：ゴキブリを1回セーフ' },
  wing:   { icon: '🪽', label: 'つばさ',   desc: 'チッチジャンプ：6秒ミス無効で浮く' },
  rocket: { icon: '🚀', label: 'ロケット', desc: 'チッチジャンプ：一気に高くジャンプ' },
};

// IDから、旧素ID→カテゴリの振り分けに使うプレフィックスを取り出す。
// 「英字＋数字のすぐあとに _ が続く」形（kt1_01_1 など）を優先して見る。
//   これが無ければ「英字だけ」（kt001 のような素の連番ID）にフォールバックする。
// ★これが無いと、こころの探偵(kt1_…)がrika:kitai(kt001…)に、要約記者(ky1_…)が
//   kanji_yomi(ky001…)に化ける（どちらも先頭2文字が同じ "kt"/"ky" なだけの別物）
function extractIdPrefix(id) {
  const withUnderscore = id.match(/^[a-zA-Z]+[0-9]+_/);
  if (withUnderscore && ID_PREFIX_MAP[withUnderscore[0]]) return withUnderscore[0];
  const lettersOnly = id.match(/^[a-zA-Z]+/);
  return lettersOnly ? lettersOnly[0] : null;
}

// ── 達成率の集計（一度でも正解した問題＝クリア） ──────────
function buildClearedSets() {
  const sets = {};
  for (const [s, cats] of Object.entries(QUESTION_COUNTS)) {
    for (const c of Object.keys(cats)) sets[`${s}:${c}`] = new Set();
  }
  const prog = getProgress();
  for (const [key, p] of Object.entries(prog)) {
    if (!p || !p.correct) continue;
    const ci = key.indexOf(':');
    if (ci > 0) {
      // 新形式 subject_cat:id
      const head = key.slice(0, ci);
      const ui = head.indexOf('_');
      if (ui < 0) continue;
      const subj = head.slice(0, ui);
      const bucket = `${subj}:${head.slice(ui + 1)}`;
      if (sets[bucket]) { sets[bucket].add(key.slice(ci + 1)); continue; }
      // カテゴリが取れていない記録（sansu_null: など）をIDの頭文字から救う。
      // 2026-07-26 以前に「単元でえらぶ」「じゅくナビ」で解いた分がこれに当たる
      const id = key.slice(ci + 1);
      const pm = extractIdPrefix(id);
      if (!pm) continue;
      (ID_PREFIX_MAP[pm] || [])
        .filter(b => b.startsWith(subj + ':'))
        .forEach(b => { if (sets[b]) sets[b].add(id); });
    } else {
      // 旧素ID：プレフィックスで振り分け（Setなので新キーと重複しても二重計上されない）
      const m = extractIdPrefix(key);
      if (!m) continue;
      const targets = ID_PREFIX_MAP[m];
      if (targets) targets.forEach(b => { if (sets[b]) sets[b].add(key); });
    }
  }
  return sets;
}

function getAchievement() {
  const sets = buildClearedSets();
  const subjects = {};
  let titleCleared = 0, titleCount = 0;
  for (const [s, cats] of Object.entries(QUESTION_COUNTS)) {
    let sc = 0, st = 0;
    const catInfo = {};
    for (const [c, n] of Object.entries(cats)) {
      const cleared = Math.min(sets[`${s}:${c}`].size, n);
      catInfo[c] = { cleared, count: n, pct: n ? Math.floor((cleared / n) * 100) : 0 };
      sc += cleared; st += n;
    }
    subjects[s] = { cleared: sc, count: st, pct: st ? Math.floor((sc / st) * 100) : 0, cats: catInfo };
    if (TITLE_SUBJECTS.includes(s)) { titleCleared += sc; titleCount += st; }
  }
  const titlePct = titleCount ? (titleCleared / titleCount) * 100 : 0;
  return { titlePct, titleCleared, titleCount, subjects };
}

function getTitleInfo(titlePct) {
  let idx = 0;
  for (let i = TITLES.length - 1; i >= 0; i--) {
    if (titlePct >= TITLES[i].pct) { idx = i; break; }
  }
  const next = TITLES[idx + 1] || null;
  return { idx, name: TITLES[idx].name, icon: TITLES[idx].icon,
           next: next ? next.name : null, nextPct: next ? next.pct : null };
}

// ── 日付・プレイ時間 ──────────────────────────────────────
function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPlayTimeData() {
  return JSON.parse(localStorage.getItem('playTime') || '{"total":0,"byDate":{}}');
}
function addPlayTime(sec) {
  sec = Math.min(Math.max(0, Math.round(sec)), 3600); // 放置ガード
  if (!sec) return;
  const pt = getPlayTimeData();
  pt.total += sec;
  const t = todayStr();
  pt.byDate[t] = (pt.byDate[t] || 0) + sec;
  const keys = Object.keys(pt.byDate).sort();
  while (keys.length > 30) delete pt.byDate[keys.shift()]; // 直近30日のみ保持
  localStorage.setItem('playTime', JSON.stringify(pt));
}
function getPlayTime() {
  const pt = getPlayTimeData();
  return { total: pt.total || 0, today: pt.byDate[todayStr()] || 0 };
}
function formatMinutes(sec) {
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分`;
  return `${Math.floor(min / 60)}時間${min % 60}分`;
}

// プレイ時間の計測（勉強画面に入ったら開始、出たら加算。テトリスは含めない）
const PLAY_SCREENS = ['quiz', 'fill', 'kanji', 'sansu-quiz', 'drill'];
let playStart = null;
let currentScreenId = '';
function flushPlayTime() {
  if (playStart) { addPlayTime((Date.now() - playStart) / 1000); playStart = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { flushPlayTime(); backupLocalData(); }
  else if (PLAY_SCREENS.includes(currentScreenId) && !playStart) playStart = Date.now();
});
window.addEventListener('pagehide', () => { flushPlayTime(); backupLocalData(); });

// ── アイテム ──────────────────────────────────────────────
function getItems() {
  return JSON.parse(localStorage.getItem('items') || '{"bomb":0,"slow":0,"search":0,"shield":0,"wing":0,"rocket":0}');
}
function addItem(kind, n) {
  const items = getItems();
  items[kind] = Math.max(0, Math.min(99, (items[kind] || 0) + n));
  localStorage.setItem('items', JSON.stringify(items));
  return items[kind];
}
function randomItemKind() {
  const kinds = Object.keys(ITEM_DEFS);
  return kinds[Math.floor(Math.random() * kinds.length)];
}

// ── コイン（ガチャ用） ────────────────────────────────────
function getCoins() {
  return Math.max(0, Math.min(9999, Number(localStorage.getItem('coins') || 0)));
}
function addCoins(n) {
  const v = Math.max(0, Math.min(9999, getCoins() + n));
  localStorage.setItem('coins', String(v));
  return v;
}
// 1日にもらえるコインの上限。100枚だと新しい問題34問で埋まってしまい、
// そこから先はどれだけ解いても増えなかったので、頑張ったぶんが返るよう倍にした。
// （1問あたりの上限 COIN_PER_Q_CAP は据え置き＝同じ問題の繰り返しでは稼げない）
const COIN_DAILY_CAP = 200;
const COIN_PER_Q_CAP = 2;
function getCoinDaily() {
  const d = JSON.parse(localStorage.getItem('coinDaily') || 'null');
  if (!d || d.date !== todayStr()) return { date: todayStr(), earned: 0, perQ: {}, cappedNotified: false };
  return d;
}
function saveCoinDaily(d) { localStorage.setItem('coinDaily', JSON.stringify(d)); }

let coinSessionEarned = 0;

// 正解のたびにrecordResultから呼ばれる。同一問題1日2枚まで・初正解+2ボーナス・1日上限100枚
function awardCoinForAnswer(id, isFirst) {
  const d = getCoinDaily();
  const used = d.perQ[id] || 0;
  if (used >= COIN_PER_Q_CAP || d.earned >= COIN_DAILY_CAP) { saveCoinDaily(d); return; }
  const gain = Math.min(1 + (isFirst ? 2 : 0), COIN_DAILY_CAP - d.earned);
  d.perQ[id] = used + 1;
  d.earned += gain;
  addCoins(gain);
  coinSessionEarned += gain;
  if (d.earned >= COIN_DAILY_CAP && !d.cappedNotified) {
    d.cappedNotified = true;
    showToast('🪙 今日はもう満タンや！また明日な！');
  }
  saveCoinDaily(d);
}

// セッション終了時（満点+10）。maybeAwardPerfectの直後に呼ぶ
function awardSessionCoins(pct, totalQ) {
  if (pct >= 100 && totalQ >= 5) { addCoins(10); coinSessionEarned += 10; }
  const banner = document.getElementById('result-coin-banner');
  if (banner) {
    if (coinSessionEarned > 0) {
      banner.textContent = `🪙 このセッションで${coinSessionEarned}まいゲット！（いま${getCoins()}まい）`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
  coinSessionEarned = 0;
}

// ── 息抜きゲームの遊び券（勉強しないと遊べないようにする） ──
function getGameTickets() {
  return Math.max(0, Math.min(99, Number(localStorage.getItem('gameTickets') || 0)));
}
function addGameTickets(n) {
  const v = Math.max(0, Math.min(99, getGameTickets() + n));
  localStorage.setItem('gameTickets', String(v));
  updateGameTicketBadge();
  return v;
}
function updateGameTicketBadge() {
  const el = document.getElementById('game-ticket-badge');
  if (el) el.textContent = `🎟 ${getGameTickets()}枚`;
}

const TICKET_DAILY_CAP = 8;
function getTicketDaily() {
  const d = JSON.parse(localStorage.getItem('ticketDaily') || 'null');
  if (!d || d.date !== todayStr()) return { date: todayStr(), earned: 0 };
  return d;
}
function saveTicketDaily(d) { localStorage.setItem('ticketDaily', JSON.stringify(d)); }

// セッション終了時（5問以上で1枚、1日8枚まで）に呼ぶ
function awardSessionTicket(totalQ) {
  if (totalQ < 5) return;
  const d = getTicketDaily();
  if (d.earned >= TICKET_DAILY_CAP) return;
  d.earned += 1;
  saveTicketDaily(d);
  addGameTickets(1);
  showToast(`🎟 遊び券を1まいゲット！（のこり${getGameTickets()}まい）`, 2500);
}

// 券を持っているか確認だけする（消費しない）。入口のガードに使う
function hasGameTicket() {
  if (getGameTickets() <= 0) {
    showToast('🎟 遊び券が足りないよ！問題を解いてゲットしよう！', 2500);
    return false;
  }
  return true;
}

// 1プレイ開始ごとに1枚消費する（リスタート・難易度変更での再スタートも1プレイ）
function spendGameTicket() {
  if (!hasGameTicket()) return false;
  addGameTickets(-1);
  showToast(`🎟 遊び券を1まい使ったよ（のこり${getGameTickets()}まい）`, 1800);
  return true;
}

// ── 汎用演出モーダル（連続表示はキューで順番に） ──────────
const gamiQueue = [];
function showGamiModal(data) {
  const modal = document.getElementById('gami-modal');
  if (!modal.classList.contains('hidden')) { gamiQueue.push(data); return; }
  document.getElementById('gami-emoji').textContent = data.emoji || '🎉';
  document.getElementById('gami-title').textContent = data.title || '';
  const body = document.getElementById('gami-lines');
  body.innerHTML = '';
  (data.lines || []).forEach(l => {
    const p = document.createElement('p');
    p.textContent = l;
    body.appendChild(p);
  });
  modal.classList.remove('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gami-close').onclick = () => {
    document.getElementById('gami-modal').classList.add('hidden');
    if (gamiQueue.length) setTimeout(() => showGamiModal(gamiQueue.shift()), 150);
  };
});

// ── ログインボーナス（initSubjectから毎回呼ばれても冪等） ──
function getLoginInfo() {
  return JSON.parse(localStorage.getItem('loginBonus') || 'null') || { lastDate: '', streak: 0, best: 0 };
}
function checkLoginBonus() {
  const today = todayStr();
  const lb = getLoginInfo();
  if (lb.lastDate === today) return;
  const yesterday = todayStr(new Date(Date.now() - 86400000));
  lb.streak = lb.lastDate === yesterday ? lb.streak + 1 : 1;
  lb.best = Math.max(lb.best || 0, lb.streak);
  lb.lastDate = today;
  localStorage.setItem('loginBonus', JSON.stringify(lb));

  // 個数：通常1、3日連続=2、7の倍数=3、30日=5
  let n = 1, note = '今日もようきたな！';
  if (lb.streak === 30) { n = 5; note = '30日連続！ほんまにえらいで！'; }
  else if (lb.streak >= 7 && lb.streak % 7 === 0) { n = 3; note = `${lb.streak}日連続はすごいで！`; }
  else if (lb.streak === 3) { n = 2; note = '3日連続ボーナスや！'; }
  const got = [];
  for (let i = 0; i < n; i++) {
    const kind = randomItemKind();
    addItem(kind, 1);
    got.push(ITEM_DEFS[kind].icon);
  }
  addCoins(10);
  showGamiModal({
    emoji: '🔥',
    title: lb.streak >= 2 ? `${lb.streak}日連続ログイン！` : 'ログインボーナス！',
    lines: [note, `お助けアイテム ${got.join(' ')} をゲット！`, '🪙10まいもらった！', 'テトリスで使えるで！'],
  });
}

// ── 問題追加の検知（総問題数が増えたらトースト） ──────────
function checkNewQuestions() {
  const total = Object.values(QUESTION_COUNTS)
    .reduce((a, cats) => a + Object.values(cats).reduce((x, y) => x + y, 0), 0);
  const seen = Number(localStorage.getItem('qTotalSeen') || 0);
  if (seen && total > seen) {
    showToast(`🎉 新しい問題が${(total - seen).toLocaleString()}問追加されたで！`, 3500);
  }
  if (total !== seen) localStorage.setItem('qTotalSeen', String(total));
}

// ── 称号昇格チェック ──────────────────────────────────────
function checkTitlePromotion() {
  const a = getAchievement();
  const info = getTitleInfo(a.titlePct);
  const seen = Number(localStorage.getItem('titleRank') || 0);
  if (info.idx > seen) {
    localStorage.setItem('titleRank', String(info.idx));
    showGamiModal({
      emoji: info.icon,
      title: '称号アップ！',
      lines: [`きみは今日から『${info.name}』や！`, 'この調子で全問制覇を目指そう！'],
    });
  } else if (info.idx < seen) {
    localStorage.setItem('titleRank', String(info.idx));
  }
  return info;
}

// ── 100点報酬（5問以上のセッションのみ） ──────────────────
function maybeAwardPerfect(pct, totalQ) {
  const banner = document.getElementById('result-item-banner');
  if (banner) banner.classList.add('hidden');
  if (pct < 100 || totalQ < 5) return;
  const kind = randomItemKind();
  addItem(kind, 1);
  if (banner) {
    banner.textContent = `${ITEM_DEFS[kind].icon} 満点ボーナス！テトリスで使える「${ITEM_DEFS[kind].label}」をゲット！`;
    banner.classList.remove('hidden');
  }
}

// 達成率をFirestoreランキングへ（オフライン時はfirebase.js側でスキップ）
// ★必ず backupLocalData を先に。達成率を先に保存すると、backupLocalData の安全装置が
//   「自分がさっき下げた達成率」と比べることになり、判定が自壊する
//   （2026-08-04・これで94問ぶんの記録が15問ぶんに上書きされた）。
//   安全装置が見送ったときは、達成率も送らない＝クラウドの値を下げない。
async function pushAchievementToRanking() {
  if (!state.nickname || typeof saveAchievement !== 'function') return;
  // ★成績の中身（progress）も一緒に上げる。
  //   達成率だけは解き終わるたびに送られるのに、progress は「アプリを閉じたとき」しか
  //   送っていなかったため、管理ツールで「％は増えているのに解いた形跡が見えない」状態になっていた。
  //   （2026-07-26・本人が「れっぴ」の記録で発見）
  try {
    const skipped = await backupLocalData();
    if (skipped) {
      console.warn('達成率の保存も見送り（クラウドを守るため）:', skipped);
      return;
    }
    const a = getAchievement();
    const t = getTitleInfo(a.titlePct);
    saveAchievement(state.nickname, Math.round(a.titlePct * 10) / 10, a.titleCleared, t.idx);
  } catch (e) {
    console.warn('達成率の保存に失敗:', e && e.message);
  }
}

// ── テトリスお助けアイテム ────────────────────────────────
function updateItemButtons() {
  const items = getItems();
  document.querySelectorAll('.t-item-btn').forEach(btn => {
    const kind = btn.dataset.item;
    const n = items[kind] || 0;
    const b = btn.querySelector('b');
    if (b) b.textContent = n;
    btn.disabled = n <= 0;
  });
}

function tUseItem(kind) {
  if (tetris.over || tetris.paused) return;
  const items = getItems();
  if ((items[kind] || 0) <= 0) return;

  if (kind === 'bomb') {
    const bottom = tetris.board.slice(T_ROWS - 2);
    if (bottom.every(row => row.every(v => !v))) { showToast('下がカラやから今は使えへんで！'); return; }
    tetris.board.splice(T_ROWS - 2, 2);
    tetris.board.unshift(Array(T_COLS).fill(null), Array(T_COLS).fill(null));
    tSfx('clear1');
    tCharsCheer(1);
  } else if (kind === 'slow') {
    if (performance.now() < (tetris.slowUntil || 0)) { showToast('スローはもう効いてるで！'); return; }
    tetris.slowUntil = performance.now() + 15000;
    const btn = document.querySelector('.t-item-btn[data-item="slow"]');
    if (btn) {
      btn.classList.add('item-active');
      setTimeout(() => btn.classList.remove('item-active'), 15000);
    }
    tSfx('rotate');
  }
  addItem(kind, -1);
  updateItemButtons();
  drawTetris();
}

// ── ミックス出題（算数・理科・社会） ──────────────────────
SANSU_CAT_LABELS.mix = 'ミックス';
RIKA_CAT_LABELS.mix = 'ミックス';
SHAKAI_CAT_LABELS.mix = 'ミックス';

async function loadMixQuestions(grade, diff) {
  const fileMap = subjectFiles(sansuState.subject);
  const cats = Object.keys(fileMap);
  const lists = await Promise.all(cats.map(c => loadSansuQuestions(c, grade, diff).catch(() => [])));
  const all = [];
  lists.forEach((qs, i) => qs.forEach(q => all.push({ ...q, _cat: cats[i] })));
  return all;
}

// ── 終了バッジ（単元✅・学年👑） ──────────────────────────
function setClearBadge(btn, on, icon) {
  let b = btn.querySelector('.clear-badge');
  if (on) {
    if (!b) { b = document.createElement('span'); b.className = 'clear-badge'; btn.appendChild(b); }
    b.textContent = icon;
  } else if (b) {
    b.remove();
  }
}

function renderCatBadges(subject) {
  const sets = buildClearedSets();
  const counts = QUESTION_COUNTS[subject];
  const conf = {
    kokugo: ['#screen-home .cat-card', 'cat'],
    sansu:  ['#screen-sansu-home .sansu-cat-btn', 'scat'],
    rika:   ['.rika-cat-btn', 'rcat'],
    shakai: ['.shakai-cat-btn', 'hcat'],
  }[subject];
  document.querySelectorAll(conf[0]).forEach(btn => {
    const cat = btn.dataset[conf[1]];
    if (!cat || cat === 'mix' || !counts[cat]) { setClearBadge(btn, false); return; }
    const set = sets[`${subject}:${cat}`];
    setClearBadge(btn, !!set && set.size >= counts[cat], '✅');
  });
}

// 学年👑：その学年の全問題（教科内全カテゴリ）をコンプしたら表示
async function renderGradeCrowns(subject) {
  try {
    const sets = buildClearedSets();
    const byGrade = {};
    if (subject === 'kokugo') {
      // 国語は全カテゴリの学年別集計
      for (const cat of Object.keys(CATEGORIES)) {
        const qs = await loadQuestions(cat);
        const set = sets[`kokugo:${cat}`];
        qs.forEach(q => {
          if (!q.grade) return;
          if (!byGrade[q.grade]) byGrade[q.grade] = { total: 0, cleared: 0 };
          byGrade[q.grade].total++;
          if (set && set.has(q.id)) byGrade[q.grade].cleared++;
        });
      }
    } else {
      const fileMap = subjectFiles(subject);
      for (const [cat, file] of Object.entries(fileMap)) {
        const key = `${subject}-${cat}`;
        if (!sansuCache[key]) {
          const res = await fetch(file);
          sansuCache[key] = await res.json();
        }
        const set = sets[`${subject}:${cat}`];
        sansuCache[key].forEach(q => {
          if (!q.grade) return;
          if (!byGrade[q.grade]) byGrade[q.grade] = { total: 0, cleared: 0 };
          byGrade[q.grade].total++;
          if (set && set.has(q.id)) byGrade[q.grade].cleared++;
        });
      }
    }
    const btnSel = {
      kokugo: '.kokugo-grade-btn',
      sansu:  '#screen-sansu-home .grade-btn',
      rika:   '.rika-grade-btn',
      shakai: '.shakai-grade-btn',
    }[subject];
    document.querySelectorAll(btnSel).forEach(btn => {
      const g = Number(btn.dataset.grade);
      const info = byGrade[g];
      setClearBadge(btn, !!(info && info.total > 0 && info.cleared >= info.total), '👑');
    });
  } catch (e) { /* バッジは飾りなので失敗しても無視 */ }
}

// 難易度ボタン用: 全問クリアで✅、途中なら「12/20」の進み具合を表示
function setDiffProgress(btn, cleared, total) {
  let b = btn.querySelector('.clear-badge');
  // 問題が1問も無いときだけバッジを出さない。
  // 正解0でも「0/問題数」を出す（何問あるかを先に知りたい・本人要望 2026-07-26）
  if (!(total > 0)) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('span'); b.className = 'clear-badge'; btn.appendChild(b); }
  if (cleared >= total) {
    b.textContent = '✅';
    b.classList.remove('diff-prog');
  } else {
    b.textContent = `${cleared}/${total}`;
    b.classList.add('diff-prog');
  }
}

// ── 難易度ボタンの✅（選択中の学年×単元で全問クリア） ──────
async function ensureSansuFile(subject, cat) {
  const key = `${subject}-${cat}`;
  if (!sansuCache[key]) {
    const fileMap = subjectFiles(subject);
    const res = await fetch(fileMap[cat]);
    sansuCache[key] = await res.json();
  }
  return sansuCache[key];
}

async function renderDiffBadgesSansu() {
  const subject = sansuState.subject;
  const btnSel = {
    sansu: '#screen-sansu-home .diff-btn',
    rika: '.rika-diff-btn',
    shakai: '.shakai-diff-btn',
  }[subject];
  const btns = document.querySelectorAll(btnSel);
  btns.forEach(b => setClearBadge(b, false));
  const cat = sansuState.cat, grade = sansuState.grade;
  // 単元でえらぶ入り口では cat が null になる。grade と unit のどちらかがあれば数えられる
  const unitSel = sansuState.unit || null;
  if (!grade || (!cat && !unitSel)) return;
  try {
    const sets = buildClearedSets();
    const byDiff = {};
    // 出題プールと同じ数え方にする。d1 には1つ下の学年の d4 も入るので、そのぶんも足す
    const bump = (d, q, set) => {
      if (!byDiff[d]) byDiff[d] = { total: 0, cleared: 0 };
      byDiff[d].total++;
      if (set && set.has(q.id)) byDiff[d].cleared++;
    };
    const tally = (q, set) => {
      if (unitSel && UNIT_TO_GROUP[q.unit] !== unitSel) return;
      if (q.grade === grade) bump(q.difficulty, q, set);
      // 1つ下の学年の d4 は、この学年の d1 として出題される
      else if (q.grade === grade - 1 && q.difficulty === 4 && grade > 1) bump(1, q, set);
    };
    // 単元グループでしぼっているときは全カテゴリから数える
    const cats = unitSel && UNIT_GROUPS[unitSel]
      ? Object.keys(SANSU_FILES).filter(k => k !== 'mix')
      : cat === 'mix'
        ? Object.keys(subjectFiles(subject))
        : [cat];
    for (const c of cats) {
      const qs = await ensureSansuFile(subject, c);
      const set = sets[`${subject}:${c}`];
      qs.forEach(q => tally(q, set));
    }
    // 非同期の間に選択が変わっていたら破棄
    if (sansuState.cat !== cat || sansuState.grade !== grade || sansuState.subject !== subject
        || (sansuState.unit || null) !== unitSel) return;
    btns.forEach(b => {
      const info = byDiff[Number(b.dataset.diff)] || { total: 0, cleared: 0 };
      setDiffProgress(b, info.cleared, info.total);
    });
    // 難易度5（連鎖問題）は問題が無ければロック
    const zoneId = { sansu: 'sansu-start-zone', rika: 'rika-start-zone', shakai: 'shakai-start-zone' }[subject];
    // 単元モードでは cat が無いので、その単元が実際にあったカテゴリだけを連鎖の対象にする
    await updateChainDiffButton(btns, subject, unitSel ? cats : cat, grade, () => {
      sansuState.diff = null;
      if (zoneId) document.getElementById(zoneId).classList.add('hidden');
    }, unitSel);
  } catch (e) { /* バッジは飾りなので失敗しても無視 */ }
}

async function renderDiffBadgesKokugo() {
  const btns = document.querySelectorAll('.kokugo-diff-btn');
  btns.forEach(b => setClearBadge(b, false));
  const cat = state.selectedCat;
  if (!cat || !CATEGORIES[cat]) return;
  const isKanji = KANJI_CATS.includes(cat);
  const grade = state.grade;
  if (!grade) return;
  try {
    const qs = await loadQuestions(cat);
    if (state.selectedCat !== cat || state.grade !== grade) return;
    const sets = buildClearedSets();
    const set = sets[`kokugo:${cat}`];
    const byDiff = {};
    let total = 0, cleared = 0;
    qs.forEach(q => {
      if (q.id && q.id[0] === 'c') return;              // カスタム問題は対象外
      if (q.grade !== grade) return;
      const ok = !!(set && set.has(q.id));
      total++; if (ok) cleared++;
      const d = q.difficulty;
      if (!d) return;
      if (!byDiff[d]) byDiff[d] = { total: 0, cleared: 0 };
      byDiff[d].total++;
      if (ok) byDiff[d].cleared++;
    });
    btns.forEach(b => {
      if (b.dataset.diff === 'all') {
        setDiffProgress(b, cleared, total);
      } else {
        const info = byDiff[Number(b.dataset.diff)] || { total: 0, cleared: 0 };
        setDiffProgress(b, info.cleared, info.total);
      }
    });
    // 難易度5（連鎖問題）は問題が無ければロック
    await updateChainDiffButton(btns, 'kokugo', cat, grade, () => {
      state.selectedDiff = null;
      document.getElementById('start-zone').classList.add('hidden');
    });
  } catch (e) { /* 無視 */ }
}

// ── がんばりの記録画面 ────────────────────────────────────
// CATEGORIES に入れられないカテゴリの名前（じゅくナビ国語＝入れ子JSONなので loadQuestions に渡せない）
const KOKUGO_EXTRA_CAT_LABELS = { hama_kokugo: 'じゅくナビ漢字（小3本科）' };
function gamiCatLabel(subject, cat) {
  if (subject === 'kokugo') return (CATEGORIES[cat] || {}).label || KOKUGO_EXTRA_CAT_LABELS[cat] || cat;
  const map = subjectLabels(subject);
  return map[cat] || cat;
}

function initRecord() {
  const a = getAchievement();
  const info = checkTitlePromotion();

  // 称号ヒーロー
  document.getElementById('record-title-icon').textContent = info.icon;
  document.getElementById('record-title-name').textContent = info.name;
  document.getElementById('record-nickname').textContent = state.nickname ? `${state.nickname} さん` : '';

  // 達成率
  document.getElementById('record-total-pct').textContent = Math.floor(a.titlePct * 10) / 10;
  document.getElementById('record-total-bar').style.width = Math.min(100, a.titlePct) + '%';
  document.getElementById('record-cleared').textContent =
    `クリアした問題：${a.titleCleared.toLocaleString()} / ${a.titleCount.toLocaleString()}問（一度でも正解した問題）`;
  const nextEl = document.getElementById('record-next');
  if (info.next) {
    const remain = Math.max(1, Math.ceil((info.nextPct / 100) * a.titleCount) - a.titleCleared);
    nextEl.textContent = `次の称号『${info.next}』まで あと${remain.toLocaleString()}問！`;
  } else {
    nextEl.textContent = '最高称号を制覇！でんせつの小学生や！';
  }

  // 教科別（タップで単元内訳を開閉）
  const subjEl = document.getElementById('record-subjects');
  subjEl.innerHTML = '';
  for (const [s, data] of Object.entries(a.subjects)) {
    const wrap = document.createElement('div');
    wrap.className = 'record-subject';

    const head = document.createElement('div');
    head.className = 'record-subj-head';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${SUBJECT_LABELS[s]}${TITLE_SUBJECTS.includes(s) ? '' : '（称号判定外）'}`;
    const numSpan = document.createElement('span');
    numSpan.className = 'rs-num';
    numSpan.textContent = `${data.cleared.toLocaleString()}/${data.count.toLocaleString()}（${data.pct}%）▾`;
    head.appendChild(nameSpan); head.appendChild(numSpan);

    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = data.pct + '%';
    track.appendChild(fill);

    const catsDiv = document.createElement('div');
    catsDiv.className = 'record-cats hidden';
    for (const [c, ci] of Object.entries(data.cats)) {
      const row = document.createElement('div');
      row.className = 'record-cat-row';
      row.innerHTML = `<span class="rc-name"></span><div class="bar-track"><div class="bar-fill"></div></div><span class="rc-num"></span>`;
      row.querySelector('.rc-name').textContent = gamiCatLabel(s, c);
      row.querySelector('.bar-fill').style.width = ci.pct + '%';
      row.querySelector('.rc-num').textContent = `${ci.cleared}/${ci.count}${ci.cleared >= ci.count ? ' ✅' : ''}`;
      catsDiv.appendChild(row);
    }

    wrap.onclick = () => catsDiv.classList.toggle('hidden');
    wrap.appendChild(head); wrap.appendChild(track); wrap.appendChild(catsDiv);
    subjEl.appendChild(wrap);
  }

  // 勉強時間
  const pt = getPlayTime();
  document.getElementById('record-time-today').textContent = formatMinutes(pt.today);
  document.getElementById('record-time-total').textContent = formatMinutes(pt.total);

  // 連続ログイン
  const lb = getLoginInfo();
  document.getElementById('record-login').textContent =
    `🔥 ${lb.streak || 0}日連続べんきょう中！（最長 ${lb.best || 0}日）`;

  // アイテム
  const items = getItems();
  const itemsEl = document.getElementById('record-items');
  itemsEl.innerHTML = '';
  for (const [kind, def] of Object.entries(ITEM_DEFS)) {
    const div = document.createElement('div');
    div.className = 'record-item';
    div.innerHTML = `<span class="ri-icon"></span><span class="ri-count"></span><span class="ri-desc"></span>`;
    div.querySelector('.ri-icon').textContent = def.icon;
    div.querySelector('.ri-count').textContent = `${def.label} ×${items[kind] || 0}`;
    div.querySelector('.ri-desc').textContent = def.desc;
    itemsEl.appendChild(div);
  }

  // ランキング（Firestore・非同期）
  const rankEl = document.getElementById('record-ranking');
  rankEl.innerHTML = '<p class="record-rank-empty">読み込み中…</p>';
  pushAchievementToRanking();
  if (typeof getAchievementRanking === 'function') {
    getAchievementRanking().then(renderRecordRanking).catch(() => renderRecordRanking(null));
  } else {
    renderRecordRanking(null);
  }
}

function renderRecordRanking(list) {
  const el = document.getElementById('record-ranking');
  el.innerHTML = '';
  if (!list) {
    el.innerHTML = '<p class="record-rank-empty">オフラインでは見られへんで</p>';
    return;
  }
  if (list.length === 0) {
    el.innerHTML = '<p class="record-rank-empty">まだデータがないで。1回テストしてみよう！</p>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  list.forEach((e, i) => {
    // 称号は保存済みの titleIdx ではなく pct から引き直す。
    // 番号は TITLES を増やすと別の称号を指してしまうため（称号10→16段階のときにズレた）
    const t = getTitleInfo(e.pct || 0);
    const div = document.createElement('div');
    div.className = 'rank-item' + (e.nickname === state.nickname ? ' me' : '');
    const numClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    div.innerHTML = `<div class="rank-num ${numClass}"></div><div class="rank-name"></div><div class="rank-rate"></div>`;
    div.querySelector('.rank-num').textContent = medals[i] || (i + 1);
    div.querySelector('.rank-name').textContent = `${t.icon} ${e.nickname}${e.nickname === state.nickname ? ' ★' : ''}`;
    div.querySelector('.rank-rate').textContent = `${e.pct}%`;
    el.appendChild(div);
  });
}

