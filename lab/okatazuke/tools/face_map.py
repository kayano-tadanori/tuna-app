# -*- coding: utf-8 -*-
"""オカンの顔（目・口）が テクスチャのどこにあるか を測って js/okan_face.js に書く。

★UVの島を色で探す方式は うまくいかなかった（髪の茶色を目と取りちがえる）。
  そこで「正面から見た絵」を自前で作り、**見えている画素だけ**を見る。
  絵の画素は UV を持っているので、見つけた目・口を そのままテクスチャの座標へ戻せる。

  1. 頭を +Z（正面）から 正射影で ラスタライズ（奥行きも見る）
  2. 画素ごとに UV を覚えておく
  3. その絵の中で 黒いかたまり＝目、赤いかたまり＝口 を見つける
     （見えている顔だけなので、髪や服は はじめから入らない）
  4. 見つけた画素の UV を テクスチャの座標に戻して 書き出す

使い方:
  python tools/face_map.py            … js/okan_face.js を書く
  python tools/face_map.py --show     … 見取り図も tools/_tex/ に出す
"""
import io
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import uvmap  # noqa: E402

TEX = os.path.join(ROOT, 'okan_tex.jpg')
OUT_JS = os.path.join(ROOT, 'js', 'okan_face.js')

# 顔を見る窓（モデルの座標）。頭のまわりだけ切りとる
VIEW = {'x0': -0.26, 'x1': 0.26, 'y0': 0.60, 'y1': 1.10}
RW, RH = 420, 520          # ラスタライズの大きさ


