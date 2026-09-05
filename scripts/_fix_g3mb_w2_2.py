# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 監査（audit_2.txt / hd3mb_14_5〜hd3mb_17_2・25本）のパッチ。

findings_2.md（docs/_audit/g3mb_w2/）に対応。見つかった不具合は全部同じ根っこ＝
「小問を複数に分けたとき、先に答える小問の解説(meaning)が、まだ聞いていない
後ろの小問の答えを先に見せてしまう」パターン（js/sansu.js の showSqFeedback が
小問ごとに meaning をフィードバックとして出し、直後に次の小問へ進むため）。

直す大問（すべて 3学年 master_bunsatsu fukushu）:
  位取り分割（meaningの文だけ書きかえ）:
    hd3mb_14_5  (HG-4147) x2箇所
    hd3mb_14_6  (HG-4148)
    hd3mb_14_8  (HG-4150)
    hd3mb_14_10 (HG-4152)
    hd3mb_14_12 (HG-4154)
  小問の並び順を解く順序に入れかえ（stepsまるごと差しかえ）:
    hd3mb_14_15 (HG-4157) りんご→なし→かご を りんご→かご→なし に
    hd3mb_14_16 (HG-4158) はるお→ふゆお→なつお→あきお を ふゆお→はるお→あきお→なつお に

使い方: python scripts/_fix_g3mb_w2_2.py [対象JSONパス（省略時 data/hama_daimon.json）]
1プロセス内で読み込み→書き換え→書き出し。冪等（2回流しても内容が変わらない）。
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # 大問を数える・引く唯一の走査口

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")


def fix_step_meaning(x, question_exact, old_meaning, new_meaning, label):
    """x["steps"] の中から question が一致する小問をちょうど1つ探し、
    meaning が old ならば new に差し替える。すでに new ならなにもしない（冪等）。
    old でも new でもない状態は事故なので assert で止める。
    """
    steps = x.get("steps", [])
    matches = [s for s in steps if s.get("question") == question_exact]
    assert len(matches) == 1, "%s: question not found or not unique (%d matches)" % (label, len(matches))
    s = matches[0]
    cur = s.get("meaning")
    if cur == new_meaning:
        return False
    assert cur == old_meaning, "%s: meaning mismatch, got: %r" % (label, cur)
    s["meaning"] = new_meaning
    return True


def fix_steps_order(x, expected_old_steps, new_steps, label):
    """x["steps"] が expected_old_steps とちょうど一致するときだけ new_steps に
    差し替える。すでに new_steps ならなにもしない（冪等）。どちらでもなければ
    事故なので assert で止める。
    """
    cur = x.get("steps")
    if cur == new_steps:
        return False
    assert cur == expected_old_steps, "%s: steps mismatch (unexpected current content)" % label
    x["steps"] = [dict(s) for s in new_steps]
    return True


