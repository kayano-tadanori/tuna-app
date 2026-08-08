# -*- coding: utf-8 -*-
"""じゅくナビ国語（小4本科V）の「ことば」を、原簿からそのまま起こす。

種本は原簿の「📗 小4国語（本科教材・Vクラス）」節（HG-2431〜2473）。
★拾うのは「実物がもともと記号で答えさせている大問」だけ。
  記述問題を勝手に4択へ作り変えない（→ [[feedback_genbo_dori]]「設問を勝手に作り変えない」）。
  完全マッチング（10対10）は4択にすると実物より一段浅くなるので、専用の画面ができるまで出さない
  （原簿：「オトン学園の慣用句は意味を4択だけなので実物より1段浅い」）。

出し先は data/kokugo_bun.json（じゅくナビの「📖 今週のことば」が unit で引く）。
hama_kokugo.json 側の各回に units を書き足して、回とことばを結ぶ。

  python scripts/gen_hama_kotoba_g4.py          … 検査だけして中身を出す
  python scripts/gen_hama_kotoba_g4.py --write  … 書きこむ
"""
import io, json, os, re, sys, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_path import find_genbo          # noqa: E402

BUN = os.path.join(ROOT, "data", "kokugo_bun.json")
KOKUGO = os.path.join(ROOT, "data", "hama_kokugo.json")
# ★解説は原簿に無いので、ここに書いて id で結ぶ（scripts/meanings_kokugo_*.json と同じやり方）。
#   「なぜそうなるか」を書くのがこのアプリの本体（→ [[project_oton_gakuen]]「評価軸はわかりやすいか」）
MEANINGS = os.path.join(HERE, "meanings_hama_kotoba_g4.json")

# ── どの大問を拾うか ─────────────────────────────────────────────
# kind:
#   label … 答えが記号で、記号→分類名の対応表が見出しにある（例 ア動詞／イ形容詞）
#   pick  … 選択肢が語そのもの。太字が正解（例「ア 後退 イ 後日 …→ア」）
#   gloss … 「語：ア… イ… ウ… エ…→記号」の意味あて
SPECS = [
    # HG,   大問, unit,                  kind,   ラベル表, 問題文の型
    ("2438", 2, "ことばの意味", "gloss",
     None, "「%s」の意味は？"),
    # ★「ない場合は『なし』」＝答えが無いことが答え。選択肢に「なし」を必ず足す
    ("2449", 4, "音読み・訓読み", "pick_nashi",
     None, "音読みしかできない漢字はどれ？（無ければ「なし」）"),
    ("2449", 5, "音読み・訓読み", "pick",
     None, "読み方が一つだけちがうのはどれ？"),
    ("2450", 3, "重箱読み・湯桶読み", "label",
     {"A": "音音読み", "B": "訓訓読み", "C": "重箱読み", "D": "湯桶読み"},
     "「%s」の読み方の組み合わせは？"),
    ("2465", 3, "品詞のなかま分け", "label",
     {"ア": "動詞", "イ": "形容詞", "ウ": "形容動詞", "エ": "名詞（代名詞）"},
     "「%s」の品詞は？"),
    ("2466", 4, "品詞のなかま分け", "pick",
     None, "一つだけ性質がちがう言葉はどれ？"),
    ("2467", 2, "文の種類", "label",
     {"A": "平叙文", "B": "疑問文", "C": "命令文", "D": "感動文"},
     "「%s」はどの文？"),
    ("2467", 3, "単文・重文・複文", "label",
     {"ア": "重文", "イ": "単文", "ウ": "複文"},
     "「%s」はどの文型？"),
    ("2467", 5, "常体文・敬体文", "label",
     {"A": "常体文（だ・である）", "B": "敬体文（です・ます）"},
     "「%s」はどちら？"),
    ("2454", 3, "熟語の組み立て", "label",
     {"ア": "同じ・よく似た意味の漢字",
      "イ": "反対の意味の漢字",
      "ウ": "上の字が下の字を説明している",
      "エ": "上が主語・下が述語",
      "オ": "下の字が上の字の目的",
      "カ": "上の字が下の字を打ち消す"},
     "熟語「%s」の組み立ては？"),
    ("2464", 4, "品詞のなかま分け", "pick",
     None, "一つだけ種類がちがう言葉はどれ？"),
    # 【B群】から選ぶ形式。実物が記号で答えさせているのでそのまま選択肢にできる
    ("2473", 5, "文学史（外国の作家）", "pool",
     None, "「%s」の作品はどれ？"),
    ("2438", 6, "熟語の組み立て", "pick",
     None, "── 線の漢字が同じ意味で使われているのはどれ？"),
    ("2451", 3, "形声文字", "pool",
     None, "形声文字「%s」の読み方はどれ？"),
    # ★A／Bの二択。四択とちがい まぐれが効かない実物どおりの型
    ("2439", 2, "ことばの使い方", "labelq",
     {"A": "正しい", "B": "まちがい"},
     "%s ─ 「　」の使い方は？"),
    # ★完全マッチング（n対n）。語群ぜんぶを選択肢にして実物の選択の広さを保つ。
    #   4択に削ると原簿の言う「実物より1段浅い」になるので、語群をそのまま出す
    ("2438", 3, "ことばの意味", "pool",
     None, "%s ─ （　）に入る言葉はどれ？"),
    ("2439", 4, "慣用句", "pool",
     None, "慣用句「%s」に続くのはどれ？"),
    ("2440", 2, "慣用句", "pool",
     None, "「%s」の意味はどれ？"),
    ("2440", 3, "ことわざ", "pool",
     None, "「%s」の意味はどれ？"),
    ("2471", 5, "俳句", "pool",
     None, "%s ─ （　）に入ることばはどれ？"),
]
# ★出さないと決めた大問（理由を残す）
#   HG-2462 大問4（敬語の正誤A/B・6問）… 原簿に「(1)(2)(3)は判定が割れうる。模範解答が無いので
#   断定しない→要現物照合」と書いてある。3問しか確定していないので大問ごと出さない

