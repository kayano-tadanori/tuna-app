# -*- coding: utf-8 -*-
"""小5 マスター理科 テキスト第1分冊（＝マスター理科の宿題）を、原簿・アプリ・フレディ用に流しこむ（2026-11-24）

  材料（gitの外）: docs/_genbo/rika5_text1/g1/noNN.md（原簿レコード）・sakumon/noNN.json（全小問の作問。publish true/false）
  python scripts/rika5t1_ship.py check            … 材料の点検だけ（書きこまない）
  python scripts/rika5t1_ship.py app  [--write]   … data/hama_daimon.json の grades.5.rika_bunsatsu.fukushu に publish=true の小問だけ入れる
  python scripts/rika5t1_ship.py genbo [--write]  … memory の原簿に g1 レコードを追記（同じHGがあれば置きかえ）
  python scripts/rika5t1_ship.py freddy [--write] … freddy_data/manual_app/app_g5r_text1.json に全小問の作問（出せないものも）を書く
"""
import io, json, os, re, sys, shutil, datetime
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENBO = os.path.expanduser(r"~\.claude\projects\c--Users-User-Desktop-Claude\memory\hamagakuen_ryomon_genbo.md")
FREDDY_DIR = os.path.join(os.path.dirname(BASE), "freddy_data", "manual_app")
# ★2026-11-24 理科の復習テスト No.24〜33 にも同じ流れを使う（--set fuku）。
#   fuku はアプリの rika（復習テスト）に入れる＝既存の No.1〜23 は触らず、材料のある回だけ置きかえる
SETS = {
    "text": dict(W=os.path.join(BASE, "docs", "_genbo", "rika5_text1"), course="rika_bunsatsu", idp="hd_5r_t%d_",
                 head=r"^### 【(HG-\d+)】小5マスター理科第1分冊 No\.(\d+) (レベル\d-\d+)",
                 section="# 🧪 小5 マスター理科 テキスト第1分冊（宿題・No.1〜10）",
                 note="結合した本 `_結合/小5/小5_理科_テキスト_第1分冊_No.01-10_問題.pdf`（・`_解答.pdf`）から G1 が原本を見て起こした。"
                      "OCRは使っていない（本人判断）。作問は `docs/_genbo/rika5_text1/sakumon/`、アプリは `rika_bunsatsu`（じゅくナビ理科の「今週の宿題」）。\n"
                      "> 印刷ラベルは「レベルN-大問番号」（大問番号はレベルごとに1から）。"),
    # ★2026-11-24 第2分冊（No.11〜20）も同じ流れ。アプリは rika_bunsatsu の No.11〜20（第1分冊の回は触らない）
    "text2": dict(W=os.path.join(BASE, "docs", "_genbo", "rika5_text2"), course="rika_bunsatsu", idp="hd_5r_t%d_",
                  head=r"^### 【(HG-\d+)】小5マスター理科第2分冊 No\.(\d+) (レベル\d-\d+)",
                  section="# 🧪 小5 マスター理科 テキスト第2分冊（宿題・No.11〜20）",
                  freddy="app_g5r_text2.json",
                  note="結合した本 `_結合/小5/小5_理科_テキスト_第2分冊_No.11-20_問題.pdf`（・`_解答.pdf`）から G1 が原本を見て起こした。"
                       "OCRは使っていない。作問は `docs/_genbo/rika5_text2/sakumon/`、アプリは `rika_bunsatsu`（じゅくナビ理科の「今週の宿題」）。\n"
                       "> 印刷ラベルは「レベルN-大問番号」（大問番号はレベルごとに1から）。"),
    # ★2026-11-25 第3分冊（No.21〜30）。アプリは rika_bunsatsu の No.21〜30（第1・第2分冊の回は触らない）
    "text3": dict(W=os.path.join(BASE, "docs", "_genbo", "rika5_text3"), course="rika_bunsatsu", idp="hd_5r_t%d_",
                  head=r"^### 【(HG-\d+)】小5マスター理科第3分冊 No\.(\d+) (レベル\d-\d+)",
                  section="# 🧪 小5 マスター理科 テキスト第3分冊（宿題・No.21〜30）",
                  freddy="app_g5r_text3.json",
                  note="結合した本 `_結合/小5/小5_理科_テキスト_第3分冊_No.21-30_問題.pdf`（・`_解答.pdf`）から G1 が原本を見て起こした。"
                       "OCRは使っていない。作問は `docs/_genbo/rika5_text3/sakumon/`、アプリは `rika_bunsatsu`（じゅくナビ理科の「今週の宿題」）。\n"
                       "> 印刷ラベルは「レベルN-大問番号」（大問番号はレベルごとに1から）。"),
    # ★2026-11-25（夜）第4分冊（No.31〜42＝12回）。アプリは rika_bunsatsu の No.31〜42。No.34〜42 は hama_map に回を足した
    "text4": dict(W=os.path.join(BASE, "docs", "_genbo", "rika5_text4"), course="rika_bunsatsu", idp="hd_5r_t%d_",
                  head=r"^### 【(HG-\d+)】小5マスター理科第4分冊 No\.(\d+) (レベル\d-\d+)",
                  section="# 🧪 小5 マスター理科 テキスト第4分冊（宿題・No.31〜42）",
                  freddy="app_g5r_text4.json",
                  note="結合した本 `_結合/小5/小5_理科_テキスト_第4分冊_No.31-42_問題.pdf`（・`_解答.pdf`）から G1 が原本を見て起こした。"
                       "OCRは使っていない。作問は `docs/_genbo/rika5_text4/sakumon/`、アプリは `rika_bunsatsu`（じゅくナビ理科の「今週の宿題」）。\n"
                       "> 印刷ラベルは「レベルN-大問番号」（大問番号はレベルごとに1から）。"),
    "fuku": dict(W=os.path.join(BASE, "docs", "_genbo", "rika5_fuku2433"), course="rika", idp="hd_5r_f%d_",
                 head=r"^### 【(HG-\d+)】小5理科 No\.(\d+) (大問\d+)",
                 section="# 🧪 小5 理科 復習テスト No.24〜33 ★2026-11-24 原簿化（HG-10501〜）",
                 note="結合した本 `_結合/小5/小5_理科_復習テスト_実力〜No.33.pdf` の p77〜126 から G1 が原本を見て起こした（OCRなし）。"
                      "作問は `docs/_genbo/rika5_fuku2433/sakumon/`、アプリは `rika`（じゅくナビ理科の復習テスト）。"),
}
_SET = sys.argv[sys.argv.index("--set") + 1] if "--set" in sys.argv else "text"
CFG = SETS[_SET]
FREDDY = os.path.join(FREDDY_DIR, CFG.get("freddy", "app_g5r_text1.json"))
W = CFG["W"]
SECTION = CFG["section"]
NUMPAD = re.compile(r"^(\d+(\.\d+)?|\d+/\d+|\d+と\d+/\d+|\d+(\.\d+)?([:：]\d+(\.\d+)?)+)$")
APP_KEYS = ["id", "src", "hg", "title", "category", "unit", "grade", "star", "intro", "svg", "steps"]
STEP_KEYS = ["question", "answer", "choices", "meaning", "svg", "withMainSvg"]


