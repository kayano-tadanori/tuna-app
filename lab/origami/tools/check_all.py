"""折り紙アプリの検査キット。1コマンドで全部の検査を流す。

★何のためか（本人 2026-09-03「いまからたくさん折り紙を追加していくから
  検査キット組んどけば」）
   作品を1つ足すたびに、10本以上ある検査を手で順に流すのは続かない。
   ここを叩けば全部流れて、どれが落ちたかだけが表で出る。

★使い方
   python check_all.py            … 全部（作品ぜんぶ＋アプリ全体）
   python check_all.py koppu      … その作品だけ（作品にひもづく検査を全部）
   python check_all.py --quick    … 2Dだけ（数秒。折り順を直した直後の見張り用）
   python check_all.py --list     … 何を見ている検査があるかの一覧

★作品を1つ足すときの手順
   ① works_build.py に build_xxx() を書いて、いちばん下の BUILDERS に登録する
      （作品の名簿はここ1か所。検査スクリプトに名前を書き足す必要はない）
   ② python check_all.py --quick xxx   … まず2Dで「実物で折れるか」を通す
   ③ python check_all.py xxx           … 本物のエンジンでも通す
   ④ python check_all.py               … 最後に全部（他の作品を壊していないか）

★落ちたときの読み方
   ・「実物の紙で折れるか」が落ちた → **折線ではなく折り手順を直す**
     （[[feedback_origami_fufuritsu]]②：折線は実際に折ってできた記録＝触らない）
   ・「本物のエンジンで折れるか」だけ落ちた → JSの書き出しか3D側の問題
   ・2Dが通ってエンジンが落ちるときは、まず works_build.py を流し直す
     （js/works/*.js は生成物。手で直さない）
   ・「ヒントの文と画面が合っているか」が落ちた → **文のほうを直す**。
     折り図に「うらがえす」がある作品でよく出る（折り図は裏から見た絵になるので
     左右が逆／手前へ折るはずが後ろへ回りこむ）。すいかが実例。
   ・「3Dの見た目が2Dの正解と合うか」が落ちた → `to_work_js.py` の**重なりの高さ**
     （layer_order）を疑う。折線ではない。**この1本だけが「自分の計算どうし」でなく
     2Dの正解と突き合わせている**＝ここが鳴ったら本当に見た目が違う。
   ・「輪になったつながりが裂けないか」が落ちた → その手は**折り線が1点に集まる頂点を
     同時に動かしている**（潰し折りの核）。骨の木では表せない形なので、板（剛体）のままでは
     直らない。**しきい値を上げてはいけない**——その手だけ紙を柔らかくして折る
     （[[feedback_tsubushiori_2d_genkai]]）。折り終わりだけ見る検査では絶対に出ない。
"""
import os, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).parent

# (スクリプト, 何を見るか, 作品ごとか, 速いか)
SUITE = [
    ('works_build.py',       '作品を作り直す（面積・展開図・骨組み）',      True,  True),
    ('check_foldable.py',    '実物の紙で折れるか（引き裂き・まん中の層）',  True,  True),
    ('test_fold2d_cp.py',    '折線ラボ（展開図）そのものの単体テスト',      False, True),
    ('check_works_app.py',   '本物のエンジンで最後まで折れるか',            True,  False),
    ('check_fold_motion.py', '折る途中の動き（両側にひらかない・ヒンジ）',  True,  False),
    ('check_loop_closure.py','輪になったつながりが折る途中に裂けないか',    True,  False),
    ('check_stack_height.py','重なりの高さが計算と合うか',                  True,  False),
    ('check_paper_face.py',  '3Dの見た目が2Dの正解と合うか（紙の表裏）',    True,  False),
    ('check_axis_safety.py', '骨の軸を逆に書いても壊れないか',              True,  False),
    ('check_no_backfold.py', '折れない方向へ動かないか',                    True,  False),
    ('check_hint_words.py',  'ヒントの文と画面が合っているか（左右・後ろ）',  True,  False),
    ('check_hidden.py',      '隠したものが本当に消えているか・ふきかけバーの出方', True,  False),
    ('check_problems.py',    '灘中対策の問題の図が壊れていないか',          False, False),
    ('check_camera.py',      'カメラの制限（作品は自由・問題は制限）',      False, False),
    ('check_ui_overlap.py',  '画面のボタンが重なっていないか',              False, False),
    ('check_settings.py',    'せってい画面（紙の色・厚み）',                False, False),
    ('check_from_honntai.py','本体（オトン学園）から開けるか',              False, False),
    ('check_editor.py',      '折線ラボのエディタ',                          False, False),
]


def main():
    args = sys.argv[1:]
    if '--list' in args:
        for s, what, per, quick in SUITE:
            print(f'{"作品ごと" if per else "アプリ全体"}  {"速" if quick else "  "}  '
                  f'{s:<24}{what}')
        return 0
    quick = '--quick' in args
    works = [a for a in args if not a.startswith('-')]
    if works:
        import works_build as W
        bad = [w for w in works if w not in W.BUILDERS]
        if bad:
            print(f'そんな作品はない: {bad}\nある作品: {", ".join(W.BUILDERS)}')
            return 2
    env = dict(os.environ, PYTHONIOENCODING='utf-8')

    plan = [row for row in SUITE
            if (not quick or row[3]) and (not works or row[2])]
    print(f'検査 {len(plan)}本'
          + (f' / 作品 {", ".join(works)}' if works else ' / 作品ぜんぶ')
          + (' / 2Dだけ' if quick else '') + '\n')

    rows, logs = [], {}
    for script, what, per_work, _q in plan:
        cmd = [sys.executable, script] + (works if per_work else [])
        t0 = time.time()
        r = subprocess.run(cmd, cwd=str(HERE), env=env, capture_output=True,
                           text=True, encoding='utf-8', errors='replace')
        dt = time.time() - t0
        out = (r.stdout or '') + (r.stderr or '')
        ok = r.returncode == 0
        rows.append((ok, script, what, dt))
        logs[script] = out
        print(('  OK  ' if ok else '  NG  ') + f'{script:<24}{what}  ({dt:.1f}秒)')

    ng = [r for r in rows if not r[0]]
    print()
    if ng:
        for _, script, what, _dt in ng:
            print(f'===== {script}（{what}）の中身 ' + '=' * 20)
            # ★NGの行を先に出す。HTTPサーバのアクセスログや OK の行で
            #   埋まって、肝心の落ちた理由が見えなくなる（2026-09-03に踏んだ）
            body = [l for l in logs[script].splitlines()
                    if l.strip() and not l.startswith('127.0.0.1')
                    and not l.lstrip().startswith('OK')]
            ngs = [l for l in body if 'NG' in l or '★' in l or 'Error' in l]
            for l in (ngs[:12] if ngs else body[-20:]):
                print(l)
            print()
        print(f'★{len(ng)}本 落ちた（全{len(rows)}本）')
    else:
        print(f'ALL OK（{len(rows)}本・{sum(r[3] for r in rows):.0f}秒）')
    return 1 if ng else 0


if __name__ == '__main__':
    sys.exit(main())
