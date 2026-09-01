# -*- coding: utf-8 -*-
"""指定したHGの 設定/設問・答え を原簿のまま出す（図SVGは省く）。"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b3_conf
A = g4b3_conf.apply()
import g4b1_parse as P
want = set(sys.argv[1:])
for hg, title, rec in P.load_records():
    if hg not in want:
        continue
    p = A.parse_record(hg, title, rec)
    print("### %s %s" % (hg, re.sub(r"^小4マスター算数第3分冊 ", "", title)))
    if p["intro"]:
        print("  [設定] " + p["intro"][:300])
    print("  [設問] " + p["setmon"][:500])
    print("  [答え] " + p["ans_text"][:300])
    print()
