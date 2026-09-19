# -*- coding: utf-8 -*-
"""つる⑬：**ORIPA の元の端点から**中割り線を取り出して固定する（2026-09-16）

これまでの計算は「脚の先端から 0.5・中心線と 60°」という**代表値の仮置き**で線を作っていた。
ここでは**丸めた角度（75.9°など）から線を作らず**、ORIPA の展開図の**元の端点をそのまま**
素材座標へ写して使う。出どころ・座標変換・対応する面を `crane13_cutline.json` に書き出す。

🚨 使い方の限界（[[feedback_origami_evidence]]）：ORIPA の展開図は数学的な折線で、あれでは実際には折れない。
   ここで使うのは**線の位置だけ**。山谷の向き・層の上下・途中の非貫通の根拠には**しない**。

座標変換（この順で、丸めを一度も挟まない）
  ①.opx の生の端点 (x0,y0)-(x1,y1)
  ②原紙 [-1,1]² へ正規化：p → ((x-cx)/s, (y-cy)/s)   （cx,cy,s は外形から）
  ③原紙の対称 SYM[k] を掛ける（k＝モデルといちばん重なる向き。総当りで選ぶ）
  ＝ここまでが**素材座標**。④その線を含む面の置かれ方 xf を掛けて「いまの位置」。

⑬の線の選び方（値で拾わず、構造で拾う）
  ・モデルに無い線のうち、脚の8面を1面につき1本ずつ横切るまとまり
  ・そのまとまりが**2本の脚それぞれにあり**、中心線をはさんで**互いの鏡**で、
    中心線上の**同じ1点**で出会う（＝⑬は脚2本を同時に折る工程）。
  ・脚2にだけある同種のまとまり（先端寄り）は⑭（頭）なので採らない。

使い方： python export_crane13_cutline.py  → crane13_cutline.json
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import hashlib
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
O = _load("crane13_oripa", "check_crane13_oripa.py")

OPX = "crane_final_mitani.opx"
ng = []


def say(*a):
    print(" ".join(str(x) for x in a))


def bad(m):
    ng.append(m)
    say("  NG:", m)


def mirror_across(p, a, u):
    """点 p を、点 a を通り向き u（単位）の直線で鏡に映す"""
    d = M.sub(p, a)
    t = M.dot(d, u)
    q = (a[0] + u[0] * t, a[1] + u[1] * t)
    return (2 * q[0] - p[0], 2 * q[1] - p[1])


def fit_line(pts):
    """点の集まりにいちばん合う直線（重心と主方向）と、そこからのいちばん遠いずれ"""
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - cx) ** 2 for p in pts)
    sxy = sum((p[0] - cx) * (p[1] - cy) for p in pts)
    syy = sum((p[1] - cy) ** 2 for p in pts)
    # 2x2 対称行列の大きい方の固有ベクトル
    tr, dt = sxx + syy, sxx * syy - sxy * sxy
    lam = tr / 2 + math.sqrt(max(0.0, tr * tr / 4 - dt))
    vx, vy = (sxy, lam - sxx) if abs(sxy) > 1e-18 else (1.0, 0.0)
    L = math.hypot(vx, vy)
    if L < 1e-18:
        vx, vy, L = 1.0, 0.0, 1.0
    u = (vx / L, vy / L)
    worst = max(abs(M.cross(M.sub(p, (cx, cy)), u)) for p in pts)
    return (cx, cy), u, worst


def main():
    D = M.load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    lm = D["landmarks"]
    legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
    LL = M.dist(legTip, petalTip)
    u_cent = ((petalTip[0] - legTip[0]) / LL, (petalTip[1] - legTip[1]) / LL)
    nrm = (-u_cent[1], u_cent[0])
    neck = [v["neck"] for v in lm["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces, bonds, legTip, u_cent, nrm, 0.3 * neck)
    say("材料：", D["meta"]["source"], "指紋", D["meta"]["stateFingerprint"][:12],
        "／面", len(faces), "結び", len(bonds))
    say("  脚の先端", M.r3(legTip), "／中心線の向き", M.r3(u_cent),
        "／脚の面数", "・".join(str(len(c)) for c in legs))

    # ---------- ① 生の端点を読む ----------
    path = os.path.join(HERE, "oripa_sample", OPX)
    sha = hashlib.sha1(open(path, "rb").read()).hexdigest()
    raw = O.load_opx(path)
    say(f"\n[1] 出どころ：oripa_sample/{OPX}（sha1 {sha[:12]}…）／線 {len(raw)}本")

    # ---------- ② 正規化 ----------
    lines, (cx, cy, s) = O.norm_lines(raw)
    say(f"[2] 原紙 [-1,1]² への正規化：中心 ({cx:g},{cy:g}) 半径 {s:g}（外形から）")

    # ---------- ③ 原紙の対称（モデルといちばん重なる向きを総当りで選ぶ） ----------
    model_segs = [[tuple(p) for p in b["seg"]] for b in bonds]
    model_segs += [[tuple(p) for p in c["seg"]] for c in D["creases"]]
    scores = []
    for si, S in enumerate(O.SYM):
        tot = sum(O.seg_cover([O.apply_sym(L["a"], S), O.apply_sym(L["b"], S)], model_segs)
                  for L in lines if L["type"] != 1)
        scores.append(tot)
    top = max(scores)
    tied = [k for k in range(len(O.SYM)) if top - scores[k] < 1e-9]
    si = tied[0]
    S = O.SYM[si]
    say(f"[3] 原紙の対称：重なりの合計がいちばん大きいのは {tied}（{top:.1f}）"
        f"／ほかは {max(v for k, v in enumerate(scores) if k not in tied):.1f}")
    say(f"    ⚠ **向きは1つに決まらない**（鶴の展開図は対角に対称・首と尾の入れかえも同じ形）。"
        f"そこで採るのは番号 {si}（{S}）だが、⑬の線が向きの選び方で変わらないことを [6b] で確かめる。")

    # ---------- モデルに無い線を拾い、面へ割り当て、「いまの位置」へ ----------
    def missing_lines(S_):
        out_ = []
        for idx, L in enumerate(lines):
            if L["type"] == 1:
                continue
            seg = [O.apply_sym(L["a"], S_), O.apply_sym(L["b"], S_)]
            if O.seg_cover(seg, model_segs) > 0.02:
                continue
            m = dict(idx=idx, type=L["type"], raw=[raw[idx]["a"], raw[idx]["b"]], mat=seg)
            mid = ((seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2)
            own = [fid for fid, f in faces.items() if O.in_poly(mid, f["mat"])]
            m["faceId"] = own[0] if len(own) == 1 else None
            if m["faceId"]:
                f = faces[m["faceId"]]
                m["cur"] = [M.ap(f["xf"], p) for p in m["mat"]]   # ④ 面の置かれ方
                m["layer"] = f["layer"]
            out_.append(m)
        return out_

    def leg_groups(ms_):
        """脚の8面を1面につき1本ずつ横切り、「いまの位置」で同じ直線に乗るまとまり"""
        gr = {}
        for m in ms_:
            if m["faceId"]:
                gr.setdefault(M.line_of(m["cur"]), []).append(m)
        out_ = []
        for key, g in gr.items():
            for i, c in enumerate(legs):
                if {m["faceId"] for m in g} == set(c) and len(g) == len(c):
                    out_.append((i, key, g))
        return gr, out_

    def step13_pair(cand_):
        """2本の脚それぞれにあり、中心線をはさんで互いの鏡になっている組＝⑬"""
        for a_ in cand_:
            for b_ in cand_:
                if a_[0] == b_[0]:
                    continue
                pb = [p for m in b_[2] for p in m["cur"]]
                ma = [mirror_across(p, legTip, u_cent) for m in a_[2] for p in m["cur"]]
                d = max(min(M.dist(q, r) for r in pb) for q in ma)
                if d < 1e-9:
                    return (a_, b_, d)
        return None

    missing = missing_lines(S)
    say(f"[4] 内側の線 {len(lines) - sum(1 for L in lines if L['type'] == 1)}本のうち、"
        f"モデル（⑫のあと）に無い線 {len(missing)}本")
    groups, cand = leg_groups(missing)
    say(f"[5] 「いまの位置」で同じ直線に乗るまとまり {len(groups)}個 →"
        f" 脚の8面を1面1本ずつ横切るもの {len(cand)}個")
    for i, key, g in cand:
        ends = sorted([p for m in g for p in m["cur"]])
        say(f"    脚{i+1}：{len(g)}本／{M.r3(ends[0])}-{M.r3(ends[-1])}"
            f"（先端から近い端まで {min(M.dist(ends[0], legTip), M.dist(ends[-1], legTip)):.3f}）")

    pair = step13_pair(cand)
    if not pair:
        bad("⑬のまとまり（2本の脚で中心線の鏡になっている組）が見つからない")
        return
    a, b, dmir = pair
    say(f"[6] ⑬＝2本の脚にあり中心線の鏡になっている組（鏡のずれ {dmir:.1e}）"
        f"／片方の脚にだけある残りのまとまり（先端寄り）は⑭（頭）として採らない")

    # ---------- [6b] 向きが決まらないことは⑬の線を変えるか ----------
    want = sorted(tuple(round(v, 12) for v in p) for m in (a[2] + b[2]) for p in m["cur"])
    same = []
    for k in tied:
        pr = step13_pair(leg_groups(missing_lines(O.SYM[k]))[1])
        got = sorted(tuple(round(v, 12) for v in p) for m in (pr[1][2] + pr[0][2]) for p in m["cur"]) if pr else None
        same.append(got == want)
        if got != want:
            bad(f"原紙の対称 {k} では⑬の線（いまの位置）が変わる")
    say(f"[6b] 同点の向き {tied} すべてで、⑬の線（いまの位置・16本の端点）は"
        f"**{'同じ' if all(same) else '違う'}**"
        f"（⑭の線だけが首と尾で入れかわる）→ 向きが決まらないことは⑬に効かない")

    out = {"meta": {
        "note": "つる⑬の中割り線を ORIPA の元の端点から取り出したもの（丸めた角度は使っていない）",
        "source": f"oripa_sample/{OPX}",
        "sourceSha1": sha,
        "model": D["meta"]["source"],
        "modelFingerprint": D["meta"]["stateFingerprint"],
        "normalize": {"cx": cx, "cy": cy, "scale": s},
        "symIndex": si,
        "symMatrix": [list(S[0]), list(S[1])],
        "symTied": tied,
        "legTip": list(legTip),
        "centerDir": list(u_cent),
    }, "legs": []}

    for leg_i, key, g in (a, b):
        pts = [p for m in g for p in m["cur"]]
        c0, ud, worst = fit_line(pts)
        # 中心線との交わり V
        den = M.cross(ud, u_cent)
        t = M.cross(M.sub(legTip, c0), u_cent) / den
        V = (c0[0] + ud[0] * t, c0[1] + ud[1] * t)
        # 線分の両端（いまの位置）
        ends = sorted(pts, key=lambda p: M.dot(M.sub(p, c0), ud))
        ang = math.degrees(math.acos(min(1.0, abs(M.dot(ud, u_cent)))))
        say(f"\n[7] 脚{leg_i+1} の⑬の線（ORIPA の端点から）")
        say(f"    いまの位置：{M.r3(ends[0])} - {M.r3(ends[-1])}"
            f"／中心線との交わり V {M.r3(V)}（先端から {M.dist(V, legTip):.6f}）")
        say(f"    中心線とのなす角 {ang:.4f}°（⚠この値は**報告用**。線は端点から作る）"
            f"／8本の直線からのずれ {worst:.2e}")
        if worst > 1e-9:
            bad(f"脚{leg_i+1}：8本が1本の直線に乗らない（ずれ {worst:.1e}）")
        rows = []
        for m in sorted(g, key=lambda m: m["layer"]):
            rows.append({
                "opxIndex": m["idx"], "opxType": m["type"],
                "raw": [list(m["raw"][0]), list(m["raw"][1])],
                "mat": [list(m["mat"][0]), list(m["mat"][1])],
                "cur": [list(m["cur"][0]), list(m["cur"][1])],
                "faceId": m["faceId"], "layer": m["layer"],
            })
            say(f"      層{m['layer']:4d}  opx#{m['idx']:3d} {O.TYPE_NAME.get(m['type'], m['type'])}"
                f"  素材 {M.r3(m['mat'][0])}-{M.r3(m['mat'][1])}  面 …{m['faceId'][-24:]}")
        out["legs"].append({
            "leg": leg_i + 1,
            "faceIds": sorted(m["faceId"] for m in g),
            "curLine": {"a": list(ends[0]), "b": list(ends[-1])},
            "V": list(V), "distTipToV": M.dist(V, legTip),
            "angleDeg": ang, "collinearity": worst,
            "lines": rows,
        })

    p = os.path.join(HERE, "crane13_cutline.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    say(f"\n書き出し：{os.path.basename(p)}（脚 {len(out['legs'])}本・各8線）")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 書き出しが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
