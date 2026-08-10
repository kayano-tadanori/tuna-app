# -*- coding: utf-8 -*-
"""小5最レ第3分冊 No.27 の大問（第1講座「辺比と面積比の発展」16問＋第2講座「速さ(7)」16問）を
hama_daimon.json の grades.5.sairei.kouza1["27"]/kouza2["27"] に書き起こす。
原簿どおりに置く。数値替えの類題は作らない。

使い方: python scripts/gen_sairei5_daimon3_no27.py --write
"""
import io, json, os, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

KAZU = "kazu"
ZU = "zu"
HAYASA = "hayasa"

# ── 第1講座 No.27「辺比と面積比の発展」HG-3718〜3733 ──────────────────────
KOUZA1 = [
  {
    "id": "hd5s_27k1_1", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "長方形の中の斜線部分の面積（ちょうちょう形）",
    "intro": "下の図の四角形ABCDは長方形です。辺AB上に点E、辺DC上に点Fがあり、AE＝3cm、EB＝1cm、DF＝2cm、FC＝2cmです。図に示された斜線部分について考えます。",
    "star": 3, "hg": "HG-3718",
    "steps": [
      {"question": "斜線部分の面積は長方形ABCDの面積の何倍ですか。",
       "answer": "7/30",
       "meaning": "①斜線部を㋐と㋑に分ける。ちょうちょう（砂時計形の相似）に注目して辺比を書き込むと、㋐は三角形AEFの2/5にあたり、三角形AEFは長方形の3/8にあたる→㋐は長方形の3/8×2/5＝3/20。②同様に㋑は三角形EBFの2/3にあたり、三角形EBFは長方形の1/8にあたる→㋑は長方形の1/8×2/3＝1/12。③3/20+1/12＝7/30。→ 答え 7/30倍。"},
    ],
  },
  {
    "id": "hd5s_27k1_2", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "太線の平行四辺形と斜線部分の面積比（比あわせ）",
    "intro": "下の図の長方形ABCDの辺AB, BC, CD, DA上にそれぞれ点E, F, G, Hがあり、AE:EB＝BF:FC＝CG:GD＝DH:HA＝2:1です。E, F, G, Hを結んでできる太線の平行四辺形と、その中にできる斜線部分の小さな平行四辺形を考えます。",
    "star": 3, "hg": "HG-3719",
    "steps": [
      {"question": "斜線部分の面積と長方形ABCDの面積の比を求めなさい。",
       "answer": "1:13",
       "choices": ["1:13", "1:12", "1:9", "2:13"],
       "meaning": "①太線EFGHで囲まれた平行四辺形は長方形全体の1/3にあたる。②太線の平行四辺形の中のピラミッド（三角形の中の平行線）に注目するとア:イ:ウ＝2:1:2、ウ:エ＝3:2となるので、比あわせしてア:イ:ウ:エ＝6:3:6:4とそろえる。③斜線部分は太線の平行四辺形の3/13にあたるので、長方形全体では1/3×3/13＝1/13。→ 答え 1:13。"},
    ],
  },
  {
    "id": "hd5s_27k1_3", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "長方形の中点とAC上の3等分点でできる斜線部分（ちょうちょう＋ピラミッド）",
    "intro": "下の図の四角形ABCDは長方形で、E, FはそれぞれAB, DCの長さを2等分する点、P, QはACの長さを3等分する点です。",
    "star": 3, "hg": "HG-3720",
    "steps": [
      {"question": "斜線部分の面積は、長方形ABCDの面積の何倍ですか。",
       "answer": "1/8",
       "meaning": "①ちょうちょう（砂時計形の相似）に注目してから、ピラミッド（三角形の中の平行線）に注目する。②太線でできる部分は平行四辺形で、長方形全体の1/2にあたる。③斜線部分はその平行四辺形の1.5/6＝1/4にあたる。④全体では1/2×1/4＝1/8。→ 答え 1/8倍。"},
    ],
  },
  {
    "id": "hd5s_27k1_4", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "BE:EC＝CF:FD＝2:1のときの斜線部分（三角形DBCを経由）",
    "intro": "右の図の長方形ABCDで、辺BC上の点E、辺CD上の点Fがあり、BE:EC＝CF:FD＝2:1です。",
    "star": 3, "hg": "HG-3721",
    "steps": [
      {"question": "斜線部分の面積と長方形ABCDの面積の比を求めなさい。",
       "answer": "13:40",
       "choices": ["13:40", "13:20", "7:20", "13:60"],
       "meaning": "①三角形DBCを基準に考える。㋐は三角形DBCの2/3×2/5＝4/15、㋑は三角形DBCの1/3×1/4＝1/12。②斜線部分は三角形DBCの1−4/15−1/12＝13/20。③三角形DBCは長方形の1/2にあたるので、斜線部分は長方形の1/2×13/20＝13/40。→ 答え 13:40。"},
    ],
  },
  {
    "id": "hd5s_27k1_5", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "6つの角がすべて120度の六角形（正三角形を切り取った形）",
    "intro": "右の図の六角形ABCDEFの6つの角はどれも120度です。AF＝3cm、AB＝4cm、BC＝5cm、CD＝6cmです。内角120度の六角形は、大きな正三角形の3つの角を小さな正三角形で切り取った形になります。",
    "star": 3, "hg": "HG-3722",
    "steps": [
      {"question": "EFの長さを求めなさい。",
       "answer": "8",
       "meaning": "①外側に正三角形を復元すると、一辺は3+4+5＝12cm。5+6+■＝12より■＝1cm。②1+▲+3＝12より▲（EF）＝8cm。→ 答え 8cm。"},
      {"question": "六角形ABCDEFの面積は、一辺1cmの正三角形の面積の何倍ですか。",
       "answer": "109",
       "meaning": "①一辺1cmの正三角形の面積を(1×1)とすると、大きな正三角形は一辺12cmなので(12×12)。②切り取った3つの角の正三角形はそれぞれ一辺3cm・5cm・1cmなので(3×3)、(5×5)、(1×1)。③六角形は(12×12)−((3×3)+(5×5)+(1×1))＝144−9−25−1＝109。→ 答え 109倍。"},
    ],
  },
  {
    "id": "hd5s_27k1_6", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "一辺12cmの正方形・CE:ED＝1:1、AF:FD＝2:1のときの斜線部分",
    "intro": "右の図の四角形ABCDは一辺の長さが12cmの正方形です。辺CD上の点E、辺AD上の点Fがあり、CE:ED＝1:1、AF:FD＝2:1です。",
    "star": 3, "hg": "HG-3723",
    "steps": [
      {"question": "斜線部分の面積を求めなさい。",
       "answer": "72",
       "meaning": "①三角形AGFと三角形HGBが相似で、相似比が8:24＝1:3になることから交点の位置が12×3/(1+3)で求まる。②斜線部分の面積は24×9÷2−12×6÷2＝108−36＝72cm²。→ 答え 72cm²。"},
    ],
  },
  {
    "id": "hd5s_27k1_7", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "面積が等しい5つの三角形に分けたときのAD:DE:EC",
    "intro": "右の図は、三角形ABCを面積が等しい5つの三角形に分けた図です。辺AC上に点D, Eがあります。",
    "star": 2, "hg": "HG-3724",
    "steps": [
      {"question": "AD:DE:ECを求めなさい。",
       "answer": "3:4:8",
       "choices": ["3:4:8", "3:4:5", "4:4:8", "3:3:8"],
       "meaning": "①高さが同じ三角形どうしは面積比＝底辺比になるので、面積が等しい部分の底辺も等しい関係で表せる。②4＝③＝△とそろえて比あわせすると、AD:DE:EC＝3:4:8。→ 答え 3:4:8。"},
    ],
  },
  {
    "id": "hd5s_27k1_8", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "56cm²の三角形を5つに分けたときのADとECの比",
    "intro": "面積が56cm²の三角形ABCを、辺BC上・辺AC上の点D, Eを使って図のように5つの部分に分けました。5つの部分の面積はそれぞれ14cm²、15cm²、12cm²、9cm²、6cm²です。",
    "star": 2, "hg": "HG-3725",
    "steps": [
      {"question": "ADとECの長さの比を求めなさい。",
       "answer": "3:5",
       "choices": ["3:5", "5:3", "3:4", "2:5"],
       "meaning": "①面積比＝底辺比になる部分を使って比を出し、⑨＝3とそろえて比あわせすると、AD:EC＝③:⑤＝3:5。→ 答え 3:5。"},
    ],
  },
  {
    "id": "hd5s_27k1_9", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "三角形の面積を折れ線で10等分したときのFHの長さ",
    "intro": "下の図は、三角形ABCの面積を折れ線C, D, E, …, Lで10等分したものです。辺AB上にL, J, H, F, Dがあり、辺ABの長さは16cmです。",
    "star": 3, "hg": "HG-3726",
    "steps": [
      {"question": "FHの長さを求めなさい。",
       "answer": "2.1",
       "meaning": "①面積が10等分されているので、底辺ABも同じ関係で10等分の比を追える。⑩＝16cmから⑨＝14.4cm、⑦＝12.6cmのように順に長さを出していく。②FHにあたる部分は2.1cm。→ 答え 2.1cm。"},
    ],
  },
  {
    "id": "hd5s_27k1_10", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "AD, BE, CFが1点で交わるときのx:y（この型の基本）",
    "intro": "三角形の辺BC, CA, ABの上にそれぞれ点D, E, Fがあって、AD, BE, CFが一点で交わっています。この型は「底辺比を面積比に読みかえてから比あわせする」のが基本の解き方です。",
    "star": 3, "hg": "HG-3727",
    "steps": [
      {"question": "AF＝3, FB＝2, BD＝1, DC＝1のとき、AE＝x, EC＝yとしてx:yを求めなさい。",
       "answer": "3:2",
       "choices": ["3:2", "2:3", "1:1", "3:1"],
       "meaning": "①底辺比AF:FB＝3:2、BD:DC＝1:1をそれぞれ面積比に読みかえる。②比あわせして共通の数でそろえると、AE:EC＝x:y＝3:2。→ 答え 3:2。"},
      {"question": "AF＝2, FB＝5, AE＝4, EC＝3のとき、BD＝x, DC＝yとしてx:yを求めなさい。",
       "answer": "10:3",
       "choices": ["10:3", "3:10", "5:3", "10:7"],
       "meaning": "①底辺比AF:FB＝2:5、AE:EC＝4:3をそれぞれ面積比に読みかえる。②比あわせして共通の数でそろえると、BD:DC＝x:y＝10:3。→ 答え 10:3。"},
      # ★(3)は原簿が判読できていなかったが、実物（本文p41）で確認して復活させた（2026-08-11）
      {"question": "AE＝7, EC＝2, BD＝6, DC＝5のとき、AF＝x, FB＝yとしてx:yを求めなさい。",
       "answer": "35:12",
       "choices": ["35:12", "12:35", "7:12", "35:6"],
       "meaning": "①底辺比AE:EC＝7:2、BD:DC＝6:5を面積比に読みかえてから比あわせする。②AD, BE, CFが1点で交わる条件から、AF:FBが35:12と求まる。→ 答え 35:12。"},
    ],
  },
  {
    "id": "hd5s_27k1_11", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "AD,BE,CFが1点Pで交わる型を面積で問う",
    "intro": "三角形の辺BC, CA, ABの上にそれぞれ点D, E, FがあってAD, BE, CFが1点Pで交わっています。BD:DC＝3:5、CE:EA＝3:2、三角形APEの面積が4cm²です。",
    "star": 3, "hg": "HG-3728",
    "steps": [
      {"question": "三角形BDPの面積を求めなさい。",
       "answer": "3と3/8",
       "meaning": "①三角形APEの面積4cm²にCE:EAの比3:2をかけて三角形CPEの面積を4×3/2＝6cm²と求める。②BD:DCの比3:5を使って10×3/5＝6cm²の関係から三角形CPDの面積を10cm²と求める。③6×3/2＝9cm²で次の面積を求める。④9×3/8＝3と3/8cm²で三角形BDPの面積を求める。→ 答え 3と3/8cm²。"},
    ],
  },
  {
    "id": "hd5s_27k1_12", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "AE,BF,CDが1点Pで交わる型（比あわせの完成形）",
    "intro": "三角形の辺AB, BC, CAの上にそれぞれ点D, E, FがあってAE, BF, CDが1点Pで交わっています。Dは辺ABを5:2に分ける点、Eは辺BCを4:3に分ける点です。",
    "star": 3, "hg": "HG-3729",
    "steps": [
      {"question": "三角形PABと三角形PBCの面積の比を求めなさい。",
       "answer": "10:3",
       "choices": ["10:3", "3:10", "5:4", "4:3"],
       "meaning": "①Dが5:2に分ける比とEが4:3に分ける比をそろえてから比あわせすると20:15:6の関係が出る。②三角形PABと三角形PBCの面積比は10:3になる。→ 答え 10:3。"},
      {"question": "AF:FCを求めなさい。",
       "answer": "10:3",
       "choices": ["10:3", "3:10", "20:6", "5:3"],
       "meaning": "①同じ比あわせ20:15:6から、AF:FCも10:3になる。→ 答え 10:3。"},
      {"question": "AP:PEを求めなさい。",
       "answer": "35:6",
       "choices": ["35:6", "6:35", "10:3", "35:3"],
       "meaning": "①三角形APBの面積と三角形PBEの面積の比が35:6になることから、AP:PE＝35:6が求まる。→ 答え 35:6。"},
    ],
  },
  {
    "id": "hd5s_27k1_13", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "48cm²の長方形で三角形ABP=8cm², AQD=12cm²のときの三角形APQ",
    "intro": "面積が48cm²である長方形ABCDの辺BC, CD上に、それぞれ点P, Qをとって結びます。三角形ABPの面積は8cm²、三角形AQDの面積は12cm²です。",
    "star": 3, "hg": "HG-3730",
    "steps": [
      {"question": "三角形APQの面積を求めなさい。",
       "answer": "20",
       "meaning": "①三角形ABPの面積8cm²と、対応する面積㋐cm²の比が1×2:2×1＝1:1になることから㋐＝8cm²とわかる。②長方形全体48cm²から、AQD(12)+ABP(8)+㋐(8)を引くと、48−(12+8+8)＝20cm²。→ 答え 20cm²。"},
    ],
  },
  {
    "id": "hd5s_27k1_14", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "1cmと2cmの二等辺三角形を並べた内角120度の六角形（大問5と同じ骨）",
    "intro": "AB, BC, CDの長さがすべて1cmの二等辺三角形3個と、DE, EF, FAの長さがすべて2cmの二等辺三角形3個が、円の中心Oのまわりに並んでいます。頂点A, B, C, D, E, Fは円の周上にあります。",
    "star": 3, "hg": "HG-3731",
    "steps": [
      {"question": "この6個の三角形でできる六角形ABCDEFの面積は、一辺の長さが1cmの正三角形の面積の何倍ですか。",
       "answer": "13",
       "meaning": "①二等辺三角形の頂角○が6個、×が6個で合計720度になることから、○＋×＝120度とわかる。②これは内角120度の六角形なので、大問5と同じ道具（外側に正三角形を復元する）が使える。③4×4−1×1×3＝16−3＝13。→ 答え 13倍。"},
    ],
  },
  {
    "id": "hd5s_27k1_15", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "台形・等積変形とピラミッド（相似比は面積比の平方根）",
    "intro": "下の図で、ADとBC、CDとGEはそれぞれ平行で、AE＝EDです。四角形ABFEの面積が48cm²、三角形BGFの面積が50cm²です。",
    "star": 3, "hg": "HG-3732",
    "steps": [
      {"question": "斜線部分の面積を求めなさい。",
       "answer": "48",
       "meaning": "①等積変形の関係㋐+☆＝㋑+☆から、㋑＝48cm²になる。→ 答え 48cm²。"},
      {"question": "BG:GCを求めなさい。",
       "answer": "5:2",
       "choices": ["5:2", "2:5", "7:5", "5:7"],
       "meaning": "①50:(50+48)＝25:49＝5×5:7×7となり、これが相似比の2乗の関係なので相似比は5:7とわかる。②BG:BC＝5:7からBG:GC＝5:2。→ 答え 5:2。"},
      {"question": "台形ABCDの面積を求めなさい。",
       "answer": "154",
       "meaning": "①底辺比から面積比がわかる関係を使って㋐＝98cm²を求める。②すでにわかっている部分と㋐(98)を足して154cm²。→ 答え 154cm²。"},
    ],
  },
  {
    "id": "hd5s_27k1_16", "category": ZU, "unit": "平面図形（相似・比）",
    "title": "三角形の外に飛び出す形でAF:FCやCD:DEを求める",
    "intro": "次の問いに答えなさい。求めたい辺を含む2つの三角形の面積比が、そのままその辺の比になることを利用します。",
    "star": 3, "hg": "HG-3733",
    "steps": [
      {"question": "右図でAD:DB＝3:4、EC:CB＝2:1のとき、AF:FCを求めなさい。",
       "answer": "9:8",
       "choices": ["9:8", "8:9", "3:2", "2:1"],
       "meaning": "①斜線の三角形ADEと三角形DCEの面積比が、そのままAF:FCになる。②④×2/3の計算から、3:8/3＝9:8が求まる。→ 答え 9:8。"},
      {"question": "右図でAB:BC＝4:3、AF:FD＝5:2のとき、CD:DEを求めなさい。",
       "answer": "7:8",
       "choices": ["7:8", "8:7", "5:2", "4:3"],
       "meaning": "①三角形BCDと三角形BDEの面積比が、そのままCD:DEになる。②④×2/5＝16の計算から、1.4:1.6＝7:8が求まる。→ 答え 7:8。"},
    ],
  },
]

