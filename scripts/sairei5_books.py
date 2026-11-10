# -*- coding: utf-8 -*-
u"""小5 最レ算数（第1講座・第2講座）の「回番号 → 本・作業フォルダ・仮ID」を1か所に集める（2026-11-10）。

★`_結合/小5/` の本は1講座1冊（No.01-42）。第4分冊＝No.31〜42 がまだ原簿に無い。
  `sairei5_prep.py` と `sairei5_ship.py` は両方ここを見る。2か所に書かない。
"""
import os, re

PDF_DIR = r'G:\マイドライブ\浜問題\_結合\小5'


def book_of(k, no):
    u"""(講座, 回) → (分冊の名前, 問題PDF, 解答PDF)"""
    if k not in (1, 2) or not (1 <= no <= 42):
        raise SystemExit(u'第%d講座 No.%d は範囲外（第1・2講座／No.1〜42）' % (k, no))
    bu = (no - 1) // 10 + 1 if no <= 30 else 4
    f = os.path.join(PDF_DIR, u'小5_最レ算数_第%d講座_No.01-42_%%s.pdf' % k)
    return u'第%d分冊' % bu, f % u'問題', f % u'解答'


def work_dir(base, k, no):
    return os.path.join(base, 'docs/_genbo/sairei5_k%d_no%d' % (k, no))


def trial_prefix(k, no):
    return u'TRIAL-S5K%d-%d-' % (k, no)


def toc_starts(pdf):
    u"""しおりの {回: 開始ページ}"""
    import fitz
    out = {}
    for lv, t, pg in fitz.open(pdf).get_toc():
        m = re.match(r'No\.(\d+)\s*(.*)', t)
        if lv == 1 and m:
            out[int(m.group(1))] = (pg, m.group(2).strip())
    return out


def unit_name(title):
    u"""回の題名 → アプリの unit（最レは単元名で引く）。`総合単元(2)…倍数の条件` → `倍数の条件`"""
    return title.split(u'…')[-1].strip() if u'…' in title else title


def lesson_part(title):
    u"""hama_map の回の題名に入れる形（No.30＝`立体図形の性質・総合単元(1)`）。`…` から後ろは落とす"""
    return title.split(u'…')[0].strip()
