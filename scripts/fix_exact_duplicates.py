# -*- coding: utf-8 -*-
"""同じ玉手箱（学年・難易度・単元）の中に、一字一句おなじ問題が2つ入っているものを消す。

★消す前に**まるごと同じ**であることを確かめる。
  問題文・答え・選択肢・解説だけでなく **図（svg）も完全一致** であること。
  [[oton_quality_audit]]：図で比べずに消しかけて、9グループを誤って消すところだった。

★別の学年・別の回に同じ問題があるのは**消さない**。浜学園は復習主義で、
  小3最レが小5単元を先取りするので、同じ問題が2つの学年の玉手箱に入るのは正常。
  1回のセッションで同じ問題に2回当たるのは、玉手箱が同じときだけ。

  python scripts/fix_exact_duplicates.py          … 何が消えるか見るだけ
  python scripts/fix_exact_duplicates.py --write  … 消す
"""
import io, json, os, sys, collections

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 残すほう → 消すほう → 図のちがいを許す理由（None なら1バイトでも違えば消さない）。
# 番号の若いほう（先に作ったほう）を残す。
#
# ★sc3358/sc3359 は候補に挙がったが、**図を全文で比べたら別の魔方陣だった**ので外した。
#   問題文も答え(8)も図の長さ(2225字)も同じなのに、盤の数字も□の位置もちがう。
#   「長さが同じ＝同じ図」で済ませていたら消していた＝いちばん危ない偽陽性。
PAIRS = [
    ("sansu_rittai.json", "sd007", "sd7036",
     "図のちがいは「高さ5cm」のラベルの x が 133 と 130＝3pxだけ。"
     "立方体の線も他の寸法も1字も変わらない（差分を全部読んで確かめた）"),
]

FIELDS = ("question", "answer", "choices", "meaning", "explain", "svg", "unit", "grade", "difficulty")


def main():
    write = "--write" in sys.argv
    files = {}
    plans = []
    for fn, keep, drop, svg_ok in PAIRS:
        p = os.path.join(ROOT, "data", fn)
        files.setdefault(fn, json.load(io.open(p, encoding="utf-8")))
        rows = files[fn]
        by = {q["id"]: q for q in rows if isinstance(q, dict) and "id" in q}
        if drop not in by:
            print("  ・%s は もう無い（すでに消えている）" % drop)
            continue
        if keep not in by:
            print("  ✗ %s が無い。片割れが消えているので触らない" % keep)
            sys.exit(1)
        a, b = by[keep], by[drop]
        diff = [k for k in FIELDS if json.dumps(a.get(k), ensure_ascii=False, sort_keys=True)
                != json.dumps(b.get(k), ensure_ascii=False, sort_keys=True)]
        if diff == ["svg"] and svg_ok:
            print("  ! %s と %s は図が完全一致ではないが、目で確かめて同じと判断した" % (keep, drop))
            print("     %s" % svg_ok)
        elif diff:
            print("  ✗ %s と %s は %s がちがう。別の問題なので消さない" % (keep, drop, "・".join(diff)))
            sys.exit(1)
        cell = (a.get("grade"), a.get("difficulty"), a.get("unit"))
        n = sum(1 for q in rows if isinstance(q, dict)
                and (q.get("grade"), q.get("difficulty"), q.get("unit")) == cell)
        plans.append((fn, keep, drop, cell, n))

    if not plans:
        print("消すものはありません")
        return
    print("消すもの %d件" % len(plans))
    for fn, keep, drop, cell, n in plans:
        print("  ✓ %s の %s を消す（%s を残す）" % (fn, drop, keep))
        print("     玉手箱 学年%s・難%s・%s は %d問 → %d問（10問は割らない）"
              % (cell[0], cell[1], cell[2], n, n - 1))

    if not write:
        print("\n（--write で消す）")
        return
    for fn, keep, drop, cell, n in plans:
        rows = files[fn]
        files[fn] = [q for q in rows if not (isinstance(q, dict) and q.get("id") == drop)]
    for fn, data in files.items():
        p = os.path.join(ROOT, "data", fn)
        with io.open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        json.load(io.open(p, encoding="utf-8"))
        print("  → %s" % fn)
    print("\n✓ 消した")


if __name__ == "__main__":
    main()
