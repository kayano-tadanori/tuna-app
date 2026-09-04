# -*- coding: utf-8 -*-
"""原簿の「- 図SVG:」欄を、アプリ（hama_daimon.json）の svg に写す。

★図の源は原簿ひとつ。アプリ側で図を作らない（2026-08-11・本人指示）。
  原簿を取るときPDFを見ながら描いた図を、ここで機械的に配るだけにする＝二度手間が消える。
  「判読不能」と書かれている大問は、アプリからも svg を外す（作り物を置かない）。

使い方:
  python scripts/sync_genbo_svg.py            … 差分を見るだけ
  python scripts/sync_genbo_svg.py --write    … 実際に書き込む
"""
import io, json, os, re, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
import genbo_common

DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

NO_FIG = genbo_common.NO_FIG   # ★実体は genbo_common.py に1つだけ。ここに写さない


def genbo_svgs():
    """原簿の「- 図SVG:」欄を {HG番号: SVG} で返す。

    ★欄を見つける処理そのものは scripts/genbo_common.py の find_svg_fields() 1か所だけ。
      同じ正規表現をここに写さない（2026-09-04に切り出し。逆向きの sync_svg_to_genbo.py と
      共有するため。コピーを持つと片方が古びる＝このリポジトリで実際に起きた事故）。

    ★このスクリプトが配るのは「かっこ書きの無い『- 図SVG:』が1つだけ」のレコードに限る。
      ・欄が2つ以上 → アプリ側は複数の図を1つにまとめて持っているので機械では選べない。
        黙って上書きすると図が半分になる（2026-09-03 HG-5065）。まるごと見送る。
      ・かっこ書きつきの欄（「- 図SVG（(1)）:」など）だけのレコード → 小問ごとの図なので
        大問1つの svg には当てはめられない。
      ・```html ブロック形式（fence）→ **今は配っていない**。切り出し前からの動きを
        1ビットも変えないため、ここでは触らない（2026-09-04時点で78レコードが該当。
        うち70はすでにアプリ側と一致、7はアプリに svg が無い、1は空文字）。
        配るかどうかは本人の判断が要る＝勝手に広げない。
    """
    g = io.open(find_genbo(), encoding="utf-8").read()
    out = {}
    skipped = []
    for hg, s, e in genbo_common.split_records(g):
        fields = genbo_common.find_svg_fields(g[s:e])
        if len(fields) > 1:
            skipped.append(hg)
            continue
        for f in fields:
            if f["qual"] is not None or f["style"] in ("fence", "empty"):
                continue
            out[hg] = f["value"].strip()
    if skipped:
        print("⚠ 図SVGの欄が2つ以上あるので見送った大問: %d本 … %s"
              % (len(skipped), " ".join(skipped[:12]) + (" ほか" if len(skipped) > 12 else "")))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    src = genbo_svgs()
    print("原簿が図SVGを持つ大問:", len(src))

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    set_n = drop_n = same_n = 0
    for grade, gv in d.get("grades", {}).items():
        for course, node in gv.items():
            if not isinstance(node, dict):
                continue
            for kind in ("fukushu", "kokai", "units", "kouza1", "kouza2"):
                for _, v in (node.get(kind) or {}).items():
                    for x in v:
                        hg = x.get("hg") or x.get("src")
                        if not hg:
                            continue
                        m_hg = re.search(r"HG-\d+", hg)
                        hg = m_hg.group(0) if m_hg else hg
                        if hg not in src:
                            continue
                        want = src[hg]
                        if hg in NO_FIG:
                            if x.pop("svg", None) is not None:
                                drop_n += 1
                            continue
                        if want == "判読不能":
                            if x.pop("svg", None) is not None:
                                drop_n += 1
                            continue
                        if x.get("svg") == want:
                            same_n += 1
                        else:
                            x["svg"] = want
                            set_n += 1
    print("写した: %d ／ 一致ずみ: %d ／ 判読不能で外した: %d" % (set_n, same_n, drop_n))

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
