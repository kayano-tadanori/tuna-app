# -*- coding: utf-8 -*-
"""第3分冊の「自動でどれだけ変換できるか」を数える下見。JSONには書かない。"""
import io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b3_conf
A = g4b3_conf.apply()

built, unresolved = A.build_specs()
rounds = {}
for hg, no, spec in built:
    rounds.setdefault(no, []).append(spec)
print("=== 小4マスター算数 第3分冊 → 大問（下見） ===")
tot = 0
for no in sorted(rounds):
    n = sum(len(s["steps"]) for s in rounds[no])
    tot += n
    print("No.%-2d %2d本 %3d問" % (no, len(rounds[no]), n))
print("できた: %d本 / %d問" % (len(built), tot))
print("できなかった: %d本" % len(unresolved))
for hg, at in unresolved:
    print("   ", hg, repr(at))
