# -*- coding: utf-8 -*-
"""第2分冊で新しく出てくる「答えの書き方」を、テンキーか4択で答えられる形にする。

★ここでやるのは答え方の様式だけ（feedback_genbo_dori）。問うている中身は変えない。
★choices の要素と answer は一字一句そろえる（feedback_answerable_format）。
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b1_build as B   # noqa: E402

MARU = B.MARU
KATA = "アイウエオカキクケコサシスセソ"
KMARU = B.KMARU
HIRA = "あいうえおかきくけこ"

# ── 答えが言葉になる、決まったなかま ──────────────────────────────
TRI = ["正三角形", "二等辺三角形", "直角三角形", "直角二等辺三角形"]
QUAD = ["正方形", "長方形", "ひし形", "平行四辺形", "台形"]
WEEK = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]
MARUBATSU = ["○", "×"]
TOSHI = ["平年", "うるう年"]
IRO = ["白色", "黒色"]
IRO2 = ["白", "黒"]
GOZEN = ["午前", "午後"]

WORD_SETS = [TRI, QUAD, WEEK, MARUBATSU, TOSHI, IRO, IRO2]


def _mk(qq, ans, meaning, ch=None):
    s = dict(question=qq, answer=ans, meaning=meaning)
    if ch:
        s["choices"] = ch
    return s


def word_choices(a):
    """答えが『二等辺三角形』『火曜日』のような決まった言葉なら、その仲間ぜんぶを選択肢にする。
       選択肢の数はなかまごとに決まっているので、数から答えが読めることはない。"""
    a = a.strip()
    for st in WORD_SETS:
        if a in st:
            return list(st)
    # 「（等きゃく）台形」のように、名前の前に短い注記が付く書き方。
    # ⚠「正三角形，二等辺三角形」のように名前が2つならんだ答えはここに入れない
    #   （正解だけが2語になって、読まずに答えが分かってしまう＝塾講師の監査で出た指摘）
    for st in (QUAD, TRI):
        for w in st:
            if not a.endswith(w) or len(a) > len(w) + 6:
                continue
            head = a[:-len(w)]
            # 注記として認めるのは「（等きゃく）」のような短い前置きだけ。
            # 名前が2つならんでいたり、番号や空白が入っていたら別の答えが混じっている
            if (any(x in head for x in QUAD + TRI)
                    or any(c in head for c in "，、, 　")
                    or re.search(r"[①-⑳]", head)):
                continue
            return [a] + [x for x in st if x != w]
    return None


def needs_kuwashii(ch):
    """三角形・四角形の名前の4択は、上位の名前（二等辺三角形など）も理屈の上では
       正しくなってしまう。答え方として「いちばんくわしい名前」を指定する。"""
    s = set(ch)
    return s == set(TRI) or s == set(QUAD)


KUWASHII = "（かならずそうだといえる名前のうち、いちばんくわしいものを答えなさい。）"


LBL_EQ = re.compile(r"(?:角)?([ア-ンあ-んA-Zａ-ｚ㋐-㋚])\s*[＝=]\s*([^\s、，,]+)")
PAREN_LBL = re.compile(r"[（(]\s*([^（）()\s]{1,4})\s*[）)]\s*([^（()）]+?)(?=\s*[（(]|$)")


def _label_in(q, lab):
    """設問の中でその穴がどう書かれているかに合わせて、聞き方の言い方をそろえる。
       （設問に「□（1）」と出ているのに「1にあてはまる数」と聞くと何のことか分からない）"""
    for form in ("□（%s）" % lab, "（%s）" % lab, "(%s)" % lab):
        if form in q:
            return form
    return lab


def _labeled_steps(pairs, q, meaning, word):
    out = []
    for lab, val in pairs:
        name = _label_in(q, lab)
        v = B.to_numpad2(val)
        if v is not None:
            out.append(_mk("%s　%sにあてはまる数を答えなさい。" % (q, name), v, meaning))
            continue
        wc = word_choices(val)
        if wc:
            qq = "%s　%sにあてはまるものを答えなさい。" % (q, name)
            if needs_kuwashii(wc):
                qq += KUWASHII
            out.append(_mk(qq, val.strip(), meaning, wc))
            continue
        return None
    return out or None


def by_label(q, a, meaning):
    """『角ア＝60° 角イ＝120°』『(ア) 13 (イ) 25』『ア 120° イ 60°』のような
       ラベル付きの答えを、ラベルごとの1問に割る。"""
    for pat in (LBL_EQ, PAREN_LBL):
        ms = list(pat.finditer(a))
        if len(ms) >= 2 and _covers(a, ms):
            hits = [(m.group(1), m.group(2).strip()) for m in ms]
            if len({l for l, _ in hits}) == len(hits):
                st = _labeled_steps(hits, q, meaning, True)
                if st:
                    return st
    # ③ ア 120° イ 60°（ア始まりでなくてもよい。順につながっていることは確かめる）
    #    1つだけのとき（「ア 75°」）も、答えがラベル＋数だけで説明しきれるときは割る
    for marks in (KATA, HIRA, KMARU):
        for single in (False, True):
            parts = B.split_by_marks(a, marks, from_zero=False, allow_single=single)
            if not parts or len({c for c, _ in parts}) != len(parts):
                continue
            if single and len(parts) == 1 and not a.startswith(parts[0][0]):
                continue
            st = _labeled_steps(parts, q, meaning, True)
            if st:
                return st
    return None


def _covers(a, ms):
    """拾ったラベルと値で、答えの文字がだいたい全部説明できているか（拾いのこしがないか）。
       『角ア＝60°』の『角』のような、ラベルの前に付くことばは1文字までみとめる。"""
    pos, rest = 0, ""
    for m in ms:
        rest += a[pos:m.start()]
        pos = m.end()
    rest += a[pos:]
    rest = re.sub(r"[\s、，,・／/（）()＝=角]", "", rest)
    return len(rest) <= 2


# ── 日づけ・時こく ──────────────────────────────────────────────
DATE3 = re.compile(r"^(\d+)年(\d+)月(\d+)日$")
DATE2 = re.compile(r"^(\d+)月(\d+)日$")
DATE2W = re.compile(r"^(\d+)月(\d+)日[\s，,、]*([日月火水木金土]曜日)$")
TIME12 = re.compile(r"^(午前|午後)(\d+)時(\d+)分$")
TIME2 = re.compile(r"^(\d+)時(\d+)分$")
HMS = re.compile(r"^(\d+)時間(\d+)分(\d+)秒$")
MS = re.compile(r"^(\d+)分(\d+)秒$")


def by_datetime(q, a, meaning):
    m = DATE2W.match(a)
    if m:
        return [_mk("%s　何月ですか。" % q, m.group(1), meaning),
                _mk("%s　何日ですか。" % q, m.group(2), meaning),
                _mk("%s　何曜日ですか。" % q, m.group(3), meaning, list(WEEK))]
    m = DATE3.match(a)
    if m:
        return [_mk("%s　何年ですか。" % q, m.group(1), meaning),
                _mk("%s　何月ですか。" % q, m.group(2), meaning),
                _mk("%s　何日ですか。" % q, m.group(3), meaning)]
    m = DATE2.match(a)
    if m:
        return [_mk("%s　何月ですか。" % q, m.group(1), meaning),
                _mk("%s　何日ですか。" % q, m.group(2), meaning)]
    m = TIME12.match(a)
    if m:
        return [_mk("%s　午前と午後のどちらですか。" % q, m.group(1), meaning, list(GOZEN)),
                _mk("%s　何時ですか。" % q, m.group(2), meaning),
                _mk("%s　何分ですか。" % q, m.group(3), meaning)]
    m = TIME2.match(a)
    if m:
        return [_mk("%s　何時ですか。" % q, m.group(1), meaning),
                _mk("%s　何分ですか。" % q, m.group(2), meaning)]
    m = HMS.match(a)
    if m:
        return [_mk("%s　何時間ですか。" % q, m.group(1), meaning),
                _mk("%s　あと何分ですか。" % q, m.group(2), meaning),
                _mk("%s　あと何秒ですか。" % q, m.group(3), meaning)]
    m = MS.match(a)
    if m:
        return [_mk("%s　何分ですか。" % q, m.group(1), meaning),
                _mk("%s　あと何秒ですか。" % q, m.group(2), meaning)]
    return None


# ── （ ）が2つ以上ある穴うめで、答えが「正三角形，60」のように並ぶ ────────
def by_blanks(q, a, meaning, stem):
    nb = q.count("（ ）") + q.count("( )")
    if nb == 0:
        nb = stem.count("（ ）") + stem.count("( )")
    vals = [x.strip() for x in re.split(r"[、,，]", a) if x.strip()]
    if nb < 2 or nb != len(vals):
        return None
    out = []
    for i, v in enumerate(vals):
        nv = B.to_numpad2(v)
        if nv is not None:
            out.append(_mk("%s　%dつめの（ ）にあてはまる数を答えなさい。" % (q, i + 1), nv, meaning))
            continue
        wc = word_choices(v)
        if wc:
            out.append(_mk("%s　%dつめの（ ）にあてはまることばを答えなさい。" % (q, i + 1),
                           v, meaning, wc))
            continue
        return None
    return out


def steps_for(qtext, atext, meaning, stem=""):
    base = B.steps_for(qtext, atext, meaning, stem)
    if base is not None:
        return base
    a = B.norm(atext).strip().strip("。 　")
    q = qtext.strip()
    from g4b2_manual2 import ALIAS
    a = ALIAS.get(a, a)          # 4択の見た目で答えが読めてしまう書き方をそろえる
    wc = word_choices(a)
    if wc:
        qq = q + KUWASHII if needs_kuwashii(wc) else q
        return [_mk(qq, a, meaning, wc)]
    for fn in (by_datetime, by_label):
        r = fn(q, a, meaning)
        if r:
            return r
    return by_blanks(q, a, meaning, stem)


# ── レコード1本まるごとを別の作り方で組む差しこみ（g4b1_add_daimon.PRE_HOOK） ──
BRACKET_BLANK = re.compile(r"\[\(([^()\[\]]{1,3})\)\]")


def _label_pairs(a):
    """答え全体が『角ア＝60°…』『(ア) 13 (イ) 25…』『ア 135° イ 75°…』のように、
       ラベル付きでぜんぶ説明できているとき、[(ラベル, 値), …] を返す。"""
    for pat in (LBL_EQ, PAREN_LBL):
        ms = list(pat.finditer(a))
        if len(ms) >= 2 and _covers(a, ms):
            hits = [(m.group(1), m.group(2).strip()) for m in ms]
            if len({l for l, _ in hits}) == len(hits):
                return hits
    for marks in (KATA, HIRA, KMARU):
        parts = B.split_by_marks(a, marks, from_zero=False, allow_single=False)
        if parts and len({c for c, _ in parts}) == len(parts)                 and all(B.to_numpad2(v) is not None or word_choices(v) for _, v in parts):
            return list(parts)
    return None


def pre_hook(hg, title, p, bone_map):
    """『答えがラベル付きで、そのラベルが設問の中に書いてある』大問を、ラベル1つ＝1問に割る。

    原簿の側は ①②… で区切られていても、穴の名前（ア・イ…）は①の中に何個も入っている。
    そのままだと①の数と答えの数が合わないので、ここで穴ごとに組み直す。
    設問文は原簿のまま。変えるのは [(ア)] を （ア） と書くところだけ（画面で読める形にする）。
    """
    import g4b1_add_daimon as A
    pairs = _label_pairs(p["ans_text"])
    if not pairs:
        return None
    bone = A.clean_meaning(bone_map.get(hg, ""), bone_map)
    labs = [l for l, _ in pairs]

    def mean_for(lab):
        """その穴のぶんの解法だけを取り出す（次の穴の答えを先に見せない）。"""
        seg = kaihou_for_label(p["kaihou"], lab, labs)
        seg = A.clean_meaning(seg, bone_map) if seg else ""
        return A.join_mean(bone, seg) if seg else bone
    qp = p["qparts"]

    def show(s):
        return BRACKET_BLANK.sub(r"□（\1）", s).strip()

    # ① 設問が1つのかたまり＝そのまま穴ごとに割る
    if list(qp) == [0]:
        out = []
        for lab, val in pairs:
            sub = _labeled_steps([(lab, val)], show(p["setmon"]), mean_for(lab), True)
            if not sub:
                return None
            out.extend(sub)
        return dict(steps=out)

    # ② 設問が①②…に分かれている＝ラベルがどの①に入っているかで割りふる
    where = {}
    for lab, _ in pairs:
        owners = [k for k in qp if lab in qp[k]]
        if len(owners) != 1:
            return None
        where[lab] = owners[0]
    stem = A.stem_of(p["setmon"], qp)
    out = []
    for lab, val in pairs:
        k = where[lab]
        qt = "%s %s" % (MARU[k - 1], show(qp[k])) if k else show(qp[k])
        sub = _labeled_steps([(lab, val)], qt, mean_for(lab), True)
        if not sub:
            return None
        out.extend(sub)
    return dict(steps=out, intro=(p["intro"] + ("　" if p["intro"] and stem else "") + stem).strip())


# ── 1レコードに図SVGが2枚あるときは、1枚にたたんで返す ──────────────
# （sync_genbo_svg.py も アプリ も「1レコード1枚」しか持てない。
#   HG-5065 は 本体の図＋選択肢ア〜エの図 の2枚が原簿にある）
SVG_FIELD = re.compile(r"^- 図SVG[^:\n]*: (.+)$", re.M)
VIEWBOX = re.compile(r'viewBox="([\d.\- ]+)"')


def merge_svgs(rec):
    svgs = [v.strip().strip("`") for v in SVG_FIELD.findall(rec)]
    svgs = [v for v in svgs if v.startswith("<svg")]
    if len(svgs) < 2:
        return None
    parts, y, w = [], 0, 0
    for sv in svgs:
        m = VIEWBOX.search(sv)
        if not m:
            return None
        _, _, ww, hh = [float(x) for x in m.group(1).split()]
        inner = re.sub(r"^<svg[^>]*>", "", sv)
        inner = re.sub(r"</svg>\s*$", "", inner)
        parts.append('<g transform="translate(0,%g)">%s</g>' % (y, inner))
        y += hh + 12
        w = max(w, ww)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" '
            'width="%g" height="%g" style="display:block;margin:0 auto;max-width:100%%">%s</svg>'
            % (w, y - 12, w, y - 12, "".join(parts)))


# ── ①②… の拾い方を「順ぐりにさがす」方式に変える ────────────────────
# もとの split_marked は、同じ番号が2回出たらそこで打ち切っていた。
# ところが第2分冊には「①（…内側の三角形の頂角が①）」のように、
# **小問の中にその小問の番号がもう一度出てくる**書き方がある（HG-5014・HG-5441 など）。
# 打ち切ると小問に割れず、全部の step に全小問の文がくっついてしまう。
# → ①を見つけたら、そのうしろから②をさがす。というふうに順ぐりにたどる。
# 小問の頭になれる位置か（「ア〜キ」「つぎの①長方形」のような、文の中での言及を外す）
_BEFORE_OK = set(" 　\n（(。、，／/：:「[")
_AFTER_NG = set("～~・，、,でのとや）)]」")


def _item_start(s, i):
    if i > 0 and s[i - 1] not in _BEFORE_OK:
        return False
    j = i + 1
    if j < len(s) and s[j] in _AFTER_NG:
        return False
    return True


def _scan_from(s, marks, start):
    """start にある①から順ぐりに②③…をさがして、区切り位置の一覧を返す。"""
    spans, pos = [(1, start)], start + 1
    for k in range(1, len(marks)):
        i = s.find(marks[k], pos)
        if i < 0:
            break
        spans.append((k + 1, i))
        pos = i + 1
    return spans


def split_marked_seq(s, marks):
    """①②… で小問に割る。第1分冊のやり方（同じ番号が2回出たら打ち切り）だと、
       第2分冊の2つの書き方でこわれる。
         ・小問の文の中にその番号がもう一度出てくる（HG-5014「頂角が①」）
         ・指示文の中で番号に言及する（HG-5285「つぎの①長方形②正三角形のような…」）
       そこで **①が出てくる場所を順に全部ためして、いちばん行きわたる割り方を選ぶ**。
       （指示文の中の①は、そこで割ると片方が数文字しか残らないので落ちる）"""
    best = None
    at = s.find(marks[0])
    while at >= 0:
        if not _item_start(s, at):
            at = s.find(marks[0], at + 1)
            continue
        spans = _scan_from(s, marks, at)
        if len(spans) >= 2:
            out = {}
            for n, (num, i) in enumerate(spans):
                end = spans[n + 1][1] if n + 1 < len(spans) else len(s)
                out[num] = s[i + 1:end].strip(" 　、，,／/・")
            if all(out.values()):
                # 小問の中に「ほかの小問の番号」が混じっている割り方は、たいてい
                # 指示文の中の番号（「ただし，①③は長方形とします」）で切ってしまっている
                used = [marks[n] for n in range(len(out))]
                dirty = sum(1 for v in out.values() if any(c in v for c in used))
                score = (len(out), -dirty, min(len(v) for v in out.values()))
                if best is None or score > best[0]:
                    best = (score, out)
        at = s.find(marks[0], at + 1)
    return best[1] if best else {0: s.strip()}


def stem_seq(setmon, qp):
    """①②に割ったとき、①より前にある「共通の指示文」を取り出す。
       ①が文中にも出てくることがあるので、実際に採った①の位置から前を取る。"""
    ks = sorted(k for k in qp if k)
    if not ks or not qp.get(ks[0]):
        return ""
    for marks in (MARU, KATA):
        ch = marks[ks[0] - 1]
        i = setmon.find(qp[ks[0]])
        while i > 0:
            j = i - 1
            while j > 0 and setmon[j].isspace():     # 小問の頭は空白を落としてある
                j -= 1
            if setmon[j] == ch:
                return setmon[:j].strip()
            i = setmon.find(qp[ks[0]], i + 1)
    return ""


def kaihou_part_seq(kaihou, mark):
    """解法から『① …』の一節を取り出す。次の番号（自分より後の番号）までで切る。
       自分の番号が同じ節の中にもう一度出てきても切らない。"""
    marks = MARU + KMARU
    if mark not in marks:
        return None
    i = kaihou.find(mark)
    if i < 0:
        return None
    j = len(kaihou)
    for ch in marks[marks.index(mark) + 1:]:
        k = kaihou.find(ch, i + 1)
        if k > i:
            j = min(j, k)
    return kaihou[i + 1:j].strip(" 　、。")


CLAUSE = re.compile(r"(?<=[。、／・　])")


def kaihou_for_label(kaihou, lab, all_labels):
    """解法から、その穴について書いてある文だけを取り出す。

    ★文の途中では切らない。ラベルが1文字（あ・い・ア…）だと、
      「隣り合わない」の「い」のような**ふつうのことばの中の1文字**で切ってしまい、
      文が壊れる（塾講師の監査で HG-5004・HG-4952 が出た）。
      そこで **文（。、／・）の単位で残すか捨てるか**を決める。
    """
    if not kaihou or lab not in kaihou:
        return None
    others = [x for x in all_labels if x != lab]
    keep = []
    for cl in CLAUSE.split(kaihou):
        if lab in cl:
            keep.append(cl)
        elif any(o in cl for o in others):
            continue
        else:
            keep.append(cl)
    seg = "".join(keep).strip(" 　、。／")
    if lab not in seg or len(seg) < len(lab) + 3:
        return None
    return seg
