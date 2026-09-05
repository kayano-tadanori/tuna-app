# -*- coding: utf-8 -*-
"""小4理科 復習テスト No.16〜34（fukushu No.16〜34・17本）の監査で見つかった不具合を直すパッチ。

対象: docs/_audit/g4r_w1/audit_1.txt の17本の監査で見つかった問題。

修正1: hd_4r_f39_6（HG-0792・「ひもの長さは 関係ない」）
  小問4（「おもりAを右に10cm, 支点はそのままで動かすと」）の解説が、
  Aの新しい位置を「支点の右5cmに移る」と書いていたが、これは誤り。
  Aはもともと支点の左15cmにあり、右へ10cm動かしても 15-10=5 で
  まだ支点の左5cmのまま（支点を越えて右側には移らない）。
  さらに「右750＋α」という未計算の曖昧な表現も残っていた。
  原簿（HG-0792の解法「(6) 左50×5＝250＜750」）どおりの、
  向きが正しくすっきりした式に書きかえる。最終的な答え（右に傾く）は
  誤りではなく変えない。解説文だけを直す。

使い方:
  python scripts/_fix_g4r_w1_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

冪等: 欄がすでに新しい文言なら何もしない（旧文言が0件でもエラーにしない）。
"""
import json, io, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "hama_daimon.json")

    d = json.load(io.open(path, encoding="utf-8"))

    OLD = "Aが支点の右5cmに移るので、左右とも「右」に重さがのる形になる。左（支点から見て逆向き）250、右750＋αとなり **右に傾く**。"
    NEW = "Aは支点の左5cm（15−10）に移る（Bは支点の右25cmのまま）。左＝50×5＝250、右＝30×25＝750。右のほうが大きいので **右に傾く**。"

    applied = 0
    already = 0
    target_found = False

    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") != "hd_4r_f39_6" or x.get("src") != "HG-0792":
            continue
        target_found = True
        steps = x.get("steps", [])
        hits = [s for s in steps if s.get("question", "").startswith("おもりAを右に10cm")]
        assert len(hits) == 1, "hd_4r_f39_6: 「Aを右に10cm」の小問が1つだけのはずが %d 件" % len(hits)
        step = hits[0]
        cur = step.get("meaning", "")
        if cur == NEW:
            already += 1
            continue
        n_old = sum(1 for s in steps if s.get("meaning") == OLD)
        assert n_old == 1, "hd_4r_f39_6: 旧文言がちょうど1回のはずが %d 件（cur=%r）" % (n_old, cur)
        assert step.get("meaning") == OLD, "hd_4r_f39_6: 対象小問の解説が想定の旧文言と一致しない: %r" % cur
        step["meaning"] = NEW
        applied += 1

    assert target_found, "hd_4r_f39_6（HG-0792）が見つからない"

    if applied:
        data = json.dumps(d, ensure_ascii=False, indent=1)
        with io.open(path, "wb") as f:
            f.write(data.encode("utf-8"))
        print("applied=%d already=%d -> wrote %s" % (applied, already, path))
    else:
        print("applied=0 already=%d -> no write (idempotent)" % already)


if __name__ == "__main__":
    main()
