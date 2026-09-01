# -*- coding: utf-8 -*-
"""生成した大問を、原簿のレコードと横に並べて読める形で書き出す（監査用）。
使い方: python scripts/s5s12_dump.py <出力ファイル> [講座] [回]
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import s5s12_parse as P
import s5s12_add as A


def main():
    out = sys.argv[1]
    kou = int(sys.argv[2]) if len(sys.argv) > 2 else None
    no = int(sys.argv[3]) if len(sys.argv) > 3 else None
    recs = sorted(P.all_parsed(), key=lambda x: (x["kouza"], x["no"], x["dai"]))
    f = io.open(out, "w", encoding="utf-8")
    n = 0
    for r in recs:
        if kou and r["kouza"] != kou:
            continue
        if no and r["no"] != no:
            continue
        if "⚠" in r["tail"] or not P.ready(r):
            continue
        q, why = A.build_one(r)
        if q is None:
            f.write("\n===== %s 第%d講座 No.%d 大問%d  ✗作れず: %s\n" %
                    (r["hg"], r["kouza"], r["no"], r["dai"], why))
            continue
        n += 1
        f.write("\n===== %s 第%d講座 No.%d 大問%d 「%s」 ★%d\n" %
                (r["hg"], r["kouza"], r["no"], r["dai"], r["name"], q["star"]))
        f.write("【原簿の設問】%s\n" % r["mon"])
        f.write("【原簿の答え】%s\n" % r["ans"])
        f.write("【アプリの intro】%s\n" % q["intro"])
        for i, s in enumerate(q["steps"], 1):
            f.write("  (%d) Q: %s\n" % (i, s["question"]))
            f.write("      A: %s%s\n" % (s["answer"],
                                         ("   [4択] " + " / ".join(s["choices"])) if s.get("choices") else ""))
        if q.get("svg"):
            f.write("  図SVG: あり\n")
    f.close()
    print("書き出し: %s （%d本）" % (out, n))


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
