# -*- coding: utf-8 -*-
"""改修前後の手組みオカンを1ピクセルずつ比べる（骨の計算を触ったので退行がないか）"""
import os, numpy as np
from PIL import Image
h = os.path.dirname(os.path.abspath(__file__))
names = ['01_front','02_front34','03_side','04_back','05_high','06_walk','07_push','08_cheer','09_sad','10_face']
worst = 0
for n in names:
    a = np.asarray(Image.open(os.path.join(h,'_shot',n+'.png')).convert('RGB'),dtype=np.int16)
    b = np.asarray(Image.open(os.path.join(h,'_shot_old',n+'.png')).convert('RGB'),dtype=np.int16)
    if a.shape != b.shape:
        print(n,'大きさがちがう',a.shape,b.shape); continue
    d = np.abs(a-b)
    print('%-12s 最大差 %3d / ちがう画素 %6d (%.3f%%)' % (n, d.max(), (d.max(axis=2)>8).sum(), (d.max(axis=2)>8).mean()*100))
    worst = max(worst, d.max())
print('')
print('★全体の最大差:', worst, '（0なら完全に同じ）')
