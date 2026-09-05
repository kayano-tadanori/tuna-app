# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 fukushu No.22〜No.23 塾講師監査2班（audit_2.txt）の修正パッチ。

  使い方:  python scripts/_fix_g3mb_w4_2.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★図SVGは、書きこむ前に座標から長さ・角度・個数を計算して問題文と合うことを確かめ、
    1件でも合わなければ1件も書かずに止める方針。

  23本を原簿と突き合わせ、独立に解き直した結果（findings_2.md参照）:
    重大3・中0・軽0。

  1) hd3mb_22_4（HG-4241）steps[0] の答えが誤り。
     3D展開シミュレータ（scratchpad/fold_sim.py、HG-4245・HG-4246の正答で検証済み）で
     検算すると、この展開図（え・い・お・かが横一直線、あ・うがいの上下）では
     「面かと平行になる面」は面い（面えではない）。ここだけ修正する。

  2) hd3mb_22_5（HG-4242）・hd3mb_22_6（HG-4243）は、図SVGの座標が展開図として
     成立しない／自己矛盾する不具合を見つけたが、正しい図を復元するには本文p79の
     実物PDFが要る。このセッションのサンドボックスからは原本PDFの置き場
     （`Desktop\\浜問題\\` の実体である `G:\\マイドライブ\\浜問題`）にアクセスできず
     （Gドライブ未マウント）、正しい図・答えを確定できないため、
     **貼りつけ修正は書かない**（findings_2.md の「見送った項目」参照）。
     このスクリプトでは対象2本の存在確認（原簿番号が今も一致しているか）だけ行う。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon, hgof


# 修正は書かないが、原簿番号が今も一致しているかだけ確認しておく対象
# （本文で「見送った」と書いた2本。将来このidの中身が差し替わっていないかの安全網）
CHECK_ONLY = {
    "hd3mb_22_5": "HG-4242",
    "hd3mb_22_6": "HG-4243",
}

# 修正の対象と、原簿番号が今も一致しているかの確認用
TARGETS = {
    "hd3mb_22_4": "HG-4241",
}

# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
    ("hd3mb_22_4", ("steps", 0, "answer"),
     "面え",
     "面い"),
    ("hd3mb_22_4", ("steps", 0, "choices"),
     ["面え", "面あ", "面い", "面う"],
     ["面い", "面あ", "面え", "面う"]),
    ("hd3mb_22_4", ("steps", 0, "meaning"),
     "1つおきの面が平行。",
     "え・い・お・かは一直線。1つとなり（お）は垂直、2つとなり（1つおいた隣）が平行になる。面かの2つとなりは面い。"),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[int(p)] if str(p).isdigit() and not isinstance(node, dict) else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く（存在確認・原簿番号の一致確認）
    all_ids = dict(TARGETS)
    all_ids.update(CHECK_ONLY)
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in all_ids:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(all_ids) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in all_ids.items():
        got = hgof(found[did]) or []
        assert hg in got, "%s: hg mismatch (expected %s, got %r)" % (did, hg, got)

    changed = skipped = 0
    for did, path, old, new in PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?) got=%r" % (
            did, "/".join(map(str, path)), cur)
        # 「大問の中でちょうど1回」の確認: dig() で欄そのものをピンポイントに指しているので
        # 置換先の取り違えは起きない（choices/生の文字列検索に頼っていない）。
        # ★ここでは意図的に「大問全体の文字列に old が1回だけ出る」は確認しない。
        #   steps[0].answer の値"面え"は、choices[0]にも同じ文字列がそのまま入るのが
        #   この形式の正しい姿（answerはchoicesの中の1つと必ず一致する）なので、
        #   大問全体を文字列化すると"面え"は2回出るのが正常。ここで1回のみを要求すると
        #   正しいレコードまで誤検出してしまう（実際に確認して2回だった）。
        node[key] = new
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
