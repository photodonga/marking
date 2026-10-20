// PWA start_url points at test.html: preserve byte-for-byte parity until manifest migration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const production = fs.readFileSync('index.html');
const test = fs.readFileSync('test.html');
assert.deepEqual(test, production, 'test.html must be byte-identical to index.html');
const manifest = JSON.parse(fs.readFileSync('marking-test.webmanifest','utf8'));
assert.equal(manifest.start_url, './test.html', 'PWA entrypoint changed without migration');
console.log('PASS: production and PWA test entrypoints are byte-identical');
