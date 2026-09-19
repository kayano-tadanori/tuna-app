# -*- coding: utf-8 -*-
"""つる⑬（脚の中割り折り）の独立モデル・第2段：目標終端 → 閉路と運動（2026-09-16）

**本体・UI・保存形式は無変更。**入力は `crane13_input.json`（`check_crane13_model.py` と同じ・JS の判定は呼ばない）。

見ること
  [G] 動く範囲の**候補**（⑬で一緒に動きそうな紙）の、**内部と外へつながる全結び**の列挙。
      単一の軸で動ける集合の総当りだけでは複数軸の運動に要る範囲は決まらないので、ここは候補のまま扱う。
  [H] **目標終端の仮定義**（観察したこと／計算のために仮定したことを分ける）と、
      終端が**全結びと剛体性から**成立するかの確認。面の最終座標や層を先に正解として置かない。
  [I] **閉路と運動**：紙を「板＋ちょうつがい」として組み、木の外の結びの閉じの式を数値で解く。
      自由度は仮定せず拘束から出す。ふつうの外へ折る枝と中割りの枝を分け、端点の特異性も見る。

使い方： python check_crane13_motion.py [--angle 度] [--pos 距離] [--leg 1|2]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util, json, math, os, sys, traceback
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("crane13_model", os.path.join(HERE, "check_crane13_model.py"))
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)

ng = []


def say(*a):
    print(" ".join(str(x) for x in a))


def bad(msg):
    ng.append(msg)
    say("  NG:", msg)


# ---------- 3D の道具（板は剛体・ちょうつがいは出発の平らな姿での線分） ----------
def p3(p):
    return np.array([p[0], p[1], p[2] if len(p) > 2 else 0.0], float)


def rot_about(a, b, ang):
    """点 a を通り方向 b-a の直線まわりに ang 回す 4x4（出発の姿は z=0 の平ら）"""
    a = p3(a)
    d = p3(b) - a
    d = d / np.linalg.norm(d)
    K = np.array([[0, -d[2], d[1]], [d[2], 0, -d[0]], [-d[1], d[0], 0]])
    R = np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * (K @ K)
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = a - R @ a
    return T


def xform(T, p):
    q = T @ np.array([p[0], p[1], p[2] if len(p) > 2 else 0.0, 1.0])
    return q[:3]


class Model:
    """板（面）とちょうつがい（結び）の図。出発の姿は平ら（z=0）で、そのときの折り角はぜんぶ 0 とする。"""

    def __init__(self, faces, bonds, anchor=None, last=()):
        self.ids = list(faces.keys())
        self.idx = {k: i for i, k in enumerate(self.ids)}
        self.faces = faces
        self.bonds = [b for b in bonds if b["faceIds"][0] in self.idx and b["faceIds"][1] in self.idx]
        self.anchor = anchor if anchor is not None else self.ids[0]
        self._tree(set(last))

    def _tree(self, last):
        """木（根＝anchor）と、木の外の結び。
           `last` の板は**あとまわし**にして木に入れる＝中割り線のちょうつがいが全部木に入り、
           先の8枚の角を直に動かせる（8本の角がぜんぶ変数になる）。"""
        adj = {}
        for k, b in enumerate(self.bonds):
            adj.setdefault(b["faceIds"][0], []).append((b["faceIds"][1], k))
            adj.setdefault(b["faceIds"][1], []).append((b["faceIds"][0], k))
        self.parent, self.tree_bond, order, seen = {}, {}, [self.anchor], {self.anchor}
        used = set()
        for stage in (0, 1):
            qi = 0
            while qi < len(order):
                x = order[qi]; qi += 1
                for y, k in adj.get(x, []):
                    if y in seen or (stage == 0 and y in last):
                        continue
                    seen.add(y); self.parent[y] = x; self.tree_bond[y] = k; used.add(k); order.append(y)
            if stage == 0:
                for y in last:
                    if y in seen:
                        continue
                    for x, k in adj.get(y, []):
                        if x in seen:
                            seen.add(y); self.parent[y] = x; self.tree_bond[y] = k; used.add(k); order.append(y)
                            break
        self.order = order
        self.tree_ids = [k for k in range(len(self.bonds)) if k in used]
        self.loop_ids = [k for k in range(len(self.bonds)) if k not in used]
        self.connected = len(seen) == len(self.ids)
        self.var_of = {k: i for i, k in enumerate(self.tree_ids)}   # 折り角の変数（木の結びごとに1つ）

    def placements(self, x):
        """折り角 x（木の結びぶん）から、板ごとの置かれ方 4x4 を作る"""
        T = {self.anchor: np.eye(4)}
        for fid in self.order[1:]:
            k = self.tree_bond[fid]
            b = self.bonds[k]
            ang = x[self.var_of[k]]
            T[fid] = T[self.parent[fid]] @ rot_about(b["cur"][0], b["cur"][1], ang)
        return T

    def residual(self, x, T=None):
        """木の外の結びの閉じ（両端が両方の板で同じ所に来る）"""
        T = T if T is not None else self.placements(x)
        r = []
        for k in self.loop_ids:
            b = self.bonds[k]
            A, B = self.faces[b["faceIds"][0]], self.faces[b["faceIds"][1]]
            TA, TB = T[b["faceIds"][0]], T[b["faceIds"][1]]
            for p in b["cur"]:
                r.extend(xform(TA, p) - xform(TB, p))
        return np.array(r) if r else np.zeros(0)

    def jac(self, x, h=1e-6):
        r0 = self.residual(x)
        J = np.zeros((len(r0), len(x)))
        for i in range(len(x)):
            xp = x.copy(); xp[i] += h
            J[:, i] = (self.residual(xp) - r0) / h
        return J, r0


def solve(mo, x0, drive, maxit=60, tol=1e-12):
    """drive＝[(変数の番号, 値)]を押さえたまま、木の外の結びの閉じを最小にする（ガウス・ニュートン）"""
    x = x0.copy()
    for i, v in drive:
        x[i] = v
    fixed = {i for i, _ in drive}
    free = [i for i in range(len(x)) if i not in fixed]
    for _ in range(maxit):
        J, r = mo.jac(x)
        if np.linalg.norm(r) < tol:
            break
        Jf = J[:, free]
        dx, *_ = np.linalg.lstsq(Jf, -r, rcond=None)
        # 行き過ぎを抑える
        step = 1.0
        base = np.linalg.norm(r)
        for _ in range(30):
            xt = x.copy()
            for j, i in enumerate(free):
                xt[i] += step * dx[j]
            if np.linalg.norm(mo.residual(xt)) < base:
                x = xt
                break
            step *= 0.5
        else:
            break
    return x, np.linalg.norm(mo.residual(x))


def trace_branch(mo, cutvars, spinevars, open_seed_deg=150, steps=None):
    """出発（平ら）→ 開く → 中割り線の角を上げる、と**連続に**道を追う。
       🚨 中割り線の角を2本以上押さえるのは過剰拘束（解の族は細いので一般に解が無くなる）。
          押さえるのは**1本だけ**にして、ほかは自由に動かす。
       返す：道の点（中割り線の角・ほかの折りの開きの最大・閉じの残り・自由度）と、止まった所。"""
    x = np.zeros(len(mo.tree_ids))
    # 段1：中割り線の角は0のまま、ほかの折り（開き）を少しずつ入れる
    seed = None
    for v in spinevars:
        xs, res = solve(mo, x, [(v, math.radians(open_seed_deg))])
        if res < 1e-9:
            seed = xs
            break
    if seed is None:
        return dict(ok=False, why="開く動き（中割り線の角を0のまま）が1つも見つからない", path=[])
    # 段2：中割り線の角を1本だけ押し上げる
    path, stop = [], None
    xs = seed
    for rho in (steps or list(range(2, 30, 2)) + list(range(30, 181, 5))):
        xt, res = solve(mo, xs, [(cutvars[0], math.radians(rho))])
        if res > 1e-7:
            stop = (rho, res)
            break
        xs = xt
        cs = [ang_of(xs[i]) for i in cutvars]
        others = max((abs(ang_of(xs[i])) for i in spinevars), default=0.0)
        path.append(dict(rho=rho, cuts=cs, open=others, res=res))
    if stop is not None:
        return dict(ok=False, stop=stop, path=path, x=xs)
    # 段3：**閉じ直す**（中割り線の角は 180° のまま、開いている折りを 0 へ戻す）
    close = []
    for _ in range(12):
        big = max(spinevars, key=lambda i: abs(ang_of(xs[i])))
        a0 = ang_of(xs[big])
        if abs(a0) < 0.5:
            break
        moved = False
        for t in (0.5, 0.25, 0.1):
            xt, res = solve(mo, xs, [(cutvars[0], math.pi), (big, math.radians(a0 * (1 - t)))])
            if res < 1e-7:
                xs, moved = xt, True
                close.append(dict(angle=ang_of(xs[big]), res=res,
                                  open=max(abs(ang_of(xs[i])) for i in spinevars)))
                break
        if not moved:
            break
    return dict(ok=True, stop=None, path=path, close=close, x=xs,
                open_end=max((abs(ang_of(xs[i])) for i in spinevars), default=0.0))


def ang_of(v):
    """角を -180〜180 に直す（度）"""
    d = math.degrees(v) % 360
    return d - 360 if d > 180 else d


def main():
    ang = float(sys.argv[sys.argv.index("--angle") + 1]) if "--angle" in sys.argv else 60.0
    pos = float(sys.argv[sys.argv.index("--pos") + 1]) if "--pos" in sys.argv else 0.5
    legno = int(sys.argv[sys.argv.index("--leg") + 1]) if "--leg" in sys.argv else 1

    D = M.load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    lm = D["landmarks"]
    legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
    L = M.dist(legTip, petalTip)
    u = ((petalTip[0] - legTip[0]) / L, (petalTip[1] - legTip[1]) / L)
    nrm = (-u[1], u[0])
    neck = [v["neck"] for v in lm["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces, bonds, legTip, u, nrm, 0.3 * neck)
    leg = legs[legno - 1]
    use_oripa = "--oripa" in sys.argv
    if use_oripa:
        line, rec, cmeta = M.oripa_cut_line(legno, D["meta"]["stateFingerprint"])
        if set(rec["faceIds"]) != set(leg):   # 2026-09-17：脚と線の取り違えで 90通り・中割り27 が出ていた
            raise RuntimeError("crane13_cutline.json の脚%d の faceIds が、いまの脚%d と違う（脚と線の取り違え）" % (legno, legno))
        cut = M.cut_graph(leg, faces, bonds, legTip, u, 0, 0, line=line)
        say(f"材料 指紋 {D['meta']['stateFingerprint'][:12]}／脚{legno}（8面）に中割り線"
            f"（**ORIPA の元の端点から**：{cmeta['source']} sha1 {cmeta['sourceSha1'][:8]}…"
            f"／中心線との交わりは先端から {rec['distTipToV']:.6f}・なす角 {rec['angleDeg']:.4f}°は報告用）")
        say("  ⚠ ORIPA は**線の位置だけ**に使う（山谷・層の上下・途中の非貫通の根拠にはしない）")
    else:
        cut = M.cut_graph(leg, faces, bonds, legTip, u, pos, ang)
        say(f"材料 指紋 {D['meta']['stateFingerprint'][:12]}／脚{legno}（8面）に中割り線（**仮置き**：先端から {pos}・中心線と {ang}°）")
    say(f"  板 {len(cut['faces'])}枚・ちょうつがい {len(cut['bonds'])}本"
        f"（先の部分 {len(cut['tip'])}・付け根側 {len(cut['base'])}）")

    # ---------- [G] 動く範囲の候補と、その全結び ----------
    say("\n[G] 動く範囲の**候補**（前回の20枚）と、その全結びの列挙")
    spine = M.line_of([(legTip[0], legTip[1]), (petalTip[0], petalTip[1])])
    sets16 = [c for ln, c in M.single_axis_sets(cut["faces"], cut["bonds"])
              if ln == spine and (c & cut["tip"]) and len(c) == 16]
    if not sets16:
        bad("中心線のまわりに開ける16枚の集合が見つからない")
        return
    open16 = sets16[0]
    cand = set(cut["tip"]) | open16
    say(f"  候補＝先の部分8枚 ∪ 中心線で開ける16枚 = {len(cand)}枚"
        f"（内訳：先 {len(cand & cut['tip'])}・付け根 {len(cand & cut['base'])}・胴 {len(cand - cut['tip'] - cut['base'])}）")
    inside = [b for b in cut["bonds"] if b["faceIds"][0] in cand and b["faceIds"][1] in cand]
    border = [b for b in cut["bonds"] if (b["faceIds"][0] in cand) != (b["faceIds"][1] in cand)]
    say(f"  候補の内部の結び {len(inside)}本／固定側へつながる結び {len(border)}本")
    for lab, arr in (("内部", inside), ("固定側へ", border)):
        by = {}
        for b in arr:
            by.setdefault((M.line_of(b["cur"]), b["kind"]), []).append(b)
        for (ln, kind), v in sorted(by.items(), key=lambda t: -len(t[1])):
            where = ("中割り線" if M.seg_on_line(cut["cutseg"], ln) else
                     "中心線" if ln == spine else "ほかの線")
            say(f"    {lab}：{kind} {len(v)}本／{where}（{M.r3((-ln[1], ln[0]))}方向・通る点{M.r3((ln[0]*ln[2], ln[1]*ln[2]))}）")
    say("  ⚠ この20枚は**候補**。複数の軸の運動でほんとうに要る範囲は、下の [I] の閉じで決める。")

    # ---------- [H] 目標終端の仮定義 ----------
    say("\n[H] 目標終端の仮定義")
    say("  【観察したこと】折り図⑬＝脚を点線で中割り折り／動画 bheH5wZckps 4:39〜5:09＝脚の先を胴のあいだへ引き上げ、"
        "終わりで胴は閉じ直して平ら。先の向きが変わり、中心の背の折り向きが入れかわる。")
    say("  【計算のために仮定したこと】①中割り線の位置と角度＝"
        + ("**ORIPA の展開図の元の端点**（線の位置だけを借りた。山谷・層の根拠にはしない）"
           if use_oripa else "上の仮置き（折り図・動画からは決まらない）")
        + "②終端は平ら（z=0）③動かない紙は出発と同じ置かれ方に戻る（胴が閉じ直す）")
    say("  【目標条件】(a) 脚の先の8枚が中割り線の向こうへ行く（向きが変わる）"
        "(b) 先の部分の中の折りは山谷が入れかわる (c) 先は胴（＝脚の付け根側の層）のあいだに入る"
        "(d) 胴は閉じ直して終端は平ら")
    say("  ※ (c) の層の順は [I] のあと（非貫通と一緒に）。ここでは (a)(b)(d) を全結びと剛体性から確かめる。")

    # 終端の置かれ方を「押し込まずに」出す：平らな終端では、各板の置かれ方は
    #   「動かない」か「中割り線のまわりに π 回す（＝平面では線での鏡）」のどちらかしかない。
    T_end = {}
    A, B = cut["cutseg"]
    Rpi = rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    for fid in cut["faces"]:
        T_end[fid] = Rpi if fid in cut["tip"] else np.eye(4)
    worst = 0.0
    for b in cut["bonds"]:
        TA, TB = T_end[b["faceIds"][0]], T_end[b["faceIds"][1]]
        for p in b["cur"]:
            worst = max(worst, float(np.linalg.norm(xform(TA, p) - xform(TB, p))))
    say(f"  終端の全結びの食い違い（最大） {worst:.2e}"
        f" → {'成立（全部の結びがつながったまま）' if worst < 1e-9 else '不成立'}")
    if worst > 1e-9:
        bad("目標終端が結びを満たさない")
    # (b) 山谷の入れかわり：先の部分の中の折りは、鏡で向きが反転する
    flipped = 0
    for b in cut["bonds"]:
        if b["faceIds"][0] in cut["tip"] and b["faceIds"][1] in cut["tip"] and not b["bondId"].startswith("cut:"):
            flipped += 1
    say(f"  先の部分の中の折り {flipped}本は、鏡（π回転）で**山谷が入れかわる**＝中割り折りの印")
    # (a) 先が胴の側へ戻ってくるか（行き先が付け根側の紙と重なるか）
    from shapely.geometry import Polygon
    land = 0
    for fid in cut["tip"]:
        poly = Polygon([xform(Rpi, p)[:2] for p in cut["faces"][fid]["cur"]])
        for gid in cut["base"]:
            if poly.intersection(Polygon(cut["faces"][gid]["cur"])).area > 1e-9:
                land += 1
                break
    say(f"  先の8枚のうち {land}枚が、折り返した先で脚の付け根側の紙と重なる（＝胴の側へ入る位置にある）")

    # ---------- [J] 終端の上下（層の順）を、押し込まずに拘束から求める ----------
    say("\n[J] 終端の上下（層の順）：正解を置かず、紙の重なりの決まりから**あり得る順をぜんぶ数える**")
    stack_feasibility(cut, T_end, Rpi, faces)

    # ---------- [I] 閉路と運動 ----------
    say("\n[I] 閉路と運動（板＋ちょうつがいの閉じを数値で解く）")
    mo = Model(cut["faces"], cut["bonds"], anchor=pick_anchor(cut, faces, petalTip), last=cut["tip"])
    say(f"  板 {len(mo.ids)}・ちょうつがい {len(mo.bonds)}（木 {len(mo.tree_ids)}／木の外 {len(mo.loop_ids)}）"
        f"／つながっている＝{mo.connected}／独立な閉路 {len(mo.loop_ids)}")
    x0 = np.zeros(len(mo.tree_ids))
    say(f"  出発（折り角ぜんぶ0＝いまの平らな姿）の閉じの残り {np.linalg.norm(mo.residual(x0)):.2e}")

    # 拘束から自由度を見る（出発は平らに畳まれた特異な姿なので、1次の自由度は上限として読む）
    J, r = mo.jac(x0)
    rank = np.linalg.matrix_rank(J, tol=1e-7)
    say(f"  出発での1次の自由度（上限）＝変数 {J.shape[1]} − 拘束の階数 {rank} = {J.shape[1]-rank}"
        "　※平らに畳まれた姿は特異なので、これは**上限**（実際に動けるとは限らない）")

    cutvars = [mo.var_of[k] for k in mo.tree_ids if mo.bonds[k]["bondId"].startswith("cut:")]
    say(f"  中割り線のちょうつがいのうち、木に入っているもの {len(cutvars)}本（ぜんぶで {sum(1 for b in mo.bonds if b['bondId'].startswith('cut:'))}本）")

    # 枝1：ふつうの外へ折る（先の8枚がひとかたまりで中割り線のまわりに回る）
    # 木の道が中割り線を何回またぐかで符号が決まるので、置かれ方から角を作る（木の変数へ直に入れる）
    def branch1(rho):
        x = np.zeros(len(x0))
        for fid in mo.order[1:]:
            k = mo.tree_bond[fid]
            p = mo.parent[fid]
            a = (1 if fid in cut["tip"] else 0) - (1 if p in cut["tip"] else 0)
            x[mo.var_of[k]] = a * rho
        return x
    say("  枝1＝ふつうの外へ折る：先の8枚をまとめて中割り線のまわりに回す")
    ok1 = True
    for t in (0.25, 0.5, 0.75, 1.0):
        x = branch1(math.pi * t)
        res = np.linalg.norm(mo.residual(x))
        if res > 1e-9:
            ok1 = False
        say(f"    角 {180*t:5.1f}°：閉じの残り {res:.2e}")
    if not ok1:
        bad("ふつうの外へ折る枝が閉じない（組み方が違う）")

    # 枝2：中割り（先の8枚が**同じ角ではない**）を探す
    say("  枝2＝中割り：中心線のまわりに開きながら先を折る道を、閉じの式を解いて探す")
    say("    やり方：中心線で開ける16枚の背の角 ψ を押さえ、残りの角ぜんぶを最小二乗で解く（連続に追う）")
    spine_var = spine_variable(mo, open16, spine)
    if spine_var is None:
        bad("中心線で開く角にあたるちょうつがいが木の中に無い")
        return
    x = np.zeros(len(x0))
    rows = []
    for psi_deg in (0, 5, 10, 20, 40, 60, 90):
        psi = math.radians(psi_deg)
        x, res = solve(mo, x, [(spine_var, psi)])
        spread = max(abs(x[i]) for i in cutvars) if cutvars else 0.0
        rows.append((psi_deg, res, spread))
        say(f"    ψ={psi_deg:3d}°：閉じの残り {res:.2e}／中割り線の角の最大 {math.degrees(spread):.1f}°")
    if all(r[1] < 1e-9 for r in rows):
        say("    → 中心線で開く動き自体は閉じる（＝胴と脚の半分が一緒に開ける）")
    else:
        bad("中心線で開く動きが閉じない")

    # 開いた姿から、先を折り始められるか（中割りの枝に入れるか）
    say("  枝2の続き：**開いた姿から中割り線の角を1本だけ**押し上げて道を追い、"
        "[H] の目標終端に着くかを置かれ方で照合する")
    say("    🚨 中割り線の角を2本以上押さえるのは過剰拘束（解の族が細いので一般に解が消える）＝押さえるのは1本だけ。"
        "この追い方は `check_reversefold_reference.py` で「2枚のフラップ＝古典的な中割り」でも追えることを確かめてある。")
    spinevars = [mo.var_of[k] for k in mo.tree_ids if not mo.bonds[k]["bondId"].startswith("cut:")]
    for seed_deg in (150, 90, 30):
        tr = trace_branch(mo, cutvars, spinevars, open_seed_deg=seed_deg)
        if not tr["path"]:
            say(f"    出だしの開き {seed_deg}°：{tr.get('why','道が作れない')}")
            continue
        opened = max(p["open"] for p in tr["path"])
        last = tr["path"][-1]
        if not tr["ok"]:
            say(f"    出だしの開き {seed_deg}°：中割り線の角 {tr['stop'][0]}° で閉じが残る {tr['stop'][1]:.2e} → 止まる")
            continue
        # 終端の照合：置かれ方が [H] の目標終端と同じか（層は [J] の話）
        T = mo.placements(tr["x"])
        worst_end = 0.0
        for fid in mo.ids:
            want = T_end[fid]
            d = max(float(np.linalg.norm(xform(T[fid], p) - xform(want, p))) for p in cut["faces"][fid]["cur"])
            worst_end = max(worst_end, d)
        say(f"    出だしの開き {seed_deg}°：中割り線の角 180° まで閉じたまま到達"
            f"／途中のほかの折りの開きの最大 {opened:.1f}°"
            f"／閉じ直しのあと残る開き {tr.get('open_end', 0):.1f}°（{len(tr.get('close', []))}回）"
            f"／**目標終端との食い違い {worst_end:.2e}** → {'目標終端に到達' if worst_end < 1e-6 else '別の姿に着いた'}")
        for p in tr["path"][::6] + [last]:
            say(f"      中割り線 {p['rho']:5.1f}°：ほかの折りの開き（最大） {p['open']:6.1f}°"
                f"／中割り線の角たち {[round(c,1) for c in p['cuts']]}／閉じの残り {p['res']:.1e}")
        if worst_end < 1e-6:
            say("      → **出発（平ら）→ 開く → 先を折る → 閉じ直す** の道が、全結びを保ったままつながった")
        break

    # 1次のたわみ（出発は特異なので上限として読む）
    say("  出発での1次のたわみ（拘束の核）＝どの折りが動き出せるか")
    U, S, Vt = np.linalg.svd(J)
    null = Vt[rank:]
    say(f"    核の次元 {null.shape[0]}")
    for i, v in enumerate(null):
        cs = [v[k] for k in cutvars]
        others = [v[k] for k in range(len(v)) if k not in cutvars]
        say(f"      たわみ{i+1}：中割り線の角の速さ（ばらつき {max(cs)-min(cs):.3f}・大きさ {max(abs(np.array(cs))):.3f}）"
            f"／ほかの折りの速さの最大 {max(abs(np.array(others))):.3f}")
    say("    → 出発では中割り線の角は**8本そろってしか**動き出せない（ばらつき0）。"
        "中割りは「先に開いてから折る」＝出発の1次のたわみでは見えない道。")
    return


def stack_feasibility(cut, T_end, Rpi, faces):
    """終端の平らな姿で、紙が自分を突き抜けない上下の順が**あるか**を、拘束から数える。
       決まり（平らに畳んだ紙の古典的な条件）：
         ① 重なる2枚には上下がある
         ② 同じ折り（180°）でつながる2枚のあいだに、その折りをまたぐ紙は入れない（taco-tortilla）
         ③ 同じ場所にある2つの折りは、**入れ子**でなければならない（taco-taco・交差してはいけない）
       付け根側の紙の上下は出発のまま（動いていない＝engine の層の順をそのまま使う。これは「動かない紙」の事実）。
       先の部分の順は**決めずに**、①〜③を満たす並べ方をぜんぶ数える。"""
    from shapely.geometry import Polygon, Point
    from shapely.ops import unary_union, polygonize

    tip, base = sorted(cut["tip"]), sorted(cut["base"])
    panels = {}
    for fid in tip:
        panels[fid] = Polygon([xform(Rpi, p)[:2] for p in cut["faces"][fid]["cur"]])
    for fid in base:
        panels[fid] = Polygon(cut["faces"][fid]["cur"])
    ids = tip + base
    # ほかの紙が着地の所に重なっていないか（重なるなら柱に入れる必要がある）
    landing = unary_union([panels[f] for f in tip])
    outside = [fid for fid, f in cut["faces"].items()
               if fid not in panels and Polygon(f["cur"]).intersection(landing).area > 1e-9]
    say(f"  柱に入る紙：折り返した先 {len(tip)}枚＋脚の付け根側 {len(base)}枚"
        f"／着地の所に重なるほかの紙 {len(outside)}枚 {'（無し＝この16枚だけで決まる）' if not outside else outside}")
    if outside:
        say("  ⚠ ほかの紙が重なる＝この数え方（16枚の柱）では足りない")

    # 終端で 180° に折れている結び（＝この柱の中の折り）
    folded = []
    for b in cut["bonds"]:
        a, c = b["faceIds"]
        if a in panels and c in panels:
            ta, tc = (a in cut["tip"]), (c in cut["tip"])
            if ta != tc and not b["bondId"].startswith("cut:"):
                continue      # 先と付け根をまたぐ結びは中割り線のものだけ
            seg = [xform(Rpi, p)[:2] if ta else np.array(p[:2]) for p in b["cur"]]
            folded.append((a, c, [tuple(seg[0]), tuple(seg[1])], b["bondId"]))
    say(f"  柱の中の「180°の折り」{len(folded)}本"
        f"（中割り線 {sum(1 for f in folded if f[3].startswith('cut:'))}・脚の中の折り {sum(1 for f in folded if not f[3].startswith('cut:'))}）")

    # 重なりの区画（ぜんぶの面のふちで割る）と、そこを覆う紙
    edges = unary_union([panels[i].boundary for i in ids])
    cells = [c for c in polygonize(edges) if c.area > 1e-10]
    cover = []
    for c in cells:
        p = c.representative_point()
        cv = [i for i in ids if panels[i].contains(p)]
        if len(cv) >= 2:
            cover.append((c, cv))
    say(f"  重なりの区画 {len(cells)}個（2枚以上が重なる所 {len(cover)}個）")

    # 拘束を作る
    known = []      # (下, 上)＝動かない紙の出発の上下
    lay = {fid: cut["faces"][fid]["layer"] for fid in base}
    for i in range(len(base)):
        for j in range(i + 1, len(base)):
            a, b_ = base[i], base[j]
            if panels[a].intersection(panels[b_]).area > 1e-9:
                known.append((b_, a) if lay[a] > lay[b_] else (a, b_))
    pairs = []      # (A,B,区画に効く紙の集合)＝同じ折りでつながる2枚
    tort = []       # (A,B,C)＝C は A,B のあいだに入れない
    for (a, c, seg, bid) in folded:
        ln = M.line_of(seg)
        act = set()
        for cell, cv in cover:
            if a in cv and c in cv and cell.distance(Point(*mid(seg))) < 10:
                act |= set(cv)
        pairs.append((a, c, ln, act))
        for o in act:
            if o in (a, c):
                continue
            # C がその折りの線をまたいでいる（線の両側に面積がある）＝あいだに入れない
            if crosses(panels[o], seg):
                tort.append((a, c, o))
    # 同じ線の上にある折りどうし（入れ子でなければならない）
    same = {}
    for k, (a, c, ln, act) in enumerate(pairs):
        same.setdefault(ln, []).append(k)
    say(f"  上下が決まっている組（付け根どうし）{len(known)}／折りの組 {len(pairs)}"
        f"／またぎの禁止 {len(tort)}／同じ線の上の折りのまとまり {[len(v) for v in same.values()]}")

    # 並べ方を数える：下から積み、**同じ線の上の折りは入れ子**（開いた組は内側から閉じる）で枝刈り
    base_seq = sorted(base, key=lambda f: lay[f])           # 付け根側の上下は出発のまま（下から）
    pair_of = {}
    for k, (a, c, ln, act) in enumerate(pairs):
        pair_of.setdefault(a, []).append((c, ln, k))
        pair_of.setdefault(c, []).append((a, ln, k))
    tort_of = {}
    for a, c, o in tort:
        tort_of.setdefault((min(a, c), max(a, c)), set()).add(o)
    sols, tried, cap = [], [0], 100000

    def rec(seq, bi, tips_left, openst):
        """seq＝下から積んだ並び／bi＝付け根側の次／tips_left＝残りの先の部分／openst＝線ごとの開いた組"""
        tried[0] += 1
        if len(sols) >= cap or tried[0] > 2_000_000:
            return
        if bi == len(base_seq) and not tips_left:
            if not any(openst.values()):
                sols.append(list(seq))
            return
        cands = ([base_seq[bi]] if bi < len(base_seq) else []) + sorted(tips_left)
        for f in cands:
            newopen = {k: list(v) for k, v in openst.items()}
            good = True
            for (o, ln, k) in pair_of.get(f, []):
                st = newopen.setdefault(ln, [])
                if o in seq:                      # 相手がもう置かれている＝この組を閉じる
                    if not st or st[-1][0] != o:  # いちばん内側の組でなければ交差＝だめ
                        good = False; break
                    lo = st[-1][1]
                    banned = tort_of.get((min(f, o), max(f, o)), set())
                    if any(x in banned for x in seq[lo + 1:]):
                        good = False; break       # 折りのあいだに、またいでいる紙がある
                    st.pop()
                else:
                    st.append((f, len(seq)))
            if not good:
                continue
            seq.append(f)
            rec(seq, bi + (1 if f == (base_seq[bi] if bi < len(base_seq) else None) else 0),
                tips_left - {f}, newopen)
            seq.pop()

    rec([], 0, set(tip), {})
    say(f"  ①〜③を満たす並べ方 {len(sols)}通り（調べた枝 {tried[0]}）")
    if not sols:
        say("  → **終端の上下が1つも作れない**（この仮置きの中割り線では終端が成立しない）")
        return
    # 「先が付け根の層のあいだに入る」＝中割り／「先がぜんぶ上（下）」＝ふつうの外へ折る
    inside, outside_n = [], []
    for s in sols:
        pos = {f: i for i, f in enumerate(s)}
        tp = [pos[f] for f in tip]
        bp = [pos[f] for f in base]
        if max(tp) < min(bp) or min(tp) > max(bp):
            outside_n.append(s)
        elif min(bp) < min(tp) and max(tp) < max(bp):
            inside.append(s)
    say(f"  うち **先が付け根の層のあいだに入る（＝中割り）{len(inside)}通り** ／ 先がぜんぶ外側（＝ふつうの外へ折る）{len(outside_n)}通り"
        f" ／ どちらでもない {len(sols)-len(inside)-len(outside_n)}通り")
    say("  ⚠ ここは**終端の静止した姿**の話。途中の非貫通は別（次の段）。"
        "また、重なりの無い紙どうしにも上下を付けて数えているので、通り数は下限側の見積り。")
    return dict(sols=sols, inside=inside, outside=outside_n, tip=tip, base=base)


def mid(seg):
    return ((seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2)


def crosses(poly, seg):
    """多角形が、その線分の乗る直線を「線分の所で」またいでいるか（両側に面積がある）"""
    from shapely.geometry import Polygon
    a, b = np.array(seg[0], float), np.array(seg[1], float)
    d = b - a
    n = np.array([-d[1], d[0]])
    n = n / np.linalg.norm(n)
    big = 10.0
    half1 = Polygon([a + d * -big + n * 1e-9, b + d * big + n * 1e-9,
                     b + d * big + n * big, a + d * -big + n * big])
    half2 = Polygon([a + d * -big - n * 1e-9, b + d * big - n * 1e-9,
                     b + d * big - n * big, a + d * -big - n * big])
    return poly.intersection(half1).area > 1e-9 and poly.intersection(half2).area > 1e-9


def pick_anchor(cut, faces, petalTip):
    """動かない側の板を根にする（羽の先に近い面）"""
    best, bd = None, 1e9
    for fid, f in cut["faces"].items():
        c = (sum(p[0] for p in f["cur"]) / len(f["cur"]), sum(p[1] for p in f["cur"]) / len(f["cur"]))
        d = M.dist(c, petalTip)
        if d < bd:
            best, bd = fid, d
    return best


def spine_variable(mo, open16, spine):
    """中心線の上にあって、開ける16枚とその外を分けるちょうつがい（木の中）"""
    for k in mo.tree_ids:
        b = mo.bonds[k]
        if M.line_of(b["cur"]) != spine:
            continue
        if (b["faceIds"][0] in open16) != (b["faceIds"][1] in open16):
            return mo.var_of[k]
    return None


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