# ── 第2講座 No.27「速さ(7)」HG-3874〜3889 ──────────────────────
KOUZA2 = [
  {
    "id": "hd5s_27k2_1", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "太郎君とお父さんの進行グラフ（忘れ物で引き返す）",
    "intro": "太郎君とお父さんが、家からかなり離れた公園まで歩いて向かいます。午前8時に家を出ましたが、途中で忘れ物に気づき、お父さんが家にもどり、太郎君を追って公園へ向かい、午前10時10分に公園に着きました。太郎君の速さは一定です。グラフには40分、50分、90分、100分、130分の時刻が示されています。",
    "star": 2, "hg": "HG-3874",
    "svg": "<svg viewBox=\"0 0 500 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"50\" y1=\"190\" x2=\"470\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"50\" y1=\"190\" x2=\"50\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><text x=\"470\" y=\"210\" font-size=\"14\" text-anchor=\"end\">時間(分)</text><text x=\"20\" y=\"20\" font-size=\"14\">きょり</text><polyline points=\"50,190 460,40\" stroke=\"#e63946\" stroke-width=\"3\" fill=\"none\"/><text x=\"465\" y=\"38\" font-size=\"13\" fill=\"#e63946\">太郎</text><polyline points=\"50,190 150,150 200,190 400,60\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\" stroke-dasharray=\"6,3\"/><text x=\"405\" y=\"58\" font-size=\"13\" fill=\"#1d3557\">お父さん</text><text x=\"150\" y=\"140\" font-size=\"12\" text-anchor=\"middle\">忘れ物に気づく</text><text x=\"200\" y=\"205\" font-size=\"12\" text-anchor=\"middle\">家にもどる</text></svg>",
    "steps": [
      {"question": "太郎君の速さは毎時何kmですか。",
       "answer": "3",
       "meaning": "①太郎君は40分で2km進んでいる。②2÷(40/60)＝3km/時。→ 答え 毎時3km。"},
      {"question": "お父さんの追いかける速さは毎時何kmですか。",
       "answer": "4.8",
       "meaning": "①お父さんが追いかけ始めてから太郎君は90−10＝80分進んでおり、その距離は3×(80/60)＝4km。②お父さんはこの4kmを50分で進む。③4÷(50/60)＝4.8km/時。→ 答え 毎時4.8km。"},
      {"question": "出発点から公園まで何kmありますか。",
       "answer": "5.5",
       "meaning": "①太郎君は130−20＝110分進んで公園に着く。②3×(110/60)＝5.5km。→ 答え 5.5km。"},
    ],
  },
  {
    "id": "hd5s_27k2_2", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "船の往復グラフから上りと下りの速さ・流速を求める",
    "intro": "下のグラフは、船が48km離れたAB間を往復する様子を表したものです。上りは3時間、下りは2時間かかっています。",
    "star": 1, "hg": "HG-3875",
    "svg": "<svg viewBox=\"0 0 400 200\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"170\" x2=\"380\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 220,30 380,170\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\"/><text x=\"220\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">48km(C町)</text><text x=\"130\" y=\"150\" font-size=\"12\" text-anchor=\"middle\">上り(3時間)</text><text x=\"300\" y=\"150\" font-size=\"12\" text-anchor=\"middle\">下り(2時間)</text><text x=\"380\" y=\"190\" font-size=\"12\" text-anchor=\"middle\">時間</text></svg>",
    "steps": [
      {"question": "上りの速さと下りの速さをそれぞれ求めなさい。",
       "answer": "上り 時速16km、下り 時速24km",
       "choices": ["上り 時速16km、下り 時速24km", "上り 時速24km、下り 時速16km", "上り 時速12km、下り 時速24km", "上り 時速16km、下り 時速20km"],
       "meaning": "①上りは3時間で48km進むので48÷3＝16km/時。②下りは2時間で48km進むので48÷2＝24km/時。→ 答え 上り時速16km、下り時速24km。"},
      {"question": "この川の流速を求めなさい。",
       "answer": "4",
       "meaning": "①下りの速さと上りの速さの差は、流速の2倍にあたる。②(24−16)÷2＝4km/時。→ 答え 毎時4km。"},
    ],
  },
  {
    "id": "hd5s_27k2_3", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "A→C町の往復・60分の休みをふくむグラフ",
    "intro": "ある川にそってA, B, Cの町があります。下のグラフは、A町から川上にあるC町へ船で往復したときの様子を表したものです。船の静水での速さと川の流れの速さはそれぞれ一定です。行きはB町（10km地点）で60分の休みをはさみ、全体で3時間かけてC町（20km）に着き、帰りは1時間でA町にもどっています。",
    "star": 2, "hg": "HG-3876",
    "svg": "<svg viewBox=\"0 0 420 200\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"170\" x2=\"400\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 130,110 190,110 260,30 400,170\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\"/><text x=\"160\" y=\"100\" font-size=\"12\" text-anchor=\"middle\">B町で60分休み</text><text x=\"260\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">C町(20km)</text><text x=\"330\" y=\"150\" font-size=\"12\" text-anchor=\"middle\">帰り(1時間)</text></svg>",
    "steps": [
      {"question": "A町からC町へ行くときの速さは毎時何kmですか。",
       "answer": "10",
       "meaning": "①20km先のC町には3時間から休みの1時間を引いた2時間で到着している。②20÷2＝10km/時。→ 答え 毎時10km。"},
      {"question": "川の流れの速さは毎時何kmですか。",
       "answer": "5",
       "meaning": "①帰りの速さは20÷1＝20km/時。②行きが上りで帰りが下りなので、流速は(20−10)÷2＝5km/時。→ 答え 毎時5km。"},
    ],
  },
  {
    "id": "hd5s_27k2_4", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "定期船の出会い（ちょうちょう型相似・ダイヤグラム）",
    "intro": "川の下流にあるA地と40km離れたB地との間を定期船が往復しています。8時発の定期船と9時発の定期船のダイヤグラム（A地0km〜B地40km）が描かれています。",
    "star": 3, "hg": "HG-3877",
    "svg": "<svg viewBox=\"0 0 400 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"50\" y1=\"20\" x2=\"50\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"50\" y1=\"190\" x2=\"380\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><text x=\"30\" y=\"20\" font-size=\"13\">B(40km)</text><text x=\"30\" y=\"195\" font-size=\"13\">A(0km)</text><line x1=\"50\" y1=\"190\" x2=\"350\" y2=\"40\" stroke=\"#e63946\" stroke-width=\"3\"/><text x=\"355\" y=\"40\" font-size=\"12\" fill=\"#e63946\">8時発</text><line x1=\"150\" y1=\"40\" x2=\"380\" y2=\"190\" stroke=\"#1d3557\" stroke-width=\"3\"/><text x=\"385\" y=\"190\" font-size=\"12\" fill=\"#1d3557\">9時発</text><circle cx=\"245\" cy=\"105\" r=\"5\" fill=\"#333\"/><text x=\"245\" y=\"95\" font-size=\"12\" text-anchor=\"middle\">出会い</text></svg>",
    "steps": [
      {"question": "9時発の定期船が8時発の定期船と出会うのは、A地から何kmの地点ですか。",
       "answer": "24",
       "meaning": "①ダイヤグラムの交点にできる砂時計形（ちょうちょう）に注目して辺比を書き込むと、上が2、下が3の比になる。②③+②が40kmにあたるので③は24km。→ 答え 24km。"},
    ],
  },
  {
    "id": "hd5s_27k2_5", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "自動車の追いつき（ちょうちょう型相似・ダイヤグラム）",
    "intro": "A地から80km離れたB地に向かって2台の自動車が進みます。8時発の自動車と9時発の自動車のダイヤグラム（A地0km〜B地80km、8時〜12時）が描かれています。",
    "star": 3, "hg": "HG-3878",
    "svg": "<svg viewBox=\"0 0 400 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"50\" y1=\"20\" x2=\"50\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"50\" y1=\"190\" x2=\"380\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><text x=\"15\" y=\"20\" font-size=\"13\">B(80km)</text><text x=\"15\" y=\"195\" font-size=\"13\">A(0km)</text><line x1=\"50\" y1=\"190\" x2=\"350\" y2=\"30\" stroke=\"#e63946\" stroke-width=\"3\"/><text x=\"355\" y=\"30\" font-size=\"12\" fill=\"#e63946\">8時発</text><line x1=\"140\" y1=\"190\" x2=\"350\" y2=\"60\" stroke=\"#1d3557\" stroke-width=\"3\"/><text x=\"355\" y=\"60\" font-size=\"12\" fill=\"#1d3557\">9時発</text><circle cx=\"300\" cy=\"70\" r=\"5\" fill=\"#333\"/><text x=\"270\" y=\"90\" font-size=\"12\" text-anchor=\"middle\">追いつく</text></svg>",
    "steps": [
      {"question": "9時発の自動車が8時発の自動車に追いつくのは、何時何分ですか。",
       "answer": "9時20分",
       "choices": ["9時20分", "9時40分", "10時", "9時30分"],
       "meaning": "①ちょうちょうに注目して辺比を書き込むと①:②になる。②①+②が4時間にあたるので①は1と1/3時間＝1時間20分。③8時の1時間20分後は9時20分。→ 答え 9時20分。"},
    ],
  },
  {
    "id": "hd5s_27k2_6", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "一郎と二郎・A町で休むダイヤグラム（ちょうちょう型相似を2回）",
    "intro": "一郎君はA町からB町へ歩いて、二郎君はB町からA町へ自転車で出発しました。A町から1.5km離れたところで2人は出会っています。二郎君はA町で何分か休んでから、行きと同じ速さでB町へもどっています。グラフには25分、1時間13分、1時間25分の時刻が示されています。",
    "star": 3, "hg": "HG-3879",
    "svg": "<svg viewBox=\"0 0 420 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"50\" y1=\"20\" x2=\"50\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"50\" y1=\"190\" x2=\"400\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><text x=\"15\" y=\"20\" font-size=\"13\">B町</text><text x=\"15\" y=\"195\" font-size=\"13\">A町</text><line x1=\"50\" y1=\"190\" x2=\"300\" y2=\"30\" stroke=\"#e63946\" stroke-width=\"3\"/><text x=\"305\" y=\"30\" font-size=\"12\" fill=\"#e63946\">一郎</text><polyline points=\"50,30 130,190 180,190 260,30\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\" stroke-dasharray=\"6,3\"/><text x=\"265\" y=\"30\" font-size=\"12\" fill=\"#1d3557\">二郎</text><circle cx=\"110\" cy=\"110\" r=\"5\" fill=\"#333\"/><text x=\"80\" y=\"105\" font-size=\"11\" text-anchor=\"middle\">1回目の出会い</text><text x=\"150\" y=\"205\" font-size=\"11\" text-anchor=\"middle\">A町で休み</text></svg>",
    "steps": [
      {"question": "二郎君はA町で何分休んだでしょうか。",
       "answer": "23",
       "meaning": "①二郎君は1時間13分かけて1往復しているが、実際に動いていた時間は25×2＝50分。②休みは1時間13分−50分＝23分。→ 答え 23分。"},
      {"question": "A町からB町まで何kmあるでしょうか。",
       "answer": "6.6",
       "meaning": "①ちょうちょう型相似に注目すると比は⑰:⑤になる。②⑤が1.5kmにあたるので、AB間の㉒は6.6km。→ 答え 6.6km。"},
      {"question": "一郎君が二郎君に追いつかれた場所はB町から何kmの地点ですか。",
       "answer": "1.32",
       "meaning": "①ちょうちょう型相似に注目すると比は④:①になる。②⑤が6.6kmにあたるので①は1.32km。→ 答え 1.32km。"},
    ],
  },
  {
    "id": "hd5s_27k2_7", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "兄と弟のへだたりグラフ（山の頂点＝弟の出発）",
    "intro": "兄と弟の2人が家から公園まで同じ道路を、兄は歩いて、弟は自転車に乗って進みます。最初に兄が出発し、そのあと弟が家を出て、2人同時に公園に着きました。下のグラフは、兄が出発してからの2人の間の距離（へだたり）を表しています。山の頂点(20分・600m)が弟の出発の瞬間で、60分後にへだたりが0になっています。",
    "star": 2, "hg": "HG-3880",
    "svg": "<svg viewBox=\"0 0 400 200\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"170\" x2=\"380\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 160,40 380,170\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\"/><text x=\"160\" y=\"30\" font-size=\"12\" text-anchor=\"middle\">600m(弟が出発)</text><text x=\"40\" y=\"190\" font-size=\"11\">0分</text><text x=\"160\" y=\"190\" font-size=\"11\">20分</text><text x=\"380\" y=\"190\" font-size=\"11\">60分(追いつく)</text><text x=\"10\" y=\"15\" font-size=\"12\">へだたり</text></svg>",
    "steps": [
      {"question": "兄と弟の速さをそれぞれ求めなさい。",
       "answer": "兄 分速30m、弟 分速45m",
       "choices": ["兄 分速30m、弟 分速45m", "兄 分速45m、弟 分速30m", "兄 分速30m、弟 分速40m", "兄 分速25m、弟 分速45m"],
       "meaning": "①兄は20分で600m進んでいるので600÷20＝30m/分。②弟は40分（60分−20分）で600mの差を縮めているので600÷40＝15、これが速さの差にあたる。③30+15＝45m/分。→ 答え 兄 分速30m、弟 分速45m。"},
      {"question": "家から公園までの距離を求めなさい。",
       "answer": "1800",
       "meaning": "①公園に同時に着くのは、弟が公園でちょうど兄に追いついたということ。②兄が出発して60分後に公園に着いたことになる。③30×60＝1800m。→ 答え 1800m。"},
    ],
  },
  {
    "id": "hd5s_27k2_8", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "花子と良子のへだたりグラフ（折れ目＝片方が止まる）",
    "intro": "3600m離れたA町、B町の間にCとDの地点があります。花子はA町を出発してB町に、良子はB町を出発してA町に向かって歩きます。2人は同時に出発してC地点で出会い、さらに良子がA町に着いたとき花子はD地点にいました。良子はそのままA町にとまり、花子は歩き続けてB町に着きました。花子は80分でAB間を進んでおり、2人は30分でC地点で出会っています。",
    "star": 3, "hg": "HG-3881",
    "svg": "<svg viewBox=\"0 0 420 210\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"30\" x2=\"380\" y2=\"30\" stroke=\"#888\" stroke-width=\"3\"/><circle cx=\"40\" cy=\"30\" r=\"5\" fill=\"#e63946\"/><text x=\"40\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">A</text><circle cx=\"150\" cy=\"30\" r=\"4\" fill=\"#333\"/><text x=\"150\" y=\"20\" font-size=\"12\" text-anchor=\"middle\">C</text><circle cx=\"260\" cy=\"30\" r=\"4\" fill=\"#333\"/><text x=\"260\" y=\"20\" font-size=\"12\" text-anchor=\"middle\">D</text><circle cx=\"380\" cy=\"30\" r=\"5\" fill=\"#1d3557\"/><text x=\"380\" y=\"20\" font-size=\"13\" text-anchor=\"middle\">B</text><line x1=\"40\" y1=\"170\" x2=\"380\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"70\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 110,80 220,170 380,120\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\"/><text x=\"10\" y=\"70\" font-size=\"12\">へだたり</text></svg>",
    "steps": [
      {"question": "花子と良子のそれぞれの分速は何mですか。",
       "answer": "花子 分速45m、良子 分速75m",
       "choices": ["花子 分速45m、良子 分速75m", "花子 分速75m、良子 分速45m", "花子 分速45m、良子 分速60m", "花子 分速40m、良子 分速75m"],
       "meaning": "①花子は80分でAB間3600mを進むので3600÷80＝45m/分。②花子と良子は30分でC地点で出会うので(良子+45)×30＝3600より、良子＋45＝120、良子＝75m/分。→ 答え 花子 分速45m、良子 分速75m。"},
      {"question": "A町からC地点まで何mありますか。",
       "answer": "1350",
       "meaning": "①花子は30分でAC間を進んでいる。②45×30＝1350m。→ 答え 1350m。"},
    ],
  },
  {
    "id": "hd5s_27k2_9", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "太郎と次郎・引き返し（へだたりグラフの5区間）",
    "intro": "P, Q2地点があります。太郎君はP地を出発して一定の速さで歩いてQ地に向かい、次郎君は太郎君が出発してから30分後、P地から太郎君と同じ道を一定の速さで、自転車に乗ってQ地に向かい、Q地に着くとすぐに同じ道を同じ速さで引き返しました。グラフは太郎君がP地を出発してから3時間後までの2人の距離（へだたり）を表しており、2km、4km、8kmの値が示されています。",
    "star": 3, "hg": "HG-3882",
    "svg": "<svg viewBox=\"0 0 440 210\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"170\" x2=\"400\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 100,140 180,60 260,60 320,20 400,120\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\"/><text x=\"70\" y=\"185\" font-size=\"10\">太郎だけ</text><text x=\"140\" y=\"185\" font-size=\"10\">追いかける</text><text x=\"220\" y=\"185\" font-size=\"10\">ひきはなす</text><text x=\"290\" y=\"185\" font-size=\"10\">向かう</text><text x=\"360\" y=\"185\" font-size=\"10\">離れる</text><text x=\"5\" y=\"18\" font-size=\"12\">へだたり</text></svg>",
    "steps": [
      {"question": "太郎君と次郎君は毎時何kmで進んでいますか。",
       "answer": "太郎 毎時4km、次郎 毎時8km",
       "choices": ["太郎 毎時4km、次郎 毎時8km", "太郎 毎時8km、次郎 毎時4km", "太郎 毎時4km、次郎 毎時6km", "太郎 毎時5km、次郎 毎時8km"],
       "meaning": "①太郎は0.5時間で2km進むので2÷0.5＝4km/時。②次郎は0.5時間で太郎との差2kmを縮めるので、速さの差は2÷0.5＝4km/時。③4+4＝8km/時。→ 答え 太郎 毎時4km、次郎 毎時8km。"},
      {"question": "P, Q2地点の距離は何kmですか。",
       "answer": "12",
       "meaning": "①次郎に注目すると、0.5時間後にPを出発して2時間後にQ地に着くので、PQ間に1.5時間かけている。②8×1.5＝12km。→ 答え 12km。"},
      {"question": "2度目に同じ場所になるのは、太郎君が出発してから何時間何分後ですか。",
       "answer": "2時間20分後",
       "choices": ["2時間20分後", "2時間30分後", "2時間10分後", "2時間40分後"],
       "meaning": "①2人の速さの和で4kmの差を縮めるのと、8kmの差をひらくのにかかる時間の比は4:8＝1:2になる。②☆は60分×(1/3)＝20分。③2時間+20分＝2時間20分後。→ 答え 2時間20分後。"},
    ],
  },
  {
    "id": "hd5s_27k2_10", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "速さ×時間のグラフは面積が距離（長方形）",
    "intro": "下のグラフは、電車がA駅を出発してB駅に到着するまでの時間と電車の速さの関係を表したものです。電車は秒速25mで180秒間走っています。",
    "star": 2, "hg": "HG-3883",
    "svg": "<svg viewBox=\"0 0 300 180\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"150\" x2=\"260\" y2=\"150\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"150\" x2=\"40\" y2=\"30\" stroke=\"#888\" stroke-width=\"2\"/><rect x=\"40\" y=\"50\" width=\"200\" height=\"100\" fill=\"#a8dadc\" fill-opacity=\"0.5\" stroke=\"#1d3557\" stroke-width=\"2\"/><text x=\"20\" y=\"50\" font-size=\"13\">25m/秒</text><text x=\"240\" y=\"168\" font-size=\"13\">180秒</text><text x=\"140\" y=\"105\" font-size=\"13\" text-anchor=\"middle\">面積＝距離</text></svg>",
    "steps": [
      {"question": "AB両駅間の距離を求めなさい。",
       "answer": "4500",
       "meaning": "①速さ×時間のグラフでは、長方形の面積を求めると進んだ距離を求めたことになる。②25×180＝4500。→ 答え 4500m。"},
    ],
  },
  {
    "id": "hd5s_27k2_11", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "速さが途中で変わるグラフ（長方形2つの面積の和）",
    "intro": "下のグラフは、電車がA駅を出発してB駅に到着するまでの時間と電車の速さの関係を表したものです。はじめ秒速20mで60秒間、その後秒速25mで40秒間走っています。",
    "star": 2, "hg": "HG-3884",
    "svg": "<svg viewBox=\"0 0 320 180\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"150\" x2=\"290\" y2=\"150\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"150\" x2=\"40\" y2=\"30\" stroke=\"#888\" stroke-width=\"2\"/><rect x=\"40\" y=\"80\" width=\"120\" height=\"70\" fill=\"#a8dadc\" fill-opacity=\"0.5\" stroke=\"#1d3557\" stroke-width=\"2\"/><rect x=\"160\" y=\"60\" width=\"90\" height=\"90\" fill=\"#f4a261\" fill-opacity=\"0.5\" stroke=\"#e63946\" stroke-width=\"2\"/><text x=\"15\" y=\"80\" font-size=\"12\">20m/秒</text><text x=\"15\" y=\"60\" font-size=\"12\">25m/秒</text><text x=\"100\" y=\"168\" font-size=\"12\">60秒</text><text x=\"205\" y=\"168\" font-size=\"12\">40秒</text></svg>",
    "steps": [
      {"question": "AB両駅間の距離を求めなさい。",
       "answer": "2200",
       "meaning": "①秒速20mで60秒間進んだ距離は20×60＝1200m。②秒速25mで40秒間進んだ距離は25×40＝1000m。③1200+1000＝2200m。→ 答え 2200m。"},
    ],
  },
  {
    "id": "hd5s_27k2_12", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "加速をふくむグラフの面積（台形）",
    "intro": "下のグラフは、自動車がA地点を出発してB地点を通過するまでの時間と自動車の速さの関係を表したものです。出発してから40秒かけて秒速15mまで加速し、そのまま150秒まで進んでいます。",
    "star": 3, "hg": "HG-3885",
    "svg": "<svg viewBox=\"0 0 320 180\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"150\" x2=\"290\" y2=\"150\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"150\" x2=\"40\" y2=\"30\" stroke=\"#888\" stroke-width=\"2\"/><polygon points=\"40,150 90,60 270,60 270,150\" fill=\"#a8dadc\" fill-opacity=\"0.5\" stroke=\"#1d3557\" stroke-width=\"2\"/><text x=\"15\" y=\"60\" font-size=\"12\">15m/秒</text><text x=\"90\" y=\"168\" font-size=\"12\">40秒</text><text x=\"270\" y=\"168\" font-size=\"12\">150秒</text></svg>",
    "steps": [
      {"question": "AB間の距離を求めなさい。",
       "answer": "1950",
       "meaning": "①加速する部分は斜めの線になり、グラフ全体が台形になる。②台形の面積が距離にあたるので、(110+150)×15÷2＝1950。→ 答え 1950m。"},
    ],
  },
  {
    "id": "hd5s_27k2_13", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "花子と太郎・折り返し点で5分休むダイヤグラム",
    "intro": "花子さんは分速300mでA地点からB地点まで行ってA地点にもどり、太郎君はその逆に、B地点からA地点まで行ってB地点にもどりました。2人は午前10時に出発し、それぞれ折り返し点で5分間の休けいをとり、花子は午前11時5分、太郎は午前11時35分に出発地点にもどりました。",
    "star": 3, "hg": "HG-3886",
    "svg": "<svg viewBox=\"0 0 420 220\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"50\" y1=\"20\" x2=\"50\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"50\" y1=\"190\" x2=\"400\" y2=\"190\" stroke=\"#888\" stroke-width=\"2\"/><text x=\"15\" y=\"20\" font-size=\"12\">B</text><text x=\"15\" y=\"195\" font-size=\"12\">A</text><polyline points=\"50,190 190,30 220,30 320,190\" stroke=\"#e63946\" stroke-width=\"3\" fill=\"none\"/><text x=\"325\" y=\"190\" font-size=\"11\" fill=\"#e63946\">花子</text><polyline points=\"50,30 260,190 290,190 390,30\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\" stroke-dasharray=\"6,3\"/><text x=\"393\" y=\"30\" font-size=\"11\" fill=\"#1d3557\">太郎</text></svg>",
    "steps": [
      {"question": "太郎君の速さは毎分何mですか。",
       "answer": "200",
       "meaning": "①太郎の往復の所要時間は95分間から休みの5分を除いた90分間。②花子は65分間から休みの5分を除いた60分間。③同じ距離を進むのにかかった時間から速さの比がわかる。太郎の90分＝花子の60分より②:③。③は300m/分なので②は200m/分。→ 答え 毎分200m。"},
      {"question": "2人が2回目に出会う時刻を求めなさい。",
       "answer": "午前10時59分",
       "choices": ["午前10時59分", "午前10時50分", "午前11時5分", "午前10時45分"],
       "meaning": "①太郎の片道は90÷2＝45分、花子の片道は60÷2＝30分。②速さの条件から時間比をかきこむと、⑤は15分で③は9分。③10時50分の9分後は10時59分。→ 答え 午前10時59分。"},
    ],
  },
  {
    "id": "hd5s_27k2_14", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "直線AB上の2点P, Q（Qは出会うと速さが半分になる）",
    "intro": "直線ABの上を動く2点P, Qがあります。点PはAからB方向へ、点QはBからA方向へ、同時に出発します。2点は、おたがいに出会ったときと、A, Bに着いたときには、すぐに進む方向が反対になります。点Pの速さは変わりませんが、点Qは点Pと出会ったときだけ速さが半分になります。グラフには0秒、18秒、36秒、x秒、63秒の時刻と216cmの距離が示されています。",
    "star": 3, "hg": "HG-3887",
    "svg": "<svg viewBox=\"0 0 440 210\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"170\" x2=\"410\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 130,40 230,170 300,40 410,120\" stroke=\"#e63946\" stroke-width=\"3\" fill=\"none\"/><text x=\"415\" y=\"120\" font-size=\"11\" fill=\"#e63946\">P</text><polyline points=\"40,40 130,170 230,40 300,110 410,20\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\" stroke-dasharray=\"6,3\"/><text x=\"415\" y=\"22\" font-size=\"11\" fill=\"#1d3557\">Q</text><text x=\"130\" y=\"185\" font-size=\"10\">18秒</text><text x=\"230\" y=\"185\" font-size=\"10\">36秒</text><text x=\"300\" y=\"185\" font-size=\"10\">x秒</text><text x=\"410\" y=\"185\" font-size=\"10\">63秒</text></svg>",
    "steps": [
      {"question": "グラフのxの値はいくらですか。",
       "answer": "54",
       "meaning": "①速さの比から時間比が書き込める。②①＝18秒より③＝54。→ 答え 54。"},
      {"question": "2度目に点Pと点Qが出会うのは、Aから何cmのところですか。",
       "answer": "324",
       "meaning": "①Pが36秒後から63秒後までの27秒間で進んだ距離を求める。②Pの速さは18秒で216cm進んでいるので秒速12cm。③12×27＝324cm。→ 答え 324cm。"},
      {"question": "ABの長さを求めなさい。",
       "answer": "360",
       "meaning": "①0秒後から18秒後までの18秒間でQの進んだ距離を④とすると、54秒後から63秒後までの9秒間でQの進んだ距離は①になる。②AB＝216+④＝324+①という関係から③＝108、①＝36。③AB＝324+36＝360cm。→ 答え 360cm。"},
    ],
  },
  {
    "id": "hd5s_27k2_15", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "姉妹の忘れ物（へだたりグラフの4区間）",
    "intro": "姉妹が家から駅に向かう一本道をいっしょに歩いていたところ、忘れ物に気づき、姉は急いで戻り、すぐにまた急いで駅に向かいました。その間、妹ははじめより遅い速さで歩きましたが、先に駅に着いたので待っていました。グラフは、姉妹が家を出てからの時間と姉妹のへだたり（720m、240m）の関係を表しており、9分、17分、19分の時刻が示されています。",
    "star": 3, "hg": "HG-3888",
    "svg": "<svg viewBox=\"0 0 420 210\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"170\" x2=\"400\" y2=\"170\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"170\" x2=\"40\" y2=\"20\" stroke=\"#888\" stroke-width=\"2\"/><polyline points=\"40,170 130,170 200,40 260,90 340,30 400,30\" stroke=\"#1d3557\" stroke-width=\"3\" fill=\"none\"/><text x=\"80\" y=\"185\" font-size=\"10\">2人いっしょ</text><text x=\"165\" y=\"185\" font-size=\"10\">姉が戻る</text><text x=\"230\" y=\"185\" font-size=\"10\">追いかける</text><text x=\"370\" y=\"185\" font-size=\"10\">妹だけ待つ</text></svg>",
    "steps": [
      {"question": "姉の急ぎ足の速さを求めなさい。",
       "answer": "120",
       "meaning": "①姉の急ぎ足の速さは17分から19分の2分間からわかる。②240÷2＝120m/分。→ 答え 分速120m。"},
      {"question": "妹が1人で歩いたときの速さを求めなさい。",
       "answer": "60",
       "meaning": "①9分から17分の8分間で、急ぎ足の姉に720−240＝480mの差を縮められる。②480÷8＝60m/分がこの間の2人の速さの差。③120−60＝60m/分が妹の速さ。→ 答え 分速60m。"},
      {"question": "家から駅までの距離を求めなさい。",
       "answer": "1200",
       "meaning": "①姉に注目すると、9分から19分までの10分で家から駅に着いている。②120×10＝1200m。→ 答え 1200m。"},
    ],
  },
  {
    "id": "hd5s_27k2_16", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "電車の加速・減速（台形の一部を切り取る）",
    "intro": "下のグラフは、電車がA駅を出発してB駅に到着するまでの時間と電車の速さの関係を表したものです。60秒かけて秒速30mまで加速し、180秒まで一定で走り、そこから減速して240秒で到着します。",
    "star": 3, "hg": "HG-3889",
    "svg": "<svg viewBox=\"0 0 340 180\" xmlns=\"http://www.w3.org/2000/svg\"><line x1=\"40\" y1=\"150\" x2=\"320\" y2=\"150\" stroke=\"#888\" stroke-width=\"2\"/><line x1=\"40\" y1=\"150\" x2=\"40\" y2=\"30\" stroke=\"#888\" stroke-width=\"2\"/><polygon points=\"40,150 90,60 240,60 290,150\" fill=\"#a8dadc\" fill-opacity=\"0.5\" stroke=\"#1d3557\" stroke-width=\"2\"/><text x=\"15\" y=\"60\" font-size=\"12\">30m/秒</text><text x=\"90\" y=\"168\" font-size=\"11\">60秒</text><text x=\"240\" y=\"168\" font-size=\"11\">180秒</text><text x=\"290\" y=\"168\" font-size=\"11\">240秒</text></svg>",
    "steps": [
      {"question": "この電車が時速36kmになるのは出発して何秒後と何秒後ですか。",
       "answer": "20秒後と220秒後",
       "choices": ["20秒後と220秒後", "20秒後と200秒後", "10秒後と220秒後", "30秒後と210秒後"],
       "meaning": "①時速36kmは秒速10m。②60秒で秒速30mになるので、その1/3の秒速10mになるのは1/3の時間の20秒後。③減速側も同じ関係で、到着の20秒前の220秒後。→ 答え 20秒後と220秒後。"},
      {"question": "この電車はA駅から何mのところで減速をはじめますか。",
       "answer": "4500",
       "meaning": "①しゃ線部分（台形からはじめの三角形を除いた形）の面積を求めればよい。②180×30−60×30÷2＝5400−900＝4500。→ 答え 4500m。"},
    ],
  },
]


def build():
    for x in KOUZA1 + KOUZA2:
        x["grade"] = 5
        x["src"] = "%s 小5最レ 第3分冊 %s No.27 %s" % (
            x["hg"], "第1講座" if x in KOUZA1 else "第2講座", x["title"])
    return KOUZA1, KOUZA2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    k1, k2 = build()
    n1 = sum(len(x["steps"]) for x in k1)
    n2 = sum(len(x["steps"]) for x in k2)
    print("第1講座 No.27: 大問%d本・%d問" % (len(k1), n1))
    print("第2講座 No.27: 大問%d本・%d問" % (len(k2), n2))

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["5"]["sairei"]
    node.setdefault("kouza1", {})
    node.setdefault("kouza2", {})
    if "27" in node["kouza1"] or "27" in node["kouza2"]:
        sys.exit("すでに No.27 が入っています。上書きしないので確認してください。")
    node["kouza1"]["27"] = k1
    node["kouza2"]["27"] = k2
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
