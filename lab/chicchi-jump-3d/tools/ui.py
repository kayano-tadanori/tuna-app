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
    # ☀️ タイトルに出ている「今日の宇宙天気」カードの説明が入っているか
    wx = pg.evaluate("""() => { const e = document.querySelector('.hrow.now');
        return e ? { b: e.querySelector('b').textContent,
                     s: e.querySelector('span').textContent,
                     name: window.__cj.core.weather.name,
                     desc: window.__cj.core.weather.desc } : null; }""")
    check(wx is not None, "きょうの宇宙天気が出ている")
    if wx:
        print("     ", json.dumps(wx, ensure_ascii=False))
        check(wx["name"] in wx["b"], f"その日の天気の名まえが合っている（{wx['b']}）")
        check(wx["desc"] == wx["s"], f"効きめの説明が合っている（{wx['s']}）")
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
    # ★落ちたあとの「引き」も打ち切る。引きの最中は画面をさわると
    #   **演出スキップに吸われて** dragId が立たず、なぞっても動かない。
    #   これを入れないと、テストが たまに落ちる（実際 3回に1回ほど落ちた）。
    WARP = """a => { const c = window.__cj.core;
        window.__cj.clearOutro();
        c.over = false; c.ending = null;
        window.__cj.setRunning(true); window.__cj.warpP(a); c.ending = null; }"""

    # 🚨 飛ばした直後にチッチが落ちて死ぬことがある。死んでいると
    #   updateFlags は旗を隠すので、直っているのに「旗が出ない」と出る
    #   （実測：3回に1回ほど落ちた）。**生きている状態で測る**。
    def warp_alive(target, wait=380):
        for _ in range(4):
            pg.evaluate(WARP, target)
            pg.wait_for_timeout(wait)
            if not pg.evaluate("window.__cj.core.over"):
                return True
        return False

    # 旗が画面に出るまで待つ。飛ばした直後はカメラ（view行列）がまだ前のコマのままで、
    # 1回だけ見て決めると「出ていない」と誤って判定する（swiftshader は1コマ100msくらい）。
    def wait_flag_shown(tries=10, gap=200):
        info = []
        for _ in range(tries):
            info = pg.evaluate("window.__cj.flagInfo()")
            if any(f["shown"] for f in info):
                return info
            pg.wait_for_timeout(gap)
        return info

    # おにいちゃん（9,200）の少し手前へ飛ぶ
    check(warp_alive(9150), "9,150 まで飛んで、生きている（死んでいると旗は隠れる）")
    info = wait_flag_shown()
    shown = [f for f in info if f["shown"]]
    print("     ", json.dumps(pg.evaluate("window.__cj.ghostInfo()"), ensure_ascii=False))
    print("     ", json.dumps(info, ensure_ascii=False))
    check(len(shown) >= 1, f"手前まで来たら旗が画面に出る（出ている={len(shown)}本）")
    check(all(not f["passed"] for f in info if f["name"] == "おにいちゃん"), "まだ こえていない")
    pg.screenshot(path=os.path.join(OUT, "06_flag_ahead.png"))

    # こえる
    check(warp_alive(9260), "9,260 まで飛んで、生きている")
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

    # ======================================================
    #  👆 タップではチッチを動かさない（本人の指摘 2026-08-22）
    # ======================================================
    print("--- 👆 タップ ---")
    check(warp_alive(4000), "4,000 まで飛んで、生きている")
    box = pg.eval_on_selector("#c", "el => { const r = el.getBoundingClientRect();"
                                    " return {x: r.x, y: r.y, w: r.width, h: r.height}; }")
    cx, cy = box["x"] + box["w"] * 0.5, box["y"] + box["h"] * 0.6
    px = lambda: pg.evaluate("window.__cj.core.player.px")

    # ① 指を置くだけ → 動かないこと（ここが本題）
    before = px()
    pg.mouse.move(cx, cy)
    pg.mouse.down()
    pg.wait_for_timeout(80)
    check(abs(px() - before) < 1e-9, f"指を置いただけでは動かない（{before:.3f} → {px():.3f}）")

    # ② 6px のブレでも動かないこと
    pg.mouse.move(cx + 6, cy + 3)
    pg.wait_for_timeout(80)
    check(abs(px() - before) < 1e-9, f"6px のブレでは動かない（{px():.3f}）")

    # ③ しっかりなぞれば、今までどおり指の位置へ合うこと
    # ★横の速さ（vx）を止めてから測る。止めないと、測るまでの数コマで
    #   その速さのぶん流れて、合っているのに「ずれている」と出る（実測 0.035）。
    pg.mouse.move(cx + 70, cy, steps=6)
    pg.wait_for_timeout(40)
    after = px()
    want = pg.evaluate("f => cjWrap(window.__cj.core.camPx + (f - 0.5) * CJ_VIEW_W)",
                       (cx + 70 - box["x"]) / box["w"])
    dg = pg.evaluate("() => ({ dragging: window.__cj.dragging(), "
                     " ending: window.__cj.core.ending, over: window.__cj.core.over, "
                     " ov: document.getElementById('overlay').className, "
                     " stun: window.__cj.core.stunUntil - window.__cj.core.time * 1000 })")
    check(abs(after - before) > 1e-6, f"なぞれば動く（{before:.3f} → {after:.3f}）{json.dumps(dg, ensure_ascii=False)}")
    # ★ぴったり同じにはならない。指を動かしてから読むまでの1〜数コマで
    #   カメラ（camPx）が回りこむぶん、世界の座標が少しずれる（実測 0.03 前後）。
    #   ここで見たいのは「なぞれば指の位置へ合う」こと。画面はば 390px に対して
    #   0.06 は およそ4px。壊れたら 桁で外れるので、これで十分ひっかかる。
    check(abs(after - want) < 0.06, f"なぞった先は指の位置（ずれ {abs(after - want):.4f}）")
    pg.mouse.up()

    # ④ 置いた瞬間に ⚡逆フリックが暴発しないこと
    pg.evaluate("() => { window.__cj.core.player.vx = 3.0; window.__cj.setFlick(false); }")
    pg.mouse.move(cx - 130, cy)
    pg.mouse.down()
    pg.wait_for_timeout(80)
    check(not pg.evaluate("window.__cj.flickUsed()"), "置いただけで ⚡が暴発しない")
    pg.mouse.up()

    # ======================================================
    #  ✨ ジャストジャンプの合図（本人「決まったら派手に」）
    # ======================================================
    print("--- ✨ ジャスト ---")
    for n, tag in ((1, "1回め"), (4, "4れんぞく")):
        pg.evaluate("n => window.__cj.fireJust(n)", n)
        pg.wait_for_timeout(140)
        # 🚨 **撮るのと 測るのを 同じ回でやらない。**
        #   ・撮ってから測る → screenshot に 1秒近くかかり、測るころには
        #     0.62秒のアニメが終わっている（実測：anim=finished／つぶ0こ）
        #   ・測ってから撮る → 測っているあいだにアニメが終わり、消えた絵が残る
        #   → **測る回と 撮る回を分ける**（もう一度 出しなおして撮る）。
        st = pg.evaluate("""() => { const e = document.getElementById('just');
            return { show: e.classList.contains('show'), hot: e.classList.contains('hot'),
                     b: e.querySelector('b').textContent, i: e.querySelector('i').textContent,
                     anim: e.getAnimations().map(a => a.playState),
                     box: (r => r.width > 60 && r.height > 20)(e.getBoundingClientRect()),
                     flash: window.__cj.justFlash(), parts: window.__cj.partCount() }; }""")
        print("     ", tag, json.dumps(st, ensure_ascii=False))
        # ★opacity は見ない。合成（コンポジタ）で動くので getComputedStyle には 0 と出る。
        #   「アニメが走っているか」と「場所を取っているか」で見る。
        check(st["show"] and st["anim"] == ["running"] and st["box"],
              f"{tag}：まんなかに出る（アニメ {st['anim']} ／ 場所 {st['box']}）")
        check(st["flash"] > 0.3, f"{tag}：チッチが光る（{st['flash']:.2f}）")
        check(st["parts"] >= 40, f"{tag}：つぶが出る（{st['parts']}こ）")
        check((st["i"] == "×%d" % n) if n >= 2 else (st["i"] == ""),
              f"{tag}：×の出しかた（{st['i']!r}）")
        check(st["hot"] == (n >= 3), f"{tag}：3れんぞくから大きく（hot={st['hot']}）")
        # 絵は出しなおして撮る（上の 🚨 を見ること）
        pg.wait_for_timeout(700)
        pg.evaluate("n => window.__cj.fireJust(n)", n)
        pg.wait_for_timeout(150)
        pg.screenshot(path=os.path.join(OUT, "08_just_%d.png" % n))
        pg.wait_for_timeout(700)
    check(pg.eval_on_selector("#just", "e => e.getAnimations().every(a => a.playState === 'finished')"),
          "0.7秒あとには終わっている（次の足場を読むじゃまをしない）")

    # ======================================================
    #  🌀 バネの宙返りは ゆっくり・でも着地までに回りきる
    # ======================================================
    print("--- 🌀 バネ ---")
    for vy, tag in ((None, "ふつうのバネ"), (9.0, "弱いバネ")):
        sp = pg.evaluate("v => window.__cj.springFlipInfo(v)", vy)
        print("     ", tag, json.dumps(sp, ensure_ascii=False))
        check(sp["dur"] < sp["airT"], f"{tag}：着地までに回りきる"
                                      f"（回転 {sp['dur']:.2f}秒 ／ 滞空 {sp['airT']:.2f}秒）")
    sp = pg.evaluate("() => window.__cj.springFlipInfo()")
    check(sp["dur"] > 0.85, f"前（0.5秒）よりゆっくり回る（{sp['dur']:.2f}秒）")


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
