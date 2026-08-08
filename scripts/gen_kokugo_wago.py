# -*- coding: utf-8 -*-
"""和語カテゴリ（data/kokugo_wago.json）を、原簿の小5最レ国語から機械生成する。

種本＝原簿 HG-2546／HG-2550／HG-2557（和語(1)(2)(3)＝あ〜わを一周する78語）。
  ・語と意味は scripts/extract_wago.py が原簿から抜いた scripts/_wago_raw.json
  ・解説（なぜそうなるか）は scripts/meanings_kokugo_wago.json に手で書いてある
    → 解説の無い問題は本番に出さない（[[project_oton_gakuen]]「評価軸はわかりやすいか」）

出す形は2つ。実物は「□にひらがなを入れる」記述式だが、それは じゅくナビ側（手書き＋自己採点）で
再現する。こちらは一般カテゴリなので4択にする（原簿の設問を作り変えるのではなく、
原簿の語彙リストから新しい問題を作る扱い）。
  A 意味→語 ：「『もろくて長続きしない』という意味のことばは？」→ はかない
  B 語→意味 ：「『はかない』の意味は？」→ もろくて長続きしない

  python scripts/gen_kokugo_wago.py          … 検査だけ
  python scripts/gen_kokugo_wago.py --write  … data/kokugo_wago.json に書く
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(HERE, "_wago_raw.json")
MEAN = os.path.join(HERE, "meanings_kokugo_wago.json")
OUT = os.path.join(ROOT, "data", "kokugo_wago.json")

# ── 4択に同居させてはいけない組 ──────────────────────────────
# 意味がほぼ同じ＝どちらを選んでも正解になってしまう。
# （→ [[oton_kokugo_audit]]「正解が二つある穴うめ」を作らないための表）
CONFLICT = [
    {"ばつがわるい", "きまりがわるい"},   # どちらも「きまりが悪い」
    {"さもしい", "あさまし"},             # どちらも「心がいやしい」
    {"だしぬけ", "やにわに"},             # どちらも「いきなり」
    {"うとましい", "ねたましい"},         # 「いやだ」の気持ちが重なる
    {"おざなり", "なおざり"},             # ★ここは"わざと"隣に置きたいが、意味が近く割れるので分ける
]

# ── 難易度（1〜4）。既存カテゴリと同じ4段階に配る ─────────────
# 物差しは「日常でどれだけ見かけるか」と「意味を取りちがえやすいか」。
# ⚠ difficulty 5 は既存の国語カテゴリでは使っていない（灘中レベルは kokugo_chain 側）ので使わない。
DIFF = {
    1: [  # 日常でもよく見る。意味も素直
        "はかない", "むなしい", "たよりない", "めど", "まどろむ", "つのる", "ひしめく",
        "みくびる", "はばむ", "ねぎらう", "ねたましい", "さながら", "さぞかし", "せわしい",
        "いそしむ", "いとおしい", "やみくも", "もてあます", "ほのめかす", "たしなめる",
    ],
    2: [  # 見かけるが、意味があいまいになりやすい
        "だしぬけ", "うそぶく", "へつらう", "ふてぶてしい", "ぶしつけ", "しおらしい",
        "うらぶれる", "ばつがわるい", "きまりがわるい", "ひけめ", "よどみない", "そつがない",
        "くもゆき", "けげん", "うとましい", "うさんくさい", "いぶかしい", "いたたまれない",
        "あからさま", "すげない", "らちがあかない",
    ],
    3: [  # 書きことば寄り・やや古風
        "おざなり", "なおざり", "かいがいしい", "かこつける", "かもしだす", "したりがお",
        "そらぞらしい", "つきなみ", "ぬきんでる", "のたうつ", "はかばかしい", "ぶちょうほう",
        "みじろぎ", "さもしい", "いかめしい", "おくゆかしい", "ふがいない", "とどのつまり",
        "にっちもさっちも",
    ],
    4: [  # 意味を取りちがえやすい・古語的。入試でねらわれる
        "すべからく", "おもむろに", "いたずらに", "しかつめらしい", "あさまし", "こもごも",
        "けんもほろろ", "ぬかづく", "むげに", "ほぞをかむ", "ぎょうぎょうしい", "あやかる",
        "聞こえよがし", "いやおうなし", "なりをひそめる", "やにわに", "おこがましい",
        "かさにかかる",
    ],
}
DIFF_OF = {w: d for d, ws in DIFF.items() for w in ws}

# 学年。実物が小5最高レベル特訓の教材なので小5に置く。
# ⚠ 出題は q.grade === grade の完全一致（js/sansu.js）。小6になったら grade 6 版が要る
GRADE = 5


def conflicts(a, b):
    return any({a, b} <= s for s in CONFLICT)


def pick_distractors(i, words, key):
    """i番の語に対する誤答を3つ、決まった順で選ぶ（乱数を使わない＝毎回同じ問題になる）"""
    out, n = [], len(words)
    step = 1
    while len(out) < 3 and step < n:
        j = (i + step * 7) % n          # 7つ飛ばしで拾う＝五十音の近い語ばかりにならない
        cand = words[j]
        if j != i and not conflicts(words[i][key], cand[key]) and cand not in out:
            if all(not conflicts(cand[key], o[key]) for o in out):
                out.append(cand)
        step += 1
    return out


def main():
    raw = json.load(io.open(RAW, encoding="utf-8"))
    # ★アプリの解説はプレーンテキスト（既存の meanings_*.json と同じ）。
    #   書くときは ** で強調してよいが、出すときに落とす
    notes = {m["word"]: m["note"].replace("**", "")
             for m in json.load(io.open(MEAN, encoding="utf-8"))}

    nodiff = [w["word"] for w in raw if w["word"] not in DIFF_OF]
    if nodiff:
        print("✗ 難易度表に無い語が %d 語あります：" % len(nodiff))
        for w in nodiff:
            print("   ", w)
        sys.exit(1)

    missing = [w["word"] for w in raw if w["word"] not in notes]
    if missing:
        print("✗ 解説が無い語が %d 語あります。書いてから出してください：" % len(missing))
        for w in missing:
            print("   ", w)
        sys.exit(1)

    qs = []
    for i, w in enumerate(raw):
        d = DIFF_OF[w["word"]]
        ds = pick_distractors(i, raw, "word")
        # A 意味→語
        qs.append({
            "id": "wg%03d" % (i + 1),
            "question": "「%s」という意味のことばは？" % w["meaning"].rstrip("。"),
            "answer": w["word"],
            "choices": sorted([w["word"]] + [x["word"] for x in ds]),
            "meaning": notes[w["word"]] + "よって、答えは%sです。" % w["word"],
            "difficulty": d, "grade": GRADE,
        })
        # B 語→意味
        qs.append({
            "id": "wg%03d" % (i + 1 + len(raw)),
            "question": "「%s」の意味は？" % w["word"],
            "answer": w["meaning"],
            "choices": sorted([w["meaning"]] + [x["meaning"] for x in ds]),
            "meaning": notes[w["word"]] + "よって、答えは「%s」です。" % w["meaning"].rstrip("。"),
            "difficulty": d, "grade": GRADE,
        })

    # ── 検査 ────────────────────────────────────────────
    ng = []
    for q in qs:
        if q["answer"] not in q["choices"]:
            ng.append(("答えが選択肢にない", q["id"]))
        if len(set(q["choices"])) != 4:
            ng.append(("選択肢が4つそろっていない／重複", q["id"]))
        if not q["meaning"] or len(q["meaning"]) < 40:
            ng.append(("解説が無い／短すぎる", q["id"]))
    # 4択の中に「正解と同じ意味の語」が混じっていないか（正解が2つになる事故）
    by_word = {w["word"]: w["meaning"] for w in raw}
    for q in qs:
        if q["id"] <= "wg%03d" % len(raw):
            same = [c for c in q["choices"] if c != q["answer"] and by_word.get(c) == by_word[q["answer"]]]
            if same:
                ng.append(("正解が2つある: " + "/".join(same), q["id"]))
    ids = [q["id"] for q in qs]
    if len(ids) != len(set(ids)):
        ng.append(("IDの重複", "-"))

    print("語 %d／問題 %d問（意味→語 %d ＋ 語→意味 %d）" % (len(raw), len(qs), len(raw), len(raw)))
    import collections as _c
    dc = _c.Counter(DIFF_OF[w["word"]] for w in raw)
    print("難易度の配り方（語）：" + " ".join("%d=%d語" % (k, dc[k]) for k in sorted(dc)))
    print("解説：%d問すべてに付いている（平均 %d字）"
          % (len(qs), sum(len(q["meaning"]) for q in qs) // len(qs)))
    if ng:
        print("\n✗ 検査でひっかかった %d件" % len(ng))
        for why, qid in ng[:20]:
            print("   %s … %s" % (qid, why))
        sys.exit(1)
    print("✅ 検査ぜんぶ通過（答えが選択肢にある／選択肢4つ／重複なし／正解は1つ／解説あり）")

    print("\n--- 見本 ---")
    for q in (qs[0], qs[1], qs[len(raw) * 2 - 2]):
        print("[%s] %s" % (q["id"], q["question"]))
        print("   choices: %s" % " / ".join(q["choices"]))
        print("   answer : %s" % q["answer"])
        print("   解説   : %s" % q["meaning"][:120])

    if "--write" in sys.argv:
        json.dump(qs, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\n→ data/kokugo_wago.json に %d問 書きこんだ" % len(qs))
    else:
        print("\n（--write を付けると data/kokugo_wago.json に書きます）")


if __name__ == "__main__":
    main()
