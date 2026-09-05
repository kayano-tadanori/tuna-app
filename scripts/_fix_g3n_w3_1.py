# -*- coding: utf-8 -*-
"""小3灘中合格特訓（fukushu No.8・audit_1）の監査で見つかった不具合を直すパッチ。

対象: docs/_audit/g3n_w3/audit_1.txt の10本（hd3n_08_1〜hd3n_08_10）の監査で見つかった問題。
これで小3灘合108本の監査が完走（原本PDFはGoogle Drive未接続のためアクセスできず、
独立検算・座標実測・JSONと原簿の機械突き合わせで代替した）。

修正1: hd3n_08_1（HG-1961・直角二等辺三角形を2つ重ねる）
  SVG図の「ア」「イ」の線分の端点が、このアプリ大問自身が使っている数値
  （小さい三角形の辺9cm・大きい三角形の辺11cm・かどの位置：左はしから5cm／右はしから3cm）
  から計算される正しい交点とズレていた。
    小さい三角形の頂点(x=5,y=9)から大きい三角形の斜辺(y=x)までの高さ ＝ 9−5＝4cm
      → 正しい下端は y=5cm（SVG y=112）。図では y1="127.0"（y=4cm相当）＝1cm長すぎた。
    大きい三角形の頂点(x=11,y=11)から小さい三角形の斜辺(y=14−x)までの高さ ＝ 11−3＝8cm
      → 正しい下端は y=3cm（SVG y=142）。図では y1="67.0"（y=8cm相当）＝5cm短すぎた
      （答えの8cmに対し図では3cmしかなく、半分にも満たなかった）。
  line要素のy1座標を正しい交点に直し、「ア」「イ」のテキストラベルも新しい線分の中点
  付近に動かす。答え（ア=4, イ=8, イはアの2倍）や設問・解説の文言は変えていない。

修正2: hd3n_08_3（HG-1963・紙テープを折り曲げて六角形にする）
  小問5の解説に「長さ1cmあたり2こ分の面積になります…60÷2＝15cm」とあったが、
  60÷2は30であり15にならない（誤った式）。テープの幅（1辺2cmの正三角形の高さ）を
  1辺1cmの単位三角形で数えると1cmあたり4こ分になる（原簿の検算でも
  「テープの面積60こ分・長さ15cm」＝60÷15＝4こ分/cmと整合）。
  「2こ分」→「4こ分」、「60÷2＝15cm」→「60÷4＝15cm」に直す。答え（15cm）は変えていない。

使い方:
  python scripts/_fix_g3n_w3_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

冪等: 欄がすでに新しい文言・座標なら何もしない（旧文言が0件でもエラーにしない）。
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
    found = {"hd3n_08_1": False, "hd3n_08_3": False}

    # ---------- 修正1: hd3n_08_1（HG-1961） ----------
    OLD1_LINE_A = '<line x1="90.0" y1="127.0" x2="90.0" y2="52.0" stroke="#ff6b6b" stroke-width="3.4"/>'
    NEW1_LINE_A = '<line x1="90.0" y1="112.0" x2="90.0" y2="52.0" stroke="#ff6b6b" stroke-width="3.4"/>'
    OLD1_TEXT_A = '<text x="75.0" y="94.5" font-size="14" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b" font-weight="bold">ア</text>'
    NEW1_TEXT_A = '<text x="75.0" y="82.0" font-size="14" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b" font-weight="bold">ア</text>'
    OLD1_LINE_I = '<line x1="180.0" y1="67.0" x2="180.0" y2="22.0" stroke="#ff6b6b" stroke-width="3.4"/>'
    NEW1_LINE_I = '<line x1="180.0" y1="142.0" x2="180.0" y2="22.0" stroke="#ff6b6b" stroke-width="3.4"/>'
    OLD1_TEXT_I = '<text x="165.0" y="49.5" font-size="14" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b" font-weight="bold">イ</text>'
    NEW1_TEXT_I = '<text x="165.0" y="87.0" font-size="14" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b" font-weight="bold">イ</text>'

    for r in iter_daimon(d, grade="3", app_courses=["nadago"]):
        x = r["x"]
        if x.get("id") != "hd3n_08_1" or x.get("src") != "HG-1961":
            continue
        found["hd3n_08_1"] = True
        svg = x.get("svg", "")

        has_new = (NEW1_LINE_A in svg) and (NEW1_LINE_I in svg)
        has_old = (OLD1_LINE_A in svg) and (OLD1_LINE_I in svg)

        if has_new and not has_old:
            already += 1
            continue

        assert has_old, "hd3n_08_1: 旧SVG線分が見つからない（想定外の内容）"
        for old, tag in ((OLD1_LINE_A, "line-A"), (OLD1_TEXT_A, "text-A"),
                         (OLD1_LINE_I, "line-I"), (OLD1_TEXT_I, "text-I")):
            n = svg.count(old)
            assert n == 1, "hd3n_08_1: %s がちょうど1回のはずが %d 回" % (tag, n)

        svg = svg.replace(OLD1_LINE_A, NEW1_LINE_A, 1)
        svg = svg.replace(OLD1_TEXT_A, NEW1_TEXT_A, 1)
        svg = svg.replace(OLD1_LINE_I, NEW1_LINE_I, 1)
        svg = svg.replace(OLD1_TEXT_I, NEW1_TEXT_I, 1)
        x["svg"] = svg
        applied += 1

    assert found["hd3n_08_1"], "hd3n_08_1（HG-1961）が見つからない"

    # ---------- 修正2: hd3n_08_3（HG-1963） ----------
    OLD2_FRAG_1 = "長さ1cmあたり2こ分の面積になります。"
    NEW2_FRAG_1 = "長さ1cmあたり4こ分の面積になります。"
    OLD2_FRAG_2 = "テープ全体は 48＋12＝60こ分。60÷2＝**15cm**です。"
    NEW2_FRAG_2 = "テープ全体は 48＋12＝60こ分。60÷4＝**15cm**です。"

    for r in iter_daimon(d, grade="3", app_courses=["nadago"]):
        x = r["x"]
        if x.get("id") != "hd3n_08_3" or x.get("src") != "HG-1963":
            continue
        found["hd3n_08_3"] = True
        steps = x.get("steps", [])
        hits = [s for s in steps if s.get("question") == "紙テープの長さは何cmですか。"]
        assert len(hits) == 1, "hd3n_08_3: 対象の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        assert step.get("answer") == "15",             "hd3n_08_3: 答えが想定の15と一致しない: %r" % step.get("answer")
        meaning = step.get("meaning", "")

        has_new = (NEW2_FRAG_1 in meaning) and (NEW2_FRAG_2 in meaning)
        has_old = (OLD2_FRAG_1 in meaning) and (OLD2_FRAG_2 in meaning)

        if has_new and not has_old:
            already += 1
            continue

        assert has_old, "hd3n_08_3: 旧解説の文言が見つからない（想定外の内容）: %r" % meaning
        assert meaning.count(OLD2_FRAG_1) == 1, "hd3n_08_3: FRAG_1がちょうど1回のはずが違う"
        assert meaning.count(OLD2_FRAG_2) == 1, "hd3n_08_3: FRAG_2がちょうど1回のはずが違う"

        meaning = meaning.replace(OLD2_FRAG_1, NEW2_FRAG_1, 1)
        meaning = meaning.replace(OLD2_FRAG_2, NEW2_FRAG_2, 1)
        step["meaning"] = meaning
        applied += 1

    assert found["hd3n_08_3"], "hd3n_08_3（HG-1963）が見つからない"

    if applied:
        data = json.dumps(d, ensure_ascii=False, indent=1)
        with io.open(path, "wb") as f:
            f.write(data.encode("utf-8"))
        print("applied=%d already=%d -> wrote %s" % (applied, already, path))
    else:
        print("applied=0 already=%d -> no write (idempotent)" % already)


if __name__ == "__main__":
    main()
