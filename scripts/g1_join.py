# -*- coding: utf-8 -*-
u"""G1の構造化データ ＋ G2/G3のパッチ → 原簿レコード と アプリ大問JSON を**機械で**組み立てる。

  python scripts/g1_join.py --trial-dir docs/_genbo/_trial10

★AIが書くのは判断ぶん（骨・コア発見・分類・子ども向け解説）だけ。
  **設問・答え・SVGはここで機械が入れる。**G2/G3はこれらを再出力しない。
★小問は qid、答える場所は aid、図は fid で結ぶ。決められないものは**書かずに報告**する。
★出力先は `g1_guard` を通す。本番の原簿・アプリデータには書けない。
"""
import argparse
import glob
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from g1_guard import assert_safe_out_dir                   # noqa: E402
from g1_units import unit_index, meaning_tokens             # noqa: E402
import g1_validate as val                                   # noqa: E402


def load_g1(trial):
    out = []
    for f in sorted(glob.glob(os.path.join(trial, u"g1", u"*.json"))):
        doc = json.load(io.open(f, encoding=u"utf-8"))
        for it in doc[u"items"]:
            out.append((doc, it))
    return out


def read_svg(trial, ref):
    p = os.path.join(trial, ref.replace(u"/", os.sep))
    s = io.open(p, encoding=u"utf-8").read().strip()
    if not s.startswith(u"<svg") or not s.endswith(u"</svg>"):
        raise ValueError(u"SVGの形になっていない: %s" % ref)
    return s


def setsumon_text(it):
    u"""原簿の `- 設問:` に入れる原文（共通文＋印刷された小問）。"""
    parts = [it[u"setsumon"][u"common"] or u""]
    parts += [q[u"text"] for q in it[u"setsumon"][u"questions"]]
    return u"\n".join(p for p in parts if p).strip()


def zu_line(it):
    figs = it[u"figures"]
    ok = [f for f in figs if f[u"state"] == u"ok" and f[u"where"] == u"mondai"]
    kai = [f for f in figs if f[u"where"] == u"kaisetsu"]
    bad = [f for f in figs if f[u"state"] == u"unreadable"]
    if ok:
        s = u"あり（問題ページに%d枚）" % len(ok)
        if bad:
            s += u"／" + u"／".join(u"判読不能: %s" % (f[u"reason"] or u"") for f in bad)
        return s
    if bad:
        return u"なし（" + u"／".join(u"判読不能: %s" % (f[u"reason"] or u"") for f in bad) + u"）"
    if kai:
        return u"なし（本文に図は無い。解答の解説にのみ図がある）"
    return u"なし"


def line(name, value):
    u"""原簿の1欄を書く。2行目からは字下げして、次の欄と見まちがえないようにする。

    ★字下げしないと「- (1) …」のような続きの行が、欄の始まりに見えてしまう
      （2026-09-13の試行で実際にそうなった）。欄よみは行頭の「- 名前:」で切るため。
    """
    NL = chr(10)
    v = (value or u"").replace(chr(13) + NL, NL).split(NL)
    head = u"- %s: %s" % (name, v[0])
    return NL.join([head] + [u"  " + x for x in v[1:]])


import re


