# -*- coding: utf-8 -*-
"""塾講師監査(audit_1.txt / 小3マスター算数 第1分冊 fukushu No.7〜14・59本)で見つかった
不具合の修正パッチ。

対象: hd3mb_10_1 (HG-4113) 小3マスター算数第1分冊 No.10 やさしい1
      「図の色部分を分数で表す」

見つかった問題（findings_1.md の重大1件に対応）:
  1. intro が「長方形を等分してぬった部分」と言い切っているが、原本
     (3年マスター算数_第1分冊.pdf 内部p43／印刷ページ-99-／PDFページindex42)
     の①〜⑧は円・長方形・六角形・三角形・棒の混在で、長方形はそもそも無い。
  2. svg には①②③⑤に対応する4個の円しか描かれておらず、④⑥⑦⑧の図が
     まるごと存在しない（小問4,6,7,8は「図を見て答える」設問なのに見る図が無い）。
  3. 描かれている4個の円にも、shaded領域の下に "1/2" "1/3" "5/6" "3/4" という
     **その設問自身の答えそのもの**がテキストとして書かれている（図が答えを
     見せてしまっている）。
  → 8個すべてを原本どおりの形（circle/rect-thirds/hexagon6/2circle/square2x2/
     triangle-medial/hexagon12/3bars）で座標から再構成し、答えの文字列は一切
     書かずに面積比だけで表す。各図形の shaded 面積比はシューレース公式・
     扇形/象限の角度から解析的に検算済み（丸め誤差ではなく厳密に一致）：
       ①semicircle=0.5 ②rect 22/66=1/3 ③hex 5/6(6等分三角形のうち5枚)
       ④circle(全部)+circle(4象限中3)=1+0.75=1.75 ⑤square2x2の3/4枚=0.75
       ⑥中央の中点三角形(全体の1/4) ⑦hexagon 12等分(頂点+辺中点)のうち5枚=5/12
       ⑧棒2本(=2)+3本目の1/3=2+1/3
     （検算方法は scripts/_fix_g3mb_w2_1.py 末尾の self_check() を参照。
      本体には影響しない検算専用関数）

使い方:
    python scripts/_fix_g3mb_w2_1.py [対象JSONのパス]
    省略時は data/hama_daimon.json（プロジェクト直下からの相対パス）。

設計:
  - 大問は genbo_common.iter_daimon だけで引く（自前で入れ子を歩かない）。
  - 置換は「欄まるごとの一致」で冪等判定する（_fix_g3mb_w1_2.py と同じ方式）。
  - 書き出しは io.open(path, "wb")。
"""
import io
import json
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import genbo_common  # noqa: E402

BASE = genbo_common.BASE


def find_one(data, target_id, expect_src):
    hits = [r for r in genbo_common.iter_daimon(data, grade="3", app_courses=["master_bunsatsu"])
            if r["x"].get("id") == target_id]
    if len(hits) != 1:
        raise AssertionError("find_one: id=%s が %d 件見つかった（1件のはず）" % (target_id, len(hits)))
    x = hits[0]["x"]
    if x.get("src") != expect_src:
        raise AssertionError(
            "find_one: id=%s の src が %r ではなく %r だった（原簿番号がずれている？）"
            % (target_id, expect_src, x.get("src"))
        )
    return x


def apply_field(x, field, old_full, new_full, label, log):
    """x[field] を「欄まるごとの一致」で冪等に書き換える。"""
    cur = x.get(field, "")
    if cur == old_full:
        x[field] = new_full
        log.append("APPLIED  " + label)
    elif cur == new_full:
        log.append("SKIP(already applied) " + label)
    else:
        raise AssertionError(
            "apply_field: %s の現在の内容が想定（旧・新のどちらの欄まるごと一致）とも違う。"
            " 手で確認すること。" % label
        )


def apply_step_meaning(x, step_index, question_check, old_full, new_full, label, log):
    """x["steps"][step_index]["meaning"] を、質問文の一致を確認したうえで
    「欄まるごとの一致」で冪等に書き換える。"""
    steps = x.get("steps", [])
    if not (0 <= step_index < len(steps)):
        raise AssertionError("apply_step_meaning: %s に steps[%d] が無い" % (label, step_index))
    step = steps[step_index]
    if step.get("question") != question_check:
        raise AssertionError(
            "apply_step_meaning: %s の steps[%d].question が想定と違う（並びがずれた？）: %r"
            % (label, step_index, step.get("question"))
        )
    apply_field(step, "meaning", old_full, new_full, label + " steps[%d].meaning" % step_index, log)


