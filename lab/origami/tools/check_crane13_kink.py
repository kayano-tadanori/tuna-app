# -*- coding: utf-8 -*-
"""つる⑬：開くと「へ」の字に見える折線は、原紙に残る折線か／開いた姿の見え方か（2026-09-17）

本人の観察：一枚の紙で首だけを折った模型を、折ってから開くと、⑬の折線が「へ」の字に見えた。
このファイルは**データだけで**次を区別する（本体・UI・保存形式は無変更）。

  [A] ⑬の線を素材座標（原紙を広げた姿）でつなぐ：ORIPA の16本・モデルの切り口の8本が同じか。
      つないだ折れ線の**曲がり角**はどこか（既存の折線の上か／面の中か）。
  [B] 各曲がり角で、両側の線分が**その折線をはさんだ鏡**になっているか＝
      「折った状態で1本の直線、広げると曲がる」と同じことか。角の周りの線の本数と Kawasaki。
  [C] 1つの曲がり角で、既存の折線の開き δ を変えたとき、2本の線分が 3D でなす角
      （δ=0 の折った状態で重なる／開くと「へ」／広げきると素材の角）。
  ⚠ ORIPA は**線の位置だけ**に使う（山谷・層・非貫通の根拠にはしない）[[feedback_origami_evidence]]。

使い方： python check_crane13_kink.py
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import json
import math
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name, fn):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, fn))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


M = _load("crane13_model", "check_crane13_model.py")
ng = []
TOL = 1e-9


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def inv_ap(m, p):
    """置かれ方 xf（等長）の逆：いまの位置 → 素材"""
    x, y = p[0] - m[4], p[1] - m[5]
    return (m[0] * x + m[2] * y, m[1] * x + m[3] * y)


def unit(v):
    L = math.hypot(*v)
    return (v[0] / L, v[1] / L)


def ang_deg(u, v):
    return math.degrees(math.acos(max(-1.0, min(1.0, M.dot(unit(u), unit(v))))))


def same_seg(s, t, tol=1e-9):
    return (M.dist(s[0], t[0]) < tol and M.dist(s[1], t[1]) < tol) or \
           (M.dist(s[0], t[1]) < tol and M.dist(s[1], t[0]) < tol)


def main():
    D = M.load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    CL = json.load(open(os.path.join(HERE, "crane13_cutline.json"), encoding="utf-8"))
    lm = D["landmarks"]
    legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
    LL = M.dist(legTip, petalTip)
    u = ((petalTip[0] - legTip[0]) / LL, (petalTip[1] - legTip[1]) / LL)
    nrm = (-u[1], u[0])
    neck = [v["neck"] for v in lm["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces, bonds, legTip, u, nrm, 0.3 * neck)
    say(f"紙：{D['meta']['source']} 指紋 {D['meta']['stateFingerprint'][:12]}")

    out = {}
    for rec in CL["legs"]:
        legno = rec["leg"]
        leg = legs[legno - 1]
        say(f"\n==== 脚{legno}（8面） ====")
        A, B = tuple(rec["curLine"]["a"]), tuple(rec["curLine"]["b"])

        # ---------- [A] 素材座標でつなぐ ----------
        say("[A] ⑬の線を素材座標（原紙を広げた姿）に戻す")
        worst = 0.0
        segs = []
        for r in rec["lines"]:
            f = faces[r["faceId"]]
            chord = M.line_chord(f["cur"], A, B)             # モデルの切り口（いまの位置）
            back = [inv_ap(f["xf"], p) for p in chord]        # → 素材
            om = [tuple(p) for p in r["mat"]]                 # ORIPA の元の端点（素材）
            e = min(max(M.dist(back[0], om[0]), M.dist(back[1], om[1])),
                    max(M.dist(back[0], om[1]), M.dist(back[1], om[0])))
            worst = max(worst, e)
            segs.append(dict(face=r["faceId"], layer=r["layer"], mat=om, opx=r["opxIndex"]))
        say(f"  モデルの切り口（1本の直線で8面を切る）を素材へ戻したものと、ORIPA の線：ずれ（最大）{worst:.1e}")
        if worst > 1e-9:
            bad(f"脚{legno}：モデルの切り口と ORIPA の線が素材座標で合わない")
        per_face = {}
        for s in segs:
            per_face.setdefault(s["face"], []).append(s)
        if any(len(v) != 1 for v in per_face.values()) or set(per_face) != set(leg):
            bad(f"脚{legno}：1面に1本ずつになっていない")
        say(f"  1面に1本ずつ：{all(len(v) == 1 for v in per_face.values())}"
            f"（面の中で曲がる線は無い＝**曲がり角は面のふちの上にしかない**）")

        # つないで折れ線にする
        pts = {}
        for i, s in enumerate(segs):
            for p in s["mat"]:
                key = next((k for k in pts if M.dist(k, p) < TOL), p)
                pts.setdefault(key, []).append(i)
        ends = [p for p, v in pts.items() if len(v) == 1]
        joints = [p for p, v in pts.items() if len(v) == 2]
        if len(ends) != 2 or len(joints) != len(segs) - 1 or any(len(v) > 2 for v in pts.values()):
            bad(f"脚{legno}：8本が1本の折れ線につながらない")
        on_edge = all(abs(abs(p[0]) - 1) < TOL or abs(abs(p[1]) - 1) < TOL for p in ends)
        say(f"  8本は1本の折れ線につながる：端 {len(ends)}（原紙のふちの上＝{on_edge}）・曲がり角 {len(joints)}")
        # 端から順に並べる
        order, cur, used = [ends[0]], ends[0], set()
        while True:
            nxt = [i for i in next(v for k, v in pts.items() if M.dist(k, cur) < TOL) if i not in used]
            if not nxt:
                break
            i = nxt[0]
            used.add(i)
            s = segs[i]["mat"]
            cur = s[1] if M.dist(s[0], cur) < TOL else s[0]
            order.append(cur)
        say("  折れ線（素材）：" + " → ".join(M.r3(p) for p in order))

        # ---------- [B] 曲がり角ごとに ----------
        say("[B] 曲がり角ごと：既存の折線の上か／両側は鏡か／角のまわりの線（Kawasaki）")
        rows = []
        for j, P in enumerate(order[1:-1], 1):
            prev, nxt = order[j - 1], order[j + 1]
            d1, d2 = unit(M.sub(prev, P)), unit(M.sub(nxt, P))
            i1 = next(i for i, s in enumerate(segs) if any(M.dist(q, P) < TOL for q in s["mat"])
                      and any(M.dist(q, prev) < TOL for q in s["mat"]))
            i2 = next(i for i, s in enumerate(segs) if any(M.dist(q, P) < TOL for q in s["mat"])
                      and any(M.dist(q, nxt) < TOL for q in s["mat"]))
            fa, fb = segs[i1]["face"], segs[i2]["face"]
            # 角を通る既存の結び（素材座標の線分）
            through = [b for b in bonds if M.point_on_seg(P, b["seg"], 1e-9)]
            between = [b for b in through if set(b["faceIds"]) == {fa, fb}]
            flats = [c for c in D["creases"] if M.point_on_seg(P, [tuple(q) for q in c["seg"]], 1e-9)]
            if len(between) != 1:
                bad(f"脚{legno} 角{j}：隣り合う2面をつなぐ結びの上にない（{len(between)}本）")
                continue
            b = between[0]
            cd = unit(M.sub(b["seg"][1], b["seg"][0]))
            # 鏡：d1 を結びの直線で映すと d2 か
            proj = M.dot(d1, cd)
            refl = (2 * proj * cd[0] - d1[0], 2 * proj * cd[1] - d1[1])
            mir = M.dist(refl, d2)
            # 角のまわりの線（結び・記録された折り目・⑬の2本）の向き
            rays = [d1, d2]
            for bb in through:
                for q in bb["seg"]:
                    if M.dist(q, P) > TOL:
                        rays.append(unit(M.sub(q, P)))
            for c in flats:
                for q in c["seg"]:
                    if M.dist(tuple(q), P) > TOL:
                        rays.append(unit(M.sub(tuple(q), P)))
            uniq = []
            for r in rays:
                if all(M.dist(r, v) > 1e-7 for v in uniq):
                    uniq.append(r)
            angs = sorted(math.atan2(r[1], r[0]) for r in uniq)
            sect = [(angs[(k + 1) % len(angs)] - angs[k]) % (2 * math.pi) for k in range(len(angs))]
            kaw = abs(sum(sect[0::2]) - math.pi) if len(sect) % 2 == 0 else float("nan")
            # 結びの直線のうち「先の側」（2本の⑬の線分が向いている側）となす角 θ
            if M.dot(d1, cd) < 0:
                cd = (-cd[0], -cd[1])
            th = ang_deg(d1, cd)
            on_center = abs(M.cross(M.sub(b["cur"][0], legTip), u)) < 1e-9 and \
                abs(M.cross(M.sub(b["cur"][1], legTip), u)) < 1e-9
            rows.append(dict(j=j, P=P, kind=b["kind"], mir=mir, deg=len(uniq), kaw=kaw, theta=th,
                             where="中心線" if on_center else "外形の側", la=faces[fa]["layer"], lb=faces[fb]["layer"]))
            say(f"  角{j} {M.r3(P)}：面 層{faces[fa]['layer']}|層{faces[fb]['layer']} をつなぐ {b['kind']}"
                f"（折った姿で{rows[-1]['where']}）／両側は鏡か：ずれ {mir:.1e}"
                f"／まわりの線 {len(uniq)}本／Kawasaki のずれ {kaw:.1e}"
                f"／線分と折線（先の側）のなす角 θ={th:.4f}°（曲がりの開き 2θ={2*th:.4f}°）")
            if mir > 1e-9:
                bad(f"脚{legno} 角{j}：両側の線分が既存の折線をはさんだ鏡になっていない＝原紙に残る独自の曲がり")
            if len(uniq) != 4:
                bad(f"脚{legno} 角{j}：角のまわりの線が4本でない（{len(uniq)}本）＝ほかの折線が来ている")
            if not (kaw < 1e-9):
                bad(f"脚{legno} 角{j}：Kawasaki が成り立たない")
        kinds = sorted({(r["where"], round(r["theta"], 6)) for r in rows})
        say(f"  → 曲がり角 {len(rows)}個はぜんぶ**既存の折線の上**で、両側は**その折線の鏡**。角のまわりはちょうど4本（既存の折線2＋⑬2）。")
        say(f"    角の種類：" + "／".join(f"{w} θ={t:.4f}°（{sum(1 for r in rows if r['where']==w)}個）" for w, t in kinds))
        out[legno] = rows

    # ---------- [C] 見え方 ----------
    say("\n[C] 1つの曲がり角で、既存の折線の開きを変えたときの「見え方」")
    say("  既存の折線（z 軸上に置かない：x 軸）をはさんで、面 a に線分 (cosθ, sinθ)、面 b に鏡の (cosθ, −sinθ)。")
    say("  面 b を折線まわりに回す：δ＝折線の開き（0＝折った状態で2枚が重なる／180＝広げきった原紙）")
    th = next(r["theta"] for r in out[1] if r["where"] == "中心線")
    t = math.radians(th)
    for dlt in (0, 10, 30, 60, 90, 120, 150, 180):
        # 面 b は、折った状態（δ=0）で面 a に重なる。δ だけ開く＝x 軸まわりに (180−δ) だけ戻す前の姿
        g = math.radians(180 - dlt)
        va = (math.cos(t), math.sin(t), 0.0)
        # 素材で (cosθ, −sinθ, 0) を x 軸まわりに g 回す
        vb = (math.cos(t), -math.sin(t) * math.cos(g), -math.sin(t) * math.sin(g))
        c = sum(p * q for p, q in zip(va, vb))
        say(f"    δ={dlt:3d}°：2本の線分が曲がり角でなす角 {math.degrees(math.acos(max(-1, min(1, c)))):7.3f}°")
    say(f"  → δ=0（折った状態）では**重なって1本の直線**、開くと曲がり角をはさんで「へ」、広げきると素材の曲がり 2θ={2*th:.3f}°。")

    say("\n[答え] 「へ」の字は**原紙まで広げても残る折線**（素材で曲がっている）であり、同時に**折った状態では1本の直線**。")
    say("  両者は矛盾しない：曲がり角はすべて既存の折線の上にあり、両側がその折線の鏡なので、折線で折り重ねると1本に重なる。")
    say("  ⇒ いまの入力「8層を1本の直線で切る」は、この「へ」の字の折線と**同じもの**（素材で ORIPA と一致）。")
    say("  🚨 これは**線の形**が合っているというだけ。その線で剛体に動けるか・鶴全体で成り立つかは別（単独模型→鶴の順に確かめる）。")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
