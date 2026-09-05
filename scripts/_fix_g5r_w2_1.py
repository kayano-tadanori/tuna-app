# -*- coding: utf-8 -*-
# -*- coding: utf-8 -*-
"""
小5理科（公開テスト kokai No.5〜8）大問監査 g5r_w2/audit_1 分の修正パッチ。

対象: docs/_audit/g5r_w2/findings_1.md に書いた3件（重大3）。
（HG-2852・HG-2865・HG-1626+1627 の3本は独立検算・図の座標検算とも問題なし。
 HG-2864の(2)③は原簿自身が「要現物照合」と明記しており未実装のままにする＝見送り。
 HG-2866（グレード4・第624回、HG-2865と酷似のSVG/答え）は今回の担当範囲外なので触れていない）

■ 修正1: hd_5r_k05_614_4b (HG-2851) steps 先頭に4問(6小問)を追加
  原簿の(1)〜(7)のうち、アプリは(5)(6)(7)しか実装しておらず、(1)アルコールランプの使い方、
  (2)グラフのA・Bの数値、(3)あわの正体、(4)3分後/18分後のようす、が丸ごと未実装だった。
  (2)と(4)はそれぞれ2つの答えを求める設問なので、既存の小問の作り方（1問1答）に合わせて
  A/Bおよび3分後/18分後を別々の小問に分けて追加する。答えはすべて原簿と一致することを確認済み
  （グラフの折れ点はSVGのpolyline座標から実測し、0分→1分(B=0)→9分→11分(20℃)→17分(80℃)→
  19分(A=100℃)が17px/分・2px/℃の完全な線形スケールで一致することを検算した）。

■ 修正2: hd_5r_k06_603_4 (HG-1612) steps 末尾に4問を追加
  原簿の(例)(1)〜(7)のうち、アプリは(1)(2)(3)しか実装しておらず、(4)(5)(6)(7)が丸ごと未実装
  だった。この大問は「導線でつないだ2点を同じ1点とみなして図をつぶし、電池を含む輪を探す」
  という骨で、原簿の作問メモも「今回の2回分で最良の1問」と評価している問題であり、7問中4問
  （57%）が欠けているのは重大な欠落。SVGの座標を実測してF=J、G=H=Lの縮約とH-L間の接続
  （原簿がPDFでかすれていると注記した箇所）が正しく描画されていることも確認したうえで、
  グラフ理論で(4)〜(7)を独立に解き直し、原簿の答え(4個・2個・3個・2個)と一致することを検算した。

■ 修正3: hd_5r_k06_639_4 (HG-2864) svg（棒の影の先端の軌跡が北側でなく南側に描かれている）
  intro/答えの解説は「かげの先たんが集まっている側が北なのでB＝北」（Bは図の上側）としているが、
  実際のSVGでは「棒の影の先端が動いたあと」の軌跡（[図1][図2]共通）と、[図2]の「ある時刻の影」
  「別の時刻の影」「先端どうしの間かく」がすべてBの反対側＝Dの側（下側＝南側）に描かれており、
  解説の内容と実際の図が矛盾している。さらに天文の事実としても、日本（北半球中緯度）の
  春分の日に棒を立てると、日の出から日の入りまで影の先端は常に北寄り（一直線上）にでき、
  南側にできることはない（太陽の方位はつねに東→南→西の範囲＝影の方位はつねに西→北→東の
  範囲、というオイラー式の計算でも確認ずみ）ので、南側に描くのは二重に誤り。
  該当する4か所（[図1]の軌跡線+ラベル、[図2]の軌跡線+ラベル、「ある時刻の影」線+ラベル、
  「別の時刻の影」線+ラベル、「先端どうしの間かく」線+ラベル）のy座標の符号を反転し、
  北側（B＝上側と同じ符号）に描き直す。書き込み前に、置換後の該当y座標がすべて負
  （＝Bと同じ側）になっていることを検算する。

■ 使い方
  python scripts/_fix_g5r_w2_1.py [対象JSONのパス]
  省略時は data/hama_daimon.json （このファイルから見た相対パス基準）。

■ 設計方針
  - 大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  - 置換前に、その大問の中でちょうど1回だけヒットすることを assert してから書き換える
    （冪等：すでに直った後の状態であればそのままスキップし、想定外の状態なら例外で止める）。
  - 大問まるごとの削除・移動はしない。入力形式（テンキー/選択肢）はそれぞれの大問の
    既存の小問と同じ形式に揃える（既存がテンキーならテンキー、選択肢式なら選択肢式）。
  - 図SVGの座標変更は、挿入前に符号を検算し、合わなければ書き込まない。
  - 書き出しは io.open(path, "wb") + json.dumps(..., ensure_ascii=False, indent=1)。
"""
import io
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common as gc  # noqa: E402


