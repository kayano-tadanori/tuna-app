# -*- coding: utf-8 -*-
"""小4マスター算数 第3分冊（No.29〜43・HG-5770〜6562）を
   hama_daimon.json の grades.4.master_bunsatsu.fukushu に追加する。

第1分冊の道具（g4b1_*.py）＋第2分冊の答え方・仕上げ（g4b2_*.py）をそのまま使い、
帯・単元・手作業ぶんだけ差しかえる。**第1・第2分冊（No.1〜28）には触らない。**

使い方: python scripts/g4b3_add_daimon.py [--write]
"""
import argparse
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b3_conf                                    # noqa: E402
A = g4b3_conf.apply()
from g4b2_polish import polish                      # noqa: E402
from g4b3_build import polish3                      # noqa: E402
from g4b3_manual import SKIP                        # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")
ROUNDS = [no for _, _, no in g4b3_conf.ROUND_RANGES]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    built, unresolved = A.build_specs()
    rounds = {}
    secs = {}
    for hg, no, spec in built:
        secs[hg] = spec.get("_sec", "")
        rounds.setdefault(no, []).append((hg, polish3(polish(spec, hg), hg)))
    print("=== 小4マスター算数 第3分冊 → 大問 ===")
    print("作らないと決めたもの: %d本" % len(SKIP))
    for hg, why in sorted(SKIP.items()):
        print("   %s … %s" % (hg, why))
    if unresolved:
        print("❌ 変換できなかった: %d件" % len(unresolved))
        for hg, at in unresolved:
            print("   ", hg, repr(at[:60]))

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["4"].setdefault("master_bunsatsu", {}).setdefault("fukushu", {})
    before = {k: len(v) for k, v in node.items()}
    total = 0
    for no in ROUNDS:                       # 第3分冊の回だけ作り直す
        node[str(no)] = []
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
        # タイトルの「・N問」を落とした結果、同じ回に同じ名前が2つ以上できることがある
        # （「約分・6問」「約分・8問」→ どちらも「約分」）。大問えらびで見分けがつかないので、
        # ぶつかったものだけ教材の段（れいだい／れんしゅう／Bもんだい／Cもんだい）を添える
        seen = {}
        for x in arr:
            seen.setdefault(x["title"], []).append(x)
        for t, xs in seen.items():
            if len(xs) < 2:
                continue
            for x in xs:
                sec = secs.get(x["src"], "")
                if sec:
                    x["title"] = "%s（%s）" % (t, sec)
        arr.sort(key=lambda x: int(re.search(r"HG-(\d+)", x["src"]).group(1)))
        node[str(no)] = arr
        print("No.%-2s %2d本 %3d問  図%d枚"
              % (no, len(arr), sum(len(y["steps"]) for y in arr),
                 sum(1 for y in arr if y["svg"])))
    print("第3分冊: %d本 / %d問" % (total, sum(len(y["steps"]) for no, v in node.items()
                                              if int(no) in ROUNDS for y in v)))
    # 第1・2分冊（No.1〜28）の本数が1本も変わっていないことを毎回たしかめる
    for k, n in sorted(before.items(), key=lambda x: int(x[0])):
        if int(k) not in ROUNDS and len(node[k]) != n:
            print("🚨 No.%s の本数が変わった（%d→%d）。書きこまずに止める" % (k, n, len(node[k])))
            return
    print("✅ 第1・2分冊（No.1〜28）は本数が変わっていない")
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
