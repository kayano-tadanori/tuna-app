# -*- coding: utf-8 -*-
"""漢字の書き取り（data/kanji_kaki.json）を倍にする。

  もとの538問はそのまま。新しい538問を kanji_kaki_x2_words.py から作って足す。
  1問の形は既存とそろえる：
     question … <文（かな）に「カタカナ」をうめこむ> ─ カタカナを漢字で書こう
                （小1・小2は「─ カタカナを かんじで かこう」）
     meaning  … <ruby>答え<rt>よみ</rt></ruby>と書きます。○○のことで、「例文」のように使います。
                よって、答えは○○です。

  使い方：
     python scripts/gen_kanji_kaki_x2.py           … 検査だけ（書きこまない）
     python scripts/gen_kanji_kaki_x2.py --write   … data/kanji_kaki.json に書きこむ

  ★検査でひっかかったら書きこまない（「答えが学年の配当漢字でない」「よみとカタカナが
    食いちがう」「答えの漢字が問題文に出ている＝答えが見えている」など）。
"""
import io, json, os, re, sys, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kyouiku_kanji import kanji_grade                      # noqa: E402
from kanji_kaki_x2_words import WORDS                      # noqa: E402

ROOT = os.path.dirname(HERE)
PATH = os.path.join(ROOT, "data", "kanji_kaki.json")

KANJI = re.compile(r"[一-鿿々]")
KATA_IN = re.compile(r"「([ァ-ヶー]+)」")
HIRA_ONLY = re.compile(r"^[ぁ-ゖー]+$")
ID_START = 2001            # kk2001〜。既存は kk001〜kk480 と kk9121〜kk9250


def kata2hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def build(grade, diff, sent, ans, yomi, imi, conn, rei, qid):
    kata = KATA_IN.search(sent).group(1)
    tail = f"{kata}を かんじで かこう" if grade <= 2 else f"{kata}を漢字で書こう"
    # ★意味が「〜こと」「〜もの」で終わっているのに「のことで、」をつなぐと
    #   「およぐことのことで」になる（塾講師の監査で91か所指摘された）。その場合は句点で切る。
    if conn == "こと" and (imi.endswith("こと") or imi.endswith("もの") or imi.endswith("ところ")):
        setsu = "。"
    else:
        setsu = {"こと": "のことで、", "意味": "という意味の漢字で、",
                 "言葉": "という意味の言葉で、", "文": ""}[conn]
    return {
        "id": qid,
        "question": f"{sent} ─ {tail}",
        "answer": ans,
        "meaning": (f"<ruby>{ans}<rt>{yomi}</rt></ruby>と書きます。{imi}{setsu}"
                    f"「{rei}」のように使います。よって、答えは{ans}です。"),
        "grade": grade,
        "difficulty": diff,
    }


