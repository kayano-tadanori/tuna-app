# -*- coding: utf-8 -*-
"""findings_2.md「見送り1」の2本＝hd5s_15_1（HG-1252）と hd5s_15_5（HG-1271）を、
   現物で確定した内容に直すパッチ。_fix_s5sairei_w1_2.py とは別立て（あちらは本番適用ずみ）。

  python scripts/_fix_s5sairei_w1_2b.py [対象JSON]     （省略時 data/hama_daimon.json）

現物：Desktop\浜問題\5年算数最レ\5年最レ_復習計算テ_実力〜_No.19.pdf
      1回＝3ページ・実力＝p1〜3 なので **No.15 は PDFの46・47ページ目**（大問5＝46、大問9＝47）。
      ※この2本の出典は分冊ではなく復習テスト。分冊のNo.15は同じ骨で数値のちがう別問題だった。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う
  * 置換は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く（[[feedback_anchor_uniqueness]]）
  * **冪等**。スキップ判定は「新しい文字列がすでにあるか」を先に見る
    （置きかえ後の文字列がもとの文字列を含む“書き足し型”は、
      「古い文字列がまだある」で見ると流すたびに足し続けてしまう）
  * 図SVGは入れる前に座標を計算し直して合格を確かめる（verify_figures）
  * 書き出しはバイト（"wb"）。テキストモードだとWindowsで \\n が \\r\\n に化けて全行が差分になる
"""
import io
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

DEFAULT_JSON = os.path.join(ROOT, "data", "hama_daimon.json")


# ================================================================ 新しい図SVG
# 【hd5s_15_1／No.15 大問5】5.5px＝1cm。
#   三角形1：頂点(0,28)・A(0,0)・C(28,0)  ／ B(6,0)  ／ 斜線＝A・B・(6,22)・頂点 の台形
#   三角形2：頂点(6,22)・D(6,-6)・E(34,-6)（＝三角形1を斜辺の向きに(6,-6)ずらしたもの）
#   四角形BDEC＝B(6,0)・D(6,-6)・E(34,-6)・C(28,0)
SVG_15_1 = (
    '<svg viewBox="0 0 250 232" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="30,175 63,175 63,54 30,21" fill="rgba(138,92,255,0.30)" stroke="none"/>'
    '<polygon points="63,175 63,208 217,208 184,175" fill="rgba(255,107,107,0.16)" stroke="none"/>'
    '<path d="M30 21 L30 175 L184 175 Z" fill="none" stroke="#1a2340" stroke-width="1.8"/>'
    '<path d="M63 54 L63 208 L217 208 Z" fill="none" stroke="#4f7cff" stroke-width="1.8"/>'
    '<path d="M30 165 L40 165 L40 175" fill="none" stroke="#1a2340" stroke-width="1.1"/>'
    '<path d="M63 198 L73 198 L73 208" fill="none" stroke="#4f7cff" stroke-width="1.1"/>'
    '<path d="M100 44 L52 86" stroke="#8a5cff" stroke-width="0.9"/>'
    '<text x="135" y="40" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#8a5cff">斜線 150cm²</text>'
    '<text x="46" y="169" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#1a2340">6cm</text>'
    '<text x="124" y="169" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#1a2340">22cm</text>'
    '<text x="18" y="182" font-size="11" font-family="sans-serif" fill="#1a2340">A</text>'
    '<text x="67" y="170" font-size="11" font-family="sans-serif" fill="#1a2340">B</text>'
    '<text x="188" y="170" font-size="11" font-family="sans-serif" fill="#1a2340">C</text>'
    '<text x="48" y="206" font-size="11" font-family="sans-serif" fill="#4f7cff">D</text>'
    '<text x="221" y="205" font-size="11" font-family="sans-serif" fill="#4f7cff">E</text>'
    '<text x="125" y="226" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">合同な2枚をずらす（Cは相手の斜辺の上）</text>'
    '</svg>'
)

