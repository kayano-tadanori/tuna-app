# A1 中間再生データ

`origami_playback.py` は原本 v1 JSON を読み、`origami-playback` version 1 を生成する。
既存 `origami_recipe.convert()`、`to_work_js.py`、原本・既存作品の生成結果は変更しない。
これはアプリへそのまま登録する作品JSではない。

```text
python -B tools/origami_playback.py tools/recipe_examples/lion.origami.json
python -B tools/origami_playback.py tools/recipe_examples/lion.origami.json --output tools/lion.playback.json
python -B tools/test_origami_playback.py
```

出力指定なしは検証だけ。出力は `tools/` 内の新規 `.json` のみで、既存パスは拒否する。
書き出す前に全体を生成・検証し、排他的作成で保存する。
既存の作品IDは原本情報として保存するだけで、登録・試作IDの割り当てはしない。

## データ契約

- `recipe`: 注記・著作者情報・近似値の根拠・元のヒントを含む原本の完全なコピー。
  `recipeSha256` はキー順をソートした空白なしUTF-8 JSONのSHA-256（元ファイルのバイトハッシュではない）。
- `steps`: 原本と1対1。`sourceStepId` / `diagramStep` / `op` / `originalInstruction` を保持。
  `beforeFrame` / `afterFrame` は、初期状態を0とするフレーム番号。
- `bones`: `parent` / `hinge` は既存 `FOLD.computeBoneMatrices` と同じ原紙上のヒンジ規約。
  ボーンは親より後に配置。`sourceStepIndex` / `sourceStepIds` は原本の折りとの対応。
  内部の履歴はボーン構築にだけ利用し、原本の対象層は `faceId` / `layerPath` で保持する。
- `faces`: 最終分割面ごとに安定したID・由来・原本多角形・ボーン・頂点・三角形の対応を保存。
  `frames[].faceStates` がその最終面に対応する各時点の祖先面を示す。
  途中の1面から最終面への対応は1対多。将来の分割線は初期形状には現れない同一平面の境界。
- `mesh`: 原紙の頂点・三角形・頂点ごとのボーン番号。紙の2D座標 `(x,y)` は3Dの `(x,0,-y)`。
  正規化原本座標の場合は `y` を `aspectRatio` で割る。三角形の原紙法線は `+Y`。
- `frames`: 初期状態＋各操作後の状態。`boneAngles` はラジアン。
  `bodyPose` は行優先4×4、列ベクトルへ左から適用する全体姿勢。
  **全体姿勢 × ボーン行列 × 原紙頂点** の順。既存OGLの列優先配列とは格納形式が異なる。
  `oracleAffine` は検証用2D変換 `[m00,m01,m10,m11,tx,ty]`。描画の位置計算には使わない。

## 操作

- `fold`: 対象面・折線・山谷・折る側を原本のまま保存。`boneIds` と `targetAngles` が動く骨。
  直前の全体姿勢・親骨の姿勢を含め、90度時点で谷は画面手前（+Y）、山は奥（-Y）へ動く符号を選ぶ。
  `movingFaceIndices` が対象層の部分集合であることを検証。無関係な面の連動はエラー。
- `crease`: 骨・全体姿勢を変えず `recordedCreases` に手IDを追加。
  `targetLines` は対象面ごとの原本上の直線と `clipToFace:true`。A2では対応する面領域で切り取って描く。
  巻き戻しは前フレームの記録を復元する。折って開く中間動作は表現しない。
- `flip`: `v` はZ軸、`h` はX軸の180度回転を全体姿勢の左から合成。
  骨の角度は変えない。末尾や連続する裏返しも独立したフレームになる。
  軸は直前の図の画面軸。全体の中心は原紙の原点で、現在形状の重心ではない。

`faceStates[].layerRank` は図の見る側からの2D順位（大きいほど手前）。
`bodyLayerRanks` は裏返しを除いた本体座標での順位であり、裏返し時には不変。
面別の値なので同じ骨の面でも異なる順位を持てる。A2/A3で骨単位に潰してはいけない。
これは2D計算結果の転送であり、3Dの衝突・紙厚シミュレーションではない。
`paper.colorDown` は原本のまま保持。可視面の法線と組み合わせる着色はA2/A3の担当。

## 検証と境界

Pythonでは保存・再読込後の骨回転から各頂点と法線を計算し、原本を再実行した2Dと照合する。
許容位置誤差は原紙半幅1に対して `1e-5`。既存骨構築の小数6桁丸めを含む。
山谷の符号反転は180度の終了形だけでは検出できないので90度も検証する。
層順位・注記・面由来・折り筋履歴・対象面・出力パスの改変もテストする。

`test_origami_playback_engine.js` は既存 `js/gl.js` / `js/fold.js` を読み取り、
実際の `FOLD.computeBoneMatrices` と2D参照値を照合する。
`ORIGAMI_PLAYBACK_BROWSER=1` を設定してPythonテストを実行すると実Chromeでも同じ検査を行う。
ブラウザの一時プロファイル以外は書かず、A1の検査ではアプリUI・WebGL描画は操作しない。

A2の残作業は新形式専用の読み取り・手順進行・折り筋表示/記録/巻き戻し、面別の層と着色、
`proto_lion_v1` のブラウザ表示検証。A3の全体姿勢アニメーション・カメラとヒントの整合は未実装。
既存作品の再生成・登録、自由順再生、つぶし折り・袋折り、自動解釈は対象外。
