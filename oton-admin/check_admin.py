# -*- coding: utf-8 -*-
"""管理ツールの実測。
   ・チッチジャンプ3D のスコアが一覧に出るか（表示・削除の両方の口）
   ・最終更新の並べかえが本当に効くか
   使い方（tuna app で python -m http.server 8899 を上げてから）:
     python oton-admin/_check_admin.py
"""
import sys, json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/oton-admin/index.html"
fails = []


def check(cond, msg):
    print(("  OK  " if cond else "  NG  ") + msg)
    if not cond:
        fails.append(msg)


ROWS = [
    {"nickname": "あきら", "pct": 10.0, "lastUpdated": "2026-08-22T09:00:00Z"},
    {"nickname": "いずみ", "pct": 90.0, "lastUpdated": "2026-08-01T09:00:00Z"},
    {"nickname": "うたの", "pct": 50.0, "lastUpdated": "2026-08-15T09:00:00Z"},
    {"nickname": "えりか", "pct": 70.0, "lastUpdated": None},          # 一度も上げていない子
]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1100, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="domcontentloaded")
    pg.wait_for_timeout(2500)

    print("--- 読みこみ ---")
    check(not errs, f"JSのエラー {len(errs)}件 {errs[:3]}")

    print("--- 🐦 チッチジャンプ3D ---")
    ids = pg.evaluate("() => cloudScoreGames().map(g => g.id)")
    print("     ", json.dumps(ids, ensure_ascii=False))
    for want in ("jump3d", "jump3d_reach", "jump3d_gain", "jump3d_coop"):
        check(want in ids, f"表示の一覧に {want} がある")
    check(any(i.startswith("jump3d_w") for i in ids), "今週のシード（jump3d_w…）も出る")
    gids = pg.evaluate("() => GAME_IDS")
    for want in ("jump3d", "jump3d_reach", "jump3d_gain", "jump3d_coop"):
        check(want in gids, f"削除の一覧に {want} がある")
    wk = pg.evaluate("() => jump3dWeekGames(3)")
    check(len(wk) == 3 and all(w.startswith("jump3d_w") for w in wk),
          f"週がわりのIDが作れる {wk}")
    # 本体と週番号の出しかたが同じか（ずれると別の表を消す／見にいく）
    same = pg.evaluate("() => jump3dWeekGames(1)[0] === 'jump3d_w' + "
                       "Math.floor((Math.floor(Date.now()/86400000)+3)/7)")
    check(same, "週番号の出しかたが本体と同じ")

    print("--- ↕ 並べかえ ---")
    pg.evaluate("rows => { allEntries = rows; }", ROWS)

    def order(how):
        pg.evaluate("h => { document.getElementById('sort-by').value = h; renderList(); }", how)
        return pg.eval_on_selector_all("#list-body tr td:first-child",
                                       "els => els.map(e => e.textContent)")

    o = order("pct")
    check(o == ["いずみ", "えりか", "うたの", "あきら"], f"達成率が高い順 {o}")
    o = order("updated")
    check(o == ["あきら", "うたの", "いずみ", "えりか"], f"最終更新が新しい順 {o}")
    o = order("updated-asc")
    check(o == ["えりか", "いずみ", "うたの", "あきら"], f"最終更新が古い順 {o}")
    o = order("nickname")
    check(o == ["あきら", "いずみ", "うたの", "えりか"], f"受験番号順 {o}")

    # 見出しを押す近道（PCだけ。スマホでは thead を隠しているので select が本体）
    pg.evaluate("() => setSort('updated')")
    o = pg.eval_on_selector_all("#list-body tr td:first-child", "els => els.map(e => e.textContent)")
    check(o == ["あきら", "うたの", "いずみ", "えりか"], f"見出しで新しい順 {o}")
    pg.evaluate("() => setSort('updated')")
    o = pg.eval_on_selector_all("#list-body tr td:first-child", "els => els.map(e => e.textContent)")
    check(o == ["えりか", "いずみ", "うたの", "あきら"], f"もう一度押すと逆順 {o}")

    check(not errs, f"最後までJSのエラー0件（{len(errs)}件）")
    b.close()

if fails:
    print("\n🚨 NG が {}件".format(len(fails)))
    sys.exit(1)
print("\n✅ ぜんぶ OK")
