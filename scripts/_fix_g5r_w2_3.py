# -*- coding: utf-8 -*-
"""
小5理科（公開テスト kokai No.11〜2）大問監査 g5r_w2/audit_3 分の修正パッチ。

対象: docs/_audit/g5r_w2/findings_3.md に書いた3件（重大2・中1）。
（軽微1件＝hd_5r_k12_609_3の解説にばねBの1gあたりの伸びの導出を足す件も、
 同じ大問なのでここに含めた）

■ 修正1: hd_5r_k11_608_3 (HG-1642) svg
  原簿(1)(2)用の[図1]〜[図6]（てこ実験器・支点1〜9番・おもり「あ」「い」・
  ばねはかり40g）が、実際に採用した(3)（棒ABの重心）の3問とは無関係なのに
  SVGにまるごと描画されたままだった（作問メモで「移植の主役は(3)」と明記され、
  (1)(2)は最初から採らない設計）。棒ABの図である[図7][図8][図9]だけを残し、
  [図1][図2][図3]に採番しなおす。座標は元のまま（棒AB部分の絵は変えない）。

■ 修正2: hd_5r_k12_609_3 (HG-1637+HG-1638合成) svg + steps[2]
  小問3の設問文は「[図6]のように…」と書いているのに、SVGには[図1](ばねの基本図)
  [図2](グラフ)[図3](かっ車で両側から60gのおもり＝原簿(4)、不採用)しか無く、
  肝心の「ばねA・ばねBを並べてつるし、ぼうの中央におもりPをつるす」図が
  1枚も描かれていなかった。不採用になった[図3](かっ車)を、原簿HG-1638の
  検証済み[図6]（ばねA・ばねB・ぼう・15cm・15cm・おもりP）に差し替えて
  [図3]と採番しなおし、設問文の「[図6]」参照も「[図3]」に直す。
  あわせて、小問3の解説が「15＋w÷6＝10＋w÷3」の1/6・1/3を無断で使っていて
  （1/6は小問2から出せるが1/3はどこにも出てこない）、ばねBの1gあたりの伸びの
  導出を解説に1文足す。

■ 修正3: hd_5r_k11_608_2 (HG-1641) svg
  原簿(2)(3)の「AまたはB」「CまたはD」を選ばせる設問を採らなかった結果、
  SVGにだけA・B・C・Dの矢印とラベルが残り、どの小問からも参照されない
  飾りになっていた（intro文にも小問にも一切出てこない）。矢印とラベルを
  取りのぞく（金星・地球・太陽の軌道図そのものはintro文の説明に対応するので残す）。

■ 使い方
  python scripts/_fix_g5r_w2_3.py [対象JSONのパス]
  省略時は data/hama_daimon.json （genbo_common.BASE からの相対）。

■ 設計方針
  - 大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  - 置換前に、その大問の中でちょうど1回だけヒットすることを assert してから書き換える
    （冪等：すでに直った後の状態であればそのままスキップし、想定外の状態なら例外で止める）。
  - 大問まるごとの削除・移動はしない。入力形式（テンキー/選択肢）は変えない。
  - 図SVGは、挿入前に必ず「入れ子のtranslate()を積み上げた絶対座標」を計算し、
    新しいviewBoxに収まることを検算してから書き込む。はみ出せば例外で止める。
  - 書き出しは io.open(path, "wb") + json.dumps(..., ensure_ascii=False, indent=1)。
"""
import io
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common as gc  # noqa: E402


# ============================================================
# 図SVGの座標検算ヘルパー（入れ子のtranslate()だけを積み上げる。回転は無し）
# ============================================================
_TAG_RE = re.compile(r'<(/?)(g|line|circle|rect|text|polygon|polyline)\b([^>]*?)(/?)>')
_ATTR_RE = re.compile(r'(\w[\w-]*)="([^"]*)"')
_TRANSLATE_RE = re.compile(r'translate\(([\-0-9.]+),\s*([\-0-9.]+)\)')


