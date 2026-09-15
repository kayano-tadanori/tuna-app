# -*- coding: utf-8 -*-
"""平らに畳まれた状態が「紙として成り立つか」（すり抜けていないか）を、JS の fold_crossing.js とは別の実装で判定して突き合わせる。

★やり方（JS と同じ考え、別の書き方）
   結び（背・折り目）が乗っている直線ごとに、直線上の区切り（面の頂点・辺の横切り・結びの端）のあいだの中点で断面をとる。
   断面では各面が直線の右（+n）か左（-n）へ伸びる。右は下→上、左は上→下の順に一周へ並べ、
   つながり（直線をまたぐ1枚の面・その場所を含む結び）を弦で結ぶ。
   ★判定の書き方を JS と変えた：JS はスタック（括弧の対応）、ここは**全部の弦の組**を調べる。
   同じ側で同じ層の2枚、1本の半直線に弦が2本以上、も不成立。
   入力は `node test_crossing_diag.js --write` が書く `crossing_states.json`。

★これが言わないこと
   ⛔ 途中の運動は見ていない（平らな状態だけ）。⛔ 厚みは 0（並びは厚み→0 の極限）。

使い方： python check_crossing_diag.py
関連メモリ： [[project_freefold_ui]]
"""
import sys, json, math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ok_all = True


def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))


def apply(m, p):
    return (m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5])


def inside_strict(poly, p):
    s = 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        s += a[0] * b[1] - b[0] * a[1]
    sign = 1 if s > 0 else -1
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        if c * sign <= 1e-12:
            return False
    return True


def verdict(state):
    faces = state['faces']
    by = {f['faceId']: f for f in faces}
    lines = {}
    for bd in state['bonds']:
        f = by.get(bd['faceIds'][0])
        if not f:
            continue
        p, q = apply(f['xf'], bd['seg'][0]), apply(f['xf'], bd['seg'][1])
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy)
        if L < 1e-9:
            continue
        ux, uy = dx / L, dy / L
        if ux < -1e-9 or (abs(ux) <= 1e-9 and uy < 0):
            ux, uy = -ux, -uy
        nx, ny = -uy, ux
        c = nx * p[0] + ny * p[1]
        key = (round(ux, 6), round(uy, 6), round(c, 6))
        lines.setdefault(key, {'u': (ux, uy), 'n': (nx, ny), 'c': c, 'bonds': []})['bonds'].append((bd, p, q))
    bad = []
    rings = {}
    for key, ln in lines.items():
        ux, uy = ln['u']; nx, ny = ln['n']; c = ln['c']
        off = lambda p: nx * p[0] + ny * p[1] - c
        t_of = lambda p: ux * p[0] + uy * p[1]
        ts = []
        for f in faces:
            P = f['poly']
            for i in range(len(P)):
                a, b = P[i], P[(i + 1) % len(P)]
                sa, sb = off(a), off(b)
                if abs(sa) <= 1e-9:
                    ts.append(t_of(a))
                if (sa > 1e-9 and sb < -1e-9) or (sa < -1e-9 and sb > 1e-9):
                    k = sa / (sa - sb)
                    ts.append(t_of((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)))
        for bd, p, q in ln['bonds']:
            ts += [t_of(p), t_of(q)]
        ts = sorted(ts)
        uniq = []
        for t in ts:
            if not uniq or t - uniq[-1] > 1e-7:
                uniq.append(t)
        for i in range(len(uniq) - 1):
            tm = (uniq[i] + uniq[i + 1]) / 2
            if not any(min(t_of(p), t_of(q)) + 1e-9 < tm < max(t_of(p), t_of(q)) - 1e-9 for _, p, q in ln['bonds']):
                continue
            x = (nx * c + ux * tm, ny * c + uy * tm)
            h = min(1e-6, (uniq[i + 1] - uniq[i]) / 1e3)
            right, left = [], []
            for f in faces:
                if inside_strict(f['poly'], (x[0] + nx * h, x[1] + ny * h)):
                    right.append(f)
                if inside_strict(f['poly'], (x[0] - nx * h, x[1] - ny * h)):
                    left.append(f)
            for side, arr in (('R', right), ('L', left)):
                ls = [f['layer'] for f in arr]
                if len(set(ls)) != len(ls):
                    bad.append(('same-layer', key, side))
            ring = [(f['faceId'], 'R') for f in sorted(right, key=lambda f: f['layer'])] + [(f['faceId'], 'L') for f in sorted(left, key=lambda f: -f['layer'])]
            pos = {r: i for i, r in enumerate(ring)}
            chords = []
            for f in faces:
                if (f['faceId'], 'R') in pos and (f['faceId'], 'L') in pos:
                    chords.append((pos[(f['faceId'], 'R')], pos[(f['faceId'], 'L')]))
            for bd, p, q in ln['bonds']:
                if not (min(t_of(p), t_of(q)) + 1e-9 < tm < max(t_of(p), t_of(q)) - 1e-9):
                    continue
                ends = []
                for fid in bd['faceIds']:
                    hit = [r for r in ring if r[0] == fid]
                    if len(hit) != 1:
                        bad.append(('bond-not-one-ray', key, bd['bondId']))
                        break
                    ends.append(pos[hit[0]])
                if len(ends) == 2:
                    chords.append(tuple(ends))
            deg = {}
            for a, b in chords:
                deg[a] = deg.get(a, 0) + 1; deg[b] = deg.get(b, 0) + 1
            if any(v > 1 for v in deg.values()):
                bad.append(('ray-two-chords', key))
            for i1 in range(len(chords)):
                for i2 in range(i1 + 1, len(chords)):
                    a, b = sorted(chords[i1]); c2, d = sorted(chords[i2])
                    if a < c2 < b < d or c2 < a < d < b:
                        bad.append(('crossing', key, ring[a][0], ring[c2][0]))
            rings.setdefault(key, [])
            rings[key].append(' '.join(f"{fid.replace('paper/', '')}:{s}" for fid, s in ring))
    # 面積をもって重なる同じ層（凸多角形の交わり）
    def clip(P, Q):
        def area(X):
            return sum(X[i][0] * X[(i + 1) % len(X)][1] - X[(i + 1) % len(X)][0] * X[i][1] for i in range(len(X))) / 2
        out = list(P) if area(P) >= 0 else list(reversed(P))
        q = list(Q) if area(Q) >= 0 else list(reversed(Q))
        for i in range(len(q)):
            if not out:
                break
            a, b = q[i], q[(i + 1) % len(q)]
            inp, out = out, []
            for j in range(len(inp)):
                p, r = inp[j], inp[(j + 1) % len(inp)]
                sp = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
                sr = (b[0] - a[0]) * (r[1] - a[1]) - (b[1] - a[1]) * (r[0] - a[0])
                if sp >= -1e-12:
                    out.append(p)
                if (sp > 1e-12 and sr < -1e-12) or (sp < -1e-12 and sr > 1e-12):
                    k = sp / (sp - sr)
                    out.append((p[0] + (r[0] - p[0]) * k, p[1] + (r[1] - p[1]) * k))
        return abs(area(out)) if len(out) >= 3 else 0.0
    for i in range(len(faces)):
        for j in range(i + 1, len(faces)):
            if faces[i]['layer'] == faces[j]['layer'] and clip(faces[i]['poly'], faces[j]['poly']) > 1e-9:
                bad.append(('same-layer-overlap', faces[i]['faceId'], faces[j]['faceId']))
    return (not bad), bad, rings


