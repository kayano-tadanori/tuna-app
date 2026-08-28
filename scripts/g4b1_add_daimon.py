# -*- coding: utf-8 -*-
"""小4マスター算数 第1分冊（No.1〜13・HG-4572〜4922・280本）を
   hama_daimon.json の grades.4.master_bunsatsu.fukushu に追加する。

★設問・答えは原簿のまま（feedback_genbo_dori）。変えるのは答え方の様式だけ。
★自動変換できないものは g4b1_manual.py の MANUAL / SKIP を使う。
★図SVGは原簿の「- 図SVG:」欄からそのまま読む（figureは原簿にしか無い＝想像で描かない）。

使い方: python scripts/g4b1_add_daimon.py [--write]
"""
import argparse
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g4b1_parse import load_records, parse_record            # noqa: E402
from g4b1_build import steps_for, MARU, KATA, KMARU                 # noqa: E402
from g4b1_manual import MANUAL, SKIP                         # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

# 回ごとのHG番号の帯（原簿の第1分冊の進捗表そのまま）
ROUND_RANGES = [
    (4572, 4594, 1), (4595, 4621, 2), (4622, 4637, 3), (4638, 4661, 4),
    (4662, 4687, 5), (4688, 4705, 6), (4706, 4726, 7), (4727, 4744, 8),
    (4745, 4762, 9), (4785, 4808, 10), (4825, 4846, 11), (4865, 4889, 12),
    (4905, 4922, 13),
]

ROUND_UNIT = {
    1: "大きな数（位取り）", 2: "かけ算・わり算の筆算", 3: "計算のくふう",
    4: "概数（がい数）", 5: "小数の計算", 6: "小数の計算", 7: "表とグラフの読み取り",
    8: "分数", 9: "分数", 10: "数の性質", 11: "数の性質",
    12: "長さ・重さ（単位換算）", 13: "速さ",
}
ROUND_CAT = {
    1: "kazu", 2: "keisan", 3: "keisan", 4: "kazu", 5: "keisan", 6: "keisan",
    7: "bun", 8: "keisan", 9: "keisan", 10: "kazu", 11: "kazu",
    12: "bun", 13: "hayasa",
}


def round_of(hg):
    n = int(hg.split("-")[1])
    for lo, hi, no in ROUND_RANGES:
        if lo <= n <= hi:
            return no
    return None


def star_of(title):
    """難易度＝原簿の★の数と、教材の段（テーマ/練習＜B問題＜C問題）の高い方。
       ★だけ／段だけで決めると、無印の計算ドリルがC問題より上に来るなどの逆転が起きる。"""
    m = re.search(r"(★+)\s*$", title)
    star = min(3, len(m.group(1))) if m else 1
    sec = 3 if "C問題" in title else 2 if "B問題" in title else 1
    return max(star, sec)


def short_title(title):
    m = re.search(r"[（(]([^（）()]+)[）)]\s*★*\s*$", title)
    if m:
        return m.group(1)
    return re.sub(r"^小4マスター算数第1分冊\s*", "", title).strip("★ ")


def stem_of(setmon, qparts):
    """①の前に置かれた指示文（設定＋「つぎの…しなさい。」）を取り出す。"""
    if list(qparts) == [0]:
        return ""
    def first(marks):
        pos = [setmon.find(marks[k - 1]) for k in qparts
               if 1 <= k <= len(marks) and marks[k - 1] in setmon]
        return min(pos) if pos else -1
    i, j = first(MARU), first(KATA)
    cut = i if i >= 0 else j
    return setmon[:cut].strip() if cut > 0 else ""


