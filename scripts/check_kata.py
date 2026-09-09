# -*- coding: utf-8 -*-
"""塾講師監査で実際に出た「欠陥の型」を機械で捕まえる。

  ★この検査が見るのは **内部の矛盾と解説の薄さだけ**。原本との一致は見ていない。
    原本に忠実かどうかを決めるのは G1（原本を開いている抽出）の検算であって、ここではない。
    **「check_kata が通った＝原本どおり」とは絶対に言わない。**

  使い方:
    python scripts/check_kata.py            # 全部
    python scripts/check_kata.py K1 K6      # 型を選ぶ
    python scripts/check_kata.py --selftest # わざと壊して鳴るか確かめる

  型（すべて過去の監査で実際に出たもの／出典は method_kansa_pipeline）:
    K1 図が答えをそのまま見せている        （第1波12本）
    K2 答え先出し（前の小問に後ろの答え）  （第1波・小3わり算の商/あまり）
    K3 内輪語・制作メモの漏れ              （第1波12本・「灘度」「衣装」「収録した」）
    K4 本文に無い引用                      （小5国語 hd_5k_k06_603_4）
    K5 原簿と小問数・選択肢数が食いちがう  （小3国語 HG-2946＝選択肢1つ落ち）
    K6 解説が無い・薄い・式だけ（大問）    （★真の目的＝わかりやすいか。解説を読むのは子ども本人）
    K7 同じことを通常問題（一問一答）で   （通常問題＝浜の骨に別の衣装。数は大問の6倍）

  ★判定ロジックはここにしか書かない。2本目にコピーしない（→feedback_kansa_script_copy）。
  ★すでに他が見ているものは書かない：
      空欄・選択肢の重複・解説の結びと答えのズレ … node scripts/audit_questions.js
      テンキー／選択肢の整合・C0制御文字        … python scripts/check_answerable.py
      未習漢字                                  … python scripts/verify_low_grade_kanji.py
"""
import io, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G

# ★stdoutを io.TextIOWrapper で包み直すと、2つ包んだとき下の層が閉じられて
#   「I/O operation on closed file」になる（hama.py が check_kata を import
#   したときに実際に踏んだ／2026-09-09）。reconfigure なら二重でも安全。
sys.stdout.reconfigure(encoding="utf-8")

# ── K3 の語彙。**内輪の言葉と制作メモだけ**を列挙する。
#    ふつうの日本語（「骨」「実際」など）は入れない＝誤検出で狼少年になるため。
NAIWA = [
    "灘度", "衣装", "味つけ", "を収録した", "収録しました",
    "原簿", "HG-", "作問メモ", "コア発見", "本稿", "※作問", "クローン",
]

NUM = re.compile(r"\d+(?:\.\d+)?")
KANA = re.compile(r"[ぁ-んァ-ヴ]")
TAG = re.compile(r"<[^>]+>")


def texts_of_svg(svg):
    """SVGの<text>の中身だけを返す（図に印字されている文字＝子どもに見えるもの）。"""
    return " ".join(re.findall(r"<text[^>]*>(.*?)</text>", svg or "", re.S))


def given(x):
    """その大問で「はじめから与えられている文字列」＝intro＋全設問文。
    ここに出てくる数値は答えの漏れではない（条件として書いてあるだけ）。"""
    return (x.get("intro") or "") + " " + " ".join(
        (s.get("question") or "") for s in x.get("steps") or [])


def leaks(needle, hay, given_txt):
    """needle（答え）が hay に出ていて、かつ与件ではない → 漏れ。"""
    if not needle or not hay:
        return False
    needle = needle.strip()
    if len(needle) < 2:            # 1文字の答えは偶然の一致だらけになる
        return False
    if NUM.fullmatch(needle):
        # 数値は「独立した数」として出たときだけ（1234 の中の 23 を拾わない）
        pat = r"(?<![\d.])" + re.escape(needle) + r"(?![\d.])"
        if not re.search(pat, hay):
            return False
        return not re.search(pat, given_txt)
    # ★数字ではじまる／終わる答えは、前後が数字でないことを確かめる。
    #   確かめないと「11と2/5」の中の「1と2/5」を拾う（2026-09-09に実際に踏んだ）。
    pat = re.escape(needle)
    if needle[0].isdigit():
        pat = r"(?<![\d.])" + pat
    if needle[-1].isdigit():
        pat = pat + r"(?![\d.])"
    if not re.search(pat, hay):
        return False
    return not re.search(pat, given_txt)


