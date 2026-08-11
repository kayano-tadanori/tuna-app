# -*- coding: utf-8 -*-
"""原簿とアプリの大問を突き合わせ、取りこぼしを洗い出す。
   浜学園のデータを触ったら必ず実行すること。
   使い方：  python scripts/check_genbo.py
"""
import json, io, os, re, sys, collections
import sys, io as _io
# Windowsのcp932コンソールでも絵文字・矢印が出せるようにする
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
GENBO = find_genbo()

g = io.open(GENBO, encoding="utf-8").read()
recs = [r for r in re.split(r"(?=^### 【HG-)", g, flags=re.M) if re.match(r"### 【HG-\d+】", r)]
hid = lambda r: re.match(r"### 【(HG-\d+)】", r).group(1)
heads = {hid(r): r.split("\n")[0].split("】", 1)[1] for r in recs}
recs_body = {hid(r): r for r in recs}   # 図SVG欄の検査に使う（本文まるごと）

# 原簿のレコードを 学年×コース で分ける（最レとマスターは必ず分ける）
# ★同じコースが 複数の名前で書かれている（2026-07-28 に発覚し 51本を見落としていた）
#   マスター系＝「マスター」「マスター1st」「マスターV/VS」「復習」「本科」
#   最レ系  ＝「最レ」「最高レベル」
#   2nd演習 は 別コース扱い（アプリにコースが無いので今は集計だけ）
#   ★見出しの型は 実物を読むたびに増える。**必ずここを見直す**
#     （2026-07-28：小5マスターが4名称に散っていて51本、小4マスターが「小4 No.x」形式で74本、
#       小5の実力が「小5 実力テストV」で2本 ── 合わせて127本を見落としていた）
COURSE_PAT = [
    ("rika",   re.compile(r"^小(\d)\s*理科")),
    ("sairei", re.compile(r"^小(\d)\s*(?:最レ|最高レベル)")),
    ("nd2",    re.compile(r"^小(\d)\s*2nd")),
    ("master", re.compile(r"^小(\d)\s*(?:マスター|復習|本科|実力|No\.)")),
]
gen = collections.defaultdict(set)
for k, v in heads.items():
    for course, pat in COURSE_PAT:
        m = pat.match(v)
        if m:
            gen[(m.group(1), course)].add(k)
            break

d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))

# ★作れないと分かっているレコード（原簿側に理由が書いてある）
# ★同じ問題が2つの番号で原簿に載っているもの（片方を作れば足りる）
SAME = {
    "HG-1520": "HG-0661（小5実力のバス運賃表。同じ問題が2回レコード化されている）",
    "HG-1567": "HG-0717（小5マスターNo.14・固体液体の基準入れかわり。誘導つき版が既存）",
    "HG-1564": "HG-0718（小5マスターNo.14・1日目2日目で読み切る本。誘導つき版が既存）",
    "HG-1565": "HG-0719（小5マスターNo.14・残りは使った分の半分。誘導つき版が既存）",
    "HG-0751": "HG-0784（月の南中が毎日約50分おそくなる、同じ骨が既存＝grade4理科）",
    "HG-0772": "HG-0771（星A〜Fの等級を決める6条件、内容が完全に一致。src表記だけHG-0771のまま）",
}

CANNOT = {
    "HG-1278": "小5最レNo.12大問7（目盛りが無い時計）。スキャンで針が完全に落ちていて答えが未確定。原本があれば埋まる",
    "HG-1107": "度数分布表そのものが原簿に無く、問題を再現できない",
    "HG-1121": "答えが「7時21と9/11分」など 帯分数の時刻で、テンキーでも4択でも出しにくい",
    "HG-1126": "原簿でも『印字が判読困難で確定解は保留』",
    # ★答えが「絵」の作図問題。テンキーでも4択でも答えられない（本人判断 2026-08-11）
    "HG-3769": "展開図の頂点に記号を書きこむ作図問題。答えが図そのもの",
    "HG-3770": "立方体のテープの線を展開図にかき入れる作図問題。答えが図そのもの",
    "HG-3771": "展開図に「さんすう」の文字を並べて書く作図問題。答えが図そのもの",
}


