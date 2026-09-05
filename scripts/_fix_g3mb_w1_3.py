# -*- coding: utf-8 -*-
"""
小3マスター算数 第1分冊 fukushu No.6〜No.7 の監査（docs/_audit/g3mb_w1/audit_3.txt）で
見つかった不具合を data/hama_daimon.json に当てるパッチ。

対象4件:
  hd3mb_06_7  (HG-4074) 図SVG: 学年別の個別セル30件＋学年ごとの「計」列6件が図から丸ごと欠落。
              設問①③（欠席がいちばん多い／少ない学年）が図の情報だけでは答えられない。
              原本 3年マスター算数第1分冊 復習No.6 やさしい7（本文p59）を実測して補完する。
  hd3mb_06_9  (HG-4076) 図SVG: 折れ線の縦位置が実測の水温データ(6,8,10,12,14,16,18時→
              22,25,29,36,37,33,26度)と矛盾し、12時と14時の高さが実質入れかわっていた
              （図だけを見ると山が12時に見えるが、正解は14時）。原本 本文p60 の実測値で
              y座標を y=110-(気温-20)*5 の一次式に立て直す。
  hd3mb_06_12 (HG-4079) 小問3(あ)の解説が、まだ出題していない小問4(い)の答え(2人)を
              先に見せていた（原簿の解法をそのまま流用したため）。小問3は自分の答え(あ=3)
              だけを説明するように書きかえる。
  hd3mb_07_3  (HG-4083) 小問ア・イ・ウの解説が、それぞれ後で出題される小問イ・オ・エの
              答えを先に見せていた（原簿の解く順エ→オ→ウ→イ→アと、出題順ア→イ→ウ→エ→オが
              食いちがっていたため）。出題文・答え・解説の中身はいっさい書きかえず、
              小問の並び順だけを解く順（総人数→エ→オ→ウ→イ→ア）に差しかえる。

用法:
  python scripts/_fix_g3mb_w1_3.py [対象JSONのパス]   # 省略時は data/hama_daimon.json

設計:
  ・大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  ・巨大JSONへの生Python置換はアンカーの一意性が命 → 置換前に必ず raw.count(anchor)==1 を
    assert する（feedback_anchor_uniqueness の教訓）。json.dump による全体再整形はしない
    （インデントが不揃いな8MBファイルを丸ごと書き直すと無関係な差分が大量に出るため）。
  ・冪等: 新しい形が既に入っていれば「変更なし」として何もしない。2回流してもMD5は変わらない。
  ・図SVGは検算が通った項目だけを直す。1つでも前提が崩れていれば例外を投げて即終了し、
    ファイルには一切書き込まない（全部成功したときだけ最後に1回 io.open(path,"wb") で書く）。
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon  # noqa: E402  ★大問はここだけで引く

TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")


def get_daimon(d, daimon_id):
    for r in iter_daimon(d):
        if r["x"].get("id") == daimon_id:
            return r["x"]
    raise SystemExit("daimon not found: " + daimon_id)


def find_balanced(text, start):
    """text[start] は '{' か '['。対応する閉じ括弧の直後の位置を返す。
    文字列リテラルの中の {}[] は数えない。{ と [ が混ざってネストしても正しく対応させる。"""
    stack = [text[start]]
    i = start + 1
    n = len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c in "{[":
                stack.append(c)
            elif c in "}]":
                stack.pop()
                if not stack:
                    return i + 1
        i += 1
    raise ValueError("unbalanced json fragment")


def enumerate_top_objects(s):
    """s（配列の中身）の中にあるトップレベルの {...} オブジェクトを順に (start,end) で返す。"""
    out = []
    i = 0
    n = len(s)
    in_str = False
    while i < n:
        c = s[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            i += 1
            continue
        if c == "{":
            end = find_balanced(s, i)
            out.append((i, end))
            i = end
            continue
        i += 1
    return out


def replace_field(raw, old_value, new_value, label):
    """1つの文字列フィールドの値を、JSONエスケープごと丸ごと置換する。
    raw 全体で old_value がちょうど1回のときだけ置換する。
    old_value が見つからず new_value が既に1回あれば「もう直っている」として何もしない。"""
    anchor_old = json.dumps(old_value, ensure_ascii=False)
    anchor_new = json.dumps(new_value, ensure_ascii=False)
    cnt_old = raw.count(anchor_old)
    if cnt_old == 0:
        if raw.count(anchor_new) >= 1:
            return raw, False
        raise SystemExit("NOT FOUND (old も new も無い): %s" % label)
    if cnt_old != 1:
        raise SystemExit("NOT UNIQUE (%d 箇所): %s" % (cnt_old, label))
    return raw.replace(anchor_old, anchor_new, 1), True


# ─────────────────────────────────────────────────────────────────────────
# Fix 1: hd3mb_06_7 (HG-4074) — 図に学年別の個別セルと学年計列を追加する
# ─────────────────────────────────────────────────────────────────────────
def fix_hd3mb_06_7(d, raw):
    x = get_daimon(d, "hd3mb_06_7")
    old_svg = x["svg"]

    # 原本 3年マスター算数第1分冊 復習No.6 やさしい7（本文p59）を実測した表。
    # 行=学年(y座標は既存の行ラベルと同じ)、値=[月,火,水,木,金]、最後が学年計。
    ROWS = [
        ("62.5",  [2, 1, 0, 3, 1], 7),   # 1年
        ("88.5",  [3, 0, 1, 2, 0], 6),   # 2年
        ("114.5", [0, 1, 2, 2, 1], 6),   # 3年
        ("140.5", [1, 1, 1, 1, 0], 4),   # 4年
        ("166.5", [0, 0, 3, 1, 0], 4),   # 5年
        ("192.5", [1, 0, 0, 0, 2], 3),   # 6年
    ]
    DAY_X = ["57", "91", "125", "159", "193"]
    TOTAL_X = "227"

    # 検算: 行合計・列合計・総計が既存の「計」行（月火水木金=7,3,7,9,4／総計30）と一致すること
    for _, vals, tot in ROWS:
        assert sum(vals) == tot, ("row sum mismatch", vals, tot)
    col_sums = [sum(r[1][i] for r in ROWS) for i in range(5)]
    assert col_sums == [7, 3, 7, 9, 4], ("col sum mismatch", col_sums)
    assert sum(r[2] for r in ROWS) == 30, "grand total mismatch"

    add = []
    for y, vals, tot in ROWS:
        for xx, v in zip(DAY_X, vals):
            add.append(
                '<text x="%s" y="%s" font-size="10" text-anchor="middle" fill="#c9d4f0">%d</text>'
                % (xx, y, v)
            )
        add.append(
            '<text x="%s" y="%s" font-size="10" text-anchor="middle" fill="#c9d4f0">%d</text>'
            % (TOTAL_X, y, tot)
        )
    insertion = "".join(add)

    if insertion in old_svg:
        return raw, False  # 既に反映済み

    if not old_svg.endswith("</svg>"):
        raise SystemExit("hd3mb_06_7: 想定外のsvg終端。座標検算のやり直しが必要")
    new_svg = old_svg[: -len("</svg>")] + insertion + "</svg>"

    return replace_field(raw, old_svg, new_svg, "hd3mb_06_7.svg")


# ─────────────────────────────────────────────────────────────────────────
# Fix 2: hd3mb_06_9 (HG-4076) — 折れ線グラフの縦位置を実測データに合わせて引き直す
# ─────────────────────────────────────────────────────────────────────────
def fix_hd3mb_06_9(d, raw):
    x = get_daimon(d, "hd3mb_06_9")
    old_svg = x["svg"]

    # 原本 3年マスター算数第1分冊 復習No.6 むずかしい2（本文p60）の実測値。
    # 時刻: 6,8,10,12,14,16,18時 → 水温: 22,25,29,36,37,33,26度
    # y = 110 - (気温-20)*5 という一次式（既存の6時=100・18時=80はこの式のままで正しい値だった）
    TIMES_X = ["30", "66.6667", "103.333", "140", "176.667", "213.333", "250"]
    TEMPS = [22, 25, 29, 36, 37, 33, 26]
    NEW_Y = [110 - (t - 20) * 5 for t in TEMPS]
    OLD_Y_EXPECTED = ["100", "60", "30", "25", "45", "70", "80"]

    assert NEW_Y == [100, 85, 65, 30, 25, 45, 80], ("y recompute mismatch", NEW_Y)
    # 検算: ②いちばん高い=14時・③いちばん低い=6時・④変化最大=10-12時と16-18時、と一致すること
    peak_i = NEW_Y.index(min(NEW_Y))
    trough_i = NEW_Y.index(max(NEW_Y))
    assert peak_i == 4, "peak should be 14時(index4)"       # 14時
    assert trough_i == 0, "trough should be 6時(index0)"     # 6時
    diffs = [abs(NEW_Y[i + 1] - NEW_Y[i]) for i in range(6)]
    assert max(diffs) == 35 and diffs.count(35) == 2 and diffs[2] == 35 and diffs[5] == 35, \
        ("biggest-change check failed", diffs)  # 10-12時間・16-18時間

    new_svg = old_svg
    changed_any = False
    for xcoord, old_y, new_y in zip(TIMES_X, OLD_Y_EXPECTED, [str(y) for y in NEW_Y]):
        if old_y == new_y:
            continue  # 6時・18時はもともと正しい値なので触らない
        pairs = [
            ('x2="%s" y2="%s"' % (xcoord, old_y), 'x2="%s" y2="%s"' % (xcoord, new_y)),
            ('x1="%s" y1="%s"' % (xcoord, old_y), 'x1="%s" y1="%s"' % (xcoord, new_y)),
            ('cx="%s" cy="%s"' % (xcoord, old_y), 'cx="%s" cy="%s"' % (xcoord, new_y)),
        ]
        for old_sub, new_sub in pairs:
            cnt = new_svg.count(old_sub)
            if cnt == 0:
                continue
            if cnt != 1:
                raise SystemExit(
                    "hd3mb_06_9: 置換前チェックで一意にならない (%d件): %r" % (cnt, old_sub)
                )
            new_svg = new_svg.replace(old_sub, new_sub, 1)
            changed_any = True

    if not changed_any:
        # 全部「既に新しい座標」だったか、想定外の中身か切り分ける
        new_coords_present = all(
            (('cy="%s"' % ny) in old_svg) or (('y2="%s"' % ny) in old_svg)
            for ny in ["85", "65", "30", "25", "45"]
        )
        if new_coords_present:
            return raw, False
        raise SystemExit("hd3mb_06_9: 置換対象が1つも見つからなかった")

    return replace_field(raw, old_svg, new_svg, "hd3mb_06_9.svg")


# ─────────────────────────────────────────────────────────────────────────
# Fix 3: hd3mb_06_12 (HG-4079) — 小問3(あ)の解説が小問4(い)の答えを先出ししている
# ─────────────────────────────────────────────────────────────────────────
def fix_hd3mb_06_12(d, raw):
    x = get_daimon(d, "hd3mb_06_12")
    steps = x["steps"]

    old_meaning = "わかっている35人ぶんの合計114点を125から引くと11点。あ(3点)3人・い(1点)2人でこの11点が作れる。"
    new_meaning = "わかっている35人ぶんの合計114点を125から引くと11点。あ・い合わせて5人でこの11点を作れるのは、あ(3点)が3人のときである。"

    found = any(s.get("meaning") == old_meaning for s in steps)
    if not found:
        if any(s.get("meaning") == new_meaning for s in steps):
            return raw, False
        raise SystemExit("hd3mb_06_12: 対象の解説が見つからない")

    # 検算: 差しかえ後も「あ=3」という結論部分はそのまま残っていること（答えを弱めていないか）
    assert "あ(3点)が3人" in new_meaning
    assert "い" not in new_meaning.split("あ・い合わせて5人でこの11点を作れるのは、")[1]

    return replace_field(raw, old_meaning, new_meaning, "hd3mb_06_12.steps[].meaning")


# ─────────────────────────────────────────────────────────────────────────
# Fix 4: hd3mb_07_3 (HG-4083) — ア・イ・ウの解説が後続の小問の答えを先出ししている
#   出題文・答え・解説はいっさい書きかえず、小問の並び順だけを解く順に差しかえる。
# ─────────────────────────────────────────────────────────────────────────
def fix_hd3mb_07_3(d, raw):
    x = get_daimon(d, "hd3mb_07_3")
    steps = x["steps"]

    def key_of(q):
        if "クラスの人数" in q:
            return "total"
        for letter in ("ア", "イ", "ウ", "エ", "オ"):
            if q.startswith(letter + "に"):
                return letter
        raise SystemExit("hd3mb_07_3: 見覚えのない設問文: " + q)

    order_key = [key_of(s["question"]) for s in steps]
    desired = ["total", "エ", "オ", "ウ", "イ", "ア"]

    if order_key == desired:
        return raw, False  # 既に解く順に並んでいる

    if sorted(order_key) != sorted(desired):
        raise SystemExit("hd3mb_07_3: 小問の顔ぶれが想定と違う: %r" % order_key)

    # 検算: 並べかえ後、各小問の解説が「その時点までに出た値」だけを参照していること
    #   （エ・オ→総計と既知の列計/行計のみ。ウ→エの答え。イ→オの答え。ア→イの答え）
    by_key = {k: s for k, s in zip(order_key, steps)}
    assert "エ=20" in by_key["ウ"]["meaning"]
    assert "オ=19" in by_key["イ"]["meaning"]
    assert "イ(11)" in by_key["ア"]["meaning"]

    id_anchor = json.dumps(x["id"], ensure_ascii=False)
    if raw.count(id_anchor) != 1:
        raise SystemExit("hd3mb_07_3: id アンカーが一意でない")
    id_pos = raw.index(id_anchor)
    steps_key_pos = raw.index('"steps"', id_pos)
    bracket_pos = raw.index("[", steps_key_pos)
    array_end = find_balanced(raw, bracket_pos)
    old_array_text = raw[bracket_pos:array_end]

    inner = old_array_text[1:-1]
    blocks_rel = enumerate_top_objects(inner)
    assert len(blocks_rel) == len(order_key) == 6, "hd3mb_07_3: 小問の数が合わない"
    blocks = [(s + 1, e + 1) for s, e in blocks_rel]  # old_array_text内の絶対位置

    prefix = old_array_text[1: blocks[0][0]]
    seps = [old_array_text[blocks[i][1]: blocks[i + 1][0]] for i in range(len(blocks) - 1)]
    suffix = old_array_text[blocks[-1][1]: len(old_array_text) - 1]
    block_texts = [old_array_text[s:e] for s, e in blocks]

    idx_of = {k: i for i, k in enumerate(order_key)}
    new_blocks = [block_texts[idx_of[k]] for k in desired]

    new_inner = prefix
    for i, b in enumerate(new_blocks):
        new_inner += b
        if i < len(new_blocks) - 1:
            new_inner += seps[i]
    new_inner += suffix
    new_array_text = "[" + new_inner + "]"

    cnt = raw.count(old_array_text)
    if cnt != 1:
        raise SystemExit("hd3mb_07_3: steps配列アンカーが一意でない (%d件)" % cnt)
    raw = raw.replace(old_array_text, new_array_text, 1)
    return raw, True


def main():
    raw = io.open(TARGET, "r", encoding="utf-8").read()
    d = json.loads(raw)

    fixes = [fix_hd3mb_06_7, fix_hd3mb_06_9, fix_hd3mb_06_12, fix_hd3mb_07_3]
    applied = 0
    for fn in fixes:
        raw, changed = fn(d, raw)
        print(("APPLIED : " if changed else "SKIP    : ") + fn.__name__)
        if changed:
            applied += 1

    if applied == 0:
        print("変更なし（既に最新の状態）: %s" % TARGET)
        return

    # 書き出す前に、壊れたJSONになっていないか必ず再パースする
    json.loads(raw)

    with io.open(TARGET, "wb") as f:
        f.write(raw.encode("utf-8"))
    print("書き込み完了: %s（%d件適用）" % (TARGET, applied))


if __name__ == "__main__":
    main()
