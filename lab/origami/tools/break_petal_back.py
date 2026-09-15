# -*- coding: utf-8 -*-
"""反対側の花弁折り（⑩⑪・2026-09-16）で足した「周囲の紙」の独立照合（check_petal_engine.py）の「わざと壊して確認」。
   本体（engine・petal_v2）は変えない。照合の**材料**（petal_engine_states.json の2回目の1例）か、**検証側の運動の式**を崩して、照合が鳴るかを見る。
★判定：PASS（ALL OK）／DETECTED（NG あり で、期待した項目が NG）／WRONG（NG だが別の項目だけ）／ABORT（例外で止まった）
★使い方： python break_petal_back.py
"""
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
from shapely.geometry import Polygon

T = Path(__file__).resolve().parent


def second_case(d):
    return json.loads(json.dumps([c for c in json.loads((T / 'petal_engine_states.json').read_text(encoding='utf-8'))['cases'] if '2回目' in c['label']][0]))


def lift_overlapping(c):
    """動く面と面積で重なる止まった紙を1枚、いちばん上の層へ（出発の上下が崩れる）"""
    mov = set(c['moving']); bf = c['before']['faces']
    m, s = next((m, s) for m in bf if m['faceId'] in mov for s in bf
                if s['faceId'] not in mov and Polygon(s['poly']).intersection(Polygon(m['poly'])).area > 1e-9)
    s['layer'] = 10 ** 6
    return c


def lift_axis_neighbor(c):
    """動く面とは面積で重ならず、軸（止まる側）にだけ接する止まった紙を、その側のモデルの面より上の層へ（軸上の接触が崩れる）"""
    mov = set(c['moving']); bf = c['before']['faces']
    fixed = set(c['faceOf'][k] for k in ('T3R', 'T3L', 'G2R', 'G2L'))
    for s in bf:
        if s['faceId'] in mov or s['faceId'] in fixed: continue
        ps = Polygon(s['poly'])
        if any(ps.intersection(Polygon(m['poly'])).area > 1e-9 for m in bf if m['faceId'] in mov): continue
        if any(ps.intersection(Polygon(f['poly'])).area > 1e-9 for f in bf if f['faceId'] in fixed):
            s['layer'] = 10 ** 6
            return c
    raise RuntimeError('軸にだけ接する止まった紙が見つからない')


ROWS = [
    ('G000', '基準（2回目の1例をそのまま）', None, None, 'PASS', ''),
    ('G374', '材料：動く面と重なる止まった紙を上の層へ', lift_overlapping, None, 'DETECTED', '出発の上下'),
    ('G375', '材料：軸の止まる側に接する止まった紙を上の層へ', lift_axis_neighbor, None, 'DETECTED', '軸上の接触'),
    ('G376', '検証側：一番上の脇 T1R の回る向きを逆にする', None, ('    sig = (1, 1, -1, -1, 1)', '    sig = (1, -1, -1, -1, 1)'), 'DETECTED', '途中の非貫通'),
]


def main():
    work = Path(tempfile.mkdtemp(prefix='break_petal_back_'))
    bad = 0
    for g, what, mutate, patch, want, key in ROWS:
        d = work / g; d.mkdir()
        for f in T.glob('*.py'):  # 照合が読む Python の部品（origami_recipe → fold2d など）ごと写す
            shutil.copy(f, d / f.name)
        shutil.copy(T / 'origami_recipe.schema.json', d / 'origami_recipe.schema.json')
        c = second_case(None)
        if mutate: c = mutate(c)
        (d / 'petal_engine_states.json').write_text(json.dumps({'note': g, 'cases': [c]}), encoding='utf-8')
        if patch:
            src = (d / 'check_petal_engine.py').read_text(encoding='utf-8')
            if src.count(patch[0]) != 1:
                print(f'NG {g} 置き換える行が {src.count(patch[0])} 個'); bad += 1; continue
            (d / 'check_petal_engine.py').write_text(src.replace(*patch), encoding='utf-8')
        env = dict(os.environ); env['PYTHONIOENCODING'] = 'utf-8'
        p = subprocess.run([sys.executable, 'check_petal_engine.py'], cwd=d, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, timeout=900)
        out = p.stdout.decode('utf-8', 'replace')
        ngs = [l.strip() for l in out.splitlines() if l.startswith('  NG ')]
        if p.returncode == 0: st = 'PASS'
        elif p.returncode == 2 or 'ABORT' in out: st = 'ABORT'
        else: st = 'DETECTED' if any(key in l for l in ngs) else 'WRONG'
        ok = st == want; bad += not ok
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}）", flush=True)
        for l in ngs[:2]: print('      ' + l[:160])
    shutil.rmtree(work, ignore_errors=True)
    print('\n' + ('ALL OK' if not bad else f'NG {bad}件'))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
