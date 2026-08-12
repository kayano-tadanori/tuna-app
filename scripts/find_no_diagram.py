# -*- coding: utf-8 -*-
"""check_genbo.pyの「未収録」リストのうち、図なし・答え確定・読解でもない
   ＝すぐ着手できる候補だけを抜き出す。
   使い方：  python scripts/find_no_diagram.py
   結果は docs/genbo_no_diagram.md に自動保存される（手で編集しない）。
"""
import json, io, os, re, sys, collections, glob, datetime
import sys, io as _io
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
GENBO = find_genbo()

g = io.open(GENBO, encoding="utf-8").read()
recs = [r for r in re.split(r"(?=^### 【HG-)", g, flags=re.M) if re.match(r"### 【HG-\d+】", r)]
hid = lambda r: re.match(r"### 【(HG-\d+)】", r).group(1)
heads = {hid(r): r.split("\n")[0].split("】", 1)[1] for r in recs}
recs_body = {hid(r): r for r in recs}

# ── ここから下は check_genbo.py と同じ分類ロジック（原簿の分母づくり）。
#    2つのファイルで判定がズレないよう、コースの数字が食いちがったら
#    まず check_genbo.py 側を直してから、こちらにも同じ修正を反映すること。
COURSE_PAT = [
    ("rika",   re.compile(r"^小(\d)\s*理科")),
    ("sairei", re.compile(r"^小(\d)\s*(?:最レ|最高レベル)")),
    ("nd2",    re.compile(r"^小(\d)\s*2nd")),
    ("nadago", re.compile(r"^小(\d)\s*灘合")),
    ("kokugo", re.compile(r"^小(\d)\s*国語")),
    ("master", re.compile(r"^小(\d)\s*(?:マスター|復習|本科|実力|No\.)")),
]
gen = collections.defaultdict(set)
for k, v in heads.items():
    for course, pat in COURSE_PAT:
        m = pat.match(v)
        if m:
            gen[(m.group(1), course)].add(k)
            break

NADAGO_ID_RANGES = {"3": range(1901, 2011), "4": range(2301, 2431), "5": range(2201, 2279)}
for grade, rng in NADAGO_ID_RANGES.items():
    for n in rng:
        k = "HG-%04d" % n
        if k in heads:
            gen[(grade, "nadago")].add(k)

KOKAI_PAT = re.compile(r"^(\d{4})年?度?\s*(?:小(\d)|(\d)年)公開")
for k, v in heads.items():
    m = KOKAI_PAT.match(v)
    if m:
        grade = m.group(2) or m.group(3)
        subj = "rika" if "理科" in v[:20] else "master"
        gen[(grade, subj)].add(k)

NADAGO_MOSHI_PAT = re.compile(r"^\d{4}年?度?\s*小?(\d)年?\s*灘中(?:日本一模試|日本一模擬入試|チャレンジ)")
for k, v in heads.items():
    m = NADAGO_MOSHI_PAT.match(v)
    if m:
        gen[(m.group(1), "master")].add(k)

JITSURYOKU_PAT = re.compile(r"^\d{4}\s*(\d)年\s*実力")
for k, v in heads.items():
    m = JITSURYOKU_PAT.match(v)
    if m:
        gen[(m.group(1), "master")].add(k)

d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))

KOKUGO_DONE = set()
KOKUGO_FILES = glob.glob(os.path.join(BASE, "data", "kokugo_*.json")) + \
    [os.path.join(BASE, "data", "hama_kokugo.json")]
for fn in KOKUGO_FILES:
    if not os.path.exists(fn):
        continue
    txt = io.open(fn, encoding="utf-8").read()
    KOKUGO_DONE.update(re.findall(r"原簿\s*(HG-\d+)", txt))
    KOKUGO_DONE.update(re.findall(r'"src"\s*:\s*"(HG-\d+)"', txt))

SAME = set(["HG-1520", "HG-1567", "HG-1564", "HG-1565", "HG-0751", "HG-0772", "HG-2362", "HG-2239"])
CANNOT = set(["HG-2202", "HG-2548", "HG-2549", "HG-2551", "HG-1278", "HG-1107", "HG-1121", "HG-1126",
              "HG-3769", "HG-3770", "HG-3771", "HG-1489"])


def hgof(x):
    if x.get("hg"):
        parts = re.split(r"\s*\+\s*", x["hg"])
        out = []
        for p in parts:
            m = re.search(r"HG-(\d+)", p)
            if m:
                out.append(m.group(0))
            else:
                m2 = re.search(r"(\d+)", p)
                if m2:
                    out.append("HG-" + m2.group(1))
        return out if out else None
    m = re.search(r"HG-\d+", x.get("src", "") or "")
    return [m.group(0)] if m else None


APP_COURSE_KEY = {"nd2": "master2nd"}
COURSE_LABEL = {"master": "マスター", "sairei": "最レ", "nd2": "2nd演習", "rika": "理科", "nadago": "灘合"}

