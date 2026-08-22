# -*- coding: utf-8 -*-
"""📖 あそびかた／🏅 スタンプ帳／🚩 標（しるべ）の実測。

   ★「作った」で終わらせない。実際にひらいて撮って、数字でも確かめる。
     - シートが本当に開くか／中身が空でないか／横にはみ出していないか
     - スタンプが「押してある／まだ」で見分けられるか
     - 旗が画面に出るか（shown）・こえたときに1回だけ反応するか

   使い方:
     cd "C:\\Users\\User\\Desktop\\Claude\\tuna app"
     python -m http.server 8899
     python lab/chicchi-jump-3d/tools/ui.py
"""
import sys, os, json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_ui")
os.makedirs(OUT, exist_ok=True)

# 記録のキーは cj:<名前>: が頭につく（名前が無いときは guest）
SEED_STAMPS = {
    "ビルの上": "2026-08-19", "雲の上": "2026-08-19", "富士山より高く": "2026-08-19",
    "カーマンライン": "2026-08-20", "宇宙ステーション": "2026-08-20",
    "月": "2026-08-20", "火星": "2026-08-21", "小惑星帯": "2026-08-21",
    "木星": "2026-08-22",
}
# ほかの子の到達点（本体から届く形と同じ）
SEED_FLAGS = [
    {"nickname": "おにいちゃん", "value": 9200},
    {"nickname": "たー", "value": 15400},
    {"nickname": "じぶん", "value": 4000},   # ← 自分の名前。除かれるはず
]

fails = []


