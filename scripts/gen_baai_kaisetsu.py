# -*- coding: utf-8 -*-
"""「6通りです。」のように答えを言い直しただけの解説に、解き方を書く。
   場合の数（組み合わせ・順列・格子路）。
   ★答えを式から独立に計算し、既存の答えと一致したものだけ書き換える。
     合わなければ手を触れない（誤った解説を配るより無害）。
"""
import json, io, re, os, sys
from math import comb, factorial

BASE = r"C:\Users\茅野　忠徳\Desktop\Claude\tuna app"
P = os.path.join(BASE, "data", "sansu_baai.json")
items = json.loads(io.open(P, encoding="utf-8").read())

def core(m):
    return re.split(r"よって|したがって", re.sub(r"<[^>]+>", "", str(m)))[0].strip()

def is_empty(q):
    c = core(q.get("meaning", "")); a = str(q.get("answer", ""))
    if not a or not c: return False
    stripped = re.sub(r"[0-9．.]+", "", c.replace(a, ""))
    return len(c) < 18 and "＝" not in c and "=" not in c and a in c and len(stripped) <= 8

def seq(n, r):
    """n×(n-1)×…（r個）の文字列と値"""
    xs = [n - i for i in range(r)]
    return "×".join(str(x) for x in xs), 1 if not xs else eval("*".join(str(x) for x in xs))

def desc_comb(n, r, unit="通り"):
    """組み合わせ nCr の解説"""
    s1, v1 = seq(n, r)
    s2, v2 = seq(r, r)
    ans = v1 // v2
    body = ("①まず順番をつけて選ぶと %s＝%d通りです。"
            "②でも選ぶだけなので順番はどうでもよく、同じ組を %s＝%d回ずつ数えています。"
            "③だから %d÷%d＝<b>%d通り</b>。"
            "「並べてから、並べすぎた分をわり算で返す」のが組み合わせの考え方です。"
            % (s1, v1, s2, v2, v1, v2, ans))
    return ans, body

def desc_perm(n):
    s, v = seq(n, n)
    body = ("①1番目は%d人から選べるので%d通り。②2番目は残りの%d人から%d通り……"
            "と1人ずつ減っていきます。③だから %s＝<b>%d通り</b>。"
            "「使った分だけ、選べる人が1人ずつ減る」のが並べ方の数え方です。"
            % (n, n, n - 1, n - 1, s, v))
    return v, body

def desc_grid(a, b):
    n = a + b
    ans = comb(n, min(a, b))
    s1, v1 = seq(n, min(a, b))
    s2, v2 = seq(min(a, b), min(a, b))
    body = ("①ゴールまでに動く回数は 右%d回＋上%d回＝%d回です。"
            "②そのうち<b>どの%d回を%sにするか</b>を決めれば道順が決まります。"
            "③%s÷（%s）＝<b>%d通り</b>。"
            "格子の道順が組み合わせで解けるのは、"
            "「右・右・右・上・上」のような並べかえと同じ問題だからです。"
            % (a, b, n, min(a, b), "上" if b <= a else "右", s1, s2, ans))
    return ans, body

PAT_COMB = [
    r"^(\d+)人から(\d+)人を選ぶ", r"^(\d+)人から代表を(\d+)人選ぶ",
    r"^(\d+)人から(\d+)人の委員を選ぶ", r"^(\d+)種類のケーキから(\d+)種類を選",
    r"^(\d+)種類の花から(\d+)種類を選", r"^(\d+)種類の色から(\d+)色を選",
    r"^(\d+)人から掃除当番を(\d+)人選", r"^(\d+)人から係を(\d+)人選",
    r"^(\d+)人から(\d+)人の代表を選", r"^(\d+)種類から(\d+)種類を選",
    r"^(\d+)個から(\d+)個を選", r"^(\d+)人から(\d+)人えらぶ",
]
PAT_PERM = [r"^(\d+)人が一列にならびます", r"^(\d+)人が一列に並びます", r"^(\d+)人をならべる"]
PAT_GRID = [r"右に(\d+)区画・上に(\d+)区画", r"右に(\d+)・上に(\d+)進む"]

ok = ng = 0
skipped = []
for q in items:
    if not is_empty(q):
        continue
    t = q["question"]
    try:
        cur = int(str(q.get("answer")))
    except ValueError:
        continue
    res = None
    for p in PAT_COMB:
        m = re.search(p, t)
        if m:
            res = desc_comb(int(m.group(1)), int(m.group(2))); break
    if res is None:
        for p in PAT_PERM:
            m = re.search(p, t)
            if m:
                res = desc_perm(int(m.group(1))); break
    if res is None:
        for p in PAT_GRID:
            m = re.search(p, t)
            if m:
                res = desc_grid(int(m.group(1)), int(m.group(2))); break
    if res is None:
        skipped.append((q["id"], t[:46])); continue
    calc, body = res
    if calc != cur:                      # 検算が合わなければ触らない
        ng += 1
        skipped.append((q["id"], "検算ずれ 式=%d 既存=%d %s" % (calc, cur, t[:34])))
        continue
    q["meaning"] = body + "よって、答えは%sです。" % cur
    ok += 1

io.open(P, "w", encoding="utf-8").write(json.dumps(items, ensure_ascii=False, indent=2) + "\n")
print("解説を書いた: %d問 / 検算ずれで見送り: %d問 / 型に当てはまらず: %d問"
      % (ok, ng, len(skipped) - ng))
for i, s in skipped[:8]:
    print("   見送り", i, s)
