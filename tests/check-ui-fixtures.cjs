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
assert.match(fixture.baselineSha,/^[0-9a-f]{40}$/);
assert.equal(hash(css),fixture.cssHash,'CSS differs from reviewed main baseline');
assert.equal(hash(markup),fixture.markupHash,'Markup differs from reviewed main baseline');
if(process.env.CI) {
  const run = (args) => {
    try { execFileSync('git', args, {stdio:'pipe'}); return true; }
    catch (error) { if(error.status===1)return false; throw error; }
  };
  assert.ok(run(['merge-base','--is-ancestor',fixture.baselineSha,'HEAD']),
    'Fixture baseline must be an ancestor of HEAD');
  assert.ok(run(['diff','--quiet',fixture.baselineSha,'HEAD','--','index.html','test.html','src/']),
    'Fixture update required: protected app sources differ from baseline');
}
console.log('PASS: CSS and markup match reviewed main baseline '+fixture.baselineSha);
