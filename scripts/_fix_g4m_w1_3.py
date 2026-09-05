# -*- coding: utf-8 -*-
"""小4マスター算数（公開テスト kokai No.2〜5）塾講師監査 3班（audit_3.txt）の修正パッチ。
   対象は kokai No.2（hd_4m_k02_563_5）〜 kokai No.5（hd_4m_k05_626_4）の34本。

  使い方:  python scripts/_fix_g4m_w1_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

  ★大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
  ★冪等：欄まるごとの一致で判定する。すでに新しい値なら黙って飛ばす。
  ★置換前に、その大問の中でちょうど1回だけ出ることを確認する。
  ★図SVGの修正は無し（今回の34本に図の不具合は見つからなかった）。

  34本すべてを原簿と突き合わせ、答え・解説の計算式を独立に解き直した（findings_3.md参照）。
  見つかった不具合は2件（いずれも重大＝重複問題の混入）＋1件（中＝解説の理屈の誤り）。

  【重大1】hd_4m_k03_588_2（src=HG-3303）
    steps[2]が、別レコード HG-3304 の設問をまるごと複製している。HG-3304は
    hd_4m_k03_588_1として独立に実装済み（同じ問題文・同じ答え28）なので、
    588_2側のsteps[2]は丸ごと重複＝削除する（steps[0],[1]はHG-3303本来の内容で変更なし）。

  【重大2】hd_4m_k03_600_2（src=HG-3505）
    steps[2]が、別レコード HG-3506 の設問をまるごと複製している。HG-3506は
    hd_4m_k03_600_1として独立に実装済み（同じ問題文・同じ答え29）なので、
    600_2側のsteps[2]は丸ごと重複＝削除する（steps[0],[1]はHG-3505本来の内容で変更なし）。

  【中1】hd_4m_k02_563_5（src=HG-3002）steps[0].meaning
    「3・4・5のうち3つの和が13になるのは 4+4+5 だけ」という断定が数学的に誤り
    （3+5+5=13も存在する。python検算で確認: {(3,5,5):13,(4,4,5):13}の2通りがsumで13になる）。
    ただし3+5+5はひろし9段・かずゆき4段という分割ができない（9,4を作れる部分集合が無い）ため
    自動的に除外され、最終的な答え（グー0回・チョキ1回・パー2回）自体は変わらない。
    解説の理屈だけを、9段を作れる組合せを直接絞る言い方に直す（「4+4+5だけ」という誤った
    全称否定をやめ、「2つ選んで9になるのは4+5だけ」という正しい絞り込みに変える）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 対象3本と、原簿番号(src)が今も一致しているかの確認用（万一どこかのセッションが
# 大問を差し替えていたら、ここで気づけるようにする）。
TARGETS = {
    "hd_4m_k02_563_5": "HG-3002",
    "hd_4m_k03_588_2": "HG-3303",
    "hd_4m_k03_600_2": "HG-3505",
}

# 見送りの確認用（削除ずみ側の重複元。書き込みはしないが、存在と内容が今も同じかだけ確認する）
DUP_SOURCE_CHECK = {
    "hd_4m_k03_588_1": ("HG-3304",
        "1から120までの整数のうち、数字の1を1つだけ使ってできている整数（51もふくむ）は全部で何こですか。",
        "28"),
    "hd_4m_k03_600_1": ("HG-3506",
        "この店が営業している時間の中でくじ引きができる時間を合計すると何時間ですか。",
        "29"),
}

# 重複していた設問文（削除対象。これが一致しない場合は書きこまず止める）
DUP_STEP_588_2 = {
    "question": "1から120までの整数のうち、51のように数字の1を「1つだけ」使ってできている整数は全部で何こですか。（11は1を2つ、111は3つ使っているので数えません）",
    "answer": "28",
}
DUP_STEP_600_2 = {
    "question": "毎日 午前9時から午後9時まで営業しているお店があります。ある年の5月3日 午前10時から、同じ年の5月5日 午後3時まで くじ引きをすることになりました。このお店が営業している時間の中で、くじ引きができる時間を合計すると何時間ですか。",
    "answer": "29",
}

# 563_5 steps[0].meaning の貼りつけ（旧→新）
MEANING_563_5_OLD = (
    "3回で2人あわせて9+4＝13段。3・4・5のうち3つの和が13になるのは 4+4+5 だけ。"
    "ひろしの9段は 4+5 なので、チョキで1回・パーで1回勝った。"
    "負けた1回は相手がチョキ（4段）で勝っているので、ひろしの手はパー。"
    "だからチョキ1回・パー2回・グー0回。"
)
MEANING_563_5_NEW = (
    "ひろしの9段を、3・4・5の中からいくつか選んでたした形で考える。"
    "2つ選んで9になるのは4+5だけ（3つ選んで3+3+3＝9にすると、かずゆきの勝ちが0回になって"
    "4段に届かないので合わない）。だから、ひろしはチョキ(4段)で1回・パー(5段)で1回勝った。"
    "残る1回はかずゆきの勝ちで、そのときひろしは負けている。"
    "かずゆきの4段勝ち（チョキ）に負けるのはパーなので、ひろしの手はパー。"
    "だからチョキ1回・パー2回・グー0回。"
)


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    # 対象の大問を iter_daimon だけで引く（存在確認・原簿番号の一致確認）
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in TARGETS or x.get("id") in DUP_SOURCE_CHECK:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(TARGETS) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, src in TARGETS.items():
        assert found[did].get("src") == src, \
            "%s: src mismatch (expected %s, got %r)" % (did, src, found[did].get("src"))

    # 重複元（588_1 / 600_1）は書きこまないが、今も存在し中身が同じかだけ確認する。
    # ここが崩れていたら「重複だから削除する」という前提そのものが崩れているので止める。
    missing_dup = set(DUP_SOURCE_CHECK) - set(found)
    assert not missing_dup, "duplicate-source daimon not found: " + ", ".join(sorted(missing_dup))
    for did, (src, q, a) in DUP_SOURCE_CHECK.items():
        xx = found[did]
        assert xx.get("src") == src, "%s: src mismatch (expected %s, got %r)" % (did, src, xx.get("src"))
        assert len(xx["steps"]) == 1, "%s: step count changed (expected 1, got %d)" % (did, len(xx["steps"]))
        assert xx["steps"][0]["question"] == q, "%s: question text changed" % did
        assert xx["steps"][0]["answer"] == a, "%s: answer changed" % did

    changed = skipped = 0

    # --- 重大1: hd_4m_k03_588_2 の steps[2]（HG-3304の丸ごと重複）を削除 ---
    x = found["hd_4m_k03_588_2"]
    steps = x["steps"]
    if len(steps) == 2:
        assert steps[1]["question"] == "☆に入る整数はいくつですか。", \
            "hd_4m_k03_588_2: already 2 steps but content unexpected"
        skipped += 1
    else:
        assert len(steps) == 3, "hd_4m_k03_588_2: unexpected step count %d" % len(steps)
        s2 = steps[2]
        assert s2["question"] == DUP_STEP_588_2["question"], \
            "hd_4m_k03_588_2 steps[2]: question text differs from expected duplicate"
        assert s2["answer"] == DUP_STEP_588_2["answer"], \
            "hd_4m_k03_588_2 steps[2]: answer differs from expected duplicate"
        # この大問の中でちょうど1回だけ出ることを確認してから削除する
        n = sum(1 for s in steps if s["question"] == DUP_STEP_588_2["question"])
        assert n == 1, "hd_4m_k03_588_2: duplicate question appears %d times (expected 1)" % n
        del steps[2]
        assert len(x["steps"]) == 2
        changed += 1

    # --- 重大2: hd_4m_k03_600_2 の steps[2]（HG-3506の丸ごと重複）を削除 ---
    x = found["hd_4m_k03_600_2"]
    steps = x["steps"]
    if len(steps) == 2:
        assert steps[1]["question"] == "左から1番目から30番目までにならぶ数の合計はいくつですか。", \
            "hd_4m_k03_600_2: already 2 steps but content unexpected"
        skipped += 1
    else:
        assert len(steps) == 3, "hd_4m_k03_600_2: unexpected step count %d" % len(steps)
        s2 = steps[2]
        assert s2["question"] == DUP_STEP_600_2["question"], \
            "hd_4m_k03_600_2 steps[2]: question text differs from expected duplicate"
        assert s2["answer"] == DUP_STEP_600_2["answer"], \
            "hd_4m_k03_600_2 steps[2]: answer differs from expected duplicate"
        n = sum(1 for s in steps if s["question"] == DUP_STEP_600_2["question"])
        assert n == 1, "hd_4m_k03_600_2: duplicate question appears %d times (expected 1)" % n
        del steps[2]
        assert len(x["steps"]) == 2
        changed += 1

    # --- 中1: hd_4m_k02_563_5 steps[0].meaning の理屈を直す ---
    x = found["hd_4m_k02_563_5"]
    step0 = x["steps"][0]
    cur = step0["meaning"]
    if cur == MEANING_563_5_NEW:
        skipped += 1
    else:
        assert cur == MEANING_563_5_OLD, \
            "hd_4m_k02_563_5 steps[0].meaning: old value differs (another session wrote it?)"
        n = sum(1 for s in x["steps"] if s.get("meaning") == MEANING_563_5_OLD)
        assert n == 1, "hd_4m_k02_563_5: old meaning text appears %d times (expected 1)" % n
        step0["meaning"] = MEANING_563_5_NEW
        changed += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
