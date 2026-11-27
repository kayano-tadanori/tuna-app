# -*- coding: utf-8 -*-
"""2026-11-27 公開学力テスト（小5 第643・644回／小3 第642〜644回）＋小5灘合理科 第8〜10回を、アプリに流しこむ

  材料（gitの外）: docs/_genbo/kokai_2611/sakumon/*.json（全小問の作問。publish true/false）・g1/*.md（原簿レコード）
  python scripts/kokai2611_ship.py check            … 材料の点検だけ
  python scripts/kokai2611_ship.py app [--write]    … data/hama_daimon.json に publish=true の小問だけ入れる（同じ id は置きかえ）
                                                       ＋ hama_map の灘合理科に第8〜10回の回を足す
  入れ先は id の形で決まる：
    hd_5m_kMM_* → grades.5.master.kokai[MM]   hd_5r_kMM_* → grades.5.rika.kokai[MM]   hd_5k_kMM_* → grades.5.kokugo.kokai[MM]
    hd_3m_kMM_* → grades.3.master.kokai[MM]   hd_3k_kMM_* → grades.3.kokugo.kokai[MM]
    hd5n_NN_r*  → grades.5.nadago_rika.fukushu[NN]
  ★原簿への追記は済んでいる（2026-11-27・HG-11861〜11990）。ここでは原簿を触らない
"""
import io, json, os, re, sys, glob
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(BASE, "docs", "_genbo", "kokai_2611")
NUMPAD = re.compile(r"^(\d+(\.\d+)?|\d+/\d+|\d+と\d+/\d+|\d+(\.\d+)?([:：]\d+(\.\d+)?)+|\d+(\.\d+)?余り\d+(\.\d+)?)$")   # js/sansu.js isNumpadAnswer・isRatioAnswer と同じ形
APP_KEYS = ["id", "src", "hg", "title", "category", "unit", "grade", "star", "intro", "svg", "steps"]
STEP_KEYS = ["question", "answer", "choices", "meaning", "svg", "withMainSvg"]
NADA_TITLE = {8: "こん虫（なかま分け・育ち方・確認テスト）", 9: "星と月（星座・月の満ち欠け・確認テスト）", 10: "力学Ⅱ（てこ・かっ車・ばね・確認テスト）"}


def where(i):
    m = re.match(r"hd_(\d)([mrk])_k(\d\d)_\d+_", i)
    if m:
        return m.group(1), {"m": "master", "r": "rika", "k": "kokugo"}[m.group(2)], "kokai", str(int(m.group(3)))
    m = re.match(r"hd5n_(\d\d)_r", i)
    if m:
        return "5", "nadago_rika", "fukushu", str(int(m.group(1)))
    return None


def load():
    out = []
    for p in sorted(glob.glob(os.path.join(W, "sakumon", "*.json"))):
        k = os.path.basename(p)[:-5]
        sk = json.load(io.open(p, encoding="utf-8"))
        md = io.open(os.path.join(W, "g1", k + ".md"), encoding="utf-8").read()
        out.append((k, sk, md))
    return out


def check():
    bad = 0; tot = [0, 0, 0]; ids = set()
    for k, sk, md in load():
        hgs = re.findall(r"^### 【(HG-\d+)】", md, re.M)
        if [x.get("hg") for x in sk] != hgs:
            print(f"!! {k} 原簿の HG の並びと作問の並びがちがう（原簿{len(hgs)}本／作問{len(sk)}本）"); bad += 1
        ctl = re.findall(r"\\u00[01][0-9a-fA-F]", json.dumps(sk, ensure_ascii=False))
        if ctl: print(f"!! {k} 制御文字 {len(ctl)}か所"); bad += 1
        for x in sk:
            tot[0] += 1
            if x["id"] in ids: print("!! id が重なる", x["id"]); bad += 1
            ids.add(x["id"])
            if not where(x["id"]): print("!! id の形が入れ先に当たらない", x["id"]); bad += 1
            for s in x["steps"]:
                tot[1] += 1
                if not (s.get("meaning") or "").strip(): print("!! meaningなし", x["id"], s.get("sub")); bad += 1
                if s.get("publish"):
                    tot[2] += 1
                    ch = s.get("choices")
                    if ch:
                        if s["answer"] not in ch or len(set(ch)) != len(ch): print("!! choices", x["id"], s["answer"], ch); bad += 1
                    elif not NUMPAD.match(str(s["answer"]).strip()): print("!! テンキー不可", x["id"], s["answer"]); bad += 1
    print(f"大問{tot[0]}・小問{tot[1]}（アプリへ{tot[2]}）・問題 {bad}件")
    return bad == 0


def items():
    for k, sk, md in load():
        for x in sk:
            st = []
            for s in x["steps"]:
                if not s.get("publish"): continue
                y = {kk: s[kk] for kk in STEP_KEYS if kk in s and s[kk] not in (None, "")}
                if "choices" in y and NUMPAD.match(str(y["answer"]).strip()): y.pop("choices")
                st.append(y)
            if not st: continue
            y = {kk: x[kk] for kk in APP_KEYS if kk in x}
            y["steps"] = st
            yield where(x["id"]), y


def dump(p, d, raw):
    nl = "\r\n" if "\r\n" in raw else "\n"
    m = re.search(r"\n( +)\S", raw); ind = len(m.group(1)) if m else 1
    txt = json.dumps(d, ensure_ascii=False, indent=ind)
    if nl == "\r\n": txt = txt.replace("\n", "\r\n")
    if raw.endswith(nl) and not txt.endswith(nl): txt += nl
    io.open(p, "w", encoding="utf-8", newline="").write(txt)


def app(write):
    if not check(): sys.exit("点検で止めた")
    p = os.path.join(BASE, "data", "hama_daimon.json"); raw = io.open(p, encoding="utf-8", newline="").read(); d = json.loads(raw)
    cnt = {}
    for (g, c, b, key), y in items():
        lst = d["grades"][g].setdefault(c, {}).setdefault(b, {}).setdefault(key, [])
        lst[:] = [z for z in lst if z["id"] != y["id"]] + [y]
        cnt.setdefault((g, c, b, key), [0, 0]); cnt[(g, c, b, key)][0] += 1; cnt[(g, c, b, key)][1] += len(y["steps"])
    for k, v in sorted(cnt.items()): print("/".join(k), f"大問{v[0]}・小問{v[1]}")
    mp = os.path.join(BASE, "data", "hama_map.json"); mraw = io.open(mp, encoding="utf-8", newline="").read(); m = json.loads(mraw)
    L = m["grades"]["5"]["courses"]["nadago_rika"]["lessons"]; have = {l["no"] for l in L}
    for n, t in NADA_TITLE.items():
        if n not in have: L.append({"no": n, "title": t})
    if write:
        dump(p, d, raw); dump(mp, m, mraw); print("書きこみ:", p, mp)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    {"check": lambda w: check(), "app": app}[cmd]("--write" in sys.argv)
