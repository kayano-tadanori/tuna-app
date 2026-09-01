# -*- coding: utf-8 -*-
"""小5最レ 第1・2分冊（HG-6563〜7182）の原簿レコードを、
   hama_daimon.json の grades.5.sairei.kouza1["1"〜"20"] / kouza2["1"〜"20"] に入れる。

★設問・答えは原簿のまま（feedback_genbo_dori）。変えるのは答え方の様式だけ。
★図SVGが無い「図: あり」のレコードは入れない（図の根拠はPDFだけ・feedback_zu_wa_genbo_ni_nai）。
使い方: python scripts/s5s12_add.py            … 何が入るかを見るだけ
        python scripts/s5s12_add.py --write    … 実際に書きこむ
"""
import argparse
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import s5s12_parse as P      # noqa: E402
import s5s12_build as S      # noqa: E402
import s5s12_kaisetsu as K   # noqa: E402
from s5s12_manual import MANUAL, INTRO, MEANING, QFIX    # noqa: E402
from s5s12_skip import SKIP, SKIP_PART, SKIP_STEP    # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

# 単元名は原簿の見出しそのまま（最レは回番号でなく単元名でひもづける）
UNIT = {
    (1, 1): "整数の計算", (1, 2): "小数・分数の計算", (1, 3): "演算記号", (1, 4): "概数",
    (1, 5): "比(1)", (1, 6): "比(2)", (1, 7): "直線図形の求積", (1, 8): "相似(1)",
    (1, 9): "相似(2)", (1, 10): "相似(3)", (1, 11): "十進法(1)", (1, 12): "十進法(2)",
    (1, 13): "N進法(1)", (1, 14): "N進法(2)", (1, 15): "折ったり重ねたり",
    (1, 16): "辺比と面積比⑴", (1, 17): "辺比と面積比⑵", (1, 18): "面積比の複合",
    (1, 19): "数の性質(1)", (1, 20): "数の性質(2)",
    (2, 1): "和差算", (2, 2): "平均算", (2, 3): "差分算", (2, 4): "植木算",
    (2, 5): "方陣算", (2, 6): "差集算", (2, 7): "過不足算", (2, 8): "つるかめ算",
    (2, 9): "旅人算", (2, 10): "通過算", (2, 11): "流水算", (2, 12): "時計算",
    (2, 13): "消去算", (2, 14): "相当算", (2, 15): "分配算", (2, 16): "倍数算",
    (2, 17): "年令算", (2, 18): "やりとり算", (2, 19): "速さ(1)", (2, 20): "速さ(2)",
}
CAT = {
    (1, 1): "keisan", (1, 2): "keisan", (1, 3): "kisoku", (1, 4): "kazu",
    (1, 5): "wariai", (1, 6): "wariai", (1, 7): "zu", (1, 8): "zu",
    (1, 9): "zu", (1, 10): "zu", (1, 11): "kazu", (1, 12): "kazu",
    (1, 13): "kazu", (1, 14): "kazu", (1, 15): "zu", (1, 16): "zu",
    (1, 17): "zu", (1, 18): "zu", (1, 19): "kazu", (1, 20): "kazu",
    (2, 1): "tokusan", (2, 2): "tokusan", (2, 3): "tokusan", (2, 4): "tokusan",
    (2, 5): "tokusan", (2, 6): "tokusan", (2, 7): "tokusan", (2, 8): "tokusan",
    (2, 9): "hayasa", (2, 10): "hayasa", (2, 11): "hayasa", (2, 12): "hayasa",
    (2, 13): "tokusan", (2, 14): "wariai", (2, 15): "tokusan", (2, 16): "wariai",
    (2, 17): "tokusan", (2, 18): "tokusan", (2, 19): "hayasa", (2, 20): "hayasa",
}


def star_of(dai):
    """浜のテキストは大問1→16で難しくなる（C→C→B→B→A→Aの勾配）。その順をそのまま星にする。"""
    return 1 if dai <= 4 else (2 if dai <= 10 else 3)


SUP = {"²": 2, "³": 3, "⁴": 4, "⁵": 5,
       "⁶": 6, "⁷": 7, "⁸": 8, "⁹": 9}

