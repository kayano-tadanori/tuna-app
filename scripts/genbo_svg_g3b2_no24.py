# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.24「植木算」の図10本（HG-4267〜4282）。

★根拠＝PDFの実物のみ。問題 PDF p46〜p49（本文p99〜102）／解答 PDF p38〜p42。

実物を見て確かめたこと：
  HG-4267 … 24mの道に4mおきの木（両はし共あり）
  HG-4269 … 90mの道、10本の木（本数だけ書かれている・かんかくは求める答え）
  HG-4270 … 32mはなれた2本の電柱の間に4mおきの木（電柱には植えない）
  HG-4272 … 円形の池のまわりに12本の木、間8mの矢じるし
  HG-4273 … 4.5mのけいじ板に40cmの絵6まい、絵と絵・絵とはしの間かくが等しい
  HG-4274 … 6.4mのけいじ板に60cmの絵5まい、両はし70cm固定
  HG-4278 … 20cmの紙を1cmののりしろで3まいつないだ図
  HG-4280 … 24mのこう堂、両はし1.25m、長いす9列・間1m
  HG-4281 … たて16cm×よこ20cmの紙。㋐＝たて方向（はば2cm）に3本切る／㋑＝横方向（はば2cm）に3本切る
  HG-4282 … 人文字「100」。「1」＝18/25/18の3段＋はば20／「0」(1つめ)＝22四方の四角で
             11(右上)・23/14(右辺2段)／連結部＝7・25・14／「0」(2つめ)＝26のたてよこ＋
             半径60mの円が2つ（内・外に矢じるし）。⚠**オトン学園には実装しない**
             （14m・32m・26mの寸法が図にしかなく、文章の数値だけでは424人にならない）

使い方: python scripts/genbo_svg_g3b2_no24.py [--write]
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import (
    LINE, HI, TX, GRAY, FILL, svg, t, ln, rect, circ, dot, poly, polyline, path,
    right_mark, leader, dim, tick_marks, selfcheck, write_genbo)

F = {}


def treerow(ox, oy, w, n, both_ends=True, label=None):
    """道と木（●）を横一列に描く。n＝木の本数。"""
    out = [ln(ox, oy, ox + w, oy, LINE, 2.4)]
    if both_ends:
        xs = [ox + w * i / (n - 1) for i in range(n)]
    else:
        xs = [ox + w * (i + 1) / (n + 1) for i in range(n)]
    for x in xs:
        out.append(circ(x, oy - 16, 11, HI, 2, FILL))
        out.append(ln(x, oy - 5, x, oy, HI, 2))
    if label:
        out += dim(ox, oy + 20, ox + w, oy + 20, label, 16, side=1)
    return out, xs


# ══ HG-4267 やさしい1：24mの道に4mおきの木（両はし） ═══════════════════════
_a, _xs = treerow(30, 130, 420, 7, True, "24m")
for _i in range(6):
    _a += dim(_xs[_i], 110, _xs[_i + 1], 110, "4m", 12, side=1)
F["HG-4267"] = svg(480, 190, _a)

# ══ HG-4269 やさしい3：90mの道、木10本（両はし共） ═══════════════════════
_b, _xs2 = treerow(30, 100, 420, 10, True, "90m")
F["HG-4269"] = svg(480, 150, _b)

# ══ HG-4270 やさしい4：32mはなれた2本の電柱、間に4mおきの木 ═══════════════
_c = [ln(60, 120, 460, 120, LINE, 2.4)]
_c += [rect(52, 60, 16, 60, GRAY, 1.6), rect(452, 60, 16, 60, GRAY, 1.6),
       t(60, 55, "電柱", TX, 12), t(460, 55, "電柱", TX, 12)]
_xs3 = [60 + 400 * (i + 1) / 8.0 for i in range(7)]
for _x in _xs3:
    _c += [circ(_x, 104, 10, HI, 1.8, FILL), ln(_x, 114, _x, 120, HI, 1.8)]
for _i in range(6):
    _c += dim(_xs3[_i], 88, _xs3[_i + 1], 88, "4m", 11, side=1)
_c += dim(60, 140, 460, 140, "32m", 16, side=1)
F["HG-4270"] = svg(520, 190, _c)

# ══ HG-4272 やさしい6：円形の池のまわりに12本の木・間8m ═══════════════════
import math as _m
_cx, _cy, _r = 150, 130, 100
_d = [circ(_cx, _cy, _r, LINE, 2)]
for _i in range(12):
    _a9 = _m.radians(90 - _i * 30)
    _x = _cx + _r * _m.cos(_a9)
    _y = _cy - _r * _m.sin(_a9)
    _d += [circ(_x, _y, 8, HI, 1.8, FILL)]
