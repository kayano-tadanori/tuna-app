# -*- coding: utf-8 -*-
"""小5最レ 第1分冊 第1講座 No.8 大問16 〜 No.10 大問7（hd5s_8k1_16 〜 hd5s_10k1_7・24本）の
塾講師監査（docs/_audit/s5sairei_w6/findings_1.md）で出た指摘を当てるパッチ。

使い方:  python scripts/_fix_s5sairei_w6_1.py [対象JSON]
         （省略時 data/hama_daimon.json）

・大問の走査は scripts/genbo_common.py の iter_daimon だけを使う
・欄まるごとの一致で判定するので冪等（cur==new なら済み／cur==old なら適用）
・図SVGは書きこむ前に座標から数値を出して問題文と照合し、
  1つでも合わなければ 1件も書かずに止める
"""
import io, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402


# (大問id, 欄のみち, いまの値, 新しい値)
EDITS = [
    ('hd5s_9k1_6', ('steps', 0, 'question'),
     'B,C,Dが一直線上。角ABC・角ACE・角CDEはどれも90度。AB=6cm,BC=10cm,DE=15cm,CD=□cm',
     '点B・C・Dは一直線上にあり、角ABC・角ACE・角CDEはどれも90度です。AB＝6cm、BC＝10cm、DE＝15cmのとき、CDの長さ□cmを求めなさい。'),
    ('hd5s_9k1_6', ('steps', 1, 'question'),
     'A,E,Bが一直線上。角DAE・角DEC・角EBCはどれも90度。AD=4cm,AE=8cm,EB=7cm,BC=□cm',
     '点A・E・Bは一直線上にあり、角DAE・角DEC・角EBCはどれも90度です。AD＝4cm、AE＝8cm、EB＝7cmのとき、BCの長さ□cmを求めなさい。'),
    ('hd5s_9k1_6', ('steps', 1, 'svg'),
     '<svg viewBox="0 0 500 300" style="display:block;margin:0 auto;max-width:100%"><line x1="80" y1="60" x2="140" y2="60" stroke="#4f9eff"/><line x1="80" y1="60" x2="80" y2="285" stroke="#4f9eff"/><line x1="140" y1="60" x2="80" y2="180" stroke="#4f9eff"/><line x1="80" y1="180" x2="480" y2="260" stroke="#4f9eff"/><line x1="80" y1="285" x2="480" y2="260" stroke="#4f9eff"/><line x1="140" y1="60" x2="480" y2="260" stroke="#4f9eff"/><rect x="80" y="60" width="12" height="12" fill="none" stroke="#4f9eff"/><rect x="80" y="168" width="12" height="12" fill="none" stroke="#4f9eff"/><rect x="80" y="273" width="12" height="12" fill="none" stroke="#4f9eff"/><text x="95" y="50" fill="#e8ecf5" font-size="16">4cm</text><text x="35" y="125" fill="#e8ecf5" font-size="16">8cm</text><text x="35" y="235" fill="#e8ecf5" font-size="16">7cm</text><text x="260" y="290" fill="#e8ecf5" font-size="16">□cm</text><text x="60" y="55" fill="#e8ecf5" font-size="17">A</text><text x="150" y="55" fill="#e8ecf5" font-size="17">D</text><text x="55" y="185" fill="#e8ecf5" font-size="17">E</text><text x="55" y="290" fill="#e8ecf5" font-size="17">B</text><text x="488" y="265" fill="#e8ecf5" font-size="17">C</text></svg>',
     '<svg viewBox="0 0 340 330" style="display:block;margin:0 auto;max-width:100%"><line x1="80" y1="60" x2="140" y2="60" stroke="#4f9eff"/><line x1="80" y1="60" x2="80" y2="285" stroke="#4f9eff"/><line x1="140" y1="60" x2="80" y2="180" stroke="#4f9eff"/><line x1="80" y1="180" x2="290" y2="285" stroke="#4f9eff"/><line x1="80" y1="285" x2="290" y2="285" stroke="#4f9eff"/><line x1="140" y1="60" x2="290" y2="285" stroke="#4f9eff"/><rect x="80" y="60" width="12" height="12" fill="none" stroke="#4f9eff"/><rect x="80" y="273" width="12" height="12" fill="none" stroke="#4f9eff"/><polyline points="84.9,170.2 94.7,175.1 89.8,184.9" fill="none" stroke="#4f9eff" stroke-width="1.4"/><text x="96" y="52" fill="#e8ecf5" font-size="16">4cm</text><text x="72" y="126" fill="#e8ecf5" font-size="16" text-anchor="end">8cm</text><text x="72" y="238" fill="#e8ecf5" font-size="16" text-anchor="end">7cm</text><text x="185" y="306" fill="#e8ecf5" font-size="16" text-anchor="middle">□cm</text><text x="66" y="55" fill="#e8ecf5" font-size="17" text-anchor="end">A</text><text x="150" y="55" fill="#e8ecf5" font-size="17">D</text><text x="66" y="186" fill="#e8ecf5" font-size="17" text-anchor="end">E</text><text x="66" y="292" fill="#e8ecf5" font-size="17" text-anchor="end">B</text><text x="298" y="292" fill="#e8ecf5" font-size="17">C</text></svg>'),
    ('hd5s_9k1_7', ('steps', 0, 'question'),
     '頂点Aが直角の三角形。AからBCへ垂線AD=12cm。BD=□cm,DC=6cm',
     'いちばん上のかどが直角の三角形です。直角のかどから下の辺へ垂直にひいた線が12cmで、下の辺は□cmと6cmに分かれています。□にあてはまる数を求めなさい。'),
    ('hd5s_9k1_7', ('steps', 0, 'svg'),
     '<svg viewBox="0 0 400 260" style="display:block;margin:0 auto;max-width:100%"><polygon points="40,220 340,220 280,60" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="280" y1="220" x2="280" y2="60" stroke="#4f9eff" stroke-width="2"/><rect x="270" y="210" width="10" height="10" fill="none" stroke="#4f9eff"/><text x="255" y="140" fill="#e8ecf5" font-size="16">12cm</text><text x="150" y="245" fill="#e8ecf5" font-size="16">□cm</text><text x="295" y="245" fill="#e8ecf5" font-size="16">6cm</text></svg>',
     '<svg viewBox="0 0 400 270" style="display:block;margin:0 auto;max-width:100%"><polygon points="40,220 340,220 280,100" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="280" y1="220" x2="280" y2="100" stroke="#4f9eff" stroke-width="2"/><polyline points="269.3,105.4 274.6,116.1 285.4,110.7" fill="none" stroke="#4f9eff" stroke-width="1.5"/><rect x="270" y="210" width="10" height="10" fill="none" stroke="#4f9eff"/><text x="274" y="162" fill="#e8ecf5" font-size="16" text-anchor="end">12cm</text><text x="160" y="244" fill="#e8ecf5" font-size="16" text-anchor="middle">□cm</text><text x="310" y="244" fill="#e8ecf5" font-size="16" text-anchor="middle">6cm</text></svg>'),
    ('hd5s_9k1_7', ('steps', 1, 'question'),
     '直角三角形。3辺156cm,65cm,169cm。垂線の足Hから上の頂点までの長さ=□cm',
     '3つの辺が156cm・65cm・169cmの直角三角形です。直角のかどから、いちばん長い169cmの辺へ垂直に線をひいたとき、その足から上のかどまでの長さが□cmです。□にあてはまる数を求めなさい。'),
    ('hd5s_9k1_7', ('steps', 1, 'svg'),
     '<svg viewBox="0 0 420 280" style="display:block;margin:0 auto;max-width:100%"><polygon points="30,230 350,230 370,30" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="350" y1="230" x2="320" y2="60" stroke="#4f9eff" stroke-width="2"/><text x="150" y="255" fill="#e8ecf5" font-size="16">156cm</text><text x="130" y="120" fill="#e8ecf5" font-size="16">169cm</text><text x="360" y="140" fill="#e8ecf5" font-size="16">65cm</text><text x="330" y="50" fill="#e8ecf5" font-size="14">□cm</text></svg>',
     '<svg viewBox="0 0 420 270" style="display:block;margin:0 auto;max-width:100%"><polygon points="30,230 342,230 342,100" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="342" y1="230" x2="295.8" y2="119.2" stroke="#4f9eff" stroke-width="2"/><rect x="330" y="218" width="12" height="12" fill="none" stroke="#4f9eff"/><polyline points="306.0,115.0 310.2,125.1 300.0,129.4" fill="none" stroke="#4f9eff" stroke-width="1.5"/><text x="186" y="252" fill="#e8ecf5" font-size="16" text-anchor="middle">156cm</text><text x="170" y="144" fill="#e8ecf5" font-size="16" text-anchor="middle">169cm</text><text x="350" y="170" fill="#e8ecf5" font-size="16">65cm</text><text x="312" y="95" fill="#e8ecf5" font-size="15" text-anchor="middle">□cm</text></svg>'),
    ('hd5s_9k1_7', ('steps', 2, 'question'),
     '三角形(C直角,CA=16,CB=12,AB=20)。CA上の点PからAB⊥線PQ=6のQB=□cm',
     'いちばん上のかどが直角で、3つの辺が16cm・12cm・20cmの三角形です。16cmの辺の上の点から20cmの辺へ垂直にひいた線が6cmのとき、その足から右のかどまでの長さが□cmです。□にあてはまる数を求めなさい。'),
    ('hd5s_9k1_7', ('steps', 2, 'svg'),
     '<svg viewBox="0 0 260 280" style="display:block;margin:0 auto;max-width:100%"><polygon points="20,250 220,250 148,154" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="190" x2="100" y2="250" stroke="#4f9eff" stroke-width="2"/><text x="60" y="190" fill="#e8ecf5" font-size="16">16cm</text><text x="180" y="190" fill="#e8ecf5" font-size="16">12cm</text><text x="60" y="270" fill="#e8ecf5" font-size="16">20cm</text><text x="105" y="220" fill="#e8ecf5" font-size="14">6cm</text><text x="150" y="270" fill="#e8ecf5" font-size="14">□cm</text></svg>',
     '<svg viewBox="0 0 270 290" style="display:block;margin:0 auto;max-width:100%"><polygon points="20,250 220,250 148,154" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="190" x2="100" y2="250" stroke="#4f9eff" stroke-width="2"/><polyline points="138.4,161.2 145.6,170.8 155.2,163.6" fill="none" stroke="#4f9eff" stroke-width="1.5"/><rect x="100" y="240" width="10" height="10" fill="none" stroke="#4f9eff"/><text x="60" y="190" fill="#e8ecf5" font-size="16">16cm</text><text x="180" y="190" fill="#e8ecf5" font-size="16">12cm</text><text x="60" y="272" fill="#e8ecf5" font-size="16">20cm</text><text x="104" y="222" fill="#e8ecf5" font-size="14">6cm</text><text x="152" y="242" fill="#e8ecf5" font-size="14">□cm</text></svg>'),
    ('hd5s_9k1_8', ('steps', 0, 'question'),
     '三角形ABC(A左下,B右下直角,C上)。AB=40cm,BC=30cm,AC=50cm。AC上の点FからBへの垂線(Fに直角マーク)と底辺への垂線FG=□cm',
     '左の(1)の図で、右下のかどが直角の三角形の3つの辺は40cm・30cm・50cmです。右下のかどから50cmの辺へ垂直に線をひき、その足から下の辺へさらに垂直に線をおろしました。その線の長さ□cmを求めなさい。'),
    ('hd5s_9k1_8', ('steps', 1, 'question'),
     '三角形。頂点から斜辺上の点まで4cm,その点から底辺の頂点まで16cm,その点に直角マークがありそこから左下の直角頂点まで□cm',
     '右の(2)の図で、左下のかどが直角です。いちばん長い辺は4cmと16cmに分かれていて、その分かれ目から左下の直角のかどへ垂直に線がひいてあります。□にあてはまる数を求めなさい。'),
    ('hd5s_9k1_8', ('svg',),
     '<svg viewBox="0 0 400 320" style="display:block;margin:0 auto;max-width:100%"><text x="10" y="20" fill="#e8ecf5" font-size="14">(1)</text><polygon points="40,260 200,260 200,140" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="40" y1="260" x2="200" y2="140" stroke="#4f9eff" stroke-width="2"/><line x1="142" y1="183" x2="200" y2="260" stroke="#4f9eff" stroke-width="2"/><line x1="142" y1="183" x2="142" y2="260" stroke="#4f9eff" stroke-width="2"/><text x="60" y="270" fill="#e8ecf5" font-size="14">40cm</text><text x="90" y="180" fill="#e8ecf5" font-size="14">50cm</text><text x="205" y="200" fill="#e8ecf5" font-size="14">30cm</text><text x="110" y="230" fill="#e8ecf5" font-size="14">□cm</text><text x="230" y="20" fill="#e8ecf5" font-size="14">(2)</text><polygon points="270,300 270,60 385,300" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="270" y1="193" x2="385" y2="300" stroke="#4f9eff" stroke-width="2"/><text x="290" y="120" fill="#e8ecf5" font-size="14">4cm</text><text x="320" y="230" fill="#e8ecf5" font-size="14">16cm</text><text x="230" y="250" fill="#e8ecf5" font-size="14">□cm</text></svg>',
     '<svg viewBox="0 0 440 200" style="display:block;margin:0 auto;max-width:100%"><text x="12" y="50" fill="#e8ecf5" font-size="14">(1)</text><polygon points="40,160 200,160 200,40" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="40" y1="160" x2="200" y2="40" stroke="#4f9eff" stroke-width="2"/><line x1="142.4" y1="83.2" x2="200" y2="160" stroke="#4f9eff" stroke-width="2"/><line x1="142.4" y1="83.2" x2="142.4" y2="160" stroke="#4f9eff" stroke-width="2"/><rect x="188" y="148" width="12" height="12" fill="none" stroke="#4f9eff"/><rect x="142.4" y="148" width="12" height="12" fill="none" stroke="#4f9eff"/><polyline points="133.6,89.8 140.2,98.6 149.0,92.0" fill="none" stroke="#4f9eff" stroke-width="1.4"/><text x="120" y="176" fill="#e8ecf5" font-size="14" text-anchor="middle">40cm</text><text x="110" y="82" fill="#e8ecf5" font-size="14" text-anchor="end">50cm</text><text x="206" y="104" fill="#e8ecf5" font-size="14">30cm</text><text x="137" y="124" fill="#e8ecf5" font-size="14" text-anchor="end">□cm</text><text x="232" y="60" fill="#e8ecf5" font-size="14">(2)</text><polygon points="260,89.5 260,170 421,170" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="260" y1="170" x2="292.2" y2="105.6" stroke="#4f9eff" stroke-width="2"/><rect x="260" y="158" width="12" height="12" fill="none" stroke="#4f9eff"/><polyline points="282.4,100.7 277.5,110.5 287.3,115.4" fill="none" stroke="#4f9eff" stroke-width="1.4"/><text x="283" y="81" fill="#e8ecf5" font-size="14" text-anchor="middle">4cm</text><text x="368" y="118" fill="#e8ecf5" font-size="14" text-anchor="middle">16cm</text><text x="300" y="146" fill="#e8ecf5" font-size="14">□cm</text></svg>'),
    ('hd5s_9k1_9', ('steps', 0, 'question'),
     'A(上),B(左下直角),C(右下)。AB=20cm,BC=30cm',
     '上の(1)の図で、直角三角形ABC（AB＝20cm、BC＝30cm）の中につくった正方形DBEFの一辺の長さを求めなさい。'),
    ('hd5s_9k1_9', ('steps', 0, 'meaning'),
     's=20×30/50=12',
     '正方形の1辺を□cmとする。辺DFは辺BCと平行なので、三角形ADFはもとの三角形ABCと同じ形になる。だから AD：DF＝AB：BC＝20：30＝2：3。AD＝20－□、DF＝□ だから (20－□)：□＝2：3。外がわどうし・内がわどうしをかけて 3×(20－□)＝2×□、60－3×□＝2×□、60＝5×□。だから □＝12cm。'),
    ('hd5s_9k1_9', ('steps', 1, 'question'),
     'C(左),B(上),A(右)。CB=28cm,BA=21cm',
     '下の(2)の図で、直角三角形ABC（CB＝28cm、BA＝21cm）の中につくった正方形DBEFの一辺の長さを求めなさい。'),
    ('hd5s_9k1_9', ('steps', 1, 'meaning'),
     's=28×21/49=12',
     '正方形の1辺を□cmとする。辺DFは辺BCと平行なので、三角形ADFはもとの三角形ABCと同じ形になる。だから AD：DF＝AB：BC＝21：28＝3：4。AD＝21－□、DF＝□ だから (21－□)：□＝3：4。外がわどうし・内がわどうしをかけて 4×(21－□)＝3×□、84－4×□＝3×□、84＝7×□。だから □＝12cm。'),
    ('hd5s_9k1_9', ('svg',),
     '<svg viewBox="0 0 500 320" style="display:block;margin:0 auto;max-width:100%"><text x="10" y="20" fill="#e8ecf5" font-size="14">(1)</text><polygon points="150,260 150,60 450,260" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="150" y="140" width="120" height="120" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="90" y="160" fill="#e8ecf5" font-size="14">20cm</text><text x="330" y="285" fill="#e8ecf5" font-size="14">30cm</text><text x="230" y="20" fill="#e8ecf5" font-size="14">(2)</text><polygon points="60,280 320,60 480,280" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="229" y1="144" x2="404" y2="144" stroke="#4f9eff" stroke-width="2"/><line x1="229" y1="144" x2="313" y2="228" stroke="#4f9eff" stroke-width="2"/><line x1="404" y1="144" x2="313" y2="228" stroke="#4f9eff" stroke-width="2"/><text x="120" y="150" fill="#e8ecf5" font-size="14">28cm</text><text x="380" y="150" fill="#e8ecf5" font-size="14">21cm</text></svg>',
     '<svg viewBox="0 0 520 640" style="display:block;margin:0 auto;max-width:100%"><text x="14" y="50" fill="#e8ecf5" font-size="15">(1)</text><polygon points="150,60 150,260 450,260" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="150" y="140" width="120" height="120" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="150" y="248" width="12" height="12" fill="none" stroke="#4f9eff"/><text x="150" y="52" fill="#e8ecf5" font-size="15" text-anchor="middle">A</text><text x="140" y="278" fill="#e8ecf5" font-size="15" text-anchor="end">B</text><text x="458" y="278" fill="#e8ecf5" font-size="15">C</text><text x="142" y="146" fill="#e8ecf5" font-size="15" text-anchor="end">D</text><text x="272" y="278" fill="#e8ecf5" font-size="15" text-anchor="middle">E</text><text x="278" y="134" fill="#e8ecf5" font-size="15">F</text><text x="128" y="170" fill="#e8ecf5" font-size="14" text-anchor="end">20cm</text><text x="300" y="298" fill="#e8ecf5" font-size="14" text-anchor="middle">30cm</text><text x="14" y="360" fill="#e8ecf5" font-size="15">(2)</text><polygon points="60,600 306.4,415.2 445,600" fill="none" stroke="#4f9eff" stroke-width="2"/><polygon points="385.6,520.8 306.4,415.2 200.8,494.4 280,600" fill="none" stroke="#4f9eff" stroke-width="2"/><polyline points="314.8,426.4 303.6,434.8 295.2,423.6" fill="none" stroke="#4f9eff" stroke-width="1.4"/><text x="50" y="616" fill="#e8ecf5" font-size="15" text-anchor="end">C</text><text x="455" y="616" fill="#e8ecf5" font-size="15">A</text><text x="306" y="406" fill="#e8ecf5" font-size="15" text-anchor="middle">B</text><text x="394" y="524" fill="#e8ecf5" font-size="15">D</text><text x="192" y="490" fill="#e8ecf5" font-size="15" text-anchor="end">E</text><text x="280" y="620" fill="#e8ecf5" font-size="15" text-anchor="middle">F</text><text x="170" y="488" fill="#e8ecf5" font-size="14" text-anchor="end">28cm</text><text x="398" y="492" fill="#e8ecf5" font-size="14">21cm</text></svg>'),
    ('hd5s_9k1_10', ('steps', 0, 'meaning'),
     '2×1.5=3',
     '1mの棒のかげが1.5mだから、同じ時こくならどんなものでも 高さ：かげ＝1：1.5＝2：3 になる。つまり、かげの長さは高さの1.5倍。高さ2mの木のかげは 2×1.5＝3m。'),
    ('hd5s_9k1_10', ('steps', 1, 'meaning'),
     '6÷1.5=4',
     '高さ：かげ＝1：1.5 だから、かげの長さは高さの1.5倍。ぎゃくに、高さはかげの長さを1.5でわればよい。かげが6mなので、木の高さは 6÷1.5＝4m。'),
    ('hd5s_9k1_11', ('steps', 0, 'meaning'),
     '1mの棒:0.8mの影＝高さ:かげ=1:0.8=5:4。壁の影1.5mを地面換算すると1.5×0.8=1.2m。地面換算の総影の長さ=12+1.2=13.2m。棒Aの高さ=13.2÷0.8=16.5m',
     '1mの棒のかげが80cm＝0.8mだから、高さ：かげ＝1：0.8。つまり、かげの長さは高さの0.8倍。もしへいがなければ、へいにうつっている1.5mぶんのかげは、そのまま地面の上へのびていたはず。光の線は1m下がるあいだに横へ0.8m進むので、へいの1.5mぶんは地面では 1.5×0.8＝1.2m にあたる。だから地面だけで考えたかげの長さは 12＋1.2＝13.2m。かげは高さの0.8倍だから、棒Aの高さは 13.2÷0.8＝16.5m。'),
    ('hd5s_9k1_13', ('steps', 0, 'meaning'),
     'たて6cm・横8cm・対角線10cmの直角三角形で、対角線を底辺と見たときの高さは 6×8÷10＝4.8cm、対角線にそったほうは 8×8÷10＝6.4cm。傾いた紙の8cmの辺は、右へ6.4cm進むあいだに4.8cm下がる（4.8：6.4＝3：4）。対角線は下の長方形から2cmはみ出しているので、その2cmぶんでは 2×3÷4＝1.5cm 下がる。つまりこの辺は、下の長方形の左のかどから1.5cm下で左の辺と交わる。重なりの四角形を「上の辺8cmを底辺とする三角形」と「左の1.5cmを底辺とする三角形」に分けると、8×4.8÷2＝19.2cm² と 1.5×4.4÷2＝3.3cm² で、合わせて 22.5cm²。',
     'たて6cm・横8cm・対角線10cmの直角三角形で、対角線を底辺と見たときの高さは 6×8÷10＝4.8cm、そのときの足の位置は対角線のはしから 8×8÷10＝6.4cm のところ。かたむいた紙の対角線10cmは、下の長方形の上の辺8cmをのばした線にのっていて、右はしが長方形の右上のかどに重なっている。だから左へ 10－8＝2cm はみ出している。かたむいた紙の下のかどは、対角線の左はしから右へ6.4cm・下へ4.8cmのところなので、長方形の左上のかどから見ると 右へ 6.4－2＝4.4cm・下へ4.8cm。かたむいた紙の8cmの辺は、右へ6.4cm進むあいだに4.8cm下がる（4.8：6.4＝3：4）。はみ出した2cmぶんでは 2×3÷4＝1.5cm 下がるので、この辺は長方形の左の辺と、左上のかどから1.5cm下のところで交わる。重なりの四角形を「上の辺8cmを底辺とする三角形」と「左の1.5cmを底辺とする三角形」に分けると、8×4.8÷2＝19.2cm² と 1.5×4.4÷2＝3.3cm² で、合わせて 22.5cm²。'),
    ('hd5s_9k1_14', ('steps', 0, 'svg'),
     '<svg viewBox="0 0 660 330" style="display:block;margin:0 auto;max-width:100%"><polygon points="60,300 600,300 60,30" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="60" y="120" width="180" height="180" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="240" y="180" width="120" height="120" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="360" y="220" width="80" height="80" fill="none" stroke="#4f9eff" stroke-width="2"/><text x="15" y="170" fill="#e8ecf5" font-size="14">27cm</text><text x="300" y="320" fill="#e8ecf5" font-size="14">54cm</text></svg>',
     '<svg viewBox="0 0 660 340" style="display:block;margin:0 auto;max-width:100%"><polygon points="60,300 600,300 60,30" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="60" y="120" width="180" height="180" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="240" y="180" width="120" height="120" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="360" y="220" width="80" height="80" fill="none" stroke="#4f9eff" stroke-width="2"/><rect x="60" y="288" width="12" height="12" fill="none" stroke="#4f9eff"/><text x="60" y="22" fill="#e8ecf5" font-size="15" text-anchor="middle">A</text><text x="50" y="320" fill="#e8ecf5" font-size="15" text-anchor="end">B</text><text x="608" y="320" fill="#e8ecf5" font-size="15">C</text><text x="44" y="170" fill="#e8ecf5" font-size="14" text-anchor="end">27cm</text><text x="330" y="330" fill="#e8ecf5" font-size="14" text-anchor="middle">54cm</text></svg>'),
    ('hd5s_9k1_14', ('steps', 1, 'svg'),
     '<svg viewBox="0 0 280 340" style="display:block;margin:0 auto;max-width:100%"><polygon points="60,300 220,300 60,180" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="60" y1="180" x2="220" y2="300" stroke="#4f9eff" stroke-width="1"/><polygon points="100,220 160,220 160,260 100,260" fill="#ffd166" fill-opacity="0.4" stroke="#4f9eff"/><text x="20" y="230" fill="#e8ecf5" font-size="14">3cm</text><text x="150" y="230" fill="#e8ecf5" font-size="14">5cm</text><text x="130" y="320" fill="#e8ecf5" font-size="14">4cm</text></svg>',
     '<svg viewBox="0 0 280 340" style="display:block;margin:0 auto;max-width:100%"><polygon points="60,180 60,300 220,300" fill="none" stroke="#4f9eff" stroke-width="2"/><polygon points="98.9,209.2 150.8,248.1 111.9,300 60,261.1" fill="#ffd166" fill-opacity="0.4" stroke="#4f9eff" stroke-width="2"/><rect x="60" y="288" width="12" height="12" fill="none" stroke="#4f9eff"/><text x="48" y="176" fill="#e8ecf5" font-size="15" text-anchor="end">A</text><text x="48" y="316" fill="#e8ecf5" font-size="15" text-anchor="end">B</text><text x="228" y="316" fill="#e8ecf5" font-size="15">C</text><text x="46" y="246" fill="#e8ecf5" font-size="14" text-anchor="end">3cm</text><text x="140" y="322" fill="#e8ecf5" font-size="14" text-anchor="middle">4cm</text><text x="158" y="218" fill="#e8ecf5" font-size="14">5cm</text></svg>'),
    ('hd5s_9k1_16', ('svg',),
     '<svg viewBox="0 0 400 260" style="display:block;margin:0 auto;max-width:100%"><polygon points="130,180 200,150 200,80 130,110" fill="none" stroke="#4f9eff" stroke-width="2"/><polygon points="270,90 320,65 320,20 270,45" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="60" y1="230" x2="130" y2="180" stroke="#4f9eff" stroke-width="1.5"/><text x="60" y="150" fill="#e8ecf5" font-size="14">A</text><text x="280" y="40" fill="#e8ecf5" font-size="14">B</text><text x="205" y="120" fill="#e8ecf5" font-size="13">10m</text><text x="330" y="45" fill="#e8ecf5" font-size="13">16m</text><text x="80" y="215" fill="#e8ecf5" font-size="13">15m</text><text x="240" y="85" fill="#e8ecf5" font-size="13">2m</text><text x="230" y="115" fill="#e8ecf5" font-size="13">道路</text></svg>',
     '<svg viewBox="0 0 400 300" style="display:block;margin:0 auto;max-width:100%"><polygon points="130,250 200,220 200,150 130,180" fill="none" stroke="#4f9eff" stroke-width="2"/><polygon points="130,180 200,150 220,138 150,168" fill="none" stroke="#4f9eff" stroke-width="1.5"/><polygon points="250,180 320,150 320,38 250,68" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="55" y1="295" x2="130" y2="250" stroke="#4f9eff" stroke-width="1.5"/><line x1="212" y1="144" x2="200" y2="150" stroke="#4f9eff" stroke-width="1"/><text x="160" y="205" fill="#e8ecf5" font-size="14" text-anchor="middle">A</text><text x="283" y="120" fill="#e8ecf5" font-size="14" text-anchor="middle">B</text><text x="206" y="192" fill="#e8ecf5" font-size="13">10m</text><text x="326" y="100" fill="#e8ecf5" font-size="13">16m</text><text x="72" y="288" fill="#e8ecf5" font-size="13">15m</text><text x="215" y="140" fill="#e8ecf5" font-size="13">2m</text><text x="235" y="230" fill="#e8ecf5" font-size="13" text-anchor="middle">道路</text></svg>'),
    ('hd5s_9k1_16', ('steps', 0, 'meaning'),
     '高さ:かげ=10:15=2:3(基準比)。Bの光線は高さ16から出発し、水平距離xで高さ16-(2/3)xまで下がる。屋上の高さ10に届くのはx=9の地点。屋上の影2mが道路の縁(道幅w)からちょうど始まるとすると w+2=9、w=7',
     'Aの建物は高さ10mでかげが15mだから、高さ：かげ＝10：15＝2：3。つまり、光の線は横へ3m進むごとに縦に2m下がる。Bの建物の先たんは高さ16m。そこから出た光がAの屋上（高さ10m）に届くまでに下がる高さは 16－10＝6m。6m下がるには横へ 6×3÷2＝9m 進む。この9mは、Bの建物のかべから、屋上にうつったかげの先までの横の長さ。その9mのうち2mがAの屋上にのっているぶんだから、残りが道路のはば。だから道路のはばは 9－2＝7m。'),
    ('hd5s_10k1_1', ('steps', 0, 'meaning'),
     'DE∥BCなので、三角形ADEと三角形ABCは相似。AD：AB＝5：15＝1：3。DE＝BC×1/3。',
     'DEとBCは平行なので、三角形ADEと三角形ABCは同じ形（ピラミッド型）。AB＝AD＋DB＝5＋10＝15cm だから AD：AB＝5：15＝1：3。だからDEもBCの1/3にあたり、DE＝12×1÷3＝4cm。'),
    ('hd5s_10k1_2', ('steps', 0, 'svg'),
     '<svg viewBox="0 0 200 130" style="display:block;margin:0 auto;max-width:100%"><rect x="30" y="30" width="140" height="70" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="100" y2="100" stroke="#4f9eff" stroke-width="1.5"/><line x1="30" y1="100" x2="170" y2="30" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="170" y2="100" stroke="#4f9eff" stroke-width="2"/><circle cx="123.3" cy="53.3" r="2.5" fill="#ffd166"/><text x="94" y="60" fill="#e8ecf5" font-size="12">x</text><text x="140" y="46" fill="#e8ecf5" font-size="12">y</text></svg>',
     '<svg viewBox="0 0 200 130" style="display:block;margin:0 auto;max-width:100%"><rect x="30" y="30" width="140" height="70" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="100" y2="100" stroke="#4f9eff" stroke-width="1.5"/><line x1="30" y1="100" x2="170" y2="30" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="170" y2="100" stroke="#4f9eff" stroke-width="2"/><circle cx="123.3" cy="53.3" r="2.5" fill="#ffd166"/><path d="M 100,68 Q 111.7,74 122.5,57.5" fill="none" stroke="#4f9eff" stroke-width="1"/><path d="M 126.5,57.5 Q 147,49 168,33" fill="none" stroke="#4f9eff" stroke-width="1"/><text x="112" y="86" fill="#e8ecf5" font-size="12" text-anchor="middle">x</text><text x="150" y="66" fill="#e8ecf5" font-size="12" text-anchor="middle">y</text></svg>'),
    ('hd5s_10k1_2', ('steps', 1, 'svg'),
     '<svg viewBox="0 0 200 130" style="display:block;margin:0 auto;max-width:100%"><rect x="30" y="30" width="140" height="70" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="100" y2="100" stroke="#4f9eff" stroke-width="1.5"/><line x1="30" y1="100" x2="170" y2="30" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="170" y2="100" stroke="#4f9eff" stroke-width="2"/><circle cx="123.3" cy="53.3" r="2.5" fill="#ffd166"/><text x="94" y="60" fill="#e8ecf5" font-size="12">x</text><text x="140" y="46" fill="#e8ecf5" font-size="12">y</text></svg>',
     '<svg viewBox="0 0 200 130" style="display:block;margin:0 auto;max-width:100%"><rect x="30" y="30" width="140" height="70" fill="none" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="100" y2="100" stroke="#4f9eff" stroke-width="1.5"/><line x1="30" y1="100" x2="170" y2="30" stroke="#4f9eff" stroke-width="2"/><line x1="100" y1="30" x2="170" y2="100" stroke="#4f9eff" stroke-width="2"/><circle cx="123.3" cy="53.3" r="2.5" fill="#ffd166"/><path d="M 100,68 Q 111.7,74 122.5,57.5" fill="none" stroke="#4f9eff" stroke-width="1"/><path d="M 126.5,57.5 Q 147,49 168,33" fill="none" stroke="#4f9eff" stroke-width="1"/><text x="112" y="86" fill="#e8ecf5" font-size="12" text-anchor="middle">x</text><text x="150" y="66" fill="#e8ecf5" font-size="12" text-anchor="middle">y</text></svg>'),
    ('hd5s_10k1_4', ('steps', 0, 'meaning'),
     '20×30/(20+30)=12',
     '左の20cmの線と右の30cmの線は、どちらも底辺に垂直なので平行。2本の対角線が交わってできる砂時計（ちょうちょ）の形から、交わる点は対角線を 20：30＝2：3 に分ける。交わる点から底辺へおろした□cmの線は右の30cmの線と平行なので、底辺の左のはしを頂点にしたピラミッド型ができ、□：30＝2：(2＋3)＝2：5。だから □＝30×2÷5＝12cm。'),
    ('hd5s_10k1_4', ('steps', 1, 'meaning'),
     '10=□×30/(□+30)を解いて□=15',
     '交わる点から底辺へおろした線（10cm）は、右の30cmの線と平行。ピラミッド型から 10：30＝1：3 なので、底辺は交わる点の真下のところで 左：右＝1：(3－1)＝1：2 に分かれる。砂時計の形から、この分かれ方は「左のたての線：右のたての線」と同じ。だから □：30＝1：2 で、□＝30÷2＝15cm。'),
    ('hd5s_10k1_4', ('steps', 1, 'svg'),
     None,
     '<svg viewBox="0 0 300 170" style="display:block;margin:0 auto;max-width:100%"><path d="M40,20 L240,20" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M40,20 L40,80" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M240,20 L240,140" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M40,20 L240,140" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M240,20 L40,80" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M106.7,60 L106.7,20" stroke="#4f9eff" fill="none" stroke-width="1.5" stroke-dasharray="4,3"/><text x="34" y="56" fill="#e8ecf5" font-size="13" text-anchor="end">□cm</text><text x="114" y="50" fill="#e8ecf5" font-size="13">10cm</text><text x="248" y="86" fill="#e8ecf5" font-size="13">30cm</text></svg>'),
    ('hd5s_10k1_6', ('svg',),
     '<svg viewBox="0 -3 340 263" style="display:block;margin:0 auto;max-width:100%"><path d="M170,20 L40,220" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M170,20 L300,220" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M40,220 L300,220" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M108,120 L300,220" stroke="#4f9eff" fill="none" stroke-width="1.6"/><path d="M40,220 L222,80" stroke="#4f9eff" fill="none" stroke-width="1.6"/><path d="M130,90 L222,80" stroke="#4f9eff" fill="none" stroke-width="1.6" stroke-dasharray="5,3"/><circle cx="130" cy="90" r="2.5" fill="#ffd166"/><circle cx="108" cy="120" r="2.5" fill="#ffd166"/><circle cx="222" cy="80" r="2.5" fill="#ffd166"/><circle cx="171" cy="163" r="2.5" fill="#ffd166"/><text x="172" y="14" fill="#e8ecf5" font-size="14">A</text><text x="30" y="238" fill="#e8ecf5" font-size="14">B</text><text x="305" y="238" fill="#e8ecf5" font-size="14">C</text><text x="136" y="86" fill="#e8ecf5" font-size="13">D</text><text x="88" y="128" fill="#e8ecf5" font-size="13">E</text><text x="228" y="76" fill="#e8ecf5" font-size="13">G</text><text x="177" y="172" fill="#e8ecf5" font-size="13">F</text></svg>',
     '<svg viewBox="0 0 300 240" style="display:block;margin:0 auto;max-width:100%"><path d="M193.8,20 L40,204.2" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M193.8,20 L248,204.2" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M40,204.2 L248,204.2" stroke="#4f9eff" fill="none" stroke-width="2"/><path d="M70.8,167.4 L248,204.2" stroke="#4f9eff" fill="none" stroke-width="1.6"/><path d="M40,204.2 L225.4,127.5" stroke="#4f9eff" fill="none" stroke-width="1.6"/><path d="M122,106 L225.4,127.5" stroke="#4f9eff" fill="none" stroke-width="1.8"/><circle cx="122" cy="106" r="2.5" fill="#ffd166"/><circle cx="70.8" cy="167.4" r="2.5" fill="#ffd166"/><circle cx="225.4" cy="127.5" r="2.5" fill="#ffd166"/><circle cx="109.5" cy="175.4" r="2.5" fill="#ffd166"/><text x="196" y="14" fill="#e8ecf5" font-size="14" text-anchor="middle">A</text><text x="34" y="220" fill="#e8ecf5" font-size="14" text-anchor="end">B</text><text x="256" y="220" fill="#e8ecf5" font-size="14">C</text><text x="114" y="102" fill="#e8ecf5" font-size="13" text-anchor="end">D</text><text x="62" y="164" fill="#e8ecf5" font-size="13" text-anchor="end">E</text><text x="232" y="124" fill="#e8ecf5" font-size="13">G</text><text x="114" y="192" fill="#e8ecf5" font-size="13">F</text><text x="97" y="95" fill="#e8ecf5" font-size="13" text-anchor="end">15cm</text><text x="250" y="105" fill="#e8ecf5" font-size="13">12cm</text></svg>'),
    ('hd5s_10k1_7', ('steps', 0, 'svg'),
     '<svg viewBox="0 0 320 300" style="display:block;margin:0 auto;max-width:100%"><line x1="50" y1="50" x2="250" y2="50" stroke="#4f9eff" stroke-width="2"/><line x1="50" y1="50" x2="50" y2="170" stroke="#4f9eff" stroke-width="2"/><line x1="250" y1="50" x2="250" y2="250" stroke="#4f9eff" stroke-width="2"/><line x1="50" y1="50" x2="250" y2="250" stroke="#4f9eff" stroke-width="2"/><line x1="250" y1="50" x2="50" y2="170" stroke="#4f9eff" stroke-width="2"/><text x="10" y="115" fill="#e8ecf5" font-size="14">6cm</text><text x="255" y="155" fill="#e8ecf5" font-size="14">10cm</text><text x="128" y="80" fill="#e8ecf5" font-size="14">□cm</text><text x="150" y="30" fill="#e8ecf5" font-size="16">10cm</text></svg>',
     '<svg viewBox="0 0 320 300" style="display:block;margin:0 auto;max-width:100%"><line x1="50" y1="50" x2="250" y2="50" stroke="#4f9eff" stroke-width="2"/><line x1="50" y1="50" x2="50" y2="170" stroke="#4f9eff" stroke-width="2"/><line x1="250" y1="50" x2="250" y2="250" stroke="#4f9eff" stroke-width="2"/><line x1="50" y1="50" x2="250" y2="250" stroke="#4f9eff" stroke-width="2"/><line x1="250" y1="50" x2="50" y2="170" stroke="#4f9eff" stroke-width="2"/><line x1="125" y1="50" x2="125" y2="125" stroke="#4f9eff" stroke-width="1.5" stroke-dasharray="5,3"/><text x="10" y="115" fill="#e8ecf5" font-size="14">6cm</text><text x="255" y="155" fill="#e8ecf5" font-size="14">10cm</text><text x="170" y="68" fill="#e8ecf5" font-size="14">□cm</text><text x="150" y="30" fill="#e8ecf5" font-size="16">10cm</text></svg>'),
]