# 制作側の言葉づかい（子どもに見せない）。塾講師監査 2026-09-02 の指摘。
INSIDE = [
    # 「HG-6847と同じ骨（…）。」のような書き出しを丸ごと落とす
    # ⚠ 「。」で終わる導入句だけを落とす。「。」を求めないと、
    #    「HG-6764と同じ4進法の位取りで…」のような文を丸ごと消してしまう（2026-09-02）
    (re.compile(r"^HG-[0-9]+(?:[・,、] ?HG-[0-9]+)*(?:と同じ骨|と対の問題|の発展|の逆算)[^。]*。"), ""),
    (re.compile(r"HG-[0-9]+(?:[・,、] ?HG-[0-9]+)*(?=と同じ|の発展|の逆算)"), "前の問題"),
    (re.compile(r"HG-[0-9]+"), "前の問題"),
    (re.compile(r"担当エージェント[^。]*?によると[、,]?"), ""),
    (re.compile(r"サブエージェント[^。]*?(?:による|作成)[^。]*。"), ""),
    # ★（独立検算…）の中に別のかっこが入っていると途中で切れて文が壊れる。文の終わりまで落とす
    (re.compile(r"[（(](?:独立検算|要現物照合|印刷解答|原簿)[^。]*"), ""),
    (re.compile(r"印刷解説[^。]*"), ""),
    (re.compile(r"実際は解答通り"), ""),
    (re.compile(r"を求める計算ドリル"), "を求める練習"),
    (re.compile(r"の計算ドリル"), "の練習"),
    (re.compile(r"を求める型"), "を求める問題"),
    (re.compile(r"[。、]?\s*衣装[^。]*"), ""),
]

# 小5が習っていない書き方の言いかえ（機械でできるぶんだけ）
NOTATION = [
    # ⌊100/6⌋ → 100÷6の商
    (re.compile(r"[⌊\[]\s*([0-9]+)\s*/\s*([0-9]+)\s*[⌋\]]"), r"÷の商"),
    # |24－15| → 24と15の差
    (re.compile(r"\|\s*([0-9]+)\s*[-−－]\s*([0-9]+)\s*\|"), r"との差"),
]


SUPCH = "".join(SUP)


def _expand_num_sup(m):
    """2の3乗のような書き方を 2×2×2 にひらく。
       ★cm²・m²・km² は単位なので、ここではひらかない（25cm×m になってしまう）。"""
    return "×".join([m.group(1)] * SUP[m.group(2)])


def _expand_var_sup(m):
    return "×".join([m.group(1)] * SUP[m.group(2)])


def clean_meaning(s):
    """解法を子ども向けの言い方にそろえる。★中身（数値・筋道）は変えない。
       落とすのは制作側の言葉と、小5が習っていない記号の書き方だけ。"""
    s = (s or "").replace("**", "").strip()
    s = re.sub(r"^(骨|コア発見)[:：]\s*", "", s)
    s = re.sub(r"^[^／。\s]{2,14}／", "", s)      # 「単元名／…」の頭を落とす
    for rx, rep in INSIDE:
        s = rx.sub(rep, s)
    for rx, rep in NOTATION:
        s = rx.sub(rep, s)
    # 2の3乗のような書き方を 2×2×2 にひらく（累乗の書き方は小5では習わない）
    # ★ cm²・m²・km² は単位。ひらくと「25cm×m」になる（2026-09-02）
    s = re.sub("(?<![A-Za-z])([0-9]+)([" + SUPCH + "])", _expand_num_sup, s)
    s = re.sub("(?<![A-Za-z0-9])([A-LN-Zb-ln-z])([" + SUPCH + "])", _expand_var_sup, s)
    s = re.sub(r"[ 　]{2,}", " ", s)
    return s.strip(" 　、。")


def split_kaihou_by_answers(kaihou, answers):
    """解法が (1)(2) に割れていないとき、答えの数値が出てくる位置で切って小問ごとに分ける。
       ★これをしないと、小問1の解説が小問2の答えを先に見せてしまう
         （2026-09-02・塾講師監査でHG-7015/7034ほかが指摘された）。
       うまく切れなければ None。"""
    if not kaihou or len(answers) < 2:
        return None
    pos, start = [], 0
    for a in answers:
        core = re.sub(r"[^0-9./]", "", a.split("、")[0])[:12]
        if not core:
            return None
        i = kaihou.find(core, start)
        if i < 0:
            return None
        # その答えを含む文の切れ目（。）まで
        j = kaihou.find("。", i + len(core))
        j = len(kaihou) if j < 0 else j + 1
        pos.append((start, j))
        start = j
    if pos[-1][1] < len(kaihou):
        pos[-1] = (pos[-1][0], len(kaihou))
    out = [kaihou[a:b].strip() for a, b in pos]
    return out if all(out) else None


def meaning_for(r, key):
    """★手で書き直した解説があればそれを使う（塾講師監査 2026-09-02）。"""
    fixed = MEANING.get((r["hg"], key)) or MEANING.get((r["hg"], "*"))
    if fixed:
        return fixed
    return _meaning_from_genbo(r, key)


