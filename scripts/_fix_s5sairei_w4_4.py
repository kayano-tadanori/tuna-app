# -*- coding: utf-8 -*-
"""小5最レ 第3分冊 第1講座 No.25／No.30 の塾講師監査（第4班）で見つかった中身の誤りを直す。

  対象13本のうち12本に手を入れる。いちばん重いのは次の4つ。
    ・hd5s_25k1_8 …(1)は「1辺12cm」なのに「対角線12cm」、(2)は「対角線8cm」なのに
                    「1辺8cm・直径8cm」と設問に書いてあった。そのまま解くと答えが半分
                    （41.04／13.76）になり、載っている答え82.08／6.88と合わない。
                    原本（本文p28・解答p45）で1辺／対角線を確かめて直す。
    ・hd5s_25k1_7 …「正方形の対角線を半径とする4分円」は誤り。原本は「おうぎ形の弧の
                    両はしを結んだ線（＝半径を1辺とする正方形の対角線）が10cm／16cm」。
    ・hd5s_30k1_10…解説が「5個・8個・8個・5個の立方体を針が通る」と逆。解答冊子の表の
                    見出しは「通ってない個数」。さらに図の●が10個しかなく（真上と横が
                    でたらめ、1個は立体の外）、図から26個を出せなかった。図もかき直す。
    ・hd5s_30k1_13…図の頂点記号B・D・F・Hが4つとも別の場所にあり、AB・AD・AEが読めな
                    かった。原本（本文p61）の ABCD＝上の面／EFGH＝下の面 に直す。

  ★書きかえは「欄まるごとの一致」で判定する（cur==new なら済み／cur==old なら適用）。
    末尾に足すだけ・うしろを削るだけの直し方は2回流すと壊れる。
  ★図SVGを入れる前に、図の座標から答えを組み立て直して、載っている答えと合うか確かめる。
  ★本番 data/hama_daimon.json は直接いじらない。第1引数にコピーを渡して試すこと。
"""
import io, json, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon      # 大問を歩く唯一の口

