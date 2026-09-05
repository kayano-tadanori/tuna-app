# -*- coding: utf-8 -*-
"""
小4マスター算数（復習テスト No.1〜27）監査 audit_1.txt の指摘を当てる修正パッチ。
docs/_audit/g4m_w1/findings_1.md に対応する。

対象5件（すべて塾講師監査で「原簿と突き合わせ・独立検算」の結果、確定した不具合）:
  1. hd4m_16_1  (HG-0829) - 小問4「台形」の答えが 18 のままだが、
     小問3で新設した「平行四辺形（4こ）」を除く条件なら正しくは 14。
     （幾何列挙で独立検算：座標から全四角形を洗い出し、5+4+4+14=27 と
      genbo原本の合計 5+4+18=27 の両方に一致することを確認した）
  2. hd_4m_f02_8 (HG-0806) - 小問1（わられる数）の解説が小問2の答え（商106）を
     先に言い切ってしまう「未回答小問の値の先出し」。小問の順番を
     商→わられる数 に入れかえ、わられる数5621は商106の後に導出する形にする。
  3. hd_4m_f04_7 (HG-0808) - 小問1（最小の整数）の解説が「3017から3049まで」と
     範囲の上端まで書いてしまい、小問2の答え(3049)を先出ししている。
     小問1の解説を「最小」だけの導出に絞る。
  4. hd_4m_f18_8 (HG-0831) - 小問1（外周の面積）の解説が
     「162+108+54+9＝333」と内訳をすべて書いてしまい、小問2(54)・小問3(108)の
     答えを先出ししている。小問1は「1まい目144cm²＋1つ前の紙との重なりを除いた
     63cm²×3」という、内訳を出さない別の求め方に直す。
     あわせて小問3（108）は、直すまで「たしかめ」の検算式だけで
     108自体を導出していなかったため、独立検算で確認した式に差し替える。
  5. hd_4m_f07_9 (HG-0813) - 小問1の解説が「Aができなかった人は…30人」と、
     小問2の答え(30)と同じ数値を単独の事実として書き出してしまっている
     （別の量の値だが数値が一致して見える）。合成した式の形に直し、
     単独の値として書かないようにする。

使い方:
  python scripts/_fix_g4m_w1_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 各修正は「その大問の中でちょうど1回」の一致を assert してから書き換える。
  - 欄まるごとの一致で判定するので、既に直っていれば何もせず終える（冪等）。
  - 1プロセス内で読み書きし、書き出しは io.open(path, "wb") で行う。
"""
import io
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import genbo_common as gc  # noqa: E402


def get_daimon(d, target_id):
    """iter_daimon だけを使って id で1本引く。0本/2本以上なら例外。"""
    hits = [r for r in gc.iter_daimon(d) if r["x"].get("id") == target_id]
    assert len(hits) == 1, f"{target_id}: 大問が{len(hits)}本ヒットした（1本のはず）"
    return hits[0]["x"]


def fix_hd4m_16_1(d):
    """HG-0829: 小問4「台形」の答えを 18→14 に訂正。"""
    x = get_daimon(d, "hd4m_16_1")
    steps = x["steps"]
    assert len(steps) == 4, "hd4m_16_1: 小問が4つのはず"
    step4 = steps[3]

    OLD_ANSWER = "18"
    NEW_ANSWER = "14"
    OLD_MEANING = (
        "向かい合う辺が**1組だけ**平行なもので**18こ**。"
        "**図を左右対称だと思いこむと、右上と左下で数がずれる**。"
        "左上（X字）と右上（線1本）はできる四角形の数がちがうので、"
        "片方を数えて2倍してはいけない。"
    )
    NEW_MEANING = (
        "向かい合う辺が**1組だけ**平行なもので**14こ**。"
        "台形は「1組だけ平行」なので、前の問題で数えた平行四辺形（2組とも平行・4こ）は"
        "ふくまない。**図を左右対称だと思いこむと、右上と左下で数がずれる**。"
        "左上（X字）と右上（線1本）はできる四角形の数がちがうので、"
        "片方を数えて2倍してはいけない。"
    )

    already_done = (step4["answer"] == NEW_ANSWER and step4["meaning"] == NEW_MEANING)
    if already_done:
        return False

    assert step4["answer"] == OLD_ANSWER, (
        f"hd4m_16_1 小問4: answer が想定と違う: {step4['answer']!r}"
    )
    assert step4["meaning"] == OLD_MEANING, (
        f"hd4m_16_1 小問4: meaning が想定と違う: {step4['meaning']!r}"
    )
    step4["answer"] = NEW_ANSWER
    step4["meaning"] = NEW_MEANING
    return True


