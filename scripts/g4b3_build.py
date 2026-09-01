# -*- coding: utf-8 -*-
"""第3分冊で新しく出てくる「答えの書き方」を、テンキーか4択で答えられる形にする。

★ここでやるのは答え方の様式だけ（feedback_genbo_dori）。問うている中身は変えない。
★choices の要素と answer は一字一句そろえる（feedback_answerable_format）。

第1分冊（g4b1_build）→第2分冊（g4b2_build）に足す形で、第3分冊で出た書き方だけを扱う。
"""
import os
import re
import sys
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import g4b1_build as B      # noqa: E402
import g4b2_build as BB     # noqa: E402

MARU = B.MARU
KMARU = B.KMARU

# ── 第3分冊で出てくる単位（立体の体積・容積、こ数の言い方） ──────────────
EXTRA_UNITS = ["cm³", "m³", "mm³", "km³", "cm3", "m3", "cc",
               "つ", "題", "へや", "きゃく", "はこ", "ぱい", "きれ", "束",
               "ふくろ", "こずつ", "オンス"]

# ── 答えが決まった言葉になるなかま ──────────────────────────────
RITTAI_BUI = ["頂点", "辺", "面"]           # 立体の部分の名前
DAISHO = ["大", "小", "同"]                 # A とくらべて 大／小／同
RITTAI_MEI = ["立方体", "直方体", "三角柱", "四角柱", "五角柱", "六角柱", "円柱"]

for _s in (RITTAI_BUI, DAISHO, RITTAI_MEI):
    if _s not in BB.WORD_SETS:
        BB.WORD_SETS.append(_s)


# ── 答えの前そうじ ────────────────────────────────────────────
def clean_ans(a):
    """原簿の書き方の飾り（**強調・／の区切り・全角空白）を落とす。中身は変えない。"""
    if a is None:
        return None
    a = a.replace("**", "").replace("　", " ")
    a = a.strip().strip("／/・、， \t")
    return a.strip()


_orig_numpad2 = B.to_numpad2


def to_numpad3(a):
    """to_numpad2 に、第3分冊の飾り（** と ／）の そうじを足したもの。"""
    if a is None:
        return None
    return _orig_numpad2(clean_ans(a))


# ── 分数の並び ────────────────────────────────────────────────
FRAC = re.compile(r"^\d+(?:と\d+/\d+|/\d+)$")
PAREN_LIST = re.compile(r"^[（(]\s*(.+?)\s*[）)]$")


def _fracs(a):
    """「(15/40, 28/40)」「5/24, 7/24」→ ['15/40','28/40']。分数以外が混じればNone。"""
    m = PAREN_LIST.match(a)
    if m:
        a = m.group(1)
    vals = [x.strip() for x in re.split(r"[、,，]", a) if x.strip()]
    if len(vals) < 2 or not all(FRAC.match(v) for v in vals):
        return None
    return vals


def by_frac_list(q, a, meaning, stem=""):
    """答えが分数の並びのとき。
       ・通分（設問の分数と1対1に対応する）… 「1つめの分数」で聞く
       ・すべて求めなさい（順番は問われていない）… 小さい方からならべて聞く
    """
    vals = _fracs(a)
    if not vals:
        return None
    full = (stem + " " + q)
    if re.search(r"通分", full):
        return [BB._mk("%s　%dつめの分数を答えなさい。" % (q, i + 1), v, meaning)
                for i, v in enumerate(vals)]
    if re.search(r"(すべて|全部|みんな)", full):
        order = sorted(vals, key=lambda v: Fraction(v))
        return [BB._mk("%s　小さい方から%d番目の分数を答えなさい。" % (q, i + 1), v, meaning)
                for i, v in enumerate(order)]
    return None


# ── ラベル＋数値＋単位 がならぶ答え ─────────────────────────────
def _unit_tail(v):
    for u in sorted(B.UNITS, key=len, reverse=True):
        if v.endswith(u):
            return u
    return ""


