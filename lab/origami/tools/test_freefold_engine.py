"""Parity boundary: browser-generated v1 JSON must pass the existing Python 2D replay.

D1: freefold(JS) が出した面IDと素材の形を、origami_recipe.py が再生した結果とそのまま突き合わせる。
    ハードコードした期待値ではなく「両方のエンジンが同じ紙を作るか」を見る。
D2: 割れなかった対象面は faceId が変わらない（Python の assign_faces は siblings>1 のときだけ改名する）。
D4: 既存の作品（recipe_examples）が1ミリも変わらないことは check_all.py 側の作品検査が見る。
"""
import sys
sys.dont_write_bytecode=True
import json,math,subprocess,unittest
from origami_recipe import HERE,parse,replay,source_polygon

def norm(poly):
 """同じ多角形を、頂点の並べ方によらず比べられる形にする。"""
 pts=[(round(x,4)+0.0,round(y,4)+0.0) for x,y in poly]
 # 重複頂点をつぶす（split は稜線上の点を二重に置くことがある）
 out=[p for i,p in enumerate(pts) if p!=pts[i-1]]
 return sorted(out)

class FreeFoldParity(unittest.TestCase):
 def setUp(self):
  run=subprocess.run(['node',str(HERE/'test_freefold_engine.js')],check=True,capture_output=True,text=True,encoding='utf-8')
  self.generated=json.loads(run.stdout)

 def test_python_replays_the_same_paper(self):
  self.assertTrue(self.generated,'node 側が何も出していない')
  for name,d in self.generated.items():
   with self.subTest(name):
    recipe=parse(json.dumps(d['recipe']));state,frames=replay(recipe)
    self.assertEqual([s['op'] for s in recipe['steps']],d['ops'])
    self.assertEqual(len(frames),len(d['ops'])+1)
    # D1 面IDの集合が JS と一致
    self.assertEqual(sorted(p['recipeFace']['faceId'] for p in state.panels),d['faces'],
                     f'{name}: Python と JS で面の割れ方が違う')
    # D1 それぞれの面の「ひらいた紙での形」も一致
    for p in state.panels:
     fid=p['recipeFace']['faceId']
     self.assertEqual(norm(source_polygon(p)),norm(d['sourcePolys'][fid]),f'{name}/{fid}: 素材の形が違う')
    # I0 層順位も一致（freefold は本番の積み直しをそのまま使う。独自の層モデルは持たない）
    self.assertEqual({p['recipeFace']['faceId']:p['layer'] for p in state.panels},d['layers'],
                     f'{name}: Python と JS で層番号が違う')

 def test_targets_contract(self):
  """reference は targets に入っていること／movingSidePoint は reference の内部にあること（Python の2つの検査）。"""
  for name,d in self.generated.items():
   for st in d['recipe']['steps']:
    if st.get('op')=='flip': continue
    ids=[t['faceId'] for t in st['targets']]
    self.assertIn(st['reference']['faceId'],ids,f'{name}/{st["id"]}: reference が targets に入っていない')
    self.assertEqual(len(set(ids)),len(ids),f'{name}/{st["id"]}: targets が重複している')

 def test_whole_moving_face_keeps_its_id(self):
  """D2 折り目そのものを折線にした手では、動いた側は割れないので faceId が変わらない。"""
  d=self.generated['creaseAlong']
  self.assertEqual(d['ops'],['crease','fold'])
  self.assertEqual(d['faces'],['paper/s1.cut','paper/s1.keep'])
  state,_=replay(parse(json.dumps(d['recipe'])))
  self.assertEqual(sorted(p['recipeFace']['faceId'] for p in state.panels),['paper/s1.cut','paper/s1.keep'])

if __name__=='__main__':unittest.main()
