# -*- coding: utf-8 -*-
u"""【試行専用・使い捨て】旧G1成果物（noNN_*.md）→ 新しいG1 JSON ＋ SVGファイル。

目的はただ1つ：**新形式で旧成果物を表現しきれるか**を確かめること。
原本PDFは開かない。本番の原簿・アプリデータには触らない。

  python scripts/g1_from_old.py --survey
      … 旧ファイルを全部読んで、大問ごとの特徴を一覧で出す（10問を選ぶため）

  python scripts/g1_from_old.py --pick docs/_genbo/_trial10/pick10.json \
                                --out-dir docs/_genbo/_trial10
      … 選んだ大問だけをG1 JSONに変換し、SVGを svg/ に書き出す

★確定できないものは黙って埋めず `problems` に積み、終了コードを1にする。
★図の対応づけは本来 fid で明示するもの。旧データにはその情報が無いので、
  ここでだけ `match: "by_order_legacy"` を付けて順番あわせを許す（新規のG1では使わない）。
"""
import argparse
import glob
import io
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g1_units import unit_index, unsupported              # noqa: E402
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD_DIR = os.path.join(BASE, "docs", "_genbo", "g5enshu3")

# 旧ファイルで実在する欄名（実測して並べた）。ここに無い「名前:」は欄の始まりとみなさない。
FIELDS = [
    u"設問", u"図SVG", u"図", u"答え", u"解法(印刷そのまま)", u"解法",
    u"検算", u"備考", u"出典", u"解答ページ", u"扱い", u"欠けている箇所",
    u"解説の図", u"図の読み取りメモ", u"解説の式（印刷そのまま）", u"解答",
    u"手書きの書きこみ", u"解答の解説に図があるか", u"ページ",
]
FIELD_RE = re.compile(
    u"^(" + u"|".join(re.escape(f) for f in sorted(FIELDS, key=len, reverse=True)) +
    u")(\\(\\d+\\)|（\\d+）)?[:：]\\s?(.*)$")

MARU = u"①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
KATA = u"㋐㋑㋒㋓㋔㋕㋖㋗㋘㋙"

NOTE_KIND = [
    (u"scan_right_edge", [u"右端", u"欠け"]),
    (u"handwriting", [u"手書き"]),
    (u"label_missing", [u"黒地白ヌキ", u"ラベル", u"かすれ"]),
    (u"nombre_missing", [u"ノンブル"]),
    (u"bleed_through", [u"裏写り", u"ブリードスルー", u"写り込み"]),
    (u"print_missing", [u"未印刷", u"印刷されていない"]),
    (u"figure_mismatch", [u"図が食いちが", u"実物と別"]),
]


def note_kind(text):
    for kind, words in NOTE_KIND:
        if any(w in text for w in words):
            return kind
    return u"other"


# ── 旧mdを大問ブロックに切る ────────────────────────────────────
HEAD_RE = re.compile(u"^##\\s+(.+?)\\s*$", re.M)


def parse_label(head):
    u"""見出しから (ラベル, ☆か, 印刷ページ, PDFページ, 未確定の理由) を返す。"""
    star = u"☆" in head
    # 「解答冊子の表記：C5」が書いてあればそれが正
    m = re.search(u"解答冊子の表記[:：]\\s*([BC]\\s?\\d{1,2})", head)
    if not m:
        m = re.match(u"^\\s*☆?\\s*([BC]\\s?\\d{1,2})(?!\\d)", head)
    label = m.group(1).replace(u" ", u"") if m else None
    p = re.search(u"印刷\\s?p\\s?(\\d+)", head)
    q = re.search(u"PDF\\s?p\\s?(\\d+)", head)
    why = None
    if label is None:
        why = u"見出しからB/Cラベルを決められない: %s" % head[:60]
    return label, star, (int(p.group(1)) if p else None), (int(q.group(1)) if q else None), why


def split_items(text):
    heads = list(HEAD_RE.finditer(text))
    out = []
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out.append((m.group(1), text[m.end():end]))
    return out


