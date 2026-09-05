# -*- coding: utf-8 -*-
"""塾講師監査(audit_2.txt / 小3マスター算数 第2分冊 fukushu No.19〜20・16本)で見つかった
不具合の修正パッチ。

対象: hd3mb_19_9（HG-4207）「図の中の四角形を数える」

不具合: 原本PDF（3年マスター算数_第2分冊.pdf 本文p42／解答 3年_解答_3年マスター算数2分冊.pdf p18）
を確認すると、対角線は長方形の左上の角から右下の角まで（2x2マスの中心を通って両方のマスを
貫通して）引かれている。ところがアプリのsvgは原簿の図SVG欄をそのまま複製しており、対角線が
中心（たて線・よこ線の交点）で止まっていた。この状態で②の台形を数えると2個しかできず、
保存されている正解「4」と矛盾する（findings_2.md 重大1）。

検算: 5つの最小の面（左上マスを対角線で割った上下2つの三角形・右上マス・左下マス・右下マス）
の空でない部分集合すべて(31通り)をshapelyでunionし、単純な4角形になるものを
「向かい合う1組だけ平行=台形」で分類した。対角線を中心止まりにすると台形は2個
（長方形は9個で①と矛盾しない）。対角線を長方形の右下の角まで伸ばすと、右下マスも
対角線で2つに割れて台形が4個になり、解答PDFの考え方図（1,2,3,4の4つの網かけ）と一致する。

修正:
  - svg: 対角線 <line x1="40.0" y1="34.0" x2="200.0" y2="114.0" .../> の終点を
    長方形の右下の角(360.0,194.0)まで伸ばす。中心点(200.0,114.0)をちょうど通るため、
    たて線・よこ線との交点は変わらず①の答え（9）に影響しない。
  - intro: 「左上のますに対角線が1本入っています」は、対角線が右下のマスまで貫通する
    修正後の図と合わなくなるため、「左上から右下まで対角線を1本引いています」に直す。
  - ①②の答え（9・4）、steps[].meaning は修正後の図と矛盾しないため変更しない。

使い方:
    python scripts/_fix_g3mb_w3_2.py [対象JSONのパス]
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


OLD_SVG = (
    '<svg viewBox="0 0 400.0 220.0" xmlns="http://www.w3.org/2000/svg" '
    'style="display:block;margin:0 auto;max-width:100%"><rect x="40.0" y="34.0" '
    'width="320.0" height="160.0" fill="none" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="200.0" y1="34.0" x2="200.0" y2="194.0" stroke="#4f9eff" stroke-width="1.8"/>'
    '<line x1="40.0" y1="114.0" x2="360.0" y2="114.0" stroke="#4f9eff" stroke-width="1.8"/>'
    '<line x1="40.0" y1="34.0" x2="200.0" y2="114.0" stroke="#4f9eff" stroke-width="1.8"/></svg>'
)

NEW_SVG = (
    '<svg viewBox="0 0 400.0 220.0" xmlns="http://www.w3.org/2000/svg" '
    'style="display:block;margin:0 auto;max-width:100%"><rect x="40.0" y="34.0" '
    'width="320.0" height="160.0" fill="none" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="200.0" y1="34.0" x2="200.0" y2="194.0" stroke="#4f9eff" stroke-width="1.8"/>'
    '<line x1="40.0" y1="114.0" x2="360.0" y2="114.0" stroke="#4f9eff" stroke-width="1.8"/>'
    '<line x1="40.0" y1="34.0" x2="360.0" y2="194.0" stroke="#4f9eff" stroke-width="1.8"/></svg>'
)

OLD_INTRO = "\u6a2a\u9577\u306e\u9577\u65b9\u5f62\u3092\u305f\u3066\u7dda1\u672c\u30fb\u3088\u3053\u7dda1\u672c\u30674\u3064\u306b\u5206\u3051\u3001\u5de6\u4e0a\u306e\u307e\u3059\u306b\u5bfe\u89d2\u7dda\u304c1\u672c\u5165\u3063\u3066\u3044\u307e\u3059\u3002"

NEW_INTRO = "\u6a2a\u9577\u306e\u9577\u65b9\u5f62\u3092\u305f\u3066\u7dda1\u672c\u30fb\u3088\u3053\u7dda1\u672c\u30674\u3064\u306b\u5206\u3051\u3001\u5de6\u4e0a\u304b\u3089\u53f3\u4e0b\u307e\u3067\u5bfe\u89d2\u7dda\u30921\u672c\u5f15\u3044\u3066\u3044\u307e\u3059\u3002"


def fix_hd3mb_19_9(data, log):
    """②の台形の答え「4」と図SVGの対角線（中心止まり＝台形2個しか作れない）が
    矛盾していた不具合を直す。対角線を長方形の右下の角まで伸ばし、intro文も
    それに合わせる。findings_2.md 重大1。"""
    x = find_one(data, "hd3mb_19_9", "HG-4207")
    apply_field(x, "svg", OLD_SVG, NEW_SVG, "hd3mb_19_9 svg", log)
    apply_field(x, "intro", OLD_INTRO, NEW_INTRO, "hd3mb_19_9 intro", log)


FIXES = [
    fix_hd3mb_19_9,
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
