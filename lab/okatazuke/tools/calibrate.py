# -*- coding: utf-8 -*-
"""ものさしの目もりを合わせる（キャリブレーション）。

★市販版の面データは **アプリには入れない**（Author: SEGA ＝公式面。
  公開アプリに載せると著作権侵害になる、と NotebookLM の資料[8,9,14]にある）。
  ここでは「本物の面は どれくらいの難しさか」を測って、
  自作の面を 同じものさしの上に並べるためだけに使う（手元での測定のみ）。

使い方: python tools/calibrate.py <SG-1000levels.txt> [面数]
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sokoban import Level  # noqa: E402
import difficulty  # noqa: E402


def parse(text):
    """Title:/Author:/Comment: 付きの形式を読む。"""
    out = []
    cur, name = [], ''
    for line in text.replace('\r', '').split('\n'):
        if line.startswith('Title:'):
            name = line[6:].strip(); continue
        if line.startswith(('Author:', 'Comment:', 'Comment-End:', ';')):
            if line.startswith('Comment-End:') and cur:
                out.append((name, cur)); cur, name = [], ''
            continue
        if line.strip() == '':
            continue
        cur.append(line)
    if cur:
        out.append((name, cur))
    return out


def main():
    path = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    cap = int(sys.argv[3]) if len(sys.argv) > 3 else 400000
    text = io.open(path, encoding='utf-8').read()
    lvs = parse(text)
    print('読んだ面: %d' % len(lvs))
    for name, rows in lvs[:n]:
        lv = Level(rows, name)
        errs = lv.validate()
        if errs:
            print('%-12s 読めない: %s' % (name, errs[0])); continue
        a = difficulty.analyze(lv, max_states=cap)
        if not a:
            print('%-12s にもつ%d … このものさしでは 測れない（%d盤面で打ち切り）'
                  % (name, len(lv.boxes), cap))
            continue
        print('%-12s むずかしさ %6.1f  おした%3d 調べた盤面%8d にもつ%2d 詰む手%3.0f%% せまさ%.2f'
              % (name, a['score'], a['pushes'], a['nodes'], a['boxes'],
                 a['fatal'] * 100, a['tight']))


if __name__ == '__main__':
    main()
