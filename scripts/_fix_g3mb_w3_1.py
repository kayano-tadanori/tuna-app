# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.18 監査（g3mb_w3・audit_1）で見つかった内容の修正。

対象: HG-4188 (hd3mb_18_3) / HG-4197 (hd3mb_18_12)
  1. HG-4188 小問3: 解説が「底辺以外のもう1辺」を求める言い回しになっていて、
     設問（底辺□cmを求める）と噛み合っていなかった。二等辺三角形の性質から
     素直に説明する文に直す。
  2. HG-4197 小問2: 設問文が「角OBC＝30°」と書いているが、SVGを実測すると
     30°の弧はO-B-Aがわ（角ABO）に描かれており、OBCの位置には④の弧が
     別に描かれている。meaning側（180−30×2＝120）は角ABOを底角として使う
     正しい計算のままなので、設問文だけを実際の図に合わせて直す。
  3. HG-4197 小問4: 上と同じ理由で、④は実際には「角OBC」そのものを聞いている
     （meaning: 180−60×2＝60 は三角形OBCの頂角を求める式）。「以外」を取る。
  4. HG-4197 小問5: 設問文が星の先端を㋐㋑㋒㋓㋔と呼んでいるが、SVGの実際の
     ラベルはア・イ・ウ・エ・オ。表記をSVGに合わせる。

  検算の詳細は docs/_audit/g3mb_w3/findings_1.md 参照。

使い方:
    python scripts/_fix_g3mb_w3_1.py [対象JSONのパス（省略時 data/hama_daimon.json）]

  ・大問は genbo_common.iter_daimon() だけで引く（自前で入れ子を歩かない）。
  ・各修正は「対象ステップの該当欄が旧文言と一字一句一致する」ことを確認してから
    置き換える＝置換前にちょうど1回であることを保証する。
  ・冪等：欄がすでに新文言なら何もしない。旧文言でも新文言でもない場合は
    内容が想定外に変わっているとみなし、書き込み前に全体を中止する。
  ・書き出しは io.open(path, "wb") で行う（Writeツールは使わない）。
"""
import io
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common as gc  # noqa: E402


# (daimon_id, step_index, field, 旧文言, 新文言)
FIXES = [
    (
        "hd3mb_18_3", 2, "meaning",
        "等しい辺の長さがそのまま底辺以外のもう1辺になる。",
        "二等辺三角形は2辺の長さが等しい。3.2cmの辺は1本だけなので、"
        "のこりの辺は5.6cmの辺と同じ長さになる。",
    ),
    (
        "hd3mb_18_12", 1, "question",
        "② OA,OB,BCが同じ長さの三角形で、角OBC＝30°のとき、角AOB（②）は？",
        "② OA,OB,BCが同じ長さの三角形で、角ABO＝30°のとき、角AOB（②）は？",
    ),
    (
        "hd3mb_18_12", 3, "question",
        "④ 角OBC以外の角（④）は何度ですか。",
        "④ 角OBC（④）は何度ですか。",
    ),
    (
        "hd3mb_18_12", 4, "question",
        "⑤ 星形の㋐㋑㋒㋓㋔の角度の合計は？",
        "⑤ 星形のアイウエオの角度の合計は？",
    ),
]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(SCRIPT_DIR), "data", "hama_daimon.json")
    path = os.path.abspath(path)

    d = json.load(io.open(path, encoding="utf-8"))

    by_id = {}
    for r in gc.iter_daimon(d):
        x = r["x"]
        rid = x.get("id")
        if rid:
            by_id.setdefault(rid, []).append(x)

    changed = 0
    already = 0
    plan = []  # (x, step_idx, field, new) を先に集め、全部assertが通ってから書く

    for daimon_id, step_idx, field, old, new in FIXES:
        matches = by_id.get(daimon_id)
        if not matches:
            raise SystemExit("大問が見つからない: id=%s" % daimon_id)
        if len(matches) != 1:
            raise SystemExit("大問idが重複している: id=%s (%d件)" % (daimon_id, len(matches)))
        x = matches[0]
        steps = x.get("steps") or []
        if step_idx >= len(steps):
            raise SystemExit("小問index範囲外: id=%s step=%d (steps=%d本)"
                              % (daimon_id, step_idx, len(steps)))
        step = steps[step_idx]
        cur = step.get(field)
        if cur == new:
            already += 1
            continue
        if cur != old:
            raise SystemExit(
                "想定外の内容（旧文言でも新文言でもない）。手で確認すること。\n"
                "  id=%s step=%d field=%s\n  現在の値: %r\n  期待した旧文言: %r"
                % (daimon_id, step_idx, field, cur, old))
        plan.append((step, field, new, daimon_id, step_idx))

    if not plan:
        print("修正対象はすべて適用済み（変更なし）。already=%d" % already)
        return

    for step, field, new, daimon_id, step_idx in plan:
        step[field] = new
        changed += 1

    out = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    io.open(path, "wb").write(out.encode("utf-8"))
    print("修正 %d件 適用（既に適用済み %d件）: %s" % (changed, already, path))


if __name__ == "__main__":
    main()
