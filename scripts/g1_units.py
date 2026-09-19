# -*- coding: utf-8 -*-
u"""印刷された答えから「単位のついた値」を取り出す規則。

🚨**長さで判定しない。**以前は「4字までなら単位」という規則だった。
   これは**正しさの根拠にならない**（4字の別物を単位と読み、5字の本物の単位を落とす）。
   ここでは **扱える表記を全部書き出し、表に無い表記が出たら止める**。

取り出せるのは次の2つだけ。どちらも印刷された文字から取るもので、作り出した値は無い。
  ① 単独の単位        … `9時40分` → {時: 9, 分: 40}
  ② 速さ（接頭語つき） … `時速3km` → {時速km: 3}
     ★`km` だけを鍵にすると **「3」が速さであることが消える**。だから鍵は接頭語ごと持つ。
       さらに `meaning_tokens()` が「問いかけに残っていなければならない表記」を返し、
       `g1_join.take_answer` がそれを確かめる。

**曖昧なら止める**（同じ鍵が2回出る／表に無い表記が数のうしろに付いている）。
止まったときは `why` に理由が入り、呼び出した側が**未完成**にする。
"""
import re

# ── 扱える単位の表記（これが全部。増やすときはここに書き足す） ──────────
#   ★「だいたい合っていそう」で足さない。実物の答えに印刷されていた表記だけを足す。
TIME = [u"時間", u"分間", u"秒間", u"時", u"分", u"秒",
        u"日間", u"日目", u"日", u"週間", u"週",
        u"か月", u"ヶ月", u"カ月", u"ケ月", u"年間", u"年", u"月"]
LENGTH = [u"km", u"ｋｍ", u"m", u"ｍ", u"cm", u"ｃｍ", u"mm", u"㎜", u"㎝", u"㎞"]
# ★肩付き（`cm²`）が本番の表記（2026-09-14：本番データに約1,300件）。表に無いと
#   `24.5cm²` が長さの `cm` として読まれていた（`²` を数字とみなして語が切れたため）。
AREA = [u"㎢", u"㎡", u"㎠", u"㎟", u"km2", u"m2", u"cm2", u"mm2",
        u"km²", u"m²", u"cm²", u"mm²",
        u"平方km", u"平方m", u"平方cm"]
VOLUME = [u"㎥", u"㎤", u"cm³", u"m³", u"立方cm", u"立方m", u"L", u"dL", u"mL", u"ℓ", u"cc", u"リットル"]
WEIGHT = [u"kg", u"mg", u"g", u"t", u"トン", u"㎏", u"g重"]
COUNT = [u"人目", u"番目", u"個目", u"回目", u"人", u"個", u"本", u"枚", u"冊", u"台",
         u"匹", u"羽", u"組", u"通り", u"番", u"回", u"点", u"円", u"才", u"歳",
         u"段", u"列", u"行", u"ページ", u"問", u"票", u"票分", u"皿", u"箱", u"面",
         # ★歯車の「12回転」（2026-09-18・第2分冊 No.18 `4-1` `4-2`）
         u"回転",
         # ★はがき・封筒の「41通」／箱の「250個入り」（2026-09-19・演習教材 第2分冊 No.11 C10・B10）
         u"通", u"個入り",
         # ★コップの「15はい」（ひらがな・2026-09-19・演習教材 第2分冊 No.12 C5）
         u"はい",
         # ★勝ち負けの「14勝」（2026-09-19・演習教材 第2分冊 No.15 B6）
         u"勝",
         # ★テープの「6等分」（2026-09-19・演習教材 第1分冊 No.3 C8）
         u"等分",
         # ★「小数第3位まで」の「位」（2026-09-19・演習教材 第1分冊 No.4 C8）
         u"位",
         # ★「第1班」の「班」（2026-09-19・演習教材 第1分冊 No.6 B10）
         u"班"]
# ★歩合の「厘」（`1割2分5厘`）。無いと歩合の答えが「表に無い表記」で止まる（2026-09-18・No.15）。
#   `分` は時間の表にもあるが、索引の鍵が同じ字になるだけで取り出す値は変わらない
RATIO = [u"倍", u"割", u"%", u"％", u"度", u"°", u"分の1", u"厘"]

SINGLE_UNITS = TIME + LENGTH + AREA + VOLUME + WEIGHT + COUNT + RATIO

