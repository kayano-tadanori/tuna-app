# -*- coding: utf-8 -*-
"""小4マスター算数（公開テスト No.1）の塾講師監査
（docs/_audit/g4m_w4/findings_1.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g4m_w4_1.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
・23本を読み、指摘は中2件（findings_1.md）。答えはどちらも変えていない。
  図SVGの追加・変更は無い（図が絡む指摘は0件だったので、原本未確認による見送りも無い）。

直したもの（findings_1.md と対応）:

  中1  hd_4m_k01_586_1（HG-3467・貯金がちょうど3倍になる月）
    唯一の小問の解説が「x か月後、9200＋80x＝3×(800＋140x) を解くと x＝20」と、
    "x"というローマ字の未知数を使って一次方程式をそのまま解いていた（小4は方程式・
    文字式が未習）。「差を追いかける」道すじ（しょう君の貯金がけい君の3倍より
    いくら多いかの差が、毎月340円ずつちぢまり、6800÷340＝20か月で0になる）に
    書きかえた。答え（20）は変えていない。

  中2  hd_4m_k01_598_1（HG-3433・バス料金・乗降人数の逆算）小問3
    「B→C客をx人とすると、料金合計は34800＋100xとなり…」と、ここでも"x"の
    一次方程式を使っていた。「B→C行きの客が1人ふえるたびに合計が100円ずつ多くなる」
    という単位あたりの増分で1000÷100＝10人を出す道すじに書きかえた。答え（12）は
    変えていない。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 単純な文字置きかえ
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
TEXT_PATCHES = [
 # ---- hd_4m_k01_586_1（HG-3467）唯一の小問の解説が x の一次方程式のままだった ----
 ("hd_4m_k01_586_1",
  ("steps", 0, "meaning"),
  "x か月後、9200＋80x＝3×(800＋140x) を解くと x＝20。20か月後にはしょう君10800円、けい君3600円で確かに3倍です。",
  "いま、しょう君の貯金9200円は、けい君の貯金の3倍（800×3＝2400円）より9200−2400＝6800円多い。\n毎月、しょう君は80円、けい君の3倍は140×3＝420円ずつ増えるので、差は毎月420−80＝340円ずつちぢまる。\n6800÷340＝20か月後にちょうど差が0になり、3倍になる。（確かめ:20か月後はしょう君10800円、けい君3600円で10800＝3600×3。）"),

 # ---- hd_4m_k01_598_1（HG-3433）小問3の解説が x の一次方程式のままだった ----
 ("hd_4m_k01_598_1",
  ("steps", 2, "meaning"),
  "B→C客をx人とすると、料金合計は34800＋100xとなり、35800円からx＝10人。C→D新規客＝2＋10＝12人です。",
  "小問2の34800円は、Bで乗った23人が全員Dまで乗ったと仮定した金額。実際の合計35800円は、そこから35800−34800＝1000円多い。\nもしB→C行きの客が1人ふえると、その1人の運賃は600円（B→D）から200円（B→C）に変わり、かわりにC→D新規客が1人ふえて500円が加わるので、合計は1人あたり(200＋500)−600＝100円ずつ多くなる。\n1000÷100＝10人がB→C行きだったとわかる。C→D新規客＝2＋10＝12人です。"),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[p] if isinstance(p, int) else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    want = set(p[0] for p in TEXT_PATCHES)
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in want:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = want - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))

    changed = skipped = 0

    for did, path, old, new in TEXT_PATCHES:
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
