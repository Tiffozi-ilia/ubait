// Runs during Docker build. Rejects an old index paired with this server.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {BUILD_VERSION} from './server.mjs';

const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
assert.equal(html.match(/<meta name="app-version" content="([^"]+)"/)?.[1],BUILD_VERSION,
  'index.html and server.mjs must come from the same release. Upload the whole package.');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,2,'Expected both Story Map scripts.');
scripts.forEach((match,i)=>new Script(match[1],{filename:`index-script-${i+1}`}));
for(const text of ['Год проектов','Период историй','id="reset"','story-status','api_revision!==2','v2.1 · 29.10']){
  assert(html.includes(text),`Current UI is missing: ${text}`);
}
assert(!html.includes('<select'),'Old native-select interface must not be packaged.');
console.log(`Build verified: Story Map ${BUILD_VERSION}`);
