# -*- coding: utf-8 -*-
"""第2講座の小口の図を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第2講座.pdf を200dpiで出して目視
  No.24 大問1〜3 … PDF p19（本文p20）タンクとA管・B管（大問3はA・B管とせんC）
  No.30 大問1・2 … PDF p55（本文p56）3つの正方形／長方形と4つの弧
  No.30 大問9・10 … PDF p59（本文p60）長方形ABCDと3つの正方形／バスの停留所

使い方: python scripts/genbo_svg_k2_small.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
SHADE = 'rgba(255,209,102,0.22)'


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle"):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, fill, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        x1, y1, x2, y2, stroke, w, d)


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12):
    """★寸法線。測っている線分に沿って細線＋両端の爪＋中央にラベル。
       「どの辺のどこが何cmか」を必ず分かるようにする（本人指示 2026-08-11）。
       1本の辺が分かれているときは、区間ごとに別々に呼ぶ。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = nx / off * 4, ny / off * 4
    return "".join([
        ln(round(ax, 1), round(ay, 1), round(bx, 1), round(by, 1), GRAY, 1.2),
        ln(round(ax - tx, 1), round(ay - ty, 1), round(ax + tx, 1), round(ay + ty, 1), GRAY, 1.2),
        ln(round(bx - tx, 1), round(by - ty, 1), round(bx + tx, 1), round(by + ty, 1), GRAY, 1.2),
        t(round((ax + bx) / 2 + nx * 0.85, 1),
          round((ay + by) / 2 + ny * 0.85 + 4, 1), label, TX, size),
    ])


def tap(x, y, label, flip=False):
    """じゃ口。実物は「└ 型の管＋横向きの口」。flip=Trueで下向き（出す側）"""
    d = -1 if flip else 1
    return "".join([
        '<rect x="%d" y="%d" width="22" height="9" fill="none" stroke="%s" stroke-width="2"/>'
        % (x - 11, y, LINE),
        ln(x, y, x, y + 9 * d, LINE, 2),
        t(x, y - 8 if not flip else y + 26, label, TX, 13),
    ])


FIGS = {}

# ── No.24 大問1・2（HG-3830/3831）タンク：左上にA管、右下にB管 ──────────
def tank(cap_label):
    body = [
        # タンクは「左かべ・底・右かべ」だけの開いた形（実物どおり）
        '<polyline points="70,60 70,175 250,175 250,60" fill="none" stroke="%s" stroke-width="2.5"/>' % LINE,
        tap(70, 34, "A"),
        ln(70, 43, 70, 60, LINE, 2),
        # 右下の出口B
        '<polyline points="250,150 268,150 268,168" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
        t(262, 142, "B", TX, 13),
    ]
    if cap_label:
        body.append(t(160, 122, cap_label, GRAY, 13))
    return svg("0 0 330 200", "".join(body))


FIGS["HG-3830"] = tank("30L")
FIGS["HG-3831"] = tank(None)          # 大問2は容積が書かれていない

# ── No.24 大問3（HG-3832）水そう：上にA管とB管、右下にせんC ──────────
FIGS["HG-3832"] = svg("0 0 330 210", "".join([
    '<polyline points="70,70 70,185 260,185 260,70" fill="none" stroke="%s" stroke-width="2.5"/>' % LINE,
    tap(110, 44, "A"), ln(110, 53, 110, 70, LINE, 2),
    tap(215, 44, "B"), ln(215, 53, 215, 70, LINE, 2),
    '<polyline points="260,158 278,158 278,176" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(272, 150, "C", TX, 13),
    t(165, 130, "90L", GRAY, 13),
]))

# ── No.30 大問1（HG-3918）3つの正方形A・B・C ──────────────────────
FIGS["HG-3918"] = svg("0 0 330 200", "".join([
    # C（大きい正方形・上）
    '<rect x="150" y="25" width="105" height="105" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(202, 82, "C", TX, 14),
    # B（下・左寄り）
    '<rect x="150" y="130" width="70" height="46" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(185, 158, "B", TX, 14),
    # A（小さい正方形・Bの右）
    '<rect x="220" y="130" width="35" height="35" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(237, 152, "A", TX, 12),
    # 寸法（どの辺のどこかが分かるように、その線分に沿って引く）
    dim(150, 25, 150, 130, "16cm", 22, 1),      # 左：Cの一辺＋Bの高さ＝16cm
    dim(255, 130, 255, 165, "4cm", 20, -1),     # 右：Aの一辺＝4cm
]))

