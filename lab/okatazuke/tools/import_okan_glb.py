# -*- coding: utf-8 -*-
"""Tripoで作った GLB を「オカンの おかたづけ」の頂点フォーマットに変換する。

  なぜ要るか：
    okan.js は部品を積んで骨番号を持たせる作り（parts.js の PartBuilder）。
    Tripoが吐くのは「骨なしの1枚メッシュ＋4Kのテクスチャ」なので、そのままでは
    棒立ちになるし輪郭線も出ない。ここで両者の橋をかける。

  やること：
    ① 位置で溶接して連結成分に分ける（Tripoのモデルは既に塊に分かれている）
    ② 塊ごとに骨を割り当てる（髪・顔・リボン→HEAD、鳥→CHI、手→ALF/ARF、脚とくつ→LL/LR）
    ③ 上着だけは胴と両袖が一体なので、切らずに「骨2本の重み」でなじませる
       ★切ると断面に穴があく。シェーダが2本混ぜられる（aBone.x/y と .z/w）ので、その機能を使う
       ★重みは「腕の線までの距離」と「背骨までの距離」の比で決める。
         Xの大小だけで決めると、横に広がる裾が袖と判定されて胴がねじれる（最初これで失敗した）
    ④ aONrm（輪郭を押し出す向き）を塊ごとの中心から計算する ← parts.js と同じ考え方
    ⑤ テクスチャを縮小して1枚に焼く（uTex は1枚しか無い）

  使い方：
    python tools/import_okan_glb.py <入力.glb>           … 調べて絵を描くだけ（書き込まない）
    python tools/import_okan_glb.py <入力.glb> --write    … js/okan_model.js とテクスチャも書き出す

  ★出力を信じる前に tools/_import/preview.png を必ず見る。
    「まっすぐ立った絵」と「骨を動かした絵」を並べて描いているので、
    肩がねじれていないか・脚が正しく分かれているかが目で分かる。
"""
import sys, os, json, struct, base64, math, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # lab/okatazuke
OUTDIR = os.path.join(HERE, '_import')

# okan.js の OK_BONE と同じ番号。★変えるときは向こうも直す
BONE = dict(ROOT=0, TORSO=1, HEAD=2, ALU=3, ALF=4, ARU=5, ARF=6, LL=7, LR=8, CHI=9)
BONE_NAME = {v: k for k, v in BONE.items()}
# okan.js の並びは「+X 側が L」（js/okan.js:192 の sx=1 が ALU、:127 の sx=1 が LL）


