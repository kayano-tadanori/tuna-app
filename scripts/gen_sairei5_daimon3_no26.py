# -*- coding: utf-8 -*-
"""小5最レ第3分冊 No.26 の大問（第1講座「特別な分割」16問＋第2講座「速さ(6)」12問）を
hama_daimon.json の grades.5.sairei.kouza1["26"]/kouza2["26"] に書き起こす。
原簿どおりに置く。数値替えの類題は作らない。
※第2講座は原簿どおりこの回だけ12問（他の回は16問）。

使い方: python scripts/gen_sairei5_daimon3_no26.py --write
"""
import io, json, os, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

ZU = "zu"
HAYASA = "hayasa"

# ── 第1講座 No.26「特別な分割」HG-3702〜3717 ──────────────────────
KOUZA1 = [
  {
    "id": "hd5s_26k1_1", "category": ZU, "unit": "平面図形（面積）",
    "title": "長方形を3本の線で区切る（四角形IGCHの面積）",
    "intro": "右図は、長方形ABCDを3本の線で区切ったもので、ななめの線は対角線、たて・横の線はそれぞれ長方形のたて・横の辺に平行です。",
    "star": 2, "hg": "HG-3702",
    "svg": '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect x="40" y="20" width="220" height="140" fill="none" stroke="#888" stroke-width="3"/><line x1="40" y1="20" x2="260" y2="160" stroke="#333" stroke-width="1.5"/><text x="26" y="16" font-size="14">A</text><text x="264" y="16" font-size="14">D</text><text x="26" y="172" font-size="14">B</text><text x="264" y="172" font-size="14">C</text><rect x="40" y="20" width="70" height="40" fill="#e9c46a" fill-opacity="0.5" stroke="none"/><text x="75" y="45" font-size="12" text-anchor="middle">AF=7</text><text x="44" y="60" font-size="12">AE=4</text><rect x="190" y="120" width="70" height="40" fill="#1d3557" fill-opacity="0.35" stroke="none"/><text x="225" y="145" font-size="13" text-anchor="middle" fill="#fff">IGCH</text></svg>',
    "steps": [
      {"question": "AE＝4cm、AF＝7cmのとき、四角形IGCHの面積を求めなさい。",
       "answer": "28",
       "meaning": "①対角線の両側にある三角形の面積は等しいので、㋐+○+×＝㋑+○+×より㋐＝㋑。②㋐の部分はAE×AFの長方形と面積が等しくなる。③4×7＝28。→ 28cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_2", "category": ZU, "unit": "平面図形（面積）",
    "title": "長方形の中の砂時計形",
    "intro": "右図の長方形（10cm×8cm）で、斜線部分の面積の和を求めなさい。",
    "star": 1, "hg": "HG-3703",
    "svg": '<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg"><rect x="50" y="30" width="200" height="120" fill="none" stroke="#888" stroke-width="3"/><polygon points="50,30 250,30 150,90" fill="#e63946" fill-opacity="0.4"/><polygon points="50,150 250,150 150,90" fill="#e63946" fill-opacity="0.4"/><text x="150" y="20" font-size="14" text-anchor="middle">10cm</text><text x="30" y="94" font-size="14">8cm</text></svg>',
    "steps": [
      {"question": "長方形（10cm×8cm）の中に、上下の頂点と結んでできる砂時計形の斜線部分があります。斜線部分の面積の和を求めなさい。",
       "answer": "40",
       "meaning": "①上の三角形アと下の三角形イは面積が等しい。②斜線部分は長方形全体のちょうど半分になる。③10×8÷2＝40。→ 40cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_3", "category": ZU, "unit": "平面図形（面積）",
    "title": "正方形の各辺を3等分・中の1点と結ぶ",
    "intro": "一辺の長さが15cmの正方形があります。正方形の中にとった1点と、正方形の各辺を3等分した点を図のように結び、4つの四角形㋐㋑㋒㋓と4つの三角形A, B, C, Dができました。",
    "star": 3, "hg": "HG-3704",
    "svg": '<svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="200" height="200" fill="none" stroke="#888" stroke-width="3"/><circle cx="110" cy="130" r="4" fill="#e63946"/><line x1="110" y1="130" x2="30" y2="87" stroke="#333"/><line x1="110" y1="130" x2="30" y2="153" stroke="#333"/><line x1="110" y1="130" x2="97" y2="20" stroke="#333"/><line x1="110" y1="130" x2="163" y2="20" stroke="#333"/><line x1="110" y1="130" x2="230" y2="87" stroke="#333"/><line x1="110" y1="130" x2="230" y2="153" stroke="#333"/><line x1="110" y1="130" x2="97" y2="220" stroke="#333"/><line x1="110" y1="130" x2="163" y2="220" stroke="#333"/><text x="130" y="14" font-size="13" text-anchor="middle">一辺15cm</text></svg>',
    "steps": [
      {"question": "4つの三角形A, B, C, Dの面積の和を求めなさい。",
       "answer": "75",
       "meaning": "①正方形の中の1点から放射状に引くと、4つの三角形の面積の和は正方形全体の1/3になる。②15×15×1/3＝75。→ 75cm²。"},
      {"question": "3つの四角形㋑㋒㋓の面積の和が121cm²のとき、㋒の部分の面積を求めなさい。",
       "answer": "46",
       "meaning": "①㋐+㋑+㋒+㋓＝正方形全体−三角形の和＝15×15−75＝150。㋑+㋒+㋓＝121なので㋐＝150−121＝29。②(1)と同じ理由で㋐+㋒も正方形全体の1/3＝75になるので、㋒＝75−29＝46。→ 46cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_4", "category": ZU, "unit": "平面図形（面積）",
    "title": "長方形の内部の点P・面積比から",
    "intro": "図のように、AB＝3cm、BC＝8cmの長方形ABCDの内部に点Pがあり、面積比は 三角形ABP:三角形CDP＝2:3、三角形APD:三角形BCP＝1:4 です。",
    "star": 3, "hg": "HG-3705",
    "svg": '<svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="30" width="200" height="140" fill="none" stroke="#888" stroke-width="3"/><circle cx="130" cy="90" r="4" fill="#e63946"/><line x1="130" y1="90" x2="30" y2="30" stroke="#333"/><line x1="130" y1="90" x2="230" y2="30" stroke="#333"/><line x1="130" y1="90" x2="230" y2="170" stroke="#333"/><line x1="130" y1="90" x2="30" y2="170" stroke="#333"/><text x="18" y="26" font-size="13">A</text><text x="235" y="26" font-size="13">D</text><text x="18" y="185" font-size="13">B</text><text x="235" y="185" font-size="13">C</text><text x="140" y="82" font-size="13">P</text></svg>',
    "steps": [
      {"question": "三角形BPDの面積を求めなさい。",
       "answer": "4.8",
       "meaning": "①三角形ABPと三角形CDPの面積の和は長方形の半分（3×8÷2＝12cm²）。比2:3で1あたり12÷5＝2.4なので、三角形CDP＝3×2.4＝7.2cm²。②三角形APDと三角形BCPの面積の和も長方形の半分12cm²。比1:4で1あたり2.4なので、三角形BCP＝4×2.4＝9.6cm²。③三角形BPDの面積＝CDP+BCP−長方形の半分＝7.2+9.6−12＝4.8cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_5", "category": ZU, "unit": "平面図形（面積）",
    "title": "長方形の内部の点P・何倍か",
    "intro": "下図のように、長方形ABCDの内部に点Pがあり、面積比は 三角形ABP:三角形CDP＝3:5、三角形APD:三角形BCP＝1:3 です。",
    "star": 3, "hg": "HG-3706",
    "svg": '<svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="30" width="200" height="140" fill="none" stroke="#888" stroke-width="3"/><circle cx="130" cy="90" r="4" fill="#e63946"/><line x1="130" y1="90" x2="30" y2="30" stroke="#333"/><line x1="130" y1="90" x2="230" y2="30" stroke="#333"/><line x1="130" y1="90" x2="230" y2="170" stroke="#333"/><line x1="130" y1="90" x2="30" y2="170" stroke="#333"/><text x="18" y="26" font-size="13">A</text><text x="235" y="26" font-size="13">D</text><text x="18" y="185" font-size="13">B</text><text x="235" y="185" font-size="13">C</text><text x="140" y="82" font-size="13">P</text></svg>',
    "steps": [
      {"question": "三角形BPDの面積は長方形ABCDの面積の何倍ですか。",
       "answer": "3/16",
       "meaning": "①三角形ABPと三角形CDPの和は長方形の半分。比3:5をそのまま③:⑤とする（合計⑧）。②三角形APDと三角形BCPの和も長方形の半分。比1:3を②:⑥に置きかえる（合計⑧にそろえる）。③長方形全体は⑧+⑧＝⑯。④三角形BPDの面積＝CDP+BCP−半分＝⑤+⑥−⑧＝③。⑤③÷⑯＝3/16倍。"},
    ],
  },
  {
    "id": "hd5s_26k1_6", "category": ZU, "unit": "平面図形（面積）",
    "title": "正方形と正三角形PBC",
    "intro": "四角形ABCDは一辺20cmの正方形、三角形PBCはその中にできた正三角形です。",
    "star": 3, "hg": "HG-3707",
    "svg": '<svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="20" width="200" height="200" fill="none" stroke="#888" stroke-width="3"/><polygon points="30,220 230,220 130,47" fill="none" stroke="#e63946" stroke-width="2"/><line x1="30" y1="20" x2="230" y2="220" stroke="#1d3557" stroke-width="1.5" stroke-dasharray="4,3"/><text x="18" y="16" font-size="13">A</text><text x="235" y="16" font-size="13">D</text><text x="18" y="235" font-size="13">B</text><text x="235" y="235" font-size="13">C</text><text x="130" y="42" font-size="13" text-anchor="middle">P</text></svg>',
    "steps": [
      {"question": "三角形PBCと三角形PBDの面積の差を求めなさい。",
       "answer": "100",
       "meaning": "①三角形PBCと㋐を合わせると正方形の半分になる。②三角形PBDと㋐と㋑を合わせても正方形の半分になる。③2つを比べると、面積の差はちょうど㋑の部分にあたる。④㋑は底辺20cm・高さ10cm（正方形の辺の半分）の三角形なので20×10÷2＝100。→ 100cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_7", "category": ZU, "unit": "平面図形（面積）",
    "title": "正三角形と頂角120度の二等辺三角形",
    "intro": "正三角形ABCと、頂角が120度の二等辺三角形DEFがあります。底辺はどちらも12cmです。",
    "star": 2, "hg": "HG-3708",
    "svg": '<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg"><polygon points="60,140 160,140 110,50" fill="none" stroke="#e63946" stroke-width="2"/><text x="110" y="30" font-size="13" text-anchor="middle">正三角形ABC</text><polygon points="200,140 300,140 250,80" fill="none" stroke="#1d3557" stroke-width="2"/><text x="250" y="65" font-size="13" text-anchor="middle">DEF(頂角120°)</text><text x="110" y="155" font-size="12" text-anchor="middle">底辺12cm</text><text x="250" y="155" font-size="12" text-anchor="middle">底辺12cm</text></svg>',
    "steps": [
      {"question": "正三角形ABCの面積は、二等辺三角形DEFの面積の何倍ですか。",
       "answer": "3",
       "meaning": "①正三角形は中心から3つの合同な二等辺三角形（頂角120度）に分けられる。②底辺12cmの二等辺三角形DEFはその1つ分にあたる。③よって正三角形ABCの面積は二等辺三角形DEFの3倍。"},
    ],
  },
  {
    "id": "hd5s_26k1_8", "category": ZU, "unit": "平面図形（面積）",
    "title": "正三角形ABEと台形ABCD",
    "intro": "下図のように、正三角形ABEと台形ABCDがあります。図の中の角は120度と30度です。",
    "star": 3, "hg": "HG-3709",
    "steps": [
      {"question": "四角形ABCEの面積は、三角形ADEの面積の何倍ですか。",
       "answer": "5",
       "meaning": "①図全体を二等辺三角形・正三角形・30度の直角三角形に分ける。②正三角形の頂点で二等分されているので、三角形ADEを①とすると、四角形ABCEは③+①+①＝⑤にあたる。③よって5倍。"},
    ],
  },
  {
    "id": "hd5s_26k1_9", "category": ZU, "unit": "平面図形（面積）",
    "title": "30°30°120°の二等辺三角形を折りたたむ",
    "intro": "下図のように、3つの角が30°、30°、120°の二等辺三角形を折りたたむと、五角形ができました。",
    "star": 3, "hg": "HG-3710",
    "steps": [
      {"question": "折りたたんでできた五角形の面積は、もとの二等辺三角形の面積の何倍ですか。",
       "answer": "17/24",
       "meaning": "①30度の三角形の分割をもとに比合わせをする。もとの二等辺三角形の半分を③＝4＝△とそろえると、全体は24にあたる。②五角形の面積は24−4−3＝17。③17÷24＝17/24倍。"},
    ],
  },
  {
    "id": "hd5s_26k1_10", "category": ZU, "unit": "平面図形（面積）",
    "title": "正六角形をもとにした3つの図",
    "intro": "下の(図1)〜(図3)は、正六角形をもとにしてかいたものです。正六角形の分割は「中心から6等分」「頂点どうしで6等分」「18等分（星形）」の基本3パターンで考えられます。",
    "star": 3, "hg": "HG-3711",
    "svg": '<svg viewBox="0 0 560 160" xmlns="http://www.w3.org/2000/svg"><polygon points="60,40 100,40 120,75 100,110 60,110 40,75" fill="none" stroke="#888" stroke-width="2"/><line x1="80" y1="75" x2="60" y2="40" stroke="#333"/><line x1="80" y1="75" x2="100" y2="40" stroke="#333"/><line x1="80" y1="75" x2="120" y2="75" stroke="#333"/><line x1="80" y1="75" x2="100" y2="110" stroke="#333"/><line x1="80" y1="75" x2="60" y2="110" stroke="#333"/><line x1="80" y1="75" x2="40" y2="75" stroke="#333"/><text x="80" y="135" font-size="12" text-anchor="middle">図1</text><polygon points="240,40 280,40 300,75 280,110 240,110 220,75" fill="none" stroke="#888" stroke-width="2"/><line x1="220" y1="75" x2="300" y2="75" stroke="#333"/><text x="260" y="135" font-size="12" text-anchor="middle">図2</text><polygon points="420,40 460,40 480,75 460,110 420,110 400,75" fill="none" stroke="#888" stroke-width="2"/><line x1="440" y1="75" x2="420" y2="40" stroke="#333"/><line x1="440" y1="75" x2="460" y2="40" stroke="#333"/><line x1="440" y1="75" x2="480" y2="75" stroke="#333"/><line x1="440" y1="75" x2="460" y2="110" stroke="#333"/><line x1="440" y1="75" x2="420" y2="110" stroke="#333"/><line x1="440" y1="75" x2="400" y2="75" stroke="#333"/><line x1="420" y1="40" x2="460" y2="110" stroke="#333"/><line x1="460" y1="40" x2="420" y2="110" stroke="#333"/><text x="440" y="135" font-size="12" text-anchor="middle">図3</text></svg>',
    "steps": [
      {"question": "(図1)正六角形の中心から6等分してできた図で、斜線部分の面積はもとの正六角形の何倍ですか。",
       "answer": "1/6",
       "meaning": "正六角形の分割の基本パターン「中心から6等分」の1つ分にあたるので1/6倍。"},
      {"question": "(図2)正六角形を半分に区切る形の図で、斜線部分の面積はもとの正六角形の何倍ですか。",
       "answer": "1/3",
       "meaning": "「中心から6等分」のパターン2つ分にあたるので1/6×2＝1/3倍。"},
      {"question": "(図3)正六角形を星形に18等分した図で、斜線部分の面積はもとの正六角形の何倍ですか。",
       "answer": "1/3",
       "meaning": "「18等分」のパターン6つ分にあたるので1/18×6＝1/3倍。"},
    ],
  },
  {
    "id": "hd5s_26k1_11", "category": ZU, "unit": "平面図形（面積）",
    "title": "正六角形ABCDEFが72cm²",
    "intro": "円Oの中心のまわりの角を6等分してつくった正六角形ABCDEFの面積が72cm²です。",
    "star": 2, "hg": "HG-3712",
    "svg": '<svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg"><polygon points="130,20 210,60 210,150 130,190 50,150 50,60" fill="none" stroke="#888" stroke-width="3"/><rect x="50" y="60" width="160" height="90" fill="none" stroke="#1d3557" stroke-width="2" stroke-dasharray="5,3"/><text x="130" y="14" font-size="13" text-anchor="middle">A</text><text x="216" y="60" font-size="13">B</text><text x="216" y="155" font-size="13">C</text><text x="130" y="205" font-size="13" text-anchor="middle">D</text><text x="30" y="155" font-size="13">E</text><text x="30" y="60" font-size="13">F</text></svg>',
    "steps": [
      {"question": "長方形ACDFの面積を求めなさい。",
       "answer": "48",
       "meaning": "①長方形ACDFは正六角形の基本の分割パターンから、全体の2/3にあたる。②72×2/3＝48。→ 48cm²。"},
      {"question": "図の星形の斜線をつけた部分の面積を求めなさい。",
       "answer": "24",
       "meaning": "①「18等分」のパターン6つ分＝1/3にあたる。②72×1/3＝24。→ 24cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_12", "category": ZU, "unit": "平面図形（面積）",
    "title": "正六角形36cm²・㋐の三角形と㋑の四角形",
    "intro": "右図の正六角形の面積は36cm²です。図の中に㋐の三角形と㋑の四角形があります。",
    "star": 3, "hg": "HG-3713",
    "svg": '<svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg"><polygon points="130,20 210,60 210,150 130,190 50,150 50,60" fill="none" stroke="#888" stroke-width="3"/><circle cx="130" cy="105" r="3" fill="#333"/><polygon points="130,105 130,60 170,80" fill="#e63946" fill-opacity="0.4"/><text x="150" y="82" font-size="12">㋐</text><polygon points="130,105 170,130 130,190 90,130" fill="#1d3557" fill-opacity="0.3"/><text x="130" y="150" font-size="12" fill="#fff">㋑</text></svg>',
    "steps": [
      {"question": "正六角形の面積が36cm²のとき、㋐の三角形の面積を求めなさい。",
       "answer": "4",
       "meaning": "正六角形の1/6と1/18を組み合わせて考える。㋐＝36×(1/6−1/18)＝4。→ 4cm²。"},
      {"question": "正六角形の面積が36cm²のとき、㋑の四角形の面積を求めなさい。",
       "answer": "11",
       "meaning": "正六角形の1/3と1/36を組み合わせて考える。㋑＝36×(1/3−1/36)＝11。→ 11cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_13", "category": ZU, "unit": "平面図形（面積）",
    "title": "長方形を何本かの線で区切る・比",
    "intro": "下図は、長方形を何本かの線で区切ったもので、たて・横の線はそれぞれ長方形のたて・横の辺に平行です。斜線の部分の面積の比を、できるだけ簡単な整数の比で表しなさい。",
    "star": 3, "hg": "HG-3714",
    "steps": [
      {"question": "図のア:イを、できるだけ簡単な整数の比で求めなさい。",
       "answer": "2:1", "choices": ["2:1", "1:2", "3:1", "4:1"],
       "meaning": "①大問1と同じしくみで、ア○△×□●＝オ○△×□●よりア＝オ。②イはオの半分の面積なので、アの半分にあたる。③ア:イ＝2:1。"},
      {"question": "AB, BC, CDの長さがすべて等しいとき、図のウ:エを、できるだけ簡単な整数の比で求めなさい。",
       "answer": "1:3", "choices": ["1:3", "3:1", "1:2", "2:3"],
       "meaning": "①ウの部分は●▲の組み合わせ1つ分にあたる。②エの部分は(●●●▲▲▲)の組み合わせが3つ分にあたる。③ウ:エ＝1:3。"},
    ],
  },
  {
    "id": "hd5s_26k1_14", "category": ZU, "unit": "平面図形（面積）",
    "title": "平行四辺形の紙をBEで折る・角ア＝15度",
    "intro": "図1のように、平行四辺形ABCDの紙をBEを折り目として折ったところ、角アの大きさが15度になりました。BC＝10cmです。",
    "star": 3, "hg": "HG-3715",
    "svg": '<svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg"><polygon points="40,140 240,140 280,40 80,40" fill="none" stroke="#888" stroke-width="2"/><line x1="80" y1="40" x2="180" y2="140" stroke="#e63946" stroke-width="2" stroke-dasharray="5,3"/><text x="26" y="155" font-size="13">B</text><text x="245" y="155" font-size="13">C</text><text x="70" y="30" font-size="13">A</text><text x="285" y="30" font-size="13">D</text><text x="178" y="155" font-size="13">E</text><text x="95" y="115" font-size="12">ア=15°</text></svg>',
    "steps": [
      {"question": "Aから折り目BEに垂直な直線AFを引くとき、三角形AFBの面積を求めなさい。",
       "answer": "12.5",
       "meaning": "①折り返しで15度が2つできて30度になるので、もとの三角形は30度の三角形。②30度の三角形の高さは斜辺の半分になるので、高さ＝10×1/2＝5cm。面積は10×5÷2＝25cm²。③三角形AFBはその半分にあたるので25×1/2＝12.5cm²。"},
      {"question": "図2において、三角形ABCの面積と三角形ABDの面積の差を求めなさい。",
       "answer": "25",
       "meaning": "三角形ABCと三角形ABDの面積の差は、(1)でもとにした30度の三角形の面積と同じになるので25cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_15", "category": ZU, "unit": "平面図形（面積）",
    "title": "72cm²の正六角形をAを中心に回転",
    "intro": "面積が72cm²の正六角形を、点Aを中心にして回転させたところ、もとの正六角形と重なりの図ができました。",
    "star": 3, "hg": "HG-3716",
    "steps": [
      {"question": "下図の斜線の部分の面積を求めなさい。",
       "answer": "12",
       "meaning": "正六角形の分割パターンから、斜線部分は正六角形の1/3から1/6を引いた部分にあたる。72×(1/3−1/6)＝12。→ 12cm²。"},
    ],
  },
  {
    "id": "hd5s_26k1_16", "category": ZU, "unit": "平面図形（面積）",
    "title": "合同な正六角形2つを重ねる",
    "intro": "面積が60cm²の2つの合同な正六角形ABCDEFとPQRSTUを、次のように重ねます。",
    "star": 3, "hg": "HG-3717",
    "steps": [
      {"question": "図1のように、2つの正六角形の中心X, Yが、それぞれ他方の正六角形の辺QRと辺EFのまん中にあるように重ねるとき、重なっている部分の面積を求めなさい。",
       "answer": "25",
       "meaning": "①六角形の面積は(⑤+⑦)×2＝24にあたる分割で考える。⑤＝60×5/24＝12.5cm²。②重なる部分は12.5×2＝25cm²。"},
      {"question": "図2のように、頂点AとPが重なり、辺DEと辺RSがお互いのまん中で交わるように重ねるとき、重なっている部分の面積を求めなさい。",
       "answer": "40",
       "meaning": "①太線の三角形は全体の1/3のさらに半分＝1/6にあたる。②重なる部分は1/6+1/6＝1/3にあたるので、60×1/3＝20cm²。③これが2か所分あるので20×2＝40cm²。"},
    ],
  },
]

# ── 第2講座 No.26「速さ(6)」HG-3862〜3873（この回だけ12問）──────────
KOUZA2 = [
  {
    "id": "hd5s_26k2_1", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "太郎と次郎・引き返し",
    "intro": "16.5kmはなれたA、B両市があります。太郎君はA市から毎時6kmの速さで、次郎君はB市から毎時4kmの速さで、向かいあって進みます。次郎君が出発してから45分後に太郎君が出発し、2人が出会ってから2人ともすぐに引き返しました。太郎君がA市に帰ったのが午前10時ちょうどでした。",
    "star": 2, "hg": "HG-3862",
    "svg": '<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="50" x2="370" y2="50" stroke="#888" stroke-width="3"/><circle cx="30" cy="50" r="6" fill="#e63946"/><circle cx="370" cy="50" r="6" fill="#1d3557"/><text x="30" y="75" font-size="14" text-anchor="middle">A</text><text x="370" y="75" font-size="14" text-anchor="middle">B</text><text x="200" y="30" font-size="13" text-anchor="middle">16.5km</text></svg>',
    "steps": [
      {"question": "次郎君がB市に帰り着いたのは午前何時何分ですか。",
       "answer": "午前10時45分", "choices": ["午前10時45分", "午前10時", "午前10時30分", "午前11時"],
       "meaning": "①出会って別れたあと、太郎はA市まで、次郎はB市までそれぞれ引き返す。②次郎は太郎より45分おそく出発しているので、帰り着くのも太郎より45分おそくなる。③太郎が午前10時に着いたので、次郎はその45分後の午前10時45分。"},
    ],
  },
  {
    "id": "hd5s_26k2_2", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "本を渡しに引き返す",
    "intro": "360kmはなれた2地点A, Bがあります。朝8時に太郎君はAからBへ、同時に次郎君はBからAへ向かって出発しました。2人は途中で出会った後、太郎君はAへ、次郎君はBへ、きた時と同じ道を引き返す予定でした。ところが、2人が別れて12分後に太郎君は次郎君に本を渡すのを忘れていることに気がつき、ただちに折り返して次郎君のあとを追いました。太郎君は次郎君に追いついて本を渡して再びAへ向かいました。太郎君は時速50km、次郎君は時速40kmで進みます。",
    "star": 3, "hg": "HG-3863",
    "svg": '<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="50" x2="370" y2="50" stroke="#888" stroke-width="3"/><circle cx="30" cy="50" r="6" fill="#e63946"/><circle cx="370" cy="50" r="6" fill="#1d3557"/><circle cx="200" cy="50" r="5" fill="#333"/><text x="30" y="75" font-size="14" text-anchor="middle">A</text><text x="370" y="75" font-size="14" text-anchor="middle">B</text><text x="200" y="70" font-size="12" text-anchor="middle">出会い</text></svg>',
    "steps": [
      {"question": "太郎君が次郎君に追いついて本を渡した時刻を求めなさい（24時制で答えなさい）。",
       "answer": "14時", "choices": ["14時", "13時30分", "14時30分", "13時"],
       "meaning": "①出会うのは360÷(50+40)＝4時間後の12時。②2人はそこから引き返し始め、12分後（12時12分）に太郎が忘れ物に気づいて折り返す。そのときの2人のへだたりは50×12/60+40×12/60＝18km。③18÷(50−40)＝1.8時間かかるので、12時12分の1.8時間後＝14時。"},
      {"question": "太郎君がAに帰りついた時刻は、予定より何時間遅れましたか。",
       "answer": "3.6",
       "meaning": "予定外だったのは、追いかけて本を渡すために往復した時間。片道1.8時間の往復なので1.8×2＝3.6時間。"},
    ],
  },
  {
    "id": "hd5s_26k2_3", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "マラソン・愛さんと信子さん",
    "intro": "ある中学校で、A→B→C→D→Eのコースのマラソンをしました。全コースは3.3kmで、AB間は600m、BC間は1.2kmです。愛さんは、A地点からC地点まで毎分240mで走りましたが、腹痛のためC地点で30秒間立ちどまり、その後毎分150mで最後まで走り続けました。信子さんは、全コースを同じ速さで走り続けましたが、出発してから12分後にD地点で愛さんを追い越しました。",
    "star": 3, "hg": "HG-3864",
    "svg": '<svg viewBox="0 0 420 100" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="50" x2="390" y2="50" stroke="#888" stroke-width="3"/><circle cx="30" cy="50" r="5"/><circle cx="90" cy="50" r="5"/><circle cx="210" cy="50" r="5"/><circle cx="330" cy="50" r="5"/><circle cx="390" cy="50" r="5"/><text x="30" y="72" font-size="13" text-anchor="middle">A</text><text x="90" y="72" font-size="13" text-anchor="middle">B</text><text x="210" y="72" font-size="13" text-anchor="middle">C</text><text x="330" y="72" font-size="13" text-anchor="middle">D</text><text x="390" y="72" font-size="13" text-anchor="middle">E</text><text x="60" y="30" font-size="11" text-anchor="middle">600m</text><text x="150" y="30" font-size="11" text-anchor="middle">1.2km</text></svg>',
    "steps": [
      {"question": "愛さんがC地点に着いたのは、出発してから何分後ですか。",
       "answer": "7.5",
       "meaning": "AC間の距離は600+1200＝1800m。愛さんはこの区間を毎分240mで走ったので、1800÷240＝7.5分後。"},
      {"question": "AD間の道のりは何kmですか。",
       "answer": "2.4",
       "meaning": "①愛さんがCに着くのは7.5分後、30秒（0.5分）立ちどまるので、Cを出発するのは8分後。②信子さんがDで追い越すのは出発12分後なので、愛さんがCを出てからDに着くまでは12−8＝4分間。③CD間の距離は150×4＝600m。④AD間はAB+BC+CD＝600+1200+600＝2400m＝2.4km。"},
      {"question": "信子さんの速さは毎分何mですか。",
       "answer": "200",
       "meaning": "信子さんはAD間2400mを12分で走ったので、2400÷12＝200m/分。"},
    ],
  },
  {
    "id": "hd5s_26k2_4", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "えのき川・いろは丸とほへと丸",
    "intro": "しいたけ町のそばをえのき川が流れています。しいたけ町からえのき川の上流24kmのところにこんにゃく岩があり、さらに上流にはお茶滝があります。川の流れは一定で毎時5kmです。流れのないところでは、いろは丸は毎時25km、ほへと丸は毎時35kmで進みます。2隻とも午後1時半に出発しました。いろは丸はしいたけ町→こんにゃく岩（1時間観光）→しいたけ町、ほへと丸はしいたけ町→お茶滝（40分観光）→こんにゃく岩（14分観光）→しいたけ町と進みます。",
    "star": 3, "hg": "HG-3865",
    "svg": '<svg viewBox="0 0 420 100" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="50" x2="390" y2="50" stroke="#888" stroke-width="3"/><circle cx="30" cy="50" r="5" fill="#1d3557"/><circle cx="200" cy="50" r="5"/><circle cx="390" cy="50" r="5" fill="#e63946"/><text x="30" y="72" font-size="12" text-anchor="middle">しいたけ町</text><text x="200" y="72" font-size="12" text-anchor="middle">こんにゃく岩</text><text x="390" y="72" font-size="12" text-anchor="middle">お茶滝</text><text x="115" y="30" font-size="11" text-anchor="middle">24km</text><text x="200" y="16" font-size="11" text-anchor="middle">→上流</text></svg>',
    "steps": [
      {"question": "いろは丸がこんにゃく岩に到着するのは午後何時何分ですか。",
       "answer": "午後2時42分", "choices": ["午後2時42分", "午後2時30分", "午後3時", "午後2時48分"],
       "meaning": "いろは丸の上りの速さは25−5＝20km/時。24÷20＝1.2時間＝1時間12分。午後1時30分の1時間12分後＝午後2時42分。"},
      {"question": "いろは丸がしいたけ町にもどってくるのは午後何時何分ですか。",
       "answer": "午後4時30分", "choices": ["午後4時30分", "午後4時18分", "午後4時42分", "午後4時"],
       "meaning": "いろは丸の下りの速さは25+5＝30km/時。24÷30＝0.8時間＝48分。こんにゃく岩に着いた午後2時42分から観光1時間+下り48分後＝午後4時30分。"},
      {"question": "いろは丸とほへと丸は同時にしいたけ町にもどってきました。お茶滝はしいたけ町から何km上流にありますか。",
       "answer": "36",
       "meaning": "いろは丸の全行程は午後1時30分〜午後4時30分の3時間なので、ほへと丸も3時間で全行程を終える。ほへと丸の上り30km/時・下り40km/時、こんにゃく岩での観光14分、お茶滝での観光40分から式を立てると、お茶滝までの距離は36km。"},
    ],
  },
  {
    "id": "hd5s_26k2_5", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "オートバイの2人乗り・Bの歩いた道のり",
    "intro": "A, B, Cの3人が39kmはなれた所まで行くことになりました。Aはオートバイに乗っていますが、あと1人しか乗せられません。そこではじめにBだけ乗せて何kmか進み、BをおろしてBに歩いてもらい、歩いているCを迎えに引き返して乗せてくることにしました。すると3人は同時に出発し、同時に目的地に着きました。オートバイの速さは時速60km、B、Cの歩く速さは時速6kmです。",
    "star": 3, "hg": "HG-3866",
    "steps": [
      {"question": "Bの歩いた道のりを求めなさい。",
       "answer": "6",
       "meaning": "3人の動きを1枚の図に表し、区間の比を比あわせすると2:9:2になる。全体39kmをこの比で分けると、Bの歩いた道のりは39×2/(2+9+2)＝6km。"},
    ],
  },
  {
    "id": "hd5s_26k2_6", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "オートバイの進んだ道のり",
    "intro": "A, B, Cの3人が30kmはなれた所まで行くことになりました。Aはオートバイに乗っていますが、あと1人しか乗せられません。そこではじめにBだけ乗せて何kmか進み、BをおろしてBに歩いてもらい、歩いているCを迎えに引き返して乗せてくることにしました。すると3人は同時に出発し、同時に目的地に着きました。オートバイの速さは時速45km、B、Cの歩く速さは時速5kmです。",
    "star": 3, "hg": "HG-3867",
    "steps": [
      {"question": "オートバイの進んだ道のりを求めなさい。",
       "answer": "70",
       "meaning": "比あわせすると区間の比は1:4:1（5km:20km:5km）になる。オートバイは全体30kmを進みつつ、真ん中の20km区間をさらに1往復するので、30+20×2＝70km。"},
    ],
  },
  {
    "id": "hd5s_26k2_7", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "迎えの車・10分早く帰る",
    "intro": "お父さんの会社はいつも5時に終わり、その時刻に家から迎えの車がお父さんを乗せて家に送っていくことになっています。その日は早く仕事が終わったので、お父さんは4時には会社から家に向かって歩き出し、途中で迎えの車に乗って家に帰りました。そのため、普段より10分早く家に帰りつきました。",
    "star": 3, "hg": "HG-3868",
    "svg": '<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="50" x2="370" y2="50" stroke="#888" stroke-width="3"/><circle cx="30" cy="50" r="6" fill="#e63946"/><circle cx="370" cy="50" r="6" fill="#1d3557"/><text x="30" y="75" font-size="14" text-anchor="middle">家</text><text x="370" y="75" font-size="14" text-anchor="middle">会社</text></svg>',
    "steps": [
      {"question": "お父さんが迎えの車に乗ったのは4時何分ですか。",
       "answer": "4時55分", "choices": ["4時55分", "4時50分", "4時45分", "5時"],
       "meaning": "10分早く着いたのは、車が走らなくてすんだ距離の往復ぶん。片道は10÷2＝5分にあたるので、出会ったのは5時の5分前の4時55分。"},
      {"question": "車の速さはお父さんの速さの何倍ですか。",
       "answer": "11",
       "meaning": "お父さんは4時から4時55分までの55分間歩いた。この55分間で歩いた距離を車は5分で走ったことになるので、お父さんの55分＝車の5分。速さの比はたすきがけで1:11なので、車はお父さんの11倍。"},
    ],
  },
  {
    "id": "hd5s_26k2_8", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "迎えの車が40分おくれる",
    "intro": "お父さんの会社はいつも5時に終わり、その時刻に家から迎えの車がお父さんを乗せて家に送っていくことになっています。その日は迎えの車が家を出る時刻が40分おくれたので、お父さんは4時30分には会社から家に向かって歩き出し、途中で迎えの車に乗って家に帰りました。そのため、家に帰りついたのは普段より12分おくれていました。",
    "star": 3, "hg": "HG-3869",
    "svg": '<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg"><line x1="30" y1="50" x2="370" y2="50" stroke="#888" stroke-width="3"/><circle cx="30" cy="50" r="6" fill="#e63946"/><circle cx="370" cy="50" r="6" fill="#1d3557"/><text x="30" y="75" font-size="14" text-anchor="middle">家</text><text x="370" y="75" font-size="14" text-anchor="middle">会社</text></svg>',
    "steps": [
      {"question": "お父さんが迎えの車に乗ったのは5時何分ですか。",
       "answer": "5時26分", "choices": ["5時26分", "5時20分", "5時30分", "5時40分"],
       "meaning": "本来なら車は40分おくれて帰宅させるはずが、父と途中で出会ったため走らずにすんだ距離の往復ぶん短縮できた。実際のおくれは12分なので、短縮できたのは40−12＝28分。片道は28÷2＝14分。車がいつも出発する5時40分の14分前の5時26分に出会った。"},
      {"question": "車とお父さんの速さの比を求めなさい。",
       "answer": "4:1", "choices": ["4:1", "1:4", "3:1", "5:1"],
       "meaning": "お父さんは4時30分に会社を出て5時26分に車と出会ったので56分歩いた。車はこの区間を14分で走った。お父さんの56分＝車の14分なので、速さの比は車:お父さん＝56:14＝4:1。"},
    ],
  },
  {
    "id": "hd5s_26k2_9", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "山登りの行列と先生",
    "intro": "太郎君のクラスでは、ある日1列に並んで山登りをしました。先に頂上に行っていた先生は、行列の一番前にいる生徒が頂上につくとすぐ、後の生徒をはげますために、行列の一番うしろにいる太郎君のところまで行き、すぐ引き返して、行列のまん中の生徒と同時に頂上につきました。行列の長さは120mで、生徒は分速20mで進みます。先生は下りも上りも同じ速さで進みます。",
    "star": 3, "hg": "HG-3870",
    "steps": [
      {"question": "先生が頂上を下りはじめてから再び頂上につくまでに何分かかりましたか。",
       "answer": "3",
       "meaning": "先生の動きを直接追うのはむずかしいが、行列のまん中の生徒に注目すると、先生が下り始めてから頂上に戻るまでの間に、まん中の生徒は60m進んでいることがわかる。60÷20＝3分。"},
      {"question": "先生の速さを求めなさい。",
       "answer": "60",
       "meaning": "先生は下り始めてから3÷2＝1.5分後に一番うしろの生徒（太郎君）と出会う。そのときの先生と行列の後ろとの距離は120−20×1.5＝90m。先生はこの90mを1.5分で進んだことになるので、90÷1.5＝60m/分。"},
    ],
  },
  {
    "id": "hd5s_26k2_10", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "オートバイ・3人の速さがちがう",
    "intro": "A, B, Cの3人が44kmはなれた所まで行くことになりました。Aはオートバイに乗っていますが、あと1人しか乗せられません。そこではじめにBだけ乗せて何kmか進み、BをおろしてBに歩いてもらい、歩いているCを迎えに引き返して乗せてくることにしました。3人は同時に出発し、同時に目的地に着きました。時速はオートバイが36km、Bが4km、Cが6kmです。",
    "star": 3, "hg": "HG-3871",
    "steps": [
      {"question": "Cが歩いたのは何kmでしたか。",
       "answer": "10と2/3",
       "meaning": "比あわせすると区間の比は8:20:5になる。全体44kmをこの比で分けると、Cが歩いたのは44×8/(8+20+5)＝10と2/3km。"},
    ],
  },
  {
    "id": "hd5s_26k2_11", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "ひろかず君とお父さんの車",
    "intro": "おじさんの家に遊びに行っていたひろかず君は、歩いて家に帰る途中、おじさんの家を出てから12分後に、用事でおじさんの家に向かっているお父さんの車とすれちがいました。お父さんはおじさんの家で10分間用事をしてから、今来た道を車でもどり、途中でひろかず君に追いつき、そこからひろかず君を車に乗せて家にもどりました。もしお父さんがひろかず君とすれちがったときに、おじさんの家に行かずにすぐひろかず君を車に乗せて家に帰っていたなら、ひろかず君は実際より14分早く家にもどれていたそうです。ひろかず君の歩く速さと、お父さんの車の速さはそれぞれ常に一定です。",
    "star": 3, "hg": "HG-3872",
    "steps": [
      {"question": "お父さんの車の速さは、ひろかず君の歩く速さの何倍ですか。",
       "answer": "6",
       "meaning": "14分と10分の差の4分がどこから生まれるかを図で特定すると、ひろかずの12分ぶんの歩く距離を車が2分で走ったことに相当する（ひろかずの12分＝車の2分）。速さの比はたすきがけで1:6なので、車はひろかず君の6倍。"},
    ],
  },
  {
    "id": "hd5s_26k2_12", "category": HAYASA, "unit": "速さ（旅人算）",
    "title": "一郎君の忘れ物とバス",
    "intro": "一郎君は家から学校まで分速60mで歩いて通っています。ある日、おかあさんは一郎君の忘れ物に気づき、学校まで届けようと家から150mのバス停まで行き、分速600mのバスに乗りました。おかあさんがバスに乗ったちょうどそのとき、一郎君も忘れ物に気づき、分速90mでもどりました。しばらくして、おかあさんはバスの窓からすれちがう一郎君の姿を見たので、次のバス停で降り、分速120mでもどったところ、すれちがってから2分後に追いつきました。その後、一郎君は再び分速60mの速さで学校まで行ったところ、いつもより15分遅れて着きました。",
    "star": 3, "hg": "HG-3873",
    "steps": [
      {"question": "一郎君はいつもより何m多く歩きましたか。",
       "answer": "1080",
       "meaning": "もどった距離は90m/分×□分＝60m/分×△分の関係にあり、□+△＝15分（15分の遅れぶん）。たすきがけで□＝6分、△＝9分となる。多く歩いた距離はもどってまた同じ道を戻る往復ぶんなので、90×6×2＝1080m。"},
      {"question": "一郎君が忘れ物に気づいたのは、家を出てから何mの地点ですか。",
       "answer": "2910",
       "meaning": "忘れ物に気づいた地点は、おかあさんがバスに乗った地点（150m）から、バスと一郎君が近づく速さ（600+90）m/分で4分間進んだ距離をたして150+(600+90)×4＝2910m。"},
      {"question": "おかあさんがバスに乗っていた時間は何分何秒間ですか。",
       "answer": "4分5秒", "choices": ["4分5秒", "4分", "3分50秒", "4分15秒"],
       "meaning": "(2)で求めた図の続きから、おかあさんがバスに乗っていた時間を求めると4分5秒間となる。"},
    ],
  },
]


def build():
    for x in KOUZA1 + KOUZA2:
        x["grade"] = 5
        x["src"] = "%s 小5最レ 第3分冊 %s No.26 %s" % (
            x["hg"], "第1講座" if x in KOUZA1 else "第2講座", x["title"])
    return KOUZA1, KOUZA2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    k1, k2 = build()
    n1 = sum(len(x["steps"]) for x in k1)
    n2 = sum(len(x["steps"]) for x in k2)
    print("第1講座 No.26: 大問%d本・%d問" % (len(k1), n1))
    print("第2講座 No.26: 大問%d本・%d問" % (len(k2), n2))

    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"]["5"]["sairei"]
    node.setdefault("kouza1", {})
    node.setdefault("kouza2", {})
    if "26" in node["kouza1"] or "26" in node["kouza2"]:
        sys.exit("すでに No.26 が入っています。上書きしないので確認してください。")
    node["kouza1"]["26"] = k1
    node["kouza2"]["26"] = k2
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
