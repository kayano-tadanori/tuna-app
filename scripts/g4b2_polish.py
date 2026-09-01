# -*- coding: utf-8 -*-
"""組み立てたあとの仕上げ。第2分冊で塾講師の監査に出た読みにくさを直す。

・解説から「ほかの小問について書いた文」を落とす（次の小問の答えを先に見せないため）
・解説から制作側の言いまわし（「前の問題」「この回の…」）を落とす
・①で切ったときに残る、つり合わないとじかっこ・区切りの「／」を落とす
・解法の切れはしが「は…」で始まってしまうのを直す
"""
import re

MARU = "".join(chr(0x2460 + i) for i in range(20))
MARU_RE = re.compile(r"[①-⑳]")
# 「①②は…」のように番号が続いているところは1かたまりとして見る
GROUP_RE = re.compile(r"([①-⑳]+)")


def own_mark(q):
    m = re.match(r"\s*([①-⑳])", q)
    return m.group(1) if m else ""


SENT = re.compile(r"[^。　]*(?:。|　|$)")


def drop_other_marks(mean, mark):
    """解説のうち、「まだ解いていない小問」について述べている所だけを落とす。

    ・落とすのは、その文に出てくる番号が**ぜんぶ自分より後**のときだけ。
      （自分より前の小問への言及は、もう答えを出したあとなので残してよい。
        HG-5614③の「②の1991年1月1日の前日なので」はこれで残る）
    ・文まるごとではなく、その文の中の「番号のかたまり」の所だけを切る。
      （HG-5608 で「③④は2月なので…」を消したとき、うしろに続く①自身の
        計算まで一緒に消えていた）
    """
    if not mean or not mark or not MARU_RE.search(mean):
        return mean
    me = MARU.index(mark)
    out = []
    for sent in SENT.findall(mean):
        if not sent:
            continue
        if not MARU_RE.search(sent):
            out.append(sent)
            continue
        parts = GROUP_RE.split(sent)
        keep = [parts[0]]
        for i in range(1, len(parts), 2):
            grp, body = parts[i], parts[i + 1] if i + 1 < len(parts) else ""
            nums = [MARU.index(c) for c in grp if c in MARU]
            if any(n == me for n in nums):
                keep.append(grp + body)
                continue
            # 自分より前の小問は「②の…の前日なので」のような言及なら残す。
            # 「②5×100」のように式が続くものは、ほかの小問の答えなので落とす
            if all(n < me for n in nums) and body[:1] and not body[0].isdigit() \
                    and body[0] not in "−+＋×÷=＝-":
                keep.append(grp + body)
        seg = "".join(keep).strip("　 、")
        # 消したあとに「①−。」のように式やかっこが宙ぶらりんになるなら、元の文を残す
        if seg != sent.strip("　 、") and (
                seg.rstrip("。　 ").endswith(("−", "+", "＋", "×", "÷", "＝", "=", "「", "（", "、"))
                or seg.count("「") != seg.count("」")
                or ("「" in sent and "「" in seg)):     # かぎかっこの中を削ると意味が変わる
            out.append(sent)
            continue
        if len(seg.strip("　 、。〜~")) >= 3:
            out.append(seg if seg.endswith(("。", "　")) else seg + "。")
    t = "".join(out).strip("　 、。")
    t = _drop_tail_fragment(t)
    return (t + "。" if t and t[-1] not in "。）)" else t) or mean


def _drop_tail_fragment(t):
    """『…うまる。　だが。』のように、番号の文を消したあとに残る短い接続の切れはしを落とす。"""
    while True:
        m = re.search(r"[。　]([^。　]{1,4})$", t)
        if not m or "＝" in m.group(1) or m.group(1).isdigit():
            return t
        t = t[:m.start() + 1].rstrip("　 ")


MEMO = re.compile(r"[^。　]*(?:前の問題|この回|新手|揺さぶり|体にいれる|二段構え)[^。　]*(?:。|$)")


def drop_memo(mean):
    """「前の問題の一段上」「この回の最終問題」のような制作側のメモを落とす。
       （出す順番は変わるので子どもには意味がなく、しかも指す先がずれていた）"""
    if not mean:
        return mean
    t = MEMO.sub("", mean)
    t = re.sub(r"[　 ]{2,}", "　", t).strip("　 、")
    return t or mean


