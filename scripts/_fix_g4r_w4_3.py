# -*- coding: utf-8 -*-
"""
小4理科（公開テスト）大問監査 g4r_w4/audit_3 分の修正パッチ。

対象: docs/_audit/g4r_w4/findings_3.md に書いた重大4件（うち1件は2大問にまたがる＝
延べ5か所の書き換え）。

■ 修正1: hd_4r_k03_576_3 (HG-2813) steps[6]/[7]
  「ぬいばりのP側・Q側は何極か」を2つの小問に分けているが、P側(steps[6])の解説が
  「こすり終わりのQ側はSになり」と、まだ答えていないQ側(steps[7])の答えを先出しして
  いた（分割問題の定番バグ）。Qを先に問う小問に入れかえ、Q側の解説はQだけで完結させ、
  P側の解説はすでに答えた後のQを参照する形に直す（事実関係・答え自体は変えない）。

■ 修正2: hd_4r_k03_576_3 (HG-2813) svg（[図3]の矢印）
  原簿の文章は「矢印の向き（P→Qの右向き）」と明記しているのに、SVGの矢印
  (`marker-end`つきpath)はP側に矢じりが来る向き（＝Q→P、左向き）に描かれていた。
  文章と正解（Pがこすり始め＝N、Qがこすり終わり＝S）に合わせて矢印の向きを反転する。

■ 修正3: hd_4r_k09_606_4 (HG-2842) svg（電池5個のうち2個の＋の向き）
  原簿の文章「D −[電池2：＋がE側]− E」「H −[電池5：＋がI側]− I」に対し、SVGの
  電池記号（＋の出っぱりの位置）は逆（D側・H側）に描かれていた。他3個の電池・
  原簿が明記する電位(V(E)=+1 等)と付き合わせて確認したうえで、＋の出っぱりの
  位置をテキスト通りの側に直す。

■ 修正4: hd_4r_k09_594_4 (HG-2831) svg（B-Cのどう線が図に無い）
  intro文には「B−Cにどう線」と明記され、答えの導出（(2)(4)が実は2個の並列になる
  理由）もこの配線が前提だが、SVGにはB-C間の線が1本も描かれていなかった
  （A起点の4本の放射状の配線だけが描かれている）。B-C間に短い線を1本足す。

■ 修正5: hd_4r_k03_600_3a と hd_4r_k03_600_3b (HG-2837) svg（[図4]の2本の磁石）
  原簿の文章「2本のぼうじしゃくP・Q（どちらも左がN・右がS）」に対し、SVGでは
  上側の磁石は左N・右Sで正しいが、下側の磁石だけ左S・右N（逆）に描かれていた。
  同じSVGを共有する2つの大問（600_3a・600_3b）の両方に同じ修正を当てる。

■ 使い方
  python scripts/_fix_g4r_w4_3.py [対象JSONのパス]
  省略時は data/hama_daimon.json （このファイルから見た相対パス基準）。

■ 設計方針
  - 大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  - 置換前に、その大問の中でちょうど1回だけヒットすることを assert してから
    書き換える（冪等：すでに直った後の文字列が見つかればそのままスキップ）。
  - 大問まるごとの削除・移動はしない。入力形式（テンキー/選択肢）は変えない。
  - 書き出しは io.open(path, "wb") + json.dumps(..., ensure_ascii=False, indent=1)。
"""
import io
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common as gc  # noqa: E402


# ============================================================
# 修正1: hd_4r_k03_576_3 steps[6]/[7] の先出しバグ
# ============================================================
ID_576 = "hd_4r_k03_576_3"
HG_576 = "HG-2813"

Q_P_BEFORE = (
    "[図3]のように、ぼうじしゃくのN極でぬいばりを、P側からQ側へ（右向きに）"
    "数回こすると、ぬいばりはじしゃくになりました。P側は何極ですか。"
)
M_P_BEFORE = (
    "磁石でこすると、こすり終わった側が、こすった極と反対の極になります。"
    "N極でこすったので、こすり終わりのQ側はSになり、その反対のP側はN極になります。"
)
Q_Q_BEFORE = "同じく、Q側は何極ですか。"
M_Q_BEFORE = "こすり終わった側（Q）は、こすった極（N）と反対のS極になります。"

Q_Q_AFTER = (
    "[図3]のように、ぼうじしゃくのN極でぬいばりを、P側からQ側へ（右向きに）"
    "数回こすると、ぬいばりはじしゃくになりました。Q側は何極ですか。"
)
M_Q_AFTER = (
    "磁石でこすると、こすり終わった側が、こすった極と反対の極になります。"
    "N極でこすったので、こすり終わりのQ側はSになります。"
)
Q_P_AFTER = "同じく、P側は何極ですか。"
M_P_AFTER = "こすり終わったQ側がS極なので、その反対のP側はN極になります。"


