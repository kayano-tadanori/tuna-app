# -*- coding: utf-8 -*-
"""小5 模試（灘中チャレンジ第2回 2024・2026／志望校判定オープン模試 2026）の算数・理科をアプリに流しこむ（2026-11-24）

  出し先（本人決定 2026-11-24「灘中レベルに該当するようであればそこ、それほどでなければ通常問題に単元のタグをつけて」）
    A 2024 灘中チャレンジ第2回 算数 → data/sansu_chain.json（灘中レベル・連鎖）
    B 2024 灘中チャレンジ第2回 理科 → data/rika_chain.json（灘中レベル・連鎖）
    C 2026 灘中チャレンジ第2回 算数 → data/sansu_chain.json
    D 2026 志望校判定オープン模試 算数 → 通常問題 data/sansu_<category>.json（1小問＝1問・単元タグ）
    E 2026 志望校判定オープン模試 理科 → 通常問題 data/rika_<category>.json

  材料（gitの外）: docs/_genbo/moshi2/sakumon/A〜E.json（全小問の作問。publish true/false）
                  docs/_genbo/moshi2/app_override.json（アプリ用に書きかえる文。小問の番号で前の小問を指す文など）
  python scripts/moshi2_ship.py check            … 材料の点検と「番号で前の小問を指す文」の洗い出し
  python scripts/moshi2_ship.py build            … アプリに入る形を docs/_genbo/moshi2/app/ に書き出す（監査はこれを読む）
  python scripts/moshi2_ship.py app [--write]    … data/ に入れる（同じ id があれば置きかえ）

  ★連鎖（灘中レベル）は expandChain が小問に (1)(2)… を振り直す＝印刷の番号（(1)・①・問3）は頭から外す。
    出さない小問を外すと番号がずれるので、文中で「問4のとき」「②で正しく答えた」と番号で指す文は
    app_override で中身を書いた文に直す（check が洗い出す）。
  ★通常問題は1問ずつばらばらに出る＝大問の前置き（intro）を問題文の頭に入れ、図も持たせる。
    前の小問の設定が要る問題は、その設定文も app_override で問題文に入れる。
"""
import io, json, os, re, sys, shutil, datetime
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(BASE, "docs", "_genbo", "moshi2")
OUT = os.path.join(W, "app")
NUMPAD = re.compile(r"^(\d+(\.\d+)?|\d+/\d+|\d+と\d+/\d+|\d+(\.\d+)?([:：]\d+(\.\d+)?)+)$")

TESTS = {
    "A": dict(kind="chain", file="sansu_chain", idp="sc_moshi2_c2024s_", src="2024年度 第2回 小5 灘中チャレンジテスト 算数"),
    "B": dict(kind="chain", file="rika_chain", idp="rc_moshi2_c2024r_", src="2024年度 第2回 小5 灘中チャレンジテスト 理科"),
    "C": dict(kind="chain", file="sansu_chain", idp="sc_moshi2_c2026s_", src="2026年度 第2回 小5 灘中チャレンジテスト 算数"),
    "D": dict(kind="tsujo", subj="sansu", src="2026年度 小5 志望校判定オープン模試 算数"),
    "E": dict(kind="tsujo", subj="rika", src="2026年度 小5 志望校判定オープン模試 理科"),
}
# 通常問題：category → ファイルと id の頭（gamify.js の ID_PREFIX_MAP と同じ頭）
TSUJO = {
    "sansu": {"keisan": ("sansu_keisan", "sk"), "kazu": ("sansu_kazu", "sn"), "kisoku": ("sansu_kisoku", "sr"),
              "bun": ("sansu_bun", "sb"), "tokusan": ("sansu_tokusan", "st"), "wariai": ("sansu_wariai", "sw"),
              "zu": ("sansu_zu", "sz"), "hayasa": ("sansu_hayasa", "sh"), "baai": ("sansu_baai", "sc"),
              "rittai": ("sansu_rittai", "sr")},
    "rika": {"shokubutsu": ("rika_shokubutsu", "rp"), "hikari_oto": ("rika_hikarioto", "ho"), "sora": ("rika_sora", "rk"),
             "mono": ("rika_mono", "rm"), "suiyoueki": ("rika_suiyoueki", "rs"), "tenki": ("rika_tenki", "tk"),
             "doubutsu": ("rika_doubutsu", "rd"), "kitai": ("rika_kitai", "kt"), "chikara": ("rika_chikara", "rc")},
}
# 印刷の番号（頭だけ外す）
# ★1行に1つだけ外す。「問5 問4のとき」の「問4」（前の小問を指す語）まで外すと文がこわれる
LABEL = re.compile(r"^\s*(?:問\s*\d+|\(\d+\)|（\d+）|[①-⑳])\s+")
# 番号で前の小問を指す文
REF = re.compile(r"(問\s*\d+\s*(?:の|で|と|より|から)|\(\d+\)\s*(?:の|で|と|より|から)|[①-⑳]\s*(?:の答|で(?:正しく|求め|答え)|より|から))")


