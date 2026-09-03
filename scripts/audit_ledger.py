# -*- coding: utf-8 -*-
"""どの大問が「塾講師監査」を通ったかの台帳。

★なぜ要るか
  機械チェック（check_answerable.py / audit_questions.js / check_genbo.py）は
  毎回ぜんぶを見るので「どれを通したか」を覚える必要がない。
  ところが**中身の監査**（塾講師エージェントに原簿と突き合わせさせるほう）は
  回・分冊の単位で人手にかけるもので、記憶とコミットメッセージにしか残っていなかった。
  そのため「HG-4567は監査を通ったか」「まだ人の目が入っていない大問は何本か」に
  答えられなかった（本人の指摘 2026-09-03）。

★台帳の考えかた
  ・監査は **大問1本ずつ** ではなく **範囲（回・分冊）でかける**。
    だから台帳が持つのは「監査の回（batch）」と「その範囲の指定（select）」だけ。
  ・**大問の場所（学年・コース・回）は持たない。** hama_daimon.json から毎回引き直す。
    ここに写すと二重管理になって必ずズレる（→ memory:feedback_kansa_script_copy）。
  ・**expect_n が安全弁。** 監査したときの本数を書いておき、いま範囲を引き直した
    本数と食いちがったら止まる。「監査のあとに大問を足した」を見逃さないため。

★使い方
  python scripts/audit_ledger.py            … 集計を出して docs/audit_ledger.md を書き直す
  python scripts/audit_ledger.py verify     … 安全弁だけ回す（本数の食いちがいを見る）
  python scripts/audit_ledger.py unaudited [学年/コース] … 未監査の大問idを並べる
  python scripts/audit_ledger.py batches    … 監査の履歴を並べる
"""
import io, json, os, sys, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G

BASE = G.BASE
LEDGER = os.path.join(BASE, "docs", "audit_ledger.json")
REPORT = os.path.join(BASE, "docs", "audit_ledger.md")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_ledger():
    return json.load(io.open(LEDGER, encoding="utf-8"))


def index_daimon(d):
    """大問id → その大問がどこにあるか。iter_daimon（唯一の走査口）だけを使う。"""
    ix = collections.OrderedDict()
    for r in G.iter_daimon(d):
        ix[r["x"]["id"]] = r
    return ix


def resolve(sel, ix):
    """batch の select を、大問idの並びに直す。

    select の書き方は3つ:
      {"grade","course","kind","no":[lo,hi]}  … 回の範囲で選ぶ（no は省略可＝全部）
      {"id_contains": "_641_"}                … idの一部で選ぶ
      {"ids": [...]}                          … 直に並べる
    """
    if "ids" in sel:
        return list(sel["ids"])
    out = []
    for i, r in ix.items():
        if "id_contains" in sel and sel["id_contains"] not in i:
            continue
        if "grade" in sel and r["grade"] != sel["grade"]:
            continue
        if "course" in sel and r["app_course"] != sel["course"]:
            continue
        if "kind" in sel and r["kind"] != sel["kind"]:
            continue
        if "no" in sel:
            lo, hi = sel["no"]
            try:
                n = int(r["no"])
            except (TypeError, ValueError):
                continue
            if not (lo <= n <= hi):
                continue
        out.append(i)
    return out


def build(d=None):
    """台帳を解決して (ix, audited, problems, led) を返す。

    audited  … 大問id → その大問を見た batch id の並び
    problems … 安全弁にひっかかったこと（本数の食いちがい／消えた大問）
    """
    led = load_ledger()
    d = d if d is not None else G.load_daimon()
    ix = index_daimon(d)
    audited = collections.defaultdict(list)
    problems = []
    for bid, b in sorted(led.get("batches", {}).items()):
        ids = resolve(b["select"], ix)
        miss = [i for i in ids if i not in ix]
        if miss:
            problems.append("[%s] 台帳にあるのにデータに無い大問 %d本: %s"
                            % (bid, len(miss), " ".join(miss[:5])))
        ids = [i for i in ids if i in ix]
        exp = b.get("expect_n")
        if exp is not None and len(ids) != exp:
            problems.append(
                "[%s] 本数が合わない: 監査したときは %d本 → いまの範囲は %d本"
                "（監査のあとで足した／消した可能性）" % (bid, exp, len(ids)))
        for i in ids:
            audited[i].append(bid)
    return ix, audited, problems, led


def agg_rows(ix, audited):
    """コース単位に集計する。"""
    agg = collections.OrderedDict()
    for i, r in ix.items():
        key = (r["grade"], r["app_course"])
        a = agg.setdefault(key, {"n": 0, "ok": 0, "q": 0, "qok": 0})
        nq = len(r["x"].get("steps", []))
        a["n"] += 1
        a["q"] += nq
        if i in audited:
            a["ok"] += 1
            a["qok"] += nq
    return agg


def label(grade, course):
    return "小%s%s" % (grade, G.COURSE_LABEL.get(course, course))


