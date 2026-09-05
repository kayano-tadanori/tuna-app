# -*- coding: utf-8 -*-
"""
小4マスター算数（公開テスト kokai No.8〜No.10）塾講師監査 3班（audit_3.txt）の修正パッチ。
docs/_audit/g4m_w2/findings_3.md に対応する。

対象1件:
  hd_4m_k09_630_4 (HG-1507・正三角形を2本の線で切る)
    SVGは[図1][図2][図3]の3枚組で、平行四辺形を指す文字が図ごとに違う
    （[図1]=ア、[図2]=ウ、[図3]=オ）。ところがintro・小問2・小問3の設問文は
    常に「ア」を使っており、小問2は[図2]（アという文字が無く「ウ」しか無い）、
    小問3は[図3]（アもイも無く「エ」「オ」しか無い）を見て答える設問なので、
    子どもが図の中に「ア」を探しても見つからない。
    原簿の設問本文自身が「正三角形イと四角形ウの周りが同じ（ウの下底8cm）」と
    明記しており、小問2は「ウ」が正しい呼び名であることが原簿の文章だけで
    確認できる（原本PDF不要）。introの「右下の三角形ウ」という一文も誤りで、
    [図2]の「ウ」は原簿が「四角形ウ」と明記する平行四辺形であり、右下の
    （名前の無い）小さい三角形ではない。
    小問3は原簿の設問本文に文字の指定が無いため、[図3]の実際の文字
    （エ＝正三角形、オ＝平行四辺形）に合わせ、「アのななめの辺」という
    言い方（SVGの座標を実測しても平行四辺形の辺の長さと一致せず、確度が
    低いため採用しない）は使わず、原簿の言葉そのまま「大きな正三角形の
    右がわの辺のうち下の部分」に差し替える。
    ★数値・answer・choices・svgは一切変更しない。question/meaningの文言のみ。
    ★答え（21cm/36cm/54cm）は独立検算で確認ずみ、修正の前後で変わらない。

使い方:
  python scripts/_fix_g4m_w2_3.py [対象JSONのパス（省略時 data/hama_daimon.json）]

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 置換前に、その大問の中でちょうど1回だけ出ることを確認する。
  - 欄まるごとの一致で判定するので、既に直っていれば何もせず終える（冪等）。
  - 1プロセス内で読み書きし、書き出しは io.open(path, "wb") で行う。
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


TARGET_ID = "hd_4m_k09_630_4"
TARGET_SRC = "HG-1507"

INTRO_OLD = (
    "大きな正三角形を、底辺に平行な直線1本と、その右はしから 左の辺に平行な直線1本で切り、\n"
    "上の正三角形イ・平行四辺形ア・右下の三角形ウ の3つに分けます。"
)
INTRO_NEW = (
    "大きな正三角形を、底辺に平行な直線1本と、その右はしから 左の辺に平行な直線1本で切り、\n"
    "上の正三角形・まん中の平行四辺形・右下の三角形の3つに分けます。"
    "下の図のように、記号のつけ方は場合によって ア・イ・ウ や エ・オ のようにかわります。"
)

STEP1_Q_OLD = (
    "正三角形イの まわりと 平行四辺形アの まわりが同じで、アの下の辺が8cmのとき、"
    "大きな正三角形の まわりの長さは何cmですか。"
)
STEP1_Q_NEW = (
    "正三角形イの まわりと 平行四辺形ウの まわりが同じで、ウの下の辺が8cmのとき、"
    "大きな正三角形の まわりの長さは何cmですか。"
)
STEP1_M_OLD = (
    "イの1辺は アの下の辺と同じ8cm。イのまわりは 8×3＝24cm。これが "
    "大三角形の1辺の2つ分だから 1辺は12cm、まわりは36cm。"
)
STEP1_M_NEW = (
    "イの1辺は ウの下の辺と同じ8cm。イのまわりは 8×3＝24cm。これが "
    "大三角形の1辺の2つ分だから 1辺は12cm、まわりは36cm。"
)

STEP2_Q_OLD = (
    "正三角形イの まわりと 平行四辺形アの まわりが同じで、アのななめの辺が6cmのとき、"
    "大きな正三角形の まわりの長さは何cmですか。"
)
STEP2_Q_NEW = (
    "正三角形エの まわりと 平行四辺形オの まわりが同じで、"
    "大きな正三角形の右がわの辺のうち下の部分が6cmのとき、"
    "大きな正三角形の まわりの長さは何cmですか。"
)
STEP2_M_OLD = (
    "イの1辺を□とすると 大三角形の1辺は □+6。□×3＝(□+6)×2 なので "
    "□＝12、1辺は18cm、まわりは54cm。"
)
STEP2_M_NEW = (
    "エの1辺を□とすると 大三角形の1辺は □+6。□×3＝(□+6)×2 なので "
    "□＝12、1辺は18cm、まわりは54cm。"
)


def _replace_once(container, key, old, new, label):
    """container[key] が old と一致することを確認してから new に置き換える。
    既に new なら何もしない（冪等）。それ以外なら止める。"""
    cur = container.get(key)
    if cur == new:
        return False  # already fixed
    assert cur == old, "%s: unexpected current value (another session changed it?)\n  got=%r" % (label, cur)
    container[key] = new
    return True


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    found = None
    n_hit = 0
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") == TARGET_ID:
            n_hit += 1
            found = x
    assert n_hit == 1, "%s: expected exactly 1 match, got %d" % (TARGET_ID, n_hit)
    assert found is not None, "daimon not found: " + TARGET_ID
    assert found.get("src") == TARGET_SRC, \
        "%s: src mismatch (expected %s, got %r)" % (TARGET_ID, TARGET_SRC, found.get("src"))

    steps = found.get("steps", [])
    assert len(steps) == 3, "%s: expected 3 steps, got %d" % (TARGET_ID, len(steps))

    changed = 0

    if _replace_once(found, "intro", INTRO_OLD, INTRO_NEW, TARGET_ID + ".intro"):
        changed += 1

    s1 = steps[1]
    assert s1["answer"] == "36", "%s steps[1]: unexpected answer %r" % (TARGET_ID, s1.get("answer"))
    if _replace_once(s1, "question", STEP1_Q_OLD, STEP1_Q_NEW, TARGET_ID + ".steps[1].question"):
        changed += 1
    if _replace_once(s1, "meaning", STEP1_M_OLD, STEP1_M_NEW, TARGET_ID + ".steps[1].meaning"):
        changed += 1

    s2 = steps[2]
    assert s2["answer"] == "54", "%s steps[2]: unexpected answer %r" % (TARGET_ID, s2.get("answer"))
    if _replace_once(s2, "question", STEP2_Q_OLD, STEP2_Q_NEW, TARGET_ID + ".steps[2].question"):
        changed += 1
    if _replace_once(s2, "meaning", STEP2_M_OLD, STEP2_M_NEW, TARGET_ID + ".steps[2].meaning"):
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d fields  target=%s\n" % (changed, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
