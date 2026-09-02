"""折った状態と展開図を並べて画像に出す。目で見て確かめるための道具。
   （[[method_oton_local_preview]]：できたと言う前に必ず目で見る）"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from fold2d import xf_is_flipped, IDENTITY_XF


def save(st, path, title='', steps_note=None, rotate_deg=0):
    """rotate_deg: 画面で見える向きに回して描く。折り図と直接見くらべるのに要る
       （2026-09-03、紙の座標のままだと図と向きが違って形の良し悪しが分からなかった）。"""
    fig, axes = plt.subplots(1, 2, figsize=(11, 5.6))
    ax, ax2 = axes

    # --- 折った状態（層の順に下から重ねて描く。表は赤、裏はクリーム）---
    import math as _m
    _t = _m.radians(rotate_deg)
    _c, _s = _m.cos(_t), _m.sin(_t)
    def _rot(poly):
        return [(x*_c - y*_s, x*_s + y*_c) for x, y in poly]
    for p in sorted(st.panels, key=lambda q: q['layer']):
        back = xf_is_flipped(p.get('xf', IDENTITY_XF))
        ax.add_patch(Polygon(_rot(p['poly']), closed=True,
                             facecolor='#f5eedc' if back else '#d6564a',
                             edgecolor='#333', linewidth=1.0, alpha=1.0))
    ax.set_aspect('equal')
    hw, hh = st.paper['hw'], st.paper['hh']
    # ★回すと元の紙より外へ出る（対角線の長さぶん）。1.25倍だと上が切れて
    #   「耳が無い」ように見えた（2026-09-03）。
    m = _m.hypot(hw, hh) * 1.12
    ax.set_xlim(-m, m); ax.set_ylim(-m, m)
    ax.set_title(f'{title} — 折った形（{len(st.panels)}枚）')
    ax.set_xticks([]); ax.set_yticks([])

    # --- 展開図 ---
    ax2.add_patch(Polygon(st.paper_border(), closed=True,
                          facecolor='#faf7ee', edgecolor='#111', linewidth=2))
    for c in st.crease_pattern():
        style = dict(color='#d0342c', linestyle=(0, (9, 3, 1.5, 3))) if c['kind'] == 'M' \
            else (dict(color='#2f6fd0', linestyle=(0, (6, 4))) if c['kind'] == 'V'
                  else dict(color='#888', linestyle=':'))
        ax2.plot([c['a'][0], c['b'][0]], [c['a'][1], c['b'][1]], linewidth=1.4, **style)
    ax2.set_aspect('equal')
    ax2.set_xlim(-m, m); ax2.set_ylim(-m, m)
    ax2.set_title(f'展開図（折線 {len(st.crease_pattern())}本／赤=山 青=谷）')
    ax2.set_xticks([]); ax2.set_yticks([])

    if steps_note:
        fig.text(0.5, 0.005, steps_note, ha='center', fontsize=8)
    plt.rcParams['font.family'] = ['MS Gothic', 'Yu Gothic', 'sans-serif']
    fig.tight_layout()
    fig.savefig(path, dpi=110, bbox_inches='tight')
    plt.close(fig)
    return path
