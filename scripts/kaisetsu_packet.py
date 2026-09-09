# -*- coding: utf-8 -*-
"""解説が薄い小問を「書き直すのに必要な情報だけ」の自己完結ファイルに切り出す。

  ★audit_packet.py（監査用）との違い：あちらは原簿レコードごと載せて「原本どおりか」を
    見てもらう。こちらは**解説を厚くするだけ**なので原簿も図も要らない。
    載せるのは intro・設問・答え・いまの解説だけ。**原本PDFは開かせない。**

  使い方:
    python scripts/kaisetsu_packet.py 3/master_bunsatsu 4 docs/_kaisetsu/g3mb_w1

  ★本数でなく**字数**で割る（1大問の重さが何倍もちがうため／→method_kansa_pipeline）。
"""
import io, json, os, sys, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G
import check_kata as K

sys.stdout.reconfigure(encoding="utf-8")


def thin_steps(rs):
    """(大問, [薄い小問番号...]) を、check_kata の K6 の判定そのままで返す。
    ★判定をここに書き写さない（→feedback_kansa_script_copy）。K6 を呼ぶだけ。"""
    by = collections.OrderedDict()
    for r, lv, msg in K.k6(rs):
        no = int(msg.split("小問")[1].split(" ")[0])
        by.setdefault(r["x"]["id"], (r, []))[1].append(no)
    return by


def block(r, nos):
    x = r["x"]
    L = ["=" * 74,
         "■ %s ／ %s学年 %s ／ No.%s ／ 単元: %s" %
         (x["id"], r["grade"], r["app_course"], r["no"], x.get("unit", "")),
         "題: %s" % (x.get("title") or ""), ""]
    intro = (x.get("intro") or "").strip()
    if intro:
        L += ["【問題の設定（子どもに先に見せている文）】", intro, ""]
    for no in nos:
        s = x["steps"][no - 1]
        L += ["--- 小問%d ---" % no,
              "設問: %s" % (s.get("question") or "").strip(),
              "答え: %s" % s.get("answer"),
              "いまの解説（これを厚くする）: %s" % (s.get("meaning") or "").strip(), ""]
    return "\n".join(L)



def tsujo_block(r, msg):
    q = r["q"]
    L = ["=" * 74,
         "■ %s ／ %s ／ %s年 難度%s ／ 単元: %s" %
         (r["qid"], r["file"], q.get("grade", "?"), q.get("difficulty", "?"),
          q.get("unit", "")), ""]
    L.append("設問: %s" % str(q.get("question") or "").strip())
    if q.get("choices"):
        L.append("選択肢: %s" % " ／ ".join(str(c) for c in q["choices"]))
    L.append("答え: %s" % q.get("answer"))
    L.append("いまの解説（これを厚くする）: %s" % str(G.meaning_of(q) or "").strip())
    L.append("")
    return "\n".join(L)


def main_tsujo():
    """通常問題（一問一答）の薄い解説を切り出す。

    ★大問と違い、小問のつながりが無いので「後ろの答えを見せない」配慮は要らない。
      そのぶん資料も軽い（設問・選択肢・答え・いまの解説だけ）。
    """
    name, n, outdir = sys.argv[2], int(sys.argv[3]), sys.argv[4]
    only = None if name == "all" else {name}
    hits = [h for h in K.k7() if only is None or h[0]["file"] in only]
    blocks = [(h[0]["qid"], tsujo_block(h[0], h[2])) for h in hits]
    total = sum(len(b) for _i, b in blocks)
    os.makedirs(outdir, exist_ok=True)
    per = total / n if n else total
    parts, cur, cur_len = [], [], 0
    for i, b in blocks:
        if cur and cur_len + len(b) > per and len(parts) < n - 1:
            parts.append(cur); cur, cur_len = [], 0
        cur.append((i, b)); cur_len += len(b)
    parts.append(cur)
    for k, part in enumerate(parts, 1):
        p = os.path.join(outdir, "kaisetsu_%d.txt" % k)
        body = "\n".join(b for _i, b in part)
        io.open(p, "w", encoding="utf-8", newline="\n").write(body)
        print("%s … %d問／%d字" % (p, len(part), len(body)))
    print("合計 %d問／%d字" % (len(blocks), total))
    return 0


def main():
    if "--tsujo" in sys.argv:
        return main_tsujo()
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    sel, n, outdir = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    grade, course = sel.split("/")
    rs = [r for r in G.iter_daimon(G.load_daimon())
          if r["grade"] == grade and r["app_course"] == course]
    by = thin_steps(rs)
    blocks = [(i, block(r, sorted(nos)), len(nos)) for i, (r, nos) in by.items()]
    total = sum(len(b) for _i, b, _n in blocks)
    os.makedirs(outdir, exist_ok=True)

    # 字数で等分（本数ではない）
    per = total / n
    parts, cur, cur_len = [], [], 0
    for i, b, cnt in blocks:
        if cur and cur_len + len(b) > per and len(parts) < n - 1:
            parts.append(cur)
            cur, cur_len = [], 0
        cur.append((i, b, cnt))
        cur_len += len(b)
    parts.append(cur)

    for k, part in enumerate(parts, 1):
        p = os.path.join(outdir, "kaisetsu_%d.txt" % k)
        body = "\n".join(b for _i, b, _c in part)
        io.open(p, "w", encoding="utf-8", newline="\n").write(body)
        print("%s … 大問%d本／小問%d／%d字" %
              (p, len(part), sum(c for _i, _b, c in part), len(body)))
    print("合計 大問%d本／小問%d／%d字" %
          (len(blocks), sum(c for _i, _b, c in blocks), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
