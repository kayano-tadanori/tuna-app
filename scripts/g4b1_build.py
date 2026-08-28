# -*- coding: utf-8 -*-
"""小4マスター算数 第1分冊（HG-4572〜4922）を大問レコードに組み立てる中核。
   ・設問と答えは原簿のまま（feedback_genbo_dori）。変えるのは答え方の様式だけ。
   ・穴が複数ある設問（㋐㋑… / □□□）は、穴ごとに1stepへ割る。
   ・テンキーで打てない答え（漢数字・不等号・並べかえ）は choices を作る。
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g4b1_parse import load_records, parse_record, norm   # noqa: E402

MARU = "".join(chr(0x2460 + i) for i in range(20))        # ①〜⑳
KMARU = "".join(chr(0x32D0 + i) for i in range(11))       # ㋐〜㋚
KATA = "アイウエオカキクケコ"

UNITS = ["cm²", "cm2", "m²", "m2", "km²", "とおり", "通り", "試合", "時間", "分間", "分後", "分前",
         "年後", "年前", "本目", "番目", "段目", "kg", "mg", "dL", "mL", "km", "cm", "mm",
         "さつ", "たば", "ひき", "まい", "円", "こ", "人", "才", "本", "回", "枚", "個", "度",
         "組", "倍", "位", "列", "行", "頭", "わ", "日", "秒", "分", "時", "g", "m", "L", "t",
         "ページ", "台", "段", "ふくろ", "はこ", "さら", "番", "号", "けた", "たい", "ぱい", "はい"]


def to_numpad(a):
    """答えの文字列を、テンキーで打てる形に正規化する。無理ならNone。"""
    a = a.strip().strip("。、 　")
    a = a.replace("あまり", "余り")
    a = re.sub(r"[（(][^）)]*[）)]\s*$", "", a).strip()      # 末尾の注記を落とす
    a = re.sub(r"^(?:およそ|約)\s*", "", a)
    for u in sorted(UNITS, key=len, reverse=True):
        if a.endswith(u):
            a = a[:-len(u)].strip()
            break
    a = a.replace(",", "")
    if re.match(r"^\d+(\.\d+)?$", a) or re.match(r"^\d+/\d+$", a) \
            or re.match(r"^\d+と\d+/\d+$", a):
        return a
    if re.match(r"^\d+余り\d+$", a):
        return a
    return None


# ── 漢数字 ───────────────────────────────────────────────────────────
K1 = "〇一二三四五六七八九"
K10 = ["", "十", "百", "千"]
K4 = ["", "万", "億", "兆", "京"]


def kansuji(n):
    """整数 → 漢数字（浜学園の教材と同じ書き方：一万七千六百三十五・十兆…）"""
    if n == 0:
        return "〇"
    groups = []
    while n > 0:
        groups.append(n % 10000)
        n //= 10000
    out = []
    for i in range(len(groups) - 1, -1, -1):
        g = groups[i]
        if g == 0:
            continue
        s = ""
        for k, d in enumerate(str(g)[::-1]):
            d = int(d)
            if d == 0:
                continue
            if k == 0:
                s = K1[d] + s
            elif d == 1:
                s = K10[k] + s
            else:
                s = K1[d] + K10[k] + s
        out.append(s + K4[i])
    return "".join(out)


def kansuji_of(s):
    """漢数字の文字列 → 整数（読めなければNone）"""
    if not re.fullmatch(r"[〇一二三四五六七八九十百千万億兆]+", s):
        return None
    total, cur, num = 0, 0, 0
    for ch in s:
        if ch in K1:
            num = K1.index(ch)
        elif ch in "十百千":
            k = {"十": 10, "百": 100, "千": 1000}[ch]
            cur += (num or 1) * k
            num = 0
        else:
            k = {"万": 10 ** 4, "億": 10 ** 8, "兆": 10 ** 12}[ch]
            cur += num
            total += cur * k
            cur, num = 0, 0
    return total + cur + num


def perturb(n, seed):
    """けたを1つ動かした別の数を作る（漢数字のダミー用）。もとの数とは必ずちがう。"""
    s = list(str(n))
    i = seed % len(s)
    d = int(s[i])
    s[i] = str((d + 1 + seed // len(s)) % 10)
    if s[0] == "0":
        s[0] = "1" if str(n)[0] != "1" else "2"
    m = int("".join(s))
    return m if m != n else n + 10 ** (len(s) - 1 - i)


def kan_choices(ans):
    """漢数字の答えに、まぎらわしいダミー3つを付けた4択を作る。
       ダミーは『別の整数を同じ書き方で漢数字にしたもの』なので、絶対に正解にならない。"""
    m = re.fullmatch(r"([〇一二三四五六七八九十百千万億兆]+)", ans)
    tail = ""
    if not m:                       # 「3500万」「400億」のような算用数字＋位
        m2 = re.fullmatch(r"(\d+)(万|億|兆)", ans)
        if not m2:
            return None
        base, tail = int(m2.group(1)), m2.group(2)
        cand = []
        for s in (1, 3, 5, 7, 11):
            v = perturb(base, s)
            t = "%d%s" % (v, tail)
            if t != ans and t not in cand:
                cand.append(t)
            if len(cand) == 3:
                break
        return [ans] + cand
    n = kansuji_of(ans)
    if n is None or kansuji(n) != ans:
        return None                 # 自分の変換器で書き方が再現できない＝ダミーの形がそろわない
    cand = []
    for s in (1, 3, 5, 7, 11, 13, 17):
        v = perturb(n, s)
        t = kansuji(v)
        if t != ans and t not in cand:
            cand.append(t)
        if len(cand) == 3:
            break
    return [ans] + cand if len(cand) == 3 else None


FUGO = {"＞": "＞", "＜": "＜", "＝": "＝", ">": "＞", "<": "＜", "=": "＝"}


def split_labeled(a):
    """「大きい数 9876543210 小さい数 1023456789」→[("大きい数","98…"),…]"""
    hits = re.findall(r"([^\d\s、,]+?)\s*(\d+(?:\.\d+)?(?:と\d+/\d+)?(?:/\d+)?)", a)
    if len(hits) < 2:
        return None
    joined = " ".join("%s %s" % h for h in hits)
    if re.sub(r"[\s、,]", "", joined) != re.sub(r"[\s、,]", "", a):
        return None
    return hits


def split_by_marks(a, marks, from_zero=True, allow_single=False):
    """答えの中の ㋐… ア… を {記号: 値} に割る。"""
    idxs = [(i, ch) for i, ch in enumerate(a) if ch in marks]
    if len(idxs) < (1 if allow_single else 2):
        return None
    if from_zero and marks.index(idxs[0][1]) != 0:
        return None
    out = []
    for k, (pos, ch) in enumerate(idxs):
        end = idxs[k + 1][0] if k + 1 < len(idxs) else len(a)
        out.append((ch, a[pos + 1:end].strip(" 　、,，")))
    base = marks.index(out[0][0])
    if [marks.index(c) for c, _ in out] != list(range(base, base + len(out))):
        return None
    if any(not v for _, v in out):
        return None
    return out


def order_choices(ans, qtext):
    """『ア→ウ→イ』『40.71, 40.701, 40.7, 40.699』のような並べかえの答えを4択にする。"""
    if "→" in ans:
        items = [x.strip() for x in ans.split("→")]
    else:
        items = [x.strip() for x in LIST_SEP.split(ans)]
        if len(items) < 2:
            return None
    if len(set(items)) != len(items) or len(items) < 2:
        return None
    sep = "→" if "→" in ans else "、"
    base = sep.join(items)
    cand = [base]
    n = len(items)
    swaps = [(0, 1), (n - 2, n - 1), (1, 2), (0, n - 1), (0, 2)]
    for i, j in swaps:
        if j >= n or i >= n:
            continue
        t = items[:]
        t[i], t[j] = t[j], t[i]
        s = sep.join(t)
        if s not in cand:
            cand.append(s)
        if len(cand) == 4:
            break
    want = 2 if n == 2 else 4
    return cand if len(cand) == want else None


def count_blanks(q):
    return len(re.findall(r"[□❑]", q))



SOKUDO = re.compile(r"^(時速|分速|秒速)")
LIST_SEP = re.compile(r"[、,，]")


def to_numpad2(a):
    """to_numpad に、この分冊で実際に出てくる書き方（速さの言い方・小数のあまり・
       「〜以下」「およそ」など）を足したもの。"""
    if a is None:
        return None
    a = a.strip().strip("。、 　")
    a = a.replace("あまり", "余り")
    a = SOKUDO.sub("", a).strip()
    a = re.sub(r"(以上|以下|未満)$", "", a).strip()
    v = to_numpad(a)
    if v is not None:
        return v
    a2 = a
    for u in sorted(UNITS, key=len, reverse=True):
        if a2.endswith(u):
            a2 = a2[:-len(u)].strip()
            break
    if re.match(r"^\d+(\.\d+)?余り\d+(\.\d+)?$", a2):
        return a2
    return None


PAIR_PATTERNS = [
    (re.compile(r"^(\d+)時間(\d+)分$"), ("時間", "分")),
    (re.compile(r"^(\d+)分(\d+)秒$"), ("分", "秒")),
    (re.compile(r"^(\d+)m(\d+)cm$"), ("m", "cm")),
    (re.compile(r"^(\d+)kg(\d+)g$"), ("kg", "g")),
    (re.compile(r"^(\d+)km(\d+)m$"), ("km", "m")),
    (re.compile(r"^(\d+)L(\d+)dL$"), ("L", "dL")),
    (re.compile(r"^(\d+)グロスと(\d+)ダースと(\d+)本$"), ("グロス", "ダース", "本")),
]

RANGE_PATTERNS = [
    re.compile(r"^(\d+(?:\.\d+)?)\D{0,3}以上\s*(\d+(?:\.\d+)?)\D{0,3}以下$"),
    re.compile(r"^(\d+(?:\.\d+)?)\D{0,3}から\s*(\d+(?:\.\d+)?)\D{0,3}まで$"),
]


def steps_for(qtext, atext, meaning, stem=""):
    """1つの（問い・答え）から、アプリのstepを1つ以上作る。作れなければNone。
       stem＝①②の前に置かれた指示文（「大きい順に」などの判断に使う）。"""
    atext = norm(atext).strip()
    q = qtext.strip()
    full = (stem + " " + q).strip()

    def mk(qq, ans, ch=None):
        s = dict(question=qq, answer=ans, meaning=meaning)
        if ch:
            s["choices"] = ch
        return s

    # ① そのままテンキーで打てる
    v = to_numpad2(atext)
    if v is not None:
        return [mk(q, v)]

    # ①' かっこ書きで別の書き方が添えてある（100万倍（1000000倍））
    m = re.fullmatch(r"(.+?)[（(](.+?)[）)]", atext)
    if m:
        v2 = to_numpad2(m.group(2))
        if v2 is not None:
            return [mk(q, v2)]

    # ② ㋐㋑… / ア イ… で穴に名前が付いている
    for marks, fz, single in ((KMARU, False, True), (KATA, True, False)):
        parts = split_by_marks(atext, marks, fz, single)
        if parts:
            out = []
            for ch, val in parts:
                vv = to_numpad2(val)
                if vv is not None:
                    out.append(mk("%s　%sにあてはまる数を答えなさい。" % (q, ch), vv))
                    continue
                kc = kan_choices(val)
                if kc:
                    out.append(mk("%s　%sにあてはまるものを答えなさい。" % (q, ch), val, kc))
                    continue
                return None
            return out

    # ③ 不等号（答えが記号だけ／式ごと書いてある）
    if atext in FUGO:
        return [mk(q, FUGO[atext], ["＞", "＜", "＝"])]
    m = re.fullmatch(r"\s*([\d./と]+)\s*([<>=＜＞＝])\s*([\d./と]+)\s*", atext)
    if m:
        return [mk("%s　□にあてはまる不等号（または等号）を答えなさい。" % q,
                   FUGO[m.group(2)], ["＞", "＜", "＝"])]

    # ④ 漢数字／『4億2000万』のような 算用数字＋位
    kc = kan_choices(atext) or big_choices(atext)
    if kc:
        return [mk(q, atext, kc)]

    # ⑤ 2つ（3つ）の単位が組になった答え（1時間40分・2m5cm・411グロスと…）
    for pat, labels in PAIR_PATTERNS:
        m = pat.fullmatch(atext)
        if m:
            return [mk("%s　何%sですか。" % (q, labels[i]), m.group(i + 1))
                    for i in range(len(labels))]

    # ⑥ 範囲（1500以上1599以下／1217から1249まで）
    for pat in RANGE_PATTERNS:
        m = pat.fullmatch(atext)
        if m:
            return [mk("%s　いちばん小さい数を答えなさい。" % q, m.group(1)),
                    mk("%s　いちばん大きい数を答えなさい。" % q, m.group(2))]

    # ⑦ 単位分数のこ数（1/9が4こ）
    m = re.fullmatch(r"(\d+/\d+)が(\d+)こ", atext)
    if m:
        return [mk("%s　単位分数（分子が1の分数）で答えなさい。" % q, m.group(1)),
                mk("%s　その単位分数は何こ分ですか。" % q, m.group(2))]

    # ⑧ 並べかえ（大きい順・小さい順・速い順）
    if re.search(r"(順|じゅん)", full) or "→" in atext:
        oc = order_choices(atext, q)
        if oc:
            return [mk(q, oc[0], oc)]

    # ⑨ 答えが「2、4、7」のように並んでいる
    vals = [x.strip() for x in LIST_SEP.split(atext) if x.strip()]
    if len(vals) >= 2:
        conv = [to_numpad2(x) for x in vals]
        if all(c is not None for c in conv):
            nb = count_blanks(q) or count_blanks(full)
            if nb == len(vals):
                return [mk("%s　%dつめの□にあてはまる数を答えなさい。" % (q, i + 1), c)
                        for i, c in enumerate(conv)]
            asc = _numeric(conv) == sorted(_numeric(conv)) if _numeric(conv) else False
            if asc:
                return [mk("%s　小さい方から%d番目の数を答えなさい。" % (q, i + 1), c)
                        for i, c in enumerate(conv)]

    # ⑨' 「最大公約数…6 公約数…1, 2, 3, 6」のように ラベル…値 が並ぶ
    if "…" in atext:
        segs = re.findall(r"([^…\s]+)…([^…]+?)(?=\s+[^…\s]+…|$)", atext)
        if len(segs) >= 2:
            out = []
            for label, val in segs:
                vs = [x.strip() for x in LIST_SEP.split(val) if x.strip()]
                cv = [to_numpad2(x) for x in vs]
                if not all(c is not None for c in cv):
                    return None
                if len(cv) == 1:
                    out.append(mk("%s　%sを答えなさい。" % (q, label), cv[0]))
                else:
                    for i, c in enumerate(cv):
                        out.append(mk("%s　%sを小さい方からならべたとき、%d番目の数を答えなさい。"
                                      % (q, label, i + 1), c))
            return out

    # ⑨'' 「すべて書きなさい」で、答えが数の集まり（順番は問わない）
    if re.search(r"(すべて|全部|みんな|見つけ)", full):
        vs = [x.strip() for x in LIST_SEP.split(atext) if x.strip()]
        cv = [to_numpad2(x) for x in vs]
        if len(cv) >= 2 and all(c is not None for c in cv):
            nums = _numeric(cv)
            if nums:
                order = [c for _, c in sorted(zip(nums, cv))]
                return [mk("%s　小さい方から%d番目の数を答えなさい。" % (q, i + 1), c)
                        for i, c in enumerate(order)]

    # ⑩ ラベル付きの複合（大きい数 …／りんご 240g かご 350g／大阪280万人・…）
    lab = split_labeled2(atext)
    if lab and len({l for l, _ in lab}) != len(lab):
        return None      # ラベルが重なる＝どの穴を聞いているのか分からなくなる（手作業へ回す）
    if lab:
        out = []
        for label, val in lab:
            vv = to_numpad2(val)
            if vv is None:
                return None
            out.append(mk("%s　%sは何%sですか。" % (q, label, _unit_of(val)) if _unit_of(val)
                          else "%s　（%s）" % (q, label), vv))
        return out

    return None


def _numeric(conv):
    try:
        return [float(x) for x in conv]
    except ValueError:
        return []


def _unit_of(val):
    val = val.strip()
    for u in sorted(UNITS, key=len, reverse=True):
        if val.endswith(u):
            return u
    return ""


def split_labeled2(a):
    """「りんご 240g かご 350g」「大阪280万人・京都140万人」→[(ラベル, 値), …]"""
    a = a.replace("・", " ").replace("／", " ").replace("，", "、")
    a = re.sub(r"(\d)\s+(?=[a-zA-Zｍｇ])", r"\1", a)
    hits = re.findall(r"([^\d\s、,]+?)\s*(\d+(?:\.\d+)?(?:と\d+/\d+)?(?:/\d+)?(?:万|億|兆)?"
                      r"(?:cm²|kg|km|cm|mm|dL|mL|まい|こ|人|円|本|回|才|枚|個|g|m|L|t)?)",
                      a)
    if len(hits) < 2:
        return None
    joined = "".join(l + v for l, v in hits)
    if re.sub(r"[\s、,]", "", joined) != re.sub(r"[\s、,]", "", a):
        return None
    return hits


# ── 「4億2000万」のような 算用数字＋位 の書き方 ──────────────────────
UNIT4 = [("兆", 10 ** 12), ("億", 10 ** 8), ("万", 10 ** 4)]


def big_value(s):
    """『4億2000万』→420000000。この書き方でなければNone。"""
    if not re.fullmatch(r"(?:\d+兆)?(?:\d+億)?(?:\d+万)?(?:\d+)?", s) or not s:
        return None
    if not re.search(r"[兆億万]", s):
        return None
    total, rest = 0, s
    for name, k in UNIT4:
        m = re.match(r"(\d+)%s" % name, rest)
        if m:
            total += int(m.group(1)) * k
            rest = rest[m.end():]
    if rest:
        if not rest.isdigit():
            return None
        total += int(rest)
    return total


def big_str(n):
    """420000000→『4億2000万』（浜の本文と同じ書き方）"""
    out, rest = "", n
    for name, k in UNIT4:
        q, rest = divmod(rest, k)
        if q:
            out += "%d%s" % (q, name)
    if rest or not out:
        out += str(rest)
    return out


def big_parts(s):
    """『4億2000万』→[('4','億'),('2000','万')]（書き方の形をそのまま保つ）"""
    out, rest = [], s
    for name, _ in UNIT4:
        m = re.match(r"(\d+)%s" % name, rest)
        if m:
            out.append((m.group(1), name))
            rest = rest[m.end():]
    if rest:
        out.append((rest, ""))
    return out


def big_choices(ans):
    """『4億2000万』にまぎらわしいダミー3つ。10倍・1/10（＝けたの取りちがえ）と、
       上のけたを1動かした数。どれも別の整数なので、絶対に正解にならない。"""
    n = big_value(ans)
    if n is None or big_str(n) != ans:
        return None
    cand = []

    def add(v):
        if v <= 0:
            return
        t = big_str(v)
        if t != ans and t not in cand:
            cand.append(t)

    add(n * 10)
    if n % 10 == 0:
        add(n // 10)
    d = 10 ** (len(str(n)) - 1)
    add(n + d)
    add(n - d)
    add(n * 100)
    return [ans] + cand[:3] if len(cand) >= 3 else None
