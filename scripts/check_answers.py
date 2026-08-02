# -*- coding: utf-8 -*-
"""答えの形をまとめて点検する。
   テンキーで打てない答え（○△・曜日など）なのに choices が無い問題は、
   画面上でどうやっても答えられない。データを触ったら必ず実行すること。
   使い方：  python scripts/check_answers.py
"""
import json, io, os, re, sys, glob
import sys, io as _io
# Windowsのcp932コンソールでも絵文字・矢印が出せるようにする
sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def numpad(a):
    a = str(a).strip()
    return bool(re.fullmatch(r"\d+(\.\d+)?", a) or re.fullmatch(r"\d+/\d+", a)
                or re.fullmatch(r"\d+と\d+/\d+", a) or "余り" in a)


bad, nch, tot = [], 0, 0
for path in sorted(glob.glob(os.path.join(BASE, "data", "*.json"))):
    name = os.path.basename(path)
    # テンキー／4択の画面を使う教科だけ。国語（漢字の書き取りなど）は手書き入力なので対象外
    if not (name.startswith(("sansu_", "rika_", "shakai_"))
            or name in ("hama_kaisetsu.json", "hama_daimon.json")):
        continue
    if name in ("sansu_unit_index.json",) or name.endswith(".ubak"):
        continue
    try:
        d = json.load(io.open(path, encoding="utf-8"))
    except Exception:
        continue
    # 通常問題（配列）
    if isinstance(d, list) and d and isinstance(d[0], dict) and "answer" in d[0]:
        for q in d:
            tot += 1
            if numpad(q["answer"]):
                continue
            if q.get("choices") and q["answer"] in q["choices"]:
                nch += 1
                continue
            bad.append((name, q.get("id", "?"), q.get("grade"), q["question"][:46], q["answer"]))
    # 連鎖（steps を持つ配列）
    if isinstance(d, list) and d and isinstance(d[0], dict) and "steps" in d[0]:
        for ch in d:
            for i, st in enumerate(ch["steps"]):
                tot += 1
                if numpad(st["answer"]):
                    continue
                if st.get("choices") and st["answer"] in st["choices"]:
                    nch += 1
                    continue
                bad.append((name, "%s_s%d" % (ch.get("id", "?"), i + 1), ch.get("grade"),
                            st["question"][:46], st["answer"]))
    # 大問（じゅくナビの🧩）
    if isinstance(d, dict) and "grades" in d and name == "hama_daimon.json":
        for g, gv in d["grades"].items():
            for course, cv in gv.items():
                packs = []
                for v in cv.get("fukushu", {}).values():
                    packs += v
                for v in cv.get("kokai", {}).values():
                    packs += v
                for x in packs:
                    for st in x.get("steps", []):
                        tot += 1
                        if numpad(st["answer"]):
                            continue
                        if st.get("choices") and st["answer"] in st["choices"]:
                            nch += 1
                            continue
                        bad.append((name, x.get("id", "?"), g, st["question"][:46], st["answer"]))
    # かんたん解説
    if isinstance(d, dict) and "grades" in d and name == "hama_kaisetsu.json":
        for g, gv in d["grades"].items():
            for course, cv in gv.items():
                packs = list(cv.get("units", {}).items()) + list(cv.get("lessons", {}).items())
                for key, pack in packs:
                    for x in pack["items"]:
                        # ★例題(rei)は「やり方を見せるだけ」で入力させない（app.js の q.rei 分岐）。
                        #   だから答えがテンキーで打てなくてよい（例：点の位置 "(8, 5)"）。
                        for q in x["ruidai"]:
                            tot += 1
                            if numpad(q["answer"]):
                                continue
                            if q.get("choices") and q["answer"] in q["choices"]:
                                nch += 1
                                continue
                            bad.append((name, "%s/%s/%s" % (g, course, key), g,
                                        q["question"][:46], q["answer"]))

print("点検した問題 %d問／4択で答えられる %d問" % (tot, nch))
if bad:
    print("\n❌ テンキーで打てないのに選択肢が無い問題 %d件" % len(bad))
    for f, i, g, q, a in bad:
        print("  [%s] %s 小%s %s → %r" % (f, i, g, q, a))
    sys.exit(1)
print("✅ 答えられない問題はありません")
