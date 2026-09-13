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
import io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import fitz

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = r'C:\Users\User\Desktop\浜問題\_結合\小5'
MONDAI = os.path.join(PDF_DIR, '小5_算数_テーマ教材_第3分冊_No.21-30_問題.pdf')
KAITOU = os.path.join(PDF_DIR, '小5_算数_テーマ教材_第3分冊_No.21-30_解答.pdf')
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
    m, k = fitz.open(MONDAI), fitz.open(KAITOU)
    M, K = toc_of(m), toc_of(k)
    if no not in M:
        sys.exit('No.%d がしおりに無い' % no)
    title = M[no]['title']
    themes = M[no]['themes']                      # [(題名, 解説ページ)…]
    renshu = [pg for _, pg in M[no]['renshu']]    # 練習問題ページ
    kai = [pg for _, pg in K[no]['renshu']]       # 解答ページ
    print('No.%d %s … テーマ%d／練習%s／解答%s' % (no, title, len(themes), renshu, kai))
    if len(renshu) != len(themes) or len(kai) != len(themes):
        print('  ⚠ テーマ数と練習/解答ページ数が合わない。_TARGET.md を手で直すこと'
              '（例 No.27＝1テーマに練習が2ページ）')

    work = os.path.join(BASE, 'docs/_genbo/theme3_no%d' % no)
    for sub in ('pages', 'g1', 'svg', 'patch', 'out', 'ocr'):
        os.makedirs(os.path.join(work, sub), exist_ok=True)
    pg_dir = os.path.join(work, 'pages')
    kaisetsu = [pg for _, pg in themes]
    dump_pages(MONDAI, 'mondai', renshu + kaisetsu, pg_dir)
    dump_pages(KAITOU, 'kaitou', kai, pg_dir)

    # 担当わけ：1担当2テーマ
    n = len(themes)
    groups = [list(range(i, min(i + 2, n))) for i in range(0, n, 2)]

    # OCRの切り出し（保存ずみぶんだけ。無いページは「OCRなし」と書かれる）
    import ocr_pages
    for gi, g in enumerate(groups):
        L = LETTERS[gi]
        mp, kp = [], []
        for ti in g:
            mp += [kaisetsu[ti], renshu[ti]] if ti < len(renshu) else [kaisetsu[ti]]
            if ti < len(kai):
                kp.append(kai[ti])
        ocr_pages.cmd_slice(MONDAI, sorted(mp), os.path.join(work, 'ocr', '%s_mondai.md' % L))
        ocr_pages.cmd_slice(KAITOU, sorted(kp), os.path.join(work, 'ocr', '%s_kaitou.md' % L))

    # 担当わけ表
    rows = []
    for gi, g in enumerate(groups):
        L = LETTERS[gi]
        for ti in g:
            rows.append('| %s | テーマ%d（題名は解説ページから取る） | `TRIAL-T3-%d-%d-*` | p%d | p%d | p%d |'
                        % (L, ti + 1, no, ti + 1,
                           renshu[ti] if ti < len(renshu) else 0,
                           kai[ti] if ti < len(kai) else 0, kaisetsu[ti]))
    tgt = """# 小5 算数 テーマ教材 第3分冊 **No.%d %s** の原簿化

- 問題 `%s`／解答 `%s`
- **テーマ%d**（しおりで実測）。1テーマ＝解説1p＋練習問題1p、解答は練習問題1つにつき1p。
  🚨**練習問題のページには大問が2本**（`1-1` `1-2`）。「練習問題N」の見出しは原本に無い。
  ⚠**本数は2本とはかぎらない。小問が無くて大問1本＝答え1つのこともある。**
- ⚠**テーマの題名は回の単元名と別物のことがある**（No.23＝速さ(2)なのに「平均の速さ／比の利用」）。
  練習問題ページに題名は印刷されていない＝**解説ページの見出し枠を1回だけ開いて取る。**

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
""" % (no, title, os.path.basename(MONDAI), os.path.basename(KAITOU), n,
       '\n'.join(rows), len(groups), no)
    io.open(os.path.join(work, '_TARGET.md'), 'w', encoding='utf-8').write(tgt)

    # G1指示（前の回のものを流用して回番号だけ差しかえ）
    prev = os.path.join(BASE, 'docs/_genbo/theme3_no%d/_G1_SHIJI.md' % (no - 1))
    if os.path.exists(prev):
        t = io.open(prev, encoding='utf-8').read()
        # ★置換は「回番号＋題名」→「回番号＋題名」の順でやる。
        #   正規表現で No.24 のうしろをまとめて飲みこませると、
        #   「No.24は1本も無い＝…」のような文ごと消える（2026-09-13に実際にやった）。
        prev_title = M.get(no - 1, {}).get('title', '')
        if prev_title:
            t = t.replace('No.%d %s' % (no - 1, prev_title), 'No.%d %s' % (no, title))
        t = t.replace('No.%d' % (no - 1), 'No.%d' % no)
        t = t.replace('theme3_no%d' % (no - 1), 'theme3_no%d' % no)
        t = t.replace('"no": %d,' % (no - 1), '"no": %d,' % no)
        t = t.replace('TRIAL-T3-%d-' % (no - 1), 'TRIAL-T3-%d-' % no)
        io.open(os.path.join(work, '_G1_SHIJI.md'), 'w', encoding='utf-8').write(t)
        print('  _G1_SHIJI.md … No.%d から作った（回の題名は目で確かめること）' % (no - 1))
    print('できた:', os.path.relpath(work, BASE).replace('\\', '/'))
    print('担当:', ', '.join('%s＝テーマ%s' % (LETTERS[i], '・'.join(str(t + 1) for t in g))
                             for i, g in enumerate(groups)))


if __name__ == '__main__':
    main()
