# -*- coding: utf-8 -*-
"""原簿の健康診断。**回の抜け・索引もれ・答えのないレコード**を機械的に出す。
   原簿を触ったら実行する。使い方：  python scripts/audit_genbo.py

なぜ要るか（2026-08-01）：
  小5最レ No.12 が「全20回✅完走」の表記の裏で丸ごと抜けていた。同じ穴が
  小5本科 No.14・小4理科にもあった。**「完走」の表記は根拠にならない。実データを数える。**

数えるときの落とし穴（3つとも実際に踏んだ）：
  ① 同じ教材が複数の名前で書かれている
     （小5の本科が「小5マスター／小5本科／小5 マスターV/VS／小5 実力テストV」の4通り）
  ② 同じ教材が複数のセクションに散っている
     （公開学力テストが6セクション／小4理科が2セクション／「簡略記載のフルレコード化 第1〜3弾」）
     → だから **セクションで分類してはいけない。見出しの出典で分類する**
  ③ 本科（マスター1st）と復習テストは別教材。まとめると本科No.14の穴が復習No.14に隠れる
"""
import re, io, os, sys, collections

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
GENBO = r"C:\Users\User\.claude\projects\c--Users-User-Desktop-Claude\memory\hamagakuen_ryomon_genbo.md"

# 見出しの出典 → 教材名。**上から順に当てる**（小3最レ刷新版は小3最レより先）
BOOKS = [
    ("小3マスター",    r"^小3\s*マスター"),
    ("小3最レ刷新版",  r"^小3\s*最レ（刷新版）|^小3最レ\s*刷新版"),
    ("小3最レ旧版",    r"^小3\s*最レ"),
    ("小3灘合",        r"^小3\s*灘合"),
    ("小4マスター",    r"^小4\s*(?:マスター|実力|No\.)"),
    ("小4最レ",        r"^小4\s*(?:最レ|最高レベル)"),
    ("小4理科",        r"^小4\s*理科"),
    ("小4灘合",        r"^小4\s*灘合"),
    # 1st・A表に載る本体。**「小5 No.20 大問5」のように教材名を省いた見出しもある**
    ("小5本科",        r"^小5\s*(?:マスター|本科|実力テストV|実力|No\.)"),
    ("小5復習テスト",  r"^小5\s*復習"),                                  # 別教材
    ("小5 2nd演習",    r"^小5\s*2nd"),
    ("小5最レ",        r"^小5\s*(?:最レ|最高レベル)"),
    ("小5理科",        r"^小5\s*理科"),
    ("小5灘合",        r"^小5\s*灘合"),
    ("公開・理科",     r"^20\d\d[^（]*公開.*理科"),
    ("公開・国語",     r"^20\d\d[^（]*公開.*国語"),
    ("公開・算数",     r"^20\d\d[^（]*公開|^第(?:59|6[0-3])\d回"),
    ("灘中模試・チャレンジ", r"^20\d\d"),
]
# 「第N回 大問…」だけの見出しは出典が書いてない＝灘合。**セクションは当てにならない**
# （小5灘合のレコードが小4灘合のセクションの中に置かれている）ので、HG番号の帯で決める
BAND_FALLBACK = [("小3灘合", 1901, 2010), ("小5灘合", 2201, 2299), ("小4灘合", 2301, 2599)]

# 「抜けていて当たり前」の回（本文に根拠がある。埋めなくてよい）
KNOWN_OK = {
    "小5理科": ({1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, "No.1〜10は植物・こん虫・動物＝暗記（本文に明記）"),
}


def main():
    lines = io.open(GENBO, encoding="utf-8").read().split("\n")
    recs, sec = [], ""
    for l in lines:
        if l.startswith("# "):
            sec = l[2:].strip()
        m = re.match(r"### 【HG-(\d+)】(.*)", l)
        if m:
            recs.append((m.group(1), m.group(2).strip(), sec))

    cov = collections.defaultdict(lambda: collections.defaultdict(list))
    unknown = []
    for hid, head, sec in recs:
        book = next((b for b, pat in BOOKS if re.match(pat, head)), None)
        if not book and re.match(r"^第\d+回", head):
            n = int(hid)
            book = next((b for b, lo, hi in BAND_FALLBACK if lo <= n <= hi), None)
        if not book:
            unknown.append((hid, head[:44]))
            continue
        m = re.search(r"No\.(\d+)|第(\d+)回", head)
        no = int(m.group(1) or m.group(2)) if m else ("実力" if "実力" in head[:16] else "他")
        cov[book][no].append(hid)

    print("=== ① 回の抜け（教材ごと。ここが空でないと『完走』とは言えない）===")
    holes = 0
    for b in [x[0] for x in BOOKS]:
        if b not in cov:
            continue
        d = cov[b]
        ns = sorted(n for n in d if isinstance(n, int))
        if not ns:
            continue
        ok, why = KNOWN_OK.get(b, (set(), ""))
        miss = [n for n in range(min(ns), max(ns) + 1) if n not in d and n not in ok]
        tot = sum(len(v) for v in d.values())
        tail = f"  ❌抜け={miss}" if miss else "  ✅抜けなし"
        if why:
            tail += f"（除外：{why}）"
        print(f"  {b:12s} {tot:4d}本  No.{min(ns)}〜{max(ns)}／収録{len(ns)}回{tail}")
        holes += len(miss)

    g = "\n".join(lines)
    idx = set(re.findall(r"^- \*\*HG-(\d+)\*\*（", g, flags=re.M))
    body = [(h, hd) for h, hd, _ in recs]
    orphan = [(h, hd) for h, hd in body if h not in idx]
    print(f"\n=== ② 単元インデックスから引けないレコード {len(orphan)}／{len(body)}本 ===")
    c = collections.Counter()
    for h, hd in orphan:
        b = next((b for b, pat in BOOKS if re.match(pat, hd)), "その他")
        c[b] += 1
    for k, v in c.most_common():
        print(f"  {k:12s} {v:4d}本")

    noans = [(h, hd) for h, hd, _ in recs
             if not re.search(r"答え", hd) and "答え" not in _get(g, h)]
    print(f"\n=== ③ 「答え:」の行が無いレコード {len(noans)}本 ===")
    for h, hd in noans[:20]:
        print("   HG-" + h, hd[:56])

    und = [(h, hd) for h, hd, _ in recs
           if re.search(r"答え:.*(未確定|要現物照合|保留)", _get(g, h))]
    print(f"\n=== ④ 答えが未確定のレコード {len(und)}本（図の判読待ち）===")
    cu = collections.Counter(next((b for b, pat in BOOKS if re.match(pat, hd)), "その他") for h, hd in und)
    for k, v in cu.most_common():
        print(f"  {k:12s} {v:4d}本")

    if unknown:
        print(f"\n=== ⑤ 教材を判定できなかった見出し {len(unknown)}本（BOOKSに足す）===")
        for h, hd in unknown[:15]:
            print("   HG-" + h, hd)

    print(f"\n{'❌ 回の抜けが ' + str(holes) + ' 件' if holes else '✅ 回の抜けなし'}")


_cache = {}


def _get(g, hid):
    """HG-xxxx のレコード本文を返す"""
    if not _cache:
        for r in re.split(r"(?=^### 【HG-)", g, flags=re.M):
            m = re.match(r"### 【HG-(\d+)】", r)
            if m:
                _cache[m.group(1)] = r
    return _cache.get(hid, "")


if __name__ == "__main__":
    main()
