# -*- coding: utf-8 -*-
"""じゅくナビ国語（小3本科）の漢字データを、原簿からそのまま起こす。

種本は原簿 memory/hamagakuen_ryomon_genbo.md の
「📕 小3 国語（本科教材）全43回 ─ HG-2501〜2543」節。
実力確認テスト＋No.1〜42 の各回にある「大問4 カタカナ→漢字（10問）」を機械で拾う。

★手打ちしない。原簿の表記ゆれを全部ここで吸収する。
  A) 全角カッコ      1 学校に**カヨ**う（通）／1 オンガク（音楽）
  B) 矢印            1 **サム**い→**寒(い)**／5 生物の**ケンキュウ**→（研究）
  C) 見出し行に同居   - **大問6 ひらがな→漢字（5問）**：(1)服を**きる**（着る）／…

★出す前に3つ検査する（[[feedback_kaisetsu_reader]]＝私の誤りを間で止められる人がいないため）
  1. 配当漢字チェック   小1〜小3の教育漢字440字に無い字を全部出す
  2. 回をまたぐ一貫性   同じカタカナ語の答えが回で食いちがっていないか
  3. 模範解答との突合   原簿で「模範解答で確定」と書いた回は、その旨を verified に残す

  python scripts/gen_hama_kokugo.py          … 検査だけして中身を出す
  python scripts/gen_hama_kokugo.py --write  … data/hama_kokugo.json に書きこむ
"""
import io, json, os, re, sys, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "hama_kokugo.json")
GENBO = os.path.join(
    os.path.expanduser("~"),
    r".claude\projects\c--Users-User-Desktop-Claude\memory\hamagakuen_ryomon_genbo.md")

# ── 教育漢字（小1=80／小2=160／小3=200）──────────────────────────
# 小1・小2は scripts/fix_low_grade_kanji.py と同じ表
G1 = ("一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水"
      "正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六")
G2 = ("引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後"
      "語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親"
      "図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉"
      "馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話")
G3 = ("悪安暗医委意育員院飲運泳駅央横屋温化荷開界階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具"
      "君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿"
      "所暑助昭消商章勝乗植申身神真深進世整昔全相送想息速族他打対待代第題炭短談着注柱丁帳調追"
      "定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒病品負部服福物平返勉"
      "放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和")
assert len(G1) == 80 and len(G2) == 160 and len(G3) == 200, (len(G1), len(G2), len(G3))
ALLOW3 = set(G1) | set(G2) | set(G3)

KANJI = re.compile(r"[一-鿿々]")
KANA = re.compile(r"[ぁ-ゖ]")

# 小3までの配当には無いが、浜が先取りで出している字（模範解答で裏が取れているものだけ）
ALLOW_EXTRA = {
    "関": "HG-2505 No.4「カンシン→関心」。関は小4配当だが、この回は模範解答で全問確定ずみ",
}
# 答えが確定できないので第1弾では出さない問題（→ 原簿の要現物照合リストへ）
EXCLUDE = {
    ("2501", 4): "「手ちょうに電話番ごうをヒカえる（控）」。控は中学配当で、"
                 "小2の総ざらいである実力確認テストに出るとは考えにくい。読み取り違いを疑う",
}
# 原簿が下線を残していない問題で、どこを漢字に直すのかを補う
# （HG-2519＝No.18 は「ひらがな→漢字」なので、印をつけないと何を書くのか分からない）
MARK = {
    ("2519", 5): "たまひろい",
    ("2519", 6): "しゅうぎょうしき",
    ("2519", 7): "しゅうごう",
    ("2519", 8): "げしゅく",
}
# 漢字ブロックの見出し（大問番号は回によってちがう）
HEAD = re.compile(
    r"^- \*\*(?:①\s*)?(?:大問\d+[A-Z]?[ 　]?)?"
    r"(?:カタカナ→漢字|カタカナ→かん字|ひらがな→漢字|大問\d+（漢字・読み書き混合\d+問）)")
# 原簿の「模範解答で確定」表記
VERIFIED = re.compile(r"模範解答")
# HG-2519（No.18）の1〜4は「かん字→読み」の問題。第1弾は書きだけなので外す
SKIP_ITEMS = {"2519": {1, 2, 3, 4}}
# ★その回の「ことば」の単元 → data/kokugo_bun.json（文のしくみ）の unit。
#   原簿に「★1回まるごと◯◯の回」と書いてある回だけ。ほかの回は推測で足さない
UNITS = {
    "14": ["こそあどことば"],     # HG-2515
    "20": ["主語・じゅつ語"],     # HG-2521
    "22": ["しゅうしょく語"],     # HG-2523
    "24": ["文図"],               # HG-2525
}


