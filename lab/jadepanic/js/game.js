// ============================================================
// game.js — 入力・演出・画面まわり・メインループ
//   core.js（しくみ）と renderer.js（描画）をつなぐ層
// ============================================================
'use strict';

const FIXED = 1 / 120;          // しくみの更新はこの刻みで固定
const MAX_STEPS = 5;

const $ = id => document.getElementById(id);

// 結果のランク（子どもに「どれくらいできたか」を一目で返す）
// しきい値は「へたなプレイヤー」を書いて実測した点数から決めた（2026-08-19）
const RANK_TH = {
  survival:   { easy:   [150000, 600000, 2000000, 6000000],
                normal: [250000, 1000000, 4000000, 12000000],
                hard:   [400000, 1500000, 6000000, 18000000] },
  timeattack: { easy:   [40000, 150000, 400000, 800000],
                normal: [60000, 200000, 500000, 1000000],
                hard:   [80000, 250000, 600000, 1200000] },
};
function rankOf(mode, diff, score) {
  const th = (RANK_TH[mode] || RANK_TH.survival)[diff] || RANK_TH.survival.normal;
  if (score >= th[3]) return { L: 'S', cls: 's', msg: 'かんぺき！ 学園のデータを まもりきった' };
  if (score >= th[2]) return { L: 'A', cls: 'a', msg: 'みごと。ジェイドも よろこんでる' };
  if (score >= th[1]) return { L: 'B', cls: 'b', msg: 'いい線いってる。あと一歩！' };
  if (score >= th[0]) return { L: 'C', cls: 'c', msg: 'まずは ビットを ひろってみよう' };
  return { L: 'D', cls: 'c', msg: 'にげるだけでは 点はのびない。とびこもう' };
}
const IS_EMBED = new URLSearchParams(location.search).get('embed') === '1';

// ------------------------------------------------------------
// 設定（端末に覚えさせる）
// ------------------------------------------------------------
const Cfg = {
  name: '', diff: 'normal', mode: 'survival',
  control: 'twin',      // twin | auto
  calm: false,          // 演出ひかえめ
  bgm: true, sfx: true,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('jp_cfg') || '{}');
      Object.assign(this, s);
    } catch (e) {}
  },
  save() {
    try {
      localStorage.setItem('jp_cfg', JSON.stringify({
        name: this.name, diff: this.diff, mode: this.mode,
        control: this.control, calm: this.calm, bgm: this.bgm, sfx: this.sfx,
      }));
    } catch (e) {}
  },
};

// ------------------------------------------------------------
// ランキング（端末内。本体に組みこんだときはクラウドにも送る）
// ------------------------------------------------------------
// 画面の中に「あと少しで抜ける相手」を出す。
// 本家GWでいちばん人を熱くさせている仕掛け（ブリーフィング4章）。
const Rivals = {
  list: [], cur: null, myName: '',

  build(mode, diff, myName, cloud) {
    this.myName = myName || '';
    const seen = {};
    const all = [];
    const push = (n, s) => {
      if (!n || !(s > 0)) return;
      const k = String(n);
      if (seen[k] !== undefined) { if (s > all[seen[k]].s) all[seen[k]].s = s; return; }
      seen[k] = all.length;
      all.push({ n: k, s });
    };
    for (const r of Rank.list(mode, diff)) push(r.n, r.s);
    if (Array.isArray(cloud)) for (const r of cloud) push(r.nickname || r.n, r.value || r.s);
    all.sort((a, b) => a.s - b.s);
    this.list = all;
    this.cur = null;
  },

  // いまのスコアの すぐ上にいる人
  update(score) {
    let t = null;
    for (const r of this.list) { if (r.s > score) { t = r; break; } }
    const passed = this.cur && (!t || t !== this.cur) ? this.cur : null;
    this.cur = t;
    return { target: t, passed };
  },
};

const Rank = {
  key(mode, diff) { return `jp_rank_${mode}_${diff}`; },
  list(mode, diff) {
    try { return JSON.parse(localStorage.getItem(this.key(mode, diff)) || '[]'); }
    catch (e) { return []; }
  },
  best(mode, diff) {
    const l = this.list(mode, diff);
    return l.length ? l[0].s : 0;
  },
  add(mode, diff, name, score) {
    const l = this.list(mode, diff);
    const d = new Date();
    l.push({ n: name || 'ななし', s: score, d: `${d.getMonth() + 1}/${d.getDate()}` });
    l.sort((a, b) => b.s - a.s);
    const cut = l.slice(0, 8);
    try { localStorage.setItem(this.key(mode, diff), JSON.stringify(cut)); } catch (e) {}
    return cut.findIndex(r => r.s === score && r.n === (name || 'ななし'));
  },
};

