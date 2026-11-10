# -*- coding: utf-8 -*-
r"""小3 最レ算数【刷新版】宿題テキスト（No.17〜）の「回ごとの下ごしらえ」（2026-11-10）。

  python scripts/s3sairei_prep.py <回> [--force]

`sairei5_prep.py` の小3最レ版。本は `_結合/小3/小3_最レ算数_宿題テキスト_No.01-24_{問題,解答}.pdf`（しおり＝第2階層 `No.17 …`）。
作業フォルダ `docs/_genbo/s3sairei_no<回>/`、仮ID `TRIAL-S3S-<回>-<大問>`。
担当わけ：問題ページを2ページずつ（端数は最後の担当に寄せる）。
"""
import glob, io, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import fitz
from sairei5_prep import dump, contact                                   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = r'G:\マイドライブ\浜問題\_結合\小3\小3_最レ算数_宿題テキスト_No.01-24_%s.pdf'
LET = 'ABCDEFG'


def starts(pdf):
    out, tot = {}, fitz.open(pdf).page_count
    for lv, t, pg in fitz.open(pdf).get_toc():
        m = re.match(r'No\.(\d+)\s+(.*?)（', t)
        if lv == 2 and m:
            out[int(m.group(1))] = (pg, m.group(2).strip())
    return out, tot


def work_dir(no):
    return os.path.join(BASE, 'docs/_genbo/s3sairei_no%d' % no)


def prefix(no):
    return 'TRIAL-S3S-%d-' % no


def main():
    no = int(sys.argv[1])
    MON, KAI = PDF % '問題', PDF % '解答'
    M, mt = starts(MON); K, kt = starts(KAI)
    ms, title = M[no]; me = M[no + 1][0] - 1 if no + 1 in M else mt
    ks = K[no][0]; ke = K[no + 1][0] - 1 if no + 1 in K else kt
    mp, kp = list(range(ms, me + 1)), list(range(ks, ke + 1))
    print('No.%d %s … 問題 p%d-%d（%dp）／解答 p%d-%d（%dp）' % (no, title, ms, me, len(mp), ks, ke, len(kp)))
    work = work_dir(no)
    if glob.glob(os.path.join(work, 'g1', '*.json')) and '--force' not in sys.argv:
        sys.exit('✗ すでにG1の出力がある')
    for sub in ('pages', 'g1', 'svg', 'patch', 'out'):
        os.makedirs(os.path.join(work, sub), exist_ok=True)
    pg_dir = os.path.join(work, 'pages')
    dump(MON, 'mondai', mp, pg_dir)
    kf = dump(KAI, 'kaitou', kp, pg_dir)
    contact(kf, os.path.join(pg_dir, 'kaitou_index.png'))
    groups = [mp[i:i + 2] for i in range(0, len(mp), 2)]
    if len(groups) > 1 and len(groups[-1]) == 1:
        last = groups.pop()
        groups[-1] = groups[-1] + last
    rel = os.path.relpath(work, BASE).replace('\\', '/')
    rows = '\n'.join('| %s | %s | `%s<大問番号>` |' % (LET[i], '・'.join('mondai_p%03d' % p for p in g), prefix(no))
                     for i, g in enumerate(groups))
    kai = '・'.join('kaitou_p%03d' % p for p in kp)
    io.open(os.path.join(work, '_TARGET.md'), 'w', encoding='utf-8').write(
        u'# 小3 最レ算数【刷新版】宿題テキスト No.%d %s\n\n| 担当 | 問題ページ | 仮ID |\n|---|---|---|\n%s\n\n- 解答ページ：%s\n'
        % (no, title, rows, kai))
    t = io.open(os.path.join(BASE, 'docs/_genbo/_G1_SHIJI_s3sairei.md'), encoding='utf-8').read()
    for a, b in (('{NO}', str(no)), ('{TITLE}', title), ('{WORK}', rel), ('{PREFIX}', prefix(no)),
                 ('{KAITOU}', kai), ('{GROUPS}', rows)):
        t = t.replace(a, b)
    io.open(os.path.join(work, '_G1_SHIJI.md'), 'w', encoding='utf-8').write(t)
    print('担当:', ' / '.join('%s=%s' % (LET[i], ','.join('p%d' % p for p in g)) for i, g in enumerate(groups)))


if __name__ == '__main__':
    main()
