# -*- coding: utf-8 -*-
"""小3マスター算数 第3分冊（No.32〜43・HG-4364〜4571・208本）を
   hama_daimon.json の grades.3.master_bunsatsu.fukushu に追加する。

★設問・答えは原簿のまま（feedback_genbo_dori）。答え方だけアプリの様式に変える。
★複合の答え（「つる4わ、かめ2ひき」等）は、ラベル＋数値＋単位に分けて
  テンキーで打てる複数stepに自動で割る。
★図SVGは原簿の「- 図SVG:」欄からそのまま読み込む。
★実装しないと決めたHG番号は SKIP に列挙する。

使い方: python scripts/g3b3_add_daimon.py [--write]
"""
import argparse
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from g3b3_parse import load_records, parse_record, CIRCLED

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

# ── HGに対応する回番号（HG-IDレンジで判定）───────────────────────────────
ROUND_RANGES = [
    (4364, 4381, 32), (4382, 4398, 33), (4399, 4412, 34), (4413, 4425, 35),
    (4426, 4443, 36), (4444, 4460, 37), (4461, 4480, 38), (4481, 4492, 39),
    (4493, 4505, 40), (4506, 4515, 41), (4516, 4542, 42), (4543, 4571, 43),
]


ROUND_UNIT = {
    32: "場合の数", 33: "場合の数", 34: "場合の数", 35: "方陣算", 36: "線分図で考える",
    37: "年れい算", 38: "つるかめ算・倍数算", 39: "消去算", 40: "差集め算・過不足算",
    41: "きまりをみつけて解く問題", 42: "まとめ(1)", 43: "まとめ(2)",
}


def round_of(hg):
    n = int(hg.split("-")[1])
    for lo, hi, no in ROUND_RANGES:
        if lo <= n <= hi:
            return no
    return None


# ── 図SVGキャッシュ ─────────────────────────────────────────────────────
_g = io.open(find_genbo(), encoding="utf-8").read()
_SVG_CACHE = {}
for _r in re.split(r"(?=^### 【HG-)", _g, flags=re.M):
    _m = re.match(r"### 【(HG-\d+)】", _r)
    if not _m:
        continue
    _m2 = re.search(r"^- 図SVG: (.+)$", _r, re.M)
    if _m2:
        _SVG_CACHE[_m.group(1)] = _m2.group(1).strip().strip("`")


def svg_of(hg):
    v = _SVG_CACHE.get(hg, "")
    return "" if v in ("判読不能", "") else v


UNITS = ["円", "こ", "とおり", "人", "才", "本", "kg", "g", "cm", "m", "km",
         "L", "dL", "mL", "試合", "回", "まい", "通り", "分", "秒", "時間", "日",
         "度", "個", "枚", "わ", "ひき", "頭", "さつ", "たば", "行", "列", "段目",
         "番目", "位", "組", "倍", "年後", "年前", "本目", "分後", "分前"]


def is_numpad(a):
    a = a.strip()
    a = re.sub(r"[（(](ずつ|そのまま)[）)]$", "", a).strip()
    return bool(re.match(r"^\d+(\.\d+)?$", a) or re.match(r"^\d+/\d+$", a) or
                re.match(r"^\d+と\d+/\d+$", a) or ("余り" in a))


LABEL_NUM_RE = re.compile(
    r"([^、,0-9０-９]{0,10}?)\s*(\d+(?:\.\d+)?)(円|こ|とおり|人|才|本|kg|g|cm|m|km|"
    r"L|dL|mL|試合|回|まい|通り|分|秒|時間|日|度|個|枚|わ|ひき|頭|さつ|たば|倍|年後|年前|本目)?")


def split_compound(ans):
    """「つる4わ、かめ2ひき」→[("つる","4","わ"),("かめ","2","ひき")]。割れなければNone。"""
    segs = re.split(r"[、,]\s*", ans.strip())
    if len(segs) < 2:
        return None
    out = []
    for seg in segs:
        m = LABEL_NUM_RE.fullmatch(seg.strip())
        if not m:
            return None
        out.append((m.group(1).strip(), m.group(2), m.group(3) or ""))
    return out


