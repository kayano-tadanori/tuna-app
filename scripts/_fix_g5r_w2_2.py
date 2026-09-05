# -*- coding: utf-8 -*-
"""塾講師監査 g5r_w2 パケット2（kokai No.8〜10・小5理科）の修正パッチ。
対象: docs/_audit/g5r_w2/audit_2.txt の11本のうち4件を修正。

  1) hd_5r_k08_605_4 (HG-1628): 図SVGの「+2/+6」ラベルと「ひみつ」キャプションが
     小問1・小問2の答え（2, 6）をそのまま表示してしまっている。表の下の注記だけを削り、
     表そのもの（小問3まで解くのに必要な生データ）は残す。
  2) hd_5r_k10_607_4 (HG-1620): 原簿の①②（水素5g→45g／炭素15g→55g、単純な比例の
     足場もんだい）が丸ごと未実装。既存の3問（③④⑤＝12,4,46）の前に追加する。
  3) hd_5r_k09_618_4 (HG-2855): ろ過の絵4つ・結晶の絵3つが、対応する知識設問(1)(2)(3)を
     実装していないため浮いたまま表示される。実装済みの4問(4)〜(7)が使う「とけ残りの表」
     部分だけを残す。
  4) hd_5r_k09_606_2 (HG-1633): かげの向き図（あ・い・う・え）が、対応する設問(3)を
     実装していないため浮いたまま表示される。図SVGを空にする（実装済みの2問は図不要）。

使い方: python scripts/_fix_g5r_w2_2.py [対象JSONのパス]
  省略時は data/hama_daimon.json（リポジトリ直下からの相対）。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（id で一意に特定し、複数ヒットなら abort）。
  - 4件すべての「現在の状態」を先に検証してから書き込む（全部OKでなければ1バイトも書かない）。
  - 各修正は「未適用の既知の形」か「適用済みの既知の形」のどちらかであることを確認する。
    どちらでもない（想定外の中身になっている）場合は abort する。
  - 冪等: 2回実行しても2回目は「すでに適用済み」を検出して何も変えない。
"""
import io
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
from genbo_common import iter_daimon, BASE  # noqa: E402


def get_target_path():
    if len(sys.argv) > 1:
        return sys.argv[1]
    return os.path.join(BASE, "data", "hama_daimon.json")


def find_one(d, target_id):
    """iter_daimon だけを使って id で1本だけ引く。0本/2本以上なら abort。"""
    matches = [rec["x"] for rec in iter_daimon(d) if rec["x"].get("id") == target_id]
    if len(matches) != 1:
        raise SystemExit(
            "FATAL: id=%s が %d 件ヒット（ちょうど1件のはず）。中断（何も書きません）。"
            % (target_id, len(matches))
        )
    return matches[0]


# ---------------------------------------------------------------------------
# FIX 1: hd_5r_k08_605_4 (HG-1628) — 図が小問1・小問2の答えを直接見せている
# ---------------------------------------------------------------------------
MARK_1_OLD = "<text x='20.0' y='104.0'"
VIEWBOX_1_OLD = "viewBox='0 0 406 156'"
VIEWBOX_1_NEW = "viewBox='0 0 406 90'"


def plan_fix1(x):
    svg = x.get("svg", "")
    if MARK_1_OLD in svg:
        head = svg.split(MARK_1_OLD, 1)[0]
        if not head.rstrip().endswith("</text>"):
            raise SystemExit(
                "FATAL fix1: マーカー直前が </text> で終わっていない。想定外の中身。中断。"
            )
        if svg.count(MARK_1_OLD) != 1:
            raise SystemExit("FATAL fix1: マーカーが2回以上出現。中断。")
        if head.count(VIEWBOX_1_OLD) != 1:
            raise SystemExit("FATAL fix1: viewBoxが見つからない/複数ある。中断。")
        new_svg = head.replace(VIEWBOX_1_OLD, VIEWBOX_1_NEW, 1) + "</svg>"

        def apply(xx):
            xx["svg"] = new_svg

        return ("fix1: hd_5r_k08_605_4 の +2/+6 ラベル・ひみつキャプションを削除", apply)

    # 既に適用済みか？
    if (
        MARK_1_OLD not in svg
        and VIEWBOX_1_NEW in svg
        and "+2</text>" not in svg
        and "+6</text>" not in svg
        and svg.rstrip().endswith("</svg>")
    ):
        return ("fix1: hd_5r_k08_605_4 は適用済み（変更なし）", None)

    raise SystemExit("FATAL fix1: hd_5r_k08_605_4 のsvgが未適用/適用済みどちらの形とも一致しない。中断。")


# ---------------------------------------------------------------------------
# FIX 2: hd_5r_k10_607_4 (HG-1620) — 原簿の①②（易しい足場）が未実装
# ---------------------------------------------------------------------------
STEP_H2_1G = {
    "question": "水素5g を 燃やすと、水は 何g できますか。",
    "answer": "45",
    "meaning": "水素1gで 水9gが できるので、5gなら 5倍。9×5＝**45g**。",
}
STEP_C3G = {
    "question": "炭素15g を 燃やすと、二酸化炭素は 何g できますか。",
    "answer": "55",
    "meaning": "炭素3gで 二酸化炭素11gが できるので、15gは 15÷3＝5倍。11×5＝**55g**。",
}


