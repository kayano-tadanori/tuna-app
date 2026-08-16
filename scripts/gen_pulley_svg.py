# -*- coding: utf-8 -*-
"""滑車の図を、問題文の構成（動N個＋定M個）どおりに描くジェネレータ。
   既存の作法にそろえる： 天井/枠 #eef2ff ／ ひも #ffd166 ／ 矢印 #ff6b6b ／ ラベル #eef2ff
   滑車1個 = 外円 + 中心の点（rc318 の描き方に合わせる）
"""

C_FRAME = "#eef2ff"
C_ROPE  = "#ffd166"
C_ARROW = "#ff6b6b"
C_SUB   = "#9aa5c4"

def _t(x, y, s, size=9, fill=C_FRAME, anchor="middle"):
    return ("<text x='%s' y='%s' font-size='%d' fill='%s' text-anchor='%s' "
            "font-family='sans-serif'>%s</text>") % (x, y, size, fill, anchor, s)

def _pulley(cx, cy, r=14):
    """滑車1個＝外円＋中心の軸"""
    return ("<circle cx='%s' cy='%s' r='%s' fill='none' stroke='%s' stroke-width='2'/>"
            "<circle cx='%s' cy='%s' r='2' fill='%s'/>") % (cx, cy, r, C_FRAME, cx, cy, C_FRAME)

def _rope(x1, y1, x2, y2):
    return "<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1.5'/>" % (x1, y1, x2, y2, C_ROPE)

def _arc(cx, cy, r, side):
    """滑車にひもがかかる半円。side='under' は下半分、'over' は上半分"""
    if side == "under":
        return "<path d='M%s,%s A%s,%s 0 0 0 %s,%s' fill='none' stroke='%s' stroke-width='1.5'/>" % (
            cx - r, cy, r, r, cx + r, cy, C_ROPE)
    return "<path d='M%s,%s A%s,%s 0 0 1 %s,%s' fill='none' stroke='%s' stroke-width='1.5'/>" % (
        cx - r, cy, r, r, cx + r, cy, C_ROPE)

def _load(cx, top, label="荷物"):
    return ("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1.5'/>"
            "<rect x='%s' y='%s' width='30' height='24' fill='none' stroke='%s' stroke-width='2'/>"
            "%s") % (cx, top, cx, top + 16, C_FRAME,
                     cx - 15, top + 16, C_FRAME,
                     _t(cx, top + 32, label, 9))

def _pull_arrow(x, y_from, y_to, label="引く力"):
    """下向きに引く矢印"""
    return ("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1.5'/>"
            "<polygon points='%s,%s %s,%s %s,%s' fill='%s'/>%s") % (
        x, y_from, x, y_to - 8, C_ARROW,
        x, y_to, x - 5, y_to - 10, x + 5, y_to - 10, C_ARROW,
        _t(x + 8, (y_from + y_to) // 2, label, 9, C_ARROW, "start"))

def _up_arrow(x, y_from, y_to, label="引く力"):
    """上向きに引く矢印（天井を突き抜けないように y_to は天井より下）"""
    return ("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1.5'/>"
            "<polygon points='%s,%s %s,%s %s,%s' fill='%s'/>%s") % (
        x, y_from, x, y_to + 8, C_ARROW,
        x, y_to, x - 5, y_to + 10, x + 5, y_to + 10, C_ARROW,
        _t(x + 8, y_to + 22, label, 9, C_ARROW, "start"))

def pulley_svg(n_dou, n_tei):
    """動滑車 n_dou 個・定滑車 n_tei 個の図を返す。
       動滑車は縦に並べ、各段で『2本のひもで支えられている』ことが見えるように描く。"""
    W = 230
    CEIL_Y = 16
    R = 14
    HALF = 18          # 動滑車の左右のひもの開き

    parts = ["<line x1='16' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='4'/>" % (CEIL_Y, W - 16, CEIL_Y, C_FRAME)]

    dou_x = 78
    first_y = 66
    gap = 56
    dou_pos = [(dou_x, first_y + i * gap) for i in range(n_dou)]
    bottom = dou_pos[-1][1] if dou_pos else CEIL_Y

    tei_x = 178
    tei_y = 48
    if n_tei:
        parts.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1.2'/>" % (
            tei_x, CEIL_Y, tei_x, tei_y - R, C_FRAME))
        parts.append(_pulley(tei_x, tei_y, R))
        parts.append(_t(tei_x, tei_y - R - 5, "定かっ車", 8, C_SUB))

    for i, (cx, cy) in enumerate(dou_pos):
        parts.append(_pulley(cx, cy, R))
        parts.append(_arc(cx, cy, R, "under"))
        # 左のひも（垂直）：いちばん上は天井、それ以外は1つ上の動滑車の軸から
        if i == 0:
            parts.append(_rope(cx - R, CEIL_Y, cx - R, cy))
        else:
            px, py = dou_pos[i - 1]
            parts.append(_rope(px, py + R, px, cy - R - 4))       # 軸から真下へ
            parts.append(_rope(px, cy - R - 4, cx - R, cy - R - 4))  # 横に渡す
            parts.append(_rope(cx - R, cy - R - 4, cx - R, cy))    # 滑車の左へ
        # 右のひも（垂直に上へ）
        if i == len(dou_pos) - 1:
            if n_tei:
                parts.append(_rope(cx + R, cy, cx + R, tei_y))
                parts.append(_rope(cx + R, tei_y, tei_x - R, tei_y))
                parts.append(_arc(tei_x, tei_y, R, "over"))
                parts.append(_pull_arrow(tei_x + R, tei_y, tei_y + 62))
            else:
                parts.append(_rope(cx + R, cy, cx + R, CEIL_Y + 30))
                parts.append(_up_arrow(cx + R, CEIL_Y + 30, CEIL_Y + 6))
        else:
            nx, ny = dou_pos[i + 1]
            parts.append(_rope(cx + R, cy, cx + R, ny - R - 4))

    if dou_pos:
        parts.append(_load(dou_x, bottom + R))
        lbl = "動かっ車" + ("%d個" % n_dou if n_dou > 1 else "")
        parts.append(_t(dou_x - R - 8, first_y + 3, lbl, 8, C_SUB, "end"))
    else:
        parts.append(_rope(tei_x - R, tei_y, tei_x - R, tei_y + 62))
        parts.append(_load(tei_x - R, tei_y + 62))

    H = (bottom + R + 58) if dou_pos else (tei_y + 112)
    return ("<svg viewBox='0 0 %d %d' xmlns='http://www.w3.org/2000/svg' "
            "style='display:block;margin:6px auto;max-width:230px'>%s</svg>") % (W, H, "".join(parts))


if __name__ == "__main__":
    import io, sys, os
    out = sys.argv[1]
    combos = [(1, 0), (2, 0), (1, 1), (2, 1), (3, 0)]
    h = ["<html><head><meta charset='utf-8'><style>body{background:#0f1424;color:#eef2ff;"
         "font-family:sans-serif;margin:0;padding:12px;display:grid;"
         "grid-template-columns:repeat(3,1fr);gap:12px}div{background:#1a2340;border-radius:8px;padding:8px}"
         "h3{font-size:12px;margin:0 0 4px}</style></head><body>"]
    for d, t in combos:
        h.append("<div><h3>動%d個 ／ 定%d個</h3>%s</div>" % (d, t, pulley_svg(d, t)))
    h.append("</body></html>")
    io.open(os.path.join(out, "pulley_preview.html"), "w", encoding="utf-8").write("".join(h))
    print("preview written")
