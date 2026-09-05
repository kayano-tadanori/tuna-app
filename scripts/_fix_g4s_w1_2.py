# -*- coding: utf-8 -*-
"""小4最レ算数 fukushu No.11〜No.24 の塾講師監査2班（audit_2.txt）の修正パッチ。

  使い方:  python scripts/_fix_g4s_w1_2.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：フィールドの値で判定する。すでに新しい値ならそのフィールドは黙って飛ばす。
  ★図SVGの修正はテキストラベルの削除だけ（座標・サイズは1つも動かしていない＝
    座標検算が必要な変更ではない）。

  対象32本（hd4s_11_3〜hd4s_24_3）を原簿と突き合わせて検算した結果（findings_2.md参照）：

  【図が答えを見せている】8本（重大）
    チェイン共通の図SVG（js/sansu.js が `step.svg || chain.svg` で全小問に使い回す）に、
    まだ答えていない小問の「答えそのもの」がテキストラベルとして書きこまれていた。
    座標・サイズはそのまま、答えを表す数字・文言だけを空欄相当のラベルに直す。
      hd4s_11_3 … みかん100/もも350/かき150 → みかん/もも/かき
      hd4s_11_4 … A 2700/B 1800/C 1300 → A/B/C
      hd4s_13_2 … 「1個こわすと600円へる」（小問1の答え600を直書き）→ 数字を削る
      hd4s_14_1 … A→C 60km 等＋「3区間とも同じ道のり」
                 （この問題いちばんの発見＝罠そのものを図が先に割っていた）
      hd4s_15_1 … 「和 120」「差 12」（小問1・2の答えを直書き）
      hd4s_16_1 … 「720分」（小問1の答えを、49本・61本と同じ“与えられた条件”の顔で提示）
      hd4s_16_2 … 「最小公倍数は72分」（小問1の答えを直書き）
      hd4s_24_1 … 「横帯 100」「斜め帯 60」「重なり 25」（小問1〜3の答えを直書き）

  【小4に方程式・文字式は禁止（浜学園カリキュラムで比・方程式は小5から）】3本（重大/中）
    hd4s_19_2 … 小問1の設問文そのものに「3a＋2b＝30」という文字式が書かれていた
               （原簿の解法メモ＝大人向けの内部シノプシスをそのまま設問に転記した誤り）。
               文字を使わず「代金を50でわった数」という言い方に直した。
    hd4s_13_1 … 小問2の解説が「x人」を立てて 400x+200(20-x)+300(20-x)=8500 を展開する
               本物の一次方程式になっていた。答え(15人)は変えず、
               つるかめ算の仮定法（全員通しと仮定→差額→1人あたりの差で割る）に直した。
    hd4s_13_3 … 小問2の解説が同様に「x組」の方程式だった。答え(5組)は変えず、
               つるかめ算の仮定法に直した。

  検算はfindings_2.mdに書いた通り、全32本を独立に解き直して数値の誤りは0件だった。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 対象11本と、原簿番号(hg)が今も一致しているかの確認用
TARGETS = {
    "hd4s_11_3": "HG-1037",
    "hd4s_11_4": "HG-1038",
    "hd4s_13_1": "HG-1046",
    "hd4s_13_2": "HG-1044",
    "hd4s_13_3": "HG-1045",
    "hd4s_14_1": "HG-1048",
    "hd4s_15_1": "HG-1053",
    "hd4s_16_1": "HG-1056",
    "hd4s_16_2": "HG-1055",
    "hd4s_19_2": "HG-1064",
    "hd4s_24_1": "HG-1081",
}

# ── ① 図SVGのテキストラベル置換（座標・サイズは一切変えない） ──
# (大問id, field, 直す前の部分文字列, 直したあとの部分文字列)
# field は常に "svg"（この11本のうち8本は chain 直下の svg フィールド1つだけを持つ）
SVG_PATCHES = [
    ("hd4s_11_3", "svg", "みかん100", "みかん"),
    ("hd4s_11_3", "svg", "もも350", "もも"),
    ("hd4s_11_3", "svg", "かき150", "かき"),

    ("hd4s_11_4", "svg", "A 2700", "A"),
    ("hd4s_11_4", "svg", "B 1800", "B"),
    ("hd4s_11_4", "svg", "C 1300", "C"),

    ("hd4s_13_2", "svg", "1個こわすと600円へる", "こわすと運賃がへる"),

    ("hd4s_14_1", "svg", "A→C 60km", "A→C"),
    ("hd4s_14_1", "svg", "C→D 60km", "C→D"),
    ("hd4s_14_1", "svg", "D→B 60km", "D→B"),
    ("hd4s_14_1", "svg", "3区間とも同じ道のり", "A町からB町までの道のり"),

    ("hd4s_15_1", "svg", "和 120", "和"),
    ("hd4s_15_1", "svg", "差 12", "差"),

    ("hd4s_16_1", "svg", "720分", "始発〜終発"),

    ("hd4s_16_2", "svg", "最小公倍数は72分", "同時に発車する間かく"),

    ("hd4s_24_1", "svg", "横帯 100", "横帯"),
    ("hd4s_24_1", "svg", "斜め帯 60", "斜め帯"),
    ("hd4s_24_1", "svg", "重なり 25", "重なり"),
]

# ── ② 文字式・方程式を使わない説明への書きかえ（question/meaningを丸ごと差しかえ） ──
# (大問id, steps のインデックス, "question"|"meaning", 目印になる一意な部分文字列, 新しい全文)
FIELD_REWRITES = [
    (
        "hd4s_13_1", 1, "meaning",
        "通しの人を x 人",
        "①もし 20人 全員が 通しで 乗ったとすると、運賃は 400×20＝8000円。"
        "②実際は 8500円で、8000円より 500円多い。"
        "③B駅で 1人が降りて 別の1人が 新しく乗るごとに、その2人ぶんの運賃は "
        "400円（通しで1人ぶん）から 200＋300＝500円 に変わり、100円ずつ増える。"
        "④500÷100＝5人が B駅で 乗り降りした。⑤通しで乗った人は 20−5＝15人。",
    ),
    (
        "hd4s_13_3", 1, "meaning",
        "組をx組とすると",
        "①1組は2本（100円+80円＝180円）。もし 20本すべてが 60円の えんぴつだったら、"
        "代金は 20×60＝1200円。②実際は 1500円で、1200円より 300円多い。"
        "③60円の えんぴつ2本（120円）を 100円と80円の 組（180円）に かえるごとに、"
        "代金は 180−120＝60円 ずつ増える。④300÷60＝5組。",
    ),
    (
        "hd4s_19_2", 0, "question",
        "式を 50 でわると 3a＋2b＝30",
        "1本150円と 1本100円の えんぴつを **どちらも1本以上** 買って ちょうど 1500円 にします。"
        "150円のほうの代金を 50でわった数と、100円のほうの代金を 50でわった数を "
        "合計すると 30 になります。100円のほうの代金を50でわった数は いつも偶数です。"
        "**150円のえんぴつの本数** は 偶数ですか 奇数ですか。偶数なら 1、奇数なら 2。",
    ),
    (
        "hd4s_19_2", 0, "meaning",
        "3a＝30−2b",
        "①150円のえんぴつの代金を50でわると 3×本数 になり、100円のほうを50でわると "
        "2×本数 になる（2×本数は いつも偶数）。②合計30から 100円がわの偶数を引いても "
        "30は偶数のままなので、150円がわの 3×本数 も 偶数。③3は奇数なので、"
        "3×本数 が偶数になるのは 本数が偶数のときだけ。④よって **150円のえんぴつの本数は 偶数**。"
        "**約分すると 片方が偶数だけに しばられる**。",
    ),
    (
        "hd4s_19_2", 1, "meaning",
        "a＝2,4,6,8",
        "①150円のえんぴつの本数は 2、4、6、8 のいずれか"
        "（10本だと 100円のほうが0本になり 条件から外れる）。②4通り。",
    ),
]


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

    # ① 図SVGのテキストラベル置換
    for did, field, old, new in SVG_PATCHES:
        x = found[did]
        cur = x[field]
        if new in cur and old not in cur:
            skipped += 1
            continue
        n = cur.count(old)
        assert n == 1, "%s %s: %r appears %d times (expected 1)" % (did, field, old, n)
        x[field] = cur.replace(old, new, 1)
        changed += 1

    # ② 文字式・方程式を使わない説明への書きかえ
    for did, idx, field, anchor, new_text in FIELD_REWRITES:
        x = found[did]
        node = x["steps"][idx]
        cur = node[field]
        if cur == new_text:
            skipped += 1
            continue
        n = cur.count(anchor)
        assert n == 1, "%s steps[%d].%s: anchor %r appears %d times (expected 1)" % (
            did, idx, field, anchor, n)
        node[field] = new_text
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
