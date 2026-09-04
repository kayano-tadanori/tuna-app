# -*- coding: utf-8 -*-
"""図のラベルが「線に重なって読めない」3件を直す（2026-09-04・司令塔の実測から）。

  ①hd5s_00_1 … 交点のラベル A・B が #e8ecf5（ほぼ白）で、**色のついた弧の上に乗る前提**で
                 置かれていた（弧から少しでもずれると白地に白で消える）。濃い色＋白ふちどりにして
                 交点の外へ出す（A=真上・B=真下）。実測のスクショで重なりを確認したのが発端
  ②hd5s_15_2 … E が地に溶けて読めない（check_text_contrast 差42.9）
  ③hd5m_09_5 … A が地に溶けて読めない（差51.0・監査より前からあったぶん）

  ②③は色を変えず**白いふちどり**を付けて分離する（色の意味を変えないため）。
  冪等：すでに直っていれば書かない。
"""
import io, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G

HALO = ' paint-order="stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round"'

EDITS = [
    # (id, 置きかえ前, 置きかえ後)
    ("hd5s_00_1",
     '<text x="127" y="26" font-size="12" font-family="sans-serif" fill="#e8ecf5">A</text>',
     '<text x="121" y="20" font-size="12" text-anchor="middle" font-family="sans-serif"'
     ' fill="#1a2340"%s>A</text>' % HALO),
    ("hd5s_00_1",
     '<text x="127" y="147" font-size="12" font-family="sans-serif" fill="#e8ecf5">B</text>',
     '<text x="121" y="151" font-size="12" text-anchor="middle" font-family="sans-serif"'
     ' fill="#1a2340"%s>B</text>' % HALO),
    ("hd5s_15_2",
     '<text x="127" y="122" font-size="11" font-family="sans-serif" fill="#1a2340">E</text>',
     '<text x="127" y="122" font-size="11" font-family="sans-serif" fill="#1a2340"%s>E</text>' % HALO),
    ("hd5m_09_5",
     '<text x="210" y="41" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">A</text>',
     '<text x="210" y="41" font-size="12" text-anchor="middle" font-family="sans-serif"'
     ' fill="#1a2340"%s>A</text>' % HALO),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(G.BASE, "data", "hama_daimon.json")
    raw = io.open(path, "rb").read()
    d = json.loads(raw.decode("utf-8"))
    ix = {r["x"]["id"]: r["x"] for r in G.iter_daimon(d)}
    done = skip = 0
    for did, old, new in EDITS:
        x = ix[did]
        s = x.get("svg") or ""
        if new in s:
            skip += 1
            continue
        assert s.count(old) == 1, "%s: 置きかえ元が %d 回（1回でないとだめ）" % (did, s.count(old))
        x["svg"] = s.replace(old, new)
        done += 1
        print("  直した %s" % did)
    if not done:
        print("変更なし（すでに全部あたっている）")
        return
    out = (json.dumps(d, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    io.open(path, "wb").write(out)
    print("---- %d か所 直した（飛ばした %d）／ %d → %d バイト" % (done, skip, len(raw), len(out)))


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
