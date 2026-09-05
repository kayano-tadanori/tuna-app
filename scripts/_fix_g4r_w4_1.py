# -*- coding: utf-8 -*-
"""docs/_audit/g4r_w4/findings_1.md の指摘を hama_daimon.json に当てるパッチ。

  python scripts/_fix_g4r_w4_1.py [対象JSON]      （省略時 data/hama_daimon.json）

対象: 小4理科（公開テスト）9本（kokai No.12の573回〜No.7の604回）。
9本を原簿と突き合わせた結果、重大5件・中2件を検出（findings_1.md参照）。

決めごと（過去の事故から）
  * 大問は id で引き当てる。走査は genbo_common.iter_daimon だけを使う（自前で入れ子を歩かない）
  * 文字列置換は「その大問の中でちょうど1回だけ出る」ことを確かめてから置く
    → [[feedback_anchor_uniqueness]]（アンカーが一意でなく72万字を壊した）
  * 何度流しても同じ結果（すでに直っていればスキップ＝冪等）
  * 読み書きは1プロセスの中で json.load → 書き換え → json.dumps(indent=1) で戻す
    → [[feedback_heikou_session_jouyaki]]（並行セッションの変更を消さないため滞留を最短に）
  * 書き出しは io.open(path, "wb")（テキストモードだとWindowsで改行が化けて全行差分になる）
  * 図SVGは「座標検算をパスしないなら1件も書かない」（想像で直すと実物と別物になる事故が
    過去に何度もあった）。このファイル末尾の _verify_geometry() が、書きこみの直前に
    レイ・キャスト point-in-polygon ＋ BFS（ひも状の図）／ユークリッド距離（板状の図）で
    「×からの近い順」が原簿の答えの順と一致するかを確認する。1つでも失敗したら
    書きこみ自体を中止する（部分適用を避けるため）。
"""
import io
import json
import os
import sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

DEFAULT_JSON = os.path.join(ROOT, "data", "hama_daimon.json")


# ================================================================ 図形検算（stdlibのみ）
def _point_in_polygon(x, y, poly):
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _shortest_path_lens(poly, start, targets, step=1.0, margin=2.0):
    """ひも状（U字・蛇行）の図＝穴だらけの多角形の中だけをBFSで歩いた歩数。"""
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0 = min(xs) - margin
    y0 = min(ys) - margin

    inside_cache = {}

    def is_inside(cx, cy):
        key = (cx, cy)
        if key in inside_cache:
            return inside_cache[key]
        r = _point_in_polygon(x0 + cx * step, y0 + cy * step, poly)
        inside_cache[key] = r
        return r

    def nearest_inside(pt):
        cx0 = int(round((pt[0] - x0) / step))
        cy0 = int(round((pt[1] - y0) / step))
        if is_inside(cx0, cy0):
            return (cx0, cy0)
        for r in range(1, 8):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if is_inside(cx0 + dx, cy0 + dy):
                        return (cx0 + dx, cy0 + dy)
        raise AssertionError("start/target が図形の中に無い: %r" % (pt,))

    sc = nearest_inside(start)
    dist = {sc: 0}
    q = deque([sc])
    tgt_cells = {name: nearest_inside(pt) for name, pt in targets.items()}
    while q:
        c = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nc = (c[0] + dx, c[1] + dy)
            if nc in dist or not is_inside(*nc):
                continue
            dist[nc] = dist[c] + 1
            q.append(nc)
    return {name: dist.get(tc) for name, tc in tgt_cells.items()}


def _euclid(p, q):
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5


def _assert_order(dists, order, label):
    """dists: {name: 距離}。order: 近い順の名前のリスト。厳密な狭義単調増加を要求。"""
    vals = [dists[n] for n in order]
    for a, b in zip(vals, vals[1:]):
        assert a is not None and b is not None, "%s: 到達できない点がある %r" % (label, dists)
        assert a < b, "%s: 距離の順が原簿の答えと合わない %r (要求順=%s)" % (label, dists, order)