def check(cond, msg):
    print(("  OK  " if cond else "  NG  ") + msg)
    if not cond:
        fails.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))

    # --- スタンプを仕込んでから開き直す（空の帳では見た目が確かめられない） ---
    pg.goto(URL, wait_until="load")
    pg.evaluate("s => localStorage.setItem('cj:guest:stamps', s)", json.dumps(SEED_STAMPS, ensure_ascii=False))
    pg.evaluate("""() => { const v = JSON.stringify({p: 7600, date: '8月21日'});
        localStorage.setItem('cj:guest:bestMark', v); localStorage.setItem('cj:じぶん:bestMark', v); }""")
    pg.reload(wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.wait_for_timeout(500)

    print("--- タイトル ---")
    pg.screenshot(path=os.path.join(OUT, "01_title.png"))
    badge = pg.inner_text("#tg-stamp-n")
    check(badge == "9/28", f"タイトルのバッジ = {badge!r}（9/28 のはず）")
    check(pg.is_visible("#tg-help") and pg.is_visible("#tg-stamp"), "2つのボタンが見えている")

    print("--- 📖 あそびかた ---")
    pg.click("#tg-help")
    pg.wait_for_timeout(350)
    pg.screenshot(path=os.path.join(OUT, "02_help_top.png"))
    rows = pg.eval_on_selector_all(".hrow", "els => els.length")
    check(rows >= 15, f"説明の行数 = {rows}")
    # 横にはみ出していないか（箱の中で横スクロールが起きていない）
    ov = pg.eval_on_selector("#sheet-body", "el => el.scrollWidth - el.clientWidth")
    check(ov <= 1, f"横のはみ出し = {ov}px")
    # 見出しの <b> だけが改行しているか（説明文の中の <b> が block になっていないか）
    inline = pg.eval_on_selector_all(
        ".hrow > div > span b, .hkey",
        "els => els.every(e => getComputedStyle(e).display !== 'block')")
    check(inline, "説明の中の強調とキーが inline のまま（行が割れていない）")
    # 下まで見る
    pg.eval_on_selector("#sheet-body", "el => el.scrollTop = el.scrollHeight")
    pg.wait_for_timeout(250)
    pg.screenshot(path=os.path.join(OUT, "03_help_bottom.png"))
    pg.click("#sheet-close")
    pg.wait_for_timeout(250)
    check(not pg.is_visible("#sheet"), "✕ でとじる")

    print("--- 🏅 スタンプ帳 ---")
    pg.click("#tg-stamp")
    pg.wait_for_timeout(350)
    pg.screenshot(path=os.path.join(OUT, "04_stamp_top.png"))
    # ★前に開いたシートのスクロール位置が残っていないか
    #   （display:none のうちに scrollTop を書いても効かない、で一度やらかした）
    check(pg.eval_on_selector("#sheet-body", "el => el.scrollTop") == 0,
          "ひらいたら いちばん上から見える")
    cells = pg.eval_on_selector_all(".stamp", "els => els.length")
    got = pg.eval_on_selector_all(".stamp.got", "els => els.length")
    tip = pg.eval_on_selector_all(".stamp.tip", "els => els.map(e => e.querySelector('b').textContent)")
    check(cells == 28, f"わくの数 = {cells}（28 のはず）")
    check(got == 9, f"押してあるもの = {got}（9 のはず）")
    check(tip == ["木星"], f"最前線 = {tip}（木星 のはず）")
    lock = pg.eval_on_selector_all(".stamp:not(.got) b", "els => [...new Set(els.map(e => e.textContent))]")
    check(lock == ["？？？？"], f"まだの ものは名前を伏せている = {lock}")
    ov2 = pg.eval_on_selector("#sheet-body", "el => el.scrollWidth - el.clientWidth")
    check(ov2 <= 1, f"横のはみ出し = {ov2}px")
    pg.eval_on_selector("#sheet-body", "el => el.scrollTop = el.scrollHeight")
    pg.wait_for_timeout(250)
    pg.screenshot(path=os.path.join(OUT, "05_stamp_bottom.png"))
    # 幕をさわってとじる
    pg.mouse.click(20, 20)
    pg.wait_for_timeout(250)
    check(not pg.is_visible("#sheet"), "幕をさわってもとじる")

    print("--- 🚩 標（しるべ）---")
    # 本体につながっているときと同じに、名前をもらってから始める
    #   （名前が無いと「自分の旗を自分の道に立てない」が効かない）
    pg.evaluate("window.postMessage({type:'cj-name', name:'じぶん'}, '*')")
    pg.wait_for_timeout(200)
    pg.click("#ov-go")
    pg.wait_for_timeout(400)
    pg.evaluate("rows => window.__cj.setFlags(rows)", SEED_FLAGS)
    info = pg.evaluate("window.__cj.flagInfo()")
    names = [f["name"] for f in info]
    check(len(info) == 3, f"立った旗 = {len(info)}本 {names}")
    check(any(f["mine"] for f in info), "自分の標（白）がある")
    check(all(f["name"] != "じぶん" for f in info), "自分の名前の旗は立てない")

    # ★飛ばすときは 到着演出（月・火星）の状態を解いてから。
    #   解かずに飛ぶと running=false / ending='mars' のままで、
    #   「旗が出ない・こえない」が**ゲームのせいに見える**（実際そう見えた）。
    WARP = """a => { const c = window.__cj.core;
        c.over = false; c.ending = null;
        window.__cj.setRunning(true); window.__cj.warpP(a); c.ending = null; }"""

    # おにいちゃん（9,200）の少し手前へ飛ぶ
    pg.evaluate(WARP, 9150)
    pg.wait_for_timeout(500)
    info = pg.evaluate("window.__cj.flagInfo()")
    shown = [f for f in info if f["shown"]]
    print("     ", json.dumps(pg.evaluate("window.__cj.ghostInfo()"), ensure_ascii=False))
    print("     ", json.dumps(info, ensure_ascii=False))
    check(len(shown) >= 1, f"手前まで来たら旗が画面に出る（出ている={len(shown)}本）")
    check(all(not f["passed"] for f in info if f["name"] == "おにいちゃん"), "まだ こえていない")
    pg.screenshot(path=os.path.join(OUT, "06_flag_ahead.png"))

    # こえる
    pg.evaluate(WARP, 9260)
    pg.wait_for_timeout(500)
    info = pg.evaluate("window.__cj.flagInfo()")
    ani = [f for f in info if f["name"] == "おにいちゃん"][0]
    check(ani["passed"], "こえたら passed になる")
    # ★ここは 2本（自分の 7,600 も こえている）。1本と決めうちにしない。
    gold = pg.eval_on_selector_all(".flag.passed", "els => els.length")
    check(gold == len([f for f in info if f["passed"]]), f"こえた旗が金色になる（金={gold}本）")
    pg.screenshot(path=os.path.join(OUT, "07_flag_passed.png"))

    # ★いちばん大事な検査：**線とチッチが同じ高さで出会うか**。
    #   ずれていると「線はこえたのに『ぬいた』が出ない」になる。
    #   ここは 画面の% ではなく **世界の高さ** でくらべる。
    #   画面でくらべると、チッチが足場のあいだで大きく上下するぶん・
    #   カメラの追従のぶんが混ざって、直っていても NG になる（実際なった）。
    pg.evaluate("p => window.__cj.setFlags([{nickname:'ものさし', value:p}])", 12000)
    m = pg.evaluate("""a => { const c = window.__cj.core;
        c.over = false; c.ending = null;
        window.__cj.setRunning(true); window.__cj.warpP(a); c.ending = null;
        // 飛ばした直後＝progress がちょうど a のとき、チッチが居る高さ
        return { prog: Math.round(c.progress), bird: c.player.y,
                 flag: window.__cj.flagY(a), old: cjYAtProgress(a), viewH: CJ_VIEW_H }; }""", 12000)
    gap = abs(m["flag"] - m["bird"])
    check(gap < 0.05,
          f"線とチッチが同じ高さで出会う（ずれ {gap:.3f} ／ 画面の縦はば {m['viewH']:.2f}）")
    # 直す前の式（cjYAtProgress）だと どれだけズレていたかも残しておく
    print(f"      ※ cjYAtProgress のままだと ずれ {abs(m['old'] - m['bird']):.2f}"
          f"（画面の {abs(m['old'] - m['bird']) / m['viewH'] * 100:.0f}%）")
    pg.evaluate("rows => window.__cj.setFlags(rows)", SEED_FLAGS)
    # 2回目は反応しない（1本につき1回だけ）
    # ★くらべるのは passed だけ。top は カメラが動くので毎フレーム変わる。
    before = [(f["name"], f["passed"]) for f in pg.evaluate("window.__cj.flagInfo()")]
    pg.wait_for_timeout(600)
    after_i = pg.evaluate("window.__cj.flagInfo()")
    after = [(f["name"], f["passed"]) for f in after_i]
    check(before == after, "こえたあと、こえた印が増えない（何度も鳴らない）")

    # ずっと先の旗（たー 15,400）は、まだ画面に出ていないこと
    far = [f for f in after_i if f["name"] == "たー"][0]
    check(not far["shown"], "ずっと先の旗は、そこへ行くまで見えない")

    print("\n--- コンソール ---")
    if logs:
        for l in logs[:20]:
            print("  ", l)
    check(not logs, f"エラー・警告 {len(logs)}件")

print("\n撮った絵:", OUT)
if fails:
    print("\n🚨 NG が {}件:".format(len(fails)))
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("\n✅ ぜんぶ OK")
