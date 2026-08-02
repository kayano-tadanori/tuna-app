# -*- coding: utf-8 -*-
"""じゅくナビ「かんたん解説」モードに国語（小3本科）を足す。

かんたん解説は今まで最レ（算数）だけだったが、茅野さんの提案（2026-08-03）で
国語にも「主語・じゅつ語」「しゅうしょく語」などを解説するモードを作る。

★かんたん解説は「回番号」で引く（app.js の hamaKaisetsuForNo）。
  国語は去年も今年も同じカリキュラム（刷新されていない）なので、
  最レのように単元名で引く必要はない。回番号がそのまま使える。

種本＝data/kokugo_bun.json（すでにある練習問題プール）。
  れい（例題）だけは新規に書く。るいだい（類題）は既存の kb id からそのまま引く
  ＝答え・選択肢・解説を書き直さない（[[feedback_genbo_dori]]と同じ姿勢：
  すでに検算ずみのものを再利用し、新しく答えを起こす箇所を最小にする）。

  python scripts/gen_kokugo_kaisetsu.py          … 中身を見るだけ
  python scripts/gen_kokugo_kaisetsu.py --write  … data/hama_kaisetsu.json に書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KAISETSU = os.path.join(ROOT, "data", "hama_kaisetsu.json")
BUN = os.path.join(ROOT, "data", "kokugo_bun.json")

sys.path.insert(0, HERE)
import gen_kokugo_bun as bun  # bunzu() をそのまま再利用して見た目をそろえる


def ruidai_from(bun_data, ids):
    """kokugo_bun.json の id から、かんたん解説の類題を作る（答え・選択肢はそのまま流用）。"""
    by_id = {d["id"]: d for d in bun_data}
    out = []
    for i in ids:
        d = by_id[i]
        out.append({
            "question": d["question"],
            "answer": d["answer"],
            "choices": d["choices"],
            "meaning": d["meaning"],
        })
    return out


# ── SVG（例題の図。既存の算数の色づかいに合わせる：青#4f7cff・緑#28c88a・橙#ff9a44）──
SVG_KOSO = '''<svg viewBox="0 0 420 100" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">
<text x="210" y="34" font-size="15" text-anchor="middle" font-family="sans-serif" fill="#1a2340">駅前に新しい<tspan fill="#4f7cff" font-weight="bold">図書館</tspan>ができました。</text>
<text x="210" y="66" font-size="15" text-anchor="middle" font-family="sans-serif" fill="#1a2340"><tspan fill="#ff9a44" font-weight="bold">そこ</tspan>には絵本がたくさんあります。</text>
<path d="M225 72 Q 270 90 270 46" stroke="#9aa3c0" stroke-width="1.6" fill="none" marker-end="url(#a1)"/>
<text x="300" y="92" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">同じものを指す</text>
<defs><marker id="a1" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa3c0"/></marker></defs>
</svg>'''

SVG_SHUGO = '''<svg viewBox="0 0 420 100" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">
<text x="210" y="40" font-size="15" text-anchor="middle" font-family="sans-serif" fill="#1a2340">白い<tspan fill="#4f7cff" font-weight="bold">ねこが</tspan>、えんがわでしずかに<tspan fill="#28c88a" font-weight="bold">ねむっている</tspan>。</text>
<path d="M120 50 L120 74" stroke="#4f7cff" stroke-width="1.6" fill="none" marker-end="url(#a2)"/>
<text x="120" y="90" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#4f7cff" font-weight="bold">主語</text>
<path d="M330 50 L330 74" stroke="#28c88a" stroke-width="1.6" fill="none" marker-end="url(#a3)"/>
<text x="330" y="90" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#28c88a" font-weight="bold">じゅつ語</text>
<defs>
<marker id="a2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#4f7cff"/></marker>
<marker id="a3" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#28c88a"/></marker>
</defs>
</svg>'''

SVG_SHUSHOKU = '''<svg viewBox="0 0 420 110" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%">
<text x="210" y="34" font-size="15" text-anchor="middle" font-family="sans-serif" fill="#1a2340"><tspan fill="#ff9a44" font-weight="bold">赤い</tspan>風船が、<tspan fill="#ff9a44" font-weight="bold">空高く</tspan>とんでいく。</text>
<path d="M78 42 Q 78 62 130 62" stroke="#ff9a44" stroke-width="1.6" fill="none" marker-end="url(#a4)"/>
<text x="130" y="80" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">どんな</text>
<path d="M260 42 Q 300 62 340 42" stroke="#ff9a44" stroke-width="1.6" fill="none" marker-end="url(#a5)"/>
<text x="300" y="80" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">どのように</text>
<defs>
<marker id="a4" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ff9a44"/></marker>
<marker id="a5" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ff9a44"/></marker>
</defs>
</svg>'''

# 文図だけは、練習問題(kb051〜053)と同じ bunzu() の見た目を流用する
_b = lambda w, blank: '①' if w == blank else w
def svg_bunzu_rei(blank):
    return bun.bunzu([
        (1, [_b('太郎くんが', blank), '→', _b('わすれていました', blank)]),
        (2, [_b('やるのを', blank)]),
        (3, [_b('宿題を', blank)]),
    ])


LESSONS = {
    "14": {
        "title": "こそあどことば",
        "items": [{
            "bone": "近い／遠い／わからない で使い分ける",
            "rei": {
                "question": "「駅前に新しい図書館ができました。そこには絵本がたくさんあります。」"
                            "の「そこ」が指していることばは、何ですか。",
                "svg": SVG_KOSO,
                "kaisetsu": [
                    "こそあどことばは「これ・それ・あれ・どれ」「ここ・そこ・あそこ・どこ」のように、"
                    "前に出てきたものを指でさす代わりに使うことばです。",
                    "「ここ・これ」は自分に近いもの、「そこ・それ」は相手や少しはなれたもの、"
                    "「あそこ・あれ」は両方から遠いもの、「どこ・どれ」ははっきり決まっていないものを指します。",
                    "「そこ」は場所を指すことばです。前の文を見ると、新しくできたのは「図書館」です。",
                    "こそあどことばが指す内ようは、たいてい前の文の中にあります。よって、答えは図書館です。",
                ],
                "answer": "図書館",
            },
            "ruidai": [],  # main()で差し替え
        }],
    },
    "20": {
        "title": "主語・じゅつ語",
        "items": [{
            "bone": "「何が(は)」＋「どうする・どんなだ・何だ」の2つをさがす",
            "rei": {
                "question": "「白いねこが、えんがわでしずかにねむっている。」の主語とじゅつ語は、それぞれ何ですか。",
                "svg": SVG_SHUGO,
                "kaisetsu": [
                    "主語は「何が（は）」にあたることば、じゅつ語は「どうする・どんなだ・何だ」にあたることばです。",
                    "まずじゅつ語（文の最後にあることが多い）を先にさがします。"
                    "「ねむっている」が「どうする」にあたるので、これがじゅつ語です。",
                    "つぎに「何が」ねむっているのかをさがします。「白いねこが」の中では「ねこが」がそれにあたります。"
                    "「白い」はねこをくわしくすることば（しゅうしょく語）で、主語そのものではありません。",
                    "よって、主語は「ねこが」、じゅつ語は「ねむっている」です。",
                ],
                "answer": "主語：ねこが／じゅつ語：ねむっている",
            },
            "ruidai": [],
        }],
    },
    "22": {
        "title": "しゅうしょく語",
        "items": [{
            "bone": "「いつ・どこで・だれと・何を・どんな・どのように」の6つで見分ける",
            "rei": {
                "question": "「赤い風船が、空高くとんでいく。」──「赤い」と「空高く」は、それぞれどのことばをくわしくしていますか。",
                "svg": SVG_SHUSHOKU,
                "kaisetsu": [
                    "しゅうしょく語は、ほかのことばをくわしくする役目のことばです。"
                    "「いつ・どこで・だれと・何を・どんな・どのように」の6つのはたらきがあります。",
                    "「赤い」はどんな風船かをくわしくしているので「どんな」にあたり、すぐ下の「風船が」にかかります。",
                    "「空高く」はどのようにとんでいくかをくわしくしているので「どのように」にあたり、"
                    "「とんでいく」にかかります。",
                    "しゅうしょく語は、たいてい下（後ろ）にあることばをくわしくします。"
                    "よって、赤い→風船が、空高く→とんでいく、です。",
                ],
                "answer": "赤い→風船が／空高く→とんでいく",
            },
            "ruidai": [],
        }],
    },
    "24": {
        "title": "文図",
        "items": [{
            "bone": "1行目に「主語→じゅつ語」、下の段に くわしくすることば",
            "rei": {
                "question": "「太郎くんが、宿題をやるのをわすれていました。」の文図を作ります。"
                            "①（主語とじゅつ語）②③（くわしくする段）には、それぞれ何が入りますか。",
                "svg": svg_bunzu_rei(None),
                "kaisetsu": [
                    "文図は、まず1行目に「主語→じゅつ語」を置きます。"
                    "「太郎くんが」が主語、「わすれていました」がじゅつ語です。",
                    "じゅつ語「わすれていました」について「何を」わすれていたのかをくわしくすることばが、"
                    "その下の段に入ります。それが「やるのを」です。",
                    "「やるのを」も、さらに「何を」やるのかをくわしくすることばが必要です。"
                    "それが「宿題を」で、いちばん下の段に入ります。",
                    "このように、くわしくする・されるの関係を上から下へつないでいくのが文図です。",
                ],
                "answer": "①太郎くんが・わすれていました　②やるのを　③宿題を",
            },
            "ruidai": [],
        }],
    },
}

RUIDAI_IDS = {
    "14": ["kb001", "kb005", "kb007", "kb010"],
    "20": ["kb016", "kb020", "kb025", "kb027"],
    "22": ["kb034", "kb037", "kb040", "kb042"],
    "24": ["kb051", "kb052", "kb053"],
}


def main():
    bun_data = json.load(io.open(BUN, encoding="utf-8"))
    for no, ids in RUIDAI_IDS.items():
        LESSONS[no]["items"][0]["ruidai"] = ruidai_from(bun_data, ids)

    d = json.load(io.open(KAISETSU, encoding="utf-8"))
    d["grades"].setdefault("3", {})
    d["grades"]["3"]["kokugo"] = {"lessons": LESSONS}

    n_items = sum(len(v["items"]) for v in LESSONS.values())
    n_ruidai = sum(len(it["ruidai"]) for v in LESSONS.values() for it in v["items"])
    print("国語のかんたん解説：%d回ぶん／%d本（れい%d＋るいだい%d）"
          % (len(LESSONS), n_items, n_items, n_ruidai))
    for no, v in LESSONS.items():
        print("  No.%s %s：れい1＋るいだい%d問" % (no, v["title"], len(v["items"][0]["ruidai"])))

    if "--write" in sys.argv:
        with io.open(KAISETSU, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        print("\n✓ 書きこんだ → %s" % KAISETSU)
    else:
        print("\n（--write で data/hama_kaisetsu.json に書きこむ）")


if __name__ == "__main__":
    main()
