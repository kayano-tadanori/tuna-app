# -*- coding: utf-8 -*-
"""小5最レ 第3分冊 第1講座 No.22 / No.27 / No.28 の大問を、原本PDFの実測にもとづいて直す。

  使い方:  python scripts/_fix_s5sairei_w4_2.py [対象JSON]   (省略時 data/hama_daimon.json)

  ★冪等。欄まるごとの一致で判定する（cur == NEW なら「済み」／cur == OLD なら「適用」／
    どちらでもなければ止める）。末尾に足す・うしろを削る、といった部分置換はしない。
  ★図SVGを入れかえる大問は、入れる前に座標から角度・長さ・面積を計算し、
    問題文の数値と合わなければ assert で止まる（verify_geometry）。
  ★出どころ: C:/Users/User/Desktop/浜問題/5年算数最レ/5年_小5最レ算数_第3分冊_第1講座.pdf
    （本文 p8=PDF 7ページ目, p9=8ページ目, p10=9ページ目）を200dpiで書き出して目視確認した。
"""
import io, json, math, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon   # ★大問の走査は必ずここを通す（唯一の走査口）
OLD = {
 ('hd5s_27k1_11', ('svg',)): "<svg viewBox=\"0 0 320 198.3\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><polygon points=\"160,35 55,160 285,160\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><text x=\"160\" y=\"27\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">A</text><text x=\"48\" y=\"176\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">B</text><text x=\"293\" y=\"176\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">C</text><circle cx=\"141\" cy=\"160\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"141\" y=\"176\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">D</text><circle cx=\"210\" cy=\"108\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"219\" y=\"105\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">E</text><circle cx=\"112\" cy=\"95\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"103\" y=\"92\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">F</text><line x1=\"160\" y1=\"35\" x2=\"141\" y2=\"160\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"55\" y1=\"160\" x2=\"210\" y2=\"108\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"285\" y1=\"160\" x2=\"112\" y2=\"95\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><circle cx=\"152\" cy=\"100\" r=\"3\" fill=\"#ffd166\"/><text x=\"158\" y=\"96\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">P</text><text x=\"160\" y=\"190\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">BD:DC＝3:5、CE:EA＝3:2、三角形APEは4cm²</text></svg>",
 ('hd5s_27k1_11', ('steps', 0, 'meaning')): "①三角形APEの面積4cm²にCE:EAの比3:2をかけて三角形CPEの面積を4×3/2＝6cm²と求める。②BD:DCの比3:5を使って10×3/5＝6cm²の関係から三角形CPDの面積を10cm²と求める。③6×3/2＝9cm²で次の面積を求める。④9×3/8＝3と3/8cm²で三角形BDPの面積を求める。→ 答え 3と3/8cm²。",
 ('hd5s_27k1_12', ('svg',)): "<svg viewBox=\"0 0 320 198.3\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><polygon points=\"175,35 60,160 290,160\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><text x=\"175\" y=\"27\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">A</text><text x=\"53\" y=\"176\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">B</text><text x=\"298\" y=\"176\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">C</text><circle cx=\"93\" cy=\"128\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"84\" y=\"125\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">D</text><circle cx=\"191\" cy=\"160\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"191\" y=\"176\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">E</text><circle cx=\"235\" cy=\"105\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"244\" y=\"102\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">F</text><line x1=\"175\" y1=\"35\" x2=\"191\" y2=\"160\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"60\" y1=\"160\" x2=\"235\" y2=\"105\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"290\" y1=\"160\" x2=\"93\" y2=\"128\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><circle cx=\"184\" cy=\"118\" r=\"3\" fill=\"#ffd166\"/><text x=\"190\" y=\"114\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">P</text><text x=\"175\" y=\"190\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">Dは辺ABを5:2に、Eは辺BCを4:3に分ける</text></svg>",
 ('hd5s_27k1_12', ('steps', 0, 'meaning')): "①Dが5:2に分ける比とEが4:3に分ける比をそろえてから比あわせすると20:15:6の関係が出る。②三角形PABと三角形PBCの面積比は10:3になる。→ 答え 10:3。",
 ('hd5s_27k1_12', ('steps', 1, 'meaning')): "①同じ比あわせ20:15:6から、AF:FCも10:3になる。→ 答え 10:3。",
 ('hd5s_27k1_12', ('steps', 2, 'meaning')): "①三角形APBの面積と三角形PBEの面積の比が35:6になることから、AP:PE＝35:6が求まる。→ 答え 35:6。",
 ('hd5s_27k1_13', ('steps', 0, 'meaning')): "①三角形ABPの面積8cm²と、対応する面積㋐cm²の比が1×2:2×1＝1:1になることから㋐＝8cm²とわかる。②長方形全体48cm²から、AQD(12)+ABP(8)+㋐(8)を引くと、48−(12+8+8)＝20cm²。→ 答え 20cm²。",
 ('hd5s_27k1_14', ('title',)): "1cmと2cmの二等辺三角形を並べた内角120度の六角形（大問5と同じ骨）",
 ('hd5s_27k1_14', ('svg',)): "<svg viewBox=\"0 -1.8 330 218.2\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><circle cx=\"165\" cy=\"105\" r=\"78\" fill=\"none\" stroke=\"#9aa3c0\" stroke-width=\"1.6\"/><line x1=\"165\" y1=\"105\" x2=\"204.0\" y2=\"37.5\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"204.0\" y1=\"37.5\" x2=\"243.0\" y2=\"105.0\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><line x1=\"165\" y1=\"105\" x2=\"243.0\" y2=\"105.0\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"243.0\" y1=\"105.0\" x2=\"204.0\" y2=\"172.5\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><line x1=\"165\" y1=\"105\" x2=\"204.0\" y2=\"172.5\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"204.0\" y1=\"172.5\" x2=\"126.0\" y2=\"172.5\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><line x1=\"165\" y1=\"105\" x2=\"126.0\" y2=\"172.5\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"126.0\" y1=\"172.5\" x2=\"87.0\" y2=\"105.0\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><line x1=\"165\" y1=\"105\" x2=\"87.0\" y2=\"105.0\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"87.0\" y1=\"105.0\" x2=\"126.0\" y2=\"37.5\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><line x1=\"165\" y1=\"105\" x2=\"126.0\" y2=\"37.5\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"126.0\" y1=\"37.5\" x2=\"204.0\" y2=\"37.5\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><circle cx=\"165\" cy=\"105\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"165\" y=\"122\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">O</text><text x=\"243\" y=\"34\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">A</text><text x=\"204\" y=\"15\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text><text x=\"126\" y=\"15\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text><text x=\"80\" y=\"34\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">D</text><text x=\"80\" y=\"190\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">E</text><text x=\"243\" y=\"190\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">F</text><text x=\"206\" y=\"22\" font-size=\"10\" text-anchor=\"middle\" fill=\"#c9d4f0\">1cm</text><text x=\"124\" y=\"22\" font-size=\"10\" text-anchor=\"middle\" fill=\"#c9d4f0\">1cm</text><text x=\"82\" y=\"92\" font-size=\"10\" text-anchor=\"middle\" fill=\"#c9d4f0\">1cm</text><text x=\"112\" y=\"178\" font-size=\"10\" text-anchor=\"middle\" fill=\"#c9d4f0\">2cm</text><text x=\"218\" y=\"178\" font-size=\"10\" text-anchor=\"middle\" fill=\"#c9d4f0\">2cm</text><text x=\"248\" y=\"92\" font-size=\"10\" text-anchor=\"middle\" fill=\"#c9d4f0\">2cm</text><text x=\"165\" y=\"208\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">AB＝BC＝CD＝1cm／DE＝EF＝FA＝2cm</text></svg>",
 ('hd5s_27k1_14', ('steps', 0, 'meaning')): "①二等辺三角形の頂角○が6個、×が6個で合計720度になることから、○＋×＝120度とわかる。②これは内角120度の六角形なので、大問5と同じ道具（外側に正三角形を復元する）が使える。③4×4−1×1×3＝16−3＝13。→ 答え 13倍。",
 ('hd5s_27k1_15', ('title',)): "台形・等積変形とピラミッド（相似比は面積比の平方根）",
 ('hd5s_27k1_15', ('svg',)): "<svg viewBox=\"0 0 330 200.4\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><polygon points=\"95,40 250,40 285,155 60,155\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.8\"/><text x=\"89\" y=\"34\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">A</text><text x=\"256\" y=\"34\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">D</text><text x=\"53\" y=\"171\" font-size=\"12\" text-anchor=\"end\" fill=\"#c9d4f0\">B</text><text x=\"293\" y=\"171\" font-size=\"12\" text-anchor=\"start\" fill=\"#c9d4f0\">C</text><circle cx=\"172\" cy=\"40\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"172\" y=\"32\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">E</text><circle cx=\"200\" cy=\"155\" r=\"3\" fill=\"#c9d4f0\"/><text x=\"200\" y=\"171\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">G</text><line x1=\"60\" y1=\"155\" x2=\"250\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"172\" y1=\"40\" x2=\"200\" y2=\"155\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><circle cx=\"159\" cy=\"79\" r=\"3\" fill=\"#ffd166\"/><text x=\"150\" y=\"76\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">F</text><polygon points=\"172,40 250,40 285,155 200,155 159,79\" fill=\"rgba(255,209,102,0.22)\" stroke=\"#ffd166\" stroke-width=\"1.8\"/><text x=\"133\" y=\"34\" font-size=\"11\" text-anchor=\"middle\" fill=\"#9aa3c0\">‖</text><text x=\"211\" y=\"34\" font-size=\"11\" text-anchor=\"middle\" fill=\"#9aa3c0\">‖</text><text x=\"165\" y=\"192\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">AE＝ED／四角形ABFEは48cm²、三角形BGFは50cm²</text></svg>",
 ('hd5s_27k1_15', ('steps', 0, 'meaning')): "①等積変形の関係㋐+☆＝㋑+☆から、㋑＝48cm²になる。→ 答え 48cm²。",
 ('hd5s_27k1_15', ('steps', 1, 'meaning')): "①50:(50+48)＝25:49＝5×5:7×7となり、これが相似比の2乗の関係なので相似比は5:7とわかる。②BG:BC＝5:7からBG:GC＝5:2。→ 答え 5:2。",
 ('hd5s_27k1_15', ('steps', 2, 'meaning')): "①底辺比から面積比がわかる関係を使って㋐＝98cm²を求める。②すでにわかっている部分と㋐(98)を足して154cm²。→ 答え 154cm²。",
 ('hd5s_27k1_16', ('steps', 0, 'question')): "右図でAD:DB＝3:4、EC:CB＝2:1のとき、AF:FCを求めなさい。",
 ('hd5s_27k1_16', ('steps', 0, 'meaning')): "①斜線の三角形ADEと三角形DCEの面積比が、そのままAF:FCになる。②④×2/3の計算から、3:8/3＝9:8が求まる。→ 答え 9:8。",
 ('hd5s_27k1_16', ('steps', 1, 'question')): "右図でAB:BC＝4:3、AF:FD＝5:2のとき、CD:DEを求めなさい。",
 ('hd5s_27k1_16', ('steps', 1, 'meaning')): "①三角形BCDと三角形BDEの面積比が、そのままCD:DEになる。②④×2/5＝16の計算から、1.4:1.6＝7:8が求まる。→ 答え 7:8。",
 ('hd5s_28k1_15', ('intro',)): "100gが190円、160円、120円のA、B、C3種類の粉を混ぜ、CをBの2倍用いて、100gが150円の粉を作ります。値段でもてんびん法が使える（単位量あたりなら同じ骨）。",
 ('hd5s_28k1_15', ('steps', 0, 'meaning')): "CをBの2倍使うので、C(120円)を2、B(160円)を1として、Bのうでに合流させたてんびんを考える。A(190円)を□として、うで×重さのつり合いの式を立てる：2×30＝1×10+□×40 → 60＝10+40□ → □＝5/4。A:B＝5/4:1＝5:4。",
 ('hd5s_22k1_2', ('svg',)): "<svg viewBox=\"0 0 267 250\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><line x1=\"15\" y1=\"45\" x2=\"245\" y2=\"45\" stroke=\"#9aa3c0\" stroke-width=\"2\"/><text x=\"250\" y=\"49\" font-size=\"13\" text-anchor=\"start\" fill=\"#9aa3c0\">ℓ</text><line x1=\"15\" y1=\"215\" x2=\"245\" y2=\"215\" stroke=\"#9aa3c0\" stroke-width=\"2\"/><text x=\"250\" y=\"219\" font-size=\"13\" text-anchor=\"start\" fill=\"#9aa3c0\">m</text><polygon points=\"120,45 185,80 185,150 130,215 65,180 65,110\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"120\" y=\"38\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">A</text><text x=\"196\" y=\"80\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">F</text><text x=\"196\" y=\"155\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">E</text><text x=\"140\" y=\"231\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">D</text><text x=\"54\" y=\"186\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text><text x=\"54\" y=\"110\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">F</text><text x=\"56\" y=\"110\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text><text x=\"96\" y=\"62\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">40°</text><text x=\"104\" y=\"231\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">x°</text></svg>",
 ('hd5s_22k1_3', ('svg',)): "<svg viewBox=\"0 0 340 220\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><line x1=\"20\" y1=\"190\" x2=\"150\" y2=\"190\" stroke=\"#9aa3c0\" stroke-width=\"2\"/><text x=\"24\" y=\"206\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">A</text><text x=\"150\" y=\"206\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text><line x1=\"215\" y1=\"40\" x2=\"320\" y2=\"40\" stroke=\"#9aa3c0\" stroke-width=\"2\"/><text x=\"300\" y=\"32\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text><text x=\"322\" y=\"32\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">D</text><polyline points=\"150,190 205,140 245,140 215,95 300,40\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"140\" y=\"172\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">135°</text><text x=\"210\" y=\"160\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">100°</text><text x=\"252\" y=\"122\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">90°</text><text x=\"292\" y=\"60\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">x°</text></svg>",
 ('hd5s_22k1_3', ('steps', 0, 'question')): "A—B間で135°、100°、90°の順に折れ曲がってC—Dまで進むとき、xの値を求めなさい。",
 ('hd5s_22k1_3', ('steps', 0, 'meaning')): "①各折れ点にABとCDに平行な補助線を引くと、45°/55°/35°の角に分かれる。②x＝90+35＝125。",
 ('hd5s_22k1_4', ('svg',)): "<svg viewBox=\"0 0 460 200\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><text x=\"20\" y=\"26\" font-size=\"13\" text-anchor=\"start\" fill=\"#c9d4f0\">(1)</text><polygon points=\"40,160 175,160 110,50\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><line x1=\"175\" y1=\"160\" x2=\"230\" y2=\"160\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"66\" y=\"152\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">50°</text><text x=\"112\" y=\"76\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">60°</text><text x=\"196\" y=\"152\" font-size=\"14\" text-anchor=\"middle\" fill=\"#ffd166\">x</text><text x=\"265\" y=\"26\" font-size=\"13\" text-anchor=\"start\" fill=\"#c9d4f0\">(2)</text><polygon points=\"285,175 430,175 400,45\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><line x1=\"255\" y1=\"175\" x2=\"285\" y2=\"175\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"305\" y=\"167\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">50°</text><text x=\"378\" y=\"167\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">70°</text><text x=\"396\" y=\"78\" font-size=\"14\" text-anchor=\"middle\" fill=\"#ffd166\">x</text></svg>",
 ('hd5s_22k1_5', ('svg',)): "<svg viewBox=\"0 0 460 220\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><text x=\"20\" y=\"26\" font-size=\"13\" text-anchor=\"start\" fill=\"#c9d4f0\">(1)</text><polygon points=\"115,45 200,185 105,120 30,185\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"115\" y=\"38\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">60°</text><text x=\"52\" y=\"172\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">40°</text><text x=\"184\" y=\"172\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">20°</text><text x=\"108\" y=\"142\" font-size=\"14\" text-anchor=\"middle\" fill=\"#ffd166\">x</text><text x=\"265\" y=\"26\" font-size=\"13\" text-anchor=\"start\" fill=\"#c9d4f0\">(2)</text><polygon points=\"285,185 445,185 400,45\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><line x1=\"285\" y1=\"185\" x2=\"425\" y2=\"118\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"305\" y=\"177\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">70°</text><text x=\"425\" y=\"177\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">20°</text><text x=\"398\" y=\"82\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">30°</text><text x=\"392\" y=\"120\" font-size=\"14\" text-anchor=\"middle\" fill=\"#ffd166\">x</text></svg>",
 ('hd5s_22k1_5', ('steps', 1, 'question')): "図(2)のように三角形の中を補助線が通っていて、3つの角が30°、70°、20°であるとき、xの大きさを求めなさい。",
 ('hd5s_22k1_5', ('steps', 1, 'meaning')): "①三角形の内角の和は180°。②x＝180−(30+70+20)＝60度。",
 ('hd5s_22k1_6', ('svg',)): "<svg viewBox=\"0 0 280 250\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><polygon points=\"150,25 45,205 255,205\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"150\" y=\"18\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">A</text><text x=\"36\" y=\"221\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text><text x=\"262\" y=\"221\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">C</text><polygon points=\"140,70 195,110 185,175 118,175 96,108\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"134\" y=\"62\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">D</text><text x=\"205\" y=\"108\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">H</text><text x=\"192\" y=\"192\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">G</text><text x=\"112\" y=\"192\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">F</text><text x=\"86\" y=\"106\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">E</text><text x=\"150\" y=\"196\" font-size=\"11\" text-anchor=\"middle\" fill=\"#c9d4f0\">15°</text><text x=\"210\" y=\"132\" font-size=\"14\" text-anchor=\"middle\" fill=\"#ffd166\">x</text></svg>",
 ('hd5s_22k1_6', ('steps', 0, 'question')): "三角形ABCは正三角形、五角形DEFGHは正五角形で、角Fが15°であるとき、角xの大きさを求めなさい。",
 ('hd5s_22k1_6', ('steps', 0, 'meaning')): "①正五角形の1つの内角は108°。②正三角形の60°の角を利用すると、108＝15+60+xの関係が成り立つ。③x＝33度。",
 ('hd5s_22k1_7', ('steps', 0, 'meaning')): "①DA＝DBより二等辺三角形なので、角DAB＝角DBAを①とおける。②DB＝BCより角BDC＝角BCDが決まり、外角の関係から角Aの2倍の②とおける。③三角形の内角の和より①+②+②＝180。④①＝36度。",
 ('hd5s_22k1_8', ('intro',)): "次の問いに答えなさい。大問7と同じ考え方を、もう1段深く使います。答えが分数の角度になってもかまいません。",
 ('hd5s_22k1_8', ('steps', 0, 'meaning')): "①大問7と同じように、辺の等しさから角を①に置きかえていく。②連鎖が1段深くなるので、内角の和の式は⑦＝180になる。③①＝25と5/7度。",
 ('hd5s_22k1_9', ('svg',)): "<svg viewBox=\"0 0 240 262.3\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><polygon points=\"150,25 60,225 175,225\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"2\"/><text x=\"150\" y=\"18\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">O</text><text x=\"50\" y=\"241\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">A</text><text x=\"182\" y=\"241\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text><polyline points=\"150,25 108,140 163,175 60,225 175,225\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1\"/><text x=\"148\" y=\"46\" font-size=\"13\" text-anchor=\"middle\" fill=\"#ffd166\">x</text><text x=\"120\" y=\"254\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">OA＝OB／同じ印の辺はすべて等しい</text></svg>",
 ('hd5s_22k1_9', ('steps', 0, 'meaning')): "①大問7・8と同じように、辺の等しさから角を①に置きかえていく。②この図では内角の和の式が⑨＝180になる（最も長い連鎖）。③①＝20度。",
}

