# -*- coding: utf-8 -*-
"""小5マスター算数（kokai No.2〜5）の監査2で見つかった不具合の修正パッチ。

対象：docs/_audit/g5m_w2/audit_2.txt の28本の突き合わせで見つかった
「解説がローマ字文字式（a,b／L,W）で方程式をそのまま解いている」2件。
小5は方程式・文字式が未習のため、□・△（浜学園の慣例記号）に置きかえる。
数値・答え・setSVG・問題文は一切変更しない（解説の文言だけを直す）。

使い方:
  python scripts/_fix_g5m_w2_2.py [対象JSONのパス（省略時 data/hama_daimon.json）]

書き戻すJSONは json.dumps(d, ensure_ascii=False, indent=1)。
大問は genbo_common.iter_daimon だけで引く。置換前に「その大問の中でちょうど1回」を
assert し、置換後の文字列がすでに入っていれば何もしない（冪等）。
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


def eprint(*a):
    sys.stderr.write(" ".join(str(x) for x in a) + "\n")


# ---------------------------------------------------------------------------
# 修正リスト: (daimon id, step index, old text, new text)
# ---------------------------------------------------------------------------
FIXES = [
    (
        "hd_5m_k02_635_4",
        2,
        "1こあたりに直すと A＝50円・B＝45円・C＝40円。全部Cの値段なら 150×40＝6000円。"
        "6540−6000＝540円が超過ぶん。Aは1こにつき10円高いので7a×10、Bは5円高いので10b×5。"
        "70a+50b＝540 → 7a+5b＝54。あてはまるのは a＝2、b＝8 だけ（このときC＝4箱）。",
        "1こあたりに直すと A＝50円・B＝45円・C＝40円。全部Cの値段なら 150×40＝6000円。"
        "6540−6000＝540円が超過ぶん。Aの箱数を□、Bの箱数を△とすると、Aは1こにつき10円高いので"
        "□×7×10、Bは5円高いので△×10×5だけ超過ぶんが増える。□×70＋△×50＝540 → □×7＋△×5＝54。"
        "あてはまるのは □＝2、△＝8 だけ（このときC＝4箱）。",
    ),
    (
        "hd_5m_k04_601_3",
        0,
        "一周たどると 長いほうの辺Lと短いほうの辺Wで 〔L＋W＋(L−W)〕が4組。"
        "整理すると 8×L で、短い辺は消える。8×7＝56cm。BC＝3cmは 実は いらない。",
        "一周たどると 長いほうの辺を□、短いほうの辺を△とすると 〔□＋△＋(□−△)〕が4組。"
        "整理すると 8×□ で、短い辺は消える。8×7＝56cm。BC＝3cmは 実は いらない。",
    ),
    (
        "hd_5m_k04_601_3",
        1,
        "BC＝W、CD＝L−W なので BC＋CD＝L。だから L＝9 で 8×9＝72cm。",
        "BC＝△、CD＝□−△ なので BC＋CD＝□。だから □＝9 で 8×9＝72cm。",
    ),
    (
        "hd_5m_k04_601_3",
        2,
        "8×L＝96 から L＝12。CD＝L−W＝7 から W＝5。12×5＝60cm²。",
        "8×□＝96 から □＝12。CD＝□−△＝7 から △＝5。12×5＝60cm²。",
    ),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)
    eprint("対象:", path)

    d = json.load(io.open(path, encoding="utf-8"))

    by_id = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id"):
            by_id.setdefault(x["id"], []).append(x)

    applied = 0
    skipped_idempotent = 0

    for daimon_id, step_idx, old, new in FIXES:
        recs = by_id.get(daimon_id)
        if not recs:
            eprint("✗ 見つからない大問id:", daimon_id)
            sys.exit(1)
        if len(recs) != 1:
            eprint("✗ 大問idが重複している:", daimon_id, len(recs))
            sys.exit(1)
        x = recs[0]
        steps = x.get("steps", [])
        if not (0 <= step_idx < len(steps)):
            eprint("✗ step indexが範囲外:", daimon_id, step_idx, "steps=", len(steps))
            sys.exit(1)
        step = steps[step_idx]
        cur = step.get("meaning", "")

        if cur == new:
            skipped_idempotent += 1
            continue

        if cur != old:
            eprint("✗ 期待した本文と一致しない（既に他の変更が入っている可能性）:")
            eprint("  id=", daimon_id, "step=", step_idx)
            eprint("  現在の meaning:", cur)
            sys.exit(1)

        # ちょうど1回だけ出現することを確認してから置換
        count_in_daimon = sum(
            1 for s in steps if s.get("meaning", "") == old
        )
        if count_in_daimon != 1:
            eprint("✗ 大問内に同じ本文が", count_in_daimon, "回ある（1回のはず）:", daimon_id)
            sys.exit(1)

        step["meaning"] = new
        applied += 1
        eprint("✓ 修正:", daimon_id, "step", step_idx)

    eprint("適用:", applied, "件 / 既に適用済み（冪等スキップ）:", skipped_idempotent, "件")

    if applied == 0:
        eprint("変更なし。書き出しは行わない。")
        return

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))
    eprint("書き出し完了:", path)


if __name__ == "__main__":
    main()
