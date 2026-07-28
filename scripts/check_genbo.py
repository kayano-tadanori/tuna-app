# -*- coding: utf-8 -*-
"""原簿とアプリの大問を突き合わせ、取りこぼしを洗い出す。
   浜学園のデータを触ったら必ず実行すること。
   使い方：  python scripts/check_genbo.py
"""
import json, io, os, re, sys, collections

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENBO = r"C:\Users\User\.claude\projects\c--Users-User-Desktop-Claude\memory\hamagakuen_ryomon_genbo.md"

g = io.open(GENBO, encoding="utf-8").read()
recs = [r for r in re.split(r"(?=^### 【HG-)", g, flags=re.M) if re.match(r"### 【HG-\d+】", r)]
hid = lambda r: re.match(r"### 【(HG-\d+)】", r).group(1)
heads = {hid(r): r.split("\n")[0].split("】", 1)[1] for r in recs}

# 原簿のレコードを 学年×コース で分ける（最レとマスターは必ず分ける）
gen = collections.defaultdict(set)
for k, v in heads.items():
    m = re.match(r"^小(\d)\s*(マスター|最レ)", v)
    if not m:
        continue
    gen[(m.group(1), "master" if m.group(2) == "マスター" else "sairei")].add(k)

d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))

# ★作れないと分かっているレコード（原簿側に理由が書いてある）
CANNOT = {
    "HG-1107": "度数分布表そのものが原簿に無く、問題を再現できない",
    "HG-1121": "答えが「7時21と9/11分」など 帯分数の時刻で、テンキーでも4択でも出しにくい",
    "HG-1126": "原簿でも『印字が判読困難で確定解は保留』",
}


def hgof(x):
    if x.get("hg"):
        return x["hg"]
    m = re.search(r"HG-\d+", x.get("src", "") or "")
    return m.group(0) if m else None


print("=== 原簿 ⇄ 大問 の 突き合わせ ===")
print("%-12s %6s %6s %6s   %s" % ("コース", "原簿", "大問", "問数", "未収録"))
ng = 0
nohg = []
for (grade, course) in sorted(gen):
    node = d["grades"].get(grade, {}).get(course, {})
    inapp = set()
    n = q = 0
    for kind in ("fukushu", "kokai", "units"):
        for v in node.get(kind, {}).values():
            for x in v:
                n += 1
                q += len(x.get("steps", []))
                h = hgof(x)
                if h:
                    inapp.add(h)
                else:
                    nohg.append((grade, course, x.get("id")))
    miss = sorted(gen[(grade, course)] - inapp - set(CANNOT))
    nm = "小%s%s" % (grade, "マスター" if course == "master" else "最レ")
    print("%-12s %5d本 %5d本 %5d問   %s" % (
        nm, len(gen[(grade, course)]), n, q,
        ("**%d本** %s" % (len(miss), miss[:8])) if miss else "なし"))
    ng += len(miss)

print()
print("※ 作れないと分かっているレコード（除外）: %s" % ", ".join(
    "%s（%s）" % (k, v) for k, v in sorted(CANNOT.items())))
print()
if nohg:
    print("❌ 原簿番号が付いていない大問 %d本（どの原簿から作ったか追えない）" % len(nohg))
    for a in nohg[:20]:
        print("   小%s %s %s" % a)
    sys.exit(1)
if ng:
    print("❌ 原簿にあるのに 大問になっていない レコードが %d本 ある" % ng)
    sys.exit(1)
print("✅ 原簿のレコードは すべて 大問になっている／全部に原簿番号が付いている")
