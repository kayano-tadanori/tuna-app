// 既存の連鎖問題（sansu_chain / rika_chain）の学年タグを、内容に合わせて付け直す
const fs = require('fs');
const path = require('path');

// 算数：内容の履修学年で再割り当て
const SANSU_GRADES = {
  sc_chain_01: 6, // 循環小数→分数（受験・小6）
  sc_chain_02: 3, // 過不足算（計算は小3で解ける・思考問題）
  sc_chain_03: 6, // 三角形の面積比（面積比は小6）
  sc_chain_04: 4, // 植木算・規則性（小4）
  sc_chain_05: 5, // つるかめ算＋クモ（小5）
  sc_chain_06: 6, // 同じものを含む順列（小6）
  sc_chain_07: 6, // 2進法・3進法（受験・小6）
  sc_chain_08: 5, // 食塩水の濃度（小5）
  sc_chain_09: 5, // 旅人算・出会い算（小5）
  sc_chain_10: 5, // 直方体の体積（小5）
};

// 理科：小5の塾教材由来の内容は小5、発展的な計算・概念は小6
const RIKA_GRADES = {
  rchain01: 6, // 月の公転周期の逆算（式が発展的）
  rchain02: 6, // 天球・緯度・年周運動
  rchain03: 5, // 光の性質
  rchain04: 5, // 音の速さと風
  rchain05: 5, // 状態変化（氷）
  rchain06: 6, // てこ＋動滑車＋仕事の原理
  rchain07: 6, // 浮力
  rchain08: 6, // 気体発生＋中和
  rchain09: 5, // 地層と化石
  rchain10: 5, // 電磁石と回路
  rchain11: 5, // アサガオ（植物）
  rchain12: 5, // こん虫の育ち方
};

function retag(file, map) {
  const full = path.join(__dirname, '..', file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  data.forEach(c => { if (map[c.id] !== undefined) c.grade = map[c.id]; });
  fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
  const byGrade = {};
  data.forEach(c => { byGrade[c.grade] = (byGrade[c.grade] || 0) + 1; });
  console.log(file, 'grades:', JSON.stringify(byGrade));
}

retag('data/sansu_chain.json', SANSU_GRADES);
retag('data/rika_chain.json', RIKA_GRADES);
