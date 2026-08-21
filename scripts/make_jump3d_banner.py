# -*- coding: utf-8 -*-
"""scripts/make_jump3d_banner.py — チッチジャンプ3D のカード用バナーを作る

  ★tetris2 は実プレイの画から作ったが、**このゲームでは通用しなかった。**
    カードは横長（およそ4.3:1）。ゲームの画角は縦の 1.16rad で固定なので、
    横長のビューポートで撮ると **上下がそのままで横だけ広がる**＝
    チッチが豆つぶになり、左右が空っぽの絵になる（4案とも撮って確かめた）。
  → 本人が用意したキーアート（素材/チッチジャンプ3D.png）から切り出す。

  カードは**左半分にテキストが乗る**（style.css のグラデで左を暗く潰す）ので、
  ボイジャーと小惑星が右に来る帯を選んである。

  使いかた:  python scripts/make_jump3d_banner.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC  = os.path.join(ROOT, "素材", "チッチジャンプ3D.png")
OUT  = os.path.join(ROOT, "images", "jump3d-banner.png")
W, H = 1200, 280

# 切り出す帯。原画は 1672×941。
#   上 250 … ブラックホールの下半分から
#   下 640 … チッチの体とボイジャーのアンテナが入りきるところまで
TOP, BOT = 250, 640

im = Image.open(SRC).convert("RGB")
band = im.crop((0, TOP, im.width, BOT)).resize((W, H), Image.LANCZOS)
band.save(OUT)
print("かきだし:", os.path.normpath(OUT), band.size)
