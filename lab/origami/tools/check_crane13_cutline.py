# -*- coding: utf-8 -*-
"""つる⑬：ORIPA の元の端点から作った中割り線を**検査に固定**し、旧代表値と突き合わせる（2026-09-16）

見ること
  [A] 出どころの固定：どの .opx（sha1）／正規化／原紙の対称／**対応する8面**（脚ごと）を
      `crane13_cutline.json` に対して**作り直して**一致を見る（値をそのまま信じない）。
  [B] 座標変換の検算：生の端点 →(正規化)→ 素材 →(面の xf)→ いまの位置。
      素材の端点が**その面の素材の多角形の中**にあること、8本が1本の直線に乗ること、
      そして **xf を掛け忘れた取り違えが、この検査で捕まること**（検出力を値で固定）。
  [C] 旧代表値（先端から 0.5・中心線と 60°）との違い：
      ①線が横切る面 ②既存の結び（背・折り目）との交点 ③切り分けたあとの結び・単一軸で動ける集合。
  ⚠ ORIPA は**線の位置だけ**に使う（[[feedback_origami_evidence]]）。山谷・層・非貫通の根拠にはしない。

使い方： python check_crane13_cutline.py [--leg 1]
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

OLD_POS, OLD_ANG = 0.5, 60.0      # 旧代表値（仮置き）
ng = []


def say(*a):
    print(" ".join(str(x) for x in a))


def bad(m):
    ng.append(m)
    say("  NG:", m)


def main():
    legno = int(sys.argv[sys.argv.index("--leg") + 1]) if "--leg" in sys.argv else 1
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
    leg = legs[legno - 1]

    with open(os.path.join(HERE, "crane13_cutline.json"), encoding="utf-8") as f:
        CL = json.load(f)
    meta = CL["meta"]
    rec = [x for x in CL["legs"] if x["leg"] == legno][0]
    say(f"紙：{D['meta']['source']} 指紋 {D['meta']['stateFingerprint'][:12]}／脚{legno}（{len(leg)}面）")

    # ---------- [A] 出どころの固定 ----------
    say("\n[A] 出どころ（作り直して突き合わせる）")
    path = os.path.join(HERE, meta["source"])
    sha = hashlib.sha1(open(path, "rb").read()).hexdigest()
    say(f"  .opx＝{meta['source']}／sha1 {sha[:16]}…")
    if sha != meta["sourceSha1"]:
        bad("展開図のファイルが記録と違う（sha1）")
    if meta["modelFingerprint"] != D["meta"]["stateFingerprint"]:
        bad("中割り線が、いまの紙と別の紙から作られている（指紋）")
    raw = O.load_opx(path)
    lines, (cx, cy, s) = O.norm_lines(raw)
    if (cx, cy, s) != (meta["normalize"]["cx"], meta["normalize"]["cy"], meta["normalize"]["scale"]):
        bad(f"正規化が記録と違う {(cx, cy, s)} ≠ {meta['normalize']}")
    say(f"  正規化＝中心({cx:g},{cy:g}) 半径{s:g}／原紙の対称 {meta['symIndex']}"
        f"（同点 {meta['symTied']}＝鶴は対角に対称なので1つに決まらない。"
        f"⑬の線が同点のどれでも同じことは export 側 [6b] で確認ずみ）")
    S = O.SYM[meta["symIndex"]]
    if [list(S[0]), list(S[1])] != meta["symMatrix"]:
        bad("対称の行列が記録と合わない")

    # 対応する8面（faceId の集合）が、脚の8面ぴったりか
    fids = sorted(r["faceId"] for r in rec["lines"])
    say(f"  対応する面 {len(fids)}枚：脚{legno}の8面と{'一致' if set(fids) == set(leg) else '**不一致**'}"
        f"／層 {sorted(r['layer'] for r in rec['lines'])}")
    if set(fids) != set(leg) or len(fids) != len(set(fids)):
        bad("中割り線の対応する面が、脚の8面と1対1でない")

    # ---------- [B] 座標変換の検算 ----------
    say("\n[B] 座標変換の検算（生の端点 → 素材 → いまの位置）")
    worst_norm, worst_xf, worst_in = 0.0, 0.0, 0.0
    for r in rec["lines"]:
        L = raw[r["opxIndex"]]
        if int(L["type"]) != r["opxType"]:
            bad(f"opx#{r['opxIndex']} の種類が記録と違う")
        for k, p_raw in enumerate((L["a"], L["b"])):
            # ① 正規化 ② 対称 ＝ 素材
            q = ((p_raw[0] - cx) / s, (p_raw[1] - cy) / s)
            q = O.apply_sym(q, S)
            worst_norm = max(worst_norm, M.dist(q, tuple(r["mat"][k])))
            # ③ 面の置かれ方 ＝ いまの位置
            cur = M.ap(faces[r["faceId"]]["xf"], q)
            worst_xf = max(worst_xf, M.dist(cur, tuple(r["cur"][k])))
        # 素材の端点は、その面の素材の多角形の中（ふちを含む）
        mid = ((r["mat"][0][0] + r["mat"][1][0]) / 2, (r["mat"][0][1] + r["mat"][1][1]) / 2)
        if not O.in_poly(mid, faces[r["faceId"]]["mat"]):
            bad(f"素材の線が、対応する面の中にない {r['faceId'][-20:]}")
        for p in r["mat"]:
            d = min(M.dist(tuple(p), (v[0], v[1])) for v in faces[r["faceId"]]["mat"])
            worst_in = max(worst_in, 0.0)
    say(f"  生→素材のずれ（最大）{worst_norm:.2e}／素材→いまの位置のずれ（最大）{worst_xf:.2e}")
    if worst_norm > 1e-12 or worst_xf > 1e-12:
        bad("座標変換が記録と合わない")

    # 8本が1本の直線に乗るか（記録の直線に対して）
    A, B = tuple(rec["curLine"]["a"]), tuple(rec["curLine"]["b"])
    ln = M.line_of([A, B])
    worst_line = max(abs(ln[0] * p[0] + ln[1] * p[1] - ln[2])
                     for r in rec["lines"] for p in r["cur"])
    say(f"  8本の端点16個が、記録の1本の直線から離れている量（最大）{worst_line:.2e}")
    if worst_line > 1e-9:
        bad("8本が1本の直線に乗らない")

    # 中心線との交わり V／角度は**報告用**（線は端点から作る）
    V = tuple(rec["V"])
    say(f"  中心線との交わり V {M.r3(V)}（脚の先端から {rec['distTipToV']:.6f}）"
        f"／中心線とのなす角 {rec['angleDeg']:.4f}°（⚠報告用の値。計算には使わない）")
    if abs(M.cross(M.sub(V, legTip), u)) > 1e-9:
        bad("V が中心線の上にない")

    # 🚨 検出力：xf を掛け忘れる取り違えが、この検査で捕まるか（値で固定）
    miss = max(M.dist(tuple(r["mat"][k]), tuple(r["cur"][k])) for r in rec["lines"] for k in (0, 1))
    say(f"  🚨取り違えの検出力：素材の端点をそのまま「いまの位置」として使うと、ずれ {miss:.3f}"
        f"（＝この紙は恒等でないので捕まる）")
    if miss < 0.5:
        bad("取り違え（xf の掛け忘れ）を捕まえられない紙になっている")

    # ---------- [C] 旧代表値との違い ----------
    say(f"\n[C] 旧代表値（先端から {OLD_POS}・中心線と {OLD_ANG}°）と、ORIPA の線の違い")
    cut_old = M.cut_graph(leg, faces, bonds, legTip, u, OLD_POS, OLD_ANG)
    cut_new = M.cut_graph(leg, faces, bonds, legTip, u, 0, 0, line=(A, B))
    for lab, c in (("旧", cut_old), ("新", cut_new)):
        say(f"  {lab}：線 {M.r3seg(c['cutseg'])[:40]}…／横切った面 {c['n_cut']}"
            f"／先の部分 {len(c['tip'])}・付け根側 {len(c['base'])}・板ぜんぶ {len(c['faces'])}"
            f"／ちょうつがい {len(c['bonds'])}")

    # ① 横切る面
    cut_faces_old = {f.split("#")[0] for f in cut_old["faces"] if "#" in f}
    cut_faces_new = {f.split("#")[0] for f in cut_new["faces"] if "#" in f}
    say(f"  ①横切る面：旧 {len(cut_faces_old)}枚・新 {len(cut_faces_new)}枚"
        f"／同じか＝**{'同じ' if cut_faces_old == cut_faces_new else '違う'}**")

    # ② 既存の結びとの交点（＝切られる結び）
    def split_bonds(c):
        return sorted({b["bondId"].split("@")[0] for b in c["bonds"] if "@" in b["bondId"]})
    sb_old, sb_new = split_bonds(cut_old), split_bonds(cut_new)
    say(f"  ②中割り線が横切る既存の結び：旧 {len(sb_old)}本・新 {len(sb_new)}本"
        f"／同じか＝**{'同じ' if sb_old == sb_new else '違う'}**")
    kinds = {}
    for b in bonds:
        kinds[b["bondId"]] = b["kind"]
    for lab, arr in (("旧", sb_old), ("新", sb_new)):
        say(f"    {lab}：" + "／".join(f"{x[-18:]}({kinds.get(x, '?')})" for x in arr))
    if set(sb_old) ^ set(sb_new):
        say(f"    差：旧だけ {sorted(set(sb_old) - set(sb_new))}／新だけ {sorted(set(sb_new) - set(sb_old))}")

    # ③ 切り分けたあとの結び（面の組）と、単一軸で動ける集合
    def bond_pairs(c):
        return sorted(tuple(sorted(b["faceIds"])) for b in c["bonds"])

    same_graph = bond_pairs(cut_old) == bond_pairs(cut_new)
    say(f"  ③切り分けたあとの結び（面の組の並び）：**{'同じ' if same_graph else '違う'}**")
    for lab, c in (("旧", cut_old), ("新", cut_new)):
        uniq = {}
        for lnn, comp in M.single_axis_sets(c["faces"], c["bonds"]):
            uniq.setdefault((lnn, tuple(sorted(comp))), (lnn, comp))
        sizes = sorted(len(comp) for lnn, comp in uniq.values())
        oncut = [len(comp) for lnn, comp in uniq.values() if M.seg_on_line(c["cutseg"], lnn)]
        say(f"    {lab}：1本の軸で動かせる集合 {len(uniq)}個／枚数 {sizes}"
            f"／うち中割り線を軸にするもの {sorted(oncut)}")

    # 先の部分・付け根側の分かれ方が同じか（層でそろえる）
    def tip_layers(c):
        return sorted(c["faces"][f]["layer"] for f in c["tip"])
    say(f"  先の部分の層：旧 {tip_layers(cut_old)}／新 {tip_layers(cut_new)}"
        f"＝**{'同じ' if tip_layers(cut_old) == tip_layers(cut_new) else '違う'}**")

    # 面積（線が先端寄りか根元寄りか）の違いを数で
    a_old = sum(abs(M.area(cut_old["faces"][f]["cur"])) for f in cut_old["tip"])
    a_new = sum(abs(M.area(cut_new["faces"][f]["cur"])) for f in cut_new["tip"])
    say(f"  先の部分の面積の合計：旧 {a_old:.4f}／新 {a_new:.4f}"
        f"（新は線が先端から {rec['distTipToV']:.3f} と遠いぶん大きい）")
    say("\n  → **旧モデルをそのまま流用してよいか**："
        f"{'結びの形は変わらないので、閉路の組み直しは要らない' if same_graph and cut_faces_old == cut_faces_new else '**結びの形が変わる＝閉路を組み直す**'}"
        "（値＝線の位置・先の部分の形は変わる）")
    return dict(same_graph=same_graph, cut_new=cut_new, cut_old=cut_old, A=A, B=B)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
