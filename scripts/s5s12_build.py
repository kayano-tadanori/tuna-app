# -*- coding: utf-8 -*-
"""小5最レ 第1・2分冊で出てくる「答えの書き方」を、テンキーか4択で答えられる形にする。

★ここでやるのは答え方の様式だけ（feedback_genbo_dori の区別）。問うている中身は変えない。
★choices の要素と answer は一字一句そろえる（feedback_answerable_format）。
第1〜3分冊の道具（g4b1/g4b2/g4b3_build）に、この教材で出た書き方だけを足す。
"""
import os
import re
import sys
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b1_build as B      # noqa: E402
import g4b2_build as BB     # noqa: E402
import g4b3_build as B3     # noqa: E402

# ── この教材で出てくる単位を足す（足すだけ。前の分冊の答えは変わらない） ──
EXTRA_UNITS = ["時間後", "時間前", "秒後", "秒前", "分間後", "周", "周目", "せき", "そう",
               "けん", "軒", "番目の数", "才年上", "才年下", "cm³", "m³", "cc",
               "つ", "題", "問", "面", "個ずつ", "こずつ", "人ずつ", "円ずつ", "本ずつ",
               "ふくろ", "箱", "はこ", "きゃく", "脚", "客", "階", "段", "けた", "ケタ",
               "通", "束", "たば", "皿", "さら", "羽", "匹", "びき", "ひき", "頭", "点",
               "才", "歳", "km²", "百分率", "％", "%", "割", "分", "厘"]
for _u in EXTRA_UNITS:
    if _u not in B.UNITS:
        B.UNITS.append(_u)

SPEED_HEAD = re.compile(r"^(時速|分速|秒速|毎時|毎分|毎秒)")
SUB_DIGITS = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")


def clean(a):
    """原簿の飾り（**強調・全角空白・末尾の区切り）を落とす。中身は変えない。"""
    if a is None:
        return None
    a = a.replace("**", "").replace("\u3000", " ")
    a = a.strip().strip("／/・、， \t")
    return a.strip()


def to_numpad_s5(a):
    """B3.to_numpad3 に、この教材の言い方（毎時◯km・N進法の下つき）を足したもの。"""
    if a is None:
        return None
    a = clean(a)
    v = B3.to_numpad3(a)
    if v is not None:
        return v
    a2 = SPEED_HEAD.sub("", a).strip()
    if a2 != a:
        v = B3.to_numpad3(a2)
        if v is not None:
            return v
    # 「1221₍₄₎」「10101(3)」＝N進法の表記。底は設問側に書いてあるので数字だけ答える
    m = re.fullmatch(r"([0-9]+)\s*[₍(（]\s*[0-9₀-₉]+\s*[₎)）]", a.translate(SUB_DIGITS))
    if m:
        return m.group(1)
    return None


def _mk(q, ans, meaning, ch=None):
    return BB._mk(q, ans, meaning, ch)


# ── ラベル＋速さ が並ぶ答え ───────────────────────────────────────
SPEED_TOK = re.compile(r"^(.*?)(時速|分速|秒速|毎時|毎分|毎秒)\s*(\d+(?:\.\d+)?(?:と\d+/\d+)?|\d+/\d+)\s*([a-zA-Zｍｋ]+|m|km|cm)$")


def by_speed_list(q, a, meaning):
    """『下り 時速34km 上り 時速26km』『A 分速110m B 分速90m』を1つずつの問いに割る。"""
    toks = [x for x in re.split(r"[、,，・]|／|\s{1,}", a) if x.strip()]
    # 「下り 時速34km」のようにラベルと速さが空白で切れているので、2つずつ結合してみる
    cand = []
    i = 0
    while i < len(toks):
        t = toks[i]
        if SPEED_HEAD.match(t) and cand and not SPEED_HEAD.match(cand[-1]):
            cand[-1] = cand[-1] + t
        else:
            cand.append(t)
        i += 1
    parsed = []
    for t in cand:
        m = SPEED_TOK.match(t.strip())
        if not m:
            return None
        parsed.append((m.group(1).strip(), m.group(2), m.group(3), m.group(4)))
    if len(parsed) < 2:
        return None
    labs = [p[0] for p in parsed]
    if not all(labs) or len(set(labs)) != len(labs):
        return None
    return [_mk("%s　%sの速さは%s何%sですか。" % (q, lab, head, unit), num, meaning)
            for lab, head, num, unit in parsed]


