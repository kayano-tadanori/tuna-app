# -*- coding: utf-8 -*-
"""小3マスター算数（fukushu No.34〜kokai No.2・HG-0112〜HG-0925・31本）の
塾講師監査（docs/_audit/g3m_w1/findings_2.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g3m_w1_2.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：すでに直った状態なら黙って飛ばす（old値が見つからずnew値が既にあれば skip）。
・置換前に「その大問の中でちょうど1回」であることを assert してから書き換える。
・原本PDF（浜問題フォルダ）は今回アクセスできなかった（Google Drive未接続）。
  4件とも原本無しで判断できる不具合（独立検算・座標実測・原簿との機械照合）のみを直した。

直したもの（findings_2.md と対応）:

  重大  hd_3m_f41_5（HG-0133・N進法カウンタ）
    原簿は2026-08-11に「実物のメーターはA=6目盛(0-5)・B=3目盛(0-2)・C=8目盛(0-7)と
    バラバラ」と実物確認済みで訂正されている（重みはC=1・B=8・A=24）。ところがアプリの
    intro文と両小問の答え・選択肢・解説は訂正前の「6-6-6一様モデル」のまま（重み36-6-1）。
    図SVGだけは訂正後の原簿から正しくコピーされていて（A=6目盛/B=3目盛/C=8目盛の絵）、
    intro文「どのめもりも0から5までの6つ」と図が正面から矛盾している。
    小問1の答え(1,4,0)・選択肢4つのどれもが正しい答え(2,1,4)を含んでいない。
    小問2の答え189も誤り（正しくは131）。intro・小問1（答え・選択肢・解説）・
    小問2（答え・解説）・題名を、訂正済みの原簿の数値に合わせて直した。
    入力形式（小問1=選択肢、小問2=テンキー）は変えていない。

  中  hd_3m_f34_6（HG-0112・格子点の正方形）
    「ななめの正方形も忘れずに」を説明する自作図が、実は正方形になっていない
    （3本の線分で開いたまま閉じておらず、最後の1本だけ縦線という壊れた形）。
    5×5格子の座標を使い、閉じた4辺の斜め正方形（(54,26)-(78,50)-(54,74)-(30,50)、
    全頂点が格子内）に描き直した。書き換え前にこの4頂点が実際に正方形（4辺が同じ長さ・
    隣り合う辺が直角）になっているかをコードで検算し、合わなければ書き込まない。
    答え(8しゅるい)・入力形式は変えていない。

  重大  hd3m_38_1（HG-0018・つるかめ算・表を使って）
    大問の図SVGが「表を作ってさがす」という原簿の狙い（ぜんぶ片方と仮定してずらす過程を
    手で体験させる）のための表のはずが、実際には最初から全部埋まった状態で表示され、
    しかも正解の列（つる10・かめ3・足32）だけ背景色が変えてハイライトされていた。
    小問1（答え26）・小問4（答え3）・小問5（答え10）の答えを、計算する前に図から
    そのまま読み取れてしまう状態だった。「足の合計」行の数値をぜんぶ「？」に伏せ、
    ハイライトの色も他のセルと同じ白に戻した（つる・かめの仮定の列自体は原簿が
    「表つき」で仮定をずらす体験をさせる設計なので残した）。答え・入力形式は変えていない。

  軽  hd3m_30_1（HG-0017・分数の文章題）
    小問2の設問文「はじめに あった なわは 何m ですか」が、2人のなわを合わせる場面と
    かみ合っていない（「はじめにあった」1本のなわという設定が存在しない）。原簿自身の
    設問文「合わせると何m」に合わせて「2本を合わせると何mですか」に直した。
    答え(5)・入力形式は変えていない。

見送り（このスクリプトに含めていない）:
  軽  hd3m_06_1（HG-0015・点数分布の逆算）
    小問3が原簿の①（人数計＋得点計の2本の式で㋐㋑を両方とも決める）を「㋐＋㋑の和」
    だけに弱めていて、人数計1本だけで解けてしまう（得点計を使わなくてよい）。ただし
    小問4はこのあとも図の分布表を見れば得点計を使って解けるため、実際に答えられなく
    なっているわけではない。設問の作り替えが要るため見送り、findings_2.mdに記録のみ。
"""
import io, json, math, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


def find_one(d, target_id):
    found = [r["x"] for r in iter_daimon(d) if r["x"].get("id") == target_id]
    assert len(found) == 1, "daimon id が0本か複数本: %s (%d件)" % (target_id, len(found))
    return found[0]


def replace_once(s, old, new, label):
    """old→new に置換。old が無く new が既にあれば「すでに直っている」として無変更で返す。"""
    if old not in s:
        assert new in s, "%s: old も new も見つからない（想定外の状態）" % label
        return s, False
    cnt = s.count(old)
    assert cnt == 1, "%s: old の出現回数が1でない（%d回）" % (label, cnt)
    return s.replace(old, new), True


