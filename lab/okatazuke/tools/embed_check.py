# -*- coding: utf-8 -*-
"""本体（オトン学園）に組みこんだ状態を、実際にブラウザで確かめる。

☠ 大事：ローカルで動かしても、ニックネームを入れると
   本番のFirestoreに書きこまれてしまう（[[feedback_local_test_writes_cloud]]）。
   ここでは 先に googleapis / firestore への通信を すべて落としてから開く。

見るもの
  ・カードが 一覧に出るか（背景がちゃんと当たっているか）
  ・押したら 画面が切りかわり iframe が読みこまれるか
  ・「はじめる」で 遊び券が 1まい減るか（中の やりなおしでは 減らないか）
  ・もどるで iframe が about:blank になるか
  ・コンソールにエラーが出ないか
"""
import os
import sys

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_embed')
os.makedirs(OUT, exist_ok=True)
URL = "http://127.0.0.1:8899/index.html"
ng = []


def tap(pg, box):
    """本物の指と同じタップ（当たり判定も ふくめて 通す）"""
    pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)


def tap_in_frame(pg, fr, sel):
    fb = pg.locator("#oz-frame").bounding_box()
    r = fr.evaluate("""s => { const e = document.querySelector(s); const b = e.getBoundingClientRect();
                             return {x: b.x, y: b.y, width: b.width, height: b.height}; }""", sel)
    pg.touchscreen.tap(fb['x'] + r['x'] + r['width'] / 2, fb['y'] + r['y'] + r['height'] / 2)

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    ctx = b.new_context(viewport={"width": 414, "height": 830}, device_scale_factor=2,
                        has_touch=True, is_mobile=True)
    # ☠ 本番クラウドへ 1バイトも 出さない
    ctx.route("**://*.googleapis.com/**", lambda r: r.abort())
    ctx.route("**://*.google.com/**", lambda r: r.abort())
    ctx.route("**://*.firebaseio.com/**", lambda r: r.abort())
    ctx.route("**://*.gstatic.com/**", lambda r: r.abort())
    pg = ctx.new_page()
    pg.set_default_timeout(90000)
    errs = []
    pg.on("console", lambda m: errs.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    pg.add_init_script("""
      localStorage.setItem('nickname', 'てすと');
      localStorage.setItem('gameTickets', '5');
      // ★本体は Service Worker が入れかわると location.reload() する（app.js の
      //   controllerchange）。検査中に 勝手に読みなおされると 何も測れないので止める。
      if (navigator.serviceWorker) {
        try { navigator.serviceWorker.register = () => Promise.reject(new Error('test')); } catch (e) {}
      }
    """)
    pg.goto(URL, wait_until="load")
    pg.wait_for_timeout(2500)

    # 息抜きタイムのところまで行く
    pg.evaluate("() => { if (typeof showScreen === 'function') showScreen('subject'); }")
    pg.wait_for_timeout(600)
    # ★ログインボーナスなどの お知らせが開いていると、画面ぜんぶを おおって
    #   iframe の中のボタンが 押せなくなる。先に閉じる（2026-08-23 これで1時間 溶かした）
    for _ in range(4):
        if pg.evaluate("() => { const m = document.getElementById('gami-modal');"
                       " return m && !m.classList.contains('hidden'); }"):
            pg.evaluate("() => document.getElementById('gami-close').click()")
            pg.wait_for_timeout(400)
        else:
            break
    card = pg.locator('[data-subject="okatazuke"]')
    if card.count() == 0:
        ng.append('カードが 一覧に無い')
    else:
        bg = pg.evaluate("""() => {
            const el = document.querySelector('[data-subject="okatazuke"]');
            const cs = getComputedStyle(el);
            return { bg: cs.backgroundImage.slice(0, 60), h: el.getBoundingClientRect().height };
        }""")
        if 'none' == bg['bg'] or bg['h'] < 60:
            ng.append(f'カードの見た目が おかしい {bg}')
        print('カード …', bg)
        # ★Playwright の自動スクロールは 固定の入れ物の中で 止まらないことがある。
        #   JS で 自分でスクロールしてから 指の座標で押す。
        pg.evaluate("""() => { const el = document.querySelector('[data-subject=okatazuke]');
              el.scrollIntoView({block: 'center', behavior: 'instant'}); }""")
        pg.wait_for_timeout(400)
        pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, "01_card.png"))

    t0 = pg.evaluate("() => getGameTickets()")
    # カードを開くのは 本体がわの仕事なので、ここは click() でよい。
    # ★確かめたいのは「iframe の中のボタンが 指で押せるか」のほう。
    pg.evaluate("() => document.querySelector('[data-subject=okatazuke]').click()")
    pg.wait_for_timeout(2500)
    shown = pg.evaluate("""() => {
        const s = document.getElementById('screen-okatazuke');
        const f = document.getElementById('oz-frame');
        return { on: s && s.classList.contains('active'),
                 cls: s ? s.className : '(無し)', src: f ? f.src.slice(0, 60) : '' };
    }""")
    print('画面 …', shown)
    if 'lab/okatazuke' not in shown['src']:
        ng.append('iframe が よみこまれていない: ' + str(shown))

    fr = None
    for f in pg.frames:
        if 'okatazuke' in f.url:
            fr = f
    # ★iframe は src を入れなおすので、古いフレームをつかむと "detached" になる
    if not fr:
        ng.append('iframe の中が 見つからない')
    else:
        fr.wait_for_function("window.__okReady === true", timeout=20000)
        pg.wait_for_timeout(700)
        pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, "02_title.png"))
        t1 = pg.evaluate("() => getGameTickets()")
        if t1 != t0:
            ng.append(f'開いただけで 券が減った（{t0}→{t1}）')
        # 「はじめる」で 1まい払う
        tap_in_frame(pg, fr, "#btn-start")
        pg.wait_for_timeout(900)
        t2 = pg.evaluate("() => getGameTickets()")
        if t2 != t0 - 1:
            ng.append(f'はじめるで 券が1まい減っていない（{t0}→{t2}）')
        print(f'遊び券 … 入場前{t0} → 開いた{t1} → はじめた{t2}')
        # 面を開いて やりなおしても 減らない
        fr.evaluate("() => okStartLevel(0)")
        pg.wait_for_timeout(500)
        fr.evaluate("() => okReset()")
        fr.evaluate("() => okStartLevel(1)")
        pg.wait_for_timeout(500)
        t3 = pg.evaluate("() => getGameTickets()")
        if t3 != t2:
            ng.append(f'面を変えたら 券が減った（{t2}→{t3}）')
        pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, "03_play.png"))
        # ✕ でもどる
        tap_in_frame(pg, fr, "#btn-exit")
        pg.wait_for_timeout(900)
        src = pg.evaluate("() => document.getElementById('oz-frame').src")
        if src != 'about:blank':
            ng.append('もどったのに iframe が止まっていない: ' + src)
        pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, "04_back.png"))

    b.close()

print('\n=== コンソール ===')
if errs:
    for e in errs[:20]:
        print(e)
else:
    print('エラーなし')
print('\n=== けっか ===')
if ng:
    for m in ng:
        print(' ★', m)
    sys.exit(1)
print('ぜんぶ OK')
