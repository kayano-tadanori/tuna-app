# -*- coding: utf-8 -*-
"""import_okan_glb.py が作った中間データを絵にして、目で確かめる。

  描くもの（横に4枚）：
    ① 立ち姿・テクスチャつき（正面）
    ② 骨の重みの色分け（青=胴／赤=腕／紫=混ざり／緑=脚／黄=頭）
       ★これがいちばん診断に効く。裾が赤くなっていたら胴と腕の切り分けが失敗している
    ③ 骨を動かした姿（腕を前後に振る・脚を開く・頭をかしげる）— 正面
    ④ 同じポーズを横から — 肩が折れていないか見る

  使い方：
    python tools/preview_okan.py
"""
import os, sys, io, math
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, '_import')
BONE = dict(ROOT=0, TORSO=1, HEAD=2, ALU=3, ALF=4, ARU=5, ARF=6, LL=7, LR=8, CHI=9)


# ------------------------------------------------------------ 行列の道具
def ident():
    return np.eye(4)


def rot_about(pivot, axis, ang):
    """支点まわりの回転。T(p) · R · T(-p)"""
    a = np.asarray(axis, dtype=float)
    a = a / (np.linalg.norm(a) or 1)
    c, s, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    x, y, z = a
    R = np.array([
        [c + x*x*C,   x*y*C - z*s, x*z*C + y*s, 0],
        [y*x*C + z*s, c + y*y*C,   y*z*C - x*s, 0],
        [z*x*C - y*s, z*y*C + x*s, c + z*z*C,   0],
        [0, 0, 0, 1]])
    T1, T2 = np.eye(4), np.eye(4)
    T1[:3, 3] = pivot
    T2[:3, 3] = -np.asarray(pivot, dtype=float)
    return T1 @ R @ T2


def pose_bones(rig, amount=1.0):
    """歩いて押しているときっぽい姿勢。骨がちゃんと効いているかを見るためのもの。"""
    B = [ident() for _ in range(10)]
    sh_L, sh_R = rig['shoulder_L'], rig['shoulder_R']
    B[BONE['ALU']] = rot_about(sh_L, [1, 0, 0], math.radians(-38 * amount))
    B[BONE['ARU']] = rot_about(sh_R, [1, 0, 0], math.radians(+34 * amount))
    B[BONE['ALF']] = B[BONE['ALU']]         # ひじは今回まわさない（肩の見え方を見たいので）
    B[BONE['ARF']] = B[BONE['ARU']]
    B[BONE['LL']] = rot_about(rig['leg_L'], [1, 0, 0], math.radians(+26 * amount))
    B[BONE['LR']] = rot_about(rig['leg_R'], [1, 0, 0], math.radians(-22 * amount))
    head = rot_about(rig['head_pivot'], [0, 0, 1], math.radians(7 * amount))
    B[BONE['HEAD']] = head
    B[BONE['CHI']] = head
    return B


def skin(pos, nrm, bone, B):
    """aBone.x/y と .z/w の2本を混ぜる ＝ シェーダと同じ計算。"""
    n = len(pos)
    out_p = np.zeros_like(pos)
    out_n = np.zeros_like(nrm)
    p4 = np.concatenate([pos, np.ones((n, 1))], axis=1)
    for slot in (0, 2):
        w = bone[:, slot + 1]
        if not np.any(w > 0):
            continue
        b = np.round(bone[:, slot]).astype(int)
        for bi in np.unique(b):
            m = (b == bi) & (w > 0)
            if not np.any(m):
                continue
            M = B[bi]
            out_p[m] += (p4[m] @ M.T)[:, :3] * w[m, None]
            out_n[m] += (nrm[m] @ M[:3, :3].T) * w[m, None]
    L = np.linalg.norm(out_n, axis=1, keepdims=True)
    L[L < 1e-9] = 1
    return out_p, out_n / L


