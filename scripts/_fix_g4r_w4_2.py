# -*- coding: utf-8 -*-
"""
小4理科（公開テスト）大問監査 kokai No.7〜No.9 の修正パッチ（audit_2 分）。

対象: docs/_audit/g4r_w4/findings_2.md の【重大1】。

■ hd_4r_k07_580_4 (HG-2817・虫めがね・A〜Cの明るい円)
  原簿(1)は「虫めがねの使い方としてまちがっているものをすべてえらびなさい」
  （ア=太陽を直接見る／イ=目に近づけたまま動かさず、見たいものを動かして
  ピントを合わせる／ウ=しょう点の日光を手に当てる。答え=ア・ウ、イは正しい
  使い方）。

  アプリの小問1・2はア・ウを個別のYes/No問題として正しく実装しているが、
  小問3は原簿のイの文言ではなく、原簿に存在しない別の文
  （「小さい紙を虫めがねから遠ざけたり近づけたりして…しょう点をさがした」）
  に差し替わっていた＝原簿の設問の一部（イ）が未実装のまま、出典不明の文が
  挿入されている。

  修正：steps[2]を原簿(1)イの文言にもとづく設問に差し替える
  （question/answer/choices/meaning をすべて置き換え）。他のstepsは触らない。

■ 使い方
  python scripts/_fix_g4r_w4_2.py [対象JSONのパス]
  省略時は data/hama_daimon.json （このファイルから見た相対パス基準）。

■ 設計方針
  - 大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  - 置換前のsteps[2]の中身を既知の完全一致文字列でassertしてから置き換える。
    before状態でもafter状態でもない中身が来たら例外で止める
    （冪等性と「知らないうちに中身が変わっていた」の検知を兼ねる）。
  - 大問まるごとの削除・移動はしない。入力形式（テンキー/選択肢）は変えない
    （choicesが2択のYes/No形式のまま）。
  - 書き出しは io.open(path, "wb") + json.dumps(..., ensure_ascii=False, indent=1)。
"""
import io
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common as gc  # noqa: E402

TARGET_ID = "hd_4r_k07_580_4"
TARGET_HG = "HG-2817"

# --- 差し替え前（現状・原簿に無い創作文）の完全一致 ---
Q_BEFORE = (
    "小さい紙を虫めがねから遠ざけたり近づけたりして、紙の上にいちばん小さく"
    "はっきりした明るい点ができる位置（しょう点）をさがした。これは正しい"
    "使い方ですか。"
)
A_BEFORE = "正しい"
CH_BEFORE = ["正しい", "まちがっている"]
M_BEFORE = (
    "しょう点をさがすこと自体は、虫めがねのしくみを調べる正しい使い方です"
    "（ただし、紙が焦げたり燃えたりしないよう注意が必要です）。"
)

# --- 差し替え後（原簿(1)イの文言にもとづく） ---
Q_AFTER = (
    "一方の手で虫めがねを持ち、虫めがねを目に近づけました。それから、"
    "虫めがねを動かさずに、もう一方の手で持った物を動かして、はっきり"
    "見えるところをさがしました。これは正しい使い方ですか。"
)
A_AFTER = "正しい"
CH_AFTER = ["正しい", "まちがっている"]
M_AFTER = (
    "虫めがねを目に近づけたまま動かさず、見たいものを動かしてはっきり"
    "見える位置をさがすのが、虫めがねの正しい使い方です。"
)


def step_matches(step, q, a, ch, m):
    return (
        step.get("question") == q
        and step.get("answer") == a
        and step.get("choices") == ch
        and step.get("meaning") == m
    )


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gc.BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    d = json.load(io.open(path, encoding="utf-8"))

    hits = [rec for rec in gc.iter_daimon(d) if rec["x"].get("id") == TARGET_ID]
    assert len(hits) == 1, (
        "大問 %s が %d 件見つかった（ちょうど1件のはず）: %s"
        % (TARGET_ID, len(hits), path)
    )
    rec = hits[0]
    x = rec["x"]
    assert x.get("hg") == TARGET_HG or x.get("src") == TARGET_HG, (
        "hg/src が想定と違う: %r" % (x.get("hg") or x.get("src"))
    )

    steps = x.get("steps")
    assert isinstance(steps, list) and len(steps) == 7, (
        "steps の形が想定と違う（7問のはず）: %r" % (steps,)
    )

    before = step_matches(steps[2], Q_BEFORE, A_BEFORE, CH_BEFORE, M_BEFORE)
    after = step_matches(steps[2], Q_AFTER, A_AFTER, CH_AFTER, M_AFTER)

    if before:
        steps[2]["question"] = Q_AFTER
        steps[2]["answer"] = A_AFTER
        steps[2]["choices"] = CH_AFTER
        steps[2]["meaning"] = M_AFTER
        changed = True
    elif after:
        # すでに直したあと（冪等）
        changed = False
    else:
        raise AssertionError(
            "steps[2] の中身が既知のbefore/after状態のどちらとも一致しない。"
            "誰かが別の修正をあてた可能性があるので、内容を見てから手で直すこと。\n"
            "steps[2]=%r" % (steps[2],)
        )

    out = json.dumps(d, ensure_ascii=False, indent=1)
    io.open(path, "wb").write(out.encode("utf-8"))

    print("path:", path)
    print("target:", TARGET_ID, TARGET_HG)
    print("changed:", changed)


if __name__ == "__main__":
    main()