# ---------------------------------------------------------------------------
# 新しい図SVG（座標は下の verify_geometry() で検算してから使う）
# ---------------------------------------------------------------------------
SVG_22_2 = '<svg viewBox="0 0 267 250" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><line x1="15" y1="45" x2="245" y2="45" stroke="#9aa3c0" stroke-width="2"/><text x="250" y="49" font-size="13" text-anchor="start" fill="#9aa3c0">\u2113</text><line x1="15" y1="215" x2="245" y2="215" stroke="#9aa3c0" stroke-width="2"/><text x="250" y="219" font-size="13" text-anchor="start" fill="#9aa3c0">m</text><polygon points="110,45 43.9,100.5 58.9,185.5 140,215 206.1,159.5 191.1,74.5" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="110" y="38" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text><text x="34" y="104" font-size="12" text-anchor="end" fill="#c9d4f0">B</text><text x="49" y="190" font-size="12" text-anchor="end" fill="#c9d4f0">C</text><text x="150" y="231" font-size="12" text-anchor="middle" fill="#c9d4f0">D</text><text x="216" y="163" font-size="12" text-anchor="start" fill="#c9d4f0">E</text><text x="200" y="72" font-size="12" text-anchor="start" fill="#c9d4f0">F</text><text x="70" y="59" font-size="12" text-anchor="middle" fill="#c9d4f0">40\u00b0</text><path d="M 114 215 A 26 26 0 0 1 115.56 206.11" fill="none" stroke="#ffd166" stroke-width="1.6"/><text x="71" y="203" font-size="13" text-anchor="middle" fill="#ffd166">x\u00b0</text></svg>'