def k1(rs):
    """図が答えをそのまま見せている。

    ★重と中の分け方は、2026-09-09に22件の「重」を1本ずつ原本の設問と突き合わせて決めた。
      **8大問のうち5本が本物・3本が誤検出**で、誤検出はどれも同じ形だった：
      **表の項目名**（人名の一覧・四角形の名前の見出し・成長段階の行見出し）。
      表に名前が並ぶのは当たり前で、答えは計算・推理しないと出ない。

    重＝答えが「その文字だけの札」ではない形で図に出ている
        ・設問の番号とくっついている（「①正三角形」「C（ゆうかい）」）＝札が答えを名ざししている
        ・長いキャプションの中で言ってしまっている（「とつレンズを通った日光が…」）
    中＝図に**答えと同じ文字だけの札**がある（＝表の項目名かもしれない）／答えが数値
        （数値は、図にしか書かれていない寸法とたまたま一致することがある）
    """
    out = []
    for r in rs:
        x = r["x"]
        gv = given(x)
        svgs = [x.get("svg") or ""] + [(s.get("svg") or "") for s in x.get("steps") or []]
        cells = re.findall(r"<text[^>]*>(.*?)</text>", " ".join(svgs), re.S)
        if not cells:
            continue
        joined = " ".join(cells)
        for i, s in enumerate(x.get("steps") or []):
            a = str(s.get("answer") or "").strip()
            if not leaks(a, joined, gv):
                continue
            lv = "中"
            if not NUM.fullmatch(a):
                for c in cells:
                    c = c.strip()
                    if a in c and (len(c) >= 20 or c != a):
                        lv = "重"
                        break
            out.append((r, lv, "小問%d の答え「%s」が図の文字に出ている" % (i + 1, a)))
    return out


def k2(rs):
    """前の小問の解説に、後ろの小問の答えが出ている。

    🚨**浜学園の「答えを一部先渡し」は手法であって不具合ではない**（本人指摘 2026-09-09／
      スキル hama-set 原則4「答えを一部先渡しして捨て問を作らない」。**外すと捨て問になる**）。
      だから**設問文・intro に置いてある先渡しは絶対に消さない。**移植するときは先渡しごと移す。
    ★見るのは**解説だけ**。設問文は足場と条件を置く場所で、そこに出る数は意図して見せている。
      （2026-09-09に無作為6件を見て、設問側は6件とも誤検出だった）
    ★与件＝intro＋**全設問文**。どこかに書いてあれば漏れに数えない＝浜式の先渡しはここで除外される。

    ⚠**紙とアプリで解説の届き方が違う。**浜の紙の教材は解説が別冊なので、解説に次の値が
      書いてあっても子どもは先に読まない。**アプリは `sq-feedback-ans` で、その小問に答えた
      直後にその解説を出す**（js/sansu.js）ので、**次の小問を考える前に読んでしまう**。
      紙で正しい書き方が、アプリでは先出しになる——ここだけが直す対象。
    重＝「＝」の直後に出る（計算結果としてはっきり出してしまっている）
    中＝それ以外の言い回しで出ている
    """
    out = []
    for r in rs:
        x = r["x"]
        steps = x.get("steps") or []
        gv = given(x)
        for i, s in enumerate(steps):
            mm = s.get("meaning") or ""
            own = str(s.get("answer") or "").strip()
            for j in range(i + 1, len(steps)):
                a = str(steps[j].get("answer") or "")
                # ★後ろの小問の答えが「その小問自身の答え」と同じ値のときは漏れではない
                #   （自分の答えを書いているだけ）。2026-09-09、自分で書いた解説が
                #   これに引っかかって気づいた＝実際に踏んだ誤検出。
                if a.strip() == own:
                    continue
                if not leaks(a, mm, gv):
                    continue
                lv = "重" if re.search(r"[=＝]\s*" + re.escape(a) + r"(?![\d.])", mm) else "中"
                out.append((r, lv, "小問%d の解説に 小問%d の答え「%s」が出ている" % (i + 1, j + 1, a)))
    return out


