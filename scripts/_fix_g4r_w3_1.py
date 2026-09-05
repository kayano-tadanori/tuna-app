# -*- coding: utf-8 -*-
"""小4理科 公開テスト No.8〜No.10 監査8本ぶんの内容パッチ（docs/_audit/g4r_w3/audit_1.txt 対応）。

対象8本を原簿と1本ずつ突き合わせ、答えは全問について独立に検算して一致を確認した
（表の比例式・磁石の背理法・鉄くぎの連鎖・グラフ探索・ゴムひも直列の消去算、いずれも
検算OK）。そのうえで3件の内容不備が見つかった（くわしい根拠は
docs/_audit/g4r_w3/findings_1.md）。

  1. HG-1672（hd_4r_k10_631_4・7つのたん子と4個の電池）
     原簿の設問は(1)〜(5)の5問だが、アプリには(1)〜(4)しか入っておらず、
     (5)（どう線3本・たん子Bとたん子Dに豆電球＝答え「基準と同じ明るさ」）が
     まるごと抜けていた。作問メモが名指しする「エ→ア→ア→ウ→ウ」という
     "学んだ手を最後で壊す"勾配の最後の1段が欠けている。独立に解き直して
     答えが確定していることを確認したうえで、steps に5問目を追加する。

  2. HG-2820（hd_4r_k10_583_4・3まいのかがみの重なり＋虫めがねの表）
     [図1]（3枚の長方形が重なったベン図）で、「き」（下のかがみだけ＝
     3つの長方形のうちR3だけに入る領域）のラベルが (100,105) に置かれて
     いるが、この座標は実際には R1∩R3（＝「か」の意味する2枚重なり）の
     内側であり、「か」のラベル(65,92)と同じ重なり領域を指してしまって
     いる。原簿の元svgと文字列比較して同一の座標を引き継いでいることを
     確認ずみ＝原簿自体の転記ミス。R1・R2・R3のどれにも属さず R3だけに
     入る座標(125,105)に動かす。

  3. HG-2806（hd_4r_k08_569_4・じしゃくの極を逆にたどる）
     原簿(1)は「じしゃくにつくものをすべてえらぶ」8択・正解2つ
     （エ＝スチールウール／ク＝鉄でできたクリップ）だが、アプリの小問1は
     選択肢からクリップを丸ごと落として単一選択（スチールウールのみ）に
     縮めてあり、「鉄でできたクリップも鉄だからつく」という原簿が
     テストしたかった半分が消えている。同じ回の他の大問（HG-2818の
     小問1）が採用している「複数正解を1つの文字列にまとめた選択肢」に
     合わせて、2つとも正解に含む形へ戻す。

  原本PDF（C:\\Users\\User\\Desktop\\浜問題\\4年理科\\）はGoogle Driveが
  未接続でアクセスできず、今回も未確認（findings_1.md冒頭に記載）。
  上の3件はいずれも原本を必要とせず、原簿の文章記録・アプリ内の他の
  大問との様式比較・座標の独立検算だけで判定できるものだけを直した。

使い方:
  python scripts/_fix_g4r_w3_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

きまり:
  * 大問は scripts/genbo_common.py の iter_daimon だけで引く（走査を自前で書かない）
  * 置換・追加の前に「その大問の中でちょうど1回」に該当することを assert し、
    1件でもおかしければ1件も書かずに中止する
  * 冪等：new（またはすでに5問目がある状態）ならスキップ
  * 大問まるごとの削除・移動はしない。既存の問題文・答えの様式（choices/テンキー）
    は変えない
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


def find_one(d, daimon_id):
    matches = [
        rec for rec in iter_daimon(d)
        if isinstance(rec["x"], dict) and rec["x"].get("id") == daimon_id
    ]
    if len(matches) != 1:
        raise AssertionError(
            "id=%s の大問が %d 本ヒット（1本のはず）" % (daimon_id, len(matches))
        )
    return matches[0]["x"]


# ---------------------------------------------------------------------------
# FIX 1: HG-1672（hd_4r_k10_631_4）steps に(5)を追加
# ---------------------------------------------------------------------------
STEP5_HG1672 = {
    "question": (
        "どう線を3本用意し、たん子Aとたん子Dに1本、たん子Bとたん子Eにもう1本、"
        "さらにたん子Cとたん子Eに1本つなぎ、たん子Bとたん子Dに豆電球をつなぐと、"
        "豆電球はどうなりますか。"
    ),
    "answer": "基準と同じ明るさでつく",
    "choices": [
        "基準より明るくつく",
        "基準より暗くつく",
        "基準と同じ明るさでつく",
        "明かりはつかない",
    ],
    "meaning": (
        "どう線で A＝D、B＝E＝C になる。すると電池イ（D→B）と電池ウ（A→E）が"
        "同じ向きで並列につながる（A＝Dだから＋側が同じ、B＝Eだから－側も同じ）。"
        "豆電球はB－D間、つまりこの並列電池の両はしにつながるので、並列は何個"
        "あっても1個分＝基準と同じ明るさ。（電池ア・エはF・Gが行き止まりなので、"
        "電流は流れない。）"
    ),
}
STEP5_MARK = "たん子Bとたん子Dに豆電球をつなぐと"  # 冪等チェック用の一意な部分文字列


def fix_hg1672_add_step5(d):
    x = find_one(d, "hd_4r_k10_631_4")
    steps = x.get("steps")
    if not isinstance(steps, list):
        raise AssertionError("hd_4r_k10_631_4 に steps が無い")

    hit = sum(1 for s in steps if STEP5_MARK in (s.get("question") or ""))
    if hit >= 1:
        return False, True  # すでに5問目がある＝適用ずみ

    if len(steps) != 4:
        raise AssertionError(
            "hd_4r_k10_631_4 の steps が想定と違う（4問のはずが%d問）。"
            "先に内容を目視確認すること。" % len(steps)
        )

    steps.append(dict(STEP5_HG1672))
    return True, False


# ---------------------------------------------------------------------------
# FIX 2: HG-2820（hd_4r_k10_583_4）[図1]「き」のラベル座標を直す
# ---------------------------------------------------------------------------
_OLD_KI = '<text x="100.0" y="105.0" font-size="12" text-anchor="middle" fill="#c9d4f0">き</text>'
_NEW_KI = '<text x="125.0" y="105.0" font-size="12" text-anchor="middle" fill="#c9d4f0">き</text>'

# 3枚のかがみの矩形（[図1]）。書きかえ前に、この3つがsvg中に存在し、かつ
# 想定どおりの位置関係であることを確かめてから、新しい座標が
# 「R3にだけ入る（R1にもR2にも入らない）」ことを検算する。
_RECT_R1 = '<rect x="20.0" y="30.0" width="90.0" height="80.0" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'
_RECT_R2 = '<rect x="70.0" y="20.0" width="90.0" height="60.0" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'
_RECT_R3 = '<rect x="50.0" y="60.0" width="90.0" height="60.0" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'


def _inside(pt, rect):
    x, y, x2, y2 = rect
    px, py = pt
    return x <= px <= x2 and y <= py <= y2


def _check_ki_coords(svg):
    """新しい「き」の座標(125,105)が、R1・R2に入らずR3にだけ入ることを検算する。

    R1(左)=x20-110,y30-110 / R2(右)=x70-160,y20-80 / R3(下)=x50-140,y60-120
    （rect x,y,width,heightから x2=x+width, y2=y+height で算出）。
    """
    for tag in (_RECT_R1, _RECT_R2, _RECT_R3):
        if tag not in svg:
            return False, "想定した矩形（かがみ）が見あたらない: %r" % tag[:50]

    r1 = (20.0, 30.0, 20.0 + 90.0, 30.0 + 80.0)
    r2 = (70.0, 20.0, 70.0 + 90.0, 20.0 + 60.0)
    r3 = (50.0, 60.0, 50.0 + 90.0, 60.0 + 60.0)

    old_pt = (100.0, 105.0)
    old_memb = [n for n, r in (("R1", r1), ("R2", r2), ("R3", r3)) if _inside(old_pt, r)]
    if old_memb != ["R1", "R3"]:
        return False, "旧座標(100,105)の想定が違う（%r）。座標検算の前提がずれている" % old_memb

    new_pt = (125.0, 105.0)
    new_memb = [n for n, r in (("R1", r1), ("R2", r2), ("R3", r3)) if _inside(new_pt, r)]
    if new_memb != ["R3"]:
        return False, "新座標(125,105)がR3だけに入っていない（実際: %r）" % new_memb

    # 「か」のラベル(65,92)がR1∩R3のままであることも確認（新座標と別領域であること）
    ka_pt = (65.0, 92.0)
    ka_memb = [n for n, r in (("R1", r1), ("R2", r2), ("R3", r3)) if _inside(ka_pt, r)]
    if ka_memb != ["R1", "R3"]:
        return False, "「か」の座標(65,92)の想定が違う（%r）" % ka_memb

    return True, "「き」の新座標(125,105)はR3だけに入る（旧座標(100,105)は「か」と同じR1∩R3だった）"


def fix_hg2820_ki_coords(d):
    x = find_one(d, "hd_4r_k10_583_4")
    svg = x.get("svg") or ""

    if _NEW_KI in svg and _OLD_KI not in svg:
        return False, True  # 適用ずみ

    hit = svg.count(_OLD_KI)
    if hit != 1:
        raise AssertionError(
            "hd_4r_k10_583_4 のsvg欄で「き」ラベルの置きかえ元が %d 回ヒット（1回のはず）" % hit
        )

    new_svg = svg.replace(_OLD_KI, _NEW_KI)
    ok, msg = _check_ki_coords(new_svg)
    print("  図の検算 hd_4r_k10_583_4: %s" % msg)
    if not ok:
        raise AssertionError("hd_4r_k10_583_4 の図が座標検算NG。1件も書かずに中止: %s" % msg)

    x["svg"] = new_svg
    return True, False


# ---------------------------------------------------------------------------
# FIX 3: HG-2806（hd_4r_k08_569_4）steps[0]を複数正解が分かる形に戻す
# ---------------------------------------------------------------------------
_OLD_STEP0_HG2806 = {
    "question": "じしゃくにつくものを選びなさい。",
    "answer": "スチールウール",
    "choices": ["木", "10円玉", "1円玉", "スチールウール", "アルミニウムはく"],
    "meaning": (
        "じしゃくにつくのは鉄などの一部の金属だけです。スチールウール（鉄）は"
        "つきますが、10円玉（銅）・1円玉やアルミニウムはく（アルミニウム）・"
        "木はつきません。"
    ),
}
_NEW_STEP0_HG2806 = {
    "question": "じしゃくにつくものをすべて選びなさい。",
    "answer": "スチールウール、鉄でできたクリップ",
    "choices": [
        "スチールウール、鉄でできたクリップ",
        "10円玉、スチールウール、鉄でできたクリップ",
        "スチールウール、1円玉、鉄でできたクリップ",
        "アルミニウムはく、スチールウール、鉄でできたクリップ",
    ],
    "meaning": (
        "じしゃくにつくのは鉄だけです。スチールウール（鉄）と鉄でできた"
        "クリップは、どちらも鉄なのでじしゃくにつきます。10円玉（銅）・"
        "1円玉やアルミニウムはく（アルミニウム）・木はじしゃくにつきません。"
    ),
}


def fix_hg2806_step0(d):
    x = find_one(d, "hd_4r_k08_569_4")
    steps = x.get("steps")
    if not isinstance(steps, list) or len(steps) < 1:
        raise AssertionError("hd_4r_k08_569_4 に steps[0] が無い")
    step = steps[0]

    if step == _NEW_STEP0_HG2806:
        return False, True  # 適用ずみ

    if step != _OLD_STEP0_HG2806:
        raise AssertionError(
            "hd_4r_k08_569_4 steps[0] が想定外の内容（old にも new にも一致しない）\n"
            "実際: %r" % step
        )

    steps[0] = dict(_NEW_STEP0_HG2806)
    return True, False


FIXES = [
    ("hd_4r_k10_631_4 (HG-1672)", "(5)を追加：どう線3本・たん子B/D＝基準と同じ明るさ", fix_hg1672_add_step5),
    ("hd_4r_k10_583_4 (HG-2820)", "[図1]「き」のラベル座標を(100,105)→(125,105)に修正", fix_hg2820_ki_coords),
    ("hd_4r_k08_569_4 (HG-2806)", "小問1を複数正解（スチールウール＋鉄でできたクリップ）に復元", fix_hg2806_step0),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    applied = 0
    already = 0
    for tag, note, fn in FIXES:
        did, skipped = fn(d)
        label = "%s %s" % (tag, note)
        if did:
            print("[FIX]     %s" % label)
            applied += 1
        elif skipped:
            print("[SKIP]    %s はすでに適用ずみ" % label)
            already += 1

    if applied == 0:
        print("書きかえるものが無いため、書き出しはしない。適用ずみ: %d件" % already)
        return 0

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))

    print("適用: %d件 / 適用ずみ(スキップ): %d件 / 合計: %d件" % (applied, already, len(FIXES)))
    print("書き出し:", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