TOKEN = re.compile(r"^(.*?)(\d+(?:\.\d+)?(?:と\d+/\d+)?|\d+/\d+)\s*([^\d]*)$")


def _token(t):
    """「羊78頭」→('羊','78','頭')。「8へや」→('','8','へや')。読めなければNone。"""
    m = TOKEN.match(t.strip())
    if not m:
        return None
    lab, num, unit = m.group(1).strip(), m.group(2), m.group(3).strip()
    if unit and unit not in B.UNITS:
        return None
    # ★ラベルのおしりが単位で終わっていたら、そのラベルは数量の一部を飲みこんでいる。
    #   「昼12時間40分」をラベル"昼12時間"＋40分と読むと、
    #   設問が「昼12時間は何分ですか」になって答えを先に見せてしまう
    #   （2026-09-01・HG-6272で発覚）
    if lab and re.search(r"\d", lab) and _unit_tail(lab):
        return None
    return lab, num, unit


def by_unit_list(q, a, meaning):
    """『羊78頭 馬44頭 牛24頭』『8へや 51人』『ノート80円』のように、
       値＋単位（＋ラベル）がならぶ答えを、1つずつの問いに割る。"""
    toks = [x for x in re.split(r"[、,，・]|\s+", a) if x.strip()]
    if not toks:
        return None
    parsed = [_token(t) for t in toks]
    if any(p is None for p in parsed):
        return None
    labs = [p[0] for p in parsed]
    units = [p[2] for p in parsed]
    if not all(units) and not all(labs):
        return None
    if len(parsed) == 1:
        lab, num, unit = parsed[0]
        # 「ノート80円」のように、ラベルが設問にすでに書いてある＝数だけ答えればよい
        if lab and lab in q:
            return [BB._mk(q, num, meaning)]
        return None
    if len(set(labs)) == len(labs) and all(labs):
        return [BB._mk("%s　%sは何%sですか。" % (q, lab, unit) if unit
                       else "%s　%sはいくつですか。" % (q, lab), num, meaning)
                for lab, num, unit in parsed]
    if len(set(units)) == len(units):
        return [BB._mk("%s　何%sですか。" % (q, unit), num, meaning)
                for lab, num, unit in parsed]
    return None


# ── 「午前10時」のように分のない時こく ──────────────────────────
HOUR12 = re.compile(r"^(午前|午後)(\d+)時$")


def by_hour(q, a, meaning):
    m = HOUR12.match(a)
    if not m:
        return None
    return [BB._mk("%s　午前と午後のどちらですか。" % q, m.group(1), meaning, list(BB.GOZEN)),
            BB._mk("%s　何時ですか。" % q, m.group(2), meaning)]


# ── 「13こできて0.3Lあまる」 ────────────────────────────────────
DEKITE = re.compile(r"^(\d+(?:\.\d+)?)([^\d]+?)できて\s*(\d+(?:\.\d+)?)([^\d]+?)"
                    r"(?:あまる|余る|あまります)$")


def by_dekite(q, a, meaning):
    m = DEKITE.match(a)
    if not m:
        return None
    return [BB._mk("%s　何%sできますか。" % (q, m.group(2)), m.group(1), meaning),
            BB._mk("%s　何%sあまりますか。" % (q, m.group(4)), m.group(3), meaning)]


# ── ①③④ のように丸数字をえらぶ答え ───────────────────────────
MARU_RANGE = re.compile(r"([①-⑳])\s*[〜～~\-]\s*([①-⑳])")


def maru_choices(a, setmon):
    """答えが『③』のとき、設問に出てくる丸数字ぜんぶを選択肢にする。
       ★『①〜⑥』のような書き方は、間の番号もぜんぶ選択肢に入れる
         （ここを落とすと、正解が選択肢に無い＝ぜったいに正解できない問題になる）。
       組み合わせ（『①，③，④』）を答えるものは自動では作らない
       （まぎらわしいダミーの作り方が決まらないので、手作業へまわす）。"""
    a = a.strip()
    if len(a) != 1 or a not in MARU:
        return None
    have = set(c for c in MARU if c in setmon)
    for m in MARU_RANGE.finditer(setmon):
        i, j = MARU.index(m.group(1)), MARU.index(m.group(2))
        if i < j:
            have.update(MARU[i:j + 1])
    have = [c for c in MARU if c in have]
    if len(have) < 2 or a not in have:
        return None
    return have


