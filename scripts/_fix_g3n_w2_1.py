# -*- coding: utf-8 -*-
"""小3灘中合格特訓（第7・9・11回・fukushu No.7/9/11）の監査で見つかった不具合を直すパッチ。

対象: docs/_audit/g3n_w2/audit_1.txt の20本の監査で見つかった問題（findings_1.md参照）。
原本PDF（浜問題/灘中合格特訓）は今回アクセスできなかった（Google Drive未接続）ため、
原本でしか判断できない5本（hd3n_09_1/09_5/09_7/09_8/09_10＝原簿が「答え:未確定→要現物照合」
と明記している大問）は、内容ごと見送り＝このスクリプトでは触らない。

修正1: hd3n_07_8（HG-1958・ピーナッツの逆算）
  小問3「はじめにあったピーナッツは何こですか」の解説に、まだ聞いていない小問4の答え
  （ジロー36こ）を含む「たしかめ」の全行程が書かれていて、答えの先出しになっていた。
  たしかめの行を小問3から外し、最後の小問（小問4）の解説の末尾に移す。
  数値・答え・小問の本数は変えていない。

修正2: hd3n_07_10（HG-1960・リスのどんぐり）
  小問1の設問文が「最後のリスが9ばん目のとき」という、この問題いちばんの発見（リスは
  9ひき）を前提として先に渡してしまっていて、直後の小問2「リスは何ひきですか」の答えが
  読む前から見えていた。
  小問1と小問2の順序を入れ替え、新2問目（旧小問1）は「リスは9ひきいることがわかりました」
  という、直前の答えを踏まえた書き出しに変える。答え・解説・小問の本数は変えていない。

修正3: hd3n_11_3（HG-1993・1年を4等分する）
  小問3の設問文が「その日ですか。日のところを答えなさい。」という壊れた文になっていた
  （直前の小問2「第2期が始まるのは何月何日ですか。月のところを答えなさい。」と対になる
  はずの主語が欠けている）。対になる完全な文に書きかえる。答え・解説は変えていない。

修正4: hd3n_11_5（HG-1995・「第5◯曜」は1年に何日あるか）
  小問2・3の設問文が「1年に何日ありますか」とだけ書かれていて、字面どおりに読むと
  1年の日数（365/366）を聞いているように見え、答え（29/30＝「第5◯曜」の日数）と
  食いちがって見えた。「第5◯曜」の日を聞いていることを設問文に明記する。
  答え・解説は変えていない。

修正5: hd3n_09_1（HG-1971・立体の位置を3つの数で表す）
  図SVGの点ラベルがひらがな「あ・い・う・え」で描かれていて、問題文・各小問が使っている
  丸カタカナ「㋐・㋑・㋒・㋓」と字体が違い、図と設問文の対応が取れなかった（原点の「ア」
  だけは正しくカタカナ）。対応は㋐→あ／㋑→い／㋒→う／㋓→え で一意なので、SVG内の文字
  だけを置きかえる（座標・位置は無変更）。なお、この大問の座標・寸法そのものは原簿が
  「未確定→要現物照合」としている対象であり、それは今回のパッチに含めていない。

使い方:
  python scripts/_fix_g3n_w2_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

冪等: 欄がすでに新しい文言なら何もしない（旧文言が0件でもエラーにしない）。
"""
import json, io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon


