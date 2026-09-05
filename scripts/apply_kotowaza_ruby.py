# -*- coding: utf-8 -*-
"""kotowaza_ruby_map.py の読み表を使って、data/kotowaza.json の
   question・choices・meaning に <ruby>語<rt>よみ</rt></ruby> を振る。

  ★配当漢字外の字（kyouiku_kanji.kanji_grade==7）を含む「連続した漢字のかたまり」
    だけを対象にする。かたまりの中を、長い語から先にマッチさせて置きかえる
    （辞書に無い部分が残ったら MISSING として報告し、書きこまない＝安全側）。
  ★choices・answer は比較に使われるので、answer にはルビを入れない
    （question.js の onQuizChoose が stripRuby() で比較する設計）。
  ★meaning はそのまま情報表示なので自由に入れてよい。

  使い方:
    python scripts/apply_kotowaza_ruby.py            … 何が変わるかだけ表示（書きこまない）
    python scripts/apply_kotowaza_ruby.py --write     … 実際に書きこむ
"""
import io
import json
import re
import sys

sys.path.insert(0, "scripts")
import kyouiku_kanji as kk
import kotowaza_ruby_map as rm

FN = "data/kotowaza.json"

WORDS = {}
WORDS.update(rm.SINGLE)
WORDS.update(rm.COMPOUND)
# 長い語から先に試す（「二兎」を「二」+「兎」に割らない）
ORDER = sorted(WORDS, key=len, reverse=True)

KANJI_RUN = re.compile(r"[一-鿿]+")
TAG = re.compile(r"<[^>]+>")

# ★同じ字でも直後の送りがなで読みが変わる語（ことわざ全体で2パターンだけ実測ずみ）。
#   「触らぬ神に祟りなし」＝さわらぬ／「袖触れ合うも他生の縁」＝ふれあう。
#   ふつうの1語1読み(SINGLE辞書)では両方をカバーできないので、ここだけ特別扱いする
OKURI_OVERRIDE = {
    "触": [("らぬ", "さわ"), ("る", "さわ")],  # 触らぬ・触る → さわ。それ以外(触れ)は辞書の既定(ふ)
    "頼": [("れ", "たよ"), ("り", "たよ"), ("る", "たよ"),
           ("み", "たの"), ("ん", "たの"), ("む", "たの")],
    "猛": [("し", "たけ")],  # 「苛政は虎よりも猛し」だけ たけし。それ以外(猛勉強等)は既定のもう
}


def has_hard(run):
    return any(kk.kanji_grade(c) == 7 for c in run)


def wrap_run(run, missing, ctx, after=""):
    """1つの漢字のかたまりを、辞書にある語だけ <ruby> で置きかえる。
       辞書に無い配当漢字外の字が残ったら missing に積んで、その run はそのまま返す。
       after ＝ このかたまりの直後に続く文字列（送りがな判定に使う）。"""
    if not has_hard(run):
        return run
    out = []
    i = 0
    n = len(run)
    touched = False
    while i < n:
        # ★送りがなで読みが変わる字が run の最後の文字なら先に見る
        if i == n - 1 and run[i] in OKURI_OVERRIDE:
            hit = next((r for suf, r in OKURI_OVERRIDE[run[i]] if after.startswith(suf)), None)
            if hit:
                out.append("<ruby>%s<rt>%s</rt></ruby>" % (run[i], hit))
                i += 1
                touched = True
                continue
        matched = None
        for w in ORDER:
            if run.startswith(w, i):
                matched = w
                break
        if matched:
            out.append("<ruby>%s<rt>%s</rt></ruby>" % (matched, WORDS[matched]))
            i += len(matched)
            touched = True
        else:
            ch = run[i]
            if kk.kanji_grade(ch) == 7:
                missing.append((ctx, run, ch))
            out.append(ch)
            i += 1
    if not touched:
        return run
    return "".join(out)


def process_text(text, missing, ctx):
    """すでにタグが入っている部分（<ruby>等）はそのまま、地の文の漢字かたまりだけ処理する。
       〔浜学園 …原簿HG-xxxx〕のような制作側の出典タグは触らない（別問題として報告する）"""
    if "<ruby" in text:
        return text  # すでに処理済み（例：questionに前回分が残っている等）は触らない
    parts = []
    last = 0
    matches = list(re.finditer(r"〔[^〕]*〕|<[^>]+>|[一-鿿]+", text))
    for idx, m in enumerate(matches):
        if m.start() > last:
            parts.append(text[last:m.start()])
        s = m.group()
        if s.startswith("<") or s.startswith("〔"):
            parts.append(s)
        else:
            nxt_start = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            after = text[m.end():nxt_start]
            parts.append(wrap_run(s, missing, ctx, after))
        last = m.end()
    parts.append(text[last:])
    return "".join(parts)


def main():
    write = "--write" in sys.argv
    raw = io.open(FN, encoding="utf-8").read()
    d = json.loads(raw)

    def walk(o, out):
        if isinstance(o, dict):
            if o.get("id") and "question" in o:
                out.append(o)
            for v in o.values():
                walk(v, out)
        elif isinstance(o, list):
            for v in o:
                walk(v, out)

    items = []
    walk(d, items)

    missing = []
    changed = 0
    for it in items:
        before = json.dumps(it, ensure_ascii=False)
        it["question"] = process_text(it["question"], missing, it["id"] + ":question")
        if it.get("choices"):
            it["choices"] = [process_text(c, missing, it["id"] + ":choice") for c in it["choices"]]
        if it.get("meaning"):
            it["meaning"] = process_text(it["meaning"], missing, it["id"] + ":meaning")
        after = json.dumps(it, ensure_ascii=False)
        if before != after:
            changed += 1

    if missing:
        from collections import Counter
        cnt = Counter(ch for _, _, ch in missing)
        print("❌ 辞書に無い配当漢字外の字: %d件（%d種）" % (len(missing), len(cnt)))
        for ch, n in cnt.most_common(1000):
            examples = [c for c, r, x in missing if x == ch][:2]
            print("   %s (%d回)  例: %s" % (ch, n, examples))
        print("\n→ kotowaza_ruby_map.py に追加してから再実行してください。書きこみはしていません。")
        return

    print("✅ 辞書の抜けはゼロ。%d本のレコードが変わります。" % changed)
    if write:
        out = json.dumps(d, ensure_ascii=False, indent=1)
        json.loads(out)  # 壊れていないか最終確認
        io.open(FN, "w", encoding="utf-8").write(out)
        print("書いた:", FN)
    else:
        print("（--write をつけると書きこみます）")


if __name__ == "__main__":
    main()