# ── 時こく（4時54分・午前7時27分・2時10と10/11分） ───────────────
TIME = re.compile(r"^(午前|午後)?\s*(\d+)\s*時\s*(\d+(?:と\d+/\d+)?)\s*分\s*(?:(\d+)\s*秒)?$")


def by_time(q, a, meaning, ctx=None):
    m = TIME.match(a.strip())
    if not m:
        return None
    ampm, h, mi, sec = m.group(1), m.group(2), m.group(3), m.group(4)
    head = ("%s " % ampm) if ampm else ""
    # ★「5時と6時の間で…」のように時が設問に書いてあるなら、時は聞かない。
    #   聞くと答えを設問が見せてしまう（分だけが本当の答え）
    if ctx is None:
        ctx = q
    if not sec and ("%s時" % h) in ctx:
        # 設問がすでに「何時何分ですか」で終わっていれば、聞き直さず「分のほう」だけ言う
        tail = ("分のほうを答えなさい。" if "何時何分" in (q or ctx)
                else "%s何時何分ですか。分のほうを答えなさい。" % head)
        return [_mk("%s　%s" % (q, tail) if q else tail, mi, meaning)]
    out = [_mk("%s　%s何時何分ですか。時のほうを答えなさい。" % (q, head), h, meaning),
           _mk("%s　%s何時何分ですか。分のほうを答えなさい。" % (q, head), mi, meaning)]
    if sec:
        out[0]["question"] = "%s　%s何時何分何秒ですか。時のほうを答えなさい。" % (q, head)
        out[1]["question"] = "%s　%s何時何分何秒ですか。分のほうを答えなさい。" % (q, head)
        out.append(_mk("%s　%s何時何分何秒ですか。秒のほうを答えなさい。" % (q, head), sec, meaning))
    return out


# ── 比（8：5） ────────────────────────────────────────────────
RATIO = re.compile(r"^(\d+)\s*[：:]\s*(\d+)$")


def _ratio_choices(a, nums):
    """比の4択。答えのほかに「逆にした比」「1つずらした比」を置く。"""
    out = [a]
    cand = ["：".join(reversed(nums)),
            "：".join([str(int(nums[0]) + 1)] + nums[1:]),
            "：".join(nums[:-1] + [str(int(nums[-1]) + 1)])]
    for c in cand:
        if c not in out:
            out.append(c)
    return out[:4]


def _shown(a, q, stem):
    """答えの比が設問や導入文にそのまま書いてあるか。書いてあれば
       「前の数／後ろの数」に割ると写すだけで答えられてしまう（塾講師監査2026-09-02）。"""
    t = (stem or "") + " " + (q or "")
    return a.replace(" ", "") in t.replace(" ", "")


def by_ratio(q, a, meaning, stem=""):
    m = RATIO.match(a.strip())
    if not m:
        return None
    nums = [m.group(1), m.group(2)]
    if _shown(a.strip(), q, stem):
        return [_mk(q, a.strip(), meaning, _ratio_choices(a.strip(), nums))]
    return [_mk("%s　いちばんかんたんな整数の比で表したとき、前の数を答えなさい。" % q, nums[0], meaning),
            _mk("%s　いちばんかんたんな整数の比で表したとき、後ろの数を答えなさい。" % q, nums[1], meaning)]