_mid = _m.radians(90 - 15)
_mx, _my = _cx + _r * _m.cos(_mid), _cy - _r * _m.sin(_mid)
_d += [t(_mx + 30, _my - 6, "8m", TX, 13, "start"),
       ln(_mx + 26, _my - 4, _mx + 6, _my + 2, GRAY, 1.1)]
F["HG-4272"] = svg(320, 280, _d)

# ══ HG-4273 やさしい7：4.5mのけいじ板に40cmの絵6まい ═══════════════════════
_e = [rect(30, 40, 420, 90, LINE, 2)]
_n, _gap_frac = 6, 1.0
_picw = 420 * 0.4 / 4.5 / 6 * 6
_picw = 420 * (0.4 / 4.5)
_total_gap = 420 - _n * _picw
_g7 = _total_gap / (_n + 1)
_x = 30 + _g7
for _i in range(_n):
    _e.append(rect(_x, 55, _picw, 60, HI, 1.8))
    _x += _picw + _g7
_e += dim(30, 40, 450, 40, "4.5m", 16, side=-1)
_e.append(t(30 + _g7 / 2 + _picw + _g7 / 2, 130, "絵と絵の間＝絵とはしの間", GRAY, 11))
F["HG-4273"] = svg(480, 150, _e)

# ══ HG-4274 やさしい8：6.4mのけいじ板・60cmの絵5まい・両はし70cm ═══════════
_f = [rect(30, 40, 460, 90, LINE, 2)]
_picw2 = 460 * (0.6 / 6.4)
_end2 = 460 * (0.7 / 6.4)
_gap2 = (460 - 2 * _end2 - 5 * _picw2) / 4
_x2 = 30 + _end2
for _i in range(5):
    _f.append(rect(_x2, 55, _picw2, 60, HI, 1.8))
    _x2 += _picw2 + _gap2
_f += dim(30, 40, 30 + _end2, 40, "70cm", 15, side=-1)
_f += dim(30 + 460 - _end2, 40, 490, 40, "70cm", 15, side=-1)
_f += dim(30, 130, 490, 130, "6.4m", 16, side=1)
F["HG-4274"] = svg(520, 150, _f)

# ══ HG-4278 むずかしい4：20cmの紙を1cmののりしろで3まいつなぐ ═══════════════
_g = []
_x3 = 30
_pw = 150
_ov = 8
for _i in range(3):
    _g.append(rect(_x3, 40, _pw, 40, HI if _i % 2 else LINE, 1.8,
                    "#3a5c96" if _i % 2 else FILL))
    _g += dim(_x3, 90, _x3 + _pw, 90, "20cm", 14, side=1)
    _x3 += _pw - _ov
_x_ov1 = 30 + _pw - _ov
_x_ov2 = 30 + 2 * (_pw - _ov)
_g += dim(_x_ov1 - 6, 40, _x_ov1 + 6, 40, "1cm", 20, side=-1)
_g += dim(_x_ov2 - 6, 40, _x_ov2 + 6, 40, "1cm", 20, side=-1)
F["HG-4278"] = svg(440, 150, _g)

# ══ HG-4280 むずかしい6：24mのこう堂・両はし1.25m・長いす9列・間1m ═══════════
_h = [ln(30, 60, 450, 60, LINE, 2.4), rect(24, 40, 10, 20, GRAY, 1.4),
      rect(446, 40, 10, 20, GRAY, 1.4)]
_end3 = 420 * (1.25 / 24)
_chairw = (420 - 2 * _end3 - 8 * (420 * (1.0 / 24))) / 9
_gap3 = 420 * (1.0 / 24)
_x4 = 30 + _end3
for _i in range(9):
    _h.append(rect(_x4, 45, _chairw, 14, HI, 1.6))
    _x4 += _chairw + _gap3
_h += dim(30, 40, 30 + _end3, 40, "1.25m", 13, side=-1)
_h += dim(30 + 420 - _end3, 40, 450, 40, "1.25m", 13, side=-1)
_h += dim(30, 78, 450, 78, "24m", 16, side=1)
F["HG-4280"] = svg(480, 100, _h)

# ══ HG-4281 チャレンジ1：たて16cm×よこ20cmの紙。㋐たて方向／㋑横方向に切る ═══
_i2 = []
_ox5, _W5, _H5 = 40, 190, 160
_i2 += [rect(_ox5, 30, _W5, _H5, LINE, 2)]
for _k in range(1, 4):
    _i2.append(ln(_ox5 + _W5 * _k / 4.0, 30, _ox5 + _W5 * _k / 4.0, 30 + _H5, HI, 1.6, "5 4"))
