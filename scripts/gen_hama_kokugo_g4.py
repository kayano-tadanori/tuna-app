# -*- coding: utf-8 -*-
"""じゅくナビ国語（小4本科・Vクラス）の漢字データを、原簿からそのまま起こす。

種本は原簿 memory/hamagakuen_ryomon_genbo.md の
「📗 小4国語（本科教材・Vクラス）✅全43回 完了（HG-2431〜2473）」節。
実力確認テスト＋No.1〜42 の各回にある「カタカナ→漢字」の大問を機械で拾う。

★手打ちしない。原簿の表記ゆれを全部ここで吸収する。
  小3版（gen_hama_kokugo.py）とは書式が違う：
    小3  1 学校に**カヨ**う（通）／1 **サム**い→**寒(い)**
    小4  (1) **セキショ**を突破する。＝**関所**／⑤ 仲間に**クワワル**。＝**加わる**
  ＝ 区切り・丸数字・1回に漢字大問が2つある回（No.21・No.22）に対応する。

★出す前に4つ検査する（[[feedback_kaisetsu_reader]]＝私の誤りを間で止められる人がいないため）
  1. 宣言問数との一致   見出しの「（10問）」と実際に取れた数が合うか ←★これが門番
  2. 回をまたぐ一貫性   同じ問題文の答えが回で食いちがっていないか
  3. パースできなかった行
  4. 配当漢字（参考）   小1〜小4の教育漢字に無い字を挙げる（※表は手作りなので警告どまり）

  python scripts/gen_hama_kokugo_g4.py          … 検査だけして中身を出す
  python scripts/gen_hama_kokugo_g4.py --write  … data/hama_kokugo.json に書きこむ
"""
import io, json, os, re, sys, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_path import find_genbo          # noqa: E402

OUT = os.path.join(ROOT, "data", "hama_kokugo.json")

# ── 教育漢字（小1=80／小2=160／小3=200／小4=202・2020年度〜）────────────
# ※小1〜小3は gen_hama_kokugo.py と同じ表。小4は手作りなので【検査4は警告どまり】
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
G4 = ("愛案以衣位囲胃印英栄塩億加果貨課芽改械害街各覚完官管関観願希季紀喜旗器機議求泣救給挙漁"
      "共協鏡競極訓軍郡群径景芸欠結建健験固功好候航康告差菜最材昨札刷殺察参産散残士氏史司試児"
      "治滋辞鹿失借種周祝順初松笑唱焼象照賞臣信成省清静席積折節説浅戦選然争倉巣束側続卒孫帯隊"
      "達単置仲貯兆腸低底的典伝徒努灯堂働特得毒熱念敗梅博飯飛費必票標不夫付府阜富副兵別辺変便"
      "包法望牧末満未民無約勇要養浴利陸良料量輪類令冷例連老労録"
      "茨媛岡潟岐熊香佐埼崎縄井沖梨阪奈賀徳栃城宮崎")
assert len(G1) == 80 and len(G2) == 160 and len(G3) == 200, (len(G1), len(G2), len(G3))
ALLOW = set(G1) | set(G2) | set(G3) | set(G4)

KANJI = re.compile(r"[一-鿿々]")
KANA = re.compile(r"[ぁ-ゖ]")

# 漢字の書き取り大問の見出し（「音読みをカタカナで答える」＝読みの問題は拾わない）
# 大問番号は「大問4」だけでなく「大問（最後）」もある（HG-2469）ので数字を必須にしない
HEAD = re.compile(r"^- \*\*大問([^｜|]*)[｜|].*?(?:漢字に直す|かん字で書き)")
# 見出しに書いてある宣言問数「（10問）」「（10問・送りがなも）」「（14問）＝…」
COUNT = re.compile(r"[（(](\d+)問")
# 丸数字 → 算用数字
MARU = {c: i + 1 for i, c in enumerate("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳")}

# 答えが確定できないので出さない問題（→ 原簿の要現物照合リストへ）
EXCLUDE = {
    ("2436", 2): "原簿 #31。「テストでカイになる」の答えが小4配当漢字で確定できない（要現物照合）",
}


def strip_md(s):
    return s.replace("**", "")


