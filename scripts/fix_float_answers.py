# -*- coding: utf-8 -*-
"""小数の計算誤差がそのまま答えになっていた問題を直す（2026-08-08）。

`scripts/audit_questions.js` が見つけた。作ったときに JavaScript の小数計算の結果を
そのまま書いてしまったもの。

★jt232 がとくに悪い：
    answer : '110.00000000000001'
    choices: ['110.00000000000001', '90', '110', '145']
  **正しい「110」が選択肢の中にあるのに、答えは誤差つきのほう**。
  つまり正解らしく見えるほうを選んだ子が不正解になる。

  jt232 … 200×0.55＝110。誤差つきの選択肢を、％をmLと取りちがえる誤答「55」に差しかえる
           （3択にならないように。答えは選択肢の '110' をそのまま使う）
  jt241 … 500×0.0396＝19.8。誤差つきを '19.8' に直すだけ（重複しない）

  python scripts/fix_float_answers.py          … 何が変わるか見るだけ
  python scripts/fix_float_answers.py --write  … 書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "data", "rika_jintai.json")

FIXES = {
    "jt232": {
        "answer": "110",
        # 誤差つきを消し、％をそのままmLと読みちがえる誤答に差しかえる
        "choices": ["55", "90", "110", "145"],
    },
    "jt241": {
        "answer": "19.8",
        # 25＝酸素の減少5%と取りちがえ／20＝3.96%を4%に丸め／5＝%をそのまま
        "choices": ["19.8", "25", "20", "5"],
    },
}


def main():
    data = json.load(io.open(F, encoding="utf-8"))
    done, already, bad = [], [], []
    for q in data:
        fix = FIXES.get(q.get("id"))
        if not fix:
            continue
        if q["answer"] == fix["answer"] and q.get("choices") == fix["choices"]:
            already.append(q["id"]); continue
        if fix["answer"] not in fix["choices"]:
            bad.append("%s：答えが選択肢に無い" % q["id"]); continue
        if len(set(fix["choices"])) != len(fix["choices"]):
            bad.append("%s：選択肢が重複している" % q["id"]); continue
        print("■ %s" % q["id"])
        print("   設問 :", q["question"][:70])
        print("   答え : %r → %r" % (q["answer"], fix["answer"]))
        print("   選択肢: %s" % q.get("choices"))
        print("        → %s" % fix["choices"])
        print("   解説 :", q.get("meaning", "")[:70])
        q["answer"] = fix["answer"]
        q["choices"] = list(fix["choices"])
        done.append(q["id"])
        print()

    for i in already:
        print("  %s はすでに直っていた" % i)
    for b in bad:
        print("  ✗ " + b)
    print("直した：%d件／すでに直っていた：%d件／おかしい：%d件" % (len(done), len(already), len(bad)))
    if bad:
        sys.exit(1)
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
