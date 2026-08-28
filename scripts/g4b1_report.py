# -*- coding: utf-8 -*-
import io, os, re, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g4b1_parse import load_records, parse_record
from g4b1_build import steps_for, MARU, KATA

ok_rec = 0; ng = []
nsteps = 0
for hg, title, rec in load_records():
    p = parse_record(hg, title, rec)
    steps = []; bad = None
    qp = p["qparts"]
    if len(p["aparts"]) == 1 and 0 in p["aparts"]:
        qp = {0: p["setmon"]}
    if list(qp) == [0] and len(p["aparts"]) > 1:
        mk = MARU if p["akind"] == "circled" else KATA
        qp = {k: "%s　%sにあてはまるものを答えなさい。" % (p["setmon"], mk[k-1])
              for k in p["aparts"]}
    for k in sorted(qp):
        qt = qp[k]
        at = p["aparts"].get(k, "")
        if not at:
            bad = "答えが取れない(%s)" % k; break
        s = steps_for(qt, at, "", p["setmon"])
        if s is None:
            bad = "%s → %r" % (repr(qt[:40]), at[:60]); break
        steps.extend(s)
    if bad:
        ng.append((hg, title, bad))
    else:
        ok_rec += 1; nsteps += len(steps)
print("自動でできた: %d本 / %d本   step数 %d" % (ok_rec, ok_rec+len(ng), nsteps))
print("残り: %d本" % len(ng))
for hg, title, bad in ng:
    print("  ", hg, title.split("第1分冊 ")[-1][:34], "|", bad[:120])