def split_answer(raw):
    """答えを (書く漢字, 送りがな) に分ける。

    **関所**    → ("関所", "")
    **負**ける  → ("負",   "ける")
    **加わる**  → ("加",   "わる")
    **三億年**  → ("三億年", "")
    """
    full = strip_md(raw).strip().rstrip("。")
    m = re.match(r"^(.*[一-鿿々])([ぁ-ゖ]+)$", full)
    if m:
        return m.group(1), m.group(2)
    return full, ""


def parse_item(piece):
    """1問ぶん「(1) 文脈**カタカナ**する。＝**答え**」を分解する"""
    t = piece.strip()
    if not t:
        return None
    m = re.match(r"^[（(]?(\d+)[）)]?[ 　]*(.+)$", t)
    if m:
        no, body = int(m.group(1)), m.group(2)
    elif t[0] in MARU:
        no, body = MARU[t[0]], t[1:].strip()
    else:
        return None
    if "＝" not in body:
        return None
    left, right = body.rsplit("＝", 1)
    ans, okuri = split_answer(right)
    if not ans or not KANJI.search(ans):
        return None
    sent = re.sub(r"\*\*(.+?)\*\*", r"「\1」", strip_md(left).strip()) \
        if "**" in left else strip_md(left).strip()
    sent = re.sub(r"\*\*(.+?)\*\*", r"「\1」", left).strip()
    mk = re.search(r"「(.+?)」", sent)
    if mk:
        kana = mk.group(1)
        q = "%s ─ 「%s」を漢字で書こう" % (sent, kana)
    else:
        kana = sent
        q = "%s ─ 漢字で書こう" % kana
    return no, q, kana, ans, okuri


