# -*- coding: utf-8 -*-
"""2026-11-27 公開テスト 第642〜644回・灘合理科 第8〜10回を、実際のアプリ画面で解いて〇が出るか確かめる（目視用の画像も撮る）。
  （method_oton_local_preview／feedback_local_test_writes_cloud／feedback_browser_test_offscreen／feedback_e2e_mute）
  ★Firestore・Firebase への通信は全部落とす（本番ランキングに書かない）。遮断した件数を最後に出す
  ★ウィンドウは画面の外・音なし・headless にしない
  使い方: python scripts/kokai2611_shot.py   （data/hama_daimon.json に入れたあとで）
"""
import functools, http.server, io, json, os, socketserver, sys, threading, glob

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_kokai2611_shots")
PORT = 8771
ARGS = ["--window-position=-2400,-2400", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling", "--disable-features=CalculateNativeWinOcclusion", "--mute-audio"]
# 1担当1〜2本（図を直したもの・答えの形がちがうものを選んだ）
WANT = ["hd_5m_k10_643_1", "hd_5m_k11_644_5", "hd_3m_k10_643_2", "hd_3m_k09_642_4", "hd_5r_k10_643_4", "hd_5r_k11_644_2",
        "hd_5k_k10_643_1", "hd_3k_k11_644_1", "hd5n_08_rt2", "hd5n_09_r2", "hd5n_10_r2", "hd5n_10_rt5"]
KEY = {"/": "frac", "と": "mixedSep", ":": "ratio", "：": "ratio"}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    h = functools.partial(Quiet, directory=BASE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def find(d, i):
    for g, gv in d["grades"].items():
        for c, cv in gv.items():
            for b, bv in cv.items():
                if isinstance(bv, dict):
                    for k, v in bv.items():
                        for x in v:
                            if x["id"] == i: return int(g), c, x
    return None


def type_answer(pg, ans):
    a = str(ans)
    if "余り" in a:
        q, r = a.split("余り"); seq = list(q) + ["rem"] + list(r)
    else:
        seq = [KEY.get(ch, ch) for ch in a]
    for k in seq:
        el = pg.locator('#sq-numpad [data-key="%s"]' % k)
        if el.count() == 0 or not el.first.is_visible():
            return "テンキーに『%s』が無い" % k
        el.first.click(); pg.wait_for_timeout(60)
    pg.click('#sq-numpad [data-key="submit"]')
    return None


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))
    httpd = serve(); bad = []; blocked = [0]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=False, args=ARGS)
        pg = b.new_page(viewport={"width": 414, "height": 896})

        def route(r):
            u = r.request.url
            if "googleapis.com" in u or "firebaseio.com" in u or "firebase" in u and "127.0.0.1" not in u:
                blocked[0] += 1; r.abort()
            else:
                r.continue_()
        pg.route("**/*", route)
        pg.add_init_script("Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined});")
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://127.0.0.1:%d/index.html" % PORT); pg.wait_for_timeout(1500)
        if pg.locator("#nickname-input").count():
            pg.fill("#nickname-input", "検証用claude"); pg.click("#nickname-btn"); pg.wait_for_timeout(1600)
        for sel in ("#gami-close", "#update-modal .btn-primary"):
            if pg.locator(sel).count() and pg.locator(sel).first.is_visible():
                pg.locator(sel).first.click(); pg.wait_for_timeout(400)
        pg.click('.subject-card[data-subject="sansu"]'); pg.wait_for_timeout(700)
        # 入れ先の配線：公開の過去問（月）と灘合理科の回
        wire = pg.evaluate("""async()=>{ await loadHamaMap(); const o={};
          for (const [g,c,ids] of [[5,'master',['hd_5m_k10_643_1','hd_5m_k11_644_1']],[3,'master',['hd_3m_k09_642_1','hd_3m_k11_644_1']],[5,'rika',['hd_5r_k10_643_1','hd_5r_k11_644_1']]]) {
            const sj=(c==='rika')?'rika':'sansu'; sansuState.subject=sj; await ensureHamaCourses(g,sj); const L=(hamaCourses(g,sj)||{})[c]; if(!L){o[g+c]='コースなし';continue}
            const hit=new Set(); for (const l of L.lessons){ try{ (await hamaDaimonKokai(g,c,l.no)).forEach(x=>hit.add(x.id)); }catch(e){} }
            o[g+c]=ids.map(i=>i+(hit.has(i)?' ○':' ×')).join(' ');
          }
          await ensureHamaCourses(5,'nadago_rika');
          for (const n of [8,9,10]) { const s=await hamaDaimonWeek(5,'nadago_rika',n).catch(()=>null); o['灘合理科'+n]= s? s.length+'本' : '取れない'; }
          return o; }""")
        print("配線:", json.dumps(wire, ensure_ascii=False))
        for rid in WANT:
            f = find(d, rid)
            if not f: print("★データに無い", rid); bad.append(rid); continue
            g, c, item = f
            subj = "rika" if c in ("rika", "nadago_rika") else ("kokugo" if c == "kokugo" else "sansu")
            pg.evaluate("(a)=>startDaimonSets([a.item], a.g, a.s, '確認', [a.item])", {"item": item, "g": g, "s": subj})
            pg.wait_for_timeout(1000)
            print("\n[%s] %s（%d問）" % (rid, item["title"], len(item["steps"])))
            for n, s in enumerate(item["steps"]):
                st = pg.evaluate("""()=>({q:(document.getElementById('sq-question')||{}).textContent||'',
                  ch:[...document.querySelectorAll('#sq-choices button')].map(b=>b.textContent.trim()),
                  np: !!document.getElementById('sq-numpad') && !document.getElementById('sq-numpad').classList.contains('hidden'),
                  svg: document.querySelectorAll('#screen-sansu-quiz svg').length})""")
                if n < 3 or s.get("svg") or item.get("svg"): pg.screenshot(path=os.path.join(OUT, "q_%s_%d.png" % (rid, n + 1)), full_page=True)
                ans = s["answer"]; err = None
                if st["ch"] and not st["np"]:
                    hit = pg.evaluate("(a)=>{const t=[...document.querySelectorAll('#sq-choices button')].find(b=>b.textContent.trim()===a); if(!t) return false; t.click(); return true;}", ans)
                    if not hit: err = "選択肢に『%s』が無い %s" % (ans, st["ch"])
                elif st["np"]:
                    err = type_answer(pg, ans)
                else:
                    err = "選択肢もテンキーも出ていない"
                pg.wait_for_timeout(900)
                res = pg.evaluate("()=>{const f=document.getElementById('sq-feedback'); return f? f.textContent.replace(/\\s+/g,' ').trim().slice(0,20):''}")
                ok = (not err) and ("正解" in res)
                print("  (%d) 図%d %s 『%s』→ %s%s" % (n + 1, st["svg"], "テンキー" if st["np"] else "選択", ans, res, "" if ok else "  ★" + (err or "〇が出ない")))
                if not ok: bad.append(rid); pg.screenshot(path=os.path.join(OUT, "NG_%s_%d.png" % (rid, n + 1)), full_page=True)
                nx = pg.locator("#sq-btn-next")
                if n + 1 < len(item["steps"]) and nx.count() and nx.first.is_visible():
                    nx.first.click(); pg.wait_for_timeout(700)
        b.close()
    httpd.shutdown()
    print("\nJSエラー:", [e for e in errs if "serviceWorker" not in e] or "なし")
    print("遮断した通信:", blocked[0], "件")
    print("〇が出なかったもの:", sorted(set(bad)) if bad else "なし")
    print("→", OUT)


if __name__ == "__main__":
    main()
