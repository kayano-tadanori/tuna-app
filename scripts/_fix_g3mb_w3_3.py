# -*- coding: utf-8 -*-
"""塾講師監査(audit_3.txt / 小3マスター算数 第2分冊 fukushu No.20〜21・12本)で見つかった
不具合の修正パッチ。

対象:
  - hd3mb_21_1 (HG-4222) … 選択肢に小3未修の「円柱・角柱」が混ざっている
  - hd3mb_21_2 (HG-4223) … 原簿は表（立方体・直方体の両方）を埋めさせる設問だが、
                            アプリは立方体の数値だけを問い、直方体は「くらべる」設問に
                            すり替わっていて、直方体自身の面6・頂点8・辺12を
                            明示的に答えさせる小問が欠けている

使い方:
    python scripts/_fix_g3mb_w3_3.py [対象JSONのパス]
    省略時は data/hama_daimon.json（プロジェクト直下からの相対パス）。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 置換は「欄まるごとの一致」で冪等判定する：
      現在値 == OLD_FULL なら書き換えて NEW_FULL にする
      現在値 == NEW_FULL ならもう当たっている（何もしない）
      どちらでもなければ想定外の内容＝即座に例外を投げて **1件も書かずに** 止まる
  - find_one は id と src(HG番号) の両方が一致し、かつ該当が
    ちょうど1件であることを確認してから返す。
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
    cur = x.get(field)
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


# ═══════════════════════════════════════════════════════════════════════════
# hd3mb_21_1 (HG-4222) — 選択肢の「円柱・角柱」は小3未修（浜学園カリキュラムでは
# 円柱・角柱は小4/5の単元）。この大問は「立方体と直方体の見分け」だけが骨（原簿
# コメント）なので、誤答の選択肢を同学年で既習の2D図形名（正方形・長方形）に
# 差しかえる。正解・設問文・解説文・答えの判定はいっさい変えない。findings_3.md 軽1。

OLD_STEPS_4222 = [
    {
        "question": "①（辺の長さがすべて同じ立体）の名まえは？",
        "answer": "立方体",
        "choices": ["立方体", "直方体", "円柱", "角柱"],
        "meaning": "辺の長さがすべて同じ＝立方体。",
    },
    {
        "question": "②（横長の箱）の名まえは？",
        "answer": "直方体",
        "choices": ["直方体", "立方体", "円柱", "角柱"],
        "meaning": "長方形の面でできた箱＝直方体。",
    },
    {
        "question": "③（たて長の箱）の名まえは？",
        "answer": "直方体",
        "choices": ["直方体", "立方体", "円柱", "角柱"],
        "meaning": "長方形の面でできた箱＝直方体。",
    },
]

NEW_STEPS_4222 = [
    {
        "question": "①（辺の長さがすべて同じ立体）の名まえは？",
        "answer": "立方体",
        "choices": ["立方体", "直方体", "正方形", "長方形"],
        "meaning": "辺の長さがすべて同じ＝立方体。",
    },
    {
        "question": "②（横長の箱）の名まえは？",
        "answer": "直方体",
        "choices": ["直方体", "立方体", "正方形", "長方形"],
        "meaning": "長方形の面でできた箱＝直方体。",
    },
    {
        "question": "③（たて長の箱）の名まえは？",
        "answer": "直方体",
        "choices": ["直方体", "立方体", "正方形", "長方形"],
        "meaning": "長方形の面でできた箱＝直方体。",
    },
]


def fix_hd3mb_21_1(data, log):
    x = find_one(data, "hd3mb_21_1", "HG-4222")
    apply_field(x, "steps", OLD_STEPS_4222, NEW_STEPS_4222, "hd3mb_21_1 steps", log)


# ═══════════════════════════════════════════════════════════════════════════
# hd3mb_21_2 (HG-4223) — 原簿は「立方体・直方体」2行×「面・頂点・辺」3列の
# 表をまるごと埋めさせる設問（本文p63／解答p24で確認ずみ＝立方体6/8/12、
# 直方体6/8/12）。アプリは立方体の3つの数値だけを問い、直方体は
# 「くらべてどうですか（どれも同じ）」という比較設問にすり替わっていて、
# 直方体自身の面6・頂点8・辺12を明示的に埋めさせる小問が欠けている。
# 既存の④（比較設問。内容は誤りではない）は残したまま、原簿どおりの
# 直方体の面・頂点・辺を問う小問を3つ追加し、④を⑦に繰り下げる。

OLD_STEPS_4223 = [
    {
        "question": "① 立方体の面はいくつありますか。",
        "answer": "6",
        "meaning": "さいころと同じで面は6つ。",
    },
    {
        "question": "② 立方体の頂点はいくつありますか。",
        "answer": "8",
        "meaning": "かどの点は8つ。",
    },
    {
        "question": "③ 立方体の辺は何本ありますか。",
        "answer": "12",
        "meaning": "たて・よこ・高さの向きに4本ずつで12本。",
    },
    {
        "question": "④ 直方体の面・頂点・辺の数は、立方体とくらべてどうですか。",
        "answer": "どれも同じ",
        "choices": ["どれも同じ", "面だけ多い", "辺だけ多い", "頂点だけ少ない"],
        "meaning": "直方体も面6・頂点8・辺12で立方体と同じ。",
    },
]

NEW_STEPS_4223 = [
    {
        "question": "① 立方体の面はいくつありますか。",
        "answer": "6",
        "meaning": "さいころと同じで面は6つ。",
    },
    {
        "question": "② 立方体の頂点はいくつありますか。",
        "answer": "8",
        "meaning": "かどの点は8つ。",
    },
    {
        "question": "③ 立方体の辺は何本ありますか。",
        "answer": "12",
        "meaning": "たて・よこ・高さの向きに4本ずつで12本。",
    },
    {
        "question": "④ 直方体の面はいくつありますか。",
        "answer": "6",
        "meaning": "直方体も面は6つ。",
    },
    {
        "question": "⑤ 直方体の頂点はいくつありますか。",
        "answer": "8",
        "meaning": "直方体も頂点は8つ。",
    },
    {
        "question": "⑥ 直方体の辺は何本ありますか。",
        "answer": "12",
        "meaning": "直方体も辺は12本。",
    },
    {
        "question": "⑦ 直方体の面・頂点・辺の数は、立方体とくらべてどうですか。",
        "answer": "どれも同じ",
        "choices": ["どれも同じ", "面だけ多い", "辺だけ多い", "頂点だけ少ない"],
        "meaning": "直方体も面6・頂点8・辺12で立方体と同じ。",
    },
]


def fix_hd3mb_21_2(data, log):
    x = find_one(data, "hd3mb_21_2", "HG-4223")
    apply_field(x, "steps", OLD_STEPS_4223, NEW_STEPS_4223, "hd3mb_21_2 steps", log)


FIXES = [
    fix_hd3mb_21_1,
    fix_hd3mb_21_2,
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