def nos():
    return sorted(int(f[2:4]) for f in os.listdir(os.path.join(W, "sakumon")) if re.match(r"no\d\d\.json$", f))


def load(no):
    sk = json.load(io.open(os.path.join(W, "sakumon", "no%02d.json" % no), encoding="utf-8"))
    md = io.open(os.path.join(W, "g1", "no%02d.md" % no), encoding="utf-8").read()
    return sk, md


def check():
    bad = 0; tot = [0, 0, 0]
    for no in nos():
        sk, md = load(no)
        heads = re.findall(CFG["head"], md, re.M)
        if len(heads) != len(sk):
            print(f"!! No.{no} 原簿{len(heads)}本と作問{len(sk)}本がちがう"); bad += 1
        if [h[0] for h in heads] != [x["hg"] for x in sk]:
            print(f"!! No.{no} HGの並びが原簿と作問でちがう"); bad += 1
        # ★制御文字（U+0001 など）が入ると、画面では見えないまま「④」や「。」が消えている（2026-11-24 第2分冊 No.11 で91か所。
        #   置きかえで \1 を書いた跡）。json.load は通るので、ここで止める
        #   json.dumps は制御文字を \u0001 の形で書くので、その形で数える（改行 \n・タブ \t は別の書き方なので数えない）
        ctl = re.findall(r"\\u00[01][0-9a-fA-F]", json.dumps(sk, ensure_ascii=False))
        if ctl:
            print(f"!! No.{no} 制御文字 {len(ctl)}か所（文が欠けている。g1 を見て直す）"); bad += 1
        for x in sk:
            tot[0] += 1
            if not x.get("id", "").startswith(CFG["idp"] % no): print("!! id", x.get("id")); bad += 1
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


