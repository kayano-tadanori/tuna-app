"""
2D平面上で実際に紙を折るシミュレーションを行い、正しいcrease pattern(折れ線)を
構築するツール。

★設計思想(2026-08-30 続き14、本人提案):
   「完成形から逆算する」のではなく、「実際の折る手順の通りに、1手ずつ折る」
   ことで、必ず実際に折れることが保証された正しいCPデータを作る。

状態表現:
  - パネル(panel) = 2D頂点のリスト(多角形、反時計回り)+ どのレイヤー(層)にあるか
  - fold操作 = 1本の折り線(2点で定義される無限直線)を軸に、指定した側の
    全パネルを鏡映変換する。新しい頂点(元の多角形と折り線の交点)が生まれる。
  - 記録されるcrease = 各fold操作で生じた、パネルの境界上の折り線分。

★重要な制約(実際の紙の物理を守るため):
  - 1回のfold操作は、「今ある全レイヤーを一括で、同じ折り線で折る」
    (実際の紙を折るとき、複数枚重なった紙を一度に折るのと同じ)。
  - 折り線は、現在の(2D投影上の)紙の外形を、必ず端から端まで貫く必要がある
    (でないと、その回だけ紙の一部が浮いてしまい、物理的に折れない)。

★公理ベースの折り線(2026-08-30 追加):
   これまでのfold_by_points(2点を合わせる=公理2)に加えて、折り紙の数学的な
   構成公理(Huzita-Hatori axioms)のうち実用頻度の高いものを追加した
   (公理1・3・4・5・7。公理6は3次方程式が要る割に用途が狭いので見送り)。
   「マウスでクリックした点」ではなく「既知の点・辺・折り線から計算した
   厳密な交点」を折りの基準にできるので、fold2d_editor.htmlの
   0.02刻みグリッドスナップでは狙えない角度(45度の二等分線など)も正確に作れる。
   参考: GitHub `mino-ri/Orimath`(F#製の折り紙CADソフト)がこれらの公理を
   実装しているのを見て、数式(公式の数学的事実、Orimath固有の実装ではない)
   をこちらで独立に導出し直したもの。
"""
import math

def _sub(p, q):
    return (p[0]-q[0], p[1]-q[1])

def _add(p, q):
    return (p[0]+q[0], p[1]+q[1])

def _scale(p, s):
    return (p[0]*s, p[1]*s)

def _dot(p, q):
    return p[0]*q[0] + p[1]*q[1]

def _cross(p, q):
    return p[0]*q[1] - p[1]*q[0]

def _norm(p):
    return math.hypot(p[0], p[1])

def _normalize(p):
    n = _norm(p)
    return (p[0]/n, p[1]/n)

def axiom1_line(p1, p2):
    """公理1：2点p1,p2を通る直線。fold用ではなく、既知の点から基準線・
       計測用の線を作るときに使う(そのままfoldに渡せば2点を結ぶ線で折れる)。"""
    if math.hypot(*_sub(p1, p2)) < 1e-9:
        return None
    return (p1, p2)

def axiom2_line(p1, p2):
    """公理2：p1をp2に重ねる折り線(垂直二等分線)。fold_by_pointsの中身を
       単体の関数として切り出したもの。"""
    if math.hypot(*_sub(p1, p2)) < 1e-9:
        return None
    mx, my = (p1[0]+p2[0])/2, (p1[1]+p2[1])/2
    dx, dy = p2[0]-p1[0], p2[1]-p1[1]
    perp = (-dy, dx)
    return (mx, my), (mx+perp[0], my+perp[1])

