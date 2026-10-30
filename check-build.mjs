// Runs during Docker build. Rejects an old index paired with this server.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {BUILD_VERSION} from './server.mjs';

const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
assert.equal(html.match(/<meta name="app-version" content="([^"]+)"/)?.[1],BUILD_VERSION,
  'index.html and server.mjs must come from the same release.');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>m[1].trim());
assert.equal(scripts.length,2,'Expected both Story Map scripts.');
scripts.forEach((match,i)=>new Script(match[1],{filename:`index-script-${i+1}`}));
for(const name of ['errors.js','stat.js','hr.js']){
  assert(html.includes(`src="/${name}"`),`Missing module ${name}`);
  new Script(await readFile(new URL('./'+name,import.meta.url),'utf8'),{filename:name});
}
for(const text of ['Год проектов','Период историй','id="reset"','story-status','errors-tab','statistics-tab','hr-tab','v2.3 · 30.10']){
  assert(html.includes(text),`Current UI is missing: ${text}`);
}
assert(!html.includes('<select'),'Old native-select interface must not be packaged.');
assert(html.includes('href="/hr.css"'));assert((await readFile(new URL('./hr.css',import.meta.url),'utf8')).includes('.hr-subnav'));
console.log(`Build verified: Story Map ${BUILD_VERSION}`);