def _verify_geometry():
    """このスクリプトが書きこむ図形修正を、書きこむ座標そのもので検算する。
    1件でも失敗したら AssertionError を投げて main() 側で書きこみ自体を止める。"""
    # ---- HG-2810 (1)正方形（すぐ右のC）：C→A→B（ユークリッド距離、板は面で伝わる）
    pts = {"x": (20.0, 110.0), "A": (20.0, 20.0), "B": (110.0, 20.0), "C": (50.0, 110.0)}
    d = {k: _euclid(pts["x"], pts[k]) for k in ("A", "B", "C")}
    _assert_order(d, ["C", "A", "B"], "HG-2810 (1)正方形")

    # ---- HG-2810 (2)U字（連結部を下に）：B→C→A（ひも状、BFS）
    poly = [(150.0, 110.0), (240.0, 110.0), (240.0, 20.0), (210.0, 20.0),
            (210.0, 80.0), (180.0, 80.0), (180.0, 20.0), (150.0, 20.0)]
    d = _shortest_path_lens(poly, (158.0, 34.0),
                             {"A": (232.0, 34.0), "B": (158.0, 104.0), "C": (232.0, 104.0)})
    _assert_order(d, ["B", "C", "A"], "HG-2810 (2)U字")

    # ---- HG-2846 (1)正方形（×/B/Cを角からずらす）：A→C→B（ユークリッド距離）
    pts = {"x": (85.0, 20.0), "A": (28.0, 20.0), "B": (45.0, 110.0), "C": (90.0, 110.0)}
    d = {k: _euclid(pts["x"], pts[k]) for k in ("A", "B", "C")}
    _assert_order(d, ["A", "C", "B"], "HG-2846 (1)正方形")

    # ---- HG-2846 (2)U字（同じ向き直し。設問には使われていないが表示との整合のため）
    poly = [(150.0, 110.0), (240.0, 110.0), (240.0, 20.0), (210.0, 20.0),
            (210.0, 80.0), (180.0, 80.0), (180.0, 20.0), (150.0, 20.0)]
    d = _shortest_path_lens(poly, (158.0, 34.0),
                             {"A": (232.0, 34.0), "B": (158.0, 104.0), "C": (232.0, 104.0)})
    _assert_order(d, ["B", "C", "A"], "HG-2846 (2)U字")

    # ---- HG-2846 (3)蛇行（連結部を「下段-中段=右／中段-上段=左」に）：C→A→B（ひも状、BFS）
    poly = [(280, 20), (390, 20), (390, 42), (302, 42), (302, 59), (390, 59),
            (390, 81), (390, 120), (280, 120), (280, 98), (368, 98), (368, 81),
            (280, 81), (280, 42)]
    d = _shortest_path_lens(poly, (294, 113),
                             {"C": (294, 74), "A": (294, 35), "B": (374, 35)})
    _assert_order(d, ["C", "A", "B"], "HG-2846 (3)蛇行")


