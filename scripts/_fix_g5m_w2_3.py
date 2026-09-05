# -*- coding: utf-8 -*-
"""g5m_w2 監査3（kokai No.5〜9・35本）で見つかった不具合の修正パッチ。

対象: docs/_audit/g5m_w2/findings_3.md の「中1」1件のみ。
      （35本を独立検算した結果、答え・解説・学年逸脱・答え先渡し・重複は見つからなかった。
        唯一の不具合は hd_5m_k05_638_3 の図の座標が本文の数値と食いちがっていたこと）

直すのは data/hama_daimon.json の hd_5m_k05_638_3（HG-2638）の svg フィールドだけ:
  1. 【図1】三角形2の位置 … introが明記する「重なりの正三角形の1辺は3cm」
     （1辺6cmの正方形2まい）に対し、実際の座標は重なり幅22px(2.44cm)しかなく
     3cm(27px)に足りていなかった。三角形2を正しい位置（3cmぶん右）へずらす。
  2. 【図2】3まい目（下から重ねる三角形）の頂点位置 … 作問メモが明記する
     「3枚目の2辺は、上2枚の斜辺の延長にのっている」を満たしていなかった
     （現在の頂点は上2まいの底辺ライン上どまりで、本来の交点より0.94cm低い）。
     上2まいの斜辺を実際に延長して求めた交点(216,59.6)を頂点とする正しい
     三角形に差し替える。☆の補助線・ラベルは同じオフセットで平行移動する。

いずれも原簿レコード自身の文章記述（3cm・4cm・「斜辺の延長」）だけから座標を
再計算できるため、原本PDFの確認は不要（findings_3.md参照）。

使い方:
  python scripts/_fix_g5m_w2_3.py [対象JSONのパス]  （省略時 data/hama_daimon.json）

大問の参照は genbo_common.py の iter_daimon だけを使う。置換前に対象大問のsvgフィールドが
期待どおりの内容（1回だけ）かをassertし、書き換え後の値と既に一致していれば何もしない（冪等）。
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402


def load(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def dump(d, path):
    text = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))


def find_by_id(d, target_id):
    """iter_daimon だけを使って id で1本探す。無ければ None。"""
    hits = [r for r in iter_daimon(d, grade="5", app_courses=["master"])
            if r["x"].get("id") == target_id]
    assert len(hits) <= 1, u"id=%s が %d本ある（唯一のはず）" % (target_id, len(hits))
    return hits[0]["x"] if hits else None


# 目印文字列 → 正しい文字列。1件ずつ「置換前にちょうど1回だけ存在する」ことを確認してから置換する。
REPLACEMENTS = [
    # 1. 【図1】三角形2 … 6cm-3cm=3cm=27px ぶん右へ（底辺23-77 → 三角形2は50-104）
    (u"points='55.0,84 109.0,84 82,37.2'",
     u"points='50.0,84 104.0,84 77,37.2'",
     u"【図1】三角形2の位置（重なり3cmになるよう27pxずらす）"),
    # 2. 【図2】3まい目の頂点 … 上2まいの斜辺の延長の交点(216,59.6)を頂点とする三角形に差し替え
    (u"points='194.0,108.1 238.0,108.1 216,70'",
     u"points='194.0,97.7 238.0,97.7 216,59.6'",
     u"【図2】3まい目の頂点を、上2まいの斜辺の延長の交点(216,59.6)に合わせる"),
    # 3. ☆の補助線・ラベルを、3まい目の底辺が上がった分だけ同じオフセットで平行移動
    (u"x1='222.0' y1='114.1' x2='254.0' y2='114.1'",
     u"x1='222.0' y1='103.7' x2='254.0' y2='103.7'",
     u"☆の補助線を平行移動"),
    (u"x='238.0' y='126.1' fill='#ffd166' font-size='10' text-anchor='middle'>☆",
     u"x='238.0' y='115.7' fill='#ffd166' font-size='10' text-anchor='middle'>☆",
     u"☆のラベルを平行移動"),
]


def fix_hg2638(d):
    target_id = "hd_5m_k05_638_3"
    x = find_by_id(d, target_id)
    assert x is not None, u"id=%s が見つからない" % target_id
    assert x.get("src") == "HG-2638", u"id=%s のHG番号が想定と違う: %r" % (target_id, x.get("src"))

    cur = x.get("svg", "") or ""
    assert cur, u"id=%s の svg が空（想定外）" % target_id

    # 冪等チェック：すでに正しい座標に直っていれば何もしない
    already_fixed = all(new in cur for _, new, _ in REPLACEMENTS)
    still_old = any(old in cur for old, _, _ in REPLACEMENTS)
    if already_fixed and not still_old:
        print(u"  [skip] %s : 既に修正済み（冪等）" % target_id)
        return False

    new_svg = cur
    for old, new, note in REPLACEMENTS:
        cnt = new_svg.count(old)
        assert cnt == 1, (
            u"id=%s : 目印文字列 %r が1回のはずが%d回（想定外の内容のため中止）"
            % (target_id, old, cnt))
        new_svg = new_svg.replace(old, new)
        print(u"  [fix]  %s : %s" % (target_id, note))

    x["svg"] = new_svg
    return True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "data", "hama_daimon.json")
    path = os.path.abspath(path)
    print(u"対象: %s" % path)
    d = load(path)

    changed = fix_hg2638(d)

    if not changed:
        print(u"変更なし（すべて冪等スキップ）。ファイルは書き換えない。")
        return

    dump(d, path)
    print(u"書き戻した: %s" % path)


if __name__ == "__main__":
    main()
