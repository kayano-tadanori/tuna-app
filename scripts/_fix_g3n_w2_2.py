# -*- coding: utf-8 -*-
"""小3灘中合格特訓（fukushu No.11後半〜No.12・No.10・audit_2）の監査で見つかった不具合を直すパッチ。

対象: docs/_audit/g3n_w2/audit_2.txt の24本の監査で見つかった問題。
この波が終われば小3灘合108本は完走（原本PDFはGoogle Drive未接続のため今回はアクセスできず、
独立検算・座標実測・JSONと原簿の機械突き合わせで代替した）。

修正1: hd3n_11_9（HG-1999・週3回の放送・100回目はいつ）
  小問4の設問が「その日ですか。日のところを答えなさい。」という壊れた日本語になっていた
  （主語が欠落し、単独では意味が通らない）。小問3「100回目は何月何日ですか。月のところを
  答えなさい。」と対になる文言に書きかえる。答え（29）と解説は変えていない。

修正2: hd3n_12_7（HG-2007・○×テスト・3人の得点から正解を出す）
  小問4は「当たりの合計は何人になりますか」（答え11）だけを聞く設問なのに、解説が
  「1番は○で2人、2番は×で3人、3番（○○×）は○で2人、4番（×○○）は○で2人、
  5番（×○×）は×で2人」と、1番から5番までの正解の記号を1つずつ全部書き出していた。
  これをつなげると ○×○○× となり、次の小問5「正解を1番から5番までならべて書くと、
  どうなりますか」の答えをそのまま先出ししてしまっていた。
  解説から○×の記号を取りのぞき、人数の内訳（2＋3＋2＋2＋2＝11）だけが伝わる文言に
  書きかえる。答え（11）と合計の計算そのものは変えていない。

使い方:
  python scripts/_fix_g3n_w2_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]

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
    found = {"hd3n_11_9": False, "hd3n_12_7": False}

    # ---------- 修正1: hd3n_11_9（HG-1999） ----------
    OLD1_Q = "その日ですか。日のところを答えなさい。"
    NEW1_Q = "100回目は何月何日ですか。日のところを答えなさい。"

    for r in iter_daimon(d, grade="3", app_courses=["nadago"]):
        x = r["x"]
        if x.get("id") != "hd3n_11_9" or x.get("src") != "HG-1999":
            continue
        found["hd3n_11_9"] = True
        steps = x.get("steps", [])
        hits = [s for s in steps if s.get("question") in (OLD1_Q, NEW1_Q)]
        assert len(hits) == 1, "hd3n_11_9: 対象の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        if step.get("question") == NEW1_Q:
            already += 1
            continue
        assert step.get("question") == OLD1_Q, \
            "hd3n_11_9: 設問が想定の旧文言と一致しない: %r" % step.get("question")
        assert step.get("answer") == "29", \
            "hd3n_11_9: 答えが想定の29と一致しない: %r" % step.get("answer")
        step["question"] = NEW1_Q
        applied += 1

    assert found["hd3n_11_9"], "hd3n_11_9（HG-1999）が見つからない"

    # ---------- 修正2: hd3n_12_7（HG-2007） ----------
    OLD2_M = ("1番は○で2人、2番は×で3人、3番（○○×）は○で2人、4番（×○○）は○で2人、"
              "5番（×○×）は×で2人。2＋3＋2＋2＋2＝11人です。")
    NEW2_M = ("1番は多い方が2人、2番は多い方が3人、3番は多い方が2人、4番は多い方が2人、"
              "5番は多い方が2人です。2＋3＋2＋2＋2＝11人です。")

    for r in iter_daimon(d, grade="3", app_courses=["nadago"]):
        x = r["x"]
        if x.get("id") != "hd3n_12_7" or x.get("src") != "HG-2007":
            continue
        found["hd3n_12_7"] = True
        steps = x.get("steps", [])
        hits = [s for s in steps if s.get("meaning") in (OLD2_M, NEW2_M)]
        assert len(hits) == 1, "hd3n_12_7: 対象の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        if step.get("meaning") == NEW2_M:
            already += 1
            continue
        assert step.get("question") == "どの問題も「当たる人が多いほう」を正解にすると、当たりの合計は何人になりますか。", \
            "hd3n_12_7: 対象小問の設問文が想定と一致しない: %r" % step.get("question")
        assert step.get("meaning") == OLD2_M, \
            "hd3n_12_7: 解説が想定の旧文言と一致しない: %r" % step.get("meaning")
        assert step.get("answer") == "11", \
            "hd3n_12_7: 答えが想定の11と一致しない: %r" % step.get("answer")
        step["meaning"] = NEW2_M
        applied += 1

    assert found["hd3n_12_7"], "hd3n_12_7（HG-2007）が見つからない"

    if applied:
        data = json.dumps(d, ensure_ascii=False, indent=1)
        with io.open(path, "wb") as f:
            f.write(data.encode("utf-8"))
        print("applied=%d already=%d -> wrote %s" % (applied, already, path))
    else:
        print("applied=0 already=%d -> no write (idempotent)" % already)


if __name__ == "__main__":
    main()
