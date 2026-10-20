const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'marking-const-mutation-'));
try{
  fs.mkdirSync(path.join(tmp,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(tmp,'src'),{recursive:true});
  fs.copyFileSync(path.join(root,'scripts/check-test.mjs'),path.join(tmp,'scripts/check-test.mjs'));
  fs.copyFileSync(path.join(root,'index.html'),path.join(tmp,'index.html'));
  for(const name of ['editor-helpers','editor-canvas','editor-app']){
    fs.copyFileSync(path.join(root,'src',name+'.js'),path.join(tmp,'src',name+'.js'));
  }
  const clean=spawnSync(process.execPath,[path.join(tmp,'scripts/check-test.mjs')],{encoding:'utf8'});
  assert.equal(clean.status,0,'Clean fixture should pass: '+clean.stdout+clean.stderr);
  fs.appendFileSync(path.join(tmp,'src/editor-helpers.js'),'\nconst markingMutation = markingMutation;\n');
  const mutated=spawnSync(process.execPath,[path.join(tmp,'scripts/check-test.mjs')],{encoding:'utf8'});
  const output=mutated.stdout+mutated.stderr;
  assert.notEqual(mutated.status,0,'Mutation escaped static checker');
  assert.match(output,/Self-referential const initializer in editor-helpers: markingMutation/);
  console.log('MUTATION TEST: injected "const markingMutation = markingMutation;"');
  console.log('EXPECTED FAILURE exit='+mutated.status);
  console.log(output.trim());
  console.log('PASS: mutation was detected; original app files untouched');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