# ── ラベル＝値（A＝6、B＝24） ────────────────────────────────
LABEL_EQ = re.compile(r"([A-Za-zＡ-Ｚア-ン甲乙丙㋐-㋚あ-ん一-龥]{1,4})\s*[＝=]\s*([^\s、,，]+)")


def by_label_eq(q, a, meaning):
    hits = LABEL_EQ.findall(a)
    if len(hits) < 1:
        return None
    joined = "".join("%s＝%s" % h for h in hits)
    if re.sub(r"[\s、,，]", "", a).replace("=", "＝") != joined:
        return None
    out = []
    for lab, val in hits:
        v = to_numpad_s5(val)
        if v is None:
            return None
        out.append(_mk("%s　%sにあてはまる数を答えなさい。" % (q, lab), v, meaning))
    return out


# ── 数がいくつか並ぶ答え（16, 27, 38, 49） ────────────────────
def _nums(a):
    vals = [x.strip() for x in re.split(r"[、,，]", a) if x.strip()]
    if len(vals) < 2:
        return None
    out = []
    for v in vals:
        n = to_numpad_s5(v)
        if n is None:
            return None
        out.append(n)
    return out


def _val(s):
    m = re.match(r"^(\d+)と(\d+)/(\d+)$", s)
    if m:
        return int(m.group(1)) + Fraction(int(m.group(2)), int(m.group(3)))
    if "/" in s:
        return Fraction(s)
    return Fraction(s)


def by_num_list(q, a, meaning, stem=""):
    """『すべて求めなさい』の答えが数の並びのとき、小さい順に1つずつ聞く。"""
    vals = _nums(a)
    if not vals:
        return None
    full = (stem or "") + " " + q
    if not re.search(r"(すべて|全部|みんな|いくつありますか)", full):
        return None
    order = sorted(vals, key=_val)
    return [_mk("%s　あてはまる数を小さい方からならべたとき、%d番目の数を答えなさい。" % (q, i + 1),
                v, meaning) for i, v in enumerate(order)]


# ── 範囲（1080g以上1295g以下） ───────────────────────────────
RANGE = re.compile(r"^(\d+(?:\.\d+)?)\s*([^\d\s]{0,4}?)\s*以上\s*(\d+(?:\.\d+)?)\s*([^\d\s]{0,4}?)\s*以下$")


def by_range(q, a, meaning):
    m = RANGE.match(a.strip())
    if not m:
        return None
    lo, u1, hi, u2 = m.group(1), m.group(2), m.group(3), m.group(4)
    u = u2 or u1
    tail = ("何%sですか。" % u) if u else "いくつですか。"
    return [_mk("%s　いちばん小さい場合は%s" % (q, tail), lo, meaning),
            _mk("%s　いちばん大きい場合は%s" % (q, tail), hi, meaning)]


# ── まとめ ───────────────────────────────────────────────────
def _numpad_or_base(qtext, atext, meaning, stem=""):
    a = clean(B.norm(atext))
    q = (qtext or "").strip()
    if not a:
        return None
    v = to_numpad_s5(a)
    if v is not None:
        return [_mk(q, v, meaning)]
    base = B3.steps_for(q, a, meaning, stem)
    if base is not None:
        return base
    for fn in (by_speed_list, by_time, by_ratio, by_label_eq, by_range):
        r = fn(q, a, meaning)
        if r:
            return r
    return by_num_list(q, a, meaning, stem)


# ══════════════════════════════════════════════════════════════════
# ここから下は、上の型でも拾えなかった書き方を1つずつ足したもの。
# どれも「答え方の様式」だけを変える。問うている中身は変えない。
# ══════════════════════════════════════════════════════════════════
for _u in ["冊", "袋", "ふくろ", "室", "回目", "個", "台", "㎡", "m²", "着", "膳",
           "トモワ", "ニルソン", "フラグ", "シュヴァルツ",
           "回転", "目もり", "等分", "番地", "けん", "軒",
           "本目", "個目", "枚目", "人目", "日目", "問目", "才", "km", "kg"]:
    if _u not in B.UNITS:
        B.UNITS.append(_u)