PATCH = json.loads(r"""
[
 {
  "id": "hd5s_30k1_10",
  "field": "svg",
  "step": null,
  "old": "<svg viewBox=\"0 0 330 210\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><rect x=\"60\" y=\"60\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"60\" y=\"90\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"60\" y=\"120\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"60\" y=\"150\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"90\" y=\"60\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"90\" y=\"90\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"90\" y=\"120\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"90\" y=\"150\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"120\" y=\"60\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"120\" y=\"90\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"120\" y=\"120\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"120\" y=\"150\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"150\" y=\"60\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"150\" y=\"90\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"150\" y=\"120\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"150\" y=\"150\" width=\"30\" height=\"30\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"60\" y1=\"60\" x2=\"100\" y2=\"30\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"90\" y1=\"60\" x2=\"130\" y2=\"30\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"120\" y1=\"60\" x2=\"160\" y2=\"30\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"150\" y1=\"60\" x2=\"190\" y2=\"30\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"180\" y1=\"60\" x2=\"220\" y2=\"30\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"60.0\" y1=\"60.0\" x2=\"180.0\" y2=\"60.0\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"70.0\" y1=\"52.5\" x2=\"190.0\" y2=\"52.5\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"80.0\" y1=\"45.0\" x2=\"200.0\" y2=\"45.0\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"90.0\" y1=\"37.5\" x2=\"210.0\" y2=\"37.5\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"100.0\" y1=\"30.0\" x2=\"220.0\" y2=\"30.0\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"180\" y1=\"60\" x2=\"220\" y2=\"30\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"180\" y1=\"90\" x2=\"220\" y2=\"60\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"180\" y1=\"120\" x2=\"220\" y2=\"90\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"180\" y1=\"150\" x2=\"220\" y2=\"120\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"180\" y1=\"180\" x2=\"220\" y2=\"150\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"220\" y1=\"30\" x2=\"220\" y2=\"150\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><circle cx=\"75\" cy=\"165\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"105\" cy=\"135\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"135\" cy=\"105\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"165\" cy=\"75\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"120\" cy=\"45\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"160\" cy=\"40\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"190\" cy=\"20\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"200\" cy=\"60\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"205\" cy=\"95\" r=\"4\" fill=\"#c9d4f0\"/><circle cx=\"210\" cy=\"125\" r=\"4\" fill=\"#c9d4f0\"/><text x=\"165\" y=\"198\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">真上・正面・横から4本ずつ●の位置に針をさす</text></svg>",
  "new": "<svg viewBox=\"0 0 330 225\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><line x1=\"40\" y1=\"80\" x2=\"40\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"70\" y1=\"80\" x2=\"70\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"100\" y1=\"80\" x2=\"100\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"130\" y1=\"80\" x2=\"130\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"160\" y1=\"80\" x2=\"160\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"40\" y1=\"80\" x2=\"160\" y2=\"80\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"40\" y1=\"110\" x2=\"160\" y2=\"110\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"40\" y1=\"140\" x2=\"160\" y2=\"140\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"40\" y1=\"170\" x2=\"160\" y2=\"170\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"40\" y1=\"200\" x2=\"160\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"40\" y1=\"80\" x2=\"128\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"70\" y1=\"80\" x2=\"158\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"100\" y1=\"80\" x2=\"188\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"130\" y1=\"80\" x2=\"218\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"80\" x2=\"248\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"40\" y1=\"80\" x2=\"160\" y2=\"80\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"62\" y1=\"64\" x2=\"182\" y2=\"64\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"84\" y1=\"48\" x2=\"204\" y2=\"48\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"106\" y1=\"32\" x2=\"226\" y2=\"32\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"128\" y1=\"16\" x2=\"248\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"80\" x2=\"248\" y2=\"16\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"110\" x2=\"248\" y2=\"46\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"140\" x2=\"248\" y2=\"76\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"170\" x2=\"248\" y2=\"106\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"200\" x2=\"248\" y2=\"136\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"160\" y1=\"80\" x2=\"160\" y2=\"200\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"182\" y1=\"64\" x2=\"182\" y2=\"184\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"204\" y1=\"48\" x2=\"204\" y2=\"168\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"226\" y1=\"32\" x2=\"226\" y2=\"152\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"248\" y1=\"16\" x2=\"248\" y2=\"136\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><circle cx=\"145\" cy=\"95\" r=\"3.6\" fill=\"#c9d4f0\"/><circle cx=\"115\" cy=\"125\" r=\"3.6\" fill=\"#c9d4f0\"/><circle cx=\"85\" cy=\"155\" r=\"3.6\" fill=\"#c9d4f0\"/><circle cx=\"55\" cy=\"185\" r=\"3.6\" fill=\"#c9d4f0\"/><circle cx=\"118\" cy=\"56\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"148\" cy=\"56\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"140\" cy=\"40\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"170\" cy=\"40\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"171\" cy=\"87\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"193\" cy=\"101\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"215\" cy=\"115\" r=\"3.0\" fill=\"#c9d4f0\"/><circle cx=\"237\" cy=\"129\" r=\"3.0\" fill=\"#c9d4f0\"/><text x=\"165\" y=\"218\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">真上・正面・横から4本ずつ●の位置に針をさす</text></svg>"
 },
 {
  "id": "hd5s_30k1_10",
  "field": "meaning",
  "step": 0,
  "old": "①針の通ったところに段ごとに印をつけていく。②上から1段目は5個、2段目は8個、3段目は8個、4段目は5個の小立方体を針が通る。③5+8+8+5＝26個。",
  "new": "①4×4×4の立方体を、上から1段ずつ4まいの図に分けてかく。②真上からの4本の針はどの段でも同じ4か所を通る。正面からの4本・横からの4本は、それぞれちがう段を1本ずつ通る。通ったところに印をつけていく。③印のついていないマスを数えると、上から1段目は5個、2段目は8個、3段目は8個、4段目は5個。④5+8+8+5＝26個。"
 },
 {
  "id": "hd5s_30k1_11",
  "field": "svg",
  "step": null,
  "old": "<svg viewBox=\"0 0 430 190\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><text x=\"35\" y=\"25\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">図1</text><rect x=\"75\" y=\"40\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"87\" cy=\"52\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"52\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"93\" cy=\"58\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"87\" cy=\"64\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"64\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"39\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"57\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"75\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"87\" cy=\"87\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"87\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"87\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"87\" cy=\"101\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"101\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"111\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"122\" cy=\"87\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"129\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"136\" cy=\"101\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"75\" y=\"112\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"87\" cy=\"124\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"136\" r=\"2.4\" fill=\"#c9d4f0\"/><text x=\"250\" y=\"25\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">図2</text><rect x=\"230\" y=\"70\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"230\" y=\"96\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"230\" y=\"122\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"270\" y=\"70\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"270\" y=\"96\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"270\" y=\"122\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"310\" y=\"70\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"310\" y=\"96\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><rect x=\"310\" y=\"122\" width=\"40\" height=\"26\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"230\" y1=\"70\" x2=\"260\" y2=\"46\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"270\" y1=\"70\" x2=\"300\" y2=\"46\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"310\" y1=\"70\" x2=\"340\" y2=\"46\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"350\" y1=\"70\" x2=\"380\" y2=\"46\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"260\" y1=\"46\" x2=\"380\" y2=\"46\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"380\" y1=\"46\" x2=\"380\" y2=\"122\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"350\" y1=\"148\" x2=\"380\" y2=\"122\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><text x=\"300\" y=\"178\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">9個のさいころをたて・横3個ずつ並べた直方体</text></svg>",
  "new": "<svg viewBox=\"0 0 430 190\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><text x=\"35\" y=\"25\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">図1</text><rect x=\"75\" y=\"40\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"87\" cy=\"52\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"52\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"93\" cy=\"58\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"87\" cy=\"64\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"64\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"39\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"57\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"75\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"87\" cy=\"88\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"88\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"87\" cy=\"100\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"100\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"111\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"123\" cy=\"87\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"135\" cy=\"87\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"123\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"135\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"123\" cy=\"101\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"135\" cy=\"101\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"147\" y=\"76\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"158\" cy=\"87\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"165\" cy=\"94\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"172\" cy=\"101\" r=\"2.4\" fill=\"#c9d4f0\"/><rect x=\"75\" y=\"112\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><circle cx=\"87\" cy=\"124\" r=\"2.4\" fill=\"#c9d4f0\"/><circle cx=\"99\" cy=\"136\" r=\"2.4\" fill=\"#c9d4f0\"/><text x=\"112\" y=\"168\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">向かい合う面の和はどれも7</text><text x=\"310\" y=\"25\" font-size=\"12\" text-anchor=\"middle\" fill=\"#c9d4f0\">図2</text><line x1=\"235\" y1=\"120\" x2=\"289\" y2=\"78\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"275\" y1=\"120\" x2=\"329\" y2=\"78\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"315\" y1=\"120\" x2=\"369\" y2=\"78\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"355\" y1=\"120\" x2=\"409\" y2=\"78\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"235\" y1=\"120\" x2=\"355\" y2=\"120\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"253\" y1=\"106\" x2=\"373\" y2=\"106\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"271\" y1=\"92\" x2=\"391\" y2=\"92\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"289\" y1=\"78\" x2=\"409\" y2=\"78\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"235\" y1=\"120\" x2=\"235\" y2=\"146\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"355\" y1=\"120\" x2=\"355\" y2=\"146\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"235\" y1=\"146\" x2=\"355\" y2=\"146\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"275\" y1=\"120\" x2=\"275\" y2=\"146\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"315\" y1=\"120\" x2=\"315\" y2=\"146\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"409\" y1=\"78\" x2=\"409\" y2=\"104\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"355\" y1=\"146\" x2=\"409\" y2=\"104\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"373\" y1=\"106\" x2=\"373\" y2=\"132\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"391\" y1=\"92\" x2=\"391\" y2=\"118\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><text x=\"300\" y=\"178\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">9個のさいころをたて・横3個ずつ並べた直方体（1だん）</text></svg>"
 },
 {
  "id": "hd5s_30k1_11",
  "field": "intro",
  "step": null,
  "old": "各面に1から6までの数を1つずつ書いたさいころが9個あります。向かい合った面の数の和はどれも7です。これら9個のさいころを、たて・横3個ずつすき間なく並べて直方体を作りました。",
  "new": "各面に1から6までの数を1つずつ書いたさいころが9個あります。向かい合った面の数の和はどれも7で、さいころの展開図は図1のようになっています。これら9個のさいころを、たて・横3個ずつすき間なく並べてできた直方体が図2です。"
 },
 {
  "id": "hd5s_30k1_11",
  "field": "meaning",
  "step": 1,
  "old": "①上面と下面の和は7×9＝63。②同じ数どうしをくっつけるので、横一列(3個)の両端の面の数の和は7になる。右面と左面の和は7×3＝21。前面と後面の和も7×3＝21。③63+21+21＝105。",
  "new": "①上の面と下の面は、9個それぞれの向かい合う面どうしなので、和は7×9＝63。②横一列にならんだ3個で考える。まん中のさいころの左の面を□とすると、右の面は7−□。同じ数どうしをくっつけるので、左はしのさいころの右の面も□で、外に出るその左の面は7−□。右はしのさいころの左の面は7−□だから、外に出るその右の面は□。両はしの和は(7−□)+□＝7。③横一列が3列あるので、左の面と右の面の和は7×3＝21。前の面と後ろの面も同じで21。④63+21+21＝105。"
 },
 {
  "id": "hd5s_30k1_12",
  "field": "meaning",
  "step": 0,
  "old": "①2周するので、展開図の側面のおうぎ形を2つならべてかく。②側面のおうぎ形の中心角は24×2×3.14×□/360＝3×2×3.14より□＝45度。2つならべると90度になる。③ならべた図に5:12:13の直角三角形があらわれる。④10cmにあたる部分が⑤で、求めるひも(OB分)は⑬にあたるので、10×13/5＝26cm。",
  "new": "①2周するので、展開図の側面のおうぎ形を2つならべてかく。②おうぎ形の弧の長さは底面の円周と同じだから、24×2×3.14×□/360＝3×2×3.14 より□＝45度。2つならべると90度。③ならべた図でひもがいちばん短くなるのは、AとBをまっすぐ結んだとき。角AOBは90度、OA＝24cm、OB＝10cm。④10:24＝5:12なので、これは5:12:13の直角三角形。10cmが⑤にあたるから、求めるひもAB（⑬）は10÷5×13＝26cm。"
 },
 {
  "id": "hd5s_30k1_13",
  "field": "svg",
  "step": null,
  "old": "<svg viewBox=\"0 0 360 195\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><polygon points=\"70,75 250,75 300,40 120,40\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"130\" y1=\"75\" x2=\"180\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"190\" y1=\"75\" x2=\"240\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"82\" y1=\"66\" x2=\"262\" y2=\"66\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"95\" y1=\"58\" x2=\"275\" y2=\"58\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"108\" y1=\"49\" x2=\"288\" y2=\"49\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><rect x=\"70\" y=\"75\" width=\"180\" height=\"55\" fill=\"none\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"130\" y1=\"75\" x2=\"130\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"190\" y1=\"75\" x2=\"190\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.6\"/><line x1=\"70\" y1=\"102\" x2=\"250\" y2=\"102\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"250\" y1=\"130\" x2=\"300\" y2=\"95\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"300\" y1=\"40\" x2=\"300\" y2=\"95\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"250\" y1=\"102\" x2=\"300\" y2=\"67\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"262\" y1=\"66\" x2=\"262\" y2=\"121\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"275\" y1=\"58\" x2=\"275\" y2=\"112\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><line x1=\"288\" y1=\"49\" x2=\"288\" y2=\"104\" stroke=\"#4f9eff\" stroke-width=\"1.1\"/><text x=\"64\" y=\"70\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">A</text><text x=\"306\" y=\"36\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">C</text><text x=\"122\" y=\"34\" font-size=\"11\" text-anchor=\"middle\" fill=\"#c9d4f0\">H</text><text x=\"180\" y=\"34\" font-size=\"11\" text-anchor=\"middle\" fill=\"#c9d4f0\">D</text><text x=\"64\" y=\"138\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">E</text><text x=\"306\" y=\"100\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">G</text><text x=\"196\" y=\"143\" font-size=\"11\" text-anchor=\"middle\" fill=\"#c9d4f0\">B</text><text x=\"150\" y=\"143\" font-size=\"11\" text-anchor=\"middle\" fill=\"#c9d4f0\">F</text><text x=\"180\" y=\"182\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">印をつないでできる小さい長方形を「小面」とよぶ</text></svg>",
  "new": "<svg viewBox=\"0 0 360 205\" xmlns=\"http://www.w3.org/2000/svg\" style=\"display:block;margin:0 auto;max-width:100%\"><line x1=\"70\" y1=\"75\" x2=\"120\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"130\" y1=\"75\" x2=\"180\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"190\" y1=\"75\" x2=\"240\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"250\" y1=\"75\" x2=\"300\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"70\" y1=\"75\" x2=\"250\" y2=\"75\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"82.5\" y1=\"66.25\" x2=\"262.5\" y2=\"66.25\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"95\" y1=\"57.5\" x2=\"275\" y2=\"57.5\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"107.5\" y1=\"48.75\" x2=\"287.5\" y2=\"48.75\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"120\" y1=\"40\" x2=\"300\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"70\" y1=\"75\" x2=\"70\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"130\" y1=\"75\" x2=\"130\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"190\" y1=\"75\" x2=\"190\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"250\" y1=\"75\" x2=\"250\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"70\" y1=\"75\" x2=\"250\" y2=\"75\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"70\" y1=\"102.5\" x2=\"250\" y2=\"102.5\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"70\" y1=\"130\" x2=\"250\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.4\"/><line x1=\"250\" y1=\"75\" x2=\"300\" y2=\"40\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"250\" y1=\"102.5\" x2=\"300\" y2=\"67.5\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"250\" y1=\"130\" x2=\"300\" y2=\"95\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"250\" y1=\"75\" x2=\"250\" y2=\"130\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"262.5\" y1=\"66.25\" x2=\"262.5\" y2=\"121.25\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"275\" y1=\"57.5\" x2=\"275\" y2=\"112.5\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"287.5\" y1=\"48.75\" x2=\"287.5\" y2=\"103.75\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"300\" y1=\"40\" x2=\"300\" y2=\"95\" stroke=\"#4f9eff\" stroke-width=\"1.2\"/><line x1=\"120\" y1=\"95\" x2=\"120\" y2=\"40\" stroke=\"#9aa3c0\" stroke-width=\"1.1\" stroke-dasharray=\"4 4\"/><line x1=\"120\" y1=\"95\" x2=\"70\" y2=\"130\" stroke=\"#9aa3c0\" stroke-width=\"1.1\" stroke-dasharray=\"4 4\"/><line x1=\"120\" y1=\"95\" x2=\"300\" y2=\"95\" stroke=\"#9aa3c0\" stroke-width=\"1.1\" stroke-dasharray=\"4 4\"/><text x=\"64\" y=\"70\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">A</text><text x=\"64\" y=\"138\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">E</text><text x=\"120\" y=\"32\" font-size=\"11\" text-anchor=\"middle\" fill=\"#c9d4f0\">D</text><text x=\"306\" y=\"36\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">C</text><text x=\"306\" y=\"100\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">G</text><text x=\"244\" y=\"146\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">F</text><line x1=\"270\" y1=\"122\" x2=\"254\" y2=\"80\" stroke=\"#9aa3c0\" stroke-width=\"1.0\"/><text x=\"272\" y=\"128\" font-size=\"11\" text-anchor=\"start\" fill=\"#c9d4f0\">B</text><text x=\"114\" y=\"114\" font-size=\"11\" text-anchor=\"end\" fill=\"#c9d4f0\">H</text><text x=\"180\" y=\"197\" font-size=\"10\" text-anchor=\"middle\" fill=\"#9aa3c0\">印をつないでできる小さい長方形を「小面」とよぶ</text></svg>"
 },
 {
  "id": "hd5s_30k1_13",
  "field": "meaning",
  "step": 0,
  "old": "①ふくらませて多面体として考える。②面の数は、たてよこの分割数から4×3×2+2×3×2+2×4×2＝52面。③辺の数は、1本の辺を2つの面が共有するので4×52÷2＝104本。④頂点の数は、頂点+面−辺＝2の関係から104+2−52＝54個。",
  "new": "①直方体をふくらませて、小面だけでできた多面体として考える。②横(AB)は3等分、奥ゆき(AD)は4等分、高さ(AE)は2等分。上と下の面は3×4＝12ずつ、前と後ろの面は3×2＝6ずつ、右と左の面は4×2＝8ずつなので、面の数は(12+6+8)×2＝52面。③どの小面も辺が4本で、1本の辺は2つの面が共有するから、辺の数は4×52÷2＝104本。④どんな多面体でも「点の数+面の数−辺の数＝2」が成り立つので、点の数は104+2−52＝54個。"
 },
 {
  "id": "hd5s_25k1_1",
  "field": "meaning",
  "step": 0,
  "old": "①弧CDと弧ABの長さの比は40:60＝2:3。半径の比も2:3になる。②③−②の①がACの長さ8cmにあたるので、③（OA）は24cm。",
  "new": "①おうぎ形OABとOCDは中心角が同じなので、弧の長さは半径に比例する。弧CD:弧AB＝40:60＝2:3だから、OC:OA＝②:③。②OA−OC＝ACだから、③−②＝①が8cmにあたる。③OAは③なので8×3＝24cm。"
 },
 {
  "id": "hd5s_25k1_3",
  "field": "meaning",
  "step": 0,
  "old": "①半径の比から、それぞれのおうぎ形の弧の比がわかる（中心角はどれも120度）。②いちばん小さいおうぎ形の弧の長さは24×3.14×120/360＝25.12cm。③3つを合わせると150.72cm。",
  "new": "①正三角形の1つの角は60度だから、おうぎ形の中心角はどれも180−60＝120度。②3つのおうぎ形の半径は12cm→24cm→36cmで1:2:3。中心角が同じなら弧の長さは半径に比例するので、弧の比も1:2:3。③いちばん小さい弧は12×2×3.14×120/360＝25.12cm。④合計は25.12×(1+2+3)＝25.12×6＝150.72cm。"
 },
 {
  "id": "hd5s_25k1_4",
  "field": "meaning",
  "step": 0,
  "old": "①中心に近い方から面積比を書きこむと①③⑤⑦になる（奇数列）。②斜線部分が③+⑦＝⑩、白い部分が①+⑤＝⑥。③⑩:⑥＝5:3。",
  "new": "①中心角が同じおうぎ形の面積は「半径×半径」に比例する。半径1cm・2cm・3cm・4cmのおうぎ形の面積の比は1:4:9:16。②輪の面積はそのちがいだから、中心に近い方から 1、4−1＝3、9−4＝5、16−9＝7 で①③⑤⑦（奇数のならび）。③斜線部分は③+⑦＝⑩、白い部分は①+⑤＝⑥。④⑩:⑥＝10:6＝5:3。"
 },
 {
  "id": "hd5s_25k1_5",
  "field": "meaning",
  "step": 0,
  "old": "①各部分に面積比を書きこむと、全体は48にあたる。②斜線部分は21、白い部分は48−21＝27。③21:27＝7:9。",
  "new": "①中心角が同じおうぎ形の面積は「半径×半径」に比例する。半径2cm・3cm・4cmで区切ってあるので、内側から輪の面積の比は4:(9−4):(16−9)＝4:5:7。②中心角90度は3等分されているので、どの輪も3つのマスに分かれる。1マスの大きさは内側の輪から順に④・⑤・⑦。全体は(4+5+7)×3＝48。③斜線の4つのマスは④が1つ・⑤が2つ・⑦が1つだから4+5+5+7＝21。白い部分は48−21＝27。④21:27＝7:9。"
 },
 {
  "id": "hd5s_25k1_6",
  "field": "meaning",
  "step": 0,
  "old": "①各部分に面積比を書きこみ、①＝1として比あわせする。②全体（ADを直径とする円）は18、斜線部分は6にあたる。③6÷18＝1/3倍。",
  "new": "①半円の面積は「直径×直径」に比例する。ABを直径とする半円を①とすると、直径の比が1:2:3だから、ACやBDを直径とする半円は④、ADを直径とする半円は⑨。②斜線の上半分は「ACの半円−ABの半円」で④−①＝③。下半分も「BDの半円−CDの半円」で④−①＝③。合わせて⑥。③ADを直径とする円は半円2つ分だから⑨×2＝⑱。④⑥÷⑱＝1/3倍。"
 },
 {
  "id": "hd5s_25k1_7",
  "field": "question",
  "step": 0,
  "old": "対角線10cmの正方形の対角線を半径とする4分円の面積を求めなさい。",
  "new": "図(1)は中心角90°のおうぎ形です。弧の両はしを結んだ点線の長さが10cmのとき、このおうぎ形の面積を求めなさい。"
 },
 {
  "id": "hd5s_25k1_7",
  "field": "meaning",
  "step": 0,
  "old": "①正方形の面積＝対角線×対角線÷2なので、半径×半径＝10×10÷2＝50。②半径そのものを求めなくても、この50をそのまま使って、50×3.14×1/4＝39.25cm²。",
  "new": "①半径を1辺とする正方形をかくと、その対角線が点線の10cmにあたる。正方形の面積＝対角線×対角線÷2だから、半径×半径＝10×10÷2＝50。②半径そのものは求まらないが、この50をそのまま使って、おうぎ形の面積は50×3.14×1/4＝39.25cm²。"
 },
 {
  "id": "hd5s_25k1_7",
  "field": "question",
  "step": 1,
  "old": "対角線16cmの正方形の対角線を半径とする4分円の面積を求めなさい。",
  "new": "図(2)も中心角90°のおうぎ形です。弧の両はしを結んだ点線の長さが16cmのとき、このおうぎ形の面積を求めなさい。"
 },
 {
  "id": "hd5s_25k1_7",
  "field": "meaning",
  "step": 1,
  "old": "①半径×半径＝16×16÷2＝128。②128×3.14×1/4＝100.48cm²。",
  "new": "①(1)と同じで、半径×半径＝16×16÷2＝128。②128×3.14×1/4＝100.48cm²。"
 },
 {
  "id": "hd5s_25k1_8",
  "field": "question",
  "step": 0,
  "old": "対角線12cmの正方形ABCDと、その正方形にちょうど外接する円があります。斜線部分（円から正方形を除いた部分）の面積を求めなさい。",
  "new": "図(1)は、1辺が12cmの正方形ABCDと、その4つの頂点を通る円を重ねたものです。斜線部分（円から正方形をのぞいた部分）の面積を求めなさい。"
 },
 {
  "id": "hd5s_25k1_8",
  "field": "meaning",
  "step": 0,
  "old": "①半径×半径＝12×12÷2＝72（半径そのものを出さず、この値をそのまま使う）。②円の面積72×3.14＝226.08cm²から、対角線12cmの正方形の面積12×12÷2＝72cm²ではなく、72×3.14−12×12を計算すると82.08cm²になる（原簿の解法の数値をそのまま計算）。",
  "new": "①円の中心をOとすると、OAもOBも半径で、角AOBは90度。半径を1辺とする正方形を考えると、その対角線がAB＝12cmにあたる。だから半径×半径＝12×12÷2＝72。②円の面積は72×3.14＝226.08cm²。③正方形ABCDの面積は12×12＝144cm²。④226.08−144＝82.08cm²。"
 },
 {
  "id": "hd5s_25k1_8",
  "field": "question",
  "step": 1,
  "old": "一辺8cmの正方形と、その正方形にちょうど内接する円（直径8cm）があります。斜線部分（正方形から円を除いた部分）の面積を求めなさい。",
  "new": "図(2)は、対角線が8cmの正方形ABCDと、その4つの辺にちょうど接する円を重ねたものです。斜線部分（正方形から円をのぞいた部分）の面積を求めなさい。"
 },
 {
  "id": "hd5s_25k1_8",
  "field": "meaning",
  "step": 1,
  "old": "①半径×半径＝4×4÷2＝8（半径そのものを出さず、この値をそのまま使う）。②8×8÷2−8×3.14を計算すると6.88cm²になる（原簿の解法の数値をそのまま計算）。",
  "new": "①正方形の面積は対角線×対角線÷2＝8×8÷2＝32cm²。②円の中心Oから正方形の頂点までは対角線の半分で8÷2＝4cm。Oからとなり合う2つの辺までの半径2本とその頂点でできる四角形は、1辺が半径の正方形で、対角線が4cm。だから半径×半径＝4×4÷2＝8。③円の面積は8×3.14＝25.12cm²。④32−25.12＝6.88cm²。"
 },
 {
  "id": "hd5s_25k1_9",
  "field": "meaning",
  "step": 0,
  "old": "①底辺20cmの直角二等辺三角形から、半径×半径＝10×10÷2＝50が求まる。②おうぎ形の面積は50×3.14×1/4＝39.25cm²。③直角二等辺三角形の面積10×10÷2＝50cm²を足すと、89.25cm²。",
  "new": "①おうぎ形の中心は底辺のまん中なので、中心から底辺の両はしまではどちらも20÷2＝10cm。②この10cmを斜辺とする直角二等辺三角形ができていて、等しい2辺の長さはおうぎ形の半径と同じ。半径を1辺とする正方形の対角線が10cmにあたるので、半径×半径＝10×10÷2＝50。③おうぎ形の面積は50×3.14×1/4＝39.25cm²。④直角二等辺三角形は、斜辺10cmに対する高さが10÷2＝5cmだから1つ10×5÷2＝25cm²。2つで50cm²。⑤39.25+50＝89.25cm²。"
 }
]
""")


