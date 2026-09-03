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

def shared_edge(p, q, tol=1e-7):
    """2つの多角形が共有している辺（長さのある重なり）を返す。無ければNone。"""
    for i in range(len(p)):
        a1, a2 = p[i], p[(i+1) % len(p)]
        for j in range(len(q)):
            b1, b2 = q[j], q[(j+1) % len(q)]
            if abs(side_of_line(b1, a1, a2)) > tol or abs(side_of_line(b2, a1, a2)) > tol:
                continue
            dx, dy = a2[0]-a1[0], a2[1]-a1[1]
            L2 = dx*dx + dy*dy
            if L2 < 1e-18:
                continue
            ts = sorted([((b1[0]-a1[0])*dx + (b1[1]-a1[1])*dy)/L2,
                         ((b2[0]-a1[0])*dx + (b2[1]-a1[1])*dy)/L2])
            lo, hi = max(0.0, ts[0]), min(1.0, ts[1])
            # ★長さで見る（パラメータの差で見ると、長い辺では点で接しただけを拾う）
            if (hi - lo) * math.sqrt(L2) > 1e-4:
                return ((a1[0]+lo*dx, a1[1]+lo*dy), (a1[0]+hi*dx, a1[1]+hi*dy))
    return None


def polys_overlap(p, q, tol=1e-9):
    """★2つの多角形が少しでも重なっているか。
       本人のルール「角がちょっとでもかかれば　それは上」（2026-09-02）。
       点をいくつか置いて調べる方式だと、かすった重なりを取りこぼす。
       ①どちらかの頂点が相手の中にある ②辺どうしが交わる のどちらかで判定する。"""
    for v in p:
        if point_in_polygon(v, q):
            return True
    for v in q:
        if point_in_polygon(v, p):
            return True
    for i in range(len(p)):
        a1, a2 = p[i], p[(i+1) % len(p)]
        for j in range(len(q)):
            b1, b2 = q[j], q[(j+1) % len(q)]
            d1 = side_of_line(b1, a1, a2); d2 = side_of_line(b2, a1, a2)
            d3 = side_of_line(a1, b1, b2); d4 = side_of_line(a2, b1, b2)
            if ((d1 > tol) != (d2 > tol)) and ((d3 > tol) != (d4 > tol)):
                return True
    return False


def _strictly_inside(pt, poly, eps=1e-3):
    """★点が多角形の「内側」にあるか。ふちの上は数えない。
       ふちに乗った点を『両方の紙が覆っている』と数えると、隣り合うだけで
       重なっていない紙が重なって見える（2026-09-02にこれで誤判定した）。"""
    if not point_in_polygon(pt, poly):
        return False
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        dx, dy = b[0]-a[0], b[1]-a[1]
        L = math.hypot(dx, dy)
        if L < 1e-12:
            continue
        d = abs(dx*(pt[1]-a[1]) - dy*(pt[0]-a[0])) / L
        t = ((pt[0]-a[0])*dx + (pt[1]-a[1])*dy) / (L*L)
        if -0.05 <= t <= 1.05 and d < eps:
            return False
    return True


IDENTITY_XF = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

def reflect_affine(a, b):
    """直線a-bによる鏡映を、アフィン変換(m00,m01,m10,m11,tx,ty)として返す。
       p' = M p + t。Mは直交行列(det=-1)。"""
    dx, dy = b[0]-a[0], b[1]-a[1]
    L = math.hypot(dx, dy)
    nx, ny = -dy/L, dx/L          # 折り線の単位法線
    k = 2*(a[0]*nx + a[1]*ny)
    return (1-2*nx*nx, -2*nx*ny,
            -2*nx*ny, 1-2*ny*ny,
            k*nx, k*ny)

def xf_apply(xf, p):
    m00, m01, m10, m11, tx, ty = xf
    return (m00*p[0] + m01*p[1] + tx, m10*p[0] + m11*p[1] + ty)

