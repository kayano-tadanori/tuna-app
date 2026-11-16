# -*- coding: utf-8 -*-
r"""原簿のレコードの欄を差しかえる（G1 のやり直しで原本と照合した結果を入れる）。2026-11-17

  python scripts/genbo_patch_fields.py <patch.json> [--dry]

patch.json は配列：
  [{"hg": "HG-1426",
    "set": {"答え": "…", "解法": "1行目\n2行目", "検算": "…"},   # 欄ごと差しかえ（無ければ足す）
    "biko": "2026-11-17 …"}]                                     # 備考に1行足す

・欄＝「- 欄名:」の行と、それに続く字下げ行（半角スペース2つ／全角スペースで始まる行）。
・「- 図: …／答え: …」のように 答え が図の行に同居しているときは、答えを差しかえると同居ぶんを図の行から外す。
・図SVG 欄には触らない（SVG は G1 が描いたものだけ）。
・原簿は全行 CRLF。読むと \n、書くとき CRLF に戻す。書く前に一時フォルダへバックアップ。
"""
import datetime, io, json, os, re, shutil, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from genbo_path import find_genbo          # noqa: E402
import genbo_common as gc                  # noqa: E402

ORDER_AFTER = {'設問': ['設定・設問', '設定/設問', '設定', '骨'], '答え': ['図SVG', '図'], '解法': ['答え', '図SVG', '図'],
               '検算': ['解法', '答え'], '備考': ['出典', '検算', '解法']}


def blocks(body):
    """[(name, [lines])]  name は欄名（かっこ書きつきのまま）。先頭（見出し）は name=None"""
    out = []; cur = None
    for line in body.split('\n'):
        m = re.match(r'^- ([^:：]{1,20}?)[:：]', line)
        if m:
            cur = [m.group(1).strip(), [line]]; out.append(cur)
        elif cur is not None and (line.startswith('  ') or line.startswith('　')):
            cur[1].append(line)
        else:
            cur = None
            out.append([None, [line]])
    return out


def norm(name):
    return re.sub(r'[（(].*?[）)]', '', name or '').strip()


def make(name, value):
    ls = value.split('\n')
    if len(ls) == 1:
        return ['- %s: %s' % (name, ls[0])]
    return ['- %s:' % name] + ['  ' + l for l in ls]


def patch_body(body, sets, biko):
    bl = blocks(body)
    for name, value in sets.items():
        if name == '答え':
            for b in bl:   # 図の行に同居している答えを外す
                if norm(b[0]) == '図' and re.search(r'／\s*答え?\s*[:：]', b[1][0]):
                    b[1][0] = re.split(r'／\s*答え?\s*[:：]', b[1][0])[0].rstrip()
        hit = [b for b in bl if b[0] is not None and norm(b[0]) == name and not b[0].startswith('図SVG')]
        if name == '設問':
            hit += [b for b in bl if b[0] in ('設定・設問', '設定/設問')]
        if hit:
            hit[0][0] = name; hit[0][1] = make(name, value)
            for b in hit[1:]:
                bl.remove(b)
        else:
            pos = None
            for after in ORDER_AFTER.get(name, []):
                idx = [i for i, b in enumerate(bl) if b[0] is not None and norm(b[0]) == after]
                if idx:
                    pos = idx[-1] + 1; break
            if pos is None:
                pos = len([b for b in bl if b[0] is not None or b[1] != ['']])
            bl.insert(pos, [name, make(name, value)])
    if biko:
        idx = [i for i, b in enumerate(bl) if norm(b[0]) == '備考']
        if idx:
            bl[idx[0]][1].append('  ' + biko)
        else:
            last = max(i for i, b in enumerate(bl) if b[0] is not None)
            bl.insert(last + 1, ['備考', ['- 備考: ' + biko]])
    return '\n'.join(l for b in bl for l in b[1])


def main():
    patches = json.load(io.open(sys.argv[1], encoding='utf-8')); dry = '--dry' in sys.argv
    gp = find_genbo()
    text = io.open(gp, encoding='utf-8').read()
    recs = {h: (s, e) for h, s, e in gc.split_records(text)}
    # 後ろのレコードから直す（位置がずれないように）
    for p in sorted(patches, key=lambda p: -recs[p['hg']][0]):
        s, e = recs[p['hg']]
        old = text[s:e]
        new = patch_body(old, p.get('set', {}), p.get('biko'))
        if not new.endswith('\n'):
            new += '\n'
        if dry:
            print('=' * 30, p['hg']); print(new)
        text = text[:s] + new + text[e:]
    if dry:
        return
    bk = os.path.join(tempfile.gettempdir(), 'genbo_bak_patch_%s.md' % datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
    shutil.copy2(gp, bk); print('バックアップ:', bk)
    io.open(gp, 'w', encoding='utf-8', newline='\r\n').write(text)
    print('直した:', len(patches), '本')


if __name__ == '__main__':
    main()