SVG_22_3 = '<svg viewBox="0 0 340 220" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><line x1="15" y1="190" x2="120" y2="190" stroke="#9aa3c0" stroke-width="2"/><text x="15" y="206" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text><text x="120" y="206" font-size="12" text-anchor="middle" fill="#c9d4f0">B</text><line x1="288.2" y1="45" x2="335" y2="45" stroke="#9aa3c0" stroke-width="2"/><text x="283" y="38" font-size="12" text-anchor="middle" fill="#c9d4f0">C</text><text x="331" y="38" font-size="12" text-anchor="middle" fill="#c9d4f0">D</text><polyline points="120,190 165,145 200.7,170 288.2,45" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="108" y="162" font-size="12" text-anchor="middle" fill="#c9d4f0">135\u00b0</text><text x="167" y="173" font-size="12" text-anchor="middle" fill="#c9d4f0">100\u00b0</text><text x="196" y="144" font-size="12" text-anchor="middle" fill="#c9d4f0">90\u00b0</text><text x="302" y="72" font-size="13" text-anchor="middle" fill="#ffd166">x\u00b0</text></svg>'

SVG_22_4 = '<svg viewBox="0 0 460 200" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><text x="20" y="26" font-size="13" text-anchor="start" fill="#c9d4f0">(1)</text><polygon points="40,160 175,160 110,50" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="175" y1="160" x2="230" y2="160" stroke="#4f9eff" stroke-width="2"/><text x="66" y="152" font-size="12" text-anchor="middle" fill="#c9d4f0">50\u00b0</text><text x="112" y="76" font-size="12" text-anchor="middle" fill="#c9d4f0">60\u00b0</text><text x="196" y="152" font-size="14" text-anchor="middle" fill="#ffd166">x</text><text x="265" y="26" font-size="13" text-anchor="start" fill="#c9d4f0">(2)</text><polygon points="270,175 328,175 372.6,52.8" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="328" y1="175" x2="440" y2="175" stroke="#4f9eff" stroke-width="2"/><text x="299" y="162" font-size="12" text-anchor="middle" fill="#c9d4f0">50\u00b0</text><text x="356" y="156" font-size="12" text-anchor="middle" fill="#c9d4f0">70\u00b0</text><text x="357" y="81" font-size="14" text-anchor="middle" fill="#ffd166">x</text></svg>'

SVG_22_5 = '<svg viewBox="0 0 460 220" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><text x="20" y="26" font-size="13" text-anchor="start" fill="#c9d4f0">(1)</text><polygon points="110,45 197.5,185 142.3,141.8 35.5,185" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="111" y="88" font-size="12" text-anchor="middle" fill="#c9d4f0">60\u00b0</text><text x="67" y="157" font-size="12" text-anchor="middle" fill="#c9d4f0">40\u00b0</text><text x="159" y="146" font-size="11" text-anchor="middle" fill="#c9d4f0">20\u00b0</text><text x="139" y="168" font-size="14" text-anchor="middle" fill="#ffd166">x</text><text x="265" y="26" font-size="13" text-anchor="start" fill="#c9d4f0">(2)</text><polygon points="341.1,30.9 285,185 445,185" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="341.1" y1="30.9" x2="368.3" y2="185" stroke="#4f9eff" stroke-width="2"/><line x1="303.7" y1="133.6" x2="445" y2="185" stroke="#4f9eff" stroke-width="2"/><text x="335" y="105" font-size="12" text-anchor="middle" fill="#c9d4f0">30\u00b0</text><text x="315" y="164" font-size="12" text-anchor="middle" fill="#c9d4f0">70\u00b0</text><text x="395" y="180" font-size="12" text-anchor="middle" fill="#c9d4f0">20\u00b0</text><text x="348" y="137" font-size="14" text-anchor="middle" fill="#ffd166">x</text></svg>'

SVG_22_6 = '<svg viewBox="0 0 280 250" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><polygon points="150,23.1 45,205 255,205" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="150" y="16" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text><text x="36" y="221" font-size="12" text-anchor="middle" fill="#c9d4f0">B</text><text x="264" y="221" font-size="12" text-anchor="middle" fill="#c9d4f0">C</text><polygon points="129.3,82.6 81.7,141.5 122.9,205 196.1,185.4 200,109.8" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="136" y="76" font-size="12" text-anchor="middle" fill="#c9d4f0">D</text><text x="73" y="146" font-size="12" text-anchor="end" fill="#c9d4f0">E</text><text x="123" y="221" font-size="12" text-anchor="middle" fill="#c9d4f0">F</text><text x="203" y="181" font-size="12" text-anchor="start" fill="#c9d4f0">G</text><text x="208" y="106" font-size="12" text-anchor="start" fill="#c9d4f0">H</text><line x1="150" y1="205" x2="150" y2="214" stroke="#9aa3c0" stroke-width="1.4"/><text x="154" y="224" font-size="11" text-anchor="start" fill="#c9d4f0">15\u00b0</text><text x="209" y="149" font-size="14" text-anchor="middle" fill="#ffd166">x</text></svg>'