# 単位のうしろに付く添え字。**これ自体は単位ではない**。
#   「9分後」の単位は「分」で、「後」は“いつからの経過か”を表す。
#   どちらも落とさずに持つため、鍵は「分後」とし、meaning_tokens が「分」と「後」に分けて返す。
#   ★実物に出てきた表記だけを足す（2026-09-13：分後・時間後）。先回りして広げない。
# ★「前」＝年令算の「今から何年前」（2026-09-18・第2分冊 No.17 `4-2`。問題ページの印刷を親が確認）
SUFFIX = [u"後", u"前"]

# 単位のうしろに**くっついて印刷される、単位ではない語**。
#   `12月1日木曜日` の「木曜日」、`1番から6番` の「から」のように、
#   区切りの空白が無いまま次の語が続くことがある。ここに挙げた語だけを単位と切り離して読む。
#   ★これも実物に出た表記だけを足す（2026-09-13：曜日名・から）。先回りして広げない。
FOLLOW_WORDS = [u"日曜日", u"月曜日", u"火曜日", u"水曜日", u"木曜日", u"金曜日", u"土曜日",
                u"から",
                # ★単位のうしろに続く範囲の言い方（`5cm以上` の「以上」）。単位はそこまで
                u"以上", u"以下", u"未満", u"より大", u"より小",
                # ★「120枚ずつ」の「ずつ」（2026-09-19・演習教材 第2分冊 No.13 B11）
                u"ずつ",
                # ★「5割増し」の「増し」（2026-09-19・演習教材 第2分冊 No.20 C2）
                u"増し",
                # ★「小数第3位まで」の「まで」（2026-09-19・演習教材 第1分冊 No.4 C8）
                u"まで"]

# 数のうしろに付くが、**単位ではない語**。ここで終わる数は「単位の付いていない裸の数」と同じ扱いにする。
#   `243あまり12`（わり算のあまり）＝単位はどこにも無い。表に無い表記として止めると、
#   計算の回がまるごと通らなくなる（2026-09-18・第1分冊 No.1 で実際に止まった）。
#   ★実物に出た表記だけを足す。
#   `25000以上34999以下`（およその数の範囲）＝範囲の言い方であって単位ではない
#   （2026-09-18・第1分冊 No.5 で止まった）。
NOT_UNIT_WORDS = [u"あまり", u"余り",
                  u"以上", u"以下", u"未満", u"より大", u"より小", u"まで",
                  # ★「偶数の和が74大きい」（2026-09-19・演習教材 第1分冊 No.6 B1・B2）
                  u"大きい",
                  # ★答えの見出し「(850に最も近い)」（2026-09-19・演習教材 第1分冊 No.9 B3）
                  u"に最も近い"]

# ── 数につかない「語の答え」────────────────────────────────
# `12月1日木曜日` の「木曜日」のように、**答えの一部が数でない**ことがある。
#   鍵を「曜日」、値を印刷された語（`木曜日`）として索引に入れると、
#   `take_unit:"曜日"` で**その部分だけ**を取り出せる（選択肢で答えさせる形にできる）。
#   ★これも実物に出た表記だけ。先回りして広げない（2026-09-13：曜日）。
WORD_UNITS = {u"曜日": [u"日曜日", u"月曜日", u"火曜日", u"水曜日",
                        u"木曜日", u"金曜日", u"土曜日"]}

# 速さの接頭語。うしろに長さの単位が付いたときだけ「速さ」として扱う
SPEED_PREFIX = [u"時速", u"分速", u"秒速", u"毎時", u"毎分", u"毎秒"]
SPEED_UNITS = LENGTH


def _alt(words):
    return u"|".join(re.escape(w) for w in sorted(set(words), key=len, reverse=True))


# 数の書き方（**原文の表記をそのまま受ける**。書きかえない）
#   帯分数「3と3/5」… 既存の原簿・アプリの慣例。1つの数として読まないと
#   「3」と「3/5」に割れて単位との対応が壊れる（2026-09-13の試行で実際に出た）
NUM = u"(?:\\d+と\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?)"
SPEED_RE = re.compile(u"(%s)\\s*(%s)\\s*(%s)" % (_alt(SPEED_PREFIX), NUM, _alt(SPEED_UNITS)))
NUM_RE = re.compile(NUM)
UNIT_HEAD_RE = re.compile(u"^(%s)" % _alt(SINGLE_UNITS))

