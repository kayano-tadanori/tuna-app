# -*- coding: utf-8 -*-
u"""小5 演習教材（算数2ndの宿題）の「回番号 → どの分冊の本か」を1か所に集める。

★回番号で決まる（No.1-10＝第1分冊／11-20＝第2分冊／21-30＝第3分冊）。
  `enshu_prep.py` と `enshu_ship.py` は両方ここを見る。2か所に書かない。
★第3分冊は G1→G23 方式より前に別の作り方で済ませてある（docs/_genbo/g5enshu3）。
  ここの道具で作り直さない。
"""
import os

PDF_DIR = r'C:\Users\User\Desktop\浜問題\_結合\小5'
BOOKS = {1: ((1, 10), u'第1分冊', 'No.01-10'),
         2: ((11, 20), u'第2分冊', 'No.11-20'),
         3: ((21, 30), u'第3分冊', 'No.21-30')}


def book_of(no):
    u"""回番号 → (分冊番号, 本の名前, 問題PDF, 解答PDF)。範囲の外なら止める。"""
    for bu, ((lo, hi), name, tag) in sorted(BOOKS.items()):
        if lo <= no <= hi:
            f = os.path.join(PDF_DIR, u'小5_算数_演習教材_%s_%s_%%s.pdf' % (name, tag))
            return bu, name, f % u'問題', f % u'解答'
    raise SystemExit(u'No.%d は小5演習教材の範囲（No.1〜30）に無い' % no)


def work_dir(base, no):
    return os.path.join(base, 'docs/_genbo/enshu%d_no%d' % (book_of(no)[0], no))


def trial_prefix(no):
    u"""仮IDの頭。印刷ラベル（B1・C10）をうしろに付ける＝`TRIAL-E2-11-B1`。"""
    return u'TRIAL-E%d-%d-' % (book_of(no)[0], no)


def material(no):
    u"""原簿の見出しの頭。第3分冊の既存レコード（`小5 演習教材 第3分冊 No.21 …`）にそろえる。
    ★「小5 算数 演習教材」にすると genbo_common.COURSE_PAT（`^小5\\s*演習教材`）に当たらず、
      検査の分母から落ちる（テーマ教材の「小5 算数 テーマ教材」がそうなっている）。"""
    return u'小5 演習教材 %s' % book_of(no)[1]
