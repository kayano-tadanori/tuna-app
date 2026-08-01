# -*- coding: utf-8 -*-
"""原簿の末尾に「全レコード一覧（HG番号順）」を作り直す。
   使い方：  python scripts/gen_genbo_appendix.py --write

なぜ要るか（2026-08-01）：
  健康診断で **レコードの約半分が単元インデックスから引けない** ことが分かった。
  単元インデックスは手で足していたので、書き忘れが積み上がっていた。
  単元をキーワードで自動判定する案は、精度を測ったら **1割ほど誤分類** した
  （既約分数の問題が「周期算」に入るなど）ので採らなかった。
  → **代わりに「HG番号順の全件表」を機械的に作る。**
     単元では引けなくても、**番号・出典・骨の一行で必ず引ける**ようにするのが目的。

  ⚠ この表は**索引であって種本ではない**。作問するときは必ず本体レコード（### 【HG-xxxx】）を開く。
     （[[feedback_hamagakuen_iinkai_rule]]「骨の一覧から作らない」）

  レコードを足したら、このスクリプトと `audit_genbo.py` の両方を走らせる。
"""
import io, re, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
GENBO = r"C:\Users\User\.claude\projects\c--Users-User-Desktop-Claude\memory\hamagakuen_ryomon_genbo.md"
MARK_START = "<!-- APPENDIX:ALL-RECORDS:START -->"
MARK_END = "<!-- APPENDIX:ALL-RECORDS:END -->"


def build(s):
    recs = [r for r in re.split(r"(?=^### 【HG-)", s, flags=re.M)
            if re.match(r"### 【HG-\d+】", r)]
    idx = set(re.findall(r"^- \*\*HG-(\d+)\*\*（", s, flags=re.M))
    rows = []
    for r in recs:
        m = re.match(r"### 【HG-(\d+)】(.*)", r)
        hid, head = m.group(1), m.group(2).strip()
        bone = re.search(r"^- 骨: (.*)$", r, flags=re.M)
        b = re.sub(r"\*\*", "", bone.group(1)).strip() if bone else ""
        b = re.sub(r"\s+", " ", b).replace("|", "／")[:80]
        head = head.replace("|", "／")
        # 出典＝括弧の前まで／見出しの説明は骨で代用できるので落とす
        src = re.split(r"[（(]", head)[0].strip()
        star = "".join(re.findall(r"★+", head)[:1])
        rows.append((int(hid), hid, src, star, b, hid in idx))
    rows.sort()
    n_idx = sum(1 for r in rows if r[5])
    out = [MARK_START,
           "",
           "# 📇 全レコード一覧（HG番号順・機械生成）",
           "",
           f"**全{len(rows)}本**。うち**単元インデックスに載っているのは {n_idx}本**"
           f"（載っていない {len(rows) - n_idx}本には「—」を付けた）。",
           "**`python scripts/gen_genbo_appendix.py --write` で作り直す。手で編集しない。**",
           "",
           "> ⚠ **この表は索引であって種本ではない。**作問するときは必ず本体レコードを開くこと。",
           "> 単元で引きたいときは上の「単元インデックス」を、番号や出典で引きたいときはこの表を使う。",
           "",
           "| HG | 索引 | 出典 | 灘度 | 骨 |",
           "|---|---|---|---|---|"]
    for _, hid, src, star, b, ok in rows:
        out.append(f"| HG-{hid} | {'○' if ok else '—'} | {src} | {star} | {b} |")
    out += ["", MARK_END]
    return "\n".join(out), len(rows), n_idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    s = io.open(GENBO, encoding="utf-8").read()
    block, n, n_idx = build(s)
    print(f"レコード {n}本（索引ずみ {n_idx} / もれ {n - n_idx}）")
    if not a.write:
        print("--write を付けると原簿に書き込む")
        return
    if MARK_START in s and MARK_END in s:
        s = re.sub(re.escape(MARK_START) + r".*?" + re.escape(MARK_END), lambda m: block, s, flags=re.S)
        print("既存の付録を作り直した")
    else:
        s = s.rstrip("\n") + "\n\n---\n\n" + block + "\n"
        print("付録を新規に足した")
    io.open(GENBO, "w", encoding="utf-8").write(s)
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
