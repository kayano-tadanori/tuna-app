# -*- coding: utf-8 -*-
"""塾講師サブエージェントに渡す自己完結ファイルを作る（template_sakumon_audit_dispatch）。
   原簿のレコードぜんぶ＋作った大問を1本ずつ交互に並べ、6つに分ける。
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import s5s12_parse as P
import s5s12_add as A

OUTDIR = sys.argv[1] if len(sys.argv) > 1 else "."
N = int(sys.argv[2]) if len(sys.argv) > 2 else 6


def block(r, q):
    L = []
    L.append("=" * 78)
    L.append("%s  小5最レ 第%s分冊 第%d講座 No.%d 大問%d 「%s」" %
             (r["hg"], r["bunsatsu"], r["kouza"], r["no"], r["dai"], r["name"]))
    L.append("--- 原簿のレコード ---")
    L.append("骨: %s" % r["hone"])
    if r["core"]:
        L.append("コア発見: %s" % r["core"])
    if r["intro"]:
        L.append("設定: %s" % r["intro"])
    L.append("設問: %s" % r["mon"])
    L.append("図: %s" % (r["zu"] or "なし"))
    L.append("答え: %s" % r["ans"])
    L.append("解法: %s" % r["kaihou"])
    L.append("--- 作った大問（アプリに入れたもの） ---")
    L.append("id: %s ／ 単元: %s ／ 難易度★%d ／ 図SVG: %s" %
             (q["id"], q["unit"], q["star"], "あり" if q.get("svg") else "なし"))
    L.append("intro（画面の上に出る文）: %s" % (q["intro"] or "（なし）"))
    for i, s in enumerate(q["steps"], 1):
        L.append("  小問%d 設問: %s" % (i, s["question"]))
        L.append("        答え: %s%s" % (s["answer"],
                 ("　【4択】" + " / ".join(s["choices"])) if s.get("choices") else "（テンキー）"))
        L.append("        解説: %s" % s["meaning"])
    return "\n".join(L)


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    blocks = []
    for r in sorted(P.all_parsed(), key=lambda x: (x["kouza"], x["no"], x["dai"])):
        if "⚠" in r["tail"] or not P.ready(r):
            continue
        q, why = A.build_one(r)
        if q is None:
            continue
        blocks.append((r["kouza"], r["no"], block(r, q)))
    per = (len(blocks) + N - 1) // N
    for i in range(N):
        chunk = blocks[i * per:(i + 1) * per]
        if not chunk:
            continue
        rng = "第%d講座 No.%d 〜 第%d講座 No.%d" % (chunk[0][0], chunk[0][1], chunk[-1][0], chunk[-1][1])
        p = os.path.join(OUTDIR, "audit_%d.txt" % (i + 1))
        io.open(p, "w", encoding="utf-8").write(
            "【担当範囲】%s（%d本）\n\n" % (rng, len(chunk)) + "\n\n".join(b for _, _, b in chunk) + "\n")
        print("%s  %s  %d本" % (p, rng, len(chunk)))


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
