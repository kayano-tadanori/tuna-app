# -*- coding: utf-8 -*-
"""data/hama_daimon.json の全stepが実際に解答できる形になっているか監査する。
   大問（steps）を追加・編集したら必ず実行すること。
   使い方：  python scripts/check_answerable.py
"""
import json, io, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = r"C:\Users\茅野　忠徳\Desktop\Claude\tuna app"
d = json.load(io.open(BASE + r"\data\hama_daimon.json", encoding="utf-8"))


def is_numpad(a):
    a = str(a).strip()
    return bool(
        re.match(r"^\d+(\.\d+)?$", a) or
        re.match(r"^\d+/\d+$", a) or
        re.match(r"^\d+と\d+/\d+$", a) or
        ("余り" in a)
    )


unanswerable = []   # choicesも無くテンキー形式でもない＝物理的に入力できない
mismatched = []      # choicesはあるが answer がそのどれとも一致しない＝必ず不正解になる
total = 0
with_choices = 0

for grade, gv in d["grades"].items():
    for course, node in gv.items():
        if not isinstance(node, dict):
            continue
        for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
            for wk, arr in (node.get(kind) or {}).items():
                for x in arr:
                    for i, st in enumerate(x.get("steps", [])):
                        total += 1
                        ans = st.get("answer", "")
                        ch = st.get("choices")
                        loc = (grade, course, x.get("src") or x.get("hg"), x.get("id"), i + 1)
                        if ch:
                            with_choices += 1
                            if ans not in ch:
                                mismatched.append(loc + (ans, ch))
                        elif not is_numpad(ans):
                            unanswerable.append(loc + (ans,))

print("=== 解答可能性チェック ===")
print("総step数: %d（うちchoicesあり: %d）" % (total, with_choices))
print()
if unanswerable:
    print("❌ choicesも無く、テンキーでも打てない答え %d件（画面にテンキーが出るが物理的に入力不能）" % len(unanswerable))
    for u in unanswerable[:30]:
        print("   ", u)
else:
    print("✅ choicesが無いstepは全部テンキーで打てる形式")
print()
if mismatched:
    print("❌ choicesはあるが answer と一字一句一致しない %d件（必ず「不正解」になる）" % len(mismatched))
    for m in mismatched[:30]:
        print("   ", m[:5], "answer=%r" % m[5], "choices=%r" % m[6])
else:
    print("✅ choicesがあるstepは全部 answer がそのどれかと完全一致")

if unanswerable or mismatched:
    sys.exit(1)