def cmd_report(argv):
    ix, audited, problems, led = build()
    agg = agg_rows(ix, audited)
    N = len(ix)
    OK = len(audited)
    Q = sum(a["q"] for a in agg.values())
    QOK = sum(a["qok"] for a in agg.values())

    L = []
    L.append("# 塾講師監査の台帳（自動生成・手で編集しない）")
    L.append("")
    L.append("`python scripts/audit_ledger.py` を実行するたびに丸ごと上書きされる。")
    L.append("★監査の記録そのものは `docs/audit_ledger.json` にある。**足すのはそちら。**")
    L.append("")
    L.append("最終更新: %s" % led.get("_updated", ""))
    L.append("")
    L.append("- **大問 %d本のうち、監査済みは %d本（%.1f%%）／未監査は %d本**"
             % (N, OK, 100.0 * OK / N if N else 0, N - OK))
    L.append("- 設問でみると %d問のうち %d問（%.1f%%）"
             % (Q, QOK, 100.0 * QOK / Q if Q else 0))
    L.append("")
    L.append("## コース別")
    L.append("")
    L.append("| コース | 大問 | 監査済み | 未監査 | 割合 |")
    L.append("|---|---:|---:|---:|---:|")
    for (g, c), a in sorted(agg.items()):
        L.append("| %s | %d | %d | %d | %.0f%% |"
                 % (label(g, c), a["n"], a["ok"], a["n"] - a["ok"],
                    100.0 * a["ok"] / a["n"] if a["n"] else 0))
    L.append("| **合計** | **%d** | **%d** | **%d** | **%.0f%%** |"
             % (N, OK, N - OK, 100.0 * OK / N if N else 0))
    L.append("")
    L.append("## 監査の履歴")
    L.append("")
    L.append("| 監査 | 日 | 誰が | 対象 | 本数 | 出たもの |")
    L.append("|---|---|---|---|---:|---|")
    for bid, b in sorted(led.get("batches", {}).items()):
        ids = [i for i in resolve(b["select"], ix) if i in ix]
        L.append("| `%s` | %s | %s | %s | %d | %s |"
                 % (bid, b.get("date", ""), b.get("by", ""), b.get("scope", ""),
                    len(ids), b.get("result", "")))
    un = led.get("unresolved_batches", [])
    if un:
        L.append("")
        L.append("## 記録はあるが、どの大問を見たのか特定できない監査")
        L.append("")
        L.append("下は「やったのは確かだが、対象の大問を機械的に選び直せない」もの。")
        L.append("**上の集計では未監査に数えている**（監査済みだと言い切れないため）。")
        L.append("ここを減らすには、その教材をもう一度まとめて監査にかけるのが早い。")
        L.append("")
        for b in un:
            L.append("- **%s**（%s・%s）… %s" % (b.get("scope", ""), b.get("date", ""),
                                                 b.get("by", ""), b.get("why", "")))
    L.append("")
    if problems:
        L.append("## ⚠ 安全弁にひっかかった")
        L.append("")
        for p in problems:
            L.append("- %s" % p)
        L.append("")
    io.open(REPORT, "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")

    print("大問 %d本 / 監査済み %d本 / 未監査 %d本" % (N, OK, N - OK))
    for (g, c), a in sorted(agg.items()):
        print("  %-16s %4d本  監査済み %4d  未監査 %4d"
              % (label(g, c), a["n"], a["ok"], a["n"] - a["ok"]))
    # ★答え合わせの安全弁（memory:feedback_kansa_script_copy）
    assert sum(a["n"] for a in agg.values()) == N, "コース別の合計が総数と合わない"
    assert all(i in ix for i in audited), "台帳がデータに無い大問を監査済みにしている"
    if problems:
        print("")
        print("⚠ 安全弁:")
        for p in problems:
            print("  - " + p)
    print("")
    print("-> %s" % REPORT)
    return 1 if problems else 0


def cmd_verify(argv):
    ix, audited, problems, led = build()
    if not problems:
        print("OK: %d件の監査ぜんぶで、本数が当時と一致した" % len(led.get("batches", {})))
        return 0
    for p in problems:
        print("NG: " + p)
    return 1


def cmd_unaudited(argv):
    ix, audited, problems, led = build()
    want = argv[0] if argv else None
    out = []
    for i, r in ix.items():
        if i in audited:
            continue
        key = "%s/%s" % (r["grade"], r["app_course"])
        if want and not key.startswith(want):
            continue
        out.append((key, r["kind"], str(r["no"]), i, r["x"].get("src", "")[:24]))
    for o in out:
        print("%-20s %-8s No.%-4s %-24s %s" % o)
    print("")
    print("未監査 %d本" % len(out))
    return 0


def cmd_batches(argv):
    ix, audited, problems, led = build()
    for bid, b in sorted(led.get("batches", {}).items()):
        ids = [i for i in resolve(b["select"], ix) if i in ix]
        print("%-12s %s  %-24s %s  %d本"
              % (bid, b.get("date", ""), b.get("by", ""), b.get("scope", ""), len(ids)))
    for b in led.get("unresolved_batches", []):
        print("%-12s %s  %-24s %s"
              % ("(対象不明)", b.get("date", ""), b.get("by", ""), b.get("scope", "")))
    return 0


CMDS = {"report": cmd_report, "verify": cmd_verify,
        "unaudited": cmd_unaudited, "batches": cmd_batches}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "report"
    if cmd not in CMDS:
        print(__doc__)
        sys.exit(2)
    sys.exit(CMDS[cmd](sys.argv[2:]))
