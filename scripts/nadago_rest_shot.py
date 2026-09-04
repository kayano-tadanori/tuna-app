# -*- coding: utf-8 -*-
"""「要現物照合」を解いて足した3本を、実際のアプリ画面で目視＋打ちこみ確認する。
   （method_oton_local_preview／feedback_local_test_writes_cloud／feedback_nyuuryokusou_wa_betsu）
★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない。
★小問ごとに正解を打ちこんで〇が出るまで見る。「7と1/3」は「と」キー→「╱ 分数」キーの順に使う。
使い方: python scripts/nadago_rest_shot.py
"""
import functools, http.server, io, os, socketserver, sys, threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_nadago_rest_shots")
PORT = 8768
# (学年, 回, id, ピッカーで探す語, 小問の答え)
WANT = [(4, 11, "hd4n_11_11", "とりはずす", ["96", "5", "106"]),
        (5, 1, "hd5n_01_2", "立方体3つ", ["5", "20"]),
        (5, 6, "hd5n_06_19", "正三角形と六角形", ["6", "3", "4", "7と1/3"])]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def type_answer(pg, ans, bad, rid):
    for ch in ans:
        key = {"/": "frac", "と": "mixedSep"}.get(ch, ch)   # ╱分数キー・帯分数の「と」キー
        sel = '#sq-numpad [data-key="%s"]' % key
        el = pg.locator(sel)
        if el.count() == 0 or not el.first.is_visible():
            print("      ★テンキーに『%s』のキーが出ていない" % ch)
            bad.append(rid)
            return False
        el.first.click()
        pg.wait_for_timeout(90)
    pg.click('#sq-numpad [data-key="submit"]')
    return True


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    httpd = serve()
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 414, "height": 896})
        pg.route("**/*", lambda r: r.abort()
                 if ("firestore.googleapis.com" in r.request.url or "firebaseio.com" in r.request.url)
                 else r.continue_())
        pg.add_init_script("Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined});")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/index.html" % PORT)
        pg.wait_for_timeout(1400)
        if pg.locator("#nickname-input").count():
            pg.fill("#nickname-input", "検証用claude")
            pg.click("#nickname-btn")
            pg.wait_for_timeout(1600)
        for sel in ("#gami-close", "#update-modal .btn-primary"):
            if pg.locator(sel).count() and pg.locator(sel).is_visible():
                pg.click(sel)
                pg.wait_for_timeout(400)
        pg.click('.subject-card[data-subject="sansu"]')
        pg.wait_for_timeout(700)

        def open_picker(grade, no):
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(500)
            pg.click('#screen-sansu-home .grade-btn[data-grade="%d"]' % grade)
            pg.wait_for_timeout(800)
            pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="nadago"]')
            pg.wait_for_timeout(1500)
            pg.evaluate("(async(g,n)=>{ setHamaCurrent(g,'nadago',n); await renderHamaPanel(); })(%d,%d)"
                        % (grade, no))
            pg.wait_for_timeout(1000)
            key = pg.evaluate("""()=>{const b=[...document.querySelectorAll('.hama-act-btn')]
                .filter(e=>!e.classList.contains('hidden') && !e.disabled && e.dataset.hamaAct.endsWith('q'));
                return b.length? b[0].dataset.hamaAct : null;}""")
            if not key:
                return False
            pg.click('.hama-act-btn[data-hama-act="%s"]' % key)
            pg.wait_for_timeout(1100)
            return True

        for grade, no, rid, keyword, answers in WANT:
            if not open_picker(grade, no):
                print("★小%d灘合 第%d回 の大問ボタンが出ない" % (grade, no))
                bad.append(rid)
                continue
            items = pg.evaluate("""()=>[...document.querySelectorAll('.daimon-pick-item')]
                .map(e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,40))""")
            idx = next((i for i, t in enumerate(items) if keyword in t), -1)
            print("\n[%s] 小%d灘合 第%d回（ピッカー%d件） -> %s"
                  % (rid, grade, no, len(items), items[idx] if idx >= 0 else "★見つからない"))
            if idx < 0:
                bad.append(rid)
                continue
            pg.evaluate("(i)=>document.querySelectorAll('.daimon-pick-item')[i].click()", idx)
            pg.wait_for_timeout(1000)
            for n, ans in enumerate(answers):
                st = pg.evaluate("""()=>({
                  q:(document.getElementById('sq-question')||{}).textContent,
                  choices:[...document.querySelectorAll('#sq-choices button')].map(b=>b.textContent.trim()),
                  numpad: !!document.getElementById('sq-numpad') &&
                          !document.getElementById('sq-numpad').classList.contains('hidden'),
                  svg: !!document.querySelector('#screen-sansu-quiz svg')})""")
                print("   (%d) 図=%s テンキー=%s  設問: %s"
                      % (n + 1, st["svg"], st["numpad"], (st["q"] or "").strip()[:56]))
                pg.screenshot(path=os.path.join(OUT, "q_%s_%d.png" % (rid, n + 1)))
                if st["choices"] and not st["numpad"]:
                    hit = pg.evaluate("""(a)=>{const bs=[...document.querySelectorAll('#sq-choices button')];
                        const t=bs.find(b=>b.textContent.trim()===a); if(!t) return false; t.click(); return true;}""", ans)
                    if not hit:
                        print("      ★選択肢に『%s』が無い" % ans)
                        bad.append(rid)
                        break
                elif not type_answer(pg, ans, bad, rid):
                    break
                pg.wait_for_timeout(1100)
                res = pg.evaluate("""()=>{const f=document.getElementById('sq-feedback');
                    return f? f.textContent.replace(/\s+/g,' ').trim().slice(0,26):null;}""")
                pg.screenshot(path=os.path.join(OUT, "a_%s_%d.png" % (rid, n + 1)))
                print("       『%s』を打った → %s" % (ans, res))
                if not res or "正解" not in res:
                    print("       ★〇が出ていない")
                    bad.append(rid)
                if n + 1 < len(answers):
                    nx = pg.locator("#sq-btn-next")
                    if nx.count() and nx.first.is_visible():
                        nx.first.click()
                        pg.wait_for_timeout(900)
        b.close()
    httpd.shutdown()
    print("\nJSエラー:", [e for e in errs if "serviceWorker" not in e and "addEventListener" not in e
                          and "register" not in e] or "なし（SW停止ぶんをのぞく）")
    print("問題のあったもの:", sorted(set(bad)) if bad else "なし")
    print("→", OUT)


if __name__ == "__main__":
    main()
