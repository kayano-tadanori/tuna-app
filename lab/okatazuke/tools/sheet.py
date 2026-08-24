# -*- coding: utf-8 -*-
import os, sys
from PIL import Image
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shot_new')
names = ['01_front','05_high','06_walk','07_push','08_cheer','09_sad']
ims = [Image.open(os.path.join(d, n + '.png')).convert('RGB') for n in names]
h = 460
ims = [im.resize((int(im.width*h/im.height), h), Image.LANCZOS) for im in ims]
W = sum(i.width for i in ims) + 4*(len(ims)-1)
c = Image.new('RGB', (W, h), (40,40,44)); x=0
for im in ims:
    c.paste(im,(x,0)); x += im.width+4
p = os.path.join(d, 'sheet.png'); c.save(p)
print(p)
