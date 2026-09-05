# -*- coding: utf-8 -*-
"""塾講師監査(audit_3.txt / 小3マスター算数 第2分冊 fukushu No.17〜18・6本)で見つかった
不具合の修正パッチ。

対象: hd3mb_17_5

使い方:
    python scripts/_fix_g3mb_w2_3.py [対象JSONのパス]
    省略時は data/hama_daimon.json（プロジェクト直下からの相対パス）。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 置換は「欄まるごとの一致」で冪等判定する：
      現在値 == OLD_FULL なら書き換えて NEW_FULL にする
      現在値 == NEW_FULL ならもう当たっている（何もしない）
      どちらでもなければ想定外の内容＝即座に例外を投げて **1件も書かずに** 止まる
  - find_one は id と src(HG番号) の両方が一致することを確認してから返す。
  - 書き出しは io.open(path, "wb")。
"""
import io
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common  # noqa: E402

BASE = genbo_common.BASE


def find_one(data, target_id, expect_src):
    hits = [r for r in genbo_common.iter_daimon(data, grade="3", app_courses=["master_bunsatsu"])
            if r["x"].get("id") == target_id]
    if len(hits) != 1:
        raise AssertionError("find_one: id=%s が %d 件見つかった（1件のはず）" % (target_id, len(hits)))
    x = hits[0]["x"]
    if x.get("src") != expect_src:
        raise AssertionError(
            "find_one: id=%s の src が %r ではなく %r だった（原簿番号がずれている？）"
            % (target_id, expect_src, x.get("src"))
        )
    return x


def apply_field(x, field, old_full, new_full, label, log):
    """x[field] を「欄まるごとの一致」で冪等に書き換える。"""
    cur = x.get(field, "")
    if cur == old_full:
        x[field] = new_full
        log.append("APPLIED  " + label)
    elif cur == new_full:
        log.append("SKIP(already applied) " + label)
    else:
        raise AssertionError(
            "apply_field: %s の現在の内容が想定（旧・新のどちらの欄まるごと一致）とも違う。"
            " 手で確認すること。" % label
        )


def apply_step_meaning(x, step_index, question_check, old_full, new_full, label, log):
    steps = x.get("steps", [])
    if not (0 <= step_index < len(steps)):
        raise AssertionError("apply_step_meaning: %s に steps[%d] が無い" % (label, step_index))
    step = steps[step_index]
    if step.get("question") != question_check:
        raise AssertionError(
            "apply_step_meaning: %s の steps[%d].question が想定と違う（並びがずれた？）: %r"
            % (label, step_index, step.get("question"))
        )
    apply_field(step, "meaning", old_full, new_full, label + " steps[%d].meaning" % step_index, log)


def fix_hd3mb_17_5(data, log):
    """小問2の解説「3から6まで30×2=60度」が自己矛盾
    （3から6は3めもり=90度のはず。
    30×2=60度は実際には4から6の値）。
    範囲の言葉を「4から6」に直し、
    最後の足し算も明示する。
    数値・最終解答（75）は変えない。findings_3.md 中1。"""
    x = find_one(data, "hd3mb_17_5", "HG-4184")
    apply_step_meaning(
        x, 1,
        "\u2461 3\u6642\u534a\u306e\u3068\u304d\u3001\u5c0f\u3055\u3044\u307b\u3046\u306e\u89d2\u5ea6\u306f\u4f55\u5ea6\u3067\u3059\u304b\u3002",
        "\u9577\u91dd\u306f6\u3001\u77ed\u91dd\u306f3\u30684\u306e\u9593\u30023\u304b\u30896\u307e\u306730\u00d72\uff1d60\u5ea6\u3001\u77ed\u91dd\u304c30\u5206\u306715\u5ea6\u9032\u3093\u3067\u3044\u308b\u306e\u306775\u5ea6\u3002",
        "\u9577\u91dd\u306f6\u3001\u77ed\u91dd\u306f3\u30684\u306e\u9593\u30024\u304b\u30896\u307e\u306730\u00d72\uff1d60\u5ea6\u3001\u77ed\u91dd\u304c30\u5206\u306715\u5ea6\u9032\u3093\u3067\u3044\u308b\u306e\u306760+15\uff1d75\u5ea6\u3002",
        "hd3mb_17_5",
        log,
    )


FIXES = [
    fix_hd3mb_17_5,
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)
    print("target:", path)

    with io.open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    log = []
    for fn in FIXES:
        fn(data, log)

    for line in log:
        print(line)

    applied = sum(1 for l in log if l.startswith("APPLIED"))
    skipped = sum(1 for l in log if l.startswith("SKIP"))
    print("applied=%d skipped(already)=%d total=%d" % (applied, skipped, len(log)))

    out = (json.dumps(data, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    with io.open(path, "wb") as f:
        f.write(out)
    print("wrote", len(out), "bytes")


if __name__ == "__main__":
    main()
