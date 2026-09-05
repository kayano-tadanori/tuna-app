# -*- coding: utf-8 -*-
"""docs/_audit/g3mb_w7/findings_1.md の指摘を hama_daimon.json に当てるパッチ。

  使い方:  python scripts/_fix_g3mb_w7_1.py [対象JSON]
           （省略時は data/hama_daimon.json）

対象: 小3マスター算数第3分冊 fukushu No.43（hd3mb_43_17〜hd3mb_43_29・
HG-4559〜HG-4571）13本。これで小3マスター算数第3分冊（ひいては小3マスター
算数の第1〜3分冊全体）の未監査ぶんが無くなる。

原本PDF（Desktop\\浜問題\\3年算数\\）はGoogle Drive未接続でこの回はアクセス
できなかった。ここに含めた3件はいずれも「原本を見なくても検証できる」性質の
不具合（座標実測・独立検算・アプリ内の既存の書き方との比較）だけを直した。
展開図(HG-4562・5問)は3Dの折りたたみシミュレーション(Kabsch法で剛体変換)で
5問すべて正しいと確認できたため、この回は修正対象に含まれていない。

不具合1（重大・findings_1.md参照）:
  hd3mb_43_22（HG-4564・ボートの場合の数）steps[0].meaningに"5C1""5C2"という
  nCr記号が使われている。小3には不相応な記法（本人の既知の禁止パターン）。
  値(5,10,15)は変えず、「5人から1人を選ぶ」「5×4÷2」という小3でも追える
  言い回しに書きかえた。

不具合2（重大・findings_1.md参照）:
  hd3mb_43_17（HG-4559）・hd3mb_43_28（HG-4570）はどちらも「円のまわりの
  長さは直径の3倍とします」という円周率の指定が原簿の設問文にあるのに、
  introが空("")のまま steps 側にもこの一文が引き継がれていない。
  同じ第3分冊No.43内の hd3mb_43_20相当（fukushu/43[3]）や他の多数の記録で
  「円周率は3とします」に類する一文は必ずintro（または各stepの冒頭）に
  残されており、この2本だけが例外的に欠落している。この注記が無いと、
  子どもが標準の3.14で計算した場合に模範解答(21/114/108など)と一致しなく
  なり、正しい解き方が不正解として弾かれる。原簿の「設定/設問」の文言を
  そのままintroへ復元した。

不具合3（重大・findings_1.md参照）:
  hd3mb_43_21（HG-4563・カードの数）steps[2].meaning（「小さい方から5番目」
  を聞く小問）の解説が、steps[0]（2けたの数25とおり）とsteps[1]（大きい方
  から5番目の一覧）の計算をまるごと引きずったまま残っている。本人の既定
  方針どおり「その小問で新しく聞かれる値の求め方だけ」に絞った
  （小さい順の一覧と5番目の値だけに整理）。

見送り（findings_1.md参照。原本確認が要るため修正なし）:
  hd3mb_43_17（HG-4559）①の図SVG。座標を実測すると、「30cm」ラベルから
  求まる縮尺(4単位/cm)で他の寸法線を測ると、"15cm"と書かれた2本の寸法線が
  それぞれ実測10cm・12.5cmになっており、ラベルと実際の長さが食いちがう
  （加えて中央の横寸法線はラベルが空欄）。全体のバウンディングボックスは
  45cm×40cmで①の答え170cmの根拠(40+45)×2とは矛盾しないため答えは正しいが、
  個々の段差の描き方が原簿の文章「途中15cm・10cm・15cmの段差」と一致する
  形になっていない。ラベルと座標のどちらを直すべきかは原本の図を見ないと
  決められないため、座標の書きかえは行わない。

決めごと（過去の事故から）
  * 大問は id で引く。走査は genbo_common.iter_daimon だけを使う（自前で入れ子を歩かない）
  * 置換は「欄まるごとの一致」で判定する（部分文字列置換のアンカーずれを避ける）
    → [[feedback_anchor_uniqueness]]
  * 何度流しても同じ結果（すでに直っていればスキップ＝冪等）
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
    → [[feedback_heikou_session_jouyaki]]（並行セッションの変更を消さないため滞留を最短に）
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化けて全行差分になる）
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

DEFAULT_JSON = os.path.join(ROOT, "data", "hama_daimon.json")

# 対象と、原簿番号(hg)が今も一致しているかの確認用
TARGETS = {
    "hd3mb_43_17": "HG-4559",
    "hd3mb_43_21": "HG-4563",
    "hd3mb_43_22": "HG-4564",
    "hd3mb_43_28": "HG-4570",
}

# (大問id, 欄までの道すじ, 直す前の値, 直したあとの値)
PATCHES = [
    # ==== hd3mb_43_17（HG-4559）円周率の指定が欠落 ====
    (
        "hd3mb_43_17", ("intro",),
        "",
        "つぎの図形のまわりの長さは何cmですか。(円のまわりの長さは直径の3倍とします。)",
    ),

    # ==== hd3mb_43_21（HG-4563）小問3の解説が小問1・2の計算を丸ごと引きずっている ====
    (
        "hd3mb_43_21", ("steps", 2, "meaning"),
        "十の位は0以外の5通り、一の位は残り5通り、5×5=25(とおり)。"
        "大きい順:9853,9851,9850,9835,9831。小さい順:1035,1038,1039,1053,1058",
        "小さい順に並べると1035,1038,1039,1053,1058…5番目は1058",
    ),

    # ==== hd3mb_43_22（HG-4564）5C1・5C2というnCr記法が小3に不相応 ====
    (
        "hd3mb_43_22", ("steps", 0, "meaning"),
        "小ボートに1人乗るとき(残り4人が大ボートへ、5C1=5とおり)＋"
        "小ボートに2人乗るとき(残り3人が大ボートへ、5C2=10とおり)=5+10=15(とおり)",
        "小ボートに1人乗るとき(残り4人が大ボートへ、5人から1人を選ぶので5とおり)＋"
        "小ボートに2人乗るとき(残り3人が大ボートへ、5人から2人を選ぶ方法は5×4÷2=10とおり)=5+10=15(とおり)",
    ),

    # ==== hd3mb_43_28（HG-4570）円周率の指定が欠落 ====
    (
        "hd3mb_43_28", ("intro",),
        "",
        "つぎの①②のしゃ線部分のまわりの長さは何cmですか。(円のまわりの長さは直径の3倍とします。)",
    ),
]


def _dig(x, path):
    node = x
    for p in path[:-1]:
        node = node[int(p)] if str(p).isdigit() else node[p]
    return node, path[-1]


def main(argv):
    target = argv[1] if len(argv) > 1 else DEFAULT_JSON
    target = os.path.abspath(target)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + target)

    # ★改行コードは元ファイルに合わせる（合わせないと全行が差分になり、
    #   並行して直している相手の変更が diff に埋もれて見えなくなる）
    with io.open(target, encoding="utf-8", newline="") as f:
        raw = f.read()
    newline = "\r\n" if "\r\n" in raw else "\n"
    d = json.loads(raw)
    log("  改行コード: %s" % ("CRLF" if newline == "\r\n" else "LF"))

    # 対象の大問を iter_daimon だけで引く（存在確認・原簿番号の一致確認）
    found = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") in TARGETS:
            assert x["id"] not in found, "daimon id duplicated: " + x["id"]
            found[x["id"]] = x
    missing = set(TARGETS) - set(found)
    assert not missing, "daimon not found: " + ", ".join(sorted(missing))
    for did, hg in TARGETS.items():
        assert hg in (found[did].get("src") or ""), \
            "%s: hg mismatch (expected %s, got %r)" % (did, hg, found[did].get("src"))

    # ★PATCHES自身の中で同じ(大問id, 欄までの道すじ)が重複していないか確かめる
    #   （欄はnode/keyという「入れ物への直接アドレス」で指すので、genbo_common.iter_daimon
    #   だけを使うルールとは別に、ここが「ちょうど1箇所を指す」ことの唯一の保証になる）
    seen_paths = set()
    for did, path, old, new in PATCHES:
        key_ = (did, path)
        assert key_ not in seen_paths, "PATCHESの中で道すじが重複: %s %s" % (did, "/".join(map(str, path)))
        seen_paths.add(key_)

    changed = skipped = 0
    for did, path, old, new in PATCHES:
        x = found[did]
        node, key = _dig(x, path)
        cur = node[key]
        if cur == new:          # 冪等：すでに直っている
            skipped += 1
            log("  そのまま %s %s: 変更なし（すでに直っている）" % (did, "/".join(map(str, path))))
            continue
        assert cur == old, "%s %s: 現在値がold/newのどちらとも違う（別セッションが書いた?） -> %r" % (
            did, "/".join(map(str, path)), cur)
        node[key] = new
        changed += 1
        log("  直した %s %s: %r -> %r" % (did, "/".join(map(str, path)), old, new))

    if changed == 0:
        log("変更なし。ファイルは書きかえない。")
        return 0

    text = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if newline != "\n":
        text = text.replace("\n", newline)
    with io.open(target, "wb") as f:
        f.write(text.encode("utf-8"))

    log("---- 書きこみ完了: %d か所（%d か所はすでに直っていた）" % (changed, skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