# ★旧mdには「- 図SVG(1):」だけでなく「### 図SVG (1)　説明」という見出し形式もある。
#   2026-09-13の試行で、この形の図4枚（HG-7930）を丸ごと取りこぼしていた。
HEAD_SVG_RE = re.compile(u"^###\\s*図SVG\\s*[（(]?\\s*(\\d+)\\s*[)）]?")


def parse_fields(body):
    u"""ブロック本文を [(欄名, かっこ内番号, 中身), ...] にする。```フェンスの中では切らない。"""
    rows, cur, fence = [], None, False
    for line in body.split(u"\n"):
        if line.strip().startswith(u"```"):
            fence = not fence
            if cur:
                cur[2].append(line)
            continue
        hm = None if fence else HEAD_SVG_RE.match(line)
        if hm:
            cur = [u"図SVG", int(hm.group(1)), []]
            rows.append(cur)
            continue
        m = None if fence else FIELD_RE.match(line)
        if m:
            qual = m.group(2)
            n = int(re.sub(u"[^0-9]", u"", qual)) if qual else None
            cur = [m.group(1), n, [m.group(3)]]
            rows.append(cur)
        elif cur is not None:
            cur[2].append(line)
    out = []
    for a, b, c in rows:
        # ★旧mdは大問の区切りに `---` を使う。欄の中身として取りこむと、
        #   原簿に書き戻したとき区切り線がレコードの中に紛れこむ
        while c and c[-1].strip() in (u"", u"---", u"----"):
            c.pop()
        out.append((a, b, u"\n".join(c).strip()))
    return out


# ── 設問を「共通文」と「印刷された小問」に分ける ─────────────────
Q_RE = re.compile(u"[(（]\\s*(\\d{1,2})\\s*[)）]")


def split_setsumon(text, slot_nums):
    u"""(common, questions, why)。**番号だけで決めず、答える場所（枠）がある番号だけ**を小問とみなす。

    ★2026-09-13の試行で分かったこと：設問に (3) しか書かれていない大問がある
      （HG-7930。図が(1)〜(4)の4枚あり、答えも4つあるのに、本文の条件は(3)にしか付かない）。
      「1からの連番でなければ分けない」としていたので、その条件文が共通文に紛れこみ、
      画面では全部の小問の上に出てしまう。**適用範囲＝その番号の答える場所があるか**で決める。
    ★同じ番号が2回以上出るものは、本文がその番号に言及しているだけかもしれないので止める。
    """
    ms = [m for m in Q_RE.finditer(text)]
    nums = [int(m.group(1)) for m in ms]
    dup = [n for n in set(nums) if nums.count(n) > 1]
    if dup:
        return text.strip(), [], u"設問の中に同じ小問番号が2回以上ある: %s" % sorted(dup)
    hit = [(m, n) for m, n in zip(ms, nums) if n in slot_nums]
    if not hit:
        return text.strip(), [], None
    common = text[:hit[0][0].start()].strip()
    qs = []
    for i, (m, n) in enumerate(hit):
        end = hit[i + 1][0].start() if i + 1 < len(hit) else len(text)
        qs.append({u"qid": u"q%d" % n, u"label": m.group(0),
                   u"text": text[m.start():end].strip()})
    return common, qs, None


def parse_choices(text):
    u"""選択肢を [{sym, text}] に。記号と本文の対応・順序をそのまま保つ。"""
    for syms in (MARU, KATA):
        found = [(m.start(), m.group(0)) for m in re.finditer(u"[" + syms + u"]", text)]
        # 行頭または直前が空白・改行のものだけを選択肢の頭とみなす
        heads = [(p, s) for p, s in found if p == 0 or text[p - 1] in u" 　\n（("]
        if len(heads) < 2:
            continue
        order = [syms.index(s) for _, s in heads]
        if order != list(range(order[0], order[0] + len(order))):
            continue
        out = []
        for i, (p, s) in enumerate(heads):
            end = heads[i + 1][0] if i + 1 < len(heads) else len(text)
            body = text[p + 1:end].strip().strip(u"。").strip()
            if not body:
                return [], None
            out.append({u"sym": s, u"text": body})
        return out, None
    return [], None


