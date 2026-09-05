# -*- coding: utf-8 -*-
"""小3最レ算数 fukushu No.14〜No.20 の塾講師監査（audit_2.txt・26本）の修正パッチ。

  使い方:  python scripts/_fix_g3s_w1_2.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：フィールドの値そのもの（svg文字列）で判定する。すでに新しい状態ならそのまま飛ばす。
  ★大問まるごとの削除・移動は含まない（既存2本のsvgフィールドだけを直す）。
  ★原本PDF（C:\\Users\\User\\Desktop\\浜問題\\）はGoogle Drive未接続で参照不可だった。
    ここで直す2件はどちらも、原簿の文章記録（正方形の一辺・中点・折り返しの角度／
    階段グラフの●○のルール）だけから座標・状態を一意に検算できるため、PDFなしで修正した
    （findings_2.md 参照）。

  対象2本（findings_2.md「重大1」「重大2」）：

  【重大1】hd3s_17_2（HG-0425）… 正方形の二重折り返し。
    図のB'が (60.0,90.0) にあり、EG(y=120)上になく、CB'の長さも194.3pxで
    正方形の1辺160pxと一致しない（小問1「CB'=CBは同じ長さ」という答えと図が矛盾）。
    CB'=CB=160・B'はEG上（y=120）という2条件から正しいB'=(81.4,120.0)を計算し直し、
    D'（未描画だった。角DをHFに折った像）=(140.0,61.4)も追加。B'-D'間の補助線を足すことで
    角X=45°（小問4の答え）が図からも読み取れる状態にした。

  【重大2】hd_3s_f20_4（HG-0344）… 通話料金の階段グラフ。
    「0分をこえて1分30秒までは10円」＝区間は(左は含まない・右は含む]のはずなのに、
    図の8個の<circle>は全4区間で左端が●(塗り=含む)・右端が○(白=含まない)という
    正反対の組み合わせになっていた。原簿の作問メモが名指しで警告する
    「●○を逆にすると答えが変わる」罠に、図そのものが落ちていた。
    小問1・2の答え自体は正しい規則で計算されており正しいので、図側の●○だけを
    左右入れ替えて答えと整合させた（数値・座標は一切変えていない）。

  検算（geometry check）は _check_hg0425_geometry() に切り出し、書き込み前に必ず通す。
  合わなければ AssertionError で止まり、1件も書かない。
"""
import io, json, math, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon, hgof


# 対象2本と、原簿番号(hg/src)が今も一致しているかの確認用
TARGETS = {
    "hd3s_17_2": "HG-0425",
    "hd_3s_f20_4": "HG-0344",
}


# ── HG-0425：正方形の二重折り返し。B'/D'の正しい座標 ──
# 正方形 A(60,40)-D(220,40)-C(220,200)-B(60,200)、1辺160。EG: y=120（水平中線）、HF: x=140（垂直中線）。
# B'：CB'=CB=160 かつ B'はEG上（y=120） → B'=(220-80√3, 120)
# D'：CD'=CD=160 かつ D'はHF上（x=140） → D'=(140, 200-80√3)
HG0425_OLD = (
    u"<circle cx=\"60.0\" cy=\"90.0\" r=\"3.5\" fill=\"#ffd166\"/>"
    u"<text x=\"48.0\" y=\"88.0\" font-size=\"12\" text-anchor=\"end\" fill=\"#ffd166\">B\'</text>"
    u"<line x1=\"220.0\" y1=\"200.0\" x2=\"60.0\" y2=\"90.0\" stroke=\"#ffd166\" stroke-width=\"1.8\" stroke-dasharray=\"3 3\"/>"
    u"<text x=\"78.0\" y=\"96.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">X</text>"
)
HG0425_NEW = (
    u"<circle cx=\"81.4\" cy=\"120.0\" r=\"3.5\" fill=\"#ffd166\"/>"
    u"<text x=\"70.0\" y=\"112.0\" font-size=\"12\" text-anchor=\"end\" fill=\"#ffd166\">B\'</text>"
    u"<circle cx=\"140.0\" cy=\"61.4\" r=\"3.5\" fill=\"#ffd166\"/>"
    u"<text x=\"150.0\" y=\"58.0\" font-size=\"12\" text-anchor=\"start\" fill=\"#ffd166\">D\'</text>"
    u"<line x1=\"220.0\" y1=\"200.0\" x2=\"81.4\" y2=\"120.0\" stroke=\"#ffd166\" stroke-width=\"1.8\" stroke-dasharray=\"3 3\"/>"
    u"<line x1=\"220.0\" y1=\"200.0\" x2=\"140.0\" y2=\"61.4\" stroke=\"#ffd166\" stroke-width=\"1.8\" stroke-dasharray=\"3 3\"/>"
    u"<line x1=\"81.4\" y1=\"120.0\" x2=\"140.0\" y2=\"61.4\" stroke=\"#ffd166\" stroke-width=\"1.8\" stroke-dasharray=\"3 3\"/>"
    u"<text x=\"98.0\" y=\"113.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">X</text>"
)