def step_is(step, q, a, m):
    return (
        step.get("question") == q
        and step.get("answer") == a
        and step.get("meaning") == m
        and step.get("choices") == ["N", "S"]
    )


def fix1_leak(x):
    steps = x.get("steps")
    assert isinstance(steps, list) and len(steps) == 12, (
        "%s: steps の形が想定と違う（12問のはず）: %r" % (ID_576, len(steps) if isinstance(steps, list) else steps)
    )
    s6, s7 = steps[6], steps[7]

    before = step_is(s6, Q_P_BEFORE, "N", M_P_BEFORE) and step_is(s7, Q_Q_BEFORE, "S", M_Q_BEFORE)
    after = step_is(s6, Q_Q_AFTER, "S", M_Q_AFTER) and step_is(s7, Q_P_AFTER, "N", M_P_AFTER)

    if before:
        steps[6] = {
            "question": Q_Q_AFTER,
            "answer": "S",
            "choices": ["N", "S"],
            "meaning": M_Q_AFTER,
        }
        steps[7] = {
            "question": Q_P_AFTER,
            "answer": "N",
            "choices": ["N", "S"],
            "meaning": M_P_AFTER,
        }
        return True
    elif after:
        return False
    else:
        raise AssertionError(
            "%s: steps[6]/[7] の中身が既知のbefore/after状態のどちらとも一致しない。"
            "誰かが別の修正をあてた可能性があるので、内容を見てから手で直すこと。\n"
            "steps[6]=%r\nsteps[7]=%r" % (ID_576, s6, s7)
        )


# ============================================================
# 修正2: hd_4r_k03_576_3 svg の矢印の向き
# ============================================================
ARROW_BEFORE = '<path d="M330,50 L250,50" fill="none" stroke="#ffd166" stroke-width="1.6" marker-end="url(#ar13)"/>'
ARROW_AFTER = '<path d="M250,50 L330,50" fill="none" stroke="#ffd166" stroke-width="1.6" marker-end="url(#ar13)"/>'


# ============================================================
# 修正3: hd_4r_k09_606_4 svg の電池2個の＋の向き
# ============================================================
ID_606 = "hd_4r_k09_606_4"

BAT_DE_BEFORE = (
    '<g transform="translate(115.0,100.0) rotate(0.0)">'
    '<rect x="-11.0" y="-7.0" width="22.0" height="14.0" fill="none" stroke="#4f9eff" stroke-width="1.8"/>'
    '<rect x="-17.0" y="-4.2" width="6.0" height="8.4" fill="#4f9eff" stroke="#4f9eff" stroke-width="1.8"/></g>'
)
BAT_DE_AFTER = (
    '<g transform="translate(115.0,100.0) rotate(0.0)">'
    '<rect x="-11.0" y="-7.0" width="22.0" height="14.0" fill="none" stroke="#4f9eff" stroke-width="1.8"/>'
    '<rect x="11.0" y="-4.2" width="6.0" height="8.4" fill="#4f9eff" stroke="#4f9eff" stroke-width="1.8"/></g>'
)

BAT_HI_BEFORE = (
    '<g transform="translate(225.0,190.0) rotate(0.0)">'
    '<rect x="-11.0" y="-7.0" width="22.0" height="14.0" fill="none" stroke="#4f9eff" stroke-width="1.8"/>'
    '<rect x="-17.0" y="-4.2" width="6.0" height="8.4" fill="#4f9eff" stroke="#4f9eff" stroke-width="1.8"/></g>'
)
BAT_HI_AFTER = (
    '<g transform="translate(225.0,190.0) rotate(0.0)">'
    '<rect x="-11.0" y="-7.0" width="22.0" height="14.0" fill="none" stroke="#4f9eff" stroke-width="1.8"/>'
    '<rect x="11.0" y="-4.2" width="6.0" height="8.4" fill="#4f9eff" stroke="#4f9eff" stroke-width="1.8"/></g>'
)


# ============================================================
# 修正4: hd_4r_k09_594_4 svg にB-Cのどう線を足す
# ============================================================
ID_594 = "hd_4r_k09_594_4"
ANCHOR_594 = '<circle cx="150.0" cy="30.0" r="5.0" fill="#ffd166"/>'
BC_LINE = '<line x1="250.0" y1="30.0" x2="260.0" y2="90.0" stroke="#4f9eff" stroke-width="1.8"/>'


# ============================================================
# 修正5: hd_4r_k03_600_3a / 3b svg の[図4]下側磁石のN/S入れかえ
# ============================================================
ID_600A = "hd_4r_k03_600_3a"
ID_600B = "hd_4r_k03_600_3b"

