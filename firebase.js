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

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', initFirebase);