def axiom3_lines(line1, line2):
    """公理3：直線line1を直線line2に重ねる折り線(角の二等分線)。
       線分ではなく無限直線として扱う。2直線が交わる場合は2本
       (内角・外角の二等分線)、平行な場合は1本(中間線)を返す。
       同一直線の場合は[]。"""
    d1 = _normalize(_sub(line1[1], line1[0]))
    d2 = _normalize(_sub(line2[1], line2[0]))
    cross_pt = seg_line_intersect_inf(line1[0], line1[1], line2[0], line2[1])
    if cross_pt is None:
        # 平行：line1上の点からline2への垂線の足との中点を通る、d1方向の直線
        foot = _project_point_to_line(line1[0], line2[0], line2[1])
        if math.hypot(*_sub(line1[0], foot)) < 1e-9:
            return []  # 同一直線
        mid = _scale(_add(line1[0], foot), 0.5)
        return [(mid, _add(mid, d1))]
    bis1 = _add(d1, d2)
    bis2 = _sub(d1, d2)
    lines = []
    for bis in (bis1, bis2):
        if _norm(bis) > 1e-9:
            lines.append((cross_pt, _add(cross_pt, bis)))
    return lines

def axiom4_line(line, point):
    """公理4：直線lineに垂直で、pointを通る折り線。"""
    dx, dy = line[1][0]-line[0][0], line[1][1]-line[0][1]
    perp = (-dy, dx)
    return (point, _add(point, perp))

def axiom5_lines(pass_point, onto_line, onto_point):
    """公理5：onto_pointを直線onto_line上に重ね、かつ折り線がpass_pointを
       通るような折り線。pass_pointを中心・半径|pass_point-onto_point|の円と
       onto_lineとの交点0〜2個に対応する、0〜2本の折り線を返す。"""
    if _point_on_line(onto_point, onto_line):
        return []
    r = math.hypot(*_sub(pass_point, onto_point))
    candidates = _circle_line_intersections(pass_point, r, onto_line)
    lines = []
    for c in candidates:
        line = axiom2_line(onto_point, c)
        if line:
            lines.append(line)
    return lines

def axiom7_line(pass_line, onto_line, onto_point):
    """公理7：onto_pointを直線onto_line上に重ね、かつ折り線がpass_lineに
       垂直になるような折り線。交わりが無い(pass_lineとonto_lineが平行)場合はNone。"""
    if _point_on_line(onto_point, onto_line):
        return None
    d = _normalize(_sub(pass_line[1], pass_line[0]))  # 折り線の法線 = pass_lineの方向
    n = (-d[1], d[0])  # 折り線自体の方向(pass_lineに垂直)
    # 折り線 = { X : X = M + t*n }。M = c*d (法線d方向にcだけ離れた点)とおく
    # (この直線上の点はどれも法線方向の成分がcで揃っているので代表点として使える)。
    # p=onto_pointをこの直線で鏡映した点が、onto_line上に来るcを解く。
    base = _sub(onto_point, _scale(d, 2*_dot(onto_point, d)))  # c=0での鏡映(原点通過・法線dの軸)
    e = _sub(onto_line[1], onto_line[0])
    q = onto_line[0]
    denom = 2 * _cross(d, e)
    if abs(denom) < 1e-12:
        return None
    c = -_cross(_sub(base, q), e) / denom
    m = _scale(d, c)
    return (m, _add(m, n))

def _point_on_line(p, line, tol=1e-7):
    return abs(side_of_line(p, line[0], line[1])) < tol * max(1.0, _norm(_sub(line[1], line[0])))

def _project_point_to_line(p, a, b):
    ap = _sub(p, a); ab = _sub(b, a)
    t = _dot(ap, ab) / _dot(ab, ab)
    return _add(a, _scale(ab, t))

def seg_line_intersect_inf(a1, a2, b1, b2):
    """直線a1-a2と直線b1-b2(どちらも無限直線)の交点。平行ならNone。
       (seg_line_intersectは片方が線分限定なのでこちらは両方とも無限直線版)"""
    x1,y1 = a1; x2,y2 = a2; x3,y3 = b1; x4,y4 = b2
    dx1, dy1 = x2-x1, y2-y1
    dx2, dy2 = x4-x3, y4-y3
    denom = dx1*dy2 - dy1*dx2
    if abs(denom) < 1e-12:
        return None
    t = ((x3-x1)*dy2 - (y3-y1)*dx2) / denom
    return (x1+t*dx1, y1+t*dy1)

