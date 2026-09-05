# -*- coding: utf-8 -*-
"""
g5r_w3 監査1本目（docs/_audit/g5r_w3/audit_1.txt, HG-2848/2860/1610/1609/2861/2849/1611）
の修正パッチ。

対象と直す内容:

  HG-2849 (id=hd_5r_k03_612_4) 2024 5年公開 第612回 理科 大問4「空気の体積と温度」
    - 原簿の設問は(1)〜(7)の7問だが、アプリには(1)〜(5)しか無く、(6)(7)が丸ごと
      未実装だった。(6)(7)用の図（[図6][図7]＝水の量がちがう丸底フラスコ3つ、
      ア・イ・ウ）は大問の図SVGに既に描かれているのに、対応する設問が1問も無い状態。
    - しかもその[図6][図7]は、ア/ウのラベルが原簿の定義と逆になっていた。
      水位（[図6]は水を表す網かけ矩形の上端y、[図7]はガラス管下端の深さy1）を
      座標から読むと、「ア」の位置のほうが「ウ」の位置より水面が高い＝水が多い。
      原簿は「ア＝水が少なく空気が多い／ウ＝水が多く空気が少ない」なので、
      ラベルが入れかわっている。イの位置はそのままで、ア/ウの文字だけ入れ替えて直す。
    - 直したうえで(6)(7)の設問を追加する。

  HG-2861 (id=hd_5r_k03_636_4) 2026 5年公開 第636回 理科 大問4「3種類の金属棒」
    - 原簿の設問は(1)①②③＋(2)①②③④の7問だが、アプリには(2)①②③④の4問しか無く、
      (1)①②③が丸ごと未実装だった。(1)①②③用の図（[図1]ななめの鉄棒／[図2]水の
      容器／[図3]ドーナツ形の円盤）は大問の図SVGに既に描かれている。
    - 座標を検算した結果、[図1]は ア=下端 dot イ=中央 ウ=上端、[図3]は
      ア=右上 イ=左 ウ=下 の位置関係で原簿の記述と一致しており、ラベルのずれは無い
      （[図2]はアの高さがイと同じで「右上」というより「右がわ」寄りだが、答え
      （下＝ウ）の正しさには影響しないので、設問文では位置を断定しない書き方にした）。
    - 図は直さず、(1)①②③の設問を追加するだけでよい。

  HG-2860 (id=hd_5r_k02_635_4) 2026 5年公開 第635回 理科 大問4「氷50gの加熱グラフ」
    - グラフの x=19 の目もりの点線ガイドが `y1=y2=220`（高さ0）になっていて、
      x=1・x=9 のガイド線とちがって実際には見えない（消えている）。
      折れ線データ点は (355.0, 20.0) なので、正しくは y1=20.0。軽微な表示バグとして直す。

見送り（対応しない）:
  - HG-2848 (id=hd_5r_k02_611_4) の [図2] アルミ/鉄の円盤の塗り色が、原簿の
    注記「アルミ＝白／鉄＝黒」と逆に見える件。ただし各円盤の下に
    「アルミニウムの円盤」「鉄の円盤」という文字ラベルが明記されており正答には
    影響しない。この図は2026-09-04に原本PDFと照合してアプリ側から書き戻された
    ばかりで、色の意図が最新かどうか確証が持てないため、本スクリプトでは変更しない。
  - HG-2848 (4)①（バイメタルの向き）は原簿自体が「⚠要現物照合」としており、
    原本PDFへのアクセスを試みたが Google Drive 未接続（G:ドライブ未マウント）で
    確認できなかった。想像で実装しないという既存方針どおり、今回も見送る
    （アプリはもともとこの小問を実装していない＝現状維持でよい）。

使い方:
    python scripts/_fix_g5r_w3_1.py [対象JSONのパス]
    （省略時は data/hama_daimon.json）

冪等: 既に直っていれば何もしない。2回実行してもJSONは変わらない。
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import genbo_common as gc  # noqa: E402


def find_one(d, target_id):
    """iter_daimon だけを使って大問を1本引く。0本/2本以上なら止める。"""
    hits = [r["x"] for r in gc.iter_daimon(d) if r["x"].get("id") == target_id]
    assert len(hits) == 1, "id=%s が %d件見つかった（1件のはず）" % (target_id, len(hits))
    return hits[0]


# [図6]/[図7]内の「ア/イ/ウ」ラベル（同じ書式で3個ずつ出てくる）
_LABEL_RE = re.compile(
    r'<text x="([\d.]+)" y="10\.0" font-size="13" text-anchor="middle" '
    r'fill="#9aa3c0">([^<]+)</text>'
)


def _swap_a_c_labels(block, tag):
    """block内の3つのア/イ/ウラベルのうち、1番目(ア)と3番目(ウ)だけ入れ替える。
    既に入れ替え済み（ウ,イ,ア）なら (block, False) を返す（冪等）。"""
    ms = list(_LABEL_RE.finditer(block))
    assert len(ms) == 3, "%s: ラベルが3個ではない(%d個)" % (tag, len(ms))
    letters = [m.group(2) for m in ms]
    if letters == ["ウ", "イ", "ア"]:
        return block, False
    assert letters == ["ア", "イ", "ウ"], "%s: 想定外のラベル並び %r" % (tag, letters)
    m0, _m1, m2 = ms
    new_block = (
        block[: m0.start(2)] + "ウ" + block[m0.end(2): m2.start(2)]
        + "ア" + block[m2.end(2):]
    )
    return new_block, True


def fix_hg2849(d):
    x = find_one(d, "hd_5r_k03_612_4")
    assert x.get("src") == "HG-2849"
    svg = x["svg"]
    svg_changed = False

    for start_marker, end_marker, tag in (
        ('<g transform="translate(220,110)">', "[図6]</text></g>", "図6"),
        ('<g transform="translate(220,250)">', "[図7]</text></g>", "図7"),
    ):
        assert svg.count(start_marker) == 1, "%s: 開始位置が1つでない" % tag
        s = svg.index(start_marker)
        assert svg.count(end_marker) == 1, "%s: 終了位置が1つでない" % tag
        e = svg.index(end_marker, s) + len(end_marker)
        block = svg[s:e]
        assert svg.count(block) == 1, "%s: 抽出したブロックが1回しか無いはず" % tag
        new_block, did = _swap_a_c_labels(block, tag)
        if did:
            # 座標検算：入れ替え後も水位ジオメトリ自体は変えていないことを確認
            assert new_block != block
            svg = svg.replace(block, new_block, 1)
            svg_changed = True

    changed = False
    if svg_changed:
        x["svg"] = svg
        changed = True

    q6 = ("[図6]のように、丸底フラスコに水と空気を入れ、ガラス管をさしたゴムせんでふたをしました"
          "（管の中のゼリーが体積変化で動きます）。"
          "ア＝水が少なく空気が多い、イ＝水と空気が中くらい、ウ＝水が多く空気が少ない、"
          "の3つを20℃から100℃の湯にひたしたとき、ゼリーが最も大きく動くのはどれですか。")
    q7 = ("[図7]のように、同じ装置でガラス管の下のはしが水につかっているものがあります。"
          "ア＝水が少ない、イ＝水が中くらい、ウ＝水が多い、"
          "の3つを100℃の湯にひたしたとき、水がガラス管の中を最も高く上がるのはどれですか。")
    existing_q = set(s.get("question") for s in x["steps"])
    if q6 not in existing_q:
        x["steps"].append({
            "question": q6,
            "answer": "ア",
            "choices": ["ア", "イ", "ウ"],
            "meaning": ("空気は水よりも温度が上がったときにふくらむ割合がずっと大きいので、"
                        "空気の割合が多いほど全体の体積の増え方が大きくなり、ゼリーが大きく動きます。"
                        "空気がいちばん多いアが正解です。"),
        })
        changed = True
    if q7 not in existing_q:
        x["steps"].append({
            "question": q7,
            "answer": "ア",
            "choices": ["ア", "イ", "ウ"],
            "meaning": ("同じ理由で、あたためられた空気は水よりもはるかに大きくふくらみます。"
                        "空気の割合が多い（水が少ない）ほど、ふくらんだ空気に押されて水がガラス管の中を"
                        "高く上がります。水がいちばん少ないアが正解です。"),
        })
        changed = True

    return changed


def fix_hg2861(d):
    x = find_one(d, "hd_5r_k03_636_4")
    assert x.get("src") == "HG-2861"

    new_steps = [
        {
            "question": ("[図1]のように、ななめに置いた鉄の棒があります。ア・イ・ウのどこか1か所を"
                         "加熱するとき、熱が棒全体にいちばん早く伝わるのはどれですか"
                         "（どこでも同じ速さのときはエとします）。"),
            "answer": "イ",
            "choices": ["イ", "ア", "ウ", "エ"],
            "meaning": ("熱は熱した点から両方向に伝わります。真ん中(イ)を熱すると、両はしまで同時に"
                        "熱が伝わるので、いちばん早く棒全体に伝わります。はし(ア・ウ)を熱すると、"
                        "反対がわのはしまで届くのに時間がかかります。"),
        },
        {
            "question": ("[図2]のように、水を入れた容器があります。ア・イ・ウのどこか1か所を"
                         "熱するとき、熱が容器全体にいちばん早く伝わるのはどれですか"
                         "（どこでも同じ速さのときはエとします）。"),
            "answer": "ウ",
            "choices": ["ウ", "ア", "イ", "エ"],
            "meaning": ("水はあたためられると軽くなって上に動き、かわりに上の冷たい水が下に動く"
                        "「対流」で全体があたたまります。下(ウ)を熱すると、あたたかい水がまっすぐ"
                        "上に動いて対流がよく起こるので、いちばん早く全体に伝わります。"
                        "横(ア・イ)を熱すると対流が起こりにくく、時間がかかります。"),
        },
        {
            "question": ("[図3]のように、中央に大きな円形の穴があいた鉄の円盤(ドーナツ形)が"
                         "あります。ア・イ・ウのどこか1か所を加熱するとき、熱が円盤全体に"
                         "いちばん早く伝わるのはどれですか（どこでも同じ速さのときはエとします）。"),
            "answer": "エ",
            "choices": ["エ", "ア", "イ", "ウ"],
            "meaning": ("ドーナツ形は、どこも同じ形・同じ太さの輪になっているので、どの点を熱しても"
                        "両どなりへ熱が伝わる速さは同じです。だから、熱する場所によって伝わる速さは"
                        "変わりません(エ)。"),
        },
    ]
    existing_q = set(s.get("question") for s in x["steps"])
    to_add = [s for s in new_steps if s["question"] not in existing_q]
    if not to_add:
        return False
    # 原簿の順番どおり、(1)①②③を(2)①②③④の手前に挿入する
    x["steps"] = to_add + x["steps"]
    return True


def fix_hg2860(d):
    x = find_one(d, "hd_5r_k02_635_4")
    assert x.get("src") == "HG-2860"
    svg = x["svg"]
    bad = ('<line x1="355.0" y1="220.0" x2="355.0" y2="220.0" stroke="#2a3560" '
           'stroke-width="1" stroke-dasharray="3,2"/>')
    good = ('<line x1="355.0" y1="20.0" x2="355.0" y2="220.0" stroke="#2a3560" '
            'stroke-width="1" stroke-dasharray="3,2"/>')
    n_bad = svg.count(bad)
    n_good = svg.count(good)
    if n_bad == 0 and n_good == 1:
        return False  # 既に直っている
    assert n_bad == 1, "HG-2860: 目盛り線(x=19)が想定外の状態 (bad=%d, good=%d)" % (n_bad, n_good)
    # 座標検算：折れ線の実データ点 "355.0,20.0" が存在することを確認してから直す
    assert "355.0,20.0" in svg
    x["svg"] = svg.replace(bad, good, 1)
    return True


def main():
    default_path = os.path.join(HERE, "..", "data", "hama_daimon.json")
    path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else default_path)

    d = json.load(io.open(path, encoding="utf-8"))

    c1 = fix_hg2849(d)
    c2 = fix_hg2861(d)
    c3 = fix_hg2860(d)

    if not (c1 or c2 or c3):
        print("変更なし（既に適用済み）")
        return

    with io.open(path, "wb") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    print("修正を書き込みました: HG-2849=%s HG-2861=%s HG-2860=%s" % (c1, c2, c3))


if __name__ == "__main__":
    main()