MAG4_BEFORE = (
    '<text x="87.5" y="209.0" font-size="13" text-anchor="middle" fill="#ffd166">N</text>'
    '<text x="42.5" y="209.0" font-size="13" text-anchor="middle" fill="#c9d4f0">S</text>'
)
MAG4_AFTER = (
    '<text x="87.5" y="209.0" font-size="13" text-anchor="middle" fill="#c9d4f0">S</text>'
    '<text x="42.5" y="209.0" font-size="13" text-anchor="middle" fill="#ffd166">N</text>'
)


def apply_svg_replace(x, target_id, before, after, label):
    """svgフィールドに対し、ちょうど1回のbeforeをafterへ置換する。
    すでにafterが入っていれば冪等にスキップ。どちらでもなければ例外で止める。
    """
    svg = x.get("svg", "")
    if after in svg and before not in svg:
        return False
    cnt = svg.count(before)
    assert cnt == 1, (
        "%s: %s の置換対象が %d 件見つかった（ちょうど1件のはず）" % (target_id, label, cnt)
    )
    x["svg"] = svg.replace(before, after, 1)
    return True


def apply_svg_insert(x, target_id, anchor, insert_str, label):
    """svgフィールドの anchor の直前に insert_str を挿入する（1回だけ）。
    すでに insert_str があれば冪等にスキップ。
    """
    svg = x.get("svg", "")
    if insert_str in svg:
        return False
    cnt = svg.count(anchor)
    assert cnt == 1, (
        "%s: %s の挿入位置(anchor)が %d 件見つかった（ちょうど1件のはず）" % (target_id, label, cnt)
    )
    x["svg"] = svg.replace(anchor, insert_str + anchor, 1)
    return True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gc.BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    d = json.load(io.open(path, encoding="utf-8"))

    found = {}
    for rec in gc.iter_daimon(d):
        x = rec["x"]
        xid = x.get("id")
        if xid in (ID_576, ID_606, ID_594, ID_600A, ID_600B):
            found.setdefault(xid, []).append(x)

    for xid in (ID_576, ID_606, ID_594, ID_600A, ID_600B):
        hits = found.get(xid, [])
        assert len(hits) == 1, (
            "大問 %s が %d 件見つかった（ちょうど1件のはず）: %s" % (xid, len(hits), path)
        )

    changed = {}

    # --- 576: HG番号の確認 ---
    x576 = found[ID_576][0]
    assert x576.get("hg") == HG_576 or x576.get("src") == HG_576, (
        "%s: hg/src が想定と違う: %r" % (ID_576, x576.get("hg") or x576.get("src"))
    )

    changed["1_leak_576"] = fix1_leak(x576)
    changed["2_arrow_576"] = apply_svg_replace(x576, ID_576, ARROW_BEFORE, ARROW_AFTER, "[図3]の矢印")

    # --- 606: 電池2個の向き ---
    x606 = found[ID_606][0]
    assert x606.get("hg") == "HG-2842" or x606.get("src") == "HG-2842", (
        "%s: hg/src が想定と違う: %r" % (ID_606, x606.get("hg") or x606.get("src"))
    )
    changed["3a_bat_DE_606"] = apply_svg_replace(x606, ID_606, BAT_DE_BEFORE, BAT_DE_AFTER, "電池(D-E)の＋の向き")
    changed["3b_bat_HI_606"] = apply_svg_replace(x606, ID_606, BAT_HI_BEFORE, BAT_HI_AFTER, "電池(H-I)の＋の向き")

    # --- 594: B-Cのどう線を追加 ---
    x594 = found[ID_594][0]
    assert x594.get("hg") == "HG-2831" or x594.get("src") == "HG-2831", (
        "%s: hg/src が想定と違う: %r" % (ID_594, x594.get("hg") or x594.get("src"))
    )
    changed["4_bc_wire_594"] = apply_svg_insert(x594, ID_594, ANCHOR_594, BC_LINE, "B-Cのどう線")

    # --- 600_3a / 600_3b: [図4]下側磁石のN/S ---
    x600a = found[ID_600A][0]
    x600b = found[ID_600B][0]
    for xid, xx in ((ID_600A, x600a), (ID_600B, x600b)):
        assert xx.get("hg") == "HG-2837" or xx.get("src") == "HG-2837", (
            "%s: hg/src が想定と違う: %r" % (xid, xx.get("hg") or xx.get("src"))
        )
    changed["5a_mag4_600a"] = apply_svg_replace(x600a, ID_600A, MAG4_BEFORE, MAG4_AFTER, "[図4]下側磁石のN/S")
    changed["5b_mag4_600b"] = apply_svg_replace(x600b, ID_600B, MAG4_BEFORE, MAG4_AFTER, "[図4]下側磁石のN/S")

    out = json.dumps(d, ensure_ascii=False, indent=1)
    io.open(path, "wb").write(out.encode("utf-8"))

    print("path:", path)
    for k in sorted(changed):
        print("changed[%s]:" % k, changed[k])


if __name__ == "__main__":
    main()
