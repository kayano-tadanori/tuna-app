"""伝承折り紙を「実際の折り方どおり順算」で組み立て、
   ①折線(展開図) ②3Dエンジン用のJS を作る。

★方針（[[method_origami_cp_derivation]]§10）
   完成形から折線を逆算しない。実際の手順を1手ずつ2D平面で折って、
   その結果として出てきた折線を使う。だから「その通りに折れる」ことが
   作りかたから保証される。前の鶴(完成形から逆算)が紙で折れなかった失敗の反省。

★使い方
   python works_build.py          … 全部作って preview/ に画像、js/works/ にJS
   python works_build.py inu      … 1つだけ
"""
import sys, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.family'] = ['MS Gothic', 'Yu Gothic', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False

from fold2d import FoldState
import cp_export, viz_work, to_work_js

HERE = Path(__file__).parent
PREV = HERE / 'preview'
WORKS = HERE.parent / 'js' / 'works'

ok_all = True
def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('  OK  ' if ok else '  NG  ') + name + ((' … ' + extra) if extra else ''))


def verify(st, label, expect_panels=None):
    """紙が消えていないか・展開図と食いちがっていないかを毎回みる。"""
    segs = cp_export.state_to_segments(st)
    g = cp_export.build_planar_graph(segs)
    faces = cp_export.extract_faces(g)
    paper = 4 * st.paper['hw'] * st.paper['hh']
    check(f'{label}: 面積が原紙と同じ', abs(st.total_area() - paper) < 1e-9,
          f'{st.total_area():.9f} / {paper}')
    check(f'{label}: 紙の枚数={len(st.panels)} と 展開図の面の枚数={len(faces)} が一致',
          len(st.panels) == len(faces))
    bad = cp_export.check_flat_foldability(g)
    # ★「一部の層だけ折る」手がある作品では、折り筋が紙の途中で終わる。
    #   Kawasaki/Maekawa は「1枚の紙の全層を貫く折り筋」を前提にした定理なので、
    #   そのままでは当てはまらない（誤検出になる）。参考表示にとどめる。
    partial = any(s.get('partial') for s in st.steps)
    if partial:
        print(f"   （{label}: 一部の層だけ折る手があるので Kawasaki/Maekawa は参考値。"
              f"引っかかった頂点 {len(bad)}か所）")
    else:
        check(f'{label}: 折れない頂点なし', len(bad) == 0,
              '; '.join(f"({b['xy'][0]:.3f},{b['xy'][1]:.3f}) {b['detail']}" for b in bad[:3]))
    if expect_panels is not None:
        check(f'{label}: 紙の枚数が想定どおり({expect_panels})',
              len(st.panels) == expect_panels, str(len(st.panels)))
    return g


# ==================================================================== いぬ
def build_inu():
    """いぬ（犬の顔）4手。正方形をひし形に見立てて折る。
       1. 対角線で半分（三角形。折り目が上、とがった所が下＝あご）
       2-3. 上の左右の角を、辺の3等分点をむすんだ線で下へ折る＝たれ耳
       4. 下のとがった所を少し上へ折る＝鼻先
    """
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='対角線で半分に折る')
    # ★たれ耳：角を「辺の少し外」へ送ると、耳が横にはみ出して犬らしくなる。
    #   辺の上に着地させると耳が中に収まってしまい、ただ角を落としただけに見える
    #   （2026-09-02、最初そう作って絵を見て気づいた）。
    #   行き先は6通り描いて見比べて決めた（preview/inu_variants.png）。
    #   回転座標 u=0.9(上辺に沿って) w=1.05(下向き) が一番犬に見えた。
    T1 = _ro(A, 0.9, 1.05)
    st.fold_by_points(A, T1, 'V', only_containing=None,
                      name='左の角を折り下げる（たれ耳）')
    st.fold_by_points(C, (-T1[1], -T1[0]), 'V', only_containing=None,
                      name='右の角を折り下げる（たれ耳）')
    # あご：下のとがった所を上へ
    R1 = (B[0] + (A[0]-B[0])*0.25, B[1])                  # (0.5,-1)
    R2 = (B[0], B[1] + (C[1]-B[1])*0.25)                  # (1,-0.5)
    st.fold_axiom_line((R1, R2), 'V', only_containing=None, cut_hint=B,
                       name='下のとがった所を上へ折る（鼻）')
    hints = {0: '対角線で半分に折って三角にする',
             1: '左の角を下へ折る（たれ耳）',
             2: '右の角を下へ折る（たれ耳）',
             3: '下のとがった所を少し上へ折る（鼻）'}
    return st, dict(work_id='inu', name='いぬ', emoji='🐶', difficulty=2,
                    hints=hints, rotate_deg=-45)