# ────────────────────────────────────────────────────────────────
#  図SVGの検算（入れる前に、図の座標から答えを組み立て直す）
# ────────────────────────────────────────────────────────────────
def _circles(svg):
    return [(float(a), float(b)) for a, b in
            re.findall(r'<circle cx="([-0-9.]+)" cy="([-0-9.]+)"', svg)]


def check_hari(svg, answer):
    """HG-3778 4×4×4に針12本。図の●から針を組み立て、通っていない立方体を数える。"""
    OX, OY, C, DX, DY = 40.0, 80.0, 30.0, 22.0, -16.0
    F = [(3, 0), (2, 1), (1, 2), (0, 3)]        # 正面（列, 段）
    T = [(1, 1), (2, 1), (1, 2), (2, 2)]        # 真上（列, 奥）
    S = [(0, 0), (1, 1), (2, 2), (3, 3)]        # 横  （段, 奥）
    exp = [(OX + C * (i + .5), OY + C * (r + .5)) for i, r in F]
    exp += [(OX + C * (i + .5) + DX * (j + .5), OY + DY * (j + .5)) for i, j in T]
    exp += [(OX + C * 4 + DX * (j + .5), OY + C * (r + .5) + DY * (j + .5)) for r, j in S]
    got = _circles(svg)
    assert len(got) == 12, u"●が12個ない: %d個" % len(got)
    key = lambda p: (round(p[0], 3), round(p[1], 3))
    assert sorted(map(key, got)) == sorted(map(key, exp)), u"●の位置が計算と合わない"
    hit = set()
    for i, r in F:
        for y in range(4):
            hit.add((i, y, r))
    for i, j in T:
        for z in range(4):
            hit.add((i, j, z))
    for r, j in S:
        for x in range(4):
            hit.add((x, j, r))
    per = [16 - sum(1 for c in hit if c[2] == z) for z in range(4)]
    nokori = 64 - len(hit)
    assert per == [5, 8, 8, 5], u"段ごとの数が解答冊子と合わない: %s" % per
    assert str(nokori) == answer, u"通っていない数%dが答え%sと合わない" % (nokori, answer)
    return u"針の通っていない立方体 %d個（上から %s）" % (nokori, per)


