// Validate the single production entrypoint without changing its UI or styles.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/<style\b[^>]*>[\s\S]*?<\/style>/i,'Production stylesheet missing');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate element IDs in production');
for(const name of ['editor-helpers','editor-canvas','editor-app']){
  assert.match(html,new RegExp('<script src="\\./src/'+name+'\\.js"><\\/script>'),'Missing module: '+name);
}
assert.ok(html.indexOf('editor-helpers.js')<html.indexOf('editor-canvas.js'));
assert.ok(html.indexOf('editor-canvas.js')<html.indexOf('editor-app.js'));
console.log('PASS: production entrypoint stylesheet, IDs and module load order');
