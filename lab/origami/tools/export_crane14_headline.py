# -*- coding: utf-8 -*-
"""つる⑭（頭の中割り）：**ORIPA の元の端点から**頭の線を取り出して固定する（2026-09-19）

⑬（export_crane13_cutline.py → crane13_cutline.json）と同じ出どころ・同じ変換・**同じ原紙の向き**（symIndex）で、
⑬の組に入らなかった「脚の8面を1面1本ずつ横切るまとまり」のうち、**片方の脚にだけある先端寄りのもの**を⑭の線とする。
書き出すのは素材座標の端点だけ（いまの位置へは、使う側が⑬のあとの面の xf で写す）。

🚨 使い方の限界（[[feedback_origami_evidence]]）：ORIPA の展開図は数学的な折線。使うのは**線の位置だけ**。
⚠ 原紙の向きは4通り同点で、⑭の線がどちらの脚に付くかだけが入れかわる（crane13_cutline.json [6b]）。
   ここでは crane13_cutline.json が採った向き（symIndex）に合わせる＝⑬と⑭で向きを混ぜない。

使い方： python export_crane14_headline.py  → crane14_headline.json
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import hashlib
import json
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_crane13_cutline as X  # noqa: E402

M, O = X.M, X.O
ng = []


def say(*a):
    print(" ".join(str(x) for x in a))


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

    CUT = json.load(open(os.path.join(HERE, "crane13_cutline.json"), encoding="utf-8"))
    si = CUT["meta"]["symIndex"]
    S = O.SYM[si]
    path = os.path.join(HERE, "oripa_sample", X.OPX)
    sha = hashlib.sha1(open(path, "rb").read()).hexdigest()
    if sha != CUT["meta"]["sourceSha1"]:
        ng.append("展開図が crane13_cutline.json を作ったときと違う")
    raw = O.load_opx(path)
    lines, _ = O.norm_lines(raw)
    model_segs = [[tuple(p) for p in b["seg"]] for b in bonds] + [[tuple(p) for p in c["seg"]] for c in D["creases"]]
    used13 = {r["opxIndex"] for L in CUT["legs"] for r in L["lines"]}
    say(f"出どころ：oripa_sample/{X.OPX}（sha1 {sha[:12]}…）／原紙の向き {si}（crane13_cutline.json と同じ）")

    ms = []
    for idx, L in enumerate(lines):
        if L["type"] == 1 or idx in used13:
            continue
        seg = [O.apply_sym(L["a"], S), O.apply_sym(L["b"], S)]
        if O.seg_cover(seg, model_segs) > 0.02:
            continue
        mid = ((seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2)
        own = [fid for fid, f in faces.items() if O.in_poly(mid, f["mat"])]
        if len(own) != 1:
            continue
        f = faces[own[0]]
        ms.append(dict(idx=idx, type=L["type"], raw=[raw[idx]["a"], raw[idx]["b"]], mat=seg, faceId=own[0],
                       cur=[M.ap(f["xf"], p) for p in seg], layer=f["layer"]))
    gr = {}
    for m in ms:
        gr.setdefault(M.line_of(m["cur"]), []).append(m)
    cand = [(i, g) for g in gr.values() for i, c in enumerate(legs) if {m["faceId"] for m in g} == set(c) and len(g) == len(c)]
    say(f"⑬の16本を除いた「脚の8面を1面1本ずつ横切るまとまり」 {len(cand)}個")
    if len(cand) != 1:
        ng.append(f"⑭のまとまりが1つに決まらない（{len(cand)}）")
        return
    leg_i, g = cand[0]
    pts = [p for m in g for p in m["cur"]]
    _, _, worst = X.fit_line(pts)
    near = min(M.dist(p, legTip) for p in pts)
    say(f"⑭＝脚{leg_i + 1} の8本（⑫のあとの位置で1本の直線からのずれ {worst:.1e}・先端から近い端まで {near:.3f}）")
    if worst > 1e-9:
        ng.append("8本が1本の直線に乗らない")
    out = {"meta": {"note": "つる⑭（頭の中割り）の線を ORIPA の元の端点から取り出したもの（素材座標だけ・丸めた角度は使っていない）",
                    "source": f"oripa_sample/{X.OPX}", "sourceSha1": sha, "symIndex": si,
                    "model": D["meta"]["source"], "modelFingerprint": D["meta"]["stateFingerprint"],
                    "leg": leg_i + 1},
           "lines": [{"opxIndex": m["idx"], "opxType": m["type"], "raw": [list(m["raw"][0]), list(m["raw"][1])],
                      "mat": [list(m["mat"][0]), list(m["mat"][1])], "faceId12": m["faceId"], "layer12": m["layer"]}
                     for m in sorted(g, key=lambda m: m["layer"])]}
    p = os.path.join(HERE, "crane14_headline.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    say(f"書き出し：{os.path.basename(p)}（8本）")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 書き出しが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件：" + "／".join(ng)))
    sys.exit(0 if not ng else 1)