def _circle_line_intersections(center, radius, line):
    """中心center・半径radiusの円と、直線lineの交点(0〜2個)。"""
    a, b = line
    d = _sub(b, a)
    f = _sub(a, center)
    A = _dot(d, d)
    B = 2 * _dot(f, d)
    C = _dot(f, f) - radius*radius
    disc = B*B - 4*A*C
    if disc < -1e-9:
        return []
    disc = max(disc, 0.0)
    sq = math.sqrt(disc)
    t1 = (-B - sq) / (2*A)
    t2 = (-B + sq) / (2*A)
    if abs(t1 - t2) < 1e-9:
        return [_add(a, _scale(d, t1))]
    return [_add(a, _scale(d, t1)), _add(a, _scale(d, t2))]

def measure(target1, target2):
    """Orimathの計測パネル相当：2つの対象(点のタプル、または(a,b)の直線タプル)
       の間の距離と、直線同士なら成す角(度)も返す。fold操作はしない、
       読み取り専用のヘルパー。"""
    def is_point(t):
        return isinstance(t[0], (int, float))
    if is_point(target1) and is_point(target2):
        return {'distance': math.hypot(*_sub(target1, target2))}
    if is_point(target1) and not is_point(target2):
        target1, target2 = target2, target1
    if not is_point(target1) and is_point(target2):
        foot = _project_point_to_line(target2, target1[0], target1[1])
        return {'distance': math.hypot(*_sub(target2, foot)), 'foot': foot}
    # 直線同士
    d1 = _normalize(_sub(target1[1], target1[0]))
    d2 = _normalize(_sub(target2[1], target2[0]))
    cos_t = max(-1.0, min(1.0, _dot(d1, d2)))
    angle = math.degrees(math.acos(abs(cos_t)))
    cross_pt = seg_line_intersect_inf(target1[0], target1[1], target2[0], target2[1])
    return {'angle_deg': angle, 'cross_point': cross_pt}

def seg_line_intersect(p1, p2, a, b):
    """線分p1-p2と、直線a-b(無限直線として扱う)の交点。無ければNone。"""
    x1,y1 = p1; x2,y2 = p2; x3,y3 = a; x4,y4 = b
    dx1, dy1 = x2-x1, y2-y1
    dx2, dy2 = x4-x3, y4-y3
    denom = dx1*dy2 - dy1*dx2
    if abs(denom) < 1e-12:
        return None
    t = ((x3-x1)*dy2 - (y3-y1)*dx2) / denom
    if t < -1e-9 or t > 1+1e-9:
        return None
    return (x1+t*dx1, y1+t*dy1)

def side_of_line(p, a, b):
    """点pが、直線a->bの左(+)か右(-)か。0に近ければ線上。"""
    return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])

def point_in_polygon(pt, poly, tol=1e-6):
    """点ptが多角形polyの内部または境界上にあるか(レイキャスト法+境界判定)。"""
    x, y = pt
    n = len(poly)
    # 境界(頂点や辺)に乗っているかを先にチェック
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        cross = (x2-x1)*(y-y1) - (y2-y1)*(x-x1)
        if abs(cross) < tol:
            dot = (x-x1)*(x2-x1) + (y-y1)*(y2-y1)
            len2 = (x2-x1)**2 + (y2-y1)**2
            if -tol <= dot <= len2+tol:
                return True
    inside = False
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y-y1)*(x2-x1)/(y2-y1)
            if x < xin:
                inside = not inside
    return inside

