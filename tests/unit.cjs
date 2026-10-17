const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const h = require('../src/editor-helpers.js');
const canvas = require('../src/editor-canvas.js');

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

let state=h.pushHistoryEntry([], -1, [{id:1,rect:{x:1}}], [], 3);
assert.equal(state.index,0);
state=h.pushHistoryEntry(state.history,state.index,[{id:2}],[],3);
state=h.pushHistoryEntry(state.history,state.index,[{id:3}],[],3);
state=h.pushHistoryEntry(state.history,state.index,[{id:4}],[],3);
assert.deepEqual(state.history.map(x=>x.objects[0].id),[2,3,4]);
state=h.pushHistoryEntry(state.history,0,[{id:5}],[],3);
assert.deepEqual(state.history.map(x=>x.objects[0].id),[2,5]);
assert.equal(state.index,1);
const snapshot=[{id:1,rect:{x:3}}];
const saved=h.pushHistoryEntry([], -1,snapshot,[],3);
snapshot[0].rect.x=99;
assert.equal(saved.history[0].objects[0].rect.x,3);
const cache=new Map([[1,{key:'old'}],[2,{key:'live'}],[3,{key:'stale'}]]);
assert.equal(h.pruneEffectCache(cache,[{id:2}]),cache);
assert.deepEqual([...cache.keys()],[2]);
const eff={rect:{x:10,y:20,w:5,h:7},faceRects:[{x:2,y:3,w:4,h:6},{x:10,y:20,w:5,h:7}],mode:'blur',intensity:22,feather:82};
assert.deepEqual(h.effectBounds(eff),{x:2,y:3,w:13,h:24});
assert.deepEqual(h.effectCenter(eff),{x:8.5,y:15});
assert.notEqual(h.effectCacheKey(eff,960,640),h.effectCacheKey(eff,1920,1080));
assert.notEqual(h.effectCacheKey(eff,960,640),h.effectCacheKey({...eff,intensity:50},960,640));
assert.deepEqual(h.normRect({x:8,y:15},{x:2,y:5}),{x:2,y:5,w:6,h:10});
assert.equal(h.arrowDashPattern(1,3,12),null);
const dash=h.arrowDashPattern(100,2,10);
assert.ok(dash && dash.available>0 && dash.count>=1 && dash.dash>0);
assert.deepEqual(h.rectCenter({ x: 10, y: 20, w: 30, h: 40 }), { x: 25, y: 40 });
const rotated = h.rotatePoint({ x: 2, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
assert.ok(Math.abs(rotated.x) < 1e-9 && Math.abs(rotated.y - 2) < 1e-9);

const calls=[];
const fake={clearRect:(...a)=>calls.push(['clearRect',...a]),drawImage:(...a)=>calls.push(['drawImage',...a])};
const raster={};
canvas.drawBase(fake,raster,960,640,480,320);
assert.deepEqual(calls,[['clearRect',0,0,480,320],['drawImage',raster,0,0,960,640,0,0,480,320]]);
calls.length=0;
canvas.drawEffectLayer(fake,null,0.5);
assert.equal(calls.length,0);
const overlay={width:20,height:30};
canvas.drawEffectLayer(fake,{canvas:overlay,sx:10,sy:20},0.5);
assert.deepEqual(calls,[['drawImage',overlay,0,0,20,30,5,10,10,15]]);
for (const name of ['src/editor-helpers.js', 'src/editor-canvas.js', 'src/editor-app.js']) {
  new vm.Script(fs.readFileSync(name, 'utf8'), { filename: name });
}
const html = fs.readFileSync('test.html', 'utf8');
assert.match(html, /src="\.\/src\/editor-helpers\.js"/);
assert.match(html, /src="\.\/src\/editor-app\.js"/);
assert.ok(html.indexOf('src="./src/editor-helpers.js"') < html.indexOf('src="./src/editor-app.js"'));
console.log('PASS: pure helpers, script syntax and dependency order');
