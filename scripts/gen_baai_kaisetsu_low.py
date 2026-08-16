# -*- coding: utf-8 -*-
"""場合の数の解説を、低学年（小3・小4）は「書き出し」で説明し直す。

場合の数は556問中248問が小3で、この単元の主戦場は低学年。
そこに「7×6÷2＝21」という式の説明を入れてしまっていた。
低学年はまだ書き出しの段階で、公式より先に
「もれなく・ダブりなく数える手つき」を身につける必要がある。
原簿由来の既存解説（HG-0384「大きいかたまりから順に書き出します」）も
書き出し方式で書かれている。

小3・小4 → 具体的に書き出す＋最後に式へつなぐ
小5・小6 → 式のまま（変更しない）
"""
import json, io, re, os, sys
from math import comb

BASE = r"C:\Users\茅野　忠徳\Desktop\Claude\tuna app"
P = os.path.join(BASE, "data", "sansu_baai.json")
items = json.loads(io.open(P, encoding="utf-8").read())

AB = "ABCDEFGH"

def comb_low(n, r):
    """組み合わせ：小さいものから順に書き出して見せる"""
    names = AB[:n]
    if r == 2:
        lines = []
        for i in range(n):
            grp = ["%s%s" % (names[i], names[j]) for j in range(i + 1, n)]
            if grp:
                lines.append("%sから始まる組…%s の%d通り" % (names[i], "、".join(grp), len(grp)))
        total = comb(n, 2)
        adds = "＋".join(str(n - 1 - i) for i in range(n - 1))
        return total, ("①%d個を %s とします。"
                       "②<b>小さいほうから順に</b>組をつくります。%s。"
                       "③合わせて %s＝<b>%d通り</b>。"
                       "「AとB」と「BとA」は同じ組なので、1回だけ数えます。"
                       "だから<b>Aから始まる組を全部書いてから、次はBから</b>——と進めると、"
                       "もれもダブりもありません。"
                       % (n, "・".join(names), "／".join(lines), adds, total))
    # r>=3 は「使わないものを選ぶ」に読みかえると軽い
    if r >= 3 and n - r <= 2:
        left = n - r
        total = comb(n, r)
        return total, ("①%d個から%d個を選ぶのは、<b>のこす%d個を選ぶ</b>のと同じことです"
                       "（選ばれなかったほうを決めれば、選ばれるほうも決まるから）。"
                       "②%d個から%d個を選ぶ組を書き出すと<b>%d通り</b>。"
                       "「たくさん選ぶときは、のこりを数える」——これは場合の数の大事なコツです。"
                       % (n, r, left, n, left, total))
    # 一般：1つ目を固定して数える
    total = comb(n, r)
    return total, ("①%d個を %s とします。②%d個の組を、<b>小さいほうから順に</b>書き出して数えます。"
                   "③全部で<b>%d通り</b>です。"
                   "書き出すときは「Aを使う組を全部→次はBから」と決めた順に進めると、"
                   "もれもダブりも起きません。" % (n, "・".join(AB[:n]), r, total))

def perm_low(n):
    names = AB[:n]
    rest = 1
    for i in range(1, n): rest *= i
    lines = []
    for i in range(n):
        lines.append("%s が1番目のとき…%d通り" % (names[i], rest))
    total = rest * n
    return total, ("①%d人を %s とします。②<b>1番目にだれが来るか</b>で分けて数えます。%s。"
                   "③合わせて %s＝<b>%d通り</b>。"
                   "1番目を決めると、のこりの%d人のならべ方は%d通りずつ。"
                   "だから %s＝%d と、かけ算でも求められます。"
                   % (n, "・".join(names), "／".join(lines),
                      "＋".join([str(rest)] * n), total, n - 1, rest,
                      "×".join(str(n - i) for i in range(n)), total))

