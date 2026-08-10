# -*- coding: utf-8 -*-
"""原簿とアプリの大問を突き合わせ、取りこぼしを洗い出す。
   浜学園のデータを触ったら必ず実行すること。
   使い方：  python scripts/check_genbo.py
"""
import json, io, os, re, sys, collections
import sys, io as _io
# Windowsのcp932コンソールでも絵文字・矢印が出せるようにする
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
GENBO = find_genbo()

g = io.open(GENBO, encoding="utf-8").read()
recs = [r for r in re.split(r"(?=^### 【HG-)", g, flags=re.M) if re.match(r"### 【HG-\d+】", r)]
hid = lambda r: re.match(r"### 【(HG-\d+)】", r).group(1)
heads = {hid(r): r.split("\n")[0].split("】", 1)[1] for r in recs}

# 原簿のレコードを 学年×コース で分ける（最レとマスターは必ず分ける）
# ★同じコースが 複数の名前で書かれている（2026-07-28 に発覚し 51本を見落としていた）
#   マスター系＝「マスター」「マスター1st」「マスターV/VS」「復習」「本科」
#   最レ系  ＝「最レ」「最高レベル」
#   2nd演習 は 別コース扱い（アプリにコースが無いので今は集計だけ）
#   ★見出しの型は 実物を読むたびに増える。**必ずここを見直す**
#     （2026-07-28：小5マスターが4名称に散っていて51本、小4マスターが「小4 No.x」形式で74本、
#       小5の実力が「小5 実力テストV」で2本 ── 合わせて127本を見落としていた）
COURSE_PAT = [
    ("rika",   re.compile(r"^小(\d)\s*理科")),
    ("sairei", re.compile(r"^小(\d)\s*(?:最レ|最高レベル)")),
    ("nd2",    re.compile(r"^小(\d)\s*2nd")),
    ("master", re.compile(r"^小(\d)\s*(?:マスター|復習|本科|実力|No\.)")),
]
gen = collections.defaultdict(set)
for k, v in heads.items():
    for course, pat in COURSE_PAT:
        m = pat.match(v)
        if m:
            gen[(m.group(1), course)].add(k)
            break

d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))

# ★作れないと分かっているレコード（原簿側に理由が書いてある）
# ★同じ問題が2つの番号で原簿に載っているもの（片方を作れば足りる）
SAME = {"HG-1520": "HG-0661（小5実力のバス運賃表。同じ問題が2回レコード化されている）"}

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
    if course in ("nd2",):                   # アプリにコースが無い。集計だけ出す
        print("%-12s %5d本 %5s %5s   %s" % (
            "小%s2nd演習" % grade, len(gen[(grade, course)]), "—", "—", "**アプリにコースが無い**"))
        ng += len(gen[(grade, course)])
        continue
    node = d["grades"].get(grade, {}).get(course, {})
    inapp = set()
    n = q = 0
    for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
        for v in node.get(kind, {}).values():
            for x in v:
                n += 1
                q += len(x.get("steps", []))
                h = hgof(x)
                if h:
                    inapp.add(h)
                else:
                    nohg.append((grade, course, x.get("id")))
    miss = sorted(gen[(grade, course)] - inapp - set(CANNOT) - set(SAME))
    nm = "小%s%s" % (grade, {"master": "マスター", "sairei": "最レ", "nd2": "2nd演習", "rika": "理科"}[course])
    print("%-12s %5d本 %5d本 %5d問   %s" % (
        nm, len(gen[(grade, course)]), n, q,
        ("**%d本** %s" % (len(miss), miss[:8])) if miss else "なし"))
    ng += len(miss)

print()
print("※ 同じ問題の重複（除外）: %s" % ", ".join(
    "%s＝%s" % (k, v) for k, v in sorted(SAME.items())))
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
