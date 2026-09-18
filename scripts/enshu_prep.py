# -*- coding: utf-8 -*-
r"""小5 演習教材（算数2ndの宿題）の「回ごとの下ごしらえ」。テーマ教材の theme3_prep.py の演習教材版。

  python scripts/enshu_prep.py <回番号>            # 作業フォルダ・画像・担当表・G1指示を作る
  python scripts/enshu_prep.py <回番号> --check    # G1が出そろったあと、ラベルの抜け・重なりを数える

やること（外部送信なし・OCRは使わない＝解答冊子は分数が壊れて使えないため）：
  1. 作業フォルダ `docs/_genbo/enshu<分冊>_no<回>/` を作る
  2. 問題ページ・解答ページの**埋めこみ画像を原寸のまま**取り出す
  3. 担当わけ（`_TARGET.md`）と G1指示（`_G1_SHIJI.md`＝ひな型 `docs/_genbo/_G1_SHIJI_enshu.md` から）を書く

★1回＝Basic問題＋Challenge問題の2ブロック（しおりの第2階層）。ページ割りは**しおりから取る。手で数えない。**
★担当わけ：1担当＝問題ページ2枚まで・解答ページ4枚前後（画像6枚前後＝600秒ウォッチドッグ対策）。
  解答ページは問題ページの割合で配り、**境目は1枚ずつ重ねる**（答えが隣のページにずれるのは毎回起きる）。
★大問の持ち主は「**番号が自分の問題ページで始まる大問**」。途中で次のページに続くなら、その1枚は開いてよい。
"""
import glob, io, json, math, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import fitz

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from enshu_books import book_of, work_dir, trial_prefix, material   # noqa: E402

LETTERS = 'ABCDEFGHIJ'
TEMPLATE = os.path.join(BASE, 'docs/_genbo/_G1_SHIJI_enshu.md')


def toc_of(doc):
    u"""{回: {'title':…, 'start':p, 'blocks':[('Basic問題',p),('Challenge問題',p)]}}（p は1始まり）"""
    out, cur = {}, None
    for lv, t, pg in doc.get_toc():
        if lv == 1:
            m = re.match(r'No\.(\d+)\s*(.*)', t)
            if m:
                cur = int(m.group(1))
                out[cur] = {'title': m.group(2).strip(), 'start': pg, 'blocks': []}
        elif cur and lv == 2:
            out[cur]['blocks'].append((t.strip(), pg))
    return out


def block_pages(toc, no, n_pages):
    u"""{'Basic問題': [p…], 'Challenge問題': [p…]}。終わりは次のブロック／次の回の始まりの手前。"""
    starts = []
    for k in sorted(toc):
        for name, pg in toc[k]['blocks']:
            starts.append((k, name, pg))
    out = {}
    for i, (k, name, pg) in enumerate(starts):
        if k != no:
            continue
        end = starts[i + 1][2] - 1 if i + 1 < len(starts) else n_pages
        out[name] = list(range(pg, end + 1))
    return out


def split(P, K):
    u"""問題ページ P と解答ページ K を担当に配る → [(問題ページ, 解答ページ)…]"""
    n = max(math.ceil(len(P) / 2.0), math.ceil(len(K) / 3.0), 1)
    n = min(n, len(P))                     # 問題ページより多くは割れない
    groups = []
    per = len(P) / float(n)
    r = len(K) / float(len(P))
    for g in range(n):
        a, b = int(round(g * per)), int(round((g + 1) * per))   # P[a:b]
        ka = max(0, int(math.floor(a * r)) - (1 if g else 0))
        kb = min(len(K), int(math.ceil(b * r)))      # 重ねは後ろの担当の頭に1枚だけ
        groups.append((P[a:b], K[ka:kb]))
    return groups


def dump_pages(pdf, tag, pages, outdir):
    d = fitz.open(pdf)
    got = []
    for pg in sorted(set(pages)):
        imgs = d[pg - 1].get_images(full=True)
        if len(imgs) != 1:
            print('  !! %s p%d は埋めこみ画像が%d枚（手動で確認）' % (tag, pg, len(imgs)))
            continue
        info = d.extract_image(imgs[0][0])
        fn = os.path.join(outdir, '%s_p%03d.%s' % (tag, pg, info['ext']))
        io.open(fn, 'wb').write(info['image'])
        got.append(pg)
    print('  %s … %d ページ' % (tag, len(got)))
    return got


def check(no):
    u"""G1が出そろったか。B1..Bn・C1..Cm が抜けも重なりも無く並んでいるか数える。"""
    work = work_dir(BASE, no)
    seen = {}
    for f in sorted(glob.glob(os.path.join(work, 'g1', '*.json'))):
        doc = json.load(io.open(f, encoding='utf-8'))
        for it in doc['items']:
            lab = it.get('label') or ''
            seen.setdefault(lab, []).append(os.path.basename(f))
            ks = (it.get('kotae') or {}).get('state')
            if ks != 'ok':
                print('  ⚠ %s の答えが %s（%s）' % (lab, ks, os.path.basename(f)))
    ok = True
    for L in 'BC':
        ns = sorted(int(x[1:]) for x in seen if re.match(r'^%s\d+$' % L, x))
        if not ns:
            print('  ✗ %s が1本も無い' % L); ok = False; continue
        miss = [n for n in range(1, ns[-1] + 1) if n not in ns]
        print('  %s1〜%s%d … %d本%s' % (L, L, ns[-1], len(ns), ('  ✗抜け ' + ' '.join('%s%d' % (L, n) for n in miss)) if miss else ''))
        ok = ok and not miss
    other = [x for x in seen if not re.match(r'^[BC]\d+$', x)]
    if other:
        print('  ✗ B/C の形でないラベル: %s' % other); ok = False
    dup = {k: v for k, v in seen.items() if len(v) > 1}
    for k, v in sorted(dup.items()):
        print('  ✗ %s が %d 回（%s）＝重なり。境目の大問を2担当が取った' % (k, len(v), '・'.join(v)))
        ok = False
    print('✅ そろっている' if ok else '✗ 直してから G23 へ')
    return ok