def check_saikoro(svg):
    """HG-3779 図1の展開図。6面そろっているか／向かい合う面の和が7かを確かめる。"""
    faces = {}
    pat = r'<rect x="([-0-9.]+)" y="([-0-9.]+)" width="36"[^>]*/>((?:<circle[^>]*/>)*)'
    for m in re.finditer(pat, svg):
        gx = int(round((float(m.group(1)) - 39) / 36))
        gy = int(round((float(m.group(2)) - 40) / 36))
        faces[(gx, gy)] = m.group(3).count("<circle")
    assert len(faces) == 6, u"展開図の面が6つない: %d" % len(faces)
    assert sorted(faces.values()) == [1, 2, 3, 4, 5, 6], u"1から6が1回ずつ出ない: %s" % sorted(faces.values())
    pairs = []
    for (cx, cy), n in faces.items():
        for dx, dy in ((2, 0), (0, 2)):
            if (cx + dx, cy + dy) in faces:
                pairs.append((n, faces[(cx + dx, cy + dy)]))
    assert len(pairs) == 3, u"向かい合う組が3つにならない: %s" % pairs
    for a, b in pairs:
        assert a + b == 7, u"向かい合う面の和が7でない: %d+%d" % (a, b)
    return u"展開図6面・向かい合う和は " + " / ".join("%d+%d" % p for p in pairs)


