# -*- coding: utf-8 -*-
"""夏期講習V（小5最レ国語）のことわざを、ことわざカテゴリに足す。

種本＝原簿 HG-2558（夏期講習V No.1 大問2）／HG-2559（同 No.2 大問2）。
★夏期講習は「今週の復習テスト」ではないので**じゅくナビには入れない**（本人指示 2026-08-08
  「講習の問題はカテゴリーに使ったらいいよ」）。一般カテゴリなので4択にしてよい。
★答えが⚠のものは落とす。

出し先＝data/kotowaza.json（既存473問の後ろに k9xxx で足す。再実行しても重ならない）

  python scripts/gen_kokugo_natsuki.py --write
"""
import io, json, os, re, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_path import find_genbo          # noqa: E402

OUT = os.path.join(ROOT, "data", "kotowaza.json")
MEAN = os.path.join(HERE, "meanings_hama_g5sairei.json")
PREFIX = "k9"          # 既存は k001〜。ここは夏期講習ぶんの帯

# 原簿の答え → 解説のキー（ことわざの全文）。原簿はマスの中身だけを答えにしているので橋渡しする
KEY = {
    "いしばし": "石橋をたたいて渡る", "うり": "瓜のつるになすびはならぬ", "かえる": "蛙のつらに水",
    "つる": "鶴の一声", "とうふ": "豆腐にかすがい", "すずめ": "雀百までおどりわすれず",
    "どんぐり": "どんぐりの背比べ", "しちじゅうご": "人のうわさも七十五日", "たい": "えびで鯛をつる",
    "たすき": "帯に短したすきに長し", "あわ": "ぬれ手で粟", "きねづか": "昔とった杵柄",
    "たぬき": "とらぬ狸の皮算用", "わら": "おぼれる者は藁をもつかむ", "どろぼう": "泥棒を見て縄をなう",
    "かっぱ": "河童の川流れ", "せんどう": "船頭多くして船山にのぼる", "かど": "笑う門には福きたる",
    "たび": "かわいい子には旅をさせよ", "じょうず": "好きこそものの上手なれ",
    "たいかい": "井の中の蛙大海を知らず", "たいぼく": "うどの大木", "よこ": "下手の横好き",
    "ひゃく": "三つ子の魂百まで", "あつさ": "のど元過ぎれば熱さをわすれる", "だんご": "花より団子",
    "つめ": "能ある鷹は爪をかくす", "つりがね": "ちょうちんに釣鐘", "くい": "出る杭は打たれる",
    "なつのむし": "飛んで火に入る夏の虫", "こつぶ": "山椒は小粒でもぴりりとからい",
    "はじ": "旅の恥はかきすて", "うれい": "備えあれば憂いなし",
}
LINE = re.compile(r"\((\d+)\)\s*([^＝\n]+?)＝\*\*([^*⚠\n]+?)\*\*")


def body(text, hg):
    m = re.search(r"^### 【HG-%s】.*?$(.*?)(?=^### 【HG-|\Z)" % hg, text, re.S | re.M)
    return m.group(1) if m else ""


def main():
    text = io.open(find_genbo(), encoding="utf-8").read()
    notes = {m["word"]: m["note"].replace("**", "")
             for m in json.load(io.open(MEAN, encoding="utf-8"))}

    got, nokey = [], []
    for hg, tag in (("2558", "1"), ("2559", "2")):
        b = body(text, hg)
        assert b, hg
        n = 0
        for m in LINE.finditer(b):
            no, sent, ans = (s.strip() for s in m.groups())
            if ans not in KEY:
                nokey.append((tag, no, sent, ans)); continue
            got.append((tag, int(no), sent, ans, KEY[ans]))
            n += 1
        print("夏期講習V No.%s … %d問" % (tag, n))
    if nokey:
        print("\n✗ 解説キーに無い答えがあります（KEY に足してください）：")
        for t, n, s2, a in nokey:
            print("   No.%s (%s) %s ＝ %s" % (t, n, s2, a))
        sys.exit(1)

    answers = [g[3] for g in got]
    qs = []
    for i, (tag, no, sent, ans, key) in enumerate(got):
        others = [a for a in answers if a != ans]
        ds = [others[(i * 5 + j * 7) % len(others)] for j in range(3)]
        # 同じ答えが重ならないように詰め直す
        pool = [a for a in others if a not in ds]
        while len(set(ds)) < 3 and pool:
            ds[ds.index(sorted(ds)[0])] = pool.pop(0)
        qs.append({
            "id": "%s%s%02d" % (PREFIX, tag, no),
            "question": "「%s」の（　）に入る言葉は？" % sent,
            "answer": ans,
            "choices": sorted(set([ans] + ds[:3])),
            "meaning": notes[key] + "よって、答えは「%s」です。〔浜学園 小5最レ国語 夏期講習V No.%s・原簿 HG-%s〕"
                       % (ans, tag, "2558" if tag == "1" else "2559"),
            "difficulty": 3, "grade": 5,
        })

    ng = []
    for q in qs:
        if q["answer"] not in q["choices"]:
            ng.append((q["id"], "答えが選択肢にない"))
        if len(set(q["choices"])) != 4:
            ng.append((q["id"], "選択肢が4つでない（%d）" % len(set(q["choices"]))))
        if len(q["meaning"]) < 40:
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
    print("✅ 検査通過（答えが選択肢にある／選択肢4つ／解説あり／IDの重複なし）")
    print("\n--- 見本 ---")
    for q in qs[:2]:
        print("[%s] %s" % (q["id"], q["question"]))
        print("   %s → %s" % (" / ".join(q["choices"]), q["answer"]))
        print("   %s" % q["meaning"][:100])

    if "--write" in sys.argv:
        cur = json.load(io.open(OUT, encoding="utf-8"))
        keep = [q for q in cur if not str(q.get("id", "")).startswith(PREFIX)]
        json.dump(keep + qs, io.open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("\n→ data/kotowaza.json に %d問 足した（既存 %d問 ＋ %d問 ＝ %d問）"
              % (len(qs), len(keep), len(qs), len(keep) + len(qs)))


if __name__ == "__main__":
    main()
