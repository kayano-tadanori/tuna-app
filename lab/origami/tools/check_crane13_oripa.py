# -*- coding: utf-8 -*-
"""つる⑬：**ORIPA の展開図**と、いまのモデル（⑫のあと）の折線を、原紙の素材座標で照合する（2026-09-16）

🚨 使い方の限界（[[feedback_origami_evidence]]）
   **ORIPA の展開図は数学的な折線で、あれでは実際には折れない**。だから
   ・山谷の向きや層の上下の根拠にしない
   ・途中の非貫通が成立する根拠にもしない
   ここで見るのは **「モデルに足りていない折線があるか」だけ**。

見ること
  [A] その展開図が**同じ折り方の鶴か**／**どの工程までの折線を含むか**
  [B] 原紙の素材座標で位置を合わせる（正方形の対称8通りを総当りして、いちばん合う向きを選ぶ）
  [C] 線を分ける：①⑫までに既にある ②⑬の中割りで付く ③頭など後の工程 ④工程を特定できない
  [D] ⑫で内側に折り込まれた部分にも中割り線が続くか／**いまひとまとまりの剛体としている所を横切る線**があるか

入力：`oripa_sample/crane_base_mitani.opx`・`crane_final_mitani.opx`／`crane13_input.json`（⑫のあとのモデル）
使い方： python check_crane13_oripa.py
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util, math, os, sys, traceback
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("crane13_model", os.path.join(HERE, "check_crane13_model.py"))
M = importlib.util.module_from_spec(_s)
_s.loader.exec_module(M)
ng = []


def say(*a):
    print(" ".join(str(x) for x in a))


def bad(m):
    ng.append(m)
    say("  NG:", m)


TYPE_NAME = {0: "？0", 1: "外形(cut)", 2: "山", 3: "谷", 4: "折り目だけ"}


def load_opx(path):
    """ORIPA の .opx（java XMLDecoder）から線を読む。type/x0/x1/y0/y1。"""
    root = ET.parse(path).getroot()
    out = []
    for obj in root.iter("object"):
        if obj.get("class") != "oripa.OriLineProxy":
            continue
        d = {}
        for v in obj.findall("void"):
            p = v.get("property")
            for kid in v:
                d[p] = float(kid.text)
        if {"x0", "x1", "y0", "y1"} <= set(d):
            out.append(dict(type=int(d.get("type", 0)),
                            a=(d["x0"], d["y0"]), b=(d["x1"], d["y1"])))
    return out


def norm_lines(lines):
    """原紙 [-1,1]² に正規化（外形の大きさで割る）"""
    xs = [v for L in lines for v in (L["a"][0], L["b"][0])]
    ys = [v for L in lines for v in (L["a"][1], L["b"][1])]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = max(max(xs) - min(xs), max(ys) - min(ys)) / 2
    f = lambda p: ((p[0] - cx) / s, (p[1] - cy) / s)
    return [dict(type=L["type"], a=f(L["a"]), b=f(L["b"])) for L in lines], (cx, cy, s)


SYM = [((1, 0), (0, 1)), ((0, -1), (1, 0)), ((-1, 0), (0, -1)), ((0, 1), (-1, 0)),
       ((-1, 0), (0, 1)), ((1, 0), (0, -1)), ((0, 1), (1, 0)), ((0, -1), (-1, 0))]


def apply_sym(p, S):
    return (S[0][0] * p[0] + S[1][0] * p[1], S[0][1] * p[0] + S[1][1] * p[1])


# ---------- 線分の重なり ----------
def seg_cover(seg, segs, tol=1e-6):
    """seg が segs（同じ直線の上の線分の集まり）にどれだけ覆われているか（0〜1）"""
    ln = M.line_of(seg)
    d = M.sub(seg[1], seg[0])
    L = math.hypot(*d)
    if L < tol:
        return 1.0
    u = (d[0] / L, d[1] / L)
    iv = []
    for s in segs:
        if M.line_of(s) != ln:
            continue
        t0 = M.dot(M.sub(s[0], seg[0]), u)
        t1 = M.dot(M.sub(s[1], seg[0]), u)
        lo, hi = min(t0, t1), max(t0, t1)
        lo, hi = max(lo, 0.0), min(hi, L)
        if hi > lo + tol:
            iv.append((lo, hi))
    if not iv:
        return 0.0
    iv.sort()
    tot, cur = 0.0, iv[0]
    for s in iv[1:]:
        if s[0] <= cur[1] + tol:
            cur = (cur[0], max(cur[1], s[1]))
        else:
            tot += cur[1] - cur[0]
            cur = s
    tot += cur[1] - cur[0]
    return tot / L


def in_poly(p, poly, tol=1e-9):
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


def seg_in_polys(seg, polys, n=9):
    """線分の標本点が、どの多角形にどれだけ入っているか（0〜1）"""
    hit = 0
    for i in range(n):
        t = (i + 0.5) / n
        p = (seg[0][0] + (seg[1][0] - seg[0][0]) * t, seg[0][1] + (seg[1][1] - seg[0][1]) * t)
        if any(in_poly(p, q) for q in polys):
            hit += 1
    return hit / n


def main():
    D = M.load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    # モデルが持っている折線（素材座標）＝結びの線分＋記録された折り目
    model_segs = [[tuple(p) for p in b["seg"]] for b in bonds]
    model_segs += [[tuple(p) for p in c["seg"]] for c in D["creases"]]
    say(f"モデル（⑫のあと）：面 {len(faces)}／素材座標の折線 {len(model_segs)}本（結び＋折り目・重複あり）")

    for fn in ("crane_base_mitani.opx", "crane_final_mitani.opx"):
        path = os.path.join(HERE, "oripa_sample", fn)
        raw = load_opx(path)
        lines, sc = norm_lines(raw)
        kinds = {}
        for L in lines:
            kinds[L["type"]] = kinds.get(L["type"], 0) + 1
        say(f"\n=== {fn} ===")
        say(f"  線 {len(lines)}本（{'・'.join(f'{TYPE_NAME.get(k,k)} {v}' for k, v in sorted(kinds.items()))}）"
            f"／もとの大きさ 中心{sc[0]:.0f},{sc[1]:.0f} 半径{sc[2]:.0f}")

        # [B] 原紙の対称8通りで、いちばん合う向きを選ぶ
        best = None
        for si, S in enumerate(SYM):
            tot = 0.0
            for L in lines:
                if L["type"] == 1:
                    continue
                seg = [apply_sym(L["a"], S), apply_sym(L["b"], S)]
                tot += seg_cover(seg, model_segs)
            if best is None or tot > best[0]:
                best = (tot, si, S)
        tot, si, S = best
        inner = [L for L in lines if L["type"] != 1]
        say(f"  [B] 原紙の対称 {si} で合わせた（モデルと重なる割合の合計 {tot:.1f}／内側の線 {len(inner)}本）")

        # [C] 分ける
        cov = []
        for L in inner:
            seg = [apply_sym(L["a"], S), apply_sym(L["b"], S)]
            cov.append((L, seg, seg_cover(seg, model_segs)))
        have = [c for c in cov if c[2] > 0.98]
        part = [c for c in cov if 0.02 < c[2] <= 0.98]
        none = [c for c in cov if c[2] <= 0.02]
        say(f"  [C] ①⑫までに既にある（ほぼ全部モデルにある）{len(have)}本"
            f"／一部だけある {len(part)}本／モデルに無い {len(none)}本")
        if fn.startswith("crane_base"):
            continue

        # [D] モデルに無い（または一部だけ）線が、どこにあるか
        lm = D["landmarks"]
        legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
        LL = M.dist(legTip, petalTip)
        u = ((petalTip[0] - legTip[0]) / LL, (petalTip[1] - legTip[1]) / LL)
        nrm = (-u[1], u[0])
        neck = [v["neck"] for v in lm["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
        legs = M.tip_components(faces, bonds, legTip, u, nrm, 0.3 * neck)
        legpoly = []
        for i, c in enumerate(legs):
            corner = set()
            for fid in c:
                f = faces[fid]
                for pm, pc in zip(f["mat"], f["cur"]):
                    if M.dist(pc, legTip) < 1e-9:
                        corner.add((round(pm[0], 6), round(pm[1], 6)))
            legpoly.append(([faces[fid]["mat"] for fid in sorted(c)], sorted(corner)))
        say(f"  [D] 脚（点）の素材の場所：脚1＝原紙の角 {legpoly[0][1]}／脚2＝{legpoly[1][1]}")
        rows = []
        for L, seg, c in sorted(part + none, key=lambda t: -t[2]):
            f1 = seg_in_polys(seg, legpoly[0][0])
            f2 = seg_in_polys(seg, legpoly[1][0])
            where = ("脚1の中" if f1 > 0.6 else "脚2の中" if f2 > 0.6 else
                     f"脚1に一部({f1:.0%})" if f1 > 0.1 else f"脚2に一部({f2:.0%})" if f2 > 0.1 else "脚の外（胴・羽の側）")
            rows.append((c, seg, L["type"], where, f1, f2))
        say(f"  モデルに無い／一部だけの線 {len(rows)}本の内訳：")
        for c, seg, t, where, f1, f2 in rows:
            say(f"    {TYPE_NAME.get(t,t):8s} モデルとの重なり {c:4.0%}／{where}"
                f"／素材 {M.r3(seg[0])}-{M.r3(seg[1])}")
        # 「ひとまとまりの剛体としている面」を横切る線があるか
        cross = []
        for c, seg, t, where, f1, f2 in rows:
            for i, (polys, corner) in enumerate(legpoly):
                for fid, poly in zip(sorted(legs[i]), polys):
                    # 面の内部を通る（両端が面のふちでなく、中を横切る）か
                    n = 7
                    inside = sum(1 for k in range(n)
                                 if in_poly((seg[0][0] + (seg[1][0]-seg[0][0])*(k+.5)/n,
                                             seg[0][1] + (seg[1][1]-seg[0][1])*(k+.5)/n), poly))
                    if inside >= 2 and seg_cover(seg, [s for s in model_segs]) < 0.98:
                        cross.append((i + 1, fid, inside / n, seg))
                        break
        say(f"  **いまひとまとまりの剛体としている脚の面を横切る線：{len(cross)}本**")
        for i, fid, frac, seg in cross[:12]:
            say(f"    脚{i} の面 {fid[-28:]} を {frac:.0%} 横切る：{M.r3(seg[0])}-{M.r3(seg[1])}")

        # [E] モデルに無い線を「いまの位置」へ写す＝折った状態で1本の直線になるか
        say("  [E] モデルに無い線を、その面の置かれ方で**いまの位置**へ写す（折った状態で1本になるか）")
        groups = {}
        for L, seg, c in part + none:
            mid = ((seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2)
            own = [fid for fid, f in faces.items() if in_poly(mid, f["mat"])]
            if len(own) != 1:
                groups.setdefault("面が決まらない", []).append((seg, None, None))
                continue
            f = faces[own[0]]
            cur = [M.ap(f["xf"], p) for p in seg]
            key = M.line_of(cur)
            groups.setdefault(key, []).append((seg, cur, own[0]))
        for key, v in sorted(groups.items(), key=lambda t: -len(t[1])):
            if key == "面が決まらない":
                say(f"    ⚠ 面が1つに決まらない線 {len(v)}本（面のふちの上にある）")
                continue
            pts = [p for seg, cur, fid in v for p in cur]
            xs = sorted(pts, key=lambda p: (p[0], p[1]))
            ends = (xs[0], xs[-1])
            dist_tip = min(M.dist(ends[0], legTip), M.dist(ends[1], legTip))
            say(f"    {len(v)}本が**同じ1本の線**に乗る：{M.r3(ends[0])}-{M.r3(ends[1])}"
                f"（脚の先端からいちばん近い端まで {dist_tip:.3f}）"
                f"／層 {sorted(faces[fid]['layer'] for seg, cur, fid in v)}")
    return


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