def _bbox(block):
    """block内の全図形要素について、入れ子のtranslate()を積み上げた絶対座標の
    最小外接矩形 (minx, maxx, miny, maxy) を返す。textはfont-sizeベースの
    余裕を持たせた概算（実サイズより広めに見積もるので、これに収まれば安全側）。
    """
    xs, ys = [], []
    stack = [(0.0, 0.0)]
    for m in _TAG_RE.finditer(block):
        closing, tag, attrs_s, _selfclose = m.groups()
        attrs = dict(_ATTR_RE.findall(attrs_s))
        if tag == "g":
            if closing == "/":
                stack.pop()
            else:
                mm = _TRANSLATE_RE.match(attrs.get("transform", ""))
                dx, dy = (float(mm.group(1)), float(mm.group(2))) if mm else (0.0, 0.0)
                bx, by = stack[-1]
                stack.append((bx + dx, by + dy))
            continue
        bx, by = stack[-1]
        if tag == "line":
            for ax, ay in (("x1", "y1"), ("x2", "y2")):
                xs.append(bx + float(attrs[ax]))
                ys.append(by + float(attrs[ay]))
        elif tag == "circle":
            cx, cy, r = float(attrs.get("cx", 0)), float(attrs.get("cy", 0)), float(attrs.get("r", 0))
            xs += [bx + cx - r, bx + cx + r]
            ys += [by + cy - r, by + cy + r]
        elif tag == "rect":
            x0, y0 = float(attrs.get("x", 0)), float(attrs.get("y", 0))
            w, h = float(attrs.get("width", 0)), float(attrs.get("height", 0))
            xs += [bx + x0, bx + x0 + w]
            ys += [by + y0, by + y0 + h]
        elif tag == "text":
            x0, y0 = float(attrs.get("x", 0)), float(attrs.get("y", 0))
            fs = float(attrs.get("font-size", 10))
            xs += [bx + x0 - fs * 3, bx + x0 + fs * 6]
            ys += [by + y0 - fs, by + y0 + fs * 0.3]
        elif tag in ("polygon", "polyline"):
            for pair in attrs.get("points", "").strip().split():
                px, py = pair.split(",")
                xs.append(bx + float(px))
                ys.append(by + float(py))
    assert xs and ys, "bbox: 図形要素が1つも見つからなかった"
    return min(xs), max(xs), min(ys), max(ys)


def _assert_within_viewbox(block, vb, label):
    vx, vy, vw, vh = vb
    minx, maxx, miny, maxy = _bbox(block)
    assert vx <= minx and maxx <= vx + vw and vy <= miny and maxy <= vy + vh, (
        "%s: 座標検算NG。bbox=x[%.1f,%.1f] y[%.1f,%.1f] が viewBox=%r に収まらない"
        % (label, minx, maxx, miny, maxy, vb)
    )


# ============================================================
# 修正1: hd_5r_k11_608_3 (HG-1642) svg を[図7][図8][図9]だけに絞る
# ============================================================
ID_608_3 = "hd_5r_k11_608_3"
HG_608_3 = "HG-1642"

_MARK_608_3 = '<g transform="translate(0,0)"><g transform="translate(0,10)">'
_KEEP_START_608_3 = '<g transform="translate(180,310)">'
_NEW_VIEWBOX_608_3 = (140, 285, 780, 180)
_SVG_HEAD = '<svg viewBox="%s %s %s %s" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%%">'


def fix1_6083(x):
    svg = x.get("svg", "")
    if _MARK_608_3 not in svg:
        assert 'viewBox="140 285 780 180"' in svg and "[図1]" in svg and "支点" not in svg, (
            "%s: 想定外の状態（未修正でも修正済みでもない）。手で確認すること" % ID_608_3
        )
        return False

    assert svg.count(_MARK_608_3) == 1, "%s: 冒頭マーカーが1件のはずが違う" % ID_608_3
    assert svg.count(_KEEP_START_608_3) == 1, "%s: [図7]グループの開始が1件のはずが違う" % ID_608_3
    assert svg.endswith("</g></g></svg>"), "%s: 末尾の閉じタグの形が想定と違う: %r" % (ID_608_3, svg[-30:])

    idx = svg.index(_KEEP_START_608_3)
    block = svg[idx: len(svg) - len("</svg>")]  # 末尾の </g></g> まで含む

    assert block.count("[図7]") == 1 and block.count("[図8]") == 1 and block.count("[図9]") == 1, (
        "%s: [図7][図8][図9]のラベルがそれぞれ1件のはずが違う" % ID_608_3
    )
    block = block.replace("[図7]", "[図1]").replace("[図8]", "[図2]").replace("[図9]", "[図3]")

    _assert_within_viewbox(block, _NEW_VIEWBOX_608_3, ID_608_3)

    new_svg = (_SVG_HEAD % _NEW_VIEWBOX_608_3) + block + "</svg>"
    x["svg"] = new_svg
    return True


