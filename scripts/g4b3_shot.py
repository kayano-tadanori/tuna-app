# -*- coding: utf-8 -*-
"""小4マスター算数 第3分冊（No.29〜43）の大問を、実際のアプリ画面で目視確認する
   （method_oton_local_preview／feedback_local_test_writes_cloud）。

★ニックネームは入れない＋Firestoreへの通信を落とすので、本番ランキングには何も書かない。
使い方: python scripts/g4b3_shot.py [回番号 ...]   （既定 29 30 31 32 35 38 41 43）
"""
import io, os, sys, threading, http.server, socketserver, functools

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_g4b3_shots")
PORT = 8751

NOS = [int(x) for x in sys.argv[1:]] or [29, 30, 31, 32, 35, 38, 41, 43]


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    httpd = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 414, "height": 896})
        # ☠ 本番クラウドに書かない（feedback_local_test_writes_cloud）
        # 本番クラウドへの読み書きだけを落とす（SDK本体は読ませないとページが動かない）
        pg.route("**/*", lambda r: r.abort()
                 if ("firestore.googleapis.com" in r.request.url
                     or "firebaseio.com" in r.request.url) else r.continue_())
        # サービスワーカーは目視確認のじゃま（更新でページを読み直す）ので止める
        pg.add_init_script("Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined});")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/index.html" % PORT)
        pg.wait_for_function("typeof hamaDaimonBunsatsu === 'function'", timeout=30000)
        pg.wait_for_timeout(800)
        print("JSエラー(読み込み時):", errs[:3] if errs else "なし")

        for no in NOS:
            n = pg.evaluate("""async (no) => {
              const sets = await hamaDaimonBunsatsu(4, no);
              if (!sets.length) return 0;
              openDaimonPicker(sets, 4, 'sansu', 'No.' + no + '・今週の宿題');
              return sets.length;
            }""", no)
            pg.wait_for_timeout(400)
            pg.screenshot(path=os.path.join(OUT, "no%02d_picker.png" % no))
            print("No.%d 大問%d本 → ピッカー撮影" % (no, n))
            # 1本目を開いて、問題文・図・入力欄まで出るか見る
            pg.evaluate("document.querySelector('.daimon-pick-item').click()")
            pg.wait_for_timeout(800)
            pg.screenshot(path=os.path.join(OUT, "no%02d_q1.png" % no))
            info = pg.evaluate("""() => {
              const q = document.getElementById('sq-question');
              const fig = document.getElementById('sq-figure');
              const ch = document.querySelectorAll('#sq-choices button');
              const np = document.getElementById('sq-numpad');
              return {q: q ? q.textContent.trim().slice(0,80) : null,
                      fig: fig ? fig.innerHTML.length : 0,
                      choices: ch.length,
                      numpad: np ? !np.classList.contains('hidden') : false};
            }""")
            print("   ", info)
            pg.evaluate("if (typeof showScreen==='function') showScreen('hama-home');")
            pg.wait_for_timeout(300)
        b.close()
    httpd.shutdown()
    print("JSエラー:", errs if errs else "なし")
    print("→", OUT)


if __name__ == "__main__":
    main()
