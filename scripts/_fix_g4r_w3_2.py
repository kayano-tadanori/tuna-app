# -*- coding: utf-8 -*-
"""
小4理科（公開テスト）大問監査 kokai No.11〜No.12 の修正パッチ（audit_2 分）。

対象: docs/_audit/g4r_w3/findings_2.md に書いた重大1件。

■ hd_4r_k11_632_4 (HG-1674・ゴムひもA/B・のびの消去算)
  小問3「A・Bに同じ重さのおもりをつるすと長さが同じになる。おもりは何gか」の
  解説(meaning)が、答えを出す途中で「A＝56cm、B＝40cm」という自然長を計算して
  しまっている。ところが直後の小問4は「おもりをつるす前のゴムひもAの長さは
  何cmですか（答え=56）」で、小問3の解説を読んだ時点で小問4の答え(56)が
  すでに見えてしまっている＝分割問題の定番バグ（未回答の小問の値を解説が先出し）。

  原簿(HG-1674)の設問順は (1)(2)(3)(4)(5) で、(3)を解くには(4)で問われる
  自然長(56cm・40cm)を先に計算する必要がある。紙の試験ではこれは問題にならない
  （採点者に解説を見せるわけではない）が、このアプリは小問ごとに解説を表示する
  ため、順番をそのまま踏襲すると必ず先出しになる。

  修正：steps配列の中の「A・Bの自然長を問う小問」と「同じ長さになる重さ(64g)を
  問う小問」の順序を入れ替える（＝steps[2]とsteps[3]を交換）。中身（question /
  answer / meaning / 選択肢の有無）は一切変更しない。これで
    ・A=56cm を先に問い、答え合わせしてから
    ・その56cmを使って64gを求める解説を見せる
  という順序になり、先出しが解消する。B=40cmを独立に問う小問は原簿にもとづく
  追加が必要になり入力形式の検討を要するため、本スクリプトの対象外
  （findings_2.md に軽微事項として記録）。

■ 使い方
  python scripts/_fix_g4r_w3_2.py [対象JSONのパス]
  省略時は data/hama_daimon.json （このファイルから見た相対パス基準）。

■ 設計方針
  - 大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  - 書き換え対象のsteps[2]/steps[3]の中身は、既知の完全一致文字列でassertしてから
    交換する。before状態・after状態のどちらでもない中身が来たら例外で止める
    （冪等性と「知らないうちに中身が変わっていた」の検知を兼ねる）。
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

TARGET_ID = "hd_4r_k11_632_4"
TARGET_HG = "HG-1674"

# --- 交換前（原簿の設問順そのまま）の完全一致文字列 ---
Q_W_BEFORE_IDX2 = (
    "A と B に **同じ重さ** の おもりを つるすと、2本の 長さが 同じに "
    "なりました。このとき つるした おもりは 何g ですか。"
)
A_BEFORE_IDX2 = "64"
M_BEFORE_IDX2 = (
    "つるす前の 長さは A＝58−2＝**56cm**、B＝44−4＝**40cm**"
    "（表の 8g から 1回分 もどす）。\n"
    "差の 16cm を うめる。A は 1gで0.25cm、B は 1gで0.5cm のびるので、"
    "1gごとに 差が 0.25cm ちぢまる。16÷0.25＝**64g**。（どちらも 72cm）"
)

Q_W_BEFORE_IDX3 = "おもりを つるす前の ゴムひもA の 長さは 何cm ですか。"
A_BEFORE_IDX3 = "56"
M_BEFORE_IDX3 = "8gで58cm。8g ぶんの のび2cm を 引いて **56cm**。"


def step_matches(step, q, a, m):
    return (
        step.get("question") == q
        and step.get("answer") == a
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
    assert isinstance(steps, list) and len(steps) == 6, (
        "steps の形が想定と違う（6問のはず）: %r" % (steps,)
    )

    before_2 = step_matches(steps[2], Q_W_BEFORE_IDX2, A_BEFORE_IDX2, M_BEFORE_IDX2)
    before_3 = step_matches(steps[3], Q_W_BEFORE_IDX3, A_BEFORE_IDX3, M_BEFORE_IDX3)
    after_2 = step_matches(steps[2], Q_W_BEFORE_IDX3, A_BEFORE_IDX3, M_BEFORE_IDX3)
    after_3 = step_matches(steps[3], Q_W_BEFORE_IDX2, A_BEFORE_IDX2, M_BEFORE_IDX2)

    if before_2 and before_3:
        # ちょうど1回だけ入れ替える
        steps[2], steps[3] = steps[3], steps[2]
        changed = True
    elif after_2 and after_3:
        # すでに直したあと（冪等）
        changed = False
    else:
        raise AssertionError(
            "steps[2]/steps[3] の中身が既知のbefore/after状態のどちらとも一致しない。"
            "誰かが別の修正をあてた可能性があるので、内容を見てから手で直すこと。\n"
            "steps[2]=%r\nsteps[3]=%r" % (steps[2], steps[3])
        )

    out = json.dumps(d, ensure_ascii=False, indent=1)
    io.open(path, "wb").write(out.encode("utf-8"))

    print("path:", path)
    print("target:", TARGET_ID, TARGET_HG)
    print("changed:", changed)


if __name__ == "__main__":
    main()