# ---------------------------------------------------------------- GLBを読む
def read_glb(path):
    buf = open(path, 'rb').read()
    if struct.unpack_from('<I', buf, 0)[0] != 0x46546C67:
        raise SystemExit('GLBではありません: %s' % path)
    off, js, bin_ = 12, None, None
    while off < len(buf):
        ln, ty = struct.unpack_from('<II', buf, off)
        data = buf[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A:
            js = json.loads(data.decode('utf-8'))
        elif ty == 0x004E4942:
            bin_ = data
        off += 8 + ln
        off += (4 - (off % 4)) % 4
    return js, bin_


DT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def accessor(g, bin_, i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]
    arr = np.frombuffer(bin_, dtype=DT[a['componentType']], count=a['count'] * n, offset=start)
    return arr.reshape(a['count'], n) if n > 1 else arr


# ---------------------------------------------------------- 塊に分ける
def components(pos, idx):
    """位置が同じ頂点をくっつけて、つながっている塊に番号をふる。"""
    key = np.round(pos, 5)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    parent = np.arange(len(first))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in inv[idx.reshape(-1, 3)]:
        ra, rb, rc = find(a), find(b), find(c)
        if ra != rb:
            parent[ra] = rb
        rb = find(b)
        if rb != rc:
            parent[rb] = rc

    root = np.array([find(x) for x in range(len(first))])
    _, comp_of_welded = np.unique(root, return_inverse=True)
    return comp_of_welded.ravel()[inv]


# ------------------------------------------------- 塊がなんなのかを見分ける
def classify(pos, comp):
    """塊の位置と大きさから骨を決める。判断の根拠も返すので必ず目で確かめる。

    ★見分けの順番が大事。
      鳥（一番高い）→ 上着（一番広い）→ 頭まわり（高い）→ 手（腕の先＝外に張り出している）→ 残りは脚とくつ
      「高さだけ」で手と脚を分けると、手（Y 0.19〜0.35）と脚（Y 0.05〜0.26）が重なって取りちがえる。
    """
    ncomp = int(comp.max()) + 1
    info = []
    for c in range(ncomp):
        p = pos[comp == c]
        info.append(dict(c=c, n=len(p), lo=p.min(0), hi=p.max(0), mid=(p.min(0) + p.max(0)) / 2))
    top = max(i['hi'][1] for i in info)

    assign, reason = {}, {}
    bird = max(info, key=lambda i: i['lo'][1])
    assign[bird['c']] = 'CHI'
    reason[bird['c']] = '一番高いところにある＝鳥'

    rest = [i for i in info if i['c'] not in assign]
    jacket = max(rest, key=lambda i: (i['hi'][0] - i['lo'][0]) * (i['hi'][1] - i['lo'][1]))
    assign[jacket['c']] = 'JACKET'
    reason[jacket['c']] = '面積がいちばん大きい＝上着（胴＋両袖）'

    for i in info:
        if i['c'] not in assign and i['lo'][1] > top * 0.45:
            assign[i['c']] = 'HEAD'
            reason[i['c']] = '下端が %.2f より上＝頭まわり（髪・顔・リボン）' % (top * 0.45)

    # 手＝残りのうち、左右それぞれで「いちばん外に張り出している」もの
    limbs = [i for i in info if i['c'] not in assign]
    for sign, side in ((+1, 'L'), (-1, 'R')):
        side_limbs = [i for i in limbs if math.copysign(1, i['mid'][0]) == sign]
        if not side_limbs:
            continue
        hand = max(side_limbs, key=lambda i: abs(i['mid'][0]))
        assign[hand['c']] = 'A%sF' % side
        reason[hand['c']] = 'その側でいちばん外（|X|=%.2f）＝手' % abs(hand['mid'][0])
        for i in side_limbs:
            if i['c'] not in assign:
                assign[i['c']] = 'L%s' % side
                reason[i['c']] = '残り＝脚かくつ（%s側）' % ('+X' if sign > 0 else '-X')
    for i in info:
        assign.setdefault(i['c'], 'TORSO')
        reason.setdefault(i['c'], '判定できず＝胴にした（要確認）')
    return info, assign, reason


# ------------------------------------------------------------- 骨の支点
def measure_rig(pos, comp, info, assign):
    """モデルの実寸から、肩・ひじ・こし・脚のつけ根の位置を測る。"""
    def bbox_of(kind):
        cs = [c for c, a in assign.items() if a == kind]
        if not cs:
            return None
        p = pos[np.isin(comp, cs)]
        return dict(lo=p.min(0), hi=p.max(0), mid=(p.min(0) + p.max(0)) / 2)

    jak = bbox_of('JACKET')
    hL, hR = bbox_of('ALF'), bbox_of('ARF')
    lL, lR = bbox_of('LL'), bbox_of('LR')
    head = bbox_of('HEAD')

    shoulder_y = jak['hi'][1] - (jak['hi'][1] - jak['lo'][1]) * 0.14
    band = pos[(comp == [c for c, a in assign.items() if a == 'JACKET'][0])]
    band = band[(band[:, 1] > shoulder_y - 0.05) & (band[:, 1] < shoulder_y + 0.05)]
    torso_hw = float(np.percentile(np.abs(band[:, 0]), 60)) if len(band) else 0.12

    # 肩の支点の左右＝肩の高さでの袖のいちばん外から、腕の太さぶん内側
    jc = [c for c in assign if assign[c] == 'JACKET'][0]
    jp2 = pos[comp == jc]
    sb = jp2[(jp2[:, 1] > shoulder_y - 0.06) & (jp2[:, 1] < shoulder_y + 0.06)]
    shoulder_x = float(np.abs(sb[:, 0]).max() * 0.78) if len(sb) else 0.14

    rig = dict(
        shoulder_x=shoulder_x,
        shoulder_y=float(shoulder_y),
        neck=np.array([0.0, float(jak['hi'][1]), 0.0]),
        hip=np.array([0.0, float(lL['hi'][1] if lL else jak['lo'][1]), 0.0]),
        torso_hw=torso_hw,
        shoulder_L=np.array([+torso_hw, float(shoulder_y), 0.0]),
        shoulder_R=np.array([-torso_hw, float(shoulder_y), 0.0]),
        hand_L=hL['mid'].astype(float) if hL else np.array([0.2, 0.27, 0.0]),
        hand_R=hR['mid'].astype(float) if hR else np.array([-0.2, 0.27, 0.0]),
        leg_L=np.array([float(lL['mid'][0]), float(lL['hi'][1]), 0.0]) if lL else np.zeros(3),
        leg_R=np.array([float(lR['mid'][0]), float(lR['hi'][1]), 0.0]) if lR else np.zeros(3),
        head_pivot=np.array([0.0, float(head['lo'][1] + 0.02), 0.0]) if head else np.zeros(3),
    )
    return rig


def seg_dist(p, a, b):
    """点pから線分abまでの距離（まとめて計算）。"""
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(1e-9, ab @ ab), 0.0, 1.0)
    return np.linalg.norm(p - (a + np.outer(t, ab)), axis=1)


