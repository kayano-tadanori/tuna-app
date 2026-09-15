# -*- coding: utf-8 -*-
"""check_petal_fold.py の「わざと壊して確認」を実行して判定する（2026-09-15）。

★なぜ作り直したか
   前の実行器（scratchpad の使い捨て）は、NG の行と 'Error' を含む行を数えるだけだった。
   検証コードが例外で止まると NG の行が出ず、「壊しても鳴らない（NG 0）」と同じ見え方になった（G332 で発生）。
   逆に NG を出したあとで例外が起きた場合（G326・G327）も「鳴った」に数えていた＝検査の失敗と異常終了が混ざっていた。
★判定（混ぜない）
   PASS    ＝ 終了コード0・最後に ALL OK ・NG の行なし（壊したのに鳴らない）
   DETECTED＝ 終了コード1・最後に「NG あり」・ABORT なし・期待した検査の NG の行がある
   WRONG   ＝ 終了コード1 だが、期待した検査の NG の行が無い（別の検査だけが鳴った）
   ABORT   ＝ 終了コード2／ABORT の行／Traceback／最後の行が無い ＝ 検証コードの異常終了（合否ではない）
   基準（何も壊さない）は PASS でなければならない。G336 は ABORT を ABORT と判定できるかの確認。
★使い方： python break_petal_fold.py   （並列に走らせて数分）
"""
import os, sys, shutil, subprocess, tempfile
from pathlib import Path

T = Path(__file__).resolve().parent
SRC = (T / 'check_petal_fold.py').read_text(encoding='utf-8')

B = [
    # (G, 何を壊すか, 置き換え前, 置き換え後, 期待する結果, 期待する NG の行に含まれる文字列)
    ('G000', '基準（何も壊さない）', None, None, 'PASS', []),
    ('G326', '連動を φ=θ にする', "w = C67 * u", "w = u", 'DETECTED', ['右の閉路']),
    ('G327', '前の素朴な式（w=cos67.5°/u）', "w = C67 * u", "w = C67 / u", 'DETECTED', ['右の閉路']),
    ('G328', 'T1R を花弁から外して止まる紙の軸に付ける', "rot_n(KP, st * u, rot_n(KQ, s1 * w, base3(mp) - P))", "rot_n(KQ, s1 * w, base3(mp) - P) * Dp", 'DETECTED', ['17本の結び']),
    ('G329', '合成：S2 の軸を層1にする（一周の順）', "('S2R', 'P', 'Q', 2)", "('S2R', 'P', 'Q', 1)", 'DETECTED', ['軸の一周']),
    ('G330', '合成：G2R を層3にする（出発）', "'G2R': (['Q2R', 'O', 'P'], 'QR', 2, 'fixed')", "'G2R': (['Q2R', 'O', 'P'], 'QR', 3, 'fixed')", 'DETECTED', ['出発']),
    ('G331', '数値の補助：S2R を下向きに回す', "elif k == 'S2R': x = PN['P'] + rot_np(kQ, sigR[2] * phi, b - PN['P'])", "elif k == 'S2R': x = PN['P'] + rot_np(kQ, -sigR[2] * phi, b - PN['P'])", 'DETECTED', ['z ≧ 0']),
    ('G332', '符号の判定に途中で0になる式を渡す', "('Q3 の高さ z>0（花弁の先）', z('T2R', 'Q3'))", "('Q3 の高さ z>0（花弁の先）', z('T2R', 'Q3') - (1 + u**2) * (1 + w**2) / 10)", 'DETECTED', ['Q3 の高さ']),
    ('G333', '左の脇を右と同じ符号で回す', "rot_n(KQL, s1l * w, base3(mp) - Pl)", "rot_n(KQL, -s1l * w, base3(mp) - Pl)", 'DETECTED', ['左の閉路']),
    ('G334', '終端の上下：動く面どうしの上下を逆に読む', "return 1 if pos else (-1 if neg else 0)", "return -1 if pos else (1 if neg else 0)", 'DETECTED', ['[数値↔厳密]']),
    ('G335', '合成：区画の1頂点だけ a1 の差の符号を反転（区画の中で順序が変わる）', "d = [a1_at(A, xy) - a1_at(B, xy) for xy in probe]", "d = [(-1 if i == 0 else 1) * (a1_at(A, xy) - a1_at(B, xy)) for i, xy in enumerate(probe)]", 'DETECTED', ['区画の中で順序が変わらない']),
    ('G336', '検証コードを例外で止める（実行器が ABORT と判定するか）', "    print('\\n[4b] 非貫通", "    raise RuntimeError('わざと止める')\n    print('\\n[4b] 非貫通", 'ABORT', []),
]


def classify(rc, out):
    lines = [l.rstrip() for l in out.splitlines() if l.strip()]
    ng = [l.strip() for l in lines if l.strip().startswith('NG ') and l.strip() != 'NG あり']
    last = lines[-1] if lines else ''
    if rc == 2 or any(l.startswith('ABORT') for l in lines) or 'Traceback' in out or not (last in ('ALL OK', 'NG あり') or last.startswith('NG あり')):
        return 'ABORT', ng
    if rc == 0 and last == 'ALL OK' and not ng:
        return 'PASS', ng
    if rc == 1 and ng:
        return 'NG', ng
    return 'ABORT', ng


def main():
    work = Path(tempfile.mkdtemp(prefix='break_petal_'))
    procs = []
    for g, what, a, b, want, keys in B:
        d = work / g; d.mkdir()
        src = SRC
        if a is not None:
            n = src.count(a)
            if n < 1:
                print(f'{g} 置き換える行が見つからない（検査の行が変わった）'); return 2
            src = src.replace(a, b, 1)
        (d / 'check_petal_fold.py').write_text(src, encoding='utf-8')
        shutil.copy(T / 'crane_step7_state.json', d / 'crane_step7_state.json')
        procs.append((g, what, want, keys, subprocess.Popen([sys.executable, '-X', 'utf8', str(d / 'check_petal_fold.py')], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=d)))
    bad = 0
    for g, what, want, keys, p in procs:
        out = p.communicate()[0].decode('utf-8', 'replace')
        st, ng = classify(p.returncode, out)
        if st == 'NG':
            st = 'DETECTED' if all(any(k in l for l in ng) for k in keys) else 'WRONG'
        ok = st == want
        bad += not ok
        print(f"{'ok' if ok else 'NG'} {g} {what}: {st}（期待 {want}・終了コード {p.returncode}・NG {len(ng)}行）")
        for l in ng[:3]:
            print('      ' + l[:140])
    print('\n' + ('ALL OK' if bad == 0 else f'NG {bad}件'))
    return 0 if bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
