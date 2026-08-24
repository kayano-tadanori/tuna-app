# -*- coding: utf-8 -*-
"""ペット（チッチ／ジェイド）を 取りこむ。

  ペットは 骨を動かさない（頭の上でゆれるだけ）ので、
  キャラのように 骨に つめかえる必要はない。全部 骨0番＝そのまま。

  大きさは 実物の体長で決める。
    チッチ … 小鳥で 体長10cm  → 0.135（いまのオカンに内蔵されていたチッチと同じ）
    ジェイド … 体長25cm       → 0.135 × 2.5

  使い方:
    python tools/import_pet_glb.py chicchi tools/_chars/chicchi.glb 0.135 --write
"""
import base64
import io
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import import_char_glb as C  # noqa: E402

TEX_SIZE = 512      # 頭の上の小さいものなので 512 で足りる


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    tag, src, height = sys.argv[1], sys.argv[2], float(sys.argv[3])
    d = C.read(src)
    P, NR = d['pos'], d['nrm']
    lo, hi = P.min(0), P.max(0)
    k = height / (hi[1] - lo[1])
    # 足もとを y=0、左右と前後の まんなかを 0 に
    ctr = (lo + hi) / 2
    P = (P - np.array([ctr[0], lo[1], ctr[2]])) * k
    print('=== %s ===' % tag)
    print('  三角 %d ／ 大きさ %.3f x %.3f x %.3f'
          % (len(d['idx']) // 3, np.ptp(P[:, 0]), np.ptp(P[:, 1]), np.ptp(P[:, 2])))

    ln = np.linalg.norm(NR, axis=1, keepdims=True)
    NR = np.where(ln > 1e-9, NR / np.maximum(ln, 1e-9), np.array([0, 1.0, 0]))
    _, inv = np.unique(np.round(P, 4), axis=0, return_inverse=True)
    inv = inv.ravel()
    sm = np.zeros((inv.max() + 1, 3))
    np.add.at(sm, inv, NR)
    sm = sm[inv]
    ln = np.linalg.norm(sm, axis=1, keepdims=True)
    onrm = np.where(ln > 1e-9, sm / np.maximum(ln, 1e-9), NR)

    n = len(P)
    bone = np.zeros((n, 4))
    bone[:, 1] = 1.0                     # 骨0番に 重み1
    col = np.ones((n, 3))
    param = np.zeros((n, 4))
    param[:, 0] = 1.0                    # 影を落とさない（頭の上なので）
    param[:, 1] = 0.06
    param[:, 2] = 1.0
    uv = d['uv'].copy()
    uv[:, 1] = 1.0 - uv[:, 1]

    if '--write' not in sys.argv:
        print('  （--write を付けると 書き出します）')
        return

    tex_name = '%s_tex.jpg' % tag
    d['tex'].resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS).save(
        os.path.join(ROOT, tex_name), 'JPEG', quality=88, subsampling=0)

    def b64(a, dt):
        return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode('ascii')

    idx = d['idx']
    i32 = n > 65535
    payload = dict(
        n=n, count=int(len(idx)), idx32=bool(i32), tex=tex_name,
        height=height,
        pos=b64(P, '<f4'), nrm=b64(NR, '<f4'), onrm=b64(onrm, '<f4'),
        uv=b64(uv, '<f4'), col=b64(col, '<f4'), param=b64(param, '<f4'),
        bone=b64(bone, '<f4'), idx=b64(idx, '<u4' if i32 else '<u2'))
    out = os.path.join(ROOT, 'js', 'pet_%s.js' % tag)
    io.open(out, 'w', encoding='utf-8').write(
        '// 自動生成（tools/import_pet_glb.py）。手で直さない。\n'
        'window.PET_MODELS = window.PET_MODELS || {};\n'
        'window.PET_MODELS.%s = %s;\n' % (tag, json.dumps(payload, ensure_ascii=False)))
    print('  かきだし js/pet_%s.js (%.0fKB) ／ %s (%.0fKB)'
          % (tag, os.path.getsize(out) / 1024, tex_name,
             os.path.getsize(os.path.join(ROOT, tex_name)) / 1024))


if __name__ == '__main__':
    main()
