"""灘中対策コーナーの問題が、画面で正しく描かれているかを実測する。

★なぜ要るか（2026-09-03、本人「折り紙問題の方の 重ね合わせの問題がバグるようになった」）
   紙に厚みを持たせた実装の中に「折り目の段差をふさぐ帯」を張る処理があり、
   その「この辺は折り目の上か」の判定式が、**軸が縦向き（＝紙を回す動き）**の
   ときに 0 < 1e-6 となって常に真になっていた。
   結果、紙のふち全部が折り目あつかいになり、回した紙と土台の間に帯が
   大量に張られて、正方形が多角形にふくらんで見えた。
   → **問題の図は「かたちがそのまま答え」なので、余分な面が1枚でも増えたら不具合。**

★この検査が素通りしていないかの確かめ方（2026-09-03に実際にやった）
   renderer.js の thickenMesh から「軸が縦なら帯を張らない」の2行を消した版を
   別フォルダに作り、ORIGAMI_ROOT=そのフォルダ で流すと NG が7件出る。
   ⚠ `if (axH < 1e-6) continue;` だけ消しても、割り算のほうが残っていると
     0で割って Infinity になり、たまたま直ったままになる（1回それで騙された）。

★見るもの（問題ぜんぶについて）
   ① 開いてエラーが出ないこと
   ② 紙に厚みが付いていること（本人指示2026-09-05で 0→1固定 に変えた）
      厚み0だと折り返した紙が土台と**同じ高さ**に置かれ、重なった所で土台が
      描画に勝つ＝裏返した紙が表の色に見えた（本人「裏返った紙の色が表の紙の
      色と一緒になる」）。ふくらみの再発の見張りは③④が受け持つ。
   ③ 「回すだけ」の問題では、巻きこみの帯が1本も張られていないこと
   ④ 折る問題でも、帯の数が折り目の骨の数を超えないこと
   ⑤ 折る問題は、折り終わりに紙がちゃんと持ち上がっていること
      （renderer.js の初期化で updateLayers の呼び出しが抜けていて、
        **最初に開いた1つ目だけ**層が全部0のままだった。2つ目以降は setWork が
        呼ぶので直っており、通しで開く検査では気づけなかった＝1つずつ開き直して見る）
"""
import os, sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
# ★検査そのものを点検するとき用：わざと壊した版を差して「ちゃんと鳴るか」を見る
ROOT = Path(os.environ.get('ORIGAMI_ROOT') or HERE.parent.parent)
PORT = 9051

JS = r"""
(id) => {
  const w = window.ORIGAMI_PROBLEMS[id];
  window._origamiDebug.openFold('problem', w);
  const inst = window._origamiDebug.inst;
  const hinge = (w.mesh && w.mesh.hinge) || [];
  let vertical = 0, horizontal = 0;
  for (let b = 0; b < hinge.length; b++) {
    const h = hinge[b];
    if (!h || !h.axis) continue;
    const par = (w.mesh.boneParent || [])[b];
    if (par === undefined || par < 0) continue;
    if (Math.hypot(h.axis[0], h.axis[2]) < 1e-6) vertical++; else horizontal++;
  }
  // 折り終わりまで折って、層がちゃんと持ち上がるかを見る
  (w.steps || []).forEach(st => { inst.state.liveAngle[st.handle.boneId] = st.targetAngle; });
  const layers = inst.debugLayers ? inst.debugLayers() : null;
  return { vertical, horizontal,
           thickness: inst.debugThickness ? inst.debugThickness() : null,
           layerMax: layers ? Math.max.apply(null, Array.from(layers)) : null,
           stats: inst.debugThickenStats ? inst.debugThickenStats() : null };
}
"""


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    ok_all = True
    ng = []

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        if not ok:
            ng.append(f'NG  {name}' + ((' … ' + extra) if extra else ''))

    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 500, 'height': 600})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(800)

        ids = pg.evaluate("() => Object.keys(window.ORIGAMI_PROBLEMS || {})")
        print(f'灘中対策の問題 {len(ids)}問を見る')
        n_rot = 0
        for pid in ids:
            errs.clear()
            r = pg.evaluate(JS, pid)
            pg.wait_for_timeout(120)
            check(f'{pid}: 開いてエラー0件', not errs, str(errs[:1]))
            check(f'{pid}: 紙に厚みが付いている', r['thickness'] > 0, str(r['thickness']))
            st = r['stats'] or {}
            hem = st.get('hem')
            if r['horizontal'] == 0:
                n_rot += 1
                check(f'{pid}: 回すだけの問題なのに巻きこみの帯が張られている',
                      hem == 0, f"帯{hem}本（折り目の骨0本）")
            else:
                check(f'{pid}: 帯の数が折り目の骨の数を超えている',
                      hem is not None and hem <= r['horizontal'],
                      f"帯{hem}本 / 折り目の骨{r['horizontal']}本")
                # ⑤ 折り終わりに紙が持ち上がっていないと、折り返した紙が土台と
                #    同じ高さになり、重なった所で裏の色が出ない
                check(f'{pid}: 折り終わりに紙が持ち上がっていない',
                      (r['layerMax'] or 0) > 0, f"層の最大 {r['layerMax']}")
        print(f'  うち「回すだけ」の問題は {n_rot}問')
        br.close()
    httpd.shutdown()
    for line in ng:
        print(line)
    print()
    print('ALL OK' if ok_all else f'★NG {len(ng)}件')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