all_missing = {}
for (grade, course) in sorted(gen):
    if course == "kokugo":
        miss = sorted(gen[(grade, course)] - KOKUGO_DONE - CANNOT - SAME)
        all_missing[(grade, "kokugo")] = miss
        continue
    node = d["grades"].get(grade, {}).get(APP_COURSE_KEY.get(course, course), {})
    extra_nodes = []
    if course == "nadago":
        extra_nodes.append(d["grades"].get(grade, {}).get("nadago_rika", {}))
    inapp = set()
    for nd in [node] + extra_nodes:
        for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
            for v in nd.get(kind, {}).values():
                for x in v:
                    h = hgof(x)
                    if h:
                        inapp.update(h)
    miss = sorted(gen[(grade, course)] - inapp - CANNOT - SAME - KOKUGO_DONE)
    all_missing[(grade, course)] = miss

# ── ここから「図なし判定」。原簿の「図:」欄は書式が3通り混在しているので注意
#   （2026-08-12発覚）：①行頭の独立欄「- 図: あり」②図の中身を直接書いた行
#   「- 図: **半径1cmの円柱…**」③他欄と1行にまとめた「／図: **必須**／」。
#   さらに欄自体が無く、設定文や作問メモに「図が要る」とだけ書いてある場合もある。
#   全パターンを拾わないと、図が要る問題を「図なし」に誤判定する（実際に
#   小4灘合 第5回・第9回でこの誤判定が起きた）。
NO_ZU_WORDS = ("なし", "不要", "特になし")


def needs_diagram(hg):
    body = recs_body.get(hg, "")
    for m in re.finditer(r"図[:：]\s*([^\n／]+)", body):
        val = m.group(1).strip()
        if val and not any(w in val[:6] for w in NO_ZU_WORDS):
            return True
    if re.search(r"図SVG[:：]", body):
        return True
    if re.search(r"下の図|次の図|図のような|図に|図1|図２|図①|図が要る|図が必要|図必須", body):
        return True
    return False


def answer_unconfirmed(hg):
    # 「- 答え: 」欄だけでなく本文全体を対象にする（設定と答えが1行に合体した
    # 書式のレコードがあるため。安全側に倒して広めに拾う）
    body = recs_body.get(hg, "")
    return bool(re.search(r"要現物照合|未確定|判読不能", body))


def is_reading_comp(hg, headline):
    body = recs_body.get(hg, "")
    if "国語" not in headline:
        return False
    # 読解＝本文引用/線部参照に依存する設問。漢字・ことわざ・慣用句等の独立項目は除く
    return bool(re.search(r"――線|本文中|本文の|傍線", body))


buckets = {"clean": [], "unconfirmed": [], "reading_comp": [], "has_diagram": []}
for (grade, course), miss in sorted(all_missing.items()):
    nm = "小%s%s" % (grade, COURSE_LABEL.get(course, course))
    for h in miss:
        headline = heads[h]
        tag = (nm, h, headline[:55])
        if needs_diagram(h):
            buckets["has_diagram"].append(tag)
        elif answer_unconfirmed(h):
            buckets["unconfirmed"].append(tag)
        elif is_reading_comp(h, headline):
            buckets["reading_comp"].append(tag)
        else:
            buckets["clean"].append(tag)

# ── docs/genbo_no_diagram.md に自動保存（check_genbo.pyのdocs/genbo_status.mdと同じ方式）
STATUS_FILE = os.path.join(BASE, "docs", "genbo_no_diagram.md")
os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
out = io.open(STATUS_FILE, "w", encoding="utf-8")


def w(s=""):
    print(s)
    out.write(s + "\n")


w("# 図なしですぐ着手できる候補（自動生成・手で編集しない）")
w()
w("`python scripts/find_no_diagram.py` を実行するたびに丸ごと上書きされる。")
w("対象は `docs/genbo_status.md`（`check_genbo.py`）の未収録リストのうち、")
w("①図が要らない ②答えが確定している ③国語の読解(著作権要検討)でもない、の3条件を満たすもの。")
w("この判定はあくまで機械的なスクリーニング。着手前に必ず原簿の該当レコードを開いて確認すること。")
w("最終更新: %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
w()
w("```")
w("件数: %d" % len(buckets["clean"]))
cur = None
for nm, h, hl in buckets["clean"]:
    if nm != cur:
        w("\n-- %s --" % nm)
        cur = nm
    w("   %s %s" % (h, hl))
w()
w("=== 参考：除外した理由の内訳 ===")
w("図が必要: %d" % len(buckets["has_diagram"]))
w("答え未確定/要現物照合: %d" % len(buckets["unconfirmed"]))
w("読解（本文引用が要る＝著作権要検討）: %d" % len(buckets["reading_comp"]))
w("```")
out.close()
