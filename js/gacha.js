// ============================================================
// ガチャ図鑑（コイン集め→キャラガチャ→図鑑コンプ）
// ============================================================

// ドット絵の形状ライブラリ（モチーフ別）。ほとんどの形状は y/o/r/d/l/e の6キー役割で統一し、
// gPalette()による自動配色と互換。フラッグシップ級は形状もパレットも専用デザイン。
const G_SHAPE_ANKICARD = [ // 暗記カードちゃん
  '..g......g..',
  '.wwwwwwwwww.',
  '.wewwwwwwew.',
  '.wwwwrrwwww.',
  '.wllllllllw.',
  '.wwwwwwwwww.',
  '..wwwwwwww..',
  '...wwwwww...',
  '....dddd....',
  '............',
];
const G_SHAPE_ANPAN = [ // あんパン
  '..........',
  '..oooooo..',
  '.oooooooo.',
  '.oeooooeo.',
  '.ooommooo.',
  '.oookkooo.',
  'oooooooooo',
  '.oooooooo.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_BANANA = [ // バナ夫
  '...k......',
  '..yyy.....',
  '.yyeyy....',
  '.yyyyy....',
  '.yymmy....',
  '..yyyyy...',
  '...yyyyy..',
  '....yyyyy.',
  '.....yyyy.',
  '......kk..',
];
const G_SHAPE_BUNDOKI = [ // 分度器さん
  '..cccccc..',
  '.cccccccc.',
  '.cecccccec',
  '.cccmmcccc',
  'cmcccccccm',
  'cccccccccc',
  'cmcccccccm',
  'dddddddddd',
  '..........',
  '..........',
];
const G_SHAPE_BUTA = [ // ブータ
  '..d....d..',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.yynnnnyy.',
  '.yynmmnyy.',
  '.yynnnnyy.',
  '.yyyyyyyy.',
  '..yyyyyy..',
  '..dd..dd..',
  '..........',
];
const G_SHAPE_CHOU = [ // チョウ子
  '...k..k...',
  'oo.kkkk.oo',
  'oppkeekppo',
  'opppkkpppo',
  'opppkkpppo',
  'oppokkoppo',
  'oo.okko.oo',
  '...kkkk...',
  '..........',
  '..........',
];
const G_SHAPE_CHUN = [ // チュン
  '..........',
  '...ddd....',
  '..ddddd...',
  '..dedwd...',
  '..dddod...',
  '.ddddddd..',
  '.dyyyyyd..',
  '.dyyyyyddd',
  '..ddddd...',
  '...o.o....',
  '..........',
];
const G_SHAPE_CLIP = [ // クリップ隊長
  '..mmmmm...',
  '.m.....m..',
  'm..mmm..m.',
  'm.m...m.m.',
  'm.m.e.m.m.',
  'm.m...m.m.',
  'm..mmm..m.',
  '.m.....m..',
  '..mmmmm...',
  '..........',
];
const G_SHAPE_COMPASS = [ // コンパス伯爵
  '...oo...',
  '...mm...',
  '..meem..',
  '..mrrm..',
  '..mmmm..',
  '..m..m..',
  '.m....m.',
  '.m....m.',
  'm......m',
  'k......p',
  '........',
  '........',
];
const G_SHAPE_CONE = [ // コーンくん
  '...oo...',
  '..oooo..',
  '.oeooeo.',
  '.oorroo.',
  '.oooooo.',
  '.wwwwww.',
  'oooooooo',
  'oooooooo',
  'wwwwwwww',
  'oooooooo',
  'dddddddd',
  '........',
];
const G_SHAPE_CONEBAR = [ // コーンバー
  '..........',
  '.o......o.',
  '.oo....oo.',
  'wwwwwwwwww',
  'we.wwww.ew',
  'wwwwrrwwww',
  'wwwwwwwwww',
  '.oo....oo.',
  'oooo..oooo',
  '..........',
];
const G_SHAPE_CRAYON = [ // クレヨン兄弟
  'r.b.g.y...',
  'r.b.g.y...',
  'rrbbggyy..',
  'rrbbggyy..',
  'rebegeye..',
  'rrbbggyy..',
  'rrbbggyy..',
  'kkkkkkkk..',
  '..........',
  '..........',
];
const G_SHAPE_CURRY = [ // 給食カレー
  '..........',
  '..wwrrrr..',
  '.wwwwrrrr.',
  '.wwwwrrrr.',
  '.pppppppp.',
  '.pepppppe.',
  '.pppmmppp.',
  '.pppppppp.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_CURRYPAN = [ // カレーパン
  '..........',
  '..oooooo..',
  '.oooooooo.',
  '.oeooooeo.',
  '.ooommooo.',
  '.oorrrooo.',
  'oooooooooo',
  '.oooooooo.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_DANGO = [ // 三色だんご
  '....k.....',
  '...ppp....',
  '..ppppp...',
  '..peppe...',
  '..ppmpp...',
  '...ppp....',
  '...www....',
  '..wwwww...',
  '...www....',
  '...ggg....',
];
const G_SHAPE_DANGOROU = [ // ダンゴロウ
  '..........',
  '...dddd...',
  '..dddddd..',
  '.dddddddd.',
  '.dedddded.',
  '.dhdhdhdh.',
  '.dhdhdhdh.',
  '..dddddd..',
  '...dddd...',
  '..........',
];
const G_SHAPE_DONOU = [ // 土のう君
  '..........',
  '..wwwwww..',
  '.wwwwwwww.',
  '.wewwwwew.',
  '.wwwrrwww.',
  'wwwwwwwwww',
  'wwwwwwwwww',
  '.wwwwwwww.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_EIYO = [ // 栄養士さん
  '..wwwwww..',
  '.wwwwwwww.',
  '.wffffffw.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..wwwwww..',
  '.wwwwwwww.',
  '.wwwrwwww.',
  '.wwwwwwww.',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_ENPITSU = [ // えんぴつ君
  '...kk...',
  '..wwww..',
  '.wwwwww.',
  '.yyyyyy.',
  '.yeyyey.',
  '.yyrryy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.oooooo.',
  '.pppppp.',
  '........',
];
const G_SHAPE_FUSENHIME = [ // ふせん姫
  '............',
  '.yyyyyyyyyy.',
  '.yeyyyyyyey.',
  '.yyyyrryyyy.',
  '.yyyyyyyyyy.',
  '.yyyyyyyyyy.',
  '.yyyyyyyyod.',
  '.ddddddddd..',
  '............',
];
const G_SHAPE_GESSHA = [ // 月謝袋
  '..........',
  '.wwwwwwww.',
  '.w.wwww.w.',
  '.ww.ww.ww.',
  '.wewwwwew.',
  '.wwwmmwww.',
  '.wkkkkkkw.',
  '.wwwwwwww.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_GUNTE = [ // 軍手くん
  '...w..w..w..',
  '...w..w..w..',
  '..wwwwwwww..',
  '.wwwwwwwwww.',
  '.wewwwwwwew.',
  '.wwwwrrwwww.',
  '.wwwwwwwwww.',
  '.rrrrrrrrrr.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_GYUNYU = [ // 牛乳くん
  '...wwww...',
  '..wwwwww..',
  '.wwwwwwww.',
  '.wewwwwew.',
  '.wwwmmwww.',
  '.wbbbbbbw.',
  '.wwwwwwww.',
  '.wwwwwwww.',
  '.dddddddd.',
  '..........',
];
const G_SHAPE_HAMUTA = [ // ハム太
  '..........',
  '.dd....dd.',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  'wyyynnyyyw',
  'wyyymmyyyw',
  '.wyyyyyyw.',
  '..yyyyyy..',
  '..oyyyyo..',
  '...ll.ll..',
  '..........',
];
const G_SHAPE_HASAMI = [ // ハサミ丸
  'm......m..',
  '.mm..mm...',
  '..mmmm....',
  '...mm.....',
  '..emme....',
  '..bmmb....',
  '.bb..bb...',
  'bb....bb..',
  'b......b..',
  '..........',
];
const G_SHAPE_HATSUDENKI = [ // 発電機くん
  '..........',
  '.kkkkkkkk.',
  '.kyyyyyyk.',
  '.kyeyyeyk.',
  '.kyyrryyk.',
  '.kyyyyyyk.',
  '.kwwwwwwk.',
  '.kkkkkkkk.',
  '..dd..dd..',
  '..........',
];
const G_SHAPE_HEBI = [ // ヘビ助
  '..gggggg..',
  '.geggggeg.',
  '.gggrrggg.',
  '.gggggggg.',
  '..gggggg..',
  '.dddddddd.',
  'dgggggggdd',
  'dg.dddd.gd',
  'dgggggggg.',
  '.dddddddd.',
];
const G_SHAPE_HITSUJI = [ // ヒツジ姫
  '.wdwdwdwd.',
  'wdwdwdwdwd',
  '.wffffffw.',
  '.wfeffefw.',
  '.wffmmffw.',
  '.dwwwwwwd.',
  '.wwwwwwww.',
  '.wwwwwwww.',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_JOUGI = [ // じょうぎマン
  '.cccccc.',
  '.ceccec.',
  '.ccrrcc.',
  '.cccccc.',
  '.mccccc.',
  '.mmcccc.',
  '.mccccc.',
  '.mmcccc.',
  '.mccccc.',
  '.mmcccc.',
  '.dddddd.',
  '........',
];
const G_SHAPE_JUKUBAG = [ // 塾バッグ大将
  '...oo..oo...',
  '..o......o..',
  '.bbbbbbbbbb.',
  '.bebbbbbbeb.',
  '.bbbbrrbbbb.',
  '.bbbbbbbbbb.',
  '.bbbbbbbbbb.',
  '.bbbbbbbbbb.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_JUKUBEN = [ // 塾弁くん
  '..........',
  '.bbbbbbbb.',
  '.bebbbbeb.',
  '.bbbmmbbb.',
  '.bbbbbbbb.',
  '.wwrrwwgg.',
  '.wwrrwwgg.',
  '.bbbbbbbb.',
  '.dddddddd.',
  '..........',
];
const G_SHAPE_KABUTOMARU = [ // カブト丸
  '...k..k...',
  '....kk....',
  '..dddddd..',
  '.dddddddd.',
  '.dedddded.',
  '.dddddddd.',
  '.dhhhhhhd.',
  '.dhhhhhhd.',
  '..dddddd..',
  '.l..ll..l.',
  '..........',
];
const G_SHAPE_KAERUNOSUKE = [ // カエル之助
  '..oo..oo..',
  '..oeo.oeo.',
  '.gggggggg.',
  '.gggggggg.',
  '.gmmmmmmg.',
  '.gggggggg.',
  '..gggggg..',
  '.gggggggg.',
  'gg.gggg.gg',
  'gg......gg',
  '..........',
];
const G_SHAPE_KAITOU = [ // 解答用紙
  '..........',
  '.wwwwwwww.',
  '.wewwwwew.',
  '.wwwmmwww.',
  '.wkkkkkkw.',
  '.wkkkkkkw.',
  '.wrrwwwww.',
  '.wwwwwwww.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_KAKOMON = [ // 過去問くん
  '............',
  '.rrrrrrrrrr.',
  '.rerrrrrrer.',
  '.rrrroorrrr.',
  '.rrrrrrrrrr.',
  '.rwwwwwwwwr.',
  '.rrrrrrrrrr.',
  '.wwwwwwwwww.',
  '.wwwwwwwwww.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_KAMEKICHI = [ // カメ吉
  '..........',
  '...dddd...',
  '..dhhhhd..',
  '.dhdhdhhd.',
  'yyhhhhhhd.',
  'yeyhhhhhd.',
  '.ymdddddd.',
  '.ll....ll.',
  '..........',
];
const G_SHAPE_KARAAGE = [ // から揚げ大将
  '..o..o....',
  '..oooooo..',
  '.odooodoo.',
  '.oeooooeo.',
  '.ooommooo.',
  'odooooodoo',
  '.oooooooo.',
  '..oodooo..',
  '..........',
  '..........',
];
const G_SHAPE_KEIKOUPEN = [ // 蛍光ペン
  '...kk.....',
  '..gggg....',
  '.gggggg...',
  '.geggeg...',
  '.ggmmgg...',
  '.gggggg...',
  '.gggggg...',
  '.gggggg...',
  '.dddddd...',
  '..........',
];
const G_SHAPE_KESHIGOMU = [ // 消しゴムくん
  '............',
  '.wwwwwwwwww.',
  '.wewwwwwwew.',
  '.wwwwrrwwww.',
  '.wwwwwwwwww.',
  '.cccccccccc.',
  '.cccccccccc.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_KESHIKASU = [ // 消しカス丸
  '..........',
  '..w.w.w...',
  '.wwwwwwww.',
  '.wewwwwew.',
  '.wwwmmwww.',
  '.wwwwwwww.',
  '..wwwwww..',
  '.w.wwww.w.',
  '..........',
];
const G_SHAPE_KEZURI = [ // えんぴつ削り
  '..........',
  '..kkkkkk..',
  '.kkkkkkkk.',
  '.kekkkkek.',
  '.kkkmmkkk.',
  '.kkkkkkkk.',
  '.kkwwwwkk.',
  '.kkkkkkkk.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_KINGYOHIME = [ // 金魚姫
  '....oo....',
  'dd.yyyyyy.',
  'd.yyyyyye.',
  'dd.yyyyyy.',
  '....oo....',
  '..........',
];
const G_SHAPE_KOTSU = [ // 交通指導員
  '..bbbbbb..',
  '.bbbbbbbb.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  'yy.cccccc.',
  'yy.cccccc.',
  'y..cccccc.',
  '...cccccc.',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_MEZAMASHI = [ // 目覚まし時計
  '..b....b..',
  '.bbb..bbb.',
  '..wwwwww..',
  '.wwwwwwww.',
  '.wewwwwew.',
  '.wwwkkwww.',
  '.wwwmmwww.',
  '.wwwwwwww.',
  '..dd..dd..',
  '..........',
];
const G_SHAPE_MIKAN = [ // みかん坊や
  '....k.....',
  '...ggg....',
  '..oooooo..',
  '.oooooooo.',
  '.oeooooeo.',
  '.ooommooo.',
  'oooooooooo',
  '.oooooooo.',
  '..oooooo..',
  '..........',
];
const G_SHAPE_MONDAISHU = [ // 問題集ロード
  '..bbbbbb..',
  '.bebbbbeb.',
  '.bbbmmbbb.',
  '.bbbbbbbb.',
  '.rrrrrrrr.',
  '.rrrrrrrr.',
  '.gggggggg.',
  '.gggggggg.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_NEKOGURUMA = [ // ネコ車
  '..........',
  '.tttttttt.',
  'tttttttttt',
  '.tetttet..',
  '.ttrrtt...',
  '.tttttt...',
  '..k....k..',
  '.ooo...k..',
  '.ooo......',
  '..........',
];
const G_SHAPE_NORI = [ // のりスティック
  '..wwww....',
  '..wwww....',
  '.yyyyyy...',
  '.yeyyey...',
  '.yymmyy...',
  '.yyyyyy...',
  '.cccccc...',
  '.cccccc...',
  '.cccccc...',
  '..........',
];
const G_SHAPE_NOTESHI = [ // ノート氏
  '............',
  '.cwwwwwwwww.',
  '.cwewwwwwew.',
  '.cwwwwrrwww.',
  '.cwllllllll.',
  '.cwllllllll.',
  '.cwllllllll.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_NYANKICHI = [ // ニャン吉
  '.d......d.',
  '.dd....dd.',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  'wyyynnyyyw',
  '.yyymmyyy.',
  '.yyyyyyyy.',
  '..yyyyyy..',
  '.dyyyyyyd.',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_OCHA = [ // お茶っ子
  '..........',
  'cwwwwwwwwc',
  'cwggggggwc',
  'cwgeggegwc',
  'cwggmmggwc',
  '.wggggggw.',
  '.wwwwwwww.',
  '..wwwwww..',
  '..dddddd..',
  '..........',
];
const G_SHAPE_ONGAKU = [ // 音楽のせんせい
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '.ncccccc..',
  'nncccccc..',
  '..cccccc..',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_ONIGIRI = [ // おにぎり侍
  '....ww....',
  '...wwww...',
  '..wwwwww..',
  '.wewwwwew.',
  '.wwwmmwww.',
  'wwwwwwwwww',
  'kkkkkkkkkk',
  'kkkkkkkkkk',
  '..........',
  '..........',
];
const G_SHAPE_PENGUIN = [ // ペンギン先輩
  '..kkkkkk..',
  '.kkkkkkkk.',
  '.kkewwekk.',
  '.kkwoowkk.',
  '.kwwwwwwk.',
  'kkwwwwwwkk',
  'kkwwwwwwkk',
  '.kwwwwwwk.',
  '..oo..oo..',
  '..........',
];
const G_SHAPE_PIYO = [ // ピヨ太
  '..........',
  '..........',
  '...yyyy...',
  '..yyyyyy..',
  '..yeyyey..',
  '..yyooyy..',
  '.yyyyyyyy.',
  '.yyyyyyyy.',
  '..yyyyyy..',
  '...o..o...',
  '..........',
];
const G_SHAPE_PONKICHI = [ // ぽん吉
  '..d....d..',
  '.dddddddd.',
  '.yyyyyyyy.',
  '.kkkyykkk.',
  '.keyyyyek.',
  '.yyynnyyy.',
  '.yyymmyyy.',
  '.yyyyyyyy.',
  'tyyyyyyyy.',
  '.tll..ll..',
  '..........',
];
const G_SHAPE_RANDOSERU = [ // ランドセルさん
  '..bb....bb..',
  '..bb....bb..',
  '.rrrrrrrrrr.',
  '.rerrrrrrer.',
  '.rrrrddrrrr.',
  '.rrrrrrrrrr.',
  '.rrrrggrrrr.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_RECORDER = [ // リコーダーくん
  '..oooo..',
  '..oooo..',
  '.wwwwww.',
  '.wewwew.',
  '.wwrrww.',
  '.wwkkww.',
  '.wwwwww.',
  '.wwkkww.',
  '.wwwwww.',
  '.wwkkww.',
  '.dddddd.',
  '........',
];
const G_SHAPE_RISU = [ // リス吉
  '..d....d..',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.yyynnyyy.',
  '.yyymmyyy.',
  'tyyyyyyyy.',
  'ttyyyyyy..',
  'tt.dddd...',
  '...dd.dd..',
  '..........',
];
const G_SHAPE_SANKAKU = [ // 三角定規
  '....cc....',
  '...cccc...',
  '...ccccc..',
  '..cceccc..',
  '..ccccecc.',
  '.ccmmcccc.',
  '.cccccccc.',
  'cccccccccc',
  'dddddddddd',
  '..........',
];
const G_SHAPE_SCOOP = [ // スコップくん
  '..dddd..',
  '..d..d..',
  '...dd...',
  '...dd...',
  '...dd...',
  '..ssss..',
  '.sesses.',
  '.ssrrss.',
  '.ssssss.',
  '..ssss..',
  '...ss...',
  '........',
];
const G_SHAPE_SHARPBUSHI = [ // シャーペン侍
  '...kk...',
  '..mmmm..',
  '.mmmmmm.',
  '.rrrrrr.',
  '.bebbeb.',
  '.bbrrbb.',
  '.bbbbbb.',
  '.bcbbbb.',
  '.bcbbbb.',
  '.bbbbbb.',
  '.dddddd.',
  '........',
];
const G_SHAPE_SHITAJIKI = [ // 下じきさん
  '............',
  'cccccccccccc',
  'ceccccccccec',
  'cccccooccccc',
  'cccccccccccc',
  'cccccccccccc',
  'dddddddddddd',
  '............',
];
const G_SHAPE_SHUKUDAI = [ // 宿題プリント
  '............',
  '.wwwwwwwwww.',
  '.wewwwwwwew.',
  '.wwwwrrwwww.',
  '.wllllllrlw.',
  '.wllllllllw.',
  '.wwwwwwwwww.',
  '.dwwwwwwwwd.',
  '..dddddddd..',
  '............',
];
const G_SHAPE_TAIIKU = [ // 体育のせんせい
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.wcccccccw',
  '.wcccccccw',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_TAMAGOYAKI = [ // たまごやき
  '..........',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.yyymmyyy.',
  '.yoyoyoyo.',
  '.yyyyyyyy.',
  '.yoyoyoyo.',
  '.yyyyyyyy.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_TAPE = [ // セロテープ王
  '..cccccc..',
  '.cccccccc.',
  '.ccwwwwcc.',
  '.cwe..ewc.',
  '.cw.mm.wc.',
  '.ccwwwwcc.',
  '.cccccccc.',
  '..cccccc..',
  '.dddddddd.',
  '..........',
];
const G_SHAPE_TARP = [ // ブルーシート
  '..........',
  '.bbbbbbbb.',
  'bbbbbbbbbb',
  'bbebbbbebb',
  'bbbbrrbbbb',
  'bbbbbbbbbb',
  'bbbbbbbbbb',
  '.bbbbbbbb.',
  '..b....b..',
  '..........',
];
const G_SHAPE_TEKKIN = [ // 鉄筋タワー
  '..........',
  '..........',
  'kkkkkkkkkk',
  'k.k.k.k.k.',
  'kkkkkkkkkk',
  'kek.k.kek.',
  'kkkkkkkkkk',
  'k.k.krk.k.',
  'kkkkkkkkkk',
  '..........',
];
const G_SHAPE_TENTOU = [ // テントウ丸
  '..kkkkkk..',
  '.kkwwwwkk.',
  '.kwekkewk.',
  '.rrrrkrrr.',
  'rrkrrkrrkr',
  'rrrrrkrrrr',
  'rkrrrrrkrr',
  '.rrrrkrrr.',
  '..rrrrrr..',
  '..........',
];
const G_SHAPE_TIMER = [ // タイマーくん
  '...kk...',
  '..wwww..',
  '.wwwwww.',
  '.wewwew.',
  '.wwrrww.',
  '.wwwwww.',
  '.wkwwkw.',
  '.wwwkww.',
  '.wwwwww.',
  '..wwww..',
  '.dddddd.',
  '........',
];
const G_SHAPE_USAGI = [ // ウサ子
  '..d....d..',
  '..d....d..',
  '.dd....dd.',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.yyynnyyy.',
  '.yyymmyyy.',
  '..yyyyyy..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_WANZOU = [ // ワン蔵
  '..........',
  'dd......dd',
  'dyyyyyyyyd',
  'dyeyyyyeyd',
  'dyyynnyyyd',
  '.yyymmyyy.',
  '.yyyyyyyy.',
  '..yyyyyy..',
  '.byyyyyyb.',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_YOMU = [ // 用務員さん
  '..bbbbbb..',
  '.bbbbbbbb.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  's.cccccc..',
  's.cccccc..',
  's.cccccc..',
  's.cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_ZABUTON = [ // 座布団マスター
  '..........',
  '..........',
  '..rrrrrr..',
  '.rrrrrrrr.',
  'rrerrrrerr',
  'rrrrmmrrrr',
  'rrrrrrrrrr',
  '.rrrrrrrr.',
  '..dddddd..',
  '..........',
];
const G_SHAPE_ANZENTAI = [ // 安全帯マン
  '..........',
  'hhhhhhhhhh',
  'h.kkkkkk.h',
  'h.kekkek.h',
  'h.kkrrkk.h',
  'h.kkkkkk.h',
  'hhhhhhhhhh',
  '..m....m..',
  '.mm....mm.',
  '..........',
];
const G_SHAPE_BUS = [ // 送迎バスの運転手
  '..bbbbbb..',
  '.bbbbbbbb.',
  'bbbbbbbbbb',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cccccccc.',
  'w.cccccc.w',
  'ww.cccc.ww',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_CHIKYUGI = [ // 地球儀先生
  '....k.....',
  '..bbbbbb..',
  '.bbggbbgb.',
  '.bgbbggbb.',
  '.begbbgeb.',
  '.bbgmmgbb.',
  '.bbggbbgb.',
  '..bbbbbb..',
  '...kkkk...',
  '..........',
];
const G_SHAPE_COACH = [ // コーチ
  '..bbbbbb..',
  '.bbbbbbbb.',
  '.bbbbbbbbb',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..ccwccc..',
  '.cccccccc.',
  '.cccccccc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_DENTAKU = [ // 電卓マン
  '..kkkkkk..',
  '.kkkkkkkk.',
  '.kwwwwwwk.',
  '.kwewwewk.',
  '.kwwmmwwk.',
  '.kbbbbbbk.',
  '.kbbbbbbk.',
  '.kbbbbbbk.',
  '..kkkkkk..',
  '..........',
];
const G_SHAPE_DUMP = [ // ダンプ姫
  '............',
  '.....ttttttt',
  '.....ttttttt',
  '.yyyy.ttttt.',
  '.yeyy.ttttt.',
  '.yyry.ttttt.',
  '.yyyyyyyyyy.',
  '.kkkkkkkkkk.',
  '..oo....oo..',
  '............',
];
const G_SHAPE_ENOGU = [ // 絵の具パレット
  '..wwwwww..',
  '.wwwwwwww.',
  '.wrwbwgwy.',
  '.wwwwwwww.',
  '.weywwyew.',
  '.wwwwwwww.',
  '.wwwwwwww.',
  '..wwwwww..',
  '..........',
  '..........',
];
const G_SHAPE_FORK = [ // フォークン
  '..mm........',
  '..mm........',
  '..mm.yyyy...',
  '..mm.yeyy...',
  '..mm.yyry...',
  '..mm.yyyy...',
  'ffmmyyyyyy..',
  'ffmmkkkkkk..',
  '..oo..oo....',
  '............',
];
const G_SHAPE_FUDE = [ // 筆ノ介
  '....k.....',
  '...kkk....',
  '...kkk....',
  '...yyy....',
  '..dddddd..',
  '..deddedd.',
  '..ddmmddd.',
  '..dddddd..',
  '..dddddd..',
  '..........',
];
const G_SHAPE_FUKUROU = [ // フクロウ博士
  '.d......d.',
  '.dddddddd.',
  '.dwwddwwd.',
  '.dweddewd.',
  '.dddoodddd',
  '.dddddddd.',
  '.ddyyyydd.',
  '..dddddd..',
  '...o..o...',
  '..........',
];
const G_SHAPE_GUARD = [ // 警備員さん
  '...cccccc...',
  '..cccccccc..',
  '.cccccccccc.',
  '..cffffffc..',
  '..cfeffefc..',
  '..cffbbffc..',
  '...ffffff...',
  '..vvvvvvvv..',
  '..vvssssvv..',
  '..vvvvvvvv..',
  'g..pppppp...',
  'g..pp..pp...',
  '............',
];
const G_SHAPE_HACHIMAKI = [ // 合格はちまき
  '..........',
  '.wwwwwwww.',
  '.wwrrrrww.',
  '.wrrrrrrw.',
  '.werrrrew.',
  '.wwrmmrww.',
  '.wwwwwwww.',
  'ww......ww',
  'w........w',
  '..........',
];
const G_SHAPE_HELMET = [ // ヘル男
  '....oooo....',
  '..oooooooo..',
  '.oooooooooo.',
  '.oeooooooeo.',
  '.oooorroooo.',
  '.oooooooooo.',
  'dooooooooood',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_HENSACHI = [ // 偏差値くん
  '...gg...',
  '..gggg..',
  '.gggggg.',
  '...gg...',
  '...gg...',
  '.yyyyyy.',
  '.yeyyey.',
  '.yyrryy.',
  '.yyyyyy.',
  '.dddddd.',
  '........',
  '........',
];
const G_SHAPE_HOGOSHA = [ // 保護者会長
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.ccrccccc.',
  '.cccccccc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_HOKEN = [ // ほけん室のせんせい
  '...wwww...',
  '..wwrrww..',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..wwwwww..',
  '.wwwrwwww.',
  '.wwwwwwww.',
  '..wwwwww..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_HOTCHKISS = [ // ホチキス番長
  '..kkkkkkk.',
  '.kkkkkkkk.',
  '.kekkkekk.',
  '.kkrrkkkk.',
  '.mmmmmmmm.',
  '..kkkkkkk.',
  '..mmmmmmm.',
  '..........',
  '..........',
  '..........',
];
const G_SHAPE_JISHO = [ // 辞書ハカセ
  '............',
  '.oooooooooo.',
  '.oeooooooeo.',
  '.oooorroooo.',
  '.oooooooooo.',
  '.oooooooooo.',
  '.wwwwwwwwww.',
  '.wwwwwwwwww.',
  '.wwwwwwwwww.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_JISHU = [ // 自習室のヌシ
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffnffnff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cccccccc.',
  '.bbbbbbbb.',
  '.aaaaaaaa.',
  '.bbbbbbbb.',
  '..........',
  '..........',
];
const G_SHAPE_JUKUCHO = [ // 塾長せんせい
  '..hhhhhh..',
  '.rrrrrrrr.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '.fccccccf.',
  '.fccccccf.',
  '..cccccc..',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_KANI = [ // カニ将軍
  'dd......dd',
  'drd....drd',
  'dd.rrrr.dd',
  '..rrrrrr..',
  '.rweerrwr.',
  '.rrrrrrrr.',
  '..rrrrrr..',
  '.d.d..d.d.',
  'd.d....d.d',
  '..........',
];
const G_SHAPE_KATSU = [ // カツ丸
  '..........',
  '..oooooo..',
  '.oooooooo.',
  '.oeooooeo.',
  '.ooommooo.',
  '.oooooooo.',
  '.wwwwwwww.',
  '..oooooo..',
  '..........',
  '..........',
];
const G_SHAPE_KEISAN_ONI = [ // 計算テストの鬼
  '.k......k.',
  '.kkhhhhkk.',
  '.hffffffh.',
  '.ffeffeff.',
  '.ffwmmwff.',
  '..ffffff..',
  's.cccccc..',
  '.cccccccc.',
  '.cccccccc.',
  '..cccccc..',
  '..pp..pp..',
  '..bb..bb..',
  '..........',
];
const G_SHAPE_KINJIRO = [ // 金次郎ぞう
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  'w.ffffff..',
  'ww.cccccc.',
  'ww.cccccc.',
  'w.cbbbbcc.',
  '..cbbbbcc.',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_KITSUNE = [ // キツネ丸
  '.d......d.',
  '.dd....dd.',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.ywwnnwwy.',
  '.yyymmyyy.',
  'dyyyyyyyy.',
  'd.yyyyyy..',
  'd..dd.dd..',
  '..........',
];
const G_SHAPE_KOCHO = [ // 校長せんせい
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.geffffeg.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cccttccc.',
  '.cccttccc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_KOUSHO = [ // 高所作業車
  '.bbb......',
  '.bbb......',
  '..a.......',
  '...a......',
  '....a.....',
  '.yyyyya...',
  '.yeyyy....',
  '.yyryy....',
  'kkkkkkkk..',
  '.oo..oo...',
];
const G_SHAPE_KUMA = [ // クマ蔵
  '.dd....dd.',
  '.dd....dd.',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.ywwnnwwy.',
  '.yywmmwyy.',
  '.yyyyyyyy.',
  '.yyyyyyyy.',
  '..dd..dd..',
  '..........',
];
const G_SHAPE_KYOTO = [ // 教頭せんせい
  '..hhhhhh..',
  '.hhhhhhhf.',
  '.hffffffh.',
  '.geffffeg.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cccttccc.',
  '.cccccccc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_KYUSHOKU = [ // 給食のおばちゃん
  '..wwwwww..',
  '.wwwwwwww.',
  '.wffffffw.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..wwwwww..',
  '.wwwwwwww.',
  's.wwwwww..',
  's.wwwwww..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_LEVEL = [ // 水準器さん
  '..........',
  'kkkkkkkkkk',
  'kwwwwwwwwk',
  'kweggggewk',
  'kwwwrrwwwk',
  'kwwwwwwwwk',
  'kkkkkkkkkk',
  '..........',
  '..........',
  '..........',
];
const G_SHAPE_MIXER = [ // ミキちゃん
  '............',
  '.....mmmmm..',
  '....mwmwmwm.',
  '.yyy.mwmwmwm',
  '.yeyy.mmmmm.',
  '.yyry.mmmmm.',
  '.yyyyyyyyyy.',
  '.kkkkkkkkkk.',
  '..oo....oo..',
  '............',
];
const G_SHAPE_MOGI_FUUTOU = [ // 模試の封筒
  '..........',
  '.wwwwwwww.',
  '.wwwwwwww.',
  '.w.wwww.w.',
  '.ww.ww.ww.',
  '.wewwwwew.',
  '.wwwmmwww.',
  '.rrrrrrrr.',
  '.wwwwwwww.',
  '..dddddd..',
];
const G_SHAPE_MOSHI = [ // 模試判定マン
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  'ww.cccccc.',
  'wa.cccccc.',
  'ww.cccccc.',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_NENPYO = [ // 年表の巻物
  '..........',
  'dwwwwwwwwd',
  'dwewwwwewd',
  'dwwwmmwwwd',
  'dwkkkkkkwd',
  'dwwwwwwwwd',
  'dwkkkkkkwd',
  'dwwwwwwwwd',
  '..........',
  '..........',
];
const G_SHAPE_PURIN = [ // プリンちゃん
  '..........',
  '...cccc...',
  '..cccccc..',
  '.yyyyyyyy.',
  '.yeyyyyey.',
  '.yyymmyyy.',
  'yyyyyyyyyy',
  'yyyyyyyyyy',
  '.dddddddd.',
  '..........',
];
const G_SHAPE_RAMMER = [ // 転圧ランマー
  '...hh.....',
  '..h..h....',
  '..yyyy....',
  '..yeyy....',
  '..yyry....',
  '..yyyy....',
  '..kkkk....',
  '.kkkkkk...',
  '.kkkkkk...',
  '..........',
];
const G_SHAPE_RAMUNE = [ // ラムネびん
  '...bb.....',
  '...bb.....',
  '..cccc....',
  '.cccccc...',
  '.ceccec...',
  '.ccmmcc...',
  '.cccccc...',
  '.cccccc...',
  '.cccccc...',
  '..dddd....',
];
const G_SHAPE_RIKA = [ // 理科のせんせい
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.geffffeg.',
  '.fffmmfff.',
  '..ffffff..',
  '..wwwwww..',
  '.bwwwwwww.',
  'bbwwwwwww.',
  '..wwwwww..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_ROLLER = [ // ローラー丸
  '............',
  '...yyyyyy...',
  '...yeyyey...',
  '...yyrryy...',
  '..yyyyyyyy..',
  '..kkkkkkkk..',
  '.mmmmmmmmmm.',
  '.mwwmmmmwwm.',
  '.mmmmmmmmmm.',
  '............',
];
const G_SHAPE_SHISHO = [ // 図書館の司書
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.geffffeg.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cbbbbbbc.',
  '.cbbbbbbc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_SHODO = [ // 書道のせんせい
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  'b.cccccc..',
  'b.ccrrcc..',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_SHOVEL = [ // ショベルくん
  '.......aa...',
  '......aa....',
  '.yyyyaa.....',
  '.yeyya......',
  '.yyrya..bbb.',
  '.yyyyy..bbb.',
  'kkkkkkkkkkkk',
  '.o.o.o.o.o..',
  'kkkkkkkkkkkk',
  '............',
];
const G_SHAPE_SHUSEITAPE = [ // 修正テープ
  '..bbbbbb..',
  '.bbbbbbbb.',
  '.bwwwwwwb.',
  '.bwewwewb.',
  '.bwwmmwwb.',
  '.bwwwwwwb.',
  '.bbbbbbbb.',
  'wwwwwwwwww',
  'dddddddddd',
  '..........',
];
const G_SHAPE_SOROBAN = [ // そろばん仙人
  '............',
  'dddddddddddd',
  'dyyyyyyyyyyd',
  'dyeyyyyyyeyd',
  'dddddddddddd',
  'dyoyoyoyoyod',
  'dyoyoyoyoyod',
  'dyyyyrryyyyd',
  'dddddddddddd',
  '............',
];
const G_SHAPE_TAKO = [ // タコ八
  '..rrrrrr..',
  '.rrrrrrrr.',
  '.rweerrwr.',
  '.rrrmmrrr.',
  '.rrrrrrrr.',
  'drdrdrdrdr',
  'd.d.d.d.d.',
  'd.d.d.d.d.',
  '..........',
  '..........',
];
const G_SHAPE_TOBIBAKO = [ // とび箱マスター
  '............',
  '...oooooo...',
  '..oeooooeo..',
  '..oooorroo..',
  '.dddddddddd.',
  '.oooooooooo.',
  '.dddddddddd.',
  'oooooooooooo',
  'dddddddddddd',
  '............',
];
const G_SHAPE_TSURUHASHI = [ // つるはし兄貴
  'm........m',
  '.mm....mm.',
  '.memmmmem.',
  '..mmrrmm..',
  '....dd....',
  '....dd....',
  '....dd....',
  '....dd....',
  '....dd....',
  '..........',
];
const G_SHAPE_TUTOR = [ // チューターお姉さん
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.hfeffefh.',
  '.hffmmffh.',
  '.hffffffh.',
  '.hcccccch.',
  '.hcccccch.',
  'bhcccccch.',
  'b.cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_A_HANTEI = [ // A判定の女神
  '.....gg.....',
  '...gg..gg...',
  '..hhhhhhhh..',
  '..hffffffh..',
  '..hfeffefh..',
  '..hffffffh..',
  '..hhhhhhhh..',
  '...rrrrrr...',
  '..rrryyrrr..',
  '..rryyyyrr..',
  '..rrrrrrrr..',
  '...rr..rr...',
  '............',
  '............',
];
const G_SHAPE_AKAPEN = [ // 赤ペン先生
  '...mm...',
  '..oooo..',
  '.oooooo.',
  '.yeyyey.',
  '.yyrryy.',
  '.yyyyyy.',
  '.yyyyyy.',
  '.ylllly.',
  '.yyyyyy.',
  '.oooooo.',
  '.dddddd.',
  '........',
];
const G_SHAPE_BURU_MUSASHI = [ // ブル武蔵
  '............',
  'bb..yyyy....',
  'bb.yyeyyy...',
  'bb.yyyryy...',
  'bb.yyyyyy...',
  'bb.oooooo...',
  'bb.dddddd...',
  'bb.o.o.o....',
  'bb.dddddd...',
  '............',
];
const G_SHAPE_CHARISMA = [ // カリスマ講師
  '..oooooo..',
  '.oooooooo.',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..yyyyyy..',
  '..dddddd..',
  'y.dddddd..',
  'y.dddrddd.',
  '..dddddd..',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_GENBA_OTTON = [ // 現場オットン
  '..oooooo..',
  '.oooooooo.',
  'oooooooooo',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..yyyyyy..',
  '..dddddd..',
  '.dddddddd.',
  '.dddrrddd.',
  '.dddddddd.',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_JADE_YOUNG = [ // ジェイド（ひな）
  '....oooo....',
  '..oggggggo..',
  '..ogerrego..',
  '..orrkkrro..',
  '.ogyyyyyygo.',
  '.oggyyyyggo.',
  '.obgyyyygbo.',
  '..ogyyyygo..',
  '...ogyyg....',
  '....lggl....',
  '...llggll...',
  'dddddddddddd',
];
const G_SHAPE_KYOSHITSU = [ // 教室長
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.geffffeg.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cwwccccc.',
  '.cwwccccc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_MANTEN = [ // 満点答案
  '............',
  '.yyyyyyyyyy.',
  '.yeyyyyyyey.',
  '.yyyyooyyyy.',
  '.yyyyyyyyyy.',
  '.yyrrrrrryy.',
  '.yyryyyyryy.',
  '.yyrrrrrryy.',
  '.yyyyyyyyyy.',
  '.dddddddddd.',
  '............',
];
const G_SHAPE_NADA_MON = [ // 灘の門番
  'ssssssssssss',
  'ss........ss',
  'ss.cccccc.ss',
  'ss.cffffc.ss',
  'ss.ceffec.ss',
  'ss.cfbbfc.ss',
  'ss..ffff..ss',
  'ss.vvvvvv.ss',
  'ss.vssssv.ss',
  'ss.vvvvvv.ss',
  'ss.pppppp.ss',
  'ss.pp..pp.ss',
  '............',
];
const G_SHAPE_OBAAN = [ // オバーン
  '..oooooo..',
  '.oooooooo.',
  '.oyyyyyyo.',
  '.geyyyyeg.',
  '.yyyrryyy.',
  '..yyyyyy..',
  '..dddddd..',
  '.dddddddd.',
  '.dddrrddd.',
  '.dddddddd.',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_OJIIN = [ // オジーン
  '..oooooo..',
  '.oooooooo.',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..oooooo..',
  '..dddddd..',
  '.dddddddd.',
  '.dddddddd.',
  'c.dddddd..',
  'c.ll..ll..',
  'c.ll..ll..',
  '..........',
];
const G_SHAPE_OMAMORI = [ // お守りちゃん
  '....yy....',
  '...y..y...',
  '..pppppp..',
  '.pppppppp.',
  '.pepppppe.',
  '.pppmmppp.',
  '.pyyyyyyp.',
  '.pppppppp.',
  '..pppppp..',
  '..........',
];
const G_SHAPE_SAIREKUN = [ // 最レ王
  '..o.o.o...',
  '..oooooo..',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..yyyyyy..',
  'd.dddddd.d',
  'd.dddddd.d',
  'd.dddddd.d',
  '..dddddd..',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_SOTSUGYO = [ // 卒業生センパイ
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hffffffh.',
  '.ffeffeff.',
  '.fffmmfff.',
  '..ffffff..',
  '..cccccc..',
  '.cccyyccc.',
  '.cccyyccc.',
  '..cccccc..',
  '..pp..pp..',
  '..kk..kk..',
  '..........',
];
const G_SHAPE_STOPWATCH = [ // ストップウォッチ
  '....k.....',
  '...kkk....',
  '..wwwwww..',
  '.wwwwwwww.',
  '.wewwwwew.',
  '.wwwkkwww.',
  '.wwwmmwww.',
  '.wwwwwwww.',
  '..wwwwww..',
  '..........',
];
const G_SHAPE_SUPER_OKAN = [ // スーパーオカーン
  '..oooooo..',
  '.oooooooo.',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..yyyyyy..',
  'w.dddddd..',
  'w.dddddd..',
  '.dddddddd.',
  '..dddddd..',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_TRANSIT = [ // トランシット
  '..kkkk....',
  '.kkkkkkkk.',
  '.kekkkkek.',
  '.kkkrrkkk.',
  '....kk....',
  '...dkkd...',
  '..d.kk.d..',
  '.d..kk..d.',
  'd...kk...d',
  '..........',
];
const G_SHAPE_TUNNEL_MORI = [ // トンネル守
  '..wwwwwwww..',
  '.w........w.',
  'w..cccccc..w',
  'w.cccccccc.w',
  'w.cffffffc.w',
  'w.cfeffefc.w',
  'w.cffbbffc.w',
  'w..ffffff..w',
  'w.vvvvvvvv.w',
  'w.vvssssvv.w',
  'w..pppppp..w',
  'w..pp..pp..w',
  '............',
];
const G_SHAPE_AKAHON_DRAGON = [ // 赤本ドラゴン
  '...d....d...',
  '..oyyyyyyo..',
  '.oyeyyyeyo..',
  '.oyyyrryyo..',
  '..oyyyyyyo..',
  '.ddoyyyyodd.',
  '..oyyyyyyo..',
  '..oyyyyyyo..',
  '...dyyyyd...',
  '....dyyd....',
  '.....dd.....',
];
const G_SHAPE_CRANE_KING = [ // クレーンキング
  'd.........',
  'dooooooo..',
  'd........l',
  'd.........',
  'd.........',
  'dyyyyyyyd.',
  'dyeyyyeyd.',
  'dyyyyyyyd.',
  'ddddddddd.',
  '.ll....ll.',
  '..........',
  '..........',
];
const G_SHAPE_DAIYA_CHICCHI = [ // ダイヤチッチ
  '....dd....',
  '...dyyd...',
  '..dyyyyd..',
  '.dyyyyyyd.',
  '.dyeyyeyd.',
  '.dyyrryyd.',
  '.dyyyyyyd.',
  '..dyyyyd..',
  '...dyyd...',
  '....ll....',
  '..........',
];
const G_SHAPE_GOD_CHICCHI = [ // 神チッチ
  '...dddd...',
  '..d....d..',
  '...yyyy...',
  '..yyyyyy..',
  '.oyeyyeyo.',
  '.oyyrryyo.',
  '.oyyyyyyo.',
  '..yyyyyy..',
  '..lyyyyl..',
  '...l..l...',
  '..........',
];
const G_SHAPE_GOD_JADE = [ // 神ジェイド
  'l.oooooo.l',
  '.o......o.',
  '...yyyy...',
  '..yyyyyy..',
  '.gyeyyeyg.',
  '.gyyrryyg.',
  'ggyyyyyygg',
  'gggyyyyggg',
  '.gggggggg.',
  'l.oo..oo.l',
  '..........',
];
const G_SHAPE_GOD_OKAN = [ // 神オカーン
  '..oooooo..',
  '.o......o.',
  '..oooooo..',
  '.oyyyyyyo.',
  '.oyeyyeyo.',
  '.oyyrryyo.',
  '.oyyyyyyo.',
  'l.dddddd.l',
  '.dddddddd.',
  '.dddddddd.',
  '..llllll..',
  '.llllllll.',
  '..........',
];
const G_SHAPE_GOD_OTTON = [ // 神オットン
  '..oooooo..',
  '.o......o.',
  '..yyyyyy..',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..yyyyyy..',
  'l.dddddd.l',
  'l.ddoodd.l',
  '..ddoodd..',
  '..dddddd..',
  '..llllll..',
  '..ll..ll..',
  '..........',
];
const G_SHAPE_GOLD_OTTON = [ // ゴールドオットン
  'o........o',
  '..oooooo..',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..yyyyyy..',
  'o.dddddd.o',
  '.dddooddd.',
  '.dddooddd.',
  '..dddddd..',
  '..llllll..',
  'o.ll..ll.o',
  '..........',
];
const G_SHAPE_GOUKAKU_DARUMA = [ // 合格だるま大明神
  '..dyyyyd..',
  '.dyyyyyyd.',
  'dyyyyyyyyd',
  'dyeyyyyeyd',
  'dyyyrrryyd',
  'dyyyyyyyyd',
  'dyyyyyyyyd',
  'dyyoooyyyd',
  '.dyyyyyyd.',
  '..dyyyyd..',
];
const G_SHAPE_HENSACHI70 = [ // 偏差値70仙人
  '..oooooo..',
  '.oooooooo.',
  '.oyyyyyyo.',
  '.yyeyyeyy.',
  '.yyyrryyy.',
  '..oooooo..',
  '..oooooo..',
  '..dddddd..',
  'l.dddddd..',
  'l.dddddd..',
  'l.llllll..',
  'l.ll..ll..',
  '..........',
];
const G_SHAPE_JADE_FLY = [ // ジェイド
  '....oooo....',
  '...orrrro...',
  '..orerrero..',
  '..orrkkrro..',
  'ggoyyyyyyogg',
  'bggyyyyyyggb',
  '.bgoyyyyogb.',
  '...oyyyyo...',
  '....oyyo....',
  '....lggl....',
  '.....gg.....',
  '.....oo.....',
];
const G_SHAPE_JADE_PERCH = [ // ジェイド（とまり木）
  '....oooo....',
  '..oorrrroo..',
  '.orrwewrro..',
  'kkrrrrrrro..',
  '.orrryyyyo..',
  '.oyyyyyggo..',
  '.oyyyyggbo..',
  '..oyyyggbo..',
  '..oyyyggggo.',
  '...oyyggggo.',
  '....olloggo.',
  'dddddddddddd',
];
const G_SHAPE_KENSETSUNDER = [ // 無敵重機ロボ ケンセツンダー
  '..kk....kk..',
  '..kkkkkkkk..',
  '..oo....oo..',
  '..oooooooo..',
  '..kkkkkkkk..',
  '..yyyyyyyy..',
  '..bbbbbbbb..',
  '..bbrrrrbb..',
  '..bbbbbbbb..',
  '..yyyyyyyy..',
  '.kk......kk.',
  'kkkkkkkkkkkk',
  '............',
  '............',
];
const G_SHAPE_NADA_MEGAMI = [ // 灘中合格の大女神
  '..gg....gg..',
  '...gggggg...',
  '..hhhhhhhh..',
  '..hffffffh..',
  '..hfeffefh..',
  '..hffffffh..',
  '..hhyyyyhh..',
  '...rrrrrr...',
  '..rryyyyrr..',
  '.rrryyyyrrr.',
  '.rrrrrrrrrr.',
  '..rrrrrrrr..',
  '...rr..rr...',
  '............',
];
const G_SHAPE_PLATINA_OKAN = [ // プラチナオカーン
  'o........o',
  '..oooooo..',
  '.oooooooo.',
  '.oyyyyyyo.',
  '.oyeyyeyo.',
  '.oyyrryyo.',
  '.oyyyyyyo.',
  'o.dddddd.o',
  '.dddddddd.',
  '..dddddd..',
  '..llllll..',
  'o.ll..ll.o',
  '..........',
];

function gHashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function gHslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
// レアリティが高いほど彩度・明度をリッチに
const G_RARITY_TONE = { N: [50, 42], R: [62, 48], SR: [76, 54], UR: [90, 58] };
function gPalette(ch) {
  const hue = gHashStr(ch.id) % 360;
  const [sat, light] = G_RARITY_TONE[ch.rarity] || G_RARITY_TONE.N;
  return {
    y: gHslToHex(hue, sat, Math.min(light + 18, 92)),
    o: gHslToHex(hue, sat, light),
    r: gHslToHex((hue + 30) % 360, sat, Math.max(light - 15, 25)),
    d: gHslToHex(hue, sat, Math.max(light - 20, 18)),
    l: gHslToHex((hue + 180) % 360, Math.min(sat + 10, 92), light),
    e: '#222222',
  };
}

// 全キャラが専用の形を持つようになったが、未登録のidが来たときの保険として
// G_TEMPLATE を残しておく（gDrawChar / gDrawSilhouette が参照している）
const G_TEMPLATE = G_SHAPE_PIYO;

// id→形状（1体につき1つ。使い回しなし）
const G_CHAR_SHAPE = {
  ankicard: G_SHAPE_ANKICARD,
  anpan: G_SHAPE_ANPAN,
  banana: G_SHAPE_BANANA,
  bundoki: G_SHAPE_BUNDOKI,
  buta: G_SHAPE_BUTA,
  chou: G_SHAPE_CHOU,
  chun: G_SHAPE_CHUN,
  clip: G_SHAPE_CLIP,
  compass: G_SHAPE_COMPASS,
  cone: G_SHAPE_CONE,
  conebar: G_SHAPE_CONEBAR,
  crayon: G_SHAPE_CRAYON,
  curry: G_SHAPE_CURRY,
  currypan: G_SHAPE_CURRYPAN,
  dango: G_SHAPE_DANGO,
  dangorou: G_SHAPE_DANGOROU,
  donou: G_SHAPE_DONOU,
  eiyo: G_SHAPE_EIYO,
  enpitsu: G_SHAPE_ENPITSU,
  fusenhime: G_SHAPE_FUSENHIME,
  gessha: G_SHAPE_GESSHA,
  gunte: G_SHAPE_GUNTE,
  gyunyu: G_SHAPE_GYUNYU,
  hamuta: G_SHAPE_HAMUTA,
  hasami: G_SHAPE_HASAMI,
  hatsudenki: G_SHAPE_HATSUDENKI,
  hebi: G_SHAPE_HEBI,
  hitsuji: G_SHAPE_HITSUJI,
  jougi: G_SHAPE_JOUGI,
  jukubag: G_SHAPE_JUKUBAG,
  jukuben: G_SHAPE_JUKUBEN,
  kabutomaru: G_SHAPE_KABUTOMARU,
  kaerunosuke: G_SHAPE_KAERUNOSUKE,
  kaitou: G_SHAPE_KAITOU,
  kakomon: G_SHAPE_KAKOMON,
  kamekichi: G_SHAPE_KAMEKICHI,
  karaage: G_SHAPE_KARAAGE,
  keikoupen: G_SHAPE_KEIKOUPEN,
  keshigomu: G_SHAPE_KESHIGOMU,
  keshikasu: G_SHAPE_KESHIKASU,
  kezuri: G_SHAPE_KEZURI,
  kingyohime: G_SHAPE_KINGYOHIME,
  kotsu: G_SHAPE_KOTSU,
  mezamashi: G_SHAPE_MEZAMASHI,
  mikan: G_SHAPE_MIKAN,
  mondaishu: G_SHAPE_MONDAISHU,
  nekoguruma: G_SHAPE_NEKOGURUMA,
  nori: G_SHAPE_NORI,
  noteshi: G_SHAPE_NOTESHI,
  nyankichi: G_SHAPE_NYANKICHI,
  ocha: G_SHAPE_OCHA,
  ongaku: G_SHAPE_ONGAKU,
  onigiri: G_SHAPE_ONIGIRI,
  penguin: G_SHAPE_PENGUIN,
  piyo: G_SHAPE_PIYO,
  ponkichi: G_SHAPE_PONKICHI,
  randoseru: G_SHAPE_RANDOSERU,
  recorder: G_SHAPE_RECORDER,
  risu: G_SHAPE_RISU,
  sankaku: G_SHAPE_SANKAKU,
  scoop: G_SHAPE_SCOOP,
  sharpbushi: G_SHAPE_SHARPBUSHI,
  shitajiki: G_SHAPE_SHITAJIKI,
  shukudai: G_SHAPE_SHUKUDAI,
  taiiku: G_SHAPE_TAIIKU,
  tamagoyaki: G_SHAPE_TAMAGOYAKI,
  tape: G_SHAPE_TAPE,
  tarp: G_SHAPE_TARP,
  tekkin: G_SHAPE_TEKKIN,
  tentou: G_SHAPE_TENTOU,
  timer: G_SHAPE_TIMER,
  usagi: G_SHAPE_USAGI,
  wanzou: G_SHAPE_WANZOU,
  yomu: G_SHAPE_YOMU,
  zabuton: G_SHAPE_ZABUTON,
  anzentai: G_SHAPE_ANZENTAI,
  bus: G_SHAPE_BUS,
  chikyugi: G_SHAPE_CHIKYUGI,
  coach: G_SHAPE_COACH,
  dentaku: G_SHAPE_DENTAKU,
  dump: G_SHAPE_DUMP,
  enogu: G_SHAPE_ENOGU,
  fork: G_SHAPE_FORK,
  fude: G_SHAPE_FUDE,
  fukurou: G_SHAPE_FUKUROU,
  guard: G_SHAPE_GUARD,
  hachimaki: G_SHAPE_HACHIMAKI,
  helmet: G_SHAPE_HELMET,
  hensachi: G_SHAPE_HENSACHI,
  hogosha: G_SHAPE_HOGOSHA,
  hoken: G_SHAPE_HOKEN,
  hotchkiss: G_SHAPE_HOTCHKISS,
  jisho: G_SHAPE_JISHO,
  jishu: G_SHAPE_JISHU,
  jukucho: G_SHAPE_JUKUCHO,
  kani: G_SHAPE_KANI,
  katsu: G_SHAPE_KATSU,
  keisan_oni: G_SHAPE_KEISAN_ONI,
  kinjiro: G_SHAPE_KINJIRO,
  kitsune: G_SHAPE_KITSUNE,
  kocho: G_SHAPE_KOCHO,
  kousho: G_SHAPE_KOUSHO,
  kuma: G_SHAPE_KUMA,
  kyoto: G_SHAPE_KYOTO,
  kyushoku: G_SHAPE_KYUSHOKU,
  level: G_SHAPE_LEVEL,
  mixer: G_SHAPE_MIXER,
  mogi_fuutou: G_SHAPE_MOGI_FUUTOU,
  moshi: G_SHAPE_MOSHI,
  nenpyo: G_SHAPE_NENPYO,
  purin: G_SHAPE_PURIN,
  rammer: G_SHAPE_RAMMER,
  ramune: G_SHAPE_RAMUNE,
  rika: G_SHAPE_RIKA,
  roller: G_SHAPE_ROLLER,
  shisho: G_SHAPE_SHISHO,
  shodo: G_SHAPE_SHODO,
  shovel: G_SHAPE_SHOVEL,
  shuseitape: G_SHAPE_SHUSEITAPE,
  soroban: G_SHAPE_SOROBAN,
  tako: G_SHAPE_TAKO,
  tobibako: G_SHAPE_TOBIBAKO,
  tsuruhashi: G_SHAPE_TSURUHASHI,
  tutor: G_SHAPE_TUTOR,
  a_hantei: G_SHAPE_A_HANTEI,
  akapen: G_SHAPE_AKAPEN,
  buru_musashi: G_SHAPE_BURU_MUSASHI,
  charisma: G_SHAPE_CHARISMA,
  genba_otton: G_SHAPE_GENBA_OTTON,
  jade_young: G_SHAPE_JADE_YOUNG,
  kyoshitsu: G_SHAPE_KYOSHITSU,
  manten: G_SHAPE_MANTEN,
  nada_mon: G_SHAPE_NADA_MON,
  obaan: G_SHAPE_OBAAN,
  ojiin: G_SHAPE_OJIIN,
  omamori: G_SHAPE_OMAMORI,
  sairekun: G_SHAPE_SAIREKUN,
  sotsugyo: G_SHAPE_SOTSUGYO,
  stopwatch: G_SHAPE_STOPWATCH,
  super_okan: G_SHAPE_SUPER_OKAN,
  transit: G_SHAPE_TRANSIT,
  tunnel_mori: G_SHAPE_TUNNEL_MORI,
  akahon_dragon: G_SHAPE_AKAHON_DRAGON,
  crane_king: G_SHAPE_CRANE_KING,
  daiya_chicchi: G_SHAPE_DAIYA_CHICCHI,
  god_chicchi: G_SHAPE_GOD_CHICCHI,
  god_jade: G_SHAPE_GOD_JADE,
  god_okan: G_SHAPE_GOD_OKAN,
  god_otton: G_SHAPE_GOD_OTTON,
  gold_otton: G_SHAPE_GOLD_OTTON,
  goukaku_daruma: G_SHAPE_GOUKAKU_DARUMA,
  hensachi70: G_SHAPE_HENSACHI70,
  jade_fly: G_SHAPE_JADE_FLY,
  jade_perch: G_SHAPE_JADE_PERCH,
  kensetsunder: G_SHAPE_KENSETSUNDER,
  nada_megami: G_SHAPE_NADA_MEGAMI,
  platina_okan: G_SHAPE_PLATINA_OKAN,
};

// id→固定パレット（フラッグシップ級・専用デザインの色。未指定は自動配色gPalette()）
const G_CHAR_PAL = {
  ankicard: { w: '#fffdf0', g: '#b0b0b8', l: '#d8c8a0', e: '#222222', r: '#c0392b', d: '#c8b898' },
  anpan: { o: '#d9a45a', k: '#4a3520', e: '#222222', m: '#7a3a10', d: '#a8763f' },
  banana: { y: '#ffe066', k: '#8a6a2a', e: '#222222', m: '#c0392b' },
  bundoki: { c: '#ffe0a0', m: '#8a5a2b', e: '#222222', d: '#d8b060' },
  buta: { y: '#ffb0c0', d: '#e88098', n: '#c05070', e: '#222222', m: '#8a3a50' },
  chou: { o: '#ffb0d0', p: '#e060a0', k: '#4a3520', e: '#fffdf5' },
  chun: { d: '#8a5a2b', y: '#e8d8b8', w: '#fffdf5', o: '#ffb020', e: '#222222' },
  clip: { m: '#b8c0c8', e: '#222222' },
  compass: { o: '#ffd166', m: '#b8c0c8', e: '#222222', r: '#c0392b', k: '#4a4a55', p: '#2b2b2b' },
  cone: { o: '#ff7a2e', w: '#fffdf5', e: '#222222', r: '#c0392b', d: '#8a3a10' },
  conebar: { o: '#ff7a2e', w: '#fffdf5', e: '#222222', r: '#c0392b' },
  crayon: { r: '#e03c4a', b: '#3a6fd8', g: '#4ade80', y: '#ffd166', k: '#8a5a2b', e: '#222222' },
  curry: { w: '#fffdf5', r: '#a8551a', p: '#e8e8f0', m: '#8a3a10', e: '#222222', d: '#b0b0b8' },
  currypan: { o: '#d9862e', r: '#a8551a', e: '#222222', m: '#7a3a10', d: '#a8621a' },
  dango: { p: '#ffb0c0', w: '#fffdf5', g: '#8ac86a', k: '#c8a878', e: '#222222', m: '#c0392b' },
  dangorou: { d: '#5a5a68', h: '#8a8a98', e: '#ffd166' },
  donou: { w: '#c8b078', e: '#222222', r: '#8a5a2b', d: '#8a7040' },
  eiyo: { w: '#fffdf5', f: '#f5c9a2', e: '#222222', m: '#c0392b', r: '#e03c4a', p: '#c8c8d0', k: '#f5f5f5' },
  enpitsu: { k: '#2b2b2b', w: '#e8c9a0', y: '#ffd166', e: '#222222', r: '#c0392b', o: '#b0b0b8', p: '#ff9aa2' },
  fusenhime: { y: '#ffe066', o: '#d9b83c', e: '#222222', r: '#c0392b', d: '#c9a832' },
  gessha: { w: '#e8d0a0', k: '#8a5a2b', e: '#222222', m: '#c0392b', d: '#c8a878' },
  gunte: { w: '#f0f0e8', r: '#e03c4a', e: '#222222', d: '#b0b0a8' },
  gyunyu: { w: '#fffdf5', b: '#3a6fd8', m: '#c0392b', e: '#222222', d: '#c8c8d0' },
  hamuta: { y: '#f0d8a0', d: '#c8a878', n: '#ff9aa2', m: '#8a4a20', w: '#fff0d8', o: '#c8a878', e: '#222222', l: '#c8a878' },
  hasami: { m: '#c8c8d0', b: '#3a6fd8', e: '#222222' },
  hatsudenki: { k: '#3a3a45', y: '#ffd166', w: '#8a8a95', e: '#222222', r: '#c0392b', d: '#2b2b2b' },
  hebi: { g: '#6ac24a', d: '#3a8a2a', e: '#ffe066', r: '#e03c4a' },
  hitsuji: { w: '#fffdf5', d: '#e0d8c8', f: '#e8c9a0', e: '#222222', m: '#8a4a20', k: '#8a7a60' },
  jougi: { c: '#a8e0f0', m: '#2b6fb5', e: '#222222', r: '#c0392b', d: '#4a9cc0' },
  jukubag: { b: '#3a6fd8', o: '#2b4f9a', e: '#222222', r: '#ffd166', d: '#1f3a72' },
  jukuben: { b: '#c0392b', w: '#fffdf5', r: '#e03c4a', g: '#4ade80', m: '#7a1a14', e: '#222222', d: '#8a2820' },
  kabutomaru: { k: '#4a3520', d: '#3a2a1e', h: '#5a4030', e: '#ffd166', l: '#4a3520' },
  kaerunosuke: { g: '#5cc25c', o: '#fffdf5', e: '#222222', m: '#c0392b' },
  kaitou: { w: '#fffdf5', k: '#c8d0e0', r: '#e03c4a', e: '#222222', m: '#c0392b', d: '#c0c0b8' },
  kakomon: { r: '#c0392b', w: '#fffdf5', o: '#6b1a14', e: '#222222', d: '#8a2820' },
  kamekichi: { d: '#2e6b4a', h: '#4ade80', y: '#a8d878', e: '#222222', m: '#8a4a20', l: '#a8d878' },
  karaage: { o: '#d9862e', d: '#a8621a', e: '#222222', m: '#7a3a10' },
  keikoupen: { g: '#eaff4a', k: '#8a8a20', m: '#c0392b', e: '#222222', d: '#b8c020' },
  keshigomu: { w: '#f5f5f0', c: '#4f7cff', e: '#222222', r: '#c0392b', d: '#b8b8b0' },
  keshikasu: { w: '#d8d8d0', e: '#222222', m: '#8a8a80' },
  kezuri: { k: '#3a6fd8', w: '#e8c9a0', e: '#222222', m: '#c0392b', d: '#2b4f9a' },
  kingyohime: { y: '#6685cc', o: '#3656a1', r: '#302267', d: '#1c2d54', l: '#ab852b', e: '#222222' },
  kotsu: { b: '#ffd166', h: '#4a3520', f: '#f5c9a2', e: '#222222', m: '#c0392b', y: '#ffe066', c: '#3a6fd8', p: '#2b3a5e', k: '#2b2b2b' },
  mezamashi: { b: '#ffd166', w: '#f5f5f0', k: '#3a3a48', e: '#222222', m: '#c0392b', d: '#8a8a95' },
  mikan: { o: '#ff9d2e', g: '#4ade80', k: '#8a5a2b', e: '#222222', m: '#c0392b' },
  mondaishu: { b: '#3a6fd8', r: '#c0392b', g: '#2e8b57', e: '#222222', m: '#fffdf5', d: '#4a4a55' },
  nekoguruma: { t: '#3a6fd8', o: '#3a3a45', k: '#8a8a95', e: '#222222', r: '#c0392b' },
  nori: { c: '#e8e8f0', w: '#fffdf5', y: '#a0d0f0', e: '#222222', m: '#c0392b' },
  noteshi: { w: '#fffdf5', c: '#4f7cff', l: '#b8c8e0', e: '#222222', r: '#c0392b', d: '#c8c8c0' },
  nyankichi: { y: '#f0c060', d: '#c89840', n: '#ff9aa2', m: '#8a4a20', w: '#ffffff', e: '#222222', l: '#c89840' },
  ocha: { w: '#e8e8f0', g: '#6a8a3a', c: '#c8c8d0', e: '#222222', m: '#c0392b', d: '#b0b0b8' },
  ongaku: { h: '#5a3a20', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#7a3a9a', n: '#ffd166', p: '#4a3a5a', k: '#2b2b2b' },
  onigiri: { w: '#fffdf5', k: '#2b3a2b', e: '#222222', m: '#c0392b' },
  penguin: { k: '#2b2b3a', w: '#fffdf5', e: '#222222', o: '#ffb020' },
  piyo: { y: '#ffe066', o: '#ff9d2e', e: '#222222' },
  ponkichi: { y: '#c8a878', d: '#8a5a2b', k: '#4a3520', n: '#2b2b2b', m: '#8a4a20', t: '#8a5a2b', e: '#ffffff', l: '#8a5a2b' },
  randoseru: { r: '#c0392b', b: '#8a2820', g: '#ffd166', e: '#222222', d: '#6b1a14' },
  recorder: { o: '#8a5a2b', w: '#f0f0e8', k: '#2b2b2b', e: '#222222', r: '#c0392b', d: '#b0b0a8' },
  risu: { y: '#d89050', d: '#a86830', t: '#c87840', n: '#2b2b2b', m: '#8a4a20', e: '#222222' },
  sankaku: { c: '#a8e0f0', m: '#2b6fb5', e: '#222222', d: '#4a9cc0' },
  scoop: { d: '#8a5a2b', s: '#b8c0c8', e: '#222222', r: '#c0392b' },
  sharpbushi: { k: '#2b2b2b', m: '#b8c0c8', r: '#c0392b', b: '#2b3a5e', c: '#b8c0c8', e: '#222222', d: '#1a2440' },
  shitajiki: { c: '#8ed8f0', e: '#222222', o: '#2b6fb5', d: '#4a9cc0' },
  shukudai: { w: '#fffdf5', l: '#c8d0e0', r: '#e03c4a', e: '#222222', d: '#c0c0b8' },
  taiiku: { h: '#2b2b2b', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#2b3a5e', w: '#fffdf5', p: '#2b3a5e', k: '#2b2b2b' },
  tamagoyaki: { y: '#ffd166', o: '#e8b020', e: '#222222', m: '#c0392b', d: '#c89830' },
  tape: { c: '#a8e0f0', w: '#fffdf5', e: '#222222', m: '#2b6fb5', d: '#4a9cc0' },
  tarp: { b: '#2b6fb5', e: '#222222', r: '#c0392b' },
  tekkin: { k: '#7a7a85', e: '#222222', r: '#c0392b' },
  tentou: { r: '#e03c3c', k: '#2b2b2b', w: '#fffdf5', e: '#222222' },
  timer: { k: '#4a4a55', w: '#f5f5f0', e: '#222222', r: '#c0392b', d: '#b0b0a8' },
  usagi: { d: '#ffe0e8', y: '#fffdf5', n: '#ff9aa2', m: '#c0392b', e: '#e03c4a', l: '#f0d0d8' },
  wanzou: { y: '#c89058', d: '#8a5a2b', n: '#2b2b2b', m: '#8a4a20', b: '#c0392b', e: '#222222', l: '#8a5a2b' },
  yomu: { b: '#4a6b4a', h: '#2b2b2b', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#6a8a6a', s: '#c8a878', p: '#4a4a58', k: '#2b2b2b' },
  zabuton: { r: '#c0392b', e: '#222222', m: '#7a1a14', d: '#8a2820' },
  anzentai: { h: '#ffd166', k: '#3a3a45', m: '#b8c0c8', e: '#222222', r: '#c0392b' },
  bus: { b: '#2b3a5e', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#3a6fd8', w: '#3a3a45', p: '#2b3a5e', k: '#2b2b2b' },
  chikyugi: { b: '#3a6fd8', g: '#4ade80', k: '#8a5a2b', e: '#222222', m: '#fffdf5' },
  coach: { b: '#c0392b', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#2b2b2b', w: '#c8c8d0', p: '#4a4a55', k: '#1a1a1a' },
  dentaku: { k: '#3a3a48', w: '#c8e8d0', e: '#222222', b: '#8a8a95', m: '#c0392b' },
  dump: { y: '#ffd166', t: '#c0392b', k: '#3a3a45', o: '#2b2b2b', e: '#222222', r: '#8a2820' },
  enogu: { w: '#fffdf5', r: '#e03c4a', b: '#3a6fd8', g: '#4ade80', y: '#ffd166', e: '#222222' },
  fork: { m: '#8a8a95', f: '#c8c8d0', y: '#ff7a2e', k: '#3a3a45', o: '#2b2b2b', e: '#222222', r: '#c0392b' },
  fude: { k: '#2b2b2b', d: '#8a5a2b', y: '#e8c9a0', e: '#222222', m: '#c0392b' },
  fukurou: { d: '#8a6a4a', y: '#d8b890', w: '#fffdf5', e: '#222222', o: '#ffb020' },
  guard: { c: '#1a3d6e', f: '#f5c9a2', e: '#222222', v: '#ff9a2e', s: '#ffffff', b: '#274b7a', p: '#12283d', g: '#ff3b3b' },
  hachimaki: { w: '#fffdf5', r: '#e03c4a', e: '#222222', m: '#c0392b' },
  helmet: { o: '#ffd166', e: '#222222', r: '#c0392b', d: '#c9a832' },
  hensachi: { g: '#4ade80', y: '#f0f0e8', e: '#222222', r: '#c0392b', d: '#b0b0a8' },
  hogosha: { h: '#5a3a20', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#5a5a6a', r: '#ffd166', p: '#4a4a58', k: '#2b2b2b' },
  hoken: { w: '#fffdf5', r: '#e03c4a', h: '#4a3520', f: '#f5c9a2', e: '#222222', m: '#c0392b', p: '#c8c8d0', k: '#f5f5f5' },
  hotchkiss: { k: '#3a3a48', m: '#c8c8d0', e: '#222222', r: '#c0392b' },
  jisho: { o: '#2e6b4a', w: '#fffdf5', e: '#222222', r: '#ffd166', d: '#1a4530' },
  jishu: { h: '#2b2b2b', f: '#f5c9a2', n: '#4a4a55', m: '#c0392b', c: '#5a6b7a', b: '#c0392b', a: '#3a6fd8' },
  jukucho: { h: '#2b2b2b', r: '#e03c4a', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#fffdf5', p: '#2b3a5e', k: '#2b2b2b' },
  kani: { r: '#e04a3a', d: '#a82a1a', w: '#fffdf5', e: '#222222' },
  katsu: { o: '#d9862e', w: '#f0e0d0', e: '#222222', m: '#7a3a10' },
  keisan_oni: { k: '#e8d8b8', h: '#2b2b2b', f: '#e05a4a', e: '#ffe066', w: '#ffffff', m: '#7a1a14', c: '#2b2b2b', s: '#ffd166', p: '#4a4a55', b: '#1a1a1a' },
  kinjiro: { h: '#5a4025', f: '#a67c4a', e: '#3a2a1a', m: '#6b5030', c: '#8d6e3a', w: '#5a4025', b: '#7a5a35', p: '#6b5030', k: '#3a2a1a' },
  kitsune: { y: '#ff9d4a', w: '#fffdf5', d: '#c06820', n: '#2b2b2b', m: '#8a4a20', e: '#222222' },
  kocho: { h: '#e8e8e8', f: '#f5c9a2', e: '#222222', g: '#4a4a55', m: '#c0392b', c: '#2b3a5e', t: '#c0392b', p: '#2b3a5e', k: '#2b2b2b' },
  kousho: { b: '#ffd166', a: '#ffb020', y: '#38c8f0', k: '#3a3a45', o: '#2b2b2b', e: '#222222', r: '#c0392b' },
  kuma: { y: '#a87848', d: '#805828', n: '#2b2b2b', m: '#8a4a20', e: '#222222', w: '#e8d0b0' },
  kyoto: { h: '#2b2b2b', f: '#f5c9a2', e: '#222222', g: '#8a8a95', m: '#c0392b', c: '#6a6a78', t: '#3a6fd8', p: '#4a4a58', k: '#2b2b2b' },
  kyushoku: { w: '#fffdf5', f: '#f5c9a2', e: '#222222', m: '#c0392b', s: '#b8c0c8', p: '#8a8a95', k: '#4a4a55' },
  level: { k: '#ffd166', w: '#e8e8f0', g: '#4ade80', e: '#222222', r: '#c0392b' },
  mixer: { y: '#38c8f0', m: '#b0b0b8', w: '#e8e8f0', k: '#3a3a45', o: '#2b2b2b', e: '#222222', r: '#c0392b' },
  mogi_fuutou: { w: '#fffdf5', r: '#e03c4a', e: '#222222', m: '#c0392b', d: '#c8c8c0' },
  moshi: { h: '#4a3520', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#3a6fd8', w: '#fffdf5', a: '#e03c4a', p: '#2b3a5e', k: '#2b2b2b' },
  nenpyo: { d: '#8a5a2b', w: '#fffdf5', k: '#4a4a55', e: '#222222', m: '#c0392b' },
  purin: { c: '#8a5a2b', y: '#ffe088', e: '#222222', m: '#c0392b', d: '#d8b060' },
  rammer: { h: '#8a8a95', y: '#ff7a2e', k: '#3a3a45', e: '#222222', r: '#c0392b' },
  ramune: { b: '#6ac8e8', c: '#a8e0f0', e: '#222222', m: '#2b6fb5', d: '#4a9cc0' },
  rika: { h: '#2b2b2b', f: '#f5c9a2', e: '#222222', g: '#8a8a95', m: '#c0392b', w: '#fffdf5', b: '#4ade80', p: '#4a4a55', k: '#2b2b2b' },
  roller: { y: '#ffd166', k: '#3a3a45', m: '#8a8a95', w: '#d8d8e0', e: '#222222', r: '#c0392b' },
  shisho: { h: '#5a3a20', f: '#f5c9a2', e: '#222222', g: '#8a8a95', m: '#c0392b', c: '#7a5a8a', b: '#c0392b', p: '#4a4a58', k: '#2b2b2b' },
  shodo: { h: '#2b2b2b', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#4a4a58', r: '#c0392b', b: '#8a5a2b', p: '#3a3a45', k: '#2b2b2b' },
  shovel: { y: '#ffd166', a: '#ffb020', b: '#8a8a95', k: '#3a3a45', o: '#6a6a75', e: '#222222', r: '#c0392b' },
  shuseitape: { w: '#fffdf5', b: '#3a6fd8', e: '#222222', m: '#c0392b', d: '#c8c8d0' },
  soroban: { d: '#8a5a2b', y: '#f0d8b0', o: '#c0392b', e: '#222222', r: '#6b4520' },
  tako: { r: '#e0607a', d: '#b03a50', w: '#fffdf5', e: '#222222', m: '#7a1a30' },
  tobibako: { o: '#d9a441', d: '#8a5a2b', e: '#222222', r: '#c0392b' },
  tsuruhashi: { m: '#8a8a95', d: '#8a5a2b', e: '#222222', r: '#c0392b' },
  tutor: { h: '#5a3a20', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#f7b6ce', b: '#fffdf5', p: '#8a5a8a', k: '#5a3a5a' },
  a_hantei: { h: '#4a6fa5', f: '#f8d9c0', e: '#222222', r: '#e8f4ff', y: '#38c8f0', g: '#cceeff' },
  akapen: { m: '#b8c0c8', o: '#ff4466', y: '#ff6b81', e: '#222222', r: '#c0392b', l: '#8a8a8a', d: '#8a8a8a' },
  buru_musashi: { y: '#b71c1c', o: '#ffd166', e: '#222222', d: '#1a1a1a', r: '#ffd166', b: '#8a8a95' },
  charisma: { o: '#7c4fff', y: '#f5c9a2', e: '#222222', r: '#ffd166', d: '#2a1a4a', l: '#1a0f33' },
  genba_otton: { o: '#ffd166', y: '#f5c9a2', e: '#222222', r: '#ff9a2e', d: '#1a3d6e', l: '#12283d' },
  jade_young: { b: '#2f5fc4', d: '#7a4a20', e: '#201408', g: '#4aa832', k: '#2b2b2b', l: '#9a9a9a', o: '#1f5e22', r: '#ff9c33', y: '#ffd233' },
  kyoshitsu: { h: '#2b2b2b', f: '#f5c9a2', e: '#222222', g: '#8a8a95', m: '#c0392b', c: '#2b6fb5', w: '#fffdf5', p: '#2b3a5e', k: '#2b2b2b' },
  manten: { y: '#fffbe8', e: '#222222', o: '#c0392b', r: '#ff4466', d: '#e8c85a' },
  nada_mon: { c: '#1a1a2e', f: '#d9a066', e: '#ff0000', v: '#2a2a3e', s: '#8888aa', b: '#1a1a2e', p: '#0a0a1a' },
  obaan: { o: '#d8d8d8', y: '#f5c9a2', e: '#222222', r: '#e08a9a', d: '#b39ddb', l: '#8e7cc3', g: '#8a8a95' },
  ojiin: { o: '#c9c9c9', y: '#f5c9a2', e: '#222222', r: '#8a8a8a', d: '#7a8b99', l: '#55636e', c: '#8a5a2b' },
  omamori: { p: '#7a3a9a', y: '#ffd166', e: '#222222', m: '#fffdf5' },
  sairekun: { o: '#ffd166', y: '#f5c9a2', e: '#222222', r: '#c0392b', d: '#5e35b1', l: '#4527a0' },
  sotsugyo: { h: '#2b2b2b', f: '#f5c9a2', e: '#222222', m: '#c0392b', c: '#1a1a2e', y: '#ffd166', p: '#1a1a2e', k: '#2b2b2b' },
  stopwatch: { k: '#3a3a48', w: '#f5f5f0', e: '#222222', m: '#c0392b' },
  super_okan: { o: '#6b4a2f', y: '#f5c9a2', e: '#222222', r: '#ff4466', d: '#e63c82', l: '#c2185b', w: '#b8c0c8' },
  transit: { k: '#3a3a45', d: '#8a5a2b', e: '#222222', r: '#c0392b' },
  tunnel_mori: { c: '#5a6b5a', w: '#8faa8f', f: '#c9b896', e: '#222222', v: '#4a6b4a', s: '#a8c9a8', b: '#3a4a3a', p: '#2a3a2a' },
  akahon_dragon: { d: '#8b0000', o: '#c0392b', y: '#ff6b6b', e: '#ffd166', r: '#ffd166' },
  crane_king: { d: '#37474f', o: '#ffd166', l: '#1a1a1a', y: '#38c8f0', e: '#222222' },
  daiya_chicchi: { y: '#e0f7ff', d: '#a8e8ff', e: '#222222', r: '#5ec8e8', l: '#7fd8f0' },
  god_chicchi: { y: '#ffb3ff', o: '#b3ffec', e: '#222222', r: '#ffe066', d: '#b3d9ff', l: '#d9b3ff' },
  god_jade: { o: '#ffd700', l: '#fff6c0', y: '#ffc14a', g: '#3fbf7a', e: '#222222', r: '#4a4a4a' },
  god_okan: { o: '#fff2b3', y: '#fffaf0', e: '#222222', r: '#ffd166', d: '#ffe98a', l: '#ffca66' },
  god_otton: { o: '#ffd700', y: '#fff2cc', e: '#222222', r: '#ff6b6b', d: '#66d9ff', l: '#b366ff' },
  gold_otton: { o: '#ffd700', y: '#ffe98a', e: '#222222', r: '#ff8f00', d: '#b8860b', l: '#8a6d00' },
  goukaku_daruma: { d: '#1a1a1a', y: '#d32f2f', e: '#1a1a1a', r: '#fff8e1', o: '#ffd166' },
  hensachi70: { o: '#f5f5f5', y: '#f0d0b0', e: '#222222', r: '#ffd166', d: '#fffaf0', l: '#e8c85a' },
  jade_fly: { b: '#2f5fc4', e: '#241608', g: '#3f9d3f', k: '#2b2b2b', l: '#9a9a9a', o: '#a3510d', r: '#ff8c1a', y: '#ffd233' },
  jade_perch: { b: '#2f5fc4', d: '#7a4a20', e: '#241608', g: '#3f9d3f', k: '#2b2b2b', l: '#9a9a9a', o: '#a3510d', r: '#ff8c1a', w: '#ffffff', y: '#ffd233' },
  kensetsunder: { k: '#1a1a1a', o: '#ff9a2e', b: '#4a5568', r: '#ff3b3b', y: '#ffd166' },
  nada_megami: { h: '#3a1a5e', f: '#f8d9c0', e: '#222222', r: '#fff6e0', y: '#ffd166', g: '#ffe98a' },
  platina_okan: { o: '#e8e8e8', y: '#f5c9a2', e: '#222222', r: '#c0c0ff', d: '#dcdcff', l: '#b8b8e8' },
};

function gDrawChar(ctx, ch, ox, oy, s) {
  const rows = G_CHAR_SHAPE[ch.id] || G_TEMPLATE;
  const pal = G_CHAR_PAL[ch.id] || gPalette(ch);
  tDrawSprite(ctx, rows, pal, ox, oy, s);
}
function gDrawSilhouette(ctx, ch, ox, oy, s) {
  const rows = G_CHAR_SHAPE[ch.id] || G_TEMPLATE;
  const pal = G_CHAR_PAL[ch.id] || gPalette(ch);
  const dark = {};
  for (const k in pal) dark[k] = '#2a2f45';
  tDrawSprite(ctx, rows, dark, ox, oy, s);
}

// キャラ図鑑マスタ（75体＋シークレット3体）
const GACHA_CHARS = [
  // ── N（ノーマル、75体） ──
  { id:'ankicard', name:'暗記カードちゃん', rarity:'N', desc:'めくるたびに知識が増える。', voice:'めくって！' },
  { id:'anpan', name:'あんパン', rarity:'N', desc:'中身はぎっしり。', voice:'あまい〜' },
  { id:'banana', name:'バナ夫', rarity:'N', desc:'手軽に食べられる相棒。', voice:'つるん' },
  { id:'bundoki', name:'分度器さん', rarity:'N', desc:'角度のことなら任せろ。', voice:'180度！' },
  { id:'buta', name:'ブータ', rarity:'N', desc:'鼻で何でも嗅ぎ分ける。', voice:'ブヒッ' },
  { id:'chou', name:'チョウ子', rarity:'N', desc:'ひらひら舞う気まぐれ屋。', voice:'ヒラヒラ' },
  { id:'chun', name:'チュン', rarity:'N', desc:'朝はやくから鳴いてくれる。', voice:'チュンチュン！' },
  { id:'clip', name:'クリップ隊長', rarity:'N', desc:'ばらけた紙をまとめる。', voice:'パチッ' },
  { id:'compass', name:'コンパス伯爵', rarity:'N', desc:'きれいな円を描く紳士。', voice:'優雅にくるり' },
  { id:'cone', name:'コーンくん', rarity:'N', desc:'工事現場の道しるべ。', voice:'こっちやで！' },
  { id:'conebar', name:'コーンバー', rarity:'N', desc:'通せんぼの名人。', voice:'ここは通れんで' },
  { id:'crayon', name:'クレヨン兄弟', rarity:'N', desc:'16色いつも一緒。', voice:'ぬりぬり' },
  { id:'curry', name:'給食カレー', rarity:'N', desc:'みんな大好き金曜日の主役。', voice:'いいにおい〜' },
  { id:'currypan', name:'カレーパン', rarity:'N', desc:'揚げたてが最高。', voice:'アツアツやで' },
  { id:'dango', name:'三色だんご', rarity:'N', desc:'花より団子。', voice:'もちもち' },
  { id:'dangorou', name:'ダンゴロウ', rarity:'N', desc:'丸まって身を守る名人。', voice:'コロン' },
  { id:'donou', name:'土のう君', rarity:'N', desc:'積むほど頼もしい。', voice:'どっしり' },
  { id:'eiyo', name:'栄養士さん', rarity:'N', desc:'献立をきっちり組み立てる。', voice:'バランスやで' },
  { id:'enpitsu', name:'えんぴつ君', rarity:'N', desc:'芯をとがらせてやる気満々。', voice:'書くで〜' },
  { id:'fusenhime', name:'ふせん姫', rarity:'N', desc:'大事なページに貼りつく。', voice:'ここ大事！' },
  { id:'gessha', name:'月謝袋', rarity:'N', desc:'毎月そっと差し出される。', voice:'いつもありがとう' },
  { id:'gunte', name:'軍手くん', rarity:'N', desc:'手を守る現場の相棒。', voice:'がっちりや' },
  { id:'gyunyu', name:'牛乳くん', rarity:'N', desc:'給食の必須アイテム。', voice:'ごくごく' },
  { id:'hamuta', name:'ハム太', rarity:'N', desc:'ほおぶくろにお菓子満タン。', voice:'キュッ！' },
  { id:'hasami', name:'ハサミ丸', rarity:'N', desc:'紙も気持ちもスパッと切る。', voice:'チョキーン' },
  { id:'hatsudenki', name:'発電機くん', rarity:'N', desc:'現場に電気を届ける。', voice:'ブオーン' },
  { id:'hebi', name:'ヘビ助', rarity:'N', desc:'とぐろを巻いて考えごと。', voice:'シャー' },
  { id:'hitsuji', name:'ヒツジ姫', rarity:'N', desc:'数えられると眠くなる。', voice:'メエ〜' },
  { id:'jougi', name:'じょうぎマン', rarity:'N', desc:'まっすぐ線を引くプロ。', voice:'ピシッ！' },
  { id:'jukubag', name:'塾バッグ大将', rarity:'N', desc:'教材をぎっしり詰め込む。', voice:'重いけど頑張る！' },
  { id:'jukuben', name:'塾弁くん', rarity:'N', desc:'塾の合間のエネルギー補給。', voice:'おなかすいた〜' },
  { id:'kabutomaru', name:'カブト丸', rarity:'N', desc:'力持ちの甲虫の戦士。', voice:'ガオー！' },
  { id:'kaerunosuke', name:'カエル之助', rarity:'N', desc:'雨の日も元気いっぱい。', voice:'ケロケロ！' },
  { id:'kaitou', name:'解答用紙', rarity:'N', desc:'うめるほど自信になる。', voice:'ぜんぶ書けた！' },
  { id:'kakomon', name:'過去問くん', rarity:'N', desc:'本番の空気を教えてくれる。', voice:'これ出るで' },
  { id:'kamekichi', name:'カメ吉', rarity:'N', desc:'コツコツ型、実は足がはやい。', voice:'急がば回れやで' },
  { id:'karaage', name:'から揚げ大将', rarity:'N', desc:'お弁当のエース。', voice:'ジューシー！' },
  { id:'keikoupen', name:'蛍光ペン', rarity:'N', desc:'大事なところを光らせる。', voice:'ここ光らせとこ' },
  { id:'keshigomu', name:'消しゴムくん', rarity:'N', desc:'まちがいをそっと消してくれる。', voice:'スッキリ！' },
  { id:'keshikasu', name:'消しカス丸', rarity:'N', desc:'気づけば机の上にいる。', voice:'コロコロ' },
  { id:'kezuri', name:'えんぴつ削り', rarity:'N', desc:'とがらせるのが生きがい。', voice:'ゴリゴリ' },
  { id:'kingyohime', name:'金魚姫', rarity:'N', desc:'水そうの中のお姫様。', voice:'パクッ' },
  { id:'kotsu', name:'交通指導員', rarity:'N', desc:'毎朝おうだん歩道に立つ。', voice:'とまってー' },
  { id:'mezamashi', name:'目覚まし時計', rarity:'N', desc:'毎朝きっちり起こしてくれる。', voice:'ジリリリ！' },
  { id:'mikan', name:'みかん坊や', rarity:'N', desc:'こたつの相棒。', voice:'すっぱ〜い' },
  { id:'mondaishu', name:'問題集ロード', rarity:'N', desc:'積み上がるほど力がつく。', voice:'まだまだいける' },
  { id:'nekoguruma', name:'ネコ車', rarity:'N', desc:'土も道具もこれで運ぶ。', voice:'ゴロゴロ' },
  { id:'nori', name:'のりスティック', rarity:'N', desc:'何でもくっつける名脇役。', voice:'ペタッ' },
  { id:'noteshi', name:'ノート氏', rarity:'N', desc:'びっしり書き込まれた自信作。', voice:'メモメモ' },
  { id:'nyankichi', name:'ニャン吉', rarity:'N', desc:'気まぐれな学園の人気者。', voice:'にゃんにゃん！' },
  { id:'ocha', name:'お茶っ子', rarity:'N', desc:'ひと息つかせてくれる。', voice:'ふぅ〜' },
  { id:'ongaku', name:'音楽のせんせい', rarity:'N', desc:'教室に歌声をひびかせる。', voice:'はい、大きく〜' },
  { id:'onigiri', name:'おにぎり侍', rarity:'N', desc:'にぎってもらうと力が出る。', voice:'しゃけが好きや' },
  { id:'penguin', name:'ペンギン先輩', rarity:'N', desc:'すべって移動するのが速い。', voice:'ペタペタ' },
  { id:'piyo', name:'ピヨ太', rarity:'N', desc:'チッチにあこがれるひよこ。', voice:'ピヨッ！' },
  { id:'ponkichi', name:'ぽん吉', rarity:'N', desc:'ちょっとおっちょこちょい。', voice:'ぽんぽこぽん！' },
  { id:'randoseru', name:'ランドセルさん', rarity:'N', desc:'6年間の相棒、頑丈自慢。', voice:'背負ってこ！' },
  { id:'recorder', name:'リコーダーくん', rarity:'N', desc:'音楽の時間の主役。', voice:'ピーヒャラ' },
  { id:'risu', name:'リス吉', rarity:'N', desc:'ほおにどんぐりを詰め込む。', voice:'カリカリ' },
  { id:'sankaku', name:'三角定規', rarity:'N', desc:'直角がじまん。', voice:'カクッ' },
  { id:'scoop', name:'スコップくん', rarity:'N', desc:'土をほるのが得意。', voice:'ザクッ！' },
  { id:'sharpbushi', name:'シャーペン侍', rarity:'N', desc:'芯を一本も無駄にしない。', voice:'参る！' },
  { id:'shitajiki', name:'下じきさん', rarity:'N', desc:'ノートの下でしっかり支える。', voice:'まかせて' },
  { id:'shukudai', name:'宿題プリント', rarity:'N', desc:'毎日コツコツ配られる。', voice:'やってや〜' },
  { id:'taiiku', name:'体育のせんせい', rarity:'N', desc:'声がとにかく大きい。', voice:'集合ー！' },
  { id:'tamagoyaki', name:'たまごやき', rarity:'N', desc:'きれいに巻けたら気分がいい。', voice:'ふわふわ' },
  { id:'tape', name:'セロテープ王', rarity:'N', desc:'透明だけど存在感あり。', voice:'ピリピリ' },
  { id:'tarp', name:'ブルーシート', rarity:'N', desc:'雨から現場を守る。', voice:'バサッ' },
  { id:'tekkin', name:'鉄筋タワー', rarity:'N', desc:'見えないところで支える。', voice:'縁の下やで' },
  { id:'tentou', name:'テントウ丸', rarity:'N', desc:'背中の星がじまん。', voice:'コロン' },
  { id:'timer', name:'タイマーくん', rarity:'N', desc:'時間を計るお助け役。', voice:'ピピッ、終了！' },
  { id:'usagi', name:'ウサ子', rarity:'N', desc:'跳ねるのが得意な聞き上手。', voice:'ぴょんぴょん' },
  { id:'wanzou', name:'ワン蔵', rarity:'N', desc:'忠犬、いつも一緒に勉強する。', voice:'ワンワン！' },
  { id:'yomu', name:'用務員さん', rarity:'N', desc:'学校のことは何でも知っている。', voice:'掃除しとくで' },
  { id:'zabuton', name:'座布団マスター', rarity:'N', desc:'長時間の相棒。', voice:'どっしり' },
  // ── R（レア、49体） ──
  { id:'anzentai', name:'安全帯マン', rarity:'R', desc:'高いところでも守ってくれる。', voice:'命づなや' },
  { id:'bus', name:'送迎バスの運転手', rarity:'R', desc:'雨の日も塾まで送り届ける。', voice:'気をつけてな' },
  { id:'chikyugi', name:'地球儀先生', rarity:'R', desc:'世界のどこでも指させる。', voice:'ここが日本や' },
  { id:'coach', name:'コーチ', rarity:'R', desc:'声かけで背中を押してくれる。', voice:'いけるいける！' },
  { id:'dentaku', name:'電卓マン', rarity:'R', desc:'計算だけは誰にも負けない。', voice:'ピポパ' },
  { id:'dump', name:'ダンプ姫', rarity:'R', desc:'荷台いっぱいの土砂を運ぶ。', voice:'任せて！' },
  { id:'enogu', name:'絵の具パレット', rarity:'R', desc:'混ぜるほど色が増える。', voice:'まぜまぜ' },
  { id:'fork', name:'フォークン', rarity:'R', desc:'重い荷物もひょいっと持ち上げ。', voice:'リフトアップ！' },
  { id:'fude', name:'筆ノ介', rarity:'R', desc:'とめ・はね・はらいの達人。', voice:'スーッ' },
  { id:'fukurou', name:'フクロウ博士', rarity:'R', desc:'夜通し起きている物知り。', voice:'ホーホー' },
  { id:'guard', name:'警備員さん', rarity:'R', desc:'現場の交通整理をしてくれる。', voice:'とまってくださーい！' },
  { id:'hachimaki', name:'合格はちまき', rarity:'R', desc:'締めると気合いが入る。', voice:'必勝！' },
  { id:'helmet', name:'ヘル男', rarity:'R', desc:'現場の安全を守るヒーロー。', voice:'ご安全に！' },
  { id:'hensachi', name:'偏差値くん', rarity:'R', desc:'上下する数字そのもの。', voice:'今日は上がったで！' },
  { id:'hogosha', name:'保護者会長', rarity:'R', desc:'行事のたびに走り回る。', voice:'まかせといて' },
  { id:'hoken', name:'ほけん室のせんせい', rarity:'R', desc:'けがも心もケアしてくれる。', voice:'だいじょうぶ？' },
  { id:'hotchkiss', name:'ホチキス番長', rarity:'R', desc:'ひと押しでまとめあげる。', voice:'ガチャン！' },
  { id:'jisho', name:'辞書ハカセ', rarity:'R', desc:'分厚い辞書を軽々めくる。', voice:'調べてみよか' },
  { id:'jishu', name:'自習室のヌシ', rarity:'R', desc:'誰よりも長く居座る。', voice:'静かにするで' },
  { id:'jukucho', name:'塾長せんせい', rarity:'R', desc:'熱血指導で有名。', voice:'気合いや！' },
  { id:'kani', name:'カニ将軍', rarity:'R', desc:'はさみで何でも切る。', voice:'チョキン' },
  { id:'katsu', name:'カツ丸', rarity:'R', desc:'験をかつぐときの定番。', voice:'勝つで！' },
  { id:'keisan_oni', name:'計算テストの鬼', rarity:'R', desc:'制限時間はいつも厳しい。', voice:'時間やで！' },
  { id:'kinjiro', name:'金次郎ぞう', rarity:'R', desc:'歩きながら本を読む勤勉家。', voice:'こつこつが一番や' },
  { id:'kitsune', name:'キツネ丸', rarity:'R', desc:'頭の回転がはやい。', voice:'コンッ' },
  { id:'kocho', name:'校長せんせい', rarity:'R', desc:'朝礼のお話がちょっと長い。', voice:'えー、それではー' },
  { id:'kousho', name:'高所作業車', rarity:'R', desc:'高いところまで届く相棒。', voice:'上がるでー' },
  { id:'kuma', name:'クマ蔵', rarity:'R', desc:'力持ちだけど心はやさしい。', voice:'ガオー' },
  { id:'kyoto', name:'教頭せんせい', rarity:'R', desc:'縁の下の力持ち。', voice:'しっかりね' },
  { id:'kyushoku', name:'給食のおばちゃん', rarity:'R', desc:'おかわりをよそってくれる。', voice:'おかわりある？' },
  { id:'level', name:'水準器さん', rarity:'R', desc:'かたむきを見のがさない。', voice:'まっすぐや' },
  { id:'mixer', name:'ミキちゃん', rarity:'R', desc:'コンクリートをまぜまぜ。', voice:'ぐるぐる〜' },
  { id:'mogi_fuutou', name:'模試の封筒', rarity:'R', desc:'開けるのに勇気がいる。', voice:'ドキドキ…' },
  { id:'moshi', name:'模試判定マン', rarity:'R', desc:'A〜Eの判定を告げる。', voice:'今回の判定は…' },
  { id:'nenpyo', name:'年表の巻物', rarity:'R', desc:'歴史を端から端まで知る。', voice:'むかしむかし' },
  { id:'purin', name:'プリンちゃん', rarity:'R', desc:'ゆらゆらしている。', voice:'ぷるるん' },
  { id:'rammer', name:'転圧ランマー', rarity:'R', desc:'地面をドスドス固める。', voice:'ドスドス！' },
  { id:'ramune', name:'ラムネびん', rarity:'R', desc:'ビー玉を落とすのが快感。', voice:'カラン！' },
  { id:'rika', name:'理科のせんせい', rarity:'R', desc:'実験のときだけ人が変わる。', voice:'危ないから下がって' },
  { id:'roller', name:'ローラー丸', rarity:'R', desc:'道をぺったんこにならす。', voice:'ゴロゴロ〜' },
  { id:'shisho', name:'図書館の司書', rarity:'R', desc:'どの本がどこにあるか全部わかる。', voice:'静かにね' },
  { id:'shodo', name:'書道のせんせい', rarity:'R', desc:'一画に心をこめる。', voice:'とめ、はね、はらい' },
  { id:'shovel', name:'ショベルくん', rarity:'R', desc:'ミニユンボで土をすくう。', voice:'ガガガッ！' },
  { id:'shuseitape', name:'修正テープ', rarity:'R', desc:'まちがいをなかったことに。', voice:'シューッ' },
  { id:'soroban', name:'そろばん仙人', rarity:'R', desc:'暗算の達人、指がはやい。', voice:'願いましては〜' },
  { id:'tako', name:'タコ八', rarity:'R', desc:'足が8本、器用にこなす。', voice:'ニュルン' },
  { id:'tobibako', name:'とび箱マスター', rarity:'R', desc:'体育の日の主役。', voice:'とべ！とべ！' },
  { id:'tsuruhashi', name:'つるはし兄貴', rarity:'R', desc:'かたい地面もこれ一本。', voice:'ガツン！' },
  { id:'tutor', name:'チューターお姉さん', rarity:'R', desc:'やさしく質問に答えてくれる。', voice:'一緒に解こか' },
  // ── SR（スーパーレア、18体） ──
  { id:'a_hantei', name:'A判定の女神', rarity:'SR', desc:'合格をそっと後押しする。', voice:'きっと大丈夫' },
  { id:'akapen', name:'赤ペン先生', rarity:'SR', desc:'びっしり丸をつけてくれる。', voice:'よう書けたな' },
  { id:'buru_musashi', name:'ブル武蔵', rarity:'SR', desc:'地面をならす力の化身。', voice:'ならしたるで！' },
  { id:'charisma', name:'カリスマ講師', rarity:'SR', desc:'一言で教室の空気を変える。', voice:'ここ、出るで' },
  { id:'genba_otton', name:'現場オットン', rarity:'SR', desc:'作業服姿の頼れる父。', voice:'現場は任せとけ！' },
  { id:'jade_young', name:'ジェイド（ひな）', rarity:'SR', desc:'まだ緑がかった羽のころ。おっとりは生まれつき。', voice:'ピュイ…' },
  { id:'kyoshitsu', name:'教室長', rarity:'SR', desc:'生徒の名前を全員おぼえている。', voice:'調子どうや？' },
  { id:'manten', name:'満点答案', rarity:'SR', desc:'赤字ゼロの奇跡の一枚。', voice:'パーフェクトや' },
  { id:'nada_mon', name:'灘の門番', rarity:'SR', desc:'合格の扉を守っている。', voice:'覚悟はええか' },
  { id:'obaan', name:'オバーン', rarity:'SR', desc:'優しい笑顔のおばあちゃん。', voice:'無理せんとな' },
  { id:'ojiin', name:'オジーン', rarity:'SR', desc:'昔話が得意なおじいちゃん。', voice:'わしの若い頃はな〜' },
  { id:'omamori', name:'お守りちゃん', rarity:'SR', desc:'そっとカバンに入っている。', voice:'見守ってるで' },
  { id:'sairekun', name:'最レ王', rarity:'SR', desc:'最高レベル問題を極めた者。', voice:'この程度朝飯前や' },
  { id:'sotsugyo', name:'卒業生センパイ', rarity:'SR', desc:'同じ道を先に歩いた人。', voice:'その先は楽しいで' },
  { id:'stopwatch', name:'ストップウォッチ', rarity:'SR', desc:'1秒たりとも見のがさない。', voice:'はい、そこまで！' },
  { id:'super_okan', name:'スーパーオカーン', rarity:'SR', desc:'割烹着でなんでもこなす。', voice:'おたま無双や！' },
  { id:'transit', name:'トランシット', rarity:'SR', desc:'ミリ単位で見きわめる。', voice:'ぴったりや' },
  { id:'tunnel_mori', name:'トンネル守', rarity:'SR', desc:'山をつらぬく守り神。', voice:'貫通や！' },
  // ── UR（ウルトラレア、11体） ──
  { id:'akahon_dragon', name:'赤本ドラゴン', rarity:'UR', desc:'過去問を食べて育った竜。', voice:'全問暗記したで' },
  { id:'crane_king', name:'クレーンキング', rarity:'UR', desc:'現場を見下ろす鋼鉄の王。', voice:'つり上げたるで！' },
  { id:'daiya_chicchi', name:'ダイヤチッチ', rarity:'UR', desc:'ダイヤより硬い意志のひな。', voice:'ピカーッ！' },
  { id:'gold_otton', name:'ゴールドオットン', rarity:'UR', desc:'金色に輝く伝説の父。', voice:'常在戦場、黄金の意志！' },
  { id:'goukaku_daruma', name:'合格だるま大明神', rarity:'UR', desc:'願いを一つだけ叶える。', voice:'目に魂を入れよ' },
  { id:'hensachi70', name:'偏差値70仙人', rarity:'UR', desc:'極限の領域に住む賢者。', voice:'その先を見せたる' },
  { id:'jade_fly', name:'ジェイド', rarity:'UR', desc:'チッチの弟分。のんびり屋で、ときどき飛んでくる。', voice:'ワン！' },
  { id:'jade_perch', name:'ジェイド（とまり木）', rarity:'UR', desc:'とまり木から、そばでお昼寝しながら見守る。', voice:'はよ寝や〜' },
  { id:'kensetsunder', name:'無敵重機ロボ ケンセツンダー', rarity:'UR', desc:'全部の重機が合体した伝説のロボ。', voice:'ケンセツンダー、参上！' },
  { id:'nada_megami', name:'灘中合格の大女神', rarity:'UR', desc:'灘中合格を約束する最強の女神。', voice:'きみの努力、ぜんぶ見てたで' },
  { id:'platina_okan', name:'プラチナオカーン', rarity:'UR', desc:'白金の割烹着をまとう母。', voice:'愛情も無限大や' },
  // ── シークレット（排出なし・図鑑コンプ報酬） ──
  { id:'god_chicchi', name:'神チッチ', rarity:'UR', secret:true, desc:'N・Rを極めた者だけが出会える。', voice:'ピピーッ！！！' },
  { id:'god_jade', name:'神ジェイド', rarity:'UR', secret:true, desc:'ジェイドを3つそろえた者だけが出会える。', voice:'ワンワンワン！！！' },
  { id:'god_okan', name:'神オカーン', rarity:'UR', secret:true, desc:'SR・URを極めた者だけが出会える。', voice:'全部お見通しやで' },
  { id:'god_otton', name:'神オットン', rarity:'UR', secret:true, desc:'ずかんコンプリートの証。', voice:'灘中合格、間違いなしや！' },
];

const GACHA_RATES = { N: 65.5, R: 28, SR: 5, UR: 1.5 };
// まとめ引きは 10回ぶんのコイン（270）で11回。かぶってもコインは返さず、
// そのかわり同じ子の枚数が積み上がる（図鑑の「所持数」が増える）。
const GACHA_COST = 30, GACHA_COST_10 = 270, GACHA_SET_PULLS = 11;
// 抽選は未所持を優先する（rollGacha）ので、同じレアリティ内でかぶりは出ない。
// つまりコンプ速度を決めているのは UR がどれだけ出にくいかだけ。
// 天井が短いとそこが実質のUR排出間隔になるので、率より天井のほうが効く。
const GACHA_PITY = 150; // 150連引いてもURが出なければ次で確定
const RARITY_ORDER = { N: 0, R: 1, SR: 2, UR: 3 };

function charsByRarity(rarity) { return GACHA_CHARS.filter(c => c.rarity === rarity && !c.secret); }

function getGacha() {
  const g = JSON.parse(localStorage.getItem('gacha') || '{}');
  return Object.assign({ owned: {}, pulls: 0, pityUR: 0, compRewarded: [], secretUnlocked: [] }, g);
}
function saveGachaData(g) { localStorage.setItem('gacha', JSON.stringify(g)); }

function rollRarity() {
  const r = Math.random() * 100;
  if (r < GACHA_RATES.UR) return 'UR';
  if (r < GACHA_RATES.UR + GACHA_RATES.SR) return 'SR';
  if (r < GACHA_RATES.UR + GACHA_RATES.SR + GACHA_RATES.R) return 'R';
  return 'N';
}

function rollGacha(g, forceRarity) {
  const rarity = forceRarity || (g.pityUR >= GACHA_PITY - 1 ? 'UR' : rollRarity());
  const pool = charsByRarity(rarity);
  // 同じレアリティの中から、持っているかどうかに関係なく素直に引く。
  // （未所持を優先すると、そのレアリティを集めきるまで一度もかぶらず、
  //   コンプが早くなりすぎる）
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const isDupe = !!g.owned[pick.id];
  g.owned[pick.id] = (g.owned[pick.id] || 0) + 1;
  g.pulls++;
  g.pityUR = pick.rarity === 'UR' ? 0 : g.pityUR + 1;
  // かぶったぶんは、その子の枚数として積み上がる（コインでは返さない）
  return { char: pick, isDupe, count: g.owned[pick.id] };
}

// n回ガチャを回す（コイン消費・保存込み）
// まとめ引きは 10回ぶんのコインで11回まわせて、最後の1枚はSR以上を保証。
// かぶってもコインは返さない。そのかわり同じ子の枚数が増えていく。
function doGacha(n) {
  const cost = n >= GACHA_SET_PULLS ? GACHA_COST_10 : GACHA_COST;
  if (getCoins() < cost) { showToast('コインが足りへんで！勉強してためよう！'); return null; }
  addCoins(-cost);
  const g = getGacha();
  const results = [];
  let gotSRPlus = false;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const forceRarity = (n >= GACHA_SET_PULLS && isLast && !gotSRPlus)
      ? (Math.random() < 0.3 ? 'UR' : 'SR') : null;
    const res = rollGacha(g, forceRarity);
    if (RARITY_ORDER[res.char.rarity] >= RARITY_ORDER.SR) gotSRPlus = true;
    results.push({ char: res.char, isDupe: res.isDupe, count: res.count });
  }
  saveGachaData(g);
  return results;
}

// 図鑑コンプ報酬・シークレット解放（ガチャ結果表示後に呼ぶ。冪等）
function checkZukanRewards() {
  const g = getGacha();
  const rewardMap = { N: 50, R: 80, SR: 100, UR: 150 };
  ['N', 'R', 'SR', 'UR'].forEach(rarity => {
    const pool = charsByRarity(rarity);
    const owned = pool.filter(c => g.owned[c.id]).length;
    if (owned >= pool.length && !g.compRewarded.includes(rarity)) {
      g.compRewarded.push(rarity);
      addCoins(rewardMap[rarity]);
      showGamiModal({ emoji: '📖', title: `${rarity}レア図鑑コンプ！`, lines: [`${rarity}レアぜんぶ集めたで！`, `🪙${rewardMap[rarity]}まいゲット！`] });
    }
  });
  const secretDefs = [
    { id: 'god_chicchi', need: ['N', 'R'] },
    { id: 'god_okan',    need: ['SR', 'UR'] },
    { id: 'god_otton',   need: 'all' },
    { id: 'god_jade',    need: { ids: ['jade_fly', 'jade_perch', 'jade_young'] } },
  ];
  const totalOwned = GACHA_CHARS.filter(c => !c.secret && g.owned[c.id]).length;
  const totalAll = GACHA_CHARS.filter(c => !c.secret).length;
  secretDefs.forEach(def => {
    if (g.secretUnlocked.includes(def.id)) return;
    const ok =
      def.need === 'all'      ? totalOwned >= totalAll :
      Array.isArray(def.need) ? def.need.every(r => g.compRewarded.includes(r)) :
                                def.need.ids.every(id => g.owned[id]);
    if (ok) {
      g.secretUnlocked.push(def.id);
      g.owned[def.id] = 1;
      const ch = GACHA_CHARS.find(c => c.id === def.id);
      showGamiModal({ emoji: '✨', title: 'シークレット解放！', lines: [`${ch.name}が図鑑に加わった！`, `「${ch.voice}」`] });
    }
  });
  saveGachaData(g);
}

// ── ガチャ画面 ────────────────────────────────────────────
function initGacha() {
  document.getElementById('gacha-coins').textContent = getCoins();
  document.getElementById('gacha-btn-1').onclick = () => runGachaAnim(1);
  document.getElementById('gacha-btn-10').onclick = () => runGachaAnim(GACHA_SET_PULLS);
  document.getElementById('gacha-btn-zukan').onclick = () => { initZukan(); showScreen('zukan'); };
  document.querySelectorAll('#screen-gacha [data-back="subject"]').forEach(b => { b.onclick = () => showScreen('subject'); });
  document.getElementById('gacha-capsule').className = 'gacha-capsule';
  document.getElementById('gacha-result').classList.add('hidden');
  const cv = document.getElementById('gacha-canvas');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}

async function runGachaAnim(n) {
  const cost = n >= GACHA_SET_PULLS ? GACHA_COST_10 : GACHA_COST;
  if (getCoins() < cost) { showToast('コインが足りへんで！勉強してためよう！'); return; }
  const btn1 = document.getElementById('gacha-btn-1'), btn10 = document.getElementById('gacha-btn-10');
  btn1.disabled = true; btn10.disabled = true;

  const results = doGacha(n);
  document.getElementById('gacha-coins').textContent = getCoins();
  if (!results) { btn1.disabled = false; btn10.disabled = false; return; }

  const capsule = document.getElementById('gacha-capsule');
  const maxRarity = results.reduce((m, r) => RARITY_ORDER[r.char.rarity] > RARITY_ORDER[m] ? r.char.rarity : m, 'N');
  capsule.className = 'gacha-capsule shake-' + maxRarity;
  tSfx('gachaShake');
  await new Promise(r => setTimeout(r, { N: 800, R: 1200, SR: 1800, UR: 2500 }[maxRarity]));
  capsule.classList.add('open-' + maxRarity);
  tSfx(maxRarity === 'UR' ? 'gachaUR' : maxRarity === 'SR' ? 'gachaSR' : 'gachaOpen');
  await new Promise(r => setTimeout(r, 350));

  await showGachaResults(results);
  checkZukanRewards();
  document.getElementById('gacha-coins').textContent = getCoins();

  capsule.className = 'gacha-capsule';
  btn1.disabled = false; btn10.disabled = false;
}

function showGachaResults(results) {
  return new Promise(resolveAll => {
    const box = document.getElementById('gacha-result');
    const cv = document.getElementById('gacha-canvas');
    const ctx = cv.getContext('2d');
    box.classList.remove('hidden');

    let i = 0;
    const showOne = () => {
      const { char, isDupe, count } = results[i];
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = { N: '#3a3f55', R: '#1c3f7a', SR: '#7a5a10', UR: '#4a1c7a' }[char.rarity];
      ctx.fillRect(0, 0, cv.width, cv.height);
      gDrawChar(ctx, char, cv.width / 2 - 44, 14, 8);

      const rarityEl = document.getElementById('gacha-result-rarity');
      rarityEl.textContent = char.rarity;
      rarityEl.className = 'gacha-rarity-badge rarity-' + char.rarity;
      const tagEl = document.getElementById('gacha-result-tag');
      // かぶりはコインでは返さず、その子の枚数として積み上がる。
      // 「また同じか」ではなく「その子が強くなった」と見えるようにする。
      tagEl.textContent = isDupe ? `+1 つよくなった！ ×${count}` : 'NEW!';
      tagEl.className = 'gacha-tag ' + (isDupe ? 'dupe' : 'new');
      document.getElementById('gacha-result-name').textContent = char.name;
      document.getElementById('gacha-result-desc').textContent = char.desc;
      document.getElementById('gacha-result-count').textContent = `${i + 1} / ${results.length}`;
      const tapBtn = document.getElementById('gacha-btn-tap');
      tapBtn.textContent = i === results.length - 1 ? 'かくにん！' : '次へ ›';
      tapBtn.onclick = () => {
        i++;
        if (i < results.length) showOne();
        else { box.classList.add('hidden'); resolveAll(); }
      };
    };
    showOne();
  });
}

// ── 図鑑画面 ──────────────────────────────────────────────
function initZukan() {
  const g = getGacha();
  document.querySelectorAll('#screen-zukan [data-back="gacha"]').forEach(b => { b.onclick = () => { initGacha(); showScreen('gacha'); }; });

  const totalOwned = GACHA_CHARS.filter(c => !c.secret && g.owned[c.id]).length;
  const totalAll = GACHA_CHARS.filter(c => !c.secret).length;
  document.getElementById('zukan-pct').textContent = `${totalOwned} / ${totalAll}`;
  document.getElementById('zukan-bar').style.width = `${Math.round(totalOwned / totalAll * 100)}%`;

  const grid = document.getElementById('zukan-grid');
  grid.innerHTML = '';
  [['N', 'N'], ['R', 'R'], ['SR', 'SR'], ['UR', 'UR'], ['秘', '？？？ シークレット']].forEach(([rarity, label]) => {
    const list = rarity === '秘' ? GACHA_CHARS.filter(c => c.secret) : charsByRarity(rarity);
    if (!list.length) return;
    const h = document.createElement('h3');
    h.className = 'zukan-rarity-h rarity-' + (rarity === '秘' ? 'UR' : rarity);
    h.textContent = rarity === '秘' ? label : `${rarity}レア`;
    grid.appendChild(h);
    const row = document.createElement('div');
    row.className = 'zukan-row';
    list.forEach(ch => {
      const owned = !!g.owned[ch.id];
      const cell = document.createElement('button');
      cell.className = 'zukan-cell' + (owned ? '' : ' unowned');
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      cell.appendChild(cv);
      const label2 = document.createElement('span');
      label2.textContent = owned ? ch.name : '？？？';
      cell.appendChild(label2);
      const ctx = cv.getContext('2d');
      if (owned) gDrawChar(ctx, ch, 8, 4, 6); else gDrawSilhouette(ctx, ch, 8, 4, 6);
      cell.onclick = () => showZukanModal(ch, owned, g.owned[ch.id] || 0);
      row.appendChild(cell);
    });
    grid.appendChild(row);
  });
}

function showZukanModal(ch, owned, count) {
  const modal = document.getElementById('zukan-modal');
  const cv = document.getElementById('zukan-modal-canvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (owned) gDrawChar(ctx, ch, cv.width / 2 - 55, 8, 10); else gDrawSilhouette(ctx, ch, cv.width / 2 - 55, 8, 10);
  document.getElementById('zukan-modal-rarity').textContent = ch.secret ? 'シークレット' : ch.rarity;
  document.getElementById('zukan-modal-rarity').className = 'gacha-rarity-badge rarity-' + (ch.secret ? 'UR' : ch.rarity);
  document.getElementById('zukan-modal-name').textContent = owned ? ch.name : '？？？';
  document.getElementById('zukan-modal-desc').textContent = owned ? ch.desc : 'まだ出会っていない…';
  document.getElementById('zukan-modal-voice').textContent = owned ? `「${ch.voice}」` : '';
  document.getElementById('zukan-modal-count').textContent = owned ? `所持数：${count}` : '';
  modal.classList.remove('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('zukan-modal-close').onclick = () => document.getElementById('zukan-modal').classList.add('hidden');
});