def check_chokuhoutai(svg, answer):
    """HG-3781 直方体。分割数から小面・辺・点を出し、頂点記号の位置も見る。"""
    FX, FY, W, H, PX, PY = 70.0, 75.0, 180.0, 55.0, 50.0, -35.0
    NW, NH, ND = 3, 2, 4
    men = 2 * (NW * ND + NW * NH + NH * ND)
    hen = 4 * men // 2
    ten = hen + 2 - men
    ten2 = (NW + 1) * (ND + 1) * (NH + 1) - (NW - 1) * (ND - 1) * (NH - 1)
    assert (men, hen, ten) == (52, 104, 54), (men, hen, ten)
    assert ten2 == ten, u"点の数を別のやり方で出すと合わない: %d / %d" % (ten2, ten)
    for s in ("52", "104", "54"):
        assert s in answer, u"答えに %s が無い: %s" % (s, answer)
    V = {"A": (FX, FY), "B": (FX + W, FY), "C": (FX + W + PX, FY + PY), "D": (FX + PX, FY + PY),
         "E": (FX, FY + H), "F": (FX + W, FY + H),
         "G": (FX + W + PX, FY + H + PY), "H": (FX + PX, FY + H + PY)}
    lab = {}
    for m in re.finditer(r'<text x="([-0-9.]+)" y="([-0-9.]+)"[^>]*>([A-H])</text>', svg):
        lab[m.group(3)] = (float(m.group(1)), float(m.group(2)))
    assert sorted(lab) == list("ABCDEFGH"), u"頂点記号がそろっていない: %s" % sorted(lab)
    for k in "ACDEFGH":
        dx, dy = lab[k][0] - V[k][0], lab[k][1] - V[k][1]
        assert dx * dx + dy * dy <= 22 * 22, u"頂点記号%sが頂点から遠い: %s" % (k, lab[k])
    lead = re.findall(r'stroke="#9aa3c0" stroke-width="1.0"', svg)
    assert lead, u"Bの引き出し線が無い"
    m = re.search(r'<line x1="[-0-9.]+" y1="[-0-9.]+" x2="([-0-9.]+)" y2="([-0-9.]+)" stroke="#9aa3c0" stroke-width="1.0"/>', svg)
    assert m, u"Bの引き出し線が読めない"
    bx, by = float(m.group(1)), float(m.group(2))
    assert (bx - V["B"][0]) ** 2 + (by - V["B"][1]) ** 2 <= 100, u"Bの引き出し線が頂点を指していない"
    return u"小面%d面・辺%d本・点%d個／頂点記号8つとも正しい位置" % (men, hen, ten)


