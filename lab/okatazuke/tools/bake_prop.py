# -*- coding: utf-8 -*-
"""実写スキャンの GLB を「6面に焼いた低ポリの箱」にする。

★もらった GLB は 1面あたり **180万三角・4096pxのテクスチャ**（フォトグラメトリ）。
  ゲームは同じ形を300個ならべるので、そのままでは まったく載らない。
  でも 木箱もレンガも 形はほぼ立方体。
  → **6方向から色を焼いて、12三角の箱に貼る。** 見た目はほぼそのまま、重さは1万分の1。

やりかた（速さのために 面ではなく 頂点を使う）
  1. 頂点ごとに UV からテクスチャの色を引く（＝色つきの点群）
  2. 6面それぞれについて、点を その面へ 正射影して いちばん手前の色を採る
  3. すきまを うめて、6枚を1枚のアトラスにまとめる

使い方:
  python tools/bake_prop.py "G:/マイドライブ/3Dmodel/木箱 3dモデル.glb" kibako
  python tools/bake_prop.py "G:/マイドライブ/3Dmodel/3dモデル レンガキューブ.glb" renga
"""
import io
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import import_okan_glb as G  # noqa: E402

FACE = 256                      # 1面の大きさ
ATLAS_COLS, ATLAS_ROWS = 3, 2   # 6面を 3x2 に並べる
# 面の順番と、その面を見る向き（+X,-X,+Y,-Y,+Z,-Z）
FACES = [
    ('+X', np.array([1, 0, 0])), ('-X', np.array([-1, 0, 0])),
    ('+Y', np.array([0, 1, 0])), ('-Y', np.array([0, -1, 0])),
    ('+Z', np.array([0, 0, 1])), ('-Z', np.array([0, 0, -1])),
]


def load_points(path):
    """GLB → 頂点の位置と色（頂点ごとに テクスチャを引く）"""
    g, bin_ = G.read_glb(path)
    # basecolor
    bc = 0
    for m in g.get('materials', []):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            bc = g['textures'][t['index']]['source']; break
    im = g['images'][bc]
    bv = g['bufferViews'][im['bufferView']]
    off = bv.get('byteOffset', 0)
    tex = Image.open(io.BytesIO(bin_[off:off + bv['byteLength']])).convert('RGB')
    ta = np.asarray(tex)
    th, tw = ta.shape[:2]
    print('  テクスチャ %dx%d' % (tw, th))

    P, C = [], []
    for mesh in g.get('meshes', []):
        for pr in mesh['primitives']:
            pos = np.array(G.accessor(g, bin_, pr['attributes']['POSITION']),
                           dtype=np.float32).reshape(-1, 3)
            uv = np.array(G.accessor(g, bin_, pr['attributes']['TEXCOORD_0']),
                          dtype=np.float32).reshape(-1, 2)
            x = np.clip((uv[:, 0] * tw).astype(np.int32), 0, tw - 1)
            y = np.clip(((1 - uv[:, 1]) * th).astype(np.int32), 0, th - 1)
            P.append(pos); C.append(ta[y, x])
    P = np.concatenate(P); C = np.concatenate(C)
    print('  点 %d' % len(P))
    return P, C


def bake(P, C):
    """6面へ 焼く。返り値は アトラス画像。"""
    lo = P.min(axis=0); hi = P.max(axis=0)
    ctr = (lo + hi) / 2
    size = (hi - lo).max()
    Q = (P - ctr) / size + 0.5          # 0..1 の箱に入れる
    atlas = Image.new('RGB', (FACE * ATLAS_COLS, FACE * ATLAS_ROWS), (0, 0, 0))
    for k, (nm, n) in enumerate(FACES):
        ax = int(np.argmax(np.abs(n)))          # 見る軸
        sgn = 1 if n[ax] > 0 else -1
        # 画面の横・縦にする軸（右手で見た並び）
        u_ax, v_ax = [(2, 1), (2, 1), (0, 2), (0, 2), (0, 1), (0, 1)][k]
        u = Q[:, u_ax].copy(); v = Q[:, v_ax].copy(); d = Q[:, ax] * sgn
        if nm in ('+X', '-Z'):
            u = 1 - u
        if nm in ('+Y',):
            v = 1 - v
        px = np.clip((u * (FACE - 1)).astype(np.int32), 0, FACE - 1)
        py = np.clip(((1 - v) * (FACE - 1)).astype(np.int32), 0, FACE - 1)
        idx = py * FACE + px
        # いちばん手前の点だけ残す（奥行きの大きい順に書けば 最後に手前が残る）
        order = np.argsort(d)
        buf = np.zeros((FACE * FACE, 3), dtype=np.uint8)
        hit = np.zeros(FACE * FACE, dtype=bool)
        buf[idx[order]] = C[order]
        hit[idx[order]] = True
        img = Image.fromarray(buf.reshape(FACE, FACE, 3))
        # すきまを うめる
        m = Image.fromarray((hit.reshape(FACE, FACE) * 255).astype(np.uint8))
        for _ in range(3):
            blur = img.filter(ImageFilter.BoxBlur(2))
            img = Image.composite(img, blur, m)
            m = m.filter(ImageFilter.MaxFilter(5))
        atlas.paste(img, ((k % ATLAS_COLS) * FACE, (k // ATLAS_COLS) * FACE))
        print('  %s 焼いた（%d%% 当たり）' % (nm, hit.mean() * 100))
    return atlas


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    path, tag = sys.argv[1], sys.argv[2]
    print('よみこみ:', os.path.basename(path))
    P, C = load_points(path)
    atlas = bake(P, C)
    out_dir = os.path.join(HERE, '_props')
    os.makedirs(out_dir, exist_ok=True)
    prev = os.path.join(out_dir, '%s_atlas.png' % tag)
    atlas.save(prev)
    ship = os.path.join(ROOT, '%s_tex.jpg' % tag)
    atlas.save(ship, 'JPEG', quality=88, subsampling=0)
    print('かきだし: %s（%dx%d／%.0fKB）'
          % (os.path.normpath(ship), atlas.width, atlas.height,
             os.path.getsize(ship) / 1024))


if __name__ == '__main__':
    main()
