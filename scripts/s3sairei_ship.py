# -*- coding: utf-8 -*-
r"""小3 最レ算数【刷新版】宿題テキスト（No.17〜）の1回ぶんを原簿とアプリに入れる（2026-11-10・sairei5_ship.py の小3版）。

  python scripts/s3sairei_ship.py <回> [--dry]

  - 入れる先は `data/hama_daimon.json` の `grades/3/sairei_new_bunsatsu/fukushu/<回>`（No.1〜16 と同じ）
  - id は `hd3s_n<回>_<i>`（No.1〜16 と同じ形）。unit は G23 が決めたまま
  - `hama_map.json` の 小3 sairei_new の回が無ければ `{"no","title"}` で足す
★原簿の次のHG番号は**実データを数えて**決める。どれもバックアップを取ってから書く。
★commit と push はしない（親が `hama.py gate` を通してから）。
"""
import datetime, io, json, os, re, shutil, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from genbo_path import find_genbo                                           # noqa: E402
from s3sairei_prep import PDF, starts, work_dir, prefix as trial_prefix   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = datetime.datetime.now().strftime('%Y%m%d%H%M%S')


def lab_of(it):
    m = re.search(r'No\.\d+\s+(\d+)\s*$', it.get('src', ''))
    return m.group(1) if m else ''


def main():
    no = int(sys.argv[1])
    dry = '--dry' in sys.argv
    title = starts(PDF % u'問題')[0][no][1]
    work = work_dir(no)
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
    print('小3最レ（刷新版）No.%d %s … 大問 %d本／小問 %d問' % (no, title, len(daimon),
                                                  sum(len(x['steps']) for x in daimon)))
    print('採番: %s 〜 %s（原簿の実データを数えて決めた）' % (hgs[0], hgs[-1]))
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
        x['id'] = 'hd3s_n%d_%d' % (no, i)
        x['hg'] = hg
        x['grade'] = 3
        x['src'] = '%s 原簿・小3最レ（刷新版）宿題 No.%d 大問%s' % (hg, no, lab_of(it))
        items.append(x)
    if not items:
        sys.exit('✗ アプリに入れられる大問が0本')
    p = os.path.join(BASE, 'data/hama_daimon.json')
    d = json.load(io.open(p, encoding='utf-8'))
    bucket = d['grades']['3']['sairei_new_bunsatsu']['fukushu']
    if str(no) in bucket:
        sys.exit('✗ すでに No.%d が入っている' % no)
    shutil.copy(p, '%s.bak-s3s-%d-%s' % (p, no, TS))
    bucket[str(no)] = items
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
    print('アプリ: 3/sairei_new_bunsatsu/fukushu/%d に %d本入れた' % (no, len(items)))
    if skipped:
        print('  アプリに入れなかった（小問0本＝原簿だけ）: %s' % '／'.join(skipped))

    # ---- ② 回（lessons）----
    p2 = os.path.join(BASE, 'data/hama_map.json')
    d2 = json.load(io.open(p2, encoding='utf-8'))
    ls = d2['grades']['3']['courses']['sairei_new']['lessons']
    if not any(x.get('no') == no for x in ls):
        shutil.copy(p2, '%s.bak-s3s-%d-%s' % (p2, no, TS))
        ls.append({"no": no, "title": title})
        ls.sort(key=lambda x: x.get('no') or 0)
        io.open(p2, 'w', encoding='utf-8').write(json.dumps(d2, ensure_ascii=False, indent=1))
        print('回: No.%d %s を足した' % (no, title))

    # ---- ③ 原簿 ----
    blocks = {}
    for b in records.split('### '):
        m = re.match(r'【(TRIAL-[^】]+)】', b)
        if m:
            blocks[m.group(1)] = b
    out = []
    pre = trial_prefix(no)
    for it, hg in zip(daimon, hgs):
        b = blocks[it['hg']]
        b = b.replace('【%s】' % it['hg'], '【%s】' % hg, 1)
        b = re.sub(re.escape(pre) + r'(\d+)(?!\d)', lambda m: hgs[labs.index(int(m.group(1)))]
                   if int(m.group(1)) in labs else m.group(0), b)
        out.append('### ' + b.rstrip() + '\n')
    nfig = sum(1 for x in items if x.get('svg') or any(s.get('svg') for s in x['steps']))
    head = ("\n---\n\n# 📗 小3最レ算数【刷新版】宿題テキスト 第3分冊 No.%d %s ★%s 原簿化（%s〜%s）\n\n"
            "**大問%d本（アプリ%d本・小問%d問）。**問題ページに図があったのは%d本。\n"
            "- 作り方：G1→G23→親（→ method_g1_g23_genbo）。OCRなし。\n\n"
            % (no, title, datetime.date.today().isoformat(), hgs[0], hgs[-1],
               len(daimon), len(items), sum(len(x['steps']) for x in items), nfig))
    shutil.copy(gpath, '%s.bak-s3s-%d-%s' % (gpath, no, TS))
    g = g.rstrip('\n') + '\n' + head + '\n'.join(out)
    old = re.search(r'\*\*次は HG-\d+ から\*\*', g)
    if old:
        g = g.replace(old.group(0), '**小3最レ宿題No.%d＝%s〜%s（完了）**。**次は HG-%d から**'
                      % (no, hgs[0], hgs[-1], start + len(daimon)), 1)
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
        "title": "📗 小3 最レに 宿題テキスト No.%d「%s」が入りました（大問%d本）" % (no, title, len(items)),
        "body": ("最レ算数の宿題テキスト **No.%d %s** を入れました。**大問%d本・小問%d問**です。\n\n"
                 "● 出る場所 … じゅくナビ → 算数（最レ）→ **No.%d** → 宿題（大問）\n\n"
                 "紙の問題を そのまま起こしたものです（類題ではありません）。"
                 % (no, title, len(items), sum(len(x['steps']) for x in items), no))
    })
    json.dump(u, io.open(up, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('お知らせ v%d ／ sw.js も v%d' % (ver, ver))
    r = subprocess.run(['node', os.path.join(BASE, 'scripts', 'sync_question_counts.js')],
                       capture_output=True, text=True, encoding='utf-8')
    print('問題数の同期:', ((r.stdout or r.stderr).strip().splitlines() or [r.returncode])[0])
    print('→ このあと: python scripts/hama.py gate → commit → push → 公開版を数えて確認')


if __name__ == '__main__':
    main()
