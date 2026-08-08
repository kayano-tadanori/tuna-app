# -*- coding: utf-8 -*-
"""最レ国語 No.2「漢字の成り立ち」8問の問題文を、原簿どおり漢字を問う形に直す。

★見つかり方：`node scripts/audit_questions.js` が「同じ問題が2回ある」と3件出した。
  だが原簿 HG-2545 を見ると **重複ではなかった**。

  原簿【枠1・漢字の成り立ち】
    次の①〜⑧の漢字のでき方をア〜エから選び記号で答える
    ①森 ②末 ③山 ④絵 ⑤中 ⑥岩 ⑦鳥 ⑧管 → 答え ①ウ ②イ ③ア ④エ ⑤イ ⑥ウ ⑦ア ⑧エ

  つまり **問うているのは漢字のほう**。ところが生成された問題文は
  「「ウ」のでき方は？」＝**答えの記号を問題文に入れてしまっていた**。
  ・ウ は「会意文字」という分類の記号で、それ自体に「でき方」は無い＝日本語として成り立たない
  ・記号は8問中4種類しか無いので、①森 と ⑥岩 が字面で同じ問題になってしまう
  → 漢字を入れれば8問とも別問題になり、原簿の問い方にも合う。**消さずに直せる**

  ついでに ks5_02_r08 の「エ**」＝太字の記号が漏れていたのも消える。

  python scripts/fix_ks5_naritachi.py          … 何が変わるか見るだけ
  python scripts/fix_ks5_naritachi.py --write  … 直す
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "kokugo_sairei5.json")

# id → (原簿の番号, 漢字, 期待する答え)。答えが合わないものは直さない＝取りちがえの歯止め
PLAN = {
    "ks5_02_r01": ("①", "森", "会意文字"),
    "ks5_02_r02": ("②", "末", "指事文字"),
    "ks5_02_r03": ("③", "山", "象形文字"),
    "ks5_02_r04": ("④", "絵", "形声文字"),
    "ks5_02_r05": ("⑤", "中", "指事文字"),
    "ks5_02_r06": ("⑥", "岩", "会意文字"),
    "ks5_02_r07": ("⑦", "鳥", "象形文字"),
    "ks5_02_r08": ("⑧", "管", "形声文字"),
}


def main():
    data = json.load(io.open(SRC, encoding="utf-8"))
    rows = data if isinstance(data, list) else data.get("items", [])
    done, skip, bad = [], [], []
    for q in rows:
        qid = q.get("id")
        if qid not in PLAN:
            continue
        no, kanji, want = PLAN[qid]
        neu = "「%s」のでき方は？" % kanji
        if q.get("answer") != want:
            bad.append("%s：答えが「%s」のはずが「%s」。並びがずれている可能性があるので直さない"
                       % (qid, want, q.get("answer")))
            continue
        if q.get("question") == neu:
            skip.append("%s（すでに直っている）" % qid)
            continue
        done.append("%s %s  「%s」→「%s」" % (qid, no, q.get("question"), neu))
        q["question"] = neu

    print("直すもの %d件／触らないもの %d件" % (len(done), len(skip)))
    for m in done:
        print("  ✓ " + m)
    for m in skip:
        print("  ・ " + m)
    for m in bad:
        print("  ✗ " + m)
    if bad:
        print("\n✗ 取りちがえの疑いがあるので書きこまない")
        sys.exit(1)

    if "--write" not in sys.argv:
        print("\n（--write で書きこむ）")
        return
    if not done:
        print("\n直すものが無いので書きこまない")
        return
    with io.open(SRC, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    json.load(io.open(SRC, encoding="utf-8"))
    print("\n✓ 書きこんだ → data/kokugo_sairei5.json")


if __name__ == "__main__":
    main()
