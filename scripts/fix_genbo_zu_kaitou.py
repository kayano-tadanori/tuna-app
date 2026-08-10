# -*- coding: utf-8 -*-
"""原簿の「図: あり」のうち、実は**解答冊子の図**を指しているものを「なし（解答側に図）」に直す。

2026-08-11 に発覚：原簿の「- 図: **あり**（解答のダイヤ図…）」「（解答の線分図…）」は
**本文（問題）には図が無く、解答の解説にだけ図がある**という意味だった。
実物（第2講座 本文p5＝PDF p4 の大問10〜12）で確認したところ、問題文は文章だけ。

これに図を付けると**解法を先に見せてしまう**（＝答えを配ってしまう）ので、
- 「図: あり（解答の…）」は「図: なし（解答側に…）」に直す
- アプリにも図を出さない（図SVG欄は作らない）

使い方: python scripts/fix_genbo_zu_kaitou.py [--write]
"""
import io, os, re, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()

    # 「- 図: **あり**（解答の…）」＝本文に図は無い。かっこの中身が「解答」で始まるものだけ拾う
    pat = re.compile(r"^- 図: \*\*(?:あり|必須)\*\*（(解答[^）]*)）", re.M)
    hits = pat.findall(s)
    print("『解答の図』を指していたもの:", len(hits))
    for h in hits[:8]:
        print("   ", h[:60])

    s2 = pat.sub(lambda m: "- 図: なし（本文に図は無い。%s）" % m.group(1), s)

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s2)
    print("✅ 原簿を直した")


if __name__ == "__main__":
    main()
