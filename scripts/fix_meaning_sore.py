# -*- coding: utf-8 -*-
"""解説の結びが「よって、答えはそれです。」のままになっていたのを直す（2026-08-08）。

`scripts/audit_questions.js` が見つけた。作るときのひな型が残ったもので、
**答えが何なのか解説を読んでも分からない**状態だった。

  rchain23#3  ①直列（1つの輪）では電流はどこも同じ。②「回路のどこでも同じ大きさ」です。
              よって、答えはそれです。            → 「よって、答えは回路のどこでも同じ大きさです。」
  rchain24#3  同じ形

★「よって、答えはこれです／上です／前です」は 全部で11件あったが、
  9件は**答えが本当に「これ」「上」「前」**（こそあどことば・慣用句・四字熟語）なので直さない。
  直すのは、答えが指示語でないのに指示語で結んでいる2件だけ。

  python scripts/fix_meaning_sore.py          … 何が変わるか見るだけ
  python scripts/fix_meaning_sore.py --write  … 書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "data", "rika_chain.json")

TARGETS = {("rchain23", 3), ("rchain24", 3)}
OLD = "よって、答えはそれです。"


def main():
    data = json.load(io.open(F, encoding="utf-8"))
    done, already = [], []

    def visit(o):
        if isinstance(o, list):
            for v in o:
                visit(v)
        elif isinstance(o, dict):
            for i, st in enumerate(o.get("steps") or [], 1):
                if (o.get("id"), i) not in TARGETS:
                    continue
                m = str(st.get("meaning", ""))
                ans = st.get("answer")
                new = "よって、答えは%sです。" % ans
                if new in m:
                    already.append("%s#%d" % (o["id"], i)); continue
                if OLD not in m:
                    continue
                st["meaning"] = m.replace(OLD, new)
                done.append(("%s#%d" % (o["id"], i), m[-40:], st["meaning"][-40:]))
            for v in o.values():
                visit(v)

    visit(data)
    for i, before, after in done:
        print("■ %s" % i)
        print("   前: …%s" % before)
        print("   後: …%s" % after)
    for i in already:
        print("  %s はすでに直っていた" % i)
    print()
    print("直した：%d件／すでに直っていた：%d件" % (len(done), len(already)))
    if not done:
        return
    if "--write" in sys.argv:
        with io.open(F, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        json.load(io.open(F, encoding="utf-8"))
        print("✓ 書きこんだ → %s" % F)
    else:
        print("（--write で書きこむ）")


if __name__ == "__main__":
    main()