def hgof(x):
    # ★"hg"欄が "HG-0793+0794" のように複数番号を+でつないでいることがある
    #   （1レコードで2つの原簿番号をまとめて解消した場合）。全部ばらして返す。
    #   "+0794" は "HG-"が省略された2番目の番号なので、桁数をそろえて補う。
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


print("=== 原簿 ⇄ 大問 の 突き合わせ ===")
print("%-12s %6s %6s %6s   %s" % ("コース", "原簿", "大問", "問数", "未収録"))
ng = 0
nohg = []
for (grade, course) in sorted(gen):
    if course in ("nd2",):                   # アプリにコースが無い。集計だけ出す
        print("%-12s %5d本 %5s %5s   %s" % (
            "小%s2nd演習" % grade, len(gen[(grade, course)]), "—", "—", "**アプリにコースが無い**"))
        ng += len(gen[(grade, course)])
        continue
    node = d["grades"].get(grade, {}).get(course, {})
    inapp = set()
    n = q = 0
    for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
        for v in node.get(kind, {}).values():
            for x in v:
                n += 1
                q += len(x.get("steps", []))
                h = hgof(x)
                if h:
                    inapp.update(h)
                else:
                    nohg.append((grade, course, x.get("id")))
    miss = sorted(gen[(grade, course)] - inapp - set(CANNOT) - set(SAME))
    nm = "小%s%s" % (grade, {"master": "マスター", "sairei": "最レ", "nd2": "2nd演習", "rika": "理科"}[course])
    print("%-12s %5d本 %5d本 %5d問   %s" % (
        nm, len(gen[(grade, course)]), n, q,
        ("**%d本** %s" % (len(miss), miss[:8])) if miss else "なし"))
    ng += len(miss)

print()
print("※ 同じ問題の重複（除外）: %s" % ", ".join(
    "%s＝%s" % (k, v) for k, v in sorted(SAME.items())))
print("※ 作れないと分かっているレコード（除外）: %s" % ", ".join(
    "%s（%s）" % (k, v) for k, v in sorted(CANNOT.items())))
print()
fail = 0
if nohg:
    print("❌ 原簿番号が付いていない大問 %d本（どの原簿から作ったか追えない）" % len(nohg))
    for a in nohg[:20]:
        print("   小%s %s %s" % a)
    fail += 1
if ng:
    print("❌ 原簿にあるのに 大問になっていない レコードが %d本 ある" % ng)
    fail += 1
if not fail:
    print("✅ 原簿のレコードは すべて 大問になっている／全部に原簿番号が付いている")

# ── 図の作法（2026-08-11 追加）────────────────────────────────
# ★ここは上のチェックが落ちても必ず走らせる。
#   前は sys.exit が手前にあって、既存の未解決エラーに隠れて図の検査に来なかった。
# ★原簿に図は入っていない。「図: あり」は記述だけで、図の根拠はPDFにしかない。
#   ルールを文章で置いても読まれないので、ここで落とす。
#   これに引っかかったら [[feedback_zu_wa_genbo_ni_nai]] を読むこと。
print()
bad_fill = []      # <text> に fill が無い＝暗い背景で黒文字になる
bad_style = []     # ルートに display/max-width が無い＝はみ出す
DARK = ("#333", "#888", "#666", "#000", "#111", "#222", "#1a2340")
bad_dark = []      # 暗すぎる線・文字
for grade, gv in d.get("grades", {}).items():
    for course, node in gv.items():
        if not isinstance(node, dict):
            continue
        for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
            for key, v in (node.get(kind) or {}).items():
                for x in v:
                    svg = x.get("svg")
                    if not svg:
                        continue
                    who = "%s/%s/%s/%s" % (grade, course, kind, x.get("id") or x.get("hg"))
                    for t in re.findall(r"<text[^>]*>", svg):
                        if "fill=" not in t:
                            bad_fill.append(who)
                            break
                    head = svg.split(">", 1)[0]
                    if "max-width" not in head:
                        bad_style.append(who)
                    for c in DARK:
                        if ('fill="%s"' % c) in svg or ('stroke="%s"' % c) in svg:
                            bad_dark.append(who)
                            break

