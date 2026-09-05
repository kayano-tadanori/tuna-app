# -*- coding: utf-8 -*-
"""塾講師監査(audit_2.txt / 小3マスター算数 第1分冊 fukushu No.4〜6・19本)で見つかった
不具合の修正パッチ。

対象: hd3mb_04_15 / hd3mb_05_2 / hd3mb_05_3 / hd3mb_05_4 / hd3mb_05_6 /
      hd3mb_05_8 / hd3mb_05_10 / hd3mb_06_2 / hd3mb_06_3 / hd3mb_06_6

使い方:
    python scripts/_fix_g3mb_w1_2.py [対象JSONのパス]
    省略時は data/hama_daimon.json（プロジェクト直下からの相対パス）。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 置換は「欄まるごとの一致」で冪等判定する：
      現在値 == OLD_FULL なら書き換えて NEW_FULL にする
      現在値 == NEW_FULL ならもう当たっている（何もしない）
      どちらでもなければ想定外の内容＝即座に例外を投げて **1件も書かずに** 止まる
  - SVGなど長い欄は、OLD_FULL に対して「部分文字列がちょうど1回」を確認してから
    置換して NEW_FULL を組み立てる（sub_replace）。これで「その大問の中でちょうど1回」
    という要件を、置換の単位でも満たす。
  - 書き出しは io.open(path, "wb")。
"""
import io
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common  # noqa: E402

BASE = genbo_common.BASE


def sub_replace(text, old_sub, new_sub, label):
    """text の中に old_sub がちょうど1回だけ現れることを確認して置換する。"""
    n = text.count(old_sub)
    if n != 1:
        raise AssertionError(
            "sub_replace: %s の中に %r が %d 回見つかった（1回のはず）" % (label, old_sub, n)
        )
    return text.replace(old_sub, new_sub, 1)


def find_one(data, target_id, expect_src):
    hits = [r for r in genbo_common.iter_daimon(data, grade="3", app_courses=["master_bunsatsu"])
            if r["x"].get("id") == target_id]
    if len(hits) != 1:
        raise AssertionError("find_one: id=%s が %d 件見つかった（1件のはず）" % (target_id, len(hits)))
    x = hits[0]["x"]
    if x.get("src") != expect_src:
        raise AssertionError(
            "find_one: id=%s の src が %r ではなく %r だった（原簿番号がずれている？）"
            % (target_id, expect_src, x.get("src"))
        )
    return x


def apply_field(x, field, old_full, new_full, label, log):
    """x[field] を「欄まるごとの一致」で冪等に書き換える。"""
    cur = x.get(field, "")
    if cur == old_full:
        x[field] = new_full
        log.append("APPLIED  " + label)
    elif cur == new_full:
        log.append("SKIP(already applied) " + label)
    else:
        raise AssertionError(
            "apply_field: %s の現在の内容が想定（旧・新のどちらの欄まるごと一致）とも違う。"
            " 手で確認すること。" % label
        )


def apply_step_meaning(x, step_index, question_check, old_full, new_full, label, log):
    steps = x.get("steps", [])
    if not (0 <= step_index < len(steps)):
        raise AssertionError("apply_step_meaning: %s に steps[%d] が無い" % (label, step_index))
    step = steps[step_index]
    if step.get("question") != question_check:
        raise AssertionError(
            "apply_step_meaning: %s の steps[%d].question が想定と違う（並びがずれた？）: %r"
            % (label, step_index, step.get("question"))
        )
    apply_field(step, "meaning", old_full, new_full, label + " steps[%d].meaning" % step_index, log)


def fix_hd3mb_04_15(data, log):
    x = find_one(data, "hd3mb_04_15", "HG-4055")
    apply_step_meaning(
        x, 4,
        "北市と南市の差の範囲は、いちばん少なくて何人か。",
        "差の範囲の下端は小さい方の下端から大きい方の上端を引いた値ではなく、南市の下端から北市の上端を引いて求める。",
        "差の範囲の下端は、大きい方(南市)の下端から小さい方(北市)の上端を引いて求める。",
        "hd3mb_04_15",
        log,
    )


