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
if (!process.exitCode) console.log('PASS: Marking test.html static checks');