OLD_INTRO = 'つぎの①〜⑧の図（長方形を等分してぬった部分）は、それぞれ全体のどれだけにあたるかを表しています。'
NEW_INTRO = 'つぎの①〜⑧の図で、色がついた部分の大きさは、それぞれ全体（１）のどれだけにあたるかを表しています。'
OLD_SVG = '<svg viewBox="0 0 300 95" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><circle cx="35" cy="40" r="28" fill="none" stroke="#4f9eff" stroke-width="1.3"/><path d="M35 40 L35 12 A28 28 0 0 1 35 68 Z" fill="#ffd166" fill-opacity="0.6"/><text x="35" y="82" font-size="11" text-anchor="middle" fill="#c9d4f0">1/2</text><circle cx="105" cy="40" r="28" fill="none" stroke="#4f9eff" stroke-width="1.3"/><path d="M105 40 L105 12 A28 28 0 0 1 129.249 54 Z" fill="#ffd166" fill-opacity="0.6"/><text x="105" y="82" font-size="11" text-anchor="middle" fill="#c9d4f0">1/3</text><circle cx="175" cy="40" r="28" fill="none" stroke="#4f9eff" stroke-width="1.3"/><path d="M175 40 L175 12 A28 28 0 1 1 150.751 26 Z" fill="#ffd166" fill-opacity="0.6"/><text x="175" y="82" font-size="11" text-anchor="middle" fill="#c9d4f0">5/6</text><circle cx="245" cy="40" r="28" fill="none" stroke="#4f9eff" stroke-width="1.3"/><path d="M245 40 L245 12 A28 28 0 1 1 217 40 Z" fill="#ffd166" fill-opacity="0.6"/><text x="245" y="82" font-size="11" text-anchor="middle" fill="#c9d4f0">3/4</text></svg>'
NEW_SVG = '<svg viewBox="0 0 360 232" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;max-width:100%"><circle cx="45" cy="55" r="26" fill="none" stroke="#4f9eff" stroke-width="1.3"/><path d="M45,29 A26,26 0 0,0 45,81 Z" fill="#ffd166" fill-opacity="0.6"/><text x="45" y="14" font-size="10" text-anchor="middle" fill="#c9d4f0">①</text><text x="45" y="95" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><rect x="102" y="34" width="66" height="42" fill="none" stroke="#4f9eff" stroke-width="1.3"/><rect x="102" y="34" width="22" height="42" fill="#ffd166" fill-opacity="0.6"/><line x1="124" y1="34" x2="124" y2="76" stroke="#4f9eff" stroke-width="1.3"/><line x1="146" y1="34" x2="146" y2="76" stroke="#4f9eff" stroke-width="1" stroke-dasharray="2,2"/><text x="135" y="14" font-size="10" text-anchor="middle" fill="#c9d4f0">②</text><text x="135" y="95" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><polygon points="252,55 238.5,78.38 211.5,78.38 198,55 211.5,31.62 238.5,31.62" fill="none" stroke="#4f9eff" stroke-width="1.3"/><line x1="225" y1="55" x2="252" y2="55" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,55 238.5,78.38 211.5,78.38" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="55" x2="238.5" y2="78.38" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,55 211.5,78.38 198,55" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="55" x2="211.5" y2="78.38" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,55 198,55 211.5,31.62" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="55" x2="198" y2="55" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,55 211.5,31.62 238.5,31.62" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="55" x2="211.5" y2="31.62" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,55 238.5,31.62 252,55" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="55" x2="238.5" y2="31.62" stroke="#4f9eff" stroke-width="0.8"/><text x="225" y="14" font-size="10" text-anchor="middle" fill="#c9d4f0">③</text><text x="225" y="95" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><circle cx="296" cy="55" r="20" fill="none" stroke="#4f9eff" stroke-width="1.3"/><circle cx="296" cy="55" r="20" fill="#ffd166" fill-opacity="0.6"/><text x="296" y="88" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><circle cx="336" cy="55" r="20" fill="none" stroke="#4f9eff" stroke-width="1.3"/><path d="M336,55 L316,55 A20,20 0 0,1 336,35 Z" fill="#ffd166" fill-opacity="0.6"/><path d="M336,55 L356,55 A20,20 0 0,1 336,75 Z" fill="#ffd166" fill-opacity="0.6"/><path d="M336,55 L336,75 A20,20 0 0,1 316,55 Z" fill="#ffd166" fill-opacity="0.6"/><line x1="316" y1="55" x2="356" y2="55" stroke="#4f9eff" stroke-width="0.8"/><line x1="336" y1="35" x2="336" y2="75" stroke="#4f9eff" stroke-width="0.8"/><text x="336" y="88" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><text x="316" y="14" font-size="10" text-anchor="middle" fill="#c9d4f0">④</text><rect x="17" y="147" width="56" height="56" fill="none" stroke="#4f9eff" stroke-width="1.3"/><rect x="17" y="147" width="28" height="28" fill="#ffd166" fill-opacity="0.6"/><rect x="17" y="175" width="28" height="28" fill="#ffd166" fill-opacity="0.6"/><rect x="45" y="175" width="28" height="28" fill="#ffd166" fill-opacity="0.6"/><line x1="45" y1="147" x2="45" y2="203" stroke="#4f9eff" stroke-width="1"/><line x1="17" y1="175" x2="73" y2="175" stroke="#4f9eff" stroke-width="1"/><text x="45" y="138" font-size="10" text-anchor="middle" fill="#c9d4f0">⑤</text><text x="45" y="216" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><polygon points="135,148 103,204 167,204" fill="none" stroke="#4f9eff" stroke-width="1.3"/><line x1="119" y1="176" x2="151" y2="176" stroke="#4f9eff" stroke-width="1"/><line x1="119" y1="176" x2="135" y2="204" stroke="#4f9eff" stroke-width="1"/><line x1="151" y1="176" x2="135" y2="204" stroke="#4f9eff" stroke-width="1"/><polygon points="119,176 151,176 135,204" fill="#ffd166" fill-opacity="0.6"/><text x="135" y="138" font-size="10" text-anchor="middle" fill="#c9d4f0">⑥</text><text x="135" y="216" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><polygon points="252,175 238.5,198.38 211.5,198.38 198,175 211.5,151.62 238.5,151.62" fill="none" stroke="#4f9eff" stroke-width="1.3"/><polygon points="225,175 252,175 245.25,186.69" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="175" x2="252" y2="175" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,175 245.25,186.69 238.5,198.38" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="175" x2="245.25" y2="186.69" stroke="#4f9eff" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="225" y1="175" x2="238.5" y2="198.38" stroke="#4f9eff" stroke-width="0.8"/><line x1="225" y1="175" x2="225" y2="198.38" stroke="#4f9eff" stroke-width="0.8" stroke-dasharray="2,2"/><polygon points="225,175 211.5,198.38 204.75,186.69" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="175" x2="211.5" y2="198.38" stroke="#4f9eff" stroke-width="0.8"/><polygon points="225,175 204.75,186.69 198,175" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="175" x2="204.75" y2="186.69" stroke="#4f9eff" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="225" y1="175" x2="198" y2="175" stroke="#4f9eff" stroke-width="0.8"/><line x1="225" y1="175" x2="204.75" y2="163.31" stroke="#4f9eff" stroke-width="0.8" stroke-dasharray="2,2"/><polygon points="225,175 211.5,151.62 225,151.62" fill="#ffd166" fill-opacity="0.6"/><line x1="225" y1="175" x2="211.5" y2="151.62" stroke="#4f9eff" stroke-width="0.8"/><line x1="225" y1="175" x2="225" y2="151.62" stroke="#4f9eff" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="225" y1="175" x2="238.5" y2="151.62" stroke="#4f9eff" stroke-width="0.8"/><line x1="225" y1="175" x2="245.25" y2="163.31" stroke="#4f9eff" stroke-width="0.8" stroke-dasharray="2,2"/><text x="225" y="138" font-size="10" text-anchor="middle" fill="#c9d4f0">⑦</text><text x="225" y="216" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><rect x="300" y="147" width="13" height="56" fill="#ffd166" fill-opacity="0.6" stroke="#4f9eff" stroke-width="1.3"/><rect x="317" y="147" width="13" height="56" fill="#ffd166" fill-opacity="0.6" stroke="#4f9eff" stroke-width="1.3"/><rect x="334" y="147" width="13" height="56" fill="none" stroke="#4f9eff" stroke-width="1.3"/><rect x="334" y="147" width="13" height="18.67" fill="#ffd166" fill-opacity="0.6"/><line x1="334" y1="165.67" x2="347" y2="165.67" stroke="#4f9eff" stroke-width="1"/><line x1="334" y1="184.33" x2="347" y2="184.33" stroke="#4f9eff" stroke-width="1"/><text x="306.5" y="215" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><text x="323.5" y="215" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><text x="340.5" y="215" font-size="9" text-anchor="middle" fill="#9aa3c0">1</text><text x="323.5" y="138" font-size="10" text-anchor="middle" fill="#c9d4f0">⑧</text></svg>'


