# -*- coding: utf-8 -*-
u"""🩹 「見えている足場」と「当たり判定」がそろっているかを実測する。

  きっかけ（2026-09-04・本人）
    「落下判定が少し厳しい。見えてる足場の上なのにミスになります」「下の端」「幅も緩めに」

  そのとき測ったら、絵と判定がまるで別物だった。
    ・横 …… 描いた絵は判定より 1.36〜1.52 倍ひろい
    ・厚み … 判定は上のめんから 0.462 world の帯だけ。宇宙の岩は 0.87〜1.44 world 描いてある
             ＝ 岩の下半分〜2/3 に当たり判定が無く、絵の中を素通りしていた

  ここで見るのは2つ。
    ① 物差し … 判定の箱が、画面に描かれている形とそろっているか
    ② 実際に乗れるか … 絵の いちばん下・いちばん外 に立たせて、ほんとうに跳ねるか
       （★①だけでは足りない。「数字が合っている」と「実際に乗れる」は別）

  使い方:  cd "tuna app" && python -m http.server 8899 &
           python lab/chicchi-jump-3d/tools/hitbox_check.py
"""
import sys
from playwright.sync_api import sync_playwright

# Windows の既定は cp932。絵文字も日本語の記号も落ちるので、先に utf-8 にする。
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed=20260821"
TYPES = ["normal", "spring", "ice", "break"]
# ★岩ゾーンは 1500m から。3000m は月の到着シーンでゲームの時間が止まるので使わない。
ZONES = [(400, u"雲"), (2000, u"岩")]

SETUP = """
(a) => { const [alt, t] = a; const c = window.__cj.core;
  window.__cj.warp(alt);
  c.platforms.length = 0; c.coins.length = 0; c.hawk = null;
  c.platforms.push({ px: c.camPx, y: c.camY + CJ_VIEW_H * 0.34, w: CJ_PLAT_W, type: t,
                     risky: false, used: false, breakAt: 0, seed: 0.5, vx: 0 });
  c.player.px = c.camPx; c.player.y = c.camY + CJ_VIEW_H * 0.34 + CJ_PLAT_H;
  c.player.vy = 0; c.over = false; c.ending = false; c.spawnY = 1e9; }
"""

# 判定の箱と、画面で見た実寸をおなじ物差し（world）で返す
PROBE = """
() => { const R = window.__cj.R, c = window.__cj.core, v = R.view, pr = R.proj;
  const proj = p => { const vx = v[0]*p[0]+v[4]*p[1]+v[8]*p[2]+v[12];
    const vy = v[1]*p[0]+v[5]*p[1]+v[9]*p[2]+v[13];
    const vz = v[2]*p[0]+v[6]*p[1]+v[10]*p[2]+v[14]; const w = -vz;
    return { x: (pr[0]*vx)/w, y: (pr[5]*vy)/w }; };
  const pl = c.platforms[0], top = pl.y + CJ_PLAT_H;
  const at = (px, y) => { const a = cjAngle(px);
    return [Math.sin(a)*CJ_RADIUS, y, Math.cos(a)*CJ_RADIUS]; };
  // 1 world が画面の何NDCか（この深さで）
  const kx = proj(at(pl.px + 0.5, top)).x - proj(at(pl.px - 0.5, top)).x;
  const ky = proj(at(pl.px, top + 0.5)).y - proj(at(pl.px, top - 0.5)).y;
  const box = c.platHit(pl);
  return { kx: Math.abs(kx), ky: Math.abs(ky), halfW: box.halfW, tol: box.tol,
           drawHalfW: pl.drawHalfW, drawH: pl.drawH, w: pl.w };
}
"""

# 実際に乗れるか。絵のいちばん外・いちばん下へ置いて、指で寄せた形にして落とす。
LAND = """
(a) => { const [dx, dy] = a; const c = window.__cj.core;
  const pl = c.platforms[0], top = pl.y + CJ_PLAT_H;
  c.player.px = cjWrap(pl.px + dx);
  c.player.y = top - dy;
  c.player.vy = -6; c.over = false; c.ending = false;
  for (let i = 0; i < 40; i++) { c.step(1/60); if (c.player.vy > 0) return true; }
  return false; }
"""

