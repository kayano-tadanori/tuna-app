# -*- coding: utf-8 -*-
r"""小5 テーマ教材 第3分冊の「回ごとの下ごしらえ」を1本にまとめる。

  python scripts/theme3_prep.py <回番号>

やること（どれも外部送信なし）：
  1. 作業フォルダ `docs/_genbo/theme3_no<回>/` を作る
  2. 練習問題ページ・解説ページ・解答ページの**埋めこみ画像を原寸のまま**取り出す
  3. 保存ずみOCRから**担当ぶんだけ**切り出す（無いページは「OCRなし」と書かれる）
  4. `_G1_SHIJI.md`（前の回のものを回番号だけ差しかえ）と `_TARGET.md`（担当わけ表）を書く

★担当わけは「1担当2テーマ」。テーマが奇数なら最後の担当が1テーマになる。
★ページ割りはPDFのしおり（`get_toc()`）から取る。**手で数えない。**
★OCRの取得（外部送信）はここではやらない → `scripts/ocr_pages.py plan/fetch`
"""
import glob, io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import fitz

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from theme_books import book_of, work_dir, trial_prefix   # noqa: E402

LETTERS = 'ABCDEFGH'


def toc_of(doc):
    """{回: {'title':…, 'themes':[(題名,ページ)…], 'renshu':[(見出し,ページ)…]}}"""
    out, cur = {}, None
    for lv, t, pg in doc.get_toc():
        if lv == 1:
            m = re.match(r'No\.(\d+)\s*(.*)', t)
            if m:
                cur = int(m.group(1))
                out[cur] = {'title': m.group(2).strip(), 'themes': [], 'renshu': []}
        elif cur:
            if t.startswith('テーマ'):
                out[cur]['themes'].append((t, pg))
            elif '練習問題' in t:
                out[cur]['renshu'].append((t, pg))
    return out


def renshu_map(entry):
    u'''しおりの練習問題を **題号ごと** にまとめる … {1: [p], 2: [p, 続きのp], …}

    🚨 解答冊子は「練習問題2(続き)」のように**1つの練習問題が2ページ**になることがある
      （第1分冊でふつうに出る）。並び順でそのまま zip すると、そこから後ろが
      1ページずつずれる（2026-09-18・No.1で実際に担当3人に誤ったページを渡した）。
      **しおりの題号で対応づける。**
    '''
    out = {}
    for label, pg in entry['renshu']:
        m = re.search(r'練習問題\s*(\d+)', label)
        if not m:
            continue
        out.setdefault(int(m.group(1)), []).append(pg)
    return out


def dump_pages(pdf, tag, pages, outdir):
    d = fitz.open(pdf)
    got = []
    for pg in sorted(set(pages)):
        imgs = d[pg - 1].get_images(full=True)
        if len(imgs) != 1:
            print('  !! p%d は埋めこみ画像が%d枚（手動で確認）' % (pg, len(imgs)))
            continue
        info = d.extract_image(imgs[0][0])
        fn = os.path.join(outdir, '%s_p%02d.%s' % (tag, pg, info['ext']))
        io.open(fn, 'wb').write(info['image'])
        got.append(pg)
    print('  %s … %d ページ' % (tag, len(got)))
    return got


