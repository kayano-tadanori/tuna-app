# -*- coding: utf-8 -*-
"""つる⑬ S1：「両方の角で元が戻る」は⑬の目標終端から必須と言えるか／交互の組はどの面の組の上下に反するか（2026-09-17）

本人指示：
  ・単独模型の「中割り／かぶせ折り」という名前でなく、**S1 の6面それぞれ**の終端の位置・表裏・重なる所の上下で比べる
  ・目標の上下は**採用した運動の枝から逆算しない**。⑬の目標（第2段 §9〜10・第7段 §29 の数え上げ）から決める
  ・残り 0.13 を根拠にするなら、固定した角・枝・駆動の条件を明記し「その条件下で閉じない」とだけ記録する
本体・UI・保存形式は無変更（検査だけ）。

目標（運動を使わない）
  置かれ方：平らな終端では各板は「動かない」か「⑬の線での鏡」だけ（第2段 §9・剛体性から一意）→ 先＝鏡・元＝そのまま
  表裏    ：置かれ方の行列式（素材→いまの位置の xf の向き × 鏡なら反転）
  上下    ：脚1の16枚の柱で、①重なる2枚に上下 ②折りのあいだをまたぐ紙を入れない ③同じ線の折りは入れ子
            ④元どうしは出発のまま、を満たす並べ方のうち、⑬の条件 (c)「先が元の層のあいだに入る」もの（§10 の数え方。いまの脚1では1通り＝ログ参照）
            → S1 の6面に制限して、重なる組ごとに上下がその並べ方で**一つに決まるか**を見る
  ⚠ ④（元どうしの上下は出発のまま）と (c) は⑬の目標の仮定そのもの（§9）。運動からは取っていない。

結び（ちょうつがい）の巻き数との対応（運動を使わない）
  出発で平らに畳まれた折り（層の折りの先・元）：終端の相対角 0 ＝相手は出発と同じ側／±2π ＝反対側
  出発で平ら（開いていた）⑬の線        ：+π と −π で相手の来る側が違う（数値で 1−ε だけ回して読む）
  → 目標の上下から、各結びの終端の相対角（巻き）を決める。駆動の「元が戻る(+1)」は 元 0・先 +2π·s に着く組。

使い方： PYTHONHASHSEED=0 python check_crane13_s1_target.py
出力：   ログ（標準出力）・crane13_s1_target.json（図 make_crane13_s1_target_fig.py が読む）
"""
import importlib.util
import io
import itertools
import json
import math
import os
import sys
import contextlib

import numpy as np
from scipy.optimize import linprog
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("PYTHONHASHSEED") != "0":
    print("ABORT: PYTHONHASHSEED=0 で回すこと（枝の選び方が揺れる）")
    sys.exit(2)
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("stages", os.path.join(HERE, "check_crane13_stages.py"))
SG = importlib.util.module_from_spec(_s)
_s.loader.exec_module(SG)
_s = importlib.util.spec_from_file_location("motion", os.path.join(HERE, "check_crane13_motion.py"))
MOT = importlib.util.module_from_spec(_s)
_s.loader.exec_module(MOT)
sys.argv = _argv
P, M, MO, OP = SG.P, SG.M, SG.MO, SG.OP
ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def det_xf(f):
    a, b, c, d = f["xf"][:4]
    return 1 if a * d - b * c > 0 else -1


