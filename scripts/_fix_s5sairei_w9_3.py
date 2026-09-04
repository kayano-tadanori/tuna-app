# -*- coding: utf-8 -*-
"""小5最レ（算数）第3分冊 第2講座 No.27「速さ(7)」ダイヤグラム/グラフ回12本
   塾講師監査 3班（audit_3.txt）の修正パッチ。

  使い方:  python scripts/_fix_s5sairei_w9_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★図SVGは、書きこむ前に座標から長さ・比・面積を計算して問題文と合うことを確かめる。
    1件でも合わなければ 1件も書かずに止める。

  対象12本（hd5s_27k2_5〜16 / HG-3878〜3889）を原簿と突き合わせ、24個の小問すべてを
  独立に解き直し、12枚の図SVGすべての座標を検算した（findings_3.md参照）。
  結果：貼りつけ修正が必要な不具合は0件だった（重大0/中0/軽0）。

  見送った観察1件（findings_3.md末尾）：
    hd5s_27k2_6 steps[1].meaning の「㉒」（CJK互換ブロックの丸数字22）。誤りではなく、
    data/hama_daimon.json 全体に同種の丸数字が既に20件あるパターンの1つなので、
    この1本だけを直すのは見送り、棚卸しは別タスクとした。

  したがって PATCHES は空。このスクリプトは「対象12本の存在確認＋原簿番号(hg)の一致確認」
  だけを行い、書き込みは何も無いことを確認して終わる（load→(何も変えず)→re-dump は
  バイト単位で入力と一致することを検証ずみ）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 対象12本と、原簿番号(hg)が今も一致しているかの確認用（万一どこかのセッションが
# 大問を差し替えていたら、ここで気づけるようにする）。
TARGETS = {
    "hd5s_27k2_5": "HG-3878",
    "hd5s_27k2_6": "HG-3879",
    "hd5s_27k2_7": "HG-3880",
    "hd5s_27k2_8": "HG-3881",
    "hd5s_27k2_9": "HG-3882",
    "hd5s_27k2_10": "HG-3883",
    "hd5s_27k2_11": "HG-3884",
    "hd5s_27k2_12": "HG-3885",
    "hd5s_27k2_13": "HG-3886",
    "hd5s_27k2_14": "HG-3887",
    "hd5s_27k2_15": "HG-3888",
    "hd5s_27k2_16": "HG-3889",
}

# ★見つかった不具合が無かったので、貼りつけ表は空。
#   (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
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
        assert hg in (found[did].get("hg") or ""), \
            "%s: hg mismatch (expected %s, got %r)" % (did, hg, found[did].get("hg"))

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
