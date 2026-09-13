# -*- coding: utf-8 -*-
u"""結合した大問を、アプリと同じ並びで画面に出して確かめる（隔離した試行用）。

  python scripts/g1_preview.py --trial-dir docs/_genbo/_trial10

★アプリ本体（index.html）の並びに合わせる：
    導入文（intro） → 設問文（question） → 図（svg） → 解説（meaning）
  → memory:feedback_zu_wa_setsumon_no_shita
★本番アプリも本番データも触らない。隔離した out/preview.html に書き、PNGを撮るだけ。
★見たいのは「同じ文が2か所に出ていないか」と「図がどの小問に付いているか」。
"""
import argparse
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from g1_guard import assert_safe_out_dir                   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

CSS = u"""
body{background:#0e1526;color:#dfe6f7;font-family:"Hiragino Kaku Gothic ProN",Meiryo,sans-serif;
     margin:0;padding:16px;line-height:1.7}
.daimon{background:#141d33;border:1px solid #26324f;border-radius:14px;padding:14px 16px;margin:0 0 22px}
.hg{color:#ffd166;font-size:13px;margin-bottom:2px}
.title{font-size:17px;font-weight:bold;margin-bottom:10px}
.intro{background:#1b2743;border-left:4px solid #4f9eff;border-radius:8px;padding:10px 12px;
       margin:0 0 12px;white-space:pre-wrap}
.step{border-top:1px dashed #2c3a5c;padding:12px 0 4px}
.q{font-weight:bold;white-space:pre-wrap}
.fig{margin:10px 0}
.ans{color:#8ef5b0;margin-top:6px}
.mean{color:#a9b6d6;font-size:14px;margin-top:6px;white-space:pre-wrap}
.ch{margin-top:6px}
.ch span{display:inline-block;border:1px solid #3a4a72;border-radius:8px;padding:2px 12px;margin-right:6px}
.warn{color:#ff9b9b}
"""


def esc(s):
    return (s or u"").replace(u"&", u"&amp;").replace(u"<", u"&lt;").replace(u">", u"&gt;")


def ws(s):
    return re.sub(u"\\s+", u"", s or u"")


def render(daimon):
    parts, dupes = [], []
    for x in daimon:
        h = [u'<div class="daimon" id="%s">' % x[u"hg"],
             u'<div class="hg">%s ／ %s ／ %s</div>' % (esc(x[u"hg"]), esc(x.get(u"unit")),
                                                       esc(x.get(u"src"))),
             u'<div class="title">%s</div>' % esc(x.get(u"title"))]
        if x.get(u"intro"):
            h.append(u'<div class="intro">%s</div>' % esc(x[u"intro"]))
        # ★図は「設問文の下」に出す。アプリの並びがそうなっているため
        #   （index.html の #sq-question → #sq-figure → #sq-meaning。→feedback_zu_wa_setsumon_no_shita）。
        #   大問共通の図も、アプリでは設問ごとに設問の下へ出る（js/sansu.js の `step.svg || chain.svg`）。
        #   2026-09-13までここは設問より前にまとめて出していたので、
        #   「下図のような」と書かれた問題の確認が実物と食いちがっていた。
        for st in x[u"steps"]:
            h.append(u'<div class="step">')
            h.append(u'<div class="q">%s</div>' % esc(st[u"question"]))
            fig = st.get(u"svg") or x.get(u"svg")
            if fig:
                h.append(u'<div class="fig">%s</div>' % fig)
            if st.get(u"choices"):
                h.append(u'<div class="ch">%s</div>' %
                         u"".join(u"<span>%s</span>" % esc(c) for c in st[u"choices"]))
            h.append(u'<div class="ans">答え：%s</div>' % esc(st[u"answer"]))
            if st.get(u"meaning"):
                h.append(u'<div class="mean">%s</div>' % esc(st[u"meaning"]))
            h.append(u'</div>')
            # 二重表示の自動チェック（画面を見る前に機械でも見る）
            # ★答える場所の記号（㋐ など）は導入文にも出て当たり前なので、
            #   「文」と言える長さ（3字以上）のときだけ二重表示とみなす
            q = ws(st[u"question"])
            if x.get(u"intro") and len(q) >= 3 and q in ws(x[u"intro"]):
                dupes.append(u"%s: 設問文が導入文の中にも出ている（%s…）" % (x[u"hg"], q[:20]))
        h.append(u'</div>')
        parts.append(u"".join(h))
    return u"".join(parts), dupes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trial-dir", required=True)
    ap.add_argument("--src", default="out/final/daimon.json")
    a = ap.parse_args()
    trial = assert_safe_out_dir(a.trial_dir)

    src = os.path.join(trial, a.src.replace(u"/", os.sep))
    daimon = json.load(io.open(src, encoding=u"utf-8"))
    body, dupes = render(daimon)
    html = (u"<!doctype html><meta charset='utf-8'><style>%s</style><body>%s</body>"
            % (CSS, body))
    out = os.path.join(trial, u"out")
    page = os.path.join(out, u"preview.html")
    io.open(page, u"w", encoding=u"utf-8", newline=u"\n").write(html)

    shots = os.path.join(out, u"preview_png")
    os.makedirs(shots, exist_ok=True)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 480, "height": 900})   # スマホ幅で見る
        pg.goto("file:///" + page.replace(os.sep, "/"))
        pg.wait_for_timeout(400)
        for x in daimon:
            el = pg.query_selector("#%s" % x[u"hg"])
            if el:
                el.screenshot(path=os.path.join(shots, u"%s.png" % x[u"hg"]))
        pg.screenshot(path=os.path.join(shots, u"_all.png"), full_page=True)
        b.close()

    print(u"大問 %d本を out/preview.html に出し、PNGを out/preview_png/ に撮った" % len(daimon))
    if dupes:
        print(u"🚩 二重表示 %d件" % len(dupes))
        for t in dupes:
            print(u"   ", t)
        sys.exit(1)
    print(u"✅ 導入文と設問文の二重表示は無し")


if __name__ == "__main__":
    main()