# ============================================================
# 修正1: hd_5r_k05_614_4b (HG-2851) 未実装だった(1)(2)(3)(4)を先頭に追加
# ============================================================
ID_2851 = "hd_5r_k05_614_4b"
HG_2851 = "HG-2851"

STEP_2851_1 = {
    "question": "アルコールランプの使い方として適当なものはどれですか。",
    "answer": "火を消すときはほのおのななめ上からふたをかぶせる",
    "choices": [
        "火を消すときはほのおのななめ上からふたをかぶせる",
        "息をふきかける",
        "火がついたままアルコールをつぎ足す",
        "別のアルコールランプの火をうつす",
    ],
    "meaning": (
        "火を消すときは、ふたを横（ななめ上）からかぶせて消す。真上からだと立ちのぼる熱い"
        "空気で手がやけどしやすい。息をふきかけたり、火がついたままつぎ足したり、別の火を"
        "うつしたりするのはどれも危険なのであやまり。"
    ),
}
STEP_2851_2A = {
    "question": "グラフのAにあてはまる数字は何ですか。整数で答えなさい。",
    "answer": "100",
    "meaning": "水がふっとうすると、それ以上は熱をあたえても温度が上がらなくなる。ふっとうする温度は100℃。",
}
STEP_2851_2B = {
    "question": "グラフのBにあてはまる数字は何ですか。整数で答えなさい。",
    "answer": "0",
    "meaning": "氷がとけている間は、熱がとけるために使われて温度は上がらない。とけている間の温度は0℃。",
}
STEP_2851_3 = {
    "question": "A℃（100℃）になるとビーカーの中のものから大きなあわがたくさん出てきました。このあわは何ですか。",
    "answer": "水じょう気",
    "choices": ["水じょう気", "空気", "酸素", "二酸化炭素"],
    "meaning": "100℃でふっとうすると、水が気体に変わった水じょう気のあわが出てくる。",
}
STEP_2851_4A = {
    "question": "加熱し始めてから3分後のビーカーの中のもののようすはどれですか。",
    "answer": "氷と水がまざっている",
    "choices": ["氷と水がまざっている", "すべて氷", "すべて水"],
    "meaning": "3分後は、氷がとけている1分〜9分の間にあたるので、氷と水がまざっている。",
}
STEP_2851_4B = {
    "question": "加熱し始めてから18分後のビーカーの中のもののようすはどれですか。",
    "answer": "すべて水",
    "choices": ["すべて水", "すべて氷", "氷と水がまざっている"],
    "meaning": "18分後は、とけ終わった9分より後で、100℃になる19分より前なので、氷はもう残っておらずすべて水。",
}

STEPS_2851_BEFORE_Q = [
    "ビーカーの中のものが100℃になったのは、加熱し始めてから何分後ですか。",
    "加熱し始めてから14分後の温度は何℃ですか。",
    "ビーカーに 0℃の氷50gと0℃の水50g を入れ、1分あたりの熱の量を同じにして加熱しました。5分後の温度は何℃ですか。",
]