def main():
    D, faces_all, cut, leg, geo, chain, verts = SG.build()
    i = next(v["i"] for v in verts if v["center"] and verts[v["i"] + 1]["center"] is False)
    sub = chain[i:i + 3]
    S1 = sorted(f"{f}#{k}" for f in sub for k in ("tip", "base"))
    lay = {p: cut["faces"][p]["layer"] for p in S1}
    name = {p: ("先" if p.endswith("#tip") else "元") + f"{lay[p]}" for p in S1}
    tipset = {p for p in S1 if p.endswith("#tip")}
    A, B = cut["cutseg"]
    Rpi = MO.rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    T_end = {p: (Rpi if p in tipset else np.eye(4)) for p in cut["faces"]}
    say("S1 の6面：" + "／".join(name[p] for p in S1) + "（層番号は出発の engine の層）")

    # ---------- [A] 目標の置かれ方・表裏 ----------
    say("\n[A] 目標終端の置かれ方と表裏（運動を使わない）")
    face_tab = {}
    for p in S1:
        f = cut["faces"][p]
        side0 = det_xf(f)
        side1 = side0 * (-1 if p in tipset else 1)
        poly = [MO.xform(T_end[p], q)[:2].tolist() for q in f["cur"]]
        face_tab[p] = dict(name=name[p], move="⑬の線で鏡" if p in tipset else "動かない", side0=side0, side1=side1, poly=poly)
        say(f"  {name[p]:>5}：{face_tab[p]['move']}・表裏 出発 {'表上' if side0 > 0 else '裏上'} → 終端 {'表上' if side1 > 0 else '裏上'}")

    # ---------- [B] 目標の上下（16枚の柱の数え上げ → S1 に制限） ----------
    say("\n[B] 目標の上下：脚1の16枚の柱の数え上げ（第7段 §29 と同じ関数 stack_feasibility）")
    col = {}
    for tag, extra in (("16枚（脚1だけ・§10/§29 と同じ柱）", False), ("32枚（着地の所に重なる胴の16枚も、動かない紙として柱に入れる）", True)):
        cc = dict(cut)
        if extra:
            landing = Polygon()
            for f in cut["tip"]:
                landing = landing.union(Polygon([MO.xform(Rpi, q)[:2] for q in cut["faces"][f]["cur"]]))
            body = {f for f in cut["faces"] if f not in cut["tip"] and f not in cut["base"]
                    and Polygon(cut["faces"][f]["cur"]).intersection(landing).area > 1e-9}
            cc["base"] = set(cut["base"]) | body
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            r_ = MOT.stack_feasibility(cc, T_end, Rpi, faces_all)
        say(f"  柱 {tag}")
        for ln in buf.getvalue().splitlines():
            if "通り" in ln or "重なるほかの紙" in ln:
                say("    " + ln.strip()[:160])
        col[extra] = r_
    res = col[True] if col[True] and col[True]["inside"] else col[False]
    say(f"  → 目標に使う柱：{'32枚' if res is col[True] else '16枚'}")
    say("  ⚠ §29 の記録「90通り・中割り27」は、いま（PYTHONHASHSEED=0・脚1/脚2 の並びを固定したあと）の16枚の柱では再現しない（上の値）。原因は未確認。")
    inside = res["inside"]
    if not inside:
        bad("目標（中割りの並べ方）が1つも無い")
        return
    polys = {p: Polygon(face_tab[p]["poly"]) for p in S1}
    pairs = []
    for a, b in itertools.combinations(S1, 2):
        it = polys[a].intersection(polys[b])
        if it.area > 1e-9:
            pairs.append((a, b, it))
    say(f"  S1 の6面で終端に重なる組 {len(pairs)}（15組のうち）")
    target = {}
    for a, b, it in pairs:
        rel = set()
        for s in inside:
            pos = {f: k for k, f in enumerate(s)}
            rel.add(1 if pos[b] > pos[a] else -1)        # +1＝b が a より上（世界の z）
        allrel = set(1 if {f: k for k, f in enumerate(s)}[b] > {f: k for k, f in enumerate(s)}[a] else -1 for s in res["sols"])
        target[(a, b)] = rel
        say(f"  {name[a]:>5} と {name[b]:>5}：中割り{len(inside)}通りで {'／'.join(('上' if r > 0 else '下') for r in sorted(rel))}"
            f"（{name[b]} が {name[a]} の）{'　★一つに決まる' if len(rel) == 1 else '　決まらない'}"
            f"　／参考 ①〜③全体 {len(res['sols'])}通り {'／'.join(('上' if r > 0 else '下') for r in sorted(allrel))}")
    say("  ⚠ 16枚の柱は重なりの無い組にも上下を付けて数えている（§10 の注意）。ここで使うのは S1 で実際に重なる組だけ。")

    # ---------- [C] 目標の上下 → 各結びの終端の巻き ----------
    mo_faces = {p: cut["faces"][p] for p in S1}
    s1bonds = [b for b in cut["bonds"] if b["faceIds"][0] in mo_faces and b["faceIds"][1] in mo_faces]
    say(f"\n[C] 目標の上下から、S1 の結び {len(s1bonds)} 本の終端の相対角（巻き）を決める（運動を使わない）")

    def world_rel(a, b):
        """目標で b が a の上(+1)／下(-1)。重なる組が目標で一つに決まるときだけ"""
        if (a, b) in target:
            r = target[(a, b)]
            return next(iter(r)) if len(r) == 1 else None
        if (b, a) in target:
            r = target[(b, a)]
            return -next(iter(r)) if len(r) == 1 else None
        return None

    def side_in_frame(Ta, Tb, a, b, bond, ang):
        """a の枠で、b を結びの軸まわりに ang 回した姿の、結びの近くの b の点の z の符号"""
        d = MO.p3(bond["cur"][1]) - MO.p3(bond["cur"][0])
        m = (MO.p3(bond["cur"][1]) + MO.p3(bond["cur"][0])) / 2
        cen = np.mean([MO.p3(q) for q in cut["faces"][b]["cur"]], axis=0)
        n = cen - m - d * float((cen - m) @ d) / float(d @ d)
        q = m + 1e-3 * n / np.linalg.norm(n)
        R = MO.rot_about(bond["cur"][0], bond["cur"][1], ang)
        return 1 if MO.xform(R, q)[2] > 0 else -1

    # 回転の向きの取り決めが rel_angle と rot_about で同じか（検算）
    for bd in s1bonds:
        a, b = bd["faceIds"]
        R = MO.rot_about(bd["cur"][0], bd["cur"][1], 0.3)
        if abs(OP.rel_angle({a: np.eye(4), b: R}, bd) - 0.3) > 1e-9:
            bad(f"回転の向きの取り決めが合わない：{bd['bondId']}")
    need = {}
    for bd in s1bonds:
        a, b = bd["faceIds"]
        wr = world_rel(a, b)
        ta = 1 if a in tipset else 0
        # a の枠での b の側 ＝ 世界の上下 × a が鏡で裏返っているか
        frame = (wr * (-1 if a in tipset else 1)) if wr is not None else None
        iscut = bd["bondId"].startswith("cut:")
        if frame is None:
            need[bd["bondId"] + "|" + a] = dict(a=a, b=b, cut=iscut, angle=None)
            say(f"  {name[a]}–{name[b]}{'（⑬）' if iscut else ''}：目標の上下が決まらない")
            continue
        if iscut:
            cand = [a_ for a_ in (math.pi, -math.pi) if side_in_frame(None, None, a, b, bd, a_ * (1 - 1e-6)) == frame]
            s0 = None
        else:
            s0 = 1 if lay[b] > lay[a] else -1       # 出発：同じ所に重なる畳まれた2枚は layer の大きい方が上（a の枠＝世界）
            cand = [0.0] if frame == s0 else [2 * math.pi, -2 * math.pi]
        need[bd["bondId"] + "|" + a] = dict(a=a, b=b, cut=iscut, angle=cand, frame=frame)
        say(f"  {name[a]:>5}–{name[b]:<5}{'（⑬の線）' if iscut else '（層の折り）'}：目標で {name[b]} は {name[a]} の枠で"
            f"{'上' if frame > 0 else '下'}{'' if s0 is None else '（出発 ' + ('上' if s0 > 0 else '下') + '）'}"
            f" → 終端の相対角 {'／'.join(f'{math.degrees(c):+.0f}°' for c in cand)}")

    # ---------- [D] 交互の組の経路（第15段と同じ駆動）を再実行して、着いた姿を面の組ごとに比べる ----------
    say("\n[D] 既に通った交互の組（第15段と同じ駆動）の着き先を、面の組ごとに目標と比べる")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        r1 = SG.run_stage("S1", cut, sub, verts, "")
    for ln in buf.getvalue().splitlines():
        if "組 (" in ln or "閉じる組" in ln:
            say("  （再実行）" + ln.strip())
    mo, halves = r1["mo"], r1["halves"]
    out_runs = {}
    for combo, rr in r1["runs"].items():
        if rr["stop"] or rr["first_pen"]:
            say(f"  組 {combo}：終端に着いていない（比べない）")
            continue
        snaps = rr["snaps"]
        seq = [snaps["flat"], snaps["z90"], snaps["near"], snaps["end"]]
        # 結びの巻き（出発 0 から順に unwrap）
        wind = {}
        for bd in mo.bonds:
            ref = 0.0
            for xx in [np.zeros(len(seq[0]))] + seq:
                ref = OP.unwrap(OP.rel_angle(mo.placements(xx), bd), ref)
            wind[bd["bondId"] + "|" + bd["faceIds"][0]] = ref
        # 終端の直前（z=179.5°）の高さで、重なる組の上下
        Tn = mo.placements(snaps["near"])
        rows = []
        for a, b, it in pairs:
            pt = it.representative_point()
            hz = {}
            for f in (a, b):
                q = np.linalg.inv(T_end[f]) @ np.array([pt.x, pt.y, 0.0, 1.0])
                hz[f] = float(MO.xform(Tn[f], q[:3])[2])
            got = 1 if hz[b] > hz[a] else -1
            tg = target[(a, b)]
            ok = (len(tg) == 1 and got in tg)
            rows.append(dict(a=a, b=b, got=got, target=sorted(tg), ok=ok, gap=abs(hz[b] - hz[a]), pt=[pt.x, pt.y]))
        viol = [r for r in rows if not r["ok"] and len(r["target"]) == 1]
        say(f"  組 {combo}（{'／'.join(('元が戻る' if c > 0 else '先が戻る') + '@' + ('中心線' if sv['center'] else '外形の側') for c, sv in zip(combo, [v for v in verts if v['faces'][0] in sub and v['faces'][1] in sub]))}）")
        for r in rows:
            say(f"    {name[r['a']]:>5} と {name[r['b']]:>5}：着いた {name[r['b']]} は{'上' if r['got'] > 0 else '下'}"
                f"／目標 {'／'.join('上' if t > 0 else '下' for t in r['target'])}"
                f"　{'一致' if r['ok'] else ('**反する**' if len(r['target']) == 1 else '目標が決まらない')}（高さの差 {r['gap']:.1e}）")
        wrows = []
        for k, nd in need.items():
            if nd["angle"] is None:
                continue
            w = wind[k]
            ok = any(abs(w - c) < 1e-3 for c in nd["angle"])
            wrows.append(dict(a=nd["a"], b=nd["b"], cut=nd["cut"], got=w, need=nd["angle"], ok=ok))
            say(f"    結び {name[nd['a']]}–{name[nd['b']]}{'（⑬）' if nd['cut'] else ''}：着いた {math.degrees(w):+.1f}°"
                f"／目標 {'／'.join(f'{math.degrees(c):+.0f}°' for c in nd['angle'])}　{'一致' if ok else '**反する**'}")
        # 置かれ方・表裏は全組で同じか
        Te = mo.placements(snaps["end"])
        gap = max(float(np.linalg.norm(MO.xform(Te[p], q) - MO.xform(T_end[p], q))) for p in S1 for q in cut["faces"][p]["cur"])
        say(f"    置かれ方の目標とのずれ {gap:.1e}（表裏も目標どおり）／面の組で反する {len(viol)}／結びで反する {sum(not w['ok'] for w in wrows)}")
        out_runs[str(list(combo))] = dict(rows=rows, wind=wrows, gap=gap)

    # ---------- [E] 「両方の角で元が戻る」は目標から必須か ----------
    say("\n[E] 目標から、各曲がり角の半分（元・先）の終端の巻きを読む")
    sub_verts = [v for v in verts if v["faces"][0] in sub and v["faces"][1] in sub]
    req = []
    for k, v in enumerate(sub_verts):
        got = {}
        for part in ("base", "tip"):
            fa, fb = f"{v['faces'][0]}#{part}", f"{v['faces'][1]}#{part}"
            nd = next(nd for nd in need.values() if {nd["a"], nd["b"]} == {fa, fb})
            got[part] = nd["angle"]
        base_ret = got["base"] == [0.0]
        tip_ret = got["tip"] == [0.0]
        req.append((base_ret, tip_ret))
        say(f"  {'中心線' if v['center'] else '外形の側'}の角：元の半分 → {'0°（元が戻る）' if base_ret else '±360°'}"
            f"／先の半分 → {'0°（先が戻る）' if tip_ret else '±360°（返る）'}")
    both = all(b and not t for b, t in req)
    say(f"  ⇒ 目標の上下から、終端の巻きは{'**両方の角で「元 0°・先 ±360°」＝駆動の組 (1, 1) の着き先だけ**' if both else '組 (1,1) に限らない'}")
    say("  ⚠ 言えるのは**終端の巻き**まで。途中の出だしの向き（z=2° で元が戻り始めるか）は、終端からは決まらない。")

    # ---------- [E2] 同じ目標で、脚1の7つの角すべて（静的・運動を使わない） ----------
    say("\n[E2] 同じ目標（16枚の柱の中割りの並べ方）で、脚1の7つの角の半分の終端の巻き")
    sol = inside[0]
    posg = {f: k for k, f in enumerate(sol)}
    for v in verts:
        cells = []
        for part in ("base", "tip"):
            fa, fb = f"{v['faces'][0]}#{part}", f"{v['faces'][1]}#{part}"
            la, lb = cut["faces"][fa]["layer"], cut["faces"][fb]["layer"]
            s0 = 1 if lb > la else -1
            wr = 1 if posg[fb] > posg[fa] else -1
            fr = wr * (-1 if part == "tip" else 1)
            cells.append(f"{'元' if part == 'base' else '先'}の半分 {'0°' if fr == s0 else '±360°'}")
        la_, lb_ = faces_all[v["faces"][0]]["layer"], faces_all[v["faces"][1]]["layer"]
        say(f"  層{la_}|{lb_}（{'中心線' if v['center'] else '外形の側'}）：" + "／".join(cells)
            + ("　←S1" if v["faces"][0] in sub and v["faces"][1] in sub else ""))
    say("  ⚠ 16枚の柱の中割りの並べ方は1通り（上の [B]）。胴の16枚を入れた数え方はこの関数では0通りになり、使えていない。")

    # ---------- [F] 残り 0.13 の条件（1次） ----------
    say("\n[F] 1次の検査の条件と、条件を1つずつ外した結果（平らな姿・段1「外側から1つずつ」で開いた所）")
    xflat = r1["stage1"]["外側（包む角）から1つずつ"][1]["snaps"]["flat"]
    n = len(xflat)
    Tf = mo.placements(xflat)
    ref_flat = [OP.unwrap(OP.rel_angle(Tf, h["b"]), h["s"] * math.pi) for h in halves]
    Jc, _ = mo.jac(xflat, 1e-7)
    Jh = np.zeros((len(halves), n))
    for k in range(n):
        xp, xm = xflat.copy(), xflat.copy()
        xp[k] += 1e-7
        xm[k] -= 1e-7
        Tp, Tm = mo.placements(xp), mo.placements(xm)
        Jh[:, k] = [(OP.unwrap(OP.rel_angle(Tp, h["b"]), r) - OP.unwrap(OP.rel_angle(Tm, h["b"]), r)) / 2e-7 for h, r in zip(halves, ref_flat)]
    sv = np.linalg.svd(Jc, compute_uv=False)
    say(f"  木の変数 {n}（層の折りの半分 {len(halves)}・⑬の線 {len(P.cut_vars(mo))}）・閉じの式 {Jc.shape[0]}・閉じの行列の特異値 {', '.join(f'{x:.2e}' for x in sv)}")
    say("  固定した条件：①平らな姿＝段1で層の折り2本を外側の角から1つずつ平らまで開いた姿（⑬の線は 0°）"
        "／②根＝S1 の元の板の1枚（" + name[mo.anchor] + "）・胴とほかの層は無し"
        "／③駆動＝各半分の速さを z の速さ1に対して 開く向き×(−符号×cosθ)、θ は**鋭角の方**（中心線 75.96°・外形の側 87.21°＝どちらも cos>0）"
        "・**2つの角で同じ z**／④⑬の線3本の速さは未知（閉じから解く）")

    def rank_test(Aa, bb):
        dx = np.linalg.lstsq(Aa, bb, rcond=None)[0]
        return float(np.linalg.norm(Aa @ dx - bb))

    V = len(sub_verts)
    U, sg_, Vt = np.linalg.svd(Jc)
    Nn = Vt[int(np.sum(sg_ > 1e-6)):].T            # 閉じの1次の核（特異値 1e-6 以下は 0 とみなす＝差分の丸め）
    say(f"  閉じの1次の核 {Nn.shape[1]}次元（特異値 >1e-6 を数えた）")
    tab = {}
    for combo in itertools.product((1, -1), repeat=V):
        sg = lambda h: combo[h["vi"]] * (1 if h["part"] == "base" else -1)
        vel = np.array([h["s"] * (-sg(h)) * math.cos(math.radians(h["theta"])) for h in halves])
        A_ = np.vstack([Jc, Jh])
        r_a = rank_test(A_, np.concatenate([np.zeros(len(Jc)), vel]))
        H = Jh @ Nn
        # (b) 「2つの角で同じ z」を外す：角ごとの倍率 c_k ≥ 1（向きは組のまま・大きさの比は角の中で cosθ のまま）
        nv = Nn.shape[1]
        Aeq = np.hstack([H, np.zeros((len(halves), V))])
        for j, h in enumerate(halves):
            Aeq[j, nv + h["vi"]] = -vel[j]
        lpb = linprog(np.zeros(nv + V), A_eq=Aeq, b_eq=np.zeros(len(halves)),
                      bounds=[(None, None)] * nv + [(1, None)] * V, method="highs")
        # (c) 大きさも外して向きだけ：各半分の速さが組の向きへ ≥1（同次なので一般）
        lpc = linprog(np.zeros(nv), A_ub=-(np.sign(vel)[:, None] * H), b_ub=-np.ones(len(halves)),
                      bounds=[(None, None)] * nv, method="highs")
        tab[combo] = (r_a, lpb.status == 0, lpc.status == 0)
        say(f"  組 {combo}：(a) 条件①〜④そのまま 残り {r_a:.2e}／(b) ③の「同じ z」だけ外す（角ごとの倍率 ≥1） {'解あり' if lpb.status == 0 else '解なし'}"
            f"／(c) ③の大きさも外し向きだけ {'解あり' if lpc.status == 0 else '解なし'}")
    say("  ⚠ 1次は平らな姿（特異な分岐点）での速さの話。1次で閉じても2次以上で閉じない・1次で閉じなくても別の出だし（2次で動き出す）はあり得る。")
    say("  ⚠ 残りの大きさは尺度（閉じの式と角の式の重み）に依存する。0 か否かだけを読む。")

    # ---------- [G] 目標の巻き（層の折り 0°・⑬の線 +180°）を持つ最も簡単な動き＝S1 の先3枚をまとめて⑬の線で回す ----------
    say("\n[G] 比較：S1 の先3枚をひとかたまりで⑬の線のまわりに回す（層の折りは動かさない）")
    fcs = {p: cut["faces"][p] for p in S1}
    adj = set()
    for b in s1bonds:
        adj.add(tuple(b["faceIds"])); adj.add(tuple(reversed(b["faceIds"])))
    I4 = np.eye(4)
    blk_out = {}
    for sgn in (1, -1):
        worst_pen, worst_bond, pen_at = 0.0, 0.0, None
        for k in range(1, 360):                   # 180° ちょうどは平らに着地して「同じ平面で重なる」と出るので 179.5° まで
            al = sgn * math.pi * k / 360
            R = MO.rot_about((A[0], A[1], 0), (B[0], B[1], 0), al)
            T = {p: (R if p in tipset else I4) for p in S1}
            worst_bond = max(worst_bond, OP.all_bond_error(mo, T))
            pen, who = OP.penetration(mo, T, fcs, adj, lambda a, b: I4)
            if pen > 0 and pen_at is None:
                pen_at = (math.degrees(al), OP.short(who[0]), OP.short(who[1]), who[2], pen)
        Rn = MO.rot_about((A[0], A[1], 0), (B[0], B[1], 0), sgn * math.pi * 359 / 360)
        Tn = {p: (Rn if p in tipset else I4) for p in S1}
        cuts_w = {name[b["faceIds"][0]] + "–" + name[b["faceIds"][1]]: math.degrees(OP.rel_angle(Tn, b)) for b in s1bonds if b["bondId"].startswith("cut:")}
        nviol = 0
        for a, b, it in pairs:
            pt = it.representative_point()
            hz = {f: float(MO.xform(Tn[f], (np.linalg.inv(T_end[f]) @ np.array([pt.x, pt.y, 0.0, 1.0]))[:3])[2]) for f in (a, b)}
            if abs(hz[b] - hz[a]) > 1e-9:
                got = 1 if hz[b] > hz[a] else -1
            else:                                   # 同じかたまりの中＝同じ平面：元は出発のまま・先は鏡で世界の上下が逆
                got = (1 if lay[b] > lay[a] else -1) * (-1 if a in tipset else 1)
            nviol += 0 if got in target[(a, b)] else 1
            if got not in target[(a, b)]:
                say(f"    反する：{name[a]} と {name[b]}（{name[b]} が{'上' if got > 0 else '下'}・目標 {'上' if next(iter(target[(a, b)])) > 0 else '下'}）")
        say(f"  向き {'+' if sgn > 0 else '−'}：全結び {worst_bond:.1e}・すり抜け {'なし' if pen_at is None else pen_at}"
            f"／⑬の線の相対角（179.5°）{', '.join(f'{k} {v:+.1f}°' for k, v in cuts_w.items())}／目標の上下に反する組 {nviol}／{len(pairs)}")
        blk_out[sgn] = dict(pen=pen_at, viol=nviol)
    say("  ⚠ S1 は胴とほかの層（とくに脚の背 層-2|層-1）を省いた模型。ここで通ることは鶴の⑬が通ることではない。")

    json.dump(dict(names=name, faces={p: face_tab[p] for p in S1}, tipset=sorted(tipset),
                   target={f"{a}|{b}": sorted(r) for (a, b), r in target.items()},
                   need={k: dict(a=v["a"], b=v["b"], cut=v["cut"], angle=v["angle"]) for k, v in need.items()},
                   runs=out_runs, cutseg=[list(A), list(B)], lin={str(list(c)): list(v) for c, v in tab.items()}),
              open(os.path.join(HERE, "crane13_s1_target.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    import traceback
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