def clean_meaning(text, bone_map):
    """解法（または骨）を、子どもが読む解説として整える。
       『HG-4597の骨を…』のような内輪の言い回しは、指しているレコードの骨に置きかえる。"""
    if not text:
        return ""
    t = text.strip()
    # 「HG-4642の反復」のように、別のレコードの考え方を指しているだけの骨は、
    # 指している先の考え方に置きかえる（そのまま消すと解説が空になる）
    for _ in range(3):
        m0 = re.match(r"(HG-\d+)(?:[①-⑳])*(?:と同じ)?(?:骨)?の(?:骨の)?反復[。、]?\s*", t)
        if not m0:
            break
        ref = bone_map.get(m0.group(1), "")
        rest = t[m0.end():].strip()
        if not ref:
            break
        t = (ref.rstrip("。") + ("。　" + rest if rest else "。")).strip()
    m = re.match(r"(HG-\d+)(?:①②③④⑤⑥⑦⑧⑨⑩)?[^。]*?と同じ骨[^。]*。?", t)
    if m:
        rest = t[m.end():].strip()
        base = bone_map.get(m.group(1), "")
        t = (base + ("　" + rest if rest else "")).strip()
    t = re.sub(r"HG-\d+の骨を", "同じ考え方を", t)
    t = re.sub(r"HG-\d+[①-⑩]*と同じ骨の反復。?", "", t)
    t = re.sub(r"HG-\d+", "前の問題", t)
    t = re.sub(r"^前の問題[①-⑳]*(?:と同じ骨)?の反復[。、]?\s*", "", t)
    t = re.sub(r"^前の問題[①-⑳]*と同じ骨[。、]?\s*", "", t)
    t = re.sub(r"★?\s*解答p\d+の別解\s*[：:]?", "別のやり方：", t)
    t = re.sub(r"[（(]?解答p\d+[）)]?の?(解説|表)?と?一致[。、]?", "", t)
    t = re.sub(r"[（(]?解答p\d+[）)]?", "", t)
    t = re.sub(r"[^。]*灘度[^。]*(?:。|$)", "", t)          # 制作側の物差しは子どもに出さない
    t = t.replace("衣装ちがい", "同じ考え方の別の場面").replace("衣装", "場面")
    t = t.replace("骨そのもの", "考え方そのもの").replace("の骨", "の考え方").replace("骨は", "考え方は")
    t = t.replace("骨", "考え方")
    t = re.sub(r"・\s*\d{4}\s*", "", t)             # 「前の問題・4574」のような番号の残骸
    t = t.replace("|", "／")          # 4けた区切りの「|」を「／」に
    t = t.replace("**", "").strip(" 　、。・")
    return t + ("。" if t and t[-1] not in "。」）)" else "")


def kaihou_part(kaihou, mark):
    """解法の中から『① …』の一節だけを取り出す。無ければ None。"""
    i = kaihou.find(mark)
    if i < 0:
        return None
    j = len(kaihou)
    for ch in MARU + KMARU:
        k = kaihou.find(ch, i + 1)
        if k > i:
            j = min(j, k)
    return kaihou[i + 1:j].strip(" 　、。")


def has_marks(kaihou):
    return any(ch in kaihou for ch in MARU[:12])


CLEAN_Q = [
    (re.compile(r"[（(]※[^）)]*[）)]"), ""),        # 「（※原典では…）」などの編集メモ
    (re.compile(r"[（(]本文では[^）)]*[）)]"), ""),
    (re.compile(r"\n?\s*[（(]図[）)]\s*"), " "),      # 図のプレースホルダ（実際はSVGが出る）
]


def clean_question(q):
    for pat, rep in CLEAN_Q:
        q = pat.sub(rep, q)
    return re.sub(r"[ \t]{2,}", " ", q).strip()


HEADING = re.compile(r"[\s　]*[\(（]\d[\)）][^①-⑳]{0,20}?(?:なさい|ください)。[\s　]*$")


def move_headings(qp):
    """『③ …　(2) ひき算をしなさい。』のように、次のまとまりの見出しが前の設問の
       おしりに くっついてしまうのを、次の設問の頭へ移す。"""
    ks = sorted(qp)
    for a, b in zip(ks, ks[1:]):
        m = HEADING.search(qp[a])
        if m and m.start() > 0:
            qp[a] = qp[a][:m.start()].strip()
            qp[b] = (m.group(0).strip() + " " + qp[b]).strip()
    return qp


