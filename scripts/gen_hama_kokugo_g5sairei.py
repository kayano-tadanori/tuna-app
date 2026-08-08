# -*- coding: utf-8 -*-
"""じゅくナビ 小5最レ国語《演習プリントII》を、原簿からそのまま起こす。

種本＝原簿の「📘 小5 最レ国語《演習プリントII》」節（HG-2544〜2559）。
★実物は「□にひらがな／カタカナを入れる」記述式なので、4択に作り変えない
  （→ [[feedback_genbo_dori]]）。じゅくナビの手書き＋自己採点の画面にそのまま載せる。
★答えが⚠（未確定）の問は落とす（→ [[feedback_kaisetsu_reader]]）。
★★【じゅくナビの絶対のルール・本人指示 2026-08-08】
   **じゅくナビで出す問題は、原簿に無いものを勝手に作らない。**
   このスクリプトは原簿の「設問・意味・答え」をそのまま写すだけで、1問も自作していない。
   （算数の2nd演習を入れないのは「通常マスターと難易度が別物だから別枠」という理由。
     最レ国語の演習プリントは最レ国語の授業の中でやる教材なので、じゅくナビに入れてよい）

出し先＝data/hama_kokugo.json の grades["5"]["sairei_kokugo"].lessons[回番号].kanji
（形は kanji_kaki.json とそろえてあるので、手書きの画面がそのまま使える）

  python scripts/gen_hama_kokugo_g5sairei.py          … 検査だけ
  python scripts/gen_hama_kokugo_g5sairei.py --write  … 書きこむ
"""
import io, json, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_path import find_genbo          # noqa: E402

KOKUGO = os.path.join(ROOT, "data", "hama_kokugo.json")
MAP = os.path.join(ROOT, "data", "hama_map.json")
COURSE = "sairei_kokugo"
GRADE = "5"

# 拾う回：(HG, 回番号, 回の名前, 何を書かせるか, 解説ファイル)
# ⚠ units も持たせる。かんたん解説は「単元名」で引く決まりで、回番号にひもづけない
#   （最レの回番号は年度で中身が入れかわる・本人指示 2026-07-27）
SPECS = [
    ("2544", 1, "ことばの問題① 慣用表現(1)", "ひらがな", "meanings_hama_g5sairei.json", []),
    ("2546", 3, "ことばの問題② 和語(1)", "ひらがな", "meanings_kokugo_wago.json", []),
    ("2550", 7, "ことばの問題③ 和語(2)", "ひらがな", "meanings_kokugo_wago.json", []),
    ("2555", 11, "ことばの問題⑤ 外来語", "カタカナ", "meanings_hama_g5sairei.json", []),
    ("2553", 9, "ことばの問題④ 慣用表現(2)", "ひらがな", "meanings_hama_g5sairei.json", []),
    ("2557", 13, "ことばの問題⑥ 和語(3)", "ひらがな", "meanings_kokugo_wago.json", []),
]
# 回の一覧（じゅくナビの画面に出す。問題がまだ無い回も名前だけ載せる＝実物の並びを見せる）
# 穴うめ以外の形式で拾う回：(HG, 回番号, 回の名前, 形式, units)
SPECS2 = [
    ("2545", 2, "漢字の問題① 読みと書き", ["yomi", "misprint"], ["漢字のしくみ"]),
    ("2547", 4, "漢字の問題② 熟語", ["doukun"], ["熟語"]),
]

# ── No.10 品詞の全体像（原簿 HG-2554 の樹形図の枝の文言をそのまま写したもの）──
#   実物は「品詞名を答えなさい」＝記述なので、4択にせず手書きで出す。
#   ⚠ここを直に data/ へ書くと、次にこのスクリプトを走らせたとき消える。必ずここに持つ
TREE10 = [
    (1,  "自立語で、活用する。《動作や存在をあらわす》", "動詞"),
    (2,  "自立語で、活用する。《性質や状態をあらわす》で、言い切りの形が「〜い」", "形容詞"),
    (3,  "自立語で、活用する。《性質や状態をあらわす》で、言い切りの形が「〜だ」", "形容動詞"),
    (4,  "自立語で、活用しない。［体言］《主語になる》", "名詞"),
    (5,  "自立語で、活用しない。《修飾語になる》で、主として用言を修飾する", "副詞"),
    (6,  "自立語で、活用しない。《修飾語になる》で、体言のみを修飾する", "連体詞"),
    (7,  "自立語で、活用しない。《接続語になる》", "接続詞"),
    (8,  "自立語で、活用しない。《独立語になる》", "感動詞"),
    (9,  "付属語で、活用する", "助動詞"),
    (10, "付属語で、活用しない", "助詞"),
]


