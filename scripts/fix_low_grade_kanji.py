# -*- coding: utf-8 -*-
"""小1・小2の問題から「まだ習っていない漢字」を消す。

方針（yomi_map_low_grade.py の表に従う）
  ① 表にある言葉は ひらがなに開く
  ② 表に無い言葉／読みを決められない言葉は 開かずに、その問題を 小3へ移す
     （解説だけが開けない場合は 学年を上げず、解説を そのまま残す）

やること
  0. REPAIR … すでに入ってしまった 読みまちがいを 直す（学年に関係なく）
  1. 問題文・答え・選択肢 … ①②のとおり
  2. 解説（meaning） … 丸ごと開けるときだけ 開く。結び「答えは○○です」は 答えに合わせる

対象外＝漢字そのものが問題の素材になっている kanji_kaki / kanji_yomi / kokugo_bushu。

  python scripts/fix_low_grade_kanji.py          … 何が変わるかを出すだけ
  python scripts/fix_low_grade_kanji.py --write  … 実際に書きこむ
"""
import json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from yomi_map_low_grade import CTX, READ, PRE, PRE_RE, FORCE_BUMP, REPAIR

DATA = os.path.join(os.path.dirname(HERE), "data")
SKIP = {"kanji_kaki.json", "kanji_yomi.json", "kokugo_bushu.json"}
BUMP_TO = 3

G1 = ("一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水"
      "正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六")
G2 = ("引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後"
      "語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親"
      "図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉"
      "馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話")
assert len(G1) == 80 and len(G2) == 160
ALLOW = {1: set(G1), 2: set(G1) | set(G2)}

KANJI_RUN = re.compile(r"[一-鿿々]+")
# 「した（舌）」のように かなの あとに 漢字で 同じ読みを そえていたもの。
# 漢字を開くと「した（した）」に なるので かっこごと 落とす。
DUP_PAREN = re.compile(r"([ぁ-ゖァ-ヺー]{2,})[（(]\1[）)]")
# 開いた結果 選択肢が だぶるもの（もともと「虹」と「にじ」が 別々に入っていた）
DUP_CHOICE_FIX = {"rk005": (3, "くも")}
IS_KANJI = re.compile(r"[一-鿿々]")
HIRA = re.compile(r"[ぁ-ゖ]")
MAXK = max(len(k) for k in READ)

# 「方」は前の字で読みが変わる（育ち方＝かた／〜の 方＝ほう）
HOU_PREV = set("の 　「（(、。？?!・→\t")


def pre_fix(text):
    for a, b in PRE:
        text = text.replace(a, b)
    for pat, rep in PRE_RE:
        text = re.sub(pat, rep, text)
    return text


def seg_run(run, prev, nxt, allow):
    """漢字の連なりを 表で切って ひらがなに開く。開けなければ ok=False。"""
    out, ok = [], True
    i = 0
    while i < len(run):
        hit = None
        for L in range(min(MAXK, len(run) - i), 0, -1):
            key = run[i:i + L]
            if L == 1:
                after = run[i + 1] if i + 1 < len(run) else nxt
                ck = f"{key}|{after}" if after else None
                if ck and ck in CTX:
                    hit = (1, CTX[ck])
                    break
                if key == "方":
                    before = run[i - 1] if i > 0 else prev
                    hit = (1, "ほう" if (before == "" or before in HOU_PREV
                                        or IS_KANJI.match(before)) else "かた")
                    break
            if key in READ:
                hit = (L, READ[key])
                break
        if hit:
            L, yomi = hit
            seg = run[i:i + L]
            out.append(seg if all(c in allow for c in seg) else yomi)
            i += L
            continue
        if run[i] in allow:
            out.append(run[i])
            i += 1
            continue
        j = i
        while j < len(run) and run[j] not in allow:
            j += 1
        out.append(run[i:j])
        ok = False
        i = j
    return ok, "".join(out)


