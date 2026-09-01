# -*- coding: utf-8 -*-
"""「1回まるごと同じ解説」になってしまう計算ドリル型の大問について、
   小問1つずつの解説を、その場の数値から組み立てる。

★塾講師監査（2026-09-02）の指摘：
  「原簿の(1)(2)…番号が小問番号とずれているので、子どもは自分の問題の説明を探せない」
  「比a：bの比の値＝a÷bを求める計算ドリル」は説明になっていない。
中身（答え）は変えない。説明を、その小問の数値で書くだけ。
"""
import re
from fractions import Fraction

NUM = r"\d+(?:\.\d+)?(?:と\d+/\d+)?(?:/\d+)?"


def _frac(s):
    """「2と1/3」「0.125」「5/12」→ Fraction。読めなければ None。"""
    s = s.strip()
    m = re.fullmatch(r"(\d+)と(\d+)/(\d+)", s)
    if m:
        return int(m.group(1)) + Fraction(int(m.group(2)), int(m.group(3)))
    m = re.fullmatch(r"(\d+)/(\d+)", s)
    if m:
        return Fraction(int(m.group(1)), int(m.group(2)))
    m = re.fullmatch(r"\d+(?:\.\d+)?", s)
    if m:
        return Fraction(s)
    return None


def _terms(s, sep=r"[：:]"):
    parts = [x.strip() for x in re.split(sep, s.strip()) if x.strip()]
    vals = [_frac(x) for x in parts]
    return (parts, vals) if all(v is not None for v in vals) else (None, None)


def _int_str(f):
    return str(f.numerator) if f.denominator == 1 else str(f)