def strip_md(s):
    """太字マークを外す"""
    return s.replace("**", "")


def split_answer(raw):
    """答えの部分から (書く漢字, かっこの中身, 見出しに出す全体形) を取る。

    先**取点**   → ("取点", "",   "先取点")   ※先は問題文に出ている
    **寒(い)**   → ("寒",   "い", "寒(い)")
    **守(備)**   → ("守",   "備", "守(備)")
    （研究）      → ("研究", "",   "研究")
    （始）業式    → ("始業式","",  "始業式")
    """
    full = strip_md(raw).strip()
    full = full.replace("（", "").replace("）", "")   # 全角カッコは飾り。中身は答えの一部
    m = re.match(r"^([^(]+)\((.+)\)$", full)
    if m:
        return m.group(1), m.group(2)
    # 原簿は「寒(い)」と「寒い」の2通りで書いてある。送りがなを機械で切りはなして形をそろえる
    m = re.match(r"^(.*[一-鿿々])([ぁ-ゖ]+)$", full)
    if m:
        return m.group(1), m.group(2)
    return full, ""


def parse_item(text, hg):
    """1問ぶんのテキストから (番号, 問題文, 答え, かっこ, 全体形) を取る"""
    text = text.strip()
    m = re.match(r"^\(?(\d+)\)?[ 　]*(.+)$", text)
    if not m:
        return None
    no, body = int(m.group(1)), m.group(2).strip()

    if "→" in body:                                  # B) 矢印
        left, right = body.split("→", 1)
        kana_src, ans_raw = left, right
    else:                                            # A) 全角カッコ
        m2 = re.match(r"^(.*?)（([^（）]+)）\s*$", body)
        if not m2:
            return None
        kana_src, ans_raw = m2.group(1), "（%s）" % m2.group(2)

    ans, paren = split_answer(ans_raw)
    # 問題文：太字だったカタカナを「」でくくる（実物の下線の代わり）
    sent = re.sub(r"\*\*(.+?)\*\*", r"「\1」", kana_src).strip()
    mk = MARK.get((hg, no))
    if mk and mk in sent:
        sent = sent.replace(mk, "「%s」" % mk, 1)
    if "「" in sent:
        kana = re.search(r"「(.+?)」", sent).group(1)
        q = "%s ─ 「%s」を漢字で書こう" % (sent, kana)
    else:                                            # 原簿が語だけを残している回
        kana = sent
        q = "%s ─ 漢字で書こう" % kana
    return no, q, kana, ans, paren