# 【hd5s_15_5／No.15 大問9】8px＝1cm。
#   B(95,208)・C(175,208)・F(135,112)＝斜線の三角形（BF＝FC＝13cm・底辺10cm・高さ12cm）
#   A・G・D・E は紙のうで。A-B-C-D＝39cm（紙の長さ）／AG＝DE＝12cm（紙の幅）
#   ※うでの長さは現物も模式図（現物のAGを実測すると約9cm）。三角形と紙の寸法だけ厳密に取った。
SVG_15_5 = (
    '<svg viewBox="0 0 275 245" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="13.3,125.6 95,208 175,208 256.7,125.6 188.5,58 135,112 81.5,58" '
    'fill="rgba(79,124,255,0.10)" stroke="#1a2340" stroke-width="2.6" stroke-linejoin="round"/>'
    '<polygon points="95,208 135,112 175,208" fill="rgba(255,107,107,0.30)" stroke="none"/>'
    '<path d="M95 208 L135 112" stroke="#1a2340" stroke-width="1.3"/>'
    '<path d="M135 112 L175 208" stroke="#1a2340" stroke-width="1.3"/>'
    '<path d="M135 112 L135 208" stroke="#6c7086" stroke-width="1.1" stroke-dasharray="4 3"/>'
    '<path d="M127 200 L135 200 L135 208" fill="none" stroke="#6c7086" stroke-width="1"/>'
    '<path d="M86 153 L110 163" stroke="#6c7086" stroke-width="0.9"/>'
    '<text x="72" y="150" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#1a2340">13cm</text>'
    '<text x="146" y="166" font-size="9" text-anchor="middle" font-family="sans-serif" fill="#1a2340">12cm</text>'
    '<text x="115" y="222" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#1a2340">5cm</text>'
    '<text x="2" y="122" font-size="11" font-family="sans-serif" fill="#1a2340">A</text>'
    '<text x="86" y="224" font-size="11" font-family="sans-serif" fill="#1a2340">B</text>'
    '<text x="178" y="224" font-size="11" font-family="sans-serif" fill="#1a2340">C</text>'
    '<text x="260" y="122" font-size="11" font-family="sans-serif" fill="#1a2340">D</text>'
    '<text x="192" y="52" font-size="11" font-family="sans-serif" fill="#1a2340">E</text>'
    '<text x="130" y="100" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#1a2340">F</text>'
    '<text x="72" y="52" font-size="11" font-family="sans-serif" fill="#1a2340">G</text>'
    '<text x="137" y="240" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">太線でかこまれた図形ABCDEFG</text>'
    '</svg>'
)


# ================================================== 図の検算（入れる前に必ず通す）
def _seg(p, q):
    return (q[0] - p[0], q[1] - p[1])


def _dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def _len(u):
    return math.hypot(u[0], u[1])


def _near(a, b, tol=0.05):
    return abs(a - b) <= tol


