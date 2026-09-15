'use strict';
/* origami_recipe.schema.json（正本）から、画面が <script> で読む origami_recipe.schema.js を作る／一致を確かめる。
   ★なぜ要るか（2026-09-14・本人の実機で発覚）：freefold3d.html を file:// で開くと、Chrome は fetch('origami_recipe.schema.json') を
     「Failed to fetch」で断る＝袋折りの検証器が準備できない。<script> なら file:// でも http でも同じように読める。
   🚨正本は JSON のまま（Python の origami_recipe.py も JSON を読む）。.js は JSON の文字列をそのまま包むだけ＝中身を手で書かない。
   使い方： node schema_js.js          … 作り直す
            node schema_js.js --check  … 一致していなければ exit 1（検査から呼ぶ）
*/
const fs = require('node:fs'), path = require('node:path');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const JSON_PATH = path.join(DIR, 'origami_recipe.schema.json'), JS_PATH = path.join(DIR, 'origami_recipe.schema.js');
function render(text) {
 JSON.parse(text);/* 壊れた JSON を包まない */
 return '/* 自動生成（node schema_js.js）。正本は origami_recipe.schema.json。手で書きかえない。 */\n'
  + 'globalThis.ORIGAMI_RECIPE_SCHEMA = JSON.parse(' + JSON.stringify(text) + ');\n';
}
const want = render(fs.readFileSync(JSON_PATH, 'utf8'));
if (process.argv.includes('--check')) {
 const got = fs.existsSync(JS_PATH) ? fs.readFileSync(JS_PATH, 'utf8') : null;
 if (got !== want) { console.error('origami_recipe.schema.js が origami_recipe.schema.json と一致しません（node schema_js.js で作り直してください）'); process.exit(1) }
 console.log('origami_recipe.schema.js は JSON と一致');
} else { fs.writeFileSync(JS_PATH, want); console.log('wrote origami_recipe.schema.js') }
