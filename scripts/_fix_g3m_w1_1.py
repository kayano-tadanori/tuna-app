# -*- coding: utf-8 -*-
"""小3マスター算数（復習テスト fukushu No.1〜34・HG-0003〜HG-0111・49本）の
塾講師監査（docs/_audit/g3m_w1/findings_1.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g3m_w1_1.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：すでに直った状態なら黙って飛ばす。
・49本を読んで指摘は2件（重大1・中1）。重大1件（hd3m_05_1／HG-0014）は原本（浜問題フォルダ）
  にアクセスできず、答えの先出しの根本原因（予想表そのものが原簿抜粋にも無い）を解消できない
  ため、このスクリプトには含めていない（findings_1.md参照・見送り）。

直したもの（findings_1.md と対応）:
  中1  hd_3m_f19_3（HG-0061）
    原簿の設問は①長方形9個 ②平行四辺形（長方形のぞく）4個 の2問だが、②が丸ごと未実装。
    しかも実装ずみの①は「対角線は使いません」の注記どおり対角線を一度も使わずに解けるため、
    この大問の核心（対角線が『横辺×斜辺』『縦辺×斜辺』の2タイプの平行四辺形を作る）が
    実装から完全に抜け落ちていた。
    図SVGの実座標（各マス60×34、対角線はどのマスも左上→右下）を使って独立に幾何検算し、
    非長方形の平行四辺形がちょうど4個であることを確認したうえで、小問2として追加した。
    入力形式（テンキー数値）は変えていない。新規SVGの追加は無い（既存の図をそのまま使う）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


TARGET_ID = "hd_3m_f19_3"

# ★観点3の独立検算（findings_1.md の「独立検算」節と同じ計算）。
#   実座標: マス1個=60(横)×34(縦)。対角線はどのマスも「そのマスの左上→右下」向き。
#   左上マス(30,40)-(90,74)と右下マス(90,74)-(150,108)は端点(90,74)を共有し傾きも等しい
#   （34/60）ので1本の対角線につながる（大対角線）。右上マスと左下マスの対角線は傾きは
#   同じだが別の直線上にあり、互いにはつながらない。
#   この3本（大対角線1本＋独立2本）と たて・よこの格子線を組み合わせると、
#   「横辺2本+対角線2本」タイプが2個、「縦辺2本+対角線2本」タイプが2個の
#   非長方形の平行四辺形＝合計4個ができる（原簿の答え4個と一致）。
NEW_STEP = {
    "question": "この中に、長方形ではない 平行四辺形は 何こありますか。（対角線も辺として使います）",
    "answer": "4",
    "meaning": "対角線を辺として使うと、よこの辺2本＋対角線2本でできる平行四辺形が2しゅるい、"
               "たての辺2本＋対角線2本でできる平行四辺形が2しゅるいできる。"
               "となり合うマスの対角線どうしをつなげると、辺の長さと向きがそろって平行四辺形になる。"
               "あわせて4こ。①の長方形とちがい、こんどは対角線をちゃんと使うのがポイント。",
}


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く（ちょうど1回であることを確認）
    found = []
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") == TARGET_ID:
            found.append(x)
    assert len(found) == 1, "daimon id が0本か複数本: %s (%d件)" % (TARGET_ID, len(found))
    x = found[0]

    assert x.get("src") == "HG-0061", "src が想定と違う: %r" % x.get("src")

    steps = x.get("steps")
    assert isinstance(steps, list) and len(steps) >= 1, "steps の形が想定と違う"

    changed = 0
    if len(steps) == 1:
        # 直す前：小問1（長方形9個）だけがある状態。old値を確認してから小問2を追加する。
        s0 = steps[0]
        assert s0.get("answer") == "9", "小問1の答えが想定と違う（他セッションが書きかえた?）: %r" % s0.get("answer")
        assert "長方形" in s0.get("question", ""), "小問1の設問文が想定と違う"
        steps.append(NEW_STEP)
        changed = 1
    elif len(steps) == 2:
        # 冪等：すでに小問2が入っている場合、内容が一致するか確認して黙って飛ばす
        s1 = steps[1]
        assert s1.get("answer") == NEW_STEP["answer"] and s1.get("question") == NEW_STEP["question"], \
            "steps[1] が既にあるが内容が一致しない（別の変更と衝突?）"
    else:
        raise AssertionError("steps の本数が想定外（1でも2でもない）: %d" % len(steps))

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, 1 - changed, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
