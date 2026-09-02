# -*- coding: utf-8 -*-
"""図の中の <text> を1つずつ、「その場所で本当に読めるか」を画素で測る。

  ・アプリと同じ暗い下地に図を描く
  ・<text> ごとに画面上の位置を取り、その四角の中の画素を見る
  ・文字の色と、その四角の“地”の色をくらべる
      → 差が小さい＝地に溶けていて読めない

★色の名前では決めない。明るいカードの上の濃い文字は正しい使い方なので、
  「暗い色だから直す」ではなく「読めないから直す」で判定する。

使い方:
  python scripts/check_text_contrast.py                  … 全部の図を測る
  python scripts/check_text_contrast.py --thresh 60      … きびしさを変える
  python scripts/check_text_contrast.py --json out.json  … 直す対象を書き出す
"""
import argparse
import io
import json
import os
import sys

import numpy as np
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_textcontrast")
FIGBG = "#101f3f"          # 実機で図の下にある色（.question-box をならしたもの）
BATCH = 60

JS = r"""() => {
  const out = [];
  document.querySelectorAll('.fig').forEach(f => {
    const fb = f.getBoundingClientRect();
    f.querySelectorAll('text').forEach((t, i) => {
      const r = t.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      out.push({fig: f.id, idx: i,
                x: r.left - fb.left, y: r.top - fb.top,
                w: r.width, h: r.height,
                fill: getComputedStyle(t).fill,
                txt: (t.textContent || '').trim().slice(0, 24)});
    });
  });
  return out;
}"""


def to_rgb(css):
    """rgb(a b c) / rgb(a, b, c) を (r,g,b) に。"""
    s = css.replace("rgb(", "").replace("rgba(", "").replace(")", "")
    s = s.replace(",", " ")
    p = [q for q in s.split() if q and q[0].isdigit()]
    if len(p) < 3:
        return None
    return tuple(int(float(x)) for x in p[:3])


def collect():
    d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))
    figs = {}
    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("steps"), list):
                items = [("大問", o.get("svg") or "")] + [
                    ("q%d" % i, s.get("svg") or "") for i, s in enumerate(o.get("steps", []), 1)]
                for w, svg in items:
                    if svg and "<text" in svg:
                        figs["%s__%s" % (o.get("id"), w)] = svg
                return
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    return figs


def run_batch(pw, keys, figs):
    parts = ['<div class="fig" id="%s">%s</div>' % (k, figs[k]) for k in keys]
    html = ("<!doctype html><meta charset='utf-8'><style>"
            "body{background:%s;margin:0;padding:0}"
            ".fig{background:%s;padding:12px;margin:0 0 6px}"
            "svg{width:100%%;display:block}</style><body>%s</body>"
            % (FIGBG, FIGBG, "".join(parts)))
    tmp = os.path.join(OUT, "_page.html")
    io.open(tmp, "w", encoding="utf-8").write(html)
    b = pw.chromium.launch(executable_path=CHROME, headless=True)
    pg = b.new_page(viewport={"width": 520, "height": 900}, device_scale_factor=1)
    pg.goto("file:///" + tmp.replace("\\", "/"))
    pg.wait_for_timeout(700)
    rects = pg.evaluate(JS)
    imgs = {}
    for k in keys:
        p = os.path.join(OUT, "%s.png" % k)
        pg.locator('[id="%s"]' % k).screenshot(path=p)
        imgs[k] = p
    b.close()
    return rects, imgs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--thresh", type=float, default=60.0)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--json", default="")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    figs = collect()
    keys = sorted(figs)
    if args.limit:
        keys = keys[:args.limit]
    print("<text> を持つ図:", len(keys), "枚")

    from playwright.sync_api import sync_playwright
    bad, ok = [], 0
    with sync_playwright() as pw:
        for i in range(0, len(keys), BATCH):
            ks = keys[i:i + BATCH]
            rects, imgs = run_batch(pw, ks, figs)
            by = {}
            for r in rects:
                by.setdefault(r["fig"], []).append(r)
            for k in ks:
                if k not in imgs or not os.path.exists(imgs[k]):
                    continue
                A = np.asarray(Image.open(imgs[k]).convert("RGB")).astype(np.int16)
                H, W = A.shape[:2]
                for r in by.get(k, []):
                    fc = to_rgb(r["fill"])
                    if fc is None:
                        continue
                    x0 = max(0, int(r["x"]) - 2); y0 = max(0, int(r["y"]) - 2)
                    x1 = min(W, int(r["x"] + r["w"]) + 3); y1 = min(H, int(r["y"] + r["h"]) + 3)
                    if x1 - x0 < 3 or y1 - y0 < 3:
                        continue
                    crop = A[y0:y1, x0:x1].reshape(-1, 3)
                    dist_to_text = np.sqrt(((crop - np.array(fc)) ** 2).sum(axis=1))
                    glyph = dist_to_text < 40          # 文字の色そのもの
                    if glyph.sum() < 4 or (~glyph).sum() < 4:
                        continue
                    bg = np.median(crop[~glyph], axis=0)
                    d = float(np.sqrt(((np.array(fc) - bg) ** 2).sum()))
                    if d < args.thresh:
                        bad.append({"fig": k, "idx": r["idx"], "text": r["txt"],
                                    "fill": "#%02x%02x%02x" % fc,
                                    "bg": "#%02x%02x%02x" % tuple(int(v) for v in bg),
                                    "bglum": round(float(0.299 * bg[0] + 0.587 * bg[1]
                                                         + 0.114 * bg[2]) / 255, 3),
                                    "dist": round(d, 1)})
                    else:
                        ok += 1
            print("  …%d/%d枚" % (min(i + BATCH, len(keys)), len(keys)))

    print()
    print("読める文字: %d個 ／ ★地に溶けて読めない文字: %d個（%d枚の図）"
          % (ok, len(bad), len({b['fig'] for b in bad})))
    from collections import Counter
    c = Counter(b["fill"] for b in bad)
    print("読めない文字の色の内わけ:", dict(c.most_common()))
    for b in sorted(bad, key=lambda x: x["dist"])[:25]:
        print("   %-30s #%d %-16s %s  差%.1f" % (b["fig"], b["idx"], b["text"], b["fill"], b["dist"]))
    if args.json:
        io.open(args.json, "w", encoding="utf-8").write(
            json.dumps(bad, ensure_ascii=False, indent=1))
        print("→", args.json)


main()
