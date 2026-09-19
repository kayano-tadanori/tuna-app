# -*- coding: utf-8 -*-
"""中割り（op:'reverse'）の Python 独立照合（2026-09-19・recipe_crane13.md 第24段）。

JS（freefold_engine.js）の結果を test_reverse_fold.js に書き出させ（ORIGAMI_DUMP_REVERSE）、
Python（origami_recipe.py の reverse_step＝JS の結び bonds を使わない別の実装）で作り直して突き合わせる。
  ・1枚模型（R1 の21例・R4 の⑬→⑭ 6例）：v1 の原本を Python が**先頭から**再生する（半分に折るのも fold2d）
  ・つる（⑫→⑬脚1・脚2→⑭）：⑫は v2（袋折り・花弁折り）なので Python では再生できない＝JS の⑫の面（形・置かれ方・層）から出発し、
    中割りの3手だけを Python が続けて作る（⑭は Python 自身が作った⑬の上で）
照合するもの：面ID の集合／面ごとの素材の形（原紙座標）といまの形・表裏／重なる組（面積あり）ぜんぶの上下／背の先の区間の反転（面の組）

使い方： python -B test_reverse_python.py   （node が要る）
        python -B test_reverse_python.py --crane-dump PATH   （test_crane_progress.js の E④ から呼ばれる）
"""
import sys
sys.dont_write_bytecode = True
import json
import math
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from origami_recipe import HERE, replay, reverse_step, source_polygon, overlap_area, RecipeError
from fold2d import xf_is_flipped

TOL = 1e-9


def canon(poly):
    return sorted((round(p[0], 7) + 0.0, round(p[1], 7) + 0.0) for p in poly)


def same_poly(p, q):
    if len(p) != len(q):
        return False
    return all(min(math.dist(a, b) for b in q) <= 1e-7 for a in p) and all(min(math.dist(a, b) for b in p) <= 1e-7 for a in q)


def compare(label, py_panels, js_faces, js_rev=None, py_rev=None):
    """Python の面と JS の面を突き合わせ、(面数, 上下を比べた組の数) を返す。違えば AssertionError。"""
    P = {p['recipeFace']['faceId']: p for p in py_panels}
    J = {f['faceId']: f for f in js_faces}
    assert set(P) == set(J), f'{label}：面ID が違う（Python のみ {sorted(set(P) - set(J))[:3]} ／ JS のみ {sorted(set(J) - set(P))[:3]}）'
    for fid, f in J.items():
        p = P[fid]
        assert p['recipeFace']['layerPath'] == f['layerPath'], f'{label}：layerPath が違う {fid}'
        assert same_poly(p['poly'], f['poly']), f'{label}：いまの形が違う {fid}'
        src_js = [((f['xf'][3] * (q[0] - f['xf'][4]) - f['xf'][1] * (q[1] - f['xf'][5])) / (f['xf'][0] * f['xf'][3] - f['xf'][1] * f['xf'][2]),
                   (-f['xf'][2] * (q[0] - f['xf'][4]) + f['xf'][0] * (q[1] - f['xf'][5])) / (f['xf'][0] * f['xf'][3] - f['xf'][1] * f['xf'][2])) for q in f['poly']]
        assert same_poly(source_polygon(p), src_js), f'{label}：素材の形が違う {fid}'
        assert xf_is_flipped(p['xf']) == (f['xf'][0] * f['xf'][3] - f['xf'][1] * f['xf'][2] < 0), f'{label}：表裏が違う {fid}'
    ids = sorted(J)
    pairs = 0
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            if overlap_area(P[a]['poly'], P[b]['poly']) <= 1e-8:
                continue
            sp = math.copysign(1, P[a]['layer'] - P[b]['layer']) if P[a]['layer'] != P[b]['layer'] else 0
            sj = math.copysign(1, J[a]['layer'] - J[b]['layer']) if J[a]['layer'] != J[b]['layer'] else 0
            assert sp == sj and sp != 0, f'{label}：上下が違う {a} | {b}（Python {sp} ／ JS {sj}）'
            pairs += 1
    if py_rev is not None:
        assert any(set(r) == set(py_rev) for r in js_rev), f'{label}：反転した背の区間の面が違う（Python {py_rev} ／ JS {js_rev}）'
    return len(ids), pairs