def fix_parens(q):
    """『（① … ④ …）』を①で切ったときに残る、相手のいないかっこを落とす。"""
    q = q.strip()
    while q.count("）") > q.count("（") and q.endswith("）"):
        q = q[:-1].rstrip()
    while q.count(")") > q.count("(") and q.endswith(")"):
        q = q[:-1].rstrip()
    while q.count("（") > q.count("）") and q.endswith("（"):
        q = q[:-1].rstrip()
    while q.count("(") > q.count(")") and q.endswith("("):
        q = q[:-1].rstrip()
    q = re.sub(r"[／/]\s*$", "", q).strip()
    q = re.sub(r"(?:ただし|また)[，、,]?\s*$", "", q).strip()
    return q


# ★「も」は対象から外す。日本語の文は「は・が・を・に」では始まらないが、
#   「も」は「もとめる」「もし」のように語頭に立つ。落とすと
#   「もとめる分数を」が「とめる分数を」になる（2026-09-01に第3分冊 HG-6111 で発覚）
# ★助詞のうしろがひらがな以外（漢字・数字・記号）のときだけ落とす。
#   ひらがなが続くときは、その1字がことばの頭だところだところ（もとめる・はじめの）。
#   落とすと「とめる分数」「じめの差」になる（2026-09-01に第3分冊で発覚）
LEAD_JOSHI = re.compile(r"(?<=　)[はもがをに、]\s*(?=[^ぁ-ゖ])")


def fix_lead(mean):
    """『同じ考え方。　は3cmが2本＝…』のように、切れはしが助詞で始まるのを直す。"""
    t = LEAD_JOSHI.sub("", mean).strip("　 ")
    return re.sub(r"(?<=　)[…‥]+", "", t)


def fix_migi(text):
    """紙では図が右にあるが、アプリでは問題文の下に出る。"""
    if not text:
        return text
    t = text.replace("（図：", "（下の図：").replace("(図：", "（下の図：")
    return t


# 原簿の書き方（強調の「**」・実測メモ）が、子どもの読む文にそのまま出ていた
SEISAKU = re.compile(r"[（(](?:[^（）()]*(?:dpi|解答の解説図|解答p\d+|実測)[^（）()]*)[）)]")
TAIL_MARKS = re.compile(r"[\s　]*[①-⑳](?:[〜～・，、,／/]?[①-⑳])*[\s　／/]*$")
# ★2つ以上ならんでいるときだけ落とす。1つだけのときに落とすと
#   「② ①の場合，…」の①（前の小問を指している大事な番号）まで消えて、
#   「② の場合，」と読めない設問になる（2026-09-01に第3分冊 HG-6053 で発覚）
DUP_MARKS = re.compile(r"(?<=[①-⑳][\s　])[①-⑳](?:[〜～・，、,]?[①-⑳])+(?=それぞれ|の)")


def clean_text(t):
    """子どもが読む文から、制作側の書き方を落とす。"""
    if not t:
        return t
    t = t.replace("**", "")
    t = SEISAKU.sub("", t)
    t = DUP_MARKS.sub("", t)      # 「① ①②③それぞれ…」の二重の番号
    t = TAIL_MARKS.sub("", t)     # 「…何通りありますか。①〜⑤」の飾り
    return re.sub(r"[ 　]{2,}", "　", t).strip()


ASK_LABEL = re.compile(r"([^\s　。，、]{2,8})は何(?:こ|個|本|人|通り|まい|枚|試合|台|さつ)ですか")


def split_shared_meaning(spec):
    """「長方形は何こですか／ひし形は何こですか」のように、ことばで小問が分かれている大問。

    解法が「長方形…9こ。ひし形…5こ。…」と全部つながっているので、
    そのまま出すと1問目の解説で残り全部の答えが分かる（HG-5063・HG-5070・HG-5401）。
    → 自分が聞かれているものの一節だけに切る。
    """
    groups = {}
    for st in spec["steps"]:
        m = ASK_LABEL.search(st["question"])
        if not m:
            continue
        groups.setdefault(st.get("meaning", ""), []).append((st, m.group(1)))
    for mean, items in groups.items():
        labs = [lab for _, lab in items]
        known = sorted(set(labs))
        if len(known) < 2 or not all(l in mean for l in known):
            continue
        # ★切ってよいのは「文のあたまに出てくるラベル」だけ。
        #   文の途中（「2辺が等しい＝二等辺三角形」）で切ると文が壊れる（HG-5012）
        def at(lab, frm=0):
            i = mean.find(lab, frm)
            while i > 0 and mean[i - 1] not in "。　／、":
                i = mean.find(lab, i + 1)
            return i
        firsts = [at(l) for l in known]
        if any(i < 0 for i in firsts):
            continue
        head = mean[:min(firsts)].rstrip("　 、。")
        for st, lab in items:
            i = at(lab)
            j = len(mean)
            for other in known:
                if other == lab:
                    continue
                k = at(other, i + 1)
                if k > i:
                    j = min(j, k)
            seg = mean[i:j].strip("　 、。")
            if len(seg) < 4:
                continue
            st["meaning"] = (head + "。　" if head else "") + seg + "。"