# ── 答えを「答える場所」ごとに分ける ─────────────────────────────
SLOT_RE = re.compile(u"([(（]\\s*\\d{1,2}\\s*[)）]|[" + KATA + u"])\\s*")


# 案A：1つの枠に「印刷されたラベル＋値」が2組以上ならんでいる（例「上り　時速12km　　下り　時速18km」）
VAL_PAIR = re.compile(u"([^\\s　\\d]+)[\\s　]+([^\\s　]*\\d[^\\s　]*)")


def split_values(text):
    u"""案A。印刷されたラベルで分けられるときだけ分ける。分けられないなら空リスト。"""
    ms = list(VAL_PAIR.finditer(text))
    if len(ms) < 2:
        return []
    covered = u"".join(text[m.start():m.end()] for m in ms)
    if re.sub(u"[\\s　]", u"", covered) != re.sub(u"[\\s　]", u"", text):
        return []           # 説明しきれない字が残る＝分け方が確かでない
    return [{u"vid": u"v%d" % (i + 1), u"label": m.group(1), u"text": m.group(2)}
            for i, m in enumerate(ms)]




def split_kotae(text, slot_qid=True):
    u"""(slots, why)。分けられないときは1枠にまとめる（改変はしない）。"""
    ms = list(SLOT_RE.finditer(text))
    if not ms:
        slots = [{u"aid": u"a1", u"label": u"", u"text": text.strip(), u"qid": None}]
    else:
        slots = []
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
            val = text[m.end():end].strip()
            lab = re.sub(u"\\s", u"", m.group(1))
            n = re.sub(u"[^0-9]", u"", lab)
            slots.append({u"aid": u"a%d" % (i + 1), u"label": lab, u"text": val,
                          u"qid": (u"q%s" % n) if n else None})
    whys = []
    for s in slots:
        s[u"values"] = split_values(s[u"text"])
        # ★単位で値を取り出せるかは、表にある表記かどうかで決める（長さでは決めない）。
        #   表に無い表記が出たら索引を作らず、**理由を持ち帰る**（黙って捨てない）
        idx, why = unit_index(s[u"text"])
        s[u"unit_index"] = idx
        if unsupported(why):
            whys.append(u"枠%s(%s): %s" % (s[u"aid"], s[u"label"], why))
    if any(not s[u"text"] for s in slots):
        return slots, u"中身の無い答えの枠がある: %s" % [s[u"label"] for s in slots]
    return slots, (u"／".join(whys) if whys else None)


# ── 図 ──────────────────────────────────────────────────────
EMPTY_MARK = (u"—", u"-", u"ー", u"–", u"なし", u"無し", u"")


def svg_body(raw):
    m = re.search(u"(?s)<svg.*?</svg>", raw)
    return m.group(0) if m else None


def is_empty_svg_field(raw):
    u"""旧形式は「図SVG: —」で“図なし”を表す。欄があること＝図があることではない。"""
    return raw.strip().strip(u"。、 　") in EMPTY_MARK


PER_Q_RE = re.compile(u"[(（]\\s*\\d{1,2}\\s*[)）]")


def zu_assigns_per_question(zu):
    u"""図欄が「どの図がどの小問のものか」を書いているか。

    例：`あり（問題ページ自体に図が2つ ((1)用・(2)用) ある）`
        `あり（問題ページ自体に図あり。(1)〜(4) の4枚）`
    こう書いてあるのに図SVG欄に番号が無ければ、**所属は確定していない**。
    """
    return bool(PER_Q_RE.search(zu or u""))


