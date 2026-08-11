# -*- coding: utf-8 -*-
"""原簿とアプリの大問を突き合わせ、取りこぼしを洗い出す。
   浜学園のデータを触ったら必ず実行すること。
   使い方：  python scripts/check_genbo.py
"""
import json, io, os, re, sys, collections, glob
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

# ★灘合は、1回ぶんをまとめて追加した回だと個々の見出しが「第N回 大問M」のように
#   「小4灘合」「小5灘合」の学年プレフィクスを省略していることがある
#   （2026-08-01の大量追加ぶん・小4灘合2321〜2430、小5灘合2201〜2278の大半が該当）。
#   COURSE_PATの見出し一致だけでは本当に見落とす（本人指摘 2026-08-12・110本+66本を見落としていた）。
#   HG番号の帯で「実在するIDすべて」を機械的に拾って底上げする。
NADAGO_ID_RANGES = {
    "3": range(1901, 2011),
    "4": range(2301, 2431),
    "5": range(2201, 2279),
}
for grade, rng in NADAGO_ID_RANGES.items():
    for n in rng:
        k = "HG-%04d" % n
        if k in heads:
            gen[(grade, "nadago")].add(k)

# ★公開学力テストの見出しは「2023 5年公開 第609回…」や「2020年度 小4公開 第565回…」
#   のように西暦で始まり、COURSE_PATの「小N…」パターンに一つも一致しない
#   ＝丸ごとgenから漏れていた（本人指摘 2026-08-12・333本が検査対象にすら
#   入っていなかった）。学年の書き方が「N年」と「小N」の2通りあるので両方拾う。
#   アプリ側では公開テストは算数=master・理科=rikaの"kokai"種別に入っているので、
#   既存のmaster/rika集計にそのまま合流させれば、あとの突き合わせロジックは
#   （kokai種別も見ているので）そのまま使える。
KOKAI_PAT = re.compile(r"^(\d{4})年?度?\s*(?:小(\d)|(\d)年)公開")
for k, v in heads.items():
    m = KOKAI_PAT.match(v)
    if m:
        grade = m.group(2) or m.group(3)
        subj = "rika" if "理科" in v[:20] else "master"
        gen[(grade, subj)].add(k)

# ★灘中日本一模試／灘中チャレンジ／西暦始まりの実力テストも同じ理由で漏れていた
#   （2026-08-12・公開学力テストの穴を全数監査していて発見）。
#   専用の保管場所がまだ無いので、とりあえずmasterの集計に合流させて
#   「未収録」として見えるようにする（実装先が決まったら移す）。
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

# ★国語は hama_daimon.json ではなく kokugo_*.json 側に入っている
#   （COURSE_PATは見出しの「最レ」だけで拾うので、算数と国語が同じ course
#   バケツに混ざる。ここで kokugo_*.json 内の「原簿 HG-XXXX」タグを全部拾い、
#   既に収録ずみとして扱う。2026-08-11・小5最レ国語の調査で発覚）
KOKUGO_DONE = set()
for fn in glob.glob(os.path.join(BASE, "data", "kokugo_*.json")):
    KOKUGO_DONE.update(re.findall(r"原簿\s*(HG-\d+)", io.open(fn, encoding="utf-8").read()))

# ★作れないと分かっているレコード（原簿側に理由が書いてある）
# ★同じ問題が2つの番号で原簿に載っているもの（片方を作れば足りる）
SAME = {
    "HG-1520": "HG-0661（小5実力のバス運賃表。同じ問題が2回レコード化されている）",
    "HG-1567": "HG-0717（小5マスターNo.14・固体液体の基準入れかわり。誘導つき版が既存）",
    "HG-1564": "HG-0718（小5マスターNo.14・1日目2日目で読み切る本。誘導つき版が既存）",
    "HG-1565": "HG-0719（小5マスターNo.14・残りは使った分の半分。誘導つき版が既存）",
    "HG-0751": "HG-0784（月の南中が毎日約50分おそくなる、同じ骨が既存＝grade4理科）",
    "HG-0772": "HG-0771（星A〜Fの等級を決める6条件、内容が完全に一致。src表記だけHG-0771のまま）",
    "HG-2362": "HG-2336（小4灘合第4回大問6と第7回大問1が完全に同一問題＝34.56の並べかえ四捨五入）",
    "HG-2239": "HG-2227（小5灘合第2回大問6と第3回大問8が完全に同一問題＝3種のコイン61g、灘合は回をまたいで同じ問題を再出題する）",
}