# ==================================================================== コップ
def build_koppu():
    """コップ 5手。本当に水が入る。
       1. 対角線で半分（三角形。とがった所が上）
       2. 右の角を、左の辺の中点に合わせて折る
       3. 左の角を、右の辺の中点に合わせて折る
       4-5. 上に残った三角を、手前と後ろに1枚ずつ折り下げる
    """
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='対角線で半分に折る')
    # ★どこまで折るか＝比率 s は「折った角の先が、もう一方の折り線の端に
    #   ぴったり来る」条件から出した。左の辺を s の位置に着地させるとき、
    #   もう一方の折り線が反対の辺を切る位置は -(s-1)^2。
    #   1-2s = -(s-1)^2  →  s^2-4s+2=0  →  s = 2-√2 = 0.58579…
    #   これでコップの口が水平にそろい、角がはみ出さない（勘で1/2にすると
    #   両脇に羽が出てコップにならない。2026-09-02、手順の絵を見て気づいた）。
    k = 2 - math.sqrt(2)
    P  = (1, 1 - 2*k)          # 右の角の行き先（左の辺の上）
    Pd = (-P[1], -P[0])        # 左の角の行き先（y=-x で鏡映＝三角形の対称軸）
    st.fold_by_points(A, P, 'V', only_containing=None,
                      name='右の角を左の辺へ')
    st.fold_by_points(C, Pd, 'V', name='左の角を右の辺へ')
    # 上に残った三角の付け根＝2つの角の着地点をむすぶ線（見た目では水平）
    S1, S2 = Pd, P
    # ★手前／うらの1枚はエンジンに判定させる（fold_layers）
    st.fold_layers(S1, S2, 'V', count=1, side='top', cut_hint=B,
                   name='上の三角を手前に折り下げる')
    st.fold_layers(S1, S2, 'M', count=1, side='bottom', cut_hint=B,
                   name='上の三角を後ろに折り下げる')
    hints = {0: '対角線で半分に折って三角にする',
             1: '右の角を、左の辺にとどくまで折る',
             2: '左の角も、右の辺にとどくまで折る（口が水平になる）',
             3: '上に残った三角を、手前に1枚折り下げる',
             4: 'うら側の1枚も、後ろに折り下げる'}
    # ⚠ふきかけバー（💨）は 2026-09-03 に本人判断で取りやめ（「難工事なんはわかった やめよ」）。
    #   紙を袋としてふくらませる仕組み（見えないボール／枚数でかたさ）は
    #   エンジン側に残してあるが、印(inflate)を付けないので動かない。
    return st, dict(work_id='koppu', name='コップ', emoji='🥤', difficulty=2,
                    hints=hints, rotate_deg=135)


