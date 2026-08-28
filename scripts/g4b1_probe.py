# -*- coding: utf-8 -*-
"""第1分冊の答えのうち、テンキーで打てないもの（＝choicesが要るもの）を数える下調べ。"""
import io, re, sys, os, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g4b1_parse import load_records, parse_record

UNITS = ["円","こ","とおり","人","才","本","kg","g","cm²","cm2","cm","mm","m²","m","km","L","dL","mL",
         "試合","回","まい","通り","分間","分","秒","時間","日","度","個","枚","わ","ひき","頭","さつ",
         "たば","行","列","段目","番目","位","組","倍","年後","年前","本目","分後","分前","才","t","a","ha"]

def strip_unit(a):
    a = a.strip().strip("。、")
    a = re.sub(r"[（(][^）)]*[）)]$", "", a).strip()
    for u in sorted(UNITS, key=len, reverse=True):
        if a.endswith(u):
            return a[:-len(u)].strip()
    return a

def is_numpad(a):
    a = a.strip()
    return bool(re.match(r"^\d+(\.\d+)?$", a) or re.match(r"^\d+/\d+$", a)
                or re.match(r"^\d+と\d+/\d+$", a) or ("余り" in a))

tot = ok = 0
bad = collections.Counter()
badlist = collections.defaultdict(list)
nrec_bad = set()
for hg, title, rec in load_records():
    p = parse_record(hg, title, rec)
    for k in sorted(p["aparts"]):
        a = p["aparts"][k]
        tot += 1
        c = strip_unit(a)
        if is_numpad(c):
            ok += 1
            continue
        nrec_bad.add(hg)
        if re.search(r"[一二三四五六七八九十百千万億兆]", c) and not re.search(r"[ぁ-んァ-ヶ]", c):
            t = "漢数字"
        elif c in ("＞","＜","＝",">","<","="):
            t = "不等号"
        elif re.match(r"^\d+(\.\d+)?[、,]", c):
            t = "複数値"
        else:
            t = "その他"
        bad[t] += 1
        badlist[t].append((hg, a))
print("答えの数:", tot, " テンキー可:", ok, " 要choices:", tot-ok, " 対象レコード:", len(nrec_bad))
for t, n in bad.most_common():
    print("──", t, n)
    for hg, a in badlist[t][:12]:
        print("   ", hg, repr(a[:70]))
