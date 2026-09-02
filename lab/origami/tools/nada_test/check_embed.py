# -*- coding: utf-8 -*-
"""本体(オトン学園)のiframeに組みこまれた状態（?embed=1）で折ONが正しく動くかを、本番で確かめる。

🚨**本体にログインしてはいけない。** ニックネームを入れて記録画面まで行くと、
ダミーの達成率が**本番のランキングに載る**（[[feedback_local_test_writes_cloud]]の事故。
消せるのは管理ツールの管理者だけ）。ここではログイン画面より先へは進まず、
**iframeが読むのと同じURLを直接開いて**、埋めこみモードのコードだけを通す。

・WebKit（iPhoneと同じエンジン）＋ tap()：Chromiumでは出ない不具合がある（続き23）
・service_workers='block'：本番はSWが登録されていて、無いとiframeの中身が空になる
・Firestoreへの通信は落とす（保険。折ON単体はlocalStorageしか使わない）
"""
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out/shots', exist_ok=True)

from playwright.sync_api import sync_playwright   # noqa: E402

BASE = 'https://kayano-tadanori.github.io/tuna-app/'
URL = BASE + 'lab/origami/index.html?embed=1'

with sync_playwright() as pw:
    br = pw.webkit.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, service_workers='block',
                         has_touch=True, is_mobile=True)
    ctx.route('**/*firestore*/**', lambda r: r.abort())
    ctx.route('**/*googleapis.com/**', lambda r: r.abort())
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_timeout(2500)
    # 本体へ送るメッセージ（ori-ready / ori-exit）を受け取れるように仕掛ける
    page.evaluate("() => { window.__msgs = []; addEventListener('message', e => window.__msgs.push(e.data && e.data.type)); }")

    info = page.evaluate("""() => ({
      n: Object.keys(window.ORIGAMI_PROBLEMS || {}).length,
      groups: Object.values(window.ORIGAMI_PROBLEMS || {}).reduce((a, p) => {
        const g = p.nadaGroup || 'fold'; a[g] = (a[g] || 0) + 1; return a; }, {}),
    })""")
    print('本番の問題数:', info['n'], '／カテゴリ別:', info['groups'])

    back = page.locator('#ori-home-exit')
    box = back.bounding_box()
    print('「オトン学園にもどる」:', '見えている' if back.is_visible() else '★見えない',
          '／高さ %.0fpx（iOSの推奨は44px以上）' % (box['height'] if box else 0))
    page.screenshot(path='_out/shots/embed_home.png')

    # 灘中対策コーナー → 折紙問題 → 弧のある問題を開く（指でタップ）
    page.locator('#ori-home-nada').tap()
    page.wait_for_timeout(600)
    page.locator('.ori-picker-item:has-text("折紙問題")').first.tap()
    page.wait_for_timeout(600)
    page.locator('.ori-picker-item:has-text("塾技29(2)")').first.tap()
    page.wait_for_timeout(2200)
    page.screenshot(path='_out/shots/embed_problem.png')

    # もどるを順に押して、ホームまで帰れるか
    page.locator('#ori-fold-back').tap(); page.wait_for_timeout(700)
    page.locator('#ori-picker-back').tap(); page.wait_for_timeout(700)
    page.locator('#ori-picker-back').tap(); page.wait_for_timeout(700)
    home = page.evaluate("() => !document.getElementById('ori-screen-home').hidden")
    print('ホームまで帰れたか:', 'OK' if home else '★帰れない')

    # 「オトン学園にもどる」を押すと、本体へ ori-exit を送るか
    page.locator('#ori-home-exit').tap()
    page.wait_for_timeout(600)
    msgs = page.evaluate("() => window.__msgs")
    print('本体へ送ったメッセージ:', msgs, '→', 'OK' if 'ori-exit' in (msgs or []) else '★ori-exitが飛んでいない')
    page.screenshot(path='_out/shots/embed_back.png')
    print('pageerror:', len(errs), errs[:3])
    br.close()