# ── 練習問題の番号（1-1 / 2-1① …）で答えが割れているもの ────────────
RENSHU = re.compile(r"(?:(?<=^)|(?<=[\s　]))(\d+-\d+)([①-⑳])?(?=[\s　])")


def split_renshu(s):
    """『1-1 …　1-2 …』→ {'1-1': '…', '1-2': '…'}。番号が2つ未満ならNone。"""
    ms = list(RENSHU.finditer(s))
    if len(ms) < 2:
        return None
    out = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(s)
        key = m.group(1) + (m.group(2) or "")
        out.append((key, s[m.end():end].strip(" 　、，,")))
    # 「4-1① 80円 ② 50円」のように、2つめから番号（4-1）が省かれている書き方をもどす
    spread = []
    for key, val in out:
        if key[-1] in MARU:
            base = key[:-1]
            parts = BB.split_marked_seq(" " + MARU[MARU.index(key[-1])] + " " + val, MARU)
            if len(parts) > 1 and 0 not in parts:
                for k in sorted(parts):
                    spread.append((base + MARU[k - 1], parts[k]))
                continue
        spread.append((key, val))
    out = spread
    if len({k for k, _ in out}) != len(out) or any(not v for _, v in out):
        return None
    return out


def renshu_hook(hg, title, p, bone_map):
    """設問も答えも『1-1 / 1-2 / 2-1①』の番号で分かれている大問を、番号ごとの1問に割る。"""
    import g4b1_add_daimon as A
    apairs = split_renshu(" " + p["ans_text"] + " ")
    if not apairs:
        return None
    qpairs = split_renshu(" " + p["setmon"] + " ")
    if not qpairs:
        return None
    qmap = dict(qpairs)
    bone = A.clean_meaning(bone_map.get(hg, ""), bone_map)
    kaihou = A.clean_meaning(p["kaihou"], bone_map)
    steps = []
    for key, aval in apairs:
        base, sub = (key[:-1], key[-1]) if key[-1] in MARU else (key, "")
        qt = qmap.get(key) or qmap.get(base)
        if qt is None:
            return None
        if sub:
            # 「2-1 つぎのとき…　① …　② …」を ① ごとに分ける。
            # ★共通の指示文は「いちばん最初の①より前」。②のときに①の本文まで
            #   くっつけないよう、必ず先頭の小問の位置で切る（そうしないと
            #   ②の設問に①の問題文がまるごと入り、答えがどちらのものか分からなくなる）
            parts = BB.split_marked_seq(qt, MARU)
            k = MARU.index(sub) + 1
            if k not in parts:
                return None
            first = min(x for x in parts if x)
            cut = qt.find(parts[first])
            head = qt[:cut].rstrip(" 　" + chr(10) + MARU).strip() if cut > 0 else ""
            qt = ("%s %s %s" % (head, sub, parts[k])).strip()
        sub_steps = steps_for(qt.strip(), aval, A.join_mean(bone, kaihou), p["setmon"])
        if sub_steps is None:
            return None
        steps.extend(sub_steps)
    return dict(steps=steps, intro=p["intro"])


def pre_hook(hg, title, p, bone_map):
    r = renshu_hook(hg, title, p, bone_map)
    if r:
        return r
    return BB.pre_hook(hg, title, p, bone_map)


# ── 入り口 ────────────────────────────────────────────────────
WRAP = re.compile(r"^[（(]\s*(.+?)\s*[）)]$")


