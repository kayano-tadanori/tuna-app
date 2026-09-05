# -*- coding: utf-8 -*-
"""docs/_audit/g5m_w1/findings_1.md の指摘（小5マスター算数 復習テスト fukushu No.1〜6・32本監査）を直す修正パッチ。

対象1件（重大2件を1つの大問内で修正、大問は共通）:
  hd5m_01_5 (HG-0663) ... AB×BAの覆面算。
    重大2: steps[0] の設問が「A×Bの一の位=B」という条件しか書かれていないのに、
      解説は「B×Bの一の位=A」という2本目の条件（設問文に無い）まで使ってA=6を
      確定させていた。原簿(HG-0663)の作問メモ自体が2条件併用を明記しており、
      設問文に条件の書き漏れがあった。設問文に2本目の条件を足す（答え・解説は変更なし）。
    重大3: steps[3] が「64×46の部分積のうち、6×46はいくつですか」という、
      標準の筆算のどの段にも現れない架空の式を問うており、解説も
      「6×46=276…ではなく…②ここでは6×46=276」と自己矛盾していた。
      実在する部分積（64×6=384、筆算1行目）を問う設問に差し替える。

見送り（本パッチに含めない）:
  findings_1.md の「重大1」（fukushu No.1〜6内の11ペアの大問まるごとの重複）は、
  削除対象の選定という編集判断とQUESTION_COUNTS等の再同期を要する構造変更のため、
  本パッチ（テキスト置換）の範囲外として見送った。

使い方:
  python scripts/_fix_g5m_w1_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

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

TARGET_ID = "hd5m_01_5"
TARGET_HG = "HG-0663"

# ---- 重大2: steps[0] 設問に2本目の条件（B×Bの一の位=A）を足す ----------------
OLD_Q0 = (
    u"一の位に 注目します。A×B の 一の位が B に なるとき、A は いくつ ですか。"
    u"（B は 4 とします）"
)
NEW_Q0 = (
    u"一の位に 注目します。A×B の 一の位が B に なり、さらに B×B の 一の位が A に なるとき、"
    u"A は いくつ ですか。（B は 4 とします）"
)
# 答え・解説は変更しない（既に2条件を使って説明している）
ANSWER_0 = u"6"
MEANING_0 = (
    u"①A×4 の一の位が4になるのは A＝1 か 6。②B×B＝16 の一の位6がAなので A＝6。"
)

# ---- 重大3: steps[3] を実在する部分積（64×6=384）を問う設問に差し替える -------
OLD_Q3 = u"64×46 の 部分積の うち、6×46 は いくつ ですか。"
OLD_A3 = u"276"
OLD_M3 = (
    u"①6×46＝276… ではなく 筆算では 4×64＝256 と 6×64＝384。②ここでは 6×46＝276。"
)

NEW_Q3 = u"64×46 の 筆算で、一の位の6を かける 部分（64×6）は いくつ ですか。"
NEW_A3 = u"384"
NEW_M3 = (
    u"①64×6＝384。②これが 筆算の1行目に あたる。64×46＝2944 の 内わけの ひとつ。"
)


def fix_hd5m_01_5(x, fixed, seen):
    if x.get("id") != TARGET_ID:
        return
    seen.add(TARGET_ID)
    assert x.get("hg") == TARGET_HG or x.get("src", "").startswith(TARGET_HG), (
        u"%s: hg/src が想定と異なります (hg=%r, src=%r)"
        % (TARGET_ID, x.get("hg"), x.get("src"))
    )
    steps = x.get("steps") or []
    assert len(steps) == 4, u"%s: steps が想定(4個)と異なります(%d個)" % (TARGET_ID, len(steps))

    # --- 重大2: steps[0] ---
    s0 = steps[0]
    if s0.get("question") == NEW_Q0:
        pass  # 冪等：既に直っている
    else:
        assert s0.get("question") == OLD_Q0, (
            u"%s steps[0]: 設問文が想定と異なります（別セッションが書いた可能性）" % TARGET_ID
        )
        cnt = sum(1 for s in steps if s.get("question") == OLD_Q0)
        assert cnt == 1, u"%s: steps[0]の置換対象がちょうど1個ではありません(%d個)" % (TARGET_ID, cnt)
        assert s0.get("answer") == ANSWER_0, u"%s steps[0]: answer が想定と異なります" % TARGET_ID
        assert s0.get("meaning") == MEANING_0, u"%s steps[0]: meaning が想定と異なります" % TARGET_ID
        s0["question"] = NEW_Q0
        fixed.append(
            u"%s(%s): steps[0]の設問に欠けていた条件(B×Bの一の位=A)を追加"
            % (TARGET_ID, TARGET_HG)
        )

    # --- 重大3: steps[3] ---
    s3 = steps[3]
    if (s3.get("question") == NEW_Q3 and s3.get("answer") == NEW_A3
            and s3.get("meaning") == NEW_M3):
        pass  # 冪等：既に直っている
    else:
        assert s3.get("question") == OLD_Q3, (
            u"%s steps[3]: 設問文が想定と異なります（別セッションが書いた可能性）" % TARGET_ID
        )
        cnt = sum(1 for s in steps if s.get("question") == OLD_Q3)
        assert cnt == 1, u"%s: steps[3]の置換対象がちょうど1個ではありません(%d個)" % (TARGET_ID, cnt)
        assert s3.get("answer") == OLD_A3, u"%s steps[3]: answer が想定と異なります" % TARGET_ID
        assert s3.get("meaning") == OLD_M3, u"%s steps[3]: meaning が想定と異なります" % TARGET_ID
        s3["question"] = NEW_Q3
        s3["answer"] = NEW_A3
        s3["meaning"] = NEW_M3
        fixed.append(
            u"%s(%s): steps[3]を実在しない部分積(6×46)の設問から実在する部分積(64×6=384)の設問に差し替え"
            % (TARGET_ID, TARGET_HG)
        )


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    d = json.load(io.open(path, encoding="utf-8"))

    fixed = []
    seen = set()
    for rec in iter_daimon(d):
        x = rec["x"]
        fix_hd5m_01_5(x, fixed, seen)

    missing = {TARGET_ID} - seen
    assert not missing, u"対象の大問が見つかりませんでした: %s" % sorted(missing)

    print(u"修正件数: %d" % len(fixed))
    for f in fixed:
        print(u" - " + f)

    out = json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8")
    io.open(path, "wb").write(out)


if __name__ == "__main__":
    main()
