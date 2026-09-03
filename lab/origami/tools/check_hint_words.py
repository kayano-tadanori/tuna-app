"""ヒントの文と、画面で実際に起きることが合っているかを実測する。

★なぜ要るか（本人指摘 2026-09-03「すいかの2手目がおかしい／検査ちゃんと効いてないのかな」）
   すいかの2手目は「上のまん中から、**下の左**のかどへ ななめに折る」と書いてあるのに、
   画面では**右**の角が、しかも**後ろへ**回りこんで消えていた。
   それまでの検査は8本とも ALL OK だった。形も重なりも折れる順番も正しかったからで、
   **文と絵が食いちがっていること**を見ている検査が1本も無かった。

   原因は折り図の書きうつし方。折り図に「うらがえす」がある作品は、そこから先の絵が
   **裏から見た絵**になる。ところがこのアプリは紙をうらがえさない
   （to_work_js の「★裏返し(flip)について」）ので、
     ・折り図で「左」に見える角は、画面では「右」に出る
     ・折り図で「手前へ折る」角は、画面では「後ろへ」回りこむ
   の2つが同時にずれる。子どもは文しか読まないので、これは丸ごと嘘になる。

★見ていること（どれも実測。作品ごとに正解を書き並べたりしない）
   ① 左右   ヒントの中で最初に出てくる「左」「右」が、その手でつまむ場所と合っているか
            （つまむ場所＝steps[].handle.local。メッシュは画面の向きで書かれている）
   ② 前後   その手で紙が下へ回りこむ（＝画面から消える）なら、ヒントに「後ろ」と
            書いてあるか。逆に手前へ来るのに「後ろ」と書いていないか。
            折る前と折ったあとで、つまむ点の高さを実測して決める。
   ③ 高さ0  折ったのに高さが1枚ぶんも変わらない手。土台と同じ高さ＝ちらつく
            （ハートの2手目で実際に縞模様が出ていた）。
   ④ うらがえし  ヒントに「うらがえ」「裏返」と書かない。アプリは紙をうらがえさないので、
            そう書くと子どもは実物とアプリで違うことをすることになる。

★直し方
   折り線は触らない（[[feedback_origami_fufuritsu]]②）。works_build.py の
   **手順のほう**を、うらがえしを使わない書き方（'M'＝後ろへ折る）に直して
   `python works_build.py <作品>` で作り直す。すいかがその実例。
"""
import sys, threading, http.server, socketserver, functools, re
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 9063
sys.path.insert(0, str(HERE))
from kit import target_works

URA = re.compile('後ろ|うしろ')
FLIP_WORD = re.compile('うらがえ|裏返')
LR = re.compile('[左右]')

JS = r"""
(id) => {
  const w = window.ORIGAMI_WORKS[id];
  window._origamiDebug.openFold('work', w);
  const inst = window._origamiDebug.inst;
  inst.setThickness(9);
  const st = inst.state;
  const ap = (m, v) => [m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12],
                        m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13],
                        m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]];
  const apply = (upto) => {
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
  };
  const out = [];
  w.steps.forEach((s, i) => {
    apply(i);
    const p0 = ap(FOLD.currentBoneMatrices(st)[s.handle.boneId], s.handle.local);
    apply(i + 1);
    const p1 = ap(FOLD.currentBoneMatrices(st)[s.handle.boneId], s.handle.local);
    out.push({ hint: s.hintLabel || '', grabX: s.handle.local[0],
               dy: (p1[1] - p0[1]) / inst.debugThickness() });
  });
  return out;
}
"""


def judge(rows):
    """1作品ぶんの実測から、文と合っていない手を挙げる。"""
    bad = []
    for i, r in enumerate(rows):
        no, hint, dy, gx = i + 1, r['hint'], r['dy'], r['grabX']
        # ① 左右
        m = LR.search(hint)
        if m and abs(gx) > 0.05:
            side = '右' if gx > 0 else '左'
            if m.group(0) != side:
                bad.append(f'{no}手目 左右ズレ：文は「{m.group(0)}」だが'
                           f'つまむ所は画面の{side}（x={gx:+.2f}）／{hint}')
        # ③ 高さが変わらない＝土台と同じ高さでちらつく
        if abs(dy) < 0.01:
            bad.append(f'{no}手目 高さ0：折っても重なりの高さが変わらない'
                       f'（ちらつく）／{hint}')
        # ② 前後
        else:
            back, said = dy < 0, bool(URA.search(hint))
            if back and not said:
                bad.append(f'{no}手目 後ろ抜け：紙は後ろへ回りこむ（dy={dy:+.1f}枚）のに'
                           f'ヒントにそう書いていない／{hint}')
            if (not back) and said:
                bad.append(f'{no}手目 後ろ余分：紙は手前へ来る（dy={dy:+.1f}枚）のに'
                           f'ヒントは「後ろ」と書いている／{hint}')
        # ④ うらがえしは書かない（アプリは紙をうらがえさない）
        if FLIP_WORD.search(hint):
            bad.append(f'{no}手目 うらがえし：アプリは紙をうらがえさない。'
                       f'「後ろへ折る」に書きかえる／{hint}')
    return bad


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
        pg = br.new_page(viewport={'width': 420, 'height': 480})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)
        for w in works:
            errs.clear()
            rows = pg.evaluate(JS, w)
            bad = judge(rows) if not errs else [f'ページのエラー: {errs[0]}']
            ok_all = ok_all and not bad
            print(('OK  ' if not bad else 'NG  ') + f'{w}: ヒントの文と画面が合っているか'
                  + ('' if not bad else f'  … {len(bad)}件'))
            for b in bad:
                print('       ' + b)
        br.close()
    httpd.shutdown()
    print('\n' + ('ALL OK' if ok_all else '★ヒントの文と画面が食いちがっている手がある'))
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
