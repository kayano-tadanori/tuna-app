"""tsuru_steps3.json -> js/works/tsuru_precise.js への変換。"""
import json, io

d = json.load(open('tsuru_steps3.json', encoding='utf-8'))
mesh = d['mesh']
steps = d['steps']
n = len(mesh['boneParent'])

def jsnum(x):
    return json.dumps(x)

js = []
js.append("// ============================================================")
js.append("// works/tsuru_precise.js — つる(精密版・自動生成・裂けない仕組み入り)")
js.append("//")
js.append("//   三谷純研究室ORIPAサンプル(crane_final_mitani.opx)から全自動生成。")
js.append("//   2026-08-30 続き13：Union-Findで作ったグループの中身自体が「意味の")
js.append("//   通った折り」に対応しないと判明したため、事前の同期グループ列挙を")
js.append("//   やめ、renderer.jsに「裂けない仕組み」(境界の頂点は隣のパネルとも")
js.append("//   ブレンドする aPanel2/aBlend)を実装した。どの順番・粒度で折っても")
js.append("//   境界が大きく開いて見えることがない(tools/gen_steps.py参照)。")
js.append("// ============================================================")
js.append("'use strict';")
js.append("")
js.append("window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};")
js.append("ORIGAMI_WORKS.tsuru_precise = {")
js.append("  id: 'tsuru_precise', name: 'つる(精密版)', emoji: \"\\ud83e\\udda2\", difficulty: 4,")
js.append("  usePhysics: true,  // 質点バネ物理(js/cloth.js)で裂けを防ぐ(2026-08-30 続き13)")
js.append("  mesh: {")
js.append(f"    verts: {jsnum(mesh['verts'])},")
js.append(f"    tris: {jsnum(mesh['tris'])},")
js.append(f"    uv: {jsnum(mesh['uv'])},")
js.append(f"    panel: {jsnum(mesh['panel'])},")
js.append(f"    panel2: {jsnum(mesh['panel2'])},")
js.append(f"    blend: {jsnum(mesh['blend'])},")
js.append(f"    boneParent: {jsnum(mesh['boneParent'])},")
hinge_js = [ (None if h is None else {'origin': h['origin'], 'axis': h['axis']}) for h in mesh['hinge'] ]
js.append(f"    hinge: {jsnum(hinge_js)},")
js.append(f"    inflateSign: {jsnum([0]*n)},")
js.append("  },")
js.append(f"  steps: {jsnum(steps)},")
js.append("  labelPoints: [],")
js.append("  poseAdjust: {},")
js.append("  inflate: { min: 0, max: 1, default: 0 },")
js.append("  cutSlots: [],")
js.append("};")

out_path = r"C:\Users\User\Desktop\Claude\tuna app\lab\origami\js\works\tsuru_precise.js"
with io.open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(js) + '\n')
print('wrote', out_path)
