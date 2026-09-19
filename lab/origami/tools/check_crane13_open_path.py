# -*- coding: utf-8 -*-
"""つる⑬：⑫後の実際の紙で、出発 →「脚の7つの曲がり角が平らに開いた同一の姿」への連続な経路（2026-09-17）

本人指示：代表1例で連続な経路を追う。各時点で ①全結びの一致 ②胴を含む紙どうしのすり抜け を**別々に**確かめる。
到達できた場合だけ、単独模型の「へ の線を折る→胴を閉じる」を鶴全体で追い、最後の層順が中割りか確かめる。
🚨 途中で追跡に失敗しても、**直ちに剛体では不可能と結論しない**。本体・UI・保存形式は変えない。
🚨 単独模型（check_crane13_single.py）の成功とは分けて扱う。

紙：`real_cut(oripa)` の56枚（脚1の8面を ORIPA の⑬の線で先/元に切った紙）。根＝羽の先に近い面。
  段1 の間、⑬の線（切り口8本）の角は **0 に固定**（分岐点までは先と元は1枚として動く）。

段1 の目標（`check_crane13_branchpoint.py` の Sall）：脚の中の層の折り7本を、先の半分・元の半分とも**平らに開く**
  ＝ その結び（14本）の相対の角 ＝ 開く向き×180°。開く向きは出発の層の上下から決める（上の紙が上へ離れる向き）。
追い方（計算の上で道を選ぶ決まり。物理の拘束ではない）：
  14本の目標の開きを**そろえて**1°ずつ進め、毎歩「全結び（重み 1e4）＋目標の角＋ほかの背が閉じる向きへ越えない罰（重み 1e2）
  ＋脚1の外の角を前の姿から動かしすぎない（重み 1e-1）」の最小二乗を前の姿から解き直し、
  閉じを最小ノルムで直す。1歩の角の変化の最大を記録（大きく飛べば連続ではない）。
  ⚠ 出発の平らな姿は特異（核13次元）で、1次の向きへの射影では閉じの修正に引き戻されて進まなかった（2026-09-17 試行）。

各時点の検査
  ①全結び：**すべての結び**の両端を、結ばれた2枚でそれぞれ置いたときの距離（木の結びも含めて測る）
  ②すり抜け（別に）：
     ・隣り合わない2枚：凸多角形の3Dの交わり（重心へ 1% 縮めて、共有する角・折線の接触を外す）。
       同じ平面の上に重なる2枚は、出発と同じ相対の置かれ方なら「重なったまま」として許し、違えば重なりの面積で見る。
     ・背（hinge）でつながる2枚：相対の角を連続にたどり、閉じる向き（出発より内へ）に 1e-5 rad を越えたら、すり抜け。
  ⚠ 1歩の間のすり抜けは見ていない（標本の時点だけ）。
  ⚠ 深さ 1e-6 未満の交わりは数えない（厚み0で重なる紙は、丸めの傾きだけで「交わる」になるため。2026-09-17 に誤検出を確認）。

使い方： python check_crane13_open_path.py [--max-steps N] [--order uniform|inner-first|outer-first]
  順番を変える版（第10段）：すり抜けが出た時点・動かしている折りが張りついた時点で止まる
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import math
import os
import sys
import time
import traceback

import numpy as np
from scipy.optimize import least_squares
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]


def _load(name, fn):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, fn))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


P = _load("crane13_path", "check_crane13_path.py")
M, MO = P.M, P.MO
sys.argv = _argv
ng = []
MAX_STEPS = int(_argv[_argv.index("--max-steps") + 1]) if "--max-steps" in _argv else 400
DEG = 1.0   # 1歩で進める目標の開き（度）
ORDER = _argv[_argv.index("--order") + 1] if "--order" in _argv else "uniform"   # uniform / inner-first / outer-first
RESUME = _argv[_argv.index("--resume") + 1] if "--resume" in _argv else None      # 途中の姿（.npy）から続ける
START = int(_argv[_argv.index("--start-step") + 1]) if "--start-step" in _argv else 0


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


# ---------- 角・結び ----------
def rel_angle(T, b):
    """結び b の2枚の相対の回転角（b の線の向きまわり・符号つき）"""
    Ta, Tb = T[b["faceIds"][0]], T[b["faceIds"][1]]
    R = (np.linalg.inv(Ta) @ Tb)[:3, :3]
    d = MO.p3(b["cur"][1]) - MO.p3(b["cur"][0])
    d = d / np.linalg.norm(d)
    s = 0.5 * float(d @ np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]))
    c = 0.5 * (float(np.trace(R)) - 1.0)
    return math.atan2(s, c)


def unwrap(a, ref):
    return a + 2 * math.pi * round((ref - a) / (2 * math.pi))


def all_bond_error(mo, T):
    e = 0.0
    for b in mo.bonds:
        for p in b["cur"]:
            e = max(e, float(np.linalg.norm(MO.xform(T[b["faceIds"][0]], p) - MO.xform(T[b["faceIds"][1]], p))))
    return e


def open_sign(faces, b):
    """背 b を開く向き：上の層の紙が上へ離れる向き（+1/−1）"""
    a_, c_ = b["faceIds"]
    Rm = MO.rot_about(b["cur"][0], b["cur"][1], 1e-3)
    zc = np.mean([MO.xform(Rm, p)[2] for p in faces[c_]["cur"]])
    c_above = faces[c_]["layer"] > faces[a_]["layer"]
    return 1.0 if (zc > 0) == c_above else -1.0


# ---------- すり抜け ----------
def shrink3(T, f, faces, k=0.01):
    pts = faces[f]["cur"]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [MO.xform(T[f], (cx + (x - cx) * (1 - k), cy + (y - cy) * (1 - k))) for x, y in pts]


DEPTH = 1e-6   # すり抜けとして数える深さ（相手の面の両側へこれより深く出る）。丸めの傾き（~1e-6 以下）を外すため


def clip_plane(Pp, n, d):
    s = [float(n @ p - d) for p in Pp]
    if not (max(s) > DEPTH and min(s) < -DEPTH):
        return None                     # 相手の面の片側にしか（深く）出ていない＝交わらない
    out = []
    for i in range(len(Pp)):
        a, b, sa, sb = Pp[i], Pp[(i + 1) % len(Pp)], s[i], s[(i + 1) % len(Pp)]
        if abs(sa) < 1e-12:
            out.append(a)
        if (sa < -1e-12 and sb > 1e-12) or (sa > 1e-12 and sb < -1e-12):
            out.append(a + (b - a) * (sa / (sa - sb)))
    return out if len(out) >= 2 else None


def penetration(mo, T, faces, adj, T0rel):
    """隣り合わない2枚の中での交わり（長さ or 面積）の最大と組"""
    ids = mo.ids
    P3 = {f: shrink3(T, f, faces) for f in ids}
    box = {f: (np.min(P3[f], axis=0), np.max(P3[f], axis=0)) for f in ids}
    nrm = {}
    for f in ids:
        Q = P3[f]
        n = np.cross(Q[1] - Q[0], Q[2] - Q[0])
        nrm[f] = n / np.linalg.norm(n)
    worst, who = 0.0, None
    for i in range(len(ids)):
        a = ids[i]
        for j in range(i + 1, len(ids)):
            b = ids[j]
            if (a, b) in adj:
                continue
            if np.any(box[a][1] < box[b][0] - 1e-9) or np.any(box[b][1] < box[a][0] - 1e-9):
                continue
            na, nb = nrm[a], nrm[b]
            if np.linalg.norm(np.cross(na, nb)) < 1e-9:
                if abs(float(na @ (P3[b][0] - P3[a][0]))) > 1e-9:
                    continue                    # 平行で離れている
                # 同じ平面：出発と同じ相対の置かれ方なら「重なったまま」
                rel = np.linalg.inv(T[a]) @ T[b]
                if np.allclose(rel, T0rel(a, b), atol=DEPTH):   # 1e-9 では丸め（1.06e-9）で誤検出した（2026-09-17）
                    continue
                e1 = P3[a][1] - P3[a][0]
                e1 = e1 / np.linalg.norm(e1)
                e2 = np.cross(na, e1)
                pa = Polygon([(float(e1 @ p), float(e2 @ p)) for p in P3[a]])
                pb = Polygon([(float(e1 @ p), float(e2 @ p)) for p in P3[b]])
                ar = pa.intersection(pb).area
                if ar > 1e-9 and ar > worst:
                    worst, who = ar, (a, b, "同じ平面で重なる")
                continue
            sa = clip_plane(P3[a], nb, float(nb @ P3[b][0]))
            sb = clip_plane(P3[b], na, float(na @ P3[a][0]))
            if not sa or not sb:
                continue
            L = np.cross(na, nb)
            L = L / np.linalg.norm(L)
            ta = sorted(float(L @ p) for p in sa)
            tb = sorted(float(L @ p) for p in sb)
            ov = min(ta[-1], tb[-1]) - max(ta[0], tb[0])
            if ov > 1e-7 and ov > worst:
                worst, who = ov, (a, b, "交わる")
    return worst, who


def short(f):
    return f.split("/")[-1] + f"(層{FACES[f]['layer']})"


FACES = {}


def main():
    t_start = time.time()
    D, faces_all, cut, leg, geo = P.real_cut(60.0, 0.5, legno=1, oripa=True)
    mo, faces, bonds, tipset = P.model_M3(cut, geo[1])
    FACES.update(faces)
    cv = P.cut_vars(mo)
    n = len(mo.tree_ids)
    say(f"紙：{len(mo.ids)}枚・結び {len(mo.bonds)}（木 {n}・木の外 {len(mo.loop_ids)}）／中割り線の角 {len(cv)}本（段1 は 0 に固定）")
    say(f"中割り線：{cut['source']}")
    say("🚨 鶴全体の検査。単独模型の成功とは別。")

    leg_ids = {f"{fid}#{k}" for fid in leg for k in ("tip", "base")}
    pins = [b for b in mo.bonds if b["faceIds"][0] in leg_ids and b["faceIds"][1] in leg_ids
            and not b["bondId"].startswith("cut:")]
    sgn = [open_sign(faces, b) for b in pins]
    say(f"段1 の目標：脚の中の層の折り {len(pins)}本（先の半分・元の半分）を平らに開く"
        f"（種類 {sorted({b['kind'] for b in pins})}・開く向き ＋{sgn.count(1.0)}／−{sgn.count(-1.0)}）")
    if len(pins) != 14:
        bad(f"脚の中の層の折りの半分が14本でない（{len(pins)}本）")

    # 内側の曲がり角＝中心線の上の折りのうち、脚の半分どうしをつなぐ背（spine）でないもの
    legTip, _, u = geo
    spine_id = M.leg_structure(leg, faces_all, D["bonds"], legTip, u)["spine_bond"]["bondId"]
    on_c = lambda b: all(abs(M.cross(M.sub(p_, legTip), u)) < 1e-9 for p_ in b["cur"])
    inner = np.array([on_c(b) and b["bondId"].split("@")[0] != spine_id for b in pins])
    say(f"  内側の曲がり角の折り {int(inner.sum())}本："
        + "・".join(f"{b['bondId']}(層{faces[b['faceIds'][0]]['layer']}|{faces[b['faceIds'][1]]['layer']})" for b, i in zip(pins, inner) if i)
        + f"／外側 {int((~inner).sum())}本（脚の半分をつなぐ背 {spine_id} を含む）")
    nh = int(round(180 / DEG))
    if ORDER == "uniform":
        say("  順番：14本そろえて開く")
    elif ORDER == "inner-first":
        say(f"  順番：**内側を先に**（1〜{nh}歩：内側 0→180°・外側 0° に保つ／{nh+1}〜{2*nh}歩：外側 0→180°・内側 180° に保つ）")
    elif ORDER == "outer-first":
        say(f"  順番：**外側を先に**（1〜{nh}歩：外側 0→180°・内側 0° に保つ／{nh+1}〜{2*nh}歩：内側 0→180°・外側 180° に保つ）")
    else:
        bad(f"知らない順番 {ORDER}")
        return

    def schedule(step):
        """戻り：(各本の目標の割合, いま動かしている本)"""
        if ORDER == "uniform":
            f = min(1.0, step / nh)
            return np.full(len(pins), f), np.ones(len(pins), bool)
        first = inner if ORDER == "inner-first" else ~inner
        f1 = min(1.0, step / nh)
        f2 = min(1.0, max(0.0, (step - nh) / nh))
        fr = np.where(first, f1, f2)
        active = first if step <= nh else ~first
        return fr, active

    adj = set()
    for b in mo.bonds:
        a_, c_ = b["faceIds"]
        adj.add((a_, c_))
        adj.add((c_, a_))
    hinges = [b for b in mo.bonds if b["kind"] == "hinge"]
    hsign = [open_sign(faces, b) for b in hinges]
    # 追い方の条件に使う背：脚1の層の折り（目標で押さえる）以外
    pin_ids = {id(b) for b in pins}
    hinges_np = [b for b in hinges if id(b) not in pin_ids]
    hsign_np = [s_ for b, s_ in zip(hinges, hsign) if id(b) not in pin_ids]
    T0 = mo.placements(np.zeros(n))
    T0rel = lambda a, b: np.linalg.inv(T0[a]) @ T0[b]

    free = np.ones(n, bool)
    free[cv] = False
    # 脚1の中の結び（木の変数）＝両側が脚1の板
    leg_var = np.zeros(n, bool)
    for k in mo.tree_ids:
        b = mo.bonds[k]
        if b["faceIds"][0] in leg_ids and b["faceIds"][1] in leg_ids:
            leg_var[mo.var_of[k]] = True
    nonleg_r = ~leg_var[np.where(free)[0]]
    say(f"木の変数 {n}（脚1の中 {int(leg_var.sum())}・⑬ {len(cv)}・ほか {int((~leg_var & free).sum())}）")

    def g_of(x, ref):
        T = mo.placements(x)
        ang = [unwrap(rel_angle(T, b), r) for b, r in zip(pins, ref)]
        return np.array([a - s * math.pi for a, s in zip(ang, sgn)]), ang

    def closure_J(x, h=1e-6):
        J, r0 = mo.jac(x, h)
        J[:, ~free] = 0.0
        return J, r0

    def correct(x, it=40):
        for _ in range(it):
            J, r = closure_J(x)
            if np.linalg.norm(r) < 1e-12:
                break
            dx = np.linalg.lstsq(J, -r, rcond=None)[0]
            dx[~free] = 0.0
            x = x + dx
        return x, float(np.linalg.norm(mo.residual(x)))

    x = np.zeros(n)
    if RESUME:
        x = np.load(os.path.join(HERE, RESUME))
        say(f"⚠ 途中の姿 {RESUME} の {START}歩目から続ける（閉じの残り {np.linalg.norm(mo.residual(x)):.1e}）")
    ref = [0.0] * len(pins)
    href = [0.0] * len(hinges)
    g, ref = g_of(x, ref)
    say(f"出発：目標とのずれ（最大）{np.max(np.abs(g)):.3f} rad／閉じの残り {np.linalg.norm(mo.residual(x)):.1e}")

    worst_bond, worst_pen, pen_at, back_at = 0.0, 0.0, None, None
    best_g, stall = np.max(np.abs(g)), 0
    max_jump = 0.0
    lag_cnt = 0
    reached = False
    say("\n[段1] 出発 → 脚の7つの曲がり角が平らに開いた姿")
    for step in range(START + 1, MAX_STEPS + 1):
        # 目標の開きを1°ずつ進め、「全結び（重み 1e4）＋目標の角」を前の姿から解き直す
        fr, active = schedule(step)
        frac = float(fr.min())
        tgt = np.array([s_ * math.pi * f_ for s_, f_ in zip(sgn, fr)])
        fi = np.where(free)[0]
        ref_now = list(ref)
        href_now = [a_ for b_, a_ in zip(hinges, href) if id(b_) not in pin_ids]

        def fun(z):
            xx = x.copy()
            xx[fi] = z
            T_ = mo.placements(xx)
            ang_ = np.array([unwrap(rel_angle(T_, b_), r_) for b_, r_ in zip(pins, ref_now)])
            # 背が閉じる向きへ越えない（追い方の条件。すり抜けの検査は下で別に行う）
            hb = np.array([max(0.0, -s_ * unwrap(rel_angle(T_, b_), r_)) for b_, s_, r_ in zip(hinges_np, hsign_np, href_now)])
            keep = 1e-1 * (z - x[fi])[nonleg_r]           # 脚1の外の角は前の姿からなるべく動かさない（追い方の決まり）
            return np.concatenate([1e4 * mo.residual(xx, T_), ang_ - tgt, 1e2 * hb, keep])

        sol = least_squares(fun, x[fi], method="trf", xtol=1e-14, ftol=1e-14, gtol=1e-14, max_nfev=300)
        x_new = x.copy()
        x_new[fi] = sol.x
        x_new, res = correct(x_new)
        jump = float(np.max(np.abs(x_new - x)))
        max_jump = max(max_jump, jump)
        if res > 1e-9:
            say(f"  {step}歩目：閉じを直せない（{res:.1e}）＝ここで止まる")
            break
        x = x_new
        g, ref = g_of(x, ref)
        T = mo.placements(x)
        eb = all_bond_error(mo, T)
        worst_bond = max(worst_bond, eb)
        # 背の閉じる向きのすり抜け
        for k, (b, s) in enumerate(zip(hinges, hsign)):
            a = unwrap(rel_angle(T, b), href[k])
            href[k] = a
            if s * a < -1e-5 and back_at is None:
                back_at = (step, b["bondId"], math.degrees(a))
        pen, who = penetration(mo, T, faces, adj, T0rel)
        if pen > worst_pen:
            worst_pen, pen_at = pen, (step, who)
        gm = float(np.max(np.abs(g)))
        lagv = np.abs(np.array(ref) - tgt)
        if np.any(lagv[active] > math.radians(5)):
            lag_cnt += 1
        else:
            lag_cnt = 0
        stop_now = None
        if pen > 0:
            stop_now = f"すり抜けが出た（{short(who[0])} × {short(who[1])}・{who[2]}・{pen:.1e}）"
        elif lag_cnt >= 10:
            stuck = [f"{b['bondId']}(層{faces[b['faceIds'][0]]['layer']}|{faces[b['faceIds'][1]]['layer']}) {s_*math.degrees(a_):.1f}°/目標 {s_*math.degrees(t_):.1f}°"
                     for b, s_, a_, t_, ac, lv in zip(pins, sgn, ref, tgt, active, lagv) if ac and lv > math.radians(5)]
            stop_now = "動かしている折りが目標から5°以上遅れたまま10歩＝張りつき：" + "・".join(stuck)
        if step % 10 == 0 or gm < 1e-9 or stop_now:
            opened = [abs(math.degrees(a)) for a in ref]
            say("        14本の開き（度）：" + " ".join(f"{s_ * math.degrees(a_):5.1f}" for s_, a_ in zip(sgn, ref)))
            say(f"  {step:4d}歩：ずれ {gm:.3e}／層の折りの開き {min(opened):6.1f}〜{max(opened):6.1f}°"
                f"／①全結び {eb:.1e}／②交わり {pen:.1e}／1歩の角の変化 {math.degrees(jump):.2f}°（{time.time()-t_start:.0f}秒）")
        if gm < 1e-9:
            reached = True
            break
        if stop_now:
            say(f"  {step}歩目：{stop_now}＝ここで止まる")
            break
        if gm < best_g - 1e-6:
            best_g, stall = gm, 0
        else:
            stall += 1
            if stall > 40 and frac >= 1.0 and ORDER == "uniform":
                say(f"  {step}歩目：目標を180°にしてから40歩ずれが減らない（{gm:.3e}）＝ここで止まる")
                break

    say(f"\n  段1 の結果：{'**到達した**' if reached else '**到達しなかった**'}（{step}歩）")
    say(f"  ①全結びの一致（全時点の最大）{worst_bond:.1e}／1歩の角の変化の最大 {math.degrees(max_jump):.2f}°（連続性の目安）")
    say(f"  ②すり抜け：隣り合わない紙の交わり（最大）{worst_pen:.1e}"
        + (f"　最初の最大の時点 {pen_at[0]}歩：{short(pen_at[1][0])} × {short(pen_at[1][1])}（{pen_at[1][2]}）" if pen_at else "")
        + f"／背が閉じる向きへ越えた：{'なし' if back_at is None else f'{back_at[0]}歩 {back_at[1]} {back_at[2]:.2f}°'}")
    if worst_bond > 1e-9:
        bad("段1：結びが一致しない時点がある")
    np.save(os.path.join(HERE, f"crane13_open_path_{ORDER}{'_resumed' if RESUME else ''}.npy"), x)
    if not reached:
        say("  🚨 追跡が目標に届かなかった＝**この追い方の1例で届かない**だけ。剛体で不可能とは言わない。")
        return
    if worst_pen > 0 or back_at is not None:
        say("  🚨 到達はしたが、途中ですり抜けがある＝この道は紙として成り立たない。段2 へは進まない。"
            "（別の道があるかは未確認。剛体で不可能とは言わない）")
        return
    say("  → すり抜けなしで到達。段2（へ の線を折る→胴を閉じる）へ進む。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