def build_figures(fields, questions, label, problems, ambiguous=None):
    u"""図SVG欄 → figures[]。かっこ番号があれば小問へ明示。

    🚨**番号が無い＝大問共通、と決めつけない。**それは「都合のよい丸め」であって根拠が無い。
      番号の無い図SVG欄が2つ以上ある大問／図欄が小問ごとに図を割りあてていると
      書いてある大問は、**scope=unknown（所属未確定）**にして未完成にする。
      （2026-09-13の試行で HG-7910 の2枚を黙って大問共通図にしていた）
    """
    ambiguous = ambiguous if ambiguous is not None else []
    zu = next((v for k, n, v in fields if k == u"図"), None)
    svgs = [(n, v) for k, n, v in fields if k == u"図SVG" and not is_empty_svg_field(v)]
    figs = []
    if not svgs:
        state = u"none"
        where = None
        reason = None
        if zu:
            if u"判読不能" in zu or u"未印刷" in zu or u"印刷されていない" in zu:
                state, reason = u"unreadable", zu.strip()
            elif zu.strip().startswith(u"あり") and u"問題文には図なし" not in zu:
                state, reason = u"unreadable", u"図ありと書かれているが図SVGが無い"
                problems.append(u"%s: 図ありなのに図SVG欄が無い" % label)
            elif u"解答" in zu or u"解説" in zu:
                where = u"kaisetsu"
        return ([] if state == u"none" and where is None else
                [{u"fid": u"f1", u"scope": u"item", u"order": 1, u"state": state,
                  u"where": where, u"svg_ref": None, u"reason": reason,
                  u"match": u"explicit"}]), zu
    valid = set(questions) if isinstance(questions, set) else {
        int(q[u"qid"][1:]) for q in questions}
    # 番号の無い図SVG欄が2枚以上／図欄が小問ごとに割りあてている → 所属は確定できない
    unnumbered = sum(1 for n, _ in svgs if n is None)
    unresolved_why = None
    if unnumbered >= 2:
        unresolved_why = (u"番号の無い「図SVG:」欄が%d個あり、どの図がどの小問のものか"
                          u"旧データからは決められない" % unnumbered)
    elif unnumbered and zu_assigns_per_question(zu):
        unresolved_why = (u"図欄が小問ごとに図を割りあてている（%s）のに、「図SVG:」欄に"
                          u"小問番号が付いていない" % (zu or u"").strip().replace(u"\n", u" ")[:60])

    for i, (n, raw) in enumerate(svgs, 1):
        body = svg_body(raw)
        fid = u"f%d" % i
        if n is None and unresolved_why:
            scope, match = u"unknown", u"unresolved"
        elif n is None:
            scope, match = u"item", u"explicit"
        elif n in valid:
            # 図SVG(n) は「小問(n)の図」。設問文が印刷されていなくても、
            # 答える場所(n)があるなら小問(n)は実在する
            scope, match = u"q%d" % n, u"explicit"
        else:
            scope, match = u"item", u"by_order_legacy"
            problems.append(u"%s: 図SVG(%d) に対応する小問(%d)が、設問にも答えの枠にも無い"
                            % (label, n, n))
        fg = {u"fid": fid, u"scope": scope, u"order": i,
              u"state": u"unreadable" if body is None else u"ok",
              u"where": u"mondai", u"svg_ref": None,
              u"reason": raw.strip()[:120] if body is None else None,
              u"match": match}
        if scope == u"unknown":
            fg[u"scope_reason"] = unresolved_why
            ambiguous.append(u"%s 図%s: %s" % (label, fid, unresolved_why))
        if body is not None:
            fg[u"_svg"] = body
        figs.append(fg)
    return figs, zu