# ── 3つ以上の比（6：15：10 ／ A：B：C＝3：5：8 ／ DG:GF:FB=4:1:5） ──
RATIO_N = re.compile(r"^(?:(?P<lab>[^\d＝=]{1,30})\s*[＝=]\s*)?(?P<nums>\d+(?:\s*[：:]\s*\d+){1,5})$")
ORD = ["1つめ", "2つめ", "3つめ", "4つめ", "5つめ", "6つめ"]


def by_ratio_n(q, a, meaning, stem=""):
    """比を『◯つめの数』に割って聞く。前後の呼び名は答えの左側に書いてあればそれを使う。"""
    s = a.strip()
    m = RATIO_N.match(s)
    if not m:
        return None
    nums = [x.strip() for x in re.split(r"[：:]", m.group("nums"))]
    if len(nums) < 2:
        return None
    if _shown(s, q, stem):
        return [_mk(q, s, meaning, _ratio_choices(s, nums))]
    labs = None
    if m.group("lab"):
        cand = [x.strip() for x in re.split(r"[：:]", m.group("lab"))]
        if len(cand) == len(nums) and all(cand):
            labs = cand
    out = []
    for i, n in enumerate(nums):
        if labs:
            qq = "%s　いちばんかんたんな整数の比で表したとき、%s にあたる数を答えなさい。" % (q, labs[i])
        else:
            qq = "%s　いちばんかんたんな整数の比で表したとき、%sの数を答えなさい。" % (q, ORD[i])
        out.append(_mk(qq, n, meaning))
    return out


# ── 概数の範囲（3000以上3100未満 ／ 1900より大きく2000以下） ──────
RANGE2 = re.compile(
    r"^(\d+(?:\.\d+)?)\s*([^\d\s]{0,4}?)\s*(以上|より大きく|をこえ)\s*"
    r"(\d+(?:\.\d+)?)\s*([^\d\s]{0,4}?)\s*(以下|未満|より小さい)$")


def by_range2(q, a, meaning):
    m = RANGE2.match(a.strip())
    if not m:
        return None
    lo, u1, k1, hi, u2, k2 = m.groups()
    u = u2 or u1
    tail = ("何%sですか。" % u) if u else "いくつですか。"
    return [_mk("%s　その範囲の下のはしの数は%s（%s）" % (q, tail, k1), lo, meaning),
            _mk("%s　その範囲の上のはしの数は%s（%s）" % (q, tail, k2), hi, meaning)]


# ── 「◯が△多い」（差分算の答え方） ───────────────────────────
WHO_MORE = re.compile(r"^(.{1,8}?)\s*が\s*(\d+(?:\.\d+)?(?:と\d+/\d+)?)\s*([^\d\s]{0,6}?)\s*(多い|少ない|年上|年下|長い|短い|重い|軽い)$")


def _who_choices(who, q, stem=""):
    """『妹』の相手（姉）を設問の中からさがして4択にする。見つからなければNone。"""
    text = (stem or "") + " " + q
    pairs = [("姉", "妹"), ("兄", "弟"), ("兄", "妹"), ("姉", "弟"), ("父", "母"),
             ("A君", "B君"), ("A", "B"), ("甲", "乙"), ("兄", "姉"), ("弟", "妹"),
             ("太郎", "次郎"), ("上", "下"), ("大きい方", "小さい方")]
    for x, y in pairs:
        if who == x and y in text:
            return [x, y]
        if who == y and x in text:
            return [x, y]
    return None


