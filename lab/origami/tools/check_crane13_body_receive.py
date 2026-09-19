# -*- coding: utf-8 -*-
"""つる⑬：胴側が、脚の上4層（元-1・元3・元1・元0）の +180° を受けられるか（2026-09-18・検査だけ）

⚠ 指示にあった `./origami_test --mode leg_to_body` はこのリポジトリに無い（Python の検査しかない）。
   同じフラグをこの検査に付けた：--branchframe / --stackflags / --thickness / --body-candidates / --log。
   `./origami_test` は、この検査を呼ぶだけのラッパ（tools/origami_test）。

やること
  ・紙ぜんぶ（56枚）を板とちょうつがいの図にする。脚16枚は第18・19段の**式で決まる置かれ方に固定**（pin）。
  ・残り40枚（胴＋もう1本の脚）の折り角を、各時点で結びの閉じから解く（探索ではなく、前の姿から続ける数値解き）。
  ・出発 → 段1（背を開く）→ 分岐点 → 段2・3（⑬を折る）→ 終端。各時点で 結びのずれ・剛体・すり抜けを測り、
    終わりに保存した目標（crane13_terminal_target.json）の位置・表裏・上下と照合する。
  ・--body-candidates を付けると、そこに挙げた胴の面だけを動かし、ほかの胴の面は出発の置かれ方に固定する。
  ・厚みは「終端で同じ置かれ方になる組（crane13_stack_flags.json の印）」の決着だけに使う（第19段 §76）。
使い方：
  PYTHONHASHSEED=0 python check_crane13_body_receive.py --thickness 0 --log leg_to_body_run.log
  PYTHONHASHSEED=0 python check_crane13_body_receive.py --thickness 1e-4 --log leg_to_body_thick_run.log
  PYTHONHASHSEED=0 python check_crane13_body_receive.py --body-candidates -3a,6,2,0a --thickness 0 --log leg_to_body_candidates.log
"""
import importlib.util
import json
import math
import os
import sys
import time

import numpy as np
from scipy.optimize import least_squares
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("PYTHONHASHSEED") != "0":
    print("ABORT: PYTHONHASHSEED=0 で回すこと")
    sys.exit(2)
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("lf", os.path.join(HERE, "check_crane13_leg_frame.py"))
LF = importlib.util.module_from_spec(_s)
_s.loader.exec_module(LF)
sys.argv = _argv
SP, TS, MOT = LF.SP, LF.TS, LF.MOT


def arg(name, default=None):
    return _argv[_argv.index(name) + 1] if name in _argv else default


EPS = float(arg("--thickness", "0"))
CANDS = [c.strip() for c in arg("--body-candidates", "").split(",") if c.strip()]
LOGPATH = arg("--log", "leg_to_body_run.log")
FRAME = arg("--branchframe", "crane13_branchpoint_frame.json")
FLAGS = arg("--stackflags", "crane13_stack_flags.json")
STEPS1 = int(arg("--steps1", "60"))
STEPS2 = int(arg("--steps2", "90"))
ng = []
_log = open(os.path.join(HERE, LOGPATH), "w", encoding="utf-8")


def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    _log.write(s + "\n")
    _log.flush()


def bad(m):
    ng.append(m)
    say("  NG:", m)


def dump_summary(d):
    path = os.path.join(HERE, os.path.splitext(LOGPATH)[0] + "_summary.json")
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    say(f"  要約 JSON：{os.path.basename(path)}")