def xf_inv_apply(xf, p):
    """xfは等長変換(回転/鏡映+平行移動)なのでM^-1 = M^T。現在座標→原紙座標。"""
    m00, m01, m10, m11, tx, ty = xf
    x, y = p[0]-tx, p[1]-ty
    return (m00*x + m10*y, m01*x + m11*y)

def xf_compose(outer, inner):
    """outer ∘ inner（先にinnerを適用してからouterを適用する合成）。"""
    a00, a01, a10, a11, atx, aty = outer
    b00, b01, b10, b11, btx, bty = inner
    return (a00*b00 + a01*b10, a00*b01 + a01*b11,
            a10*b00 + a11*b10, a10*b01 + a11*b11,
            a00*btx + a01*bty + atx,
            a10*btx + a11*bty + aty)

def xf_is_flipped(xf):
    """そのパネルが裏返っている(奇数回鏡映された)か。det(M) < 0 なら裏。"""
    return (xf[0]*xf[3] - xf[1]*xf[2]) < 0


def clip_line_to_polygon(a, b, poly, tol=1e-9):
    """無限直線a-bが多角形polyの内側に作る線分を全部返す(凹多角形にも対応)。
       戻り値は [(p0,p1), ...]。交わらなければ空リスト。"""
    dx, dy = b[0]-a[0], b[1]-a[1]
    L2 = dx*dx + dy*dy
    if L2 < 1e-18:
        return []
    ts = []
    n = len(poly)
    for i in range(n):
        p0, p1 = poly[i], poly[(i+1) % n]
        s0 = side_of_line(p0, a, b)
        s1 = side_of_line(p1, a, b)
        if abs(s0) <= 1e-9:
            ts.append(((p0[0]-a[0])*dx + (p0[1]-a[1])*dy) / L2)
        if (s0 > 1e-9 and s1 < -1e-9) or (s0 < -1e-9 and s1 > 1e-9):
            ip = seg_line_intersect(p0, p1, a, b)
            if ip:
                ts.append(((ip[0]-a[0])*dx + (ip[1]-a[1])*dy) / L2)
    if len(ts) < 2:
        return []
    ts.sort()
    uniq = [ts[0]]
    for t in ts[1:]:
        if t - uniq[-1] > 1e-9:
            uniq.append(t)
    out = []
    for i in range(len(uniq)-1):
        tm = (uniq[i] + uniq[i+1]) / 2
        mid = (a[0] + tm*dx, a[1] + tm*dy)
        if point_in_polygon(mid, poly):
            out.append(((a[0] + uniq[i]*dx,   a[1] + uniq[i]*dy),
                        (a[0] + uniq[i+1]*dx, a[1] + uniq[i+1]*dy)))
    return out