def reflect_point(p, a, b):
    """点pを、直線a-bで鏡映する。"""
    ax,ay = a; bx,by = b; px,py = p
    dx,dy = bx-ax, by-ay
    L2 = dx*dx+dy*dy
    t = ((px-ax)*dx + (py-ay)*dy) / L2
    projx, projy = ax+t*dx, ay+t*dy
    return (2*projx-px, 2*projy-py)

def split_polygon(poly, a, b):
    """多角形polyを、直線a-bで2つに分割する。(keep_side, cut_side)を返す
       (keep_side=線の左側=+側 に残る部分、cut_side=右側=-側、鏡映される部分)。
       線が多角形を通らない場合は (poly, None) または (None, poly)。"""
    n = len(poly)
    sides = [side_of_line(p, a, b) for p in poly]
    if all(s >= -1e-9 for s in sides):
        return poly, None  # 全部+側、線はこの多角形を切らない
    if all(s <= 1e-9 for s in sides):
        return None, poly  # 全部-側

    keep, cut = [], []
    for i in range(n):
        p0, p1 = poly[i], poly[(i+1) % n]
        s0, s1 = sides[i], sides[(i+1) % n]
        if s0 >= -1e-9:
            keep.append(p0)
        if s0 <= 1e-9:
            cut.append(p0)
        if (s0 > 1e-9 and s1 < -1e-9) or (s0 < -1e-9 and s1 > 1e-9):
            ip = seg_line_intersect(p0, p1, a, b)
            if ip:
                keep.append(ip); cut.append(ip)
    return (keep if len(keep) >= 3 else None), (cut if len(cut) >= 3 else None)

