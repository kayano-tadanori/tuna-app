# -*- coding: utf-8 -*-
"""算数・理科の問題を横断検索するための軽量索引を data/search_index.json に生成する。
   単元名（例：つるかめ算）でのピンポイント検索を主目的とし、
   問題文・答え・意味文もあわせて検索対象にする。
   使い方：
     python scripts/gen_search_index.py          … ドライラン（件数・サンプル表示のみ）
     python scripts/gen_search_index.py --write  … data/search_index.json に書き込む
"""
import json, io, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = r"C:\Users\茅野　忠徳\Desktop\Claude\tuna app"

# scripts/sync_question_counts.js の MAP（sansu/rika）と同じ対応表
SANSU_MAP = {
    "keisan": "sansu_keisan", "bun": "sansu_bun", "zu": "sansu_zu",
    "kisoku": "sansu_kisoku", "tokusan": "sansu_tokusan", "baai": "sansu_baai",
    "kazu": "sansu_kazu", "wariai": "sansu_wariai", "hayasa": "sansu_hayasa",
    "rittai": "sansu_rittai", "bakuhatsu": "sansu_bakuhatsu",
}
RIKA_MAP = {
    "shokubutsu": "rika_shokubutsu", "doubutsu": "rika_doubutsu", "jintai": "rika_jintai",
    "sora": "rika_sora", "tenki": "rika_tenki", "mono": "rika_mono", "kitai": "rika_kitai",
    "daichi": "rika_daichi", "suiyoueki": "rika_suiyoueki", "denki": "rika_denki",
    "chikara": "rika_chikara", "hikari_oto": "rika_hikarioto",
}
SUBJECTS = [("sansu", SANSU_MAP), ("rika", RIKA_MAP)]


def strip_tags(s):
    s = str(s or "")
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\*\*|__", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def kata_to_hira(s):
    out = []
    for c in s:
        code = ord(c)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(c)
    return "".join(out)


ZEN2HAN = str.maketrans(
    "０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ"
    "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ",
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz",
)


def normalize(s):
    s = kata_to_hira(s or "")
    s = s.translate(ZEN2HAN)
    return s.lower()


def build():
    records = []
    per_file = []
    for subject, mapping in SUBJECTS:
        for cat, fname in mapping.items():
            path = BASE + r"\data\%s.json" % fname
            try:
                data = json.load(io.open(path, encoding="utf-8"))
            except FileNotFoundError:
                print("!! missing:", path)
                continue
            n = 0
            for q in data:
                if not isinstance(q, dict) or "id" not in q or "question" not in q:
                    continue
                qtext = strip_tags(q.get("question", ""))
                atext = str(q.get("answer", ""))
                mtext = strip_tags(q.get("meaning", ""))
                unit = q.get("unit", "") or ""
                t = normalize(qtext + " " + atext + " " + mtext)
                ut = normalize(unit)
                records.append({
                    "id": q["id"],
                    "subject": subject,
                    "cat": cat,
                    "grade": q.get("grade"),
                    "difficulty": q.get("difficulty"),
                    "unit": unit,
                    "q": qtext[:80],
                    "a": atext,
                    "t": t,
                    "ut": ut,
                })
                n += 1
            per_file.append((subject, cat, fname, n))
    return records, per_file


def main():
    write = "--write" in sys.argv
    records, per_file = build()
    print("=== ファイルごとの件数 ===")
    for subject, cat, fname, n in per_file:
        print(" ", subject, cat, fname, n)
    print("合計:", len(records))
    print()
    print("=== サンプル（つるかめ算のunit一致） ===")
    sample = [r for r in records if "つるかめ" in r["ut"]][:3]
    for r in sample:
        print(" ", r["id"], r["subject"], r["cat"], r["unit"], "|", r["q"])
    print("つるかめ算 該当件数:", sum(1 for r in records if "つるかめ" in r["ut"]))

    if write:
        out_path = BASE + r"\data\search_index.json"
        io.open(out_path, "w", encoding="utf-8").write(
            json.dumps(records, ensure_ascii=False)
        )
        print()
        print("書き込み完了:", out_path, "(%d件)" % len(records))
    else:
        print()
        print("ドライランです。書き込むには --write を付けて再実行してください。")


if __name__ == "__main__":
    main()
