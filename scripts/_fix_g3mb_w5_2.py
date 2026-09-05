# -*- coding: utf-8 -*-
"""
g3mb_w5 / audit_2 の監査で見つかった不具合の修正パッチ。

対象: hd3mb_29_9（HG-4342）と hd3mb_16_1〜hd3mb_16_6（HG-4170〜4175）。
  1) hd3mb_29_9: introの「その月の日数を足した」が、同じ文の例示
     「8月31日＝9月0日」（31を引く操作でしか成立しない）および原簿の骨
     「その月の日数を引いた通し番号にする」と矛盾している。「引いた」に直す。
  2) hd3mb_16_1〜16_6: unit欄が空欄（""）。同じ図形の角度を扱う他81本は
     すべて "平面図形（角度）" なので、これに揃える。
     ※現状は fukushu（宿題テキスト）が回番号で引かれるため unit欄は
       この経路では参照されておらず実害は無いが、データの欠落として直す。

設計方針:
  - 大問の実在確認・現在値の読み取りは genbo_common.iter_daimon だけを使う
    （自前で入れ子を歩かない）。
  - 実際のファイル書き換えは、対象大問だけを一意に指すアンカー文字列の
    完全一致置換で行う（全体を re-serialize してフォーマットを壊さない）。
  - 置換前に「そのアンカーがファイル中にちょうど1回だけ」であることを
    必ず assert する。0回でも2回以上でも書かずに止める。
  - 冪等: 欄がすでに新しい値になっていれば「適用済み」として書き換えを
    スキップする（2回実行しても2回目はno-opでmd5が変わらない）。
  - 1つでも想定外の状態（旧値でも新値でもない）があれば、1件も書かずに
    異常終了する。
"""
import sys
import io
import os
import json


def main():
    target_path = sys.argv[1] if len(sys.argv) > 1 else "data/hama_daimon.json"

    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    import genbo_common as gc

    with io.open(target_path, "r", encoding="utf-8") as f:
        text = f.read()

    d = json.loads(text)

    # ── 大問を id で引く（iter_daimon だけを使う）────────────────
    target_ids = {
        "hd3mb_29_9",
        "hd3mb_16_1", "hd3mb_16_2", "hd3mb_16_3",
        "hd3mb_16_4", "hd3mb_16_5", "hd3mb_16_6",
    }
    found = {}
    for r in gc.iter_daimon(d):
        x = r["x"]
        xid = x.get("id")
        if xid in target_ids:
            found.setdefault(xid, []).append(x)

    for tid in sorted(target_ids):
        assert tid in found, "大問が見つからない: %s" % tid
        assert len(found[tid]) == 1, (
            "大問が複数ヒットした（%s件）: %s" % (len(found[tid]), tid)
        )

    edits = []  # (label, old_anchor, new_anchor)

    # ── 修正1: hd3mb_29_9（HG-4342）のintro「足した」→「引いた」──
    x9 = found["hd3mb_29_9"][0]
    assert x9.get("src") == "HG-4342", x9.get("src")
    old_intro = (
        "\"intro\": \"ある年の9月25日は木曜日です。"
        "前の月にもどるときは、その月の日数を足した通し番号にする"
        "（8月31日＝9月0日）。\",\n"
    )
    new_intro = (
        "\"intro\": \"ある年の9月25日は木曜日です。"
        "前の月にもどるときは、その月の日数を引いた通し番号にする"
        "（8月31日＝9月0日）。\",\n"
    )
    current_intro = x9.get("intro", "")
    if current_intro == (
        "ある年の9月25日は木曜日です。前の月にもどるときは、"
        "その月の日数を引いた通し番号にする（8月31日＝9月0日）。"
    ):
        pass  # 適用済み（冪等）
    elif current_intro == (
        "ある年の9月25日は木曜日です。前の月にもどるときは、"
        "その月の日数を足した通し番号にする（8月31日＝9月0日）。"
    ):
        edits.append(("hd3mb_29_9 intro", old_intro, new_intro))
    else:
        raise AssertionError(
            "hd3mb_29_9 の intro が想定外の内容: %r" % current_intro
        )

    # ── 修正2: hd3mb_16_1〜16_6（HG-4170〜4175）のunit欄 ─────────
    HG_OF = {
        "hd3mb_16_1": 4170, "hd3mb_16_2": 4171, "hd3mb_16_3": 4172,
        "hd3mb_16_4": 4173, "hd3mb_16_5": 4174, "hd3mb_16_6": 4175,
    }
    NEW_UNIT = "平面図形（角度）"
    import re
    for tid, hg in HG_OF.items():
        x = found[tid][0]
        src = "HG-%d" % hg
        assert x.get("src") == src, (tid, x.get("src"), src)
        cur_unit = x.get("unit", None)
        if cur_unit == NEW_UNIT:
            continue  # 適用済み（冪等）
        assert cur_unit == "", (tid, "unit想定外:", repr(cur_unit))

        anchor_re = re.compile(
            r'"src": "%s",\n\s*"title": "[^"]*",\n\s*"category": "zu",\n\s*"unit": ""'
            % re.escape(src)
        )
        m = anchor_re.search(text)
        assert m, "%s: アンカーが見つからない" % tid
        old_block = m.group(0)
        assert text.count(old_block) == 1, (
            "%s: アンカーがファイル中に%d回ある（1回のはず）"
            % (tid, text.count(old_block))
        )
        new_block = old_block[:-len('"unit": ""')] + '"unit": "%s"' % NEW_UNIT
        edits.append((tid + " unit", old_block, new_block))

    # ── 置換の適用（すべての事前チェックを通ってから書く）────────
    if not edits:
        print("変更なし（すでに適用済み）。書き込みはしない。")
        return

    new_text = text
    applied = []
    for label, old, new in edits:
        cnt = new_text.count(old)
        assert cnt == 1, "%s: 置換前のアンカーが%d回ある（1回のはず）" % (label, cnt)
        new_text = new_text.replace(old, new, 1)
        applied.append(label)

    with io.open(target_path, "wb") as f:
        f.write(new_text.encode("utf-8"))

    print("適用した修正: %d件" % len(applied))
    for label in applied:
        print(" -", label)
    skipped = len(target_ids) - 1 - (len(applied) - (1 if any(l == "hd3mb_29_9 intro" for l in applied) else 0))
    print("書き込み完了:", target_path)


if __name__ == "__main__":
    main()
