# -*- coding: utf-8 -*-
"""Tripo で作った **リギング済み** GLB を「オカンの おかたづけ」の形に取りこむ。

  ★import_okan_glb.py との違い
    あちらは「骨の無い1枚メッシュ」を、塊のかたちから当てずっぽうで骨に割りふる作り。
    こちらは **モデルに入っている本物の骨（41本の人型スケルトン）** を使う。
    支点も重みも 推定ではなく モデルが持っている値そのもの。

  やること
    (1) glTF の骨（Root/Hip/L_Thigh/…/Head）を ゲームの10本に つめかえる
    (2) 頂点の重み（4本ぶん）を 10本ぶんに足しあわせて、上位2本だけ残す
        ★シェーダは2本までしか混ぜられない（aBone.x/y と .z/w）
    (3) **Tポーズ → 立ち姿** に焼きなおす
        ★Tripoは腕を真横に伸ばした姿で出す。そのまま入れると
          腕を水平にしたまま歩く。骨があるので ちゃんと下ろしてから焼ける。
    (4) 骨の支点から dims（ゲームの骨の寸法）を計算する
    (5) テクスチャを 1024 に縮めて 1枚に

  ★減らすときに -sa を付けてはいけない。UVの継ぎ目を無視して縮めるので
    顔と服がまざった迷彩になる（実測。tools/_chars/_uvtest.png に見くらべあり）。

  使い方:
    python tools/import_char_glb.py <タグ> <減らしたGLB> [--write]
"""
import base64
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import import_okan_glb as G  # noqa: E402

# okan.js の OK_BONE と同じ番号。★変えるときは向こうも直す
BONE = dict(ROOT=0, TORSO=1, HEAD=2, ALU=3, ALF=4, ARU=5, ARF=6, LL=7, LR=8, CHI=9,
            CHEST=10, ALS=11, ARS=12, LLK=13, LRK=14, LLF=15, LRF=16)
BONE_NAME = {v: k for k, v in BONE.items()}
OLD_HEIGHT = 1.255          # 盤の上での背の高さ（手組みオカンに合わせる）
TEX_SIZE = 1024


# ------------------------------------------------------------ 行列のこまごま
def acc_mat4(g, bin_, i):
    """MAT4 の accessor（import_okan_glb の accessor は MAT4 を知らない）"""
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    arr = np.frombuffer(bin_, dtype=np.float32, count=a['count'] * 16, offset=start)
    return arr.reshape(a['count'], 16).astype(np.float64)


def q2m(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
        [0, 0, 0, 1]], dtype=np.float64)


def node_local(nd):
    if 'matrix' in nd:
        return np.array(nd['matrix'], dtype=np.float64).reshape(4, 4).T
    M = np.eye(4)
    if 'scale' in nd:
        M = np.diag(list(nd['scale']) + [1.0]) @ M
    if 'rotation' in nd:
        M = q2m(nd['rotation']) @ M
    if 'translation' in nd:
        T = np.eye(4)
        T[:3, 3] = nd['translation']
        M = T @ M
    return M


def world_matrices(g):
    """ぜんぶのノードの ワールド行列（休めの姿勢）"""
    nodes = g['nodes']
    W = [None] * len(nodes)
    roots = g['scenes'][g.get('scene', 0)]['nodes']
    stack = [(r, np.eye(4)) for r in roots]
    while stack:
        i, par = stack.pop()
        W[i] = par @ node_local(nodes[i])
        for c in nodes[i].get('children', []):
            stack.append((c, W[i]))
    return W


