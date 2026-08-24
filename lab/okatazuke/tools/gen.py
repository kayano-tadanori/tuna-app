# -*- coding: utf-8 -*-
"""
面の候補を作る道具（逆行作成法）。

資料の指針：
  「まずクリア状態を置き、そこからルールを逆行させて にもつを『引きながら』散らす。
   その散らばった状態を初期配置にすれば、理論上かならずクリアできる面になる」
  そのうえで ソルバーで「本当に解けるか」「最小手数は何手か」を測る。

ただし逆行で散らしただけでは「ただ広いだけの作業面」になりがちなので、
下の score() で 良い面／悪い面 をふるいにかける。
  ・一本道すぎる面（押せる手がいつも1つ）＝作業。落とす
  ・遠回りの少ない面（まっすぐ運ぶだけ）＝退屈。落とす
  ・順番の制約がない面＝ジレンマが無い。点を下げる
"""
import random
import sys
from collections import deque

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from sokoban import Level, DIRS, solve, replay, normalize  # noqa: E402


def render(w, h, walls, goals, boxes, player):
    out = []
    for y in range(h):
        row = []
        for x in range(w):
            p = (x, y)
            if p in walls:
                c = '#'
            elif p == player:
                c = '+' if p in goals else '@'
            elif p in boxes:
                c = '*' if p in goals else '$'
            elif p in goals:
                c = '.'
            else:
                c = ' '
            row.append(c)
        out.append(''.join(row).rstrip())
    return out


def reverse_generate(walls, w, h, goals, start_player, steps=260, rng=random, want=1):
    """クリア状態から にもつを引いて散らす。
    ★1つだけ返すと「たまたま散った形」しか見られないので、候補をたくさん集めて返す
      （呼ぶ側でソルバーにかけて採点し、良いものを選ぶ）。"""
    floor = set()
    for y in range(h):
        for x in range(w):
            if (x, y) not in walls:
                floor.add((x, y))
    boxes = set(goals)
    player = start_player
    pool = []
    seen = set()
    for _ in range(steps):
        cand = []
        for dx, dy, _ch in DIRS:
            np_ = (player[0] + dx, player[1] + dy)
            if np_ in walls or np_ in boxes or np_ not in floor:
                continue
            # ただ歩くだけ
            cand.append((np_, None, None))
            # にもつを引く（引く先＝いま自分がいるマス）
            bp = (player[0] - dx, player[1] - dy)
            if bp in boxes:
                cand.append((np_, bp, player))
        if not cand:
            break
        # 引ける手があるときは引くほうを重めに選ぶ（ただ歩き回るのを防ぐ）
        pulls = [c for c in cand if c[1] is not None]
        if pulls and rng.random() < 0.72:
            np_, bfrom, bto = rng.choice(pulls)
        else:
            np_, bfrom, bto = rng.choice(cand)
        if bfrom is not None:
            boxes.discard(bfrom); boxes.add(bto)
        player = np_
        key = (player, frozenset(boxes))
        if key in seen:
            continue
        seen.add(key)
        # ★にもつが1つでも おきばに残っていたら候補にしない（始めから半分できている面になる）
        off = sum(1 for b in boxes if b not in goals)
        if off < len(goals):
            continue
        pool.append((frozenset(boxes), player))
    if not pool:
        return []
    rng.shuffle(pool)
    return pool[:want]


def score(level, res):
    """良い面かどうかの採点。返り値 (点, 内わけ)。"""
    info = {}
    pushes = res['pushes']
    # 1) 遠回り度：最短の見つもり（にもつ→いちばん近いおきば）に対して何倍押すか
    lower = 0
    for b in level.boxes:
        lower += min(abs(b[0] - g[0]) + abs(b[1] - g[1]) for g in level.goals)
    info['lower'] = lower
    info['detour'] = pushes / lower if lower else 1.0
    # 2) 自由度：解いていく途中で「押せる手」が平均いくつあるか
    branch = branch_factor(level, res['path'])
    info['branch'] = branch
    # 3) 大きさに対する濃さ
    area = len(level.floor)
    info['area'] = area
    info['density'] = pushes / area
    sc = 0.0
    sc += min(info['detour'], 3.0) * 22          # 遠回りするほど良い（上限あり）
    sc += min(branch, 6.0) * 9                   # 一本道は退屈
    sc += min(info['density'], 2.0) * 26         # 狭いのに手数が多い＝凝縮
    if branch < 1.35:
        sc -= 45                                  # ほぼ一本道は作業面
    if info['detour'] < 1.25:
        sc -= 30                                  # まっすぐ運ぶだけ
    return sc, info


