# -*- coding: utf-8 -*-
"""つる⑬：背（層-2|層-1）を含む模型で、終端の目標が整合するか（静的・運動は探さない・2026-09-17）

目標は `check_crane13_terminal_stacks.py` が点検した規則で決めたもの（crane13_terminal_target.json）。
模型ごとに、その模型の面だけで同じ規則（重なる組だけ・各点で1本の並び・線分の所だけ・動かない紙は stackAt）で数え直し、
  ① 全体の目標を模型に制限したものが、模型の解の中にあるか
  ② ⑬の条件 (c)（先を含む点で、先がその点の元のあいだ）で模型の解が1つに決まるか・それが①と同じか
  ③ 終端の静的な量：位置・表裏・上下・畳まれた結びで「b は a の表の側か裏の側か」（出発から入れかわるか）
を見る。累積回転（0°/±360°）は経路の量なので条件にしない。

模型
  SP2：背をはさむ2層（層-2・層-1）＝板4枚・曲がり角1つ（背）
  SP4：背をはさむ4層（層-19・-2・-1・3）＝板8枚・曲がり角3つ（外形の側・背・外形の側）
  ⚠ どちらも胴・ほかの層を省いた模型。
使い方： PYTHONHASHSEED=0 python check_crane13_spine_target.py
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("PYTHONHASHSEED") != "0":
    print("ABORT: PYTHONHASHSEED=0 で回すこと")
    sys.exit(2)
_s = importlib.util.spec_from_file_location("ts", os.path.join(HERE, "check_crane13_terminal_stacks.py"))
TS = importlib.util.module_from_spec(_s)
_s.loader.exec_module(TS)
ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def main():
    D, cut, P, BB, cutseg = TS.build_input()
    TS.PP.update(P)
    T = json.load(open(os.path.join(HERE, "crane13_terminal_target.json"), encoding="utf-8"))
    TS.NAMES.update(T["names"])
    above = {(a, b): r for a, b, r in T["above"]}
    leg = [f for f in P if P[f]["leg"]]
    bylayer = {}
    for f in leg:
        bylayer.setdefault(P[f]["layer"], []).append(f)
    say(f"目標 crane13_terminal_target.json（{T['condition']}）")
    for tag, layers in (("SP2 背をはさむ2層", (-2, -1)), ("SP4 背をはさむ4層", (-19, -2, -1, 3))):
        col = sorted(f for L in layers for f in bylayer[L])
        say(f"\n==== {tag}：{'／'.join(TS.short(f) for f in col)} ====　⚠胴・ほかの層なし")
        rel, conflict, missing = TS.start_relations(D, P, col)
        TS.START.clear()
        TS.START.update(rel)
        rel_fixed = {k: v for k, v in rel.items() if not P[k[0]]["moves"] and not P[k[1]]["moves"]}
        say(f"  出発の上下（stackAt）：{len(rel)}組（食い違い {len(conflict)}・点に無い {len(missing)}）")
        X, hard, groups, cover = TS.new_model(P, BB, set(col), rel_fixed)
        kinds = {}
        for g, _ in groups:
            kinds[g[0]] = kinds.get(g[0], 0) + 1
        free = [v for (a, b), v in X.v.items() if P[a]["moves"] or P[b]["moves"]]
        ok, sols = TS.solve_groups(len(X.v), hard, groups, want_count=100000, project=free)
        if not ok:
            bad(f"{tag}：解なし（最小の矛盾 {sols}）")
            continue
        restricted = {v: (above[(a, b)] > 0) for (a, b), v in X.v.items() if v in free}
        in_sols = any(all(s[v] == restricted[v] for v in free) for s in sols)
        inside = [s for s in sols if TS.inside_ok(s, X, cover)]
        say(f"  重なる組 {len(X.v)}・条件 {kinds}")
        say(f"  ① 解 {len(sols)} 通り／全体の目標を制限したものが解の中に {'ある' if in_sols else '**無い**'}")
        uniq = len(inside) == 1 and all(inside[0][v] == restricted[v] for v in free)
        say(f"  ② (c) を満たす解 {len(inside)} 通り／{'1つに決まり、全体の目標と同じ' if uniq else '**全体の目標と一致しない**'}")
        if not in_sols or not uniq:
            bad(f"{tag}：目標が整合しない")
        # ③ 静的な量
        say("  ③ 終端（全体の目標から）：")
        for f in col:
            say(f"     {TS.short(f):>6}：{'⑬の線で鏡' if P[f]['moves'] else '動かない'}・表裏 {'表' if P[f]['side0'] > 0 else '裏'}上→{'表' if P[f]['side1'] > 0 else '裏'}上")
        order = sorted(col, key=lambda f: sum(1 for g in col if g != f and ((g, f) in above and above[(g, f)] > 0 or (f, g) in above and above[(f, g)] < 0)))
        say("     上下（全部が重なる所で、下→上）：" + "／".join(TS.short(f) for f in order))
        for b in T["bonds"]:
            if b["a"] in col and b["b"] in col:
                ch = "" if b["front0"] is None else ("　**出発から入れかわる**" if b["front0"] != b["front1"] else "　出発と同じ")
                say(f"     結び {TS.short(b['a'])}|{TS.short(b['b'])}（{b['kind']}{'・⑬' if b['bond'].startswith('cut:') else ''}）："
                    f"b は a の{'表' if b['front1'] > 0 else '裏'}の側{'' if b['front0'] is None else '（出発 ' + ('表' if b['front0'] > 0 else '裏') + '）'}{ch}")
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))


if __name__ == "__main__":
    main()
