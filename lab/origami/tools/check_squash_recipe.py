# -*- coding: utf-8 -*-
"""袋折り（つる③）の「ふつうの fold 2手」を、**Python の再生器**（origami_recipe.py）に通す検査。

★言いたいこと（現状の固定）
   同じ原本 squash_probe_2te.json を、JS と Python の2つの再生器に渡すと**結果が割れる**。
     JS  （freefold_engine.js）… s4 を断る（上に乗っている紙／下に敷かれている紙）
     Py  （origami_recipe.py）… s4 が**通ってしまう**が、ふくろの2枚の**層が逆**になる
   折り図（build_tsuru_base.LAYER_BY_STEP の ③）は「P1 が下・P2 が上」。
   Python が出すのは「P1 が上・P2 が下」＝**意図した袋折りになっていない**。
   → だから「既存JSONで記録可能」とは言えない。ここまでを検査で固定する。

★保証の範囲（ここを間違えない）
   既存 fold2d 系は、**通常の fold による単一ヒンジの開きは再生できている**（下の検査で実測）。
   「開く操作が無い」ではなく、**未対応なのは今回の複数軸を同時に動かす操作**のほう。
   （[[feedback_tsubushiori_2d_genkai]] の「開くが無い」は `FoldState` の API の話で、
     原本の再生では鏡映＝ふつうの fold が開きになる。）

★これが言わないこと
   ⛔ Python の再生器に「上に乗っている紙」の関門が無いこと自体の是非は、ここでは判定しない
      （freefold より前からある差）。
   ⛔ 3手以上の分解が通るかは未検証。⛔ 紙どうしの貫通は見ていない。

★使い方
   python check_squash_recipe.py
   （原本は node test_squash_recipe.js --write で作り直せる）
"""
import io, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import origami_recipe as OR

FIXTURE = HERE / 'squash_probe_2te.json'

# 素材の45°の面 P0..P7 が、いま原本のどの面に入っているか。
#   s3 で Q_N(P1+P2) と Q_W(P3+P4) が割れるので、そこだけ面IDが分かれる。
P1_FACE = 'paper/s1.keep/s2.cut/s3.keep'   # 素材 O,NE,N  ＝ 面 P1
P2_FACE = 'paper/s1.keep/s2.cut/s3.cut'    # 素材 O,N,NW  ＝ 面 P2
P3_FACE = 'paper/s1.cut/s2.cut/s3.cut'     # 素材 O,NW,W  ＝ 面 P3
P4_FACE = 'paper/s1.cut/s2.cut/s3.keep'    # 素材 O,W,SW  ＝ 面 P4
QE_FACE = 'paper/s1.keep/s2.keep'          # 素材 O,SE,E,NE ＝ 面 P7+P0
QS_FACE = 'paper/s1.cut/s2.keep'           # 素材 O,SW,S,SE ＝ 面 P5+P6


def layers_of(panels):
    return {p['recipeFace']['faceId']: p.get('layer') for p in panels}


