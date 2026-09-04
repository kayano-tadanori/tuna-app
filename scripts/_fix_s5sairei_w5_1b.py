# -*- coding: utf-8 -*-
"""小5最レ（算数）No.1 の記号定義2本 ＝ 答えが1つに決まらない不具合を直す。

  hd5s_1k1_10（HG-6581）… A〜Fが0〜5。条件だけだと 12通り
  hd5s_1k1_15（HG-6589）… A〜Gが1〜9。条件だけだと 19通り

  どちらも原本の**設問文**には「ちがう記号はちがう数」が書かれていないが、
  **解答冊子の解説はその条件を使って解いている**（下の「根拠」）。
  ＝ 原本にある条件を設問側にも書き写す直し。問題の作り変えではない。

  根拠（解答 5年 最レ算 第1分冊 第1講座.pdf）:
    * 大問10 … PDF p7（印刷p8）「A＝4, B＝2, C＝1, D＝☆, E＝3, F＝0 / **Dは残りの5**」
    * 大問15 … PDF p11（印刷p13）「B×C＝Gをみると **Bは1ではない** ⇒ B＝2 D＝1 /
      また，Bが2とわかったので **残りの数 4, 5, 6, 7, 8 で調べると** …」
    * 同じ回の大問16は本文に「A,B,C,Dは**すべて異なる数字です**」と明記されている＝
      この教材はこの条件を書くときは書く。10・15は書きもれ。

使い方:
    python scripts/_fix_s5sairei_w5_1b.py [対象JSON]      # 省略時 data/hama_daimon.json

きまり（_fix_s5sairei_w5_1.py と同じ）:
  * 大問は genbo_common.iter_daimon だけで引く
  * 欄まるごとの一致で判定する冪等パッチ。cur==new なら済み／cur==old なら適用／
    どちらでもなければ **1件も書かずに止める**
  * 同じ (欄, 置きかえ元) の場所の数とパッチ本数が合わなければ止める
  * ★書く前に全探索して「新しい条件のもとで答えがちょうど1通り」かつ
    「それがアプリに入っている答えと一致する」ことを確かめる。合わなければ1件も書かない。
"""
import io, json, os, sys
from itertools import product

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_common import iter_daimon   # ★大問の走査はここだけ

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT = os.path.join(BASE, "data", "hama_daimon.json")

