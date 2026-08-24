# -*- coding: utf-8 -*-
"""オカンの表情を作って js/okan_faces.js に書き出す。

★テクスチャに直接 目を描くのは できない。目が UV の継ぎ目をまたいでいて、
  テクスチャ上では 2か所に ちぎれているから（実測：片目の四角が 203x497 になった）。
  そこで **正面から見た絵の上で** 表情を描き、
  描いた画素を 1つずつ テクスチャの座標へ 戻す。継ぎ目があっても そのまま通る。

出すもの（js/okan_faces.js）：
  表情ごとに「テクスチャのどこを・どう塗るか」の小さな絵（PNG）だけ。
  実行時に texSubImage2D で その四角だけ貼りかえる。全部で数十KB。

表情（参考は 素材/okan.png・okan-cheer.png・okan-damage.png）
  normal  … もとのまま（もどす用）
  smile   … にっこり（あるいているとき）
  effort  … ふんばり（にもつを おしているとき）
  happy   … よろこび（クリア。目は ^ ^、口は大きく）
  sad     … がっくり（詰んだとき）
  blink   … まばたき

使い方: python tools/face_expr.py [--show]
"""
import base64
import io
import json
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import uvmap  # noqa: E402
import face_map  # noqa: E402

TEX = os.path.join(ROOT, 'okan_tex.jpg')
OUT_JS = os.path.join(ROOT, 'js', 'okan_faces.js')


def detect(img):
    """正面の絵から 目・口・ほっぺ を見つける（face_map と同じ理屈）。"""
    RW, RH = img.size
    ip = img.load()

    def bbox(g):
        return face_map.bbox_of(g)

    def white_near(g, pad=3):
        x0, y0, x1, y1 = bbox(g)
        k = 0
        for y in range(max(0, y0 - pad), min(RH, y1 + pad + 1)):
            for x in range(max(0, x0 - pad), min(RW, x1 + pad + 1)):
                c = ip[x, y]
                if c[0] > 210 and c[1] > 210 and c[2] > 205:
                    k += 1
        return k

    def shape_ok(g, lo, hi, rlo, rhi, ylo, yhi):
        x0, y0, x1, y1 = bbox(g)
        w = x1 - x0 + 1; h = y1 - y0 + 1
        cy = (y0 + y1) / 2 / RH
        return lo <= len(g) <= hi and rlo < w / h < rhi and ylo < cy < yhi

    cands = face_map.find_blobs(img, lambda c: c[0] + c[1] + c[2] < 260 and c[0] < 120, 200)
    eyes = [g for g in cands if shape_ok(g, 200, 5000, 0.45, 1.9, 0.30, 0.72)
            and white_near(g) >= 12]
    eyes.sort(key=lambda g: -len(g))
    eyes = sorted(eyes[:2], key=lambda g: bbox(g)[0])

    mc = face_map.find_blobs(img, lambda c: c[0] > 105 and c[0] > c[1] * 1.6 and c[0] > c[2] * 1.6, 150)
    if len(eyes) == 2:
        lo_x = min(bbox(eyes[0])[2], bbox(eyes[1])[2]) - 20
        hi_x = max(bbox(eyes[0])[0], bbox(eyes[1])[0]) + 20
        eb = max(bbox(eyes[0])[3], bbox(eyes[1])[3])
    else:
        lo_x, hi_x, eb = 0, RW, 0
    mouth = [g for g in mc
             if shape_ok(g, 150, 6000, 0.5, 2.6, 0.55, 0.92)
             and lo_x <= (bbox(g)[0] + bbox(g)[2]) / 2 <= hi_x
             and (bbox(g)[1] + bbox(g)[3]) / 2 > eb][:1]
    return eyes, mouth


