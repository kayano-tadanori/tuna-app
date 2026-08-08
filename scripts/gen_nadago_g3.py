# -*- coding: utf-8 -*-
"""小3 灘合（灘中合格特訓）の大問を data/hama_daimon.json に置く。

★形は既存の大問モードと同じ（[[project_oton_2mode_kousou]]）：
  grades["3"]["nadago"]["fukushu"][回番号] = [大問, …]
  大問 = {id, src, title, category, unit, grade, star, intro, svg, steps:[{question, answer, meaning}]}
  → アプリ側の変更は要らない（js/sansu.js の hamaDaimonWeek がそのまま読む）

★原簿どおりに置く。数値替えの類題は作らない（[[feedback_genbo_dori]]）。
  原簿は 設定／設問／図の仕様／答え／解法 を全部持っているので、
  **設問を解法の順に小問へ割る**だけでよい。ここが灘合の設計そのもの：
  原簿 HG-1909 作問メモ「小問の並びがそのまま解法の手順書になっている」。

★図は原簿の「図:」に**あり**と書いてあるものだけ描く。
  「なし（ベン図を自分で描かせる）」と書いてあるものは**描かない**（描くと問題が変わる）。

  python scripts/gen_nadago_g3.py          … 中身を見るだけ
  python scripts/gen_nadago_g3.py --write  … data/hama_daimon.json に書きこむ
"""
import io, json, math, os, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DAIMON = os.path.join(ROOT, "data", "hama_daimon.json")

# 既存の大問・かんたん解説と同じ色づかい
BLUE, GREEN, ORANGE, INK, GRAY = "#4f7cff", "#28c88a", "#ff9a44", "#1a2340", "#6c7086"
RED = "#ff6b6b"


def _svg(w, h, body):
    return ('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">\n%s\n</svg>' % (w, h, body))


def _t(x, y, s, fill=INK, size=13, anchor="middle", bold=False):
    return ('<text x="%s" y="%s" font-size="%s" text-anchor="%s" font-family="sans-serif" '
            'fill="%s"%s>%s</text>' % (x, y, size, anchor, fill, ' font-weight="bold"' if bold else '', s))


# ── HG-1901 星形六角形の魔方陣 ─────────────────────────────
# 原簿の図の仕様どおり：〇は12個＝外側のとがった点6個＋内側の六角形の頂点6個。
#   外側 上=6・下=10、左上/右上/左下/右下は空（㋐㋑㋒㋓）
#   内側 2(左上) 8(右上) 3(右) 1(右下) 5(左下) 7(左)
# 六芒星は「外の頂点2つ＋内の頂点2つ」が一直線に並ぶ。外半径 R、内半径 R/√3 で必ずそろう
def _star_svg():
    cx, cy, R = 124.0, 122.0, 96.0
    r = R / math.sqrt(3.0)

    def P(deg, rad):
        a = math.radians(deg)
        return (cx + rad * math.cos(a), cy - rad * math.sin(a))

    outer = {"上": 90, "右上": 30, "右下": -30, "下": -90, "左下": -150, "左上": 150}
    inner = {"左上": 120, "右上": 60, "右": 0, "右下": -60, "左下": -120, "左": 180}
    # 2つの正三角形（上向き・下向き）で六芒星を描く
    tri1 = [P(outer[k], R) for k in ("上", "右下", "左下")]
    tri2 = [P(outer[k], R) for k in ("下", "左上", "右上")]
    body = []
    for tri in (tri1, tri2):
        body.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="1.6"/>'
                    % (" ".join("%.1f,%.1f" % p for p in tri), GRAY))
    marks = [("上", "6", INK), ("下", "10", INK),
             ("左上", "㋐", RED), ("右上", "㋑", RED), ("左下", "㋒", RED), ("右下", "㋓", RED)]
    for k, s, c in marks:
        x, y = P(outer[k], R)
        body.append('<circle cx="%.1f" cy="%.1f" r="13" fill="#fff" stroke="%s" stroke-width="1.8"/>'
                    % (x, y, c))
        body.append(_t("%.1f" % x, "%.1f" % (y + 5), s, c, 14, bold=True))
    for k, s in (("左上", "2"), ("右上", "8"), ("右", "3"), ("右下", "1"), ("左下", "5"), ("左", "7")):
        x, y = P(inner[k], r)
        body.append('<circle cx="%.1f" cy="%.1f" r="13" fill="#f8f9ff" stroke="%s" stroke-width="1.8"/>'
                    % (x, y, BLUE))
        body.append(_t("%.1f" % x, "%.1f" % (y + 5), s, INK, 14, bold=True))
    # ★下の〇（cy=218・半径13）の真下に置く。前は y=238 で丸に食いこんでいた（実測 2026-08-09）
    body.append(_t(124, 248, "一直線にならんだ4つの数の和が、6本とも同じ", GRAY, 11))
    return _svg(248, 258, "\n".join(body))


