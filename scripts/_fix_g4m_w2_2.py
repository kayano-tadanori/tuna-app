# -*- coding: utf-8 -*-
"""4学年 master kokai No.6〜kokai No.8（hd_4m_k06_579_2〜hd_4m_k08_605_3）の
塾講師監査（docs/_audit/g4m_w2/findings_2.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g4m_w2_2.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
・33本を読み、原簿との数値・答え・図の座標を独立検算した（Pythonでの全探索・シミュレーション）。
  指摘は2件（重大2・どちらも「分割した小問の解説が、まだ答えていない小問の答えを先出しする」
  監査の標準違反）。図SVGの追加・変更は無い（見送り含め、図に関する修正はゼロ）。

直したもの（findings_2.md と対応）:

  重大1  hd_4m_k07_604_2（HG-3547・えんぴつの値上がり）
    小問1「持っていったお金は、30円の何倍でしたか。また35円の何倍でしたか。」の正解choicesが
    そのまま「30円の14倍／35円の12倍」＝小問2「30円のえんぴつを何本買おうと思っていましたか。」
    （答え14）の答えと同じ値だった。小問1を、最終値（14・12）を出さない「式の立て方」を確認する
    設問（□を使った言いかえ）に置きかえた。小問2は変更なし。

  重大2  hd_4m_k07_580_1（HG-3200・電車の乗り降り）
    小問1「D駅でおりた人は何人ですか。」（答え29）の解説が計算途中で「A→D＝30−7−5＝18人」と
    書いており、これは小問2「A駅から乗ってD駅でおりた人は何人ですか。」（答え18）の答えそのもの。
    小問1・小問2の順序を入れかえ、それぞれの解説を「その時点までにわかっている値」だけで
    完結させた（新しい小問1＝A→D=18人を出すところで止める。新しい小問2＝18を使ってD駅合計29人
    を出す）。小問3（運賃8550円）は変更なし。
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 単一欄の置きかえ表
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
FIELD_PATCHES = [
    # ---- hd_4m_k07_604_2（HG-3547）小問1が小問2の答え(14)を先出ししていた ----
    (
        "hd_4m_k07_604_2",
        ("steps", 0, "question"),
        "持っていったお金は、30円の何倍でしたか。また35円の何倍でしたか。",
        "予定していた本数を□本とすると、値段が上がった後に買えた本数は、□を使ってどのように表せますか。",
    ),
    (
        "hd_4m_k07_604_2",
        ("steps", 0, "answer"),
        "30円の14倍／35円の12倍",
        "（□－2）本",
    ),
    (
        "hd_4m_k07_604_2",
        ("steps", 0, "choices"),
        [
            "30円の14倍／35円の12倍",
            "30円の12倍／35円の14倍",
            "30円の7倍／35円の6倍",
            "30円の35倍／35円の30倍",
        ],
        [
            "（□－2）本",
            "（□＋2）本",
            "（2×□）本",
            "（□÷2）本",
        ],
    ),
    (
        "hd_4m_k07_604_2",
        ("steps", 0, "meaning"),
        "持っていったお金は 30でも35でもわり切れる。30と35の最小公倍数は210。\n"
        "210円だと 30円で7本・35円で6本で、差は1本しかない。\n"
        "差が2本になるのは その2倍の420円のとき（30円で14本・35円で12本）。",
        "買えたえんぴつは予定より2本少なくなったので、予定の本数□から2を引いた（□－2）本になる。",
    ),
]


# ---------------------------------------------------------------- steps配列まるごとの置きかえ
# hd_4m_k07_580_1（HG-3200）は小問1・2の順序そのものを入れかえるため、steps配列を丸ごと
# 「直す前」「直したあと」で持っておき、完全一致で照合する。
TRAIN_ID = "hd_4m_k07_580_1"

TRAIN_STEPS_OLD = [
    {
        "question": "D駅でおりた人は何人ですか。",
        "answer": "29",
        "meaning": "B駅の降車7人は全員A→B客。B→C＋B→D＝9人、B→C＝B→D+3よりB→D＝3人、B→C＝6人。"
                   "C駅の降車11人のうちA→C客は11−6＝5人。A→D＝30−7−5＝18人。D駅の降車＝18+3+8＝29人。",
    },
    {
        "question": "A駅から乗ってD駅でおりた人は何人ですか。",
        "answer": "18",
        "meaning": "上の計算よりA→D＝18人です。",
    },
    {
        "question": "1駅乗ると150円、2駅乗ると180円、3駅乗ると220円の料金がかかるとすると、"
                     "この電車に乗った人の料金の合計は何円ですか。",
        "answer": "8550",
        "meaning": "1駅区間（A→B・B→C・C→D）合わせて21人×150円、2駅区間（A→C・B→D）合わせて8人×180円、"
                   "3駅区間（A→D）18人×220円。合計3150+1440+3960＝8550円。",
    },
]

TRAIN_STEPS_NEW = [
    {
        "question": "A駅から乗ってD駅でおりた人は何人ですか。",
        "answer": "18",
        "meaning": "B駅の降車7人は全員A→B客。B→C＋B→D＝9人、B→C＝B→D+3よりB→D＝3人、B→C＝6人。"
                   "C駅の降車11人のうちA→C客は11−6＝5人。A→D＝30−7−5＝18人。",
    },
    {
        "question": "D駅でおりた人は何人ですか。",
        "answer": "29",
        "meaning": "D駅でおりた人は、A→D・B→D・C→Dの3つを合わせた人数です。B→D＝3人、C→D＝8人"
                   "（C駅で乗った8人は全員D駅までなので）。A→D＝18人と合わせて 18+3+8＝29人。",
    },
    {
        "question": "1駅乗ると150円、2駅乗ると180円、3駅乗ると220円の料金がかかるとすると、"
                     "この電車に乗った人の料金の合計は何円ですか。",
        "answer": "8550",
        "meaning": "1駅区間（A→B・B→C・C→D）合わせて21人×150円、2駅区間（A→C・B→D）合わせて8人×180円、"
                   "3駅区間（A→D）18人×220円。合計3150+1440+3960＝8550円。",
    },
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[p] if isinstance(p, int) else node[p]
    return node, path[-1]


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    want = set(p[0] for p in FIELD_PATCHES) | {TRAIN_ID}
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in want:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = want - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))

    changed = skipped = 0

    # --- 単一欄パッチ ---
    for did, path, old, new in FIELD_PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:  # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)" % (
            did, "/".join(map(str, path)))
        node[key] = new
        changed += 1

    # --- hd_4m_k07_580_1 の steps 配列まるごと入れかえ ---
    x = found[TRAIN_ID]
    cur_steps = x.get("steps")
    if cur_steps == TRAIN_STEPS_NEW:
        skipped += 1
    else:
        assert cur_steps == TRAIN_STEPS_OLD, (
            TRAIN_ID + " steps: old value differs (another session wrote it?)")
        x["steps"] = TRAIN_STEPS_NEW
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    print("changed=%d  skipped(already-fixed)=%d  target=%s" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