def fix_hd3mb_10_1(data, log):
    x = find_one(data, "hd3mb_10_1", "HG-4113")
    apply_field(x, "intro", OLD_INTRO, NEW_INTRO, "hd3mb_10_1.intro", log)
    apply_field(x, "svg", OLD_SVG, NEW_SVG, "hd3mb_10_1.svg", log)


def fix_hd3mb_08_3_p0_1(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 0, '9÷4の商はいくつか。', '9÷4=2あまり1。', '9÷4を計算すると、商は2。', 'hd3mb_08_3 p0(q)', log)
    apply_step_meaning(x, 1, '9÷4のあまりはいくつか。', '9÷4=2あまり1。', '9÷4の商は2（前の設問の答え）。4×2=8、9-8=1で、あまりは1。', 'hd3mb_08_3 p1(r)', log)


def fix_hd3mb_08_3_p2_3(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 2, '13÷5の商はいくつか。', '13÷5=2あまり3。', '13÷5を計算すると、商は2。', 'hd3mb_08_3 p2(q)', log)
    apply_step_meaning(x, 3, '13÷5のあまりはいくつか。', '13÷5=2あまり3。', '13÷5の商は2（前の設問の答え）。5×2=10、13-10=3で、あまりは3。', 'hd3mb_08_3 p3(r)', log)


def fix_hd3mb_08_3_p4_5(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 4, '26÷4の商はいくつか。', '26÷4=6あまり2。', '26÷4を計算すると、商は6。', 'hd3mb_08_3 p4(q)', log)
    apply_step_meaning(x, 5, '26÷4のあまりはいくつか。', '26÷4=6あまり2。', '26÷4の商は6（前の設問の答え）。4×6=24、26-24=2で、あまりは2。', 'hd3mb_08_3 p5(r)', log)


def fix_hd3mb_08_3_p6_7(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 6, '29÷7の商はいくつか。', '29÷7=4あまり1。', '29÷7を計算すると、商は4。', 'hd3mb_08_3 p6(q)', log)
    apply_step_meaning(x, 7, '29÷7のあまりはいくつか。', '29÷7=4あまり1。', '29÷7の商は4（前の設問の答え）。7×4=28、29-28=1で、あまりは1。', 'hd3mb_08_3 p7(r)', log)


def fix_hd3mb_08_3_p8_9(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 8, '35÷6の商はいくつか。', '35÷6=5あまり5。', '35÷6を計算すると、商は5。', 'hd3mb_08_3 p8(q)', log)
    apply_step_meaning(x, 9, '35÷6のあまりはいくつか。', '35÷6=5あまり5。', '35÷6の商は5（前の設問の答え）。6×5=30、35-30=5で、あまりは5。', 'hd3mb_08_3 p9(r)', log)


