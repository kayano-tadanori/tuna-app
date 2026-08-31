"""fold2d.FoldStateの状態を画像として保存する、確認用の可視化ツール。"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
from matplotlib.collections import PatchCollection

def save_state(fs, path, title=''):
    fig, ax = plt.subplots(figsize=(6, 6))
    colors = plt.cm.tab10.colors
    for i, p in enumerate(fs.panels):
        poly = p['poly']
        color = colors[abs(p['layer']) % len(colors)]
        patch = Polygon(poly, closed=True, facecolor=color, edgecolor='black',
                         alpha=0.6, linewidth=1.5)
        ax.add_patch(patch)
        cx = sum(x for x, y in poly) / len(poly)
        cy = sum(y for x, y in poly) / len(poly)
        ax.text(cx, cy, f"L{p['layer']}", ha='center', va='center', fontsize=8)
    for c in fs.creases:
        ax.plot([c['a'][0], c['b'][0]], [c['a'][1], c['b'][1]],
                color='red' if c['kind'] == 'V' else 'blue', linewidth=1, linestyle='--')
    ax.set_aspect('equal')
    ax.autoscale()
    ax.set_title(title)
    fig.savefig(path, dpi=120, bbox_inches='tight')
    plt.close(fig)
    print('saved', path)
