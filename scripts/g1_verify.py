# -*- coding: utf-8 -*-
u"""試行の判定：**既存G1成果物を基準に**、新経路（新形式→機械結合）の忠実性を測る。

  python scripts/g1_verify.py --trial-dir docs/_genbo/_trial10

見るのは2つ。混ぜずに別々に出す。
  ① 新経路の欠落・改変 … 旧G1成果物 ⟷ 新形式／結合出力（**これが合否**）
  ② 既存側との差       … 既存の原簿・アプリ ⟷ 結合出力（**参考**。既存の誤転記は再現しない）

文字一致率では見ない。原文・答え・小問の順・数値・選択肢（記号と本文の対応と順序）・
SVG（バイト一致＋構文）を個別に突き合わせる。表示の実測は check_svg_json.py に渡す。
"""
import argparse
import collections
import glob
import io
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import genbo_common as gc                                  # noqa: E402
from genbo_path import find_genbo                          # noqa: E402
from g1_guard import assert_safe_out_dir                   # noqa: E402
import g1_from_old as old                                  # noqa: E402
import g1_join as jn                                      # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")


def ws(s):
    return re.sub(u"\\s+", u"", s or u"")


def nl(s):
    return (s or u"").replace(u"\r\n", u"\n").replace(u"\r", u"\n").strip()


def nums(s):
    return collections.Counter(re.findall(u"\\d+(?:\\.\\d+)?", s or u""))


def old_blocks(pick_items):
    u"""同じ大問が複数のパケットに載っていることがある（境目の追加回収）。
    その全部を集めて返す。1つのファイルだけと比べると、合流したぶんが「増えた」に見える。"""
    out = []
    for p in pick_items:
        path = os.path.join(old.OLD_DIR, p[u"file"])
        text = io.open(path, encoding=u"utf-8").read()
        for head, body in old.split_items(text):
            if old.parse_label(head)[0] == p[u"label"]:
                out.append(old.parse_fields(body))
                break
    return out


def field(fields, name):
    return next((v for k, n, v in fields if k == name), None)


def field_any(blocks, *names):
    u"""複数パケットのうち、その欄を**中身つきで**持っている最初のものを返す（合流の規則と同じ）。

    ★「★未読（解答が担当範囲外）」は中身ではない。ここを拾うと、追加回収した本物の答えを
      無視して未読の札と比べることになる。
    """
    for b in blocks:
        for n in names:
            v = field(b, n)
            if v and u"未読" not in v[:20]:
                return v
    return None


def old_svgs(fields):
    out = []
    for k, n, v in fields:
        if k != u"図SVG" or old.is_empty_svg_field(v):
            continue
        b = old.svg_body(v)
        if b:
            out.append(b)
    return out


def svg_syntax(svg):
    bad = []
    try:
        root = ET.fromstring(svg)
    except Exception as e:
        return [u"XMLとして読めない: %s" % e]
    if not root.get(u"viewBox"):
        bad.append(u"viewBox が無い")
    for t in root.iter():
        if t.tag.endswith(u"text") and not t.get(u"fill"):
            bad.append(u"<text> に fill が無い: %r" % (t.text or u"")[:16])
    return bad


