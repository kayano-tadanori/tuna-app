# -*- coding: utf-8 -*-
u"""【試行専用】既存の原簿とアプリから、G2/G3が書くはずの「判断ぶん」だけを取り出す。

試行で確かめたいのは**結合の忠実性**であって、AIの判断の質ではない。
そこで判断ぶん（骨・コア発見・分類・子ども向け解説）は既存データから借りてくる。

🚨**答えはパッチに入れない。**答えはG1の構造化データから機械で取る（本人指示）。
🚨 本番データは**読むだけ**。書き先は `docs/_genbo/_trial…` の下だけ。

  python scripts/g1_patch_from_existing.py --g1-dir docs/_genbo/_trial10/g1 \
                                           --out-dir docs/_genbo/_trial10
"""
import argparse
import glob
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from g1_units import unit_index                           # noqa: E402

import genbo_common as gc                                  # noqa: E402
from genbo_path import find_genbo                          # noqa: E402
from g1_guard import assert_safe_out_dir                   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")


def norm(s):
    return re.sub(u"\\s+", u"", (s or u"")).strip()






def candidates(slots):
    u"""答えの取り出し口を全部ならべる。

      (aid)              … 枠の答えそのまま
      (aid, vid)         … 案A：枠の中の、印刷ラベルつきの値
      (aid, unit)        … 案B：枠の中の、その単位が付く値
      (aid, vid, unit)   … 案Aで分けた値の中の、その単位が付く値
    ★どれも**印刷された答えから機械で取り出せるもの**だけ。作り出した値は1つも無い。
    """
    out = []
    for s in slots:
        out.append({u"ref_aid": s[u"aid"], u"_text": s[u"text"], u"_label": None,
                    u"_unit": None, u"_slot": s[u"label"]})
        for un, val in (s.get(u"unit_index") or {}).items():
            out.append({u"ref_aid": s[u"aid"], u"take_unit": un,
                        u"_text": val, u"_label": None, u"_unit": un, u"_slot": s[u"label"]})
        for v in (s.get(u"values") or []):
            out.append({u"ref_aid": s[u"aid"], u"ref_vid": v[u"vid"],
                        u"_text": v[u"text"], u"_label": v[u"label"], u"_unit": None,
                        u"_slot": s[u"label"]})
            for un, val in unit_index(v[u"text"])[0].items():
                out.append({u"ref_aid": s[u"aid"], u"ref_vid": v[u"vid"], u"take_unit": un,
                            u"_text": val, u"_label": v[u"label"], u"_unit": un,
                            u"_slot": s[u"label"]})
    return out


def key_of(c):
    u"""取り出し口を **ID の組** で言い表したもの。これが対応の本体。"""
    return (c[u"ref_aid"], c.get(u"ref_vid"), c.get(u"take_unit"))


