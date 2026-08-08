# -*- coding: utf-8 -*-
"""じゅくナビ国語（小4本科V）に「漢字の書き分け」を足す。

種本は原簿の小4国語の漢字大問。**同じ読みで別の字が2問ならんでいる組**だけを拾う。
原簿：「2問ずつ対にする設計。となりあう2問が同じ読みで別の字なので、
       片方だけ知っていても両方は取れない」
＝この対をそのまま出題にすれば、実物の狙いが保てる。

★選択肢の作り方
  - **実物の対（2つ）は必ず入れる**。ここは原簿そのもの
  - 足りないぶんは **実在する同じ読みの語** を足して4択にする（下の EXTRA）。
    でっち上げはしない。足せないものは実物の2択のまま出す
    （app.js の buildChoices は選択肢2個以上をそのまま使う）

★漢字の書き取り（手書き画面）とは別角度。
  書き取り＝「書けるか」／書き分け＝「使い分けられるか」。
  [[oton_kokugo_audit]]「『穴うめ』と『意味→語』は別角度なのでペアは正常」と同じ考え方。

  python scripts/gen_hama_kakiwake_g4.py          … 検査だけして中身を出す
  python scripts/gen_hama_kakiwake_g4.py --write  … data/kokugo_bun.json に書きこむ
"""
import io, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import gen_hama_kokugo_g4 as G          # 漢字大問のパーサを借りる（基準を2つ持たない）

# ★import より後に置く。G も stdout を差し替えるので、先に包むと二重になって壊れる
sys.stdout.reconfigure(encoding="utf-8")

BUN = os.path.join(ROOT, "data", "kokugo_bun.json")
KOKUGO = os.path.join(ROOT, "data", "hama_kokugo.json")

# 読み → 足す選択肢（実在する同じ読みの語だけ。無理に4択にしない）
EXTRA = {
    "キカン":   ["期間", "気管"],
    "ハカ":     ["測る", "量る"],
    "ショウ":   ["章", "賞"],
    "カイホウ": ["開放", "会報"],
    "タイショウ": ["対称", "大将"],
    "キショウ": ["起床", "希少"],
}

# 字 → 短い意味。解説は「正解の意味」と「まぎらわしい字の意味」を**並べて**組み立てる。
# ★ここは原簿に無い（原簿は答えしか持たない）ので、私が書く。EXTRA で足した字も全部いる。
# ★書き方の約束
#   ・値に「。」を入れない。「…なので、ここでは使いません」につなぐので、途中で切れると読めなくなる
#   ・かっこの中の例は、**問題文とちがう例**にする。同じ例だと答えを写すだけで、覚える語が増えない
GLOSS = {
    "器官": "体の中で決まったはたらきをする部分（呼吸器官・感覚器官）",
    "機関": "しくみや組織、または動力を出す装置（機関車・金融機関）",
    "期間": "いつからいつまで、というあいだ（学習期間）",
    "気管": "息が通る、のどから肺までの管",
    "計る": "数や時間をかぞえてはかること（人数を計る）",
    "図る": "うまくいくように計画すること（問題の解決を図る）",
    "測る": "長さ・高さ・深さをはかること（水深を測る）",
    "量る": "重さやかさをはかること（体重を量る）",
    "負う": "背中にのせる、また責任を引きうけること（つみを負う）",
    "追う": "後ろから追いかけること（ゆめを追う）",
    "空く": "場所やすきまがあくこと（電車が空く）",
    "明ける": "夜が終わって朝になる、また期間が終わること（つゆが明ける）",
    "身": "体そのもの、また自分自身（身につける）",
    "実": "植物のみ、また努力の成果（木の実）",
    "昭": "あきらかで明るい、という意味の字",
    "勝": "かつ、という意味の字（勝利・優勝）",
    "章": "文章のまとまりや、しるし（第一章・校章）",
    "賞": "ほめてあたえるもの（賞をもらう）",
    "創造": "今までに無いものを新しく作り出すこと（「創」は はじめて作る）",
    "想像": "頭の中で思いえがくこと（「想」は おもう）",
    "快方": "病気やけがが良くなっていくこと（「快」は こころよい）",
    "解放": "しばられていたものを ときはなすこと（「解」は とく）",
    "開放": "門やまどを開けはなすこと（校庭を開放する）",
    "会報": "会のメンバーに配るお知らせの紙",
    "対照": "二つをくらべて、ちがいがはっきりすること（明暗が対照的）",
    "対象": "はたらきかける相手（調査の対象）",
    "対称": "形が左右つりあっていること（左右対称）",
    "大将": "軍のいちばん上の人、またなかまのかしら",
    "競争": "勝ち負けをあらそうこと（あらそうの「争」）",
    "競走": "走って速さをくらべること（はしるの「走」）",
    "気象": "天気のようす（気象予報士）",
    "記章": "むねなどにつける しるし（きねん記章）",
    "起床": "朝おきること（起床時間）",
    "希少": "とてもめずらしくて少ないこと",
    "半生": "人生の半分、これまでの人生",
    "反省": "自分のおこないをふりかえって考えること",
}