def _check_hg0425_geometry():
    """B\'/D\'の新しい座標が、原簿の記述（CB\'=CB=辺の長さ・角B\'CB=30°・角X=45°）を
    実際に満たすかを純粋な三角関数で検算する。合わなければここで例外を投げて止める。"""
    C = (220.0, 200.0)
    B = (60.0, 200.0)
    D = (220.0, 40.0)
    G = (220.0, 120.0)
    Bp = (81.4, 120.0)
    Dp = (140.0, 61.4)
    side = 160.0

    def dist(p, q):
        return math.hypot(p[0] - q[0], p[1] - q[1])

    def ang(o, p, q):
        v1 = (p[0] - o[0], p[1] - o[1])
        v2 = (q[0] - o[0], q[1] - o[1])
        denom = math.hypot(*v1) * math.hypot(*v2)
        c = (v1[0] * v2[0] + v1[1] * v2[1]) / denom
        c = max(-1.0, min(1.0, c))
        return math.degrees(math.acos(c))

    assert abs(Bp[1] - 120.0) < 0.05, "B\' が EG(y=120) 上に無い: y=%.2f" % Bp[1]
    assert abs(Dp[0] - 140.0) < 0.05, "D\' が HF(x=140) 上に無い: x=%.2f" % Dp[0]
    assert abs(dist(C, Bp) - side) < 1.0, "CB\' が辺の長さ160と一致しない: %.2f" % dist(C, Bp)
    assert abs(dist(C, Dp) - side) < 1.0, "CD\' が辺の長さ160と一致しない: %.2f" % dist(C, Dp)
    assert abs(ang(C, B, Bp) - 30.0) < 1.0, "角B\'CB が30度でない: %.2f" % ang(C, B, Bp)
    assert abs(ang(C, D, Dp) - 30.0) < 1.0, "角D\'CD が30度でない: %.2f" % ang(C, D, Dp)
    x_ang = ang(Bp, G, Dp)
    assert abs(x_ang - 45.0) < 1.0, "角X が45度でない: %.2f" % x_ang


# ── HG-0344：階段グラフの ●○ を8個とも左右入れ替え ──
# (cx, cy) ごとに「入れ替え前の完全な<circle>文字列」→「入れ替え後」のペア。
FILLED = u"fill=\"#c9d4f0\"/>"
OPEN = u"fill=\"none\" stroke=\"#c9d4f0\" stroke-width=\"1.6\"/>"
HG0344_CIRCLE_SWAPS = [
    # (cx, cy, 修正前がfilledか)
    ("60.0", "158.0", True),
    ("142.5", "158.0", False),
    ("142.5", "126.0", True),
    ("225.0", "126.0", False),
    ("225.0", "94.0", True),
    ("307.5", "94.0", False),
    ("307.5", "62.0", True),
    ("390.0", "62.0", False),
]


def _circle_tag(cx, cy, filled):
    head = u"<circle cx=\"%s\" cy=\"%s\" r=\"3.4\" " % (cx, cy)
    return head + (FILLED if filled else OPEN)


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く（存在確認・原簿番号の一致確認）
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in TARGETS:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(TARGETS) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in TARGETS.items():
        hgs = hgof(found[did]) or []
        assert hg in hgs, "%s: hg mismatch (expected %s, got %r)" % (did, hg, hgs)

    changed = skipped = 0

    # ① hd3s_17_2（HG-0425）B\'/D\'座標修正
    x = found["hd3s_17_2"]
    svg = x["svg"]
    if HG0425_NEW in svg:
        skipped += 1
    else:
        n = svg.count(HG0425_OLD)
        assert n == 1, "hd3s_17_2 svg: old block appears %d times (expected 1)" % n
        _check_hg0425_geometry()
        new_svg = svg.replace(HG0425_OLD, HG0425_NEW, 1)
        assert new_svg.startswith("<svg") and new_svg.endswith("</svg>"), \
            "hd3s_17_2: svg structure broken after replace"
        x["svg"] = new_svg
        changed += 1

    # ② hd_3s_f20_4（HG-0344）●○ 左右入れ替え
    x = found["hd_3s_f20_4"]
    svg = x["svg"]
    already = all(_circle_tag(cx, cy, not filled_before) in svg
                  for cx, cy, filled_before in HG0344_CIRCLE_SWAPS)
    still_old = all(_circle_tag(cx, cy, filled_before) in svg
                     for cx, cy, filled_before in HG0344_CIRCLE_SWAPS)
    if already and not still_old:
        skipped += 1
    else:
        assert still_old, "hd_3s_f20_4 svg: circles not in expected old state"
        new_svg = svg
        for cx, cy, filled_before in HG0344_CIRCLE_SWAPS:
            old_tag = _circle_tag(cx, cy, filled_before)
            new_tag = _circle_tag(cx, cy, not filled_before)
            n = new_svg.count(old_tag)
            assert n == 1, "hd_3s_f20_4 svg: %r appears %d times (expected 1)" % (old_tag, n)
            new_svg = new_svg.replace(old_tag, new_tag, 1)
        assert new_svg.count(FILLED) == 4 and new_svg.count(OPEN) == 4, \
            "hd_3s_f20_4: filled/open circle counts changed unexpectedly"
        assert new_svg.startswith("<svg") and new_svg.endswith("</svg>"), \
            "hd_3s_f20_4: svg structure broken after replace"
        x["svg"] = new_svg
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
