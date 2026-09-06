# -*- coding: utf-8 -*-
u"""小3最レ（刷新版）No.16 の全8大問22問を、実際のアプリ画面で 打ちこんで 〇が出るまで見る。
   （[[method_oton_local_preview]] [[feedback_nyuuryokusou_wa_betsu]]）
★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない
   （[[feedback_local_test_writes_cloud]]）。
使い方: python scripts/_no16_app_check.py
"""
import functools, http.server, io, os, socketserver, sys, threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_no16_appshots")
PORT = 8773

ANSWERS = [
    (u"面積の4つの公式", ["169", "350", "99", "54"]),
    (u"分ける／全体からひく", ["76", "125", "42"]),
    (u"対角線のわざ", ["55", "112", "53"]),
    (u"2まいの紙を重ねる", ["60", "12", "18"]),
    (u"面積が256cm", ["68"]),
    (u"つけたし", ["4.2", "12"]),
    (u"正六角形の面積を分数", ["6", "12", "2", "12"]),
    (u"面積図で計算", ["69", "2"]),
]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def type_answer(pg, ans, bad, tag):
    for ch in ans:
        key = {"/": "frac", u"と": "mixedSep"}.get(ch, ch)
        el = pg.locator('#sq-numpad [data-key="%s"]' % key)
        if el.count() == 0 or not el.first.is_visible():
            print(u"      ★テンキーに『%s』のキーが出ていない" % ch)
            bad.append(tag)
            return False
        el.first.click()
        pg.wait_for_timeout(70)
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
            pg.fill("#nickname-input", u"検証用claude")
            pg.click("#nickname-btn")
            pg.wait_for_timeout(1600)
        for sel in ("#gami-close", "#update-modal .btn-primary"):
            if pg.locator(sel).count() and pg.locator(sel).is_visible():
                pg.click(sel)
                pg.wait_for_timeout(400)
        pg.click('.subject-card[data-subject="sansu"]')
        pg.wait_for_timeout(700)

        def open_panel():
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(500)
            pg.click('#screen-sansu-home .grade-btn[data-grade="3"]')
            pg.wait_for_timeout(800)
            pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="hama"]')
            pg.wait_for_timeout(1500)
            pg.evaluate("(async()=>{ sansuState.hamaCourse='sairei_new';"
                        " setHamaCurrent(3,'sairei_new',16); await renderHamaPanel(); })()")
            pg.wait_for_timeout(1200)
            return pg.evaluate("""()=>[...document.querySelectorAll('.hama-act-btn')]
                .filter(e=>!e.classList.contains('hidden') && !e.disabled)
                .map(e=>({key:e.dataset.hamaAct, txt:e.textContent.replace(/\\s+/g,' ').trim()}))""")

        btns = open_panel()
        print(u"じゅくナビの ボタン:", btns)
        cand = [x for x in btns if u"宿題" in x["txt"]] or [x for x in btns if x["key"].endswith("q")]
        if not cand:
            print(u"★No.16 の 大問ボタンが出ない")
            b.close(); httpd.shutdown(); return
        pg.click('.hama-act-btn[data-hama-act="%s"]' % cand[0]["key"])
        pg.wait_for_timeout(1200)
        items = pg.evaluate("""()=>[...document.querySelectorAll('.daimon-pick-item')]
            .map(e=>e.textContent.replace(/\\s+/g,' ').trim().slice(0,44))""")
        print(u"\nピッカー %d 件:" % len(items))
        for i, t in enumerate(items):
            print("  %d) %s" % (i + 1, t))

        for di, (keyword, answers) in enumerate(ANSWERS):
            idx = next((i for i, t in enumerate(items) if keyword in t), -1)
            print(u"\n=== 大問%d [%s] -> %s" % (di + 1, keyword, items[idx] if idx >= 0 else u"★見つからない"))
            if idx < 0:
                bad.append(u"大問%d" % (di + 1))
                continue
            if di > 0:
                open_panel()
                pg.click('.hama-act-btn[data-hama-act="%s"]' % cand[0]["key"])
                pg.wait_for_timeout(1000)
            pg.evaluate("(i)=>document.querySelectorAll('.daimon-pick-item')[i].click()", idx)
            pg.wait_for_timeout(1000)
            for n, ans in enumerate(answers):
                tag = u"大問%d(%d)" % (di + 1, n + 1)
                st = pg.evaluate("""()=>({
                  q:(document.getElementById('sq-question')||{}).textContent,
                  choices:[...document.querySelectorAll('#sq-choices button')].map(b=>b.textContent.trim()),
                  numpad: !!document.getElementById('sq-numpad') &&
                          !document.getElementById('sq-numpad').classList.contains('hidden'),
                  svg: !!document.querySelector('#screen-sansu-quiz svg')})""")
                print(u"   (%d) 図=%s テンキー=%s 選択肢=%d  %s"
                      % (n + 1, st["svg"], st["numpad"], len(st["choices"]), (st["q"] or "").strip()[:50]))
                if not st["svg"]:
                    print(u"      ★図が出ていない")
                    bad.append(tag)
                pg.screenshot(path=os.path.join(OUT, "q_d%d_%d.png" % (di + 1, n + 1)))
                if st["choices"] and not st["numpad"]:
                    hit = pg.evaluate("""(a)=>{const bs=[...document.querySelectorAll('#sq-choices button')];
                        const t=bs.find(b=>b.textContent.trim()===a); if(!t) return false; t.click(); return true;}""", ans)
                    if not hit:
                        print(u"      ★選択肢に『%s』が無い（%s）" % (ans, st["choices"]))
                        bad.append(tag)
                        break
                elif not type_answer(pg, ans, bad, tag):
                    break
                pg.wait_for_timeout(1000)
                res = pg.evaluate("""()=>{const f=document.getElementById('sq-feedback');
                    return f? f.textContent.replace(/\\s+/g,' ').trim().slice(0,30):null;}""")
                pg.screenshot(path=os.path.join(OUT, "a_d%d_%d.png" % (di + 1, n + 1)))
                print(u"       『%s』→ %s" % (ans, res))
                if not res or u"正解" not in res:
                    print(u"       ★〇が出ていない")
                    bad.append(tag)
                if n + 1 < len(answers):
                    nx = pg.locator("#sq-btn-next")
                    if nx.count() and nx.first.is_visible():
                        nx.first.click()
                        pg.wait_for_timeout(800)
        b.close()
    httpd.shutdown()
    print(u"\nJSエラー:", [e for e in errs if "serviceWorker" not in e and "addEventListener" not in e
                          and "register" not in e] or u"なし（SW停止ぶんをのぞく）")
    print(u"問題のあったもの:", sorted(set(bad)) if bad else u"なし")
    print("->", OUT)


if __name__ == "__main__":
    main()