def set_field(container, key, old, new, label):
    """container[key] を old→new に更新。すでに new ならスキップ（冪等）。"""
    cur = container[key]
    if cur == new:
        return False
    assert cur == old, "%s: 現在値が想定と違う: %r" % (label, cur)
    container[key] = new
    return True


# ============================================================
# 中: hd_3m_f34_6（HG-0112）壊れた「ななめの正方形」の図を直す
# ============================================================
def fix_f34_6(d):
    x = find_one(d, "hd_3m_f34_6")
    assert x.get("src") == "HG-0112", "src が想定と違う: %r" % x.get("src")

    OLD_LINES = (
        "<line x1='30.0' y1='26.0' x2='54.0' y2='50.0' stroke='#ef476f' stroke-width='1.2'/>"
        "<line x1='54.0' y1='50.0' x2='30.0' y2='74.0' stroke='#ef476f' stroke-width='1.2'/>"
        "<line x1='30.0' y1='74.0' x2='30.0' y2='50.0' stroke='#ef476f' stroke-width='1.2'/>"
    )
    NEW_LINES = (
        "<line x1='54.0' y1='26.0' x2='78.0' y2='50.0' stroke='#ef476f' stroke-width='1.2'/>"
        "<line x1='78.0' y1='50.0' x2='54.0' y2='74.0' stroke='#ef476f' stroke-width='1.2'/>"
        "<line x1='54.0' y1='74.0' x2='30.0' y2='50.0' stroke='#ef476f' stroke-width='1.2'/>"
        "<line x1='30.0' y1='50.0' x2='54.0' y2='26.0' stroke='#ef476f' stroke-width='1.2'/>"
    )

    # 書き込む前に、新しい4頂点が実際に正方形になっているか検算する。
    # 合わなければ1件も書かずに例外で止める。
    pts = [(54.0, 26.0), (78.0, 50.0), (54.0, 74.0), (30.0, 50.0)]
    sides = []
    for i in range(4):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % 4]
        sides.append((x1 - x0, y1 - y0))
    lens = [math.hypot(dx, dy) for dx, dy in sides]
    assert all(abs(l - lens[0]) < 1e-6 for l in lens), "4辺の長さが揃っていない: %r" % lens
    for i in range(4):
        dx0, dy0 = sides[i]
        dx1, dy1 = sides[(i + 1) % 4]
        dot = dx0 * dx1 + dy0 * dy1
        assert abs(dot) < 1e-6, "隣り合う辺が直角でない（内積%r）" % dot
    # 全頂点が5×5格子の描画範囲（x:30-126, y:26-122）に収まっているか
    for px, py in pts:
        assert 30.0 - 1e-6 <= px <= 126.0 + 1e-6, "頂点が格子の外: %r" % (px,)
        assert 26.0 - 1e-6 <= py <= 122.0 + 1e-6, "頂点が格子の外: %r" % (py,)

    svg, changed = replace_once(x["svg"], OLD_LINES, NEW_LINES, "hd_3m_f34_6.svg")
    x["svg"] = svg
    return 1 if changed else 0