# ==================================================================== きつね
def build_kitsune():
    """きつねの顔 4手。★おりがみくらぶ easy/animal-face/fox の折り図どおり。
       ① 対角線で半分に折る（底辺が下・とがった所が上の三角形）
       ② まん中に折り目をつけてもどす（耳を折るときの目印）
       ③ 上のとがった所を、底辺のまん中へ折り下げる → 台形
       ④⑤ 底辺の左右の角を、まん中から上へ折り上げる → 耳
    """
    R = 135                      # とがった所を上に見せる（コップと同じ向き）
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='対角線で半分に折る')
    M = (0.0, 0.0)               # 底辺（1手目の折り目）のまん中
    st.crease_only(M, B, 'V', name='まん中に折り目をつけてもどす')
    # ★折り図(パネル③)の点線は、三角形の高さのちょうど半分ではなく少し上。
    #   だから折り下げたとがった所は底辺に届かず、耳のあいだにすきまができる。
    T = (M[0] + (B[0] - M[0]) * 0.06, M[1] + (B[1] - M[1]) * 0.06)
    st.fold_by_points(B, T, 'V', only_containing=None,
                      name='上のとがった所を下へ折る')
    # 耳：折り線は「折り下げた辺のはし」から「折り下げた頂点(=底辺のまん中)」へ。
    #   ★折り図(パネル④)の点線を拡大して測ると、ちょうど②でつけた
    #     まん中の折り目と重なる線だった。
    # ★耳のあいだのすきま。折り図(パネル⑤)で、耳の先は菱形の幅の 2割ほど
    #   離れている。そこから逆算すると、折り線はまん中の折り目から u=0.2
    #   ずれた所を通る（u=0 だと耳がぴったりくっついて、きつねに見えない）。
    u = 0.1
    st.fold_axiom_line(((0, -1), (u, u)), 'V', only_containing=None, cut_hint=A,
                       name='左の角を上へ折り上げる（耳）')
    st.fold_axiom_line(((1, 0), (-u, -u)), 'V', only_containing=None, cut_hint=C,
                       name='右の角を上へ折り上げる（耳）')
    st.flip('v', name='うらがえす')
    hints = {0: '対角線で半分に折って三角にする',
             1: 'まん中に折り目をつけてもどす',
             2: '上のとがった所を、底辺のまん中へ折り下げる',
             3: '左の角を、まん中から上へ折り上げる（耳）',
             4: '右の角を、まん中から上へ折り上げる（耳）',
             5: 'うらがえして、かおを かいたら できあがり'}
    return st, dict(work_id='kitsune', name='きつね', emoji='🦊', difficulty=2,
                    hints=hints, rotate_deg=R)


# ==================================================================== うさぎ
def build_usagi():
    """うさぎの顔 5手。★おりがみくらぶ easy/animal-face/rabbit の折り図どおり。
       ① 対角線で半分に折る（底辺が下・とがった所が上の三角形）
       ② まん中に折り目をつけてもどす
       ③ 底辺の細い帯を上へ折る
       ④⑤ 左右の下の角を、まん中にむけて折り上げる → 耳が立つ
       ⑥ うらがえして顔をかく

    ★折り線の読み方（2026-09-03に確立）
      折り図の点線を「見えている向きの座標」で読む（三角形のとがった所を
      (0,1.414)、底辺の左右を (±1.414,0) とした比率）。それを disp() で
      紙の座標に戻す。紙の座標のまま考えると図と向きが合わず、何度もはずす。
    """
    R = 135
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='対角線で半分に折る')
    st.crease_only((0, 0), B, 'V', name='まん中に折り目をつけてもどす')
    # ③ 底辺(A-C)に平行な線で、細い帯を上へ折る
    st.fold_axiom_line(((0, -0.2), (1, 0.8)), 'V', only_containing=None, cut_hint=(0, 0),
                       name='下のはしを細く上へ折る')
    # ④⑤ 耳。折り図の点線＝三角形の辺の途中から、まん中の下へ引いた線
    P, Q = (-0.55, 0.75), (0.0, 0.24)
    st.fold_axiom_line((disp(R, *P), disp(R, *Q)), 'V', only_containing=None,
                       cut_hint=disp(R, -1.2, 0.1), name='左の角を上へ折る（耳）')
    st.fold_axiom_line((disp(R, -P[0], P[1]), disp(R, *Q)), 'V', only_containing=None,
                       cut_hint=disp(R, 1.2, 0.1), name='右の角を上へ折る（耳）')
    st.flip('v', name='うらがえす')
    hints = {0: '対角線で半分に折って三角にする',
             1: 'まん中に折り目をつけてもどす',
             2: '下のはしを、細く上へ折る',
             3: '左の角を、まん中にむけて折り上げる（耳）',
             4: '右の角を、まん中にむけて折り上げる（耳）',
             5: 'うらがえして、かおを かいたら できあがり'}
    return st, dict(work_id='usagi', name='うさぎ', emoji='🐰', difficulty=2,
                    hints=hints, rotate_deg=R)


def disp(rot, x, y):
    """★画面で見える向き（rotate_degを掛けたあと）の座標を、紙の座標に戻す。
       作品ごとに「三角形の頂点が上」など見え方が違うので、折り先を
       見えるままの座標で書けるようにするための道具。"""
    t = math.radians(-rot)
    c, s = math.cos(t), math.sin(t)
    return (x*c - y*s, x*s + y*c)


