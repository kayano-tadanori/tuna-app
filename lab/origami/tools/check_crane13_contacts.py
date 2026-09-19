# -*- coding: utf-8 -*-
"""つる⑬：第12段で満たせなかった条件（接触・0°の背）を、面の組・素材の区間・3Dの位置で特定し、離れてよい向きを経路から検算する（2026-09-17）

本人指示（順に）
  1. 不成立に関わる胴の重なりと b4・b20 を、面の組と素材上の区間で特定。保存済みの3D姿勢から接触位置を確認し、
     接触直前の経路から離れてよい向きを検算。**元の layer 番号だけで上下を決めない**。経路から決められない接触は未確定。
  2. 接触条件を確認できたら、同じ姿で⑬の8本の0°固定も外し、全結びと接触条件を保ったまま内側を開く向きがあるか。
  3. 向きがあれば小さな一歩を進めて再検査。無ければ1次検査の結果として止める。
  🚨 緩みの大小は「邪魔の強さ」ではない（制約の尺度・解の選び方に依存）。ここでは「緩みが残った条件」とだけ呼ぶ。
  🚨 bondId は重複する → 結びは**オブジェクトと面の組**で扱う。本体・UI・保存形式は無変更。単独模型の成功とは別。

経路の上で使える姿（保存ずみ・追い直しはしない）
  出発 x=0／89歩（外側 ~88°）／180歩（外側 180°＝姿 X。第11段の仕上げを同じく掛ける）／181歩（内側 1°・別の組ですり抜けあり）
  → 各条件について、この4つの姿での「開き（背）」「すき間と上下（重なり）」を並べる。
     **0 以外の値を取った姿があれば、その符号が経路で実際に通った側**（その姿ですり抜けが無ければ許される側の証拠）。
     すべての姿で接したまま（背は 0°・重なりは出発と同じ置かれ方）なら、経路からは決まらない＝**未確定**。

使い方： python check_crane13_contacts.py
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import math
import os
import sys
import traceback

import numpy as np
from scipy.optimize import least_squares, linprog
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("open_path", os.path.join(HERE, "check_crane13_open_path.py"))
OP = importlib.util.module_from_spec(_s)
_s.loader.exec_module(OP)
sys.argv = _argv
P, M, MO = OP.P, OP.M, OP.MO
ng = []
TOUCH = 1e-6
H = 1e-6


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def inv_xf(m, p):
    x, y = p[0] - m[4], p[1] - m[5]
    return (m[0] * x + m[2] * y, m[1] * x + m[3] * y)


def main():
    D, faces_all, cut, leg, geo = P.real_cut(60.0, 0.5, legno=1, oripa=True)
    mo, faces, bonds, tipset = P.model_M3(cut, geo[1])
    OP.FACES.update(faces)
    n = len(mo.tree_ids)
    cv = P.cut_vars(mo)
    legTip, _, u = geo
    nrm = (-u[1], u[0])
    neck = [v["neck"] for v in D["landmarks"]["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces_all, D["bonds"], legTip, u, nrm, 0.3 * neck)
    leg1 = {f"{fid}#{k}" for fid in legs[0] for k in ("tip", "base")}
    leg2 = set(legs[1])
    place = lambda f: "首" if f in leg1 else "尾" if f in leg2 else "胴"
    fname = lambda f: f"{place(f)}{OP.short(f)}"
    pins = [b for b in mo.bonds if b["faceIds"][0] in leg1 and b["faceIds"][1] in leg1 and not b["bondId"].startswith("cut:")]
    pin_set = {id(b) for b in pins}
    sgn = np.array([OP.open_sign(faces, b) for b in pins])
    spine = M.leg_structure(legs[0], faces_all, D["bonds"], legTip, u)["spine_bond"]
    spf = {f for f in spine["faceIds"]}
    on_c = lambda b: all(abs(M.cross(M.sub(p_, legTip), u)) < 1e-9 for p_ in b["cur"])
    inner = np.array([on_c(b) and {f.split("#")[0] for f in b["faceIds"]} != spf for b in pins])   # 面で判定（名前に頼らない）
    hinges = [b for b in mo.bonds if b["kind"] == "hinge"]
    adj = set()
    for b in mo.bonds:
        adj.add(tuple(b["faceIds"]))
        adj.add(tuple(reversed(b["faceIds"])))
    T0 = mo.placements(np.zeros(n))
    T0rel = lambda a, b: np.linalg.inv(T0[a]) @ T0[b]
    free = np.ones(n, bool)
    free[cv] = False
    say("🚨 鶴全体・1次。単独模型の成功とは別。緩みの大小は「邪魔の強さ」ではない。")

    # ---------- 経路の上の姿 ----------
    def angles(xx, ref_, which=pins):
        T_ = mo.placements(xx)
        return np.array([OP.unwrap(OP.rel_angle(T_, b), r) for b, r in zip(which, ref_)])

    X = np.load(os.path.join(HERE, "crane13_open_path_outer-first_step180.npy"))
    ang = np.array([OP.unwrap(OP.rel_angle(mo.placements(X), b), s_ * (0.0 if i else math.pi)) for b, s_, i in zip(pins, sgn, inner)])
    tgt = np.where(inner, 0.0, sgn * math.pi)
    fi = np.where(free)[0]
    X0 = X.copy()

    def fun0(z):
        xx = X0.copy()
        xx[fi] = z
        return np.concatenate([1e6 * mo.residual(xx), 1e3 * (angles(xx, ang) - tgt), 1e-3 * (z - X0[fi])])

    X[fi] = least_squares(fun0, X0[fi], method="trf", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000).x
    states = [("出発", np.zeros(n)),
              ("89歩", np.load(os.path.join(HERE, "crane13_open_path_outer-first_step89.npy"))),
              ("180歩=X", X),
              ("181歩", np.load(os.path.join(HERE, "crane13_open_path_outer-first_step181.npy")))]
    TS = {nm: mo.placements(x) for nm, x in states}
    for nm, x in states:
        pen, who = OP.penetration(mo, TS[nm], faces, adj, T0rel)
        say(f"  姿 {nm}：全結び {OP.all_bond_error(mo, TS[nm]):.1e}／すり抜け {pen:.1e}"
            + ("" if who is None else f"（{fname(who[0])} × {fname(who[1])}）"))
    TX = TS["180歩=X"]

    # ---------- 第12段の線形計画を、オブジェクトで組み直す ----------
    ids = mo.ids
    Q = {f: [MO.xform(TX[f], p) for p in faces[f]["cur"]] for f in ids}
    Nn = {}
    for f in ids:
        nn = np.cross(Q[f][1] - Q[f][0], Q[f][2] - Q[f][0])
        Nn[f] = nn / np.linalg.norm(nn)
    lap = []
    for i in range(len(ids)):
        a = ids[i]
        for j in range(i + 1, len(ids)):
            b = ids[j]
            if (a, b) in adj:
                continue
            if np.linalg.norm(np.cross(Nn[a], Nn[b])) > 1e-6 or abs(float(Nn[a] @ (Q[b][0] - Q[a][0]))) > TOUCH:
                continue
            e1 = Q[a][1] - Q[a][0]
            e1 = e1 / np.linalg.norm(e1)
            e2 = np.cross(Nn[a], e1)
            to2 = lambda p: (float(e1 @ (p - Q[a][0])), float(e2 @ (p - Q[a][0])))
            it = Polygon([to2(p) for p in Q[a]]).intersection(Polygon([to2(p) for p in Q[b]]))
            if it.area <= 1e-12:
                continue
            pts = [np.array(Q[a][0] + e1 * x_ + e2 * y_) for x_, y_ in list(it.exterior.coords)[:-1]]
            lap.append(dict(a=a, b=b, pts=pts, area=it.area, layer_s=1.0 if faces[b]["layer"] >= faces[a]["layer"] else -1.0))
    hsign = {id(b): OP.open_sign(faces, b) for b in hinges}
    h0 = [b for b in hinges if id(b) not in pin_set and abs(OP.rel_angle(TX, b)) < 1e-6]

    # 核（外側は戻る側だけ・⑬ 0）
    Jc, _ = mo.jac(X, H)
    Ja = np.zeros((len(pins), n))
    for k in fi:
        xp, xm = X.copy(), X.copy()
        xp[k] += H
        xm[k] -= H
        Ja[:, k] = (angles(xp, ang) - angles(xm, ang)) / (2 * H)

    def kernel(fixed_cut=True):
        cols = fi if fixed_cut else np.arange(n)
        U, S, Vt = np.linalg.svd(Jc[:, cols])
        rank = int((S > 1e-7 * S[0]).sum())
        N = np.zeros((n, len(cols) - rank))
        N[cols, :] = Vt[rank:].T
        return N

    def rows_for(N, sides_h, sides_c):
        """背・重なりの速さの行（許す向きを＋）。sides は条件ごとの向き（+1/-1/None=外す）"""
        k = N.shape[1]
        Tp = [mo.placements(X + H * N[:, c]) for c in range(k)]
        Tm = [mo.placements(X - H * N[:, c]) for c in range(k)]
        R, own = [], []
        for b in h0:
            s_ = sides_h.get(id(b))
            if s_ is None:
                continue
            R.append([s_ * (OP.rel_angle(Tp[c], b) - OP.rel_angle(Tm[c], b)) / (2 * H) for c in range(k)])
            own.append(("背", b))
        for ci, c_ in enumerate(lap):
            s_ = sides_c.get(ci)
            if s_ is None:
                continue
            nz = TX[c_["a"]][:3, :3] @ np.array([0, 0, 1.0])
            for p in c_["pts"]:
                ph = np.append(p, 1.0)
                la = np.linalg.inv(TX[c_["a"]]) @ ph
                lb = np.linalg.inv(TX[c_["b"]]) @ ph
                R.append([s_ * float(nz @ (((Tp[c][c_["b"]] - Tm[c][c_["b"]]) @ lb)[:3] - ((Tp[c][c_["a"]] - Tm[c][c_["a"]]) @ la)[:3])) / (2 * H)
                          for c in range(k)])
                own.append(("重なり", ci))
        return np.array(R) if R else np.zeros((0, k)), own

    def lp(N, sides_h, sides_c, with_slack=False):
        k = N.shape[1]
        R, own = rows_for(N, sides_h, sides_c)
        O = sgn[~inner][:, None] * (Ja[~inner] @ N)
        Ji = Ja[inner] @ N
        beq = sgn[inner]
        if not with_slack:
            r = linprog(np.zeros(k), A_ub=np.vstack([-R, O]), b_ub=np.zeros(len(R) + len(O)), A_eq=Ji, b_eq=beq,
                        bounds=[(-1e3, 1e3)] * k, method="highs")
            return r, own
        m = len(R)
        A = np.vstack([np.hstack([-R, -np.eye(m)]), np.hstack([O, np.zeros((len(O), m))])])
        r = linprog(np.concatenate([np.zeros(k), np.ones(m)]), A_ub=A, b_ub=np.zeros(m + len(O)),
                    A_eq=np.hstack([Ji, np.zeros((len(Ji), m))]), b_eq=beq, bounds=[(-1e3, 1e3)] * k + [(0, None)] * m, method="highs")
        return r, own

    N9 = kernel(True)
    layer_h = {id(b): hsign[id(b)] for b in h0}
    layer_c = {ci: c_["layer_s"] for ci, c_ in enumerate(lap)}
    r, own = lp(N9, layer_h, layer_c, with_slack=True)
    k = N9.shape[1]
    slack = r.x[k:]
    involved_h, involved_c = {}, {}
    for (kind, obj), t in zip(own, slack):
        if t > 1e-7:
            if kind == "背":
                involved_h[id(obj)] = obj
            else:
                involved_c[obj] = lap[obj]
    say(f"\n[1] 第12段（layer の上下で向きを決めた条件）で、緩みの合計を最小にしたとき緩みが残った条件：背 {len(involved_h)}本・重なりの組 {len(involved_c)}")
    say("  ⚠ 緩みの大小は制約の尺度と解の選び方に依存するので、並べるだけで強さとは読まない。")

    # ---------- 1. 特定と経路からの向き ----------
    say("\n[1a] 背（いま 0°＝折り重なったまま）：面の組・素材の区間・3Dの位置・経路の上の開き")
    verdict_h = {}
    for b in sorted(involved_h.values(), key=lambda b: (place(b["faceIds"][0]), faces[b["faceIds"][0]]["layer"])):
        a_, c_ = b["faceIds"]
        mseg = [inv_xf(faces[a_]["xf"], p) for p in b["cur"]]
        p3 = [MO.xform(TX[a_], p) for p in b["cur"]]
        hist = []
        for nm, _ in states:
            hist.append((nm, math.degrees(OP.rel_angle(TS[nm], b))))
        seen = [(nm, v) for nm, v in hist if abs(v) > 1e-4 and nm != "出発"]
        clean = [(nm, v) for nm, v in seen if nm in ("89歩", "180歩=X")]      # すり抜けの無い姿
        signs = {1 if v > 0 else -1 for _, v in clean}
        if len(signs) == 1:
            side = signs.pop()
            verdict = f"経路で決まる：{'+' if side > 0 else '−'} 側へ開いた姿がすり抜け無しで通った"
            verdict_h[id(b)] = side
        elif len(signs) > 1:
            verdict = "経路の上で両側を通った（向きは経路から一つに決まらない）＝未確定"
            verdict_h[id(b)] = None
        else:
            verdict = "経路の上の姿ではずっと 0°（折り重なったまま）＝**未確定**"
            verdict_h[id(b)] = None
        agree = "" if id(b) not in verdict_h or verdict_h[id(b)] is None else \
            f"／layer から決めた向き {'+' if hsign[id(b)] > 0 else '−'}（{'一致' if hsign[id(b)] == verdict_h[id(b)] else '**不一致**'}）"
        say(f"  {b['bondId']}：{fname(a_)} | {fname(c_)}／素材 {M.r3(mseg[0])}-{M.r3(mseg[1])}"
            f"／X での位置 {np.round(p3[0], 3).tolist()}-{np.round(p3[1], 3).tolist()}")
        say(f"    開き（度）：" + "・".join(f"{nm} {v:+.3f}" for nm, v in hist) + f" → {verdict}{agree}")

    say("\n[1b] 重なって接する組：面の組・素材の区間（両方の面で）・3Dの位置・経路の上のすき間")
    verdict_c = {}
    for ci, c_ in sorted(involved_c.items(), key=lambda t: (place(t[1]["a"]), place(t[1]["b"]))):
        a_, b_ = c_["a"], c_["b"]
        la = [inv_xf(faces[a_]["xf"], (np.linalg.inv(TX[a_]) @ np.append(p, 1))[:2]) for p in c_["pts"]]
        lb = [inv_xf(faces[b_]["xf"], (np.linalg.inv(TX[b_]) @ np.append(p, 1))[:2]) for p in c_["pts"]]
        hist, gaps = [], []
        for nm, _ in states:
            T_ = TS[nm]
            rel_same = np.allclose(np.linalg.inv(T_[a_]) @ T_[b_], T0rel(a_, b_), atol=OP.DEPTH)
            nz = T_[a_][:3, :3] @ np.array([0, 0, 1.0])
            # 出発で重なっていた点（a の上）を、それぞれの面に乗せて測る
            ds = []
            for p in c_["pts"]:
                q0 = np.linalg.inv(TX[a_]) @ np.append(p, 1)        # a のいまの位置の座標（出発の平ら）
                qb = np.linalg.inv(TX[b_]) @ np.append(p, 1)
                ds.append(float(nz @ (MO.xform(T_[b_], qb[:3]) - MO.xform(T_[a_], q0[:3]))))
            hist.append((nm, rel_same, min(ds), max(ds)))
        seen = [(nm, lo, hi) for nm, same, lo, hi in hist if not same and nm in ("89歩", "180歩=X")]
        sides = set()
        for nm, lo, hi in seen:
            if lo > TOUCH:
                sides.add(1)
            elif hi < -TOUCH:
                sides.add(-1)
            else:
                sides.add(0)
        if all(same for _, same, _, _ in hist):
            verdict = "経路の上の姿ではずっと出発と同じ置かれ方で重なったまま＝**未確定**"
            verdict_c[ci] = None
        elif sides in ({1}, {-1}):
            s_ = sides.pop()
            verdict = f"経路で決まる：b が a の {'+' if s_ > 0 else '−'} 側に離れた姿がすり抜け無しで通った"
            verdict_c[ci] = s_
        elif not seen:
            verdict = "すり抜けの無い姿（出発・89歩・180歩）ではずっと出発と同じ重なり（181歩だけ置かれ方が変わるが、すき間は接触の許容差 1e-6 の内で、その姿はすり抜けありなので証拠に使わない）＝**未確定**"
            verdict_c[ci] = None
        else:
            verdict = f"経路の上の姿では片側に決まらない（{sorted(sides)}）＝**未確定**"
            verdict_c[ci] = None
        agree = "" if verdict_c[ci] is None else f"／layer から決めた向き {'+' if c_['layer_s'] > 0 else '−'}（{'一致' if c_['layer_s'] == verdict_c[ci] else '**不一致**'}）"
        say(f"  {fname(a_)} × {fname(b_)}：重なり {c_['area']:.2e}")
        say(f"    素材 a：" + " ".join(M.r3(p) for p in la))
        say(f"    素材 b：" + " ".join(M.r3(p) for p in lb))
        say(f"    X での位置（重なりの頂点）：" + " ".join(str(np.round(p, 3).tolist()) for p in c_["pts"]))
        say("    経路の上：" + "・".join(f"{nm} {'出発と同じ重なり' if same else f'すき間 {lo:+.2e}〜{hi:+.2e}'}" for nm, same, lo, hi in hist)
            + f" → {verdict}{agree}")

    und_h = [i for i, v in verdict_h.items() if v is None]
    und_c = [i for i, v in verdict_c.items() if v is None]
    say(f"\n[1c] まとめ：背 {len(verdict_h)}本のうち経路で決まる {len(verdict_h) - len(und_h)}・未確定 {len(und_h)}"
        f"／重なり {len(verdict_c)}組のうち経路で決まる {len(verdict_c) - len(und_c)}・未確定 {len(und_c)}")
    say("  ⚠ 経路の上の姿は4つだけ（出発・89歩・180歩・181歩。181歩は別の組ですり抜けあり＝証拠に使わない）。")

    if und_h or und_c:
        say("\n[2][3] 接触条件が確認できない（未確定の条件がある）ので、⑬の固定を外す検査と一歩進める検査は**行わない**。")
        say("  参考（layer の上下で向きを決めたままの計算であって、確認ではない）：")
        Nall = kernel(False)
        r_all, _ = lp(Nall, layer_h, layer_c)
        r_fix, _ = lp(N9, layer_h, layer_c)
        say(f"    ⑬ 0° 固定：核 {N9.shape[1]}次元・向き {'ある' if r_fix.status == 0 else '無い'}"
            f"／⑬ も自由：核 {Nall.shape[1]}次元・向き {'ある' if r_all.status == 0 else '無い'}")
        # 未確定の条件を外すと、向きがあるか（どの条件が結果を左右するか）
        sh = {i: (None if i in und_h else s_) for i, s_ in layer_h.items()}
        sc = {i: (None if i in und_c else s_) for i, s_ in layer_c.items()}
        r_wo, _ = lp(N9, sh, sc)
        say(f"    参考：⑬ 0° 固定で、未確定の条件（上の {len(und_h)}本・{len(und_c)}組）だけを外すと：向き {'ある' if r_wo.status == 0 else '無い'}")
        return

    say("\n[2] 接触条件はすべて経路で確認できた → ⑬の8本の 0° 固定も外す")
    sh = {i: verdict_h.get(i, layer_h[i]) for i in layer_h}
    sc = {i: verdict_c.get(i, layer_c[i]) for i in layer_c}
    Nall = kernel(False)
    r_all, _ = lp(Nall, sh, sc)
    say(f"  核 {Nall.shape[1]}次元／内側を開きながら全結び・接触を保つ向き：{'ある' if r_all.status == 0 else '無い'}")
    if r_all.status != 0:
        say("  → その姿での1次検査の結果として止める。")
        return
    say("\n[3] 小さな一歩（内側 0.2°）を進めて再検査")
    d = Nall @ r_all.x
    X2 = X + d * math.radians(0.2)
    for _ in range(40):
        J, rr = mo.jac(X2)
        if np.linalg.norm(rr) < 1e-13:
            break
        X2 = X2 + np.linalg.lstsq(J, -rr, rcond=None)[0]
    T2 = mo.placements(X2)
    pen, who = OP.penetration(mo, T2, faces, adj, T0rel)
    say(f"  全結び {OP.all_bond_error(mo, T2):.1e}／すり抜け {pen:.1e}" + ("" if who is None else f"（{fname(who[0])} × {fname(who[1])}）"))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
