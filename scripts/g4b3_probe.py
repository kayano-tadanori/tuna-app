# -*- coding: utf-8 -*-
"""変換できなかった大問について、「どの答えで落ちたか」を1つずつ出す。"""
import os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b3_conf
A = g4b3_conf.apply()
import g4b1_parse as P
import g4b2_build as BB

built, unresolved = A.build_specs()
bad = {hg for hg, _ in unresolved}
recs = {hg: (title, rec) for hg, title, rec in P.load_records()}
cnt = collections.Counter()
for hg in sorted(bad, key=lambda x: int(x.split("-")[1])):
    title, rec = recs[hg]
    p = A.parse_record(hg, title, rec)
    ap = p["aparts"]
    firsts = []
    for k in sorted(ap):
        v = ap[k]
        if BB.steps_for("Q", v, "") is None:
            firsts.append("%s=%r" % (k, v[:48]))
    print("%s %-2s %s" % (hg, len(ap), " | ".join(firsts[:3]) or "(全部通る＝割り方の問題)"))
