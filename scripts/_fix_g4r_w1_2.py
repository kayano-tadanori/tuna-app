# -*- coding: utf-8 -*-
"""小4理科 復習テスト No.32/No.35 監査2本ぶんの内容パッチ（docs/_audit/g4r_w1/audit_2.txt 対応）。

直しているのは2件とも「同じ最頻出バグ」＝
  1つの原簿設問を複数の小問（steps）に分割したとき、先に出る小問の解説（meaning）が
  分割前の完全な計算チェーンのまま書かれていて、まだ答えていない後続の小問の答えが
  読み取れてしまう。

  - hd_4r_f35_5（HG-1832・注射器の問題）steps[0]（Bを聞く小問）の解説が
    「残りの2をBとCで半分ずつ＝1ずつ」と書いていて、まだ聞いていない steps[1]（C）の
    答え（3）がそのまま読み取れる。
  - hd_4r_f32_6（HG-1827・銅の棒のマッチの問題）steps[0]（いちばんおそいのはどれ、を聞く
    小問）の解説が A〜Hの8つの きょり を全部書き出していて、その中に steps[1]（同時に
    たおれるのはどれとどれ、の答え＝BとH）が きょり10で一致しているのが見えてしまう。

どちらも「答えの数値そのものは正しい」（別方法で検算ずみ。findings_2.md 参照）。
直したのは解説の書きかたのみ＝**設問文・答え・choicesは一切変えない**。

大問は genbo_common.iter_daimon だけで引く。置換前に「その大問の中でちょうど1回」を
assert する。すでに新テキストになっていれば何もしない（冪等）。

使い方:
  python scripts/_fix_g4r_w1_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


# ---------------------------------------------------------------------------
# 修正内容の定義。1件＝{daimon_id, step_index, old, new}
# old/new は steps[step_index]["meaning"] の値そのもの（完全一致で置換）。
# ---------------------------------------------------------------------------
FIXES = [
    {
        "daimon_id": "hd_4r_f35_5",
        "hg": "HG-1832",
        "step_index": 0,
        "old": (
            "そっと 動かすので 空気は 縮みません。＝ **目もりの 合計は 変わらない**。\n"
            "はじめの 合計は 2＋2＋2＋5＝**11**。\n"
            "Dは 5→2 で **3目もり分 おしこんだ**ので、その 3を A・B・Cが 分けて 外へ 出ます。\n"
            "Aは 2→3 で **1** 出たから、残りの **2** を BとCで 半分ずつ ＝ **1ずつ**。B は 2＋1＝**3**。"
        ),
        "new": (
            "そっと 動かすので 空気は 縮みません。＝ **目もりの 合計は 変わらない**。\n"
            "はじめの 合計は 2＋2＋2＋5＝**11**。\n"
            "Dは 5→2 で **3目もり分 おしこんだ**ので、その 3を A・B・Cが 分けて 外へ 出ます。\n"
            "Aは 2→3 で **1** 出ました。**のこりは、Bと Cが 対称な 位置で 受け持ちます**。\n"
            "Bの 目もりは **3** です。"
        ),
    },
    {
        "daimon_id": "hd_4r_f32_6",
        "hg": "HG-1827",
        "step_index": 0,
        "old": (
            "たおれる 順は **加熱した ところからの きょりの 順**。\n"
            "加熱点から 数えると A=14／B=10／C=7／D=4／E=1／F=2／G=6／H=10 目もり。\n"
            "いちばん 遠いのは **A**。"
        ),
        "new": (
            "たおれる 順は **加熱した ところからの きょりの 順**。\n"
            "加熱点は 左はしから **14** の 位置です。左はし（A）までの きょりは **14**、"
            "右はし（H）までの きょりは 24－14＝**10**。まん中がわに ある 印は、どちらの"
            " はしより 加熱点に 近いので、きょりは 14より 小さく なります。\n"
            "だから いちばん 遠い ＝ いちばん おそいのは **A**。"
        ),
    },
]


def apply_fix(d, fix):
    """1件のパッチを適用する。戻り値: (applied: bool, skipped_already_done: bool)"""
    matches = [
        rec for rec in iter_daimon(d)
        if isinstance(rec["x"], dict) and rec["x"].get("id") == fix["daimon_id"]
    ]
    if len(matches) != 1:
        raise AssertionError(
            "id=%s の大問が %d 本ヒット（1本のはず）" % (fix["daimon_id"], len(matches))
        )
    x = matches[0]["x"]
    steps = x.get("steps")
    if not isinstance(steps, list) or len(steps) <= fix["step_index"]:
        raise AssertionError(
            "id=%s に steps[%d] が無い" % (fix["daimon_id"], fix["step_index"])
        )
    step = steps[fix["step_index"]]
    current = step.get("meaning")

    if current == fix["new"]:
        return False, True  # すでに適用ずみ（冪等）

    if current != fix["old"]:
        raise AssertionError(
            "id=%s steps[%d].meaning が想定外の内容（old にも new にも一致しない）\n"
            "実際の内容の先頭80字: %r" % (fix["daimon_id"], fix["step_index"], (current or "")[:80])
        )

    # 「その大問の中でちょうど1回」チェック：同じ old 文字列が他の小問に
    # 紛れこんでいないか（この大問の steps 全体で1回だけ）。
    hit_count = sum(1 for s in steps if s.get("meaning") == fix["old"])
    if hit_count != 1:
        raise AssertionError(
            "id=%s の中で old テキストが %d 回ヒット（1回のはず）" % (fix["daimon_id"], hit_count)
        )

    step["meaning"] = fix["new"]
    return True, False


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    applied = 0
    already = 0
    for fix in FIXES:
        did, skipped = apply_fix(d, fix)
        tag = "%s (%s) steps[%d]" % (fix["daimon_id"], fix["hg"], fix["step_index"])
        if did:
            print("[FIX]     %s を書きかえました" % tag)
            applied += 1
        elif skipped:
            print("[SKIP]    %s はすでに適用ずみ" % tag)
            already += 1

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))

    print("適用: %d件 / 適用ずみ(スキップ): %d件 / 合計: %d件" % (applied, already, len(FIXES)))


if __name__ == "__main__":
    main()