def branch_factor(level, path):
    """手順をなぞりながら、その時点で『押せる にもつ×向き』が何通りあったかの平均。"""
    px, py = level.player
    boxes = set(level.boxes)
    dead = level.simple_deadsquares()
    counts = []
    for ch in path:
        d = [x for x in DIRS if x[2] == ch][0]
        dx, dy = d[0], d[1]
        n = (px + dx, py + dy)
        if n in boxes:
            # この時点の選択肢を数える
            reach = {(px, py)}
            q = deque([(px, py)])
            while q:
                x, y = q.popleft()
                for ex, ey, _ in DIRS:
                    p = (x + ex, y + ey)
                    if p in reach or p in level.walls or p in boxes or p not in level.floor:
                        continue
                    reach.add(p); q.append(p)
            k = 0
            for b in boxes:
                for ex, ey, _ in DIRS:
                    stand = (b[0] - ex, b[1] - ey)
                    dest = (b[0] + ex, b[1] + ey)
                    if stand in reach and dest not in level.walls and dest not in boxes \
                       and dest in level.floor and dest not in dead:
                        nb = frozenset((boxes - {b}) | {dest})
                        if not level.frozen_deadlock(nb):
                            k += 1
            counts.append(k)
            nn = (n[0] + dx, n[1] + dy)
            boxes.discard(n); boxes.add(nn)
        px, py = n
    return sum(counts) / len(counts) if counts else 0.0


# ---- 部屋の型（かべの形）。ここは手で書く。逆行はにもつの散らしだけに使う ----
TEMPLATES = {
    # 記号：# かべ / . おきば候補になれる床 / 空白 床
    'room7': [
        '#######',
        '#     #',
        '#     #',
        '#     #',
        '#     #',
        '#     #',
        '#######',
    ],
    'pillar8': [
        '########',
        '#      #',
        '#  ##  #',
        '#      #',
        '#  ##  #',
        '#      #',
        '########',
    ],
    'lshape': [
        '#########',
        '#   #   #',
        '#   #   #',
        '#       #',
        '#   #   #',
        '#####   #',
        '    #####',
    ],
    'corridor': [
        '##########',
        '#    #   #',
        '#    #   #',
        '#        #',
        '#  ###   #',
        '#        #',
        '##########',
    ],
    'cross': [
        '#########',
        '###   ###',
        '###   ###',
        '#       #',
        '#       #',
        '#       #',
        '###   ###',
        '###   ###',
        '#########',
    ],
    'wide9': [
        '#########',
        '#       #',
        '#  # #  #',
        '#       #',
        '#  # #  #',
        '#       #',
        '#########',
    ],
    'notch': [
        '#########',
        '#   #   #',
        '#       #',
        '## #### #',
        '#       #',
        '#   #   #',
        '#########',
    ],
}


def gen_from_template(tname, nbox, seed, tries=40):
    rng = random.Random(seed)
    rows = TEMPLATES[tname]
    h = len(rows)
    w = max(len(r) for r in rows)
    walls = set()
    cells = []
    for y, r in enumerate(rows):
        for x in range(w):
            c = r[x] if x < len(r) else '#'
            if c == '#':
                walls.add((x, y))
            else:
                cells.append((x, y))
    best = None
    for _ in range(tries):
        # おきばを選ぶ。角は避ける（資料：初心者向けはおきばを角から離す）
        pool = [c for c in cells if not is_corner(c, walls)]
        if len(pool) < nbox + 2:
            return None
        goals = set(rng.sample(pool, nbox))
        rest = [c for c in cells if c not in goals]
        if not rest:
            continue
        player = rng.choice(rest)
        cands = reverse_generate(walls, w, h, goals, player,
                                 steps=260 + nbox * 120, rng=rng, want=6)
        for boxes, pl in cands:
            rows2 = render(w, h, walls, goals, boxes, pl)
            lv = Level(rows2)
            if lv.validate():
                continue
            res = solve(lv, max_states=120000)
            if not res.get('solved'):
                continue
            ok, _ = replay(lv, res['path'])
            if not ok:
                continue
            sc, info = score(lv, res)
            if best is None or sc > best[0]:
                best = (sc, rows2, res, info)
    return best


def is_corner(c, walls):
    x, y = c
    hz = ((x - 1, y) in walls) or ((x + 1, y) in walls)
    vt = ((x, y - 1) in walls) or ((x, y + 1) in walls)
    return hz and vt


if __name__ == '__main__':
    tname = sys.argv[1] if len(sys.argv) > 1 else 'room7'
    nbox = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    out = []
    for seed in range(n):
        r = gen_from_template(tname, nbox, seed * 7919 + 13)
        if not r:
            continue
        sc, rows, res, info = r
        out.append((sc, rows, res, info, seed))
    out.sort(key=lambda t: -t[0])
    for sc, rows, res, info, seed in out[:8]:
        print(';%s box=%d seed=%d score=%.1f pushes=%d moves=%d detour=%.2f branch=%.2f' %
              (tname, nbox, seed, sc, res['pushes'], res['moves'], info['detour'], info['branch']))
        print('\n'.join(rows))
        print()