# ── HG-1903 木のならび ────────────────────────────────
def _trees_svg():
    body = ['<line x1="14" y1="96" x2="286" y2="96" stroke="%s" stroke-width="2"/>' % GRAY]
    xs = [40, 68, 96, 124, 176, 204, 232, 260]
    for i, x in enumerate(xs):
        body.append('<line x1="%d" y1="96" x2="%d" y2="74" stroke="%s" stroke-width="2"/>' % (x, x, GREEN))
        body.append('<circle cx="%d" cy="66" r="9" fill="#eafaf3" stroke="%s" stroke-width="1.6"/>'
                    % (x, GREEN))
    body.append(_t(150, 74, "……", GRAY, 16))
    body.append(_t(26, 112, "A", INK, 13, bold=True))
    body.append(_t(276, 112, "B", INK, 13, bold=True))
    body.append(_t(76, 34, "Aから 2本おきに 赤ひも →", RED, 11, anchor="start"))
    body.append(_t(224, 132, "← Bから 3本おきに 青ひも", BLUE, 11, anchor="end"))
    return _svg(300, 146, "\n".join(body))


# ── HG-1905 積の魔方陣（3×3。100は上の段のまん中） ─────────────
def _magic_svg():
    cells = [["ア", "100", "イ"], ["ウ", "エ", "オ"], ["カ", "キ", "ク"]]
    body = []
    for r in range(3):
        for c in range(3):
            x, y = 30 + c * 62, 20 + r * 56
            s = cells[r][c]
            fill = "#fff7f0" if s == "100" else ("#f8f9ff" if s != "ウ" else "#eafaf3")
            body.append('<rect x="%d" y="%d" width="62" height="56" fill="%s" stroke="%s" stroke-width="1.6"/>'
                        % (x, y, fill, GRAY))
            body.append(_t(x + 31, y + 35, s, INK if s != "ウ" else GREEN, 17, bold=True))
    body.append(_t(123, 214, "たて・横・ななめの 3この 積が どれも 1000", GRAY, 11))
    return _svg(246, 228, "\n".join(body))


# ── HG-1906 78の筆算（4回で回文になる例） ────────────────────
def _kaibun_svg():
    rows = [("78", "87", "165"), ("165", "561", "726"),
            ("726", "627", "1353"), ("1353", "3531", "4884")]
    body = []
    # ★4行目だけ太字で長いので、回数のラベルとぶつかる。式の中心を右へ寄せて逃がす（実測 2026-08-09）
    for i, (a, b, s) in enumerate(rows):
        y = 26 + i * 46
        body.append(_t(150, y, "%s ＋ %s ＝ %s" % (a, b, s), INK if i < 3 else GREEN, 15,
                       bold=(i == 3)))
        body.append(_t(8, y, "%d回目" % (i + 1), GRAY, 10, anchor="start"))
    body.append(_t(134, 214, "4884 は 前から読んでも 後ろから読んでも 同じ", GREEN, 11))
    return _svg(268, 228, "\n".join(body))