def steps_for(qtext, atext, meaning, stem=""):
    a0 = B.norm(atext).strip()
    mw = WRAP.match(a0)
    if mw and re.search(r"(順|ならべ)", (stem or "") + qtext)             and re.search(r"[、,，]", mw.group(1)):
        r = BB.steps_for(qtext, mw.group(1), meaning, stem)
        if r:
            return r
    base = BB.steps_for(qtext, atext, meaning, stem)
    if base is not None:
        return base
    a = clean_ans(B.norm(atext))
    q = qtext.strip()
    if not a:
        return None
    # そうじしてから、もう一度 第1・2分冊のやり方をためす（** や ／ が付いていただけのもの）
    if a != atext.strip():
        base = BB.steps_for(q, a, meaning, stem)
        if base is not None:
            return base
    mc = maru_choices(a, stem or q)
    if mc:
        return [BB._mk(q, a.strip(), meaning, mc)]
    for fn in (by_hour, by_dekite, by_unit_list):
        r = fn(q, a, meaning)
        if r:
            return r
    return by_frac_list(q, a, meaning, stem)


# ── 第3分冊むけの仕上げ（g4b2_polish のあとに当てる） ─────────────────
# 第3分冊の原簿は「骨」が必ず『単元名／要点』の形で書かれているので、
# そのまま解説にすると 83% が「立体図形／…」「分数／…」で始まってしまう
# （第1分冊は4%・第2分冊は12%）。単元名は画面の別のところに出ているので落とす。
TOPIC_TAG = re.compile(r"^([^。／\s]{2,14})／")

# 制作側の言い方を、子どもの言葉に置きかえる（骨・衣装・灘度は clean_meaning が処理ずみ）
WORD_FIX = [
    # 「テーマ1の型を「面積」…に場面替えする。」→「テーマ1の考え方を…にあてはめたものです。」
    ("に場面替えする", "にあてはめたものです"),
    ("に場面替え", "にあてはめたものです"),
    ("場面替えする", "べつの場面にあてはめます"),
    ("場面替え", "べつの場面にあてはめたもの"),
    # 「型」は制作側の言い方。子どもには「考え方」で通じる
    # 「型」の直しは fix_kata() でやる（前の字で「の」を入れるか決める）
    ("の裏返し", "の逆"),
    # 「反復」は制作側の言い方。子どもには「くりかえし」で通じる
    ("反復する", "くりかえします"),
    ("の反復。", "のくりかえしです。"),
    ("の反復", "のくりかえし"),
]


KYOZAI_NAME = [
    (re.compile(r"テーマ\d+と同じ"), "はじめの例題と同じ"),
    (re.compile(r"テーマ\d+の"), "例題の"),
    (re.compile(r"テーマ\d+"), "例題"),
    (re.compile(r"[BC]問題\d+と同じ"), "前の問題と同じ"),
    (re.compile(r"[BC]問題\d+"), "前の問題"),
    (re.compile(r"(?<![\w])B\d+と同じ"), "前の問題と同じ"),
    (re.compile(r"練習\d+-\d+"), "前の練習問題"),
    (re.compile(r"練習問題\d+"), "前の練習問題"),
]


# 動詞の言い切り（う段）で終わっていれば「の」を入れない：
#   「縮まっていく型」→「縮まっていく考え方」／「おきかえ型」→「おきかえの考え方」
UDAN = "うくぐすつぬぶむる"
KATA = re.compile(r"(.)型")


def fix_kata(m):
    def rep(mo):
        c = mo.group(1)
        if c == "の":
            return "の考え方"
        return c + ("考え方" if c in UDAN else "の考え方")
    return KATA.sub(rep, m)


