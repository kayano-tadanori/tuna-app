# -*- coding: utf-8 -*-
"""小4マスター算数 第1分冊（宿題テキスト・HG-4572〜4922・280本）の原簿レコードを
   構造化して取り出す共通部品。g4b1_add_daimon.py から使う。ここではJSONに書かない。

★設問・答えは原簿のまま（feedback_genbo_dori）。変えてよいのは答え方の様式だけ。
"""
import io
import re

from genbo_path import find_genbo

# ①〜⑳（U+2460〜U+2473）
CIRCLED = "".join(chr(0x2460 + i) for i in range(20))
KATA = "アイウエオカキ"

HG_LO, HG_HI = 4572, 4944


def load_records():
    g = io.open(find_genbo(), encoding="utf-8").read()
    chunks = re.split(r"(?=^### 【HG-\d+】)", g, flags=re.M)
    out = []
    for c in chunks:
        m = re.match(r"### 【(HG-(\d+))】(.+)", c)
        if not m:
            continue
        n = int(m.group(2))
        if not (HG_LO <= n <= HG_HI):
            continue
        out.append((m.group(1), m.group(3).strip(), c.strip()))
    return out


def field(rec, name):
    m = re.search(r"^- %s: (.+?)(?=\n- [^\n]+:|\Z)" % re.escape(name), rec, re.M | re.S)
    return m.group(1).strip() if m else ""


def norm(s):
    """帯分数「3 4/7」→「3と4/7」。全角の空白・記号もそろえる。"""
    s = s.replace("\u3000", " ")
    s = re.sub(r"(?<![\d/])(\d+)\s+(\d+/\d+)", r"\1と\2", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def split_marked(s, marks):
    """①…②… / ア…イ… を {番号: テキスト} に割る。見つからなければ {0: 全体}。"""
    idxs = [(i, ch) for i, ch in enumerate(s) if ch in marks]
    # 連番で始まっていないものは飾り（本文中の言及）とみなして採らない
    if not idxs or marks.index(idxs[0][1]) != 0:
        return {0: s.strip()}
    out, seen = {}, []
    for k, (pos, ch) in enumerate(idxs):
        num = marks.index(ch) + 1
        if num in out:      # 同じ番号が2回出たら以降は本文中の言及
            break
        end = idxs[k + 1][0] if k + 1 < len(idxs) else len(s)
        out[num] = s[pos + 1:end].strip(" 　、")
        seen.append(num)
    if seen != list(range(1, len(seen) + 1)):
        return {0: s.strip()}
    return out


def split_parts(s):
    a = split_marked(s, CIRCLED)
    if len(a) > 1:
        return a, "circled"
    b = split_marked(s, KATA)
    if len(b) > 1:
        return b, "kata"
    return {0: s.strip()}, "none"


def parse_record(hg, title, rec):
    setmon = field(rec, "設定/設問")
    intro = ""
    if not setmon:
        setup = field(rec, "設定")
        mon = field(rec, "設問")
        if mon:
            intro, setmon = setup, mon
        else:
            setmon = setup
    setmon = norm(setmon)
    intro = norm(intro)

    zu_line = re.search(r"^- 図: (.+)$", rec, re.M)
    zu_text, ans_text = "", ""
    if zu_line:
        raw = zu_line.group(1)
        if "／答え: " in raw:
            zu_text, ans_text = raw.split("／答え: ", 1)
        else:
            zu_text = raw
    if not ans_text:
        m = re.search(r"^- 答え: (.+)$", rec, re.M)
        if m:
            ans_text = m.group(1)
    ans_text = norm(ans_text.strip().strip("*").strip())

    kaihou = norm(field(rec, "解法"))
    youten = ""
    m = re.search(r"^- 要点（本文p\d+）: (.+?)(?=\n- |\Z)", rec, re.M | re.S)
    if m:
        youten = norm(m.group(1))

    svg = ""
    m = re.search(r"^- 図SVG: (.+)$", rec, re.M)
    if m:
        v = m.group(1).strip().strip("`")
        svg = "" if v == "判読不能" else v

    qparts, qkind = split_parts(setmon)
    aparts, akind = split_parts(ans_text)
    kparts, _ = split_parts(kaihou)
    if set(kparts) != set(aparts) or 0 in kparts:
        kparts = {}

    return dict(hg=hg, title=title, intro=intro, setmon=setmon, zu=zu_text, svg=svg,
                qparts=qparts, qkind=qkind, aparts=aparts, akind=akind,
                kaihou=kaihou, kparts=kparts, youten=youten, ans_text=ans_text)


if __name__ == "__main__":
    import sys, json
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    recs = load_records()
    print("total:", len(recs))
    for hg, title, rec in recs[:2]:
        print(json.dumps(parse_record(hg, title, rec), ensure_ascii=False, indent=1))
