import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fail = message => { console.error('FAIL:', message); process.exitCode = 1; };
if (!/<style\b[^>]*>[\s\S]*?<\/style>/i.test(html)) fail('Missing inline CSS');
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length) fail('Duplicate HTML ids');
for(const id of ['app','toolbar','options-bar','workarea','view-canvas','fileInput','btn-pick-photo','btn-save','format-select','btn-undo','btn-redo']){
  if(!ids.includes(id)) fail('Missing essential control: '+id);
}
for(const name of ['editor-helpers','editor-canvas','editor-app']){
  if(!html.includes('src="./src/'+name+'.js"')) fail('Missing module: '+name);
  const code=readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8');
  try{new Script(code,{filename:name+'.js'});}catch(error){fail('Syntax error in '+name+': '+error.message);}
  const selfReference=code.match(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\1\s*;/);
  if(selfReference)fail('Self-referential const initializer in '+name+': '+selfReference[1]);
}

const app = readFileSync(new URL('../src/editor-app.js',import.meta.url),'utf8');
for(const name of ['buildOptionsBar','arrangeMobileOptions','fitCanvas','handleSaveClick','handleEditorKeydown','decorateOptionIcons']){
  if(!new RegExp('\\bfunction\\s+'+name+'\\s*\\(').test(app)) fail('Missing essential function in editor-app.js: '+name);
}
// Minimal CSS syntax guard only. Hash/pixel fixtures, not brace counting, protect UI parity.
const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]);
if(css.length!==1) fail('Expected exactly one inline stylesheet');
for(const style of css){
  let depth=0, quote='', comment=false;
  for(let i=0;i<style.length;i++){
    const ch=style[i],next=style[i+1];
    if(comment){if(ch==='*'&&next==='/'){comment=false;i++;}continue;}
    if(quote){if(ch==='\\'){i++;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='*'){comment=true;i++;continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'){depth--;if(depth<0){fail('Unexpected CSS closing brace');break;}}
  }
  if(depth!==0)fail('Unbalanced CSS braces: '+depth);
  if(comment)fail('Unterminated CSS comment');
  if(quote)fail('Unterminated CSS string');
}
if(!process.exitCode) console.log('PASS: production index.html static checks');
