# -*- coding: utf-8 -*-
"""小5最レ 第3分冊 第2講座 No.24（hd5s_24k2_4〜16）〜 No.27（hd5s_27k2_4）の
塾講師監査（docs/_audit/s5sairei_w9/findings_2.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_s5sairei_w9_2.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
・29本を読んだが、指摘は1本だけ（中1件）。図SVGの追加・変更は無い。

直したもの（findings_2.md と対応。観点5＝解説が「なぜ」を説明しているか）:
  中1  hd5s_26k2_12（HG-3873・一郎君の忘れ物とバス）
    小問2（2910m）の解説が「(600+90)m/分で4分間」の「4分」の根拠を示さずに使っていた。
    小問3（4分5秒）の解説は「(2)で求めた図の続きから…4分5秒間となる」と答えを繰り返すだけで、
    計算が一切示されていなかった（原本の解答PDFにも(3)の計算は載っていないが、
    アプリは子どもが読むものなので、独立に解き直した計算をきちんと書く）。
    小問2は「なぜ4分か」（(1)の6分－2分）を補い、小問3は交差点とお母さんの追いつき点の
    位置をそれぞれ求めたうえで、バスに乗っていた時間□秒を求める式を立てて解く形に書きなおした。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 置きかえ表
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
 # ---- hd5s_26k2_12（HG-3873）小問2が「4分」の根拠を示さず使っていた ----
 ('hd5s_26k2_12',
  ('steps', 1, 'meaning'),
  '忘れ物に気づいた地点は、おかあさんがバスに乗った地点（150m）から、バスと一郎君が近づく速さ（600+90）m/分で4分間進んだ距離をたして150+(600+90)×4＝2910m。',
  '①(1)より、一郎君がもどり始めてから、お母さんに追いつかれて引き返すまでは6分間である。②お母さんが一郎君を見つけた（すれちがった）のはそこから2分前なので、もどり始めてから6－2＝4分後。③その4分間で、バス（分速600m）と一郎君（分速90m）はたがいに近づき合うので、忘れ物に気づいた地点は、おかあさんがバスに乗った地点（150m）からさらに(600+90)×4＝2760m先。150+2760＝2910m。'),
 # ---- 同・小問3は計算が一切示されず答えの繰り返しだけだった ----
 ('hd5s_26k2_12',
  ('steps', 2, 'meaning'),
  '(2)で求めた図の続きから、おかあさんがバスに乗っていた時間を求めると4分5秒間となる。',
  '①(2)より、すれちがったのはもどり始めてから4分後で、その地点は家から150+600×4＝2550m。②(1)より、お母さんに追いつかれて一郎君が引き返すのはもどり始めてから6分後で、その地点は家から2910－90×6＝2370m。③すれちがってから追いつくまでの2分＝120秒のうち、お母さんがバスに乗っていた時間を□秒とすると、バス（秒速10m）で□秒進み、残り(120－□)秒は走って（秒速2m）もどるので、2550＋10×□－2×(120－□)＝2370。整理すると12×□＝60、□＝5秒。④バスに乗っていた時間は、乗ってからすれちがうまでの4分と、すれちがってからの5秒を合わせて4分5秒。'),
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
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
