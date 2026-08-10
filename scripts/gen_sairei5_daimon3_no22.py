# -*- coding: utf-8 -*-
"""小5最レ第3分冊 No.22 の大問（第1講座「角度の問題」16問＋第2講座「速さ(4)」16問）を
hama_daimon.json の grades.5.sairei.kouza1["22"]/kouza2["22"] に書き起こす。
原簿どおりに置く。数値替えの類題は作らない。

使い方: python scripts/gen_sairei5_daimon3_no22.py --write
"""
import io, json, os, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

ZU = "zu"
HAYASA = "hayasa"

# ── 第1講座 No.22「角度の問題」HG-3638〜3653 ──────────────────────
# すべて category=zu, unit=平面図形（角度）（例外なし）
KOUZA1 = [
  {
    "id": "hd5s_22k1_1", "category": ZU, "unit": "平面図形（角度）",
    "title": "平行線とジグザグ",
    "intro": "次の図で、直線ℓとmは平行です。折れ点ごとに平行な補助線を引くと、角を分けて考えることができます。xの値を求めなさい。",
    "star": 1, "hg": "HG-3638",
    "svg": "<svg viewBox=\"0 0 600 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"20\" y1=\"30\" x2=\"280\" y2=\"30\" stroke=\"#888\" stroke-width=\"3\"/><line x1=\"20\" y1=\"190\" x2=\"280\" y2=\"190\" stroke=\"#888\" stroke-width=\"3\"/><text x=\"14\" y=\"34\" font-size=\"14\">l</text><text x=\"14\" y=\"194\" font-size=\"14\">m</text><path d=\"M60,30 L160,90 L120,150 L200,190\" stroke=\"#e63946\" stroke-width=\"2\" fill=\"none\"/><circle cx=\"60\" cy=\"30\" r=\"4\"/><circle cx=\"160\" cy=\"90\" r=\"4\"/><circle cx=\"120\" cy=\"150\" r=\"4\"/><circle cx=\"200\" cy=\"190\" r=\"4\"/><text x=\"70\" y=\"50\" font-size=\"15\">60°</text><text x=\"168\" y=\"85\" font-size=\"15\">100°</text><text x=\"95\" y=\"170\" font-size=\"15\">x</text><text x=\"205\" y=\"205\" font-size=\"15\">50°</text><text x=\"150\" y=\"12\" font-size=\"14\" text-anchor=\"middle\">(1)</text><line x1=\"340\" y1=\"30\" x2=\"600\" y2=\"30\" stroke=\"#888\" stroke-width=\"3\"/><line x1=\"340\" y1=\"190\" x2=\"600\" y2=\"190\" stroke=\"#888\" stroke-width=\"3\"/><text x=\"334\" y=\"34\" font-size=\"14\">l</text><text x=\"334\" y=\"194\" font-size=\"14\">m</text><path d=\"M380,30 L480,90 L440,150 L520,190\" stroke=\"#1d3557\" stroke-width=\"2\" fill=\"none\"/><circle cx=\"380\" cy=\"30\" r=\"4\"/><circle cx=\"480\" cy=\"90\" r=\"4\"/><circle cx=\"440\" cy=\"150\" r=\"4\"/><circle cx=\"520\" cy=\"190\" r=\"4\"/><text x=\"388\" y=\"50\" font-size=\"15\">30°</text><text x=\"488\" y=\"80\" font-size=\"14\">120°</text><text x=\"415\" y=\"170\" font-size=\"15\">x</text><text x=\"525\" y=\"205\" font-size=\"15\">45°</text><text x=\"470\" y=\"12\" font-size=\"14\" text-anchor=\"middle\">(2)</text></svg>",
    "steps": [
      {"question": "図(1)のように、ℓから60°の方向に進み、途中100°で折れ曲がり、最後にmと50°の角度で交わるとき、xの値を求めなさい。",
       "answer": "90",
       "meaning": "①各折れ点に、ℓ・mと平行な補助線を引いて角を分ける。②60°の角は60°と40°に分かれ、100°の角の下側は40°と50°に分かれる。③x＝40+50＝90。"},
      {"question": "図(2)のように、ℓから30°の方向に進み、途中120°で折れ曲がり、最後にmと45°の角度で交わるとき、xの値を求めなさい。",
       "answer": "135",
       "meaning": "①各折れ点に平行な補助線を引く。②30°の角は30°と90°に分かれ、90°の角はさらに90°と45°に分かれる。③x＝90+45＝135。"},
    ],
  },
  {
    "id": "hd5s_22k1_2", "category": ZU, "unit": "平面図形（角度）",
    "title": "平行線と正六角形",
    "intro": "右の図で、直線ℓとmは平行で、六角形ABCDEFは正六角形です。xの値を求めなさい。",
    "star": 1, "hg": "HG-3639",
    "svg": "<svg viewBox=\"0 0 300 260\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"20\" y1=\"60\" x2=\"280\" y2=\"60\" stroke=\"#888\" stroke-width=\"3\"/><line x1=\"20\" y1=\"210\" x2=\"280\" y2=\"210\" stroke=\"#888\" stroke-width=\"3\"/><text x=\"10\" y=\"64\" font-size=\"14\">l</text><text x=\"10\" y=\"214\" font-size=\"14\">m</text><polygon points=\"150,60 215,97 215,172 150,210 85,172 85,97\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"150\" y=\"50\" font-size=\"13\" text-anchor=\"middle\">A</text><text x=\"225\" y=\"97\" font-size=\"13\">B</text><text x=\"225\" y=\"180\" font-size=\"13\">C</text><text x=\"150\" y=\"228\" font-size=\"13\" text-anchor=\"middle\">D</text><text x=\"65\" y=\"180\" font-size=\"13\">E</text><text x=\"65\" y=\"97\" font-size=\"13\">F</text><text x=\"155\" y=\"75\" font-size=\"14\">40°</text><text x=\"150\" y=\"200\" font-size=\"15\" text-anchor=\"middle\">x</text></svg>",
    "steps": [
      {"question": "六角形ABCDEFは正六角形で、頂点Aのところの角が40°であるとき、xの値を求めなさい。",
       "answer": "20",
       "meaning": "①正六角形の1つの内角は120°で、60°ずつに分けられる。②平行線の間の角の和は180°になるので、40+60+60+x＝180。③x＝20。"},
    ],
  },
  {
    "id": "hd5s_22k1_3", "category": ZU, "unit": "平面図形（角度）",
    "title": "平行線と階段状の折れ線",
    "intro": "次の図で、直線ABと直線CDは平行です。xの値を求めなさい。",
    "star": 1, "hg": "HG-3640",
    "svg": "<svg viewBox=\"0 0 320 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"20\" y1=\"30\" x2=\"300\" y2=\"30\" stroke=\"#888\" stroke-width=\"3\"/><line x1=\"20\" y1=\"190\" x2=\"300\" y2=\"190\" stroke=\"#888\" stroke-width=\"3\"/><text x=\"12\" y=\"26\" font-size=\"14\">A</text><text x=\"292\" y=\"26\" font-size=\"14\">B</text><text x=\"12\" y=\"205\" font-size=\"14\">C</text><text x=\"292\" y=\"205\" font-size=\"14\">D</text><path d=\"M60,30 L140,70 L100,120 L180,160 L220,190\" stroke=\"#e63946\" stroke-width=\"2\" fill=\"none\"/><circle cx=\"60\" cy=\"30\" r=\"4\"/><circle cx=\"140\" cy=\"70\" r=\"4\"/><circle cx=\"100\" cy=\"120\" r=\"4\"/><circle cx=\"180\" cy=\"160\" r=\"4\"/><circle cx=\"220\" cy=\"190\" r=\"4\"/><text x=\"68\" y=\"50\" font-size=\"14\">135°</text><text x=\"145\" y=\"65\" font-size=\"14\">100°</text><text x=\"150\" y=\"150\" font-size=\"14\">90°</text><text x=\"228\" y=\"205\" font-size=\"15\">x</text></svg>",
    "steps": [
      {"question": "A—B間で135°、100°、90°の順に折れ曲がってC—Dまで進むとき、xの値を求めなさい。",
       "answer": "125",
       "meaning": "①各折れ点にABとCDに平行な補助線を引くと、45°/55°/35°の角に分かれる。②x＝90+35＝125。"},
    ],
  },
  {
    "id": "hd5s_22k1_4", "category": ZU, "unit": "平面図形（角度）",
    "title": "三角形の外角",
    "intro": "次の角xの大きさを求めなさい。三角形の外角は、となり合わない2つの内角の和に等しくなります。",
    "star": 1, "hg": "HG-3641",
    "svg": "<svg viewBox=\"0 0 580 220\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"40,180 220,180 130,60\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><line x1=\"220\" y1=\"180\" x2=\"280\" y2=\"180\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"55\" y=\"175\" font-size=\"14\">60°</text><text x=\"118\" y=\"82\" font-size=\"14\">50°</text><text x=\"232\" y=\"175\" font-size=\"16\">x</text><text x=\"140\" y=\"20\" font-size=\"14\" text-anchor=\"middle\">(1)</text><polygon points=\"340,180 500,180 460,60\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><line x1=\"300\" y1=\"180\" x2=\"340\" y2=\"180\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"303\" y=\"172\" font-size=\"13\">70°</text><text x=\"465\" y=\"175\" font-size=\"14\">50°</text><text x=\"445\" y=\"82\" font-size=\"16\">x</text><text x=\"420\" y=\"20\" font-size=\"14\" text-anchor=\"middle\">(2)</text></svg>",
    "steps": [
      {"question": "三角形の2つの内角が60°と50°であるとき、これらのとなり合わない外角xの大きさを求めなさい。",
       "answer": "110",
       "meaning": "①外角は、となり合わない2つの内角の和に等しい。②x＝60+50＝110度。"},
      {"question": "三角形の外角が70°で、それととなり合わない1つの内角が50°であるとき、もう1つの内角xの大きさを求めなさい。",
       "answer": "20",
       "meaning": "①外角＝となり合わない2つの内角の和なので、70＝x+50。②x＝20度。"},
    ],
  },
  {
    "id": "hd5s_22k1_5", "category": ZU, "unit": "平面図形（角度）",
    "title": "ブーメラン型の角",
    "intro": "次の角xの大きさを求めなさい。",
    "star": 1, "hg": "HG-3642",
    "svg": "<svg viewBox=\"0 0 560 220\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"120,50 210,170 110,120 40,170\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"115\" y=\"40\" font-size=\"14\" text-anchor=\"middle\">60°</text><text x=\"50\" y=\"165\" font-size=\"14\">40°</text><text x=\"200\" y=\"165\" font-size=\"14\">20°</text><text x=\"115\" y=\"135\" font-size=\"16\">x</text><text x=\"130\" y=\"18\" font-size=\"14\" text-anchor=\"middle\">(1)</text><polygon points=\"340,170 520,170 430,50\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><line x1=\"430\" y1=\"50\" x2=\"470\" y2=\"170\" stroke=\"#333\" stroke-width=\"1.5\" stroke-dasharray=\"4,3\"/><text x=\"350\" y=\"163\" font-size=\"14\">30°</text><text x=\"495\" y=\"163\" font-size=\"14\">20°</text><text x=\"440\" y=\"90\" font-size=\"14\">70°</text><text x=\"460\" y=\"120\" font-size=\"16\">x</text><text x=\"430\" y=\"18\" font-size=\"14\" text-anchor=\"middle\">(2)</text></svg>",
    "steps": [
      {"question": "図(1)のようなブーメラン型（へこんだ四角形）で、3つの角がそれぞれ60°、40°、20°であるとき、へこみの角xの大きさを求めなさい。",
       "answer": "120",
       "meaning": "①へこんだ四角形のへこみの角は、他の3つの角の和に等しい。②x＝60+40+20＝120度。"},
      {"question": "図(2)のように三角形の中を補助線が通っていて、3つの角が30°、70°、20°であるとき、xの大きさを求めなさい。",
       "answer": "60",
       "meaning": "①三角形の内角の和は180°。②x＝180−(30+70+20)＝60度。"},
    ],
  },
  {
    "id": "hd5s_22k1_6", "category": ZU, "unit": "平面図形（角度）",
    "title": "正三角形と正五角形の重なり",
    "intro": "下の図で、三角形ABCは正三角形で、五角形DEFGHは正五角形です。角xの大きさを求めなさい。",
    "star": 2, "hg": "HG-3643",
    "svg": "<svg viewBox=\"0 0 300 300\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"150,30 30,260 270,260\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"150\" y=\"18\" font-size=\"14\" text-anchor=\"middle\">A</text><text x=\"18\" y=\"272\" font-size=\"14\">B</text><text x=\"272\" y=\"272\" font-size=\"14\">C</text><polygon points=\"150,130 197,163 179,220 121,220 103,163\" fill=\"none\" stroke=\"#e63946\" stroke-width=\"2\"/><text x=\"150\" y=\"122\" font-size=\"12\" text-anchor=\"middle\">D</text><text x=\"205\" y=\"163\" font-size=\"12\">E</text><text x=\"185\" y=\"236\" font-size=\"13\">F(15°)</text><text x=\"98\" y=\"236\" font-size=\"12\">G</text><text x=\"78\" y=\"163\" font-size=\"12\">H</text><text x=\"90\" y=\"175\" font-size=\"15\">x</text></svg>",
    "steps": [
      {"question": "三角形ABCは正三角形、五角形DEFGHは正五角形で、角Fが15°であるとき、角xの大きさを求めなさい。",
       "answer": "33",
       "meaning": "①正五角形の1つの内角は108°。②正三角形の60°の角を利用すると、108＝15+60+xの関係が成り立つ。③x＝33度。"},
    ],
  },
  {
    "id": "hd5s_22k1_7", "category": ZU, "unit": "平面図形（角度）",
    "title": "二等辺三角形の連鎖①",
    "intro": "次の問いに答えなさい。等しい辺から等しい角が次々に決まります。すべての角を①や②のような比の形で表すと、三角形の内角の和から1本の式が立てられます。",
    "star": 3, "hg": "HG-3644",
    "svg": "<svg viewBox=\"0 0 300 260\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"150,30 40,220 260,220\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"150\" y=\"18\" font-size=\"14\" text-anchor=\"middle\">A</text><text x=\"25\" y=\"235\" font-size=\"14\">B</text><text x=\"265\" y=\"235\" font-size=\"14\">C</text><circle cx=\"95\" cy=\"125\" r=\"4\" fill=\"#e63946\"/><line x1=\"150\" y1=\"30\" x2=\"95\" y2=\"125\" stroke=\"#333\" stroke-width=\"1.5\"/><line x1=\"95\" y1=\"125\" x2=\"40\" y2=\"220\" stroke=\"#333\" stroke-width=\"1.5\"/><line x1=\"95\" y1=\"125\" x2=\"260\" y2=\"220\" stroke=\"#333\" stroke-width=\"1.5\"/><text x=\"75\" y=\"118\" font-size=\"13\">D</text><text x=\"150\" y=\"250\" font-size=\"12\" text-anchor=\"middle\">DA＝DB＝BC、AB＝AC</text></svg>",
    "steps": [
      {"question": "図で、DA＝DB＝BC、AB＝ACのとき、角Aは何度ですか。",
       "answer": "36",
       "meaning": "①DA＝DBより二等辺三角形なので、角DAB＝角DBAを①とおける。②DB＝BCより角BDC＝角BCDが決まり、外角の関係から角Aの2倍の②とおける。③三角形の内角の和より①+②+②＝180。④①＝36度。"},
    ],
  },
  {
    "id": "hd5s_22k1_8", "category": ZU, "unit": "平面図形（角度）",
    "title": "二等辺三角形の連鎖②",
    "intro": "次の問いに答えなさい。大問7と同じ考え方を、もう1段深く使います。答えが分数の角度になってもかまいません。",
    "star": 3, "hg": "HG-3645",
    "svg": "<svg viewBox=\"0 0 320 260\" xmlns=\"http://www.w3.org/2000/svg\"><text x=\"160\" y=\"20\" font-size=\"14\" text-anchor=\"middle\">A</text><circle cx=\"160\" cy=\"30\" r=\"3\"/><polyline points=\"70,220 120,150 180,150 250,220\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><line x1=\"160\" y1=\"30\" x2=\"70\" y2=\"220\" stroke=\"#888\" stroke-width=\"1\"/><line x1=\"160\" y1=\"30\" x2=\"120\" y2=\"150\" stroke=\"#888\" stroke-width=\"1\"/><line x1=\"160\" y1=\"30\" x2=\"180\" y2=\"150\" stroke=\"#888\" stroke-width=\"1\"/><line x1=\"160\" y1=\"30\" x2=\"250\" y2=\"220\" stroke=\"#888\" stroke-width=\"1\"/><text x=\"55\" y=\"235\" font-size=\"13\">B</text><text x=\"110\" y=\"145\" font-size=\"13\">C</text><text x=\"185\" y=\"145\" font-size=\"13\">D</text><text x=\"255\" y=\"235\" font-size=\"13\">E</text><text x=\"160\" y=\"60\" font-size=\"14\" text-anchor=\"middle\">x（角A）</text><text x=\"160\" y=\"255\" font-size=\"12\" text-anchor=\"middle\">AB＝BC＝DC＝DE、AD＝AE</text></svg>",
    "steps": [
      {"question": "図で、AB＝BC＝DC＝DE、AD＝AEのとき、角Aは何度ですか。",
       "answer": "25と5/7",
       "meaning": "①大問7と同じように、辺の等しさから角を①に置きかえていく。②連鎖が1段深くなるので、内角の和の式は⑦＝180になる。③①＝25と5/7度。"},
    ],
  },
  {
    "id": "hd5s_22k1_9", "category": ZU, "unit": "平面図形（角度）",
    "title": "二等辺三角形の連鎖③",
    "intro": "次の問いに答えなさい。",
    "star": 3, "hg": "HG-3646",
    "svg": "<svg viewBox=\"0 0 400 200\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"30,170 370,170 200,20\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"20\" y=\"185\" font-size=\"14\">A</text><text x=\"375\" y=\"185\" font-size=\"14\">B</text><text x=\"200\" y=\"14\" font-size=\"14\" text-anchor=\"middle\">O</text><polyline points=\"30,170 90,100 150,120 210,80 270,110 330,90 370,170\" fill=\"none\" stroke=\"#e63946\" stroke-width=\"1.5\"/><text x=\"200\" y=\"55\" font-size=\"15\" text-anchor=\"middle\">x</text><text x=\"200\" y=\"195\" font-size=\"12\" text-anchor=\"middle\">OA＝OB、同じ印の辺はすべて等しい</text></svg>",
    "steps": [
      {"question": "図で、OA＝OBで、同じ印の辺はすべて長さが等しいとき、角Oは何度ですか。",
       "answer": "20",
       "meaning": "①大問7・8と同じように、辺の等しさから角を①に置きかえていく。②この図では内角の和の式が⑨＝180になる（最も長い連鎖）。③①＝20度。"},
    ],
  },
  {
    "id": "hd5s_22k1_10", "category": ZU, "unit": "平面図形（角度）",
    "title": "正方形と正三角形",
    "intro": "次のそれぞれの図で角x、yの大きさを求めなさい。正方形の90°と正三角形の60°の差である30°の角をはさむ2辺が等しくなることに注目します。",
    "star": 2, "hg": "HG-3647",
    "svg": "<svg viewBox=\"0 0 600 260\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"40\" y=\"40\" width=\"140\" height=\"140\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"30\" y=\"35\" font-size=\"13\">A</text><text x=\"185\" y=\"35\" font-size=\"13\">D</text><text x=\"30\" y=\"195\" font-size=\"13\">B</text><text x=\"185\" y=\"195\" font-size=\"13\">C</text><polygon points=\"110,110 180,110 145,180\" fill=\"none\" stroke=\"#e63946\" stroke-width=\"1.5\"/><text x=\"150\" y=\"105\" font-size=\"12\">E</text><text x=\"90\" y=\"150\" font-size=\"14\">x</text><text x=\"160\" y=\"165\" font-size=\"14\">y</text><text x=\"110\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(1) 正方形ABCD＋正三角形BCE</text><rect x=\"380\" y=\"40\" width=\"140\" height=\"140\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"370\" y=\"35\" font-size=\"13\">A</text><text x=\"525\" y=\"35\" font-size=\"13\">D</text><text x=\"370\" y=\"195\" font-size=\"13\">B</text><text x=\"525\" y=\"195\" font-size=\"13\">C</text><polygon points=\"450,180 520,180 485,250\" fill=\"none\" stroke=\"#1d3557\" stroke-width=\"1.5\"/><text x=\"490\" y=\"245\" font-size=\"12\">F</text><text x=\"430\" y=\"220\" font-size=\"14\">x</text><text x=\"500\" y=\"165\" font-size=\"14\">y</text><text x=\"450\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(2) 正方形ABCD＋正三角形DCF（外側）</text></svg>",
    "steps": [
      {"question": "四角形ABCDは正方形、三角形BCEは正三角形です（Eは正方形の内側）。角xと角yの大きさを求めなさい。",
       "answer": "x＝75度、y＝105度",
       "choices": ["x＝75度、y＝105度", "x＝30度、y＝150度", "x＝75度、y＝150度", "x＝60度、y＝120度"],
       "meaning": "①正方形の90°から正三角形の60°を引いた30°の角をはさむ2辺は長さが等しいので二等辺三角形ができる。②x×2+30＝180よりx＝75度。③y+75＝180よりy＝105度。"},
      {"question": "四角形ABCDは正方形、三角形DCFは正三角形です（Fは正方形の外側）。角xと角yの大きさを求めなさい。",
       "answer": "x＝15度、y＝105度",
       "choices": ["x＝15度、y＝105度", "x＝30度、y＝120度", "x＝15度、y＝75度", "x＝45度、y＝105度"],
       "meaning": "①同じように90−60＝30の角をはさむ二等辺三角形ができるが、正三角形が外側にあるのでx×2+150＝180よりx＝15度。②y＝15+90＝105度。"},
    ],
  },
  {
    "id": "hd5s_22k1_11", "category": ZU, "unit": "平面図形（角度）",
    "title": "長方形のテープの折り返し",
    "intro": "次のそれぞれの図は、長方形のテープを折り曲げたものです。角xの大きさを求めなさい。折り返すと同じ角が2つでき、平行な辺の間では錯角も使えます。",
    "star": 2, "hg": "HG-3648",
    "svg": "<svg viewBox=\"0 0 560 200\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"30,60 220,60 180,140 30,140\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><line x1=\"140\" y1=\"60\" x2=\"180\" y2=\"140\" stroke=\"#e63946\" stroke-width=\"2\" stroke-dasharray=\"5,3\"/><text x=\"150\" y=\"55\" font-size=\"13\">52°</text><text x=\"190\" y=\"120\" font-size=\"15\">x</text><text x=\"120\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(1)</text><polygon points=\"330,60 520,60 470,140 330,140\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><line x1=\"430\" y1=\"60\" x2=\"470\" y2=\"140\" stroke=\"#1d3557\" stroke-width=\"2\" stroke-dasharray=\"5,3\"/><text x=\"440\" y=\"55\" font-size=\"13\">130°</text><text x=\"480\" y=\"120\" font-size=\"15\">x</text><text x=\"420\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(2)</text></svg>",
    "steps": [
      {"question": "図(1)のように長方形のテープを折り曲げ、折り返した部分の角が52°であるとき、角xの大きさを求めなさい。",
       "answer": "104",
       "meaning": "①折り返すと52°と同じ大きさの角がもう1つできる。②長方形の対辺は平行なので、錯角を使うと38°の角が2つできる。③38×2+x＝180なのでx＝104度。"},
      {"question": "図(2)のように長方形のテープを折り曲げ、折り返した部分の角が130°であるとき、角xの大きさを求めなさい。",
       "answer": "65",
       "meaning": "①折り目を境に130°の角と同じ角ができる。②錯角を使うと、xと同じ大きさの角が2つできる。③x+x＝130なのでx＝65度。"},
    ],
  },
  {
    "id": "hd5s_22k1_12", "category": ZU, "unit": "平面図形（角度）",
    "title": "三角形の回転",
    "intro": "三角形ABCを図のようにAを中心に回転させました。角xの大きさを求めなさい。",
    "star": 2, "hg": "HG-3649",
    "svg": "<svg viewBox=\"0 0 320 260\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"60,220 200,220 130,80\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"45\" y=\"235\" font-size=\"13\">B</text><text x=\"205\" y=\"235\" font-size=\"13\">C</text><text x=\"130\" y=\"70\" font-size=\"13\" text-anchor=\"middle\">A</text><polygon points=\"60,220 260,150 220,60\" fill=\"none\" stroke=\"#e63946\" stroke-width=\"1.5\" stroke-dasharray=\"4,3\"/><text x=\"265\" y=\"150\" font-size=\"13\">C'</text><text x=\"222\" y=\"55\" font-size=\"13\">B'</text><text x=\"150\" y=\"150\" font-size=\"14\">50°</text><text x=\"140\" y=\"100\" font-size=\"14\">20°</text><text x=\"90\" y=\"200\" font-size=\"16\">x</text></svg>",
    "steps": [
      {"question": "三角形ABCをAを中心に回転させたところ、対応する辺のつくる角が50°と20°になりました。角xの大きさを求めなさい。",
       "answer": "40",
       "meaning": "①回転させても形は変わらないので、対応する辺の長さは等しく、二等辺三角形ができる。②x＝180−(20+50)×2＝40度。"},
    ],
  },
  {
    "id": "hd5s_22k1_13", "category": ZU, "unit": "平面図形（角度）",
    "title": "印を文字におきかえる消去算",
    "intro": "次のそれぞれの図で、同じ印の角度はそれぞれ等しい大きさを表すものとして、x、yの大きさを求めなさい。印を文字におきかえて2本の式を立て、消去算で解きます。",
    "star": 3, "hg": "HG-3650",
    "svg": "<svg viewBox=\"0 0 600 260\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"150,40 40,220 260,220\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"60\" y=\"150\" font-size=\"14\">○○×</text><text x=\"180\" y=\"150\" font-size=\"14\">102°</text><text x=\"150\" y=\"235\" font-size=\"14\" text-anchor=\"middle\">x, y</text><text x=\"150\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(1)</text><rect x=\"360\" y=\"40\" width=\"180\" height=\"140\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"365\" y=\"35\" font-size=\"13\">○×</text><text x=\"500\" y=\"35\" font-size=\"13\">126°</text><text x=\"365\" y=\"195\" font-size=\"13\">○△</text><text x=\"500\" y=\"195\" font-size=\"13\">×▲</text><text x=\"450\" y=\"120\" font-size=\"14\" text-anchor=\"middle\">x, y</text><text x=\"450\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(2)</text></svg>",
    "steps": [
      {"question": "図(1)の三角形で、同じ印の角度はそれぞれ等しい大きさを表します。○が2つと×が1つ分の角と102°の角を合わせると一直線（180°）になり、○が1つと×が2つ分の角の大きさは60°です。xとyの大きさを求めなさい。",
       "answer": "x＝88度、y＝134度",
       "choices": ["x＝88度、y＝134度", "x＝78度、y＝146度", "x＝88度、y＝146度", "x＝92度、y＝134度"],
       "meaning": "①○○×＋102＝180より○○×＝78。②○××＝60。③2本の式を消去算で解くと○＝32、×＝14。④x＝180−(32×2+14×2)＝88度。⑤y＝180−(32+14)＝134度。"},
      {"question": "図(2)の四角形で、同じ印の角度はそれぞれ等しい大きさを表します。○が1つと×が1つ分の角と126°の角を合わせると一直線（180°）になります。また、○が2つと△が2つ分の角の和は180°、×が2つと▲が2つ分の角の和も180°です。xとyの大きさを求めなさい。",
       "answer": "x＝72度、y＝54度",
       "choices": ["x＝72度、y＝54度", "x＝54度、y＝72度", "x＝72度、y＝108度", "x＝36度、y＝54度"],
       "meaning": "①○＋×＋126＝180より○×の和は54。②三角形の内角の和からx＝180−54×2＝72度。③○○△△＝180より○△＝90、××▲▲＝180より×▲＝90。④四角形の内角の和360から126・90・90を引くとy＝360−(90+126+90)＝54度。"},
    ],
  },
  {
    "id": "hd5s_22k1_14", "category": ZU, "unit": "平面図形（角度）",
    "title": "正方形と二等辺三角形の連鎖",
    "intro": "次のそれぞれの図で角xの大きさを求めなさい。等しい辺をたどって、二等辺三角形（正三角形をふくむ）を見つけます。",
    "star": 3, "hg": "HG-3651",
    "svg": "<svg viewBox=\"0 0 600 260\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"40\" y=\"40\" width=\"150\" height=\"150\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"30\" y=\"35\" font-size=\"13\">A</text><text x=\"195\" y=\"35\" font-size=\"13\">D</text><text x=\"30\" y=\"205\" font-size=\"13\">B</text><text x=\"195\" y=\"205\" font-size=\"13\">C</text><circle cx=\"115\" cy=\"150\" r=\"4\" fill=\"#e63946\"/><text x=\"120\" y=\"145\" font-size=\"12\">E</text><circle cx=\"80\" cy=\"190\" r=\"4\" fill=\"#1d3557\"/><text x=\"60\" y=\"205\" font-size=\"12\">G</text><text x=\"90\" y=\"170\" font-size=\"12\">30°</text><text x=\"130\" y=\"230\" font-size=\"15\">x</text><text x=\"115\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(1) 正方形ABCD</text><polygon points=\"400,50 550,90 500,200 380,180\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"395\" y=\"45\" font-size=\"12\">60°</text><text x=\"555\" y=\"90\" font-size=\"12\">55°</text><text x=\"505\" y=\"215\" font-size=\"12\">10°</text><text x=\"360\" y=\"180\" font-size=\"12\">30°</text><text x=\"450\" y=\"130\" font-size=\"15\">x</text><text x=\"460\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">(2)</text></svg>",
    "steps": [
      {"question": "四角形ABCDは正方形です。図のように点E、Gがあり、30°の角が2つ示されています。角xの大きさを求めなさい。",
       "answer": "165",
       "meaning": "①三角形AEDは二等辺三角形なので、AE＝AD＝AB。②AE＝ABより三角形AEBも二等辺三角形になる。③底角☆＝(180−30)÷2＝75度。④x＝90+75＝165度。"},
      {"question": "図の四角形ABCDで、60°、55°、10°、30°の角が示されています。角xの大きさを求めなさい。",
       "answer": "35",
       "meaning": "①角度を書き込むと、三角形BCDと三角形BCAはどちらも二等辺三角形になる。②三角形ABDは1つの角が60°の二等辺三角形なので正三角形とわかり、☆＝60度。③x＝180−(60+85)＝35度。"},
    ],
  },
  {
    "id": "hd5s_22k1_15", "category": ZU, "unit": "平面図形（角度）",
    "title": "正三角形・正方形と合同",
    "intro": "次の問いに答えなさい。回転させると重なる合同な三角形を見つけます。",
    "star": 3, "hg": "HG-3652",
    "svg": "<svg viewBox=\"0 0 600 260\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"150,40 60,200 240,200\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><polygon points=\"150,40 100,150 220,130\" fill=\"none\" stroke=\"#e63946\" stroke-width=\"1.5\"/><text x=\"150\" y=\"30\" font-size=\"13\" text-anchor=\"middle\">A</text><text x=\"45\" y=\"215\" font-size=\"13\">B/D</text><text x=\"245\" y=\"215\" font-size=\"13\">C/E</text><text x=\"170\" y=\"80\" font-size=\"13\">75°</text><text x=\"150\" y=\"120\" font-size=\"15\">x</text><text x=\"150\" y=\"20\" font-size=\"12\" text-anchor=\"middle\">(1) 正三角形ABC・ADE</text><rect x=\"360\" y=\"60\" width=\"110\" height=\"110\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><rect x=\"430\" y=\"20\" width=\"110\" height=\"110\" fill=\"none\" stroke=\"#1d3557\" stroke-width=\"2\" transform=\"rotate(20 430 20)\"/><text x=\"415\" y=\"135\" font-size=\"15\">x</text><text x=\"450\" y=\"20\" font-size=\"12\" text-anchor=\"middle\">(2) 正方形ABCD・AEFG</text></svg>",
    "steps": [
      {"question": "三角形ABCと三角形ADEはどちらも正三角形です。図のように75°の角が示されているとき、角xの大きさを求めなさい。",
       "answer": "15",
       "meaning": "①正三角形が2つあると、回転で重なる合同な三角形が見つかる。②75＝60+xの関係が成り立つ。③x＝15度。"},
      {"question": "四角形ABCDと四角形AEFGはどちらも正方形です。角xの大きさを求めなさい。",
       "answer": "45",
       "meaning": "①正方形が2つあると、回転で重なる合同な三角形が見つかる。②対応する角の関係からx＝45度とわかる。"},
    ],
  },
  {
    "id": "hd5s_22k1_16", "category": ZU, "unit": "平面図形（角度）",
    "title": "平行な補助線と二等辺三角形",
    "intro": "下の図で、三角形ABCの辺AB上に点D、辺BC上に点Eがあり、内部に点Fがあります。角㋐の大きさを求めなさい。",
    "star": 3, "hg": "HG-3653",
    "svg": "<svg viewBox=\"0 0 320 280\" xmlns=\"http://www.w3.org/2000/svg\"><polygon points=\"60,240 260,240 160,30\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"45\" y=\"255\" font-size=\"13\">B</text><text x=\"265\" y=\"255\" font-size=\"13\">C</text><text x=\"160\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">A</text><circle cx=\"110\" cy=\"135\" r=\"4\" fill=\"#333\"/><text x=\"90\" y=\"130\" font-size=\"12\">D</text><circle cx=\"210\" cy=\"140\" r=\"4\" fill=\"#333\"/><text x=\"215\" y=\"135\" font-size=\"12\">E</text><circle cx=\"150\" cy=\"180\" r=\"4\" fill=\"#e63946\"/><text x=\"155\" y=\"195\" font-size=\"12\">F</text><line x1=\"110\" y1=\"135\" x2=\"150\" y2=\"180\" stroke=\"#888\" stroke-width=\"1.5\"/><line x1=\"150\" y1=\"180\" x2=\"210\" y2=\"140\" stroke=\"#888\" stroke-width=\"1.5\"/><line x1=\"160\" y1=\"30\" x2=\"150\" y2=\"180\" stroke=\"#888\" stroke-width=\"1.5\" stroke-dasharray=\"4,3\"/><text x=\"128\" y=\"100\" font-size=\"12\">AC＝10cm、AF＝6cm、DF:FC＝3:2</text><text x=\"145\" y=\"225\" font-size=\"14\">46°</text><text x=\"150\" y=\"150\" font-size=\"15\">㋐</text></svg>",
    "steps": [
      {"question": "ACの長さは10cm、AFの長さは6cmで、DF:FC＝3:2です。図のように46°の角が示されているとき、角㋐の大きさを求めなさい。",
       "answer": "67",
       "meaning": "①ADと平行な補助線FGを引くと、DF:FC＝3:2よりAG:GCも3:2になり、AGの長さは6cm（AFと同じ）とわかる。②AF＝AGより、斜線の三角形は二等辺三角形。③(180−46)÷2＝67度。"},
    ],
  },
]