def fix_hd3mb_05_2(data, log):
    x = find_one(data, "hd3mb_05_2", "HG-4058")
    subs = [
        ('<polygon points="320,20 334,28 320,36" fill="#ff6b6b"/>',
         '<polygon points="320,20 334,28 320,36" fill="#4f9eff"/>'),
        ('<polygon points="340,20 354,28 340,36" fill="#ff6b6b"/>',
         '<polygon points="340,20 354,28 340,36" fill="#4f9eff"/>'),
        ('<polygon points="360,20 374,28 360,36" fill="#ff6b6b"/>',
         '<polygon points="360,20 374,28 360,36" fill="#4f9eff"/>'),
        ('<text x="340" y="12" font-size="11" text-anchor="middle" fill="#ffd166">右の4本が赤いはた</text>',
         '<text x="340" y="12" font-size="11" text-anchor="middle" fill="#ffd166">赤いはたの右に4本</text>'),
    ]
    _fix_svg_by_subs(x, subs, "hd3mb_05_2.svg", log)


def _fix_svg_by_subs(x, subs, label, log):
    """svg 欄を、旧→新の部分置換リストで冪等に書き換える共通処理。

    現在値が「旧の部分文字列を全部含む」なら旧→新の全文を組み立てて置換。
    現在値が「新の部分文字列を全部含む」なら既に適用済みとして何もしない。
    どちらでもなければ止まる。
    """
    cur = x.get("svg", "")
    old_subs = [o for o, n in subs]
    new_subs = [n for o, n in subs]
    has_all_old = all(cur.count(o) == 1 for o in old_subs)
    has_all_new = all(cur.count(n) == 1 for n in new_subs)
    if has_all_old:
        new_full = cur
        for old_sub, new_sub in subs:
            new_full = sub_replace(new_full, old_sub, new_sub, label)
        x["svg"] = new_full
        log.append("APPLIED  " + label)
    elif has_all_new:
        log.append("SKIP(already applied) " + label)
    else:
        raise AssertionError("%s: 現在の svg が旧・新のどちらの想定パターンとも一致しない" % label)


def fix_hd3mb_05_3(data, log):
    x = find_one(data, "hd3mb_05_3", "HG-4059")
    apply_step_meaning(
        x, 2,
        "2行目の左はしのマスに入る数はいくつか。",
        "1列の和33から11と15(2行目右はし)を引いて求める。",
        "1列の和33から9と17(たて1列)を引いて求める。",
        "hd3mb_05_3",
        log,
    )
    apply_step_meaning(
        x, 3,
        "2行目の右はしのマスに入る数はいくつか。",
        "1列の和33から17と5(ななめの並び)を使って求める。",
        "1列の和33から5と13(たて3列目)を引いて求める。",
        "hd3mb_05_3",
        log,
    )


def fix_hd3mb_05_4(data, log):
    x = find_one(data, "hd3mb_05_4", "HG-4060")
    apply_step_meaning(
        x, 0,
        "いちばん背が高い人はだれか。",
        "バラバラの不等式を1本につなぐと一郎＞二郎＞五郎＞三郎＞四郎となる。",
        "一郎は二郎より高く、二郎は五郎より高い。五郎は三郎より高く、三郎は四郎より高い。これらをつなげると、いちばん背が高いのは一郎とわかる。",
        "hd3mb_05_4",
        log,
    )
    apply_step_meaning(
        x, 1,
        "3番目に背が高い人はだれか。",
        "一郎＞二郎＞五郎＞三郎＞四郎の順で3番目は五郎。",
        "一郎＞二郎＞五郎の順に高く、二郎の次に高いのは五郎なので、3番目に高いのは五郎とわかる。",
        "hd3mb_05_4",
        log,
    )


def fix_hd3mb_05_6(data, log):
    x = find_one(data, "hd3mb_05_6", "HG-4062")
    apply_step_meaning(
        x, 0,
        "あきびん10本持っていくと全部で何本飲めるか。",
        "飲み終えたあきびんも次の交換の材料になるので、3本ずつ交換を繰り返して合計で飲める本数を数える。",
        "10本を3本ずつ交換すると3本もらえて1本余る。もらった3本を飲むとまた3本のあきびんができるので、それを交換して1本もらう。合計3+1=4本飲める。",
        "hd3mb_05_6",
        log,
    )
    apply_step_meaning(
        x, 1,
        "あきびん14本持っていくと全部で何本飲めるか。",
        "持ちびんと交換でもらった新品を3本ずつ消費しながら交換を繰り返す。",
        "14本を3本ずつ交換すると4本もらえて2本余る。もらった4本を飲んでできた4本と余りの2本を合わせた6本をまた3本ずつ交換すると2本もらえる。合計4+2=6本飲める。",
        "hd3mb_05_6",
        log,
    )
    apply_step_meaning(
        x, 2,
        "あきびん14本持っていくと、最後にあきびんは何本残るか。",
        "交換を繰り返した最後に2本未満のあきびんが残り、それ以上交換できなくなる。",
        "最後にもらった2本を飲んでできた2本のあきびんは3本に足りず交換できないので、2本残る。",
        "hd3mb_05_6",
        log,
    )