# 教材の中でしか通じない呼び名。アプリは大問を1本ずつ出すので、指す先が画面に無い。
# 置きかえるのではなく、参照そのものを落として「考え方の中身」だけ残す
KYOZAI2 = [
    (re.compile(r"（テーマ[\d・]+[^）]*?(?:と同じ|の応用|の発展)[^）]*）"), ""),
    (re.compile(r"テーマ[\d・]+と同じ"), "同じ"),
    (re.compile(r"テーマ[\d・]+の考え方を"), "同じ考え方を"),
    (re.compile(r"テーマ[\d・]+の"), ""),
    (re.compile(r"テーマ[\d・]+"), ""),
    (re.compile(r"[BC]問題[\d・]+と同じ"), "前の問題と同じ"),
    (re.compile(r"[BC]問題[\d・]+の"), "前の問題の"),
    (re.compile(r"[BC]問題[\d・]+"), "前の問題"),
    (re.compile(r"(?<![A-Za-z\d])[BC]\d+(?:・[BC]?\d+)*と同じ"), "前の問題と同じ"),
    (re.compile(r"(?<![A-Za-z\d])[BC]\d+(?:・[BC]?\d+)*"), "前の問題"),
    (re.compile(r"練習問題?[\d]+(?:-\d+)?"), "前の練習問題"),
    # 比・割合は小5の道具（feedback_hamagakuen_curriculum）
    (re.compile(r"比の1にあたる"), "①（1こ分）にあたる"),
    (re.compile(r"比に分ける"), "同じ大きさのいくつ分かに分ける"),
    (re.compile(r"比の関係で表す"), "こ数の関係で表す"),
    (re.compile(r"比の関係"), "こ数の関係"),
    (re.compile(r"比だけで"), "こ数だけで"),
    (re.compile(r"逆比"), "さかさまの関係"),
]


def drop_kyozai_names(m):
    m = fix_kata(m)
    for pat, rep in KYOZAI2:
        m = pat.sub(rep, m)
    m = re.sub(r"（\s*）|　{2,}", "　", m)
    m = re.sub("[" + chr(10) + r"]\s*。", "", m)          # 改行のあとに句点だけ残る切りはし
    return m.strip("　 、")
    return m


def polish3(spec, hg=""):
    """解説から単元タグの見出しと制作側の言い方を落とし、監査で出た直しを当てる。"""
    import g4b3_manual2 as M2
    if hg in M2.INTRO_FIX:
        spec["intro"] = M2.INTRO_FIX[hg]
    for old, new in M2.TEXT_FIX.get(hg, []):
        if spec.get("intro"):
            spec["intro"] = spec["intro"].replace(old, new)
        for st in spec["steps"]:
            st["question"] = st["question"].replace(old, new)
    for st in spec["steps"]:
        m = st.get("meaning", "")
        if not m:
            continue
        for a, b in M2.MEAN_FIX.get(hg, []):
            m = m.replace(a, b)
        for cut in M2.MEAN_CUT.get(hg, []):
            m = m.replace(cut, "")
        t = TOPIC_TAG.match(m)
        if t and len(m) - t.end() >= 5:
            m = m[t.end():].lstrip("　 ")
        for a, b in WORD_FIX:
            m = m.replace(a, b)
        m = drop_kyozai_names(m)
        st["meaning"] = m.replace("　　", "　").strip("　 ")
    if hg in getattr(M2, "TITLE_FIX", {}):
        spec["title"] = M2.TITLE_FIX[hg]
    for k, v in M2.MEAN_STEP.get(hg, {}).items():
        if k <= len(spec["steps"]):
            spec["steps"][k - 1]["meaning"] = v
    for st in spec["steps"]:
        if "すべて" in st["question"] or "全部" in st["question"]:
            st["question"] = st["question"].replace(
                "。　小さい方から", "。　そのうち、小さい方から")
    # ★切りつめはしない（式が消えるほうが害が大きい）。先の答えが見えるのは個別に手で直す
    add_frac_reason(spec)
    add_kakewari_reason(spec)
    fix_title(spec)
    return spec


# ── 解説の直し（塾講師エージェントの監査で出たぶん・2026-09-01） ────────────
# 「。」「全角空白」「改行」のほか、練習問題の番号（1-1 / 2-1① …）の前でも切る。
# ここを切らないと、1-1の解説の中に1-2・1-3の答えが丸ごと残る
# 「。」「全角空白」「改行」のほか、練習問題の番号（1-1 / 2-1① …）の前でも切る。
# ここを切らないと、1-1の解説の中に1-2・1-3の答えが丸ごと残る
CLAUSE3 = re.compile("(?<=[。　\n])|(?=\s\d+-\d+[①-⑳]?\s)")


