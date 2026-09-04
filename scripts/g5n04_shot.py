# -*- coding: utf-8 -*-
"""小5灘合 第4回に足した3本（大問2・3・7）を、実際のアプリ画面で目視＋打ちこみ確認する。
   （method_oton_local_preview／feedback_local_test_writes_cloud／feedback_nyuuryokusou_wa_betsu）
★Firestoreへの通信を落としてから動かすので、本番ランキングには何も書かない。
★「形が正しい」と「実際に打てる」は別なので、正解を実際に打ちこんで〇が出るまで見る。
使い方: python scripts/g5n04_shot.py
"""
import functools, http.server, io, os, socketserver, sys, threading
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_g5n04_shots")
PORT = 8761
WANT = [("hd5n_04_9", "32"), ("hd5n_04_10", "10"), ("hd5n_04_11", "62:63")]


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
            pg.click("#nickname-btn"); pg.wait_for_timeout(1600)
        for sel in ("#gami-close", "#update-modal .btn-primary"):
            if pg.locator(sel).count() and pg.locator(sel).is_visible():
                pg.click(sel); pg.wait_for_timeout(400)
        pg.click('.subject-card[data-subject="sansu"]'); pg.wait_for_timeout(700)
        pg.click('#screen-sansu-home .grade-btn[data-grade="5"]'); pg.wait_for_timeout(700)
        pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="nadago"]'); pg.wait_for_timeout(1600)
        pg.screenshot(path=os.path.join(OUT, "00_nadago.png"))
        pg.evaluate("(async()=>{ setHamaCurrent(5,'nadago',4); await renderHamaPanel(); })()")
        pg.wait_for_timeout(1000)
        pg.screenshot(path=os.path.join(OUT, "01_kai4.png"))
        acts = pg.evaluate("""()=>[...document.querySelectorAll('.hama-act-btn')]
            .filter(b=>!b.classList.contains('hidden'))
            .map(b=>({k:b.dataset.hamaAct, name:(b.querySelector('.hama-act-name')||{}).textContent,
                      dis:b.disabled}))""")
        print("第4回のボタン:", acts)
        key = next((a["k"] for a in acts if not a["dis"] and "q" in a["k"]), None)
        if not key:
            print("★大問を開くボタンが見つからない"); b.close(); httpd.shutdown(); return
        pg.click('.hama-act-btn[data-hama-act="%s"]' % key); pg.wait_for_timeout(1100)
        pg.screenshot(path=os.path.join(OUT, "02_picker.png"))
        items = pg.evaluate("""()=>[...document.querySelectorAll('.daimon-pick-item')]
            .map((e,i)=>({i, t:e.textContent.replace(/\s+/g,' ').trim().slice(0,46)}))""")
        print("大問ピッカー %d件" % len(items))
        for it in items: print("   %2d %s" % (it["i"], it["t"]))

        for rid, ans in WANT:
            idx = pg.evaluate("""(rid)=>{
              const items=[...document.querySelectorAll('.daimon-pick-item')];
              const map={hd5n_04_9:'風車', hd5n_04_10:'正三角形3つ', hd5n_04_11:'市松'};
              const k=map[rid];
              for(let i=0;i<items.length;i++){ if(items[i].textContent.includes(k)) return i; }
              return -1; }""", rid)
            if idx < 0:
                print("★%s がピッカーに無い" % rid); bad.append(rid); continue
            pg.evaluate("(i)=>document.querySelectorAll('.daimon-pick-item')[i].click()", idx)
            pg.wait_for_timeout(1000)
            pg.screenshot(path=os.path.join(OUT, "q_%s.png" % rid))
            st = pg.evaluate("""()=>({
              intro:(document.getElementById('sq-chain-intro')||{}).textContent,
              q:(document.getElementById('sq-question')||{}).textContent,
              choices:[...document.querySelectorAll('#sq-choices button')].map(b=>b.textContent.trim()),
              numpad: !!document.getElementById('sq-numpad') &&
                      !document.getElementById('sq-numpad').classList.contains('hidden'),
              svg: !!document.querySelector('#screen-sansu-quiz svg'),
              ans:(sansuState.current||{}).answer })""")
            print("\n[%s] 図=%s 選択肢=%s テンキー=%s 正解=%r"
                  % (rid, st["svg"], st["choices"] or "なし", st["numpad"], st["ans"]))
            print("   設問:", (st["q"] or "").strip()[:70])
            if st["ans"] != ans:
                print("   ★データの正解が想定とちがう:", st["ans"], "≠", ans); bad.append(rid)
            # ── 実際に打ちこむ ──
            if st["choices"]:
                ok = pg.evaluate("""(a)=>{ const bs=[...document.querySelectorAll('#sq-choices button')];
                    const t=bs.find(b=>b.textContent.trim()===a); if(!t) return false; t.click(); return true;}""", ans)
                if not ok: print("   ★選択肢に正解が無い"); bad.append(rid)
            else:
                for ch in ans:
                    sel = ('#sq-numpad [data-key="%s"]' % ch)
                    if pg.locator(sel).count() == 0:
                        print("   ★テンキーに『%s』のキーが無い" % ch); bad.append(rid); break
                    pg.click(sel); pg.wait_for_timeout(90)
                pg.click("#sq-numpad [data-key=\"submit\"]")
            pg.wait_for_timeout(1100)
            res = pg.evaluate("""()=>{
              const f=document.getElementById('sq-feedback');
              return f? f.textContent.replace(/\s+/g,' ').trim().slice(0,40) : null; }""")
            pg.screenshot(path=os.path.join(OUT, "a_%s.png" % rid))
            print("   打ちこんだ結果:", res)
            if not res or ("正解" not in res and "せいかい" not in res and "○" not in res and "〇" not in res):
                print("   ★〇が出ていない"); bad.append(rid)
            pg.evaluate("if (typeof showScreen==='function') showScreen('sansu-home');")
            pg.wait_for_timeout(500)
            pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="nadago"]'); pg.wait_for_timeout(1200)
            pg.evaluate("(async()=>{ setHamaCurrent(5,'nadago',4); await renderHamaPanel(); })()")
            pg.wait_for_timeout(800)
            pg.click('.hama-act-btn[data-hama-act="%s"]' % key); pg.wait_for_timeout(900)
        b.close()
    httpd.shutdown()
    print("\nJSエラー:", errs if errs else "なし")
    print("問題のあったもの:", sorted(set(bad)) if bad else "なし")
    print("→", OUT)


if __name__ == "__main__":
    main()
