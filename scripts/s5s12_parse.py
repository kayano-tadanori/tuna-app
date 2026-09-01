# -*- coding: utf-8 -*-
"""小5最レ 第1・2分冊（HG-6563〜7182・621本）の原簿レコードを構造化して取り出す。

★設問・答えは原簿のまま（feedback_genbo_dori）。変えてよいのは答え方の様式だけ。
★図の根拠はPDFだけ（feedback_zu_wa_genbo_ni_nai）。図SVGが無い「図: あり」は着手しない。
"""
import io
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

HG_LO, HG_HI = 6563, 7183
CIRC = "".join(chr(0x2460 + i) for i in range(20))          # ①〜⑳
TITLE = re.compile(
    r"小5最レ\s*第(\d)分冊\s*第(\d)講座\s*No\.(\d+)\s*大問\s*([0-9０-９]+|[%s])\s*[（(](.+)[）)]\s*(.*)$" % CIRC)
Z2H = str.maketrans("０１２３４５６７８９", "0123456789")


def dnum(s):
    return CIRC.index(s[0]) + 1 if s and s[0] in CIRC else int(s.translate(Z2H))


def norm(s):
    s = (s or "").replace("\u3000", " ")
    s = re.sub(r"(?<![\d/])(\d+)\s+(\d+/\d+)", r"\1と\2", s)   # 帯分数「3 4/7」
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def field_any(rec, prefix):
    """「- 解法（解答PDFの記載）:」のように見出しにおまけが付くことがある。
       ★これを拾えていなかったせいで6本の解説が「骨」に化けていた（2026-09-02・塾講師監査）。"""
    m = re.search(r"^- %s[^:：\n]*[:：] (.+?)(?=\n- [^\n]+[:：]|\Z)" % re.escape(prefix),
                  rec, re.M | re.S)
    return m.group(1).strip() if m else ""


def field(rec, name):
    m = re.search(r"^- %s: (.+?)(?=\n- [^\n]+:|\Z)" % re.escape(name), rec, re.M | re.S)
    return m.group(1).strip() if m else ""


# 「(1) … (2) …」を割る。丸かっこは全角/半角どちらもある
PAREN = re.compile(r"[（(]\s*(\d{1,2})\s*[）)]")


# 小問番号の直前に来てよい文字（空白・改行・句読点）。バックスラッシュを使わずに組む
MARK_BEFORE = "".join(chr(c) for c in (
    0x20, 0x3000, 0x09, 0x0A, 0x3002, 0x3001, 0xFF0C, 0x2C,
    0xFF0F, 0x2F, 0x30FB, 0xFF1B, 0x3B, 0xFF1A,
    # 閉じかっこのあとにも小問番号が来る（「…交点がO）(1) …」＝HG-6943）
    0xFF09, 0x29, 0x3011, 0x5D))


def _is_marker(s, m):
    """小問番号の (1) か、N進法の 101(2) や 3×(5) の飾りかを見分ける。
       ★小問番号は「行頭・空白・句読点のあと」に来る。
       直前に何も挟まず数字や演算記号にくっついていれば飾り。"""
    i = m.start() - 1
    if i < 0:
        return True
    return s[i] in MARK_BEFORE


def split_paren(s):
    """(1)…(2)… を {番号: 本文} に割る。連番でなければ {0: 全体}。"""
    s = (s or "").strip()
    hits = [(m.start(), m.end(), int(m.group(1)))
            for m in PAREN.finditer(s) if _is_marker(s, m)]
    hits = [h for h in hits if h[2] <= 20]
    if not hits or hits[0][2] != 1:
        return {0: s}
    out, order = {}, []
    for k, (a, b, num) in enumerate(hits):
        if num in out:          # 同じ番号が2回目＝本文中の言及。そこで打ち切る
            break
        end = hits[k + 1][0] if k + 1 < len(hits) else len(s)
        out[num] = s[b:end].strip(" 　、，,／/・")
        order.append(num)
    if order != list(range(1, len(order) + 1)) or len(order) < 2:
        return {0: s}
    head = s[:hits[0][0]].strip()
    return dict(out, **({"_head": head} if head else {}))


def split_paren_any(s):
    """解法だけに使う。(5)(6) のように 1 から始まらない番号でも割る。
       ★これで「その小問のことは書いていない解法」を見分けられる。
         書いていないのに全文をのせると、ほかの小問の答えを配ってしまう
         （2026-09-02・塾講師監査でHG-6598/6599/6878/6824が指摘された）。"""
    s = (s or "").strip()
    hits = [(m.start(), m.end(), int(m.group(1)))
            for m in PAREN.finditer(s) if _is_marker(s, m)]
    hits = [h for h in hits if h[2] <= 20]
    if not hits:
        return {0: s}
    out, order = {}, []
    for k, (a, b, num) in enumerate(hits):
        if num in out:
            break
        end = hits[k + 1][0] if k + 1 < len(hits) else len(s)
        out[num] = s[b:end].strip(" 　、，,／/・")
        order.append(num)
    if order != sorted(order) or len(order) < 2:
        return {0: s}
    head = s[:hits[0][0]].strip()
    if head:
        out["_head"] = head
    return out