# 数のうしろに続く「語」とみなす字（ここで切れたら単位は付いていない）
# ★長音符「ー」は入れない。入れると `414ページ` が `ペ` で切れ、
#   表にある「ページ」が「表に無い表記」になる（2026-09-18・No.14で実際に止まった）。
#   区切りに使われるダッシュ類（`-` `－` `〜`）は下にそろえてある。
_STOP = u" 　\t\n、，。．,.…‥/／:：;；「」『』（）()[]｛｝{}〜~の·・＝=＋+－-×÷"


def _trailing(text, pos):
    u"""text の pos からの「語」を返す（区切り字か数字が出るまで）。"""
    out = []
    for ch in text[pos:]:
        # ★isdigit() は `²` `³` も数字とみなす → `cm²` が `cm` で切れる。isdecimal() を使う
        if ch.isdecimal() or ch in _STOP:
            break
        out.append(ch)
    return u"".join(out)


UNSUPPORTED_PREFIX = u"単位の表記が表に無い"


def unsupported(why):
    u"""止まった理由が「表に無い表記」か。

    ★「同じ単位が2回出る」は**正常な答え**でも起きる（`上り 時速12km 下り 時速18km`）。
      そういう答えは印刷ラベル（案A）で分ければよいので、単位索引が空でも欠陥ではない。
      **表に無い表記のときだけ**、G1の書き方をそろえるまで止める。
    """
    return bool(why) and why.startswith(UNSUPPORTED_PREFIX)


def unit_index(text):
    u"""(index, why)。`9時40分` → ({時:9, 分:40}, None)。

    - 表に無い表記が数のうしろに付いていたら ({}, 理由)。**黙って捨てない。**
    - 同じ鍵が2回以上出たら ({}, 理由)。一意に決まらないものは取り出さない。
    - 単位の付いていない裸の数（`15`）は索引に入れない。それは「取り出す必要が無い」だけで、
      止める理由にはならない。
    """
    text = text or u""
    pairs = []
    spans = []
    for m in SPEED_RE.finditer(text):
        pairs.append((m.group(1) + m.group(3), m.group(2)))
        spans.append((m.start(), m.end()))

    def in_speed(i):
        return any(s <= i < e for s, e in spans)

    for m in NUM_RE.finditer(text):
        if in_speed(m.start()):
            continue
        word = _trailing(text, m.end())
        if not word:
            continue                     # 単位の付いていない裸の数
        if word in NOT_UNIT_WORDS:
            continue                     # 「あまり」など＝単位ではない（裸の数と同じ）
        hit = UNIT_HEAD_RE.match(word)
        rest = word[len(hit.group(1)):] if hit else None
        if rest in FOLLOW_WORDS:
            rest = u""                       # 単位はここまで。うしろは別の語
        if not hit or (rest and rest not in SUFFIX):
            return {}, (UNSUPPORTED_PREFIX + u"（数「%s」のうしろが %r）。"
                        u"scripts/g1_units.py の表に足すか、G1で書き方をそろえる"
                        % (m.group(0), word))
        # ★鍵は**単位そのもの**（＋添え字）。うしろに続いた別の語は鍵に混ぜない。
        #   混ぜると `1番から6番` が「番から」と「番」の別々の鍵になり、
        #   一意に決まらないはずのものが決まったことになってしまう。
        pairs.append((hit.group(1) + (rest or u""), m.group(0)))

    # 数につかない語の答え（曜日など）。同じ鍵が2回出たら下で弾かれる
    for key, words in WORD_UNITS.items():
        for w in sorted(words, key=len, reverse=True):
            for i in range(len(text)):
                if text.startswith(w, i):
                    pairs.append((key, w))
                    break

    keys = [k for k, _ in pairs]
    if len(set(keys)) != len(keys):
        return {}, u"同じ単位が2回以上あって一意に決まらない（%s）" % u"・".join(keys)
    return {k: v for k, v in pairs}, None


def meaning_tokens(unit_key):
    u"""その単位で値を取り出したとき、**問いかけに残っていなければならない表記**。

    `時速km` なら「時速」と「km」の両方。どちらかが問いかけから消えると、
    取り出した「12」が**速さだと分からなくなる**。
    """
    for p in SPEED_PREFIX:
        if unit_key.startswith(p):
            return [p, unit_key[len(p):]]
    for sfx in SUFFIX:
        if unit_key.endswith(sfx) and unit_key[:-len(sfx)] in SINGLE_UNITS:
            # 「分」だけ残って「後」が消えると、**いつからの経過か**が画面から消える
            return [unit_key[:-len(sfx)], sfx]
    return [unit_key]


