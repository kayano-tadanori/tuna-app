# -*- coding: utf-8 -*-
"""hama_map.json の小4に「国語（本科V）」コースを1つ足す。

じゅくナビは courses[コース].subject で教科を絞る（app.js hamaCourses）。
subject:"kokugo" を付けるので算数・理科のホームには出ない。
lessons は no と title だけ（問題本体は data/hama_kokugo.json 側）。

回の名前は data/hama_kokugo.json のその回の漢字の最初の3つから作る（小3版と同じ）。
★単元名は付けない。小4国語の単元側は原簿の「回番号でえらぶだけ」方針に従う
  （→ [[feedback_hamagakuen_iinkai_rule]]「単元名を推測で埋めない」）。

  python scripts/add_kokugo_course_g4.py          … 何が入るか見るだけ
  python scripts/add_kokugo_course_g4.py --write  … 実際に書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP = os.path.join(ROOT, "data", "hama_map.json")
KOKUGO = os.path.join(ROOT, "data", "hama_kokugo.json")


def main():
    lessons_data = json.load(io.open(KOKUGO, encoding="utf-8"))["grades"]["4"]["kokugo"]["lessons"]

    lessons = []
    for k in sorted(lessons_data, key=int):
        rec = lessons_data[k]
        if int(k) == 0:
            title = "実力確認テスト（小3漢字の総ざらい）"
        else:
            kj = [q["answer"] + q.get("okuri", "") for q in rec["kanji"][:3]]
            title = "・".join(kj) + "…" if kj else rec["title"]
        lessons.append({"no": int(k), "title": title})

    course = {
        "subject": "kokugo",
        "label": "国語（本科V）",
        "curriculum": "新",
        "kokai": False,
        "source": "浜学園 小4国語 本科教材Vクラス 実力確認テスト〜No.42（全43回・原簿 HG-2431〜2473）。"
                  "各回の「カタカナ→漢字」の大問を data/hama_kokugo.json に収録（404問）。"
                  "語句・文法・韻文文学史の大問（No.7-9／No.32-36／No.39-42）と読解24回はまだ入れていない。",
        "lessons": lessons,
    }

    data = json.load(io.open(MAP, encoding="utf-8"))
    courses = data["grades"]["4"]["courses"]
    if "kokugo" in courses:
        print("✗ もう小4に kokugo コースが入っている。二重に足さない")
        sys.exit(1)
    courses["kokugo"] = course

    print("入れる回数：%d（No.%d〜No.%d）" % (len(lessons), lessons[0]["no"], lessons[-1]["no"]))
    for l in lessons[:5]:
        print("  No.%-2d %s" % (l["no"], l["title"]))
    print("  …")
    for l in lessons[-3:]:
        print("  No.%-2d %s" % (l["no"], l["title"]))

    if "--write" in sys.argv:
        with io.open(MAP, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        json.load(io.open(MAP, encoding="utf-8"))       # 壊れていないか確かめる
        print("\n✓ 書きこんだ（JSONとして読めることも確認）")
    else:
        print("\n（--write で書きこむ）")


if __name__ == "__main__":
    main()
