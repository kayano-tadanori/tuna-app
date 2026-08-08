# -*- coding: utf-8 -*-
"""hama_map.json に「灘合にチャレンジ」のコースを足す（小3・小4・小5）。

★本人決定（2026-08-05）：
  「灘合は今度実装しましょう ステップ2に置く案は素晴らしいので記録しといて」
  → 算数ホームの STEP2 に、じゅくナビと同じ並びで独立ボタンを置く。中で 学年→回 を選ぶ。

⛔ 灘合の問題を じゅくナビ（＝公開・復習テスト対策）に混ぜてはいけない。
   灘合は公開学力テストに出ない別物で、混ぜると範囲がずれる（本人指示）。
   → コースに subject:"nadago" を付ける。app.js の hamaCourses() は subject で絞るので、
     算数・理科・国語のじゅくナビには構造上出てこない（理科の subject:"rika" と同じやり方）。

回の範囲は原簿の健康診断の表そのまま（数え直さない）：
  小3灘合 第2〜12回（第1回は教材なし）／小4灘合 第1〜12回／小5灘合 第1〜6回（第7回以降は未入手）

  python scripts/add_nadago_course.py          … 何が入るか見るだけ
  python scripts/add_nadago_course.py --write  … 実際に書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP = os.path.join(ROOT, "data", "hama_map.json")

# 学年 → (回の範囲, 原簿の本数, 備考)
PLAN = {
    "3": (range(2, 13), 100, "第1回は教材なし"),
    "4": (range(1, 13), 130, ""),
    "5": (range(1, 7), 78, "第7回以降は教材未入手"),
}


def main():
    data = json.load(io.open(MAP, encoding="utf-8"))
    for g, (rng, n, note) in PLAN.items():
        courses = data["grades"][g]["courses"]
        if "nadago" in courses:
            print("（すでにある小%s nadago コースを作り直す）" % g)
        src = "浜学園 灘中合格特訓（灘合）。原簿に%d本（%s）。" % (
            n, "第%d〜%d回" % (rng[0], rng[-1]))
        if note:
            src += note + "。"
        src += "灘合の問題は公開学力テストには出ないので、じゅくナビとは分けている。"
        courses["nadago"] = {
            "subject": "nadago",
            "label": "灘合",
            "curriculum": "新",
            "kokai": False,          # 公開の範囲は出さない
            "source": src,
            # 中身（大問）が入るまでは題名を置かない。パネルは「—」と出て、
            # 大問ボタンは暗転したまま残る（本人指示 2026-07-28「まだ問題が無いところは暗転して残す」）
            "lessons": [{"no": i, "title": "じゅんびちゅう"} for i in rng],
        }
        print("  小%s 灘合：第%d〜%d回（%d回）／原簿 %d本 %s"
              % (g, rng[0], rng[-1], len(rng), n, note))

    if "--write" in sys.argv:
        with io.open(MAP, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        json.load(io.open(MAP, encoding="utf-8"))       # 壊れていないか確かめる
        print("\n✓ 書きこんだ（JSONとして読めることも確認）")
    else:
        print("\n（--write で書きこむ）")


if __name__ == "__main__":
    main()