# ============================================================
# 修正2: hd_5r_k12_609_3 (HG-1637+HG-1638) svgの[図3]差し替え + steps[2]
# ============================================================
ID_609_3 = "hd_5r_k12_609_3"

_OLD_ZU3_609_3 = (
    '<g transform="translate(680,10)">'
    '<rect x="0.0" y="40.0" width="120.0" height="16.0" fill="none" stroke="#c9d4f0" stroke-width="1.8"/>'
    '<polyline points="60.0,48.0 66.0,52.0 54.0,56.0 66.0,60.0 54.0,64.0 66.0,68.0 54.0,72.0 66.0,76.0 60.0,80.0" '
    'fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<text x="60.0" y="32.0" font-size="11" text-anchor="middle" fill="#9aa3c0">台</text>'
    '<text x="60.0" y="95.0" font-size="11" text-anchor="middle" fill="#9aa3c0">ばねB</text>'
    '<circle cx="0.0" cy="48.0" r="6.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<circle cx="120.0" cy="48.0" r="6.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<line x1="0.0" y1="54.0" x2="0.0" y2="130.0" stroke="#c9d4f0" stroke-width="1.4"/>'
    '<line x1="120.0" y1="54.0" x2="120.0" y2="130.0" stroke="#c9d4f0" stroke-width="1.4"/>'
    '<rect x="-10.0" y="130.0" width="20.0" height="20.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<rect x="110.0" y="130.0" width="20.0" height="20.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<text x="0.0" y="165.0" font-size="10" text-anchor="middle" fill="#9aa3c0">60gのおもり</text>'
    '<text x="120.0" y="165.0" font-size="10" text-anchor="middle" fill="#9aa3c0">60gのおもり</text>'
    '<text x="60.0" y="80.0" font-size="10" text-anchor="start" fill="#9aa3c0">かっ車</text>'
    '<text x="60.0" y="150.0" font-size="12" text-anchor="middle" fill="#9aa3c0">[図3]</text>'
    "</g>"
)

# 原簿HG-1638の検証済み[図6]（ばねA・ばねB・ぼう・15cm・15cm・おもりP）をそのまま流用。
# 元は translate(320,24) の入れ子で使われていた中身（座標はそのまま）。
# ここでは translate(680,24) に置き直す（dy=24は原簿と同じ値を保つことで
# 「ばねA」「ばねB」ラベル(y=-6)がviewBoxの上端(y=0)から出ないようにしている）。
_NEW_ZU3_609_3 = (
    '<g transform="translate(680,24)">'
    '<rect x="30.0" y="0.0" width="20.0" height="8.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<line x1="30.0" y1="8.0" x2="50.0" y2="8.0" stroke="#c9d4f0" stroke-width="1" stroke-dasharray="3,2"/>'
    '<rect x="110.0" y="0.0" width="20.0" height="8.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<line x1="110.0" y1="8.0" x2="130.0" y2="8.0" stroke="#c9d4f0" stroke-width="1" stroke-dasharray="3,2"/>'
    '<polyline points="40.0,8.0 45.0,14.5 35.0,21.0 45.0,27.5 35.0,34.0 45.0,40.5 35.0,47.0 45.0,53.5 40.0,60.0" '
    'fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<text x="40.0" y="-6.0" font-size="10" text-anchor="middle" fill="#9aa3c0">ばねA</text>'
    '<polyline points="120.0,8.0 125.0,14.5 115.0,21.0 125.0,27.5 115.0,34.0 125.0,40.5 115.0,47.0 125.0,53.5 120.0,60.0" '
    'fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<text x="120.0" y="-6.0" font-size="10" text-anchor="middle" fill="#9aa3c0">ばねB</text>'
    '<rect x="40.0" y="60.0" width="80.0" height="8.0" fill="none" stroke="#c9d4f0" stroke-width="1.8"/>'
    '<text x="80.0" y="55.0" font-size="10" text-anchor="middle" fill="#9aa3c0">ぼう</text>'
    '<line x1="40.0" y1="68.0" x2="80.0" y2="90.0" stroke="#9aa3c0" stroke-width="1"/>'
    '<text x="56.0" y="82.0" font-size="10" text-anchor="middle" fill="#9aa3c0">15cm</text>'
    '<line x1="120.0" y1="68.0" x2="80.0" y2="90.0" stroke="#9aa3c0" stroke-width="1"/>'
    '<text x="104.0" y="82.0" font-size="10" text-anchor="middle" fill="#9aa3c0">15cm</text>'
    '<line x1="80.0" y1="68.0" x2="80.0" y2="90.0" stroke="#c9d4f0" stroke-width="1.4"/>'
    '<rect x="70.0" y="90.0" width="20.0" height="20.0" fill="none" stroke="#c9d4f0" stroke-width="1.6"/>'
    '<text x="80.0" y="128.0" font-size="10" text-anchor="middle" fill="#9aa3c0">おもりP</text>'
    '<text x="80.0" y="140.0" font-size="12" text-anchor="middle" fill="#9aa3c0">[図3]</text>'
    "</g>"
)

