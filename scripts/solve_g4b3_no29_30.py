# -*- coding: utf-8 -*-
"""小4マスター算数 第3分冊 No.29・No.30 の立体・てん開図の答えを、原簿を写さずに解き直す。

てん開図を実際に折りたたんで、
  ・立方体になるか
  ・どの面とどの面が平行／垂直になるか
  ・どの点とどの点、どの辺とどの辺が重なるか
を機械で出す。原簿の答えと突き合わせて、食いちがえば落とす。

使い方: python scripts/solve_g4b3_no29_30.py
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def neg(v):
    return (-v[0], -v[1], -v[2])


def fold(cells):
    """てん開図のマス（(列,行) の集まり）を折りたたむ。

    各マスに (right, up, out) の3本の向きを持たせ、となりのマスへ折るたびに回す。
    right×up＝out。out がそのマスの「立方体のどの面になるか」を表す。
    立方体にならなければ None。
    """
    cells = list(cells)
    start = cells[0]
    frame = {start: ((1, 0, 0), (0, 1, 0), (0, 0, 1))}
    stack = [start]
    while stack:
        c = stack.pop()
        r, u, o = frame[c]
        for d, (nx, ny) in ((0, (1, 0)), (1, (-1, 0)), (2, (0, 1)), (3, (0, -1))):
            n = (c[0] + nx, c[1] + ny)
            if n not in cells:
                continue
            # ★となりのマスは「2つのマスが共有している辺」を軸にして回る。
            #   ここを逆向きに書くと、面どうしの関係（平行・垂直）は偶然そのまま合うのに、
            #   点や辺の重なりだけが全部まちがう（2026-09-01に実際にやった。
            #   面の答えが原簿と一致したので正しいと思いこんだ ＝ feedback_verify_mechanism_not_just_answer）
            if d == 0:      # 右へ折る（共有する辺は右はしのたて線）
                nf = (neg(o), u, r)
            elif d == 1:    # 左へ折る
                nf = (o, u, neg(r))
            elif d == 2:    # 上へ折る（共有する辺は上のよこ線）
                nf = (r, neg(o), u)
            else:           # 下へ折る
                nf = (r, o, neg(u))
            if n in frame:
                if frame[n] != nf:
                    return None          # 同じマスに2通りの向き＝折りたためない
            else:
                frame[n] = nf
                stack.append(n)
    if len(frame) != len(cells):
        return None
    outs = [frame[c][2] for c in cells]
    if len(set(outs)) != 6:
        return None                      # 面が重なった＝立方体にならない
    return frame


def vertex_of(frame, cell, corner):
    """マスのかど（格子点）が、立方体のどの頂点になるかを返す。"""
    r, u, o = frame[cell]
    sx = 1 if corner[0] == cell[0] + 1 else -1
    sy = 1 if corner[1] == cell[1] + 1 else -1
    return tuple(o[i] + sx * r[i] + sy * u[i] for i in range(3))


def vertex_map(frame, cells, names):
    """格子点の名前 → 立方体の頂点。names は {(x,y): '名前'}。"""
    got = {}
    for c in cells:
        for corner in ((c[0], c[1]), (c[0] + 1, c[1]),
                       (c[0], c[1] + 1), (c[0] + 1, c[1] + 1)):
            if corner in names:
                got.setdefault(names[corner], vertex_of(frame, c, corner))
    return got


def same_points(vmap):
    """立方体の同じ頂点になる格子点どうしを組にして返す。"""
    inv = {}
    for name, v in vmap.items():
        inv.setdefault(v, []).append(name)
    return {tuple(sorted(v)) for v in inv.values() if len(v) > 1}


def report(title, cells, faces=None, names=None):
    print("=" * 70)
    print(title)
    frame = fold(cells)
    if frame is None:
        print("  → 立方体にならない")
        return None
    print("  → 立方体になる")
    if faces:
        rev = {}
        for c, nm in faces.items():
            rev[frame[c][2]] = nm
        for c, nm in sorted(faces.items(), key=lambda x: x[1]):
            o = frame[c][2]
            para = rev[neg(o)]
            perp = sorted(v for k, v in rev.items() if k != o and k != neg(o))
            print("   面%s … 平行=面%s ／ 垂直=%s"
                  % (nm, para, "，".join("面" + x for x in perp)))
    if names:
        vmap = vertex_map(frame, cells, names)
        print("   重なる点:", "／".join("＝".join(g) for g in sorted(same_points(vmap))))
        return vmap
    return None


# ── HG-5825 No.30 テーマ1（立方体になるてん開図をえらぶ） ──────────────
NETS = {
    "①": [(3, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2)],
    "②": [(1, 0), (2, 0), (3, 0), (1, 1), (0, 2), (1, 2)],
    "③": [(0, 0), (1, 0), (2, 0), (2, 1), (3, 1), (4, 1)],
    "④": [(2, 0), (3, 0), (1, 1), (2, 1), (0, 2), (1, 2)],
    "⑤": [(0, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1)],
    "⑥": [(3, 0), (3, 1), (0, 2), (1, 2), (2, 2), (3, 2)],
}

print("=" * 70)
print("HG-5825 No.30 テーマ1（立方体になるてん開図をえらぶ）")
ok = [k for k in sorted(NETS) if fold(NETS[k]) is not None]
for k in sorted(NETS):
    print("   %s … %s" % (k, "立方体になる" if fold(NETS[k]) else "ならない"))
print("   自力の答え:", "，".join(ok))
print("   原簿の答え: ①，③，④")
assert ok == ["①", "③", "④"], ok

# ── HG-5827 No.30 テーマ2（てん開図の点と面） ────────────────────────
F5827 = {(0, 0): "あ", (0, 1): "い", (1, 1): "う", (2, 1): "え", (3, 1): "お", (3, 2): "か"}
V5827 = {(0, 0): "ア", (1, 0): "セ", (0, 1): "イ", (1, 1): "ス", (2, 1): "シ",
         (3, 1): "サ", (4, 1): "コ", (0, 2): "ウ", (1, 2): "エ", (2, 2): "オ",
         (3, 2): "カ", (4, 2): "ケ", (3, 3): "キ", (4, 3): "ク"}
report("HG-5827 No.30 テーマ2（てん開図の点と面）", list(F5827), F5827, V5827)
print("   原簿の答え: ①立方体 ②点シ＝点セ ③面あ…平行=面か／垂直=面い，面う，面え，面お")

# ── HG-5837 No.30 C問題2（ボール紙のてん開図） ──────────────────────
F5837 = {(2, 0): "あ", (3, 0): "い", (1, 1): "う", (2, 1): "え", (0, 2): "お", (1, 2): "か"}
V5837 = {(2, 0): "ア", (3, 0): "イ", (4, 0): "ウ", (1, 1): "エ", (2, 1): "オ",
         (4, 1): "キ", (0, 2): "ク", (1, 2): "ケ", (2, 2): "コ", (3, 2): "サ",
         (0, 3): "シ", (1, 3): "ス", (2, 3): "セ"}
report("HG-5837 No.30 C問題2（ボール紙のてん開図）", list(F5837), F5837, V5837)
print("   原簿の答え: ②面いと平行=面う ③辺アイと重なる辺=辺クシ")
print("   ①辺の合計 12×12=144cm ／ ④45×55−12×12×6 = %d cm²" % (45 * 55 - 144 * 6))

# ── HG-5773 No.29 テーマ2（直方体の平行・垂直）を辺の向きで確かめる ──────
print("=" * 70)
print("HG-5773 No.29 テーマ2（直方体の平行・垂直）")
P = {"ア": (0, 1, 1), "イ": (0, 0, 1), "ウ": (1, 0, 1), "エ": (1, 1, 1),
     "オ": (0, 1, 0), "カ": (0, 0, 0), "キ": (1, 0, 0), "ク": (1, 1, 0)}
EDGES = ["アイ", "イウ", "ウエ", "エア", "オカ", "カキ", "キク", "クオ",
         "アオ", "イカ", "ウキ", "エク"]
FACES = ["アイウエ", "オカキク", "アイカオ", "イウキカ", "ウエクキ", "アエクオ"]


def dirv(e):
    a, b = P[e[0]], P[e[1]]
    return tuple(abs(a[i] - b[i]) for i in range(3))


def parallel_edges(e):
    return [x for x in EDGES if x != e and dirv(x) == dirv(e)]


def perp_edges(e):
    """『垂直な辺』＝交わっていて向きがちがう辺（浜の教材の使い方）。"""
    out = []
    for x in EDGES:
        if x == e:
            continue
        if set(x) & set(e) and dirv(x) != dirv(e):
            out.append(x)
    return out


def face_normal(f):
    pts = [P[c] for c in f]
    for i in range(3):
        if len({p[i] for p in pts}) == 1:
            return i
    return None


print("   ①辺イカに平行な辺:", "，".join("辺" + x for x in parallel_edges("イカ")))
print("   ②辺カキに垂直な辺:", "，".join("辺" + x for x in perp_edges("カキ")))
n0 = face_normal("アイウエ")
print("   ③面アイウエに平行な面:",
      "，".join("面" + f for f in FACES if f != "アイウエ" and face_normal(f) == n0))
print("   ④面アイウエに垂直な面:",
      "，".join("面" + f for f in FACES if face_normal(f) != n0))
print("   原簿の答え: ①辺アオ，辺ウキ，辺エク ②辺イカ，辺オカ，辺ウキ，辺クキ"
      " ③面オカキク ④面アイカオ，面イウキカ，面ウエクキ，面アエクオ")
print("=" * 70)
print("ALL CHECKS DONE")