def grid_low(a, b):
    total = comb(a + b, min(a, b))
    return total, ("①交差点に、そこまでの行き方の数を<b>書きこんで</b>いきます。"
                   "②いちばん下の行と左の列は、まっすぐ行くしかないので全部1。"
                   "③そのほかの点は「<b>左の数＋下の数</b>」（そのどちらかから来るしかないから）。"
                   "④ゴールに書かれた数が答えで、<b>%d通り</b>です。"
                   "この数え方を「かきこみ法」といいます。" % total)

def dice_low(n):
    total = 6 ** n
    if n == 1:
        return 6, "さいころの目は 1・2・3・4・5・6 の<b>6通り</b>です。"
    return total, ("①1こ目の目は6通り。②そのそれぞれに対して2こ目も6通りあります。"
                   "③だから %s＝<b>%d通り</b>。"
                   "「1こ目が1のとき6通り、2のときも6通り…」と%dこ分の"
                   "かたまりが%dセットあると考えると、かけ算になる理由が見えます。"
                   % ("×".join(["6"] * n), total, 6, 6))

def coin_low(n):
    total = 2 ** n
    return total, ("①コイン1回で、表と裏の<b>2通り</b>。"
                   "②2回目もそれぞれ2通りずつ枝分かれします。"
                   "③%d回で %s＝<b>%d通り</b>。"
                   "木の枝が2つずつに分かれていく形（樹形図）を思いうかべると分かりやすいです。"
                   % (n, "×".join(["2"] * n), total))

PAT_COMB = [r"(\d+)人から(\d+)人", r"(\d+)種類.{0,12}?(\d+)種類", r"(\d+)種類の色から(\d+)色",
            r"(\d+)個から(\d+)個", r"(\d+)こから(\d+)こ"]
PAT_PERM = [r"(\d+)人が一列に(?:並|なら)"]
PAT_GRID = [r"右に(\d+)区画・上に(\d+)区画", r"右(?:に|へ)(\d+)[・、]?\s*上(?:に|へ)(\d+)"]

changed = 0
for q in items:
    g = q.get("grade")
    if g not in (3, 4):
        continue
    m0 = str(q.get("meaning", ""))
    # 今回わたしが式で書いた解説だけを対象にする
    if not ("順番をつけて選ぶ" in m0 or "並べてから" in m0 or "1番目は" in m0
            or "積の法則" in m0 or "どの" in m0 and "にするか" in m0):
        continue
    t = q["question"]
    try:
        cur = int(str(q.get("answer")))
    except (TypeError, ValueError):
        continue
    res = None
    mm = re.search(r"コインを(\d+)回", t)
    if mm: res = coin_low(int(mm.group(1)))
    if res is None:
        mm = re.search(r"(\d+)つ(?:の)?(?:さいころ|ダイス)", t)
        if mm and ("目の出方" in t or "目の出かた" in t): res = dice_low(int(mm.group(1)))
    if res is None:
        for p in PAT_PERM:
            mm = re.search(p, t)
            if mm: res = perm_low(int(mm.group(1))); break
    if res is None:
        for p in PAT_GRID:
            mm = re.search(p, t)
            if mm: res = grid_low(int(mm.group(1)), int(mm.group(2))); break
    if res is None:
        for p in PAT_COMB:
            mm = re.search(p, t)
            if mm and ("選" in t or "えら" in t):
                n, r = int(mm.group(1)), int(mm.group(2))
                if n > len(AB) or r > n: break
                res = comb_low(n, r); break
    if res is None:
        continue
    calc, body = res
    if calc != cur:
        continue
    q["meaning"] = body + "よって、答えは%sです。" % cur
    changed += 1

io.open(P, "w", encoding="utf-8").write(json.dumps(items, ensure_ascii=False, indent=2) + "\n")
print("低学年向けに書き直した: %d問" % changed)
for q in items:
    if q.get("grade") == 3 and "小さいほうから順に" in str(q.get("meaning", "")):
        print()
        print("例）", q["question"])
        print(q["meaning"])
        break
