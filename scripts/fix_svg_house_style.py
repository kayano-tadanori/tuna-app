# -*- coding: utf-8 -*-
"""図SVGを家の作法にそろえる。

  ① ルートに style="display:block;margin:0 auto;max-width:100%" が無い → 付ける
     （width/height 属性を持つ図には height:auto も足す。付けないと横だけ縮んでつぶれる）
  ② <text> に fill が無い → 親からの継承をたどって決める
       継承が無い／none／黒 → #e8ecf5 を書く（暗い背景で読めるように）
       継承が明るい色      → その色をそのまま書く（見た目は変わらない）
       継承が暗い色        → **さわらない**。明るいカードの上の濃い文字かもしれないので、
                             判断が要るものとして報告する

★どちらも「見た目を変えずに作法だけそろえる」のが原則。
  変わるのは「もともと見えていなかった文字」だけ。

使い方:
  python scripts/fix_svg_house_style.py            … 何件直るか見るだけ
  python scripts/fix_svg_house_style.py --write    … data/hama_daimon.json と原簿に書く
"""
import argparse
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo  # noqa: E402

HOUSE = "display:block;margin:0 auto;max-width:100%"
LIGHT_TEXT = "#e8ecf5"
TAG = re.compile(r"<(/?)([a-zA-Z][\w:-]*)((?:[^>\"']|\"[^\"]*\"|'[^']*')*)(/?)>")
ATTR = re.compile(r"""([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')""")


def attrs(s):
    out = {}
    for m in ATTR.finditer(s):
        out[m.group(1)] = m.group(3) if m.group(3) is not None else m.group(4)
    return out


def is_dark(c):
    """#rgb / #rrggbb をざっくり明るさで判定（0.35未満＝暗い）。"""
    c = (c or "").strip().lower()
    if not c.startswith("#"):
        return False
    h = c[1:]
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    if len(h) != 6:
        return False
    try:
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return False
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0 < 0.35


def add_max_width(svg):
    """ルートの <svg …> に家のstyleを足す。すでにあれば何もしない。"""
    m = TAG.match(svg)
    if not m or m.group(2).lower() != "svg":
        return svg, False
    head = m.group(0)
    a = attrs(m.group(3))
    if "max-width" in (a.get("style") or ""):
        return svg, False
    style = HOUSE
    if "width" in a and "height" in a:      # 幅を決め打ちしている図は高さも自動に
        style += ";height:auto"
    if a.get("style"):
        style = a["style"].rstrip(";") + ";" + style
        new = re.sub(r"""style\s*=\s*("[^"]*"|'[^']*')""",
                     'style="%s"' % style, head, count=1)
    else:
        new = head[:-1].rstrip("/").rstrip() + ' style="%s"%s>' % (style, " /" if m.group(4) else "")
    return new + svg[m.end():], True


def add_text_fill(svg):
    """<text> に fill を書く。親からの継承をたどって色を決める。
       戻り値: (直したsvg, 直した数, 判断が要る数)"""
    stack = [None]          # 継承している fill
    out, pos, n_fix, n_judge = [], 0, 0, 0
    for m in TAG.finditer(svg):
        out.append(svg[pos:m.start()])
        pos = m.end()
        close, tag, raw, selfclose = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
        if close:
            if len(stack) > 1:
                stack.pop()
            out.append(m.group(0))
            continue
        a = attrs(raw)
        inherit = stack[-1]
        if tag == "text" and "fill" not in a:
            if inherit and is_dark(inherit):
                n_judge += 1                      # 暗い色を継いでいる＝勝手に変えない
                out.append(m.group(0))
            else:
                use = inherit if (inherit and inherit != "none") else LIGHT_TEXT
                out.append(m.group(0)[:-1].rstrip("/").rstrip()
                           + ' fill="%s"%s>' % (use, " /" if selfclose else ""))
                n_fix += 1
        else:
            out.append(m.group(0))
        if not selfclose and tag not in ("br",):
            stack.append(a.get("fill", inherit))
    out.append(svg[pos:])
    return "".join(out), n_fix, n_judge


def fix(svg):
    svg, a = add_max_width(svg)
    svg, b, judge = add_text_fill(svg)
    return svg, a, b, judge


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    path = os.path.join(BASE, "data", "hama_daimon.json")
    d = json.load(io.open(path, encoding="utf-8"))
    n_mw = n_fill = n_judge = 0
    judged = []
    changed = []

    def walk(o):
        nonlocal n_mw, n_fill, n_judge
        if isinstance(o, dict):
            if isinstance(o.get("steps"), list):
                targets = [(o, "svg", "大問")] + [(s, "svg", "小問%d" % i)
                                                  for i, s in enumerate(o.get("steps", []), 1)]
                for holder, key, w in targets:
                    svg = holder.get(key) or ""
                    if not svg or "<svg" not in svg:
                        continue
                    new, a, b, j = fix(svg)
                    if a: n_mw += 1
                    if b: n_fill += 1
                    if j:
                        n_judge += 1
                        judged.append((o.get("id"), w, j))
                    if new != svg:
                        changed.append((o.get("id"), w))
                        holder[key] = new
                return
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)

    walk(d)
    print("max-width を足した図:", n_mw, "枚")
    print("<text> に fill を書いた図:", n_fill, "枚")
    print("暗い色を継いでいて さわらなかった図:", n_judge, "枚")
    for x in judged[:20]:
        print("   ", x)

    # ── 原簿の図SVG欄にも同じ直しを入れる（写し戻されないように）──
    gp = find_genbo()
    g = io.open(gp, encoding="utf-8").read()
    g_mw = g_fill = 0

    def repl_line(m):
        nonlocal g_mw, g_fill
        head, rest = m.group(1), m.group(2)
        bq = re.match(r"`(.*?)`", rest, re.S)
        if not bq:
            return m.group(0)
        svg = bq.group(1)
        if "<svg" not in svg:
            return m.group(0)
        new, a, b, _ = fix(svg)
        if a: g_mw += 1
        if b: g_fill += 1
        return head + "`" + new + "`" + rest[bq.end():]

    g2 = re.sub(r"(^- 図SVG[^\n:]*:[ \t]*)(.*)$", repl_line, g, flags=re.M)

    def repl_block(m):
        nonlocal g_mw, g_fill
        svg = m.group(2)
        if "<svg" not in svg:
            return m.group(0)
        new, a, b, _ = fix(svg)
        if a: g_mw += 1
        if b: g_fill += 1
        return m.group(1) + new + m.group(3)

    g2 = re.sub(r"(^- 図SVG[^\n:]*:\n```html\n)(.*?)(\n```)", repl_block, g2, flags=re.M | re.S)
    print("原簿: max-width %d件 ／ text fill %d件" % (g_mw, g_fill))

    if not args.write:
        print("（--write を付けると書きこみます）")
        return
    io.open(path, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    io.open(gp, "w", encoding="utf-8").write(g2)
    print("✅ 書きこみ完了（アプリ %d枚 ／ 原簿）" % len(changed))


main()