def k3(rs):
    """内輪語・制作メモが子どもに見える欄に残っている。"""
    out = []
    for r in rs:
        x = r["x"]
        for fld in ("intro", "title"):
            for w in NAIWA:
                if w in (x.get(fld) or ""):
                    out.append((r, "重", "%s に内輪語「%s」" % (fld, w)))
        for i, s in enumerate(x.get("steps") or []):
            for fld in ("question", "meaning"):
                for w in NAIWA:
                    if w in (s.get(fld) or ""):
                        out.append((r, "重", "小問%d の%s に内輪語「%s」" % (i + 1, fld, w)))
    return out


def k4(rs):
    """設問・解説が根拠に挙げる「引用」が、本文（intro）に無い。"""
    out = []
    for r in rs:
        x = r["x"]
        intro = x.get("intro") or ""
        if len(intro) < 80:        # 本文を持たない大問は対象外
            continue
        for i, s in enumerate(x.get("steps") or []):
            for q in re.findall(r"「([^」]{6,40})」",
                                (s.get("question") or "") + " " + (s.get("meaning") or "")):
                if q in intro:
                    continue
                # 本文の言いかえでなく、丸ごと引用の形をしたものだけ疑う
                if re.search(r"[。、]", q) or q.endswith(("た", "だ", "る", "い")):
                    out.append((r, "中", "小問%d の引用「%s」が本文に無い" % (i + 1, q)))
    return out


MARU = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫"
KIGO = "アイウエオカキクケコサシスセソ"


def _genbo_bodies():
    t = io.open(G.find_genbo(), encoding="utf-8").read()
    return {hg: t[s:e] for hg, s, e in G.split_records(t)}


def k5(rs):
    """原簿の小問数・選択肢数と、作った大問が食いちがう。

    ★原簿の欄は書き方が1つではない（→feedback_genbo_field_writings）ので、
      **数えられなかった本数を必ず出す**。黙って取りこぼさない。
    """
    bodies = _genbo_bodies()
    out, uncountable = [], 0
    for r in rs:
        x = r["x"]
        hgs = G.hgof(x)
        body = bodies.get(hgs[0]) if hgs else None
        # ★欄の書き方は1つではない（→feedback_genbo_field_writings）。
        #   2026-09-09に数えた：設定/設問 2058本／設問 1816本／設問文 63本。
        #   決め打ちにせず、数えてから並べた。増やしたときも必ず数え直す。
        m = re.search(r"^[-*]\s*\*{0,2}(?:設定/)?設問(?:文)?\*{0,2}\s*[:：](.*)$",
                      body, re.M) if body else None
        if not m:
            uncountable += 1
            continue
        line = m.group(1)
        marks = [c for c in MARU if c in line]
        if not marks:
            uncountable += 1
            continue
        n_genbo, n_app = len(marks), len(x.get("steps") or [])
        # 1本の原簿を複数の大問に割ったものは食いちがって当然なので、
        # 「アプリの方が少ない」ときだけ見る（＝設問の抜け）
        if n_app < n_genbo and len(hgs) == 1:
            out.append((r, "重", "原簿の設問は%d問だが大問は%d問（設問の抜け？）" % (n_genbo, n_app)))
        gk = [c for c in KIGO if ("%s " % c) in line or ("%s．" % c) in line or ("%s." % c) in line]
        for i, s in enumerate(x.get("steps") or []):
            ch = s.get("choices")
            if ch and gk and len(ch) != len(gk):
                out.append((r, "重", "小問%d の選択肢 %d個／原簿は%d個（記号ズレ？）"
                            % (i + 1, len(ch), len(gk))))
    return out, uncountable