def fix_hd3mb_08_3_p10_11(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 10, '2÷3の商はいくつか。', '2÷3=0あまり2。', '2÷3を計算すると、商は0。', 'hd3mb_08_3 p10(q)', log)
    apply_step_meaning(x, 11, '2÷3のあまりはいくつか。', '2÷3=0あまり2。', '2÷3の商は0（前の設問の答え）。3×0=0、2-0=2で、あまりは2。', 'hd3mb_08_3 p11(r)', log)


def fix_hd3mb_08_3_p12_13(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 12, '5÷8の商はいくつか。', '5÷8=0あまり5。', '5÷8を計算すると、商は0。', 'hd3mb_08_3 p12(q)', log)
    apply_step_meaning(x, 13, '5÷8のあまりはいくつか。', '5÷8=0あまり5。', '5÷8の商は0（前の設問の答え）。8×0=0、5-0=5で、あまりは5。', 'hd3mb_08_3 p13(r)', log)


def fix_hd3mb_08_3_p14_15(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 14, '51÷7の商はいくつか。', '51÷7=7あまり2。', '51÷7を計算すると、商は7。', 'hd3mb_08_3 p14(q)', log)
    apply_step_meaning(x, 15, '51÷7のあまりはいくつか。', '51÷7=7あまり2。', '51÷7の商は7（前の設問の答え）。7×7=49、51-49=2で、あまりは2。', 'hd3mb_08_3 p15(r)', log)


def fix_hd3mb_08_3_p16_17(data, log):
    x = find_one(data, 'hd3mb_08_3', 'HG-4093')
    apply_step_meaning(x, 16, '47÷5の商はいくつか。', '47÷5=9あまり2。', '47÷5を計算すると、商は9。', 'hd3mb_08_3 p16(q)', log)
    apply_step_meaning(x, 17, '47÷5のあまりはいくつか。', '47÷5=9あまり2。', '47÷5の商は9（前の設問の答え）。5×9=45、47-45=2で、あまりは2。', 'hd3mb_08_3 p17(r)', log)


def fix_hd3mb_08_5_p4_5(data, log):
    x = find_one(data, 'hd3mb_08_5', 'HG-4095')
    apply_step_meaning(x, 4, 'たまご75こを8こずつ箱につめると何箱できるか。', '75÷8=9あまり3、商の9箱できる。', '75÷8を計算すると、商は9箱。', 'hd3mb_08_5 p4(q)', log)
    apply_step_meaning(x, 5, 'たまご75こを8こずつ箱につめると何このこるか。', '75÷8=9あまり3、あまりは3こ。', '75÷8の商は9箱（前の設問の答え）。8×9=72、75-72=3で、あまりは3こ。', 'hd3mb_08_5 p5(r)', log)


def fix_hd3mb_08_9_p3_4(data, log):
    x = find_one(data, 'hd3mb_08_9', 'HG-4099')
    apply_step_meaning(x, 3, 'シール6まいを1つの袋に入れる。236まいのシールを入れると何袋できるか。', '236÷6=39あまり2、商の39袋できる。', '236÷6を計算すると、商は39袋。', 'hd3mb_08_9 p3(q)', log)
    apply_step_meaning(x, 4, 'シール6まいを1つの袋に入れる。236まいのシールを入れると何まいあまるか。', '236÷6=39あまり2、あまりは2まい。', '236÷6の商は39袋（前の設問の答え）。6×39=234、236-234=2で、あまりは2まい。', 'hd3mb_08_9 p4(r)', log)


def fix_hd3mb_08_10_p1_2(data, log):
    x = find_one(data, 'hd3mb_08_10', 'HG-4100')
    apply_step_meaning(x, 1, '498÷5の商はいくつか。', '498÷5=99あまり3。', '498÷5を計算すると、商は99。', 'hd3mb_08_10 p1(q)', log)
    apply_step_meaning(x, 2, '498÷5のあまりはいくつか。', '498÷5=99あまり3。', '498÷5の商は99（前の設問の答え）。5×99=495、498-495=3で、あまりは3。', 'hd3mb_08_10 p2(r)', log)


def fix_hd3mb_08_10_p4_5(data, log):
    x = find_one(data, 'hd3mb_08_10', 'HG-4100')
    apply_step_meaning(x, 4, '3504÷7の商はいくつか。', '3504÷7=500あまり4。', '3504÷7を計算すると、商は500。', 'hd3mb_08_10 p4(q)', log)
    apply_step_meaning(x, 5, '3504÷7のあまりはいくつか。', '3504÷7=500あまり4。', '3504÷7の商は500（前の設問の答え）。7×500=3500、3504-3500=4で、あまりは4。', 'hd3mb_08_10 p5(r)', log)


def fix_hd3mb_08_10_p7_8(data, log):
    x = find_one(data, 'hd3mb_08_10', 'HG-4100')
    apply_step_meaning(x, 7, '6391÷9の商はいくつか。', '6391÷9=710あまり1。', '6391÷9を計算すると、商は710。', 'hd3mb_08_10 p7(q)', log)
    apply_step_meaning(x, 8, '6391÷9のあまりはいくつか。', '6391÷9=710あまり1。', '6391÷9の商は710（前の設問の答え）。9×710=6390、6391-6390=1で、あまりは1。', 'hd3mb_08_10 p8(r)', log)