# ---------------------------------------------------------------- 図の検算
def _pts(s):
    """points="x,y x,y ..." を [(x,y),...] にする"""
    return [tuple(float(v) for v in p.split(',')) for p in s.split()]


def _poly(svg, idx=0):
    m = re.findall(r'<polygon points="([^"]+)"', svg)
    return _pts(m[idx])


def _rect(svg, idx=0):
    m = re.findall(r'<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"', svg)
    return tuple(float(v) for v in m[idx])


def _line(svg, idx=0):
    m = re.findall(r'<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"', svg)
    a = m[idx]
    return (float(a[0]), float(a[1])), (float(a[2]), float(a[3]))


def _d(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def _dot(a, b, c):
    return (b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1])


def _perp_ok(a, b, c, tol=0.02):
    """角a（ba と ca のなす角）が直角か。tol は cos の許容値"""
    v = _dot(a, b, c)
    n = _d(a, b) * _d(a, c)
    return n > 0 and abs(v) / n < tol


def _near(x, y, tol=0.02):
    return abs(x - y) <= tol * max(1.0, abs(y))


def _cross_pt(p1, p2, p3, p4):
    x1, y1 = p1
    x2, y2 = p2
    x3, y3 = p3
    x4, y4 = p4
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
    return (px, py)


def _get(did, path):
    for _d0, _p, _old, _new in EDITS:
        if _d0 == did and _p == path:
            return _new
    raise KeyError((did, path))


