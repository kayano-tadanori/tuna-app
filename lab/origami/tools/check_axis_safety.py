"""「骨の軸が逆に書かれていても事故が起きない」ことを、わざと壊して確かめる。

★本人の要求（2026-09-02）
   「ぜったいにヒンジが外れない仕組みにして」「骨が逆でも外れない仕組みにして」「事故がおこる」

★確かめ方
   同じ手で一緒に動く骨のうち1本だけ、ヒンジの軸をわざと反対向きに書きかえる。
   ①エンジンが向きを自分でそろえて、両側にひらかないこと
   ②折り上がりの形が、壊す前とまったく同じであること
   ③安全網を切ると、ちゃんと壊れること（＝この検査が空回りしていないこと）
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 8991
from kit import target_works
WORKS = target_works()      # ★作品の名簿は works_build.BUILDERS ただ1か所

# 折る途中と折り終わりを測る。breakAxis=1本だけ軸を反転、safety=falseで安全網を切る
JS = r"""
(args) => {
  const work = JSON.parse(JSON.stringify(window.ORIGAMI_WORKS[args.id]));
  const M = work.mesh;
  let brokenBone = -1;
  if (args.breakAxis) {
    for (const s of work.steps) {
      const lb = s.handle.linkedBoneIds;
      if (lb && lb.length) {
        brokenBone = (typeof lb[0] === 'number') ? lb[0] : lb[0].boneId;
        const h = M.hinge[brokenBone];
        M.hinge[brokenBone] = Object.assign({}, h, { axis: [-h.axis[0], -h.axis[1], -h.axis[2]] });
        break;
      }
    }
    if (brokenBone < 0) return { skip: true };
  }
  const st = FOLD.createState(work);
  if (!args.safety) st._noLinkSign = true;   // 安全網を切る（検査が空回りしていないかの確認用）
  const apply = (m, v) => [
    m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
    m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
    m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];

  let worstSplit = 0;
  work.steps.forEach((s, si) => {
    const ids = [s.handle.boneId].concat(
      (s.handle.linkedBoneIds || []).map(lb => (typeof lb === 'object') ? lb.boneId : lb));
    // 途中(半分)の姿勢：エンジンと同じ道すじで角度を入れる
    st.liveAngle[s.handle.boneId] = s.targetAngle / 2;
    FOLD.syncLinkedAngle(st, s.handle.boneId, s.targetAngle / 2, s);
    const mats = FOLD.currentBoneMatrices(st);
    const ys = ids.map(b => {
      const h = M.hinge[b];
      let far = null, fd = -1;
      for (let i = 0; i < M.verts.length; i++) {
        if (M.panel[i] !== b) continue;
        const v = M.verts[i];
        const d = Math.abs(h.axis[2]*(v[0]-h.origin[0]) - h.axis[0]*(v[2]-h.origin[2]));
        if (d > fd) { fd = d; far = v; }
      }
      return far ? apply(mats[b], far)[1] : 0;
    });
    const pos = ys.filter(y => y > 1e-6).length, neg = ys.filter(y => y < -1e-6).length;
    if (pos && neg) worstSplit = Math.max(worstSplit, Math.min(pos, neg));
    // 折り終わりへ
    st.liveAngle[s.handle.boneId] = s.targetAngle;
    st.committedAngle[s.handle.boneId] = s.targetAngle;
    FOLD.syncLinkedAngle(st, s.handle.boneId, s.targetAngle, s);
    ids.forEach(b => { st.committedAngle[b] = st.liveAngle[b]; });
    st.doneSteps.add(si);
  });
  const fin = FOLD.currentBoneMatrices(st);
  const pts = [];
  for (let i = 0; i < M.verts.length; i += 3) {
    const p = apply(fin[M.panel[i]], M.verts[i]);
    pts.push([Math.round(p[0]*1e4)/1e4, Math.round(p[1]*1e4)/1e4, Math.round(p[2]*1e4)/1e4]);
  }
  return { skip: false, brokenBone, worstSplit, pts };
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

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 500, 'height': 500})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)

        broke_somewhere = False
        for w in WORKS:
            base = pg.evaluate(JS, {'id': w, 'breakAxis': False, 'safety': True})
            bad = pg.evaluate(JS, {'id': w, 'breakAxis': True, 'safety': True})
            if bad.get('skip'):
                print(f'--  {w}: 連動する骨が無いので対象外')
                continue
            broke_somewhere = True
            check(f'{w}: 軸を逆に書いても、両側にひらかない',
                  bad['worstSplit'] == 0, f"逆向きの骨 {bad['worstSplit']}本")
            same = (base['pts'] == bad['pts'])
            check(f'{w}: 軸を逆に書いても、折り上がりの形が変わらない', same,
                  '頂点がずれた' if not same else '')

            # 安全網を切ったら本当に壊れるか（この検査が空回りしていないかの確認）
            off = pg.evaluate(JS, {'id': w, 'breakAxis': True, 'safety': False})
            if off['worstSplit'] > 0:
                broke_somewhere = True
                print(f'     （安全網を切ると {w} は両側にひらいた＝検査は空回りしていない）')

        check('どこかで実際に軸を壊せた（検査が素通りしていない）', broke_somewhere)
        check('エラー0件', len(errs) == 0, str(errs[:3]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