def build_steps_for_part(qtext, atext, meaning):
    """1つの(問い、答え)から、複数のアプリstepを作る。"""
    atext = atext.strip()
    core = re.sub(r"[（(](ずつ|そのまま)[）)]$", "", atext).strip()
    for u in sorted(UNITS, key=len, reverse=True):
        if core.endswith(u):
            core = core[: -len(u)]
            break
    if is_numpad(core):
        return [dict(question=qtext, answer=core, meaning=meaning)]
    comp = split_compound(atext)
    if comp:
        steps = []
        for label, num, unit in comp:
            q = "%s（%s）は何%sですか？" % (qtext, label, unit) if label else qtext
            steps.append(dict(question=q, answer=num, meaning=meaning))
        return steps
    return None  # 呼び出し側でchoices手当てが必要


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--report-only", action="store_true",
                     help="自動変換できなかったHGの一覧だけ出す")
    args = ap.parse_args()

    from g3b3_manual import MANUAL, SKIP

    recs = load_records()
    rounds = {}
    unresolved = []
    for hg, title, rec in recs:
        if hg in SKIP:
            continue
        no = round_of(hg)
        p = parse_record(hg, title, rec)
        m = re.search(r"No\.\d+\s*[「『](.+?)[」』]", "".join([])) or None

        if hg in MANUAL:
            spec = MANUAL[hg]
        else:
            steps = []
            ok = True
            for k in sorted(p["qparts"]):
                qt = p["qparts"][k]
                at = p["aparts"].get(k, "")
                mn = p["kparts"].get(k, "")
                sub = build_steps_for_part(qt, at, mn)
                if sub is None:
                    ok = False
                    break
                steps.extend(sub)
            if not ok:
                unresolved.append((hg, p["ans_text"]))
                continue
            # 見出しの（…）部分をタイトルに
            tm = re.search(r"[（(](.+?)[）)]\s*$", title)
            short_title = tm.group(1) if tm else title
            star = 1
            if "むずかしい" in title:
                star = 2
            if "チャレンジ" in title:
                star = 3
            spec = dict(title=short_title, category="keisan", star=star, unit=ROUND_UNIT.get(no, ""),
                        intro=p["intro"] or p["setmon"] if len(p["qparts"]) <= 1 else p["intro"],
                        steps=steps)
        rounds.setdefault(no, []).append((hg, spec))

    print("自動変換できなかった: %d 件" % len(unresolved))
    for hg, at in unresolved:
        print("  ", hg, repr(at))

    if args.report_only:
        return

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    total_new = 0
    for no, items in sorted(rounds.items()):
        arr = d["grades"]["3"]["master_bunsatsu"]["fukushu"].setdefault(str(no), [])
        have_src = {x.get("src") for x in arr}
        existing_ids = [x["id"] for x in arr]

        def next_id():
            used = set()
            for i in existing_ids:
                mm = re.match(r"hd3mb_%02d_(\d+)" % int(no), i)
                if mm:
                    used.add(int(mm.group(1)))
            k = 1
            while k in used:
                k += 1
            used.add(k)
            return "hd3mb_%02d_%d" % (int(no), k)

        combined = list(arr)
        for hg, spec in items:
            if hg in have_src:
                continue
            steps = []
            for st in spec["steps"]:
                s = {"question": st["question"], "answer": st["answer"]}
                if "choices" in st:
                    s["choices"] = st["choices"]
                s["meaning"] = st.get("meaning", "")
                steps.append(s)
            rec = {
                "src": hg, "title": spec["title"], "category": spec.get("category", "keisan"),
                "unit": spec.get("unit") or ROUND_UNIT.get(no, ""), "grade": 3, "star": spec.get("star", 1),
                "intro": spec.get("intro", ""), "svg": svg_of(hg), "steps": steps,
            }
            rec["id"] = next_id()
            existing_ids.append(rec["id"])
            combined.append(rec)
            have_src.add(hg)
            total_new += 1
        combined.sort(key=lambda x: int(re.search(r"HG-(\d+)", x["src"]).group(1)))
        d["grades"]["3"]["master_bunsatsu"]["fukushu"][str(no)] = combined
        print("No.%s: %d本 -> %d本" % (no, len(arr), len(combined)))

    print("新規追加:", total_new, "本")
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
