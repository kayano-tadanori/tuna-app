# -*- coding: utf-8 -*-
"""エージェントが書いた解説（out_*.jsonl）を検品してから hama_daimon.json に入れる。

  使い方:
    python scripts/apply_kaisetsu.py docs/_kaisetsu/g3mb_w1 3 master_bunsatsu        （下見）
    python scripts/apply_kaisetsu.py docs/_kaisetsu/g3mb_w1 3 master_bunsatsu --write

  ★返ってきた文章をそのまま入れない。**入れる前に機械で検品する。**
    過去に、同じテンプレを渡した3体のうち2体が独自解釈で誤った書式を採り、
    30問すべてで答えが問題文に出てしまった事故がある（→feedback_content_review_agent）。

  検品ではねるもの:
    ①内輪語が入っている（check_kata の NAIWA をそのまま使う。写さない）
    ②後ろの小問の答えが書いてある（check_kata の leaks/given をそのまま使う）
    ③短すぎる／式だけ（＝直っていない。check_kata の K6 と同じ基準）
    ④いまの解説がもう薄くない（＝別のところで直っている。上書きしない）
    ⑤id と小問番号が実在しない／コースが違う

  ★学年とコースを必ず指定する。id だけでは足りない（同じ id が別コースにも実在する
    ＝hd3s_n12_* の実例／→tool_audit_ledger）。
"""
import glob, io, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G
import check_kata as K

sys.stdout.reconfigure(encoding="utf-8")


def thin(m):
    """check_kata の K6 と同じ「薄い」の判定を使う（写さない）。"""
    m = K.TAG.sub("", str(m or "")).strip()
    if not m:
        return "解説が無い"
    if len(m) < 12:
        return "%d字しかない" % len(m)
    if len(K.KANA.findall(m)) < 4:
        return "式だけ"
    return None


