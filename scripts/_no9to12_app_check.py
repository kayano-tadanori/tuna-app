# -*- coding: utf-8 -*-
u"""小3最レ（刷新版）No.9〜12（全34大問87問）を、実際のアプリ画面で 打ちこんで 〇が出るまで見る。
   （[[method_oton_local_preview]]）
★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない
   （[[feedback_local_test_writes_cloud]]）。
使い方: python scripts/_no9to12_app_check.py
"""
import functools, http.server, io, json, os, socketserver, sys, threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_no9to12_appshots")
PORT = 8774


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
        pg.wait_for_timeout(60)
    pg.click('#sq-numpad [data-key="submit"]')
    return True


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    httpd = serve()
    bad = []

    d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))
    fukushu = d["grades"]["3"]["sairei_new_bunsatsu"]["fukushu"]

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

        def open_panel(no):
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(400)
            pg.click('#screen-sansu-home .grade-btn[data-grade="3"]')
            pg.wait_for_timeout(700)
            pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="hama"]')
            pg.wait_for_timeout(1200)
            pg.evaluate("(async(n)=>{ sansuState.hamaCourse='sairei_new';"
                        " setHamaCurrent(3,'sairei_new',n); await renderHamaPanel(); })(%d)" % no)
            pg.wait_for_timeout(1000)
            return pg.evaluate("""()=>[...document.querySelectorAll('.hama-act-btn')]
                .filter(e=>!e.classList.contains('hidden') && !e.disabled)
                .map(e=>({key:e.dataset.hamaAct, txt:e.textContent.replace(/\\s+/g,' ').trim()}))""")

        total_ok = 0
        for no in [9, 10, 11, 12]:
            recs = fukushu[str(no)]
            btns = open_panel(no)
            cand = [x for x in btns if u"宿題" in x["txt"]] or [x for x in btns if x["key"].endswith("q")]
            if not cand:
                print(u"★No.%d の大問ボタンが出ない" % no)
                bad.append("No.%d" % no)
                continue
            pg.click('.hama-act-btn[data-hama-act="%s"]' % cand[0]["key"])
            pg.wait_for_timeout(1000)
            items = pg.evaluate("""()=>[...document.querySelectorAll('.daimon-pick-item')]
                .map(e=>e.textContent.replace(/\\s+/g,' ').trim())""")
            print(u"\n==== No.%d（ピッカー%d件・原簿%d件） ====" % (no, len(items), len(recs)))
            if len(items) != len(recs):
                print(u"   ★件数不一致！")
                bad.append("No.%d件数" % no)

            for di, r in enumerate(recs):
                idx = next((i for i, t in enumerate(items) if r["title"][:8] in t), di if di < len(items) else -1)
                if idx < 0:
                    print(u"   大問%d [%s] ★見つからない" % (di + 1, r["title"]))
                    bad.append("No.%d-%d" % (no, di + 1))
                    continue
                if di > 0:
                    open_panel(no)
                    pg.click('.hama-act-btn[data-hama-act="%s"]' % cand[0]["key"])
                    pg.wait_for_timeout(800)
                pg.evaluate("(i)=>document.querySelectorAll('.daimon-pick-item')[i].click()", idx)
                pg.wait_for_timeout(800)
                for n, step in enumerate(r["steps"]):
                    tag = "No.%d-%d(%d)" % (no, di + 1, n + 1)
                    st_info = pg.evaluate("""()=>({
                      choices:[...document.querySelectorAll('#sq-choices button')].map(b=>b.textContent.trim()),
                      numpad: !!document.getElementById('sq-numpad') &&
                              !document.getElementById('sq-numpad').classList.contains('hidden')})""")
                    ans = step["answer"]
                    if st_info["choices"] and not st_info["numpad"]:
                        hit = pg.evaluate("""(a)=>{const bs=[...document.querySelectorAll('#sq-choices button')];
                            const t=bs.find(b=>b.textContent.trim()===a); if(!t) return false; t.click(); return true;}""", ans)
                        if not hit:
                            print(u"   %s ★選択肢に『%s』が無い（%s）" % (tag, ans, st_info["choices"]))
                            bad.append(tag)
                            break
                    elif not type_answer(pg, ans, bad, tag):
                        break
                    pg.wait_for_timeout(700)
                    res = pg.evaluate("""()=>{const f=document.getElementById('sq-feedback');
                        return f? f.textContent.replace(/\\s+/g,' ').trim().slice(0,20):null;}""")
                    if not res or u"正解" not in res:
                        print(u"   %s ★〇が出ていない（打った答え:%s → %s）" % (tag, ans, res))
                        bad.append(tag)
                    else:
                        total_ok += 1
                    if n + 1 < len(r["steps"]):
                        nx = pg.locator("#sq-btn-next")
                        if nx.count() and nx.first.is_visible():
                            nx.first.click()
                            pg.wait_for_timeout(600)
            print(u"   No.%d 完了" % no)
        b.close()
    httpd.shutdown()
    print(u"\n正解した数:", total_ok)
    print(u"JSエラー:", [e for e in errs if "serviceWorker" not in e and "addEventListener" not in e
                        and "register" not in e] or u"なし（SW停止ぶんをのぞく）")
    print(u"問題のあったもの:", sorted(set(bad)) if bad else u"なし")


if __name__ == "__main__":
    main()
