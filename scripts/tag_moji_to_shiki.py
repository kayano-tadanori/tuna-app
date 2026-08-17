# -*- coding: utf-8 -*-
"""「文字を使った式でA・Bなどの値を求める」問題を洗い出し、tags: ["文字と式"] を付ける。
   unit フィールドは書き換えない（単元しぼり込みへの影響を避けるため）。
   tags は scripts/gen_search_index.py が拾って検索対象にする。
   使い方：
     python scripts/tag_moji_to_shiki.py          … ドライラン（件数・内訳・サンプル表示のみ）
     python scripts/tag_moji_to_shiki.py --write  … 該当する sansu_*.json に tags を書き込む
"""
import json, io, re, sys, glob, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = r"C:\Users\茅野　忠徳\Desktop\Claude\tuna app"

# ひらがな・カタカナ・漢字・長音符に挟まれていない大文字A-Zだけを拾う
# （「A地点」のような単発ラベルは後段のキーワード条件で弾く）
PAT_LETTERS = re.compile(r"(?<![ぁ-んァ-ヶ一-龥ー])([A-Z])(?![ぁ-んァ-ヶ一-龥ー])")
EXCLUDE_HINTS = ["三角形", "四角形", "正方形", "長方形", "地点", "角", "辺", "頂点", "図",
                  "線分", "平行", "点O", "点P", "点Q"]  # 図形の点・線分ラベル（例：線分AB、点Oで交わる）を除外
REQUIRE_ANY = ["求め", "いくつ", "何"]
TARGET_FILES = glob.glob(os.path.join(BASE, "data", "sansu_*.json"))
TARGET_FILES = [f for f in TARGET_FILES if not any(
    x in os.path.basename(f) for x in ("chain", "gachi", "toranomaki")
)]


def is_candidate(q):
    if not isinstance(q, dict) or "question" not in q:
        return False
    text = q["question"]
    letters = set(PAT_LETTERS.findall(text))
    if len(letters) < 2:
        return False
    if any(h in text for h in EXCLUDE_HINTS):
        return False
    if not any(k in text for k in REQUIRE_ANY):
        return False
    return True


def main():
    write = "--write" in sys.argv
    total = 0
    by_unit = {}
    per_file_hits = {}

    for path in sorted(TARGET_FILES):
        data = json.load(io.open(path, encoding="utf-8"))
        hits = 0
        changed = False
        for q in data:
            if not is_candidate(q):
                continue
            total += 1
            hits += 1
            by_unit[q.get("unit")] = by_unit.get(q.get("unit"), 0) + 1
            if write:
                tags = q.get("tags") or []
                if "文字と式" not in tags:
                    tags.append("文字と式")
                    q["tags"] = tags
                    changed = True
        if hits:
            per_file_hits[os.path.basename(path)] = hits
        if write and changed:
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(data, ensure_ascii=False, indent=2)
            )

    print("候補件数:", total)
    print()
    print("ファイル別:")
    for fname, n in sorted(per_file_hits.items(), key=lambda x: -x[1]):
        print(" ", fname, n)
    print()
    print("unit別の内訳:")
    for u, n in sorted(by_unit.items(), key=lambda x: -x[1]):
        print(" ", u, n)

    if write:
        print()
        print("書き込み完了。tags: ['文字と式'] を付与しました。")
    else:
        print()
        print("ドライランです。書き込むには --write を付けて再実行してください。")


if __name__ == "__main__":
    main()
