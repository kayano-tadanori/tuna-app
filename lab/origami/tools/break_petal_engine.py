# -*- coding: utf-8 -*-
"""花弁折りの組込み（petal_v2.js・engine）の「わざと壊して確認」（2026-09-15）。
   壊した写しで node test_petal_v2.js --write → （JS が通ったときだけ）python check_petal_engine.py を走らせて判定する。
★判定（混ぜない）
   PASS     ＝ 両方とも通った（壊したのに鳴らない）
   DETECTED ＝ JS の AssertionError か Python の NG（終了コード1）で止まり、期待した文言がその出力にある
   WRONG    ＝ 止まったが、期待した文言が無い
   ABORT    ＝ JS が AssertionError 以外の例外で止まった／Python が終了コード2（ABORT）＝検証コードの異常終了（合否ではない）
★使い方： python break_petal_engine.py
"""
import os, sys, shutil, subprocess, tempfile
from pathlib import Path

T = Path(__file__).resolve().parent
B = [
 ('G000', '基準（何も壊さない）', None, None, None, 'PASS', ''),
 ('G338', '運動：2枚目の脇 S2R の回る向きを逆にする', 'petal_v2.js', "if (k === 'S2R') return add3(P, rot(kQ, -phi, sub3(b, P)));", "if (k === 'S2R') return add3(P, rot(kQ, phi, sub3(b, P)));", 'DETECTED', '運動の途中（θ=135.00°）で両側に離れます' ),  # 2026-09-15：運動中の結び見張り（motionBondGap）が、以前の「下へ潜る」より先に鳴るようになった
 ('G339', '層：動く面の高さの符号を逆に読む', 'petal_v2.js', "moving.has(id) ? pose(id, invPt(byId.get(id).xf, probe), th)[2] : 0", "moving.has(id) ? -pose(id, invPt(byId.get(id).xf, probe), th)[2] : 0", 'DETECTED', '確定後の平らな状態が成立しない'),
 ('G340', '認識：局所の層の照合を外す', 'petal_v2.js', "  if (!okLayers) continue;", "  if (false) continue;", 'DETECTED', '裏返し'),
 ('G341', '認識：出発の条件（花弁の上の止まった紙）を外す', 'petal_v2.js', "areaOf([f.poly, g.poly]) > MIN_AREA)))) continue;", "areaOf([f.poly, g.poly]) > MIN_AREA)))) void 0;", 'DETECTED', '花弁の上に止まった紙'),
 ('G342', '認識：軸の一周の条件を外す', 'petal_v2.js', "  if (above) continue;", "  void above;", 'DETECTED', '軸（P-Q）の上に上の層の紙が触れていても受理した'),
 ('G343', '再生：stack の上下の照合を外す', 'petal_v2.js', "  if (got.get(k) !== v) bad(`stack の上下が再生結果と違います", "  if (false) bad(`stack の上下が再生結果と違います", 'DETECTED', 'stack'),
 ('G344', '確定：候補を作ったときとの一致を見ない', 'freefold_engine.js', "if(cache.hash!==q.hash)throw Error('花弁折りの候補を作ったときと再生結果が違います');", "", 'DETECTED', '候補を作ったときと再生結果が違います'),
 ('G345', '結び：終端の平ら／折れを取り違える', 'petal_v2.js', "const kind = same ? 'crease' : folded ? 'hinge' :", "const kind = same ? 'hinge' : folded ? 'crease' :", 'DETECTED', '結び'),
 ('G346', '描画：面の三角形の巻き順を裏向きにする', 'petal_v2.js', "if (polyArea(mp) < 0) mp = mp.slice().reverse();", "if (polyArea(mp) > 0) mp = mp.slice().reverse();", 'DETECTED', '巻き順'),
 ('G347', '検証コードを例外で止める（ABORT の判定）', 'check_petal_engine.py', "    data = json.loads((HERE / 'petal_engine_states.json').read_text(encoding='utf-8'))", "    raise RuntimeError('わざと止める')", 'ABORT', ''),
]


def run(cmd, cwd):
    p = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env={**os.environ, 'ORIGAMI_SRC_DIR': ''})
    return p.returncode, p.stdout.decode('utf-8', 'replace')


def one(g, file, a, b, work):
    d = work / g
    shutil.copytree(T, d, ignore=shutil.ignore_patterns('__pycache__', 'shots', '*.png', 'node_modules', 'recipe_examples', 'oripa_sample'))
    if file:
        src = (d / file).read_text(encoding='utf-8')
        if src.count(a) != 1:
            return 'ABORT', f'置き換える行が {src.count(a)} 個（検査の対象の行が変わった）'
        (d / file).write_text(src.replace(a, b), encoding='utf-8')
    env_clean = dict(os.environ); env_clean.pop('ORIGAMI_SRC_DIR', None)
    p = subprocess.run(['node', 'test_petal_v2.js', '--write'], cwd=d, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env_clean)
    out = p.stdout.decode('utf-8', 'replace')
    if p.returncode != 0:
        return ('NG' if 'AssertionError' in out else 'ABORT'), out
    p2 = subprocess.run([sys.executable, '-X', 'utf8', 'check_petal_engine.py'], cwd=d, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env_clean)
    out2 = p2.stdout.decode('utf-8', 'replace')
    if p2.returncode == 0 and 'ALL OK' in out2:
        return 'PASS', out + out2
    if p2.returncode == 1:
        return 'NG', out + out2
    return 'ABORT', out + out2


def main():
    from concurrent.futures import ThreadPoolExecutor
    work = Path(tempfile.mkdtemp(prefix='break_petal_engine_'))
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {g: ex.submit(one, g, f, a, b, work) for g, _, f, a, b, _, _ in B}
    bad = 0
    for g, what, f, a, b, want, key in B:
        st, out = futs[g].result()
        if st == 'NG':
            st = 'DETECTED' if key in out else 'WRONG'
        ok = st == want
        bad += not ok
        lines = [l.strip() for l in out.splitlines() if l.strip().startswith(('NG ', 'AssertionError', 'ABORT')) or 'Error:' in l][:2]
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}）")
        for l in lines: print('      ' + l[:150])
    print('\n' + ('ALL OK' if not bad else f'NG {bad}件'))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
