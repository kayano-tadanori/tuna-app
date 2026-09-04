# -*- coding: utf-8 -*-
"""小4灘合 第5回に足した7本（大問1・2・3・6・7・8・9）を、実際のアプリ画面で目視＋打ちこみ確認する。
   （method_oton_local_preview／feedback_local_test_writes_cloud／feedback_nyuuryokusou_wa_betsu）

★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない。
★「形が正しい」と「実際に打てる」は別。小問ごとに正解を打ちこんで〇が出るまで見る。
  分数（1/12・1/9）は テンキーの「╱ 分数」キーを押してから分母を打つ。
使い方: python scripts/g4n05_shot.py
"""
import functools, http.server, io, os, socketserver, sys, threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_g4n05_shots")
PORT = 8765
WANT = [("hd4n_05_2", "角を切り取った", ["12", "14", "24"]),
        ("hd4n_05_3", "透明な小箱", ["4"]),
        ("hd4n_05_4", "正面図と真上図", ["17", "29"]),
        ("hd4n_05_5", "正八面体の展開図", ["C", "F"]),
        ("hd4n_05_6", "外側の和が45", ["3"]),
        ("hd4n_05_7", "道の上でサイコロ", ["2", "1"]),
        ("hd4n_05_8", "12本の針", ["26"])]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):      # アクセスログを黙らせる（確認結果が埋もれるため）
        pass


def serve():
    h = functools.partial(Quiet, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def type_answer(pg, ans, bad, rid):
    """テンキーに答えを打ちこむ。'/' は分数キー。"""
    for ch in ans:
        sel = '#sq-numpad [data-key="frac"]' if ch == "/" else '#sq-numpad [data-key="%s"]' % ch
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
        # ☠ 本番クラウドに書かない
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

        def open_picker(first=False):
            if first:
                pg.click('.subject-card[data-subject="sansu"]')
                pg.wait_for_timeout(700)
                pg.click('#screen-sansu-home .grade-btn[data-grade="4"]')
                pg.wait_for_timeout(700)
            pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="nadago"]')
            pg.wait_for_timeout(1600)
            pg.evaluate("(async()=>{ setHamaCurrent(4,'nadago',5); await renderHamaPanel(); })()")
            pg.wait_for_timeout(1000)
            key = pg.evaluate("""()=>{const b=[...document.querySelectorAll('.hama-act-btn')]
                .filter(e=>!e.classList.contains('hidden') && !e.disabled && e.dataset.hamaAct.endsWith('q'));
                return b.length? b[0].dataset.hamaAct : null;}""")
            pg.click('.hama-act-btn[data-hama-act="%s"]' % key)
            pg.wait_for_timeout(1100)

        open_picker(first=True)
        items = pg.evaluate("""()=>[...document.querySelectorAll('.daimon-pick-item')]
            .map((e,i)=>({i, t:e.textContent.replace(/\\s+/g,' ').trim().slice(0,44)}))""")
        print("大問ピッカー %d件" % len(items))
        for it in items:
            print("   %2d %s" % (it["i"], it["t"]))
        pg.screenshot(path=os.path.join(OUT, "00_picker.png"))

        for rid, keyword, answers in WANT:
            idx = pg.evaluate("""(k)=>{const it=[...document.querySelectorAll('.daimon-pick-item')];
                for(let i=0;i<it.length;i++){ if(it[i].textContent.includes(k)) return i; } return -1;}""", keyword)
            if idx < 0:
                print("★%s がピッカーに無い" % rid)
                bad.append(rid)
                continue
            pg.evaluate("(i)=>document.querySelectorAll('.daimon-pick-item')[i].click()", idx)
            pg.wait_for_timeout(1000)
            print("\n[%s]" % rid)
            for n, ans in enumerate(answers):
                st = pg.evaluate("""()=>({
                  q:(document.getElementById('sq-question')||{}).textContent,
                  choices:[...document.querySelectorAll('#sq-choices button')].map(b=>b.textContent.trim()),
                  numpad: !!document.getElementById('sq-numpad') &&
                          !document.getElementById('sq-numpad').classList.contains('hidden'),
                  svg: !!document.querySelector('#screen-sansu-quiz svg')})""")
                print("   (%d) 図=%s テンキー=%s  設問: %s"
                      % (n + 1, st["svg"], st["numpad"], (st["q"] or "").strip()[:60]))
                pg.screenshot(path=os.path.join(OUT, "q_%s_%d.png" % (rid, n + 1)))
                if st["choices"] and not st["numpad"]:   # ★テンキーが出ていれば そちらが本物（選択肢の残骸を拾わない）
                    hit = pg.evaluate("""(a)=>{const bs=[...document.querySelectorAll('#sq-choices button')];
                        const t=bs.find(b=>b.textContent.trim()===a); if(!t) return false; t.click(); return true;}""", ans)
                    if not hit:
                        print("      ★選択肢に『%s』が無い" % ans); bad.append(rid); break
                elif not type_answer(pg, ans, bad, rid):
                    break
                pg.wait_for_timeout(1100)
                res = pg.evaluate("""()=>{const f=document.getElementById('sq-feedback');
                    return f? f.textContent.replace(/\\s+/g,' ').trim().slice(0,26):null;}""")
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
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(500)
            open_picker()
        b.close()
    httpd.shutdown()
    print("\nJSエラー:", [e for e in errs if "serviceWorker" not in e and "addEventListener" not in e
                          and "register" not in e] or "なし（SW停止ぶんをのぞく）")
    print("問題のあったもの:", sorted(set(bad)) if bad else "なし")
    print("→", OUT)


if __name__ == "__main__":
    main()
