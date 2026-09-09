# -*- coding: utf-8 -*-
"""K1（図が答えをそのまま見せている）の5大問を直す。2026-09-09。

  見つけたのは `scripts/check_kata.py K1`。22件の「重」を1本ずつ原本の設問と
  突き合わせ、**5大問が本物・3大問が誤検出**と判定した（誤検出＝表の項目名で、
  答えは計算・推理しないと出ないもの：hd3n_12_4／hd3mb_19_8／hd_5r_k03_600_1）。

  ★冪等の判定は「欄まるごとの一致」でやる（→method_kansa_pipeline の冪等の罠）。
    直ったあとの文字列と一致 → 済み／直す前の文字列と一致 → 当てる。
"""
import io, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G

sys.stdout.reconfigure(encoding="utf-8")

# id → [(直す前の<text>の中身, 直したあとの中身), ...]
# ""（空）にしたものは、その<text>要素ごと消す。
FIX = {
    # ①〜⑩の形の名前を答えさせる問題なのに、図が名前を全部書いていた
    "hd3mb_43_3": [("①正三角形", "①"), ("②二等辺三角形", "②"), ("③直角三角形", "③"),
                   ("④直角二等辺三角形", "④"), ("⑤円", "⑤"), ("⑥長方形", "⑥"),
                   ("⑦正方形", "⑦"), ("⑧平行四辺形", "⑧"), ("⑨台形", "⑨"),
                   ("⑩ひし形", "⑩")],
    # 折って切って開いた形の名前を答えさせる問題。図に答えが添えてあった
    "hd3mb_43_5": [("直角二等辺三角形", ""), ("正三角形", ""), ("ひし形", ""), ("正方形", "")],
    # 「①のような立体をアといいます」→アを答える問題。図が「①直方体」と書いていた
    "hd3mb_43_6": [("①直方体", "①"), ("②立方体", "②")],
    # 矢印A〜Fの変化の名前を答える問題。図がかっこで名前を書いていた
    "hd_4r_k12_597_4": [("A（凝華）", "A"), ("B（じょう発）", "B"), ("C（ゆうかい）", "C"),
                        ("D（凝結）", "D"), ("E（ぎょう固）", "E"), ("F（しょうか）", "F")],
    # 「何レンズといいますか」→ キャプションが「とつレンズ」と答えを言っていた
    "hd_4r_k06_567_4": [("とつレンズを通った日光がF点に集まる。あ・い・うはレンズに近い順の3位置",
                         "レンズを通った日光がF点に集まる。あ・い・うはレンズに近い順の3位置")],
}


def swap(svg, old, new):
    """<text …>old</text> を new に置きかえる。new が空なら要素ごと消す。
    その図の中でちょうど1回しか出ないことを確かめてから触る。"""
    pat = re.compile(r"<text\b[^>]*>" + re.escape(old) + r"</text>")
    n = len(pat.findall(svg))
    if n == 0:
        return svg, 0
    assert n == 1, "1つの図に %r が %d回ある（想定は1回）" % (old, n)
    return pat.sub("" if new == "" else
                   (lambda m: m.group(0).replace(">" + old + "<", ">" + new + "<")), svg), 1


def main():
    path = os.path.join(G.BASE, "data", "hama_daimon.json")
    d = json.load(io.open(path, encoding="utf-8"))
    done = touched = already = 0
    for r in G.iter_daimon(d):
        x = r["x"]
        if x["id"] not in FIX:
            continue
        fields = [("svg", x)] + [("svg", s) for s in x.get("steps") or []]
        for old, new in FIX[x["id"]]:
            hit = 0
            for key, holder in fields:
                svg = holder.get(key) or ""
                if not svg:
                    continue
                # 済みかどうかを先に見る（新しい形が入っていればもう当たっている）
                if new and re.search(r"<text\b[^>]*>" + re.escape(new) + r"</text>", svg):
                    hit = -1
                    break
                svg2, n = swap(svg, old, new)
                if n:
                    holder[key] = svg2
                    hit = 1
                    break
            if hit == 1:
                done += 1
            elif hit == -1:
                already += 1
            else:
                print("  ⚠ %s: %r が見つからない" % (x["id"], old))
        touched += 1
    io.open(path, "w", encoding="utf-8", newline="\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("大問 %d本 ／ 直した欄 %d ／ すでに直っていた %d" % (touched, done, already))


if __name__ == "__main__":
    main()