_VIEWBOX_609_3 = (0, 0, 900, 340)

QUESTION_609_3_BEFORE = (
    "[図6]のように 天じょうから ばねA と ばねB を ならべて つるし、下に 長さ30cm の 軽い "
    "ぼうを 水平に わたします。ぼうの **まん中** に おもりP を つるすと 水平に つり合いました。"
    "このとき ばねA の 長さは 何cm ですか。"
)
QUESTION_609_3_AFTER = QUESTION_609_3_BEFORE.replace("[図6]のように", "[図3]のように")

MEANING_609_3_BEFORE = (
    "ぼうが **水平** ＝ **ばねAの長さ ＝ ばねBの長さ**。\n"
    "P は まん中なので 2本には **同じ重さ w** が かかる。\n"
    "15＋w÷6 ＝ 10＋w÷3 → 5＝w÷6 → w＝30g。ばねAの長さ＝15＋5＝**20cm**（Bも10＋10＝20 ○）。\n"
    "自然長の差 5cm を「のびの差」で うめる **消去算**。"
)
MEANING_609_3_AFTER = (
    "ぼうが **水平** ＝ **ばねAの長さ ＝ ばねBの長さ**。\n"
    "P は まん中なので 2本には **同じ重さ w** が かかる。\n"
    "ばねAは 1gあたり 10÷60＝**1/6cm** のびる（さっきの小問より）。"
    "ばねBは 60gで 30cm（自然長10cmから のびは20cm）なので 1gあたり 20÷60＝**1/3cm** のびる。\n"
    "15＋w÷6 ＝ 10＋w÷3 → 5＝w÷6 → w＝30g。ばねAの長さ＝15＋5＝**20cm**（Bも10＋10＝20 ○）。\n"
    "自然長の差 5cm を「のびの差」で うめる **消去算**。"
)


def fix2_6093_svg(x):
    svg = x.get("svg", "")
    if _OLD_ZU3_609_3 not in svg:
        assert _NEW_ZU3_609_3 in svg, (
            "%s: [図3]が旧版(かっ車)にも新版(ばね+ぼう)にも一致しない。手で確認すること" % ID_609_3
        )
        return False
    assert svg.count(_OLD_ZU3_609_3) == 1, "%s: 旧[図3](かっ車)が1件のはずが違う" % ID_609_3

    _assert_within_viewbox(_NEW_ZU3_609_3, _VIEWBOX_609_3, ID_609_3 + ".zu3")

    x["svg"] = svg.replace(_OLD_ZU3_609_3, _NEW_ZU3_609_3, 1)
    return True


def fix2_6093_question(step):
    q = step.get("question", "")
    if q == QUESTION_609_3_AFTER:
        return False
    assert q == QUESTION_609_3_BEFORE, (
        "%s: steps[2].question が想定のbefore/afterどちらとも一致しない: %r" % (ID_609_3, q)
    )
    step["question"] = QUESTION_609_3_AFTER
    return True


