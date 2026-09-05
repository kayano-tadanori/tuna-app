# -*- coding: utf-8 -*-
"""docs/_audit/g5m_w1/findings_3.md の指摘を hama_daimon.json に当てるパッチ。

  python scripts/_fix_g5m_w1_3.py [対象JSON]      （省略時 data/hama_daimon.json）

対象: 小5マスター算数（復習テスト） fukushu No.10（hd_5m_f10_6）〜No.17（hd_5m_f17_6）・39本。
原簿と突き合わせ・独立検算した結果、重大1件・中1件・軽1件を見つけて直す（詳細はfindings_3.md）。
原本PDF（C:/Users/User/Desktop/浜問題/5年算数/）はGoogle Drive未接続でアクセスできなかったため、
図SVGの修正は無い（今回は独立検算だけで判定できる不具合のみ）。

  1) hd5m_13_5（HG-0715）steps[2] ……「A＋B＝a、C＋D＝cとすると a:c＝4:3から21a＝何cか」
     という設問。a,cをA+B,C+Dの意味で使うと21a＝20cは成り立たない（正しくは21a＝28c）。
     双子問題HG-1563（id hd_5m_f13_8）の解説（a,cを比の単位＝A/4,C/3の意味で使う版）から
     定義を混同したまま持ち込まれた式。小問4は小問3に依存せず単独で正しく20:21を導けて
     いるため、ステップごと削除する。
  2) hd5m_12_4（HG-0712）steps[3].question ……「容器の容積はAの何はい分ですか」と聞いて
     答えを126としているが、独立検算すると実際のAカップの杯数は63（126はA:B＝2:7の
     比の単位ruでの容積で、Aカップ1杯＝2ruだから126÷2＝63杯）。設問の言い方を
     「A＝2、B＝7として、35×A＋8×Bを計算するといくつになりますか」という素直な
     計算の指示に直す（答え126・以降の小問5は変更なし）。
  3) hd5m_11_5（HG-0698）steps[1].meaning ……「①(①/2)÷18×8＝②/9… 整理すると ①×2/9。
     分母は9。」の「②/9」が式の変形として出てこない唐突な中間形（文字化けのような
     表記ゆれ）。小問1と同じ書式「①(①/2)÷18×8＝①×2/9。②分母は9。」に揃える。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う（自前で入れ子を歩かない）
  * 文字列置換は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    → [[feedback_anchor_uniqueness]]（アンカーが一意でなく72万字を壊した）
  * 何度流しても同じ結果（すでに直っていればスキップ＝冪等）
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
    → [[feedback_heikou_session_jouyaki]]（並行セッションの変更を消さないため滞留を最短に）
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化けて全行差分になる）
  * 図SVGを直す修正は、入れる前に座標を検算し、合わなければ1件も書かずに止める
    → 今回はSVGを触る修正が無いため、この経路は使っていない
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


# ================================================================ 置きかえ表（文字列置換）
# (did, path, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
REPLACE_EDITS = [
    (
        "hd5m_12_4",
        "steps/3/question",
        u"容器の 容積は A の 何はい分 ですか。A＝2、B＝7 として 計算しなさい。",
        u"A＝2、B＝7 として、35×A＋8×B を 計算すると いくつ に なりますか。",
    ),
    (
        "hd5m_11_5",
        "steps/1/meaning",
        u"①(①/2)÷18×8＝②/9… 整理すると ①×2/9。分母は9。",
        u"①(①/2)÷18×8＝①×2/9。②分母は9。",
    ),
]

# ================================================================ 削除する小問（数学的に誤り）
# (did, 想定index, 削除する設問文, 想定answer)
DELETE_EDITS = [
    (
        "hd5m_13_5",
        2,
        u"A＋B を a とすると A:B＝4:3 なので A＝(4/7)a です。C＋D を c とすると "
        u"C＝(3/5)c です。a:c＝4:3 から 21a＝何c ですか。",
        u"20",
    ),
]


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


def apply_replace(x, did, path, old, new, log):
    holder, key = _get_holder(x, path)
    cur = holder.get(key, "")
    assert isinstance(cur, str), "文字列でない項目は触らない: " + path

    if new in cur and (old not in cur or old in new):
        return 0  # すでに直っている
    if old not in cur:
        assert new in cur, "%s %s: もとの文字列も置きかえ後の文字列も見つからない -> %r" % (did, path, old[:40])
        return 0  # すでに直っている
    n = cur.count(old)
    assert n == 1, "%s %s: アンカーが %d 回出る（1回でないので置きかえない）-> %r" % (did, path, n, old[:40])
    holder[key] = cur.replace(old, new)
    return 1


def apply_delete(x, did, idx_hint, bad_q, bad_a, log):
    steps = x.get("steps") or []
    if idx_hint < len(steps) and steps[idx_hint].get("question") == bad_q:
        assert steps[idx_hint].get("answer") == bad_a, "%s: 答えが想定と違う（削除しない）" % did
        del steps[idx_hint]
        return 1
    # 冪等チェック：どこにも bad_q が残っていなければ既に削除済みとみなす
    for s in steps:
        if s.get("question") == bad_q:
            raise AssertionError("%s: bad_q が想定した index %d 以外の場所にある" % (did, idx_hint))
    return 0


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT_JSON
    path = os.path.abspath(path)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + path)

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
    touched = set()

    for did, path_, old, new in REPLACE_EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        c = apply_replace(hits[0], did, path_, old, new, log)
        total_changed += c
        if c:
            touched.add(did)
            log("  直した %s（%s / %s）" % (did, hits[0].get("src", "?"), path_))
        else:
            log("  そのまま %s（%s）: 変更なし（すでに直っている）" % (did, path_))

    for did, idx_hint, bad_q, bad_a in DELETE_EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        before = len(hits[0].get("steps") or [])
        c = apply_delete(hits[0], did, idx_hint, bad_q, bad_a, log)
        total_changed += c
        after = len(hits[0].get("steps") or [])
        if c:
            touched.add(did)
            log("  削除した %s（%s）: steps[%d] を削除（%d問 -> %d問）" % (did, hits[0].get("src", "?"), idx_hint, before, after))
        else:
            log("  そのまま %s: 変更なし（すでに削除済み、%d問）" % (did, after))

    if total_changed == 0:
        log("変更なし。ファイルは書きかえない。")
        return 0

    text = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if newline != "\n":
        text = text.replace("\n", newline)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))

    log("---- 書きこみ完了: 大問 %d本 / %d か所" % (len(touched), total_changed))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
