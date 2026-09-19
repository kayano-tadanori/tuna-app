# -*- coding: utf-8 -*-
"""つる⑬ 終端の層順の数え上げ：「90通り・中割り27」と「33通り・中割り1」の入力の違いを特定する（2026-09-17）

本人指示：運動の探索は止める。数え上げの入力・制約・コードの違いを特定し、入力を保存して同じ条件で再現できるようにする。
ここでは**既存の関数 `check_crane13_motion.stack_feasibility` をそのまま**呼び、入力（脚の面・⑬の線）だけを変える。
各条件の入力（面ID・⑬の線の2点・先/元の面ID）を `crane13_stack_inputs/<条件>.json` に保存し、
`--replay` でその保存した入力から数え直して同じ数になることを確かめる。

条件
  L1-仮   ：脚1の面・仮置きの線（先端から 0.5・中心線と 60°）
  L2-仮   ：脚2の面・仮置きの線
  L1-O1   ：脚1の面・ORIPA 脚1 の線（いまの既定＝--oripa）
  L2-O2   ：脚2の面・ORIPA 脚2 の線
  L1-O2   ：脚1の面・ORIPA 脚2 の線（脚の番号の取り違えを再現できるか）
  L2-O1   ：脚2の面・ORIPA 脚1 の線
使い方： PYTHONHASHSEED=0 python check_crane13_stack_repro.py [--replay]
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import math
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("motion", os.path.join(HERE, "check_crane13_motion.py"))
MOT = importlib.util.module_from_spec(_s)
_s.loader.exec_module(MOT)
sys.argv = _argv
M = MOT.M
OUT = os.path.join(HERE, "crane13_stack_inputs")
REPLAY = "--replay" in _argv


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def base_setup():
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
    return D, faces, bonds, legTip, u, legs


def count(cut, faces):
    A, B = cut["cutseg"]
    Rpi = MOT.rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    T_end = {fid: (Rpi if fid in cut["tip"] else np.eye(4)) for fid in cut["faces"]}
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        r = MOT.stack_feasibility(cut, T_end, Rpi, faces)
    txt = buf.getvalue()
    m = re.search(r"並べ方 (\d+)通り（調べた枝 (\d+)）", txt)
    other = re.search(r"重なるほかの紙 (\d+)枚", txt)
    return dict(sols=len(r["sols"]) if r else 0, inside=len(r["inside"]) if r else 0,
                outside=len(r["outside"]) if r else 0, tried=int(m.group(2)) if m else None,
                others=int(other.group(1)) if other else None)


def main():
    D, faces, bonds, legTip, u, legs = base_setup()
    fp = D["meta"]["stateFingerprint"]
    say(f"材料 crane13_input.json 指紋 {fp[:12]}…／脚の並び（tip_components）：脚1 {len(legs[0])}面・脚2 {len(legs[1])}面")
    cl = json.load(open(os.path.join(HERE, "crane13_cutline.json"), encoding="utf-8"))
    for lg in cl["legs"]:
        k = [i for i, c in enumerate(legs) if set(lg["faceIds"]) == set(c)]
        say(f"  crane13_cutline.json の脚{lg['leg']}：faceIds はいまの脚{[i + 1 for i in k]}と一致・線 a={np.round(lg['curLine']['a'], 6).tolist()} b={np.round(lg['curLine']['b'], 6).tolist()}")
    conds = []
    for legno in (1, 2):
        conds.append((f"L{legno}-仮", legno, None))
    for legno in (1, 2):
        for lineno in (1, 2):
            conds.append((f"L{legno}-O{lineno}", legno, lineno))
    os.makedirs(OUT, exist_ok=True)
    rows = []
    for tag, legno, lineno in conds:
        path = os.path.join(OUT, f"{tag}.json")
        if REPLAY:
            saved = json.load(open(path, encoding="utf-8"))
            if saved["fingerprint"] != fp:
                say(f"  {tag}：指紋が違う（保存 {saved['fingerprint'][:12]}）")
                continue
            comp = set(saved["legFaceIds"])
            line = saved["line"]
            try:
                cut = M.cut_graph(comp, faces, bonds, legTip, u, 0, 0, line=line)
            except RuntimeError as e:
                say(f"  {tag}：切れない（{e}）")
                continue
            got = count(cut, faces)
            same_tip = sorted(cut["tip"]) == saved["tip"] and sorted(cut["base"]) == saved["base"]
            ok = all(got[k] == saved["result"][k] for k in ("sols", "inside", "outside", "tried"))
            say(f"  {tag}：再生 {got['sols']}通り・中割り {got['inside']}・外へ {got['outside']}・枝 {got['tried']}"
                f"／保存 {saved['result']['sols']}・{saved['result']['inside']}／先と元の面 {'一致' if same_tip else '違う'}／{'再現' if ok and same_tip else '**再現しない**'}")
            continue
        comp = legs[legno - 1]
        try:
            if lineno is None:
                cut = M.cut_graph(comp, faces, bonds, legTip, u, 0.5, 60.0)
            else:
                line, rec, _ = M.oripa_cut_line(lineno, fp)
                cut = M.cut_graph(comp, faces, bonds, legTip, u, 0, 0, line=line)
        except RuntimeError as e:
            say(f"  {tag}：切れない（{e}）")
            rows.append((tag, None))
            continue
        got = count(cut, faces)
        A, B = cut["cutseg"]
        rec_ = dict(fingerprint=fp, condition=tag, legFaceIds=sorted(comp), line=[list(map(float, A)), list(map(float, B))],
                    lineSource=("仮置き（先端から 0.5・中心線と 60°）" if lineno is None else f"crane13_cutline.json 脚{lineno}"),
                    tip=sorted(cut["tip"]), base=sorted(cut["base"]), result=got,
                    code=dict(motion_sha1=hashlib.sha1(open(os.path.join(HERE, "check_crane13_motion.py"), "rb").read()).hexdigest()))
        json.dump(rec_, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        say(f"  {tag}：{got['sols']}通り・中割り {got['inside']}・外へ {got['outside']}・枝 {got['tried']}・着地に重なるほかの紙 {got['others']}枚"
            f"／線 A={np.round(A, 4).tolist()} B={np.round(B, 4).tolist()}")
        rows.append((tag, got))


if __name__ == "__main__":
    main()
