# -*- coding: utf-8 -*-
"""折ONの灘中対策コーナー全問を、本物のUI操作＋本物の指の動きで通す回帰テスト。
   エンジン(fold.js/renderer.js/core.js)を触ったあとに、既存問題が壊れていないかを見る。
   各問：全ステップを指で折る → 印刷の答えを打ちこむ → 「せいかい」 → ラベル実測 → エラー0件"""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out/shots', exist_ok=True)

import json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

PORT = 8769   # tuna app のルートで  python -m http.server 8769  を先に上げておく
URL = 'http://localhost:%d/lab/origami/index.html' % PORT

JS_LIST = """() => Object.values(window.ORIGAMI_PROBLEMS).map(p => ({
  id: p.id, group: p.nadaGroup || 'fold', name: p.name,
  ans: p.answer.display, steps: p.steps.length,
}))"""

JS_TARGET = """(k) => {
  // つまむ点が「折り終わりまでに通る道すじ」を、実物のエンジンで画面座標に落とす。
  // 指は円弧を描いて動くので、直線でなぞるとヒンジの近くを通って角度が出ないことがある。
  const inst = window.__oriDebug.inst, st = inst.state, w = st.work;
  const step = w.steps[k], b = step.handle.boneId;
  const N = 24, path = [];
  for (let i = 0; i <= N; i++) {
    const angles = st.liveAngle.slice();
    const a0 = st.liveAngle[b] || 0;
    angles[b] = a0 + (step.targetAngle - a0) * (i / N);
    for (const lb of (step.handle.linkedBoneIds || [])) {
      const id = (typeof lb === 'object') ? lb.boneId : lb;
      const tg = (typeof lb === 'object') ? lb.target : step.targetAngle;
      const s0 = st.liveAngle[id] || 0;
      angles[id] = s0 + (tg - s0) * (i / N);
    }
    const mats = FOLD.computeBoneMatrices(w, angles);
    path.push(inst.worldToScreen(OGL.vecApply(mats[b], step.handle.local)));
  }
  return { path, now: inst.worldToScreen(FOLD.handleWorldPos(st, step)),
           bone: b, targetAngle: step.targetAngle };
}"""

JS_STATE = """() => {
  // 折り終わりの頂点をワールド座標で持ち帰る（check_engine_geometry.py が
  // 面積・長さ・角度を別ルートで計算し直すのに使う）
  const inst = window.__oriDebug.inst, st = inst.state, w = st.work;
  const mats = FOLD.currentBoneMatrices(st);
  const verts = w.mesh.verts.map((v, i) => OGL.vecApply(mats[w.mesh.panel[i]], v));
  return { live: st.liveAngle, stepIndex: st.stepIndex, n: w.steps.length, verts };
}"""

JS_LABELS = """() => {
  const out=[];
  for (const sel of ['#ori-label-layer > *','#ori-dimension-layer > *','#ori-angle-label-layer > *']) {
    for (const e of document.querySelectorAll(sel)) {
      const r=e.getBoundingClientRect();
      if (r.width===0) continue;
      out.push({t:e.textContent.trim(), x:r.x,y:r.y,w:r.width,h:r.height});
    }
  }
  const hint=document.getElementById('ori-hint').getBoundingClientRect();
  const panel=document.getElementById('ori-problem-panel').getBoundingClientRect();
  return {labels:out, hint:{x:hint.x,y:hint.y,w:hint.width,h:hint.height},
          panel:{x:panel.x,y:panel.y,w:panel.width,h:panel.height}, vw:innerWidth, vh:innerHeight};
}"""

GROUP_LABEL = {'overlap': '重ね合わせ', 'fold': '折紙問題', 'nada': '灘中入試'}


def ov(a, b):
    return not (a['x']+a['w'] <= b['x'] or b['x']+b['w'] <= a['x']
                or a['y']+a['h'] <= b['y'] or b['y']+b['h'] <= a['y'])