def fix_hd3mb_05_8(data, log):
    x = find_one(data, "hd3mb_05_8", "HG-4064")
    apply_step_meaning(
        x, 1,
        "3人とも本当のことを言っているとすると、Bさんは何位か。",
        "Aが2位、Cの発言(1位ではない)からCが3位と決まり、残るBが1位。",
        "Aは2位と決まっているので、残る1位・3位はBとCのどちらか。Cの発言「1位ではない」からCは1位になれないので、1位はBに決まる。",
        "hd3mb_05_8",
        log,
    )
    apply_step_meaning(
        x, 3,
        "3人ともうそを言っているとすると、Aさんは何位か。",
        "うそなのでAは2位でなく、Bが2位、Cが1位と決まるので残るAは3位。",
        "うそなのでAの発言「2位です」の否定によりAは2位ではない。Bの発言とCの発言からも1位・2位はB・Cのどちらかに決まるので、残る3位がAとなる。",
        "hd3mb_05_8",
        log,
    )


def fix_hd3mb_05_10(data, log):
    x = find_one(data, "hd3mb_05_10", "HG-4066")
    apply_step_meaning(
        x, 0,
        "アにあてはまる数はいくつか。",
        "18-6-1-0=11からウ+エ=11となる組を探し、条件を満たすウ=7・エ=4のときア=3と決まる。",
        "18-6-1-0=11からウ+エ=11となる数の組を求め、ア＜オ＜イ＜カの条件をすべて満たす組み合わせが1つに定まることを利用すると、ア＋イ＝11のもとでアは3と決まる。",
        "hd3mb_05_10",
        log,
    )
    apply_step_meaning(
        x, 1,
        "イにあてはまる数はいくつか。",
        "ア＋イ＝18-ウ=11、ア=3なのでイ=8と決まる。",
        "ア＋イ＝11、ア=3なのでイ=8と決まる。",
        "hd3mb_05_10",
        log,
    )


def fix_hd3mb_06_2(data, log):
    x = find_one(data, "hd3mb_06_2", "HG-4069")
    subs = [
        ('<rect x="75" y="65.5556" width="24" height="44.4444" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>',
         '<rect x="75" y="43.3333" width="24" height="66.6667" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>'),
        ('<rect x="115" y="98.8889" width="24" height="11.1111" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>',
         '<rect x="115" y="65.5556" width="24" height="44.4444" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>'),
        ('<rect x="155" y="43.3333" width="24" height="66.6667" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>',
         '<rect x="155" y="21.1111" width="24" height="88.8889" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>'),
        ('<rect x="195" y="76.6667" width="24" height="33.3333" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>',
         '<rect x="195" y="54.4444" width="24" height="55.5556" fill="#4f9eff" fill-opacity="0.55" stroke="#4f9eff"/>'),
    ]
    _fix_svg_by_subs(x, subs, "hd3mb_06_2.svg", log)


