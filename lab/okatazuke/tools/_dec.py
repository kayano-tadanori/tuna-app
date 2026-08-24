# -*- coding: utf-8 -*-
import os, subprocess, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import import_okan_glb as G
SRC = r'C:\Users\User\Desktop\Claude\tuna app\素材\3Dmodel'
OUT = os.path.join(HERE, '_chars')
TAG = {'オカーン':('okan2',6000), 'オットン':('otton',6000), 'タイツマン':('taitsu',6000),
       '小3男子':('g3',6000), '小5男子':('g5',6000),
       'チッチ(ペット)':('chicchi',1800), 'ジェイド(ペット)':('jade',1800)}
for path in sorted(glob.glob(os.path.join(SRC, '*.glb'))):
    nm = os.path.splitext(os.path.basename(path))[0]
    if nm not in TAG: continue
    tag, target = TAG[nm]
    out = os.path.join(OUT, tag + '.glb')
    g, bin_ = G.read_glb(path)
    tris = sum(g['accessors'][pr['indices']]['count']//3 for m in g.get('meshes',[]) for pr in m['primitives'])
    ratio = max(1e-6, target/tris)
    subprocess.run(['npx','--yes','gltfpack','-i',path,'-o',out,'-si','%.8f'%ratio,'-noq'],
                   check=True, capture_output=True, shell=(os.name=='nt'))
    g2,_ = G.read_glb(out)
    t2 = sum(g2['accessors'][pr['indices']]['count']//3 for m in g2.get('meshes',[]) for pr in m['primitives'])
    print('%-8s %d -> %d 三角' % (tag, tris, t2))
