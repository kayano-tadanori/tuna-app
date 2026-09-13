# -*- coding: utf-8 -*-
u"""検証が**本当に止まるか**を、わざと壊したデータで確かめる。

  python scripts/g1_validate_selftest.py --trial-dir docs/_genbo/_trial10

「検証を書いた」だけでは、動いている証拠にならない。
（→ `feedback_kensa_zenbu_tootte_mo_betsumono` ／ `method_measure_first`）
そこで **壊し方を1つずつ入れて、止まらなければ自己テストを不合格にする。**

確かめる壊し方：
  ① 不正な状態値   … state を enum に無い値にする
  ② 参照先なし     … 答えの枠が実在しない小問を指す／図が実在しない小問を指す
                     ／svg_ref の先にファイルが無い
  ③ 重複ID         … aid が2つ同じ／fid が2つ同じ
  ④ 必須欄の欠落   … item から kenzan を消す／figure から state を消す
  ⑤ 中身の食いちがい… state=ok なのに text が空／単位索引が再計算と合わない

最後に、①の壊れたデータで **`g1_join.py` が結合を拒む（終了コード1）**ことも実際に走らせて確かめる。
出力先は `docs/_genbo/_trial_selftest/` （`g1_guard` の許す `_trial…` の下）。
"""
import argparse
import glob
import io
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import g1_validate as val                                   # noqa: E402
from g1_guard import assert_safe_out_dir                    # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(BASE, "docs", "_genbo", "_trial_selftest")


# ── 壊し方（1件ずつ。引数の doc を書きかえる） ─────────────────
def break_state(doc):
    doc[u"items"][0][u"setsumon"][u"state"] = u"yometa"
    return u"①不正な状態値", u"state=yometa"


def break_dangling_qid(doc):
    doc[u"items"][0][u"kotae"][u"slots"][0][u"qid"] = u"q9"
    return u"②参照先なし（小問）", u"答えの枠が q9 を指す"


def break_dangling_fig(doc):
    it = next(x for x in doc[u"items"] if x[u"figures"])
    it[u"figures"][0][u"scope"] = u"q9"
    return u"②参照先なし（図）", u"図が小問 q9 を指す"


def break_missing_svg(doc):
    it = next(x for x in doc[u"items"] if any(f.get(u"svg_ref") for f in x[u"figures"]))
    f = next(f for f in it[u"figures"] if f.get(u"svg_ref"))
    f[u"svg_ref"] = u"svg/この名前のファイルは無い.svg"
    return u"②参照先なし（SVG）", u"svg_ref の先が無い"


def break_dup_aid(doc):
    it = next(x for x in doc[u"items"] if len(x[u"kotae"][u"slots"]) > 1)
    it[u"kotae"][u"slots"][1][u"aid"] = it[u"kotae"][u"slots"][0][u"aid"]
    return u"③重複ID（aid）", u"aid が2つとも a1"


def break_dup_fid(doc):
    it = next(x for x in doc[u"items"] if len(x[u"figures"]) > 1)
    it[u"figures"][1][u"fid"] = it[u"figures"][0][u"fid"]
    return u"③重複ID（fid）", u"fid が2つとも f1"


def break_missing_kenzan(doc):
    del doc[u"items"][0][u"kenzan"]
    return u"④必須欄の欠落（item）", u"kenzan を消す"


def break_missing_fig_state(doc):
    it = next(x for x in doc[u"items"] if x[u"figures"])
    del it[u"figures"][0][u"state"]
    return u"④必須欄の欠落（図）", u"figure の state を消す"


def break_empty_text(doc):
    doc[u"items"][0][u"kotae"][u"text"] = u""
    return u"⑤中身の食いちがい", u"答え state=ok なのに text が空"


def break_unit_index(doc):
    it = next(x for x in doc[u"items"]
              if any(s.get(u"unit_index") for s in x[u"kotae"][u"slots"]))
    s = next(s for s in it[u"kotae"][u"slots"] if s.get(u"unit_index"))
    s[u"unit_index"] = {u"時": u"999"}
    return u"⑤単位索引の写しちがい", u"unit_index を 999 にする"


def break_unknown_scope_no_reason(doc):
    it = next(x for x in doc[u"items"] if x[u"figures"])
    it[u"figures"][0][u"scope"] = u"unknown"
    it[u"figures"][0].pop(u"scope_reason", None)
    return u"④必須欄の欠落（曖昧の理由）", u"scope=unknown なのに理由が無い"