def take_answer(slot, ref, where, problems):
    u"""印刷された答えから、その小問のぶんを**機械で取り出す**。

    ★取り出せる形は3つだけ。どれも印刷された文字から取るもので、作り出した値は無い。
      ① 枠まるごと ② 印刷ラベルつきの値（案A・ref_vid） ③ その単位が付く値（案B・take_unit）
    ★一意に決まらないものは取り出さない（表に無い単位表記、同じ単位が2回出る など）。
    返すのは (取り出した答え, 見出しに使う語, 使った単位の鍵)。
    """
    txt, part, ukey = slot[u"text"], None, None
    if ref.get(u"ref_vid"):
        vs = [v for v in (slot.get(u"values") or []) if v[u"vid"] == ref[u"ref_vid"]]
        if len(vs) != 1:
            problems.append(u"%s: 印刷ラベルつきの値 %s が答えの枠に無い"
                            % (where, ref[u"ref_vid"]))
            return None, None, None
        txt, part = vs[0][u"text"], vs[0][u"label"]
    if ref.get(u"take_unit"):
        idx, why = unit_index(txt)
        un = ref[u"take_unit"]
        if why:
            problems.append(u"%s: 単位で取り出せない（%r）— %s" % (where, txt, why))
            return None, None, None
        if un not in idx:
            problems.append(u"%s: 単位「%s」の値が答えの中で一意に決まらない（%r／取り出せるのは %s）"
                            % (where, un, txt, u"・".join(sorted(idx)) or u"無し"))
            return None, None, None
        # ★印刷ラベル（上り・下り）があるなら、そちらを見出しに使う。
        #   単位で上書きすると「(1)…［km］」が2つ並び、どちらを答えるのか分からなくなる
        #   （2026-09-13、画面で見て気づいた）
        txt, part, ukey = idx[un], (part or un), un
    if not (txt or u"").strip():
        problems.append(u"%s: 取り出した答えが空" % where)
        return None, None, None
    if re.sub(r"\s", u"", txt) not in re.sub(r"\s", u"", slot[u"text"]):
        problems.append(u"%s: 取り出した答え %r が印刷の答え %r の中に無い"
                        % (where, txt, slot[u"text"]))
        return None, None, None
    return txt, part, ukey


def build_genbo_record(doc, it, g2, problems, warnings):
    hg = it[u"hg"]
    p = g2.get(hg) or {}
    head = p.get(u"midashi") or u"%s %s No.%d %s" % (doc[u"material"], u"", doc[u"no"], it[u"label"])
    lines = [u"### 【%s】%s" % (hg, head)]
    for key, val in ((u"骨", p.get(u"hone")), (u"コア発見", p.get(u"core")),
                     (u"設定", p.get(u"settei"))):
        if val:
            lines.append(line(key, val))
    lines.append(line(u"設問", setsumon_text(it)))
    lines.append(line(u"図", zu_line(it)))

    for f in it[u"figures"]:
        if f[u"state"] != u"ok" or not f[u"svg_ref"]:
            continue
        if f[u"where"] == u"kaisetsu":
            continue
        qual = u"" if f[u"scope"] == u"item" else u"（(%s)）" % f[u"scope"][1:]
        lines.append(u"- 図SVG%s:" % qual)
        lines.append(f[u"_svg"])

    k = it[u"kotae"]
    lines.append(line(u"答え", k[u"text"] if k[u"state"] == u"ok" else u"★未読"))
    kh = it[u"kaihou_insatsu"]
    if kh[u"state"] == u"ok":
        lines.append(line(u"解法", kh[u"text"]))
    elif kh[u"state"] == u"none":
        lines.append(u"- 解法: （印刷された式は無い）")
    else:
        # ★これは「旧G1成果物にその欄が無い」＝**既存側の欠落**であって、
        #   新経路が落としたものではない。合否には数えず、警告として残す。
        warnings.append(u"%s: 印刷された解法が未取得（旧G1成果物にこの欄が無い）" % hg)
    # ★出典は原簿の正式な欄（どの教材の何回の何番か）。無いと現物に戻れない
    pg = it.get(u"page") or {}
    def _pg(name, label):
        v = pg.get(name) or {}
        a = [x for x in (u"印刷p%s" % v[u"print"] if v.get(u"print") else None,
                         u"PDF p%s" % v[u"pdf"] if v.get(u"pdf") else None) if x]
        return u"%s %s" % (label, u"／".join(a)) if a else None
    parts = [u"%s %s %s" % (doc[u"material"], u"No.%d" % doc[u"no"], doc.get(u"block") or u""),
             it[u"label"]]
    parts += [x for x in (_pg(u"mondai", u"問題"), _pg(u"kaitou", u"解答")) if x]
    lines.append(line(u"出典", u"　".join(x.strip() for x in parts if x)))

    ken = it[u"kenzan"]
    lines.append(line(u"検算", ken[u"memo"] or {u"itchi": u"一致", u"fuitchi": u"不一致",
                                               u"mi": u"★未"}[ken[u"result"]]))
    if it[u"notes"]:
        lines.append(line(u"備考", u"／".join(n[u"text"] for n in it[u"notes"])))
    if p.get(u"sakumon_memo"):
        lines.append(line(u"作問メモ", p[u"sakumon_memo"]))
    return u"\n".join(lines) + u"\n"


