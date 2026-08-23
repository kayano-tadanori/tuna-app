# -*- coding: utf-8 -*-
"""ハチマキの前面（マーク＋「オトン学園」）の絵を作る。

★これは「ハチマキ前面を平らに展開した帯」と同じ座標の画像（1600x400 = 角度±75度）。
  bake_hachimaki.js が、この画像を頭に巻き戻して貼る。

  Tripoが作った元の絵は
    ・「学」「園」が日本語になっていない
    ・マーク＋文字ぜんぶが顔の正面から右に16度ずれている
  ので、マークだけ元の絵から抜き出して、文字は書き直し、正面に置き直す。

  元の絵の実測値（scripts/bake_hachimaki.js の unwrap モードで展開して測った）:
    マーク x434〜658 / 文字 x709〜1525 / 上下 y72〜308 / 文字色 (23,31,56)

使い方:
  python scripts/make_hachimaki_text.py [出力png] [文字列]
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(__file__)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "素材", "hachimaki_text.png")
TEXT = sys.argv[2] if len(sys.argv) > 2 else "オトン学園"
ORIG = os.path.join(HERE, "..", "素材", "hachimaki_orig_strip.png")

SW, SH = 1600, 400            # 展開帯（横=角度±75度）
DEG_PER_PX = 150.0 / SW
NOSE_DEG = -1.6               # 鼻先の角度＝顔の正面（実測）
SCALE = 0.85                  # 元の絵は横102度ぶんあって端が回り込むので少し詰める
MARK_BOX = (418, 40, 676, 345)  # 元のマークを囲む枠
TEXT_BOX = (709, 72, 1525, 308)  # 元の文字が入っていた枠
GAP = 51                      # マークと文字のあいだ
NAVY = (23, 31, 56)
FONT = "C:/Windows/Fonts/YuGothB.ttc"   # 游ゴシック Bold

# ---- マークを元の絵から抜く（白地は透明にして、墨だけ持ってくる）----
orig = Image.open(ORIG).convert("RGB")
mark = orig.crop(MARK_BOX)
mw, mh = mark.size
mark_rgba = Image.new("RGBA", (mw, mh), (0, 0, 0, 0))
sp, dp = mark.load(), mark_rgba.load()
for y in range(mh):
    for x in range(mw):
        r, g, b = sp[x, y]
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        a = max(0.0, min(1.0, (205 - lum) / 165.0))
        if a > 0:
            dp[x, y] = (r, g, b, int(round(a * 255)))

# ---- 文字を描く（元の文字の枠と同じ大きさで）----
tw0, th0 = TEXT_BOX[2] - TEXT_BOX[0], TEXT_BOX[3] - TEXT_BOX[1]
text_img = Image.new("RGBA", (tw0, th0), (0, 0, 0, 0))
td = ImageDraw.Draw(text_img)
size = 8
while size < 400:
    f = ImageFont.truetype(FONT, size + 2)
    bb = td.textbbox((0, 0), TEXT, font=f)
    if bb[3] - bb[1] > th0 or bb[2] - bb[0] > tw0:
        break
    size += 2
font = ImageFont.truetype(FONT, size)
bb = td.textbbox((0, 0), TEXT, font=font)
td.text(((tw0 - (bb[2] - bb[0])) / 2 - bb[0], (th0 - (bb[3] - bb[1])) / 2 - bb[1]),
        TEXT, font=font, fill=NAVY + (255,))
# 元のハチマキの字は枠いっぱいの縦長。ふつうに書くと横幅で頭打ちになって
# 上下がスカスカに見えるので、墨のところだけ切り出して枠いっぱいに伸ばす
ink = text_img.getbbox()
if ink:
    text_img = text_img.crop(ink).resize((tw0, th0), Image.LANCZOS)

# ---- マーク＋文字を並べて、顔の正面に来るよう置く ----
mark_s = mark_rgba.resize((round(mw * SCALE), round(mh * SCALE)), Image.LANCZOS)
text_s = text_img.resize((round(tw0 * SCALE), round(th0 * SCALE)), Image.LANCZOS)
gap = round(GAP * SCALE)
total = mark_s.width + gap + text_s.width
cx = (NOSE_DEG + 75.0) / DEG_PER_PX / SW * SW        # 正面のx座標
left = round(cx - total / 2)
cy = (TEXT_BOX[1] + TEXT_BOX[3]) / 2                 # 元の絵と同じ高さの中心

canvas = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
canvas.alpha_composite(mark_s, (left, round(cy - mark_s.height / 2)))
canvas.alpha_composite(text_s, (left + mark_s.width + gap, round(cy - text_s.height / 2)))
canvas.save(OUT)

deg = lambda x: x * DEG_PER_PX - 75
print(f"{OUT}  「{TEXT}」 {size}px x{SCALE}")
print(f"  マーク {deg(left):.1f}° 〜 {deg(left + mark_s.width):.1f}° / "
      f"文字 {deg(left + mark_s.width + gap):.1f}° 〜 {deg(left + total):.1f}°")