def fix_hd3mb_06_3(data, log):
    x = find_one(data, "hd3mb_06_3", "HG-4070")
    old_ticks = (
        '<line x1="26" y1="120" x2="30" y2="120" stroke="#9aa3c0"/><text x="20" y="123" font-size="9" text-anchor="end" fill="#9aa3c0">0m</text>'
        '<line x1="26" y1="100" x2="30" y2="100" stroke="#9aa3c0"/><text x="20" y="103" font-size="9" text-anchor="end" fill="#9aa3c0">2m</text>'
        '<line x1="26" y1="80" x2="30" y2="80" stroke="#9aa3c0"/><text x="20" y="83" font-size="9" text-anchor="end" fill="#9aa3c0">4m</text>'
        '<line x1="26" y1="60" x2="30" y2="60" stroke="#9aa3c0"/><text x="20" y="63" font-size="9" text-anchor="end" fill="#9aa3c0">6m</text>'
        '<line x1="26" y1="40" x2="30" y2="40" stroke="#9aa3c0"/><text x="20" y="43" font-size="9" text-anchor="end" fill="#9aa3c0">8m</text>'
        '<line x1="26" y1="20" x2="30" y2="20" stroke="#9aa3c0"/><text x="20" y="23" font-size="9" text-anchor="end" fill="#9aa3c0">10m</text>'
    )
    new_ticks = (
        '<line x1="26" y1="120" x2="30" y2="120" stroke="#9aa3c0"/><text x="20" y="123" font-size="9" text-anchor="end" fill="#9aa3c0">0m</text>'
        '<line x1="26" y1="109" x2="30" y2="109" stroke="#9aa3c0"/><text x="20" y="112" font-size="9" text-anchor="end" fill="#9aa3c0">2m</text>'
        '<line x1="26" y1="98" x2="30" y2="98" stroke="#9aa3c0"/><text x="20" y="101" font-size="9" text-anchor="end" fill="#9aa3c0">4m</text>'
        '<line x1="26" y1="87" x2="30" y2="87" stroke="#9aa3c0"/><text x="20" y="90" font-size="9" text-anchor="end" fill="#9aa3c0">6m</text>'
        '<line x1="26" y1="76" x2="30" y2="76" stroke="#9aa3c0"/><text x="20" y="79" font-size="9" text-anchor="end" fill="#9aa3c0">8m</text>'
        '<line x1="26" y1="65" x2="30" y2="65" stroke="#9aa3c0"/><text x="20" y="68" font-size="9" text-anchor="end" fill="#9aa3c0">10m</text>'
        '<line x1="26" y1="54" x2="30" y2="54" stroke="#9aa3c0"/><text x="20" y="57" font-size="9" text-anchor="end" fill="#9aa3c0">12m</text>'
        '<line x1="26" y1="43" x2="30" y2="43" stroke="#9aa3c0"/><text x="20" y="46" font-size="9" text-anchor="end" fill="#9aa3c0">14m</text>'
        '<line x1="26" y1="32" x2="30" y2="32" stroke="#9aa3c0"/><text x="20" y="35" font-size="9" text-anchor="end" fill="#9aa3c0">16m</text>'
        '<line x1="26" y1="21" x2="30" y2="21" stroke="#9aa3c0"/><text x="20" y="24" font-size="9" text-anchor="end" fill="#9aa3c0">18m</text>'
        '<line x1="26" y1="10" x2="30" y2="10" stroke="#9aa3c0"/><text x="20" y="13" font-size="9" text-anchor="end" fill="#9aa3c0">20m</text>'
    )
    _fix_svg_by_subs(x, [(old_ticks, new_ticks)], "hd3mb_06_3.svg", log)


def fix_hd3mb_06_6(data, log):
    x = find_one(data, "hd3mb_06_6", "HG-4073")
    subs = [
        ('<text x="120" y="8" font-size="9" text-anchor="middle" fill="#9aa3c0">1目=1度（作図してみよう）</text>',
         '<text x="120" y="8" font-size="9" text-anchor="middle" fill="#9aa3c0">1目=2度（作図してみよう）</text>'),
    ]
    _fix_svg_by_subs(x, subs, "hd3mb_06_6.svg", log)


FIXES = [
    fix_hd3mb_04_15,
    fix_hd3mb_05_2,
    fix_hd3mb_05_3,
    fix_hd3mb_05_4,
    fix_hd3mb_05_6,
    fix_hd3mb_05_8,
    fix_hd3mb_05_10,
    fix_hd3mb_06_2,
    fix_hd3mb_06_3,
    fix_hd3mb_06_6,
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)
    print("target:", path)

    with io.open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    log = []
    for fn in FIXES:
        fn(data, log)

    for line in log:
        print(line)

    applied = sum(1 for l in log if l.startswith("APPLIED"))
    skipped = sum(1 for l in log if l.startswith("SKIP"))
    print("applied=%d skipped(already)=%d total=%d" % (applied, skipped, len(log)))

    out = (json.dumps(data, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    with io.open(path, "wb") as f:
        f.write(out)
    print("wrote", len(out), "bytes")


if __name__ == "__main__":
    main()