def load(k):
    return json.load(io.open(os.path.join(W, "sakumon", k + ".json"), encoding="utf-8"))


def overrides():
    p = os.path.join(W, "app_override.json")
    return json.load(io.open(p, encoding="utf-8")) if os.path.exists(p) else {}


def key(x, s):
    return "%s|%s" % (x["id"], s.get("sub", ""))


LABEL_TOI = re.compile(r"^\s*(?:問\s*\d+|\(\d+\)|（\d+）)\s+")


def strip_label(q):
    # 1行目は番号を外す。2行目以降は「問3 」「(2) 」だけ外し、丸数字は残す
    # ★「① にあてはまるもの」の①まで消して、どの空らんを聞くのか分からなくなった（監査1周目 B 重）
    ln = q.split("\n")
    return "\n".join([LABEL.sub("", ln[0])] + [LABEL_TOI.sub("", t) for t in ln[1:]]).strip()


def clean_intro(t):
    t = (t or "").strip()
    # 「〇〇について、次の問いに答えなさい。」だけの前置きは、1問ずつ出すときは要らない
    if re.fullmatch(r"[^。]{0,30}について、?(次|あと|以下)の問いに答えなさい。", t): return ""
    t = re.sub(r"(これについて[、，]?|このとき[、，]?)?(以下|あと|次)の問いに答えなさい。", "", t)
    t = re.sub(r"このとき[、，]$", "", t)
    t = re.sub(r"^次の□にあてはまる数を求めなさい。$", "", t)
    return t.strip()


def chain_items(k):
    T = TESTS[k]; ov = overrides(); out = []
    for x in load(k):
        st = []
        for s in x["steps"]:
            if not s.get("publish"): continue
            o = ov.get(key(x, s), {})
            y = {"question": o.get("question") or strip_label(s["question"]), "answer": s["answer"]}
            ch = s.get("choices")
            if ch and not NUMPAD.match(str(s["answer"]).strip()): y["choices"] = ch
            y["meaning"] = o.get("meaning") or s["meaning"]
            if s.get("svg"): y["svg"] = s["svg"]
            if s.get("withMainSvg"): y["withMainSvg"] = True
            st.append(y)
        if not st: continue
        n = x["id"].rsplit("_", 1)[1] if x["id"].count("_") == 1 else x["id"].split("_", 1)[1]
        out.append({"id": T["idp"] + n, "src": "%s 原簿・%s %s" % (x["hg"], T["src"], x.get("label", "")),
                    "hg": x["hg"], "category": x["category"], "grade": 5, "title": x["title"], "unit": x["unit"],
                    "intro": ov.get(x["id"] + "|intro", {}).get("intro") or x.get("intro", ""), "steps": st,
                    "svg": x.get("svg", "")})
    return out


# 算数の通常問題の unit は「グループ名」でなく元の単元名（js/sansu.js UNIT_GROUPS の中身）
SANSU_UNIT = {"年令算・平均算": None, "割合・食塩水": None, "数の性質・N進法": None, "図形の相似と移動": None}


