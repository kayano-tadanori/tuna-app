# -*- coding: utf-8 -*-
"""浜学園の原簿化→実装→監査で「いま何をすべきか」を1つのコマンドで答える。

  ★これを作った理由：**ルールを覚えて守る形は、コンテキストが埋まると必ず破れる**
    （本人指摘 2026-09-09）。だから覚えるものを1つに減らし、
    残りは全部この中の実測にした。**迷ったらこれを叩く。**

  使い方:
    python scripts/hama.py          いま何をすべきか（実測して答える）
    python scripts/hama.py gate     commit前のゲート。重い不具合があれば exit 1

  ★ここは「聞かれたことに実測で答える」だけの場所。判定ロジックは持たない
    （→feedback_kansa_script_copy）。中身は全部よそから import している。
"""
import datetime, io, json, os, re, sys, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G
import audit_ledger as A
import check_kata as K

# ★stdoutを io.TextIOWrapper で包み直すと、2つ包んだとき下の層が閉じられて
#   「I/O operation on closed file」になる（hama.py が check_kata を import
#   したときに実際に踏んだ／2026-09-09）。reconfigure なら二重でも安全。
sys.stdout.reconfigure(encoding="utf-8")
BASE = G.BASE


def kata(rs):
    """型検査の重／中を型ごとに数える。"""
    rows = []
    for key, name, fn in K.CHECKS:
        h = fn(rs)
        rows.append((key, name, len([x for x in h if x[1] == "重"]),
                     len([x for x in h if x[1] != "重"])))
    h, unc = K.k5(rs)
    rows.append(("K5", "原簿との小問数・選択肢数",
                 len([x for x in h if x[1] == "重"]), unc))
    return rows



def baseline():
    """既知の「重」の山（docs/kata_baseline.json）。

    ★レガシーな山をそのままゲートに載せると、ゲートは必ず切られる。
      **止めるのは「新しく増えた重」だけ**にして、山は宿題として数え続ける。
      直したら `python scripts/check_kata.py --baseline-write` で取り直す。
    """
    p = os.path.join(BASE, "docs", "kata_baseline.json")
    if not os.path.exists(p):
        return set()
    return set(json.load(io.open(p, encoding="utf-8")).get("keys") or [])


