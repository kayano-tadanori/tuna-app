const fs = require('fs');

// original bodies captured before edit (re-derive from a fresh git-less backup is not available,
// so we recompute expected non-svg text by stripping all <svg>...</svg> blocks from both the
// current (new) and a reference copy is not present; instead we check structural invariants
// directly against the current files, and cross-check the two target files against each other).

const files = ['data/shakai_nippon.json', 'scripts/nippon_kokudo.json'];
const ids = ['sha_kokudo_05', 'sha_kokudo_06', 'sha_kokudo_07', 'sha_kokudo_08', 'sha_kokudo_09'];

const parsed = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));

// 1) both files must produce identical bodies for the 5 target cards
ids.forEach(id => {
  const a = parsed[0].find(c => c.id === id);
  const b = parsed[1].find(c => c.id === id);
  if (!a || !b) throw new Error('missing ' + id);
  if (a.title !== b.title) throw new Error('title mismatch ' + id);
  if (a.category !== b.category) throw new Error('category mismatch ' + id);
  if (a.body !== b.body) throw new Error('body mismatch between files for ' + id);
  console.log(id, 'OK: title/category/body identical across both files. title=', a.title);
});

// 2) dangerous tag / attribute check + path count + balanced svg tags, for each card body
const DANGEROUS = [/<script/i, /<iframe/i, /onerror\s*=/i, /onclick\s*=/i, /javascript:/i];
ids.forEach(id => {
  const card = parsed[0].find(c => c.id === id);
  const body = card.body;
  DANGEROUS.forEach(re => {
    if (re.test(body)) throw new Error(`dangerous pattern ${re} found in ${id}`);
  });
  const svgOpen = (body.match(/<svg/g) || []).length;
  const svgClose = (body.match(/<\/svg>/g) || []).length;
  if (svgOpen !== svgClose) throw new Error(`unbalanced svg tags in ${id}: open=${svgOpen} close=${svgClose}`);
  // count paths within the japan-map svg (viewBox 0 0 1536.8191 1750.5018)
  const mapMatch = body.match(/<svg viewBox="0 0 1536\.8191 1750\.5018"[\s\S]*?<\/svg>/);
  if (!mapMatch) throw new Error(`real map svg not found in ${id}`);
  const pathCount = (mapMatch[0].match(/<path d="/g) || []).length;
  if (pathCount < 47) throw new Error(`${id}: expected >=47 <path d= elements (47 prefectures), found ${pathCount}`);
  console.log(id, `OK: no dangerous tags, svg balanced (${svgOpen}), map path count=${pathCount}, total svg tags in body=${svgOpen}`);
});

// 3) confirm old ellipse-based fake map (viewBox 0 0 260 372) is gone from these 5 cards
ids.forEach(id => {
  const card = parsed[0].find(c => c.id === id);
  if (/<svg viewBox="0 0 260 372"/.test(card.body)) {
    throw new Error(`${id} still contains old ellipse fake-map svg`);
  }
  console.log(id, 'OK: old ellipse fake map removed');
});

// 4) confirm non-map svgs (bar charts / schematic diagrams) are preserved (spot check counts)
const nonMapSvgExpected = {
  sha_kokudo_05: 1, // the 3-triangle アルプス close-up diagram
  sha_kokudo_06: 1, // 扇状地・三角州 cross-section diagram
  sha_kokudo_07: 1, // river-length bar chart
  sha_kokudo_08: 1, // リアス海岸 schematic diagram
  sha_kokudo_09: 1  // rainfall bar-chart grid (6 panels)
};
ids.forEach(id => {
  const card = parsed[0].find(c => c.id === id);
  const totalSvg = (card.body.match(/<svg/g) || []).length;
  const expectedTotal = 1 /* real map */ + nonMapSvgExpected[id];
  if (totalSvg !== expectedTotal) {
    throw new Error(`${id}: expected ${expectedTotal} total <svg> (1 map + ${nonMapSvgExpected[id]} other), found ${totalSvg}`);
  }
  console.log(id, `OK: total svg count = ${totalSvg} (1 real map + ${nonMapSvgExpected[id]} other diagram preserved)`);
});

console.log('\nALL VERIFICATION CHECKS PASSED');
