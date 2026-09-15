"""Run: python -B tools/test_origami_recipe.py (requires Node.js, no pip packages)."""
import sys
sys.dont_write_bytecode = True
import copy
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import unittest

from origami_recipe import HERE, RecipeError, parse, replay, convert, source_polygon

SAMPLE = HERE / 'recipe_examples' / 'triangle.origami.json'


def canonical(poly):
    return sorted(tuple(round(x, 7) + 0.0 for x in p) for p in poly)


def area(poly):
    return abs(sum(p[0]*poly[(i+1) % len(poly)][1]-p[1]*poly[(i+1) % len(poly)][0]
                   for i, p in enumerate(poly))) / 2


class RecipeTests(unittest.TestCase):
    def setUp(self):
        self.recipe = parse(SAMPLE.read_text(encoding='utf-8'))

    def test_original_coordinates_and_provenance(self):
        state, frames = replay(self.recipe)
        self.assertEqual([len(f) for f in frames], [1, 2, 4])
        for frame in frames:
            self.assertAlmostEqual(sum(area(p['poly']) for p in frame), 4)
            self.assertAlmostEqual(sum(area(source_polygon(p)) for p in frame), 4)
        # Both layers finish on the independently known quarter-square triangle.
        expected = canonical([(-1,-1), (0,0), (-1,1)])
        self.assertTrue(all(canonical(p['poly']) == expected for p in state.panels))
        self.assertEqual(sorted(p['layer'] for p in state.panels), [0,1,2,3])
        self.assertEqual(len({p['recipeFace']['faceId'] for p in state.panels}), 4)
        self.assertTrue(all(len(p['recipeFace']['layerPath']) == 2 for p in state.panels))
        # Original coordinates survive serialization, not the displayed coordinates.
        self.assertEqual(parse(json.dumps(self.recipe)), self.recipe)
        self.assertEqual(self.recipe['steps'][1]['line'], [[-1,1],[1,-1]])

    def test_lion_local_mountain_fold(self):
        from fold2d import point_in_polygon, xf_apply
        recipe = parse((HERE/'recipe_examples/lion.origami.json').read_text(encoding='utf-8'))
        state, frames = replay(recipe)
        self.assertEqual([s['op'] for s in recipe['steps']], ['crease','crease','fold','fold','fold','fold'])
        self.assertEqual(recipe['steps'][-1]['kind'], 'M')
        for frame in frames:
            self.assertAlmostEqual(sum(area(p['poly']) for p in frame), 4)
            self.assertAlmostEqual(sum(area(source_polygon(p)) for p in frame), 4)
        def front(p):
            a,b,c,d,_,_ = p['xf']
            return a*d-b*c > 0
        self.assertTrue(all(front(p) for p in frames[2]))
        for side in ('keep','cut'):
            face_id = f'paper/s1.{side}/s2.cut/s3.cut'
            self.assertEqual(next(p for p in frames[-2] if p['recipeFace']['faceId']==face_id),
                             next(p for p in frames[-1] if p['recipeFace']['faceId']==face_id))
        # Check both sides of the hinge using original-space ancestry, not screen rotation.
        for p in frames[-1]:
            src = source_polygon(p)
            center = tuple(sum(v[k] for v in src)/len(src) for k in (0,1))
            parent = next(q for q in frames[-2] if point_in_polygon(center,source_polygon(q)))
            old = xf_apply(parent['xf'],center)
            new = xf_apply(p['xf'],center)
            old_x,old_y = (old[0]-old[1])/2,(old[0]+old[1])/2
            new_x,new_y = (new[0]-new[1])/2,(new[0]+new[1])/2
            self.assertAlmostEqual(old_x,new_x)
            if old_y > -.1:
                self.assertAlmostEqual(new_y,-.2-old_y)
                self.assertNotEqual(front(p),front(parent))
                self.assertLess(p['layer'],0)
            else:
                self.assertAlmostEqual(new_y,old_y)
                self.assertEqual(front(p),front(parent))
        for (x,y),expected_front in [((.07,-.25),True),((-.48,-.5),False),((.48,-.5),False),((.06,-1),False)]:
            layers = [p for p in state.panels if point_in_polygon((x+y,y-x),p['poly'])]
            self.assertTrue(layers)
            self.assertEqual(front(max(layers,key=lambda p:p['layer'])),expected_front)
        diagram_y = [(x+y)/2 for p in state.panels for x,y in p['poly']]
        self.assertAlmostEqual(max(diagram_y),-.1)
        self.assertAlmostEqual(min(diagram_y),-1.2)

    def test_js_editor_round_trip_atomicity_and_python_parity(self):
        recipes = [self.recipe]
        partial = copy.deepcopy(self.recipe)
        partial['steps'][1]['targets'] = [{'faceId':'paper/s1.cut'}]
        recipes.append(partial)
        mountain = copy.deepcopy(self.recipe)
        mountain['steps'][0]['kind'] = 'M'
        recipes.append(mountain)
        crease = copy.deepcopy(self.recipe)
        crease['steps'][0]['op'] = 'crease'
        recipes.append(crease)
        flipped = copy.deepcopy(self.recipe)
        flipped['steps'].insert(1, {'id':'turn','diagramStep':'1b','op':'flip','axis':'v','instruction':'裏返す'})
        recipes.append(flipped)
        rectangle = copy.deepcopy(self.recipe)
        rectangle['paper']['aspectRatio'] = 2
        recipes.append(rectangle)
        with tempfile.TemporaryDirectory(prefix='recipe-test-', dir=HERE) as folder:
            payload = Path(folder) / 'input.json'
            payload.write_text(json.dumps({'recipes': recipes}), encoding='utf-8')
            run = subprocess.run(['node', str(HERE / 'test_origami_recipe.js'), str(payload)],
                                 capture_output=True, text=True, encoding='utf-8', timeout=60)
        self.assertEqual(run.returncode, 0, run.stderr)
        result = json.loads(run.stdout)
        self.assertGreaterEqual(result['checks'], 21)
        for recipe, js_frames in zip(recipes, result['frames'], strict=True):
            _, frames = replay(recipe)
            self.assertEqual(len(frames), len(js_frames))
            for py_frame, js_frame in zip(frames, js_frames, strict=True):
                py_panels = {p['recipeFace']['faceId']:p for p in py_frame}
                js_panels = {p['recipeFace']['faceId']:p for p in js_frame['panels']}
                self.assertEqual(py_panels.keys(), js_panels.keys())
                for key, p in py_panels.items():
                    q = js_panels[key]
                    self.assertEqual(p['recipeFace'], q['recipeFace'])
                    self.assertEqual(canonical(p['poly']), canonical(q['poly']))
                    self.assertEqual(canonical(source_polygon(p)), canonical(source_polygon(q)))
                    self.assertEqual(p['layer'], q['layer'])

    def test_invalid_recipes(self):
        def reject(change, message=None):
            recipe = copy.deepcopy(self.recipe)
            change(recipe)
            with self.assertRaises(RecipeError) as caught:
                replay(recipe)
            if message:
                self.assertIn(message, str(caught.exception))
        for op in ('squash', 'open-pocket', 'unknown'):
            reject(lambda r: r['steps'][1].update(op=op), 'unsupported operation')
        reject(lambda r: r.update(version=2))
        reject(lambda r: r.update(version=True))
        reject(lambda r: r['paper'].update(aspectRatio=0))
        reject(lambda r: r['steps'][1].update(id='s1'))
        reject(lambda r: r['steps'][1].update(line=[[0,0],[0,0]]), 'zero-length')
        reject(lambda r: r['steps'][1].update(movingSidePoint=[math.inf,0]))
        reject(lambda r: r['steps'][1].update(movingSidePoint=[0,0]), 'lies on fold line')
        reject(lambda r: r['steps'][1].update(axis='v'))
        reject(lambda r: r['steps'][1].update(reference={'faceId':'paper'}), 'retired faceId')
        reject(lambda r: r['steps'][1].update(targets=[{'faceId':'paper/s1.keep'}]), 'reference face must')
        reject(lambda r: r['steps'][1]['targets'].append(r['steps'][1]['targets'][0]), 'duplicate targets')
        reject(lambda r: r['steps'][1].update(reference={'faceId':'paper/s1.cut','layerPath':[]}), 'layerPath')
        for text in ('{', '{"version":NaN}', 'null'):
            with self.assertRaises(RecipeError):
                parse(text)

    def test_compiled_data_and_cli_protect_existing_files(self):
        bundle = convert(self.recipe)
        self.assertEqual(bundle['recipe'], self.recipe)
        self.assertEqual(bundle['format'], 'origami-compiled')
        json.dumps(bundle, allow_nan=False)
        mesh = bundle['work']['mesh']
        self.assertTrue(mesh['verts'])
        self.assertTrue(bundle['work']['steps'])
        n = len(mesh['verts'])
        self.assertTrue(all(len(t)==3 and all(0 <= i < n for i in t) for t in mesh['tris']))
        parents = mesh['boneParent']
        self.assertEqual(len(mesh['hinge']), len(parents))
        self.assertTrue(all(0 <= f['boneId'] < len(parents) for f in bundle['faces']))
        self.assertAlmostEqual(sum(area(f['sourcePolygon']) for f in bundle['faces']), 4)
        self.assertEqual(convert(bundle['recipe']), bundle)
        for i in range(len(parents)):
            seen = set()
            while i != -1:
                self.assertTrue(0 <= i < len(parents))
                self.assertNotIn(i, seen)
                seen.add(i)
                i = parents[i]
        protected = [HERE.parent/'index.html', HERE.parent/'js/core.js', *sorted((HERE.parent/'js/works').glob('*.js'))]
        hashes = {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
        def cli(*args):
            return subprocess.run([sys.executable, '-B', str(HERE/'origami_recipe.py'), str(SAMPLE), *map(str,args)],
                                  capture_output=True, text=True, encoding='utf-8', timeout=30)
        self.assertEqual(cli('--check').returncode, 0)
        with tempfile.TemporaryDirectory(prefix='recipe-cli-', dir=HERE) as folder:
            output = Path(folder)/'compiled.json'
            run = cli('--output',output)
            self.assertEqual(run.returncode, 0, run.stderr)
            written = output.read_bytes()
            self.assertEqual(json.loads(written)['recipe'], self.recipe)
            self.assertEqual(cli('--output',output).returncode, 1)
            self.assertEqual(output.read_bytes(), written)
        self.assertEqual(cli('--output',SAMPLE).returncode, 1)
        self.assertEqual(cli('--output',HERE.parent/'js/works/recipe_should_not_exist.json').returncode, 1)
        self.assertEqual(cli('--output',HERE.parent.parent/'recipe_should_not_exist.json').returncode, 1)
        self.assertEqual(hashes, {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in protected})


if __name__ == '__main__':
    unittest.main(verbosity=2)
