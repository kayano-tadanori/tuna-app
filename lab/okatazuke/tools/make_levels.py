# -*- coding: utf-8 -*-
"""面データ js/levels.js を作る。ここが唯一の入口。

  1. 自作の「教える面」（levels_src.txt）を読む
  2. 取りこんだステージ（_imported.json）を読む
  3. どちらも **同じ物差し**（difficulty.py）で むずかしさを測る
  4. むずかしさの順に ならべ、4段（やさしい/ふつう/むずかしい/ゲキむず）に分ける
  5. 1面ずつ「本当に解ける」ことを確かめてから書き出す
     （解けない面は 資料でいう いちばん悪い面。1つでもあれば 書かない）

★面に名前は付けない（本人の指示 2026-08-23）。番号と むずかしさだけ。
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sokoban  # noqa: E402
import difficulty  # noqa: E402

OUT = os.path.join(HERE, '..', 'js', 'levels.js')
IMPORTED = os.path.join(HERE, '_imported.json')
CAP = 60000

# むずかしさの 段の切れ目（実測した数字で決める）
TIER_CUTS = [60.0, 100.0, 150.0]


# 自作の面。levels_src.txt だけ ひとこと（ヒント）を持つ。
# ★取りこんだ面は いちばん やさしいものでも むずかしさ93。教える面は24〜45なので
#   あいだが 空きすぎる。自作の中間の面を 橋渡しとして入れる。
MINE_FILES = ['levels_src.txt', 'levels_normal.txt', 'levels_hard.txt', 'levels_extra.txt']


def load_mine():
    out = []
    for fname in MINE_FILES:
        out += _load_one(os.path.join(HERE, fname), fname == 'levels_src.txt')
    return out


def _load_one(path, with_hint):
    if not os.path.exists(path):
        return []
    out = []
    for lv in sokoban.parse_collection(io.open(path, encoding='utf-8').read()):
        hint = (lv.name.split('|')[1].strip() if (with_hint and '|' in lv.name) else '')
        errs = lv.validate()
        if errs:
            print('★自作の面が おかしい:', lv.name, errs); sys.exit(1)
        a = difficulty.analyze(lv, max_states=CAP)
        if not a:
            print('★自作の面が 解けない:', lv.name); sys.exit(1)
        out.append({
            'rows': [r.rstrip() for r in lv.rows], 'hint': hint,
            'par': a['pushes'], 'parMoves': a['moves'], 'boxes': a['boxes'],
            'score': a['score'], 'nodes': a['nodes'], 'capped': a['capped'],
            'from': 'mine',
        })
    return out


def load_imported():
    if not os.path.exists(IMPORTED):
        return []
    data = json.loads(io.open(IMPORTED, encoding='utf-8').read())
    out = []
    for d in data:
        out.append({
            'rows': d['rows'], 'hint': '',
            'par': d['par'], 'parMoves': d['parMoves'], 'boxes': d['boxes'],
            'score': d['score'], 'nodes': d['nodes'], 'capped': d['capped'],
            'from': 'set',
        })
    return out


def main():
    levels = load_mine() + load_imported()
    if not levels:
        print('面が1つも無い'); sys.exit(1)
    levels.sort(key=lambda d: d['score'])
    for d in levels:
        d['tier'] = difficulty.tier_of(d['score'], TIER_CUTS)

    # 最後にもう一度、全部が 本当に解けるか（自作は解いて、取りこみは検算ずみ）
    bad = [i for i, d in enumerate(levels) if d['par'] <= 0]
    if bad:
        print('★手数が 0 の面がある:', bad); sys.exit(1)

    body = ',\n'.join(
        '  { t: %d, par: %d, pm: %d, b: %d, d: %.1f%s, rows: %s }'
        % (d['tier'], d['par'], d['parMoves'], d['boxes'], d['score'],
           (', hint: ' + json.dumps(d['hint'], ensure_ascii=False)) if d['hint'] else '',
           json.dumps(d['rows'], ensure_ascii=False))
        for d in levels)
    tiers = [0, 0, 0, 0]
    for d in levels:
        tiers[d['tier']] += 1
    js = ('// ============================================================\n'
          '// levels.js — 面データ（tools/make_levels.py が作る。手で直さない）\n'
          '//   t   … むずかしさの段（0=やさしい 1=ふつう 2=むずかしい 3=ゲキむず）\n'
          '//   par … 最少の おした数（★3の基準）  pm … そのときの あるいた数\n'
          '//   b   … にもつの数        d … 実測した むずかしさ\n'
          '//   ★ならびは むずかしさの順。名前は付けない。\n'
          '//   全%d面（やさしい%d／ふつう%d／むずかしい%d／ゲキむず%d）\n'
          '//   作りなおす： python tools/make_levels.py\n'
          '// ============================================================\n'
          "'use strict';\n\n"
          'const OK_LEVELS = [\n%s,\n];\n' % (len(levels), tiers[0], tiers[1], tiers[2], tiers[3], body))
    io.open(OUT, 'w', encoding='utf-8').write(js)
    print('全%d面（やさしい%d／ふつう%d／むずかしい%d／ゲキむず%d）'
          % (len(levels), tiers[0], tiers[1], tiers[2], tiers[3]))
    print('むずかしさ %.1f 〜 %.1f' % (levels[0]['score'], levels[-1]['score']))
    print('書いた:', os.path.normpath(OUT))


if __name__ == '__main__':
    main()
