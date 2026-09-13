# -*- coding: utf-8 -*-
r"""小5 テーマ教材 第3分冊の1回ぶんを、原簿とアプリに入れる。

  python scripts/theme3_ship.py <回番号> [--dry]

やること：
  1. 原簿の**実データを数えて**次のHG番号を決める（採番表は信じない）
  2. `out/daimon.json` の仮IDをHG番号・アプリidに振りかえて
     `data/hama_daimon.json` の `grades/5/master_bunsatsu/fukushu/<回>` に入れる
  3. `data/hama_map.json` の 小5 master に回を足す（`units` は大問の unit から作る）
  4. `out/genbo_records.md` を原簿に追記し、採番表の「次は…から」を更新する
  5. お知らせ（`data/updates.json`）と `sw.js` の CACHE_NAME を1つ上げる
  ★どれもバックアップを取ってから書く。`--dry` なら数えて見せるだけ。

★commit と push はしない（親が `hama.py gate` を通してから自分でやる）。
"""
import datetime, io, json, os, re, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from genbo_path import find_genbo

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = datetime.datetime.now().strftime('%Y%m%d%H%M%S')


def label_key(lab):
    """'1-1' → (1,1)。印刷順にそろえるため。"""
    m = re.match(r'(\d+)-(\d+)', lab or '')
    return (int(m.group(1)), int(m.group(2))) if m else (99, 99)


def next_hg(genbo_text):
    """原簿の**レコード見出し**の最大＋1。表でなく実データを数える。"""
    ns = [int(x) for x in re.findall(r'^### 【HG-(\d{4})】', genbo_text, re.M)]
    return max(ns) + 1


