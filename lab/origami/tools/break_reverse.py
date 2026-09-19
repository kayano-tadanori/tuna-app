# -*- coding: utf-8 -*-
"""中割り（op:'reverse'）と「背の根元の頂点へ開きを伝える」規則の「わざと壊して確認」（2026-09-19・recipe_crane13.md 第24段）。
   engine を1か所だけ壊して node test_reverse_fold.js を回し、**それぞれ単独で**落ちることを確かめる。
★判定：PASS（鳴らない）／DETECTED（AssertionError か timeout で止まり、期待した文言がある）／WRONG／ABORT（それ以外の例外）
★使い方： python break_reverse.py [--browser] [G番号…]   （--browser で画面の G393〜G396 も＝実 Chrome・1本30秒ほど）
"""
import os, sys, shutil, subprocess, tempfile
from pathlib import Path

T = Path(__file__).resolve().parent
ENGINE = [
 ('G000', '基準（engine）', None, None, None, 'test_reverse_fold.js', 'PASS', ''),
 ('G386', '頂点を背の外に置く（線が背の線分をまたがなくても頂点を作る）', 'freefold_engine.js',
  " if(!((u>E&&v<-E)||(u<-E&&v>E)))return null;\n const t=u/(u-v);", " if(Math.abs(u-v)<E)return null;\n const t=u/(u-v);", 'test_reverse_fold.js', 'DETECTED', 'R6①'),
 ('G387', 'フラップに背をまたがない面を混ぜても断らない', 'freefold_engine.js',
  "||ids.some(id=>!sideOf.has(id)))throw Error('フラップが背でつながっていません');", ")throw Error('フラップが背でつながっていません');", 'test_reverse_fold.js', 'DETECTED', 'R6②'),
 ('G388', '入れ子の順を逆にする（下の側の先と上の側の先の上下を入れかえる）', 'freefold_engine.js',
  "   if(li&&!lj){edge(i,j);continue}if(lj&&!li){edge(j,i);continue}", "   if(li&&!lj){edge(j,i);continue}if(lj&&!li){edge(i,j);continue}", 'test_reverse_fold.js', 'DETECTED', '並びが中割りでない'),
 ('G389', '背の反転を忘れる（頂点から先の背の区間に reversedBy を付けない）', 'freefold_engine.js',
  "  bonds=bonds.map(b=>b===pieces[0]?{...b,reversedBy:[...(b.reversedBy||[]),st.id]}:b)}", "  bonds=bonds}", 'test_reverse_fold.js', 'DETECTED', '反転'),
 ('G390', 'hinge.seg の照合を外す（stepId＋faceIds だけで引き直す）', 'freefold_engine.js',
  " const bd=cand.find(b=>b.seg.every(", " const bd=cand[0];void cand.find(b=>b.seg.every(", 'test_reverse_fold.js', 'DETECTED', 'R6③'),
 ('G391', '根元の頂点の規則を壊す（根元の頂点を止めたまま回す）', 'freefold_engine.js',
  " const root=hist?reverseRoot(cache,rv,A,B,hist):null;", " const root=null;", 'test_reverse_fold.js', 'DETECTED', '提案で断られた：途中で紙が突き抜けます'),
 ('G392', '鎖の開く向きを根元から決めない（単独の模型の決め方のまま）', 'freefold_engine.js',
  " if(root){const lo=rv.lower==='x'?0:1,", " if(false&&root){const lo=rv.lower==='x'?0:1,", 'test_reverse_fold.js', 'DETECTED', '裂け'),
]
# 画面（入口の手直し・2026-09-19）：node test_crane13_browser.js（⑫までの操作を含む・実 Chrome）
BROWSER = [
 ('G393', '入口①を戻す：折り目にならない線を中割りの線として持たない', 'freefold3d.html',
  "     if(!ln)throw Error(why);", "     throw Error(why);", 'test_crane13_browser.js', 'DETECTED', '17 ⑭：「この線で中割り」が出る'),
 ('G394', '入口②を戻す：動く側の印に、指した点をそのまま使う', 'freefold3d.html',
  "rev.side=revSidePoint(rev.grab||rev.at,o);", "rev.side=rev.at;", 'test_crane13_browser.js', 'DETECTED', '17 ⑭：プレビューにならない'),
 ('G395', '入口②の一部を戻す：線が近すぎて候補が出ないとき、フラップの遠い頂点で聞き直さない', 'freefold3d.html',
  " if(!o.options.length&&E.stackAt(state,p).length){let[a,b]=rev.line;", " if(false){let[a,b]=rev.line;", 'test_crane13_browser.js', 'DETECTED', '17 ⑭：プレビューにならない'),
 ('G396', '入口②の一部を戻す：engine へ渡す線を延ばさない（紙片に切った短い線のまま）', 'freefold3d.html',
  "  const ln=[[mid[0]-u[0]*1.5,mid[1]-u[1]*1.5],[mid[0]+u[0]*1.5,mid[1]+u[1]*1.5]];", "  const ln=ln0;", 'test_crane13_browser.js', 'DETECTED', '17 ⑭：プレビューにならない'),
]


def one(g, file, a, b, test, work):
    d = work / g
    shutil.copytree(T, d, ignore=shutil.ignore_patterns('__pycache__', 'shots', '*.png', '*.npy', 'node_modules', 'recipe_examples', 'oripa_sample', 'figs', 'search_crane13_branch', 'crane13_stack_inputs'))
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
    only = [a for a in sys.argv[1:] if a.startswith('G')]
    rows = [r for r in ENGINE + BROWSER if r[0] in only] if only else ENGINE + (BROWSER if '--browser' in sys.argv else [])
    work = Path(tempfile.mkdtemp(prefix='break_reverse_'))
    bad = 0
    for g, what, f, a, b, test, want, key in rows:
        st, out = one(g, f, a, b, test, work)
        if st == 'NG':
            st = 'DETECTED' if key in out else 'WRONG'
        ok = st == want; bad += not ok
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}）", flush=True)
        for l in [l.strip() for l in out.splitlines() if l.startswith('AssertionError [') or l.startswith('Error: timeout') or '置き換える行' in l][:1]: print('      ' + l[:200])
        if st == 'ABORT': print('      ' + (out.strip().splitlines()[-1][:200] if out.strip() else ''))
    shutil.rmtree(work, ignore_errors=True)
    print('\n' + ('ALL OK' if not bad else f'NG {bad}件'))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