# ------------------------------------------------------------ ラスタライザ
def render(pos, nrm, idx, S, mode, uv=None, tex=None, vcol=None, view='front'):
    img = np.full((S, S, 3), 18, dtype=np.float64)
    zb = np.full((S, S), 1e9)
    if view == 'front':
        u_, v_, d_ = pos[:, 0], pos[:, 1], -pos[:, 2]
        nn = nrm
    else:
        u_, v_, d_ = -pos[:, 2], pos[:, 1], -pos[:, 0]
        nn = np.stack([-nrm[:, 2], nrm[:, 1], nrm[:, 0]], axis=1)
    sc, ox, oy = S * 0.84, S * 0.5, S * 0.95
    X = ox + u_ * sc
    Y = oy - v_ * sc
    light = np.array([-0.40, 0.50, 0.77])
    light = light / np.linalg.norm(light)

    for t in idx.reshape(-1, 3):
        ax, ay = X[t[0]], Y[t[0]]
        bx, by = X[t[1]], Y[t[1]]
        cx, cy = X[t[2]], Y[t[2]]
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        x0 = max(0, int(math.floor(min(ax, bx, cx))))
        x1 = min(S - 1, int(math.ceil(max(ax, bx, cx))))
        y0 = max(0, int(math.floor(min(ay, by, cy))))
        y1 = min(S - 1, int(math.ceil(max(ay, by, cy))))
        if x1 < x0 or y1 < y0:
            continue
        px, py = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den
        w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            continue
        d = w0 * d_[t[0]] + w1 * d_[t[1]] + w2 * d_[t[2]]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        hit = inside & (d < sub)
        if not hit.any():
            continue
        sub[hit] = d[hit]
        n = (w0[..., None] * nn[t[0]] + w1[..., None] * nn[t[1]] + w2[..., None] * nn[t[2]])
        nl = np.linalg.norm(n, axis=2, keepdims=True)
        nl[nl < 1e-9] = 1
        lit = 0.34 + 0.66 * np.clip((n / nl) @ light, 0, 1)
        if mode == 'tex':
            tu = w0 * uv[t[0], 0] + w1 * uv[t[1], 0] + w2 * uv[t[2], 0]
            tv = w0 * uv[t[0], 1] + w1 * uv[t[1], 1] + w2 * uv[t[2], 1]
            H, W = tex.shape[:2]
            ti = np.clip((tv * H).astype(int), 0, H - 1)
            tj = np.clip((tu * W).astype(int), 0, W - 1)
            base = tex[ti, tj]
        else:
            base = (w0[..., None] * vcol[t[0]] + w1[..., None] * vcol[t[1]] + w2[..., None] * vcol[t[2]])
        px_col = base * lit[..., None]
        dst = img[y0:y1 + 1, x0:x1 + 1]
        dst[hit] = np.clip(px_col[hit], 0, 255)
    return img


def main():
    z = np.load(os.path.join(OUTDIR, 'okan_mesh.npz'))
    pos, nrm, uv = z['pos'], z['nrm'], z['uv']
    idx, bone = z['idx'].astype(int), z['bone']
    rig = {k[4:]: z[k] for k in z.files if k.startswith('rig_')}
    tex = np.asarray(Image.open(os.path.join(OUTDIR, 'okan_tex_1024.jpg')).convert('RGB'), dtype=np.float64)

    # 重みの色分け：胴=青／腕=赤／脚=緑／頭=黄／鳥=橙
    COL = {BONE['TORSO']: (70, 130, 255), BONE['ALU']: (255, 70, 70), BONE['ARU']: (255, 70, 70),
           BONE['ALF']: (255, 150, 70), BONE['ARF']: (255, 150, 70),
           BONE['LL']: (90, 220, 110), BONE['LR']: (90, 220, 110),
           BONE['HEAD']: (240, 220, 90), BONE['CHI']: (255, 140, 220)}
    vcol = np.zeros((len(pos), 3))
    for slot in (0, 2):
        b = np.round(bone[:, slot]).astype(int)
        w = bone[:, slot + 1]
        for bi in np.unique(b):
            m = b == bi
            vcol[m] += np.array(COL.get(int(bi), (200, 200, 200))) * w[m, None]

    S = 400
    posed, nposed = skin(pos, nrm, bone, pose_bones(rig))
    tiles = [
        render(pos, nrm, idx, S, 'tex', uv=uv, tex=tex, view='front'),
        render(pos, nrm, idx, S, 'col', vcol=vcol, view='front'),
        render(posed, nposed, idx, S, 'tex', uv=uv, tex=tex, view='front'),
        render(posed, nposed, idx, S, 'tex', uv=uv, tex=tex, view='side'),
    ]
    out = np.concatenate(tiles, axis=1)
    for k in range(1, len(tiles)):
        out[:, k * S] = 110
    path = os.path.join(OUTDIR, 'preview.png')
    Image.fromarray(out.astype(np.uint8)).save(path)
    print('描きました:', path)
    print('  ①テクスチャ ②骨の重み ③動かした姿(正面) ④動かした姿(横)')


if __name__ == '__main__':
    main()
