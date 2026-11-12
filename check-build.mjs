// Runs during Docker build. Rejects an old index paired with this server.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {BUILD_VERSION} from './server.mjs';

const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
assert(html.trimEnd().endsWith('</html>'),'Content outside the document');
assert(html.indexOf('src="/kanban.js"')<html.indexOf('id="story-map-app"'),'Kanban must load before the app');
assert(html.indexOf('id="kanban-view"')<html.indexOf('id="map-xbar"'),'Kanban panel must be inside the app layout');
assert.equal(html.match(/<meta name="app-version" content="([^"]+)"/)?.[1],BUILD_VERSION,
  'index.html and server.mjs must come from the same release.');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>m[1].trim());
assert.equal(scripts.length,2,'Expected both Story Map scripts.');
scripts.forEach((match,i)=>new Script(match[1],{filename:`index-script-${i+1}`}));
for(const name of ['errors.js','stat.js','kanban.js','hr.js','auth-client.js']){
  assert(html.includes(`src="/${name}"`),`Missing module ${name}`);
  new Script(await readFile(new URL('./'+name,import.meta.url),'utf8'),{filename:name});
}
for(const text of ['Год проектов','Период историй','id="reset"','story-status','errors-tab','statistics-tab','kanban-tab','hr-tab','v2.9.4 · 12.11','taskMin','taskMax','stoppedEpicTotals','UbaitAFCT','Состав работ · АФКТ','id="app-sidebar"','id="hr-navigation"','id="sidebar-account"']){
  assert(html.includes(text),`Current UI is missing: ${text}`);
}
assert(!html.includes('<select'),'Old native-select interface must not be packaged.');
assert(html.includes('id="change-password"')&&html.includes('id="password-form"'),'Missing password change dialog.');
new Script(await readFile(new URL('./pb_hooks/ubait-password.pb.js',import.meta.url),'utf8'),{filename:'ubait-password.pb.js'});
assert(html.includes('href="/hr.css"'));assert((await readFile(new URL('./hr.css',import.meta.url),'utf8')).includes('.hr-subnav'));
assert(html.includes('statistics-shell')&&html.includes('statistics-scrum-tab')&&html.includes('kanban-statistics-view'),'Missing Scrum / Kanban sub-tabs');
assert((await readFile(new URL('./stat.js',import.meta.url),'utf8')).includes('globalThis.UbaitKanbanStatistics='),'Missing Kanban analytics');
assert((await readFile(new URL('./kanban.js',import.meta.url),'utf8')).includes('data-board-task'),'Missing read-only Kanban board');
console.log(`Build verified: Story Map ${BUILD_VERSION}`);