def fix_hd_4m_f02_8(d):
    """HG-0806: 小問1が小問2の答え(商106)を先出ししている。順番を入れかえる。"""
    x = get_daimon(d, "hd_4m_f02_8")
    steps = x["steps"]
    assert len(steps) == 2, "hd_4m_f02_8: 小問が2つのはず"

    OLD_Q1 = {
        "question": "わられる数（4けた）はいくつですか。",
        "answer": "5621",
        "meaning": (
            "53×商+3 の一の位が1になるのは 商が106のときだけ。53×106+3＝5621。"
            "商のまん中が0なのは とちゅうで53がひけなかったという意味。"
        ),
    }
    OLD_Q2 = {
        "question": "商はいくつですか。",
        "answer": "106",
        "meaning": "5621÷53＝106 あまり3。",
    }
    NEW_Q1 = {
        "question": "商はいくつですか。",
        "answer": "106",
        "meaning": (
            "53×商+3 の一の位が1になるのは、商の一の位が6のとき（106、206、306…）。"
            "商は3けたでまん中の位が0、わられる数は4けたなので、"
            "53×200+3 のようにもう5けたになってしまう商は大きすぎる。"
            "あてはまる商は106だけ。"
        ),
    }
    NEW_Q2 = {
        "question": "わられる数（4けた）はいくつですか。",
        "answer": "5621",
        "meaning": (
            "（前の設問の答えである）商106を使って 53×106+3＝5621。"
            "商のまん中が0なのは とちゅうで53がひけなかったという意味。"
        ),
    }

    already_done = (steps[0] == NEW_Q1 and steps[1] == NEW_Q2)
    if already_done:
        return False

    assert steps[0] == OLD_Q1, f"hd_4m_f02_8 小問1: 想定と違う: {steps[0]!r}"
    assert steps[1] == OLD_Q2, f"hd_4m_f02_8 小問2: 想定と違う: {steps[1]!r}"
    steps[0] = NEW_Q1
    steps[1] = NEW_Q2
    return True


def fix_hd_4m_f04_7(d):
    """HG-0808: 小問1の解説が小問2の答え(3049)まで先出ししている。範囲の上端を削る。"""
    x = get_daimon(d, "hd_4m_f04_7")
    steps = x["steps"]
    assert len(steps) == 3, "hd_4m_f04_7: 小問が3つのはず"
    step1 = steps[0]

    OLD_MEANING = "3倍した数が 9050以上9149以下。3でわりもどすと 3017から3049まで。"
    NEW_MEANING = (
        "3倍した数が9050以上9149以下になる整数をさがす。"
        "9050÷3＝3016.6…なので、3倍して9050以上になる いちばん小さい整数は3017。"
    )

    if step1["meaning"] == NEW_MEANING:
        return False

    assert step1["answer"] == "3017", f"hd_4m_f04_7 小問1: answer が想定と違う: {step1['answer']!r}"
    assert step1["meaning"] == OLD_MEANING, f"hd_4m_f04_7 小問1: meaning が想定と違う: {step1['meaning']!r}"
    step1["meaning"] = NEW_MEANING
    return True