def _num_in(a, text):
    """答え a が「数として」text に出てくるか。24 の中の 4 は数えない。"""
    if not a:
        return False
    return re.search(r"(?<![\d.,/])%s(?![\d.,/])" % re.escape(a), text) is not None


def cut_later_answers(spec):
    """1つの小問を何問かに割ったとき、解説が全部の答えを並べたままになっていると、
       1問目に答えた時点で残りがタダになる。自分より後の答えが入っている文を落とす。
       （落としすぎて解説が消えるなら、もとのままにする）"""
    steps = spec["steps"]
    for i, st in enumerate(steps):
        m = st.get("meaning", "")
        a = st["answer"]
        later = [t["answer"] for t in steps[i + 1:] if t["answer"] != a]
        if not m or not later or not any(_num_in(x, m) for x in later):
            continue
        cls = CLAUSE3.split(m)
        # 自分の答えが出てくる文までを残し、そこで止める（式の途中を消さない）
        hit = next((k for k, cl in enumerate(cls) if _num_in(a, cl)), None)
        if hit is None:
            continue
        t = "".join(cls[:hit + 1]).strip("　 、。／")
        if len(t) >= 12 and len(t) < len(m) and not any(_num_in(x, t) for x in later):
            st["meaning"] = t if t.endswith("。") else t + "。"


