# -*- coding: utf-8 -*-
"""小1・小2の問題を、直したあとに検査する。

  1. まだ習っていない漢字が 問題文・答え・選択肢に 残っていないか
  2. 「かな（同じかな）」のような むだな くりかえしに なっていないか
  3. 答えが 選択肢の中に あるか／選択肢が だぶっていないか
  4. 学年×難易度の どのセットも 0問に なっていないか
  ※ 解説（meaning）は今回の直しの対象外。結びが答えと合っていない数だけ 数えて出す。
"""
import json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fix_low_grade_kanji import DATA, SKIP, ALLOW, IS_KANJI, texts_of

PAREN = re.compile(r"([ぁ-ゖァ-ヺー]{2,})[（(]([ぁ-ゖァ-ヺー]{2,})[）)]")

def main():
    ng = collections.Counter()
    soft = collections.Counter()
    cells = collections.Counter()
    shown = collections.Counter()

    def report(kind, qid, name, detail):
        ng[kind] += 1
        if shown[kind] < 8:
            shown[kind] += 1
            print(f"  [{kind}] {qid} ({name}) {detail}")

    for name in sorted(os.listdir(DATA)):
        if not name.endswith(".json") or name in SKIP:
            continue
        try:
            data = json.load(open(os.path.join(DATA, name), encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not isinstance(data, list):
            continue
        for q in data:
            if not isinstance(q, dict) or q.get("grade") not in (1, 2):
                continue
            g = q["grade"]
            allow = ALLOW[g]
            cells[(g, q.get("difficulty"))] += 1
            qid = q.get("id")
            for f, i, s in texts_of(q):
                bad = sorted({c for c in IS_KANJI.findall(s) if c not in allow})
                if bad:
                    report("未習漢字", qid, name, f"{f}: {''.join(bad)} / {s[:40]}")
                for m in PAREN.finditer(s):
                    if m.group(1) == m.group(2):
                        report("むだなくりかえし", qid, name, s[:40])
            ch = q.get("choices")
            if ch:
                if q.get("answer") not in ch:
                    report("答えが選択肢にない", qid, name, f"{q.get('answer')} / {ch}")
                if len(set(ch)) != len(ch):
                    report("選択肢がだぶり", qid, name, str(ch))
            mean = q.get("meaning") or ""
            m = re.search(r"答えは(.+?)です", mean)
            if m and q.get("answer") and m.group(1) != q["answer"]:
                soft["解説の結びが答えと合わない"] += 1
            if any(c not in allow for c in IS_KANJI.findall(mean)):
                soft["解説に未習漢字が残っている（開けなかった分）"] += 1

    print("=== 小1小2の 学年×難易度 ===")
    zero = 0
    for g in (1, 2):
        for d in sorted({d for (gg, d) in cells if gg == g}, key=lambda x: (x is None, x)):
            n = cells[(g, d)]
            print(f"  小{g} なんい度{d}: {n}")
            if n == 0:
                zero += 1
    print("\n=== 見つかった問題 ===")
    if not ng:
        print("  なし（ぜんぶ通りました）")
    for k, v in ng.most_common():
        print(f"  {k}: {v}")
    for k, v in soft.most_common():
        print(f"  （参考）{k}: {v}")
    return 1 if (ng or zero) else 0


if __name__ == "__main__":
    sys.exit(main())