class FoldState:
    def __init__(self, square_half=1.0, half_h=None):
        hw = square_half
        hh = square_half if half_h is None else half_h
        # ★原紙(まだ折っていない平らな紙)の大きさ。展開図(CP)の外枠になる。
        self.paper = {'hw': hw, 'hh': hh}
        # panels: list of dicts {poly, layer, xf}
        #   poly = 現在(折った後)の座標
        #   xf   = ★原紙座標 → 現在座標 のアフィン変換。これを持つことで、
        #          折り筋を「元の紙のどこに付いたか」に逆写像できる＝展開図が出せる
        #   layer= z-order(大きいほど上)
        #   hist  = ★この紙切れを動かした折りの番号（順番どおり）。3Dの骨組みに
        #           変換するときの「親子関係」がこれで決まる。
        #   pre_xf= 最後に動かされる直前のxf。ヒンジの線を平らな原紙の座標に
        #           戻すのに要る。
        self.panels = [{'poly': [(-hw,-hh), (hw,-hh), (hw,hh), (-hw,hh)],
                        'layer': 0, 'xf': IDENTITY_XF, 'hist': (), 'pre_xf': IDENTITY_XF}]
        self.creases = []  # 折ったときの座標での折り線(従来互換)
        self.cp = []       # ★原紙座標での折り筋 {'a','b','kind','step'} ＝展開図の中身
        self.steps = []    # 折順 {'name','kind','a','b'}
        # ★1手ごとの紙の様子（折った後の形・原紙での場所・重なりの順）。
        #   3Dで「その手の時点での重なり」を再現するのに要る。最終形の重なり順を
        #   途中でも使うと、親につられて動いた紙が土台と同じ高さになってちらつく
        #   （本人指摘 2026-09-02「一度おってるのに折った紙の下半分が消えてる」）。
        self.snapshots = []

    # ---- 展開図(CP) ----
    def crease_pattern(self, tol=1e-7):
        """原紙座標の折り筋を、重複を除いて返す。同じ線分が複数の層から
           記録されることがある(重なった紙を一度に折った場合)ので束ねる。"""
        out = []
        seen = {}
        for c in self.cp:
            a, b = c['a'], c['b']
            if (b[0], b[1]) < (a[0], a[1]):
                a, b = b, a
            key = (round(a[0]/tol), round(a[1]/tol), round(b[0]/tol), round(b[1]/tol))
            if key in seen:
                prev = out[seen[key]]
                if not c.get('creaseOnly', False):
                    prev['creaseOnly'] = False
                if prev['kind'] != c['kind']:
                    prev['kind'] = 'U'   # 同じ位置に山と谷が両方＝層で食い違う
                prev['layers'] += 1
                continue
            seen[key] = len(out)
            out.append({'a': a, 'b': b, 'kind': c['kind'], 'step': c['step'],
                        'creaseOnly': c.get('creaseOnly', False), 'layers': 1})
        return out

    def paper_border(self):
        hw, hh = self.paper['hw'], self.paper['hh']
        return [(-hw,-hh), (hw,-hh), (hw,hh), (-hw,hh)]

    def fold(self, a, b, kind, only_containing=None, panel_filter=None, name=None, move=True):
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
        step_idx = len(self.steps)
        R = reflect_affine(a, b)
        new_panels = []
        touched = False
        for p in self.panels:
            xf = p.get('xf', IDENTITY_XF)
            if panel_filter is not None and not panel_filter(p):
                new_panels.append(p)
                continue
            if only_containing is not None and not point_in_polygon(only_containing, p['poly']):
                new_panels.append(p)
                continue
            keep, cut = split_polygon(p['poly'], a, b)
            if keep and cut:
                # ★このパネルに実際に折り筋が付いた。原紙座標へ逆写像して記録する。
                #   (このパネルだけを通る逆変換なので、層ごとに別々の位置に落ちる
                #    ＝重なった紙を一度に折ると、開いたとき別々の折り筋になる、を再現)
                sa, sb = xf_inv_apply(xf, a), xf_inv_apply(xf, b)
                src_poly = [xf_inv_apply(xf, q) for q in p['poly']]
                # 裏返っているパネルの「谷折り」は、原紙の表から見れば山折り
                cp_kind = kind
                if xf_is_flipped(xf):
                    cp_kind = 'M' if kind == 'V' else ('V' if kind == 'M' else kind)
                for s0, s1 in clip_line_to_polygon(sa, sb, src_poly):
                    # ★move=False＝折り目をつけて開いただけ。紙は畳まれていないので、
                    #   平坦折りの判定（Maekawa/Kawasaki）では数えない印を付ける。
                    self.cp.append({'a': s0, 'b': s1, 'kind': cp_kind,
                                    'step': step_idx, 'creaseOnly': not move})
                self.creases.append({'a': a, 'b': b, 'kind': kind, 'step': step_idx})
            tags = {k: v for k, v in p.items() if k.startswith('_tag')}
            if keep:
                new_panels.append(dict(tags, poly=keep, layer=p['layer'], xf=xf,
                                       hist=p.get('hist', ()),
                                       pre_xf=p.get('pre_xf', IDENTITY_XF)))
            if cut and not keep and move:
                # ★パネルまるごとが動いた＝新しい折り筋はできない。ただしその縁が
                #   既にある折り目(precreaseでつけた筋など)と重なっているなら、
                #   「実際にどちら向きに折ったか」で山谷を上書きする。
                #   これが無いと、折り目だけ先につけてから畳む折り方(鶴など)で
                #   展開図の山谷が下書きのままになる。
                sa, sb = xf_inv_apply(xf, a), xf_inv_apply(xf, b)
                k2 = kind
                if xf_is_flipped(xf):
                    k2 = 'M' if kind == 'V' else ('V' if kind == 'M' else kind)
                src_poly = [xf_inv_apply(xf, q) for q in p['poly']]
                self._reassign_along(sa, sb, k2, src_poly, step_idx)
            if cut:
                touched = True
                if move:
                    reflected = [reflect_point(pt, a, b) for pt in cut]
                    new_panels.append(dict(tags, poly=reflected, layer=p['layer'],
                                           xf=xf_compose(R, xf), _moved=True,
                                           hist=p.get('hist', ()) + (step_idx,),
                                           pre_xf=xf))
                else:
                    # ★折り目だけつけて戻す(precrease)。紙は動かさず、折り筋と
                    #   新しい頂点(参照点)だけが残る＝折り紙の図解の「折り目を
                    #   つけて開く」そのもの。潰し折り・花びら折りの下準備はこれ。
                    new_panels.append(dict(tags, poly=cut, layer=p['layer'], xf=xf,
                                           hist=p.get('hist', ()),
                                           pre_xf=p.get('pre_xf', IDENTITY_XF)))
        if not touched:
            print(f'WARNING: fold line {a}-{b} did not touch any panel (no-op)')
            for q in new_panels:
                q.pop('_moved', None)
            self.panels = new_panels
            return self
        # ★層の並べ替え。谷折りは動いた側が「着地先の一番上」より上へ、
        #   山折りは「着地先の一番下」より下へ、順番を逆にして重なる。
        #
        #   🚨根っこの間違い（2026-09-02に本人の指摘で判明）：
        #   以前は基準を**紙全体の最大値**にしていた。重なりは場所ごとの話なのに
        #   番号を全体で振っていたので、遠くの離れた紙まで巻きこんで順番が狂った
        #   （「裏の2枚を折っているのに表の2枚の層が変わる」）。
        #   基準は**その紙が着地する場所にある紙だけ**から取る。
        moved_ps = [q for q in new_panels if q.get('_moved')]
        stay_ps = [q for q in new_panels if not q.get('_moved')]
        if not moved_ps:                          # 折り目だけ＝紙は動かない
            for q in new_panels:
                q.pop('_moved', None)
            self.steps.append({'name': name or f'{len(self.steps)+1}手目',
                               'kind': kind, 'a': a, 'b': b,
                               'op': 'fold' if move else 'crease',
                               'partial': panel_filter is not None})
            self.panels = new_panels
            self._snap()
            return self

        def _samples(poly):
            cx = sum(v[0] for v in poly)/len(poly)
            cy = sum(v[1] for v in poly)/len(poly)
            out = [(cx, cy)]
            for v in poly:                       # 重心寄りに少し引いた点
                out.append((cx + (v[0]-cx)*0.6, cy + (v[1]-cy)*0.6))
            return out

        # ★「角がちょっとでもかかれば、それは上」。点で調べず多角形の重なりで見る。
        pivot = None
        for q in moved_ps:
            for r in stay_ps:
                if not polys_overlap(q['poly'], r['poly']):
                    continue
                if pivot is None:
                    pivot = r['layer']
                elif kind == 'V':
                    pivot = max(pivot, r['layer'])
                else:
                    pivot = min(pivot, r['layer'])
        if pivot is None:                        # 何にも重ならない＝その場に留まる
            pivot = (max if kind == 'V' else min)(q['layer'] for q in moved_ps)                     - (1 if kind == 'V' else -1)
        # 逆順に積む（実際に紙をめくり返すのと同じ）
        moved_ps.sort(key=lambda q: q['layer'], reverse=(kind == 'V'))
        for k, q in enumerate(moved_ps):
            q['layer'] = pivot + (k + 1) * (1 if kind == 'V' else -1)
        for q in new_panels:
            q.pop('_moved', None)
        self.steps.append({'name': name or f'{len(self.steps)+1}手目',
                           'kind': kind, 'a': a, 'b': b,
                           'op': 'fold' if move else 'crease',
                           # 一部の層だけを折った手か（かぶとの「手前1枚だけ」など）。
                           # この手があると、折り筋が紙の途中で終わる＝
                           # 1枚の紙を前提にした Kawasaki/Maekawa は当てはまらない。
                           'partial': panel_filter is not None})
        self.panels = new_panels
        self._snap()
        return self

    def _snap(self):
        """いまの紙の様子を控える。src(原紙での場所)も一緒に持つので、
           あとから「最終形のどの紙切れが、この時点ではどの紙切れだったか」を
           原紙の座標で照合できる。"""
        self.snapshots.append({
            'nfold': sum(1 for s in self.steps if s['op'] == 'fold'),
            # ★裏返した回数。flip()は層の符号を反転するので、3D側（裏返さない）と
            #   そろえるには、この偶奇で層の向きを戻す必要がある。
            'nflip': sum(1 for s in self.steps if s['op'] == 'flip'),
            'panels': [
                {'poly': list(p['poly']),
                 'src': [xf_inv_apply(p['xf'], q) for q in p['poly']],
                 'xf': p['xf'],
                 'layer': p['layer']}
                for p in self.panels]})

    # ------------------------------------------------------------------
    # ★「上から何枚」「下から何枚」を折る、をエンジンの機能として持つ。
    #   実物の紙で折れるのは重なりの上から何枚か・下から何枚かだけで、
    #   まん中の1枚は折れない（上の紙が押さえになって手が届かない）。
    #   作品ごとに「この紙が手前」と手で選ぶと、手順を1つ変えるたびに
    #   選び直しになる（本人指摘 2026-09-02「小細工やると毎回なおさないと
    #   いけないよ／エンジンの機能としてそうなるようにしとかないと」）。
    #   ここで場所ごとに重なりを見て決めるので、手で選ぶ必要がなくなる。
    # ------------------------------------------------------------------
    def _deepest(self, a, b, grid=60, only=None):
        """折り線の「動く側」で、いちばん深く重なっている所の枚数。
           only(パネル->bool) を渡すと、その紙だけを数える（＝作品の「この部分の」
           重なりだけを見る）。"""
        hw, hh = self.paper['hw'], self.paper['hh']
        deep = 0
        for gx in range(grid):
            for gy in range(grid):
                x = -hw + 2*hw*(gx+0.5)/grid
                y = -hh + 2*hh*(gy+0.5)/grid
                if side_of_line((x, y), a, b) >= -1e-9:
                    continue
                n = sum(1 for p in self.panels if _strictly_inside((x, y), p['poly'])
                        and (only is None or only(p)))
                deep = max(deep, n)
        return deep

    def _pick_layers(self, a, b, count, side, grid=60, only=None):
        """折り線a-bの「動く側」で、上から(side='top')または下から(side='bottom')
           count枚ぶんの紙切れを選ぶ。場所ごとに重なりを見て union する。"""
        hw, hh = self.paper['hw'], self.paper['hh']
        # ★場所ごとに「その点の一番上」を拾って足し合わせると、裏の紙が
        #   むき出しになっている所でその裏の紙まで拾ってしまい、
        #   結局まん中の層を折ることになる（2026-09-02に踏んだ）。
        #   いちばん深く重なっている所を基準に「どの層を折るか」を決め、
        #   その層に属する紙だけを選ぶ。
        best, deep = None, -1
        for gx in range(grid):
            for gy in range(grid):
                x = -hw + 2*hw*(gx+0.5)/grid
                y = -hh + 2*hh*(gy+0.5)/grid
                if side_of_line((x, y), a, b) >= -1e-9:
                    continue                       # 動かない側は見ない
                here = [p['layer'] for p in self.panels
                        if _strictly_inside((x, y), p['poly'])
                        and (only is None or only(p))]
                if len(here) > deep:
                    deep, best = len(here), sorted(here, reverse=(side == 'top'))
        if not best:
            return set()
        want = set(best[:count])                   # 折る層の番号
        chosen = set()
        for i, p in enumerate(self.panels):
            if p['layer'] not in want:
                continue
            if only is not None and not only(p):
                continue
            if any(side_of_line(q, a, b) < -1e-9 for q in p['poly']):
                chosen.add(i)
        return chosen

    def _connected_closure(self, chosen, a, b):
        """★選んだ紙とつながっている紙を、自動で連れていく。
           本人の指摘（2026-09-02）「1枚だけ動くのはヒンジが外れてる証拠」
           「決め打ちの必要はない　つながってるんだから」。
           つながりは**原紙（開いた紙）の座標**で見る——折った後の座標だと、
           ただ隣り合っているだけの別の層と区別がつかない。
           いま折る折り線の上でつながっているぶんは、そこで折れるので広げない。"""
        if not chosen:
            return chosen
        srcs = [[xf_inv_apply(p.get('xf', IDENTITY_XF), q) for q in p['poly']]
                for p in self.panels]
        # 折り線の「動く側」にかかっている紙だけを、つながりをたどる対象にする
        cand = [i for i, p in enumerate(self.panels)
                if any(side_of_line(q, a, b) < -1e-9 for q in p['poly'])]
        # 折り線を原紙の座標に戻して「その辺は折り線か」を見る
        grow = set(chosen)
        changed = True
        while changed:
            changed = False
            for i in list(grow):
                sa = xf_inv_apply(self.panels[i].get('xf', IDENTITY_XF), a)
                sb = xf_inv_apply(self.panels[i].get('xf', IDENTITY_XF), b)
                for j in cand:
                    if j in grow:
                        continue
                    e = shared_edge(srcs[i], srcs[j])
                    if e is None:
                        continue
                    if (abs(side_of_line(e[0], sa, sb)) < 1e-7
                            and abs(side_of_line(e[1], sa, sb)) < 1e-7):
                        continue          # いま折る折り線の上＝ここで折れる
                    # ★連れて行くのは「ひとつづきの同じ面」だけ。
                    #   その辺が折り目（2枚のxfがちがう＝そこで紙が折れている）なら、
                    #   折り目は開けるので一緒に動く必要はない——実物でも
                    #   「重なった紙の手前1枚だけを折る」は当たり前にやる
                    #   （コップの口、かぶとの裏の1枚）。折り目づたいに広げると、
                    #   紙ぜんぶがつながって「1枚だけ折る」ができなくなる
                    #   （2026-09-03、コップの5手目が折られていなかった原因）。
                    xi = self.panels[i].get('xf', IDENTITY_XF)
                    xj = self.panels[j].get('xf', IDENTITY_XF)
                    if any(abs(u - v) > 1e-9 for u, v in zip(xi, xj)):
                        continue
                    # ★原紙で隣どうしでも、いまの座標で同じ場所に無ければ
                    #   実際にはつながっていない（間に折りが入って離れている）。
                    same = all(
                        math.hypot(*_sub(xf_apply(xi, pt), xf_apply(xj, pt))) < 1e-7
                        for pt in e)
                    if not same:
                        continue
                    grow.add(j)
                    changed = True
        return grow

    def fold_layers(self, a, b, kind, count=1, side='top', name=None, move=True,
                    cut_hint=None, keep_bottom=None, keep_top=None, panel_filter=None):
        """★重なりの「上からcount枚」(side='top')または「下からcount枚」
           (side='bottom')だけを折る。どの紙が上かはエンジンが場所ごとに判定する。
           cut_hint に「動かしたい側の点」を渡すと、折り線の向きを自動でそろえる
           （渡し忘れると動く側が逆になって『折る紙が見つからない』になる）。
           ★panel_filter を渡すと「紙のこの部分の中で、上から何枚」になる。
             折り線は無限の直線なので、体の上まで巻きこまずに「さっき折り上げた
             ところの先だけ」を折りたいときに要る（ぶたの鼻。2026-09-03）。
             どの紙が上かは、そのしぼった中でエンジンが場所ごとに判定する
             ＝手で層を名指しするのとは別物。"""
        if cut_hint is not None and side_of_line(cut_hint, a, b) > 0:
            a, b = b, a
        # ★枚数を決め打ちしないための言い方。
        #   keep_bottom=1 → 「いちばん下の1枚だけ残して、上ぜんぶ折る」
        #   keep_top=1    → 「いちばん上の1枚だけ残して、下ぜんぶ折る」
        #   重なりが何枚かはエンジンが数えるので、手順を変えても書き直さずにすむ
        #   （本人指摘2026-09-02「かぶとの9手目が上の紙だけしか動いてない」＝
        #     帯が2枚になったのに1枚しか折っていなかった）。
        if keep_bottom is not None or keep_top is not None:
            deep = self._deepest(a, b, only=panel_filter)
            if keep_bottom is not None:
                count, side = max(1, deep - keep_bottom), 'top'
            else:
                count, side = max(1, deep - keep_top), 'bottom'
        chosen = self._pick_layers(a, b, count, side, only=panel_filter)
        chosen = self._connected_closure(chosen, a, b)
        if not chosen:
            print(f'WARNING: fold_layers: 折る紙が見つからない {a}-{b}')
            return self
        ids = {id(self.panels[i]) for i in chosen}
        return self.fold(a, b, kind, panel_filter=lambda p: id(p) in ids,
                         name=name, move=move)

    def _reassign_along(self, sa, sb, kind, src_poly, step_idx, tol=1e-7):
        """原紙座標の直線sa-sbの上にある既存の折り筋のうち、**いま動いた紙の縁に
           重なっている所だけ**を、実際に折った向きkindで上書きする。

           ★重なりが一部だけなら、折り筋を切り分ける。
             先に「折り目だけ」つけた線の一部だけをあとで本当に折ることがある
             （ライオンの④＝先に折った耳のぶんだけ紙が無い）。まるごと
             「折った」ことにすると、紙が無い所にも折り筋があることになり、
             平坦折りの判定で頂点の折り筋が奇数本になる（2026-09-03）。
        """
        d = _sub(sb, sa)
        L2 = _dot(d, d)
        if L2 < 1e-18:
            return 0

        def proj(p):
            return _dot(_sub(p, sa), d) / L2

        # いま動いた紙の縁のうち、この直線に乗っている区間（線に沿った位置tで）
        spans = []
        n = len(src_poly)
        for i in range(n):
            q0, q1 = src_poly[i], src_poly[(i + 1) % n]
            if abs(side_of_line(q0, sa, sb)) > tol or abs(side_of_line(q1, sa, sb)) > tol:
                continue
            t0, t1 = proj(q0), proj(q1)
            spans.append((min(t0, t1), max(t0, t1)))
        if not spans:
            return 0

        def covered(t):
            return any(a - 1e-9 <= t <= b + 1e-9 for a, b in spans)

        out, changed = [], 0
        for c in self.cp:
            if (abs(side_of_line(c['a'], sa, sb)) > tol
                    or abs(side_of_line(c['b'], sa, sb)) > tol):
                out.append(c)
                continue
            ca, cb = proj(c['a']), proj(c['b'])
            lo, hi = (ca, cb) if ca <= cb else (cb, ca)
            pa, pb = (c['a'], c['b']) if ca <= cb else (c['b'], c['a'])
            # この折り筋を、縁に乗っている所／乗っていない所に切り分ける
            cuts = {lo, hi}
            for a, b in spans:
                for t in (a, b):
                    if lo + 1e-9 < t < hi - 1e-9:
                        cuts.add(t)
            ts = sorted(cuts)
            if len(ts) == 2 and not covered((lo + hi) / 2):
                out.append(c)                       # まったく重なっていない
                continue
            changed += 1
            for k in range(len(ts) - 1):
                t0, t1 = ts[k], ts[k + 1]
                if t1 - t0 < 1e-9:
                    continue
                def at(t):
                    r = (t - lo) / (hi - lo) if hi > lo else 0.0
                    return (pa[0] + (pb[0] - pa[0]) * r, pa[1] + (pb[1] - pa[1]) * r)
                seg = dict(c, a=at(t0), b=at(t1))
                if covered((t0 + t1) / 2):
                    seg['kind'] = kind
                    seg['step'] = step_idx
                    # ★ここは本当に折った。もう「折り目だけ」ではない
                    seg['creaseOnly'] = False
                out.append(seg)
        self.cp = out
        return changed

    def crease_only(self, a, b, kind, only_containing=None, panel_filter=None, name=None):
        """★折り目だけつけて開く。fold(move=False)の別名。"""
        return self.fold(a, b, kind, only_containing, panel_filter, name, move=False)

    def flip(self, axis='v', name=None):
        """★紙を裏返す。axis='v'なら左右に返す(x→-x)、'h'なら上下に返す(y→-y)。
           折り筋は増えない。xfのdetが反転するので、この後の谷折りは原紙の
           表から見れば山折りとして展開図に記録される(自動)。"""
        F = (-1.0, 0.0, 0.0, 1.0, 0.0, 0.0) if axis == 'v' else (1.0, 0.0, 0.0, -1.0, 0.0, 0.0)
        for p in self.panels:
            p['poly'] = [xf_apply(F, q) for q in p['poly']]
            p['xf'] = xf_compose(F, p.get('xf', IDENTITY_XF))
            p['layer'] = -p['layer']          # 重なりの順も逆になる
        self.steps.append({'name': name or f'{len(self.steps)+1}手目: 裏返す',
                           'kind': None, 'a': None, 'b': None, 'op': 'flip', 'axis': axis})
        self._snap()
        return self

    def bounding_area(self):
        """現在の全パネルのbounding boxの面積(折りたたみの進み具合の目安)。"""
        xs, ys = [], []
        for p in self.panels:
            for x,y in p['poly']:
                xs.append(x); ys.append(y)
        return (max(xs)-min(xs)) * (max(ys)-min(ys))

    def fold_by_points(self, p_from, p_to, kind, only_containing='auto', panel_filter=None,
                       move=True, name=None):
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
        self.fold(line_a, line_b, kind, only_containing=target, panel_filter=panel_filter,
                  name=name, move=move)
        # 検算：p_fromの鏡映がp_toに一致するか
        reflected = reflect_point(p_from, line_a, line_b)
        err = math.hypot(reflected[0]-p_to[0], reflected[1]-p_to[1])
        if err > 1e-6:
            print(f'WARNING: fold_by_points check failed, err={err}')
        return self

    def fold_axiom_line(self, line, kind, only_containing=None, panel_filter=None,
                        cut_hint=None, name=None, move=True):
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
        return self.fold(a, b, kind, only_containing=only_containing,
                         panel_filter=panel_filter, name=name, move=move)

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