D = [
    {
        "id": "hd3n_02_1", "src": "HG-1901", "star": 2,
        "title": "星形の魔方陣（1〜12）", "category": "kazu", "unit": "数の性質",
        "intro": "下の図は、1から12までの整数をそれぞれ一回だけ使って、六角形の星形にならべ、"
                 "一直線にならんだ4つの数の和がすべて等しくなるようにしたものです。"
                 "㋐㋑㋒㋓には、まだ数が入っていません。",
        "svg": _star_svg(),
        "steps": [
            {"question": "一直線にならんだ4つの数の和はいくつですか。", "answer": "26",
             "meaning": "まだ使っていない数は 4・9・11・12 で、合計36です。"
                        "㋒は（和−15）、㋓は（和−17）、㋐は（和−22）、㋑は（和−14）と書けるので、"
                        "4つ足すと（和×4−68）＝36。よって和は26です。"},
            {"question": "㋐（左上）にあてはまる数はいくつですか。", "answer": "4",
             "meaning": "㋐は 7・5・10 とならぶ直線にあるので、26−7−5−10＝4です。"},
            {"question": "㋑（右上）にあてはまる数はいくつですか。", "answer": "12",
             "meaning": "㋑は 3・1・10 とならぶ直線にあるので、26−3−1−10＝12です。"},
            {"question": "㋒（左下）にあてはまる数はいくつですか。", "answer": "11",
             "meaning": "㋒は 6・2・7 とならぶ直線にあるので、26−6−2−7＝11です。"},
            {"question": "㋓（右下）にあてはまる数はいくつですか。", "answer": "9",
             "meaning": "㋓は 6・8・3 とならぶ直線にあるので、26−6−8−3＝9です。"
                        "残りの直線も 4+2+8+12＝26、11+5+1+9＝26 で合っています。"},
        ],
    },
    {
        "id": "hd3n_02_2", "src": "HG-1902", "star": 2,
        "title": "さいころ3こ・うらの積", "category": "kazu", "unit": "数の性質",
        "intro": "さいころは向かい合った面の数の和が7になるようにつくってあります。"
                 "3このさいころを投げたら、出た目の数の積（かけ算のこたえ）が36になりました。"
                 "このとき、うらの面の目の数の積は3しゅるいあります。",
        "svg": "",
        "steps": [
            {"question": "3しゅるいのうち、いちばん小さいものはいくつですか。", "answer": "6",
             "meaning": "目が 1・6・6 のとき。うらは 6・1・1 なので 6×1×1＝6です。"},
            {"question": "3しゅるいのうち、2番目に大きいものはいくつですか。", "answer": "20",
             "meaning": "目が 2・3・6 のとき。うらは 5・4・1 なので 5×4×1＝20です。"},
            {"question": "3しゅるいのうち、いちばん大きいものはいくつですか。", "answer": "48",
             "meaning": "目が 3・3・4 のとき。うらは 4・4・3 なので 4×4×3＝48です。"
                        "36＝6×6×1、6×3×2、4×3×3 の3通りしかないので、答えは3しゅるいです。"
                        "うらの積は「7×7×7−36」のようには計算できません。"
                        "向かい合う面は和が7であって、積には分けられないからです。"},
        ],
    },
    {
        "id": "hd3n_02_3", "src": "HG-1903", "star": 2,
        "title": "まん中の木に赤と青の両方がつく", "category": "tokusan", "unit": "植木算",
        "intro": "下の図のように、AからBまで何本かの木が1列にならんでいます。"
                 "これらの木に、Aからは2本おきに赤ひもをつけ、Bからは3本おきに青ひもをつけたところ、"
                 "ちょうどまん中の木には赤と青のひもがつきました。ただし、木の数は40本以下です。",
        "svg": _trees_svg(),
        "steps": [
            {"question": "「2本おき」につけるとき、赤ひもは何本ごとにつきますか。", "answer": "3",
             "meaning": "2本とばすので、1本目・4本目・7本目…＝3本ごとです。"
                        "「2本おき」を「2本ごと」と読むのが、この問題の第一の関門です。"},
            {"question": "「3本おき」につけるとき、青ひもは何本ごとにつきますか。", "answer": "4",
             "meaning": "3本とばすので4本ごとです。Bから数えて 1本目・5本目・9本目…になります。"},
            {"question": "木は全部で何本ありますか。", "answer": "25",
             "meaning": "木の数を□とすると、まん中は（□＋1）÷2 本目。"
                        "Aの条件から（□−1）÷2 が3の倍数、Bの条件から（□−1）÷2 が4の倍数。"
                        "よって（□−1）÷2 は12の倍数で、□＝25、49、73…。40本以下なので25本です。"
                        "たしかめると まん中は13本目。Aから 1・4・7・10・13 ✓、Bから 25・21・17・13 ✓。"},
        ],
    },
    {
        "id": "hd3n_02_4", "src": "HG-1904", "star": 2,
        "title": "ア〜キ・1から9までの相異なる整数", "category": "baai", "unit": "推理・論理",
        "intro": "ア, イ, ウ, エ, オ, カ, キ は、1から9までの整数のうちのいずれかです。同じ数はありません。"
                 "それらの数には次の関係があります。\n"
                 "〔1〕オ＋キ＝イ　〔2〕ウ＋カ＝ア　〔3〕エ×エ＝ア　〔4〕オ×カ＝イ",
        "svg": "",
        "steps": [
            {"question": "エにあてはまる数はいくつですか。", "answer": "3",
             "meaning": "〔3〕エ×エ＝ア で、1から9でかけて1けたになるのは 1×1・2×2＝4・3×3＝9 だけ。"
                        "エ＝1 だとアも1になって同じ数になるので、エは2か3。"
                        "エ＝2（ア＝4）だと先に進めなくなるので、エ＝3 です。"},
            {"question": "アにあてはまる数はいくつですか。", "answer": "9",
             "meaning": "エ＝3 なので、〔3〕より ア＝3×3＝9 です。"},
            {"question": "カにあてはまる数はいくつですか。", "answer": "4",
             "meaning": "〔4〕オ×カ＝イ と〔1〕オ＋キ＝イ を合わせると オ×カ＝オ＋キ。"
                        "〔2〕ウ＋カ＝9 も使うと、カ＝4・オ＝2 のときだけ全部が別の数になります。"},
            {"question": "オにあてはまる数はいくつですか。", "answer": "2",
             "meaning": "カ＝4 のとき オ×4＝オ＋キ。オ＝2 なら イ＝8、キ＝6 で成り立ちます。"},
            {"question": "ウにあてはまる数はいくつですか。", "answer": "5",
             "meaning": "〔2〕ウ＋カ＝ア より ウ＝9−4＝5 です。"
                        "答えは ア9・イ8・ウ5・エ3・オ2・カ4・キ6 で、7つとも別の数になっています。"},
        ],
    },
    {
        "id": "hd3n_02_5", "src": "HG-1905", "star": 3,
        "title": "積の魔方陣（3つの積がどれも1000）", "category": "kazu", "unit": "数の性質",
        "intro": "右の正方形のアからクまでのところに、100以外のべつべつの8この整数を入れて、"
                 "たて、横、ななめの3この整数をかけると、いずれも1000になるようにします。"
                 "ただし、アはイより小さい数とします。",
        "svg": _magic_svg(),
        "steps": [
            {"question": "エ（まん中）にあてはまる数はいくつですか。", "answer": "10",
             "meaning": "エはたて・横・ななめの3本が通るまん中です。"
                        "その3本の積をかけ合わせると エ×エ×エ＝1000 になるので、エ＝10 です。"
                        "100は上の段のまん中であって、まん中のマスではありません。ここが図の読みどころです。"},
            {"question": "アにあてはまる数はいくつですか。", "answer": "2",
             "meaning": "上の段は ア×100×イ＝1000 なので ア×イ＝10。"
                        "（1, 10）か（2, 5）ですが、1と10はキとエで使うので ア＝2、イ＝5。"
                        "「アはイより小さい」という条件で、2と5の入れかえも決まります。"},
            {"question": "キにあてはまる数はいくつですか。", "answer": "1",
             "meaning": "まん中のたての列は 100×10×キ＝1000 なので キ＝1 です。"},
            {"question": "カにあてはまる数はいくつですか。", "answer": "20",
             "meaning": "ななめの イ×エ×カ＝5×10×カ＝1000 なので カ＝20 です。"},
            {"question": "ウにあてはまる数はいくつですか。", "answer": "25",
             "meaning": "左のたての列は ア×ウ×カ＝2×ウ×20＝1000 なので ウ＝25 です。"
                        "全部そろえると ア2・イ5・ウ25・エ10・オ4・カ20・キ1・ク50 で、8本とも積が1000になります。"},
        ],
    },
    {
        "id": "hd3n_02_6", "src": "HG-1906", "star": 2,
        "title": "さかさまにしてたす（回文数）", "category": "kisoku", "unit": "規則性・数列",
        "intro": "39に、十の位と一の位を入れかえた数93をたすと 39＋93＝132 です。"
                 "この和132に数字をさかさまにならべた231をたすと363となって、"
                 "前から読んでも後ろから読んでも同じならび方の数になります。"
                 "78という数は、右のように4回のたし算でこのような数になります。",
        "svg": _kaibun_svg(),
        "steps": [
            {"question": "547に745をたすといくつですか。", "answer": "1292",
             "meaning": "547＋745＝1292。まだ前から読んでも後ろから読んでも同じにはなりません。"},
            {"question": "547は何回のたし算でこのような数になりますか。", "answer": "3",
             "meaning": "547+745＝1292 → 1292+2921＝4213 → 4213+3124＝7337。3回です。"
                        "けたが増えたら、増えたまま さかさまにするのがきまりです。"},
            {"question": "846は何回のたし算でこのような数になりますか。", "answer": "5",
             "meaning": "846+648＝1494 → 1494+4941＝6435 → 6435+5346＝11781 → "
                        "11781+18711＝30492 → 30492+29403＝59895。5回です。"},
        ],
    },
    {
        "id": "hd3n_02_7", "src": "HG-1907", "star": 1,
        "title": "めがねと虫歯・いずれかだけ", "category": "baai", "unit": "なかま調べ（集合・ベン図）",
        "intro": "ある小学校の3年生123人について、めがねをかけている人と虫歯のある人を調べました。"
                 "めがねをかけている人が56人、虫歯のある人が64人いました。"
                 "また、めがねをかけているか、虫歯があるかいずれかだけの人が90人いました。",
        "svg": "",
        "steps": [
            {"question": "めがねをかけていて、虫歯もある人は何人ですか。", "answer": "15",
             "meaning": "両方の人を□とすると、めがねだけは 56−□、虫歯だけは 64−□。"
                        "「いずれかだけ」はこの2つの合計なので 120−□×2＝90 となり、□＝15人です。"},
            {"question": "めがねをかけているか、虫歯があるかの少なくとも一方にあてはまる人は何人ですか。",
             "answer": "105",
             "meaning": "56＋64では両方の人を2回数えているので、1回分を引いて 56+64−15＝105人です。"
                        "「いずれかだけ」の90人と、この105人はちがう数です。ここが読みどころです。"},
            {"question": "めがねもかけず、虫歯もない人は何人ですか。", "answer": "18",
             "meaning": "123−105＝18人です。"
                        "内わけは めがねだけ41人・虫歯だけ49人・両方15人・どちらもなし18人で、合計123人になります。"},
        ],
    },
    {
        "id": "hd3n_02_8", "src": "HG-1908", "star": 3,
        "title": "4つの数の2つずつの和", "category": "kazu", "unit": "数の性質",
        "intro": "4つの整数ア, イ, ウ, エのうち、1つは偶数で、他の3つは奇数です。"
                 "これらの中から2つずつの和をつくったら、22, 31, 43, 54, 66, 75 となりました。",
        "svg": "",
        "steps": [
            {"question": "3つの奇数の和はいくつですか。", "answer": "71",
             "meaning": "奇数どうしの和は偶数、奇数と偶数の和は奇数です。"
                        "だから偶数の和 22・54・66 の3つが「奇数どうしの和」。"
                        "この3つを足すと、3つの奇数がそれぞれ2回ずつ数えられるので "
                        "142÷2＝71 が3つの奇数の和です。"},
            {"question": "4つの整数の和はいくつですか。", "answer": "97",
             "meaning": "6つの和を全部足すと 291。どの数も3回ずつ出てくるので 291÷3＝97 です。"
                        "4で割ってしまうまちがいに気をつけます。"},
            {"question": "偶数はいくつですか。", "answer": "26",
             "meaning": "97−71＝26 です。"},
            {"question": "もっとも大きい数と、もっとも小さい数との差はいくつですか。", "answer": "44",
             "meaning": "奇数と偶数の和 31・43・75 から26を引くと、3つの奇数は 5・17・49。"
                        "4つの数は 5・17・26・49 で、49−5＝44 です。"
                        "たしかめ 5+17=22、5+26=31、5+49=54、17+26=43、17+49=66、26+49=75 ✓"},
        ],
    },
    {
        "id": "hd3n_02_9", "src": "HG-1909", "star": 3,
        "title": "71×□ − 25×□ の階段", "category": "kazu", "unit": "数の性質",
        "intro": "次のそれぞれの□に、あてはまる整数を書きなさい。"
                 "ただし、□には1以上71以下の整数を入れなさい。\n"
                 "(1) 71×25 − 25×□ ＝ 0　(2) 71×□ − 25×17 ＝ 1\n"
                 "(3) 71×□ − 25×□ ＝ 3　(4) 71×□ − 25×□ ＝ 4　(5) 71×□ − 25×□ ＝ 5",
        "svg": "",
        "steps": [
            {"question": "(1) の□にあてはまる数はいくつですか。", "answer": "71",
             "meaning": "71×25＝25×71 なので□は71です。これが「差を0にする手」になります。"},
            {"question": "(2) の□にあてはまる数はいくつですか。", "answer": "6",
             "meaning": "71×6＝426、25×17＝425 で差は1。これが「差を1にする手」です。"},
            {"question": "(3) の左の□（71にかける数）はいくつですか。", "answer": "18",
             "meaning": "(2)の手を3倍します。6×3＝18、17×3＝51。"
                        "71×18＝1278、25×51＝1275 で差は3です。右の□は51。"},
            {"question": "(4) の左の□（71にかける数）はいくつですか。", "answer": "24",
             "meaning": "(2)の手を4倍します。6×4＝24、17×4＝68。"
                        "71×24＝1704、25×68＝1700 で差は4です。右の□は68。"},
            {"question": "(5) の左の□（71にかける数）はいくつですか。", "answer": "5",
             "meaning": "5倍すると 6×5＝30、17×5＝85 ですが、85は71をこえてしまいます。"
                        "そこで(1)の「差を0にする手」を1回引きます。30−25＝5、85−71＝14。"
                        "71×5＝355、25×14＝350 で差は5。右の□は14です。"
                        "この問題は(1)で道具Aを、(2)で道具Bをもらい、"
                        "(3)(4)はBだけ、(5)でAとBを両方使う、という並びになっています。"},
        ],
    },
]

