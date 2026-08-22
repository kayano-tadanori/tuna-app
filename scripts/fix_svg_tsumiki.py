# -*- coding: utf-8 -*-
"""つみき（積み木）問題の図を、問題文どおりに描き直す。

  きっかけ：sansu_zu の sz074「たて2こ・よこ2こ・たかさ2こ」に、
  平面の正方形が7こ並んだだけの図が入っていた（図がおかしいと通報）。
  調べると同じSVGが9問で使い回されていて、どの問題の内容とも合っていなかった。

  使い方：
    python scripts/fix_svg_tsumiki.py            … 検算だけ（データは触らない）
    TSUMIKI_PREVIEW=out.html python scripts/fix_svg_tsumiki.py  … 目視用HTMLも書く
    python scripts/fix_svg_tsumiki.py --write    … data/sansu_zu.json を書きかえる
"""
import json, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'data', 'sansu_zu.json')

# ── 配色（style.css のダークネイビーに合わせる）──
C_LINE  = '#cfe0ff'   # 積み木の線
C_TOP   = '#4f7cff'   # 上の面
C_RIGHT = '#2a4a9a'   # 右の面
C_LEFT  = '#1b3168'   # 左の面
C_LABEL = '#ffd166'   # 文字


def esc(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def P(*pts):
    return ' '.join('%s,%s' % (esc(x), esc(y)) for x, y in pts)


def rittai_svg(w, d, h, lab_yoko, lab_tate, lab_taka):
    """よこw・たてd（おくゆき）・たかさh の直方体を、1こずつの区切り線つきで描く。"""
    S = 20.0
    ax, ay = 0.866 * S, 0.5 * S      # よこ（右下へ）
    bx, by = -0.866 * S, 0.5 * S     # たて＝おくゆき（左下へ）
    dz = S                           # たかさ（下へ）
    ox, oy = 0.0, 0.0                # 上の面のいちばん奥の角

    def p(i, j, k):
        return (ox + i * ax + j * bx, oy + i * ay + j * by + k * dz)

    A, B, F = p(0, 0, 0), p(w, 0, 0), p(0, d, 0)
    G = p(w, d, 0)                   # 上の面の手前の角
    C, E, D_ = p(w, 0, h), p(0, d, h), p(w, d, h)

    s = []
    # 見えている3つの面
    s.append("<polygon points='%s' fill='%s' opacity='0.5'/>" % (P(A, B, G, F), C_TOP))
    s.append("<polygon points='%s' fill='%s' opacity='0.85'/>" % (P(B, C, D_, G), C_RIGHT))
    s.append("<polygon points='%s' fill='%s' opacity='0.9'/>" % (P(F, G, D_, E), C_LEFT))
    # 1こずつの区切り線
    ln = []
    for i in range(1, w):
        ln.append((p(i, 0, 0), p(i, d, 0)))      # 上の面
        ln.append((p(i, d, 0), p(i, d, h)))      # 左の面
    for j in range(1, d):
        ln.append((p(0, j, 0), p(w, j, 0)))      # 上の面
        ln.append((p(w, j, 0), p(w, j, h)))      # 右の面
    for k in range(1, h):
        ln.append((p(w, 0, k), p(w, d, k)))      # 右の面
        ln.append((p(0, d, k), p(w, d, k)))      # 左の面
    for (x1, y1), (x2, y2) in ln:
        s.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1' opacity='0.75'/>"
                 % (esc(x1), esc(y1), esc(x2), esc(y2), C_LINE))
    # そとがわの線
    s.append("<polygon points='%s' fill='none' stroke='%s' stroke-width='1.8' stroke-linejoin='round'/>"
             % (P(A, B, C, D_, E, F), C_LINE))

    pts = [A, B, C, D_, E, F, G]
    # ラベル（よこ＝右上の辺の外、たて＝左上の辺の外、たかさ＝右の辺の外）
    labels = []
    mx, my = (A[0] + B[0]) / 2, (A[1] + B[1]) / 2
    labels.append((mx + 8, my - 8, 'start', lab_yoko))
    mx, my = (A[0] + F[0]) / 2, (A[1] + F[1]) / 2
    labels.append((mx - 8, my - 8, 'end', lab_tate))
    mx, my = (B[0] + C[0]) / 2, (B[1] + C[1]) / 2
    labels.append((mx + 10, my + 4, 'start', lab_taka))
    for lx, ly, anc, t in labels:
        s.append("<text x='%s' y='%s' font-size='11' font-weight='bold' fill='%s' text-anchor='%s'>%s</text>"
                 % (esc(lx), esc(ly), C_LABEL, anc, t))

    # viewBox（ラベルの文字ぶんも見こんで余白をとる）
    xs = [x for x, y in pts]
    ys = [y for x, y in pts]
    for lx, ly, anc, t in labels:
        wlab = len(t) * 11.0
        xs += [lx - (wlab if anc == 'end' else 0), lx + (0 if anc == 'end' else wlab)]
        ys += [ly - 11, ly + 3]
    pad = 6
    x0, y0 = min(xs) - pad, min(ys) - pad
    vw, vh = (max(xs) - min(xs)) + pad * 2, (max(ys) - min(ys)) + pad * 2
    return ("<svg viewBox='%s %s %s %s' xmlns='http://www.w3.org/2000/svg' "
            "style='display:block;margin:6px auto;max-width:260px'>%s</svg>"
            % (esc(x0), esc(y0), esc(vw), esc(vh), ''.join(s)))


