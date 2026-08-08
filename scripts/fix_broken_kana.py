# -*- coding: utf-8 -*-
"""熟語を1字ずつ開いてこわれた語を、学年に関係なく直す（2026-08-08）。

`scripts/fix_low_grade_kanji.py` は**小1・小2だけ**が対象なので、
小3以上に残ったこわれた語（気からだ／品たね／球ね／なつ至…）が直らなかった。
ここでは data/*.json 全部・全学年に対して REPAIR を当てる。

★直す語の表は `yomi_map_low_grade.py` の REPAIR をそのまま使う。
  基準を2つ持つと必ず食いちがう（今日それで帯分数を誤判定した）。

★安全のため
  - 置きかえるのは REPAIR に載っている**日本語としてありえない文字列**だけ
    （「いうと」「すくし」のような ふつうの語は REPAIR に入れていない）
  - 直したあと、答えが選択肢に入っているかを必ず見る

  python scripts/fix_broken_kana.py          … 何が変わるか見るだけ
  python scripts/fix_broken_kana.py --write  … 書きこむ
"""
import io, json, os, sys, glob

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from yomi_map_low_grade import REPAIR          # noqa: E402

DATA = os.path.join(os.path.dirname(HERE), "data")
# 「こわれた語」だけを対象にする（ふつうの日本語にも出る文字列は当てない）
ONLY = {"かぜふね", "気からだ", "固からだ", "液からだ", "品たね", "球ね",
        "主ね", "側ね", "支ね", "なつ至", "ふゆ至", "はる分", "あき分"}
PAIRS = [(a, b) for a, b in REPAIR if a in ONLY]

FIELDS = ("question", "answer", "meaning")


def fix_text(s):
    if not isinstance(s, str):
        return s, []
    hits = []
    for bad, good in PAIRS:
        if bad in s:
            s = s.replace(bad, good)
            hits.append(bad)
    return s, hits


def walk(node, out):
    """問題らしいところの question/answer/choices/meaning を直す"""
    if isinstance(node, list):
        for v in node:
            walk(v, out)
    elif isinstance(node, dict):
        touched = []
        for k in FIELDS:
            if k in node:
                new, hits = fix_text(node[k])
                if hits:
                    node[k] = new
                    touched += hits
        if isinstance(node.get("choices"), list):
            for i, c in enumerate(node["choices"]):
                new, hits = fix_text(c)
                if hits:
                    node["choices"][i] = new
                    touched += hits
        if touched:
            out.append((node.get("id"), sorted(set(touched)), node))
        for v in node.values():
            walk(v, out)


def main():
    total, bad = 0, []
    for path in sorted(glob.glob(os.path.join(DATA, "*.json"))):
        data = json.load(io.open(path, encoding="utf-8"))
        out = []
        walk(data, out)
        if not out:
            continue
        name = os.path.basename(path)
        print("── %s（%d問）" % (name, len(out)))
        for qid, words, node in out:
            print("   %-10s %s" % (qid, "／".join(words)))
            print("      Q: %s" % str(node.get("question", ""))[:70])
            print("      A: %r" % node.get("answer"))
            # 直したあと、答えが選択肢に入っているか
            ch = node.get("choices")
            if isinstance(ch, list) and ch and node.get("answer") not in ch:
                bad.append("%s：答えが選択肢に無い" % qid)
            if isinstance(ch, list) and len(set(map(str, ch))) != len(ch):
                bad.append("%s：選択肢が重複" % qid)
        total += len(out)
        print()
        if "--write" in sys.argv:
            with io.open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            json.load(io.open(path, encoding="utf-8"))

    print("直した問題：%d問" % total)
    for b in bad:
        print("  ✗ " + b)
    if bad:
        print("✗ 直したあとに おかしくなっている。確認すること")
        sys.exit(1)
    print("✓ 書きこんだ" if "--write" in sys.argv else "（--write で書きこむ）")


if __name__ == "__main__":
    main()
