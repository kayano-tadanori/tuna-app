# -*- coding: utf-8 -*-
"""_char_preview.html（キャラ紹介の見た目だけを確かめるページ）を作り直す。
   index.html の #screen-character をそのまま写す。
   ★本体のキャラ紹介を直したら これを流すこと。
   Firebase を読まないので、iPhoneで開いてもクラウドには何も書きこまれない。"""
import io, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
src = io.open('index.html', encoding='utf-8').read()
a = src.index('<div id="screen-character"')
b = src.index('<!-- =============== ホーム画面 ===============', a)
body = src[a:b].rstrip().replace(
    '<button class="back-btn" id="btn-char-back">‹ 戻る</button>', '')
head = io.open('_char_preview.html', encoding='utf-8').read()
i = head.index('<div id="screen-character"')
j = head.index('<div class="note">')
io.open('_char_preview.html','w',encoding='utf-8',newline='').write(head[:i] + body + '\n' + head[j:])
print('_char_preview.html を作り直した')
