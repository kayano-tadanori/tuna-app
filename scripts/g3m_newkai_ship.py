# -*- coding: utf-8 -*-
r"""小3マスター算数 宿題テキストの「原簿に無かった回」（No.11・13・31）を、原簿とアプリに入れる（2026-11-17）。

  python scripts/g3m_newkai_ship.py <回> [--dry]

入力（リポジトリの外。G1＝原本から起こしたデータ／G23＝アプリ向けの判断）
  C:\Users\User\Desktop\Claude\freddy_data\manual\g3m_no<回>.json
  C:\Users\User\Desktop\Claude\freddy_data\manual_app\app_g3m_no<回>.json

やること
  1. 原簿に「### 【HG-xxxx】小3マスター算数第N分冊 No.回 ラベル（題）」のレコードを足す（次の回の直前に入れる）。
     HG番号は原簿の実データの最大値＋1 から振る（採番表を信じない）。
  2. data/hama_daimon.json の grades/3/master_bunsatsu/fukushu/<回> に大問を入れる（id＝hd3mb_<回>_<i>）。
  ★原簿は書く前に scratchpad にバックアップを取る。commit と push はしない（hama.py gate を通してから親が）。
  ★設問・答え・SVG は G1 のものをそのまま使う（ここで書き直さない）。
"""
import datetime, io, json, os, re, shutil, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from genbo_path import find_genbo   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FREDDY = r"C:\Users\User\Desktop\Claude\freddy_data"
BUNSATSU = {11: '第1分冊', 13: '第1分冊', 31: '第2分冊'}
NEXT_NO = {11: 12, 13: 14, 31: 32}
TS = datetime.datetime.now().strftime('%Y%m%d%H%M%S')


def max_hg(text):
    return max(int(x) for x in re.findall(r'HG-(\d{4,5})', text))


def one_line(s):
    return re.sub(r'\s*\n\s*', '　', (s or '').strip())


def genbo_record(hg, no, g1, app):
    bun = BUNSATSU[no]
    head = '### 【%s】小3マスター算数%s No.%d %s（%s）' % (hg, bun, no, g1['label'], g1['title'])
    L = [head]
    if g1.get('hint_hone'):
        L.append('- 骨: ' + one_line(g1['hint_hone']))
    if g1.get('hint_core'):
        L.append('- コア発見: ' + one_line(g1['hint_core']))
    L.append('- 設問:')
    for line in g1['mondai'].split('\n'):
        L.append('  ' + line.rstrip())
    zu = one_line(g1.get('zu') or 'なし')
    if not re.match(r'^(あり|なし)', zu):
        zu = ('なし（' + zu + '）') if 'なし' in zu[:6] else ('あり（' + zu + '）')
    L.append('- 図: ' + zu)
    for s in g1.get('svgs') or []:
        lab = s.get('label')
        L.append('- 図SVG%s: `%s`' % (('（%s）' % lab) if lab else '', s['svg'].replace('\n', ' ')))
    L.append('- 答え: ' + one_line(g1['kotae']))
    if g1.get('kaisetsu'):
        L.append('- 解法:')
        for line in g1['kaisetsu'].split('\n'):
            L.append('  ' + line.rstrip())
    else:
        L.append('- 解法: （解答冊子に考え方・式の印刷なし）')
    L.append('- 検算: ' + one_line(g1.get('kenzan')))
    L.append('- 出典: ' + one_line(g1.get('shutten')))
    notes = list(g1.get('notes') or [])
    ex = [e for e in (app or {}).get('exclusions') or []]
    if ex:
        notes.append('アプリでは外した小問：' + '／'.join('%s（%s）' % (e.get('sub'), e.get('reason')) for e in ex))
    if not app or not app.get('steps'):
        notes.append('アプリには出さない（全小問が答えに作図などを含むため）')
    if notes:
        L.append('- 備考: ' + one_line('／'.join(notes)))
    return '\n'.join(L) + '\n'


