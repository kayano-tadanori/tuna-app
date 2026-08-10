# -*- coding: utf-8 -*-
"""図の「中身」がまちがっていた分を直す（色の修正とは別）。

2026-08-11 の図の精査で見つかった分：
  HG-3632 … 9個の電球の問題なのに 6個しか描いていなかった。
            「⑦⑧⑨は上の図の外側」という苦しい注記でごまかしていたので、9個ぜんぶ描き直す。
  HG-3874 … グラフを読んで速さを出す問題なのに、目もりの数値がどこにも無く、
            設問文にも「40分で2km」の 2km が書かれていないため、そもそも解けなかった。
            実物のグラフと同じように、目もりの数値を図に入れる。

使い方: python scripts/fix_daimon3_svg_content.py [--write]
"""
import io, json, os, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

# ── HG-3632：円形にならんだ9個の電球（①→⑦→④→①の3個が点滅する）──
BULBS_9 = (
    '<svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"'
    ' style="display:block;margin:0 auto;max-width:100%">'
    '<circle cx="130" cy="130" r="95" fill="none" stroke="#9aa3c0" stroke-width="2"/>'
    '<g font-size="15" text-anchor="middle">'
    # 9個を真上から時計回りに40度ずつ
    '<circle cx="130" cy="35" r="15" fill="#ff6b6b"/><text x="130" y="40" fill="#e8edfb">①</text>'
    '<circle cx="191" cy="58" r="15" fill="#2a3350" stroke="#9aa3c0"/><text x="191" y="63" fill="#c9d4f0">②</text>'
    '<circle cx="223" cy="114" r="15" fill="#2a3350" stroke="#9aa3c0"/><text x="223" y="119" fill="#c9d4f0">③</text>'
    '<circle cx="212" cy="177" r="15" fill="#f4a261"/><text x="212" y="182" fill="#e8edfb">④</text>'
    '<circle cx="163" cy="219" r="15" fill="#2a3350" stroke="#9aa3c0"/><text x="163" y="224" fill="#c9d4f0">⑤</text>'
    '<circle cx="97" cy="219" r="15" fill="#2a3350" stroke="#9aa3c0"/><text x="97" y="224" fill="#c9d4f0">⑥</text>'
    '<circle cx="48" cy="177" r="15" fill="#4f7cff"/><text x="48" y="182" fill="#e8edfb">⑦</text>'
    '<circle cx="37" cy="114" r="15" fill="#2a3350" stroke="#9aa3c0"/><text x="37" y="119" fill="#c9d4f0">⑧</text>'
    '<circle cx="69" cy="58" r="15" fill="#2a3350" stroke="#9aa3c0"/><text x="69" y="63" fill="#c9d4f0">⑨</text>'
    '</g>'
    # ①→⑦→④ の点滅の順を矢印で示す
    '<defs><marker id="ar9" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
    '<path d="M0,0 L8,4 L0,8 Z" fill="#ffd166"/></marker></defs>'
    '<path d="M120 47 L60 165" stroke="#ffd166" stroke-width="2" fill="none" marker-end="url(#ar9)"/>'
    '<path d="M63 186 L197 180" stroke="#ffd166" stroke-width="2" fill="none" marker-end="url(#ar9)"/>'
    '<path d="M205 163 L138 49" stroke="#ffd166" stroke-width="2" fill="none" marker-end="url(#ar9)"/>'
    '<text x="130" y="127" font-size="13" text-anchor="middle" fill="#ffd166">①→⑦→④→①</text>'
    '<text x="130" y="145" font-size="12" text-anchor="middle" fill="#c9d4f0">6つ目ごとに点滅＝3個だけつく</text>'
    '</svg>'
)

# ── HG-3874：太郎とお父さんの進行グラフ（目もりの数値を入れる）──
# 実物のグラフが持っている値：40分で2km、公園は6km、
# 父は10分後に出発・40分で家へ、50分で追いつき、100分で公園着（太郎は130分）
GRAPH_3874 = (
    '<svg viewBox="0 0 420 250" xmlns="http://www.w3.org/2000/svg"'
    ' style="display:block;margin:0 auto;max-width:100%">'
    '<line x1="55" y1="30" x2="55" y2="200" stroke="#9aa3c0" stroke-width="2"/>'
    '<line x1="55" y1="200" x2="395" y2="200" stroke="#9aa3c0" stroke-width="2"/>'
    # よこ目もり（分）
    '<g font-size="12" fill="#c9d4f0" text-anchor="middle">'
    '<text x="55" y="218">0</text><text x="139" y="218">40</text><text x="160" y="232">50</text>'
    '<text x="244" y="218">90</text><text x="265" y="232">100</text><text x="328" y="218">130</text>'
    '<text x="370" y="232">（分）</text></g>'
    # たて目もり（km）
    '<g font-size="12" fill="#c9d4f0" text-anchor="end">'
    '<text x="50" y="175">0</text><text x="50" y="147">2</text><text x="50" y="63">5.5</text>'
    '<text x="50" y="35">6</text></g>'
    '<text x="30" y="24" font-size="12" fill="#c9d4f0">(km)</text>'
    # 目もり線
    '<g stroke="#3a4568" stroke-width="1" stroke-dasharray="3,3">'
    '<line x1="55" y1="143" x2="139" y2="143"/><line x1="139" y1="143" x2="139" y2="200"/>'
    '<line x1="55" y1="59" x2="328" y2="59"/><line x1="328" y1="59" x2="328" y2="200"/></g>'
    # 太郎（一定の速さ・130分で公園）
    '<polyline points="55,171 328,59" fill="none" stroke="#ff6b6b" stroke-width="3"/>'
    '<text x="336" y="55" font-size="13" fill="#ff6b6b">太郎</text>'
    # お父さん（10分後に出発→40分で家へもどる→50分から追いかけ100分で公園）
    '<polyline points="76,171 139,143 160,171 265,59" fill="none" stroke="#4f7cff"'
    ' stroke-width="3" stroke-dasharray="7,4"/>'
    '<text x="200" y="120" font-size="13" fill="#4f7cff">お父さん</text>'
    '<text x="150" y="192" font-size="11" fill="#9aa3c0">家にもどる</text>'
    '</svg>'
)

FIXES = [
    ("kouza1", "21", "HG-3632", BULBS_9),
    ("kouza2", "27", "HG-3874", GRAPH_3874),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["5"]["sairei"]
    done = 0
    for kind, no, hg, svg in FIXES:
        for x in node[kind][no]:
            if x["hg"] == hg:
                x["svg"] = svg
                done += 1
                print("直した:", hg)
    print("合計 %d 枚" % done)

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
