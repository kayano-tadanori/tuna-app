# -*- coding: utf-8 -*-
"""小4最レ算数 fukushu No.3〜No.42 の塾講師監査（audit_1.txt・小4最レ最後の未監査ぶん）の修正パッチ。

  使い方:  python scripts/_fix_g4s_w2_1.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：フィールドの値／steps内のquestion文字列で判定する。すでに新しい状態ならそのまま飛ばす。
  ★大問まるごとの削除・移動は含まない（hd4s_33_1も「差しかえ」であって、大問自体の追加/削除ではない）。

  対象24本（hd4s_03_2〜hd4s_42_1）を原簿と突き合わせて検算した結果（findings_1.md参照）：

  【重大】3本
    hd4s_33_1（HG-1122）… アプリが別問題（7時台・90度の1回目2回目）にすり替わっていた。
      原簿の本来の設問（4時をすぎて3回目に重なる時刻／6回目に直角を作る時刻＝周期性の発見）
      に、独立に検算した数値で大問をまるごと差しかえた。
    hd4s_04_3（HG-1015）… 図SVGが8/15/29/57と全小問の答えを直書きしていた。
      原簿が「図：なし」なので図を空欄に戻した。
    hd4s_25_2（HG-1102）… 図SVGが「1/2」「1/3」と小問1・2の答えを直書きし、
      しかも実際の図形（直角二等辺三角形＋内接正方形）とは無関係な架空プレースホルダーだった。
      原簿自体にもこの1本だけ図SVG欄が無い（原本PDF未着で保留中）ため、
      答え見せの図は空欄に戻し、正しい図の新規作画は見送った（findings_1.md参照）。

  【中】2本
    hd4s_04_2（HG-1014）… 原簿が「図：なし（自分で線分図を描けるかが勝負）」と明記する問題に
      「電・桜・桜・桜・桜・桜・電」の7箱の図を足していて、数えれば小問1の答え(6区間)が見える。
      原簿の設計どおり図を空欄にした。
    hd4s_09_2（HG-1031）… 原簿の設問(4)「(A×D−C×D)×B」が丸ごと未実装だった。
      小問5として追加した（答えD）。

  【軽】2本
    hd4s_09_4（HG-1033）… 図のキャプション「和は四角の数」が小問1を解く前に核心の発見
      （奇数の和は平方数）を教えてしまっていた。キャプションを中立な文言に差しかえた。
    hd4s_12_2（HG-1041）・hd4s_12_4（HG-1043）… 原簿が求める値のうち1つ
     （イエ間896m／●10g）が独立した小問にならず解説内だけに答えとして出ていた。
      それぞれ独立の小問として追加し、先出しになっていた解説の文言は削除した。

  検算はfindings_1.mdに書いた通り、全24本を独立に解き直して
  数値そのものの誤りはhd4s_33_1（別問題へのすり替え）以外は0件だった。
  原本PDF（C:\\Users\\User\\Desktop\\浜問題\\4年最レ算数\\）はGoogle Drive未接続で参照不可だった。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 対象9本と、原簿番号(hg)が今も一致しているかの確認用
TARGETS = {
    "hd4s_04_2": "HG-1014",
    "hd4s_04_3": "HG-1015",
    "hd4s_09_2": "HG-1031",
    "hd4s_09_4": "HG-1033",
    "hd4s_12_2": "HG-1041",
    "hd4s_12_4": "HG-1043",
    "hd4s_25_2": "HG-1102",
    "hd4s_33_1": "HG-1122",
}

# ── ① 図SVGを空欄に戻す（原簿が「図：なし」、または原簿に図SVG欄が無いのに
#      アプリの自作図が答えを直書きしているケース）。座標をいじって誤魔化すのではなく、
#      原簿の状態（＝図なし）に戻すだけ。blank前に目印の部分文字列で正しい対象か確認する。
SVG_BLANK = [
    ("hd4s_04_2", "600m・桜5本"),
    ("hd4s_04_3", "2倍−1 をくり返す"),
    ("hd4s_25_2", "直角の場所でかわる"),
]

# ── ② 図SVGのテキストラベル置換（座標・サイズは一切変えない） ──
SVG_PATCHES = [
    ("hd4s_09_4", "svg", "和は四角の数", "1、3、5、…とつづく奇数"),
]

# ── ③ steps[idx][field] の全文差しかえ（先出しの答えを削る等） ──
FIELD_REWRITES = [
    (
        "hd4s_12_2", 3, "meaning",
        "（イエは896m）",
        "①2452−1471＝981m。",
    ),
]

# ── ④ steps への小問の追加（原簿の設問がアプリで欠けている分を補う） ──
# (大問id, 挿入位置（Noneなら末尾に追加）, 追加するstep dict)
STEP_INSERTS = [
    (
        "hd4s_09_2", None,
        {
            "question": "(A × D − C × D) × B の 答えは どの列に 入りますか。",
            "answer": "D",
            "meaning": "①A×D も C×D も **Dの倍数**（4の倍数）。②Dの倍数どうしの引き算も Dの倍数。"
                       "③Dの倍数に 何を かけても Dの倍数の まま。④答えは D列。",
            "choices": ["D", "A", "B", "C"],
        },
    ),
    (
        "hd4s_12_2", None,
        {
            "question": "イエ間 は 何m ですか。",
            "answer": "896",
            "meaning": "①2452−575（アイ）−981（イウ）＝896m。②ウ-イ-エ＝981＋896＝1877m で検算できる。",
        },
    ),
    (
        "hd4s_12_4", 3,
        {
            "question": "▲ が 20g のとき、● は 何g ですか。",
            "answer": "10",
            "meaning": "①さきほど ▲1個＝●2個 と 分かった（重さでも同じ）。②▲が20gなら ●2個ぶんで20g。"
                       "③● 1個は 20÷2＝10g。",
        },
    ),
]

# ── ⑤ 大問まるごとの差しかえ（アプリが別問題にすり替わっていたケース） ──
# hd4s_33_1（HG-1122）小4最レNo.33大問6・時計算の周期化。
# 原簿の設問「4時をすぎて (1)3回目に重なる時刻 (2)6回目に直角を作る時刻」に合わせて、
# 独立に検算した数値で差しかえる（findings_1.md「重大1」参照）。
HD4S_33_1_OLD_TITLE = "長針と 短針が 90度に なる 時こく"
HD4S_33_1_NEW = {
    "title": "4時から 何回目かの 重なりと 直角",
    "intro": "4時を すぎてから、長針と 短針が 重なったり 直角(90度)を つくったり する時こくを 考えます。"
             "長針は 1分間に 6度、短針は 1分間に 0.5度 すすむので、"
             "**1分間に 角度の差は 5.5度ずつ ちぢまります**。",
    "svg": "",
    "steps": [
        {
            "question": "4時ちょうどの とき、長針と 短針の 間の 角度は 何度 ですか。",
            "answer": "120",
            "meaning": "①短針は 4の位置＝12から 30×4＝120度。②長針は 12で 0度。③間の角度は 120度。",
        },
        {
            "question": "1回目に 重なるのは、差が 120度から 0度まで ちぢんだとき です。"
                        "120÷5.5 を 計算すると 何/11分 ですか。分子を 答えなさい（240/11分 なら 240）。",
            "answer": "240",
            "meaning": "①120÷5.5＝240/11分。②4時 21と9/11分が **1回目に重なる時こく**。",
        },
        {
            "question": "1回目に 重なったあと、長針が 短針より ちょうど1周(360度) 多く すすむたびに "
                        "また重なります。360÷5.5 を 計算すると 何/11分 ですか。分子を 答えなさい。",
            "answer": "720",
            "meaning": "①360÷5.5＝720/11分。②重なりは この 720/11分（65と5/11分）ごとに くり返す。"
                       "**1回目のあとは 等間隔（周期）**。",
        },
        {
            "question": "3回目に 重なる時こくを 求めます。240/11＋720/11×2 を 計算すると "
                        "何/11分 ですか。分子を 答えなさい。",
            "answer": "1680",
            "meaning": "①3回目は 1回目から 周期2つぶんあと。②240/11＋1440/11＝1680/11分。"
                       "③1680÷11＝152あまり8で、152と8/11分＝2時間32と8/11分。"
                       "④4時＋2時間32と8/11分＝**6時32と8/11分**。これが3回目に重なる時こく。",
        },
        {
            "question": "こんどは 直角(90度)を 考えます。はじめて 直角に なるのは、"
                        "差が 120度から 90度まで ちぢんだとき です。"
                        "(120−90)÷5.5 を 計算すると 何/11分 ですか。分子を 答えなさい。",
            "answer": "60",
            "meaning": "①120−90＝30度。②30÷5.5＝60/11分。③4時 5と5/11分が **1回目の直角**。",
        },
        {
            "question": "直角は、重なり(720/11分ごと)より 短い 間かくで くり返します。"
                        "1回の重なりの あいだに 直角は ちょうど2回 できるので、"
                        "直角の周期は 重なりの周期の 何分の1 ですか。分母を 答えなさい。",
            "answer": "2",
            "meaning": "①長針が短針に追いつくまでの間に、90度ひらく瞬間が 追いつく前と 追いこした後で "
                       "1回ずつ、あわせて2回ある。②だから 直角の周期は 720/11÷2＝360/11分＝"
                       "重なりの周期の ちょうど半分。**これが この問題いちばんの発見**。",
        },
        {
            "question": "6回目に 直角に なる時こくを 求めます。6回目は 1回目から 周期(360/11分)が "
                        "5つぶんあと なので、60/11＋360/11×5 を 計算すると 何/11分 ですか。分子を 答えなさい。",
            "answer": "1860",
            "meaning": "①60/11＋1800/11＝1860/11分。②1860÷11＝169あまり1で、169と1/11分＝"
                       "2時間49と1/11分。③4時＋2時間49と1/11分＝**6時49と1/11分**。"
                       "これが6回目に直角を作る時こく。",
        },
    ],
}


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

    # ① 図SVGを空欄に戻す
    for did, marker in SVG_BLANK:
        x = found[did]
        cur = x["svg"]
        if cur == "":
            skipped += 1
            continue
        assert marker in cur, "%s: svg marker %r not found (unexpected state)" % (did, marker)
        x["svg"] = ""
        changed += 1

    # ② 図SVGのテキストラベル置換
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

    # ③ steps[idx][field] の全文差しかえ
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

    # ④ steps への小問の追加（すでに同じquestionがあれば冪等スキップ）
    for did, pos, step in STEP_INSERTS:
        x = found[did]
        qs = [s.get("question") for s in x["steps"]]
        if step["question"] in qs:
            skipped += 1
            continue
        if pos is None:
            x["steps"].append(step)
        else:
            assert 0 <= pos <= len(x["steps"]), "%s: insert pos %d out of range" % (did, pos)
            x["steps"].insert(pos, step)
        changed += 1

    # ⑤ hd4s_33_1（HG-1122）大問まるごとの差しかえ
    x = found["hd4s_33_1"]
    if x["title"] == HD4S_33_1_NEW["title"]:
        skipped += 1
    else:
        assert x["title"] == HD4S_33_1_OLD_TITLE, \
            "hd4s_33_1: unexpected title %r (not old, not new)" % (x["title"],)
        x["title"] = HD4S_33_1_NEW["title"]
        x["intro"] = HD4S_33_1_NEW["intro"]
        x["svg"] = HD4S_33_1_NEW["svg"]
        x["steps"] = HD4S_33_1_NEW["steps"]
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
