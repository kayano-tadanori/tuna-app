# -*- coding: utf-8 -*-
u"""小5 テーマ教材の「回番号 → どの分冊の本か」を1か所に集める。

★回番号で決まる（No.1-10＝第1分冊／11-20＝第2分冊／21-30＝第3分冊）。
  `theme3_prep.py` と `theme3_ship.py` は両方ここを見る。2か所に書かない。
"""
import os

PDF_DIR = r'C:\Users\User\Desktop\浜問題\_結合\小5'
# 分冊 → (回の範囲, 本の名前, PDFのファイル名の中ほど)
BOOKS = {1: ((1, 10), u'第1分冊', 'No.01-10'),
         2: ((11, 20), u'第2分冊', 'No.11-20'),
         3: ((21, 30), u'第3分冊', 'No.21-30')}


def book_of(no):
    u"""回番号 → (分冊番号, 本の名前, 問題PDF, 解答PDF)。範囲の外なら止める。"""
    for bu, ((lo, hi), name, tag) in sorted(BOOKS.items()):
        if lo <= no <= hi:
            f = os.path.join(PDF_DIR, u'小5_算数_テーマ教材_%s_%s_%%s.pdf' % (name, tag))
            return bu, name, f % u'問題', f % u'解答'
    raise SystemExit(u'No.%d は小5テーマ教材の範囲（No.1〜30）に無い' % no)


def work_dir(base, no):
    u"""作業フォルダ。第3分冊は既存の `theme3_no22` と同じ名前になる。"""
    return os.path.join(base, 'docs/_genbo/theme%d_no%d' % (book_of(no)[0], no))


def trial_prefix(no):
    u"""仮IDの頭。第3分冊は既存どおり `TRIAL-T3-<回>-`。"""
    return u'TRIAL-T%d-%d-' % (book_of(no)[0], no)
