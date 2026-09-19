# -*- coding: utf-8 -*-
"""つる⑬：接触の「相手がいる側」と背の「開く向き」を、保存原本の上下（stackAt）と面の向きから決める方法の検算（2026-09-17）

本人指示：実物の観察ではなく、**保存原本と面の向き**から接触条件を復元する。まず、その方法が
  普通の2枚重ね・それを裏返した例・回転させた例で**同じ物理的な判定**になることを確かめる。

決め方（layer の番号どうしを離れた場所で比べない。**実際に重なる点**で保存原本の stackAt を読む）
  ・重なる2枚 a・b：点 p で stackAt（上から順）を読み、b が a より上なら +1。
    σ(a→b) ＝（b が上なら +1／下なら −1）×（a が表向きなら +1／裏向きなら −1）
    ＝「**b は a の表側にいる（+1）／裏側にいる（−1）**」。面の素材に付いた性質なので、紙ぜんぶを裏返しても回しても変わらないはず。
    同じ層番号で上下が決まらない点（stackAt の同じ層）は「決まらない」とする。
  ・3D で面 a を R_a で動かしたとき、相手のいる向き（世界）＝ σ(a→b)・R_a・(a の表の法線)。表の法線（出発の平らな座標）＝ ±ẑ（裏向きなら −ẑ）。
    ＝ **接している間ずっと、この向きを a に貼り付けて持ち運ぶ**（数値上同じ位置でも、上下の履歴として保持する）。
  ・背（結び）a|c：c が a のどちら側に畳まれているか σ(a→c)（結びの近くで両方を含む点の stackAt）と、
    素材の結びの向き（a の置かれ方で写した軸 d）から、**開く＝c が σ の側へ離れる回転の向き** s ∈ {+1,−1}（軸 d まわり右ねじ）。
    素材の向きで表した開く向き s_mat ＝ s。⚠最初は s × det(xf_a) としたが誤り（[T4] で裏返しの例が食い違った）：
    原本の裏返しは、いまの位置の座標で面内の1軸と表の法線を**同時に**反転する＝3Dでは 180° 回転（向きを保つ）なので、
    軸 d まわりの右ねじの向きは素材の（結びの向き・表の法線）に対して変わらない。

検算（crane13_stack_tests.json＝`node export_crane13_stacks.js tests` が engine の再生で作る小さな記録）
  [T1] 各例で、同じ組の上下がどの点でも食い違わない
  [T2] σ（重なる組ごと）が、2枚（谷）とその左右裏返し・180°回転で同じ／4枚でも同じ
  [T3] 2枚（山）では谷と逆
  [T4] 背の開く向き s_mat が、裏返し・回転で同じ。谷では「上にある面が上へ」開く
  [T5] 物理の同一性：2枚（谷）を3Dで y 軸まわりに 180° 回した姿（＝左右に裏返した紙）の「相手のいる向き（世界）」が、
       原本で左右に裏返した例の向きと一致する

使い方： python check_crane13_sides.py
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import json
import math
import os
import sys
import traceback

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def det(m):
    return m[0] * m[3] - m[1] * m[2]


def front(face):
    """出発の平らな座標での表の法線の z（表向き +1／裏向き −1）"""
    return 1.0 if det(face["xf"]) > 0 else -1.0


def sigma_from_stack(stack, a, b, faces):
    """点の stackAt（上から）から σ(a→b)。決まらなければ None"""
    ids = [s["faceId"] for s in stack]
    if a not in ids or b not in ids:
        return None
    la = next(s["layer"] for s in stack if s["faceId"] == a)
    lb = next(s["layer"] for s in stack if s["faceId"] == b)
    if la == lb:
        return None
    above = 1.0 if ids.index(b) < ids.index(a) else -1.0
    return above * front(faces[a])


def pair_sigmas(case):
    faces = {f["faceId"]: f for f in case["faces"]}
    out = {}
    for smp in case["samples"]:
        st = smp["stack"]
        for i in range(len(st)):
            for j in range(len(st)):
                if i == j:
                    continue
                a, b = st[i]["faceId"], st[j]["faceId"]
                s = sigma_from_stack(st, a, b, faces)
                out.setdefault((a, b), []).append(s)
    return faces, out


def apply(m, p):
    return (m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5])


def open_dir(faces, bond, sig):
    """背 a|c の開く向き s（いまの位置の軸まわり右ねじ）。c を σ の側へ離す向き"""
    a, c = bond["faceIds"]
    p0 = np.array([*apply(faces[a]["xf"], bond["seg"][0]), 0.0])
    p1 = np.array([*apply(faces[a]["xf"], bond["seg"][1]), 0.0])
    d = (p1 - p0) / np.linalg.norm(p1 - p0)
    cen = np.array([*np.mean(faces[c]["poly"], axis=0), 0.0])
    v = np.cross(d, cen - p0)                       # +ε 回したときの c の重心の動く向き
    n_side = sig * front(faces[a]) * np.array([0, 0, 1.0])
    return 1.0 if float(v @ n_side) > 0 else -1.0


def main():
    T = json.load(open(os.path.join(HERE, "crane13_stack_tests.json"), encoding="utf-8"))
    res = {}
    say("[T1] 各例で、同じ組の上下がどの点でも食い違わないか（stackAt・格子 41×41）")
    for name, case in T.items():
        faces, ps = pair_sigmas(case)
        sig, bad_pairs, tie = {}, [], []
        for k, v in ps.items():
            vals = {x for x in v if x is not None}
            if None in v:
                tie.append(k)
            if len(vals) > 1:
                bad_pairs.append(k)
            elif vals:
                sig[k] = vals.pop()
        res[name] = (faces, sig, case["bonds"])
        say(f"  {name}：重なる組 {len(ps)}（向きつき）・食い違い {len(bad_pairs)}・同じ層で決まらない {len(tie)}")
        if bad_pairs:
            bad(f"{name}：点によって上下が食い違う組 {bad_pairs[:3]}")

    say("\n[T2][T3] σ（b は a の表側 +1／裏側 −1）の比較（面ID で対応）")
    groups = [("A 2枚（谷）", ["A 2枚（谷）→左右に裏返す", "A 2枚（谷）→左右→上下に裏返す＝180°回転"]),
              ("B 4枚（谷→谷）", ["B 4枚→左右に裏返す", "B 4枚→左右→上下＝180°回転"])]
    for ref, others in groups:
        _, s0, _ = res[ref]
        say(f"  {ref}：" + "・".join(f"{a.split('/')[-1]}→{b.split('/')[-1]} {'+' if v > 0 else '−'}" for (a, b), v in sorted(s0.items())))
        for o in others:
            _, so, _ = res[o]
            same = s0 == so
            say(f"    {o}：{'同じ' if same else '**違う**'}")
            if not same:
                bad(f"{o}：σ が {ref} と違う")
    _, sA, _ = res["A 2枚（谷）"]
    for o in ("AM 2枚（山）", "AM 2枚（山）→上下に裏返す"):
        _, so, _ = res[o]
        opp = set(so) == set(sA) and all(so[k] == -sA[k] for k in sA)
        say(f"  {o}：谷と**{'逆' if opp else '逆でない'}**（" + "・".join(f"{'+' if v > 0 else '−'}" for _, v in sorted(so.items())) + "）")
        if not opp:
            bad(f"{o}：山なのに谷と逆にならない")
    say(f"  谷の2枚：σ ＝ {sorted(set(sA.values()))}（両方の面から見て相手は表側＝表どうしが向き合う）")

    say("\n[T4] 背の開く向き（素材の向きで表した s_mat）")
    for ref, others in [("A 2枚（谷）", ["A 2枚（谷）→左右に裏返す", "A 2枚（谷）→左右→上下に裏返す＝180°回転"]),
                        ("AM 2枚（山）", ["AM 2枚（山）→上下に裏返す"]),
                        ("B 4枚（谷→谷）", ["B 4枚→左右に裏返す", "B 4枚→左右→上下＝180°回転"])]:
        def mats(name):
            faces, sig, bonds = res[name]
            out = {}
            for b in bonds:
                if b["kind"] != "hinge":
                    continue
                a, c = b["faceIds"]
                if (a, c) not in sig:
                    out[(a, c)] = None
                    continue
                s = open_dir(faces, b, sig[(a, c)])
                out[(a, c)] = s
            return out
        m0 = mats(ref)
        say(f"  {ref}：" + "・".join(f"{a.split('/')[-1]}|{c.split('/')[-1]} {'+' if v and v > 0 else '−' if v else '?'}" for (a, c), v in sorted(m0.items())))
        for o in others:
            mo_ = mats(o)
            say(f"    {o}：{'同じ' if mo_ == m0 else '**違う**'}")
            if mo_ != m0:
                bad(f"{o}：開く向きが {ref} と違う")
    # 谷の2枚：上の面が上へ開くか
    faces, sig, bonds = res["A 2枚（谷）"]
    b = next(b for b in bonds if b["kind"] == "hinge")
    a, c = b["faceIds"]
    ids_top = max(faces.values(), key=lambda f: f["layer"])["faceId"]
    s = open_dir(faces, b, sig[(a, c)])
    p0 = np.array([*apply(faces[a]["xf"], b["seg"][0]), 0.0])
    p1 = np.array([*apply(faces[a]["xf"], b["seg"][1]), 0.0])
    d = (p1 - p0) / np.linalg.norm(p1 - p0)
    mover = c
    vz = float(np.cross(d, np.array([*np.mean(faces[mover]["poly"], axis=0), 0.0]) - p0)[2]) * s
    say(f"  谷の2枚で、開く回転で c（{mover.split('/')[-1]}・{'上' if mover == ids_top else '下'}の面）の重心が動く z の向き：{'+（上へ）' if vz > 0 else '−（下へ）'}")
    if (mover == ids_top) != (vz > 0):
        bad("谷の2枚で、上の面が上へ開かない")

    say("\n[T5] 物理の同一性：谷の2枚を 3D で y 軸まわり 180° 回した姿 と 原本で左右に裏返した例")
    fA, sAA, _ = res["A 2枚（谷）"]
    fV, sV, _ = res["A 2枚（谷）→左右に裏返す"]
    Ry = np.diag([-1.0, 1.0, -1.0])
    ok = True
    for (a, b_), v in sAA.items():
        wA = v * (Ry @ np.array([0, 0, front(fA[a])]))
        wV = sV[(a, b_)] * np.array([0, 0, front(fV[a])])
        same = np.allclose(wA, wV)
        ok &= same
        say(f"  {a.split('/')[-1]}→{b_.split('/')[-1]}：回した姿 {wA.tolist()}／裏返した原本 {wV.tolist()} → {'一致' if same else '**不一致**'}")
    if not ok:
        bad("回した姿と裏返した原本で、相手のいる向きが一致しない")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
