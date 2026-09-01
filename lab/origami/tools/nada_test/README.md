# 灘中対策コーナーの検証道具

折ON（`lab/origami/`）の**灘中対策コーナーに問題を足したとき・エンジンを触ったとき**に走らせる。
「答えの数値が合った」だけで終わらせないための道具立て（[[feedback_verify_mechanism_not_just_answer]]）。

新しい問題を1本足す前に、**必ず `origami_sakumon_rule`（作問ルール）を先に開くこと。**

## 走らせる順番

```bash
# 0) tuna app のルートでローカルサーバーを上げる（本番と同じ静的配信にするため）
python -m http.server 8769

# 1) 与件だけから座標を組み立てて、原本の印刷解答と一致するか（アプリを使わない）
python verify_from_givens.py

# 2) 全26問を、本物のUI操作＋本物の指のドラッグで通す（折る→答えを打つ→せいかい）
python test_all_problems.py

# 3) 2 が持ち帰った「折り終わりの頂点」から、面積・長さ・角度を別ルートで計算し直す
python check_engine_geometry.py

# 4) push のあと、本番(GitHub Pages)をiPhoneと同じWebKitで確かめる
python check_production.py
```

出力（スクショ・レポート）は `_out/` に出る。**`_out/` はgitに入れない**（`.gitignore`済み）。

## それぞれ何を見ているか

| ファイル | 見ているもの |
|---|---|
| `verify_from_givens.py` | 答えを使わず、**与えられた数だけ**から座標を組み立てて印刷解答と突き合わせる。新しい問題を実装する前の下ごしらえ |
| `test_all_problems.py` | 全問について ①折る前/折った後のスクショ ②全ステップが指で折れるか ③印刷の答えを打って「せいかい」が出るか ④ラベルのはみ出し・重なり・パネルに隠れていないか ⑤コンソールエラー0件 |
| `check_engine_geometry.py` | ②が持ち帰った実物のエンジンの頂点座標から、面積・長さ・角度を**別の道すじで**計算（例：No.4の斜線67.5cm²、No.9の1/3、関西創価中のア=82°） |
| `check_production.py` | 本番のGitHub Pagesを **WebKit＋`service_workers='block'`** で開く。Firestoreへの通信は落とす |
| `pdf_crop.py` | 原本PDFを600dpi以上で切り出して読む。**問題ページだけでなく解答ページの図と丸数字まで**見る |
| `render_genbo_svg.py` | 原簿（memory）に書いたSVGを実際に描いて目で見る（弧の向きが逆でも数字では気づけない） |

## 落とし穴（実測して分かったこと）

- **指のドラッグは円弧でなぞる。** つまむ点は円を描いて動くので、始点→終点を直線でなぞると
  ヒンジの近くを通って角度が出ず、**アプリは正常なのに「折れない」と誤判定する**（No.7・No.14で発生）。
  `test_all_problems.py` は実物のエンジンで道すじを計算してからなぞっている
- **`gl.readPixels` で描画を検査してはいけない**（常に空が返る）。信用できるのは `page.screenshot()` だけ
- **本番の検証は `service_workers='block'` が要る。** 無いとiframeの読み込みが失敗して、
  直っているのに「直っていない」ように見える
- **iPhoneでだけ出る不具合は WebKit＋`tap()`** で再現する（Chromiumでは素通りする）
- ラベルの重なりで残ってよいのは、**同じ名前をわざと2つ置いている問題**（折るとBがDに重なる等）と
  **点どうしが幾何的に近い場合**（No.12のGとD'は実際に6cmしか離れていない）だけ

## アプリ側の検証用の窓口（読むだけ・本番の動きには影響しない）

- `window.__oriDebug.inst` … いまのレンダラ（`state.liveAngle` などが読める）
- `inst.worldToScreen(p)` … ワールド座標→画面座標
