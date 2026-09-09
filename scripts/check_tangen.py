# -*- coding: utf-8 -*-
"""通常問題の単元タグが設問の中身と合っているかを見る。

  使い方:
    python scripts/check_tangen.py             … 食いちがいを数える
    python scripts/check_tangen.py --show 平面図形（面積）  … その単元から出ていく分を見る
    python scripts/check_tangen.py --write     … 付けかえる

★直すのは「設問の中に、その単元でしかありえない言葉があるのに、別の単元になっている」ものだけ。
  例：「1辺1cmの立方体をつみ…」が『平面図形（面積）』／「長い針が90度動く」が『計算のくふう』。

⛔ じゅくナビの問題（大問・かんたん解説）は原簿どおりに作ってあるので**触らない**
   （本人指示 2026-09-09）。走査は sansu_*.json の通常問題だけ。

★単元名は今ある39種の語彙から動かさない（アプリの絞りこみと hama_map の突き合わせに使う）。
  新しい名前を作らない。

★1つの設問に複数の手がかりが出ることがある（「立方体の体積の比」など）。
  そのときは**下の並び順で先に来たほう**を採る＝より外側の単元を勝たせる。
"""
import io, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import genbo_common as G

sys.stdout.reconfigure(encoding="utf-8")

# (単元名, その単元でしかありえない言葉)。上から順に見て最初に当たったものを採る。
RULES = [
    ("食塩水・濃度",        r"食塩水|濃度|のうど|食塩"),
    ("売買損益",            r"定価|原価|仕入れ|売り値|利益|値引き|割引"),
    ("速さ（通過・流水・時計）", r"通過|鉄橋|トンネル|流れ|上り|下り|静水|列車が|針が.*度|時計の針"),
    ("速さ（旅人算）",      r"時速|分速|秒速|出発|追いつ|向かい合っ|すれちが|何分後に.*出会|速さの比"),
    ("仕事算",              r"仕事|1日に.*ずつ.*終わ|水そうを.*いっぱい|ポンプ"),
    ("ニュートン算",        r"行列|窓口|草が.*生え"),
    ("食塩水・濃度",        r"％の食塩"),
    ("平均算",              r"平均"),
    ("つるかめ算",          r"つる|かめ|足の(?:合計|数)"),
    ("過不足算・差集め算",  r"過不足|あまり.*たりな|たりな.*あまり|配ると.*不足"),
    ("年齢算",              r"年令|年齢|何才|何歳|お父さん.*年|母.*年"),
    # ★「点を正方形の形にならべる四角数」は規則性。方陣算と字面が同じなので先に逃がす
    ("規則性・数列",        r"四角数|三角数|五角数"),
    ("方陣算",              r"方陣|正方形の形にならべ|ぐるりと.*ならべ|中がつまった正方形"),
    ("植木算",              r"植木|木を(?:植|う)え|両はし|両端|等間かく|間かくで.*立て"),
    ("周期算",              r"くりかえしならべ|周期|何番目.*くりかえ|曜日|何日間|何日目"),
    ("群数列",              r"群|組に分け.*数列|1|2,3|"),          # ★ほぼ当たらない（下で無効化）
    ("N進法",               r"[0-9]進法|２進|３進|進数|おもり[^。]{0,30}はか|片がわだけにのせて"),
    ("概数（がい数）",      r"四捨五入|がい数|概数|切り上げ|切り捨て|上から[0-9]けた"),
    ("倍数・約数",          r"公倍数|公約数|最小公倍|最大公約|倍数|約数"),
    # ★「真上・真正面・真横から見る」は投影図。立方体という言葉に引っぱられて
    #   立体図形へ動かしかけた（2026-09-09）。投影図を先に見る
    ("展開図・投影図",      r"展開図|投影図|見取り図|真上|真正面|真横|正面から見"),
    # ★折り返し・線対称は「図形の移動・対称」。角度を聞いていても移動の問題
    # ★折るのは「紙・長方形などの図形」を折るときだけ。数をへびのように折り返して
    #   ならべるのは規則性（数表）なので巻きこまない
    ("図形の移動・対称",    r"(?:紙|図形|長方形|正方形|三角形|対角線)[^。]{0,25}(?:おっ|折っ|おり返|折り返|おると|おりました)|線対称|点対称|平行移動|回転移動|うら返"),
    # ★「形が同じで大きさがちがう」は相似の言いかえ。面積の比を聞いていても相似
    ("平面図形（相似・比）", r"相似|拡大図|縮図|形が同じで大きさがちが|[0-9]\s*[:：]\s*[0-9][^。]{0,30}面積|面積[^。]{0,30}[0-9]\s*[:：]\s*[0-9]|[A-Z]{1,2}\s*[:：]\s*[A-Z]{1,2}|辺の(?:長さの)?比|面積の比"),
    # ★水そう・さいころは外す。水そうは相当算・仕事算の舞台にもなり、さいころの
    #   「向かい合う面」は展開図の話（2026-09-09に両方とも動かしかけた）
    ("立体図形（体積・表面積）", r"立方体|直方体|積み木|体積|表面積|容積"),
    ("平面図形（相似・比）", r"相似|拡大図|縮図"),
    ("平面図形（角度）",    r"角度|何度|内角|外角|対頂角|同位角|錯角"),
    ("平面図形（面積）",    r"面積|まわりの長さ|周の長さ|cm2|㎠"),
    ("比例・反比例",        r"比例|反比例|もとの何倍|何倍になり"),
    ("比",                  r"[0-9]\s*[:：]\s*[0-9]|の比|連比|逆比"),
    ("割合",                r"[％%]|パーセント|[0-9]割[0-9]?分?|もとにする|何倍にあたる"),
    ("場合の数",            r"何通り|組み合わせ|ならべ方|道順"),
    ("消去算",              r"消去算"),
    ("相当算・還元算",      r"相当算|還元算|はじめにあった|ある数の[^。]{0,12}[％%]が"),
    ("倍数算・やりとり",    r"やりとり|わたすと[^。]*同じ|わたしたところ|あげたところ"),
    ("記号定義（約束）",    r"と約束|＊|◎|と決めます|という記号"),
    ("推理・論理",          r"推理|うそをついて|だれが.*だれ"),
]
RULES = [(u, re.compile(p)) for u, p in RULES if u != "群数列"]   # 群数列は言葉で見分けられない