def packets_without_batch(audited, ix):
    """監査パケットに載っているのに、台帳のどの batch にも入っていない大問。

    ★これが「監査したのに台帳に足し忘れた波」を捕まえる安全弁
      （→tool_audit_ledger の決めごと1）。**忘れは必ず起きる前提で機械が見る。**
    ★2つを必ず分ける（2026-09-09に取りちがえた）：
        足し忘れ … いまもデータに在るのに、どの batch にも無い ＝🚨
        作り直し … 監査のあとに id が消えた ＝情報。直すものは無い
    """
    bare = {i for (_c, i) in audited}
    alive = {i for (_c, i) in ix}
    忘れ, 作り直し = [], []
    for d in sorted(glob.glob(os.path.join(BASE, "docs", "_audit", "*"))):
        if not os.path.isdir(d):
            continue
        ids = set()
        for f in glob.glob(os.path.join(d, "*.txt")):
            try:
                t = io.open(f, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            ids |= set(re.findall(r"^■\s*(\S+)\s*／", t, re.M))
        if not ids:
            continue
        miss = ids - bare
        a = sorted(m for m in miss if m in alive)
        b = sorted(m for m in miss if m not in alive)
        if a:
            忘れ.append((os.path.basename(d), len(ids), a))
        if b:
            作り直し.append((os.path.basename(d), len(b)))
    return 忘れ, 作り直し


def genbo_todo():
    """原簿の「要現物照合」が何件あるか（＝原本を開き直す予約の残高）。"""
    t = io.open(G.find_genbo(), encoding="utf-8").read()
    m = re.search(r"# 🔎 要現物照合リスト(.*?)\n# ", t, re.S)
    body = m.group(1) if m else ""
    rows = [l for l in body.splitlines() if l.startswith("|") and re.search(r"\|\s*\**\d+\**\s*\|", l)]
    done = [l for l in rows if "✅" in l or l.lstrip().startswith("| ~~")]
    return len(rows), len(done)


def main(argv):
    mode = argv[0] if argv else "status"
    d = G.load_daimon()
    rs = list(G.iter_daimon(d))
    ix, audited, problems, led = A.build(d)
    rows = kata(rs)
    heavy = sum(r[2] for r in rows)
    base = baseline()
    now = K.heavy_keys(rs)
    new_heavy = sorted(now - base)
    fixed = len(base - now)
    orphan, remade = packets_without_batch(audited, ix)
    unaudited = [i for i in ix if i not in audited]

    print("■ 浜学園パイプラインの現在地（大問 %d本・%s 実測）"
          % (len(rs), datetime.date.today().isoformat()))
    print()
    print("🚦 ゲート（ここが0でないと commit しない）")
    for key, name, hi, mid in rows:
        n_new = len([k for k in new_heavy if k.startswith(key + "|")])
        tag = "🚨" if n_new else "  "
        extra = ("／数えられず %d本" % mid) if key == "K5" else ("／中 %d件" % mid)
        print("  %s %s %-26s 重 %4d件（うち新規 %d）%s" % (tag, key, name, hi, n_new, extra))
    for k in new_heavy[:20]:
        print("     ★新規 %s" % k)
    if len(new_heavy) > 20:
        print("     …ほか新規 %d件" % (len(new_heavy) - 20))
    if fixed:
        print("  ✅ ベースラインから %d件 減った（--baseline-write で取り直せる）" % fixed)
    for p in problems:
        print("  🚨 台帳の安全弁: %s" % p)
    for name, n, miss in orphan:
        print("  🚨 %s … パケット%d本のうち %d本が台帳のどの batch にも無い（batch の足し忘れ）"
              % (name, n, len(miss)))
    if not new_heavy and not problems and not orphan:
        print("  ✅ 新しい重い不具合なし（既知の重 %d件は宿題として下に数える）" % heavy)

    for name, n in remade:
        print("  ・%s … パケットの%d本は監査のあとに作り直されて今は無い（直すものは無い）" % (name, n))

    print()
    print("📋 残っている宿題（急がないが、これが品質の本体）")
    print("  ・未監査の大問 … %d本（内わけは python scripts/audit_ledger.py）" % len(unaudited))
    print("  ・既知の「重」… %d件（K2 答え先出し・K5 設問の抜けが主。ベースライン登録ずみ）" % len(base & now))
    mid6 = [r for r in rows if r[0] == "K6"][0][3]
    print("  ・解説が薄い（式だけ・一行）… %d件 ★本人の第一原則は『わかりやすいか』" % mid6)
    n, done = genbo_todo()
    print("  ・要現物照合 … %d件（うち解決 %d件）＝原本を開き直す予約の残高" % (n, done))

    print()
    print("👉 次の一手")
    if new_heavy or problems or orphan:
        print("  1) 上の🚨（新規）を先に消す（python scripts/check_kata.py K1 などで中身を見る）")
    if unaudited:
        print("  2) python scripts/audit_packet.py <学年/コース> 4 docs/_audit/<波名>  で波を切る")
    if mid6:
        print("  3) 解説の薄い大問を厚くする（python scripts/check_kata.py K6 --all）")
    if not (new_heavy or problems or orphan or unaudited or mid6):
        print("  ・宿題なし。新しい教材の原簿化（G1）へ進む")

    if mode == "gate":
        ng = len(new_heavy) + len(problems) + len(orphan)
        if ng:
            print()
            print("🚫 ゲート：**新しく増えた**重い不具合が %d件あります。直してから commit してください。" % ng)
            print("   どうしても先に進めたいときは  HAMA_SKIP=1  を付けて実行する。")
        return 1 if ng else 0
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
