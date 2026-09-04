# -*- coding: utf-8 -*-
"""小5最レ（算数）第2分冊 第1講座 No.16／No.17 の大問18本 塾講師監査 3班（audit_3.txt）の修正パッチ。

  使い方:  python scripts/_fix_s5sairei_w8_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★図SVGは、書きこむ前に座標から長さ・比・面積を計算して問題文と合うことを確かめる。
    1件でも合わなければ 1件も書かずに止める。

  直したもの（findings_3.md と対応）:
    中 hd5s_16k1_14 (HG-6905) 小問1の解説で「たて」と「よこ」が取りちがっている。
                    三角形ABPの底辺ABは長方形の【たて】いっぱいなのに「横いっぱい」、
                    高さBPは【よこ】の1/3なのに「たての1/3」と書かれていた（AQDの側も同様に逆）。
                    最終的な答え 7/12 の計算そのものは影響を受けない（1/3÷2, 1/2÷2 の数値は
                    どちらの辺をたて/よこと呼んでも同じ）が、図（AがD側の上、Bが左下）と
                    文章が正面から食いちがっており、子どもが図を見ながら読むと混乱する。
    中 hd5s_17k1_1  (HG-6921) 小問3・4の図で、点Aが辺EBの真ん中（EA=AB=3cm）から
                    ずれた位置（EA:AB=2:3相当）に描かれていた。原本PDF（5年 最レ算 第2分冊
                    第1講座.pdf p36・大問1(2)）を確認すると EA=AB=3cm で確定しており、
                    Aは正しくは E(150,20)-B(20,260) のちょうど中点 (85,140)。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 図の検算
def check_svg_geometry():
    """新しく入れる図SVGの座標が、問題文の数値と合うかを確かめる。合わなければ False。"""
    ng = []

    # --- hd5s_17k1_1 小問3/4（HG-6921）EB上の点AはEA=AB=3cmなのでEBの中点のはず ---
    E, B = (150.0, 20.0), (20.0, 260.0)
    A_new = (85.0, 140.0)
    A_mid = ((E[0] + B[0]) / 2.0, (E[1] + B[1]) / 2.0)
    if A_new != A_mid:
        ng.append("17k1_1: A_new %r != EBの中点 %r" % (A_new, A_mid))
    # BD上の点CはBC:CD=4:5なので、既存の(188.9,255.6)がB+4/9*(D-B)と一致するか確認（既に正しい）
    D = (400.0, 250.0)
    C_expect = (B[0] + 4.0 / 9.0 * (D[0] - B[0]), B[1] + 4.0 / 9.0 * (D[1] - B[1]))
    if abs(C_expect[0] - 188.9) > 0.2 or abs(C_expect[1] - 255.6) > 0.2:
        ng.append("17k1_1: C_expect %r != (188.9,255.6)" % (C_expect,))

    if ng:
        sys.stderr.write("\n".join(ng) + "\n")
        return False
    return True


# ---------------------------------------------------------------- 修正一覧
OLD_SVG_17K1_1 = (
    '<svg viewBox="0 -7 420 307" style="display:block;margin:0 auto;max-width:100%">\n'
    '  <polygon points="150,20 20,260 400,250" fill="none" stroke="#4f9eff" stroke-width="2"/>\n'
    '  <line x1="98" y1="116" x2="188.9" y2="255.6" stroke="#4f9eff" stroke-width="2"/>\n'
    '  <text x="150" y="12" fill="#e8ecf5" font-size="16" text-anchor="middle">E</text>\n'
    '  <text x="5" y="270" fill="#e8ecf5" font-size="16">B</text>\n'
    '  <text x="408" y="255" fill="#e8ecf5" font-size="16">D</text>\n'
    '  <text x="80" y="105" fill="#e8ecf5" font-size="16">A</text>\n'
    '  <text x="188" y="240" fill="#e8ecf5" font-size="16">C</text>\n'
    '  <text x="100" y="62" fill="#e8ecf5" font-size="14">3cm</text>\n'
    '  <text x="130" y="185" fill="#e8ecf5" font-size="14">3cm</text>\n'
    '  <text x="80" y="262" fill="#e8ecf5" font-size="14">4cm</text>\n'
    '  <text x="280" y="258" fill="#e8ecf5" font-size="14">5cm</text>\n'
    '</svg>'
)
NEW_SVG_17K1_1 = (
    '<svg viewBox="0 -7 420 307" style="display:block;margin:0 auto;max-width:100%">\n'
    '  <polygon points="150,20 20,260 400,250" fill="none" stroke="#4f9eff" stroke-width="2"/>\n'
    '  <line x1="85" y1="140" x2="188.9" y2="255.6" stroke="#4f9eff" stroke-width="2"/>\n'
    '  <text x="150" y="12" fill="#e8ecf5" font-size="16" text-anchor="middle">E</text>\n'
    '  <text x="5" y="270" fill="#e8ecf5" font-size="16">B</text>\n'
    '  <text x="408" y="255" fill="#e8ecf5" font-size="16">D</text>\n'
    '  <text x="67" y="129" fill="#e8ecf5" font-size="16">A</text>\n'
    '  <text x="188" y="240" fill="#e8ecf5" font-size="16">C</text>\n'
    '  <text x="100" y="62" fill="#e8ecf5" font-size="14">3cm</text>\n'
    '  <text x="130" y="185" fill="#e8ecf5" font-size="14">3cm</text>\n'
    '  <text x="80" y="262" fill="#e8ecf5" font-size="14">4cm</text>\n'
    '  <text x="280" y="258" fill="#e8ecf5" font-size="14">5cm</text>\n'
    '</svg>'
)

OLD_MEANING_16K1_14 = (
    '四角形APCQは、長方形から三角形ABPと三角形AQDを取りのぞいた残りだと考える。'
    '三角形ABPは底辺ABが長方形の横いっぱいで、高さBPはたての1/3（BP：PC＝1：2）だから、'
    '長方形の1/3÷2＝1/6。三角形AQDは底辺ADが長方形のたていっぱいで、'
    '高さQDは横の1/2（CQ：QD＝1：1）だから、長方形の1/2÷2＝1/4。'
    'だから1－1/6－1/4＝7/12倍。'
)
NEW_MEANING_16K1_14 = (
    '四角形APCQは、長方形から三角形ABPと三角形AQDを取りのぞいた残りだと考える。'
    '三角形ABPは底辺ABが長方形のたていっぱいで、高さBPはよこの1/3（BP：PC＝1：2）だから、'
    '長方形の1/3÷2＝1/6。三角形AQDは底辺ADが長方形のよこいっぱいで、'
    '高さQDはたての1/2（CQ：QD＝1：1）だから、長方形の1/2÷2＝1/4。'
    'だから1－1/6－1/4＝7/12倍。'
)

# (id, path, old, new)
PATCHES = [
    ('hd5s_16k1_14', ('steps', '0', 'meaning'), OLD_MEANING_16K1_14, NEW_MEANING_16K1_14),
    ('hd5s_17k1_1', ('steps', '2', 'svg'), OLD_SVG_17K1_1, NEW_SVG_17K1_1),
    ('hd5s_17k1_1', ('steps', '3', 'svg'), OLD_SVG_17K1_1, NEW_SVG_17K1_1),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[int(p)] if str(p).isdigit() else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    if not check_svg_geometry():
        sys.stderr.write("zu no zahyou ga mondaibun to awanai node, 1-ken mo kakazu ni yameru\n")
        return 2

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く
    want = set(p[0] for p in PATCHES)
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in want:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = want - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))

    changed = skipped = 0
    for did, path, old, new in PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)" % (did, "/".join(map(str, path)))
        # その大問の中で、この文字列がちょうど1回（steps[2]とsteps[3]で共有するsvgは
        # 大問全体としては2回出るのが正しい形なので、大問まるごとではなくその欄自体が
        # ちょうど1回一致することだけを確かめる＝dig()で取った参照そのものへの代入で担保する）
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
