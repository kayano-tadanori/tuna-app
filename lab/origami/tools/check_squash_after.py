# -*- coding: utf-8 -*-
"""袋折りのあとの手（fold / crease / flip）を、**JS とは別の再生器**で折り直して突き合わせる。

★何を言う検査か
   `node test_squash_after.js --write` が書いた `squash_after_states.json` の各経路について、
   ① 始まり＝JS が出した「袋折り直後」の面（faceId・layerPath・poly・xf・layer）
      ⚠袋折りそのものの独立検証は check_squash_flip.py の担当（ここでは始まりとして受け取るだけ）。
   ② 袋折りのあとの手を **Python の `origami_recipe.replay`（中身は本番の `fold2d.FoldState`）にそのまま渡す**。
      ループは書き写さない＝`R.FoldState` を「袋折り直後の面を持った紙」を返すものに差しかえるだけ。
   ③ JS の最終形と、面ごとに faceId・layerPath・xf・形、**面積をもって重なる2枚の上下**が一致するか。

★これが言わないこと
   ⛔ 結び（紙が裂けないか）は Python の再生器に無い＝JS の test_squash_after.js の担当。
   ⛔ 紙どうしの貫通は見ていない。厚みは 0。

使い方： python check_squash_after.py
関連メモリ： [[project_freefold_ui]] の 🧺
"""
import sys, json, copy
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import origami_recipe as R
import fold2d

TOL = 1e-9
ok_all = True


def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))


def area(P):
    s = 0.0
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        s += a[0] * b[1] - b[0] * a[1]
    return s / 2


def clip(P, Q):
    def ccw(X):
        return list(X) if area(X) >= 0 else list(reversed(X))
    out, q = ccw(P), ccw(Q)
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
                t = sp / (sp - sr)
                out.append((p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t))
    return out if len(out) >= 3 else []


def overlap(P, Q):
    I = clip(P, Q)
    return abs(area(I)) if I else 0.0


class _Root(dict):
    """R.replay は最初に `panels[0]['recipeFace'] = paper` を書く＝袋折り直後の面の名前を上書きしない。"""
    def __setitem__(self, k, v):
        if k == 'recipeFace' and 'recipeFace' in self:
            return
        super().__setitem__(k, v)


def seeded_state(seed):
    def factory(*args, **kw):
        st = fold2d.FoldState(*args, **kw)
        panels = []
        for i, f in enumerate(seed):
            p = (_Root if i == 0 else dict)()
            p.update({'poly': [tuple(v) for v in f['poly']], 'layer': f['layer'], 'xf': tuple(f['xf']),
                      'hist': (), 'pre_xf': tuple(f['xf']),
                      'recipeFace': {'faceId': f['faceId'], 'layerPath': copy.deepcopy(f['layerPath'])}})
            panels.append(p)
        st.panels = panels
        return st
    return factory


def python_after(case):
    recipe = case['recipe']
    k = case['squashStep']
    rest = {**copy.deepcopy(recipe), 'version': 1, 'steps': copy.deepcopy(recipe['steps'][k + 1:])}
    real = R.FoldState
    R.FoldState = seeded_state(case['seed'])
    try:
        state, _ = R.replay(rest)
    finally:
        R.FoldState = real
    return state.panels


def same_poly(P, Q):
    if len(P) != len(Q):
        return False
    return all(any(abs(p[0] - q[0]) < 1e-7 and abs(p[1] - q[1]) < 1e-7 for q in Q) for p in P) and \
        all(any(abs(p[0] - q[0]) < 1e-7 and abs(p[1] - q[1]) < 1e-7 for p in P) for q in Q)


def compare(case):
    name = case['name']
    js = {f['faceId']: f for f in case['faces']}
    py = {p['recipeFace']['faceId']: p for p in python_after(case)}
    check(f'{name}：面の名前の集合', set(js) == set(py), f'JSだけ {sorted(set(js) - set(py))} / Pyだけ {sorted(set(py) - set(js))}')
    if set(js) != set(py):
        return
    bad_path = [i for i in js if js[i]['layerPath'] != py[i]['recipeFace']['layerPath']]
    check(f'{name}：layerPath', not bad_path, str(bad_path))
    bad_xf = [i for i in js if max(abs(a - b) for a, b in zip(js[i]['xf'], py[i]['xf'])) > TOL]
    check(f'{name}：xf（{len(js)}面）', not bad_xf, str(bad_xf))
    bad_poly = [i for i in js if not same_poly(js[i]['poly'], py[i]['poly'])]
    check(f'{name}：いまの形', not bad_poly, str(bad_poly))
    ids = sorted(js)
    pairs = bad = 0
    same_val = True
    for a in range(len(ids)):
        for b in range(a + 1, len(ids)):
            A, B = ids[a], ids[b]
            if overlap(js[A]['poly'], js[B]['poly']) <= 1e-9:
                continue
            pairs += 1
            sj = (js[A]['layer'] > js[B]['layer']) - (js[A]['layer'] < js[B]['layer'])
            sp = (py[A]['layer'] > py[B]['layer']) - (py[A]['layer'] < py[B]['layer'])
            if sj != sp or sj == 0:
                bad += 1
    for i in ids:
        if js[i]['layer'] != py[i]['layer']:
            same_val = False
    check(f'{name}：重なる2枚の上下（{pairs}組）', bad == 0 and pairs > 0, f'食い違い {bad}組')
    print(f'    （層の値そのものも{"一致" if same_val else "違う（上下は同じ）"}）')


def main():
    data = json.loads((HERE / 'squash_after_states.json').read_text(encoding='utf-8'))
    check('経路がある', len(data['cases']) > 0, str(len(data['cases'])))
    for case in data['cases']:
        check(f'{case["name"]}：袋折りのあとに手がある', case['squashStep'] < len(case['recipe']['steps']) - 1)
        compare(case)
    print('⛔ 結び（裂けないか）は Python の再生器に無い＝JS の担当。紙どうしの貫通は見ていない。厚みは 0。')
    print('ALL OK' if ok_all else 'NG あり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