def convert(text, allow):
    text = pre_fix(text)
    res, last, ok = [], 0, True
    for m in KANJI_RUN.finditer(text):
        res.append(text[last:m.start()])
        prev = text[m.start() - 1] if m.start() > 0 else ""
        nxt = text[m.end()] if m.end() < len(text) else ""
        good, rep = seg_run(m.group(), prev, nxt, allow)
        res.append(rep)
        ok &= good
        last = m.end()
    res.append(text[last:])
    return ok, "".join(res)


def has_unlearned(text, allow):
    return any(c not in allow for c in IS_KANJI.findall(text))


def repair(q):
    """すでに入ってしまった 読みまちがいを 直す（解説もふくむ）。"""
    hit = False
    for f in ("question", "answer", "meaning"):
        v = q.get(f)
        if not isinstance(v, str):
            continue
        new = v
        for a, b in REPAIR:
            new = new.replace(a, b)
        if new != v:
            q[f] = new
            hit = True
    for i, c in enumerate(q.get("choices") or []):
        if not isinstance(c, str):
            continue
        new = c
        for a, b in REPAIR:
            new = new.replace(a, b)
        if new != c:
            q["choices"][i] = new
            hit = True
    return hit


def fix_meaning(q, allow):
    """解説を 丸ごと開けるときだけ 開く。開けなければ さわらない。"""
    m = q.get("meaning")
    if not isinstance(m, str) or not has_unlearned(m, allow):
        return False
    if any(w in m for w in FORCE_BUMP):
        return False
    good, rep = convert(m, allow)
    if not good or has_unlearned(rep, allow):
        return False
    q["meaning"] = rep
    return True


def align_meaning_end(q):
    """解説の結び「答えは○○です」を 答えに合わせる。答えのほうが 正しいので それに寄せる。"""
    m = q.get("meaning")
    a = q.get("answer")
    if not isinstance(m, str) or not isinstance(a, str) or not a:
        return False
    hit = re.search(r"答えは(.+?)です", m)
    if not hit or hit.group(1) == a:
        return False
    q["meaning"] = m.replace("答えは" + hit.group(1) + "です", "答えは" + a + "です")
    return True


def collapse_paren(q):
    """「した（した）」→「した」。答えを直したら 選択肢の同じ文も そろえる。"""
    hit = False
    for f, i, s in list(texts_of(q)):
        new = DUP_PAREN.sub(r"\1", s)
        if new == s:
            continue
        hit = True
        if f == "choices":
            q["choices"][i] = new
        else:
            q[f] = new
        if isinstance(q.get("meaning"), str) and s in q["meaning"]:
            q["meaning"] = q["meaning"].replace(s, new)
    return hit


def fix_dup_choices(q):
    ch = q.get("choices")
    if not ch or len(set(ch)) == len(ch):
        return False
    fix = DUP_CHOICE_FIX.get(q.get("id"))
    if not fix:
        raise SystemExit(f"{q.get('id')}: 選択肢が だぶりました → {ch}")
    i, new = fix
    ch[i] = new
    return True


def texts_of(q):
    yield "question", None, q.get("question", "")
    yield "answer", None, q.get("answer", "")
    for i, s in enumerate(q.get("choices") or []):
        yield "choices", i, s


def load(path):
    raw = open(path, "rb").read().decode("utf-8")
    data = json.loads(raw)
    for indent in (2, 1, 3, 4):
        for nl in ("\r\n", "\n"):
            for tail in ("", nl):
                s = json.dumps(data, ensure_ascii=False, indent=indent)
                if nl != "\n":
                    s = s.replace("\n", nl)
                if s + tail == raw:
                    return data, (indent, nl, tail)
    return data, None  # 書き出しの形が読めない＝さわらない


def save(path, data, style):
    indent, nl, tail = style
    s = json.dumps(data, ensure_ascii=False, indent=indent)
    if nl != "\n":
        s = s.replace("\n", nl)
    open(path, "wb").write((s + tail).encode("utf-8"))


