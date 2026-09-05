# -*- coding: utf-8 -*-
u"""docs/_audit/g4s_w1/findings_1.md の指摘を hama_daimon.json に当てる修正パッチ。

  python scripts/_fix_g4s_w1_1.py [対象JSON]      （省略時 data/hama_daimon.json）

対象: 小4最レ算数 fukushu No.0〜No.11・25本監査（audit_1.txt）。

直した内容（詳細は findings_1.md）:
  重大（図または設問文が、まだ答えていない小問の答えをそのまま見せていた）
    hd4s_01_4 (HG-1005) … 図の「36.7→367」の例が、小問2の答え(36.7)そのもの
    hd4s_02_2 (HG-1007) … 図のキャプション「64−8＝56の約数」が小問4の答え(56)そのもの
    hd4s_05_1 (HG-1018) … 図の「A 34500〜35500」が小問1の答え(34500)そのもの
    hd4s_05_2 (HG-1017) … 図とキャプション「重なるのは34だけ」が小問1〜4の答え全部
    hd4s_05_3 (HG-1019) … 図とキャプション「重なるのは32だけ」が小問2〜4の答え全部
    hd4s_07_3 (HG-1026) … 小問1の設問文自体に答え(4回)が書かれ、図も同じ答えを見せる
    hd4s_07_4 (HG-1027) … 図が「076923」の循環そのものを見せ、小問1〜3全部が読み取れる
    hd4s_10_1 (HG-1035) … 図が「1,4,7,9,12」の5個を見せ、小問3の答え(5)を数えれば分かる
    hd4s_11_2 (HG-1036) … 図が月曜日(5,12,19,26)を色付け+キャプションで丸ごと見せる
  中（原簿・図・導入文どうしの食いちがい）
    hd4s_08_2 (HG-1029) … 導入文の実例「8は(2,3)」と図キャプション「14は(3,4)」が、
      どちらも実際の表（1,2,3,4／8,7,6,5／9,10,11,12／16,15,14,13）と矛盾し、
      かつ導入文と図キャプションが互いにも矛盾していた（8の正しい位置は(2,1)、
      14の正しい位置は(4,3)）。座標検算はスクリプト内で再現して確認ずみ。

見送り（本パッチに含めない）:
  hd4s_01_3 (HG-1004) … 最終小問が「分母はいくつか」で止まり、原簿の答え10/11
    そのものを確認させていない。誤りではなく設計の手薄さなので、答えの形式を
    変える修正はしない（見送り＝findings_1.md 軽1参照）。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う
  * "R"（部分置換）は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    → [[feedback_anchor_uniqueness]]
  * "S"（欄まるごと置換／svgを空にする）は、現在値が想定どおりの旧値と完全一致することを
    確かめてから置く。既に新値なら何もしない（冪等）
  * 何度流しても同じ結果（すでに直っていればスキップ）
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化ける）
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


# ============================================================== 旧値（欄まるごと・Sで使う）
SVG_07_3_OLD = u'<svg viewBox="0 0 222 74" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><rect x="10" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="33.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">07</text><rect x="62" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="85.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">49</text><rect x="114" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="137.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">43</text><rect x="166" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="189.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">01</text><text x="111" y="68" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">4個でくり返す</text></svg>'

SVG_07_4_OLD = u'<svg viewBox="0 0 326 74" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><rect x="10" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="33.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">0</text><rect x="62" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="85.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">7</text><rect x="114" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="137.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">6</text><rect x="166" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="189.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">9</text><rect x="218" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="241.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">2</text><rect x="270" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="293.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">3</text><text x="163" y="68" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">076923 のくり返し</text></svg>'

SVG_10_1_OLD = u'<svg viewBox="0 0 274 74" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><rect x="10" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="33.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">1</text><rect x="62" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="85.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">4</text><rect x="114" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="137.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">7</text><rect x="166" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="189.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">9</text><rect x="218" y="12" width="46" height="32" rx="5" fill="#f8f9ff" stroke="#4f7cff" stroke-width="1.5"/><text x="241.0" y="34" font-size="17" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1a2340">12</text><text x="137" y="68" font-size="11" text-anchor="middle" font-family="sans-serif" fill="#6c7086">第5火曜がある月</text></svg>'


# ================================================================ 置きかえ表
# ("R", パス, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
# ("S", パス, もとの欄の全文, 置く全文)   … 欄が旧値と完全一致することを確かめて置く（主にsvgを空にする）
EDITS = [
    # ---------------------------------------------------------------- 重大1
    # hd4s_01_4（HG-1005）図の例「36.7→367」が、小問2「もとの数はいくつですか」の
    # 答え(36.7)をそのまま見せている。うち忘れの概念だけを示す無関係な例に差しかえる。
    ("hd4s_01_4", [
        ("R", "svg", u"36.7", u"1.5"),
        ("R", "svg", u"367", u"15"),
    ]),
    # ---------------------------------------------------------------- 重大2
    # hd4s_02_2（HG-1007）図のキャプション「64−8＝56の約数」が、解法の核心と
    # 小問4「いちばん大きい数は」の答え(56)を丸ごと見せている。
    ("hd4s_02_2", [
        ("R", "svg", u"64−8＝56 の約数", u"あまりから わる数を 考える"),
    ]),
    # ---------------------------------------------------------------- 重大3
    # hd4s_05_1（HG-1018）図の「A 34500〜35500」が小問1の答え(34500)そのもの。
    # 原簿も「図：なし（数直線を自分で描けるかが分かれ目）」＝範囲を先に見せない設計。
    ("hd4s_05_1", [
        ("R", "svg", u"A 34500〜35500", u"A の はんい"),
        ("R", "svg", u"B 49500〜50500", u"B の はんい"),
    ]),
    # ---------------------------------------------------------------- 重大4
    # hd4s_05_2（HG-1017）図とキャプション「重なるのは34だけ」が小問1〜4の答え全部。
    ("hd4s_05_2", [
        ("R", "svg", u"7でわる 29〜34", u"7でわる はんい"),
        ("R", "svg", u"11でわる 34〜43", u"11でわる はんい"),
        ("R", "svg", u"重なるのは34だけ", u"共通部分をさがす"),
    ]),
    # ---------------------------------------------------------------- 重大5
    # hd4s_05_3（HG-1019）図とキャプション「重なるのは32だけ」が小問2〜4の答え全部。
    ("hd4s_05_3", [
        ("R", "svg", u"5でわる 28〜32", u"5でわる はんい"),
        ("R", "svg", u"7でわる 32〜38", u"7でわる はんい"),
        ("R", "svg", u"重なるのは32だけ", u"共通部分をさがす"),
    ]),
    # ---------------------------------------------------------------- 重大6
    # hd4s_07_3（HG-1026）小問1の設問文じたいに答え(4回)が書きこまれている
    # （「7を4回かけると…01になります。何個でくり返しますか」＝聞く前に答えが書いてある）。
    # 図も同じ表（07,49,43,01）を見せて答えを重ねて割っている。原簿は「図：なし」。
    ("hd4s_07_3", [
        ("R", "steps/0/question",
         u"7 を 4回 かけると 下2けたは 01 に なります。何個で くり返しますか。",
         u"7 を 何回も かけていくと、下2けたは やがて また 01 に もどります。何個で くり返しますか。"),
        ("S", "svg", SVG_07_3_OLD, u""),
    ]),
    # ---------------------------------------------------------------- 重大7
    # hd4s_07_4（HG-1027）図が「076923」の循環そのものを見せ、小問1(6個で一巡)・
    # 小問2(3けた目=6)・小問3(30けた目=3)の全部が図を読むだけで分かってしまう。
    # 原簿は「図：なし」＝この循環小数を導く計算じたいが問題の核なので図で先渡ししない。
    ("hd4s_07_4", [
        ("S", "svg", SVG_07_4_OLD, u""),
    ]),
    # ---------------------------------------------------------------- 中1
    # hd4s_08_2（HG-1029）導入文の実例「8は2行目の3列目 (2,3)」と、図キャプションの
    # 実例「14は上から3行目・左から4列目 (3,4)」が、どちらも実際の表
    # （1,2,3,4／8,7,6,5／9,10,11,12／16,15,14,13）と食いちがい、かつ両者も互いに矛盾。
    # 実際は 8=(2,1)、14=(4,3)（スクリプト内で snake_val() として座標検算ずみ）。
    ("hd4s_08_2", [
        ("R", "intro",
         u"8 は 2行目の 3列目にあるので (2, 3) と表します。",
         u"8 は 2行目の 1列目にあるので (2, 1) と表します。"),
        ("R", "svg",
         u"上から3行目・左から4列目の数14を(3,4)と表す",
         u"上から4行目・左から3列目の数14を(4,3)と表す"),
    ]),
    # ---------------------------------------------------------------- 重大8
    # hd4s_10_1（HG-1035）図の「1,4,7,9,12」の5個の箱とキャプション「第5火曜がある月」が、
    # 小問3「第5火曜日がある月は何か月ありますか」の答え(5)そのもの（数えるだけで分かる）。
    # 原簿は「図：なし」＝「総数−均等分」で数え上げを封じる型なので図で数えさせない。
    ("hd4s_10_1", [
        ("S", "svg", SVG_10_1_OLD, u""),
    ]),
    # ---------------------------------------------------------------- 重大9
    # hd4s_11_2（HG-1036）カレンダー図が月曜(5,12,19,26)を色つきにし、キャプション
    # 「月曜は5,12,19,26日」でも明示。小問3「小さいほうの月曜は何日ですか」の答え(5)と
    # 小問4の元になる情報が丸ごと見える。原簿は「図：なし（カレンダーのマス目が◎）」＝
    # 目印をつけるならマス目に印をつける程度で、答えの日付を明示しない設計。
    # ハイライト色を戻し、キャプションを答えを含まない一般的な文言に差しかえる。
    ("hd4s_11_2", [
        ("R", "svg",
         u'<rect x="130" y="6" width="30" height="30" fill="#ffe9b8" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="25" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">5</text>',
         u'<rect x="130" y="6" width="30" height="30" fill="#f8f9ff" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="25" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">5</text>'),
        ("R", "svg",
         u'<rect x="130" y="36" width="30" height="30" fill="#ffe9b8" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="55" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">12</text>',
         u'<rect x="130" y="36" width="30" height="30" fill="#f8f9ff" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="55" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">12</text>'),
        ("R", "svg",
         u'<rect x="130" y="66" width="30" height="30" fill="#ffe9b8" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="85" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">19</text>',
         u'<rect x="130" y="66" width="30" height="30" fill="#f8f9ff" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="85" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">19</text>'),
        ("R", "svg",
         u'<rect x="130" y="96" width="30" height="30" fill="#ffe9b8" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="115" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">26</text>',
         u'<rect x="130" y="96" width="30" height="30" fill="#f8f9ff" stroke="#9aa3c0" stroke-width="1"/><text x="145" y="115" font-size="12" text-anchor="middle" font-family="sans-serif" fill="#1a2340">26</text>'),
        ("R", "svg", u"月曜は5,12,19,26日", u"同じ曜日は 7日おき"),
    ]),
]


# ============================================================== 座標検算（08_2）
def _snake_val(row, col, ncol=4):
    """へび状（1行目は左→右、2行目は右→左…）に並べたときの (row,col) の数。1始まり。"""
    if row % 2 == 1:
        return (row - 1) * ncol + col
    return (row - 1) * ncol + (ncol - col + 1)


def _verify_08_2_geometry():
    # 実際の表（原簿の設定どおり）: 1,2,3,4／8,7,6,5／9,10,11,12／16,15,14,13
    assert _snake_val(2, 1) == 8, u"8の正しい位置がずれている"
    assert _snake_val(2, 3) == 6, u"(2,3)は6であって8ではない"
    assert _snake_val(4, 3) == 14, u"14の正しい位置がずれている"
    assert _snake_val(3, 4) == 12, u"(3,4)は12であって14ではない"


# ================================================================ 当てる
def _get_holder(x, path):
    """パス（"svg" / "intro" / "steps/0/question"）から (入れ物dict, キー) を返す。"""
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
    _verify_08_2_geometry()

    path = argv[1] if len(argv) > 1 else DEFAULT_JSON
    path = os.path.abspath(path)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + path)

    # ★改行コードは元ファイルに合わせる
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
        log("変更なし。ファイルは書きかえない。")
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
