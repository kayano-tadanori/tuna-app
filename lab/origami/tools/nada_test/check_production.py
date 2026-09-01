# -*- coding: utf-8 -*-
"""本番（GitHub Pages）に折ONの7問が出ているかを、iPhoneと同じWebKitで確かめる。
   ・service_workers='block'（本番はSWが登録されていて、これが無いとiframeが空になる／続き23）
   ・Firestoreへの通信は落とす（[[feedback_local_test_writes_cloud]]：本番ランキングに書きこまない）"""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out/shots', exist_ok=True)

import sys, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BASE = 'https://kayano-tadanori.github.io/tuna-app/'

with sync_playwright() as pw:
    br = pw.webkit.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, service_workers='block',
                         has_touch=True, is_mobile=True)
    # 本番のクラウドへは一切書かない
    ctx.route('**/*firestore*/**', lambda r: r.abort())
    ctx.route('**/*googleapis.com/**', lambda r: r.abort())
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    # 折ON単体（本体のiframeが読むのと同じファイル）
    page.goto(BASE + 'lab/origami/index.html?embed=0', wait_until='domcontentloaded')
    page.wait_for_timeout(2500)
    info = page.evaluate("""() => {
      const ps = Object.values(window.ORIGAMI_PROBLEMS || {});
      return { n: ps.length, ids: ps.map(p => p.id),
               newOnes: ps.filter(p => ['no4_slide_triangle','no5_slide_triangle','no9_rect_60_fold',
                 'no13_1_isosceles_overlap','no13_2_isosceles_overlap','sokka_set_square',
                 'strip_fold_110'].includes(p.id)).map(p => p.id + '=' + p.answer.display),
               hasSlide: typeof FOLD !== 'undefined' };
    }""")
    print('本番の問題数:', info['n'])
    print('新しい7問:', info['newOnes'])
    # 実際に1問ひらいて指で折ってみる（WebKit＋tap）
    page.tap('#ori-home-nada'); page.wait_for_timeout(500)
    page.tap('.ori-picker-item:has-text("重ね合わせ")'); page.wait_for_timeout(500)
    titles = page.evaluate("() => [...document.querySelectorAll('.ori-picker-item')].map(e=>e.textContent.trim())")
    print('重ね合わせの一覧:', len(titles), '件')
    page.locator('.ori-picker-item:has-text("No.4")').first.tap()
    page.wait_for_timeout(1800)
    page.screenshot(path='_out/shots/prod_no4.png')
    st = page.evaluate("""() => {
      const s = window.__oriDebug.inst.state;
      return { steps: s.work.steps.length, slide: !!s.work.mesh.hinge[1].slide };
    }""")
    print('No.4:', st)
    print('キャッシュ名:', page.evaluate("() => fetch('../../sw.js').then(r=>r.text()).then(t=>t.match(/oton-gakuen-v\\d+/)[0])") if False else '')
    print('pageerror:', len(errs), errs[:3])
    br.close()