def unit_groups():
    """★単元グループは js/sansu.js の UNIT_GROUPS が正。ここに書き写さない
    （写すと必ず片方が腐る→memory:feedback_kansa_script_copy）。そのまま読んで使う。"""
    src = io.open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "js", "sansu.js"), encoding="utf-8").read()
    body = src.split("const UNIT_GROUPS = {", 1)[1].split("\n};", 1)[0]
    out = {}
    for m in re.finditer(r"'([^']+)':\s*\[([^\]]*)\]", body):
        for u in re.findall(r"'([^']+)'", m.group(2)):
            out[u] = m.group(1)
    if len(out) < 20:
        raise RuntimeError("js/sansu.js の UNIT_GROUPS を読めなかった（書き方が変わった？）")
    return out


GROUP_OF = unit_groups()


def guess(q):
    text = " ".join(str(q.get(k) or "") for k in ("question", "answer"))
    for unit, pat in RULES:
        if pat.search(text):
            return unit
    return None


def supported(unit, q):
    """いま付いている単元にも根拠があるか（両方に手がかりがあるなら動かさない）。"""
    text = " ".join(str(q.get(k) or "") for k in ("question", "answer"))
    for u, pat in RULES:
        if u == unit and pat.search(text):
            return True
    return False


def scan():
    out = []
    for r in G.iter_tsujo():
        if not os.path.basename(r["file"]).startswith("sansu_"):
            continue
        q = r["q"]
        now = q.get("unit")
        if not now:
            continue
        g = guess(q)
        # ★出口が同じなら動かさない。アプリの「単元でえらぶ」は js/sansu.js の
        #   UNIT_GROUPS（23グループ）でしぼるので、同じグループの中で名前を
        #   入れかえても子どもから見て何も変わらない（本人指摘 2026-09-09
        #   「出すところがないのに振り分けても意味ないよね」）。
        if g and GROUP_OF.get(g) and GROUP_OF.get(g) == GROUP_OF.get(now):
            continue
        # ★速さの2種はグループが別だが、どちらとも言えない問題（音の速さなど）が多い。
        #   速さの中では動かさない（2026-09-09に「音の速さ」を旅人算へ動かしかけた）
        same_family = {"速さ（旅人算）", "速さ（通過・流水・時計）"}
        if g in same_family and now in same_family:
            continue
        if g and g != now and not supported(now, q):
            out.append((r, now, g))
    return out


def main():
    args = sys.argv[1:]
    hits = scan()
    print("■ 通常問題の単元タグ vs 設問の中身")
    print("   食いちがい … %d件" % len(hits))
    by = {}
    for r, now, g in hits:
        by[(now, g)] = by.get((now, g), 0) + 1
    for (now, g), n in sorted(by.items(), key=lambda x: -x[1]):
        print("     %-22s → %-22s %4d件" % (now, g, n))
    if "--show" in args:
        key = args[args.index("--show") + 1]
        print()
        for r, now, g in hits:
            if key in (now, g):
                print("  %-26s %s → %s" % (r["qid"], now, g))
                print("      %s" % str(r["q"].get("question"))[:72])
    if "--write" in args:
        want = {}
        for r, now, g in hits:
            want.setdefault(os.path.basename(r["file"]), {})[r["qid"]] = g
        done = skipped = 0
        for name, m in sorted(want.items()):
            fmt = G.tsujo_indent(name)
            if not fmt:
                print("  ⚠ %s は書式を再現できないので書かない（%d件）" % (name, len(m)))
                skipped += len(m)
                continue
            data = G.load_tsujo(name)
            for qid, q in G.walk_tsujo(data, name):
                if qid in m:
                    q["unit"] = m[qid]
                    done += 1
            G.save_tsujo(name, data, fmt)
        print("\n✅ %d件の単元を付けかえた（書かなかった %d件）" % (done, skipped))
    else:
        print("\n（--write を付けると付けかえます）")


if __name__ == "__main__":
    main()