def main():
    no = int(sys.argv[1]); dry = '--dry' in sys.argv
    g1s = json.load(open(os.path.join(FREDDY, 'manual', 'g3m_no%d.json' % no), encoding='utf-8'))
    apps = json.load(open(os.path.join(FREDDY, 'manual_app', 'app_g3m_no%d.json' % no), encoding='utf-8'))
    app_by = {a['label']: a for a in apps}
    bad = [g['status'] for g in g1s if any(('判読' in s or '未確定' in s) for s in g.get('status') or [])]
    if bad:
        sys.exit('判読できない／未確定の大問がある。止める: %s' % bad)

    gp = find_genbo()
    text = io.open(gp, encoding='utf-8').read()
    if re.search(r'小3マスター算数%s No\.%d ' % (BUNSATSU[no], no), text):
        sys.exit('原簿にもう No.%d がある。止める' % no)
    start = max_hg(text) + 1

    # ── 原簿 ──
    recs = []; hgs = {}
    for i, g in enumerate(g1s):
        hg = 'HG-%d' % (start + i); hgs[g['label']] = hg
        recs.append(genbo_record(hg, no, g, app_by.get(g['label'])))
    nxt = re.search(r'^### 【HG-\d+】小3マスター算数第\d分冊 No\.%d ' % NEXT_NO[no], text, re.M)
    if not nxt:
        sys.exit('次の回 No.%d の見出しが見つからない' % NEXT_NO[no])
    block = '\n'.join(recs) + '\n'
    new_text = text[:nxt.start()] + block + text[nxt.start():]

    # ── アプリ ──
    dp = os.path.join(BASE, 'data', 'hama_daimon.json')
    d = json.load(io.open(dp, encoding='utf-8'))
    fk = d['grades']['3']['master_bunsatsu']['fukushu']
    if str(no) in fk:
        sys.exit('アプリにもう No.%d がある。止める' % no)
    out = []; n_steps = 0; problems = []
    for g in g1s:
        a = app_by.get(g['label'])
        if not a or not a.get('steps'):
            continue
        svg = ''; step_svg = {}
        for s in g.get('svgs') or []:
            if s.get('label'):
                step_svg[s['label']] = s['svg']
            elif not svg:
                svg = s['svg']
        steps = []
        for st in a['steps']:
            o = {'question': st['question'], 'answer': str(st['answer']), 'meaning': st['meaning']}
            if st.get('choices'):
                o['choices'] = st['choices']
                if o['answer'] not in o['choices']:
                    problems.append('%s %s: answer が choices に無い' % (g['label'], st.get('sub')))
            if not o['meaning'].strip():
                problems.append('%s %s: meaning が空' % (g['label'], st.get('sub')))
            sv = step_svg.get(st.get('sub'))
            if sv:
                o['svg'] = sv
            steps.append(o)
        # 小問ごとの図が step に1つも載らなかったら、大問の図として出す（取りこぼし防止）
        if step_svg and not any('svg' in o for o in steps) and not svg:
            svg = list(step_svg.values())[0]
            problems.append('%s: 小問の図のラベルが step と合わない→大問の図にした' % g['label'])
        out.append({'id': 'hd3mb_%02d_%d' % (no, len(out) + 1), 'src': hgs[g['label']], 'title': a['title'],
                    'category': a['category'], 'unit': a['unit'], 'grade': 3, 'star': a['star'],
                    'intro': a.get('intro') or '', 'svg': svg, 'steps': steps})
        n_steps += len(steps)
    if problems:
        print('\n'.join('!! ' + p for p in problems))
        sys.exit('問題があるので止める')
    print('原簿 %d本（%s〜%s）／アプリ 大問%d本・小問%d' % (len(recs), 'HG-%d' % start, 'HG-%d' % (start + len(recs) - 1), len(out), n_steps))
    if dry:
        print(block[:1500]); return
    bk = os.path.join(tempfile.gettempdir(), 'genbo_bak_g3m_no%d_%s.md' % (no, TS))
    shutil.copy2(gp, bk); print('原簿のバックアップ:', bk)
    # 原簿は全行 CRLF。読むと \n になっているので、CRLF に戻して書く（改行を変えない）
    io.open(gp, 'w', encoding='utf-8', newline='\r\n').write(new_text)
    fk[str(no)] = out
    d['grades']['3']['master_bunsatsu']['fukushu'] = dict(sorted(fk.items(), key=lambda kv: int(kv[0])))
    io.open(dp, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
    print('書いた。次は python scripts/check_genbo.py と python scripts/hama.py gate')


if __name__ == '__main__':
    main()