def is_speed(unit_key):
    return any(unit_key.startswith(p) for p in SPEED_PREFIX)


# ── 数の「機械解釈」──────────────────────────────────────────
# 🚨 **原文は書きかえない。**原文（`3と3/5`）はそのまま保存し、
#    計算に数値が要るときだけ、ここで**正確な分数**に直して使う（小数に丸めない）。
MIXED_RE = re.compile(u"^(\\d+)と(\\d+)/(\\d+)$")
FRAC_RE = re.compile(u"^(\\d+)/(\\d+)$")


def to_fraction(numtext):
    u"""原文の数値表記 → `fractions.Fraction`。読めなければ None。

    `3と3/5` → 18/5 ／ `3/5` → 3/5 ／ `1.5` → 3/2 ／ `12` → 12。
    **戻り値は解釈であって、原簿に書き戻すものではない。**
    """
    from fractions import Fraction
    t = (numtext or u"").strip()
    m = MIXED_RE.match(t)
    if m:
        a, b, c = (int(x) for x in m.groups())
        if c == 0:
            return None
        return Fraction(a) + Fraction(b, c)
    m = FRAC_RE.match(t)
    if m:
        b, c = (int(x) for x in m.groups())
        return None if c == 0 else Fraction(b, c)
    try:
        return Fraction(t)
    except Exception:
        return None


# ── 最小限の検査（意味を取りちがえていないかだけ見る）──────────────
#    `python scripts/g1_units.py --test`
#    ★今回の試行で実際に出た表記と、既存の整数・分数・時刻だけを見る。
#      出ていない表記へ先回りして広げない。
TESTS = [
    # (答えの原文, 期待する索引, 期待する「問いかけに残すべき表記」)
    (u"113日間", {u"日間": u"113"}, {u"日間": [u"日間"]}),          # 既存：整数＋単位
    (u"9時40分", {u"時": u"9", u"分": u"40"}, {u"時": [u"時"]}),     # 既存：時刻（2つに分かれる）
    (u"90度", {u"度": u"90"}, {u"度": [u"度"]}),
    (u"時速3km", {u"時速km": u"3"}, {u"時速km": [u"時速", u"km"]}),   # 既存：速さ
    (u"9分後", {u"分後": u"9"}, {u"分後": [u"分", u"後"]}),           # 今回：経過時間
    (u"12分後", {u"分後": u"12"}, {u"分後": [u"分", u"後"]}),
    (u"2時間後", {u"時間後": u"2"}, {u"時間後": [u"時間", u"後"]}),
    (u"3と3/5時間後", {u"時間後": u"3と3/5"}, {u"時間後": [u"時間", u"後"]}),  # 今回：帯分数
    (u"3/5倍", {u"倍": u"3/5"}, {u"倍": [u"倍"]}),                   # 既存：分数
    (u"12月1日木曜日", {u"月": u"12", u"日": u"1", u"曜日": u"木曜日"},
     {u"日": [u"日"], u"曜日": [u"曜日"]}),                              # 今回：月・日・曜日の3つ
    (u"9月11日 金曜日", {u"月": u"9", u"日": u"11", u"曜日": u"金曜日"}, {u"月": [u"月"]}),
    (u"月曜日", {u"曜日": u"月曜日"}, {u"曜日": [u"曜日"]}),               # 今回：語だけの答え
    (u"24.5cm²", {u"cm²": u"24.5"}, {u"cm²": [u"cm²"]}),              # 2026-09-14：面積が長さに化けていた
    (u"12m²", {u"m²": u"12"}, {u"m²": [u"m²"]}),
    (u"8cm³", {u"cm³": u"8"}, {u"cm³": [u"cm³"]}),
    (u"5cm", {u"cm": u"5"}, {u"cm": [u"cm"]}),                         # 長さはそのまま
    (u"243あまり12", {}, {}),                                          # 2026-09-18：わり算のあまり＝単位なし
    (u"7あまり3", {}, {}),
    (u"25000以上34999以下", {}, {}),                                   # 2026-09-18：およその数の範囲＝単位なし
    (u"0.19より大 0.2以下", {}, {}),
    (u"5cm以上", {u"cm": u"5"}, {u"cm": [u"cm"]}),                     # 単位＋範囲の言い方
    (u"414ページ", {u"ページ": u"414"}, {}),                          # 2026-09-18：長音符で切れていた
    (u"1割2分5厘", {u"割": u"1", u"分": u"2", u"厘": u"5"}, {}),       # 2026-09-18：歩合の厘
    (u"12回転", {u"回転": u"12"}, {}),                                   # 2026-09-18：歯車
    (u"4年前", {u"年前": u"4"}, {u"年前": [u"年", u"前"]}),            # 2026-09-18：年令算
    (u"41通", {u"通": u"41"}, {}),                                       # 2026-09-19：はがき
    (u"250個入り", {u"個入り": u"250"}, {}),                             # 2026-09-19：箱の入り数
    (u"15はい", {u"はい": u"15"}, {}),                                   # 2026-09-19：コップの杯数（ひらがな）
    (u"120枚ずつ", {u"枚": u"120"}, {}),                                 # 2026-09-19：「ずつ」は単位でない
    (u"14勝", {u"勝": u"14"}, {}),                                       # 2026-09-19：勝ち数
    (u"6等分", {u"等分": u"6"}, {}),                                     # 2026-09-19：テープを等分
    (u"小数第3位まで", {u"位": u"3"}, {}),                               # 2026-09-19：わりきれる位
    (u"偶数の和が74大きい", {}, {}),                                     # 2026-09-19：「大きい」は単位でない
    (u"第1班", {u"班": u"1"}, {}),                                       # 2026-09-19：班の番号
    (u"5割増し", {u"割": u"5"}, {}),                                     # 2026-09-19：「増し」は単位でない
]
# 取り出してはいけないもの（空の索引＋理由が返ること）
TESTS_STOP = [
    (u"上り　時速12km　　下り　時速18km", u"同じ単位が2回"),   # 印刷ラベルで分ける側の仕事
    (u"3杯", UNSUPPORTED_PREFIX),                              # 表に無い表記＝止める（旧例の「5個入り」は2026-09-19に表へ足した）
    (u"1番から6番", u"同じ単位が2回"),                          # 今回：範囲は一意に決まらない
    (u"3時から5時", u"同じ単位が2回"),
    (u"月曜日から金曜日", u"同じ単位が2回"),                    # 曜日が2つ＝どちらを答えるか決まらない
]
TESTS_FRACTION = [(u"3と3/5", 18, 5), (u"3/5", 3, 5), (u"1.5", 3, 2), (u"12", 12, 1)]


