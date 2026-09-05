# -*- coding: utf-8 -*-
"""小4マスター算数（公開テスト No.12・No.4）の塾講師監査
（docs/_audit/g4m_w3/findings_2.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g4m_w3_2.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
・36本を読み、指摘は重大3件・中1件（findings_2.md）。図SVGの追加・変更は無い
  （図が絡む指摘は0件だったので、原本未確認による見送りも無い）。

直したもの（findings_2.md と対応）:

  重大1  hd_4m_k12_585_2（HG-3275・記号の和）
    小問2（長いすの過不足算＝答え150）と小問3（こう貨の組み合わせ＝答え5）が、
    HG-3275の原簿レコード（記号[ア,イ]の差だけの1問構成）には存在しない内容で、
    実際は同じ回（585回）の別レコード HG-3276（hd_4m_k12_585_1として独立実装済み）と
    HG-3277（hd_4m_k12_585_4として独立実装済み）の設問をそのまま複製したもの。
    小問1（記号の和・答え85）だけを残し、複製された小問2・3を削除。
    タイトル「記号の和・長いす・こう貨」→「記号の和」、
    intro「3つの問題に答えます。」→ ""（残る問題は1問で、設問文自体に
    記号の定義と例がすでに書きこまれているため、intro無しでも読める）。

  重大2  hd_4m_k12_597_2（HG-3424・つなげてしまったミス）
    小問2（2けたの整数Xの虫食い＝答え45）が、HG-3424の原簿レコード（連結ミスの
    1問構成）には存在しない内容で、実際は同じ回（597回）の別レコード HG-3426
    （hd_4m_k12_597_1として独立実装済み）の設問をそのまま複製したもの。
    小問1（つなげてしまったミス・答え45）だけを残し、複製された小問2を削除。
    タイトル「つなげてしまったミス／あまりの条件」→「つなげてしまったミス」、
    intro「2つの問題に答えます。」→ ""。

  重大3  hd_4m_k12_609_2（HG-3614・あめとチョコを3ふくろに分ける）小問2
    「1ふくろぶんの重さは何gですか」の解説が、□＝16（＝小問3「あめは全部で
    何こありますか」の答えそのもの）を先に見せていた。小問3を解く前に答えが
    分かってしまう。□（あめの個数）を経由せず、全体の重さの取りうる範囲
    （186g〜248g）の中で72の倍数はただ1つ（216g）と絞りこむ道すじに書きかえ、
    あめの個数（16）には一切触れないようにした。72gという答え自体は変えていない。

  中1  hd_4m_k04_577_1（HG-3161・じゃんけんで階段を上がるゲーム）小問2
    解説がw・l・d というローマ字の未知数と「連立する」という言い回しをそのまま
    使っていた（原簿の作問者向け解法メモをほぼそのまま転記したもの）。同じ回の
    HG-3160や、同じ型のhd_4m_k12_585_3（じゃんけん階段・HG-3278）はどちらも
    □・○・△を使っているのに、ここだけローマ字の文字式と「連立方程式」の言い回し
    が子ども向けの解説に漏れていた（小4は方程式・文字式を未習）。□・○・△に統一し、
    「式を見くらべる→差をとる」という、同じ回のHG-3278と同じ言い回しで書きなおした。
    答え（6）は変えていない。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# ---------------------------------------------------------------- 単純な文字置きかえ
# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
TEXT_PATCHES = [
 # ---- hd_4m_k12_609_2（HG-3614）小問2の解説が小問3の答え(16)を先出ししていた ----
 ('hd_4m_k12_609_2',
  ('steps', 1, 'meaning'),
  'あめを□こ、チョコを（31−□）ことすると、全部の重さは 6×□＋8×(31−□)＝248−2×□。\nこれを3等分した重さが24の倍数になるのは、□＝16のとき（全部216g、1ふくろ72g）。',
  '1ふくろの重さは24の倍数なので、3ふくろ合わせた全体の重さは 24×3＝72の倍数。\nあめとチョコは合わせて31こなので、全体の重さは、31こ全部あめなら 6×31＝186g、31こ全部チョコなら 8×31＝248gの間におさまる。\n186gから248gの間にある72の倍数は216gだけ（72×2＝144は186より軽く、72×4＝288は248より重い）。\nだから1ふくろは 216÷3＝72g。'),

 # ---- hd_4m_k04_577_1（HG-3161）小問2がw,l,dのローマ字文字式と「連立」表記を使っていた ----
 ('hd_4m_k04_577_1',
  ('steps', 1, 'meaning'),
  '太郎の勝ちw・負けl・あいこdとすると3w+d＝33。花子の勝ちl・負けw・あいこdとすると3l+d＝21。さらにw+l+d＝20。3本を連立するとw＝9,l＝5,d＝6であいこは6回です。',
  '太郎の勝ちを□回、花子の勝ちを○回（＝太郎の負け回数）、あいこを△回とすると、じゃんけんの回数から □＋○＋△＝20。\n太郎が上がった段から 3×□＋△＝33、花子が上がった段から 3×○＋△＝21。\n上の2つの式を見くらべると、3×□−3×○＝33−21＝12なので □－○＝4、つまり□＝○＋4。\nこれを □＋○＋△＝20 に入れると (○＋4)＋○＋△＝20 より 2×○＋△＝16。\n3×○＋△＝21 との差を考えると、○＝21－16＝5。\n□＝5＋4＝9、△＝21－3×5＝6。あいこは6回です。'),
]


def dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[p] if isinstance(p, int) else node[p]
    return node, path[-1]


# ---------------------------------------------------------------- 複製された小問の削除
# HG-3275・HG-3424 はどちらも「原簿には無いのに、同じ回の別レコード（すでに独立
# 実装済み）の設問をそのまま複製した小問」が末尾に足されていた。該当小問を削除し、
# タイトル・introから消えた問題への言及を落とす。
STEP_REMOVALS = [
    {
        "id": "hd_4m_k12_585_2",
        "keep": 1,  # 小問1（記号の和）だけ残す
        "old_title": "記号の和・長いす・こう貨",
        "new_title": "記号の和",
        "old_intro": "3つの問題に答えます。",
        "new_intro": "",
        "dup_of": ["hd_4m_k12_585_1（HG-3276・長いすの過不足算）", "hd_4m_k12_585_4（HG-3277・こう貨の組み合わせ）"],
    },
    {
        "id": "hd_4m_k12_597_2",
        "keep": 1,  # 小問1（つなげてしまったミス）だけ残す
        "old_title": "つなげてしまったミス／あまりの条件",
        "new_title": "つなげてしまったミス",
        "old_intro": "2つの問題に答えます。",
        "new_intro": "",
        "dup_of": ["hd_4m_k12_597_1（HG-3426・あまりの条件から2けたの整数を決める）"],
    },
]


def apply_step_removal(x, spec):
    """複製小問の削除を1本ぶん適用する。冪等（既に直っていれば何もしない）。"""
    keep = spec["keep"]
    already_done = (len(x["steps"]) == keep and x.get("title") == spec["new_title"]
                     and x.get("intro", "") == spec["new_intro"])
    if already_done:
        return False

    assert x.get("title") == spec["old_title"], \
        "%s: title differs from expected (another session wrote it?): %r" % (spec["id"], x.get("title"))
    assert x.get("intro", "") == spec["old_intro"], \
        "%s: intro differs from expected (another session wrote it?)" % spec["id"]
    assert len(x["steps"]) > keep, \
        "%s: steps already has %d entries (<=keep=%d), but title/intro not yet fixed" % (
            spec["id"], len(x["steps"]), keep)

    del x["steps"][keep:]
    x["title"] = spec["new_title"]
    x["intro"] = spec["new_intro"]
    return True


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    want = set(p[0] for p in TEXT_PATCHES) | set(s["id"] for s in STEP_REMOVALS)
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in want:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = want - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))

    changed = skipped = 0

    for did, path, old, new in TEXT_PATCHES:
        x = found[did]
        node, key = dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            continue
        assert cur == old, "%s %s: old value differs (another session wrote it?)" % (did, "/".join(map(str, path)))
        node[key] = new
        changed += 1

    for spec in STEP_REMOVALS:
        x = found[spec["id"]]
        if apply_step_removal(x, spec):
            changed += 1
        else:
            skipped += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
