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

DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

# ★原簿に図はあるが、アプリの大問には付けないもの（理由つき）。
#   原簿の図は「その大問ぜんぶ」のもので、アプリが一部の小問だけを実装しているときに起きる。
NO_FIG = {
    # 623回大問3の図は(2)のスイッチ回路。アプリが実装しているのは(1)の
    # 「次のものは電気を通すか」5問だけで、回路の図は要らない。
    # しかも原簿自身が「電池の向きと枝の接続は要現物照合」としていてスイッチ1も描けておらず、
    # 図の中に「はしご状の回路。スイッチ4の枝は…（行き止まり）」という制作メモが入っている。
    "HG-1651": "アプリは(1)の5問だけを実装。(2)のスイッチ回路の図は不要（原簿の図は要現物照合のまま）",
}


def genbo_svgs():
    g = io.open(find_genbo(), encoding="utf-8").read()
    out = {}
    skipped = []
    for r in re.split(r"(?=^### 【HG-)", g, flags=re.M):
        m = re.match(r"### 【(HG-\d+)】", r)
        if not m:
            continue
        # ★1つのレコードに「- 図SVG:」以外の欄（「- 図SVG（選択肢ア〜エ）:」など）もあるときは、
        #   このスクリプトでは扱えない（アプリ側は複数の図を1つにまとめて持っている）。
        #   黙って上書きすると図が半分になるので、まるごと見送る。
        #   2026-09-03に HG-5065 で発覚：810×254の「四角形のベン図＋選択肢」を、
        #   220×122の「三角形のベン図」だけで上書きしてしまった
        if len(re.findall(r"^- 図SVG[^\n:]*:", r, re.M)) > 1:
            skipped.append(m.group(1))
            continue
        m2 = re.search(r"^- 図SVG: (.+)$", r, re.M)
        if m2:
            # ★`…` の"中だけ"を取る。閉じバッククォートの後ろに注記が続く書き方があり、
            #   strip("`") だとその注記まで図に混ざる（2026-09-02 に HG-2679 で発覚）
            v = m2.group(1).strip()
            bq = re.match(r"`(.*?)`", v, re.S)
            out[m.group(1)] = (bq.group(1) if bq else v.strip("`")).strip()
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