def answer_places(it):
    u"""原設問の**回答箇所**を全部ならべる。

    答える場所（aid）が1つでも、印刷ラベルで2つの値に分かれているなら（上り／下り）
    **回答箇所は2つ**。ここを枠だけで数えると、片方を落としても気づけない。
    """
    out = []
    for s in it[u"kotae"][u"slots"]:
        vs = s.get(u"values") or []
        if vs:
            for v in vs:
                out.append((s[u"aid"], v[u"vid"],
                            u"%s %s" % (s[u"label"] or s[u"aid"], v[u"label"])))
        else:
            out.append((s[u"aid"], None, s[u"label"] or s[u"aid"]))
    return out


def coverage_rows(it, p):
    u"""回答箇所ごとに「アプリ小問へ対応ずみ」「理由つきで意図的に除外」「どちらでもない」を決める。

    🚨 どちらでもないものが1つでもあれば、その大問は**未完成**。黙って落とさない。
    🚨 除外の理由は**ここで新しく判断しない**。既存の記録から引き継いだものだけを認める
       （`source` が空の除外はパッチ検査で弾く）。
    """
    covered = set()
    for st in (p.get(u"steps") or []):
        aid, vid = st.get(u"ref_aid"), st.get(u"ref_vid")
        for a, v, _ in answer_places(it):
            if a == aid and (vid is None or v is None or v == vid):
                covered.add((a, v))
    exc = {}
    for e in (p.get(u"exclusions") or []):
        exc[(e.get(u"aid"), e.get(u"vid"))] = e

    rows = []
    for a, v, label in answer_places(it):
        e = exc.get((a, v)) or (exc.get((a, None)) if v else None)
        if (a, v) in covered:
            rows.append({u"aid": a, u"vid": v, u"label": label, u"status": u"covered"})
        elif e:
            rows.append({u"aid": a, u"vid": v, u"label": label, u"status": u"excluded",
                         u"reason": e.get(u"reason"), u"source": e.get(u"source")})
        else:
            rows.append({u"aid": a, u"vid": v, u"label": label, u"status": u"unaccounted"})
    return rows