def app_items(no):
    sk, _ = load(no); out = []
    for x in sk:
        st = []
        for s in x["steps"]:
            if not s.get("publish"): continue
            y = {k: s[k] for k in STEP_KEYS if k in s and s[k] not in (None, "")}
            if "choices" in y and NUMPAD.match(str(y["answer"]).strip()): y.pop("choices")
            st.append(y)
        if not st: continue
        y = {k: x[k] for k in APP_KEYS if k in x}
        y["steps"] = st
        out.append(y)
    return out


def app(write):
    p = os.path.join(BASE, "data", "hama_daimon.json")
    d = json.load(io.open(p, encoding="utf-8"))
    node = d["grades"]["5"].setdefault(CFG["course"], {}).setdefault("fukushu", {})
    for no in nos():
        items = app_items(no)
        node[str(no)] = items
        print(f"No.{no}: 大問{len(items)}・小問{sum(len(i['steps']) for i in items)}")
    if write:
        stamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        shutil.copy(p, p + ".bak-rika5t1-" + stamp)
        raw = io.open(p, encoding="utf-8", newline="").read()
        nl = "\r\n" if "\r\n" in raw else "\n"
        txt = json.dumps(d, ensure_ascii=False, indent=1)
        if nl == "\r\n": txt = txt.replace("\n", "\r\n")
        if raw.endswith(nl) and not txt.endswith(nl): txt += nl
        io.open(p, "w", encoding="utf-8", newline="").write(txt)
        print("書きこみ:", p)


def genbo(write):
    t = io.open(GENBO, encoding="utf-8").read()
    recs = []
    for no in nos():
        _, md = load(no)
        for m in re.finditer(r"^### 【HG-\d+】.*?(?=^### |^## |^# |\Z)", md, re.M | re.S):
            recs.append(m.group(0).rstrip("\n") + "\n")
    hgs = [re.match(r"### 【(HG-\d+)】", r).group(1) for r in recs]
    dup = [h for h in hgs if ("### 【%s】" % h) in t]
    print(f"レコード{len(recs)}本（{hgs[0]}〜{hgs[-1]}）・原簿に既にある{len(dup)}本")
    if SECTION in t:
        i = t.index(SECTION); j = t.find("\n# ", i + 1); j = len(t) if j < 0 else j + 1
        t = t[:i] + t[j:]
    body = (SECTION + "\n\n> 2026-11-24 " + CFG["note"] + "\n\n" + "\n".join(recs) + "\n")
    t = t.rstrip("\n") + "\n\n" + body
    if write:
        shutil.copy(GENBO, GENBO + ".bak-rika5t1")
        io.open(GENBO, "w", encoding="utf-8").write(t)
        print("書きこみ:", GENBO)


def freddy(write):
    out = []
    for no in nos():
        sk, _ = load(no)
        for x in sk:
            out.append({"hg": x["hg"], "no": no, "label": x.get("label"), "title": x["title"], "category": x["category"],
                        "unit": x["unit"], "star": x["star"], "intro": x.get("intro", ""),
                        "steps": [{"sub": s.get("sub"), "question": s["question"], "answer": s["answer"],
                                   "choices": s.get("choices"), "meaning": s["meaning"],
                                   "in_oton": bool(s.get("publish")), "why_not_oton": s.get("reason")} for s in x["steps"]]})
    print(f"フレディ用 作問 {len(out)}大問・{sum(len(o['steps']) for o in out)}小問")
    if write:
        os.makedirs(os.path.dirname(FREDDY), exist_ok=True)
        io.open(FREDDY, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
        print("書きこみ:", FREDDY)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    wr = "--write" in sys.argv
    if cmd == "check": sys.exit(0 if check() else 1)
    if cmd == "freddy" and _SET == "fuku": sys.exit("フレディ用は宿題テキストだけ")
    {"app": app, "genbo": genbo, "freddy": freddy}[cmd](wr)