def rasterize(M, tex):
    """正面から見た絵と、画素ごとの UV を作る。"""
    W, H = tex.size
    tp = tex.load()
    # ★背景を黒にすると 黒いかたまり＝目 の検出に 背景まるごと入る（実測でやった）。
    #   どの判定にも当たらない色（まっ緑）にしておく。
    img = Image.new('RGB', (RW, RH), (0, 255, 0))
    ip = img.load()
    uvbuf = [[None] * RH for _ in range(RW)]
    zbuf = [[-1e9] * RH for _ in range(RW)]
    sx = RW / (VIEW['x1'] - VIEW['x0'])
    sy = RH / (VIEW['y1'] - VIEW['y0'])

    for t in range(M['ntri']):
        ns = [M['nrm'][v * 3:v * 3 + 3] for v in uvmap.tri_verts(M, t)]
        if sum(n[2] for n in ns) / 3 <= 0.0:       # 後ろむきは いらない
            continue
        ps = uvmap.tri_pos(M, t)
        qs = uvmap.tri_uv(M, t)
        # 画面座標へ（y は上下ひっくり返す）
        pts = []
        for p in ps:
            X = (p[0] - VIEW['x0']) * sx
            Y = (VIEW['y1'] - p[1]) * sy
            pts.append((X, Y, p[2]))
        minx = max(0, int(min(p[0] for p in pts)))
        maxx = min(RW - 1, int(max(p[0] for p in pts)) + 1)
        miny = max(0, int(min(p[1] for p in pts)))
        maxy = min(RH - 1, int(max(p[1] for p in pts)) + 1)
        if minx > maxx or miny > maxy:
            continue
        (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = pts
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-9:
            continue
        for py in range(miny, maxy + 1):
            for px in range(minx, maxx + 1):
                a = ((y1 - y2) * (px + 0.5 - x2) + (x2 - x1) * (py + 0.5 - y2)) / den
                b = ((y2 - y0) * (px + 0.5 - x2) + (x0 - x2) * (py + 0.5 - y2)) / den
                c = 1 - a - b
                if a < 0 or b < 0 or c < 0:
                    continue
                z = a * z0 + b * z1 + c * z2
                if z <= zbuf[px][py]:
                    continue
                zbuf[px][py] = z
                u = a * qs[0][0] + b * qs[1][0] + c * qs[2][0]
                v = a * qs[0][1] + b * qs[1][1] + c * qs[2][1]
                uvbuf[px][py] = (u, v)
                tx = min(W - 1, max(0, int(u * W)))
                ty = min(H - 1, max(0, int((1 - v) * H)))
                ip[px, py] = tp[tx, ty]
    return img, uvbuf


def find_blobs(img, pred, minpts):
    W, H = img.size
    p = img.load()
    pts = set()
    for y in range(H):
        for x in range(W):
            if pred(p[x, y]):
                pts.add((x, y))
    out = []
    while pts:
        s0 = pts.pop(); st = [s0]; g = [s0]
        while st:
            x, y = st.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in pts:
                        pts.discard(q); st.append(q); g.append(q)
        if len(g) >= minpts:
            out.append(g)
    out.sort(key=len, reverse=True)
    return out


def bbox_of(g):
    xs = [p[0] for p in g]; ys = [p[1] for p in g]
    return min(xs), min(ys), max(xs), max(ys)


def uv_rect(g, uvbuf, W, H, pad):
    """絵のかたまり → テクスチャ上の四角（余白 pad 画素）"""
    us, vs = [], []
    for (x, y) in g:
        q = uvbuf[x][y]
        if q:
            us.append(q[0] * W); vs.append((1 - q[1]) * H)
    if not us:
        return None
    return [int(min(us)) - pad, int(min(vs)) - pad,
            int(max(us)) + pad, int(max(vs)) + pad]


def main():
    M = uvmap.load()
    tex = Image.open(TEX).convert('RGB')
    W, H = tex.size
    print('正面から ラスタライズ中…')
    img, uvbuf = rasterize(M, tex)

    ip = img.load()

    def white_near(g, pad=3):
        """かたまりの中と まわりに 白い点（＝目のハイライト）がいくつあるか"""
        x0, y0, x1, y1 = bbox_of(g)
        k = 0
        for y in range(max(0, y0 - pad), min(RH, y1 + pad + 1)):
            for x in range(max(0, x0 - pad), min(RW, x1 + pad + 1)):
                c = ip[x, y]
                if c[0] > 210 and c[1] > 210 and c[2] > 205:
                    k += 1
        return k

    def shape_ok(g, lo, hi, rlo, rhi, ylo, yhi):
        x0, y0, x1, y1 = bbox_of(g)
        w = x1 - x0 + 1; h = y1 - y0 + 1
        cy = (y0 + y1) / 2 / RH
        return (lo <= len(g) <= hi and rlo < w / h < rhi and ylo < cy < yhi)

    # 目＝小さめで丸く、顔のまん中あたりにあり、中に白いハイライトがある
    # ★大きさの上限を入れないと 髪（大きな黒いかたまり）を 目と取りちがえる
    cands = find_blobs(img, lambda c: c[0] + c[1] + c[2] < 260 and c[0] < 120, 200)
    eyes = [g for g in cands if shape_ok(g, 200, 5000, 0.45, 1.9, 0.30, 0.72)
            and white_near(g) >= 12]
    eyes.sort(key=lambda g: -len(g))
    eyes = eyes[:2]
    eyes.sort(key=lambda g: bbox_of(g)[0])          # 左→右

    # 口＝赤いかたまり。目より下、まん中あたり
    mc = find_blobs(img, lambda c: c[0] > 105 and c[0] > c[1] * 1.6 and c[0] > c[2] * 1.6, 150)
    # ★口は「両目のあいだ・両目より下」。これを入れないと ほっぺの赤みを拾う（実測）
    if len(eyes) == 2:
        ex0 = min(bbox_of(eyes[0])[2], bbox_of(eyes[1])[2])
        ex1 = max(bbox_of(eyes[0])[0], bbox_of(eyes[1])[0])
        lo_x = min(ex0, ex1) - 20
        hi_x = max(ex0, ex1) + 20
        ey_bottom = max(bbox_of(eyes[0])[3], bbox_of(eyes[1])[3])
    else:
        lo_x, hi_x, ey_bottom = 0, RW, 0

    def between_eyes(g):
        x0, y0, x1, y1 = bbox_of(g)
        cx = (x0 + x1) / 2
        return lo_x <= cx <= hi_x and (y0 + y1) / 2 > ey_bottom

    mouth = [g for g in mc if shape_ok(g, 150, 6000, 0.5, 2.6, 0.55, 0.92) and between_eyes(g)]
    mouth = mouth[:1]

    # ほっぺ＝目の下・外がわの うすい赤み（見つからなくてもよい）
    bc = find_blobs(img, lambda c: 228 < c[0] < 256 and 145 < c[1] < 200 and 125 < c[2] < 185, 200)
    blush = [g for g in bc if shape_ok(g, 200, 6000, 0.6, 2.6, 0.45, 0.80)][:2]

    print('目 %d／口 %d／ほっぺ %d' % (len(eyes), len(mouth), len(blush)))
    for g in eyes:
        print('   目 絵の中 %s 点%d' % (bbox_of(g), len(g)))
    for g in mouth:
        print('   口 絵の中 %s 点%d' % (bbox_of(g), len(g)))

    if len(eyes) < 2 or not mouth:
        print('★目2つと口が そろわなかった。--show で見取り図を見て しきい値を直す')

    data = {
        'texW': W, 'texH': H,
        'eyes': [uv_rect(g, uvbuf, W, H, 3) for g in eyes],
        'mouth': [uv_rect(g, uvbuf, W, H, 3) for g in mouth],
        'blush': [uv_rect(g, uvbuf, W, H, 2) for g in blush],
    }
    # 顔の地色（目のまわりの はだ色）
    skin = []
    for g in eyes:
        x0, y0, x1, y1 = bbox_of(g)
        for x in range(max(0, x0 - 12), min(RW, x1 + 12)):
            for y in range(max(0, y0 - 12), min(RH, y1 + 12)):
                c = ip[x, y]
                if c[0] > 225 and 175 < c[1] < 235 and 140 < c[2] < 215:
                    skin.append(c)
    data['skin'] = list(map(int, [sum(c[i] for c in skin) / len(skin) for i in range(3)])) \
        if skin else [255, 224, 186]
    print('はだ色', data['skin'])

    js = ('// 自動生成（tools/face_map.py）。手で直さない。\n'
          '// オカンの目・口・ほっぺが テクスチャのどこにあるか（画素）。\n'
          '// 表情を変えるときは この四角だけ 描きかえて texSubImage2D で貼りかえる。\n'
          'window.OKAN_FACE = %s;\n' % json.dumps(data, ensure_ascii=False))
    io.open(OUT_JS, 'w', encoding='utf-8').write(js)
    print('書いた:', OUT_JS)

    if '--show' in sys.argv:
        os.makedirs(os.path.join(HERE, '_tex'), exist_ok=True)
        vis = img.copy()
        d = ImageDraw.Draw(vis)
        for g, col in [(eyes, (0, 255, 0)), (mouth, (0, 160, 255)), (blush, (255, 255, 0))]:
            for gg in g:
                d.rectangle(bbox_of(gg), outline=col, width=2)
        vis.save(os.path.join(HERE, '_tex', '_face_front.png'))
        vis2 = tex.copy()
        d2 = ImageDraw.Draw(vis2)
        for r, col in [(data['eyes'], (0, 255, 0)), (data['mouth'], (0, 160, 255)),
                       (data['blush'], (255, 255, 0))]:
            for rr in r:
                if rr:
                    d2.rectangle(rr, outline=col, width=2)
        vis2.save(os.path.join(HERE, '_tex', '_face_tex.png'))
        print('見取り図: tools/_tex/_face_front.png と _face_tex.png')


if __name__ == '__main__':
    main()
