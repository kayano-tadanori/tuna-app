# -*- coding: utf-8 -*-
"""折り目だけの「上からN枚」（creasability）と、指を離したときのゴーストの角度の「わざと壊して確認」（2026-09-15）。
   engine の壊し → node test_crease_layers.js、画面の壊し → node test_petal_browser.js（実 Chrome）。
★判定：PASS（鳴らない）／DETECTED（AssertionError か timeout で止まり、期待した文言がある）／WRONG／ABORT（それ以外の例外）
★使い方： python break_crease_layers.py [--browser]
"""
import os, sys, shutil, subprocess, tempfile
from pathlib import Path

T = Path(__file__).resolve().parent
ENGINE = [
 ('G000', '基準（engine）', None, None, None, 'test_crease_layers.js', 'PASS', ''),
 ('G349', 'setLayers が候補の操作を見ない（折り目だけも折りの判定）', 'freefold_engine.js', "const v=q.op==='crease'?creasability(state,ids,A,B,p):foldability(state,ids,A,B,q.kind,p);", "const v=foldability(state,ids,A,B,q.kind,p);", 'test_crease_layers.js', 'DETECTED', '折り目だけの上から1枚を engine が断った'),
 ('G350', 'creasability：上から続けての門を外す', 'freefold_engine.js', "function creasability(state,ids,a,b,at){const r=creasableSet(", "function creasability(state,ids,a,b,at){at=null;const r=creasableSet(", 'test_crease_layers.js', 'DETECTED', '上から続けて'),
 ('G351', 'creasableSet：取りこぼしの門を外す', 'freefold_engine.js', " if(miss.length)return{ok:false,reason:'折り目でつながった紙が選ばれていません（折り目が途中で途切れます）',blocking:[...new Set(miss)]};", "", 'test_crease_layers.js', 'DETECTED', '途切れます'),
 ('G352', 'creasableSet：線が分けるかの門を外す', 'freefold_engine.js', " if(!split2.length)return{ok:false,reason:'折り目の線が、選んだ紙を二つに分けていません',blocking:[]};", "", 'test_crease_layers.js', 'DETECTED', '二つに分けていません'),
 ('G355', '確定：折り目だけに creasability をかけない', 'freefold_engine.js', " else{const able=creasability(state,ids,A,B,q.at);if(!able.ok)throw Error(able.reason)}", "", 'test_crease_layers.js', 'DETECTED', 'D1 飛び飛びの折り目だけを confirm が通した'),
 ('G356', '再生：折り目だけの手に creasableSet をかけない', 'freefold_engine.js', " else{const chk=creasableSet(faces,bonds,ids,A,B);/* ✏️ 折り目だけも、提案・確定と同じ芯で見る */", " else{const chk={ok:true};/* 壊した */", 'test_crease_layers.js', 'DETECTED', 'D2'),
 ('G357', '確定：候補の操作と確定の操作の食い違いを見ない', 'freefold_engine.js', " if(q.op&&q.op!==(crease?'crease':'fold'))throw Error(", " if(false)throw Error(", 'test_crease_layers.js', 'DETECTED', 'D4'),
 ('G358', '折り目を付けてそのまま折る：後半の折りを折り目だけとして作る', 'freefold_engine.js', " proposeOnFace(derived,A,B,f.faceId,{layers:1,op:'fold'});", " proposeOnFace(derived,A,B,f.faceId,{layers:1,op:'crease'});", 'test_crease_layers.js', 'DETECTED', 'E 後半'),
]
BROWSER = [
 ('G000b', '基準（画面）', None, None, None, 'test_petal_browser.js', 'PASS', ''),
 ('G353', '画面：「折り目を引く」の提案を折りとして出す', 'freefold3d.html', "E.proposeOnFace(state,cr.line[0],cr.line[1],cr.faceId,{layers:1,op:'crease'});", "E.proposeOnFace(state,cr.line[0],cr.line[1],cr.faceId,{layers:1,op:'fold'});", 'test_petal_browser.js', 'DETECTED', '上の三角の折り目が確定できる'),
 ('G354', '画面：指を離したときのゴーストの角度を前の書き方に戻す', 'freefold3d.html', "geom=E.preview(state,(!staged&&sess.op==='line')?0:180)", "geom=E.preview(state,ghostAngle())", 'test_freefold_browser.js', 'DETECTED', '指を離したあとのゴーストが0°でない'),
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
    if only: rows = [r for r in rows if r[0] in only]
    work = Path(tempfile.mkdtemp(prefix='break_crease_'))
    bad = 0
    for g, what, f, a, b, test, want, key in rows:
        st, out = one(g, f, a, b, test, work)
        if st == 'NG':
            st = 'DETECTED' if key in out else 'WRONG'
        ok = st == want; bad += not ok
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}）", flush=True)
        for l in [l.strip() for l in out.splitlines() if 'AssertionError' in l or 'Error: timeout' in l][:1]: print('      ' + l[:160])
    print('\n' + ('ALL OK' if not bad else f'NG {bad}件'))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