LESSON = "2"


def main():
    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"].setdefault("3", {}).setdefault("nadago", {})
    node.setdefault("fukushu", {})

    out, bad = [], []
    for q in D:
        q = dict(q, grade=3)
        out.append(q)
        if not q.get("steps"):
            bad.append("%s：設問が無い" % q["id"])
        for i, s in enumerate(q["steps"], 1):
            if not str(s.get("answer", "")).strip():
                bad.append("%s (%d)：答えが空" % (q["id"], i))
            if not str(s.get("meaning", "")).strip():
                bad.append("%s (%d)：解説が無い" % (q["id"], i))
            a = str(s["answer"])
            if not (a.replace(".", "", 1).isdigit() or s.get("choices")):
                bad.append("%s (%d)：数字でないのに選択肢が無い（テンキーで答えられない）" % (q["id"], i))
        if not q.get("src", "").startswith("HG-"):
            bad.append("%s：出典(src)が無い" % q["id"])

    ids = [q["id"] for q in out]
    if len(set(ids)) != len(ids):
        bad.append("id が重複している")

    print("小3灘合 第%s回：大問%d本／設問%d問" % (LESSON, len(out), sum(len(q["steps"]) for q in out)))
    for q in out:
        print("  ★%d %-10s %-26s 設問%d問 図%s  (%s)"
              % (q["star"], q["id"], q["title"], len(q["steps"]),
                 "あり" if q["svg"] else "なし", q["src"]))
    print("\n【検査】")
    print("  ✓ 0件" if not bad else "\n".join("  ✗ " + b for b in bad))
    if bad:
        sys.exit(1)

    if "--write" in sys.argv:
        node["fukushu"][LESSON] = out
        with io.open(DAIMON, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        json.load(io.open(DAIMON, encoding="utf-8"))
        print("\n✓ 書きこんだ → data/hama_daimon.json（grades/3/nadago/fukushu/%s）" % LESSON)
    else:
        print("\n（--write で書きこむ）")


if __name__ == "__main__":
    main()