def fix1_2851(x):
    steps = x.get("steps")
    assert isinstance(steps, list), "%s: steps がリストでない" % ID_2851

    already = any(s.get("question") == STEP_2851_1["question"] for s in steps)
    if already:
        assert len(steps) == 9, "%s: 追加ずみのはずがsteps数が想定外(%d)" % (ID_2851, len(steps))
        return False

    assert len(steps) == 3, "%s: steps が3問のはずが%d問だった（想定外の状態なので停止）" % (ID_2851, len(steps))
    for i, q in enumerate(STEPS_2851_BEFORE_Q):
        assert steps[i].get("question") == q, "%s: steps[%d]の設問文が想定と違う: %r" % (ID_2851, i, steps[i].get("question"))

    new_steps = [
        dict(STEP_2851_1),
        dict(STEP_2851_2A),
        dict(STEP_2851_2B),
        dict(STEP_2851_3),
        dict(STEP_2851_4A),
        dict(STEP_2851_4B),
    ] + steps
    x["steps"] = new_steps
    return True


# ============================================================
# 修正2: hd_5r_k06_603_4 (HG-1612) 未実装だった(4)(5)(6)(7)を末尾に追加
# ============================================================
ID_1612 = "hd_5r_k06_603_4"
HG_1612 = "HG-1612"

STEP_1612_4 = {
    "question": "たん子A と たん子B、たん子G と たん子L を それぞれ どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
    "answer": "4",
    "meaning": (
        "GとLは もともと 同じ点なので、なにも 変わりません。\n"
        "E→い→A→B→あ→C→う→(GHL)→か→K→電池→(FJ)→電池→E の 輪が できて、"
        "**い・あ・う・か の4個**が 光ります。"
    ),
}
STEP_1612_5 = {
    "question": "たん子A と たん子J、たん子F と たん子I を それぞれ どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
    "answer": "2",
    "meaning": (
        "AとJ、FとIは どちらも FJ（F＝J）への 接続に なります。E と FJ の 間に、もとからの"
        " 電池と、い を通る道（E→い→A→FJ）と、お を通る道（E→お→I→FJ）が 並列に できるので、"
        "**い・お の2個**が 光ります。もう一つの 電池（FJ〜K側）は Kの先が 行き止まりで 使われません。"
    ),
}
STEP_1612_6 = {
    "question": "たん子D と たん子J、たん子C と たん子F を それぞれ どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
    "answer": "3",
    "meaning": (
        "DとJ、CとFは どちらも FJ（F＝J）への 接続に なります。FJ と (GHL) の 間に、"
        "え を通る道（FJ→D→え→(GHL)）と、う を通る道（FJ→C→う→(GHL)）が 並列に でき、"
        "そこから か を通って もう一つの 電池へ もどる輪に なります。**か・え・う の3個**が"
        " 光ります（あ は 行き止まり、E側の 電池は 使われません）。"
    ),
}
STEP_1612_7 = {
    "question": "たん子E と たん子G、たん子I と たん子K を それぞれ どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
    "answer": "2",
    "meaning": (
        "EとG(GHL)、IとKが それぞれ 同じ点に なります。すると か と お が どちらも"
        " 同じ2点（E＝GHLと I＝K）を つなぐ 道に なり、電池2個ぶんの 輪の 中で 並列に なります。"
        "**か・お の2個**が 光ります（い・あ・う・え は 行き止まり）。"
    ),
}

STEPS_1612_EXIST_Q = [
    "たん子A と たん子C を どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
    "たん子B と たん子D を どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
    "たん子A と たん子K、たん子B と たん子I を それぞれ どう線で つなぐと、電流が 流れる 豆電球は 何個 ですか。",
]


def fix2_1612(x):
    steps = x.get("steps")
    assert isinstance(steps, list), "%s: steps がリストでない" % ID_1612

    already = any(s.get("question") == STEP_1612_4["question"] for s in steps)
    if already:
        assert len(steps) == 7, "%s: 追加ずみのはずがsteps数が想定外(%d)" % (ID_1612, len(steps))
        return False

    assert len(steps) == 3, "%s: steps が3問のはずが%d問だった（想定外の状態なので停止）" % (ID_1612, len(steps))
    for i, q in enumerate(STEPS_1612_EXIST_Q):
        assert steps[i].get("question") == q, "%s: steps[%d]の設問文が想定と違う: %r" % (ID_1612, i, steps[i].get("question"))

    steps.append(dict(STEP_1612_4))
    steps.append(dict(STEP_1612_5))
    steps.append(dict(STEP_1612_6))
    steps.append(dict(STEP_1612_7))
    return True


