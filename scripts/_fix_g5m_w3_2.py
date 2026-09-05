# -*- coding: utf-8 -*-
"""小5 2nd演習（fukushu No.6〜14・g5m_w3監査2）で見つかった不具合の修正パッチ。

対象：docs/_audit/g5m_w3/audit_2.txt の45本の突き合わせで見つかった、
(1) 生徒向けの設問・解説に、原簿の内部メモ（解法欄）のローマ字文字式
    （a,b / g,x,y / k / m,n / p,q）がそのまま転記されている問題（8本）、
(2) 「分数で答えなさい」という指示なのに答えが小数で格納されている
    フォーマット不一致（2本）、
(3) わくの和の数表SVGが1〜36までしか描かれておらず、続きを示す表示が
    無い問題（1本、図SVGの座標検算ずみ・視覚要素の追加のみ）。
数値・答え・setSVGの座標そのものは一切変更しない（表記の書きかえのみ）。

見つかったが本スクリプトに含めていないもの:
- HG-0611/0612/0613 の重複実装（hd5m_13_1〜3 と hd5m2nd_13_8〜10）
  → 大問の削除・移動は対象外。docs/_audit/g5m_w3/findings_2.md に記録のみ。

使い方:
  python scripts/_fix_g5m_w3_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]

書き戻すJSONは json.dumps(d, ensure_ascii=False, indent=1)。
大問は genbo_common.iter_daimon だけで引く。置換前に「その大問の中でちょうど1回」を
assert し、置換後の文字列がすでに入っていれば何もしない（冪等）。
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


def eprint(*a):
    sys.stderr.write(" ".join(str(x) for x in a) + "\n")


# ---------------------------------------------------------------------------
# steps[i].question / steps[i].meaning / steps[i].answer の置換リスト
# (daimon id, step index, field, old text, new text)
# ---------------------------------------------------------------------------
FIXES = [
    # --- hd5m2nd_6_3（HG-0512）：解説のk（未定義のローマ字）→ □ ---
    (
        "hd5m2nd_6_3", 4, "meaning",
        "①第3段は 6でわって4・5・0あまる数（6k－2, 6k－1, 6k）。②k＝1〜16で48個、さらに k＝17 の 100 が入って49個です。",
        "①第3段は 6でわって4・5・0あまる数（6□－2, 6□－1, 6□）。②□＝1〜16で48個、さらに □＝17 の 100 が入って49個です。",
    ),

    # --- hd5m2nd_8_3（HG-0565）：k → □ ---
    (
        "hd5m2nd_8_3", 2, "question",
        "1辺が 24×k cm の正方形をつくるとき、必要な枚数は 6×(kの2乗) 枚になります。1000枚以内でつくれる kの最大はいくつですか。",
        "1辺が 24×□ cm の正方形をつくるとき、必要な枚数は 6×(□の2乗) 枚になります。1000枚以内でつくれる □の最大はいくつですか。",
    ),
    (
        "hd5m2nd_8_3", 2, "meaning",
        "①6×k×k≦1000 → k×k≦166。②k＝12 で 6×144＝864枚、k＝13 だと 1014枚で足りません。",
        "①6×□×□≦1000 → □×□≦166。②□＝12 で 6×144＝864枚、□＝13 だと 1014枚で足りません。",
    ),

    # --- hd5m2nd_9_2（HG-0542）：m→□、n→△ ---
    (
        "hd5m2nd_9_2", 1, "question",
        "たてにm枚つないだときの全長は 15×m＋1 cm になります。横にn枚では 18×n＋1 cm です。正方形になるとき、15×m と 18×n はどうなりますか。等しいなら1、ちがうなら2。",
        "たてに□枚つないだときの全長は 15×□＋1 cm になります。横に△枚では 18×△＋1 cm です。正方形になるとき、15×□ と 18×△ はどうなりますか。等しいなら1、ちがうなら2。",
    ),
    (
        "hd5m2nd_9_2", 1, "meaning",
        "①どちらも**＋1が共通**なので、残りの 15×m と 18×n が等しくなります。",
        "①どちらも**＋1が共通**なので、残りの 15×□ と 18×△ が等しくなります。",
    ),
    (
        "hd5m2nd_9_2", 2, "question",
        "15×m＝18×n となる いちばん小さい m はいくつですか。",
        "15×□＝18×△ となる いちばん小さい □ はいくつですか。",
    ),
    (
        "hd5m2nd_9_2", 2, "meaning",
        "①15と18の最小公倍数は90。②15×6＝90、18×5＝90。③m＝6、n＝5です。",
        "①15と18の最小公倍数は90。②15×6＝90、18×5＝90。③□＝6、△＝5です。",
    ),

    # --- hd5m2nd_10_3（HG-0547）：a→□、b→△ ---
    (
        "hd5m2nd_10_3", 0, "question",
        "最大公約数が15なので、A＝15×a、B＝15×b と書けます（aとbはたがいに素）。最小公倍数を15とaとbで表すと 15×a×b です。これがAの11倍と等しいとき、bはいくつですか。",
        "最大公約数が15なので、A＝15×□、B＝15×△ と書けます（□と△はたがいに素）。最小公倍数を15と□と△で表すと 15×□×△ です。これがAの11倍と等しいとき、△はいくつですか。",
    ),
    (
        "hd5m2nd_10_3", 0, "meaning",
        "①15×a×b＝11×15×a。②両辺を15×aでわると b＝11です。",
        "①15×□×△＝11×15×□。②両辺を15×□でわると △＝11です。",
    ),
    (
        "hd5m2nd_10_3", 3, "meaning",
        "①A＝45＝15×3、B＝165＝15×11。②a＝3とb＝11はたがいに素 ✓ ③最小公倍数は 15×3×11＝495です。",
        "①A＝45＝15×3、B＝165＝15×11。②□＝3と△＝11はたがいに素 ✓ ③最小公倍数は 15×3×11＝495です。",
    ),

    # --- hd5m2nd_10_4（HG-0548）：a→□、b→△ ---
    (
        "hd5m2nd_10_4", 1, "question",
        "2数を 14×a と 14×b とすると、a＋b はいくつですか。",
        "2数を 14×□ と 14×△ とすると、□＋△ はいくつですか。",
    ),
    (
        "hd5m2nd_10_4", 1, "meaning",
        "①14×(a＋b)＝126 なので a＋b＝9です。",
        "①14×(□＋△)＝126 なので □＋△＝9です。",
    ),
    (
        "hd5m2nd_10_4", 2, "question",
        "a＋b＝9 で、aとbがたがいに素になる組は何組ありますか（a＜b）。",
        "□＋△＝9 で、□と△がたがいに素になる組は何組ありますか（□＜△）。",
    ),

    # --- hd5m2nd_10_5（HG-0549）：解説のg,x,y（未定義のローマ字）を場合分け説明に書きかえ ---
    (
        "hd5m2nd_10_5", 3, "meaning",
        "①最大公約数をgとして a＝g×x、b＝g×y とおくと、差は g×(x×y－1)。②3は素数なので g×(x×y－1)＝3 は (g,x×y)＝(1,4) か (3,2) だけ。③(1,4)と(3,6)の2組です。",
        "①差が3になる組を、公約数の大きさで場合分けしてためします。②公約数が1のとき、最小公倍数はa×bなので a×b－1＝3 → a×b＝4。1と4は公約数が1なので条件に合い、(a,b)＝(1,4)。③公約数が3のとき、a,bを3×□・3×△（□と△は公約数を持たない2数）とおくと 3×(□×△－1)＝3 → □×△＝2 → (□,△)＝(1,2) → (a,b)＝(3,6)。④1〜399の範囲でためしても、これ以外の組はありません。",
    ),

    # --- hd5m2nd_13_7（HG-0610）：p→甲、q→乙 ---
    (
        "hd5m2nd_13_7", 0, "question",
        "合格者を 4×p 人と 3×p 人、不合格者を 4×q 人と 5×q 人とします。男子の受験者は 4p＋4q 人です。女子は何人ですか。3p＋5q なら1、3p＋4q なら2。",
        "合格者を 4×甲 人と 3×甲 人、不合格者を 4×乙 人と 5×乙 人とします。男子の受験者は 4甲＋4乙 人です。女子は何人ですか。3甲＋5乙 なら1、3甲＋4乙 なら2。",
    ),
    (
        "hd5m2nd_13_7", 0, "meaning",
        "①女子は合格3p人と不合格5q人。②3p＋5q人です。",
        "①女子は合格3甲人と不合格5乙人。②3甲＋5乙人です。",
    ),
    (
        "hd5m2nd_13_7", 1, "question",
        "(4p＋4q):(3p＋5q)＝8:9 から、qはpの何倍ですか。",
        "(4甲＋4乙):(3甲＋5乙)＝8:9 から、乙は甲の何倍ですか。",
    ),
    (
        "hd5m2nd_13_7", 1, "meaning",
        "①9×(4p＋4q)＝8×(3p＋5q) → 36p＋36q＝24p＋40q。②12p＝4q → q＝3pです。",
        "①9×(4甲＋4乙)＝8×(3甲＋5乙) → 36甲＋36乙＝24甲＋40乙。②12甲＝4乙 → 乙＝3甲です。",
    ),
    (
        "hd5m2nd_13_7", 2, "meaning",
        "①男子の合格は4p人、不合格は 4q＝12p人。②4p:12p＝1:3です。③**pの値が分からなくても比は出ます。**",
        "①男子の合格は4甲人、不合格は 4乙＝12甲人。②4甲:12甲＝1:3です。③**甲の値が分からなくても比は出ます。**",
    ),

    # --- hd5m2nd_13_9（HG-0612）：m→△（同じ大問の別stepで□が既に別の意味に使われているため） ---
    (
        "hd5m2nd_13_9", 1, "question",
        "冊数を 2×m 冊と 3×m 冊とします。12冊ずつ取ったあとの重さの比が5:6になるとき、mはいくつですか。",
        "冊数を 2×△ 冊と 3×△ 冊とします。12冊ずつ取ったあとの重さの比が5:6になるとき、△はいくつですか。",
    ),
    (
        "hd5m2nd_13_9", 1, "meaning",
        "①大の重さは 3×(2m－12)、小の重さは 2×(3m－12)。②(6m－36):(6m－24)＝5:6 → 6×(6m－36)＝5×(6m－24) → 36m－216＝30m－120 → m＝16です。",
        "①大の重さは 3×(2△－12)、小の重さは 2×(3△－12)。②(6△－36):(6△－24)＝5:6 → 6×(6△－36)＝5×(6△－24) → 36△－216＝30△－120 → △＝16です。",
    ),

    # --- hd5m2nd_14_2（HG-0622）：「分数で答えなさい」なのに答えが小数 ---
    (
        "hd5m2nd_14_2", 0, "answer",
        "2.25",
        "9/4",
    ),

    # --- hd5m2nd_14_4（HG-0628）：「分数で答えなさい」なのに答えが小数 ---
    (
        "hd5m2nd_14_4", 0, "answer",
        "0.775",
        "31/40",
    ),
]


# ---------------------------------------------------------------------------
# svg フィールドまるごとの置換（daimon id, old svg, new svg）
# 追加するのは「続きを示す注記テキスト」1つのみ。既存要素の座標は一切動かさない。
# 検算: 既存グリッドの最大y（行6=118〜137）より下、拡張後viewBoxの高さ160より内側の
# y=150に、font-size8・文字数18字ほどの注記を横中央(x=98, viewBox幅196の中央)に置く。
# 幅・高さとも既存要素と重ならないことを確認ずみ。
# ---------------------------------------------------------------------------
SVG_FIXES = [
    (
        "hd5m2nd_6_1",
        "<svg viewBox='0 0 196 145' xmlns='http://www.w3.org/2000/svg'",
        "<svg viewBox='0 0 196 160' xmlns='http://www.w3.org/2000/svg'",
    ),
]
SVG_APPEND_BEFORE_CLOSE = [
    (
        "hd5m2nd_6_1",
        "<rect x='38' y='42' width='90' height='57' fill='none' stroke='#ff6b6b' stroke-width='2'/></svg>",
        "<rect x='38' y='42' width='90' height='57' fill='none' stroke='#ff6b6b' stroke-width='2'/>"
        "<text x='98.0' y='150' fill='#9aa3c0' font-size='8' text-anchor='middle'>"
        "\u22ee\uff08100\u307e\u3067\u540c\u3058\u3088\u3046\u306b6\u5217\u3067\u7d9a\u304f\uff09</text></svg>",
    ),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)
    eprint("\u5bfe\u8c61:", path)

    d = json.load(io.open(path, encoding="utf-8"))

    by_id = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id"):
            by_id.setdefault(x["id"], []).append(x)

    applied = 0
    skipped_idempotent = 0

    # --- steps[i].field の置換 ---
    for daimon_id, step_idx, field, old, new in FIXES:
        recs = by_id.get(daimon_id)
        if not recs:
            eprint("\u2717 \u898b\u3064\u304b\u3089\u306a\u3044\u5927\u554f id:", daimon_id)
            sys.exit(1)
        if len(recs) != 1:
            eprint("\u2717 \u5927\u554fid\u304c\u91cd\u8907\u3057\u3066\u3044\u308b:", daimon_id, len(recs))
            sys.exit(1)
        x = recs[0]
        steps = x.get("steps", [])
        if not (0 <= step_idx < len(steps)):
            eprint("\u2717 step index\u304c\u7bc4\u56f2\u5916:", daimon_id, step_idx, "steps=", len(steps))
            sys.exit(1)
        step = steps[step_idx]
        cur = step.get(field, "")

        if cur == new:
            skipped_idempotent += 1
            continue

        if cur != old:
            eprint("\u2717 \u671f\u5f85\u3057\u305f\u672c\u6587\u3068\u4e00\u81f4\u3057\u306a\u3044\uff08\u65e2\u306b\u4ed6\u306e\u5909\u66f4\u304c\u5165\u3063\u3066\u3044\u308b\u53ef\u80fd\u6027\uff09:")
            eprint("  id=", daimon_id, "step=", step_idx, "field=", field)
            eprint("  \u73fe\u5728\u306e", field, ":", cur)
            sys.exit(1)

        # 同じ大問内でこの本文がちょうど1回だけ出現することを確認してから置換
        count_in_daimon = sum(1 for s in steps if s.get(field, "") == old)
        if count_in_daimon != 1:
            eprint("\u2717 \u5927\u554f\u5185\u306b\u540c\u3058\u672c\u6587\u304c", count_in_daimon, "\u56de\u3042\u308b\uff081\u56de\u306e\u306f\u305a\uff09:", daimon_id)
            sys.exit(1)

        step[field] = new
        applied += 1
        eprint("\u2713 \u4fee\u6b63:", daimon_id, "step", step_idx, field)

    # --- svg\u30d5\u30a3\u30fc\u30eb\u30c9\uff08viewBox\u306e\u5024\uff09\u306e\u7f6e\u63db ---
    svg_edits = {}
    for daimon_id, old, new in SVG_FIXES:
        svg_edits.setdefault(daimon_id, []).append((old, new))
    for daimon_id, old, new in SVG_APPEND_BEFORE_CLOSE:
        svg_edits.setdefault(daimon_id, []).append((old, new))

    for daimon_id, edits in svg_edits.items():
        recs = by_id.get(daimon_id)
        if not recs:
            eprint("\u2717 \u898b\u3064\u304b\u3089\u306a\u3044\u5927\u554f id:", daimon_id)
            sys.exit(1)
        if len(recs) != 1:
            eprint("\u2717 \u5927\u554fid\u304c\u91cd\u8907\u3057\u3066\u3044\u308b:", daimon_id, len(recs))
            sys.exit(1)
        x = recs[0]
        svg = x.get("svg", "")

        # \u3059\u3067\u306b\u5168\u90e8\u9069\u7528\u6e08\u307f\uff08\u51aa\u7b49\uff09\u304b\u3092\u5148\u306b\u5224\u5b9a
        all_new_present = all(new in svg for _old, new in edits)
        if all_new_present:
            skipped_idempotent += len(edits)
            continue

        for old, new in edits:
            if new in svg:
                skipped_idempotent += 1
                continue
            if svg.count(old) != 1:
                eprint("\u2717 svg\u5185\u306e\u7f6e\u63db\u5bfe\u8c61\u304c1\u56de\u3067\u306f\u306a\u3044:", daimon_id, "count=", svg.count(old))
                sys.exit(1)
            svg = svg.replace(old, new, 1)
            applied += 1
            eprint("\u2713 svg\u4fee\u6b63:", daimon_id)

        x["svg"] = svg

    eprint("\u9069\u7528:", applied, "\u4ef6 / \u65e2\u306b\u9069\u7528\u6e08\u307f\uff08\u51aa\u7b49\u30b9\u30ad\u30c3\u30d7\uff09:", skipped_idempotent, "\u4ef6")

    if applied == 0:
        eprint("\u5909\u66f4\u306a\u3057\u3002\u66f8\u304d\u51fa\u3057\u306f\u884c\u308f\u306a\u3044\u3002")
        return

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))
    eprint("\u66f8\u304d\u51fa\u3057\u5b8c\u4e86:", path)


if __name__ == "__main__":
    main()
