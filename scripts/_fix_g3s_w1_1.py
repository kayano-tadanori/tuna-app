# -*- coding: utf-8 -*-
u"""docs/_audit/g3s_w1/findings_1.md の指摘を hama_daimon.json に当てる修正パッチ。

  python scripts/_fix_g3s_w1_1.py [対象JSON]      （省略時 data/hama_daimon.json）

対象: 小3最レ算数 fukushu No.0〜No.13・44本監査（audit_1.txt）。

直した内容（詳細は findings_1.md）:
  重大1  hd_3s_f06_2 (HG-0311) … 小問1〜3が ㋐・㋑・㋒ の表す数を問うのに、
    共有svg（top-level）は「9を表す例」の図が1枚あるだけで、㋐・㋑・㋒ の
    方眼パターンがどこにも無い（js/sansu.js の `step.svg || chain.svg` により
    3小問とも同じ「9の例」しか表示されない）。原簿自身も同じ1枚しか記録して
    おらず、図が本来3枚（例・空欄・設問）必要なところ1枚しか写し取れて
    いなかったとみられる（feedback_sync_genbo_svg_bugと同型の欠落）。
    ㋐=12・㋑=101・㋒=194 は原簿の答えそのもの（確定値）で、位取りの規則
    （右から1・5・25・125、各列は下から4マスまで塗る＝5進法）も intro
    にすでに明記されている確定ルールなので、この2つから各小問専用の図を
    機械的に再構成できる（想像で補うのではなく、確定済みの規則＋確定済みの
    答えの組み合わせ）。steps[0..2].svg に、それぞれの数を表す方眼図を追加した。
  重大2  hd_3s_f06_5 (HG-0314) … 小問3の設問文が「図のように (C,B,A)＝(3,0,3)
    のとき」と、図が小問3の状態そのものであると明言しているのに、実際の
    共有svgの針は A=3(左)・B=2(下)・C=1(右) の状態を指していて、(C,B,A)＝
    (3,0,3) （C=3→左, B=0→上, A=3→左）とは一致しない（B・Cの針が違う）。
    小問1・2は「図のように」と明言していない（自力の計算だけで解ける）ため、
    共有図をそのまま小問3の状態に描きなおしても他の小問の答えは漏れない。
    B・Cの針の座標とキャプションを (C,B,A)=(3,0,3) に合わせて描きなおした。
  軽1  hd_3s_f03_7 (HG-0322) … 表の右端セルが ㋐・㋑（原簿の設問文・アプリの
    小問文の両方でこの表記）であるべきところ、svg内では「⑦」「①」という
    別のUnicode記号（丸数字）になっている。このデータセット内で ㋐㋑㋒…
    ラベルは一貫して使われており（hd_3s_f01_5, hd_3s_f05_10/11, hd_3s_f12_2 等）、
    丸数字が使われている例は他に無いため、生成時の文字化け・取り違えと判断
    できる（行ラベル☆に対応する列なので答え自体に影響は無いが、設問文の
    表記と食い違い紛らわしいので軽微として修正）。⑦→㋐、①→㋑ に直した。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う
  * "R"（部分置換）は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    → [[feedback_anchor_uniqueness]]
  * "S"（欄まるごと置換。今回は steps[i].svg という「まだ無い欄」への新規追加）は、
    現在値が想定どおりの旧値（無ければ空文字列）と完全一致することを
    確かめてから置く。既に新値なら何もしない（冪等）
  * 図SVGは、書きこむ前に座標・位取りの計算からその大問の答えと一致することを
    確認する（本ファイル内の _verify_base5_svgs で実施。1件でも合わなければ
    AssertionErrorで停止し、1件も書きこまない）
  * 何度流しても同じ結果（すでに直っていればスキップ）
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化ける）
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

DEFAULT_JSON = os.path.join(ROOT, "data", "hama_daimon.json")


# ============================================================ 対象の存在・原簿番号確認
TARGETS = {
    "hd_3s_f06_2": "HG-0311",
    "hd_3s_f06_5": "HG-0314",
    "hd_3s_f03_7": "HG-0322",
}


# ================================================== hd_3s_f06_2 用：5進法の方眼図を作る
# たて4マス・よこ4マスの方眼。右から 1・5・25・125 の位で、各列は「下から」順に
# 黒くぬる（1つの列は4マスまで＝5進法）。これは intro に明記された確定ルール。
# ㋐=12・㋑=101・㋒=194 は原簿(HG-0311)の答えそのもの（確定値）。
_COLS = [90.0, 122.0, 154.0, 186.0]     # 左から 125,25,5,1 の位（もとの図と同じ座標）
_ROWS = [30.0, 62.0, 94.0, 126.0]       # 上から。ぬるのは下(126)から順に
_PLACES = [125, 25, 5, 1]


def _digits_base5(n):
    """n を (125の位, 25の位, 5の位, 1の位) に分解する（各0〜4）。"""
    out = []
    rem = n
    for p in _PLACES:
        out.append(rem // p)
        rem = rem % p
    assert rem == 0, "5進法の位取りで割り切れない数: %d" % n
    for d in out:
        assert 0 <= d <= 4, "桁が0〜4の範囲を超えた: %d (n=%d)" % (d, n)
    return out


def _build_base5_svg(n, label):
    """n を表す方眼図のSVGを作る。labelは表示用の記号（㋐/㋑/㋒）。"""
    ds = _digits_base5(n)
    base_rects = []
    for x in _COLS:
        for y in _ROWS:
            base_rects.append(
                '<rect x="%.1f" y="%.1f" width="32.0" height="32.0" '
                'fill="none" stroke="#4f9eff" stroke-width="1.4"/>' % (x, y))
    hi_rects = []
    for x, d in zip(_COLS, ds):
        for y in (_ROWS[4 - d:] if d > 0 else []):
            hi_rects.append(
                '<rect x="%.1f" y="%.1f" width="32.0" height="32.0" '
                'fill="rgba(255,209,102,0.35)" stroke="#ffd166" stroke-width="1.4"/>' % (x, y))
    headers = []
    for x, p in zip(_COLS, _PLACES):
        headers.append(
            '<text x="%.1f" y="20.0" font-size="11" text-anchor="middle" '
            'fill="#9aa3c0">%d</text>' % (x + 16.0, p))
    caption = (u'<text x="160.0" y="190.0" font-size="12" text-anchor="middle" '
               u'fill="#c9d4f0">%s の 方がん</text>' % label)
    head = ('<svg viewBox="0 0 380 210" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%">')
    svg = head + "".join(base_rects) + "".join(hi_rects) + "".join(headers) + caption + "</svg>"
    return svg


def _parse_back_value(svg):
    """作ったSVGを独立した経路で読みなおし、ハイライトされたマスから数値を逆算する
    （組み立てロジックの自己矛盾だけでなく、文字列の組み方そのものの誤りも拾うため）。"""
    hi = re.findall(
        r'<rect x="([\d.]+)" y="([\d.]+)" width="32.0" height="32.0" '
        r'fill="rgba\(255,209,102,0.35\)"', svg)
    col_of_x = {x: i for i, x in enumerate(_COLS)}
    counts = [0, 0, 0, 0]
    for xs, ys in hi:
        x = float(xs)
        assert x in col_of_x, "想定外の x 座標: %s" % xs
        counts[col_of_x[x]] += 1
    return sum(c * p for c, p in zip(counts, _PLACES))


def _verify_base5_svgs(svgs):
    """3枚とも、逆算した数値が意図した答えと一致することを確認する。1件でも
    合わなければ AssertionError で止まり、書きこみは一切行われない。"""
    for n, svg in svgs.items():
        got = _parse_back_value(svg)
        assert got == n, "hd_3s_f06_2 の図の逆算が答えと一致しない: %d を作ったはずが %d と読める" % (n, got)


_SVG_12 = _build_base5_svg(12, u"㋐")    # ㋐
_SVG_101 = _build_base5_svg(101, u"㋑")  # ㋑
_SVG_194 = _build_base5_svg(194, u"㋒")  # ㋒
_verify_base5_svgs({12: _SVG_12, 101: _SVG_101, 194: _SVG_194})


# ================================================== hd_3s_f06_5 用：ダイヤルの針を検算
# gauge circle: cx,cy=(85|240|395),118. 半径38。針の長さは中心から27.4。
# 0=上、1=右、2=下、3=左（もとの図の目もり位置と同じ）。
def _needle_endpoint(cx, cy, value):
    d = 27.4
    return {0: (cx, cy - d), 1: (cx + d, cy), 2: (cx, cy + d), 3: (cx - d, cy)}[value]


def _verify_dial_306_303():
    # (C,B,A)=(3,0,3): A(cx=85)=3→左、B(cx=240)=0→上、C(cx=395)=3→左
    ax, ay = _needle_endpoint(85.0, 118.0, 3)
    bx, by = _needle_endpoint(240.0, 118.0, 0)
    cx, cy = _needle_endpoint(395.0, 118.0, 3)
    assert (ax, ay) == (57.6, 118.0), "Aの針が想定と違う（変更しない側）"
    assert (bx, by) == (240.0, 90.6), "Bの新しい針座標がずれている"
    assert (cx, cy) == (367.6, 118.0), "Cの新しい針座標がずれている"
    # 検算：510円になること
    assert 16 * 3 + 4 * 0 + 3 == 51
    return (bx, by), (cx, cy)


_B_NEW, _C_NEW = _verify_dial_306_303()


# ==================================================================== 置きかえ表
# ("R", パス, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
# ("S", パス, もとの欄の全文, 置く全文)   … 欄が旧値と完全一致することを確かめて置く
EDITS = [
    # ---------------------------------------------------------------- 重大1
    # hd_3s_f06_2（HG-0311）小問1〜3が ㋐(=12)・㋑(=101)・㋒(=194) を問うのに、
    # 共有図は「9の例」だけで、3つとも同じ「9の例」の図しか表示されない
    # （steps[i].svg が無いので js/sansu.js の chain.svg フォールバックに落ちるため）。
    # intro に明記された確定ルール（右から1,5,25,125／各列0〜4）と、原簿の確定した
    # 答え(12,101,194)から、各小問専用の方眼図を追加する（steps[i].svgは今は
    # 存在しない欄なので、旧値は空文字列）。
    ("hd_3s_f06_2", [
        ("S", "steps/0/svg", u"", _SVG_12),
        ("S", "steps/1/svg", u"", _SVG_101),
        ("S", "steps/2/svg", u"", _SVG_194),
    ]),
    # ---------------------------------------------------------------- 重大2
    # hd_3s_f06_5（HG-0314）小問3の設問文「図のように (C,B,A)＝(3,0,3)のとき」に
    # 対して、共有図の針は A=3(左)・B=2(下)・C=1(右) を指しており(C,B,A)=(3,0,3)と
    # 一致しない。B・Cの針座標とキャプションを(3,0,3)に描きなおす（A=3は元から
    # 変更不要）。小問1・2は「図のように」と明言していないため、図を(3,0,3)に
    # 描きなおしても両者の答えの手がかりにはならない。
    ("hd_3s_f06_5", [
        ("R", "svg",
         u'<line x1="240.0" y1="118.0" x2="240.0" y2="145.4" stroke="#ffd166" stroke-width="2.2"/>',
         u'<line x1="240.0" y1="118.0" x2="%.1f" y2="%.1f" stroke="#ffd166" stroke-width="2.2"/>' % _B_NEW),
        ("R", "svg",
         u'<line x1="395.0" y1="118.0" x2="422.4" y2="118.0" stroke="#ffd166" stroke-width="2.2"/>',
         u'<line x1="395.0" y1="118.0" x2="%.1f" y2="%.1f" stroke="#ffd166" stroke-width="2.2"/>' % _C_NEW),
        ("R", "svg", u"図は(3,2,1)の状態", u"図は(C,B,A)＝(3,0,3)の状態"),
    ]),
    # ---------------------------------------------------------------- 軽1
    # hd_3s_f03_7（HG-0322）表の右端セル（☆の列＝㋐、■の列＝㋑であるべき）が、
    # svg内では丸数字「⑦」「①」になっている（設問文・原簿の説明はどちらも㋐㋑表記）。
    ("hd_3s_f03_7", [
        ("R", "svg", u"⑦", u"㋐"),  # ⑦ → ㋐
        ("R", "svg", u"①", u"㋑"),  # ① → ㋑
    ]),
]


# ================================================================ 当てる
def _get_holder(x, path):
    """パス（"svg" / "steps/0/svg" 等）から (入れ物dict, キー) を返す。"""
    parts = path.split("/")
    if len(parts) == 1:
        return x, parts[0]
    assert parts[0] == "steps" and len(parts) == 3, "パスの形がおかしい: " + path
    i = int(parts[1])
    steps = x.get("steps") or []
    assert i < len(steps), "小問 %d が無い（%s）" % (i, path)
    return steps[i], parts[2]


def apply_edits(x, edits, log):
    changed = 0
    for kind, path, old, new in edits:
        holder, key = _get_holder(x, path)
        cur = holder.get(key, "")
        assert isinstance(cur, str), "文字列でない項目は触らない: " + path

        if kind == "R":
            if new in cur and (old not in cur or old in new):
                continue                      # すでに直っている
            if old not in cur:
                assert new in cur, "%s: もとの文字列も置きかえ後の文字列も見つからない → %r" % (path, old[:60])
                continue                      # すでに直っている
            n = cur.count(old)
            assert n == 1, "%s: アンカーが %d 回出る（1回でないので置きかえない）→ %r" % (path, n, old[:60])
            holder[key] = cur.replace(old, new)
            changed += 1
        elif kind == "S":
            if cur == new:
                continue                      # すでに直っている
            assert cur == old, "%s: 現在の値が想定と異なる（差分を確認してから直す）" % path
            holder[key] = new
            changed += 1
        else:
            raise AssertionError("知らない種類: " + kind)
    return changed


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT_JSON
    path = os.path.abspath(path)

    def log(s):
        sys.stdout.write(s + "\n")

    log(u"対象: " + path)

    with io.open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    newline = "\r\n" if "\r\n" in raw else "\n"
    d = json.loads(raw)
    log("  改行コード: %s" % ("CRLF" if newline == "\r\n" else "LF"))

    index = {}
    for rec in iter_daimon(d):          # ★走査はここだけ
        x = rec["x"]
        i = x.get("id")
        if i:
            index.setdefault(i, []).append(x)

    # 対象の存在・原簿番号(hg)の一致を確認
    for did, hg in TARGETS.items():
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        assert hg in (hits[0].get("src") or ""), \
            "%s: hg mismatch (expected %s, got %r)" % (did, hg, hits[0].get("src"))

    total_changed = 0
    touched = 0
    for did, edits in EDITS:
        hits = index.get(did) or []
        assert len(hits) == 1, "%s が %d 件見つかった（1件でないので止める）" % (did, len(hits))
        c = apply_edits(hits[0], edits, log)
        total_changed += c
        if c:
            touched += 1
            log("  直した %s（%s）: %d か所" % (did, hits[0].get("src", "?"), c))
        else:
            log("  そのまま %s: 変更なし（すでに直っている）" % did)

    if total_changed == 0:
        log(u"変更なし。ファイルは書きかえない。")
        return 0

    text = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if newline != "\n":
        text = text.replace("\n", newline)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))

    log("---- 書きこみ完了: 大問 %d本 / %d か所" % (touched, total_changed))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
