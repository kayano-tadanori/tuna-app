# -*- coding: utf-8 -*-
"""第1講座 No.21「数の性質(3)」の図（HG-3629/3631/3632/3637）を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDF p3（本文p4）・p4（本文p5）・p6（本文p7）を
  200dpiで出して目視。原簿に図は無いのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。

実物で確かめたこと：
  大問8  … Aに3本の旗（上から赤・青・黄）が1本のポールに付き、A—100m—B の直線
  大問10 … 円の外側に 497 498 499 500 1 2 3 4 … 16 と数が並び、両端に「…」
  大問11 … ①〜⑨が右まわりに円形にならび、**となり合う番号の間に矢印**（①→⑦→④ではない）
  大問16 … 長方形ABCD（AD=20cm・AB=10cm）、BC上のE、A→E→（上）→ で P まで跳ね返る道

使い方: python scripts/genbo_svg_no21.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        x, y, size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        x1, y1, x2, y2, stroke, w, d)


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12):
    """★寸法線。「どの辺のどこが何cmか」が分かるように、測っている線分に沿って
       細線を引き、両端に爪を付け、中央にラベルを置く（本人指示 2026-08-11）。
       off＝図から離す量、side＝どちら側に出すか（+1/-1）。
       1本の辺が分かれているときは、区間ごとにこれを呼ぶ（まとめない）。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side      # 法線方向
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = nx / off * 4, ny / off * 4                     # 爪（法線向き・長さ4）
    return "".join([
        ln(round(ax, 1), round(ay, 1), round(bx, 1), round(by, 1), GRAY, 1.2),
        ln(round(ax - tx, 1), round(ay - ty, 1), round(ax + tx, 1), round(ay + ty, 1), GRAY, 1.2),
        ln(round(bx - tx, 1), round(by - ty, 1), round(bx + tx, 1), round(by + ty, 1), GRAY, 1.2),
        t(round((ax + bx) / 2 + nx * 0.85, 1),
          round((ay + by) / 2 + ny * 0.85 + 4, 1), label, TX, size),
    ])


FIGS = {}

# ── 大問8（HG-3629）Aに3色の旗・A—100m—B ──────────────────────
FIGS["HG-3629"] = svg("0 0 420 170", "".join([
    ln(60, 30, 60, 130, GRAY, 2.5),                       # ポール
    '<polygon points="60,34 108,44 60,54" fill="#ff6b6b"/>',
    '<polygon points="60,58 108,68 60,78" fill="%s"/>' % LINE,
    '<polygon points="60,82 108,92 60,102" fill="%s"/>' % HI,
    t(50, 44, "赤", TX, 12, "end"), t(50, 68, "青", TX, 12, "end"), t(50, 92, "黄", TX, 12, "end"),
    ln(60, 130, 390, 130, GRAY, 2.5),
    ln(390, 122, 390, 138, GRAY, 2),
    t(56, 146, "A", TX, 13, "end"), t(396, 146, "B", TX, 13, "start"),
    dim(60, 130, 390, 130, "100m", 16, 1),          # AB間の寸法線
    t(210, 176, "2mごとに赤旗・3mごとに青旗・4mごとに黄旗", GRAY, 11),
]))

# ── 大問10（HG-3631）円周に 1〜500 が順に書かれている ──────────────
_ring = []
_labels = ["497", "498", "499", "500", "1", "2", "3", "4", "5", "6",
           "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]
for i, lab in enumerate(_labels):
    ang = math.radians(-118 + i * 12)          # 上を中心に右へ並べる
    x = 175 + 92 * math.cos(ang)
    y = 108 + 92 * math.sin(ang)
    _ring.append(t(round(x, 1), round(y, 1), lab, TX, 10))
FIGS["HG-3631"] = svg("0 0 350 215", "".join([
    '<circle cx="175" cy="108" r="76" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
] + _ring + [
    t(62, 96, "…", GRAY, 12), t(292, 168, "…", GRAY, 12),
    t(175, 104, "1から時計回りに", GRAY, 11),
    t(175, 120, "8番目ごとに○印", GRAY, 11),
]))

# ── 大問11（HG-3632）9個の電球が円形・となり合う番号に矢印 ─────────────
# ⚠ .sq-figure svg は max-height:260px。縦長のviewBoxだと下が切れるので、必ず横長にする
CX, CY, R = 175, 108, 82
_b = []
for i in range(9):
    ang = math.radians(-90 + i * 40)           # ①を上にして右まわり
    x = CX + R * math.cos(ang)
    y = CY + R * math.sin(ang)
    _b.append('<circle cx="%.1f" cy="%.1f" r="14" fill="none" stroke="%s" stroke-width="2"/>'
              % (x, y, LINE))
    _b.append(t(round(x, 1), round(y + 5, 1), "①②③④⑤⑥⑦⑧⑨"[i], TX, 13))
    # となり合う電球のあいだに右まわりの矢印
    a1 = math.radians(-90 + i * 40 + 13)
    a2 = math.radians(-90 + (i + 1) * 40 - 13)
    x1, y1 = CX + R * math.cos(a1), CY + R * math.sin(a1)
    x2, y2 = CX + R * math.cos(a2), CY + R * math.sin(a2)
    _b.append('<path d="M%.1f %.1f A%d %d 0 0 1 %.1f %.1f" fill="none" stroke="%s"'
              ' stroke-width="1.6" marker-end="url(#ar)"/>' % (x1, y1, R, R, x2, y2, HI))
FIGS["HG-3632"] = svg("0 0 350 215", "".join([
    '<defs><marker id="ar" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">'
    '<path d="M0,0 L7,3.5 L0,7 Z" fill="%s"/></marker></defs>' % HI,
] + _b + [
    t(175, 104, "9個が円形", GRAY, 11), t(175, 120, "右まわり", GRAY, 11),
]))

# ── 大問16（HG-3637）長方形ABCD・BC上のE・点Pの道 ─────────────────
FIGS["HG-3637"] = svg("0 0 340 210", "".join([
    '<rect x="45" y="45" width="250" height="115" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(40, 42, "A", TX, 13, "end"), t(300, 42, "D", TX, 13, "start"),
    t(40, 172, "B", TX, 13, "end"), t(300, 172, "C", TX, 13, "start"),
    dim(45, 45, 295, 45, "20cm", 16, -1),           # 上辺AD
    dim(45, 45, 45, 160, "10cm", 20, 1),            # 左辺AB
    dim(45, 160, 110, 160, "BE", 14, 1),            # BE（求める長さ）
    # A→E→（上へ）→ P と跳ね返る道すじ
    '<polyline points="45,45 110,160 175,45 240,105" fill="none" stroke="%s" stroke-width="2"'
    ' marker-end="url(#ar2)"/>' % HI,
    '<defs><marker id="ar2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
    '<path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % HI,
    '<circle cx="110" cy="160" r="3.5" fill="%s"/>' % HI,
    t(110, 178, "E", TX, 13), t(250, 118, "P", HI, 13),
    t(170, 200, "点Aを出発し、BC上のEではねかえる", GRAY, 11),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in FIGS.items():
        pat = re.compile(r"(### 【%s】.*?\n(?:.*?\n)*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
        m = pat.search(s)
        if not m:
            print("見つからない:", hg)
            continue
        s = s[:m.end(1)] + "- 図SVG: `%s`\n" % fig + s[m.end():]
        n += 1
    print("原簿に図SVGを入れた:", n, "/", len(FIGS))
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
