# -*- coding: utf-8 -*-
"""中割り折りの**基準**（校正）：何枚重ねの先なら、既存の折り目だけで中割りの運動が成り立つか（2026-09-16）

なぜ要るか：つる⑬（8枚重ねのじゃばらの脚）で「中割りの運動にならない」と出たとき、
  それが**モデルや解き方のせい**なのか**紙の重なりのせい**なのかを分けるため。
  2枚のフラップの中割りは古典的に成り立つ（degree-4 の頂点）ので、**そこで成り立たなければ道具の方が壊れている**。

作る紙（合成・つるの脚と同じ形）：先端 T から開く楔（くさび）。
  重なりの n 枚は、**中心線（楔の片側）と外形（もう片側）で交互に**つながる＝じゃばら（つる⑫のあとの脚と同じ組み方）。
  そこへ中割り線を1本入れて、先の n 枚が「ばらばらの角」になれるかを見る。

使い方： python check_reversefold_reference.py
終了コード： 0=ok（基準どおり）／1=NG／2=異常終了
"""
import importlib.util, math, os, sys, traceback
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("crane13_motion", os.path.join(HERE, "check_crane13_motion.py"))
MO = importlib.util.module_from_spec(_s)
sys.argv = [sys.argv[0]]          # 取り込み先の引数読みに引っぱられないように
_s.loader.exec_module(MO)

ng = []


def build(n, beta_deg=20.0, cut_deg=60.0, cut_at=0.5):
    """n 枚のじゃばらの先 ＋ 中割り線1本。板＝先と付け根で 2n 枚。"""
    beta = math.radians(beta_deg)
    T = (0.0, 0.0)
    # 楔：T から x 軸（中心線）と、角 beta の線（外形）にはさまれた三角形（長さ 1）
    P_center = (1.0, 0.0)
    P_outer = (math.cos(beta), math.sin(beta))
    poly = [T, P_center, P_outer]
    # 中割り線：先端から cut_at の所で、中心線と cut_deg
    th = math.radians(cut_deg)
    A = (cut_at, 0.0)
    B = (cut_at + math.cos(th), math.sin(th))
    faces, bonds = {}, []
    for i in range(n):
        faces[f"L{i}#tip"] = dict(cur=clip(poly, A, B, True), layer=i)
        faces[f"L{i}#base"] = dict(cur=clip(poly, A, B, False), layer=i)
        bonds.append(dict(bondId=f"cut:L{i}", kind="crease",
                          faceIds=[f"L{i}#tip", f"L{i}#base"], cur=chord(poly, A, B)))
    for i in range(n - 1):
        # 交互に：中心線（x 軸）と外形（角 beta の線）
        seg = [T, P_center] if i % 2 == 0 else [T, P_outer]
        for half, s in (("tip", cut_side(seg, A, B, True)), ("base", cut_side(seg, A, B, False))):
            if s is None:
                continue
            bonds.append(dict(bondId=f"f{i}@{half}", kind="hinge",
                              faceIds=[f"L{i}#{half}", f"L{i+1}#{half}"], cur=s))
    return faces, bonds, [A, B]


