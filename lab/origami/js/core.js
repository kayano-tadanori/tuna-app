// ============================================================
// core.js — 画面遷移（ホーム → 一覧 → 折る画面）
// ============================================================
'use strict';

(function () {
  // オトン学園にiframeで組み込まれているとき(?embed=1)は、本体へpostMessageで
  // 準備完了を知らせ、ホーム画面の「もどる」ボタンで本体の画面へ戻す
  // （lab/okatazuke/js/game.jsのembedパターンを踏襲。遊び券のやり取りは無い）。
  const embed = /[?&]embed=1/.test(location.search);
  const homeExitBtn = document.getElementById('ori-home-exit');
  if (embed) {
    homeExitBtn.hidden = false;
    // ★2026-09-01：iPhoneのPWAでこのボタンだけ反応しなかった（本人報告）。
    //   iOSはiframe内＋スクロール層の中の要素でclickを落とすことがあるので、
    //   touchendでも拾う。touchendでpreventDefaultすればclickは続けて発火しないので
    //   二重に送られることはない（送っても本体側は同じ画面へ戻すだけで無害）。
    const exitToApp = (ev) => {
      if (ev && ev.cancelable) ev.preventDefault();
      parent.postMessage({ type: 'ori-exit' }, '*');
    };
    homeExitBtn.addEventListener('click', exitToApp);
    homeExitBtn.addEventListener('touchend', exitToApp, { passive: false });
    // loadが既に済んでいるとaddEventListenerでは二度と発火しない（ready未達で本体が待ち続ける）
    const sendReady = () => parent.postMessage({ type: 'ori-ready' }, '*');
    if (document.readyState === 'complete') sendReady();
    else addEventListener('load', sendReady);
  }

  // ── 図の上下をそろえる（2026-09-01・本人指示「全問まとめて直す」） ─────────
  // このエンジンのカメラは「zが大きいほど画面の下」に描く（viewMatのpitch回転の向き）。
  // ところが灘中対策コーナーの問題データは、歴代ずっと「zが大きいほど図の上」のつもりで
  // 書かれてきた。そのため図が原本と上下さかさまに出ていた（数学的には同じ問題で
  // 設問文とも矛盾しないが、原本の本と見比べにくい）。
  // 19問ぶんの座標を1つずつ書き直すとラベル位置まで全部作り直しになるので、
  // 読み込んだ直後にここでzを反転する。以後、問題ファイルは今までどおり
  // 「zが大きいほど図の上」のつもりで書けばよい（＝作問ルール§1の考え方のまま）。
  // 伝承折り紙(ORIGAMI_WORKS)は作品なので上下の決まりが無く、対象にしない。
  function flipZ(p) { return [p[0], p[1], -p[2]]; }
  function flipPointRef(o) { if (o && o.local) o.local = flipZ(o.local); }
  function flipProblemZ(e) {
    if (!e || e.__zFlipped) return;
    e.__zFlipped = true;
    const m = e.mesh;
    if (m) {
      if (m.verts) m.verts = m.verts.map(flipZ);
      // zの反転は鏡映なので三角形の向き（＝紙の表裏）が裏返る。巻き順を入れかえて戻す
      if (m.tris) m.tris = m.tris.map(t => [t[0], t[2], t[1]]);
      if (m.hinge) m.hinge = m.hinge.map(h => {
        if (!h) return h;
        // 平行移動ヒンジ（No.4・No.5）。向きは「本物のベクトル」なので、鏡映では
        // zだけ符号が変わる（回転軸＝擬ベクトルの[-x,-y,z]とは規則が違う）
        if (h.slide) return Object.assign({}, h, { origin: flipZ(h.origin), slide: flipZ(h.slide) });
        // 軸は「x,yを反転してzはそのまま」。こうすると鏡映で入れかわった
        // 回転の向き（山折り/谷折り）がもとに戻る（作問ルール§12の判定式で確認ずみ）
        return Object.assign({}, h, {
          origin: flipZ(h.origin),
          axis: [-h.axis[0], -h.axis[1], h.axis[2]],
        });
      });
    }
    (e.previewCreases || []).forEach(c => { c.a = flipZ(c.a); c.b = flipZ(c.b); });
    (e.areaMarks || []).forEach(am => (am.points || []).forEach(flipPointRef));
    if (e.overlapMark) {
      if (e.overlapMark.panelA) e.overlapMark.panelA = e.overlapMark.panelA.map(flipZ);
      if (e.overlapMark.panelB) e.overlapMark.panelB = e.overlapMark.panelB.map(flipZ);
    }
    (e.steps || []).forEach(st => {
      flipPointRef(st.handle);
      if (st.creaseLine) { st.creaseLine.a = flipZ(st.creaseLine.a); st.creaseLine.b = flipZ(st.creaseLine.b); }
    });
    (e.labelPoints || []).forEach(flipPointRef);
    (e.dimensionLabels || []).forEach(flipPointRef);
    (e.angleMarks || []).forEach(a => {
      if (a.vertex) a.vertex = flipZ(a.vertex);
      if (a.from) a.from = flipZ(a.from);
      if (a.to) a.to = flipZ(a.to);
    });
    (e.helperLines || []).forEach(h => { flipPointRef(h.from); flipPointRef(h.to); });
    (e.liveDistanceLabels || []).forEach(h => { flipPointRef(h.from); flipPointRef(h.to); });
  }
  Object.values(window.ORIGAMI_PROBLEMS || {}).forEach(flipProblemZ);

  const screens = {
    home: document.getElementById('ori-screen-home'),
    picker: document.getElementById('ori-screen-picker'),
    fold: document.getElementById('ori-screen-fold'),
    settings: document.getElementById('ori-screen-settings'),
  };
  function showScreen(name) {
    for (const k in screens) screens[k].hidden = (k !== name);
  }

  let inst = null;
  let currentKind = null; // 'work' | 'problem'
  let currentEntry = null;

  // 検証用の窓口（読むだけ）。Playwrightから「いま何度折れているか」「つまむ点が
  // 折り終わりにどこへ来るか」を実物のエンジンで計算して、本物の指の動きで
  // 折れるところまで確かめるために置いている（本番の動きには影響しない）。
  window.__oriDebug = { get inst() { return inst; }, get entry() { return currentEntry; } };

  // ---------- せってい（紙の色と厚み。本人指示2026-09-02） ----------
  // ★「紙の厚みがないから、折ったのが視覚的にわかりにくい」への対応。
  //   えらんだ内容はこの端末のlocalStorageに覚えておく（クラウドには送らない）。
  const SETTINGS_KEY = 'ori-settings-v1';
  const PAPER_COLORS = [
    ['あか',     '#ef5f5a'], ['だいだい', '#f39c4a'], ['きいろ',   '#f2c94c'],
    ['みどり',   '#4fb974'], ['みずいろ', '#4ec3d9'], ['あお',     '#4a8fe8'],
    ['むらさき', '#9b6ce8'], ['ピンク',   '#ef85b5'], ['しろ',     '#ffffff'],
    ['クリーム', '#f5eedc'], ['はいいろ', '#9aa3ad'], ['くろ',     '#3b4250'],
  ];
  const SETTINGS_DEFAULT = { front: '#ef5f5a', back: '#ffffff', thick: 1 };
  let settings = Object.assign({}, SETTINGS_DEFAULT);
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = Object.assign(settings, JSON.parse(raw));
  } catch (e) { /* 見られない端末でも既定で動く */ }

  function hexToRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
    if (!m) return [1, 1, 1];
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  }
  function applySettings(kind, entry) {
    if (!inst) return;
    // ★colorDown＝「色のついた面を**下**にして置いて折り始める」作品は、
    //   表と裏の色を入れかえて描く。エンジンは「最初に上を向いていた面」を
    //   表の色で塗るので、この入れかえが無いと**出来上がりが真っ白になる**
    //   （ハートの折り図⑦は全面ピンクなのに白いハートが出ていた。
    //     本人指摘 2026-09-03「それ 気になってたのよ」）。
    //   紙の形・重なり・折り線はいっさい変えない。色の割りあてだけの話。
    const e = entry || currentEntry;
    const f = hexToRgb(settings.front), b = hexToRgb(settings.back);
    const down = !!(e && e.colorDown);
    inst.setColor(down ? b : f, down ? f : b);
    // ★灘中対策の問題には、紙の厚みを付けない。
    //   問題は「図のかたちがそのまま答え」なので、厚みで辺が太ると
    //   重なりの形が読めなくなる（本人 2026-09-03
    //   「折り紙問題の方の 重ね合わせの問題がバグるようになった」）。
    //   厚みは伝承折り紙のための表現（折ったのが見て分かるように）。
    const isProblem = (kind || currentKind) === 'problem';
    inst.setThickness(isProblem ? 0 : settings.thick);
  }

  function buildSwatches(el, which) {
    el.innerHTML = '';
    PAPER_COLORS.forEach(([name, hex]) => {
      const b = document.createElement('button');
      b.className = 'ori-swatch' + (settings[which] === hex ? ' on' : '');
      b.style.background = hex;
      b.title = name;
      b.setAttribute('aria-label', name);
      b.onclick = () => {
        settings[which] = hex;
        saveSettings(); applySettings(); refreshSettingsUI();
      };
      el.appendChild(b);
    });
  }
  function refreshSettingsUI() {
    document.getElementById('ori-set-front').style.background = settings.front;
    document.getElementById('ori-set-back').style.background = settings.back;
    document.getElementById('ori-thick').value = settings.thick;
    document.getElementById('ori-thick-val').textContent =
      settings.thick === 0 ? '（なし）' : `${settings.thick}`;
    buildSwatches(document.getElementById('ori-sw-front'), 'front');
    buildSwatches(document.getElementById('ori-sw-back'), 'back');
  }
  document.getElementById('ori-home-settings').onclick = () => {
    refreshSettingsUI(); showScreen('settings');
  };
  document.getElementById('ori-settings-back').onclick = () => showScreen('home');
  document.getElementById('ori-thick').oninput = (e) => {
    settings.thick = Number(e.target.value);
    saveSettings(); applySettings(); refreshSettingsUI();
  };
  document.getElementById('ori-set-reset').onclick = () => {
    settings = Object.assign({}, SETTINGS_DEFAULT);
    saveSettings(); applySettings(); refreshSettingsUI();
  };

  function ensureRenderer(entry, kind) {
    const canvas = document.getElementById('ori-canvas');
    if (!inst) inst = OrigamiRenderer.create(canvas, entry);
    else inst.setWork(entry);
    applySettings(kind, entry);   // 作品を開くたびに、えらんだ紙の色と厚みを反映する
    // 上下の回転を自由にするのは伝承折り紙だけ（問題は裏返せると混乱するので制限）
    if (inst.setFreeCamera) inst.setFreeCamera(kind === 'work');
    return inst;
  }

  const inflateRow = document.getElementById('ori-inflate-row');
  const inflateSlider = document.getElementById('ori-inflate-slider');
  inflateSlider.oninput = () => { if (inst) inst.setInflate(inflateSlider.value / 100); };

  function openFold(kind, entry) {
    currentKind = kind; currentEntry = entry;
    ensureRenderer(entry, kind);
    const panel = document.getElementById('ori-problem-panel');
    if (kind === 'problem') {
      panel.hidden = false;
      OrigamiUI.mount(panel, entry, {
        onRevealExplanation: () => { if (inst) inst.state.explanationRevealed = true; },
        onSubmit: (raw, res) => {
          if (res.ok && window.OrigamiProgress) OrigamiProgress.markCorrect(entry.id);
        },
      });
    } else {
      panel.hidden = true;
      panel.innerHTML = '';
    }
    inflateSlider.value = 0;
    inflateRow.hidden = !entry.inflate;
    // ★自由に折るモードは「手順を覚えた後の再現」用途なので、伝承折り紙(work)のみ。
    //   灘対策コーナー(problem)は答え合わせが決まった手順に依存するため対象外
    //   （本人の指示・2026-08-30）。画面を開くたびガイド付きから始める。
    freeToggleBtn.hidden = (kind !== 'work');
    if (inst) inst.setFreeMode(false);
    showScreen('fold');
  }

  // fold画面から「もどる」で一覧に戻ったとき、答え合わせの結果（チェックマーク）が
  // 反映されるよう直前の一覧内容を覚えておき、戻るたびに再描画する
  let lastPickerList = null; // { entries, kind }
  function buildPickerList(container, entries, kind) {
    lastPickerList = { entries, kind };
    container.innerHTML = '';
    entries.forEach(entry => {
      const btn = document.createElement('button');
      btn.className = 'ori-picker-item';
      if (kind === 'work') {
        // 伝承折り紙にも難易度の星と手数を出す（本人指示2026-09-02）。
        // 星は問題側と同じ5段階の見た目にそろえる。
        const wd = Math.max(1, Math.min(5, entry.difficulty || 1));
        const wStars = `<span class="ori-picker-stars">${'★'.repeat(wd)}`
          + `<span class="ori-star-off">${'★'.repeat(5 - wd)}</span></span>`;
        const nSteps = (entry.steps || []).length;
        btn.innerHTML = `<span class="ori-picker-emoji">${entry.emoji || '📄'}</span>`
          + `<span class="ori-picker-name">${entry.name}</span>`
          + wStars
          + `<span class="ori-picker-steps">${nSteps}手</span>`;
      } else {
        const yearLabel = entry.year ? ` ${entry.year}年` : '';
        const done = window.OrigamiProgress && OrigamiProgress.isCorrect(entry.id);
        if (done) btn.classList.add('ori-picker-item-done');
        // 難易度を星で表示（本人指示2026-08-31）。difficultyは1〜5。
        const d = Math.max(1, Math.min(5, entry.difficulty || 3));
        const stars = `<span class="ori-picker-stars">${'★'.repeat(d)}<span class="ori-star-off">${'★'.repeat(5 - d)}</span></span>`;
        btn.innerHTML = `<span class="ori-picker-name">${entry.school}${yearLabel}<br>${entry.name}</span>`
          + stars
          + (done ? '<span class="ori-picker-check">✓</span>' : '');
      }
      btn.onclick = () => openFold(kind, entry);
      container.appendChild(btn);
    });
  }

  // ---- 灘中対策コーナー：カテゴリ分け（重ね合わせ／折紙問題／灘中入試、本人指示2026-08-31） ----
  const NADA_GROUPS = [
    { key: 'overlap', label: '重ね合わせ' },
    { key: 'fold', label: '折紙問題' },
    { key: 'nada', label: '灘中入試' },
  ];
  function nadaGroupOf(entry) { return entry.nadaGroup || 'fold'; }

  function buildNadaGroupList(container) {
    container.innerHTML = '';
    const all = Object.values(window.ORIGAMI_PROBLEMS || {});
    NADA_GROUPS.forEach(g => {
      const count = all.filter(e => nadaGroupOf(e) === g.key).length;
      const btn = document.createElement('button');
      btn.className = 'ori-picker-item';
      btn.innerHTML = `<span class="ori-picker-name">${g.label}<br><small>${count}問</small></span>`;
      btn.onclick = () => {
        document.getElementById('ori-picker-title').textContent = g.label;
        const list = all.filter(e => nadaGroupOf(e) === g.key);
        buildPickerList(document.getElementById('ori-picker-list'), list, 'problem');
        pickerBackTarget = 'nada-groups';
        showScreen('picker');
      };
      container.appendChild(btn);
    });
  }

  // pickerの「もどる」の戻り先。'home'＝ホーム画面／'nada-groups'＝灘中対策コーナーのカテゴリ選択
  let pickerBackTarget = 'home';

  document.getElementById('ori-home-fold').onclick = () => {
    const list = Object.values(window.ORIGAMI_WORKS || {});
    document.getElementById('ori-picker-title').textContent = 'どれを折る？';
    buildPickerList(document.getElementById('ori-picker-list'), list, 'work');
    pickerBackTarget = 'home';
    showScreen('picker');
  };
  document.getElementById('ori-home-nada').onclick = () => {
    document.getElementById('ori-picker-title').textContent = '灘中対策コーナー';
    buildNadaGroupList(document.getElementById('ori-picker-list'));
    pickerBackTarget = 'home';
    showScreen('picker');
  };
  document.getElementById('ori-picker-back').onclick = () => {
    if (pickerBackTarget === 'nada-groups') {
      document.getElementById('ori-picker-title').textContent = '灘中対策コーナー';
      buildNadaGroupList(document.getElementById('ori-picker-list'));
      pickerBackTarget = 'home';
    } else {
      showScreen('home');
    }
  };
  document.getElementById('ori-fold-back').onclick = () => {
    if (lastPickerList) {
      buildPickerList(document.getElementById('ori-picker-list'), lastPickerList.entries, lastPickerList.kind);
    }
    showScreen('picker');
  };

  const stepBackBtn = document.getElementById('ori-step-back');
  stepBackBtn.onclick = () => { if (inst) FOLD.stepBack(inst.state); };

  const freeToggleBtn = document.getElementById('ori-free-toggle');
  freeToggleBtn.onclick = () => {
    if (!inst) return;
    inst.setFreeMode(!inst.state.freeMode);
    freeToggleBtn.textContent = inst.state.freeMode ? '📖 手順にもどる' : '✋ 自由に折ってみる';
  };

  const labelLayer = document.getElementById('ori-label-layer');
  function updateLabels() {
    if (!inst) { labelLayer.innerHTML = ''; return; }
    const pts = inst.labelScreenPositions();
    // 既存span要素を使い回す（毎フレームDOM作り直すとチラつく／重い）
    while (labelLayer.children.length < pts.length) {
      const span = document.createElement('span');
      span.className = 'ori-label-pt';
      labelLayer.appendChild(span);
    }
    while (labelLayer.children.length > pts.length) labelLayer.removeChild(labelLayer.lastChild);
    pts.forEach((p, i) => {
      const el = labelLayer.children[i];
      el.textContent = p.label;
      el.className = p.kind === 'helper' ? 'ori-label-pt ori-label-pt-helper' : 'ori-label-pt';
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
  }

  // ---- 寸法表示（辺の長さ・「折り紙に寸法も書いて」本人指示2026-08-30） ----
  const dimensionLayer = document.getElementById('ori-dimension-layer');
  function updateDimensions() {
    if (!inst) { dimensionLayer.innerHTML = ''; return; }
    const pts = inst.dimensionScreenPositions();
    while (dimensionLayer.children.length < pts.length) {
      const span = document.createElement('span');
      span.className = 'ori-dimension-pill';
      dimensionLayer.appendChild(span);
    }
    while (dimensionLayer.children.length > pts.length) dimensionLayer.removeChild(dimensionLayer.lastChild);
    pts.forEach((p, i) => {
      const el = dimensionLayer.children[i];
      el.textContent = p.label;
      el.dataset.bx = p.x; el.dataset.by = p.y;   // 押しのけの起点（spreadMovableLabels）
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    });
  }

  // ---- 補助線（「解説を見る」後だけ：AからPへの垂線など） ----
  const helperLineLayer = document.getElementById('ori-helper-line-layer');
  function updateHelperLines() {
    const lines = inst ? inst.helperLineScreenPositions() : [];
    while (helperLineLayer.children.length < lines.length) {
      helperLineLayer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'line'));
    }
    while (helperLineLayer.children.length > lines.length) helperLineLayer.removeChild(helperLineLayer.lastChild);
    lines.forEach((l, i) => {
      const el = helperLineLayer.children[i];
      el.setAttribute('x1', l.a.x); el.setAttribute('y1', l.a.y);
      el.setAttribute('x2', l.b.x); el.setAttribute('y2', l.b.y);
      el.setAttribute('class', 'ori-helper-line');
    });
  }

  // ---- ライブ距離表示（今の折り具合でのAC間の実際の長さ等） ----
  const liveDistanceLayer = document.getElementById('ori-live-distance-layer');
  function updateLiveDistances() {
    if (!inst) { liveDistanceLayer.innerHTML = ''; return; }
    const pts = inst.liveDistanceScreenPositions();
    while (liveDistanceLayer.children.length < pts.length) {
      const span = document.createElement('span');
      span.className = 'ori-dimension-pill ori-dimension-pill-live';
      liveDistanceLayer.appendChild(span);
    }
    while (liveDistanceLayer.children.length > pts.length) liveDistanceLayer.removeChild(liveDistanceLayer.lastChild);
    pts.forEach((p, i) => {
      const el = liveDistanceLayer.children[i];
      el.textContent = p.label;
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    });
  }

  const handleLayer = document.getElementById('ori-handle-layer');
  function updateHandles() {
    if (!inst) { handleLayer.innerHTML = ''; return; }
    const pts = inst.handleScreenPositions();
    while (handleLayer.children.length < pts.length) {
      const span = document.createElement('span');
      span.className = 'ori-handle-marker';
      handleLayer.appendChild(span);
    }
    while (handleLayer.children.length > pts.length) handleLayer.removeChild(handleLayer.lastChild);
    pts.forEach((p, i) => {
      handleLayer.children[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
  }

  // ---- 求める面積の斜線／角の弧（何を答えるのかを図の上で明示する） ----
  const areaLayer = document.getElementById('ori-area-layer');
  function updateAreaMarks() {
    const marks = inst ? inst.areaMarkScreenPositions() : [];
    const polys = areaLayer.querySelectorAll('polygon');
    while (polys.length < marks.length) {
      areaLayer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'polygon'));
      break;
    }
    let cur = areaLayer.querySelectorAll('polygon');
    while (cur.length < marks.length) {
      areaLayer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'polygon'));
      cur = areaLayer.querySelectorAll('polygon');
    }
    while (cur.length > marks.length) { areaLayer.removeChild(cur[cur.length - 1]); cur = areaLayer.querySelectorAll('polygon'); }
    marks.forEach((m, i) => {
      const el = cur[i];
      el.setAttribute('points', m.pts.map(p => `${p.x},${p.y}`).join(' '));
      el.setAttribute('class', 'ori-area-fill');
    });
  }

  const angleLayer = document.getElementById('ori-angle-layer');
  const angleLabelLayer = document.getElementById('ori-angle-label-layer');
  function updateAngleMarks() {
    const marks = inst ? inst.angleMarkScreenPositions() : [];
    while (angleLayer.children.length < marks.length) {
      angleLayer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'polyline'));
    }
    while (angleLayer.children.length > marks.length) angleLayer.removeChild(angleLayer.lastChild);
    const labels = marks.filter(m => m.label && m.labelPos);
    while (angleLabelLayer.children.length < labels.length) {
      const s = document.createElement('span'); s.className = 'ori-angle-label';
      angleLabelLayer.appendChild(s);
    }
    while (angleLabelLayer.children.length > labels.length) angleLabelLayer.removeChild(angleLabelLayer.lastChild);
    marks.forEach((m, i) => {
      const el = angleLayer.children[i];
      el.setAttribute('points', m.pts.map(p => `${p.x},${p.y}`).join(' '));
      el.setAttribute('class', 'ori-angle-arc');
    });
    labels.forEach((m, i) => {
      const el = angleLabelLayer.children[i];
      el.textContent = m.label;
      el.dataset.bx = m.labelPos.x; el.dataset.by = m.labelPos.y;
      el.style.transform = `translate(${m.labelPos.x}px, ${m.labelPos.y}px) translate(-50%, -50%)`;
    });
  }

  // ---- ラベルの重なりを画面の上で自動的にほどく（2026-09-01） ----
  // 点の記号（A・B・F…）は位置そのものに意味があるので動かさない。
  // 寸法（BF=5cm）と角度（ア=32°）のラベルだけを、ぶつかったぶんだけ押しのける。
  // ★本人指摘「Fの記号にBF=5cmがかぶさってFが見えない」への恒久対策。
  //   問題ファイルの座標を手で調整しても、カメラの見え方が変わるとまた重なるので、
  //   毎フレーム最後にここでほどく（作問ルール§11）。
  function spreadMovableLabels() {
    const movers = [];
    for (const layer of [dimensionLayer, angleLabelLayer]) {
      for (const el of layer.children) if (el.dataset.bx !== undefined) movers.push(el);
    }
    if (!movers.length) return;
    // ① まとめて読む（読み書きを交互にするとレイアウト計算が何度も走る）
    const pins = [];
    for (const el of labelLayer.children) pins.push(el.getBoundingClientRect());
    const boxes = movers.map(el => el.getBoundingClientRect());
    // ② 重なりの浅いほうの向きへ、1回に1つずつずらす（同時に動かすと振動する）
    const off = movers.map(() => ({ x: 0, y: 0 }));
    const sh = (b, o) => ({ left: b.left + o.x, right: b.right + o.x, top: b.top + o.y, bottom: b.bottom + o.y });
    for (let it = 0; it < 10; it++) {
      let moved = false;
      for (let i = 0; i < boxes.length; i++) {
        const a = sh(boxes[i], off[i]);
        const others = pins.slice();
        for (let j = 0; j < boxes.length; j++) if (j !== i) others.push(sh(boxes[j], off[j]));
        for (const b of others) {
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox <= 0 || oy <= 0) continue;
          if (oy <= ox) off[i].y += ((a.top + a.bottom) <= (b.top + b.bottom) ? -1 : 1) * (oy + 1);
          else          off[i].x += ((a.left + a.right) <= (b.left + b.right) ? -1 : 1) * (ox + 1);
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    // ③ まとめて書く。離しすぎると「どの辺の長さか」が読めなくなるので上限を置く
    const LIM = 44;
    movers.forEach((el, i) => {
      const dx = Math.max(-LIM, Math.min(LIM, Math.round(off[i].x)));
      const dy = Math.max(-LIM, Math.min(LIM, Math.round(off[i].y)));
      el.style.transform = `translate(${Number(el.dataset.bx) + dx}px, ${Number(el.dataset.by) + dy}px) translate(-50%, -50%)`;
    });
  }

  const creaseLayer = document.getElementById('ori-crease-layer');
  function updateCrease() {
    const lines = inst ? inst.activeCreaseLines() : [];
    while (creaseLayer.children.length < lines.length) {
      creaseLayer.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'line'));
    }
    while (creaseLayer.children.length > lines.length) creaseLayer.removeChild(creaseLayer.lastChild);
    lines.forEach((c, i) => {
      const el = creaseLayer.children[i];
      el.setAttribute('x1', c.a.x); el.setAttribute('y1', c.a.y);
      el.setAttribute('x2', c.b.x); el.setAttribute('y2', c.b.y);
      el.setAttribute('class',
        c.kind === 'mountain' ? 'ori-crease-mountain'
        : c.kind === 'outline' ? 'ori-crease-outline'
        // 'edge' … 実線。折り返した紙が「下と同じ色（表）」で重なったとき、
        //          その紙の辺が色の境目として出ないので描く（鎌倉学園中の辺CT）
        : c.kind === 'edge' ? 'ori-crease-edge'
        : 'ori-crease-valley');
    });
  }

  function updateHint() {
    if (!screens.fold.hidden && inst) {
      const state = inst.state;
      const hintEl = document.getElementById('ori-hint');
      if (state.freeMode) {
        // ★自由モードは「今のステップ」が無いので、覚えた手順を思い出して
        //   好きな折り筋をつまむよう促すだけ(個別のヒントは出さない)。
        const remaining = state.work.steps.length - state.doneSteps.size;
        hintEl.textContent = remaining > 0
          ? `覚えた通りに、好きな順番で折ってみよう（のこり${remaining}）`
          : 'できあがり！回してながめよう';
        stepBackBtn.hidden = true;
      } else {
        const step = FOLD.activeStep(state);
        hintEl.textContent = step ? step.hintLabel : 'できあがり！回してながめよう';
        stepBackBtn.hidden = state.stepIndex === 0;
      }
      updateLabels();
      updateDimensions();
      updateAreaMarks();
      updateAngleMarks();
      updateCrease();
      updateHelperLines();
      updateLiveDistances();
      spreadMovableLabels();
      updateHandles();
    }
    requestAnimationFrame(updateHint);
  }
  updateHint();

  // ---- 開発・自動テスト用（本番UIからは使わない） ----
  window._origamiDebug = { showScreen, openFold, get inst() { return inst; } };
})();