def check(x, no, new):
    """新しい解説を1本検品する。通れば None、はねるなら理由。"""
    s = x["steps"][no - 1]
    cur = s.get("meaning") or ""
    if not thin(cur):
        return "いまの解説はもう薄くない（上書きしない）"
    for w in K.NAIWA:
        if w in new:
            return "内輪語「%s」が入っている" % w
    bad = thin(new)
    if bad:
        return "書き直しになっていない（%s）" % bad
    gv = K.given(x)
    own = str(s.get("answer") or "").strip()
    for j in range(no, len(x["steps"])):        # no は1始まり＝ここから後ろの小問
        a = str(x["steps"][j].get("answer") or "")
        # ★その小問自身の答えと同じ値なら漏れではない（自分の答えを書いているだけ）
        if a.strip() == own:
            continue
        if K.leaks(a, new, gv):
            return "小問%d の答え「%s」を先に見せている" % (j + 1, a)
    return None


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    outdir, grade, course = sys.argv[1], sys.argv[2], sys.argv[3]
    write = "--write" in sys.argv
    # ★--allow id:step,... ＝ **人が1本ずつ見て誤検出と判断したものだけ**を通す。
    #   2026-09-09の第1波では、はねた13件のうち12件が同じ型の誤検出だった：
    #   **その小問の与件から出る中間の値が、たまたま後ろの小問の答えと同じ**
    #   （「三角形の角の和180」が星形の答え180と一致／「23000mm＝23m」が別の答え23と一致）。
    #   機械では見分けられないので、通すときは必ず人が中身を読んでから列挙する。
    allow = set()
    for i, a in enumerate(sys.argv):
        if a == "--allow" and i + 1 < len(sys.argv):
            for pair in sys.argv[i + 1].split(","):
                k, _, v = pair.partition(":")
                allow.add((k.strip(), int(v)))

    path = os.path.join(G.BASE, "data", "hama_daimon.json")
    d = json.load(io.open(path, encoding="utf-8"))
    ix = {r["x"]["id"]: r["x"] for r in G.iter_daimon(d, grade=grade, app_courses=[course])}

    rows, notes, dup = [], [], 0
    seen = set()
    for f in sorted(glob.glob(os.path.join(outdir, "out_*.jsonl"))):
        for ln in io.open(f, encoding="utf-8"):
            ln = ln.strip()
            if not ln:
                continue
            try:
                r = json.loads(ln)
            except ValueError:
                print("  ⚠ %s: JSONとして読めない行がある" % os.path.basename(f))
                continue
            if r.get("note"):
                notes.append(r)
                continue
            key = (r.get("id"), r.get("step"))
            if key in seen:
                dup += 1
                continue
            seen.add(key)
            rows.append(r)

    ok, ng = [], []
    for r in rows:
        x = ix.get(r.get("id"))
        if not x:
            ng.append((r, "この学年・コースに id が無い"))
            continue
        no = r.get("step")
        if not isinstance(no, int) or not (1 <= no <= len(x.get("steps") or [])):
            ng.append((r, "小問番号が範囲外"))
            continue
        why = check(x, no, r.get("meaning") or "")
        if why and (r.get("id"), no) in allow and "先に見せている" in why:
            why = None          # 人が見て誤検出と判断ずみ
        (ok.append((x, no, r["meaning"])) if why is None else ng.append((r, why)))

    print("読んだ %d行（重複 %d／note %d）" % (len(rows) + len(notes) + dup, dup, len(notes)))
    print("通った %d ／ はねた %d" % (len(ok), len(ng)))
    for r, why in ng[:30]:
        print("   ✗ %-16s 小問%-3s %s" % (r.get("id"), r.get("step"), why))
    if len(ng) > 30:
        print("   …ほか %d件" % (len(ng) - 30))
    for r in notes[:20]:
        print("   📝 %-16s 小問%-3s %s" % (r.get("id"), r.get("step"), r.get("note")))

    if not write:
        print("\n（--write を付けると実際に書き込みます）")
        return 0

    for x, no, new in ok:
        x["steps"][no - 1]["meaning"] = new
    io.open(path, "w", encoding="utf-8", newline="\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("\n✅ %d本の解説を入れた" % len(ok))
    return 0


def _entry():
    if "--tsujo" in sys.argv:
        return main_tsujo()
    return main()


# ── 通常問題（一問一答）版 ──────────────────────────────────
# ★大問版と判定を共有する（thin は check_kata.thin_reason、内輪語は NAIWA）。写さない。
# ★大問と違い、小問のつながりが無いので「後ろの答えを先に見せる」検査は要らない。

def main_tsujo():
    """docs/_kaisetsu/<dir>/out_*.jsonl を通常問題へ書き戻す。

      python scripts/apply_kaisetsu.py --tsujo docs/_kaisetsu/t_w1          （下見）
      python scripts/apply_kaisetsu.py --tsujo docs/_kaisetsu/t_w1 --write

    ★書式はファイルごとに違う。genbo_common.tsujo_indent() で元の書式を突き止め、
      **再現できないファイルには書かない**（勝手に書式を変えない）。
    """
    outdir = sys.argv[sys.argv.index("--tsujo") + 1]
    write = "--write" in sys.argv

    rows, notes, dup, seen = [], [], 0, set()
    for f in sorted(glob.glob(os.path.join(outdir, "out_*.jsonl"))):
        for ln in io.open(f, encoding="utf-8"):
            ln = ln.strip()
            if not ln:
                continue
            try:
                r = json.loads(ln)
            except ValueError:
                print("  ⚠ %s: JSONとして読めない行がある" % os.path.basename(f))
                continue
            if r.get("note"):
                notes.append(r)
                continue
            q = r.get("qid")
            if q in seen:
                dup += 1
                continue
            seen.add(q)
            rows.append(r)

    # いまのデータを引く（qid → 問題）
    cur = {}
    for r in G.iter_tsujo():
        cur[r["qid"]] = r

    ok, ng = [], []
    for r in rows:
        t = cur.get(r.get("qid"))
        if not t:
            ng.append((r, "その宛名の問題が見つからない"))
            continue
        new = r.get("meaning") or ""
        if not K.thin_reason(G.meaning_of(t["q"]), t["q"].get("question")):
            ng.append((r, "いまの解説はもう薄くない（上書きしない）"))
            continue
        bad = [w for w in K.NAIWA if w in new]
        if bad:
            ng.append((r, "内輪語「%s」が入っている" % bad[0]))
            continue
        v = K.thin_reason(new, t["q"].get("question"))
        if v:
            ng.append((r, "書き直しになっていない（%s）" % v[1]))
            continue
        ok.append((t, new))

    print("読んだ %d行（重複 %d／note %d）" % (len(rows) + len(notes) + dup, dup, len(notes)))
    print("通った %d ／ はねた %d" % (len(ok), len(ng)))
    for r, why in ng[:30]:
        print("   ✗ %-46s %s" % (str(r.get("qid"))[:46], why))
    if len(ng) > 30:
        print("   …ほか %d件" % (len(ng) - 30))
    for r in notes[:20]:
        print("   📝 %-46s %s" % (str(r.get("qid"))[:46], r.get("note")))

    if not write:
        print("\n（--write を付けると実際に書き込みます）")
        return 0

    # ファイルごとにまとめて書く（1ファイルを何度も読み書きしない）
    byfile = {}
    for t, new in ok:
        byfile.setdefault(t["file"], []).append((t["qid"], new))
    done = skipped = 0
    for name, items in sorted(byfile.items()):
        fmt = G.tsujo_indent(name)
        if fmt is None:
            print("   ⚠ %s は元の書式を再現できないので書かない（%d件見送り）" % (name, len(items)))
            skipped += len(items)
            continue
        data = G.load_tsujo(name)
        ix = dict(G.walk_tsujo(data, name))
        n = 0
        for qid, new in items:
            q = ix.get(qid)
            if q is None:
                skipped += 1
                continue
            key = "kaisetsu" if "kaisetsu" in q else "meaning"
            q[key] = new
            n += 1
        G.save_tsujo(name, data, fmt)
        print("   %-28s %d件" % (name, n))
        done += n
    print("\n✅ %d本の解説を入れた（見送り %d）" % (done, skipped))
    return 0


if __name__ == "__main__":
    sys.exit(_entry())
