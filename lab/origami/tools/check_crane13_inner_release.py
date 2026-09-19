# -*- coding: utf-8 -*-
"""つる⑬：外側 180° の固定を外し、外側は「戻る側（180° から閉じる側）」へだけ動ける条件で、内側を開く向きがあるか（1次・2026-09-17）

本人指示：第11段と同じ保存済みの姿 X から、外側 180° の固定だけを外す。外側は物理的に許される側（開ききった 180° から戻る側）へだけ動ける。
⑬の線 0°・全結び・接触と非貫通の条件は維持し、第11段と比べる。**動ける向きの有無だけ**を見る（1次）。
あわせて、胴と尾（もう1本の脚）が自由な変数に含まれているかを数えて明記する。
🚨 1次の確かめ。単独模型の成功とは別。本体・UI・保存形式は無変更。

比べる2つ（どちらも同じ姿 X・同じ判定）
  (固定)  第11段：外側10本の角の速さ ＝ 0
  (解放)  今回　 ：外側10本の角の速さ × 開く向き ≤ 0（180° から戻る側だけ。180° を越えて反対へ折れる側は許さない）
共通の条件：全結び（閉じ）・⑬の角は変数から外して 0・内側4本は開く向きへ速さ 1（等式）・
           いま折り重なっている背（0°）は閉じる向きへ動かない・重なって接している組は出発の上下を保つ向きへだけ（片側へ離れるかすべる）

使い方： python check_crane13_inner_release.py
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
    legTip, _, u = geo
    nrm = (-u[1], u[0])
    neck = [v["neck"] for v in D["landmarks"]["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces_all, D["bonds"], legTip, u, nrm, 0.3 * neck)
    leg1 = {f"{fid}#{k}" for fid in legs[0] for k in ("tip", "base")}
    leg2 = set(legs[1])
    place = lambda f: "首" if f in leg1 else "尾" if f in leg2 else "胴"
    pins = [b for b in mo.bonds if b["faceIds"][0] in leg1 and b["faceIds"][1] in leg1
            and not b["bondId"].startswith("cut:")]
    pin_set = {id(b) for b in pins}
    sgn = np.array([OP.open_sign(faces, b) for b in pins])
    spine_id = M.leg_structure(legs[0], faces_all, D["bonds"], legTip, u)["spine_bond"]["bondId"]
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
    say("🚨 鶴全体の検査・1次の確かめ。単独模型の成功とは別。")

    # ---------- 変数の内訳（胴・尾は自由か） ----------
    say("\n[0] 木の変数（折り角）の内訳：子の板がどこにあるかで分ける")
    cnt = {}
    for k in mo.tree_ids:
        b = mo.bonds[k]
        child = next(f for f in b["faceIds"] if mo.parent.get(f) is not None and mo.tree_bond.get(f) == k)
        if b["bondId"].startswith("cut:"):
            where = "⑬の切り口（0 に固定）"
        elif child in leg1:
            where = "脚1＝首（中割りする脚）"
        elif child in leg2:
            where = "脚2＝尾（もう1本の脚）"
        else:
            where = "胴（羽・胴の層）"
        cnt[where] = cnt.get(where, 0) + 1
    for w in ("脚1＝首（中割りする脚）", "脚2＝尾（もう1本の脚）", "胴（羽・胴の層）", "⑬の切り口（0 に固定）"):
        say(f"  {w}：{cnt.get(w, 0)}本" + ("（**自由**）" if "固定" not in w else ""))
    say(f"  自由な変数 {len(fi)}／ぜんぶ {n}。木の外の結び {len(mo.loop_ids)}本は閉じの拘束。根＝{OP.short(mo.anchor)}（羽の先に近い面・動かない基準）")
    say("  → **胴と尾の折り角は、第11段でも自由な変数に入っている**（固定していたのは ⑬ の8本と、第11段では外側10本の角だけ）。")

    # ---------- 姿 X（第11段と同じ作り方） ----------
    X = np.load(os.path.join(HERE, "crane13_open_path_outer-first_step180.npy"))
    TX = mo.placements(X)
    ang = np.array([OP.unwrap(OP.rel_angle(TX, b), s_ * (0.0 if i else math.pi)) for b, s_, i in zip(pins, sgn, inner)])
    tgt = np.where(inner, 0.0, sgn * math.pi)

    def angles(xx, ref_):
        T_ = mo.placements(xx)
        return np.array([OP.unwrap(OP.rel_angle(T_, b), r) for b, r in zip(pins, ref_)])

    X0 = X.copy()

    def fun0(z):
        xx = X0.copy()
        xx[fi] = z
        return np.concatenate([1e6 * mo.residual(xx), 1e3 * (angles(xx, ang) - tgt), 1e-3 * (z - X0[fi])])

    X[fi] = least_squares(fun0, X0[fi], method="trf", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000).x
    TX = mo.placements(X)
    ang = angles(X, ang)
    eb = OP.all_bond_error(mo, TX)
    pen, _ = OP.penetration(mo, TX, faces, adj, T0rel)
    back = [b["bondId"] for b, s_ in zip(hinges, hsign) if id(b) not in pin_set and s_ * OP.rel_angle(TX, b) < -1e-5]
    say(f"\n[A] 姿 X（第11段と同じ）：全結び {eb:.1e}／すり抜け {pen:.1e}／閉じる向きの背 {back or 'なし'}"
        f"／角のずれ {float(np.max(np.abs(ang - tgt))):.1e} rad")
    if eb > 1e-9 or pen > 0 or back or np.max(np.abs(ang - tgt)) > 1e-7:
        bad("姿 X が第11段と同じにならない")
        return

    # ---------- 速度の行列 ----------
    h = 1e-6
    Jc, _ = mo.jac(X, h)
    Ja = np.zeros((len(pins), n))
    for k in fi:
        xp, xm = X.copy(), X.copy()
        xp[k] += h
        xm[k] -= h
        Ja[:, k] = (angles(xp, ang) - angles(xm, ang)) / (2 * h)

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
            s_ab = 1.0 if faces[b]["layer"] >= faces[a]["layer"] else -1.0
            lap.append(dict(a=a, b=b, pts=pts, n=TX[a][:3, :3] @ np.array([0, 0, 1.0]), s=s_ab))
    h0 = [(b, s_) for b, s_ in zip(hinges, hsign) if id(b) not in pin_set and abs(OP.rel_angle(TX, b)) < 1e-6]

    def solve(outer_mode):
        """outer_mode：'fixed'＝外側の速さ 0／'release'＝外側は 180° から戻る側だけ"""
        rows = [Jc[:, fi]]
        if outer_mode == "fixed":
            rows.append(Ja[~inner][:, fi])
        C = np.vstack(rows)
        U, S, Vt = np.linalg.svd(C)
        rank = int((S > 1e-7 * S[0]).sum())
        Nk = np.zeros((n, len(fi) - rank))
        Nk[fi, :] = Vt[rank:].T
        k = Nk.shape[1]
        Ji = Ja[inner] @ Nk
        ri = np.linalg.matrix_rank(Ji, tol=1e-7)
        Tp = [mo.placements(X + h * Nk[:, c]) for c in range(k)]
        Tm = [mo.placements(X - h * Nk[:, c]) for c in range(k)]
        # 0° の背の角の速さ（開く向きを＋）
        H = np.array([[s_ * (OP.rel_angle(Tp[c], b) - OP.rel_angle(Tm[c], b)) / (2 * h) for c in range(k)] for b, s_ in h0])
        # 重なった組：法線方向の相対速度（出発の上下を保つ向きを＋）
        G = []
        for c_ in lap:
            for p in c_["pts"]:
                ph = np.append(p, 1.0)
                la = np.linalg.inv(TX[c_["a"]]) @ ph
                lb = np.linalg.inv(TX[c_["b"]]) @ ph
                G.append([c_["s"] * float(c_["n"] @ (((Tp[c][c_["b"]] - Tm[c][c_["b"]]) @ lb)[:3]
                                                     - ((Tp[c][c_["a"]] - Tm[c][c_["a"]]) @ la)[:3]) / (2 * h))
                          for c in range(k)])
        G = np.array(G)
        # 外側の角の速さ（開く向きを＋）：解放では ≤ 0
        O = (sgn[~inner][:, None] * (Ja[~inner] @ Nk))
        b_eq = sgn[inner]
        out = dict(kernel=k, inner_rank=ri)
        for lab, useH, useG in (("等式だけ", False, False), ("＋背", True, False), ("＋重なり", False, True), ("ぜんぶ", True, True)):
            A_ub, b_ub = [], []
            if useH:
                A_ub += list(-H)
                b_ub += [0.0] * len(H)
            if useG:
                A_ub += list(-G)
                b_ub += [0.0] * len(G)
            if outer_mode == "release":
                A_ub += list(O)
                b_ub += [0.0] * len(O)
            r = linprog(np.zeros(k), A_ub=np.array(A_ub) if A_ub else None, b_ub=np.array(b_ub) if b_ub else None,
                        A_eq=Ji, b_eq=b_eq, bounds=[(-1e3, 1e3)] * k, method="highs")
            out[lab] = r.status == 0
            if lab == "ぜんぶ" and r.status == 0:
                w = r.x
                out["outer_rates"] = O @ w
                out["dir"] = Nk @ w
        # ぜんぶで解けないとき：緩みの合計を最小にして、邪魔する条件の上位
        if not out["ぜんぶ"]:
            R_, own = [], []
            for j, row in enumerate(H):
                R_.append(-row)
                own.append(("背", h0[j][0]))
            gi = 0
            for c_ in lap:
                for _ in c_["pts"]:
                    R_.append(-G[gi])
                    own.append(("重なり", c_))
                    gi += 1
            R_ = np.array(R_)
            m = len(R_)
            A_ub = np.hstack([R_, -np.eye(m)])
            b_ub = np.zeros(m)
            if outer_mode == "release":
                A_ub = np.vstack([A_ub, np.hstack([O, np.zeros((len(O), m))])])
                b_ub = np.concatenate([b_ub, np.zeros(len(O))])
            r2 = linprog(np.concatenate([np.zeros(k), np.ones(m)]), A_ub=A_ub, b_ub=b_ub,
                         A_eq=np.hstack([Ji, np.zeros((len(Ji), m))]), b_eq=b_eq,
                         bounds=[(-1e3, 1e3)] * k + [(0, None)] * m, method="highs")
            viol = {}
            if r2.status == 0:
                for (kind, obj), t in zip(own, r2.x[k:]):
                    if t > 1e-7:
                        # 🚨 bondId は重複する（split で同じ名前が残る）ので、つなぐ面と場所（首/尾/胴）で名づける
                        key = (kind, (f"{obj['bondId']}[{place(obj['faceIds'][0])}層{faces[obj['faceIds'][0]]['layer']}|{place(obj['faceIds'][1])}層{faces[obj['faceIds'][1]]['layer']}]"
                                      if kind == "背" else f"{place(obj['a'])}{OP.short(obj['a'])} × {place(obj['b'])}{OP.short(obj['b'])}"))
                        viol[key] = max(viol.get(key, 0.0), t)
                out["total_slack"] = float(r2.fun)
            out["viol"] = viol
        return out

    say(f"\n  重なって接する組 {len(lap)}・0° の背 {len(h0)}本・外側 {int((~inner).sum())}本・内側 {int(inner.sum())}本（開く向き {list(sgn[inner].astype(int))}）")
    res = {m_: solve(m_) for m_ in ("fixed", "release")}
    say("\n[B] 比較（1次・動ける向きがあるか）")
    say("  | 条件 | 第11段（外側 180° 固定） | 今回（外側は 180° から戻る側だけ） |")
    say("  |---|---|---|")
    say(f"  | 核の次元 | {res['fixed']['kernel']} | {res['release']['kernel']} |")
    say(f"  | 核の中で内側を動かせる次元 | {res['fixed']['inner_rank']} | {res['release']['inner_rank']} |")
    for lab in ("等式だけ", "＋背", "＋重なり", "ぜんぶ"):
        say(f"  | 内側を開く{'' if lab == '等式だけ' else '（' + lab + '）'} | {'ある' if res['fixed'][lab] else '**無い**'} | {'ある' if res['release'][lab] else '**無い**'} |")
    for m_, name in (("fixed", "第11段"), ("release", "今回")):
        r = res[m_]
        if r["ぜんぶ"]:
            say(f"  {name}：ぜんぶ満たす向きがある。そのときの外側の角の速さ（開く向きを＋）{np.round(r['outer_rates'], 3).tolist()}")
        else:
            v = sorted(r["viol"].items(), key=lambda t: -t[1])
            say(f"  {name}：邪魔する条件 {len(v)}個（緩みの合計 {r.get('total_slack', float('nan')):.3e}）。上位："
                + "／".join(f"{kind} {name_} {t:.4f}" for (kind, name_), t in v[:10]))
            cat = {}
            for (kind, name_), t in v:
                tag = kind + ("：尾を含む" if "尾" in name_ else "：首を含む" if "首" in name_ else "：胴だけ")
                cat[tag] = cat.get(tag, 0.0) + t
            say(f"    　内訳（緩みの合計）：" + "／".join(f"{k_} {t:.3e}" for k_, t in sorted(cat.items(), key=lambda t: -t[1])))
    say("\n[答え]")
    if res["release"]["ぜんぶ"]:
        say("  外側を 180° から戻せるなら、**1次では内側を開きながら交わらない向きがある**（第11段の不成立は外側 180° の固定が効いていた）。"
            "🚨 1次の必要条件だけ。実際にその向きへ進めるかは未確認。")
    else:
        say("  外側を 180° から戻せても、**1次では内側を開きながら交わらない向きは無い**（第11段と同じ）。")
    say("  胴と尾の折り角はどちらの検査でも自由な変数。**「実物では胴や尾も動く」は、この不成立の説明にならない**"
        "（動かせる前提で解いて、それでも向きが無い／ある）。説明の候補は別に要る：⑬の線 0 の固定・2次以上の動き・曲面（しなり）・層の上下の読み方。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