def audit(d):
    bad = []
    for L in d['labels']:
        if L['x'] < 0 or L['y'] < 0 or L['x']+L['w'] > d['vw'] or L['y']+L['h'] > d['vh']:
            bad.append("画面外:" + L['t'])
        if ov(L, d['panel']):
            bad.append("パネルに隠れる:" + L['t'])
        if ov(L, d['hint']):
            bad.append("ヒントに隠れる:" + L['t'])
    for i in range(len(d['labels'])):
        for j in range(i+1, len(d['labels'])):
            if ov(d['labels'][i], d['labels'][j]):
                bad.append("重なり:%s x %s" % (d['labels'][i]['t'], d['labels'][j]['t']))
    return bad


errors = []
rows = []
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    page.goto(URL)
    page.wait_for_timeout(900)
    probs = page.evaluate(JS_LIST)
    print('問題数:', len(probs))
    for p in probs:
        row = {'id': p['id'], 'ans': p['ans']}
        page.click('#ori-home-nada')
        page.wait_for_timeout(200)
        page.click('.ori-picker-item:has-text("%s")' % GROUP_LABEL[p['group']])
        page.wait_for_timeout(200)
        page.locator('.ori-picker-item:has-text("%s")' % p['name'].split('：')[0]).first.click()
        page.wait_for_timeout(1200)
        row['labels_before'] = audit(page.evaluate(JS_LABELS))
        page.screenshot(path='_out/shots/all_%s_before.png' % p['id'])
        for k in range(p['steps']):
            t = page.evaluate(JS_TARGET, k)
            page.mouse.move(t['now']['x'], t['now']['y'])
            page.mouse.down()
            for q in t['path'][1:]:
                page.mouse.move(min(max(q['x'], 2), 388), min(max(q['y'], 2), 842))
                page.wait_for_timeout(15)
            page.mouse.up()
            page.wait_for_timeout(1400)
        s = page.evaluate(JS_STATE)
        row['folded_all'] = (s['stepIndex'] == s['n'])
        row['verts'] = [[round(v, 4) for v in p3] for p3 in s['verts']]
        row['labels_after'] = audit(page.evaluate(JS_LABELS))
        page.screenshot(path='_out/shots/all_%s_after.png' % p['id'])
        inp = page.locator('#ori-answer-input')
        inp.click()
        for ch in p['ans']:
            if ch == '/':
                page.click('.ori-key-btn[data-ins="/"]')
            elif ch == 'と':
                page.click('.ori-key-btn[data-ins="と"]')
            else:
                page.keyboard.type(ch)
        page.wait_for_timeout(100)
        row['typed'] = inp.input_value()
        page.click('#ori-answer-submit')
        page.wait_for_timeout(350)
        res = page.locator('#ori-answer-result')
        txt = res.text_content().strip() if res.count() else ''
        row['correct'] = 'せいかい' in txt
        row['res'] = txt
        rows.append(row)
        page.click('#ori-fold-back')
        page.wait_for_timeout(200)
        page.click('#ori-picker-back')
        page.wait_for_timeout(200)
        page.click('#ori-picker-back')
        page.wait_for_timeout(200)
    br.close()

json.dump({'rows': rows, 'errors': errors}, open('_out/report_full.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(rows, open('_out/report.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
ng = 0
for r in rows:
    bad = r['labels_before'] + r['labels_after']
    flag = ('OK' if (r['folded_all'] and r['correct'] and not bad) else 'NG')
    if flag == 'NG':
        ng += 1
    print("%-3s %-28s 折り=%-5s 答え=%-5s(%s→%s) ラベル=%s" % (
        flag, r['id'], r['folded_all'], r['correct'], r['typed'], r['res'], bad if bad else 'OK'))
print('')
print('NG件数: %d / %d' % (ng, len(rows)))
print('エラー: %d' % len(errors))
for e in errors[:20]:
    print('  ', e)
