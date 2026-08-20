# ゲーム本編の画面から カード用のバナー画像を作る（おとんテトリス2）
#   使い方： python -m http.server 8901 を tuna app で立ててから
#            python scripts/make_tetris2_banner.py
#   ★UIを display:none にすると measureLayout の計算が壊れて盤面が画面のすみに
#     小さく描かれる。撮影用に renderParams() をラップして rect ごと差しかえている。
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

DST = r"c:/Users/User/Desktop/Claude/tuna app/images/tetris2-banner.png"
URL = "http://127.0.0.1:8901/lab/tetris2/index.html"

# 盤面が中央に来るので、左寄りに切り出して 絵の中では右寄りに置く。
# カードは左側にテキストが乗る（style.css の .subject-card-t2 のグラデで左を暗く潰す）。
# ★カードは横長（およそ4.3:1）。画像がそれより縦長だと cover で上下が切れて
#   主役（積み山）が見えなくなる。画像もカードに近い比率で作り、井戸は右寄りに置く。
CLIP = {"x": 0, "y": 92, "width": 1200, "height": 280}

# カメラ。halfH を小さくすると寄る／targetY で上下／yaw で角度
CAM = {"halfH": 8.1, "halfW": 5.4, "targetY": -5.0, "pitch": 0.09, "yaw": 0.38, "zoom": 1, "roll": 0}

SETUP = """(cam) => {
  startGame();
  const B = G.core.board;
  // 右に山・左に谷、下3行は満杯（＝I駒が刺されば4ライン消し、という一番おいしい瞬間）
  const rows = {
    19: ['J','J','O','O','L','L','I','S','S','Z'],
    18: ['J','T','T','T','O','O','L','L','S','Z'],
    17: ['Z','Z','T','I','I','I','I','L','S','S'],
    16: [null,null,'Z','Z','O','O','T','L','L',null],
    15: [null,null,null,'S','S','O','O','T','T',null],
    14: [null,null,null,null,'J','J','J','Z','T',null],
    13: [null,null,null,null,null,'J','Z','Z',null,null],
  };
  for (const [r, line] of Object.entries(rows)) line.forEach((t, x) => { B[+r][x] = t; });
  G.core.cur.type = 'I'; G.core.cur.rot = 1; G.core.cur.x = 0; G.core.cur.y = 8;

  // ライン消しの光を走らせる
  G.snapshot = B.map(r => r.slice());
  startClearFx({ rows: [17, 18, 19], tspin: false, perfect: false });

  // 火花：消える行と、山のてっぺんから
  const cx = c => c - 4.5, cy = r => 9.5 - r;
  for (const r of [17, 18, 19]) for (let x = 0; x < 10; x++) {
    const t = B[r][x]; if (!t) continue;
    R.burst(cx(x), cy(r), 0.15, COLORS[t].erg, 6, { speed: 9, life: 1.0, size: 0.5, g: -10 });
  }
  R.burst(cx(6), cy(13), 0.2, [1.3, 0.9, 0.35], 34, { speed: 13, life: 1.3, size: 0.8, g: -8, up: 3 });
  R.burst(cx(2), cy(16), 0.2, [0.55, 0.95, 1.4], 26, { speed: 11, life: 1.2, size: 0.7, g: -8 });
  // 井戸の外にも光の粉をまいて、左側（テキストが乗るがわ）が真っ暗にならないようにする
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * 6.283, r = 7 + Math.random() * 9;
    R.burst(Math.cos(a) * r, -3 + Math.sin(a) * 6, Math.random() * 2 - 1,
      [0.5 + Math.random() * 0.9, 0.8, 1.4], 2, { speed: 3, life: 1.4, size: 0.42, g: -2 });
  }

  // 空気を「決めの瞬間」に
  G.intensity = 1; G.beat = 1; G.danger = 0.2;
  G.flash = 0.62; G.flashCol = [0.8, 0.98, 1.45];
  G.trauma = 0.28;

  // UIは消して絵だけにする＋撮影用カメラに差しかえ
  document.getElementById('ui').style.display = 'none';
  const fps = document.getElementById('fps'); if (fps) fps.style.display = 'none';
  const orig = renderParams;
  window.renderParams = () => {
    const p = orig();
    p.rect = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    Object.assign(p.cam, cam);
    return p;
  };
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1800, "height": 480}, device_scale_factor=1)
    pg.goto(URL)
    pg.wait_for_timeout(2500)
    pg.evaluate(SETUP, CAM)
    pg.wait_for_timeout(150)      # 光が走っている途中で止める
    pg.screenshot(path=DST, clip=CLIP)
    print("バナー保存:", DST)
    b.close()