def kotae_full(it):
    u"""答えの原文（注記をふくむ）。

    ★新形式は「本文」と「注記」を別の欄に分けて持つ。片方だけを旧と比べると
      「消えた」に見えるので、**合わせてから**突き合わせる（＝欠落が無いことの検査）。
    """
    s = it[u"kotae"].get(u"text") or u""
    for n in it.get(u"notes") or []:
        if (n.get(u"text") or u"").startswith(u"答えの注記:"):
            s += n[u"text"].split(u":", 1)[1]
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trial-dir", required=True)
    a = ap.parse_args()
    trial = assert_safe_out_dir(a.trial_dir)

    pick = json.load(io.open(os.path.join(trial, u"pick10.json"), encoding=u"utf-8"))
    g1 = {}
    for f in sorted(glob.glob(os.path.join(trial, u"g1", u"*.json"))):
        for it in json.load(io.open(f, encoding=u"utf-8"))[u"items"]:
            g1[it[u"hg"]] = it
    joined = {x[u"hg"]: x for x in json.load(
        io.open(os.path.join(trial, u"out", u"daimon.json"), encoding=u"utf-8"))}

    def load(name, default):
        p = os.path.join(trial, u"out", name)
        return json.load(io.open(p, encoding=u"utf-8")) if os.path.isfile(p) else default

    # ★結合側が「未完成」と札を立てたものは、**欠落・改変とは別に数える**。
    #   止まるべきものが止まったのは正しい動きであって、不合格ではない。
    incomplete = load(os.path.join(u"incomplete", u"reasons.json"), {})
    coverage = load(u"coverage.json", {})
    run = load(u"run.json", {})

    ng1, ng2, notes = [], [], []          # ①新経路の欠落・改変 ②既存側との差
    svgmap = {}

    bysrc = {}
    for p in pick[u"items"]:
        bysrc.setdefault(p[u"hg"], []).append(p)

    for hg, srcs in bysrc.items():
        it = g1.get(hg)
        if not it:
            ng1.append(u"%s: 新形式に無い" % hg)
            continue
        blocks = old_blocks(srcs)
        if not blocks:
            ng1.append(u"%s: 旧成果物に見つからない" % hg)
            continue
        fields = blocks[0]

        # ① 設問の原文
        o_set = field_any(blocks, u"設問") or u""
        n_set = u"\n".join([it[u"setsumon"][u"common"] or u""] +
                           [q[u"text"] for q in it[u"setsumon"][u"questions"]])
        if ws(o_set) != ws(n_set):
            ng1.append(u"%s: 設問が一致しない" % hg)
        elif nl(o_set) != nl(n_set):
            notes.append(u"%s: 設問は文字は同じだが改行・空白が違う" % hg)

        # ① 数値
        o_all = (o_set or u"") + (field_any(blocks, u"答え", u"解答") or u"")
        n_all = n_set + kotae_full(it)
        if nums(o_all) != nums(n_all):
            d = set(nums(o_all).items()) ^ set(nums(n_all).items())
            ng1.append(u"%s: 数値が一致しない %s" % (hg, sorted(d)[:6]))

        # ① 答え（原文と、分けた枠の中身）
        o_ans = field_any(blocks, u"答え", u"解答") or u""
        if it[u"kotae"][u"state"] == u"ok":
            if ws(o_ans) != ws(kotae_full(it)):
                ng1.append(u"%s: 答えの原文（注記こみ）が一致しない" % hg)
            for s in it[u"kotae"][u"slots"]:
                if ws(s[u"text"]) and ws(s[u"text"]) not in ws(o_ans):
                    ng1.append(u"%s: 答えの枠 %s の中身が原文に無い" % (hg, s[u"aid"]))

        # ① 選択肢（記号と本文の対応・順序）
        o_ch, _ = old.parse_choices(o_set)
        n_ch = it[u"setsumon"][u"choices"]
        if [(c[u"sym"], ws(c[u"text"])) for c in o_ch] != [(c[u"sym"], ws(c[u"text"])) for c in n_ch]:
            ng1.append(u"%s: 選択肢の記号と本文の対応か順序が違う" % hg)

        # ① 小問の順
        labs = [ws(q[u"label"] or u"") for q in it[u"setsumon"][u"questions"]]
        if labs != sorted(labs, key=lambda s: o_set.find(s)):
            ng1.append(u"%s: 小問の並びが原文と違う" % hg)

        # ① SVG（バイト一致・枚数・構文）
        o_sv = []
        for b in blocks:
            for s in old_svgs(b):
                if nl(s) not in [nl(x) for x in o_sv]:
                    o_sv.append(s)
        n_sv = []
        for f in it[u"figures"]:
            if f.get(u"svg_ref"):
                n_sv.append(io.open(os.path.join(trial, f[u"svg_ref"]),
                                    encoding=u"utf-8").read())
        # ★欄よみを通さず、旧ブロックの生テキストから <svg を数える。
        #   旧側と新側が同じ関数を使うと、両方0枚でも「一致」になってしまう
        #   （2026-09-13、HG-7930 の図4枚をそれで見落とした）。
        raw = 0
        for p2 in srcs:
            txt = io.open(os.path.join(old.OLD_DIR, p2[u"file"]), encoding=u"utf-8").read()
            for head, body in old.split_items(txt):
                if old.parse_label(head)[0] == p2[u"label"]:
                    raw = max(raw, body.count(u"<svg"))
                    break
        if raw != len(n_sv):
            ng1.append(u"%s: 生のSVGの数が合わない（旧の本文に<svg が%d / 新は%d枚）"
                       % (hg, raw, len(n_sv)))
        if len(o_sv) != len(n_sv):
            ng1.append(u"%s: SVGの枚数が違う（旧%d / 新%d）" % (hg, len(o_sv), len(n_sv)))
        for i, (o, n) in enumerate(zip(o_sv, n_sv), 1):
            if nl(o) != nl(n):
                ng1.append(u"%s: %d枚目のSVGが一致しない" % (hg, i))
        for i, n in enumerate(n_sv, 1):
            for b in svg_syntax(n):
                ng1.append(u"%s: %d枚目のSVGの構文 — %s" % (hg, i, b))
            svgmap[u"%s_f%d" % (hg, i)] = n

        # ① 結合出力（二重表示・答えの出どころ）
        x = joined.get(hg)
        if not x:
            if hg not in incomplete:
                ng1.append(u"%s: 結合出力に無い" % hg)
        else:
            for q in it[u"setsumon"][u"questions"]:
                if ws(q[u"text"]) and ws(q[u"text"]) in ws(x[u"intro"] or u""):
                    ng1.append(u"%s: intro に小問文が入っている（二重表示）" % hg)
            # ★答えは「枠まるごと」だけでなく、印刷ラベルつきの値・単位で取り出した値もある。
            #   取り出せる形をぜんぶ並べ、そのどれかと**完全一致**しているかを見る。
            allowed = []
            for s in it[u"kotae"][u"slots"]:
                allowed.append(s[u"text"])
                allowed += list((s.get(u"unit_index") or {}).values())
                for v in (s.get(u"values") or []):
                    allowed.append(v[u"text"])
                    allowed += list(jn.unit_index(v[u"text"])[0].values())
            for st in x[u"steps"]:
                if ws(st[u"answer"]) not in [ws(v) for v in allowed]:
                    ng1.append(u"%s: 結合した答え %r が G1 の枠に無い" % (hg, st[u"answer"]))

        # ② 既存側との差（参考）
        g = io.open(find_genbo(), encoding=u"utf-8").read()
        body = next((g[s:e] for h, s, e in gc.split_records(g) if h == hg), None)
        if body and ws(gc.rec_field(body, u"設問") or u"") != ws(n_set):
            ng2.append(u"%s: 既存の原簿の設問と差がある" % hg)
        if body and ws(gc.rec_field(body, u"答え") or u"") != ws(kotae_full(it)):
            ng2.append(u"%s: 既存の原簿の答えと差がある" % hg)

    d = json.load(io.open(DAIMON, encoding=u"utf-8"))
    appmap = {}
    for r in gc.iter_daimon(d):
        x = r["x"] if isinstance(r, dict) and "x" in r else r
        hgs = gc.hgof(x)
        if hgs:
            appmap[hgs[0]] = x
    for hg, x in joined.items():
        y = appmap.get(hg)
        if not y:
            continue
        if ws(y.get(u"intro")) != ws(x.get(u"intro")):
            ng2.append(u"%s: 既存アプリの intro と差がある" % hg)
        if len(y.get(u"steps") or []) != len(x[u"steps"]):
            ng2.append(u"%s: 既存アプリの小問数と違う（既存%d / 新%d）"
                       % (hg, len(y.get(u"steps") or []), len(x[u"steps"])))

    out = os.path.join(trial, u"out")
    os.makedirs(out, exist_ok=True)
    io.open(os.path.join(out, u"svg_for_check.json"), u"w", encoding=u"utf-8",
            newline=u"\n").write(json.dumps(svgmap, ensure_ascii=False, indent=1) + u"\n")

    excluded = [(hg, r) for hg, rows in sorted(coverage.items()) for r in rows
                if r.get(u"status") == u"excluded"]
    done_hgs = sorted(joined)

    lines = [u"# 試行10問の判定", u""]
    # 🚨 何を確かめた判定なのかを、いちばん上に書く（読みちがえを防ぐ）
    lines += [u"> **これは「旧データを新形式へ移し替えられるか」の試行の判定です。**",
              u"> 確かめたのは**転記・結合の忠実性**だけで、原本PDFは開いていません。",
              u"> " + (u"しかも `--allow-unread-kaihou` を付けて、**印刷された解法が未取得のまま**"
                       u"通しています（既定の strict では10本とも未完成）。"
                       if run.get(u"allow_unread_kaihou") else
                       u"既定（strict）で通しました。" if run else
                       u"⚠ どの条件で結合したかの記録（`out/run.json`）が無いので、"
                       u"**strict で通したのかどうか分かりません**。`g1_join.py` から通し直すこと。"),
              u"> **したがってこの合格は「本番に入れてよい」という意味ではありません。**", u""]
    lines += [u"## 数（実測）", u"",
              u"| | 本数 |", u"|---|---|",
              u"| 合格（全必須検査を通った） | %d |" % len(done_hgs),
              u"| 未完成（止めた） | %d |" % len(incomplete),
              u"| 意図的に除外した回答箇所 | %d |" % len(excluded), u""]

    lines += [u"## 🚧 未完成（止まったもの）", u""]
    if not incomplete:
        lines += [u"- なし"]
    for hg, why in sorted(incomplete.items()):
        lines += [u"- **%s**" % hg] + [u"  - %s" % t for t in (why or [u"理由の記録が無い"])]
    lines += [u""]

    lines += [u"## 🚫 意図的に除外した回答箇所（理由は既存の記録から引き継いだもの）", u""]
    if not excluded:
        lines += [u"- なし"]
    for hg, r in excluded:
        lines += [u"- **%s %s** ← %s" % (hg, r.get(u"label"), r.get(u"source")),
                  u"  - %s" % (r.get(u"reason") or u"")]
    lines += [u""]

    lines += [u"## ① 新経路の欠落・改変（**これが合否**）", u""]
    lines += ([u"- ✅ なし"] if not ng1 else [u"- 🚩 " + t for t in ng1])
    lines += [u"", u"## ② 既存の原簿・アプリとの差（参考）", u""]
    lines += ([u"- なし"] if not ng2 else [u"- " + t for t in ng2])
    if notes:
        lines += [u"", u"## 参考（文字は同じだが形が違う）", u""] + [u"- " + t for t in notes]
    lines += [u"", u"## SVGの表示確認",
              u"`python scripts/check_svg_json.py docs/_genbo/_trial10/out/svg_for_check.json` で実測する",
              u"（%d枚）" % len(svgmap), u""]
    io.open(os.path.join(out, u"report.md"), u"w", encoding=u"utf-8",
            newline=u"\n").write(u"\n".join(lines))

    print(u"合格 %d本 ／ 未完成 %d本 ／ 意図的に除外した回答箇所 %d件"
          % (len(done_hgs), len(incomplete), len(excluded)))
    for hg, why in sorted(incomplete.items()):
        print(u"   🚧 %s: %s" % (hg, (why or [u""])[0]))
    for hg, r in excluded:
        print(u"   🚫 %s %s ← %s" % (hg, r.get(u"label"), r.get(u"source")))
    print(u"① 新経路の欠落・改変: %d件" % len(ng1))
    for t in ng1:
        print(u"   🚩", t)
    print(u"② 既存側との差（参考）: %d件" % len(ng2))
    for t in ng2[:20]:
        print(u"   ・", t)
    fin = os.path.join(out, u"final")
    if ng1:
        if os.path.isdir(fin):
            for f in os.listdir(fin):
                os.remove(os.path.join(fin, f))
        print(u"→ 必須検査を通っていないので out/final/ は作らない（完成品は無し）")
    else:
        os.makedirs(fin, exist_ok=True)
        for name in (u"genbo_records.md", u"daimon.json"):
            io.open(os.path.join(fin, name), u"w", encoding=u"utf-8", newline=chr(10)).write(
                io.open(os.path.join(out, name), encoding=u"utf-8").read())
        print(u"→ 全必須検査を通ったので out/final/ に完成品を出した")
    print(u"→ out/report.md ／ SVG %d枚を out/svg_for_check.json に出した" % len(svgmap))
    sys.exit(1 if ng1 else 0)


if __name__ == "__main__":
    main()
