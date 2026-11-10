# -*- coding: utf-8 -*-
r"""小5 最レ算数 第4分冊（No.31〜42）の「回ごとの下ごしらえ」（2026-11-10）。

  python scripts/sairei5_prep.py <講座1|2> <回> [--force]

やること（外部送信なし）：
  1. 作業フォルダ `docs/_genbo/sairei5_k<講座>_no<回>/` を作る
  2. 問題6ページと、解答の範囲（この回の先頭〜次の回の先頭ページ＝境目のページも含む）の
     埋めこみ画像を原寸のまま取り出す
  3. 解答ページの**一覧画像**（`pages/kaitou_index.png`）を作る＝担当が自分の大問のページを探す用
  4. `_G1_SHIJI.md`（`docs/_genbo/_G1_SHIJI_sairei5.md` の差しこみ）と `_TARGET.md`（担当わけ）を書く

★ページ割りはしおり（get_toc）から取る。手で数えない。
★担当わけ：問題6ページを2ページずつ3担当（A＝p1-2／B＝p3-4／C＝p5-6）。
"""
import glob, io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import fitz
from PIL import Image, ImageDraw
from sairei5_books import book_of, work_dir, trial_prefix, toc_starts   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def dump(pdf, tag, pages, outdir):
    d = fitz.open(pdf)
    got = {}
    for pg in pages:
        imgs = d[pg - 1].get_images(full=True)
        if len(imgs) != 1:
            print('  !! %s p%d は埋めこみ画像が%d枚（手で確認）' % (tag, pg, len(imgs)))
            continue
        info = d.extract_image(imgs[0][0])
        fn = os.path.join(outdir, '%s_p%03d.%s' % (tag, pg, info['ext']))
        io.open(fn, 'wb').write(info['image'])
        got[pg] = fn
    return got


def contact(files, out, cols=4, w=420):
    ims = []
    for pg, fn in sorted(files.items()):
        im = Image.open(fn).convert('RGB')
        im = im.resize((w, int(im.height * w / im.width)))
        dr = ImageDraw.Draw(im)
        dr.rectangle([0, 0, 110, 34], fill='red')
        dr.text((6, 6), 'PDF p%d' % pg, fill='white')
        ims.append(im)
    h = max(i.height for i in ims)
    rows = (len(ims) + cols - 1) // cols
    c = Image.new('RGB', (cols * w, rows * h), 'white')
    for i, im in enumerate(ims):
        c.paste(im, ((i % cols) * w, (i // cols) * h))
    c.save(out)


def main():
    k, no = int(sys.argv[1]), int(sys.argv[2])
    BOOK, MONDAI, KAITOU = book_of(k, no)
    M, K = toc_starts(MONDAI), toc_starts(KAITOU)
    ms, title = M[no]
    me = M[no + 1][0] - 1 if no + 1 in M else fitz.open(MONDAI).page_count
    ks = K[no][0]
    ke = K[no + 1][0] if no + 1 in K else fitz.open(KAITOU).page_count   # 境目のページも含める
    mp = list(range(ms, me + 1))
    kp = list(range(ks, ke + 1))
    print('第%d講座 No.%d %s … 問題 p%d-%d（%dページ）／解答 p%d-%d' % (k, no, title, ms, me, len(mp), ks, ke))
    if len(mp) != 6:
        print('  ⚠ 問題が6ページでない。_TARGET.md の担当わけを手で直すこと')

    work = work_dir(BASE, k, no)
    if glob.glob(os.path.join(work, 'g1', '*.json')) and '--force' not in sys.argv:
        sys.exit('✗ すでにG1の出力がある。作り直すなら --force')
    for sub in ('pages', 'g1', 'svg', 'patch', 'out'):
        os.makedirs(os.path.join(work, sub), exist_ok=True)
    pg_dir = os.path.join(work, 'pages')
    dump(MONDAI, 'mondai', mp, pg_dir)
    kf = dump(KAITOU, 'kaitou', kp, pg_dir)
    contact(kf, os.path.join(pg_dir, 'kaitou_index.png'))

    groups = [('A', mp[0:2]), ('B', mp[2:4]), ('C', mp[4:])]
    rel = os.path.relpath(work, BASE).replace('\\', '/')
    pre = trial_prefix(k, no)
    rows = '\n'.join('| %s | %s | `%s<大問番号>` |' % (L, '・'.join('mondai_p%03d' % p for p in ps), pre)
                     for L, ps in groups)
    kai = '・'.join('kaitou_p%03d' % p for p in kp)
    tgt = u"""# 小5 最レ算数 %s 第%d講座 No.%d %s の原簿化

- 問題 `%s` p%d-%d／解答 `%s` p%d-%d（最後のページは次の回の先頭＝境目の確認用）
- 1回＝問題6ページ・大問は**チェックの四角に白抜き数字**（1〜16前後。**本数は実物で数える**）

## 担当わけ（G1）
| 担当 | 問題ページ | 仮ID |
|---|---|---|
%s

- 解答ページ（全担当共通）：%s
- 解答の一覧画像：`pages/kaitou_index.png`（赤い札がPDFページ番号）

## 進め方（親）
1. G1を3担当 → `python scripts/g1_validate.py --trial-dir %s`
2. G23（1担当・`docs/_genbo/_G23_DISPATCH_sairei5.md`）→ `g1_join.py` → `g1_preview.py --src out/daimon.json`
3. `python scripts/sairei5_ship.py %d %d` → `hama.py gate` → commit・push → 公開版を数えて確認
""" % (BOOK, k, no, title, os.path.basename(MONDAI), ms, me, os.path.basename(KAITOU), ks, ke,
       rows, kai, rel, k, no)
    io.open(os.path.join(work, '_TARGET.md'), 'w', encoding='utf-8').write(tgt)

    t = io.open(os.path.join(BASE, 'docs/_genbo/_G1_SHIJI_sairei5.md'), encoding='utf-8').read()
    for a, b in (('{BOOK}', BOOK), ('{K}', str(k)), ('{NO}', str(no)), ('{TITLE}', title),
                 ('{WORK}', rel), ('{PREFIX}', pre), ('{KAITOU}', kai),
                 ('{GROUPS}', rows)):
        t = t.replace(a, b)
    io.open(os.path.join(work, '_G1_SHIJI.md'), 'w', encoding='utf-8').write(t)
    print('できた:', rel)


if __name__ == '__main__':
    main()