ASK_MARK = re.compile(r"[（(]?([ア-ンあ-ん㋐-㋚])[）)]?にあてはまる")
BOUND = " 　、。／・\n"


def split_label_meaning(spec):
    """『アにあてはまる数を…』のように記号で分かれた大問で、解説にほかの記号の
       答えが並んでいたら、自分の記号の所だけに切る（HG-4950 は7つの答えが全部出ていた）。

       切るのは『（区切り）ア＝』『（区切り）ウは』のように、記号が文のあたまに
       立っているときだけ。『角ア＝角ウ』のような式の中では切らない。
    """
    labs = []
    for st in spec["steps"]:
        m = ASK_MARK.search(st["question"])
        labs.append(m.group(1) if m else None)
    known = {l for l in labs if l}
    if len(known) < 2:
        return
    for st, lab in zip(spec["steps"], labs):
        if not lab:
            continue
        s = st.get("meaning", "")
        cuts = [i for i in range(len(s))
                if s[i] in known and (i == 0 or s[i - 1] in BOUND)
                and i + 1 < len(s) and s[i + 1] in "＝=：:はも"]
        if len(cuts) < 2:
            continue
        segs, prev = [], 0
        for i in cuts:
            segs.append((prev, i))
            prev = i
        segs.append((prev, len(s)))
        keep = [s[segs[0][0]:segs[0][1]]]
        for a, b in segs[1:]:
            if lab in s[a:b]:
                keep.append(s[a:b])
        t2 = "".join(keep).strip("　 、")
        if lab in t2 and len(t2) > 10:
            st["meaning"] = t2 if t2.endswith("。") else t2 + "。"


def apply_tables(spec, hg):
    """監査で出た個別の直し（文字直し・解説の削り／書きかえ）を当てる。"""
    from g4b2_manual2 import (TEXT_FIX, MEAN_CUT, MEAN_CUT_RE, MEAN_CUT_STEP,
                              MEAN_FIX, STEP_DROP)
    drop = STEP_DROP.get(hg, [])
    if drop:
        spec["steps"] = [st for st in spec["steps"]
                         if not any(d in st["question"] for d in drop)]
    for old, new in TEXT_FIX.get(hg, []):
        if spec.get("intro"):
            spec["intro"] = spec["intro"].replace(old, new)
        for st in spec["steps"]:
            st["question"] = st["question"].replace(old, new)
    for pat in MEAN_CUT_RE.get(hg, []):
        for st in spec["steps"]:
            st["meaning"] = re.sub(pat, "", st["meaning"]).replace("　　", "　").strip("　 ")
    for cut in MEAN_CUT.get(hg, []):
        for st in spec["steps"]:
            st["meaning"] = st["meaning"].replace(cut, "").replace("　　", "　").strip("　 ")
    for marker, cut in MEAN_CUT_STEP.get(hg, []):
        for st in spec["steps"]:
            if marker in st["question"]:
                st["meaning"] = st["meaning"].replace(cut, "").replace("　　", "　").strip("　 ")
    for old, new in MEAN_FIX.get(hg, []):
        for st in spec["steps"]:
            st["meaning"] = st["meaning"].replace(old, new)


def polish(spec, hg=""):
    if spec.get("intro"):
        spec["intro"] = fix_parens(clean_text(fix_migi(spec["intro"])))
    for st in spec["steps"]:
        st["question"] = fix_parens(clean_text(fix_migi(st["question"])))
        m = fix_lead(st.get("meaning", ""))
        m = drop_other_marks(m, own_mark(st["question"]))
        st["meaning"] = drop_memo(m)
    split_shared_meaning(spec)
    split_label_meaning(spec)
    apply_tables(spec, hg)
    return spec