def load_records():
    g = io.open(find_genbo(), encoding="utf-8").read()
    out = []
    for c in re.split(r"(?=^### 【HG-\d+】)", g, flags=re.M):
        m = re.match(r"### 【(HG-(\d+))】(.+)", c)
        if not m:
            continue
        n = int(m.group(2))
        if not (HG_LO <= n <= HG_HI):
            continue
        tm = TITLE.search(m.group(3).strip())
        if not tm:
            raise SystemExit("題名が読めない: %s" % m.group(3))
        cut = c.find("\n<!-- APPENDIX")
        if cut > 0:
            c = c[:cut]
        out.append((m.group(1), tm, c.strip()))
    return out


def parse(hg, tm, rec):
    bun, kou, no, dai = tm.group(1), int(tm.group(2)), int(tm.group(3)), dnum(tm.group(4))
    name = tm.group(5).strip().rstrip("★☆").strip()
    star = tm.group(5).count("★")
    tail = (tm.group(6) or "").strip()

    setmon = field(rec, "設定/設問")
    intro = ""
    if setmon:
        mon = setmon
    else:
        setup, mon = field(rec, "設定"), field(rec, "設問")
        if mon:
            intro = setup
        else:
            mon = setup
    mon, intro = norm(mon), norm(intro)

    zu_line = re.search(r"^- 図: (.+)$", rec, re.M)
    zu, ans = "", ""
    if zu_line:
        raw = zu_line.group(1)
        m2 = re.search(r"／答え?[:：]\s*", raw)
        if m2:
            zu, ans = raw[:m2.start()].strip(), raw[m2.end():]
        else:
            zu = raw.strip()
    if not ans:
        m = re.search(r"^- 答え?[:：] (.+)$", rec, re.M)
        if m:
            ans = m.group(1)
    ans = norm(ans.strip().strip("*").strip())

    # 図SVG は2つの書き方がある。
    #  ① 1行  「- 図SVG: <svg …>」
    #  ② コードブロック 「- 図SVG:」の次の行から ```html … ``` まで
    # ★②を読み落として40本を「図SVGが無い」と切っていた（2026-09-02・塾講師監査で発覚）
    svg = ""
    m = re.search(r"^- 図SVG:[ \t]*(\S.*)$", rec, re.M)
    if m:
        v = m.group(1).strip().strip("`")
        svg = "" if v == "判読不能" else v
    else:
        m = re.search(r"^- 図SVG:[ \t]*\n```(?:html)?\n(.*?)\n```",
                      rec, re.M | re.S)
        if m:
            svg = m.group(1).strip()

    has_fig = bool(zu) and not zu.startswith("なし")
    fig_in_answer = bool(re.search(r"（解答", zu))          # 本文に図は無い

    return dict(hg=hg, tail=tail, bunsatsu=bun, kouza=kou, no=no, dai=dai, name=name, star=star,
                intro=intro, mon=mon, ans=ans, kaihou=norm(field_any(rec, "解法")),
                hone=norm(field(rec, "骨")), core=norm(field(rec, "コア発見")),
                zu=zu, svg=svg, has_fig=has_fig, fig_in_answer=fig_in_answer,
                qparts=split_paren(mon), aparts=split_paren(ans),
                kparts=split_paren(norm(field_any(rec, "解法"))),
                kparts_any=split_paren_any(norm(field_any(rec, "解法"))))


def ready(r):
    """図SVGが無い「図: あり」は着手しない（図の根拠はPDFだけ）。"""
    if not r["has_fig"]:
        return True
    return bool(r["svg"]) or r["fig_in_answer"]


def all_parsed():
    return [parse(hg, tm, rec) for hg, tm, rec in load_records()]


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    rs = all_parsed()
    print("読めたレコード:", len(rs), " 着手できる:", sum(1 for r in rs if ready(r)))
    ok = mismatch = single = 0
    for r in rs:
        if not ready(r):
            continue
        q = {k: v for k, v in r["qparts"].items() if k != "_head"}
        a = {k: v for k, v in r["aparts"].items() if k != "_head"}
        if set(q) == {0} and set(a) == {0}:
            single += 1
        elif set(q) == set(a):
            ok += 1
        else:
            mismatch += 1
    print("小問の数が合う:", ok, " 単問:", single, " 合わない:", mismatch)
