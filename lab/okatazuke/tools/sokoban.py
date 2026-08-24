# -*- coding: utf-8 -*-
"""
にもつを おす パズル（オカンの おかたづけ）の検証エンジン。

★これは「面が本当に解けるか」を機械で確かめるための道具。
　NotebookLM の資料いわく、いちばん悪い面は「クリア不可能な面」。
　人の目で解けたつもりになるのは信用しない（[[feedback_verify_mechanism_not_just_answer]]）。

盤面のテキスト表記（倉庫番系で共通の書きかた。データ形式であって面の中身ではない）
  #  かべ
  空白 ゆか
  $  にもつ
  .  おきば（目的地）
  *  おきばの上のにもつ
  @  オカン
  +  おきばの上のオカン
"""
import sys
from collections import deque
import heapq

DIRS = [(0, -1, 'U'), (0, 1, 'D'), (-1, 0, 'L'), (1, 0, 'R')]


class Level:
    def __init__(self, rows, name=''):
        self.name = name
        self.rows = [r.rstrip('\n') for r in rows]
        w = max(len(r) for r in self.rows)
        self.w = w
        self.h = len(self.rows)
        self.walls = set()
        self.goals = set()
        self.boxes = set()
        self.player = None
        for y, r in enumerate(self.rows):
            for x in range(w):
                c = r[x] if x < len(r) else ' '
                p = (x, y)
                if c == '#':
                    self.walls.add(p)
                elif c == '.':
                    self.goals.add(p)
                elif c == '$':
                    self.boxes.add(p)
                elif c == '*':
                    self.goals.add(p); self.boxes.add(p)
                elif c == '@':
                    self.player = p
                elif c == '+':
                    self.goals.add(p); self.player = p
        self.floor = self._flood()
        self._simple_deadsq = None

    def _flood(self):
        """オカンが行ける床（にもつを無視して）。外がわの余白を除くのに使う。"""
        if self.player is None:
            return set()
        seen = {self.player}
        q = deque([self.player])
        while q:
            x, y = q.popleft()
            for dx, dy, _ in DIRS:
                p = (x + dx, y + dy)
                if p in seen or p in self.walls:
                    continue
                if not (0 <= p[0] < self.w and 0 <= p[1] < self.h):
                    continue
                seen.add(p); q.append(p)
        return seen

    def validate(self):
        """面として成り立っているか。返り値は問題点のリスト（空なら合格）。"""
        errs = []
        if self.player is None:
            errs.append('オカンがいない')
        if len(self.boxes) != len(self.goals):
            errs.append('にもつ%d個 / おきば%d個 で数が合わない' % (len(self.boxes), len(self.goals)))
        if not self.boxes:
            errs.append('にもつが0個')
        for b in self.boxes:
            if b not in self.floor:
                errs.append('にもつ%s にオカンが到達できない' % (b,))
        for g in self.goals:
            if g not in self.floor:
                errs.append('おきば%s にオカンが到達できない' % (g,))
        # 外へ漏れていないか（床が盤の外周に接していたら囲いが破れている）
        for (x, y) in self.floor:
            if x <= 0 or y <= 0 or x >= self.w - 1 or y >= self.h - 1:
                errs.append('かべの囲いが破れている（%d,%d が外に接している）' % (x, y))
                break
        return errs

    # ---- 詰み（デッドロック）判定 ----------------------------------------
    def simple_deadsquares(self):
        """どこにも押し出せなくなるマス（＝置いた時点で詰み）を先に求めておく。
        おきばから逆向きに「引ける」場所を全部たどり、たどり着けない床が死にマス。"""
        if self._simple_deadsq is not None:
            return self._simple_deadsq
        alive = set(self.goals)
        q = deque(self.goals)
        while q:
            (x, y) = q.popleft()
            for dx, dy, _ in DIRS:
                b = (x + dx, y + dy)          # にもつを引いた先
                p = (x + 2 * dx, y + 2 * dy)  # そのときオカンが立つ場所
                if b in self.walls or p in self.walls:
                    continue
                if b in alive:
                    continue
                if b not in self.floor or p not in self.floor:
                    continue
                alive.add(b); q.append(b)
        self._simple_deadsq = (self.floor - alive)
        return self._simple_deadsq

    def frozen_deadlock(self, boxes):
        """にもつ同士・かべで固まって二度と動かせない形（2x2 のかたまり等）を見つける。
        おきばの上でも「全部がおきばの上」でなければ詰み。"""
        dead = self.simple_deadsquares()
        for b in boxes:
            if b in dead:
                return True
        # 2x2 のかたまり（かべ・にもつが4マスを埋める）
        for (x, y) in boxes:
            for ox, oy in ((0, 0), (-1, 0), (0, -1), (-1, -1)):
                cells = [(x + ox, y + oy), (x + ox + 1, y + oy),
                         (x + ox, y + oy + 1), (x + ox + 1, y + oy + 1)]
                if all((c in self.walls or c in boxes) for c in cells):
                    if any((c in boxes and c not in self.goals) for c in cells):
                        return True
        return False