def main():
    t0 = time.time()
    say(f"# つる⑬ 胴受けテスト（mode leg_to_body）／厚み {EPS:g}／胴の候補 {CANDS or 'すべての胴'}／{time.strftime('%Y-%m-%d %H:%M:%S')}")
    say(f"# ⚠ ./origami_test は存在しないので、この Python の検査（check_crane13_body_receive.py）で同じフラグを受けた")
    say(f"# 基準面 {FRAME}／印 {FLAGS}")
    D, cut, P, BB, cutseg = TS.build_input()
    T = json.load(open(os.path.join(HERE, "crane13_terminal_target.json"), encoding="utf-8"))
    TS.NAMES.update(T["names"])
    for f in P:
        if f not in TS.NAMES:
            TS.NAMES[f] = ("先" if P[f]["moves"] else "元" if P[f]["leg"] else "他") + f"{P[f]['layer']}"
    frame = json.load(open(os.path.join(HERE, FRAME), encoding="utf-8"))
    flags = json.load(open(os.path.join(HERE, FLAGS), encoding="utf-8"))
    if frame["fingerprint"] != D["meta"]["stateFingerprint"]:
        bad("基準面の指紋が入力と違う")
        return
    say(f"  指紋 {frame['fingerprint'][:12]}…／脚のじゃばら {frame['legChainLayers']}／背の角 {frame['spineVertex']}"
        f"／印（同高さ）の組 {sum(1 for p_ in flags['pairs'] if p_['zero_thickness_tie'])}/{len(flags['pairs'])}")

    world, legids, Vspine, riders, layers, si, _ = LF.build_leg_motion(D, cut, P, BB, T, verbose=False)
    legids = sorted(legids)
    upper = [f for f in legids if not P[f]["moves"] and P[f]["layer"] in layers[si + 1:]]
    say(f"  脚16枚は式で固定（pin）。上4層の元＝" + "・".join(TS.short(f) for f in sorted(upper, key=lambda f: P[f]["layer"])) + "（分岐点で背のまわりに +180°）")

    # 板とちょうつがいの図（56枚）
    mo = MOT.Model(cut["faces"], cut["bonds"], anchor=[f for f in legids if TS.short(f) == f"元{layers[si]}"][0], last=sorted(cut["tip"]))
    n = len(mo.tree_ids)
    say(f"  図：板 {len(mo.ids)}・ちょうつがい {len(mo.bonds)}（木 {n}・木の外 {len(mo.loop_ids)}）・根＝{TS.short(mo.anchor)}（動かない脚の元）")
    body = [f for f in mo.ids if f not in legids]
    pinned_body = []
    if CANDS:
        keep = set()
        for c in CANDS:
            hit = [f for f in body if TS.short(f) in (f"胴{c}", f"他{c}", c)]
            if not hit:
                bad(f"胴の候補 {c} に当たる面が無い（名前は crane13_terminal_names.json / 基準面の legName を見る）")
            keep |= set(hit)
        pinned_body = [f for f in body if f not in keep]
        say(f"  胴の候補：{'・'.join(sorted(TS.short(f) for f in keep))} だけ動かす／ほかの胴・もう1本の脚 {len(pinned_body)}枚は出発の置かれ方に固定")
    if ng:
        return

    faces = cut["faces"]
    pin_pts = {f: [np.array(q[:2], float) for q in faces[f]["cur"]] for f in mo.ids}

    REG = float(arg("--reg", "1e-3"))

    def residuals(x, Wleg, xprev=None):
        T_ = mo.placements(x)
        parts = [1e3 * mo.residual(x, T_)]
        for f in legids:
            for q in pin_pts[f]:
                parts.append(1e3 * (MOT.xform(T_[f], q) - MOT.xform(Wleg[f], q)))
        for f in pinned_body:
            for q in pin_pts[f]:
                parts.append(1e3 * (MOT.xform(T_[f], q) - np.array([q[0], q[1], 0.0])))
        if xprev is not None:
            parts.append(REG * (x - xprev))       # 前の姿からの変化を最小にする（漂いを止める。閉じと pin より弱い重み）
        return np.concatenate([np.atleast_1d(p_).ravel() for p_ in parts])

    def solve(x0, Wleg):
        """前の姿から続ける（枝を変えない）：①そのまま解く ②弱い引き戻しつき ③最後の手段として出発点を散らす（印をつける）"""
        r = least_squares(residuals, x0, args=(Wleg, None), method="lm", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000)
        v = float(np.linalg.norm(residuals(r.x, Wleg)))
        if v < 1e-9:
            return v, r.x, ""
        r2 = least_squares(residuals, x0, args=(Wleg, x0), method="lm", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000)
        v2 = float(np.linalg.norm(residuals(r2.x, Wleg, None)))
        if v2 < 1e-9:
            return v2, r2.x, "（引き戻しつきで解けた）"
        best = (v, r.x, "")
        for k in range(1, 6):
            xx = x0 + np.random.default_rng(k).normal(0, 0.05, n)
            rk = least_squares(residuals, xx, args=(Wleg, None), method="lm", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=3000)
            vk = float(np.linalg.norm(residuals(rk.x, Wleg)))
            if vk < best[0]:
                best = (vk, rk.x, f"（出発点を散らして解いた＝枝が変わった可能性・変化 {float(np.linalg.norm(rk.x - x0)):.2f}）")
            if vk < 1e-9:
                break
        return best

    # 経路：出発 → 段1 → 分岐点 → 段2・3 → 終端
    sched = [("出発", [("open", math.pi)])]
    sched.append(("段1 背を開く", [("open", math.pi * (1 - i / STEPS1)) for i in range(1, STEPS1 + 1)]))
    zs = [math.pi * i / STEPS2 for i in range(1, STEPS2 + 1)]
    zs[-1] = math.pi * (1 - 1e-4)
    sched.append(("段2・3 ⑬を折る", [("rev", z) for z in zs] + [("rev", math.pi)]))
    x = np.zeros(n)
    worst = dict(close=0.0, pin=0.0, rigid=0.0, pen=0.0, who=None, at=None, stop=None)
    snap = {}
    checkpoints = set()
    say("\n[経路] 脚は式どおり・胴は各時点で結びの閉じから解く（前の姿から続ける）")
    for name, items in sched:
        for k, (br, t) in enumerate(items):
            Wleg = world(br, t)
            v, xs, note = solve(x, Wleg)
            T_ = mo.placements(xs)
            close = MOT.M and float(np.max(np.abs(mo.residual(xs, T_))))
            pin = max(max(float(np.linalg.norm(MOT.xform(T_[f], q) - MOT.xform(Wleg[f], q))) for q in pin_pts[f]) for f in legids)
            pinb = max((max(float(np.linalg.norm(MOT.xform(T_[f], q) - np.array([q[0], q[1], 0.0]))) for q in pin_pts[f]) for f in pinned_body), default=0.0)
            rig = SP.bond_err(T_, [dict(a=b["faceIds"][0], b=b["faceIds"][1], seg0=[list(q[:2]) for q in b["cur"]]) for b in mo.bonds])
            worst["close"] = max(worst["close"], close)
            worst["pin"] = max(worst["pin"], pin, pinb)
            worst["rigid"] = max(worst["rigid"], rig)
            if v > 1e-6 and worst["stop"] is None:
                worst["stop"] = f"{name} {br} {math.degrees(t):.2f}°：解けない（残り {v:.2e}／結びのずれ {close:.2e}／pin {max(pin, pinb):.2e}）"
                say(f"  **止まった**：{worst['stop']}")
                snap[name + "-stop"] = (xs, Wleg, T_)
                break
            x = xs
            tag = f"{name} {math.degrees(t):.1f}°"
            if note:
                say(f"  {name} {math.degrees(t):.1f}°：{note}")
            if k == len(items) - 1 or k % max(1, len(items) // 3) == 0:
                say(f"  {tag}：結びのずれ {close:.2e}・剛体（結びの線のずれ）{rig:.2e}・脚の pin {pin:.2e}"
                    + (f"・固定した胴の pin {pinb:.2e}" if pinned_body else ""))
                checkpoints.add((name, k))
            snap[name] = (xs, Wleg, T_)
        if worst["stop"]:
            break
    say(f"  全区間：結びのずれ（最大）{worst['close']:.2e}／剛体 {worst['rigid']:.2e}／pin（最大）{worst['pin']:.2e}")
    if worst["close"] > 1e-12:
        bad(f"結びのずれが 1e-12 を超える（{worst['close']:.2e}）")

    # すり抜け（重い判定なので節目だけ）
    say("\n[すり抜け] 節目の姿で、隣り合わない板の交わりを見る（厚み0・板を1%縮める）")
    for label in [k for k in ("出発", "段1 背を開く", "段2・3 ⑬を折る") if k in snap] + [k for k in snap if k.endswith("-stop")]:
        xs, Wleg, T_ = snap[label]
        pen, who = SP.penetration(T_, {f: dict(start=[list(q[:2]) for q in faces[f]["cur"]]) for f in mo.ids}, mo.ids,
                                  flat_ok=(label in ("出発",) or label.startswith("段2")))
        say(f"  {label}：{'なし' if pen <= 0 else f'あり 深さ {pen:.2e}／{TS.short(who[0])} × {TS.short(who[1])}（{who[2]}）'}")
        if pen > 0:
            worst["pen"], worst["who"], worst["at"] = pen, who, label
            aabb = {}
            for f in (who[0], who[1]):
                Q = np.array([MOT.xform(T_[f], q[:2]) for q in faces[f]["cur"]])
                aabb[f] = (np.round(Q.min(axis=0), 6).tolist(), np.round(Q.max(axis=0), 6).tolist())
            say(f"    該当の組：{who[0]}／{who[1]}")
            for f, (lo, hi) in aabb.items():
                say(f"    AABB {TS.short(f)}：min {lo}・max {hi}")
    if worst["pen"] > 0:
        bad("すり抜けがある")

    if worst["stop"]:
        say("\n[止まった所の内訳] 層ごとの結びの角（脚の式 と 解いた姿 の差）")
        xs, Wleg, T_ = snap[[k for k in snap if k.endswith("-stop")][0]]
        for b in mo.bonds:
            a_, c_ = b["faceIds"]
            if a_ in legids and c_ in legids:
                bb = dict(a=a_, b=c_, seg0=[list(q[:2]) for q in b["cur"]])
                d1 = SP.rel_angle({a_: T_[a_], c_: T_[c_]}, bb)
                d2 = SP.rel_angle({a_: Wleg[a_], c_: Wleg[c_]}, bb)
                if abs(d1 - d2) > 1e-9:
                    say(f"  {TS.short(a_)}|{TS.short(c_)}：解いた {math.degrees(d1):+.3f}°／式 {math.degrees(d2):+.3f}°・差 {math.degrees(d1 - d2):+.3e}°")
        say(f"\n# 受け入れ基準に達していない（{worst['stop']}）。時間 {time.time() - t0:.0f}s")
        return

    # 終端の照合
    say("\n[照合] 目標（crane13_terminal_target.json）との照合")
    xs, Wleg, Tend = snap["段2・3 ⑬を折る"]
    znear = math.pi * (1 - 1e-4)
    vN, xN, _ = solve(xs, world("rev", znear))
    Tnear = mo.placements(xN)
    A, B = cutseg
    Rpi = MOT.rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    tset = set(cut["tip"])
    pos = max(max(float(np.linalg.norm(MOT.xform(Tend[f], q) - MOT.xform(Rpi if f in tset else np.eye(4), q))) for q in pin_pts[f]) for f in mo.ids)
    say(f"  位置：目標（先＝⑬の線で鏡・ほかは動かない）とのずれ（最大・56枚ぜんぶ）{pos:.2e}")
    sides = [(f, (1 if Tend[f][2, 2] > 0 else -1), (-1 if f in tset else 1)) for f in mo.ids]
    nside = sum(1 for _, a, b in sides if a == b)
    say(f"  表裏：{nside}/{len(sides)} 一致")
    if pos > 1e-9 or nside != len(sides):
        bad("終端の位置・表裏が目標と違う")
    above = {(a, b): r for a, b, r in T["above"]}
    polys = {f: Polygon([MOT.xform(Rpi if f in tset else np.eye(4), q)[:2] for q in pin_pts[f]]) for f in mo.ids}
    start_rel = {(a, b): r for (a, b), r in [((p_["a"], p_["b"]), p_["target"]) for p_ in flags["pairs"]]}
    tie_flag = {(p_["a"], p_["b"]): p_ for p_ in flags["pairs"]}
    n_ok = n_ng = n_tie = 0
    changed = []
    for (a, b), r in sorted(above.items()):
        if a not in polys or b not in polys:
            continue
        it = polys[a].intersection(polys[b])
        if it.area <= 1e-9:
            continue
        pt = it.representative_point()
        h = {}
        for f in (a, b):
            Te = Rpi if f in tset else np.eye(4)
            q = np.linalg.inv(Te) @ np.array([pt.x, pt.y, 0.0, 1.0])
            h[f] = float(MOT.xform(Tnear[f], q[:3])[2])
        tie = abs(h[b] - h[a]) <= 1e-12
        if not tie:
            got = 1 if h[b] > h[a] else -1
            how = f"高さ（差 {abs(h[b] - h[a]):.1e}）"
        else:
            n_tie += 1
            fl = tie_flag.get((a, b))
            if EPS > 0:
                dth = P[b]["layer"] * float(Tnear[b][2, 2]) - P[a]["layer"] * float(Tnear[a][2, 2]) if a in P and b in P else 0.0
                got = 1 if dth > 0 else -1
                how = f"高さが同じ → 厚み EPS={EPS:g} で決めた（層の順 {dth:+.0f}）"
            else:
                got = fl["target"] if fl else 0
                how = "高さが同じ → 印（出発の上下の持ち越し）"
            if fl and fl["got"] != got:
                changed.append((a, b, fl["got"], got, how))
        ok = got == r
        n_ok += ok
        n_ng += not ok
        if not ok:
            say(f"  **反する**：{TS.short(a)} と {TS.short(b)}：着いた {'上' if got > 0 else '下'}／目標 {'上' if r > 0 else '下'}（{how}）")
    say(f"  上下：重なる組 {n_ok + n_ng} のうち一致 {n_ok}・反する {n_ng}（うち高さが同じ＝厚みの扱いで決まる組 {n_tie}）")
    say(f"  厚みの導入で第19段の印から変わった組：{len(changed)}" + ("" if not changed else "　→ " + "／".join(f"{TS.short(a)}|{TS.short(b)}" for a, b, *_ in changed)))
    if n_ng:
        bad("終端の上下が目標と違う")

    # 累積回転
    say("\n[累積回転] 出発 0 から unwrap（経路の結果・条件にはしていない）")
    wind = {}
    for b in mo.bonds:
        a_, c_ = b["faceIds"]
        bb = dict(a=a_, b=c_, seg0=[list(q[:2]) for q in b["cur"]])
        ref = 0.0
        for label in ("出発", "段1 背を開く", "段2・3 ⑬を折る"):
            if label not in snap:
                continue
            T_ = snap[label][2]
            an = SP.rel_angle({a_: T_[a_], c_: T_[c_]}, bb)
            ref = an + 2 * math.pi * round((ref - an) / (2 * math.pi))
            wind[(b["bondId"], a_, c_, label)] = ref
    def get(a_, c_, label):
        for (bid, x_, y_, lb), v in wind.items():
            if lb == label and {x_, y_} == {a_, c_}:
                return math.degrees(v)
        return float("nan")
    spine_tip = [f for f in legids if TS.short(f) in (f"先{layers[si]}", f"先{layers[si+1]}")]
    say(f"  先{layers[si]}|先{layers[si+1]}（背の先）：分岐点 {get(*spine_tip, '段1 背を開く'):+.1f}° → 終端 {get(*spine_tip, '段2・3 ⑬を折る'):+.1f}°")
    others, cuts = [], []
    for b in mo.bonds:
        a_, c_ = b["faceIds"]
        if a_ in legids and c_ in legids:
            v = get(a_, c_, "段2・3 ⑬を折る")
            if b["bondId"].startswith("cut:"):
                cuts.append((TS.short(a_), TS.short(c_), v))
            elif set((a_, c_)) != set(spine_tip):
                others.append((TS.short(a_), TS.short(c_), v))
    say(f"  背のほかの折り {len(others)} 本：" + "・".join(f"{a}|{b} {v:+.0f}°" for a, b, v in sorted(others)))
    say(f"  ⑬の {len(cuts)} 本：" + "・".join(f"{a}|{b} {v:+.0f}°" for a, b, v in sorted(cuts)))

    # 胴で動いた面
    say("\n[胴] 動いた面と、対応する脚の結び")
    b2l = {}
    for b in mo.bonds:
        a_, c_ = b["faceIds"]
        if (a_ in legids) != (c_ in legids):
            legf, bodyf = (a_, c_) if a_ in legids else (c_, a_)
            b2l.setdefault(bodyf, []).append((TS.short(legf), b["bondId"], b["kind"]))
    for label in ("段1 背を開く", "段2・3 ⑬を折る"):
        T_ = snap[label][2]
        moved = [f for f in mo.ids if f not in legids and float(np.max(np.abs(T_[f] - np.eye(4)))) > 1e-6]
        say(f"  {label} の終わり：動いた胴・もう1本の脚の面 {len(moved)}枚")
        for f in sorted(moved, key=lambda f: -float(np.max(np.abs(T_[f] - np.eye(4))))):
            d = float(np.max(np.abs(T_[f] - np.eye(4))))
            ang = math.degrees(LF.ang_about(T_[f][:3, :3], np.array([Vspine.d[0], Vspine.d[1], 0.0])))
            link = "／".join(f"{ln}（{bid[:18]}・{kd}）" for ln, bid, kd in b2l.get(f, [])) or "脚と直につながらない"
            say(f"    {TS.short(f)}：出発からのずれ {d:.3f}・背のまわりの角 {ang:+.1f}°／脚の結び {link}")
            moved_summary.append(dict(stage=label, face=f, name=TS.short(f), max_dev=d, angle_about_spine_deg=ang,
                                      leg_bonds=[dict(leg=ln, bondId=bid, kind=kd) for ln, bid, kd in b2l.get(f, [])]))
    say(f"\n# 終わり（{time.time() - t0:.0f}s）／" + ("受け入れ基準を満たした" if not ng else f"NG {len(ng)} 件：" + "／".join(ng)))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        tb = traceback.format_exc()
        say(tb)
        say("ABORT: 検査が例外で止まった")
        sys.exit(2)
    sys.exit(0 if not ng else 1)