def verify_figures(log):
    """新しい図SVGの座標を計算し直し、問題文と合うかを数値で確かめる。
    1つでも外れたらここで止める（壊れた図をデータに入れない）。"""
    ok = []

    # --- hd5s_15_1：5.5px=1cm。はみ出し2つが等しく150cm²、BD=6cm、斜辺は一直線
    s = 5.5
    A5, P5, C5, B5, P25, D5, E5 = (30, 175), (30, 21), (184, 175), (63, 175), (63, 54), (63, 208), (217, 208)
    ab, bc, ac = (B5[0] - A5[0]) / s, (C5[0] - B5[0]) / s, (C5[0] - A5[0]) / s
    leg, bd, de = (A5[1] - P5[1]) / s, (D5[1] - B5[1]) / s, (E5[0] - D5[0]) / s
    assert _near(ab, 6) and _near(bc, 22) and _near(ac, 28), "15_1 AB・BCが図と合わない"
    assert _near(leg, 28) and _near(de, ac), "15_1 縦の辺28cm・DE=ACでない"
    sha = (leg + bc) / 2 * ab           # 斜線＝台形（縦28と22、幅6）
    bdec = (bc + de) / 2 * bd           # 四角形BDEC＝台形（上底22・下底28・高さBD）
    assert _near(sha, 150) and _near(bdec, 150) and _near(bd, 6), "15_1 面積150・BD=6にならない"
    for p in (C5, P25, E5):             # 斜辺が一直線（＝斜辺の向きにずらしている）
        assert _near((p[1] - P5[1]) - (p[0] - P5[0]), 0, 0.01), "15_1 斜辺が一直線でない"
    ok.append("hd5s_15_1 AB6・BC22・AC28・縦28cm／斜線=%.0f＝四角形BDEC=%.0f cm²／BD=%.0fcm／斜辺は頂点→C→Eが一直線 ✓"
              % (sha, bdec, bd))

    # --- hd5s_15_5：8px=1cm。斜線＝二等辺三角形BFC（13・13・底辺10・高さ12）、紙は39×12
    t = 8.0
    B9, C9, F9 = (95, 208), (175, 208), (135, 112)
    A9, G9, D9, E9 = (13.3, 125.6), (81.5, 58.0), (256.7, 125.6), (188.5, 58.0)
    bc9, h9 = _len(_seg(B9, C9)) / t, (B9[1] - F9[1]) / t
    assert _near(_len(_seg(B9, F9)) / t, 13, 0.02) and _near(_len(_seg(F9, C9)) / t, 13, 0.02), "15_5 BF・FCが13cmでない"
    assert _near(bc9, 10) and _near(h9, 12), "15_5 底辺10cm・高さ12cmでない"
    assert _near((F9[0] - B9[0]) / t, 5), "15_5 高さの足までが5cmでない"
    assert _near(_len(_seg(A9, G9)) / t, 12, 0.02) and _near(_len(_seg(D9, E9)) / t, 12, 0.02), "15_5 幅AG・DEが12cmでない"
    assert _near(_dot(_seg(A9, G9), _seg(A9, B9)), 0, 3), "15_5 AGがABと直角でない"
    total = (_len(_seg(A9, B9)) + _len(_seg(B9, C9)) + _len(_seg(C9, D9))) / t
    assert _near(total, 39, 0.05), "15_5 A-B-C-Dが紙の長さ39cmにならない"
    area9 = bc9 * h9 / 2
    assert _near(area9, 60) and _near(39 * 12 - area9, 408), "15_5 斜線60cm²・太線408cm²にならない"
    ok.append("hd5s_15_5 BF=FC=13cm・底辺10cm・高さ12cm→斜線%.0fcm²／幅AG=DE=12cm／A-B-C-D=%.1fcm（紙39cm）／468−60=%.0f ✓"
              % (area9, total, 39 * 12 - area9))

    for line in ok:
        log("  [図の検算] " + line)
    return ok


# ================================================================ 置きかえ表
# ("R",  パス, もとの文字列, 置く文字列)      … 大問の中でちょうど1回だけ出ることを確かめて置く
# ("SET", パス, もとの値の目じるし, 新しい値) … 値まるごと差しかえ
EDITS = [
    # ------------------------------------------------ hd5s_15_1（HG-1252／No.15 大問5）
    ("hd5s_15_1", [
        # 図：長方形2枚＋ラベル無し → 現物どおりの「合同な直角三角形2枚」
        ("SET", "svg", ">重なり</text>", SVG_15_1),
        # 小問3：はみ出しどうしが等しい理由を書く
        ("R", "steps/2/meaning",
         "①斜線部と等しいので 150cm²。",
         "①合同な2枚から 重なりを ひいた のこりどうしなので、四角形BDEC＝斜線部＝150cm²。"),
        # 小問4：「高さ…」で切れていた文を、台形からの本当の導出に
        ("SET", "steps/3/meaning", "①四角形BDEC",
         "①四角形BDECは 台形。上底は BC＝22cm、下底 DE は AC と 同じで 6＋22＝28cm。"
         "②(22＋28)÷2＝25。③150÷25＝**6cm**。"
         "**ずらした長さ BD が AB と 同じ6cm** に なるのが この図の きれいな ところ。"),
    ]),
    # ------------------------------------------------ hd5s_15_5（HG-1271／No.15 大問9）
    ("hd5s_15_5", [
        # 図：ラベルの無い長方形＋三角形 → 現物どおりの ABCDEFG（斜線＝三角形BFC）
        ("SET", "svg", "5:12:13 なら いちばん長い辺の向かいが直角", SVG_15_5),
        # ★現物の図に合わせて言い方を直す（「もう一方は5cm」がどこか分からなかった）
        ("R", "intro",
         "BF＝13cm、高さ 12cm、もう一方は 5cm です。",
         "BF＝13cm、三角形の 高さは 12cm、B から その 足までが 5cm です。"),
        # 小問1：制作側の言い回しを子どもの言葉に
        ("R", "steps/0/meaning",
         "②そう。**リード文で道具を渡し、図の中から自分で見つけさせる**。",
         "②そう。だから 5:12:13 の 三角形を 見つけたら、いちばん長い辺の 向かいが 直角。"),
        # 小問2：幅AGの出し方を書く
        ("R", "steps/1/meaning", "①5:12:13 の 12 にあたる。②12cm。",
         "①BF＝13cm、B から 高さの 足までが 5cm。②5×5＋□×□＝13×13 なので □＝12cm。③この 12cm が 紙の 幅AG。"),
        # 小問4：「底辺と高さから」だけだった解説に数字を入れる
        ("R", "steps/3/meaning", "①底辺と高さから 60cm²。",
         "①斜線部は 三角形BFC。折り返しなので BF＝FC＝13cm の 二等辺三角形。"
         "②底辺BC＝5×2＝10cm、高さ12cm。③10×12÷2＝60cm²（5:12:13 の 直角三角形2つぶん）。"),
    ]),
]


