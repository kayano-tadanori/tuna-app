# -*- coding: utf-8 -*-
u"""G1出力を**機械で検証する**。結合の前に必ず通す関所。

  python scripts/g1_validate.py --trial-dir docs/_genbo/_trial10

検証は2段。**混ぜずに別々に出す。**
  ① JSON Schema（`scripts/g1_schema.json`）… 形・必須欄・値の種類
  ② 参照整合性 … Schemaでは書けないもの。IDの重複／参照先が無い／状態と中身の食いちがい／
                 SVGファイルの実在／単位索引の再計算

🚨 ①だけでは足りない。Schema は「a1 が2つある」「qid が誰も指していない小問を指す」
   「state=ok なのに text が空」を**書けない**。だから②を必ず並べて走らせる。
"""
import argparse
import glob
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from g1_units import unit_index, unsupported               # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.path.join(HERE, "g1_schema.json")


def ws(s):
    return re.sub(u"\\s+", u"", s or u"")


# ── ① JSON Schema ───────────────────────────────────────────
def check_schema(doc, where, errors):
    try:
        import jsonschema
    except ImportError:
        errors.append(u"%s: jsonschema が入っていないのでSchema検証ができない"
                      u"（`pip install jsonschema`）。**検証せずに通してはいけない**" % where)
        return
    schema = json.load(io.open(SCHEMA, encoding=u"utf-8"))
    v = jsonschema.Draft7Validator(schema)
    for e in sorted(v.iter_errors(doc), key=lambda x: list(x.absolute_path)):
        path = u"/".join(str(p) for p in e.absolute_path) or u"(先頭)"
        errors.append(u"%s: [Schema] %s — %s" % (where, path, e.message))


# ── ② 参照整合性（Schemaでは書けないもの） ──────────────────────
def _dups(names):
    seen, dup = set(), []
    for n in names:
        if n in seen and n not in dup:
            dup.append(n)
        seen.add(n)
    return dup


def label_num(label):
    n = re.sub(u"[^0-9]", u"", label or u"")
    return int(n) if n else None


def declared_qids(it):
    u"""その大問に**実在すると言える**小問のID。

    ★印刷された小問文が無くても、答える場所が (3) なら小問(3)は実在する
      （HG-7930 は(1)(2)(4)に本文が無く図と答えだけ）。
      だから「印刷された設問」と「答える場所のラベルの番号」の両方から集める。
    ★答えの枠の `qid` そのものは数えない。数えると「自分で自分を正当化する」ことになり、
      参照先の無い qid を見つけられなくなる。
    """
    out = {q[u"qid"] for q in it[u"setsumon"].get(u"questions") or []}
    for s in it[u"kotae"].get(u"slots") or []:
        n = label_num(s.get(u"label"))
        if n:
            out.add(u"q%d" % n)
    return out


def check_text_field(f, where, errors, required_text=True):
    if not isinstance(f, dict):
        return
    st = f.get(u"state")
    if st == u"ok" and required_text and not (f.get(u"text") or u"").strip():
        errors.append(u"%s: state=ok なのに text が空" % where)
    if st == u"unreadable" and not (f.get(u"reason") or u"").strip():
        errors.append(u"%s: state=unreadable なのに reason が無い（何がどう読めないかを書く）" % where)
    if st == u"none" and (f.get(u"text") or u"").strip():
        errors.append(u"%s: state=none なのに text が入っている" % where)


