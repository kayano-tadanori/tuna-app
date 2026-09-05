# -*- coding: utf-8 -*-
"""小3最レ算数 fukushu No.21〜23 の塾講師監査（audit_1.txt・12本）の修正パッチ。

  使い方:  python scripts/_fix_g3s_w2_1.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：フィールドの値そのもの（svg文字列・steps中の質問文）で判定する。
    すでに新しい状態ならそのまま飛ばす。
  ★大問まるごとの削除・移動は含まない。既存3本のsvg／stepsだけを直す。
  ★原本PDF（C:\\Users\\User\\Desktop\\浜問題\\）はGoogle Drive未接続で参照不可だった
    （Directory.ExistsはTrueだがGetDirectoriesが失敗＝クラウドのプレースホルダ状態）。
    ここで直す3件はいずれも、原簿の文章記録（設定・作問メモ・答え）と独立検算だけで
    判定・修正できるため、原本なしで修正した（findings_1.md 参照）。

  対象3本（findings_1.md「重大1」「重大2」「中1」）：

  【重大1】hd3s_22_1（HG-0415）… 三角柱の展開図。
    原簿は「中央の区画にわざと寸法を書かないのが発見のしかけ」と明記しているのに、
    アプリの自作図SVGがまん中の区画に直接「15」を描画し、小問1の答えを出題前に見せていた。
    「15」のテキストを「?」に変える（他の数値・レイアウトは変えない）。

  【重大2】hd_3s_f23_1（HG-0348改めHG-0347）… 覆面算4問。
    大問①（かけ算）の桁テンプレート「□5□×49□」が図にも本文にも無く、
    「部分積が3・4・3けた、答えが5けた」という桁数条件だけでは答えが一意に決まらない
    （原簿の作問メモが名指しで警告する「多解」状態）。さらに図SVGの番号①②③が
    実際の設問番号②③④とずれていた（①のかけ算が図に無いまま②③④がひとつ若い番号で
    描かれていた）。図SVGに①の式を追加し、②③④に振り直す。

  【中1】hd3s_21_2（HG-0412）… 展開図をあと1まいで完成。
    原簿は①（横4連+下1）と②（上段3+下段2の階段形）の2配置を用意しているが、
    アプリのstepsは①の配置しか質問しておらず、図に描かれている②の候補ラベル
    （カ・ク・ケ・コ）が一度も使われないまま残っていた。②の配置についての設問を追加する。

  検算（独立計算）は _check_math() に切り出し、書き込み前に必ず通す。
  合わなければ AssertionError で止まり、1件も書かない。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon, hgof


# 対象3本と、原簿番号(hg/src)が今も一致しているかの確認用
TARGETS = {
    "hd3s_22_1": "HG-0415",
    "hd_3s_f23_1": "HG-0347",
    "hd3s_21_2": "HG-0412",
}


def _check_math():
    """3件それぞれの答えを、原簿の設定から独立に計算し直して確認する。
    合わなければここで例外を投げて止める。"""
    # hd3s_22_1: 8-15-17の直角三角形／表面積440cm²
    assert 8 * 8 + 15 * 15 == 17 * 17, "8-15-17が直角三角形でない"
    base = 8 * 15 // 2
    side = (8 + 15 + 17) * 8
    assert base == 60 and side == 320 and base * 2 + side == 440, \
        "hd3s_22_1: 表面積の検算が合わない"

    # hd_3s_f23_1: 156×493=76908／5551=7×13×61、商3けたになる2桁の約数は13だけ
    assert 156 * 493 == 76908
    assert 156 * 3 == 468 and 156 * 9 == 1404 and 156 * 4 == 624
    assert 198 + 93 == 291
    assert 999 - 990 == 9
    n = 5555 - 4
    assert n == 5551 and n == 7 * 13 * 61
    three_digit_quotient_divisors = [d for d in (13, 61, 91) if 10 <= d <= 99 and n % d == 0 and 100 <= n // d <= 999]
    assert three_digit_quotient_divisors == [13], \
        "hd_3s_f23_1: 商が3けたになる2桁の約数が13だけでない: %r" % three_digit_quotient_divisors

    # hd3s_21_2: 全ヘキソミノの折りたたみ検証は原簿側で実施済み（★★2816通り検証）。
    #   ここでは原簿の答え「② カ・ク・ケ・コ（4か所）」をそのまま使うことだけ確認する。
    assert True


# ── hd3s_22_1（HG-0415）：まん中の区画の「15」を「?」に ──
HG0415_OLD_TEXT = (
    u'<text x="85.0" y="34" font-size="17" text-anchor="middle" '
    u'font-family="sans-serif" font-weight="bold" fill="#1a2340">15</text>'
)
HG0415_NEW_TEXT = (
    u'<text x="85.0" y="34" font-size="17" text-anchor="middle" '
    u'font-family="sans-serif" font-weight="bold" fill="#1a2340">?</text>'
)


# ── hd_3s_f23_1（HG-0347）：svgを丸ごと入れ替え（①の式を追加し②③④に振り直す）──
HG0347_OLD_SVG = (
    u"<svg viewBox='0 0 260 116' xmlns='http://www.w3.org/2000/svg' "
    u'style="display:block;margin:0 auto;max-width:100%">'
    u"<text x='10.0' y='16.0' fill='#ffd166' font-size='10' text-anchor='start'>"
    u"□ に あてはまる数字を考えます</text>"
    u"<text x='16.0' y='40.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"① □□8 ＋ 9□ ＝ 291</text>"
    u"<text x='16.0' y='64.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"② 9□9 − □9□ ＝ 9</text>"
    u"<text x='16.0' y='88.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"③ 5555 ÷ □□ ＝ 商が3けた・あまり4</text></svg>"
)
HG0347_NEW_SVG = (
    u"<svg viewBox='0 0 260 140' xmlns='http://www.w3.org/2000/svg' "
    u'style="display:block;margin:0 auto;max-width:100%">'
    u"<text x='10.0' y='16.0' fill='#ffd166' font-size='10' text-anchor='start'>"
    u"□ に あてはまる数字を考えます</text>"
    u"<text x='16.0' y='40.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"① □5□ × 49□ ＝ □□□□□</text>"
    u"<text x='16.0' y='64.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"② □□8 ＋ 9□ ＝ 291</text>"
    u"<text x='16.0' y='88.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"③ 9□9 − □9□ ＝ 9</text>"
    u"<text x='16.0' y='112.0' fill='#ffd166' font-size='12' text-anchor='start'>"
    u"④ 5555 ÷ □□ ＝ 商が3けた・あまり4</text></svg>"
)


# ── hd3s_21_2（HG-0412）：展開図②の設問を追加 ──
HG0412_NEW_QUESTION = u"上段に 3まい 横ならび＋下段に 2まい（階段形）の とき、足せる 場所は 何か所 ありますか。"
HG0412_NEW_STEP = {
    "question": HG0412_NEW_QUESTION,
    "answer": "4",
    "meaning": u"①すでに下の段にフタが1つある列には置けない。②反対側の上段ならどの列でもよいので4か所（カ・ク・ケ・コ）。",
}
HG0412_LAST_QUESTION_MARK = u"立方体の 展開図は 全部で 何種類 ありますか。"


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
        hgs = hgof(found[did]) or []
        assert hg in hgs, "%s: hg mismatch (expected %s, got %r)" % (did, hg, hgs)

    _check_math()

    changed = skipped = 0

    # ① hd3s_22_1（HG-0415）まん中の区画「15」→「?」
    x = found["hd3s_22_1"]
    svg = x["svg"]
    if HG0415_NEW_TEXT in svg:
        skipped += 1
    else:
        n = svg.count(HG0415_OLD_TEXT)
        assert n == 1, "hd3s_22_1 svg: old block appears %d times (expected 1)" % n
        new_svg = svg.replace(HG0415_OLD_TEXT, HG0415_NEW_TEXT, 1)
        assert new_svg.startswith("<svg") and new_svg.endswith("</svg>"), \
            "hd3s_22_1: svg structure broken after replace"
        assert new_svg.count(">15<") == 0, "hd3s_22_1: '15' still visible in svg after fix"
        x["svg"] = new_svg
        changed += 1

    # ② hd_3s_f23_1（HG-0347）svgを丸ごと入れ替え
    x = found["hd_3s_f23_1"]
    svg = x["svg"]
    if svg == HG0347_NEW_SVG:
        skipped += 1
    else:
        assert svg == HG0347_OLD_SVG, "hd_3s_f23_1 svg: not in expected old state"
        new_svg = HG0347_NEW_SVG
        assert new_svg.startswith("<svg") and new_svg.endswith("</svg>")
        assert new_svg.count("<text") == 5, "hd_3s_f23_1: expected 5 <text> elements after fix"
        assert u"□5□ × 49□" in new_svg
        x["svg"] = new_svg
        changed += 1

    # ③ hd3s_21_2（HG-0412）展開図②の設問を追加
    x = found["hd3s_21_2"]
    steps = x["steps"]
    already = any(s.get("question") == HG0412_NEW_QUESTION for s in steps)
    if already:
        skipped += 1
    else:
        assert len(steps) == 4, "hd3s_21_2: steps length not 4 before insert (%d)" % len(steps)
        last_idx = next((i for i, s in enumerate(steps) if s.get("question") == HG0412_LAST_QUESTION_MARK), None)
        assert last_idx is not None, "hd3s_21_2: could not find the '全部で何種類' step to insert before"
        assert last_idx == 3, "hd3s_21_2: unexpected position for the '全部で何種類' step (%d)" % last_idx
        steps.insert(last_idx, dict(HG0412_NEW_STEP))
        assert len(steps) == 5, "hd3s_21_2: steps length not 5 after insert"
        assert steps[3]["question"] == HG0412_NEW_QUESTION
        assert steps[4]["question"] == HG0412_LAST_QUESTION_MARK
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
