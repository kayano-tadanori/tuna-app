# -*- coding: utf-8 -*-
"""難易度を「測る」ための道具。

★感想ではなく 数字で測る。よりどころは NotebookLM の2つの資料：
  ・村瀬・松原・平賀(1998) の自動作成…「作成→解答(幅優先)→**評価**」の3段。
    評価は 手数 と **探索の広さ** をもとに、自明でつまらない問題を捨てる。
  ・Iso-nyang氏「オリジナルステージの作り方」…かんたんになる要素は
    ①盤がせまい ②にもつが少ない ③ジレンマが無い ④手数が少ない
    ⑤おきばが かべ・通路の入口から離れている

そこで、次の5つを実測してひとつの数にする。
  pushes … 最少の おした数（＝手数）
  nodes  … ソルバーが調べた盤面の数（＝探索の広さ。人が迷う量に近い）
  boxes  … にもつの数
  fatal  … 手順のとちゅうで「押したら詰む手」が どれくらいの割合あるか
           （＝うっかりで壊れやすさ。ジレンマの強さの代わりになる）
  tight  … おきばが かべ・角に どれだけ 貼りついているか（融通のなさ）
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sokoban import Level, DIRS, solve, replay  # noqa: E402
from collections import deque  # noqa: E402


def _reachable(level, boxes, player):
    seen = {player}
    q = deque([player])
    while q:
        x, y = q.popleft()
        for dx, dy, _ in DIRS:
            p = (x + dx, y + dy)
            if p in seen or p in level.walls or p in boxes or p not in level.floor:
                continue
            seen.add(p); q.append(p)
    return seen


def analyze(level, max_states=400000, path=None, time_limit=None):
    """1面を測る。返り値は dict（測れないときは None）。

    path を渡すと、その手順を「正しい解答」として使う。
    ★大きい面は こちらのソルバーでは 何百万盤面 調べても終わらないことがある。
      そういう面でも、解答が手元にあれば 手数・詰む手の割合は 正確に測れる。
      探索の広さ nodes は 上限で打ち切った値になる（capped=True で印をつける）。
    """
    res = solve(level, max_states=max_states, time_limit=time_limit)
    optimal = bool(res.get('solved'))
    capped = not optimal
    if optimal:
        use = res['path']
        nodes = res['states']
    else:
        if not path:
            return None
        use = path
        nodes = max_states
    ok, info = replay(level, use)
    if not ok:
        return None
    res = {'solved': True, 'pushes': info['pushes'], 'moves': info['moves'],
           'path': use, 'states': nodes}

    # --- 手順をなぞりながら「押せる手」と「押したら詰む手」を数える ---
    px, py = level.player
    boxes = set(level.boxes)
    dead = level.simple_deadsquares()
    tot = fatal = 0
    branches = []
    for ch in res['path']:
        d = [x for x in DIRS if x[2] == ch][0]
        dx, dy = d[0], d[1]
        n = (px + dx, py + dy)
        if n in boxes:
            reach = _reachable(level, boxes, (px, py))
            k = kf = 0
            for b in boxes:
                for ex, ey, _ in DIRS:
                    stand = (b[0] - ex, b[1] - ey)
                    dest = (b[0] + ex, b[1] + ey)
                    if stand not in reach:
                        continue
                    if dest in level.walls or dest in boxes or dest not in level.floor:
                        continue
                    k += 1
                    nb = frozenset((boxes - {b}) | {dest})
                    if dest in dead or level.frozen_deadlock(nb):
                        kf += 1
            tot += k; fatal += kf
            branches.append(k)
            nn = (n[0] + dx, n[1] + dy)
            boxes.discard(n); boxes.add(nn)
        px, py = n

    # --- おきばの まわりの せまさ（かべに接している数） ---
    tight = 0
    for g in level.goals:
        w = sum(1 for dx, dy, _ in DIRS if (g[0] + dx, g[1] + dy) in level.walls)
        tight += w
    tight /= max(1, len(level.goals))

    lower = 0
    for b in level.boxes:
        lower += min(abs(b[0] - g[0]) + abs(b[1] - g[1]) for g in level.goals)

    a = {
        'pushes': res['pushes'], 'moves': res['moves'], 'nodes': res['states'],
        'boxes': len(level.boxes), 'area': len(level.floor),
        'branch': (sum(branches) / len(branches)) if branches else 0.0,
        'optimal': optimal, 'capped': capped,
        'fatal': (fatal / tot) if tot else 0.0,
        'tight': tight,
        'detour': (res['pushes'] / lower) if lower else 1.0,
        'path': res['path'],
    }
    a['score'] = difficulty(a)
    return a


def difficulty(a):
    """5つの数を ひとつの「むずかしさ」にまとめる。

    ★重みの決めかた（ここを勝手に変えない・変えるなら測り直す）
      ・探索の広さ nodes … 資料が いちばん重く見ている指標。対数で効かせる
      ・おした数 pushes  … そのまま効く（長い手順は それだけで大変）
      ・にもつ boxes     … 1個ふえると 考える組み合わせが跳ねあがる
      ・詰む手の割合 fatal… 「うっかりで壊れる」＝人がいちばん難しく感じるところ
      ・おきばの せまさ tight … 融通のなさ
    """
    # ★手数は「効きめが だんだん鈍る」ように対数にする。
    #   まっすぐ200回おすだけの面が、40手のひねった面より上に来ないように。
    return (3.4 * math.log2(a['nodes'] + 1)
            + 6.0 * math.log2(a['pushes'] + 1)
            + 2.6 * a['boxes']
            + 26.0 * a['fatal']
            + 2.0 * a['tight'])


def tier_of(score, cuts):
    for i, c in enumerate(cuts):
        if score < c:
            return i
    return len(cuts)


if __name__ == '__main__':
    import io
    import sokoban
    txt = io.open(sys.argv[1], encoding='utf-8').read()
    rows = []
    for lv in sokoban.parse_collection(txt):
        a = analyze(lv)
        if not a:
            print('%-14s ★解けない' % lv.name.split('|')[0]); continue
        rows.append((a['score'], lv.name.split('|')[0], a))
    rows.sort()
    for sc, nm, a in rows:
        print('%6.1f  %-16s おした%3d 調べた盤面%7d にもつ%d 詰む手%.0f%% せまさ%.2f'
              % (sc, nm, a['pushes'], a['nodes'], a['boxes'], a['fatal'] * 100, a['tight']))
