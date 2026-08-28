# -*- coding: utf-8 -*-
"""小4マスター算数 第2分冊（No.14〜28・HG-4945〜5769）の帯の設定。

第1分冊の道具（g4b1_*.py）をそのまま使い回し、番号の帯と単元だけ差しかえる。
★設問・答えは原簿のまま（feedback_genbo_dori）。変えるのは答え方の様式だけ。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HG_LO, HG_HI = 4945, 5769

# 回ごとのHG番号の帯（原簿の第2分冊の進捗表そのまま。回ごとに55番ずつ）
ROUND_RANGES = [
    (4945, 4999, 14), (5000, 5054, 15), (5055, 5109, 16), (5110, 5164, 17),
    (5165, 5219, 18), (5220, 5274, 19), (5275, 5329, 20), (5330, 5384, 21),
    (5385, 5439, 22), (5440, 5494, 23), (5495, 5549, 24), (5550, 5604, 25),
    (5605, 5659, 26), (5660, 5714, 27), (5715, 5769, 28),
]

# 単元名は、すでに hama_daimon.json で使われている名前にそろえる（単元しぼりでまとまるように）
ROUND_UNIT = {
    14: "平面図形（角度）", 15: "平面図形（角度）", 16: "図形の性質",
    17: "平面図形（長さ）", 18: "平面図形（面積）", 19: "平面図形（面積）",
    20: "平面図形（面積）", 21: "平面図形（面積）", 22: "植木算",
    23: "規則性・数列", 24: "周期算", 25: "日暦算", 26: "日暦算",
    27: "場合の数", 28: "場合の数",
}
ROUND_CAT = {
    14: "zu", 15: "zu", 16: "zu", 17: "zu", 18: "zu", 19: "zu", 20: "zu", 21: "zu",
    22: "tokusan", 23: "kisoku", 24: "kisoku", 25: "kisoku", 26: "kisoku",
    27: "baai", 28: "baai",
}


def apply():
    """g4b1_* の各モジュールを第2分冊の帯に切りかえる。import の直後に呼ぶ。"""
    import g4b1_parse
    g4b1_parse.HG_LO, g4b1_parse.HG_HI = HG_LO, HG_HI
    import g4b1_add_daimon as A
    A.ROUND_RANGES = ROUND_RANGES
    A.ROUND_UNIT = ROUND_UNIT
    A.ROUND_CAT = ROUND_CAT
    import g4b2_build as BB
    A.steps_for = BB.steps_for
    A.PRE_HOOK = BB.pre_hook
    g4b1_parse.split_marked = BB.split_marked_seq
    A.kaihou_part = BB.kaihou_part_seq
    A.stem_of = BB.stem_seq
    A.MIGI_REPL = [("右の図", "下の図"),
                   ("右図", "下の図")]

    # 図SVGが2枚あるレコードは1枚にたたむ（アプリは1レコード1枚しか出せない）
    _orig_parse = A.parse_record

    def _parse(hg, title, rec):
        p = _orig_parse(hg, title, rec)
        merged = BB.merge_svgs(rec)
        if merged:
            p["svg"] = merged
        return p

    A.parse_record = _parse
    import g4b2_manual as M
    A.MANUAL = M.MANUAL
    A.SKIP = M.SKIP
    return A
