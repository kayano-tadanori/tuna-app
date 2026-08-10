# -*- coding: utf-8 -*-
"""第3分冊（kouza1/kouza2）のSVGを、アプリの暗い背景で読めるように直す。

作った当初、既存の図（fukushu側）の作法を外していた：
  1. <text> に fill を書かず、黒のまま＝暗い背景でほぼ見えない（123/124枚）
  2. <svg> に style="display:block;margin:0 auto;max-width:100%" が無い（124/124枚）
  3. #333 / #888 / #1d3557 など暗い色を線に使っていて、背景に沈む

既存図が使っている明るい配色（#4f7cff / #ff6b6b / #22c55e / #9aa3c0）に寄せる。
形・寸法・座標は一切さわらない（色と属性だけ）。

使い方: python scripts/fix_daimon3_svg_contrast.py [--write]
"""
import io, json, os, re, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

SVG_STYLE = 'style="display:block;margin:0 auto;max-width:100%"'
TEXT_FILL = "#c9d4f0"      # 既定の文字色（明るい青白）
CAPTION_FILL = "#9aa3c0"   # 補助的な説明文（既存図と同じ灰）

# 暗い色 → 暗背景でも見える色（既存図の配色に合わせる）
COLOR_MAP = {
    "#333": "#c9d4f0",
    "#888": "#9aa3c0",
    "#666": "#9aa3c0",
    "#ccc": "#9aa3c0",
    "#ddd": "#9aa3c0",
    "#1d3557": "#4f7cff",
    "#1d3561": "#4f7cff",   # 打ちまちがいで混ざっていた色も拾う
    "#457b9d": "#4f7cff",
    "#e63946": "#ff6b6b",
    "#eee": "#2a3350",      # 電球などの「消えている」塗り。背景寄りの暗い色でよい
    "#fff": "#e8edfb",
    "#fde9ea": "#3a2740",
}


def fix_svg(s):
    # 1) ルート<svg>に style を足す（無いときだけ）
    m = re.match(r"<svg([^>]*)>", s)
    if m and "style=" not in m.group(1):
        s = s.replace(m.group(0), "<svg%s %s>" % (m.group(1), SVG_STYLE), 1)

    # 2) 色の置きかえ（属性値としての完全一致だけ。座標や数値は触らない）
    for old, new in COLOR_MAP.items():
        s = s.replace('fill="%s"' % old, 'fill="%s"' % new)
        s = s.replace('stroke="%s"' % old, 'stroke="%s"' % new)

    # 3) fill の無い <text> に既定の文字色を入れる
    def add_fill(mo):
        tag = mo.group(0)
        if "fill=" in tag:
            return tag
        return tag[:-1] + ' fill="%s">' % TEXT_FILL

    s = re.sub(r"<text[^>]*>", add_fill, s)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["5"]["sairei"]
    changed = 0
    total = 0
    for kind in ("kouza1", "kouza2"):
        for no, sets in node.get(kind, {}).items():
            for x in sets:
                s = x.get("svg")
                if not s:
                    continue
                total += 1
                new = fix_svg(s)
                if new != s:
                    x["svg"] = new
                    changed += 1
    print("第3分冊のsvg %d枚のうち %d枚を直した" % (total, changed))

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
