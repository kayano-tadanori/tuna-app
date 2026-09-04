# -*- coding: utf-8 -*-
"""小5最レ 第2分冊 第1講座 No.17（hd5s_17k1_15〜16）〜 第3分冊 第2講座 No.24（hd5s_24k2_1〜3）の
塾講師監査（docs/_audit/s5sairei_w9/findings_1.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_s5sairei_w9_1.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
・53本を読んだが、指摘は1本だけ（重大1件）。図SVGの追加・変更は無い。

直したもの（findings_1.md と対応。観点3＝答えの先渡し／観点5＝なぜの説明）:
  重大1  hd5s_17k1_16（HG-6965）
    小問1/2/3（三角形PAB:PBC:PCA）・小問4/5（AE:EC）・小問6/7（AP:PF）の3組が
    それぞれ同文の解説で、まだ答えていない小問の答えを先に見せていた
    （最終比10:18:15、5:9、25:18を毎回まるごと書いていた）。
    各小問の解説を「その時点までに答えた値だけを使って、いま聞かれている1つの数だけを出す」
    形に書きなおした（先に答えた値の再利用はOK＝観点5の「なぜ」も保つ）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 置きかえ表
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
 # ---- hd5s_17k1_16（HG-6965）小問1/2/3が同文で三角形PAB:PBC:PCA＝10:18:15を毎回まるごと見せていた ----
 ('hd5s_17k1_16',
  ('steps', '0', 'meaning'),
  '直線CDはABをAD：DB＝5：6に分けるので、三角形CADと三角形CDBの面積の比も、三角形PADと三角形PDBの面積の比も5：6。その差である三角形PCAと三角形PCBも5：6になります。同じように直線AFはBCをBF：FC＝2：3に分けるので、三角形PABと三角形PCAは2：3。三角形PCAを15とそろえると三角形PAB＝10、三角形PBC＝18となり、10：18：15です。',
  '直線CDはABをAD：DB＝5：6に分けるので、三角形CADと三角形CDBの面積の比も、三角形PADと三角形PDBの面積の比も5：6。その差である三角形PCAと三角形PCBも5：6になります。同じように直線AFはBCをBF：FC＝2：3に分けるので、三角形PABと三角形PCAは2：3になります。この2つの比を1つにそろえて計算すると、三角形PABの比の値は10になります（三角形PBC・PCAの値は次の問題で求めます）。'),
 ('hd5s_17k1_16',
  ('steps', '1', 'meaning'),
  '直線CDはABをAD：DB＝5：6に分けるので、三角形CADと三角形CDBの面積の比も、三角形PADと三角形PDBの面積の比も5：6。その差である三角形PCAと三角形PCBも5：6になります。同じように直線AFはBCをBF：FC＝2：3に分けるので、三角形PABと三角形PCAは2：3。三角形PCAを15とそろえると三角形PAB＝10、三角形PBC＝18となり、10：18：15です。',
  '三角形PABと三角形PCAの比は2：3、三角形PCAと三角形PCBの比は5：6です。この2つをつなげると、三角形PABと三角形PCBの比は(2×5)：(3×6)＝10：18になります。前の問題で三角形PABは10だったので、三角形PBCは18です。'),
 ('hd5s_17k1_16',
  ('steps', '2', 'meaning'),
  '直線CDはABをAD：DB＝5：6に分けるので、三角形CADと三角形CDBの面積の比も、三角形PADと三角形PDBの面積の比も5：6。その差である三角形PCAと三角形PCBも5：6になります。同じように直線AFはBCをBF：FC＝2：3に分けるので、三角形PABと三角形PCAは2：3。三角形PCAを15とそろえると三角形PAB＝10、三角形PBC＝18となり、10：18：15です。',
  '三角形PABと三角形PCAの面積の比は2：3です。前の問題で三角形PABは10だったので、三角形PCAは10×3/2＝15になります。'),

 # ---- 同・小問4/5が同文でAE:EC＝5:9を毎回まるごと見せていた ----
 ('hd5s_17k1_16',
  ('steps', '3', 'meaning'),
  'BをとおってPを通る線がACと交わる点がEなので、AE：ECは、Bを頂点にした三角形ABEと三角形CBEの面積の比であり、Pを頂点にした三角形APEと三角形CPEの面積の比でもあります。その差をとると、AE：EC＝三角形ABP：三角形CBPになります。前の問いで求めた面積の比を使うと10：18＝5：9です。',
  'BをとおってPを通る線がACと交わる点がEなので、AE：ECは、Bを頂点にした三角形ABEと三角形CBEの面積の比であり、Pを頂点にした三角形APEと三角形CPEの面積の比でもあります。その差をとると、AE：EC＝三角形PAB：三角形PBCになります。前の問題で求めた10：18は、どちらも2で割り切れるので、10÷2＝5が1つめの数です。'),
 ('hd5s_17k1_16',
  ('steps', '4', 'meaning'),
  'BをとおってPを通る線がACと交わる点がEなので、AE：ECは、Bを頂点にした三角形ABEと三角形CBEの面積の比であり、Pを頂点にした三角形APEと三角形CPEの面積の比でもあります。その差をとると、AE：EC＝三角形ABP：三角形CBPになります。前の問いで求めた面積の比を使うと10：18＝5：9です。',
  'AE：ECは、三角形PAB：三角形PBC＝10：18と同じ比です。10：18をできるだけ簡単な比にするため、どちらも2で割ります。18÷2＝9が2つめの数です。'),

 # ---- 同・小問6/7が同文でAP:PF＝25:18を毎回まるごと見せていた ----
 ('hd5s_17k1_16',
  ('steps', '5', 'meaning'),
  'AP：PFは、Bを頂点にした三角形ABPと三角形PBFの面積の比であり、Cを頂点にした三角形APCと三角形PFCの面積の比でもあります。だからAP：PF＝（三角形PAB＋三角形PCA）：（三角形PBF＋三角形PFC）＝（三角形PAB＋三角形PCA）：三角形PBC。前の問いで求めた面積の比10：18：15を使うと、（10＋15）：18＝25：18です。',
  'AP：PFは、Bを頂点にした三角形ABPと三角形PBFの面積の比であり、Cを頂点にした三角形APCと三角形PFCの面積の比でもあります。だからAP：PF＝（三角形PAB＋三角形PCA）：（三角形PBF＋三角形PFC）＝（三角形PAB＋三角形PCA）：三角形PBC。三角形PABは10、三角形PCAは15なので、10＋15＝25。これがAP：PFの1つめの数です。'),
 ('hd5s_17k1_16',
  ('steps', '6', 'meaning'),
  'AP：PFは、Bを頂点にした三角形ABPと三角形PBFの面積の比であり、Cを頂点にした三角形APCと三角形PFCの面積の比でもあります。だからAP：PF＝（三角形PAB＋三角形PCA）：（三角形PBF＋三角形PFC）＝（三角形PAB＋三角形PCA）：三角形PBC。前の問いで求めた面積の比10：18：15を使うと、（10＋15）：18＝25：18です。',
  'AP：PF＝（三角形PAB＋三角形PCA）：三角形PBCと同じ比なので、1つめの数（25）は三角形PAB＋三角形PCAにあたります。2つめの数にあたる三角形PBCは18なので、AP：PFの2つめの数は18です。'),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[int(p)] if str(p).isdigit() else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

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
        # steps/<index>/meaning という道すじそのものが一意な場所を指しているので
        # （今回の指摘は「複数の小問が同じ文面を持っていた」ことが本題＝old文字列が大問内に
        #  複数回出ること自体は想定どおり。道すじ指定で直接書きこむので置換のあいまいさは無い）
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
