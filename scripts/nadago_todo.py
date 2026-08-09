# -*- coding: utf-8 -*-
"""灘合のうち、まだアプリに入っていない大問を原簿と突き合わせて一覧にする。

★「なぜ入れられなかったか」を原簿の記述から自動で判定する。
  本人が明りょうな画像を用意するときの、そのまま使える買い物リストになる。

  python scripts/nadago_todo.py
"""
import io, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_path import find_genbo

DAIMON = os.path.join(ROOT, "data", "hama_daimon.json")

# 入っているものの src を集める
d = json.load(io.open(DAIMON, encoding="utf-8"))
done = set()
for g in d.get("grades", {}).values():
    node = g.get("nadago", {}).get("fukushu", {})
    for lst in node.values():
        for q in lst:
            done.add(q.get("src"))

src = io.open(find_genbo(), encoding="utf-8").read()
recs = re.split(r"(?=^### 【HG-)", src, flags=re.M)
pat = re.compile(r"(小[3-5])\s*灘(?:合|中合格特訓)\s*(?:算数\s*)?第?\s*(\d+)\s*回\s*(?:算数\s*)?(大問\s*\d+)?")

rows = []
for r in recs:
    m = re.match(r"### 【HG-(\d+)】(.*)", r)
    if not m:
        continue
    hg, head = "HG-" + m.group(1), m.group(2)
    mm = pat.search(head)
    if not mm:
        continue
    if hg in done:
        continue
    # 何が足りなくて入れられないのかを、原簿の書きぶりから当てる
    why = []
    if "要現物照合" in r or "未確定" in r:
        why.append("原簿が「未確定・要現物照合」と書いている")
    if "判読" in r or "スキャンから" in r or "読み切れ" in r or "確定できな" in r:
        why.append("スキャンから図が読み取れていない")
    ans = re.search(r"^- 答え:\s*(.*)$", r, flags=re.M)
    if not ans or not ans.group(1).strip():
        why.append("原簿に答えが書かれていない")
    setq = re.search(r"^- 設問(?:と答え)?:\s*(.*)$", r, flags=re.M)
    if setq is not None and not setq.group(1).strip():
        # 次の行が箇条書きなら中身はある
        after = r[setq.end():setq.end() + 200].strip()
        if not after.startswith("-") and not after.startswith("・"):
            why.append("原簿に設問の文が残っていない")
    fig = re.search(r"^- 図:\s*(.*)$", r, flags=re.M)
    need_fig = bool(fig and ("あり" in fig.group(1)))
    if not why and need_fig:
        why.append("図を作る必要がある（答えは確定している）")
    if not why:
        why.append("未着手")
    rows.append((mm.group(1), int(mm.group(2)), hg, head.strip()[:58], "／".join(why)))

rows.sort(key=lambda x: (x[0], x[1], x[2]))
print("灘合のうち、まだ入っていない大問：%d本\n" % len(rows))
cur = None
for g, no, hg, head, why in rows:
    key = (g, no)
    if key != cur:
        cur = key
        print("── %s 第%d回" % (g, no))
    print("   %s  %-58s" % (hg, head))
    print("        → %s" % why)

print("\n【まとめ】")
import collections
c = collections.Counter(why for *_, why in rows)
for k, v in c.most_common():
    print("   %2d本  %s" % (v, k))
