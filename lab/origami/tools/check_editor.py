"""fold2d_editor.html が実際にブラウザで動くか、そして JS 版のCPが
   Python版(fold2d.py)とぴったり同じ答えを出すかを実測する。

★なぜ2つの実装を突き合わせるのか
   エディタのJSと fold2d.py は別々に書いたコード。同じ折り方をさせて
   同じ展開図が出れば、どちらかの写しまちがいをそこで捕まえられる。
   （[[feedback_verify_mechanism_not_just_answer]]：数値が出ただけで信用しない）
"""
import json, subprocess, sys, threading, http.server, socketserver, functools, os, time
from pathlib import Path

HERE = Path(__file__).parent
PORT = 8977

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HERE))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

# ---- Python側で同じ折りをして期待値を作る ----
sys.path.insert(0, str(HERE))
from fold2d import FoldState
import cp_export

def python_blintz():
    st = FoldState(1.0)
    for c in [(1,1), (-1,1), (-1,-1), (1,-1)]:
        st.fold_by_points(c, (0,0), 'V')
    return st

def norm_cp(cp):
    out = []
    for c in cp:
        a = (round(c['a'][0], 7)+0.0, round(c['a'][1], 7)+0.0)
        b = (round(c['b'][0], 7)+0.0, round(c['b'][1], 7)+0.0)
        if b < a: a, b = b, a
        out.append((a, b, c['kind']))
    return sorted(out)

def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    ok_all = True
    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={'width': 1500, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console.'+m.type+': '+m.text)
              if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{PORT}/fold2d_editor.html')
        pg.wait_for_timeout(400)
        check('ページが開く（エラー0件）', len(errs) == 0, str(errs[:3]))

        # --- 座布団折りをJS側で実行 ---
        js_cp = pg.evaluate("""() => {
          const L = window.LAB;
          L.clearSel();
          for (const c of [[1,1],[-1,1],[-1,-1],[1,-1]]){
            L.clearSel(); L.select(c); L.select([0,0]); L.doFold('V', true);
          }
          const st = L.st;
          return {cp: st.creasePattern(), panels: st.panels.length,
                  fold: L.toFold(st,'')};
        }""")
        pst = python_blintz()
        check('座布団折り: パネル枚数が Python と一致（5枚）',
              js_cp['panels'] == len(pst.panels) == 5,
              f"js={js_cp['panels']} py={len(pst.panels)}")
        jn = norm_cp(js_cp['cp'])
        pn = norm_cp(pst.crease_pattern())
        check('座布団折り: 展開図が Python と一字一句一致', jn == pn,
              f'js={jn}\n     py={pn}')

        pf = cp_export.state_to_fold(pst)
        jf = js_cp['fold']
        check('FOLD: 頂点数が一致',
              len(jf['vertices_coords']) == len(pf['vertices_coords']) == 8,
              f"js={len(jf['vertices_coords'])} py={len(pf['vertices_coords'])}")
        check('FOLD: 辺の数が一致',
              len(jf['edges_vertices']) == len(pf['edges_vertices']),
              f"js={len(jf['edges_vertices'])} py={len(pf['edges_vertices'])}")
        check('FOLD: 面の数が一致（5面）',
              len(jf['faces_vertices']) == len(pf['faces_vertices']) == 5,
              f"js={len(jf['faces_vertices'])} py={len(pf['faces_vertices'])}")
        check('FOLD: 山谷の割り当ての中身が一致',
              sorted(jf['edges_assignment']) == sorted(pf['edges_assignment']),
              f"js={sorted(jf['edges_assignment'])}")
        pg.screenshot(path=str(HERE / 'preview' / 'editor_blintz.png'))

        # --- 裏返し→谷折りが、展開図では山折りになるか（JS側） ---
        r2 = pg.evaluate("""() => {
          const L = window.LAB;
          document.getElementById('paperSel').value='1,1';
          newPaper();
          L.doFlip('v');
          L.clearSel(); L.select([-1,-1]); L.select([1,-1]); L.doFold('V', true);
          return L.st.creasePattern();
        }""")
        check('裏返して谷折り → 展開図では山折り（JS）',
              len(r2) == 1 and r2[0]['kind'] == 'M',
              json.dumps(r2))

        # --- 折り目だけ（precrease）で紙が動かないか（JS側） ---
        r3 = pg.evaluate("""() => {
          const L = window.LAB;
          newPaper();
          L.clearSel(); L.select([-1,-1]); L.select([1,1]); L.doFold('M', false);
          const st=L.st;
          let area=0; for (const p of st.panels) area+=Math.abs(L.polyArea(p.poly));
          return {panels: st.panels.length, area, cp: st.creasePattern().length};
        }""")
        check('折り目だけ: 面積が変わらない(4.0)', abs(r3['area']-4.0) < 1e-9,
              f"{r3['area']}")
        check('折り目だけ: パネルが2枚に割れる', r3['panels'] == 2, str(r3['panels']))
        check('折り目だけ: 折り筋が1本記録される', r3['cp'] == 1, str(r3['cp']))
        pg.screenshot(path=str(HERE / 'preview' / 'editor_precrease.png'))

        # --- 4つ折り（重なった2枚を一度に折る）が Python と一致するか ---
        r4 = pg.evaluate("""() => {
          const L = window.LAB;
          newPaper();
          L.clearSel(); L.select([-1,-1]); L.select([1,-1]); L.doFold('V', true);
          L.clearSel(); L.select([1,-1]); L.select([0,-1]); L.doFold('V', true);
          return L.st.creasePattern();
        }""")
        st2 = FoldState(1.0)
        st2.fold_by_points((-1,-1), (1,-1), 'V')
        st2.fold_by_points((1,-1), (0,-1), 'V')
        check('4つ折り: 展開図が Python と一致',
              norm_cp(r4) == norm_cp(st2.crease_pattern()),
              f'js={norm_cp(r4)}\n     py={norm_cp(st2.crease_pattern())}')
        pg.screenshot(path=str(HERE / 'preview' / 'editor_quarter.png'))

        check('最後までコンソールエラー0件', len(errs) == 0, str(errs[:3]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1

if __name__ == '__main__':
    sys.exit(main())