class FoldState:
    def __init__(self, square_half=1.0):
        s = square_half
        # panels: list of dicts {poly: [(x,y),...], layer: int}
        # layer = z-order (higher = more folds applied = physically closer to top,
        # approximation only, real layering needs more care for complex overlaps)
        self.panels = [{'poly': [(-s,-s), (s,-s), (s,s), (-s,s)], 'layer': 0}]
        self.creases = []  # list of {'a':(x,y), 'b':(x,y), 'kind':'M'/'V'}

    def fold(self, a, b, kind, only_containing=None, panel_filter=None):
        """折り線a-bで、-側(cut側)にあるパネル全部を、a-bで鏡映してkeep側に
           移す。kind='M'(mountain) or 'V'(valley)。
           デフォルトは全パネルが対象(重なった紙を一度に折る、正しいケースも
           多い)。★only_containing(点の座標)を渡すと、「その点を含む
           パネルだけ」を対象にする——紙飛行機の屋根折りのように「左右の角を
           別々の折り線で、片方ずつ折る」場面で、2回目の折りが1回目で
           既に折った部分にまで誤って適用されるのを防ぐ(2026-08-30実装時に
           発覚したバグへの対処)。
           ★panel_filter(パネル辞書->bool)を渡すと、さらに絞り込める——
           境界(頂点)は複数のパネルに共有されるため、only_containingだけだと
           「まだ折っていない、下の本体部分」まで巻き込むことがある
           (2026-08-30、紙飛行機の2段目の屋根折りで発覚)。
           例：panel_filter=lambda p: p['layer'] < 0 で「1回目で既に折られた
           部分だけ」に絞れる。"""
        new_panels = []
        touched = False
        for p in self.panels:
            if panel_filter is not None and not panel_filter(p):
                new_panels.append(p)
                continue
            if only_containing is not None and not point_in_polygon(only_containing, p['poly']):
                new_panels.append(p)
                continue
            keep, cut = split_polygon(p['poly'], a, b)
            if keep:
                new_panels.append({'poly': keep, 'layer': p['layer']})
            if cut:
                touched = True
                reflected = [reflect_point(pt, a, b) for pt in cut]
                new_panels.append({'poly': reflected, 'layer': -p['layer']-1})
                # crease at the boundary of the cut
                self.creases.append({'a': a, 'b': b, 'kind': kind})
        if not touched:
            print(f'WARNING: fold line {a}-{b} did not touch any panel (no-op)')
        self.panels = new_panels
        return self

    def bounding_area(self):
        """現在の全パネルのbounding boxの面積(折りたたみの進み具合の目安)。"""
        xs, ys = [], []
        for p in self.panels:
            for x,y in p['poly']:
                xs.append(x); ys.append(y)
        return (max(xs)-min(xs)) * (max(ys)-min(ys))

    def fold_by_points(self, p_from, p_to, kind, only_containing='auto', panel_filter=None):
        """★本人提案(2026-08-30)の核心：「この角をこの角に合わせる」操作。
           p_fromをp_toに一致させる折り線(p_from-p_toの垂直二等分線)を自動計算し、
           foldを実行する。実際の折り紙で「ここをここに合わせて折る」と言う時の
           操作そのもの——折り線を自分で計算しなくてよい。
           p_from/p_toは、現在のpanels内の実在する頂点の座標(タプル)を渡す想定。
           only_containing: 'auto'(デフォルト)ならp_fromを含むパネルだけを対象に
           する(「左右の角を別々に折る」ような場面の事故を防ぐ)。全レイヤーを
           まとめて折りたい(重なった紙を一度に折る)場合はNoneを明示的に渡す。"""
        ax, ay = p_from; bx, by = p_to
        mx, my = (ax+bx)/2, (ay+by)/2
        dx, dy = bx-ax, by-ay
        # 垂直二等分線の方向ベクトル(dx,dyに垂直)
        perp = (-dy, dx)
        line_a = (mx, my)
        line_b = (mx+perp[0], my+perp[1])
        # ★p_fromは必ず「cut側(-側)」に来るようにする(=実際にfoldで動く側)。
        #   垂直二等分線に対してp_from/p_toは対称な位置にあるが、90度回転の
        #   向き(perp)の選び方次第でどちらが+側になるかが数学的に固定されて
        #   しまい、p_fromが常にkeep側(動かない側)になるバグがあった
        #   (2026-08-30、紙飛行機の屋根折りで発覚)。
        if side_of_line(p_from, line_a, line_b) > 0:
            line_a, line_b = line_b, line_a
        target = p_from if only_containing == 'auto' else only_containing
        self.fold(line_a, line_b, kind, only_containing=target, panel_filter=panel_filter)
        # 検算：p_fromの鏡映がp_toに一致するか
        reflected = reflect_point(p_from, line_a, line_b)
        err = math.hypot(reflected[0]-p_to[0], reflected[1]-p_to[1])
        if err > 1e-6:
            print(f'WARNING: fold_by_points check failed, err={err}')
        return self

    def fold_axiom_line(self, line, kind, only_containing=None, panel_filter=None, cut_hint=None):
        """axiom1/2/3/4/5/7が返した折り線(a,b)をそのままfoldに渡す薄いラッパー。
           lineがNoneなら何もしない(該当する折りが無い場合、呼び出し側で
           choose_lineを通した後にNoneが来ることがある)。
           ★cut_hint(座標)を渡すと、その点が必ずcut側(実際に鏡映されて動く側)に
           来るように線の向き(a,b)を揃えてから折る。axiom3等は2本の候補を返す際
           どちらの向きで(a,b)が表現されるか一定でないため、向きを揃えないと
           「動かしたいはずの側が動かない」バグになる(fold_by_pointsで
           2026-08-30に踏んだのと同種のバグ)。"""
        if line is None:
            print('WARNING: fold_axiom_line called with line=None (no-op)')
            return self
        a, b = line
        if cut_hint is not None and side_of_line(cut_hint, a, b) > 0:
            a, b = b, a
        return self.fold(a, b, kind, only_containing=only_containing, panel_filter=panel_filter)

    def total_area(self):
        area = 0
        for p in self.panels:
            poly = p['poly']
            n = len(poly)
            a = 0
            for i in range(n):
                x1,y1 = poly[i]; x2,y2 = poly[(i+1)%n]
                a += x1*y2 - x2*y1
            area += abs(a)/2
        return area


