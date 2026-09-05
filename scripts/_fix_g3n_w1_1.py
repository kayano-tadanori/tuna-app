# -*- coding: utf-8 -*-
"""小3灘中合格特訓（第2〜4回・fukushu No.2〜4）の監査で見つかった不具合を直すパッチ。

対象: docs/_audit/g3n_w1/audit_1.txt の29本の監査で見つかった問題。

修正1: hd3n_02_4（HG-1904・ア〜キの相異なる整数）
  小問3（カ）の解説が、次の小問4（オ）の答え「オ＝2」を先出ししていた。
  「原簿と食いちがっていなくても、分割の都合で未回答の小問の値が解説に
  見えてしまう」不具合として、値を出さない言い回しに書きかえる。

使い方:
  python scripts/_fix_g3n_w1_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

冪等: 欄がすでに新しい文言なら何もしない（旧文言が0件でもエラーにしない）。
"""
import json, io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "hama_daimon.json")

    d = json.load(io.open(path, encoding="utf-8"))

    OLD = "〔4〕オ×カ＝イ と〔1〕オ＋キ＝イ を合わせると オ×カ＝オ＋キ。〔2〕ウ＋カ＝9 も使うと、カ＝4・オ＝2 のときだけ全部が別の数になります。"
    NEW = "〔4〕オ×カ＝イ と〔1〕オ＋キ＝イ を合わせると オ×カ＝オ＋キ。〔2〕ウ＋カ＝9 も使って、1から9の中で他の数と重ならない組み合わせを探すと、カ＝4 のときだけ成り立ちます。"

    applied = 0
    already = 0
    target_found = False

    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") != "hd3n_02_4" or x.get("src") != "HG-1904":
            continue
        target_found = True
        steps = x.get("steps", [])
        # 「カ」を聞いている小問（answer=="4"）を特定する
        hits = [s for s in steps if s.get("question", "").startswith("カにあてはまる数")]
        assert len(hits) == 1, "hd3n_02_4: 「カ」の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        cur = step.get("meaning", "")
        if cur == NEW:
            already += 1
            continue
        n_old = sum(1 for s in steps if s.get("meaning") == OLD)
        assert n_old == 1, "hd3n_02_4: 旧文言がちょうど1回のはずが %d 件（cur=%r）" % (n_old, cur)
        assert step.get("meaning") == OLD, "hd3n_02_4: 「カ」の小問の解説が想定の旧文言と一致しない: %r" % cur
        step["meaning"] = NEW
        applied += 1

    assert target_found, "hd3n_02_4（HG-1904）が見つからない"

    if applied:
        data = json.dumps(d, ensure_ascii=False, indent=1)
        with io.open(path, "wb") as f:
            f.write(data.encode("utf-8"))
        print("applied=%d already=%d -> wrote %s" % (applied, already, path))
    else:
        print("applied=0 already=%d -> no write (idempotent)" % already)


if __name__ == "__main__":
    main()
