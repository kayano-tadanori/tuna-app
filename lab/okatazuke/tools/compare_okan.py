# -*- coding: utf-8 -*-
"""いまの手組みオカンと、Tripoから取りこんだオカンを並べて見る。"""
import os, sys, io, math
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import numpy as np
from PIL import Image
import preview_okan as PV

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_import')

z = np.load(os.path.join(OUT, 'okan_mesh.npz'))
pos, nrm, uv, idx = z['pos'], z['nrm'], z['uv'], z['idx'].astype(int)
tex = np.asarray(Image.open(os.path.join(OUT, 'okan_tex_1024.jpg')).convert('RGB'), dtype=np.float64)

# いまの写真に合わせて、うすい紫の背景に置く
S = 900
img = PV.render(pos, nrm, idx, S, 'tex', uv=uv, tex=tex, view='front')
a = Image.fromarray(img.astype(np.uint8))
# 黒い背景を紫のグラデにさしかえる
bg = Image.new('RGB', (S, S))
px = bg.load()
for y in range(S):
    t = y / S
    px_row = (int(92 + 78*t), int(62 + 58*t), int(104 + 52*t))
    for x in range(S):
        px[x, y] = px_row
arr = np.asarray(a).copy()
mask = (arr.sum(axis=2) < 70)
arr[mask] = np.asarray(bg)[mask]
new = Image.fromarray(arr)

old = Image.open(os.path.join(HERE, '_shot', '01_front.png')).convert('RGB')
old = old.crop((0, 60, old.width, old.height))          # 上の説明文を切る
h = 900
old = old.resize((int(old.width * h / old.height), h), Image.LANCZOS)
new = new.resize((int(new.width * h / new.height), h), Image.LANCZOS)

W = old.width + new.width + 6
canvas = Image.new('RGB', (W, h), (30, 30, 34))
canvas.paste(old, (0, 0))
canvas.paste(new, (old.width + 6, 0))
p = os.path.join(OUT, 'compare.png')
canvas.save(p)
print('描きました:', p, '（左＝いまの手組み／右＝Tripo取りこみ）')