// ------------------------------------------------------------
// 入力
// ------------------------------------------------------------
const Input = {
  mx: 0, my: 0, ax: 0, ay: 0, fire: false, autoAim: false,
  keys: {},
  mouse: { x: 0, y: 0, down: false, active: false },
  sticks: { l: null, r: null },   // {id, ox, oy, x, y}
  bombWanted: false,

  init() {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'Space') { this.bombWanted = true; e.preventDefault(); }
      if (e.code === 'KeyP' || e.code === 'Escape') Game.togglePause();
      if (e.code === 'Enter' && Game.state === 'title') Game.requestStart();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });

    // --- タッチ（左右のゾーンで2本のスティック）---
    for (const side of ['l', 'r']) {
      const zone = $('zone-' + side);
      zone.addEventListener('pointerdown', e => {
        if (this.sticks[side]) return;
        try { zone.setPointerCapture(e.pointerId); } catch (err) {}
        this.sticks[side] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        this.showStick(side, true);
        e.preventDefault();
      });
      zone.addEventListener('pointermove', e => {
        const s = this.sticks[side];
        if (!s || s.id !== e.pointerId) return;
        s.x = e.clientX; s.y = e.clientY;
        this.showStick(side, true);
      });
      const up = e => {
        const s = this.sticks[side];
        if (!s || s.id !== e.pointerId) return;
        this.sticks[side] = null;
        this.showStick(side, false);
      };
      zone.addEventListener('pointerup', up);
      zone.addEventListener('pointercancel', up);
      zone.addEventListener('lostpointercapture', up);
    }

    // --- マウス（PC）---
    const stage = $('stage');
    stage.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true;
    });
    stage.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      this.mouse.down = true; this.mouse.active = true;
    });
    addEventListener('mouseup', () => { this.mouse.down = false; });

    $('btn-bomb').addEventListener('pointerdown', e => {
      e.preventDefault();
      this.bombWanted = true;
    });
  },

  showStick(side, on) {
    const el = $('stick-' + side);
    if (!on) { el.classList.add('off'); return; }
    const s = this.sticks[side];
    let dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    const MAXR = 58;
    if (d > MAXR) { dx *= MAXR / d; dy *= MAXR / d; }
    el.classList.remove('off');
    el.style.left = s.ox + 'px';
    el.style.top = s.oy + 'px';
    el.querySelector('.knob').style.transform = `translate(${dx}px,${dy}px)`;
  },

  // 毎フレーム、入力をまとめる
  gather() {
    let mx = 0, my = 0, ax = 0, ay = 0, fire = false;

    // キーボード（WASD＝移動／矢印＝ねらう）
    const k = this.keys;
    if (k.KeyA) mx -= 1;
    if (k.KeyD) mx += 1;
    if (k.KeyW) my += 1;
    if (k.KeyS) my -= 1;
    if (k.ArrowLeft) ax -= 1;
    if (k.ArrowRight) ax += 1;
    if (k.ArrowUp) ay += 1;
    if (k.ArrowDown) ay -= 1;

    // タッチのスティック
    const DEAD = 9, MAXR = 58;
    const st = (s) => {
      if (!s) return null;
      let dx = s.x - s.ox, dy = -(s.y - s.oy);
      const d = Math.hypot(dx, dy);
      if (d < DEAD) return null;
      const f = Math.min(1, (d - DEAD) / (MAXR - DEAD)) / d;
      return [dx * f, dy * f];
    };
    const L = st(this.sticks.l), Rr = st(this.sticks.r);
    if (L) { mx = L[0]; my = L[1]; }
    if (Rr) { ax = Rr[0]; ay = Rr[1]; }

    // マウス（PCはカーソルの方をねらう）
    if (!Rr && this.mouse.active && Game.state === 'play') {
      const w = Game.view;
      const wx = (this.mouse.x / innerWidth - 0.5) * w.w;
      const wy = -(this.mouse.y / innerHeight - 0.5) * w.h;
      const dx = wx - G.p.x, dy = wy - G.p.y;
      const d = Math.hypot(dx, dy);
      if (d > 20) { ax = dx / d; ay = dy / d; }
      fire = this.mouse.down;
    }

    // ゲームパッド
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gps) {
      if (!gp) continue;
      const dz = v => Math.abs(v) < 0.20 ? 0 : v;
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
      const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly) { mx = lx; my = -ly; }
      if (rx || ry) { ax = rx; ay = -ry; }
      if (gp.buttons[0] && gp.buttons[0].pressed) fire = true;
      if ((gp.buttons[7] && gp.buttons[7].pressed) || (gp.buttons[5] && gp.buttons[5].pressed)) {
        if (!this._gpBomb) { this.bombWanted = true; this._gpBomb = true; }
      } else this._gpBomb = false;
      break;
    }

    this.mx = mx; this.my = my;
    this.autoAim = Cfg.control === 'auto';
    // かんたん（自動ねらい）のときは、マウスやスティックの向きを入れない。
    //   PCでは マウスが動いたとたん ax/ay が入って、自動ねらいの分岐に
    //   一度も入らなくなっていた（＝「自動照準が効かない」の正体）
    if (this.autoAim) { ax = 0; ay = 0; }
    this.ax = ax; this.ay = ay;
    this.fire = fire;
    return this;
  },
};