def normalize(level, player, boxes):
    """オカンの居場所は「にもつを動かさずに行ける範囲」でひとまとめにする。
    同じ配置を何度も調べないための正規化。"""
    seen = {player}
    q = deque([player])
    best = player
    while q:
        x, y = q.popleft()
        if (y, x) < (best[1], best[0]):
            best = (x, y)
        for dx, dy, _ in DIRS:
            p = (x + dx, y + dy)
            if p in seen or p in level.walls or p in boxes:
                continue
            if p not in level.floor:
                continue
            seen.add(p); q.append(p)
    return best


def _path_moves(level, boxes, src, dst):
    """にもつを動かさずに src→dst へ歩く最短手順（文字列）。"""
    if src == dst:
        return ''
    prev = {src: None}
    q = deque([src])
    while q:
        cur = q.popleft()
        for dx, dy, ch in DIRS:
            p = (cur[0] + dx, cur[1] + dy)
            if p in prev or p in level.walls or p in boxes or p not in level.floor:
                continue
            prev[p] = (cur, ch)
            if p == dst:
                out = []
                node = p
                while prev[node] is not None:
                    node, ch2 = prev[node]
                    out.append(ch2)
                return ''.join(reversed(out))
            q.append(p)
    return None


def solve(level, max_states=400000, time_limit=None):
    """押し数がいちばん少ない解を探す。返り値 dict（solved / pushes / moves / path）。
    A*（残りのにもつをおきばへ運ぶ最短距離の合計を下界に使う）。

    ★大きい面は 1盤面あたりの処理が重く、盤面数の上限だけだと 何十分も張りつく。
      time_limit（秒）を渡すと そこで打ち切る。打ち切りは「上限に当たった」と同じ扱い。"""
    import time as _time
    _t0 = _time.time()
    goals = frozenset(level.goals)
    start_boxes = frozenset(level.boxes)
    if start_boxes == goals:
        return {'solved': True, 'pushes': 0, 'moves': 0, 'path': '', 'states': 0}

    dead = level.simple_deadsquares()

    # 各マスからおきばまでの最短距離（かべだけを見た近似。下界に使う）
    dist = {}
    for g in goals:
        dq = deque([(g, 0)])
        seen = {g: 0}
        while dq:
            (x, y), d = dq.popleft()
            for dx, dy, _ in DIRS:
                p = (x + dx, y + dy)
                if p in level.walls or p not in level.floor or p in seen:
                    continue
                seen[p] = d + 1
                dq.append((p, d + 1))
        for p, d in seen.items():
            if p not in dist or d < dist[p]:
                dist[p] = d

    def h(boxes):
        s = 0
        for b in boxes:
            if b in goals:
                continue
            s += dist.get(b, 0)
        return s

    start_p = normalize(level, level.player, start_boxes)
    start = (start_p, start_boxes)
    g0 = 0
    pq = [(h(start_boxes), g0, start, None, None)]
    came = {}                  # state -> (prev_state, box_from, box_to, player_before_push)
    best_g = {start: 0}
    states = 0
    while pq:
        f, g, st, _, _ = heapq.heappop(pq)
        if best_g.get(st, 1 << 30) < g:
            continue
        pnorm, boxes = st
        states += 1
        if states > max_states:
            return {'solved': None, 'reason': 'too many states', 'states': states}
        if time_limit and (states & 255) == 0 and _time.time() - _t0 > time_limit:
            return {'solved': None, 'reason': 'time limit', 'states': states}
        if boxes == goals:
            return _rebuild(level, came, st, g, states)
        # オカンが歩ける範囲
        reach = {pnorm}
        q = deque([pnorm])
        while q:
            x, y = q.popleft()
            for dx, dy, _ in DIRS:
                p = (x + dx, y + dy)
                if p in reach or p in level.walls or p in boxes or p not in level.floor:
                    continue
                reach.add(p); q.append(p)
        for b in boxes:
            bx, by = b
            for dx, dy, ch in DIRS:
                stand = (bx - dx, by - dy)
                dest = (bx + dx, by + dy)
                if stand not in reach:
                    continue
                if dest in level.walls or dest in boxes or dest not in level.floor:
                    continue
                if dest in dead:
                    continue
                nb = frozenset((boxes - {b}) | {dest})
                if level.frozen_deadlock(nb):
                    continue
                np = normalize(level, b, nb)
                ns = (np, nb)
                ng = g + 1
                if ng < best_g.get(ns, 1 << 30):
                    best_g[ns] = ng
                    came[ns] = (st, b, dest, stand)
                    heapq.heappush(pq, (ng + h(nb), ng, ns, None, None))
    return {'solved': False, 'states': states}


