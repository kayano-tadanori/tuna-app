# -*- coding: utf-8 -*-
"""小5最レ 第1分冊 第1講座 No.6〜No.8（hd5s_6k1_6 〜 hd5s_8k1_15・42本）の
塾講師監査（audit_3.txt）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_s5sairei_w5_3.py [対象JSON]
         （省略時 data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う
・欄まるごとの一致で判定するので冪等（cur==new なら済み／cur==old なら適用）
・図SVGは書きこむ前に座標から数値を出して問題文と照合し、
  1つでも合わなければ 1件も書かずに止める
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402


SVG_6843_NEW = (
    '<svg viewBox="0 0 260 250" style="display:block;margin:0 auto;max-width:100%">\n'
    '<defs>\n'
    '<pattern id="hg6843a" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    '<line x1="0" y1="0" x2="0" y2="10" stroke="#4f9eff" stroke-width="1"/></pattern>\n'
    '<pattern id="hg6843b" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">'
    '<line x1="0" y1="0" x2="0" y2="10" stroke="#4f9eff" stroke-width="1"/></pattern>\n'
    '</defs>\n'
    '<rect x="20" y="20" width="160" height="140" fill="url(#hg6843a)" stroke="#4f9eff" stroke-width="2.5"/>\n'
    '<rect x="100" y="90" width="140" height="140" fill="url(#hg6843b)" stroke="#4f9eff" stroke-width="2.5"/>\n'
    '</svg>'
)

SVG_7042_NEW = (
    '<svg viewBox="0 0 340 350" style="display:block;margin:0 auto;max-width:100%">\n'
    '<text x="8" y="16" fill="#e8ecf5" font-size="12">図1</text>\n'
    '<g transform="translate(85,10)">'
    '<polygon points="20,140 140,140 80,60" fill="none" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="80" y1="140" x2="80" y2="60" stroke="#4f9eff" stroke-width="1.5" stroke-dasharray="4,3"/>'
    '<rect x="76" y="132" width="8" height="8" fill="none" stroke="#4f9eff"/>'
    '<circle cx="80" cy="140" r="2" fill="#ffd166"/>'
    '<text x="8" y="150" fill="#e8ecf5" font-size="10">B</text>'
    '<text x="144" y="150" fill="#e8ecf5" font-size="10">C</text>'
    '<text x="88" y="152" fill="#e8ecf5" font-size="10">D</text>'
    '<text x="76" y="52" fill="#e8ecf5" font-size="10">A</text>'
    '<text x="42" y="95" fill="#e8ecf5" font-size="9">10cm</text>'
    '<text x="98" y="95" fill="#e8ecf5" font-size="9">10cm</text>'
    '<text x="84" y="102" fill="#e8ecf5" font-size="9">8cm</text>'
    '<text x="80" y="166" fill="#e8ecf5" font-size="9" text-anchor="middle">12cm</text>'
    '</g>\n'
    '<text x="8" y="205" fill="#e8ecf5" font-size="12">図2</text>\n'
    '<g transform="translate(5,210)">'
    '<polyline points="20,120 50,80 80,120 110,80 140,120" fill="none" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="50" y1="80" x2="110" y2="80" stroke="#4f9eff" stroke-width="1.5"/>'
    '<text x="8" y="132" fill="#e8ecf5" font-size="10">B</text>'
    '<text x="144" y="132" fill="#e8ecf5" font-size="10">C</text>'
    '<text x="74" y="134" fill="#e8ecf5" font-size="9">D,A</text>'
    '<text x="44" y="72" fill="#e8ecf5" font-size="10">E</text>'
    '<text x="106" y="72" fill="#e8ecf5" font-size="10">F</text>'
    '</g>\n'
    '<text x="178" y="205" fill="#e8ecf5" font-size="12">図3</text>\n'
    '<g transform="translate(175,210)">'
    '<polygon points="20,120 140,120 125,100 35,100" fill="none" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="35" y1="100" x2="50" y2="120" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="125" y1="100" x2="110" y2="120" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="50" y1="120" x2="65" y2="100" stroke="#4f9eff" stroke-width="1.2" stroke-dasharray="3,2"/>'
    '<line x1="110" y1="120" x2="95" y2="100" stroke="#4f9eff" stroke-width="1.2" stroke-dasharray="3,2"/>'
    '<text x="8" y="132" fill="#e8ecf5" font-size="10">B</text>'
    '<text x="144" y="132" fill="#e8ecf5" font-size="10">C</text>'
    '<text x="28" y="94" fill="#e8ecf5" font-size="10">G</text>'
    '<text x="122" y="94" fill="#e8ecf5" font-size="10">H</text>'
    '<text x="44" y="134" fill="#e8ecf5" font-size="10">E</text>'
    '<text x="106" y="134" fill="#e8ecf5" font-size="10">F</text>'
    '</g>\n'
    '</svg>'
)

SVG_7044_NEW = (
    '<svg viewBox="0 0 400 300" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="190,40 40,260 360,260" fill="none" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="104" y1="260" x2="224" y2="84" stroke="#4f9eff" stroke-width="1.5"/>'
    '<line x1="264" y1="260" x2="309" y2="194" stroke="#4f9eff" stroke-width="1.5"/>'
    '<circle cx="224" cy="84" r="2.5" fill="#ffd166"/>'
    '<circle cx="309" cy="194" r="2.5" fill="#ffd166"/>'
    '<circle cx="104" cy="260" r="2.5" fill="#ffd166"/>'
    '<circle cx="264" cy="260" r="2.5" fill="#ffd166"/>'
    '<text x="186" y="30" fill="#e8ecf5" font-size="12">A</text>'
    '<text x="20" y="275" fill="#e8ecf5" font-size="12">B</text>'
    '<text x="365" y="275" fill="#e8ecf5" font-size="12">C</text>'
    '<text x="206" y="80" fill="#e8ecf5" font-size="10">D</text>'
    '<text x="313" y="190" fill="#e8ecf5" font-size="10">F</text>'
    '<text x="96" y="278" fill="#e8ecf5" font-size="10">E</text>'
    '<text x="256" y="278" fill="#e8ecf5" font-size="10">G</text>'
    '<text x="62" y="152" fill="#e8ecf5" font-size="9">14cm</text>'
    '<text x="272" y="110" fill="#e8ecf5" font-size="9">16cm</text>'
    '<text x="302" y="168" fill="#e8ecf5" font-size="9">8cm</text>'
    '<text x="60" y="252" fill="#e8ecf5" font-size="9">4cm</text>'
    '<text x="182" y="284" fill="#e8ecf5" font-size="9">20cm</text>'
    '</svg>'
)


# ------------------------------------------------------- 図SVGの座標から検算する

def _rects(svg):
    out = []
    for m in re.finditer(r'<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"', svg):
        x, y, w, h = (float(g) for g in m.groups())
        out.append((x, y, w, h))
    return out


def _near(a, b, tol=1e-6):
    return abs(a - b) <= tol


def verify_svgs():
    """新しい図SVGの座標から数値を出し、問題文・答えと合うか確かめる。
    1つでも合わなければ False（呼び出し側は1件も書かずに止める）。"""
    ok, log = True, []

    # --- HG-6843 大小2つの長方形の重なり ---
    rs = [r for r in _rects(SVG_6843_NEW)]
    if len(rs) != 2:
        ok = False; log.append("HG-6843: rect が2つでない")
    else:
        (x1, y1, w1, h1), (x2, y2, w2, h2) = rs
        big, small = w1 * h1, w2 * h2
        ox = max(0.0, min(x1 + w1, x2 + w2) - max(x1, x2))
        oy = max(0.0, min(y1 + h1, y2 + h2) - max(y1, y2))
        ov = ox * oy
        for name, c in [("大>小", big > small),
                        ("小:大=7:8", _near(small / big, 7.0 / 8.0)),
                        ("重なり=大の1/4", _near(ov / big, 0.25)),
                        ("重なり=小の2/7", _near(ov / small, 2.0 / 7.0))]:
            if not c:
                ok = False; log.append("HG-6843: %s が不成立" % name)
        log.append("HG-6843: 大=%d 小=%d 重なり=%d / 小÷大=%.4f 重÷大=%.4f 重÷小=%.4f"
                   % (big, small, ov, small / big, ov / big, ov / small))

    # --- HG-7042 図3（BC=12cm・10px/cm・Bを(20,120)に置く） ---
    if '<polygon points="20,120 140,120 125,100 35,100"' not in SVG_7042_NEW:
        ok = False; log.append("HG-7042: 図3の四角形GBCHが見あたらない")
    else:
        px = 10.0
        bc = (140 - 20) / px
        gh = (125 - 35) / px
        hgt = (120 - 100) / px
        g_x = (35 - 20) / px
        e_x = (50 - 20) / px
        f_x = (110 - 20) / px
        ef = f_x - e_x
        area = (gh + ef) / 2.0 * hgt
        for name, c in [("BC=12cm", _near(bc, 12)), ("GH=9cm", _near(gh, 9)),
                        ("2回目の折り目の高さ=2cm", _near(hgt, 2)),
                        ("Gは左から1.5cm", _near(g_x, 1.5)),
                        ("EF=6cm", _near(ef, 6)),
                        ("四角形GEFH=15cm2", _near(area, 15))]:
            if not c:
                ok = False; log.append("HG-7042: %s が不成立" % name)
        log.append("HG-7042 図3: BC=%.1f GH=%.1f 高さ=%.1f EF=%.1f 台形GEFH=%.1f"
                   % (bc, gh, hgt, ef, area))
        if '<polyline points="20,120 50,80 80,120 110,80 140,120"' not in SVG_7042_NEW:
            ok = False; log.append("HG-7042: 図2のポリラインが変わっている")

    # --- HG-7044 三角形ABC・AB//DE//FG ---
    A, B, C = (190.0, 40.0), (40.0, 260.0), (360.0, 260.0)
    D, F = (224.0, 84.0), (309.0, 194.0)
    E, G = (104.0, 260.0), (264.0, 260.0)
    for nm, pt in [("D", D), ("F", F), ("E", E), ("G", G)]:
        if ('"%g"' % pt[0]) not in SVG_7044_NEW:
            ok = False; log.append("HG-7044: 点%sのx座標がSVGに見あたらない" % nm)

    def on(P, Q, R):
        dx, dy = Q[0] - P[0], Q[1] - P[1]
        t = (R[0] - P[0]) / dx
        return _near(P[1] + t * dy, R[1]), t

    def para(P, Q, R, S):
        v = (Q[0] - P[0], Q[1] - P[1]); w = (S[0] - R[0], S[1] - R[1])
        cross = v[0] * w[1] - v[1] * w[0]
        ln = ((w[0] ** 2 + w[1] ** 2) ** 0.5) / ((v[0] ** 2 + v[1] ** 2) ** 0.5)
        return _near(cross, 0.0), ln

    okD, tD = on(A, C, D)
    okF, tF = on(A, C, F)
    okE, tE = on(B, C, E)
    okG, tG = on(B, C, G)
    pDE, rDE = para(A, B, D, E)
    pFG, rFG = para(A, B, F, G)
    AB, BC_, AC = 14.0, 20.0, 16.0
    for name, c in [("DはAC上", okD), ("FはAC上", okF), ("EはBC上", okE), ("GはBC上", okG),
                    ("DE//AB", pDE), ("FG//AB", pFG),
                    ("BE=4cm", _near(tE * BC_, 4.0)),
                    ("DE=11.2cm", _near(rDE * AB, 11.2)),
                    ("FC=4.8cm", _near((1 - tF) * AC, 4.8)),
                    ("DF=8cm", _near((tF - tD) * AC, 8.0)),
                    ("FG=4.2cm", _near(rFG * AB, 4.2)),
                    ("CD:CA=4:5", _near(1 - tD, 0.8)),
                    ("CG:CB=CF:CA", _near(1 - tG, 1 - tF))]:
        if not c:
            ok = False; log.append("HG-7044: %s が不成立" % name)
    log.append("HG-7044: AD:AC=%.3f AF:AC=%.3f BE:BC=%.3f BG:BC=%.3f" % (tD, tF, tE, tG))
    log.append("HG-7044: DE=%.2f FC=%.2f DF=%.2f FG=%.2f"
               % (rDE * AB, (1 - tF) * AC, (tF - tD) * AC, rFG * AB))
    return ok, log


# ---------------------------------------------------------------- 直しの一覧
# (大問id, 場所, old, new)   場所 = ("intro",) / ("svg",) / ("step", i, "question"|"meaning")

FIXES = []


def add(did, where, old, new):
    FIXES.append((did, where, old, new))


# ============================== 重大 ==============================

# 【HG-7044】図のDE・FGがABと平行に描かれておらず、D・F・Gの位置も数値と合わない（観点3）
add("hd5s_8k1_15", ("svg",),
    '<svg viewBox="0 0 400 300" style="display:block;margin:0 auto;max-width:100%"><polygon points="190,40 40,260 360,260" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="104" y1="260" x2="249" y2="117" stroke="#4f9eff" stroke-width="1.5"/><line x1="232" y1="260" x2="300" y2="183" stroke="#4f9eff" stroke-width="1.5"/><circle cx="249" cy="117" r="2.5" fill="#ffd166"/><circle cx="300" cy="183" r="2.5" fill="#ffd166"/><circle cx="104" cy="260" r="2.5" fill="#ffd166"/><circle cx="232" cy="260" r="2.5" fill="#ffd166"/><text x="186" y="30" fill="#e8ecf5" font-size="12">A</text><text x="20" y="275" fill="#e8ecf5" font-size="12">B</text><text x="365" y="275" fill="#e8ecf5" font-size="12">C</text><text x="253" y="112" fill="#e8ecf5" font-size="10">D</text><text x="304" y="180" fill="#e8ecf5" font-size="10">F</text><text x="96" y="278" fill="#e8ecf5" font-size="10">E</text><text x="225" y="278" fill="#e8ecf5" font-size="10">G</text><text x="100" y="140" fill="#e8ecf5" font-size="9">14cm</text><text x="296" y="88" fill="#e8ecf5" font-size="9">AC=16cm</text><text x="270" y="140" fill="#e8ecf5" font-size="9">8cm</text><text x="70" y="250" fill="#e8ecf5" font-size="9">4cm</text><text x="180" y="280" fill="#e8ecf5" font-size="9">20cm</text></svg>',
    SVG_7044_NEW)

# 【HG-7042】設問が図2・図3を指しているのに図1しか入っていない（観点6）
add("hd5s_8k1_13", ("svg",),
    '<svg viewBox="0 0 170 174" style="display:block;margin:0 auto;max-width:100%"><polygon points="20,140 140,140 80,60" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="80" y1="140" x2="80" y2="60" stroke="#4f9eff" stroke-width="1.5" stroke-dasharray="4,3"/><rect x="76" y="132" width="8" height="8" fill="none" stroke="#4f9eff"/><circle cx="80" cy="140" r="2" fill="#ffd166"/><text x="8" y="150" fill="#e8ecf5" font-size="10">B</text><text x="144" y="150" fill="#e8ecf5" font-size="10">C</text><text x="88" y="152" fill="#e8ecf5" font-size="10">D</text><text x="76" y="52" fill="#e8ecf5" font-size="10">A</text><text x="42" y="95" fill="#e8ecf5" font-size="9">10cm</text><text x="98" y="95" fill="#e8ecf5" font-size="9">10cm</text><text x="84" y="102" fill="#e8ecf5" font-size="9">8cm</text><text x="80" y="166" fill="#e8ecf5" font-size="9" text-anchor="middle">12cm</text></svg>',
    SVG_7042_NEW)

# 【HG-6862】解説が問題と無関係（硬貨の問題に「面積の比」の解説がついていた）（観点5・6）
_M62 = "たての比とよこの比をかけたものが面積の比になる。"
add("hd5s_6k1_10", ("step", 0, "meaning"), _M62,
    "長方形の面積は「たて×よこ」だから、面積の比は たての比と よこの比を かけ合わせたものになる。たてが1：2、よこが1：3なので 面積の比は (1×1)：(2×3)＝1：6。前の数は1。")
add("hd5s_6k1_10", ("step", 1, "meaning"), _M62,
    "長方形の面積は「たて×よこ」だから、面積の比は たての比と よこの比を かけ合わせたものになる。たてが1：2、よこが1：3なので 面積の比は (1×1)：(2×3)＝1：6。後ろの数は6。")
add("hd5s_6k1_10", ("step", 2, "meaning"), _M62,
    "三角形の面積は「底辺×高さ÷2」。÷2はどちらの三角形にもつくので比には関係しない。だから面積の比は 底辺の比と 高さの比を かけ合わせたものになる。底辺が3：4、高さが1：2なので (3×1)：(4×2)＝3：8。前の数は3。")
add("hd5s_6k1_10", ("step", 3, "meaning"), _M62,
    "三角形の面積は「底辺×高さ÷2」。÷2はどちらの三角形にもつくので比には関係しない。だから面積の比は 底辺の比と 高さの比を かけ合わせたものになる。底辺が3：4、高さが1：2なので (3×1)：(4×2)＝3：8。後ろの数は8。")
add("hd5s_6k1_10", ("step", 4, "meaning"), _M62,
    "合計金額の比も「1枚の金額の比」と「枚数の比」をかけ合わせたものになる。1枚の金額は100円と50円で2：1、枚数は2：3だから 合計金額の比は (2×2)：(1×3)＝4：3。合わせて7にあたるのが4900円なので、1にあたるのは 4900÷7＝700円。100円玉の合計金額は 700×4＝2800円で、枚数は 2800÷100＝28枚。")

# 【HG-6933】(2)(3)は分割点の位置が設問になく、図もないので解けない（観点6）
add("hd5s_7k1_10", ("step", 1, "question"),
    "1辺20cmの正方形に内接する三角形（頂点は上辺上の点・左下のかど・右辺上の点）が斜線。",
    "1辺20cmの正方形があります。上の辺を左から8cmのところで区切った点、左下のかど、右の辺を下から8cmのところで区切った点、この3つの点を結んでできる三角形が斜線部分です。")
add("hd5s_7k1_10", ("step", 2, "question"),
    "正方形（1辺2+6+2=10cm）の各辺の分割点どうしを結んでできるX（クロス）状の図形が斜線。",
    "1辺が2＋6＋2＝10cmの正方形があります。どの辺も、はしから2cm・6cm・2cmの3つに分けてあります。4つの辺それぞれについて、まん中の6cmの部分を斜辺とする直角二等辺三角形を正方形の内がわから切り取ると、4つのかどがとがったX（クロス）の形が残ります。この残った部分が斜線部分です。")

# 【HG-6934】(1)は「20cmと15cmが直角に交わる」が設問になく解けない（観点6）
add("hd5s_7k1_11", ("step", 0, "question"),
    "五角形（家型）。下辺24cm、左辺27cm、右辺20cm、そこから頂点へ向けて左20cm・右15cmの2辺。",
    "五角形（家型）。下の辺24cm、左の辺27cm、右の辺20cm（左右の辺はどちらも下の辺と直角）、その上から頂点へ向かう左20cm・右15cmの2辺（この20cmと15cmの2辺は直角に交わっています）。")

# 【HG-6952】(1)は「角BACが直角」が設問になく解けない／導入文が無い図をさしている（観点6）
add("hd5s_7k1_13", ("intro",),
    "下図の台形ABCDの面積を求めなさい。",
    "台形ABCDの面積を求めなさい。（ADとBCは平行で、ADが上底、BCが下底です）")
add("hd5s_7k1_13", ("step", 0, "question"),
    "AD=5cm(上底)、BC=10cm(下底)、AB=6cm、対角線AC=8cm。",
    "AD=5cm(上底)、BC=10cm(下底)、AB=6cm、対角線AC=8cm。角BAC（辺ABと対角線ACのあいだの角）は直角です。")

# 【HG-6935】(2)(3)は図がないと何を求めるのか分からない（観点6）／解説が等積変形の説明になっていない（観点5）
add("hd5s_7k1_12", ("step", 1, "question"),
    "直角三角形（左辺4cm+6cm、下辺9cm+6cm）の中の三角形の斜線部分。",
    "直角をはさむ2辺が たて10cm（上から4cm・6cmに分かれる）・よこ15cm（左から9cm・6cmに分かれる）の直角三角形があります。たての辺を上から4cmのところで分ける点をP、よこの辺を左から9cmのところで分ける点をR、ななめの辺（斜辺）の上にとった点をQとすると、直線PRは斜辺と平行になります。三角形PQRが斜線部分です。")
add("hd5s_7k1_12", ("step", 1, "meaning"),
    "斜線の部分は、形をくずさずに動かして考えると、底辺6cm・高さ6cmの三角形と同じ面積になる。6×6÷2＝18cm²。",
    "Pは たての辺の下から6cmの高さ、Rは よこの辺の左から9cmのところにある。PRは斜辺と平行なので、頂点Qを斜辺にそってどこまですべらせても、底辺PRからのはなれ方（高さ）は変わらない。だから三角形PQRの面積も変わらない（等積変形）。そこでQを斜辺の右はし＝よこの辺の右はしまですべらせると、底辺はRから右はしまでの6cm、高さはPの高さ6cmの三角形になるので 6×6÷2＝18cm²。")
add("hd5s_7k1_12", ("step", 2, "question"),
    "8cm四方の正方形に接続した三角形の斜線部分。",
    "1辺8cmの正方形があります。下の辺を右にのばした直線の上に点Mをとり、正方形の左上のかどとM、右上のかどとMをそれぞれ直線で結びます。左上のかどとMを結んだ線は正方形の右の辺と交わり、その交点から右下のかどまでの長さは2cmです。右上のかど・この交点・Mの3点で囲まれた三角形が斜線部分です。")
add("hd5s_7k1_12", ("step", 2, "meaning"),
    "斜線の部分は、形をくずさずに動かして考えると、正方形の1辺8cmを底辺、2cmを高さとする三角形と同じ面積になる。8×2÷2＝8cm²。",
    "正方形の左上のかどをA、右上をB、右下をC、左下をDとし、AMと右の辺BCの交点をNとする（CN＝2cm）。斜線は三角形BNM。これに三角形NCMをたすと三角形BCMになる。ABとCMは平行だから、頂点BをAまですべらせても面積は変わらない（等積変形）＝三角形BCMと三角形ACMは同じ面積。三角形ACMは、NがAM上にあるので三角形ACNと三角形NCMに分かれる。だから 斜線＋三角形NCM＝三角形ACN＋三角形NCM となり、斜線＝三角形ACN。三角形ACNは底辺CN＝2cm、高さは正方形の1辺の8cmだから 2×8÷2＝8cm²。")

# 【HG-6982/6983/6984】D・Eが何なのか、DE//BCであることが設問になく記号だけでは解けない（観点6）
_OI = "次の□にあてはまる数を求めなさい。"
_NI = "三角形ABCがあり、辺AB上に点D、辺AC上に点Eをとると、DEとBCは平行になっています。次の□にあてはまる数を求めなさい。"
add("hd5s_8k1_4", ("intro",), _OI, _NI)
add("hd5s_8k1_5", ("intro",), _OI, _NI)
add("hd5s_8k1_6", ("intro",), _OI, _NI)

# 【HG-6953】(1)はどの2本の線かが書かれておらず解けない（観点6）
add("hd5s_7k1_14", ("step", 0, "question"),
    "長方形ABCD（AD=3cm+5cm、AB=2cm+4cm）の中に2本の線を引いてできる、対角にある2つの四角形（蝶ネクタイ状の斜線部分）の面積を求めなさい。",
    "たて6cm・よこ8cmの長方形ABCD（Aが左下、Bが左上、Cが右上、Dが右下）があります。下の辺ADを左から3cmに分ける点と、上の辺BCを左から5cmに分ける点を結ぶ線を1本、左の辺ABを下から2cmに分ける点と、右の辺DCを下から4cmに分ける点を結ぶ線をもう1本引きます。この2本の線と長方形の辺で分けられた4つの部分のうち、左下のかどAをふくむ部分と、右上のかどCをふくむ部分（向かい合う2つ）の面積の合計を求めなさい。")
# 【HG-6953】(2)の「E–Bが24cm」は正方形の辺ABをふくむ長さ。読みちがえると答えが変わる（観点6）
add("hd5s_7k1_14", ("step", 1, "question"),
    "正方形ABCDの2辺を延長した図形の中の斜線部分の面積を求めなさい。（左辺ABを上に延長したE–Bが24cm、辺ADを右に延長したD–Fが24cm。斜線は四角形E–B–D–Fひとつで、破線ADをまたいで続く）",
    "正方形ABCDの2辺をのばした図形の中の斜線部分の面積を求めなさい。（左の辺ABをAの側へまっすぐのばした線の上に点Eをとります。EからBまでは24cmで、これは正方形の1辺ABもふくめた長さです。上の辺ADをDの側へまっすぐのばした線の上に点Fをとり、DからFまでは24cmです。斜線は四角形E–B–D–Fひとつで、破線の辺ADをまたいで続いています）")

# 【HG-6961】(1)は「右の図において」なのに図がなく、（ ）の説明も読み取れない（観点6）
add("hd5s_7k1_16", ("step", 0, "question"),
    "右の図において三角形ABCの面積を求めなさい（Aから底辺への垂線の足から2cm先にB、そこからさらに8cm先の垂線の足から2cm上にC、Aの高さ8cm、Cの高さ2cm）。",
    "1本のまっすぐな線の上に、左から順に点H・点B・点Kをとります。HB＝2cm、BK＝8cmです。Hからこの線と直角に上へ8cmのところが点A、Kからこの線と直角に上へ2cmのところが点Cです。三角形ABCの面積を求めなさい。")

# 【HG-6960】(1)は「右の図の」なのに図がない（観点6）
add("hd5s_7k1_15", ("step", 0, "question"),
    "右の図の三角形の面積を求めなさい（底辺右端が直角、狭角15°、斜辺12cm）。",
    "1つの角が直角で、そのとなりの角が15°、いちばん長い辺（斜辺）が12cmの三角形があります。この三角形の面積を求めなさい。")

# 【HG-7019】「図のように」なのに図がない（観点6）
add("hd5s_8k1_10", ("intro",),
    "図のように長方形と直角三角形を重ねたとき，□にあてはまる数を求めなさい。",
    "長方形と直角三角形を、下の辺どうし・直角をはさむたての辺どうしがぴったり重なるように置きます。□にあてはまる数を求めなさい。")


# ============================== 中 ==============================

# 【HG-6843】解説のS・Lは文字式（観点5）／図の縮尺が問題文の分数と合っていない（観点3）
add("hd5s_6k1_6", ("step", 0, "meaning"),
    "小さい長方形をS,大きい長方形をLとすると重なり＝(2/7)S＝(1/4)LよりS＝(7/8)L。L+S＝60に代入して(15/8)L＝60、L＝32。重なり＝(1/4)×32＝8cm²",
    "重なった部分は「小さい長方形の2/7」でもあり「大きい長方形の1/4」でもある。そこで重なった部分の面積を②とおくと、小さい長方形は ②÷2×7＝⑦、大きい長方形は ②÷1×4＝⑧にあたる。2つの長方形の面積の和は ⑦＋⑧＝⑮で、これが60cm²だから ①＝60÷15＝4cm²。重なった部分は②なので 4×2＝8cm²。")
add("hd5s_6k1_6", ("svg",),
    '<svg viewBox="0 0 300 400" style="display:block;margin:0 auto;max-width:100%">\n<defs>\n<pattern id="hg6843a" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#4f9eff" stroke-width="1"/></pattern>\n<pattern id="hg6843b" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#4f9eff" stroke-width="1"/></pattern>\n</defs>\n<rect x="50" y="40" width="110" height="190" fill="url(#hg6843a)" stroke="#4f9eff" stroke-width="2.5"/>\n<rect x="120" y="160" width="100" height="160" fill="url(#hg6843b)" stroke="#4f9eff" stroke-width="2.5"/>\n</svg>',
    SVG_6843_NEW)

# 【HG-6863】解説のx・y・a・bは文字式（観点5）
_M63 = "横の比をx:yとすると2x:3y=4:5よりx:y=(4/5)×(3/2)=6:5"
add("hd5s_6k1_11", ("step", 0, "meaning"), _M63,
    "長方形の面積の比は「たての比×よこの比」になる。たての比が2：3、面積の比が4：5だから、よこの比は 面積の比を たての比で わって出せる。4÷2：5÷3＝2：5/3 で、両方を3倍して整数の比になおすと 6：5。前の数は6。")
add("hd5s_6k1_11", ("step", 1, "meaning"), _M63,
    "長方形の面積の比は「たての比×よこの比」になる。たての比が2：3、面積の比が4：5だから、よこの比は 面積の比を たての比で わって出せる。4÷2：5÷3＝2：5/3 で、両方を3倍して整数の比になおすと 6：5。後ろの数は5。")
add("hd5s_6k1_11", ("step", 2, "meaning"),
    "100円玉a枚,50円玉b枚,a+b=20。100a:50b=2:3よりa:b=1:3。a+3a=20、a=5枚",
    "合計金額の比は「1枚の金額の比」と「枚数の比」をかけ合わせたもの。1枚の金額の比は100：50＝2：1で、合計金額の比が2：3だから、枚数の比は 合計金額の比を 1枚の金額の比で わって 2÷2：3÷1＝1：3。合わせて4にあたるのが20枚なので、1にあたるのは 20÷4＝5枚。100円玉は5枚。")

# 【HG-6876】解説のkは文字式（観点5）
_M76a = "8A=3B=4C、7C=6Dを軸Cでそろえる。C=k/4とおくとA=k/8,B=k/3,D=7k/24。24倍してA:B:C:D=3:8:6:7"
_M76b = "3C=2D→D=3C/2、10B=3D=9C/2→B=9C/20、4A=9C→A=9C/4。20倍してA:B:C:D=45:9:20:30"
_N76a = "Aの8倍・Bの3倍・Cの4倍が等しいので、その等しい大きさを8と3と4の最小公倍数24とおくと A＝24÷8＝3、B＝24÷3＝8、C＝24÷4＝6。次にCの7倍とDの6倍が等しいから 6×7＝42＝D×6 より D＝7。よって A：B：C：D＝3：8：6：7。"
_N76b = "Cの3倍とDの2倍が等しいので、その等しい大きさを60とおくと C＝60÷3＝20、D＝60÷2＝30。Bの10倍とDの3倍が等しいから 30×3＝90＝B×10 より B＝9。Aの4倍とCの9倍が等しいから 20×9＝180＝A×4 より A＝45。よって A：B：C：D＝45：9：20：30。"
for _i, _t in [(0, "1つめは3。"), (1, "2つめは8。"), (2, "3つめは6。"), (3, "4つめは7。")]:
    add("hd5s_6k1_13", ("step", _i, "meaning"), _M76a, _N76a + _t)
for _i, _t in [(4, "1つめは45。"), (5, "2つめは9。"), (6, "3つめは20。"), (7, "4つめは30。")]:
    add("hd5s_6k1_13", ("step", _i, "meaning"), _M76b, _N76b + _t)

# 【HG-6879】解説のk・m・x・yは文字式（観点5）
_M79 = "Aのたて4k・よこ5k、Bのたて5m・よこ7m。周長18k=24mよりk:m=4:3。面積比=20k²:35m²=20×16:35×9=320:315=64:63"
_N79 = ("Aのたてとよこを④と⑤、Bのたてとよこを⑤と⑦とする（○1つぶんの長さはAとBでちがう）。"
        "まわりの長さは Aが (④＋⑤)×2＝⑱、Bが (⑤＋⑦)×2＝㉔で、これが等しいから "
        "Aの○1つとBの○1つの比は 1/18：1/24＝4：3。そこでAの○1つを4cm、Bの○1つを3cmとすると、"
        "Aは たて16cm・よこ20cmで面積320cm²、Bは たて15cm・よこ21cmで面積315cm²（まわりはどちらも72cmで等しい）。"
        "320：315＝64：63。")
add("hd5s_6k1_16", ("step", 0, "meaning"), _M79, _N79 + "前の数は64。")
add("hd5s_6k1_16", ("step", 1, "meaning"), _M79, _N79 + "後ろの数は63。")
add("hd5s_6k1_16", ("step", 2, "meaning"),
    "100円x冊,150円y冊。100x+150y=5400、4x=2×6yよりx=3y。450y=5400、y=12、x=36（冊）",
    "積み上げた高さは 100円のノートが150円のノートの2倍。1冊の厚さは4mmと6mmだから、冊数の比は 高さの比を 1冊の厚さの比で わって 2÷4：1÷6＝1/2：1/6＝3：1。そこで100円3冊と150円1冊を1組にすると、1組は 100×3＋150×1＝450円。5400÷450＝12組ぶんあるので、100円のノートは 3×12＝36冊。")

# 【HG-6972】小問1の解説が小問2の答え（40cm）を先に見せている（観点5）
add("hd5s_8k1_2", ("step", 0, "meaning"),
    "C=180-60-50=70°、F=180-70-50=60°。角の対応はA(60°)↔F(60°)、B(50°)↔E(50°)、C(70°)↔D(70°)なので、Aの対辺BCはFの対辺DEに対応。相似比はABとEF（ともにC・Dの対辺）で60:48=5:4。DE=50×4/5=40cm",
    "まず、かかれていない角を三角形の内角の和から出す。㋐はC＝180－60－50＝70°、㋑はF＝180－70－50＝60°。すると 60°どうし（AとF）、50°どうし（BとE）、70°どうし（CとD）が対応する角になる。辺BCはAの向かい合う辺だから、対応するのはFの向かい合う辺、つまり辺ED。")

# 【HG-6910】設問の（ ）が、全体と左右の三角形の底辺・高さまで先に見せている（観点5）
add("hd5s_7k1_6", ("step", 0, "question"),
    "下の図は直角二等辺三角形を3つ重ねたものです。斜線部分の面積を求めなさい。（底辺を6cm・6cm・8cmに分割。全体の三角形(底辺20・高さ10)、左の三角形(頂点は6cmの位置で高さ6)、右の三角形(頂点は13cmの位置で高さ7)が重なる）",
    "下の図は直角二等辺三角形を3つ重ねたものです。斜線部分の面積を求めなさい。（いちばん大きい三角形の底辺は、左から6cm・6cm・8cmの3つに分かれています）")

# 【HG-7021】解説が「逆比で内分」など小5の言葉になっていない（観点5）
add("hd5s_8k1_12", ("step", 0, "meaning"),
    "中点連結なので単純平均(5+9)/2=7",
    "両はしの辺のまん中どうしを結んだ線は、上底から下底へ ちょうど半分すすんだところにある。上底5cmと下底9cmの差は 9－5＝4cmだから、この線は上底より その半分の2cmだけ長い。5＋2＝7cm。")
add("hd5s_8k1_12", ("step", 1, "meaning"),
    "脚の分割比(上4.8:下9.6=1:2)の逆比で内分＝(2×7.2+1×16.8)/3=10.4",
    "左の脚が上から4.8cm・9.6cmに分かれているので、その比は 4.8：9.6＝1：2。□の線は、上底から下底までのうち上から 1/3 だけすすんだところにある。上底と下底の差は 16.8－7.2＝9.6cmだから、□は上底より 9.6×1/3＝3.2cm 長い。7.2＋3.2＝10.4cm。")
add("hd5s_8k1_12", ("step", 2, "meaning"),
    "中央線11＝(下側比×5+上側比×14)/(上側比+下側比)から比が2:1(上:下)と逆算できる(11=(1×5+2×14)/3)。右脚も同じ比で分かれるので、上7cmに対応する下側=7×(1/2)=3.5",
    "上底5cmと下底14cmの差は 14－5＝9cm。まん中の線は11cmで、上底より 11－5＝6cm 長い。6は9の 2/3 だから、この線は上底から下底までのうち 2/3 すすんだところにある。だから右の脚も上から2：1に分かれる。上が7cmなら1にあたるのは 7÷2＝3.5cmなので、その点から下底までは3.5cm。")


# ---------------------------------------------------------------- 適用

def locate(x, where):
    if where[0] == "intro":
        return ("intro" in x), x.get("intro")
    if where[0] == "svg":
        return ("svg" in x), x.get("svg")
    if where[0] == "step":
        _, i, key = where
        steps = x.get("steps") or []
        if i >= len(steps):
            return False, None
        return (key in steps[i]), steps[i].get(key)
    raise ValueError(where)


def put(x, where, val):
    if where[0] == "intro":
        x["intro"] = val
    elif where[0] == "svg":
        x["svg"] = val
    else:
        x["steps"][where[1]][where[2]] = val


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(HERE), "data", "hama_daimon.json")

    ok, log = verify_svgs()
    print("--- 図SVGを座標から検算 ---")
    for line in log:
        print("  " + line)
    if not ok:
        print("!! 図SVGが問題文と合わないので、1件も書かずに止めます")
        return 1
    print("  -> 図SVGの検算はすべて一致")

    raw = io.open(path, "rb").read()
    tail_nl = raw.endswith(b"\n")   # 元ファイルの末尾の改行の有無に合わせる
    d = json.loads(raw.decode("utf-8"))
    idx = {}
    for r in iter_daimon(d):
        x = r["x"]
        if isinstance(x, dict) and isinstance(x.get("id"), str):
            idx.setdefault(x["id"], []).append(x)

    applied, already, errors, changed = 0, 0, [], set()
    for did, where, old, new in FIXES:
        hits = idx.get(did, [])
        if len(hits) != 1:
            errors.append("%s: 大問が %d 件（1件でない）" % (did, len(hits)))
            continue
        x = hits[0]
        exists, cur = locate(x, where)
        if not exists:
            errors.append("%s %s: 欄がない" % (did, where))
            continue
        if cur == new:
            already += 1
            continue
        if cur != old:
            errors.append("%s %s: 置きかえ元と一致しない（先に別の手が入っている可能性）\n"
                          "    現在: %r\n    想定: %r" % (did, where, cur[:110], old[:110]))
            continue
        # 欄まるごとの一致で入れかえるので「その大問の中でちょうど1回」は自動的に満たす
        assert cur == old
        put(x, where, new)
        applied += 1
        changed.add(did)

    if errors:
        print("\n!! 想定と合わない箇所があるので、1件も書かずに止めます")
        for e in errors:
            print("  - " + e)
        return 1

    print("\n適用 %d 件 / 適用ずみでとばした %d 件 / 直した大問 %d 本"
          % (applied, already, len(changed)))
    for i in sorted(changed):
        print("  " + i)

    if applied == 0:
        print("\n変更なし（すでに当たっています）。ファイルは書きかえません。")
        return 0

    # 末尾の改行は元ファイルに合わせる（そろえないと最終行だけ差分に出る）
    out = json.dumps(d, ensure_ascii=False, indent=1)
    if tail_nl:
        out += "\n"
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))
    print("\n書き出し: %s" % path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
