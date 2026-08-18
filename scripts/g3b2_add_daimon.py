# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.16〜22で「図が本体」のため保留していた大問を
hama_daimon.json に追加する。

★設問・答えは原簿（hamagakuen_ryomon_genbo.md）のまま。答え方だけアプリの
  様式（テンキー／choices）に変える（feedback_genbo_dori のルール）。
★図SVGは原簿の「- 図SVG:」欄からそのまま読み込む（二重管理しない）。
★既存のsrc（HG番号）が同じ回にもう入っていれば、二重追加を避けてスキップする。
★配列内の並び順は原簿の出典順（やさしい→むずかしい→チャレンジ）にそろえる。
  id の連番はすでに入っている番号と衝突しない番号を新規に振るだけで、
  並び順の意味は持たせない（表示順は配列順が決める）。

使い方: python scripts/g3b2_add_daimon.py [--write]
"""
import argparse
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

_g = io.open(find_genbo(), encoding="utf-8").read()
_SVG_CACHE = {}
for _r in re.split(r"(?=^### 【HG-)", _g, flags=re.M):
    _m = re.match(r"### 【(HG-\d+)】", _r)
    if not _m:
        continue
    _m2 = re.search(r"^- 図SVG: (.+)$", _r, re.M)
    if _m2:
        _SVG_CACHE[_m.group(1)] = _m2.group(1).strip().strip("`")


def svg_of(hg):
    v = _SVG_CACHE.get(hg, "")
    return "" if v == "判読不能" else v


# ROUNDS[no] = [ {src, title, category, star, intro, steps:[{question,answer,[choices],meaning}]} , ... ]
ROUNDS = {}


def R(no):
    return ROUNDS.setdefault(str(no), [])


# ═══════════════════════════ No.16 角(1) ═══════════════════════════════
R(16).append(dict(
    src="HG-4170", title="交わった2直線の角・穴うめ", category="zu", star=1,
    intro="2本の直線が交わった図です。交点のまわりに あ・い・う・え の4つの角があります。",
    steps=[
        dict(question="あとえ、あといの角度を合わせるとそれぞれ直線ですから①度です。①にあてはまる数は？",
             answer="180", meaning="一直線は180°。"),
        dict(question="いの角度は②度−40度で求まります。②にあてはまる数は？",
             answer="180", meaning="あといを合わせると一直線＝180°。"),
        dict(question="③にあてはまる数（いの角度）は？", answer="140",
             meaning="180−40＝140。"),
        dict(question="えといの角度は等しく④度です。④にあてはまる数は？", answer="140",
             meaning="対頂角（向かい合った角）は等しい。"),
        dict(question="うの角度（⑤）は何度ですか？", answer="40",
             meaning="うはあの対頂角なので40°。"),
    ]))
R(16).append(dict(
    src="HG-4171", title="一直線・直角からの引き算6問", category="zu", star=1,
    intro="一直線は180°、直角は90°です。あ〜かの角度を求めなさい。",
    steps=[
        dict(question="あ（横線に20°の斜線がある図）の角度は？", answer="160", meaning="180−20＝160。"),
        dict(question="い（横線に155°がある図）の角度は？", answer="25", meaning="180−155＝25。"),
        dict(question="う（横線に65°と60°の2本の斜線がある図）の角度は？", answer="55",
             meaning="180−(65+60)＝55。"),
        dict(question="え（直角のしるしがある図）の角度は？", answer="90", meaning="180−90＝90。"),
        dict(question="お（横線に70°で交わる線の反対がわ）の角度は？", answer="110",
             meaning="180−70＝110。"),
        dict(question="か（直角のしるしと30°がある図）の角度は？", answer="60",
             meaning="180−(90+30)＝60。"),
    ]))
R(16).append(dict(
    src="HG-4172", title="360°まわりの角・7問", category="zu", star=1,
    intro="1まわりは360°です。対頂角（向かい合った角）は等しいことも使います。",
    steps=[
        dict(question="あ（2直線の交点で160°の向かい合った角）の角度は？", answer="160",
             meaning="対頂角は等しい。"),
        dict(question="い（130°の外がわ・1まわりの残り）の角度は？", answer="230",
             meaning="360−130＝230。"),
        dict(question="う（130°と60°がある3直線の交点）の角度は？", answer="70",
             meaning="130−60＝70。"),
        dict(question="え（50°がある3直線の交点）の角度は？", answer="50", meaning="対頂角は等しい。"),
        dict(question="お（えのとなり）の角度は？", answer="130", meaning="180−50＝130。"),
        dict(question="か（おの対頂角）の角度は？", answer="130", meaning="対頂角は等しい。"),
        dict(question="き（直角の外がわ・1まわりの残り）の角度は？", answer="270",
             meaning="360−90＝270。"),
    ]))
R(16).append(dict(
    src="HG-4173", title="平行線と1本の直線・同位角と錯角", category="zu", star=2,
    intro="直線ア、イは平行です。1本の斜めの直線が両方を横切っています。アとの交点の右上が50°です。",
    steps=[
        dict(question="①（アとの交点の左上）の角度は？", answer="130", meaning="180−50＝130。"),
        dict(question="②（アとの交点の左下）の角度は？", answer="50", meaning="対頂角は50°。"),
        dict(question="③（アとの交点の右下）の角度は？", answer="130", meaning="対頂角は130°。"),
        dict(question="④（イとの交点の左上）の角度は？", answer="130", meaning="同位角は等しい。"),
        dict(question="⑤（イとの交点の左下）の角度は？", answer="50", meaning="錯角は等しい。"),
        dict(question="⑥（イとの交点の右下）の角度は？", answer="130", meaning="同位角は等しい。"),
        dict(question="⑦（イとの交点の右上）の角度は？", answer="50", meaning="同位角は等しい。"),
    ]))
R(16).append(dict(
    src="HG-4174", title="2組の平行線＝平行四辺形の角", category="zu", star=2,
    intro="直線アとイ、直線ウとエはそれぞれ平行です。エとアの交点の左上が63°です。",
    steps=[
        dict(question="あ（ウとアの交点の左下）の角度は？", answer="117", meaning="180−63＝117。"),
        dict(question="い（ウとイの交点の左上）の角度は？", answer="63", meaning="平行線の同位角は等しい。"),
        dict(question="う（エとイの交点の右上）の角度は？", answer="117", meaning="180−63＝117。"),
        dict(question="え（エとアの交点の右下）の角度は？", answer="63", meaning="対頂角は63°。"),
    ]))
R(16).append(dict(
    src="HG-4175", title="平行線・55°をうつす", category="zu", star=2,
    intro="直線アとイは平行です。斜めの直線がアと交わる右下の角が55°です。",
    steps=[
        dict(question="あ（イとの交点・上がわ）の角度は？", answer="55", meaning="同位角は等しい。"),
        dict(question="い（イとの交点・下がわ）の角度は？", answer="125", meaning="180−55＝125。"),
    ]))
R(16).append(dict(
    src="HG-4176", title="2組の平行線・115°をうつす", category="zu", star=2,
    intro="直線アとイ、直線ウとエはそれぞれ平行です。ウとイの交点の下がわが115°です。",
    steps=[
        dict(question="あ（ウとアの交点の下）の角度は？", answer="65", meaning="180−115＝65。"),
        dict(question="い（ウとイの交点の上）の角度は？", answer="65", meaning="対頂角は65°。"),
        dict(question="う（エとアの交点の上）の角度は？", answer="115", meaning="同位角は等しい。"),
        dict(question="え（エとイの交点の右）の角度は？", answer="65", meaning="180−115＝65。"),
    ]))
R(16).append(dict(
    src="HG-4177", title="重なった角の差・1まわりの残り4問", category="zu", star=2,
    intro="1点から3本の線が出た図です。①130°と60°　②112°と42°　③120°と50°　④110°と120°",
    steps=[
        dict(question="①のあ（130°と60°の差）は？", answer="70", meaning="130−60＝70。"),
        dict(question="①のい（1まわりの残り）は？", answer="230", meaning="360−130＝230。"),
        dict(question="②のあ（112°と42°の差）は？", answer="70", meaning="112−42＝70。"),
        dict(question="②のい（1まわりの残り）は？", answer="248", meaning="360−112＝248。"),
        dict(question="③のあ（180−120）は？", answer="60", meaning="180−120＝60。"),
        dict(question="③のい（1まわりの残り）は？", answer="250", meaning="360−(60+50)＝250。"),
        dict(question="④のあ（180−110）は？", answer="50", meaning="180−110＝70、120−70＝50。"),
        dict(question="④のい（1まわりの残り）は？", answer="250", meaning="360−110＝250。"),
    ]))
R(16).append(dict(
    src="HG-4178", title="ジグザグの平行線・折れ線の角", category="zu", star=3,
    intro="直線ア、イは平行（アが上、イが下）。その間にジグザグの折れ線があります。"
          "折れ点を通る補助の平行線をひくと、その角は上下2つの角の和（または差）になります。",
    steps=[
        dict(question="あ（左の折れ点。アと52°、イと42°で交わる）の角度は？", answer="94",
             meaning="52+42＝94。"),
        dict(question="い（中央の折れ点。113°との差でイと39°）の角度は？", answer="74",
             meaning="113−39＝74。"),
        dict(question="う（右の折れ点。43°/67°とイの下がわ124°から）の角度は？", answer="80",
             meaning="(67−43)+(180−124)＝24+56＝80。"),
        dict(question="え（下の図。アと30°・イと107°）の角度は？", answer="43",
             meaning="180−(107+30)＝43。"),
        dict(question="お（下の図。えのとなり）の角度は？", answer="150",
             meaning="180−30＝150。"),
    ]))
R(16).append(dict(
    src="HG-4179", title="等しい2組の角で180°を2等分", category="zu", star=2,
    intro="横線の上に3本の線が出ていて、左から●・●・×・×の順に4つの角がならんでいます。"
          "同じしるしの角度は同じです。",
    steps=[
        dict(question="あ（内がわの2つの角・●と×を合わせた角）は何度ですか？", answer="90",
             meaning="●+●+×+×＝180なので●+×＝180÷2＝90。"),
    ]))

# ═══════════════════════════ No.17 角(2) ═══════════════════════════════
R(17).append(dict(
    src="HG-4180", title="三角じょうぎの角度", category="zu", star=1,
    intro="三角じょうぎの角度をおぼえましょう。左の三角じょうぎ＝30-60-90（直角二等辺ではない方）、"
          "右の三角じょうぎ＝45-45-90です。",
    steps=[
        dict(question="(ア)＝左の三角じょうぎの上の角は何度？", answer="30", meaning="30-60-90のじょうぎ。"),
        dict(question="(イ)＝左の三角じょうぎの左下の角は何度？", answer="90", meaning="直角。"),
        dict(question="(ウ)＝左の三角じょうぎの右下の角は何度？", answer="60", meaning="180−30−90＝60。"),
        dict(question="(エ)＝右の三角じょうぎの上の角は何度？", answer="45", meaning="45-45-90のじょうぎ。"),
        dict(question="(オ)＝右の三角じょうぎの左下の角は何度？", answer="90", meaning="直角。"),
        dict(question="(カ)＝右の三角じょうぎの右下の角は何度？", answer="45", meaning="180−45−90＝45。"),
    ]))
R(17).append(dict(
    src="HG-4181", title="三角じょうぎを組み合わせた角・6問", category="zu", star=2,
    intro="1組の三角じょうぎ（30-60-90 と 45-45-90）を組み合わせた図です。重なった部分は"
          "「たす」、はみ出した部分は「ひく」で考えます。",
    steps=[
        dict(question="①（45°と30°を左上の頂点で重ねた図）のあの角度は？", answer="75",
             meaning="30+45＝75。"),
        dict(question="①のい（下の直角の外）の角度は？", answer="135", meaning="90+45＝135。"),
        dict(question="②（30-60-90の斜辺に45-45-90を乗せた図）のうの角度は？", answer="75",
             meaning="30+45＝75。"),
        dict(question="②のえ（180°をこえる角）の角度は？", answer="225", meaning="180+45＝225。"),
        dict(question="③（同じ底辺に2まいを立てた図）のおの角度は？", answer="15",
             meaning="45−30＝15。"),
        dict(question="④（斜辺に直角の辺を重ねた図）のかの角度は？", answer="120",
             meaning="30+90＝120。"),
    ]))
R(17).append(dict(
    src="HG-4182", title="時計の針の作る角・6問", category="zu", star=2,
    intro="文字ばんの1めもりは360÷12＝30°です。長い針と短い針の作る小さいほうの角度をもとめなさい。",
    steps=[
        dict(question="① 2時のとき、角度は何度ですか。", answer="60", meaning="30×2＝60。"),
        dict(question="② 9時のとき、角度は何度ですか。", answer="90", meaning="30×3＝90。"),
        dict(question="③ 7時のとき、角度は何度ですか。", answer="150", meaning="30×5＝150。"),
        dict(question="④ 3時のとき、角度は何度ですか。", answer="90", meaning="30×3＝90。"),
        dict(question="⑤ 1時のとき、角度は何度ですか。", answer="30", meaning="30×1＝30。"),
        dict(question="⑥ 7時30分のとき、角度は何度ですか。", answer="45",
             meaning="短い針は30分で15°動くので30+15＝45。"),
    ]))
R(17).append(dict(
    src="HG-4183", title="三角じょうぎの組み合わせ・8問", category="zu", star=3,
    intro="三角じょうぎ（30-60-90／45-45-90）を組み合わせた6つの図です。あ〜くの角度をもとめなさい。",
    steps=[
        dict(question="あ（60°と45°の重なりの左下の小さい角）は？", answer="15", meaning="60−45＝15。"),
        dict(question="い（同じ頂点から45°と30°の差）は？", answer="15", meaning="45−30＝15。"),
        dict(question="う（30-60-90に45-45-90の直角をのせた図・下がわ）は？", answer="150",
             meaning="90+60＝150。"),
        dict(question="え（同じ図・斜辺の上の点）は？", answer="135", meaning="180−45＝135。"),
        dict(question="お（横線の上に2まいならべた図）は？", answer="75", meaning="180−(60+45)＝75。"),
        dict(question="か（29°と30°で直角を分けた図）は？", answer="31",
             meaning="90−(29+30)＝31。"),
        dict(question="き（同じ底辺に2まい立てた図・左）は？", answer="60", meaning="90−30＝60。"),
        dict(question="く（同じ図・右）は？", answer="135", meaning="180−45＝135。"),
    ]))
# HG-4184・4185 は実装ずみ（既存）

# ═══════════════════════════ No.18 平面図形(1) 三角形 ═══════════════════
R(18).append(dict(
    src="HG-4186", title="三角形をえらぶ", category="zu", star=1,
    intro="下のあ〜さの11個の図形から、三角形をすべてえらびなさい。",
    steps=[dict(question="三角形はどれですか（全部選んだ組み合わせ）。", answer="あ、う、く、け",
                choices=["あ、う、く、け", "あ、い、く、け", "あ、う、く、こ", "あ、う、き、け"],
                meaning="3本の直線でかこまれた形が三角形。あ・う・く・けの4つ。")]))
R(18).append(dict(
    src="HG-4188", title="辺の長さをうめる（正三角形・二等辺三角形）", category="zu", star=1,
    intro="正三角形・二等辺三角形は、等しい辺がどこかを見て長さを求めます。",
    steps=[
        dict(question="① 1辺7cmの正三角形の残りの辺の長さは何cmですか。", answer="7",
             meaning="正三角形は3辺とも同じ長さ。"),
        dict(question="② 二等辺三角形で片方の辺が9cmのとき、もう片方の等しい辺は何cmですか。",
             answer="9", meaning="二等辺三角形は2辺が等しい。"),
        dict(question="③ 二等辺三角形（左上5.6cm・右3.2cm）の底辺は何cmですか。", answer="5.6",
             meaning="等しい辺の長さがそのまま底辺以外のもう1辺になる。"),
    ]))
R(18).append(dict(
    src="HG-4189", title="正三角形・二等辺三角形の角", category="zu", star=2,
    intro="正三角形の角は60°、二等辺三角形の底角は等しく、三角形の角の和は180°です。",
    steps=[
        dict(question="㋐＝3辺5cmの正三角形の1つの角は何度ですか。", answer="60", meaning="正三角形の角はすべて60°。"),
        dict(question="㋑＝2辺が6cmの二等辺三角形で底角の1つが70°のとき、頂角は何度ですか。",
             answer="40", meaning="180−70×2＝40。"),
        dict(question="㋒＝同じ図で、もう1つの底角は何度ですか。", answer="70",
             meaning="二等辺三角形の底角は等しい。"),
    ]))
R(18).append(dict(
    src="HG-4190", title="3つの三角形の名まえと等しい角", category="zu", star=1,
    intro="(あ)＝3辺が5cm・4cm・3cmで直角のしるしがある三角形。(い)＝3辺とも4cmの三角形。"
          "(う)＝5cm・4cm・5cmの三角形。",
    steps=[
        dict(question="① (あ)の三角形の名まえは？", answer="直角三角形",
             choices=["直角三角形", "二等辺三角形", "正三角形", "直角二等辺三角形"],
             meaning="直角のしるしがある3辺がちがう三角形。"),
        dict(question="② (い)の名まえは？", answer="正三角形",
             choices=["正三角形", "二等辺三角形", "直角三角形", "直角二等辺三角形"],
             meaning="3辺が同じ長さ。"),
        dict(question="③ (う)の名まえは？", answer="二等辺三角形",
             choices=["二等辺三角形", "正三角形", "直角三角形", "直角二等辺三角形"],
             meaning="2辺（5cmと5cm）が同じ長さ。"),
    ]))
R(18).append(dict(
    src="HG-4193", title="2つおりにして切りひらく", category="zu", star=2,
    intro="長方形の紙を2つおりにして重ね、点線のところで切ってひらきます。",
    steps=[
        dict(question="① 切り口5cm・折り目から2cmのとき、できる形は何ですか。", answer="二等辺三角形",
             choices=["二等辺三角形", "正三角形", "直角二等辺三角形", "直角三角形"],
             meaning="折り目を軸に左右対称なので二等辺三角形。"),
        dict(question="①の3つの辺の長さを合わせると何cmになりますか。", answer="14",
             meaning="5×2+4＝14。"),
        dict(question="② 切り口4cm・折り目から2cmのとき、3つの辺の長さの合計は何cmですか。",
             answer="12", meaning="4×3＝12。"),
        dict(question="③ たて4cm・よこ4cmのとき、できる形は何ですか。", answer="直角二等辺三角形",
             choices=["直角二等辺三角形", "正三角形", "二等辺三角形", "直角三角形"],
             meaning="45°×2＝90°なので直角二等辺三角形。"),
    ]))
R(18).append(dict(
    src="HG-4194", title="図の中の三角形を数える", category="zu", star=3,
    intro="大きさ別に分けて数えると、もれもダブりも出ません。",
    steps=[
        dict(question="① 直角二等辺三角形は大小合わせて何こありますか。", answer="7",
             meaning="小さいの4こ＋2こ分が2こ＋全体1こ＝7こ。"),
        dict(question="② 正三角形は大小合わせて何こありますか。", answer="27",
             meaning="1こ分16こ＋4こ分7こ＋9こ分3こ＋16こ分1こ＝27こ。"),
    ]))
R(18).append(dict(
    src="HG-4195", title="三角形の角の和・6問", category="zu", star=2,
    intro="三角形の3つの角の和は180°、一直線は180°です。",
    steps=[
        dict(question="①（65°・55°・25°がある大きい三角形の中の線・左）は？", answer="60",
             meaning="180−(65+55)＝60。"),
        dict(question="②（同じ図・右）は？", answer="120", meaning="180−60＝120。"),
        dict(question="③（同じ図の右下）は？", answer="35", meaning="180−(120+25)＝35。"),
        dict(question="④（25°・45°がある図）は？", answer="135", meaning="180−45＝135。"),
        dict(question="⑤（同じ図）は？", answer="20", meaning="180−(25+135)＝20。"),
        dict(question="⑥（同じ図）は？", answer="65", meaning="180−(25+90)＝65。"),
    ]))
R(18).append(dict(
    src="HG-4197", title="等しい角・二等辺三角形の連鎖・星形の角の和", category="zu", star=3,
    intro="三角形の外角＝となり合わない2つの内角の和、という性質を使います。",
    steps=[
        dict(question="① 内側の角が130°のとき、頂角①は何度ですか。",
             answer="80", meaning="180−130＝50が○と△の和、180−50×2＝80。"),
        dict(question="② OA,OB,BCが同じ長さの三角形で、角OBC＝30°のとき、角AOB（②）は？",
             answer="120", meaning="180−30×2＝120。"),
        dict(question="③ 角OCB（③）は何度ですか。", answer="60", meaning="180−120＝60。"),
        dict(question="④ 角OBC以外の角（④）は何度ですか。", answer="60",
             meaning="180−60×2＝60。"),
        dict(question="⑤ 星形の㋐㋑㋒㋓㋔の角度の合計は？", answer="180",
             meaning="外角の性質でとがった角を1つの三角形に集めると180°。"),
    ]))

# ═══════════════════════════ No.19 平面図形(2) 四角形 ═══════════════════
R(19).append(dict(
    src="HG-4198", title="四角形の名まえ", category="zu", star=1,
    intro="下のあ〜おの四角形の名まえを答えなさい。",
    steps=[
        dict(question="あ（平行のしるし付きの平行四辺形）は何ですか。", answer="平行四辺形",
             choices=["平行四辺形", "台形", "ひし形", "長方形"], meaning="向かい合う2組の辺が平行。"),
        dict(question="い（4辺同じ・4角直角）は何ですか。", answer="正方形",
             choices=["正方形", "長方形", "ひし形", "平行四辺形"], meaning="4辺同じ長さで4角とも直角。"),
        dict(question="う（4辺同じでかたむいた形）は何ですか。", answer="ひし形",
             choices=["ひし形", "正方形", "平行四辺形", "台形"], meaning="4辺が同じ長さ。"),
        dict(question="え（直角2つの台形）は何ですか。", answer="台形",
             choices=["台形", "平行四辺形", "ひし形", "長方形"], meaning="向かい合う1組の辺だけ平行。"),
        dict(question="お（4角直角の長方形）は何ですか。", answer="長方形",
             choices=["長方形", "正方形", "平行四辺形", "台形"], meaning="4角がすべて直角。"),
    ]))
R(19).append(dict(
    src="HG-4199", title="性質から四角形をえらぶ", category="zu", star=2,
    intro="7つの四角形あ〜き（あ＝細長い平行四辺形／い＝正方形／う＝ひし形／え＝長方形／お＝台形／"
          "か＝平行四辺形／き＝細長い台形）から性質にあう記号を答えなさい。",
    steps=[
        dict(question="① 平行四辺形はどれですか（すべて選んだ組み合わせ）。", answer="あ・か",
             choices=["あ・か", "あ・い", "う・か", "あ・う・か"], meaning="向かい合う2組の辺が平行。"),
        dict(question="② 台形はどれですか。", answer="お・き",
             choices=["お・き", "え・お", "お", "き"], meaning="向かい合う1組の辺だけ平行。"),
        dict(question="③ ひし形はどれですか。", answer="う",
             choices=["う", "い", "あ", "か"], meaning="4辺の長さがすべて等しい。"),
        dict(question="④ 向かい合う辺が2組とも平行なのはどれですか（すべて）。",
             answer="あ・い・う・え・か",
             choices=["あ・い・う・え・か", "あ・い・う・え", "い・う・え・か", "あ・う・え・か"],
             meaning="平行四辺形・長方形・ひし形・正方形はすべて2組とも平行。"),
        dict(question="⑤ 辺の長さがすべて等しいのはどれですか。", answer="い・う",
             choices=["い・う", "い・え", "う・か", "い・う・え"], meaning="正方形とひし形。"),
    ]))
R(19).append(dict(
    src="HG-4200", title="平行四辺形の辺と角", category="zu", star=2,
    intro="平行四辺形アイウエ（ア＝左上・エ＝右上・イ＝左下・ウ＝右下）。あの角度が120度のときを考えます。",
    steps=[
        dict(question="いの角度は何度ですか。", answer="60", meaning="となり合う角の和は180°。180−120＝60。"),
        dict(question="うの角度は何度ですか。", answer="120", meaning="向かい合う角は等しい。"),
        dict(question="えの角度は何度ですか。", answer="60", meaning="となり合う角の和は180°。"),
    ]))
R(19).append(dict(
    src="HG-4202", title="長方形の中の四角形", category="zu", star=2,
    intro="長方形アイウエに、カイ・エキの直線をひきました。カイとイキの長さは等しく、"
          "カイとエキは平行です。",
    steps=[
        dict(question="① 四角形アイキエは、何という図形ですか。", answer="台形",
             choices=["台形", "平行四辺形", "ひし形", "長方形"], meaning="向かい合う1組の辺だけ平行。"),
        dict(question="② 四角形カイキエは、何という図形ですか。", answer="ひし形",
             choices=["ひし形", "平行四辺形", "台形", "正方形"],
             meaning="カイ＝イキ＝エキ＝カエ（すべて等しい）なのでひし形。"),
    ]))
R(19).append(dict(
    src="HG-4203", title="4つおりにして切る", category="zu", star=2,
    intro="紙を4つにおってAB、ACの直線で切ってひろげます（AB＝Aから2cm＋2cmの点Bへ切る／AC＝4cmの点へ）。",
    steps=[
        dict(question="ABの直線で切って広げると、何という四角形ができますか。", answer="ひし形",
             choices=["ひし形", "正方形", "平行四辺形", "台形"],
             meaning="折り目が対角線になり、切った2辺の長さがちがうのでひし形。"),
        dict(question="ACの直線で切って広げると、何という四角形ができますか。", answer="正方形",
             choices=["正方形", "ひし形", "長方形", "平行四辺形"],
             meaning="折り目が対角線になり、切った2辺の長さが等しいので正方形。"),
    ]))
R(19).append(dict(
    src="HG-4205", title="四角形の性質の表を完成させる", category="zu", star=2,
    intro="四角形の性質をまとめた表です。長方形の列のように、あてはまるところを考えなさい。",
    steps=[
        dict(question="向かい合った辺が1組だけ平行なのは、どの四角形ですか。", answer="台形",
             choices=["台形", "平行四辺形", "ひし形", "長方形"], meaning="台形の定義。"),
        dict(question="4つの辺が等しいのは、どの四角形ですか（すべて）。", answer="ひし形・正方形",
             choices=["ひし形・正方形", "長方形・正方形", "ひし形・長方形", "平行四辺形・ひし形"],
             meaning="4辺が等しいのはひし形と正方形。"),
        dict(question="対角線が垂直に交わるのは、どの四角形ですか（すべて）。", answer="ひし形・正方形",
             choices=["ひし形・正方形", "長方形・正方形", "平行四辺形・ひし形", "台形・ひし形"],
             meaning="対角線が垂直に交わるのはひし形と正方形。"),
    ]))
R(19).append(dict(
    src="HG-4207", title="図の中の四角形を数える", category="zu", star=2,
    intro="横長の長方形をたて線1本・よこ線1本で4つに分け、左上のますに対角線が1本入っています。",
    steps=[
        dict(question="① 長方形は何こありますか。", answer="9",
             meaning="小さい4こ＋2こ分4こ＋全体1こ＝9こ。"),
        dict(question="② 台形は何こありますか。", answer="4",
             meaning="対角線でできる台形が4こ。"),
    ]))
R(19).append(dict(
    src="HG-4208", title="へこんだ図形・五角形の角", category="zu", star=3,
    intro="へこんだ形（矢じり型）は「1まわり360°から3つの角を引く」、五角形は"
          "対角線1本で三角形＋四角形に分けると540°が出ます。",
    steps=[
        dict(question="① 矢じり型（80°・30°・25°とへこんだ角①）の①は何度ですか。",
             answer="225", meaning="360−(30+80+25)＝225。"),
        dict(question="② 直角と40°・35°がある折れた図形の②は何度ですか。", answer="165",
             meaning="40+○+△+35で○+△＝90なので165。"),
        dict(question="③ 五角形（130°・105°・105°・95°と③）の③は何度ですか。", answer="105",
             meaning="540−(105+130+105+95)＝105。"),
    ]))
R(19).append(dict(
    src="HG-4210", title="凹凸のある図形のまわりの長さ", category="zu", star=2,
    intro="へこんだ辺を平行移動すると長方形になるので、(たて＋よこ)×2 で求まります。",
    steps=[
        dict(question="① たて6m・よこ9m・切りこみ5mと2mの図形のまわりの長さは何mですか。",
             answer="34", meaning="6+2＝8、(9+8)×2＝34。"),
        dict(question="② たて36cm・よこ58cm・切りこみ10/13/17/18cmの図形のまわりの長さは何cmですか。",
             answer="188", meaning="(36+58)×2＝188。"),
    ]))
R(19).append(dict(
    src="HG-4211", title="コの字型・穴あきのまわりの長さ", category="zu", star=3,
    intro="コの字型は外まわりだけでは足りません。内がわの2本を引き算で出して足します。"
          "穴のある図形は外まわり＋穴のまわりです。",
    steps=[
        dict(question="① コの字型（外40m×30m、下32m、うでの太さ8m）のまわりの長さは何mですか。",
             answer="188", meaning="アの長さ32−8＝24、イの長さ40−8＝32、40+30+32+30+24+32＝188。"),
        dict(question="② 穴あきのL字型（外16m・6m・7m・8m、穴4m×7m）のまわりの長さは何mですか。",
             answer="82", meaning="6+8＝14、(16+14)×2＝60、穴(4+7)×2＝22、60+22＝82。"),
    ]))

# ═══════════════════════════ No.20 平面図形(3) 円と球 ═══════════════════
R(20).append(dict(
    src="HG-4212", title="円の各部の名まえ", category="zu", star=1,
    intro="下の円の(ア)、(イ)、(ウ)の名まえを書きなさい。(ア)＝中心の点、(イ)＝中心から円周へひいた線、"
          "(ウ)＝中心を通って円周から円周への線です。",
    steps=[
        dict(question="(ア)の名まえは？", answer="中心", choices=["中心", "半径", "直径", "円周"],
             meaning="円の真ん中の点。"),
        dict(question="(イ)の名まえは？", answer="半径", choices=["半径", "直径", "中心", "円周"],
             meaning="中心から円周への線。"),
        dict(question="(ウ)の名まえは？", answer="直径", choices=["直径", "半径", "中心", "円周"],
             meaning="円周から中心を通って円周までの線。"),
    ]))
R(20).append(dict(
    src="HG-4215", title="大小の円が接する図", category="zu", star=2,
    intro="大きい円の中に同じ大きさの小さい円が2つならんで入っています。小さい円の半径は4cmです。"
          "円周率は3で計算します。",
    steps=[
        dict(question="① 小さい円の直径は何cmですか。", answer="8", meaning="4×2＝8。"),
        dict(question="② 大きい円の直径は何cmですか。", answer="16",
             meaning="小さい円の直径が大きい円の半径なので8×2＝16。"),
        dict(question="③ 小さい円のまわりの長さは何cmですか。", answer="24", meaning="8×3＝24。"),
        dict(question="④ 大きい円のまわりの長さは何cmですか。", answer="48", meaning="16×3＝48。"),
    ]))
R(20).append(dict(
    src="HG-4216", title="円・半円・4分の1円のまわりの長さ", category="zu", star=2,
    intro="円周率は3で計算します。半円のまわりは「円周の半分＋直径」、4分の1円は"
          "「円周の4分の1＋半径2本」です。",
    steps=[
        dict(question="① 直径5cmの円のまわりの長さは何cmですか。", answer="15", meaning="5×3＝15。"),
        dict(question="② 半径2cmの円のまわりの長さは何cmですか。", answer="12",
             meaning="2×2＝4、4×3＝12。"),
        dict(question="③ 直径6cmの半円のまわりの長さは何cmですか。", answer="15",
             meaning="6×3＝18、18÷2＝9、9+6＝15。"),
        dict(question="④ 半径2cmの4分の1円のまわりの長さは何cmですか。", answer="7",
             meaning="2×2＝4、4×3＝12、12÷4＝3、3+2×2＝7。"),
    ]))
R(20).append(dict(
    src="HG-4220", title="曲線と直線がまざった図形のまわり", category="zu", star=3,
    intro="半円2つで円1つ分、おうぎ形は360°を何等分した1つ分かを見ます。円周率は3です。",
    steps=[
        dict(question="① トラック形（直線50m×2・はばの直径30m）のまわりの長さは何mですか。",
             answer="190", meaning="50×2＝100、30×3＝90、合わせて190。"),
        dict(question="② 1辺10cmの正方形と4分の1円で囲まれた斜線部分のまわりの長さは何cmですか。",
             answer="35", meaning="10×2＝20、20×3÷4＝15、15+10×2＝35。"),
        dict(question="③ 半径30cm・60°のおうぎ形のまわりの長さは何cmですか。", answer="90",
             meaning="30×2＝60、60×3÷6＝30、30+30×2＝90。"),
        dict(question="④ 直径6cmの円と直径4cmの円が重なった図のまわりの長さは何cmですか。",
             answer="30", meaning="6+4＝10、10×3÷2＝15、6×3÷2＝9、4×3÷2＝6、15+9+6＝30。"),
    ]))
R(20).append(dict(
    src="HG-4221", title="曲線を組みかえてまわりの長さを出す", category="zu", star=3,
    intro="①は4つの弧を集めると直径20cmの円1つ分、②は2つの弧で半径20cmの半円1つ分になります。"
          "円周率は3です。",
    steps=[
        dict(question="① 1辺20cmの正方形の4すみを中心にした星形のまわりの長さは何cmですか。",
             answer="60", meaning="4つ分で直径20cmの円→20×3＝60。"),
        dict(question="② 1辺20cmの正方形の中の葉っぱ形のまわりの長さは何cmですか。", answer="60",
             meaning="2つ分で半径20cmの半円→40×3÷2＝60。"),
        dict(question="③ 半径3cmと半径4cmの60°のおうぎ形が向かい合った形のまわりの長さは何cmですか。",
             answer="21",
             meaning="3×2＝6、6×3÷6＝3。4×2＝8、8×3÷6＝4。直線3×2+4×2＝14。3+4+14＝21。"),
        dict(question="④ 半径8cmと半径16cmの45°のおうぎ形にはさまれた帯のまわりの長さは何cmですか。",
             answer="34",
             meaning="8×2＝16、16×3÷8＝6。(8+8)×2＝32、32×3÷8＝12。6+12+8×2＝34。"),
    ]))
# ═══════════════════════════ No.21 立体図形(1) ═══════════════════════════
R(21).append(dict(
    src="HG-4222", title="立体の名まえ", category="rittai", star=1,
    intro="つぎの立体の名まえを書きなさい。①（辺の長さはすべて同じ）②横長の箱　③たて長の箱",
    steps=[
        dict(question="①（辺の長さがすべて同じ立体）の名まえは？", answer="立方体",
             choices=["立方体", "直方体", "円柱", "角柱"], meaning="辺の長さがすべて同じ＝立方体。"),
        dict(question="②（横長の箱）の名まえは？", answer="直方体",
             choices=["直方体", "立方体", "円柱", "角柱"], meaning="長方形の面でできた箱＝直方体。"),
        dict(question="③（たて長の箱）の名まえは？", answer="直方体",
             choices=["直方体", "立方体", "円柱", "角柱"], meaning="長方形の面でできた箱＝直方体。"),
    ]))
R(21).append(dict(
    src="HG-4225", title="辺の長さをうめる（立方体・直方体）", category="rittai", star=1,
    intro="立方体は12辺すべて同じ長さ、直方体は向かい合う辺が同じ長さです。",
    steps=[
        dict(question="① 1辺7cmの立方体の㋐の長さは何cmですか。", answer="7", meaning="立方体は全部の辺が同じ。"),
        dict(question="② 底面5cm×5cm、高さ8cmの直方体の㋑（高さ）の長さは何cmですか。",
             answer="8", meaning="高さの辺はすべて8cm。"),
        dict(question="② 同じ直方体の㋒の長さは何cmですか。", answer="5",
             meaning="底面の辺は5cm。"),
    ]))
R(21).append(dict(
    src="HG-4226", title="つみ木の数", category="rittai", star=2,
    intro="同じ大きさの立方体のつみ木がつみ重ねてあります。段ごとに分けて数えます。",
    steps=[
        dict(question="①（下段が広く上段がせまい2段の形）のつみ木は何こですか。", answer="31",
             meaning="8×2＝16、5×3＝15、16+15＝31。"),
        dict(question="②（階段状の形）のつみ木は何こですか。", answer="18", meaning="6×3＝18。"),
    ]))
R(21).append(dict(
    src="HG-4227", title="2つの面の関係（平行・垂直）", category="rittai", star=1,
    intro="ふたのない箱の絵です。面㋐と面㋑はどんな関係にありますか。",
    steps=[
        dict(question="①（向かい合う2面）はどんな関係ですか。", answer="平行",
             choices=["平行", "垂直", "同じ面", "重なる"], meaning="向かい合う面は平行。"),
        dict(question="②（となり合う2面）はどんな関係ですか。", answer="垂直",
             choices=["垂直", "平行", "同じ面", "重なる"], meaning="となり合う面は垂直。"),
    ]))
R(21).append(dict(
    src="HG-4228", title="直方体の辺と面の平行・垂直", category="rittai", star=2,
    intro="直方体アイウエオカキク（上の面がアオクエ、下の面がイウキカ）。たて6cm、横15cm、高さ10cm。",
    steps=[
        dict(question="① 辺アイの長さは何cmですか。", answer="6", meaning="たての辺は6cm。"),
        dict(question="② 面ウキクエと同じ大きさの面はほかにいくつありますか。", answer="1",
             meaning="向かい合う1つの面が同じ大きさ。"),
        dict(question="⑤ 面アイウエに平行な面はどれですか。", answer="面オカキク",
             choices=["面オカキク", "面アエクオ", "面イウキカ", "面エウキク"],
             meaning="向かい合う面が平行。"),
    ]))
R(21).append(dict(
    src="HG-4230", title="立方体の辺・面の関係", category="rittai", star=2,
    intro="立方体アイウエオカキク。面㋐＝アオカイをふくむ手前の面に色がついています。",
    steps=[
        dict(question="① 辺アオに垂直な辺は何本ありますか。", answer="4", meaning="1つの辺に垂直な辺は4本。"),
        dict(question="② 面㋐に平行な面はどれですか。", answer="面エクキウ",
             choices=["面エクキウ", "面アイウエ", "面オカキク", "面アオクエ"],
             meaning="向かい合う面が平行。"),
        dict(question="③ 1つの頂点に集まる3つの辺は、おたがいにどんな関係ですか。", answer="垂直",
             choices=["垂直", "平行", "同じ向き", "ねじれの位置"], meaning="立方体の1頂点に集まる3辺は垂直。"),
        dict(question="④ 面㋐に垂直な辺は何本ありますか。", answer="4", meaning="1つの面に垂直な辺は4本。"),
    ]))
R(21).append(dict(
    src="HG-4235", title="3つのさいころの見えない面の和", category="rittai", star=3,
    intro="箱のすみにさいころを3つならべました。さいころは向かい合う面の目の和が7です。"
          "見えている目は上が2・4・6、手前が1・5・3、右はしが2です。",
    steps=[dict(question="箱やほかのさいころとくっついて見えなくなっている面の目の和はいくつですか。",
                answer="40",
                meaning="1〜6の和21、3こ分63。見えている面の和2+4+6+1+5+3+2＝23。63−23＝40。")]))

# ═══════════════════════════ No.22 立体図形(2) 展開図 ═══════════════════
R(22).append(dict(
    src="HG-4238", title="直方体になる展開図をえらぶ", category="rittai", star=2,
    intro="つぎの展開図を組み立てたとき、直方体になるのはどれですか（①〜④）。",
    steps=[dict(question="直方体になるのはどれですか（すべて選んだ組み合わせ）。", answer="②、④",
                choices=["②、④", "①、③", "①、④", "②、③"],
                meaning="面が6つで重ならずに組み立てられるのは②と④。")]))
R(22).append(dict(
    src="HG-4239", title="立方体になる展開図をえらぶ", category="rittai", star=2,
    intro="つぎの展開図を組み立てたとき、立方体ができるのはどれですか（①〜⑥）。",
    steps=[dict(question="立方体ができるのはどれですか（すべて選んだ組み合わせ）。", answer="①、③、⑥",
                choices=["①、③、⑥", "②、④、⑤", "①、②、③", "④、⑤、⑥"],
                meaning="重なる面が出ないのは①③⑥。")]))
R(22).append(dict(
    src="HG-4240", title="直方体の展開図の辺の長さ", category="rittai", star=2,
    intro="〔図ア〕は〔図イ〕の直方体（たて5cm・よこ6cm・高さ3cm）の展開図です。展開図の頂点はア〜セ。",
    steps=[
        dict(question="① アイの長さは何cmですか。", answer="6", meaning="よこの辺は6cm。"),
        dict(question="② シサの長さは何cmですか。", answer="5", meaning="たての辺は5cm。"),
        dict(question="③ アケの長さは何cmですか。", answer="16", meaning="5+3+5+3＝16。"),
        dict(question="④ シオの長さは何cmですか。", answer="12", meaning="3+6+3＝12。"),
    ]))
R(22).append(dict(
    src="HG-4241", title="展開図の面の平行・垂直", category="rittai", star=2,
    intro="直方体の展開図。面あ（上）・い（中）・う（下）がたてに、え・お・かが横にならんでいます。",
    steps=[
        dict(question="① 面かと平行になる面はどれですか。", answer="面え",
             choices=["面え", "面あ", "面い", "面う"], meaning="1つおきの面が平行。"),
        dict(question="② 面うと垂直になる面を全部書きなさい。", answer="面い、面え、面お、面か",
             choices=["面い、面え、面お、面か", "面あ、面え、面お、面か", "面い、面え、面お",
                       "面え、面お、面か"],
             meaning="面うと平行なのは面あだけ、残りはすべて垂直。"),
    ]))
R(22).append(dict(
    src="HG-4242", title="立方体の展開図・重なる辺と点", category="rittai", star=3,
    intro="立方体の展開図（面㋐㋑㋒がたて1列、面㋓㋔㋕が横）。頂点はア〜セ。",
    steps=[
        dict(question="① 面㋐と平行になる面はどれですか。", answer="面㋒",
             choices=["面㋒", "面㋑", "面㋓", "面㋕"], meaning="1つおきの面が平行。"),
        dict(question="① 面㋓と平行になる面はどれですか。", answer="面㋕",
             choices=["面㋕", "面㋔", "面㋐", "面㋒"], meaning="1つおきの面が平行。"),
        dict(question="② 面㋔と垂直になる面をすべて書きなさい。", answer="面㋐、面㋒、面㋓、面㋕",
             choices=["面㋐、面㋒、面㋓、面㋕", "面㋐、面㋑、面㋒", "面㋓、面㋕", "面㋐、面㋒"],
             meaning="面㋔と平行なのは向かいの面だけ、残りは垂直。"),
        dict(question="③ 辺オカと重なる辺はどれですか。", answer="辺キカ",
             choices=["辺キカ", "辺ケコ", "辺ウイ", "辺セサ"], meaning="展開図をたどって重なる辺を探す。"),
        dict(question="③ 辺ケコと重なる辺はどれですか。", answer="辺ウイ",
             choices=["辺ウイ", "辺キカ", "辺セサ", "辺オカ"], meaning="展開図をたどって重なる辺を探す。"),
        dict(question="④ 点セと重なる点はどれですか。", answer="点シ",
             choices=["点シ", "点ク", "点コ", "点ウ"], meaning="展開図をたどって重なる点を探す。"),
        dict(question="④ 点エと重なる点はどれですか。", answer="点ク",
             choices=["点ク", "点シ", "点コ", "点ウ"], meaning="展開図をたどって重なる点を探す。"),
    ]))
R(22).append(dict(
    src="HG-4243", title="さいころの展開図で4の目の位置", category="rittai", star=2,
    intro="さいころを切りひらいた展開図です。さいころは向かい合った面の目の和が7になります。",
    steps=[
        dict(question="① 4の目は、あ、い、うのどの面になりますか。", answer="面う",
             choices=["面う", "面あ", "面い", "決まらない"], meaning="3と向かい合う面は4。展開図をたどって特定する。"),
        dict(question="② 4の目は、あ、い、うのどの面になりますか。", answer="面う",
             choices=["面う", "面あ", "面い", "決まらない"], meaning="3と向かい合う面は4。展開図をたどって特定する。"),
    ]))
R(22).append(dict(
    src="HG-4245", title="直方体の展開図・重なる辺と平行な面", category="rittai", star=3,
    intro="直方体の展開図。面あ・い・う・えが横1列、面おが上、面かが下。頂点はア〜シ。",
    steps=[
        dict(question="① 辺アイは、どの辺と重なりますか。", answer="辺オエ",
             choices=["辺オエ", "辺アセ", "辺カケ", "辺ウコ"], meaning="展開図をたどって重なる辺を探す。"),
        dict(question="② 辺キクは、どの辺と重なりますか。", answer="辺アセ",
             choices=["辺アセ", "辺オエ", "辺イサ", "辺ウコ"], meaning="展開図をたどって重なる辺を探す。"),
        dict(question="③ 辺キクに平行な辺を、重なる辺をのぞいてすべて書きなさい。",
             answer="辺カケ、辺ウコ、辺イサ",
             choices=["辺カケ、辺ウコ、辺イサ", "辺カケ、辺ウコ", "辺オエ、辺アセ", "辺カケ、辺イサ"],
             meaning="展開図で同じ向きの辺を探す。"),
        dict(question="④ 面おに平行な面はどれですか。", answer="面か",
             choices=["面か", "面あ", "面い", "面う"], meaning="上下の面が平行。"),
        dict(question="⑤ 面えに垂直な面を4つ書きなさい。", answer="面あ、面う、面お、面か",
             choices=["面あ、面う、面お、面か", "面あ、面い、面う", "面い、面お、面か", "面あ、面う、面お"],
             meaning="面えと平行なのは面いだけ、残りは垂直。"),
    ]))
R(22).append(dict(
    src="HG-4246", title="立方体の展開図・重なる点と垂直な面", category="rittai", star=3,
    intro="立方体の展開図です。頂点はア〜サ。",
    steps=[
        dict(question="① 点ウと重なる点はどれですか。", answer="点オ",
             choices=["点オ", "点ア", "点セ", "点コ"], meaning="展開図をたどって重なる点を探す。"),
        dict(question="② 辺ケクと重なる辺は、どの辺ですか。", answer="辺ケコ",
             choices=["辺ケコ", "辺エケ", "辺オク", "辺カキ"], meaning="展開図をたどって重なる辺を探す。"),
        dict(question="③ 面エオクケと平行な面は、どの面ですか。", answer="面スイアセ",
             choices=["面スイアセ", "面アイスセ", "面スエケシ", "面オカキク"],
             meaning="展開図で向かい合う面が平行。"),
        dict(question="④ 面シケコサと垂直な面を4つ書きなさい。",
             answer="面アイスセ、面スエケシ、面エオクケ、面オカキク",
             choices=["面アイスセ、面スエケシ、面エオクケ、面オカキク",
                      "面アイスセ、面スエケシ、面エオクケ",
                      "面スイアセ、面アイスセ、面スエケシ",
                      "面アイスセ、面エオクケ、面オカキク"],
             meaning="面シケコサと平行なのは1面だけ、残りは垂直。"),
    ]))
R(22).append(dict(
    src="HG-4250", title="何まいの紙で直方体・立方体ができるか", category="rittai", star=3,
    intro="あ＝6cm×10cm、い＝10cm×8cm、う＝6cm×6cm、え＝8cm×6cm の紙がたくさんあります。"
          "どの紙が何まいあれば、直方体や立方体ができますか。",
    steps=[
        dict(question="立方体を作るには、あ・い・う・えの紙をそれぞれ何まい使いますか（あ,い,う,えの順）。",
             answer="0,0,6,0",
             choices=["0,0,6,0", "6,0,0,0", "0,0,0,6", "2,2,2,0"],
             meaning="6cm×6cmの う を6まい使うと立方体になる。"),
        dict(question="6×6×10の直方体を作るには、あ・い・う・えをそれぞれ何まい使いますか。",
             answer="4,0,2,0",
             choices=["4,0,2,0", "2,0,4,0", "0,4,2,0", "4,0,0,2"],
             meaning="あ（6×10）4まい＋う（6×6）2まい。"),
        dict(question="6×6×8の直方体を作るには、あ・い・う・えをそれぞれ何まい使いますか。",
             answer="0,0,2,4",
             choices=["0,0,2,4", "0,0,4,2", "2,0,0,4", "0,2,2,4"],
             meaning="え（8×6）4まい＋う（6×6）2まい。"),
        dict(question="6×8×10の直方体を作るには、あ・い・う・えをそれぞれ何まい使いますか。",
             answer="2,2,0,2",
             choices=["2,2,0,2", "2,2,2,0", "0,2,2,2", "2,0,2,2"],
             meaning="あ（6×10）2まい・い（10×8）2まい・え（8×6）2まい。"),
    ]))

EOF_MARK = True


def find_arr(d, no):
    return d["grades"]["3"]["master_bunsatsu"]["fukushu"].setdefault(str(no), [])


def next_id(existing_ids, no):
    used = set()
    for i in existing_ids:
        m = re.match(r"hd3mb_%02d_(\d+)" % int(no), i)
        if m:
            used.add(int(m.group(1)))
    k = 1
    while k in used:
        k += 1
    used.add(k)
    return "hd3mb_%02d_%d" % (int(no), k)


def build_record(no, spec):
    steps = []
    for st in spec["steps"]:
        s = {"question": st["question"], "answer": st["answer"]}
        if "choices" in st:
            s["choices"] = st["choices"]
        s["meaning"] = st["meaning"]
        steps.append(s)
    return {
        "src": spec["src"],
        "title": spec["title"],
        "category": spec["category"],
        "unit": spec.get("unit", ""),
        "grade": 3,
        "star": spec["star"],
        "intro": spec["intro"],
        "svg": svg_of(spec["src"]),
        "steps": steps,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    total_new = 0
    for no, specs in sorted(ROUNDS.items(), key=lambda kv: int(kv[0])):
        arr = find_arr(d, no)
        have_src = {x.get("src") for x in arr}
        existing_ids = [x["id"] for x in arr]
        # 既存＋新規をHG番号順にならべ直すための一時リスト
        combined = list(arr)
        for spec in specs:
            if spec["src"] in have_src:
                continue
            rec = build_record(no, spec)
            rec["id"] = next_id(existing_ids, no)
            existing_ids.append(rec["id"])
            combined.append(rec)
            have_src.add(spec["src"])
            total_new += 1
        combined.sort(key=lambda x: int(re.search(r"HG-(\d+)", x["src"]).group(1)))
        d["grades"]["3"]["master_bunsatsu"]["fukushu"][str(no)] = combined
        print("No.%s: %d本 → %d本" % (no, len(arr), len(combined)))

    print("新規追加:", total_new, "本")
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(DAIMON, "w", encoding="utf-8", newline="\r\n").write(
        json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print("✅ 書き込み完了")


if __name__ == "__main__":
    main()
