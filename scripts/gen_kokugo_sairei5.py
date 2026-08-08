# -*- coding: utf-8 -*-
"""小5最レ国語の「記号で答える大問」を原簿から起こす（4択）。

種本＝原簿 HG-2552（ことばのきまり① 文の成分・大問3）／HG-2556（同③ 品詞＝体言と用言）。
★実物がもともと記号で答えさせている大問だけを4択にする。記述を4択に作り変えない
  （→ [[feedback_genbo_dori]]）。詩（HG-2548）と短歌（HG-2549）は**作品の本文が要る＝
  著作権が存続中なので出さない**（2026-08-08に確認：没後70年。木下利玄だけ切れている）。
★じゅくナビの絶対のルール＝原簿に無い問題は作らない（本人指示 2026-08-08）。
⚠ HG-2552 大問1（かかり受け）と HG-2556 大問2（同じ使い方をしているもの）は、
  **——線がどの語に引かれているかが原簿に記録できていない**ので出さない。
  現物を見て——線の位置を原簿に書いてから作る（要現物照合リスト #48改）。

出し先＝data/kokugo_sairei5.json（じゅくナビが units で引く。カテゴリの画面には出さない）

  python scripts/gen_kokugo_sairei5.py --write
"""
import io, json, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_path import find_genbo          # noqa: E402

OUT = os.path.join(ROOT, "data", "kokugo_sairei5.json")
MEAN = os.path.join(HERE, "meanings_hama_g5sairei.json")
MARU = "①②③④⑤⑥⑦⑧⑨⑩"


def body(text, hg):
    m = re.search(r"^### 【HG-%s】.*?$(.*?)(?=^### 【HG-|\Z)" % hg, text, re.S | re.M)
    return m.group(1) if m else ""


def main():
    text = io.open(find_genbo(), encoding="utf-8").read()
    notes = {m["word"]: m["note"].replace("**", "")
             for m in json.load(io.open(MEAN, encoding="utf-8"))}
    qs = []

    # ── HG-2552 大問3：単文・重文・複文（ア/イ/ウ）──────────
    b = body(text, "2552")
    LABEL = {"ア": "単文", "イ": "重文", "ウ": "複文"}
    pat = re.compile(r"([" + MARU + r"])\s*(.+?)＝\*\*([アイウ])\*\*")
    n = 0
    for m in pat.finditer(b):
        no, sent, sym = m.groups()
        ans = LABEL[sym]
        qs.append({
            "id": "ks5_08_%02d" % (MARU.index(no) + 1),
            "unit": "文の成分",
            "question": "「%s。」はどの文？" % sent.strip().rstrip("。"),
            "answer": ans,
            "choices": ["単文", "重文", "複文"],
            "meaning": notes[ans] + "よって、答えは%sです。〔浜学園 小5最レ国語 No.8・原簿 HG-2552〕" % ans,
            "difficulty": 3, "grade": 5,
        })
        n += 1
    print("No.8 単文・重文・複文 … %d問" % n)

    # ── HG-2556 大問1：ことばの働き（ア名前／イ動き／ウ様子）──
    b = body(text, "2556")
    line_q = next(l for l in b.split("\n") if "①高い" in l)
    line_a = next(l for l in b.split("\n") if re.search(r"答え \*\*①ウ", l))
    words = dict((m.group(1), m.group(2)) for m in re.finditer(r"([" + MARU + r"])([^\s／。]+)", line_q))
    syms = dict((m.group(1), m.group(2)) for m in re.finditer(r"([" + MARU + r"])([アイウ])", line_a))
    LBL2 = {"ア": "ものの名前をあらわすことば", "イ": "動きをあらわすことば", "ウ": "様子をあらわすことば"}
    n = 0
    for no in MARU[:8]:
        if no not in words or no not in syms:
            continue
        ans = LBL2[syms[no]]
        qs.append({
            "id": "ks5_12_%02d" % (MARU.index(no) + 1),
            "unit": "品詞（体言と用言）",   # ★No.10（品詞の全体像）と混ざらないよう回ごとに固有名
            "question": "「%s」はどんなはたらきのことば？" % words[no],
            "answer": ans,
            "choices": sorted(LBL2.values()),
            "meaning": notes[ans] + "よって、答えは「%s」です。〔浜学園 小5最レ国語 No.12・原簿 HG-2556〕" % ans,
            "difficulty": 2, "grade": 5,
        })
        n += 1
    print("No.12 ことばのはたらき … %d問" % n)

    # ── 検査 ────────────────────────────────────────────
    ng = []
    for q in qs:
        if q["answer"] not in q["choices"]:
            ng.append((q["id"], "答えが選択肢にない"))
        if len(set(q["choices"])) < 3:
            ng.append((q["id"], "選択肢が3つに足りない"))
        if len(q["meaning"]) < 50:
            ng.append((q["id"], "解説が短い"))
    ids = [q["id"] for q in qs]
    if len(ids) != len(set(ids)):
        ng.append(("-", "IDの重複"))
    print("\n合計 %d問" % len(qs))
    if ng:
        print("✗ 検査でひっかかった %d件" % len(ng))
        for i, w in ng[:10]:
            print("   %s … %s" % (i, w))
        sys.exit(1)
    print("✅ 検査通過（答えが選択肢にある／選択肢そろい／解説あり／IDの重複なし）")
    print("\n--- 見本 ---")
    for q in (qs[0], qs[-1]):
        print("[%s] %s" % (q["id"], q["question"]))
        print("   %s → %s" % (" / ".join(q["choices"]), q["answer"]))
        print("   %s" % q["meaning"][:110])

    if "--write" in sys.argv:
        json.dump(qs, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\n→ data/kokugo_sairei5.json に %d問 書きこんだ" % len(qs))


if __name__ == "__main__":
    main()