def verify_svg(x, svg):
    i = x.get("id")
    st = (x.get("steps") or [{}])[0]
    if i == "hd5s_30k1_10":
        return check_hari(svg, st.get("answer"))
    if i == "hd5s_30k1_11":
        return check_saikoro(svg)
    if i == "hd5s_30k1_13":
        return check_chokuhoutai(svg, st.get("answer"))
    raise AssertionError(u"検算のしかたを書いていない図: %s" % i)


# ────────────────────────────────────────────────────────────────
def _fields(x):
    """大問の中の文字列の欄を全部返す（置きかえ元が1つだけかを数えるのに使う）。"""
    out = []
    for k in ("intro", "svg", "title"):
        if isinstance(x.get(k), str):
            out.append(x[k])
    for st in x.get("steps", []):
        for k in ("question", "meaning", "answer"):
            if isinstance(st.get(k), str):
                out.append(st[k])
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    d = json.load(io.open(path, encoding="utf-8"))

    byid = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id"):
            byid.setdefault(x["id"], []).append(x)

    for p in PATCH:                       # 図SVGは入れる前に必ず検算する
        if p["field"] == "svg":
            xs = byid.get(p["id"], [])
            assert len(xs) == 1, u"idが1つに決まらない: %s" % p["id"]
            print(u"  [図の検算] %s … %s" % (p["id"], verify_svg(xs[0], p["new"])))

    changed, done, touched = 0, 0, set()
    for p in PATCH:
        xs = byid.get(p["id"], [])
        assert len(xs) == 1, u"idが1つに決まらない: %s (%d件)" % (p["id"], len(xs))
        x = xs[0]
        box = x if p["step"] is None else x["steps"][p["step"]]
        cur = box.get(p["field"])
        if cur == p["new"]:
            done += 1
            continue
        assert cur == p["old"], u"%s の %s が想定と別物（先に誰かが直した？）" % (p["id"], p["field"])
        n = sum(1 for v in _fields(x) if v == p["old"])
        assert n == 1, u"%s: 置きかえ元とぴったり同じ欄が %d か所ある" % (p["id"], n)
        box[p["field"]] = p["new"]
        changed += 1
        touched.add(p["id"])

    # 元ファイルは末尾に改行が1つある。付けないと無変更でも1バイト差が出る。
    body = json.dumps(d, ensure_ascii=False, indent=1) + chr(10)
    io.open(path, "wb").write(body.encode("utf-8"))
    print(u"直した大問: %d本 / 書きかえた箇所: %d か所 / すでに直っていた箇所: %d か所"
          % (len(touched), changed, done))
    for i in sorted(touched):
        print(u"  - %s" % i)
    if not touched:
        print(u"  （変更なし＝すでに全部あたっている）")


if __name__ == "__main__":
    main()
