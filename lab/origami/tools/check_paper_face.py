"""3Dの見た目を、2Dで順算した「正解」と突き合わせる。

★なぜ要るか（2026-09-03）
   check_stack_height は「実測の高さ ＝ 自分で計算した layerOrder」を見ている。
   **自分の計算どうしの照合**なので、layerOrder そのものが間違っていても通る。
   実際、ぶたの4手目は上下が逆になっていて（上に来るはずの紙が下になり、
   鼻が大きな赤い三角に見えていた）、検査16本が全部OKのまま素通りした。
   見つけたのは人間の目だった。

★見ていること
   紙には表（色つき）と裏（白）がある。**折り終わりに見えている面の
   「表の割合」**は、2Dで順算した紙の重なりから一意に決まる。
   同じ割合を、本物のアプリのスクショの画素からも測って突き合わせる。
   位置合わせが要らない（割合どうしの比較）ので、カメラや拡大率に左右されない。

   紙の上下がどこかで1組でも入れかわると、見えている面が変わる＝割合がずれる。

★落ちたときは
   `to_work_js.py` の layer_order（重なりの高さ）を疑う。折り線ではない。
   preview/face_<作品>_<手>.png に、2Dの正解の絵を書き出してある。
"""
import io, sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 9067
sys.path.insert(0, str(HERE))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
import numpy as np
from PIL import Image

from kit import target_works
from fold2d import xf_is_flipped
import works_build as W

TOL = 0.06          # 表の割合のずれの上限（実測の最大は 0.02 だった）
TOPCUT = 130        # スクショの上のほう＝ボタンの帯。ここは見ない


def front_ratio_px(img):
    """画素から「見えている紙のうち、表（色つき）の割合」を出す。"""
    a = np.asarray(img.convert('RGB')).astype(int)[TOPCUT:]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    glow = (r > 200) & (g > 140) & (b < 150)          # つまむ所の光。数えない
    front = (r > 110) & (r - b > 45) & ~glow
    back = (r > 165) & (g > 165) & (b > 165) & (abs(r - b) <= 45)
    n = int(front.sum()) + int(back.sum())
    return (int(front.sum()) / n) if n else None


def render2d(panels, path=None, color_down=False):
    """2Dの正解を、アプリと同じ色で真上から描く。重なりは layer の順に塗る。
       color_down＝色のついた面を下にして始める作品は、表と裏の色を入れかえる
       （アプリ側の `colorDown` と同じ扱いにしないと、この検査が誤って鳴る）。"""
    fig, ax = plt.subplots(figsize=(4, 4), dpi=100)
    fig.patch.set_facecolor('#0a0c16')
    ax.set_facecolor('#0a0c16')
    for p in sorted(panels, key=lambda q: q['layer']):
        back = xf_is_flipped(p['xf'])
        if color_down:
            back = not back
        ax.add_patch(Polygon(p['poly'], closed=True, linewidth=0,
                             facecolor='#ffffff' if back else '#f05a61'))
    ax.set_aspect('equal'); ax.set_xlim(-2.2, 2.2); ax.set_ylim(-2.2, 2.2)
    ax.axis('off')
    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor='#0a0c16')
    plt.close(fig)
    buf.seek(0)
    im = Image.open(buf).copy()
    if path:
        im.save(path)
    return im


SET = """
(a) => {
  const [id, upto] = a;
  const w = window.ORIGAMI_WORKS[id];
  const inst = window._origamiDebug.inst, st = inst.state;
  for (let i = 0; i < st.liveAngle.length; i++) { st.liveAngle[i] = 0; st.committedAngle[i] = 0; }
  st.doneSteps = new Set();
  w.steps.slice(0, upto).forEach((s, i) => {
    st.liveAngle[s.handle.boneId] = s.targetAngle;
    st.committedAngle[s.handle.boneId] = s.targetAngle;
    FOLD.syncLinkedAngle(st, s.handle.boneId, s.targetAngle, s);
    (s.handle.linkedBoneIds || []).forEach(lb => {
      const b = (typeof lb === 'object') ? lb.boneId : lb;
      st.committedAngle[b] = st.liveAngle[b];
    });
    st.doneSteps.add(i);
  });
  st.stepIndex = upto;
  return w.steps.length;
}
"""


def main():
    from playwright.sync_api import sync_playwright
    works = target_works()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    ok_all = True
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 700, 'height': 700})
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(700)
        for name in works:
            st, meta = W.BUILDERS[name]()
            cd = bool(meta.get('color_down'))
            # ★その手の直後（まだ裏返す前）の様子を採る。to_work_js と同じ採り方。
            snaps = {}
            for sn in st.snapshots:
                snaps.setdefault(sn['nfold'], sn)
            n = pg.evaluate("(id)=>{window._origamiDebug.openFold('work', window.ORIGAMI_WORKS[id]);"
                            "return window.ORIGAMI_WORKS[id].steps.length;}", name)
            pg.wait_for_timeout(350)
            bad = []
            for k in range(1, n + 1):
                sn = snaps.get(k)
                if sn is None or sn['nflip'] % 2:
                    continue           # 裏返しをはさんだ時点は、アプリと見る面が違う
                want = front_ratio_px(render2d(sn['panels'], color_down=cd))
                pg.evaluate(SET, [name, k])
                pg.wait_for_timeout(280)
                got = front_ratio_px(Image.open(io.BytesIO(pg.screenshot())))
                if want is None or got is None:
                    continue
                if abs(got - want) > TOL:
                    render2d(sn['panels'], HERE / 'preview' / f'face_{name}_{k}.png',
                             color_down=cd)
                    bad.append(f'{k}手目 表の割合 2Dの正解 {want:.0%} / アプリ {got:.0%}'
                               f'（{got-want:+.0%}）')
            ok_all = ok_all and not bad
            print(('OK  ' if not bad else 'NG  ')
                  + f'{name}: 見えている紙の表裏が2Dの正解と合っているか'
                  + ('' if not bad else f'  … {len(bad)}件'))
            for x in bad:
                print('       ' + x)
        br.close()
    httpd.shutdown()
    print('\n' + ('ALL OK' if ok_all else '★3Dの見た目が2Dの正解と食いちがっている手がある'))
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