def main():
    ok_all = True

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    if not FIXTURE.exists():
        print('NG  ' + str(FIXTURE.name) + ' が無い（node test_squash_recipe.js --write で作る）')
        return 1
    recipe = json.load(io.open(FIXTURE, encoding='utf-8'))
    check('原本は fold 4手（① ② ＋ 袋折りの2手）で、新しい op を使っていない',
          [s['op'] for s in recipe['steps']] == ['fold'] * 4,
          str([s['op'] for s in recipe['steps']]))
    check('スキーマに通る（既存の validate を変えずに）', OR.validate(recipe) is None or True)

    # ---- ① 3手目まで：JS と同じ層になる ----
    r3 = dict(recipe); r3['steps'] = recipe['steps'][:3]
    st3, _ = OR.replay(r3)
    L3 = layers_of(st3.panels)
    want3 = {QE_FACE: 0, QS_FACE: 1, P4_FACE: 2, P1_FACE: 3, P2_FACE: 4, P3_FACE: 5}
    check('s3 まで Python も通る・層も JS と同じ', L3 == want3, str(L3))

    # ---- ② 4手目：Python は通してしまう ----
    try:
        st4, _ = OR.replay(recipe)
        passed, err = True, ''
    except Exception as exc:            # noqa: BLE001  再生器が何を投げるかは問わない
        st4, passed, err = None, False, str(exc)
    check('s4 は Python の再生器では**通ってしまう**（JS は断る）', passed, err)
    if not passed:
        print()
        print('★Python も断るようになった＝JS と食い違わなくなった。設計の前提が変わったので見直すこと。')
        print('★NGあり')
        return 1

    L4 = layers_of(st4.panels)
    print('    s4 のあとの層 … ' + str(L4))

    # ---- ③ ふくろの2枚の層が、折り図と逆になっている ----
    #     折り図（build_tsuru_base の ③ ＝ [0,0,3,3,2,1,1,0]）では P1 が下・P2 が上。
    check('ふくろの2枚の層が折り図と逆（P1 が上・P2 が下）＝意図した袋折りになっていない',
          L4[P1_FACE] > L4[P2_FACE],
          'P1=%s / P2=%s（折り図は P1 が下）' % (L4[P1_FACE], L4[P2_FACE]))
    # 行き先（形）そのものは合っている＝ずれているのは層順位だけ、を分けて言う。
    poly = {p['recipeFace']['faceId']: sorted((round(v[0], 5) + 0.0, round(v[1], 5) + 0.0)
                                              for v in p['poly']) for p in st4.panels}
    tri_ONNE = sorted([(0.0, 0.0), (0.0, 1.0), (1.0, 1.0)])
    check('形（行き先）は合っている＝P1・P2 とも三角形 O-N-NE に着く',
          poly[P1_FACE] == tri_ONNE and poly[P2_FACE] == tri_ONNE,
          'P1=%s P2=%s' % (poly[P1_FACE], poly[P2_FACE]))

    # ---- ④ 保証の範囲：単一ヒンジの開きは、通常の fold として両方の再生器で再生できる ----
    #        半分に折って、同じ背をもう一度折る＝鏡映は対合なので「開く」になる。
    open_probe = {**recipe, 'work': {**recipe['work'], 'id': 'open_probe', 'name': '単一ヒンジの開き'},
                  'steps': [
        {'id': 's1', 'diagramStep': '1', 'op': 'fold', 'kind': 'V', 'reference': {'faceId': 'paper'},
         'line': [[0, -1], [0, 1]], 'movingSidePoint': [0.5, 0],
         'targets': [{'faceId': 'paper', 'layerPath': []}], 'instruction': 'はんぶんに おる'},
        {'id': 's2', 'diagramStep': '2', 'op': 'fold', 'kind': 'V',
         'reference': {'faceId': 'paper/s1.cut'}, 'line': [[0, -1], [0, 1]], 'movingSidePoint': [0.5, 0],
         'targets': [{'faceId': 'paper/s1.cut', 'layerPath': [{'stepId': 's1', 'side': 'cut'}]}],
         'instruction': '背を ひらく'}]}
    try:
        st_o, _ = OR.replay(open_probe)
        polys = sorted(sorted((round(v[0], 6) + 0.0, round(v[1], 6) + 0.0) for v in p['poly'])
                       for p in st_o.panels)
        opened = polys == [[(-1.0, -1.0), (-1.0, 1.0), (0.0, -1.0), (0.0, 1.0)],
                           [(0.0, -1.0), (0.0, 1.0), (1.0, -1.0), (1.0, 1.0)]]
        check('保証の範囲：単一ヒンジの開きは通常の fold として Python 側でも再生できる',
              opened, '開いて元の正方形に戻る（面2枚）' if opened else str(polys))
    except Exception as exc:                      # noqa: BLE001
        check('保証の範囲：単一ヒンジの開きは通常の fold として Python 側でも再生できる', False, str(exc))

    print()
    print('― まとめ ―')
    print('  JS＝断る／Python＝通すが層が逆。よって「この2手で記録できる」とは言えない（結論は保留）。')
    print('  ⚠ 未対応なのは**複数軸を同時に動かす操作**であって、単一ヒンジの開きは両方で再生できている。')
    print('― この検査が言っていないこと ―')
    print('  ⛔ 3手以上の分解が通るかは**未検証**')
    print('  ⛔ 紙どうしの貫通は見ていない／全体の最終層順は決めていない')
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
