# -*- coding: utf-8 -*-
"""大問を実際に「解答して正誤が出るところ」まで通す実測テスト。
   テンキーの問題と4択の問題を1本ずつ、正解を入れて〇になるかを見る。"""
import io, os, sys, threading, http.server, socketserver, functools
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_g4b2_shots")
PORT = 8742
CASES = [("HG-4952", 14), ("HG-5002", 15), ("HG-5060", 16), ("HG-5168", 18),
         ("HG-5441", 23), ("HG-5501", 24), ("HG-5552", 25), ("HG-5617", 26),
         ("HG-5606", 26), ("HG-5727", 28)]


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

        for hg, no in CASES:
            found = pg.evaluate("""async (hg) => {
              for (let no = 14; no <= 28; no++) {
                const sets = await hamaDaimonBunsatsu(4, no);
                const one = sets.find(x => x.src === hg);
                if (one) {
                  sansuState.grade = 4;
                  startDaimonSets([one], 4, 'sansu', 'No.' + no, sets);
                  return no;
                }
              }
              return 0;
            }""", hg)
            if not found:
                print(hg, "見つからない"); continue
            pg.wait_for_timeout(900)
            st = pg.evaluate("""() => {
              const q = document.getElementById('sq-question');
              const box = document.getElementById('sq-choices');
              const ch = (box && !box.classList.contains('hidden'))
                ? [...box.querySelectorAll('button')].map(b => b.textContent.trim()) : [];
              return {q: q && q.textContent.trim(), choices: ch,
                      ans: (sansuState.questions[sansuState.current] || {}).answer};
            }""")
            ok = None
            if st["choices"]:
                clicked = pg.evaluate("""(ans) => {
                  const bs = [...document.querySelectorAll('#sq-choices button')].filter(x => x.offsetParent);
                  const b = bs.find(x => x.textContent.trim() === ans)
                         || bs.find(x => x.textContent.trim().includes(ans));
                  if (!b) return bs.map(x => x.textContent.trim());
                  b.click();
                  return true;
                }""", st["ans"])
                if clicked is not True:
                    print("  ⚠ 選択肢に答えが見つからない:", clicked)
            else:
                for c in st["ans"]:
                    key = {".": ".", "と": "mixedSep", "/": "frac"}.get(c, c)
                    pg.evaluate("""(k) => {
                      const b = document.querySelector(`#sq-numpad [data-key="${k}"]`);
                      if (b) b.click();
                    }""", key)
                pg.evaluate('document.querySelector(\'#sq-numpad [data-key="submit"]\').click()')
            pg.wait_for_timeout(700)
            ok = pg.evaluate("""() => {
              const fb = document.getElementById('sq-feedback');
              const t = document.getElementById('sq-feedback-text');
              const a = document.getElementById('sq-feedback-ans');
              if (!fb || fb.classList.contains('hidden')) return '（判定が出ていない）';
              return ((t && t.textContent) + ' / ' + (a && a.textContent)).trim().slice(0, 80);
            }""")
            pg.screenshot(path=os.path.join(OUT, "ans_%s.png" % hg))
            print("%s  答え=%r  選択肢=%d  → %r" % (hg, st["ans"], len(st["choices"]), ok))
            pg.evaluate("if (typeof showScreen==='function') showScreen('hama-home');")
            pg.wait_for_timeout(300)
        b.close()
    httpd.shutdown()
    print("JSエラー:", errs if errs else "なし")


if __name__ == "__main__":
    main()
