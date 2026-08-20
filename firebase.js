// ============================================================
// Firebase 設定
// ※ Firebaseプロジェクト作成後、下記の値を自分のプロジェクトの値に書き換えてください
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCEWbHfGMcSQpELPGNdVgLiXZ_mmYTqsPg",
  authDomain:        "tuna-app-4eeab.firebaseapp.com",
  projectId:         "tuna-app-4eeab",
  storageBucket:     "tuna-app-4eeab.firebasestorage.app",
  messagingSenderId: "84928365508",
  appId:             "1:84928365508:web:89190838d4d7dd93e89a91",
  measurementId:     "G-Z5B3YQEHQE"
};

// ============================================================
// Firebase 初期化
// ============================================================

let db = null;
let firebaseReady = false;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK未読み込み。オフラインモードで動作します。');
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    firebaseReady = true;
    console.log('Firebase 接続成功');
  } catch (e) {
    console.warn('Firebase 初期化失敗:', e.message);
  }
}

// ============================================================
// スコア保存
// ============================================================

async function saveScore(nickname, category, correct, total) {
  if (!firebaseReady || !nickname) return;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
  try {
    const userRef = db.collection('users').doc(nickname)
      .collection('progress').doc(category);
    const snap = await userRef.get();
    const prev = snap.exists ? snap.data() : { correct: 0, total: 0 };
    await userRef.set({
      correct: prev.correct + correct,
      total:   prev.total + total,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const lbRef = db.collection('leaderboard').doc(category)
      .collection('scores').doc(nickname);
    const newCorrect = prev.correct + correct;
    const newTotal   = prev.total + total;
    await lbRef.set({
      rate: newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 0,
      correct: newCorrect,
      total:   newTotal,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('スコア保存失敗:', e.message);
  }
}

// ============================================================
// 自分の進捗取得
// ============================================================

async function getMyProgress(nickname) {
  if (!firebaseReady || !nickname) return null;
  const categories = ['kotowaza','kanyoku','yojijukugo','gairaigo'];
  const result = {};
  try {
    for (const cat of categories) {
      const snap = await db.collection('users').doc(nickname)
        .collection('progress').doc(cat).get();
      result[cat] = snap.exists ? snap.data() : { correct: 0, total: 0 };
    }
    return result;
  } catch (e) {
    console.warn('進捗取得失敗:', e.message);
    return null;
  }
}

// ============================================================
// ランキング取得
// ============================================================

async function getLeaderboard(category) {
  if (!firebaseReady) return [];
  try {
    const snap = await db.collection('leaderboard').doc(category)
      .collection('scores')
      .orderBy('rate', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(d => ({ nickname: d.id, ...d.data() }));
  } catch (e) {
    console.warn('ランキング取得失敗:', e.message);
    return [];
  }
}

// ============================================================
// 達成率ランキング（がんばりの記録）
// ============================================================

// titleIdx は互換のため書き続けるが、表示には使わない（称号は pct から引き直す）。
// TITLES の段数を変えると保存済みの番号が別の称号を指すため。
async function saveAchievement(nickname, pct, cleared, titleIdx) {
  if (!firebaseReady || !nickname) return;
  try {
    await db.collection('achievement').doc(nickname).set({
      pct, cleared, titleIdx,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('達成率保存失敗:', e.message);
  }
}

// ログインしただけ（＝問題を解いていない／記録が空の端末／別端末で入り直した）でも
// 「最後にひらいた時刻」を残す。管理ツールの一覧に出る時刻はこの lastUpdated（2026-08-20）。
// ★pct・cleared・titleIdx には一切さわらない。merge で lastUpdated だけ上書きする。
//   達成率まで送ると、記録が空の端末の 0% でクラウドを塗りつぶす事故になる
//   （2026-08-04に実際に起きた上書き事故と同じ形）。
// ★ドキュメントが無いときは作らない。ルールが pct を必須にしているので弾かれるし、
//   まだ1問も解いていない受験番号を一覧に出す意味もない。
async function touchAchievementTime(nickname) {
  if (!firebaseReady || !nickname) return false;
  try {
    const ref = db.collection('achievement').doc(nickname);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.set({ lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('最終ログイン時刻の保存に失敗:', e.message);
    return false;
  }
}

async function getAchievementDoc(nickname) {
  if (!firebaseReady || !nickname) return null;
  try {
    const snap = await db.collection('achievement').doc(nickname).get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('達成率取得失敗:', e.message);
    return null;
  }
}

async function getAchievementRanking() {
  if (!firebaseReady) return null;
  try {
    const snap = await db.collection('achievement')
      .orderBy('pct', 'desc')
      .limit(20)
      .get();
    return snap.docs.map(d => ({ nickname: d.id, ...d.data() }));
  } catch (e) {
    console.warn('達成率ランキング取得失敗:', e.message);
    return null;
  }
}

// ============================================================
// ミニゲームのスコアランキング（テトリス・おかんスイーパー）
// ============================================================

// better: 'max'=大きいほど良い（テトリス）, 'min'=小さいほど良い（スイーパーのタイム）
async function saveGameScore(game, nickname, value, better) {
  if (!firebaseReady || !nickname) return;
  try {
    const ref = db.collection('game_scores').doc(game).collection('scores').doc(nickname);
    const snap = await ref.get();
    if (snap.exists) {
      const prev = snap.data().value;
      if (better === 'max' ? value <= prev : value >= prev) return; // 自己ベストのみ更新
    }
    await ref.set({
      value,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn('ゲームスコア保存失敗:', e.message);
  }
}

async function getGameRanking(game, dir) {
  if (!firebaseReady) return null;
  try {
    const snap = await db.collection('game_scores').doc(game).collection('scores')
      .orderBy('value', dir === 'min' ? 'asc' : 'desc')
      .limit(10)
      .get();
    return snap.docs.map(d => ({ nickname: d.id, ...d.data() }));
  } catch (e) {
    console.warn('ゲームランキング取得失敗:', e.message);
    return null;
  }
}

// ============================================================
// 端末データのクラウドバックアップ（コイン・ガチャ・アイテム等）
// ============================================================

// 直近のバックアップ結果（デバッグ画面と管理ツールでの切り分け用）。
// 失敗を握りつぶすと「管理ツールで progress だけ見えない」の原因が永久に分からないので、
// 何が起きたかを必ず残す（2026-07-27・本人報告「最近参加した人は見えない」）
window.lastBackupInfo = null;

async function saveLocalBackup(nickname, payload) {
  if (!firebaseReady || !nickname) return;
  const keys = Object.keys(payload);
  const sizes = {};
  keys.forEach(k => { sizes[k] = String(payload[k] || '').length; });
  try {
    await db.collection('users').doc(nickname).collection('backup').doc('data').set({
      ...payload,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.lastBackupInfo = { ok: true, at: new Date().toISOString(), keys, sizes };
  } catch (e) {
    window.lastBackupInfo = { ok: false, at: new Date().toISOString(), keys, sizes,
                              code: e.code || '', message: e.message || '' };
    console.warn('バックアップ保存失敗:', e.code, e.message, sizes);
    // ★progress を外して再試行してはいけない。
    //   .set() は上書きなので、progress 抜きで書くと クラウドの progress が消える。
    //   実際これが「管理ツールで達成率の中身だけ見えない」状態を作っていた（2026-07-27）。
    //   失敗したら 何もせず、次の機会にまるごと書き直す。
  }
}

async function getLocalBackup(nickname) {
  if (!firebaseReady || !nickname) return null;
  try {
    const snap = await db.collection('users').doc(nickname).collection('backup').doc('data').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('バックアップ取得失敗:', e.message);
    return null;
  }
}

// 管理ツールからの「プレゼント（アイテム・コイン・遊び券）付与予約」を取得／消化。
// users/{nickname}/backup/grants に書かれた予約を、アプリ起動時に1回だけ取り込む。
// backup/{doc} なので既存のセキュリティルールで許可済み（新しいルール不要）。
async function getPendingGrants(nickname) {
  if (!firebaseReady || !nickname) return null;
  try {
    const snap = await db.collection('users').doc(nickname).collection('backup').doc('grants').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('付与予約の取得失敗:', e.message);
    return null;
  }
}
async function clearPendingGrants(nickname) {
  if (!firebaseReady || !nickname) return;
  try {
    await db.collection('users').doc(nickname).collection('backup').doc('grants').delete();
  } catch (e) {
    console.warn('付与予約の削除失敗:', e.message);
  }
}

// ============================================================
// フィードバック（もんだいの通報・いけんばこ）
// ============================================================

// ドキュメントIDは 20260816_たろう_0 の形（YYYYMMDD_受験番号_連番0〜5）。
// ルールが末尾の連番を 0〜5 に縛り、create しか許さないので、
// 「同じIDには2度書けない＝受験番号ごとに1日6件」が上限になる。
// なので .add() ではなく必ず .doc(id).set() で書くこと。
//
// 戻り値は文字列コード（呼び出し側でメッセージを出し分けるため）：
//   'ok' 送れた / 'no-firebase' オフライン設定 / 'no-nickname' 受験番号なし
//   'duplicate' そのIDは埋まっている（呼び出し側で連番+1して再試行）
//   'save-failed' それ以外の失敗
window.lastFeedbackInfo = null;

async function saveFeedback(nickname, docId, payload) {
  if (!firebaseReady) return 'no-firebase';
  if (!nickname)     return 'no-nickname';
  try {
    await db.collection('feedback').doc(docId).set({
      ...payload,
      nickname,
      status: 'new',                                       // ルールで 'new' 以外は弾かれる
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    window.lastFeedbackInfo = { ok: true, at: new Date().toISOString(), docId };
    return 'ok';
  } catch (e) {
    window.lastFeedbackInfo = { ok: false, at: new Date().toISOString(), docId,
                                code: e.code || '', message: e.message || '' };
    console.warn('フィードバック保存失敗:', e.code, e.message);
    // 既に使われているIDへの書き込みは「更新」扱いになり permission-denied で返る。
    // 端末のキャッシュを消して連番がズレたときにここへ来るので、呼び出し側で +1 して1回だけ再試行する。
    if (e.code === 'permission-denied') return 'duplicate';
    return 'save-failed';
  }
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', initFirebase);