def crane_chain(c):
    """JS の⑫の面（c['start']）から、中割りの手（c['steps']）を Python が続けて作り、手ごとに JS の結果（c['results']）と照合する。行の説明を返す。"""
    panels = [{'poly': [tuple(q) for q in f['poly']], 'xf': tuple(f['xf']), 'layer': f['layer'], 'hist': (), 'pre_xf': tuple(f['xf']),
               'recipeFace': {'faceId': f['faceId'], 'layerPath': f['layerPath']}} for f in c['start']]
    rows = []
    for k, (step, res) in enumerate(zip(c['steps'], c['results'])):
        panels, info = reverse_step(panels, step, 100 + k, 1.0)
        n, pairs = compare(f'つる {step["id"]}', panels, res['faces'], res['rev'], info['reversed'])
        rows.append(f'{step["id"]}：面 {n}・上下 {pairs}組・両側 {info["sides"][0]}／{info["sides"][1]}')
    return rows


class ReverseAgainstJS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tmp = Path(tempfile.mkdtemp(prefix='rev_dump_')) / 'dump.json'
        env = dict(os.environ, ORIGAMI_DUMP_REVERSE=str(tmp))
        r = subprocess.run(['node', str(HERE / 'test_reverse_fold.js')], cwd=HERE, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        if r.returncode != 0:
            raise AssertionError('test_reverse_fold.js が通らない：' + r.stdout.decode('utf-8', 'replace')[-600:])
        cls.cases = json.loads(tmp.read_text(encoding='utf-8'))

    def test_one_sheet_from_scratch(self):
        """1枚模型：v1 の原本を先頭から Python で再生（R1 21例・R4 6例）"""
        rows = [c for c in self.cases if c['kind'] == 'recipe']
        self.assertEqual(len(rows), 27, '1枚模型の例が27（R1 21・R4 6）でない')
        total = 0
        for c in rows:
            rec = c['recipe']
            *head, last = rec['steps']
            state, _ = replay({**rec, 'steps': head})
            new, info = reverse_step(state.panels, last, len(head), rec['paper']['aspectRatio'])
            n, pairs = compare(c['name'], new, c['faces'], c['rev'], info['reversed'])
            full, _ = replay(rec)
            compare(c['name'] + '（replay で通し）', full.panels, c['faces'])
            self.assertGreater(pairs, 0, c['name'] + '：上下を比べた組が無い')
            total += pairs
        print(f'\n  1枚模型 {len(rows)}例：面ID・素材の形・いまの形・表裏・重なる組の上下（計 {total}組）・反転が JS と一致')

    def test_crane_from_step12(self):
        """つる：JS の⑫の面から、⑬脚1・脚2・⑭を Python が続けて作る"""
        rows = crane_chain(next(c for c in self.cases if c['kind'] == 'start'))
        self.assertEqual(len(rows), 3, 'つるの中割りが3手（⑬2本・⑭）でない')
        print('\n  つる ' + ' ／ '.join(rows) + '：JS と一致')

    def test_refuses(self):
        """Python の読み手も、hinge.seg が面の共有辺と一致しない原本を断る"""
        c = next(c for c in self.cases if c['kind'] == 'recipe')
        rec = json.loads(json.dumps(c['recipe']))
        q = rec['steps'][-1]['hinge']['seg'][0]
        q[1] += 1e-6 if q[1] < 1 - 1e-6 else -1e-6   # 原紙（±1）の内側でずらす
        with self.assertRaisesRegex(RecipeError, 'hinge seg does not match'):
            replay(rec)


if __name__ == '__main__':
    # --crane-dump PATH：test_crane_progress.js の E④ が書いた「つる完成の原本」の⑫と中割り3手だけを照合する（unittest は回さない）
    if '--crane-dump' in sys.argv:
        c = json.loads(Path(sys.argv[sys.argv.index('--crane-dump') + 1]).read_text(encoding='utf-8'))
        try:
            rows = crane_chain(c)
            assert len(rows) == 3, 'つるの中割りが3手（⑬2本・⑭）でない'
        except (AssertionError, RecipeError) as e:
            print('NG ' + str(e)); sys.exit(1)
        print('OK ' + ' ／ '.join(rows)); sys.exit(0)
    unittest.main(verbosity=1)
