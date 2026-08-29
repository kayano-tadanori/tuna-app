from fractions import Fraction as F

results = {}

# テーマ1: 兄弟の貯金 和2400 差400
def theme1():
    ani, imouto = (2400+400)//2, (2400-400)//2
    assert ani+imouto==2400 and ani-imouto==400
    return ani, imouto
results['テーマ1'] = theme1()

# 練習1-1 畑1360m2 差520
def p1_1():
    michiko = (1360-520)//2
    sachiko = michiko+520
    assert sachiko+michiko==1360 and sachiko-michiko==520
    return sachiko, michiko
results['1-1'] = p1_1()

# 練習1-2 周320 たて-よこ=30
def p1_2():
    s = 320//2
    yoko = (s-30)//2
    tate = yoko+30
    assert tate+yoko==s and tate-yoko==30
    return tate*yoko
results['1-2'] = p1_2()

# 練習1-3 A-B=12 A-C=24 B+C=88
def p1_3():
    # B=A-12, C=A-24, B+C=2A-36=88
    A = (88+36)//2
    B = A-12
    C = A-24
    assert A-B==12 and A-C==24 and B+C==88
    return A,B,C
results['1-3'] = p1_3()

# テーマ2 色紙 姉47 妹23
def theme2():
    return (47-23)//2
results['テーマ2'] = theme2()

# 練習2-1 ①2000,1200 ②5000,3600
def p2_1():
    return (2000-1200)//2, (5000-3600)//2
results['2-1'] = p2_1()

# 練習2-2 けんじ2600、500円あげて同じに
def p2_2():
    # after: kenji-500 = makoto+500 = (2600+makoto)/2
    # solve: 2600-500 = (2600+makoto)/2 -> makoto = 2*(2100)-2600
    makoto = 2*(2600-500)-2600
    assert (2600-500)==(makoto+500)
    return makoto
results['2-2'] = p2_2()

# 練習2-3 みゆき after=1900, ひろみが600あげた
def p2_3():
    hiromi_after = 1900
    hiromi_before = hiromi_after+600
    miyuki_before = 1900-600
    assert hiromi_before-600==miyuki_before+600
    return hiromi_before
results['2-3'] = p2_3()

# テーマ3 夏子秋子、差4こ、100円精算
def theme3():
    return 100//(4//2)
results['テーマ3'] = theme3()

# 練習3-1 ①差6こ180円 ②差10こ250円
def p3_1():
    return 180//(6//2), 250//(10//2)
results['3-1'] = p3_1()

# 練習3-2 差8こ、1こ20円
def p3_2():
    return (8//2)*20
results['3-2'] = p3_2()

# 練習3-3 ゆう子5000円出した、同数のみかん、よう子から1300円もらった
def p3_3():
    # diff = 5000 - Y, return = diff/2 = 1300 -> diff=2600 -> Y=2400
    diff = 1300*2
    Y = 5000-diff
    total = 5000+Y
    assert 5000-total//2==1300
    return Y
results['3-3'] = p3_3()

# B1 54000円 一郎=二郎+3000 三郎=二郎-6000
def b1():
    # 3*jiro -3000 = 54000 -> jiro
    jiro = (54000+3000)//3
    ichiro = jiro+3000
    saburo = jiro-6000
    assert ichiro+jiro+saburo==54000
    return ichiro,jiro,saburo
results['B1'] = b1()

# B2 昼-夜=80分, 昼+夜=1440分
def b2():
    yoru = (1440-80)//2
    hiru = yoru+80
    return hiru,yoru  # in minutes
results['B2'] = b2()

# B3 昨年女子=g 男子=g+30 今年男子=g+25 今年女子=g+15 合計260
def b3():
    g = (260-40)//2
    last_f, last_m = g, g+30
    this_m, this_f = g+25, g+15
    assert this_m+this_f==260
    return {
        '①今年差': this_m-this_f,
        '②昨年合計': last_f+last_m,
        '③今年男子': this_m,
        '④昨年女子': last_f,
    }
results['B3'] = b3()

# B4 合計1120 姉が妹に160わたすと同じ
def b4():
    diff = 160*2
    imouto = (1120-diff)//2
    ane = imouto+diff
    assert ane+imouto==1120 and ane-160==imouto+160
    return ane, imouto
results['B4'] = b4()

# B5 兄3000 弟2100 兄が弟にx渡すと兄が弟より200多い
def b5():
    # (3000-x)-(2100+x)=200
    x = (3000-2100-200)//2
    assert (3000-x)-(2100+x)==200
    return x
results['B5'] = b5()

# B6 1000+1000=2000円で みかん100こ、多く取った分の半分の代金=200円
def b6():
    price = 2000//100
    diff = 200//price*2  # (diff/2)*price=200
    katsuo = 50+diff//2
    assert katsuo*price - (100-katsuo)*price == 200*2  # not directly; verify via total
    # verify: kaeshi = (katsuo-buri)/2 * price
    buri = 100-katsuo
    assert (katsuo-buri)//2*price==200
    return katsuo
results['B6'] = b6()

# C1: 8 numbers 1,3,...,15. sum - 2k = 38
def c1():
    nums=[1,3,5,7,9,11,13,15]
    total=sum(nums)
    # (total-k)-k=38
    for k in nums:
        if (total-k)-k==38:
            return k
results['C1'] = c1()

# C2: 3人合計7500、さつき→ゆかり800、まみえ→ゆかり400、後で等しい
def c2():
    each = 7500//3
    satsuki = each+800
    mamie = each+400
    yukari = each-800-400
    assert satsuki+mamie+yukari==7500
    assert satsuki-800==each and mamie-400==each and yukari+800+400==each
    return satsuki,mamie,yukari
results['C2'] = c2()

# C3: A,B,C squares. A side=23 (top bracket). B+C side sum=23 (=a, since a=b+c geometrically). C-B=4
def c3():
    a = F(23)
    B_side = (a-4)/2
    C_side = B_side+4
    assert B_side+C_side==a
    A_area = a*a
    B_area = B_side*B_side
    C_area = C_side*C_side
    total = A_area+B_area+C_area
    return A_area,B_area,C_area,total
results['C3'] = c3()

for k,v in results.items():
    print(k, v)
