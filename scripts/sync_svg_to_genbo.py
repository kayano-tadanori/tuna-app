# -*- coding: utf-8 -*-
"""アプリ（hama_daimon.json）の svg を、原簿の「- 図SVG…:」欄へ**書き戻す**。

★ふだんの向きは逆（原簿 → アプリ ＝ scripts/sync_genbo_svg.py）。図の源は原簿ひとつ。
  こちらは「原簿の図が実物と別物だと分かって、アプリ側で原本PDFどおりに描き直した」
  ときだけ使う逆流用。書き戻さないと、次に sync_genbo_svg.py を流した瞬間に
  直した図が誤図へ戻る（2026-09-04にこの道具を作った理由）。

★図は大問だけのものではない。アプリは js/sansu.js の `svg: step.svg || chain.svg` で
  **小問（step）側の図を先に出す**。2026-09-04の時点でこの道具は大問の x["svg"] しか
  見ておらず、小問の図220問（別々の図でいうと170枚）が1枚も戻せなかったので塞いだ。

★欄を見つける処理も、小問の図と欄の対応づけも scripts/genbo_common.py に1つだけ置く
  （find_svg_fields / step_svgs / match_step_svgs）。sync_genbo_svg.py と共有していて、
  ここにはコピーを置かない。

小問の図と原簿の欄の対応の決め方（genbo_common.match_step_svgs）:
  アプリの小問の図を「出てくる順・重複なし」に並べ、原簿の**かっこ書きつきの**欄
  （「- 図SVG（(1)）:」など）の並びと**出てくる順に1対1**で結ぶ。数が合わなければ書かない。

書かずに報告するもの（機械で決められない・決めてはいけないもの）:
  ・かっこ書きの無い図SVG欄が2つ以上あるレコード … どれが大問の図か決められない
  ・小問の図の枚数と、かっこ書きつきの欄の数が合わないレコード
  ・図SVG欄が無いもの … 欄をどこに足すかは人が決める（--add-missing で足せる）
  ・「判読不能」と書いてある欄 … 読めないという判断を機械で消さない
  ・アプリ側に svg が無い大問

使い方:
  python scripts/sync_svg_to_genbo.py                       … 既定の一覧でドライラン
  python scripts/sync_svg_to_genbo.py --write               … 実際に原簿へ書く
  python scripts/sync_svg_to_genbo.py hd5s_00_1 hd5s_00_2   … idを直に指定
  python scripts/sync_svg_to_genbo.py --all-steps           … 小問に図があるアプリの大問ぜんぶ
  python scripts/sync_svg_to_genbo.py --ids somefile.txt --exclude hd4n_03_7

⚠原簿は別セッションも編集している。読み込み→書き戻しは1プロセスの中で短く済ませ、
  書く直前に「読んだときから1バイトも変わっていないか」を確かめてから書く。
  書いたあとはバイト数の増減が見積もりと合うかを必ず表示する。
⚠書き出しは io.open(path, "wb")。"w" だと Windows で改行が CRLF に化けて全行が差分になる。
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common
from genbo_path import find_genbo

DEFAULT_IDS = os.path.join(BASE, "docs", "_audit", "svg_changed_ids.txt")
BQ = chr(96)
NLC = chr(10)


def norm_nl(t):
    u"""比較用に 
・ を 
 にそろえる。

    ★原簿はほぼ全体がCRLF、アプリの svg（JSON文字列）は 
 だけ。
      rb + decode で原簿を読む（CRLF方式にする理由は下のコメントのとおり）ので、
      素の文字列比較だと**中身が同じでも「ちがう」と誤判定する**
      （2026-09-04・小問の図を書き戻す実装中に実際に踏んだ。fence/inline とも
      複数行のSVGは原簿側がCRLFのまま残っていた）。
    """
    return t.replace(chr(13) + chr(10), NLC).replace(chr(13), NLC)


def to_file_nl(svg, nl):
    u"""アプリの svg（
区切り）を、原簿の改行スタイル（nl。多くはCRLF）に合わせて書く。

    ★変換しないと、書いた欄だけ 
・まわりはCRLFという混在ファイルになる。
      sync_genbo_svg.py（原簿→アプリ）は原簿をテキストモード（改行を自動で
