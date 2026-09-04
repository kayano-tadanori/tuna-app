# -*- coding: utf-8 -*-
"""小5最レ（算数）第2分冊 第1講座 No.14／No.18 の大問20本 塾講師監査 3班（audit_3.txt）の修正パッチ。

  使い方:  python scripts/_fix_s5sairei_w7_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★図SVGは、書きこむ前に座標から長さ・比・面積を計算して問題文と合うことを確かめる。
    1件でも合わなければ 1件も書かずに止める。

  直したもの（findings_3.md と対応）:
    重大 hd5s_18k1_9  解説が壊れていた（BCEの式が途中で切れ、前半の1/12と後半のウ=1/12が食いちがい、
                      問題文に無い ア・イ・ウ が子どもの画面に出ていた）
    重大 hd5s_18k1_3  解説が座標と文字式(h・t・負の座標)のままで小5には読めなかった
    中   hd5s_14k1_16 小問1の解説の末尾に小問2の解法の書きだしが混入（小問2の答えの筋を先に見せていた）
    中   hd5s_18k1_7  設問の条件が「D:AD:DB=1:3」という日本語になっていない書き方／解説が原簿の貼りつけ
    中   hd5s_18k1_5  小問の設問が図の説明メモのままで問いの文になっていなかった（3問）
    中   hd5s_18k1_6  同上（3問）
    中   hd5s_14k1_13 導入文に編集メモ「（例：1・2・8・20の見本つき）」がそのまま出ていた
    中   hd5s_18k1_3  図でFが辺ADの延長線上に無く、A-D-Fが折れ曲がっていた（原本は一直線）
    軽   hd5s_18k1_1  図の縮小比が 1:5 でなく約1:4 に描かれていた（大問2の図と見分けがつかない）
    軽   hd5s_18k1_9  設問のかっこ書きが監査メモ調だった
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 図の検算
def _area(*p):
    s = 0.0
    for i in range(len(p)):
        x1, y1 = p[i]
        x2, y2 = p[(i + 1) % len(p)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def check_svg_geometry():
    """新しく入れる図SVGの座標が、問題文の数値と合うかを確かめる。合わなければ False。"""
    ng = []

    # --- hd5s_18k1_1（HG-6974）平行四辺形ABCD=240cm2・三角形FDAは三角形FEBの1/5 ---
    A, D, B, C, E = (150, 40), (188, 40), (210, 180), (248, 180), (20, 180)
    F = (160, 190 / 3.0)
    if D[0] - A[0] != C[0] - B[0]:
        ng.append("18k1_1: AD != BC")
    if (B[0] - A[0], B[1] - A[1]) != (C[0] - D[0], C[1] - D[1]):
        ng.append("18k1_1: AB != DC（平行四辺形になっていない）")
    if not (E[1] == B[1] == C[1]):
        ng.append("18k1_1: E-B-C が一直線でない")
    if abs((B[0] - E[0]) / float(D[0] - A[0]) - 5.0) > 1e-9:
        ng.append("18k1_1: EB が AD の5倍でない")
    if (abs((F[0] - A[0]) / float(B[0] - A[0]) - 1 / 6.0) > 1e-9
            or abs((F[1] - A[1]) / float(B[1] - A[1]) - 1 / 6.0) > 1e-9):
        ng.append("18k1_1: F が AB を 1:5 に分けていない")
    if abs((F[0] - D[0]) / float(E[0] - D[0]) - 1 / 6.0) > 1e-9:
        ng.append("18k1_1: F が D-E 上に無い")
    par = _area(A, B, C, D)
    if abs(240 * _area(F, D, A) / par - 20) > 1e-6:
        ng.append("18k1_1: 三角形FDA が 20cm2 にならない")
    if abs(240 * _area(D, E, C) / par - 720) > 1e-6:
        ng.append("18k1_1: 三角形DEC が 720cm2 にならない")

    # --- hd5s_18k1_3（HG-6976）BC=20cm・DF=30cm・台形ABED=800cm2 → 三角形BCE=200cm2 ---
    A, D, B, C, F = (16, 30), (118, 30), (16, 178), (118, 178), (271, 30)
    if not (A[1] == D[1] == F[1]):
        ng.append("18k1_3: A-D-F が一直線でない")
    if (D[0] - A[0]) != (C[0] - B[0]):
        ng.append("18k1_3: AD != BC")
    if abs((F[0] - D[0]) / float(D[0] - A[0]) - 30 / 20.0) > 1e-9:
        ng.append("18k1_3: DF:AD が 30:20 でない")
    t = (118 - B[0]) / float(F[0] - B[0])
    Ey = B[1] + t * (F[1] - B[1])
    if abs((Ey - D[1]) / (C[1] - Ey) - 1.5) > 1e-6:
        ng.append("18k1_3: DE:EC が 3:2 にならない")
    h = float(D[0] - A[0])          # ABとDCのあいだの長さ（この図は長方形に作図してある）
    trap = (C[1] - D[1] + Ey - D[1]) / 2.0 * h
    tri = (C[1] - Ey) / 2.0 * h
    if abs(800.0 / (trap / tri) - 200.0) > 1e-6:
        ng.append("18k1_3: 台形ABED=800 のとき 三角形BCE が 200cm2 にならない")
    if abs(Ey - 118.8) > 0.05:
        ng.append("18k1_3: 図に描いた E の位置(118.8)が計算値とちがう")

    for m in ng:
        sys.stderr.write("[zu-check NG] " + m + "\n")
    return not ng


# ---------------------------------------------------------------- 置きかえ表
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
 ('hd5s_14k1_13',
  ('intro',),
  'デルタ王国では数字を表すのに三角形に色をぬって表します（例：1・2・8・20の見本つき）。',
  'デルタ王国では数字を表すのに，三角形に色をぬって表します。図の上の4つは，1・2・8・20 の表し方の見本です。'),
 ('hd5s_14k1_16',
  ('steps', '0', 'meaning'),
  'ポポル君のホテルは0,2,3,5,6,7,8の7種類で7進法。302の各桁を0,2,3,5,6,7,8→0,1,2,3,4,5,6に置き換えると201(7進法)＝2×49+0×7+1＝99番目 (2) ブー君のホテルは0,1,2,3,5,6,7,8の8種類で8進法',
  'ポポル君のホテルで使える数字は 0，2，3，5，6，7，8 の7種類だけです。7種類しか使わないので、部屋番号のならび方は7進法とそっくりになります。小さいほうから順に 0，2，3，5，6，7，8 を 0，1，2，3，4，5，6 に置きかえると、302は201になります。7進法の201は 2×49＋0×7＋1＝99。だから302号室は99番目です。'),
 ('hd5s_18k1_1',
  ('svg',),
  '<svg viewBox="0 0 215 155" style="display:block;margin:0 auto;max-width:100%">\n  <line x1="115" y1="20" x2="150" y2="18" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="150" y1="18" x2="195" y2="126" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="160" y1="128" x2="195" y2="126" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="115" y1="20" x2="160" y2="128" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="150" y1="18" x2="20" y2="133" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="20" y1="133" x2="160" y2="128" stroke="#4f9eff" stroke-width="1.5"/>\n  <text x="106" y="18" fill="#e8ecf5" font-size="11">A</text>\n  <text x="153" y="16" fill="#e8ecf5" font-size="11">D</text>\n  <text x="106" y="46" fill="#e8ecf5" font-size="11">F</text>\n  <text x="163" y="140" fill="#e8ecf5" font-size="11">B</text>\n  <text x="198" y="126" fill="#e8ecf5" font-size="11">C</text>\n  <text x="8" y="140" fill="#e8ecf5" font-size="11">E</text>\n</svg>',
  '<svg viewBox="0 0 285 210" style="display:block;margin:0 auto;max-width:100%">\n  <polygon points="150,40 210,180 248,180 188,40" fill="none" stroke="#4f9eff" stroke-width="2"/>\n  <line x1="20" y1="180" x2="248" y2="180" stroke="#4f9eff" stroke-width="2"/>\n  <line x1="20" y1="180" x2="188" y2="40" stroke="#4f9eff" stroke-width="2"/>\n  <text x="139" y="33" font-size="13" fill="#e8ecf5" text-anchor="middle">A</text>\n  <text x="196" y="33" font-size="13" fill="#e8ecf5" text-anchor="middle">D</text>\n  <text x="148" y="67" font-size="13" fill="#e8ecf5" text-anchor="middle">F</text>\n  <text x="8" y="186" font-size="13" fill="#e8ecf5" text-anchor="middle">E</text>\n  <text x="209" y="197" font-size="13" fill="#e8ecf5" text-anchor="middle">B</text>\n  <text x="260" y="185" font-size="13" fill="#e8ecf5" text-anchor="middle">C</text>\n</svg>'),
 ('hd5s_18k1_3',
  ('svg',),
  '<svg viewBox="0 0 290 200" style="display:block;margin:0 auto;max-width:100%">\n  <line x1="16" y1="30" x2="118" y2="30" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="118" y1="30" x2="275" y2="15" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="16" y1="30" x2="15" y2="178" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="118" y1="30" x2="118" y2="178" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="15" y1="178" x2="118" y2="178" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="15" y1="178" x2="275" y2="15" stroke="#4f9eff" stroke-width="1.5"/>\n  <text x="4" y="24" fill="#e8ecf5" font-size="11">A</text>\n  <text x="122" y="24" fill="#e8ecf5" font-size="11">D</text>\n  <text x="280" y="12" fill="#e8ecf5" font-size="11">F</text>\n  <text x="2" y="192" fill="#e8ecf5" font-size="11">B</text>\n  <text x="122" y="192" fill="#e8ecf5" font-size="11">C</text>\n  <text x="122" y="115" fill="#e8ecf5" font-size="11">E</text>\n  <text x="150" y="18" fill="#e8ecf5" font-size="10">30cm</text>\n  <text x="45" y="192" fill="#e8ecf5" font-size="10">20cm</text>\n</svg>',
  '<svg viewBox="0 0 290 200" style="display:block;margin:0 auto;max-width:100%">\n  <line x1="16" y1="30" x2="118" y2="30" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="118" y1="30" x2="271" y2="30" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="16" y1="30" x2="16" y2="178" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="118" y1="30" x2="118" y2="178" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="16" y1="178" x2="118" y2="178" stroke="#4f9eff" stroke-width="1.5"/>\n  <line x1="16" y1="178" x2="271" y2="30" stroke="#4f9eff" stroke-width="1.5"/>\n  <circle cx="118" cy="118.8" r="2.5" fill="#4f9eff"/>\n  <text x="5" y="24" fill="#e8ecf5" font-size="11">A</text>\n  <text x="122" y="24" fill="#e8ecf5" font-size="11">D</text>\n  <text x="275" y="24" fill="#e8ecf5" font-size="11">F</text>\n  <text x="3" y="192" fill="#e8ecf5" font-size="11">B</text>\n  <text x="122" y="192" fill="#e8ecf5" font-size="11">C</text>\n  <text x="124" y="123" fill="#e8ecf5" font-size="11">E</text>\n  <text x="180" y="24" fill="#e8ecf5" font-size="10">30cm</text>\n  <text x="50" y="192" fill="#e8ecf5" font-size="10">20cm</text>\n</svg>'),
 ('hd5s_18k1_3',
  ('steps', '0', 'meaning'),
  'A(0,0)D(20,0)B(0,-h)C(20,-h)、F(50,0)とおく。B,E,F一直線でEはx=20上にあるので、直線BFのt=0.4地点、E=(20,-0.6h)。台形ABED=(1/2)(h+0.6h)(20)=16h=800よりh=50。三角形BCE(B(0,-50)C(20,-50)E(20,-30))は直角三角形で面積=(1/2)(20)(20)=200cm²',
  'ADとBCは平行四辺形の向かい合う辺だから平行で、FはADをまっすぐのばした先にあるので、FDとBCも平行です。B・E・Fは一直線だから、三角形FDEと三角形BCEは形が同じ三角形（相似）になります。FD：BC＝30：20＝3：2 なので DE：EC＝3：2。つまり辺DCを5等分すると、DEは3つぶん、ECは2つぶん、ABはDCと同じ長さなので5つぶんです。台形ABEDと三角形BCEは、どちらもABとDCの間にはさまれていて高さが同じだから、台形ABED＝(5＋3)×高さ÷2＝4×高さ、三角形BCE＝2×高さ÷2＝1×高さ。台形ABED：三角形BCE＝4：1なので、三角形BCE＝800÷4＝200cm²です。'),
 ('hd5s_18k1_5',
  ('intro',),
  '次のそれぞれの図の平行四辺形で，A，Bは辺の中点です（Aは上辺、Bは下辺）。斜線部分の面積は平行四辺形の面積の何倍ですか。',
  '次のそれぞれの図の平行四辺形で，A，Bは辺の中点です（Aは上辺、Bは下辺）。'),
 ('hd5s_18k1_5',
  ('steps', '0', 'question'),
  '対角線と線分ABが作る、隅の小さい三角形が斜線',
  '斜線をつけた三角形の面積は，平行四辺形の面積の何倍ですか。'),
 ('hd5s_18k1_5',
  ('steps', '1', 'question'),
  '同じ2本の線が作る、隣の四角形部分が斜線',
  '斜線をつけた四角形の面積は，平行四辺形の面積の何倍ですか。'),
 ('hd5s_18k1_5',
  ('steps', '2', 'question'),
  'Aと対角の頂点を結ぶ線＋対角線が作る、下辺を底辺とする大きい三角形が斜線',
  '斜線をつけた三角形の面積は，平行四辺形の面積の何倍ですか。'),
 ('hd5s_18k1_6',
  ('intro',),
  '次のそれぞれの図の平行四辺形でAE：ED＝BF：FC＝3：2です。斜線部分の面積はもとの平行四辺形の面積の何倍ですか。',
  '次のそれぞれの図の平行四辺形で AE：ED＝BF：FC＝3：2です。'),
 ('hd5s_18k1_6',
  ('steps', '0', 'question'),
  '対角線BDと線分EFが作る、E-D側の小さい三角形',
  '斜線をつけた三角形の面積は，もとの平行四辺形の面積の何倍ですか。'),
 ('hd5s_18k1_6',
  ('steps', '1', 'question'),
  '対角線ACと線分EFが作る、A-B-F側の四角形',
  '斜線をつけた四角形の面積は，もとの平行四辺形の面積の何倍ですか。'),
 ('hd5s_18k1_6',
  ('steps', '2', 'question'),
  '対角線AC・線分EC・線分EFが作る、E-C側の小さい三角形',
  '斜線をつけた三角形の面積は，もとの平行四辺形の面積の何倍ですか。'),
 ('hd5s_18k1_7',
  ('steps', '0', 'question'),
  '図のように三角形ABCの3辺の4等分点を結んでできる三角形DEFの面積は三角形ABCの面積の何倍ですか。（D:AD:DB=1:3、E:BE:EC=1:3、F:CF:FA=1:3の位置）',
  '図のように三角形ABCの3辺の4等分点を結んでできる三角形DEFの面積は三角形ABCの面積の何倍ですか。（AD：DB＝1：3、BE：EC＝1：3、CF：FA＝1：3の位置に D・E・F をとります）'),
 ('hd5s_18k1_7',
  ('steps', '0', 'meaning'),
  '3頂点付近の小三角形はそれぞれ元の三角形の面積の(1/4)×(3/4)=3/16倍。3つ引いて1-3×3/16=7/16',
  'まず三角形ADCは、底辺ADが辺ABの1/4で高さは三角形ABCと同じだから、面積はABCの1/4倍です。その中の三角形ADFは、底辺AFが辺ACの3/4（CF：FA＝1：3だから）で高さが同じなのでADCの3/4、つまりABCの1/4×3/4＝3/16倍になります。同じように頂点Bのかどの三角形（3/4と1/4）も、頂点Cのかどの三角形（1/4と3/4）も3/16倍です。だから真ん中の三角形DEFは1－3/16×3＝7/16倍です。'),
 ('hd5s_18k1_9',
  ('steps', '0', 'question'),
  '長方形ABCDの辺BCを4等分した点と辺CDを2等分した点と辺ADを3等分した点を図のように結んでできる三角形BEFの面積は、長方形ABCDの面積の何倍ですか。（Eは辺CDの中点、Fは辺ADをA側から2:1に分ける点。辺BCの4等分点は図に描かれているが三角形BEFの頂点としては使われていない）',
  '長方形ABCDの辺BCを4等分した点と辺CDを2等分した点と辺ADを3等分した点を図のように結んでできる三角形BEFの面積は、長方形ABCDの面積の何倍ですか。（Eは辺CDの真ん中の点、Fは辺ADをA側から2：1に分ける点です。辺BCの4等分点も図にかいてありますが、三角形BEFにはつかいません。）'),
 ('hd5s_18k1_9',
  ('steps', '0', 'meaning'),
  '長方形を1とすると、三角形ABF=1/2×AF/AD×1=1/2×2/3=1/3、三角形FDE=1/2×FD/AD×DE/DC=1/2×1/3×1/2=1/12、三角形BCE=1/2×1=1/2×2/3(DC/2÷DC=1/2)…ア=1/3・イ=1/4・ウ=1/12とし、1-(1/3+1/4+1/12)=1/3',
  '長方形ABCDの面積を1とします。三角形BEFのまわりには、かどの直角三角形が3つできています。・三角形ABF … 底辺AFは辺ADの2/3、高さは辺ABまるごとだから 2/3÷2＝1/3。・三角形BCE … 底辺BCは辺ADと同じ長さ、高さCEはEが辺CDの真ん中の点だから辺CDの1/2で 1/2÷2＝1/4。・三角形FDE … 底辺FDは辺ADの1/3、高さDEは辺CDの1/2だから 1/3×1/2÷2＝1/12。のこりが三角形BEFなので 1－(1/3＋1/4＋1/12)＝1－2/3＝1/3倍です。'),
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
        # その大問の中で、この文字列がちょうど1回だけ出ることを確かめる
        n = json.dumps(x, ensure_ascii=False).count(json.dumps(old, ensure_ascii=False)[1:-1])
        assert n == 1, "%s %s: appears %d times in the daimon (expected 1)" % (did, "/".join(map(str, path)), n)
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
