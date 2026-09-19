# -*- coding: utf-8 -*-
"""つる⑬：段2（折り出し）の**枝を総当り**して、中割りの層順に着く枝があるか探す（2026-09-16）

本人の許可（2026-09-16「もう少し大きな探索にしてもいい」）で、第7段の「1回の比較実験」から広げたもの。

何を総当りするか
  中割り線の角は8本。段2の**折り出しの向き**（各本を＋へ回すか−へ回すか）が枝を決める。
  全体の向きを反転したものは同じ道なので、1本目を＋に固定して **2⁷＝128通り**。
  ＝「枝の選び方」については**もれなく**調べる。

何を総当りしないか（＝この探索の外）
  ・中割り線の位置と角度（ORIPA の実寸に固定）
  ・段1で開く軸と開く角（既定のまま）
  ・しなり（曲面）・追加の折り目
  🚨 だから「128通りぜんぶ外れ」でも**幾何的に不可能とは言えない**。言えるのは
     「この線・この開き方・この追い方では、枝の選び方をぜんぶ試しても中割りの層順に着かない」まで。

作り：段1（開く）は枝に関係ないので**1回だけ**追って使い回す。段2・段3は枝ごと。
     結果は1件ごとに `search_crane13_branch/` の tsv へ追記（途中で止めても読める）。

使い方： PYTHONHASHSEED=0 python search_crane13_branch.py [--limit N] [--old] [--shard i/n]
  結果は search_crane13_branch/shard{i}of{n}.tsv（1件ごとに追記）
終了コード： 0=ok ／ 2=異常終了
"""
import importlib.util
import itertools
import math
import os
import sys
import time
import traceback

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("crane13_path", os.path.join(HERE, "check_crane13_path.py"))
P = importlib.util.module_from_spec(_s)
_s.loader.exec_module(P)
sys.argv = _argv
MO = P.MO
OUT_DIR = os.path.join(HERE, "search_crane13_branch")


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def main():
    limit = int(_argv[_argv.index("--limit") + 1]) if "--limit" in _argv else 128
    use_oripa = "--old" not in _argv
    rounds = int(_argv[_argv.index("--close-rounds") + 1]) if "--close-rounds" in _argv else 40
    P.CLOSE_ROUNDS = rounds
    # --shard i/n：枝の並び（PYTHONHASHSEED 固定で毎回同じ）の k 番目のうち k%n==i だけを受け持つ
    shard = _argv[_argv.index("--shard") + 1] if "--shard" in _argv else "0/1"
    si, sn = (int(v) for v in shard.split("/"))
    os.makedirs(OUT_DIR, exist_ok=True)
    OUT = os.path.join(OUT_DIR, f"shard{si:02d}of{sn:02d}.tsv")

    D, faces_all, cut, leg, geo = P.real_cut(60.0, 0.5, oripa=use_oripa)
    say(f"中割り線の出どころ：{cut['source']}")
    say(f"段3（閉じ直し）のくり返し {rounds} 回／枝は最大 {limit} 通り"
        f"／PYTHONHASHSEED={os.environ.get('PYTHONHASHSEED', '(未設定＝実行ごとに揺れる)')}")

    mo, faces, bonds, tipset = P.model_M3(cut, geo[1])
    cv, ov = P.cut_vars(mo), P.other_vars(mo)
    say(f"板 {len(mo.ids)}・ちょうつがい {len(mo.bonds)}／中割り線の角 {len(cv)}本／ほかの角 {len(ov)}本")
    T_end = P.terminal_T(mo, tipset, cut["cutseg"])
    samp = P.sample_point(faces, tipset, T_end)

    # ---------- 段1（開く）は枝に関係ないので1回だけ ----------
    base_ids = {f"{fid}#base" for fid in leg}
    openers = [mo.var_of[k] for k in mo.tree_ids
               if mo.bonds[k]["faceIds"][0] in base_ids and mo.bonds[k]["faceIds"][1] in base_ids]
    x = np.zeros(len(mo.tree_ids))
    opener, x1, reach = None, None, 0.0
    cand = [v for v in openers if v in ov] + [v for v in ov if v not in openers]
    t0 = time.time()
    for v in cand:
        pts, st = P.follow(mo, x, v, 0.0, math.radians(P.OPEN_DEG), P.OPEN_STEPS)
        got = math.degrees(pts[-1]["v"]) if pts else 0.0
        if pts and got > reach:
            opener, x1, reach = v, (pts[-1]["x"] if st["stopped"] else st["x"]), got
        if not st["stopped"]:
            break
    if opener is None:
        say("段1（開く）が見つからない＝ここで終わり")
        return
    say(f"段1 開く：{reach:.0f}° まで（閉じの残り {np.linalg.norm(mo.residual(x1)):.1e}"
        f"／自由度 {P.dof_at(mo, x1)}／{time.time()-t0:.0f}秒）— これを128通りで使い回す")

    # ---------- 枝の並べ方（ねらいのある順に） ----------
    Rpi = MO.rot_about((cut["cutseg"][0][0], cut["cutseg"][0][1], 0),
                       (cut["cutseg"][1][0], cut["cutseg"][1][1], 0), math.pi)
    T_all = {fid: (Rpi if fid in cut["tip"] else np.eye(4)) for fid in cut["faces"]}
    st = MO.stack_feasibility(cut, T_all, Rpi, faces_all)
    targets = (st or {}).get("inside", [])
    say(f"[J] 中割りの層順 {len(targets)}通り → そこから作った折り出しの向きを先に試す")

    seen, order = set(), []

    def add(sig, why):
        key = tuple(int(np.sign(s)) for s in sig)
        if key[0] < 0:
            key = tuple(-k for k in key)            # 全体の反転は同じ道
        if key in seen:
            return
        seen.add(key)
        order.append((key, why))

    for i, tg in enumerate(targets):
        pat = P.target_pattern(mo, tipset, faces, tg)
        add([pat[c] for c in cv], f"層順{i+1}から")
    add([P.alternating_pattern(mo, tipset, cv)[c] for c in cv], "塗り分けから")
    say(f"  → 層順と塗り分けから出た、互いに違う枝は {len(order)}通り")
    for combo in itertools.product((1, -1), repeat=len(cv) - 1):
        add((1,) + combo, "総当り")
    say(f"  → 枝はぜんぶで {len(order)}通り（2^{len(cv)-1}＝{2**(len(cv)-1)}）")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("no\tなぜ試すか\t向き\t段2\t段3の残る開き\t全結び\t剛体性\t目標終端の座標\t層順\t秒\n")

    hits = []
    for n, (key, why) in enumerate(order[:limit], 1):
        if (n - 1) % sn != si:
            continue
        t0 = time.time()
        pat = np.zeros(len(mo.tree_ids))
        for c, s in zip(cv, key):
            pat[c] = s
        res = attempt(mo, faces, tipset, cv, ov, x1, pat, T_end, samp, rounds)
        sec = time.time() - t0
        row = [str(n), why, "".join("+" if s > 0 else "-" for s in key),
               res["s2"], f"{res['rest']:.2f}" if res["rest"] is not None else "-",
               f"{res['r1']:.1e}" if res["r1"] is not None else "-",
               f"{res['r2']:.1e}" if res["r2"] is not None else "-",
               f"{res['r3']:.2e}" if res["r3"] is not None else "-",
               res["lab"], f"{sec:.0f}"]
        with open(OUT, "a", encoding="utf-8") as f:
            f.write("\t".join(row) + "\n")
        mark = "  ★中割り" if res["inside"] else ""
        say(f"{n:4d}/{min(limit, len(order))} {row[2]} {why:10s} 段2:{res['s2']:14s}"
            f" ③{row[7]:>9s} 層順:{res['lab']}{mark}（{sec:.0f}秒）")
        if res["inside"]:
            hits.append((n, key))

    say(f"\n結果：中割りの層順に着いた枝 {len(hits)}通り／試した {min(limit, len(order))}通り"
        f"　→ {OUT}")
    if not hits:
        say("🚨 これは「枝の選び方では届かない」であって、**幾何的に不可能ではない**。"
            "線の位置・開く軸と角・しなり・追加の折り目は、この探索では動かしていない。")