def main():
    src = io.open(GENBO, encoding="utf-8").read()
    sec = src[src.index("# 📕 小3 国語"):]
    recs = re.split(r"(?=^### 【HG-25)", sec, flags=re.M)[1:]

    lessons, stats = {}, collections.Counter()
    excluded = []
    seen_kana = collections.defaultdict(set)          # 回をまたぐ一貫性チェック用
    out_of_range, dropped = [], []

    for r in recs:
        hg = re.match(r"### 【HG-(\d+)】", r).group(1)
        head = r.split("\n", 1)[0]
        # 回番号：実力＝0、No.◯＝◯
        mno = re.search(r"\*\*(?:No\.(\d+)|実力確認テスト)\*\*", head)
        no = 0 if (mno and mno.group(1) is None) else int(mno.group(1))
        title = "実力確認テスト" if no == 0 else "No.%d" % no

        lines = r.split("\n")
        chunk = None
        for i, l in enumerate(lines):
            if not HEAD.match(l):
                continue
            body = l.split("：", 1)[1] if "：" in l else ""   # C) 見出し行に同居
            buf = [body] if body else []
            for j in range(i + 1, len(lines)):
                nxt = lines[j]
                if nxt.startswith("  - ") or not nxt.startswith("  "):
                    break
                buf.append(nxt.strip())
            chunk = "".join(buf)
            break
        if not chunk:
            stats["漢字ブロックなし"] += 1
            print("⚠ HG-%s（%s）に漢字のブロックが見つからない" % (hg, title))
            continue

        items = []
        for piece in chunk.split("／"):
            if not piece.strip():
                continue
            got = parse_item(piece, hg)
            if not got:
                dropped.append((hg, piece[:40]))
                continue
            n, q, kana, ans, paren = got
            if n in SKIP_ITEMS.get(hg, set()):
                stats["読みの問題として除外"] += 1
                continue
            if not KANJI.search(ans):                 # 答えに漢字が無い＝読みの問題
                stats["読みの問題として除外"] += 1
                continue
            if (hg, n) in EXCLUDE:
                stats["答えが確定できず除外"] += 1
                excluded.append((hg, title, n, kana, ans, EXCLUDE[(hg, n)]))
                continue
            word = ans + paren
            bad = [c for c in ans if KANJI.match(c)
                   and c not in ALLOW3 and c not in ALLOW_EXTRA]
            if bad:
                out_of_range.append((hg, title, n, kana, word, "".join(bad)))
            # 同じ問題文なのに答えがちがう＝ほんとうの食いちがい（同音異字は正しいので拾わない）
            seen_kana[q].add((word, "HG-%s" % hg))

            mean = "%s は「%s」と書きます。" % (kana, word)
            if paren and KANA.match(paren[0]):
                mean += "送りがなは「%s」。" % paren
            elif paren:
                mean += "書くのは「%s」の字。" % ans
            mean += "〔浜学園 小3国語 %s・原簿 HG-%s〕" % (title, hg)
            items.append({
                "id": "hk3_%02d_%02d" % (no, n),
                "question": q,
                "answer": ans,
                "okuri": paren,
                "meaning": mean,
                "grade": 3,
                "difficulty": 1,
                "src": "HG-%s" % hg,
            })
        items.sort(key=lambda x: x["id"])
        rec = {"src": "HG-%s" % hg, "title": title, "kanji": items}
        # ★その回で習う「ことば」の単元。じゅくナビの「📖 今週のことば」がこれを見て
        #   data/kokugo_bun.json（文のしくみ）から問題を集める。
        #   実物に単元がはっきり出ている回だけ入れる（推測で足さない）
        if str(no) in UNITS:
            rec["units"] = UNITS[str(no)]
        # 原簿のレコード見出しに「🎁模範解答つき」と書いてある回だけ。本文中の言及は拾わない
        if VERIFIED.search(head):
            rec["verified"] = "模範解答"
        lessons[str(no)] = rec
        stats["回"] += 1
        stats["問"] += len(items)

    # ── 検査 ────────────────────────────────────────────────
    print("=" * 60)
    print("収録：%d回／%d問" % (stats["回"], stats["問"]))
    print("読みの問題として外した：%d問" % stats["読みの問題として除外"])
    print("模範解答つき：%d回" % sum(1 for v in lessons.values() if v.get("verified")))
    if excluded:
        print("\n答えが確定できないので外した問題（→ 原簿の要現物照合リストへ）")
        for hg, title, n, kana, ans, why in excluded:
            print("  ・HG-%s %s (%d) %s→%s ： %s" % (hg, title, n, kana, ans, why))

    print("\n【検査1】小3までの配当漢字に無い字")
    if out_of_range:
        for hg, title, n, kana, full, bad in out_of_range:
            print("  ✗ HG-%s %s (%d) %s→%s ： %s" % (hg, title, n, kana, full, bad))
    else:
        print("  ✓ 0件")

    print("\n【検査2】同じ問題文なのに答えがちがう")
    ng2 = {k: v for k, v in seen_kana.items() if len({a for a, _ in v}) > 1}
    if ng2:
        for k, v in sorted(ng2.items()):
            print("  ✗ %s ： %s" % (k, " / ".join("%s(%s)" % (a, s) for a, s in sorted(v))))
    else:
        print("  ✓ 0件（同じ読みで別の漢字＝同音異字は正しいので拾っていない）")

    print("\n【検査3】パースできなかった行")
    if dropped:
        for hg, p in dropped:
            print("  ✗ HG-%s ： %s" % (hg, p))
    else:
        print("  ✓ 0件")

    ok = not out_of_range and not ng2 and not dropped
    data = {
        "_note": [
            "じゅくナビ 国語専用データ。通常問題プール(kanji_kaki.json)とは別のバケツ。",
            "grades[学年][コース].lessons[回番号] = { src, title, kanji:[…] }。",
            "回そのものが1セット（原簿の大問4＝カタカナ→漢字10問）。ID帯でも単元名でもなく回番号で引く。",
            "answer は書く漢字だけ。okuri はもう書いてある部分（送りがな等）。",
            "difficulty は全問1でそろえる（クラス帯フィルタで10問が欠けないため）。",
            "scripts/gen_hama_kokugo.py で原簿から機械生成する。手で直さない。",
        ],
        "grades": {"3": {"kokugo": {"lessons": lessons}}},
    }
    if "--write" in sys.argv:
        if not ok:
            print("\n✗ 検査に引っかかっているので書きこまない")
            sys.exit(1)
        with io.open(OUT, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print("\n✓ 書きこんだ → %s" % OUT)
    else:
        print("\n（--write で data/hama_kokugo.json に書きこむ）")
        k0 = lessons.get("4", {}).get("kanji", [])
        if k0:
            print("\n見本（No.4 の1問目）:")
            print(json.dumps(k0[0], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