MARU = {c: i + 1 for i, c in enumerate("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳")}
LETTERS = "アイウエオカキクケコ"
COUNT = re.compile(r"[（(](\d+)問")


def strip_md(s):
    return s.replace("**", "").strip()


def item_lines(rec, daimon):
    """その大問の設問行だけを返す（★や→で始まる講評行は落とす）"""
    lines = rec.split("\n")
    head = re.compile(r"^- \*\*大問%d[｜|]" % daimon)
    for i, l in enumerate(lines):
        if not head.match(l):
            continue
        declared = COUNT.search(l)
        out, pool = [], None
        for j in range(i + 1, len(lines)):
            nxt = lines[j]
            if not nxt.startswith("  "):
                break
            body = nxt.strip()
            if not body.startswith("- "):
                break
            body = body[2:].strip()
            # 【B群】【語群】【選択肢】＝選びうる答えの一覧。pool 形式のときに使う
            if body.startswith("【"):
                pool = body
                continue
            if body.startswith(("**★", "★", "**→", "→", "**⚠", "⚠")):
                continue
            out.append(body)
        return out, pool, (int(declared.group(1)) if declared else None)
    return None, None, None


def split_slash(s):
    """／で割る。ただし（ ）の中の／では割らない。

    原簿は理由をかっこ書きする：「① **箱** → **イ ソウ**（竹＝意味／相＝ソウ）」。
    素直に split すると設問が真っ二つになって、大問まるごと取れなくなる（実際になった）。
    """
    out, buf, depth = [], [], 0
    for ch in s:
        if ch in "（(":
            depth += 1
        elif ch in "）)":
            depth = max(0, depth - 1)
        if ch == "／" and depth == 0:
            out.append("".join(buf)); buf = []
        else:
            buf.append(ch)
    out.append("".join(buf))
    return out


def split_items(chunks):
    """／で割って (番号, 本文) にする。丸数字・(1)・(1)の全角に対応"""
    got = []
    for chunk in chunks:
        for piece in split_slash(chunk):
            t = piece.strip()
            if not t:
                continue
            m = re.match(r"^[（(]?(\d+)[）)]?[ 　]*(.+)$", t)
            if m:
                got.append((int(m.group(1)), m.group(2).strip()))
            elif t[0] in MARU:
                got.append((MARU[t[0]], t[1:].strip()))
    return got


def parse_label(body, labels):
    """「真っ赤に→**ウ**」「なんと〜。→ **D**」→ (語, 分類名)"""
    m = re.split(r"→", body)
    if len(m) < 2:
        return None
    word = strip_md(m[0]).rstrip("。").strip()
    ansraw = strip_md(m[1])
    mk = re.match(r"^([A-Za-z%s])" % LETTERS, ansraw)
    if not mk or mk.group(1) not in labels:
        return None
    return word, labels[mk.group(1)]