BREAKS = [break_state, break_dangling_qid, break_dangling_fig, break_missing_svg,
          break_dup_aid, break_dup_fid, break_missing_kenzan, break_missing_fig_state,
          break_empty_text, break_unit_index, break_unknown_scope_no_reason]


def make_case(src, name, fn):
    u"""試行のデータを写して1か所だけ壊し、その場所を返す。"""
    dst = os.path.join(WORK, name)
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    os.makedirs(dst)
    for sub in (u"g1", u"svg", u"patch"):
        p = os.path.join(src, sub)
        if os.path.isdir(p):
            shutil.copytree(p, os.path.join(dst, sub))
    for f in (u"pick10.json",):
        if os.path.isfile(os.path.join(src, f)):
            shutil.copy(os.path.join(src, f), os.path.join(dst, f))

    if fn is None:
        return dst, u"（壊さない）", u"そのまま"
    files = sorted(glob.glob(os.path.join(dst, u"g1", u"*.json")))
    # その壊し方が使えるファイルを探す（図が2枚ある大問が要る、など）
    for path in files:
        doc = json.load(io.open(path, encoding=u"utf-8"))
        try:
            title, what = fn(doc)
        except StopIteration:
            continue
        io.open(path, u"w", encoding=u"utf-8", newline=u"\n").write(
            json.dumps(doc, ensure_ascii=False, indent=1) + u"\n")
        return dst, title, u"%s（%s）" % (what, os.path.basename(path))
    return dst, fn.__name__, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trial-dir", default=os.path.join("docs", "_genbo", "_trial10"))
    ap.add_argument("--keep", action="store_true", help=u"壊したデータを消さずに残す")
    a = ap.parse_args()
    src = os.path.abspath(a.trial_dir)
    assert_safe_out_dir(WORK)
    if os.path.isdir(WORK):
        shutil.rmtree(WORK)
    os.makedirs(WORK)

    rows, bad = [], 0

    # 0) 壊していないものは通ること（通らないなら自己テストの土台が狂っている）
    dst, title, what = make_case(src, u"case00_clean", None)
    errs, amb = val.validate_dir(dst)
    ok = not errs
    rows.append((u"⓪ 壊さない", u"通る", u"通った" if ok else u"止まった：%s" % errs[0][:60], ok))
    if not ok:
        bad += 1

    # 1) 1か所ずつ壊して、必ず止まること
    for i, fn in enumerate(BREAKS, 1):
        dst, title, what = make_case(src, u"case%02d" % i, fn)
        if what is None:
            rows.append((title, u"止まる", u"この壊し方に使える大問が無い", False))
            bad += 1
            continue
        errs, amb = val.validate_dir(dst)
        ok = bool(errs)
        rows.append((title, u"止まる", (errs[0][:70] if errs else u"🚩 止まらなかった"), ok))
        if not ok:
            bad += 1

    # 2) 結合が本当に拒むか（終了コードで確かめる）
    dst, _, _ = make_case(src, u"case_join", break_state)
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    r = subprocess.run([sys.executable, os.path.join(BASE, "scripts", "g1_join.py"),
                        "--trial-dir", os.path.relpath(dst, BASE), "--allow-unread-kaihou"],
                       cwd=BASE, capture_output=True, env=env)
    made = os.path.isdir(os.path.join(dst, u"out", u"final"))
    ok = (r.returncode == 1) and not made
    rows.append((u"結合が拒むか", u"終了コード1・出力なし",
                 u"終了コード=%d／out/final=%s" % (r.returncode, u"作られた" if made else u"無し"), ok))
    if not ok:
        bad += 1

    w = max(len(x[0]) for x in rows)
    print(u"")
    print(u"# 検証の自己テスト（わざと壊して、止まるかを見る）")
    print(u"")
    for title, expect, got, ok in rows:
        print(u"%s %s │ %s" % (u"✅" if ok else u"🚩", title.ljust(w), got))
    print(u"")
    if not a.keep:
        shutil.rmtree(WORK)
    if bad:
        print(u"🚩 %d件、思ったとおりに止まらなかった" % bad)
        sys.exit(1)
    print(u"✅ %d件すべて、壊したら止まった" % len(rows))


if __name__ == "__main__":
    main()
