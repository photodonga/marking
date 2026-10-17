// Protect the production index.html UI contract while refactoring test.html.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const baseline=fs.readFileSync('index.html','utf8');
const candidate=fs.readFileSync('test.html','utf8');
const removeImplementation=s=>s
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/>\s+</g,'><')
  .trim();
const style=s=>s.match(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/i)?.[0];
assert.ok(style(baseline),'Production stylesheet missing');
assert.equal(style(candidate),style(baseline),'CSS differs from production index.html');
assert.equal(removeImplementation(candidate),removeImplementation(baseline),
  'UI HTML markup differs from production index.html (outside styles/scripts)');
const ids=s=>[...s.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]).sort();
assert.deepEqual(ids(candidate),ids(baseline),'Element IDs changed from production');
assert.match(candidate,/<script src="\.\/src\/editor-helpers\.js"><\/script>/);
assert.match(candidate,/<script src="\.\/src\/editor-app\.js"><\/script>/);
assert.ok(candidate.indexOf('editor-helpers.js')<candidate.indexOf('editor-canvas.js'));
assert.ok(candidate.indexOf('editor-canvas.js')<candidate.indexOf('editor-app.js'));
console.log('PASS: production UI markup and element IDs preserved');
