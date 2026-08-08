# -*- coding: utf-8 -*-
"""同じ学年の中で、同じ問題が別の難易度に入っているのを1本にする。

★なぜ直すか
  学年がちがうのは**正常**（小3最レが小5単元を先取りするなど）。子どもは自分の学年しか見ない。
  だが**同じ学年で難1と難3の両方にある**と、同じ子が同じ問題に2回当たる。

★どちらを残すか（この順に決める）
  1. **難易度が低いほう**を残す。下で出しているということは、その難易度で解ける証拠がある
  2. 同じ難易度なら**解説がくわしいほう**を残す
  実測では9組中6組で、低いほうが解説もくわしかった（例：
  「秒速15m→1時間(3600秒)で15×3600＝54000m＝54km」対「15×3600＝54000m＝54km」）

★消さない条件
  - `src`（原簿番号）を持つもの＝原簿にある問題。学年も難易度も原簿が正なので触らない
  - 組が検査から取れないもの

★組は `node scripts/audit_questions.js --json` の⑧から取る。
  ここで判定を書き直すと基準が2つになる（読点「、」のちがいで取りこぼした実績あり）。

  python scripts/fix_same_grade_split.py          … 何が変わるか見るだけ
  python scripts/fix_same_grade_split.py --write  … 書きこむ
"""
import io, json, os, subprocess, sys, collections

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
KIND = "同じ学年で難易度が割れている"


def find_node():
    import glob
    for pat in (os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.*"
                                   r"\node-*-win-x64\node.exe"),
                r"C:\Program Files\nodejs\node.exe"):
        hit = glob.glob(pat)
        if hit:
            return hit[0]
    return "node"


def main():
    r = subprocess.run([find_node(), os.path.join(HERE, "audit_questions.js"), "--json"],
                       capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    if r.returncode != 0:
        print("✗ audit_questions.js が動かない\n" + (r.stderr or "")[:400])
        sys.exit(1)
    rows = [x for x in json.loads(r.stdout) if x["kind"] == KIND]
    if not rows:
        print("難易度割れはありません")
        return

    cache, plans, bad = {}, [], []
    for x in rows:
        f = x["file"]
        if f not in cache:
            cache[f] = json.load(io.open(os.path.join(DATA, f), encoding="utf-8"))
        by = {q["id"]: q for q in cache[f] if isinstance(q, dict) and "id" in q}
        a = by.get(x["id"])
        b = by.get(x["msg"].split("同じ問題が ")[1].split("（")[0])
        if not a or not b:
            bad.append("%s：片割れが見つからない" % x["id"]); continue
        if a.get("src") or b.get("src"):
            bad.append("%s / %s は原簿由来なので触らない" % (a["id"], b["id"])); continue
        # 難易度が低いほう＝残す。同じなら解説がくわしいほう
        pair = sorted([a, b], key=lambda q: (
            float(q.get("difficulty") or 9),
            -len(str(q.get("meaning") or q.get("explain") or ""))))
        plans.append((f, pair[0], pair[1]))

    for m in bad:
        print("  ✗ " + m)
    if bad:
        print("\n✗ 触れないものがあるので書きこまない")
        sys.exit(1)

    print("1本にする組：%d組\n" % len(plans))
    thin = []
    for f, keep, drop in plans:
        cnt = collections.Counter(
            (str(q.get("grade")), str(q.get("difficulty")), str(q.get("unit")))
            for q in cache[f] if isinstance(q, dict))
        cell = (str(drop.get("grade")), str(drop.get("difficulty")), str(drop.get("unit")))
        after = cnt[cell] - 1
        print("── [%s] 小%s  %s" % (f, keep.get("grade"), str(keep.get("question"))[:44]))
        print("   残す %-9s 難%s  解説%d字" % (keep["id"], keep.get("difficulty"),
                                            len(str(keep.get("meaning") or keep.get("explain") or ""))))
        print("   消す %-9s 難%s  解説%d字  … %s 難%s のセル %d問 → %d問"
              % (drop["id"], drop.get("difficulty"),
                 len(str(drop.get("meaning") or drop.get("explain") or "")),
                 drop.get("unit"), drop.get("difficulty"), cnt[cell], after))
        if after < 10:
            thin.append("%s 小%s 難%s %s は %d問になる（もともと %d問）"
                        % (f, drop.get("grade"), drop.get("difficulty"), drop.get("unit"), after, cnt[cell]))
    if thin:
        print("\n⚠ 10問を割るセル（もともと薄い。消したせいで薄くなったのではない）")
        for t in thin:
            print("   ・" + t)

    if "--write" not in sys.argv:
        print("\n（--write で書きこむ）")
        return
    drop_by_file = collections.defaultdict(set)
    for f, keep, drop in plans:
        drop_by_file[f].add(drop["id"])
    for f, ids in drop_by_file.items():
        out = [q for q in cache[f] if not (isinstance(q, dict) and q.get("id") in ids)]
        p = os.path.join(DATA, f)
        with io.open(p, "w", encoding="utf-8") as fp:
            json.dump(out, fp, ensure_ascii=False, indent=1)
        json.load(io.open(p, encoding="utf-8"))
        print("  → %s（%d問消した）" % (f, len(ids)))
    print("\n✓ 書きこんだ。audit_questions.js を流し直して 0 になったか見ること")


if __name__ == "__main__":
    main()
