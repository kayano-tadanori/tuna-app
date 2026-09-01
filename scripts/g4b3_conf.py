# -*- coding: utf-8 -*-
"""小4マスター算数 第3分冊（No.29〜43・HG-5770〜6562）の帯の設定。

第1分冊の道具（g4b1_*.py）＋第2分冊の答え方（g4b2_build.py）をそのまま使い回し、
番号の帯と単元だけ差しかえる。
★設問・答えは原簿のまま（feedback_genbo_dori）。変えるのは答え方の様式だけ。

⚠ HG-6563 以降は「小5最レ 第1・2分冊」の帯。第3分冊は 6562 で切る。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HG_LO, HG_HI = 5770, 6562

# 回ごとのHG番号の帯（原簿の第3分冊の進捗表そのまま。回ごとに55番ずつ）
ROUND_RANGES = [
    (5770, 5824, 29), (5825, 5879, 30), (5880, 5934, 31), (5935, 5989, 32),
    (5990, 6044, 33), (6045, 6099, 34), (6100, 6154, 35), (6155, 6209, 36),
    (6210, 6264, 37), (6265, 6319, 38), (6320, 6374, 39), (6375, 6429, 40),
    (6430, 6484, 41), (6485, 6539, 42), (6540, 6562, 43),
]

# 単元名は、すでに hama_daimon.json で使われている名前にそろえる（単元しぼりでまとまるように）
ROUND_UNIT = {
    29: "立体の数え上げ",            # 面・辺・頂点・ひもかけ・積み木のこ数
    30: "展開図・投影図",
    31: "立体図形（体積・表面積）",
    32: "立体図形（体積・表面積）",   # 体積・容積の単位、水そう
    33: "小数の計算",
    34: "倍数・約数",
    35: "分数", 36: "分数", 37: "分数",
    38: "和差算・分配算",
    39: "和差算・分配算",            # 分配算・倍数算
    40: "過不足算・差集め算",
    41: "つるかめ算",                # 年令算のぶんは UNIT_OVERRIDE で「年齢算」に振り分ける
    42: "相当算・還元算",
    43: "消去算",
}
ROUND_CAT = {
    29: "rittai", 30: "rittai", 31: "rittai", 32: "rittai",
    33: "keisan", 34: "kazu", 35: "keisan", 36: "keisan", 37: "keisan",
    38: "tokusan", 39: "tokusan", 40: "tokusan", 41: "tokusan",
    42: "tokusan", 43: "tokusan",
}

# No.41 は1回の中で「年令算」と「つるかめ算」の2単元に分かれる（原簿の勘所どおり）。
# 年令算＝テーマ1〜3・練習1〜3・B1・B2・C1〜C3／つるかめ算＝テーマ4・練習4・B3〜B7・C4
UNIT_OVERRIDE = {}
for _n in (6430, 6431, 6432, 6433, 6434, 6435, 6436, 6437, 6438,
           6443, 6444, 6450, 6451, 6452):
    UNIT_OVERRIDE["HG-%d" % _n] = "年齢算"


def apply():
    """g4b1_* の各モジュールを第3分冊の帯に切りかえる。import の直後に呼ぶ。"""
    import g4b1_parse
    g4b1_parse.HG_LO, g4b1_parse.HG_HI = HG_LO, HG_HI
    import g4b1_add_daimon as A
    A.ROUND_RANGES = ROUND_RANGES
    A.ROUND_UNIT = ROUND_UNIT
    A.ROUND_CAT = ROUND_CAT
    import g4b2_build as BB
    import g4b3_build as B3
    import g4b1_build as B1
    # 第3分冊で出てくる単位（cm³・つ・題…）を足す。足すだけなので前の分冊の答えは変わらない
    for u in B3.EXTRA_UNITS:
        if u not in B1.UNITS:
            B1.UNITS.append(u)
    B1.to_numpad2 = B3.to_numpad3      # ** と ／ の飾りをそうじしてから読む
    A.steps_for = B3.steps_for
    A.PRE_HOOK = B3.pre_hook
    g4b1_parse.split_marked = BB.split_marked_seq
    A.kaihou_part = BB.kaihou_part_seq
    A.stem_of = BB.stem_seq
    A.MIGI_REPL = [("右の図", "下の図"),
                   ("右図", "下の図")]

    # 図SVGが2枚あるレコードは1枚にたたむ（アプリは1レコード1枚しか出せない）
    _orig_parse = A.parse_record

    import g4b3_manual as M0

    def _parse(hg, title, rec):
        p = _orig_parse(hg, title, rec)
        merged = BB.merge_svgs(rec)
        if merged:
            p["svg"] = merged
        if hg in M0.INTRO_OVERRIDE:
            # 原簿の「設定」が作図のためのメモ（マスの座標・点線・かくれる…）になっている大問は、
            # 子どもが読む文に置きかえる
            p["intro"] = M0.INTRO_OVERRIDE[hg]
        return p

    A.parse_record = _parse

    # 大問のタイトルから「第3分冊」の見出しを落とす（第1分冊むけの正規表現のまま）
    _orig_short = A.short_title

    def _short(title):
        import re
        t = re.sub(r"^小4マスター算数第3分冊\s*", "", title).strip("★ ")
        m = re.search(r"[（(]([^（）()]+)[）)]\s*★*\s*$", title)
        return m.group(1) if m else t

    A.short_title = _short
    import g4b3_manual as M
    A.MANUAL = M.MANUAL
    A.SKIP = M.SKIP

    # No.41 のように、1回の中で単元が2つに分かれるぶんを振り分ける
    _orig_build = A.build_specs

    def _build():
        import re as _re
        titles = {}
        import g4b1_parse as _P
        for _hg, _t, _r in _P.load_records():
            titles[_hg] = _t
        out, unres = _orig_build()
        for hg, no, spec in out:
            if hg in UNIT_OVERRIDE:
                spec["unit"] = UNIT_OVERRIDE[hg]
            # ★難易度は★4まで使う（アプリの他のコースでも★4は出ている）。
            #   第1分冊むけの star_of は3で頭打ちにしていたので、
            #   C問題★★★と最難問★★★★が同じ見た目になっていた
            m = _re.search(r"(★+)\s*$", titles.get(hg, ""))
            star = min(4, len(m.group(1))) if m else 1
            sec = 3 if "C問題" in titles.get(hg, "") else 2 if "B問題" in titles.get(hg, "") else 1
            spec["star"] = max(star, sec)
            t = titles.get(hg, "")
            spec["_sec"] = ("れいだい" if "テーマ" in t else "れんしゅう" if "練習" in t
                            else "Bもんだい" if "B問題" in t else "Cもんだい" if "C問題" in t else "")
        return out, unres

    A.build_specs = _build
    return A
