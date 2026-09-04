# -*- coding: utf-8 -*-
"""原簿とアプリの大問を突き合わせ、取りこぼしを洗い出す。
   浜学園のデータを触ったら必ず実行すること。
   使い方：  python scripts/check_genbo.py
"""
import json, io, os, re, sys, collections, glob, datetime
import sys, io as _io
# Windowsのcp932コンソールでも絵文字・矢印が出せるようにする
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
GENBO = find_genbo()

# ★「未実装はすぐ引き出せるようにしておく」（本人指示 2026-08-12）ための恒久的な置き場。
#   このスクリプトを実行するたびに docs/genbo_status.md を丸ごと上書きする。
#   数字が古くなる心配のあるメモ書き（memory側の経緯メモ）とは別に、
#   「今すぐ実行した本当の数字」を1ファイルに固定する。手で編集しない。
class _Tee:
    def __init__(self, *streams):
        self.streams = streams
    def write(self, data):
        for s in self.streams:
            s.write(data)
    def flush(self):
        for s in self.streams:
            s.flush()

STATUS_FILE = os.path.join(BASE, "docs", "genbo_status.md")
os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
_status_fh = io.open(STATUS_FILE, "w", encoding="utf-8")
_status_fh.write("# 原簿⇄大問 突き合わせ状況（自動生成・手で編集しない）\n\n")
_status_fh.write("`python scripts/check_genbo.py` を実行するたびに丸ごと上書きされる。\n")
_status_fh.write("★このうち「図なし・答えが確定・読解でもない＝すぐ着手できる候補」だけを抜き出したものが"
                  "`docs/genbo_no_diagram.md`（`python scripts/find_no_diagram.py`で再生成）。\n")