# ── 1大問 ───────────────────────────────────────────────────
def merge_item(base, other, problems):
    u"""同じ大問が2つのパケットに分かれているときに1本へまとめる。

    ★パケットの境目で「答えが隣のページにある」は必ず起きるので、追加回収した側の
      ファイルにも同じ大問が載る。**片方が unread、もう片方が ok なら ok を採る。**
      両方 ok で中身が違うときは、勝手に選ばず報告する。
    """
    hg = base.get(u"hg")
    for key in (u"kotae", u"kaihou_insatsu"):
        b, o = base[key], other[key]
        if b[u"state"] != u"ok" and o[u"state"] == u"ok":
            base[key] = o
        elif b[u"state"] == u"ok" and o[u"state"] == u"ok":
            if (b.get(u"text") or u"").strip() != (o.get(u"text") or u"").strip():
                problems.append(u"%s: %s が2つのパケットで食いちがう" % (hg, key))
    if base[u"kenzan"][u"result"] == u"mi" and other[u"kenzan"][u"result"] != u"mi":
        base[u"kenzan"] = other[u"kenzan"]
    have = {(f[u"scope"], (f.get(u"_svg") or u"").strip()) for f in base[u"figures"]}
    for f in other[u"figures"]:
        if (f[u"scope"], (f.get(u"_svg") or u"").strip()) not in have:
            f[u"fid"] = u"f%d" % (len(base[u"figures"]) + 1)
            base[u"figures"].append(f)
    for n in other[u"notes"]:
        if n not in base[u"notes"]:
            base[u"notes"].append(n)
    if base[u"setsumon"][u"state"] != u"ok" and other[u"setsumon"][u"state"] == u"ok":
        base[u"setsumon"] = other[u"setsumon"]
    elif (base[u"setsumon"][u"state"] == u"ok" and other[u"setsumon"][u"state"] == u"ok"
          and re.sub(r"\s", u"", base[u"setsumon"][u"common"] or u"")
          != re.sub(r"\s", u"", other[u"setsumon"][u"common"] or u"")):
        problems.append(u"%s: 設問が2つのパケットで食いちがう" % hg)


def resplit(item, problems):
    u"""合流したあとに、**合流後の答えの枠**で設問を分け直す。

    ★答えが別のパケットにあると、設問を読んだ側は枠の番号を知らないので分けられない
      （HG-7910 は (1)(2) が共通文に残り、画面に空の「(1)」が出た）。合流してから決め直す。
    """
    s = item[u"setsumon"]
    if s[u"state"] != u"ok" or not s.get(u"_raw"):
        return
    nums = set()
    for sl in item[u"kotae"][u"slots"]:
        n = re.sub(u"[^0-9]", u"", sl[u"label"] or u"")
        if n:
            nums.add(int(n))
    common, qs, why = split_setsumon(s[u"_raw"], nums)
    if why:
        problems.append(u"%s: %s" % (item.get(u"hg") or item[u"label"], why))
        return
    s[u"common"], s[u"questions"] = common, qs
    s[u"choices"], _ = parse_choices(common)


