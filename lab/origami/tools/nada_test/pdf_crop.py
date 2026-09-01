# -*- coding: utf-8 -*-
"""原本PDF（浜問題/折紙問題/*.pdf）を高解像度で切り出して読む道具。

原簿を取るとき・「原本の図から特定できない」と書かれた問題を見直すときに使う。
150dpiでは図がつぶれるが、**600dpi以上に上げるとこの資料の図と手書き解説はどれも読める**。
問題ページだけでなく、**解答ページの図と丸数字まで**読むこと（そこに構成が全部書いてある）。

使い方
  python pdf_crop.py <PDF>                              … 全ページを110dpiで _out/ へ
  python pdf_crop.py <PDF> <頁> <x0> <y0> <x1> <y1> [dpi] … その範囲を切り出す
  ※ 座標は「110dpiで書き出した画像の画素」で指定する（上の全ページ出力と同じ物差し）
"""
import os
import sys

import fitz  # PyMuPDF

os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out', exist_ok=True)

DEFAULT_PDF = r"C:\Users\User\Desktop\浜問題\折紙問題\折り紙問題03.pdf"
src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
doc = fitz.open(src)


def crop(page, x0, y0, x1, y1, name, dpi=600):
    """110dpi画像の画素で範囲を指定して、その部分だけ高解像度で書き出す"""
    k = 72 / 110.0
    r = fitz.Rect(x0 * k, y0 * k, x1 * k, y1 * k)
    pix = doc[page].get_pixmap(dpi=dpi, clip=r)
    pix.save(name)
    print(name, pix.width, pix.height)
    return name


def overview(page, dpi=110):
    """まずページ全体を書き出して、切り出す範囲を目で決める"""
    pix = doc[page].get_pixmap(dpi=dpi)
    out = "_out/ov_p%02d.png" % (page + 1)
    pix.save(out)
    return out, pix.width, pix.height


if __name__ == "__main__":
    if len(sys.argv) >= 7:
        pg = int(sys.argv[2]) - 1
        x0, y0, x1, y1 = [float(v) for v in sys.argv[3:7]]
        dpi = int(sys.argv[7]) if len(sys.argv) > 7 else 600
        crop(pg, x0, y0, x1, y1, "_out/crop_p%02d.png" % (pg + 1), dpi)
    else:
        for i in range(doc.page_count):
            print(overview(i))