SVG_22_9 = '<svg viewBox="0 0 240 262.3" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><polygon points="120,25 84.7,225 155.3,225" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="120" y="18" font-size="12" text-anchor="middle" fill="#c9d4f0">O</text><text x="75" y="241" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text><text x="165" y="241" font-size="12" text-anchor="middle" fill="#c9d4f0">B</text><polyline points="120,25 132.25,94.48 96.99,155.55 151,200.85 84.7,225 155.3,225" fill="none" stroke="#4f9eff" stroke-width="1.4"/><line x1="130.1" y1="59.1" x2="122.2" y2="60.4" stroke="#4f9eff" stroke-width="1.4"/><line x1="111.2" y1="123" x2="118.1" y2="127" stroke="#4f9eff" stroke-width="1.4"/><line x1="126.6" y1="175.1" x2="121.4" y2="181.3" stroke="#4f9eff" stroke-width="1.4"/><line x1="116.5" y1="209.2" x2="119.2" y2="216.7" stroke="#4f9eff" stroke-width="1.4"/><line x1="120" y1="221" x2="120" y2="229" stroke="#4f9eff" stroke-width="1.4"/><text x="119" y="82" font-size="13" text-anchor="middle" fill="#ffd166">x</text><text x="120" y="254" font-size="10" text-anchor="middle" fill="#9aa3c0">OA\uff1dOB\uff0f\u540c\u3058\u5370\u306e\u8fba\u306f\u3059\u3079\u3066\u7b49\u3057\u3044</text></svg>'

SVG_27_11 = '<svg viewBox="0 0 320 198.3" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><polygon points="160,35 55,160 285,160" fill="none" stroke="#4f9eff" stroke-width="1.8"/><text x="160" y="27" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text><text x="48" y="176" font-size="12" text-anchor="end" fill="#c9d4f0">B</text><text x="293" y="176" font-size="12" text-anchor="start" fill="#c9d4f0">C</text><line x1="160" y1="35" x2="141.25" y2="160" stroke="#4f9eff" stroke-width="1.6"/><line x1="55" y1="160" x2="210" y2="85" stroke="#4f9eff" stroke-width="1.6"/><line x1="285" y1="160" x2="104.7" y2="100.8" stroke="#4f9eff" stroke-width="1.6"/><circle cx="141.25" cy="160" r="3" fill="#c9d4f0"/><text x="141" y="176" font-size="12" text-anchor="middle" fill="#c9d4f0">D</text><circle cx="210" cy="85" r="3" fill="#c9d4f0"/><text x="219" y="82" font-size="12" text-anchor="start" fill="#c9d4f0">E</text><circle cx="104.7" cy="100.8" r="3" fill="#c9d4f0"/><text x="96" y="98" font-size="12" text-anchor="end" fill="#c9d4f0">F</text><circle cx="148" cy="115" r="3" fill="#ffd166"/><text x="155" y="110" font-size="11" text-anchor="start" fill="#c9d4f0">P</text><text x="160" y="190" font-size="10" text-anchor="middle" fill="#9aa3c0">BD:DC\uff1d3:5\u3001CE:EA\uff1d3:2\u3001\u4e09\u89d2\u5f62APE\u306f4cm\u00b2</text></svg>'

SVG_27_12 = '<svg viewBox="0 0 320 198.3" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><polygon points="175,35 60,160 290,160" fill="none" stroke="#4f9eff" stroke-width="1.8"/><text x="175" y="27" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text><text x="53" y="176" font-size="12" text-anchor="end" fill="#c9d4f0">B</text><text x="298" y="176" font-size="12" text-anchor="start" fill="#c9d4f0">C</text><line x1="175" y1="35" x2="191.4" y2="160" stroke="#4f9eff" stroke-width="1.6"/><line x1="60" y1="160" x2="263.5" y2="131.2" stroke="#4f9eff" stroke-width="1.6"/><line x1="290" y1="160" x2="92.9" y2="124.3" stroke="#4f9eff" stroke-width="1.6"/><circle cx="92.9" cy="124.3" r="3" fill="#c9d4f0"/><text x="84" y="121" font-size="12" text-anchor="end" fill="#c9d4f0">D</text><circle cx="191.4" cy="160" r="3" fill="#c9d4f0"/><text x="191" y="176" font-size="12" text-anchor="middle" fill="#c9d4f0">E</text><circle cx="263.5" cy="131.2" r="3" fill="#c9d4f0"/><text x="272" y="128" font-size="12" text-anchor="start" fill="#c9d4f0">F</text><circle cx="189" cy="141.8" r="3" fill="#ffd166"/><text x="195" y="138" font-size="11" text-anchor="start" fill="#c9d4f0">P</text><text x="175" y="190" font-size="10" text-anchor="middle" fill="#9aa3c0">D\u306f\u8fabAB\u30925:2\u306b\u3001E\u306f\u8fabBC\u30924:3\u306b\u5206\u3051\u308b</text></svg>'

SVG_27_14 = '<svg viewBox="0 -1.8 330 218.2" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><circle cx="165" cy="105" r="78" fill="none" stroke="#9aa3c0" stroke-width="1.6"/><line x1="165" y1="105" x2="99.35" y2="62.88" stroke="#4f9eff" stroke-width="1.4"/><line x1="165" y1="105" x2="139.46" y2="31.3" stroke="#4f9eff" stroke-width="1.4"/><line x1="165" y1="105" x2="190.52" y2="31.29" stroke="#4f9eff" stroke-width="1.4"/><line x1="165" y1="105" x2="230.65" y2="62.87" stroke="#4f9eff" stroke-width="1.4"/><line x1="165" y1="105" x2="216.07" y2="163.96" stroke="#4f9eff" stroke-width="1.4"/><line x1="165" y1="105" x2="113.94" y2="163.97" stroke="#4f9eff" stroke-width="1.4"/><polygon points="99.35,62.88 139.46,31.3 190.52,31.29 230.65,62.87 216.07,163.96 113.94,163.97" fill="none" stroke="#4f9eff" stroke-width="1.8"/><circle cx="165" cy="105" r="3" fill="#c9d4f0"/><text x="165" y="122" font-size="12" text-anchor="middle" fill="#c9d4f0">O</text><text x="92" y="59" font-size="12" text-anchor="end" fill="#c9d4f0">A</text><text x="135" y="17" font-size="12" text-anchor="middle" fill="#c9d4f0">B</text><text x="195" y="17" font-size="12" text-anchor="middle" fill="#c9d4f0">C</text><text x="238" y="59" font-size="12" text-anchor="start" fill="#c9d4f0">D</text><text x="222" y="179" font-size="12" text-anchor="start" fill="#c9d4f0">E</text><text x="108" y="179" font-size="12" text-anchor="end" fill="#c9d4f0">F</text><text x="111" y="36" font-size="10" text-anchor="middle" fill="#c9d4f0">1cm</text><text x="165" y="17" font-size="10" text-anchor="middle" fill="#c9d4f0">1cm</text><text x="219" y="36" font-size="10" text-anchor="middle" fill="#c9d4f0">1cm</text><text x="247" y="117" font-size="10" text-anchor="middle" fill="#c9d4f0">2cm</text><text x="165" y="194" font-size="10" text-anchor="middle" fill="#c9d4f0">2cm</text><text x="83" y="117" font-size="10" text-anchor="middle" fill="#c9d4f0">2cm</text><text x="165" y="208" font-size="10" text-anchor="middle" fill="#9aa3c0">AB\uff1dBC\uff1dCD\uff1d1cm\uff0fDE\uff1dEF\uff1dFA\uff1d2cm</text></svg>'

SVG_27_15 = '<svg viewBox="0 0 330 200.4" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><polygon points="95,40 223,40 284,155 60,155" fill="none" stroke="#4f9eff" stroke-width="1.8"/><text x="89" y="34" font-size="12" text-anchor="end" fill="#c9d4f0">A</text><text x="229" y="34" font-size="12" text-anchor="start" fill="#c9d4f0">D</text><text x="53" y="171" font-size="12" text-anchor="end" fill="#c9d4f0">B</text><text x="292" y="171" font-size="12" text-anchor="start" fill="#c9d4f0">C</text><line x1="60" y1="155" x2="223" y2="40" stroke="#4f9eff" stroke-width="1.6"/><line x1="159" y1="40" x2="220" y2="155" stroke="#4f9eff" stroke-width="1.6"/><polygon points="176.4,72.9 223,40 284,155 220,155" fill="rgba(255,209,102,0.22)" stroke="#ffd166" stroke-width="1.8"/><circle cx="159" cy="40" r="3" fill="#c9d4f0"/><text x="159" y="32" font-size="12" text-anchor="middle" fill="#c9d4f0">E</text><circle cx="220" cy="155" r="3" fill="#c9d4f0"/><text x="220" y="171" font-size="12" text-anchor="middle" fill="#c9d4f0">G</text><circle cx="176.4" cy="72.9" r="3" fill="#ffd166"/><text x="167" y="70" font-size="11" text-anchor="end" fill="#c9d4f0">F</text><text x="127" y="34" font-size="11" text-anchor="middle" fill="#9aa3c0">\u2016</text><text x="191" y="34" font-size="11" text-anchor="middle" fill="#9aa3c0">\u2016</text><text x="165" y="192" font-size="10" text-anchor="middle" fill="#9aa3c0">AE\uff1dED\uff0f\u56db\u89d2\u5f62ABFE\u306f48cm\u00b2\u3001\u4e09\u89d2\u5f62BGF\u306f50cm\u00b2</text></svg>'

