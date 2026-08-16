# -*- coding: utf-8 -*-
"""難易度ラベルを内容ベースに振り直す。

いまは 学年×難易度 が同じ問数の格子になっていて、内容ではなく
「件数を4等分した」だけの状態のファイルがある。
（hama-set の原則2＝難易度は骨に乗っている制約の数で刻む、に反する）

制約の数は機械では直接測れないので、その代理として
・計算を要求しているか
・式の数（計算の段数）
・与えられた数値の個数（＝条件の数）
・比較や理由を問うか
・図を読む必要があるか
・解説の厚み
を足したスコアを作り、【学年ごとに】スコア順で4等分する。

学年ごとに等分するのは、どの学年でも d1〜d4 の帯が空かないようにするため
（カテゴリ→難易度の順に選ぶUIなので、帯が空くと出題が0問になる）。
"""
import json, io, os, re, sys
from collections import Counter, defaultdict

BASE = r"C:\Users\茅野　忠徳\Desktop\Claude\tuna app"
TARGETS = ["rika_daichi.json", "rika_denki.json", "rika_suiyoueki.json",
           "sansu_bakuhatsu.json"]

def load(fn):
    p = os.path.join(BASE, "data", fn)
    d = json.loads(io.open(p, encoding="utf-8").read())
    if isinstance(d, list):
        return p, d, None
    for k, v in d.items():
        if isinstance(v, list):
            return p, v, d
    raise SystemExit(fn)

def score(q):
    t = q.get("question", "") or ""
    m = re.sub(r"よって.*$", "", q.get("meaning", "") or "")
    s = 0.0
    if re.search(r"何g|何cm|何秒|何度|何倍|何%|何本|何個|何mL|何L|いくら|求め", t):
        s += 3
    s += min(len(re.findall(r"[＝=]", m)), 5) * 1.2
    s += min(len(re.findall(r"\d+(?:\.\d+)?", t)), 5) * 0.8
    if re.search(r"なぜ|理由|ちがい|違い|比べ|くらべ|どちら|どれ|正しい|まちがい", t):
        s += 1.5
    if q.get("svg"):
        s += 1
    s += min(len(m) / 60.0, 3)
    return s

report = []
for fn in TARGETS:
    p, items, wrapper = load(fn)
    before = Counter((q.get("grade"), q.get("difficulty")) for q in items)
    bygrade = defaultdict(list)
    for q in items:
        bygrade[q.get("grade")].append(q)

    moved = 0
    for g, qs in bygrade.items():
        qs.sort(key=score)
        n = len(qs)
        for i, q in enumerate(qs):
            # 4等分（同点でも順位で割り切る）
            d = min(4, i * 4 // n + 1)
            if q.get("difficulty") != d:
                moved += 1
            q["difficulty"] = d

    after = Counter((q.get("grade"), q.get("difficulty")) for q in items)
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(wrapper if wrapper is not None else items, ensure_ascii=False, indent=2) + "\n")

    grades = sorted({g for g, _ in after if g is not None})
    report.append((fn, len(items), moved, grades, before, after))

for fn, n, moved, grades, before, after in report:
    print("【%s】%d問 / %d問の難易度を変更" % (fn, n, moved))
    for g in grades:
        b = [before.get((g, d), 0) for d in (1, 2, 3, 4)]
        a = [after.get((g, d), 0) for d in (1, 2, 3, 4)]
        print("   小%s  前 %s → 後 %s" % (g, b, a))
    print()
