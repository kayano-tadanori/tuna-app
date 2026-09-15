# -*- coding: utf-8 -*-
"""つる⑦を「実際に折って開く」工程（2026-09-15）の「わざと壊して確認」。
   ①折線のこの側を全部 ②開いた背＝折り目 ③花弁の認識のまとまり ④線で折る、を1か所ずつ壊し、検査が鳴るかを見る。
   engine の壊し → node test_petal_v2.js、画面の壊し → node test_fold_open7_browser.js（実 Chrome）。
★判定：PASS（鳴らない）／DETECTED（AssertionError か timeout で止まり、期待した文言がある）／WRONG／ABORT（それ以外の例外）
★使い方： python break_fold_open7.py [--browser] [G番号…]
"""
import os, sys, shutil, subprocess, tempfile
from pathlib import Path

T = Path(__file__).resolve().parent
ENGINE = [
 ('G000', '基準（engine）', None, None, None, 'test_petal_v2.js', 'PASS', ''),
 ('G359', '①この側を全部：紙全体でなく指の下の面だけにする', 'freefold_engine.js', " const ids=sideAllFaces(state,A,B);", " const ids=sideAllFaces(state,A,B).filter(id=>stackAt(state,p).some(v=>v.faceId===id));", 'test_petal_v2.js', 'DETECTED', 'この側を全部'),
 ('G360', '①選び方の共通の判定（foldability／creasability）を外す', 'freefold_engine.js', " const v=q.op==='crease'?creasability(state,ids,A,B,p):foldability(state,ids,A,B,q.kind,p);\n if(!v.ok)throw Error(v.reason);", " const v={ok:true};", 'test_petal_v2.js', 'DETECTED', '断り方が変わった'),
 ('G361', '②開いた背を hinge のままにする', 'freefold_engine.js', "   return{...bd,kind:'crease',openedBy:st.id}})}", "   return bd})}", 'test_petal_v2.js', 'DETECTED', '種類が置かれ方と違う'),
 ('G362', '②開いた背の由来（stepId）を開いた手で上書きする', 'freefold_engine.js', "   return{...bd,kind:'crease',openedBy:st.id}})}", "   return{...bd,kind:'crease',openedBy:st.id,stepId:st.id}})}", 'test_petal_v2.js', 'DETECTED', '由来'),
 ('G363', '②開いた背の折り目を表示に足さない', 'freefold_engine.js', "   creases.push({creaseId:`c-${st.id}-${creases.length+1}`,stepId:bd.stepId,", "   void({creaseId:`c-${st.id}-${creases.length+1}`,stepId:bd.stepId,", 'test_petal_v2.js', 'DETECTED', '表示に12本'),
 ('G364', '②同じ線で折り直した背に openedBy を残す', 'freefold_engine.js', "const hb={...bd,faceIds:[fx,fy],kind:'hinge',stepId:st.id};delete hb.openedBy;return[hb]}", "const hb={...bd,faceIds:[fx,fy],kind:'hinge',stepId:st.id};return[hb]}", 'test_petal_v2.js', 'DETECTED', 'openedBy が残る'),
 ('G373', '③敷きつめの条件を外す（三角形と重なる面をぜんぶまとまりに入れる）', 'petal_v2.js', "  if (!members.length || members.some(m => Math.abs(m.cut - m.area) > 1e-9) || Math.abs(members.reduce((s, m) => s + m.cut, 0) - triArea) > 1e-9) return null;", "  if (!members.length) return null;", 'test_petal_v2.js', 'DETECTED', '花弁のまわりの紙の上下が、つる⑦のあとと違います'),
 ('G365', '③まとまりの中の結びが crease かを見ない', 'petal_v2.js', "  if (inner.some(bd => bd.kind !== 'crease')) return null;", "", 'test_petal_v2.js', 'DETECTED', 'まとまりの中に背がある'),
 ('G366', '③まとまりの中が結びでつながっているかを見ない', 'petal_v2.js', "  if (seen.size !== ids.length) return null;", "", 'test_petal_v2.js', 'DETECTED', 'つながっていない'),
 ('G367', '③軸の一周を、重ならない面どうしの番号比較に戻す', 'petal_v2.js', "      return insideStrict(s, g.poly) && insideStrict(s, f.poly) && f.layer > g.layer }) }) });", "      return f.layer > g.layer }) }) });", 'test_petal_v2.js', 'DETECTED', '折って開いた⑦で花弁が1つにならない'),
 ('G368', '③運動の途中の結びのずれを数えない', 'petal_v2.js', "    if (d > worst.max) worst = { max: d, bondId: bd.bondId, deg: 180 * i / 16 } } }", "    void d } }", 'test_petal_v2.js', 'DETECTED', '取り違えた読み方でも鳴らない'),
 ('G369', '③層の照合をまとまりの代表の面だけで行う', 'petal_v2.js', "   for (const fa of groupOf[a]) { for (const fb of groupOf[b]) {", "   for (const fa of groupOf[a].slice(0, 1)) { for (const fb of groupOf[b].slice(0, 1)) {", 'test_petal_v2.js', 'PASS', ''),
]
BROWSER = [
 ('G000b', '基準（画面）', None, None, None, 'test_fold_open7_browser.js', 'PASS', ''),
 ('G370', '画面：「折線のこの側を全部」のボタンを出さない', 'freefold3d.html', "b.textContent='折線のこの側を全部';b.dataset.n='side';\n  b.onclick=()=>applyLayers('side');stackPickEl.appendChild(b)}", "b.textContent='折線のこの側を全部';b.dataset.n='side';}", 'test_fold_open7_browser.js', 'DETECTED', '折線のこの側を全部」が出る'),
 ('G371', '線で折る：折る側を面ぜんぶから選ぶ（指した側を見ない）', 'freefold_engine.js', "const p=sg.mode==='line-fold'?deepestOnSide(f,sg.line[0],sg.line[1],at):deepestInFace(f,sg.line[0],sg.line[1]);", "const p=deepestInFace(f,sg.line[0],sg.line[1]);", 'test_fold_open7_browser.js', 'DETECTED', '8面が成立しない'),
 ('G372', '画面：「この線で折る」で折り目の手も入れる', 'freefold3d.html', "try{clearHingePick();staged=E.stageLine(state,kindValue);", "try{clearHingePick();staged=E.stage(state,kindValue);", 'test_fold_open7_browser.js', 'DETECTED', '3 折る側の案内が出ない' ),  # 折り目の手を先に入れると、その時点で案内が出ない（stage が断る）
]