# ---------------------------------------------------------------------------
# 新しい中身（欄まるごと）
# ---------------------------------------------------------------------------
NEW = {}

# ■ hd5s_27k1_11（HG-3728）AD,BE,CFが1点Pで交わる型
#   ・図: E が辺CAの上に無かった（23px ずれ）／P が3本のチェバ線の交点になっていなかった → 実測して描き直す
#   ・解説②が「10cm² は三角形CPD」と書いていた（正しくは三角形APC。6cm² が三角形APB）
NEW[("hd5s_27k1_11", ("svg",))] = SVG_27_11
NEW[("hd5s_27k1_11", ("steps", 0, "meaning"))] = (
    "①CE:EA＝3:2なので、三角形CPEの面積は三角形APEの3/2倍。4×3/2＝6cm²。"
    "合わせて三角形APC＝4+6＝10cm²。"
    "②三角形ABDと三角形ACD、三角形PBDと三角形PCDは、どちらも高さが同じでBD:DC＝3:5だから面積の比も3:5。"
    "その差をとると三角形APB:三角形APC＝3:5になるので、三角形APB＝10×3/5＝6cm²。"
    "③同じように三角形BPC:三角形APB＝CE:EA＝3:2なので、三角形BPC＝6×3/2＝9cm²。"
    "④三角形BDPは三角形BPCのBD:BC＝3:8にあたるので、9×3/8＝3と3/8cm²。→ 答え 3と3/8cm²。"
)

# ■ hd5s_27k1_12（HG-3729）AE,BF,CDが1点Pで交わる型
#   ・図: F の位置が辺CAの上でずれていた（AF:FC が図では約1.2 で、答えの10:3＝3.33 と大きく食いちがう）
#   ・解説: 20:15:6 が何の比なのか書いていなかった
NEW[("hd5s_27k1_12", ("svg",))] = SVG_27_12
NEW[("hd5s_27k1_12", ("steps", 0, "meaning"))] = (
    "①CDは辺ABの上のDを通るので、三角形PCA:三角形PCB＝AD:DB＝5:2。"
    "②AEは辺BCの上のEを通るので、三角形PAB:三角形PAC＝BE:EC＝4:3。"
    "③三角形PCAをそろえて比あわせすると、三角形PAB:三角形PCA:三角形PBC＝20:15:6。"
    "④よって三角形PABと三角形PBCの面積の比は20:6＝10:3。→ 答え 10:3。"
)
NEW[("hd5s_27k1_12", ("steps", 1, "meaning"))] = (
    "①BFは辺CAの上のFを通るので、AF:FC＝三角形PAB:三角形PCB。"
    "②(1)の比あわせより 20:6＝10:3。→ 答え 10:3。"
)
NEW[("hd5s_27k1_12", ("steps", 2, "meaning"))] = (
    "①(1)の比あわせで、三角形PAB＝20、三角形PBC＝6とおける。"
    "②三角形PBEは三角形PBCのBE:BC＝4:7にあたるので、6×4/7＝24/7。"
    "③A、P、Eは一直線上にあるので、AP:PE＝三角形PAB:三角形PBE＝20:24/7＝140:24＝35:6。→ 答え 35:6。"
)

# ■ hd5s_27k1_13（HG-3730）48cm²の長方形
#   ・解説の「㋐」が何なのか書いていなかった（「1×2:2×1」も意味が取れない）
NEW[("hd5s_27k1_13", ("steps", 0, "meaning"))] = (
    "①三角形ABPの面積は、長方形の半分（48÷2＝24cm²）のBP:BC倍。8÷24＝1/3なのでBP:PC＝1:2。"
    "②三角形AQDの面積も長方形の半分24cm²のDQ:DC倍。12÷24＝1/2なのでDQ:QC＝1:1。"
    "③三角形PCQ＝PC×CQ÷2で、PCはBCの2/3、CQはDCの1/2だから、長方形の 2/3×1/2÷2＝1/6 にあたる。48×1/6＝8cm²。"
    "④三角形APQ＝48−(8+12+8)＝20cm²。→ 答え 20cm²。"
)

# ■ hd5s_27k1_14（HG-3731）1cmと2cmの二等辺三角形6個
#   ・題に「（大問5と同じ骨）」＝制作側の言葉が漏れていた
#   ・図が半径78の正六角形＝6本の弦がぜんぶ同じ長さで、1cm×3・2cm×3という問題文と矛盾していた
#   ・頂点A〜Fのラベルが頂点とずれていた／解説の「大問5と同じ道具」「4×4−1×1×3」が説明なしだった
NEW[("hd5s_27k1_14", ("title",))] = "1cmと2cmの二等辺三角形を並べた内角120度の六角形"
NEW[("hd5s_27k1_14", ("svg",))] = SVG_27_14
NEW[("hd5s_27k1_14", ("steps", 0, "meaning"))] = (
    "①三角形6個の角をぜんぶ足すと180×6＝1080度。そのうちOのまわりの角が360度なので、"
    "底角の合計は1080−360＝720度。1cmの三角形の底角を○、2cmの三角形の底角を×とすると"
    "6○+6×＝720だから、○+×＝120度。"
    "②6個の三角形はOのまわりで順番を入れかえても面積は変わらないので、"
    "1cm・2cm・1cm・2cm・1cm・2cmと交ごに並べかえる。すると六角形のどの角も○+×＝120度になる。"
    "③2cmの辺3本をまっすぐのばすと1辺4cmの正三角形ができ、角に1辺1cmの正三角形が3つはみ出す形になる。"
    "④1辺1cmの正三角形1つぶんを1とすると、1辺4cmの正三角形は4×4＝16。16−1×1×3＝13。→ 答え 13倍。"
)

# ■ hd5s_27k1_15（HG-3732）台形・等積変形
#   ・図の斜線部が E,D,C,G（＝平行四辺形EDCG）になっていた。それでは56cm²で、答えの48cm²と合わない。
#     正しくは F,D,C,G。しかも F が BD とも EG とも交わらない位置（23pxずれ）に打たれていた → 実測して描き直す
#   ・題の「平方根」は小5の言葉ではない
#   ・解説の㋐・㋑・☆が何なのか書いていなかった
NEW[("hd5s_27k1_15", ("title",))] = "台形・等積変形と相似（面積の比から辺の比を読む）"
NEW[("hd5s_27k1_15", ("svg",))] = SVG_27_15
NEW[("hd5s_27k1_15", ("steps", 0, "meaning"))] = (
    "①ADとBCが平行、CDとGEも平行だから、四角形EDCGは平行四辺形。その面積は ED×(台形の高さ)。"
    "②AE＝EDよりEDはADの半分なので、平行四辺形EDCGの面積＝AD÷2×高さ＝三角形ABDの面積と同じ。"
    "③三角形ABDは 四角形ABFE+三角形EFD、平行四辺形EDCGは 斜線部分+三角形EFD。"
    "同じ三角形EFDをのぞくと、四角形ABFE＝斜線部分。だから斜線部分は48cm²。→ 答え 48cm²。"
)
NEW[("hd5s_27k1_15", ("steps", 1, "meaning"))] = (
    "①GEとCDが平行なので、三角形BGFと三角形BCDは形が同じ（相似）。"
    "②三角形BCDは三角形BGFと斜線部分を合わせたものだから 50+48＝98cm²。"
    "③面積の比が 50:98＝25:49＝5×5:7×7 なので、辺の比は BG:BC＝5:7。"
    "④BG:GC＝5:(7−5)＝5:2。→ 答え 5:2。"
)
NEW[("hd5s_27k1_15", ("steps", 2, "meaning"))] = (
    "①EDCGは平行四辺形なのでGC＝ED＝ADの半分。(2)よりBG:GC＝5:2だから、GCを②とするとBC＝⑤+②＝⑦、AD＝④。"
    "②三角形ABDと三角形BCDは高さが同じなので、面積の比はAD:BC＝4:7。"
    "三角形BCD＝98cm²だから三角形ABD＝98×4/7＝56cm²。"
    "③台形ABCD＝56+98＝154cm²。→ 答え 154cm²。"
)

