# -*- coding: utf-8 -*-
"""減量でUVが壊れていないか、ピクセル単位で貼って見くらべる。"""
import io, os, sys, subprocess
import numpy as np
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import import_okan_glb as G
OUT=os.path.join(HERE,'_chars')
SRC=r'C:\Users\User\Desktop\Claude\tuna app\素材\3Dmodel\オカーン.glb'

def load(path, tsize=1024):
    g,bin_=G.read_glb(path)
    P,N,U,I,base=[],[],[],[],0
    for m in g.get('meshes',[]):
        for pr in m['primitives']:
            a=pr['attributes']
            p=np.array(G.accessor(g,bin_,a['POSITION']),np.float32).reshape(-1,3)
            P.append(p)
            N.append(np.array(G.accessor(g,bin_,a['NORMAL']),np.float32).reshape(-1,3))
            U.append(np.array(G.accessor(g,bin_,a['TEXCOORD_0']),np.float32).reshape(-1,2))
            I.append(np.array(G.accessor(g,bin_,pr['indices']),np.int64)+base); base+=len(p)
    bc=0
    for m in g.get('materials',[]):
        t=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if t is not None: bc=g['textures'][t['index']]['source']; break
    im=g['images'][bc]; bv=g['bufferViews'][im['bufferView']]; off=bv.get('byteOffset',0)
    tex=Image.open(io.BytesIO(bin_[off:off+bv['byteLength']])).convert('RGB').resize((tsize,tsize),Image.LANCZOS)
    return np.concatenate(P),np.concatenate(N),np.concatenate(U),np.concatenate(I),np.asarray(tex)

def render(P,N,U,I,ta,S=420,view='front'):
    lo,hi=P.min(0),P.max(0); ctr=(lo+hi)/2; span=(hi-lo).max()*1.06
    au,av,ad=(0,1,2) if view=='front' else (2,1,0)
    u=(P[:,au]-ctr[au])/span+0.5; v=(P[:,av]-ctr[av])/span+0.5
    px=u*(S-1); py=(1-v)*(S-1); d=P[:,ad]*(1 if view=='front' else -1)
    th,tw=ta.shape[:2]
    lit=np.clip(0.60+0.40*N[:,2 if view=='front' else 0],0.35,1.15)
    img=np.full((S,S,3),248,np.uint8); zb=np.full((S,S),-1e9,np.float32)
    for a,b,c in I.reshape(-1,3):
        x0,x1,x2=px[a],px[b],px[c]; y0,y1,y2=py[a],py[b],py[c]
        xmin,xmax=int(max(0,min(x0,x1,x2))),int(min(S-1,max(x0,x1,x2)))
        ymin,ymax=int(max(0,min(y0,y1,y2))),int(min(S-1,max(y0,y1,y2)))
        if xmin>xmax or ymin>ymax: continue
        gx,gy=np.meshgrid(np.arange(xmin,xmax+1)+0.5,np.arange(ymin,ymax+1)+0.5)
        den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(den)<1e-9: continue
        w0=((y1-y2)*(gx-x2)+(x2-x1)*(gy-y2))/den
        w1=((y2-y0)*(gx-x2)+(x0-x2)*(gy-y2))/den
        w2=1-w0-w1
        m=(w0>=0)&(w1>=0)&(w2>=0)
        if not m.any(): continue
        zz=w0*d[a]+w1*d[b]+w2*d[c]
        sub=zb[ymin:ymax+1,xmin:xmax+1]; upd=m&(zz>sub)
        if not upd.any(): continue
        uu=w0*U[a,0]+w1*U[b,0]+w2*U[c,0]; vv=w0*U[a,1]+w1*U[b,1]+w2*U[c,1]
        tx=np.clip((uu*tw).astype(np.int32),0,tw-1); ty=np.clip((vv*th).astype(np.int32),0,th-1)
        cc=ta[ty,tx].astype(np.float32)*(w0*lit[a]+w1*lit[b]+w2*lit[c])[...,None]
        sub[upd]=zz[upd]
        img[ymin:ymax+1,xmin:xmax+1][upd]=np.clip(cc[upd],0,255).astype(np.uint8)
    return Image.fromarray(img)

tests=[]
# もと（間引かず。重いので front だけ）
tests.append(('もと 97万三角', SRC))
# -sa あり（いま作ったもの）
tests.append(('-sa 6000', os.path.join(OUT,'okan2.glb')))
# -sa なし
nosa=os.path.join(OUT,'_okan2_nosa.glb')
if not os.path.exists(nosa):
    subprocess.run(['npx','--yes','gltfpack','-i',SRC,'-o',nosa,'-si','0.006','-noq'],
                   check=True,capture_output=True,shell=(os.name=='nt'))
tests.append(('-sa なし', nosa))
ims=[]
for nm,path in tests:
    P,N,U,I,ta=load(path)
    print('%-14s 三角 %d' % (nm, len(I)//3))
    ims.append(render(P,N,U,I,ta))
sheet=Image.new('RGB',(420*len(ims),420),(255,255,255))
for i,im in enumerate(ims): sheet.paste(im,(420*i,0))
sheet.save(os.path.join(OUT,'_uvtest.png')); print('→ _chars/_uvtest.png')