def _meaning_from_genbo(r, key):
    """その小問の解説。解法の同じ番号 → 解法ぜんぶ → コア発見 → 骨、の順にさがす。"""
    kp = {k: v for k, v in r["kparts"].items() if k != "_head"}
    # ★解法が (5)(6) のように「一部の小問のことしか書いていない」とき、
    #   その小問のことが書かれていなければ、解法の全文はのせない（ほかの答えを配るから）
    kp_any = {k: v for k, v in r["kparts_any"].items() if k != "_head"}
    if key and set(kp_any) != {0} and key not in kp_any and key not in kp:
        for cand in (r["core"], r["hone"]):
            m = clean_meaning(cand)
            if m:
                return m
    if key and key not in kp:
        # 解法が小問に割れていないとき、答えの位置で切ってみる
        aps = {k: v for k, v in r["aparts"].items() if k != "_head"}
        if len(aps) >= 2 and set(aps) != {0}:
            got = split_kaihou_by_answers(r["kaihou"], [aps[k] for k in sorted(aps)])
            if got:
                kp = {k: got[i] for i, k in enumerate(sorted(aps))}
    for cand in (kp.get(key), kp_any.get(key), r["kaihou"], r["core"], r["hone"]):
        m = clean_meaning(cand)
        if m:
            return m
    return ""


ENDS = re.compile("(ますか|ですか|でしょう|なさい|求めよ|答えよ|" + chr(0xFF1F) + ")")


def expand_elliptic(q1, qk):
    """「(2) 7時と8時の間」のような言いさしの小問を、(1)の文の数字を入れかえて組み直す。
       (1)の頭が qk と『数字ちがいで同じ形』のときだけ。当てはまらなければ None。"""
    if not qk or ENDS.search(qk):
        return None
    pat = ""
    for part in re.split("(" + chr(92) + "d+)", qk):
        pat += chr(92) + "d+" if part.isdigit() else re.escape(part)
    m = re.match(pat, q1)
    if not m or m.end() >= len(q1):
        return None
    return qk + q1[m.end():]


def tidy_question(q):
    """作った設問の言い回しをそうじする（中身は変えない）。
       「BC=は何cmですか」のように、ラベルのおしりの＝が残ってしまうことがある。"""
    q = re.sub(r"[＝=]\s*(は|に|が)", lambda m: m.group(1), q)
    q = re.sub(r"[ 　]{2,}", "　", q)
    q = re.sub(r"。\s*。", "。", q)
    return q.strip()


