# -*- coding: utf-8 -*-
"""小4理科 公開テスト No.6〜No.8 監査8本ぶんの内容パッチ（docs/_audit/g4r_w2/audit_3.txt 対応）。

対象8本（実質6原簿）: hd_4r_k06_579_4(HG-2816) / hd_4r_k06_591_4a・4b(HG-2828) /
hd_4r_k06_603_4a・4b(HG-2840) / hd_4r_k06_567_4(HG-2804) / hd_4r_k08_629_4(HG-1671) /
hd_4r_k08_593_4(HG-2830) を原簿と1本ずつ突き合わせ、答え自体はすべて独立検算で
一致したが、**SVGの座標を実測**すると2件の描画バグが見つかった（くわしい根拠は
docs/_audit/g4r_w2/findings_3.md）。

  1. HG-2828（hd_4r_k06_591_4a・4b）[図2] 豆電球「う」がTL-TR間の辺から浮いていて
     導線1本の行き止まりになっており、TL-TRは豆電球を経由しないバイパス導線で
     直結されている。あ・い・えと同じ「入口導線→豆電球→出口導線」の形に直す。
  2. HG-2840（hd_4r_k06_603_4a・4b）[図1] ぬいばりを磁化する矢印が、問題文の
     「矢印の向き（P→Qの右向き）」と逆のQ→P（左向き）に描かれている
     （marker-endは経路の終点に付く。d="M90,58 L10,58"は終点がP側＝左向き）。
     path座標の始点・終点を入れ替えて右向きに直す。

  いずれも原簿の元svgと文字列比較して同一のバグを引き継いでいることを確認ずみ
  （原本PDFの実際の絵とは無関係に、同じSVG内の他パーツとの様式不一致・問題文が
  明記するラベル配置との内部矛盾だけで判定できる）。原本PDFは今回もGoogle Drive
  未接続でアクセスできなかった（docs/_audit/g4r_w2/findings_3.md 冒頭）。

使い方:
  python scripts/_fix_g4r_w2_3.py [対象JSONのパス（省略時 data/hama_daimon.json）]

きまり:
  * 大問は scripts/genbo_common.py の iter_daimon だけで引く（走査を自前で書かない）
  * 欄まるごとではなく部分文字列の置換。置換前に「その大問のsvg欄の中でちょうど
    1回」を assert し、1件でもおかしければ1件も書かずに止める
  * 冪等：new がすでに入っていればスキップ。old でも new でもなければ中止
  * 豆電球うの新しい座標（入口(300,20)→(331,20)・circle(340,20) r=9・
    出口(349,20)→(380,20)）はcircleの半径9とぴったり接するように計算した値
    （340-9=331, 340+9=349）で、既存のあ・い・えの「入口→circle→出口」の
    描き方と同じ様式になることをPlaywrightで実際にレンダリングして確認ずみ。
  * 矢印は座標の並び順を反転するだけ（marker-end・色・太さは変更しない）。
    修正後もPlaywrightで再レンダリングし、矢じりがQ側（右）に来ることを
    確認ずみ。
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon  # noqa: E402


# ---------------------------------------------------------------------------
# 修正内容の定義。1件＝{daimon_id, hg, old, new, note}
# 対象欄はすべて x["svg"]（部分文字列の置換）。
# ---------------------------------------------------------------------------

# HG-2828 [図2] 豆電球「う」の行き止まりバグ（あ・い・えと同じ様式に直す）
_OLD_U = (
    '<circle cx="300.0" cy="6.0" r="9.0" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'
    '<line x1="295.1" y1="1.0" x2="304.9" y2="10.9" stroke="#4f9eff" stroke-width="1.3"/>'
    '<line x1="295.1" y1="10.9" x2="304.9" y2="1.0" stroke="#4f9eff" stroke-width="1.3"/>'
    '<text x="284.0" y="8.0" font-size="9" text-anchor="end" fill="#c9d4f0">豆電球う</text>'
    '<line x1="300.0" y1="15.0" x2="300.0" y2="20.0" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="300.0" y1="20.0" x2="380.0" y2="20.0" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="380.0" y1="18.0" x2="380.0" y2="20.0" stroke="#4f9eff" stroke-width="2"/>'
)
_NEW_U = (
    '<line x1="300.0" y1="20.0" x2="331.0" y2="20.0" stroke="#4f9eff" stroke-width="2"/>'
    '<circle cx="340.0" cy="20.0" r="9.0" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'
    '<line x1="335.1" y1="15.0" x2="344.9" y2="24.9" stroke="#4f9eff" stroke-width="1.3"/>'
    '<line x1="335.1" y1="24.9" x2="344.9" y2="15.0" stroke="#4f9eff" stroke-width="1.3"/>'
    '<text x="340.0" y="8.0" font-size="9" text-anchor="middle" fill="#c9d4f0">豆電球う</text>'
    '<line x1="349.0" y1="20.0" x2="380.0" y2="20.0" stroke="#4f9eff" stroke-width="2"/>'
)

# HG-2840 [図1] 磁化の矢印がQ→P（左向き）になっているバグ（P→Qの右向きに直す）
_OLD_ARROW = 'd="M90,58 L10,58"'
_NEW_ARROW = 'd="M10,58 L90,58"'

FIXES = [
    {"daimon_id": "hd_4r_k06_591_4a", "hg": "HG-2828", "old": _OLD_U, "new": _NEW_U,
     "note": "[図2]豆電球うをTL-TR間の辺上に組み込み直す"},
    {"daimon_id": "hd_4r_k06_591_4b", "hg": "HG-2828", "old": _OLD_U, "new": _NEW_U,
     "note": "[図2]豆電球うをTL-TR間の辺上に組み込み直す"},
    {"daimon_id": "hd_4r_k06_603_4a", "hg": "HG-2840", "old": _OLD_ARROW, "new": _NEW_ARROW,
     "note": "[図1]磁化の矢印をP→Q（右向き）に直す"},
    {"daimon_id": "hd_4r_k06_603_4b", "hg": "HG-2840", "old": _OLD_ARROW, "new": _NEW_ARROW,
     "note": "[図1]磁化の矢印をP→Q（右向き）に直す"},
]


# ---------------------------------------------------------------------------
# 図の座標検算（書き込む前に必ず通す。合わなければ1件も書かず止める）
# ---------------------------------------------------------------------------
def check_bulb_u(new_svg):
    """新しいsvgで、豆電球うがTL(300,20)-TR(380,20)間に正しく直列で入っているか。

    条件:
      ・TL-TR間を直結するバイパス導線（豆電球を経由しない直線）が残っていない
      ・入口導線 (300,20)-(331,20) がある（331 = circle中心340 - 半径9 = 左端）
      ・出口導線 (349,20)-(380,20) がある（349 = circle中心340 + 半径9 = 右端）
      ・circle(340,20) r=9 がある
    """
    bypass = '<line x1="300.0" y1="20.0" x2="380.0" y2="20.0"'
    if bypass in new_svg:
        return False, "TL-TR間の直結バイパス導線がまだ残っている"
    need = [
        '<line x1="300.0" y1="20.0" x2="331.0" y2="20.0"',
        '<circle cx="340.0" cy="20.0" r="9.0"',
        '<line x1="349.0" y1="20.0" x2="380.0" y2="20.0"',
    ]
    for n in need:
        if n not in new_svg:
            return False, "必要な要素が見あたらない: %r" % n
    # circle半径9と入口・出口導線の端点がぴったり接することを検算
    cx, r = 340.0, 9.0
    entry_end = 331.0
    exit_start = 349.0
    if abs(entry_end - (cx - r)) > 1e-9 or abs(exit_start - (cx + r)) > 1e-9:
        return False, "導線の端点がcircleの半径とずれている（座標検算NG）"
    return True, "豆電球うがTL-TR間に直列で組み込まれ、あ・い・えと同じ様式になった"


def check_arrow_direction(new_svg):
    """新しいsvgで、矢印がP→Q（右向き）になっているか。

    Pのラベルはx=-4.0(anchor=end)、Qのラベルはx=104.0(anchor=start)なので、
    P側がx座標小・Q側がx座標大。矢印pathの終点（marker-endが付く側）が
    Pよりx座標が大きい方（＝右向き＝Qに近づく向き）であることを確かめる。
    """
    if 'x="-4.0" y="72.0" font-size="11" text-anchor="end" fill="#c9d4f0">P<' not in new_svg:
        return False, "Pラベルの座標が想定と違う（P/Qの位置関係を検算できない）"
    if 'x="104.0" y="72.0" font-size="11" text-anchor="start" fill="#c9d4f0">Q<' not in new_svg:
        return False, "Qラベルの座標が想定と違う（P/Qの位置関係を検算できない）"
    if _NEW_ARROW not in new_svg:
        return False, "矢印pathの書きかえが反映されていない"
    # d="M10,58 L90,58" → 始点x=10, 終点x=90。marker-endは終点に付く。
    start_x, end_x = 10.0, 90.0
    p_x, q_x = -4.0, 104.0
    if not (p_x < start_x < end_x < q_x):
        return False, "矢印の始点・終点がP・Qの間に収まっていない（座標検算NG）"
    if not (end_x > start_x):
        return False, "矢じり（終点）がP側にある＝まだ左向き"
    return True, "矢じり（終点x=%.1f）がQ側（x=%.1f）を向き、P→Qの右向きになった" % (end_x, q_x)


SVG_CHECK = {
    "hd_4r_k06_591_4a": check_bulb_u,
    "hd_4r_k06_591_4b": check_bulb_u,
    "hd_4r_k06_603_4a": check_arrow_direction,
    "hd_4r_k06_603_4b": check_arrow_direction,
}


def apply_fix(d, fix):
    """1件のパッチを適用する。戻り値: (applied: bool, skipped_already_done: bool)"""
    matches = [
        rec for rec in iter_daimon(d)
        if isinstance(rec["x"], dict) and rec["x"].get("id") == fix["daimon_id"]
    ]
    if len(matches) != 1:
        raise AssertionError(
            "id=%s の大問が %d 本ヒット（1本のはず）" % (fix["daimon_id"], len(matches))
        )
    x = matches[0]["x"]
    svg = x.get("svg") or ""

    if fix["new"] in svg and fix["old"] not in svg:
        return False, True  # すでに適用ずみ（冪等）

    hit = svg.count(fix["old"])
    if hit != 1:
        raise AssertionError(
            "id=%s のsvg欄の中で置きかえ元が %d 回ヒット（1回のはず）\n"
            "置きかえ元の先頭80字: %r" % (fix["daimon_id"], hit, fix["old"][:80])
        )

    new_svg = svg.replace(fix["old"], fix["new"])

    checker = SVG_CHECK.get(fix["daimon_id"])
    if checker is not None:
        ok, msg = checker(new_svg)
        print("  図の検算 %s: %s" % (fix["daimon_id"], msg))
        if not ok:
            raise AssertionError(
                "id=%s の図が座標検算NG。1件も書かずに中止: %s" % (fix["daimon_id"], msg)
            )

    x["svg"] = new_svg
    return True, False


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    with io.open(path, encoding="utf-8") as f:
        d = json.load(f)

    # ── まず全件たしかめる（1件でもおかしければ1件も書かない）──
    plan = []
    for fix in FIXES:
        matches = [
            rec for rec in iter_daimon(d)
            if isinstance(rec["x"], dict) and rec["x"].get("id") == fix["daimon_id"]
        ]
        if len(matches) != 1:
            print("中止: id=%s の大問が %d 本ヒット（1本のはず）" % (fix["daimon_id"], len(matches)))
            return 1
        x = matches[0]["x"]
        svg = x.get("svg") or ""
        already = fix["new"] in svg and fix["old"] not in svg
        if not already:
            hit = svg.count(fix["old"])
            if hit != 1:
                if fix["new"] in svg:
                    # 適用ずみとみなす（念のための保険）
                    already = True
                else:
                    print("中止: id=%s のsvg欄で置きかえ元が %d 回ヒット（1回のはず）"
                          % (fix["daimon_id"], hit))
                    return 1
        plan.append((fix, already))

    applied = 0
    already_n = 0
    for fix, already in plan:
        if already:
            print("[SKIP]    %s (%s) %s はすでに適用ずみ" % (fix["daimon_id"], fix["hg"], fix["note"]))
            already_n += 1
            continue
        did, skipped = apply_fix(d, fix)
        tag = "%s (%s) %s" % (fix["daimon_id"], fix["hg"], fix["note"])
        if did:
            print("[FIX]     %s を書きかえました" % tag)
            applied += 1
        elif skipped:
            print("[SKIP]    %s はすでに適用ずみ" % tag)
            already_n += 1

    if applied == 0:
        print("書きかえるものが無いため、書き出しはしない。適用ずみ: %d件" % already_n)
        return 0

    out = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))

    print("適用: %d件 / 適用ずみ(スキップ): %d件 / 合計: %d件" % (applied, already_n, len(FIXES)))
    print("書き出し:", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