def parse_label_eq(body, labels):
    """「**駅前**（えき・まえ）＝**C 重箱**」→ (語（読み）, 分類名)"""
    if "＝" not in body:
        return None
    left, right = body.rsplit("＝", 1)
    word = strip_md(left).strip()
    mk = re.match(r"^([A-Za-z%s])" % LETTERS, strip_md(right))
    if not mk or mk.group(1) not in labels:
        return None
    return word, labels[mk.group(1)]


def parse_pick(body, nashi=False):
    """「**ア 後退** イ 後日 ウ 午後 エ 後手 → **ア**」→ (選択肢[], 正解)

    nashi=True なら「→ **なし**」も答えとして認める（実物が「ない場合は『なし』」と
    書いている大問。答えが無いことが答え＝算数の「0通り」と同じ骨）。
    """
    if "→" not in body:
        return None
    left, right = body.rsplit("→", 1)
    if nashi and strip_md(right).startswith("なし"):
        parts = re.split(r"(?=[%s])" % LETTERS, strip_md(left))
        opts = {}
        for p in parts:
            p = p.strip()
            if p and p[0] in LETTERS:
                opts[p[0]] = p[1:].strip().rstrip("。／")
        if len(opts) < 2:
            return None
        return [opts[k] for k in sorted(opts, key=LETTERS.index)] + ["なし"], "なし"
    ansk = re.match(r"^\**([%s])" % LETTERS, right.strip())
    if not ansk:
        return None
    key = ansk.group(1)
    # 「ア 後退」「ア算数」の両方に対応。記号で切り出す
    parts = re.split(r"(?=[%s])" % LETTERS, strip_md(left))
    opts = {}
    for p in parts:
        p = p.strip()
        if not p or p[0] not in LETTERS:
            continue
        opts[p[0]] = p[1:].strip().rstrip("。／")
    if key not in opts or len(opts) < 2:
        return None
    return [opts[k] for k in sorted(opts, key=LETTERS.index)], opts[key]


def tail_note(body):
    """答えのうしろに原簿が書いた理由を取る。

    「→ **ア**（コウ／他はゴ）」→ "コウ／他はゴ"
    「→ **イ**（名詞／他は動詞）」→ "名詞／他は動詞"
    子どもが読む解説になるので、これがあるかないかで学べる量が変わる。
    """
    if "→" not in body and "＝" not in body:
        return ""
    tail = re.split(r"[→＝]", body)[-1]
    m = re.search(r"[（(]([^）)]{2,60})[）)]\s*$", strip_md(tail).strip())
    if not m:
        return ""
    note = m.group(1).strip()
    # ★私の分析メモは子どもに出さない。「誤答肢エ」のような記号は画面に無いので意味が通らない
    #   （→ [[feedback_hamagakuen_iinkai_rule]]④「内輪の言葉を出さない」と同じ理由）
    if re.search(r"★|誤答|ダミー|わな|定番|設計|型|オトン学園|原簿|→", note):
        return ""
    return note


def parse_labelq(body, labels):
    """「(1) 次の試合で**汚名ばんかい**できる…。→ **B**（理由）」→ (「」付きの文, 分類名)

    太字＝実物の ── 線。四択とちがい画面に記号が出ないので、「」でどこを見るか示す。
    """
    if "→" not in body:
        return None
    left, right = body.split("→", 1)
    mk = re.match(r"^\**([A-Za-z%s])" % LETTERS, right.strip())
    if not mk or mk.group(1) not in labels:
        return None
    sent = re.sub(r"\*\*(.+?)\*\*", r"「\1」", left).strip().rstrip("。")
    if "「" not in sent:
        return None
    return sent, labels[mk.group(1)]


def parse_pool(pool_line):
    """「【B群】ア アルプスの少女／**イ ロミオとジュリエット（ダミー）**／…」→ 選択肢[]

    ダミーの注記は落とす。ダミーも実物の選択肢なので、選択肢としては残す。
    """
    if not pool_line:
        return None
    body = strip_md(pool_line.split("】", 1)[1] if "】" in pool_line else pool_line)
    opts = []
    for p in split_slash(body):
        p = p.strip()
        m = re.match(r"^([%s])[ 　]*(.+)$" % LETTERS, p)
        if not m:
            continue
        text = m.group(2).strip()
        # 末尾の注記（「（ダミー）」「（ウとオが余る…）」）は私のメモ。選択肢の文言ではない
        text = re.sub(r"[（(][^（(]*(?:ダミー|余る)[^）)]*[）)]\s*$", "", text).strip()
        if text:
            opts.append(text)
    return opts or None


