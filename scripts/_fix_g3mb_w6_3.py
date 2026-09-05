# -*- coding: utf-8 -*-
"""塾講師監査(audit_3.txt / 小3マスター算数 第3分冊 fukushu No.42〜43・31本)で見つかった
不具合の修正パッチ。

対象は findings_3.md の中4件（軽1件を含む）。今回のPDF原本(`浜問題\\3年算数\\`)は
Google Driveが未接続でアクセスできなかったため、すべて独立検算だけで直せる
「解説の書き方」の修正のみを対象にしている（図SVGの修正は含まない）。

  1. hd3mb_42_13 (HG-4528) steps[0]/[1]
     「たくや君が280歩で歩けるきょり」を m の部分/cm の部分の2問に分割しているのに、
     steps[0](m部分=162)の解説がそのまま「...=162m40cm」で、steps[1](cm部分=40)の
     答え40を先に見せていた。steps[0]は100でわった商(162)だけにとどめ、
     steps[1]で「前の設問の答え」を引用しながら40を明かす形に直す。

  2. hd3mb_42_24 (HG-4539) steps[3]/[4], steps[5]/[6]
     「46分16秒÷8」「25時間+□日□時間+13日=18日」をそれぞれ2問に分割しているのに、
     前半(分の部分=5, 日の部分=3)の解説が後半(秒の部分=47, 時間の部分=23)の答えまで
     書いたまま使い回されていた。わり算の商とあまり分割と同じ手当てを適用する。

  3. hd3mb_43_13 (HG-4555) steps[0]/[1], steps[2]/[3]
     和差算(あいさん/きよみさん)・倍数算(しんいち君/たけし君)を2問ずつに分割して
     いるのに、先に答える方(あいさん=1300, しんいち=2250)の解説がもう一方の値
     (きよみさん=700, たけし=750)を先に見せていた。先に答える方は相手の値を経由
     しない直接式(和差算の公式・倍数算の比の直接計算)に差し替える。

  4. hd3mb_43_13 (HG-4555) steps[6]
     りんご1こ(消去算)の解説が「(540-420)は使わず」と言いながら、直後で
     540-420そのものの値(120円)を使っており自己矛盾していた。矛盾する前置きを
     取り除き、みかんの個数の差から代金の差を求める説明に直す。

  5. hd3mb_43_11 (HG-4553) steps[0]
     「5C2=10(とおり)」と組み合わせ記号(nCr)だけの解説になっており、小3は
     もちろん中学受験算数でも習わない記号がそのまま出ていた。順列20とおりを
     2でわる、という小学生向けの求め方に書きかえる。

すべて答え(answer)自体は原簿と一致しており変更していない。変えるのは
steps[*].meaning（解説文）のみ。

使い方:
    python scripts/_fix_g3mb_w6_3.py [対象JSONのパス]
    省略時は data/hama_daimon.json（プロジェクト直下からの相対パス）。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 置換は「欄まるごとの一致」で冪等判定する（_fix_g3mb_w2_1.py と同じ方式）。
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
            " 手で確認すること。 cur=%r" % (label, cur)
        )


def apply_step_meaning(x, step_index, question_check, old_full, new_full, label, log):
    """x["steps"][step_index]["meaning"] を、質問文の一致を確認したうえで
    「欄まるごとの一致」で冪等に書き換える。"""
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


# ---------------------------------------------------------------------------
# 1. hd3mb_42_13 (HG-4528) : m部分/cm部分の分割で cm(40) を先出ししていた
# ---------------------------------------------------------------------------
def fix_hd3mb_42_13(data, log):
    x = find_one(data, "hd3mb_42_13", "HG-4528")
    apply_step_meaning(
        x, 0,
        "たくや君が280歩で歩けるきょりは何m何cmですか。mの部分を答えなさい。",
        "58×280=16240(cm)=162m40cm",
        "58×280=16240(cm)。16240を100でわると、mの部分は162。",
        "hd3mb_42_13 p0(m)", log,
    )
    apply_step_meaning(
        x, 1,
        "たくや君が280歩で歩けるきょりは何m何cmですか。cmの部分を答えなさい。",
        "58×280=16240(cm)=162m40cm",
        "58×280=16240(cm)=162m40cm。mの部分は162（前の設問の答え）なので、cmの部分は40。",
        "hd3mb_42_13 p1(cm)", log,
    )


# ---------------------------------------------------------------------------
# 2. hd3mb_42_24 (HG-4539) : 分/秒、日/時間 の分割で後半の値を先出ししていた
# ---------------------------------------------------------------------------
def fix_hd3mb_42_24(data, log):
    x = find_one(data, "hd3mb_42_24", "HG-4539")
    apply_step_meaning(
        x, 3,
        "46分16秒÷8=□分□秒　分の部分を答えなさい。",
        "46分16秒=2776秒,2776÷8=347秒=5分47秒",
        "46分16秒=2776秒。2776÷8=347秒。347を60でわると、分の部分は5。",
        "hd3mb_42_24 p3(min)", log,
    )
    apply_step_meaning(
        x, 4,
        "46分16秒÷8=□分□秒　秒の部分を答えなさい。",
        "46分16秒=2776秒,2776÷8=347秒=5分47秒",
        "46分16秒=2776秒、2776÷8=347秒=5分47秒。分の部分は5（前の設問の答え）なので、秒の部分は47。",
        "hd3mb_42_24 p4(sec)", log,
    )
    apply_step_meaning(
        x, 5,
        "25時間+□日□時間+13日=18日　日の部分を答えなさい。",
        "25時間=1日1時間、18日-13日-1日1時間=3日23時間",
        "25時間=1日1時間。18日-13日-1日1時間を計算すると、日の部分は3。",
        "hd3mb_42_24 p5(day)", log,
    )
    apply_step_meaning(
        x, 6,
        "25時間+□日□時間+13日=18日　時間の部分を答えなさい。",
        "25時間=1日1時間、18日-13日-1日1時間=3日23時間",
        "25時間=1日1時間、18日-13日-1日1時間=3日23時間。日の部分は3（前の設問の答え）なので、時間の部分は23。",
        "hd3mb_42_24 p6(hour)", log,
    )


# ---------------------------------------------------------------------------
# 3. hd3mb_43_13 (HG-4555) : 和差算/倍数算の分割で後半の値を先出しし、
#    さらに消去算(りんご)の解説が自己矛盾していた
# ---------------------------------------------------------------------------
def fix_hd3mb_43_13(data, log):
    x = find_one(data, "hd3mb_43_13", "HG-4555")
    q_ai = "2000円を,あいさんと,きよみさんで分けます。あいさんが600円多くなるように分けると,2人はそれぞれ何円もらうことになりますか。（あいさん）は何円ですか？"
    q_kiyomi = "2000円を,あいさんと,きよみさんで分けます。あいさんが600円多くなるように分けると,2人はそれぞれ何円もらうことになりますか。（きよみさん）は何円ですか？"
    q_shin = "3000円を,しんいち君とたけし君で分けます。しんいち君がたけし君の3倍になるように分けると,2人はそれぞれ何円もらうことになりますか。（しんいち君）は何円ですか？"
    q_take = "3000円を,しんいち君とたけし君で分けます。しんいち君がたけし君の3倍になるように分けると,2人はそれぞれ何円もらうことになりますか。（たけし君）は何円ですか？"
    q_ringo = "みかん3ことりんご2こで420円,みかん5ことりんご2こで540円です。りんご1こは何円ですか。"

    apply_step_meaning(
        x, 0, q_ai,
        "(2000-600)÷2=700(円)…きよみさん、700+600=1300(円)…あいさん",
        "2000円に差の600円をたしてから2等分すると、多いほうのあいさんの金がくが求まる:(2000+600)÷2=1300(円)。",
        "hd3mb_43_13 p0(あいさん)", log,
    )
    apply_step_meaning(
        x, 1, q_kiyomi,
        "(2000-600)÷2=700(円)…きよみさん、700+600=1300(円)…あいさん",
        "あいさんは1300円（前の設問の答え）なので、2000-1300=700(円)。",
        "hd3mb_43_13 p1(きよみさん)", log,
    )
    apply_step_meaning(
        x, 2, q_shin,
        "3000÷(1+3)=750(円)…たけし君、750×3=2250(円)…しんいち君",
        "しんいち君はたけし君の3倍なので、3000円を1+3=4等分したうちの3つ分にあたる。3000×3=9000、9000÷4=2250(円)。",
        "hd3mb_43_13 p2(しんいち)", log,
    )
    apply_step_meaning(
        x, 3, q_take,
        "3000÷(1+3)=750(円)…たけし君、750×3=2250(円)…しんいち君",
        "しんいち君は2250円（前の設問の答え）なので、3000-2250=750(円)。",
        "hd3mb_43_13 p3(たけし)", log,
    )
    apply_step_meaning(
        x, 6, q_ringo,
        "みかんの数をそろえて引く:(540-420)は使わずみかん2こ差の式で解く。りんごの数をそろえると(みかん3+りんご2=420、みかん5+りんご2=540の差)みかん2こ=120円なので、みかん1こ=60円、りんご1こ=(420-60×3)÷2=120(円)",
        "りんごの数はどちらも2こで同じなので、代金の差はみかんの数の差(5-3=2こ)によるもの。540-420=120(円)がみかん2こ分の代金なので、みかん1こ=60円。りんご1こ=(420-60×3)÷2=120(円)。",
        "hd3mb_43_13 p6(りんご)", log,
    )


# ---------------------------------------------------------------------------
# 4. hd3mb_43_11 (HG-4553) : nCr記号だけの解説を小学生向けの求め方に書きかえ
# ---------------------------------------------------------------------------
def fix_hd3mb_43_11(data, log):
    x = find_one(data, "hd3mb_43_11", "HG-4553")
    apply_step_meaning(
        x, 0,
        "5人の子どもがいます。この中から2人をえらぶえらび方は何とおりありますか。",
        "5C2=10(とおり)",
        "5人をA,B,C,D,Eとすると、順番も区別して2人をえらぶ選び方は5×4=20(とおり)。同じ2人の組は2回ずつ数えているので、20÷2=10(とおり)。",
        "hd3mb_43_11 p0", log,
    )


FIXES = [
    fix_hd3mb_42_13,
    fix_hd3mb_42_24,
    fix_hd3mb_43_13,
    fix_hd3mb_43_11,
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
