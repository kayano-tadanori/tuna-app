# -*- coding: utf-8 -*-
"""候補の面をたくさん作って、採点の高い順に _cands.txt へ書き出す。"""
import sys
import gen

OUT = sys.argv[1] if len(sys.argv) > 1 else '_cands.txt'
JOBS = [
    ('room7', 2), ('room7', 3), ('room7', 4),
    ('pillar8', 3), ('pillar8', 4), ('pillar8', 5),
    ('lshape', 3), ('lshape', 4),
    ('corridor', 3), ('corridor', 4), ('corridor', 5),
    ('cross', 3), ('cross', 4),
    ('wide9', 3), ('wide9', 4), ('wide9', 5),
    ('notch', 3), ('notch', 4),
]
res = []
for tname, nbox in JOBS:
    for seed in range(10):
        r = gen.gen_from_template(tname, nbox, seed * 104729 + nbox * 31 + 7, tries=14)
        if not r:
            continue
        sc, rows, sol, info = r
        res.append((sc, tname, nbox, seed, rows, sol, info))
        print('%s box=%d seed=%d -> %.1f (pushes=%d)' % (tname, nbox, seed, sc, sol['pushes']),
              flush=True)
res.sort(key=lambda t: -t[0])
with open(OUT, 'w', encoding='utf-8') as f:
    for sc, tname, nbox, seed, rows, sol, info in res:
        f.write(';%s box=%d seed=%d score=%.1f pushes=%d moves=%d detour=%.2f branch=%.2f density=%.2f\n'
                % (tname, nbox, seed, sc, sol['pushes'], sol['moves'],
                   info['detour'], info['branch'], info['density']))
        f.write('\n'.join(rows) + '\n\n')
print('wrote', OUT, len(res))
