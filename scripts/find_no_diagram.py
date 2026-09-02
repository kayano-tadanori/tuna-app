# -*- coding: utf-8 -*-
"""check_genbo.pyの「未収録」リストのうち、図なし・答え確定・読解でもない
   ＝すぐ着手できる候補だけを抜き出す。
   使い方：  python scripts/find_no_diagram.py
   結果は docs/genbo_no_diagram.md に自動保存される（手で編集しない）。

★コースの見分け方・SAME・CANNOT・「未収録」の出し方は scripts/genbo_common.py にある。
  このファイルが持つのは「そこからどう絞りこむか」だけ。
  2026-09-03まで、ここに check_genbo.py の分類ロジックを手で写したコピーがあり、
  それだけが古くなって、実装ずみの大問まで候補に並べていた（経緯は genbo_common.py の冒頭）。
  ★分類を直したくなったら genbo_common.py を直すこと。ここに写し直さない。
"""
import io, os, re, sys, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from genbo_common import (
    BASE, heads, recs_body, gen, COURSE_LABEL, load_daimon, scan_courses,
)

# ★未収録の判定は check_genbo.py とまったく同じ関数を通す（もうズレようがない）
rows, _nohg = scan_courses(load_daimon())
all_missing = {(r["grade"], r["course"]): r["miss"] for r in rows}

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

# ── 安全弁：候補に「もう実装ずみの大問」が混じっていないか、アプリのデータで直接確かめる。
#   ★2026-09-03の事故そのものを鳴らすための検査。分類ロジックがどこかでズレて
#     実装ずみを「未着手」と言い出したら、ここで必ず気づける
#     （当時は HG-4001・HG-2680・HG-2931 など1,046件が並んでいた）。
#   ★わざと壊して鳴るかは確認ずみ：clean に実装ずみのHGを1本混ぜると落ちる。
APP_HG = set(re.findall(r"HG-\d+", io.open(
    os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8").read()))
already = [(nm, h, hl) for nm, h, hl in buckets["clean"] if h in APP_HG]
if already:
    print("🚨 候補に『すでに大問になっているもの』が %d本 混じっている（分類がズレている）" % len(already))
    for nm, h, hl in already[:20]:
        print("   %s %s %s" % (nm, h, hl))
    print("   → scripts/genbo_common.py の COURSE_PAT / SAME / CANNOT を見直すこと")
    sys.exit(1)

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
if not buckets["clean"]:
    w("★すぐ着手できる候補はゼロ＝原簿が揃っているものは全部大問になっている。")
    w("  残っているのは docs/genbo_status.md の『作れないと分かっているレコード（除外）』だけ。")
    w("  そちらは現物のPDF・写真が手に入れば動かせるものが多い。")
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
