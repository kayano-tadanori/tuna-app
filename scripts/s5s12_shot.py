# -*- coding: utf-8 -*-
"""小5最レ 第1・2分冊の宿題（大問）を、実際のアプリ画面で目視確認する
   （method_oton_local_preview／feedback_local_test_writes_cloud）。

★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない。
使い方: python scripts/s5s12_shot.py [回番号 ...]   （既定 1 5 12 19）
"""
import functools
import http.server
import io
import os
import socketserver
import sys
import threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_s5s12_shots")
PORT = 8757
NOS = [int(x) for x in sys.argv[1:]] or [1, 5, 12, 19]


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
        pg.route("**/*", lambda r: r.abort()
                 if ("firestore.googleapis.com" in r.request.url
                     or "firebaseio.com" in r.request.url) else r.continue_())
        pg.add_init_script("Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined});")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/index.html" % PORT)
        pg.wait_for_timeout(1200)

        # ログイン（実在しない検証用の名前・クラウドは遮断ずみ）
        if pg.locator("#nickname-input").count():
            pg.fill("#nickname-input", "検証用claude")
            pg.click("#nickname-btn")
            pg.wait_for_timeout(1500)
        for sel in ("#gami-close", "#update-modal .btn-primary"):
            if pg.locator(sel).count() and pg.locator(sel).is_visible():
                pg.click(sel)
                pg.wait_for_timeout(400)

        # 算数 → 小5 → じゅくナビ → 最レ
        pg.click('.subject-card[data-subject="sansu"]')
        pg.wait_for_timeout(600)
        pg.click('#screen-sansu-home .grade-btn[data-grade="5"]')
        pg.wait_for_timeout(600)
        pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="hama"]')
        pg.wait_for_timeout(900)
        pg.click('#hama-course-row [data-hama-course="sairei"]')
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, "00_course.png"))

        for no in NOS:
            pg.evaluate("""async (no) => {
              setHamaCurrent(5, 'sairei', no);
              await renderHamaPanel();
            }""", no)
            pg.wait_for_timeout(700)
            info = pg.evaluate("""() => {
              const g = (k) => {
                const b = document.querySelector(`.hama-act-btn[data-hama-act="${k}"]`);
                if (!b || b.classList.contains('hidden')) return null;
                return {name: b.querySelector('.hama-act-name').textContent.trim(),
                        sub: b.querySelector('.hama-act-sub').textContent.trim(),
                        disabled: b.disabled};
              };
              return {title: document.getElementById('hama-no-title').textContent.trim(),
                      k1: g('kouza1q'), k2: g('kouza2q')};
            }""")
            print("No.%-2d 回タイトル=%s" % (no, info["title"]))
            print("      第1講座:", info["k1"])
            print("      第2講座:", info["k2"])
            pg.screenshot(path=os.path.join(OUT, "no%02d_panel.png" % no))

            # 第1講座を開いて、大問ピッカー → 1本目 → 正解を打ちこむ
            btn = pg.locator('.hama-act-btn[data-hama-act="kouza1q"]')
            if btn.is_disabled():
                print("      （第1講座はデータなし・とばす）")
                pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
                pg.wait_for_timeout(400)
                continue
            btn.click()
            pg.wait_for_timeout(800)
            pg.screenshot(path=os.path.join(OUT, "no%02d_picker.png" % no))
            pg.evaluate("document.querySelector('.daimon-pick-item').click()")
            pg.wait_for_timeout(900)
            pg.screenshot(path=os.path.join(OUT, "no%02d_q1.png" % no))
            st = pg.evaluate("""() => {
              const q = document.getElementById('sq-question');
              const ch = document.querySelectorAll('#sq-choices button');
              const np = document.getElementById('sq-numpad');
              const intro = document.getElementById('sq-chain-intro');
              return {intro: intro ? intro.textContent.trim().slice(0,60) : null,
                      q: q ? q.textContent.trim().slice(0,70) : null,
                      choices: ch.length,
                      numpad: np ? !np.classList.contains('hidden') : false,
                      answer: (typeof sansuState !== 'undefined' && sansuState.current)
                              ? sansuState.current.answer : null};
            }""")
            print("      1問目:", st)
            # じゅくナビの画面に戻す（次の回へ進むため）
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(500)
        b.close()
    httpd.shutdown()
    print("\nJSエラー:", errs if errs else "なし")
    print("→", OUT)


if __name__ == "__main__":
    main()