def attempt(mo, faces, tipset, cv, ov, x1, pat, T_end, samp, rounds):
    """段2（折る）→段3（閉じ直す）→到達の判定。check_crane13_path.run の中の attempt と同じ手順。"""
    out = dict(s2="", rest=None, r1=None, r2=None, r3=None, lab="-", inside=None)
    goal = math.pi * (1 if pat[cv[0]] >= 0 else -1)

    def watch(xx, v):
        return dict(open=max(abs(MO.ang_of(xx[i])) for i in ov))

    pts2, st2 = P.follow(mo, x1, cv[0], 0.0, goal, P.STEPS2, watch=watch, prefer0=pat)
    if st2["stopped"]:
        out["s2"] = f"{st2['at']:.0f}°で折り返し"
        return out
    out["s2"] = "180°まで"
    x3, near = st2["x"], (pts2[-2]["x"] if len(pts2) >= 2 else st2["x"])
    for _ in range(rounds):
        big = max(ov, key=lambda i: abs(MO.ang_of(x3[i])))
        if abs(MO.ang_of(x3[big])) < 0.2:
            break
        pts3, st3 = P.follow(mo, x3, big, x3[big], 0.0, 12, pin=[cv[0]])
        if pts3:
            near = pts3[-2]["x"] if len(pts3) >= 2 else x3
            x3 = pts3[-1]["x"]
        if st3["stopped"]:
            break
    out["rest"] = max(abs(MO.ang_of(x3[i])) for i in ov)
    out["r1"] = float(np.linalg.norm(mo.residual(x3)))
    out["r2"] = P.rigid_error(mo, x3, faces)
    out["r3"] = P.gap_to(mo, x3, T_end, faces)
    if samp is not None:
        lab, inside = P.classify(P.heights(mo, near, faces, T_end, samp), tipset)
        out["lab"], out["inside"] = lab.replace("**", ""), inside
    return out


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 探索が例外で止まった")
        sys.exit(2)
