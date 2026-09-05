# -*- coding: utf-8 -*-
"""小3マスター算数（公開テスト kokai No.2〜6・HG-0923〜HG-2668・24本）の
塾講師監査（docs/_audit/g3m_w1/findings_3.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_g3m_w1_3.py [対象JSON]
         （省略時は data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う（自前で入れ子を歩かない）。
・冪等：すでに直った状態なら黙って飛ばす（2回流してもJSONが変わらない）。
・24本を読んで指摘は 重大1・中4。うち中1件（HG-2667の(2)未実装）は5択の正誤判定という
  新規の小問設計が必要でこのスクリプトの範囲（既存テキストの機械的な置換）を超えるため
  見送り（findings_3.md参照）。原本（浜問題フォルダ）は本セッションではアクセス不可
  （Google Drive未接続・フォルダは空）だったが、直した4件はいずれも独立計算・原簿の
  文章そのものだけで判断できる「図のキャプションが答え／コア発見を先出ししている」不具合で、
  原本照合は不要。

直したもの（findings_3.md と対応。すべて観点3＝図と問題文の整合）:
  重大1  hd_3m_k05_614_5（HG-0985）
    小問1「10まいのカードに書かれている数を全て足し合わせると何になりますか」の答え(55)を、
    大問共通の図の緑字キャプション「ぜんぶ 足すと 55」がそのまま表示していた。
    検算: 1+2+…+10 = (1+10)+(2+9)+(3+8)+(4+7)+(5+6) = 11×5 = 55。
    キャプションを削除した（図の他の要素＝10まいのカードの絵は変更なし）。

  中1  hd_3m_k04_613_3（HG-0929）
    原簿は「図: なし」（HG-0929本文に明記）なのにアプリは独自図を追加し、緑字キャプション
    「□だん目には 1から□までが ならぶ」で、原簿の作問メモが明示するコア発見
    （第n群は1〜nのn個）をそのまま一般化した文で与えていた。3小問すべてがこの規則の理解を
    前提にしており、生徒が自力で気づく過程が丸ごとスキップされる。
    キャプションを削除した（区切り線と「1｜1,2｜1,2,3｜…」の並びは原文の可視化にすぎず
    問題ないので残した）。

  中2  hd_3m_k03_612_3（HG-0926）
    図の緑字キャプション「1かたまり＝5こ（○2こ・□2こ・△1こ）」が、小問2・小問3で使う
    核心情報（1周期に○は2こ・□は2こ）を先出ししていた。
    キャプションを削除した（「○, □, △, ○, □ の5こが くりかえす」＝周期の長さのみの
    キャプションは残した）。

  中3  hd_3m_k06_615_3（HG-0986）
    図の黄字キャプションの後半「（1かたまりの和は 8）」が、原簿の作問メモが明示する
    小問3のコア発見（1かたまりの和はいつも8）をそのまま先出ししていた。
    その部分だけを削り「1，3，1，2，1 が くりかえす」に短縮した（周期の中身の表示は
    原文にある情報の可視化なので残した）。

入力形式（choices/answerのテンキー・選択式）はどれも変えていない。新規SVGの追加・座標変更は無い
（既存の図から答え／コア発見を先出しするキャプション文だけを削る・縮める変更）。
"""
import io, json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon


# 各修正: id・src（照合用）・置換前・置換後。
# 置換後が "" のものは「キャプションをまるごと削除」、それ以外は「一部だけ短縮」。
FIXES = [
    {
        "id": "hd_3m_k05_614_5",
        "src": "HG-0985",
        "old": "<text x='10' y='63' fill='#06d6a0' font-size='10'>ぜんぶ 足すと 55</text>",
        "new": "",
    },
    {
        "id": "hd_3m_k04_613_3",
        "src": "HG-0929",
        "old": "<text x='10' y='68' fill='#06d6a0' font-size='9' text-anchor='start'>□だん目には 1から□までが ならぶ</text>",
        "new": "",
    },
    {
        "id": "hd_3m_k03_612_3",
        "src": "HG-0926",
        "old": "<text x='10' y='68' fill='#06d6a0' font-size='9' text-anchor='start'>1かたまり＝5こ（○2こ・□2こ・△1こ）</text>",
        "new": "",
    },
    {
        "id": "hd_3m_k06_615_3",
        "src": "HG-0986",
        "old": "1，3，1，2，1 が くりかえす（1かたまりの和は 8）",
        "new": "1，3，1，2，1 が くりかえす",
    },
]


def load_target(d, rid, src):
    found = []
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id") == rid:
            found.append(x)
    assert len(found) == 1, "daimon id が0本か複数本: %s (%d件)" % (rid, len(found))
    x = found[0]
    assert x.get("src") == src, "src が想定と違う（%s）: %r" % (rid, x.get("src"))
    return x


def apply_fix(x, fx):
    """1件ぶんの置換を適用する。戻り値: True=適用した / False=既に直っていて何もしなかった。"""
    svg = x.get("svg", "")
    assert isinstance(svg, str) and svg, "svg フィールドが無い: %s" % fx["id"]

    old, new = fx["old"], fx["new"]

    # 既に直っている（old が無く、new があるか／new="" で old も無い）なら冪等にスキップ
    if old not in svg:
        if new == "" or (new and new in svg):
            return False
        raise AssertionError(
            "%s: old も new も見つからない＝想定外の状態（他の変更と衝突した可能性）" % fx["id"]
        )

    cnt = svg.count(old)
    assert cnt == 1, "%s: 置換対象がちょうど1回でない（%d回）" % (fx["id"], cnt)

    x["svg"] = svg.replace(old, new, 1)
    return True


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")

    d = json.load(io.open(target, encoding="utf-8"))

    changed = 0
    skipped = 0
    for fx in FIXES:
        x = load_target(d, fx["id"], fx["src"])
        if apply_fix(x, fx):
            changed += 1
        else:
            skipped += 1

    io.open(target, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    sys.stdout.write("changed=%d  skipped(already-fixed)=%d  target=%s\n" % (changed, skipped, target))
    return 0


if __name__ == "__main__":
    sys.exit(main())
