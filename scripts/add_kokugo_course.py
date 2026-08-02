# -*- coding: utf-8 -*-
"""hama_map.json の小3に「国語（本科）」コースを1つ足す。

じゅくナビは courses[コース].subject で教科を絞る（app.js hamaCourses）。
subject:"kokugo" を付けるので算数・理科のホームには出ない。
lessons は no と title だけ（問題本体は data/hama_kokugo.json 側）。

回の名前は原簿から作る：
  ①「★1回まるごと『◯◯』の回」と書いてある回はその単元名
  ② それ以外は その回の漢字の最初の3字（例「寒・温・開…」）

  python scripts/add_kokugo_course.py          … 何が入るか見るだけ
  python scripts/add_kokugo_course.py --write  … 実際に書きこむ
"""
import io, json, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP = os.path.join(ROOT, "data", "hama_map.json")
KOKUGO = os.path.join(ROOT, "data", "hama_kokugo.json")
GENBO = os.path.join(os.path.expanduser("~"),
                     r".claude\projects\c--Users-User-Desktop-Claude\memory\hamagakuen_ryomon_genbo.md")

UNIT = re.compile(r"★(?:1回まるごと|この回だけ)「([^」]+)」")


def main():
    lessons_data = json.load(io.open(KOKUGO, encoding="utf-8"))["grades"]["3"]["kokugo"]["lessons"]
    src = io.open(GENBO, encoding="utf-8").read()
    sec = src[src.index("# 📕 小3 国語"):]
    units = {}
    for r in re.split(r"(?=^### 【HG-25)", sec, flags=re.M)[1:]:
        hg = re.match(r"### 【HG-(\d+)】", r).group(1)
        m = UNIT.search(r)
        if m:
            units["HG-" + hg] = m.group(1)

    lessons = []
    for k in sorted(lessons_data, key=int):
        rec = lessons_data[k]
        u = units.get(rec["src"])
        if int(k) == 0:
            title = "実力確認テスト（小2漢字の総ざらい）"
        elif u:
            # パネルの1行に収まらない長い単元名は、かっこの前で切る
            title = u.split("（")[0] if len(u) > 14 else u
        else:
            kj = [q["answer"] for q in rec["kanji"][:3]]
            title = "・".join(kj) + "…" if kj else rec["title"]
        lessons.append({"no": int(k), "title": title})

    course = {
        "subject": "kokugo",
        "label": "国語（本科）",
        "curriculum": "新",
        "kokai": False,
        "source": "浜学園 小3国語 本科教材 実力確認テスト〜No.42（実物PDF 137ページ全読了／原簿 HG-2501〜2543）。"
                  "各回の大問4「カタカナ→漢字10問」を data/hama_kokugo.json に収録。"
                  "ことば（大問3）と読解（大問1・2）はまだ入れていない。",
        "lessons": lessons,
    }

    txt = io.open(MAP, encoding="utf-8").read()
    if '"kokugo"' in txt:
        print("✗ もう kokugo コースが入っている。二重に足さない")
        sys.exit(1)

    # 小3の sairei の閉じかっこ（"curriculum": "旧" の直後）を探して、その後ろに差しこむ
    anchor = '     "curriculum": "旧"\n    }\n   }\n  },\n  "5": {'
    if txt.count(anchor) != 1:
        print("✗ 差しこむ場所が特定できない（%d件）" % txt.count(anchor))
        sys.exit(1)

    body = json.dumps(course, ensure_ascii=False, indent=1)
    body = "\n".join(("    " + l) if i else l for i, l in enumerate(body.split("\n")))
    new = ('     "curriculum": "旧"\n    },\n    "kokugo": ' + body + "\n   }\n  },\n  \"5\": {")
    txt2 = txt.replace(anchor, new, 1)

    print("入れる回数：%d（No.%d〜No.%d）" % (len(lessons), lessons[0]["no"], lessons[-1]["no"]))
    for l in lessons[:6]:
        print("  No.%-2d %s" % (l["no"], l["title"]))
    print("  …")
    for l in lessons[-3:]:
        print("  No.%-2d %s" % (l["no"], l["title"]))

    if "--write" in sys.argv:
        io.open(MAP, "w", encoding="utf-8").write(txt2)
        json.load(io.open(MAP, encoding="utf-8"))       # 壊れていないか確かめる
        print("\n✓ 書きこんだ（JSONとして読めることも確認）")
    else:
        json.loads(txt2)
        print("\n（--write で書きこむ。JSONとして読めることは確認ずみ）")


if __name__ == "__main__":
    main()
