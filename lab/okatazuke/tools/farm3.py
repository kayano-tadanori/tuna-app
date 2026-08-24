# -*- coding: utf-8 -*-
"""むずかしい面を作る（村瀬1998の3段：作成 → 解答 → 評価 ＋ 山のぼり）。

  1. 作成 … 部屋の型から 逆行作成法で 候補をたくさん作る
  2. 解答 … ソルバーで 本当に解けるか確かめる（解けないものは その場で捨てる）
  3. 評価 … difficulty.py で むずかしさを測る
  4. 山のぼり … 良かったものを少しずつ いじって、むずかしさが上がったら採用
     （かべを1つ足す／消す・おきばを動かす・にもつを動かす）

★ここで作る面は ぜんぶ自作。既存ゲームの面データは 1つも使っていない。
"""
import io
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sokoban import Level  # noqa: E402
import difficulty  # noqa: E402
import gen  # noqa: E402

CAP = 300000          # ソルバーが これ以上ふくらむ面は 人にも無理なので捨てる

# ---- 部屋の型（ジレンマが生まれるように、中に かべ と 通路を作る）----
TEMPLATES = {
    'room8': [
        '##########', '#        #', '#        #', '#        #',
        '#        #', '#        #', '##########',
    ],
    'tworooms': [
        '###########', '#    #    #', '#    #    #', '#         #',
        '#    #    #', '#    #    #', '###########',
    ],
    'plus': [
        '##########', '###    ###', '#        #', '#        #',
        '#        #', '#        #', '###    ###', '##########',
    ],
    'combs': [
        '##########', '#        #', '# # # #  #', '#        #',
        '# # # #  #', '#        #', '##########',
    ],
    'hall': [
        '###########', '#         #', '# ####### #', '#         #',
        '# ####### #', '#         #', '###########',
    ],
    'nook': [
        '##########', '#  #     #', '#  #  #  #', '#     #  #',
        '####  #  #', '#        #', '#  ####  #', '#        #', '##########',
    ],
    'zigzag': [
        '##########', '#        #', '#  ####  #', '#        #',
        '#  ####  #', '#        #', '#  ####  #', '#        #', '##########',
    ],
    'corner4': [
        '##########', '#   ##   #', '#        #', '#        #',
        '## #  # ##', '#        #', '#        #', '#   ##   #', '##########',
    ],
    'store': [
        '###########', '#   #     #', '#   #     #', '#         #',
        '#####  ####', '#         #', '#   #     #', '###########',
    ],
    'tight7': [
        '#########', '#       #', '#  ###  #', '#       #',
        '#  ###  #', '#       #', '#########',
    ],
}
gen.TEMPLATES.update(TEMPLATES)


def render(rows):
    return '\n'.join(rows)


def cells_of(rows):
    walls, floor = set(), set()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            (walls if c == '#' else floor).add((x, y))
    return walls, floor


def perturb(rows, rng):
    """1か所だけ いじる。壊れた形になったら None を返す。"""
    grid = [list(r.ljust(max(len(x) for x in rows))) for r in rows]
    h = len(grid); w = len(grid[0])
    inner = [(x, y) for y in range(1, h - 1) for x in range(1, w - 1)]
    kind = rng.random()
    for _ in range(30):
        x, y = rng.choice(inner)
        c = grid[y][x]
        if kind < 0.34:
            # かべを 足す / 消す
            if c == ' ':
                grid[y][x] = '#'
            elif c == '#':
                grid[y][x] = ' '
            else:
                continue
            break
        elif kind < 0.67:
            # おきばを 1つ 動かす
            gs = [(gx, gy) for gy in range(h) for gx in range(w) if grid[gy][gx] in '.*+']
            if not gs:
                return None
            gx, gy = rng.choice(gs)
            if grid[y][x] != ' ':
                continue
            grid[gy][gx] = {'.': ' ', '*': '$', '+': '@'}[grid[gy][gx]]
            grid[y][x] = '.'
            break
        else:
            # にもつを 1つ 動かす
            bs = [(bx, by) for by in range(h) for bx in range(w) if grid[by][bx] in '$*']
            if not bs:
                return None
            bx, by = rng.choice(bs)
            if grid[y][x] != ' ':
                continue
            grid[by][bx] = {'$': ' ', '*': '.'}[grid[by][bx]]
            grid[y][x] = '$'
            break
    else:
        return None
    return [''.join(r).rstrip() for r in grid]


def evaluate(rows):
    lv = Level(rows)
    if lv.validate():
        return None
    return difficulty.analyze(lv, max_states=CAP)


def climb(rows, rng, iters=26):
    best = evaluate(rows)
    if not best:
        return None, None
    bestRows = rows
    for _ in range(iters):
        cand = perturb(bestRows, rng)
        if not cand:
            continue
        a = evaluate(cand)
        if a and a['score'] > best['score']:
            best, bestRows = a, cand
    return best, bestRows


def main():
    out_path = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else '_hard.txt')
    jobs = []
    for t in TEMPLATES:
        for nb in (4, 5, 6):
            jobs.append((t, nb))
    results = []
    for tname, nbox in jobs:
        for seed in range(6):
            rng = random.Random(seed * 7919 + nbox * 977 + hash(tname) % 1000)
            r = gen.gen_from_template(tname, nbox, seed * 104729 + nbox * 31, tries=8)
            if not r:
                continue
            _, rows, _, _ = r
            a, rows2 = climb(rows, rng, iters=22)
            if not a:
                continue
            results.append((a['score'], tname, nbox, rows2, a))
            print('%-9s にもつ%d seed%d → むずかしさ %.1f（おした%d 盤面%d 詰む手%.0f%%）'
                  % (tname, nbox, seed, a['score'], a['pushes'], a['nodes'], a['fatal'] * 100),
                  flush=True)
    results.sort(key=lambda t: -t[0])
    with io.open(out_path, 'w', encoding='utf-8') as f:
        f.write('; むずかしい面の候補（自作）。数字は実測した むずかしさ\n\n')
        for sc, tname, nbox, rows, a in results:
            f.write(';%s box=%d score=%.1f pushes=%d moves=%d nodes=%d fatal=%.2f tight=%.2f\n'
                    % (tname, nbox, sc, a['pushes'], a['moves'], a['nodes'], a['fatal'], a['tight']))
            f.write('\n'.join(rows) + '\n\n')
    print('書いた:', out_path, len(results))


if __name__ == '__main__':
    main()
