# -*- coding: utf-8 -*-
"""4学年 master fukushu No.27〜kokai No.2（hd_4m_f27_7〜hd_4m_k02_623_5）の
塾講師監査（docs/_audit/g4m_w1/findings_2.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g4m_w1_2.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
・44本を読み、原簿との数値・答え・図の座標を独立検算した。指摘は1本だけ（重大1件）。
  図SVGの追加・変更は無い（見送り含め、図に関する修正はゼロ）。

直したもの（findings_2.md と対応）:
  重大1  hd_4m_f39_5a（HG-0886・入れる先がちがう2つの話）
    小問1（「はじめ赤には何Lか」＝44L）の解説が、赤＋12＝白×7 と 赤＝(白+3)×4 を
    「立てて解く」とだけ書いたあと、答えの数値として「白8L・赤44L」と両方を書いていた。
    白の量は小問2（「はじめ白には何Lか」）で初めて聞かれる値なので、小問1の時点で
    見えてしまうと小問2が解く前から答え合わせになってしまう。
    小問1の解説を、白を消去して赤だけを直接求める式（4倍・7倍して「白×28」をそろえ、
    引き算で3×赤＝132を出す）に書きかえ、白の数値には触れない形にした。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 置きかえ表
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
 # ---- hd_4m_f39_5a（HG-0886）小問1の解説が、小問2で聞く「白」の答えを先出ししていた ----
 ('hd_4m_f39_5a',
  ('steps', 0, 'meaning'),
  '入れる先が 赤と白で 入れかわるので「差は変わらない」が使えない。赤＋12＝白×7、赤＝(白+3)×4 の2本を 立てて解く。白8L・赤44L。',
  '入れる先が 赤と白で 入れかわるので「差は変わらない」が使えない。赤＋12＝白×7 と 赤＝白×4+12 の2本を、白の分をそろえるため4倍・7倍すると、どちらも「白×28」をふくむ形になる。2つの式をくらべて白を消すと 3×赤＝132 が残り、赤は44Lとわかる。'),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[p] if isinstance(p, int) else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く
    want = set(p[0] for p in PATCHES)
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in want:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = want - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))

    changed = skipped = 0
    for did, path, old, new in PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)" % (did, "/".join(map(str, path)))
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    print("changed=%d  skipped(already-fixed)=%d  target=%s" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