def resolve_ref(slots, step, taken):
    u"""アプリの小問1つを、答えの取り出し口に結ぶ。**一意に決まらなければ結ばない。**

    🚨**主な根拠は ID の対応（aid・vid、そして枠が持つ qid）。**
       問いかけにラベルや単位の字が出てくるかどうかは**確かめ**であって、根拠ではない。
       字の一致を根拠にすると「時速何km」と書いてあるだけの別の小問に吸い寄せられる。

    順番：
      ① 答える場所の**印刷された記号**（㋐・(2)）が問いかけにあれば、その aid だけを見る
         … これは字ではなく「原文に印刷された答える場所のID」なので根拠になる
      ② その中で、印刷された答えと**値が一致**する取り出し口を残す（＝検算）
      ③ まだ2つ以上あるなら、vid のラベル・単位で**1つに決まるときだけ**採る
      ④ すでに他の小問が使った取り出し口は使わない（同じ答えを2つの小問に入れない）
    """
    ans = norm(step.get(u"answer"))
    q = step.get(u"question") or u""
    cands = candidates(slots)

    # ① 印刷された答える場所の記号で絞る（ID による対応）
    by_slot = [c for c in cands if c.get(u"_slot") and c[u"_slot"] in q]
    pool = by_slot if by_slot else cands

    # ② 値の一致で確かめる
    hit = [c for c in pool if norm(c[u"_text"]) == ans and ans]
    if not hit:
        if by_slot:
            return None, (u"印刷された答える場所 %s の中に、この答え %r と同じ値が無い"
                          % (by_slot[0][u"_slot"], step.get(u"answer")))
        return None, u"印刷された答えのどこにも同じ値が無い"

    # ③ まだ決まらないなら vid のラベル・単位で1つに絞る
    if len({key_of(c) for c in hit}) > 1:
        narrowed = [c for c in hit
                    if (c[u"_label"] and c[u"_label"] in q)
                    or (c[u"_unit"] and c[u"_unit"] in q)]
        if len({key_of(c) for c in narrowed}) != 1:
            return None, (u"取り出し口が%d通りあって一つに決まらない（%s）"
                          % (len(hit), u"/".join(
                              u"%s%s%s" % (c[u"ref_aid"], c.get(u"ref_vid") or u"",
                                           (u":" + c[u"take_unit"]) if c.get(u"take_unit") else u"")
                              for c in hit)))
        hit = narrowed

    # ④ 二重取り（2つの小問が同じ場所の同じ値を答えにする）を許さない
    if key_of(hit[0]) in taken:
        return None, (u"取り出し口 %s は、もう別の小問が使っている"
                      % u"/".join(x or u"" for x in key_of(hit[0])))
    c = dict(hit[0])
    for k in (u"_text", u"_label", u"_unit", u"_slot"):
        c.pop(k, None)
    return c, None


# ── 既存の記録から「意図的な除外」を引き継ぐ ───────────────────
EXC_WORDS = [u"アプリに入れない", u"アプリには入れない", u"入れていない", u"入れない",
             u"載せない", u"出さない", u"除外", u"外してある", u"外した", u"採らない"]


def _halfwidth(s):
    return (s or u"").replace(u"（", u"(").replace(u"）", u")").replace(u"　", u"")


def find_exclusion(body, label):
    u"""既存の原簿から、その回答箇所を**すでに外すと決めてあった**記述を探して引き継ぐ。

    🚨 ここで**新しく除外を判断しない**。見つからなければ None を返し、呼んだ側が未完成にする。
       （外す判断は、原本を見た担当が理由つきで書いたものだけを認める）
    """
    if not body or not label:
        return None
    lab = _halfwidth(label)
    fields = gc.rec_fields(body)
    for name in (u"作問メモ", u"備考", u"扱い", u"図"):
        for v in fields.get(name) or []:
            flat = _halfwidth(v)
            for m in re.finditer(re.escape(lab), flat):
                tail = flat[m.end():m.end() + 40]
                if not any(w in tail for w in EXC_WORDS):
                    continue
                start = flat.rfind(u"。", 0, m.start()) + 1
                end = flat.find(u"。", m.end())
                end = len(flat) if end < 0 else end + 1
                rest = flat[end:end + 8].replace(u"*", u"").lstrip()
                if rest.startswith(u"("):        # 直後の（…）は理由の続き
                    close = flat.find(u")", end)
                    if 0 < close < end + 300:
                        end = close + 1
                reason = flat[start:end].replace(u"*", u"").strip()
                return {u"reason": reason,
                        u"source": u"既存の原簿レコードの「%s」欄" % name}
    return None


