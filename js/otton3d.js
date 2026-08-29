// ============================================================
// オットン3Dビューア
//   ログイン画面とトップ画面のキャラを、静止画から3Dモデルに差し替える。
//   外部ライブラリは使わない（チッチジャンプ3D／おとんテトリス2と同じ方針）。
//
//   ★キャンバスは1枚だけ作って、表示中の画面へ引っ越しさせる。
//     画面ごとに作るとWebGLコンテキストが増えてiPhoneで落ちるため。
//
//   ★モデル(models/otton.glb)は骨つきだがアニメは入っていない。
//     Tポーズのままだと突っ立って見えるので、姿勢も動きもここのコードで作る。
//     モデルの作り直しは scripts/build_otton3d.js。
// ============================================================

(function () {
  'use strict';

  // ---- キャラの一覧 ------------------------------------------------------
  //   ★4体とも Tripo で作った素材を scripts/build_otton3d.js で削ったもの。
  //     人（オットン・オカーン）は骨の名前が同じなので、姿勢もしぐさも同じ型が効く。
  //     鳥（チッチ・ジェイド）は Tripo の自動リグで名前が bone_N ＝
  //     どれが翼・尾・足かは scripts/inspect_bones.js で実測して当てた。
  //   fitH … 縦に収めたい高さ／eyeY … カメラの高さ（モデルの座標で）
  const CHARS = {
    otton:   { url: 'models/otton.glb',   fitH: 1.06, eyeY: 0.52, headY: 0.80, headH: 0.42 },
    okan:    { url: 'models/okan.glb',    fitH: 0.98, eyeY: 0.50, headY: 0.80, headH: 0.42 },
    // 鳥は左右にうすいので、正面ぴったりだと平べったく見えるうえ、
    // 翼をたたんだ姿も分かりにくい。少しななめに構えておく（baseYaw）。
    chicchi: { url: 'models/chicchi.glb', fitH: 1.00, eyeY: 0.38, headY: 0.58, headH: 0.32, baseYaw: 0.42 },
    jade:    { url: 'models/jade.glb',    fitH: 0.56, eyeY: 0.30, headY: 0.44, headH: 0.26, baseYaw: 0.38 },
  };
  const DEFAULT_CHAR = 'otton';

  // どの画面のどこに置くか。showScreen() から onScreen() で呼ばれる
  //
  // ★トップ画面(subject)は既定で入れない。置き場所の .otton-small-wrap に
  //   backdrop-filter: blur(14px) が掛かっていて、そのすりガラスの箱の中で
  //   毎フレーム描くWebGLキャンバスを回すと、iOS Safari がページごと落ちる。
  //   （2026-08-24。受験番号を保存ずみだと起動直後がトップ画面なので、
  //     アプリが毎回そこで落ちて「問題が繰り返し起きました」になった）
  //   → style.css の .otton-small-wrap から backdrop-filter を外して直した。
  //     ★あそこに すりガラスを戻すなら、この枠も同時に外すこと。
  //   調べたいときは URLに ?otton3d=nosmall で、トップ画面だけ静止画に戻せる。
  const ALL_SLOTS = {
    nickname:  { sel: '#otton-3d-hero',  focus: 'body', sway: 0.40, shadow: true,  char: 'otton' },
    subject:   { sel: '#otton-3d-small', focus: 'head', sway: 0.55, shadow: false, char: 'otton' },
    // キャラ紹介ページは4体ならぶので、どの子を出すかはスクロールで決める
    // （startCharacterWatch）。ここの sel は「この画面を使う」という印だけ。
    character: { sel: '#otton-3d-char',  focus: 'body', sway: 0.40, shadow: true,  char: 'otton' },
  };
  const SLOTS = {};
  for (const k in ALL_SLOTS) {
    if (k === 'subject' && window.OTTON3D_MODE === 'nosmall') continue;
    SLOTS[k] = ALL_SLOTS[k];
  }

  // ---- しぐさ（POSEの角度を置きかえる。時間をかけて混ぜる）----
  //  腕の骨は「0＝真横（Tポーズ）」。左腕はマイナスで下がりプラスで上がる。右腕は逆。
  //  ここの数値は _otton_preview.html で1つずつ描いて見比べて決めた（2026-08-24）
  const GESTURES_HUMAN = {
    // ハチマキを締め直す。オットンらしくて顔アップでも手が画面に入る
    hachimaki: {
      in: 0.45, hold: 0.75, out: 0.55, head: true,
      bones: {
        L_Upperarm: [0, 0, -0.35], R_Upperarm: [0, 0, 0.35],
        L_Forearm: [0, 0, 2.40], R_Forearm: [0, 0, -2.40],
        Spine02: [-0.13, 0, 0], Head: [0.02, 0, 0],
      },
    },
    // ガッツポーズ
    guts: {
      in: 0.28, hold: 0.85, out: 0.45,
      bones: {
        L_Upperarm: [0, 0, -0.55], R_Upperarm: [0, 0, 0.55],
        L_Forearm: [0, 0, 1.55], R_Forearm: [0, 0, -1.55],
        Spine01: [-0.16, 0, 0], Spine02: [-0.26, 0, 0], Head: [0.12, 0, 0],
      },
    },
    // 手をふる（右手を上げて、ひじから左右にふる）
    wave: {
      in: 0.40, hold: 1.70, out: 0.50, head: true,
      bones: {
        R_Upperarm: [0, 0, -1.30], R_Forearm: [0, 0, 0.30], R_Clavicle: [0, 0, -0.18],
        Head: [0.10, -0.13, 0],
      },
      swing: { bone: 'R_Forearm', axis: 2, amp: 0.34, hz: 2.4 },
    },
    // うなずく
    nod: {
      in: 0.22, hold: 0.30, out: 0.30, head: true,
      bones: { Head: [0.42, 0, 0], NeckTwist01: [0.30, 0, 0], Spine02: [-0.06, 0, 0] },
    },
    // 万歳（オーッ！）
    banzai: {
      in: 0.20, hold: 0.70, out: 0.40,
      bones: {
        L_Upperarm: [0, 0, 1.40], R_Upperarm: [0, 0, -1.40],
        L_Forearm: [0, 0, 0.02], R_Forearm: [0, 0, -0.02],
        Spine01: [-0.16, 0, 0], Spine02: [-0.24, 0, 0], Head: [-0.10, 0, 0],
      },
      root: () => ({ y: 0.02 }),
    },
    // 背のび（ぐーっと伸びる）
    stretch: {
      in: 0.65, hold: 0.80, out: 0.70,
      bones: {
        L_Upperarm: [0, 0, 1.30], R_Upperarm: [0, 0, -1.30],
        L_Forearm: [0, 0, -0.20], R_Forearm: [0, 0, 0.20],
        Spine01: [-0.22, 0, 0], Spine02: [-0.30, 0, 0], Head: [-0.18, 0, 0],
      },
      root: () => ({ y: 0.03, sy: 1.04 }),
    },
    // お辞儀
    bow: {
      in: 0.35, hold: 0.40, out: 0.45,
      bones: {
        Spine01: [0.26, 0, 0], Spine02: [0.20, 0, 0], Head: [0.24, 0, 0], NeckTwist01: [0.16, 0, 0],
        L_Upperarm: [0.14, 0, -1.30], R_Upperarm: [-0.14, 0, 1.30],
      },
    },
    // 首をかしげる
    tilt: {
      in: 0.30, hold: 0.55, out: 0.40, head: true,
      bones: { Head: [0.04, 0.12, 0.30], NeckTwist01: [0, 0.06, 0.16] },
    },
    // あごに手（考える）
    think: {
      in: 0.40, hold: 0.90, out: 0.45, head: true,
      bones: {
        R_Upperarm: [0, 0, 0.42], R_Forearm: [0, 0, -2.25],
        Head: [0.06, -0.10, 0.10], Spine02: [-0.10, 0, 0],
      },
    },
    // その場でジャンプ（しゃがむ→跳ぶ→着地でぷにっとつぶれる）
    jump: {
      in: 0.18, hold: 0.55, out: 0.22,
      bones: {
        L_Upperarm: [0, 0, 0.55], R_Upperarm: [0, 0, -0.55],
        L_Forearm: [0, 0, 0.35], R_Forearm: [0, 0, -0.35],
        Spine02: [-0.10, 0, 0],
      },
      root: u => {
        // 0〜.22 しゃがむ / .22〜.78 跳ぶ / .78〜1 着地
        if (u < 0.22) { const k = u / 0.22; return { y: -0.03 * k, sy: 1 - 0.07 * k, sx: 1 + 0.05 * k }; }
        if (u < 0.78) {
          const k = (u - 0.22) / 0.56, h = Math.sin(k * Math.PI);
          return { y: -0.03 + 0.20 * h, sy: 1 + 0.06 * h, sx: 1 - 0.04 * h };
        }
        const k = (u - 0.78) / 0.22, d = Math.sin(k * Math.PI);
        return { y: -0.035 * d, sy: 1 - 0.09 * d, sx: 1 + 0.07 * d };
      },
    },
    // くるっと一回転
    spin: {
      in: 0.15, hold: 0.85, out: 0.15,
      bones: {
        L_Upperarm: [0, 0, -0.85], R_Upperarm: [0, 0, 0.85],
        L_Forearm: [0, 0, 0.55], R_Forearm: [0, 0, -0.55],
      },
      root: u => ({ y: 0.012 * Math.sin(u * Math.PI), yaw: u * u * (3 - 2 * u) * Math.PI * 2 }),
    },
  };

  // ---- 立ち姿（骨のローカル軸まわりに X→Y→Z の順で足す角度・ラジアン）----
  //  Tポーズ（腕が真横）から、胸を張った「常在戦場」の構えにする
  const POSE_OTTON = {
    Spine01:     [-0.10, 0.00, 0.00],   // 背すじを起こす
    Spine02:     [-0.18, 0.00, 0.00],   // 胸を張る
    NeckTwist01: [0.14, 0.00, 0.00],    // 反らせたぶん、あごが上がらないよう戻す
    Head:        [0.08, 0.00, 0.00],
    L_Clavicle:  [0.00, 0.00, 0.10],    // 肩を後ろに引く
    R_Clavicle:  [0.00, 0.00, -0.10],
    L_Upperarm:  [0.00, 0.00, -1.20],   // Tポーズから腕を下ろす
    R_Upperarm:  [0.00, 0.00, 1.20],
    L_Forearm:   [0.00, 0.00, -0.22],
    R_Forearm:   [0.00, 0.00, 0.22],
    L_Hand:      [0.00, 0.00, -0.10],
    R_Hand:      [0.00, 0.00, 0.10],
  };

  // ---- オカーン（骨の名前はオットンと同じ）------------------------------
  //  「やさしく包み込む」ほうなので、胸は張らずに ほんの少し前かがみ。
  //   腕はオットンより体に近づけて、手のひらを前に向ける。
  const POSE_OKAN = {
    Spine01:     [-0.04, 0.00, 0.00],
    Spine02:     [-0.06, 0.00, 0.00],
    NeckTwist01: [0.05, 0.00, 0.00],
    Head:        [0.03, 0.00, 0.00],
    L_Clavicle:  [0.00, 0.00, 0.05],
    R_Clavicle:  [0.00, 0.00, -0.05],
    L_Upperarm:  [0.00, 0.00, -1.28],
    R_Upperarm:  [0.00, 0.00, 1.28],
    L_Forearm:   [0.00, 0.00, -0.34],
    R_Forearm:   [0.00, 0.00, 0.34],
    L_Hand:      [0.00, 0.00, -0.08],
    R_Hand:      [0.00, 0.00, 0.08],
  };

  // オカーン独自のしぐさ。人の共通ぶん（手をふる・うなずき等）に足して使う。
  //   ★ひじ(Forearm)の軸（オカーンで実測・2026-08-29）。**上腕は立ち姿のまま**にして
  //     ひじだけで作る（上腕を動かすと ひじのローカル軸ごと回って 思った所へ行かない）。
  //       X … ＋が大きいほど 手が「前 → お腹 → 胸」へ上がってくる（左右とも同符号）
  //             1.3 でお腹の前（どうぞ）／2.0 で胸の前（手を合わせる）
  //       Z … 横にひらく（左が＋・右が−）。1.5 で大きく広げる
  //       Y … ひねり
  const GESTURES_OKAN_ONLY = {
    // 両手を広げて迎える（「よう来たな」）。
    //   ★「腰に手」は このリグでは作れなかった（ひじを曲げると手が横へ回る）。
    //     広げて迎えるほうが オカーンらしいので こちらにした。
    mukae: {
      in: 0.40, hold: 1.10, out: 0.50,
      bones: {
        L_Upperarm: [0, 0, -1.28], R_Upperarm: [0, 0, 1.28],
        L_Forearm: [0.60, 0, 1.50], R_Forearm: [0.60, 0, -1.50],
        Spine02: [-0.08, 0, 0], Head: [0.05, 0, 0],
      },
    },
    // ほめる（両手を胸の前で合わせて、ぱちぱち）
    home: {
      in: 0.35, hold: 1.30, out: 0.45, head: true,
      bones: {
        L_Upperarm: [0, 0, -1.28], R_Upperarm: [0, 0, 1.28],
        L_Forearm: [2.00, 0, 0.10], R_Forearm: [2.00, 0, -0.10],
        Head: [0.10, 0, 0], Spine02: [-0.10, 0, 0],
      },
      swing: { bone: 'R_Forearm', axis: 0, amp: 0.22, hz: 3.2 },
      swing2: { bone: 'L_Forearm', axis: 0, amp: 0.22, hz: 3.2 },
    },
    // おいでおいで（片手を上げて手まねき）
    maneki: {
      in: 0.35, hold: 1.40, out: 0.45, head: true,
      bones: {
        L_Upperarm: [0, 0, -0.95], L_Forearm: [1.75, 0, 0.35],
        Head: [0.06, 0.12, 0], Spine02: [-0.05, 0, 0],
      },
      swing: { bone: 'L_Hand', axis: 0, amp: 0.42, hz: 2.0 },
    },
    // 「はい どうぞ」（両手を前に差し出す）
    dozo: {
      in: 0.45, hold: 0.95, out: 0.50,
      bones: {
        L_Upperarm: [0, 0, -1.28], R_Upperarm: [0, 0, 1.28],
        L_Forearm: [1.30, 0, 0], R_Forearm: [1.30, 0, 0],
        Spine01: [0.08, 0, 0], Head: [0.10, 0, 0],
      },
    },
    // エプロンで手をふく
    epuron: {
      in: 0.40, hold: 0.90, out: 0.45,
      bones: {
        L_Upperarm: [0, 0, -1.28], R_Upperarm: [0, 0, 1.28],
        L_Forearm: [1.45, 0, 0.30], R_Forearm: [1.45, 0, -0.30],
        Spine01: [0.06, 0, 0], Head: [0.08, 0, 0],
      },
      swing: { bone: 'L_Forearm', axis: 0, amp: 0.26, hz: 2.6 },
      swing2: { bone: 'R_Forearm', axis: 0, amp: -0.26, hz: 2.6 },
    },
  };

  // ---- 鳥（チッチ・ジェイド）--------------------------------------------
  //  骨の名前は Tripo の自動リグのまま（bone_N）。どれが翼・尾・足かは
  //  scripts/inspect_bones.js で「その骨が動かす頂点のかたまり」を実測して当てた。
  //  ★ここの数値は _otton_preview.html?char=chicchi で1つずつ描いて決める。
  const BIRD = {
    chicchi: {
      // 付け根 → 中 → 先
      wingR: ['bone_4', 'bone_6', 'bone_8'],
      wingL: ['bone_11', 'bone_12', 'bone_14'],
      head:  'tripo::Head_2',
      neck:  'tripo::Head_1',
      tail:  'bone_27',
      body:  'tripo::Spine_0',
      belly: 'tripo::Spine_1',
    },
    jade: {
      wingR: ['bone_4', 'bone_5', 'bone_7', 'bone_8'],
      wingL: ['bone_10', 'bone_11', 'bone_12', 'bone_13'],
      head:  'tripo::Spine_1',
      neck:  'tripo::Spine_0',
      tail:  'bone_27',
      tail2: 'tripo::Tail_0',
      body:  'bone_17',
      belly: 'bone_17',
    },
  };

  // 翼の骨ぜんぶに同じ角度を入れる（付け根から先へ、だんだん強く）。
  //   ★左右で同じ角度にすると そろわないことがある。Tripoのバインドが
  //     左右対称ではないため（ジェイドは左翼だけ ほぼ2倍たたまないと
  //     体の前に翼が残り、裏の白い面が見えてしまう。2026-08-29に実測）。
  //     → BIRD.<キャラ>.boostL / boostR で 付け根の効きを左右べつに直す。
  function wingPose(b, rx, ry, rz, taper) {
    const o = {};
    const put = (list, sign, boost) => list.forEach((name, i) => {
      const k = (taper ? (1 + i * taper) : 1) * (i === 0 ? (boost || 1) : 1);
      o[name] = [rx * k, ry * k * sign, rz * k * sign];
    });
    put(b.wingR, 1, b.boostR);
    put(b.wingL, -1, b.boostL);
    return o;
  }

  // ---- 鳥の骨の向き（実測。2026-08-29）--------------------------------
  //   翼をたたむ  … Z（右翼は +、左翼は −）    ＝ wingPose の rz に入れる
  //   翼を上げ下げ … X（左右とも同じ符号。+ で上）＝ 羽ばたきはこれ
  //   頭(Head_2)   … X＝左右を向く／**Y＝上下（+ で下）**／Z＝かしげる
  //   胴(Spine_0)  … X＝体ごと左右へ回る／Y＝ななめ／**Z＝前へおじぎ**
  //   尾(bone_27)  … 動きはするが**正面からはほとんど見えない**（短いので）。
  //                  尾ふりは しぐさとして弱いので「おしりを振る」に置きかえた。
  //   ★_otton_preview.html?char=jade&probe={"bone_4":[0,0,0.9]} のように
  //     1本ずつ回して見比べて決めた。正面の絵だけで決めないこと。
  const CC = BIRD.chicchi, JD = BIRD.jade;

  // 翼を「鳥の折りたたみ」でたたむ。骨1本ずつ別の角度を入れる。
  //   ★1つの角度を全部の骨に入れる（wingPose）だと、たたんでも翼が
  //     体の前へ回りこんで 裏の白い面が見えてしまう。実際の鳥のように
  //     **付け根は後ろへ・ひじで強く折る・先はそろえる** と体に沿う。
  //     2026-08-29、たーの「イラストみたいにたたんで」で作り直した。
  //   ★左右で値がちがう（Tripoのバインドが左右対称でないため）。鏡にすると そろわない。
  function wingFold(b, stepsR, stepsL) {
    const o = {};
    const lastR = stepsR[stepsR.length - 1], lastL = stepsL[stepsL.length - 1];
    b.wingR.forEach((n, i) => { const v = stepsR[i] || lastR; o[n] = v.slice(); });
    b.wingL.forEach((n, i) => { const v = stepsL[i] || lastL; o[n] = v.slice(); });
    return o;
  }

  // 立ち姿。チッチは元から翼がたたまれ気味なので ほんの少しだけ。
  // ジェイドは大きく広げた形でバインドされているので、しっかりたたむ。
  const POSE_CHICCHI = Object.assign(wingPose(CC, 0, 0, 0.18, 0.25), {
    'tripo::Head_2': [0.03, 0, 0],
  });
  // ---- 翼をたたむ角度は「計算で」出した（2026-08-29）------------------
  //   目で総当たりしても そろわなかったので、GLBのスキニングを Python で
  //   再現して（scripts/../_out ではなく作業用スクリプト）、
  //   **翼の頂点が胴の外形からはみ出す量**を最小にする角度を探した。
  //   ★鳥の翼の骨は 上腕→前腕→手→指 の4段で、たたむと **Z字に折れる**。
  //     さらに 羽先（初列風切）は「手」に付いていて、たたむと前腕の下へもぐる。
  //     このモデルの羽先は **厚さ0.018の薄い1枚板に骨1本** なので、
  //     本物のように羽を1枚ずつ重ねることはできない。
  //     → 前腕の下へもぐらせて「重なって見える」形にした。
  //   チッチのたたみ角度（同じやり方で計算した）。
  //   ★たーの見立て：「閉じてるの可愛いね」＝ぴょんぴょんとコンコンでは閉じる。
  //     ふだんの立ち姿は開いたまま（アニメ寄りの絵なので そのほうが らしい）。
  const CHICCHI_FOLD_R = [[-1.30, -0.70, 0.72], [0, 0, 0.14], [0, 0, 0.04]];
  const CHICCHI_FOLD_L = [[-1.20, 0.53, -0.86], [0, 0, -0.26], [0, 0, -0.08]];

  // つけ根 → ひじ → 手首 → 羽先。羽先は前腕の下へもぐらせる
  //   ★羽先は「足より下に垂れない」ことも条件に入れて解き直した
  //     （たーの指摘「左の羽が足元に飛び出してる」。実測で y=0.011 まで
  //       落ちていて、足の底 0.062 を突きぬけていた）
  const JADE_FOLD_R = [[-1.60, 1.54, 0.00], [0, 0, -0.59], [0, 0, 1.16], [-2.40, -0.30, 0.90]];
  const JADE_FOLD_L = [[-1.68, -1.66, 0.20], [0, 0, 0.14], [0, 0, 0.42], [-1.20, -1.20, 1.80]];
  const POSE_JADE = Object.assign(wingFold(JD, JADE_FOLD_R, JADE_FOLD_L), {
    'bone_27': [0, 0, 0.10],
  });

  // ---- チッチのしぐさ ----------------------------------------------------
  //   本人（たー）から：**機嫌がいいとぴょんぴょん跳ねて移動する／
  //   くちばしで地面をコンコンする／跳ねるときは翼をたたんでいる**。
  const GESTURES_CHICCHI = {
    // ぴょんぴょん跳ねて移動する。★跳ねているあいだ翼はたたむ
    hop: {
      in: 0.15, hold: 2.10, out: 0.25,
      // ★たー「跳ねるときは翼をたたんでます」
      bones: Object.assign(wingFold(CC, CHICCHI_FOLD_R, CHICCHI_FOLD_L),
                           { 'tripo::Head_2': [0, -0.12, 0] }),
      root: u => {
        // ★本人の指定：ぴょんぴょんは「前へ」進む。
        //   カメラは正面にいるので、前＝こっちに近づく＝少し大きく見える。
        //   出っぱなしだと枠から出るので、行って戻る山なりにする。
        const n = 4, k = u * n, f = k - Math.floor(k);
        const hop = Math.sin(Math.min(1, f) * Math.PI);   // 1回ぶんの跳ね
        const go = Math.sin(u * Math.PI);                 // 行って戻る
        return {
          z: go * 0.62,                                   // 前へ（近づくぶん大きく見える）
          y: hop * 0.17,                                  // しっかり跳ぶ
          sy: 1 + hop * 0.07 - (f < 0.18 ? 0.10 : 0),     // 踏み切りでちょっとつぶれる
          sx: 1 - hop * 0.045 + (f < 0.18 ? 0.08 : 0),
          yaw: go * 0.14,
        };
      },
    },
    // くちばしで地面をコンコン
    konkon: {
      in: 0.25, hold: 1.30, out: 0.30, head: true,
      // ★たー「閉じてコンコンさせて」＝翼を閉じたまま つつく
      bones: Object.assign(wingFold(CC, CHICCHI_FOLD_R, CHICCHI_FOLD_L), {
        // ★下を向かせすぎると後頭部だけになって顔が見えない。
        //   少し横を向かせて（X）、横顔が見えるところで止める。
        'tripo::Head_1': [0.10, 0.34, 0],
        'tripo::Head_2': [0.22, 0.46, 0],
        'tripo::Spine_0': [0, 0, 0.30],    // Z＝体を前へ
      }),
      swing: { bone: 'tripo::Head_2', axis: 1, amp: 0.36, hz: 3.4 },
      root: u => ({ y: -0.025 }),
    },
    // 羽ばたく
    habataki: {
      in: 0.20, hold: 1.20, out: 0.30,
      bones: wingPose(CC, 0.30, 0, -0.30, 0.30),
      swing: { bone: CC.wingR[0], axis: 0, amp: 1.05, hz: 3.6 },
      swing2: { bone: CC.wingL[0], axis: 0, amp: 1.05, hz: 3.6 },
      root: u => ({ y: Math.abs(Math.sin(u * Math.PI * 4)) * 0.03 }),
    },
    // 首をかしげる（好奇心おうせい）
    tilt: {
      in: 0.30, hold: 0.85, out: 0.40, head: true,
      bones: { 'tripo::Head_2': [0, -0.10, 0.30], 'tripo::Head_1': [0, -0.04, 0.14] },
    },
    // おしりを ふりふり（尾は短くて正面から見えないので、体ごと振る）
    furifuri: {
      in: 0.28, hold: 1.20, out: 0.32,
      bones: Object.assign(wingPose(CC, 0.12, 0, 0.30, 0.2), { 'bone_27': [0, 0, -0.16] }),
      swing: { bone: 'tripo::Spine_0', axis: 0, amp: 0.26, hz: 2.8 },
      swing2: { bone: 'tripo::Head_2', axis: 0, amp: -0.20, hz: 2.8 },
    },
    // 翼を広げて のび
    nobi: {
      in: 0.45, hold: 0.70, out: 0.55,
      bones: Object.assign(wingPose(CC, 0.58, 0, 0, 0.22), {
        'tripo::Head_2': [0, -0.22, 0], 'tripo::Spine_0': [0, 0, -0.14],
      }),
      root: u => ({ y: 0.02 * Math.sin(u * Math.PI), sy: 1 + 0.04 * Math.sin(u * Math.PI) }),
    },
    // 羽づくろい（体を小刻みにふるわせる）
    buru: {
      in: 0.18, hold: 0.70, out: 0.22,
      bones: Object.assign(wingPose(CC, 0.10, 0, -0.25, 0.2), { 'tripo::Head_2': [0.08, 0, 0] }),
      swing: { bone: 'tripo::Head_2', axis: 1, amp: 0.18, hz: 9.0 },
      root: u => ({ sx: 1 + 0.035 * Math.sin(u * Math.PI * 14), sy: 1 - 0.02 * Math.sin(u * Math.PI * 14) }),
    },
    // 片方の翼だけ上げる（あいさつ）
    kataha: {
      in: 0.30, hold: 0.85, out: 0.40, head: true,
      bones: Object.assign(
        // 反対の翼はたたんでおく（そろって上がると「片翼」に見えない）
        { [CC.wingL[0]]: CHICCHI_FOLD_L[0], [CC.wingL[1]]: CHICCHI_FOLD_L[1], [CC.wingL[2]]: CHICCHI_FOLD_L[2] },
        { [CC.wingR[0]]: [1.15, 0, -0.55], [CC.wingR[1]]: [0.60, 0, -0.30],
          'tripo::Head_2': [0.04, -0.12, -0.18] }),
      swing: { bone: CC.wingR[1], axis: 0, amp: 0.28, hz: 2.6 },
    },
    // おじぎ
    bow: {
      in: 0.32, hold: 0.40, out: 0.40,
      bones: { 'tripo::Spine_0': [0, 0, 0.42], 'tripo::Head_1': [0, 0.20, 0] },
    },
    // くるっと一回転
    spin: {
      in: 0.15, hold: 0.80, out: 0.15,
      bones: wingPose(CC, 0.25, 0, -0.45, 0.2),
      root: u => ({ y: 0.02 * Math.sin(u * Math.PI), yaw: u * u * (3 - 2 * u) * Math.PI * 2 }),
    },
  };

  // ---- ジェイドのしぐさ --------------------------------------------------
  //   のんびり屋。お昼寝が大好き。鳴くときは「ワン！」。
  //   ウンチすると すっと体をずらす（キャラ紹介の文どおり）。
  //   ★ジェイドは頭が体と1つの骨（tripo::Spine_1）なので、首だけは動かせない。
  const GESTURES_JADE = {
    // あくび（ゆっくり翼を広げて のび）
    akubi: {
      in: 0.70, hold: 0.90, out: 0.80,
      bones: Object.assign(wingPose(JD, 0.45, 0, 0.10, 0.30), {
        'tripo::Spine_1': [0, -0.22, 0],     // Y− ＝ 上を向く
      }),
      root: u => ({ y: 0.02 * Math.sin(u * Math.PI), sy: 1 + 0.04 * Math.sin(u * Math.PI) }),
    },
    // うとうと（頭が下がって、はっと起きる）
    utouto: {
      in: 0.90, hold: 1.30, out: 0.35, head: true,
      bones: { 'tripo::Spine_1': [0, 0.34, 0.16], 'tripo::Spine_0': [0, 0, 0.12] },
      root: u => ({ y: -0.02 * Math.sin(Math.min(1, u * 1.3) * Math.PI) }),
    },
    // 「ワン！」と鳴く（体を起こして のけぞる）
    wan: {
      in: 0.16, hold: 0.30, out: 0.34, head: true,
      bones: Object.assign(wingFold(JD, JADE_FOLD_R, JADE_FOLD_L), {
        'tripo::Spine_1': [0, -0.34, 0],     // 上を向いて
        'tripo::Spine_0': [0, 0, -0.10],     // 胸をそらす
      }),
      root: u => ({ y: 0.03 * Math.sin(u * Math.PI), sy: 1 + 0.05 * Math.sin(u * Math.PI) }),
    },
    // すっと体をずらす（きれい好き）
    zurashi: {
      in: 0.35, hold: 0.55, out: 0.40,
      bones: { 'tripo::Spine_1': [0.18, 0, 0.10] },
      root: u => ({ x: Math.sin(u * Math.PI) * 0.10, yaw: Math.sin(u * Math.PI) * 0.30 }),
    },
    // ゆっくり羽ばたく
    habataki: {
      in: 0.30, hold: 1.30, out: 0.40,
      bones: wingPose(JD, 0.25, 0, 0.35, 0.25),
      swing: { bone: JD.wingR[0], axis: 0, amp: 0.70, hz: 2.2 },
      swing2: { bone: JD.wingL[0], axis: 0, amp: 0.70, hz: 2.2 },
      root: u => ({ y: Math.abs(Math.sin(u * Math.PI * 2.4)) * 0.025 }),
    },
    // 首（体ごと）をかしげる
    tilt: {
      in: 0.40, hold: 0.90, out: 0.45, head: true,
      bones: { 'tripo::Spine_1': [0.08, 0.06, 0.62] },
    },
    // 尾をふる
    tail: {
      in: 0.30, hold: 1.20, out: 0.35,
      bones: { 'bone_27': [-0.10, 0, 0] },
      swing: { bone: 'tripo::Tail_0', axis: 1, amp: 0.30, hz: 2.4 },
    },
    // 小さく跳ねる
    hop: {
      in: 0.15, hold: 0.90, out: 0.25,
      bones: wingFold(JD, JADE_FOLD_R, JADE_FOLD_L),
      root: u => {
        const n = 2, k = u * n, f = k - Math.floor(k);
        const hop = Math.sin(Math.min(1, f) * Math.PI);
        return { y: hop * 0.06, sy: 1 + hop * 0.04, sx: 1 - hop * 0.025 };
      },
    },
    // おじぎ
    bow: {
      in: 0.40, hold: 0.45, out: 0.45,
      bones: { 'tripo::Spine_1': [0, 0.30, 0], 'tripo::Spine_0': [0, 0, 0.34] },
    },
  };

  // ---- キャラごとの中身を CHARS にひもづける -----------------------------
  //   人の共通しぐさのうち、ハチマキ締め直しは オットンだけのもの。
  const GESTURES_HUMAN_SHARED = {};
  for (const k in GESTURES_HUMAN) if (k !== 'hachimaki') GESTURES_HUMAN_SHARED[k] = GESTURES_HUMAN[k];

  CHARS.otton.pose = POSE_OTTON;
  CHARS.otton.gestures = GESTURES_HUMAN;
  CHARS.okan.pose = POSE_OKAN;
  CHARS.okan.gestures = Object.assign({}, GESTURES_HUMAN_SHARED, GESTURES_OKAN_ONLY);
  CHARS.chicchi.pose = POSE_CHICCHI;
  CHARS.chicchi.gestures = GESTURES_CHICCHI;
  CHARS.jade.pose = POSE_JADE;
  CHARS.jade.gestures = GESTURES_JADE;

  let gl = null, canvas = null, prog = null, shadowProg = null;
  let mesh = null, tex = null, skel = null, ready = false, failed = false;
  let host = null, opts = null, raf = 0, t0 = 0;

  // ---- いま出しているキャラ ----------------------------------------------
  //   ★モデル・テクスチャ・骨は キャラごとに CACHE に取っておき、
  //     切りかえるときは 下の mesh/tex/skel/POSE/GESTURES を差しかえるだけにする。
  //     こうすると描くコードは1本のままで済み、**WebGLの枠も1つで足りる**
  //     （枠を増やすとiPhoneが落ちる。2026-08-24の事故）。
  const CACHE = {};
  let charKey = null;
  let charDef = CHARS[DEFAULT_CHAR];
  let POSE = POSE_OTTON;
  let GESTURES = GESTURES_HUMAN;
  let GESTURE_KEYS = Object.keys(GESTURES_HUMAN);
  let GESTURE_KEYS_HEAD = GESTURE_KEYS.filter(k => GESTURES_HUMAN[k].head);
  let dragging = false, lastX = 0, dragYaw = 0, spin = 0;
  // 見る大きさ（1＝ふつう。大きいほど寄る）。つまむ・ホイールで変わる
  let zoom = 1;
  const ZOOM_MIN = 0.55, ZOOM_MAX = 3.2;
  const clampZoom = v => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
  // 上下の回りこみ（＋で見下ろし、−で見上げ）。指を縦にすべらせると変わる
  let dragPitch = 0, lastY = 0;
  const PITCH_MIN = -0.55, PITCH_MAX = 0.85;
  const clampPitch = v => Math.min(PITCH_MAX, Math.max(PITCH_MIN, v));
  let uLoc = {}, uLocS = {};

  // ---------- 行列・クォータニオン ----------
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  // out = a * b。out に直接書く（毎フレーム配列を作らないため）
  function mulInto(out, a, b, ao, bo, oo) {
    ao = ao || 0; bo = bo || 0; oo = oo || 0;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[ao + k * 4 + r] * b[bo + c * 4 + k];
      out[oo + c * 4 + r] = s;
    }
    return out;
  }
  // Y軸まわりに回して平行移動とスケールをかける行列。
  // sy を別に渡せるのは、ジャンプの「つぶれ／のび」を作るため
  function trs(tx, ty, tz, yaw, s, sy) {
    if (sy == null) sy = s;
    const c = Math.cos(yaw), n = Math.sin(yaw);
    return [c * s, 0, -n * s, 0, 0, sy, 0, 0, n * s, 0, c * s, 0, tx, ty, tz, 1];
  }
  // カメラは「見たい高さ(eyeY)」を中心に、上下(pitch)へ回りこむ。
  //   view = 手前へ引く(dist) × X軸まわりに回す(pitch) × 中心を原点へ(-eyeY)
  function viewMat(eyeY, dist, pitch) {
    if (!pitch) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -eyeY, -dist, 1];
    const c = Math.cos(pitch), n = Math.sin(pitch);
    return [1, 0, 0, 0,
            0, c, n, 0,
            0, -n, c, 0,
            0, -c * eyeY, -n * eyeY - dist, 1];
  }
  function qmul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }
  function qeuler(x, y, z) {  // X→Y→Z の順に回す
    const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
    return qmul(qmul([sx, 0, 0, cx], [0, sy, 0, cy]), [0, 0, sz, cz]);
  }
  function composeInto(out, t, q, s) {
    const [x, y, z, w] = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0], sy = s[1], sz = s[2];
    out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
    out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
    out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
    out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
    return out;
  }

  // ---------- シェーダー ----------
  const VS = `#version 300 es
  in vec3 aPos; in vec3 aNrm; in vec2 aUv; in vec4 aJnt; in vec4 aWgt;
  uniform mat4 uMVP, uModel;
  uniform mat4 uBones[42];
  uniform bool uSkin;
  out vec3 vNrm; out vec2 vUv;
  void main(){
    vec4 p = vec4(aPos, 1.0);
    vec3 n = aNrm;
    if (uSkin) {
      mat4 sk = uBones[int(aJnt.x)] * aWgt.x + uBones[int(aJnt.y)] * aWgt.y
              + uBones[int(aJnt.z)] * aWgt.z + uBones[int(aJnt.w)] * aWgt.w;
      p = sk * p;
      n = mat3(sk) * n;
    }
    vNrm = mat3(uModel) * n;
    vUv = aUv;
    gl_Position = uMVP * p;
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec3 vNrm; in vec2 vUv;
  uniform sampler2D uTex;
  out vec4 outColor;
  void main(){
    vec3 base = texture(uTex, vUv).rgb;
    vec3 n = normalize(vNrm);
    vec3 key = normalize(vec3(0.45, 0.75, 0.85));
    vec3 fill = normalize(vec3(-0.7, 0.15, 0.5));
    // ハーフランバート。子ども向けなので影を落としすぎない
    float kd = dot(n, key) * 0.5 + 0.5;
    float fd = max(dot(n, fill), 0.0);
    vec3 lit = base * (0.62 + 0.55 * kd * kd + 0.18 * fd);
    // アプリの青いネオンに合わせたリムライト
    float rim = pow(1.0 - max(n.z, 0.0), 3.0);
    lit += vec3(0.31, 0.49, 1.0) * rim * 0.55;
    outColor = vec4(lit, 1.0);
  }`;

  // 影：カメラを水平に構えているので地面の板を置くと真横から見て消えてしまう。
  // 画面の上で直接だ円を描く（uRect = 中心x,中心y,横半径,縦半径。すべてNDC）
  const SHADOW_VS = `#version 300 es
  in vec2 aXz;
  uniform vec4 uRect;
  out vec2 vXz;
  void main(){ vXz = aXz; gl_Position = vec4(uRect.x + aXz.x * uRect.z, uRect.y + aXz.y * uRect.w, 0.0, 1.0); }`;

  const SHADOW_FS = `#version 300 es
  precision mediump float;
  in vec2 vXz; out vec4 outColor;
  void main(){
    float d = length(vXz);
    float a = smoothstep(1.0, 0.0, d);
    outColor = vec4(0.05, 0.12, 0.32, a * a * 0.34);
  }`;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function link(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  // ---------- GLBを読む（scripts/build_otton3d.js が書き出した形だけ対応） ----------
  async function loadGLB(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('model fetch ' + res.status);
    const buf = await res.arrayBuffer();
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not glb');
    const total = dv.getUint32(8, true);
    let off = 12, json = null, binOff = 0;
    while (off < total) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
      else if (type === 0x004e4942) binOff = off + 8;
      off += 8 + len;
    }
    const view = i => {
      const bv = json.bufferViews[i];
      return { start: binOff + (bv.byteOffset || 0), len: bv.byteLength };
    };
    const TAs = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
    const read = i => {
      const a = json.accessors[i], v = view(a.bufferView);
      const nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
      return new TAs[a.componentType](buf, v.start + (a.byteOffset || 0), a.count * nc);
    };
    const pr = json.meshes[0].primitives[0];
    const iAcc = json.accessors[pr.indices];
    const img = view(json.images[0].bufferView);
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(buf, img.start, img.len)], { type: json.images[0].mimeType }));
    return {
      pos: read(pr.attributes.POSITION),
      nrm: read(pr.attributes.NORMAL),
      uv: read(pr.attributes.TEXCOORD_0),
      jnt: pr.attributes.JOINTS_0 != null ? read(pr.attributes.JOINTS_0) : null,
      wgt: pr.attributes.WEIGHTS_0 != null ? read(pr.attributes.WEIGHTS_0) : null,
      idx: read(pr.indices),
      idxType: iAcc.componentType === 5123 ? 0x1403 : 0x1405,
      skeleton: json.extras && json.extras.skeleton,
      bitmap,
    };
  }

  // 骨を扱いやすい形にほぐす
  function buildSkeleton(sk) {
    const n = sk.nodes.length;
    const parent = new Int32Array(n).fill(-1);
    sk.nodes.forEach((nd, i) => (nd.children || []).forEach(c => { parent[c] = i; }));
    const byName = {};
    sk.nodes.forEach((nd, i) => { byName[nd.name] = i; });
    return {
      nodes: sk.nodes,
      parent,
      byName,
      joints: sk.joints,
      ibm: new Float32Array(sk.ibm),
      local: Array.from({ length: n }, () => new Float32Array(16)),
      world: Array.from({ length: n }, () => new Float32Array(16)),
      palette: new Float32Array(sk.joints.length * 16),
      extra: {},                                   // 骨名 -> [x,y,z] 追加回転
    };
  }

  // 姿勢＋動きから骨の行列をつくる
  function poseSkeleton(t) {
    const s = skel;
    for (let i = 0; i < s.nodes.length; i++) {
      const nd = s.nodes[i];
      const add = s.extra[nd.name];
      let q = nd.rotation || [0, 0, 0, 1];
      if (add) q = qmul(q, qeuler(add[0], add[1], add[2]));
      composeInto(s.local[i], nd.translation || [0, 0, 0], q, nd.scale || [1, 1, 1]);
      const p = s.parent[i];
      if (p < 0) s.world[i].set(s.local[i]);
      else mulInto(s.world[i], s.world[p], s.local[i]);
    }
    for (let j = 0; j < s.joints.length; j++) {
      mulInto(s.palette, s.world[s.joints[j]], s.ibm, 0, j * 16, j * 16);
    }
  }

  // ---- しぐさの進行 ----
  let gesture = null;      // { key, start }
  let nextGestureAt = 0;
  // しぐさが体ごと動かすぶん（updatePose が入れて frame が使う）
  const rootFx = { x: 0, y: 0, z: 0, yaw: 0, sx: 1, sy: 1 };

  function playGesture(key) {
    const list = (opts && opts.focus === 'head') ? GESTURE_KEYS_HEAD : GESTURE_KEYS;
    if (!key) key = list[(Math.random() * list.length) | 0];
    if (!GESTURES[key]) return;
    gesture = { key, start: -1 };   // 次のフレームの時刻を開始にする
  }

  // しぐさの重み（0→1→0）。角がとがらないように両端をなめらかにする
  function gestureWeight(g, dt) {
    if (dt < 0) return 0;
    if (dt < g.in) { const u = dt / g.in; return u * u * (3 - 2 * u); }
    if (dt < g.in + g.hold) return 1;
    const u = (dt - g.in - g.hold) / g.out;
    if (u >= 1) return -1;                       // 終わり
    return 1 - u * u * (3 - 2 * u);
  }

  // 立ち姿に、呼吸・体重移動・しぐさをのせる
  function updatePose(t) {
    const e = skel.extra;
    for (const k in POSE) e[k] = POSE[k].slice();
    rootFx.x = 0; rootFx.y = 0; rootFx.z = 0; rootFx.yaw = 0; rootFx.sx = 1; rootFx.sy = 1;

    // 待機の動き（止まって見えないよう、はっきりめに）
    const breathe = Math.sin(t * 1.15);
    const shift = Math.sin(t * 0.62);            // 体重移動
    if (e.Spine01) { e.Spine01[0] += breathe * 0.022; e.Spine01[2] = (e.Spine01[2] || 0) + shift * 0.035; }
    if (e.Spine02) { e.Spine02[0] += breathe * 0.030; e.Spine02[2] = (e.Spine02[2] || 0) + shift * 0.025; }
    if (e.Head) {
      e.Head[0] += -breathe * 0.020;
      e.Head[1] += Math.sin(t * 0.47) * 0.13;
      e.Head[2] = (e.Head[2] || 0) - shift * 0.045;
    }
    const swayArm = Math.sin(t * 0.9);
    if (e.L_Upperarm) e.L_Upperarm[2] -= swayArm * 0.055 + shift * 0.05;
    if (e.R_Upperarm) e.R_Upperarm[2] += swayArm * 0.055 + shift * 0.05;
    if (e.L_Forearm) e.L_Forearm[2] -= Math.sin(t * 0.9 + 0.6) * 0.07;
    if (e.R_Forearm) e.R_Forearm[2] += Math.sin(t * 0.9 + 0.6) * 0.07;
    // 鳥は骨の名前がちがうので、上の人むけの行はどれも当たらない（e[名前] が無い）。
    // キャラ独自の待機の動きは ここで足す。
    if (charDef.idle) charDef.idle(e, t, breathe, shift);

    // 実測用：指定した骨だけを回す（ふだんは空）
    for (const k in probe) e[k] = probe[k].slice();

    // 何もしないと飽きるので、数秒おきにしぐさを入れる
    if (!gesture && t > nextGestureAt) playGesture();
    if (!gesture) return;
    if (gesture.start < 0) gesture.start = t;
    const g = GESTURES[gesture.key];
    const w = gestureWeight(g, t - gesture.start);
    if (w < 0) {
      gesture = null;
      nextGestureAt = t + 3.2 + Math.random() * 4.5;   // しぐさが11種あるので少し詰める
      return;
    }
    for (const b in g.bones) {
      const from = e[b] || [0, 0, 0], to = g.bones[b];
      e[b] = [from[0] + (to[0] - from[0]) * w,
              from[1] + (to[1] - from[1]) * w,
              from[2] + (to[2] - from[2]) * w];
    }
    // swing … 骨を1本、行ったり来たりさせる（手をふる・羽ばたく）。
    //   両方の翼を同時に振りたいので swing2 も見る。
    for (const sw of [g.swing, g.swing2]) {
      if (!sw) continue;
      const arr = e[sw.bone];
      if (arr) arr[sw.axis] += Math.sin((t - gesture.start) * sw.hz * 6.283) * sw.amp * w;
    }
    if (g.root) {
      // 進み具合を 0→1 で渡す（跳ぶ・回る・つぶれる はここで作る）
      const dur = g.in + g.hold + g.out;
      const r = g.root(Math.min(1, (t - gesture.start) / dur), w);
      rootFx.x = (r.x || 0) * w;
      rootFx.z = (r.z || 0) * w;
      rootFx.y = (r.y || 0) * w;
      rootFx.yaw = (r.yaw || 0) * w;
      rootFx.sx = 1 + ((r.sx || 1) - 1) * w;
      rootFx.sy = 1 + ((r.sy || 1) - 1) * w;
    }
  }

  function buildGL(data) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bind = (arr, name, size, type, norm) => {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, type, !!norm, 0, 0);
    };
    bind(data.pos, 'aPos', 3, gl.FLOAT);
    bind(data.nrm, 'aNrm', 3, gl.FLOAT);
    bind(data.uv, 'aUv', 2, gl.FLOAT);
    if (data.jnt) {
      bind(data.jnt, 'aJnt', 4, gl.UNSIGNED_BYTE, false);
      bind(data.wgt, 'aWgt', 4, gl.UNSIGNED_BYTE, true);
    }
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, data.bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    if (data.bitmap.close) data.bitmap.close();

    // 足元の影の板
    const svao = gl.createVertexArray();
    gl.bindVertexArray(svao);
    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const sl = gl.getAttribLocation(shadowProg, 'aXz');
    gl.enableVertexAttribArray(sl);
    gl.vertexAttribPointer(sl, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return { mesh: { vao, svao, count: data.idx.length, idxType: data.idxType }, tex: texture };
  }

  // ---- キャラを1体ぶん読む（2回目からはCACHEを返す）----------------------
  const loading = {};
  function loadChar(key) {
    if (CACHE[key]) return Promise.resolve(CACHE[key]);
    if (loading[key]) return loading[key];
    const def = CHARS[key];
    loading[key] = (async () => {
      const data = await loadGLB(def.url);
      const built = buildGL(data);
      const c = {
        mesh: built.mesh,
        tex: built.tex,
        skel: data.skeleton ? buildSkeleton(data.skeleton) : null,
        pose: def.pose || POSE_OTTON,
        gestures: def.gestures || GESTURES_HUMAN,
      };
      c.keys = Object.keys(c.gestures);
      c.keysHead = c.keys.filter(k => c.gestures[k].head);
      if (!c.keysHead.length) c.keysHead = c.keys;   // 顔アップ用が無いキャラは全部から選ぶ
      CACHE[key] = c;
      return c;
    })();
    return loading[key];
  }

  // ---- いま出すキャラを切りかえる ----------------------------------------
  //   ★applyChar は WebGL の用意（init）が済んでいることが前提。
  //     外から呼ぶ useChar は init を待ってから applyChar する。
  //     init 自身が applyChar を呼ぶので、ここを分けないと自分を待って止まる
  //     （プレビューで Otton3D.use() を先に呼んで gl が null のまま落ちた）。
  function applyChar(key) {
    if (!CHARS[key]) key = DEFAULT_CHAR;
    return loadChar(key).then(c => {
      if (charKey === key) return c;
      mesh = c.mesh; tex = c.tex; skel = c.skel;
      POSE = c.pose; GESTURES = c.gestures;
      GESTURE_KEYS = c.keys; GESTURE_KEYS_HEAD = c.keysHead;
      charDef = CHARS[key];
      charKey = key;
      gesture = null;
      nextGestureAt = 1.2;
      dragYaw = 0; spin = 0; zoom = 1; dragPitch = 0;
      return c;
    });
  }
  function useChar(key) {
    return init().then(() => applyChar(key));
  }

  // ---------- 初期化 ----------
  let initPromise = null;
  function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      canvas = document.createElement('canvas');
      canvas.className = 'otton3d-canvas';
      gl = canvas.getContext('webgl2', {
        alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power',
      });
      if (!gl) throw new Error('no webgl2');
      // GPUがつらくなって落ちたら、あきらめて静止画に戻す（落ちたまま回し続けない）
      canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        failed = true;
        ready = false;
        console.warn('[otton3d] WebGLコンテキストが落ちた。静止画に戻す');
        // あとで原因を見分けられるように残す（otton3d-check.html で読める）
        try { localStorage.setItem('otton3d_note', 'contextlost ' + new Date().toLocaleString('ja-JP')); } catch (err) {}
        detach();
      });
      prog = link(VS, FS);
      shadowProg = link(SHADOW_VS, SHADOW_FS);
      uLoc = {
        mvp: gl.getUniformLocation(prog, 'uMVP'),
        model: gl.getUniformLocation(prog, 'uModel'),
        tex: gl.getUniformLocation(prog, 'uTex'),
        skin: gl.getUniformLocation(prog, 'uSkin'),
        bones: gl.getUniformLocation(prog, 'uBones'),
      };
      uLocS = { rect: gl.getUniformLocation(shadowProg, 'uRect') };
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      attachPointer();
      // ★uLoc を作ってからでないと buildGL の getAttribLocation が使えないので、
      //   モデルを読むのは ここまで来てから。
      await applyChar(DEFAULT_CHAR);
      ready = true;
    })().catch(e => { failed = true; console.warn('[otton3d]', e); throw e; });
    return initPromise;
  }

  function attachPointer() {
    let downX = 0, downT = 0;
    // ---- 2本指でつまむと 大きく・小さく（本人の注文・2026-08-29）----
    //   ★ページごと拡大されないよう、2本指のあいだは preventDefault する。
    //     canvas は touch-action:none（style.css）なので、ここだけ拾える。
    let pinchD0 = 0, zoom0 = 1;
    const touchDist = t =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const down = e => {
      if (e.touches && e.touches.length >= 2) {
        dragging = false;
        pinchD0 = touchDist(e.touches);
        zoom0 = zoom;
        return;
      }
      dragging = true;
      const pt = e.touches ? e.touches[0] : e;
      lastX = downX = pt.clientX;
      lastY = pt.clientY;
      downT = Date.now();
      spin = 0;
    };
    const move = e => {
      if (e.touches && e.touches.length >= 2) {
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (!pinchD0) { pinchD0 = touchDist(e.touches); zoom0 = zoom; lastY = cy; }
        const d = touchDist(e.touches);
        if (d > 0) zoom = clampZoom(zoom0 * (d / pinchD0));
        dragPitch = clampPitch(dragPitch + (cy - lastY) * 0.006);
        lastY = cy;
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - lastX, dy = pt.clientY - lastY;
      lastX = pt.clientX; lastY = pt.clientY;
      dragYaw += dx * 0.012;
      dragPitch = clampPitch(dragPitch + dy * 0.008);   // 縦にすべらせると上下に回る
      spin = dx * 0.012;
      if (e.cancelable) e.preventDefault();
    };
    const up = e => {
      if (e.touches && e.touches.length >= 1) { pinchD0 = 0; return; }  // まだ指が残っている
      pinchD0 = 0;
      // ほとんど動かさずに離したら「さわった」＝しぐさを出す
      if (dragging && Math.abs(lastX - downX) < 8 && Date.now() - downT < 400) playGesture();
      dragging = false;
    };
    // マウスのホイールでも 大きく・小さく（パソコンで見るとき用）
    const wheel = e => {
      zoom = clampZoom(zoom * (1 - e.deltaY * 0.0012));
      if (e.cancelable) e.preventDefault();
    };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('mousemove', move);
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchend', up);
    canvas.addEventListener('touchcancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
  }

  // ---------- 描画 ----------
  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return r.width / Math.max(r.height, 1);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ready || !host) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const aspect = resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!dragging) {
      dragYaw += spin;
      spin *= 0.94;
      if (Math.abs(spin) < 0.0002) spin = 0;
    }
    if (skel) updatePose(t);          // 体ごとの動き(rootFx)も ここで決まる
    const yaw = (charDef.baseYaw || 0) + Math.sin(t * 0.55) * opts.sway + dragYaw + rootFx.yaw;
    const bob = Math.sin(t * 1.15) * 0.006 + rootFx.y;

    // 画づくり：全身は少し引き、顔アップは頭の高さに寄せる
    const head = opts.focus === 'head';
    const eyeY = head ? charDef.headY : charDef.eyeY;
    const fov = 32 * Math.PI / 180;
    const fitH = head ? charDef.headH : charDef.fitH; // 縦に収めたい高さ（キャラごと）
    let dist = (fitH / 2) / Math.tan(fov / 2) + 0.55;
    if (aspect < 1) dist /= Math.max(aspect, 0.45);   // 縦長のときは引く
    dist /= zoom;                                     // つまんだぶん 寄る／引く

    const proj = perspective(fov, aspect, 0.05, 12);
    const view = viewMat(eyeY, dist, dragPitch);
    const model = trs(rootFx.x, bob, rootFx.z, yaw, rootFx.sx, rootFx.sy);
    const mvp = mul(proj, mul(view, model));

    if (opts.shadow) {
      // 足元(原点)と、そこから横に0.22の点を画面に写して、だ円の大きさを決める
      const pj = (x, y, z) => {
        const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        return [(mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w,
                (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w];
      };
      const c0 = pj(rootFx.x, 0, rootFx.z), c1 = pj(rootFx.x + 0.22, 0, rootFx.z);
      const hw = Math.abs(c1[0] - c0[0]) * 1.5;
      const hh = hw * (canvas.width / Math.max(canvas.height, 1)) * 0.36;
      gl.useProgram(shadowProg);
      gl.uniform4f(uLocS.rect, c0[0], c0[1] + hh * 0.15, hw, hh);
      gl.disable(gl.DEPTH_TEST);
      gl.bindVertexArray(mesh.svao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.DEPTH_TEST);
    }

    gl.useProgram(prog);
    gl.uniformMatrix4fv(uLoc.mvp, false, new Float32Array(mvp));
    gl.uniformMatrix4fv(uLoc.model, false, new Float32Array(model));
    gl.uniform1i(uLoc.skin, skel ? 1 : 0);
    if (skel) {
      poseSkeleton(t);
      gl.uniformMatrix4fv(uLoc.bones, false, skel.palette);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uLoc.tex, 0);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.idxType, 0);

    gl.bindVertexArray(null);
  }

  // ---------- 画面の出入り ----------
  function detach() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.classList.remove('otton3d-on');
      canvas.parentNode.removeChild(canvas);
    }
    host = null;
  }

  // ---- キャラ紹介ページ：スクロールして真ん中に来た子を3Dにする ----------
  //   ★4体ぶん枠を作らないのは、WebGLの枠を増やすとiPhoneが落ちるから
  //     （2026-08-24にアプリが起動できなくなった事故）。枠は1つだけ作って、
  //     いま画面の真ん中にいるキャラのところへ引っ越させる。
  let charScrollHost = null, charSlots = null, charCurrent = null, charTick = 0;

  function pickNearestChar() {
    if (!charSlots || !charSlots.length) return;
    const mid = window.innerHeight * 0.45;      // 画面のやや上を「真ん中」とみなす
    let best = null, bestD = 1e9;
    for (const el of charSlots) {
      const r = el.getBoundingClientRect();
      if (!r.height) continue;
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = el; }
    }
    // 画面からうんと外れているときは、そのまま前の子を出しておく（ちらつき防止）
    if (!best || bestD > window.innerHeight * 0.95) return;
    // ★「同じ子だから何もしない」だけだと、枠が別の画面に持っていかれたまま
    //   戻らないことがある（ログイン画面の枠に残る）。いまどこに居るかも見る。
    if (best === charCurrent && canvas && canvas.parentNode === best) return;
    charCurrent = best;
    mountAt(best, best.getAttribute('data-char3d'), { focus: 'body', sway: 0.40, shadow: true });
  }

  function startCharacterWatch() {
    const screen = document.getElementById('screen-character');
    if (!screen) return;
    charSlots = Array.prototype.slice.call(screen.querySelectorAll('[data-char3d]'));
    if (!charSlots.length) return;
    charCurrent = null;
    charScrollHost = screen;
    // スクロールのたびに測ると重いので、次の描画のタイミングで1回だけ測る
    screen.addEventListener('scroll', onCharScroll, { passive: true });
    // 確認用ページ（_char_preview.html）では画面ごとではなく ページ全体が
    // スクロールするので、window のぶんも見ておく。本体では動かないので害はない。
    window.addEventListener('scroll', onCharScroll, { passive: true });
    window.addEventListener('resize', onCharScroll);
    pickNearestChar();
    // ★画面が開ききる前だと 枠の高さがまだ 0 で、どの子も選べない。
    //   少しあとに もう一度みる（開いた直後にスクロールしたときの取りこぼし対策）。
    setTimeout(pickNearestChar, 350);
    // スクロールしてから読むと そこだけ静止画のままになるので、
    // 少し遅らせて残りの子も読んでおく（1体ずつ・回線をふさがないように）
    setTimeout(() => {
      const rest = charSlots.map(el => el.getAttribute('data-char3d'))
        .filter(k => CHARS[k] && !CACHE[k]);
      (function next() {
        const k = rest.shift();
        if (!k) return;
        loadChar(k).then(() => setTimeout(next, 120)).catch(() => setTimeout(next, 120));
      })();
    }, 900);
  }
  function onCharScroll() {
    if (charTick) return;
    charTick = requestAnimationFrame(() => { charTick = 0; pickNearestChar(); });
  }
  function stopCharacterWatch() {
    if (charScrollHost) charScrollHost.removeEventListener('scroll', onCharScroll);
    window.removeEventListener('scroll', onCharScroll);
    window.removeEventListener('resize', onCharScroll);
    if (charTick) { cancelAnimationFrame(charTick); charTick = 0; }
    charScrollHost = null; charSlots = null; charCurrent = null;
  }

  function onScreen(id) {
    if (id !== 'character') stopCharacterWatch();
    if (id === 'character' && SLOTS.character) {
      // 4体ならぶページ。どの子を出すかはスクロールで決める
      if (failed) return;
      init().then(startCharacterWatch).catch(() => {});
      return;
    }
    const slot = SLOTS[id];
    if (!slot) { detach(); return; }
    if (failed) return;                        // WebGL2が無い端末は静止画のまま
    if (!document.querySelector(slot.sel)) { detach(); return; }
    init().then(() => applyChar(slot.char || DEFAULT_CHAR)).then(() => {
      const target = document.querySelector(slot.sel);
      if (!target) return;
      host = target;
      opts = slot;
      if (canvas.parentNode !== target) {
        detach();
        host = target;
        target.appendChild(canvas);
      }
      target.classList.add('otton3d-on');      // 静止画を隠す
      t0 = 0;
      dragYaw = 0; dragPitch = 0; zoom = 1;
      gesture = null;
      nextGestureAt = 1.8;        // 画面に入って少ししたら1回動く
      if (!raf) raf = requestAnimationFrame(frame);
    }).catch(() => {});
  }

  // ---- 好きな枠に、好きなキャラを出す（キャラ紹介ページ用）----------------
  //   ★枠（WebGLキャンバス）は1つきり。呼ばれるたびに引っ越して、中身を差しかえる。
  //     4体ぶん枠を作るとiPhoneが落ちるため（2026-08-24の事故）。
  function mountAt(el, key, o) {
    if (failed || !el) return Promise.resolve(false);
    return init().then(() => applyChar(key)).then(() => {
      opts = Object.assign({ focus: 'body', sway: 0.40, shadow: true }, o || {});
      if (canvas.parentNode !== el) {
        if (canvas.parentNode) {
          canvas.parentNode.classList.remove('otton3d-on');
          canvas.parentNode.removeChild(canvas);
        }
        el.appendChild(canvas);
      }
      host = el;
      el.classList.add('otton3d-on');
      t0 = 0;
      if (!raf) raf = requestAnimationFrame(frame);
      return true;
    }).catch(() => false);
  }

  // 姿勢の微調整用（コンソールから Otton3D.tune({Spine02:[-0.2,0,0]}) で試せる）
  function tune(obj) {
    for (const k in obj) POSE[k] = obj[k];
  }

  // 姿勢の実測用：骨を1本だけ回して見る（_otton_preview.html?bone=... から使う）
  const probe = {};
  function setYaw(v) { dragYaw = v; }
  function setProbe(obj) {
    for (const k in probe) delete probe[k];
    for (const k in obj) probe[k] = obj[k];
  }

  window.Otton3D = {
    onScreen, detach, tune, play: playGesture,
    use: useChar,                       // キャラを切りかえる（'otton'|'okan'|'chicchi'|'jade'）
    mountAt,                            // 好きな要素に付ける（キャラ紹介ページ用）
    setProbe, setYaw,                   // 骨を1本だけ回して確かめる／横から見る
    chars: CHARS, BIRD, probe,
    get POSE() { return POSE; },
    get GESTURES() { return GESTURES; },
  };
})();
