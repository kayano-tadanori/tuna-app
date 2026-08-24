# -*- coding: utf-8 -*-
"""よろこぶ姿勢で何が裂けているかを、重みの色分けで特定する。"""
import os, sys, io, math
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import preview_okan as PV
BONE = PV.BONE
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '_import')

z = np.load(os.path.join(OUT, 'okan_mesh.npz'))
pos, nrm, uv, idx, bone = z['pos'], z['nrm'], z['uv'], z['idx'].astype(int), z['bone']
rig = {k[4:]: z[k] for k in z.files if k.startswith('rig_')}
tex = np.asarray(Image.open(os.path.join(OUT, 'okan_tex_1024.jpg')).convert('RGB'), dtype=np.float64)

# よろこぶ＝両腕を前に60度上げる
def cheer_bones(rig, deg):
    B = [PV.ident() for _ in range(10)]
    for pv, bu, bf in ((rig['shoulder_L'], BONE['ALU'], BONE['ALF']),
                       (rig['shoulder_R'], BONE['ARU'], BONE['ARF'])):
        M = PV.rot_about(pv, [1, 0, 0], math.radians(-deg))
        B[bu] = M; B[bf] = M
    return B

COL = {BONE['TORSO']: (70,130,255), BONE['ALU']: (255,70,70), BONE['ARU']: (255,70,70),
       BONE['ALF']: (255,150,70), BONE['ARF']: (255,150,70),
       BONE['LL']: (90,220,110), BONE['LR']: (90,220,110),
       BONE['HEAD']: (240,220,90), BONE['CHI']: (255,140,220)}
vcol = np.zeros((len(pos),3))
for slot in (0,2):
    b = np.round(bone[:,slot]).astype(int); w = bone[:,slot+1]
    for bi in np.unique(b):
        m = b==bi
        vcol[m] += np.array(COL.get(int(bi),(200,200,200)))*w[m,None]

S = 430
B = cheer_bones(rig, 60)
pp, nn = PV.skin(pos, nrm, bone, B)
tiles = [PV.render(pos,nrm,idx,S,'col',vcol=vcol,view='front'),
         PV.render(pos,nrm,idx,S,'col',vcol=vcol,view='side'),
         PV.render(pp,nn,idx,S,'col',vcol=vcol,view='front'),
         PV.render(pp,nn,idx,S,'tex',uv=uv,tex=tex,view='front')]
out = np.concatenate(tiles, axis=1)
for k in range(1,len(tiles)): out[:,k*S]=110
Image.fromarray(out.astype(np.uint8)).save(os.path.join(OUT,'cheer_diag.png'))
