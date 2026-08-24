# -*- coding: utf-8 -*-
import os, sys, glob, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import import_okan_glb as G
SRC = r'C:\Users\User\Desktop\Claude\tuna app\素材\3Dmodel'
for path in sorted(glob.glob(os.path.join(SRC,'*.glb'))):
    g,_ = G.read_glb(path)
    prim = g['meshes'][0]['primitives'][0]
    attrs = sorted(prim['attributes'].keys())
    skins = g.get('skins', [])
    anims = g.get('animations', [])
    print('■', os.path.basename(path))
    print('   attributes:', attrs)
    print('   skins:', len(skins), ' animations:', [a.get('name') for a in anims])
    if skins:
        jn = skins[0]['joints']
        print('   骨 %d 本:' % len(jn))
        names = [g['nodes'][j].get('name','?') for j in jn]
        print('   ', names)
