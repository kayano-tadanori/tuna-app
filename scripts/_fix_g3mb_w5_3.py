# -*- coding: utf-8 -*-
"""小3マスター算数 宿題テキスト fukushu No.16〜No.34 塾講師監査 3班（audit_3.txt）の修正パッチ。

  使い方:  python scripts/_fix_g3mb_w5_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★図SVGの修正は無い（今回は文章の解説だけ）。原本PDF未確認の1件（HG-4400 図⑤の
    答え/図の食い違い）は findings_3.md に記録するのみで、ここには含めない。

  見つかった不具合（findings_3.md参照）：
   1) hd3mb_32_17（HG-4380）steps[0]/[1] の meaning が、原簿の1本の解説文
      「①…=6(とおり)　②…から①の6を引いて12-6=6(とおり)」を①②の文字の位置で
      機械的に割ったため、①の中に出てくる後方参照の「①」でも割れてしまい、
      両方の小問の解説が意味の通らない断片になっていた。
   2) hd3mb_34_1（HG-4399）steps[1]/[2] も同じ原因（②の中の後方参照「②」で誤って
      割れる）で、steps[1]の解説が③の答え(6)を示す断片のまま終わり、steps[2]の
      解説が結論（=6）まで届かず「それぞれ」で切れていた。
  いずれも答え(answer)自体は正しく、meaning（かんたん解説）の文章だけを、
  各小問が単独で読んでも意味が通るように書き直した（数値・論理は原簿の解法を保持）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 対象2本と、原簿番号(hg)が今も一致しているかの確認用（万一どこかのセッションが
# 大問を差し替えていたら、ここで気づけるようにする）。
TARGETS = {
    "hd3mb_32_17": "HG-4380",
    "hd3mb_34_1": "HG-4399",
}

# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
    (
        "hd3mb_32_17", ("steps", 0, "meaning"),
        "の6を引いて12-6=6(とおり)",
        "「11」を1つのかたまりとみて、かたまり・2・3の3つを並べる=3!=6(とおり)",
    ),
    (
        "hd3mb_32_17", ("steps", 1, "meaning"),
        "全部の並べ方4!/2!=12(とおり)から",
        "全部の並べ方4!/2!=12(とおり)から、1と1がとなり合った6とおりを引いて12-6=6(とおり)",
    ),
    (
        "hd3mb_34_1", ("steps", 1, "meaning"),
        "と同じく2とおりずつ=2×3=6(とおり)",
        "AC=赤で固定、Bは残り2色のどちらか=2(とおり)",
    ),
    (
        "hd3mb_34_1", ("steps", 2, "meaning"),
        "AC同色にする2色の組み合わせは3通り、それぞれ",
        "AC同色にする2色の組み合わせは3通り、それぞれAC=赤のときと同じく2とおりずつ=2×3=6(とおり)",
    ),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[int(p)] if str(p).isdigit() else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く（存在確認・原簿番号の一致確認）
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in TARGETS:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(TARGETS) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in TARGETS.items():
        assert hg in (found[did].get("src") or ""), \
            "%s: hg mismatch (expected %s, got %r)" % (did, hg, found[did].get("src"))

    changed = skipped = 0
    for did, path, old, new in PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)" % (did, "/".join(map(str, path)))
        # その大問の中で、この文字列がちょうど1回だけ出ることを確かめる
        n = json.dumps(x, ensure_ascii=False).count(json.dumps(old, ensure_ascii=False)[1:-1])
        assert n == 1, "%s %s: appears %d times in the daimon (expected 1)" % (did, "/".join(map(str, path)), n)
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
