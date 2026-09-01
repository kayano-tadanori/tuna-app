# -*- coding: utf-8 -*-
"""生成した大問が「原簿とちがうもの」になっていないかを機械で洗う（書きこむ前に必ず実行）。

見るのは6つ。
 ① 答えが設問の中にそのまま書いてある（答えを見せている）
 ② 答えが原簿の答えの中に見あたらない（＝すり替わった疑い）
 ③ 同じ設問・同じ答えのstepが1つの大問に2つ以上ある
 ④ 設問が短すぎる／空
 ⑤ 解説が空・短すぎる
 ⑥ choicesがあるのに answer がその中に無い
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import s5s12_parse as P
import s5s12_add as A


def squash(s):
    s = (s or "").replace("あまり", "余り").replace("，", ",").replace("、", ",")
    return re.sub(r"[\s\u3000,.．。]", "", s)


def main():
    bad = {k: [] for k in "①②③④⑤⑥⑦"}
    n = 0
    for r in sorted(P.all_parsed(), key=lambda x: (x["kouza"], x["no"], x["dai"])):
        if "⚠" in r["tail"] or not P.ready(r):
            continue
        q, why = A.build_one(r)
        if q is None:
            continue
        n += 1
        ans_all = squash(r["ans"])
        seen = set()
        for st in q["steps"]:
            a, qq = st["answer"], st["question"]
            # ① 答えが設問に書いてある（数字だけの答えは、単位や文脈で自然に出るので長いものだけ見る）
            tok = re.compile("(?<![0-9.])" + re.escape(a) + "(?![0-9.])")
            if len(a) >= 2 and tok.search(qq) and not st.get("choices"):
                # 「(1) 12＋18×15 → 282」のような計算問題は、式の中に答えが出ることはない。
                # 見つかったら本当に見せている
                bad["①"].append((r["hg"], a, qq[:60]))
            # ② 答えが原簿の答えに見あたらない
            key = squash(a)
            if key and key not in ans_all and not st.get("choices"):
                bad["②"].append((r["hg"], a, r["ans"][:60]))
            # ③ 同じstepの重複
            sig = (qq, a)
            if sig in seen:
                bad["③"].append((r["hg"], a, qq[:60]))
            seen.add(sig)
            # ④ 設問
            if len(qq.strip()) < 8:
                bad["④"].append((r["hg"], a, qq))
            # ⑤ 解説
            if len((st.get("meaning") or "").strip()) < 6:
                bad["⑤"].append((r["hg"], a, st.get("meaning", "")))
            # ⑥ choices
            if st.get("choices") and a not in st["choices"]:
                bad["⑥"].append((r["hg"], a, " / ".join(st["choices"])))
        # ⑦ 解説が「(1) …(2) …」のまま＝ほかの小問の答えを配っている
        for st in q["steps"]:
            m = re.findall(r"(?<![0-9])[（(](\d{1,2})[）)]", st.get("meaning", ""))
            if len(set(m)) >= 2:
                bad["⑦"].append((r["hg"], st["answer"], st["meaning"][:60]))
                break
    names = {"①": "答えが設問の中に見えている", "②": "答えが原簿の答えに見あたらない",
             "③": "同じstepの重複", "④": "設問が短い／空", "⑤": "解説が空・短い",
             "⑥": "choicesにanswerが無い",
             "⑦": "解説がほかの小問の分もふくんでいる"}
    print("見た大問: %d本" % n)
    ng = 0
    for k in "①②③④⑤⑥⑦":
        v = bad[k]
        ng += len(v)
        print("\n%s %s : %d件" % (k, names[k], len(v)))
        for hg, a, ctx in v[:25]:
            print("    %s  答[%s]  %s" % (hg, a, ctx))
        if len(v) > 25:
            print("    …ほか %d件" % (len(v) - 25))
    return 1 if ng else 0


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.exit(main())
