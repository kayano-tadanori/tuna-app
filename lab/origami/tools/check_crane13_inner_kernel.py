# -*- coding: utf-8 -*-
"""つる⑬：外側10本を 180° に開いた姿で、内側を開く向きの核を全部出し、交わらない向きがあるか（1点の線形の確かめ・2026-09-17）

本人指示（第10段 §44 の 1）：外側 180° の姿で、内側を開く向きの**核（自由度）を全部**出し、
その中に胴の2枚（s20.keep 層-7 × s19.keep 層-7）が離れる向きがあるかを見る。**探索ではない**。
🚨 1次（速度）の確かめ。「1次で交わらない向きがある」は、その向きに実際に進めることの**必要条件**であって十分条件ではない。
   「1次で無い」も、2次以上で逃げる道を否定しない。本体・UI・保存形式は無変更。単独模型の成功とは別。

姿 X（外側 180°・内側 0°・⑬ 0）：第10段の外側を先にした道を 89歩目から同じ追い方で 180歩目まで追い直し、そのまま保存した姿
  （`crane13_open_path_outer-first_step180.npy`）。⚠ 181歩目の姿から逆算する作り方は角が 7° 飛び、すり抜けも出て使えなかった。
  X で全結び・すり抜け・角を確かめてから使う（目標の14本は ±180° の境目で符号が入れかわるので「閉じる向き」の判定から外す）。

見ること
  [A] X の確かめ：①全結び ②すり抜け（第9段と同じ判定）③外側 14本中10本が 180°・内側4本が 0°
  [B] X で**接している紙の組**（隣り合わない2枚で、同じ平面の上に重なる／辺・点で触れる）
  [C] 核：閉じ（全結び）＋外側10本を 180° に保つ＋⑬を 0 に保つ、の下で動ける向きの次元。その中で内側4本を動かせる次元
  [D] 線形計画：核の中で「内側4本をそれぞれ開く向きに 1 の速さ」かつ
      ・重なって接する組ごとに、重なりの頂点での法線方向の相対速度の符号がそろう（片側へ離れるか、平行にすべるだけ）
      ・0° の背（出発で折り重なっている）が閉じる向きへ動かない
      を満たす向きがあるか。組ごとの離れる向き（＋/−）は全部の組み合わせを試す。
  [E] 見つかった向きに 0.5° だけ進めて閉じ直し、第9段と同じすり抜けの判定で実際に交わらないか（1点の数値の確かめ）

使い方： python check_crane13_inner_kernel.py
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import itertools
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


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def main():
    D, faces_all, cut, leg, geo = P.real_cut(60.0, 0.5, legno=1, oripa=True)
    mo, faces, bonds, tipset = P.model_M3(cut, geo[1])
    OP.FACES.update(faces)
    n = len(mo.tree_ids)
    cv = P.cut_vars(mo)
    free = np.ones(n, bool)
    free[cv] = False
    fi = np.where(free)[0]
    leg_ids = {f"{fid}#{k}" for fid in leg for k in ("tip", "base")}
    pins = [b for b in mo.bonds if b["faceIds"][0] in leg_ids and b["faceIds"][1] in leg_ids
            and not b["bondId"].startswith("cut:")]
    sgn = np.array([OP.open_sign(faces, b) for b in pins])
    legTip, _, u = geo
    spine_id = M.leg_structure(leg, faces_all, D["bonds"], legTip, u)["spine_bond"]["bondId"]
    on_c = lambda b: all(abs(M.cross(M.sub(p_, legTip), u)) < 1e-9 for p_ in b["cur"])
    inner = np.array([on_c(b) and b["bondId"].split("@")[0] != spine_id for b in pins])
    hinges = [b for b in mo.bonds if b["kind"] == "hinge"]
    hsign = [OP.open_sign(faces, b) for b in hinges]
    adj = set()
    for b in mo.bonds:
        adj.add(tuple(b["faceIds"]))
        adj.add(tuple(reversed(b["faceIds"])))
    T0 = mo.placements(np.zeros(n))
    T0rel = lambda a, b: np.linalg.inv(T0[a]) @ T0[b]
    say(f"紙 56枚・木の変数 {n}（⑬ {len(cv)} は 0 に固定）／脚1の層の折り 14本（内側 {int(inner.sum())}・外側 {int((~inner).sum())}）")
    say("🚨 鶴全体の検査・1次の確かめ。単独模型の成功とは別。")

    # ---------- 姿 X（外側を先に開いた道の 180歩目をそのまま保存したもの） ----------
    X = np.load(os.path.join(HERE, "crane13_open_path_outer-first_step180.npy"))
    TX = mo.placements(X)
    ang = np.array([OP.unwrap(OP.rel_angle(TX, b), s_ * (0.0 if i else math.pi)) for b, s_, i in zip(pins, sgn, inner)])
    tgt = np.where(inner, 0.0, sgn * math.pi)
    pin_set = {id(b) for b in pins}

    def angles(xx, ref_):
        T_ = mo.placements(xx)
        return np.array([OP.unwrap(OP.rel_angle(T_, b), r) for b, r in zip(pins, ref_)])

    # 仕上げ：保存した姿は重みつき最小二乗の結果で、外側が 179.99° 程度。全結びと角を厳しく合わせ直す（ほかはなるべく動かさない）
    dev0 = float(np.max(np.abs(ang - tgt)))
    X0 = X.copy()

    def fun0(z):
        xx = X0.copy()
        xx[fi] = z
        return np.concatenate([1e6 * mo.residual(xx), 1e3 * (angles(xx, ang) - tgt), 1e-3 * (z - X0[fi])])

    sol0 = least_squares(fun0, X0[fi], method="trf", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000)
    X[fi] = sol0.x
    TX = mo.placements(X)
    ang = angles(X, ang)
    say(f"仕上げ：保存した姿の角の目標とのずれ {dev0:.1e} rad → {float(np.max(np.abs(ang - tgt))):.1e} rad"
        f"／角の変化（最大）{math.degrees(float(np.max(np.abs(X - X0)))):.4f}°")

    say("\n[A] 姿 X の確かめ")
    eb = OP.all_bond_error(mo, TX)
    pen, who = OP.penetration(mo, TX, faces, adj, T0rel)
    back = [b["bondId"] for b, s_ in zip(hinges, hsign) if id(b) not in pin_set and s_ * OP.rel_angle(TX, b) < -1e-5]
    say(f"  ①全結び {eb:.1e}／②すり抜け {pen:.1e}{'' if who is None else ' ' + str(who)}／背が閉じる向き {back or 'なし'}")
    say("  ③14本の開き（度）：" + " ".join(f"{'内' if i else '外'}{s_ * math.degrees(a_):.2f}" for i, s_, a_ in zip(inner, sgn, ang)))
    if eb > 1e-9 or pen > 0 or back or np.max(np.abs(ang - tgt)) > 1e-7:
        bad("姿 X が作れていない（全結び・すり抜け・角のどれか）")
        return

    # ---------- [B] 接している組 ----------
    say("\n[B] X で接している紙の組（隣り合わない2枚・同じ平面の上）")
    ids = mo.ids
    Q = {f: [MO.xform(TX[f], p) for p in faces[f]["cur"]] for f in ids}
    N_ = {}
    for f in ids:
        nn = np.cross(Q[f][1] - Q[f][0], Q[f][2] - Q[f][0])
        N_[f] = nn / np.linalg.norm(nn)
    contacts = []
    for i in range(len(ids)):
        a = ids[i]
        for j in range(i + 1, len(ids)):
            b = ids[j]
            if (a, b) in adj:
                continue
            if np.linalg.norm(np.cross(N_[a], N_[b])) > 1e-6 or abs(float(N_[a] @ (Q[b][0] - Q[a][0]))) > TOUCH:
                continue
            e1 = Q[a][1] - Q[a][0]
            e1 = e1 / np.linalg.norm(e1)
            e2 = np.cross(N_[a], e1)
            to2 = lambda p: (float(e1 @ (p - Q[a][0])), float(e2 @ (p - Q[a][0])))
            pa, pb = Polygon([to2(p) for p in Q[a]]), Polygon([to2(p) for p in Q[b]])
            if pa.distance(pb) > TOUCH:
                continue
            it = pa.intersection(pb)
            same = np.allclose(np.linalg.inv(TX[a]) @ TX[b], T0rel(a, b), atol=OP.DEPTH)
            pts = []
            if it.area > 1e-12:
                pts = [np.array(Q[a][0] + e1 * x_ + e2 * y_) for x_, y_ in list(it.exterior.coords)[:-1]]
            nz = TX[a][:3, :3] @ np.array([0.0, 0.0, 1.0])     # 出発の +z を a の置かれ方で回した向き（頂点の並びに依らない）
            contacts.append(dict(a=a, b=b, area=it.area, pts=pts, n=nz, same=same))
    lap = [c for c in contacts if c["area"] > 1e-12]
    say(f"  接している組 {len(contacts)}（重なりのある組 {len(lap)}・うち出発と同じ重なり方 {sum(c['same'] for c in lap)}）")
    key = [c for c in contacts if {OP.short(c['a']), OP.short(c['b'])} ==
           {"s20.keep(層-7)", "s19.keep(層-7)"}]
    for c in key:
        say(f"  第10段で交わった組：{OP.short(c['a'])} × {OP.short(c['b'])}：重なりの面積 {c['area']:.2e}／出発と同じ重なり方 {c['same']}")
    if not key:
        say("  第10段で交わった組は X では**接していない**（平面が違うか離れている）")

    # ---------- [C] 核 ----------
    say("\n[C] 核：閉じ＋外側10本 180°＋⑬ 0 の下で動ける向き")
    h = 1e-6
    Jc, _ = mo.jac(X, h)
    Ja = np.zeros((len(pins), n))
    for k in fi:
        xp, xm = X.copy(), X.copy()
        xp[k] += h
        xm[k] -= h
        Ja[:, k] = (angles(xp, ang) - angles(xm, ang)) / (2 * h)
    C = np.vstack([Jc[:, fi], Ja[~inner][:, fi]])
    U, S, Vt = np.linalg.svd(C)
    rank = int((S > 1e-7 * S[0]).sum())
    Nk = np.zeros((n, len(fi) - rank))
    Nk[fi, :] = Vt[rank:].T
    say(f"  自由な変数 {len(fi)}・拘束の階数 {rank} → 核の次元 {Nk.shape[1]}（1次）")
    Ji = Ja[inner] @ Nk
    ri = np.linalg.matrix_rank(Ji, tol=1e-7)
    say(f"  核の中で内側4本を動かせる次元 {ri}（内側4本の速さの行列の階数）")
    if ri == 0:
        say("  → **外側 180° の姿でも、1次では内側を開く向きが無い**")
        return

    # 速度の基底（核の列ごと）：各面の点の速度
    def point_vel(col):
        d = Nk[:, col]
        Tp, Tm = mo.placements(X + h * d), mo.placements(X - h * d)
        return {f: (Tp[f] - Tm[f]) / (2 * h) for f in ids}

    Vb = [point_vel(c) for c in range(Nk.shape[1])]

    def gap_rate_rows(c):
        """重なりの頂点ごとの、法線方向の相対速度（核の各列に対する係数）"""
        rows = []
        for p in c["pts"]:
            ph = np.append(p, 1.0)
            la = np.linalg.inv(TX[c["a"]]) @ ph
            lb = np.linalg.inv(TX[c["b"]]) @ ph
            rows.append([float(c["n"] @ ((V[c["b"]] @ lb)[:3] - (V[c["a"]] @ la)[:3])) for V in Vb])
        return np.array(rows)

    # 0° の背（折り重なっている）の角の速さ
    h0 = [(b, s_) for b, s_ in zip(hinges, hsign) if abs(OP.rel_angle(TX, b)) < 1e-6 and id(b) not in pin_set]
    Hrows = []
    for b, s_ in h0:
        row = []
        for col in range(Nk.shape[1]):
            d = Nk[:, col]
            Tp, Tm = mo.placements(X + h * d), mo.placements(X - h * d)
            row.append(s_ * (OP.rel_angle(Tp, b) - OP.rel_angle(Tm, b)) / (2 * h))
        Hrows.append(row)
    Hrows = np.array(Hrows) if Hrows else np.zeros((0, Nk.shape[1]))
    say(f"  0° の背（閉じる向きへ動けない）{len(h0)}本")

    # ---------- [D] 線形計画 ----------
    say("\n[D] 線形計画：内側4本を開く向きへ速さ1・重なって接する組は片側へ離れるかすべるだけ・0°の背は閉じない")
    moving = [c for c in lap if not c["same"]] + [c for c in lap if c["same"]]
    G = [gap_rate_rows(c) for c in moving]
    # 動かしても重なり方が変わらない組（速度がほぼ 0）は外す
    act = [(c, g) for c, g in zip(moving, G) if np.max(np.abs(g)) > 1e-9]
    say(f"  重なって接する組 {len(lap)} のうち、核の中で相対速度が出うる組 {len(act)}")
    for c, g in act[:12]:
        say(f"    {OP.short(c['a'])} × {OP.short(c['b'])}（重なり {c['area']:.2e}・出発と同じ {c['same']}）")
    k = Nk.shape[1]
    A_eq = Ji
    b_eq = np.array([s_ for s_, i in zip(sgn, inner) if i])
    found = None
    combos = list(itertools.product((1, -1), repeat=len(act))) if len(act) <= 12 else None
    if combos is None:
        say(f"  ⚠ 組が {len(act)} で多いので、組ごとの向きは「出発の層の上下が保たれる向き」だけを試す")
        combos = [tuple(1 if faces[c["b"]]["layer"] >= faces[c["a"]]["layer"] else -1 for c, _ in act)]
    def lp(use_h, use_c, combo):
        A_ub, b_ub = [], []
        if use_c:
            for (c, g), s_ in zip(act, combo):
                for row in g:
                    A_ub.append(-s_ * row)
                    b_ub.append(0.0)
        if use_h:
            for row in Hrows:
                A_ub.append(-row)
                b_ub.append(0.0)
        return linprog(np.zeros(k), A_ub=np.array(A_ub) if A_ub else None, b_ub=np.array(b_ub) if b_ub else None,
                       A_eq=A_eq, b_eq=b_eq, bounds=[(-1e3, 1e3)] * k, method="highs")

    say(f"  内側4本の開く向き（符号）{list(b_eq.astype(int))}／内側の速さの行列の階数 {ri}")
    for lab, uh, uc in (("等式だけ（内側を開く）", False, False), ("＋0°の背が閉じない", True, False),
                        ("＋重なった組が交わらない", False, True), ("ぜんぶ", True, True)):
        r_ = lp(uh, uc, combos[0])
        say(f"    {lab}：{'解ける' if r_.status == 0 else '解けない'}")
    for combo in combos:
        res = lp(True, True, combo)
        if res.status == 0:
            found = (combo, res.x)
            break
    if not found:
        # どの組が邪魔するか：各不等式に緩み t≥0 を足し、緩みの合計を最小にする
        rows, owner = [], []
        for idx, ((c, g), s_) in enumerate(zip(act, combos[0])):
            for row in g:
                rows.append(-s_ * row)
                owner.append(("組", idx))
        for j, row in enumerate(Hrows):
            rows.append(-row)
            owner.append(("背", j))
        R_ = np.array(rows)
        m = len(rows)
        cobj = np.concatenate([np.zeros(k), np.ones(m)])
        A_ub2 = np.hstack([R_, -np.eye(m)])
        A_eq2 = np.hstack([A_eq, np.zeros((A_eq.shape[0], m))])
        r2 = linprog(cobj, A_ub=A_ub2, b_ub=np.zeros(m), A_eq=A_eq2, b_eq=b_eq,
                     bounds=[(-1e3, 1e3)] * k + [(0, None)] * m, method="highs")
        if r2.status == 0:
            t = r2.x[k:]
            viol = {}
            for (kind, idx), tv in zip(owner, t):
                if tv > 1e-7:
                    viol[(kind, idx)] = max(viol.get((kind, idx), 0.0), tv)
            say(f"  邪魔している条件（緩みの合計を最小にしたとき、緩みが残るもの）{len(viol)}個：")
            for (kind, idx), tv in sorted(viol.items(), key=lambda t_: -t_[1])[:12]:
                if kind == "組":
                    c = act[idx][0]
                    say(f"    重なった組 {OP.short(c['a'])} × {OP.short(c['b'])}：緩み {tv:.3e}")
                else:
                    say(f"    0°の背 {h0[idx][0]['bondId']}（層{faces[h0[idx][0]['faceIds'][0]]['layer']}|{faces[h0[idx][0]['faceIds'][1]]['layer']}）：緩み {tv:.3e}")
    say(f"  試した組ごとの向きの組み合わせ {len(combos)}／**{'満たす向きがある' if found else '満たす向きは無い（1次）'}**")

    # 第10段の組そのものは、核の中で相対速度が出うるか
    if key:
        c = key[0]
        if c["pts"]:
            g = gap_rate_rows(c)
            say(f"  第10段の組の、重なりの頂点での法線方向の相対速度の係数（核の列ごと・最大）{np.max(np.abs(g)):.2e}")

    if not found:
        say("  → 1次では、内側を開きながら接する紙どうしが交わらない向きは無い。🚨 2次以上で逃げる道は否定しない。")
        return

    # ---------- [E] 実際に 0.5° 進める ----------
    say("\n[E] 見つかった向きに内側を 0.5° 進めて閉じ直し、すり抜けを数値で確かめる")
    d = Nk @ found[1]
    step = math.radians(0.5)
    X2 = X + d * step
    tgt2 = np.where(inner, sgn * step, sgn * math.pi)
    ref2 = list(ang)

    def fun2(z):
        xx = X2.copy()
        xx[fi] = z
        return np.concatenate([1e4 * mo.residual(xx), angles(xx, ref2) - tgt2, 1e-3 * (z - X2[fi])])

    sol2 = least_squares(fun2, X2[fi], method="trf", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=2000)
    X2[fi] = sol2.x
    T2 = mo.placements(X2)
    eb2 = OP.all_bond_error(mo, T2)
    pen2, who2 = OP.penetration(mo, T2, faces, adj, T0rel)
    back2 = [b["bondId"] for b, s_ in zip(hinges, hsign) if id(b) not in pin_set and s_ * OP.rel_angle(T2, b) < -1e-5]
    a2 = angles(X2, ref2)
    say(f"  ①全結び {eb2:.1e}／②すり抜け {pen2:.1e}{'' if who2 is None else ' ' + OP.short(who2[0]) + ' × ' + OP.short(who2[1])}"
        f"／背が閉じる向き {back2 or 'なし'}／内側の開き {[round(math.degrees(s_ * v), 3) for s_, v, i in zip(sgn, a2, inner) if i]}")
    np.save(os.path.join(HERE, "crane13_inner_kernel_X.npy"), X)
    say(f"  → {'**0.5° 進めても交わらない**（1点の確かめ。その先の道は未確認）' if pen2 == 0 and not back2 and eb2 < 1e-9 else '進めると交わる／結びが合わない（1次の向きだけでは足りない）'}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