def rot_axis(axis, ang):
    a = np.asarray(axis, dtype=np.float64)
    n = np.linalg.norm(a)
    if n < 1e-12 or abs(ang) < 1e-12:
        return np.eye(4)
    a = a / n
    c, s = math.cos(ang), math.sin(ang)
    x, y, z = a
    R = np.eye(4)
    R[:3, :3] = np.array([
        [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
        [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
        [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]])
    return R


def rot_between(a, b):
    """ベクトル a を b に向ける回転"""
    a = a / max(1e-12, np.linalg.norm(a))
    b = b / max(1e-12, np.linalg.norm(b))
    ax = np.cross(a, b)
    if np.linalg.norm(ax) < 1e-9:
        return np.eye(4) if a @ b > 0 else rot_axis([0, 0, 1], math.pi)
    return rot_axis(ax, math.acos(float(np.clip(a @ b, -1, 1))))


# ---------------------------------------------------------------- 読みこみ
def read(path):
    g, bin_ = G.read_glb(path)
    P, N, U, J, Wt, I = [], [], [], [], [], []
    base = 0
    for m in g.get('meshes', []):
        for pr in m['primitives']:
            a = pr['attributes']
            p = np.array(G.accessor(g, bin_, a['POSITION']), np.float64).reshape(-1, 3)
            P.append(p)
            N.append(np.array(G.accessor(g, bin_, a['NORMAL']), np.float64).reshape(-1, 3))
            U.append(np.array(G.accessor(g, bin_, a['TEXCOORD_0']), np.float64).reshape(-1, 2))
            J.append(np.array(G.accessor(g, bin_, a['JOINTS_0']), np.int64).reshape(-1, 4))
            w = np.array(G.accessor(g, bin_, a['WEIGHTS_0']), np.float64).reshape(-1, 4)
            if w.max() > 1.5:                       # 整数で入っている場合
                w = w / (255.0 if w.max() < 300 else 65535.0)
            Wt.append(w)
            I.append(np.array(G.accessor(g, bin_, pr['indices']), np.int64) + base)
            base += len(p)
    bc = 0
    for m in g.get('materials', []):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t is not None:
            bc = g['textures'][t['index']]['source']
            break
    im = g['images'][bc]
    bv = g['bufferViews'][im['bufferView']]
    off = bv.get('byteOffset', 0)
    tex = Image.open(io.BytesIO(bin_[off:off + bv['byteLength']])).convert('RGB')
    return dict(g=g, bin=bin_, pos=np.concatenate(P), nrm=np.concatenate(N),
                uv=np.concatenate(U), joints=np.concatenate(J),
                wts=np.concatenate(Wt), idx=np.concatenate(I), tex=tex)


# --------------------------------------------- glTFの骨 → ゲームの10本
def map_bones(names, jpos):
    """名前と（左右は）実際のX位置で ゲームの骨に つめかえる。"""
    out = []
    for i, nm in enumerate(names):
        n = nm.lower().replace('tripo::', '')
        x = jpos[i][0]
        side = 'L' if x > 0.004 else ('R' if x < -0.004 else '')
        R = side == 'R'
        if any(k in n for k in ('foot', 'toe')):
            out.append(BONE['LRF'] if R else BONE['LLF'])
        elif any(k in n for k in ('calf', 'knee')):
            out.append(BONE['LRK'] if R else BONE['LLK'])
        elif 'thigh' in n:
            out.append(BONE['LR'] if R else BONE['LL'])
        elif 'clavicle' in n:
            out.append(BONE['ARS'] if R else BONE['ALS'])
        elif 'upperarm' in n:
            out.append(BONE['ARU'] if R else BONE['ALU'])
        elif any(k in n for k in ('forearm', 'hand', 'finger', 'thumb')):
            out.append(BONE['ARF'] if R else BONE['ALF'])
        elif 'necktwist02' in n or n == 'head' or n.startswith('head'):
            out.append(BONE['HEAD'])
        elif 'neck' in n:
            out.append(BONE['CHEST'])
        elif 'spine02' in n or 'chest' in n:
            out.append(BONE['CHEST'])
        elif any(k in n for k in ('spine', 'waist')):
            out.append(BONE['TORSO'])
        else:                                        # Root / Hip / Pelvis / neutral
            out.append(BONE['ROOT'])
    return np.array(out)


def find(names, key, side=None, jpos=None):
    """名前に key を含む骨を1本さがす（左右は 実際のX位置で見る）"""
    cand = []
    for i, nm in enumerate(names):
        n = nm.lower().replace('tripo::', '')
        if key not in n:
            continue
        if side and jpos is not None:
            x = jpos[i][0]
            if (side == 'L' and x <= 0) or (side == 'R' and x >= 0):
                continue
        cand.append(i)
    if not cand:
        return None
    cand.sort(key=lambda i: len(names[i]))   # twist01/02 のような枝より 本体を優先
    return cand[0]


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    tag, src = sys.argv[1], sys.argv[2]
    d = read(src)
    g = d['g']
    skin = g['skins'][0]
    joints = skin['joints']
    names = [g['nodes'][j].get('name', '?') for j in joints]
    W = world_matrices(g)
    jpos = np.array([W[j][:3, 3] for j in joints])
    ibm = acc_mat4(g, d['bin'], skin['inverseBindMatrices'])
    IBM = np.array([m.reshape(4, 4).T for m in ibm])

    print('=== %s ===' % tag)
    print('  頂点 %d ／ 三角 %d ／ 骨 %d' % (len(d['pos']), len(d['idx']) // 3, len(joints)))

    # ---- Tポーズ → 立ち姿 -------------------------------------------------
    # 肩の支点のまわりで 腕ぜんぶを 下向きに回す。子の骨も いっしょに動かす。
    def subtree(node):
        out, st = set(), [node]
        while st:
            i = st.pop()
            out.add(i)
            st += g['nodes'][i].get('children', [])
        return out

    Wp = [None if m is None else m.copy() for m in W]
    fixes = []
    for side, sx in (('L', +1), ('R', -1)):
        ua = find(names, 'upperarm', side, jpos)
        hd = find(names, 'hand', side, jpos)
        if ua is None or hd is None:
            continue
        S = jpos[ua]
        cur = jpos[hd] - S
        # ★脇を開ける。0.15（8度）だと 腕が体にはりついて 不自然だった
        tgt = np.array([sx * 0.32, -1.0, 0.06])
        R = rot_between(cur, tgt)
        A = np.eye(4)
        A[:3, 3] = S
        B = np.eye(4)
        B[:3, 3] = -S
        fixes.append((subtree(joints[ua]), A @ R @ B))
        ang = math.degrees(math.acos(float(np.clip(
            cur @ tgt / np.linalg.norm(cur) / np.linalg.norm(tgt), -1, 1))))
        print('  %s腕を下ろす: %.0f度' % (side, ang))
    for nodes_, C in fixes:
        for i in nodes_:
            if Wp[i] is not None:
                Wp[i] = C @ Wp[i]

    # ---- スキニングして 立ち姿の頂点を作る -------------------------------
    P, NR = d['pos'], d['nrm']
    JJ, WW = d['joints'], d['wts']
    s = WW.sum(1, keepdims=True)
    WW = WW / np.where(s < 1e-9, 1, s)
    SK = np.array([Wp[joints[k]] @ IBM[k] for k in range(len(joints))])
    P4 = np.concatenate([P, np.ones((len(P), 1))], 1)
    newP = np.zeros((len(P), 3))
    newN = np.zeros((len(P), 3))
    for k in range(4):
        w = WW[:, k:k + 1]
        if w.max() < 1e-9:
            continue
        M = SK[JJ[:, k]]                             # (n,4,4)
        newP += w * np.einsum('nij,nj->ni', M[:, :3, :], P4)
        newN += w * np.einsum('nij,nj->ni', M[:, :3, :3], NR)
    P = newP
    ln = np.linalg.norm(newN, axis=1, keepdims=True)
    NR = np.where(ln > 1e-9, newN / np.maximum(ln, 1e-9), np.array([0, 1.0, 0]))
    jpos2 = np.array([Wp[j][:3, 3] for j in joints])

    # ---- 頂点の重み → ゲームの10本（上位2本）-----------------------------
    gm = map_bones(names, jpos)
    acc = np.zeros((len(P), len(BONE)))
    for k in range(4):
        np.add.at(acc, (np.arange(len(P)), gm[JJ[:, k]]), WW[:, k])
    # ★上位4本のこす。2本に切ると ひじ・ひざ・肩の折れ目が かたくなって
    #   レゴのような動きになる（シェーダも 4本混ぜられるようにした）
    order = np.argsort(-acc, axis=1)
    idxs = [order[:, i] for i in range(4)]
    ws = [acc[np.arange(len(P)), b] for b in idxs]
    ws = [np.where(w < 0.008, 0.0, w) for w in ws]   # ごく薄いのだけ捨てる
    tot = np.maximum(1e-9, sum(ws))
    ws = [w / tot for w in ws]
    bone = np.stack([idxs[0], ws[0], idxs[1], ws[1]], 1)
    bone2 = np.stack([idxs[2], ws[2], idxs[3], ws[3]], 1)

    # ---- 高さを そろえる --------------------------------------------------
    y0 = P[:, 1].min()
    k = OLD_HEIGHT / (P[:, 1].max() - y0)
    P = (P - np.array([0, y0, 0])) * k
    jp = (jpos2 - np.array([0, y0, 0])) * k

    def jat(key, side=None):
        i = find(names, key, side, jpos)
        return None if i is None else jp[i]

    def pv(key, side=None):
        v = jat(key, side)
        return None if v is None else [round(float(v[0]), 5), round(float(v[1]), 5),
                                       round(float(v[2]), 5)]

    waistp = jat('waist')
    if waistp is None:
        waistp = jat('spine')
    headp = jat('head')
    uaL, uaR = jat('upperarm', 'L'), jat('upperarm', 'R')
    faL, haL = jat('forearm', 'L'), jat('hand', 'L')
    thL, thR = jat('thigh', 'L'), jat('thigh', 'R')
    waist = float(waistp[1])
    neck = float(headp[1])
    shoulder_y = float((uaL[1] + uaR[1]) / 2)
    armU = float(np.linalg.norm(uaL - faL))
    armF = float(np.linalg.norm(faL - haL))
    head_top = float(P[np.round(bone[:, 0]) == BONE['HEAD']][:, 1].max())

    # ---- 支点そのものを 書き出す（親からの差で FK を組むため）-------------
    chestp = None
    for key in ('spine02', 'chest', 'spine'):
        v = jat(key)
        if v is not None:
            chestp = v
            break
    def pair(key, fb=None):
        a, b = pv(key, 'L'), pv(key, 'R')
        if a is None or b is None:
            raise SystemExit('骨が見つからない: %s（左右そろっていない）' % key)
        return [a, b]

    piv = dict(
        waist=[0.0, round(waist, 5), 0.0],
        chest=[0.0, round(float(chestp[1]), 5), 0.0],
        head=[0.0, round(neck, 5), 0.0],
        headTop=round(head_top, 5),
        clav=pair('clavicle'),
        arm=pair('upperarm'),
        elbow=pair('forearm'),
        hand=pair('hand'),
        hip=pair('thigh'),
        knee=pair('calf'),
        foot=pair('foot'),
        chiZ=-0.012,
        armSwingMax=2.4,
    )

    # 古い形の寸法も のこす（手組みオカンと同じ読み方をする道具のため）。
    # ★ゲームの骨は piv（支点そのもの）を使う。こちらは 予備。
    dims = dict(
        hip=float(thL[1]), waist=waist,
        torsoH=neck - waist + 0.02,
        shoulder=shoulder_y - waist - 0.008,
        headY=0.0,
        headR=(head_top - neck) / 2.02,
        legLen=float(thL[1]),
        armU=armU, armF=armF,
        shoulderX=float(abs(uaL[0])),
        legX=float((abs(thL[0]) + abs(thR[0])) / 2),
        armZ=float((uaL[2] + uaR[2]) / 2),
        chiZ=-0.012,
        armSwingMax=2.4,
        p=piv,                                       # ★これが本番（支点そのもの）
    )

    print('  こし %.3f ／ 胸 %.3f ／ 首 %.3f ／ 肩 %.3f ／ 腕 %.3f+%.3f'
          % (waist, piv['chest'][1], neck, shoulder_y, armU, armF))
    print('  ひざ %.3f ／ 足 %.3f ／ 鎖骨x %.3f'
          % (piv['knee'][0][1], piv['foot'][0][1], piv['clav'][0][0]))
    print('  頭のてっぺん %.3f（頭の支点から %.3f）' % (head_top, head_top - neck))

    st = {BONE_NAME[b]: int((np.round(bone[:, 0]) == b).sum()) for b in range(len(BONE))}
    print('  骨ごとの頂点: ' + ' / '.join('%s:%d' % (a, b) for a, b in st.items() if b))
    nb = ((bone[:, 1] > 0.001).astype(int) + (bone[:, 3] > 0.001)
          + (bone2[:, 1] > 0.001) + (bone2[:, 3] > 0.001))
    print('  混ぜている骨の本数: 1本%d / 2本%d / 3本%d / 4本%d'
          % ((nb == 1).sum(), (nb == 2).sum(), (nb == 3).sum(), (nb == 4).sum()))

    # ---- 輪郭を押しだす向き＝なめらかにした法線 ---------------------------
    _, inv = np.unique(np.round(P, 4), axis=0, return_inverse=True)
    inv = inv.ravel()
    sm = np.zeros((inv.max() + 1, 3))
    np.add.at(sm, inv, NR)
    sm = sm[inv]
    ln = np.linalg.norm(sm, axis=1, keepdims=True)
    onrm = np.where(ln > 1e-9, sm / np.maximum(ln, 1e-9), NR)

    n = len(P)
    col = np.ones((n, 3))
    param = np.zeros((n, 4))
    param[:, 1] = 0.06
    param[:, 2] = 1.0
    param[np.round(bone[:, 0]) == BONE['HEAD'], 0] = 1.0     # 顔は影を落とさない

    uv = d['uv'].copy()
    uv[:, 1] = 1.0 - uv[:, 1]        # 本体は UNPACK_FLIP_Y_WEBGL=true

    if '--write' not in sys.argv:
        print('  （--write を付けると 書き出します）')
        return

    tex = d['tex'].resize((TEX_SIZE, TEX_SIZE), Image.LANCZOS)
    tex_name = '%s_tex.jpg' % tag
    tex.save(os.path.join(ROOT, tex_name), 'JPEG', quality=88, subsampling=0)

    def b64(a, dt):
        return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode('ascii')

    idx = d['idx']
    i32 = n > 65535
    payload = dict(
        n=n, count=int(len(idx)), idx32=bool(i32), tex=tex_name,
        dims={a: (b if a == 'p' else round(float(b), 5)) for a, b in dims.items()},
        pos=b64(P, '<f4'), nrm=b64(NR, '<f4'), onrm=b64(onrm, '<f4'),
        uv=b64(uv, '<f4'), col=b64(col, '<f4'), param=b64(param, '<f4'),
        bone=b64(bone, '<f4'), bone2=b64(bone2, '<f4'),
        idx=b64(idx, '<u4' if i32 else '<u2'))
    out = os.path.join(ROOT, 'js', 'char_%s.js' % tag)
    io.open(out, 'w', encoding='utf-8').write(
        '// 自動生成（tools/import_char_glb.py）。手で直さない。\n'
        '// リギング済みGLBを 立ち姿に焼きなおして取りこんだもの。\n'
        'window.CHAR_MODELS = window.CHAR_MODELS || {};\n'
        'window.CHAR_MODELS.%s = %s;\n' % (tag, json.dumps(payload, ensure_ascii=False)))
    print('  かきだし js/char_%s.js (%.0fKB) ／ %s (%.0fKB)'
          % (tag, os.path.getsize(out) / 1024, tex_name,
             os.path.getsize(os.path.join(ROOT, tex_name)) / 1024))


if __name__ == '__main__':
    main()