# ── No.2 枠1：形声文字の音符を抜き出す5問（原簿 HG-2545）──
#   実物は「発音を表している部分を抜き出して答えなさい」＝記述なので手書きで出す
ONPU5 = [
    (1, "照", "召"), (2, "究", "九"), (3, "湖", "胡"), (4, "絵", "会"), (5, "整", "正"),
]

LESSONS = [
    (1, "ことばの問題① 慣用表現(1)"), (2, "漢字の問題① 読みと書き"),
    (3, "ことばの問題② 和語(1)"), (4, "漢字の問題② 熟語"),
    (5, "韻文を読む① 詩"), (6, "韻文を読む② 短歌・俳句"),
    (7, "ことばの問題③ 和語(2)"), (8, "ことばのきまり① 文の成分"),
    (9, "ことばの問題④ 慣用表現(2)"), (10, "ことばのきまり② 品詞（全体像）"),
    (11, "ことばの問題⑤ 外来語"), (12, "ことばのきまり③ 品詞（体言と用言）"),
    (13, "ことばの問題⑥ 和語(3)"),
]
LINE = re.compile(r"\((\d+)\)\s*([^／/\n]+?)／([^＝=\n]+?)＝\*\*([^*\n]+?)\*\*")

# 原簿には穴うめ以外の書き方も混ざっているので、形式ごとに読み分ける
MARU = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚"
# (a) 熟語の口に漢字を入れる：「1)口起（ほっき）＝**発**」
YOMI = re.compile("([" + MARU + r"])([^（\s]*□[^（\s]*)（([^）]+)）＝\*\*([^*]+)\*\*")
# (b) まちがいさがし：「2) 世界一**週**旅行の…。→ **週→周**」
MIS = re.compile("([" + MARU + r"])\s*(.+?)。→ \*\*(.)→(.)\*\*([^\n]*)")
# (c) 同音異義語：「1)北海道を**カンコウ**する＝**観光**」
DOU = re.compile("([" + MARU + r"])([^＝]*?)\*\*([ァ-ヶー]+)\*\*([^＝]*?)＝\*\*([^*⚠]+)\*\*")


def maru_no(ch):
    return MARU.index(ch) + 1


def extra_specs(b, kind):
    """穴うめ以外の形式を (番号, 解説を引く語, 問題文, 答え) にする"""
    out = []
    if kind == "yomi":
        for m in YOMI.finditer(b):
            n, mask, yomi, ans = m.groups()
            out.append((maru_no(n), mask.replace("□", ans),
                        "%s（%s） ─ □に入る漢字を書こう" % (mask, yomi), ans))
    elif kind == "misprint":
        for m in MIS.finditer(b):
            n, sent, wrong, right, tail = m.groups()
            if "⚠" in tail:
                continue          # 要現物照合の問は出さない
            out.append((maru_no(n), right,
                        "%s。 ─ まちがっている漢字1字を正しく直そう" % sent.replace("**", ""), right))
    elif kind == "doukun":
        for m in DOU.finditer(b):
            n, pre, kana, post, ans = m.groups()
            out.append((maru_no(n), ans.strip(),
                        "%s%s%s ─ 「%s」を漢字で書こう"
                        % (pre.strip(), kana, post.strip(), kana), ans.strip()))
    return out



def body(text, hg):
    m = re.search(r"^### 【HG-%s】.*?$(.*?)(?=^### 【HG-|\Z)" % hg, text, re.S | re.M)
    return m.group(1) if m else ""


def fill(mask, ans):
    """マスクと答えから「語全体」と「□に入る部分」を返す。合わなければ (None, None)"""
    boxes = mask.count("□")
    fixed = len(mask) - boxes
    if len(ans) == boxes + fixed and "□" not in ans:
        part, i = [], 0
        for ch in mask:
            if ch == "□":
                part.append(ans[i])
            i += 1
        return ans, "".join(part)
    if len(ans) == boxes:
        it = iter(ans)
        return "".join(next(it) if ch == "□" else ch for ch in mask), ans
    return None, None