CANNOT = {
    "HG-2202": "小5灘合第6回算数大問2(ふたのない容器の展開図)。図が判読不能で答えも原簿で未確定。要現物照合",
    "HG-2548": "小5最レ国語No.5・現代詩(石垣りん「行く」)の読解。詩は著作物のため原文をアプリに載せられない。型だけ借りて自作の詩で作り直すなら別問として可",
    "HG-2549": "小5最レ国語No.6・短歌5首の鑑賞。著作権が切れているのは木下利玄(没1925)のみで他4首は存続中のため原文を載せられない。著作権切れの歌で作り直すなら別問として可",
    "HG-2551": "小5最レ国語No.7解答用紙・活用形の空所補充。選択肢群が未読で原簿でも答えが未確定",
    "HG-1278": "小5最レNo.12大問7（目盛りが無い時計）。スキャンで針が完全に落ちていて答えが未確定。原本があれば埋まる",
    "HG-1107": "度数分布表そのものが原簿に無く、問題を再現できない",
    "HG-1121": "答えが「7時21と9/11分」など 帯分数の時刻で、テンキーでも4択でも出しにくい",
    "HG-1126": "原簿でも『印字が判読困難で確定解は保留』",
    # ★答えが「絵」の作図問題。テンキーでも4択でも答えられない（本人判断 2026-08-11）
    "HG-3769": "展開図の頂点に記号を書きこむ作図問題。答えが図そのもの",
    "HG-3770": "立方体のテープの線を展開図にかき入れる作図問題。答えが図そのもの",
    "HG-3771": "展開図に「さんすう」の文字を並べて書く作図問題。答えが図そのもの",
    "HG-1489": "渦巻きの表。原簿自身が「第611〜613回には存在しない」と結論した幻のレコード（6枚全読して確認済み）",
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
    if course == "kokugo":
        # ★国語は hama_daimon.json に専用ノードが無く、kokugo_*.json 側に
        #   別ファイルとして存在する。KOKUGO_DONE（ファイル横断で拾った
        #   「原簿 HG-XXXX」タグ）とだけ突き合わせる。
        miss = sorted(gen[(grade, course)] - KOKUGO_DONE - set(CANNOT) - set(SAME))
        nm = "小%s国語" % grade
        print("%-12s %5d本 %5s %5s   %s" % (
            nm, len(gen[(grade, course)]), "—", "—",
            ("**%d本** %s" % (len(miss), miss[:8])) if miss else "なし"))
        ng += len(miss)
        continue
    node = d["grades"].get(grade, {}).get(course, {})
    # ★灘合は原簿では算数・理科が同じ「小N灘合」見出しに混ざっているが、
    #   アプリでは nadago（算数）と nadago_rika（理科）に分かれている。
    #   nadago 側をチェックするときは nadago_rika も合わせて見る
    #   （2026-08-11・kokugoと同型の見落としを発見して追加）
    extra_nodes = []
    if course == "nadago":
        extra_nodes.append(d["grades"].get(grade, {}).get("nadago_rika", {}))
    inapp = set()
    n = q = 0
    for nd in [node] + extra_nodes:
        for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
            for v in nd.get(kind, {}).values():
                for x in v:
                    n += 1
                    q += len(x.get("steps", []))
                    h = hgof(x)
                    if h:
                        inapp.update(h)
                    else:
                        nohg.append((grade, course, x.get("id")))
    miss = sorted(gen[(grade, course)] - inapp - set(CANNOT) - set(SAME) - KOKUGO_DONE)
    nm = "小%s%s" % (grade, {"master": "マスター", "sairei": "最レ", "nd2": "2nd演習", "rika": "理科", "nadago": "灘合"}[course])
    print("%-12s %5d本 %5d本 %5d問   %s" % (
        nm, len(gen[(grade, course)]), n, q,
        ("**%d本** %s" % (len(miss), miss[:8])) if miss else "なし"))
    ng += len(miss)

# ★安全弁：どのパターンにも一致しなかった見出しが無いか毎回チェックする。
#   灘合(2026-08-12)・公開学力テスト(2026-08-12)は、どちらも「新しいコースが
#   COURSE_PAT/KOKAI_PAT等のどれにも一致しない」せいで、gen（原簿側の分母）
#   に一度も入らず、未収録としてすら検出されずに丸ごと見落とされていた。
#   このチェックは「0本」が正常。1本でも出たら、その見出しの書式に対応する
#   パターンをこのファイルの上のほうに追加すること。
CLASSIFIED = set()
for hs in gen.values():
    CLASSIFIED.update(hs)
UNCLASSIFIED = sorted(set(heads) - CLASSIFIED - set(CANNOT))
print()
if UNCLASSIFIED:
    print("🚨🚨 見出しがどのパターンにも一致しないレコード %d本（検査の分母にすら入っていない！）" % len(UNCLASSIFIED))
    for h in UNCLASSIFIED[:20]:
        print("   %s %s" % (h, heads[h][:60]))
    print("   → COURSE_PAT/KOKAI_PAT/NADAGO_MOSHI_PAT/JITSURYOKU_PATのどれかに見出しの書式を追加すること")
else:
    print("✅ 原簿の全%d本が、いずれかの検査パターンの対象に入っている（分母の見落としなし）" % len(heads))

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
