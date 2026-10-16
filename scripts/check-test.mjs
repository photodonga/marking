import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../test.html', import.meta.url), 'utf8');
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const scriptBlocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
if (scriptBlocks.length !== 1) fail('Expected exactly one inline script in test.html');
if (!/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/i.test(html)) fail('Missing inline CSS');
for (const [index, code] of scriptBlocks.entries()) {
  try { new Script(code, { filename: `test.html:inline-script-${index + 1}` }); }
  catch (error) { fail(`JavaScript syntax error: ${error.message}`); }
  const selfReference = code.match(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\1\s*;/);
  if (selfReference) fail(`Self-referential const initializer: ${selfReference[1]}`);
}
for (const name of ['buildOptionsBar', 'arrangeMobileOptions', 'fitCanvas']) {
  if (!new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(html)) fail(`Missing essential function: ${name}`);
}
// DOM contract: duplicate IDs can silently route event listeners to the wrong control.
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const seen = new Set();
for (const id of ids) {
  if (seen.has(id)) fail(`Duplicate HTML id: ${id}`);
  seen.add(id);
}
for (const id of ['app', 'toolbar', 'options-bar', 'workarea', 'view-canvas',
  'fileInput', 'btn-pick-photo', 'btn-save', 'format-select', 'btn-undo', 'btn-redo']) {
  if (!seen.has(id)) fail(`Missing essential HTML control: #${id}`);
}
const editorCode = scriptBlocks.join('\\n');
for (const name of ['handleSaveClick', 'handleEditorKeydown', 'decorateOptionIcons']) {
  if (!new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(editorCode)) {
    fail(`Missing editor behavior: ${name}`);
  }
}
// CSS syntax guard: count braces outside comments and quoted strings.
// This catches accidental truncation during staged CSS consolidation.
const styleBlocks = [...html.matchAll(/<style(?:\\s[^>]*)?>([\\s\\S]*?)<\\/style>/gi)].map(match => match[1]);
if (styleBlocks.length !== 1) fail('Expected exactly one inline style block');
for (const css of styleBlocks) {
  let depth = 0;
  let quote = '';
  let comment = false;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i], next = css[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (ch === '\\\\') { i++; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth < 0) { fail('Unexpected CSS closing brace'); break; }
    }
  }
  if (depth !== 0) fail(`Unbalanced CSS braces: ${depth}`);
  if (comment) fail('Unterminated CSS comment');
  if (quote) fail('Unterminated CSS string');
}
if (!process.exitCode) console.log('PASS: Marking test.html static checks');
