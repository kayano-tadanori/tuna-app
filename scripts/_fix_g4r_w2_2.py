# -*- coding: utf-8 -*-
"""小4理科 公開テスト No.4〜No.6 監査9本ぶんの内容パッチ（docs/_audit/g4r_w2/audit_2.txt 対応）。

対象の9本（hd_4r_k04_577_4 / hd_4r_k04_589_4 / hd_4r_k04_601_4 / hd_4r_k05_626_4 /
hd_4r_k05_566_4 / hd_4r_k05_602_4 / hd_4r_k05_578_4 / hd_4r_k05_590_4 / hd_4r_k06_627_4）を
原簿と1本ずつ突き合わせ、回路のトポロジー・磁力線の向き・レンズの相似・比例＋切片の表・
かげからの方位復元をすべて独立に検算したが、内容の誤り・答えの先出し・重複・学年逸脱は
1件も見つからなかった（詳細は docs/_audit/g4r_w2/findings_2.md 参照）。

そのため FIXES は空リストにしてある。将来この号に追加の直しが必要になったときのために、
g4r_w1側の `_fix_g4r_w1_2.py` と同じ枠組み（genbo_common.iter_daimon だけで大問を引く／
置換前に「その大問の中でちょうど1回」を assert／冪等）だけ残してある。

使い方:
  python scripts/_fix_g4r_w2_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


# ---------------------------------------------------------------------------
# 修正内容の定義。1件＝{daimon_id, hg, field, old, new}
#   field が "meaning" の場合は steps[step_index]["meaning"]、
#   "intro" の場合は x["intro"] を、old→new へ完全一致で置換する。
# 今回のaudit_2.txt（9本）では書きかえ対象が見つからなかったため空。
# ---------------------------------------------------------------------------
FIXES = []


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

    if fix["field"] == "intro":
        current = x.get("intro")
        if current == fix["new"]:
            return False, True  # すでに適用ずみ（冪等）
        if current != fix["old"]:
            raise AssertionError(
                "id=%s の intro が想定外の内容（old にも new にも一致しない）\n"
                "実際の内容の先頭80字: %r" % (fix["daimon_id"], (current or "")[:80])
            )
        x["intro"] = fix["new"]
        return True, False

    # field == "meaning"（steps[step_index]）
    steps = x.get("steps")
    step_index = fix["step_index"]
    if not isinstance(steps, list) or len(steps) <= step_index:
        raise AssertionError(
            "id=%s に steps[%d] が無い" % (fix["daimon_id"], step_index)
        )
    step = steps[step_index]
    current = step.get("meaning")

    if current == fix["new"]:
        return False, True  # すでに適用ずみ（冪等）

    if current != fix["old"]:
        raise AssertionError(
            "id=%s steps[%d].meaning が想定外の内容（old にも new にも一致しない）\n"
            "実際の内容の先頭80字: %r" % (fix["daimon_id"], step_index, (current or "")[:80])
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
        tag = "%s (%s) %s" % (fix["daimon_id"], fix.get("hg"), fix["field"])
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
    if not FIXES:
        print("今回のaudit_2.txt（9本）には内容の誤りが見つからなかったため、FIXESは空です。")


if __name__ == "__main__":
    main()