def _ro(origin, u, w):
    """三角形の「上辺に沿う向き(u)」「下向き(w)」で位置を指定する。
       正方形を対角線で折った後の45度傾いた見え方で考えるための座標。"""
    s = 0.7071067811865476
    return (origin[0] + u*s + w*s, origin[1] + u*s - w*s)


def _has(p, pt, tol=1e-7):
    return any(abs(q[0]-pt[0]) < tol and abs(q[1]-pt[1]) < tol for q in p['poly'])


# ==================================================================== かぶと
def build_kabuto():
    """かぶと 7手。★おりがみくらぶの折り図をそのまま実測して組んだ
       （https://www.origami-club.com/fun/kabuto/zu.gif の破線を画像から測った）。

       1. まんなかで半分に折る（とがった所が下の三角）
       2-3. 左右の角を、下のとがった所へ折る → ひし形
       4. 重なった2枚の先を、**ひし形の横の対角線で**いっしょに上へ折り上げる
       5-6. そのツノを、**ひし形の中心から60度の線**で左右へ開く
       7. 下に残った三角の手前1枚を、**対角線から下へ0.24の線**で上へ折る（はちまき）

       ★実測した数値（折り図から）
         ・4の折り線＝ひし形の横の対角線ちょうど（先は上のとがった所に着地）
         ・5-6の折り線＝中心から60度（実測 中央値60.3度）。
           まっすぐ立っている先が、水平から30度の向きに倒れてひし形の外へ出る
         ・7の折り線＝対角線から下の頂点までの0.24の位置（実測）

       ★以前は自分で考えた手順にしていて、`check_foldable.py` が
         「まん中の紙だけを折ろうとしている＝実物では折れない」と検出した。
         折線をいじって症状を消すのは[[feedback_origami_fufuritsu]]違反。直すのは手順。
    """
    R = -45          # 見た目：とがった所を下に（折り図と同じ向き）
    HD = math.sqrt(2) / 2          # ひし形の半対角（見た目の座標で）
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='まんなかで半分に折る')
    st.fold_by_points(A, B, 'V', only_containing=None, name='左の角を下の角へ')
    st.fold_by_points(C, B, 'V', only_containing=None, name='右の角を下の角へ')
    # 4-5. 2枚の先を、ひし形の横の対角線で上へ。★折り図(パネル3)の矢印は2本＝
    #      左右べつべつに折り上げる。まとめて1手にすると、左右の羽が
    #      互いちがいに重なった状態になり、次のツノ開きが「まん中の紙だけ折る」
    #      になってしまう（check_foldable.py が検出）。
    for tag, sidx in (('左', 1), ('右', 2)):
        st.fold_axiom_line((disp(R, -1, -HD), disp(R, 1, -HD)), 'V',
                           panel_filter=lambda p, i=sidx: i in p['hist'],
                           cut_hint=disp(R, 0, -1.2),
                           name=f'{tag}の先を上へ折り上げる')
    # 5-6. ツノを開く。中心から60度の折り線＝先が水平から30度に倒れる
    tip = disp(R, 0, 0.0)                          # 折り上げた先（ひし形の上の頂点）
    out = lambda sgn: disp(R, sgn * HD * math.cos(math.radians(30)),
                           -HD + HD * math.sin(math.radians(30)))
    st.fold_by_points(tip, out(-1), 'V',
                      panel_filter=lambda p: 1 in p['hist'], only_containing=None,
                      name='左のツノを開く')
    st.fold_by_points(tip, out(1), 'V',
                      panel_filter=lambda p: 2 in p['hist'], only_containing=None,
                      name='右のツノを開く')
    # 7-9. はちまき。★どの紙が手前かは**エンジンが場所ごとに判定する**
    #      （fold_layers）。作品ごとに「この紙が手前」と手で選ぶと、手順を
    #      1つ変えるたびに選び直しになる（本人指摘2026-09-02
    #      「小細工やると毎回なおさないといけない／エンジンの機能にしとかないと」）。
    band = -HD - 0.24 * HD
    low = disp(R, 0, -1.3)          # 折り上げたい側（ひし形の下のほう）
    # 「いちばん下の1枚（裏側）を残して、手前ぜんぶを折り上げる」
    st.fold_layers(disp(R, -1, band), disp(R, 1, band), 'V', cut_hint=low,
                   keep_bottom=1, name='手前の紙を上へ')
    st.fold_layers(disp(R, -1, -HD), disp(R, 1, -HD), 'V', cut_hint=low,
                   keep_bottom=1, name='もう一度折り上げる（はちまき）')
    st.fold_layers(disp(R, -1, -HD), disp(R, 1, -HD), 'M', cut_hint=low,
                   count=1, side='bottom', name='裏の1枚を後ろへ折る')
    hints = {0: 'まんなかで半分に折って三角にする',
             1: '左の角を、下のとがった所へ折る',
             2: '右の角を、下のとがった所へ折る',
             3: '左の先を、上へ折り上げる',
             4: '右の先を、上へ折り上げる',
             5: '左のツノを、ななめ上へ開く',
             6: '右のツノを、ななめ上へ開く',
             7: '下に残った三角を、手前1枚だけ上へ折る',
             8: 'もう一度折り上げる（はちまき）',
             9: 'うら側の1枚も、後ろへ同じように折る'}
    # ⚠ふきかけバー（💨）は 2026-09-03 に本人判断で取りやめ。上のコップと同じ。
    return st, dict(work_id='kabuto', name='かぶと', emoji='⛑️', difficulty=3,
                    hints=hints, rotate_deg=R)


