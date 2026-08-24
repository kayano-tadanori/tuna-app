# -*- coding: utf-8 -*-
"""ふるまいの検証（実際のブラウザで動かして 確かめる）。

見るもの
  1. 全面が よみこめて、盤の数（にもつ＝おきば）が合っているか
  2. もどす … n手 動かして n回 もどしたら 最初の配置に ぴったり戻るか
  3. やりなおし … 最初の配置に戻るか
  4. 詰み判定 … 「詰み」と言った局面が 本当に解けないか（Pythonのソルバーで裏を取る）
     ★ここが いちばん大事。まちがって「詰み」と言うと 子どもが混乱する
  5. タップで歩く … 押した先のマスへ ちゃんと歩くか
"""
import os
import sys
import json
import random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sokoban  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

URL = "http://127.0.0.1:8899/lab/okatazuke/index.html"
KEY = {'U': 'ArrowUp', 'D': 'ArrowDown', 'L': 'ArrowLeft', 'R': 'ArrowRight'}
ng = []


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=[
            "--use-gl=angle", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
        ])
        pg = b.new_page(viewport={"width": 414, "height": 830})
        errs = []
        pg.on("console", lambda m: errs.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__okReady === true", timeout=20000)
        levels = json.loads(pg.evaluate("() => JSON.stringify(OK_LEVELS)"))
        print('面の数 …', len(levels))

        # --- 1. よみこみ ---
        for i, L in enumerate(levels):
            st = pg.evaluate("""i => { okStartLevel(i); const g = OKG.game;
                return { boxes: g.boxes.length,
                         goals: g.goal.filter(Boolean).length,
                         player: !!g.player, dist: OKG.cam.dist }; }""", i)
            if st['boxes'] != st['goals']:
                ng.append(f"面{i+1}: にもつ{st['boxes']}個 / おきば{st['goals']}個 で数が合わない")
            if not st['player']:
                ng.append(f"面{i+1}: オカンがいない")
            if not (3 < st['dist'] < 120):
                ng.append(f"面{i+1}: カメラの距離が変（{st['dist']}）")
        print('1. よみこみ … 見おわり')

        # --- 2/3. もどす・やりなおし ---
        rng = random.Random(7)
        for i in [3, 10, 20, 30, 60, 100]:
            L = levels[i]
            pg.evaluate("i => okStartLevel(i)", i)
            start = pg.evaluate("() => JSON.stringify({b: OKG.game.boxes, p: OKG.game.player})")
            seq = [rng.choice('UDLR') for _ in range(14)]
            for ch in seq:
                pg.evaluate("d => { OKG.anim = null; OKG.queue.length = 0; okTryMove(d); }", ch)
            n = pg.evaluate("() => OKG.game.history.length")
            for _ in range(n):
                pg.evaluate("() => { OKG.anim = null; okUndo(); }")
            after = pg.evaluate("() => JSON.stringify({b: OKG.game.boxes, p: OKG.game.player})")
            if after != start:
                ng.append(f"面{i+1}: もどすを{n}回で 最初の配置に戻らない")
            mp = pg.evaluate("() => [OKG.game.moves, OKG.game.pushes, OKG.game.history.length]")
            if mp != [0, 0, 0]:
                ng.append(f"面{i+1}: 全部もどしたのに 手数が {mp}")
            # やりなおし
            for ch in seq[:6]:
                pg.evaluate("d => { OKG.anim = null; OKG.queue.length = 0; okTryMove(d); }", ch)
            pg.evaluate("() => okReset()")
            after = pg.evaluate("() => JSON.stringify({b: OKG.game.boxes, p: OKG.game.player})")
            if after != start:
                ng.append(f"面{i+1}: やりなおしで 最初の配置に戻らない")
        print('2/3. もどす・やりなおし … 見おわり')

        # --- 4. 詰み判定が 本当に正しいか ---
        checked = 0
        # ★裏どりには ソルバーで解ける面だけ使う（大きい面は こちらでは解けない＝
        #   「解けない」と「詰み」の区別がつかないので、判定の正しさを言えない）
        for i in [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]:
            L = levels[i]
            base = sokoban.Level(L['rows'])
            for trial in range(26):
                pg.evaluate("i => okStartLevel(i)", i)
                rng2 = random.Random(i * 100 + trial)
                said = None
                for step in range(18):
                    d = rng2.choice('UDLR')
                    pg.evaluate("d => { OKG.anim = null; OKG.queue.length = 0; okTryMove(d); }", d)
                    stuck = pg.evaluate("() => OKG.game.deadlockedBoxes().length > 0")
                    if stuck:
                        said = pg.evaluate("""() => ({
                            boxes: OKG.game.boxes.map(b => [b.x, b.y]),
                            p: [OKG.game.player.x, OKG.game.player.y] })""")
                        break
                    if pg.evaluate("() => OKG.game.isClear()"):
                        break
                if not said:
                    continue
                checked += 1
                # その配置を作って ソルバーにかける（解けたら 判定がまちがい）
                lv = sokoban.Level(L['rows'])
                lv.boxes = set((b[0], b[1]) for b in said['boxes'])
                lv.player = (said['p'][0], said['p'][1])
                lv.floor = lv._flood()
                lv._simple_deadsq = None
                r = sokoban.solve(lv, max_states=40000)
                if r.get('solved'):
                    ng.append(f"面{i+1}: 『詰み』と言ったのに まだ解ける "
                              f"（にもつ{said['boxes']} オカン{said['p']}）")
        print(f'4. 詰み判定 … {checked}件の「詰み」を ソルバーで 裏どりした')

        # --- 5. タップで歩く ---
        pg.evaluate("i => okStartLevel(i)", 0)
        # ★にもつの無い、歩いて行けるマスを 探してから タップする
        #   （前は「1つ下」を決め打ちしていて、そこに にもつがある面だと 動かなくて当然だった）
        target = pg.evaluate("""() => {
            const g = OKG.game;
            for (const p of g.floorCells()) {
              if (g.boxAt(p.x, p.y) >= 0) continue;
              if (p.x === g.player.x && p.y === g.player.y) continue;
              return p;
            }
            return null;
        }""")
        pg.evaluate("t => { OKG.anim=null; OKG.queue.length=0; okWalkTo(t.x, t.y); }", target)
        for _ in range(30):
            pg.evaluate("() => { if (OKG.anim) OKG.anim.t = 99; okStep(1/60); }")
        moved = pg.evaluate("() => OKG.game.moves")
        if moved < 1:
            ng.append("タップで歩く … 動かなかった")
        print('5. タップで歩く … 見おわり')

        b.close()

    print('\n=== けっか ===')
    if ng:
        for m in ng[:40]:
            print(' ★', m)
        print(f'\n{len(ng)} 件 見つかった')
        sys.exit(1)
    print('ぜんぶ OK')


if __name__ == '__main__':
    main()
