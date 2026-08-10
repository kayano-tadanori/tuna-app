# -*- coding: utf-8 -*-
"""原簿の「単元インデックス」に載っていないレコードを、単元ごとに拾い上げて追記する。
   使い方：  python scripts/fix_genbo_index.py --dry     （何をどこに入れるか見るだけ）
             python scripts/fix_genbo_index.py --write   （実際に原簿へ書く）

なぜ要るか（2026-08-01）：
  原簿の運用ルールは「単元インデックスから引く（最レの対策はここから引く）」なのに、
  健康診断で **1,216本のうち564本（47%）が索引から引けない** ことが分かった。
  索引はレコードを作るたびに手で足していたので、書き忘れが積み上がっていた。
  → **これからは、レコードを足したらこのスクリプトを走らせる。**

分類の考え方：
  レコード本文の「骨」「コア発見」「作問メモ」からキーワードを拾い、既存の単元セクションに割り当てる。
  **迷ったら入れない。** 判定できなかったものは「未分類」節にまとめて出す（あとで手で振り分ける）。
  ⚠ 単元名は原簿の見出しに実在するものだけを使う（勝手に新設しない）。
"""
import io, os, re, sys, argparse, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
GENBO = find_genbo()

# 単元 → キーワード。**上から順に当てる**（先に書いたものが強い）
RULES = [
    ("N進法",              r"N進法|進法|[二三四五六七八九]進"),
    ("記号定義（約束）",    r"記号定義|約束記号"),
    ("群数列",              r"群数列|群に分け"),
    ("方陣算",              r"方陣|中空|中実"),
    ("植木算",              r"植木算|のりしろ|間かく"),
    ("つるかめ算",          r"つるかめ|弁償"),
    ("過不足算・差集め算",  r"過不足|差集め"),
    ("和差算・分配算",      r"和差算|分配算"),
    ("年齢算",              r"年齢算|年令算"),
    ("平均算",              r"平均算|平均"),
    ("相当算・還元算",      r"相当算|還元算|全体を1と"),
    ("倍数算",              r"倍数算|やりとり"),
    ("食塩水・濃度",        r"食塩水|濃度|こさ|溶解度|飽和"),
    ("比例・反比例",        r"反比例|正比例|比例の関係"),
    ("消去算",              r"消去算|連立|等式2本|2つの等式"),
    ("推理・論理",          r"推理|論理|一意に決|決まらない|同定"),
    ("速さ（通過・流水・時計）", r"通過算|流水|時計算|長針|短針|音速"),
    ("速さ（旅人算）",      r"旅人算|出会|追いこ|追いつ|速さ"),
    ("周期算",              r"周期|日暦|曜日|循環"),
    ("倍数・約数",          r"倍数|約数|素因数|互除法"),
    ("概数（がい数）",      r"概数|がい数|四捨五入|切り上げ|切り捨て"),
    ("なかま調べ（集合・ベン図）", r"ベン図|集合"),
    ("展開図・投影図",      r"展開図|投影図|三面図"),
    ("図形の移動・対称",    r"転がす|回転体|線対称|点対称|折り返し|折り目|敷き詰め"),
    ("立体図形（体積・表面積）", r"立体|体積|表面積|直方体|立方体|円柱|円すい|角すい|水そう"),
    ("平面図形（相似・比）", r"相似|砂時計|たすきがけ|チェバ"),
    ("平面図形（角度）",    r"角度|内角|外角|平行線と角|何度"),
    ("平面図形（面積）",    r"面積|等積"),
    ("規則性・数列",        r"数列|階差|等差|三角数|平方数|n番目"),
    ("場合の数",            r"場合の数|何通り|並べ方|選び方|道順|最短経路|組み合わせ|数え上げ|余事象"),
    ("最大最小・最適化",    r"最大|最小|いちばん近い|最も短い"),
    ("不可能性・存在証明",  r"不可能|作れない|存在しない"),
    ("割合",                r"割合|もとにする量|百分率|歩合"),
    ("比",                  r"連比|逆比"),
    ("計算のくふう",        r"くふう|くくり出|分配法則|部分分数"),
    ("数の性質",            r"数の性質|位取り|各位の和|けた|あまり"),
    ("★ 理科・化学計算",   r"気体|水よう液|燃焼|石灰水|密度|ぼう張|伸び縮み|電流|回路|豆電球|分銅|レンズ|磁石|単位あたり量"),
]