def main():
    text = io.open(find_genbo(), encoding="utf-8").read()
    notes = {}
    for f in {s[4] for s in SPECS}:
        for m in json.load(io.open(os.path.join(HERE, f), encoding="utf-8")):
            notes[m["word"]] = m["note"].replace("**", "")

    lessons, total, dropped, nomean = {}, 0, [], []
    for hg, no, title, kana, _, units in SPECS:
        b = body(text, hg)
        assert b, "HG-%s が原簿に無い" % hg
        qs = []
        for m in LINE.finditer(b):
            n, mask, mean, ans = (s.strip() for s in m.groups())
            if "⚠" in ans or "未確定" in ans:
                dropped.append((no, n, mask)); continue
            ans = re.sub(r"（.*?）", "", ans).strip()
            word, part = fill(mask, ans)
            if word is None:
                dropped.append((no, n, mask)); continue
            if word not in notes:
                nomean.append((no, n, word)); continue
            qs.append({
                "id": "hk5s_%02d_%02d" % (no, int(n)),
                "question": "%s（%s） ─ □に入る%sを書こう" % (mask, mean.rstrip("。"), kana),
                "answer": part,
                "okuri": "",
                "meaning": "%s よって、□に入るのは「%s」で、答えは %s です。〔浜学園 小5最レ国語 No.%d・原簿 HG-%s〕"
                           % (notes[word], part, word, no, hg),
                "grade": 5,
                "difficulty": 1,   # ★じゅくナビは全問1でそろえる（クラス帯フィルタで欠けないため）
            })
        lessons[str(no)] = {"src": "HG-" + hg, "title": "No.%d %s" % (no, title),
                            "units": units, "kanji": qs}
        total += len(qs)
        print("No.%-2d %-22s … %2d問（落とした %d）"
              % (no, title, len(qs), sum(1 for d in dropped if d[0] == no)))

    for hg, no, title, kinds, units in SPECS2:
        b = body(text, hg)
        assert b, "HG-%s が原簿に無い" % hg
        qs = []
        # ⚠ 同じ回に形式が2つあると丸数字がぶつかる（読み②とまちがいさがし②）。
        #   形式ごとに1文字はさんでIDを分ける
        TAG = {"yomi": "", "misprint": "m", "doukun": ""}
        for kind in kinds:
            for n, word, question, ans in extra_specs(b, kind):
                if word not in notes:
                    nomean.append((no, n, word)); continue
                qs.append({
                    "id": "hk5s_%02d_%s%02d" % (no, TAG[kind], n),
                    "question": question,
                    "answer": ans,
                    "okuri": "",
                    "meaning": "%s よって、答えは %s です。〔浜学園 小5最レ国語 No.%d・原簿 HG-%s〕"
                               % (notes[word], ans, no, hg),
                    "grade": 5,
                    "difficulty": 1,
                })
        qs.sort(key=lambda q: q["id"])
        lessons[str(no)] = {"src": "HG-" + hg, "title": "No.%d %s" % (no, title),
                            "units": units, "kanji": qs}
        total += len(qs)
        print("No.%-2d %-22s … %2d問" % (no, title, len(qs)))

    # ── No.10 品詞の全体像（手書き10問）──────────────────
    qs10 = []
    for n, cond, ans in TREE10:
        if ans not in notes:
            nomean.append((10, n, ans)); continue
        qs10.append({
            "id": "hk5s_10_%02d" % n,
            "question": "%s ─ この品詞の名前を書こう" % cond,
            "answer": ans,
            "okuri": "",
            "meaning": "%s よって、答えは %s です。〔浜学園 小5最レ国語 No.10・原簿 HG-2554〕"
                       % (notes[ans], ans),
            "grade": 5, "difficulty": 1,
        })
    lessons["10"] = {"src": "HG-2554", "title": "No.10 ことばのきまり② 品詞（全体像）",
                     "units": ["品詞"], "kanji": qs10}
    # 4択だけの回（手書きは無い）。問題は data/kokugo_sairei5.json 側にあり units で引く
    lessons["8"] = {"src": "HG-2552", "title": "No.8 ことばのきまり① 文の成分",
                    "units": ["文の成分"], "kanji": []}
    lessons["12"] = {"src": "HG-2556", "title": "No.12 ことばのきまり③ 品詞（体言と用言）",
                     "units": ["品詞（体言と用言）"], "kanji": []}
    total += len(qs10)
    print("No.10 ことばのきまり② 品詞（全体像） … %d問" % len(qs10))

    # No.2 に音符の抜き出し5問（手書き）を足す
    rec2 = lessons.get("2")
    if rec2 is not None:
        for n, ji, onpu in ONPU5:
            key = "%s＝%s" % (ji, onpu)
            if key not in notes:
                nomean.append((2, n, key)); continue
            rec2["kanji"].append({
                "id": "hk5s_02_o%02d" % n,
                "question": "「%s」の発音を表している部分を書こう（二通りあるときは画数の少ないほう）" % ji,
                "answer": onpu,
                "okuri": "",
                "meaning": "%s 〔浜学園 小5最レ国語 No.2・原簿 HG-2545〕" % notes[key],
                "grade": 5, "difficulty": 1,
            })
            total += 1
        rec2["kanji"].sort(key=lambda q: q["id"])
        print("No.2 に音符の抜き出し5問を足した → %d問" % len(rec2["kanji"]))

    print("\n合計 %d問" % total)
    if nomean:
        print("\n✗ 解説が無い語があります（書いてから出してください）：")
        for no, n, w in nomean:
            print("   No.%d (%s) %s" % (no, n, w))
        sys.exit(1)

    # ── 検査 ────────────────────────────────────────────
    ng = []
    ids = []
    for no, rec in lessons.items():
        for q in rec["kanji"]:
            ids.append(q["id"])
            if not q["answer"]:
                ng.append((q["id"], "答えが空"))
            if "□" in q["answer"]:
                ng.append((q["id"], "答えに□が残っている"))
            if len(q["meaning"]) < 50:
                ng.append((q["id"], "解説が短すぎる"))
            if q["answer"] not in q["meaning"]:
                ng.append((q["id"], "解説の結びと答えが合わない"))
    if len(ids) != len(set(ids)):
        ng.append(("-", "IDの重複"))
    if ng:
        print("\n✗ 検査でひっかかった %d件" % len(ng))
        for qid, why in ng[:15]:
            print("   %s … %s" % (qid, why))
        sys.exit(1)
    print("✅ 検査ぜんぶ通過（答えが空でない／□が残っていない／解説あり／結びが答えと一致／IDの重複なし）")

    print("\n--- 見本 ---")
    for no in ("3", "11"):
        q = lessons[no]["kanji"][0]
        print("[%s] %s" % (q["id"], q["question"]))
        print("   answer : %s" % q["answer"])
        print("   解説   : %s" % q["meaning"][:150])

    if "--write" not in sys.argv:
        print("\n（--write を付けると data/hama_kokugo.json と data/hama_map.json に書きます）")
        return

    # ① hama_kokugo.json に grades["5"]["sairei_kokugo"] を足す
    d = json.load(io.open(KOKUGO, encoding="utf-8"))
    d["grades"].setdefault(GRADE, {})[COURSE] = {"lessons": lessons}
    json.dump(d, io.open(KOKUGO, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n→ data/hama_kokugo.json の grades.5.%s に %d問 書きこんだ" % (COURSE, total))

    # ② hama_map.json の小5に国語コースを足す（じゅくナビの画面に出すため）
    mp = json.load(io.open(MAP, encoding="utf-8"))
    mp["grades"][GRADE]["courses"][COURSE] = {
        "subject": "kokugo",
        "label": "最レ国語（演習プリントII）",
        "curriculum": "新",
        "kokai": False,
        "source": ("浜学園 小5最高レベル特訓 国語《演習プリントII》No.1〜No.13（原簿 HG-2544〜2559）。"
                   "実物は「□にひらがな／カタカナを入れる」記述式なので、手書き＋自己採点でそのまま出す。"
                   "いま入れてあるのは和語(1)(2)(3)と外来語の4回ぶん。"
                   "ことわざ・慣用表現・漢字・品詞の回は解説を書いてから入れる。"),
        "lessons": [{"no": no, "title": title,
                      **({"units": u} if (u := next((sp[5] for sp in SPECS if sp[1] == no), None)) else {})}
                     for no, title in LESSONS],
    }
    json.dump(mp, io.open(MAP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("→ data/hama_map.json の grades.5.courses.%s を作った（全%d回）" % (COURSE, len(LESSONS)))


if __name__ == "__main__":
    main()
