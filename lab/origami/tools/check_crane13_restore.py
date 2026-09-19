# -*- coding: utf-8 -*-
"""つる⑬：接触条件を**保存原本の上下（stackAt）と面の向き**から復元し、以前の条件と比べる → 1次検査（2026-09-17）

本人指示：
  - 重なる組について、出発時に**実際に重なる場所**の上下を保存原本で確かめ、面の回転に伴って「相手がいる側」を追う（接している間の履歴を保持）。
  - 背は、折った側（その場所の上下）・面の表裏・結びの向きから開ける向きを求める。
  - 方法は `check_crane13_sides.py`（2枚・裏返し・回転・山・4枚）で先に検算ずみ。
  - 復元した条件を以前の条件（layer の番号の比較で決めたもの）と比べる。一致すれば根拠が付く。違えば直して同じ1次検査をやり直す。
    履歴にも根拠が無い組（その点で同じ層で上下が決まらない・点が取れない）だけ未確定。
  - 接触条件が確かめられたら、⑬の 0° 固定も外して向きがあるか（前の指示の2）。あれば小さな一歩（3）。
🚨 緩みの大小は「邪魔の強さ」ではない。bondId は重複する→オブジェクトと面の組で扱う。1次の確かめ。単独模型の成功とは別。本体・UI・保存形式は無変更。

「履歴を保持」の中身：第13段で、この姿 X までの経路の上の姿（出発・89歩・180歩）では、どの組も**出発と同じ置かれ方で接したまま**
  （背は 0° のまま）だった。だから出発で決まった「相手がいる側」（面に貼り付けた σ）が、そのまま X まで持ち運ばれる。

使い方： python check_crane13_restore.py
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import json
import math
import os
import subprocess
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


def det(m):
    return m[0] * m[3] - m[1] * m[2]


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
    spf = set(spine["faceIds"])
    on_c = lambda b: all(abs(M.cross(M.sub(p_, legTip), u)) < 1e-9 for p_ in b["cur"])
    inner = np.array([on_c(b) and {f.split("#")[0] for f in b["faceIds"]} != spf for b in pins])
    hinges = [b for b in mo.bonds if b["kind"] == "hinge"]
    adj = set()
    for b in mo.bonds:
        adj.add(tuple(b["faceIds"]))
        adj.add(tuple(reversed(b["faceIds"])))
    T0 = mo.placements(np.zeros(n))
    T0rel = lambda a, b: np.linalg.inv(T0[a]) @ T0[b]
    free = np.ones(n, bool)
    free[cv] = False
    fi = np.where(free)[0]
    say("🚨 鶴全体・1次。単独模型の成功とは別。緩みの大小は「邪魔の強さ」ではない。")

    # ---------- 姿 X（第11〜13段と同じ） ----------
    def angles(xx, ref_):
        T_ = mo.placements(xx)
        return np.array([OP.unwrap(OP.rel_angle(T_, b), r) for b, r in zip(pins, ref_)])

    X = np.load(os.path.join(HERE, "crane13_open_path_outer-first_step180.npy"))
    ang = np.array([OP.unwrap(OP.rel_angle(mo.placements(X), b), s_ * (0.0 if i else math.pi)) for b, s_, i in zip(pins, sgn, inner)])
    tgt = np.where(inner, 0.0, sgn * math.pi)
    X0 = X.copy()

    def fun0(z):
        xx = X0.copy()
        xx[fi] = z
        return np.concatenate([1e6 * mo.residual(xx), 1e3 * (angles(xx, ang) - tgt), 1e-3 * (z - X0[fi])])

    X[fi] = least_squares(fun0, X0[fi], method="trf", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000).x
    TX = mo.placements(X)
    ang = angles(X, ang)
    pen, _ = OP.penetration(mo, TX, faces, adj, T0rel)
    say(f"姿 X：全結び {OP.all_bond_error(mo, TX):.1e}／すり抜け {pen:.1e}／角のずれ {float(np.max(np.abs(ang - tgt))):.1e}")

    # 接している組・0°の背（第13段と同じ拾い方）
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
            same = np.allclose(np.linalg.inv(TX[a]) @ TX[b], T0rel(a, b), atol=OP.DEPTH)
            lap.append(dict(a=a, b=b, pts=pts, area=it.area, same=same,
                            layer_s=1.0 if faces[b]["layer"] >= faces[a]["layer"] else -1.0))
    h0 = [b for b in hinges if id(b) not in pin_set and abs(OP.rel_angle(TX, b)) < 1e-6]
    hsign = {id(b): OP.open_sign(faces, b) for b in h0}
    say(f"接している重なりの組 {len(lap)}（出発と同じ置かれ方 {sum(c['same'] for c in lap)}）・0°の背 {len(h0)}本")

    # ---------- 保存原本に問い合わせる点 ----------
    queries = []
    for ci, c_ in enumerate(lap):
        # X の重なりの頂点を a のいまの位置（出発の平らな座標）へ戻し、重心と、重心へ 30%・60% 寄せた頂点を点にする
        loc = [(np.linalg.inv(TX[c_["a"]]) @ np.append(p, 1))[:2] for p in c_["pts"]]
        cen = np.mean(loc, axis=0)
        cand = [cen] + [cen + (q - cen) * k for q in loc for k in (0.3, 0.6)]
        for p in cand:
            queries.append(dict(kind="lap", idx=ci, p=[float(p[0]), float(p[1])], a=c_["a"].split("#")[0], b=c_["b"].split("#")[0]))
    for hi, b in enumerate(h0):
        a_, c_ = b["faceIds"]
        it = Polygon(faces[a_]["cur"]).intersection(Polygon(faces[c_]["cur"]))
        pts = []
        if it.area > 1e-12:
            cen = np.array(it.representative_point().coords[0])
            ring = [np.array(q) for q in list(it.exterior.coords)[:-1]] if it.geom_type == "Polygon" else []
            pts = [cen] + [cen + (q - cen) * k for q in ring for k in (0.3, 0.6)]
        for p in pts:
            queries.append(dict(kind="hinge", idx=hi, p=[float(p[0]), float(p[1])], a=a_.split("#")[0], b=c_.split("#")[0]))
    qpath = os.path.join(HERE, "crane13_stack_query.json")
    json.dump(dict(queries=queries), open(qpath, "w", encoding="utf-8"))
    r = subprocess.run(["node", os.path.join(HERE, "export_crane13_stacks.js"), "crane", qpath], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        say(r.stderr)
        bad("保存原本の stackAt を読めない")
        return
    say("  " + r.stdout.strip())
    SC = json.load(open(os.path.join(HERE, "crane13_stack_crane.json"), encoding="utf-8"))
    if SC["fingerprint"] != D["meta"]["stateFingerprint"]:
        bad("保存原本の指紋が crane13_input.json と違う")
        return
    efaces = {f["faceId"]: f for f in SC["faces"]}
    # 面の向きの一致（原本の xf と入力の xf）
    worst = max(max(abs(x - y) for x, y in zip(efaces[f.split("#")[0]]["xf"], faces[f]["xf"])) for f in ids)
    say(f"  原本の面の置かれ方と入力の置かれ方のずれ（最大）{worst:.1e}")

    def sigma(stack, a, b):
        ids_ = [s["faceId"] for s in stack]
        if a not in ids_ or b not in ids_:
            return "点に無い"
        la = next(s["layer"] for s in stack if s["faceId"] == a)
        lb = next(s["layer"] for s in stack if s["faceId"] == b)
        if la == lb:
            return "同じ層"
        above = 1.0 if ids_.index(b) < ids_.index(a) else -1.0
        return above * (1.0 if det(efaces[a]["xf"]) > 0 else -1.0)

    got = {}
    for q in SC["results"]:
        got.setdefault((q["kind"], q["idx"]), []).append(sigma(q["stack"], q["a"], q["b"]))

    def decide(vals):
        nums = {v for v in vals if isinstance(v, float)}
        if len(nums) == 1:
            return nums.pop(), vals
        if len(nums) > 1:
            return "点で食い違う", vals
        return "決まらない", vals

    # ---------- 重なり：復元と比較 ----------
    say("\n[1] 重なる組：保存原本の上下 × a の表裏 → σ（b は a の表側 +1／裏側 −1）→ X での相手の向き")
    rest_c, diff_c, und_c = {}, [], []
    for ci, c_ in enumerate(lap):
        s, vals = decide(got.get(("lap", ci), []))
        if not isinstance(s, float):
            und_c.append((ci, s, vals))
            continue
        fa = 1.0 if det(faces[c_["a"]]["xf"]) > 0 else -1.0
        new_side = s * fa           # 出発の平らな座標で b がいる z の向き（= X では R_a を掛けて持ち運ぶ）
        rest_c[ci] = new_side
        if new_side != c_["layer_s"]:
            diff_c.append(ci)
        n_pts = sum(1 for v in vals if isinstance(v, float))
        c_["n_pts"] = n_pts
    say(f"  {len(lap)}組：復元できた {len(rest_c)}・以前（layer の比較）と**違う** {len(diff_c)}・未確定 {len(und_c)}")
    for ci, s, vals in und_c[:10]:
        c_ = lap[ci]
        say(f"    未確定：{fname(c_['a'])} × {fname(c_['b'])}（{s}：点ごと {vals[:5]}）")
    for ci in diff_c[:10]:
        c_ = lap[ci]
        say(f"    違う：{fname(c_['a'])} × {fname(c_['b'])}：以前 {'+' if c_['layer_s'] > 0 else '−'}／復元 {'+' if rest_c[ci] > 0 else '−'}")

    # ---------- 背：復元と比較 ----------
    say("\n[2] 0°の背：その場所の上下（折った側）× 面の表裏 × 結びの向き → 開く回転の向き")
    rest_h, diff_h, und_h = {}, [], []
    for hi, b in enumerate(h0):
        s, vals = decide(got.get(("hinge", hi), []))
        if not isinstance(s, float):
            und_h.append((hi, s, vals))
            continue
        a_, c_ = b["faceIds"]
        fa = 1.0 if det(faces[a_]["xf"]) > 0 else -1.0
        p0, p1 = MO.p3(b["cur"][0]), MO.p3(b["cur"][1])     # 素材の結び seg を a の置かれ方で写した線（向きも同じ）
        d = (p1 - p0) / np.linalg.norm(p1 - p0)
        cen = np.array([*np.mean(faces[c_]["cur"], axis=0), 0.0])
        v = np.cross(d, cen - p0)
        s_open = 1.0 if float(v @ (s * fa * np.array([0, 0, 1.0]))) > 0 else -1.0
        rest_h[id(b)] = s_open
        if s_open != hsign[id(b)]:
            diff_h.append(b)
    say(f"  {len(h0)}本：復元できた {len(rest_h)}・以前（layer の比較）と**違う** {len(diff_h)}・未確定 {len(und_h)}")
    for hi, s, vals in und_h:
        b = h0[hi]
        say(f"    未確定：{b['bondId']} {fname(b['faceIds'][0])}|{fname(b['faceIds'][1])}（{s}：{vals[:5]}）")
    for b in diff_h:
        say(f"    違う：{b['bondId']} {fname(b['faceIds'][0])}|{fname(b['faceIds'][1])}")

    # 第13段の41条件（緩みが残った条件）に絞った比較
    inv41 = json.load(open(os.path.join(HERE, "crane13_contacts_involved.json"), encoding="utf-8")) \
        if os.path.exists(os.path.join(HERE, "crane13_contacts_involved.json")) else None

    # ---------- 線形計画 ----------
    Jc, _ = mo.jac(X, H)
    Ja = np.zeros((len(pins), n))
    for k in fi:
        xp, xm = X.copy(), X.copy()
        xp[k] += H
        xm[k] -= H
        Ja[:, k] = (angles(xp, ang) - angles(xm, ang)) / (2 * H)

    def kernel(fixed_cut):
        cols = fi if fixed_cut else np.arange(n)
        U, S, Vt = np.linalg.svd(Jc[:, cols])
        rank = int((S > 1e-7 * S[0]).sum())
        N = np.zeros((n, len(cols) - rank))
        N[cols, :] = Vt[rank:].T
        return N

    def solve(N, side_c, side_h, slack=False):
        k = N.shape[1]
        Tp = [mo.placements(X + H * N[:, c]) for c in range(k)]
        Tm = [mo.placements(X - H * N[:, c]) for c in range(k)]
        R, own = [], []
        for b in h0:
            s_ = side_h.get(id(b))
            if s_ is None:
                continue
            R.append([s_ * (OP.rel_angle(Tp[c], b) - OP.rel_angle(Tm[c], b)) / (2 * H) for c in range(k)])
            own.append(("背", b))
        for ci, c_ in enumerate(lap):
            s_ = side_c.get(ci)
            if s_ is None:
                continue
            nz = TX[c_["a"]][:3, :3] @ np.array([0, 0, 1.0])        # 出発の +z を a に貼り付けて持ち運ぶ
            for p in c_["pts"]:
                ph = np.append(p, 1.0)
                la = np.linalg.inv(TX[c_["a"]]) @ ph
                lb = np.linalg.inv(TX[c_["b"]]) @ ph
                R.append([s_ * float(nz @ (((Tp[c][c_["b"]] - Tm[c][c_["b"]]) @ lb)[:3] - ((Tp[c][c_["a"]] - Tm[c][c_["a"]]) @ la)[:3])) / (2 * H)
                          for c in range(k)])
                own.append(("重なり", ci))
        R = np.array(R)
        O = sgn[~inner][:, None] * (Ja[~inner] @ N)
        Ji = Ja[inner] @ N
        rr = linprog(np.zeros(k), A_ub=np.vstack([-R, O]), b_ub=np.zeros(len(R) + len(O)), A_eq=Ji, b_eq=sgn[inner],
                     bounds=[(-1e3, 1e3)] * k, method="highs")
        return rr

    layer_c = {ci: c_["layer_s"] for ci, c_ in enumerate(lap)}
    layer_h = {id(b): hsign[id(b)] for b in h0}
    N9, Nall = kernel(True), kernel(False)
    say(f"\n[3] 1次検査（外側は 180° から戻る側だけ・内側を開く向きへ速さ1）：核 ⑬固定 {N9.shape[1]}次元／⑬自由 {Nall.shape[1]}次元")
    rows = []
    for lab, sc, sh in (("以前（layer の比較）", layer_c, layer_h),
                        ("復元（保存原本の上下×表裏）", {**{ci: None for ci, _, _ in und_c}, **rest_c}, {**{id(h0[hi]): None for hi, _, _ in und_h}, **rest_h})):
        r9 = solve(N9, sc, sh)
        ra = solve(Nall, sc, sh)
        rows.append((lab, r9, ra))
        say(f"  {lab}：⑬ 0° 固定 → 向き {'**ある**' if r9.status == 0 else '無い'}／⑬ も自由 → 向き {'**ある**' if ra.status == 0 else '無い'}")

    same_all = not diff_c and not diff_h
    say("\n[答え]")
    if same_all and not und_c and not und_h:
        say("  復元した条件は、168組・47本とも以前の条件と**一致**＝以前の制約に「保存原本の上下×表裏」の根拠が付いた。未確定は無い。")
    elif same_all:
        say(f"  復元できた条件は以前と一致。ただし未確定が 重なり {len(und_c)}・背 {len(und_h)}（その点で上下が決まらない）。")
    else:
        say(f"  以前と違う条件がある（重なり {len(diff_c)}・背 {len(diff_h)}）→ 復元した条件で1次検査をやり直した（上の[3]の「復元」行）。")
    r9, ra = rows[-1][1], rows[-1][2]
    if ra.status == 0:
        say("\n[4] ⑬ も自由にして向きがある → 小さな一歩（内側 0.2°）を進めて、全結びと交差を再検査")
        d = Nall @ ra.x
        X2 = X + d * math.radians(0.2)
        for _ in range(40):
            J, res_ = mo.jac(X2)
            if np.linalg.norm(res_) < 1e-13:
                break
            X2 = X2 + np.linalg.lstsq(J, -res_, rcond=None)[0]
        T2 = mo.placements(X2)
        pen2, who2 = OP.penetration(mo, T2, faces, adj, T0rel)
        say(f"  全結び {OP.all_bond_error(mo, T2):.1e}／すり抜け {pen2:.1e}" + ("" if who2 is None else f"（{fname(who2[0])} × {fname(who2[1])}）"))
    else:
        say("  ⑬ の 0° 固定を外しても1次で向きは無い → **この姿での1次検査の結果として止める**（一歩は進めない）。")
        say("  🚨 1次だけ。2次以上の動き出し・別の姿からの道は否定しない。剛体で不可能とは言わない。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
