# -*- coding: utf-8 -*-
"""第2分冊で、自動変換できなかった大問を数えて並べる。"""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b2_conf
A = g4b2_conf.apply()   # g4b1_add_daimon 側で stdout をUTF-8にしている

built, unresolved = A.build_specs()
rounds = {}
for hg, no, sp in built:
    rounds.setdefault(no, []).append(sp)
print("できた: %d本 / %d問" % (len(built), sum(len(sp["steps"]) for _, _, sp in built)))
for no in sorted(rounds):
    print("  No.%-2d %2d本 %3d問" % (no, len(rounds[no]),
                                     sum(len(sp["steps"]) for sp in rounds[no])))
print("❌ 変換できなかった: %d件" % len(unresolved))
from g4b1_parse import load_records
titles = {hg: t for hg, t, _ in load_records()}
for hg, at in unresolved:
    print("   %s  %-46s | %s" % (hg, titles.get(hg, "").split("第2分冊 ")[-1][:46], at[:70]))
