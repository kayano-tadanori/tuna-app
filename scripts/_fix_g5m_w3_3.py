# -*- coding: utf-8 -*-
"""g5m_w3 波3（fukushu No.14〜18・24本）の監査で見つかった不具合の修正パッチ。

docs/_audit/g5m_w3/findings_3.md 参照。

  1) 「分数で答えなさい」と指示しているのに answer 欄が小数（"/"を含まない）で、
     js/sansu.js の numpad-frac トグル（`!(q.answer && String(q.answer).includes('/'))`）
     により分数キーが出ず、指示通りに入力できない7か所を「小数で答えなさい」に直す。
  2) hd5m2nd_18_1（HG-0586）の比例グラフ(ア)の直線終点が、自分がラベル表示している
     2点(3,5)(6,10)を通っていない（外積で検算すると0にならない）。終点のyを直す。

使い方: python scripts/_fix_g5m_w3_3.py [対象JSONのパス（省略時 data/hama_daimon.json）]

★大問は genbo_common.py の iter_daimon だけで引く。置換前に「その大問の中でちょうど1回」を
  assert する。冪等（同じ入力に2回かけても結果が変わらない）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon

TARGET_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")


# ── 1) 「分数で答えなさい」→「小数で答えなさい」（7か所・5大問） ──────────────
# 各エントリ: (id, step_idx, 修正前の question 全文, 修正後の question 全文)
TEXT_FIXES = [
    ("hd5m2nd_16_2", 2,
     "本を買ったあとの のこりは、最初のどれだけですか。分数で答えなさい。",
     "本を買ったあとの のこりは、最初のどれだけですか。小数で答えなさい。"),
    ("hd5m2nd_16_2", 3,
     "1200円は、最初のどれだけにあたりますか。分数で答えなさい。",
     "1200円は、最初のどれだけにあたりますか。小数で答えなさい。"),
    ("hd5m2nd_16_6", 0,
     "A球をある高さから落とすと、2回目にはね上がる高さは、落とした高さのどれだけですか。分数で答えなさい。",
     "A球をある高さから落とすと、2回目にはね上がる高さは、落とした高さのどれだけですか。小数で答えなさい。"),
    ("hd5m2nd_16_6", 1,
     "B球の2回目は、落とした高さのどれだけですか。分数で答えなさい。",
     "B球の2回目は、落とした高さのどれだけですか。小数で答えなさい。"),
    ("hd5m2nd_16_7", 1,
     "次にのこりの2/5をとると、そのまた のこりは、直前ののこりのどれだけですか。分数で答えなさい。",
     "次にのこりの2/5をとると、そのまた のこりは、直前ののこりのどれだけですか。小数で答えなさい。"),
    ("hd5m2nd_17_8", 0,
     "1/5を移すと、移した側は もとの何倍になりますか。分数で答えなさい。",
     "1/5を移すと、移した側は もとの何倍になりますか。小数で答えなさい。"),
    ("hd5m2nd_18_3", 0,
     "アの「量÷面積」はいくつですか。分数で答えなさい。",
     "アの「量÷面積」はいくつですか。小数で答えなさい。"),
]

# ── 2) hd5m2nd_18_1（HG-0586）グラフ(ア)の直線終点座標の修正 ──────────────
SVG_FIX_ID = "hd5m2nd_18_1"
SVG_OLD = "<line x1='32' y1='118' x2='116' y2='48.0' stroke='#7ee787' stroke-width='2'/>"
SVG_NEW = "<line x1='32' y1='118' x2='116' y2='36.33' stroke='#7ee787' stroke-width='2'/>"


def _cross(x0, y0, x1, y1, px, py):
    return (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)


def verify_svg_fix():
    """終点を差し替えたあと、直線がラベル付きの2点(68,83)=(3,5)と(104,48)=(6,10)を
    ほぼ通ることを外積で検算する（|cross| が小さいほど直線に近い）。"""
    x0, y0 = 32, 118
    x1, y1 = 116, 36.33
    c1 = _cross(x0, y0, x1, y1, 68, 83)
    c2 = _cross(x0, y0, x1, y1, 104, 48)
    if abs(c1) > 1.0 or abs(c2) > 1.0:
        raise SystemExit(
            "SVG座標検算に失敗（直線が2点を通らない）: cross1=%.3f cross2=%.3f 図は書き込みません" % (c1, c2))
    # 旧座標（バグ）では明らかに0から離れていることも確認しておく（検算スクリプト自体の健全性チェック）
    c1_old = _cross(x0, y0, 116, 48.0, 68, 83)
    c2_old = _cross(x0, y0, 116, 48.0, 104, 48)
    if abs(c1_old) < 1.0 or abs(c2_old) < 1.0:
        raise SystemExit("旧座標が既に直線上に乗っている＝想定と違う。図は書き込みません")


def main():
    if not os.path.exists(TARGET_PATH):
        raise SystemExit("対象JSONが見つかりません: %s" % TARGET_PATH)

    verify_svg_fix()

    d = json.load(io.open(TARGET_PATH, encoding="utf-8"))

    by_id = {}
    for rec in iter_daimon(d):
        x = rec["x"]
        if isinstance(x, dict) and "id" in x:
            by_id.setdefault(x["id"], []).append(x)

    changed = 0
    skipped_already = 0

    # 1) テキスト修正
    for did, step_idx, old_q, new_q in TEXT_FIXES:
        matches = by_id.get(did)
        if not matches:
            raise SystemExit("大問が見つかりません: %s" % did)
        if len(matches) != 1:
            raise SystemExit("id が一意ではありません: %s (%d件)" % (did, len(matches)))
        x = matches[0]
        steps = x.get("steps")
        if not steps or step_idx >= len(steps):
            raise SystemExit("小問が見つかりません: %s step_idx=%d" % (did, step_idx))
        step = steps[step_idx]
        cur_q = step.get("question", "")
        if cur_q == new_q:
            skipped_already += 1
            continue
        if cur_q != old_q:
            raise SystemExit(
                "想定外の内容（%s step_idx=%d）。修正前後どちらの文とも一致しません。\n現在の文: %r"
                % (did, step_idx, cur_q))
        # 大問内で old_q がちょうど1回だけ出ることを確認（他の小問に同一文が無いこと）
        occurrences = sum(1 for s in steps if s.get("question", "") == old_q)
        if occurrences != 1:
            raise SystemExit("大問内での出現回数が1ではありません: %s (%d回)" % (did, occurrences))
        step["question"] = new_q
        changed += 1

    # 2) SVG座標修正
    svg_matches = by_id.get(SVG_FIX_ID)
    if not svg_matches:
        raise SystemExit("大問が見つかりません: %s" % SVG_FIX_ID)
    if len(svg_matches) != 1:
        raise SystemExit("id が一意ではありません: %s (%d件)" % (SVG_FIX_ID, len(svg_matches)))
    xsvg = svg_matches[0]
    svg = xsvg.get("svg", "")
    if SVG_NEW in svg:
        skipped_already += 1
    else:
        occ = svg.count(SVG_OLD)
        if occ != 1:
            raise SystemExit(
                "SVG欄内での旧座標の出現回数が1ではありません: %s (%d回)。想定外のため書き込みません"
                % (SVG_FIX_ID, occ))
        xsvg["svg"] = svg.replace(SVG_OLD, SVG_NEW)
        changed += 1

    if changed == 0:
        print("変更なし（既に適用済み・冪等）。skipped_already=%d" % skipped_already)
        return

    out = json.dumps(d, ensure_ascii=False, indent=1)
    f = io.open(TARGET_PATH, "wb")
    f.write(out.encode("utf-8"))
    f.close()
    print("変更 %d 件を書き込みました（既に適用済みでスキップ %d 件）。%s" % (changed, skipped_already, TARGET_PATH))


if __name__ == "__main__":
    main()