_status_fh.write("最終更新: %s\n\n```\n" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
_real_stdout = sys.stdout
sys.stdout = _Tee(_real_stdout, _status_fh)


def _finish_status_file():
    _status_fh.write("```\n")
    _status_fh.flush()
    _status_fh.close()
    sys.stdout = _real_stdout   # 閉じたファイルへflushし続けるのを防ぐ

# ── 分類のきまり（原簿の分母づくり・SAME・CANNOT・突き合わせ）は scripts/genbo_common.py へ移した。
#   ★2026-09-03まで、同じロジックを find_no_diagram.py にも手で写した「2つめのコピー」があり、
#     そちらだけが古くなって、実装ずみの大問まで「すぐ着手できる候補」に並べていた
#     （HG-4001・HG-2680・HG-2931 など。経緯は genbo_common.py の冒頭に書いた）。
#   ★コースの見分け方・除外リストを直すときは genbo_common.py だけを直す。
#     このファイルと find_no_diagram.py の両方に同じ修正を入れる必要はもう無い。
from genbo_common import (
    heads, recs_body, gen, MOSHI, SAME, CANNOT, KOKUGO_DONE,
    hgof, APP_COURSE_KEY, KINDS, COURSE_LABEL, load_daimon, scan_courses,
    find_svg_fields, iter_daimon, NO_FIG,
)

d = load_daimon()

print("=== 原簿 ⇄ 大問 の 突き合わせ ===")
print("%-12s %6s %6s %6s   %s" % ("コース", "原簿", "大問", "問数", "未収録"))
rows, nohg = scan_courses(d)
ng = 0
for r in rows:
    miss = r["miss"]
    print("%-12s %5d本 %5d本 %5d問   %s" % (
        r["label"], r["n_genbo"], r["n_daimon"], r["n_toi"],
        ("**%d本** %s" % (len(miss), miss[:8])) if miss else "なし"))
    ng += len(miss)

print()
print("── 最難関模試（灘中チャレンジ／灘中日本一模試）── 今は実装不要と本人確認ずみ・backlogには数えない ──")
for grade in sorted(MOSHI):
    ms = sorted(MOSHI[grade])
    print("小%s最難関模試   %5d本（未実装のまま据え置き）" % (grade, len(ms)))

# ★安全弁：どのパターンにも一致しなかった見出しが無いか毎回チェックする。
#   灘合(2026-08-12)・公開学力テスト(2026-08-12)は、どちらも「新しいコースが
#   COURSE_PAT/KOKAI_PAT等のどれにも一致しない」せいで、gen（原簿側の分母）
#   に一度も入らず、未収録としてすら検出されずに丸ごと見落とされていた。
#   このチェックは「0本」が正常。1本でも出たら、その見出しの書式に対応する
#   パターンをこのファイルの上のほうに追加すること。
CLASSIFIED = set()
for hs in gen.values():
    CLASSIFIED.update(hs)
for hs in MOSHI.values():
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
    _finish_status_file()
    sys.exit(0)

fig_ng = 0
for label, arr, key, hint in (
    ("文字に色が付いていない図（暗い背景で読めない）", bad_fill, "fill", 'すべての <text> に fill を書く'),
    ("ルートに max-width が無い図（枠からはみ出す）", bad_style, "style",
     'style="display:block;margin:0 auto;max-width:100%" を付ける'),
    # ★「暗い色を使っている」だけでは不具合とは言えない。明るいカードの上の濃い文字は正しい使い方。
    #   読めるかどうかは python scripts/check_text_contrast.py で1文字ずつ実測する（2026-09-03）。
    #   ここは「新しく暗い色が増えた」ことに気づくための目印にとどめる。
    ("暗い色を使っている図（読めるかは check_text_contrast.py で実測する）", bad_dark, "dark",
     "python scripts/check_text_contrast.py で読めるか測る。読めなければ fix_text_contrast.py で直す"),
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
print("→ 文字が実際に読めるかは python scripts/check_text_contrast.py（1文字ずつ画素で実測）")

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
    # ★欄を探すのは genbo_common.find_svg_fields ただ一つ（正規表現をここに写さない）
    _fs = find_svg_fields(body)
    if _fs:
        zu_svg[hg] = _fs[0]["value"].strip()

miss_svg = sorted(h for h in zu_ari if h not in zu_svg)
if miss_svg:
    # ★2026-08-18 本人指示で「警告」から「落とす」に変えた。
    #   理由：小3マスター第2分冊で、私が「読み取りを先に全部やって、図はあとでまとめて描く」と
    #   勝手に順序を入れかえ、あとで描く工程がそのまま消えた（95本すべて図SVGが空のまま実装した）。
    #   ルールを文章で置いても、読んだうえで自分の判断で上書きしてしまう。
    #   出力を読み飛ばしても止まるように、ここで終了コード1にする。
    print("❌ 原簿が「図: あり」なのに 図SVG 欄が無い: %d本  ← ここで落とします" % len(miss_svg))
    print("  （PDFを見て描き、原簿に入れる。読み取れないなら『- 図SVG: 判読不能』と書く）")
    print("  ★1レコードは『設問・答え・図SVG』までそろって完成。回ごとに閉じてから次の回へ進むこと")
    for h in miss_svg[:12]:
        print("   %s" % h)
    if len(miss_svg) > 12:
        print("   …ほか %d本" % (len(miss_svg) - 12))
else:
    print("✅ 図がある大問には、原簿に図SVGが入っている")


# ── 原簿に図SVG欄があるのに、アプリの大問に svg が無い（2026-09-04 新設）──────
# ★2026-09-04に「原簿には図があるのに、アプリでは図なしで出ていた大問」が8本見つかった。
#   うち5本は「図はどんな数を表しますか」「図のような三角形の土地」のように
#   **図そのものが設問の中身**で、必要な数値が本文に1つも無い＝子どもは解きようがなかった。
#   機械チェックも塾講師監査も、ここを素通りしていた。
#
#   取りこぼした原因は、原簿の欄が「- 図SVG（(1)）:」のように**かっこ書き（小問名）つき**で、
#   配る側の sync_genbo_svg.py がそれを見ていなかったこと。
#   ★だからこの検査は**かっこ書きつきの欄も必ず数える**。
#   ★欄を探すのは genbo_common.find_svg_fields ただ1つ。ここに正規表現を写さない
#     （このリポジトリでは「食いちがったら両方直す」というコメントが守られず、
#      実装ずみ1,046件を「未着手」と誤報した前例がある）。
#
#   わざと出さないもの（原簿の図が大問全体のもので、アプリが一部の小問だけを実装している等）は
#   genbo_common.NO_FIG に理由つきで書く。ここで例外を作らない。
print()
zu_any = set()          # 中身のある図SVG欄を1つ以上持つHG（かっこ書きつきも数える）
for _hg, _body in recs_body.items():
    for _f in find_svg_fields(_body):
        _v = _f["value"].strip()
        if _v and _v != "判読不能":
            zu_any.add(_hg)
            break

noapp = []
# ★「図がある」の判定は大問の svg だけでは足りない。js/sansu.js は `step.svg || chain.svg` の順で出すので、
#   **小問（step）側に svg があればそれで図は出ている**。ここを見ないと、正しく出ている大問を
#   62本も「図が無い」と誤報する（2026-09-04に実際にやった）。
def _has_fig(_x):
    if (_x.get("svg") or "").strip():
        return True
    return any((_s.get("svg") or "").strip() for _s in _x.get("steps", []))

for _r in iter_daimon(d):
    _x = _r["x"]
    if _has_fig(_x):
        continue
    for _hg in (hgof(_x) or []):
        if _hg in zu_any and _hg not in NO_FIG:
            noapp.append((_hg, _r["grade"], _r["app_course"], _r["kind"], _r["no"], _x.get("id")))
            break

if noapp:
    print("❌ 原簿に図SVGがあるのに、アプリの大問に図が入っていない: %d本  ← ここで落とします" % len(noapp))
    print("  （図が設問そのものだと、この状態の大問は**解答不能**のまま子どもに出る。2026-09-04に8本見つかった）")
    print("  → 出してよいなら scripts/sync_genbo_svg.py（かっこ書き無しの欄）か、"
          "小問だけの図なら手で入れる。出さないと決めたなら genbo_common.NO_FIG に理由を書く")
    for _t in sorted(noapp)[:15]:
        print("   %-9s 学年%s %s %s No.%-4s %s" % _t)
    if len(noapp) > 15:
        print("   …ほか %d本" % (len(noapp) - 15))
else:
    print("✅ 原簿に図SVGがある大問は、アプリにも図が入っている（かっこ書きつきの小問図もふくむ）")

_finish_status_file()
if fail or miss_svg or noapp:
    sys.exit(1)