# ================================================================ 置きかえ表
# ("R", パス, もとの文字列, 置く文字列)   … その大問の中でちょうど1回だけ出ることを確かめて置く
# ("APPEND_STEPS", 新しい steps 要素のリスト)  … 質問文が既に有れば足さない（冪等）
EDITS = [
    ("hd_4r_k12_573_4", [
        # ---------------------------------------------------------- 重大1
        # (1)正方形の図で、Cが「×のすぐ右」ではなく対角の角（Bと同じ側）に描かれていて、
        # ×→Cと×→Aの道のりが同じ長さになり答えが決まらない。原簿の作問メモ自身が
        # 「Cを右下の角に置くと答えが決まらない」と名指しで警告している通りの不具合。
        # Cを×のすぐ右へ動かす。
        ("R", "svg",
         "<text x=\"102.0\" y=\"104.0\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text>",
         "<text x=\"50.0\" y=\"104.0\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text>"),
        # ---------------------------------------------------------- 重大2
        # (2)U字型の図が、原簿の文章（左の縦棒・下の横棒・右の縦棒＝連結部は下）とも、
        # 答えの理由（左上→左下→右下→右上と回るしかない＝連結部は下）とも逆向きに
        # 描かれている（連結部が上・下が開いている＝逆さのU）。上下反転して直す。
        ("R", "svg",
         "points=\"150.0,20.0 240.0,20.0 240.0,110.0 210.0,110.0 210.0,50.0 180.0,50.0 180.0,110.0 150.0,110.0\"",
         "points=\"150.0,110.0 240.0,110.0 240.0,20.0 210.0,20.0 210.0,80.0 180.0,80.0 180.0,20.0 150.0,20.0\""),
    ]),
    ("hd_4r_k12_609_4", [
        # ---------------------------------------------------------- 重大3
        # (1)正方形の×・B・Cが4隅ちょうどに描かれていて、A（上辺左端）とC（下辺右端
        # 経由）の道のりが同じ長さになりうる。原簿は「×＝上辺の中央より右」「B＝下辺の
        # 中央より左」「C＝下辺の右寄り」と角からずらして書いてあるのに、図では角に
        # 丸められていた。×・B・Cを角から少しずらし、A→C→Bの順が保たれるようにする。
        ("R", "svg",
         "<text x=\"102.0\" y=\"34.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">×</text>",
         "<text x=\"85.0\" y=\"34.0\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">×</text>"),
        ("R", "svg",
         "<text x=\"28.0\" y=\"104.0\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text>",
         "<text x=\"45.0\" y=\"104.0\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text>"),
        ("R", "svg",
         "<text x=\"102.0\" y=\"104.0\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text>",
         "<text x=\"90.0\" y=\"104.0\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text>"),
        # ---------------------------------------------------------- 中1
        # (2)U字型（573回と同じ図・573回と同じ理由で上下逆）。この回では(2)を問う設問は
        # 無いが、intro画像として表示され続けるので、573回と同じ向き直しをする。
        ("R", "svg",
         "points=\"150.0,20.0 240.0,20.0 240.0,110.0 210.0,110.0 210.0,50.0 180.0,50.0 180.0,110.0 150.0,110.0\"",
         "points=\"150.0,110.0 240.0,110.0 240.0,20.0 210.0,20.0 210.0,80.0 180.0,80.0 180.0,20.0 150.0,20.0\""),
        # ---------------------------------------------------------- 重大4
        # (3)蛇行型。設問文自身に「下段と中段は右はしで、中段と上段は左はしでつながって
        # いる」という説明が入っているのに、実際の図はどちらの連結部も右はし（くしの
        # 形）に描かれていて、C→A→Bの答えの順にならない（実測するとB→C→Aになる）。
        # 連結部を「下段-中段＝右／中段-上段＝左」に描き直す。
        ("R", "svg",
         "points=\"390.0,20.0 280.0,20.0 280.0,42.0 368.0,42.0 368.0,59.0 280.0,59.0 280.0,81.0 368.0,81.0 368.0,98.0 280.0,98.0 280.0,120.0 390.0,120.0\"",
         "points=\"280.0,20.0 390.0,20.0 390.0,42.0 302.0,42.0 302.0,59.0 390.0,59.0 390.0,81.0 390.0,120.0 280.0,120.0 280.0,98.0 368.0,98.0 368.0,81.0 280.0,81.0 280.0,42.0\""),
        # ---------------------------------------------------------- 重大5
        # 小問5「厚手のセーター」は原簿に無い自作の設問で、しかも解説が「対流（空気の
        # 流れ）を止めている」と言いながら答えは「対流と関係ない」で自己矛盾している。
        # 原簿(3)に実在する項目ア（クーラーのふき出し口を上向きにする＝対流の例）に
        # 差しかえる。選択肢は「ある／ない」のまま変えない。
        ("R", "steps/4/question",
         "厚手のセーターを着ると、体があたたかく感じる。これは、水や空気が動いて熱が伝わる「対流」と関係がありますか。",
         "クーラーのふき出し口を上向きにすると、部屋全体が早く冷える。これは、空気が動いて熱が伝わる「対流」と関係がありますか。"),
        ("R", "steps/4/answer", "ない", "ある"),
        ("R", "steps/4/meaning",
         "セーターは、空気の流れ（対流）を止めて、体の熱がにげにくくしているだけです。熱そのものが動いて伝わる現象ではないので、対流とは関係ありません。",
         "上向きに出た冷たい空気は下にたまり、下にあった空気は上へ動きます。この空気の流れ（対流）で部屋全体が冷えるので、対流と関係があります。"),
    ]),
    # ---------------------------------------------------------------- 中2
    # hd_4r_k01_634_4（HG-1676）原簿の設問(1)（グラフのあ・い・うの時点で氷はどんな
    # すがたか）が丸ごと未実装。この回でただ一つ理科の知識を問う設問がすっぽり
    # 抜けている（(2)(3)(4)は原簿自身が「完全に算数」と明記）。あ・い・うの点を
    # 図に追加し、3つの設問を末尾に足す。
    ("hd_4r_k01_634_4", [
        ("R", "svg",
         "</svg>",
         "<circle cx='61.75' cy='144.83' r='3.0' fill='#06d6a0'/><text x='75.0' y='148.0' fill='#06d6a0' font-size='10' text-anchor='start'>う</text><circle cx='113.5' cy='135.7' r='3.0' fill='#06d6a0'/><text x='113.5' y='148.0' fill='#06d6a0' font-size='10' text-anchor='middle'>い</text><circle cx='228.5' cy='80.67' r='3.0' fill='#06d6a0'/><text x='215.0' y='80.67' fill='#06d6a0' font-size='10' text-anchor='end'>あ</text></svg>"),
        ("APPEND_STEPS", [
            {
                "question": "[グラフ]で、う（0分から3分の間）のとき、−20℃の氷はどのようなすがたになっていますか。",
                "answer": "氷のままである",
                "choices": ["氷のままである", "氷がすべてとけて、水になっている", "氷の一部がとけて、氷と水がまざっている"],
                "meaning": "うは0分から3分の間で、まだ0℃に達していません。0℃になるまでは氷はとけないので、氷のままです。",
            },
            {
                "question": "[グラフ]で、い（3分から27分の間）のとき、−20℃の氷はどのようなすがたになっていますか。",
                "answer": "氷の一部がとけて、氷と水がまざっている",
                "choices": ["氷の一部がとけて、氷と水がまざっている", "氷のままである", "氷がすべてとけて、水になっている"],
                "meaning": "3分で0℃になってから27分までは温度が0℃のまま変わりません。これは氷がとけている最中で、氷と水がまざっているからです。",
            },
            {
                "question": "[グラフ]で、あ（27分から57分の間、51分より前）のとき、−20℃の氷はどのようなすがたになっていますか。",
                "answer": "氷がすべてとけて、水になっている",
                "choices": ["氷がすべてとけて、水になっている", "氷のままである", "氷の一部がとけて、氷と水がまざっている"],
                "meaning": "27分で氷はすべてとけ終わり、そこから温度がまた上がり始めます。あはその後（51分より前）の点なので、もうすべて水になっています。",
            },
        ]),
    ]),
    # ---------------------------------------------------------------- 中3
    # hd_4r_k01_610_4（HG-2847）原簿の設問(4)（0℃のまま変わらない理由の穴うめ・
    # 漢字1字×2）が未実装。末尾に選択式で足す（テンキーでは漢字を打てないため、
    # 組み合わせを選ぶ4択にする）。
    ("hd_4r_k01_610_4", [
        ("APPEND_STEPS", [
            {
                "question": "2分から18分まで温度が0℃のまま変わらない理由を説明した次の文の（①）（②）に入る言葉の組み合わせとして正しいものを選びなさい。「氷にあたえた熱が、（①）を（②）に変えるために使われたから。」",
                "answer": "①氷・②水",
                "choices": ["①氷・②水", "①水・②氷", "①氷・②水じょう気", "①水・②水じょう気"],
                "meaning": "0℃のまま温度が変わらない間は、熱が氷を水に変える（とかす）ためだけに使われていて、温度を上げるためには使われていません。だから①は氷、②は水です。",
            },
        ]),
    ]),
]


# ================================================================ 当てる
def _get_holder(x, path):
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
    for edit in edits:
        kind = edit[0]
        if kind == "R":
            _, path, old, new = edit
            holder, key = _get_holder(x, path)
            cur = holder.get(key, "")
            assert isinstance(cur, str), "文字列でない項目は触らない: " + path
            if new in cur and (old not in cur or old in new):
                continue  # すでに直っている
            if old not in cur:
                assert new in cur, "%s: もとの文字列も置きかえ後の文字列も見つからない -> %r" % (path, old[:60])
                continue  # すでに直っている
            n = cur.count(old)
            assert n == 1, "%s: アンカーが %d 回出る（1回でないので置きかえない）-> %r" % (path, n, old[:60])
            holder[key] = cur.replace(old, new)
            changed += 1
        elif kind == "APPEND_STEPS":
            _, new_steps = edit
            steps = x.setdefault("steps", [])
            existing_q = set(s.get("question") for s in steps if isinstance(s, dict))
            for ns in new_steps:
                if ns["question"] in existing_q:
                    continue  # すでに足してある（冪等）
                steps.append(dict(ns))
                changed += 1
        else:
            raise AssertionError("知らない種類: " + kind)
    return changed


def main(argv):
    path = argv[1] if len(argv) > 1 else DEFAULT_JSON
    path = os.path.abspath(path)

    def log(s):
        sys.stdout.write(s + "\n")

    log("対象: " + path)

    log("---- 図形の座標検算 ----")
    _verify_geometry()
    log("  5件の図形修正すべてOK（xからの近い順が原簿の答えと一致）")

    with io.open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    newline = "\r\n" if "\r\n" in raw else "\n"
    d = json.loads(raw)
    log("  改行コード: %s" % ("CRLF" if newline == "\r\n" else "LF"))

    index = {}
    for rec in iter_daimon(d):
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
