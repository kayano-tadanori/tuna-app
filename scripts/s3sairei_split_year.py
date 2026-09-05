# -*- coding: utf-8 -*-
u"""小3最レを「今年」と「去年まで」に分け、さらに今年を『復習テスト』と『宿題』に分ける。

  きっかけ（2026-09-05〜06・本人）
    「今年からの分もno表示に変えます。タブも今年からの分が前にくるように」
    「これ 最レの宿題だよ」（No.14を復習テストの引き出しに入れてしまっていた）

  ★分類の根拠は原簿の出典（推測しない）
    No.6〜10  … `3年 最レ 復集 計算テスト なお.pdf`      → 復習テスト（今年）
    No.12     … 2026-08-02の復テ範囲・写真4枚            → 復習テスト（今年）
    No.13     … `最レ宿題.pdf`                            → **宿題**（今年）
    No.14     … `3年 最レNo.14 問題と解答.pdf`（本人確認） → **宿題**（今年）

  ★去年ぶん（HG-0301〜0436）は `sairei` のまま。回番号の意味が別なので混ぜない。
"""
import json, io, os, sys, re
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")
MAP = os.path.join(BASE, "data", "hama_map.json")

# 今年の復習テスト：単元名 → 回番号
FUKUSHU_UNIT_TO_NO = {
    "倍数と約数": 6, "なかま調べ": 6,
    "立体図形(1)": 7, "立体図形(2)": 8,
    "規則性(1)": 9, "規則性(2)": 10,
    "場合の数(2)": 12,
}
# 今年の宿題：単元名 → 回番号
SHUKUDAI_UNIT_TO_NO = {"平面図形(2) 角①": 14}
# 去年ぶんの fukushu に紛れこんでいる今年の宿題（No.13）
SHUKUDAI_HG_IN_OLD = {"13": (1421, 1427)}

# 今年のカリキュラム（回番号 → 単元名）。原簿の刷新版の並びそのまま
LESSONS_NEW = [
    (6,  "倍数・公倍数・ベン図"),
    (7,  "立体図形(1)"),
    (8,  "立体図形(2)"),
    (9,  "規則性(1)"),
    (10, "規則性(2)（偶奇・特殊数列）"),
    (11, "（まだ手もとにない）"),
    (12, "場合の数(2)"),
    (13, "平面図形(1) いろいろな図形"),
    (14, "平面図形(2) 角①"),
]

def hg_of(rec):
    m = re.search(r"HG-(\d{4})", rec.get("src") or "")
    return int(m.group(1)) if m else 10 ** 9

def main():
    d = json.load(io.open(DAIMON, encoding="utf-8"))
    g3 = d["grades"]["3"]
    sai = g3["sairei"]
    before = sum(len(v) for v in sai.get("units", {}).values()) + sum(len(v) for v in sai["fukushu"].values())

    new_fuku, new_shuku = {}, {}
    # ① units から 今年ぶんを引き出して 回番号へ
    for unit, arr in list(sai.get("units", {}).items()):
        if unit in FUKUSHU_UNIT_TO_NO:
            new_fuku.setdefault(str(FUKUSHU_UNIT_TO_NO[unit]), []).extend(arr)
        elif unit in SHUKUDAI_UNIT_TO_NO:
            new_shuku.setdefault(str(SHUKUDAI_UNIT_TO_NO[unit]), []).extend(arr)
        else:
            raise SystemExit("行き先の決まっていない単元がある: %s（推測で振り分けない）" % unit)
    # ② 去年ぶんの fukushu に紛れこんでいた 今年の宿題を取り出す
    for no, (lo, hi) in SHUKUDAI_HG_IN_OLD.items():
        keep, move = [], []
        for r in sai["fukushu"].get(no, []):
            (move if lo <= hg_of(r) <= hi else keep).append(r)
        sai["fukushu"][no] = keep
        if move: new_shuku.setdefault(no, []).extend(move)
    # ③ 大問の順にそろえる
    for b in (new_fuku, new_shuku):
        for k in b: b[k].sort(key=hg_of)
    sai.pop("units", None)

    g3["sairei_new"] = {"fukushu": new_fuku, "kokai": []}
    g3["sairei_new_bunsatsu"] = {"fukushu": new_shuku}

    after = (sum(len(v) for v in sai["fukushu"].values())
             + sum(len(v) for v in new_fuku.values()) + sum(len(v) for v in new_shuku.values()))
    assert before == after, "本数が合わない %d → %d" % (before, after)
    io.open(DAIMON, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")

    # ---- hama_map：今年のコースを足す（コース行には出さない＝タブで切りかえる）----
    m = json.load(io.open(MAP, encoding="utf-8"))
    c = m["grades"]["3"]["courses"]
    c["sairei"]["pairNew"] = "sairei_new"
    c["sairei"]["yearLabel"] = "去年まで"
    c["sairei_new"] = {
        "label": "最レ", "curriculum": "新", "kokai": False,
        "hidden": True, "pairOld": "sairei", "yearLabel": "今年",
        "lessons": [{"no": n, "title": t, "sel": []} for n, t in LESSONS_NEW],
    }
    io.open(MAP, "w", encoding="utf-8").write(json.dumps(m, ensure_ascii=False, indent=1) + "\n")

    print("今年・復習テスト:", {k: len(v) for k, v in sorted(new_fuku.items(), key=lambda x: int(x[0]))})
    print("今年・宿題      :", {k: len(v) for k, v in sorted(new_shuku.items(), key=lambda x: int(x[0]))})
    print("去年まで No.13  :", len(sai["fukushu"]["13"]), "本（HG-0381〜0384だけ残る）")
    print("大問の合計       : %d → %d（変わらない）" % (before, after))

if __name__ == "__main__":
    main()