def one(g, file, a, b, test, work):
    d = work / g
    shutil.copytree(T, d, ignore=shutil.ignore_patterns('__pycache__', 'shots', '*.png', 'node_modules', 'recipe_examples', 'oripa_sample'))
    if file:
        src = (d / file).read_text(encoding='utf-8')
        if src.count(a) != 1:
            return 'ABORT', f'置き換える行が {src.count(a)} 個'
        (d / file).write_text(src.replace(a, b), encoding='utf-8')
    env = dict(os.environ); env.pop('ORIGAMI_SRC_DIR', None); env['ORIGAMI_SHOTS'] = str(d)
    p = subprocess.run(['node', test], cwd=d, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, timeout=900)
    out = p.stdout.decode('utf-8', 'replace')
    if p.returncode == 0:
        return 'PASS', out
    return ('NG' if ('AssertionError' in out or 'Error: timeout' in out) else 'ABORT'), out


def main():
    rows = ENGINE + (BROWSER if '--browser' in sys.argv else [])
    only = [a for a in sys.argv[1:] if a.startswith('G')]
    if only: rows = [r for r in ENGINE + BROWSER if r[0] in only]
    work = Path(tempfile.mkdtemp(prefix='break_foldopen7_'))
    bad = 0
    for g, what, f, a, b, test, want, key in rows:
        st, out = one(g, f, a, b, test, work)
        if st == 'NG':
            st = 'DETECTED' if key in out else 'WRONG'
        ok = st == want; bad += not ok
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}）", flush=True)
        for l in [l.strip() for l in out.splitlines() if 'AssertionError' in l or 'Error: timeout' in l or '置き換える行' in l][:1]: print('      ' + l[:160])
        if st == 'ABORT': print('      ' + out.strip().splitlines()[-1][:200] if out.strip() else '')
    shutil.rmtree(work, ignore_errors=True)
    print('\n' + ('ALL OK' if not bad else f'NG {bad}件'))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
