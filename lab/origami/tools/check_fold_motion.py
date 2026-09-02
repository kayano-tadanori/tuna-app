"""折っている「途中」の動きを、ブラウザの実エンジンで1コマずつ測る。

★なぜ要るか
   これまでの検査は「折り終わりの形」しか見ていなかった。
   本人指摘「チューリップの2手目 紙が両方にひらく」「ヒンジでつながってるのに
   両側にひらく」は、折り終わりでは同じ形になるので**まったく引っかからない**。
   途中の角度で測らないと出ない不具合がある。

★測ること（1手ごと、角度を0→πまで刻んで）
   ① 同じ手で動く骨が、みんな同じ向きに動いているか
      （＝いちばん遠い頂点のYの符号がそろっているか。バラバラ＝両側にひらく）
   ② ヒンジがちゃんとつながっているか
      （＝骨と親が共有する折り線の2点が、どの角度でも同じ場所にあるか）
   ③ 途中で紙の面積が変わらないか（剛体なので変わってはいけない）
   ④ 物理エンジン(cloth.js)を使っていないこと
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 8989
from kit import target_works
WORKS = target_works()      # ★作品の名簿は works_build.BUILDERS ただ1か所


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


JS = r"""
(id) => {
  const work = window.ORIGAMI_WORKS[id];
  const st = FOLD.createState(work);
  const M = work.mesh;
  const apply = (m, v) => [
    m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
    m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
    m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
  const out = { usePhysics: !!work.usePhysics, steps: [] };

  work.steps.forEach((s, si) => {
    const ids = [s.handle.boneId].concat(
      (s.handle.linkedBoneIds || []).map(lb => (typeof lb === 'object') ? lb.boneId : lb));
    const rec = { id: si, bones: ids, ySign: [], hingeGap: 0, area: [] };
    for (let k = 1; k <= 7; k++) {
      const t = (k / 8) * s.targetAngle;
      ids.forEach(b => { st.liveAngle[b] = t; });
      const mats = FOLD.currentBoneMatrices(st);

      // ① 動いている骨それぞれの「ヒンジからいちばん遠い頂点」のY
      if (k === 4) {
        ids.forEach(b => {
          const h = M.hinge[b];
          let far = null, fd = -1;
          for (let i = 0; i < M.verts.length; i++) {
            if (M.panel[i] !== b) continue;
            const v = M.verts[i];
            const dx = v[0]-h.origin[0], dz = v[2]-h.origin[2];
            const d = Math.abs(h.axis[2]*dx - h.axis[0]*dz);
            if (d > fd) { fd = d; far = v; }
          }
          rec.ySign.push(far ? Math.round(apply(mats[b], far)[1] * 1000) / 1000 : null);
        });
      }

      // ② ヒンジがつながっているか：折り線の2点を「その骨」と「親」の両方で
      //    world座標にして、ずれを測る（ヒンジ上の点なので一致するはず）
      ids.forEach(b => {
        const h = M.hinge[b];
        const par = M.boneParent[b];
        if (par < 0) return;
        for (const tt of [0, 1]) {
          const p = [h.origin[0] + h.axis[0]*tt, 0, h.origin[2] + h.axis[2]*tt];
          const a = apply(mats[b], p), c = apply(mats[par], p);
          rec.hingeGap = Math.max(rec.hingeGap,
            Math.hypot(a[0]-c[0], a[1]-c[1], a[2]-c[2]));
        }
      });

      // ③ 面積
      let area = 0;
      for (const tri of M.tris) {
        const A = apply(mats[M.panel[tri[0]]], M.verts[tri[0]]);
        const B = apply(mats[M.panel[tri[1]]], M.verts[tri[1]]);
        const C = apply(mats[M.panel[tri[2]]], M.verts[tri[2]]);
        const ux=B[0]-A[0], uy=B[1]-A[1], uz=B[2]-A[2];
        const vx=C[0]-A[0], vy=C[1]-A[1], vz=C[2]-A[2];
        area += Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx)/2;
      }
      rec.area.push(Math.round(area*1e6)/1e6);
    }
    // 折り終わったことにして次の手へ
    ids.forEach(b => { st.liveAngle[b] = s.targetAngle; st.committedAngle[b] = s.targetAngle; });
    st.doneSteps.add(si);
    out.steps.push(rec);
  });
  return out;
}
"""


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    ok_all = True

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 600, 'height': 600})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)

        for w in WORKS:
            r = pg.evaluate(JS, w)
            check(f'{w}: 物理エンジンを使っていない（剛体ヒンジだけ）',
                  r['usePhysics'] is False)
            bad_dir, bad_hinge, bad_area = [], [], []
            for s in r['steps']:
                ys = [y for y in s['ySign'] if y is not None]
                if len(ys) > 1:
                    pos = [y for y in ys if y > 1e-6]
                    neg = [y for y in ys if y < -1e-6]
                    if pos and neg:
                        bad_dir.append((s['id'] + 1, ys))
                if s['hingeGap'] > 1e-9:
                    bad_hinge.append((s['id'] + 1, s['hingeGap']))
                if max(s['area']) - min(s['area']) > 1e-5:
                    bad_area.append((s['id'] + 1, min(s['area']), max(s['area'])))
            check(f'{w}: 同じ手の紙が全部おなじ向きに動く（両側にひらかない）',
                  not bad_dir, str(bad_dir))
            check(f'{w}: 折る途中も、どの手もヒンジがつながっている',
                  not bad_hinge, str(bad_hinge))
            check(f'{w}: 折る途中も紙の面積が変わらない', not bad_area, str(bad_area))
        check('エラー0件', len(errs) == 0, str(errs[:3]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
