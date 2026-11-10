# -*- coding: utf-8 -*-
r"""小5 最レ算数 第4分冊（No.31〜42）の1回ぶんを、原簿とアプリに入れる（2026-11-10）。

  python scripts/sairei5_ship.py <講座1|2> <回> [--dry]

`theme3_ship.py` の最レ版。ちがうところ：
  - 入れる先は `data/hama_daimon.json` の `grades/5/sairei/kouza<講座>/<回>`（No.1〜30 と同じ）
  - id は `hd5s_<回>k<講座>_<i>`（i＝大問番号の順の通し番号）
  - `unit` は**回の単元名**で上書きする（最レは単元名で引く）
  - `hama_map.json` の 小5 sairei の回は `{"no", "title":"<第1講座>・<第2講座>"}`（No.21〜30 と同じ形）
★原簿の次のHG番号は**実データを数えて**決める。どれもバックアップを取ってから書く。
★commit と push はしない（親が `hama.py gate` を通してから）。
"""
import datetime, io, json, os, re, shutil, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from genbo_path import find_genbo                                           # noqa: E402
from sairei5_books import (book_of, work_dir, trial_prefix, toc_starts,     # noqa: E402
                           unit_name, lesson_part)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = datetime.datetime.now().strftime('%Y%m%d%H%M%S')


def lab_of(it):
    m = re.search(r'No\.\d+\s+(\d+)\s*$', it.get('src', ''))
    return m.group(1) if m else ''