def build_one(r):
    """1レコード → 大問1つ。作れなければ (None, 理由)。"""
    qs = {k: v for k, v in r["qparts"].items() if k != "_head"}
    as_ = {k: v for k, v in r["aparts"].items() if k != "_head"}
    head = r["qparts"].get("_head", "")
    intro = (INTRO.get(r["hg"]) or r["intro"] or head or "").strip()
    stem = (r["intro"] + " " + head).strip()

    # ★【図: …】のような図の説明が小問の文に混ざっていると読みにくい（塾講師監査2026-09-02）。
    #   小問から外して、画面の上に出る intro に1回だけ置く。
    zu_notes = []
    for k in list(qs):
        found = re.findall(r"【[^】]*】", qs[k])
        if found:
            zu_notes.extend(found)
            qs[k] = re.sub(r"【[^】]*】", "", qs[k]).strip(" 　")
    if zu_notes:
        intro = (intro + " " + " ".join(dict.fromkeys(zu_notes))).strip()

    # ★導入文にすでに書いてあることが、小問のかっこ書きでくり返されていたら落とす
    def _dedup(t):
        def rep(m):
            inner = re.sub(r"[\s　，,、。．・]", "", m.group(1))
            base = re.sub(r"[\s　，,、。．・]", "", intro)
            return "" if inner and inner in base else m.group(0)
        return re.sub(r"[（(]([^）)]{4,})[）)]", rep, t).strip()
    for k in list(qs):
        qs[k] = _dedup(qs[k])

    # 言いさしの小問を (1) の文から組み直す（省かれた語をもどすだけ。中身は変えない）
    if len(qs) >= 2:
        _ks = sorted(qs)
        for _k in _ks[1:]:
            _fixed = expand_elliptic(qs[_ks[0]], qs[_k])
            if _fixed:
                qs[_k] = _fixed

    if qs and all((r["hg"], k) in MANUAL for k in qs):
        # 手作業ぶんが小問ぜんぶをまかなっているなら、答え側の割れ方は見なくてよい
        pairs = [(k, qs[k], "") for k in sorted(qs)]
    elif set(qs) == set(as_):
        pairs = [(k, qs[k], as_[k]) for k in sorted(qs)]
    elif set(as_) == {0}:
        # 答えが小問に割れていない（ア5 イ1… のように記号でまとまっている）＝1本として通す
        pairs = [(0, r["mon"], as_[0])]
    else:
        return None, "設問と答えの小問の数が合わない"

    if r["hg"] in SKIP:
        return None, "監査で出さないと決めた（%s）" % SKIP[r["hg"]][:40]
    pairs = [x for x in pairs if (r["hg"], x[0]) not in SKIP_PART]
    if not pairs:
        return None, "監査で小問がぜんぶ外れた"

    steps = []
    for key, q, a in pairs:
        man = MANUAL.get((r["hg"], key))
        if man:
            for m in man:
                base = "" if m.get("only_tail") else q
                st = dict(question=(base + m.get("tail", "")).strip(),
                          answer=m["answer"], meaning=meaning_for(r, key))
                if m.get("choices"):
                    st["choices"] = m["choices"]
                steps.append(st)
            continue
        mn = meaning_for(r, key)
        # ★解法が小問ごとに割れていない計算ドリル型は、その小問の数値から解説を組み立てる
        #   （「比a：bの比の値を求める計算ドリル」では説明にならない・塾講師監査2026-09-02）
        if (r["hg"], key) not in MEANING and (r["hg"], "*") not in MEANING:
            auto = K.auto(q, a, stem)
            if auto:
                mn = auto
        got = S.steps_for(q, a, mn, stem)
        if not got:
            return None, "答え方を作れない（%s）" % a[:40]
        steps.extend(got)

    for st in steps:
        st["question"] = tidy_question(st["question"])
        for a_, b_ in QFIX.get(r["hg"], []):
            st["question"] = st["question"].replace(a_, b_)
    # 監査で「この小問だけ出さない」と決めたものを落とす
    drop = [k for (hg, k) in SKIP_STEP if hg == r["hg"]]
    if drop:
        steps = [st for st in steps if not any(k in st["question"] for k in drop)]

    if not steps:
        return None, "小問が0"
    for st in steps:
        if not st.get("meaning"):
            return None, "解説が空"
        if not st.get("question"):
            return None, "設問が空"

    kou, no, dai = r["kouza"], r["no"], r["dai"]
    out = {
        "id": "hd5s_%dk%d_%d" % (no, kou, dai),
        "category": CAT[(kou, no)],
        "unit": UNIT[(kou, no)],
        "title": r["name"],
        "intro": intro,
        "star": star_of(dai),
        "hg": r["hg"],
        "steps": steps,
        "grade": 5,
        "src": "%s 小5最レ 第%s分冊 第%d講座 No.%d %s" % (r["hg"], r["bunsatsu"], kou, no, r["name"]),
    }
    if r["svg"]:
        out["svg"] = r["svg"]
    return out, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    recs = P.all_parsed()
    made, skipped = {}, []
    for r in sorted(recs, key=lambda x: (x["kouza"], x["no"], x["dai"])):
        if "⚠" in r["tail"]:
            skipped.append((r["hg"], "題名に⚠（答えが未確定）"))
            continue
        if not P.ready(r):
            skipped.append((r["hg"], "図SVGが無い（図: %s）" % r["zu"][:20]))
            continue
        q, why = build_one(r)
        if q is None:
            skipped.append((r["hg"], why))
            continue
        made.setdefault((r["kouza"], r["no"]), []).append(q)

    n_q = sum(len(v) for v in made.values())
    n_s = sum(len(x["steps"]) for v in made.values() for x in v)
    print("作れた大問: %d本 / %d問" % (n_q, n_s))
    print("入れなかった: %d本" % len(skipped))
    why = {}
    for hg, w in skipped:
        key = w.split("（")[0]
        why.setdefault(key, []).append(hg)
    for k, v in sorted(why.items(), key=lambda x: -len(x[1])):
        print("   %-28s %3d本  %s" % (k, len(v), " ".join(v[:8]) + (" …" if len(v) > 8 else "")))

    if not args.write:
        print("\n（--write を付けると書きこみます）")
        return

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["5"]["sairei"]
    for kou in (1, 2):
        bucket = node.setdefault("kouza%d" % kou, {})
        for no in range(1, 21):
            v = made.get((kou, no))
            if v:
                bucket[str(no)] = v
    io.open(DAIMON, "w", encoding="utf-8").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("\n書きこみました: %s" % DAIMON)


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