# ============================================================
# 修正3: hd_5r_k07_604_3 (HG-1625) 未実装だった(1)(2)(3)②の片方(4)を追加
# ============================================================
ID_1625 = "hd_5r_k07_604_3"
HG_1625 = "HG-1625"

STEP_1625_ALUMI = {
    "question": (
        "あるアルミニウムはくの重さを、①広げた状態、②折りたたんだ状態、③丸めた状態、で"
        "それぞれはかりました。結果として適当なものはどれですか。"
    ),
    "answer": "①〜③はどれも同じ重さ",
    "choices": ["①〜③はどれも同じ重さ", "①が最も重い", "②が最も重い", "③が最も重い"],
    "meaning": (
        "アルミニウムはくは、広げても折りたたんでも丸めても形が変わるだけでものの量は"
        "変わらないので、重さも変わらない。"
    ),
}
STEP_1625_NENDO = {
    "question": (
        "あるねん土のかたまりの重さを、①かたまりのまま、②2つに分けたものをまとめて、"
        "③5つに分けたものをまとめて、それぞれはかりました。結果として適当なものはどれですか。"
    ),
    "answer": "①〜③はどれも同じ重さ",
    "choices": ["①〜③はどれも同じ重さ", "①が最も重い", "②が最も重い", "③が最も重い"],
    "meaning": "ねん土は、いくつに分けても全部まとめれば同じ量なので、重さも変わらない。",
}
STEP_1625_SMALLEST = {
    "question": "1gあたりの体積 が いちばん 小さいのは どれですか。",
    "answer": "物体D",
    "choices": ["物体D", "物体A", "物体B", "物体C", "物体E"],
    "meaning": "体積は5つとも同じなので、1gあたりの体積は重さと反比例。いちばん重い物体D（鉄・312g）がいちばん小さい。",
}
STEP_1625_HAKARI = {
    "question": "電子てんびんの使い方として適当でないものはどれですか。",
    "answer": "粉などをはかるときは「0g」にするボタンをおしてから紙をしき、その上に粉をのせる",
    "choices": [
        "粉などをはかるときは「0g」にするボタンをおしてから紙をしき、その上に粉をのせる",
        "水平なところにおいて使用する",
        "決められた重さよりも重いものはのせない",
        "はかるものは台の上に静かにのせる",
    ],
    "meaning": (
        "正しくは、先に紙をしいてから「0g」ボタンをおす。ボタンを先におすと、あとで紙を"
        "のせた分だけ重さがずれてしまう。"
    ),
}

STEPS_1625_EXIST_Q = [
    "物体D は 何で できていますか。",
    "物体B は 何で できていますか。",
    "物体E は 何で できていますか。",
    "**1gあたりの体積** が いちばん 大きいのは どれですか。",
]


def fix3_1625(x):
    steps = x.get("steps")
    assert isinstance(steps, list), "%s: steps がリストでない" % ID_1625

    already = any(s.get("question") == STEP_1625_ALUMI["question"] for s in steps)
    if already:
        assert len(steps) == 8, "%s: 追加ずみのはずがsteps数が想定外(%d)" % (ID_1625, len(steps))
        return False

    assert len(steps) == 4, "%s: steps が4問のはずが%d問だった（想定外の状態なので停止）" % (ID_1625, len(steps))
    for i, q in enumerate(STEPS_1625_EXIST_Q):
        assert steps[i].get("question") == q, "%s: steps[%d]の設問文が想定と違う: %r" % (ID_1625, i, steps[i].get("question"))

    d_step, b_step, e_step, largest_step = steps

    new_steps = [
        dict(STEP_1625_ALUMI),
        dict(STEP_1625_NENDO),
        d_step,
        b_step,
        e_step,
        dict(STEP_1625_SMALLEST),
        largest_step,
        dict(STEP_1625_HAKARI),
    ]
    x["steps"] = new_steps
    return True