def plan_fix2(x):
    steps = x.get("steps", [])
    if len(steps) == 3 and steps[0].get("answer") == "12":
        new_steps = [STEP_H2_1G, STEP_C3G] + steps

        def apply(xx):
            xx["steps"] = new_steps

        return ("fix2: hd_5r_k10_607_4 に原簿①②（45g・55g）を先頭へ追加", apply)

    if (
        len(steps) == 5
        and steps[0].get("answer") == "45"
        and steps[1].get("answer") == "55"
        and steps[2].get("answer") == "12"
    ):
        return ("fix2: hd_5r_k10_607_4 は適用済み（変更なし）", None)

    raise SystemExit(
        "FATAL fix2: hd_5r_k10_607_4 のstepsが未適用/適用済みどちらの形とも一致しない（%d問）。中断。"
        % len(steps)
    )


# ---------------------------------------------------------------------------
# FIX 3: hd_5r_k09_618_4 (HG-2855) — ろ過4種・結晶3種の図が浮いている
# ---------------------------------------------------------------------------
MARK_3_OLD = '<g transform="translate(80,90)">'
VIEWBOX_3_OLD = 'viewBox="0 0 700 260"'
VIEWBOX_3_NEW = 'viewBox="175 -8 300 66"'


def plan_fix3(x):
    svg = x.get("svg", "")
    if MARK_3_OLD in svg:
        if svg.count(MARK_3_OLD) != 1:
            raise SystemExit("FATAL fix3: マーカーが2回以上出現。中断。")
        head = svg.split(MARK_3_OLD, 1)[0]
        if not head.rstrip().endswith("</g>"):
            raise SystemExit("FATAL fix3: マーカー直前が </g> で終わっていない。想定外の中身。中断。")
        if "とけ残り" not in head:
            raise SystemExit("FATAL fix3: 残す側に「とけ残り」ラベルが無い。想定外。中断。")
        if head.count(VIEWBOX_3_OLD) != 1:
            raise SystemExit("FATAL fix3: viewBoxが見つからない/複数ある。中断。")
        new_svg = head.replace(VIEWBOX_3_OLD, VIEWBOX_3_NEW, 1) + "</svg>"

        def apply(xx):
            xx["svg"] = new_svg

        return ("fix3: hd_5r_k09_618_4 のろ過・結晶の絵を削除（表のみ残す）", apply)

    if (
        MARK_3_OLD not in svg
        and VIEWBOX_3_NEW in svg
        and "とけ残り" in svg
        and svg.rstrip().endswith("</svg>")
    ):
        return ("fix3: hd_5r_k09_618_4 は適用済み（変更なし）", None)

    raise SystemExit("FATAL fix3: hd_5r_k09_618_4 のsvgが未適用/適用済みどちらの形とも一致しない。中断。")


# ---------------------------------------------------------------------------
# FIX 4: hd_5r_k09_606_2 (HG-1633) — かげの向き図が浮いている
# ---------------------------------------------------------------------------
SVG4_MARKERS = ('>あ<', '>い<', '>う<', '>え<', 'y="230.0"')


def plan_fix4(x):
    svg = x.get("svg", "")
    if svg == "":
        return ("fix4: hd_5r_k09_606_2 は適用済み（変更なし）", None)

    if all(m in svg for m in SVG4_MARKERS) and svg.lstrip().startswith('<svg viewBox="0 0 260 260"'):
        def apply(xx):
            xx["svg"] = ""

        return ("fix4: hd_5r_k09_606_2 のかげの向き図を削除（対応する設問が未実装のため）", apply)

    raise SystemExit("FATAL fix4: hd_5r_k09_606_2 のsvgが未適用/適用済みどちらの形とも一致しない。中断。")


def main():
    path = get_target_path()
    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    targets = {
        "hd_5r_k08_605_4": plan_fix1,
        "hd_5r_k10_607_4": plan_fix2,
        "hd_5r_k09_618_4": plan_fix3,
        "hd_5r_k09_606_2": plan_fix4,
    }

    plans = []
    for tid, planner in targets.items():
        x = find_one(d, tid)
        desc, apply_fn = planner(x)
        plans.append((desc, apply_fn, x))

    # 全部の事前検証を通ったので、ここでまとめて適用する（部分適用を避ける）。
    changed = 0
    for desc, apply_fn, x in plans:
        print(desc)
        if apply_fn is not None:
            apply_fn(x)
            changed += 1

    if changed == 0:
        print("変更なし（すべて適用済み）。ファイルは書き換えません。")
        return

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))
    print("書き込み完了: %s（%d件変更）" % (path, changed))


if __name__ == "__main__":
    main()