# ==================================================================== やっこさん
def build_yakko():
    """やっこさんの土台 12手。座布団折り3回＋裏返し2回。"""
    st = FoldState(1.0)
    def blintz(corners, tag):
        for c in corners:
            st.fold_by_points(c, (0, 0), 'V', only_containing=None,
                              name=f'{tag}：角を中心へ')
    blintz([(1,1), (-1,1), (-1,-1), (1,-1)], '1回目')
    st.flip('v')
    blintz([(1,0), (0,1), (-1,0), (0,-1)], '2回目')
    st.flip('v')
    blintz([(0.5,0.5), (-0.5,0.5), (-0.5,-0.5), (0.5,-0.5)], '3回目')
    hints = {}
    for i in range(4):
        hints[i] = f'四すみの角を、まん中に合わせて折る（{i+1}つ目）'
    for i in range(4, 8):
        hints[i] = f'裏返して、また四すみを中心へ（{i-3}つ目）'
    for i in range(8, 12):
        hints[i] = f'もう一度裏返して、四すみを中心へ（{i-7}つ目）'
    return st, dict(work_id='yakko', name='やっこさん', emoji='🧑', difficulty=3,
                    hints=hints, rotate_deg=0)


# ==================================================================== ねこ
def build_neko():
    """ねこ（猫の顔）3手。いぬと同じ三角から、左右を内側へ折る。
       ★三角形の「上の辺の端」にある角は、どう折っても上辺より上へは出せない
         （紙の外へは折れない）。だから耳は「折って残った上のとがり」で作る。
    """
    R = -45
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='対角線で半分に折る')
    # 見えている向きでは A=左(-1.414,0) C=右(1.414,0) B=下(0,-1.414)
    st.fold_by_points(A, disp(R, -1.414+0.9, 0.9), 'V', only_containing=None,
                      name='左の角を右上へ折る')
    st.fold_by_points(C, disp(R, 1.414-0.9, 0.9), 'V', only_containing=None,
                      name='右の角を左上へ折る')
    hints = {0: '対角線で半分に折って三角にする',
             1: '左の角を、右ななめ上へ折る',
             2: '右の角を、左ななめ上へ折る（のこった上の2つのとがりが耳）'}
    return st, dict(work_id='neko', name='ねこ', emoji='🐱', difficulty=1,
                    hints=hints, rotate_deg=R)


# ==================================================================== チューリップ
def build_tulip():
    """チューリップの花 3手。三角にして、下の左右の角を斜め上へ折り上げるだけ。"""
    R = 135
    st = FoldState(1.0)
    A, B, C, D = (-1,-1), (1,-1), (1,1), (-1,1)
    st.fold_by_points(D, B, 'V', only_containing=None, name='対角線で半分に折る')
    # 見えている向きでは A=右(1.414,0) C=左(-1.414,0) B=上(0,1.414)
    st.fold_by_points(A, disp(R, 0.45, 1.15), 'V', only_containing=None,
                      name='右下の角を斜め上へ')
    st.fold_by_points(C, disp(R, -0.45, 1.15), 'V', only_containing=None,
                      name='左下の角を斜め上へ')
    hints = {0: '対角線で半分に折って三角にする',
             1: '右下の角を、ななめ上へ折り上げる（花びら）',
             2: '左下の角も、ななめ上へ折り上げる（花びら）'}
    return st, dict(work_id='tulip', name='チューリップ', emoji='🌷', difficulty=1,
                    hints=hints, rotate_deg=R)


