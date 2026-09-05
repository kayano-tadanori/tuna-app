# -*- coding: utf-8 -*-
"""小3灘中合格特訓（第5〜7回・fukushu No.5〜7）の監査で見つかった不具合を直すパッチ。

対象: docs/_audit/g3n_w1/audit_2.txt の25本の監査で見つかった問題。

修正1: hd3n_06_7（HG-1950・二等辺の連鎖／27°は捨て情報）
  小問1の設問が「（あ）が51°だとすると、∠ACBは何度になりますか。」となっていて、
  小問3で聞かれる角（あ）の答え（51）を、小問1の"設問文そのもの"で先出ししていた。
  （＝解説ではなく設問の前提が答えを漏らしていたパターン）
  小問1の前提を「AC＝CDで、点CがBDのちょうど真ん中の点だとすると」という、
  数値の51を含まない幾何の仮定に書きかえる。∠BAC＝51°（EがAC上にあることから
  直接求まる、与えられた51°をそのまま使うだけの値）を経由して同じ78という
  答えに至る計算は変えていない。

修正2: hd3n_07_3（HG-1953・原こうを書く時間）
  小問3の設問が「10まい書くのに何分何秒かかりますか。分のところを答えなさい。」
  なのに、答えは166（＝時間になおす前の合計分数）。
  直前の小問2が「時間のところを答えなさい」で8時間20分の"8"だけを聞く
  分解形式だったため、同じ言い回しの小問3も「分のところ」＝60未満の分解された
  値（46）を答えると誤解しやすい。「時間になおさず、分の数をそのまま答える」
  ことが伝わる文言に書きかえる。答え（166）と解説は変えていない。

使い方:
  python scripts/_fix_g3n_w1_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]

冪等: 欄がすでに新しい文言なら何もしない（旧文言が0件でもエラーにしない）。
"""
import json, io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "hama_daimon.json")

    d = json.load(io.open(path, encoding="utf-8"))

    applied = 0
    already = 0
    found = {"hd3n_06_7": False, "hd3n_07_3": False}

    # ---------- 修正1: hd3n_06_7（HG-1950） ----------
    OLD1_Q = "（あ）が51°だとすると、∠ACBは何度になりますか。"
    NEW1_Q = "AC＝CD で、点CがBDのちょうど真ん中の点だとすると、∠ACBは何度になりますか。"
    OLD1_M = "点EはAC上にあるので ∠BAC＝∠BAE＝51°。三角形ABCの内角の和から 180−51−51＝78°です。"
    NEW1_M = "点EはAC上にあるので ∠BAC＝∠BAE＝51°。CがBDの真ん中なら BC＝CD＝AC となるので三角形ABCは二等辺三角形になり、∠ABC＝∠BAC＝51°。三角形ABCの内角の和から 180−51−51＝78°です。"

    for r in iter_daimon(d, grade="3", app_courses=["nadago"]):
        x = r["x"]
        if x.get("id") != "hd3n_06_7" or x.get("src") != "HG-1950":
            continue
        found["hd3n_06_7"] = True
        steps = x.get("steps", [])
        hits = [s for s in steps if s.get("question") in (OLD1_Q, NEW1_Q)]
        assert len(hits) == 1, "hd3n_06_7: 対象の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        if step.get("question") == NEW1_Q and step.get("meaning") == NEW1_M:
            already += 1
            continue
        assert step.get("question") == OLD1_Q, \
            "hd3n_06_7: 設問が想定の旧文言と一致しない: %r" % step.get("question")
        assert step.get("meaning") == OLD1_M, \
            "hd3n_06_7: 解説が想定の旧文言と一致しない: %r" % step.get("meaning")
        step["question"] = NEW1_Q
        step["meaning"] = NEW1_M
        applied += 1

    assert found["hd3n_06_7"], "hd3n_06_7（HG-1950）が見つからない"

    # ---------- 修正2: hd3n_07_3（HG-1953） ----------
    OLD2_Q = "10まい書くのに何分何秒かかりますか。分のところを答えなさい。"
    NEW2_Q = "10まい書くのにかかる時間は、何分何秒ですか。時間になおさず、分の数をそのまま答えなさい。"

    for r in iter_daimon(d, grade="3", app_courses=["nadago"]):
        x = r["x"]
        if x.get("id") != "hd3n_07_3" or x.get("src") != "HG-1953":
            continue
        found["hd3n_07_3"] = True
        steps = x.get("steps", [])
        hits = [s for s in steps if s.get("question") in (OLD2_Q, NEW2_Q)]
        assert len(hits) == 1, "hd3n_07_3: 対象の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        if step.get("question") == NEW2_Q:
            already += 1
            continue
        assert step.get("question") == OLD2_Q, \
            "hd3n_07_3: 設問が想定の旧文言と一致しない: %r" % step.get("question")
        assert step.get("answer") == "166", \
            "hd3n_07_3: 答えが想定の166と一致しない: %r" % step.get("answer")
        step["question"] = NEW2_Q
        applied += 1

    assert found["hd3n_07_3"], "hd3n_07_3（HG-1953）が見つからない"

    if applied:
        data = json.dumps(d, ensure_ascii=False, indent=1)
        with io.open(path, "wb") as f:
            f.write(data.encode("utf-8"))
        print("applied=%d already=%d -> wrote %s" % (applied, already, path))
    else:
        print("applied=0 already=%d -> no write (idempotent)" % already)


if __name__ == "__main__":
    main()
