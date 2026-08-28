# -*- coding: utf-8 -*-
"""塾講師エージェントの監査用に、原簿レコードと作った大問を1本ずつ並べて書き出す。"""
import io, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g4b1_parse import load_records

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = sys.argv[1]
GROUPS = {"A": [1, 2, 3], "B": [4, 5, 6], "C": [7, 8, 9], "D": [10, 11, 12, 13]}

d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))
node = d["grades"]["4"]["master_bunsatsu"]["fukushu"]
made = {}
for no, arr in node.items():
    for x in arr:
        made[x["src"]] = (no, x)

genbo = {hg: rec for hg, title, rec in load_records()}

for g, nos in GROUPS.items():
    out = []
    for hg in sorted(genbo, key=lambda h: int(h.split("-")[1])):
        if hg not in made:
            continue
        no, x = made[hg]
        if int(no) not in nos:
            continue
        rec = re.sub(r"- 図SVG: .*", "- 図SVG: （SVGあり・本文は省略）", genbo[hg])
        y = {k: v for k, v in x.items() if k != "svg"}
        y["svg"] = "（あり）" if x.get("svg") else ""
        out.append("## 原簿 %s（No.%s）\n%s\n\n### アプリに作った大問\n```json\n%s\n```\n"
                   % (hg, no, rec.strip(), json.dumps(y, ensure_ascii=False, indent=1)))
    p = os.path.join(DST, "g4b1_audit_%s.md" % g)
    io.open(p, "w", encoding="utf-8").write(
        "# 小4マスター算数 第1分冊 No.%s の監査用資料\n\n" % ("・".join(map(str, nos))) + "\n---\n".join(out))
    sys.stderr.write("%s: %d本 -> %s\n" % (g, len(out), p))
