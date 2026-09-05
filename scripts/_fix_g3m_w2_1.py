# -*- coding: utf-8 -*-
"""小3マスター算数 kokai No.6〜No.1（週2・最終便＝小3マスター全129本のうち残り25本）の
塾講師監査（docs/_audit/g3m_w2/findings_1.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g3m_w2_1.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：すでに直った状態なら黙って飛ばす。
・25本を読んで指摘は中1件（原本アクセス不要で機械的に確定できた図の座標ミス）。
  もう1件（hd_3m_k06_639_4／HG-2669・(2)(3)未実装）は原簿自身が「要現物照合」と明記して
  おり原本PDFが無いと判断できないため、findings_1.md に見送りとして記録するのみで
  このスクリプトには含めていない。

直したもの（findings_1.md と対応）:
  中1  hd_3m_k09_618_4（HG-0991）
    3種類の正三角形ア・イ・ウを積んだ大三角形の図で、「アの頂点(x=87.2)とイの頂点の間が1cm」
    という核心発見を示す赤い点・破線・横線・ラベルが、実際にはイの頂点ではない座標(x=71.2)に
    置かれていた。

    境界線(y=101.4)は x=61.6〜138.4(全長76.8px)。SVGの他の要素（ア=4cm=25.6px、イ=3cm=19.2px、
    ウ=8cm=51.2px、大三角形の1辺=15cm=96px）から一貫してスケール=6.4px/cmが求まる。
    アの内部頂点はこの区間を3等分した x=87.2, 112.8。イの内部頂点は4等分した x=80.8, 100.0, 119.2。
    最初のア頂点(87.2)と最初のイ頂点(80.8)の差は 87.2-80.8=6.4px=1.0cm で、これが原簿の
    「ア-イ=1cm」と一致する正しい区間。x=71.2はこの境界線上のどの頂点でもない
    （y=118にある別の頂点の座標を誤って流用したとみられる）。

    赤い点・破線・横線のx座標を 71.2→80.8 に、「1cm」ラベルのx座標を 63.2→84.0
    （80.8と87.2の中点。text-anchor='middle'なので中央揃え）に直した。答え(3・8・45)や
    設問文・入力形式は変えていない。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


TARGET_ID = "hd_3m_k09_618_4"

# ★観点3の独立検算（findings_1.md の「何が問題か」節と同じ計算）。
#   直す前（誤り）と直した後（正しい）の断片を、文脈込みで一意に特定できる長さで持つ。
#   ・境界線上の実頂点でない x=71.2 を使っている3か所（円・破線・横線の起点）
#   ・「1cm」ラベルの位置
#   いずれも y座標（101.3728 / 115.3728 / 128.37279999999998）込みで一意なので、
#   ポリゴンの頂点データ（同じ 71.2 を y=118.0 で正しく使っている箇所）とは混同しない。
OLD_CIRCLE = ("<circle cx='71.2' cy='101.3728' r='2.2' fill='#ef476f' "
              "stroke='#ef476f' stroke-width='0.5'/>")
NEW_CIRCLE = ("<circle cx='80.8' cy='101.3728' r='2.2' fill='#ef476f' "
              "stroke='#ef476f' stroke-width='0.5'/>")

OLD_DASH = ("<line x1='71.2' y1='101.3728' x2='71.2' y2='117.3728' "
            "stroke='#ef476f' stroke-width='0.8' stroke-dasharray='2 2'/>")
NEW_DASH = ("<line x1='80.8' y1='101.3728' x2='80.8' y2='117.3728' "
            "stroke='#ef476f' stroke-width='0.8' stroke-dasharray='2 2'/>")

OLD_HLINE = ("<line x1='71.2' y1='115.3728' x2='87.19999999999999' y2='115.3728' "
             "stroke='#ef476f' stroke-width='1.8'/>")
NEW_HLINE = ("<line x1='80.8' y1='115.3728' x2='87.19999999999999' y2='115.3728' "
             "stroke='#ef476f' stroke-width='1.8'/>")

OLD_LABEL = ("<text x='63.19999999999999' y='128.37279999999998' fill='#ef476f' "
             "font-size='9' text-anchor='middle'>1cm</text>")
NEW_LABEL = ("<text x='84.0' y='128.37279999999998' fill='#ef476f' "
             "font-size='9' text-anchor='middle'>1cm</text>")

PIECES = [(OLD_CIRCLE, NEW_CIRCLE), (OLD_DASH, NEW_DASH),
          (OLD_HLINE, NEW_HLINE), (OLD_LABEL, NEW_LABEL)]


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

    assert x.get("src") == "HG-0991", "src が想定と違う: %r" % x.get("src")

    svg = x.get("svg") or ""
    assert svg, "svg が空（他セッションが書きかえた?）"

    n_old = sum(svg.count(old) for old, new in PIECES)
    n_new = sum(svg.count(new) for old, new in PIECES)

    changed = 0
    if n_old == len(PIECES) and n_new == 0:
        # 直す前：4か所とも誤った座標のまま。ちょうど1回ずつであることを確認して置きかえる。
        for old, new in PIECES:
            assert svg.count(old) == 1, "置きかえ対象が大問内でちょうど1回でない: %r" % old[:40]
            svg = svg.replace(old, new)
        x["svg"] = svg
        changed = 1
    elif n_old == 0 and n_new == len(PIECES):
        # 冪等：すでに直っている
        pass
    else:
        raise AssertionError(
            "svg の状態が想定外（旧=%d・新=%d、他の変更と衝突?）" % (n_old, n_new))

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, 1 - changed, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
