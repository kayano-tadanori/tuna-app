# -*- coding: utf-8 -*-
import os, sys
import numpy as np
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
import import_char_glb as C
for tag in ['chicchi','jade','mei']:
    d=C.read(os.path.join(HERE,'_chars',tag+'.glb'))
    g=d['g']; skin=g['skins'][0]; joints=skin['joints']
    names=[g['nodes'][j].get('name','?') for j in joints]
    W=C.world_matrices(g); jp=np.array([W[j][:3,3] for j in joints])
    lo,hi=d['pos'].min(0),d['pos'].max(0)
    par={}
    for i,nd in enumerate(g['nodes']):
        for ch in nd.get('children',[]): par[ch]=i
    print('■',tag,' 大きさ %.2f x %.2f x %.2f'%(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]))
    # 重みの合計で 影響の大きい骨だけ
    tot=np.zeros(len(joints))
    for k in range(4):
        np.add.at(tot, d['joints'][:,k], d['wts'][:,k])
    for i in np.argsort(-tot)[:14]:
        pn = g['nodes'][par[joints[i]]].get('name','?') if joints[i] in par else '-'
        print('   %-24s 親=%-20s X%+.2f Y%+.2f Z%+.2f  重み%.0f'
              % (names[i], pn, jp[i][0],jp[i][1],jp[i][2], tot[i]))