def join_mean(bone, kaihou):
    """解説＝『考え方（骨）』＋『そのときの計算（解法）』。片方しか無ければそれだけ。"""
    bone = (bone or "").strip()
    kaihou = (kaihou or "").strip()
    if bone and kaihou and bone[:12] not in kaihou:
        return bone.rstrip("。") + "。　" + kaihou
    return kaihou or bone


# 「右の◯◯」を「下の◯◯」に直す組。第1分冊はこれまでどおり「右の」全部。
# 第2分冊は「右の辺」「右の2つの曲線」のように図の中の位置を指す言い方が多いので、
# g4b2_conf が「右の図／右図」だけに絞りこむ（塾講師の監査で出た指摘）。
MIGI_REPL = [("右の", "下の")]

# 分冊ごとの「レコード1本まるごとを別の作り方で組む」差しこみ口。
# 既定は None＝差しこみ無し（第1分冊はここを使わない）。第2分冊は g4b2_conf が入れる。
PRE_HOOK = None


def build_specs():
    """原簿の全レコードを (hg, no, spec) に組み立てて返す。unresolved も返す。"""
    recs = load_records()
    bone_map = {}
    for hg, title, rec in recs:
        m = re.search(r"^- 骨: (.+)$", rec, re.M)
        if m:
            bone_map[hg] = m.group(1).replace("**", "").strip()

    out, unresolved = [], []
    for hg, title, rec in recs:
        if hg in SKIP:
            continue
        no = round_of(hg)
        if no is None:
            unresolved.append((hg, "回が決まらない"))
            continue
        p = parse_record(hg, title, rec)

        pre = PRE_HOOK(hg, title, p, bone_map) if (PRE_HOOK and hg not in MANUAL) else None
        if pre:
            spec = dict(pre)
            spec.setdefault("intro", p["intro"])
            spec["star"] = star_of(title)
            spec.setdefault("title", short_title(title))
            spec.setdefault("kind", "自動（差しこみ）")
        elif hg in MANUAL:
            spec = dict(MANUAL[hg])
            spec.setdefault("intro", p["intro"])
            spec["star"] = star_of(title)
            spec["kind"] = "手作業"
        else:
            qp = p["qparts"]
            marks = MARU if p["akind"] != "kata" else KATA
            if len(p["aparts"]) == 1 and 0 in p["aparts"]:
                qp = {0: p["setmon"]}
            elif list(qp) == [0] and len(p["aparts"]) > 1:
                qp = {k: p["setmon"] for k in p["aparts"]}
            qp = move_headings(qp)
            stem = stem_of(p["setmon"], qp)
            bone = clean_meaning(bone_map.get(hg, ""), bone_map)
            kaihou = clean_meaning(p["kaihou"], bone_map)
            base_mean = join_mean(bone, kaihou)
            marked = has_marks(p["kaihou"])
            ans_all = [str(v) for v in p["aparts"].values() if v]
            leaks = sum(1 for a in ans_all if len(a) >= 2 and a in p["kaihou"])
            if not marked and len(ans_all) > 2 and leaks >= 2:
                base_mean = bone or base_mean
            steps, ok = [], True
            for k in sorted(qp):
                qt, at = qp[k], p["aparts"].get(k, "")
                kp = p["kparts"].get(k, "")
                if not kp and marked and k:
                    seg = kaihou_part(p["kaihou"], marks[k - 1]) if k <= len(marks) else None
                    kp = seg or ""
                    if not seg:
                        kp = None      # この小問の解法が無い＝考え方だけ見せる
                kp = clean_meaning(kp, bone_map) if kp else ("" if kp == "" and marked else None)
                if kp:
                    mn = join_mean(bone, kp)
                elif marked:
                    mn = bone or base_mean
                else:
                    mn = base_mean
                if k and len(qp) > 1:
                    qt = "%s %s" % (marks[k - 1], qt)
                    mh = re.match(r"^([①-⑳])\s+([(（]\d[)）][^①-⑳]{0,20}?"
                                  r"(?:なさい|ください)。)\s*(.*)$", qt, re.S)
                    if mh:
                        qt = "%s %s %s" % (mh.group(2), mh.group(1), mh.group(3))
                sub = steps_for(qt, at, mn, p["setmon"]) if at else None
                if sub is None:
                    ok = False
                    break
                steps.extend(sub)
            if not ok:
                unresolved.append((hg, p["ans_text"][:60]))
                continue
            for st in steps:
                st["question"] = clean_question(st["question"])
            intro = (p["intro"] + ("　" if p["intro"] and stem else "") + stem).strip()
            if steps and any(re.match(r"^[(（]\d[)）]", st["question"]) for st in steps):
                # (1)(2) と指示が切りかわる大問は、頭の指示を intro に置くと
                # 後半の設問と食いちがう（HG-4737）。1問目の頭へ移す
                if stem:
                    steps[0]["question"] = clean_question(stem + " " + steps[0]["question"])
                intro = p["intro"].strip()
            spec = dict(title=short_title(title), star=star_of(title), kind="自動",
                        intro=intro, steps=steps)

        # 紙では図が右にあるが、アプリでは問題文の上に出る。「右の」だけを「下の」に直す
        # （左上／左下／右下 のように位置を組で使い分けている大問は、意味が変わるので触らない）
        if p["svg"]:
            txts = [spec.get("intro", "")] + [st["question"] for st in spec["steps"]]
            if not any(w in t for t in txts for w in ("左下", "左上", "右下")):
                for a, b in MIGI_REPL:
                    if spec.get("intro"):
                        spec["intro"] = spec["intro"].replace(a, b)
                    for st in spec["steps"]:
                        st["question"] = st["question"].replace(a, b)
        spec.setdefault("unit", ROUND_UNIT[no])
        spec.setdefault("category", ROUND_CAT[no])
        spec["svg"] = p["svg"]
        out.append((hg, no, spec))
    return out, unresolved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--rebuild", action="store_true",
                    help="grades.4.master_bunsatsu を空にしてから作り直す")
    args = ap.parse_args()

    built, unresolved = build_specs()
    rounds = {}
    for hg, no, spec in built:
        rounds.setdefault(no, []).append((hg, spec))
    print("=== 小4マスター算数 第1分冊 → 大問 ===")
    print("作らないと決めたもの: %d本" % len(SKIP))
    for hg, why in SKIP.items():
        print("   %s … %s" % (hg, why))
    if unresolved:
        print("❌ 変換できなかった: %d件" % len(unresolved))
        for hg, at in unresolved:
            print("   ", hg, repr(at))

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    if args.rebuild:
        d["grades"]["4"]["master_bunsatsu"] = {"fukushu": {}}
    node = d["grades"]["4"].setdefault("master_bunsatsu", {}).setdefault("fukushu", {})
    total_new = 0
    for no, items in sorted(rounds.items()):
        arr = node.setdefault(str(no), [])
        have = {x.get("src") for x in arr}
        used = set()
        for x in arr:
            mm = re.match(r"hd4mb_%02d_(\d+)$" % no, x.get("id", ""))
            if mm:
                used.add(int(mm.group(1)))
        combined = list(arr)
        for hg, spec in items:
            if hg in have:
                continue
            k = 1
            while k in used:
                k += 1
            used.add(k)
            steps = []
            for st in spec["steps"]:
                o = {"question": st["question"], "answer": st["answer"]}
                if st.get("choices"):
                    o["choices"] = st["choices"]
                o["meaning"] = st.get("meaning", "")
                steps.append(o)
            combined.append({
                "id": "hd4mb_%02d_%d" % (no, k), "src": hg,
                "title": spec["title"], "category": spec["category"],
                "unit": spec["unit"], "grade": 4, "star": spec["star"],
                "intro": spec.get("intro", ""), "svg": spec.get("svg", ""),
                "steps": steps,
            })
            total_new += 1
        combined.sort(key=lambda x: int(re.search(r"HG-(\d+)", x["src"]).group(1)))
        node[str(no)] = combined
        print("No.%-2s %2d本 %3d問" % (no, len(combined),
                                       sum(len(y["steps"]) for y in combined)))

    print("新規: %d本 / %d問" % (total_new,
                                  sum(len(y["steps"]) for v in node.values() for y in v)))
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