# ── No.30 大問2（HG-3919）長方形と4つの弧・中央が斜線 ──────────────
FIGS["HG-3919"] = svg("0 0 330 215", "".join([
    '<rect x="105" y="25" width="130" height="165" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(100, 20, "A", TX, 12, "end"), t(240, 20, "D", TX, 12, "start"),
    t(100, 203, "B", TX, 12, "end"), t(240, 203, "C", TX, 12, "start"),
    # 4すみを中心とする弧が内側へふくらみ、中央に「4つのとがりのある星形」の斜線部ができる。
    # とがり（カスプ）は 上=AD上・左=AB上・右=DC上・下=BC上 の4か所（実物どおり）
    '<path d="M170 25 Q148 88 105 110 Q152 132 170 190 Q192 132 235 120 Q192 82 170 25 Z"'
    ' fill="%s" stroke="%s" stroke-width="2"/>' % (SHADE, HI),
    # 上辺のうち「とがりからDまで」が6cm、下辺のうち「Cからとがりまで」が3cm、左辺ABが15cm
    dim(170, 25, 235, 25, "6cm", 15, -1),
    dim(170, 190, 235, 190, "3cm", 15, 1),
    dim(105, 25, 105, 190, "15cm", 20, 1),
    '<circle cx="235" cy="108" r="3.5" fill="%s"/>' % TX, t(246, 112, "E", TX, 12, "start"),
]))

# ── No.30 大問9（HG-3926）長方形ABCDと3つの正方形 ─────────────────
FIGS["HG-3926"] = svg("0 0 340 205", "".join([
    # 長方形ABCD（A左下・B右下・C右上・D左上）
    '<rect x="60" y="60" width="220" height="105" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(54, 180, "A", TX, 12, "end"), t(286, 180, "B", TX, 12, "start"),
    t(286, 55, "C", TX, 12, "start"), t(54, 55, "D", TX, 12, "end"),
    # 正方形AEGH（AE=2cm・上へ伸びてH,G）
    '<rect x="60" y="35" width="110" height="130" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    t(54, 30, "H", TX, 12, "end"), t(176, 30, "G", TX, 12, "start"),
    # 正方形BCIJ
    ln(225, 35, 225, 165, LINE, 1.6), t(231, 118, "J", TX, 12, "start"),
    t(231, 66, "I", TX, 12, "start"),
    # 小さい正方形FGKL
    '<rect x="150" y="35" width="20" height="20" fill="none" stroke="%s" stroke-width="1.6"/>' % HI,
    t(148, 30, "K", TX, 11, "end"), t(176, 62, "F", TX, 11, "start"), t(150, 68, "L", TX, 11),
    # 底辺の寸法（AE と EB を別々の寸法線で。まとめない）
    '<circle cx="170" cy="165" r="3" fill="%s"/>' % TX, t(170, 195, "E", TX, 12),
    dim(60, 165, 170, 165, "2cm", 14, 1),
    dim(170, 165, 280, 165, "2cm", 14, 1),
]))

# ── No.30 大問10（HG-3927）バスの停留所と山本君の家 ─────────────────
FIGS["HG-3927"] = svg("0 0 400 130", "".join([
    ln(40, 80, 370, 80, GRAY, 2),
    ln(40, 80, 130, 80, GRAY, 2, "6,4"),
    t(130, 62, "㋐", TX, 14), '<circle cx="130" cy="80" r="3" fill="%s"/>' % TX,
    ln(190, 70, 190, 90, LINE, 2), t(190, 62, "㋑", TX, 14),
    ln(320, 70, 320, 90, LINE, 2), t(320, 62, "㋒", TX, 14),
    t(255, 52, "1.2km", TX, 13),
    '<path d="M190 66 Q255 44 320 66" fill="none" stroke="%s" stroke-width="1.3"/>' % GRAY,
    t(268, 104, "㋓", HI, 14), t(268, 88, "×", HI, 13),
    t(200, 122, "㋓は山本君の家（㋑と㋒の間）", GRAY, 11),
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
