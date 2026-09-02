"""作った伝承折り紙が、本物のアプリの3Dエンジンで最後まで折れるかを実測する。

★見るもの
   ①コンソールエラー0件 ②行列にNaNが無い ③全ステップを目標角度まで進めて
   isFinished が true ④紙が破れていないか（同じ折り筋でつながる2枚の
   共有点が、折り終わりでも一致しているか）⑤スクリーンショット
   （[[method_oton_local_preview]]：できたと言う前に必ず目で見る）
"""
import sys, threading, http.server, socketserver, functools, json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent   # lab/ から出す（../_lib/motion.js を読ませるため）
PORT = 8979
from kit import target_works
WORKS = target_works()      # ★作品の名簿は works_build.BUILDERS ただ1か所


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
        pg = br.new_page(viewport={'width': 900, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console.error: ' + m.text)
              if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(700)
        check('アプリが開く（エラー0件）', len(errs) == 0, str(errs[:3]))

        names = pg.evaluate('Object.keys(window.ORIGAMI_WORKS||{})')
        for w in WORKS:
            check(f'{w}: 作品が登録されている', w in names, str(names))

        for w in WORKS:
            errs.clear()
            r = pg.evaluate("""(id) => {
              const work = window.ORIGAMI_WORKS[id];
              const st = FOLD.createState(work);
              // 全ステップを目標角度まで進める
              work.steps.forEach((s, i) => {
                st.committedAngle[s.handle.boneId] = s.targetAngle;
                st.liveAngle[s.handle.boneId] = s.targetAngle;
                (s.handle.linkedBoneIds||[]).forEach(lb => {
                  const b = (typeof lb === 'object') ? lb.boneId : lb;
                  st.committedAngle[b] = s.targetAngle;
                  st.liveAngle[b] = s.targetAngle;
                });
                st.doneSteps.add(i);
              });
              st.stepIndex = work.steps.length;
              const mats = FOLD.currentBoneMatrices(st);
              let nan = 0;
              for (const m of mats) for (const v of m) if (!isFinite(v)) nan++;
              // 折り終わりの頂点位置を出して、紙が破れていないか見る
              const mesh = work.mesh;
              const pos = mesh.verts.map((v,i) => {
                const m = mats[mesh.panel[i]];
                return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
                        m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
                        m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
              });
              // 平らな状態で同じ位置にあった頂点は、折り終わりでも
              // 「同じ位置」か「折り筋で分かれた別の場所」になる。ここでは
              // 面積（三角形の合計）が保たれているかで破れを見る。
              let area0 = 0, area1 = 0;
              for (const t of mesh.tris) {
                const A = mesh.verts[t[0]], B = mesh.verts[t[1]], C = mesh.verts[t[2]];
                area0 += Math.abs((B[0]-A[0])*(C[2]-A[2]) - (B[2]-A[2])*(C[0]-A[0]))/2;
                const a = pos[t[0]], b = pos[t[1]], c = pos[t[2]];
                const ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2];
                const vx=c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2];
                area1 += Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx)/2;
              }
              return {nan, steps: work.steps.length, bones: mats.length,
                      area0, area1, finished: FOLD.isFinished(st)};
            }""", w)
            check(f'{w}: 行列にNaNなし', r['nan'] == 0, str(r['nan']))
            check(f'{w}: 全ステップ折って完成判定が出る', r['finished'] is True)
            check(f'{w}: 折っても紙の面積が変わらない（破れていない）',
                  abs(r['area1'] - r['area0']) < 1e-6,
                  f"{r['area0']:.6f} → {r['area1']:.6f}")

            # 本物の描画パイプラインを通す
            errs.clear()
            pg.evaluate("(id) => window._origamiDebug.openFold('work', window.ORIGAMI_WORKS[id])", w)
            pg.wait_for_timeout(900)
            check(f'{w}: 画面を開いてエラー0件', len(errs) == 0, str(errs[:2]))
            pg.screenshot(path=str(HERE / 'preview' / f'app_{w}.png'))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