def nidan_svg(shita, ue):
    """下のだんに shita こ、上のだんに ue こ、よこ一れつに つんだ図。"""
    S = 26.0
    x0, y0 = 0.0, 0.0                # 上のだんの左上
    s = []
    for row, (n, yy) in enumerate(((ue, y0), (shita, y0 + S))):
        for i in range(n):
            s.append("<rect x='%s' y='%s' width='%s' height='%s' rx='2' fill='%s' opacity='%s' "
                     "stroke='%s' stroke-width='1.6'/>"
                     % (esc(x0 + i * S), esc(yy), esc(S), esc(S),
                        C_TOP if row == 0 else C_RIGHT, '0.5' if row == 0 else '0.85', C_LINE))
    labels = [(x0 - 8, y0 + S * 0.62, 'end', 'うえのだん'),
              (x0 - 8, y0 + S * 1.62, 'end', 'したのだん')]
    for lx, ly, anc, t in labels:
        s.append("<text x='%s' y='%s' font-size='11' font-weight='bold' fill='%s' text-anchor='%s'>%s</text>"
                 % (esc(lx), esc(ly), C_LABEL, anc, t))
    xs = [x0 - 8 - 5 * 11.0, x0 + max(shita, ue) * S]
    ys = [y0, y0 + S * 2]
    pad = 6
    x0v, y0v = min(xs) - pad, min(ys) - pad
    vw, vh = (max(xs) - min(xs)) + pad * 2, (max(ys) - min(ys)) + pad * 2
    return ("<svg viewBox='%s %s %s %s' xmlns='http://www.w3.org/2000/svg' "
            "style='display:block;margin:6px auto;max-width:280px'>%s</svg>"
            % (esc(x0v), esc(y0v), esc(vw), esc(vh), ''.join(s)))


# ── 直すもの（問題文からそのまま起こす）──
FIX = {
    'sz037': nidan_svg(3, 2),
    'sz038': nidan_svg(4, 3),
    'sz039': nidan_svg(5, 4),
    'sz040': nidan_svg(6, 5),
    'sz074': rittai_svg(2, 2, 2, 'よこ2こ', 'たて2こ', 'たかさ2こ'),
    'sz135': rittai_svg(3, 3, 2, 'よこ3こ', 'たて3こ', '高さ2こ'),
    'sz148': rittai_svg(4, 3, 2, 'よこ4こ', 'たて3こ', '高さ2こ'),
    'sz149': rittai_svg(3, 3, 3, 'よこ3こ', 'たて3こ', '高さ3こ'),
    'sz466': rittai_svg(2, 4, 2, 'よこ2こ', 'たて4こ', '高さ2こ'),
}

# 図に描いた こ数 と、問題の answer が合っているかの検算
COUNT = {'sz037': 3 + 2, 'sz038': 4 + 3, 'sz039': 5 + 4, 'sz040': 6 + 5,
         'sz074': 2 * 2 * 2, 'sz135': 3 * 3 * 2, 'sz148': 4 * 3 * 2,
         'sz149': 3 * 3 * 3, 'sz466': 2 * 4 * 2}


def main():
    d = json.load(io.open(DATA, encoding='utf-8'))
    m = {q['id']: q for q in d}
    ng = 0
    for qid in sorted(FIX):
        got = COUNT[qid]
        ans = str(m[qid].get('answer'))
        ok = (str(got) == ans)
        if not ok:
            ng += 1
        print('%s %s 図のこ数=%d / answer=%s' % ('OK ' if ok else 'NG ', qid, got, ans))
    if ng:
        print('!! 図と答えが合わないものがある。中止。')
        sys.exit(1)

    out = os.environ.get('TSUMIKI_PREVIEW')
    if out:
        html = [u"<html><meta charset='utf-8'><body style='background:#080e20;color:#eef2ff;"
                u"font-family:sans-serif;padding:16px'>"]
        for qid in sorted(FIX):
            html.append(u"<div style='margin:0 0 22px;padding:12px;background:rgba(20,32,72,.65);"
                        u"border:1px solid rgba(120,150,220,.2);border-radius:14px;max-width:520px'>")
            html.append(u"<div style='font-size:13px;margin-bottom:6px'>%s / %s（答え %s）</div>"
                        % (qid, m[qid]['question'], m[qid]['answer']))
            html.append(FIX[qid])
            html.append(u"</div>")
        html.append(u"</body></html>")
        with io.open(out, 'w', encoding='utf-8') as f:
            f.write(u''.join(html))
        print('プレビュー:', out)

    if '--write' in sys.argv:
        for q in d:
            if q['id'] in FIX:
                q['svg'] = FIX[q['id']]
        # もとのファイルは CRLF・末尾に改行なし。差分が全行に散らないよう合わせる
        with io.open(DATA, 'w', encoding='utf-8', newline='\r\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
        print('書きこんだ:', DATA)


if __name__ == '__main__':
    main()