FRAC1 = re.compile(r"(?<![\d/])(\d+)/(\d+)(?![\d/])")
TSUME = re.compile(r"[（(]([^（）()]*?/[^（）()]*?)[）)]\s*(\d+)つめの分数")


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def add_frac_reason(spec, intro=""):
    """約分・通分の小問で、解説が『骨』の一文だけ（計算が1つも書いていない）ものに、
       その問題の数で1行だけ足す。**解説の無い問題は本番に出さない**（feedback_read_memory_first）。"""
    for st in spec["steps"]:
        q, a, m = st["question"], st["answer"], st.get("meaning", "")
        am = FRAC1.search(a)
        if not am or re.search(r"\d", m.split("　")[-1]) and a in m:
            continue
        if re.search(r"最小公倍数は|最大公約数は|の分母と分子に", m):
            continue          # すでに同じ説明が書いてある
        m = re.sub(r"[　\s]*\d+でわる(（[^）]*）)?[。]?", "", m)   # 「12でわる。」の断片は言いかえる
        c, dd = int(am.group(1)), int(am.group(2))
        tm = TSUME.search(q)
        if tm:                                   # 通分
            src = FRAC1.findall(tm.group(1))
            k = int(tm.group(2)) - 1
            if k >= len(src):
                continue
            p, qq = int(src[k][0]), int(src[k][1])
            dens = [int(y) for _, y in src]
            lcm = dens[0]
            for x in dens[1:]:
                lcm = lcm * x // _gcd(lcm, x)
            if qq == 0 or dd != lcm or lcm % qq:
                continue
            add = ("%sの最小公倍数は%d。%d/%d の分母と分子に%dをかけて %d/%d。"
                   % ("と".join(str(x) for x in dens), lcm, p, qq, lcm // qq, c, dd))
        else:                                    # 約分
            srcs = FRAC1.findall(q)
            if len(srcs) != 1:
                continue
            p, qq = int(srcs[0][0]), int(srcs[0][1])
            g = _gcd(p, qq)
            if g <= 1 or p // g != c or qq // g != dd:
                continue
            add = ("%dと%dの最大公約数は%d。分母と分子を%dでわって %d/%d。"
                   % (p, qq, g, g, c, dd))
        st["meaning"] = (m.rstrip("　 ") + "　" + add).strip() if m else add


TITLE_N = re.compile(r"[・、]\d+問\s*$")


def fix_title(spec):
    """タイトルの「・N問」を落とす。原簿の見出しの書き方で、子どもには要らないうえ、
       アプリは小問に割り直すので数が合わないことが多い。制作側の言い方もここで直す。"""
    t = TITLE_N.sub("", spec.get("title", "")).strip()
    for a, b in WORD_FIX:
        t = t.replace(a, b)
    t = drop_kyozai_names(t)
    t = t.replace("衣装替え", "場面をかえたもの").replace("衣装", "場面")
    spec["title"] = t


# ── 分数のかけ算・わり算の解説を、その式から作る ─────────────────────
NUMT = r"(?:\d+と\d+/\d+|\d+/\d+|\d+)"
EXPR = re.compile(r"(%s)\s*([×÷])\s*(%s)\s*$" % (NUMT, NUMT))


def _frac(t):
    m = re.fullmatch(r"(\d+)と(\d+)/(\d+)", t)
    if m:
        a, b, c = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return Fraction(a * c + b, c)
    m = re.fullmatch(r"(\d+)/(\d+)", t)
    if m:
        return Fraction(int(m.group(1)), int(m.group(2)))
    return Fraction(int(t)) if t.isdigit() else None


def _val(a):
    """答えの文字列（帯分数も）を分数にする。"""
    return _frac(a) if re.fullmatch(r"\d+(?:と\d+/\d+|/\d+)?", a) else None


def _raw_product(xs, op, ys):
    """約分・帯分数になおす前の形（15/30 など）を返す。整数どうしなどはNone。"""
    def parts(t):
        m = re.fullmatch(r"(\d+)と(\d+)/(\d+)", t)
        if m:
            a, b, c = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return a * c + b, c
        m = re.fullmatch(r"(\d+)/(\d+)", t)
        if m:
            return int(m.group(1)), int(m.group(2))
        return (int(t), 1) if t.isdigit() else (None, None)
    p1, q1 = parts(xs)
    p2, q2 = parts(ys)
    if p1 is None or p2 is None:
        return None
    if op == "×":
        n, d = p1 * p2, q1 * q2
    else:
        n, d = p1 * q2, q1 * p2
    if d in (0, 1):
        return None
    return "%d/%d" % (n, d)


def add_kakewari_reason(spec):
    """「分数×整数の反復。」のように、解説が骨の一文だけで計算が無い
       かけ算・わり算の小問に、その式の解き方を1行足す。"""
    for st in spec["steps"]:
        q, a, m = st["question"], st["answer"], st.get("meaning", "")
        if re.search(r"[＝=]|\d+\s*[×÷]", m):
            continue                      # すでに式が書いてある
        body = re.sub(r"^[\u2460-\u2473]\s*", "", q.split("\u3000")[0]).strip()
        em = EXPR.search(body)
        v = _val(a)
        if not em or v is None:
            continue
        x, op, y = _frac(em.group(1)), em.group(2), _frac(em.group(3))
        if x is None or y is None:
            continue
        got = x * y if op == "×" else (x / y if y else None)
        if got is None or got != v:
            continue                      # 計算が合わない＝式の読みまちがい。足さない
        xs, ys = em.group(1), em.group(3)
        raw = _raw_product(xs, op, ys)
        if op == "×":
            if "/" in xs and "/" not in ys:
                add = "分母はそのままで、分子に%sをかけます。" % ys
            elif "/" not in xs and "/" in ys:
                add = "分母はそのままで、分子に%sをかけます。" % xs
            else:
                add = "分子どうし・分母どうしをかけます。"
        else:
            if "/" in xs and "/" not in ys:
                add = "分数を整数でわるときは、分母にその整数をかけます。"
            else:
                add = "わる数の分母と分子を入れかえて、かけ算にします。"
        if raw and raw != a:
            add += "%s になるので、答えは %s です。" % (raw, a)
        else:
            add += "答えは %s です。" % a
        st["meaning"] = (m.rstrip("\u3000 ") + "\u3000" + add).strip() if m else add
