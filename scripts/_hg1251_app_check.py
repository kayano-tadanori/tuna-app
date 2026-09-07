# -*- coding: utf-8 -*-
u"""HG-1251（小5最レ No.14 大問1・六角形＝七進法）を、実際のアプリ画面で見る。
   図が出ているか／設問文の下に出ているか／答えが打てるかまで確かめる。
   （[[method_oton_local_preview]] [[feedback_zu_wa_setsumon_no_shita]]）
★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない
   （[[feedback_local_test_writes_cloud]]）。
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
OUT = os.path.join(BASE, "scripts", "_hg1251_appshots")
PORT = 8781
ANSWERS = ["6", "7", "49", "42", "300", "342"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


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
        pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
        pg.wait_for_timeout(500)
        pg.click('#screen-sansu-home .grade-btn[data-grade="5"]')
        pg.wait_for_timeout(800)
        pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="hama"]')
        pg.wait_for_timeout(1500)
        pg.evaluate("(async()=>{ sansuState.hamaCourse='sairei';"
                    " setHamaCurrent(5,'sairei',14); await renderHamaPanel(); })()")
        pg.wait_for_timeout(1200)
        btns = pg.evaluate("""()=>[...document.querySelectorAll('.hama-act-btn')]
            .filter(e=>!e.classList.contains('hidden') && !e.disabled)
            .map(e=>({key:e.dataset.hamaAct, txt:e.textContent.replace(/\\s+/g,' ').trim()}))""")
        print(u"じゅくナビの ボタン:", btns)
        # hd5s_14_1 は fukushu（復習テストの大問）に入っているので weekq を開く
        cand = [x for x in btns if x["key"] == "weekq"] or btns
        pg.click('.hama-act-btn[data-hama-act="%s"]' % cand[0]["key"])
        pg.wait_for_timeout(1200)
        items = pg.evaluate("""()=>[...document.querySelectorAll('.daimon-pick-item')]
            .map(e=>e.textContent.replace(/\\s+/g,' ').trim().slice(0,44))""")
        print(u"ピッカー:", items)
        idx = next((i for i, t in enumerate(items) if u"六角形" in t), -1)
        if idx < 0:
            print(u"★六角形の大問がピッカーに無い")
            b.close(); httpd.shutdown(); return 1
        pg.evaluate("(i)=>document.querySelectorAll('.daimon-pick-item')[i].click()", idx)
        pg.wait_for_timeout(1000)

        for n, ans in enumerate(ANSWERS):
            st = pg.evaluate("""()=>{
              const q=document.getElementById('sq-question');
              const fig=document.querySelector('#screen-sansu-quiz .fig, #screen-sansu-quiz svg');
              const qb=q?q.getBoundingClientRect():null, fb=fig?fig.getBoundingClientRect():null;
              return {q:q?q.textContent.trim():'', hasFig:!!fig,
                      figTop: fb?Math.round(fb.top):null, qTop: qb?Math.round(qb.top):null,
                      figW: fb?Math.round(fb.width):null,
                      numpad: !!document.getElementById('sq-numpad') &&
                              !document.getElementById('sq-numpad').classList.contains('hidden')};}""")
            below = (st["figTop"] is not None and st["qTop"] is not None
                     and st["figTop"] > st["qTop"])
            print(u"  (%d) 図=%s 幅=%s 設問の下=%s テンキー=%s | %s"
                  % (n + 1, st["hasFig"], st["figW"], below, st["numpad"], st["q"][:46]))
            if st["hasFig"] and st["figW"] and st["figW"] > 414:
                print(u"      ★図が画面幅(414px)からはみ出している")
                bad.append(u"(%d)はみ出し" % (n + 1))
            if st["hasFig"] and not below:
                print(u"      ★図が設問文より上に出ている")
                bad.append(u"(%d)図が上" % (n + 1))
            pg.screenshot(path=os.path.join(OUT, "q%d.png" % (n + 1)), full_page=True)
            for ch in ans:
                el = pg.locator('#sq-numpad [data-key="%s"]' % ch)
                if el.count() == 0 or not el.first.is_visible():
                    print(u"      ★テンキーに『%s』が無い" % ch)
                    bad.append(u"(%d)キー無し" % (n + 1))
                    break
                el.first.click()
                pg.wait_for_timeout(60)
            pg.click('#sq-numpad [data-key="submit"]')
            pg.wait_for_timeout(700)
            ok = pg.evaluate("""()=>{const f=document.getElementById('sq-feedback');
                return f?f.textContent.replace(/\\s+/g,' ').trim().slice(0,24):'';}""")
            print(u"      判定: %s" % ok)
            if u"せいかい" not in ok and u"正解" not in ok and u"〇" not in ok and u"○" not in ok:
                bad.append(u"(%d)不正解あつかい: %s" % (n + 1, ok))
            nxt = pg.locator("#sq-btn-next")
            if nxt.count() and nxt.first.is_visible():
                nxt.first.click()
                pg.wait_for_timeout(800)
        b.close()
    httpd.shutdown()
    print(u"\n" + (u"★ひっかかり: " + ", ".join(bad) if bad else u"✅ 6問すべて 図あり・打てる・〇"))
    print(u"->", OUT)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