def build_item(head, body, problems, ambiguous=None):
    label, star, pp, pdfp, why = parse_label(head)
    if why:
        return None, why
    fields = parse_fields(body)
    get = lambda name: next((v for k, n, v in fields if k == name), None)

    extra_notes = []
    # ★答えを先に分ける。設問のどこからが小問かは「答える場所がある番号」で決めるため。
    kotae_raw = get(u"答え") or get(u"解答")
    if kotae_raw is None:
        kotae = {u"state": u"unread", u"text": None, u"slots": [], u"reason": None}
    elif u"★未読" in kotae_raw or u"未読" in kotae_raw:
        kotae = {u"state": u"unread", u"text": None, u"slots": [], u"reason": kotae_raw.strip()}
    else:
        # ★注記（※…）は本文ではない。混ぜたままだと答えの枠を壊す
        #   （HG-7859 は注記の中の (1)(2)(3) まで枠として数えられ、6枠になった）。
        kotae_body, kotae_note = kotae_raw, None
        m = re.search(u"[（(]?※", kotae_raw)
        if m:
            kotae_body = kotae_raw[:m.start()].rstrip()
            kotae_note = kotae_raw[m.start():].strip()
        slots, kwhy = split_kotae(kotae_body)
        if kwhy:
            problems.append(u"%s: %s" % (label, kwhy))
        kotae = {u"state": u"ok", u"text": kotae_body.strip(), u"slots": slots, u"reason": None}
        if kotae_note:
            extra_notes.append({u"kind": u"other", u"text": u"答えの注記: " + kotae_note})
    slot_nums = set()
    for s in kotae[u"slots"]:
        n = re.sub(u"[^0-9]", u"", s[u"label"] or u"")
        if n:
            slot_nums.add(int(n))

    setsu = get(u"設問")
    if not setsu:
        # ★答えだけを追加回収したパケットには設問が無い。ここでは落とさず unread にして、
        #   同じ大問の別パケットと合流させる（合流しても unread のままなら main で弾く）。
        setsumon = {u"state": u"unread", u"common": None, u"questions": [],
                    u"choices": [], u"reason": u"このパケットに設問が無い"}
        common, qs = None, []
    else:
        common, qs, qwhy = split_setsumon(setsu, slot_nums)
        if qwhy:
            problems.append(u"%s: %s" % (label, qwhy))
        choices, _ = parse_choices(common)
        setsumon = {u"state": u"ok", u"common": common, u"questions": qs,
                    u"choices": choices, u"reason": None, u"_raw": setsu}

    kh = get(u"解法(印刷そのまま)") or get(u"解説の式（印刷そのまま）")
    if kh is None:
        kaihou = {u"state": u"unread", u"text": None, u"reason": u"旧形式にこの欄が無い"}
    elif not kh.strip() or u"無い" in kh[:20]:
        kaihou = {u"state": u"none", u"text": None, u"reason": kh.strip()[:120] or None}
    else:
        kaihou = {u"state": u"ok", u"text": kh.strip(), u"reason": None}

    ken = (get(u"検算") or u"").strip()
    result = u"itchi" if ken.startswith(u"一致") else (
        u"fuitchi" if u"不一致" in ken else (u"mi" if ken else u"mi"))
    kenzan = {u"result": result, u"memo": ken or None}

    # 小問の番号は「答える場所」と「印刷された設問」の両方から集める
    valid_nums = set(slot_nums) | {int(q[u"qid"][1:]) for q in qs}
    figs, zu = build_figures(fields, valid_nums, label, problems, ambiguous)

    notes = list(extra_notes)
    for k, n, v in fields:
        if k in (u"備考", u"扱い", u"欠けている箇所", u"手書きの書きこみ",
                 u"図の読み取りメモ", u"解説の図", u"解答の解説に図があるか"):
            if v.strip():
                notes.append({u"kind": note_kind(k + v), u"text": v.strip()})
    if zu and (u"手書き" in zu or u"欠け" in zu or u"未印刷" in zu or u"裏写り" in zu):
        notes.append({u"kind": note_kind(zu), u"text": zu.strip()})

    item = {
        u"label": label, u"hg": None, u"star": star,
        u"page": {u"mondai": {u"print": pp, u"pdf": pdfp}},
        u"setsumon": setsumon,
        u"kotae": kotae, u"kaihou_insatsu": kaihou, u"kenzan": kenzan,
        u"figures": figs, u"notes": notes,
    }
    return item, None