# 既にあるぶんは基準線（svg_baseline.json）に逃がして、**新しく増えた違反だけ**で落とす。
# いつも赤いゲートは読まれなくなる。増えた瞬間だけ止めるのが要点。
BASELINE = os.path.join(BASE, "scripts", "svg_baseline.json")
base = {}
if os.path.exists(BASELINE):
    base = json.load(io.open(BASELINE, encoding="utf-8"))
if "--update-baseline" in sys.argv:
    io.open(BASELINE, "w", encoding="utf-8").write(json.dumps(
        {"fill": sorted(set(bad_fill)), "style": sorted(set(bad_style)),
         "dark": sorted(set(bad_dark))}, ensure_ascii=False, indent=1))
    print("基準線を今の状態で作り直した:", BASELINE)
    sys.exit(0)

fig_ng = 0
for label, arr, key, hint in (
    ("文字に色が付いていない図（暗い背景で読めない）", bad_fill, "fill", 'すべての <text> に fill を書く'),
    ("ルートに max-width が無い図（枠からはみ出す）", bad_style, "style",
     'style="display:block;margin:0 auto;max-width:100%" を付ける'),
    ("暗すぎる色を使っている図（背景に沈む）", bad_dark, "dark", "#4f9eff / #ffd166 / #9aa3c0 に置きかえる"),
):
    new = sorted(set(arr) - set(base.get(key, [])))
    if new:
        fig_ng += len(new)
        print("❌ %s **新規%d枚** … %s" % (label, len(new), hint))
        for a in new[:8]:
            print("   %s" % a)
    elif arr:
        print("・%s %d枚（既存ぶん＝基準線。新規なし）" % (label, len(arr)))
if fig_ng:
    print()
    print("→ 図は原簿に無い。PDFの実物を見てから描くこと（feedback_zu_wa_genbo_ni_nai）")
    print("→ 形の検査は python scripts/check_daimon3_svg.py（枠はみ出し・文字の重なり・箱はみ出し）")
    fail += 1
else:
    print("✅ 図の作法（文字色・max-width・暗い色）も問題なし")

# ── 原簿の「図SVG」欄との突き合わせ（2026-08-11・本人指示）──────────────
# ★図の源は原簿の「- 図SVG:」欄。アプリはそれを写すだけにする＝二度手間をなくす。
#   「図: あり」なのに 図SVG が無い＝まだPDFを見ていない、というサイン。
print()
zu_ari = {}      # HG -> True（原簿が図ありと言っている）
zu_svg = {}      # HG -> 原簿のSVG（無ければ None、判読不能なら "判読不能"）
for hg, r in heads.items():
    body = recs_body.get(hg, "")
    m = re.search(r"^- 図: (.+)$", body, re.M)
    if m and ("**あり**" in m.group(1) or "**必須**" in m.group(1)):
        zu_ari[hg] = True
    m2 = re.search(r"^- 図SVG: (.+)$", body, re.M)
    if m2:
        zu_svg[hg] = m2.group(1).strip().strip("`")

miss_svg = sorted(h for h in zu_ari if h not in zu_svg)
if miss_svg:
    print("・原簿が「図: あり」なのに 図SVG 欄が無い: %d本" % len(miss_svg))
    print("  （PDFを見て描き、原簿に入れる。読み取れないなら『- 図SVG: 判読不能』と書く）")
    for h in miss_svg[:6]:
        print("   %s" % h)
else:
    print("✅ 図がある大問には、原簿に図SVGが入っている")

if fail:
    sys.exit(1)
