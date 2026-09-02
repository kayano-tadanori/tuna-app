# -*- coding: utf-8 -*-
"""check_text_contrast.py が「地に溶けて読めない」と測った <text> の色を、
   読める色（#e8ecf5）に直す。アプリと原簿の両方に同じ直しを入れる。

★対象は「実測で読めなかった文字」だけ。色の名前では選ばない。
  明るいカードの上の濃い文字（同じ #1a2340 でも読める）は そのまま残す。

使い方:
  python scripts/fix_text_contrast.py docs/_text_lowcontrast.json
  python scripts/fix_text_contrast.py docs/_text_lowcontrast.json --write
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

LIGHT = "#e8ecf5"   # 地が暗いとき
DARK = "#1a2340"    # 地が明るいとき
TEXT = re.compile(r"<text[^>]*>")


def recolor(svg, idxs):
    """svg の idxs（{番号: 使う色}）の <text> の fill を読める色にする。"""
    out, pos, n, done = [], 0, 0, 0
    for m in TEXT.finditer(svg):
        out.append(svg[pos:m.start()]); pos = m.end()
        t = m.group(0)
        if n in idxs:
            use = idxs[n]
            if re.search(r"""fill\s*=\s*("[^"]*"|'[^']*')""", t):
                t = re.sub(r"""fill\s*=\s*("[^"]*"|'[^']*')""", 'fill="%s"' % use, t, count=1)
            else:
                t = t[:-1].rstrip("/").rstrip() + ' fill="%s">' % use
            done += 1
        out.append(t); n += 1
    out.append(svg[pos:])
    return "".join(out), done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    bad = json.load(io.open(args.report, encoding="utf-8"))
    want = {}
    for b in bad:
        fig_id, where = b["fig"].rsplit("__", 1)
        # ★地が明るいなら濃い色、地が暗いなら明るい色。色の名前ではなく実測の地の明るさで決める
        use = DARK if b.get("bglum", 0) > 0.45 else LIGHT
        want.setdefault((fig_id, where), {})[b["idx"]] = use
    print("直す図:", len(want), "枚 ／ 文字:", len(bad), "個")

    path = os.path.join(BASE, "data", "hama_daimon.json")
    d = json.load(io.open(path, encoding="utf-8"))
    n_app = 0
    touched = {}

    def walk(o):
        nonlocal n_app
        if isinstance(o, dict):
            if isinstance(o.get("steps"), list):
                items = [(o, "大問")] + [(s, "q%d" % i) for i, s in enumerate(o.get("steps", []), 1)]
                for holder, w in items:
                    key = (o.get("id"), w)
                    if key not in want:
                        continue
                    svg = holder.get("svg") or ""
                    new, done = recolor(svg, want[key])
                    if new != svg:
                        holder["svg"] = new
                        n_app += done
                        touched[key] = (svg, new)
                return
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)

    walk(d)
    print("アプリで色を直した文字:", n_app, "個")
    miss = [k for k in want if k not in touched]
    if miss:
        print("⚠ 見つからなかった図:", miss)

    # ── 原簿にも同じ直しを（写し戻されないように）──
    gp = find_genbo()
    g = io.open(gp, encoding="utf-8").read()
    olds = {old: new for old, new in touched.values()}
    n_gen = 0
    for old, new in olds.items():
        if old and old in g:
            g = g.replace(old, new)
            n_gen += 1
    print("原簿でも直した図:", n_gen, "枚（残りはアプリにしかない図）")

    if not args.write:
        print("（--write を付けると書きこみます）")
        return
    io.open(path, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    io.open(gp, "w", encoding="utf-8").write(g)
    print("✅ 書きこみ完了")


main()
