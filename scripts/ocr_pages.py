# -*- coding: utf-8 -*-
r"""G1に渡すOCR下書きを「必要なページだけ」用意する。（原簿化の標準工程）

  python scripts/ocr_pages.py plan  <PDF> <ページ…>              … 何が足りないかを数える（外部送信なし）
  python scripts/ocr_pages.py fetch <PDF> <ページ…> [--dpi 450]  … 足りないページだけ Cloud Vision にかける
  python scripts/ocr_pages.py slice <PDF> <ページ…> --out <file> … 保存ずみから担当ぶんを切り出す（外部送信なし）

ページの指定は `12 16 18` でも `11-22` でも混ぜてよい（**PDFの物理ページ番号**）。

★なぜこの1本か
  - **保存ずみなら二度と取らない。**本ごとに1ファイルへ貯める（`docs/_genbo/_ocr/<PDF名>.json`）。
    すでにある `g5enshu3/_ocr_mondai.json` などは ALIASES で拾うので、取り直しにならない。
  - **G1に渡すのは担当ぶんだけ。**全冊を渡すと、読まなくていいページまで文脈に載る。
  - **OCRの文字は本文に出さない。**親の文脈を汚さないよう、出すのはページ番号と文字数だけ。
  - **取得にかかった時間は G1 の処理時間と分けて記録する**（`docs/_genbo/_ocr/_TIME.md`）。

★OCRの位置づけ（G1への指示にも同じことを書く）
  OCRは**転記の下書きとページ探し**に使う道具であって、原本ではない。
  設問・数値・選択肢・印刷された解法は**必ず原本画像と照合**する。図のSVG化と独立した検算も従来どおり。
  OCRが欠けている／誤読が多い箇所は、**直して使おうとせず画像から直接読む**。

★費用：Cloud Vision の DOCUMENT_TEXT_DETECTION は**月1,000ページまで無料**（毎月1日リセット）。
  超過分は1,000ページあたり $1.50。残りは `python scripts/ocr_ledger.py`。
  APIキーは `C:\Users\User\.claude\vision_api_key.txt`（環境変数 VISION_API_KEY が優先）。
"""
import io, json, os, re, sys, time, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import ocr_ledger

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE_DIR = os.path.join(BASE, 'docs/_genbo/_ocr')
TIME_LOG = os.path.join(STORE_DIR, '_TIME.md')

# すでに別の場所に貯めてあるOCRは、そこを見にいく（取り直さないため）
ALIASES = {
    '小5_算数_演習教材_第3分冊_No.21-30_問題': 'docs/_genbo/g5enshu3/_ocr_mondai.json',
    '小5_算数_演習教材_第3分冊_No.21-30_解答': 'docs/_genbo/g5enshu3/_ocr_kaitou.json',
}


def stem_of(pdf):
    return os.path.splitext(os.path.basename(pdf))[0]


def store_of(pdf):
    """この本のOCRの貯め先。既存の置き場があればそちらを使う。"""
    s = stem_of(pdf)
    if s in ALIASES:
        return os.path.join(BASE, ALIASES[s])
    return os.path.join(STORE_DIR, s + '.json')


def load_store(pdf):
    p = store_of(pdf)
    if os.path.exists(p):
        return json.load(io.open(p, encoding='utf-8'))
    return {}


def save_store(pdf, d):
    p = store_of(pdf)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False))
    return p


def parse_pages(args):
    """`12 16 18` も `11-22` も受ける。重複は潰して昇順にする。"""
    out = set()
    for a in args:
        m = re.fullmatch(r'(\d+)-(\d+)', a)
        if m:
            x, y = int(m.group(1)), int(m.group(2))
            out.update(range(min(x, y), max(x, y) + 1))
        elif a.isdigit():
            out.add(int(a))
        else:
            sys.exit('ページの指定が読めない: %s（例: 12 16 18 または 11-22）' % a)
    return sorted(out)


def split_args(argv):
    """ページ番号と、--付きのオプションを分ける。"""
    pages, opts = [], {}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith('--'):
            k = a[2:]
            v = argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else '1'
            opts[k] = v
            i += 2 if v != '1' or (i + 1 < len(argv) and not argv[i + 1].startswith('--')) else 1
        else:
            pages.append(a)
            i += 1
    return pages, opts


def missing_of(pdf, pages):
    d = load_store(pdf)
    return [p for p in pages if str(p) not in d or not d[str(p)].strip()]


def free_left():
    """今月あと何ページ無料で取れるか。"""
    led = ocr_ledger.load()
    month = datetime.date.today().strftime('%Y-%m')
    used = sum(len(v) for v in led.get(month, {}).values())
    return used, ocr_ledger.FREE_PER_MONTH - used


def cmd_plan(pdf, pages):
    d = load_store(pdf)
    miss = missing_of(pdf, pages)
    used, left = free_left()
    print('本: %s' % stem_of(pdf))
    print('貯め先: %s（保存ずみ %d ページ）' % (os.path.relpath(store_of(pdf), BASE).replace('\\', '/'), len(d)))
    print('ほしいページ: %d（%s）' % (len(pages), ' '.join(str(p) for p in pages)))
    print('保存ずみ: %d ページ' % (len(pages) - len(miss)))
    if miss:
        print('★取得が要る: %d ページ（%s）' % (len(miss), ' '.join(str(p) for p in miss)))
        print('   → 外部（Google Cloud Vision）へ画像を送ります。**実行前に本人へ報告する。**')
        print('   今月の使用 %d / 無料枠 %d（このあと %d ページ残る見こみ）'
              % (used, ocr_ledger.FREE_PER_MONTH, left - len(miss)))
        if left - len(miss) < 0:
            print('   ⚠無料枠を超えます（超過 1,000ページあたり $1.50）。')
        print('   取るなら: python scripts/ocr_pages.py fetch "%s" %s'
              % (pdf, ' '.join(str(p) for p in miss)))
    else:
        print('✅ 取得は要らない（全ページ保存ずみ）。そのまま slice できる。')
    return 0 if not miss else 2