// ------------------------------------------------------------
// ゲーム全体
// ------------------------------------------------------------
const Game = {
  state: 'title',        // title | play | pause | over
  view: { w: 1600, h: 900 },      // 画面に写るワールドの広さ
  field: { w: 1500, h: 700 },     // 実際に飛べる広さ（かべが画面内に見えるように内側へ）
  camY: 26,                       // 上のHUDを避けるため 少しだけ上を広く見せる
  cam: { x: 0, y: 0, w: 1600, h: 900 },
  shake: 0, shakeX: 0, shakeY: 0,
  trail: [],            // 自機のあしあと（{x,y}）
  rings: [],            // 広がる衝撃波の輪
  zoom: 1, zoomV: 0,
  flash: 0, flashCol: [1, 1, 1],
  ca: 0, hitstop: 0,
  dispScore: 0,
  last: 0, acc: 0,
  fpsAvg: 60, qTimer: 0,
  started: false,
  waitingStart: false,
  msgTimer: 0,
  cloudRank: {},        // モード_難易度 → クラウドのランキング
  rivalShown: null,

  // ---------------- 起動 ----------------
  boot() {
    Cfg.load();
    const canvas = $('gl');
    if (!R.init(canvas)) {
      $('nogl').classList.remove('hidden');
      return;
    }
    Part.init();
    this.layout();
    Grid.init(this.view.w + 200, this.view.h + 200, 42);
    Input.init();
    this.wireUI();
    this.applyCfgToUI();
    this.refreshBest();

    addEventListener('resize', () => this.layout());
    addEventListener('orientationchange', () => setTimeout(() => this.layout(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.togglePause(true);
    });

    if (IS_EMBED) {
      $('btn-exit-title').classList.remove('hidden');
      $('btn-exit-pause').classList.remove('hidden');
      $('cost-note').classList.remove('hidden');
      parent.postMessage({ type: 'jp-ready' }, '*');
      for (const m of ['survival', 'timeattack']) {
        for (const d of ['easy', 'normal', 'hard']) {
          parent.postMessage({ type: 'jp-rank-request', mode: m, diff: d }, '*');
        }
      }
    }

    // はじめて遊ぶ人には オープニングを見せる
    let seen = false;
    try { seen = localStorage.getItem('jp_seen_story') === '1'; } catch (e) {}
    if (!seen) setTimeout(() => this.showStory(true), 400);

    this.last = performance.now();
    requestAnimationFrame(ts => this.frame(ts));
  },

  // ---------------- 画面サイズ ----------------
  layout() {
    const w = innerWidth, h = innerHeight;
    const portrait = h > w * 1.02;
    $('rotate').classList.toggle('hidden', !portrait || !this.isTouch());
    // フィールドは高さ900固定。横は画面比に合わせて広がる
    const aspect = Math.max(1.15, Math.min(2.35, w / Math.max(1, h)));
    this.view.h = 900;
    this.view.w = Math.round(900 * aspect);
    this.field.h = 700;
    this.field.w = Math.round(this.view.w / 1.07);
    if (G.phase === 'play' || G.phase === 'dead') { G.W = this.field.w; G.H = this.field.h; }
    // フィールドの横はばが変わったら グリッドを作りなおす
    if (Grid.ox && Math.abs((Grid.cols - 1) * Grid.sp - (this.view.w + 200)) > 120) {
      Grid.init(this.view.w + 200, this.view.h + 200, 42);
    }
    R.resize();
  },

  isTouch() { return matchMedia('(pointer:coarse)').matches; },

  // ---------------- UI配線 ----------------
  wireUI() {
    const click = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener('click', () => { Snd.resume(); Snd.sfx('ui'); fn(); });
    };

    document.querySelectorAll('.mode-pick .pick').forEach(b => {
      b.addEventListener('click', () => {
        Snd.resume(); Snd.sfx('ui');
        Cfg.mode = b.dataset.mode; Cfg.save();
        this.applyCfgToUI(); this.refreshBest();
      });
    });
    document.querySelectorAll('.diff-pick .pick').forEach(b => {
      b.addEventListener('click', () => {
        Snd.resume(); Snd.sfx('ui');
        Cfg.diff = b.dataset.diff; Cfg.save();
        this.applyCfgToUI(); this.refreshBest();
      });
    });

    click('btn-control', () => { Cfg.control = Cfg.control === 'twin' ? 'auto' : 'twin'; Cfg.save(); this.applyCfgToUI(); });
    click('btn-calm', () => { Cfg.calm = !Cfg.calm; Cfg.save(); this.applyCfgToUI(); });
    click('btn-bgm', () => { Cfg.bgm = !Cfg.bgm; Snd.setBgmOn(Cfg.bgm); Cfg.save(); this.applyCfgToUI(); });
    click('btn-sfx', () => { Cfg.sfx = !Cfg.sfx; Snd.sfxOn = Cfg.sfx; Cfg.save(); this.applyCfgToUI(); });

    click('btn-start', () => this.requestStart());
    click('btn-retry', () => this.requestStart());
    click('btn-title', () => this.toTitle());
    click('btn-resume', () => this.togglePause());
    click('btn-quit', () => { this.endGame(true); this.toTitle(); });
    click('btn-pause', () => this.togglePause());
    click('btn-rank', () => this.showRank());
    click('btn-rank2', () => this.showRank());
    click('btn-rank-close', () => { $('rank-screen').classList.add('hidden'); });
    click('btn-help', () => { $('help-screen').classList.remove('hidden'); });
    click('btn-story', () => this.showStory(false));
    click('btn-story-go', () => this.hideStory());
    click('btn-story-skip', () => this.hideStory());
    $('story-screen').addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      if (performance.now() - (this._storyAt || 0) < 400) return;   // 出た瞬間の誤タップ除け
      this.hideStory();
    });
    click('btn-help-close', () => { $('help-screen').classList.add('hidden'); });

    click('btn-exit-title', () => this.exitToApp());
    click('btn-exit-pause', () => this.exitToApp());

    const ni = $('name-input');
    ni.value = Cfg.name;
    ni.addEventListener('change', () => { Cfg.name = ni.value.trim().slice(0, 8); Cfg.save(); this.refreshBest(); });
    ni.addEventListener('blur', () => { Cfg.name = ni.value.trim().slice(0, 8); Cfg.save(); });

    // バグ図鑑（あそび方の画面）
    $('bug-book').innerHTML = Object.keys(BUG).map(k => {
      const d = BUG[k];
      return `<div class="bug-row"><span class="sw" style="background:${d.col};box-shadow:0 0 8px ${d.col}"></span>` +
             `<div><b style="color:${d.col}">${d.name}</b><br><i>${d.desc}</i></div></div>`;
    }).join('');

    // 本体（オトン学園）とのやりとり
    addEventListener('message', e => {
      const d = e.data || {};
      if (d.type === 'jp-name') {
        if (d.name) {
          Cfg.name = String(d.name).slice(0, 8);
          $('name-input').value = Cfg.name;
          Cfg.save(); this.refreshBest();
        }
        // 遊び券の枚数は 親から教えてもらう（子に書くと二重管理になる）
        if (d.cost) $('cost-note').textContent = `遊び券を${d.cost}まい つかいます`;
      } else if (d.type === 'jp-start-ok') {
        this.waitingStart = false;
        this.startGame();
      } else if (d.type === 'jp-start-deny') {
        this.waitingStart = false;
        this.toast(d.msg || '遊び券が足りません');
      } else if (d.type === 'jp-rank-data') {
        this.cloudRank[(d.mode || Cfg.mode) + '_' + (d.diff || Cfg.diff)] = d.list;
        this.renderCloudRank(d.list);
      }
    });
  },

  applyCfgToUI() {
    document.querySelectorAll('.mode-pick .pick').forEach(b => b.classList.toggle('on', b.dataset.mode === Cfg.mode));
    document.querySelectorAll('.diff-pick .pick').forEach(b => b.classList.toggle('on', b.dataset.diff === Cfg.diff));
    const c = $('btn-control');
    c.textContent = Cfg.control === 'twin' ? '🕹 ツインスティック' : '🎯 かんたん（自動ねらい）';
    c.classList.toggle('on', Cfg.control === 'auto');
    $('btn-calm').textContent = Cfg.calm ? '✨ 演出ひかえめ' : '✨ 演出ハデめ';
    $('btn-calm').classList.toggle('on', !Cfg.calm);
    $('btn-bgm').classList.toggle('on', Cfg.bgm);
    $('btn-sfx').classList.toggle('on', Cfg.sfx);
    Snd.sfxOn = Cfg.sfx;
    $('hint-ctrl').textContent = Cfg.control === 'twin'
      ? 'スマホ：左の親指で動く／右の親指でねらう　　PC：WASDで動く・マウスでねらう'
      : 'スマホ：左の親指で動くだけ。近いバグを自動でねらう　　PC：WASDで動く';
    document.body.classList.toggle('auto-aim', Cfg.control === 'auto');
  },

  refreshBest() {
    const b = Rank.best(Cfg.mode, Cfg.diff);
    $('v-best').textContent = b.toLocaleString();
    $('title-best').textContent = b ? `ベスト ${b.toLocaleString()}` : 'はじめてのちょうせん';
  },

  // ---------------- 開始・終了 ----------------
  requestStart() {
    Snd.resume();
    if (this.waitingStart) return;
    if (IS_EMBED) {
      this.waitingStart = true;
      parent.postMessage({ type: 'jp-start-request' }, '*');
      setTimeout(() => { if (this.waitingStart) { this.waitingStart = false; this.startGame(); } }, 1200);
    } else {
      this.startGame();
    }
  },

  startGame() {
    Snd.resume();
    Snd.init();
    G.reset(Cfg.mode, Cfg.diff, this.field.w, this.field.h);
    Part.clear();
    for (let i = 0; i < Grid.ox.length; i++) { Grid.ox[i] = Grid.oy[i] = Grid.vx[i] = Grid.vy[i] = 0; }
    this.state = 'play';
    this.dispScore = 0;
    this.shake = 0; this.flash = 0; this.ca = 0; this.hitstop = 0;
    this.rings.length = 0; this.trail.length = 0;
    this.zoom = 1.10; this.zoomV = 0;
    Input.bombWanted = false;
    document.body.className = 'playing' + (Cfg.mode === 'timeattack' ? ' ta' : '') + (Cfg.control === 'auto' ? ' auto-aim' : '');
    ['title-screen', 'over-screen', 'pause-screen', 'rank-screen', 'help-screen'].forEach(id => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    $('touch-ui').classList.remove('hidden');
    Rivals.build(Cfg.mode, Cfg.diff, Cfg.name, this.cloudRank[Cfg.mode + '_' + Cfg.diff]);
    this.rivalShown = null;
    this.updateRival(true);
    this.bigText('MISSION START', 'データ空間へ ダイブ', 1.3);
    Grid.impulse(0, 0, 700, 620);
    Part.ring(0, 0, 40, JADE_COL.body, 700, 5, 0.8, 2.0);
    Snd.setLevel(0);
    Snd.startBgm();
    Snd.sfx('respawn');
    this.started = true;
  },

  endGame(silent) {
    this.state = 'over';
    Snd.stopBgm(0.7);
    $('touch-ui').classList.add('hidden');
    Input.sticks.l = Input.sticks.r = null;
    Input.showStick('l', false); Input.showStick('r', false);
    if (silent) return;

    const sc = G.score;
    const pos = Rank.add(Cfg.mode, Cfg.diff, Cfg.name, sc);
    this.refreshBest();
    $('r-score').textContent = sc.toLocaleString();
    $('r-kill').textContent = G.killTotal.toLocaleString();
    $('r-mult').textContent = '×' + G.maxMult;
    $('r-bit').textContent = G.bitTotal.toLocaleString();
    $('r-time').textContent = Cfg.mode === 'timeattack' ? '60びょう' : this.fmtTime(G.time);
    $('over-title').textContent = Cfg.mode === 'timeattack' ? 'TIME UP' : 'GAME OVER';
    const rk = rankOf(Cfg.mode, Cfg.diff, sc);
    const rb = $('r-rank');
    rb.textContent = rk.L;
    rb.className = 'rank-badge ' + rk.cls;
    rb.classList.remove('rankIn'); void rb.offsetWidth;
    const best = Rank.best(Cfg.mode, Cfg.diff);
    $('r-msg').textContent = (pos === 0 && sc > 0) ? '🏆 じこベスト こうしん！　' + rk.msg
      : pos >= 0 ? `${rk.msg}（端末内 ${pos + 1}位）`
      : rk.msg;
    $('over-screen').classList.remove('hidden');

    if (IS_EMBED && sc > 0) {
      parent.postMessage({ type: 'jp-score', score: sc, mode: Cfg.mode, diff: Cfg.diff }, '*');
    }
  },

  toTitle() {
    this.state = 'title';
    Input.bombWanted = false;
    Snd.stopBgm(0.4);
    G.phase = 'idle';
    $('hud').classList.add('hidden');
    $('touch-ui').classList.add('hidden');
    ['over-screen', 'pause-screen', 'rank-screen', 'help-screen'].forEach(id => $(id).classList.add('hidden'));
    $('title-screen').classList.remove('hidden');
    document.body.className = 'titling' + (Cfg.control === 'auto' ? ' auto-aim' : '');
    this.refreshBest();
  },

  togglePause(force) {
    if (this.state === 'play') {
      this.state = 'pause';
      $('pause-screen').classList.remove('hidden');
      $('touch-ui').classList.add('hidden');
      Input.sticks.l = Input.sticks.r = null;
      Input.showStick('l', false); Input.showStick('r', false);
      Snd.stopBgm(0.2);
    } else if (this.state === 'pause' && !force) {
      this.state = 'play';
      $('pause-screen').classList.add('hidden');
      $('touch-ui').classList.remove('hidden');
      Snd.resume();
      Snd.startBgm();
      Snd.setLevel(G.intensity());
    }
  },

  exitToApp() {
    Snd.stopBgm(0.1);
    if (IS_EMBED) parent.postMessage({ type: 'jp-exit' }, '*');
  },

  // ---------------- オープニング ----------------
  showStory(auto) {
    const el = $('story-screen');
    el.classList.remove('hidden');
    // アニメーションを頭から流しなおす
    el.querySelectorAll('.story-line, .story-tag, .story-go').forEach(n => {
      n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
    });
    this._storyAt = performance.now();
    if (!auto) Snd.resume();
    try { localStorage.setItem('jp_seen_story', '1'); } catch (e) {}
  },

  hideStory() {
    $('story-screen').classList.add('hidden');
    Snd.resume(); Snd.sfx('ui');
  },

  // ワールド座標に スコアを ぽんと出す
  popScore(x, y, text, big) {
    const layer = $('pops');
    if (!layer || layer.childElementCount > 14) return;
    const d = document.createElement('div');
    d.className = 'pop-score' + (big ? ' big' : '');
    d.textContent = text;
    const c = this.cam;
    d.style.left = (((x - c.x) / c.w + 0.5) * innerWidth) + 'px';
    d.style.top = ((0.5 - (y - c.y) / c.h) * innerHeight) + 'px';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  },

  // ---------------- ランキング ----------------
  showRank() {
    const list = Rank.list(Cfg.mode, Cfg.diff);
    const el = $('rank-list');
    const modeName = Cfg.mode === 'timeattack' ? '60びょう' : 'サバイバル';
    $('rank-head').textContent = `${modeName} ／ ${DIFF[Cfg.diff].label}`;
    if (!list.length) {
      el.innerHTML = '<p class="rank-empty">まだ 記録が ありません</p>';
    } else {
      el.innerHTML = list.map((r, i) =>
        `<div class="rank-row${i === 0 ? ' top' : ''}"><i>${i + 1}</i><b>${this.esc(r.n)}</b><s>${r.s.toLocaleString()}</s><u>${r.d}</u></div>`
      ).join('');
    }
    $('cloud-rank').innerHTML = '';
    if (IS_EMBED) parent.postMessage({ type: 'jp-rank-request', mode: Cfg.mode, diff: Cfg.diff }, '*');
    $('rank-screen').classList.remove('hidden');
  },

  renderCloudRank(list) {
    if (!Array.isArray(list) || !list.length) return;
    $('cloud-rank').innerHTML = '<h3>☁ みんなの記録</h3>' + list.slice(0, 10).map((r, i) =>
      `<div class="rank-row"><i>${i + 1}</i><b>${this.esc(r.nickname || r.n || '')}</b><s>${(r.value || r.s || 0).toLocaleString()}</s></div>`
    ).join('');
  },

  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

  fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  },

  // ---------------- 画面の文字 ----------------
  bigText(main, sub, dur) {
    const b = $('big-text'), s = $('sub-text');
    b.textContent = main;
    s.textContent = sub || '';
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
    this.msgTimer = dur || 1.2;
  },

  toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  },

  // 新しいバグが出たときの図鑑カード
  showNewBug(type) {
    const d = BUG[type];
    const c = $('newbug');
    $('nb-name').textContent = d.name;
    $('nb-desc').textContent = d.desc;
    $('nb-name').style.color = d.col;
    c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    Snd.sfx('alert');
  },

  // ---------------- 演出（イベント処理）----------------
  processEvents() {
    const evs = G.events;
    const fx = Cfg.calm ? 0.45 : 1;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      switch (e.t) {
        case 'shoot': {
          Part.spray(e.x, e.y, e.a, 2, JADE_COL.body, 260, 2.6, 0.10, 0.5);
          Snd.sfx('shoot');
          break;
        }
        case 'spark': {
          Part.spray(e.x, e.y, Math.atan2(-Math.sin(e.a), -Math.cos(e.a)), 4, e.col || JADE_COL.body,
                     360, 2.6, 0.16, 0.9);
          break;
        }
        case 'hit': {
          Part.burst(e.x, e.y, 4, e.col, 300, 2.4, 0.2, 1.6);
          Snd.sfx('hit');
          break;
        }
        case 'dodge': {
          Part.burst(e.x, e.y, 6, e.col, 320, 2.2, 0.25, 1.3);
          break;
        }
        case 'kill': {
          // 破片・リング二重・白い芯・キラキラの4層。撃破の手ごたえは、この演出量で決まる
          const big = e.big;
          const n = big ? 100 : 52;
          Part.burst(e.x, e.y, n, e.col, big ? 1450 : 980, big ? 5.2 : 4.2, big ? 2.0 : 1.35, 2.3, 0.68);
          Part.ring(e.x, e.y, big ? 34 : 18, e.col, big ? 1150 : 780, big ? 4.2 : 3.4, big ? 0.7 : 0.42, 2.6);
          Part.ring(e.x, e.y, big ? 20 : 10, BIT_COL, big ? 780 : 520, 2.8, big ? 0.45 : 0.28, 2.0);
          Part.burst(e.x, e.y, big ? 26 : 11, WHITE, big ? 800 : 480, 3.2, big ? 0.4 : 0.24, 2.8);
          // 撃破の瞬間だけ、小さくて とても熱い芯（「倒した手ごたえ」はこれが出す）
          Part.burst(e.x, e.y, big ? 7 : 4, WHITE, big ? 95 : 60,
                     big ? 3.0 : 2.2, big ? 0.085 : 0.06, 3.0, 5.0);
          Grid.impulse(e.x, e.y, big ? 400 : 230, big ? 720 : 340);
          if (big) this.addRing(e.x, e.y, e.r * 0.6, e.r * 4.6, 0.34, e.col, 2.4, 3.0);
          this.addShake(big ? 0.42 : 0.10);
          this.flashUp((big ? 0.20 : 0.06) * fx, e.col);
          R.addShock(e.x, e.y, (big ? 0.9 : 0.32) * fx, big ? 0.5 : 0.32);
          if (big) this.hitstop = Math.max(this.hitstop, 0.045);
          Snd.sfx('kill', { frame: this.frameNo, pitch: big ? 0.55 : (e.type === 'chaser' ? 1.25 : 1) });
          if (big) this.popScore(e.x, e.y, '+' + e.pts.toLocaleString(), true);
          break;
        }
        case 'shove': {
          Part.ring(e.x, e.y, 8, e.col, 240, 2.2, 0.22, 1.4);
          break;
        }
        case 'vanish': {
          Part.burst(e.x, e.y, 10, e.col, 380, 2.8, 0.4, 1.4);
          break;
        }
        case 'absorb': {
          Part.burst(e.x, e.y, 8, e.col, 200, 2.4, 0.3, 1.4);
          break;
        }
        // ホールどうしの合体＝「消えた」ではなく「もっと強いのが出た」と分かるように大きく出す
        case 'merge': {
          Part.ring(e.x, e.y, 30, e.col, 900, 4.0, 0.62, 2.6);
          Part.ring(e.x, e.y, 16, WHITE, 520, 3.0, 0.34, 2.2);
          Part.burst(e.x, e.y, 20, e.col, 700, 3.4, 0.5, 2.4);
          this.addRing(e.x, e.y, e.r * 3.4, e.r * 0.7, 0.42, e.col, 2.6, 3.0);
          Grid.impulse(e.x, e.y, 520, -700);   // 外へでなく 内へ引きこむ
          this.addShake(0.34);
          this.flashUp(0.16 * fx, e.col);
          R.addShock(e.x, e.y, 0.8 * fx, 0.55);
          this.hitstop = Math.max(this.hitstop, 0.05);
          Snd.sfx('kill', { frame: this.frameNo, pitch: 0.42 });
          Snd.sfx('alert');
          if (e.up) this.bigText(e.name, 'ホールが 合体した！', 1.1);
          break;
        }
        case 'spit': {
          Grid.impulse(e.x, e.y, 190, 200);
          this.addShake(0.06);
          break;
        }
        case 'pop': {
          Part.ring(e.x, e.y, 10, e.col, 220, 2.4, 0.25, 1.6);
          break;
        }
        case 'warn': {
          Snd.sfx('warn');
          break;
        }
        case 'bit': {
          // 1つ拾えば必ず倍率+1。音は16段のぼって折り返す
          Part.burst(e.x, e.y, 4, BIT_COL, 190, 2.3, 0.24, 1.9);
          Snd.sfx('bit', (e.mult - 2) % 16);
          if (e.milestone) {
            this.bigText('×' + e.mult, 'ばいりつ ' + e.mult + 'ばい', 1.0);
            Part.ring(G.p.x, G.p.y, 26, BIT_COL, 460, 3.2, 0.5, 2.0);
            Grid.impulse(G.p.x, G.p.y, 260, 320);
            this.flashUp(0.10 * fx, BIT_COL);
            R.addShock(G.p.x, G.p.y, 0.5 * fx, 0.45);
            this.zoomV -= 0.10 * fx;
            Snd.sfx('multi', Math.min(12, Math.round(Math.log2(e.mult) * 3)));
          }
          break;
        }
        case 'camp': {
          this.toast('すみっこは あぶない！');
          Snd.sfx('warn');
          break;
        }
        case 'bombgather': {
          if (e.n >= 5) this.toast(`ビット ${e.n}こ 回収`);
          break;
        }
        case 'bomb': {
          Part.ring(e.x, e.y, 90, JADE_COL.body, 900, 5, 0.9, 2.4);
          Part.ring(e.x, e.y, 50, JADE_COL.wing, 620, 4, 1.1, 2.0);
          Grid.impulse(e.x, e.y, 1100, 1050);
          R.addShock(e.x, e.y, 1.6 * fx, 0.75);
          this.addShake(1.0);
          // 一度ほぼ真っ白に飛ばして、すぐ戻す（本家のボムはこれで「効いた」と分かる）
          this.flashUp(0.90 * fx, [1, 0.97, 0.86]);
          this.addRing(e.x, e.y, 40, Math.max(this.view.w, this.view.h) * 0.78, 0.60, [1, 1, 1], 3.2, 4.4);
          this.addRing(e.x, e.y, 20, this.view.w * 0.46, 0.44, JADE_COL.body, 5.0, 3.0);
          this.hitstop = Math.max(this.hitstop, 0.075);
          this.zoomV -= 0.22 * fx;
          Snd.sfx('bomb');
          this.bigText('大はばたき', 'バグを 一掃', 0.9);
          break;
        }
        case 'death': {
          Part.burst(e.x, e.y, 60, JADE_COL.body, 640, 4, 0.9, 2.2);
          Part.ring(e.x, e.y, 34, JADE_COL.head, 480, 3.4, 0.8, 2.0);
          Grid.impulse(e.x, e.y, 820, 850);
          this.addRing(e.x, e.y, 30, 620, 0.5, [1, 0.35, 0.35], 3.0, 3.4);
          R.addShock(e.x, e.y, 1.3 * fx, 0.65);
          this.addShake(1.0);
          this.flashUp(0.5 * fx, [1, 0.5, 0.5]);
          this.hitstop = Math.max(this.hitstop, 0.11);
          Snd.sfx('death');
          if (e.from > e.to) this.bigText('×' + e.from + ' → ×' + e.to, 'ばいりつ ダウン', 1.4);
          break;
        }
        case 'respawn': {
          this.bigText('REBOOT', 'ジェイド 再起動', 0.9);
          Part.ring(e.x, e.y, 40, JADE_COL.wing, 560, 3.4, 0.7, 2.0);
          Grid.impulse(e.x, e.y, 460, 420);
          Snd.sfx('respawn');
          break;
        }
        case 'newtype': {
          this.showNewBug(e.type);
          break;
        }
        case 'extralife': {
          this.bigText('1UP', 'ジェイド 1機 ついか', 1.2);
          Snd.sfx('life');
          this.flashUp(0.12 * fx, JADE_COL.wing);
          break;
        }
        case 'extrabomb': {
          this.toast('💨 大はばたき ＋1 を 受信');
          Snd.sfx('life');
          break;
        }
        case 'gameover': {
          Snd.sfx('gameover');
          setTimeout(() => { if (this.state === 'ending') this.endGame(); }, 550);
          break;
        }
        case 'timeup': {
          Snd.sfx('clear');
          this.bigText('TIME UP', '', 1.5);
          setTimeout(() => { if (this.state === 'ending') this.endGame(); }, 900);
          break;
        }
        case 'tick': {
          if (e.n > 0) { Snd.sfx('tick', false); this.bigText(String(e.n), '', 0.5); }
          break;
        }
        case 'wall': break;
      }
    }
    evs.length = 0;
  },

  // 広がる光の輪。「今ここで何かが起きた」を1つの形で伝える
  addRing(x, y, r0, r1, life, col, w, glow) {
    if (this.rings.length > 10) this.rings.shift();
    this.rings.push({ x, y, r0, r1, t: 0, life, col, w, glow });
  },

  addShake(v) {
    const CAP = 1.0;
    const add = v * (Cfg.calm ? 0.45 : 1);
    // すでに揺れているときは ほとんど足さない（何十匹まとめて倒しても暴れない）
    this.shake = Math.min(CAP, this.shake + add * (1 - this.shake / CAP));
  },
  flashUp(v, col) {
    this.flash = Math.max(this.flash, v);
    if (col) this.flashCol = col;
  },

  // ---------------- メインループ ----------------
  frame(ts) {
    requestAnimationFrame(t => this.frame(t));
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.05);
    this.frameNo = (this.frameNo || 0) + 1;

    // fps を見て 解像度を上げ下げ
    this.fpsAvg = lerp(this.fpsAvg, 1 / Math.max(dt, 0.001), 0.05);
    this.qTimer += dt;
    if (this.qTimer > 1.5) {
      this.qTimer = 0;
      if (this.fpsAvg < 46) R.setQuality(R.quality - 0.12);
      else if (this.fpsAvg > 57 && R.quality < 1) R.setQuality(R.quality + 0.08);
    }

    const playing = this.state === 'play';

    // ヒットストップ（当たった瞬間だけ 時間を止める）
    let simDt = dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      simDt = dt * 0.08;
    }

    if (playing) {
      const inp = Input.gather();
      if (Input.bombWanted) {
        Input.bombWanted = false;
        if (!G.useBomb()) Snd.sfx('ui');
      }
      this.acc += simDt;
      let steps = 0;
      while (this.acc >= FIXED && steps < MAX_STEPS) {
        G.update(FIXED, inp);
        this.acc -= FIXED;
        steps++;
      }
      if (steps >= MAX_STEPS) this.acc = 0;
      this.processEvents();
      if (G.phase === 'over' && this.state === 'play') this.state = 'ending';
      Snd.setLevel(G.intensity());
    } else if (this.state === 'ending') {
      this.acc = 0;
      this.processEvents();
    } else {
      G.events.length = 0;
    }

    this.updateVisuals(dt, simDt);
    this.render(dt);
    if (playing || this.state === 'ending') this.updateHud();
  },

  updateVisuals(dt, simDt) {
    const vdt = (this.state === 'play' || this.state === 'ending') ? simDt : dt * 0.4;
    Part.update(vdt);

    // 広がる輪
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].t += vdt;
      if (this.rings[i].t >= this.rings[i].life) this.rings.splice(i, 1);
    }
    Part.boundW = this.field.w / 2 + 40;
    Part.boundH = this.field.h / 2 + 40;

    // 自機のあしあとを ためる（20点＝約1/3秒ぶん）
    if (G.p && G.p.alive) {
      const n = this.trail.length;
      // 前の点から離れすぎていたら 引き直す（復活のワープで画面を横切る線が出るのを防ぐ）
      if (n >= 2 && Math.hypot(G.p.x - this.trail[n-2], G.p.y - this.trail[n-1]) > 90) this.trail.length = 0;
      this.trail.push(G.p.x, G.p.y);
      while (this.trail.length > 40) this.trail.splice(0, 2);
    } else if (this.trail.length) {
      this.trail.length = 0;
    }

    // バグホールは グリッドも吸う
    for (const e of G.enemies) {
      if (e.type === 'hole' && e.age > e.born) {
        const hk = 1 + (e.tier || 0) * 0.45;
        Grid.attract(e.x, e.y, (560 + e.grow * 14) * hk, (1400 + e.grow * 70) * hk, vdt);
      }
    }
    // ジェイドの通ったあとが すこし へこむ
    if (this.state === 'play' && G.p.alive) {
      Grid.impulse(G.p.x, G.p.y, 95, 17 * (0.4 + G.p.thrust));
      if (G.p.thrust > 0.15) {
        // 進んでいる間、いつも尾を引く。速いほど 長く・明るく
        const spd = Math.hypot(G.p.vx, G.p.vy);
        const back = Math.atan2(-G.p.vy, -G.p.vx);
        const n = Math.round(1 + G.p.thrust * 2.2);
        for (let k = 0; k < n; k++) {
          const a = back + rnd(-0.5, 0.5);
          const col = Math.random() < 0.5 ? JADE_COL.wing : JADE_COL.body;
          Part.spawn(G.p.x + Math.cos(a) * 14 - G.p.vx * 0.01, G.p.y + Math.sin(a) * 14 - G.p.vy * 0.01,
                     Math.cos(a) * rnd(80, 220) + G.p.vx * 0.3, Math.sin(a) * rnd(80, 220) + G.p.vy * 0.3,
                     rnd(0.28, 0.6), col, rnd(2.4, 3.4), 1.9 * G.p.thrust, 2.0);
        }
        if (spd > 400 && Math.random() < 0.6) {
          Part.spawn(G.p.x, G.p.y, -G.p.vx * 0.15, -G.p.vy * 0.15, 0.22, WHITE, 2.0, 2.4, 3.2);
        }
      }
    }
    Grid.update(Math.min(vdt, 1 / 50));
    R.updateShocks(dt);

    // カメラの ゆれ／ズーム
    this.shake = Math.max(0, this.shake - dt * 3.4);
    // 2乗だと 小さい揺れが消えてしまう。1.5乗にすると
    // 「大物1体はドンと来る／40体まとめてもガタガタにならない」が両立する
    const s = Math.pow(this.shake, 1.5) * 20;
    this.shakeX = rnd(-s, s);
    this.shakeY = rnd(-s, s);
    this.zoomV += (1 - this.zoom) * 26 * dt;
    this.zoomV *= Math.exp(-7 * dt);
    this.zoom += this.zoomV * dt * 6;
    this.zoom = clamp(this.zoom, 0.94, 1.18);

    this.flash = Math.max(0, this.flash - dt * (2.2 + this.flash * 7.5));
    const dangerCa = G.danger() * 0.5;
    this.ca = lerp(this.ca, (this.shake * 0.9 + dangerCa * 0.5) * (Cfg.calm ? 0.25 : 1), 1 - Math.exp(-10 * dt));

    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) { $('big-text').textContent = ''; $('sub-text').textContent = ''; }
    }
    this.dispScore = lerp(this.dispScore, G.score, 1 - Math.exp(-9 * dt));
  },

  render(dt) {
    const V = this.view;
    const z = this.zoom;
    this.cam.x = this.shakeX;
    this.cam.y = this.shakeY + this.camY;
    this.cam.w = V.w * z;
    this.cam.h = V.h * z;
    R.beginFrame(this.cam);

    const t = performance.now() / 1000;
    const beat = Snd.beatPulse();
    const danger = G.danger();

    // --- グリッド（背景。芯を持たせない＝ここが白く焼けると 主役が消える）---
    const gBase = [0.05, 0.17, 0.46];
    const gHot = [0.26, 0.76, 1.00];
    R.glowMul = 1.0; R.coreMul = 0.06;
    Grid.draw(gBase, gHot, beat, Cfg.calm, this.field.w / 2 + 30, this.field.h / 2 + 30);

    // --- 盤の中を ゆっくり流れる データのかけら ---
    //     敵がいない時間帯に画面が「死んだ面」になるのを防ぐ層。
    //     主役より うんと暗くして、視線を奪わないこと
    {
      const fw = this.field.w / 2, fh = this.field.h / 2;
      const dim = [0.20, 0.48, 0.92];
      R.glowMul = 1.0; R.coreMul = 0.0;
      for (let i = 0; i < 22; i++) {
        const sx = ((i * 137.508) % 100) / 100;
        const sy = ((i * 71.317) % 100) / 100;
        const speed = 18 + (i % 5) * 11;
        const dx = ((sx * fw * 2 + t * speed) % (fw * 2)) - fw;
        const dy = (sy * 2 - 1) * fh * 0.96;
        const ln = 9 + (i % 4) * 8;
        const fade = 0.16 + 0.12 * Math.sin(t * 1.1 + i * 1.7);
        R.line(dx, dy, dx + ln, dy, dim, 1.0, fade);
      }
    }

    // --- フィールドのふち（細い線＋四隅だけ強く。太い白枠は主役より目立ってしまう）---
    const hw = this.field.w / 2, hh = this.field.h / 2;
    // すみっこに居すわると かべが赤く焼ける＝「押し出されている」理由が目で分かる
    const cpush = (G.cornerPush || 0);
    const bc = [0.24 + cpush * 0.85, 0.66 - cpush * 0.52, 1.0 - cpush * 0.78];
    const bg = 1.05 + beat * 0.4 + danger * 1.1 + cpush * 1.9;
    const bw = 2.6;
    R.glowMul = 1.0; R.coreMul = 0.34;
    R.line(-hw, -hh, hw, -hh, bc, bw, bg);
    R.line(-hw, hh, hw, hh, bc, bw, bg);
    R.line(-hw, -hh, -hw, hh, bc, bw, bg);
    R.line(hw, -hh, hw, hh, bc, bw, bg);
    // 内側にもう1本、うっすら（かべに厚みを出す）
    {
      const o = 4.5, ig = bg * 0.16;
      R.coreMul = 0.03;
      R.line(-hw + o, -hh + o, hw - o, -hh + o, bc, 7.0, ig);
      R.line(-hw + o, hh - o, hw - o, hh - o, bc, 7.0, ig);
      R.line(-hw + o, -hh + o, -hw + o, hh - o, bc, 7.0, ig);
      R.line(hw - o, -hh + o, hw - o, hh - o, bc, 7.0, ig);
    }
    // 四隅のブラケット（ここが「かべ」だと ひと目で分かる）
    {
      const L = Math.min(hw, hh) * 0.16;
      const cg = 1.5 + beat * 0.6 + danger * 1.4;
      R.coreMul = 0.55;
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sy = -1; sy <= 1; sy += 2) {
          R.line(sx * hw, sy * hh, sx * (hw - L), sy * hh, bc, 3.0, cg);
          R.line(sx * hw, sy * hh, sx * hw, sy * (hh - L), bc, 3.0, cg);
        }
      }
    }

    // 押し出されている向きを 内側へ流れる筋で見せる
    if (cpush > 0.02 && this.state === 'play') {
      const px = G.p.x, py = G.p.y;
      const nl = Math.hypot(px, py) || 1;
      const nx = -px / nl, ny = -py / nl;
      R.coreMul = 0.2;
      for (let i = 0; i < 7; i++) {
        const sp = (i / 7 + (t * 0.9 % 1)) % 1;
        const off = (i - 3) * 26;
        const bx = px - ny * off, by = py + nx * off;
        const s0 = 34 + sp * 96;
        R.line(bx + nx * s0, by + ny * s0, bx + nx * (s0 + 30), by + ny * (s0 + 30),
               [1, 0.42, 0.28], 2.2, 2.4 * cpush * (1 - sp));
      }
    }

    // ここから先は 主役。芯まで白く焼けるほど熱くする
    R.glowMul = 1.62; R.coreMul = 1.0;

    if (this.state === 'title') {
      this.renderTitleScene(t);
    } else {
      // --- ビット ---
      for (const b of G.bits) drawBit(b, t);
      // --- 予告 ---
      for (const s of G.spawns) drawSpawnWarn(s, t);
      // --- バグ ---
      for (const e of G.enemies) drawEnemy(e, t);
      // --- 弾 ---
      for (const b of G.bullets) drawBullet(b);
      // --- 広がる輪 ---
      for (const g of this.rings) {
        const k = g.t / g.life;
        const rr = g.r0 + (g.r1 - g.r0) * easeOut(k);
        const a2 = (1 - k) * (1 - k);
        R.circle(g.x, g.y, rr, 56, g.col, g.w * (0.30 + 0.70 * (1 - k)), g.glow * a2);
      }
      // --- 粒子 ---
      Part.draw();
      // --- ジェイド ---
      if (G.p.alive) {
        // あしあと（うしろほど細く・暗く）。これがあるだけで 混戦でも自分を見失わない
        const tr = this.trail, tn = tr.length >> 1;
        for (let i = 1; i < tn; i++) {
          const f = i / tn;
          R.line(tr[(i-1)*2], tr[(i-1)*2+1], tr[i*2], tr[i*2+1],
                 JADE_COL.body, 0.9 + f * 2.6, f * f * 1.25);
        }
        const blink = G.invul > 0 && Math.floor(t * 14) % 2 === 0;
        drawJade(G.p.x, G.p.y, G.p.face, G.p.flap, G.p.thrust, blink, 0.85, 1);
        if (G.invul > 0) {
          const rr = 27 + Math.sin(t * 8) * 3;
          R.circle(G.p.x, G.p.y, rr, 18, JADE_COL.wing, 1.8, 0.9 * Math.min(1, G.invul), t);
        }
        // ねらっている方向のガイド（かんたんモードで役立つ）
        if (this.state === 'play') {
          const gx = Math.cos(G.p.aim), gy = Math.sin(G.p.aim);
          R.line(G.p.x + gx * 30, G.p.y + gy * 30, G.p.x + gx * 46, G.p.y + gy * 46,
                 JADE_COL.body, 1.6, 0.55);
        }
      }
    }

    R.glowMul = 1.0; R.coreMul = 1.0;

    R.endFrame({
      time: t,
      danger: danger * (Cfg.calm ? 0.5 : 1),
      beat,
      threshold: 0.86,
      knee: 0.50,
      bloom: (Cfg.calm ? 0.72 : 1.08) + beat * 0.10,
      ca: this.ca,
      flash: this.flash,
      flashCol: this.flashCol,
      vig: Cfg.calm ? 0.5 : 0.85,
      grain: Cfg.calm ? 0.0 : 0.020,
      fxScale: Cfg.calm ? 0.45 : 1,
    });
  },

  // タイトル画面でも ジェイドが飛んでいる
  renderTitleScene(t) {
    const V = this.field;

    // --- 奥の層：ゆっくり流れる遠くのかけらと、遠巻きに漂うバグの影 ---
    //     ここが無いと 下半分が空いて「作りかけの画面」に見える
    {
      const keep = R.coreMul, kg = R.glowMul;
      R.coreMul = 0.0; R.glowMul = 1.0;
      const dim = [0.16, 0.42, 0.78];
      for (let i = 0; i < 26; i++) {
        const sx = ((i * 137.5) % 100) / 100 - 0.5;
        const sy = ((i * 71.3) % 100) / 100 - 0.5;
        const dx = ((sx * V.w * 1.25) + t * (10 + (i % 5) * 6)) % (V.w * 1.25) - V.w * 0.62;
        const dy = sy * V.h * 1.15;
        const ln = 10 + (i % 4) * 7;
        R.line(dx, dy, dx + ln, dy, dim, 1.0, 0.30 + 0.18 * Math.sin(t * 1.3 + i));
      }
      // 遠くを漂うバグの影（色は出さない＝主役を食わない）
      const shade = [0.30, 0.30, 0.62];
      for (let i = 0; i < 5; i++) {
        const a = t * (0.10 + i * 0.035) + i * 1.9;
        const rx = V.w * (0.30 + i * 0.055), ry = V.h * (0.30 + i * 0.04);
        const ex = Math.cos(a) * rx, ey = Math.sin(a * 1.3) * ry;
        const rr = 13 + i * 2.5;
        R.poly([rr, 0, 0, rr, -rr, 0, 0, -rr], ex, ey, a * 1.7, 1, shade, 1.5, 0.60, true);
      }
      R.coreMul = keep; R.glowMul = kg;
    }

    const rx = V.w * 0.32, ry = V.h * 0.30;
    const a = t * 0.45;
    const x = Math.cos(a) * rx, y = Math.sin(a * 1.6) * ry;
    const face = Math.atan2(Math.cos(a * 1.6) * 1.6 * ry, -Math.sin(a) * rx);
    drawJade(x, y, face, t * 9, 0.6, false, 1.9, 1);
    Grid.impulse(x, y, 115, 20);
    if (Math.random() < 0.4) {
      const ang = face + Math.PI + rnd(-0.4, 0.4);
      Part.spawn(x + Math.cos(ang) * 18, y + Math.sin(ang) * 18,
                 Math.cos(ang) * rnd(50, 160), Math.sin(ang) * rnd(50, 160),
                 rnd(0.3, 0.7), JADE_COL.wing, 2.6, 1.2, 2.0);
    }
    Part.draw();
  },

  // 「あと少しで抜ける相手」の表示。抜いたら知らせる
  updateRival(force) {
    const el = $('rival');
    if (!el) return;
    const r = Rivals.update(G.score);
    if (r.passed && !force) {
      const who = r.passed.n === Rivals.myName ? 'じぶんのベスト' : r.passed.n;
      this.toast(`🏆 ${who} を ぬいた！`);
      Snd.sfx('multi', 7);
      this.flashUp(0.08, [1, 0.85, 0.4]);
      if (!r.target) this.bigText('1位', 'いちばん上に 立った', 1.4);
    }
    const key = r.target ? r.target.n + '/' + r.target.s : '';
    if (key === this.rivalShown) return;
    this.rivalShown = key;
    if (!r.target) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    $('rival-name').textContent = (r.target.n === Rivals.myName ? '★' : '') + r.target.n;
    $('rival-score').textContent = r.target.s.toLocaleString();
  },

  updateHud() {
    $('v-score').textContent = Math.round(this.dispScore).toLocaleString();
    const m = $('v-mult');
    const txt = '×' + G.mult;
    if (m.textContent !== txt) {
      m.textContent = txt;
      m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump');
    }

    // 残機と ボム
    const lv = $('v-lives');
    const ln = Math.max(0, G.lives);
    if (lv.dataset.n !== String(ln) && Cfg.mode !== 'timeattack') {
      lv.dataset.n = String(ln);
      lv.innerHTML = ln > 5 ? `<span class="ic">🐦</span>×${ln}` : '<span class="ic">🐦</span>'.repeat(ln);
    }
    const bb = $('v-bombs');
    if (bb.dataset.n !== String(G.bombs)) {
      bb.dataset.n = String(G.bombs);
      bb.textContent = G.bombs;
      $('btn-bomb').classList.toggle('empty', G.bombs <= 0);
    }

    this.updateRival(false);

    // 60びょうモードの時計
    if (Cfg.mode === 'timeattack') {
      const el = $('v-time');
      el.textContent = G.timeLeft.toFixed(1);
      el.classList.toggle('hot', G.timeLeft <= 10);
    }
  },
};

// タイトルでも グリッドは呼吸している
addEventListener('DOMContentLoaded', () => {
  Game.boot();
  Snd.init();
  Game.toTitle();
});
