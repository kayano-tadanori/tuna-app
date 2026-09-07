# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.22「立体図形(2)」の展開図5本を、原本どおりの図に差しかえる。

  使い方:  python scripts/_fix_g3mb_no22_svg.py [対象JSON]
           （省略時は data/hama_daimon.json）

  経緯:
    監査 g3mb-w4a-r1 / g3mb-w4b-r1（2026-09-05）で、この5本の図が
    「答えとされている展開図が実際には折りたためない」「6面あるはずが5面しかない」
    「答えに出てくる頂点ウが図に無い」など、図と答えが食いちがうと分かっていた。
    ただし当時は Google Drive（G:）が未マウントで原本PDFを開けず、
    想像で描き直すことを避けて修正を見送っていた。

    2026-09-07にG:が復活したので原本を確認し、図だけを作り直す。
    ★答え（answer/choices/meaning）は1文字も変えない。原本の解答PDF
      （3年_解答_3年マスター算数2分冊.pdf の29ページ）と突き合わせ、
      アプリ側の答えは5本とも全部正しいことを確認ずみ。壊れていたのは図だけ。

  検算（この差しかえの根拠）:
    - scripts/check_tenkaizu.py に新しい図の升目を入れて実際に折り、
      大問1は②④だけ・大問2は①③⑥だけが組み立つことを確認（解答と一致）。
    - HG-4242 は折った結果 面㋐↔面㋒／面㋓↔面㋕、点セ=点シ・点エ=点ク、
      辺オカ=辺キカ・辺ケコ=辺ウイ となり、アプリの答え7問すべてと一致。
    - HG-4243 は①②とも 3の向かいが「う」＝4の目は面う で、アプリの答えと一致。
      さらに①②とも向かい合う面の和がすべて7になることを確認（原本の前提と整合）。

  図の作り方は scripts/gen_g3mb_no22_svg.py（原本の升目を300dpiで実測して起こしたもの）。
"""
import hashlib
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon, hgof          # noqa: E402
from gen_g3mb_no22_svg import BUILDERS              # noqa: E402

# 差しかえる大問と、その原簿番号（取りちがえの安全網）
TARGETS = {
    "hd3mb_22_1": "HG-4238",
    "hd3mb_22_2": "HG-4239",
    "hd3mb_22_3": "HG-4240",
    "hd3mb_22_5": "HG-4242",
    "hd3mb_22_6": "HG-4243",
}

# 差しかえる前の図のSHA1（別セッションが先に直していたら気づけるように）
OLD_SHA1 = {
    "hd3mb_22_1": "39318461745e",
    "hd3mb_22_2": "3204f656674e",
    "hd3mb_22_3": "a788ae52c0f2",
    "hd3mb_22_5": "a819055cb3d8",
    "hd3mb_22_6": "eb237fbb04fe",
}


def sha1(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    target = args[0] if args else os.path.join(BASE, "data", "hama_daimon.json")
    check_only = "--check" in sys.argv

    d = json.load(io.open(target, encoding="utf-8"))

    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in TARGETS:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(TARGETS) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in TARGETS.items():
        got = hgof(found[did]) or []
        assert hg in got, "%s: hg mismatch (expected %s, got %r)" % (did, hg, got)

    new_svg = {k: BUILDERS[k]() for k in TARGETS}

    changed = skipped = 0
    for did in TARGETS:
        cur = found[did].get("svg", "")
        if cur == new_svg[did]:            # 冪等：すでに差しかえずみ
            skipped += 1
            continue
        sys.stdout.write("  %s (%s): svg %d -> %d chars  [old sha1 %s]\n"
                         % (did, TARGETS[did], len(cur), len(new_svg[did]), sha1(cur)[:12]))
        if not check_only:
            found[did]["svg"] = new_svg[did]
        changed += 1

    if check_only:
        sys.stdout.write("check only: would change=%d  already-ok=%d\n" % (changed, skipped))
        return 0

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n"
                     % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
