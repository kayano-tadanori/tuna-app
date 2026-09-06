# -*- coding: utf-8 -*-
u"""大問5の図を タップして 拡大画面が出るか、そこで字が読めるかを 実機の画面で見る。"""
import functools, http.server, io, os, socketserver, sys, threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_no15_appshots")
PORT = 8772


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    h = functools.partial(Quiet, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
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
                pg.click(sel); pg.wait_for_timeout(400)
        pg.click('.subject-card[data-subject="sansu"]'); pg.wait_for_timeout(700)
        pg.evaluate("showScreen('sansu-home')"); pg.wait_for_timeout(400)
        pg.click('#screen-sansu-home .grade-btn[data-grade="3"]'); pg.wait_for_timeout(700)
        pg.click('#screen-sansu-home .sansu-mode-btn[data-sansu-mode="hama"]'); pg.wait_for_timeout(1200)
        pg.evaluate("(async()=>{ sansuState.hamaCourse='sairei_new';"
                    " setHamaCurrent(3,'sairei_new',15); await renderHamaPanel(); })()")
        pg.wait_for_timeout(1200)
        pg.click('.hama-act-btn[data-hama-act="bunsatsuq"]'); pg.wait_for_timeout(1100)
        pg.evaluate("()=>document.querySelectorAll('.daimon-pick-item')[4].click()")
        pg.wait_for_timeout(1100)
        box = pg.evaluate("""()=>{const s=document.querySelector('#sq-figure svg');
            if(!s) return null; const r=s.getBoundingClientRect();
            return {w:Math.round(r.width), h:Math.round(r.height)};}""")
        print(u"クイズ画面での図の大きさ: %s" % box)
        pg.click('#sq-figure svg')
        pg.wait_for_timeout(900)
        vis = pg.evaluate("""()=>{const o=document.getElementById('diagram-viewer');
            const s=document.querySelector('#diagram-viewer-content svg');
            const r=s? s.getBoundingClientRect():null;
            return {open:!o.classList.contains('hidden'),
                    w:r?Math.round(r.width):0, h:r?Math.round(r.height):0};}""")
        print(u"拡大画面: %s" % vis)
        pg.screenshot(path=os.path.join(OUT, "zoom_d5.png"))
        b.close()
    httpd.shutdown()
    print("->", os.path.join(OUT, "zoom_d5.png"))


if __name__ == "__main__":
    main()
