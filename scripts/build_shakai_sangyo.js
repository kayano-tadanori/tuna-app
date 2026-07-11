'use strict';
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'shakai_sangyo.json');
const existing = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const cells = require('./gen_shakai_sangyo.js');

// ---- Independent verification pass for the 6 tax/discount calc questions in g6d4 ----
function verifyCalc(question, answer) {
  let m;
  // 消費税X%のとき、Y円の品物の税こみねだんは？
  if ((m = question.match(/消費税が?\s*(\d+)%の\s*とき、\s*(\d+)円の\s*品物の\s*税こみ\s*ねだんは/))) {
    const rate = parseInt(m[1], 10), price = parseInt(m[2], 10);
    const expected = Math.round(price * (1 + rate / 100));
    return `${expected}円` === answer;
  }
  // 消費税X%のとき、Y円の品物の消費税は何円？
  if ((m = question.match(/消費税が?\s*(\d+)%の\s*とき、\s*(\d+)円の\s*品物の\s*消費税は\s*何円/))) {
    const rate = parseInt(m[1], 10), price = parseInt(m[2], 10);
    const expected = Math.round(price * (rate / 100));
    return `${expected}円` === answer;
  }
  // 定価X円の品物をY割引きで売ると、売値は何円？
  if ((m = question.match(/定価(\d+)円の\s*品物を\s*(\d+)割引きで\s*売ると、\s*売値は\s*何円/))) {
    const price = parseInt(m[1], 10), discount = parseInt(m[2], 10);
    const expected = Math.round(price * (1 - discount / 10));
    return `${expected}円` === answer;
  }
  // 原価X円の品物にY割の利えきを見こんで定価をつけると、定価は何円？
  if ((m = question.match(/原価(\d+)円の\s*品物に\s*(\d+)割の\s*利えきを\s*見こんで\s*定価を\s*つけると、\s*定価は\s*何円/))) {
    const price = parseInt(m[1], 10), markup = parseInt(m[2], 10);
    const expected = Math.round(price * (1 + markup / 10));
    return `${expected}円` === answer;
  }
  // 税こみX円（消費税Y%）の品物の税ぬき本体価格は何円？
  if ((m = question.match(/税こみ(\d+)円（消費税(\d+)%）の\s*品物の\s*税ぬき\s*本体価格は\s*何円/))) {
    const total = parseInt(m[1], 10), rate = parseInt(m[2], 10);
    const expected = Math.round(total / (1 + rate / 100));
    return `${expected}円` === answer;
  }
  return null; // not a calc question we know how to verify
}

let calcChecked = 0, calcFailed = [];
for (const item of cells.g6d4) {
  const [q, a] = item;
  const result = verifyCalc(q, a);
  if (result !== null) {
    calcChecked++;
    if (!result) calcFailed.push({ q, a });
  }
}
console.log(`Calc verification: checked ${calcChecked} numeric items, failed ${calcFailed.length}`);
if (calcFailed.length) {
  console.error('FAILED CALC ITEMS:', JSON.stringify(calcFailed, null, 2));
  process.exit(1);
}

// ---- Build full items ----
const maxExistingId = Math.max(...existing.map(q => parseInt(q.id.replace('ss', ''), 10)));
let nextId = maxExistingId + 1;
const newItems = [];
const order = ['g3d1','g3d2','g3d3','g3d4','g4d1','g4d2','g4d3','g4d4','g5d1','g5d2','g5d3','g5d4','g6d1','g6d2','g6d3','g6d4'];

const cellCounts = {};
for (const key of order) {
  const grade = parseInt(key[1], 10);
  const difficulty = parseInt(key[3], 10);
  const arr = cells[key];
  cellCounts[key] = arr.length;
  for (const [question, answer, meaning, d1, d2, d3] of arr) {
    const choices = [answer, d1, d2, d3];
    const id = 'ss' + String(nextId).padStart(3, '0');
    nextId++;
    newItems.push({ id, question, answer, choices, meaning, grade, difficulty });
  }
}

console.log('Per-cell new counts:', cellCounts);
console.log('Total new items:', newItems.length);

// ---- Validation ----
const allItems = existing.concat(newItems);

// 1. duplicate question text
const qSeen = new Map();
const dupQuestions = [];
for (const it of allItems) {
  if (qSeen.has(it.question)) dupQuestions.push({ question: it.question, ids: [qSeen.get(it.question), it.id] });
  else qSeen.set(it.question, it.id);
}

// 2. choices validity
const badChoices = [];
for (const it of allItems) {
  if (!Array.isArray(it.choices) || it.choices.length !== 4) {
    badChoices.push({ id: it.id, reason: 'not exactly 4 choices', choices: it.choices });
    continue;
  }
  const uniq = new Set(it.choices);
  if (uniq.size !== 4) badChoices.push({ id: it.id, reason: 'not unique', choices: it.choices });
  if (!it.choices.includes(it.answer)) badChoices.push({ id: it.id, reason: 'missing answer', choices: it.choices, answer: it.answer });
}

// 3. NaN check (stringified)
const nanItems = allItems.filter(it => JSON.stringify(it).includes('NaN'));

// 4. grade/difficulty range check
const badRange = allItems.filter(it => !(it.grade >= 3 && it.grade <= 6) || !(it.difficulty >= 1 && it.difficulty <= 4));

// 5. duplicate ids
const idSeen = new Set();
const dupIds = [];
for (const it of allItems) {
  if (idSeen.has(it.id)) dupIds.push(it.id);
  idSeen.add(it.id);
}

console.log('Duplicate questions:', dupQuestions.length);
if (dupQuestions.length) console.error(JSON.stringify(dupQuestions, null, 2));
console.log('Bad choices:', badChoices.length);
if (badChoices.length) console.error(JSON.stringify(badChoices, null, 2));
console.log('NaN items:', nanItems.length);
console.log('Bad grade/difficulty range:', badRange.length);
console.log('Duplicate ids:', dupIds.length);

if (dupQuestions.length || badChoices.length || nanItems.length || badRange.length || dupIds.length) {
  console.error('VALIDATION FAILED — not writing file.');
  process.exit(1);
}

// ---- Write ----
fs.writeFileSync(dataPath, JSON.stringify(allItems, null, 2) + '\n', 'utf8');
console.log('Wrote', allItems.length, 'total items to', dataPath);

// ---- Final summary ----
const byGrade = {};
const byGD = {};
for (const it of allItems) {
  byGrade[it.grade] = (byGrade[it.grade] || 0) + 1;
  const k = it.grade + '-' + it.difficulty;
  byGD[k] = (byGD[k] || 0) + 1;
}
console.log('By grade:', byGrade);
console.log('By grade-difficulty:', byGD);