def build_daimon(doc, it, g3, problems, notes, rows=None):
    hg = it[u"hg"]
    p = g3.get(hg)
    if not p:
        problems.append(u"%s: G3のパッチが無い" % hg)
        return None
    if p.get(u"incomplete"):
        problems.append(u"%s: G3のパッチが未完成（小問と答えの枠の対応が決まっていない）" % hg)
        return None
    bad = [r for r in (rows or []) if r[u"status"] == u"unaccounted"]
    if bad:
        problems.append(u"%s: 回答箇所 %s が「アプリ小問へ対応ずみ」でも「理由つきの意図的除外」でも"
                        u"ない（どちらかに決まるまで未完成）"
                        % (hg, u"・".join(r[u"label"] for r in bad)))
        return None
    slots = {s[u"aid"]: s for s in it[u"kotae"][u"slots"]}
    qs = {q[u"qid"]: q for q in it[u"setsumon"][u"questions"]}
    # ★所属が確定していない図がある大問は、ここで止める。
    #   「たぶん大問共通だろう」と丸めると、(1)の図が全小問の上に出る（＝別の問題になる）
    unk = [f for f in it[u"figures"] if f[u"scope"] == u"unknown"]
    if unk:
        for f in unk:
            problems.append(u"%s: 図 %s の所属（大問か、どの小問か）が確定できない — %s"
                            % (hg, f[u"fid"], f.get(u"scope_reason") or u"理由の記録が無い"))
        return None
    figs_by_scope = {}
    for f in it[u"figures"]:
        if f[u"state"] != u"ok" or f[u"where"] != u"mondai" or not f.get(u"_svg"):
            continue
        figs_by_scope.setdefault(f[u"scope"], []).append(f)

    item_figs = figs_by_scope.get(u"item", [])
    if len(item_figs) > 1:
        problems.append(u"%s: 大問の図が%d枚あり、アプリの形（大問に1枚）に入りきらない"
                        % (hg, len(item_figs)))
        return None

    sole = False          # 設問全文そのものが問いかけになった大問（下で intro を空にする）
    shared = {}
    for st in p[u"steps"]:
        shared[st[u"ref_aid"]] = shared.get(st[u"ref_aid"], 0) + 1
    steps = []
    for i, st in enumerate(p[u"steps"], 1):
        aid = st[u"ref_aid"]
        if aid not in slots:
            problems.append(u"%s step%d: aid %s が G1 に無い" % (hg, i, aid))
            return None
        slot = slots[aid]
        qid = st.get(u"ref_qid")
        if qid:
            if qid not in qs:
                problems.append(u"%s step%d: qid %s が G1 に無い" % (hg, i, qid))
                return None
            # ★答える場所(aid)と小問(qid)の食いちがいを見る
            if slot.get(u"qid") and slot[u"qid"] != qid:
                problems.append(u"%s step%d: 答えの枠 %s は %s のものなのに %s を指している"
                                % (hg, i, aid, slot[u"qid"], qid))
                return None
            q_text = qs[qid][u"text"]
        else:
            q_text = slot[u"label"] or u""
            # 小問が1つも印刷されておらず、答える場所も1つだけの大問
            solo_item = (not qs) and len(it[u"kotae"][u"slots"]) == 1
            if not q_text:
                if solo_item and len(p[u"steps"]) == 1:
                    # ★1問だけなら、**設問全文そのものが問いかけ**。原文の文字をそのまま使う。
                    #   このとき intro は空にする（同じ文が2か所に出るため）。
                    #   （2026-09-13、テーマ教材の「角xを求めなさい」型で必要になった）
                    q_text = it[u"setsumon"][u"common"]
                    sole = True
                elif not solo_item:
                    problems.append(u"%s step%d: 問いかけを原文から決められない"
                                    u"（印刷された小問も、答える場所の表記も無い）" % (hg, i))
                    return None
                # ★1つの答えを月・日・曜日のように分けたときは、**設問全文を導入文に残し**、
                #   問いかけは見出し（［月］など）だけにする。全文を小問の数だけくり返すと、
                #   同じ3行が3回出て読みにくい（2026-09-13、画面で見て直した）
        # ★1つの答えの枠を2つ以上の小問が使うなら、**どの値を答えるのかがIDで決まって**
        #   いなければならない（ref_vid か take_unit）。無いまま通すと、2つの小問に
        #   同じ答えが入る（＝どちらかが必ず間違い）
        if shared.get(aid, 0) > 1 and not (st.get(u"ref_vid") or st.get(u"take_unit")):
            problems.append(u"%s step%d: 答えの枠 %s を%d個の小問が使うのに、どの値を答えるかが"
                            u"vid でも単位でも指定されていない" % (hg, i, aid, shared[aid]))
            return None
        ans, part, ukey = take_answer(slot, st, u"%s step%d" % (hg, i), problems)
        if ans is None:
            return None
        # ★見出しの［…］は「1つの答え欄を2つ以上の小問に分けたとき」だけ付ける。
        #   1つしか無いのに付けると、ただの飾りになって読みにくい（画面で見て決めた）
        if part and shared.get(aid, 0) > 1:
            q_text = (u"%s　［%s］" % (q_text, part)) if q_text else (u"［%s］" % part)
        if not (q_text or u"").strip():
            problems.append(u"%s step%d: 問いかけが空になった（原文から決められない）" % (hg, i))
            return None
        # ★単位で値を取り出したときは、**その単位の表記が問いかけに残っている**ことを確かめる。
        #   「時速12km」から12だけを取り出して問いかけに「時速」も「km」も無ければ、
        #   子どもが読む画面から**速さであることが消える**（本人指摘・2026-09-13）
        if ukey:
            miss = [t for t in meaning_tokens(ukey) if t and t not in q_text]
            if miss:
                problems.append(u"%s step%d: 単位「%s」で %r を取り出したのに、問いかけに %s が"
                                u"出てこない（何の量を答えるのか画面から消える）"
                                % (hg, i, ukey, ans, u"・".join(miss)))
                return None
        s = {u"question": q_text, u"answer": ans}
        if st.get(u"choices"):
            s[u"choices"] = st[u"choices"]
        if st.get(u"meaning"):
            s[u"meaning"] = st[u"meaning"]
        # ★図は「小問(n)の図」。設問文が印刷されていない小問にも図はある
        #   （HG-7930 は(1)(2)(4)に本文が無く図だけ）。答えの枠が持つ qid で引く
        fig_qid = qid or slot.get(u"qid")
        qfigs = figs_by_scope.get(fig_qid or u"", [])
        if len(qfigs) > 1:
            problems.append(u"%s step%d: 小問の図が%d枚あり、アプリの形に入りきらない"
                            % (hg, i, len(qfigs)))
            return None
        if qfigs:
            s[u"svg"] = qfigs[0][u"_svg"]
        steps.append(s)

    x = {u"id": u"trial_%s" % hg.replace(u"-", u"").lower(),
         u"src": u"%s 原簿・%s No.%d %s" % (hg, doc[u"material"], doc[u"no"], it[u"label"]),
         u"hg": hg, u"title": p.get(u"title"), u"category": p.get(u"category"),
         u"unit": p.get(u"unit"), u"grade": 5, u"star": p.get(u"star"),
         u"intro": None if sole else it[u"setsumon"][u"common"], u"steps": steps}
    if item_figs:
        x[u"svg"] = item_figs[0][u"_svg"]
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trial-dir", required=True)
    ap.add_argument("--strict-kaihou", dest="strict", action="store_true", default=True,
                    help=u"印刷された解法が unread（未読・取り漏れ）の大問を未完成にする（既定）")
    ap.add_argument("--allow-unread-kaihou", dest="strict", action="store_false",
                    help=u"旧成果物の変換試験のときだけ。unread を既存由来の警告として通す")
    a = ap.parse_args()
    trial = assert_safe_out_dir(a.trial_dir)

    g2 = json.load(io.open(os.path.join(trial, u"patch", u"g2.json"), encoding=u"utf-8"))
    g3 = json.load(io.open(os.path.join(trial, u"patch", u"g3.json"), encoding=u"utf-8"))

    # ★結合の前に必ず機械検証を通す。ここを通らないものは1本も組み立てない。
    errors, ambiguous = val.validate_dir(trial)
    items_by_hg = {it[u"hg"]: it for _, it in load_g1(trial)}
    val.validate_patch(items_by_hg, g3, errors)
    if errors:
        print(u"🚩 検証で止まった %d件（結合しない）" % len(errors))
        for t in errors:
            print(u"   ", t)
        sys.exit(1)
    if ambiguous:
        print(u"⚠ 曖昧なまま記録されているもの %d件（その大問は完成扱いにしない）" % len(ambiguous))
        for t in ambiguous:
            print(u"   ", t)
        print(u"")

    done, ng, warnings, notes, ledger = [], [], [], [], {}
    for doc, it in load_g1(trial):
        hg = it[u"hg"]
        for f in it[u"figures"]:
            f[u"_svg"] = read_svg(trial, f[u"svg_ref"]) if f.get(u"svg_ref") else None
        p, w = [], []
        rows = coverage_rows(it, g3.get(hg) or {})
        ledger[hg] = rows
        rec = build_genbo_record(doc, it, g2, p, w)
        x = build_daimon(doc, it, g3, p, notes, rows)
        # ★「原本に解法が無い(none)」と「未読・取り漏れ(unread)」は別もの。
        #   unread を完成扱いにすると、取り漏れが本番に入る。
        if a.strict and it[u"kaihou_insatsu"][u"state"] == u"unread":
            p.append(u"%s: 印刷された解法が未読・取り漏れのまま（原本に解法が無い場合は none と書く）" % hg)
        warnings += w
        row = {u"hg": hg, u"record": rec, u"daimon": x, u"reasons": p}
        (ng if (p or x is None) else done).append(row)

    out = os.path.join(trial, u"out")
    inc = os.path.join(out, u"incomplete")
    os.makedirs(out, exist_ok=True)
    os.makedirs(inc, exist_ok=True)

    def dump(folder, rows, header):
        io.open(os.path.join(folder, u"genbo_records.md"), u"w", encoding=u"utf-8",
                newline=u"\n").write(header + u"\n".join(r[u"record"] for r in rows))
        io.open(os.path.join(folder, u"daimon.json"), u"w", encoding=u"utf-8",
                newline=u"\n").write(json.dumps(
                    [r[u"daimon"] for r in rows if r[u"daimon"]],
                    ensure_ascii=False, indent=1) + u"\n")

    dump(out, done, u"")
    # ★失敗したものも診断用に残す。ただし**未完成と明示**して、完成品と混ざらないようにする
    dump(inc, ng, u"<!-- 🚧 未完成。全必須検査を通っていない。本番に入れてはいけない -->\n\n")
    io.open(os.path.join(inc, u"reasons.json"), u"w", encoding=u"utf-8", newline=u"\n").write(
        json.dumps({r[u"hg"]: r[u"reasons"] for r in ng}, ensure_ascii=False, indent=1) + u"\n")
    io.open(os.path.join(inc, u"_README.md"), u"w", encoding=u"utf-8", newline=u"\n").write(
        u"# 🚧 未完成（診断用）\n\n"
        u"ここにあるのは**必須検査を通っていない**出力です。原因は `reasons.json`。\n"
        u"**完成品は `out/final/` にしか置きません**（`g1_verify.py` が全検査に通ったときだけ作ります）。\n")

    io.open(os.path.join(out, u"coverage.json"), u"w", encoding=u"utf-8", newline=u"\n").write(
        json.dumps(ledger, ensure_ascii=False, indent=1) + u"\n")
    # ★どの条件で通したかを残す。`--allow-unread-kaihou` を使った結果を
    #   「本番に入れられる」と読みちがえないため（本人指摘・2026-09-13）
    io.open(os.path.join(out, u"run.json"), u"w", encoding=u"utf-8", newline=u"\n").write(
        json.dumps({u"strict_kaihou": bool(a.strict),
                    u"allow_unread_kaihou": not a.strict,
                    u"done": len(done), u"incomplete": len(ng)},
                   ensure_ascii=False, indent=1) + u"\n")

    print(u"結合できた %d本 ／ 未完成 %d本" % (len(done), len(ng)))
    exc = [(hg, r) for hg, rs in sorted(ledger.items()) for r in rs
           if r[u"status"] == u"excluded"]
    if exc:
        print(u"")
        print(u"🚫 意図的に除外した回答箇所 %d件（理由は既存の記録から引き継いだもの）" % len(exc))
        for hg, r in exc:
            print(u"    %s %s ← %s" % (hg, r[u"label"], r.get(u"source")))
            print(u"        %s" % (r.get(u"reason") or u"")[:100])
    if warnings:
        print(u"")
        print(u"⚠ 既存側の欠落（新経路のせいではない） %d件" % len(warnings))
        for t in warnings:
            print(u"   ", t)
    if notes:
        print(u"")
        print(u"📝 見ておくこと %d件" % len(notes))
        for s in notes:
            print(u"   ", s)
    if ng:
        print(u"")
        print(u"🚧 未完成 %d本（out/incomplete/ に診断用として残した）" % len(ng))
        for r in ng:
            for t in (r[u"reasons"] or [u"%s: 大問を組み立てられなかった" % r[u"hg"]]):
                print(u"   ", t)
        sys.exit(1)
    print(u"✅ 全部そろった（未完成なし）")


if __name__ == "__main__":
    main()