def tsujo_items(k):
    T = TESTS[k]; ov = overrides(); out = []
    for x in load(k):
        intro = clean_intro(x.get("intro"))
        for i, s in enumerate(x["steps"]):
            if not s.get("publish"): continue
            o = ov.get(key(x, s), {})
            # 1つの大問に分野のちがう小問がまざる（植物と動物 など）ときは小問ごとに category/unit を持たせる
            cat = o.get("category") or x["category"]; fn, pf = TSUJO[T["subj"]][cat]
            unit = o.get("unit") or ov.get(x["id"] + "|unit", {}).get("unit") or x["unit"]
            if T["subj"] == "sansu" and unit in SANSU_UNIT:
                sys.exit("!! %s の unit『%s』はグループ名。app_override で元の単元名を入れる" % (key(x, s), unit))
            q = o.get("question")
            if not q:
                # 通常問題は1問ずつ出る＝①②を残しても指し先が画面に無い。丸数字も全行で外す
                q = "\n".join(LABEL.sub("", ln) for ln in s["question"].split("\n")).strip()
                if intro: q = intro + "\n" + q
            # 図：連鎖と同じ決まり（小問の図があればそれ、両方要る小問は両方、無ければ大問の図）
            svg = (x["svg"] + s["svg"]) if (s.get("svg") and s.get("withMainSvg") and x.get("svg")) else (s.get("svg") or x.get("svg") or "")
            y = {"id": "%s_%s_%d" % (pf, x["id"], i + 1), "question": q, "answer": s["answer"]}
            ch = s.get("choices")
            if ch and not NUMPAD.match(str(s["answer"]).strip()): y["choices"] = ch
            y["meaning"] = o.get("meaning") or s["meaning"]
            y.update({"grade": 5, "difficulty": int(o.get("difficulty") or x["star"]), "unit": unit,
                      "src": "%s %s %s%s" % (x["hg"], T["src"], x.get("label", ""), s.get("sub") or "")})
            if svg: y["svg"] = svg
            out.append((fn, y))
    return out


def check():
    bad = 0; ov = overrides()
    for k in TESTS:
        for x in load(k):
            for s in x["steps"]:
                if not s.get("publish"): continue
                ch = s.get("choices")
                if ch and not NUMPAD.match(str(s["answer"]).strip()):
                    if s["answer"] not in ch or len(set(ch)) != len(ch): print("!! choices", key(x, s)); bad += 1
                elif not NUMPAD.match(str(s["answer"]).strip()): print("!! テンキー不可", key(x, s), s["answer"]); bad += 1
                o = ov.get(key(x, s), {})
                for fld in ("question", "meaning"):
                    t = o.get(fld) or s[fld]
                    if fld == "question" and not o.get(fld): t = strip_label(t)
                    for m in REF.finditer(t):
                        print("?? 番号で指す %s %s: …%s…" % (key(x, s), fld, t[max(0, m.start() - 15):m.end() + 15].replace("\n", " ")))
    for k in ov:
        if not any(k.split("|")[0] == x["id"] for t in TESTS for x in load(t)): print("!! override の id が無い", k); bad += 1
    print("問題 %d件" % bad)
    return bad == 0


def build():
    os.makedirs(OUT, exist_ok=True)
    allc = []
    for k, T in TESTS.items():
        if T["kind"] == "chain":
            items = chain_items(k); allc += items
            json.dump(items, io.open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print("%s 連鎖 %s: 大問%d・小問%d" % (k, T["file"], len(items), sum(len(i["steps"]) for i in items)))
        else:
            items = tsujo_items(k)
            json.dump([dict(y, _file=fn) for fn, y in items], io.open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            c = {}
            for fn, _ in items: c[fn] = c.get(fn, 0) + 1
            print("%s 通常問題 %d問 %s" % (k, len(items), c))


def write_json(p, d):
    raw = io.open(p, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in raw else "\n"
    # 既存ファイルの書き方（1行／indent）をまねる
    if "\n" not in raw.strip():
        txt = json.dumps(d, ensure_ascii=False)
    else:
        ind = re.match(r"\[\s*\n(\s*)\{", raw)
        txt = json.dumps(d, ensure_ascii=False, indent=len(ind.group(1)) if ind else 2)
    if nl == "\r\n": txt = txt.replace("\n", "\r\n")
    if raw.endswith(nl) and not txt.endswith(nl): txt += nl
    shutil.copy(p, p + ".bak-moshi2-" + datetime.datetime.now().strftime("%Y%m%d%H%M%S"))
    io.open(p, "w", encoding="utf-8", newline="").write(txt)


def app(write):
    files = {}
    for k, T in TESTS.items():
        if T["kind"] == "chain":
            for y in chain_items(k): files.setdefault(T["file"], []).append(y)
        else:
            for fn, y in tsujo_items(k): files.setdefault(fn, []).append(y)
    for fn, items in sorted(files.items()):
        p = os.path.join(BASE, "data", fn + ".json")
        d = json.load(io.open(p, encoding="utf-8"))
        ids = {y["id"] for y in items}
        n0 = len(d)
        d = [z for z in d if z.get("id") not in ids] + items
        print("%s: %d → %d（%d件を入れる）" % (fn, n0, len(d), len(items)))
        if write: write_json(p, d)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "check": sys.exit(0 if check() else 1)
    if cmd == "build": build()
    if cmd == "app": app("--write" in sys.argv)
