# -*- coding: utf-8 -*-
import os
from PIL import Image
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_shot_new')
names = ['08_cheer','07_push','06_walk','09_sad']
ims=[Image.open(os.path.join(d,n+'.png')).convert('RGB') for n in names]
h=620; ims=[i.resize((int(i.width*h/i.height),h),Image.LANCZOS) for i in ims]
W=sum(i.width for i in ims)+4*(len(ims)-1)
c=Image.new('RGB',(W,h),(40,40,44)); x=0
for i in ims: c.paste(i,(x,0)); x+=i.width+4
c.save(os.path.join(d,'poses.png'))