# ■ hd5s_27k1_16（HG-3733）三角形の外に飛び出す形
#   ・「右図で」だがアプリでは図は設問の上にある
#   ・解説の「④×2/3の計算から」「④×2/5＝16」が原簿の走り書きのままで、子どもには読み解けない
NEW[("hd5s_27k1_16", ("steps", 0, "question"))] = "図(1)で、AD:DB＝3:4、EC:CB＝2:1のとき、AF:FCを求めなさい。"
NEW[("hd5s_27k1_16", ("steps", 0, "meaning"))] = (
    "①Fは直線ACと直線DEが交わった点。DEを共通の底辺と見ると、"
    "三角形ADEと三角形CDEの高さの比がそのままAF:FCになる。"
    "②三角形ABEの面積を7とすると、AD:DB＝3:4より三角形ADE＝3、三角形DBE＝4。"
    "③CはBEをBC:CE＝1:2に分ける点なので、三角形DCE＝4×2/3＝8/3。"
    "④AF:FC＝3:8/3＝9:8。→ 答え 9:8。"
)
NEW[("hd5s_27k1_16", ("steps", 1, "question"))] = "図(2)で、AB:BC＝4:3、AF:FD＝5:2のとき、CD:DEを求めなさい。"
NEW[("hd5s_27k1_16", ("steps", 1, "meaning"))] = (
    "①Fは直線ADと直線BEが交わった点。BEを共通の底辺と見ると AF:FD＝三角形ABE:三角形DBE。"
    "②三角形ACEの面積を7とすると、AB:BC＝4:3より三角形ABE＝4、三角形CBE＝3。"
    "③AF:FD＝5:2なので、三角形DBE＝4×2/5＝1.6。三角形BCD＝3−1.6＝1.4。"
    "④Bを頂点、CD・DEを底辺と見ると高さが同じなので、CD:DE＝1.4:1.6＝7:8。→ 答え 7:8。"
)

# ■ hd5s_28k1_15（HG-3748）3種類の粉
#   ・intro に「骨」＝制作側の言葉が漏れていた／解説の「Bのうでに合流させた」が意味を取りにくい
NEW[("hd5s_28k1_15", ("intro",))] = (
    "100gが190円、160円、120円のA、B、C3種類の粉を混ぜ、CをBの2倍用いて、100gが150円の粉を作ります。"
    "100gあたりのねだんは食塩水の濃度と同じ形なので、てんびん法が使えます。"
)
NEW[("hd5s_28k1_15", ("steps", 0, "meaning"))] = (
    "①CはBの2倍使うので、B(160円)を1、C(120円)を2、A(190円)を□として、"
    "100gが150円のところを支点にしたてんびんを考える。"
    "②150円より安いのはCだけで、うでの長さは150−120＝30、重さは2。"
    "150円より高いのはBが うで160−150＝10・重さ1、Aが うで190−150＝40・重さ□。"
    "③つり合いは（うで×重さ）の合計が左右で等しいので 2×30＝1×10+□×40。"
    "④60＝10+40×□より □＝50÷40＝5/4。⑤A:B＝5/4:1＝5:4。→ 答え 5:4。"
)

# ■ hd5s_22k1_2（HG-3639）平行線と正六角形
#   ・同じ場所（x=54/56, y=110）に「F」と「B」の2枚のラベルが重なって描かれていた（Fは2回登場）
#   ・六角形の辺が 85/70/74/85/70/74 で正六角形になっておらず、内角も102度だった → 実測して描き直す
NEW[("hd5s_22k1_2", ("svg",))] = SVG_22_2

# ■ hd5s_22k1_3（HG-3640）平行線と階段状の折れ線
#   ・原本（本文p8 大問3）は 折れ点が2つ（山と谷）＝線分3本。図は折れ点3つ＝線分4本で、
#     角の書かれていない折れ点が1つあり、135/100/90 だけでは x が決まらない図になっていた
NEW[("hd5s_22k1_3", ("svg",))] = SVG_22_3
NEW[("hd5s_22k1_3", ("steps", 0, "question"))] = "図で、ABとCDが平行であるとき、xの値を求めなさい。"
NEW[("hd5s_22k1_3", ("steps", 0, "meaning"))] = (
    "①折れ点ごとに、ABと平行な線を1本ずつ引く。"
    "②Bのところが135°だから、1本目の線はABと 180−135＝45° の角をつくる。"
    "③山の折れ点では、平行線の上にならぶ3つの角が 45°（錯角）、100°、□ で合わせて180°。"
    "□＝180−45−100＝35° なので、2本目の線は水平と35°の角。"
    "④谷の折れ点でも同じで、35°（錯角）、90°、□ が合わせて180°。□＝55° なので3本目の線は水平と55°の角。"
    "⑤CDも平行な線なので、CDと3本目の線がつくる角は55°。x＝180−55＝125。→ 答え 125。"
)

# ■ hd5s_22k1_4（HG-3641）三角形の外角
#   ・(2) は原本では「底辺を右にのばした外角70°／右下の内角50°／頂角x」。
#     図は のばす向きが左で、70°が三角形の内側に置かれていた＝図どおりに読むと x＝60 になってしまう
NEW[("hd5s_22k1_4", ("svg",))] = SVG_22_4

# ■ hd5s_22k1_5（HG-3642）ブーメラン型の角
#   ・(2) は原本では「頂角から底辺への線」と「左の辺の点から右下の頂点への線」の2本が交わる図。
#     アプリの図は線が1本しかなく、xの位置が定まらなかった（図どおりに読むと90°）
#   ・(1) は 60° のラベルが図形の外に出ていた／左下の角が18°で描かれていた（ラベルは40°）
NEW[("hd5s_22k1_5", ("svg",))] = SVG_22_5
NEW[("hd5s_22k1_5", ("steps", 1, "question"))] = "図(2)の角xの大きさを求めなさい。"
NEW[("hd5s_22k1_5", ("steps", 1, "meaning"))] = (
    "①左下の70°と右下の20°をもつ三角形に注目する。左の辺の上にできる点の角の外角は、"
    "外角＝となり合わない2つの内角の和 より 70+20＝90度。"
    "②いちばん上の30°と、この90度と、xの3つで1つの三角形ができている。"
    "③三角形の内角の和より x＝180−30−90＝60度。→ 答え 60度。"
)

# ■ hd5s_22k1_6（HG-3643）正三角形と正五角形の重なり
#   ・原本は E が辺AB上、F が辺BC上、H が辺CA上にある図。アプリの図は正五角形が三角形の内側に
#     浮いていて、どの辺にも接していない＝15°もxも定義できない図だった
#   ・設問の「角Fが15°」も誤り（正五角形の内角は108°。15°は角GFC）
NEW[("hd5s_22k1_6", ("svg",))] = SVG_22_6
NEW[("hd5s_22k1_6", ("steps", 0, "question"))] = (
    "三角形ABCは正三角形、五角形DEFGHは正五角形で、点E、F、Hはそれぞれ辺AB、BC、CAの上にあります。"
    "角GFCが15°のとき、角xの大きさを求めなさい。"
)
NEW[("hd5s_22k1_6", ("steps", 0, "meaning"))] = (
    "①正五角形の1つの内角は 180×(5−2)÷5＝108度。"
    "②四角形FCHGは、Gがへこんだブーメラン型。へこみの角は正五角形の内角の108度。"
    "③ブーメラン型では へこみの角＝ほかの3つの角の和 なので 108＝15+60+x（60度は正三角形の角C）。"
    "④x＝108−60−15＝33度。→ 答え 33度。"
)

# ■ hd5s_22k1_7（HG-3644）二等辺三角形の連鎖①
#   ・解説②が「DB＝BCより角BDC＝角BCDが決まり」と順番が入れかわっていた（角BDCは外角で決まる）
NEW[("hd5s_22k1_7", ("steps", 0, "meaning"))] = (
    "①DA＝DBより三角形DABは二等辺三角形。角DAB＝角DBAなので、これを①とおく。"
    "②三角形DABの外角より 角BDC＝①+①＝②。"
    "③DB＝BCより三角形DBCは二等辺三角形なので、角BCD＝角BDC＝②。"
    "④AB＝ACより 角ABC＝角ACB＝②。"
    "⑤三角形ABCの内角の和より ①+②+②＝⑤＝180。⑥①＝180÷5＝36度。→ 答え 36度。"
)

