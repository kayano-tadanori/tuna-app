# -*- coding: utf-8 -*-
"""小3マスター算数 第3分冊の原簿レコード(HG-4364〜4571・208本)を構造化して取り出す共通部品。
   g3b3_add_daimon.py から使う。ここではJSONへの書き込みは行わない（パースだけ）。
"""
import io
import re

from genbo_path import find_genbo

CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩"


def load_records():
    g = io.open(find_genbo(), encoding="utf-8").read()
    start = g.find("### 【HG-4364】")
    end = g.find("## 📊 第3分冊のまとめ")
    section = g[start:end]
    chunks = re.split(r"(?=^### 【HG-\d+】)", section, flags=re.M)
    out = []
    for c in chunks:
        c = c.strip()
        if not c:
            continue
        m = re.match(r"### 【(HG-\d+)】(.+)", c)
        hg, title = m.group(1), m.group(2).strip()
        out.append((hg, title, c))
    return out


def field(rec, name):
    m = re.search(r"^- %s: (.+?)(?=\n- [^\n]+:|\Z)" % re.escape(name), rec, re.M | re.S)
    return m.group(1).strip() if m else ""


def split_circled(s):
    """①…②…③… を含む文字列を {番号: テキスト} に割る。①が無ければ {0: 全体}。"""
    idxs = [(i, ch) for i, ch in enumerate(s) if ch in CIRCLED]
    if not idxs:
        return {0: s.strip()}
    out = {}
    for k, (pos, ch) in enumerate(idxs):
        endpos = idxs[k + 1][0] if k + 1 < len(idxs) else len(s)
        num = CIRCLED.index(ch) + 1
        out[num] = s[pos + 1:endpos].strip()
    return out


def parse_record(hg, title, rec):
    setmon = field(rec, "設定/設問")
    if not setmon:
        setup = field(rec, "設定")
        mon = field(rec, "設問")
        if mon:
            intro = setup
            setmon = mon
        else:
            # 「設定:」だけで「設問:」が別に無いレコード＝設定の中に設問まで
            # 全部書いてある（HG-4398・4534等）。intro扱いにすると設問が消えて
            # しまうので、設定そのものを設問として使う
            intro = ""
            setmon = setup
    else:
        intro = ""
    zu_ans_line = re.search(r"^- 図: (.+)$", rec, re.M)
    zu_text, ans_text = "", ""
    if zu_ans_line:
        raw = zu_ans_line.group(1)
        if "／答え: " in raw:
            zu_text, ans_text = raw.split("／答え: ", 1)
        else:
            zu_text = raw
    if not ans_text:
        m = re.search(r"答え: (.+)", rec)
        if m:
            ans_text = m.group(1)
    ans_text = ans_text.strip().strip("*").strip()
    kaihou = field(rec, "解法") or field(rec, "コア発見")
    qparts = split_circled(setmon)
    aparts = split_circled(ans_text)
    # 解法を①②③ごとに割る。数がqpartsと合わないときは信用しない（本文中の①言及に
    # 惑わされて誤爆した可能性が高いので、その場合は空にしてbuild_steps_for_part側の
    # フォールバックに任せる）
    kparts_raw = split_circled(kaihou)
    if set(kparts_raw) == set(aparts) and 0 not in kparts_raw:
        kparts = kparts_raw
    elif len(aparts) <= 1:
        kparts = {0: kaihou}
    else:
        kparts = {}
    return dict(hg=hg, title=title, intro=intro, setmon=setmon, zu=zu_text,
                qparts=qparts, aparts=aparts, kaihou=kaihou, kparts=kparts, ans_text=ans_text)


if __name__ == "__main__":
    import sys
    import json
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    recs = load_records()
    print("total:", len(recs))
    for hg, title, rec in recs[:3]:
        p = parse_record(hg, title, rec)
        print(json.dumps(p, ensure_ascii=False, indent=1))
