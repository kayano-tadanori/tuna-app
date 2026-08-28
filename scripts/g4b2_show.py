# -*- coding: utf-8 -*-
"""指定した大問（HG番号）の中身を、そのまま読める形で書き出す。監査の指摘を確かめる用。

使い方: python scripts/g4b2_show.py HG-5226 HG-5285 ...
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(BASE, "scripts", "_g4b2_show.txt")

want = set(sys.argv[1:])
d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))
node = d["grades"]["4"]["master_bunsatsu"]["fukushu"]
out = []
for no, arr in sorted(node.items(), key=lambda kv: int(kv[0])):
    if not (14 <= int(no) <= 28):
        continue
    for x in arr:
        if want and x["src"] not in want:
            continue
        out.append("=" * 70)
        out.append("%s  No.%s  %s  star=%s  svg=%s" % (x["src"], no, x["title"], x["star"],
                                                       "あり" if x.get("svg") else "なし"))
        out.append("intro: %s" % x["intro"])
        for i, s in enumerate(x["steps"]):
            out.append("  [%d] Q: %s" % (i, s["question"]))
            out.append("      A: %s%s" % (s["answer"],
                                          ("   choices=%s" % s["choices"]) if s.get("choices") else ""))
            out.append("      M: %s" % s.get("meaning", ""))
io.open(DST, "w", encoding="utf-8").write("\n".join(out))
sys.stderr.write("%d行 -> %s\n" % (len(out), DST))
