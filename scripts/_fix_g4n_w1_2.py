# -*- coding: utf-8 -*-
"""小4灘中合格特訓（nadago）週1・塾講師監査2班（audit_2.txt）の修正パッチ。

  使い方:  python scripts/_fix_g4n_w1_2.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★対象48本（hd4n_08_1〜hd4n_08_11／hd4n_10_1〜hd4n_10_17／hd4n_12_1〜hd4n_12_11／
    hd4n_03_1〜hd4n_03_9）のうち、直しが必要だったのは3本だけ（findings_2.md参照）。
    残りの45本は検算・SVG座標の実測とも問題なし。

  直した3本（すべて「答え」自体は正しく、文章表現だけの不具合）:
    1. hd4n_12_11（HG-2430）steps[0].meaning … 小問1の解説が2位・3位の答えを先出ししていた
       （分割問題の計算チェーン先出し。過去の監査で最頻出のパターン）
    2. hd4n_08_5（HG-2376） steps[0].meaning … 「2d＝9×2=18よりd＝9」という循環論法の途中式
    3. hd4n_10_11（HG-2401）intro … コア発見（8倍になる関係式）をintroで先出ししていた

  見送り（原本PDF未確認・このスクリプトには含めない）:
    - hd4n_03_3（HG-2328）… 原簿自身が「斜線部分＝推定」と明記。実物PDF未確認。
    - hd4n_03_5（HG-2330）… 同上。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 対象48本と、原簿番号(hg="src")が今も一致しているかの確認用（万一どこかのセッションが
# 大問を差し替えていたら、ここで気づけるようにする）。
TARGETS = {
    "hd4n_08_1": "HG-2372", "hd4n_08_2": "HG-2373", "hd4n_08_3": "HG-2374",
    "hd4n_08_4": "HG-2375", "hd4n_08_5": "HG-2376", "hd4n_08_6": "HG-2377",
    "hd4n_08_7": "HG-2378", "hd4n_08_8": "HG-2379", "hd4n_08_9": "HG-2380",
    "hd4n_08_10": "HG-2381", "hd4n_08_11": "HG-2382",
    "hd4n_10_1": "HG-2391", "hd4n_10_2": "HG-2392", "hd4n_10_3": "HG-2393",
    "hd4n_10_4": "HG-2394", "hd4n_10_5": "HG-2395", "hd4n_10_6": "HG-2396",
    "hd4n_10_7": "HG-2397", "hd4n_10_8": "HG-2398", "hd4n_10_9": "HG-2399",
    "hd4n_10_10": "HG-2400", "hd4n_10_11": "HG-2401", "hd4n_10_12": "HG-2402",
    "hd4n_10_13": "HG-2403", "hd4n_10_14": "HG-2404", "hd4n_10_15": "HG-2405",
    "hd4n_10_16": "HG-2406", "hd4n_10_17": "HG-2407",
    "hd4n_12_1": "HG-2420", "hd4n_12_2": "HG-2421", "hd4n_12_3": "HG-2422",
    "hd4n_12_4": "HG-2423", "hd4n_12_5": "HG-2424", "hd4n_12_6": "HG-2425",
    "hd4n_12_7": "HG-2426", "hd4n_12_8": "HG-2427", "hd4n_12_9": "HG-2428",
    "hd4n_12_10": "HG-2429", "hd4n_12_11": "HG-2430",
    "hd4n_03_1": "HG-2326", "hd4n_03_2": "HG-2323", "hd4n_03_3": "HG-2328",
    "hd4n_03_4": "HG-2329", "hd4n_03_5": "HG-2330", "hd4n_03_6": "HG-2321",
    "hd4n_03_7": "HG-2322", "hd4n_03_8": "HG-2324", "hd4n_03_9": "HG-2325",
}

# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
    (
        "hd4n_12_11", ("steps", 0, "meaning"),
        "共通の時間をk秒とおくと、A君の合計は(k−6)+(k−4)+(k−2)+k＝4k−12、B君の合計は2k+(2k+8)＝4k+8、"
        "C君の合計は(k+3)+k+(k−3)+(k−6)＝4k−6。この式はkの値によらず常にA<C<Bとなるので、"
        "1位**A君**・2位C君・3位B君。",
        "共通の時間をk秒とおくと、A君の合計は(k−6)+(k−4)+(k−2)+k＝4k−12、B君の合計は2k+(2k+8)＝4k+8、"
        "C君の合計は(k+3)+k+(k−3)+(k−6)＝4k−6。この式はkの値によらず常にA<C<Bとなるので、"
        "合計時間がいちばん短い**A君**が1位です。",
    ),
    (
        "hd4n_08_5", ("steps", 0, "meaning"),
        "太郎の勝ちa回・負けb回・引き分けd回とすると、a+b+d＝28、3a−2b−d＝8、3b−2a−d＝−7。"
        "後ろの2式を引くと5a−5b＝15よりa−b＝3。後ろの2式を足すとa+b−2d＝1、これと(28−d)から"
        "2d＝9×2=18よりd＝9(勝ち11回、負け8回)。",
        "太郎の勝ちa回・負けb回・引き分けd回とすると、a+b+d＝28、3a−2b−d＝8、3b−2a−d＝−7。"
        "後ろの2式を引くと5a−5b＝15よりa−b＝3。後ろの2式を足すとa+b−2d＝1。a+b＝28−dなので、"
        "(28−d)−2d＝1より28−3d＝1、3d＝27でd＝9(勝ち11回、負け8回)。",
    ),
    (
        "hd4n_10_11", ("intro",),
        "あるカレンダーで、ある数のまわりを囲む8個の数(上下左右とななめ4か所)の和を考えます。"
        "まわりの8個は中央の数を軸に2つずつ対になっていて、それぞれの対の和は中央の数の2倍になります。"
        "4つの対があるので、まわりの8個の和は中央の数の8倍になります。",
        "あるカレンダーで、ある数のまわりを囲む8個の数(上下左右とななめ4か所)の和を考えます。",
    ),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象48本を iter_daimon だけで引く（存在確認・原簿番号の一致確認・総数の突き合わせ）
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in TARGETS:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(TARGETS) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in TARGETS.items():
        assert found[did].get("src") == hg, \
            "%s: src mismatch (expected %s, got %r)" % (did, hg, found[did].get("src"))

    changed = skipped = 0
    for did, path, old, new in PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)\n  cur=%r" % (
            did, "/".join(map(str, path)), cur)
        # その大問（id単位）の中で、この文字列がちょうど1回だけ出ることを確かめる
        dumped = json.dumps(x, ensure_ascii=False)
        n = dumped.count(old)
        assert n == 1, "%s %s: appears %d times in the daimon (expected 1)" % (
            did, "/".join(map(str, path)), n)
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
