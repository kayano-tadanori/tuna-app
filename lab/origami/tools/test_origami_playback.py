"""A1 semantic, corruption and existing-engine regression tests (stdlib + Node)."""
import sys
sys.dont_write_bytecode = True
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from origami_recipe import HERE, RecipeError, parse
from origami_playback import compile_playback, verify_playback


def fixture(name):
    return parse((HERE/'recipe_examples'/f'{name}.origami.json').read_text(encoding='utf-8'))


class PlaybackTests(unittest.TestCase):
    def test_examples_roundtrip_and_existing_engine(self):
        for name, count in [('triangle', 3), ('lion', 7), ('suika2', 7)]:
            with self.subTest(name=name):
                recipe = fixture(name)
                data = compile_playback(recipe)
                self.assertEqual(data, compile_playback(recipe))
                self.assertEqual(data['recipe'], recipe)
                roundtrip = json.loads(json.dumps(data, ensure_ascii=False, allow_nan=False))
                self.assertEqual(verify_playback(roundtrip)['frames'], count)
                with tempfile.TemporaryDirectory() as temp:
                    file = Path(temp)/'playback.json'
                    file.write_text(json.dumps(roundtrip), encoding='utf-8')
                    command=['node', str(HERE/'test_origami_playback_engine.js'), str(file)]
                    if os.environ.get('ORIGAMI_PLAYBACK_BROWSER')=='1': command.append('--browser')
                    subprocess.run(command, check=True)

    def test_crease_and_flip_only_and_rectangular_paper(self):
        for op in ['crease', 'flip']:
            for axis in ['v', 'h']:
                recipe = fixture('triangle')
                recipe['paper'].update(aspectRatio=1.7, colorDown=True)
                recipe['steps'] = [recipe['steps'][0]]
                if op=='crease':
                    recipe['steps'][0]['op']='crease'
                else:
                    recipe['steps']=[{'id':'s1','diagramStep':'1','op':'flip','axis':axis,'instruction':'返す'}]
                data = compile_playback(recipe)
                self.assertEqual(data['frames'][0]['boneAngles'],data['frames'][1]['boneAngles'])
                self.assertEqual(data['steps'][0]['boneIds'], [])
                verify_playback(data)

    def test_crease_records_and_partial_mountain(self):
        data = compile_playback(fixture('lion'))
        self.assertEqual([f['recordedCreases'] for f in data['frames'][:3]], [[], ['s1'], ['s1','s2']])
        self.assertEqual(data['frames'][0]['boneAngles'],data['frames'][2]['boneAngles'])
        self.assertEqual(data['steps'][-1]['kind'],'M')
        self.assertLess(len(data['steps'][-1]['movingFaceIndices']), len(data['faces']))
        self.assertEqual(data['frames'][-2]['bodyPose'],data['frames'][-1]['bodyPose'])

    def test_both_flip_axes_before_fold_and_terminal_flip(self):
        for axis in ['h','v']:
            recipe = fixture('triangle')
            recipe['steps'].insert(0, {'id':'flip0','diagramStep':'0','op':'flip','axis':axis,'instruction':'返す'})
            recipe['steps'].append({'id':'flip9','diagramStep':'9','op':'flip','axis':axis,'instruction':'戻す'})
            verify_playback(compile_playback(recipe))
        data=compile_playback(fixture('suika2'))
        self.assertEqual([s['op'] for s in data['steps']], ['crease','fold','flip','fold','fold','flip'])
        self.assertEqual(data['frames'][2]['boneAngles'],data['frames'][3]['boneAngles'])
        self.assertEqual(data['frames'][5]['boneAngles'],data['frames'][6]['boneAngles'])

    def test_corruptions_rejected(self):
        original = compile_playback(fixture('lion'))
        mutations = [
            lambda d: d['frames'][-1]['boneAngles'].__setitem__(1, 0.3),
            lambda d: d['frames'][1]['recordedCreases'].clear(),
            lambda d: d['frames'][-1]['faceStates'][0].__setitem__('layerRank',999),
            lambda d: d['frames'][-1]['faceStates'][0].__setitem__('faceId','missing'),
            lambda d: d['steps'][-1]['targetFaceIndices'].clear(),
            lambda d: d['recipe']['source'].__setitem__('note','lost attribution'),
            lambda d: d['frames'][-1]['bodyPose'][0].__setitem__(0,-1),
            lambda d: d['mesh']['panel'].__setitem__(0,999),
            lambda d: d['faces'][0]['triangleIds'].clear(),
        ]
        for mutate in mutations:
            data=copy.deepcopy(original); mutate(data)
            with self.assertRaises(RecipeError): verify_playback(data)
        # +/- pi have the same endpoint: only the midpoint direction catches this.
        data=copy.deepcopy(original)
        for b in data['steps'][-1]['boneIds']:
            data['frames'][-1]['boneAngles'][b] *= -1
        data['steps'][-1]['targetAngles']=[data['frames'][-1]['boneAngles'][b] for b in data['steps'][-1]['boneIds']]
        with self.assertRaisesRegex(RecipeError, 'direction'): verify_playback(data)

    def test_cli_no_overwrite_and_tools_only(self):
        source=HERE/'recipe_examples/lion.origami.json'
        with tempfile.TemporaryDirectory(dir=HERE) as temp:
            target=Path(temp)/'sample.json'
            command=[sys.executable,'-B',str(HERE/'origami_playback.py'),str(source),'--output',str(target)]
            subprocess.run(command,check=True,capture_output=True)
            original=target.read_bytes()
            self.assertNotEqual(subprocess.run(command,capture_output=True).returncode,0)
            self.assertEqual(target.read_bytes(),original)
            command[-1]=str(HERE.parent/'js/works/proto_lion_v1.js')
            self.assertNotEqual(subprocess.run(command,capture_output=True).returncode,0)


if __name__=='__main__': unittest.main()
