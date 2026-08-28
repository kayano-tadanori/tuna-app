# -*- coding: utf-8 -*-
"""小4マスター算数 第2分冊（No.14〜28）のSVGを、method_svg_check の3種類で実測する。

既存の道具（build_svg_check.js / fix_svg_viewbox.js）は node 前提だが、
実家PCには node が無い（[[jikka_pc_setup]]）ので、同じことを Playwright で実測する。

  ① 枠からのはみ出し … root の getBBox() と viewBox を比べる
  ② 文字どうしの重なり … text を総当たりで getBoundingClientRect() で比べる
  ③ 箱からの文字はみ出し … rect の中にいる text がその rect を出ていないか

⚠ 文字幅は見つもらない。必ずブラウザで実測する（method_svg_check の教訓）。

使い方: python scripts/check_g4b2_svg.py
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

MEASURE_JS = r"""
() => {
  const out = [];
  document.querySelectorAll('svg[data-key]').forEach(svg => {
    const key = svg.dataset.key;
    const vb = svg.viewBox.baseVal;
    let over = null;
    try {
      const bb = svg.getBBox();
      const d = {
        l: Math.max(0, vb.x - bb.x),
        t: Math.max(0, vb.y - bb.y),
        r: Math.max(0, (bb.x + bb.width) - (vb.x + vb.width)),
        b: Math.max(0, (bb.y + bb.height) - (vb.y + vb.height)),
      };
      const worst = Math.max(d.l, d.t, d.r, d.b);
      if (worst > 0.5) over = { d, worst: +worst.toFixed(1),
                                vb: [vb.x, vb.y, vb.width, vb.height] };
    } catch (e) {}
    // 文字の重なり（画面座標で総当たり）
    const ts = [...svg.querySelectorAll('text')];
    const laps = [];
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i].getBoundingClientRect(), b = ts[j].getBoundingClientRect();
        if (!a.width || !b.width) continue;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 1 && iy > 1) {
          const ratio = (ix * iy) / Math.min(a.width * a.height, b.width * b.height);
          if (ratio > 0.25) laps.push([ts[i].textContent.trim().slice(0, 18),
                                       ts[j].textContent.trim().slice(0, 18),
                                       +ratio.toFixed(2)]);
        }
      }
    }
    // 箱からのはみ出し
    const boxOver = [];
    svg.querySelectorAll('rect').forEach(r => {
      const rb = r.getBoundingClientRect();
      if (!rb.width) return;
      ts.forEach(t => {
        const tb = t.getBoundingClientRect();
        const cx = tb.left + tb.width / 2, cy = tb.top + tb.height / 2;
        const inside = cx > rb.left && cx < rb.right && cy > rb.top && cy < rb.bottom;
        if (!inside) return;
        const d = Math.max(rb.left - tb.left, tb.right - rb.right,
                           rb.top - tb.top, tb.bottom - rb.bottom);
        if (d > 1) boxOver.push([t.textContent.trim().slice(0, 18), +d.toFixed(1)]);
      });
    });
    if (over || laps.length || boxOver.length)
      out.push({ key, over, laps: laps.slice(0, 4), boxOver: boxOver.slice(0, 4) });
  });
  return out;
}
"""


def main():
    from playwright.sync_api import sync_playwright

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["4"]["master_bunsatsu"]
    items = []
    for kind in ("fukushu",):
        for no, sets in sorted(node.get(kind, {}).items(), key=lambda kv: int(kv[0])):
            if not (14 <= int(no) <= 28):      # 第2分冊の回だけ
                continue
            for x in sets:
                if x.get("svg"):
                    items.append(("No.%s/%s" % (no, x["src"]), x["svg"]))
    print("検査対象:", len(items), "枚")

    # style.css を読ませる（フォントが違うと幅が変わる）
    css = io.open(os.path.join(BASE, "style.css"), encoding="utf-8").read()
    parts = []
    for key, svg in items:
        svg2 = svg.replace("<svg", '<svg data-key="%s"' % key, 1)
        parts.append('<div class="sq-figure">%s</div>' % svg2)
    html = ("<!doctype html><meta charset='utf-8'><style>%s</style>"
            "<body class='sansu-quiz-area'>%s</body>" % (css, "".join(parts)))
    tmp = os.path.join(BASE, "scripts", "svg_check_g4b2.html")
    io.open(tmp, "w", encoding="utf-8").write(html)

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 420, "height": 900})
        pg.goto("file:///" + tmp.replace("\\", "/"))
        pg.wait_for_timeout(1200)
        res = pg.evaluate(MEASURE_JS)
        b.close()

    n1 = sum(1 for r in res if r["over"])
    n2 = sum(1 for r in res if r["laps"])
    n3 = sum(1 for r in res if r["boxOver"])
    print("① 枠からのはみ出し: %d枚" % n1)
    print("② 文字の重なり:     %d枚" % n2)
    print("③ 箱からのはみ出し: %d枚" % n3)
    out = os.path.join(BASE, "scripts", "svg_findings_g4b2.json")
    io.open(out, "w", encoding="utf-8").write(json.dumps(res, ensure_ascii=False, indent=1))
    print("→", out)


if __name__ == "__main__":
    main()