def fix_hd3mb_09_2_p3_4(data, log):
    x = find_one(data, 'hd3mb_09_2', 'HG-4104')
    apply_step_meaning(x, 3, '37÷28の商はいくつか。', '37÷28=1あまり9。', '37÷28を計算すると、商は1。', 'hd3mb_09_2 p3(q)', log)
    apply_step_meaning(x, 4, '37÷28のあまりはいくつか。', '37÷28=1あまり9。', '37÷28の商は1（前の設問の答え）。28×1=28、37-28=9で、あまりは9。', 'hd3mb_09_2 p4(r)', log)


def fix_hd3mb_09_2_p5_6(data, log):
    x = find_one(data, 'hd3mb_09_2', 'HG-4104')
    apply_step_meaning(x, 5, '88÷32の商はいくつか。', '88÷32=2あまり24。', '88÷32を計算すると、商は2。', 'hd3mb_09_2 p5(q)', log)
    apply_step_meaning(x, 6, '88÷32のあまりはいくつか。', '88÷32=2あまり24。', '88÷32の商は2（前の設問の答え）。32×2=64、88-64=24で、あまりは24。', 'hd3mb_09_2 p6(r)', log)


def fix_hd3mb_09_2_p7_8(data, log):
    x = find_one(data, 'hd3mb_09_2', 'HG-4104')
    apply_step_meaning(x, 7, '79÷36の商はいくつか。', '79÷36=2あまり7。', '79÷36を計算すると、商は2。', 'hd3mb_09_2 p7(q)', log)
    apply_step_meaning(x, 8, '79÷36のあまりはいくつか。', '79÷36=2あまり7。', '79÷36の商は2（前の設問の答え）。36×2=72、79-72=7で、あまりは7。', 'hd3mb_09_2 p8(r)', log)


def fix_hd3mb_09_3_p3_4(data, log):
    x = find_one(data, 'hd3mb_09_3', 'HG-4105')
    apply_step_meaning(x, 3, '7800÷900の商はいくつか。', '7800÷900=8あまり600。', '7800÷900を計算すると、商は8。', 'hd3mb_09_3 p3(q)', log)
    apply_step_meaning(x, 4, '7800÷900のあまりはいくつか。', '7800÷900=8あまり600。', '7800÷900の商は8（前の設問の答え）。900×8=7200、7800-7200=600で、あまりは600。', 'hd3mb_09_3 p4(r)', log)


def fix_hd3mb_09_3_p6_7(data, log):
    x = find_one(data, 'hd3mb_09_3', 'HG-4105')
    apply_step_meaning(x, 6, '520÷160の商はいくつか。', '520÷160=3あまり40。', '520÷160を計算すると、商は3。', 'hd3mb_09_3 p6(q)', log)
    apply_step_meaning(x, 7, '520÷160のあまりはいくつか。', '520÷160=3あまり40。', '520÷160の商は3（前の設問の答え）。160×3=480、520-480=40で、あまりは40。', 'hd3mb_09_3 p7(r)', log)


def fix_hd3mb_09_4_p3_4(data, log):
    x = find_one(data, 'hd3mb_09_4', 'HG-4106')
    apply_step_meaning(x, 3, 'ビー玉95こを23こずつ箱に入れると何箱できるか。', '95÷23=4あまり3、商の4箱できる。', '95÷23を計算すると、商は4箱。', 'hd3mb_09_4 p3(q)', log)
    apply_step_meaning(x, 4, 'ビー玉95こを23こずつ箱に入れると何このこるか。', '95÷23=4あまり3、あまりは3こ。', '95÷23の商は4箱（前の設問の答え）。23×4=92、95-92=3で、あまりは3こ。', 'hd3mb_09_4 p4(r)', log)


def fix_hd3mb_09_4_p6_7(data, log):
    x = find_one(data, 'hd3mb_09_4', 'HG-4106')
    apply_step_meaning(x, 6, 'ボタン14こで洋服1着作る。99こあるとき何着作れるか。', '99÷14=7あまり1、商の7着作れる。', '99÷14を計算すると、商は7着。', 'hd3mb_09_4 p6(q)', log)
    apply_step_meaning(x, 7, 'ボタン14こで洋服1着作る。99こあるとき何こあまるか。', '99÷14=7あまり1、あまりは1こ。', '99÷14の商は7着（前の設問の答え）。14×7=98、99-98=1で、あまりは1こ。', 'hd3mb_09_4 p7(r)', log)


def fix_hd3mb_09_4_p8_9(data, log):
    x = find_one(data, 'hd3mb_09_4', 'HG-4106')
    apply_step_meaning(x, 8, 'あめ370こを1袋40こずつ入れると何袋できるか。', '370÷40=9あまり10、商の9袋できる。', '370÷40を計算すると、商は9袋。', 'hd3mb_09_4 p8(q)', log)
    apply_step_meaning(x, 9, 'あめ370こを1袋40こずつ入れると何こあまるか。', '370÷40=9あまり10、あまりは10こ。', '370÷40の商は9袋（前の設問の答え）。40×9=360、370-360=10で、あまりは10こ。', 'hd3mb_09_4 p9(r)', log)


def fix_hd3mb_09_5_p2_3(data, log):
    x = find_one(data, 'hd3mb_09_5', 'HG-4107')
    apply_step_meaning(x, 2, '97÷23の商はいくつか。', '97÷23=4あまり5。', '97÷23を計算すると、商は4。', 'hd3mb_09_5 p2(q)', log)
    apply_step_meaning(x, 3, '97÷23のあまりはいくつか。', '97÷23=4あまり5。', '97÷23の商は4（前の設問の答え）。23×4=92、97-92=5で、あまりは5。', 'hd3mb_09_5 p3(r)', log)


