# -*- coding: utf-8 -*-
"""g5m_w1 監査2（fukushu No.6〜10・20本）で見つかった不具合の修正パッチ。

対象: docs/_audit/g5m_w1/findings_2.md の「重大1: 図が答えそのものを見せている」4件。
      （重大2の大問まるごと重複7組は、カリキュラム構成の判断が要るため、このスクリプトでは直さない。
        findings_2.md 末尾の「見送った項目まとめ」を参照）

直すのは data/hama_daimon.json の 5学年 master fukushu 7・8・9 の4大問のchain.svgだけ：
  1. hd5m_08_4 (HG-0687) … 図が小問2の答え（2けたの平方数6個）をそのまま見せている → svgを空にする
  2. hd5m_07_6 (HG-0686) … 図のキャプションが小問1の答え（210）をそのまま見せている → svgを空にする
  3. hd5m_09_6 (HG-0693) … 図のキャプションが小問1の答え（200）をそのまま見せている → svgを空にする
  4. hd5m_09_4 (HG-0691) … 図が小問1の答え（8n＋2）を完成形で見せている
                            → 同じ原簿(HG-0691)の別実装 hd_5m_f09_4（原簿の指示どおりのタイル配置図を持つ）
                              から検証済みのsvgをコピーして差し替える

使い方:
  python scripts/_fix_g5m_w1_2.py [対象JSONのパス]  （省略時 data/hama_daimon.json）

大問の参照は genbo_common.py の iter_daimon だけを使う。置換前に対象大問のsvgフィールドが
期待どおりの内容（1回だけ）かをassertし、書き換え後の値と既に一致していれば何もしない（冪等）。
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402


def load(path):
    with io.open(path, encoding="utf-8") as f:
        import json
        return json.load(f)


def dump(d, path):
    import json
    text = json.dumps(d, ensure_ascii=False, indent=1)
    with io.open(path, "wb") as f:
        f.write(text.encode("utf-8"))


def find_by_id(d, target_id):
    """iter_daimon だけを使って id で1本探す。無ければ None。"""
    hits = [r for r in iter_daimon(d, grade="5", app_courses=["master"])
            if r["x"].get("id") == target_id]
    assert len(hits) <= 1, u"id=%s が %d本ある（唯一のはず）" % (target_id, len(hits))
    return hits[0]["x"] if hits else None


def remove_leaking_svg(d, target_id, hg, marker, note):
    """svgに答えを見せているキャプション(marker)が入っていれば、svgを空にする。
    marker が無く svg が既に空なら「もう直っている」とみなしてスキップ（冪等）。
    marker が無いのに svg が空でない＝想定外の内容なので止める。
    """
    x = find_by_id(d, target_id)
    assert x is not None, u"id=%s が見つからない" % target_id
    assert x.get("hg") == hg or x.get("src", "").startswith(hg),         u"id=%s のHG番号が想定と違う: %r" % (target_id, x.get("hg") or x.get("src"))
    cur = x.get("svg", "") or ""
    if cur == "":
        print(u"  [skip] %s : 既にsvgが空（冪等）" % target_id)
        return False
    cnt = cur.count(marker)
    assert cnt == 1,         u"id=%s : 目印文字列 %r が1回のはずが%d回（想定外の内容のため中止）" % (target_id, marker, cnt)
    x["svg"] = ""
    print(u"  [fix]  %s : %s → svgを空にした" % (target_id, note))
    return True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "data", "hama_daimon.json")
    path = os.path.abspath(path)
    print(u"対象: %s" % path)
    d = load(path)

    changed = False

    # 1. hd5m_08_4 (HG-0687) … 小問2「2けたの平方数は何個」の答え(16,25,36,49,64,81)を
    #    図がそのまま列挙している。原簿は「図: なし」。
    changed |= remove_leaking_svg(
        d, "hd5m_08_4", "HG-0687",
        marker=u"平方数だけ奇数個",
        note=u"約数偶数個(小問2の答え=6個の平方数を列挙していた)")

    # 2. hd5m_07_6 (HG-0686) … 小問1「分子と分母をたすといくつ」の答え(210)を
    #    図のキャプションがそのまま書いている。原簿は「図: なし」。
    changed |= remove_leaking_svg(
        d, "hd5m_07_6", "HG-0686",
        marker=u"分子＋分母＝210",
        note=u"分数列(小問1の答え=210を明記していた)")

    # 3. hd5m_09_6 (HG-0693) … 小問1「2つが同時になるのは何秒ごと」の答え(200)を
    #    図のキャプションがそのまま書いている。原簿は「図: なし」。
    changed |= remove_leaking_svg(
        d, "hd5m_09_6", "HG-0693",
        marker=u"重なりは200秒ごと",
        note=u"除夜の鐘(小問1の答え=200を明記していた)")

    # 4. hd5m_09_4 (HG-0691) … 小問1「横にn枚つなぐと長さは8n＋□。□はいくつ」の答え(2)を
    #    図が完成済みの式「8n＋2」で見せている。原簿は「図: あり（タイル配置の略図）」なので、
    #    空にするのではなく、同じ原簿の別実装 hd_5m_f09_4 が持つ検証済みの正しい図に差し替える。
    target = find_by_id(d, "hd5m_09_4")
    assert target is not None, u"hd5m_09_4 が見つからない"
    assert target.get("hg") == "HG-0691" or target.get("src", "").startswith("HG-0691"),         u"hd5m_09_4 のHG番号が想定と違う: %r" % (target.get("hg") or target.get("src"))

    source = find_by_id(d, "hd_5m_f09_4")
    assert source is not None, u"差し替え元 hd_5m_f09_4 が見つからない"
    good_svg = source.get("svg", "") or ""
    # 差し替え元が「原簿どおりのタイル配置図」であることを目印で確認してから使う
    assert u"正方形の四すみ近くに" in good_svg,         u"差し替え元 hd_5m_f09_4 のsvgが想定と違う（タイル配置図の目印が無い）"

    cur = target.get("svg", "") or ""
    if cur == good_svg:
        print(u"  [skip] hd5m_09_4 : 既に正しい図に差し替え済み（冪等）")
    else:
        assert cur.count(u"8n＋2") == 1,             u"hd5m_09_4 : 目印文字列 '8n＋2' が1回のはずが%d回（想定外の内容のため中止）" % cur.count(u"8n＋2")
        assert cur.count(u"6m＋2") == 1,             u"hd5m_09_4 : 目印文字列 '6m＋2' が1回のはずが%d回（想定外の内容のため中止）" % cur.count(u"6m＋2")
        target["svg"] = good_svg
        print(u"  [fix]  hd5m_09_4 : のりしろ・すき間(小問1の答え=2を完成式8n+2で見せていた) "
              u"→ hd_5m_f09_4の検証済み図(タイル配置)に差し替えた")
        changed = True

    if not changed:
        print(u"変更なし（すべて冪等スキップ）。ファイルは書き換えない。")
        return

    dump(d, path)
    print(u"書き戻した: %s" % path)


if __name__ == "__main__":
    main()