# ============================================================
# 重大: hd_3m_f41_5（HG-0133）N進法カウンタを訂正済み原簿の値に合わせる
# ============================================================
def fix_f41_5(d):
    x = find_one(d, "hd_3m_f41_5")
    assert x.get("src") == "HG-0133", "src が想定と違う: %r" % x.get("src")

    n = 0
    n += set_field(
        x, "title",
        "3つの めもり盤（6でくり上がる）",
        "3つの めもり盤（めもりの数がバラバラ）",
        "hd_3m_f41_5.title",
    )
    n += set_field(
        x, "intro",
        "Cのめもりが 1回転すると Bが1めもり、Bが1回転すると Aが1めもり 進む機械があります。\n"
        "どの めもりも 0から5までの6つで、はじめは (A, B, C)＝(0, 0, 0) です。",
        "Cのめもりが 1回転すると Bが1めもり、Bが1回転すると Aが1めもり 進む機械があります。\n"
        "Aは0から5までの6つ、Bは0から2までの3つ、Cは0から7までの8つの めもりが あります。"
        "はじめは (A, B, C)＝(0, 0, 0) です。",
        "hd_3m_f41_5.intro",
    )

    steps = x.get("steps")
    assert isinstance(steps, list) and len(steps) == 2, "steps の形が想定と違う"
    s0, s1 = steps[0], steps[1]

    assert s0.get("question") == "Cを 60めもり 進めると (A, B, C) はどれになりますか。", \
        "小問1の設問文が想定と違う: %r" % s0.get("question")
    n += set_field(s0, "answer", "(1, 4, 0)", "(2, 1, 4)", "hd_3m_f41_5.steps[0].answer")
    n += set_field(
        s0, "choices",
        ["(1, 4, 0)", "(0, 6, 0)", "(4, 1, 0)", "(1, 0, 4)"],
        ["(2, 1, 4)", "(1, 4, 0)", "(0, 7, 4)", "(2, 4, 1)"],
        "hd_3m_f41_5.steps[0].choices",
    )
    n += set_field(
        s0, "meaning",
        "Cが6めもりで Bが1つ進むので、Bは6めもりぶん・Aは36めもりぶん。60＝36×1+6×4+0。",
        "Cは8めもりで1回転してBが1つ進み、Bは3めもりで1回転してAが1つ進む。"
        "だからBの1めもりはCの8めもりぶん、Aの1めもりはCの24めもりぶん（8×3）。"
        "60÷8＝7あまり4→C＝4。7÷3＝2あまり1→B＝1、A＝2。(A, B, C)＝(2, 1, 4)。",
        "hd_3m_f41_5.steps[0].meaning",
    )

    assert s1.get("question") == "(A, B, C)＝(5, 1, 3) のとき、Cは 何めもり 進みましたか。", \
        "小問2の設問文が想定と違う: %r" % s1.get("question")
    n += set_field(s1, "answer", "189", "131", "hd_3m_f41_5.steps[1].answer")
    n += set_field(
        s1, "meaning",
        "5×36+1×6+3＝189めもり。位取りが 36・6・1 になっている（6でくり上がる しくみ）。",
        "Aの重みは24、Bの重みは8、Cの重みは1（Cは1めもり、Bは1めもりでCの8めもりぶん、"
        "Aは1めもりでCの24めもりぶん）。5×24+1×8+3＝120+8+3＝131めもり。",
        "hd_3m_f41_5.steps[1].meaning",
    )

    return 1 if n > 0 else 0


# ============================================================
# 軽: hd3m_30_1（HG-0017）小問2の設問文を場面に合わせる
# ============================================================
def fix_30_1(d):
    x = find_one(d, "hd3m_30_1")
    assert x.get("src") == "HG-0017 原簿・小3マスター No.30", "src が想定と違う: %r" % x.get("src")

    steps = x.get("steps")
    assert isinstance(steps, list) and len(steps) == 5, "steps の形が想定と違う"
    s1 = steps[1]
    assert s1.get("answer") == "5", "小問2の答えが想定と違う: %r" % s1.get("answer")

    n = set_field(
        s1, "question",
        "はじめに あった なわは 何m ですか。整数の 部分を 答えなさい。",
        "2本を 合わせると 何m ですか。整数の 部分を 答えなさい。",
        "hd3m_30_1.steps[1].question",
    )
    return 1 if n else 0


# ============================================================
# 重大: hd3m_38_1（HG-0018）表がハイライトつきで答えを見せている
# ============================================================
def fix_38_1(d):
    x = find_one(d, "hd3m_38_1")
    assert x.get("hg") == "HG-0018", "hg が想定と違う: %r" % x.get("hg")

    svg = x["svg"]
    n = 0

    # ハイライト（正解の列だけ薄黄色）を他のセルと同じ白に戻す
    svg, ch = replace_once(
        svg,
        '<rect x="229" y="68" width="47" height="30" fill="#fff3d6" stroke="#4f7cff" stroke-width="1.1"></rect>',
        '<rect x="229" y="68" width="47" height="30" fill="#fff" stroke="#4f7cff" stroke-width="1.1"></rect>',
        "hd3m_38_1.svg(highlight)",
    )
    n += ch

    # 「足の合計（本）」の行の4つの数値（26・28・30・32）を、計算する前に読めないよう「？」に伏せる。
    # つる・かめの仮定の列（13,12,11,10 / 0,1,2,3）は、原簿の「表を配ってずらす」体験そのものなので残す。
    for xcoord, val in (("111.5", "26"), ("158.5", "28"), ("205.5", "30"), ("252.5", "32")):
        old = ('<text x="%s" y="87" font-size="13" text-anchor="middle" '
               'font-family="sans-serif" fill="#1a2340">%s</text>') % (xcoord, val)
        new = ('<text x="%s" y="87" font-size="13" text-anchor="middle" '
               'font-family="sans-serif" fill="#1a2340">？</text>') % (xcoord,)
        svg, ch = replace_once(svg, old, new, "hd3m_38_1.svg(row3:%s)" % val)
        n += ch

    x["svg"] = svg
    return 1 if n > 0 else 0


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    results = {
        "hd_3m_f34_6(HG-0112)": fix_f34_6(d),
        "hd_3m_f41_5(HG-0133)": fix_f41_5(d),
        "hd3m_30_1(HG-0017)": fix_30_1(d),
        "hd3m_38_1(HG-0018)": fix_38_1(d),
    }

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))

    total = sum(results.values())
    sys.stdout.write("changed=%d件  内訳=%s  target=%s\n" % (total, results, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
