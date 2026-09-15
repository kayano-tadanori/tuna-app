"""A2 publisher contract tests."""
import sys
sys.dont_write_bytecode=True
import copy,json,unittest
from origami_recipe import HERE,parse,RecipeError
from origami_playback import compile_playback
from to_playback_work import runtime_work,js_source

class WorkTests(unittest.TestCase):
 def setUp(self):
  self.data=compile_playback(parse((HERE/'recipe_examples/lion.origami.json').read_text(encoding='utf-8')))
  self.work=runtime_work(self.data,'proto_lion_v1')
 def test_identity_and_all_source_information(self):
  self.assertEqual(self.work['id'],'proto_lion_v1');self.assertNotEqual(self.work['id'],'lion')
  self.assertEqual(self.work['recipePlayback']['recipe'],self.data['recipe'])
  self.assertEqual([s['op'] for s in self.work['steps']],['crease','crease','fold','fold','fold','fold'])
  self.assertTrue(all(s['creaseLines'] for s in self.work['steps']))
 def test_face_layers_and_colors(self):
  self.assertEqual(len(self.work['mesh']['panel2']),len(self.work['mesh']['verts']))
  self.assertEqual(set(self.work['mesh']['panel2']),set(range(len(self.data['faces']))))
  self.assertEqual(self.work['colorDown'],self.data['recipe']['paper']['colorDown'])
  self.assertEqual(len(self.data['frames'][-1]['bodyLayerRanks']),len(self.data['faces']))
 def test_safe_javascript(self):
  text=js_source(self.work)
  self.assertIn('duplicate origami work id',text);self.assertIn('proto_lion_v1',text)
  self.assertNotIn('ORIGAMI_WORKS.lion =',text)
 def test_nonprototype_rejected(self):
  with self.assertRaises(RecipeError):runtime_work(self.data,'lion')
  flip=compile_playback(parse((HERE/'recipe_examples/suika2.origami.json').read_text(encoding='utf-8')))
  with self.assertRaisesRegex(RecipeError,'A3'):runtime_work(flip,'proto_suika2_v1')

if __name__=='__main__':unittest.main()