def _test():
    from fractions import Fraction
    bad = 0
    for text, want, want_tokens in TESTS:
        got, why = unit_index(text)
        ok = (got == want) and why is None
        toks = {k: meaning_tokens(k) for k in got}
        ok_t = all(toks.get(k) == v for k, v in want_tokens.items())
        print(u"%s %-16s → %-28s %s" % (u"✅" if (ok and ok_t) else u"🚩", text, got,
                                        u"" if (ok and ok_t) else u"期待 %s / %s（実際 %s）"
                                        % (want, want_tokens, toks)))
        bad += 0 if (ok and ok_t) else 1
    for text, want_why in TESTS_STOP:
        got, why = unit_index(text)
        ok = (got == {}) and why and want_why in why
        print(u"%s %-16s → 止まる（%s）" % (u"✅" if ok else u"🚩", text, (why or u"止まらなかった")[:40]))
        bad += 0 if ok else 1
    for text, n, d in TESTS_FRACTION:
        got = to_fraction(text)
        ok = got == Fraction(n, d)
        print(u"%s %-16s → %s（正確な分数）" % (u"✅" if ok else u"🚩", text, got))
        bad += 0 if ok else 1
    print(u"")
    if bad:
        print(u"🚩 %d件、意味を取りちがえている" % bad)
        return 1
    print(u"✅ %d件すべて、意味を取りちがえていない" % (len(TESTS) + len(TESTS_STOP) + len(TESTS_FRACTION)))
    return 0


if __name__ == "__main__":
    import sys as _sys
    try:
        _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    _sys.exit(_test() if "--test" in _sys.argv else
              print(u"使い方: python scripts/g1_units.py --test") or 0)
