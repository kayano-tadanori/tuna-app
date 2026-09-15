# -*- coding: utf-8 -*-
"""つる⑫（つながっているフラップ・外形の背をつかむ・中心線へ合わせる）の「わざと壊して確認」（2026-09-16）。
   engine の壊し → node test_crane12.js、画面の壊し → node test_crane12_browser.js（実 Chrome）。
★判定：PASS（鳴らない）／DETECTED（AssertionError か timeout で止まり、期待した文言がある）／WRONG／ABORT（それ以外の例外）
★使い方： python break_crane12.py [--browser] [G番号…]
"""
import os, sys, shutil, subprocess, tempfile
from pathlib import Path

T = Path(__file__).resolve().parent
ENGINE = [
 ('G000', '基準（engine）', None, None, None, 'test_crane12.js', 'PASS', ''),
 ('G377', 'フラップ：結びをたどらず、その場所のいちばん上の面だけにする', 'freefold_engine.js', " return[...movingSetOf(state.cache,top.faceId,a,b)]}", " return[top.faceId]}", 'test_crane12.js', 'DETECTED', 'フラップ'),
 ('G378', '外形の背：片側に紙が無いことを見ない（内部の背もつかめる）', 'freefold_engine.js', "     if(!!sa.length===!!sb.length)continue;/* 両側に紙がある（内部）・両側とも無い＝決めない */", "     if(!sa.length&&!sb.length)continue;", 'test_crane12.js', 'DETECTED', '紙の内部の背'),
 ('G379', '合わせ先：外形の背のときも目印を延ばさない', 'freefold_engine.js', "  const tseg=e.kind==='hingeEdge'?extendGuide(state,c.seg,root):c.seg;", "  const tseg=c.seg;", 'test_crane12.js', 'DETECTED', '先端を通る合わせ方が無い'),
 ('G380', '合わせ先：生のふちをつかむ道でも目印を延ばす', 'freefold_engine.js', "  const tseg=e.kind==='hingeEdge'?extendGuide(state,c.seg,root):c.seg;", "  const tseg=extendGuide(state,c.seg,root);", 'test_crane12.js', 'DETECTED', '変更前と違う'),
 ('G381', '確定：外形の背の辺合わせで、延ばした目印で見直さない', 'freefold_engine.js', "  const v=checkEdgeToCrease(ax.line,e.seg,e.kind==='hingeEdge'?extendGuide(state,c.seg,paperRootOf(c.faceId)):c.seg);", "  const v=checkEdgeToCrease(ax.line,e.seg,c.seg);", 'test_crane12.js', 'DETECTED', '辺合わせの確定が断られた'),
]
BROWSER = [
 ('G000b', '基準（画面）', None, None, None, 'test_crane12_browser.js', 'PASS', ''),
 ('G382', '画面：外形の背をタップしても背を選ばない', 'freefold3d.html', "  if(sess.source.outlineHinge&&!N.movedEnough(sess.source.origin,sess.finger||sess.source.origin)){pickHingeAt(sess.source.origin);draw();return}", "", 'test_crane12_browser.js', 'DETECTED', '背を選べない'),  # ⑦の背を開くタップ（外形の背）で先に鳴る＝既存のタップ選択も同じ道
 ('G383', '画面：「つながっているフラップ」のボタンを出さない', 'freefold3d.html', "b.textContent='つながっているフラップ';b.dataset.n='flap';\n  b.onclick=()=>applyLayers('flap');stackPickEl.appendChild(b)}", "b.textContent='つながっているフラップ';b.dataset.n='flap';}", 'test_crane12_browser.js', 'DETECTED', 'つながっているフラップ」が出る'),
 ('G384', '画面：フラップのとき指の下に無い紙を縁取らない', 'freefold3d.html', "  if((layerPick.n==='side'||layerPick.n==='flap')&&ST().pending&&ST().pending.sidePoint){", "  if(layerPick.n==='side'&&ST().pending&&ST().pending.sidePoint){", 'test_crane12_browser.js', 'DETECTED', '指の下に無い紙の縁取りが出ない'),
]


def one(g, file, a, b, test, work):
    d = work / g
    shutil.copytree(T, d, ignore=shutil.ignore_patterns('__pycache__', 'shots', '*.png', 'node_modules', 'recipe_examples', 'oripa_sample'))
    if file:
        src = (d / file).read_text(encoding='utf-8')
        if src.count(a) != 1:
            return 'ABORT', f'置き換える行が {src.count(a)} 個'
        (d / file).write_text(src.replace(a, b), encoding='utf-8')
    env = dict(os.environ); env.pop('ORIGAMI_SRC_DIR', None); env['ORIGAMI_SHOTS'] = str(d); env['ORIGAMI_GIT_DIR'] = str(T)
    p = subprocess.run(['node', test], cwd=d, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, timeout=1200)
    out = p.stdout.decode('utf-8', 'replace')
    if p.returncode == 0:
        return 'PASS', out
    return ('NG' if ('AssertionError' in out or 'Error: timeout' in out) else 'ABORT'), out


def main():
    rows = ENGINE + (BROWSER if '--browser' in sys.argv else [])
    only = [a for a in sys.argv[1:] if a.startswith('G')]
    if only: rows = [r for r in ENGINE + BROWSER if r[0] in only]
    work = Path(tempfile.mkdtemp(prefix='break_crane12_'))
    bad = 0
    for g, what, f, a, b, test, want, key in rows:
        st, out = one(g, f, a, b, test, work)
        if st == 'NG':
            st = 'DETECTED' if key in out else 'WRONG'
        ok = st == want; bad += not ok
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}）", flush=True)
        for l in [l.strip() for l in out.splitlines() if 'AssertionError' in l or 'Error: timeout' in l or '置き換える行' in l][:1]: print('      ' + l[:160])
        if st == 'ABORT': print('      ' + (out.strip().splitlines()[-1][:200] if out.strip() else ''))
    shutil.rmtree(work, ignore_errors=True)
    print('\n' + ('ALL OK' if not bad else f'NG {bad}件'))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