def fix2_6093_meaning(step):
    m = step.get("meaning", "")
    if m == MEANING_609_3_AFTER:
        return False
    assert m == MEANING_609_3_BEFORE, (
        "%s: steps[2].meaning が想定のbefore/afterどちらとも一致しない: %r" % (ID_609_3, m)
    )
    step["meaning"] = MEANING_609_3_AFTER
    return True


# ============================================================
# 修正3: hd_5r_k11_608_2 (HG-1641) svgからA/B/C/Dの矢印とラベルを消す
# ============================================================
ID_608_2 = "hd_5r_k11_608_2"
HG_608_2 = "HG-1641"

_TAIL_608_2 = (
    '<line x1="100.0" y1="185.0" x2="75.0" y2="198.0" stroke="#ffd166" stroke-width="1.6"/>'
    '<text x="68.0" y="204.0" font-size="12" text-anchor="end" fill="#ffd166">C</text>'
    '<line x1="132.0" y1="185.0" x2="157.0" y2="198.0" stroke="#ffd166" stroke-width="1.6"/>'
    '<text x="164.0" y="204.0" font-size="12" text-anchor="start" fill="#ffd166">D</text>'
    '<line x1="88.0" y1="240.0" x2="60.0" y2="252.0" stroke="#ffd166" stroke-width="1.6"/>'
    '<text x="52.0" y="258.0" font-size="12" text-anchor="end" fill="#ffd166">A</text>'
    '<line x1="120.0" y1="240.0" x2="148.0" y2="252.0" stroke="#ffd166" stroke-width="1.6"/>'
    '<text x="156.0" y="258.0" font-size="12" text-anchor="start" fill="#ffd166">B</text>'
)


def fix3_6082(x):
    svg = x.get("svg", "")
    if _TAIL_608_2 not in svg:
        assert svg.endswith("地球</text></svg>"), (
            "%s: 想定外の状態（未修正でも修正済みでもない）: %r" % (ID_608_2, svg[-40:])
        )
        return False
    assert svg.count(_TAIL_608_2) == 1, "%s: A/B/C/Dの矢印ブロックが1件のはずが違う" % ID_608_2
    x["svg"] = svg.replace(_TAIL_608_2, "", 1)
    assert x["svg"].endswith("地球</text></svg>"), "%s: 除去後の末尾が想定と違う" % ID_608_2
    return True


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(gc.BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)

    d = json.load(io.open(path, encoding="utf-8"))

    ids = (ID_608_3, ID_609_3, ID_608_2)
    found = {}
    for rec in gc.iter_daimon(d):
        x = rec["x"]
        xid = x.get("id")
        if xid in ids:
            found.setdefault(xid, []).append(x)

    for xid in ids:
        hits = found.get(xid, [])
        assert len(hits) == 1, "大問 %s が %d 件見つかった（ちょうど1件のはず）: %s" % (xid, len(hits), path)

    x6083 = found[ID_608_3][0]
    assert x6083.get("hg") == HG_608_3 or x6083.get("src") == HG_608_3, (
        "%s: hg/src が想定と違う: %r" % (ID_608_3, x6083.get("hg") or x6083.get("src"))
    )

    x6093 = found[ID_609_3][0]
    steps6093 = x6093.get("steps")
    assert isinstance(steps6093, list) and len(steps6093) == 4, (
        "%s: steps が4問のはずが違う: %r" % (ID_609_3, len(steps6093) if isinstance(steps6093, list) else steps6093)
    )

    x6082 = found[ID_608_2][0]
    assert x6082.get("hg") == HG_608_2 or x6082.get("src") == HG_608_2, (
        "%s: hg/src が想定と違う: %r" % (ID_608_2, x6082.get("hg") or x6082.get("src"))
    )

    changed = {}
    changed["1_zu_6083"] = fix1_6083(x6083)
    changed["2a_zu3_6093"] = fix2_6093_svg(x6093)
    changed["2b_question_6093"] = fix2_6093_question(steps6093[2])
    changed["2c_meaning_6093"] = fix2_6093_meaning(steps6093[2])
    changed["3_zu_6082"] = fix3_6082(x6082)

    out = json.dumps(d, ensure_ascii=False, indent=1)
    io.open(path, "wb").write(out.encode("utf-8"))

    print("path:", path)
    for k in sorted(changed):
        print("changed[%s]:" % k, changed[k])


if __name__ == "__main__":
    main()
