# -*- coding: utf-8 -*-
r"""公開ずみのテーマ教材の回を、G23 をやり直した結果で**差しかえる**（2026-11-10）。

  python scripts/theme_reship.py <回番号> [--dry]

★使う場面：G23 の `patch/g3.json` を直して `g1_join.py` で `out/daimon.json` を作り直したあと。
  （2026-11-10、「比は外す」という古い決まりで外していた比・歩合54か所を小問に戻したときに作った）
★`theme3_ship.py` との違い：**HG番号もアプリの id も、いま公開されている番号をそのまま引き継ぐ**。
  - id は ship と同じ規則（印刷ラベル順の通し番号 → `hd5m_t<回>_<i>`）なので、同じ並びなら同じ id になる。
  - HG は、公開ずみの大問の (i, HG) から先頭の番号を逆算し、全部の大問で食いちがいが無いかを確かめる。
  - 小問0本だった大問が小問を持てば、**その番号の位置に**アプリへ入る。
★原簿の本文（設問・答え・解法）は変えない。「比のためアプリでは小問にしていない」の作問メモだけ訂正を書き足す。
★sw.js とお知らせは**ここでは上げない**（何回ぶんかまとめて差しかえたあと、1回だけ上げる）。
"""
import datetime, io, json, os, re, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from genbo_path import find_genbo                                  # noqa: E402
from theme_books import book_of, work_dir                          # noqa: E402
from theme3_ship import label_key                                  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = datetime.datetime.now().strftime('%Y%m%d%H%M%S')


def main():
    no = int(sys.argv[1])
    dry = '--dry' in sys.argv
    BU, BOOK, _M, _K = book_of(no)
    work = work_dir(BASE, no)
    daimon = json.load(io.open(os.path.join(work, 'out/daimon.json'), encoding='utf-8'))

    def lab_of(it):
        m = re.search(r'No\.\d+\s+(\d+-\d+)\s*$', it.get('src', ''))
        return m.group(1) if m else it.get('hg', '')
    daimon.sort(key=lambda it: label_key(lab_of(it)))

    p = os.path.join(BASE, 'data/hama_daimon.json')
    raw = io.open(p, encoding='utf-8').read()
    d = json.loads(raw)
    mb = d['grades']['5']['master_bunsatsu']['fukushu']
    old = mb.get(str(no))
    if not old:
        sys.exit('✗ No.%d はまだ公開されていない（初回は theme3_ship.py）' % no)

    # 公開ずみの (i, HG) から先頭の HG を逆算し、全部で食いちがいが無いか確かめる
    starts = set()
    for x in old:
        i = int(re.match(r'hd5m_t%d_(\d+)$' % no, x['id']).group(1))
        starts.add(int(x['hg'].split('-')[1]) - (i - 1))
    if len(starts) != 1:
        sys.exit('✗ 公開ずみの id と HG の並びが一定でない: %s' % sorted(starts))
    start = starts.pop()
    # 公開ずみの大問の印刷ラベルと、作り直した並びの印刷ラベルが同じ位置にあるか
    by_i = {int(x['id'].rsplit('_', 1)[1]): x for x in old}
    for i, it in enumerate(daimon, 1):
        if i in by_i and not by_i[i]['src'].endswith(' ' + lab_of(it)):
            sys.exit('✗ 位置%d の印刷ラベルが合わない（公開=%s／作り直し=%s）' % (i, by_i[i]['src'], lab_of(it)))

    items = []
    for i, it in enumerate(daimon, 1):
        if not it.get('steps'):
            continue
        hg = 'HG-%d' % (start + i - 1)
        x = dict(it)
        x['id'] = 'hd5m_t%d_%d' % (no, i)
        x['hg'] = hg
        x['src'] = '%s 原簿・小5 テーマ教材 %s No.%d %s' % (hg, BOOK, no, lab_of(it))
        items.append(x)
    n_old = sum(len(x['steps']) for x in old)
    n_new = sum(len(x['steps']) for x in items)
    print('No.%d … 大問 %d→%d本／小問 %d→%d問（HG-%d〜）' % (no, len(old), len(items), n_old, n_new, start))
    added = [x['hg'] for x in items if x['id'] not in {y['id'] for y in old}]
    if added:
        print('  新たにアプリに入る大問:', '・'.join(added))
    if n_new < n_old:
        sys.exit('✗ 小問が減る。差しかえない（やり直しで何かを落としている）')
    if dry:
        return

    shutil.copy(p, '%s.bak-reship-t%d-%s' % (p, no, TS))
    mb[str(no)] = items
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))

    # 回の units（新しく入った大問の単元を足す）
    p2 = os.path.join(BASE, 'data/hama_map.json')
    d2 = json.load(io.open(p2, encoding='utf-8'))
    for ls in d2['grades']['5']['courses']['master']['lessons']:
        if ls.get('no') == no:
            # ★足すのは**新しくアプリに入った大問**の単元だけ。もともと公開していた大問の単元が
            #   回の units に無いのは前からの作り（No.15 で、関係ない4単元を足しかけた）
            old_ids = {y['id'] for y in old}
            for x in items:
                if x['id'] in old_ids:
                    continue
                u = x.get('unit')
                # ★units の欄が無い回（No.12・13 など前の作り）には足さない。欄の有無で画面の出方が変わる
                if u and 'units' in ls and u not in ls['units']:
                    ls['units'].append(u)
                    print('  回の単元に足した:', u)
    io.open(p2, 'w', encoding='utf-8').write(json.dumps(d2, ensure_ascii=False, indent=1))

    # 原簿：この回の HG の「比（歩合）のためアプリでは小問にしていない」という作問メモに訂正を書き足す
    gpath = find_genbo()
    g = io.open(gpath, encoding='utf-8').read()
    hgs = {'HG-%d' % (start + i) for i in range(len(daimon))}
    fixed = 0
    out = []
    for b in g.split('\n### '):
        m = re.match(r'【(HG-\d+)】', b)
        if m and m.group(1) in hgs:
            def note(mm):
                return mm.group(0) + '（★2026-11-10 訂正：比・歩合もテンキーで打てるので、アプリにも小問として出している）'
            b2 = re.sub(r'[^\n]*(比|歩合)[^\n]*アプリ[^\n]*(小問にしていない|出さない|外[しす])[^\n（]*(?!（★2026-11-10)', note, b)
            if b2 != b:
                fixed += 1
            b = b2
        out.append(b)
    if fixed:
        shutil.copy(gpath, '%s.bak-reship-t%d-%s' % (gpath, no, TS))
        io.open(gpath, 'w', encoding='utf-8').write('\n### '.join(out))
    print('原簿: 作問メモに訂正を書き足したレコード %d本' % fixed)


if __name__ == '__main__':
    main()
