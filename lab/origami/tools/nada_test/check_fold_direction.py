# -*- coding: utf-8 -*-
"""全問の「折れる途中の向き」（山折り／谷折り）を機械で確かめる（作問ルール§12の自動化）。

180°の折り返しは**最終形が軸の符号に依らない**ので、完成形のスクショを見ても気づけない。
折っている最中だけが逆向きになる（紙が下へ潜る）。判定は数式でできる：

    軸u と「ヒンジ原点→つまむ点」v の外積のY成分  uz*vx - ux*vz
      正 … 谷折り（紙がまず+Y＝手前へ持ち上がる）  ←ふつうはこちら
      負 … 山折り
      0  … 紙面に垂直な軸で回す重ね合わせ問題（正しく0になる）

平行移動ヒンジ（hinge.slide）は回転しないので対象外。
値は core.js の flipProblemZ（zの反転）の前後で保たれるので、問題ファイルの座標のままで判定できる。
"""
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out', exist_ok=True)

from playwright.sync_api import sync_playwright   # noqa: E402

PORT = 8769
URL = 'http://localhost:%d/lab/origami/index.html' % PORT

JS = """() => Object.values(window.ORIGAMI_PROBLEMS).flatMap(p =>
  (p.steps || []).map((st, i) => {
    const h = p.mesh.hinge[st.handle.boneId];
    if (!h) return { id: p.id, step: i, kind: 'ヒンジ無し', v: 0 };
    if (h.slide) return { id: p.id, step: i, kind: '平行移動', v: 0 };
    const u = h.axis, o = h.origin, L = st.handle.local;
    const v = [L[0] - o[0], L[1] - o[1], L[2] - o[2]];
    return { id: p.id, step: i, kind: '回転', v: u[2] * v[0] - u[0] * v[2],
             spin: Math.abs(u[1]) > 0.9, target: st.targetAngle };
  }))"""

with sync_playwright() as pw:
    br = pw.chromium.launch()
    page = br.new_page()
    page.goto(URL)
    page.wait_for_timeout(1200)
    rows = page.evaluate(JS)
    br.close()

mountain = []
for r in rows:
    if r['kind'] != '回転':
        mark = '－'
    elif r.get('spin'):
        mark = 'OK ' if abs(r['v']) < 1e-6 else 'NG '     # 紙面に垂直な軸なら0のはず
    else:
        mark = '谷' if r['v'] > 0 else '山'
        if r['v'] < 0:
            mountain.append((r['id'], r['step']))
    print('%-3s %-30s step%d %-6s %+.4f' % (mark, r['id'], r['step'], r['kind'], r['v']))

print('')
print('符号がマイナス（＝紙がまず奥へ入る向き）:', mountain if mountain else 'なし')
print('')
print('【基準】2026-09-02時点で、マイナスは wayo_triangle_fold の1件だけ。')
print('       ここが増えていたら、その問題は「折る途中だけ」逆向きに動いている可能性が高い。')
print('       180°の折り返しは最終形が軸の符号に依らないので、スクショでは気づけない。')
