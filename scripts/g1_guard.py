# -*- coding: utf-8 -*-
u"""出力先が本番でないことを確かめる関所。

試行の道具（g1_from_old.py / g1_join.py / g1_verify.py）は必ずここを通す。
**本番の原簿・アプリデータ・既存の作業フォルダへは、引数をどう与えても書けない。**

許すのは `docs/_genbo/_trial…` の下だけ。
"""
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOW_PARENT = os.path.join(BASE, "docs", "_genbo")

# ここに入ったら即座に止める（読むのは可、書くのは不可）
FORBID = [
    os.path.join(BASE, "data"),
    os.path.join(BASE, "js"),
    os.path.join(BASE, "docs", "_genbo", "g5enshu3"),
    os.path.join(BASE, "docs", "_audit"),
]


def _under(path, parent):
    try:
        return os.path.commonpath([os.path.abspath(path), os.path.abspath(parent)]) \
            == os.path.abspath(parent)
    except ValueError:          # ドライブがちがう
        return False


def assert_safe_out_dir(out_dir):
    p = os.path.abspath(out_dir)

    # 原簿そのもの（memory 側）は絶対に書き先にしない
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from genbo_path import find_genbo
    g = find_genbo(required=False)
    if g and _under(p, os.path.dirname(g)):
        sys.exit(u"✗ 出力先が原簿のフォルダです: %s" % p)

    for bad in FORBID:
        if _under(p, bad):
            sys.exit(u"✗ 出力先が本番のフォルダです: %s" % p)

    if not _under(p, ALLOW_PARENT):
        sys.exit(u"✗ 出力先は docs/_genbo/_trial… の下だけです: %s" % p)

    name = os.path.basename(p.rstrip(os.sep))
    top = p
    while os.path.dirname(top) != os.path.abspath(ALLOW_PARENT):
        nxt = os.path.dirname(top)
        if nxt == top:
            break
        top = nxt
    if not os.path.basename(top).startswith("_trial"):
        sys.exit(u"✗ 出力先は `_trial` で始まるフォルダの下だけです: %s（いま %s）"
                 % (p, os.path.basename(top)))
    return p


def assert_not_production_file(path):
    u"""1ファイル単位の関所（うっかり本番JSONを書かないため）。"""
    p = os.path.abspath(path)
    for bad in FORBID:
        if _under(p, bad):
            sys.exit(u"✗ 本番のファイルには書けません: %s" % p)
    return p