def by_who_more(q, a, meaning, stem=""):
    m = WHO_MORE.match(a.strip())
    if not m:
        return None
    who, num, unit, kind = m.groups()
    ch = _who_choices(who, q, stem)
    if not ch:
        return None
    tail = ("何%s%sですか。" % (unit, kind)) if unit else ("どれだけ%sですか。" % kind)
    return [_mk("%s　%sのほうが%sですか。" % (q, "どちら", kind), who, meaning, ch),
            _mk("%s　%s" % (q, tail), num, meaning)]


# ── 「AがBに1000円」（やりとり算の答え方） ───────────────────
WHO_TO = re.compile(r"^(.{1,8}?)\s*が\s*(.{1,8}?)\s*に\s*(\d+(?:\.\d+)?)\s*([^\d\s]{0,6})$")
WHO_FROM_TO = re.compile(r"^(.{1,8}?)\s*から\s*(.{1,8}?)\s*に\s*(\d+(?:\.\d+)?)\s*([^\d\s]{0,6})$")


def by_who_to(q, a, meaning, stem=""):
    m = WHO_TO.match(a.strip()) or WHO_FROM_TO.match(a.strip())
    if not m:
        return None
    frm, to, num, unit = m.groups()
    ch = _who_choices(frm, q, stem)
    if not ch or to not in ch:
        return None
    tail = ("何%sですか。" % unit) if unit else "いくらですか。"
    return [_mk("%s　払う（わたす）のはどちらですか。" % q, frm, meaning, ch),
            _mk("%s　その額は%s" % (q, tail), num, meaning)]


# ── 「6と11」「552と283」＝2つの数 ────────────────────────────
TWO_NUM = re.compile(r"^(\d+(?:\.\d+)?(?:と\d+/\d+)?)\s*と\s*(\d+(?:\.\d+)?(?:と\d+/\d+)?)$")


def by_two_nums(q, a, meaning):
    m = TWO_NUM.match(a.strip())
    if not m:
        return None
    x, y = m.group(1), m.group(2)
    lo, hi = (x, y) if _val(x) <= _val(y) else (y, x)
    return [_mk("%s　小さい方の数を答えなさい。" % q, lo, meaning),
            _mk("%s　大きい方の数を答えなさい。" % q, hi, meaning)]


# ── 「昼13時間9分 夜10時間51分」＝ラベル＋複合単位 ──────────────
PAIR_UNIT = [(re.compile(r"^(.{1,8}?)\s*(\d+)時間(\d+)分$"), ("時間", "分")),
             (re.compile(r"^(.{1,8}?)\s*(\d+)分(\d+)秒$"), ("分", "秒")),
             (re.compile(r"^(.{1,8}?)\s*(\d+)km(\d+)m$"), ("km", "m")),
             (re.compile(r"^(.{1,8}?)\s*(\d+)kg(\d+)g$"), ("kg", "g"))]


def by_label_pair_unit(q, a, meaning):
    toks = [x for x in re.split(r"[、,，／/]|\s{1,}", a) if x.strip()]
    got = []
    for t in toks:
        hit = None
        for rx, us in PAIR_UNIT:
            m = rx.match(t.strip())
            if m:
                hit = (m.group(1).strip(), m.group(2), m.group(3), us)
                break
        if not hit or not hit[0]:
            return None
        got.append(hit)
    if len(got) < 2:
        return None
    if len(set(g[0] for g in got)) != len(got):
        return None
    out = []
    for lab, v1, v2, us in got:
        out.append(_mk("%s　%sは何%s何%sですか。%sのほうを答えなさい。" % (q, lab, us[0], us[1], us[0]), v1, meaning))
        out.append(_mk("%s　%sは何%s何%sですか。%sのほうを答えなさい。" % (q, lab, us[0], us[1], us[1]), v2, meaning))
    return out


