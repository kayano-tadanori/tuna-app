# -*- coding: utf-8 -*-
"""小5理科（fukushu No.11〜No.18）大問監査 g5r_w1/audit_1 分の修正パッチ。

対象: docs/_audit/g5r_w1/findings_1.md に書いた重大5件。いずれも
「原簿の設問数 と アプリの小問数が食い違い、原簿の設問の一部が丸ごと未実装」
という同じパターン（浜学園理科の監査で頻出）。原本PDF
（C:\\Users\\User\\Desktop\\浜問題\\）はGoogle Driveが未接続でアクセスできず、
今回も未確認（findings_1.md冒頭に記載）。5件とも、原本を必要とせず
①原簿レコード自身に書かれた設問文・答え ②図SVGの座標からの独立検算
③同じ大問内の他の小問との様式そろえ、だけで内容と答えを確定できたものだけを直した。

  1. HG-0777（hd_5r_f15_9・鏡と見える範囲）
     原簿は(1)〜(6)の6問だが、アプリには(1)(2)(6)しか入っておらず、
     階段構造の中間にあたる(3)(4)(5)（Bから最も右／Cから最も左／Dから
     最も近い）が丸ごと抜けていた。方眼の座標（A(3,1)/B(2,3)/C(5,4)/D(3,6)、
     鏡=第6列・第2〜7行）から鏡像法で直線と鏡の交点を計算し直し、
     genboの答え（D／A／C）と一致することを確認したうえで、原簿の順番
     どおり(2)と(6)の間に3問を挿入する。

  2. HG-0755（hd_5r_f16_6・かみなり・やまびこ・風）
     原簿(1)(2)(3)(4)のうち、作問メモが「(3)が核」と名指しする
     ミサイルの速さの設問がまるごと抜けていた。30度の直角三角形は
     斜辺:対辺=2:1になる性質から 音の速さ340÷2=秒速170m と独立に
     検算して確認し、(2)やまびこ と (3)風 の間に挿入する。

  3. HG-0779（hd_5r_f15_7・虫めがねの明るい円）
     原簿は(1)〜(6)の6問だが、アプリには(2)〜(5)しか入っておらず、
     最初の(1)（レンズの種類＝とつレンズ）と最後の(6)（A=16cmとA=24cmの
     明るさ比較＝同じ）が抜けていた。(6)は B=|A-20|÷2 の式で
     A=16,24 とも |A-20|=4 になる（しょう点をはさんで対称）ことを検算して
     確認し、(1)を先頭、(6)を末尾に追加する。

  4. HG-0780（hd_5r_f15_10・針穴写真機）
     この大問のタイトルは「上下左右がひっくり返る」だが、実装されている
     4つの小問はすべて像の大きさ・明るさの問題で、肝心の上下左右反転
     （原簿(5)）を試す設問が1つも無かった。180°回転の性質から
     素直に導ける(5)（上→下に動く物体の像は下→上に動く）を末尾に足す。
     原簿(2)（Pの文字がどう映るか＝ア〜カの図形選択）は、選択肢が
     文字の形の画像に依存し原本なしでは正確な再現ができないため見送り。

  5. HG-0771（hd_5r_f12_4・6つの星の等級）
     原簿(1)〜(10)のうち、選択肢が既存の小問（星Aは星Dより何倍明るいか）
     と共通の同じ7段階の等級表・5段階の倍率表を使う(3)（星Aは星Fより
     何倍明るいか＝約6.25倍）と(6)（星Aは星Cより何倍明るいか＝約2.5倍）を
     独立に計算し直して確認したうえで、原簿の順番どおり挿入する。
     (1)(5)（星の色＝ベガ／ポルックスの実在の天文知識）と(9)（星Eは
     肉眼で最も暗い＝6等星、intro文で既出のためほぼ自明）は、いずれも
     内容非該当（バグではなく設計上の省略）と判断し見送り。

使い方:
  python scripts/_fix_g5r_w1_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

きまり:
  * 大問は scripts/genbo_common.py の iter_daimon だけで引く（走査を自前で書かない）
  * 挿入の前に「その大問の中でちょうど1回」に該当することを assert し、
    1件でもおかしければ1件も書かずに中止する
  * 冪等：挿入する設問文の一意な部分文字列がすでにあればスキップ
  * 大問まるごとの削除・移動はしない。既存の問題文・答え・図SVGは変えない
    （新しく足す小問はテンキー入力／選択肢のどちらも既存と同じ形式のまま）
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


def find_one(d, daimon_id):
    matches = [
        rec for rec in iter_daimon(d)
        if isinstance(rec["x"], dict) and rec["x"].get("id") == daimon_id
    ]
    if len(matches) != 1:
        raise AssertionError(
            "id=%s の大問が %d 本ヒット（1本のはず）" % (daimon_id, len(matches))
        )
    return matches[0]["x"]


def _has_question_containing(steps, mark):
    return any(mark in (s.get("question") or "") for s in steps)


# ---------------------------------------------------------------------------
# FIX 1: HG-0777（hd_5r_f15_9）(3)(4)(5) を挿入
# ---------------------------------------------------------------------------
ID_0777 = "hd_5r_f15_9"

STEP_B_RIGHT = {
    "question": "Bから見て、鏡にうつって見える人の中で、いちばん右に見えるのはだれですか。",
    "answer": "D",
    "choices": ["A", "C", "D"],
    "meaning": (
        "Bから鏡を見ると、自分・C・Dの3人がうつって見える（Aは像との直線が鏡の外を"
        "通るので見えない）。うつる位置は、その人の像とBを結んだ直線が鏡を横切る行で"
        "決まり、行の数字が大きいほど右に見える。自分→C→Dの順に交わる行の数字が"
        "大きくなっていくので、いちばん右に見えるのは **D**。"
    ),
}
STEP_C_LEFT = {
    "question": "Cから見て、鏡にうつって見える人の中で、いちばん左に見えるのはだれですか。",
    "answer": "A",
    "choices": ["A", "B", "D"],
    "meaning": (
        "Cから鏡を見ると、A・B・自分・Dの4人がうつって見える。うつる位置は、"
        "その人の像とCを結んだ直線が鏡を横切る行で決まり、行の数字が小さいほど"
        "左に見える。この中でいちばん行の数字が小さいのは **A** なので、いちばん"
        "左に見えるのはA。"
    ),
}
STEP_D_NEAREST = {
    "question": "Dから見て、鏡にうつって見える人の中で、いちばん近くに見えるのはだれですか。",
    "answer": "C",
    "choices": ["A", "B", "C"],
    "meaning": (
        "鏡にうつって見える人までの道のり（Dから鏡で反射してその人まで）は、"
        "Dとその人の像を直線で結んだ長さに等しい。方眼のマス目で測ると、この"
        "きょりはA・B・Cの中でCがいちばん短いので、いちばん近くに見えるのは **C**。"
    ),
}
MARK_B_RIGHT = "Bから見て"
MARK_C_LEFT = "Cから見て"
MARK_D_NEAREST = "Dから見て"


def fix_hg0777_insert_345(d):
    x = find_one(d, ID_0777)
    assert x.get("src") == "HG-0777", "%s: src が想定と違う: %r" % (ID_0777, x.get("src"))
    steps = x.get("steps")
    if not isinstance(steps, list):
        raise AssertionError("%s に steps が無い" % ID_0777)

    already = (
        _has_question_containing(steps, MARK_B_RIGHT)
        and _has_question_containing(steps, MARK_C_LEFT)
        and _has_question_containing(steps, MARK_D_NEAREST)
    )
    if already:
        return False, True

    if _has_question_containing(steps, MARK_B_RIGHT) or _has_question_containing(steps, MARK_C_LEFT) \
            or _has_question_containing(steps, MARK_D_NEAREST):
        raise AssertionError("%s: 3問のうち一部だけが既にある状態。中身を目視確認すること" % ID_0777)

    if len(steps) != 3:
        raise AssertionError(
            "%s の steps が想定と違う（3問のはずが%d問）。先に内容を目視確認すること。" % (ID_0777, len(steps))
        )
    # 原簿の順番 (1)(2)(3)(4)(5)(6) を保つため、既存の(1)(2)の直後・(6)の直前=index2 に挿入
    steps[2:2] = [dict(STEP_B_RIGHT), dict(STEP_C_LEFT), dict(STEP_D_NEAREST)]
    return True, False


# ---------------------------------------------------------------------------
# FIX 2: HG-0755（hd_5r_f16_6）(3) ミサイルの速さ を挿入
# ---------------------------------------------------------------------------
ID_0755 = "hd_5r_f16_6"

STEP_MISSILE = {
    "question": (
        "ミサイルが一定の速さでまっすぐ飛んでいます。ある地点の真上をミサイルが"
        "通過したちょうどそのとき、その地点では**真上から30度かたむいた方向**"
        "からミサイルの音が聞こえました。このミサイルの速さは秒速何mですか。"
    ),
    "answer": "170",
    "meaning": (
        "音が出た場所・ミサイルが真上に来た場所・地上の人の3点で直角三角形が"
        "できる。30度の直角三角形では **斜辺：真上から30度側の対辺＝2：1**。"
        "同じ時間で音は斜辺を、ミサイルはその対辺を進むので、速さの比も2：1。"
        "ミサイルの速さは音の速さの半分、340÷2＝**秒速170m**。"
    ),
}
MARK_MISSILE = "真上から30度"


def fix_hg0755_insert_missile(d):
    x = find_one(d, ID_0755)
    assert x.get("src") == "HG-0755" or x.get("hg") == "HG-0755", (
        "%s: src/hg が想定と違う" % ID_0755
    )
    steps = x.get("steps")
    if not isinstance(steps, list):
        raise AssertionError("%s に steps が無い" % ID_0755)

    if _has_question_containing(steps, MARK_MISSILE):
        return False, True

    if len(steps) != 3:
        raise AssertionError(
            "%s の steps が想定と違う（3問のはずが%d問）。先に内容を目視確認すること。" % (ID_0755, len(steps))
        )
    # 原簿の順番 (1)雷(2)やまびこ(3)ミサイル(4)風 を保つため index2 に挿入
    steps[2:2] = [dict(STEP_MISSILE)]
    return True, False


# ---------------------------------------------------------------------------
# FIX 3: HG-0779（hd_5r_f15_7）(1) レンズの種類 / (6) 明るさ比較 を挿入
# ---------------------------------------------------------------------------
ID_0779 = "hd_5r_f15_7"

STEP_LENS_KIND = {
    "question": "この虫めがねのレンズは、何レンズですか。",
    "answer": "とつレンズ",
    "choices": ["おうレンズ", "とつレンズ", "調光レンズ"],
    "meaning": "日光を1点に集められるのは、真ん中がふくらんだ **とつレンズ**。虫めがねやルーペに使われている。",
}
STEP_BRIGHT_SAME = {
    "question": "A＝16cmのときと、A＝24cmのときで、中心付近が明るいのはどちらですか。",
    "answer": "同じ明るさ",
    "choices": ["16cmの方が明るい", "24cmの方が明るい", "同じ明るさ"],
    "meaning": (
        "しょう点（A＝20cm）までのきょりは、16cmは20−16＝4cm手前、24cmは"
        "24−20＝4cm先で、どちらも同じ4cm。B＝(20−A)÷2 の式はしょう点を"
        "はさんで左右対称なので、Bの大きさ（＝明るい円の直径）も同じ2cmになる。"
        "同じ量の光が同じ大きさの円に集まるので、**同じ明るさ**になる。"
    ),
}
MARK_LENS_KIND = "何レンズですか"
MARK_BRIGHT_SAME = "16cmの方が明るい"


def fix_hg0779_insert_1_and_6(d):
    x = find_one(d, ID_0779)
    assert x.get("src") == "HG-0779", "%s: src が想定と違う: %r" % (ID_0779, x.get("src"))
    steps = x.get("steps")
    if not isinstance(steps, list):
        raise AssertionError("%s に steps が無い" % ID_0779)

    has_lens = _has_question_containing(steps, MARK_LENS_KIND)
    has_bright = any(MARK_BRIGHT_SAME in (c or "") for s in steps for c in (s.get("choices") or []))
    if has_lens and has_bright:
        return False, True
    if has_lens or has_bright:
        raise AssertionError("%s: (1)(6)のうち一部だけが既にある状態。中身を目視確認すること" % ID_0779)

    if len(steps) != 4:
        raise AssertionError(
            "%s の steps が想定と違う（4問のはずが%d問）。先に内容を目視確認すること。" % (ID_0779, len(steps))
        )
    steps.insert(0, dict(STEP_LENS_KIND))
    steps.append(dict(STEP_BRIGHT_SAME))
    return True, False


# ---------------------------------------------------------------------------
# FIX 4: HG-0780（hd_5r_f15_10）(5) 上下反転の設問を追加
# ---------------------------------------------------------------------------
ID_0780 = "hd_5r_f15_10"

STEP_UPDOWN = {
    "question": "物体が上から下へ動くとき、すりガラスにうつる像はどう動きますか。",
    "answer": "下から上へ動く",
    "choices": ["下から上へ動く", "上から下へ動く", "動かない"],
    "meaning": (
        "針穴を通った光は、上下左右がそっくり入れかわって（180°回転して）うつる。"
        "だから物体が上から下へ動くと、像は反対に **下から上へ** 動いて見える。"
    ),
}
MARK_UPDOWN = "上から下へ動くとき"


def fix_hg0780_insert_updown(d):
    x = find_one(d, ID_0780)
    assert x.get("src") == "HG-0780", "%s: src が想定と違う: %r" % (ID_0780, x.get("src"))
    steps = x.get("steps")
    if not isinstance(steps, list):
        raise AssertionError("%s に steps が無い" % ID_0780)

    if _has_question_containing(steps, MARK_UPDOWN):
        return False, True

    if len(steps) != 4:
        raise AssertionError(
            "%s の steps が想定と違う（4問のはずが%d問）。先に内容を目視確認すること。" % (ID_0780, len(steps))
        )
    steps.append(dict(STEP_UPDOWN))
    return True, False


# ---------------------------------------------------------------------------
# FIX 5: HG-0771（hd_5r_f12_4）(3) AvsF / (6) AvsC を挿入
# ---------------------------------------------------------------------------
ID_0771 = "hd_5r_f12_4"

RATIO_CHOICES = ["約2.5倍", "約6.25倍", "約16倍", "約40倍", "100倍"]

STEP_A_VS_F = {
    "question": "星Aは 星Fよりも 何倍 明るいですか。",
    "answer": "約6.25倍",
    "choices": list(RATIO_CHOICES),
    "meaning": "星Aは1等星、星Fは3等星なので **2等級** ちがう。表より **約6.25倍**。",
}
STEP_A_VS_C = {
    "question": "星Aは 星Cよりも 何倍 明るいですか。",
    "answer": "約2.5倍",
    "choices": list(RATIO_CHOICES),
    "meaning": "星Aは1等星、星Cは2等星なので **1等級** ちがう。表より **約2.5倍**。",
}
MARK_A_VS_F = "星Fよりも"
MARK_A_VS_C = "星Cよりも"


def fix_hg0771_insert_avsf_avsc(d):
    x = find_one(d, ID_0771)
    assert x.get("src") == "HG-0771", "%s: src が想定と違う: %r" % (ID_0771, x.get("src"))
    steps = x.get("steps")
    if not isinstance(steps, list):
        raise AssertionError("%s に steps が無い" % ID_0771)

    has_f = _has_question_containing(steps, MARK_A_VS_F)
    has_c = _has_question_containing(steps, MARK_A_VS_C)
    if has_f and has_c:
        return False, True
    if has_f or has_c:
        raise AssertionError("%s: AvsF/AvsCのうち一部だけが既にある状態。中身を目視確認すること" % ID_0771)

    if len(steps) != 5:
        raise AssertionError(
            "%s の steps が想定と違う（5問のはずが%d問）。先に内容を目視確認すること。" % (ID_0771, len(steps))
        )
    # 既存順: [星B, 星C, 星D, AvsD, 星F]。原簿の順番 (2)B(3)AvsF(4)C(6)AvsC(7)D(8)AvsD(10)F を保つ。
    q_b = steps[0].get("question", "")
    q_c = steps[1].get("question", "")
    q_d = steps[2].get("question", "")
    if "星B" not in q_b or "星C" not in q_c or "星D" not in q_d:
        raise AssertionError(
            "%s: steps[0:3] の並びが想定と違う（星B,星C,星D の順のはず）。中身を目視確認すること。"
            "\nsteps[0]=%r\nsteps[1]=%r\nsteps[2]=%r" % (ID_0771, q_b, q_c, q_d)
        )
    steps.insert(1, dict(STEP_A_VS_F))   # 星Bの直後
    steps.insert(3, dict(STEP_A_VS_C))   # 星Cの直後（挿入後のindexは星Bの分だけずれて3）
    return True, False


FIXES = [
    ("hd_5r_f15_9 (HG-0777)", "(3)(4)(5)＝Bから最も右／Cから最も左／Dから最も近い、を挿入", fix_hg0777_insert_345),
    ("hd_5r_f16_6 (HG-0755)", "(3)＝ミサイルの速さ(170)を挿入", fix_hg0755_insert_missile),
    ("hd_5r_f15_7 (HG-0779)", "(1)レンズの種類／(6)明るさ比較(同じ)を挿入", fix_hg0779_insert_1_and_6),
    ("hd_5r_f15_10 (HG-0780)", "(5)上下反転の設問を追加", fix_hg0780_insert_updown),
    ("hd_5r_f12_4 (HG-0771)", "(3)AvsF／(6)AvsCを挿入", fix_hg0771_insert_avsf_avsc),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    applied = 0
    already = 0
    for tag, note, fn in FIXES:
        did, skipped = fn(d)
        label = "%s %s" % (tag, note)
        if did:
            print("[FIX]     %s" % label)
            applied += 1
        elif skipped:
            print("[SKIP]    %s はすでに適用ずみ" % label)
            already += 1

    if applied == 0:
        print("書きかえるものが無いため、書き出しはしない。適用ずみ: %d件" % already)
        return 0

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))

    print("適用: %d件 / 適用ずみ(スキップ): %d件 / 合計: %d件" % (applied, already, len(FIXES)))
    print("書き出し:", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
