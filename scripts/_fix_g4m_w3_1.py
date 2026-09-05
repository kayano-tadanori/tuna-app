# -*- coding: utf-8 -*-
"""docs/_audit/g4m_w3/findings_1.md の指摘（小4マスター算数 kokai No.10〜12・26本監査）を直す修正パッチ。

対象3件:
  1. hd_4m_k10_583_1 (HG-3239) ... 小問1の解説が、小問2で必要な先の値(f(5)=8, f(6)=13)まで
     書き出していた（未回答の小問の答えの先出し）。数列を1,2,3,5,...に短縮する。
  2. hd_4m_k11_584_3 (HG-3271) ... 小問3の解説の数列に誤り（9,20,35,54は誤り。
     正しくは8,18,32,50。原簿自身の式T(m)+ceil(m/2)で検算しても一致）。
     最終の答え「60」自体は正しいので答え・choicesは変更しない。
  3. hd_4m_k11_584_4 (HG-3272) ... 小問3が、別大問 hd_4m_k11_584_1 (HG-3273) の設問・答え・
     解説とほぼ一字一句同一の重複。HG-3272原簿の設問は1問だけで小問3に相当する内容は無い。
     この小問を削除する。

使い方:
  python scripts/_fix_g4m_w3_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

1プロセス内で読み書きし、書き出しは io.open(path, "wb")。json.dumps は indent=1 固定。
大問は genbo_common.iter_daimon だけで引く。置換前に「その大問の中でちょうど1回」を assert。
欄まるごとの一致で冪等性を判定する（2回流しても結果は変わらない）。
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

DEFAULT_PATH = os.path.join(BASE, "data", "hama_daimon.json")


# ---- 1. hd_4m_k10_583_1 (HG-3239) ----------------------------------------
OLD_3239 = (
    u"新しく連絡を受ける人数は、1分後から順に1,2,3,5,8,13,…と直前2回の合計になっていきます"
    u"（1分後1人・2分後2人・3分後3人・4分後は2分後3分後の合計で5人）。"
    u"3分後→4分後の間に新しく受ける人数は5人です。"
)
NEW_3239 = (
    u"新しく連絡を受ける人数は、1分後から順に1,2,3,5,…と直前2回の合計になっていきます"
    u"（1分後1人・2分後2人・3分後3人・4分後は2分後3分後の合計で5人）。"
    u"3分後→4分後の間に新しく受ける人数は5人です。"
)

# ---- 2. hd_4m_k11_584_3 (HG-3271) -----------------------------------------
OLD_3271 = (
    u"ちがいが0になるのは、新しいかたまりに入って少し進んだところ。"
    u"順に 2、4、9、12、20、24、35、40、54、60 となるので10回目は60こ。"
)
NEW_3271 = (
    u"ちがいが0になるのは、新しいかたまりに入って少し進んだところ。"
    u"順に 2、4、8、12、18、24、32、40、50、60 となるので10回目は60こ。"
)

# ---- 3. hd_4m_k11_584_4 (HG-3272) -----------------------------------------
DUP_QUESTION_3272 = (
    u"ある日、りんごとみかんをそれぞれ何こか買うと合計代金は1850円でした。"
    u"次の日、950円でみかんだけをできるだけたくさん買ったところ、"
    u"その個数は前の日に買ったりんごの個数のちょうど半分でした。"
    u"2日間でみかんは全部で何こ買いましたか。"
)


def fix_3239(x, fixed, seen):
    if x.get("id") != "hd_4m_k10_583_1":
        return
    seen.add("hd_4m_k10_583_1")
    steps = x.get("steps") or []
    assert len(steps) >= 1, u"hd_4m_k10_583_1: steps がありません"
    if steps[0].get("meaning") == NEW_3239:
        return  # 冪等：既に直っている
    cnt = sum(1 for s in steps if s.get("meaning") == OLD_3239)
    assert cnt == 1, (
        u"hd_4m_k10_583_1: 置換対象がちょうど1個ではありません(%d個)" % cnt
    )
    for s in steps:
        if s.get("meaning") == OLD_3239:
            s["meaning"] = NEW_3239
    fixed.append(u"hd_4m_k10_583_1(HG-3239): 小問1の解説から未回答小問の先出し(8,13)を除去")


def fix_3271(x, fixed, seen):
    if x.get("id") != "hd_4m_k11_584_3":
        return
    seen.add("hd_4m_k11_584_3")
    steps = x.get("steps") or []
    assert len(steps) >= 3, u"hd_4m_k11_584_3: steps が3個未満です"
    if steps[2].get("meaning") == NEW_3271:
        return  # 冪等：既に直っている
    cnt = sum(1 for s in steps if s.get("meaning") == OLD_3271)
    assert cnt == 1, (
        u"hd_4m_k11_584_3: 置換対象がちょうど1個ではありません(%d個)" % cnt
    )
    for s in steps:
        if s.get("meaning") == OLD_3271:
            s["meaning"] = NEW_3271
    fixed.append(u"hd_4m_k11_584_3(HG-3271): 小問3の解説の数列の誤り(9,20,35,54→8,18,32,50)を修正")


def fix_3272(x, fixed, seen):
    if x.get("id") != "hd_4m_k11_584_4":
        return
    seen.add("hd_4m_k11_584_4")
    steps = x.get("steps") or []
    cnt = sum(1 for s in steps if s.get("question") == DUP_QUESTION_3272)
    if cnt == 0:
        return  # 冪等：既に削除済み
    assert cnt == 1, (
        u"hd_4m_k11_584_4: 削除対象がちょうど1個ではありません(%d個)" % cnt
    )
    assert len(steps) == 3, (
        u"hd_4m_k11_584_4: steps が想定(3個)と異なります(%d個)" % len(steps)
    )
    x["steps"] = [s for s in steps if s.get("question") != DUP_QUESTION_3272]
    fixed.append(u"hd_4m_k11_584_4(HG-3272): 別大問(hd_4m_k11_584_1)と重複する小問3を削除")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    d = json.load(io.open(path, encoding="utf-8"))

    fixed = []
    seen = set()
    for rec in iter_daimon(d):
        x = rec["x"]
        fix_3239(x, fixed, seen)
        fix_3271(x, fixed, seen)
        fix_3272(x, fixed, seen)

    missing = {"hd_4m_k10_583_1", "hd_4m_k11_584_3", "hd_4m_k11_584_4"} - seen
    assert not missing, u"対象の大問が見つかりませんでした: %s" % sorted(missing)

    print(u"修正件数: %d" % len(fixed))
    for f in fixed:
        print(u" - " + f)

    out = json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8")
    io.open(path, "wb").write(out)


if __name__ == "__main__":
    main()