def fix_hd3mb_09_5_p4_5(data, log):
    x = find_one(data, 'hd3mb_09_5', 'HG-4107')
    apply_step_meaning(x, 4, '86÷18の商はいくつか。', '86÷18=4あまり14。', '86÷18を計算すると、商は4。', 'hd3mb_09_5 p4(q)', log)
    apply_step_meaning(x, 5, '86÷18のあまりはいくつか。', '86÷18=4あまり14。', '86÷18の商は4（前の設問の答え）。18×4=72、86-72=14で、あまりは14。', 'hd3mb_09_5 p5(r)', log)


def fix_hd3mb_09_6_p4_5(data, log):
    x = find_one(data, 'hd3mb_09_6', 'HG-4108')
    apply_step_meaning(x, 4, '618÷63の商はいくつか。', '618÷63=9あまり51。', '618÷63を計算すると、商は9。', 'hd3mb_09_6 p4(q)', log)
    apply_step_meaning(x, 5, '618÷63のあまりはいくつか。', '618÷63=9あまり51。', '618÷63の商は9（前の設問の答え）。63×9=567、618-567=51で、あまりは51。', 'hd3mb_09_6 p5(r)', log)


def fix_hd3mb_09_6_p6_7(data, log):
    x = find_one(data, 'hd3mb_09_6', 'HG-4108')
    apply_step_meaning(x, 6, '743÷98の商はいくつか。', '743÷98=7あまり57。', '743÷98を計算すると、商は7。', 'hd3mb_09_6 p6(q)', log)
    apply_step_meaning(x, 7, '743÷98のあまりはいくつか。', '743÷98=7あまり57。', '743÷98の商は7（前の設問の答え）。98×7=686、743-686=57で、あまりは57。', 'hd3mb_09_6 p7(r)', log)


def fix_hd3mb_09_6_p8_9(data, log):
    x = find_one(data, 'hd3mb_09_6', 'HG-4108')
    apply_step_meaning(x, 8, '350÷42の商はいくつか。', '350÷42=8あまり14。', '350÷42を計算すると、商は8。', 'hd3mb_09_6 p8(q)', log)
    apply_step_meaning(x, 9, '350÷42のあまりはいくつか。', '350÷42=8あまり14。', '350÷42の商は8（前の設問の答え）。42×8=336、350-336=14で、あまりは14。', 'hd3mb_09_6 p9(r)', log)


def fix_hd3mb_09_6_p10_11(data, log):
    x = find_one(data, 'hd3mb_09_6', 'HG-4108')
    apply_step_meaning(x, 10, '659÷76の商はいくつか。', '659÷76=8あまり51。', '659÷76を計算すると、商は8。', 'hd3mb_09_6 p10(q)', log)
    apply_step_meaning(x, 11, '659÷76のあまりはいくつか。', '659÷76=8あまり51。', '659÷76の商は8（前の設問の答え）。76×8=608、659-608=51で、あまりは51。', 'hd3mb_09_6 p11(r)', log)


def fix_hd3mb_09_7_p2_3(data, log):
    x = find_one(data, 'hd3mb_09_7', 'HG-4109')
    apply_step_meaning(x, 2, '1200÷450の商はいくつか。', '1200÷450=2あまり300。', '1200÷450を計算すると、商は2。', 'hd3mb_09_7 p2(q)', log)
    apply_step_meaning(x, 3, '1200÷450のあまりはいくつか。', '1200÷450=2あまり300。', '1200÷450の商は2（前の設問の答え）。450×2=900、1200-900=300で、あまりは300。', 'hd3mb_09_7 p3(r)', log)


def fix_hd3mb_09_7_p4_5(data, log):
    x = find_one(data, 'hd3mb_09_7', 'HG-4109')
    apply_step_meaning(x, 4, '2700÷370の商はいくつか。', '2700÷370=7あまり110。', '2700÷370を計算すると、商は7。', 'hd3mb_09_7 p4(q)', log)
    apply_step_meaning(x, 5, '2700÷370のあまりはいくつか。', '2700÷370=7あまり110。', '2700÷370の商は7（前の設問の答え）。370×7=2590、2700-2590=110で、あまりは110。', 'hd3mb_09_7 p5(r)', log)


def fix_hd3mb_09_7_p6_7(data, log):
    x = find_one(data, 'hd3mb_09_7', 'HG-4109')
    apply_step_meaning(x, 6, '1460÷240の商はいくつか。', '1460÷240=6あまり20。', '1460÷240を計算すると、商は6。', 'hd3mb_09_7 p6(q)', log)
    apply_step_meaning(x, 7, '1460÷240のあまりはいくつか。', '1460÷240=6あまり20。', '1460÷240の商は6（前の設問の答え）。240×6=1440、1460-1440=20で、あまりは20。', 'hd3mb_09_7 p7(r)', log)


def fix_hd3mb_09_7_p8_9(data, log):
    x = find_one(data, 'hd3mb_09_7', 'HG-4109')
    apply_step_meaning(x, 8, '3340÷460の商はいくつか。', '3340÷460=7あまり120。', '3340÷460を計算すると、商は7。', 'hd3mb_09_7 p8(q)', log)
    apply_step_meaning(x, 9, '3340÷460のあまりはいくつか。', '3340÷460=7あまり120。', '3340÷460の商は7（前の設問の答え）。460×7=3220、3340-3220=120で、あまりは120。', 'hd3mb_09_7 p9(r)', log)


