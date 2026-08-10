# -*- coding: utf-8 -*-
"""浜学園のPDFから、図を見るためにページを1枚ずつ高解像度で出す。

★原簿には図そのものが入っていない（「図: あり」という記述だけ）。
  図の根拠はこのPDFしかないので、図を描くときは必ずここを見る。
  見て描けないものは描かない（method_svg_check の決めごと）。

使い方:
  python scripts/_render_page.py <pdf> <出力フォルダ> <dpi> <PDFページ番号(1始まり)…>
  例) python scripts/_render_page.py "G:/...第1講座.pdf" out 220 7 8 9
"""
import sys, os
import pymupdf
from PIL import Image, ImageChops


def trim(im):
    bg = Image.new("RGB", im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg).convert("L").point(lambda x: 255 if x > 40 else 0)
    bb = diff.getbbox()
    if bb:
        p = 8
        im = im.crop((max(0, bb[0] - p), max(0, bb[1] - p),
                      min(im.width, bb[2] + p), min(im.height, bb[3] + p)))
    return im


def main():
    pdf, outdir, dpi = sys.argv[1], sys.argv[2], int(sys.argv[3])
    pages = [int(x) for x in sys.argv[4:]]
    os.makedirs(outdir, exist_ok=True)
    d = pymupdf.open(pdf)
    for p in pages:
        pm = d[p - 1].get_pixmap(dpi=dpi)
        im = trim(Image.frombytes("RGB", (pm.width, pm.height), pm.samples))
        path = os.path.join(outdir, "p%03d.png" % p)
        im.save(path)
        print(path, im.size)


main()