# ------------------------------------------- 上着を胴と腕に「なじませる」
def jacket_weights(p, rig, r_torso=0.135, r_arm=0.045, power=3.0):
    """上着の各頂点を (骨0,重み0,骨1,重み1) にする。切らずに混ぜるので穴があかない。

    腕の線（肩→手）と背骨（こし→首）を、**太さのある棒**として距離を測る。
    ★線のままだと胸の表面が背骨から遠くなり、胴ぜんぶが腕寄りになる（最初これで失敗した。
      TORSO の頂点が1個しか残らなかった）。体の太さ r_torso を引いてから比べる。
    """
    dS = np.maximum(0.0, seg_dist(p, rig['hip'], rig['neck']) - r_torso)
    dL = seg_dist(p, rig['shoulder_L'], rig['hand_L'])
    dR = seg_dist(p, rig['shoulder_R'], rig['hand_R'])
    arm_is_L = dL <= dR
    dA = np.maximum(0.0, np.minimum(dL, dR) - r_arm)

    # 近いほうへ強く寄る（距離の逆数の power 乗）。棒の中は距離0なので eps で割れないようにする
    eps = 0.004
    wS = 1.0 / np.power(dS + eps, power)
    wA = 1.0 / np.power(dA + eps, power)
    t = wA / (wA + wS)                           # 1に近いほど腕

    n = len(p)
    out = np.zeros((n, 4))
    arm_bone = np.where(arm_is_L, BONE['ALU'], BONE['ARU'])
    out[:, 0] = np.where(t > 0.001, arm_bone, BONE['TORSO'])
    out[:, 1] = np.where(t > 0.001, t, 1.0)
    out[:, 2] = BONE['TORSO']
    out[:, 3] = np.where(t > 0.001, 1.0 - t, 0.0)
    full = t >= 0.999
    out[full, 1] = 1.0
    out[full, 2] = arm_bone[full]
    out[full, 3] = 0.0
    return out


