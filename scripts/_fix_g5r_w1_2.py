# -*- coding: utf-8 -*-
"""小5理科 復習テスト fukushu No.13〜19（audit_2.txt・12本）の塾講師監査パッチ。

対象: docs/_audit/g5r_w1/audit_2.txt の12本
  hd_5r_f13_3(HG-0753) / hd_5r_f14_3(HG-0774) / hd_5r_f14_5(HG-0775) /
  hd_5r_f02_2(HG-1801) / hd_5r_f05_1(HG-1802) / hd_5r_f10_4(HG-1804) /
  hd_5r_f10_3(HG-1803) / hd_5r_f06_5(HG-1805) / hd_5r_f08_4(HG-1806) /
  hd_5r_f09_2(HG-1807) / hd_5r_f19_1(HG-2023) / hd_5r_f19_2(HG-2024)

監査結果: この12本には答えのすり替え・図と本文の矛盾・答え先出し・学年超えの公式・
重複実装のいずれも見つからなかった（全問を独立に解き直して原簿の答えと一致することを
確認、SVGの座標も本文の表・向きと一致することを確認）。詳細は
docs/_audit/g5r_w1/findings_2.md を参照。

見つかった唯一の所見（6本で原簿の設問の一部を実装していない＝難易度勾配を保った代表的な
部分集合を選ぶ設計）は、既存データの誤りではなく新規に選択肢・解説を作文する必要がある
「作問」領域の話なので、本パッチには含めない（findings_2.md所見1に理由を記載）。

→ このスクリプトは、対象12本が iter_daimon でちょうど1回ずつ引けることを確認するだけの
   検証パッチで、書き換えは行わない（修正すべき不具合が無いため）。

使い方:
  python scripts/_fix_g5r_w1_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]

冪等: 何回実行してもJSONへの書き込みは発生しない（applied は常に0）。
"""
import json, io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon, hgof

TARGETS = {
    "hd_5r_f13_3": "HG-0753",
    "hd_5r_f14_3": "HG-0774",
    "hd_5r_f14_5": "HG-0775",
    "hd_5r_f02_2": "HG-1801",
    "hd_5r_f05_1": "HG-1802",
    "hd_5r_f10_4": "HG-1804",
    "hd_5r_f10_3": "HG-1803",
    "hd_5r_f06_5": "HG-1805",
    "hd_5r_f08_4": "HG-1806",
    "hd_5r_f09_2": "HG-1807",
    "hd_5r_f19_1": "HG-2023",
    "hd_5r_f19_2": "HG-2024",
}


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "hama_daimon.json")

    d = json.load(io.open(path, encoding="utf-8"))

    seen = {}
    for r in iter_daimon(d):
        x = r["x"]
        rid = x.get("id")
        if rid in TARGETS:
            seen.setdefault(rid, []).append(x)

    missing = sorted(set(TARGETS) - set(seen))
    assert not missing, "見つからない対象id: %r" % missing

    dup = {rid: len(xs) for rid, xs in seen.items() if len(xs) != 1}
    assert not dup, "ちょうど1回のはずが複数/0回: %r" % dup

    for rid, xs in seen.items():
        x = xs[0]
        want_hg = TARGETS[rid]
        got_hgs = hgof(x) or []
        assert want_hg in got_hgs, "%s: HG番号が想定と不一致（想定 %s / 実際 %r）" % (rid, want_hg, got_hgs)

    applied = 0  # このバッチは監査の結果、書き換えるべき不具合が無かった
    print("verified=%d applied=%d -> no write (idempotent, no fix needed for this batch)"
          % (len(seen), applied))


if __name__ == "__main__":
    main()