# ---- 表情を 正面の絵の上に描く -------------------------------------------
def clear_soft(img, bb, pad):
    """四角を まわりの色で なじませて消す。
    ★べた塗りだと 顔の陰影の中に「四角い明るい板」が浮く（実測で見えた）。
      四角のふちの色を たてよこで混ぜて うめる（クーンズ・パッチ）。"""
    W, H = img.size
    x0 = max(1, bb[0] - pad); y0 = max(1, bb[1] - pad)
    x1 = min(W - 2, bb[2] + pad); y1 = min(H - 2, bb[3] + pad)
    if x1 <= x0 or y1 <= y0:
        return
    p = img.load()
    left = [p[x0 - 1, y] for y in range(y0, y1 + 1)]
    right = [p[x1 + 1, y] for y in range(y0, y1 + 1)]
    top = [p[x, y0 - 1] for x in range(x0, x1 + 1)]
    bot = [p[x, y1 + 1] for x in range(x0, x1 + 1)]
    wid = x1 - x0; hei = y1 - y0
    for j, y in enumerate(range(y0, y1 + 1)):
        for i, x in enumerate(range(x0, x1 + 1)):
            u = i / max(1, wid); v = j / max(1, hei)
            c = []
            for k in range(3):
                a = left[j][k] * (1 - u) + right[j][k] * u
                b = top[i][k] * (1 - v) + bot[i][k] * v
                c.append(int(max(0, min(255, a * 0.5 + b * 0.5))))
            p[x, y] = tuple(c)


def draw_expr(img, name, eyes, mouth, skin):
    """img（正面の絵）を その場で描きかえる。"""
    d = ImageDraw.Draw(img)
    EYE = (28, 22, 20)
    LIP = (150, 46, 38)
    IN = (214, 92, 62)

    boxes = [face_map.bbox_of(g) for g in eyes]
    mb = face_map.bbox_of(mouth[0]) if mouth else None

    def clear(bb, pad=4):
        clear_soft(img, bb, pad)

    # --- 目 ---
    for bb in boxes:
        clear(bb, 5)
    for bb in boxes:
        x0, y0, x1, y1 = bb
        cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
        w = (x1 - x0) / 2; h = (y1 - y0) / 2
        if name in ('happy',):
            # ^ ^ の目（にっこり閉じ）
            d.arc([cx - w * 1.15, cy - h * 0.35, cx + w * 1.15, cy + h * 1.35],
                  200, 340, fill=EYE, width=max(3, int(w * 0.42)))
        elif name == 'blink':
            d.line([cx - w * 0.95, cy, cx + w * 0.95, cy], fill=EYE, width=max(3, int(h * 0.30)))
        elif name == 'sad':
            # 半分ふせた目＋下がった まゆ
            d.chord([cx - w, cy - h * 0.30, cx + w, cy + h * 1.10], 0, 180, fill=EYE)
            d.line([cx - w * 1.1, cy - h * 1.5, cx + w * 0.6, cy - h * 1.05],
                   fill=(90, 60, 45), width=max(2, int(h * 0.18)))
        elif name == 'effort':
            # きゅっと細める（横長）
            d.ellipse([cx - w, cy - h * 0.55, cx + w, cy + h * 0.75], fill=EYE)
            d.ellipse([cx - w * 0.42, cy - h * 0.40, cx - w * 0.02, cy + h * 0.02],
                      fill=(255, 255, 255))
        else:
            # ふつう／にっこり … まるい目＋ハイライト
            sq = 0.86 if name == 'smile' else 1.0
            d.ellipse([cx - w, cy - h * sq, cx + w, cy + h * sq], fill=EYE)
            d.ellipse([cx - w * 0.46, cy - h * 0.60 * sq, cx - w * 0.02, cy - h * 0.10 * sq],
                      fill=(255, 255, 255))
            d.ellipse([cx + w * 0.28, cy + h * 0.28 * sq, cx + w * 0.56, cy + h * 0.56 * sq],
                      fill=(255, 255, 255))

    # --- 口 ---
    if mb:
        clear(mb, 11)   # 古い口の こい輪郭が 上に残るので 広めに消す
        x0, y0, x1, y1 = mb
        cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
        w = max(6, (x1 - x0) / 2); h = max(5, (y1 - y0) / 2)
        if name == 'happy':
            d.ellipse([cx - w * 1.35, cy - h * 0.95, cx + w * 1.35, cy + h * 1.5], fill=LIP)
            d.ellipse([cx - w * 0.95, cy + h * 0.15, cx + w * 0.95, cy + h * 1.35], fill=IN)
        elif name == 'smile':
            d.arc([cx - w * 1.25, cy - h * 1.5, cx + w * 1.25, cy + h * 1.1],
                  20, 160, fill=LIP, width=max(3, int(h * 0.55)))
        elif name == 'effort':
            d.line([cx - w * 0.95, cy, cx + w * 0.95, cy - h * 0.30],
                   fill=LIP, width=max(3, int(h * 0.6)))
        elif name == 'sad':
            d.arc([cx - w * 1.1, cy + h * 0.1, cx + w * 1.1, cy + h * 2.0],
                  200, 340, fill=LIP, width=max(3, int(h * 0.5)))
        elif name == 'blink':
            d.arc([cx - w * 1.1, cy - h * 1.2, cx + w * 1.1, cy + h * 1.0],
                  20, 160, fill=LIP, width=max(3, int(h * 0.5)))
        else:
            d.ellipse([cx - w, cy - h, cx + w, cy + h], fill=LIP)
            d.ellipse([cx - w * 0.72, cy - h * 0.05, cx + w * 0.72, cy + h * 0.85], fill=IN)