def main():
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                    "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
        # ☠️ ローカル検証でも本番クラウドに書きこまれる。先に落とす。
        for pat in ["**://*.googleapis.com/**", "**://*.firebaseio.com/**"]:
            pg.route(pat, lambda r: r.abort())
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__cjReady === true", timeout=20000)
        pg.wait_for_timeout(300)
        pg.click("#ov-go"); pg.wait_for_timeout(300)
        pg.evaluate("() => { window.__cj.core.over = false; window.__cj.setRunning(true); }")
        cw = pg.evaluate("() => document.querySelector('canvas').width")
        ch = pg.evaluate("() => document.querySelector('canvas').height")

        print(u"ゾーン 種類     | 見た目 はば/あつみ | 判定 はば/あつみ | そろってるか")
        for alt, zone in ZONES:
            for t in TYPES:
                pg.evaluate(SETUP, [alt, t]); pg.wait_for_timeout(200)
                pg.wait_for_function(
                    "() => { const p = window.__cj.core.platforms[0];"
                    "        return p && p.drawH > 0 && p.drawHalfW > 0; }", timeout=5000)
                # 描き始めの数フレームは まだ出ていないことがあるので、出るまで待つ
                bx = {"plats": []}
                for _ in range(12):
                    bx = pg.evaluate("() => window.__cj.platBoxes()")
                    if bx["plats"]: break
                    pg.wait_for_timeout(120)
                pr = pg.evaluate(PROBE)
                if not bx["plats"]:
                    bad.append(u"%s %s: 画面で測れなかった（検査が働いていない）" % (zone, t))
                    print(u"  %s %-7s 画面で測れず＝検査になっていない" % (zone, t)); continue
                dW = bx["plats"][0]["wPx"] * 2 / cw / pr["kx"]        # world
                dH = bx["plats"][0]["hPx"] * 2 / ch / pr["ky"]        # world
                jW, jH = pr["halfW"] * 2, pr["tol"]
                okW = jW >= dW - 0.02
                okH = jH >= dH - 0.02
                print(u"  %s   %-7s| %5.3f / %5.3f | %5.3f / %5.3f | %s %s" %
                      (zone, t, dW, dH, jW, jH,
                       u"はばOK" if okW else u"はばNG", u"あつみOK" if okH else u"あつみNG"))
                if not okW: bad.append(u"%s %s: 見た目のはば %.3f > 判定 %.3f" % (zone, t, dW, jW))
                if not okH: bad.append(u"%s %s: 見た目のあつみ %.3f > 判定 %.3f" % (zone, t, dH, jH))

                # ② 実際に乗れるか（★数字が合っていることと、乗れることは別）
                #    絵のいちばん下・いちばん外に立たせて、ほんとうに跳ね返るかを見る。
                pw = 0.5538461538461539            # CJ_PLAYER_W
                cases = [
                    (u"まん中・絵の下のはし", 0.0, dH * 0.97),
                    (u"絵の よこのはし・上",  pr["halfW"] + pw / 2 - 0.02, 0.0),
                    (u"絵の よこのはし・下",  pr["halfW"] + pw / 2 - 0.02, dH * 0.90),
                ]
                for label, dx, dy in cases:
                    pg.evaluate(SETUP, [alt, t])
                    # ★実寸は「描いたとき」に足場へ入る。入るまで待ってから試す。
                    #   待たずに測ると、直っているのに「乗れない」と出る（実際にそうなった）。
                    pg.wait_for_function(
                        "() => { const p = window.__cj.core.platforms[0];"
                        "        return p && p.drawH > 0 && p.drawHalfW > 0; }", timeout=5000)
                    landed = pg.evaluate(LAND, [dx, dy])
                    if not landed:
                        bad.append(u"%s %s: %s で乗れない" % (zone, t, label))
                        print(u"        NG: %s で 乗れない" % label)
        b.close()
    print()
    if bad:
        print(u"NG そろっていない: %d 件" % len(bad))
        for m in bad: print(u"   " + m)
        return 1
    print(u"OK 見えている形は ぜんぶ 当たり判定に入っている")
    return 0

if __name__ == "__main__":
    sys.exit(main())