def check_refs(doc, where, trial, errors, ambiguous):
    for i, it in enumerate(doc.get(u"items") or []):
        hg = it.get(u"hg") or u"%s[%d]" % (it.get(u"label"), i)
        w = u"%s %s" % (where, hg)

        se = it.get(u"setsumon") or {}
        qs = se.get(u"questions") or []
        slots = (it.get(u"kotae") or {}).get(u"slots") or []
        figs = it.get(u"figures") or []

        # ── IDの重複
        for name, ids in ((u"qid", [q.get(u"qid") for q in qs]),
                          (u"aid", [s.get(u"aid") for s in slots]),
                          (u"fid", [f.get(u"fid") for f in figs])):
            d = _dups(ids)
            if d:
                errors.append(u"%s: %s が重複している（%s）" % (w, name, u"・".join(map(str, d))))
        for s in slots:
            d = _dups([v.get(u"vid") for v in (s.get(u"values") or [])])
            if d:
                errors.append(u"%s: 枠 %s の vid が重複している（%s）"
                              % (w, s.get(u"aid"), u"・".join(map(str, d))))

        # ── 小問のラベルとIDの食いちがい
        for q in qs:
            n = label_num(q.get(u"label"))
            if n is not None and q.get(u"qid") != u"q%d" % n:
                errors.append(u"%s: 小問 %s のラベル %r と qid が合わない"
                              % (w, q.get(u"qid"), q.get(u"label")))

        # ── 参照先が無い
        decl = declared_qids(it)
        for s in slots:
            qid = s.get(u"qid")
            if qid and qid not in decl:
                errors.append(u"%s: 答えの枠 %s が指す小問 %s が無い（印刷された小問にも"
                              u"答える場所のラベルにも出てこない）" % (w, s.get(u"aid"), qid))
            n = label_num(s.get(u"label"))
            if n is not None and qid and qid != u"q%d" % n:
                errors.append(u"%s: 答えの枠 %s のラベル %r と qid %s が食いちがう"
                              % (w, s.get(u"aid"), s.get(u"label"), qid))

        # ── 設問・答えの状態と中身
        check_text_field(it.get(u"kaihou_insatsu") or {u"state": u"unread"},
                         u"%s 解法" % w, errors)
        if se.get(u"state") == u"ok" and not (se.get(u"common") or u"").strip():
            errors.append(u"%s: 設問 state=ok なのに common が空" % w)
        k = it.get(u"kotae") or {}
        if k.get(u"state") == u"ok":
            if not (k.get(u"text") or u"").strip():
                errors.append(u"%s: 答え state=ok なのに text が空" % w)
            if not slots:
                errors.append(u"%s: 答え state=ok なのに答える場所が1つも無い" % w)
            for s in slots:
                if ws(s.get(u"text")) and ws(s.get(u"text")) not in ws(k.get(u"text")):
                    errors.append(u"%s: 枠 %s の中身 %r が印刷の答えの中に無い"
                                  % (w, s.get(u"aid"), s.get(u"text")))
                for v in (s.get(u"values") or []):
                    if ws(v.get(u"text")) not in ws(s.get(u"text")):
                        errors.append(u"%s: 枠 %s の値 %s %r が枠の中に無い"
                                      % (w, s.get(u"aid"), v.get(u"vid"), v.get(u"text")))
                # 単位索引は**その場で計算し直して**突き合わせる（写し間違いを見つける）
                idx, why = unit_index(s.get(u"text"))
                if unsupported(why):
                    # ★表に無い表記は、索引が空でも見逃さない（黙って「単位なし」にしない）
                    errors.append(u"%s: 枠 %s の単位索引 — %s" % (w, s.get(u"aid"), why))
                elif (s.get(u"unit_index") or {}) != idx:
                    errors.append(u"%s: 枠 %s の単位索引が再計算と合わない（記録 %s / 再計算 %s）"
                                  % (w, s.get(u"aid"), s.get(u"unit_index"), idx))

        # ── 図
        for f in figs:
            fw = u"%s 図 %s" % (w, f.get(u"fid"))
            sc = f.get(u"scope")
            if sc == u"unknown":
                if not (f.get(u"scope_reason") or u"").strip():
                    errors.append(u"%s: scope=unknown なのに理由が書いていない" % fw)
                else:
                    ambiguous.append(u"%s: 図の所属が確定できない — %s" % (w, f[u"scope_reason"]))
            elif sc and sc != u"item" and sc not in decl:
                errors.append(u"%s: 小問 %s の図だと書いてあるが、その小問が無い" % (fw, sc))
            if f.get(u"state") == u"ok":
                ref = f.get(u"svg_ref")
                if not ref:
                    errors.append(u"%s: state=ok なのに svg_ref が無い" % fw)
                else:
                    p = os.path.join(trial, ref.replace(u"/", os.sep))
                    if not os.path.isfile(p):
                        errors.append(u"%s: svg_ref の先にファイルが無い（%s）" % (fw, ref))
                    else:
                        s = io.open(p, encoding=u"utf-8").read().strip()
                        if not (s.startswith(u"<svg") and s.endswith(u"</svg>")):
                            errors.append(u"%s: svg_ref の中身がSVGの形をしていない（%s）" % (fw, ref))
            else:
                if f.get(u"svg_ref"):
                    errors.append(u"%s: state=%s なのに svg_ref がある（読めた図は state=ok）"
                                  % (fw, f.get(u"state")))
                if f.get(u"state") == u"unreadable" and not (f.get(u"reason") or u"").strip():
                    errors.append(u"%s: 判読不能なのに理由が書いていない" % fw)


