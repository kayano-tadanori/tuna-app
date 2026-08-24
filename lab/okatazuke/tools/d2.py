import os, sys, numpy as np
from PIL import Image
h = os.path.dirname(os.path.abspath(__file__))
A, B = sys.argv[1], sys.argv[2]
names = ['01_front','05_high','06_walk','07_push','08_cheer','09_sad']
w=0
for n in names:
    a=np.asarray(Image.open(os.path.join(h,A,n+'.png')).convert('RGB'),dtype=np.int16)
    b=np.asarray(Image.open(os.path.join(h,B,n+'.png')).convert('RGB'),dtype=np.int16)
    d=np.abs(a-b); w=max(w,d.max())
    print('%-10s ちがう画素 %6d (%.3f%%)' % (n,(d.max(axis=2)>8).sum(),(d.max(axis=2)>8).mean()*100))
print('最大差',w)
