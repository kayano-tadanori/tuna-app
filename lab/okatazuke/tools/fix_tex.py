# -*- coding: utf-8 -*-
"""テクスチャの文字と チッチを 描きなおす。

Tripo が参考画像から焼いた文字は にじんでいて 読めない。
モデルの UV と 「体のどっちが上か」が分かれば、テクスチャの正しい場所に
正しい向きで 描き直せる（HANDOVER §10「顔のUV島の位置を測って、そこに描きこむ」）。

  たすき   … 「復習は宝」「できるで！」（本人から）
  はちまき … 「オカン学園」＋しるし
  チッチ   … 黒いにじみを消して、白いアイリングを描く

★島は番号で決め打ちしない。「体のどこにあるか」で選ぶ。
  モデルを作りなおしても 同じ場所が選ばれるようにするため。

使い方:
  python tools/fix_tex.py            … 直して okan_tex.jpg を書きかえる（元は .bak へ）
  python tools/fix_tex.py --dry      … 書かずに tools/_tex/okan_tex_fixed.jpg だけ出す
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import uvmap  # noqa: E402

TEX = os.path.join(ROOT, 'okan_tex.jpg')
OUT_DIR = os.path.join(HERE, '_tex')
FONT = 'C:/Windows/Fonts/meiryob.ttc'      # 太いゴシック。小さくしても つぶれにくい

PINK = (196, 42, 88)
WHITE = (255, 253, 250)


def font(size):
    return ImageFont.truetype(FONT, size)


def is_pink(c):
    r, g, b = c[0], c[1], c[2]
    return r > 90 and r > g + 40 and r > b + 20 and g < 150


def island_frame(M, tris, W, H, pad=8):
    """島を切り出して「体の上」が画面の上になるように回すための下ごしらえ。"""
    mask = uvmap.mask_of(M, tris, W, H, grow=1)
    bb = mask.getbbox()
    if bb is None:
        return None
    x0 = max(0, bb[0] - pad); y0 = max(0, bb[1] - pad)
    x1 = min(W, bb[2] + pad); y1 = min(H, bb[3] + pad)
    up = uvmap.up_dir_in_uv(M, tris)
    # UVのvは下から上、画像のyは上から下。反転してから角度を出す
    ang = math.degrees(math.atan2(-up[1], up[0])) + 90.0
    return {'box': (x0, y0, x1, y1), 'ang': ang, 'mask': mask, 'up': up}


def edit_island(tex, fr, painter):
    """島の場所を 回して painter に渡し、描き終わったら もどして貼る。"""
    x0, y0, x1, y1 = fr['box']
    crop = tex.crop((x0, y0, x1, y1))
    rot = crop.rotate(-fr['ang'], resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0))
    painter(rot)
    back = rot.rotate(fr['ang'], resample=Image.BICUBIC, expand=False)
    cx, cy = back.width / 2, back.height / 2
    lx = int(cx - crop.width / 2); ly = int(cy - crop.height / 2)
    back = back.crop((lx, ly, lx + crop.width, ly + crop.height))
    tex.paste(back, (x0, y0), fr['mask'].crop((x0, y0, x1, y1)))


def rot_mask(fr):
    x0, y0, x1, y1 = fr['box']
    return fr['mask'].crop((x0, y0, x1, y1)).rotate(
        -fr['ang'], resample=Image.NEAREST, expand=True, fillcolor=0)


def vtext(img, cx, cy, text, size, fill, stroke=None, sw=0, gap=1.04):
    f = font(size)
    d = ImageDraw.Draw(img)
    step = size * gap
    top = cy - step * (len(text) - 1) / 2
    for i, ch in enumerate(text):
        bb = d.textbbox((0, 0), ch, font=f)
        w = bb[2] - bb[0]; h = bb[3] - bb[1]
        x = cx - w / 2 - bb[0]
        y = top + i * step - h / 2 - bb[1]
        d.text((x, y), ch, font=f, fill=fill,
               stroke_width=sw, stroke_fill=stroke)


def htext(img, cx, cy, text, size, fill, spacing=0.0, stroke=None, sw=0):
    f = font(size)
    d = ImageDraw.Draw(img)
    ws = []
    for ch in text:
        bb = d.textbbox((0, 0), ch, font=f)
        ws.append(bb[2] - bb[0])
    total = sum(ws) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, ws):
        bb = d.textbbox((0, 0), ch, font=f)
        h = bb[3] - bb[1]
        d.text((x - bb[0], cy - h / 2 - bb[1]), ch, font=f, fill=fill,
               stroke_width=sw, stroke_fill=stroke)
        x += w + spacing


def swoosh(img, cx, cy, size, fill):
    d = ImageDraw.Draw(img)
    for i in range(3):
        r = size * (1.0 - i * 0.24)
        w = max(2, int(size * 0.16))
        d.arc([cx - r, cy - r * 0.80, cx + r, cy + r * 0.80], 195, 345, fill=fill, width=w)


def largest_blob(mask):
    """白い点のうち いちばん大きい かたまりだけ残す。"""
    W, H = mask.size
    mp = mask.load()
    seen = [[False] * H for _ in range(W)]
    best = []
    for y0 in range(H):
        for x0 in range(W):
            if mp[x0, y0] < 128 or seen[x0][y0]:
                continue
            st = [(x0, y0)]; seen[x0][y0] = True; g = []
            while st:
                x, y = st.pop(); g.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H and not seen[nx][ny] and mp[nx, ny] >= 128:
                            seen[nx][ny] = True; st.append((nx, ny))
            if len(g) > len(best):
                best = g
    out = Image.new('L', (W, H), 0)
    op = out.load()
    for (x, y) in best:
        op[x, y] = 255
    return out, best


def fill_holes(mask):
    """かたまりの内がわの すき間（＝古い白い文字）も かたまりに入れる。
    ★ここを入れないと 古い文字が消えずに 新しい文字と重なる（実測でそうなった）。"""
    W, H = mask.size
    # ★まわりに1マスの ふちを付けて そこから たどる。
    #   ふちを 0 にすると 出発点から どこへも行けず「全部が穴」になる（実測で踏んだ）
    inv = Image.new('L', (W + 2, H + 2), 255)
    ip = inv.load(); mp = mask.load()
    for y in range(H):
        for x in range(W):
            ip[x + 1, y + 1] = 255 if mp[x, y] < 128 else 0
    # 外がわから 白いところを たどる＝外の空間
    st = [(0, 0)]
    ip[0, 0] = 128
    while st:
        x, y = st.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W + 2 and 0 <= ny < H + 2 and ip[nx, ny] == 255:
                ip[nx, ny] = 128
                st.append((nx, ny))
    out = Image.new('L', (W, H), 0)
    op = out.load()
    for y in range(H):
        for x in range(W):
            if mp[x, y] >= 128 or ip[x + 1, y + 1] == 255:
                op[x, y] = 255
    return out


def blob_frame(pts):
    """かたまりの 長いほうの向き・中心・長さ・幅（主成分）。"""
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    sxx = syy = sxy = 0.0
    for (x, y) in pts:
        dx = x - cx; dy = y - cy
        sxx += dx * dx; syy += dy * dy; sxy += dx * dy
    sxx /= n; syy /= n; sxy /= n
    # 2x2 の固有ベクトル
    tr = sxx + syy
    det = sxx * syy - sxy * sxy
    l1 = tr / 2 + math.sqrt(max(0.0, tr * tr / 4 - det))
    l2 = tr / 2 - math.sqrt(max(0.0, tr * tr / 4 - det))
    if abs(sxy) > 1e-9:
        ax = (l1 - syy, sxy)
    else:
        ax = (1.0, 0.0) if sxx >= syy else (0.0, 1.0)
    L = math.hypot(*ax) or 1
    ax = (ax[0] / L, ax[1] / L)
    return (cx, cy), ax, math.sqrt(max(l1, 1e-9)) * 2.0, math.sqrt(max(l2, 1e-9)) * 2.0


def draw_char(tex, cx, cy, ch, size, ang_deg, fill, stroke, sw):
    """1文字を 好きな角度で貼る（PILは回した文字を直接描けないので 作って回す）。"""
    f = font(size)
    pad = int(size * 0.9)
    tmp = Image.new('RGBA', (size * 2 + pad, size * 2 + pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    bb = d.textbbox((0, 0), ch, font=f)
    x = tmp.width / 2 - (bb[2] - bb[0]) / 2 - bb[0]
    y = tmp.height / 2 - (bb[3] - bb[1]) / 2 - bb[1]
    d.text((x, y), ch, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
    rot = tmp.rotate(ang_deg, resample=Image.BICUBIC, expand=True)
    tex.paste(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)), rot)


def pink_mask(tex, island_mask):
    W, H = tex.size
    out = Image.new('L', (W, H), 0)
    tp = tex.load(); mp = island_mask.load(); op = out.load()
    bb = island_mask.getbbox()
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if mp[x, y] >= 128 and is_pink(tp[x, y]):
                op[x, y] = 255
    return out


def paint_sash(tex, M, isls, text_left, text_right):
    """★島には 上着の白い布も入っている。文字は「ピンクの帯」の上だけに描く。
       帯の向きは 帯そのものの主成分で決める（島の平均の向きでは合わない）。"""
    W, H = tex.size
    isls = sorted(isls, key=lambda d: d['c'][0])       # x が小さい＝正面から見て左
    for d, txt in zip(isls, [text_left, text_right]):
        im = uvmap.mask_of(M, d['tris'], W, H, grow=1)
        pm = pink_mask(tex, im)
        blob, pts = largest_blob(pm)
        if len(pts) < 200:
            print('   ★帯が見つからない（%d点）' % len(pts)); continue
        blob = fill_holes(blob)                      # 古い白い文字のぶんも 帯に含める
        pts = [(x, y) for y in range(blob.size[1]) for x in range(blob.size[0])
               if blob.getpixel((x, y)) >= 128]
        (cx, cy), ax, ln, wd = blob_frame(pts)
        # 帯を まっさらなピンクで塗る（にじんだ文字を消す）
        tp = tex.load(); bp = blob.load()
        bb = blob.getbbox()
        for y in range(bb[1], bb[3]):
            for x in range(bb[0], bb[2]):
                if bp[x, y] >= 128:
                    tp[x, y] = PINK
        # 体の上向き（画像座標）。文字は上から下へ読ませる
        up = uvmap.up_dir_in_uv(M, d['tris'])
        up_img = (up[0], -up[1])
        if ax[0] * up_img[0] + ax[1] * up_img[1] > 0:
            ax = (-ax[0], -ax[1])                      # ax を「下へ」向ける
        ang = math.degrees(math.atan2(-(-ax[1]), -ax[0])) - 90.0
        size = max(9, int(wd * 0.62))
        step = size * 1.12
        n = len(txt)
        for i, ch in enumerate(txt):
            t = (i - (n - 1) / 2) * step
            px = cx + ax[0] * t
            py = cy + ax[1] * t
            draw_char(tex, px, py, ch, size, ang, WHITE, (120, 20, 50), max(1, size // 14))
        print('   たすき（x=%+.2f）に「%s」 帯 長さ%.0f 幅%.0f 字%dpx'
              % (d['c'][0], txt, ln, wd, size))


def white_mask(tex, island_mask):
    W, H = tex.size
    out = Image.new('L', (W, H), 0)
    tp = tex.load(); mp = island_mask.load(); op = out.load()
    bb = island_mask.getbbox()
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if mp[x, y] < 128:
                continue
            r, g, b = tp[x, y][:3]
            if r > 175 and g > 170 and b > 165:
                op[x, y] = 255
    return out


def paint_hat(tex, M, isls, text_isls, text='オカン学園'):
    """はちまきの「オカン学園」を くっきり描きなおす。

    ★2つ つまずいた（どちらも実測で分かった）：
      ① 古いロゴは **別の島** にも乗っている。1つだけ消すと 二重に残る
      ② 島は頭を1周しているので、島のまん中に描くと 文字が横や後ろへ回りこむ。
         位置も向きも「正面をむいている面」だけで決める
    """
    W, H = tex.size
    tp = tex.load()
    # ① 布の白い所を ぜんぶ まっさらにする。
    #    ★「いちばん大きいかたまり」だけ消すと、別のかたまりに乗った
    #      古いロゴが残る（実測：帽子の左上に にじんだロゴが残った）。
    #      白とピンクだけ塗るので、同じ島に入っている髪はそのまま。
    wiped = 0
    for d in isls:
        im = uvmap.mask_of(M, d['tris'], W, H, grow=1)
        bb = im.getbbox()
        if not bb:
            continue
        mp = im.load()
        for y in range(bb[1], bb[3]):
            for x in range(bb[0], bb[2]):
                if mp[x, y] < 128:
                    continue
                r, g, b = tp[x, y][:3]
                # ★しきい値をきつくすると 文字のふちの半端な色が 点々と残る（実測）
                if (r > 150 and g > 128 and b > 120) or is_pink(tp[x, y]):
                    tp[x, y] = (250, 249, 246); wiped += 1

    # ①' 島の切れ目で 取りこぼすので、高さで選んだ面でも もう一度 消す。
    #     ★実測：帽子の左上に にじんだロゴが残りつづけた原因がこれ
    hat_tris = []
    for t in range(M['ntri']):
        vs = uvmap.tri_verts(M, t)
        # ★チッチも y>1.02 にいる。骨で のぞかないと 鳥の顔まで白く塗る（実測でやった）
        if any(uvmap.vert_bone(M, v) == uvmap.BONE['CHI'] for v in vs):
            continue
        ys = [M['pos'][v * 3 + 1] for v in vs]
        if min(ys) > 1.02:
            hat_tris.append(t)
    if hat_tris:
        hm = uvmap.mask_of(M, hat_tris, W, H, grow=1)
        bb2 = hm.getbbox()
        hp = hm.load()
        for y in range(bb2[1], bb2[3]):
            for x in range(bb2[0], bb2[2]):
                if hp[x, y] < 128:
                    continue
                r, g, b = tp[x, y][:3]
                if (r > 150 and g > 128 and b > 120) or is_pink(tp[x, y]):
                    tp[x, y] = (250, 249, 246); wiped += 1

    # ② 正面をむいている面だけ 集める。
    #    ★島をまたいで集めると UV がばらばらの場所に散るので、
    #      「正面の面がいちばん多い島」ひとつに しぼる（実測：字が51pxに化けた）
    def front_of(d):
        out = []
        for t in d['tris']:
            ns = [M['nrm'][v * 3:v * 3 + 3] for v in uvmap.tri_verts(M, t)]
            nz = sum(n[2] for n in ns) / 3
            ny = sum(n[1] for n in ns) / 3
            if nz > 0.45 and ny < 0.80:
                out.append(t)
        return out
    best = max(text_isls, key=lambda d: len(front_of(d)))
    front = front_of(best)
    if len(front) < 8:
        print('   ★はちまきの正面が見つからない'); return
    dx = uvmap.dir_in_uv(M, front, (1.0, 0.0, 0.0))
    dy = uvmap.dir_in_uv(M, front, (0.0, 1.0, 0.0))
    ax = (dx[0], -dx[1])
    up = (dy[0], -dy[1])
    pts = [(u * W, (1 - v) * H) for t in front for (u, v) in uvmap.tri_uv(M, t)]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    ex = max(abs((x - cx) * ax[0] + (y - cy) * ax[1]) for (x, y) in pts)
    ey = max(abs((x - cx) * up[0] + (y - cy) * up[1]) for (x, y) in pts)
    size = max(9, int(min(ex * 0.26, ey * 0.62)))
    ang = math.degrees(math.atan2(up[1], -up[0])) - 90.0 + 180.0
    n = len(text)
    step = size * 1.02
    total = step * n + size * 1.35
    start = -total / 2 + size * 0.68

    def put(t, off=0.0):
        return (cx + ax[0] * t + up[0] * off, cy + ax[1] * t + up[1] * off)
    OFF = ey * 0.26          # 正面のまん中より すこし上（実物のはちまきの位置）
    sx, sy = put(start, OFF)
    swoosh_rot(tex, sx, sy, size * 0.82, PINK, ang)
    for i, ch in enumerate(text):
        px, py = put(start + size * 1.35 + step * i, OFF)
        draw_char(tex, px, py, ch, size, ang, PINK, None, 0)
    print('   はちまきに「%s」 正面 %.0fx%.0f 字%dpx（島%d・%d点を白で消した）'
          % (text, ex * 2, ey * 2, size, len(isls), wiped))


def swoosh_rot(tex, cx, cy, size, fill, ang_deg):
    s = int(size * 3)
    tmp = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(tmp)
    for i in range(3):
        r = size * (1.0 - i * 0.24)
        w = max(2, int(size * 0.15))
        d.arc([s / 2 - r, s / 2 - r * 0.80, s / 2 + r, s / 2 + r * 0.80],
              195, 345, fill=fill, width=w)
    rot = tmp.rotate(ang_deg, resample=Image.BICUBIC, expand=True)
    tex.paste(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)), rot)


def paint_chicchi(tex, M, isls):
    """チッチの顔：黒いにじみを消して 白いアイリングを描く。
    ★向きは要らないので 回さない（回すと絵が2回ぼける）。"""
    W, H = tex.size

    def orange_count(d):
        m = uvmap.mask_of(M, d['tris'], W, H)
        bb = m.getbbox()
        if not bb:
            return 0
        mp = m.load(); tp = tex.load()
        n = k = 0
        for yy in range(bb[1], bb[3]):
            for xx in range(bb[0], bb[2]):
                if mp[xx, yy] < 128:
                    continue
                r, g, b = tp[xx, yy][:3]
                n += 1
                if r > 195 and 95 < g < 200 and b < 130:
                    k += 1
        return k

    # ★「オレンジの割合」で選ぶと、小さい島が勝ってしまう（実測：目のかけらを顔と誤認）。
    #   顔は「オレンジの面積がいちばん広い島」。
    face = max(isls, key=orange_count)
    m = uvmap.mask_of(M, face['tris'], W, H)
    bb = m.getbbox()
    mp = m.load(); tp = tex.load()
    cols = []
    for yy in range(bb[1], bb[3]):
        for xx in range(bb[0], bb[2]):
            if mp[xx, yy] < 128:
                continue
            r, g, b = tp[xx, yy][:3]
            if r > 195 and 105 < g < 200 and b < 140:
                cols.append((r, g, b))
    if not cols:
        print('   ★顔の色が取れない'); return
    base = tuple(sum(c[i] for c in cols) // len(cols) for i in range(3))
    dark = set()
    for yy in range(bb[1], bb[3]):
        for xx in range(bb[0], bb[2]):
            if mp[xx, yy] < 128:
                continue
            r, g, b = tp[xx, yy][:3]
            if r + g + b < 280:
                dark.add((xx, yy))
    if not dark:
        print('   暗い点なし'); return
    seen = set(dark)
    groups = []
    while seen:
        s0 = seen.pop()
        st = [s0]; g = [s0]
        while st:
            x, y = st.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    p = (x + dx, y + dy)
                    if p in seen:
                        seen.discard(p); st.append(p); g.append(p)
        groups.append(g)
    groups.sort(key=len, reverse=True)
    eye = groups[0]
    ex = sum(p[0] for p in eye) / len(eye)
    ey = sum(p[1] for p in eye) / len(eye)
    er = max(3.0, (len(eye) / math.pi) ** 0.5)
    wiped = 0
    for g in groups[1:]:
        if len(g) < 3:
            continue
        for (x, y) in g:
            tp[x, y] = base
        wiped += 1
    d = ImageDraw.Draw(tex)
    d.ellipse([ex - er * 1.9, ey - er * 1.9, ex + er * 1.9, ey + er * 1.9], fill=(255, 255, 255))
    d.ellipse([ex - er * 1.05, ey - er * 1.05, ex + er * 1.05, ey + er * 1.05], fill=(26, 20, 18))
    d.ellipse([ex - er * 0.44, ey - er * 0.74, ex + er * 0.10, ey - er * 0.20], fill=(255, 255, 255))
    print('   チッチ：目(%.0f,%.0f) 半径%.1f ／ にじみ %d か所を消して アイリングを描いた'
          % (ex, ey, er, wiped))


def main():
    dry = '--dry' in sys.argv
    # 書き出しの大きさ。実測（tools/_tex/_texsize.png）で 768 を分かれ目にした：
    #   1024=258KB くっきり／768=166KB 帽子くっきり・たすき読める／512=96KB たすきがぼける
    size = 768
    for i, a in enumerate(sys.argv):
        if a == '--size' and i + 1 < len(sys.argv):
            size = int(sys.argv[i + 1])
    os.makedirs(OUT_DIR, exist_ok=True)
    M = uvmap.load()
    # ★元絵（Tripoが焼いたまま）から やり直す。書きかえた絵から始めると
    #   走らせるたびに 文字の上に文字を描いて どんどん汚れる
    # ★元絵は okan_tex_src.jpg。`.bak` という名前にすると .gitignore の
    #   「bak で終わるものは無視」に当たって リポジトリから落ちる（2026-08-24 に踏んだ）
    SRC = os.path.join(ROOT, 'okan_tex_src.jpg')
    src = SRC if os.path.exists(SRC) else TEX
    tex = Image.open(src).convert('RGB')
    print('元絵:', os.path.basename(src), tex.size)
    isl = uvmap.islands(M)
    info = sorted((uvmap.island_info(M, g) for g in isl), key=lambda d: -d['area'])

    def pick(pred):
        return [d for d in info if pred(d)]

    sash = pick(lambda d: d['bone'] == 'TORSO' and d['c'][2] > 0.15
                and 0.35 < d['c'][1] < 0.62 and d['area'] > 0.004)
    # ★はちまきは 島が2つ以上ある（古いロゴが別の島にも乗っている）
    # 消すのは広めに、描くのは「はっきり はちまきの島」だけ
    hat_wipe = pick(lambda d: d['bone'] == 'HEAD' and d['c'][1] > 0.90 and d['area'] > 0.002)
    hat = pick(lambda d: d['bone'] == 'HEAD' and d['c'][1] > 0.95 and d['area'] > 0.004)
    chi = pick(lambda d: d['bone'] == 'CHI' and d['area'] > 0.002)
    print('たすき %d島 / はちまき %d島（消す %d島） / チッチ %d島'
          % (len(sash), len(hat), len(hat_wipe), len(chi)))

    if len(sash) == 2:
        paint_sash(tex, M, sash, '復習は宝', 'できるで！')
    else:
        print('★たすきが2本 見つからない（%d本）' % len(sash))
    if hat:
        paint_hat(tex, M, hat_wipe, hat)
    if chi:
        paint_chicchi(tex, M, chi)

    ship = tex if size >= tex.width else tex.resize((size, size), Image.LANCZOS)
    out = os.path.join(OUT_DIR, 'okan_tex_fixed.jpg')
    ship.save(out, 'JPEG', quality=90, subsampling=0)
    print('書いた: %s（%dpx / %.0fKB）' % (out, size, os.path.getsize(out) / 1024))
    if not dry:
        if not os.path.exists(SRC):
            Image.open(TEX).save(SRC, 'JPEG', quality=96, subsampling=0)
            print('元の絵を残した:', SRC)
        ship.save(TEX, 'JPEG', quality=90, subsampling=0)
        print('差しかえた: %s（%.0fKB）' % (TEX, os.path.getsize(TEX) / 1024))


if __name__ == '__main__':
    main()