def fix_hd_4m_f18_8(d):
    """HG-0831: 小問1の解説が小問2(54)・小問3(108)の答えを先出ししている。
    小問1は内訳を出さない別解法に、小問3は108を実際に導出する式に差し替える。
    """
    x = get_daimon(d, "hd_4m_f18_8")
    steps = x["steps"]
    assert len(steps) == 3, "hd_4m_f18_8: 小問が3つのはず"
    step1, step2, step3 = steps

    OLD_M1 = "紙が1まいでもある部分ぜんぶ。162+108+54+9＝333cm²。"
    NEW_M1 = (
        "1まい目はまるごと144cm²。2まい目からは、1つ前の紙と重なる部分"
        "（1辺9cmの正方形＝81cm²）をのぞいた63cm²だけが新しく増える。"
        "144+63×3＝333cm²。"
    )

    OLD_M3 = "たしかめ：162×1+108×2+54×3+9×4＝576＝144×4 で 紙4まいぶんに ぴったり合う。"
    NEW_M3 = (
        "2まいずつの組で 重なりぐあいを見る。となりどうし（1と2、2と3、3と4）は"
        "1辺9cmで81cm²ずつ、1つとばし（1と3、2と4）は1辺6cmで36cm²ずつ、"
        "はしとはし（1と4）は1辺3cmで9cm²。ぜんぶたすと 81×3+36×2+9＝324cm²。"
        "この中には、ちょうど3まい重なる部分（54cm²）が3回ずつ、"
        "ちょうど4まい重なる部分（9cm²）が6回ずつ数えられている。"
        "324−54×3−9×6＝108cm²が、ちょうど2まい重なる部分。"
    )

    already_done = (step1["meaning"] == NEW_M1 and step3["meaning"] == NEW_M3)
    if already_done:
        return False

    assert step1["answer"] == "333", f"hd_4m_f18_8 小問1: answer が想定と違う: {step1['answer']!r}"
    assert step1["meaning"] == OLD_M1, f"hd_4m_f18_8 小問1: meaning が想定と違う: {step1['meaning']!r}"
    assert step2["answer"] == "54", f"hd_4m_f18_8 小問2: answer が想定と違う: {step2['answer']!r}"
    assert step3["answer"] == "108", f"hd_4m_f18_8 小問3: answer が想定と違う: {step3['answer']!r}"
    assert step3["meaning"] == OLD_M3, f"hd_4m_f18_8 小問3: meaning が想定と違う: {step3['meaning']!r}"

    step1["meaning"] = NEW_M1
    step3["meaning"] = NEW_M3
    return True


def fix_hd_4m_f07_9(d):
    """HG-0813: 小問1の解説が「Aができなかった人は…30人」を単独の値として書き、
    小問2の答え(30)と数値が一致して見える。合成した式の形に直す。
    """
    x = get_daimon(d, "hd_4m_f07_9")
    steps = x["steps"]
    assert len(steps) == 3, "hd_4m_f07_9: 小問が3つのはず"
    step1 = steps[0]

    OLD_MEANING = (
        "Aができなかった人は 50−20＝30人、Bができなかった人は35人。"
        "2つの和 65人は 全体50人を15人 こえるので、その15人は かならず 両方に入る。"
    )
    NEW_MEANING = (
        "Aができなかった人とBができなかった人をあわせると (50−20)+35＝65人。"
        "全体は50人しかいないので、65−50＝15人ぶんは 数えすぎ。"
        "この15人は かならずAもBもできなかった人。"
    )

    if step1["meaning"] == NEW_MEANING:
        return False

    assert step1["answer"] == "15", f"hd_4m_f07_9 小問1: answer が想定と違う: {step1['answer']!r}"
    assert step1["meaning"] == OLD_MEANING, f"hd_4m_f07_9 小問1: meaning が想定と違う: {step1['meaning']!r}"
    step1["meaning"] = NEW_MEANING
    return True


FIXES = [
    fix_hd4m_16_1,
    fix_hd_4m_f02_8,
    fix_hd_4m_f04_7,
    fix_hd_4m_f18_8,
    fix_hd_4m_f07_9,
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("data", "hama_daimon.json")

    with io.open(path, "r", encoding="utf-8") as f:
        d = json.load(f)

    changed = []
    for fn in FIXES:
        did = fn(d)
        changed.append((fn.__name__, did))

    n_applied = sum(1 for _, did in changed if did)
    for name, did in changed:
        print(f"  {'適用' if did else 'スキップ（済み）'}: {name}")

    if n_applied == 0:
        print("変更なし（すでに全部適用済み）。書き込みは行わない。")
        return

    out = json.dumps(d, ensure_ascii=False, indent=2)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))
    print(f"{n_applied}件を適用し、{path} に書き込んだ。")


if __name__ == "__main__":
    main()