def main():
    genbo = find_genbo()
    src = io.open(genbo, encoding="utf-8").read()
    sec = src[src.index("# 📗 小4国語"):src.index("# 🎉🎉 小4国語")]
    recs = re.split(r"(?=^### 【HG-24)", sec, flags=re.M)[1:]

    lessons, stats = {}, collections.Counter()
    seen_q = collections.defaultdict(set)
    dropped, mismatch, out_of_range, excluded, uncertain = [], [], [], [], []

    for r in recs:
        hg = re.match(r"### 【HG-(\d+)】", r).group(1)
        head = r.split("\n", 1)[0]
        mno = re.search(r"No\.(\d+)", head)
        no = int(mno.group(1)) if mno else 0
        title = "実力確認テスト" if no == 0 else "No.%d" % no

        lines = r.split("\n")
        items = []
        for i, l in enumerate(lines):
            mh = HEAD.match(l)
            if not mh:
                continue
            mdn = re.search(r"\d+", mh.group(1))
            daimon = int(mdn.group(0)) if mdn else 9      # 「大問（最後）」は9番として採番
            declared = COUNT.search(l)
            declared = int(declared.group(1)) if declared else None

            buf = []
            for j in range(i + 1, len(lines)):
                nxt = lines[j]
                if not nxt.startswith("  "):
                    break
                body = nxt.strip()
                if not body.startswith("- "):
                    break
                body = body[2:].strip()
                # 「★…」「→ …」で始まる行は講評。設問ではない
                if body.startswith("**★") or body.startswith("★") \
                        or body.startswith("**→") or body.startswith("→") \
                        or body.startswith("**⚠") or body.startswith("⚠"):
                    continue
                # 「設問文：…」のような注記行。設問は必ず ＝ で答えを持つ
                if "＝" not in body:
                    continue
                buf.append(body)
            got = 0
            for chunk in buf:
                for piece in chunk.split("／"):
                    if not piece.strip():
                        continue
                    # ⚠ が付いた設問＝原簿が「答えを確定できていない」と書いたもの。
                    # 注釈ごと答えに取りこんでしまうので、機械的に外して要現物照合へ回す
                    if "⚠" in piece:
                        got += 1
                        uncertain.append((hg, title, daimon, piece.strip()[:70]))
                        continue
                    parsed = parse_item(piece)
                    if not parsed:
                        dropped.append((hg, title, piece[:50]))
                        continue
                    n, q, kana, ans, okuri = parsed
                    got += 1
                    if (hg, n) in EXCLUDE:
                        excluded.append((hg, title, n, kana, ans, EXCLUDE[(hg, n)]))
                        continue
                    word = ans + okuri
                    bad = [c for c in ans if KANJI.match(c) and c not in ALLOW]
                    if bad:
                        out_of_range.append((hg, title, n, kana, word, "".join(bad)))
                    seen_q[q].add((word, "HG-%s" % hg))
                    mean = "%s は「%s」と書きます。" % (kana, word)
                    if okuri:
                        mean += "送りがなは「%s」。" % okuri
                    mean += "〔浜学園 小4国語 %s・原簿 HG-%s〕" % (title, hg)
                    items.append({
                        "id": "hk4_%02d_%d_%02d" % (no, daimon, n),
                        "question": q,
                        "answer": ans,
                        "okuri": okuri,
                        "meaning": mean,
                        "grade": 4,
                        "difficulty": 1,
                        "src": "HG-%s" % hg,
                    })
            if declared is not None and got != declared:
                mismatch.append((hg, title, daimon, declared, got))

        if not items:
            print("⚠ HG-%s（%s）に漢字の大問が見つからない" % (hg, title))
            continue
        items.sort(key=lambda x: x["id"])
        lessons[str(no)] = {"src": "HG-%s" % hg, "title": title, "kanji": items}
        stats["回"] += 1
        stats["問"] += len(items)

    # ── 検査 ────────────────────────────────────────────────
    print("=" * 66)
    print("収録：%d回／%d問" % (stats["回"], stats["問"]))
    if excluded:
        print("\n答えが確定できないので外した（→ 原簿の要現物照合リスト）")
        for hg, t, n, kana, ans, why in excluded:
            print("  ・HG-%s %s (%d) %s→%s ： %s" % (hg, t, n, kana, ans, why))

    if uncertain:
        print("\n⚠ 原簿が答えを確定できていない設問（出さない。→ 要現物照合リスト）")
        for hg, t, d, p in uncertain:
            print("  ・HG-%s %s 大問%d ： %s" % (hg, t, d, p))

    print("\n【検査1】見出しの宣言問数と実際に取れた数（★門番）")
    if mismatch:
        for hg, t, d, want, got in mismatch:
            print("  ✗ HG-%s %s 大問%d ： 宣言%d問 → 取れた%d問" % (hg, t, d, want, got))
    else:
        print("  ✓ 0件（全部の大問で宣言どおりに取れた）")

    print("\n【検査2】同じ問題文なのに答えがちがう")
    ng = {k: v for k, v in seen_q.items() if len({a for a, _ in v}) > 1}
    if ng:
        for k, v in sorted(ng.items()):
            print("  ✗ %s ： %s" % (k, " / ".join("%s(%s)" % (a, s) for a, s in sorted(v))))
    else:
        print("  ✓ 0件")

    print("\n【検査3】パースできなかった行")
    if dropped:
        for hg, t, p in dropped:
            print("  ✗ HG-%s %s ： %s" % (hg, t, p))
    else:
        print("  ✓ 0件")

    print("\n【検査4】小1〜小4の配当漢字に無い字（※表は手作り。警告どまり）")
    if out_of_range:
        for hg, t, n, kana, word, bad in out_of_range:
            print("  ! HG-%s %s (%d) %s→%s ： %s" % (hg, t, n, kana, word, bad))
    else:
        print("  ✓ 0件")

    ok = not mismatch and not ng and not dropped
    if "--write" in sys.argv:
        if not ok:
            print("\n✗ 検査1〜3に引っかかっているので書きこまない")
            sys.exit(1)
        data = json.load(io.open(OUT, encoding="utf-8"))
        data["grades"]["4"] = {"kokugo": {"lessons": lessons}}
        with io.open(OUT, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print("\n✓ 書きこんだ → %s" % OUT)
    else:
        print("\n（--write で data/hama_kokugo.json の grades.4 に書きこむ）")
        k0 = lessons.get("1", {}).get("kanji", [])
        if k0:
            print("\n見本（No.1 の1問目）:")
            print(json.dumps(k0[0], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
