# -*- coding: utf-8 -*-
"""むずかしい面の候補を作る（にもつ多め・部屋も大きめ）。"""
import sys
import gen

gen.TEMPLATES['room9'] = [
    '##########', '#        #', '#        #', '#        #',
    '#        #', '#        #', '#        #', '##########',
]
gen.TEMPLATES['pillars9'] = [
    '##########', '#        #', '#  #  #  #', '#        #',
    '#  #  #  #', '#        #', '#        #', '##########',
]
gen.TEMPLATES['rooms2'] = [
    '###########', '#    #    #', '#    #    #', '#         #',
    '#    #    #', '#    #    #', '###########',
]
gen.TEMPLATES['zig'] = [
    '##########', '#        #', '#  ####  #', '#        #',
    '#  ####  #', '#        #', '#        #', '##########',
]
JOBS = [
    ('room9', 4), ('room9', 5), ('room9', 6),
    ('pillars9', 4), ('pillars9', 5),
    ('rooms2', 4), ('rooms2', 5),
    ('zig', 4), ('zig', 5),
    ('corridor', 4), ('cross', 5), ('wide9', 5), ('notch', 5),
]
res = []
for tname, nbox in JOBS:
    for seed in range(8):
        r = gen.gen_from_template(tname, nbox, seed * 7919 + nbox * 131 + 3, tries=12)
        if not r:
            continue
        sc, rows, sol, info = r
        res.append((sc, tname, nbox, seed, rows, sol, info))
        print('%s box=%d seed=%d -> %.1f pushes=%d' % (tname, nbox, seed, sc, sol['pushes']), flush=True)
res.sort(key=lambda t: -t[0])
with open('_cands2.txt', 'w', encoding='utf-8') as f:
    for sc, tname, nbox, seed, rows, sol, info in res:
        f.write(';%s box=%d seed=%d score=%.1f pushes=%d moves=%d detour=%.2f branch=%.2f density=%.2f\n'
                % (tname, nbox, seed, sc, sol['pushes'], sol['moves'],
                   info['detour'], info['branch'], info['density']))
        f.write('\n'.join(rows) + '\n\n')
print('done', len(res))
