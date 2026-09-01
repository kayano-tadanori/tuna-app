# -*- coding: utf-8 -*-
"""小5最レ 第1・2分冊の大問を、実際に解答して〇が出るところまで通す実測テスト。
   答えの「形」ごとに1つずつ（feedback_nyuuryokusou_wa_betsu）。
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
PORT = 8759

# (HG番号, その大問の何問目か)。答えの形をひととおり／手作業の4択を全部ふくめる
CASES = [
    ("HG-6563", 0), ("HG-6563", 4),     # 整数 ／ あまり
    ("HG-6598", 0),                     # 小数
    ("HG-6599", 2), ("HG-6599", 0),     # 分数 ／ 帯分数
    ("HG-6569", 0),                     # 循環小数→分数
    ("HG-6695", 0),                     # 時計算（分が帯分数）
    ("HG-6662", 0), ("HG-6662", 13),    # N進法（手作業・20問）
    ("HG-6666", 2), ("HG-6703", 1), ("HG-6717", 0),
    ("HG-6719", 0), ("HG-6973", 0), ("HG-7096", 0), ("HG-7096", 1),
    ("HG-7056", 0),                     # 手作業ぶん（4択・テンキー）
    ("HG-6582", 0),                     # 虫食い算
    ("HG-6842", 0), ("HG-6753", 1), ("HG-6708", 0), ("HG-6972", 0),
    ("HG-6856", 7), ("HG-6798", 0), ("HG-7146", 2),   # 図つき／記号4択／比例式／逆比／連比
    ("HG-6787", 4), ("HG-6746", 0), ("HG-6722", 1), ("HG-6595", 0),
    ("HG-6602", 2), ("HG-6634", 0), ("HG-6737", 0), ("HG-6738", 0),
]


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
    ng = 0
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 414, "height": 896})
        pg.route("**/*", lambda r: r.abort()
                 if ("firestore.googleapis.com" in r.request.url
                     or "firebaseio.com" in r.request.url) else r.continue_())
        pg.add_init_script("Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined});")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/index.html" % PORT)
        pg.wait_for_function("typeof hamaDaimonKouza === 'function'", timeout=30000)
        pg.wait_for_timeout(800)

        for hg, idx in CASES:
            found = pg.evaluate("""async (hg) => {
              for (const kou of [1, 2]) {
                for (let no = 1; no <= 20; no++) {
                  const sets = await hamaDaimonKouza(5, 'sairei', kou, no);
                  const one = sets.find(x => x.hg === hg);
                  if (one) {
                    sansuState.grade = 5;
                    startDaimonSets([one], 5, 'sansu', 'No.' + no, sets);
                    return {kou: kou, no: no};
                  }
                }
              }
              return null;
            }""", hg)
            if not found:
                print("%s  ✗ 見つからない" % hg)
                ng += 1
                continue
            pg.wait_for_timeout(700)
            # 目あての小問まで進める（前の小問は正解を入れて送る）
            for _ in range(idx):
                st = pg.evaluate("""() => {
                  const box = document.getElementById('sq-choices');
                  const ch = (box && !box.classList.contains('hidden'))
                    ? [...box.querySelectorAll('button')].map(x => x.textContent.trim()) : [];
                  return {ans: (sansuState.questions[sansuState.current] || {}).answer, choices: ch};
                }""")
                _answer(pg, st)
                pg.wait_for_timeout(450)
                pg.evaluate("""() => {
                  const n = document.getElementById('sq-btn-next');
                  if (n) n.click();
                }""")
                pg.wait_for_timeout(450)
            st = pg.evaluate("""() => {
              const q = document.getElementById('sq-question');
              const box = document.getElementById('sq-choices');
              const ch = (box && !box.classList.contains('hidden'))
                ? [...box.querySelectorAll('button')].map(x => x.textContent.trim()) : [];
              return {q: q && q.textContent.trim().slice(0, 60), choices: ch,
                      ans: (sansuState.questions[sansuState.current] || {}).answer};
            }""")
            _answer(pg, st)
            pg.wait_for_timeout(700)
            fb = pg.evaluate("""() => {
              const f = document.getElementById('sq-feedback');
              const t = document.getElementById('sq-feedback-text');
              if (!f || f.classList.contains('hidden')) return '（判定が出ていない）';
              return (t && t.textContent || '').trim().slice(0, 30);
            }""")
            mark = "○" if "正解" in fb and "不正解" not in fb else "✗"
            if mark == "✗":
                ng += 1
                pg.screenshot(path=os.path.join(OUT, "ng_%s_%d.png" % (hg, idx)))
            print("%s (%d問目) 答=%r 4択=%d → %s %s" %
                  (hg, idx + 1, st["ans"], len(st["choices"]), mark, fb))
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(300)
        b.close()
    httpd.shutdown()
    print("\nJSエラー:", errs if errs else "なし")
    print("通らなかったもの: %d件" % ng)
    return 1 if ng else 0


def _answer(pg, st):
    if st["choices"]:
        pg.evaluate("""(ans) => {
          const bs = [...document.querySelectorAll('#sq-choices button')].filter(x => x.offsetParent);
          const b = bs.find(x => x.textContent.trim() === ans);
          if (b) b.click();
        }""", st["ans"])
        return
    for c in (st["ans"] or ""):
        key = {".": ".", "と": "mixedSep", "/": "frac", "余": "rem"}.get(c, c)
        if c == "り":
            continue
        pg.evaluate("""(k) => {
          const b = document.querySelector(`#sq-numpad [data-key="${k}"]`);
          if (b) b.click();
        }""", key)
    pg.evaluate('document.querySelector(\'#sq-numpad [data-key="submit"]\').click()')


if __name__ == "__main__":
    sys.exit(main())
