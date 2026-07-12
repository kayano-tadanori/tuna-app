// 場合の数「碁盤の目の道」問題（sansu_baai.json）に格子路のSVG図を追加する
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'sansu_baai.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function buildLatticeSvg(x, y) {
  const cell = 20;
  const pad = 22;
  const w = x * cell + pad * 2;
  const h = y * cell + pad * 2;
  let lines = '';
  for (let j = 0; j <= y; j++) {
    const yy = pad + j * cell;
    lines += `<line x1="${pad}" y1="${yy}" x2="${pad + x * cell}" y2="${yy}" stroke="#4f7cff" stroke-width="1.3" opacity="0.55"/>`;
  }
  for (let i = 0; i <= x; i++) {
    const xx = pad + i * cell;
    lines += `<line x1="${xx}" y1="${pad}" x2="${xx}" y2="${pad + y * cell}" stroke="#4f7cff" stroke-width="1.3" opacity="0.55"/>`;
  }
  const startX = pad, startY = pad + y * cell; // 左下＝スタート
  const goalX = pad + x * cell, goalY = pad;    // 右上＝ゴール
  const dots = `<circle cx="${startX}" cy="${startY}" r="4" fill="#ffd166"/><circle cx="${goalX}" cy="${goalY}" r="4" fill="#ffd166"/>`;
  const labels =
    `<text x="${startX - 6}" y="${startY + 4}" fill="#eef2ff" font-size="12" text-anchor="end" font-family="sans-serif" font-weight="bold">A</text>` +
    `<text x="${goalX + 6}" y="${goalY + 4}" fill="#eef2ff" font-size="12" text-anchor="start" font-family="sans-serif" font-weight="bold">B</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${lines}${dots}${labels}</svg>`;
}

let updated = 0;
for (const q of data) {
  if (q.svg) continue;
  const m = q.question.match(/右へ(\d+)区間・上へ(\d+)区間/);
  if (!m) continue;
  const x = Number(m[1]), y = Number(m[2]);
  q.svg = buildLatticeSvg(x, y);
  updated++;
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log('updated', updated, 'of', data.length);
