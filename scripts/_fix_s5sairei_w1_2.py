# -*- coding: utf-8 -*-
"""docs/_audit/s5sairei_w1/findings_2.md の指摘を hama_daimon.json に当てるパッチ。

  python scripts/_fix_s5sairei_w1_2.py [対象JSON]      （省略時 data/hama_daimon.json）

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う（自前で入れ子を歩かない）
  * 文字列置換は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    → [[feedback_anchor_uniqueness]]（アンカーが一意でなく72万字を壊した）
  * 何度流しても同じ結果（すでに直っていればスキップ）
  * 図SVGは入れる前に座標を計算し直して合格を確かめる（verify_figures）
    → 自分で描いたSVGは検算するまで信用しない
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
    → [[feedback_heikou_session_jouyaki]]（並行セッションの変更を消さないため滞留を最短に）
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
SVG_10_3 = (
    '<svg viewBox="0 0 240 176" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<rect x="30" y="26" width="180" height="108" fill="rgba(79,124,255,0.10)" stroke="#1a2340" stroke-width="1.8"/>'
    '<path d="M30 26 L66 134" stroke="#4f7cff" stroke-width="2"/>'
    '<path d="M30 134 L210 74" stroke="#ff6b6b" stroke-width="2"/>'
    '<polyline points="59.6,114.7 68.1,111.9 70.9,120.4" fill="none" stroke="#1a2340" stroke-width="1.2"/>'
    '<text x="11" y="84" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6c7086">9cm</text>'
    '<text x="48" y="148" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#4f7cff">3cm</text>'
    '<text x="140" y="148" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b">15cm</text>'
    '<text x="222" y="108" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b">5cm</text>'
    '<text x="120" y="166" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">2本の直線は 垂直</text>'
    '</svg>'
)

SVG_14_3 = (
    '<svg viewBox="0 0 540 74" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    + "".join(
        '<rect x="%d" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
        '<text x="%d" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">%d</text>'
        % (10 + 52 * k, 33 + 52 * k, k)
        for k in range(10)
    )
    + "".join(
        '<path d="M%d 19 L%d 37" stroke="#ff6b6b" stroke-width="2.2"/>'
        '<path d="M%d 19 L%d 37" stroke="#ff6b6b" stroke-width="2.2"/>'
        % (19 + 52 * k, 47 + 52 * k, 47 + 52 * k, 19 + 52 * k)
        for k in (4, 6, 9)
    )
    + '<text x="270" y="68" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">4と6と9を使わない</text>'
    '</svg>'
)

SVG_15_2 = (
    '<svg viewBox="0 0 210 198" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="30,36.4 170.4,36.4 170.4,130 30,130" fill="rgba(79,124,255,0.12)" stroke="#1a2340" stroke-width="1.8"/>'
    '<polygon points="30,130 116.4,166 170.4,36.4" fill="rgba(255,107,107,0.14)" stroke="#ff6b6b" stroke-width="1.4"/>'
    '<path d="M30 130 L170.4 36.4" stroke="#ff6b6b" stroke-width="2"/>'
    '<circle cx="131.4" cy="130" r="2.4" fill="#1a2340"/>'
    '<text x="20" y="32" font-size="11" font-family="sans-serif" fill="#1a2340">A</text>'
    '<text x="18" y="142" font-size="11" font-family="sans-serif" fill="#1a2340">B</text>'
    '<text x="174" y="142" font-size="11" font-family="sans-serif" fill="#1a2340">C</text>'
    '<text x="174" y="32" font-size="11" font-family="sans-serif" fill="#1a2340">D</text>'
    '<text x="120" y="176" font-size="11" font-family="sans-serif" fill="#ff6b6b">A′</text>'
    '<text x="127" y="122" font-size="11" font-family="sans-serif" fill="#1a2340">E</text>'
    '<text x="80" y="124" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">39cm</text>'
    '<text x="154" y="124" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">15cm</text>'
    '<text x="14" y="88" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6c7086">36cm</text>'
    '<text x="58" y="160" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b">36cm</text>'
    '<text x="105" y="192" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">対角線BDで折り返す</text>'
    '</svg>'
)

SVG_15_4 = (
    '<svg viewBox="0 0 236 212" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<rect x="25" y="20" width="153" height="117" fill="rgba(79,124,255,0.14)" stroke="#4f7cff" stroke-width="1.8"/>'
    '<polygon points="70,20 25,128 166.2,186.8 211.2,78.8" fill="rgba(255,107,107,0.16)" stroke="#ff6b6b" stroke-width="1.8"/>'
    '<path d="M25 137 L46.6 137" stroke="#f59e0b" stroke-width="3.4"/>'
    '<path d="M178 20 L178 65" stroke="#f59e0b" stroke-width="3.4"/>'
    '<text x="47" y="14" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">5cm</text>'
    '<text x="13" y="78" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6c7086">12cm</text>'
    '<text x="13" y="136" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6c7086">1cm</text>'
    '<text x="36" y="152" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#b45309">x</text>'
    '<text x="192" y="46" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#b45309">y</text>'
    '<text x="62" y="88" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#ff6b6b">13cm</text>'
    '<text x="118" y="205" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">同じ紙を2枚重ねる</text>'
    '</svg>'
)

# ★現物（浜問題\5年算数最レ\5年最レ_復習計算テ_実力〜_No.19.pdf のPDF46ページ目＝No.15の1枚目）
#   大問5の図をそのまま起こしたもの。5.5px＝1cm。
#   A・B・C は三角形1の底辺（AB＝6cm、BC＝22cm）／D・E は三角形2の底辺／
#   斜辺は 三角形1の頂点→C→E が一直線（＝斜辺の向きにずらしている）。
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

# ★現物（同PDFの47ページ目＝No.15の2枚目）大問9の図。8px＝1cm。
#   B・C は折り目、F は上の辺どうしが出会う点。斜線＝三角形BFC（BF＝FC＝13cm・高さ12cm・底辺10cm）。
#   ※うでの部分は現物も模式図（実物どおり A-B-C-D＝39cm、AG＝DE＝12cm になるように取った）
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

SVG_16_2 = (
    '<svg viewBox="0 0 200 190" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="20,20 20,140 140,140" fill="rgba(79,124,255,0.10)" stroke="#1a2340" stroke-width="1.8"/>'
    '<polygon points="65,95 20,140 92,140 104,104" fill="rgba(255,107,107,0.20)" stroke="none"/>'
    '<path d="M20 132 L28 132 L28 140" fill="none" stroke="#1a2340" stroke-width="1.2"/>'
    '<path d="M20 20 L92 140" stroke="#4f7cff" stroke-width="1.6"/>'
    '<path d="M20 140 L65 95" stroke="#ff6b6b" stroke-width="1.6"/>'
    '<path d="M65 95 L104 104" stroke="#ff6b6b" stroke-width="1.6"/>'
    '<path d="M92 140 L104 104" stroke="#ff6b6b" stroke-width="1.6"/>'
    '<circle cx="92" cy="140" r="2.4" fill="#1a2340"/>'
    '<circle cx="104" cy="104" r="2.4" fill="#1a2340"/>'
    '<circle cx="65" cy="95" r="2.4" fill="#1a2340"/>'
    '<text x="10" y="18" font-size="11" font-family="sans-serif" fill="#1a2340">A</text>'
    '<text x="8" y="152" font-size="11" font-family="sans-serif" fill="#1a2340">B</text>'
    '<text x="142" y="152" font-size="11" font-family="sans-serif" fill="#1a2340">C</text>'
    '<text x="88" y="154" font-size="11" font-family="sans-serif" fill="#1a2340">Q</text>'
    '<text x="110" y="102" font-size="11" font-family="sans-serif" fill="#1a2340">R</text>'
    '<text x="52" y="92" font-size="11" font-family="sans-serif" fill="#1a2340">P</text>'
    '<text x="56" y="170" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">12cm</text>'
    '<text x="116" y="170" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">8cm</text>'
    '<text x="100" y="186" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">AR:RC＝7:3、AP:PQ＝5:3</text>'
    '</svg>'
)

SVG_17_3 = (
    '<svg viewBox="0 -17.8 250 197.8" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="30,150 220,150 118,24" fill="rgba(79,124,255,0.10)" stroke="#1a2340" stroke-width="1.8"/>'
    '<path d="M118 24 L106 150" stroke="#ff6b6b" stroke-width="1.6"/>'
    '<path d="M30 150 L152 66" stroke="#22c55e" stroke-width="1.6"/>'
    '<path d="M220 150 L80.3 78" stroke="#8a5cff" stroke-width="1.6"/>'
    '<circle cx="80.3" cy="78" r="2.4" fill="#8a5cff"/>'
    '<circle cx="152" cy="66" r="2.4" fill="#22c55e"/>'
    '<circle cx="106" cy="150" r="2.4" fill="#ff6b6b"/>'
    '<circle cx="111.3" cy="94" r="3" fill="#1a2340"/>'
    '<text x="24" y="164" font-size="11" font-family="sans-serif" fill="#1a2340">B</text>'
    '<text x="224" y="164" font-size="11" font-family="sans-serif" fill="#1a2340">C</text>'
    '<text x="114" y="18" font-size="11" font-family="sans-serif" fill="#1a2340">A</text>'
    '<text x="100" y="164" font-size="11" font-family="sans-serif" fill="#ff6b6b">F</text>'
    '<text x="156" y="62" font-size="11" font-family="sans-serif" fill="#22c55e">E</text>'
    '<text x="66" y="74" font-size="11" font-family="sans-serif" fill="#8a5cff">D</text>'
    '<text x="115" y="90" font-size="11" font-family="sans-serif" fill="#1a2340">P</text>'
    '<text x="125" y="-3.8" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">3本が1点で交わる</text>'
    '</svg>'
)

SVG_18_1 = (
    '<svg viewBox="0 0 250 165" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">'
    '<polygon points="30,126 170,126 220,36 80,36" fill="rgba(79,124,255,0.14)" stroke="#4f7cff" stroke-width="2"/>'
    '<path d="M173.3 36 L123.3 126" stroke="#ff6b6b" stroke-width="1.6" stroke-dasharray="4 3"/>'
    '<path d="M80 36 L170 126" stroke="#22c55e" stroke-width="1.6"/>'
    '<circle cx="173.3" cy="36" r="2.4" fill="#ff6b6b"/>'
    '<circle cx="123.3" cy="126" r="2.4" fill="#ff6b6b"/>'
    '<text x="74" y="30" font-size="11" font-family="sans-serif" fill="#1a2340">A</text>'
    '<text x="20" y="140" font-size="11" font-family="sans-serif" fill="#1a2340">B</text>'
    '<text x="172" y="140" font-size="11" font-family="sans-serif" fill="#1a2340">C</text>'
    '<text x="224" y="30" font-size="11" font-family="sans-serif" fill="#1a2340">D</text>'
    '<text x="176" y="30" font-size="11" font-family="sans-serif" fill="#ff6b6b">E</text>'
    '<text x="118" y="140" font-size="11" font-family="sans-serif" fill="#ff6b6b">F</text>'
    '<text x="125" y="159" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">AE:ED＝BF:FC＝2:1</text>'
    '</svg>'
)


# ================================================== 図の検算（入れる前に必ず通す）
def _seg(p, q):
    return (q[0] - p[0], q[1] - p[1])


def _cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


def _dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def _len(u):
    return math.hypot(u[0], u[1])


def _hit_y(p, q, y):
    """線分 p→q が y の高さを通るときの x。"""
    t = (y - p[1]) / (q[1] - p[1])
    return p[0] + (q[0] - p[0]) * t


def _hit_x(p, q, x):
    t = (x - p[0]) / (q[0] - p[0])
    return p[1] + (q[1] - p[1]) * t


def _near(a, b, tol=0.05):
    return abs(a - b) <= tol


def verify_figures(log):
    """新しい図SVGの座標を計算し直し、問題文と合うかを数値で確かめる。
    1つでも外れたらここで止める（壊れた図をデータに入れない）。"""
    ok = []

    # --- hd5s_10_3：2直線が「垂直」であること（12px=1cm）
    a1, a2 = (30, 26), (66, 134)      # 1本目：よこ3cm・たて9cm
    b1, b2 = (30, 134), (210, 74)     # 2本目：よこ15cm・たて5cm
    u, v = _seg(a1, a2), _seg(b1, b2)
    prod = (u[1] / u[0]) * (v[1] / v[0])
    assert _near(_dot(u, v), 0, 1e-9) and _near(prod, -1), "10_3 図が垂直でない"
    assert _near(abs(u[0]) / 12, 3) and _near(abs(u[1]) / 12, 9), "10_3 1本目が3:9でない"
    assert _near(abs(v[0]) / 12, 15) and _near(abs(v[1]) / 12, 5), "10_3 2本目が15:5でない"
    ok.append("hd5s_10_3 傾きの積＝%.3f（垂直）／1本目 よこ3cm・たて9cm／2本目 よこ15cm・たて5cm ✓" % prod)

    # --- hd5s_14_3：0〜9の10箱、×は4・6・9の3つ
    assert SVG_14_3.count("<rect") == 10 and SVG_14_3.count('stroke-width="2.2"') == 6, "14_3 箱か×の数がちがう"
    ok.append("hd5s_14_3 数字の箱10個（0〜9）／×は4・6・9の3か所（線6本）✓")

    # --- hd5s_15_2：折り返し（2.6px=1cm）。A′は反射像、Eは A′D と BC の交点
    B, C, D, A = (30, 130), (170.4, 130), (170.4, 36.4), (30, 36.4)
    Ad = (116.4, 166.0)   # A′
    E = (131.4, 130)
    assert _near(_len(_seg(B, A)) / 2.6, 36) and _near(_len(_seg(B, Ad)) / 2.6, 36, 0.1), "15_2 BA′≠AB"
    assert _near(_len(_seg(A, D)) / 2.6, 54) and _near(_len(_seg(Ad, D)) / 2.6, 54, 0.1), "15_2 A′D≠AD"
    assert _near(_hit_y(Ad, D, 130), E[0], 0.1), "15_2 Eが A′D 上にない"
    assert _near((E[0] - B[0]) / 2.6, 39, 0.05) and _near((C[0] - E[0]) / 2.6, 15, 0.05), "15_2 BE:EC が 39:15 でない"
    ok.append("hd5s_15_2 AB＝BA′＝36cm／AD＝A′D＝54cm／E は A′D 上／BE＝39cm・EC＝15cm ✓")

    # --- hd5s_15_4：2枚目の紙（9px=1cm）。x=2.4・y=5 が図の上で出ること
    P1, P2, P3, P4 = (70, 20), (25, 128), (211.2, 78.8), (166.2, 186.8)
    assert _near(_len(_seg(P1, P2)) / 9, 13, 0.02), "15_4 短い辺が13cmでない"
    assert _near(_len(_seg(P2, P4)) / 9, 17, 0.02), "15_4 長い辺が17cmでない"
    # 角の直角は「長さで割った値」で見る（座標を小数1けたに丸めた分のズレを吸収）
    _c1, _c2 = _seg(P1, P2), _seg(P2, P4)
    assert _near(_dot(_c1, _c2) / (_len(_c1) * _len(_c2)), 0, 0.002), "15_4 紙の角が直角でない"
    x_cm = (_hit_y(P2, P4, 137) - 25) / 9.0
    y_cm = (_hit_x(P1, P3, 178) - 20) / 9.0
    assert _near(x_cm, 2.4, 0.02) and _near(y_cm, 5.0, 0.02), "15_4 x・y が 2.4・5 にならない"
    ok.append("hd5s_15_4 短辺13cm・長辺17cm・角は直角／下の辺の x＝%.2fcm・右の辺の y＝%.2fcm ✓" % (x_cm, y_cm))

    # --- hd5s_16_2：面積（6px=1cm → 1cm²=36px²）
    def area(*pts):
        s = 0.0
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            s += p[0] * q[1] - q[0] * p[1]
        return abs(s) / 2
    A2, B2, C2 = (20, 20), (20, 140), (140, 140)
    Q, R, P = (92, 140), (104, 104), (65, 95)
    assert _near(area(A2, B2, C2) / 36, 200, 0.1), "16_2 三角形ABCが200cm²でない"
    assert _near(area(R, Q, C2) / 36, 24, 0.1), "16_2 三角形RQCが24cm²でない"
    assert _near(area(P, B2, Q, R) / 36, 66, 0.1), "16_2 四角形PBQRが66cm²でない"
    assert _near(_len(_seg(B2, Q)) / 6, 12) and _near(_len(_seg(Q, C2)) / 6, 8), "16_2 BQ:QC が 12:8 でない"
    assert _near(_len(_seg(A2, R)) / _len(_seg(R, C2)), 7 / 3.0, 0.02), "16_2 AR:RC が 7:3 でない"
    assert _near(_len(_seg(A2, P)) / _len(_seg(P, Q)), 5 / 3.0, 0.02), "16_2 AP:PQ が 5:3 でない"
    assert _near(_dot(_seg(B2, A2), _seg(B2, C2)), 0) and _near(_len(_seg(B2, A2)), _len(_seg(B2, C2))), "16_2 Bが直角二等辺でない"
    ok.append("hd5s_16_2 △ABC=200・△RQC=24・四角形PBQR=66cm²／BQ=12・QC=8／AR:RC=7:3／AP:PQ=5:3／Bは直角二等辺 ✓")

    # --- hd5s_17_3：3本のチェバ線が1点Pで交わり、比が指定どおり
    A3, B3, C3 = (118, 24), (30, 150), (220, 150)
    D3, E3, F3, P3p = (80.3, 78), (152, 66), (106, 150), (111.3, 94)
    assert _near(_len(_seg(A3, D3)) / _len(_seg(D3, B3)), 3 / 4.0, 0.02), "17_3 AD:DB が 3:4 でない"
    assert _near(_len(_seg(B3, F3)) / _len(_seg(F3, C3)), 2 / 3.0, 0.02), "17_3 BF:FC が 2:3 でない"
    assert _near(_len(_seg(A3, E3)) / _len(_seg(E3, C3)), 1 / 2.0, 0.02), "17_3 AE:EC が 1:2 でない"
    for s, t in ((A3, F3), (B3, E3), (C3, D3)):
        assert _near(_cross(_seg(s, t), _seg(s, P3p)) / _len(_seg(s, t)), 0, 0.3), "17_3 3本がPで交わらない"
    ratio = _len(_seg(A3, P3p)) / _len(_seg(P3p, F3))
    assert _near(ratio, 5 / 4.0, 0.02), "17_3 AP:PF が 5:4 でない"
    ok.append("hd5s_17_3 AD:DB=3:4／BF:FC=2:3／AE:EC=1:2／AF・BE・CD が P(111.3,94) で交わる／AP:PF=%.3f（5:4）✓" % ratio)

    # --- hd5s_18_1：EF∥AB、E・F が 2:1 の位置
    Ap, Bp, Cp, Dp = (80, 36), (30, 126), (170, 126), (220, 36)
    Ep, Fp = (173.3, 36), (123.3, 126)
    assert _near(_cross(_seg(Ep, Fp), _seg(Ap, Bp)), 0, 0.5), "18_1 EF が AB と平行でない"
    assert _near(_len(_seg(Ap, Ep)) / _len(_seg(Ep, Dp)), 2.0, 0.02), "18_1 AE:ED が 2:1 でない"
    assert _near(_len(_seg(Bp, Fp)) / _len(_seg(Fp, Cp)), 2.0, 0.02), "18_1 BF:FC が 2:1 でない"
    assert _near(_cross(_seg(Ap, Bp), _seg(Dp, Cp)), 0, 0.5), "18_1 AB と DC が平行でない"
    ok.append("hd5s_18_1 EF と AB の外積＝0（平行）／AE:ED＝2:1／BF:FC＝2:1 ✓")

    # --- hd5s_15_1：現物どおりか（5.5px=1cm）。はみ出し2つが等しく150cm²、BD=6cm
    s = 5.5
    A5, P5, C5, B5, P25, D5, E5 = (30, 175), (30, 21), (184, 175), (63, 175), (63, 54), (63, 208), (217, 208)
    ab, bc, ac = (B5[0]-A5[0])/s, (C5[0]-B5[0])/s, (C5[0]-A5[0])/s
    leg, bd, de = (A5[1]-P5[1])/s, (D5[1]-B5[1])/s, (E5[0]-D5[0])/s
    assert _near(ab, 6) and _near(bc, 22) and _near(ac, 28), "15_1 AB・BCが図と合わない"
    assert _near(leg, 28) and _near(de, ac), "15_1 縦の辺28cm・DE=ACでない"
    sha = (leg + bc) / 2 * ab          # 斜線＝台形（縦28と22、幅6）
    bdec = (bc + de) / 2 * bd          # 四角形BDEC＝台形（上底22・下底28・高さBD）
    assert _near(sha, 150) and _near(bdec, 150) and _near(bd, 6), "15_1 面積150・BD=6にならない"
    for p in (C5, P25, E5):            # 斜辺が一直線（＝斜辺の向きにずらしている）
        assert _near((p[1]-P5[1]) - (p[0]-P5[0]), 0, 0.01), "15_1 斜辺が一直線でない"
    ok.append("hd5s_15_1 AB6・BC22・AC28・縦28cm／斜線=%.0f=四角形BDEC=%.0f cm²／BD=%.0fcm／斜辺は頂点→C→Eが一直線 ✓" % (sha, bdec, bd))

    # --- hd5s_15_5：斜線＝二等辺三角形BFC（13・13・底辺10・高さ12）、紙は39×12
    t = 8.0
    B9, C9, F9 = (95, 208), (175, 208), (135, 112)
    A9, G9, D9, E9 = (13.3, 125.6), (81.5, 58.0), (256.7, 125.6), (188.5, 58.0)
    bc9, h9 = _len(_seg(B9, C9))/t, (B9[1]-F9[1])/t
    assert _near(_len(_seg(B9, F9))/t, 13, 0.02) and _near(_len(_seg(F9, C9))/t, 13, 0.02), "15_5 BF・FCが13cmでない"
    assert _near(bc9, 10) and _near(h9, 12), "15_5 底辺10cm・高さ12cmでない"
    assert _near((F9[0]-B9[0])/t, 5), "15_5 高さの足までが5cmでない"
    assert _near(_len(_seg(A9, G9))/t, 12, 0.02) and _near(_len(_seg(D9, E9))/t, 12, 0.02), "15_5 紙の幅AG・DEが12cmでない"
    assert _near(_dot(_seg(A9, G9), _seg(A9, B9)), 0, 3), "15_5 AGがABと直角でない"
    total = (_len(_seg(A9, B9)) + _len(_seg(B9, C9)) + _len(_seg(C9, D9)))/t
    assert _near(total, 39, 0.05), "15_5 A-B-C-Dが紙の長さ39cmにならない"
    area9 = bc9 * h9 / 2
    assert _near(area9, 60) and _near(39*12 - area9, 408), "15_5 斜線60cm²・太線408cm²にならない"
    ok.append("hd5s_15_5 BF=FC=13cm・底辺10cm・高さ12cm→斜線%.0fcm²／幅AG=DE=12cm／A-B-C-D=%.1fcm（紙39cm）／468−60=%.0f ✓" % (area9, total, 39*12-area9))

    # --- hd5s_17_1：足す O の位置が2本の対角線の交点であること
    Aq, Bq, Cq, Dq = (30, 120), (120, 30), (210, 80), (130, 150)
    O = (125.7, 98.7)
    for s, t in ((Aq, Cq), (Bq, Dq)):
        assert _near(_cross(_seg(s, t), _seg(s, O)) / _len(_seg(s, t)), 0, 0.3), "17_1 O が対角線の交点でない"
    ok.append("hd5s_17_1 O(125.7,98.7) は AC と BD の交点 ✓")

    for line in ok:
        log("  [図の検算] " + line)
    return ok


# ================================================================ 置きかえ表
# ("R", パス, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
# ("SET", パス, もとの文字列の一部, 新しい値ぜんぶ) … 値まるごと差しかえ
# ("ADD", インデックス or -1, {小問}) … 小問を足す（-1なら末尾）
EDITS = [
    # ---------------------------------------------------------------- 重大3
    ("hd5s_09_3", [
        ("R", "svg", ">和120</text>", ">和</text>"),
        ("R", "svg", ">差30</text>", ">差</text>"),
    ]),
    # ---------------------------------------------------------------- 中11・軽25
    ("hd5s_10_1", [
        ("R", "svg", ">甲</text>", ">A</text>"),
        ("R", "svg", ">乙</text>", ">B</text>"),
        ("R", "steps/3/meaning", "（だから「最後部」と単数で聞ける）", "（だから どちらの 最後部も 同じ 場所）"),
    ]),
    # ---------------------------------------------------------------- 中10・軽25
    ("hd5s_10_2", [
        ("R", "steps/0/question",
         "すれちがう（追いこす）あいだに 2本が 合わせて 進む 長さは 何m ですか。",
         "すれちがう ときに 2本が 合わせて 進む 長さは 何m ですか。"),
        ("R", "steps/0/meaning",
         "①どちらも **2本の長さの和**。②320＋280＝600m。",
         "①2本の長さの和だけ 進めば すれちがい終わる。②320＋280＝600m。③追いこす ときは、この600mが「合わせて」ではなく「**進んだ長さの差**」に なる。"),
        ("R", "steps/3/meaning",
         "**最後に単位換算を1回だけ挟む**のが浜学園流。",
         "③秒速を 時速に するには 3600倍して 1000でわる。"),
    ]),
    # ---------------------------------------------------------------- 重大1・重大2・軽32
    ("hd5s_10_3", [
        ("R", "steps/0/question", "1本目が たて3cm・よこ9cm の とき", "1本目が たて9cm・よこ3cm の とき"),
        ("SET", "steps/0/answer", "1", "3"),
        ("R", "steps/0/meaning", "①3:9＝1:3。②たては1。", "①9:3＝3:1。②たては3。"),
        ("R", "steps/1/meaning",
         "①たすきがけで 3:9＝□:15。②□＝15×3÷9＝5cm。",
         "①たてとよこが 入れかわるので、1本目の「よこ3・たて9」が 2本目では「たて□・よこ15」に なる。②3:9＝□:15 なので □＝15×3÷9＝5cm。"),
        ("R", "steps/2/meaning", "①1:3 なので 6÷3＝2cm。", "①2本目は たて:よこ＝1:3 なので 6÷3＝2cm。"),
        ("SET", "unit", "図形の移動・対称", "平面図形（相似・比）"),
        ("SET", "svg", "M110 134 L210 60", SVG_10_3),
    ]),
    # ---------------------------------------------------------------- 中12・軽25
    ("hd5s_11_1", [
        ("R", "intro",
         "静水での 速さが 毎時 10km の A と 毎時 14km の B が、72km はなれて",
         "静水での 速さが 毎時 10km の A が **上流**、毎時 14km の B が **下流** に いて、72km はなれて"),
        ("R", "steps/4/meaning",
         "**(1)で消した流速を(2)で取りに行く**のがこの問題。",
         "**はじめに 消えた 流れの速さを、最後に 取りに行く**のが この問題。"),
    ]),
    # ---------------------------------------------------------------- 中13・軽25
    ("hd5s_11_2", [
        ("SET", "title", "＋を ぬかすと 99a ふえる", "＋を ぬかすと 上の数の 99倍 ふえる"),
        ("R", "steps/1/question",
         "2けたの a と b の あいだの ＋ を ぬかすと 100a＋b に なります。もとの a＋b との 差は 「□×a」 です。□は いくつですか。",
         "2けたの 数を 2つ ならべて つなげると、上の数の 100倍 ＋ 下の数 に なります。つなげる前の「上の数＋下の数」と くらべると、ふえた分は 上の数の 何倍 ですか。"),
        ("R", "steps/1/meaning",
         "①(100a＋b)−(a＋b)＝99a。②□は99。",
         "①上の数を □、下の数を △ と すると、(□×100＋△)−(□＋△)＝□×99。②99倍。"),
        ("R", "steps/3/meaning", "①99×a＝3465 → a＝35。", "①99×□＝3465 → □＝35。"),
        ("R", "steps/3/meaning",
         "**等差数列にしてあるのは a が数列の項に限られるため**。",
         "ぬかした数は 数列の中の数 でなければ ならないので、35 に 決まる。"),
    ]),
    # ---------------------------------------------------------------- 重大4・中13
    ("hd5s_11_3", [
        ("R", "svg", ">237</text>", ">□</text>"),
        ("R", "svg", ">125</text>", ">△</text>"),
        ("R", "steps/1/question",
         "B の 上2けたを x、一の位を y とすると B−B′ ＝ 9×x＋y に なります。x は いくつですか。",
         "B の 上2けたを □、一の位を △ と すると B−B′ ＝ 9×□＋△ に なります。□は いくつですか。"),
        ("R", "steps/1/meaning",
         "①B＝10x＋y、B′＝x。②B−B′＝9x＋y＝113。y は 0〜9 なので x＝12、y＝5。",
         "①B＝□×10＋△、B′＝□。②B−B′＝□×9＋△＝113。△は 0〜9 なので □＝12、△＝5。"),
    ]),
    # ---------------------------------------------------------------- 中14
    ("hd5s_12_3", [
        ("R", "steps/0/question", "分数で答えなさい。", "帯分数（□と△/○）で 答えなさい。"),
        ("R", "steps/1/question", "分数で答えなさい。", "帯分数（□と△/○）で 答えなさい。"),
        ("R", "steps/2/question", "分数で答えなさい。", "帯分数（□と△/○）で 答えなさい。"),
        ("R", "steps/3/question", "分数で答えなさい。", "帯分数（□と△/○）で 答えなさい。"),
    ]),
    # ---------------------------------------------------------------- 軽24・軽25
    ("hd5s_13_3", [
        ("R", "intro",
         "C が 1回転すると B が 1目もり 進みます。",
         "C が 1回転すると B が、B が 1回転すると A が 1目もり 進みます。はじめは 0000 です。"),
        ("R", "svg", "M45 43 L58.0 50.5", "M45 43 L45.0 28.0"),
        ("R", "steps/2/meaning",
         "**回転数を聞くので3でわる一手間が入る**。",
         "**目もりの数を 3でわると 回転数に なる**。"),
    ]),
    # ---------------------------------------------------------------- 軽25
    ("hd5s_13_4", [
        ("R", "steps/1/meaning",
         "時間（60秒＝1分）と同じ骨。",
         "時間（60秒＝1分、60分＝1時間）と 同じ しくみ。"),
    ]),
    # ---------------------------------------------------------------- 中9
    ("hd5s_13_5", [
        ("R", "steps/4/meaning",
         "①216216₍₈₎＝72870、1001₍₈₎＝513。②72870÷513＝142。",
         "①216216₍₈₎＝72846、1001₍₈₎＝513。②72846÷513＝142。"),
    ]),
    # ---------------------------------------------------------------- 中15
    ("hd5s_14_1", [
        ("R", "intro",
         "ぬったマスで 数を 表し、1、2、3、7、63 の 5つの 例だけが 与えられています。",
         "ぬったマスで 数を 表します。いちばん 内がわの 1マスは 1 を 表します。"),
        ("R", "steps/1/meaning",
         "①内がわが1の位、まん中が7の位。②7。（例の「7」が手がかり）",
         "①内がわの層は 6マスまでしか ぬれないので、7に なると まん中の層へ くり上がる。②まん中の 1マスは 7。"),
        ("R", "steps/2/meaning",
         "①7×7＝49。（例の「63」＝49＋7×2 が手がかり）",
         "①まん中の層も 6マスまで。7の位が いっぱいに なると 次は 7×7＝49 の位。②49。"),
    ]),
    # ---------------------------------------------------------------- 軽30・軽25
    ("hd5s_14_3", [
        ("SET", "svg", ">4と6と9を使わない</text>", SVG_14_3),
        ("R", "steps/3/meaning",
         "**(1)は号室→番目、(2)は番目→号室で 向きも逆**。",
         "**さっきは 号室→番目、今度は 番目→号室 で 向きが 逆**。"),
    ]),
    # ---------------------------------------------------------------- 中23（★現物で確定。図を起こし、解説も導出に直す）
    ("hd5s_15_1", [
        ("SET", "svg", ">重なり</text>", SVG_15_1),
        ("SET", "steps/3/meaning", "①四角形BDEC",
         "①四角形BDECは 台形。上底は BC＝22cm、下底 DE は AC と 同じで 6＋22＝28cm。②(22＋28)÷2＝25。③150÷25＝**6cm**。**ずらした長さ BD が AB と 同じ6cm** に なるのが この図の きれいな ところ。"),
        ("R", "steps/2/meaning", "①斜線部と等しいので 150cm²。",
         "①合同な2枚から 重なりを ひいた のこりどうしなので、四角形BDEC＝斜線部＝150cm²。"),
    ]),
    # ---------------------------------------------------------------- 中19
    ("hd5s_15_2", [
        ("SET", "svg", "M26 136 L150 26 L206 90", SVG_15_2),
    ]),
    # ---------------------------------------------------------------- 中16・軽25・軽31
    ("hd5s_15_3", [
        ("R", "steps/0/question",
         "全体を 110個 として ためします。1人目は 何個 もらいますか。",
         "1人分を □個 と すると 全体は （□−1）×11 個。2人目も 同じ数に なるのは □＝11 の ときで、全体は 110個 と 決まります。1人目は 何個 もらいますか。"),
        ("R", "steps/2/meaning", "②1人目と同じ。**110個で うまくいく**。", "②1人目と同じ。**どの人も 同じ数**に なる。"),
        ("R", "steps/4/meaning",
         "②分母n なら 1人分n個・全体 n×(n−1)個・人数 n−1人。**分母を変えるだけで いくらでも作れる**。",
         "②11分の1 なら 1人分11個・全体110個・10人。"),
        ("R", "svg",
         '<text x="37.0" y="39" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#7c2d12">11</text>',
         '<text x="37.0" y="39" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#7c2d12">1人目</text>'),
        ("R", "svg",
         '<text x="101.0" y="39" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#7c2d12">11</text>',
         '<text x="101.0" y="39" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#7c2d12">2人目</text>'),
        ("R", "svg",
         '<text x="165.0" y="39" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#7c2d12">11</text>',
         '<text x="165.0" y="39" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#7c2d12">3人目</text>'),
        ("ADD", -1, {
            "question": "アメは 全部で 何個 ですか。",
            "answer": "110",
            "meaning": "①1人分11個 × 10人 ＝ 110個。②（11−1）×11＝110 でも 同じ。",
        }),
    ]),
    # ---------------------------------------------------------------- 重大5(図)・中22
    ("hd5s_15_4", [
        ("SET", "svg", "70,26 220,52 196,160 46,134", SVG_15_4),
        ("R", "steps/2/meaning",
         "①相似な三角形の 対応する辺。②5cm。",
         "①2枚目の 長い辺は「よこ12・たて5」の 向きに 進む。②上の辺の 5cm の 点から 右上の かどまでは 17−5＝12cm。③12:5 の 相似で y＝5cm。"),
        ("SET", "steps/3/meaning", "12×5÷25",
         "①左の辺の 下から1cm の 点から、よこ12・たて5 の 向きに 進んで 下の辺に 出る。②たて1 に 対して よこは 12÷5＝2.4 なので x＝2.4cm。"),
    ]),
    # ---------------------------------------------------------------- 軽25・中20・中22（★現物で確定）
    ("hd5s_15_5", [
        ("SET", "svg", "5:12:13 なら いちばん長い辺の向かいが直角", SVG_15_5),
        ("R", "steps/0/meaning",
         "②そう。**リード文で道具を渡し、図の中から自分で見つけさせる**。",
         "②そう。だから 5:12:13 の 三角形を 見つけたら、いちばん長い辺の 向かいが 直角。"),
        ("R", "steps/1/meaning", "①5:12:13 の 12 にあたる。②12cm。",
         "①BF＝13cm、B から 高さの 足までが 5cm。②5×5＋□×□＝13×13 なので □＝12cm。③この 12cm が 紙の 幅AG。"),
        ("R", "steps/3/meaning", "①底辺と高さから 60cm²。",
         "①斜線部は 三角形BFC。折り返しなので BF＝FC＝13cm の 二等辺三角形。②底辺BC＝5×2＝10cm、高さ12cm。③10×12÷2＝60cm²（5:12:13 の 直角三角形2つぶん）。"),
    ]),
    # ---------------------------------------------------------------- 重大6・中13
    ("hd5s_16_1", [
        ("R", "svg", ">白2→赤+2</text>", ">白2を とる</text>"),
        ("R", "svg", ">赤2→赤−2</text>", ">赤2を とる</text>"),
        ("R", "svg", ">差だけで決まる</text>", ">これを くりかえす</text>"),
        ("R", "steps/2/question",
         "赤2個を 取った 回数を b、白2個を 取った 回数を a とすると、赤球は 「20−2×(b−a)」個 に なります。",
         "赤2個を 取った 回数を ●、白2個を 取った 回数を ○ と すると、赤球は 「20−2×(●−○)」個 に なります。"),
        ("R", "steps/2/meaning", "①式に出てくるのは b−a だけ。", "①式に出てくるのは ●−○ だけ。"),
        ("R", "steps/3/meaning",
         "①20−2×(b−a)＝12 → 2×(b−a)＝8 → b−a＝4回。",
         "①20−2×(●−○)＝12 → 2×(●−○)＝8 → ●−○＝4回。"),
        ("R", "steps/4/meaning", "①b−a＝4、a＝6 なので b＝10回。", "①●−○＝4、○＝6 なので ●＝10回。"),
    ]),
    # ---------------------------------------------------------------- 重大7
    ("hd5s_16_2", [
        ("SET", "svg", ">BQ＝12・QC＝8</text>", SVG_16_2),
    ]),
    # ---------------------------------------------------------------- 中21・軽26
    ("hd5s_17_1", [
        ("R", "svg",
         '<text x="132" y="164" font-size="11" font-family="sans-serif" fill="#1a2340">D</text>',
         '<text x="132" y="164" font-size="11" font-family="sans-serif" fill="#1a2340">D</text>'
         '<circle cx="125.7" cy="98.7" r="2.6" fill="#1a2340"></circle>'
         '<text x="129" y="95" font-size="11" font-family="sans-serif" fill="#1a2340">O</text>'
         '<text x="152" y="112" font-size="10" text-anchor="middle" font-family="sans-serif" fill="#6c7086">100cm²</text>'),
        ("R", "steps/1/question",
         "BO:OD は いくつ対いくつ ですか。BO の 数を 答えなさい。",
         "BO:OD を いちばん かんたんな 整数の比に すると BO は いくつ ですか。"),
        ("R", "steps/4/meaning",
         "①三角形ABC−三角形OBC＝350−140＝210cm²。**面積比→長さの比→また面積比 と 3回 乗りかえる**。",
         "①三角形ABC−三角形OBC＝350−140＝210cm²。"),
        ("ADD", -1, {
            "question": "AO:OC を いちばん かんたんな 整数の比に すると AO は いくつ ですか。",
            "answer": "3",
            "meaning": "①三角形OAB と 三角形OBC は、底辺を AO と OC と 見ると 高さが 同じ。②210:140＝3:2 なので AO は 3。**面積比→長さの比→また面積比 と 3回 乗りかえた**。",
        }),
    ]),
    # ---------------------------------------------------------------- 重大5
    ("hd5s_17_2", [
        ("R", "svg", ">次男6</text>", ">次男 ③</text>"),
        ("R", "svg", ">三男2</text>", ">三男 ①</text>"),
    ]),
    # ---------------------------------------------------------------- 中18
    ("hd5s_17_3", [
        ("SET", "svg", "M62 98 L172 78", SVG_17_3),
    ]),
    # ---------------------------------------------------------------- 重大8・中17
    ("hd5s_18_1", [
        ("SET", "svg", "M110 36 L110 126", SVG_18_1),
        ("R", "steps/3/meaning",
         "**同じ図で ぬる場所を変えるだけで 1/18・1/2・1/6・2/9 と答えが変わる**。",
         "**同じ図で ぬる場所を 変えるだけで、答えが 1/2 にも 1/6 にも なる**。"),
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


def apply_edits(x, edits, log):
    changed = 0
    added = 0
    for e in edits:
        if e[0] == "ADD":
            _, at, step = e
            qs = [s.get("question") for s in x.get("steps") or []]
            if step["question"] in qs:
                continue                      # すでに足してある
            if at < 0:
                x["steps"].append(dict(step))
            else:
                x["steps"].insert(at, dict(step))
            added += 1
            changed += 1
            continue

        kind, path, old, new = e
        holder, key = _get_holder(x, path)
        cur = holder.get(key, "")
        assert isinstance(cur, str), "文字列でない項目は触らない: " + path

        if kind == "R":
            # ★置きかえ後の文字列がもとの文字列を含む「書き足し型」は、
            #   2回目も old が見つかってしまう。先に「もう入っているか」を見る。
            if new in cur and (old not in cur or old in new):
                continue                      # すでに直っている
            if old not in cur:
                assert new in cur, "%s: もとの文字列も置きかえ後の文字列も見つからない → %r" % (path, old[:40])
                continue                      # すでに直っている
            n = cur.count(old)
            assert n == 1, "%s: アンカーが %d 回出る（1回でないので置きかえない）→ %r" % (path, n, old[:40])
            holder[key] = cur.replace(old, new)
            changed += 1
        elif kind == "SET":
            if cur == new:
                continue                      # すでに直っている
            assert old in cur, "%s: 目じるし %r が見つからない（もう別物になっている）" % (path, old[:40])
            holder[key] = new
            changed += 1
        else:
            raise AssertionError("知らない種類: " + kind)
    return changed, added


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT_JSON
    path = os.path.abspath(path)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + path)
    verify_figures(log)

    # ★改行コードは元ファイルに合わせる（合わせないと全行が差分になり、
    #   並行して直している相手の変更が diff に埋もれて見えなくなる）
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

    total_changed = 0
    total_added = 0
    touched = 0
    for did, edits in EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        c, a = apply_edits(hits[0], edits, log)
        total_changed += c
        total_added += a
        if c:
            touched += 1
            log("  直した %s（%s）: %d か所%s" % (did, hits[0].get("hg", "?"), c,
                                              "・小問+%d" % a if a else ""))
        else:
            log("  そのまま %s: 変更なし（すでに直っている）" % did)

    if total_changed == 0:
        log("変更なし。ファイルは書きかえない。")
        return 0

    # ★バイトで書く（テキストモードだとWindowsで \n が勝手に \r\n に化けて全行が差分になる）
    text = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if newline != "\n":
        text = text.replace("\n", newline)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))

    log("---- 書きこみ完了: 大問 %d本 / %d か所 / 足した小問 %d問" % (touched, total_changed, total_added))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
