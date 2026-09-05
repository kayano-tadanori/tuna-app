# -*- coding: utf-8 -*-
"""小4理科（復習・公開）週2監査 audit_1.txt の findings を直す修正パッチ。

対象findings: docs/_audit/g4r_w2/findings_1.md
  1) hd_4r_f42_6 (HG-1837): 原簿の[表]の数値がintroにもsvgにも無く、4問とも
     「[表]より」を参照しているのに表を一度も見られないまま解答不能だった。
     4つのstepsに、原簿の表をそのまま再現した表SVGを追加する。
  2) hd_4r_f42_5b (HG-1836): steps[3]（(ア)を問う小問）の解説が、まだ聞いていない
     steps[4]（(イ)＝Dを問う小問）の答えを「B＋D＝…ちょうど0」と名指しで
     先出ししていた。steps[3]の解説からD の名指しを外し、steps[4]の解説を
     自己完結（そこでB+C・B+Dを計算する）に書き替える。
  3) hd_4r_f36_1 (HG-1846): steps[3]の設問文が「金にあたるのは…残るBは何ですか。
     あわせて、金の記号を答えなさい。」と2つの問いを1つの答えに詰め込んでいて
     日本語として何を答えればよいか分かりにくかった。1問1答えに整理する。

使い方:
    python scripts/_fix_g4r_w2_1.py [対象JSONパス]
    省略時は data/hama_daimon.json。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 文字列置換の前に、置換対象がその大問の中でちょうど1回であることを assert する。
  - 冪等：2回流しても結果は変わらない（既に直っていれば何もしない）。
  - 大問まるごとの削除・移動・入力形式の変更はしない（choices/answerの形はそのまま）。
  - 図SVGを追加する前に、はみ出し・重なりが無いことを座標で検算する（合わなければ止める）。
"""
import sys, io, os, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as gc

TARGET_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gc.BASE, "data", "hama_daimon.json")


# ── hd_4r_f42_6 に足す表SVG（原簿の[表]をそのまま再現） ──────────────────
# 全体の重さ(g):   100 120 140 160 180 200
# 液面の体積(cm3): 100 102 104 114 124 134
# レイアウトは同教材の hd_4r_f42_4（表1/表2のSVG）と同じ書式
#   （ラベル列幅168・データ列幅58・行高23・キャプションy=15）を踏襲し、
#   データ列を4列→6列に増やしただけ。
TABLE_SVG_F42_6 = (
    "<svg viewBox='0 0 546 104' xmlns='http://www.w3.org/2000/svg' "
    "style=\"display:block;margin:0 auto;max-width:100%\">"
    "<text x='8' y='15' fill='#ffd166' font-size='10' text-anchor='start'>"
    "[表] 30℃の水100cm³に固体Pを20gずつとかしていったときの記録</text>"
    "<rect x='16' y='26' width='168' height='23' fill='rgba(59,130,246,0.14)' stroke='#64748b' stroke-width='1'/>"
    "<text x='100' y='41.6' fill='#ffd166' font-size='10' text-anchor='middle'>全体の重さ(g)</text>"
    "<rect x='184' y='26' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='213' y='41.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>100</text>"
    "<rect x='242' y='26' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='271' y='41.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>120</text>"
    "<rect x='300' y='26' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='329' y='41.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>140</text>"
    "<rect x='358' y='26' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='387' y='41.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>160</text>"
    "<rect x='416' y='26' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='445' y='41.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>180</text>"
    "<rect x='474' y='26' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='503' y='41.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>200</text>"
    "<rect x='16' y='49' width='168' height='23' fill='rgba(59,130,246,0.14)' stroke='#64748b' stroke-width='1'/>"
    "<text x='100' y='64.6' fill='#ffd166' font-size='10' text-anchor='middle'>液面の体積(cm³)</text>"
    "<rect x='184' y='49' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='213' y='64.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>100</text>"
    "<rect x='242' y='49' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='271' y='64.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>102</text>"
    "<rect x='300' y='49' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='329' y='64.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>104</text>"
    "<rect x='358' y='49' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='387' y='64.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>114</text>"
    "<rect x='416' y='49' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='445' y='64.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>124</text>"
    "<rect x='474' y='49' width='58' height='23' fill='rgba(59,130,246,0.05)' stroke='#64748b' stroke-width='1'/>"
    "<text x='503' y='64.6' fill='#e2e8f0' font-size='10' text-anchor='middle'>134</text>"
    "</svg>"
)

# 座標検算（合わなければここで止める。1件も書かない）。
_cols = [184, 242, 300, 358, 416, 474]
assert _cols[0] == 16 + 168, "ラベル列とデータ列の間にすき間/重なりがある"
assert all(_cols[i + 1] - _cols[i] == 58 for i in range(len(_cols) - 1)), "データ列の幅が均等でない"
assert _cols[-1] + 58 <= 546, "データ列がviewBoxの右端をはみ出す"
assert 49 + 23 <= 104, "データ行がviewBoxの下端をはみ出す"
import xml.etree.ElementTree as _ET
_ET.fromstring(TABLE_SVG_F42_6)  # 整形式チェック（壊れたXMLなら例外で止まる）


def _collect_strings(obj, out):
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _collect_strings(v, out)


