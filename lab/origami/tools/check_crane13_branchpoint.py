# -*- coding: utf-8 -*-
"""つる⑬：単独模型で分かった「分岐点」が、⑫後の鶴（8層＋胴）でも取れるか（2026-09-17）

🚨 **単独模型（check_crane13_single.py）の成功とは分けて扱う**。ここは鶴全体で成り立つかの**別の検査**。

単独模型で分かったこと（1枚の紙・曲がり角1つ）
  ・折った背（出発 ±180°）から「へ」の線を折り始められるのは、**背を平らまで開ききった姿だけ**（核が2次元になる分岐点）。
  ・途中まで開いた姿（1〜179°）では、へ の線を動かす向きが核に無い。
鶴への当てはめ（`check_crane13_kink.py` が確かめた事実から）
  ・脚1本の⑬の線は、既存の折線の上に**曲がり角が7つ**（中心線の上3・外形の側4）。どれも角のまわりの線は4本で、形は単独模型と同じ。
  ・角のまわりの4枚の板は剛体なので、**角ごとに単独模型と同じ拘束**がかかる（紙の大きさ・ほかの紙には関係しない）。
  ・中割りの終端では、脚の先の中の折り7本がぜんぶ向きを返す（`check_crane13_motion.py` [H]）
    ⇒ **7つの角のそれぞれが、どこかの時点で分岐点（その層の折りが平らに開き、⑬の線の角が 0）を通る**必要がある。
  ・⑬の8本は隣の角どうしで共有され、どの枝でも角の大きさがそろう ⇒ ある角が分岐点を通る時、⑬の線は**8本とも 0**。
    ⑬が 0 なら先と元は1枚の板に戻る ＝ **切り口を入れる前の⑫後の紙（48面）で、その層の折りを平らに開いた姿**を探せばよい。

見ること（姿があるかどうか＝**静的**。そこへの連続な道・途中の非貫通はまだ見ない）
  [0] 解き方の較正：必ず取れるはずの姿（中心線まわりに開ける集合を 180° 開く）で、残りが 0 になるか
  [S1..S7] 脚の層の折り（7本）を**1本ずつ**平らに開いた姿が、胴の結びをぜんぶ保ったまま取れるか
  [Sall] 7本を**同時に**平らに開いた姿
  ⚠ 見つからなくても**数値で見つからない**だけ（出発点を変えて何回か解く）。見つかっても、そこへ行く道は別に確かめる。

使い方： python check_crane13_branchpoint.py [--starts N]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import math
import os
import sys
import traceback

import numpy as np
from scipy.optimize import least_squares

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]


def _load(name, fn):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, fn))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


M = _load("crane13_model", "check_crane13_model.py")
MO = _load("crane13_motion", "check_crane13_motion.py")
sys.argv = _argv
ng = []
STARTS = int(_argv[_argv.index("--starts") + 1]) if "--starts" in _argv else 6


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def pinned_residual(mo, T, pins):
    """結び (a,b) を「a に対して b が結びの線まわりに ang」に押さえる残り（b の頂点で測る）"""
    r = []
    for (a, b, seg, ang) in pins:
        Rm = MO.rot_about(seg[0], seg[1], ang)
        for p in mo.faces[b]["cur"]:
            r.extend(MO.xform(T[b], p) - MO.xform(T[a] @ Rm, p))
    return np.array(r)


def solve(mo, pins, starts, rng):
    """閉じ（木の外の結び）＋押さえ を最小二乗で。出発点を変えて何回か。戻り：(いちばん小さい残り, x)"""
    n = len(mo.tree_ids)

    def fun(x):
        T = mo.placements(x)
        return np.concatenate([mo.residual(x, T), pinned_residual(mo, T, pins)])

    x_base = np.zeros(n)
    for (a, b, seg, ang) in pins:
        for k in mo.tree_ids:
            bd = mo.bonds[k]
            if set(bd["faceIds"]) == {a, b} and M.dist(bd["cur"][0], seg[0]) + M.dist(bd["cur"][1], seg[1]) < 1e-9:
                x_base[mo.var_of[k]] = ang if mo.parent.get(b) == a else -ang
    best = (float("inf"), None)
    for s in range(starts):
        x0 = x_base.copy()
        if s > 0:
            x0 = x0 + rng.normal(0, 0.6 if s % 2 else 1.5, n)
        r = least_squares(fun, x0, method="lm", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=4000)
        v = float(np.linalg.norm(fun(r.x)))
        if v < best[0]:
            best = (v, r.x)
        if v < 1e-10:
            break
    return best


def main():
    rng = np.random.default_rng(0)
    D = M.load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    lm = D["landmarks"]
    legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
    LL = M.dist(legTip, petalTip)
    u = ((petalTip[0] - legTip[0]) / LL, (petalTip[1] - legTip[1]) / LL)
    nrm = (-u[1], u[0])
    neck = [v["neck"] for v in lm["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces, bonds, legTip, u, nrm, 0.3 * neck)
    leg = legs[0]
    say(f"紙：⑫のあと（48面・結び{len(bonds)}）指紋 {D['meta']['stateFingerprint'][:12]}／脚1（8面）")
    say("🚨 ここは**鶴全体**の検査。単独模型の成功とは別。")

    # 胴の側の板を根にする（脚の外でいちばん大きい面）
    anchor = max((f for f in faces if f not in leg), key=lambda f: abs(M.area(faces[f]["cur"])))
    mo = MO.Model(faces, bonds, anchor=anchor)
    say(f"板 {len(mo.ids)}・結び {len(mo.bonds)}（木 {len(mo.tree_ids)}・木の外 {len(mo.loop_ids)}）／根＝脚の外の面")
    x0 = np.zeros(len(mo.tree_ids))
    say(f"出発（⑫のあとの平らな姿）の閉じの残り {np.linalg.norm(mo.residual(x0)):.1e}")

    # 脚の層の折り（脚の中の結び7本）
    inner = [b for b in bonds if b["faceIds"][0] in leg and b["faceIds"][1] in leg]
    say(f"脚の層の折り（脚の中の結び）{len(inner)}本")
    rows = []
    for b in inner:
        on_c = all(abs(M.cross(M.sub(p, legTip), u)) < 1e-9 for p in b["cur"])
        la, lb = faces[b["faceIds"][0]]["layer"], faces[b["faceIds"][1]]["layer"]
        rows.append((b, "中心線" if on_c else "外形の側", la, lb))

    # ---------- [0] 較正 ----------
    say("\n[0] 解き方の較正：中心線まわりに開ける集合（境界の結びがぜんぶ中心線の上）を 180° 開いた姿")
    center = M.line_of([legTip, petalTip])
    sets = [c for ln, c in M.single_axis_sets(faces, bonds) if ln == center and c & leg and anchor not in c]
    if not sets:
        bad("較正に使う集合が無い")
        return
    S = min(sets, key=len)
    border = [b for b in bonds if (b["faceIds"][0] in S) != (b["faceIds"][1] in S)]
    pins = []
    for b in border:
        a_, b_ = (b["faceIds"][0], b["faceIds"][1]) if b["faceIds"][1] in S else (b["faceIds"][1], b["faceIds"][0])
        pins.append((a_, b_, b["cur"], math.pi))
    v, _ = solve(mo, pins, STARTS, rng)
    say(f"  集合 {len(S)}枚・境界の結び {len(border)}本を 180° に押さえる → 残り {v:.1e}"
        f"（{'取れた＝解き方は働く' if v < 1e-9 else '**取れない＝解き方がおかしい**'}）")
    if v > 1e-9:
        bad("較正の姿が取れない（解き方を信用できない）")
        return
    # 較正2：取れないはずの姿（脚の外の結びを、軸の外で開く）＝ここは出さない（何を「取れない」とするかに前提が要るため）

    # ---------- [S1..S7] 1本ずつ ----------
    say("\n[S1..S7] 脚の層の折りを1本だけ平らに開いた姿（⑬の線は 0＝先と元は1枚）")
    results = []
    for i, (b, where, la, lb) in enumerate(rows, 1):
        pins = [(b["faceIds"][0], b["faceIds"][1], b["cur"], math.pi)]
        v, x = solve(mo, pins, STARTS, rng)
        ok = v < 1e-9
        results.append(ok)
        say(f"  S{i}：層{la}|層{lb}（{where}・{b['kind']}）→ 閉じの残り {v:.2e}"
            f" → **{'取れる' if ok else '数値では見つからない'}**")

    # ---------- [Sall] 同時 ----------
    say("\n[Sall] 7本を同時に平らに開いた姿（脚1本を平らに広げる）")
    pins = [(b["faceIds"][0], b["faceIds"][1], b["cur"], math.pi) for b, _, _, _ in rows]
    v, x = solve(mo, pins, STARTS, rng)
    say(f"  → 閉じの残り {v:.2e} → **{'取れる' if v < 1e-9 else '数値では見つからない'}**")

    say("\n[答え]")
    if all(results):
        say("  7本とも、1本ずつなら平らに開いた姿は取れる＝**分岐点は鶴全体でも静的には存在する**。"
            "そこへ出発から連続に行けるか・途中ですり抜けないか・終端の層順は、次に別に確かめる。")
    else:
        miss = [i + 1 for i, ok in enumerate(results) if not ok]
        say(f"  S{miss} の姿が数値で見つからない。⑬が剛体で中割りになるには7本すべてが分岐点を通る必要があるので、"
            "**いまの折線のままの鶴全体では、単独模型と同じ仕組みの中割りは数値で見つからない**。")
        say("  🚨 これは幾何的に不可能の証明ではない（最小二乗の出発点による）。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
