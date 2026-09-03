# -*- coding: utf-8 -*-
"""作品を本物のアプリで最後まで折って、その姿をスクショに残す。
   （[[method_oton_local_preview]]：「できた」と言う前に目で見る。
     works_build.py が出す preview/work_*.png は2Dの絵で、
     アプリの3D・重なり・紙の色までは見えないので、これが要る）

   使い方:  python shot_works.py            … 全作品
            python shot_works.py buta heart … その作品だけ
   出力:    preview/done_<id>.png
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 8981
from kit import target_works


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main(names):
    from playwright.sync_api import sync_playwright
    httpd = serve()
    ok = True
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 900, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(700)
        for w in names:
            errs.clear()
            pg.evaluate("(id) => window._origamiDebug.openFold('work', window.ORIGAMI_WORKS[id])", w)
            pg.wait_for_timeout(400)
            # 全ステップを目標角度まで進める（実際に指で折ったのと同じ状態にする）
            fin = pg.evaluate("""() => {
              const inst = window._origamiDebug.inst;
              const st = inst.state, work = st.work;
              work.steps.forEach((s) => {
                st.committedAngle[s.handle.boneId] = s.targetAngle;
                st.liveAngle[s.handle.boneId] = s.targetAngle;
                (s.handle.linkedBoneIds || []).forEach(b => {
                  st.committedAngle[b] = s.targetAngle;
                  st.liveAngle[b] = s.targetAngle;
                });
                st.doneSteps = (st.doneSteps || 0) + 1;
              });
              st.stepIndex = work.steps.length;
              return FOLD.isFinished(st);
            }""")
            pg.wait_for_timeout(700)
            pg.screenshot(path=str(HERE / 'preview' / f'done_{w}.png'))
            good = fin is True and not errs
            ok = ok and good
            print(('OK  ' if good else 'NG  ') + f'{w}: 折り終わりを撮った'
                  + ('' if good else f'  … 完成={fin} エラー={errs[:1]}'))
        br.close()
    httpd.shutdown()
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or target_works()))