# ==================================================================== やま（おうち）
def build_ie():
    """おうち 3手。半分に折って、上の左右の角を中心へ折り下げると屋根になる。"""
    R = 0
    st = FoldState(1.0)
    # ★半分に折ってから屋根を折ると、屋根が大きすぎて全部三角になってしまう
    #   （2026-09-02、絵を見て気づいた）。正方形のまま上の2つの角を
    #   まん中へ折り下げるだけで、ちゃんと家の形（五角形）になる。
    st.crease_only((-1,0), (1,0), 'V', only_containing=None, name='まん中に折り目')
    st.fold_by_points((-1,1), (0,0), 'V', only_containing=None, name='左上の角を下へ')
    st.fold_by_points((1,1), (0,0), 'V', only_containing=None, name='右上の角を下へ')
    hints = {0: '半分に折って開く（まん中のしるし）',
             1: '左上の角を、まん中のしるしに合わせて折り下げる（屋根）',
             2: '右上の角も、まん中のしるしに合わせて折り下げる（屋根）'}
    return st, dict(work_id='ie', name='おうち', emoji='🏠', difficulty=1,
                    hints=hints, rotate_deg=R)


# ==================================================================== ライオン
def build_lion():
    """らいおんの顔 5手。★おりがみくらぶ easy/animal-face/lion の折り図どおり。
       ① たてよこ半分に折り目をつけてもどす
       ② 下の角を、少し上の線で折り上げる
       ③④ 左右の角を、内がわへ折る（たてがみの形になる）
       ⑤ 下を後ろへ折る
    """
    R = 45                        # 正方形をひし形の向きに見せる
    st = FoldState(1.0)
    st.crease_only(disp(R, 0, -1.5), disp(R, 0, 1.5), 'V', name='たての折り目をつける')
    st.crease_only(disp(R, -1.5, 0), disp(R, 1.5, 0), 'V', name='よこの折り目をつける')
    st.fold_axiom_line((disp(R, -1.5, -1.07), disp(R, 1.5, -1.07)), 'V',
                       only_containing=None, cut_hint=disp(R, 0, -1.35),
                       name='下の角を上へ折る')
    # 折り図(パネル③)の点線を、見えている向きの座標で読んだ値
    st.fold_axiom_line((disp(R, -0.86, 0.45), disp(R, -0.59, -0.97)), 'V',
                       only_containing=None, cut_hint=disp(R, -1.2, 0),
                       name='左の角を内がわへ折る')
    st.fold_axiom_line((disp(R, 0.86, 0.45), disp(R, 0.59, -0.97)), 'V',
                       only_containing=None, cut_hint=disp(R, 1.2, 0),
                       name='右の角を内がわへ折る')
    # ⚠折り図⑤の「下を後ろへ折る」は、3Dの骨組みが作れずに落ちる
    #   （その手で動く紙が、前の手で動いた紙と丸ごと重なるため。2026-09-03）。
    #   形はほぼ変わらないので、いまは入れていない。直せたら足す。
    hints = {0: '下の角を、少し上へ折り上げる',
             1: '左の角を、内がわへ折る（たてがみ）',
             2: '右の角を、内がわへ折る（たてがみ）'}
    return st, dict(work_id='lion', name='ライオン', emoji='🦁', difficulty=2,
                    hints=hints, rotate_deg=R)


BUILDERS = {'inu': build_inu, 'neko': build_neko, 'tulip': build_tulip,
            'ie': build_ie, 'koppu': build_koppu,
            'kabuto': build_kabuto, 'yakko': build_yakko,
            'kitsune': build_kitsune, 'usagi': build_usagi,
            'lion': build_lion}


