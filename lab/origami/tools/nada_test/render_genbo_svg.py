# -*- coding: utf-8 -*-
"""原簿に入れた「5」のSVGを実際に描いて目で見る（弧の向きが逆だと図が変になるため）"""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out/shots', exist_ok=True)

import io, os
from playwright.sync_api import sync_playwright

MEM = r'C:\Users\User\.claude\projects\c--Users-User-Desktop-Claude\memory\origami_mondai_genbo.md'
# 原簿のどの節のSVGを描くか（見出しの一部）。別の問題を見たいときはここを書きかえる
SECTION = '### 「5」（学校名記載なし・単独枠）'
src = io.open(MEM, encoding='utf-8').read()
i = src.index(SECTION)
seg = src[i:i + 4000]
svg = seg[seg.index('<svg'):seg.index('</svg>') + 6]
io.open('_out/genbo_svg.html', 'w', encoding='utf-8').write(
    '<body style="background:#0c1226;margin:0;padding:10px">' + svg + '</body>')
url = 'file:///' + os.path.abspath('_out/genbo_svg.html').replace(os.sep, '/')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 440, 'height': 280})
    pg.goto(url)
    pg.wait_for_timeout(300)
    pg.screenshot(path='_out/shots/genbo_svg.png')
    b.close()
print('rendered')