def main():
    with io.open(TARGET, "r", encoding="utf-8") as f:
        data = json.load(f)

    by_id = {}
    for rec in iter_daimon(data, grade="3", app_courses=["master_bunsatsu"]):
        x = rec["x"]
        if isinstance(x, dict) and x.get("id"):
            by_id[x["id"]] = x

    changed = []

    # ---- 1) hd3mb_14_5 (HG-4147) ----------------------------------------
    x = by_id["hd3mb_14_5"]
    assert x.get("src") == "HG-4147", "hd3mb_14_5: src changed, stop (%r)" % x.get("src")
    if fix_step_meaning(
        x,
        "①3L+5dLを計算しなさい。Lの部分の数を答えなさい。",
        "3L+5dL=3L5dL。",
        "5dLは10dLより少ないのでLはくり上がらない。Lの部分はもとの3のまま。",
        "hd3mb_14_5/L部分1",
    ):
        changed.append("hd3mb_14_5:L部分1")
    if fix_step_meaning(
        x,
        "②4L1dL-2L3dLを計算しなさい。Lの部分の数を答えなさい。",
        "4L1dL-2L3dL=1L8dL。",
        "1dLからは3dLをひけないので、Lから1L(=10dL)を借りてくる。すると、Lの部分は4-1-2=1になる。",
        "hd3mb_14_5/L部分2",
    ):
        changed.append("hd3mb_14_5:L部分2")

    # ---- 2) hd3mb_14_6 (HG-4148) ----------------------------------------
    x = by_id["hd3mb_14_6"]
    assert x.get("src") == "HG-4148", "hd3mb_14_6: src changed, stop (%r)" % x.get("src")
    if fix_step_meaning(
        x,
        "2本のだいこんを合わせると重さは何kg何gですか。kgの部分の数を答えなさい。",
        "1kg100g+850g=1kg950g。",
        "100g+850gは1000gより少ないのでkgはくり上がらない。kgの部分は1のまま変わらない。",
        "hd3mb_14_6/kg部分",
    ):
        changed.append("hd3mb_14_6:kg部分")

    # ---- 3) hd3mb_14_8 (HG-4150) ----------------------------------------
    x = by_id["hd3mb_14_8"]
    assert x.get("src") == "HG-4150", "hd3mb_14_8: src changed, stop (%r)" % x.get("src")
    if fix_step_meaning(
        x,
        "全体の重さは何kg何gですか。kgの部分の数を答えなさい。",
        "230×12=2760、2760+500=3260g=3kg260g。",
        "230×12=2760(g)。2760+500=3260(g)。3260gは3000gと4000gの間なので、kgの部分は3。",
        "hd3mb_14_8/kg部分",
    ):
        changed.append("hd3mb_14_8:kg部分")

    # ---- 4) hd3mb_14_10 (HG-4152) -----------------------------------------
    x = by_id["hd3mb_14_10"]
    assert x.get("src") == "HG-4152", "hd3mb_14_10: src changed, stop (%r)" % x.get("src")
    if fix_step_meaning(
        x,
        "1日に何L何dLの牛にゅうを飲みますか。Lの部分の数を答えなさい。",
        "800+200+300(3dL)=1300mL=1L3dL。",
        "800+200+300=1300(mL)。1300mLは1000mLと2000mLの間なので、Lの部分は1。",
        "hd3mb_14_10/L部分",
    ):
        changed.append("hd3mb_14_10:L部分")

    # ---- 5) hd3mb_14_12 (HG-4154) -----------------------------------------
    x = by_id["hd3mb_14_12"]
    assert x.get("src") == "HG-4154", "hd3mb_14_12: src changed, stop (%r)" % x.get("src")
    if fix_step_meaning(
        x,
        "②4L3dL+2500mL-9dLを計算しなさい。Lの部分の数を答えなさい。",
        "4L3dL=43dL、2500mL=25dL、43+25-9=59dL=5L9dL。",
        "4L3dL=43dL、2500mL=25dL。43+25-9=59(dL)。59dLは50dLと60dLの間なので、Lの部分は5。",
        "hd3mb_14_12/L部分2",
    ):
        changed.append("hd3mb_14_12:L部分2")

    # ---- 6) hd3mb_14_15 (HG-4157) ... 並び順入れかえ -------------------------
    x = by_id["hd3mb_14_15"]
    assert x.get("src") == "HG-4157", "hd3mb_14_15: src changed, stop (%r)" % x.get("src")
    old_steps_14_15 = [
        {
            "question": "りんご1こ分の重さは何gですか。",
            "answer": "350",
            "meaning": "りんご9こ分とりんご5こ分の差1400gがりんご4こ分にあたるので、1400÷4=350g。",
        },
        {
            "question": "なし1こ分の重さは何gですか。",
            "answer": "400",
            "meaning": "りんご7ことなし3こで4100g。かご450gとりんご7こ分(350×7=2450g)を引くと、なし3こ分は1200g。1200÷3=400g。",
        },
        {
            "question": "かごの重さは何gですか。",
            "answer": "450",
            "meaning": "りんご1こ・なし1この重さが分かれば、2.2kg=かご+りんご5こ から かごの重さが逆算できる。りんご9こと5こののせかたの差＝りんご4こ分の重さ。3600-2200=1400gよりりんご1こ=350g。かご=2200-350×5=450g。",
        },
    ]
    new_steps_14_15 = [
        {
            "question": "りんご1こ分の重さは何gですか。",
            "answer": "350",
            "meaning": "りんご9こ分とりんご5こ分の差1400gがりんご4こ分にあたるので、1400÷4=350g。",
        },
        {
            "question": "かごの重さは何gですか。",
            "answer": "450",
            "meaning": "りんご9こと5こののせかたの差＝りんご4こ分の重さ。3600-2200=1400gよりりんご1こ=350g。かご=2200-350×5=450g。",
        },
        {
            "question": "なし1こ分の重さは何gですか。",
            "answer": "400",
            "meaning": "りんご7ことなし3こで4100g。かご450gとりんご7こ分(350×7=2450g)を引くと、なし3こ分は1200g。1200÷3=400g。",
        },
    ]
    if fix_steps_order(x, old_steps_14_15, new_steps_14_15, "hd3mb_14_15"):
        changed.append("hd3mb_14_15:steps order (ringo->kago->nashi)")

    # ---- 7) hd3mb_14_16 (HG-4158) ... 並び順入れかえ -------------------------
    x = by_id["hd3mb_14_16"]
    assert x.get("src") == "HG-4158", "hd3mb_14_16: src changed, stop (%r)" % x.get("src")
    old_steps_14_16 = [
        {
            "question": "はるお君の体重は何kgですか。",
            "answer": "40",
            "meaning": "ふゆお+はるお=60kgで、ふゆおははるおの半分なので、ふゆお=60÷3=20kg、はるお=20×2=40kg。",
        },
        {
            "question": "ふゆお君の体重は何kgですか。",
            "answer": "20",
            "meaning": "ふゆお+はるお=60kgで、ふゆおははるおの半分なので、ふゆお=60÷3=20kg。",
        },
        {
            "question": "なつお君の体重は何kgですか。",
            "answer": "32",
            "meaning": "なつお+あきお=119-60=59kg。あきおはなつおより5kg軽いので、あきお=(59-5)÷2=27kg、なつお=27+5=32kg。",
        },
        {
            "question": "あきお君の体重は何kgですか。",
            "answer": "27",
            "meaning": "なつお+あきお=119-60=59kg。あきおはなつおより5kg軽いので、あきお=(59-5)÷2=27kg。",
        },
    ]
    new_steps_14_16 = [
        {
            "question": "ふゆお君の体重は何kgですか。",
            "answer": "20",
            "meaning": "ふゆお+はるお=60kgで、ふゆおははるおの半分なので、ふゆお=60÷3=20kg。",
        },
        {
            "question": "はるお君の体重は何kgですか。",
            "answer": "40",
            "meaning": "ふゆお=20kgなので、はるお=20×2=40kg。",
        },
        {
            "question": "あきお君の体重は何kgですか。",
            "answer": "27",
            "meaning": "なつお+あきお=119-60=59kg。あきおはなつおより5kg軽いので、あきお=(59-5)÷2=27kg。",
        },
        {
            "question": "なつお君の体重は何kgですか。",
            "answer": "32",
            "meaning": "あきお=27kgなので、なつお=27+5=32kg。",
        },
    ]
    if fix_steps_order(x, old_steps_14_16, new_steps_14_16, "hd3mb_14_16"):
        changed.append("hd3mb_14_16:steps order (fuyuo->haruo->akio->natsuo)")

    with io.open(TARGET, "wb") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))

    print("changed: %d" % len(changed))
    for c in changed:
        print("  -", c)


if __name__ == "__main__":
    main()