def fix_hd3mb_09_7_p10_11(data, log):
    x = find_one(data, 'hd3mb_09_7', 'HG-4109')
    apply_step_meaning(x, 10, '43600÷6200の商はいくつか。', '43600÷6200=7あまり200。', '43600÷6200を計算すると、商は7。', 'hd3mb_09_7 p10(q)', log)
    apply_step_meaning(x, 11, '43600÷6200のあまりはいくつか。', '43600÷6200=7あまり200。', '43600÷6200の商は7（前の設問の答え）。6200×7=43400、43600-43400=200で、あまりは200。', 'hd3mb_09_7 p11(r)', log)


def fix_hd3mb_09_7_p12_13(data, log):
    x = find_one(data, 'hd3mb_09_7', 'HG-4109')
    apply_step_meaning(x, 12, '56300÷7800の商はいくつか。', '56300÷7800=7あまり1700。', '56300÷7800を計算すると、商は7。', 'hd3mb_09_7 p12(q)', log)
    apply_step_meaning(x, 13, '56300÷7800のあまりはいくつか。', '56300÷7800=7あまり1700。', '56300÷7800の商は7（前の設問の答え）。7800×7=54600、56300-54600=1700で、あまりは1700。', 'hd3mb_09_7 p13(r)', log)


def fix_hd3mb_09_9_p0_1(data, log):
    x = find_one(data, 'hd3mb_09_9', 'HG-4111')
    apply_step_meaning(x, 0, '5230÷260の商はいくつか。', '5230÷260=20あまり30。', '5230÷260を計算すると、商は20。', 'hd3mb_09_9 p0(q)', log)
    apply_step_meaning(x, 1, '5230÷260のあまりはいくつか。', '5230÷260=20あまり30。', '5230÷260の商は20（前の設問の答え）。260×20=5200、5230-5200=30で、あまりは30。', 'hd3mb_09_9 p1(r)', log)


def fix_hd3mb_09_9_p2_3(data, log):
    x = find_one(data, 'hd3mb_09_9', 'HG-4111')
    apply_step_meaning(x, 2, '79500÷1200の商はいくつか。', '79500÷1200=66あまり300。', '79500÷1200を計算すると、商は66。', 'hd3mb_09_9 p2(q)', log)
    apply_step_meaning(x, 3, '79500÷1200のあまりはいくつか。', '79500÷1200=66あまり300。', '79500÷1200の商は66（前の設問の答え）。1200×66=79200、79500-79200=300で、あまりは300。', 'hd3mb_09_9 p3(r)', log)


def fix_hd3mb_09_9_p5_6(data, log):
    x = find_one(data, 'hd3mb_09_9', 'HG-4111')
    apply_step_meaning(x, 5, '86900÷3500の商はいくつか。', '86900÷3500=24あまり2900。', '86900÷3500を計算すると、商は24。', 'hd3mb_09_9 p5(q)', log)
    apply_step_meaning(x, 6, '86900÷3500のあまりはいくつか。', '86900÷3500=24あまり2900。', '86900÷3500の商は24（前の設問の答え）。3500×24=84000、86900-84000=2900で、あまりは2900。', 'hd3mb_09_9 p6(r)', log)


def fix_hd3mb_09_9_p7_8(data, log):
    x = find_one(data, 'hd3mb_09_9', 'HG-4111')
    apply_step_meaning(x, 7, '200000÷8800の商はいくつか。', '200000÷8800=22あまり6400。', '200000÷8800を計算すると、商は22。', 'hd3mb_09_9 p7(q)', log)
    apply_step_meaning(x, 8, '200000÷8800のあまりはいくつか。', '200000÷8800=22あまり6400。', '200000÷8800の商は22（前の設問の答え）。8800×22=193600、200000-193600=6400で、あまりは6400。', 'hd3mb_09_9 p8(r)', log)


def fix_hd3mb_09_9_p9_10(data, log):
    x = find_one(data, 'hd3mb_09_9', 'HG-4111')
    apply_step_meaning(x, 9, '5050500÷7700の商はいくつか。', '5050500÷7700=655あまり7000。', '5050500÷7700を計算すると、商は655。', 'hd3mb_09_9 p9(q)', log)
    apply_step_meaning(x, 10, '5050500÷7700のあまりはいくつか。', '5050500÷7700=655あまり7000。', '5050500÷7700の商は655（前の設問の答え）。7700×655=5043500、5050500-5043500=7000で、あまりは7000。', 'hd3mb_09_9 p10(r)', log)


