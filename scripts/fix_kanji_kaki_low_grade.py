# -*- coding: utf-8 -*-
"""小1・小2の「漢字の書き取り」の解説に ふりがな を付ける。

  解説を読むのは子ども本人なのに、小1・小2の解説にその学年で習っていない漢字が
  そのまま入っていた（塾講師の内容レビューで指摘・2026-08-22）。
  書き取りは漢字そのものが素材なので、ほかの教科のように かなに開くと教材が壊れる。
  → **まだ習っていない漢字のかたまりにだけ ふりがな（<ruby>）を付ける**。

  ・すでに付いている <ruby> の中は触らない＝何度流しても二重にならない
  ・読みは scripts/kanji_kaki_ruby_map.py の表。表に無い語が出たら書きこまずに止まる

    python scripts/fix_kanji_kaki_low_grade.py          … 何が変わるか出すだけ
    python scripts/fix_kanji_kaki_low_grade.py --write  … data/kanji_kaki.json に書きこむ
"""
import io, json, os, re, sys, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kyouiku_kanji import kanji_grade                 # noqa: E402
from kanji_kaki_ruby_map import READ, CTX             # noqa: E402

PATH = os.path.join(os.path.dirname(HERE), "data", "kanji_kaki.json")
GRADES = (1, 2)
RUBY = re.compile(r"<ruby>.*?</ruby>")
RUN = re.compile(r"[一-鿿々]+")
TAG = re.compile(r"<[^>]+>")
RT = re.compile(r"<rt>.*?</rt>")


def strip_ruby(s):
    return TAG.sub("", RT.sub("", s))


def add_ruby(text, grade, missing):
    """<ruby>…</ruby> の外にある、その学年で習わない漢字のかたまりに ふりがなを付ける"""
    out, pos = [], 0
    for mr in RUBY.finditer(text):
        out.append(_ruby_plain(text[pos:mr.start()], grade, missing))
        out.append(mr.group(0))          # すでに付いているルビはそのまま
        pos = mr.end()
    out.append(_ruby_plain(text[pos:], grade, missing))
    return "".join(out)


def _ruby_plain(seg, grade, missing):
    out, pos = [], 0
    for m in RUN.finditer(seg):
        w = m.group(0)
        if all(kanji_grade(c) <= grade for c in w):
            continue
        yomi = None
        for (k, okuri), y in CTX.items():          # 送りがなで読みが変わるものが先
            if w == k and seg[m.end():].startswith(okuri):
                yomi = y
                break
        if yomi is None:
            yomi = READ.get(w)
        if yomi is None:
            missing[w] += 1
            continue
        out.append(seg[pos:m.start()])
        out.append("<ruby>%s<rt>%s</rt></ruby>" % (w, yomi))
        pos = m.end()
    out.append(seg[pos:])
    return "".join(out)


def main():
    d = json.load(io.open(PATH, encoding="utf-8"))
    missing = collections.Counter()
    changed, samples = 0, []
    for q in d:
        if q["grade"] not in GRADES:
            continue
        new = add_ruby(q["meaning"], q["grade"], missing)
        if new != q["meaning"]:
            changed += 1
            if len(samples) < 3:
                samples.append((q["id"], q["meaning"], new))
            q["meaning"] = new

    print("ふりがなを付けた問題: %d問（小1・小2 は全%d問）"
          % (changed, sum(1 for q in d if q["grade"] in GRADES)))
    for i, (qid, a, b) in enumerate(samples):
        print("  例%d %s\n    前: %s\n    後: %s" % (i + 1, qid, a[:70], b[:110]))
    if missing:
        print("\n✗ 読みが表に無い語があります（scripts/kanji_kaki_ruby_map.py に足す）:")
        for w, n in missing.most_common():
            print("   %s（%d回）" % (w, n))
        return 1

    # ── 検算 ──
    ng = []
    for q in d:
        if q["grade"] not in GRADES:
            continue
        plain = strip_ruby(q["meaning"])          # ふりがなを外した素の文（結び・例文を見る用）
        naked = RUBY.sub("", q["meaning"])        # ルビが付いた語をまるごと除いた残り
        left = [c for c in naked if "一" <= c <= "鿿" and kanji_grade(c) > q["grade"]]
        if left:
            ng.append((q["id"], "まだ ふりがなの無い漢字がある: " + "".join(sorted(set(left)))))
        if not plain.endswith("よって、答えは%sです。" % q["answer"]):
            ng.append((q["id"], "結びが答えと合っていない: " + plain[-24:]))
        rei = re.search(r"「(.*?)」のように使います", plain)
        if rei and q["answer"] not in rei.group(1):
            ng.append((q["id"], "例文に答えが入っていない: " + rei.group(1)))
        if "<ruby><ruby>" in q["meaning"] or "</ruby></ruby>" in q["meaning"]:
            ng.append((q["id"], "ルビが二重になっている"))
    for qid, why in ng:
        print("  ✗", qid, why)
    print("\n止めるもの %d件" % len(ng))
    if ng:
        return 1
    if "--write" in sys.argv:
        with io.open(PATH, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("✓ data/kanji_kaki.json に書きこんだ")
    else:
        print("（--write を付けると書きこむ）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
