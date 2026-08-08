# -*- coding: utf-8 -*-
"""選択肢・答えに英単語がまぎれこんでいたのを直す（2026-08-08）。

[[oton_kokugo_audit]] に「選択肢に説明文や壊れた文字列。『 page頁』（英字混入）。48か所」と
記録がある型が、まだ7件残っていた。**日本語のところに英単語がそのまま入っている。**

  gi149  「changes改善」          → 「改善」
  rd199  「north向きにする」      → 「北向きにする」
  rp063  「north にむく」         → 「きた にむく」（小1なのでかな）
  rp146  「…水を control したみ」 → 「…水を コントロール したみ」（★答えなので実害が大きい）
  rk961  「north を いつも…」     → 「北 を いつも…」
  sr037  「safety・手間が へった」→ 「安全・手間が へった」（★答え）
  sr393  「one人で生きる大切さ」  → 「一人で生きる大切さ」

★直す語は解説から決めた（解説はどれも正しい日本語で書かれていた）。
★学年に合う表記にする（小1は「きた」、小3以上は「北」）。
★大文字の略語（LED・BTB・PKO・kWh）やかっこ書きの原語（Primary（最初））は正当なので触らない。

  python scripts/fix_english_mixin.py          … 何が変わるか見るだけ
  python scripts/fix_english_mixin.py --write  … 書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

# ファイル → { 問題id: [(直す前, 直したあと), …] }
FIXES = {
    "kokugo_goi.json":       {"gi149": [("changes改善", "改善")]},
    "rika_denki.json":       {"rd199": [("north向きにする", "北向きにする")]},
    "rika_shokubutsu.json":  {"rp063": [("north にむく", "きた にむく")],
                              "rp146": [("水を control したみ", "水を コントロール したみ")]},
    "rika_sora.json":        {"rk961": [("north を いつも 上に する", "北 を いつも 上に する")]},
    "shakai_rekishi.json":   {"sr037": [("safety・手間が へった", "安全・手間が へった")],
                              "sr393": [("one人で生きる大切さ", "一人で生きる大切さ")]},
}
FIELDS = ("question", "answer", "meaning")


def main():
    done, already, bad = [], [], []
    for fname, per_id in FIXES.items():
        path = os.path.join(DATA, fname)
        data = json.load(io.open(path, encoding="utf-8"))
        changed = False
        for q in data:
            if not isinstance(q, dict):
                continue
            pairs = per_id.get(q.get("id"))
            if not pairs:
                continue
            hit = []
            for old, new in pairs:
                for k in FIELDS:
                    if isinstance(q.get(k), str) and old in q[k]:
                        q[k] = q[k].replace(old, new); hit.append(k)
                for i, c in enumerate(q.get("choices") or []):
                    if isinstance(c, str) and old in c:
                        q["choices"][i] = c.replace(old, new); hit.append("choices[%d]" % i)
            if hit:
                changed = True
                done.append((fname, q["id"], sorted(set(hit))))
                print("■ %s %s  直した所: %s" % (fname, q["id"], "／".join(sorted(set(hit)))))
                print("   A: %r" % q.get("answer"))
                print("   C: %s" % q.get("choices"))
                # 直したあとの整合
                ch = q.get("choices")
                if isinstance(ch, list) and ch and q.get("answer") not in ch:
                    bad.append("%s：答えが選択肢に無い" % q["id"])
                if isinstance(ch, list) and len(set(map(str, ch))) != len(ch):
                    bad.append("%s：選択肢が重複" % q["id"])
                print()
            else:
                already.append(q["id"])
        if changed and "--write" in sys.argv:
            with io.open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=1)
            json.load(io.open(path, encoding="utf-8"))

    print("直した：%d問／すでに直っていた：%d問" % (len(done), len(already)))
    for b in bad:
        print("  ✗ " + b)
    if bad:
        sys.exit(1)
    print("✓ 書きこんだ" if "--write" in sys.argv else "（--write で書きこむ）")


if __name__ == "__main__":
    main()