def side(p, a, b):
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def clip(poly, a, b, keep_neg):
    out = []
    n = len(poly)
    sg = lambda p: side(p, a, b) * (1 if keep_neg else -1)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        sp, sq = sg(p), sg(q)
        if sp <= 1e-12:
            out.append(p)
        if (sp < -1e-12 and sq > 1e-12) or (sp > 1e-12 and sq < -1e-12):
            t = sp / (sp - sq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def chord(poly, a, b):
    pts = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        sp, sq = side(p, a, b), side(q, a, b)
        if abs(sp) < 1e-12:
            pts.append(p)
        if (sp < -1e-12 and sq > 1e-12) or (sp > 1e-12 and sq < -1e-12):
            t = sp / (sp - sq)
            pts.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    d = (b[0] - a[0], b[1] - a[1])
    pts.sort(key=lambda p: p[0] * d[0] + p[1] * d[1])
    return [pts[0], pts[-1]]


def cut_side(seg, a, b, tip):
    """線分のうち、中割り線の先端側（tip=True）／付け根側の部分"""
    s0, s1 = side(seg[0], a, b), side(seg[1], a, b)
    want = (lambda s: s < 1e-12) if tip else (lambda s: s > -1e-12)
    if want(s0) and want(s1):
        return [tuple(seg[0]), tuple(seg[1])]
    if not want(s0) and not want(s1):
        return None
    t = s0 / (s0 - s1)
    X = (seg[0][0] + (seg[1][0] - seg[0][0]) * t, seg[0][1] + (seg[1][1] - seg[0][1]) * t)
    return [tuple(seg[0]), X] if want(s0) else [X, tuple(seg[1])]


def test(n, beta=20.0, cut=60.0, at=0.5):
    faces, bonds, cutseg = build(n, beta, cut, at)
    mo = MO.Model(faces, bonds, anchor="L0#base", last=[f"L{i}#tip" for i in range(n)])
    cutvars = [mo.var_of[k] for k in mo.tree_ids if mo.bonds[k]["bondId"].startswith("cut:")]
    x0 = np.zeros(len(mo.tree_ids))
    r0 = np.linalg.norm(mo.residual(x0))
    J, _ = mo.jac(x0)
    rank = np.linalg.matrix_rank(J, tol=1e-7) if J.size else 0
    dof = J.shape[1] - rank if J.size else len(x0)
    # 1次のたわみで、中割り線の角の速さがばらつけるか
    spread1 = 0.0
    if J.size:
        U, S, Vt = np.linalg.svd(J)
        for v in Vt[rank:]:
            cs = [v[k] for k in cutvars]
            if max(abs(np.array(cs))) > 1e-9:
                spread1 = max(spread1, (max(cs) - min(cs)) / max(abs(np.array(cs))))
    # 🚨 角を2本とも押さえるのは**過剰拘束**（解の族は1次元なので、2つ決めると一般に解が無い）。
    #    正しい見方＝「開いた姿から、中割り線の角を1本だけ押し上げて道を連続に追う」。
    spinevars = [mo.var_of[k] for k in mo.tree_ids if not mo.bonds[k]["bondId"].startswith("cut:")]
    trace = MO.trace_branch(mo, cutvars, spinevars, open_seed_deg=150)
    return dict(panels=len(mo.ids), bonds=len(mo.bonds), loops=len(mo.loop_ids), r0=r0,
                dof=dof, cutvars=len(cutvars), spread1=spread1, trace=trace)


def main():
    print("基準：合成のじゃばら（楔の角 20°・中割り線は中心線と 60°・先端から 0.5）")
    print("  見方：開いた姿から**中割り線の角を1本だけ**押し上げ、180°まで連続に追えるか")
    print(" 枚 | 板 | 結び | 閉路 | 出発の1次の自由度 | 180°まで追えたか | 途中のほかの折りの開き（最大）")
    res = {}
    for n in (2, 3, 4, 6, 8):
        r = test(n)
        res[n] = r
        t = r["trace"]
        opened = max((p["open"] for p in t["path"]), default=0.0)
        how = "180°まで追えた" if t["ok"] else (f"{t['stop'][0]}°で止まる" if t.get("stop") else t.get("why", "?"))
        print(f" {n:2d} | {r['panels']:3d} | {r['bonds']:4d} | {r['loops']:4d} | {r['dof']:2d} | {how} | {opened:.1f}°")
    if not res[2]["trace"]["ok"]:
        ng.append("2枚のフラップで中割りの道が追えない＝モデルか解き方が壊れている")
        print("\n🚨 2枚で追えない＝この道具の判定は信用できない（先に道具を直す）")
    else:
        print("\n基準どおり：2枚（degree-4 の頂点）では、開いた姿から 180° まで追える。")
    ok_n = [n for n in sorted(res) if res[n]["trace"]["ok"]]
    print(f"追えた枚数：{ok_n}／止まった枚数：{[n for n in sorted(res) if n not in ok_n]}")
    print("\n8枚で、中割り線の角と位置・楔の角を変えても同じか")
    for beta, cutd, at in ((20, 45, 0.5), (20, 75, 0.5), (20, 60, 0.3), (10, 60, 0.5), (35, 60, 0.5)):
        r = test(8, beta, cutd, at)
        t = r["trace"]
        print(f"  楔 {beta}°・中割り線 {cutd}°・位置 {at}："
              f"{'180°まで追えた' if t['ok'] else str(t['stop'][0]) + '°で止まる'}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
