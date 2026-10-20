const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/ui-main.json','utf8'));
const html = fs.readFileSync('index.html','utf8');
const css = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/i)?.[0];
const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/>\s+</g,'><').trim();
const hash = text => {
  let h = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(text,'utf8')) h = ((h ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16,'0');
};
assert.equal(fixture.algorithm,'fnv1a64-utf8');
assert.equal(hash(css),fixture.cssHash,'CSS differs from reviewed main baseline');
assert.equal(hash(markup),fixture.markupHash,'Markup differs from reviewed main baseline');
if(process.env.CI) {
  const mergeBase = execFileSync('git',['merge-base','HEAD','origin/main'],{encoding:'utf8'}).trim();
  assert.equal(mergeBase,fixture.baselineSha,'Fixture is stale: merge-base differs from baseline SHA');
}
console.log('PASS: CSS and markup match reviewed main baseline '+fixture.baselineSha);
