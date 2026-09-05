# -*- coding: utf-8 -*-
"""
小5理科（復習テスト・公開テスト）大問監査 g5r_w1/audit_3 分の修正パッチ。

対象: docs/_audit/g5r_w1/findings_3.md に書いた2件（重大1・中1）。
（他に見つかった軽微2件は、設問構成そのものを変える判断になるため見送り＝このスクリプトには含めない）

■ 修正1: hd_5r_k05_602_4 (HG-1618) intro + steps
  原簿の(5)「[図2]の板の※を加熱したとき、最初に変化するものと最後に変化するものはどれか」が
  1問も実装されておらず、その一方でSVGには[図2]（正方形の板・D/E/F/G/※）の図形だけが
  説明も設問も無いまま描画されていた（[図1]の棒の問題しか使われていない）。
  SVGの実座標（D,E,F,G,※の中心・座標）から熱源※までの直線距離を計算し
  （F≒118.9が最短／E≒236.2が最長）、原簿の答え（最初=F、最後=E）と一致することを確認した上で、
  introに[図2]の説明を追記し、stepsの末尾に2問（最初/最後）を追加する。

■ 修正2: hd_5r_f21_1 (HG-2030) svg（溶解度曲線のベジエ曲線が点エを通っていない）
  intro文が「曲線は30℃で5g、50℃で15gを通っています」と明記し、(3)の答え(ウ・エ)の根拠に
  なっているのに、SVGの2次ベジエ曲線（"T"コマンドで自動的に対称反転した制御点）は
  実際には点エ(196.9,54)を通らず、ベジエの数式で解くと点エの位置でy≒59.85
  （g換算で約13.95g、点エの15gとの差 約5.9px＝点マーカー半径2.6pxの2倍以上）となり、
  曲線が点エの下に浮いて描かれていた（点ウのほうは誤差0.9pxでほぼ一致）。
  第2区間の制御点を「t=0.5でちょうど点エを通る」ように解き直した値
  (200.0, 47.8) に差し替える（始点・終点・第1区間はそのまま）。

■ 使い方
  python scripts/_fix_g5r_w1_3.py [対象JSONのパス]
  省略時は data/hama_daimon.json （このファイルから見た相対パス基準）。

■ 設計方針
  - 大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  - 置換前に、その大問の中でちょうど1回だけヒットすることを assert してから書き換える
    （冪等：すでに直った後の状態であればそのままスキップし、想定外の状態なら例外で止める）。
  - 大問まるごとの削除・移動はしない。入力形式（テンキー/選択肢）は変えない。
  - 図SVGの座標変更は、挿入前に必ずベジエの数式で検算し、合わなければ書き込まない。
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
# 修正1: hd_5r_k05_602_4 (HG-1618) intro + steps に[図2]の設問を追加
# ============================================================
ID_602 = "hd_5r_k05_602_4"
HG_602 = "HG-1618"

INTRO_602_BEFORE = (
    "金ぞくの 棒や板に **示温シール**（熱が 伝わると すぐに 色が 変わる シール）を"
    " はって、あたためたときの 熱の 伝わり方を しらべます。\n"
    "[図1]の 棒には、左はしから **5〜8cm に A**、**20〜23cm に B**、**35〜38cm に C** の"
    " シールが はって あります（どれも 幅3cm）。\n"
    "熱は 熱した所から **左右に 同じ速さで** 伝わります。"
)
INTRO_602_ADD = (
    "\n[図2]は 正方形の 金ぞくの板で、左下の **※** の位置を 熱します。"
    " 板には **D**（左上）・**E**（右上）・**F**（中央）・**G**（右下）に"
    " 示温シールが はって あります。熱は ※から 板の **全方向に 同じ速さで** 広がります。"
)
INTRO_602_AFTER = INTRO_602_BEFORE + INTRO_602_ADD

STEP_602_FIRST = {
    "question": "[図2]で ※を 熱したとき、シールの 色が **最初に** 変わるのは どれですか。",
    "answer": "F",
    "choices": ["F", "D", "E", "G"],
    "meaning": (
        "①※からの きょりが いちばん 近いのは、正方形の 中央に ある F です。"
        "②D・E・G は 板の すみに あるので、※から 遠く なります。"
    ),
}
STEP_602_LAST = {
    "question": "[図2]で ※を 熱したとき、シールの 色が **最後に** 変わるのは どれですか。",
    "answer": "E",
    "choices": ["E", "D", "F", "G"],
    "meaning": (
        "①※は 左下の すみ、E は 右上の すみで、板を ななめに 横切る きょりが"
        " いちばん 長く なります。②だから E が いちばん おそく 変わります。"
    ),
}


def fix1_602(x):
    """HG-1618: intro に[図2]の説明を足し、stepsの末尾に2問（最初/最後）を足す。"""
    intro = x.get("intro", "")
    steps = x.get("steps")
    assert isinstance(steps, list), "%s: steps がリストでない" % ID_602

    already_has_step = any(
        s.get("question") == STEP_602_FIRST["question"] for s in steps
    )

    if intro == INTRO_602_AFTER and already_has_step:
        # 既に両方適用済み
        assert len(steps) >= 6, "%s: 追加ずみのはずがsteps数が想定未満(%d)" % (ID_602, len(steps))
        return False

    assert intro == INTRO_602_BEFORE, (
        "%s: introが想定のbefore/afterどちらとも一致しない。"
        "誰かが別の修正をあてた可能性があるので内容を見てから手で直すこと。\nintro=%r" % (ID_602, intro)
    )
    assert len(steps) == 4, (
        "%s: steps が4問のはずが%d問だった（想定外の状態なので停止）" % (ID_602, len(steps))
    )
    assert not already_has_step, "%s: introは未修正なのにstepsだけ追加済み（矛盾状態）" % ID_602

    x["intro"] = INTRO_602_AFTER
    steps.append(dict(STEP_602_FIRST))
    steps.append(dict(STEP_602_LAST))
    return True


# ============================================================
# 修正2: hd_5r_f21_1 (HG-2030) svg の溶解度曲線を点エに合わせる
# ============================================================
ID_211 = "hd_5r_f21_1"
HG_211 = "HG-2030"

CURVE_BEFORE = "M44.0,129.0 Q135.7,119.0 166.3,91.0 T221.3,29.4"
CURVE_AFTER = "M44.0,129.0 Q135.7,119.0 166.3,91.0 Q200.0,47.8 221.3,29.4"


def _quad_point(p0, p1, p2, t):
    x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
    y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
    return x, y


def _verify_curve_fix():
    """新しい第2区間が、点エ(196.9,54)をt=0.5でちょうど通ることを検算する。
    合わなければ AssertionError で止める（＝1件も書き込まない）。
    """
    p0 = (166.3, 91.0)
    c1 = (200.0, 47.8)
    p2 = (221.3, 29.4)
    x, y = _quad_point(p0, c1, p2, 0.5)
    assert abs(x - 196.9) < 0.05 and abs(y - 54.0) < 0.05, (
        "HG-2030: 修正後の制御点が点エ(196.9,54)を通らない（計算結果 x=%.3f y=%.3f）" % (x, y)
    )
    # 単調性の確認（折り返し・交差が無いこと）
    xs = [_quad_point(p0, c1, p2, t / 4.0)[0] for t in range(5)]
    ys = [_quad_point(p0, c1, p2, t / 4.0)[1] for t in range(5)]
    assert all(xs[i] < xs[i + 1] for i in range(4)), "HG-2030: xが単調増加でない: %r" % xs
    assert all(ys[i] > ys[i + 1] for i in range(4)), "HG-2030: yが単調減少でない: %r" % ys


def fix2_211(x):
    svg = x.get("svg", "")
    if CURVE_AFTER in svg and CURVE_BEFORE not in svg:
        return False
    cnt = svg.count(CURVE_BEFORE)
    assert cnt == 1, (
        "%s: 溶解度曲線のpath dが %d 件見つかった（ちょうど1件のはず）" % (ID_211, cnt)
    )
    _verify_curve_fix()
    x["svg"] = svg.replace(CURVE_BEFORE, CURVE_AFTER, 1)
    return True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gc.BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    d = json.load(io.open(path, encoding="utf-8"))

    found = {}
    for rec in gc.iter_daimon(d):
        x = rec["x"]
        xid = x.get("id")
        if xid in (ID_602, ID_211):
            found.setdefault(xid, []).append(x)

    for xid in (ID_602, ID_211):
        hits = found.get(xid, [])
        assert len(hits) == 1, (
            "大問 %s が %d 件見つかった（ちょうど1件のはず）: %s" % (xid, len(hits), path)
        )

    x602 = found[ID_602][0]
    assert x602.get("hg") == HG_602 or x602.get("src") == HG_602, (
        "%s: hg/src が想定と違う: %r" % (ID_602, x602.get("hg") or x602.get("src"))
    )

    x211 = found[ID_211][0]
    assert x211.get("hg") == HG_211, (
        "%s: hg が想定と違う: %r" % (ID_211, x211.get("hg"))
    )

    changed = {}
    changed["1_zu2_602"] = fix1_602(x602)
    changed["2_curve_211"] = fix2_211(x211)

    out = json.dumps(d, ensure_ascii=False, indent=1)
    io.open(path, "wb").write(out.encode("utf-8"))

    print("path:", path)
    for k in sorted(changed):
        print("changed[%s]:" % k, changed[k])


if __name__ == "__main__":
    main()