def validate_dir(trial, g1_dir=None):
    u"""(errors, ambiguous)。errors が1件でもあれば**結合してはいけない**。"""
    errors, ambiguous = [], []
    g1_dir = g1_dir or os.path.join(trial, u"g1")
    files = sorted(glob.glob(os.path.join(g1_dir, u"*.json")))
    if not files:
        return [u"G1のJSONが1つも無い（%s）" % g1_dir], []
    seen_hg = {}
    for f in files:
        where = os.path.basename(f)
        try:
            doc = json.load(io.open(f, encoding=u"utf-8"))
        except ValueError as e:
            errors.append(u"%s: JSONとして読めない — %s" % (where, e))
            continue
        check_schema(doc, where, errors)
        check_refs(doc, where, trial, errors, ambiguous)
        for it in doc.get(u"items") or []:
            hg = it.get(u"hg")
            if not hg:
                continue
            # 同じ大問が2つのパケットに分かれるのは正常（境目の追加回収）。
            # **1つのファイルの中で2回**出るのは取りちがえ。
            key = (where, hg)
            if key in seen_hg:
                errors.append(u"%s: 同じファイルに %s が2回ある" % (where, hg))
            seen_hg[key] = True
    return errors, ambiguous


# ── パッチ（G2/G3の判断ぶん）の参照検査 ───────────────────────
def validate_patch(items_by_hg, g3, errors):
    u"""G3のパッチが G1 の実在するID（aid/qid/vid/単位）だけを指しているか。"""
    for hg, p in sorted(g3.items()):
        it = items_by_hg.get(hg)
        if not it:
            errors.append(u"パッチ %s: G1にその大問が無い" % hg)
            continue
        slots = {s[u"aid"]: s for s in it[u"kotae"][u"slots"]}
        qids = {q[u"qid"] for q in it[u"setsumon"][u"questions"]}
        for i, st in enumerate(p.get(u"steps") or [], 1):
            aid = st.get(u"ref_aid")
            if aid not in slots:
                errors.append(u"パッチ %s step%d: aid %s がG1に無い" % (hg, i, aid))
                continue
            s = slots[aid]
            if st.get(u"ref_qid") and st[u"ref_qid"] not in qids:
                errors.append(u"パッチ %s step%d: qid %s が印刷された小問に無い"
                              % (hg, i, st[u"ref_qid"]))
            vid = st.get(u"ref_vid")
            if vid and vid not in {v[u"vid"] for v in (s.get(u"values") or [])}:
                errors.append(u"パッチ %s step%d: vid %s が枠 %s に無い" % (hg, i, vid, aid))
        for e in (p.get(u"exclusions") or []):
            if e.get(u"aid") not in slots:
                errors.append(u"パッチ %s: 除外に書いてある aid %s がG1に無い" % (hg, e.get(u"aid")))
            if not (e.get(u"reason") or u"").strip() or not (e.get(u"source") or u"").strip():
                errors.append(u"パッチ %s: 除外 %s に理由か出どころが無い"
                              u"（除外はここで新しく判断しない。既存の記録を引き継ぐ）"
                              % (hg, e.get(u"aid")))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trial-dir", required=True)
    ap.add_argument("--g1-dir")
    a = ap.parse_args()
    errors, ambiguous = validate_dir(a.trial_dir, a.g1_dir)
    if ambiguous:
        print(u"⚠ 曖昧（完成扱いにしない） %d件" % len(ambiguous))
        for t in ambiguous:
            print(u"   ", t)
    if errors:
        print(u"🚩 検証で止まった %d件" % len(errors))
        for t in errors:
            print(u"   ", t)
        sys.exit(1)
    print(u"✅ Schema・参照整合性とも問題なし")


if __name__ == "__main__":
    main()