def ratio_simplify(q, a):
    """「24：9」→「8：3」の説明。小数・分数も、まず整数にしてから約分する形で書く。"""
    qs, qv = _terms(q)
    as_, av = _terms(a)
    if not qv or not av or len(qv) != len(av) or len(qv) < 2:
        return None
    if any(v.denominator != 1 for v in av):
        return None
    # 分母をはらう倍率
    mul = 1
    for v in qv:
        mul = mul * v.denominator // _gcd(mul, v.denominator)
    ints = [v * mul for v in qv]
    if any(v.denominator != 1 for v in ints):
        return None
    ints = [int(v) for v in ints]
    g = 0
    for v in ints:
        g = _gcd(g, v)
    if g == 0:
        return None
    got = [v // g for v in ints]
    if got != [int(v) for v in av]:
        return None
    head = "：".join(qs)
    mid = "：".join(str(v) for v in ints)
    tail = "：".join(str(v) for v in got)
    out = []
    if mul != 1:
        out.append("%s は、どれも%d倍すると %s になる" % (head, mul, mid))
    if g != 1:
        base = mid if mul != 1 else head
        out.append("%s を どれも %d でわると %s" % (base, g, tail))
    if not out:
        return "%s は、これ以上かんたんにできない整数の比" % head
    return "。".join(out) + "。"


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


HIRE = re.compile(r"^\s*([^:：=＝]+)[:：]([^:：=＝]+)[=＝]([^:：=＝]+)[:：]([^:：=＝]+)\s*$")


def hirei(q, a, shown=None):
    """「4:6=8:□」→「内側どうしの積と外側どうしの積は等しい。6×8÷4＝12。」"""
    m = HIRE.match(q.replace("（", "(").replace("）", ")"))
    if not m:
        return None
    t = [x.strip() for x in m.groups()]
    if sum(1 for x in t if "□" in x) != 1:
        return None
    if any(("□" not in x) and _frac(x) is None for x in t):
        return None
    i = next(k for k, x in enumerate(t) if "□" in x)
    v = [None if "□" in x else _frac(x) for x in t]
    ans = _frac(a)
    if ans is None:
        return None
    # a:b=c:d なら a×d＝b×c。分からない場所ごとに、残り3つで組み立てる
    #   a が□ … a＝b×c÷d ／ b が□ … b＝a×d÷c
    #   c が□ … c＝a×d÷b ／ d が□ … d＝b×c÷a
    p, x, y = {0: (3, 1, 2), 1: (2, 0, 3), 2: (1, 0, 3), 3: (0, 1, 2)}[i]
    got = v[x] * v[y] / v[p]
    if got != ans:
        return None
    return ("外側どうしの積と内側どうしの積は等しくなる（%s×%s＝%s×%s）。"
            "だから □＝%s×%s÷%s＝%s。"
            % (t[0], t[3], t[1], t[2],
               _int_str(v[x]), _int_str(v[y]), _int_str(v[p]), (shown or _int_str(ans))))


def hi_no_atai(q, a, shown=None):
    """「2：5」の比の値＝2÷5。"""
    qs, qv = _terms(q)
    if not qv or len(qv) != 2:
        return None
    ans = _frac(a)
    if ans is None or qv[0] / qv[1] != ans:
        return None
    return "比の値は「前÷後ろ」。%s÷%s＝%s。" % (qs[0], qs[1], shown or _int_str(ans))


def auto(q, a):
    """その小問の数値から解説を作る。作れなければ None。"""
    for fn in (ratio_simplify, hirei, hi_no_atai):
        try:
            r = fn(q, a, a) if fn in (hirei, hi_no_atai) else fn(q, a)
        except Exception:
            r = None
        if r:
            return r
    return None


# ── 逆比（3：7 → 7：3） ───────────────────────────────────────
def gyakuhi(q, a, stem=""):
    if "逆比" not in (stem or ""):
        return None
    qs, qv = _terms(q)
    as_, av = _terms(a)
    if not qv or not av or len(qv) != len(av) or len(qv) < 2:
        return None
    inv = [1 / v for v in qv]
    mul = 1
    for v in inv:
        mul = mul * v.denominator // _gcd(mul, v.denominator)
    ints = [int(v * mul) for v in inv]
    g = 0
    for v in ints:
        g = _gcd(g, v)
    got = [v // g for v in ints]
    if got != [int(v) for v in av]:
        return None
    head = "：".join(qs)
    invs = "：".join(_int_str(1 / v) for v in qv)
    out = "%s の逆比は、それぞれを「1わる その数」にした %s。" % (head, invs)
    if mul != 1:
        out += "どれも%d倍して %s。" % (mul, "：".join(str(v) for v in ints))
    if g != 1:
        out += "%dでわって %s。" % (g, "：".join(str(v) for v in got))
    if mul == 1 and g == 1:
        out += "そのまま %s。" % "：".join(str(v) for v in got)
    return out


# ── 「AはBの◯倍」→ A：B ────────────────────────────────────
BAI = re.compile(r"[ＡA]は[ＢB]の(%s)倍" % NUM)


def bairitsu(q, a):
    m = BAI.search(q)
    if not m:
        return None
    k = _frac(m.group(1))
    as_, av = _terms(a)
    if k is None or not av or len(av) != 2:
        return None
    mul = k.denominator
    x, y = int(k.numerator), int(mul)
    g = _gcd(x, y)
    if [x // g, y // g] != [int(v) for v in av]:
        return None
    s = "Bを1とするとAは%s。だからA：B＝%s：1" % (m.group(1), m.group(1))
    if mul != 1:
        s += "。どちらも%d倍して %d：%d" % (mul, x, y)
    if g != 1:
        s += "。さらに%dでわって %d：%d" % (g, x // g, y // g)
    return s + "。"


_auto_old = auto


def auto(q, a, stem=""):        # noqa: F811
    r = gyakuhi(q, a, stem) or bairitsu(q, a)
    return r or _auto_old(q, a)


# ── 「12:□=□:3（□には同じ数が入ります）」 ──────────────────────
SAME = re.compile(r"^\s*([^:：=＝]+)[:：]\s*□\s*[=＝]\s*□\s*[:：]([^:：=＝（(]+)")


def hirei_same(q, a):
    m = SAME.match(q.replace("（", "(").replace("）", ")"))
    if not m:
        return None
    x, y, ans = _frac(m.group(1).strip()), _frac(m.group(2).strip()), _frac(a)
    if x is None or y is None or ans is None or ans * ans != x * y:
        return None
    return ("□には同じ数が入るので、外側の積＝内側の積より □×□＝%s×%s＝%s。"
            "同じ数を2回かけて%sになるのは%s。"
            % (_int_str(x), _int_str(y), _int_str(x * y), _int_str(x * y), _int_str(ans)))


_auto_old2 = auto


def auto(q, a, stem=""):        # noqa: F811
    return hirei_same(q, a) or _auto_old2(q, a, stem)