# ============================================================
# 修正4: hd_5r_k06_639_4 (HG-2864) svg（棒の影の軌跡を北側＝Bと同じ側に描き直す）
# ============================================================
ID_2864 = "hd_5r_k06_639_4"
HG_2864 = "HG-2864"

SVG_2864_OLD_A = (
    '<line x1="-90.0" y1="60.0" x2="90.0" y2="60.0" stroke="#c9d4f0" stroke-width="2"/>'
    '<text x="100.0" y="64.0" font-size="10" text-anchor="start" fill="#9aa3c0">'
    '棒の影の先端が動いたあと</text>'
)
SVG_2864_NEW_A = (
    '<line x1="-90.0" y1="-60.0" x2="90.0" y2="-60.0" stroke="#c9d4f0" stroke-width="2"/>'
    '<text x="100.0" y="-64.0" font-size="10" text-anchor="start" fill="#9aa3c0">'
    '棒の影の先端が動いたあと</text>'
)
SVG_2864_OLD_B = (
    '<line x1="0.0" y1="0.0" x2="55.0" y2="40.0" stroke="#ffd166" stroke-width="1.8"/>'
    '<text x="60.0" y="40.0" font-size="10" text-anchor="start" fill="#9aa3c0">ある時刻の影</text>'
)
SVG_2864_NEW_B = (
    '<line x1="0.0" y1="0.0" x2="55.0" y2="-40.0" stroke="#ffd166" stroke-width="1.8"/>'
    '<text x="60.0" y="-40.0" font-size="10" text-anchor="start" fill="#9aa3c0">ある時刻の影</text>'
)
SVG_2864_OLD_C = (
    '<line x1="0.0" y1="0.0" x2="-20.0" y2="55.0" stroke="#8aa0d0" stroke-width="1.6"/>'
    '<text x="-70.0" y="50.0" font-size="10" text-anchor="start" fill="#9aa3c0">別の時刻の影</text>'
)
SVG_2864_NEW_C = (
    '<line x1="0.0" y1="0.0" x2="-20.0" y2="-55.0" stroke="#8aa0d0" stroke-width="1.6"/>'
    '<text x="-70.0" y="-50.0" font-size="10" text-anchor="start" fill="#9aa3c0">別の時刻の影</text>'
)
SVG_2864_OLD_D = (
    '<line x1="-20.0" y1="60.0" x2="55.0" y2="60.0" stroke="#ffd166" stroke-width="1"'
    ' stroke-dasharray="3,2"/>'
    '<text x="15.0" y="78.0" font-size="10" text-anchor="middle" fill="#9aa3c0">'
    '棒の影の先端どうしの間かく</text>'
)
SVG_2864_NEW_D = (
    '<line x1="-20.0" y1="-60.0" x2="55.0" y2="-60.0" stroke="#ffd166" stroke-width="1"'
    ' stroke-dasharray="3,2"/>'
    '<text x="15.0" y="-78.0" font-size="10" text-anchor="middle" fill="#9aa3c0">'
    '棒の影の先端どうしの間かく</text>'
)

# B（北）のラベルが置かれている y 座標。修正後の軌跡関連要素は、すべてこれと同じ符号
# （負＝Bと同じ側）になっていなければならない。
SVG_2864_B_LABEL = '<text x="0.0" y="-118.0" font-size="13" text-anchor="middle" fill="#9aa3c0">B</text>'


