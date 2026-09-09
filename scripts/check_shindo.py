# -*- coding: utf-8 -*-
"""通常問題の学年タグを「浜学園の進度」と突き合わせる。

  使い方:
    python scripts/check_shindo.py            … ズレを数える（直さない）
    python scripts/check_shindo.py --show 30  … 中身を30件見る
    python scripts/check_shindo.py --write    … タグを引き上げる

★何を基準にするか
  **`data/hama_map.json` の本科（master）の回タイトルが唯一の基準。**学校の指導要領ではない。
  浜は小3で九九・わり算・分数・小数まで一気にやる（→memory:feedback_hamagakuen_curriculum）。
  だから「体積は5年」のような学校基準の直感で判断してはいけない。回番号はここから読む。

★どう判定するか
  設問の文から「解くのに要る道具」を拾い、その道具が浜のはしごで最初に出てくる学年を取る。
  要る道具が複数なら**いちばん遅く出てくるもの**がその問題の学年。
  ⚠ タグのほうが遅いときは触らない（前の学年の復習として出るのは害が無い）。
    直すのは**タグが浜より早いとき＝まだ習っていない道具を使わせているとき**だけ。

★小2以下について
  浜は小3からしか無いので、はしごに無い＝小2以下の内容は学校基準で見る。
  1年＝20までのたし算ひき算／2年＝100までのたし算ひき算と九九。
  それを超える数が出てきたら学年を上げる（九九が1年に入っていたのはこれで拾う）。
"""
import io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ladder():
    """hama_map の本科から「回タイトル → (学年, 回)」を作る。最初に出てくる学年を採る。"""
    d = json.load(io.open(os.path.join(ROOT, "data", "hama_map.json"), encoding="utf-8"))
    out = {}
    for grade in sorted(d["grades"], key=int):
        cs = (d["grades"][grade].get("courses") or {}).get("master")
        for l in (cs or {}).get("lessons") or []:
            t = l.get("title")
            if t and t not in out:
                out[t] = (int(grade), l.get("no"))
    return out


L = ladder()


def rung(title):
    """はしごの段を引く。タイトルが消えたら黙って通さず落とす（表と道具がズレたら気づけない）。"""
    if title not in L:
        raise KeyError("hama_map の本科に「%s」が無い（回タイトルが変わった？）" % title)
    return L[title]


# 道具 → はしごの段。ここに書く名前は hama_map の回タイトルそのもの。
TOOLS = [
    ("かけ算",           "かけ算"),
    ("わり算",           "わり算"),
    ("あまりのあるわり算", "2けた・大きな数のわり算"),
    ("大きな数",         "大きな数"),
    ("小数",             "小数"),
    ("分数",             "分数"),
    ("約分・通分",       "分数（約分・通分）"),
    ("面積",             "面積①（長方形・正方形）"),
    ("体積",             "立体の体積・表面をぬった立方体"),
    ("平均",             "平均算"),
    ("割合",             "割合の基礎"),
    ("百分率・歩合",     "百分率・歩合"),
    ("比",               "比①（連比・逆比）"),
    ("食塩水",           "食塩水（濃度）"),
    ("売買損益",         "売買損益"),
    ("比例・反比例",     "比例と反比例"),
    ("倍数・約数",       "約数・公約数・最大公約数"),
    ("素因数分解",       "素数・素因数分解"),
]

PAT = {
    "かけ算":            re.compile(r"[×✕]|かけ算|かける|倍(?!数)|1こ(?:あたり|につき)|ずつ.*(?:こ|本|人|まい|箱|はこ)"),
    "わり算":            re.compile(r"[÷]|わり算|わって|わける|等分|1人分|何人に"),
    "あまりのあるわり算": re.compile(r"あま(?:り|ります)|余り"),
    "大きな数":          re.compile(r"[0-9０-９]{5,}|万|億|兆"),
    "小数":              re.compile(r"[0-9０-９]\.[0-9０-９]|小数"),
    "分数":              re.compile(r"[0-9０-９]/[0-9０-９]|分数|分の"),
    "約分・通分":        re.compile(r"約分|通分|既約"),
    "面積":              re.compile(r"面積|cm2|cm²|㎠|m2|m²|㎡|平方"),
    "体積":              re.compile(r"体積|cm3|cm³|㎤|m3|m³|容積|L\b|リットル|dL|mL"),
    "平均":              re.compile(r"平均"),
    "割合":              re.compile(r"割合|もとにする|何倍にあたる|の[0-9０-９]+割"),
    "百分率・歩合":      re.compile(r"[％%]|パーセント|歩合|分[0-9０-９]*厘|定価|原価|仕入れ"),
    "比":                re.compile(r"[0-9０-９]\s*[:：]\s*[0-9０-９]|比を|の比|連比|逆比"),
    "食塩水":            re.compile(r"食塩水|濃度|のうど"),
    "売買損益":          re.compile(r"利益|定価|売り値|仕入れ|損"),
    "比例・反比例":      re.compile(r"比例|反比例"),
    "倍数・約数":        re.compile(r"倍数|約数|公倍|公約"),
    "素因数分解":        re.compile(r"素因数|素数"),
}

