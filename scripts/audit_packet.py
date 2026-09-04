# -*- coding: utf-8 -*-
"""未監査の大問を「原簿レコード＋作った大問」の自己完結ファイルに切り出す（汎用版）。

  template_sakumon_audit_dispatch の1周目に渡す資料を作る。教材ごとに
  audit_dump スクリプトを書き足していくのをやめ、audit_ledger の
  「未監査」判定をそのまま使って、どのコースでも同じ手順で出せるようにした。

  使い方:
    python scripts/audit_packet.py 5/sairei 4 docs/_audit/s5sairei_w1 --start 0 --take 280

  ★原簿の図SVG欄はここで落とす（トークンを食うだけで、図の検査は別系統
    method_svg_check / check_text_contrast がやる）。アプリ側のSVGは
    「問題文と図が食いちがっていないか」を見てもらうため 4000字まで載せる。
"""
import io, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G
import audit_ledger as A

SVG_MAX = 4000


def strip_genbo_svg(body):
    """原簿レコードから図SVGの中身だけ落とす（欄があったことは残す）。"""
    body = re.sub(r"```html.*?```", "（図SVG・省略）", body, flags=re.S)
    body = re.sub(r"^(\s*[-*]?\s*図SVG[^:：]*[:：]\s*)<svg.*$",
                  r"\1（省略）", body, flags=re.M)
    return body.rstrip()


def block(r, genbo_body):
    x = r["x"]
    L = []
    L.append("=" * 78)
    L.append("■ %s ／ %s学年 %s ／ %s No.%s ／ %s" %
             (x["id"], r["grade"], r["app_course"], r["kind"], r["no"], x.get("src", "")))
    L.append("")
    L.append("--- 原簿のレコード（種本・これが正） ---")
    L.append(genbo_body if genbo_body else "（原簿レコードが見つからない＝要注意。src欄: %s）" % x.get("src", ""))
    L.append("")
    L.append("--- 作った大問（アプリに入っているもの） ---")
    L.append("単元: %s ／ 難易度★%s ／ 題: %s" % (x.get("unit"), x.get("star"), x.get("title")))
    L.append("intro（画面の上に出る文）: %s" % (x.get("intro") or "（なし）"))
    svg = x.get("svg") or ""
    if svg:
        L.append("図SVG: %s" % (svg if len(svg) <= SVG_MAX else svg[:SVG_MAX] + " …（以下略・%d字）" % len(svg)))
    else:
        L.append("図SVG: なし（ただし小問側に図があることがある。下の各小問を見ること）")
    # ★小問（step）にも図が持てる。アプリは js/sansu.js の `svg: step.svg || chain.svg` で
    #   小問側を優先するので、大問直下の svg だけを載せると「図が無い」と誤って読ませてしまう
    #   （2026-09-04・監査エージェントの申し送りで発覚。24本中8本を「図SVG: なし」と誤表示していた）。
    for i, s in enumerate(x.get("steps", []), 1):
        L.append("  小問%d 設問: %s" % (i, s.get("question")))
        ch = s.get("choices")
        L.append("        答え: %s%s" % (s.get("answer"),
                 ("　【選択肢】" + " / ".join(ch)) if ch else "（テンキー入力）"))
        ssvg = s.get("svg") or ""
        if ssvg:
            L.append("        図SVG（この小問だけの図。大問の図より優先して出る）: %s"
                     % (ssvg if len(ssvg) <= SVG_MAX else ssvg[:SVG_MAX] + " …（以下略・%d字）" % len(ssvg)))
        L.append("        解説: %s" % s.get("meaning"))
    return "\n".join(L)


def main():
    want = sys.argv[1]
    n = int(sys.argv[2])
    outdir = sys.argv[3]
    start, take = 0, None
    if "--start" in sys.argv:
        start = int(sys.argv[sys.argv.index("--start") + 1])
    if "--take" in sys.argv:
        take = int(sys.argv[sys.argv.index("--take") + 1])

    ix, audited, _p, _l = A.build()
    rows = []
    for i, r in ix.items():
        if i in audited:
            continue
        if not ("%s/%s" % (r["grade"], r["app_course"])).startswith(want):
            continue
        rows.append(r)
    total = len(rows)
    rows = rows[start:] if take is None else rows[start:start + take]

    blocks = []
    for r in rows:
        hgs = G.hgof(r["x"]) or []
        body = "\n\n".join(strip_genbo_svg(G.recs_body[h]) for h in hgs if h in G.recs_body)
        blocks.append((r, block(r, body)))

    os.makedirs(outdir, exist_ok=True)
    # ★本数でなく「字数」で割る。1本あたりの重さが最大5倍ちがう（図・小問数）ので、
    #   本数で等分すると片方のエージェントだけ context を食いつぶす。
    budget = 80000
    if "--budget" in sys.argv:
        budget = int(sys.argv[sys.argv.index("--budget") + 1])
    packs, cur, curlen = [], [], 0
    for r, b in blocks:
        if cur and curlen + len(b) > budget:
            packs.append(cur); cur, curlen = [], 0
        cur.append((r, b)); curlen += len(b)
    if cur:
        packs.append(cur)
    packs = packs[:n]
    used = sum(len(p_) for p_ in packs)
    for k, chunk in enumerate(packs, 1):
        rng = "%s No.%s（%s） 〜 %s No.%s（%s）" % (
            chunk[0][0]["kind"], chunk[0][0]["no"], chunk[0][0]["x"]["id"],
            chunk[-1][0]["kind"], chunk[-1][0]["no"], chunk[-1][0]["x"]["id"])
        p = os.path.join(outdir, "audit_%d.txt" % k)
        nl = chr(10)
        txt = ("【担当範囲】%s ／ %d本" % (rng, len(chunk))) + nl*2 + (nl*2).join(b for _, b in chunk) + nl
        io.open(p, "w", encoding="utf-8").write(txt)
        print("%s  %d本  %d字  %s" % (p, len(chunk), len(txt), rng))
    blocks = blocks[:used]
    print("--- 未監査 %d本のうち %d本を切り出した ---" % (total, len(blocks)))


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    main()
