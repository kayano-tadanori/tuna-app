# -*- coding: utf-8 -*-
"""小5最レ 第3分冊 第2講座 No.28（hd5s_28k2_1〜12）・No.22（hd5s_22k2_1〜16）・
No.30（hd5s_30k2_1〜3）の塾講師監査（docs/_audit/s5sairei_w10/findings_1.md）
で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_s5sairei_w10_1.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：FIELD_PATCHES は欄まるごとの一致で判定。SVG_PATCHES は「直す前の文字列が
  もう無く、直したあとの文字列がある」かどうかで判定する（SVGは欄が巨大なので、
  変える部分だけを対象に、置換前にその大問のsvg欄の中でちょうど1回だけ出ることを
  assertしてから置換する）。
・31本を読んで、答えはすべて独立に検算済み（誤答・別解の実在は0件）。指摘は中3件・軽1件。

直したもの（findings_1.md と対応）:
  中  hd5s_28k2_2（HG-3891）P駅Q駅の電車とA君
      intro文「Q駅に16分停車したあと…」が、同じ画面の図（ダイヤグラム）と矛盾していた。
      図のpolyline座標を時刻に変換すると停車時間は8分（11:16〜11:24, 11:40〜11:48）で、
      16分ではない。intro文の「16分」を「8分」に訂正した（設問・答え・図は変更なし）。
  中  hd5s_30k2_1（HG-3918）正方形A・B・Cの組み合わせ（和差算）
      本文PDF（5年_小5最レ算数_第3分冊_第2講座.pdf p56）を実測すると「16cm」はC+Bの
      高さの合計を指しているが、アプリのSVGの寸法線はCの高さ(y=25〜130)しかカバー
      しておらずBの高さ(y=130〜176)を含んでいなかった。寸法線をy=176まで延長した
      （答え・設問文は変更なし）。
  中  hd5s_30k2_2（HG-3919）長方形とおうぎ形（斜線部分の面積）
      検算: 上辺6cm+下辺の残り(長方形の横12cm−6cm=6cmではなく、実際は上辺の
      A側□=6cm・D側6cmで12cm、下辺はB側△=9cm・C側3cmで12cm)。下辺で「3cm」が
      占める割合は3/12=25%のはずが、アプリのSVGでは上の「6cm」の寸法線(x=170〜235、
      幅65px=全幅の50%=6/12と一致)と全く同じ位置(x=170〜235)に「3cm」の寸法線が
      描かれていて、3cmが6cmと同じ長さに見えてしまっていた。本文PDF実測でも原本の
      「3cm」の弧は「6cm」よりはっきり短い。下辺の寸法線の左端をx=202.5
      (=235−3/12×130)へ動かした（答え・設問文は変更なし）。
  軽  hd5s_28k2_10（HG-3899）一周300m・向きを変えて歩く 小問2
      解説「5＝30−21＝9分より3＝5分24秒」の「5」「3」が、小問1の「⑤＝5分、③＝3分」
      （別の比）とは無関係な新しい比の単位として、定義なく再利用されていて読みにくかった
      （原本p46/解答p92がこの書き方で、genbo・アプリともそのまま転記していた）。
      独立に別ルート（P地点から右まわりに測った位置を数値で追う）で検算すると答え
      「26分24秒」は正しいので、数値・結論は変えず、解説だけをその検算ルートに
      書きかえた。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 欄まるごと置きかえ
# (大問id, 欄までの道すじ, 直す前の値（欄全体）, 直したあとの値（欄全体）)
FIELD_PATCHES = [
 # ==== hd5s_28k2_2（HG-3891）intro文の停車時間が図と矛盾 ====
 ('hd5s_28k2_2', ('intro',),
  'P駅とQ駅を往復する電車があります。電車はP駅を出て16分でQ駅に着き、Q駅に16分停車したあとP駅に向かって発車します（11時・16分・32分・48分のダイヤ）。A君は自転車に乗り、線路沿いの道を11時にP駅からQ駅に向かって出発し、途中電車と出会い、その後Q駅に11時48分に着きました。',
  'P駅とQ駅を往復する電車があります。電車はP駅を出て16分でQ駅に着き、Q駅に8分停車したあとP駅に向かって発車します（11時・16分・32分・48分のダイヤ）。A君は自転車に乗り、線路沿いの道を11時にP駅からQ駅に向かって出発し、途中電車と出会い、その後Q駅に11時48分に着きました。'),

 # ==== hd5s_28k2_10（HG-3899）小問2の解説が丸囲みなしの「5」「3」を再利用していて読みにくい ====
 ('hd5s_28k2_10', ('steps', 1, 'meaning'),
  '☆は15分後から3分進んで3分もどった時点で、☆＝15+3×2＝21分後。5＝30−21＝9分より3＝5分24秒。21分+5分24秒＝26分24秒。',
  '☆は15分後から3分進んで3分もどった時点で、☆＝15+3×2＝21分後。P地点から右まわりに測った位置で考えると、このときAは分速30m×21分＝630m進んでおり、一周300mなので実際の位置は630−300×2＝30m。ここから先はAは位置が増える向き、Bは位置が減る向きに進むので、2人の間の道のり300−30＝270mを毎分30+20＝50mの速さで縮めていく。270÷50＝5.4分＝5分24秒。21分+5分24秒＝26分24秒。'),
]


# ---------------------------------------------------------------- SVG欄の部分置きかえ
# (大問id, 欄までの道すじ, 直す前の部分文字列, 直したあとの部分文字列)
# その欄の中で必ずちょうど1回だけ出ることをassertしてから置換する。
SVG_PATCHES = [
 # ==== hd5s_30k2_1（HG-3918）「16cm」の寸法線がC単体の高さしかカバーしていない ====
 ('hd5s_30k2_1', ('svg',),
  '<line x1="128.0" y1="25.0" x2="128.0" y2="130.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="132.0" y1="25.0" x2="124.0" y2="25.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="132.0" y1="130.0" x2="124.0" y2="130.0" stroke="#9aa3c0" stroke-width="1.2"/><text x="109.3" y="81.5" font-size="12" text-anchor="middle" fill="#c9d4f0">16cm</text>',
  '<line x1="128.0" y1="25.0" x2="128.0" y2="176.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="132.0" y1="25.0" x2="124.0" y2="25.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="132.0" y1="176.0" x2="124.0" y2="176.0" stroke="#9aa3c0" stroke-width="1.2"/><text x="109.3" y="104.5" font-size="12" text-anchor="middle" fill="#c9d4f0">16cm</text>'),

 # ==== hd5s_30k2_2（HG-3919）「3cm」の寸法線が「6cm」と同じ幅(50%)で描かれている（正しくは25%） ====
 ('hd5s_30k2_2', ('svg',),
  '<line x1="170.0" y1="205.0" x2="235.0" y2="205.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="170.0" y1="201.0" x2="170.0" y2="209.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="235.0" y1="201.0" x2="235.0" y2="209.0" stroke="#9aa3c0" stroke-width="1.2"/><text x="202.5" y="221.8" font-size="12" text-anchor="middle" fill="#c9d4f0">3cm</text>',
  '<line x1="202.5" y1="205.0" x2="235.0" y2="205.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="202.5" y1="201.0" x2="202.5" y2="209.0" stroke="#9aa3c0" stroke-width="1.2"/><line x1="235.0" y1="201.0" x2="235.0" y2="209.0" stroke="#9aa3c0" stroke-width="1.2"/><text x="218.8" y="221.8" font-size="12" text-anchor="middle" fill="#c9d4f0">3cm</text>'),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[p] if isinstance(p, int) else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く
    want = set(p[0] for p in FIELD_PATCHES) | set(p[0] for p in SVG_PATCHES)
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in want:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = want - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))

    changed = skipped = 0

    for did, path, old, new in FIELD_PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)" % (did, "/".join(map(str, path)))
        node[key] = new
        changed += 1

    for did, path, old_sub, new_sub in SVG_PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if old_sub not in cur:
            assert new_sub in cur, "%s %s: neither old nor new text found (svg changed elsewhere?)" % (did, "/".join(map(str, path)))
            skipped += 1          # 冪等：すでに直っている
            continue
        occ = cur.count(old_sub)
        assert occ == 1, "%s %s: expected exactly 1 occurrence of old text, found %d" % (did, "/".join(map(str, path)), occ)
        node[key] = cur.replace(old_sub, new_sub, 1)
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
