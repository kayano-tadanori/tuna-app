# -*- coding: utf-8 -*-
"""大問モードで「正しく答えても必ず不正解になる」設問を直す（2026-08-08）。

`scripts/check_answers.py` が「テンキーで打てないのに選択肢が無い」と報告していた6件と、
`scripts/check_wiring.js` が見つけた選択肢の重複1件。原因は3種類あった。

★理科5件＝選択肢はあるのに、答えの表記が選択肢と食いちがっていた
    答え  : '300gより重くなる'
    選択肢: ['300gより大きくなる', '300gより小さくなる', '300gのままである']
  原簿（実物）の言い方は「大きくなる／小さくなる」。**選択肢のほうが原簿どおりで正しく、
  答えを「重く／軽く」と言いかえて書いてしまっていた**。
  → 答えを原簿の言い方にそろえる。大小の向きは変えない（物理の答えは合っている）。

★算数1件＝答えに単位が入っていてテンキーで打てなかった
    「【7】は【5】の何倍ですか」→ '42倍'
  「何倍」を聞く設問は50件あり、うち46件は数字だけで書いてある。
  同じ記号定義型の hd_4m_k12_633_3（≪8≫は≪6≫の何倍）も '56' と数字だけ。
  → '42' にそろえる。単位は設問文の側にあるので、設問は作り変えていない
    （→ [[feedback_genbo_dori]]「テンキーで打てない技術的理由で設問を作り変えない」）。

★選択肢1件＝同じ選択肢が2回入っていて、実質3択になっていた（下の CHOICE_FIXES 参照）

★何度実行しても安全（もう直っているものは「すでに直っていた」と数える）。

  python scripts/fix_daimon_answers.py          … 何が変わるか見るだけ
  python scripts/fix_daimon_answers.py --write  … 書きこむ
"""
import io, json, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(ROOT, "data", "hama_daimon.json")

# (大問id, 設問の頭の文字, いまの答え, 直したあとの答え)
FIXES = [
    ("hd_4r_k03_564_3", "ばねばかりがしめす目もり", "100gより軽くなる", "100gより小さくなる"),
    ("hd_4r_k03_564_3", "台ばかりがしめす目もり", "300gより重くなる", "300gより大きくなる"),
    ("hd_4r_k07_592_4b", "[図3]で、台ばかりの目もり", "200gより重くなる", "200gより大きくなる"),
    ("hd_4r_k03_600_3b", "[図3]で、ばねばかりの目もり", "50gより重くなる", "50gより大きくなる"),
    ("hd_4r_k06_603_4b", "[図3]で、台ばかりのしめす重さ", "300gより重くなる", "300gより大きくなる"),
    ("hd_4m_k12_609_3", "【7】は【5】の何倍", "42倍", "42"),
]

# ★選択肢に同じものが2回入っていて、実質3択になっていた設問
#   hd_4m_k11_584_4 (1)：'1700円／1700円' が1番目と4番目に重複していた。
#   この設問は原簿(HG-3272)に無い導入用で、選択肢も実装側で作ったもの。
#   差しかえる値は原簿の設定から計算できる：りんご100円・みかん150円・15こ以上で250円引き。
#     8こ+6こ=14こ → 割引なし → 800+900 = 1700円
#     9こ+7こ=16こ → 割引あり → 900+1050-250 = 1700円（答えが同じになるのが狙い）
#   → 4番目を「割引を忘れた場合」の 9×100+7×150 = 1950円 に差しかえる。でっち上げではない
CHOICE_FIXES = [
    ("hd_4m_k11_584_4", "りんご8こ・みかん6こ",
     ["1700円／1700円", "1700円／2200円", "1450円／1950円", "1700円／1700円"],
     ["1700円／1700円", "1700円／2200円", "1450円／1950円", "1700円／1950円"]),
]


def walk(node, hit):
    if isinstance(node, dict):
        if isinstance(node.get("steps"), list):
            hit(node)
        for v in node.values():
            walk(v, hit)
    elif isinstance(node, list):
        for v in node:
            walk(v, hit)


def main():
    data = json.load(io.open(DAIMON, encoding="utf-8"))
    todo = {(i, q, a): b for i, q, a, b in FIXES}
    ctodo = {(i, q): (old, new) for i, q, old, new in CHOICE_FIXES}
    done, cdone, already, bad = [], [], [], []

    def visit(d):
        for s in d["steps"]:
            head = (s.get("question") or "")
            # ── 選択肢の重複直し ──
            for (i, qhead), (old, new) in list(ctodo.items()):
                if d.get("id") != i or not head.startswith(qhead):
                    continue
                if s.get("choices") == new:
                    already.append((i, qhead, "選択肢"))
                    del ctodo[(i, qhead)]
                elif s.get("choices") == old:
                    if s.get("answer") not in new:
                        bad.append("%s：直したあとの選択肢に答えが無い" % i)
                    elif len(set(new)) != len(new):
                        bad.append("%s：直したあとも選択肢が重複している" % i)
                    else:
                        s["choices"] = list(new)
                        cdone.append((i, old, new))
                        del ctodo[(i, qhead)]
            # ── 答えの直し ──
            for (i, qhead, old), new in list(todo.items()):
                if d.get("id") != i or not head.startswith(qhead):
                    continue
                if s.get("answer") == new:          # もう直っている
                    already.append((i, qhead, "答え"))
                    del todo[(i, qhead, old)]
                    continue
                if s.get("answer") != old:
                    continue
                ch = s.get("choices")
                # ★選択肢がある設問は、直したあとの答えが必ずその中にあること
                if ch and new not in ch:
                    bad.append("%s：直した答え『%s』が選択肢に無い %s" % (i, new, ch))
                    continue
                s["answer"] = new
                done.append((i, qhead, old, new, bool(ch)))
                del todo[(i, qhead, old)]

    walk(data["grades"], visit)

    for i, q, old, new, ch in done:
        print("  %-18s %-15s %r → %r %s" % (i, q[:15], old, new, "（4択）" if ch else "（入力）"))
    for i, old, new in cdone:
        print("  %-18s 選択肢の重複を解消 %r → %r" % (i, old[3], new[3]))
    for i, q, kind in already:
        print("  %-18s %-15s すでに直っていた（%s）" % (i, q[:15], kind))
    for (i, q, old) in todo:
        print("  ✗ 見つからない: %s / %s / %r" % (i, q[:20], old))
    for (i, q) in ctodo:
        print("  ✗ 選択肢が見つからない: %s / %s" % (i, q[:20]))
    for b in bad:
        print("  ✗ " + b)

    print()
    print("直した：答え%d件・選択肢%d件／すでに直っていた：%d件／見つからない：%d件／おかしい：%d件"
          % (len(done), len(cdone), len(already), len(todo) + len(ctodo), len(bad)))
    if todo or ctodo or bad:
        print("✗ 全部そろっていないので書きこまない")
        sys.exit(1)

    if not done and not cdone:
        print("（直すところは残っていない）")
        return

    if "--write" in sys.argv:
        with io.open(DAIMON, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        json.load(io.open(DAIMON, encoding="utf-8"))
        print("✓ 書きこんだ → %s" % DAIMON)
    else:
        print("（--write で書きこむ）")


if __name__ == "__main__":
    main()
