# -*- coding: utf-8 -*-
"""docs/_audit/g3mb_w4/findings_3.md の指摘を hama_daimon.json に当てるパッチ。

  python scripts/_fix_g3mb_w4_3.py [対象JSON]      （省略時 data/hama_daimon.json）

対象: 小3マスター算数第2分冊 No.24〜No.26（hd3mb_24_1〜hd3mb_26_1・HG-4267〜HG-4296）。
29本を原簿と突き合わせ、独立検算（分数計算・90項目）と図SVG座標の実測（10本）を
行った結果、内容面の不具合は0件（findings_3.md参照）。EDITSは空。

このスクリプトは「何も直すことがなかった」ことを記録として残すために、
他の _fix_g3mb_w*_*.py と同じ形（iter_daimonだけで大問を引く／冪等）で置いてある。
EDITSが空でも実行できて、何も書き換えずに終わることを確認できる。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う（自前で入れ子を歩かない）
  * 文字列置換は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    → [[feedback_anchor_uniqueness]]（アンカーが一意でなく72万字を壊した）
  * 何度流しても同じ結果（すでに直っていればスキップ＝冪等）
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
    → [[feedback_heikou_session_jouyaki]]（並行セッションの変更を消さないため滞留を最短に）
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化けて全行差分になる）
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


# ================================================================ 置きかえ表
# ("R", パス, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
# 今回は監査の結果、内容面の不具合が0件だったため空。
EDITS = [
]


# ================================================================ 当てる
def _get_holder(x, path):
    """パス（"svg" / "steps/0/meaning"）から (入れ物dict, キー) を返す。"""
    parts = path.split("/")
    if len(parts) == 1:
        return x, parts[0]
    assert parts[0] == "steps" and len(parts) == 3, "パスの形がおかしい: " + path
    i = int(parts[1])
    steps = x.get("steps") or []
    assert i < len(steps), "小問 %d が無い（%s）" % (i, path)
    return steps[i], parts[2]


def apply_edits(x, edits, log):
    changed = 0
    for kind, path, old, new in edits:
        holder, key = _get_holder(x, path)
        cur = holder.get(key, "")
        assert isinstance(cur, str), "文字列でない項目は触らない: " + path

        if kind == "R":
            if new in cur and (old not in cur or old in new):
                continue                      # すでに直っている
            if old not in cur:
                assert new in cur, "%s: もとの文字列も置きかえ後の文字列も見つからない → %r" % (path, old[:40])
                continue                      # すでに直っている
            n = cur.count(old)
            assert n == 1, "%s: アンカーが %d 回出る（1回でないので置きかえない）→ %r" % (path, n, old[:40])
            holder[key] = cur.replace(old, new)
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

    if not EDITS:
        log("EDITSが空（今回の監査では内容面の不具合が0件）。ファイルは書きかえない。")
        return 0

    # ★改行コードは元ファイルに合わせる（合わせないと全行が差分になり、
    #   並行して直している相手の変更が diff に埋もれて見えなくなる）
    with io.open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    newline = "\r\n" if "\r\n" in raw else "\n"
    d = json.loads(raw)
    log("  改行コード: %s" % ("CRLF" if newline == "\r\n" else "LF"))

    index = {}
    for rec in iter_daimon(d):          # ★走査はここだけ（自前で入れ子を歩かない）
        x = rec["x"]
        i = x.get("id")
        if i:
            index.setdefault(i, []).append(x)

    total_changed = 0
    touched = 0
    for did, edits in EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        c = apply_edits(hits[0], edits, log)
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