def thin_reason(raw, question=""):
    """解説1本を見て、薄ければ理由を返す（よければ None）。

    ★K6（大問）とK7（通常問題）とapply_kaisetsuの検品が、**この1つを共有する**。
      写すと必ず片方が腐る（→feedback_kansa_script_copy）。
    """
    m = TAG.sub("", str(raw or "")).strip()
    if not m:
        return "重", "解説が無い"
    if len(m) < 12:
        return "中", "解説が%d字しかない「%s」" % (len(m), m)
    if len(KANA.findall(m)) < 4:
        return "中", "解説が式だけで言葉の説明が無い「%s」" % m[:40]
    q = TAG.sub("", str(question or "")).strip()
    if q and len(q) > 10 and m in q:
        return "中", "解説が設問文の写しになっている"
    return None


def k7(rs=None):
    """通常問題（一問一答）の解説が無い・薄い・式だけ。

    ★通常問題は**浜学園の骨に別の衣装を着せて作った問題**（本人 2026-09-09）。
      大問だけ品質を上げても、子どもが解く数は通常問題のほうが6倍多い。
      走査は genbo_common.iter_tsujo（唯一の走査口）。解説の欄名は meaning と kaisetsu の
      2つある（数えてから決めた。→genbo_common.MEANING_KEYS）。
    """
    out = []
    for r in G.iter_tsujo():
        q = r["q"]
        v = thin_reason(G.meaning_of(q), q.get("question"))
        if v:
            lv, msg = v
            out.append((r, lv, msg))
    return out


def k6(rs):
    """解説が無い・薄い・式だけ（大問）。

    ★本人の第一原則＝「解説の無い問題は出さない」「評価軸はわかりやすいか」。
      しかも**解説を読むのは子ども本人**で、まちがいを間で止められる人がいない
      （→feedback_kaisetsu_reader）。だから薄い解説は「未完成」ではなく「不具合」。
    """
    out = []
    for r in rs:
        x = r["x"]
        for i, s in enumerate(x.get("steps") or []):
            v = thin_reason(s.get("meaning"), s.get("question"))
            if v:
                lv, msg = v
                out.append((r, lv, "小問%d の%s" % (i + 1, msg)))
    return out


CHECKS = [("K1", "図が答えを見せている", k1),
          ("K2", "答え先出し", k2),
          ("K3", "内輪語・制作メモ", k3),
          ("K4", "本文に無い引用", k4),
          ("K6", "解説が無い・薄い・式だけ", k6)]



def heavy_keys(rs):
    """いまの「重」を、一本ずつ見分けのつく文字列にして返す。

    ★ベースライン（既知の宿題）と、いま増えたものを見分けるために使う。
      レガシーな山をゲートに載せると、ゲートは必ず切られる（狼少年と同じ）。
      **止めるのは「新しく増えた重」だけ**にして、山は宿題として別に数える。
    """
    keys = set()
    for key, _name, fn in CHECKS:
        for r, lv, msg in fn(rs):
            if lv == "重":
                keys.add("%s|%s|%s" % (key, r["x"]["id"], msg))
    hits, _unc = k5(rs)
    for r, lv, msg in hits:
        if lv == "重":
            keys.add("K5|%s|%s" % (r["x"]["id"], msg))
    for r, lv, msg in k7():
        if lv == "重":
            keys.add("K7|%s|%s" % (r["qid"], msg))
    return keys


def show(key, name, hits, want_all, extra=""):
    """重／中に分けて数え、既定では**重だけ**を並べる。
    ★中まで既定で出すと件数に埋もれて誰も見なくなる（狼少年をつくらない）。"""
    hi = [h for h in hits if h[1] == "重"]
    mid = [h for h in hits if h[1] != "重"]
    print("=== %s %s … 重%d件 ／ 中%d件%s" % (key, name, len(hi), len(mid), extra))
    for r, lv, msg in (hits if want_all else hi)[:40]:
        print("   [%s] %-22s %s学年 %-20s %s" % (lv, r["x"]["id"], r["grade"], r["app_course"], msg))
    n = len(hits if want_all else hi)
    if n > 40:
        print("   …ほか %d件" % (n - 40))
    return len(hi)


