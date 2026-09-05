# -*- coding: utf-8 -*-
"""apply_kotowaza_ruby.py が作る新しいkotowaza.jsonが安全かを検証する（書きこむ前）。
   ①ルビを剥がすと元の文字列にぴったり戻るか（内容を変えていないか）
   ②<ruby></ruby><rt></rt>の対応が壊れていないか
   ③<rt>の中身がひらがな以外を含んでいないか
   ④choicesの中でanswerがルビ無しの状態でちょうど1つに一致するか
"""
import io, json, re, sys
sys.path.insert(0, "scripts")
import apply_kotowaza_ruby as ap

def strip_ruby(html):
    return re.sub(r"<rt>.*?</rt>", "", html).replace("<ruby>", "").replace("</ruby>", "")

raw = io.open("data/kotowaza.json", encoding="utf-8").read()
old = json.loads(raw)
new = json.loads(raw)

def walk(o, out):
    if isinstance(o, dict):
        if o.get("id") and "question" in o: out.append(o)
        for v in o.values(): walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)

old_items = []; walk(old, old_items)
new_items = []; walk(new, new_items)
missing = []
for it in new_items:
    it["question"] = ap.process_text(it["question"], missing, it["id"] + ":q")
    if it.get("choices"):
        it["choices"] = [ap.process_text(c, missing, it["id"] + ":c") for c in it["choices"]]
    if it.get("meaning"):
        it["meaning"] = ap.process_text(it["meaning"], missing, it["id"] + ":m")
assert not missing, missing

bad = []
HIRA = re.compile(r"^[ぁ-んー]+$")
for o, n in zip(old_items, new_items):
    assert o["id"] == n["id"]
    # ① 剥がすと元に戻るか
    if strip_ruby(n["question"]) != o["question"]:
        bad.append((o["id"], "question内容が変わった", o["question"], n["question"]))
    if o.get("choices"):
        for oc, nc in zip(o["choices"], n["choices"]):
            if strip_ruby(nc) != oc:
                bad.append((o["id"], "choice内容が変わった", oc, nc))
    if o.get("meaning") and strip_ruby(n["meaning"]) != o["meaning"]:
        bad.append((o["id"], "meaning内容が変わった", o["meaning"][:40], n["meaning"][:60]))
    # ② タグ対応
    for f in ("question", "meaning"):
        t = n.get(f) or ""
        if t.count("<ruby>") != t.count("</ruby>") or t.count("<rt>") != t.count("</rt>"):
            bad.append((o["id"], f + "のタグ数が合わない"))
    for c in (n.get("choices") or []):
        if c.count("<ruby>") != c.count("</ruby>") or c.count("<rt>") != c.count("</rt>"):
            bad.append((o["id"], "choiceのタグ数が合わない", c))
    # ③ <rt>の中身がひらがなだけか
    for f in ("question", "meaning"):
        for rt in re.findall(r"<rt>(.*?)</rt>", n.get(f) or ""):
            if not HIRA.match(rt):
                bad.append((o["id"], f + "のrtがひらがな以外", rt))
    for c in (n.get("choices") or []):
        for rt in re.findall(r"<rt>(.*?)</rt>", c):
            if not HIRA.match(rt):
                bad.append((o["id"], "choiceのrtがひらがな以外", rt, c))
    # ④ choicesの中でanswerがルビ無しでちょうど1つに一致するか
    if o.get("choices"):
        matches = [c for c in n["choices"] if strip_ruby(c) == o["answer"]]
        if len(matches) != 1:
            bad.append((o["id"], "answerと一致するchoiceが%d個" % len(matches), o["answer"], n["choices"]))

print("検証した項目数:", len(new_items))
if bad:
    print("❌ 問題", len(bad), "件")
    for b in bad[:40]:
        print("  ", b)
else:
    print("✅ 全項目パス（内容変化なし・タグ対応OK・rtは全部ひらがな・answerの一致もOK）")

# サンプルをいくつか目で見る
print("\n=== サンプル（k606, k022, k183, k215, k9101）===")
by_id = {it["id"]: it for it in new_items}
for i in ("k606", "k022", "k183", "k215", "k9101", "k401"):
    it = by_id.get(i)
    if it:
        print(f"\n[{i}] Q: {it['question']}")
        print(f"      choices: {it.get('choices')}")
        print(f"      meaning: {it['meaning'][:150]}")