def app_items():
    d = json.load(io.open(DAIMON, encoding=u"utf-8"))
    out = {}
    for r in gc.iter_daimon(d):
        x = r["x"] if isinstance(r, dict) and "x" in r else r
        hgs = gc.hgof(x)
        if hgs:
            out[hgs[0]] = x
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--g1-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    a = ap.parse_args()
    assert_safe_out_dir(a.out_dir)

    g = io.open(find_genbo(), encoding=u"utf-8").read()
    genbo = {hg: g[s:e] for hg, s, e in gc.split_records(g)}
    app = app_items()

    g2, g3, problems = {}, {}, []
    for f in sorted(glob.glob(os.path.join(a.g1_dir, u"*.json"))):
        doc = json.load(io.open(f, encoding=u"utf-8"))
        for it in doc[u"items"]:
            hg = it[u"hg"]
            body = genbo.get(hg)
            if body:
                g2[hg] = {
                    u"hone": gc.rec_field(body, u"骨"),
                    u"core": gc.rec_field(body, u"コア発見"),
                    u"settei": gc.rec_field(body, u"設定"),
                    u"kaihou_hosoku": None,
                    u"sakumon_memo": gc.rec_field(body, u"作問メモ"),
                    u"midashi": (re.search(u"】(.+)$", body.split(u"\n")[0]).group(1)
                                 if re.search(u"】(.+)$", body.split(u"\n")[0]) else None),
                }
            else:
                problems.append(u"%s: 原簿にレコードが無い" % hg)

            x = app.get(hg)
            if not x:
                problems.append(u"%s: アプリに大問が無い" % hg)
                continue

            slots = it[u"kotae"][u"slots"]
            qs = {q[u"qid"]: q for q in it[u"setsumon"][u"questions"]}
            steps, incomplete, taken = [], False, set()
            for i, st in enumerate(x.get(u"steps") or []):
                ref, why = resolve_ref(slots, st, taken)
                if ref is None:
                    problems.append(u"%s step%d: %s（answer=%r）"
                                    % (hg, i + 1, why, st.get(u"answer")))
                    incomplete = True
                    continue
                taken.add(key_of(ref))
                qid = next((s[u"qid"] for s in slots if s[u"aid"] == ref[u"ref_aid"]), None)
                if qid and qid not in qs:
                    qid = None
                ref.update({
                    u"ref_qid": qid,
                    u"kind": u"choice" if st.get(u"choices") else u"numpad",
                    u"choices": st.get(u"choices") or None,
                    u"meaning": st.get(u"meaning"),
                })
                steps.append(ref)

            # ── アプリに出していない回答箇所は、**既存の記録から除外理由を引き継ぐ**
            #    引き継げないものは何も書かない → 結合側が「未完成」にする
            exclusions = []
            covered = {(s[u"ref_aid"], s.get(u"ref_vid")) for s in steps}
            for s in slots:
                vs = s.get(u"values") or []
                places = [(s[u"aid"], v[u"vid"], u"%s %s" % (s[u"label"] or s[u"aid"], v[u"label"]))
                          for v in vs] or [(s[u"aid"], None, s[u"label"] or s[u"aid"])]
                for aid, vid, lab in places:
                    if (aid, vid) in covered or (aid, None) in covered:
                        continue
                    e = find_exclusion(body, s[u"label"])
                    if not e:
                        problems.append(u"%s: 回答箇所 %s がアプリに無く、既存の記録にも"
                                        u"「外した理由」が見あたらない（ここで新しく判断しない）"
                                        % (hg, lab))
                        incomplete = True
                        continue
                    exclusions.append({u"aid": aid, u"vid": vid, u"label": lab,
                                       u"reason": e[u"reason"], u"source": e[u"source"]})

            g3[hg] = {
                u"category": x.get(u"category"), u"unit": x.get(u"unit"),
                u"star": x.get(u"star"), u"title": x.get(u"title"),
                u"steps": steps, u"exclusions": exclusions,
            }
            if incomplete:
                # ★欠けたまま結合させない。半端なパッチは「未完成」と札を立てる
                g3[hg][u"incomplete"] = True

    pdir = os.path.join(a.out_dir, u"patch")
    os.makedirs(pdir, exist_ok=True)
    for name, obj in ((u"g2.json", g2), (u"g3.json", g3)):
        io.open(os.path.join(pdir, name), u"w", encoding=u"utf-8", newline=u"\n").write(
            json.dumps(obj, ensure_ascii=False, indent=1) + u"\n")
        print(u"書いた: patch/%s（%d本）" % (name, len(obj)))

    if problems:
        print(u"\n🚩 %d件" % len(problems))
        for t in problems:
            print(u"   ", t)
        sys.exit(1)


if __name__ == "__main__":
    main()
