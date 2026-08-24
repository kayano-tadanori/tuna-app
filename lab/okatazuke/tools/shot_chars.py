# -*- coding: utf-8 -*-
"""キャラ5人 × ペット を 実際のゲームで描いて 目で確かめる。

  ★Pythonで骨の式を書き写して絵にするのは やらない。本体と黙ってズレる。
    本物のゲームを開いて、本物の OkanRig で描いたものを撮る。

  使い方（先に  python -m http.server 8899  を tuna app で）:
    python tools/shot_chars.py            … 5人ぶんを 立ち姿で
    python tools/shot_chars.py pose       … 歩く／おす／よろこぶ も
"""
import os
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_chars')
URL = 'http://127.0.0.1:8899/lab/okatazuke/index.html'
CHARS = ['okan2', 'otton', 'taitsu', 'g3', 'g3b', 'g5', 'g5b']
PETS = ['chicchi', 'jade', 'mei']

# 立ち姿・歩く・おす・よろこぶ
POSES = {
    'stand': 'r.walk=0;r.push=0;r.cheer=0;r.wave=0;r.bow=0;r.walkPhase=0;',
    'walk': 'r.walk=1;r.push=0;r.cheer=0;r.walkPhase=1.15;',
    'push': 'r.walk=1;r.push=1;r.cheer=0;r.walkPhase=1.15;',
    'cheer': 'r.walk=0;r.push=0;r.cheer=1;',
}


def shoot(pg, char, pet, pose, path):
    pg.goto(URL + '?char=%s&pet=%s' % (char, pet), wait_until='domcontentloaded')
    pg.wait_for_function('window.__okReady === true', timeout=90000)
    pg.wait_for_timeout(900)
    pg.evaluate("""p => {
      document.querySelectorAll('.screen').forEach(e => e.classList.remove('show'));
      const r = OKG.rig;
      r.yaw = 0; r.pos = [0, 0, 0]; r.t = 1.2;
      eval(p);
      r.update(0);
      OKG.tBox = null;
      OKG.R.resize();
      OKG.R.camera([0, 1.20, 3.4], [0, 0.95, 0], 40);
      OKG.R.bg([0.36, 0.30, 0.46], [0.86, 0.72, 0.72], 0);
      OKG.R.drawInstanced(OKG.mesh.tile,
        [{x:0,y:-0.10,z:0,sx:26,sy:1.6,sz:26,col:[0.52,0.38,0.40]}],
        {outline:false, rim:0.02});
      OKG.R.drawShadows([{x:0,y:0.02,z:0,r:0.66}], 0.24);
      OKG.R.drawMesh(OKG.okan, r.bones, {outlineWidth:0.0034});
      okDrawPet(OKG.R, r);
    }""", POSES[pose])
    pg.wait_for_timeout(120)
    pg.locator('#cv').screenshot(timeout=90000, animations='disabled', path=path)


def main():
    full = 'pose' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader',
                                    '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 380, 'height': 560}, device_scale_factor=1)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
        # サービスワーカーが 再読みこみを起こすので 止める
        pg.add_init_script('navigator.serviceWorker && (navigator.serviceWorker.register = () '
                           '=> new Promise(() => {}));')
        poses = ['stand', 'walk', 'push', 'cheer'] if full else ['stand']
        for pet in (PETS if not full else PETS[:1]):
            for pose in poses:
                row = []
                for c in CHARS:
                    f = os.path.join(OUT, 'g_%s_%s_%s.png' % (c, pet, pose))
                    shoot(pg, c, pet, pose, f)
                    row.append(f)
                rows.append((pet + '/' + pose, row))
        b.close()
    if errs:
        print('★コンソール:', errs[:5])
    else:
        print('コンソールエラー なし')
    ims = [[Image.open(f) for f in r] for _, r in rows]
    w, h = ims[0][0].size
    sheet = Image.new('RGB', (w * len(CHARS), h * len(rows)), (255, 255, 255))
    for j, row in enumerate(ims):
        for i, im in enumerate(row):
            sheet.paste(im, (i * w, j * h))
    out = os.path.join(OUT, '_game_sheet.png')
    sheet.save(out)
    print('→', out, sheet.size, [n for n, _ in rows])


if __name__ == '__main__':
    main()
