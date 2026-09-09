# -*- coding: utf-8 -*-
"""解説が薄い小問を「次のN件だけ」出す。**コンテキストを溜めずに続けるための入口。**

  使い方:
    python scripts/kaisetsu_next.py                 次の20件
    python scripts/kaisetsu_next.py 30              次の30件
    python scripts/kaisetsu_next.py 20 5 sairei     学年とコースを絞る
    python scripts/kaisetsu_next.py --rest          残り件数だけ数える

  ★これを作った理由（本人の問い 2026-09-09）：
    「バディがやると精度は上がるが、コンテキストが溜まる。一定量でクリアしながら
     続けられないか」。**続けられる。**残りの仕事は毎回データから計算し直せるので、
    「どこまでやったか」を覚えておく必要が無い＝**進捗をコンテキストに持たない。**
    厚くした小問は もう K6 に引っかからないので、次からここに出てこない。

  ★だから手順はこれだけ：
    ① このコマンドで20件出す ② 書く ③ apply_kaisetsu.py --write で検品して入れる
    ④ **ここでコンテキストを捨ててよい。**新しいセッションで①から再開できる。
"""
import io, os, sys, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G
import check_kata as K

sys.stdout.reconfigure(encoding="utf-8")

OUT = os.path.join("docs", "_kaisetsu", "manual")

RULES = """【書き方の基準】
 1. なぜその計算をするのかを先に言う（式から入らない）
 2. つまずく所を名ざしする（「3−28 がひけないので1時間を60分にくずす」）
 3. 式は残す（子どもが答え合わせに使う）
 4. その学年の子が一人で読み通せる言葉にする（解説を読むのは子ども本人）
 5. 長くしない。考え方→式→答え の3拍子。80〜200字
【禁止】答えを変えない／内輪語（灘度・衣装・骨・原簿・HG-・コア発見）／
        後ろの小問の答えを書く／「図を見て」と書く（図が無い問題がある）"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    n = int(args[0]) if args and args[0].isdigit() else 20
    grade = args[1] if len(args) > 1 else None
    course = args[2] if len(args) > 2 else None

    d = G.load_daimon()
    rs = list(G.iter_daimon(d, grade=grade,
                            app_courses=[course] if course else None))
    hits = K.k6(rs)

    if "--rest" in sys.argv:
        by = collections.Counter("%s年 %s" % (r["grade"], r["app_course"]) for r, _l, _m in hits)
        print("残り %d件（大問 %d本）" % (len(hits), len({r["x"]["id"] for r, _l, _m in hits})))
        for k, v in by.most_common():
            print("  %-28s %4d" % (k, v))
        return 0

    todo = hits[:n]
    if not todo:
        print("✅ 薄い解説はもうありません（この範囲では）")
        return 0

    print("■ 解説を厚くする — 次の %d件（残り %d件）" % (len(todo), len(hits)))
    print()
    print(RULES)
    print()
    for r, _lv, msg in todo:
        x = r["x"]
        no = int(msg.split("小問")[1].split(" ")[0])
        s = x["steps"][no - 1]
        print("=" * 72)
        print("■ %s / step %d ／ %s年 %s ／ No.%s ／ %s"
              % (x["id"], no, r["grade"], r["app_course"], r["no"], x.get("unit", "")))
        intro = (x.get("intro") or "").strip()
        if intro:
            print("設定: %s" % intro)
        print("設問: %s" % (s.get("question") or "").strip())
        print("答え: %s" % s.get("answer"))
        print("いまの解説: %s" % (s.get("meaning") or "").strip())
    print("=" * 72)
    print()
    g = todo[0][0]["grade"]
    c = todo[0][0]["app_course"]
    print("【書いたあと】%s に out_1.jsonl を作る（1行1件・utf-8・LF）:" % OUT)
    print('  {"id": "…", "step": 1, "meaning": "…"}')
    print("  python scripts/apply_kaisetsu.py %s %s %s --write" % (OUT, g, c))
    print("  ※この20件は入れた時点で「薄く」なくなるので、次からここに出てきません。")
    print("  ※ここでコンテキストを捨ててよい。新しいセッションでこのコマンドから再開できます。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
