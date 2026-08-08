# -*- coding: utf-8 -*-
"""解説の結び「よって、答えは○○です。」が答えと食いちがっている5件を直す。

`node scripts/audit_questions.js` の④で出るもの。何度流しても同じ結果になる（idempotent）。

★2つの型があって、直す向きが逆になる。**どちらが正しいかを1件ずつ見てから決めた**
  (a) 解説の結びが答えを言いかえている／短くしている → **解説を答えに合わせる**
      子どもが選ぶもの（答え・選択肢）は1文字も動かさない
  (b) **答えのほうが壊れている** → **答えと選択肢を直す**
      rp624「養分が"み"に回り」＝ yomi_map_low_grade.py の単字 実→み が文脈を見ずに開いた。
      解説は「実に回り」と正しく書けていたので、解説が証拠になった
      （[[oton_quality_audit]] の型2「熟語を1字ずつ開いてこわれた語」と同じ）

  python scripts/fix_kaisetsu_ending.py          … 何が変わるか見るだけ
  python scripts/fix_kaisetsu_ending.py --write  … 直す
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (a) 解説の結びを答えに合わせる。 id → (ファイル, 結びの今, 結びのあるべき姿＝答えそのもの)
FIX_MEANING = {
    "rm149": ("rika_mono.json",
              "よって、答えは温度です。",
              "よって、答えはおんどです。"),
    "rm559": ("rika_mono.json",
              "よって、答えは水が 土を 動かす こと（しん食）です。",
              "よって、答えは水が 土を うごかす こと（しん食）です。"),
    "tk343": ("rika_tenki.json",
              "よって、答えはこもった熱のえいきょうをさけるためです。",
              "よって、答えはこもった 熱の えいきょうを さけ、まわりの 空気の 温度を はかるためです。"),
    "tk467": ("rika_tenki.json",
              "よって、答えは陸上の空気が上昇し、海から空気が流れこむです。",
              "よって、答えは陸上の 空気が あたためられて 上昇し、海から 空気が 流れこむです。"),
}

# (b) 答えのほうが壊れている。 id → (ファイル, 壊れた形, 正しい形)
FIX_ANSWER = {
    "rp624": ("rika_shokubutsu.json",
              "養分がみに回りやすくなり良くなることが多い",
              "養分が実に回りやすくなり良くなることが多い"),
}


def walk(o):
    """入れ子のどこにあっても、問題らしい辞書を拾う"""
    if isinstance(o, dict):
        if "id" in o and "answer" in o and "question" in o:
            yield o
        else:
            for v in o.values():
                for x in walk(v):
                    yield x
    elif isinstance(o, list):
        for v in o:
            for x in walk(v):
                yield x


def main():
    write = "--write" in sys.argv
    files, done, skip = {}, [], []
    for qid, (fn, old, new) in list(FIX_MEANING.items()) + list(FIX_ANSWER.items()):
        files.setdefault(fn, json.load(io.open(os.path.join(ROOT, "data", fn), encoding="utf-8")))

    for fn, data in files.items():
        for q in walk(data):
            qid = q.get("id")
            if qid in FIX_MEANING and FIX_MEANING[qid][0] == fn:
                _, old, new = FIX_MEANING[qid]
                key = "meaning" if q.get("meaning") else "explain"
                t = str(q.get(key) or "")
                if new in t:
                    skip.append("%s 解説（すでに直っている）" % qid)
                elif old in t:
                    q[key] = t.replace(old, new)
                    done.append("%s 解説の結び → 「%s」" % (qid, q["answer"]))
                else:
                    skip.append("%s 解説（想定した文が無い。手で見ること）" % qid)
            if qid in FIX_ANSWER and FIX_ANSWER[qid][0] == fn:
                _, old, new = FIX_ANSWER[qid]
                if q.get("answer") == new:
                    skip.append("%s 答え（すでに直っている）" % qid)
                elif q.get("answer") == old:
                    q["answer"] = new
                    q["choices"] = [new if c == old else c for c in (q.get("choices") or [])]
                    done.append("%s 答えと選択肢 「%s」→「%s」" % (qid, old, new))
                else:
                    skip.append("%s 答え（想定した文が無い。手で見ること）" % qid)

    print("直すもの %d件／触らないもの %d件" % (len(done), len(skip)))
    for m in done:
        print("  ✓ " + m)
    for m in skip:
        print("  ・ " + m)

    if not write:
        print("\n（--write で書きこむ）")
        return
    if not done:
        print("\n直すものが無いので書きこまない")
        return
    for fn, data in files.items():
        p = os.path.join(ROOT, "data", fn)
        with io.open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        json.load(io.open(p, encoding="utf-8"))     # 壊していないか読み直して確かめる
        print("  → %s" % fn)
    print("\n✓ 書きこんだ")


if __name__ == "__main__":
    main()