# ------------------------------------------------------------------ 本体
def build(glb_path):
    g, bin_ = read_glb(glb_path)
    prim = g['meshes'][0]['primitives'][0]
    if prim.get('mode', 4) != 4:
        raise SystemExit('三角形ではありません（mode=%s）' % prim.get('mode'))

    pos = np.array(accessor(g, bin_, prim['attributes']['POSITION']), dtype=np.float64)
    nrm = np.array(accessor(g, bin_, prim['attributes']['NORMAL']), dtype=np.float64)
    uv = np.array(accessor(g, bin_, prim['attributes']['TEXCOORD_0']), dtype=np.float64)
    idx = np.array(accessor(g, bin_, prim['indices']), dtype=np.int64)

    print('=== 読みこみ ===')
    print('  頂点 %d ／ 三角形 %d' % (len(pos), len(idx) // 3))

    comp = components(pos, idx)
    info, assign, reason = classify(pos, comp)

    print('')
    print('=== 塊の割り当て（★目で確かめる）===')
    for i in sorted(info, key=lambda i: -i['n']):
        print('  塊%-2d 頂点%-5d Y %.2f〜%.2f X %+.2f〜%+.2f → %-8s %s'
              % (i['c'], i['n'], i['lo'][1], i['hi'][1], i['lo'][0], i['hi'][0],
                 assign[i['c']], reason[i['c']]))

    rig = measure_rig(pos, comp, info, assign)
    print('')
    print('=== モデルから測った骨の支点 ===')
    print('  肩の高さ %.3f ／ 胴の半幅 %.3f' % (rig['shoulder_y'], rig['torso_hw']))
    print('  肩 L%s R%s' % (np.round(rig['shoulder_L'], 3), np.round(rig['shoulder_R'], 3)))
    print('  手 L%s R%s' % (np.round(rig['hand_L'], 3), np.round(rig['hand_R'], 3)))
    print('  脚のつけ根 L%s R%s' % (np.round(rig['leg_L'], 3), np.round(rig['leg_R'], 3)))

    # --- 頂点ごとの骨と重み -------------------------------------------
    n = len(pos)
    bone = np.zeros((n, 4))
    jacket_c = [c for c, a in assign.items() if a == 'JACKET']
    for c in range(int(comp.max()) + 1):
        m = comp == c
        a = assign[c]
        if a == 'JACKET':
            bone[m] = jacket_weights(pos[m], rig)
        else:
            b = BONE[a]
            bone[m] = (b, 1.0, b, 0.0)

    # --- aONrm（輪郭を押し出す向き）＝塊の中心から外向き ---------------
    onrm = np.zeros_like(pos)
    for c in range(int(comp.max()) + 1):
        m = comp == c
        center = (pos[m].min(0) + pos[m].max(0)) / 2
        d = pos[m] - center
        L = np.linalg.norm(d, axis=1, keepdims=True)
        L[L < 1e-9] = 1.0
        onrm[m] = d / L

    col = np.ones((n, 3))                        # 色はテクスチャ側なので白
    param = np.zeros((n, 4))
    param[:, 1] = 0.06                           # y=つや
    param[:, 2] = 1.0                            # z=テクスチャ混ぜ量（全面テクスチャ）
    param[np.round(bone[:, 0]) == BONE['HEAD'], 0] = 1.0   # x=顔マスク（影を落とさない）

    print('')
    print('=== 骨ごとの頂点数 ===')
    st = {BONE_NAME[b]: int((np.round(bone[:, 0]) == b).sum()) for b in range(10)}
    print('  ' + ' / '.join('%s:%d' % (k, v) for k, v in st.items() if v))
    mixed = int(((bone[:, 3] > 0.001) & (bone[:, 3] < 0.999)).sum())
    print('  2本の骨で混ぜている頂点（肩のなじませ）: %d' % mixed)

    return dict(g=g, bin=bin_, pos=pos, nrm=nrm, uv=uv, idx=idx, comp=comp,
                assign=assign, bone=bone, onrm=onrm, col=col, param=param, rig=rig)


def extract_texture(g, bin_, size):
    im = g['images'][0]
    bv = g['bufferViews'][im['bufferView']]
    raw = bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    print('')
    print('=== テクスチャ ===')
    print('  もと %dx%d (%.2f MB) → %dx%d' % (img.width, img.height, len(raw) / 1048576, size, size))
    return img.resize((size, size), Image.LANCZOS)


# ------------------------------------------------------ ゲームの形に書き出す
# いまの手組みオカンの背の高さ（tools で実測。ここに合わせないと盤の上で大きさがちがう）
OLD_HEIGHT = 1.255


def emit_js(d, tex_name, out_js):
    """js/okan_model.js を書き出す。

    ★中身は「立ち姿のワールド座標」のまま入れる。骨ローカルへの変換（逆バインド）は
      読みこむ側（okan.js の buildOkanFromModel）で、本体と同じ OkanRig を使ってやる。
      ここで骨の式を書き写すと、本体の式を直したときに黙ってズレる。
    """
    pos, rig = d['pos'], d['rig']
    height = pos[:, 1].max() - pos[:, 1].min()
    k = OLD_HEIGHT / height                      # 1マスの寸法系に合わせる倍率
    P = (pos - np.array([0, pos[:, 1].min(), 0])) * k

    def s(v):
        return float(v * k)

    waist = s(rig['leg_L'][1])                                   # 胴の回転の支点＝こし
    neck = s(rig['neck'][1])
    shoulder_y = s(rig['shoulder_y'])
    hand_y = s((rig['hand_L'][1] + rig['hand_R'][1]) / 2)
    arm_len = max(0.02, shoulder_y - hand_y)
    dims = dict(
        hip=waist,
        waist=waist,
        torsoH=neck - waist + 0.02,                               # 頭の支点＝waist+torsoH-0.02
        shoulder=shoulder_y - waist - 0.008,                      # 肩＝waist+shoulder+0.008
        headY=0.0,
        headR=(s(float(np.min(d['pos'][d['comp'] == [c for c, a in d['assign'].items()
                                                     if a == 'CHI'][0]][:, 1]))) - neck) / 2.02,
        legLen=waist,
        armU=arm_len * 0.55,
        armF=arm_len * 0.45,
        shoulderX=s(rig['shoulder_x']),
        legX=s(abs(rig['leg_L'][0]) + abs(rig['leg_R'][0])) / 2,
        armZ=s((rig['hand_L'][2] + rig['hand_R'][2]) / 2) * 0.4,
        chiZ=-0.012,
        # ★このモデルは腕が体に密着していて 脇に すきま が無い。大きくふると
        #   肩まわりの布が引き裂かれて黒い板になる（実測：よろこぶ134°・おす73°で発生）。
        #   0.75rad（43°）まで。歩くふり幅は0.55なので歩きには影響しない。
        #   ★脇の開いたAポーズで作り直せば、この上限は外せる。
        armSwingMax=0.75,
    )

    # UV：本体は UNPACK_FLIP_Y_WEBGL=true で貼るので、glTFのVを反転して渡す
    uv = d['uv'].copy()
    uv[:, 1] = 1.0 - uv[:, 1]

    def b64(a, dtype):
        return base64.b64encode(np.ascontiguousarray(a, dtype=dtype).tobytes()).decode('ascii')

    n = len(P)
    idx = d['idx']
    idx_type = np.uint16 if n <= 65535 else np.uint32
    payload = dict(
        n=n, count=int(len(idx)), idx32=(idx_type is np.uint32), tex=tex_name,
        dims={kk: round(float(vv), 5) for kk, vv in dims.items()},
        pos=b64(P, np.float32), nrm=b64(d['nrm'], np.float32),
        onrm=b64(d['onrm'], np.float32), uv=b64(uv, np.float32),
        col=b64(d['col'], np.float32), param=b64(d['param'], np.float32),
        bone=b64(d['bone'], np.float32), idx=b64(idx, idx_type),
    )
    js = ('// 自動生成。手で直さない（tools/import_okan_glb.py が作る）\n'
          '// Tripo の GLB を取りこんだオカン。中身は「立ち姿のワールド座標」。\n'
          '// 骨ローカルへの変換は okan.js の buildOkanFromModel が本体の OkanRig を使ってやる。\n'
          'window.OKAN_MODEL = ' + json.dumps(payload, ensure_ascii=False) + ';\n')
    open(out_js, 'w', encoding='utf-8').write(js)
    print('')
    print('=== 書き出し ===')
    print('  %s  (%.0f KB)' % (out_js, os.path.getsize(out_js) / 1024))
    print('  倍率 %.4f（高さ %.3f → %.3f）' % (k, height, OLD_HEIGHT))
    print('  寸法 ' + ' / '.join('%s=%.3f' % (a, b) for a, b in dims.items()))
    return dims


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    os.makedirs(OUTDIR, exist_ok=True)
    d = build(sys.argv[1])
    size = 1024
    tex = extract_texture(d['g'], d['bin'], size)
    tex.save(os.path.join(OUTDIR, 'okan_tex_1024.jpg'), quality=88)
    np.savez(os.path.join(OUTDIR, 'okan_mesh.npz'),
             pos=d['pos'], nrm=d['nrm'], onrm=d['onrm'], uv=d['uv'],
             col=d['col'], param=d['param'], bone=d['bone'], idx=d['idx'],
             comp=d['comp'], **{('rig_' + k): v for k, v in d['rig'].items()})
    if '--write' in sys.argv:
        tex.save(os.path.join(ROOT, 'okan_tex.jpg'), quality=88)
        emit_js(d, 'okan_tex.jpg', os.path.join(ROOT, 'js', 'okan_model.js'))
        print('  %s  (%.0f KB)' % (os.path.join(ROOT, 'okan_tex.jpg'),
                                   os.path.getsize(os.path.join(ROOT, 'okan_tex.jpg')) / 1024))
    else:
        print('')
        print('中間データだけ書きました（--write でゲームに入れる形も出します）')
    print('次は tools/preview_okan.py で絵を描いて目で確かめる。')
