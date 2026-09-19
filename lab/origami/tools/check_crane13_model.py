# -*- coding: utf-8 -*-
"""つる⑬（脚の中割り折り）の独立モデル・第1段：入力の健全性／脚の構造／どこを動かせるか（2026-09-16）

工程番号：折り図（おりがみくらぶ `_zu/tsuru.png`）の ⑫（実装ずみ）→ **⑬ 脚を なかわりおり**（ここ）→ ⑭ 頭・羽。
  既存の `probe_crane14_structure.js` は**名前が14だが中身は⑬の事前確認**。この Python は ⑬（crane13）で名前をそろえる。

入力＝`crane13_input.json`（`node export_crane13_input.js` が書く⑫のあとの紙）。
**JS の判定は1つも呼ばない**＝面の素材座標・置かれ方 xf・層・結びの線分だけから、この中で独立に組み直す。

見ること
  [A] 入力の健全性（xf は等長か・結びは両方の面のふちに乗るか・層は重複しないか）
  [B] 脚の同定（外形だけで：細いまま続く長さの長い方が脚の側）と、脚のまとまり
  [C] 脚の半分（4面）を剛体としてまとめられるか＝内部の結び・置かれ方・表裏・層
  [D] **単一の軸で動かせる面の集合を総当り**（ある集合が1本の軸のまわりに剛体で動ける
      ⇔ その集合の境界の結びが**ぜんぶその軸の上**にある）。⑬で開けたい所（脚の付け根の背）を
      この物差しで調べ、「胴の表側だけ動く」が成り立つかを**前提にせず**確かめる。
  [E] 中割り線を仮に入れた紙で [D] をやり直す（線の角度・位置は**代表値の仮置き**＝下の CUT_* ）。

使い方： python check_crane13_model.py [--json 出力先]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import json, math, os, sys, traceback
from itertools import combinations

EPS = 1e-9
HERE = os.path.dirname(os.path.abspath(__file__))
ng = []
out_lines = []


def say(*a):
    s = " ".join(str(x) for x in a)
    out_lines.append(s)
    print(s)


def bad(msg):
    ng.append(msg)
    say("  NG:", msg)


# ---------- 素の幾何 ----------
def ap(m, p):
    return (m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5])


def det(m):
    return m[0] * m[3] - m[1] * m[2]


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def area(poly):
    s = 0.0
    for i in range(len(poly)):
        x, y = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        s += x * y2 - x2 * y
    return s / 2


def line_of(seg):
    """線分の乗る直線を正規形 (a,b,c)（a*x+b*y=c・(a,b)は単位・符号を一意に）で返す"""
    d = sub(seg[1], seg[0])
    L = math.hypot(*d)
    a, b = -d[1] / L, d[0] / L
    c = a * seg[0][0] + b * seg[0][1]
    if a < -EPS or (abs(a) <= EPS and b < 0):
        a, b, c = -a, -b, -c
    return (round(a, 9) + 0.0, round(b, 9) + 0.0, round(c, 9) + 0.0)


def on_line(p, ln, tol=1e-7):
    return abs(ln[0] * p[0] + ln[1] * p[1] - ln[2]) < tol


def seg_on_line(seg, ln, tol=1e-7):
    return on_line(seg[0], ln, tol) and on_line(seg[1], ln, tol)


def point_on_seg(p, seg, tol=1e-7):
    d = sub(seg[1], seg[0])
    L = math.hypot(*d)
    if L < tol:
        return dist(p, seg[0]) < tol
    t = dot(sub(p, seg[0]), d) / (L * L)
    if t < -tol / L or t > 1 + tol / L:
        return False
    return abs(cross(sub(p, seg[0]), d)) / L < tol


def on_boundary(p, poly, tol=1e-7):
    return any(point_on_seg(p, (poly[i], poly[(i + 1) % len(poly)]), tol) for i in range(len(poly)))


# ---------- 読み込み ----------
def load():
    with open(os.path.join(HERE, "crane13_input.json"), encoding="utf-8") as f:
        d = json.load(f)
    for f_ in d["faces"]:
        f_["cur"] = [tuple(p) for p in f_["poly"]]     # engine の poly ＝いまの位置
        f_["mat"] = [tuple(p) for p in f_["mat"]]      # 素材座標（xf⁻¹·poly）
    for b in d["bonds"]:
        b["cur"] = [tuple(p) for p in b["cur"]]
        b["seg"] = [tuple(p) for p in b["seg"]]        # 素材座標（結ばれた2面で共通）
    return d


def main():
    D = load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    say("材料：", D["meta"]["source"], "指紋", D["meta"]["stateFingerprint"][:12],
        "／面", len(faces), "結び", len(bonds), "折り目", len(D["creases"]), "背", len(D["hinges"]))
    say("工程：", D["meta"]["note"])

    # ---------- [A] 入力の健全性 ----------
    say("\n[A] 入力の健全性")
    worst_iso, worst_xf = 0.0, 0.0
    for f in D["faces"]:
        m = f["xf"]
        e = max(abs(m[0] ** 2 + m[2] ** 2 - 1), abs(m[1] ** 2 + m[3] ** 2 - 1), abs(m[0] * m[1] + m[2] * m[3]))
        worst_iso = max(worst_iso, e)
        if abs(abs(det(m)) - 1) > 1e-9:
            bad(f"置かれ方が等長でない {f['faceId']}")
        if abs(area(f["cur"])) < 1e-12:
            bad(f"面積がない {f['faceId']}")
        # 素材 → いまの位置（xf を掛けると poly になる）
        for pm, pc in zip(f["mat"], f["cur"]):
            worst_xf = max(worst_xf, dist(ap(m, pm), pc))
        # 素材の形と、いまの位置の形で、辺の長さが同じ
        for i in range(len(f["mat"])):
            a0, b0 = f["mat"][i], f["mat"][(i + 1) % len(f["mat"])]
            a1, b1 = f["cur"][i], f["cur"][(i + 1) % len(f["cur"])]
            if abs(dist(a0, b0) - dist(a1, b1)) > 1e-9:
                bad(f"辺の長さが変わる {f['faceId']}")
        # 素材は原紙 [-1,1]² の中
        if any(abs(p[0]) > 1 + 1e-9 or abs(p[1]) > 1 + 1e-9 for p in f["mat"]):
            bad(f"素材が原紙の外 {f['faceId']}")
    say("  置かれ方の等長のずれ（最大）", f"{worst_iso:.2e}", "／素材→いまの位置のずれ（最大）", f"{worst_xf:.2e}")

    worst_bond, worst_shared = 0.0, 0.0
    for b in bonds:
        f0, f1 = faces[b["faceIds"][0]], faces[b["faceIds"][1]]
        c0 = [ap(f0["xf"], p) for p in b["seg"]]
        c1 = [ap(f1["xf"], p) for p in b["seg"]]
        worst_bond = max(worst_bond, max(dist(c0[i], b["cur"][i]) for i in (0, 1)))
        # 結びの線分は、いまの位置でも素材でも、両方の面が共有している
        e = min(max(dist(c0[i], c1[i]) for i in (0, 1)), max(dist(c0[i], c1[1 - i]) for i in (0, 1)))
        worst_shared = max(worst_shared, e)
        if e > 1e-9:
            bad(f"結びの線分が両方の面で一致しない {b['bondId']}")
        for f_ in (f0, f1):
            for p in b["seg"]:
                if not on_boundary(p, f_["mat"]):
                    bad(f"結びの端が面の素材のふちに乗らない {b['bondId']} {f_['faceId']}")
        if b["kind"] not in ("hinge", "crease"):
            bad(f"知らない結びの種類 {b['kind']}")
    say("  結びの位置のずれ（最大）", f"{worst_bond:.2e}", "／2面で共有しているか（最大ずれ）", f"{worst_shared:.2e}",
        "／種類", {k: sum(1 for b in bonds if b["kind"] == k) for k in ("hinge", "crease")})

    lay = [f["layer"] for f in D["faces"]]
    say("  層", "重複なし" if len(set(lay)) == len(lay) else f"⚠重複あり（{len(lay) - len(set(lay))}）",
        "／範囲", min(lay), "〜", max(lay))
    # 紙ぜんぶが結びでつながっているか
    if len(component_of(next(iter(faces)), faces, bonds, lambda b: True)) != len(faces):
        bad("紙が結びで1つにつながっていない")
    say("  紙は結びで1つにつながっている")

    # ---------- [B] 脚の同定 ----------
    say("\n[B] 脚の側の**候補選び**（外形の形だけで。花弁の面には頼らない）")
    say("  🚨「細いまま続く長さ」で選ぶのは**この入力で候補を選ぶため**だけ＝脚の一般の定義ではない"
        "（一般の決め手は下の [C]＝素材のどの角から来た面か）")
    lm = D["landmarks"]
    legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
    for v in lm["necks"]:
        say("  遠い角", r3(v["corner"]), "の細いまま続く長さ", f"{v['neck']:.3f}")
    say("  → 脚の先端", r3(legTip), "／羽（花弁）の先端", r3(petalTip))
    L = dist(legTip, petalTip)
    u = ((petalTip[0] - legTip[0]) / L, (petalTip[1] - legTip[1]) / L)   # 脚→羽 の向き
    nrm = (-u[1], u[0])
    neck = min(v["neck"] for v in lm["necks"] if dist(v["corner"], legTip) < EPS or True) if False else \
        [v["neck"] for v in lm["necks"] if dist(tuple(v["corner"]), legTip) < EPS][0]
    say("  中心線の向き", r3(u), "／脚の付け根（外形が広がる所）", f"{neck:.3f}")

    legs = tip_components(faces, bonds, legTip, u, nrm, 0.3 * neck)
    say("  脚の側のまとまり", len(legs), "個（面の数", "・".join(str(len(c)) for c in legs), "）")
    if len(legs) != 2 or any(len(c) != 8 for c in legs):
        bad("脚が「8面ずつ2まとまり」でない")
    say("  2本の脚どうし：", mirror_check(legs, faces, legTip, u))

    # ---------- [C] 脚の半分 ----------
    say("\n[C] 脚のまとまりの中（半分4面を剛体にできるか）")
    legs_info = []
    for i, c in enumerate(legs):
        info = leg_structure(c, faces, bonds, legTip, u)
        legs_info.append(info)
        # この脚が原紙のどの角から来たか（先端の素材での行き先）＝「脚1本」の決め手
        mats = set()
        for fid in c:
            f = faces[fid]
            for pm, pc in zip(f["mat"], f["cur"]):
                if dist(pc, legTip) < 1e-9:
                    mats.add((round(pm[0], 6), round(pm[1], 6)))
        say(f"  脚{i+1}：面{len(c)}・中の結び{info['n_in']}本（木＝{info['tree']}／ひと筋のじゃばら＝{info['chain']}）"
            f"／先端は原紙の角 {sorted(mats)} から（1つなら、この8面で1本の点）")
        if len(mats) != 1:
            bad(f"脚{i+1} の先端が原紙の2つ以上の角から来ている")
        say(f"    じゃばらの並び：{info['order']}")
        say(f"    重なりで上4枚・下4枚に分かれる背（中心線の上＝{info['spine_on_center']}）：{r3seg(info['spine'])}"
            f"　※これは**1本の脚の中の折り**であって、2本の脚の境目ではない")
        for h, half in enumerate(info["halves"]):
            fl = sorted((faces[x]["layer"] for x in half), reverse=True)
            sides = ["表" if det(faces[x]["xf"]) > 0 else "裏" for x in sorted(half, key=lambda x: -faces[x]["layer"])]
            say(f"    {'上' if h == 0 else '下'}の4面：層 {fl}／表裏 {sides}／中の結び {len(info['half_bonds'][h])}本"
                f"（木＝{info['half_tree'][h]}）")
        # 付け根（胴）への結び
        say(f"    胴への結び {len(info['to_body'])}本："
            f"{'ぜんぶ折り目' if all(b['kind']=='crease' for b in info['to_body']) else '⚠背をふくむ'}"
            f"／乗る直線 {len(set(line_of(b['cur']) for b in info['to_body']))}本")

    # ---------- [D] 単一の軸で動かせる集合 ----------
    say("\n[D] 1本の軸で動かせる面の集合（境界の結びがぜんぶその軸の上）")
    mob = single_axis_sets(faces, bonds)
    say(f"  結びの乗る直線 {len(set(line_of(b['cur']) for b in bonds))}本 → 動かせる集合 {len(mob)}個")
    for ln, comp in sorted(mob, key=lambda t: len(t[1]))[:40]:
        say(f"    軸 {r3(( -ln[1], ln[0]))}方向 通る点{r3(( ln[0]*ln[2], ln[1]*ln[2]))}：{len(comp)}面")

    # ⑬で開けたい所＝脚の付け根の背（半分どうしをつなぐ背）
    say("\n[D2] ⑬で開けたい所＝脚の半分どうしをつなぐ背（中心線）を開けるか")
    for i, info in enumerate(legs_info):
        spine_line = line_of(info["spine"])
        sets = [c for ln, c in mob if ln == spine_line]
        say(f"  脚{i+1} の背が乗る直線を軸にできる集合：{len(sets)}個"
            + ("".join(f"\n    {len(c)}面 …脚{i+1}の半分を{'ふくむ' if info['halves'][0] & c or info['halves'][1] & c else 'ふくまない'}" for c in sets) if sets else " → **無し**"))
        # その背だけを外したときに紙が2つに割れるか（＝ほかの結びで回り込んでいないか）
        rest = [b for b in bonds if b["bondId"] != info["spine_bond"]["bondId"]]
        comp = component_of(info["spine_bond"]["faceIds"][0], faces, rest, lambda b: True)
        say(f"    その背 1本だけを外すと紙は{'2つに割れる' if len(comp) < len(faces) else '割れない（ほかの結びで回り込む）'}")

    # ---------- [E] 中割り線を仮に入れた紙 ----------
    say("\n[E] 中割り線（仮置き）を1本の脚に入れて、動かせる集合を調べ直す")
    say(f"  ⚠ 線の位置・角度は**代表値の仮置き**：脚の先端から {CUT_S} の所で中心線と {CUT_ANGLE}°"
        f"（折り図・動画から読めるのは「先端寄りで中心線を横切る」ことだけ＝角度は決まらない。90°は特異な場合）")
    for i, (c, info) in enumerate(zip(legs, legs_info)):
        cut = cut_graph(c, faces, bonds, legTip, u, CUT_S, CUT_ANGLE)
        say(f"  脚{i+1}：中割り線が通る面 {cut['n_cut']}（＝この脚の面だけ折り目を入れる。もう1本の脚には入れない）"
            f"／先端側の部分 {len(cut['tip'])}・付け根側 {len(cut['base'])}")
        mob2 = single_axis_sets(cut["faces"], cut["bonds"])
        uniq = {}
        for ln, comp in mob2:
            uniq.setdefault((ln, tuple(sorted(comp))), (ln, comp))
        say(f"    1本の軸で動かせる集合 {len(uniq)}個：")
        for ln, comp in sorted(uniq.values(), key=lambda t: len(t[1])):
            tipn = len(comp & cut["tip"])
            say(f"      {len(comp)}枚（うち中割り線より先の部分 {tipn}）"
                f"／軸 通る点{r3((ln[0]*ln[2], ln[1]*ln[2]))} 向き{r3((-ln[1], ln[0]))}"
                f"{'　←★中割り線そのもの＝先だけ全部＝ふつうの折り（外へ折る）' if seg_on_line(cut['cutseg'], ln) and tipn == len(comp) else ''}")
        if i == 0:
            say("\n[F] 付け根を固めたままで中割りができるか（厳密な言い切り）")
            say("    芯：先の部分 i と j が中割り線 L のまわりに a_i・a_j 回り、あいだの折り（線 C）が c 回るとき、"
                "付け根が固まっていれば輪の閉じは R_C(c)=R_L(a_i−a_j)。**違う直線のまわりの回転が等しいのは両方が何もしないときだけ**"
                "＝c=0・a_i=a_j。これが折り8枚ぜんぶに効くので、先の8枚は**ひとかたまりで回るしかない＝ふつうの外へ折る**。")
            ok = True
            for bd in cut["bonds"]:
                if not bd["bondId"].startswith("cut:") and bd["faceIds"][0] in cut["tip"] and bd["faceIds"][1] in cut["tip"]:
                    lc, ll = line_of(bd["cur"]), line_of(cut["cutseg"])
                    ang = math.degrees(math.acos(min(1, abs(lc[0] * ll[0] + lc[1] * ll[1]))))  # 直線どうしのなす角
                    same = abs(lc[0] - ll[0]) < 1e-9 and abs(lc[1] - ll[1]) < 1e-9 and abs(lc[2] - ll[2]) < 1e-9
                    if same:
                        ok = False
                    say(f"      先の部分どうしの折り {bd['bondId']}：中割り線と{'同じ直線' if same else f'違う直線（なす角 {ang:.1f}°）'}")
            if not ok:
                bad("先の部分どうしの折りが中割り線と同じ直線＝上の言い切りが使えない")
            say("    → **付け根（脚の付け根側8枚と胴）を固めたままでは中割り折りにならない**。"
                "中割りには、付け根側の折りの角が変わること（＝脚の付け根が開くこと）が要る。")
    res = {
        "legs": [sorted(c) for c in legs],
        "mobile": [{"line": ln, "faces": sorted(c)} for ln, c in mob],
    }
    return res


"""中割り線の位置・角度は**代表値の仮置き**（折り図・動画から読めるのは「先端寄りで中心線を横切る」ことだけ）。
   ⚠ 直角（90°）は頂点の4つの角がぜんぶ直角になる**特異な場合**（ふつうの折りの枝と混ざる）なので、
     ふだんの代表値は直角以外にする。`--angle 90` で特異な場合も見られる。"""
CUT_S = 0.5     # 中割り線の位置（脚の先端からの距離）
CUT_ANGLE = 60  # 中心線となす角（度）


def cut_graph(comp, faces, bonds, tip, u, s, ang=90, line=None):
    """まとまり comp の面だけに中割り線を入れて、面と結びを切り分けた新しい図を作る。
       線＝脚の先端から s の所で中心線と ang 度。ほかの紙（もう1本の脚・胴）は切らない。
       `line=(A,B)`（いまの位置の2点）を渡すと、**その直線をそのまま使う**（s・ang は無視）。
       ＝ORIPA の元の端点から作った線を、丸めた角度を経由せずに入れるための口。"""
    if line is not None:
        A, B = tuple(line[0]), tuple(line[1])
    else:
        th = math.radians(ang)
        d = (u[0] * math.cos(th) - u[1] * math.sin(th), u[0] * math.sin(th) + u[1] * math.cos(th))
        M = (tip[0] + u[0] * s, tip[1] + u[1] * s)
        A, B = M, (M[0] + d[0], M[1] + d[1])
    if side(tip, A, B) > 0:
        A, B = B, A                     # 先端側が side<0
    nf, nb, tipset, baseset = {}, [], set(), set()
    n_cut = 0
    for fid, f in faces.items():
        if fid not in comp:
            nf[fid] = f
            continue
        t = clip_side(f["cur"], A, B, True)
        b = clip_side(f["cur"], A, B, False)
        if t and b:
            n_cut += 1
            nf[fid + "#tip"] = dict(f, cur=t, faceId=fid + "#tip")
            nf[fid + "#base"] = dict(f, cur=b, faceId=fid + "#base")
            tipset.add(fid + "#tip")
            baseset.add(fid + "#base")
            nb.append(dict(bondId="cut:" + fid, faceIds=[fid + "#tip", fid + "#base"], kind="crease",
                           stepId="cut", seg=None, cur=line_chord(f["cur"], A, B)))
        else:
            nf[fid] = f
            (tipset if t else baseset).add(fid)
    part = lambda fid, p: (fid + "#tip" if side(p, A, B) < -1e-9 else fid + "#base") if (fid + "#tip") in nf else fid
    for bd in bonds:
        sa, sb = side(bd["cur"][0], A, B), side(bd["cur"][1], A, B)
        if (sa < -1e-9 and sb > 1e-9) or (sa > 1e-9 and sb < -1e-9):
            t = sa / (sa - sb)
            X = (bd["cur"][0][0] + (bd["cur"][1][0] - bd["cur"][0][0]) * t,
                 bd["cur"][0][1] + (bd["cur"][1][1] - bd["cur"][0][1]) * t)
            for half, seg in ((0, [bd["cur"][0], X]), (1, [X, bd["cur"][1]])):
                mid = ((seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2)
                nb.append(dict(bd, bondId=bd["bondId"] + f"@{half}", cur=seg,
                               faceIds=[part(x, mid) for x in bd["faceIds"]]))
        else:
            mid = ((bd["cur"][0][0] + bd["cur"][1][0]) / 2, (bd["cur"][0][1] + bd["cur"][1][1]) / 2)
            nb.append(dict(bd, faceIds=[part(x, mid) for x in bd["faceIds"]]))
    return dict(faces=nf, bonds=nb, tip=tipset, base=baseset, n_cut=n_cut, cutseg=[A, B])


def oripa_cut_line(legno=1, fp=None):
    """ORIPA の**元の端点**から作った⑬の中割り線（`crane13_cutline.json`）を、
       「いまの位置」の2点で返す。⚠丸めた角度（75.9°など）は経由しない。
       作り方＝`export_crane13_cutline.py`／検算＝`check_crane13_cutline.py`。"""
    with open(os.path.join(HERE, "crane13_cutline.json"), encoding="utf-8") as f:
        d = json.load(f)
    if fp is not None and d["meta"]["modelFingerprint"] != fp:
        raise RuntimeError("crane13_cutline.json が別の紙から作られている（指紋が違う）")
    for leg in d["legs"]:
        if leg["leg"] == legno:
            return (tuple(leg["curLine"]["a"]), tuple(leg["curLine"]["b"])), leg, d["meta"]
    raise RuntimeError(f"脚{legno} の中割り線が crane13_cutline.json に無い")


def line_chord(poly, A, B):
    """多角形を直線 A-B で切ったときに、**その直線の上にできる線分**（＝新しい折り目）。
       🚨 切り分けた2つの部分の「共通の点」を拾う作り方は、頂点が線の上に乗るときに取り違える
          （数値の丸めで一致しない／3点以上あって端でない2点を選ぶ）。直線との交わりから作り直す。"""
    d = sub(B, A)
    pts = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        sp, sq = side(p, A, B), side(q, A, B)
        if abs(sp) < 1e-12:
            pts.append(p)
        if (sp < -1e-12 and sq > 1e-12) or (sp > 1e-12 and sq < -1e-12):
            t = sp / (sp - sq)
            pts.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    if len(pts) < 2:
        raise RuntimeError("中割り線が面を切っていない")
    pts.sort(key=lambda p: dot(sub(p, A), d))
    return [pts[0], pts[-1]]


# ---------- 部品 ----------
def r3(p):
    return "[" + ",".join(f"{v:.3f}" for v in p) + "]"


def r3seg(s):
    return r3(s[0]) + "-" + r3(s[1])


def component_of(start, faces, bonds, ok):
    seen = {start}
    q = [start]
    while q:
        x = q.pop()
        for b in bonds:
            if x not in b["faceIds"] or not ok(b):
                continue
            y = b["faceIds"][0] if b["faceIds"][1] == x else b["faceIds"][1]
            if y not in seen:
                seen.add(y)
                q.append(y)
    return seen


def side(p, a, b):
    return cross(sub(b, a), sub(p, a))


def clip_side(poly, a, b, keep_negative=True):
    """直線 a-b で切って、片側（side<0 の側）の部分を返す（凸でなくてもよい・端だけの接触は空）"""
    out = []
    n = len(poly)
    sgn = lambda p: side(p, a, b) * (1 if keep_negative else -1)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        sp, sq = sgn(p), sgn(q)
        if sp <= EPS:
            out.append(p)
        if (sp < -EPS and sq > EPS) or (sp > EPS and sq < -EPS):
            t = sp / (sp - sq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out if len(out) >= 3 and abs(area(out)) > 1e-12 else []


def tip_components(faces, bonds, tip, u, nrm, s):
    """先端から s の所で中心線に直角に切り、先端側の面を、先端側に入る結びでたどってまとまりに分ける"""
    M = (tip[0] + u[0] * s, tip[1] + u[1] * s)
    A, B = (M[0] - nrm[0], M[1] - nrm[1]), (M[0] + nrm[0], M[1] + nrm[1])
    if side(tip, A, B) > 0:
        A, B = B, A
    tipside = {fid for fid, f in faces.items() if clip_side(f["cur"], A, B)}
    inner = lambda b: (b["faceIds"][0] in tipside and b["faceIds"][1] in tipside
                       and (side(b["cur"][0], A, B) < -1e-9 or side(b["cur"][1], A, B) < -1e-9))
    comps, seen = [], set()
    for fid in tipside:
        if fid in seen:
            continue
        c = component_of(fid, faces, [b for b in bonds if inner(b)], lambda b: True) & tipside
        seen |= c
        comps.append(c)
    # 🚨 並び順を固定する（大きい順、同じ大きさなら面ID の最小で）。set の並びは PYTHONHASHSEED で変わり、
    #    「脚1」「脚2」が実行ごとに入れかわっていた（2026-09-17 に発覚。2本は鏡なので数値は同じだった）。
    return sorted(comps, key=lambda c: (-len(c), min(c)))


def leg_structure(comp, faces, bonds, tip, u):
    """まとまりの中の結び・半分・胴への結び
       脚の8面は**じゃばら**（木がひと筋の道）で、折り目の位置が中心線と外形で交互に入れかわる。
       「表の半分・裏の半分」＝重なりで上4枚・下4枚に分かれる切れ目＝**その道のまんなかの背**。
       手番号や面IDでは決めない（結びの形と層だけで決める）。"""
    inside = [b for b in bonds if b["faceIds"][0] in comp and b["faceIds"][1] in comp]
    to_body = [b for b in bonds if (b["faceIds"][0] in comp) != (b["faceIds"][1] in comp)]
    on_center = lambda b: all(abs(cross(sub(p, tip), u)) < 1e-9 for p in b["cur"])
    deg = {fid: sum(1 for b in inside if fid in b["faceIds"]) for fid in comp}
    chain = (len(inside) == len(comp) - 1 and sorted(deg.values()) == [1, 1] + [2] * (len(comp) - 2))
    # 上下に分かれる切れ目（層で上の組・下の組にきれいに分かれる背）
    spine_bond, halves = None, None
    for b in inside:
        rest = [x for x in inside if x is not b]
        c0 = component_of(b["faceIds"][0], faces, rest, lambda x: True) & comp
        c1 = comp - c0
        if not c1:
            continue
        l0 = [faces[x]["layer"] for x in c0]
        l1 = [faces[x]["layer"] for x in c1]
        if min(l0) > max(l1) or min(l1) > max(l0):
            if len(c0) != len(c1):
                continue          # 上下には分かれるが半々でない（じゃばらの端の折り）＝半分ではない
            if spine_bond is not None:
                raise RuntimeError("上下に半々で分かれる背が2本以上ある")
            spine_bond, halves = b, (c0, c1) if min(l0) > max(l1) else (c1, c0)
    if spine_bond is None:
        raise RuntimeError("上下に半々で分かれる背が無い")
    half_bonds = [[b for b in inside if b["faceIds"][0] in h and b["faceIds"][1] in h] for h in halves]
    return dict(n_in=len(inside), tree=(len(inside) == len(comp) - 1), chain=chain,
                spine=spine_bond["cur"], spine_bond=spine_bond, spine_on_center=on_center(spine_bond),
                halves=halves, half_bonds=half_bonds,
                half_tree=[len(hb) == len(h) - 1 for hb, h in zip(half_bonds, halves)],
                where=["中心線" if on_center(b) else "外形" for b in inside],
                to_body=to_body, mirror=mirror_check(halves, faces, tip, u),
                order=chain_order(comp, inside, faces, on_center))


def chain_order(comp, inside, faces, on_center):
    """じゃばらの並び（端から端まで）を、層と折り目の位置で書き出す"""
    deg = {fid: [b for b in inside if fid in b["faceIds"]] for fid in comp}
    ends = [fid for fid in comp if len(deg[fid]) == 1]
    if not ends:
        return "（ひと筋の道ではない）"
    cur, prev, parts = ends[0], None, []
    while True:
        parts.append(f"L{faces[cur]['layer']}")
        nxt = [b for b in deg[cur] if b is not prev]
        if not nxt:
            break
        b = nxt[0]
        parts.append("=中心線=" if on_center(b) else "=外形=")
        cur, prev = (b["faceIds"][0] if b["faceIds"][1] == cur else b["faceIds"][1]), b
    return "".join(parts)


def mirror_check(halves, faces, tip, u):
    """中心線について鏡に映すと、半分1の面が半分2の面に（形と位置で）重なるか"""
    def refl(p):
        t = dot(sub(p, tip), u)
        f = (tip[0] + u[0] * t, tip[1] + u[1] * t)
        return (2 * f[0] - p[0], 2 * f[1] - p[1])
    a = [sorted(round(v, 9) for v in sum(([*refl(p)] for p in faces[x]["cur"]), [])) for x in halves[0]]
    b = [sorted(round(v, 9) for v in sum(([*p] for p in faces[x]["cur"]), [])) for x in halves[1]]
    matched = 0
    used = set()
    for x in a:
        for j, y in enumerate(b):
            if j in used or len(x) != len(y):
                continue
            if all(abs(p - q) < 1e-9 for p, q in zip(x, y)):
                used.add(j)
                matched += 1
                break
    return f"中心線の鏡で {matched}/{len(a)} 面が重なる"


def single_axis_sets(faces, bonds):
    """1本の軸で動かせる集合の総当り：
       その集合の境界の結びがぜんぶ同じ直線の上 ⇔ その直線を軸に剛体で回せる（回せる角度は別の話）"""
    lines = {}
    for b in bonds:
        lines.setdefault(line_of(b["cur"]), []).append(b)
    found = []
    for ln, on in lines.items():
        rest = [b for b in bonds if line_of(b["cur"]) != ln]
        seen = set()
        for fid in faces:
            if fid in seen:
                continue
            c = component_of(fid, faces, rest, lambda b: True)
            seen |= c
            if len(c) == len(faces):
                continue
            border = [b for b in bonds if (b["faceIds"][0] in c) != (b["faceIds"][1] in c)]
            if border and all(seg_on_line(b["cur"], ln) for b in border):
                found.append((ln, c))
    return found


if __name__ == "__main__":
    if "--angle" in sys.argv:
        CUT_ANGLE = float(sys.argv[sys.argv.index("--angle") + 1])
    if "--pos" in sys.argv:
        CUT_S = float(sys.argv[sys.argv.index("--pos") + 1])
    try:
        res = main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    if "--json" in sys.argv:
        p = sys.argv[sys.argv.index("--json") + 1]
        with open(p, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