# ■ hd5s_22k1_8（HG-3645）二等辺三角形の連鎖②
#   ・intro と解説が「大問7」を指していた（子どもの画面には大問7は出ていない）
#   ・「⑦＝180になる」だけで、どうしてそうなるかが書かれていなかった
NEW[("hd5s_22k1_8", ("intro",))] = (
    "次の問いに答えなさい。等しい辺から等しい角が次々に決まります。"
    "すべての角を①や②のような比の形で表すと、三角形の内角の和から1本の式が立てられます。"
    "答えが分数の角度になってもかまいません。"
)
NEW[("hd5s_22k1_8", ("steps", 0, "meaning"))] = (
    "①角Aを①とおく。AB＝BCより三角形ABCは二等辺三角形で、角BCA＝角BAC＝①。"
    "②三角形ABCの外角より 角DBC＝①+①＝②。BC＝DCより 角BDC＝角DBC＝②。"
    "③三角形ACDの外角より 角DCE＝①+②＝③。DC＝DEより 角DEC＝角DCE＝③。"
    "④AD＝AEより 角ADE＝角AED＝③。"
    "⑤三角形ADEの内角の和より ①+③+③＝⑦＝180。⑥①＝180÷7＝25と5/7度。→ 答え 25と5/7度。"
)

# ■ hd5s_22k1_9（HG-3646）二等辺三角形の連鎖③
#   ・図の連鎖が4本（大問8とまったく同じ長さ）しかなく、それだと⑦＝180＝25と5/7度になる。
#     原本（本文p10）は OB上→OA上→OB上→A→B の5本。答えの20度（⑨＝180）に合うよう描き直し、
#     「同じ印の辺」と書いてあるのに図に印が無かったので、5本すべてに印を入れた
NEW[("hd5s_22k1_9", ("svg",))] = SVG_22_9
NEW[("hd5s_22k1_9", ("steps", 0, "meaning"))] = (
    "①角Oを①とおく。②同じ長さの辺がとなり合うたびに二等辺三角形ができ、"
    "外角＝となり合わない2つの内角の和 を使うと、Oから遠ざかるほど角が ②、③、④ と①ずつ大きくなる。"
    "③いちばん下（底辺ABをふくむ二等辺三角形）でできる角は④。"
    "④OA＝OBだから 角OAB＝角OBA＝(180−①)÷2。この角が④と同じなので (180−①)÷2＝④。"
    "⑤180−①＝⑧ より ⑨＝180、①＝180÷9＝20度。→ 答え 20度。"
)

# ---------------------------------------------------------------------------
# 図SVGの検算（入れる前に座標から角度・長さ・面積を出して、問題文の数値と合うか見る）
#   ★合わなければ AssertionError で止まる。数値だけでなく「その座標が本当に新SVGに入っているか」も見る。
# ---------------------------------------------------------------------------
def _ang(p, q, r):
    a = (p[0] - q[0], p[1] - q[1]); b = (r[0] - q[0], r[1] - q[1])
    c = (a[0] * b[0] + a[1] * b[1]) / (math.hypot(*a) * math.hypot(*b))
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))

def _d(p, q):
    return math.hypot(p[0] - q[0], p[1] - q[1])