def load():
    return io.open(GENBO, encoding="utf-8").read()


def sections(s):
    """単元セクションの見出し行 → 行番号"""
    lines = s.split("\n")
    st = next(i for i, l in enumerate(lines) if l.startswith("## ★ 単元別の厚み"))
    en = next(i for i, l in enumerate(lines) if l.startswith("## レコードの書式"))
    out = {}
    for i in range(st, en):
        m = re.match(r"^## (?:★+ )?(.+?) (\d+)問", lines[i])
        if m:
            out[m.group(1)] = (i, int(m.group(2)))
    return lines, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    s = load()
    lines, secs = sections(s)
    recs = [r for r in re.split(r"(?=^### 【HG-)", s, flags=re.M) if re.match(r"### 【HG-\d+】", r)]
    idx = set(re.findall(r"^- \*\*HG-(\d+)\*\*（", s, flags=re.M))

    add = collections.defaultdict(list)
    unknown = []
    for r in recs:
        m = re.match(r"### 【HG-(\d+)】(.*)", r)
        hid, head = m.group(1), m.group(2).strip()
        if hid in idx:
            continue
        # 出典＝見出しの「（」より前／説明＝括弧の中／★の数
        src = re.split(r"[（(]", head)[0].strip()
        desc = ""
        mm = re.search(r"[（(]([^）)]*)[）)]", head)
        if mm:
            desc = mm.group(1)
        star = "".join(re.findall(r"★+", head)[:1])
        # ★判定は「見出し＋骨＋コア発見」だけを見る。作問メモまで見ると
        #   関連単元の話を拾って誤分類する（立体図形の問題が「規則」で規則性に飛んだ）
        bone = re.search(r"^- 骨: (.*)$", r, flags=re.M)
        core = re.search(r"^- コア発見: (.*)$", r, flags=re.M)
        target = head + "\n" + (bone.group(1) if bone else "") + "\n" + (core.group(1) if core else "")
        unit = None
        for u, pat in RULES:
            if u not in secs:
                continue
            if re.search(pat, target):
                unit = u
                break
        line = f"- **HG-{hid}**（{src}）{star} {desc}".rstrip()
        if unit:
            add[unit].append(line)
        else:
            unknown.append(line)

    tot = sum(len(v) for v in add.values())
    print(f"索引に足せるもの {tot}本／単元を決められなかったもの {len(unknown)}本")
    for u in sorted(add, key=lambda x: -len(add[x])):
        print(f"  {u:22s} +{len(add[u]):4d}本（今 {secs[u][1]}問）")

    if not a.write:
        print("\n--dry のまま。書くには --write を付ける")
        return

    # 下から順に挿入（行番号がずれないように）
    for u in sorted(add, key=lambda x: -secs[x][0]):
        i, n = secs[u]
        lines[i] = re.sub(r"(\d+)問", f"{n + len(add[u])}問", lines[i], count=1)
        lines[i + 1:i + 1] = add[u]
    out = "\n".join(lines)
    if unknown:
        blk = ("\n## 🧩 単元を決められなかったレコード（手で振り分ける）\n"
               "**`scripts/fix_genbo_index.py` が自動判定できなかったぶん。**"
               "見出しから単元が読み取れないもの（回まるごとの要約レコード・国語・複合単元など）。\n\n"
               + "\n".join(unknown) + "\n")
        out = out.replace("\n## レコードの書式", blk + "\n## レコードの書式", 1)
    io.open(GENBO, "w", encoding="utf-8").write(out)
    print("\n✅ 原簿に書き込んだ")


if __name__ == "__main__":
    main()
