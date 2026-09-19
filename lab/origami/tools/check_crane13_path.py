# -*- coding: utf-8 -*-
"""つる⑬：**出発 → 中割りの層順で終わる、閉路を保った連続経路**を1本さがす（2026-09-16・第3段）

**本体・UI・保存形式は無変更。**

やり方（前の段で「解の上をふらつく」ことが分かったので、追い方を作り直した）
  ・**予測子・修正子でひと筋に追う**：いまの姿での接ベクトル（閉じを保ったまま駆動を1だけ増やす向き・最小ノルム）で
    予測し、駆動を押さえてニュートンで修正（修正も最小ノルム＝前の姿からいちばん近い解を選ぶ）。
    🚨 これは**計算の上で姿を選ぶ決まり**であって、物理の拘束でも自由度の証明でもない（本人指示）。
  ・駆動は**基準例で確かめた最小限**（開く角1本 → 中割り線の角1本 → 閉じ直す角1本）。ほかは連続性で選ぶ。
  ・**自由度は各段で測り直す**（出発の6を途中にも当てはめない）。
  ・**非貫通は途中の枝を選ぶ条件**として使う（面の交差・接触・軸まわりの並び）。
  ・到達の判定は**別々に**：①全結びの一致 ②剛体性 ③目標終端の座標 ④終端の上下。

段階（周囲の拘束を1つずつ足して、どこで難しくなるかを見る）
  M1 合成のじゃばら（結びを省いた模型）…2枚・8枚
  M2 実際の脚8枚だけ（胴への結びを外した紙）  ← 実際の素材・実際の折り目、周囲は省く
  M3 実際の脚＋胴への結び（＝実際の紙ぜんぶ 56枚）
  ⚠ M1・M2 は**結びを省いた模型**。ここでの成功は M3（実際の紙）の成功とは別に扱う。

使い方： python check_crane13_path.py [--angle 度] [--pos 距離] [--only M1|M2|M3]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util, math, os, sys, traceback
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, fn):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, fn))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


_argv = sys.argv
sys.argv = [sys.argv[0]]
MO = _load("crane13_motion", "check_crane13_motion.py")
REF = _load("rf_ref", "check_reversefold_reference.py")
sys.argv = _argv
M = MO.M
ng = []


def say(*a):
    print(" ".join(str(x) for x in a))


def bad(m):
    ng.append(m)
    say("  NG:", m)


# ---------- 追跡（予測子・修正子） ----------
def tangent(mo, x, drive, pin=(), prefer=None):
    """閉じを保ったまま drive の角を 1 だけ増やす向き（pin の角は動かさない）。
       解が1つに決まらない（自由度が残る）ときは **prefer にいちばん近い向き**を選ぶ。
       🚨 これは**枝を選ぶための計算の決まり**（前の姿からの連続性・ねらう符号の型）であって、
          物理の拘束でも自由度の証明でもない。"""
    J, r = mo.jac(x)
    n = J.shape[1]
    rows = [J] + [np.eye(n)[drive][None, :]] + [np.eye(n)[p][None, :] for p in pin]
    A = np.vstack(rows)
    b = np.zeros(A.shape[0])
    b[J.shape[0]] = 1.0
    t, *_ = np.linalg.lstsq(A, b, rcond=None)
    if prefer is None:
        return t
    # A の核（＝まだ残っている自由度）の中で、prefer に近づける
    U, S, Vt = np.linalg.svd(A)
    rank = int((S > 1e-9).sum())
    N = Vt[rank:].T
    if N.size:
        a, *_ = np.linalg.lstsq(N, prefer - t, rcond=None)
        t = t + N @ a
    return t


def correct(mo, x, drive, value, it=30, tol=1e-12, pin=()):
    """drive を value に押さえ（pin の角も動かさず）、閉じをニュートンで修正（最小ノルム）"""
    x = x.copy()
    x[drive] = value
    hold = [drive] + list(pin)
    for _ in range(it):
        J, r = mo.jac(x)
        nr = np.linalg.norm(r)
        if nr < tol:
            break
        J2 = J.copy()
        J2[:, hold] = 0.0            # 押さえた角は動かさない
        dx, *_ = np.linalg.lstsq(J2, -r, rcond=None)
        dx[hold] = 0.0
        step = 1.0
        for _ in range(20):
            xt = x + step * dx
            if np.linalg.norm(mo.residual(xt)) < nr:
                x = xt
                break
            step *= 0.5
        else:
            break
    return x, np.linalg.norm(mo.residual(x))


def follow(mo, x0, drive, v0, v1, steps, watch=None, pin=(), prefer0=None):
    """v0→v1 へ drive を動かしながら、ひと筋に追う。
       prefer0＝最初の一歩でねらう向き（枝の選択）。次からは**前の一歩の向きに近い方**を選ぶ＝連続性。"""
    x = x0.copy()
    pts = []
    prev_t = prefer0
    v, step = v0, (v1 - v0) / steps
    guard = 0
    while (step > 0 and v < v1 - 1e-12) or (step < 0 and v > v1 + 1e-12):
        guard += 1
        if guard > steps * 40:
            break
        nv = v + step if abs(v + step - v0) < abs(v1 - v0) else v1
        t = tangent(mo, x, drive, pin, prefer=prev_t)
        xp = x + t * (nv - x[drive])                      # 予測
        xc, res = correct(mo, xp, drive, nv, pin=pin)     # 修正
        if res > 1e-9:
            # **刻みを細かくして**やり直す（止まりどころが本物か、刻みのせいかを分ける）
            if abs(step) > abs(v1 - v0) / (steps * 64):
                step /= 2
                continue
            return pts, dict(stopped=True, at=math.degrees(nv), res=res, x=x, step=abs(math.degrees(step)))
        x, v, prev_t = xc, nv, t
        pts.append(dict(v=v, x=x.copy(), res=res, extra=(watch(x, v) if watch else None)))
    return pts, dict(stopped=False, res=pts[-1]["res"] if pts else 0.0, x=x)


def dof_at(mo, x):
    J, _ = mo.jac(x)
    return J.shape[1] - np.linalg.matrix_rank(J, tol=1e-7)


# ---------- 段階ごとの紙 ----------
def model_M1(n=8, beta=20.0, cut=60.0, at=0.5):
    """合成のじゃばら（結びを省いた模型）"""
    faces, bonds, cutseg = REF.build(n, beta, cut, at)
    mo = MO.Model(faces, bonds, anchor="L0#base", last=[f"L{i}#tip" for i in range(n)])
    return mo, faces, bonds, cutseg, {f"L{i}#tip" for i in range(n)}


def real_cut(angle, pos, legno=1, oripa=False):
    """実際の紙（⑫のあと）に中割り線を1本入れた図。
       `oripa=True` で、**ORIPA の元の端点から作った線**（crane13_cutline.json）を使う
       （丸めた角度は経由しない）。False なら代表値の仮置き（先端から pos・中心線と angle 度）。"""
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
    if oripa:
        line, rec, cmeta = M.oripa_cut_line(legno, D["meta"]["stateFingerprint"])
        if set(rec["faceIds"]) != set(legs[legno - 1]):   # 2026-09-17：脚と線の取り違えで 90通り・中割り27 が出ていた
            raise RuntimeError("crane13_cutline.json の脚%d の faceIds が、いまの脚%d と違う（脚と線の取り違え）" % (legno, legno))
        cut = M.cut_graph(legs[legno - 1], faces, bonds, legTip, u, 0, 0, line=line)
        cut["source"] = (f"ORIPA の元の端点（{cmeta['source']} sha1 {cmeta['sourceSha1'][:8]}…）"
                         f"／中心線との交わりは先端から {rec['distTipToV']:.6f}"
                         f"・なす角 {rec['angleDeg']:.4f}° は報告用")
    else:
        cut = M.cut_graph(legs[legno - 1], faces, bonds, legTip, u, pos, angle)
        cut["source"] = f"代表値の仮置き（先端から {pos}・中心線と {angle}°）"
    return D, faces, cut, legs[legno - 1], (legTip, petalTip, u)


def model_M2(cut, leg):
    """実際の脚8枚だけ（胴への結びを外した＝周囲を省いた模型）"""
    ids = {f"{fid}#{k}" for fid in leg for k in ("tip", "base")}
    faces = {k: v for k, v in cut["faces"].items() if k in ids}
    bonds = [b for b in cut["bonds"] if b["faceIds"][0] in ids and b["faceIds"][1] in ids]
    anchor = sorted(ids)[0].replace("#tip", "#base")
    mo = MO.Model(faces, bonds, anchor=anchor if anchor in faces else sorted(faces)[0],
                  last=[i for i in ids if i.endswith("#tip")])
    return mo, faces, bonds, {i for i in ids if i.endswith("#tip")}


def model_M3(cut, petalTip):
    mo = MO.Model(cut["faces"], cut["bonds"], anchor=MO.pick_anchor(cut, None, petalTip), last=cut["tip"])
    return mo, cut["faces"], cut["bonds"], set(cut["tip"])


# ---------- 判定の道具 ----------
def cut_vars(mo):
    return [mo.var_of[k] for k in mo.tree_ids if mo.bonds[k]["bondId"].startswith("cut:")]


def other_vars(mo):
    return [mo.var_of[k] for k in mo.tree_ids if not mo.bonds[k]["bondId"].startswith("cut:")]


def target_pattern(mo, tipset, faces, target_order):
    """**ねらう層順**（[J] が拘束から数え上げた「中割り」の並び）から、折り始めの向きを決める。
       各「先の板」は、終端で自分の付け根の板より上に来るなら**上から回り込む**（＝その向きに折り出す）。
       🚨 これは**枝を選ぶための計算の決まり**。層順を終端で割り当て直すのではなく、
          「どちらの枝を追うか」を決めるだけで、着いた先の上下は別に読み直して確かめる。"""
    pos = {f: i for i, f in enumerate(target_order)}
    v = np.zeros(len(mo.tree_ids))
    for k in mo.tree_ids:
        b = mo.bonds[k]
        if not b["bondId"].startswith("cut:"):
            continue
        tip = b["faceIds"][0] if b["faceIds"][0] in tipset else b["faceIds"][1]
        base = b["faceIds"][1] if b["faceIds"][0] in tipset else b["faceIds"][0]
        if tip not in pos or base not in pos:
            continue
        want_above = pos[tip] > pos[base]
        # その角を少し＋にしたとき、その板が上へ行くか下へ行くか
        e = np.zeros(len(mo.tree_ids))
        e[mo.var_of[k]] = 0.05
        T = mo.placements(e)
        c = np.mean([MO.xform(T[tip], p) for p in faces[tip]["cur"]], axis=0)
        up = c[2] > 0
        v[mo.var_of[k]] = 1.0 if (want_above == up) else -1.0
    return v


def alternating_pattern(mo, tipset, cutvars):
    """先の板を、板どうしの折り（180°）で2色に塗り分け、色ごとに逆向きの折り始めを作る。
       となり合う板は折りで向きが逆＝中割りでは互いに逆へ回る、というねらい。"""
    adj = {}
    for k, b in enumerate(mo.bonds):
        a, c = b["faceIds"]
        if a in tipset and c in tipset and not b["bondId"].startswith("cut:"):
            adj.setdefault(a, []).append(c)
            adj.setdefault(c, []).append(a)
    color, q = {}, []
    for f in sorted(tipset):
        if f in color:
            continue
        color[f], q = 1, [f]
        while q:
            x = q.pop()
            for y in adj.get(x, []):
                if y not in color:
                    color[y] = -color[x]
                    q.append(y)
    v = np.zeros(len(mo.tree_ids))
    for k in mo.tree_ids:
        b = mo.bonds[k]
        if not b["bondId"].startswith("cut:"):
            continue
        tip = b["faceIds"][0] if b["faceIds"][0] in tipset else b["faceIds"][1]
        v[mo.var_of[k]] = color.get(tip, 1)
    # 駆動する1本が +1 になるように向きをそろえる
    if cutvars and v[cutvars[0]] < 0:
        v = -v
    return v


def terminal_T(mo, tipset, cutseg):
    """目標終端の置かれ方（先の板＝中割り線での鏡・ほかは動かない）"""
    R = MO.rot_about((cutseg[0][0], cutseg[0][1], 0), (cutseg[1][0], cutseg[1][1], 0), math.pi)
    return {fid: (R if fid in tipset else np.eye(4)) for fid in mo.ids}


def gap_to(mo, x, T_want, faces):
    T = mo.placements(x)
    g = 0.0
    for fid in mo.ids:
        for p in faces[fid]["cur"]:
            g = max(g, float(np.linalg.norm(MO.xform(T[fid], p) - MO.xform(T_want[fid], p))))
    return g


def rigid_error(mo, x, faces):
    """剛体性：面の辺の長さが変わっていないか（置かれ方が等長か）"""
    T = mo.placements(x)
    e = 0.0
    for fid in mo.ids:
        pts = faces[fid]["cur"]
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            d0 = math.dist(a[:2], b[:2])
            d1 = float(np.linalg.norm(MO.xform(T[fid], a) - MO.xform(T[fid], b)))
            e = max(e, abs(d0 - d1))
    return e


def heights(mo, x, faces, T_end, sample):
    """終端で sample の真上に来る各板の点の高さ（＝終端の直前での上下を読む）"""
    T = mo.placements(x)
    out = {}
    for fid in mo.ids:
        Te = T_end[fid]
        # 終端で sample に来る、その板の点（出発の座標で）
        q = np.linalg.inv(Te) @ np.array([sample[0], sample[1], 0.0, 1.0])
        if not inside_poly(q[:2], faces[fid]["cur"]):
            continue
        out[fid] = float(MO.xform(T[fid], q[:3])[2])
    return out


def sample_point(faces, tipset, T_end):
    """終端で「先の板」と「付け根の板」が両方かぶる所を1点えらぶ（上下を読む場所）"""
    from shapely.geometry import Polygon
    tips = [Polygon([MO.xform(T_end[f], p)[:2] for p in faces[f]["cur"]]) for f in tipset]
    base = [Polygon([MO.xform(T_end[f], p)[:2] for p in faces[f]["cur"]]) for f in faces if f not in tipset]
    best, area = None, 0.0
    for a in tips:
        for b in base:
            it = a.intersection(b)
            if it.area > area:
                best, area = it, it.area
    if best is None:
        return None
    p = best.representative_point()
    return (p.x, p.y)


def classify(hs, tipset):
    """高さの並びから「先が付け根のあいだに入ったか（中割り）／外側か（外へ折る）」を読む"""
    t = sorted((v, k) for k, v in hs.items() if k in tipset)
    b = sorted((v, k) for k, v in hs.items() if k not in tipset)
    if not t or not b:
        return "読めない（片方が無い）", None
    tv = [v for v, _ in t]
    bv = [v for v, _ in b]
    if max(tv) < min(bv) or min(tv) > max(bv):
        return "外へ折る（先がぜんぶ外側）", False
    if min(bv) < min(tv) and max(tv) < max(bv):
        return "**中割り（先が付け根の層のあいだ）**", True
    return "どちらでもない（一部だけ中に入る）", None


def run(label, mo, faces, tipset, cutseg, note="", target_order=None, openers=None):
    """開く → 先を折る → 閉じ直す、をひと筋に追って、到達を別々に検算する"""
    say(f"\n=== {label} ===" + (f"　{note}" if note else ""))
    cv, ov = cut_vars(mo), other_vars(mo)
    say(f"  板 {len(mo.ids)}・ちょうつがい {len(mo.bonds)}（木 {len(mo.tree_ids)}・木の外 {len(mo.loop_ids)}）"
        f"／中割り線の角 {len(cv)}本／ほかの角 {len(ov)}本")
    if not cv:
        bad(f"{label}：中割り線の角が木に入っていない")
        return
    x = np.zeros(len(mo.tree_ids))
    say(f"  出発：閉じの残り {np.linalg.norm(mo.residual(x)):.1e}／自由度（1次・上限）{dof_at(mo, x)}")
    T_end = terminal_T(mo, tipset, cutseg)
    samp = sample_point(faces, tipset, T_end)

    # 段1：開く（駆動＝ほかの角のうち、0から素直に開ける1本）
    # 🚨 2枚のフラップで解を総当りしたら、中割りの枝は **ρ=0 のとき開きが ±180°**（＝フラップを開ききった所）
    #    でしか「開く枝」と出会わない。だから段1は**開ききる所まで**追う（実物の「開いて折って閉じる」と同じ）。
    opener, x1, reach = None, None, 0.0
    # 開く軸の候補：指定があればそれを先に試す（脚の背＝先の8枚を上下4枚ずつに分ける折り）
    cand = ([v for v in (openers or []) if v in ov] + [v for v in ov if v not in (openers or [])])
    for v in cand:
        pts, st = follow(mo, x, v, 0.0, math.radians(OPEN_DEG), OPEN_STEPS)
        got = math.degrees(pts[-1]["v"]) if pts else 0.0
        if pts and got > reach:
            opener, x1, reach = v, (pts[-1]["x"] if st["stopped"] else st["x"]), got
        if not st["stopped"]:
            break
    if opener is None:
        bad(f"{label}：開く動き（段1）が見つからない")
        return
    say(f"  段1 開く：{reach:.0f}° まで追えた"
        f"{'（ねらいの ' + str(OPEN_DEG) + '° に届かず＝ここで止まる）' if reach < OPEN_DEG - 1 else ''}"
        f"（閉じの残り {np.linalg.norm(mo.residual(x1)):.1e}／自由度 {dof_at(mo, x1)}）")

    # 段2：中割り線の角を 0→180（開きは自由・連続性で選ぶ）
    # 枝の選択：先の板を折りの向きで2色に塗り分け（となり合う板は180°の折りで向きが逆）、
    #   **色ごとに逆向き**に折り始める＝中割りのねらい。うまくいかなければ「ぜんぶ同じ向き」も試す。
    if target_order is not None:
        pattern = target_pattern(mo, tipset, faces, target_order)
        how = "ねらう層順（[J] の中割りの並び）から"
    else:
        pattern = alternating_pattern(mo, tipset, cv)
        how = "板の向きの塗り分けから"
    partner = {}      # 先の板 → その付け根の板
    for k in mo.tree_ids + mo.loop_ids:
        b = mo.bonds[k]
        if b["bondId"].startswith("cut:"):
            t = b["faceIds"][0] if b["faceIds"][0] in tipset else b["faceIds"][1]
            partner[t] = b["faceIds"][1] if b["faceIds"][0] in tipset else b["faceIds"][0]
    want_above = None
    if target_order is not None:
        pos = {f: i for i, f in enumerate(target_order)}
        want_above = {t: (pos[t] > pos[b]) for t, b in partner.items() if t in pos and b in pos}

    def attempt(pat, tag):
        """段2（折る）→段3（閉じ直す）→到達の判定。戻り：どの先の板が目標と逆側に着いたか"""
        say(f"  段2 の枝（{tag}）：＋{int((pat[cv] > 0).sum())}枚／−{int((pat[cv] < 0).sum())}枚")
        goal = math.pi * (1 if pat[cv[0]] >= 0 else -1)
        def watch(xx, v):
            return dict(open=max(abs(MO.ang_of(xx[i])) for i in ov))
        pts2, st2 = follow(mo, x1, cv[0], 0.0, goal, STEPS2, watch=watch, prefer0=pat)
        if st2["stopped"]:
            say(f"    段2 折る：中割り線の角 {st2['at']:.1f}° で止まる（残り {st2['res']:.1e}"
                f"・刻み {st2.get('step', 0):.3f}° まで細かくしても越えられない＝枝の折り返し点らしい"
                f"・そこでの自由度 {dof_at(mo, st2['x'])}）")
            return dict(ok=False, at=st2["at"])
        x2 = st2["x"]
        o2 = [p["extra"]["open"] for p in pts2]
        say(f"    段2 折る：180° まで追えた（残り {np.linalg.norm(mo.residual(x2)):.1e}）"
            f"／途中のほかの角の最大 {max(o2):.1f}°／終わりの最大 {o2[-1]:.1f}°／自由度 {dof_at(mo, x2)}")
        # 段3：閉じ直す（中割り線の角は押さえたまま、ほかの角を 0 へ）
        x3, near = x2, (pts2[-2]["x"] if len(pts2) >= 2 else x2)
        for _ in range(CLOSE_ROUNDS):
            big = max(ov, key=lambda i: abs(MO.ang_of(x3[i])))
            if abs(MO.ang_of(x3[big])) < 0.2:
                break
            pts3, st3 = follow(mo, x3, big, x3[big], 0.0, 12, pin=[cv[0]])
            if pts3:
                near = pts3[-2]["x"] if len(pts3) >= 2 else x3
                x3 = pts3[-1]["x"]
            if st3["stopped"]:
                say(f"    段3 閉じ直す：途中 {st3['at']:.1f}° で止まる（残り {st3['res']:.1e}）")
                break
        rest = max(abs(MO.ang_of(x3[i])) for i in ov)
        say(f"    段3 閉じ直す：残る開き {rest:.2f}°／閉じの残り {np.linalg.norm(mo.residual(x3)):.1e}")
        r1 = np.linalg.norm(mo.residual(x3))
        r2 = rigid_error(mo, x3, faces)
        r3 = gap_to(mo, x3, T_end, faces)
        say(f"    到達の判定：①全結び {r1:.2e}／②剛体性 {r2:.2e}／③目標終端の座標 {r3:.2e}")
        if samp is None:
            say("    ④終端の上下：読む場所が取れない")
            return dict(ok=r3 < 1e-5, gap=r3, wrong=[])
        hs = heights(mo, near, faces, T_end, samp)
        lab, inside = classify(hs, tipset)
        say(f"    ④終端の上下（終端の直前の高さで読む・{len(hs)}枚）：{lab}")
        wrong = []
        if want_above:
            for t, b in partner.items():
                if t in hs and b in hs and t in want_above:
                    if (hs[t] > hs[b]) != want_above[t]:
                        wrong.append(t)
            say(f"    ねらう層順と比べて、逆側に着いた先の板 {len(wrong)}/{len(want_above)}枚")
        return dict(ok=r3 < 1e-5, gap=r3, inside=inside, wrong=wrong, x=x3, res=r1, rigid=r2, label=lab)

    res = attempt(pattern, how)
    for it in range(RETRY):
        if not res.get("ok") or res.get("inside") or not res.get("wrong"):
            break
        # 逆側に着いた板だけ、折り出す向きを反転してやり直す（＝枝を選び直す）
        pat = pattern.copy()
        for k in mo.tree_ids:
            b = mo.bonds[k]
            if b["bondId"].startswith("cut:"):
                t = b["faceIds"][0] if b["faceIds"][0] in tipset else b["faceIds"][1]
                if t in res["wrong"]:
                    pat[mo.var_of[k]] *= -1
        pattern = pat
        say(f"  ↻ やり直し {it+1}：逆側に着いた {len(res['wrong'])}枚の折り出す向きを反転")
        res = attempt(pattern, f"やり直し{it+1}")
    return res
    return dict(ok=r3 < 1e-6, gap=r3, inside=inside, x=x3)


OPEN_DEG = 179.0   # 開ききる所まで（中割りの枝はここで開く枝と出会う）
OPEN_STEPS = 36
STEPS2 = 60
RETRY = 3   # 逆側に着いた板の向きを反転してやり直す回数
# 段3（閉じ直し）で「いちばん大きい開きを0へ」を何回くり返すか。
# ⚠ これは**追い方の打ち切り**であって幾何の限界ではない。既定は 8（これまでの結果と同じ）。
# `--close-rounds N` で増やせる＝「閉じ直せないのは回数が足りないだけか」を切り分けるため。
CLOSE_ROUNDS = 8


def main():
    global CLOSE_ROUNDS
    if "--close-rounds" in _argv:
        CLOSE_ROUNDS = int(_argv[_argv.index("--close-rounds") + 1])
        say(f"⚠ 段3（閉じ直し）のくり返しを {CLOSE_ROUNDS} 回にした（既定 8・追い方の打ち切りであって幾何の限界ではない）")
    ang = float(_argv[_argv.index("--angle") + 1]) if "--angle" in _argv else 60.0
    pos = float(_argv[_argv.index("--pos") + 1]) if "--pos" in _argv else 0.5
    only = _argv[_argv.index("--only") + 1] if "--only" in _argv else None
    oripa = "--oripa" in _argv
    if oripa:
        say("中割り線は **ORIPA の元の端点から**（crane13_cutline.json・丸めた角度は経由しない）")
        say("  ⚠ ORIPA は線の位置だけに使う（山谷・層の上下・途中の非貫通の根拠にはしない）")
    else:
        say(f"中割り線は**代表値の仮置き**：先端から {pos}・中心線と {ang}°")

    if only in (None, "M1"):
        for n in (2, 8):
            mo, faces, bonds, cutseg, tipset = model_M1(n=n, cut=ang, at=pos)
            run(f"M1 合成のじゃばら {n}枚", mo, faces, tipset, cutseg,
                note="⚠結びを省いた模型（胴も周囲も無い）＝実際の紙の成功とは別に扱う")

    if only in (None, "M2", "M3"):
        D, faces_all, cut, leg, geo = real_cut(ang, pos, oripa=oripa)
        say(f"  中割り線の出どころ：{cut['source']}")
        # ねらう層順＝[J]（拘束から数え上げた「中割り」の並び）。ここでは**枝を選ぶ**ためだけに使う。
        Rpi = MO.rot_about((cut["cutseg"][0][0], cut["cutseg"][0][1], 0),
                           (cut["cutseg"][1][0], cut["cutseg"][1][1], 0), math.pi)
        T_end_all = {fid: (Rpi if fid in cut["tip"] else np.eye(4)) for fid in cut["faces"]}
        say("\n[J 再掲] ねらう層順を、拘束から数え上げて取り出す")
        st = MO.stack_feasibility(cut, T_end_all, Rpi, faces_all)
        target = st["inside"][0] if st and st["inside"] else None
        say(f"  → ねらう層順：{'取れた' if target else '無い'}")
        def leg_openers(mo):
            """開く軸の候補＝脚の付け根側どうしをつなぐ折り（＝脚のポケットを開く所）"""
            base_ids = {f"{fid}#base" for fid in leg}
            return [mo.var_of[k] for k in mo.tree_ids
                    if mo.bonds[k]["faceIds"][0] in base_ids and mo.bonds[k]["faceIds"][1] in base_ids]
        if only in (None, "M2"):
            mo, faces, bonds, tipset = model_M2(cut, leg)
            run("M2 実際の脚8枚だけ", mo, faces, tipset, cut["cutseg"],
                note="⚠実際の素材・実際の折り目。ただし胴への結び（8本）を外した模型",
                target_order=target, openers=leg_openers(mo))
        if only in (None, "M3"):
            mo, faces, bonds, tipset = model_M3(cut, geo[1])
            run("M3 実際の紙ぜんぶ（56枚）", mo, faces, tipset, cut["cutseg"],
                note="胴への結びも入れた、実際の紙そのもの", target_order=target,
                openers=leg_openers(mo))


def inside_poly(p, poly, tol=1e-9):
    s = None
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        if abs(c) < tol:
            continue
        if s is None:
            s = c > 0
        elif (c > 0) != s:
            return False
    return True


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
