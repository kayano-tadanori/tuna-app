# -*- coding: utf-8 -*-
"""渡された 3Dモデル（GLB）を、**丸ごと1つのオブジェクトのまま** 取りこむ。

★やってはいけないこと（一度やって ダメだった）：
  6方向から色を焼いて 立方体に貼る方式。
  レンガ壁も木箱も「その形とテクスチャがセットで意味を持つ」ので、
  テクスチャの一部を 別の形に貼ると 何のオブジェクトか分からなくなる。

なのでここでは
  1. gltfpack で 三角を減らす（元のUVは そのまま持っていく）
  2. 位置を 1マスに合うよう 正規化（底を y=0、幅を指定の大きさに）
  3. テクスチャは 縮小して1枚だけ持つ
  4. js/props_model.js に 書き出す（インスタンス描画でそのまま使える形）

使い方:
  python tools/import_prop_glb.py <出力タグ> <元のGLB> <目標三角数> <横幅> <高さ>
  例) python tools/import_prop_glb.py kibako "G:/…/木箱 3dモデル.glb" 1600 0.86 0.84
"""
import base64
import io
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import import_okan_glb as G  # noqa: E402

TMP = os.path.join(HERE, '_props')
TEX_SIZE = int(os.environ.get('PROP_TEX', '1024'))   # 512だと レンガの目地がつぶれた（実測）


def simplify(src, target_tris, out):
    """gltfpack で 三角を減らす。
    ★ふつうの -si は UVの継ぎ目で止まって 42,000三角から下がらない。
      -sa（継ぎ目を無視）を付けて はじめて 千の位まで落ちる。"""
    os.makedirs(TMP, exist_ok=True)
    # 元の三角数から 比を出す
    g, _ = G.read_glb(src)
    tris = sum(g['accessors'][pr['indices']]['count'] // 3
               for m in g.get('meshes', []) for pr in m['primitives'])
    ratio = max(1e-6, target_tris / tris)
    cmd = ['npx', '--yes', 'gltfpack', '-i', src, '-o', out,
           '-si', '%.8f' % ratio, '-sa', '-noq']
    subprocess.run(cmd, check=True, capture_output=True, shell=(os.name == 'nt'))
    return tris


def load(path):
    g, bin_ = G.read_glb(path)
    P, N, U, I = [], [], [], []
    base = 0
    for mesh in g.get('meshes', []):
        for pr in mesh['primitives']:
            a = pr['attributes']
            pos = np.array(G.accessor(g, bin_, a['POSITION']), dtype=np.float32).reshape(-1, 3)
            nrm = (np.array(G.accessor(g, bin_, a['NORMAL']), dtype=np.float32).reshape(-1, 3)
                   if 'NORMAL' in a else np.zeros_like(pos))
            uv = (np.array(G.accessor(g, bin_, a['TEXCOORD_0']), dtype=np.float32).reshape(-1, 2)
                  if 'TEXCOORD_0' in a else np.zeros((len(pos), 2), np.float32))
            idx = np.array(G.accessor(g, bin_, pr['indices']), dtype=np.int64)
            P.append(pos); N.append(nrm); U.append(uv); I.append(idx + base)
            base += len(pos)
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
    return (np.concatenate(P), np.concatenate(N), np.concatenate(U),
            np.concatenate(I), tex)


def main():
    if len(sys.argv) < 6:
        print(__doc__); sys.exit(1)
    tag, src, target, W, H = (sys.argv[1], sys.argv[2], int(sys.argv[3]),
                              float(sys.argv[4]), float(sys.argv[5]))
    os.makedirs(TMP, exist_ok=True)
    lod = os.path.join(TMP, '%s_lod.glb' % tag)
    print('三角を減らす（目標 %d）…' % target)
    orig = simplify(src, target, lod)
    P, N, U, I, tex = load(lod)
    print('  %d → %d 三角（頂点 %d）' % (orig, len(I) // 3, len(P)))

    # --- 1マスに合わせる（底を y=0、横幅を W、高さを H に）---
    lo = P.min(axis=0); hi = P.max(axis=0)
    span = hi - lo
    fill = '--fill' in sys.argv
    if fill:
        # ★かべは マスいっぱいに ならべたい。少し伸ばしても かまわない
        sv = np.array([W / span[0], H / span[1], W / span[2]], dtype=np.float32)
    else:
        sv = np.full(3, min(W / max(span[0], span[2]), H / span[1]), dtype=np.float32)
    P = (P - (lo + hi) / 2) * sv
    P[:, 1] += (hi[1] - lo[1]) / 2 * sv[1]     # 底を 0 へ
    print('  大きさ %.2f x %.2f x %.2f%s'
          % (span[0] * sv[0], span[1] * sv[1], span[2] * sv[2], '（マスいっぱい）' if fill else ''))

    # 法線が無い／こわれている場合は 面から作る
    if not np.isfinite(N).all() or np.abs(N).max() < 1e-6:
        N = np.zeros_like(P)
    ln = np.linalg.norm(N, axis=1, keepdims=True)
    N = np.where(ln > 1e-6, N / np.maximum(ln, 1e-9), np.array([0, 1, 0], np.float32))

    # --- テクスチャ ---
    tex = tex.resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
    tex_path = os.path.join(ROOT, '%s_tex.jpg' % tag)
    tex.save(tex_path, 'JPEG', quality=86, subsampling=0)

    # --- 書き出し ---
    def b64(a, dtype):
        return base64.b64encode(np.asarray(a, dtype=dtype).tobytes()).decode('ascii')
    idx32 = len(P) > 65535
    data = {
        'n': int(len(P)), 'count': int(len(I)), 'idx32': bool(idx32),
        'tex': '%s_tex.jpg' % tag,
        'pos': b64(P.ravel(), '<f4'), 'nrm': b64(N.ravel(), '<f4'),
        'uv': b64(U.ravel(), '<f4'),
        'idx': b64(I.ravel(), '<u4' if idx32 else '<u2'),
    }
    out_js = os.path.join(ROOT, 'js', 'prop_%s.js' % tag)
    io.open(out_js, 'w', encoding='utf-8').write(
        '// 自動生成（tools/import_prop_glb.py）。手で直さない。\n'
        '// 渡された3Dモデルを **丸ごと** 減らして取りこんだもの。\n'
        '// ★テクスチャを切り貼りして別の形に貼ってはいけない（オブジェクトの意味が消える）。\n'
        'window.PROP_%s = %s;\n' % (tag.upper(), json.dumps(data, ensure_ascii=False)))
    print('かきだし: %s（%.0fKB）／%s（%.0fKB）'
          % (os.path.basename(out_js), os.path.getsize(out_js) / 1024,
             os.path.basename(tex_path), os.path.getsize(tex_path) / 1024))


if __name__ == '__main__':
    main()