def _rebuild(level, came, st, pushes, states):
    """押しの並びから、実際の歩数つき手順（UDLR の文字列）を組み立てる。"""
    seq = []
    cur = st
    while cur in came:
        prev, bfrom, bto, stand = came[cur]
        seq.append((prev, bfrom, bto, stand))
        cur = prev
    seq.reverse()
    moves = []
    player = level.player
    boxes = set(level.boxes)
    for prev, bfrom, bto, stand in seq:
        walk = _path_moves(level, boxes, player, stand)
        if walk is None:
            return {'solved': None, 'reason': 'path rebuild failed', 'states': states}
        moves.append(walk)
        dx, dy = bto[0] - bfrom[0], bto[1] - bfrom[1]
        ch = [d[2] for d in DIRS if (d[0], d[1]) == (dx, dy)][0]
        moves.append(ch)
        boxes.discard(bfrom); boxes.add(bto)
        player = bfrom
    path = ''.join(moves)
    return {'solved': True, 'pushes': pushes, 'moves': len(path), 'path': path, 'states': states}


def replay(level, path):
    """手順を実際に動かして、本当にクリアになるか確かめる（解の独立検算）。"""
    px, py = level.player
    boxes = set(level.boxes)
    mv = pu = 0
    for ch in path:
        d = [x for x in DIRS if x[2] == ch]
        if not d:
            return False, 'unknown move %r' % ch
        dx, dy, _ = d[0]
        n = (px + dx, py + dy)
        if n in level.walls:
            return False, 'かべにぶつかった'
        if n in boxes:
            nn = (n[0] + dx, n[1] + dy)
            if nn in level.walls or nn in boxes:
                return False, 'おせないのに押した'
            boxes.discard(n); boxes.add(nn)
            pu += 1
        px, py = n
        mv += 1
    return (boxes == set(level.goals)), {'moves': mv, 'pushes': pu}


def parse_collection(text):
    """空行区切りのテキストから面をまとめて読む。';' で始まる行は名前。"""
    levels = []
    cur, name = [], ''
    for line in text.split('\n'):
        if line.startswith(';'):
            name = line[1:].strip()
            continue
        if line.strip() == '':
            if cur:
                levels.append(Level(cur, name)); cur, name = [], ''
            continue
        cur.append(line)
    if cur:
        levels.append(Level(cur, name))
    return levels


if __name__ == '__main__':
    data = open(sys.argv[1], encoding='utf-8').read()
    for i, lv in enumerate(parse_collection(data)):
        errs = lv.validate()
        if errs:
            print('#%d %s ... NG: %s' % (i + 1, lv.name, ' / '.join(errs)))
            continue
        r = solve(lv)
        if r.get('solved'):
            ok, info = replay(lv, r['path'])
            print('#%d %s ... OK pushes=%d moves=%d 検算=%s' %
                  (i + 1, lv.name, r['pushes'], r['moves'], 'OK' if ok else 'NG'))
        else:
            print('#%d %s ... 解けない (%s)' % (i + 1, lv.name, r))
