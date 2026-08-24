# -*- coding: utf-8 -*-
"""ポーズを 止めて 撮る（肩まわりを 大きく見るため）。

  ★rAF が回っているので、描いた直後に撮っても 次のフレームに上書きされる。
    `OkanRig.prototype.update` を すりかえて **毎フレーム同じポーズ**にしてから撮る。

  使い方:
    python tools/pose_shot.py okan2 push        … 1枚
    python tools/pose_shot.py sheet             … 見くらべの1枚に
"""
import os
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_pose')
URL = 'http://127.0.0.1:8899/lab/okatazuke/index.html'

# ポーズの作り方（rig に そのまま入れる値）
POSES = {
    'stand': 'r.walk=0;r.push=0;r.cheer=0;r.wave=0;r.bow=0;r.walkPhase=0;',
    'walk': 'r.walk=1;r.push=0;r.cheer=0;r.walkPhase=1.15;',
    'walk2': 'r.walk=1;r.push=0;r.cheer=0;r.walkPhase=2.75;',
    'push': 'r.walk=1;r.push=1;r.cheer=0;r.walkPhase=1.15;',
    'push2': 'r.walk=1;r.push=1;r.cheer=0;r.walkPhase=2.75;',
    'cheer': 'r.walk=0;r.push=0;r.cheer=1;r.walkPhase=0;',
    'wave': 'r.walk=0;r.push=0;r.wave=1;r.walkPhase=0;',
    'sad': 'r.walk=0;r.push=0;r.sad=1;r.walkPhase=0;',
}
# カメラ（近く＝上半身、遠く＝全身）
CAMS = {
    'near': ([0.0, 1.45, 1.55], [0.0, 1.30, 0]),
    'side': ([2.15, 1.35, 0.55], [0.0, 0.95, 0.25]),
    'full': ([0.0, 1.20, 3.4], [0.0, 0.95, 0]),
}

FREEZE = """a => {
  document.querySelectorAll('.screen').forEach(e => e.classList.remove('show'));
  const r = OKG.rig;
  r.yaw = 0; r.pos = [0, 0, 0]; r.t = 1.2;
  r.walk = 0; r.push = 0; r.cheer = 0; r.wave = 0; r.bow = 0; r.sad = 0;
  eval(a.pose);
  r.update(0);
  const held = r.bones.map(m => new Float32Array(m));
  OkanRig.prototype.update = function () { this.bones = held; return held; };
  if (OKG.petRig) { OKG.petRig.freeze(a.petPhase); 
    const held2 = OKG.petRig.bones.map(m => new Float32Array(m));
    PetRig.prototype.update = function () { this.bones = held2; return held2; }; }
  // ★にもつは キャラの まっすぐ前（yaw=0 なら +Z＝手前）に置く。
  //   横に置いて撮ると 押していないように見えて 判断をまちがえる。
  OKG.tBox = a.box ? { x: 0, z: 0.72 } : null;
  OKG.__cam = a.cam;
}"""


def shoot(pg, char, pet, pose, cam, path, box=False, pet_phase=0):
    pg.goto(URL + '?char=%s&pet=%s' % (char, pet), wait_until='domcontentloaded')
    pg.wait_for_function('window.__okReady === true', timeout=90000)
    pg.wait_for_timeout(700)
    eye, tgt = CAMS[cam]
    pg.evaluate(FREEZE, {'pose': POSES[pose], 'cam': [eye, tgt], 'box': box,
                         'petPhase': pet_phase})
    pg.wait_for_timeout(700)
    pg.locator('#cv').screenshot(timeout=90000, animations='disabled', path=path)


def main():
    os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    if args and args[0] == 'sheet':
        chars = ['okan2', 'g5', 'otton']
        poses = ['stand', 'walk', 'walk2', 'push', 'push2', 'cheer']
        cams = ['side']
        jobs = [(c, p, cm) for c in chars for p in poses for cm in cams]
    else:
        c = args[0] if args else 'okan2'
        p = args[1] if len(args) > 1 else 'push'
        cm = args[2] if len(args) > 2 else 'near'
        jobs = [(c, p, cm)]
    pet = 'chicchi'
    files = []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader',
                                     '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 320, 'height': 460}, device_scale_factor=2)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
        pg.add_init_script('navigator.serviceWorker && (navigator.serviceWorker.register = () '
                           '=> new Promise(() => {}));')
        for c, p, cm in jobs:
            f = os.path.join(OUT, '%s_%s_%s.png' % (c, p, cm))
            shoot(pg, c, pet, p, cm, f, box=(p.startswith('push')))
            files.append(f)
            print('  ', os.path.basename(f))
        print('エラー:', errs[:3] if errs else 'なし')
        b.close()
    if len(files) > 1:
        ims = [Image.open(f) for f in files]
        w, h = ims[0].size
        cols = 6
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (w * cols, h * rows), (255, 255, 255))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % cols) * w, (i // cols) * h))
        out = os.path.join(OUT, '_sheet.png')
        sheet.save(out)
        print('→', out, sheet.size)


if __name__ == '__main__':
    main()
