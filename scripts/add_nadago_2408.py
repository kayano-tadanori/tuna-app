# -*- coding: utf-8 -*-
"""小4灘合 第11回 大問1（HG-2408）を入れる。
   ★これは 小5灘合 第6回 本体 大問3（HG-2269＝`hd5n_06_9`）と**まったく同じ図・同じ数値の問題**。
     現物2枚（4年灘合_第7〜12回.pdf p41 ／ 5年灘合_第1〜6回.pdf p57）を並べて確認した（2026-09-04）。
     なので図と誘導は既存の小5版にそろえ、設問文だけ小4の原本の言い方にする。
   答え：ふたの面積 150cm² ／ 容積 2000cm³
     （2026-09-04に展開図の折りたたみを独立に計算して確かめた＝scripts/verify_nadago_2408.py）
   使い方: python scripts/add_nadago_2408.py [--write]
"""
import copy, io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DJ = os.path.join(BASE, "data", "hama_daimon.json")
d = json.load(io.open(DJ, encoding="utf-8"))
src = None
for it in d["grades"]["5"]["nadago"]["fukushu"]["6"]:
    if it["id"] == "hd5n_06_9":
        src = it
assert src and src["src"] == "HG-2269", "もとにする小5版が見つからない"

item = copy.deepcopy(src)
item["id"] = "hd4n_11_12"
item["src"] = "HG-2408"
item["grade"] = 4
item["title"] = "ふたのない容器の展開図"
item["intro"] = ("下の図は**ふたのない容器の展開図**です。こい色の部分が底になり、まわりの4つの面が立ち上がります。\n"
                 "この容器に**ぴったりのふた**を作るとすれば、ふたの面積は何cm²ですか。"
                 "また、この容器に入る水の体積は何cm³ですか。")
arr = d["grades"]["4"]["nadago"]["fukushu"]["11"]
assert all(x["id"] != item["id"] for x in arr), "id が重複"
assert all(x.get("src") != item["src"] for x in arr), "src が重複"
arr.insert(0, item)                       # 原本の大問1なので先頭
print("小4灘合 第11回 の先頭に %s (%s) を入れた -> %d本" % (item["id"], item["src"], len(arr)))
print("  設問 %d問: %s" % (len(item["steps"]), " / ".join(s["answer"] for s in item["steps"])))
if "--write" in sys.argv:
    io.open(DJ, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1))
    print("書いた:", DJ)
else:
    print("（--write をつけると書きこむ）")