PATCHES = json.loads(r'''
[
 {
  "id": "hd5s_1k1_10",
  "field": "question",
  "step": 1,
  "old": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（A＝）",
  "new": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数、ちがう文字はちがう数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（A＝）"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "question",
  "step": 2,
  "old": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（B＝）",
  "new": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数、ちがう文字はちがう数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（B＝）"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "question",
  "step": 3,
  "old": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（C＝）",
  "new": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数、ちがう文字はちがう数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（C＝）"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "question",
  "step": 4,
  "old": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（D＝）",
  "new": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数、ちがう文字はちがう数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（D＝）"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "question",
  "step": 5,
  "old": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（E＝）",
  "new": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数、ちがう文字はちがう数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（E＝）"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "question",
  "step": 6,
  "old": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（F＝）",
  "new": "次の式の文字A,B,C,D,E,Fは0,1,2,3,4,5の6つの数のどれかにあたります（同じ文字は同じ数、ちがう文字はちがう数）。・D＋F＝D ・E－B＝C ・E×C＝E ・A÷B＝B　（F＝）"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "meaning",
  "step": 1,
  "old": "D＋F＝Dより F＝0（足しても変わらない）。E×C＝EよりC＝1（かけても変わらない、E≠0のため）。A÷B＝BよりA＝B×B（平方数）。残り{2,3,4,5}のうち平方数はB＝2,A＝4。E－B＝CよりE－2＝1、E＝3。残りのDは5",
  "new": "①D＋F＝Dより、Fをたしても大きさが変わらないので F＝0。②E×C＝Eより、Cをかけても大きさが変わらないので C＝1。③A÷B＝BよりA＝B×B。④0と1はもう使ったので、A・B・D・Eに残るのは2,3,4,5。A＝B×Bになるのは B＝2、A＝4 だけ。⑤E－B＝Cより E－2＝1 なので E＝3。⑥のこったDは5。"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "meaning",
  "step": 2,
  "old": "D＋F＝Dより F＝0（足しても変わらない）。E×C＝EよりC＝1（かけても変わらない、E≠0のため）。A÷B＝BよりA＝B×B（平方数）。残り{2,3,4,5}のうち平方数はB＝2,A＝4。E－B＝CよりE－2＝1、E＝3。残りのDは5",
  "new": "①D＋F＝Dより、Fをたしても大きさが変わらないので F＝0。②E×C＝Eより、Cをかけても大きさが変わらないので C＝1。③A÷B＝BよりA＝B×B。④0と1はもう使ったので、A・B・D・Eに残るのは2,3,4,5。A＝B×Bになるのは B＝2、A＝4 だけ。⑤E－B＝Cより E－2＝1 なので E＝3。⑥のこったDは5。"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "meaning",
  "step": 3,
  "old": "D＋F＝Dより F＝0（足しても変わらない）。E×C＝EよりC＝1（かけても変わらない、E≠0のため）。A÷B＝BよりA＝B×B（平方数）。残り{2,3,4,5}のうち平方数はB＝2,A＝4。E－B＝CよりE－2＝1、E＝3。残りのDは5",
  "new": "①D＋F＝Dより、Fをたしても大きさが変わらないので F＝0。②E×C＝Eより、Cをかけても大きさが変わらないので C＝1。③A÷B＝BよりA＝B×B。④0と1はもう使ったので、A・B・D・Eに残るのは2,3,4,5。A＝B×Bになるのは B＝2、A＝4 だけ。⑤E－B＝Cより E－2＝1 なので E＝3。⑥のこったDは5。"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "meaning",
  "step": 4,
  "old": "D＋F＝Dより F＝0（足しても変わらない）。E×C＝EよりC＝1（かけても変わらない、E≠0のため）。A÷B＝BよりA＝B×B（平方数）。残り{2,3,4,5}のうち平方数はB＝2,A＝4。E－B＝CよりE－2＝1、E＝3。残りのDは5",
  "new": "①D＋F＝Dより、Fをたしても大きさが変わらないので F＝0。②E×C＝Eより、Cをかけても大きさが変わらないので C＝1。③A÷B＝BよりA＝B×B。④0と1はもう使ったので、A・B・D・Eに残るのは2,3,4,5。A＝B×Bになるのは B＝2、A＝4 だけ。⑤E－B＝Cより E－2＝1 なので E＝3。⑥のこったDは5。"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "meaning",
  "step": 5,
  "old": "D＋F＝Dより F＝0（足しても変わらない）。E×C＝EよりC＝1（かけても変わらない、E≠0のため）。A÷B＝BよりA＝B×B（平方数）。残り{2,3,4,5}のうち平方数はB＝2,A＝4。E－B＝CよりE－2＝1、E＝3。残りのDは5",
  "new": "①D＋F＝Dより、Fをたしても大きさが変わらないので F＝0。②E×C＝Eより、Cをかけても大きさが変わらないので C＝1。③A÷B＝BよりA＝B×B。④0と1はもう使ったので、A・B・D・Eに残るのは2,3,4,5。A＝B×Bになるのは B＝2、A＝4 だけ。⑤E－B＝Cより E－2＝1 なので E＝3。⑥のこったDは5。"
 },
 {
  "id": "hd5s_1k1_10",
  "field": "meaning",
  "step": 6,
  "old": "D＋F＝Dより F＝0（足しても変わらない）。E×C＝EよりC＝1（かけても変わらない、E≠0のため）。A÷B＝BよりA＝B×B（平方数）。残り{2,3,4,5}のうち平方数はB＝2,A＝4。E－B＝CよりE－2＝1、E＝3。残りのDは5",
  "new": "①D＋F＝Dより、Fをたしても大きさが変わらないので F＝0。②E×C＝Eより、Cをかけても大きさが変わらないので C＝1。③A÷B＝BよりA＝B×B。④0と1はもう使ったので、A・B・D・Eに残るのは2,3,4,5。A＝B×Bになるのは B＝2、A＝4 だけ。⑤E－B＝Cより E－2＝1 なので E＝3。⑥のこったDは5。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 1,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（A＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（A＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 2,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（B＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（B＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 3,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（C＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（C＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 4,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（D＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（D＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 5,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（E＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（E＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 6,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（F＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（F＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "question",
  "step": 7,
  "old": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（G＝）",
  "new": "次の式のA，B，C，D，E，F，Gは1から9までの9つの数字のどれかにあたります（同じ記号は同じ数字、ちがう記号はちがう数字）。・A＋B＝G ・B＋D＝E ・B×C＝G ・E×E＝F　（G＝）"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 1,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 2,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 3,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 4,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 5,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 6,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 },
 {
  "id": "hd5s_1k1_15",
  "field": "meaning",
  "step": 7,
  "old": "E×E＝Fが決め手（1〜9の平方数の中で条件を満たす組をしぼる）。E＝3のときF＝9。B＋D＝E＝3となる組（B＝2,D＝1）とB×C＝A+Bが両立する組を絞るとB＝2,C＝4,G＝8,A＝6で全式が一致",
  "new": "①E×E＝Fになるのは (E,F)＝(1,1)(2,4)(3,9) のどれか。E＝1だとFも1で同じ数字になるので不適。②E＝2だと B＋D＝2 から B＝D＝1 となって同じ数字になるので不適。よって E＝3、F＝9。③B＋D＝3より (B,D)＝(1,2) か (2,1)。B＝1だと B×C＝G が C＝G になって同じ数字になるので不適。よって B＝2、D＝1。④ここまでで1,2,3,9を使ったので、のこりは4,5,6,7,8。B×C＝2×C＝G にあてはまるのは C＝4、G＝8 だけ。⑤A＋B＝Gより A＋2＝8 なので A＝6。"
 }
]
''')