# ── survey ──────────────────────────────────────────────────
def survey():
    rows = []
    for f in sorted(glob.glob(os.path.join(OLD_DIR, u"no*_*.md"))):
        text = io.open(f, encoding=u"utf-8").read()
        for head, body in split_items(text):
            label, star, pp, pdfp, why = parse_label(head)
            if why:
                continue
            problems = []
            item, err = build_item(head, body, problems)
            if err:
                continue
            nq = len(item[u"setsumon"][u"questions"])
            fs = item[u"figures"]
            rows.append({
                u"file": os.path.basename(f), u"label": label,
                u"q": nq, u"slots": len(item[u"kotae"][u"slots"]),
                u"choices": len(item[u"setsumon"][u"choices"]),
                u"fig_item": sum(1 for x in fs if x[u"scope"] == u"item" and x[u"state"] == u"ok"),
                u"fig_step": sum(1 for x in fs if x[u"scope"] != u"item"),
                u"fig_bad": sum(1 for x in fs if x[u"state"] in (u"unreadable",)),
                u"kaisetsu_only": sum(1 for x in fs if x[u"where"] == u"kaisetsu"),
                u"notes": len(item[u"notes"]),
                u"kotae_state": item[u"kotae"][u"state"],
                u"problems": problems,
            })
    print(json.dumps(rows, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--survey", action="store_true")
    ap.add_argument("--pick")
    ap.add_argument("--out-dir")
    a = ap.parse_args()
    if a.survey:
        return survey()
    if not a.pick or not a.out_dir:
        sys.exit(u"--pick と --out-dir が要る")

    from g1_guard import assert_safe_out_dir
    assert_safe_out_dir(a.out_dir)

    pick = json.load(io.open(a.pick, encoding=u"utf-8"))
    svgdir = os.path.join(a.out_dir, u"svg")
    g1dir = os.path.join(a.out_dir, u"g1")
    os.makedirs(svgdir, exist_ok=True)
    os.makedirs(g1dir, exist_ok=True)

    problems, ambiguous, byfile, seen_hg = [], [], {}, {}
    for p in pick[u"items"]:
        f = os.path.join(OLD_DIR, p[u"file"])
        text = io.open(f, encoding=u"utf-8").read()
        hit = None
        for head, body in split_items(text):
            lab = parse_label(head)[0]
            if lab == p[u"label"]:
                hit = (head, body)
                break
        if not hit:
            problems.append(u"%s に %s が無い" % (p[u"file"], p[u"label"]))
            continue
        item, err = build_item(hit[0], hit[1], problems, ambiguous)
        if err:
            problems.append(u"%s %s: %s" % (p[u"file"], p[u"label"], err))
            continue
        item[u"hg"] = p[u"hg"]
        prev = seen_hg.get(p[u"hg"])
        if prev is not None:
            merge_item(prev, item, problems)
            continue
        seen_hg[p[u"hg"]] = item
        byfile.setdefault(p[u"file"], []).append(item)

    # ★合流が終わってから、合流後の枠の番号で設問を分け直す
    for items in byfile.values():
        for item in items:
            resplit(item, problems)
            # 図の scope も、分け直した小問に合わせて確かめる
            nums = set()
            for sl in item[u"kotae"][u"slots"]:
                n = re.sub(u"[^0-9]", u"", sl[u"label"] or u"")
                if n:
                    nums.add(int(n))
            nums |= {int(q[u"qid"][1:]) for q in item[u"setsumon"][u"questions"]}
            for fg in item[u"figures"]:
                if fg[u"scope"] in (u"item", u"unknown"):
                    continue
                if int(fg[u"scope"][1:]) not in nums:
                    problems.append(u"%s: 図 %s が指す小問(%s)が無い"
                                    % (item[u"hg"], fg[u"fid"], fg[u"scope"][1:]))
            item[u"setsumon"].pop(u"_raw", None)

    # ★SVGの書き出しは「まとめ終わったあと」。先に書くと、あとから合流した図が落ちる
    for items in byfile.values():
        for item in items:
            for fg in item[u"figures"]:
                svg = fg.pop(u"_svg", None)
                if svg is None:
                    continue
                name = u"%s_%s.svg" % (item[u"hg"], fg[u"fid"])
                io.open(os.path.join(svgdir, name), u"w", encoding=u"utf-8",
                        newline=u"\n").write(svg)
                fg[u"svg_ref"] = u"svg/" + name

    for items in byfile.values():
        for item in items:
            if item[u"setsumon"][u"state"] != u"ok":
                problems.append(u"%s: どのパケットにも設問が無い" % item[u"hg"])

    for fname, items in byfile.items():
        m = re.match(u"no(\\d+)_(.+)\\.md", fname)
        doc = {u"material": u"小5 演習教材 第3分冊", u"no": int(m.group(1)),
               u"block": m.group(2), u"produced_by": u"g1_from_old.py（試行・旧成果物からの機械変換）",
               u"items": items}
        out = os.path.join(g1dir, u"no%s_%s.json" % (m.group(1), m.group(2)))
        io.open(out, u"w", encoding=u"utf-8", newline=u"\n").write(
            json.dumps(doc, ensure_ascii=False, indent=1) + u"\n")
        print(u"書いた: %s（%d本）" % (os.path.relpath(out, BASE), len(items)))

    if ambiguous:
        print(u"\n⚠ 所属・対応を確定できなかったもの %d件"
              u"（scope=unknown として記録。この大問は完成扱いにしない）" % len(ambiguous))
        for t in ambiguous:
            print(u"   ", t)

    if problems:
        print(u"\n🚩 確定できなかったもの %d件" % len(problems))
        for t in problems:
            print(u"   ", t)
        sys.exit(1)
    print(u"\n✅ 変換できた（止めるほどの未確定は無し）")


if __name__ == "__main__":
    main()
