"""折り手順を1手ずつ描いて、どこで形が狂うか目で見るための道具。
   ★手順の関数をそのまま流し直すのではなく、「1手ずつ止めて描く」ために
     折り操作をフックして途中の状態を写し取る。"""
import sys, math, copy
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.family'] = ['MS Gothic', 'Yu Gothic', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False
from matplotlib.patches import Polygon
from fold2d import FoldState, xf_is_flipped, IDENTITY_XF


def record(builder):
    """builderを走らせながら、1手ごとの紙の状態を控える。"""
    shots = []
    orig_fold = FoldState.fold
    orig_flip = FoldState.flip

    def fold(self, *a, **kw):
        r = orig_fold(self, *a, **kw)
        shots.append((len(self.steps), copy.deepcopy(self.panels),
                      self.steps[-1]['name'] if self.steps else ''))
        return r

    def flip(self, *a, **kw):
        r = orig_flip(self, *a, **kw)
        shots.append((len(self.steps), copy.deepcopy(self.panels),
                      self.steps[-1]['name']))
        return r

    FoldState.fold, FoldState.flip = fold, flip
    try:
        st, meta = builder()
    finally:
        FoldState.fold, FoldState.flip = orig_fold, orig_flip
    return st, meta, shots


def sheet(builder, path, title=''):
    st, meta, shots = record(builder)
    rot = math.radians(meta.get('rotate_deg', 0))
    c, s = math.cos(rot), math.sin(rot)
    n = len(shots) + 1
    cols = min(6, n)
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(2.7*cols, 2.9*rows), squeeze=False)
    axes = axes.ravel()

    def draw(ax, panels, label):
        for p in sorted(panels, key=lambda q: q['layer']):
            pts = [(x*c - y*s, x*s + y*c) for x, y in p['poly']]
            back = xf_is_flipped(p.get('xf', IDENTITY_XF))
            ax.add_patch(Polygon(pts, closed=True,
                                 facecolor='#f5eedc' if back else '#d6564a',
                                 edgecolor='#333', linewidth=0.9))
        ax.set_aspect('equal'); ax.set_xlim(-2, 2); ax.set_ylim(-2, 2)
        ax.set_xticks([]); ax.set_yticks([])
        ax.set_title(label, fontsize=9)

    hw, hh = st.paper['hw'], st.paper['hh']
    draw(axes[0], [{'poly': [(-hw,-hh),(hw,-hh),(hw,hh),(-hw,hh)],
                    'layer': 0, 'xf': IDENTITY_XF}], '0. 紙')
    for i, (k, panels, name) in enumerate(shots):
        draw(axes[i+1], panels, f'{i+1}. {name}'[:26])
    for ax in axes[n:]:
        ax.axis('off')
    fig.suptitle(title or meta['name'], fontsize=12)
    fig.tight_layout()
    fig.savefig(path, dpi=100)
    plt.close(fig)
    return st, meta


if __name__ == '__main__':
    import works_build as W
    for nm in (sys.argv[1:] or ['koppu', 'kabuto']):
        st, meta = sheet(W.BUILDERS[nm], str(Path(__file__).parent / 'preview' /
                                             f'steps_{nm}.png'))
        print(f'{nm}: {sum(1 for x in st.steps if x["op"]=="fold")}手 → preview/steps_{nm}.png')