def get_one(d, id_, src, grade="3", app_courses=("nadago",)):
    hits = []
    for r in iter_daimon(d, grade=grade, app_courses=list(app_courses)):
        x = r["x"]
        if x.get("id") == id_ and x.get("src") == src:
            hits.append(x)
    assert len(hits) == 1, "%s (%s): 大問が1本だけのはずが %d 件" % (id_, src, len(hits))
    return hits[0]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "hama_daimon.json")

    d = json.load(io.open(path, encoding="utf-8"))

    applied = 0
    already = 0

    # ---------- 修正1: hd3n_07_8（HG-1958） ----------
    x = get_one(d, "hd3n_07_8", "HG-1958")
    steps = x.get("steps", [])
    assert len(steps) == 4, "hd3n_07_8: 小問が4個のはずが %d 個" % len(steps)

    OLD_M3 = u"(42−3)×2＝78、(78−3)×2＝150こです。たしかめ 150→タロー72（残り78）→ジロー36（残り42）→サブロー18（残り24）→シロー9（残り15）✓ 合計も150 ✓"
    NEW_M3 = u"(42−3)×2＝78、(78−3)×2＝150こです。"
    OLD_M4 = u"ジローがとる前は78こなので 78÷2−3＝36こです。"
    NEW_M4 = u"ジローがとる前は78こなので 78÷2−3＝36こです。たしかめ 150→タロー72（残り78）→ジロー36（残り42）→サブロー18（残り24）→シロー9（残り15）✓ 合計も150 ✓"

    s3, s4 = steps[2], steps[3]
    if s3.get("meaning") == NEW_M3 and s4.get("meaning") == NEW_M4:
        already += 1
    else:
        assert s3.get("question") == u"はじめにあったピーナッツは何こですか。", \
            "hd3n_07_8: 小問3の設問文が想定と一致しない: %r" % s3.get("question")
        assert s3.get("meaning") == OLD_M3, \
            "hd3n_07_8: 小問3の解説が想定の旧文言と一致しない: %r" % s3.get("meaning")
        assert s4.get("question") == u"ジローがとったピーナッツは何こですか。", \
            "hd3n_07_8: 小問4の設問文が想定と一致しない: %r" % s4.get("question")
        assert s4.get("meaning") == OLD_M4, \
            "hd3n_07_8: 小問4の解説が想定の旧文言と一致しない: %r" % s4.get("meaning")
        s3["meaning"] = NEW_M3
        s4["meaning"] = NEW_M4
        applied += 1

    # ---------- 修正2: hd3n_07_10（HG-1960） ----------
    x = get_one(d, "hd3n_07_10", "HG-1960")
    steps = x.get("steps", [])
    assert len(steps) == 3, "hd3n_07_10: 小問が3個のはずが %d 個" % len(steps)

    OLD_Q0 = u"最後のリスがもらうとき、どんぐりは何こ残っていましたか。そのリスが何ばん目かを□として、□を使わずに答えると「□こ」です。では、最後のリスが9ばん目のとき、残っていたのは何こですか。"
    OLD_A0 = u"9"
    OLD_M0 = u"最後なので、そのあとは0こ。「□こと残りの10分の1」をとって0になるには、残りの10分の1が0、つまりそのとき残っていたのはちょうど□こです。9ばん目なら9こです。"
    OLD_Q1 = u"リスは何ひきですか。"
    OLD_A1 = u"9"
    OLD_M1 = u"全員が同じこ数（＝最後のリスと同じ□こ）もらうので、全体は □×□ こ。10分の1がいつも整数になるのは□＝9のときで、全体は81こです。"
    OLD_Q2 = u"1ぴきがもらったどんぐりは何こですか。"

    NEW_Q_LAST_RIS = u"リスは9ひきいることがわかりました。最後（9ばん目）のリスがもらう直前、どんぐりは何こ残っていましたか。「□こと残りの10分の1」を取って0こになるとき、残っていた数は□こ（＝そのリスの番号）と同じになることを使って求めなさい。"

    already_reordered = (
        len(steps) == 3
        and steps[0].get("question") == OLD_Q1
        and steps[1].get("question") == NEW_Q_LAST_RIS
        and steps[2].get("question") == OLD_Q2
    )
    if already_reordered:
        already += 1
    else:
        assert steps[0].get("question") == OLD_Q0, \
            "hd3n_07_10: 小問1の設問文が想定の旧文言と一致しない: %r" % steps[0].get("question")
        assert steps[0].get("answer") == OLD_A0 and steps[0].get("meaning") == OLD_M0, \
            "hd3n_07_10: 小問1の答え・解説が想定と一致しない"
        assert steps[1].get("question") == OLD_Q1, \
            "hd3n_07_10: 小問2の設問文が想定の旧文言と一致しない: %r" % steps[1].get("question")
        assert steps[1].get("answer") == OLD_A1 and steps[1].get("meaning") == OLD_M1, \
            "hd3n_07_10: 小問2の答え・解説が想定と一致しない"
        assert steps[2].get("question") == OLD_Q2, \
            "hd3n_07_10: 小問3の設問文が想定の旧文言と一致しない: %r" % steps[2].get("question")

        old_step0, old_step1, old_step2 = steps[0], steps[1], steps[2]
        new_step0 = old_step1  # 「リスは何ひきですか」を先頭へ
        new_step1 = old_step0
        new_step1["question"] = NEW_Q_LAST_RIS  # 答え・解説は変えない
        new_step2 = old_step2
        x["steps"] = [new_step0, new_step1, new_step2]
        applied += 1

    # ---------- 修正3: hd3n_11_3（HG-1993） ----------
    x = get_one(d, "hd3n_11_3", "HG-1993")
    steps = x.get("steps", [])
    assert len(steps) == 4, "hd3n_11_3: 小問が4個のはずが %d 個" % len(steps)

    OLD_Q3 = u"その日ですか。日のところを答えなさい。"
    NEW_Q3 = u"第2期が始まるのは何月何日ですか。日のところを答えなさい。"
    s3 = steps[2]
    if s3.get("question") == NEW_Q3:
        already += 1
    else:
        assert s3.get("question") == OLD_Q3, \
            "hd3n_11_3: 小問3の設問文が想定の旧文言と一致しない: %r" % s3.get("question")
        assert s3.get("answer") == u"2", \
            "hd3n_11_3: 小問3の答えが想定の2と一致しない: %r" % s3.get("answer")
        s3["question"] = NEW_Q3
        applied += 1

    # ---------- 修正4: hd3n_11_5（HG-1995） ----------
    x = get_one(d, "hd3n_11_5", "HG-1995")
    steps = x.get("steps", [])
    assert len(steps) == 3, "hd3n_11_5: 小問が3個のはずが %d 個" % len(steps)

    OLD_Q2 = u"2007年（平年）は1年に何日ありますか。"
    NEW_Q2 = u"2007年（平年）は1年に「第5◯曜」の日が何日ありますか。"
    OLD_Q3 = u"2008年（うるう年）は何日ありますか。"
    NEW_Q3 = u"2008年（うるう年）は「第5◯曜」の日が何日ありますか。"

    s2, s3 = steps[1], steps[2]
    if s2.get("question") == NEW_Q2 and s3.get("question") == NEW_Q3:
        already += 1
    else:
        assert s2.get("question") == OLD_Q2, \
            "hd3n_11_5: 小問2の設問文が想定の旧文言と一致しない: %r" % s2.get("question")
        assert s2.get("answer") == u"29", \
            "hd3n_11_5: 小問2の答えが想定の29と一致しない: %r" % s2.get("answer")
        assert s3.get("question") == OLD_Q3, \
            "hd3n_11_5: 小問3の設問文が想定の旧文言と一致しない: %r" % s3.get("question")
        assert s3.get("answer") == u"30", \
            "hd3n_11_5: 小問3の答えが想定の30と一致しない: %r" % s3.get("answer")
        s2["question"] = NEW_Q2
        s3["question"] = NEW_Q3
        applied += 1

    # ---------- 修正5: hd3n_09_1（HG-1971）── 図SVGの点ラベルの字体だけ直す ----------
    x = get_one(d, "hd3n_09_1", "HG-1971")
    svg = x.get("svg", "")
    LABEL_MAP = [
        (u">あ<", u">㋐<"),
        (u">い<", u">㋑<"),
        (u">う<", u">㋒<"),
        (u">え<", u">㋓<"),
    ]
    already_relabeled = all(svg.count(new) == 1 for _, new in LABEL_MAP)
    if already_relabeled:
        already += 1
    else:
        for old, new in LABEL_MAP:
            assert svg.count(old) == 1, \
                "hd3n_09_1: SVG内の %r がちょうど1個のはずが %d 個" % (old, svg.count(old))
        for old, new in LABEL_MAP:
            svg = svg.replace(old, new, 1)
        x["svg"] = svg
        applied += 1

    if applied:
        data = json.dumps(d, ensure_ascii=False, indent=1)
        with io.open(path, "wb") as f:
            f.write(data.encode("utf-8"))
        print("applied=%d already=%d -> wrote %s" % (applied, already, path))
    else:
        print("applied=0 already=%d -> no write (idempotent)" % already)


if __name__ == "__main__":
    main()
