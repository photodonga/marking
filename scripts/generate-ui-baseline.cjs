#!/usr/bin/env node
// Run only in a separate worktree checked out at the reviewed main commit.
// Ubuntu Linux + Playwright 1.56.1 + Chromium/WebKit are required.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const sha=process.argv[2];
const output=process.argv[3];
assert.match(sha||'',/^[0-9a-f]{40}$/,'Usage: node scripts/generate-ui-baseline.cjs <reviewed-main-sha> <output-json-path>');
assert.ok(output && output.endsWith('.json'),'Specify an output JSON path');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(head,sha,'Refusing baseline generation: HEAD differs from specified main SHA');
assert.equal(process.platform,'linux','Baseline must be generated on Linux');
const pkg=require('../package.json');
assert.equal(pkg.devDependencies.playwright,'1.56.1','Unexpected Playwright version');
const {version}=require('playwright/package.json');
assert.equal(version,'1.56.1','Installed Playwright version differs');
const engines=['chromium','webkit'],widths=[320,375,390,1280];
const fixture={baselineSha:sha,playwright:version,platform:process.platform,engines:{}};
for(const engine of engines){
  const filename=path.join('test-results','report-'+engine+'.json');
  const results=JSON.parse(fs.readFileSync(filename,'utf8'));
  fixture.engines[engine]={};
  for(const width of widths){
    const row=results.find(x=>x.reference==='index'&&x.width===width);
    assert.ok(row?.ok,'Baseline run must pass: '+engine+' '+width);
    assert.ok(row.imageData?.samples?.length===1024,'Expected 16x16 RGBA grid');
    assert.match(row.imageData.canvasSha256,/^[0-9a-f]{64}$/,'Missing full canvas SHA-256');
    if(width===1280)assert.match(row.exportSha256,/^[0-9a-f]{64}$/,'Missing export SHA-256');
    fixture.engines[engine][width]={
      checks:row.checks,
      imageData:{
        width:row.imageData.width,
        height:row.imageData.height,
        canvasSha256:row.imageData.canvasSha256,
        samplesZlibBase64:zlib.deflateSync(Buffer.from(row.imageData.samples)).toString('base64')
      },
      ...(width===1280?{exportSha256:row.exportSha256}:{})
    };
  }
}
const destination=path.resolve(output);
const reviewedFixture=path.resolve('tests/fixtures/browser-main.json');
assert.notEqual(destination,reviewedFixture,'Cannot overwrite reviewed fixture');
fs.mkdirSync(path.dirname(destination),{recursive:true});
assert.ok(!fs.existsSync(destination),'Refusing to overwrite existing reviewed baseline');
fs.writeFileSync(destination,JSON.stringify(fixture,null,2)+'\n');
console.log('Created '+destination+' from '+sha+'; review and commit manually.');