def main():
    show = '--show' in sys.argv
    M = uvmap.load()
    tex = Image.open(TEX).convert('RGB')
    W, H = tex.size
    print('正面から ラスタライズ中…')
    base_img, uvbuf = face_map.rasterize(M, tex)
    RW, RH = base_img.size
    eyes, mouth = detect(base_img)
    if len(eyes) != 2 or not mouth:
        print('★目2つと口が そろわない'); sys.exit(1)
    print('目', [face_map.bbox_of(g) for g in eyes], '口', face_map.bbox_of(mouth[0]))

    # 直すのは 目と口のまわりだけ
    area = []
    for g in eyes + mouth:
        x0, y0, x1, y1 = face_map.bbox_of(g)
        area.append((x0 - 10, y0 - 14, x1 + 10, y1 + 10))

    # はだ色（目のまわりから）
    ip = base_img.load()
    sk = []
    for (x0, y0, x1, y1) in area[:2]:
        for x in range(max(0, x0 - 8), min(RW, x1 + 8)):
            for y in range(max(0, y0 - 8), min(RH, y1 + 8)):
                c = ip[x, y]
                if c[0] > 228 and 180 < c[1] < 240 and 140 < c[2] < 215:
                    sk.append(c)
    skin = tuple(int(sum(c[i] for c in sk) / len(sk)) for i in range(3)) if sk else (247, 210, 155)
    print('はだ色', skin)

    names = ['normal', 'smile', 'effort', 'happy', 'sad', 'blink']
    out = {'w': W, 'h': H, 'expr': {}}
    for nm in names:
        img = base_img.copy()
        if nm != 'normal':
            draw_expr(img, nm, eyes, mouth, skin)
        # 直した画素を テクスチャの座標へ戻す
        canvas = {}
        p = img.load()
        for (x0, y0, x1, y1) in area:
            for y in range(max(0, y0), min(RH, y1 + 1)):
                for x in range(max(0, x0), min(RW, x1 + 1)):
                    q = uvbuf[x][y]
                    if not q:
                        continue
                    tx = min(W - 1, max(0, int(q[0] * W)))
                    ty = min(H - 1, max(0, int((1 - q[1]) * H)))
                    canvas[(tx, ty)] = p[x, y]
        # 近い点どうしを まとめて 四角にする
        pts = sorted(canvas.keys())
        rects = cluster_rects(pts, gap=10)
        patches = []
        for (rx0, ry0, rx1, ry1) in rects:
            w = rx1 - rx0 + 1; h = ry1 - ry0 + 1
            if w * h < 24:
                continue
            im = tex.crop((rx0, ry0, rx1 + 1, ry1 + 1)).copy()
            pp = im.load()
            if nm != 'normal':
                # ★normal は 元のテクスチャそのまま（往復させると ぼける）
                for (tx, ty), c in canvas.items():
                    if rx0 <= tx <= rx1 and ry0 <= ty <= ry1:
                        pp[tx - rx0, ty - ry0] = c
            # すきま（ラスタライズの粗さ）を まわりの色で うめる
            if nm != 'normal':
                fill_gaps(im, {(tx - rx0, ty - ry0) for (tx, ty) in canvas
                               if rx0 <= tx <= rx1 and ry0 <= ty <= ry1})
            buf = io.BytesIO()
            im.save(buf, 'PNG', optimize=True)
            patches.append({'x': rx0, 'y': ry0,
                            'png': base64.b64encode(buf.getvalue()).decode('ascii')})
        out['expr'][nm] = patches
        kb = sum(len(p['png']) for p in patches) / 1024 * 0.75
        print('  %-7s 四角%d こ／%.1fKB' % (nm, len(patches), kb))
        if show:
            os.makedirs(os.path.join(HERE, '_tex'), exist_ok=True)
            img.crop((60, 180, 360, 440)).resize((600, 520), Image.LANCZOS).save(
                os.path.join(HERE, '_tex', '_expr_%s.png' % nm))

    js = ('// 自動生成（tools/face_expr.py）。手で直さない。\n'
          '// オカンの表情。テクスチャの「目と口の四角」だけを 貼りかえるための小さな絵。\n'
          '// ★正面から見た絵の上で描いて、画素ごとに UV へ戻してある\n'
          '//   （目が UV の継ぎ目をまたいでいて、テクスチャに直接は描けないため）\n'
          'window.OKAN_FACES = %s;\n' % json.dumps(out, ensure_ascii=False))
    io.open(OUT_JS, 'w', encoding='utf-8').write(js)
    print('書いた: %s（%.0fKB）' % (OUT_JS, os.path.getsize(OUT_JS) / 1024))