def _area(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0

def _near(name, got, want, tol):
    assert abs(got - want) <= tol, "%s: %.4f (want %.4f, tol %.3f)" % (name, got, want, tol)

def _has(svg, frag, name):
    assert svg.count(frag) == 1, "%s: 図SVGに次の座標がちょうど1回入っていない -> %s" % (name, frag)


def verify_geometry():
    # --- HG-3639 正六角形（A は直線ℓ上、D は直線m上、ℓとmは平行）
    _has(SVG_22_2, 'points="110,45 43.9,100.5 58.9,185.5 140,215 206.1,159.5 191.1,74.5"', "HG-3639")
    hx = [(110, 45), (43.9, 100.5), (58.9, 185.5), (140, 215), (206.1, 159.5), (191.1, 74.5)]
    for i in range(6):
        _near("HG-3639 辺", _d(hx[i], hx[(i + 1) % 6]), 86.31, 0.6)
        _near("HG-3639 内角", _ang(hx[i - 1], hx[i], hx[(i + 1) % 6]), 120.0, 0.6)
    _near("HG-3639 Aはl上", hx[0][1], 45.0, 0.01)
    _near("HG-3639 Dはm上", hx[3][1], 215.0, 0.01)
    _near("HG-3639 40度", _ang((0, 45), hx[0], hx[1]), 40.0, 0.6)
    _near("HG-3639 x=20", _ang((0, 215), hx[3], hx[2]), 20.0, 0.6)

    # --- HG-3640 階段状の折れ線（135°→100°→90°→x）
    _has(SVG_22_3, 'points="120,190 165,145 200.7,170 288.2,45"', "HG-3640")
    A, B, P1, P2, C, D = (15, 190), (120, 190), (165, 145), (200.7, 170), (288.2, 45), (335, 45)
    _near("HG-3640 Bの角", _ang(A, B, P1), 135.0, 0.5)
    _near("HG-3640 山の角", _ang(B, P1, P2), 100.0, 0.5)
    _near("HG-3640 谷の角", _ang(P1, P2, C), 90.0, 0.5)
    _near("HG-3640 x=125", _ang(D, C, P2), 125.0, 0.5)

    # --- HG-3641(2) 外角70°・内角50°・頂角x=20
    _has(SVG_22_4, 'points="270,175 328,175 372.6,52.8"', "HG-3641")
    _has(SVG_22_4, '<line x1="328" y1="175" x2="440" y2="175"', "HG-3641")
    Q, R, P, Ex = (270, 175), (328, 175), (372.6, 52.8), (440, 175)
    _near("HG-3641 50度", _ang(R, Q, P), 50.0, 0.5)
    _near("HG-3641 外角70度", _ang(Ex, R, P), 70.0, 0.5)
    _near("HG-3641 x=20", _ang(Q, P, R), 20.0, 0.5)

    # --- HG-3642(1) ブーメラン 60/40/20 → へこみ120
    _has(SVG_22_5, 'points="110,45 197.5,185 142.3,141.8 35.5,185"', "HG-3642(1)")
    T, Rb, N, L = (110, 45), (197.5, 185), (142.3, 141.8), (35.5, 185)
    _near("HG-3642(1) 頂角60", _ang(L, T, Rb), 60.0, 0.5)
    _near("HG-3642(1) 左40", _ang(T, L, N), 40.0, 0.5)
    _near("HG-3642(1) 右20", _ang(T, Rb, N), 20.0, 0.5)
    _near("HG-3642(1) x=120", _ang(L, N, Rb), 120.0, 0.5)

    # --- HG-3642(2) 30/70/20 → x=60（2本の線の交点の角）
    _has(SVG_22_5, 'points="341.1,30.9 285,185 445,185"', "HG-3642(2)")
    _has(SVG_22_5, '<line x1="341.1" y1="30.9" x2="368.3" y2="185"', "HG-3642(2)")
    _has(SVG_22_5, '<line x1="303.7" y1="133.6" x2="445" y2="185"', "HG-3642(2)")
    A2, B2, C2 = (341.1, 30.9), (285, 185), (445, 185)
    D2, E2, P2b = (368.3, 185), (303.7, 133.6), (363.0, 155.2)
    _near("HG-3642(2) 30度", _ang(B2, A2, D2), 30.0, 0.5)
    _near("HG-3642(2) 70度", _ang(A2, B2, C2), 70.0, 0.5)
    _near("HG-3642(2) 20度", _ang(B2, C2, E2), 20.0, 0.5)
    _near("HG-3642(2) x=60", _ang(A2, P2b, E2), 60.0, 0.5)
    _near("HG-3642(2) EはAB上", _ang(A2, E2, B2), 180.0, 0.3)
    _near("HG-3642(2) PはAD上", _ang(A2, P2b, D2), 180.0, 0.3)
    _near("HG-3642(2) PはEC上", _ang(E2, P2b, C2), 180.0, 0.3)

    # --- HG-3643 正三角形＋正五角形（E,F,H が辺の上）→ x=33
    _has(SVG_22_6, 'points="150,23.1 45,205 255,205"', "HG-3643")
    _has(SVG_22_6, 'points="129.3,82.6 81.7,141.5 122.9,205 196.1,185.4 200,109.8"', "HG-3643")
    tri = [(150, 23.1), (45, 205), (255, 205)]
    pent = [(129.3, 82.6), (81.7, 141.5), (122.9, 205), (196.1, 185.4), (200, 109.8)]
    for i in range(3):
        _near("HG-3643 正三角形の辺", _d(tri[i], tri[(i + 1) % 3]), 210.0, 0.6)
    for i in range(5):
        _near("HG-3643 正五角形の辺", _d(pent[i], pent[(i + 1) % 5]), 75.73, 0.6)
        _near("HG-3643 正五角形の内角", _ang(pent[i - 1], pent[i], pent[(i + 1) % 5]), 108.0, 0.5)
    _near("HG-3643 EはAB上", _ang(tri[0], pent[1], tri[1]), 180.0, 0.3)
    _near("HG-3643 FはBC上", pent[2][1], 205.0, 0.01)
    _near("HG-3643 HはCA上", _ang(tri[0], pent[4], tri[2]), 180.0, 0.3)
    _near("HG-3643 角GFC=15", _ang(pent[3], pent[2], tri[2]), 15.0, 0.5)
    _near("HG-3643 x=33", _ang(pent[3], pent[4], tri[2]), 33.0, 0.5)

    # --- HG-3646 5本の連鎖（⑨＝180 → 角O＝20）
    _has(SVG_22_9, 'points="120,25 132.25,94.48 96.99,155.55 151,200.85 84.7,225 155.3,225"', "HG-3646")
    O, Q1, Q2, Q3 = (120, 25), (132.25, 94.48), (96.99, 155.55), (151, 200.85)
    Aq, Bq = (84.7, 225), (155.3, 225)
    chain = [O, Q1, Q2, Q3, Aq, Bq]
    for i in range(5):
        _near("HG-3646 同じ印の辺", _d(chain[i], chain[i + 1]), 70.55, 0.35)
    _near("HG-3646 OA=OB", _d(O, Aq) - _d(O, Bq), 0.0, 0.35)
    _near("HG-3646 角O=20", _ang(Aq, O, Bq), 20.0, 0.5)
    _near("HG-3646 1つ目はOB上", _ang(O, Q1, Bq), 180.0, 0.3)
    _near("HG-3646 2つ目はOA上", _ang(O, Q2, Aq), 180.0, 0.3)
    _near("HG-3646 3つ目はOB上", _ang(O, Q3, Bq), 180.0, 0.3)

    # --- HG-3728 チェバ（BD:DC=3:5, CE:EA=3:2, 三角形APE=4 → 三角形BDP=3と3/8）
    _has(SVG_27_11, 'points="160,35 55,160 285,160"', "HG-3728")
    A1, B1, C1 = (160, 35), (55, 160), (285, 160)
    D1, E1, F1, Pc = (141.25, 160), (210, 85), (104.7, 100.8), (148, 115)
    _near("HG-3728 BD:DC", _d(B1, D1) / _d(D1, C1), 0.6, 0.01)
    _near("HG-3728 CE:EA", _d(C1, E1) / _d(E1, A1), 1.5, 0.01)
    _near("HG-3728 AF:FB", _d(A1, F1) / _d(F1, B1), 10.0 / 9.0, 0.02)
    _near("HG-3728 PはAD上", _ang(A1, Pc, D1), 180.0, 0.3)
    _near("HG-3728 PはBE上", _ang(B1, Pc, E1), 180.0, 0.3)
    _near("HG-3728 PはCF上", _ang(C1, Pc, F1), 180.0, 0.3)
    _near("HG-3728 APE:BDP", _area([A1, Pc, E1]) / _area([B1, D1, Pc]), 4.0 / (27.0 / 8.0), 0.02)

    # --- HG-3729 チェバ（AD:DB=5:2, BE:EC=4:3 → 10:3 / 10:3 / 35:6）
    _has(SVG_27_12, 'points="175,35 60,160 290,160"', "HG-3729")
    A3, B3, C3 = (175, 35), (60, 160), (290, 160)
    D3, E3, F3, Pd = (92.9, 124.3), (191.4, 160), (263.5, 131.2), (189.0, 141.8)
    _near("HG-3729 AD:DB", _d(A3, D3) / _d(D3, B3), 2.5, 0.02)
    _near("HG-3729 BE:EC", _d(B3, E3) / _d(E3, C3), 4.0 / 3.0, 0.02)
    _near("HG-3729 AF:FC", _d(A3, F3) / _d(F3, C3), 10.0 / 3.0, 0.03)
    _near("HG-3729 PはAE上", _ang(A3, Pd, E3), 180.0, 0.3)
    _near("HG-3729 PはBF上", _ang(B3, Pd, F3), 180.0, 0.3)
    _near("HG-3729 PはCD上", _ang(C3, Pd, D3), 180.0, 0.3)
    _near("HG-3729 PAB:PBC", _area([Pd, A3, B3]) / _area([Pd, B3, C3]), 10.0 / 3.0, 0.05)
    _near("HG-3729 AP:PE", _d(A3, Pd) / _d(Pd, E3), 35.0 / 6.0, 0.06)

    # --- HG-3731 円のまわりの六角形（1cm×3・2cm×3。弦の比が2倍になっていること）
    _has(SVG_27_14, 'points="99.35,62.88 139.46,31.3 190.52,31.29 230.65,62.87 216.07,163.96 113.94,163.97"', "HG-3731")
    Oc = (165, 105)
    hxc = [(99.35, 62.88), (139.46, 31.3), (190.52, 31.29), (230.65, 62.87), (216.07, 163.96), (113.94, 163.97)]
    for p in hxc:
        _near("HG-3731 円周上", _d(Oc, p), 78.0, 0.05)
    short = [_d(hxc[i], hxc[i + 1]) for i in range(3)]
    longs = [_d(hxc[3], hxc[4]), _d(hxc[4], hxc[5]), _d(hxc[5], hxc[0])]
    for s in short:
        _near("HG-3731 1cmの弦", s, short[0], 0.05)
    for s in longs:
        _near("HG-3731 2cmの弦", s, longs[0], 0.05)
    _near("HG-3731 2cm/1cm", longs[0] / short[0], 2.0, 0.01)

    # --- HG-3732 台形（ABFE=48, BGF=50, 斜線FDCG=48, 台形=154, BG:GC=5:2）
    _has(SVG_27_15, 'points="95,40 223,40 284,155 60,155"', "HG-3732")
    _has(SVG_27_15, 'points="176.4,72.9 223,40 284,155 220,155"', "HG-3732")
    At, Dt, Bt, Ct = (95, 40), (223, 40), (60, 155), (284, 155)
    Et, Gt, Ft = (159, 40), (220, 155), (176.4, 72.9)
    _near("HG-3732 AE=ED", _d(At, Et) - _d(Et, Dt), 0.0, 0.5)
    _near("HG-3732 FはBD上", _ang(Bt, Ft, Dt), 180.0, 0.3)
    _near("HG-3732 FはEG上", _ang(Et, Ft, Gt), 180.0, 0.3)
    _near("HG-3732 EGとDCは平行", _ang(Et, Gt, Ct) + _ang(Gt, Ct, Dt), 180.0, 0.5)
    k = _area([At, Bt, Ft, Et]) / 48.0
    _near("HG-3732 三角形BGF", _area([Bt, Gt, Ft]) / k, 50.0, 0.2)
    _near("HG-3732 斜線FDCG", _area([Ft, Dt, Ct, Gt]) / k, 48.0, 0.2)
    _near("HG-3732 台形ABCD", _area([At, Dt, Ct, Bt]) / k, 154.0, 0.3)
    _near("HG-3732 BG:GC", _d(Bt, Gt) / _d(Gt, Ct), 2.5, 0.02)
    return True


# ---------------------------------------------------------------------------
def dig(obj, path):
    for k in path:
        obj = obj[k]
    return obj


def put(obj, path, val):
    for k in path[:-1]:
        obj = obj[k]
    obj[path[-1]] = val


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    verify_geometry()
    print("図SVGの検算: OK（角度・長さ・面積とも問題文の数値と一致）")

    d = json.load(io.open(target, encoding="utf-8"))
    byid = {}
    for it in iter_daimon(d):                      # ★大問の走査は iter_daimon だけを通す
        x = it["x"]
        if x.get("id"):
            byid.setdefault(x["id"], []).append(x)

    changed, skipped, touched = 0, 0, {}
    for key in sorted(NEW, key=lambda kv: (kv[0], str(kv[1]))):
        did, path = key
        hits = byid.get(did, [])
        assert len(hits) == 1, "大問 %s が %d 件みつかった（1件でないと直せない）" % (did, len(hits))
        x = hits[0]
        old = OLD[key]
        cur = dig(x, list(path))
        if cur == NEW[key]:
            skipped += 1
            continue
        assert cur == old, (
            "%s %s: いまの中身が、直す前の文とも直したあとの文とも一致しない。"
            "先に別の直しが入っているかもしれないので、手で見てから流すこと。" % (did, path)
        )
        put(x, list(path), NEW[key])
        changed += 1
        touched[did] = touched.get(did, 0) + 1

    # ★もとのファイルは末尾に改行が1つ入っている。付けないと最終行だけ差分になる。
    out = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    io.open(target, "wb").write(out.encode("utf-8"))

    print("対象: %s" % target)
    print("直した箇所: %d ／ すでに直っていた箇所: %d" % (changed, skipped))
    for did in sorted(touched):
        print("  %-14s %d箇所" % (did, touched[did]))
    if changed == 0:
        print("（2回目以降は 0箇所＝冪等）")


if __name__ == "__main__":
    main()