def run(rs, want, want_all=False):
    heavy = 0
    for key, name, fn in CHECKS:
        if want and key not in want:
            continue
        heavy += show(key, name, fn(rs), want_all)
    if not want or "K5" in want:
        hits, unc = k5(rs)
        heavy += show("K5", "原簿との小問数・選択肢数", hits, want_all,
                      "（数えられなかった大問 %d本）" % unc)
    if not want or "K7" in want:
        hits = k7()
        hi = [h for h in hits if h[1] == "重"]
        print("=== K7 通常問題の解説（薄い・式だけ）… 重%d件 ／ 中%d件"
              % (len(hi), len(hits) - len(hi)))
        for r, lv, msg in (hits if want_all else hi)[:40]:
            print("   [%s] %-26s %-14s %s" % (lv, r["file"], r["qid"].split("#")[-1], msg))
        n = len(hits if want_all else hi)
        if n > 40:
            print("   …ほか %d件" % (n - 40))
        heavy += len(hi)
    return heavy


def selftest():
    """わざと壊して、本当に鳴るかを確かめる（→tool_origami_kensa_kit と同じ作法）。"""
    # ★見本の作り方に注意：答えの語を intro に書くと「与件」扱いになって鳴らない。
    #   ここでわざと踏んだ（2026-09-09）ので、見本にも書き残しておく。
    bad = {"id": "SELFTEST", "src": "",
           "intro": "たてが12cm、よこが7cmの四角い紙があります。",
           "svg": '<svg><text fill="#fff">形の名前 長方形</text></svg>',
           "steps": [{"question": "この形の名前は何ですか。", "answer": "長方形",
                      "meaning": "向かい合う辺が等しく角が直角。灘度Aの衣装をひとつ着せた。"
                                 "ついでに面積は 12×7＝84 になる。"},
                     {"question": "面積は何cm2ですか。", "answer": "84",
                      "meaning": "たて×よこで もとめられるので かけ算をつかう。"},
                     {"question": "まわりの長さは何cmですか。", "answer": "38",
                      "meaning": "(12+7)*2=38"}]}
    rs = [{"grade": "3", "app_course": "selftest", "kind": "master", "no": "1", "idx": 0, "x": bad}]
    # 期待する件数と、そのうち「重」で鳴ってほしい最少件数。
    # ★重まで見るのは、commit を止めるのが「重」だけだから。中でしか鳴らない検査は
    #   ゲートを素通りする＝作った意味が半分になる（2026-09-09に足した）。
    exp = {"K1": (1, 1), "K2": (1, 1), "K3": (2, 2), "K4": (0, 0), "K6": (1, 0)}
    ok = True
    for key, name, fn in CHECKS:
        h = fn(rs)
        n, hi = len(h), len([x for x in h if x[1] == "重"])
        want, want_hi = exp[key]
        good = ((n >= want) if want else (n == 0)) and hi >= want_hi
        ok = ok and good
        print("  %s %s %s … %d件（うち重%d／期待%s・重%d以上）" %
              ("OK  " if good else "🚨鳴らない", key, name, n, hi,
               ("%d以上" % want) if want else "0", want_hi))
    print("selftest:", "OK" if ok else "🚨 失敗")
    return 0 if ok else 1


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--selftest" in args:
        sys.exit(selftest())
    d = G.load_daimon()
    rs = list(G.iter_daimon(d))
    if "--baseline-write" in args:
        import json
        keys = sorted(heavy_keys(rs))
        p = os.path.join(G.BASE, "docs", "kata_baseline.json")
        note = ("既知の「重」の山。ここに載っているものはゲートを止めない"
                "（宿題としては hama.py が数え続ける）。直したら --baseline-write で取り直す。")
        io.open(p, "w", encoding="utf-8", newline="\n").write(
            json.dumps({"_note": note, "keys": keys}, ensure_ascii=False, indent=1) + "\n")
        print("ベースラインに %d件を記録した → docs/kata_baseline.json" % len(keys))
        sys.exit(0)
    print("大問 %d本を検査（★内部矛盾と解説の薄さのみ。原本との一致は見ていない）\n" % len(rs))
    heavy = run(rs, [a for a in args if a.startswith("K")], "--all" in args)
    print("\n重 合計 %d件（中まで見るには --all）" % heavy)
    sys.exit(1 if heavy else 0)
