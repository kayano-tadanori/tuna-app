# -*- coding: utf-8 -*-
"""ペット（チッチ／ジェイド／メイ）を **羽が動く形** で 取りこむ。

  ★はじめは「骨を動かさない1本」で入れたが、羽が広がったまま 固まっていた。
    Tripo のペットにも 骨が入っているので、それを つめかえて 羽ばたけるようにする。

  ゲームがわの骨（7本）
    0 からだ ／ 1 左羽の内 ／ 2 左羽の外 ／ 3 右羽の内 ／ 4 右羽の外 ／ 5 あたま ／ 6 しっぽ

  骨の見分けかた（名前だけに たよらない）
    Tripo は 羽を `bone_12` のような 名前なしの くさりで出す。
    そこで **「胴から 横（X）へ 伸びていく くさり」＝羽** と 位置で見分ける。
    あたま/しっぽ は `tripo::Head_*` `tripo::Tail_*` の名前がある。

  大きさは 実物の体長で決める（チッチ10cm→0.135／メイ20cm→0.27／ジェイド25cm→0.3375）

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
PB = dict(BODY=0, WLI=1, WLO=2, WRI=3, WRO=4, HEAD=5, TAIL=6)
PB_NAME = {v: k for k, v in PB.items()}


def classify(g, joints, names, jp, height):
    """骨を ゲームの7本に つめかえる。返り値は 骨ごとの番号。"""
    par = {}
    for i, nd in enumerate(g['nodes']):
        for ch in nd.get('children', []):
            par[ch] = i
    idx_of = {j: i for i, j in enumerate(joints)}

    def kids(i):
        return [idx_of[c] for c in g['nodes'][joints[i]].get('children', []) if c in idx_of]

    def subtree(i):
        out, st = set(), [i]
        while st:
            a = st.pop()
            out.add(a)
            st += kids(a)
        return out

    out = np.full(len(joints), PB['BODY'])
    # あたま・しっぽ（名前がある）
    for i, nm in enumerate(names):
        n = nm.lower().replace('tripo::', '')
        if n.startswith('head'):
            out[i] = PB['HEAD']
        elif n.startswith('tail'):
            out[i] = PB['TAIL']

    # 羽＝「胴（|X|が小さい）から 横へ 伸び出す くさり」の付け根をさがす
    # ★Tripo は **脚を `0_Left_Limb_*` / `0_Right_Limb_*`** と名づける。
    #   脚の付け根は 体の下がわで それなりに高いところにあるので、
    #   高さだけで はじくと 脚を羽と まちがえる（実際 まちがえた）。名前で外す。
    hi_y = height * 0.35
    for sgn, inner, outer in ((+1, PB['WLI'], PB['WLO']), (-1, PB['WRI'], PB['WRO'])):
        cands = [i for i in range(len(joints))
                 if jp[i][0] * sgn > 0.05 and jp[i][1] > hi_y
                 and 'limb' not in names[i].lower()
                 and out[i] == PB['BODY']]
        if not cands:
            continue
        # 付け根＝いちばん体に近いところまで さかのぼる
        root = min(cands, key=lambda i: abs(jp[i][0]))
        while joints[root] in par and par[joints[root]] in idx_of:
            up = idx_of[par[joints[root]]]
            if abs(jp[up][0]) < 0.035 or jp[up][1] < hi_y * 0.8:
                break
            if 'limb' in names[up].lower():
                break
            root = up
        # ★体に近すぎる節は 羽にしない。
        #   Tripo の自動リグは 羽のくさりに **胴の頂点まで** ぶらさげることがある。
        #   そこまで回すと 体ごと ひっくり返る（ジェイドで実際に裏返った）。
        far = max(abs(jp[i][0]) for i in range(len(joints)))
        sub = [i for i in subtree(root) if abs(jp[i][0]) >= far * 0.30]
        sub.sort(key=lambda i: abs(jp[i][0]))
        if not sub:
            continue
        # 体に近い半分＝内、遠い半分＝外
        half = max(1, len(sub) // 2)
        for k, i in enumerate(sub):
            out[i] = inner if k < half else outer
        yield_root = root
        print('   %s羽: 付け根 %-14s 節%d本（内%d/外%d）'
              % ('左' if sgn > 0 else '右', names[yield_root], len(sub), half, len(sub) - half))
    return out


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    tag, src, height = sys.argv[1], sys.argv[2], float(sys.argv[3])
    d = C.read(src)
    g = d['g']
    skin = g['skins'][0]
    joints = skin['joints']
    names = [g['nodes'][j].get('name', '?') for j in joints]
    W = C.world_matrices(g)
    jp = np.array([W[j][:3, 3] for j in joints])

    P, NR = d['pos'], d['nrm']
    lo, hi = P.min(0), P.max(0)
    print('=== %s ===' % tag)
    print('   三角 %d ／ 骨 %d' % (len(d['idx']) // 3, len(joints)))
    gm = classify(g, joints, names, jp, hi[1] - lo[1])

    # ---- 大きさと 位置をそろえる（足もとを y=0、まんなかを 0）------------
    k = height / (hi[1] - lo[1])
    off = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    P = (P - off) * k
    jq = (jp - off) * k

    # ---- 重みを 7本に つめかえる（上位4本のこす）------------------------
    JJ, WW = d['joints'], d['wts']
    sw = WW.sum(1, keepdims=True)
    WW = WW / np.where(sw < 1e-9, 1, sw)
    acc = np.zeros((len(P), len(PB)))
    for c in range(4):
        np.add.at(acc, (np.arange(len(P)), gm[JJ[:, c]]), WW[:, c])
    order = np.argsort(-acc, axis=1)
    ids = [order[:, i] for i in range(4)]
    ws = [acc[np.arange(len(P)), b] for b in ids]
    ws = [np.where(w < 0.008, 0.0, w) for w in ws]
    tot = np.maximum(1e-9, sum(ws))
    ws = [w / tot for w in ws]
    bone = np.stack([ids[0], ws[0], ids[1], ws[1]], 1)
    bone2 = np.stack([ids[2], ws[2], ids[3], ws[3]], 1)
    st = {PB_NAME[b]: int((np.round(bone[:, 0]) == b).sum()) for b in range(len(PB))}
    print('   骨ごとの頂点: ' + ' / '.join('%s:%d' % (a, b) for a, b in st.items() if b))
    wing = sum(st[k] for k in ('WLI', 'WLO', 'WRI', 'WRO'))
    if wing > len(P) * 0.45:
        print('   ★羽が %d%% もある＝胴まで 羽の骨に ぶらさがっている疑い'
              % (wing * 100 // len(P)))

    # ---- 支点（羽の付け根・あたま・しっぽ）--------------------------------
    def center(b):
        m = gm == b
        if not m.any():
            return None
        return [round(float(v), 5) for v in jq[m].mean(0)]

    def nearest_root(b):
        """その骨のうち いちばん体に近い節＝回す支点"""
        m = np.where(gm == b)[0]
        if not len(m):
            return None
        i = m[np.argmin(np.abs(jq[m][:, 0]) + np.abs(jq[m][:, 2]) * 0.2)]
        return [round(float(v), 5) for v in jq[i]]

    piv = dict(
        wli=nearest_root(PB['WLI']), wlo=nearest_root(PB['WLO']),
        wri=nearest_root(PB['WRI']), wro=nearest_root(PB['WRO']),
        head=nearest_root(PB['HEAD']) or [0, height * 0.6, 0],
        tail=center(PB['TAIL']) or [0, height * 0.35, -height * 0.2],
        h=round(height, 5),
    )
    # 羽が見つからないモデルでも 落ちないように
    for a, b in (('wli', [height * 0.10, height * 0.55, 0]),
                 ('wlo', [height * 0.25, height * 0.58, -0.02])):
        if piv[a] is None:
            piv[a] = b
        if piv['w' + a[1:].replace('l', 'r')] is None:
            piv['w' + a[1:].replace('l', 'r')] = [-b[0], b[1], b[2]]
    print('   支点 羽内%s 羽外%s あたま%s' % (piv['wli'], piv['wlo'], piv['head']))
    print('   大きさ %.3f x %.3f x %.3f' % (np.ptp(P[:, 0]), np.ptp(P[:, 1]), np.ptp(P[:, 2])))

    # ---- 法線・輪郭 -------------------------------------------------------
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
    col = np.ones((n, 3))
    param = np.zeros((n, 4))
    param[:, 0] = 1.0                    # 影を落とさない（頭の上なので）
    param[:, 1] = 0.06
    param[:, 2] = 1.0
    uv = d['uv'].copy()
    uv[:, 1] = 1.0 - uv[:, 1]

    if '--write' not in sys.argv:
        print('   （--write を付けると 書き出します）')
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
        height=height, p=piv,
        pos=b64(P, '<f4'), nrm=b64(NR, '<f4'), onrm=b64(onrm, '<f4'),
        uv=b64(uv, '<f4'), col=b64(col, '<f4'), param=b64(param, '<f4'),
        bone=b64(bone, '<f4'), bone2=b64(bone2, '<f4'),
        idx=b64(idx, '<u4' if i32 else '<u2'))
    out = os.path.join(ROOT, 'js', 'pet_%s.js' % tag)
    io.open(out, 'w', encoding='utf-8').write(
        '// 自動生成（tools/import_pet_glb.py）。手で直さない。\n'
        'window.PET_MODELS = window.PET_MODELS || {};\n'
        'window.PET_MODELS.%s = %s;\n' % (tag, json.dumps(payload, ensure_ascii=False)))
    print('   かきだし js/pet_%s.js (%.0fKB) ／ %s (%.0fKB)'
          % (tag, os.path.getsize(out) / 1024, tex_name,
             os.path.getsize(os.path.join(ROOT, tex_name)) / 1024))


if __name__ == '__main__':
    main()