にそろえて
      読む）で開くので実害は無いが、原簿そのものの見た目・次回の比較を素直にするため
      ファイルの改行スタイルにそろえておく。
    """
    return svg if nl == NLC else svg.replace(NLC, nl)
ADDED_NOTE = ("- ⚠図SVGは2026-09-04にアプリ側"
              "（原本PDFと照合して描き直したもの）から書き戻した")


def app_daimon(ids):
    """アプリ側の大問データから {id: (大問, HG番号)} を返す。"""
    d = genbo_common.load_daimon()
    want = set(ids)
    out = {}
    for r in genbo_common.iter_daimon(d):
        x = r["x"]
        i = x.get("id")
        if i in want:
            if i in out:
                print("⚠ アプリに同じ id が2つある: %s" % i)
            h = genbo_common.hgof(x)
            out[i] = (x, (h[0] if h else None))
    return out


def ids_with_step_svgs():
    """小問（step）に図をもつ大問の id をぜんぶ返す（--all-steps 用）。"""
    d = genbo_common.load_daimon()
    return [r["x"].get("id") for r in genbo_common.iter_daimon(d)
            if genbo_common.step_svgs(r["x"])]


def field_replacement(field, svg, nl):
    """欄の中身を svg に置きかえる (開始, 終わり, 新しい文字) を返す。

    ★改行を含むSVGを「バッククォート無しの生SVG」欄に入れると、次に読むとき
      そこで切れる。そのときだけバッククォートで囲む形に直す
      （find_svg_fields は閉じバッククォートを次のレコードの手前まで探すので読める）。
    ★svg は to_file_nl() で原簿の改行スタイル（nl）にそろえてから差しこむ
      （原簿はCRLF・アプリの svg は\\nだけ＝そろえないと欄の中だけ改行が混ざる）。
    """
    svg = to_file_nl(svg, nl)
    if field["style"] == "fence":
        return field["vs"], field["ve"], svg
    if field["style"] == "bare" and NLC in svg:
        return field["hdr_end"], field["field_end"], " " + BQ + svg + BQ
    return field["vs"], field["ve"], svg


def insert_point(body, fields):
    """新しい図SVG欄を差しこむ位置（body内・行の頭）を返す。

    ★行の頭に差しこむ（行末の CR と LF の間に入れると改行が壊れる。
      2026-09-04に HG-1262 で実際にやってしまった）。
    ★すでに図SVG欄があるレコードでは、**いちばん最後の欄の直後**に足す
      （大問の図のあとに小問の図が並ぶ＝原簿の見た目がそろう）。
      その欄に付いている「⚠…書き戻した」の注記は飛びこえる（注記が新しい欄の
      説明のように見えてしまうため）。
    """
    if fields:
        pos = max(f["field_end"] for f in fields)
        nl = body.find(NLC, pos)
        pos = len(body.rstrip()) if nl < 0 else nl + 1
        while True:
            nl = body.find(NLC, pos)
            line = body[pos:len(body) if nl < 0 else nl]
            if not line.startswith("- ⚠図SVG"):
                return pos
            if nl < 0:
                return len(body)
            pos = nl + 1
    j = -1
    for key in ("- 図: ", "- 図SVG", "- 設問: ", "- 設定/設問: ", "- 設定: "):
        j = body.find(NLC + key)
        if j >= 0:
            break
    if j < 0:
        return len(body.rstrip())
    nl = body.find(NLC, j + 1)
    return len(body.rstrip()) if nl < 0 else nl + 1


def added_field_text(label, svg, fence, nl):
    """新しく足す欄1つぶんの文字列。

    ★大問の欄（かっこ書き無し）は原簿でいちばん多い書き方＝バッククォート囲みの1行。
      小問の欄（かっこ書きつき）は実測163欄のうち大半がコードブロックなので
      そちらにそろえる。
    ★svg の中の改行も nl にそろえる（外側の区切りだけ nl にすると、欄の中だけ
      \\nが残って混ざる）。
    """
    svg = to_file_nl(svg, nl)
    if fence:
        return label + nl + (BQ * 3) + "html" + nl + svg + nl + (BQ * 3) + nl
    return label + " " + BQ + svg + BQ + nl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="大問の id（省略すると --ids のファイル）")
    ap.add_argument("--ids", dest="idfile", default=None,
                    help="idを1行1個で並べたファイル（既定 docs/_audit/svg_changed_ids.txt）")
    ap.add_argument("--all-steps", action="store_true",
                    help="小問（step）に図をもつアプリの大問をぜんぶ対象にする")
    ap.add_argument("--exclude", action="append", default=[], help="除く id（何度でも）")
    ap.add_argument("--add-missing", action="store_true",
                    help="図SVG欄が無いレコードに欄を新しく足す（既定は足さずに報告だけ）")
    ap.add_argument("--write", action="store_true", help="実際に原簿へ書く")
    args = ap.parse_args()

    ids = list(args.ids)
    if args.all_steps:
        more = [i for i in ids_with_step_svgs() if i not in set(ids)]
        print("小問に図をもつ大問 %d本を対象に足した" % len(more))
        ids += more
    if not ids:
        path = args.idfile or DEFAULT_IDS
        ids = [l.strip() for l in io.open(path, encoding="utf-8") if l.strip()]
        print("id一覧: %s（%d本）" % (path, len(ids)))
    ids = [i for i in ids if i not in set(args.exclude)]
    if args.exclude:
        print("除いた id: %s" % " ".join(args.exclude))

    got = app_daimon(ids)
    missing_in_app = [i for i in ids if i not in got]

    gpath = find_genbo()
    raw0 = io.open(gpath, "rb").read()
    g = raw0.decode("utf-8")
    CRLF = chr(13) + chr(10)
    NL = CRLF if CRLF in g[:5000] else NLC
    recs = {hg: (s, e) for hg, s, e in genbo_common.split_records(g)}
    print("原簿: %s" % gpath)
    print("      %d バイト・%d レコード" % (len(raw0), len(recs)))

    plans, holds, same, adds = [], [], [], {}
    for i in ids:
        if i not in got:
            continue
        x, hg = got[i]
        if not hg:
            holds.append((i, "-", "-", "アプリに原簿番号（hg/src）が無い"))
            continue
        if hg not in recs:
            holds.append((i, hg, "-", "原簿にレコードが無い"))
            continue
        s, e = recs[hg]
        body = g[s:e]
        fields = genbo_common.find_svg_fields(body)
        xsvg = (x.get("svg") or "").strip()
        steps = genbo_common.step_svgs(x)

        def plan_set(f, svg, what, _i=i, _hg=hg, _s=s):
            if f["value"].strip() == "判読不能":
                holds.append((_i, _hg, what, "原簿が「判読不能」と書いている"))
                return
            # ★原簿はCRLF・アプリの svg は\nだけ＝素の文字列比較だと中身が同じでも
            #   「ちがう」と出る（2026-09-04に実際に踏んだ）。norm_nl でそろえて比べる。
            if norm_nl(f["value"].strip()) == norm_nl(svg):
                same.append((_i, _hg, what))
                return
            vs, ve, new = field_replacement(f, svg, NL)
            plans.append({"id": _i, "hg": _hg, "what": what, "kind": "set",
                          "style": f["style"], "abs": (_s + vs, _s + ve), "new": new,
                          "old_len": ve - vs, "svg": svg})

        def plan_add(label, svg, what, fence, _i=i, _hg=hg, _s=s, _e=e, _f=fields):
            adds.setdefault(_hg, {"id": _i, "rec": (_s, _e), "fields": _f, "items": []})
            adds[_hg]["items"].append((label, svg, fence))
            plans.append({"id": _i, "hg": _hg, "what": what, "kind": "add",
                          "style": "(新設)", "old_len": 0, "svg": svg, "add_of": _hg})

        # ── 大問じたいの図（かっこ書きの無い欄）──────────────────────
        unq = [f for f in fields if f["qual"] is None]
        if not xsvg:
            if not steps:
                holds.append((i, hg, "大問", "アプリ側に svg が無い"))
        elif len(unq) > 1:
            holds.append((i, hg, "大問",
                          "かっこ書きの無い図SVG欄が%d個ある＝どれを直すか機械で決められない"
                          % len(unq)))
        elif unq:
            plan_set(unq[0], xsvg, "大問")
        elif xsvg and any(norm_nl(f["value"].strip()) == norm_nl(xsvg) for f in fields):
            # ★かっこ書きつきの欄（小問用）に、たまたま大問の図と同じ中身が入っていることがある
            #   （hd_5r_k08_641_4＝「（1）」欄が実は大問の図だった）。この場合は「欄が無い」の
            #   ではなく「もう入っている」なので、--add-missing でも二重には足さない。
            same.append((i, hg, "大問（かっこ書きの欄に同じ中身がある）"))
        elif args.add_missing:
            plan_add("- 図SVG:", xsvg, "大問", False)
        else:
            holds.append((i, hg, "大問", "図SVG欄が無い（--add-missing で足せる）"))

        # ── 小問（step）の図（かっこ書きつきの欄）────────────────────
        if steps:
            pairs, extra, why = genbo_common.match_step_svgs(fields, steps, xsvg)
            if why:
                holds.append((i, hg, "小問", why))
            else:
                for f, v in pairs:
                    plan_set(f, v, "小問%s" % (f["qual"] or ""))
                for no, v in extra:
                    what = "小問(%d)" % no
                    if args.add_missing:
                        plan_add("- 図SVG（(%d)）:" % no, v, what, True)
                    else:
                        holds.append((i, hg, what,
                                      "図SVG欄が無い（--add-missing で足せる）"))

    # ★同じレコードへの新設は1か所にまとめて差しこむ（別々に入れると位置がぶつかる）
    for hg, a in adds.items():
        s, e = a["rec"]
        pos = insert_point(g[s:e], a["fields"])
        text = "".join(added_field_text(lb, sv, fc, NL) for lb, sv, fc in a["items"])
        for p in plans:
            if p["kind"] == "add" and p["add_of"] == hg:
                p["abs"] = (s + pos, s + pos)
                p["new"] = (text + ADDED_NOTE + NL) if text else ""
                text = ""      # ★同じレコードの2本目からは中身を持たせない（二重書き防止）

    print("")
    print("■ 書き戻す: %d本" % len(plans))
    for p in sorted(plans, key=lambda q: (q["id"], q["what"])):
        print("   %-14s %-9s %-12s %-8s %d字 → %d字"
              % (p["id"], p["hg"], p["what"], p["style"], p["old_len"], len(p["svg"])))
    print("■ すでに一致: %d本" % len(same))
    print("■ 書かずに保留: %d本" % (len(holds) + len(missing_in_app)))
    for i in missing_in_app:
        print("   %-14s %-9s %-12s %s" % (i, "-", "-", "アプリに その id の大問が無い"))
    for i, hg, what, why in sorted(holds):
        print("   %-14s %-9s %-12s %s" % (i, hg, what, why))

    if not args.write:
        print("")
        print("（--write を付けると実際に書き込みます）")
        return
    if not plans:
        print("")
        print("書くものが無いので、原簿には触りません。")
        return

    plans.sort(key=lambda p: p["abs"][0])
    for a, b in zip(plans, plans[1:]):
        if a["abs"][1] > b["abs"][0]:
            print("✗ 置きかえ範囲が重なっている（%s と %s）。書きません。" % (a["hg"], b["hg"]))
            return
    out, prev = [], 0
    for p in plans:
        a, b = p["abs"]
        out.append(g[prev:a])
        out.append(p["new"])
        prev = b
    out.append(g[prev:])
    ng = "".join(out)
    nraw = ng.encode("utf-8")

    nrecs = genbo_common.split_records(ng)
    if len(nrecs) != len(recs):
        print("✗ レコード数が %d → %d に変わった。書きません。" % (len(recs), len(nrecs)))
        return
    nmap = {hg: (s, e) for hg, s, e in nrecs}
    ok = True
    touched = {}
    for p in plans:
        touched.setdefault(p["hg"], []).append(p)
    for hg, ps in touched.items():
        s, e = nmap[hg]
        fs = genbo_common.find_svg_fields(ng[s:e])
        x = got[ps[0]["id"]][0]
        xsvg = (x.get("svg") or "").strip()
        pairs, extra, why = genbo_common.match_step_svgs(
            fs, genbo_common.step_svgs(x), xsvg)
        want_step = set(p["svg"] for p in ps if p["what"].startswith("小問"))
        want_dai = [p["svg"] for p in ps if p["what"] == "大問"]
        if want_step and (why or extra):
            ok = False
            print("✗ 自己検査で落ちた: %s（読み直すと小問の対応がつかない: %s）"
                  % (hg, why or ("余り%d枚" % len(extra))))
            continue
        # ★書いた欄は原簿の改行（多くはCRLF）にそろえてある。want_step 側はアプリの
        #   \n のままなので、比べる前に norm_nl でそろえる（さもないと読み直せているのに
        #   「読み直せない」と誤検出する）。
        want_step_n = set(norm_nl(v) for v in want_step)
        seen = set(norm_nl(f["value"].strip()) for f, v in (pairs or []) if v in want_step)
        if want_step_n - seen:
            ok = False
            print("✗ 自己検査で落ちた: %s（小問の図%d枚が読み直せない）"
                  % (hg, len(want_step_n - seen)))
        if want_dai:
            unq = [f for f in fs if f["qual"] is None]
            if len(unq) != 1 or norm_nl(unq[0]["value"].strip()) != norm_nl(want_dai[0]):
                ok = False
                print("✗ 自己検査で落ちた: %s（大問の欄%d個・読み直した値が一致しない）"
                      % (hg, len(unq)))
    if not ok:
        print("✗ 原簿には書きません。")
        return

    guess = len(nraw) - len(raw0)
    now = io.open(gpath, "rb").read()
    if now != raw0:
        print("✗ 読んでから今までの間に、別のだれかが原簿を書きかえている"
              "（%d → %d バイト）。今回は書きません。もう一度流してください。"
              % (len(raw0), len(now)))
        return
    io.open(gpath, "wb").write(nraw)
    after = os.path.getsize(gpath)
    print("")
    print("✅ 書き込み完了: %d本" % len(plans))
    print("   バイト数 %d → %d（増減 %+d ／ 見積もり %+d）%s"
          % (len(raw0), after, after - len(raw0), guess,
             "  ✔一致" if after - len(raw0) == guess else "  ✗合わない！"))


if __name__ == "__main__":
    main()