def parse_pool_item(body):
    """「(1) **スウィフト** → **キ ガリバー旅行記**」→ (問われる語, 答えの本文)"""
    if "→" not in body:
        return None
    left, right = body.rsplit("→", 1)
    m = re.match(r"^([%s])[ 　]*(.+)$" % LETTERS, strip_md(right))
    if not m:
        return None
    return strip_md(left).strip(), m.group(2).strip()


def parse_gloss(body):
    """「**うそぶく**：ア こらえる イ つぶやく ウ **とぼける** エ おどける → **ウ**」"""
    if "：" not in body or "→" not in body:
        return None
    word, rest = body.split("：", 1)
    got = parse_pick(rest)
    if not got:
        return None
    opts, ans = got
    return strip_md(word), opts, ans


def main():
    src = io.open(find_genbo(), encoding="utf-8").read()
    sec = src[src.index("# 📗 小4国語"):src.index("# 🎉🎉 小4国語")]
    recs = {}
    for r in re.split(r"(?=^### 【HG-24)", sec, flags=re.M)[1:]:
        recs[re.match(r"### 【HG-(\d+)】", r).group(1)] = r

    MEAN = {}
    if os.path.exists(MEANINGS):
        for r in json.load(io.open(MEANINGS, encoding="utf-8")):
            if r["id"] in MEAN:
                print("  ! 解説のidが重複している: %s" % r["id"])
            MEAN[r["id"]] = r["meaning"]

    out, units_of, problems, missing = [], collections.defaultdict(set), [], []
    for hg, daimon, unit, kind, labels, tmpl in SPECS:
        rec = recs.get(hg)
        if rec is None:
            problems.append("HG-%s のレコードが無い" % hg)
            continue
        chunks, pool_line, declared = item_lines(rec, daimon)
        if chunks is None:
            problems.append("HG-%s 大問%d の見出しが見つからない" % (hg, daimon))
            continue
        pool = parse_pool(pool_line) if kind == "pool" else None
        if kind == "pool" and not pool:
            problems.append("HG-%s 大問%d ： 選択肢の一覧（【B群】等）が読めない" % (hg, daimon))
            continue
        items = split_items(chunks)
        no = int(hg) - 2431
        made = 0
        for n, body in items:
            q = a = None
            choices = None
            if kind == "label":
                got = parse_label(body, labels) or parse_label_eq(body, labels)
                if got:
                    word, a = got
                    q = tmpl % word
                    choices = list(dict.fromkeys(labels.values()))
            elif kind in ("pick", "pick_nashi"):
                got = parse_pick(body, nashi=(kind == "pick_nashi"))
                if got:
                    choices, a = got
                    if kind == "pick_nashi" and "なし" not in choices:
                        choices = choices + ["なし"]     # 全問で選択肢をそろえる
                    q = tmpl
            elif kind == "gloss":
                got = parse_gloss(body)
                if got:
                    word, choices, a = got
                    q = tmpl % word
            elif kind == "labelq":
                got = parse_labelq(body, labels)
                if got:
                    word, a = got
                    q = tmpl % word
                    choices = list(dict.fromkeys(labels.values()))
            elif kind == "pool":
                got = parse_pool_item(body)
                if got:
                    word, ans = got
                    if ans not in pool:
                        # 原簿は答えのうしろに理由を書くことがある（「ソウ（竹＝意味…）」）。
                        # ただし「ピノッキオ（の冒険）」のようにかっこが答えの一部のこともあるので、
                        # 完全一致を先に試し、だめなときだけ末尾のかっこを外して照合する
                        ans = re.sub(r"[（(][^（(]*[）)]\s*$", "", ans).strip()
                    if ans in pool:
                        a = ans
                        q = tmpl % word
                        choices = list(pool)
            if not q or not a:
                continue
            qid = "hb4_%02d_%d_%02d" % (no, daimon, n)
            mean = MEAN.get(qid, "")
            if not mean:
                # 解説をまだ書いていない問題。検査で拾えるように印を残す
                missing.append((qid, q, a))
                mean = "答えは「%s」。" % a
            mean += "\n〔浜学園 小4国語 No.%d 大問%d・原簿 HG-%s〕" % (no, daimon, hg)
            out.append({
                "id": qid,
                "question": q,
                "answer": a,
                "choices": choices,
                "meaning": mean,
                "unit": unit,
                "grade": 4,
                "difficulty": 1,
                "src": "HG-%s" % hg,
            })
            made += 1
        # ★答えが原簿にそろっていない大問は、まるごと落とす（半端に出さない）
        if declared is not None and made != declared:
            problems.append("HG-%s 大問%d ： 宣言%d問 → 取れた%d問（この大問は出さない）"
                            % (hg, daimon, declared, made))
            out = [q for q in out if not q["id"].startswith("hb4_%02d_%d_" % (no, daimon))]
            continue
        units_of[str(no)].add(unit)
        print("  ✓ HG-%s 大問%d %-14s %2d問" % (hg, daimon, unit, made))

    print("=" * 66)
    print("作れた問題：%d問／%d回にことばが付く" % (len(out), len(units_of)))
    if problems:
        print("\n出さなかった大問（原簿に答えがそろっていない等）")
        for p in problems:
            print("  ・" + p)

    # 検査：4択の中に必ず答えがある／選択肢に重複が無い
    bad = []
    for q in out:
        if q["answer"] not in q["choices"]:
            bad.append("答えが選択肢に無い: " + q["id"])
        if len(set(q["choices"])) != len(q["choices"]):
            bad.append("選択肢が重複: " + q["id"] + " " + "/".join(q["choices"]))
        if len(q["choices"]) < 2:
            bad.append("選択肢が少なすぎる: " + q["id"])
    print("\n【検査1】選択肢の整合")
    if bad:
        for b in bad:
            print("  ✗ " + b)
    else:
        print("  ✓ 0件")

    # ★解説の検査。merge_meanings_kokugo.js と同じ考え方＝
    #   「答えが解説文に出てくるか」「結びが答えと食いちがっていないか」を機械で見る
    #   （→ [[oton_kokugo_audit]]「結びが答えと食い違っていた353本」）
    bad2 = []
    missing_ids = {m[0] for m in missing}
    for q in out:
        body = q["meaning"].split("\n")[0]
        if q["id"] in missing_ids:
            continue
        if q["answer"] not in body:
            bad2.append("答えが解説文に出てこない: %s（答え=%s）" % (q["id"], q["answer"]))
        elif not body.endswith("よって、答えは%sです。" % q["answer"]):
            bad2.append("結びが答えと合わない: %s ： …%s" % (q["id"], body[-26:]))
    unused = sorted(set(MEAN) - {q["id"] for q in out})

    print("\n【検査2】解説（%d問中 %d問に解説あり）" % (len(out), len(out) - len(missing)))
    if missing:
        for qid, qq, aa in missing[:20]:
            print("  ✗ 解説がまだ無い: %s ｜ %s → %s" % (qid, qq[:30], aa))
    if bad2:
        for b in bad2:
            print("  ✗ " + b)
    if unused:
        print("  ! どの問題にも結びつかない解説: " + ", ".join(unused[:10]))
    if not missing and not bad2 and not unused:
        print("  ✓ 0件（全問に解説あり・結びも答えと一致）")

    if "--write" in sys.argv:
        if bad or bad2 or missing or unused:
            print("\n✗ 検査に引っかかっているので書きこまない")
            sys.exit(1)
        cur = json.load(io.open(BUN, encoding="utf-8"))
        cur = [q for q in cur if not str(q.get("id", "")).startswith("hb4_")]
        cur.extend(out)
        with io.open(BUN, "w", encoding="utf-8") as f:
            json.dump(cur, f, ensure_ascii=False, indent=1)

        kok = json.load(io.open(KOKUGO, encoding="utf-8"))
        lessons = kok["grades"]["4"]["kokugo"]["lessons"]
        for k, v in lessons.items():
            v.pop("units", None)
        for k, us in units_of.items():
            if k in lessons:
                lessons[k]["units"] = sorted(us)
        with io.open(KOKUGO, "w", encoding="utf-8") as f:
            json.dump(kok, f, ensure_ascii=False, indent=1)
        print("\n✓ 書きこんだ → %s / %s" % (BUN, KOKUGO))
    else:
        print("\n（--write で書きこむ）")
        if out:
            print("\n見本:")
            print(json.dumps(out[0], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
