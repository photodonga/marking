const assert=require('node:assert/strict');
const fs=require('node:fs');
const zlib=require('node:zlib');
const [artifactPath, committedPath]=process.argv.slice(2);
assert.ok(artifactPath&&committedPath,'Usage: node tests/verify-baseline-artifact.cjs <artifact.json> <committed.json>');
const actual=JSON.parse(fs.readFileSync(artifactPath,'utf8'));
const committed=JSON.parse(fs.readFileSync(committedPath,'utf8'));
for(const key of ['baselineSha','playwright','platform'])assert.equal(committed[key],actual[key],key+' mismatch');
for(const engine of ['chromium','webkit']){
  for(const width of [320,375,390,1280]){
    const a=actual.engines[engine][width],b=committed.engines[engine][width];
    assert.deepEqual(b.checks,a.checks,engine+' '+width+' check order');
    for(const key of ['width','height','canvasSha256'])assert.equal(b.imageData[key],a.imageData[key],engine+' '+width+' '+key);
    assert.deepEqual(zlib.inflateSync(Buffer.from(b.imageData.samplesZlibBase64,'base64')),
      zlib.inflateSync(Buffer.from(a.imageData.samplesZlibBase64,'base64')),engine+' '+width+' RGBA bytes');
    if(width===1280)assert.equal(b.exportSha256,a.exportSha256,engine+' export');
  }
}
console.log('PASS: committed fixture matches generated Linux main artifact: all checks, 8 pixel grids, full canvas hashes and 2 export hashes');