def main():
    data = json.loads((HERE / 'crossing_states.json').read_text(encoding='utf-8'))
    want = {'before': True, 'afterV': True, 'afterM': True, 'swapped': False, 'pocketBefore': True, 'pocketAfter': True, 'noBlockM': False}
    names = [s['name'] for s in data['states']]
    check('状態がそろっている', sorted(names) == sorted(want), str(names))
    for s in data['states']:
        ok, bad, rings = verdict(s)
        check(f'{s["name"]}（{s["note"]}）：Python の判定＝{"成立" if ok else "不成立"}／JS＝{"成立" if s["js"] else "不成立"}',
              ok == s['js'] == want.get(s['name']), '; '.join(str(b) for b in bad[:2]))
        if s['name'] == 'before':
            diag = rings.get((0.707107, 0.707107, 0.0), [])
            check('袋折り直後の対角の断面（UL0–Q_E が Q_S–P4 と P3–P2 を包む）',
                  diag == ['s1.keep/s2.cut/s3.cut:R s1.keep/s2.cut/s3.keep:R s1.cut/s2.cut/s3.cut:L s1.cut/s2.cut/s3.keep:L s1.cut/s2.keep:L s1.keep/s2.keep:L'], str(diag))
        if s['name'] == 'swapped':
            check('入れかえた状態の交差は対角の直線で出る', any(b[0] == 'crossing' and b[1] == (0.707107, 0.707107, 0.0) for b in bad), str(bad[:2]))
    print('⛔ 平らな状態だけ（途中の運動は見ていない）。厚みは 0。')
    print('ALL OK' if ok_all else 'NG あり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