def cmd_fetch(pdf, pages, dpi=450, measure=None):
    import fitz
    import ocr_vision
    miss = missing_of(pdf, pages)
    if not miss:
        print('取得するものは無い（全ページ保存ずみ）。')
        return 0
    used, left = free_left()
    if left - len(miss) < 0:
        print('⚠無料枠を超える取得です（今月 %d 使用／枠 %d）。超過分は 1,000ページあたり $1.50。'
              % (used, ocr_ledger.FREE_PER_MONTH))
    key = ocr_vision.get_key()
    d = load_store(pdf)
    doc = fitz.open(pdf)
    t0 = time.time()
    err = 0
    got = []
    for p in miss:
        png = doc[p - 1].get_pixmap(dpi=dpi).tobytes('png')
        t = ocr_vision.ocr_png(png, key)
        if t.startswith('★APIエラー'):
            err += 1
            print('p%d %s' % (p, t[:80]))
            if err >= 3:
                print('エラーが続くので中断'); break
            continue
        d[str(p)] = t
        got.append(p)
        save_store(pdf, d)          # 1ページごとに保存（途中で落ちても残る）
        # ★背景で走らせると出力がたまって進み具合が見えないので、1行ずつ流す
        print('  p%d … %d文字' % (p, len(t)), flush=True)
    sec = time.time() - t0
    if got:
        ocr_ledger.record(stem_of(pdf), got)
        line = ('| %s | %s | %s | %d | %d | %.1f |'
                % (datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), stem_of(pdf),
                   ' '.join(str(p) for p in got), len(got), dpi, sec))
        os.makedirs(STORE_DIR, exist_ok=True)
        if not os.path.exists(TIME_LOG):
            io.open(TIME_LOG, 'w', encoding='utf-8').write(
                '# OCR取得の時間（G1の処理時間とは別に数える）\n\n'
                '| 日時 | 本 | ページ | 枚数 | dpi | 秒 |\n|---|---|---|---|---|---|\n')
        io.open(TIME_LOG, 'a', encoding='utf-8').write(line + '\n')
        if measure:
            io.open(measure, 'a', encoding='utf-8').write(
                '\n- OCR取得: %d ページ／%.1f 秒（G1の処理時間には含めない）\n' % (len(got), sec))
    print('== 取得 %d ページ / %.1f 秒 ==' % (len(got), sec))
    print('貯め先:', os.path.relpath(store_of(pdf), BASE).replace('\\', '/'))
    print('時間の記録:', os.path.relpath(TIME_LOG, BASE).replace('\\', '/'))
    _, left2 = free_left()
    print('今月の残り枠: %d ページ' % left2)
    return 0


def cmd_slice(pdf, pages, out, tag=None):
    """保存ずみOCRから担当ぶんだけをページ番号つきで書き出す。中身は本文に出さない。"""
    d = load_store(pdf)
    tag = tag or ('kaitou' if '解答' in stem_of(pdf) else 'mondai')
    miss = [p for p in pages if str(p) not in d]
    lines = ['# OCRの下書き（%s）' % stem_of(pdf), '',
             '**これは下書きです。原本ではありません。**',
             'Cloud Vision の自動読み取りなので、記号の落ち・行の欠け・誤読がふつうに混ざります。',
             '',
             '- 使ってよい: どのページに何があるか探す／転記のたたき台にする',
             '- 必ず原本画像と照合する: 設問の原文・数値・選択肢・印刷された解法・答え',
             '- **OCRが欠けている／誤読が多いところは、直そうとせず画像から直接読む**（OCRの修復に時間を使わない）',
             '']
    for p in pages:
        t = d.get(str(p))
        if t is None:
            lines.append('## %s PDF p%d\n\n（OCRなし＝画像から読む）\n' % (tag, p))
        else:
            lines.append('## %s PDF p%d\n\n```\n%s\n```\n' % (tag, p, t))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    io.open(out, 'w', encoding='utf-8').write('\n'.join(lines))
    print('書き出し:', out)
    for p in pages:
        t = d.get(str(p))
        print('  %s p%d … %s' % (tag, p, ('%d文字' % len(t)) if t else 'OCRなし'))
    if miss:
        print('★OCRが無いページ: %s → そこは画像から読む（または plan/fetch で取る）'
              % ' '.join(str(p) for p in miss))
    return 0


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, pdf = sys.argv[1], sys.argv[2]
    rest, opts = split_args(sys.argv[3:])
    pages = parse_pages(rest)
    if not os.path.exists(pdf) and cmd in ('plan', 'fetch'):
        sys.exit('PDFが無い: %s' % pdf)
    if not pages:
        sys.exit('ページを指定してください（例: 12 16 18 / 11-22）')
    if cmd == 'plan':
        sys.exit(cmd_plan(pdf, pages))
    if cmd == 'fetch':
        sys.exit(cmd_fetch(pdf, pages, int(opts.get('dpi', 450)), opts.get('measure')))
    if cmd == 'slice':
        if 'out' not in opts:
            sys.exit('--out <書き出すファイル> が要ります')
        sys.exit(cmd_slice(pdf, pages, opts['out'], opts.get('tag')))
    sys.exit(__doc__)


if __name__ == '__main__':
    main()
