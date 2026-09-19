# -*- coding: utf-8 -*-
"""つる⑬を**重なりのない1枚の紙**に縮めた単独模型：「開く→折れ方を返す→閉じる」を剛体で追う（2026-09-17）

本人指示：⑬の計算を、まず重なりのない一枚の紙に縮める。首の斜めの角度と、開いたときに見えた「へ」の字の折線を再現し、
面を剛体にしたまま経路を探す。途中の面の変形・折線でのつながり・紙のすり抜け・最後の折れ方を別々に確かめる。
🚨 **この模型の成功は、鶴全体（⑫後の8層＋胴）の成立ではない**。鶴への当てはめは別に確かめる。

模型（すべて `check_crane13_kink.py` が実データから読んだ値）
  ・首の背（折った紙の折り山）＝ x 軸。先は +x。
  ・「へ」の字＝曲がり角 O（原点）から、背の先の側と ±θ をなす2本の線。θ＝**75.9638°**（鶴の中心線の上の曲がり角。
    外形の側の曲がり角は θ＝87.2138° ＝ `--theta 87.2138` で同じことを確かめられる）。
  ・板4枚：先A（y≥0 で へ の線より先）・先B（y≤0）・元A・元B。紙の大きさは首の幅 2h・先の長さ Lt・元の長さ Lb。
  ・折線4本：背の先の側 c⁺（先A|先B）・背の元の側 c⁻（元A|元B）・へ の線 zA（先A|元A）・zB（先B|元B）。
  ・出発＝背で2つ折り（c⁺=c⁻=180°・へ=0）。
  角度は「広げた紙からの回転」（0＝平ら・±180＝折り重なる）。**連続にたどる**ので +180 と −180 を区別する。

見ること
  [1] 出発・途中の姿で、動ける向き（拘束の核）＝どの枝に出られるか
  [2] 経路：段1 背を開く（180→0）／段2 へ の線を折り始めて折れ方を返す／段3 閉じる
      各段で ①面の長さ（剛体） ②折線でのつながり（閉路の閉じ） ③紙のすり抜け（板どうしの交わり） を別々に
  [3] 最後の折れ方（角の符号）と層順（終端の直前の高さ）。対照＝そのまま外へ折る道
  [4] 開き方を途中で止めた姿（開き 30°〜179°）から へ の線を折れるか＝分岐点の確かめ
  [5] ミウラ折りとの比較（前提にしない。角の種類と、連動の式を数値で見る）

使い方： python check_crane13_single.py [--theta 度]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import math
import sys
import traceback

import numpy as np
from shapely.geometry import Polygon

ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


THETA = float(sys.argv[sys.argv.index("--theta") + 1]) if "--theta" in sys.argv else 75.96375653207353
# 鶴の実寸から：曲がり角から先端まで 0.884（中心線に沿って）・へ の線の長さ 0.173
LT, SEG = 0.883883476483184, 0.17313
TH = math.radians(THETA)
H = SEG * math.sin(TH)          # 首の半分の幅（へ の線が紙のふちに届く）
LB = 1.0                         # 元の長さ（終端で先が重なる所を含む長さ）

# ---------- 板と折線（広げた紙の座標・z=0） ----------
X = H / math.tan(TH)            # へ の線が y=±H に届く x
PANELS = {
    "先A": [(0, 0), (LT, 0), (LT, H), (X, H)],
    "元A": [(0, 0), (X, H), (-LB, H), (-LB, 0)],
    "先B": [(0, 0), (X, -H), (LT, -H), (LT, 0)],
    "元B": [(0, 0), (-LB, 0), (-LB, -H), (X, -H)],
}
AX = {"c+": np.array([1.0, 0, 0]), "c-": np.array([1.0, 0, 0]),
      "zA": np.array([math.cos(TH), math.sin(TH), 0]), "zB": np.array([math.cos(TH), -math.sin(TH), 0])}
NAMES = ["c-", "zA", "c+", "zB"]         # q の並び
CREASES = {  # 折線：板の組・広げた紙での線分
    "c+": ("先A", "先B", [(0, 0), (LT, 0)]),
    "c-": ("元A", "元B", [(-LB, 0), (0, 0)]),
    "zA": ("元A", "先A", [(0, 0), (X, H)]),
    "zB": ("元B", "先B", [(0, 0), (X, -H)]),
}


def R(axis, a):
    k = axis / np.linalg.norm(axis)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * K @ K


def place(q):
    """板の置かれ方（元A を固定）。木：元A→元B（c⁻）、元A→先A（zA）、先A→先B（c⁺）。閉路：元B→先B（zB）"""
    cm, za, cp, zb = q
    T = {"元A": np.eye(3), "元B": R(AX["c-"], cm), "先A": R(AX["zA"], za)}
    T["先B"] = T["先A"] @ R(AX["c+"], cp)
    return T


def closure(q):
    """閉路：先B を2通りに置いたときの食い違い（先A 経由 ／ 元B 経由）"""
    cm, za, cp, zb = q
    return (R(AX["zA"], za) @ R(AX["c+"], cp) - R(AX["c-"], cm) @ R(AX["zB"], zb)).ravel()


def jac(q, h=1e-7):
    f0 = closure(q)
    J = np.zeros((len(f0), 4))
    for i in range(4):
        d = np.zeros(4)
        d[i] = h
        J[:, i] = (closure(q + d) - closure(q - d)) / (2 * h)
    return J


def nullspace(q, tol=1e-6):
    U, S, Vt = np.linalg.svd(jac(q))
    rank = int((S > tol).sum())
    return Vt[rank:].T          # 列が核の基底


def correct(q, drive, it=50):
    q = q.copy()
    free = [i for i in range(4) if i != drive]
    for _ in range(it):
        f = closure(q)
        if np.linalg.norm(f) < 1e-14:
            break
        J = jac(q)[:, free]
        dq = np.linalg.lstsq(J, -f, rcond=None)[0]
        q[free] += dq
    return q, float(np.linalg.norm(closure(q)))


def tangent(q, drive, prefer):
    N = nullspace(q)
    if N.shape[1] == 0:
        return None
    # 核の中で「駆動の成分が 1」になり、prefer にいちばん近い向き
    c = N[drive, :]
    if np.linalg.norm(c) < 1e-9:
        return None              # 駆動を動かす向きが核に無い＝この姿からは駆動を変えられない
    if N.shape[1] == 1:
        t = N[:, 0] / N[drive, 0]
        return t
    # 複数：駆動成分 1 の拘束の下で prefer に最も近い（最小二乗）
    A = np.vstack([c, N])                       # 1 行目：駆動成分＝1、残り：N·w ≈ prefer
    b = np.concatenate([[1.0], prefer / max(abs(prefer[drive]), 1e-12)])
    w = np.linalg.lstsq(A, b, rcond=None)[0]
    t = N @ w
    return t / t[drive]


# ---------- 検査 ----------
def edge_len_err(T):
    e = 0.0
    for name, poly in PANELS.items():
        P = [T[name] @ np.array([x, y, 0.0]) for x, y in poly]
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            e = max(e, abs(math.dist(a, b) - float(np.linalg.norm(P[i] - P[(i + 1) % len(P)]))))
    return e


def crease_err(T):
    """折線の線分を、その両側の板で置いたときのずれ（最大）"""
    e = 0.0
    for name, (a, b, seg) in CREASES.items():
        for x, y in seg:
            p = np.array([x, y, 0.0])
            e = max(e, float(np.linalg.norm(T[a] @ p - T[b] @ p)))
    return e


def poly3(T, name, shrink=0.0):
    pts = PANELS[name]
    if shrink:
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        pts = [(cx + (x - cx) * (1 - shrink), cy + (y - cy) * (1 - shrink)) for x, y in pts]
    return [T[name] @ np.array([x, y, 0.0]) for x, y in pts]


def clip_plane(P, n, d):
    """凸多角形 P（3D）と平面 n·x=d の交わりの線分（無ければ None）"""
    s = [float(n @ p - d) for p in P]
    pts = []
    for i in range(len(P)):
        a, b, sa, sb = P[i], P[(i + 1) % len(P)], s[i], s[(i + 1) % len(P)]
        if abs(sa) < 1e-12:
            pts.append(a)
        if (sa < -1e-12 and sb > 1e-12) or (sa > 1e-12 and sb < -1e-12):
            pts.append(a + (b - a) * (sa / (sa - sb)))
    return pts if len(pts) >= 2 else None


def penetrate(T):
    """板どうしが中で交わっていないか。隣り合う板は折線の角の範囲で、隣り合わない板は3Dの交わりで見る。
       曲がり角 O を共有するので、板を重心へ 1% 縮めて O と折線の上の接触を外す。
       戻り：(交わりの長さの最大, 交わった組)"""
    worst, who = 0.0, None
    names = list(PANELS)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            A, B = poly3(T, a, 0.01), poly3(T, b, 0.01)
            na = np.cross(A[1] - A[0], A[2] - A[0])
            nb = np.cross(B[1] - B[0], B[2] - B[0])
            na, nb = na / np.linalg.norm(na), nb / np.linalg.norm(nb)
            if np.linalg.norm(np.cross(na, nb)) < 1e-9:
                continue                            # 平行（平らな姿）：重なりは層順で見る
            sa = clip_plane(A, nb, float(nb @ B[0]))
            sb = clip_plane(B, na, float(na @ A[0]))
            if not sa or not sb:
                continue
            L = np.cross(na, nb)
            L = L / np.linalg.norm(L)
            ta = sorted(float(L @ p) for p in sa)
            tb = sorted(float(L @ p) for p in sb)
            ov = min(ta[-1], tb[-1]) - max(ta[0], tb[0])
            if ov > worst:
                worst, who = ov, (a, b)
    return worst, who


def heights(q_near, q_end, world_pt):
    """終端で world_pt に来る各板の点の、終端の直前の姿での高さ"""
    Te, Tn = place(q_end), place(q_near)
    out = {}
    for name, poly in PANELS.items():
        p = Te[name].T @ world_pt
        if abs(p[2]) > 1e-9:
            continue
        if Polygon(poly).buffer(-1e-9).contains(Polygon([(p[0] - 1e-6, p[1]), (p[0] + 1e-6, p[1]), (p[0], p[1] + 1e-6)])):
            out[name] = float((Tn[name] @ p)[2])
    return out


def overlap_point(q_end):
    """終端で4枚ぜんぶが重なる点（先A の上を格子で探す）。無ければ最多の点"""
    Te = place(q_end)
    best, cnt = None, -1
    for i in range(1, 40):
        for j in range(1, 40):
            x, y = LT * i / 40, H * j / 40
            if not Polygon(PANELS["先A"]).buffer(-1e-6).contains(Polygon([(x, y), (x + 1e-7, y), (x, y + 1e-7)])):
                continue
            wp = Te["先A"] @ np.array([x, y, 0.0])
            n = 0
            for name, poly in PANELS.items():
                pp = Te[name].T @ wp
                if abs(pp[2]) < 1e-9 and Polygon(poly).buffer(-1e-6).contains(
                        Polygon([(pp[0], pp[1]), (pp[0] + 1e-7, pp[1]), (pp[0], pp[1] + 1e-7)])):
                    n += 1
            if n > cnt:
                best, cnt = wp, n
    return best, cnt


def follow(q, drive, target, steps, prefer, label, log):
    """駆動 q[drive] を target まで。各刻みで ①②③ を測る。止まったら理由を返す"""
    q = q.copy()
    v0 = q[drive]
    prev = prefer.copy()
    worst = dict(len=0.0, crease=0.0, pen=0.0, pen_who=None, close=0.0)
    for k in range(1, steps + 1):
        nv = v0 + (target - v0) * k / steps
        t = tangent(q, drive, prev)
        if t is None:
            return q, dict(stopped=True, at=math.degrees(q[drive]), why="この姿の動ける向きに駆動の成分が無い", **worst)
        qp = q + t * (nv - q[drive])
        qc, res = correct(qp, drive)
        if res > 1e-10:
            return q, dict(stopped=True, at=math.degrees(q[drive]), why=f"閉路が閉じない（{res:.1e}）", **worst)
        prev = (qc - q) / max(abs(qc[drive] - q[drive]), 1e-12)
        q = qc
        T = place(q)
        worst["len"] = max(worst["len"], edge_len_err(T))
        worst["crease"] = max(worst["crease"], crease_err(T))
        worst["close"] = max(worst["close"], res)
        pen, who = penetrate(T)
        if pen > worst["pen"]:
            worst["pen"], worst["pen_who"] = pen, who
        # 隣り合う板のすり抜け＝折線の角が ±180 を越える
        if any(abs(a) > math.pi + 1e-9 for a in q):
            worst["pen"], worst["pen_who"] = max(worst["pen"], 1.0), "折線の角が±180°を越えた"
        if log and k % max(1, steps // 6) == 0:
            say(f"      {label} {math.degrees(nv):7.1f}°：" + "・".join(f"{n} {math.degrees(a):7.2f}" for n, a in zip(NAMES, q)))
    return q, dict(stopped=False, **worst)


def report(st, name):
    say(f"    {name}：①面の長さのずれ {st['len']:.1e}／②折線のずれ {st['crease']:.1e}（閉路 {st['close']:.1e}）"
        f"／③すり抜け {'なし' if st['pen'] < 1e-9 else f'あり {st[chr(112)+chr(101)+chr(110)]:.2e} {st[chr(112)+chr(101)+chr(110)+chr(95)+chr(119)+chr(104)+chr(111)]}'}")
    if st["len"] > 1e-9 or st["crease"] > 1e-9:
        bad(f"{name}：剛体またはつながりが保たれていない")


def fmt(q):
    return "・".join(f"{n} {math.degrees(a):+.2f}°" for n, a in zip(NAMES, q))


def main():
    say(f"単独模型：へ の字の開き 2θ={2*THETA:.4f}°（θ={THETA:.4f}°）／首の幅 2h={2*H:.4f}／先の長さ {LT:.3f}／元の長さ {LB}")
    say("🚨 これは**重なりのない1枚の紙**。⑫後の鶴の8層・胴の結びは入っていない。")
    q0 = np.array([math.pi, 0.0, math.pi, 0.0])
    say(f"出発（背で2つ折り）：{fmt(q0)}／閉路のずれ {np.linalg.norm(closure(q0)):.1e}")

    # ---------- [1] 動ける向き ----------
    say("\n[1] 姿ごとの動ける向き（閉路の拘束の核）")
    for lab, q in (("出発（2つ折り）", q0),
                   ("背を 90° 開いた", np.array([math.pi / 2, 0, math.pi / 2, 0])),
                   ("広げきった（平ら）", np.zeros(4))):
        N = nullspace(q)
        say(f"  {lab}：核の次元 {N.shape[1]}")
        for c in range(N.shape[1]):
            v = N[:, c] / np.max(np.abs(N[:, c]))
            say("    向き " + "・".join(f"{n} {x:+.3f}" for n, x in zip(NAMES, v)))
    say("  → 平らな姿では核が2次元＝**2つの枝が交わる分岐点**。途中の姿（背90°）では1次元で、へ の線（zA・zB）は 0 のまま。")

    # ---------- [2] 経路 ----------
    say("\n[2] 経路：段1 背を開く → 段2 折れ方を返す → 段3 閉じる")
    # 段1：c⁻ を 180→0（へ は動かさない向きを好む）
    q1, st1 = follow(q0, 0, 0.0, 60, np.array([1, 0, 1, 0.0]), "段1 c⁻", True)
    say(f"  段1 背を開く：{'止まった ' + st1['why'] if st1['stopped'] else '平らまで'}／着いた姿 {fmt(q1)}")
    report(st1, "段1")
    # 段2：平らな分岐点から、へ の線 zA を 0→90°。枝＝背の先と元が逆向きに回る（c⁺ = −c⁻ の向き）
    N = nullspace(q1)
    say(f"  分岐点（平ら）の核の次元 {N.shape[1]}")
    pref = np.array([+1.0, +1.0, -1.0, +1.0])       # c⁻ は元へ戻る（＋）・c⁺ は逆（−）・へ は折る
    q2, st2 = follow(q1, 1, math.pi / 2, 45, pref, "段2 zA", True)
    say(f"  段2 折れ方を返す（zA 0→90°）：{'止まった ' + st2['why'] if st2['stopped'] else '90°まで'}／{fmt(q2)}")
    report(st2, "段2")
    # 段3：閉じる（c⁻ を 180° へ）
    q3, st3 = follow(q2, 0, math.pi, 90, (q2 - q1) / max(abs(q2[0] - q1[0]), 1e-9), "段3 c⁻", True)
    say(f"  段3 閉じる（c⁻→180°）：{'止まった ' + st3['why'] if st3['stopped'] else '180°まで'}／{fmt(q3)}")
    report(st3, "段3")

    # ---------- [3] 最後の折れ方と層順 ----------
    say("\n[3] 最後の折れ方と層順")
    ok_end = not (st1["stopped"] or st2["stopped"] or st3["stopped"])
    if ok_end:
        say(f"  終端：{fmt(q3)}")
        flip = q3[2] < 0 and q0[2] > 0
        say(f"  背の先の側 c⁺：出発 +180° → 終端 {math.degrees(q3[2]):+.2f}°＝**{'向きが返った（山谷が入れかわる）' if flip else '返っていない'}**"
            f"／背の元の側 c⁻：{math.degrees(q3[0]):+.2f}°（出発と同じ）／へ の線 zA {math.degrees(q3[1]):+.2f}°・zB {math.degrees(q3[3]):+.2f}°")
        # 終端の直前（c⁻ を 179° に戻した姿）で高さを読む
        qn, _ = follow(q2, 0, math.radians(179), 89, (q2 - q1) / max(abs(q2[0] - q1[0]), 1e-9), "", False)
        wp, cnt = overlap_point(q3)
        say(f"  読む点：終端で重なる板 {cnt}枚の所 {np.round(wp, 4)}")
        hs = heights(qn, q3, wp)
        order = sorted(hs.items(), key=lambda t: t[1])
        say("  層順（下→上・終端の直前の高さ）：" + " ／ ".join(f"{n} {z:+.4f}" for n, z in order))
        names = [n for n, _ in order]
        inside = len(names) == 4 and names[0].startswith("元") and names[-1].startswith("元")
        say(f"  → **{'中割り（先の2枚が元の2枚のあいだ）' if inside else '中割りではない'}**")
        if not inside:
            bad("単独模型の終端が中割りの層順でない")
    else:
        bad("単独模型の経路が途中で止まった")

    # 対照：開かずにそのまま へ の線で折る（外へ折る）
    say("\n  対照：開かずに へ の線を折る（c⁺・c⁻ は 180° のまま）")
    qa, sta = follow(q0, 1, math.pi, 90, np.array([0, 1.0, 0, 1.0]), "対照 zA", False)
    say(f"    {'止まった ' + sta['why'] if sta['stopped'] else '180°まで'}／{fmt(qa)}")
    report(sta, "対照")
    if not sta["stopped"]:
        Tq, Ta = place(q3) if ok_end else None, place(qa)
        if ok_end:
            dmax = max(float(np.linalg.norm(Tq[n] - Ta[n])) for n in PANELS)
            say(f"    終端の置かれ方は中割りの道と同じか：ずれ {dmax:.1e}（同じなら、違いは層順だけ）")
        qn2, _ = follow(q0, 1, math.radians(179), 89, np.array([0, 1.0, 0, 1.0]), "", False)
        wp2, _ = overlap_point(qa)
        hs = heights(qn2, qa, wp2)
        say("    層順（下→上）：" + " ／ ".join(f"{n} {z:+.4f}" for n, z in sorted(hs.items(), key=lambda t: t[1])))

    # ---------- [4] 分岐点の確かめ ----------
    say("\n[4] 背を途中まで開いた姿から、へ の線を折れるか（分岐点はどこか）")
    for open_deg in (30, 90, 150, 170, 179, 180):
        qo = np.array([math.radians(180 - open_deg), 0, math.radians(180 - open_deg), 0])
        N = nullspace(qo)
        can = np.max(np.abs(N[1, :])) if N.shape[1] else 0.0
        say(f"  開き {open_deg:3d}°（c⁻=c⁺={180-open_deg}°）：核の次元 {N.shape[1]}／へ の線を動かす成分 {can:.3f}"
            f" → {'折れる' if can > 1e-6 else '**折れない**（背をさらに開くしかない）'}")

    # ---------- [5] ミウラ折りとの比較 ----------
    say("\n[5] ミウラ折りとの比較（同じ構造だとは前提にしない）")
    ang = sorted([0.0, TH, math.pi, 2 * math.pi - TH])
    sect = [math.degrees((ang[(i + 1) % 4] - ang[i]) % (2 * math.pi)) for i in range(4)]
    say(f"  へ の曲がり角のまわりの角：{'・'.join(f'{s:.3f}°' for s in sect)}"
        f"（背は1本の直線・へ の2本は背の鏡）＝**4本の線の頂点で、向かい合う角の和が180°**")
    say("  ミウラ折りの頂点：1本の直線（ジグザグと交わる線）と、その直線の鏡になったジグザグの2本＝角は α・α・180−α・180−α。"
        "→ **頂点の形の種類は同じ**（α＝θ）。")
    if ok_end:
        say("  連動の式（段2・段3で通った枝の上）：")
        qs = []
        qq = q1.copy()
        for zdeg in (20, 45, 70, 90, 120, 150, 170):
            qq, _ = follow(qq, 1, math.radians(zdeg), 20, np.array([1, 1, -1, 1.0]), "", False)
            qs.append(qq.copy())
        for qq in qs:
            cm, za, cp, zb = qq
            r1 = math.tan(cm / 2) / math.tan(za / 2)
            say(f"    zA {math.degrees(za):6.1f}°：c⁻ {math.degrees(cm):+7.2f}°・c⁺ {math.degrees(cp):+7.2f}°・zB {math.degrees(zb):+7.2f}°"
                f"／tan(c⁻/2)÷tan(zA/2) = {r1:.6f}")
        k = [math.tan(q[0] / 2) / math.tan(q[1] / 2) for q in qs]
        spread = max(k) - min(k)
        cand = {"1/cosθ": 1 / math.cos(TH), "cosθ": math.cos(TH), "1/sinθ": 1 / math.sin(TH), "sinθ": math.sin(TH),
                "(1+cosθ)/(1−cosθ)": (1 + math.cos(TH)) / (1 - math.cos(TH)),
                "(1−cosθ)/(1+cosθ)": (1 - math.cos(TH)) / (1 + math.cos(TH))}
        hit = [n for n, v in cand.items() if abs(abs(k[0]) - v) < 1e-6]
        say(f"    → 比は一定（ばらつき {spread:.1e}）＝ |tan(c⁻/2)| = {abs(k[0]):.6f}·|tan(zA/2)|"
            f"（θ の式で当たるもの：{hit or 'なし'}）")
        say("  似ている所：頂点の形が同じで、**1つの角を決めると残り3つが決まる**（1自由度の連動）。"
            "背の先の側と元の側が逆向きに回り、へ の2本がそろって折れる＝ミウラ折りの頂点が畳まれるときと同じ連動。")
        say("  違う所：ミウラ折りは**平らな紙から畳む1本の枝**だけを通る。中割りは**2つ折りの姿（背だけ折れた枝）から出発**し、"
            "**平らな分岐点で枝を乗りかえる**。乗りかえは平らな姿でしか起きない（[1][4]）。")
        say("  ⚠ ミウラ折りは頂点がたくさん並んで互いに連動する。この模型は頂点1つ。鶴の脚は頂点が7つ一列（`check_crane13_kink.py`）で、"
            "胴ともつながる＝そこでの連動は別に確かめる。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