def main():
    no = int(sys.argv[1])
    # ★どの分冊の本かは回番号で決まる（theme_books.py）。ここに本の名前を書かない
    BU, BOOK, MONDAI, KAITOU = book_of(no)
    m, k = fitz.open(MONDAI), fitz.open(KAITOU)
    M, K = toc_of(m), toc_of(k)
    if no not in M:
        sys.exit('No.%d がしおりに無い' % no)
    title = M[no]['title']
    themes = M[no]['themes']                      # [(題名, 解説ページ)…]
    mmap = renshu_map(M[no])                      # {題号: [問題ページ…]}
    kmap = renshu_map(K[no]) if no in K else {}    # {題号: [解答ページ…（続き含む）]}
    renshu = [mmap.get(i + 1, [0])[0] for i in range(len(themes))]
    kai_all = [kmap.get(i + 1, []) for i in range(len(themes))]      # 題号ごとの全ページ
    kai = [(v[0] if v else 0) for v in kai_all]
    print('No.%d %s … テーマ%d／練習%s／解答%s'
          % (no, title, len(themes), renshu, [v or '—' for v in kai_all]))
    for i, v in enumerate(kai_all):
        if len(v) > 1:
            print('  📄 テーマ%d の解答は %d ページ（%s）＝しおりの「(続き)」。両方わたす'
                  % (i + 1, len(v), '・'.join('p%d' % x for x in v)))
    if len(mmap) != len(themes) or (kmap and len(kmap) != len(themes)):
        print('  ⚠ テーマ数と練習/解答の題号の数が合わない。_TARGET.md を手で直すこと'
              '（例 No.27＝1テーマに練習が2ページ）')

    work = work_dir(BASE, no)
    # 🚨**すでにG1が書いてある回を作り直さない。**`_TARGET.md` と `_G1_SHIJI.md` を上書きしてしまい、
    #   その回に実際に渡した指示が失われる（docs/_genbo はgitの外なので戻せない）。
    #   2026-09-18、完成ずみのNo.22で試して実際に上書きした。やり直すときだけ `--force`。
    done = glob.glob(os.path.join(work, 'g1', '*.json'))
    if done and '--force' not in sys.argv:
        sys.exit('✗ %s には、すでにG1の出力が %d 本ある。上書きすると、その回に渡した指示が消える。%s'
                 '  本当に作り直すなら --force を付ける（指示書のバックアップを取ってから）'
                 % (os.path.relpath(work, BASE).replace(chr(92), '/'), len(done), chr(10)))
    for sub in ('pages', 'g1', 'svg', 'patch', 'out', 'ocr'):
        os.makedirs(os.path.join(work, sub), exist_ok=True)
    pg_dir = os.path.join(work, 'pages')
    kaisetsu = [pg for _, pg in themes]
    dump_pages(MONDAI, 'mondai', renshu + kaisetsu, pg_dir)
    dump_pages(KAITOU, 'kaitou', [x for v in kai_all for x in v], pg_dir)

    # 担当わけ：既定は1担当2テーマ。
    # ★`--groups 2,3|4,5|6` のように**テーマ番号**で明示できる。
    #   すでに取ってあるテーマを飛ばすときは必ず明示する。
    #   （2026-09-13、No.26でテーマ1だけ再利用して担当を1つずらしたのに
    #     切り出しは既定のままで、担当Bに別のテーマのOCRが渡った）
    n = len(themes)
    gopt = next((a.split('=', 1)[1] for a in sys.argv[2:] if a.startswith('--groups=')), None)
    if gopt is None and '--groups' in sys.argv:
        gopt = sys.argv[sys.argv.index('--groups') + 1]
    if gopt:
        groups = [[int(x) - 1 for x in g.split(',') if x.strip()] for g in gopt.split('|')]
        for g in groups:
            for ti in g:
                if not (0 <= ti < n):
                    sys.exit('テーマ%d は No.%d に無い（テーマは%d個）' % (ti + 1, no, n))
    else:
        groups = [list(range(i, min(i + 2, n))) for i in range(0, n, 2)]

    # OCRの切り出し（保存ずみぶんだけ。無いページは「OCRなし」と書かれる）
    import ocr_pages
    for gi, g in enumerate(groups):
        L = LETTERS[gi]
        mp, kp = [], []
        for ti in g:
            mp += [kaisetsu[ti], renshu[ti]] if ti < len(renshu) else [kaisetsu[ti]]
            kp += kai_all[ti] if ti < len(kai_all) else []
        ocr_pages.cmd_slice(MONDAI, sorted(mp), os.path.join(work, 'ocr', '%s_mondai.md' % L))
        ocr_pages.cmd_slice(KAITOU, sorted(kp), os.path.join(work, 'ocr', '%s_kaitou.md' % L))

    # 担当わけ表
    rows = []
    for gi, g in enumerate(groups):
        L = LETTERS[gi]
        for ti in g:
            # ★題名はしおりから取れる（themes）。「解説ページから取る」と書くと、
            #   担当が要らないページを開きにいく（2026-09-13〜14の実測）
            pages = kai_all[ti] if ti < len(kai_all) else []
            rows.append('| %s | **%s** | `%s%d-*` | p%d | %s | p%d |'
                        % (L, themes[ti][0], trial_prefix(no), ti + 1,
                           renshu[ti] if ti < len(renshu) else 0,
                           '・'.join('p%d' % x for x in pages) or '—', kaisetsu[ti]))
    tgt = """# 小5 算数 テーマ教材 %s **No.%d %s** の原簿化

- 問題 `%s`／解答 `%s`
- **テーマ%d**（しおりで実測）。1テーマ＝解説1p＋練習問題1p、解答は練習問題1つにつき1p。
  🚨**練習問題のページには大問が2本のことが多い**（`1-1` `1-2`）。
  ⚠**本数は2本とはかぎらない。小問が無くて大問1本＝答え1つのこともある。印刷ラベルどおりに数える。**
  ⚠**「練習問題N」の見出しは分冊でちがう**（第3分冊＝印刷されていない／**第1分冊＝実際に印刷されている**。
  2026-09-18に実測）。**印刷されているものだけ写す。**
  🚨**解答冊子は1つの練習問題が2ページになることがある**（しおりの「練習問題N(続き)」）。
  上の表の解答ページは**しおりの題号で対応づけてある**ので、`p13・p14` と2つ書いてあれば両方見る。
  **それでも中身が自分の設問と合っているかは必ず確かめ、使ったPDFページを `page.kaitou` に書く。**
- ✅**テーマの題名はしおりから取ってある**（上の表）。**解説ページを開く必要はない。**
  ⚠題名は回の単元名と別物のことがある（No.23＝速さ(2)なのに「比の利用」）。

## 担当わけ（G1・1担当2テーマ）

| 担当 | テーマ | 仮ID | 問題PDF | 解答PDF | 解説p |
|---|---|---|---|---|---|
%s

- 画像：`pages/mondai_p*.jpeg` `pages/kaitou_p*.jpeg`（PDFの埋めこみ画像を原寸のまま）
- OCR：`ocr/<担当>_mondai.md` `ocr/<担当>_kaitou.md`
  🚨**解答ページのOCRは分数と `÷` が壊れる**＝**答えと解法は画像から読む**
- **本番HG番号は採番しない**（仮IDのまま。親が後で振る。振る前に原簿の実データを数え直す）

## 進め方（親）
1. G1を%d担当 → `g1_validate.py`
2. G23（1担当）→ `g1_join.py` → `g1_preview.py --src out/daimon.json`
3. HG採番・原簿追記・`data/hama_daimon.json` の `master_bunsatsu/fukushu/%d`・
   `hama_map.json` に回を追加・お知らせ・push・**公開版を数えて確認**
""" % (BOOK, no, title, os.path.basename(MONDAI), os.path.basename(KAITOU), n,
       '\n'.join(rows), len(groups), no)
    io.open(os.path.join(work, '_TARGET.md'), 'w', encoding='utf-8').write(tgt)

    # G1指示（前の回のものを流用して回番号だけ差しかえ）
    # ★前の回の指示を流用する。分冊の1回目（No.1・11・21）には前の回が無いので、
    #   同じ作りの最後に作ったもの（第3分冊のNo.30）を型として使う
    prev_no = no - 1
    prev = os.path.join(BASE, 'docs/_genbo/theme%d_no%d/_G1_SHIJI.md' % (BU, prev_no))
    if not os.path.exists(prev):
        prev_no = 30
        prev = os.path.join(BASE, 'docs/_genbo/theme3_no30/_G1_SHIJI.md')
    if os.path.exists(prev):
        t = io.open(prev, encoding='utf-8').read()
        # ★置換は「回番号＋題名」→「回番号＋題名」の順でやる。
        #   正規表現で No.24 のうしろをまとめて飲みこませると、
        #   「No.24は1本も無い＝…」のような文ごと消える（2026-09-13に実際にやった）。
        prev_title = (M.get(prev_no) or {}).get('title', '')
        if prev_title:
            t = t.replace('No.%d %s' % (prev_no, prev_title), 'No.%d %s' % (no, title))
        t = t.replace('No.%d' % prev_no, 'No.%d' % no)
        t = t.replace('theme%d_no%d' % (book_of(prev_no)[0], prev_no),
                      'theme%d_no%d' % (BU, no))
        t = t.replace('"no": %d,' % prev_no, '"no": %d,' % no)
        t = t.replace(trial_prefix(prev_no), trial_prefix(no))
        if BOOK != '第3分冊':
            t = t.replace('第3分冊', BOOK)
        # 🚨**前の回の「この回で気をつけること」を持ちこさない。**
        #   No.29で速さの回の注意が残ったまま担当に渡った（2026-09-14）。
        #   題名だけ入れた空欄にして、親が必ず書きかえる形にする
        mark = '# 🚨 この回で気をつけること'
        if mark in t:
            stub = [
                '%s（No.%d %s）' % (mark, no, title), '',
                '- ✅**テーマの題名はしおりから取ってあります**（解説ページは開かなくてよい）：',
                '  ' + '／'.join(x[0] for x in themes),
                '- ⚠**本数は2本とはかぎらない。**練習問題ページの印刷ラベル'
                '（`1-1` `1-2` …）どおりに数える。', '',
                '🚨🚨**ここから下は親が書きかえること（前の回の注意をそのまま渡さない）。**',
                '  この回に出てくるもの（単位・比・図・円周率など）を見て、気をつけることを書く。', '']
            t = t[:t.index(mark)] + '\n'.join(stub)
        # ★OCRが1ページも無い回で「OCRの下書きがあります」と書かない
        #   （担当が探しにいく。2026-09-18・No.2で3担当とも空ファイルを開いた）
        got = False
        for f in sorted(glob.glob(os.path.join(work, 'ocr', '*.md'))):
            body = io.open(f, encoding='utf-8').read()
            # ページごとの節（`## mondai PDF p26`）の中身を見る。
            # 冒頭の決まり文句は毎回入るので、行数では数えない
            for sec in body.split(chr(10) + '## ')[1:]:
                text = sec.split(chr(10), 1)[1] if chr(10) in sec else ''
                if text.strip() and 'OCRなし' not in text:
                    got = True
        if not got:
            t = t.replace('## 📝 OCRの下書きがあります', chr(10).join([
                '## 📝 この回のOCRはありません（画像から読む）',
                '**`ocr/` のファイルは中身が空です（全ページ「OCRなし」）。開かなくてよい。**',
                '以下は、OCRがある回のための説明です。', '',
                '### （参考）OCRがあるときの決めごと']), 1)
        io.open(os.path.join(work, '_G1_SHIJI.md'), 'w', encoding='utf-8').write(t)
        print('  _G1_SHIJI.md … No.%d から作った（回の題名と「この回で気をつけること」を目で確かめること）'
              % prev_no)
    print('できた:', os.path.relpath(work, BASE).replace('\\', '/'))
    print('担当:', ', '.join('%s＝テーマ%s' % (LETTERS[i], '・'.join(str(t + 1) for t in g))
                             for i, g in enumerate(groups)))


if __name__ == '__main__':
    main()
