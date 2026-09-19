# -*- coding: utf-8 -*-
r"""小5 演習教材（算数2ndの宿題）の1回ぶんを、原簿とアプリに入れる。theme3_ship.py の演習教材版。

  python scripts/enshu_ship.py <回番号> [--dry]

やること：
  1. 原簿の**実データを数えて**次のHG番号を決める（採番表は信じない）
  2. `out/daimon.json` の仮IDをHG番号・アプリid（`hd5m2nd_e<回>_<n>`）に振りかえて
     `data/hama_daimon.json` の `grades/5/master2nd_bunsatsu/fukushu/<回>` に入れる
     （画面は じゅくナビ 算数2nd の「🧩 今週の宿題（大問）」。2nd演習とは別の引き出し）
  3. `data/hama_map.json` の 小5 master2nd に回が無ければ足す（2nd演習と同じ週＝ふつうは既にある）
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


from enshu_books import book_of, work_dir, trial_prefix   # noqa: E402


def label_key(lab):
    """'B3' → (0,3)／'C1' → (1,1)。印刷順（Basic→Challenge）にそろえるため。"""
    m = re.match(r'([BC])(\d+)$', lab or '')
    return ('BC'.index(m.group(1)), int(m.group(2))) if m else (99, 99)


def next_hg(genbo_text):
    """原簿の**レコード見出し**の最大＋1。表でなく実データを数える。"""
    ns = [int(x) for x in re.findall(r'^### 【HG-(\d{4})】', genbo_text, re.M)]
    return max(ns) + 1


def main():
    no = int(sys.argv[1])
    dry = '--dry' in sys.argv
    # ★どの分冊の本かは回番号で決まる（enshu_books.py）。ここに本の名前を書かない
    BU, BOOK, MONDAI, _KAITOU = book_of(no)
    work = work_dir(BASE, no)
    daimon = json.load(io.open(os.path.join(work, 'out/daimon.json'), encoding='utf-8'))
    records = io.open(os.path.join(work, 'out/genbo_records.md'), encoding='utf-8').read()

    # 仮IDと印刷ラベルの対応（daimon の src の末尾に印刷ラベルが入っている）
    def lab_of(it):
        m = re.search(r'No\.\d+\s+([BC]\d+)\s*$', it.get('src', ''))
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
    # ★小問が0本の大問（回答箇所を全部 exclusions にしたもの＝作図・記号の複数えらび など）は
    #   **アプリに入れない**。入れると画面に中身の無い大問が出る。**原簿には入れる**（下の③）。
    #   2026-09-13、No.27で12本中6本が0本だった。
    items = []
    skipped = []
    for i, (it, hg) in enumerate(zip(daimon, hgs), 1):
        if not it.get('steps'):
            skipped.append('%s（%s）' % (hg, it['title']))
            continue
        x = dict(it)
        x['id'] = 'hd5m2nd_e%d_%d' % (no, i)
        x['hg'] = hg
        x['src'] = '%s 原簿・小5 演習教材 %s No.%d %s' % (hg, BOOK, no, lab_of(it))
        items.append(x)
    p = os.path.join(BASE, 'data/hama_daimon.json')
    d = json.load(io.open(p, encoding='utf-8'))
    mb = d['grades']['5']['master2nd_bunsatsu']['fukushu']
    if not items:
        sys.exit('✗ アプリに入れられる大問が0本（回を作るとボタンだけ出て中身が無い）。原簿だけ入れるなら別の手順で')
    if str(no) in mb:
        sys.exit('✗ すでに No.%d が入っている（入れ直すならバックアップから戻す）' % no)
    shutil.copy(p, '%s.bak-t%d-%s' % (p, no, TS))
    mb[str(no)] = items
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
    print('アプリ: master2nd_bunsatsu/fukushu/%d に %d本入れた' % (no, len(items)))
    if skipped:
        print('  アプリに入れなかった（小問0本＝原簿だけ）: %d本 … %s' % (len(skipped), '／'.join(skipped)))

    # ---- ② 回（lessons） ----
    import fitz
    toc = fitz.open(MONDAI).get_toc()
    title = next((re.sub(r'^No\.\d+\s*', '', t) for lv, t, _ in toc
                  if lv == 1 and t.startswith('No.%d ' % no)), '')
    units, seen = [], set()
    for x in items:                      # 出てきた順に、重複なく
        u = x.get('unit')
        if u and u not in seen:
            seen.add(u); units.append(u)
    p2 = os.path.join(BASE, 'data/hama_map.json')
    d2 = json.load(io.open(p2, encoding='utf-8'))
    ls = d2['grades']['5']['courses']['master2nd']['lessons']
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
    # 本文に残る仮IDの参照（「同じ骨＝TRIAL-E2-11-B3」など）は、**そのラベルのHG番号**に振りかえる
    trial2hg = {it['hg']: hg for it, hg in zip(daimon, hgs)}
    out = []
    for it, hg in zip(daimon, hgs):
        b = blocks[it['hg']]
        b = b.replace('【%s】' % it['hg'], '【%s】' % hg, 1)
        b = re.sub(re.escape(trial_prefix(no)) + r'[BC]\d+',
                   lambda mm: trial2hg.get(mm.group(0), mm.group(0)), b)
        out.append('### ' + b.rstrip() + '\n')
    left = sorted(set(re.findall(re.escape(trial_prefix(no)) + r'[BC]\d+', '\n'.join(out))))
    if left:
        sys.exit('✗ 原簿の本文に振りかえられない仮IDが残る: %s' % left)
    nfig = sum(1 for x in items if x.get('svg') or any(s.get('svg') for s in x['steps']))
    head = ("\n---\n\n# 📘 小5 演習教材 %s No.%d %s ★%s 原簿化（%s〜%s）\n\n"
            "**原簿%d本／アプリ%d本・小問%d問。**問題ページに図があったのは%d本。\n"
            "- 小5 算数2nd の**宿題**（家でやる紙）。同じ週の「2nd演習プリント」は授業の演習（→ project_g5enshu_bunsatsu_genbo）。\n"
            "- 1回＝Basic問題＋Challenge問題。**B/Cのラベルは解答冊子の表記**（問題ページは黒地白ヌキの数字だけ）。\n"
            "- 作り方：G1→G23→親（→ method_g1_g23_genbo）。OCRは使っていない。\n\n"
            % (BOOK, no, title, datetime.date.today().isoformat(), hgs[0], hgs[-1],
               len(daimon), len(items), sum(len(x['steps']) for x in items), nfig))
    shutil.copy(gpath, '%s.bak-t%d-%s' % (gpath, no, TS))
    g = g.rstrip('\n') + '\n' + head + '\n'.join(out)
    # 採番表：この本の行（無ければ第3分冊の行の下に作る）に回を足し、「次は…から」をこの行へ移す。
    # ★「次は」は表に1つだけ置く（テーマ教材の行に残すと古い値が2つ並ぶ）
    lines = g.split('\n')
    key = u'| **小5 算数 演習教材 %s' % BOOK
    ri = next((i for i, l in enumerate(lines) if l.startswith(key)), None)
    if ri is None:
        anchor = next((i for i, l in enumerate(lines) if l.startswith(u'| **小5 算数 演習教材 第3分冊')), None)
        if anchor is None:
            sys.exit('✗ 採番表に演習教材 第3分冊の行が見つからない（表の形が変わった？）')
        lines.insert(anchor + 1, u'%s（G1→G23方式）★%s 開始** | 1回の本数は回ごとにちがう＝**原簿の実データを数えて振る**（enshu_ship.py）。'
                     % (key, datetime.date.today().isoformat()))
        ri = anchor + 1
    for i, l in enumerate(lines):
        lines[i] = re.sub(r'\*\*次は HG-\d+ から\*\*', '', l)
    lines[ri] = lines[ri].rstrip() + u'**No.%d＝%s〜%s（完了）**。**次は HG-%d から**' % (
        no, hgs[0], hgs[-1], start + len(daimon))
    g = '\n'.join(lines)
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
        "title": "📘 小5 算数2ndに 演習教材 No.%d「%s」が入りました（大問%d本）" % (no, title, len(items)),
        "body": ("算数2ndの宿題「演習教材」%sの **No.%d %s** を入れました。**大問%d本・小問%d問**です。\n\n"
                 "● 出る場所 … じゅくナビ → 算数2nd → **No.%d** → 「🧩 今週の宿題（大問）」\n"
                 "● 中身 … %s\n\n"
                 "紙の宿題を そのまま起こしたものです（類題ではありません）。"
                 % (BOOK, no, title, len(items), sum(len(x['steps']) for x in items), no,
                    "／".join(x['title'] for x in items[:6]) + ("　ほか" if len(items) > 6 else "")))
    })
    json.dump(u, io.open(up, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('お知らせ v%d ／ sw.js も v%d' % (ver, ver))
    # ★科目カード・使い方ガイドの総問題数（大問の小問を含む）を実データに合わせる（2026-09-19 本人指摘）
    import subprocess
    r = subprocess.run(['node', os.path.join(BASE, 'scripts', 'sync_question_counts.js')],
                       capture_output=True, text=True, encoding='utf-8')
    print('問題数の同期:', (r.stdout or r.stderr).strip().splitlines()[0] if (r.stdout or r.stderr) else r.returncode)
    print('→ このあと: python scripts/hama.py gate → commit → push → 公開版を数えて確認')


if __name__ == '__main__':
    main()
