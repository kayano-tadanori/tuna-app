# -*- coding: utf-8 -*-
"""原簿（hamagakuen_ryomon_genbo.md）の置き場所を見つける。

原簿は memory 側にあり、リポジトリには入れない（浜学園の著作物のため）。
そして .claude/projects の下のフォルダ名は**PCごとに変わる**ので決め打ちできない。

  家PC   …/.claude/projects/c--Users-User-Desktop-Claude/memory/…
  実家PC …/.claude/projects/C--Users-------Desktop-Claude/memory/…

環境変数 GENBO があればそれを最優先で使う。
"""
import glob
import os
import sys

NAME = "hamagakuen_ryomon_genbo.md"


def find_genbo(required=True):
    env = os.environ.get("GENBO")
    if env and os.path.exists(env):
        return env
    pat = os.path.join(os.path.expanduser("~"), ".claude", "projects", "*", "memory", NAME)
    hits = sorted(glob.glob(pat), key=os.path.getmtime, reverse=True)
    if hits:
        return hits[0]
    if required:
        sys.stderr.write(
            "✗ 原簿(%s)が見つからない。\n"
            "  環境変数 GENBO にフルパスを入れて実行する：\n"
            '  $env:GENBO="C:\\...\\memory\\%s"\n' % (NAME, NAME))
        sys.exit(1)
    return None
