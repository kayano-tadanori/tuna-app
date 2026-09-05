# -*- coding: utf-8 -*-
"""塾講師監査 g5r_w3 パケット2（kokai No.4〜1・小5理科6本）の修正パッチ。
対象: docs/_audit/g5r_w3/audit_2.txt。6本のうち4件を修正する。

  1) hd_5r_k04_601_4 (HG-1602): 原簿(2)の①②③（3問）が丸ごと未実装だった。
     図SVGには最初から[図2][図3]が描かれているのに、対応する設問が1問も無く浮いていた。
     原簿の答え（① イ＝Q／② ア＝120cmより短い／③ ア＝180cmより短い）を独立に検算のうえ、
     3問を末尾に追加し、[図2][図3]を使う設問を復元する。

  2) hd_5r_k01_610_4 (HG-1646): 原簿(1)(2)（気体Aの名前＝二酸化炭素／せいしつ＝温室効果ガス）
     が先頭から丸ごと未実装だった。同じ回の他の大問（HG-1644, HG-1645）は原簿に
     「（参考・不採用の小問）」の注記があって意図的な間引きと分かるが、この大問だけは
     そうした注記が無く、単純な実装もれと判断。2問を先頭に追加する。

  3) hd_5r_k01_610_3 (HG-1645): 図3[Q]・図4[R]・図5[S]の回路図で、「2個直列」の
     豆電球2つの間をつなぐ導線が8か所（3つの図×上下2段、Sだけ枝が2つで4か所）とも
     欠落していた（幅13〜17pxの隙間で導線が途切れる）。電池と電池の間にある視覚上の
     隙間（幅18〜20px、「…」の省略表記とセットで使われる別の様式）とは幅もパターンも異なり、
     こちらには省略の注記が無い＝単純な描画もれと判定。座標を検算したうえで、
     欠けている導線8本だけを追加する（回路のつなぎ方・答えは一切変えない）。

  4) hd_5r_k01_610_2 (HG-1644): 原簿(4)②（部屋の空気1m³にふくむことのできる水じょう気の
     最大の重さ＝24.4g）が単独の設問として実装されておらず、値だけが次の設問（しつ度）の
     解説に先出しされていた。②を独立した設問として2番目と3番目の間に追加する。

見送り（修正なし）:
  - hd_5r_k04_637_4 (HG-2862): 座標を実測し、磁針①〜④の向きをすべて独立に検算。
    図と文・答えは完全に一致。問題なし。
  - hd_5r_k04_613_4 (HG-2850): 3問すべて独立に検算。原簿と完全一致。問題なし。

使い方: python scripts/_fix_g5r_w3_2.py [対象JSONのパス]
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
# FIX 1: hd_5r_k04_601_4 (HG-1602) — 原簿(2)①②③（3問）が未実装
# ---------------------------------------------------------------------------
STEP_1602_Q = {
    "question": "50℃の ぼうP・ぼうQ・ぼうRを 0℃に 冷やしたとき、いちばん 短くなるのは どれですか。",
    "answer": "Q",
    "choices": ["Q", "P", "R"],
    "meaning": "100℃に すると Qが いちばん のびて、Pが 2番目だった。のびが 大きい ものほど、冷やしたときの ちぢみも 大きい。だから 0℃に 冷やすと **Qが いちばん 短くなる**。",
}
STEP_1602_S = {
    "question": "[図2] ぼうPと ぼうQを つないで 100℃に した ものと、長さも 太さも 同じで 100℃の アルミニウムの ぼうSが あります。ぼうSを 50℃に 冷やすと、長さは どうなりますか。",
    "answer": "120cmより短い",
    "choices": ["120cmより短い", "ちょうど120cm", "120cmより長い"],
    "meaning": "ぼうP＋ぼうQは 50℃で ちょうど120cm。ぼうSは 全部が アルミニウムなので、100℃から 50℃に 冷えるときの ちぢみが（PとQの まぜものより）大きい（アルミは いちばん のびちぢみが 大きい金属）。だから 50℃に 冷やすと **120cmより短く** なる。",
}
STEP_1602_T = {
    "question": "[図3] ぼうP・ぼうQ・ぼうRを つないで 0℃に した ものと、長さも 太さも 同じで 0℃の 鉄の ぼうTが あります。ぼうTを 50℃に 温めると、長さは どうなりますか。",
    "answer": "180cmより短い",
    "choices": ["180cmより短い", "ちょうど180cm", "180cmより長い"],
    "meaning": "ぼうP・Q・Rは 50℃で 合わせて ちょうど180cm。ぼうTは 全部が 鉄なので、0℃から 50℃に あたたまるときの のびが（P・Q・Rの まぜものより）小さい（鉄は いちばん のびちぢみが 小さい金属）。だから 50℃に 温めても **180cmより短い** ままになる。",
}


def plan_fix1(x):
    steps = x.get("steps", [])
    if len(steps) == 4 and steps[3].get("answer") == "R":
        new_steps = steps + [STEP_1602_Q, STEP_1602_S, STEP_1602_T]

        def apply(xx):
            xx["steps"] = new_steps

        return ("fix1: hd_5r_k04_601_4 に原簿(2)①②③（Q／120cmより短い／180cmより短い）を追加", apply)

    if (
        len(steps) == 7
        and steps[4].get("answer") == "Q"
        and steps[5].get("answer") == "120cmより短い"
        and steps[6].get("answer") == "180cmより短い"
    ):
        return ("fix1: hd_5r_k04_601_4 は適用済み（変更なし）", None)

    raise SystemExit(
        "FATAL fix1: hd_5r_k04_601_4 のstepsが未適用/適用済みどちらの形とも一致しない（%d問）。中断。"
        % len(steps)
    )


# ---------------------------------------------------------------------------
# FIX 2: hd_5r_k01_610_4 (HG-1646) — 原簿(1)(2)（気体Aの名前・せいしつ）が未実装
# ---------------------------------------------------------------------------
STEP_1646_NAME = {
    "question": "木炭を 完全に 燃やして できる 気体A の 名前は 何ですか。",
    "answer": "二酸化炭素",
    "choices": ["二酸化炭素", "メタン", "水素", "ちっ素"],
    "meaning": "炭素（木炭）を 酸素が 十分な 状態で 完全に 燃やすと、二酸化炭素が できる。",
}
STEP_1646_PROP = {
    "question": "気体A（二酸化炭素）の せいしつとして 正しいものは どれですか。",
    "answer": "温室効果ガスの1つである",
    "choices": [
        "温室効果ガスの1つである",
        "燃料電池の材料として使われる",
        "人がこきゅうをするときにからだに取り入れられる",
        "ヨウ素液の色を青むらさき色に変える",
    ],
    "meaning": "二酸化炭素は 地球を あたためる はたらきを 持つ 温室効果ガスの 1つ。",
}


def plan_fix2(x):
    steps = x.get("steps", [])
    if len(steps) == 5 and steps[0].get("answer") == "44":
        new_steps = [STEP_1646_NAME, STEP_1646_PROP] + steps

        def apply(xx):
            xx["steps"] = new_steps

        return ("fix2: hd_5r_k01_610_4 に原簿(1)(2)（二酸化炭素／温室効果ガス）を先頭へ追加", apply)

    if (
        len(steps) == 7
        and steps[0].get("answer") == "二酸化炭素"
        and steps[1].get("answer") == "温室効果ガスの1つである"
        and steps[2].get("answer") == "44"
    ):
        return ("fix2: hd_5r_k01_610_4 は適用済み（変更なし）", None)

    raise SystemExit(
        "FATAL fix2: hd_5r_k01_610_4 のstepsが未適用/適用済みどちらの形とも一致しない（%d問）。中断。"
        % len(steps)
    )


# ---------------------------------------------------------------------------
# FIX 3: hd_5r_k01_610_3 (HG-1645) — 図3・図4・図5の「2個直列」の間の導線が8か所欠落
# ---------------------------------------------------------------------------
# 各要素 = (直前にある既存の配線, 隙間の開始x, 隙間の終わりx, y座標)
# ★アンカー文字列はSVG中でちょうど1回しか出ない（座標がすべて異なる）ことを確認済み。
SVG3_GAPS = [
    ('<line x1="147.6" y1="20.0" x2="157.2" y2="20.0" stroke="#c9d4f0" stroke-width="1.8"/>', "157.2", "174.0", "20.0"),
    ('<line x1="147.6" y1="110.0" x2="157.2" y2="110.0" stroke="#c9d4f0" stroke-width="1.8"/>', "157.2", "174.0", "110.0"),
    ('<line x1="222.6" y1="20.0" x2="232.2" y2="20.0" stroke="#c9d4f0" stroke-width="1.8"/>', "232.2", "249.0", "20.0"),
    ('<line x1="222.6" y1="110.0" x2="232.2" y2="110.0" stroke="#c9d4f0" stroke-width="1.8"/>', "232.2", "249.0", "110.0"),
    ('<line x1="137.4" y1="20.0" x2="142.8" y2="20.0" stroke="#c9d4f0" stroke-width="1.8"/>', "142.8", "156.0", "20.0"),
    ('<line x1="137.4" y1="110.0" x2="142.8" y2="110.0" stroke="#c9d4f0" stroke-width="1.8"/>', "142.8", "156.0", "110.0"),
    ('<line x1="247.4" y1="20.0" x2="252.8" y2="20.0" stroke="#c9d4f0" stroke-width="1.8"/>', "252.8", "266.0", "20.0"),
    ('<line x1="247.4" y1="110.0" x2="252.8" y2="110.0" stroke="#c9d4f0" stroke-width="1.8"/>', "252.8", "266.0", "110.0"),
]


def _bridge(gs, ge, y):
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#c9d4f0" stroke-width="1.8"/>' % (gs, y, ge, y)


def plan_fix3(x):
    svg = x.get("svg", "")
    # ★アンカー（隙間の直前の配線）はbridge挿入後も消えずに残るので、
    #   「アンカーがあるか」だけでは未適用/適用済みを区別できない。
    #   区別は必ず「bridgeそのものが既にあるか」で行う。
    has_anchor = [g for g in SVG3_GAPS if svg.count(g[0]) == 1]
    has_bridge = [g for g in SVG3_GAPS if svg.count(_bridge(g[1], g[2], g[3])) == 1]
    unapplied = [g for g in has_anchor if g not in has_bridge]
    applied = [g for g in has_anchor if g in has_bridge]

    if len(has_anchor) == 8 and len(unapplied) == 8 and len(applied) == 0:
        new_svg = svg
        for anchor, gs, ge, y in SVG3_GAPS:
            if new_svg.count(anchor) != 1:
                raise SystemExit("FATAL fix3: アンカーが1回でない（適用中に変化）。中断。%r" % anchor)
            new_svg = new_svg.replace(anchor, anchor + _bridge(gs, ge, y), 1)

        def apply(xx):
            xx["svg"] = new_svg

        return ("fix3: hd_5r_k01_610_3 の図3/図4/図5、豆電球2個直列の間の欠落した導線8本を追加", apply)

    if len(has_anchor) == 8 and len(applied) == 8 and len(unapplied) == 0:
        return ("fix3: hd_5r_k01_610_3 は適用済み（変更なし）", None)

    raise SystemExit(
        "FATAL fix3: hd_5r_k01_610_3 のsvgが未適用/適用済みどちらの形とも一致しない"
        "（アンカー%d/8・未適用%d/8・適用済み%d/8）。中断。" % (len(has_anchor), len(unapplied), len(applied))
    )


# ---------------------------------------------------------------------------
# FIX 4: hd_5r_k01_610_2 (HG-1644) — 原簿(4)②（24.4g）が未実装で値だけ解説に先出し
# ---------------------------------------------------------------------------
STEP_1644_SATURATION = {
    "question": "この部屋の 空気1m³ に ふくむことが できる 水じょう気の 最大の 重さは 何g ですか。",
    "answer": "24.4",
    "meaning": "部屋の 気温は 26℃。[表]より 26℃の ほう和水じょう気量は **24.4g**。",
}


def plan_fix4(x):
    steps = x.get("steps", [])
    if len(steps) == 4 and steps[1].get("answer") == "17.3" and steps[2].get("answer") == "70.9":
        new_steps = steps[:2] + [STEP_1644_SATURATION] + steps[2:]

        def apply(xx):
            xx["steps"] = new_steps

        return ("fix4: hd_5r_k01_610_2 に原簿(4)②（24.4g）を2番目と3番目の間へ追加", apply)

    if (
        len(steps) == 5
        and steps[1].get("answer") == "17.3"
        and steps[2].get("answer") == "24.4"
        and steps[3].get("answer") == "70.9"
    ):
        return ("fix4: hd_5r_k01_610_2 は適用済み（変更なし）", None)

    raise SystemExit(
        "FATAL fix4: hd_5r_k01_610_2 のstepsが未適用/適用済みどちらの形とも一致しない（%d問）。中断。"
        % len(steps)
    )


def main():
    path = get_target_path()
    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    targets = {
        "hd_5r_k04_601_4": plan_fix1,
        "hd_5r_k01_610_4": plan_fix2,
        "hd_5r_k01_610_3": plan_fix3,
        "hd_5r_k01_610_2": plan_fix4,
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
