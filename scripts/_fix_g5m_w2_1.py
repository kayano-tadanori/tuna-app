# -*- coding: utf-8 -*-
"""docs/_audit/g5m_w2/findings_1.md の指摘（小5マスター算数 fukushu No.17〜20・kokai No.2、34本監査）
を直す修正パッチ。

対象7件:
  hd5m_17_2 (HG-0728) ... 比が巡回するやりとり。
    重大A: 大問の図SVGが、まだ何も解いていない段階から「ア 20」「イ 15」「ウ 12」と
      最終答え（ア:イ:ウ＝20:15:12）を丸ごと文字で表示していた。図を、数値を出さない
      ラベルだけ（ア／イ／ウ）・同じ幅の箱に差し替える。
    重大B: steps[3]（4問目）の設問文と解説が「A＝20、B＝15とすると」と、5問目で
      問われる ア（＝20）をそのまま先渡ししていた。steps[3]・steps[4]の2問を、
      A＝4・B＝3の比のまま計算し、分母5を消すのに必要な倍率(5)を先に問う3問に
      組み替え、20という数字は最後の設問（元のsteps[4]、答えを問う設問）まで
      出さないようにする。steps が5個→6個に増える（1問増分。ACH_BASE_TOTAL は
      「動かさない」と明記された固定基準値なので触らない＝作問マニュアルの対象外）。

  hd5m_17_3 (HG-0729) ... 3手のやりとりをうしろから戻す。
    重大: 図SVGが「2900←3600←3800←3000」と、まだ1問も解いていない段階で
      steps[1]〜steps[3]の答え（3600・3800・3000）を丸ごと見せていた。原簿(HG-0729)は
      そもそも「図: なし」。数値ラベルを「?」に置き換え、既知の2900だけ残す。

  hd5m_18_3 (HG-0733) ... 歯車は逆比の連鎖。
    重大: 図SVGのキャプションが「（歯数の比A:B:C＝3:4:7）」と、steps[1]・steps[2]で
      問われる比の値をそのまま文字で見せていた。キャプションからその一文だけ削る
      （歯車3つの絵自体は原簿の図と同じものを残す）。

  hd5m_14_1 (HG-0717) ... 固体と液体で基準が入れかわる。
    重大: 図SVGが「39→41→39」と、steps[1]・steps[3]の答え（41）をまだ1問も解いて
      いない段階で見せていた。原簿(HG-0717)も「図: なし」。中央の「41」を「?」に
      置き換える。

  hd5m_20_1 (HG-2011) ... 5割の利益を見こんで3割引き。
    重大: 図SVGが「定価1.5」「売り値1.05」と、steps[0]・steps[1]の答えをまだ1問も
      解いていない段階でラベル表示し、しかも棒の幅も1:1.5:1.05に比例させていた
      （数字を隠しても幅の比で見抜ける）。定価・売り値の棒を仕入れ値と同じ幅にそろえ、
      ラベルを「?」に置き換える。

  hd5m_19_3 (HG-0736) ... 小数の濃度からきれいな比を作る。
    重大: steps[2]（3問目、「15.4と9.8は何でわりきれるか」）の解説が
      「154÷14＝11、98÷14＝7」と、steps[3]（4問目、「18%側:43.2%側の比」の答え11:7）
      を先に計算して見せていた。解説を「どちらも14でわりきれる」という事実だけに
      とどめ、商（11・7）を書かないようにする。

  hd5m_18_4 (HG-0734) ... 階段の料金は比例ではない。
    軽微: steps[4]の解説が「8700mをこえてから9000mまで」と書いており、原簿の
      正しい境界「8700m以上9000m未満」（8700mちょうどを含む）と不等号の向きが
      食いちがっていた。「8700m以上9000m未満」に直す。

見送り（本パッチに含めない）:
  ・findings_1.md 中、原本(PDF)でしか確定できない指摘は無かった（Driveが未接続のため
    独立検算・SVG座標実測・原簿相互参照で全件を確認できた）。
  ・入力形式（answerable format）を変える修正は無し。

使い方:
  python scripts/_fix_g5m_w2_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

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


# ============================================================================
# hd5m_17_2 (HG-0728)
# ============================================================================
ID_17_2 = "hd5m_17_2"

OLD_SVG_17_2 = (
    u'<svg viewBox="0 0 300 108" xmlns="http://www.w3.org/2000/svg" '
    u'style="display:block;margin:0 auto;max-width:100%">'
    u'<rect x="16" y="10" width="110.6" height="18" fill="#4f7cff" fill-opacity="0.28" '
    u'stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="22" y="24" font-size="12" font-family="sans-serif" fill="#e8ecf5">ア 20</text>'
    u'<rect x="16" y="36" width="83.0" height="18" fill="#ff6b6b" fill-opacity="0.28" '
    u'stroke="#ff6b6b" stroke-width="1.5"/>'
    u'<text x="22" y="50" font-size="12" font-family="sans-serif" fill="#e8ecf5">イ 15</text>'
    u'<rect x="16" y="62" width="66.4" height="18" fill="#22c55e" fill-opacity="0.28" '
    u'stroke="#22c55e" stroke-width="1.5"/>'
    u'<text x="22" y="76" font-size="12" font-family="sans-serif" fill="#e8ecf5">ウ 12</text>'
    u'<text x="150" y="102" font-size="11" text-anchor="middle" font-family="sans-serif" '
    u'fill="#6c7086">合計が変わらない</text></svg>'
)
NEW_SVG_17_2 = (
    u'<svg viewBox="0 0 300 108" xmlns="http://www.w3.org/2000/svg" '
    u'style="display:block;margin:0 auto;max-width:100%">'
    u'<rect x="16" y="10" width="90" height="18" fill="#4f7cff" fill-opacity="0.28" '
    u'stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="22" y="24" font-size="12" font-family="sans-serif" fill="#e8ecf5">ア</text>'
    u'<rect x="16" y="36" width="90" height="18" fill="#ff6b6b" fill-opacity="0.28" '
    u'stroke="#ff6b6b" stroke-width="1.5"/>'
    u'<text x="22" y="50" font-size="12" font-family="sans-serif" fill="#e8ecf5">イ</text>'
    u'<rect x="16" y="62" width="90" height="18" fill="#22c55e" fill-opacity="0.28" '
    u'stroke="#22c55e" stroke-width="1.5"/>'
    u'<text x="22" y="76" font-size="12" font-family="sans-serif" fill="#e8ecf5">ウ</text>'
    u'<text x="150" y="102" font-size="11" text-anchor="middle" font-family="sans-serif" '
    u'fill="#6c7086">合計が変わらない</text></svg>'
)

OLD_STEP3_17_2 = {
    "question": u"B が 受け取ったあと（B＋A/4）の 3/5 を C に 渡し、それが C に なります。"
                 u"A＝20、B＝15 と すると C は いくつ ですか。",
    "answer": u"12",
    "meaning": u"①B＋A/4＝15＋5＝20。②20×3/5＝12＝C。",
}
OLD_STEP4_17_2 = {
    "question": u"ア:イ:ウ の ア は いくつ ですか。",
    "answer": u"20",
    "meaning": u"①20:15:12。②検算：20,15,12 →(Aが5渡す) 15,20,12 →(Bが8渡す) 15,12,20＝イ:ウ:ア ✓。",
}

NEW_STEPS_TAIL_17_2 = [
    {
        "question": u"上で A を 4、B を 3 と すると、B＋A/4 は いくつ ですか。",
        "answer": u"4",
        "meaning": u"①3＋1＝4。",
    },
    {
        "question": u"この 4 に 3/5 を かけると 4×3/5＝2.4 と なり、整数に なりません。"
                     u"分母の 5 を 消して 整数に するには、A・B・C の 比を もとの 何倍に すれば よいですか。",
        "answer": u"5",
        "meaning": u"①4×3/5＝2.4 は 整数でない。②分母の5を 消すには、比を 5倍すれば よい。",
    },
    {
        "question": u"ア:イ:ウ の ア は いくつ ですか。",
        "answer": u"20",
        "meaning": u"①A を 4×5＝20 に する。②このとき B＝3×5＝15、C＝2.4×5＝12。③ア:イ:ウ＝20:15:12。"
                   u"④検算：20,15,12 →(Aが5渡す) 15,20,12 →(Bが8渡す) 15,12,20＝イ:ウ:ア ✓。",
    },
]


def fix_17_2(x, fixed, seen):
    if x.get("id") != ID_17_2:
        return
    seen.add(ID_17_2)
    assert x.get("hg") == "HG-0728", u"%s: hg が想定と異なります (%r)" % (ID_17_2, x.get("hg"))

    # --- 重大A: SVG ---
    svg = x.get("svg")
    if svg == NEW_SVG_17_2:
        pass  # 冪等：既に直っている
    else:
        assert svg == OLD_SVG_17_2, u"%s: svg が想定と異なります（別セッションが書いた可能性）" % ID_17_2
        x["svg"] = NEW_SVG_17_2
        fixed.append(u"%s(HG-0728): 図SVGが最終答え(20:15:12)を先出ししていたのを、"
                      u"数値なしの箱(ア/イ/ウ)に差し替え" % ID_17_2)

    # --- 重大B: steps[3]・steps[4] を3問に組み替え ---
    steps = x.get("steps") or []
    already_fixed = (
        len(steps) == 6
        and steps[3] == NEW_STEPS_TAIL_17_2[0]
        and steps[4] == NEW_STEPS_TAIL_17_2[1]
        and steps[5] == NEW_STEPS_TAIL_17_2[2]
    )
    if already_fixed:
        pass  # 冪等：既に直っている
    else:
        assert len(steps) == 5, u"%s: steps が想定(5個)と異なります(%d個)" % (ID_17_2, len(steps))
        assert steps[3] == OLD_STEP3_17_2, u"%s: steps[3] が想定と異なります（別セッションが書いた可能性）" % ID_17_2
        assert steps[4] == OLD_STEP4_17_2, u"%s: steps[4] が想定と異なります（別セッションが書いた可能性）" % ID_17_2
        x["steps"] = steps[:3] + NEW_STEPS_TAIL_17_2
        fixed.append(u"%s(HG-0728): steps[3]が「A=20、B=15とすると」と次の設問(アの答え=20)を"
                      u"先渡ししていたのを、A:B=4:3のまま倍率5を先に問う3問に組み替え" % ID_17_2)


# ============================================================================
# hd5m_17_3 (HG-0729)
# ============================================================================
ID_17_3 = "hd5m_17_3"

OLD_SVG_17_3 = (
    u'<svg viewBox="0 0 378 74" xmlns="http://www.w3.org/2000/svg" '
    u'style="display:block;margin:0 auto;max-width:100%">'
    u'<rect x="10" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="33.0" y="34" font-size="13" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">2900</text>'
    u'<rect x="62" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="85.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">←</text>'
    u'<rect x="114" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="137.0" y="34" font-size="13" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">3600</text>'
    u'<rect x="166" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="189.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">←</text>'
    u'<rect x="218" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="241.0" y="34" font-size="13" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">3800</text>'
    u'<rect x="270" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="293.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">←</text>'
    u'<rect x="322" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/>'
    u'<text x="345.0" y="34" font-size="13" text-anchor="middle" font-family="sans-serif" '
    u'font-weight="bold" fill="#1a2340">3000</text>'
    u'<text x="189" y="68" font-size="11" text-anchor="middle" font-family="sans-serif" '
    u'fill="#6c7086">うしろから戻す</text></svg>'
)
NEW_SVG_17_3 = (
    OLD_SVG_17_3
    .replace(u'font-weight="bold" fill="#1a2340">3600</text>', u'font-weight="bold" fill="#1a2340">?</text>')
    .replace(u'font-weight="bold" fill="#1a2340">3800</text>', u'font-weight="bold" fill="#1a2340">?</text>')
    .replace(u'font-weight="bold" fill="#1a2340">3000</text>', u'font-weight="bold" fill="#1a2340">?</text>')
)
assert NEW_SVG_17_3 != OLD_SVG_17_3
assert u"3600" not in NEW_SVG_17_3 and u"3800" not in NEW_SVG_17_3 and u"3000" not in NEW_SVG_17_3


def fix_17_3(x, fixed, seen):
    if x.get("id") != ID_17_3:
        return
    seen.add(ID_17_3)
    assert x.get("hg") == "HG-0729", u"%s: hg が想定と異なります (%r)" % (ID_17_3, x.get("hg"))
    svg = x.get("svg")
    if svg == NEW_SVG_17_3:
        return  # 冪等
    assert svg == OLD_SVG_17_3, u"%s: svg が想定と異なります（別セッションが書いた可能性）" % ID_17_3
    x["svg"] = NEW_SVG_17_3
    fixed.append(u"%s(HG-0729): 図SVGが うしろから戻す計算の答え(3600/3800/3000)を"
                  u"まだ1問も解いていない段階で先出ししていたのを「?」に差し替え（原簿も『図:なし』）" % ID_17_3)


# ============================================================================
# hd5m_18_3 (HG-0733)
# ============================================================================
ID_18_3 = "hd5m_18_3"
OLD_CAPTION_18_3 = u"歯車A・Bがかみあい、B・Cもかみあう（歯数の比A:B:C＝3:4:7）"
NEW_CAPTION_18_3 = u"歯車A・Bがかみあい、B・Cもかみあう"


def fix_18_3(x, fixed, seen):
    if x.get("id") != ID_18_3:
        return
    seen.add(ID_18_3)
    assert x.get("hg") == "HG-0733", u"%s: hg が想定と異なります (%r)" % (ID_18_3, x.get("hg"))
    svg = x.get("svg") or ""
    if NEW_CAPTION_18_3 in svg and OLD_CAPTION_18_3 not in svg:
        return  # 冪等
    assert svg.count(OLD_CAPTION_18_3) == 1, (
        u"%s: キャプションの置換対象がちょうど1個ではありません" % ID_18_3
    )
    x["svg"] = svg.replace(OLD_CAPTION_18_3, NEW_CAPTION_18_3)
    fixed.append(u"%s(HG-0733): 図SVGのキャプションが歯数の比(3:4:7、steps[1]・steps[2]の答え)を"
                  u"文字で先出ししていたのを削除（歯車3つの絵は残す）" % ID_18_3)


# ============================================================================
# hd5m_14_1 (HG-0717)
# ============================================================================
ID_14_1 = "hd5m_14_1"
OLD_MID_14_1 = u'font-weight="bold" fill="#1a2340">41</text>'
NEW_MID_14_1 = u'font-weight="bold" fill="#1a2340">?</text>'


def fix_14_1(x, fixed, seen):
    if x.get("id") != ID_14_1:
        return
    seen.add(ID_14_1)
    assert x.get("hg") == "HG-0717", u"%s: hg が想定と異なります (%r)" % (ID_14_1, x.get("hg"))
    svg = x.get("svg") or ""
    if OLD_MID_14_1 not in svg:
        assert NEW_MID_14_1 in svg, u"%s: svg が想定と異なります（別セッションが書いた可能性）" % ID_14_1
        return  # 冪等
    assert svg.count(OLD_MID_14_1) == 1, u"%s: 「41」の置換対象がちょうど1個ではありません" % ID_14_1
    x["svg"] = svg.replace(OLD_MID_14_1, NEW_MID_14_1)
    fixed.append(u"%s(HG-0717): 図SVGが「39→41→39」と、steps[1]・steps[3]の答え(41)を"
                  u"まだ1問も解いていない段階で先出ししていたのを「?」に差し替え（原簿も『図:なし』）" % ID_14_1)


# ============================================================================
# hd5m_20_1 (HG-2011)
# ============================================================================
ID_20_1 = "hd5m_20_1"
OLD_SVG_20_1 = (
    u"<svg viewBox='0 0 315 110' xmlns='http://www.w3.org/2000/svg' "
    u"style='display:block;margin:6px auto;max-width:100%'>"
    u"<text x='72' y='26' font-size='9' fill='#eef2ff' text-anchor='end'>仕入れ値</text>"
    u"<rect x='78' y='12' width='150.0' height='19' rx='3' fill='#4f7cff' opacity='0.55' "
    u"stroke='#eef2ff' stroke-width='1'/>"
    u"<text x='153.0' y='25.5' font-size='9' fill='#141a2e' text-anchor='middle'>1</text>"
    u"<text x='72' y='56' font-size='9' fill='#eef2ff' text-anchor='end'>定価</text>"
    u"<rect x='78' y='42' width='225.0' height='19' rx='3' fill='#ffd166' opacity='0.55' "
    u"stroke='#eef2ff' stroke-width='1'/>"
    u"<text x='190.5' y='55.5' font-size='9' fill='#141a2e' text-anchor='middle'>1.5</text>"
    u"<text x='72' y='86' font-size='9' fill='#eef2ff' text-anchor='end'>売り値</text>"
    u"<rect x='78' y='72' width='157.5' height='19' rx='3' fill='#7ee787' opacity='0.55' "
    u"stroke='#eef2ff' stroke-width='1'/>"
    u"<text x='156.8' y='85.5' font-size='9' fill='#141a2e' text-anchor='middle'>1.05</text></svg>"
)
NEW_SVG_20_1 = (
    u"<svg viewBox='0 0 315 110' xmlns='http://www.w3.org/2000/svg' "
    u"style='display:block;margin:6px auto;max-width:100%'>"
    u"<text x='72' y='26' font-size='9' fill='#eef2ff' text-anchor='end'>仕入れ値</text>"
    u"<rect x='78' y='12' width='150.0' height='19' rx='3' fill='#4f7cff' opacity='0.55' "
    u"stroke='#eef2ff' stroke-width='1'/>"
    u"<text x='153.0' y='25.5' font-size='9' fill='#141a2e' text-anchor='middle'>1</text>"
    u"<text x='72' y='56' font-size='9' fill='#eef2ff' text-anchor='end'>定価</text>"
    u"<rect x='78' y='42' width='150.0' height='19' rx='3' fill='#ffd166' opacity='0.55' "
    u"stroke='#eef2ff' stroke-width='1'/>"
    u"<text x='153.0' y='55.5' font-size='9' fill='#141a2e' text-anchor='middle'>?</text>"
    u"<text x='72' y='86' font-size='9' fill='#eef2ff' text-anchor='end'>売り値</text>"
    u"<rect x='78' y='72' width='150.0' height='19' rx='3' fill='#7ee787' opacity='0.55' "
    u"stroke='#eef2ff' stroke-width='1'/>"
    u"<text x='153.0' y='85.5' font-size='9' fill='#141a2e' text-anchor='middle'>?</text></svg>"
)


def fix_20_1(x, fixed, seen):
    if x.get("id") != ID_20_1:
        return
    seen.add(ID_20_1)
    assert x.get("hg") == "HG-2011", u"%s: hg が想定と異なります (%r)" % (ID_20_1, x.get("hg"))
    svg = x.get("svg")
    if svg == NEW_SVG_20_1:
        return  # 冪等
    assert svg == OLD_SVG_20_1, u"%s: svg が想定と異なります（別セッションが書いた可能性）" % ID_20_1
    x["svg"] = NEW_SVG_20_1
    fixed.append(u"%s(HG-2011): 図SVGが「定価1.5」「売り値1.05」(steps[0]・steps[1]の答え)を"
                  u"ラベルと棒の幅の両方で先出ししていたのを、幅をそろえ「?」ラベルに差し替え" % ID_20_1)


# ============================================================================
# hd5m_19_3 (HG-0736)
# ============================================================================
ID_19_3 = "hd5m_19_3"
OLD_M2_19_3 = u"①154÷14＝11、98÷14＝7。②14。"
NEW_M2_19_3 = u"①154 と 98 は どちらも 14 で わりきれる（あまりが 出ない）。②14。"


def fix_19_3(x, fixed, seen):
    if x.get("id") != ID_19_3:
        return
    seen.add(ID_19_3)
    assert x.get("hg") == "HG-0736", u"%s: hg が想定と異なります (%r)" % (ID_19_3, x.get("hg"))
    steps = x.get("steps") or []
    assert len(steps) == 5, u"%s: steps が想定(5個)と異なります(%d個)" % (ID_19_3, len(steps))
    s2 = steps[2]
    if s2.get("meaning") == NEW_M2_19_3:
        return  # 冪等
    assert s2.get("question") == u"15.4 と 9.8 は どちらも 何 で わりきれますか。", (
        u"%s steps[2]: question が想定と異なります" % ID_19_3
    )
    assert s2.get("answer") == u"14", u"%s steps[2]: answer が想定と異なります" % ID_19_3
    assert s2.get("meaning") == OLD_M2_19_3, (
        u"%s steps[2]: meaning が想定と異なります（別セッションが書いた可能性）" % ID_19_3
    )
    s2["meaning"] = NEW_M2_19_3
    fixed.append(u"%s(HG-0736): steps[2]の解説が「154÷14=11、98÷14=7」とsteps[3]の答え(比11:7)を"
                 u"先に計算して見せていたのを「どちらも14でわりきれる」という事実だけに縮小" % ID_19_3)


# ============================================================================
# hd5m_18_4 (HG-0734)
# ============================================================================
ID_18_4 = "hd5m_18_4"
OLD_M4_18_4 = (
    u"①(2700−700)÷80＝25段。②25段目は 1500＋300×24＝8700m を こえてから 9000m まで。"
    u"**答えが「範囲」になる**のが この問題のねらい。"
)
NEW_M4_18_4 = (
    u"①(2700−700)÷80＝25段。②25段目は 1500＋300×24＝8700m以上9000m未満。"
    u"**答えが「範囲」になる**のが この問題のねらい。"
)


def fix_18_4(x, fixed, seen):
    if x.get("id") != ID_18_4:
        return
    seen.add(ID_18_4)
    assert x.get("hg") == "HG-0734", u"%s: hg が想定と異なります (%r)" % (ID_18_4, x.get("hg"))
    steps = x.get("steps") or []
    assert len(steps) == 5, u"%s: steps が想定(5個)と異なります(%d個)" % (ID_18_4, len(steps))
    s4 = steps[4]
    if s4.get("meaning") == NEW_M4_18_4:
        return  # 冪等
    assert s4.get("answer") == u"25", u"%s steps[4]: answer が想定と異なります" % ID_18_4
    assert s4.get("meaning") == OLD_M4_18_4, (
        u"%s steps[4]: meaning が想定と異なります（別セッションが書いた可能性）" % ID_18_4
    )
    s4["meaning"] = NEW_M4_18_4
    fixed.append(u"%s(HG-0734): steps[4]の解説「8700mをこえてから9000mまで」が原簿の正しい境界"
                  u"「8700m以上9000m未満」（8700mちょうどを含む）と食いちがっていたのを修正" % ID_18_4)


FIXERS = [fix_17_2, fix_17_3, fix_18_3, fix_14_1, fix_20_1, fix_19_3, fix_18_4]
TARGET_IDS = {ID_17_2, ID_17_3, ID_18_3, ID_14_1, ID_20_1, ID_19_3, ID_18_4}


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    d = json.load(io.open(path, encoding="utf-8"))

    fixed = []
    seen = set()
    for rec in iter_daimon(d):
        x = rec["x"]
        for fn in FIXERS:
            fn(x, fixed, seen)

    missing = TARGET_IDS - seen
    assert not missing, u"対象の大問が見つかりませんでした: %s" % sorted(missing)

    print(u"修正件数: %d" % len(fixed))
    for f in fixed:
        print(u" - " + f)

    out = json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8")
    io.open(path, "wb").write(out)


if __name__ == "__main__":
    main()
