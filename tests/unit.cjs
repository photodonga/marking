const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const h = require('../src/editor-helpers.js');

assert.equal(h.clamp(-1, 0, 100), 0);
assert.equal(h.clamp(120, 0, 100), 100);
assert.equal(h.clamp(35, 0, 100), 35);

const original = [{ id: 1, rect: { x: 3 }, faceRects: [{ y: 7 }] }];
const copy = h.deepCloneObjects(original);
assert.deepEqual(copy, original);
copy[0].rect.x = 9;
copy[0].faceRects[0].y = 12;
assert.equal(original[0].rect.x, 3);
assert.equal(original[0].faceRects[0].y, 7);

const baseline = { blur: { intensity: 22, feather: 82 }, mosaic: { intensity: 58, feather: 87 } };
for (const mode of Object.keys(baseline)) {
  for (const key of Object.keys(baseline[mode])) {
    for (const slider of [0, 10, 25, 50, 75, 90, 100]) {
      const actual = h.effectValueToSlider(h.effectSliderToValue(slider, mode, key, baseline), mode, key, baseline);
      assert.ok(Math.abs(actual - slider) < 1e-9, `${mode}/${key}: ${slider} -> ${actual}`);
    }
  }
}

assert.deepEqual(h.normRect({x:8,y:15},{x:2,y:5}),{x:2,y:5,w:6,h:10});
assert.equal(h.arrowDashPattern(1,3,12),null);
const dash=h.arrowDashPattern(100,2,10);
assert.ok(dash && dash.available>0 && dash.count>=1 && dash.dash>0);
assert.deepEqual(h.rectCenter({ x: 10, y: 20, w: 30, h: 40 }), { x: 25, y: 40 });
const rotated = h.rotatePoint({ x: 2, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
assert.ok(Math.abs(rotated.x) < 1e-9 && Math.abs(rotated.y - 2) < 1e-9);

for (const name of ['src/editor-helpers.js', 'src/editor-app.js']) {
  new vm.Script(fs.readFileSync(name, 'utf8'), { filename: name });
}
const html = fs.readFileSync('test.html', 'utf8');
assert.match(html, /src="\.\/src\/editor-helpers\.js"/);
assert.match(html, /src="\.\/src\/editor-app\.js"/);
assert.ok(html.indexOf('src="./src/editor-helpers.js"') < html.indexOf('src="./src/editor-app.js"'));
console.log('PASS: pure helpers, script syntax and dependency order');