# ── 虫食い算（答えが完成した式） ───────────────────────────────
# ⚠ 過去に「虫食い算が不等号問題に化けた」事故がある（小4第3分冊）。
#    そこで、設問に□と『あてはまる数』があり、答えが「数 演算 数 ＝ 数」の形の
#    ときだけに限定する。式の形が少しでも違えば手作業へ回す。
MUSHI = re.compile(r"^(\d+)\s*([＋+－\-×÷])\s*(\d+)\s*[＝=]\s*(\d+(?:あまり\d+|余り\d+)?)$")
OPNAME = {"＋": ("たされる数", "たす数", "答え"), "+": ("たされる数", "たす数", "答え"),
          "－": ("ひかれる数", "ひく数", "答え"), "-": ("ひかれる数", "ひく数", "答え"),
          "×": ("かけられる数", "かける数", "答え"),
          "÷": ("わられる数", "わる数", "答え")}


def by_mushikui(q, a, meaning, stem=""):
    full = (stem or "") + " " + q
    if "□" not in full or not re.search(r"あてはまる数", full):
        return None
    m = MUSHI.match(a.strip())
    if not m:
        return None
    x, op, y, z = m.groups()
    n1, n2, n3 = OPNAME[op]
    z = z.replace("あまり", "余り")
    out = []
    for val, name in ((x, n1), (y, n2), (z, n3)):
        # ★その数が設問にそのまま印刷されている（□が無い）なら聞かない。
        #   聞くと「答えが設問に書いてある問題」になる（2026-09-02・HG-6583で発覚）
        if val in q:
            continue
        out.append(_mk("%s　□をうめて式を完成させたとき、%sはいくつですか。" % (q, name), val, meaning))
    return out or None


# ── 時こくが2つならぶ（5時10と10/11分，5時43と7/11分） ────────────
def by_time_list(q, a, meaning):
    toks = [x.strip() for x in re.split(r"[、,，]", a) if x.strip()]
    if len(toks) < 2:
        return None
    outs = []
    for t in toks:
        t = re.sub(r"[（(][^）)]*[）)]\s*$", "", t).strip()
        # ★設問は前に付けないが、時が設問に書いてあるかの判定にだけ使う
        r = by_time("", t, meaning, ctx=q)
        if not r:
            return None
        outs.append(r)
    res = []
    for i, r in enumerate(outs):
        for s in r:
            tail = s["question"].lstrip("　 ")
            res.append(_mk("%s　%d回目は%s" % (q, i + 1, tail), s["answer"], meaning))
    return res


def steps_for2(qtext, atext, meaning, stem=""):
    """steps_for でも作れなかったものを、上の型でもう一度ためす。"""
    a = clean(B.norm(atext))
    q = (qtext or "").strip()
    if not a:
        return None
    for fn in (by_ratio_n, by_range2, by_two_nums, by_label_pair_unit, by_time_list):
        r = fn(q, a, meaning)
        if r:
            return r
    for fn in (by_who_more, by_who_to, by_mushikui):
        r = fn(q, a, meaning, stem)
        if r:
            return r
    return None



# ── 末尾の注記つき（2時27と3/11分（1通りのみ）） ─────────────────
NOTE_TAIL = re.compile(r"[（(][^）)]*[）)]\s*$")

# ── ラベル＝値の並び（x＝1，7，15 ／ A＝5，15，25） ──────────────
LABEL_LIST = re.compile(r"^([A-Za-zＡ-Ｚア-ンあ-ん甲乙丙x-z]{1,4})\s*[＝=]\s*(.+)$")


def by_label_num_list(q, a, meaning):
    m = LABEL_LIST.match(a.strip())
    if not m:
        return None
    lab, rest = m.group(1), m.group(2)
    vals = _nums(rest)
    if not vals:
        return None
    order = sorted(vals, key=_val)
    return [_mk("%s　%s にあてはまる数を小さい方からならべたとき、%d番目の数を答えなさい。" % (q, lab, i + 1),
                v, meaning) for i, v in enumerate(order)]