# ── 第2講座 No.22「速さ(4)」HG-3798〜3813 ──────────────────────
# すべて category=hayasa, unit=速さ（旅人算）（例外なし）
KOUZA2 = [
  {
    "id": "hd5s_22k2_1", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "上り下りの時間比と出会うまでの距離",
    "intro": "A、B両駅間を上り列車は40分、下り列車は32分で通過します。この両列車が同時にA、B両駅を出発します。",
    "star": 2, "hg": "HG-3798",
    "svg": "<svg viewBox=\"0 0 420 140\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"30\" y1=\"70\" x2=\"390\" y2=\"70\" stroke=\"#888\" stroke-width=\"4\"/><circle cx=\"30\" cy=\"70\" r=\"7\" fill=\"#e63946\"/><text x=\"30\" y=\"100\" font-size=\"15\" text-anchor=\"middle\">A</text><circle cx=\"390\" cy=\"70\" r=\"7\" fill=\"#1d3557\"/><text x=\"390\" y=\"100\" font-size=\"15\" text-anchor=\"middle\">B</text><circle cx=\"215\" cy=\"70\" r=\"6\" fill=\"#333\"/><text x=\"215\" y=\"50\" font-size=\"13\" text-anchor=\"middle\">出会う地点</text><text x=\"120\" y=\"35\" font-size=\"13\" text-anchor=\"middle\">上り列車：40分</text><text x=\"300\" y=\"35\" font-size=\"13\" text-anchor=\"middle\">下り列車：32分</text></svg>",
    "steps": [
      {"question": "出会うまでに、下り列車の方が4kmだけ多く走りました。A、B両駅間は何kmですか。",
       "answer": "36",
       "meaning": "①上りの40分＝下りの32分なので、速さの比は上り:下り＝4:5。②出会うまでに進む距離の比も④:⑤。③⑤−④の①が4kmなので、全体の⑨は4×9＝36km。"},
    ],
  },
  {
    "id": "hd5s_22k2_2", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "上り下りの時間比とまん中からの距離",
    "intro": "A、B両駅間を上り列車は50分、下り列車は30分で通過します。この両列車が同時にA、B両駅を出発します。",
    "star": 2, "hg": "HG-3799",
    "svg": "<svg viewBox=\"0 0 420 140\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"30\" y1=\"70\" x2=\"390\" y2=\"70\" stroke=\"#888\" stroke-width=\"4\"/><circle cx=\"30\" cy=\"70\" r=\"7\" fill=\"#e63946\"/><text x=\"30\" y=\"100\" font-size=\"15\" text-anchor=\"middle\">A</text><circle cx=\"390\" cy=\"70\" r=\"7\" fill=\"#1d3557\"/><text x=\"390\" y=\"100\" font-size=\"15\" text-anchor=\"middle\">B</text><line x1=\"210\" y1=\"55\" x2=\"210\" y2=\"85\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"210\" y=\"45\" font-size=\"12\" text-anchor=\"middle\">真ん中</text><circle cx=\"180\" cy=\"70\" r=\"6\" fill=\"#333\"/><text x=\"180\" y=\"100\" font-size=\"12\" text-anchor=\"middle\">出会う地点</text><text x=\"195\" y=\"120\" font-size=\"12\" text-anchor=\"middle\">真ん中から5km</text><text x=\"120\" y=\"35\" font-size=\"13\" text-anchor=\"middle\">上り列車：50分</text><text x=\"300\" y=\"35\" font-size=\"13\" text-anchor=\"middle\">下り列車：30分</text></svg>",
    "steps": [
      {"question": "A、B両駅間の真ん中より5km離れたところで出会いました。A、B両駅間は何kmですか。",
       "answer": "40",
       "meaning": "①上りの50分＝下りの30分なので、速さの比は上り:下り＝3:5。②出会う地点は真ん中より5km、つまり差は5×2＝10km。③⑤−③の②が10kmなので①は5km。④全体の⑧は5×8＝40km。"},
    ],
  },
  {
    "id": "hd5s_22k2_3", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "おくれて出発・1/3地点で追いこし",
    "intro": "A君は徒歩で西地から東地に向かいました。A君より48分おくれてB君は自転車で西地から東地へ向かいました。A君は出発して1時間後に、東西両地間の1/3を行ったところ（C地点）でB君に追いこされ、さらに3km進んだところ（D地点）で、東地に着いてすぐ引きかえしてきたB君に出会いました。歩く速さ、自転車の速さは変えないものとします。",
    "star": 3, "hg": "HG-3800",
    "svg": "<svg viewBox=\"0 0 460 140\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"30\" y1=\"70\" x2=\"430\" y2=\"70\" stroke=\"#888\" stroke-width=\"4\"/><circle cx=\"30\" cy=\"70\" r=\"6\" fill=\"#e63946\"/><text x=\"30\" y=\"100\" font-size=\"14\" text-anchor=\"middle\">西</text><circle cx=\"160\" cy=\"70\" r=\"6\"/><text x=\"160\" y=\"100\" font-size=\"14\" text-anchor=\"middle\">C</text><circle cx=\"260\" cy=\"70\" r=\"6\"/><text x=\"260\" y=\"100\" font-size=\"14\" text-anchor=\"middle\">D</text><circle cx=\"430\" cy=\"70\" r=\"6\" fill=\"#1d3557\"/><text x=\"430\" y=\"100\" font-size=\"14\" text-anchor=\"middle\">東</text><text x=\"210\" y=\"50\" font-size=\"13\" text-anchor=\"middle\">3km</text><text x=\"95\" y=\"35\" font-size=\"12\" text-anchor=\"middle\">西〜Cは全体の1/3</text></svg>",
    "steps": [
      {"question": "A君とB君の速さの比を求めなさい。",
       "answer": "1:5",
       "choices": ["1:5", "5:1", "1:4", "4:1"],
       "meaning": "①A君が出発してからC地点に着くまでの60分＝B君がC地点に着くまでの12分（48分おくれで出発し1時間後にCで追いこされた）。②同じ距離にかかる時間の比60:12＝5:1の逆比で、速さの比はA君:B君＝1:5。"},
      {"question": "東西両地間の距離を求めなさい。",
       "answer": "13.5",
       "meaning": "①CD間（3km）に進んだA君の距離を①とすると、B君の距離は⑤。②Cから東地までの距離は(①+⑤)÷2＝③にあたり9km。③Cから東地までは西地から東地までの2/3にあたるので、東西両地間は9÷(2/3)＝13.5km。"},
    ],
  },
  {
    "id": "hd5s_22k2_4", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "追いこしの時間差（トラックとタクシー）",
    "intro": "トラックが出発してから15分後にタクシーが同じ道を追いかけました。タクシーはトラックが出発してから45分後に追いつき、その後、1時間で目的地に着きました。",
    "star": 3, "hg": "HG-3801",
    "steps": [
      {"question": "トラックは、タクシーより何分おくれて同じ目的地に着きますか。",
       "answer": "30",
       "meaning": "①トラックの45分＝タクシーの30分（追いつくまでの時間）なので、同じ距離にかかる時間の比はトラック:タクシー＝3:2。②タクシーの60分ぶんの距離をトラックで進むと60×3/2＝90分。③90−60＝30分。（別解：時間差は進む距離に比例するので、タクシーが30分で進む距離での15分差から、60分で進む距離では30分差とすぐわかる。）"},
    ],
  },
  {
    "id": "hd5s_22k2_5", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "2通りの方法で解く追いつき算",
    "intro": "午前9時にA地からB地に向かってゲタ君が出発しました。それから5分後にカバ君もA地を出発してB地に向かいました。カバ君は出発後25分でゲタ君に追いつき、B地へはゲタ君よりも3分早く到着しました。ゲタ君とカバ君の速さはそれぞれ常に一定です。",
    "star": 3, "hg": "HG-3802",
    "steps": [
      {"question": "ゲタ君がB地に着く時刻を求めなさい。",
       "answer": "午前9時48分",
       "choices": ["午前9時48分", "午前9時45分", "午前9時53分", "午前9時43分"],
       "meaning": "【速さの比から解く方法】①同じ道のり（追いついた地点まで）を行くのにかかる時間の比はゲタ30分:カバ25分＝⑥:⑤で、差は①。②AB間でゲタとカバの到着時刻の差は5+3＝8分なので①＝8分。③ゲタのAB間の所要時間⑥は48分なので、9時48分。【距離の割合から解く方法】①AB間で8分差、追いついた地点までで5分差なので、追いついた地点までの道のりはAB間の5/8にあたる。②(5+25)×8/5＝48分後、どちらの方法でも9時48分に着く。"},
    ],
  },
  {
    "id": "hd5s_22k2_6", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "追いつきとまん中からの距離",
    "intro": "A地からB地までをゆか子さんは32分で、ひとみさんは40分で行きます。ひとみさんがA地を出発してB地に向かってから3分後に、ゆか子さんも同じ道を通ってA地からB地に向かいました。ゆか子さんがひとみさんに追いついた地点をC地とすると、C地はAB間のまん中より300m離れていました。",
    "star": 3, "hg": "HG-3803",
    "svg": "<svg viewBox=\"0 0 420 140\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"30\" y1=\"70\" x2=\"390\" y2=\"70\" stroke=\"#888\" stroke-width=\"4\"/><circle cx=\"30\" cy=\"70\" r=\"7\" fill=\"#e63946\"/><text x=\"30\" y=\"100\" font-size=\"14\" text-anchor=\"middle\">A</text><circle cx=\"390\" cy=\"70\" r=\"7\" fill=\"#1d3557\"/><text x=\"390\" y=\"100\" font-size=\"14\" text-anchor=\"middle\">B</text><line x1=\"210\" y1=\"55\" x2=\"210\" y2=\"85\" stroke=\"#333\" stroke-width=\"2\"/><text x=\"210\" y=\"45\" font-size=\"12\" text-anchor=\"middle\">まん中</text><circle cx=\"240\" cy=\"70\" r=\"6\" fill=\"#333\"/><text x=\"240\" y=\"100\" font-size=\"12\" text-anchor=\"middle\">C（追いつく）</text><text x=\"225\" y=\"120\" font-size=\"12\" text-anchor=\"middle\">まん中から300m</text><text x=\"120\" y=\"35\" font-size=\"12\" text-anchor=\"middle\">ひとみ：40分</text><text x=\"300\" y=\"35\" font-size=\"12\" text-anchor=\"middle\">ゆか子：32分</text></svg>",
    "steps": [
      {"question": "ゆか子さんは、自分が出発してから何分後にひとみさんに追いつきますか。",
       "answer": "12",
       "meaning": "①ゆか子の32分＝ひとみの40分なので、時間の比はゆか子:ひとみ＝4:5。②追いつきの場所までのゆか子の所要時間を④、ひとみを⑤とすると、ひとみが3分先に出発している分が差の①にあたる。③④＝12分後。"},
      {"question": "AC間の道のりと、CB間の道のりの比を求めなさい。",
       "answer": "3:5",
       "choices": ["3:5", "5:3", "3:8", "5:8"],
       "meaning": "①ゆか子に注目すると、AC間は12分、CB間は32−12＝20分で進む。②AC:CB＝12:20＝3:5。"},
      {"question": "AB間の道のりを求めなさい。",
       "answer": "2400",
       "meaning": "①ACを③、CBを⑤とすると、まん中との差にあたる②が300×2＝600mになる。②①は300mなので、③+⑤の⑧は2400m。"},
    ],
  },
  {
    "id": "hd5s_22k2_7", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "一部の区間だけ速さを変える",
    "intro": "A町からB町までを時速40kmの速さで進む予定でしたが、途中40%の区間を時速60kmにはやめて走ったので、予定より20分早く着きました。",
    "star": 3, "hg": "HG-3804",
    "steps": [
      {"question": "A町からB町までの距離を求めなさい。",
       "answer": "100",
       "meaning": "①予定と実際の20分の差は、40%区間を時速40kmで進むか時速60kmで進むかのちがいだけで生まれる。②速さの比40:60＝2:3なのでかかる時間の比は3:2。③時速40kmで40%区間にかかる時間を③とすると、時速60kmでは②となり、その差の①が20分。④③は60分なので、40%区間は時速40km×1時間＝40km。⑤AB間は40÷0.4＝100km。"},
    ],
  },
  {
    "id": "hd5s_22k2_8", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "坂道で速さを1/5減らす",
    "intro": "ある人が、32kmはなれた所へ向かって出かけました。1/4だけ行ったとき上り坂になったため、あとは速さを1/5へらして進みました。そのため、はじめの速さのまま進んだ場合よりも1時間遅くなりました。",
    "star": 3, "hg": "HG-3805",
    "steps": [
      {"question": "はじめの速さは、時速何kmだったでしょうか。",
       "answer": "6",
       "meaning": "①32×1/4＝8km、32−8＝24kmが上り坂で速さを落とした区間で、この24kmの部分で1時間のちがいが生まれる。②速さを1/5減らすと4/5になるので、速さの比は5:4、かかる時間の比は④:⑤。③差の①が1時間なので、はじめの速さでは④＝4時間かかる。④24÷4＝時速6km。"},
    ],
  },
  {
    "id": "hd5s_22k2_9", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "自転車と徒歩の乗りかえ",
    "intro": "A君の家から駅まで行くのに、自転車なら30分、歩けば1時間45分かかります。駅には自転車の置き場がないので、途中の叔父さんの家まで自転車で行き、そこから駅まで歩いて合計45分かかりました。自転車をとめたりおりたりする時間は考えないものとします。",
    "star": 3, "hg": "HG-3806",
    "steps": [
      {"question": "叔父さんの家から駅までは何分間歩いたことになりますか。",
       "answer": "21",
       "meaning": "①自転車30分と歩き105分を比べると、同じ距離にかかる時間の比は2:7。②自転車と実際（45分）を比べると、15分のちがいは、ある区間を自転車で行くか歩くかのちがいから生まれる。③その区間にかかる時間はそれぞれ②分・⑦分にあたり、差の⑤分が15分。④⑦分は21分。"},
    ],
  },
  {
    "id": "hd5s_22k2_10", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "上り下りの往復（消去算）①",
    "intro": "A地からB地までは上りで、B地からC地までは下りになっています。ある人がA地からB地を通ってC地まで行くのに3時間かかり、同じ道をC地からB地を通ってA地まで帰るのに3時間40分かかりました。上りを歩く速さは毎時3km、下りを歩く速さは毎時5kmです。",
    "star": 3, "hg": "HG-3807",
    "svg": "<svg viewBox=\"0 0 420 180\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"40,150 210,40 380,150\" fill=\"none\" stroke=\"#333\" stroke-width=\"3\"/><circle cx=\"40\" cy=\"150\" r=\"6\" fill=\"#e63946\"/><text x=\"40\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">A</text><circle cx=\"210\" cy=\"40\" r=\"6\"/><text x=\"210\" y=\"25\" font-size=\"14\" text-anchor=\"middle\">B</text><circle cx=\"380\" cy=\"150\" r=\"6\" fill=\"#1d3557\"/><text x=\"380\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">C</text><text x=\"105\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">上り 毎時3km</text><text x=\"310\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">下り 毎時5km</text></svg>",
    "steps": [
      {"question": "この人がA地からB地を通ってC地まで行く道のりを求めなさい。",
       "answer": "12.5",
       "meaning": "①速さの比（上り3:下り5）を利用して時間比を書きこむ。AB間は上りにかかる時間を⑤分、下りを③分とし、BC間は下り③分・上り⑤分とする。②行き：⑤+③＝180分、帰り：③+⑤＝220分の消去算を解くと、AB側の①＝15分、BC側の①＝35分。③AB＝時速3km×75/60時間、BC＝時速3km×175/60時間で、AC＝3×250/60＝12.5km。"},
    ],
  },
  {
    "id": "hd5s_22k2_11", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "峠越えの往復（消去算）",
    "intro": "ある人が峠を越えて、となり町まで行って帰って来るのに、行きは1時間30分、帰りは1時間かかりました。上りは毎時2km、下りは毎時8kmの速さで歩きました。",
    "star": 3, "hg": "HG-3808",
    "svg": "<svg viewBox=\"0 0 420 180\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"40,150 210,40 380,150\" fill=\"none\" stroke=\"#333\" stroke-width=\"3\"/><circle cx=\"40\" cy=\"150\" r=\"6\" fill=\"#e63946\"/><text x=\"40\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">ア</text><circle cx=\"210\" cy=\"40\" r=\"6\"/><text x=\"210\" y=\"25\" font-size=\"14\" text-anchor=\"middle\">イ（峠）</text><circle cx=\"380\" cy=\"150\" r=\"6\" fill=\"#1d3557\"/><text x=\"380\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">ウ（となり町）</text><text x=\"105\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">上り 毎時2km</text><text x=\"310\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">下り 毎時8km</text></svg>",
    "steps": [
      {"question": "となり町までの道のりを求めなさい。",
       "answer": "4",
       "meaning": "①速さの比2:8＝1:4を利用して時間比を書きこむ。行きはア→イ④分・イ→ウ①分、帰りはウ→イ①分・イ→ア④分とする。②行き：④+①＝90分、帰り：①+④＝60分の消去算を解くと、行き側の①＝20分、帰り側の①＝10分。③アイ＝毎時8km×20/60時間、イウ＝毎時8km×10/60時間で、アウ＝8×30/60＝4km。"},
    ],
  },
  {
    "id": "hd5s_22k2_12", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "距離から時間比を書きこむ往復",
    "intro": "A地からB地までの6kmは上りで、B地からC地までの10kmは下りになっています。ある人がA地からB地を通ってC地まで行くのに3時間15分かかり、同じ道をC地からB地を通ってA地に行くのに4時間5分かかりました。",
    "star": 3, "hg": "HG-3809",
    "svg": "<svg viewBox=\"0 0 420 180\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"40,150 190,40 380,150\" fill=\"none\" stroke=\"#333\" stroke-width=\"3\"/><circle cx=\"40\" cy=\"150\" r=\"6\" fill=\"#e63946\"/><text x=\"40\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">A</text><circle cx=\"190\" cy=\"40\" r=\"6\"/><text x=\"190\" y=\"25\" font-size=\"14\" text-anchor=\"middle\">B</text><circle cx=\"380\" cy=\"150\" r=\"6\" fill=\"#1d3557\"/><text x=\"380\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">C</text><text x=\"95\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">上り 6km</text><text x=\"300\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">下り 10km</text></svg>",
    "steps": [
      {"question": "この人の上りの速さと下りの速さをそれぞれ求めなさい。",
       "answer": "上り時速3km、下り時速8km",
       "choices": ["上り時速3km、下り時速8km", "上り時速8km、下り時速3km", "上り時速2km、下り時速9km", "上り時速4km、下り時速7km"],
       "meaning": "①距離比（6km:10km＝3:5）を利用して時間比を書きこむ。行き：③+⑤＝195分、帰り：⑤+③＝245分の消去算を解くと、行き側の①＝40分、帰り側の①＝15分。②上り：③分（120分）で6kmなので、6÷2＝時速3km。③下り：③分（45分）で6kmなので、6÷(45/60)＝時速8km。"},
    ],
  },
  {
    "id": "hd5s_22k2_13", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "4地点を通る道のり（休みつきダイヤ図）",
    "intro": "道路にそって4つの地点A、B、C、Dがこの順にあります。午前8時に甲は歩いてAを出発しDに向かいましたが、途中でBで8分間、Cで10分間休みました。乙は甲より30分おくれて自転車でAを出発し、途中休まずDに着き、8分間休んでからAに引き返しました。乙は8時45分にAとBの間で甲を追い越し、帰りにDを出発してから20分後に甲と同時にCに着きました。甲と乙の速さはそれぞれ一定です。",
    "star": 3, "hg": "HG-3810",
    "svg": "<svg viewBox=\"0 0 500 120\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"30\" y1=\"60\" x2=\"470\" y2=\"60\" stroke=\"#888\" stroke-width=\"4\"/><circle cx=\"30\" cy=\"60\" r=\"6\" fill=\"#e63946\"/><text x=\"30\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">A</text><circle cx=\"130\" cy=\"60\" r=\"5\"/><text x=\"130\" y=\"45\" font-size=\"12\" text-anchor=\"middle\">E（追い越し）</text><circle cx=\"190\" cy=\"60\" r=\"6\"/><text x=\"190\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">B</text><circle cx=\"340\" cy=\"60\" r=\"6\"/><text x=\"340\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">C</text><circle cx=\"460\" cy=\"60\" r=\"6\" fill=\"#1d3557\"/><text x=\"460\" y=\"90\" font-size=\"13\" text-anchor=\"middle\">D</text></svg>",
    "steps": [
      {"question": "甲と乙の速さの比を求めなさい。",
       "answer": "1:3",
       "choices": ["1:3", "3:1", "1:4", "4:1"],
       "meaning": "①乙は甲より30分おくれて出発し、8時45分にAB間で追い越したので、甲の45分＝乙の15分。②速さの比は甲:乙＝1:3。"},
      {"question": "乙が甲を追い越した地点をEとすると、ECとCDの距離の比を求めなさい。",
       "answer": "1:1",
       "choices": ["1:1", "1:2", "2:1", "1:3"],
       "meaning": "①甲と乙が進んだ距離の比は1:3。②ED間を(①+③)÷2＝②とすると、EC＝①、CD＝②−①＝①。③EC:CD＝1:1。"},
      {"question": "甲がDに着いた時刻を求めなさい。",
       "answer": "午前11時3分",
       "choices": ["午前11時3分", "午前10時53分", "午前11時13分", "午前10時43分"],
       "meaning": "①乙の20分（Dを出発してCに着くまで）は甲の60分にあたる。②8時45分から(60×2+8+10)分後を計算すると、午前11時3分。"},
    ],
  },
  {
    "id": "hd5s_22k2_14", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "走りと歩きの往復",
    "intro": "中井君は、A町とB町の間を往復しました。行きは走り続けたので30分かかり、帰りは歩いたり走ったりしたために48分かかりました。中井君の走る速さは、歩く速さの3倍です。",
    "star": 2, "hg": "HG-3811",
    "steps": [
      {"question": "この日、中井君が歩いた時間は何分だったでしょうか。",
       "answer": "27",
       "meaning": "①走る速さは歩く速さの3倍なので、同じ距離にかかる時間の比は走り:歩き＝1:3。②48−30＝18分の差は、帰りの歩いた部分について③−①の②にあたるので①＝9分。③歩いた時間③＝27分。"},
    ],
  },
  {
    "id": "hd5s_22k2_15", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "坂道を同時に出発する2人",
    "intro": "坂道があり、A地点から太郎君が、C地点から次郎君が同時に出発して、それぞれB地点を通ってAC間を45分かけて一往復します。B地点には行きでは太郎君が3分早く通過し、帰りでは次郎君が2分早く通過しました。2人が坂道を上るときの速さはともに分速100mで、坂道を下るときの速さも2人とも同じです。",
    "star": 3, "hg": "HG-3812",
    "svg": "<svg viewBox=\"0 0 420 180\" xmlns=\"http://www.w3.org/2000/svg\"><polyline points=\"40,150 210,40 380,150\" fill=\"none\" stroke=\"#333\" stroke-width=\"3\"/><circle cx=\"40\" cy=\"150\" r=\"6\" fill=\"#e63946\"/><text x=\"40\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">A（太郎）</text><circle cx=\"210\" cy=\"40\" r=\"6\"/><text x=\"210\" y=\"25\" font-size=\"14\" text-anchor=\"middle\">B</text><circle cx=\"380\" cy=\"150\" r=\"6\" fill=\"#1d3557\"/><text x=\"380\" y=\"170\" font-size=\"14\" text-anchor=\"middle\">C（次郎）</text><text x=\"210\" y=\"90\" font-size=\"12\" text-anchor=\"middle\">上り 分速100m／下りは2人とも同じ速さ</text></svg>",
    "steps": [
      {"question": "BC間はAB間より何m長いですか。",
       "answer": "300",
       "meaning": "①B地点を通過する時刻の差3分は、坂道を上る分速100mでその差の距離を進む時間にあたる。②100×3＝300m。"},
      {"question": "2人が坂道を下るときの速さを求めなさい。",
       "answer": "150",
       "meaning": "①帰りの通過時刻の差2分から、坂の長さの差300mを2人が下りの速さで進んだときの時間差が2分とわかる。②300÷2＝分速150m。"},
      {"question": "AB間の道のりを求めなさい。",
       "answer": "1200",
       "meaning": "①太郎君が45分間で1往復する間、分速100mで進んだ道のりと分速150mで進んだ道のりは、どちらもAC間の長さに等しい。②かけた時間の比は3:2なので、分速100mで27分、分速150mで18分進んだことになる。③AC間は100×27＝2700m。④AB間は(2700−300)÷2＝1200m。"},
    ],
  },
  {
    "id": "hd5s_22k2_16", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "うさぎとかめの負けおしみ",
    "intro": "うさぎとかめが競走しました。うさぎは途中で寝てしまい、目をさましてからそれまでの1.5倍の速さで走りましたが、うさぎが小山のふもとに着く2分前に、かめはすでにそこに着いていました。うさぎは「ひと眠りした場所がもうあと2km以上スタートに近ければ、同じ時間だけねむっていたところで、起きてからそれまでの1.5倍の速さで走ったなら、かめには負けなかったのに」と負けおしみを言いました。",
    "star": 3, "hg": "HG-3813",
    "steps": [
      {"question": "うさぎさんのはじめの速さを求めなさい。",
       "answer": "20",
       "meaning": "①負けおしみの話を図にすると、2分の差は③（もとの速さで進む場合）と②（1.5倍の速さで進む場合）の差にあたる。②①＝2分なので③＝6分。③はじめの速さは、2kmを6分で走る速さ、つまり時速20km。"},
    ],
  },
]


def build():
    for x in KOUZA1 + KOUZA2:
        x["grade"] = 5
        x["src"] = "%s 小5最レ 第3分冊 %s No.22 %s" % (
            x["hg"], "第1講座" if x in KOUZA1 else "第2講座", x["title"])
    return KOUZA1, KOUZA2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    k1, k2 = build()
    n1 = sum(len(x["steps"]) for x in k1)
    n2 = sum(len(x["steps"]) for x in k2)
    print("第1講座 No.22: 大問%d本・%d問" % (len(k1), n1))
    print("第2講座 No.22: 大問%d本・%d問" % (len(k2), n2))

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["5"]["sairei"]
    node.setdefault("kouza1", {})
    node.setdefault("kouza2", {})
    if "22" in node["kouza1"] or "22" in node["kouza2"]:
        sys.exit("すでに No.22 が入っています。上書きしないので確認してください。")
    node["kouza1"]["22"] = k1
    node["kouza2"]["22"] = k2
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