def main():
    src = io.open(G.find_genbo(), encoding="utf-8").read()
    sec = src[src.index("# 📗 小4国語"):src.index("# 🎉🎉 小4国語")]
    recs = re.split(r"(?=^### 【HG-24)", sec, flags=re.M)[1:]

    out, units_of, missing = [], collections.defaultdict(set), []
    for r in recs:
        hg = re.match(r"### 【HG-(\d+)】", r).group(1)
        no = int(hg) - 2431
        lines = r.split("\n")
        for i, l in enumerate(lines):
            mh = G.HEAD.match(l)
            if not mh:
                continue
            mdn = re.search(r"\d+", mh.group(1))
            daimon = int(mdn.group(0)) if mdn else 9
            buf = []
            for j in range(i + 1, len(lines)):
                nxt = lines[j]
                if not nxt.startswith("  "):
                    break
                b = nxt.strip()
                if not b.startswith("- "):
                    break
                b = b[2:].strip()
                if b.startswith(("**★", "★", "**→", "→", "**⚠", "⚠")) or "＝" not in b:
                    continue
                buf.append(b)
            items = []
            for chunk in buf:
                for piece in chunk.split("／"):
                    if not piece.strip() or "⚠" in piece:
                        continue
                    got = G.parse_item(piece)
                    if got:
                        n, q, kana, ans, okuri = got
                        items.append((n, kana, q, ans + okuri))
            by = collections.defaultdict(list)
            for it in items:
                by[it[1]].append(it)
            for kana, grp in sorted(by.items()):
                answers = sorted({x[3] for x in grp})
                if len(grp) < 2 or len(answers) < 2:
                    continue
                choices = answers + [c for c in EXTRA.get(kana, []) if c not in answers]
                for n, _, q, ans in grp:
                    sent = q.split(" ─ ")[0]
                    if any(c not in GLOSS for c in choices):
                        missing.extend(c for c in choices if c not in GLOSS)
                        continue
                    # ①正解の意味 → ②実物で対になっている字の意味 → ③残りの選択肢を一言 → ④結び
                    pair = [a for a in answers if a != ans]
                    rest = [c for c in choices if c != ans and c not in pair]
                    mean = "「%s」は%s。" % (ans, GLOSS[ans])
                    if pair:
                        mean += "同じ読みの「%s」は%sなので、ここでは使いません。" % (
                            pair[0], GLOSS[pair[0]])
                    if rest:
                        mean += "（%s）" % "／".join("%s＝%s" % (c, GLOSS[c]) for c in rest)
                    mean += "よって、答えは%sです。\n〔浜学園 小4国語 No.%d 大問%d・原簿 HG-%s〕" % (
                        ans, no, daimon, hg)
                    out.append({
                        "id": "hw4_%02d_%d_%02d" % (no, daimon, n),
                        "question": "%s ─ 「%s」はどの漢字？" % (sent, kana),
                        "answer": ans,
                        "choices": choices,
                        "meaning": mean,
                        "unit": "漢字の書き分け",
                        "grade": 4,
                        "difficulty": 2,
                        "src": "HG-%s" % hg,
                    })
                units_of[str(no)].add("漢字の書き分け")
                print("  ✓ No.%-2d 大問%d 読み「%s」 %d問  選択肢%d個  %s"
                      % (no, daimon, kana, len(grp), len(choices), " / ".join(choices)))

    print("=" * 66)
    print("作れた問題：%d問／%d回" % (len(out), len(units_of)))
    bad = []
    for q in out:
        if q["answer"] not in q["choices"]:
            bad.append("答えが選択肢に無い: " + q["id"])
        if len(set(q["choices"])) != len(q["choices"]):
            bad.append("選択肢が重複: " + q["id"])
        body = q["meaning"].split("\n")[0]
        if not body.endswith("よって、答えは%sです。" % q["answer"]):
            bad.append("解説の結びが答えと合わない: " + q["id"])
    for m in sorted(set(missing)):
        bad.append("GLOSS に意味が書かれていない字: " + m)
    for w, g in sorted(GLOSS.items()):
        if "。" in g:
            bad.append("GLOSS に「。」が入っている（文がねじれる）: " + w)
    print("\n【検査】")
    print("  ✓ 0件" if not bad else "\n".join("  ✗ " + b for b in bad))

    if "--write" in sys.argv:
        if bad:
            print("\n✗ 検査に引っかかっているので書きこまない")
            sys.exit(1)
        cur = [q for q in json.load(io.open(BUN, encoding="utf-8"))
               if not str(q.get("id", "")).startswith("hw4_")]
        cur.extend(out)
        with io.open(BUN, "w", encoding="utf-8") as f:
            json.dump(cur, f, ensure_ascii=False, indent=1)
        kok = json.load(io.open(KOKUGO, encoding="utf-8"))
        lessons = kok["grades"]["4"]["kokugo"]["lessons"]
        for k, us in units_of.items():
            if k in lessons:
                lessons[k]["units"] = sorted(set(lessons[k].get("units", [])) | us)
        with io.open(KOKUGO, "w", encoding="utf-8") as f:
            json.dump(kok, f, ensure_ascii=False, indent=1)
        print("\n✓ 書きこんだ")
    else:
        print("\n【中身】")
        for q in out:
            print("\n%s" % q["question"])
            print("   選択肢 %s   → 答え %s" % (" ｜ ".join(q["choices"]), q["answer"]))
            print("   %s" % q["meaning"].split("\n")[0])
        print("\n（--write で書きこむ）")


if __name__ == "__main__":
    main()