def _sync_sw_js(keys):
    """オフライン用の一覧（sw.js の ASSETS）も作品に合わせる。

    ★ここを忘れると、足した作品が**電波が無いときだけ開けない**（気づきにくい）。
      index.html と同じく、名簿は BUILDERS ただ1か所。
    """
    sw = HERE.parent.parent.parent / 'sw.js'
    if not sw.exists():
        return
    txt = sw.read_text(encoding='utf-8', newline='')
    nl2 = chr(13) + chr(10) if (chr(13) + chr(10)) in txt else chr(10)
    lines = txt.split(nl2)
    idxs = [i for i, l in enumerate(lines) if "/lab/origami/js/works/" in l]
    if not idxs:
        return
    want = ["  './lab/origami/js/works/%s.js'," % k for k in keys]
    lines[idxs[0]:idxs[-1] + 1] = want
    out = nl2.join(lines)
    if out != txt:
        sw.write_text(out, encoding='utf-8', newline='')
        print('  sw.js（オフライン用の一覧）も更新した')


def sync_index_html():
    """index.html の <script> を BUILDERS に合わせる。

    ★作品を1つ足すたびに index.html を手で直すのは忘れる（2026-09-03に2回やった）。
      名簿は BUILDERS ただ1か所——ここに足せばアプリにも自動で載る。
    """
    import re
    idx = HERE.parent / 'index.html'
    txt = idx.read_text(encoding='utf-8', newline='')
    nl2 = chr(13) + chr(10) if (chr(13) + chr(10)) in txt else chr(10)
    pat = re.compile(r'^\s*<script src="js/works/[^"]+\.js"></script>\s*$')
    keep, first = [], None
    for line in txt.split(nl2):
        if pat.match(line):
            if first is None:
                first = len(keep)
            continue
        keep.append(line)
    if first is None:
        print('  NG  index.html に作品の<script>が見つからない')
        return
    # ★並びは「やさしい順」（難易度→手数）。ピッカーはこの順に出るので、
    #   むずかしいものが先に来ると子どもが最初でつまずく（検査も見ている）。
    order = []
    for k, fn in BUILDERS.items():
        st2, meta2 = fn()
        nf = sum(1 for x in st2.steps if x['op'] == 'fold')
        order.append((meta2.get('difficulty', 9), nf, k))
    order.sort()
    want = ['  <script src="js/works/%s.js"></script>' % k for _, _, k in order]
    _sync_sw_js([k for _, _, k in order])
    keep[first:first] = want
    out = nl2.join(keep)
    if out != txt:
        idx.write_text(out, encoding='utf-8', newline='')
        print('  index.html の作品リストを更新した（%d作品）' % len(want))


def run(names):
    for nm in names:
        print(f'=== {nm} ===')
        st, meta = BUILDERS[nm]()
        verify(st, meta['name'])
        cp = st.crease_pattern()
        print(f"  折線 {len(cp)}本／紙 {len(st.panels)}枚／手順 "
              f"{sum(1 for s in st.steps if s['op']=='fold')}手")
        viz_work.save(st, str(PREV / f'work_{nm}.png'), meta['name'],
                      rotate_deg=meta.get('rotate_deg', 0))
        cp_export.save_fold(st, str(PREV / f'{nm}.fold'), title=meta['name'])
        # 3Dエンジン用のJSを書き出す
        work = to_work_js.to_work(st, meta['work_id'], meta['name'], meta['emoji'],
                                  meta['difficulty'], hints=meta['hints'],
                                  rotate_deg=meta.get('rotate_deg', 0),
                                  inflate=meta.get('inflate'))
        head = (BUILDERS[nm].__doc__ or '').strip()
        js = to_work_js.to_js(work, header=head)
        out = WORKS / f"{meta['work_id']}.js"
        if out.exists():
            bak = WORKS / '_old' / f"{meta['work_id']}.js"
            bak.parent.mkdir(exist_ok=True)
            if not bak.exists():
                bak.write_bytes(out.read_bytes())
                print(f'  （前の{out.name}は js/works/_old/ に控えた）')
        out.write_text(js, encoding='utf-8')
        nb = len(work['mesh']['boneParent'])
        check(f"{meta['name']}: 3D用の骨が組めた（骨{nb}本・手順{len(work['steps'])}）",
              nb > 0 and len(work['steps']) > 0)
        print(f'  → {out.relative_to(WORKS.parent.parent)}')
    sync_index_html()
    print()
    print('ALL OK' if ok_all else '★NGあり')


if __name__ == '__main__':
    names = sys.argv[1:] or list(BUILDERS)
    run(names)
    sys.exit(0 if ok_all else 1)
