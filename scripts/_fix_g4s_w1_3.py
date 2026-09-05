# -*- coding: utf-8 -*-
"""docs/_audit/g4s_w1/findings_3.md の指摘を hama_daimon.json に当てるパッチ。

  使い方:  python scripts/_fix_g4s_w1_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

対象: 小4最レ算数 5本（hd4s_26_1／hd4s_27_1／hd4s_30_1／hd4s_32_2／hd4s_39_1）。
22本（hd4s_26_1〜hd4s_40_2）を原簿と突き合わせた結果、重大2件・中2件・軽1件を
検出した（findings_3.md参照）。残り17本は独立検算・図SVGの座標実測とも問題なし。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う（自前で入れ子を歩かない）
  * 文字列置換は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    -> [[feedback_anchor_uniqueness]]（アンカーが一意でなく72万字を壊した）
  * 何度流しても同じ結果（すでに直っていればスキップ＝冪等）
  * 読み書きは1プロセスの中で json.load -> 書き換え -> json.dumps(indent=1) で戻す
    -> [[feedback_heikou_session_jouyaki]]
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化けて全行差分になる）
  * 大問まるごとの削除・移動はしない。追加は APPEND_STEPS（既存の質問文があれば足さない＝冪等）。

直した5本:
  1. hd4s_26_1（HG-1103） 図SVGの頂点ラベルB・Cが入れかわっていて、問題文
     「角Cが直角」と矛盾する三角形が描かれていた。2つの頂点ラベルとキャプション
     の「直角B」を入れかえる。
  2. hd4s_27_1（HG-1105） 原簿の設問(3)「BC＝36cmのときの◆と★の和＝324cm2」が
     丸ごと未実装。既存4問はそのまま、末尾に3問追加（648->92.34->324）。
     追加する数値はPythonで独立に再検算し、原簿の解法欄（◆=92.34・★=231.66）と
     一致することを確認ずみ（findings_3.md参照）。
  3. hd4s_30_1（HG-1113） 原簿の設問(4)「まわり80cmは何枚か＝18枚」が未実装。
     既存4問はそのまま、末尾に1問追加。
  4. hd4s_32_2（HG-1117） 解説・設問が"x・y"の一次方程式のまま（小4は方程式・
     文字式が未習）。小問2〜5の文面と図SVGのラベルを、文字式を使わない言い方に
     書きかえる。答え（21・25・5・1）は変えない。
  5. hd4s_39_1（HG-1133） 原簿の答え「父46・母44・長男20・次男17」のうち母44才
     だけ独立した設問になっていなかった。末尾に1問追加。

見送り: 無し（原本PDF未確認だが、5本とも原簿レコード自身の記載・座標・Pythonでの
独立検算だけで修正内容が確定できたため）。
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

DEFAULT_JSON = os.path.join(ROOT, "data", "hama_daimon.json")

# 対象5本と、原簿番号(src)が今も一致しているかの確認用
TARGETS = {
    "hd4s_26_1": "HG-1103",
    "hd4s_27_1": "HG-1105",
    "hd4s_30_1": "HG-1113",
    "hd4s_32_2": "HG-1117",
    "hd4s_39_1": "HG-1133",
}


# ================================================================ 置きかえ表
# ("R", パス, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
# ("APPEND_STEPS", 新しい steps 要素のリスト)  … questionが既に有れば足さない（冪等）
EDITS = [
    # ---------------------------------------------------------- 重大1
    ("hd4s_26_1", [
        ("R", "svg",
         "<text x=\"45.0\" y=\"165.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text>",
         "<text x=\"45.0\" y=\"165.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text>"),
        ("R", "svg",
         "<text x=\"290.0\" y=\"165.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text>",
         "<text x=\"290.0\" y=\"165.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text>"),
        ("R", "svg",
         "直角三角形ABC（直角B）に内接する円。Oは中心",
         "直角三角形ABC（直角C）に内接する円。Oは中心"),
    ]),
    # ---------------------------------------------------------- 重大2
    ("hd4s_27_1", [
        ("APPEND_STEPS", [
            {
                "question": "BC＝36cmのとき、三角形ABCの面積は何cm²ですか。",
                "answer": "648",
                "meaning": "①BC＝36なので、AB＝BC＝36の直角二等辺三角形。②36×36÷2＝648cm²。",
            },
            {
                "question": "このとき、辺ACのちょうど真ん中の点が、半円のいちばん高い点Tとぴったり重なります。"
                            "半円の中心Oと、AとTをそれぞれ結ぶと、OA（横）とOT（たて）は直角に交わり、"
                            "角AOTは90度・半径18cmの扇形になります。この扇形OATから、"
                            "三角形OAT（底辺OA＝18cm・高さOT＝18cm）をのぞいた弓形（＝◆）の面積は何cm²ですか。",
                "answer": "92.34",
                "meaning": "①扇形OAT＝18×18×3.14÷4＝254.34cm²。②三角形OAT＝18×18÷2＝162cm²。"
                           "③254.34−162＝92.34cm²。これが◆（半円のうち三角形の外）です。",
            },
            {
                "question": "BC＝36cmのとき、◆と★の面積の和は何cm²ですか。",
                "answer": "324",
                "meaning": "①★＝三角形648−三角形OAT162−扇形OTB254.34＝231.66cm²"
                           "（扇形OTBもOATと同じ90度・半径18cmなので254.34cm²）。"
                           "②◆＋★＝92.34＋231.66＝324cm²。③三角形648のちょうど半分になるのが、"
                           "この問題のいちばんのおもしろいところ。",
            },
        ]),
    ]),
    # ---------------------------------------------------------- 中1
    ("hd4s_30_1", [
        ("APPEND_STEPS", [
            {
                "question": "まわりの長さが 80cm になるのは、何枚 重ねたときですか。",
                "answer": "18",
                "meaning": "①まわりは 4×(n＋2)。②4×(n＋2)＝80 → n＋2＝20 → n＝18枚。",
            },
        ]),
    ]),
    # ---------------------------------------------------------- 中2
    ("hd4s_32_2", [
        ("R", "steps/1/question",
         "静水時の 速さを x、流れの速さを y とすると、上りは x−y＝4 です。こぐ力4倍の 下りは 4x＋y＝いくつ ですか。",
         "上りの 速さ（静水時の速さ − 流れの速さ）は 時速4km です。こぐ力4倍の 下りの 速さ"
         "（静水時の速さ×4 ＋ 流れの速さ）は 時速何km ですか。"),
        ("R", "steps/1/meaning",
         "①こぐ力4倍なので 静水時は 4x。②下りは 4x＋y＝21。",
         "①こぐ力4倍なので 静水時の速さは 4倍になる。②下りの速さは 静水時の速さ×4 ＋ 流れの速さ ＝ "
         "時速21km（問題文の通り）。"),
        ("R", "steps/2/question",
         "2つの 式を たすと、5x は いくつに なりますか。",
         "上りの式（静水時の速さ－流れの速さ）と 下りの式（静水時の速さ×4＋流れの速さ）を たし合わせると、"
         "流れの速さが 消えて 「静水時の速さの5つ分」に なります。それは いくつ ですか。"),
        ("R", "steps/2/meaning",
         "①(x−y)＋(4x＋y)＝5x。**yが消える**。②4＋21＝25。",
         "①上り（静水時－流れ）と 下り（静水時×4＋流れ）を たすと、**−流れ と ＋流れ が 打ち消し合って消える**。"
         "②のこりは 静水時の速さ×1＋静水時の速さ×4＝静水時の速さ×5。③4＋21＝25。"),
        ("R", "steps/3/meaning",
         "①5x＝25 なので x＝5。②時速5km。",
         "①静水時の速さの5つ分が25なので、25÷5＝5。②時速5km。"),
        ("R", "steps/4/meaning",
         "①x−y＝4 に x＝5 を入れて y＝1。②時速1km。**4倍にしたのは「たすと消える」形にするため**（3倍だと分数になる）。",
         "①上りの式「静水時の速さ－流れの速さ＝4」に 静水時の速さ5 を入れると、5－流れの速さ＝4。"
         "②流れの速さ＝1。③時速1km。**4倍にしたのは「たすと消える」形にするため**（3倍だと分数になる）。"),
        ("R", "svg",
         "上り x−y＝4",
         "上り 静水時−流れ＝4"),
        ("R", "svg",
         "下り 4x＋y＝21",
         "下り 静水時×4＋流れ＝21"),
        ("R", "svg",
         "たすとyが消える",
         "たすと流れが消える"),
    ]),
    # ---------------------------------------------------------- 軽1
    ("hd4s_39_1", [
        ("APPEND_STEPS", [
            {
                "question": "母は いま 何才 ですか。",
                "answer": "44",
                "meaning": "①父＋母＝127−20−17＝90才。②父＝母＋2 なので 母＝44才、父＝46才。",
            },
        ]),
    ]),
]


# ================================================================ 当てる
def _get_holder(x, path):
    parts = path.split("/")
    if len(parts) == 1:
        return x, parts[0]
    assert parts[0] == "steps" and len(parts) == 3, "パスの形がおかしい: " + path
    i = int(parts[1])
    steps = x.get("steps") or []
    assert i < len(steps), "小問 %d が無い（%s）" % (i, path)
    return steps[i], parts[2]


def apply_edits(x, edits):
    changed = 0
    for edit in edits:
        kind = edit[0]
        if kind == "R":
            _, path, old, new = edit
            holder, key = _get_holder(x, path)
            cur = holder.get(key, "")
            assert isinstance(cur, str), "文字列でない項目は触らない: " + path
            if new in cur and (old not in cur or old in new):
                continue  # すでに直っている
            if old not in cur:
                assert new in cur, "%s: もとの文字列も置きかえ後の文字列も見つからない -> %r" % (path, old[:60])
                continue  # すでに直っている
            n = cur.count(old)
            assert n == 1, "%s: アンカーが %d 回出る（1回でないので置きかえない）-> %r" % (path, n, old[:60])
            holder[key] = cur.replace(old, new)
            changed += 1
        elif kind == "APPEND_STEPS":
            _, new_steps = edit
            steps = x.setdefault("steps", [])
            existing_q = set(s.get("question") for s in steps if isinstance(s, dict))
            for ns in new_steps:
                if ns["question"] in existing_q:
                    continue  # すでに足してある（冪等）
                steps.append(dict(ns))
                changed += 1
        else:
            raise AssertionError("知らない種類: " + kind)
    return changed


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT_JSON
    path = os.path.abspath(path)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + path)

    with io.open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    newline = "\r\n" if "\r\n" in raw else "\n"
    d = json.loads(raw)
    log("  改行コード: %s" % ("CRLF" if newline == "\r\n" else "LF"))

    index = {}
    for rec in iter_daimon(d):
        x = rec["x"]
        i = x.get("id")
        if i:
            index.setdefault(i, []).append(x)

    missing = set(TARGETS) - set(index)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in TARGETS.items():
        got = index[did][0].get("src", "") or ""
        assert got.startswith(hg), "%s: src mismatch (expected prefix %s, got %r)" % (did, hg, got)

    total_changed = 0
    touched = 0
    for did, edits in EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        c = apply_edits(hits[0], edits)
        total_changed += c
        if c:
            touched += 1
            log("  直した %s（%s）: %d か所" % (did, hits[0].get("src", "?"), c))
        else:
            log("  そのまま %s: 変更なし（すでに直っている）" % did)

    if total_changed == 0:
        log("変更なし。ファイルは書きかえない。")
        return 0

    text = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if newline != "\n":
        text = text.replace("\n", newline)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))

    log("---- 書きこみ完了: 大問 %d本 / %d か所" % (touched, total_changed))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