FIXES = [
    fix_hd3mb_10_1,
    fix_hd3mb_08_3_p0_1,
    fix_hd3mb_08_3_p2_3,
    fix_hd3mb_08_3_p4_5,
    fix_hd3mb_08_3_p6_7,
    fix_hd3mb_08_3_p8_9,
    fix_hd3mb_08_3_p10_11,
    fix_hd3mb_08_3_p12_13,
    fix_hd3mb_08_3_p14_15,
    fix_hd3mb_08_3_p16_17,
    fix_hd3mb_08_5_p4_5,
    fix_hd3mb_08_9_p3_4,
    fix_hd3mb_08_10_p1_2,
    fix_hd3mb_08_10_p4_5,
    fix_hd3mb_08_10_p7_8,
    fix_hd3mb_09_2_p3_4,
    fix_hd3mb_09_2_p5_6,
    fix_hd3mb_09_2_p7_8,
    fix_hd3mb_09_3_p3_4,
    fix_hd3mb_09_3_p6_7,
    fix_hd3mb_09_4_p3_4,
    fix_hd3mb_09_4_p6_7,
    fix_hd3mb_09_4_p8_9,
    fix_hd3mb_09_5_p2_3,
    fix_hd3mb_09_5_p4_5,
    fix_hd3mb_09_6_p4_5,
    fix_hd3mb_09_6_p6_7,
    fix_hd3mb_09_6_p8_9,
    fix_hd3mb_09_6_p10_11,
    fix_hd3mb_09_7_p2_3,
    fix_hd3mb_09_7_p4_5,
    fix_hd3mb_09_7_p6_7,
    fix_hd3mb_09_7_p8_9,
    fix_hd3mb_09_7_p10_11,
    fix_hd3mb_09_7_p12_13,
    fix_hd3mb_09_9_p0_1,
    fix_hd3mb_09_9_p2_3,
    fix_hd3mb_09_9_p5_6,
    fix_hd3mb_09_9_p7_8,
    fix_hd3mb_09_9_p9_10,
]


def self_check():
    """NEW_SVG の8図形が、原簿どおりの面積比になっているかを解析的に検算する。
    このスクリプトの実行そのものには関与しない（main()からは呼ばない）。
    確認したい場合は `python scripts/_fix_g3mb_w2_1.py --check` で実行される。
    """
    def hexagon_vertices(cx, cy, r, start_deg=0):
        pts = []
        for i in range(6):
            a = math.radians(start_deg + 60 * i)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        return pts

    def shoelace(pts):
        s = 0
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            s += x1 * y2 - x2 * y1
        return abs(s) / 2

    results = {}
    # ①semicircle: 180度の円弧なので厳密に1/2
    results['1'] = 0.5
    # ②rect-thirds: 66幅を3等分、shaded=22
    results['2'] = 22 / 66
    # ③hexagon 6等分三角形（中心から頂点への6本で必ず等面積）のうち5枚
    v3 = hexagon_vertices(225, 55, 27, 0)
    areas3 = [shoelace([(225, 55), v3[i], v3[(i + 1) % 6]]) for i in range(6)]
    results['3'] = 5 * areas3[0] / sum(areas3)
    # ④円1個(全部)+円1個(4象限のうち3)。象限は90度ずつの扇形＝厳密に1/4
    results['4'] = 1 + 3 / 4
    # ⑤2x2の正方形のうち3枚
    results['5'] = 3 / 4
    # ⑥三角形の中点三角形（3辺の中点を結ぶ）は全体の1/4（相似比1/2→面積比1/4の定理）
    apex, bl, br = (135, 148), (103, 204), (167, 204)
    mid_ab = ((apex[0] + bl[0]) / 2, (apex[1] + bl[1]) / 2)
    mid_ac = ((apex[0] + br[0]) / 2, (apex[1] + br[1]) / 2)
    mid_bc = ((bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2)
    outer = shoelace([apex, bl, br])
    center = shoelace([mid_ab, mid_ac, mid_bc])
    results['6'] = center / outer
    # ⑦hexagon 12等分（頂点+各辺の中点へのスポーク、12枚は必ず等面積）のうち5枚
    v7 = hexagon_vertices(225, 175, 27, 0)
    mids7 = [((v7[i][0] + v7[(i + 1) % 6][0]) / 2, (v7[i][1] + v7[(i + 1) % 6][1]) / 2) for i in range(6)]
    seq = []
    for i in range(6):
        seq.append(v7[i])
        seq.append(mids7[i])
    areas7 = [shoelace([(225, 175), seq[i], seq[(i + 1) % 12]]) for i in range(12)]
    results['7'] = 5 * areas7[0] / sum(areas7)
    # ⑧棒2本(全部)+3本目のうち上1/3
    results['8'] = 2 + (56 / 3) / 56

    expect = {'1': 1 / 2, '2': 1 / 3, '3': 5 / 6, '4': 1 + 3 / 4, '5': 3 / 4,
              '6': 1 / 4, '7': 5 / 12, '8': 2 + 1 / 3}
    ok_all = True
    for k in "12345678":
        ok = abs(results[k] - expect[k]) < 1e-9
        ok_all = ok_all and ok
        print("%s: got=%.6f expect=%.6f OK=%s" % (k, results[k], expect[k], ok))
    print("ALL OK:", ok_all)
    if not ok_all:
        raise AssertionError("self_check: 面積比の検算に失敗した図形がある")
    return ok_all


def main():
    if "--check" in sys.argv:
        self_check()
        return

    path = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(BASE, "data", "hama_daimon.json")
    path = os.path.abspath(path)
    print("target:", path)

    with io.open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    log = []
    for fn in FIXES:
        fn(data, log)

    for line in log:
        print(line)

    applied = sum(1 for l in log if l.startswith("APPLIED"))
    skipped = sum(1 for l in log if l.startswith("SKIP"))
    print("applied=%d skipped(already)=%d total=%d" % (applied, skipped, len(log)))

    out = (json.dumps(data, ensure_ascii=False, indent=1) + "\n").encode("utf-8")
    with io.open(path, "wb") as f:
        f.write(out)
    print("wrote", len(out), "bytes")


if __name__ == "__main__":
    main()