# 小2以下は浜のはしごに無いので学校基準で見る（数の大きさだけ）
NUM = re.compile(r"[0-9０-９]+(?:\.[0-9０-９]+)?")


def school_floor(text):
    """小2以下の内容として成り立つか。出てくる数の大きさで見る。"""
    ns = [float(x.replace("．", ".")) for x in NUM.findall(text.translate(
        str.maketrans("０１２３４５６７８９", "0123456789")))] or [0]
    big = max(ns)
    # ⚠ 学校2年は「1000までの数」と九九をやる。ここを「100まで」にすると
    #   「1本70円を3本＝210円」まで小3に上げてしまい、67件が誤検出になった（2026-09-09）
    if big > 1000:
        return 3          # 1000より大きい数は小3（大きな数）
    if big > 20:
        return 2          # 20より大きい数は小2（1年は20までのたし算ひき算）
    return 1


def need_of(q):
    """その問題に要る学年（浜基準）。要る道具のうちいちばん遅い段を返す。"""
    # ⚠ unit は見ない。単元名「平面図形（面積）」の中の「面積」を道具と読みちがえて、
    #   「1辺3cmの正方形のまわりの長さ」まで面積の問題にされた（2026-09-09）
    text = " ".join(str(q.get(k) or "") for k in ("question", "answer"))
    grade, why = 0, None
    for name, title in TOOLS:
        if PAT[name].search(text):
            g, no = rung(title)
            if g > grade:
                grade, why = g, "%s（小%d 第%d回）" % (name, g, no)
    if grade:
        return grade, why
    g = school_floor(text)
    return g, "数の大きさが%s" % ("20まで" if g == 1 else "1000まで" if g == 2 else "1000より大きい")


def scan():
    out = []
    for r in G.iter_tsujo():
        if not os.path.basename(r["file"]).startswith("sansu_"):
            continue
        q = r["q"]
        tag = q.get("grade")
        if not isinstance(tag, int):
            continue
        need, why = need_of(q)
        # ★最レは1学年先を扱う（→memory:feedback_hamagakuen_curriculum）。
        #   浜のはしごに載っている道具は、タグが1学年早いだけなら「最レの子には妥当」なので触らない。
        #   小2以下（学校基準＝数の大きさ）にはこの逃げ道を与えない。1年生に100を超える数は出さない。
        slack = 1 if need >= 3 and "数の大きさ" not in why else 0
        if need - tag > slack:
            out.append((r, tag, need, why))
    return out


def main():
    args = sys.argv[1:]
    hits = scan()
    print("■ 通常問題（算数）の学年タグ vs 浜の進度")
    print("   タグが浜より早い（まだ習っていない道具を使わせている）… %d件" % len(hits))
    by = {}
    for r, tag, need, why in hits:
        by[(tag, need)] = by.get((tag, need), 0) + 1
    for (tag, need), n in sorted(by.items()):
        print("     小%d → 小%d  %4d件" % (tag, need, n))
    if "--show" in args:
        k = int(args[args.index("--show") + 1]) if len(args) > args.index("--show") + 1 else 20
        print()
        for r, tag, need, why in hits[:k]:
            print("  %-28s 小%d→小%d  %s" % (r["qid"], tag, need, why))
            print("      %s" % str(r["q"].get("question"))[:70])
    if "--write" in args:
        # ★書式はファイルごとに違う。tsujo_indent が突き止められないファイルには書かない
        #   （中身が同じなのに全行が差分になる事故を防ぐ→memory:method_kansa_pipeline）
        want = {}
        for r, tag, need, why in hits:
            want.setdefault(os.path.basename(r["file"]), {})[r["qid"]] = need
        done = skipped = 0
        for name, m in sorted(want.items()):
            fmt = G.tsujo_indent(name)
            if not fmt:
                print("  ⚠ %s は書式を再現できないので書かない（%d件）" % (name, len(m)))
                skipped += len(m)
                continue
            data = G.load_tsujo(name)
            for qid, q in G.walk_tsujo(data, name):
                if qid in m:
                    q["grade"] = m[qid]
                    done += 1
            G.save_tsujo(name, data, fmt)
        print("\n✅ %d件のタグを引き上げた（書かなかった %d件）" % (done, skipped))
    else:
        print("\n（--write を付けると引き上げます）")


if __name__ == "__main__":
    main()
