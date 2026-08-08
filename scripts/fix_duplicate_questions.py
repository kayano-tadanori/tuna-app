# -*- coding: utf-8 -*-
"""通常問題プール(sansu_*)の「中身まで同じ問題」を消し、空いたセルを埋める（2026-08-08）。

`scripts/audit_questions.js` が見つけた。同じ学年・同じ難易度・同じ問題文・同じ答え・
同じ図のものが 138問あった。多いものは同じ問題が7個（sansu_kazu 小6/難1）。
＝そのカテゴリをやると、同じ問題が最大7回出る状態だった。

★消す判定は厳しくしている（偽陽性を出さないため）
  - 学年・難易度・問題文・答え **に加えて図(svg)まで一致**したものだけ
    （問題文が同じでも図がちがえば別の問題。実際に9グループがこれで除外された）
  - 各グループの**先頭を残す**
  - hama_kokugo / hama_daimon / hama_kaisetsu は**対象外**。
    国語の漢字が回をまたいで再出するのは原簿の設計（らせん）であり、
    かんたん解説のるいだいが本体問題と同じなのは意図した再利用だから

★[[method_data_audit]]「移動で空いたセルは必ず作り直す」に従い、
  10問を割るセル（sansu_zu 小2/難4：10→9）には新しい問題を足す。
  クローンは作らない＝同じ骨の別の衣装にする（[[feedback_hamagakuen_iinkai_rule]]①）。

  python scripts/fix_duplicate_questions.py          … 何が変わるか見るだけ
  python scripts/fix_duplicate_questions.py --write  … 書きこむ
"""
import io, json, os, re, sys, glob, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

KATA = {chr(c): chr(c - 0x60) for c in range(0x30A1, 0x30F7)}


def norm(s):
    s = "".join(KATA.get(c, c) for c in str(s if s is not None else ""))
    s = re.sub(r"<[^>]*>", "", s)
    return re.sub(r"[\s・、。，．「」『』（）()*]", "", s).lower()


# ── 空いたセルを埋める問題（sansu_zu 小2/難4）──────────────────
# 骨は既存とそろえつつ、衣装（場面・問い方）を変える。小2までの漢字だけで書く
BACKFILL = {
    "sansu_zu.json": [
        {
            "id": "sz1913",
            "question": "タイルが 15まい あります。かいだんの形に、1だん目1まい・2だん目2まい…と "
                        "1まいずつ ふやして ならべると、何だんまで つくれますか。",
            "answer": "5",
            "meaning": "かいだんの形は 1だん目から じゅんに 1まい・2まい・3まい…と ふえていきます。"
                       "1＋2＝3、1＋2＋3＝6、1＋2＋3＋4＝10、1＋2＋3＋4＋5＝15。"
                       "ちょうど 15まい つかいきれるのは 5だんまでです。よって、答えは5です。",
            "grade": 2, "difficulty": 4,
        },
        {
            "id": "sz1914",
            "question": "1ぺんが 2cmの 正方形を すきまなく ならべて、たて 6cm よこ 8cmの "
                        "長方形を つくります。正方形は 何こ いりますか。",
            "answer": "12",
            "meaning": "1ぺんが 2cmなので、たてには 6÷2＝3こ、よこには 8÷2＝4こ ならびます。"
                       "ぜんぶで 3×4＝12こです。1ぺんが 1cmの ときと ちがい、"
                       "先に 何こ ならぶかを 出すのが たいせつです。よって、答えは12です。",
            "grade": 2, "difficulty": 4,
        },
    ],
}
# 対象にしないファイル（重なりが設計どおりのもの）
SKIP = {"hama_kokugo.json", "hama_daimon.json", "hama_kaisetsu.json"}


def main():
    files = sorted(os.path.basename(p) for p in glob.glob(os.path.join(DATA, "sansu_*.json")))
    removed_total, plan = 0, {}

    for f in files:
        if f in SKIP:
            continue
        data = json.load(io.open(os.path.join(DATA, f), encoding="utf-8"))
        if not isinstance(data, list):
            continue
        groups = collections.OrderedDict()
        for q in data:
            if not isinstance(q, dict) or "question" not in q:
                continue
            key = (q.get("grade"), q.get("difficulty"), norm(q.get("question")),
                   norm(q.get("answer")), str(q.get("svg") or ""))
            groups.setdefault(key, []).append(q)
        drop = []
        for key, arr in groups.items():
            if len(arr) > 1:
                drop.extend(x["id"] for x in arr[1:])
        if drop:
            plan[f] = drop
            removed_total += len(drop)

    print("消す問題：%d問（%dファイル）" % (removed_total, len(plan)))
    for f, ids in plan.items():
        print("  %-24s %3d問  %s%s" % (f, len(ids), ", ".join(ids[:6]),
                                       " …" if len(ids) > 6 else ""))

    print()
    print("足す問題：%d問" % sum(len(v) for v in BACKFILL.values()))
    for f, qs in BACKFILL.items():
        for q in qs:
            print("  %-24s %s  小%d/難%d  %s" % (f, q["id"], q["grade"], q["difficulty"],
                                                 q["question"][:44]))

    if "--write" not in sys.argv:
        print("\n（--write で書きこむ）")
        return

    for f in set(list(plan) + list(BACKFILL)):
        path = os.path.join(DATA, f)
        data = json.load(io.open(path, encoding="utf-8"))
        drop = set(plan.get(f, []))
        used = {q.get("id") for q in data}
        out = [q for q in data if q.get("id") not in drop]
        for q in BACKFILL.get(f, []):
            if q["id"] in used:
                print("  ! %s はすでにある。足さない" % q["id"])
                continue
            out.append(q)
        with io.open(path, "w", encoding="utf-8") as fp:
            json.dump(out, fp, ensure_ascii=False, indent=1)
        json.load(io.open(path, encoding="utf-8"))
    print("\n✓ 書きこんだ")


if __name__ == "__main__":
    main()