def main(write):
    changed_files = {}
    stat = collections.Counter()
    per_file = collections.Counter()
    bumped_samples = collections.defaultdict(list)
    cells_before = collections.Counter()
    cells_after = collections.Counter()

    for name in sorted(os.listdir(DATA)):
        if not name.endswith(".json") or name in SKIP:
            continue
        path = os.path.join(DATA, name)
        try:
            data, style = load(path)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not isinstance(data, list):
            continue
        if style is None:
            if any(isinstance(q, dict) and q.get("grade") in (1, 2) for q in data):
                raise SystemExit(f"{name}: 書き出しの形が読めません（直すべき問題があるのに さわれない）")
            continue
        touched = False
        for q in data:
            if not isinstance(q, dict) or q.get("grade") not in (1, 2):
                continue
            g = q["grade"]
            allow = ALLOW[g]
            cells_before[(g, q.get("difficulty"))] += 1

            if repair(q):
                stat["読みまちがいを直した"] += 1
                touched = True

            fields = list(texts_of(q))
            if not any(has_unlearned(s, allow) for _, _, s in fields):
                if collapse_paren(q):
                    stat["むだな（かっこ）を落とした"] += 1
                    touched = True
                if fix_dup_choices(q):
                    stat["だぶった選択肢を直した"] += 1
                    touched = True
                if fix_meaning(q, allow):
                    stat["解説をひらがなに開いた"] += 1
                    touched = True
                if align_meaning_end(q):
                    stat["解説の結びを答えに合わせた"] += 1
                    touched = True
                cells_after[(g, q.get("difficulty"))] += 1
                continue

            blocked = any(w in s for _, _, s in fields for w in FORCE_BUMP)
            news, ok = [], True
            if not blocked:
                for f, i, s in fields:
                    good, rep = convert(s, allow)
                    ok &= good
                    news.append((f, i, rep))
                    if has_unlearned(rep, allow):
                        ok = False

            if blocked or not ok:
                q["grade"] = BUMP_TO
                stat["学年を上げた"] += 1
                per_file[name] += 1
                touched = True
                if len(bumped_samples[name]) < 6:
                    bumped_samples[name].append(q.get("id"))
                continue

            old_answer = q.get("answer", "")
            for f, i, rep in news:
                if f == "choices":
                    q["choices"][i] = rep
                else:
                    q[f] = rep
            collapse_paren(q)
            fix_dup_choices(q)
            # 解説の結び「よって答えは○○です」を 新しい答えに合わせる
            if old_answer and q.get("answer") != old_answer and isinstance(q.get("meaning"), str):
                key = "答えは" + old_answer
                if key in q["meaning"]:
                    q["meaning"] = q["meaning"].replace(key, "答えは" + q["answer"])
            if fix_meaning(q, allow):
                stat["解説をひらがなに開いた"] += 1
            if align_meaning_end(q):
                stat["解説の結びを答えに合わせた"] += 1
            stat["ひらがなに開いた"] += 1
            cells_after[(g, q.get("difficulty"))] += 1
            touched = True

        if touched:
            changed_files[name] = (path, data, style)

    print("=== けっか ===")
    for k, v in stat.most_common():
        print(f"  {k}: {v}")
    print("\n=== 学年を上げた問題（ファイル別） ===")
    for k, v in per_file.most_common():
        print(f"  {v:4d}  {k}  例: {' '.join(bumped_samples[k])}")

    print("\n=== 小1小2の 学年×難易度 の問題数（前 → 後） ===")
    empty = []
    for g in (1, 2):
        for d in sorted({d for (gg, d) in cells_before if gg == g}, key=lambda x: (x is None, x)):
            b, a = cells_before[(g, d)], cells_after[(g, d)]
            mark = ""
            if a == 0:
                mark = "  ← 0になった！"
                empty.append((g, d))
            print(f"  小{g} なんい度{d}: {b:5d} → {a:5d}{mark}")
    if empty:
        print("  ※ 0になったセットがあります。上げすぎです。")

    if write:
        for name, (path, data, style) in changed_files.items():
            save(path, data, style)
        print(f"\n書きこみました: {len(changed_files)} ファイル")
    else:
        print(f"\n（下見だけ。書きこむなら --write。変わるファイル: {len(changed_files)}）")


if __name__ == "__main__":
    main("--write" in sys.argv)