_i2 += dim(_ox5, 30, _ox5 + _W5, 30, "20cm", 14, side=-1)
_i2 += dim(_ox5, 30, _ox5, 30 + _H5, "16cm", 14, side=-1)
_i2.append(t(_ox5 + _W5 / 2, 120, "㋐", TX, 16))
_ox6 = 300
_i2 += [rect(_ox6, 30, _W5, _H5, LINE, 2)]
for _k in range(1, 4):
    _i2.append(ln(_ox6, 30 + _H5 * _k / 4.0, _ox6 + _W5, 30 + _H5 * _k / 4.0, HI, 1.6, "5 4"))
_i2 += dim(_ox6, 30, _ox6 + _W5, 30, "20cm", 14, side=-1)
_i2 += dim(_ox6, 30, _ox6, 30 + _H5, "16cm", 14, side=-1)
_i2.append(t(_ox6 + _W5 / 2, 120, "㋑", TX, 16))
F["HG-4281"] = svg(560, 220, _i2)

# ══ HG-4282 チャレンジ2：人文字「100」（実装しない・記録用の概形） ═══════════
_j = []
# 「1」… 縦の帯（3段18/25/18・はば20）
_j += [path("M 40 30 L 90 30 L 90 260 L 40 260 Z", LINE, 2)]
_j += [ln(40, 118, 90, 118, GRAY, 1.2, "5 4"), ln(40, 178, 90, 178, GRAY, 1.2, "5 4")]
_j += dim(30, 30, 30, 118, "18", 14, side=-1)
_j += dim(30, 118, 30, 178, "25", 14, side=-1)
_j += dim(30, 178, 30, 260, "18", 14, side=-1)
_j += dim(40, 270, 90, 270, "20", 14, side=1)
# 「0」1つめ … 22四方の四角（内側に十字、11・23/14）
_ox7 = 150
_j += [rect(_ox7, 30, 180, 220, LINE, 2),
       ln(_ox7, 140, _ox7 + 180, 140, GRAY, 1.2, "5 4"),
       ln(_ox7 + 90, 30, _ox7 + 90, 250, GRAY, 1.2, "5 4")]
_j.append(t(_ox7 + 135, 90, "11", TX, 13))
_j += dim(_ox7 + 180 + 10, 30, _ox7 + 180 + 10, 140, "23", 0, side=1)
_j += dim(_ox7 + 180 + 10, 140, _ox7 + 180 + 10, 250, "14", 0, side=1)
_j += dim(_ox7, 262, _ox7 + 180, 262, "22", 14, side=1)
# 連結の細い葉っぱ形（7・25・14）
_ox8 = 360
_j += [path("M %d 30 Q %d 140 %d 250 Q %d 140 %d 30 Z" % (_ox8, _ox8 - 14, _ox8, _ox8 + 14, _ox8),
            LINE, 1.6, FILL)]
_j += [t(_ox8 - 26, 90, "25", TX, 12, "end"), t(_ox8 + 26, 200, "14", TX, 12, "start"),
       t(_ox8 - 10, 264, "7", TX, 12)]
# 「0」2つめ … 縦長葉っぱ(26) + 円2つ(半径60)
_ox9 = 420
_j += [path("M %d 30 Q %d 140 %d 250 Q %d 140 %d 30 Z" % (_ox9, _ox9 - 16, _ox9, _ox9 + 16, _ox9),
            LINE, 1.6, FILL), t(_ox9 - 28, 90, "26", TX, 12, "end")]
_cx10, _cy10 = 500, 140
_j += [circ(_cx10, _cy10, 60, LINE, 2), circ(_cx10, _cy10, 40, GRAY, 1.4, "none"),
       t(_cx10 + 16, _cy10 + 5, "60", TX, 13)]
_cx11 = 640
_j += [circ(_cx11, _cy10, 60, LINE, 2), circ(_cx11, _cy10, 40, GRAY, 1.4, "none"),
       t(_cx11 + 16, _cy10 + 5, "60", TX, 13)]
_j.append(t(340, 300, "（単位 m）人文字「100」の概形・14/32/26mは図にしか無い", GRAY, 11))
F["HG-4282"] = svg(760, 320, _j)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    bad = selfcheck(F)
    for b in bad:
        print("⚠", b)
    if not bad:
        print("✅ 自己点検OK（%d枚）" % len(F))
    write_genbo(F, a.write, find_genbo())


if __name__ == "__main__":
    main()