def daimon_text(x):
    """置換対象の文字列が、この大問の中で本当に1回だけかを見るための全文。

    ★json.dumps(x)だと改行が \\n にエスケープされ、実際の文字列（生の改行）を
      探しても0件になってしまう（2026-09-06に自分で踏んだ）。dict/listを再帰して
      生の文字列だけを集め、フィールドをまたいだ誤マッチを避けるため区切り文字
      （NUL）でつないで返す。
    """
    out = []
    _collect_strings(x, out)
    return "\x00".join(out)


def apply_once(x, obj, key, old, new, label, changed):
    """objの[key]の中の old を new に置換する。冪等・1回ぶんの一意性を確認。

    - old が無く new が既にあれば「既に直っている」とみなして何もしない（冪等）。
    - old が大問全体の中でちょうど1回でなければ止める。
    """
    cur = obj[key]
    if old not in cur:
        if new in cur:
            return False
        raise AssertionError("%s: 置換対象の文字列が見つからない（大問の中身が想定と違う）" % label)
    whole = daimon_text(x)
    cnt = whole.count(old)
    assert cnt == 1, "%s: 大問全体の中に置換対象の文字列が%d件ある（ちょうど1件のはず）" % (label, cnt)
    obj[key] = cur.replace(old, new, 1)
    changed.append(label)
    return True


def find_one(d, daimon_id):
    hits = [rec["x"] for rec in gc.iter_daimon(d) if rec["x"].get("id") == daimon_id]
    assert len(hits) == 1, "id=%s が%d件ヒットした（ちょうど1件のはず）" % (daimon_id, len(hits))
    return hits[0]


def main():
    d = json.load(io.open(TARGET_PATH, encoding="utf-8"))
    changed = []

    # ── 1) hd_4r_f42_6: 表SVGが無く4問とも解答不能 → 4つのstepsに表SVGを追加 ──
    x = find_one(d, "hd_4r_f42_6")
    n_set = 0
    for step in x["steps"]:
        if step.get("svg") != TABLE_SVG_F42_6:
            step["svg"] = TABLE_SVG_F42_6
            n_set += 1
    if n_set:
        changed.append("hd_4r_f42_6: steps[0..%d]に表SVGを追加（%d件更新）" % (len(x["steps"]) - 1, n_set))

    # ── 2) hd_4r_f42_5b: steps[3]の解説がsteps[4]の答え(D)を先出ししていた ──
    x = find_one(d, "hd_4r_f42_5b")
    step_a = x["steps"][3]
    old_a = (
        "とけ残りが あるのは **AとB**、ないのは **CとD**。4通り ためします。\n"
        "A＋C＝水400g・X96g（上限80g）→ 16g 残る ✗\n"
        "A＋D＝水500g・X108g（上限100g）→ 8g 残る ✗\n"
        "B＋C＝水500g・X108g（上限100g）→ 8g 残る ✗\n"
        "**B＋D＝水600g・X120g（上限120g）→ ちょうど 0 ✓**\n"
        "だから (ア)は **B**。"
    )
    new_a = (
        "とけ残りが あるのは **AとB**、ないのは **CとD**。とけ残りが ある ほうが、\n"
        "とけ残りの ない どちらかと 組んで ちょうど 0に なるかを ためします。\n"
        "A＋C＝水400g・X96g（上限80g）→ 16g 残る ✗\n"
        "A＋D＝水500g・X108g（上限100g）→ 8g 残る ✗\n"
        "**Aは どちらと 組んでも ぴったり 0には なりません。**\n"
        "この 実験では ちょうど 0に なる 組が 1つだけ あるので、その 組の\n"
        "とけ残りが あるほうは **B** に 決まります（相手が CとDの どちらかは 次の問題で 確かめます）。\n"
        "だから (ア)は **B**。"
    )
    apply_once(x, step_a, "meaning", old_a, new_a,
               "hd_4r_f42_5b: steps[3](ア)の解説から(イ)の答えの先出しを削除", changed)

    step_i = x["steps"][4]
    old_i = "上の 4通りで 残りが 0に なるのは **B と D** の 組だけ。だから (イ)は **D**。"
    new_i = (
        "Bが 組む 相手を ためします。\n"
        "B＋C＝水500g・X108g（上限100g）→ 8g 残る ✗\n"
        "**B＋D＝水600g・X120g（上限120g）→ ちょうど 0 ✓**\n"
        "だから (イ)は **D**。"
    )
    apply_once(x, step_i, "meaning", old_i, new_i,
               "hd_4r_f42_5b: steps[4](イ)の解説を自己完結に書き直し", changed)

    # ── 3) hd_4r_f36_1: steps[3]の設問文が2つの問いを1つの答えに詰め込んでいた ──
    x = find_one(d, "hd_4r_f36_1")
    step4 = x["steps"][3]
    old_q = "ヒント④から、金にあたるのはA〜Eのどれですか。残るBは何ですか。あわせて、金の記号を答えなさい。"
    new_q = "ヒント④から、金にあたるのはA〜Eのどれですか。"
    apply_once(x, step4, "question", old_q, new_q,
               "hd_4r_f36_1: steps[3]の設問文を1問1答えに整理", changed)

    out = io.open(TARGET_PATH, "wb")
    out.write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    out.close()

    print("changed: %d" % len(changed))
    for c in changed:
        print(" -", c)


if __name__ == "__main__":
    main()