def choose_line(lines, hint_point=None):
    """axiom3/axiom5のように複数の折り線候補が返る公理で、実際に使う1本を選ぶ。
       hint_pointを渡すと、その点に最も近い(=側の符号距離が最小の)線を選ぶ
       (Orimathのchoose_line相当の簡易版)。候補が0本ならNone。"""
    if not lines:
        return None
    if len(lines) == 1 or hint_point is None:
        return lines[0]
    return min(lines, key=lambda l: abs(side_of_line(hint_point, l[0], l[1])))


if __name__ == '__main__':
    # ★数値の一致だけで満足しない([[feedback_verify_mechanism_not_just_answer]])
    #   ―公式を書いたら、必ず「鏡映して本当に目的の場所に来るか」を
    #   独立に検算する。
    def check(name, ok):
        print(('OK  ' if ok else 'NG  ') + name)

    # 公理2: (0,0)を(4,0)に重ねる → 折り線はx=2の垂直線のはず
    l2 = axiom2_line((0, 0), (4, 0))
    check('axiom2: x=2 vertical', abs(l2[0][0] - 2.0) < 1e-9 and abs(l2[1][0] - 2.0) < 1e-9)
    check('axiom2: reflect check', math.hypot(*_sub(reflect_point((0, 0), *l2), (4, 0))) < 1e-9)

    # 公理3: x軸とy軸(原点で交差、90度)の二等分線は45度・135度になるはず
    lines3 = axiom3_lines(((0, 0), (1, 0)), ((0, 0), (0, 1)))
    angles3 = sorted(round(math.degrees(math.atan2(l[1][1]-l[0][1], l[1][0]-l[0][0])) % 180, 3) for l in lines3)
    check('axiom3: bisectors at 45/135 deg', angles3 == [45.0, 135.0])

    # 公理4: 直線y=0に垂直で(3,1)を通る折り線 → x=3の垂直線のはず
    l4 = axiom4_line(((0, 0), (1, 0)), (3, 1))
    check('axiom4: perpendicular through point', abs(side_of_line((3, 5), *l4)) < 1e-9 and abs(side_of_line((3, -5), *l4)) < 1e-9)

    # 公理5: pass_point=(0,0)を通り、onto_point=(2,0)をonto_line(x=0軸=y軸)に重ねる
    lines5 = axiom5_lines((0, 0), ((0, 0), (0, 1)), (2, 0))
    ok5 = all(_point_on_line(reflect_point((2, 0), *l), ((0, 0), (0, 1))) for l in lines5)
    ok5 = ok5 and all(_point_on_line((0, 0), l) for l in lines5)
    check('axiom5: reflected point lands on onto_line & passes pass_point', ok5 and len(lines5) > 0)

    # 公理7: pass_line=x軸に垂直な折り線で、onto_point=(1,1)をonto_line(y軸)に重ねる
    # → 折り線はx=0.5の垂直線のはず(手計算で検算済み)
    onto_line7 = ((0, 0), (0, 1))
    l7 = axiom7_line(((0, 0), (1, 0)), onto_line7, (1, 1))
    reflected7 = reflect_point((1, 1), *l7)
    dir7 = _normalize(_sub(l7[1], l7[0]))
    check('axiom7: fold line is x=0.5', abs(l7[0][0] - 0.5) < 1e-9 and abs(l7[1][0] - 0.5) < 1e-9)
    check('axiom7: reflected point lands on onto_line', _point_on_line(reflected7, onto_line7))
    check('axiom7: fold line perpendicular to pass_line', abs(_dot(dir7, (1, 0))) < 1e-9)

    print('all axiom self-checks done.')