def main():
    k, no = int(sys.argv[1]), int(sys.argv[2])
    dry = '--dry' in sys.argv
    BOOK, MONDAI, _K = book_of(k, no)
    title = toc_starts(MONDAI)[no][1]
    work = work_dir(BASE, k, no)
    daimon = json.load(io.open(os.path.join(work, 'out/daimon.json'), encoding='utf-8'))
    records = io.open(os.path.join(work, 'out/genbo_records.md'), encoding='utf-8').read()
    if any(not lab_of(it) for it in daimon):
        sys.exit('✗ 大問番号が取れない src がある: %s' % [it.get('src') for it in daimon if not lab_of(it)])
    daimon.sort(key=lambda it: int(lab_of(it)))
    labs = [int(lab_of(it)) for it in daimon]
    if labs != list(range(1, len(labs) + 1)):
        print('⚠ 大問番号が1から連続していない: %s（取りこぼしが無いか確かめる）' % labs)
        if '--allow-gap' not in sys.argv:
            sys.exit('✗ 止めた。わざとなら --allow-gap')

    # ★テンキーに乗らない答え（「6通り」のように単位が残ったまま・choices なし）を止める（2026-11-10 No.36で出かけた）
    NUM = re.compile(r'^(\d+(\.\d+)?|\d+/\d+|\d+と\d+/\d+|\d+(\.\d+)?([:：]\d+(\.\d+)?)+|(\d+割)?(\d+分)?(\d+厘)?)$')
    bad = ['%s %s' % (it['hg'], st['answer']) for it in daimon for st in it['steps']
           if not st.get('choices') and not NUM.match(st['answer']) and '余り' not in st['answer']]
    if bad:
        sys.exit('✗ テンキーに乗らない答え（take_unit 忘れ？）: %s' % '／'.join(bad))

    gpath = find_genbo()
    g = io.open(gpath, encoding='utf-8').read()
    start = max(int(x) for x in re.findall(r'^### 【HG-(\d{4})】', g, re.M)) + 1
    hgs = ['HG-%d' % (start + i) for i in range(len(daimon))]
    unit = unit_name(title)
    print('第%d講座 No.%d %s … 大問 %d本／小問 %d問' % (k, no, title, len(daimon),
                                                  sum(len(x['steps']) for x in daimon)))
    print('採番: %s 〜 %s（原簿の実データを数えて決めた）／unit=%s' % (hgs[0], hgs[-1], unit))
    for it, hg in zip(daimon, hgs):
        print('  %s ← %s  大問%s %s（小問%d）' % (hg, it['hg'], lab_of(it), it['title'], len(it['steps'])))
    if dry:
        return

    # ---- ① アプリ ----
    items, skipped = [], []
    for i, (it, hg) in enumerate(zip(daimon, hgs), 1):
        if not it.get('steps'):
            skipped.append('%s（大問%s）' % (hg, lab_of(it)))
            continue
        x = dict(it)
        x['id'] = 'hd5s_%dk%d_%d' % (no, k, i)
        x['hg'] = hg
        x['unit'] = unit
        x['src'] = '%s 原簿・小5最レ %s 第%d講座 No.%d 大問%s' % (hg, BOOK, k, no, lab_of(it))
        items.append(x)
    if not items:
        sys.exit('✗ アプリに入れられる大問が0本')
    p = os.path.join(BASE, 'data/hama_daimon.json')
    d = json.load(io.open(p, encoding='utf-8'))
    bucket = d['grades']['5']['sairei'].setdefault('kouza%d' % k, {})
    if str(no) in bucket:
        sys.exit('✗ すでに 第%d講座 No.%d が入っている' % (k, no))
    shutil.copy(p, '%s.bak-s5k%d-%d-%s' % (p, k, no, TS))
    bucket[str(no)] = items
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
    print('アプリ: sairei/kouza%d/%d に %d本入れた' % (k, no, len(items)))
    if skipped:
        print('  アプリに入れなかった（小問0本＝原簿だけ）: %s' % '／'.join(skipped))

    # ---- ② 回（lessons）: 2講座の題名を「・」でつなぐ ----
    p2 = os.path.join(BASE, 'data/hama_map.json')
    d2 = json.load(io.open(p2, encoding='utf-8'))
    ls = d2['grades']['5']['courses']['sairei']['lessons']
    if not any(x.get('no') == no for x in ls):
        t1 = lesson_part(toc_starts(book_of(1, no)[1])[no][1])
        t2 = lesson_part(toc_starts(book_of(2, no)[1])[no][1])
        shutil.copy(p2, '%s.bak-s5k%d-%d-%s' % (p2, k, no, TS))
        ls.append({"no": no, "title": '%s・%s' % (t1, t2)})
        ls.sort(key=lambda x: x.get('no') or 0)
        io.open(p2, 'w', encoding='utf-8').write(json.dumps(d2, ensure_ascii=False, indent=1))
        print('回: No.%d %s・%s を足した' % (no, t1, t2))

    # ---- ③ 原簿 ----
    blocks = {}
    for b in records.split('### '):
        m = re.match(r'【(TRIAL-[^】]+)】', b)
        if m:
            blocks[m.group(1)] = b
    out = []
    pre = trial_prefix(k, no)
    for it, hg in zip(daimon, hgs):
        b = blocks[it['hg']]
        b = b.replace('【%s】' % it['hg'], '【%s】' % hg, 1)
        b = re.sub(re.escape(pre) + r'(\d+)(?!\d)', lambda m: hgs[labs.index(int(m.group(1)))]
                   if int(m.group(1)) in labs else m.group(0), b)
        out.append('### ' + b.rstrip() + '\n')
    nfig = sum(1 for x in items if x.get('svg') or any(s.get('svg') for s in x['steps']))
    head = ("\n---\n\n# 📕 小5最レ算数 %s 第%d講座 No.%d %s ★%s 原簿化（%s〜%s）\n\n"
            "**大問%d本（アプリ%d本・小問%d問）。**問題ページに図があったのは%d本。\n"
            "- 作り方：G1→G23→親（→ method_g1_g23_genbo）。OCRなし。\n\n"
            % (BOOK, k, no, title, datetime.date.today().isoformat(), hgs[0], hgs[-1],
               len(daimon), len(items), sum(len(x['steps']) for x in items), nfig))
    shutil.copy(gpath, '%s.bak-s5k%d-%d-%s' % (gpath, k, no, TS))
    g = g.rstrip('\n') + '\n' + head + '\n'.join(out)
    old = re.search(r'\*\*次は HG-\d+ から\*\*', g)
    if old:
        g = g.replace(old.group(0), '**最レ第%d講座No.%d＝%s〜%s（完了）**。**次は HG-%d から**'
                      % (k, no, hgs[0], hgs[-1], start + len(daimon)), 1)
    io.open(gpath, 'w', encoding='utf-8').write(g)
    print('原簿: %s〜%s を追記' % (hgs[0], hgs[-1]))

    # ---- ④ お知らせと sw.js ----
    sw = os.path.join(BASE, 'sw.js')
    s = io.open(sw, encoding='utf-8').read()
    m = re.search(r"oton-gakuen-v(\d+)", s)
    ver = int(m.group(1)) + 1
    io.open(sw, 'w', encoding='utf-8').write(s.replace(m.group(0), 'oton-gakuen-v%d' % ver, 1))
    up = os.path.join(BASE, 'data/updates.json')
    u = json.load(io.open(up, encoding='utf-8'))
    u.insert(0, {
        "date": datetime.date.today().isoformat(),
        "ver": "v%d" % ver,
        "title": "📕 小5 最レに 第%d講座 No.%d「%s」の宿題が入りました（大問%d本）" % (k, no, title, len(items)),
        "body": ("最レ算数 第%d講座 **No.%d %s** の宿題テキストを入れました。**大問%d本・小問%d問**です。\n\n"
                 "● 出る場所 … じゅくナビ → 算数（最レ）→ **No.%d** → 「📚 第%d講座」\n\n"
                 "紙の問題を そのまま起こしたものです（類題ではありません）。"
                 % (k, no, title, len(items), sum(len(x['steps']) for x in items), no, k))
    })
    json.dump(u, io.open(up, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('お知らせ v%d ／ sw.js も v%d' % (ver, ver))
    r = subprocess.run(['node', os.path.join(BASE, 'scripts', 'sync_question_counts.js')],
                       capture_output=True, text=True, encoding='utf-8')
    print('問題数の同期:', ((r.stdout or r.stderr).strip().splitlines() or [r.returncode])[0])
    print('→ このあと: python scripts/hama.py gate → commit → push → 公開版を数えて確認')


if __name__ == '__main__':
    main()
