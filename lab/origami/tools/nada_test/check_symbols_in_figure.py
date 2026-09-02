# -*- coding: utf-8 -*-
"""設問文・解説に出てくる「点や角の名前」が、図の上にちゃんと出ているかを機械で確かめる。

きっかけ（2026-09-02の自己監査）：No.4の解説が、原本の解答の「あ・い・う」やC'をそのまま
使っていた。アプリの図にその記号は無いので、子どもは文章を図の上で追えない。
**正しく解いていても、図と文章がつながらなければ問題として成立しない**（作問ルール§8・§10）。

見つかるのは「候補」。たとえば
  ・解説の中だけで完結する説明（「三角形OCBは…」のOはもとの位置＝破線で示している）は許容
  ・答えの対象（ア・イ）は必ず図に弧が要る＝ここが出たら本当の不具合
なので、出力は目で見て仕分ける。
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out', exist_ok=True)

from playwright.sync_api import sync_playwright   # noqa: E402

PORT = 8769
URL = 'http://localhost:%d/lab/origami/index.html' % PORT

JS = """() => Object.values(window.ORIGAMI_PROBLEMS).map(p => ({
  id: p.id,
  text: [p.promptText].concat(p.explanation || []).join(' '),
  labels: (p.labelPoints || []).flatMap(l => [l.label, l.foldedLabel]).filter(Boolean),
  angles: (p.angleMarks || []).map(a => a.label),
  dims: (p.dimensionLabels || []).map(d => d.label),
}))"""

# 図の上に出ているべき「名前」だけを拾う（cm・度などの単位や数式は拾わない）
# F1・F2 のように数字がつく名前は1文字の点として拾わない（誤検出になる）
POINT = re.compile(r"(?<![A-Za-z])([A-Z])('?)(?![A-Za-z0-9])")
MARK = re.compile(r"[アイウエオあいうえお](?=[のは、。＝=）]|$)")

with sync_playwright() as pw:
    br = pw.chromium.launch()
    page = br.new_page()
    page.goto(URL)
    page.wait_for_timeout(1200)
    rows = page.evaluate(JS)
    br.close()

total = 0
for r in rows:
    shown = set(r['labels'])
    for a in r['angles'] + r['dims']:
        shown |= set(POINT.findall(a) and [m[0] + m[1] for m in POINT.findall(a)])
        shown.add(a)
    used = set(m[0] + m[1] for m in POINT.findall(r['text']))
    # 角の記号（ア・イ…）は angleMarks に出ているか
    marks = set(m for m in MARK.findall(r['text']) if m in 'アイウエオ')
    missing_pts = sorted(p for p in used if p not in shown)
    missing_marks = sorted(m for m in marks if not any(m in a for a in r['angles']))
    if missing_pts or missing_marks:
        total += 1
        print('%-30s 図に無い点: %-22s 図に無い角の記号: %s'
              % (r['id'], ','.join(missing_pts) or 'なし', ','.join(missing_marks) or 'なし'))

print('')
print('指摘のあった問題: %d / %d' % (total, len(rows)))
print('※「もとの位置を破線で示している点」（折る前のO・Aなど）は許容。'
      '答えの対象（ア・イ）が出たら必ず直す。')
