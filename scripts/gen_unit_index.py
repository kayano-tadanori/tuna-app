# -*- coding: utf-8 -*-
"""data/sansu_unit_index.json を作り直す（「単元でえらぶ」チップの出口）。

  python scripts/gen_unit_index.py          … 今の索引と比べるだけ
  python scripts/gen_unit_index.py --write  … 書く

★アプリは索引があればそれをそのまま出す（js/sansu.js の renderSansuUnitRow）。
  索引に無い＝**チップが出ない＝その単元でえらべない**。だから単元タグを直したら
  必ずここを作り直す（本人指摘 2026-09-09「出すところがないのに振り分けても意味ないよね」）。
★40問に満たないグループは出さない（4段×10問に届かないと選んでも問題が足りない）。
  しきい値も グループ表も js/sansu.js から読む。**ここに書き写さない。**
"""
import io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G
from check_tangen import GROUP_OF          # js/sansu.js の UNIT_GROUPS をそのまま読んだもの

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def group_min():
    src = io.open(os.path.join(ROOT, "js", "sansu.js"), encoding="utf-8").read()
    m = re.search(r"const UNIT_GROUP_MIN = (\d+)", src)
    if not m:
        raise RuntimeError("js/sansu.js の UNIT_GROUP_MIN を読めなかった")
    return int(m.group(1))


def build():
    MIN = group_min()
    c = {}
    for r in G.iter_tsujo():
        if not os.path.basename(r["file"]).startswith("sansu_"):
            continue
        q = r["q"]
        g, u = q.get("grade"), q.get("unit")
        grp = GROUP_OF.get(u)
        if not isinstance(g, int) or not grp:
            continue
        c.setdefault(str(g), {})
        c[str(g)][grp] = c[str(g)].get(grp, 0) + 1
    return {g: {k: v for k, v in sorted(d.items(), key=lambda x: -x[1]) if v >= MIN}
            for g, d in sorted(c.items())}


def main():
    new = build()
    p = os.path.join(ROOT, "data", "sansu_unit_index.json")
    old = json.load(io.open(p, encoding="utf-8"))
    for g in sorted(set(old) | set(new)):
        o, n = old.get(g, {}), new.get(g, {})
        added = [k for k in n if k not in o]
        gone = [k for k in o if k not in n]
        moved = [(k, o[k], n[k]) for k in n if k in o and o[k] != n[k]]
        print("小%s  グループ %d→%d" % (g, len(o), len(n)))
        for k in added:
            print("    ＋出るようになる %-18s %d問" % (k, n[k]))
        for k in gone:
            print("    －出なくなる     %-18s （前は%d問）" % (k, o[k]))
        for k, a, b in moved:
            print("      数がかわる     %-18s %d→%d問" % (k, a, b))
    if "--write" in sys.argv:
        io.open(p, "w", encoding="utf-8", newline="\n").write(
            json.dumps(new, ensure_ascii=False, indent=2) + "\n")
        print("\n✅ data/sansu_unit_index.json を書いた")
    else:
        print("\n（--write を付けると書きます）")


if __name__ == "__main__":
    main()
