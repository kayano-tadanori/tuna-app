"""1手目を「32,53,41を同時に折って対角線で半分」に置き換えたテスト版を作る。"""
import json, math
exec(open('gen_steps.py', encoding='utf-8').read().split("with io.open")[0])

d = {
    'mesh': {
        'verts': verts, 'tris': tris_out, 'uv': uv_out, 'panel': panel_out,
        'boneParent': boneParent, 'hinge': hinge,
        'panel2': panel2_out, 'blend': blend_out,
    },
    'steps': [
        {'id': 1, 'handle': {'boneId': 32, 'local': handle_local[32], 'linkedBoneIds': [53, 41]},
         'targetAngle': math.pi, 'snapDeg': 0.35, 'returnAngle': 0,
         'hintLabel': 'たいかくせんで はんぶんに たにおり',
         'creaseLine': {'boneId': 4, 'a': hinge[32]['origin'], 'b': [hinge[32]['origin'][i]+hinge[32]['axis'][i] for i in range(3)], 'kind': 'valley'}},
    ] + steps,  # keep the rest of the original 12 steps appended (may have redundant overlaps, ok for a quick visual check)
    'root': root,
}
with open('test_step1_diag.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=True)
print('wrote test_step1_diag.json, n_steps=', len(d['steps']))