def main():
    no = int(sys.argv[1])
    dry = '--dry' in sys.argv
    work = os.path.join(BASE, 'docs/_genbo/theme3_no%d' % no)
    daimon = json.load(io.open(os.path.join(work, 'out/daimon.json'), encoding='utf-8'))
    records = io.open(os.path.join(work, 'out/genbo_records.md'), encoding='utf-8').read()

    # 仮IDと印刷ラベルの対応（daimon の src の末尾に印刷ラベルが入っている）
    def lab_of(it):
        m = re.search(r'No\.\d+\s+(\d+-\d+)\s*$', it.get('src', ''))
        return m.group(1) if m else it.get('hg', '')
    daimon.sort(key=lambda it: label_key(lab_of(it)))

    gpath = find_genbo()
    g = io.open(gpath, encoding='utf-8').read()
    start = next_hg(g)
    hgs = ['HG-%d' % (start + i) for i in range(len(daimon))]
    print('No.%d … 大問 %d本／小問 %d問' % (no, len(daimon), sum(len(x['steps']) for x in daimon)))
    print('採番: %s 〜 %s（原簿の実データを数えて決めた）' % (hgs[0], hgs[-1]))
    for it, hg in zip(daimon, hgs):
        print('  %s ← %s  %s（%s）' % (hg, it['hg'], it['title'], lab_of(it)))
    if dry:
        return

    # ---- ① アプリ ----
    items = []
    for i, (it, hg) in enumerate(zip(daimon, hgs), 1):
        x = dict(it)
        x['id'] = 'hd5m_t%d_%d' % (no, i)
        x['hg'] = hg
        x['src'] = '%s 原簿・小5 テーマ教材 第3分冊 No.%d %s' % (hg, no, lab_of(it))
        items.append(x)
    p = os.path.join(BASE, 'data/hama_daimon.json')
    d = json.load(io.open(p, encoding='utf-8'))
    mb = d['grades']['5']['master_bunsatsu']['fukushu']
    if str(no) in mb:
        sys.exit('✗ すでに No.%d が入っている（入れ直すならバックアップから戻す）' % no)
    shutil.copy(p, '%s.bak-t%d-%s' % (p, no, TS))
    mb[str(no)] = items
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
    print('アプリ: master_bunsatsu/fukushu/%d に入れた' % no)

    # ---- ② 回（lessons） ----
    import fitz
    toc = fitz.open(r'C:\Users\User\Desktop\浜問題\_結合\小5\小5_算数_テーマ教材_第3分冊_No.21-30_問題.pdf').get_toc()
    title = next((re.sub(r'^No\.\d+\s*', '', t) for lv, t, _ in toc
                  if lv == 1 and t.startswith('No.%d ' % no)), '')
    units, seen = [], set()
    for x in items:                      # 出てきた順に、重複なく
        u = x.get('unit')
        if u and u not in seen:
            seen.add(u); units.append(u)
    p2 = os.path.join(BASE, 'data/hama_map.json')
    d2 = json.load(io.open(p2, encoding='utf-8'))
    ls = d2['grades']['5']['courses']['master']['lessons']
    if not any(x.get('no') == no for x in ls):
        shutil.copy(p2, '%s.bak-t%d-%s' % (p2, no, TS))
        ls.append({"no": no, "title": title, "units": units})
        ls.sort(key=lambda x: x.get('no') or 0)
        io.open(p2, 'w', encoding='utf-8').write(json.dumps(d2, ensure_ascii=False, indent=1))
        print('回: No.%d %s ／ units=%s' % (no, title, units))

    # ---- ③ 原簿 ----
    blocks = {}
    for b in records.split('### '):
        m = re.match(r'【(TRIAL-[^】]+)】', b)
        if m:
            blocks[m.group(1)] = b
    out = []
    for it, hg in zip(daimon, hgs):
        b = blocks[it['hg']]
        b = b.replace('【%s】' % it['hg'], '【%s】' % hg, 1)
        b = re.sub(r'TRIAL-T3-%d-(\d+)-(\d+)' % no, hg, b)     # 本文に残る仮IDの参照
        out.append('### ' + b.rstrip() + '\n')
    nfig = sum(1 for x in items if x.get('svg') or any(s.get('svg') for s in x['steps']))
    head = ("\n---\n\n# 📗 小5 算数 テーマ教材 第3分冊 No.%d %s ★%s 原簿化（%s〜%s）\n\n"
            "**大問%d本／小問%d問。**問題ページに図があったのは%d本。\n"
            "- 1テーマ＝解説1ページ＋練習問題1ページ／練習問題のページに**大問が2本**（`1-1` `1-2`）。\n"
            "  「練習問題N」という見出しは原本に無い。\n"
            "- ⚠**テーマの題名は回の単元名と別物**（この教材の作り）。題名は解説ページの見出しから取っている。\n"
            "- 作り方：G1→G23→親（→ method_g1_g23_genbo）。OCRの下書きを前工程に使った。\n\n"
            % (no, title, datetime.date.today().isoformat(), hgs[0], hgs[-1],
               len(items), sum(len(x['steps']) for x in items), nfig))
    shutil.copy(gpath, '%s.bak-t%d-%s' % (gpath, no, TS))
    g = g.rstrip('\n') + '\n' + head + '\n'.join(out)
    old = re.search(r'\*\*次は HG-\d+ から\*\*', g)
    if old:
        g = g.replace(old.group(0),
                      '**No.%d＝%s〜%s（完了）**。**次は HG-%d から**' % (no, hgs[0], hgs[-1], start + len(daimon)), 1)
    io.open(gpath, 'w', encoding='utf-8').write(g)
    print('原簿: %s〜%s を追記／採番表を更新' % (hgs[0], hgs[-1]))

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
        "title": "📗 小5 マスターに テーマ教材 No.%d「%s」が入りました（大問%d本）" % (no, title, len(items)),
        "body": ("テーマ教材 第3分冊の **No.%d %s** を入れました。**大問%d本・小問%d問**です。\n\n"
                 "● 出る場所 … じゅくナビ → 算数（マスター）→ **No.%d** → 「🧩 今週の宿題（大問）」\n"
                 "● 中身 … %s\n\n"
                 "紙の練習問題を そのまま起こしたものです（類題ではありません）。"
                 % (no, title, len(items), sum(len(x['steps']) for x in items), no,
                    "／".join(x['title'] for x in items[:6]) + ("　ほか" if len(items) > 6 else "")))
    })
    json.dump(u, io.open(up, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('お知らせ v%d ／ sw.js も v%d' % (ver, ver))
    print('→ このあと: python scripts/hama.py gate → commit → push → 公開版を数えて確認')


if __name__ == '__main__':
    main()
