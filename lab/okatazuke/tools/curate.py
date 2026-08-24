# -*- coding: utf-8 -*-
"""作った候補から「使う面」を選んで、tier ごとの原本テキストに書き出す。

選びかた（NotebookLM資料の「良い面／悪い面」に合わせる）
  ・一本道すぎるもの（branch が低い）は落とす＝ただの作業
  ・まっすぐ運ぶだけ（detour が低い）は落とす
  ・同じ部屋の形ばかりにならないよう、ばらけさせる
  ・むずかしさは「おした数」で段をつける
名前は オカンの家の場所（げんかん・だいどころ…）。
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sokoban  # noqa: E402

PLACES = [
    ('げんかん', 'くつは そろえて 置くんやで'),
    ('だいどころ', 'まな板の まえは あけときや'),
    ('おしいれ', 'おくから つめていくのが コツ'),
    ('ものおき', 'ここは いっぱい 入るで'),
    ('ろうか', 'まん中を ふさいだら 通られへん'),
    ('げたばこ', 'せまいけど なんとかなる'),
    ('とだな', 'せの高い ものから 先に'),
    ('ほんだな', 'ならべる じゅんばんが 大事'),
    ('おもちゃばこ', 'ちらかしたんは だれや'),
    ('かいだんした', 'おくが 見えへんから よう考えや'),
    ('わしつ', 'たたみの めに そって'),
    ('ベランダ', '風で とばんように'),
    ('やねうら', 'あたま ぶつけんときや'),
    ('ちかしつ', 'ここまで来たら ベテランや'),
    ('えんがわ', 'ひなたぼっこは あとにしよ'),
    ('くるまこ', '車が 入る すきまを あけて'),
    ('タンス', 'ひきだしの まえは あけとく'),
    ('れいぞうこのうら', 'せまいところの おかたづけ'),
    ('せんめんじょ', 'あさは ここが こむんや'),
    ('ふろば', 'すべらんように 気ぃつけて'),
    ('にわさき', 'ひろいと かえって むずかしい'),
    ('たなのうえ', 'とどかへんとこは 先にやる'),
    ('だいどころのおく', 'ここが いちばんの 難所や'),
    ('しまいのま', 'ここまで来たら たいしたもんや'),
    ('くらのなか', '代々の ものが ぎょうさんある'),
    ('おおそうじ', 'いちねんの しめくくり'),
    ('ものおきのおく', 'おくの おくまで'),
    ('よやくのま', 'あけとくのも おかたづけ'),
    ('きゃくま', 'お客さんが 来はるで'),
    ('だんろのまえ', 'あったかいけど 気は ぬかんと'),
]


def load(path):
    if not os.path.exists(path):
        return []
    out = []
    text = io.open(path, encoding='utf-8').read()
    cur, head = [], None
    for line in text.split('\n'):
        if line.startswith(';'):
            if cur and head:
                out.append((head, cur))
            head, cur = line[1:], []
            continue
        if line.strip() == '':
            if cur and head:
                out.append((head, cur)); head, cur = None, []
            continue
        cur.append(line)
    if cur and head:
        out.append((head, cur))
    res = []
    for head, rows in out:
        m = dict(re.findall(r'(\w+)=([-\d.]+)', head))
        tpl = head.split()[0]
        res.append({
            'tpl': tpl, 'rows': rows,
            'box': int(m.get('box', 0)), 'score': float(m.get('score', 0)),
            'pushes': int(m.get('pushes', 0)), 'moves': int(m.get('moves', 0)),
            'detour': float(m.get('detour', 0)), 'branch': float(m.get('branch', 0)),
        })
    return res


def pick(cands, lo, hi, n, used_keys):
    """おした数が lo..hi のものから n 個。部屋の形がかたよらないように選ぶ。"""
    pool = [c for c in cands
            if lo <= c['pushes'] <= hi and c['branch'] >= 2.2 and c['detour'] >= 1.35]
    pool.sort(key=lambda c: -c['score'])
    out, tplcount = [], {}
    for c in pool:
        key = '\n'.join(c['rows'])
        if key in used_keys:
            continue
        if tplcount.get(c['tpl'], 0) >= max(2, n // 3):
            continue
        used_keys.add(key)
        tplcount[c['tpl']] = tplcount.get(c['tpl'], 0) + 1
        out.append(c)
        if len(out) >= n:
            break
    out.sort(key=lambda c: (c['pushes'], c['box']))
    return out


def write(path, picked, names):
    lines = ['; ★この面は tools/curate.py が候補から選んで書き出したもの。',
             '; 　もとは 逆行作成法（クリア状態から にもつを引いて散らす）で作った完全な自作。',
             '; 　make_levels.py が 1面ずつ ソルバーで「解けること」を確かめている。', '']
    for c, (nm, hint) in zip(picked, names):
        lines.append(';%s|%s' % (nm, hint))
        lines.extend(c['rows'])
        lines.append('')
    io.open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    print('%s … %d面 （おした数 %s）' % (os.path.basename(path), len(picked),
                                    ' '.join(str(c['pushes']) for c in picked)))


def main():
    cands = load(os.path.join(HERE, '_cands.txt')) + load(os.path.join(HERE, '_cands2.txt'))
    print('候補 %d 個' % len(cands))
    used = set()
    normal = pick(cands, 7, 10, 10, used)
    hard = pick(cands, 11, 14, 10, used)
    extra = pick(cands, 15, 40, 8, used)
    i = 0
    write(os.path.join(HERE, 'levels_normal.txt'), normal, PLACES[i:i + len(normal)]); i += len(normal)
    write(os.path.join(HERE, 'levels_hard.txt'), hard, PLACES[i:i + len(hard)]); i += len(hard)
    write(os.path.join(HERE, 'levels_extra.txt'), extra, PLACES[i:i + len(extra)])


if __name__ == '__main__':
    main()