def check(old, new):
    """作った問題を機械で点検する。ng=止めるもの／warn=見て判断するもの"""
    ng, warn = [], []
    old_q = {q["question"] for q in old}
    old_by_ga = collections.defaultdict(set)         # (grade, answer) → 既存の難易度
    for q in old:
        old_by_ga[(q["grade"], q["answer"])].add(q["difficulty"])
    seen_q, seen_pair = set(), collections.Counter()

    for q in new:
        g, a, tag = q["grade"], q["answer"], q["id"]
        sent = q["question"].split("─")[0].strip()
        m = KATA_IN.search(sent)
        yomi = re.search(r"<rt>(.*?)</rt>", q["meaning"]).group(1)

        # ① 「カタカナ」が本文にちょうど1つ
        if len(KATA_IN.findall(sent)) != 1:
            ng.append((tag, "「カタカナ」が1つでない", sent)); continue
        kata = m.group(1)
        # ② 出題のカタカナ＝よみ（送りがなは外に出す）
        if kata2hira(kata) != yomi:
            ng.append((tag, f"カタカナ({kata})とよみ({yomi})が合わない", sent))
        # ③ 答えの漢字はその学年までの配当か／その学年の字を含むか
        over = [c for c in a if KANJI.match(c) and kanji_grade(c) > g]
        if over:
            ng.append((tag, f"答え{a}に小{g}で習わない字 {''.join(over)}", sent))
        if not any(kanji_grade(c) == g for c in a if KANJI.match(c)):
            warn.append((tag, f"答え{a}に小{g}配当の字がない（下の学年の字だけ）", sent))
        # ④ 答えの漢字が問題文に出ていないか（答えが見えてしまう）
        leak = [c for c in a if KANJI.match(c) and c in q["question"].split("─")[0]]
        if leak:
            ng.append((tag, f"問題文に答えの字 {''.join(leak)} が出ている", sent))
        # ⑤ 問題文はかなだけ（漢字を混ぜると、そこが答えの手がかりになってしまう）
        if KANJI.search(sent):
            ng.append((tag, "問題文に漢字がある（かなで書く）", sent))
        # ⑥ よみはひらがな
        if not HIRA_ONLY.match(yomi):
            ng.append((tag, f"よみがひらがなでない: {yomi}", sent))
        # ⑦ 解説の結び・書き出し
        if not q["meaning"].endswith(f"よって、答えは{a}です。"):
            ng.append((tag, "解説の結びが答えと合っていない", q["meaning"][-24:]))
        if not q["meaning"].startswith(f"<ruby>{a}<rt>"):
            ng.append((tag, "解説の書き出しが答えと合っていない", q["meaning"][:24]))
        # ⑧-0 意味の途中に句点があるのに接続をつづけていないか（文がこわれる）
        head = q["meaning"].split("と書きます。", 1)[1].split("「")[0]
        if "。" in head[:-1] and head.endswith(("のことで、", "という意味の漢字で、", "という意味の言葉で、")):
            ng.append((tag, "解説の意味の途中に句点があって文が切れている", head))
        # ⑧ 例文に答えが入っているか
        rei = re.search(r"「(.*?)」のように使います", q["meaning"])
        if not rei:
            ng.append((tag, "例文が取り出せない", q["meaning"][:40]))
        elif a not in rei.group(1):
            ng.append((tag, f"例文に答え({a})が入っていない", rei.group(1)))
        # ⑨ 重複（既存とも新規どうしとも）
        if q["question"] in old_q or q["question"] in seen_q:
            ng.append((tag, "同じ問題文がすでにある", q["question"]))
        seen_q.add(q["question"])
        # ⑩ 同じ学年で同じ答えが別の難易度に散らばっていないか
        diffs = old_by_ga[(g, a)] | {q["difficulty"]}
        if len(diffs) > 1:
            warn.append((tag, f"小{g}の「{a}」が難易度{sorted(diffs)}に分かれている", sent))
        old_by_ga[(g, a)].add(q["difficulty"])
        seen_pair[(g, a)] += 1
        # ⑪ 答えは漢字だけ（かなまじりは ruby が読みにくくなる）
        if not all(KANJI.match(c) for c in a):
            warn.append((tag, f"答え{a}にかなが混じっている", sent))
    return ng, warn


def main():
    old = json.load(io.open(PATH, encoding="utf-8"))
    n = ID_START
    new = []
    for g in sorted(WORDS):
        for row in WORDS[g]:
            diff, sent, ans, yomi, imi, conn, rei = row
            new.append(build(g, diff, sent, ans, yomi, imi, conn, rei, f"kk{n}"))
            n += 1

    print(f"既存 {len(old)}問 ／ 追加 {len(new)}問 → 合計 {len(old) + len(new)}問")
    cnt = collections.Counter((q["grade"], q["difficulty"]) for q in old + new)
    for g in range(1, 7):
        print("  小%d:" % g, " ".join("難%d=%d" % (d, cnt[(g, d)]) for d in range(1, 5)),
              " 計", sum(cnt[(g, d)] for d in range(1, 5)))

    # ★このスクリプトは「1回きり」。すでに書きこんだあとにもう一度流すと、
    #   全問が「同じ問題文がすでにある」で止まる。それは正常なので、そう言って終わる
    old_q = {q["question"] for q in old}
    if new and all(q["question"] in old_q for q in new):
        print("")
        print("✓ この538問はもう data/kanji_kaki.json に入っている（追加ずみ）。")
        print("  語を足すときは kanji_kaki_x2_words.py に足して、ここを流し直す")
        return 0

    ng, warn = check(old, new)
    for tag, why, ctx in warn:
        print("  △", tag, why, "|", ctx)
    for tag, why, ctx in ng:
        print("  ✗", tag, why, "|", ctx)
    print(f"\n止めるもの {len(ng)}件 ／ 見て判断 {len(warn)}件")
    if ng:
        print("✗ 直すまで書きこまない")
        return 1
    if "--write" in sys.argv:
        with io.open(PATH, "w", encoding="utf-8") as f:
            json.dump(old + new, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("✓ data/kanji_kaki.json に書きこんだ")
    else:
        print("（--write を付けると書きこむ）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
