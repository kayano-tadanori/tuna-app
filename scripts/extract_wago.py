# -*- coding: utf-8 -*-
"""原簿の小5最レ国語「和語(1)(2)(3)」から、語・意味・出典を機械抽出する。

種本＝原簿の HG-2546（和語(1) あ〜こ）／HG-2550（和語(2) さ〜た）／HG-2557（和語(3) は〜わ）。
レコードの「設問・答え」行は次の形：
    (2) あ□□さま／明白なさま。＝**あからさま**
⚠付き（答えが未確定）は落とす（→ [[feedback_kaisetsu_reader]]「確定できない答えは出さない」）。

★答えの書き方が原簿で2通りに混ざっている（語全体／□に入る部分だけ）ので、
  マスの数と字数を突き合わせて **語全体に正規化**する。どちらとも合わない語は落として報告する。
"""
import io, json, os, re, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genbo_path import find_genbo          # noqa: E402

BOOKS = [("2546", "和語(1)", "あ〜こ"), ("2550", "和語(2)", "さ〜た"), ("2557", "和語(3)", "は〜わ")]
# ⚠ [^／] は改行も食うので \n を必ず除く（これを忘れて見出し行を巻きこんだ）
LINE = re.compile(r"\((\d+)\)\s*([^／/\n]+?)／([^＝=\n]+?)＝\*\*([^*\n]+?)\*\*")


def body(text, hg):
    m = re.search(r"^### 【HG-%s】.*?$(.*?)(?=^### 【HG-|\Z)" % hg, text, re.S | re.M)
    return m.group(1) if m else ""


def fill(mask, ans):
    """マスクと答えから「語全体」を作る。合わなければ None"""
    boxes = mask.count("□")
    fixed = len(mask) - boxes
    if len(ans) == boxes + fixed and "□" not in ans:
        return ans                                   # 答えが語全体で書かれている
    if len(ans) == boxes:                            # 答えが□に入る部分だけ
        it = iter(ans)
        return "".join(next(it) if ch == "□" else ch for ch in mask)
    return None


def main():
    text = io.open(find_genbo(), encoding="utf-8").read()
    out, dropped, mismatch = [], [], []
    for hg, unit, span in BOOKS:
        b = body(text, hg)
        assert b, "HG-%s が原簿に無い" % hg
        for m in LINE.finditer(b):
            no, mask, mean, ans = (s.strip() for s in m.groups())
            if "⚠" in ans or "未確定" in ans:
                dropped.append((unit, no, mask, ans)); continue
            ans = re.sub(r"（.*?）", "", ans).strip()
            word = fill(mask, ans)
            if word is None:
                mismatch.append((unit, no, mask, ans)); continue
            out.append({"unit": unit, "span": span, "no": int(no), "hg": "HG-" + hg,
                        "mask": mask, "meaning": mean.rstrip("。") + "。", "word": word})
        print("%s（%s）… 採用 %d ／ ⚠で落とした %d ／ マス数が合わず落とした %d"
              % (unit, span, sum(1 for q in out if q["unit"] == unit),
                 sum(1 for d in dropped if d[0] == unit),
                 sum(1 for d in mismatch if d[0] == unit)))
    print("\n合計 %d語" % len(out))
    print("\n【⚠で落とした %d語＝要現物照合】" % len(dropped))
    for u, n, mk, a in dropped:
        print("  %s (%s) %s → %s" % (u, n, mk, a))
    if mismatch:
        print("\n【マス数と答えが合わない %d語＝原簿を直す】" % len(mismatch))
        for u, n, mk, a in mismatch:
            print("  %s (%s) %s ＝ %s（□%d個＋固定%d字なのに答えは%d字）"
                  % (u, n, mk, a, mk.count("□"), len(mk) - mk.count("□"), len(a)))
    json.dump(out, io.open(os.path.join(HERE, "_wago_raw.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print("\n→ scripts/_wago_raw.json に %d語を書き出した" % len(out))


if __name__ == "__main__":
    main()