def main():
    no = int(sys.argv[1])
    if '--check' in sys.argv:
        sys.exit(0 if check(no) else 1)
    BU, BOOK, MONDAI, KAITOU = book_of(no)
    m, k = fitz.open(MONDAI), fitz.open(KAITOU)
    M, K = toc_of(m), toc_of(k)
    if no not in M or no not in K:
        sys.exit('No.%d がしおりに無い' % no)
    title = M[no]['title']
    mb, kb = block_pages(M, no, m.page_count), block_pages(K, no, k.page_count)
    print('No.%d %s … 問題 %s／解答 %s' % (no, title,
          {b: '%d-%d' % (v[0], v[-1]) for b, v in mb.items()},
          {b: '%d-%d' % (v[0], v[-1]) for b, v in kb.items()}))

    work = work_dir(BASE, no)
    done = glob.glob(os.path.join(work, 'g1', '*.json'))
    if done and '--force' not in sys.argv:
        sys.exit('✗ %s には、すでにG1の出力が %d 本ある。上書きすると、その回に渡した指示が消える。'
                 '本当に作り直すなら --force' % (os.path.relpath(work, BASE), len(done)))
    for sub in ('pages', 'g1', 'svg', 'patch', 'out'):
        os.makedirs(os.path.join(work, sub), exist_ok=True)
    pg_dir = os.path.join(work, 'pages')
    dump_pages(MONDAI, 'mondai', [p for v in mb.values() for p in v], pg_dir)
    dump_pages(KAITOU, 'kaitou', [p for v in kb.values() for p in v], pg_dir)

    rows, gi = [], 0
    for blk in ('Basic問題', 'Challenge問題'):
        if blk not in mb or blk not in kb:
            sys.exit('No.%d に %s のしおりが無い（問題か解答のどちらか）' % (no, blk))
        for P, Kp in split(mb[blk], kb[blk]):
            L = LETTERS[gi]; gi += 1
            rows.append((L, blk, P, Kp))
    tbl = '\n'.join('| %s | %s | %s | %s | `g1/no%d_%s.json` |'
                    % (L, blk, '・'.join('p%d' % x for x in P), '・'.join('p%d' % x for x in Kp), no, L)
                    for L, blk, P, Kp in rows)
    full = '\n'.join('| %s | 問題 p%d〜p%d | 解答 p%d〜p%d |' % (b, mb[b][0], mb[b][-1], kb[b][0], kb[b][-1])
                     for b in ('Basic問題', 'Challenge問題'))
    tgt = u"""# %s **No.%d %s** の原簿化（G1担当わけ）

- 問題 `%s`／解答 `%s`
- ブロック（しおりで実測）：
| ブロック | 問題 | 解答 |
|---|---|---|
%s

## 担当わけ（G1）

| 担当 | ブロック | 問題PDF | 解答PDF | 出力 |
|---|---|---|---|---|
%s

- 画像：`pages/mondai_p###.jpeg` `pages/kaitou_p###.jpeg`（PDFの埋めこみ画像を原寸のまま。番号はPDFページ）
- 🚨**大問の持ち主＝「番号（黒地白ヌキ）が自分の問題ページで始まる大問」**。
  自分の最後のページで始まって次のページに続く大問は**自分のもの**（続きの1枚は開いてよい）。
  自分の最初のページの上端が前のページからの続きなら、それは**前の担当のもの**（取らない）。
- 解答ページは割合で配ってあり、**境目は1枚ずつ重ねてある**。自分の大問の答えが無ければ
  同じブロックの**隣の解答ページを開いてよい**（ログに書く）。
- **本番HG番号は採番しない**（仮ID `%s<ラベル>`。親が後で振る）

## 進め方（親）
1. G1を%d担当（同時4まで）→ `python scripts/enshu_prep.py %d --check` → `g1_validate.py`
2. G23（1担当）→ `g1_join.py` → `g1_preview.py --src out/daimon.json`
3. `python scripts/enshu_ship.py %d` → `hama.py gate` → commit → push → **公開版を数えて確認**
""" % (material(no), no, title, os.path.basename(MONDAI), os.path.basename(KAITOU), full, tbl,
       trial_prefix(no), len(rows), no, no)
    io.open(os.path.join(work, '_TARGET.md'), 'w', encoding='utf-8').write(tgt)

    t = io.open(TEMPLATE, encoding='utf-8').read()
    rel = os.path.relpath(work, BASE).replace('\\', '/')
    for a, b in (('{NO}', str(no)), ('{TITLE}', title), ('{WORK}', rel), ('{BOOK}', BOOK),
                 ('{MATERIAL}', material(no)), ('{PREFIX}', trial_prefix(no)),
                 ('{MONDAI}', os.path.basename(MONDAI)), ('{KAITOU}', os.path.basename(KAITOU))):
        t = t.replace(a, b)
    io.open(os.path.join(work, '_G1_SHIJI.md'), 'w', encoding='utf-8').write(t)
    print('できた:', rel)
    for L, blk, P, Kp in rows:
        print('  %s＝%s 問題%s 解答%s（画像%d枚）' % (L, blk, P, Kp, len(P) + len(Kp)))


if __name__ == '__main__':
    main()
