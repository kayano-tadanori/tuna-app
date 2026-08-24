# -*- coding: utf-8 -*-
"""配られたステージ集を取りこんで、1面ずつ 検算と 難易度の実測をする。

やること
  1. 面データを読む
  2. 解答集の手順を **実際に動かして** 本当にクリアになるか確かめる（＝検算）
     ★手順が合わない面は 落とす。「解けない面を出さない」がいちばん大事
  3. むずかしさを測る（difficulty.py。探索の広さ・手数・にもつ・詰む手の割合）
  4. むずかしさの順に ならべて JSON に落とす（make_levels.py が読む）

使い方:
  python tools/import_sg.py <面データ.txt> <解答集.txt> [出力.json] [探索上限]
"""
import io
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sokoban import Level, replay, solve  # noqa: E402
import difficulty  # noqa: E402


def parse_levels(text):
    out = []
    cur, name = [], ''
    for line in text.replace('\r', '').split('\n'):
        if line.startswith('Title:'):
            name = line[6:].strip(); continue
        if line.startswith(('Author:', 'Comment:', ';')):
            continue
        if line.startswith('Comment-End:'):
            if cur:
                out.append((name, cur))
            cur, name = [], ''
            continue
        if line.strip() == '':
            continue
        cur.append(line)
    if cur:
        out.append((name, cur))
    return out


def parse_solutions(text):
    sol = {}
    key, buf = None, []
    for line in text.replace('\r', '').split('\n'):
        m = re.match(r'^\[(.+?)\]', line.strip())
        if m:
            if key:
                sol[key] = ''.join(buf)
            key, buf = m.group(1).strip(), []
            continue
        if key is not None:
            s = re.sub(r'[^udlrUDLR]', '', line)
            buf.append(s)
    if key:
        sol[key] = ''.join(buf)
    return sol


def norm_key(k):
    """[ROUND 001]* のような印を落として ROUND 001 にそろえる"""
    return re.sub(r'[^A-Za-z0-9 ]', '', k).strip().upper()


def main():
    lv_path, so_path = sys.argv[1], sys.argv[2]
    out_path = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, '_imported.json')
    cap = int(sys.argv[4]) if len(sys.argv) > 4 else 120000
    tl = float(sys.argv[5]) if len(sys.argv) > 5 else 6.0   # 1面あたりの探索の時間（秒）

    levels = parse_levels(io.open(lv_path, encoding='utf-8').read())
    sols = {norm_key(k): v for k, v in parse_solutions(io.open(so_path, encoding='utf-8').read()).items()}
    print('面 %d／解答 %d' % (len(levels), len(sols)), flush=True)

    good, bad = [], []
    t0 = time.time()
    for i, (name, rows) in enumerate(levels):
        lv = Level(rows, name)
        errs = lv.validate()
        if errs:
            bad.append((name, '盤面が おかしい: ' + errs[0])); continue
        path = sols.get(norm_key(name), '')
        ok = False
        info = None
        if path:
            ok, info = replay(lv, path.upper())
        if not ok:
            # 解答が無い／合わない場合は 自力で解いてみる
            r = solve(lv, max_states=cap, time_limit=tl)
            if r.get('solved'):
                path = r['path']
                ok, info = replay(lv, path)
        if not ok:
            bad.append((name, '解答の手順で クリアにならない（解答%d手）' % len(path)))
            continue

        a = difficulty.analyze(lv, max_states=cap, path=path.upper(), time_limit=tl)
        if not a:
            bad.append((name, 'むずかしさを 測れなかった')); continue
        good.append({
            'src': name, 'rows': [r.rstrip() for r in lv.rows],
            'par': a['pushes'], 'parMoves': a['moves'], 'boxes': a['boxes'],
            'nodes': a['nodes'], 'capped': a['capped'], 'fatal': round(a['fatal'], 4),
            'tight': round(a['tight'], 3), 'area': a['area'],
            'score': round(a['score'], 2), 'optimal': a['optimal'],
        })
        if (i + 1) % 5 == 0:
            print('  %d面 ずみ（%.0f秒）' % (i + 1, time.time() - t0), flush=True)

    good.sort(key=lambda d: d['score'])
    io.open(out_path, 'w', encoding='utf-8').write(json.dumps(good, ensure_ascii=False, indent=1))
    print('\n取りこめた: %d面 ／ 落とした: %d面' % (len(good), len(bad)))
    for nm, why in bad[:20]:
        print('  ×', nm, '…', why)
    print('\nむずかしさの ちらばり:')
    for d in good[::max(1, len(good) // 20)]:
        print('  %6.1f  %-12s おした%3d にもつ%2d 盤面%7d%s 詰む手%3.0f%%'
              % (d['score'], d['src'], d['par'], d['boxes'], d['nodes'],
                 '+' if d['capped'] else ' ', d['fatal'] * 100))
    print('書いた:', out_path)


if __name__ == '__main__':
    main()