# ── 時こくの範囲（午前9時24分から午前9時45分まで） ─────────────
TIME_RANGE = re.compile(r"^(.+?)\s*から\s*(.+?)\s*まで$")


def by_time_range(q, a, meaning):
    m = TIME_RANGE.match(a.strip())
    if not m:
        return None
    s1 = by_time("", m.group(1), meaning)
    s2 = by_time("", m.group(2), meaning)
    if not s1 or not s2:
        return None
    out = []
    for tag, ss in (("はじまり", s1), ("おわり", s2)):
        for x in ss:
            out.append(_mk("%s　%sの時こくについて、%s" % (q, tag, x["question"].lstrip("　 ")),
                           x["answer"], meaning))
    return out


# ── 範囲がいくつも並ぶ（1080g以上1295g以下，2376g以上…） ──────────
# ★「◯番目にせまい」は幅が同じだと順が決まらない（塾講師監査で指摘）。
#   小さいほうから順に数える言い方にそろえる。
def by_range_list(q, a, meaning):
    toks = [x.strip() for x in re.split(r"[、,，]", a) if x.strip()]
    if len(toks) < 2:
        return None
    got = []
    for t in toks:
        m = RANGE.match(t)
        if m:
            lo, u1, hi, u2 = m.group(1), m.group(2), m.group(3), m.group(4)
        else:
            m = RANGE2.match(t)
            if not m:
                return None
            lo, u1, _k1, hi, u2, _k2 = m.groups()
        got.append((lo, hi, u2 or u1))
    out = []
    for i, (lo, hi, u) in enumerate(got):
        tail = ("何%sですか。" % u) if u else "いくつですか。"
        out.append(_mk("%s　小さいほうから%d番目の範囲の、下のはしは%s" % (q, i + 1, tail), lo, meaning))
        out.append(_mk("%s　小さいほうから%d番目の範囲の、上のはしは%s" % (q, i + 1, tail), hi, meaning))
    return out


# ══════════════════════════════════════════════════════════════════
# まとめ（順番が大事）
#   ★形がはっきりしている書き方（比・時こく・範囲）を先に見る。
#     あとに回すと、g4b1/g4b2/g4b3 の「ラベル＋数」の規則が
#     「5：7」を『ラベル5：＋数7』と読んでしまい、前の数の小問が消える
#     （2026-09-02・塾講師監査でHG-6785/6786/6787/6862/6864が指摘された）。
# ══════════════════════════════════════════════════════════════════
SHAPE_FIRST = (by_ratio, by_ratio_n, by_time_list, by_time, by_range2, by_range)


def steps_for(qtext, atext, meaning, stem=""):
    a = clean(B.norm(atext))
    q = (qtext or "").strip()
    if not a:
        return None
    v = to_numpad_s5(a)
    if v is not None:
        return [_mk(q, v, meaning)]
    for fn in SHAPE_FIRST:
        r = fn(q, a, meaning, stem) if fn in (by_ratio, by_ratio_n) else fn(q, a, meaning)
        if r:
            return r
    r = B3.steps_for(q, a, meaning, stem)
    if r is not None:
        return r
    for fn in (by_speed_list, by_label_eq):
        r = fn(q, a, meaning)
        if r:
            return r
    for fn in (by_who_more, by_who_to, by_mushikui):
        r = fn(q, a, meaning, stem)
        if r:
            return r
    for fn in (by_two_nums, by_label_pair_unit):
        r = fn(q, a, meaning)
        if r:
            return r
    r = by_num_list(q, a, meaning, stem)
    if r:
        return r
    # 末尾の注記（「（1通りのみ）」）を落として、もう一度ためす
    a2 = NOTE_TAIL.sub("", a).strip()
    if a2 and a2 != a:
        r = steps_for(q, a2, meaning, stem)
        if r:
            return r
    for fn in (by_label_num_list, by_time_range, by_range_list):
        r = fn(q, a, meaning)
        if r:
            return r
    return None
