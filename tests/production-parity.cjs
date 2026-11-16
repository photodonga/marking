// 공식 페이지 하나만 배포: 매니페스트가 공식 주소를 시작점으로 쓰는지 확인한다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
assert.ok(!fs.existsSync('test.html'), 'test.html은 정리되었으므로 다시 만들지 않습니다');
const html = fs.readFileSync('index.html','utf8');
assert.ok(html.includes('href="./marking.webmanifest"') || html.includes("marking.webmanifest"), 'index.html must link marking.webmanifest');
const manifest = JSON.parse(fs.readFileSync('marking.webmanifest','utf8'));
assert.equal(manifest.start_url, './', 'PWA should start at the official page');
console.log('PASS: single official entrypoint and manifest');