def cluster_rects(pts, gap=10):
    """近い点を まとめて いくつかの四角にする。"""
    rects = []
    for (x, y) in pts:
        hit = None
        for r in rects:
            if x >= r[0] - gap and x <= r[2] + gap and y >= r[1] - gap and y <= r[3] + gap:
                hit = r; break
        if hit:
            hit[0] = min(hit[0], x); hit[1] = min(hit[1], y)
            hit[2] = max(hit[2], x); hit[3] = max(hit[3], y)
        else:
            rects.append([x, y, x, y])
    # 重なった四角を まとめる
    changed = True
    while changed:
        changed = False
        for i in range(len(rects)):
            for j in range(len(rects) - 1, i, -1):
                a, b = rects[i], rects[j]
                if (a[0] <= b[2] + gap and b[0] <= a[2] + gap
                        and a[1] <= b[3] + gap and b[1] <= a[3] + gap):
                    a[0] = min(a[0], b[0]); a[1] = min(a[1], b[1])
                    a[2] = max(a[2], b[2]); a[3] = max(a[3], b[3])
                    rects.pop(j); changed = True
    return [tuple(r) for r in rects]


def fill_gaps(im, filled):
    """書けなかった すきまを となりの色で うめる（ラスタライズが粗いと点々が残る）。"""
    W, H = im.size
    p = im.load()
    for _ in range(2):
        add = []
        for y in range(H):
            for x in range(W):
                if (x, y) in filled:
                    continue
                near = [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                        if (x + dx, y + dy) in filled]
                if len(near) >= 3:
                    r = g = b = 0
                    for q in near:
                        c = p[q]
                        r += c[0]; g += c[1]; b += c[2]
                    n = len(near)
                    p[x, y] = (r // n, g // n, b // n)
                    add.append((x, y))
        filled |= set(add)
        if not add:
            break


if __name__ == '__main__':
    main()