def _verify_2864(svg_after):
    assert svg_after.count(SVG_2864_B_LABEL) == 2, (
        "%s: Bラベルの座標が想定と違う（2つの図にあるはず）" % ID_2864
    )
    # 修正後の4要素はすべて存在し、原点(0.0)でないy座標はすべて負（＝Bと同じ北側）であること。
    for tag, cnt in ((SVG_2864_NEW_A, 2), (SVG_2864_NEW_B, 1), (SVG_2864_NEW_C, 1), (SVG_2864_NEW_D, 1)):
        assert svg_after.count(tag) == cnt, "%s: 修正後の要素の件数が想定と違う: %r" % (ID_2864, tag[:40])
        ys = [float(v) for v in re.findall(r'y[12]?="(-?[\d.]+)"', tag)]
        ys_nonzero = [y for y in ys if y != 0.0]
        assert ys_nonzero and all(y < 0 for y in ys_nonzero), (
            "%s: 修正後もy座標が負(北側)になっていない: %r" % (ID_2864, ys)
        )


def fix4_2864(x):
    svg = x.get("svg", "")

    already = (SVG_2864_NEW_A in svg) and (SVG_2864_OLD_A not in svg)
    if already:
        _verify_2864(svg)
        return False

    for name, old, cnt in (
        ("A", SVG_2864_OLD_A, 2),
        ("B", SVG_2864_OLD_B, 1),
        ("C", SVG_2864_OLD_C, 1),
        ("D", SVG_2864_OLD_D, 1),
    ):
        got = svg.count(old)
        assert got == cnt, "%s: 修正対象%sの件数が想定と違う（%d件のはずが%d件）" % (ID_2864, name, cnt, got)

    svg2 = svg.replace(SVG_2864_OLD_A, SVG_2864_NEW_A)
    svg2 = svg2.replace(SVG_2864_OLD_B, SVG_2864_NEW_B)
    svg2 = svg2.replace(SVG_2864_OLD_C, SVG_2864_NEW_C)
    svg2 = svg2.replace(SVG_2864_OLD_D, SVG_2864_NEW_D)

    _verify_2864(svg2)

    x["svg"] = svg2
    return True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gc.BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    d = json.load(io.open(path, encoding="utf-8"))

    ids = (ID_2851, ID_1612, ID_1625, ID_2864)
    found = {}
    for rec in gc.iter_daimon(d):
        x = rec["x"]
        xid = x.get("id")
        if xid in ids:
            found.setdefault(xid, []).append(x)

    for xid in ids:
        hits = found.get(xid, [])
        assert len(hits) == 1, (
            "大問 %s が %d 件見つかった（ちょうど1件のはず）: %s" % (xid, len(hits), path)
        )

    x2851 = found[ID_2851][0]
    assert (x2851.get("hg") or x2851.get("src")) == HG_2851, (
        "%s: hg/src が想定と違う: %r" % (ID_2851, x2851.get("hg") or x2851.get("src"))
    )
    x1612 = found[ID_1612][0]
    assert (x1612.get("hg") or x1612.get("src")) == HG_1612, (
        "%s: hg/src が想定と違う: %r" % (ID_1612, x1612.get("hg") or x1612.get("src"))
    )
    x1625 = found[ID_1625][0]
    assert (x1625.get("hg") or x1625.get("src")) == HG_1625, (
        "%s: hg/src が想定と違う: %r" % (ID_1625, x1625.get("hg") or x1625.get("src"))
    )
    x2864 = found[ID_2864][0]
    assert (x2864.get("hg") or x2864.get("src")) == HG_2864, (
        "%s: hg/src が想定と違う: %r" % (ID_2864, x2864.get("hg") or x2864.get("src"))
    )

    changed = {}
    changed["1_steps_2851"] = fix1_2851(x2851)
    changed["2_steps_1612"] = fix2_1612(x1612)
    changed["3_steps_1625"] = fix3_1625(x1625)
    changed["4_svg_2864"] = fix4_2864(x2864)

    out = json.dumps(d, ensure_ascii=False, indent=1)
    io.open(path, "wb").write(out.encode("utf-8"))

    print("path:", path)
    for k in sorted(changed):
        print("changed[%s]:" % k, changed[k])


if __name__ == "__main__":
    main()