def geometry_checks():
    """入れようとしている図SVGの座標から数値を出し、問題文と合うか確かめる。
    1つでも合わなければ False（＝1件も書かない）。"""
    bad = []

    # --- hd5s_9k1_7 (1) 直角は頂点A・AD=12・BD=24・DC=6（10px/cm）
    s = _get('hd5s_9k1_7', ('steps', 0, 'svg'))
    B, C, A = _poly(s)
    D = _line(s, 0)[1]  # 垂線の下端…実際は上端。両端から底辺上の点をとる
    p, q = _line(s, 0)
    D = p if p[1] > q[1] else q
    if not _perp_ok(A, B, C):
        bad.append('9k1_7(1) 頂点Aが直角でない')
    for nm, got, want in (('AD', _d(A, D) / 10, 12), ('BD', _d(B, D) / 10, 24), ('DC', _d(D, C) / 10, 6)):
        if not _near(got, want):
            bad.append('9k1_7(1) %s=%.3f (want %s)' % (nm, got, want))

    # --- hd5s_9k1_7 (2) 156/65/169・直角はP2・□=25（2px/cm）
    s = _get('hd5s_9k1_7', ('steps', 1, 'svg'))
    P1, P2, P3 = _poly(s)
    a, b = _line(s, 0)
    Ft = b if _d(a, P2) < _d(b, P2) else a
    if not _perp_ok(P2, P1, P3):
        bad.append('9k1_7(2) 直角の頂点が直角でない')
    for nm, got, want in (('156', _d(P1, P2) / 2, 156), ('65', _d(P2, P3) / 2, 65),
                          ('169', _d(P1, P3) / 2, 169), ('box', _d(Ft, P3) / 2, 25)):
        if not _near(got, want):
            bad.append('9k1_7(2) %s=%.3f (want %s)' % (nm, got, want))
    if not _perp_ok(Ft, P2, P3, tol=0.03):
        bad.append('9k1_7(2) 垂線が斜辺と垂直でない')

    # --- hd5s_9k1_7 (3) CA=16 CB=12 AB=20 直角C・PQ=6・QB=12（10px/cm）
    s = _get('hd5s_9k1_7', ('steps', 2, 'svg'))
    A3, B3, C3 = _poly(s)
    P, Q = _line(s, 0)
    if P[1] > Q[1]:
        P, Q = Q, P
    if not _perp_ok(C3, A3, B3):
        bad.append('9k1_7(3) 頂点が直角でない')
    for nm, got, want in (('CA', _d(C3, A3) / 10, 16), ('CB', _d(C3, B3) / 10, 12),
                          ('AB', _d(A3, B3) / 10, 20), ('PQ', _d(P, Q) / 10, 6), ('QB', _d(Q, B3) / 10, 12)):
        if not _near(got, want):
            bad.append('9k1_7(3) %s=%.3f (want %s)' % (nm, got, want))

    # --- hd5s_9k1_8 (1)40/30/50 FG=19.2 (4px/cm) / (2)4:16 BD=8 (9px/cm)
    s = _get('hd5s_9k1_8', ('svg',))
    A, B, C = _poly(s, 0)
    F1, G1 = _line(s, 2)   # 3本目の line が F-G
    if not _perp_ok(B, A, C):
        bad.append('9k1_8(1) 右下が直角でない')
    for nm, got, want in (('AB', _d(A, B) / 4, 40), ('BC', _d(B, C) / 4, 30),
                          ('AC', _d(A, C) / 4, 50), ('FG', _d(F1, G1) / 4, 19.2)):
        if not _near(got, want):
            bad.append('9k1_8(1) %s=%.3f (want %s)' % (nm, got, want))
    A2, B2, C2 = _poly(s, 1)
    b0, d0 = _line(s, 3)
    if _d(b0, B2) > _d(d0, B2):
        b0, d0 = d0, b0
    if not _perp_ok(B2, A2, C2):
        bad.append('9k1_8(2) 左下が直角でない')
    for nm, got, want in (('AD', _d(A2, d0) / 9, 4), ('DC', _d(d0, C2) / 9, 16),
                          ('BD', _d(B2, d0) / 9, 8), ('AC', _d(A2, C2) / 9, 20)):
        if not _near(got, want):
            bad.append('9k1_8(2) %s=%.3f (want %s)' % (nm, got, want))
    if not _perp_ok(d0, A2, B2, tol=0.03):
        bad.append('9k1_8(2) 垂線が斜辺と垂直でない')

    # --- hd5s_9k1_9 (1) AB=20 BC=30 正方形12 / (2) CB=28 BA=21 正方形12
    s = _get('hd5s_9k1_9', ('svg',))
    A, B, C = _poly(s, 0)
    rx, ry, rw, rh = _rect(s, 0)
    if not _perp_ok(B, A, C):
        bad.append('9k1_9(1) 直角でない')
    for nm, got, want in (('AB', _d(A, B) / 10, 20), ('BC', _d(B, C) / 10, 30),
                          ('sq', rw / 10, 12), ('sq2', rh / 10, 12)):
        if not _near(got, want):
            bad.append('9k1_9(1) %s=%.3f (want %s)' % (nm, got, want))
    Fq = (rx + rw, ry)
    t = ((Fq[0] - A[0]) * (C[0] - A[0]) + (Fq[1] - A[1]) * (C[1] - A[1])) / _d(A, C) ** 2
    if _d(Fq, (A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1]))) > 0.5:
        bad.append('9k1_9(1) 正方形の頂点Fが斜辺の上にない')
    C2, B2, A2 = _poly(s, 1)
    sq = _poly(s, 2)
    if not _perp_ok(B2, C2, A2):
        bad.append('9k1_9(2) 頂点Bが直角でない')
    for nm, got, want in (('CB', _d(C2, B2) / 11, 28), ('BA', _d(B2, A2) / 11, 21), ('CA', _d(C2, A2) / 11, 35)):
        if not _near(got, want):
            bad.append('9k1_9(2) %s=%.3f (want %s)' % (nm, got, want))
    for i in range(4):
        e = _d(sq[i], sq[(i + 1) % 4]) / 11
        if not _near(e, 12):
            bad.append('9k1_9(2) 正方形の辺=%.3f (want 12)' % e)
        if not _perp_ok(sq[(i + 1) % 4], sq[i], sq[(i + 2) % 4]):
            bad.append('9k1_9(2) 正方形の角が直角でない')

    # --- hd5s_9k1_6 (2) AD=4 AE=8 EB=7 BC=14 / 3つの直角
    s = _get('hd5s_9k1_6', ('steps', 1, 'svg'))
    A = _line(s, 0)[0]
    D = _line(s, 0)[1]
    B = _line(s, 1)[1]
    E = _line(s, 2)[1]
    C = _line(s, 4)[1]
    for nm, got, want in (('AD', _d(A, D) / 15, 4), ('AE', _d(A, E) / 15, 8),
                          ('EB', _d(E, B) / 15, 7), ('BC', _d(B, C) / 15, 14)):
        if not _near(got, want):
            bad.append('9k1_6(2) %s=%.3f (want %s)' % (nm, got, want))
    for nm, tri in (('DAE', (A, D, E)), ('DEC', (E, D, C)), ('EBC', (B, E, C))):
        if not _perp_ok(*tri):
            bad.append('9k1_6(2) 角%sが90度でない' % nm)

    # --- hd5s_9k1_14 (1) 27/54・正方形18,12,8 / (2) 3/4/5・正方形60/37
    s = _get('hd5s_9k1_14', ('steps', 0, 'svg'))
    B, C, A = _poly(s, 0)
    if not _perp_ok(B, A, C):
        bad.append('9k1_14(1) Bが直角でない')
    for nm, got, want in (('AB', _d(A, B) / 10, 27), ('BC', _d(B, C) / 10, 54)):
        if not _near(got, want):
            bad.append('9k1_14(1) %s=%.3f (want %s)' % (nm, got, want))
    for i, want in enumerate((18, 12, 8)):
        rx, ry, rw, rh = _rect(s, i)
        if not (_near(rw / 10, want) and _near(rh / 10, want)):
            bad.append('9k1_14(1) 正方形%d=%.3f (want %s)' % (i + 1, rw / 10, want))
        top = (rx + rw, ry)
        t = ((top[0] - A[0]) * (C[0] - A[0]) + (top[1] - A[1]) * (C[1] - A[1])) / _d(A, C) ** 2
        if _d(top, (A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1]))) > 0.6:
            bad.append('9k1_14(1) 正方形%dの右上が斜辺にない' % (i + 1))
    s = _get('hd5s_9k1_14', ('steps', 1, 'svg'))
    A, B, C = _poly(s, 0)
    sq = _poly(s, 1)
    if not _perp_ok(B, A, C):
        bad.append('9k1_14(2) Bが直角でない')
    for nm, got, want in (('AB', _d(A, B) / 40, 3), ('BC', _d(B, C) / 40, 4), ('AC', _d(A, C) / 40, 5)):
        if not _near(got, want):
            bad.append('9k1_14(2) %s=%.3f (want %s)' % (nm, got, want))
    for i in range(4):
        e = _d(sq[i], sq[(i + 1) % 4]) / 40
        if not _near(e, 60.0 / 37, 0.005):
            bad.append('9k1_14(2) 正方形の辺=%.4f (want 60/37)' % e)
        if not _perp_ok(sq[(i + 1) % 4], sq[i], sq[(i + 2) % 4]):
            bad.append('9k1_14(2) 正方形の角が直角でない')
    on_ac = 0
    for P in sq:
        t = ((P[0] - A[0]) * (C[0] - A[0]) + (P[1] - A[1]) * (C[1] - A[1])) / _d(A, C) ** 2
        if _d(P, (A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1]))) < 0.6:
            on_ac += 1
    if on_ac != 2:
        bad.append('9k1_14(2) 斜辺ACの上にある正方形の頂点が%d個（2個のはず）' % on_ac)

    # --- hd5s_9k1_16 Bの建物(16m)がAの建物(10m)より高く、比が16:10
    s = _get('hd5s_9k1_16', ('svg',))
    pa = _poly(s, 0)
    pb = _poly(s, 2)
    ha = abs(pa[0][1] - pa[3][1])
    hb = abs(pb[0][1] - pb[3][1])
    if not (hb > ha):
        bad.append('9k1_16 Bの建物がAより高く描かれていない')
    if not _near(hb / ha, 1.6, 0.03):
        bad.append('9k1_16 高さの比=%.3f (want 1.6)' % (hb / ha))

    # --- hd5s_10k1_2 (1) x区間:y区間 = 1:2（仕切り線→交点／交点→右上）
    s = _get('hd5s_10k1_2', ('steps', 0, 'svg'))
    rx, ry, rw, rh = _rect(s, 0)
    if not _near(rw / rh, 2.0):
        bad.append('10k1_2(1) 長方形が4cm×2cmでない')
    div = _line(s, 0)[0][0]
    L1 = ((rx, ry + rh), (rx + rw, ry))            # 全体の対角線
    L2 = ((div, ry), (rx + rw, ry + rh))           # 右の正方形の対角線
    X = _cross_pt(L1[0], L1[1], L2[0], L2[1])
    Pdiv = (div, ry + rh - (div - rx) * rh / rw)   # 仕切り線と全体の対角線の交点
    xr = _d(Pdiv, X)
    yr = _d(X, L1[1])
    if not _near(yr / xr, 2.0):
        bad.append('10k1_2(1) x:y=1:%.3f (want 1:2)' % (yr / xr))
    # ラベルが正しい側にあるか（x は仕切り線寄り、y は右上寄り）
    tx = re.findall(r'<text x="([-\d.]+)" y="([-\d.]+)"[^>]*>([xy])</text>', s)
    pos = {t[2]: (float(t[0]), float(t[1])) for t in tx}
    if not (div < pos['x'][0] < X[0] + 2 and X[0] < pos['y'][0] < rx + rw):
        bad.append('10k1_2(1) x/y のラベルの位置が入れかわっている')

    # --- hd5s_10k1_4 (2) 左=15 右=30 中央=10（4px/cm）
    s = _get('hd5s_10k1_4', ('steps', 1, 'svg'))
    ds = re.findall(r'<path d="M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)"', s)
    seg = [((float(a), float(b)), (float(c), float(e))) for a, b, c, e in ds]
    top_y = seg[0][0][1]
    left = seg[1]
    right = seg[2]
    X = _cross_pt(seg[3][0], seg[3][1], seg[4][0], seg[4][1])
    for nm, got, want in (('left', abs(left[1][1] - top_y) / 4, 15),
                          ('right', abs(right[1][1] - top_y) / 4, 30),
                          ('mid', abs(X[1] - top_y) / 4, 10)):
        if not _near(got, want):
            bad.append('10k1_4(2) %s=%.3f (want %s)' % (nm, got, want))

    # --- hd5s_10k1_6 AB=15 AC=12・DG∥EC・AD=7 AG=7 AE=12・BF:FG=3:5
    s = _get('hd5s_10k1_6', ('svg',))
    ds = re.findall(r'<path d="M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)"', s)
    seg = [((float(a), float(b)), (float(c), float(e))) for a, b, c, e in ds]
    A, B = seg[0]
    _, C = seg[1]
    E, _c = seg[3]
    _b, G = seg[4]
    D, _g = seg[5]
    sc = _d(A, B) / 15.0
    for nm, got, want in (('AB', _d(A, B) / sc, 15), ('AC', _d(A, C) / sc, 12),
                          ('AE', _d(A, E) / sc, 12), ('AD', _d(A, D) / sc, 7), ('AG', _d(A, G) / sc, 7)):
        if not _near(got, want, 0.01):
            bad.append('10k1_6 %s=%.3f (want %s)' % (nm, got, want))
    cr = (G[0] - D[0]) * (C[1] - E[1]) - (G[1] - D[1]) * (C[0] - E[0])
    if abs(cr) / (_d(D, G) * _d(E, C)) > 0.002:
        bad.append('10k1_6 DGとECが平行でない')
    F = _cross_pt(B, G, E, C)
    r = _d(B, F) / _d(F, G)
    if not _near(r, 0.6, 0.01):
        bad.append('10k1_6 BF:FG=%.3f (want 0.6)' % r)

    # --- hd5s_10k1_7 上の辺10cm・左6cm・右10cm・□=6.25
    s = _get('hd5s_10k1_7', ('steps', 0, 'svg'))
    TL, TR = _line(s, 0)
    _, L = _line(s, 1)
    _, R = _line(s, 2)
    X = _cross_pt(TL, R, TR, L)
    sc = _d(TL, TR) / 10.0
    for nm, got, want in (('top', _d(TL, TR) / sc, 10), ('left', _d(TL, L) / sc, 6), ('right', _d(TR, R) / sc, 10)):
        if not _near(got, want):
            bad.append('10k1_7 %s=%.3f (want %s)' % (nm, got, want))
    if not _near((TR[0] - X[0]) / sc, 6.25):
        bad.append('10k1_7 □=%.4f (want 6.25)' % ((TR[0] - X[0]) / sc))
    foot = _line(s, 5)
    if not (_near(foot[0][0], X[0], 0.01) and _near(foot[1][0], X[0], 0.01)):
        bad.append('10k1_7 交点から上の辺への垂線が交点の真上にない')

    return bad


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(HERE), 'data', 'hama_daimon.json')
    bad = geometry_checks()
    if bad:
        print('図の検算に失敗したので1件も書きません:')
        for b in bad:
            print('  -', b)
        return 1

    d = json.load(io.open(target, 'r', encoding='utf-8'))
    by_id = {}
    for r in iter_daimon(d, grade='5', app_courses=['sairei']):
        x = r['x']
        if x.get('id'):
            by_id.setdefault(x['id'], []).append(x)

    applied, already, ng = [], [], []
    for did, path, old, new in EDITS:
        lst = by_id.get(did) or []
        if len(lst) != 1:
            ng.append('%s %s: 大問が%d件（1件のはず）' % (did, path, len(lst)))
            continue
        x = lst[0]
        if path[0] == 'svg':
            cur = x.get('svg')
        else:
            if path[1] >= len(x.get('steps', [])):
                ng.append('%s %s: 小問がない' % (did, path))
                continue
            cur = x['steps'][path[1]].get(path[2])
        if cur == new:
            already.append('%s %s' % (did, path))
        elif cur == old:
            applied.append((did, path, x))
        else:
            ng.append('%s %s: 現物が old とも new とも違う' % (did, path))
    if ng:
        print('当てられない箇所があるので1件も書きません:')
        for m in ng:
            print('  -', m)
        return 1

    for did, path, x in applied:
        new = [e[3] for e in EDITS if e[0] == did and e[1] == path][0]
        if path[0] == 'svg':
            x['svg'] = new
        else:
            x['steps'][path[1]][path[2]] = new

    io.open(target, 'wb').write(
        json.dumps(d, ensure_ascii=False, indent=1).encode('utf-8'))
    print('対象: %s' % target)
    print('適用: %d件 / 適用ずみ: %d件' % (len(applied), len(already)))
    for did, path, _x in applied:
        print('  + %s %s' % (did, path))
    return 0


if __name__ == '__main__':
    sys.exit(main())