# ================================================================ 当てる
def _get_holder(x, path):
    """パス（"svg" / "steps/3/meaning"）から (入れ物dict, キー) を返す。"""
    parts = path.split("/")
    if len(parts) == 1:
        return x, parts[0]
    assert parts[0] == "steps" and len(parts) == 3, "パスの形がおかしい: " + path
    i = int(parts[1])
    steps = x.get("steps") or []
    assert i < len(steps), "小問 %d が無い（%s）" % (i, path)
    return steps[i], parts[2]


def apply_edits(x, edits):
    changed = 0
    for kind, path, old, new in edits:
        holder, key = _get_holder(x, path)
        cur = holder.get(key, "")
        assert isinstance(cur, str), "文字列でない項目は触らない: " + path

        if kind == "R":
            # ★まず「もう新しい文字列が入っているか」を見る。
            #   置きかえ後が もとの文字列を含む“書き足し型”は、
            #   古い文字列で判定すると流すたびに足し続けてしまう。
            if new in cur and (old not in cur or old in new):
                continue                       # すでに直っている
            if old not in cur:
                assert new in cur, "%s: もとの文字列も置きかえ後の文字列も見つからない → %r" % (path, old[:40])
                continue
            n = cur.count(old)
            assert n == 1, "%s: アンカーが %d 回出る（1回でないので置きかえない）→ %r" % (path, n, old[:40])
            holder[key] = cur.replace(old, new)
            changed += 1
        elif kind == "SET":
            if cur == new:
                continue                       # すでに直っている
            assert old in cur, "%s: 目じるし %r が見つからない（もう別物になっている）" % (path, old[:40])
            holder[key] = new
            changed += 1
        else:
            raise AssertionError("知らない種類: " + kind)
    return changed


def main(argv):
    path = os.path.abspath(argv[1] if len(argv) > 1 else DEFAULT_JSON)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + path)
    verify_figures(log)

    # ★改行コードは元ファイルに合わせる（合わせないと全行が差分になる）
    with io.open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    newline = "\r\n" if "\r\n" in raw else "\n"
    d = json.loads(raw)
    log("  改行コード: %s" % ("CRLF" if newline == "\r\n" else "LF"))

    index = {}
    for rec in iter_daimon(d):          # ★走査はここだけ（自前で入れ子を歩かない）
        x = rec["x"]
        i = x.get("id")
        if i:
            index.setdefault(i, []).append(x)

    total = 0
    touched = 0
    for did, edits in EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        c = apply_edits(hits[0], edits)
        total += c
        if c:
            touched += 1
            log("  直した %s（%s）: %d か所" % (did, hits[0].get("hg", "?"), c))
        else:
            log("  そのまま %s: 変更なし（すでに直っている）" % did)

    if total == 0:
        log("変更なし。ファイルは書きかえない。")
        return 0

    # ★バイトで書く（テキストモードだとWindowsで \n が \r\n に化けて全行が差分になる）
    text = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if newline != "\n":
        text = text.replace("\n", newline)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))

    log("---- 書きこみ完了: 大問 %d本 / %d か所" % (touched, total))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
