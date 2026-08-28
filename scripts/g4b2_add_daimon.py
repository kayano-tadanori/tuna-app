# -*- coding: utf-8 -*-
"""小4マスター算数 第2分冊（No.14〜28・HG-4945〜5769）を
   hama_daimon.json の grades.4.master_bunsatsu.fukushu に追加する。

第1分冊の道具（g4b1_*.py）をそのまま使い、帯・単元・手作業ぶんだけ差しかえる。
使い方: python scripts/g4b2_add_daimon.py [--write]
"""
import argparse
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b2_conf                                    # noqa: E402
A = g4b2_conf.apply()
from g4b2_polish import polish                      # noqa: E402
from g4b2_manual import SKIP                        # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    built, unresolved = A.build_specs()
    rounds = {}
    for hg, no, spec in built:
        rounds.setdefault(no, []).append((hg, polish(spec, hg)))
    print("=== 小4マスター算数 第2分冊 → 大問 ===")
    print("作らないと決めたもの: %d本" % len(SKIP))
    for hg, why in SKIP.items():
        print("   %s … %s" % (hg, why))
    if unresolved:
        print("❌ 変換できなかった: %d件" % len(unresolved))
        for hg, at in unresolved:
            print("   ", hg, repr(at[:60]))

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["4"].setdefault("master_bunsatsu", {}).setdefault("fukushu", {})
    # 第2分冊の回（14〜28）だけ作り直す。第1分冊（1〜13）には触らない
    for no in sorted(rounds):
        node[str(no)] = []
    total = 0
    for no, items in sorted(rounds.items()):
        arr = []
        for k, (hg, spec) in enumerate(items, 1):
            steps = []
            for st in spec["steps"]:
                o = {"question": st["question"], "answer": st["answer"]}
                if st.get("choices"):
                    o["choices"] = st["choices"]
                o["meaning"] = st.get("meaning", "")
                steps.append(o)
            arr.append({
                "id": "hd4mb_%02d_%d" % (no, k), "src": hg,
                "title": spec["title"], "category": spec["category"],
                "unit": spec["unit"], "grade": 4, "star": spec["star"],
                "intro": spec.get("intro", ""), "svg": spec.get("svg", ""),
                "steps": steps,
            })
            total += 1
        arr.sort(key=lambda x: int(re.search(r"HG-(\d+)", x["src"]).group(1)))
        node[str(no)] = arr
        print("No.%-2s %2d本 %3d問" % (no, len(arr), sum(len(y["steps"]) for y in arr)))
    print("第2分冊: %d本 / %d問" % (total, sum(len(y["steps"]) for no, v in node.items()
                                              if 14 <= int(no) <= 28 for y in v)))
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