# ── 全探索（書く前の安全弁）──────────────────────────
def solve_6581(distinct):
    """A〜Fが0〜5。D+F=D / E-B=C / ExC=E / A÷B=B"""
    out = []
    for A, B, C, D, E, F in product(range(6), repeat=6):
        if D + F != D:      continue
        if E - B != C:      continue      # 小5なので差は0以上
        if E * C != E:      continue
        if B == 0:          continue      # 0でわれない
        if A != B * B:      continue      # A÷B=B
        if distinct and len(set((A, B, C, D, E, F))) != 6:
            continue
        out.append((A, B, C, D, E, F))
    return out


def solve_6589(distinct):
    """A〜Gが1〜9。A+B=G / B+D=E / BxC=G / ExE=F"""
    out = []
    for A, B, C, D, E, F, G in product(range(1, 10), repeat=7):
        if A + B != G:      continue
        if B + D != E:      continue
        if B * C != G:      continue
        if E * E != F:      continue
        if distinct and len(set((A, B, C, D, E, F, G))) != 7:
            continue
        out.append((A, B, C, D, E, F, G))
    return out


UNIQ_CHECK = {
    "hd5s_1k1_10": (solve_6581, 6),
    "hd5s_1k1_15": (solve_6589, 7),
}


def check_unique(did, x):
    solver, n = UNIQ_CHECK[did]
    loose = solver(False)
    tight = solver(True)
    if len(tight) != 1:
        return False, "新しい条件でも答えが %d 通りある" % len(tight)
    got = tuple(int(s["answer"]) for s in x["steps"][:n])
    if got != tight[0]:
        return False, "全探索の答え %s がアプリの答え %s と合わない" % (tight[0], got)
    return True, ("条件なし %d 通り → 「ちがう記号はちがう数」を足すと 1 通り %s ＝アプリの答えと一致"
                  % (len(loose), tight[0]))


# ── 欄の読み書き ───────────────────────────────────────
def get_field(x, step, field):
    return x.get(field) if step is None else x["steps"][step - 1].get(field)


def set_field(x, step, field, v):
    if step is None:
        x[field] = v
    else:
        x["steps"][step - 1][field] = v


def count_value(x, field, val):
    n = 1 if x.get(field) == val else 0
    for s in x.get("steps", []):
        if s.get(field) == val:
            n += 1
    return n


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    d = json.load(io.open(path, encoding="utf-8"))

    idx, dup = {}, set()
    for r in iter_daimon(d):
        i = r["x"].get("id")
        if not i:
            continue
        if i in idx:
            dup.add(i)
        idx[i] = r["x"]
    for p in PATCHES:
        if p["id"] in dup:
            print("中止: id %s が2本以上ある" % p["id"]); return 1
        if p["id"] not in idx:
            print("中止: id %s が見つからない" % p["id"]); return 1

    # ★まず全探索。ここで落ちたら1件も書かない
    for did in sorted(UNIQ_CHECK):
        ok, msg = check_unique(did, idx[did])
        print("  全探索 %s: %s" % (did, msg))
        if not ok:
            print("中止: 答えが1つに決まらないので1件も書かない"); return 1

    groups = {}
    for p in PATCHES:
        groups.setdefault((p["id"], p["field"], p["old"]), []).append(p)

    todo, done = [], []
    for (did, field, old), members in sorted(groups.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        x = idx[did]
        cur = [get_field(x, m["step"], field) for m in members]
        if all(c == m["new"] for c, m in zip(cur, members)):
            if count_value(x, field, old) != 0:
                print("中止: %s の %s に置きかえ元がまだ残っている" % (did, field)); return 1
            done.extend(members)
            continue
        if not all(c == old for c in cur):
            print("中止: %s / %s / 小問%s の中身が置きかえ元とも置きかえ先とも違う。"
                  % (did, field, [m["step"] for m in members]))
            for c, m in zip(cur, members):
                if c != old and c != m["new"]:
                    print("       いまの値: %r" % (c,))
            return 1
        n = count_value(x, field, old)
        if n != len(members):
            print("中止: %s の %s に置きかえ元が %d か所ある（パッチは %d 本）"
                  % (did, field, n, len(members))); return 1
        todo.extend(members)

    if not todo:
        print("すでに全部当たっている（%d件）。書き出しはしない。" % len(done))
        return 0

    for p in todo:
        set_field(idx[p["id"]], p["step"], p["field"], p["new"])

    io.open(path, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))

    touched = sorted(set(p["id"] for p in todo))
    print("当てた: %d件 / すでに済み: %d件 / さわった大問: %d本" % (len(todo), len(done), len(touched)))
    for i in touched:
        print("   ", i)
    print("書き出し:", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
