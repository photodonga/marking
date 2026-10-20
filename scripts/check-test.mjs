import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fail = message => { console.error('FAIL:', message); process.exitCode = 1; };
if (!/<style\b[^>]*>[\s\S]*?<\/style>/i.test(html)) fail('Missing inline CSS');
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length) fail('Duplicate HTML ids');
for(const id of ['app','toolbar','options-bar','workarea','view-canvas','fileInput','btn-save']){
  if(!ids.includes(id)) fail('Missing essential control: '+id);
}
for(const name of ['editor-helpers','editor-canvas','editor-app']){
  if(!html.includes('src="./src/'+name+'.js"')) fail('Missing module: '+name);
  const code=readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8');
  try{new Script(code,{filename:name+'.js'});}catch(error){fail('Syntax error in '+name+': '+error.message);}
}
if(!process.exitCode) console.log('PASS: production index.html static checks');
