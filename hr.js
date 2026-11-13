/* Inline UI icons: Lucide.
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.



The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* HR R8 — server-authorized live data from /api/hr, no demo fallback.
 * Six existing tables: unit, check, skills_employee, skills_boss, kpi, skills.
 * Server-side PocketBase authentication is required for this endpoint.
 * KPI achievement/payments are NOT inferred from plan/fact.
 */
globalThis.UbaitHR=(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const fmt=v=>num(v)===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v));
  const day=v=>/^\d{4}-\d\d-\d\d$/.test(v??'')?v.slice(8)+'.'+v.slice(5,7)+'.'+v.slice(0,4):'—';
  const yearNow=()=>new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Moscow'}).format(new Date());
  const {scale,gradeIndex,gradePoints,careerGrades,norm,definitions,scoreProfile,calculatedGrade}=globalThis.UbaitHRModel;
  const label=v=>gradeIndex(v)<0?'—':scale[gradeIndex(v)];
  const tabs={competencies:'Компетенции',kpi:'KPI',ipr:'ИПР',employee:'Сотрудник',playground:'Playgound'};
  const skillGroupIcons={"employee":["<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 18V5\"/><path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\"/><path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\"/><path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\"/><path d=\"M18 18a4 4 0 0 0 2-7.464\"/><path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\"/><path d=\"M6 18a4 4 0 0 1-2-7.464\"/><path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\"/></svg>","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 7v14\"/><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\"/></svg>","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\"/></svg>","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\"/><path d=\"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95\"/><path d=\"m2 15 6 6\"/><path d=\"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\"/></svg>","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M18 21a8 8 0 0 0-16 0\"/><circle cx=\"10\" cy=\"8\" r=\"5\"/><path d=\"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3\"/></svg>"],"boss":["<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1\"/><path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\"/><path d=\"M12 12V8\"/></svg>","<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/></svg>"]};
  const allSkills=kind=>definitions[kind].flatMap(g=>g.items);
  const initials=name=>esc(String(name??'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join(''));
  const title=p=>p.unit.staff||[p.unit.status,p.unit.position].filter(Boolean).join(' · ')||'Карточка #'+p.unit.task_id;
  const timestamp=v=>{const d=new Date(v);return v&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(d):'—';};
  const yearKey=v=>String(v??'').trim()||'__none__';
  const yearLabel=v=>v==='__none__'?'Без года':v;
  const yearMatches=(v,selected)=>!selected||yearKey(v)===selected;
  const byName=(a,b)=>title(a).localeCompare(title(b),'ru')||a.unit.task_id.localeCompare(b.unit.task_id);
  function parsePayload(payload){
    if(payload?.schema_version!==1||payload.dataset!=='hr'||payload.api_revision!==1||payload.source_form_id!==405691||!Array.isArray(payload.cards))throw new Error('HR API вернул другой формат. Нужен флоу «HR — реальные данные 405691».');
    const ids=new Set(),array=v=>Array.isArray(v)?v:[],object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    const cards=payload.cards.map(raw=>{
      if(!raw?.unit||typeof raw.unit.task_id!=='string'||!/^\d+$/.test(raw.unit.task_id)||ids.has(raw.unit.task_id))throw new Error('HR API: некорректный или повторный ID карточки.');
      ids.add(raw.unit.task_id);
      if(!Array.isArray(raw.kpi)||!Array.isArray(raw.skills))throw new Error('HR API: у карточки #'+raw.unit.task_id+' отсутствуют массивы KPI или ИПР.');
      const u={...raw.unit,stream:array(raw.unit.stream),photo:array(raw.unit.photo),offer:array(raw.unit.offer)};
      const missingBlocks=Array.isArray(raw.missing_blocks)?[...raw.missing_blocks]:[];
      for(const key of ['check','skills_employee','skills_boss'])if(!raw[key]&&!missingBlocks.includes(key))missingBlocks.push(key);
      for(const key of ['kpi','skills']){
        const rows=new Set();for(const r of raw[key]){
          if(!r||typeof r.row_id!=='string'||!/^\d+$/.test(r.row_id)||rows.has(r.row_id)||(r.task_id!==undefined&&String(r.task_id)!==u.task_id))throw new Error('HR API: некорректная строка '+key+' в карточке #'+u.task_id+'.');
          rows.add(r.row_id);
        }
      }
      return {...raw,unit:u,check:object(raw.check),skills_employee:object(raw.skills_employee),skills_boss:object(raw.skills_boss),missing_blocks:missingBlocks};
    });
    if(!payload.meta||Number(payload.meta.card_count)!==cards.length)throw new Error('HR API: число карточек в отчёте не совпадает с полученными данными. Проверь последний узел флоу HR.');
    const people=cards.filter(p=>p.unit.status!=='Эталон'),references=cards.filter(p=>p.unit.status==='Эталон');
    const active=['Работает','Испытательный срок','Декрет','Оформление','Вакансия (поиск)','Подбор','Уволен'];
    const rank=p=>{const at=active.indexOf(p.unit.status);return at<0?active.length:at;};
    people.sort((a,b)=>rank(a)-rank(b)||byName(a,b));
    references.sort((a,b)=>String(a.unit.grade??'').localeCompare(String(b.unit.grade??''),'ru')||byName(a,b));
    const duplicates=new Map();for(const p of people)if(p.unit.staff_id)duplicates.set(String(p.unit.staff_id),(duplicates.get(String(p.unit.staff_id))||0)+1);
    people.forEach(p=>p.same_person_cards=duplicates.get(String(p.unit.staff_id))||1);
    return {people,references,cards,year:yearNow(),meta:payload.meta,generated_at:payload.generated_at,access:payload.access,compensation_settings:payload.compensation_settings};
  }
  function matchEmployee(data,fullName){
    const norm=v=>String(v||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
    const matches=fullName?data.people.filter(p=>norm(p.unit.staff)===norm(fullName)):[];
    return {status:matches.length===1?'matched':matches.length?'ambiguous':'not_found',card:matches.length===1?matches[0]:null};
  }
  function referenceLabel(r,data){
    if(!r)return 'Эталон не выбран';
    const grade=r.unit.grade||'Без грейда';
    return data.references.filter(x=>x.unit.grade===r.unit.grade).length>1?grade+' · '+(r.unit.position||r.unit.team||'карточка')+' · #'+r.unit.task_id:grade;
  }
  function defaultReference(p,data,kind='employee'){
    return calculatedGrade(p,data,kind).baseline?.card?.unit.task_id||'';
  }
  function comparison(person,reference,kind){
    const current=person['skills_'+kind]??{},ref=reference?.['skills_'+kind]??{};
    return definitions[kind].map(g=>({...g,items:g.items.map(s=>({...s,current:current[s.code+'_current']??null,target:current[s.code+'_target']??null,reference:ref[s.code+'_current']??null}))}));
  }
  function countSkills(groups){
    const rows=groups.flatMap(g=>g.items),assessed=rows.filter(x=>gradeIndex(x.current)>=0),comparable=rows.filter(x=>gradeIndex(x.current)>=0&&gradeIndex(x.reference)>=0);
    return {total:rows.length,assessed:assessed.length,comparable:comparable.length,met:comparable.filter(x=>gradeIndex(x.current)>=gradeIndex(x.reference)).length,planned:rows.filter(x=>gradeIndex(x.target)>=0).length};
  }
  function goalSummary(rows){return {goals:rows.length,facts:rows.filter(r=>num(r.kpi_fact)!==null).length,weights:rows.every(r=>num(r.kpi_weight)!==null)?rows.reduce((s,r)=>s+num(r.kpi_weight),0):null};}
  const select=(key,title,values,current,all=false)=>`<details class="hr-pop"><summary>${esc(title)} · ${esc(yearLabel(current)||'Все')} ▾</summary><div role="group" aria-label="${esc(title)}">${(all?['',...values]:values).map(v=>`<button data-hr-filter="${key}" data-value="${esc(v)}" aria-pressed="${v===current}">${esc(yearLabel(v)||'Все')}</button>`).join('')}</div></details>`;
  const pill=(t,kind='')=>`<span class="hr-pill ${kind}">${esc(t)}</span>`;
  const prose=(title,text)=>`<span class="hr-prose-title">${esc(title)}</span><p class="hr-prose">${esc(text||'Не заполнено')}</p>`;
  const salaryIcons={"show": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>", "hide": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49\"/><path d=\"M14.084 14.158a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143\"/><path d=\"m2 2 20 20\"/></svg>"};
  const salaryControl=()=>'<span class="hr-salary"><span id="hr-salary-value" class="hr-salary-value" aria-live="polite" aria-label="Оклад скрыт">••••••</span><button id="hr-salary-toggle" class="hr-salary-toggle" type="button" data-hr-salary="true" aria-controls="hr-salary-value" aria-pressed="false" aria-label="Показать оклад" title="Показать оклад">'+salaryIcons.show+'</button></span>';
  const fairControl=compensation=>compensation?.fair_cost!==null&&compensation?.fair_cost!==undefined?'<span class="hr-salary"><span id="hr-fair-value" class="hr-salary-value" aria-live="polite" aria-label="Справедливая стоимость скрыта">••••••</span><button id="hr-fair-toggle" class="hr-salary-toggle" type="button" data-hr-fair="true" aria-controls="hr-fair-value" aria-pressed="false" aria-label="Показать справедливую стоимость" title="Показать справедливую стоимость">'+salaryIcons.show+'</button></span>':'<span class="hr-source">'+esc(compensation?.reason||'Модель не настроена')+'</span>';
  const detailsRows=(rows,{hideSalary=false,compensation=null}={})=>`<dl class="hr-data-list">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${hideSalary&&k==='Оклад'?salaryControl():k==='Справедливая стоимость'?fairControl(compensation):esc(v??'—')}</dd>`).join('')}</dl>`;
  const fileList=files=>Array.isArray(files)&&files.length?files.map(f=>`<span class="hr-file">▧ ${esc(f?.name||f?.filename||'Вложение')}</span>`).join('')+'<span class="hr-source">Открыть вложения можно в карточке Pyrus по ссылке в шапке.</span>':'<span class="hr-source">Нет вложений</span>';
  const levelBar=s=>`<div class="hr-levels" aria-hidden="true">${scale.map((_,i)=>`<i class="${i<=gradeIndex(s.current)?'filled ':''}${i===gradeIndex(s.reference)?'reference ':''}${i===gradeIndex(s.target)?'target':''}"></i>`).join('')}</div>`;
  // A small, deliberately HTML-free Markdown renderer for reference text.
  // All literal text is escaped; only the formatting below can produce markup.
  function referenceMarkdown(value){
    if(typeof value!=='string'||value.length>100000)return '';
    const inline=text=>{
      let html='',last=0;
      const tokens=/`([^`\n]+)`|\[([^\]\n]{1,240})\]\(([^)\s]{1,2048})\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
      for(const m of text.matchAll(tokens)){
        html+=esc(text.slice(last,m.index));last=m.index+m[0].length;
        if(m[1]!==undefined)html+='<code>'+esc(m[1])+'</code>';
        else if(m[2]!==undefined){
          let href='';try{const u=new URL(m[3]);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)href=u.href;}catch{}
          html+=href&&text[m.index-1]!=='!'?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(m[2])+'</a>':esc(m[0]);
        }else html+=m[4]!==undefined||m[5]!==undefined?'<strong>'+esc(m[4]??m[5])+'</strong>':'<em>'+esc(m[6]??m[7])+'</em>';
      }
      return (html+esc(text.slice(last))).replace(/\n/g,'<br>');
    };
    let html='',paragraph=[],items=[],kind='ul';
    const flushParagraph=()=>{if(paragraph.length)html+='<p>'+inline(paragraph.join('\n'))+'</p>';paragraph=[];};
    const flushList=()=>{if(items.length)html+='<'+kind+'>'+items.map(s=>'<li>'+inline(s)+'</li>').join('')+'</'+kind+'>';items=[];};
    for(const line of value.replace(/\r\n?/g,'\n').split('\n')){
      if(!line.trim()){flushParagraph();flushList();continue;}
      const heading=line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*$/),bullet=line.match(/^\s*([•*+-]|\d+[.)])\s+(.+)$/);
      if(heading){flushParagraph();flushList();html+='<h5>'+inline(heading[1])+'</h5>';}
      else if(bullet){flushParagraph();const next=/^\d/.test(bullet[1])?'ol':'ul';if(kind!==next)flushList();kind=next;items.push(bullet[2].trim());}
      else if(items.length&&/^\s{2,}/.test(line))items[items.length-1]+='\n'+line.trim();
      else{flushList();paragraph.push(line.trim());}
    }
    flushParagraph();flushList();return html;
  }
  function descriptionBlocks(markdown){
    const blocks=[];let title='О компетенции',kind='overview',lines=[];
    const kinds={'назначение':'purpose','определение':'definition','показатели эффективности':'measures'};
    const flush=()=>{if(lines.join('\n').trim())blocks.push({title,kind,markdown:lines.join('\n').trim()});lines=[];};
    for(const line of String(markdown||'').replace(/\r\n?/g,'\n').split('\n')){
      const heading=line.match(/^\s*(?:#{1,6}\s+)?(?:\*\*|__)?(Назначение|Определение|Показатели эффективности)\s*:?\s*(?:\*\*|__)?\s*$/i);
      if(heading){flush();title=heading[1];kind=kinds[title.toLocaleLowerCase('ru')];}
      else lines.push(line);
    }
    flush();return blocks;
  }
  function competencyGuide(doc){
    if(!doc)return '<p class="hr-source">Описание этой компетенции пока не опубликовано.</p>';
    const section=key=>referenceMarkdown(doc[key]?.markdown);
    const criteria=section('criteria'),positive=section('positive'),negative=section('negative');
    const blocks=descriptionBlocks(doc.description?.markdown);
    const source=[doc.description,doc.criteria,doc.positive,doc.negative].find(s=>/^\d{1,20}$/.test(s?.page_id??''));
    const card=(title,text,kind)=>'<section class="hr-doc-card '+kind+'"><h4>'+esc(title)+'</h4><div class="hr-reference-text">'+text+'</div></section>';
    return '<section class="hr-competency-guide" aria-label="Описание компетенции">'+
      (blocks.length?blocks.map(b=>card(b.title,referenceMarkdown(b.kind==='definition'?b.markdown.replace(/\n(?=\S)/g,'\n\n'):b.markdown),b.kind)).join(''):card('О компетенции','<p>Описание пока не заполнено.</p>','overview'))+
      (criteria?card('Критерии оценки',criteria,'criteria'):'')+
      (positive||negative?'<div class="hr-manifestation-grid">'+(positive?card('Положительная проявленность',positive,'positive'):'')+(negative?card('Отрицательная проявленность',negative,'negative'):'')+'</div>':'')+
      (source?'<a class="hr-reference-link" href="https://confluence.sovcombank.ru/pages/viewpage.action?pageId='+source.page_id+'" target="_blank" rel="noopener noreferrer">Открыть в Confluence ↗</a>':'')+'</section>';
  }
  function createDocsLoader({fetchImpl=(...args)=>fetch(...args)}={}){
    // No saved results or shared in-flight responses: every opening is a fresh request.
    return async code=>{
      if(typeof code!=='string'||!/^03\.01\.(?:01|02)\.\d{2}\.\d{2}$/.test(code))throw new Error('Invalid competency');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);
      try{
        const response=await fetchImpl('/api/competency-docs?matrix_id='+encodeURIComponent(code),{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
        if(!response.ok)throw new Error('Reference unavailable');
        const body=await response.json();
        if(body?.schema_version!==2||body.matrix_id!==code||!body.competency||typeof body.competency!=='object'||Array.isArray(body.competency))throw new Error('Invalid reference');
        return body.competency;
      }finally{clearTimeout(timer);}
    };
  }
  function parseSkillHistory(payload,taskId,kind,code){
    if(payload?.schema_version!==1||payload.dataset!=='hr_skill_history'||payload.source_form_id!==405691||
      payload.task_id!==taskId||payload.skill_block!==kind||payload.matrix_id!==code||!Array.isArray(payload.entries))throw new Error('Не удалось прочитать историю оценок.');
    const ids=new Set();
    const rows=payload.entries.map(r=>{
      if(!r||typeof r.id!=='string'||! /^[1-9][0-9]{0,18}$/.test(r.id)||ids.has(r.id)||
        ![r.current_grade,r.target_grade].every(v=>v===null||(typeof v==='string'&&gradeIndex(v)>=0))||
        typeof r.is_baseline!=='boolean'||typeof r.created_at!=='string'||!/(?:Z|[+-]\d\d:\d\d)$/.test(r.created_at)||!Number.isFinite(Date.parse(r.created_at)))throw new Error('Не удалось прочитать историю оценок.');
      ids.add(r.id);return {id:r.id,current:r.current_grade,target:r.target_grade,at:r.created_at,baseline:r.is_baseline};
    });
    return rows.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||(BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0));
  }
  function createHistoryLoader({fetchImpl=(...args)=>fetch(...args)}={}){
    return async(taskId,kind,code,{signal}={})=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000),abort=()=>controller.abort();
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      try{
        const query='task_id='+encodeURIComponent(taskId)+'&kind='+encodeURIComponent(kind)+'&matrix_id='+encodeURIComponent(code);
        const response=await fetchImpl('/api/hr/skill-history?'+query,{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(globalThis.UbaitAuth){try{await UbaitAuth.checked(response);}catch(e){throw Object.assign(e,{status:response.status});}}
        if(!response.ok)throw Object.assign(new Error(response.status===401?'Сеанс завершён. Войдите снова.':response.status===403?'Нет доступа к истории этой карточки.':'Не удалось загрузить историю оценок.'),{status:response.status});
        return parseSkillHistory(await response.json(),taskId,kind,code);
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    };
  }
  const historyDate=(at,time=false)=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit'}:{}),timeZone:'Europe/Moscow'}).format(new Date(at));
  function skillHistoryChart(rows){
    if(!rows.length)return '';
    const w=720,h=250,left=48,right=18,top=18,bottom=36;
    const start=Date.parse(rows[0].at),end=Date.parse(rows.at(-1).at);
    const x=r=>end===start?(w+left-right)/2:left+(Date.parse(r.at)-start)/(end-start)*(w-left-right);
    const y=g=>h-bottom-gradeIndex(g)/8*(h-top-bottom),p=n=>Number(n.toFixed(2));
    const grid=scale.map((g,i)=>{const at=p(top+(8-i)/8*(h-top-bottom));return '<line x1="'+left+'" x2="'+(w-right)+'" y1="'+at+'" y2="'+at+'" class="hr-history-grid"/><text x="'+(left-12)+'" y="'+(at+4)+'" text-anchor="end">'+g+'</text>';}).join('');
    const series=(key,title)=>{
      let path='',previous=null;
      for(const r of rows){const valid=gradeIndex(r[key])>=0;
        if(previous&&gradeIndex(previous[key])>=0){path+=' H '+p(x(r));if(valid)path+=' V '+p(y(r[key]));}
        else if(valid)path+=' M '+p(x(r))+' '+p(y(r[key]));
        previous=r;
      }
      const dots=rows.filter(r=>gradeIndex(r[key])>=0).map(r=>'<circle cx="'+p(x(r))+'" cy="'+p(y(r[key]))+'" r="'+(key==='target'?5:3.5)+'"><title>'+esc(historyDate(r.at,true)+' · '+title+': '+label(r[key]))+'</title></circle>').join('');
      return '<g class="hr-history-series '+key+'">'+(path?'<path d="'+path.trim()+'"/>':'')+dots+'</g>';
    };
    // Keep labels readable; dates are proportional, not equally spaced snapshots.
    const ticks=[];for(const i of [0,Math.round((rows.length-1)/2),rows.length-1]){
      const r=rows[i],position=x(r);if(!ticks.some(t=>Math.abs(t.x-position)<140))ticks.push({x:position,at:r.at});
    }
    return '<div class="hr-history-chart-wrap"><svg class="hr-history-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Изменение текущей и плановой оценки по датам. Подробности в списке ниже.">'+grid+series('target','План')+series('current','Текущая оценка')+ticks.map(t=>'<text x="'+p(t.x)+'" y="'+(h-10)+'" text-anchor="'+(t.x===left?'start':t.x===w-right?'end':'middle')+'">'+esc(historyDate(t.at))+'</text>').join('')+'</svg></div>';
  }
  function skillHistory(rows,skill){
    if(!rows.length)return '<div class="hr-history-empty"><h4>История пока пуста</h4><p>Она появится после первого сохранения оценок.</p></div>';
    const last=rows.at(-1),unrecorded=skill&&(gradeIndex(skill.current)!==gradeIndex(last.current)||gradeIndex(skill.target)!==gradeIndex(last.target));
    const value=(v,key)=>gradeIndex(v)<0?(key==='current'?'Не оценено':'Нет плана'):label(v);
    const changes=rows.map((r,i)=>({r,previous:rows[i-1]})).reverse().map(({r,previous})=>{
      const fields=['current','target'].filter(key=>!previous||gradeIndex(previous[key])!==gradeIndex(r[key]));
      const lines=(fields.length?fields:['current','target']).map(key=>'<div class="hr-history-change"><span>'+(key==='current'?'Текущая оценка':'План')+'</span><div>'+(previous&&fields.includes(key)?'<span class="hr-history-before">'+esc(value(previous[key],key))+'</span><span class="hr-history-arrow" aria-label="стало">→</span>':'')+'<strong class="'+(gradeIndex(r[key])<0?'empty':'')+'">'+esc(value(r[key],key))+'</strong></div></div>').join('');
      return '<li><div class="hr-history-date"><time datetime="'+esc(r.at)+'">'+esc(historyDate(r.at,!r.baseline))+'</time>'+(!previous?'<small>'+(r.baseline?'Исходный срез':'Первый срез')+'</small>':'')+'</div><div class="hr-history-changes">'+lines+'</div></li>';
    }).join('');
    const n=rows.length,countLabel=n%10===1&&n%100!==11?'срез':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'среза':'срезов';
    return '<section class="hr-history-overview"><div class="hr-history-heading"><h4>Как менялась оценка</h4><span>'+n+' '+countLabel+'</span></div><div class="hr-history-legend"><span><i></i>Текущая оценка</span><span class="target"><i></i>План</span></div>'+skillHistoryChart(rows)+(rows.length===1?'<p class="hr-history-note">Пока сохранён один срез.</p>':'')+'</section>'+(unrecorded?'<p class="hr-history-note">Последние изменения ещё не попали в историю.</p>':'')+'<ol class="hr-history-list">'+changes+'</ol>';
  }
  function radarAxes(groups,kind){
    const mean=values=>values.every(v=>v!==null)?values.reduce((sum,v)=>sum+v,0)/values.length:null;
    if(kind==='boss'){
      const labels=[['Ресурсы'],['Изменения'],['Онбординг'],['Эмоциональный','интеллект'],['Адвокат','клиента'],['Капитан','команды'],['Архитектор','решений'],['Стратег','и тактик'],['Обучение'],['Проводник','к успеху']];
      return groups.flatMap(g=>g.items).map((s,i)=>({name:s.name,label:labels[i],current:gradePoints(s.current),reference:gradePoints(s.reference)}));
    }
    return groups.map(g=>({name:g.name,label:[g.short],current:mean(g.items.map(s=>gradePoints(s.current))),reference:mean(g.items.map(s=>gradePoints(s.reference)))}));
  }
  function radar(groups,kind){
    const axes=radarAxes(groups,kind),n=axes.length,cx=180,cy=kind==='boss'?174:160,radius=101;
    const at=(i,v,r=radius)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [cx+r*v/3*Math.cos(a),cy+r*v/3*Math.sin(a)];};
    const pair=p=>p.map(v=>v.toFixed(2)).join(','),polygon=v=>axes.map((_,i)=>pair(at(i,v))).join(' ');
    const series=key=>{
      const complete=axes.every(a=>a[key]!==null);
      const shape=complete?'<polygon class="hr-radar-area '+key+'" points="'+axes.map((a,i)=>pair(at(i,a[key]))).join(' ')+'"/>':axes.map((a,i)=>{const j=(i+1)%n;if(a[key]===null||axes[j][key]===null)return '';const p=at(i,a[key]),q=at(j,axes[j][key]);return '<line class="hr-radar-segment '+key+'" x1="'+p[0]+'" y1="'+p[1]+'" x2="'+q[0]+'" y2="'+q[1]+'"/>';}).join('');
      return shape+axes.map((a,i)=>{if(a[key]===null)return '';const p=at(i,a[key]);return '<circle class="hr-radar-dot '+key+'" cx="'+p[0]+'" cy="'+p[1]+'" r="3"><title>'+esc(a.name)+' · '+(key==='current'?'AS IS':'Эталон')+': '+fmt(a[key])+'</title></circle>';}).join('');
    };
    const labels=axes.map((a,i)=>{const p=at(i,3,kind==='boss'?139:137),lines=a.label;return '<text class="hr-radar-label" x="'+p[0]+'" y="'+(p[1]-(lines.length-1)*5)+'" text-anchor="middle">'+lines.map((line,j)=>'<tspan x="'+p[0]+'" dy="'+(j?11:0)+'">'+esc(line)+'</tspan>').join('')+'<tspan class="hr-radar-values" x="'+p[0]+'" dy="14"><tspan class="current">'+fmt(a.current)+'</tspan><tspan> / </tspan><tspan class="reference">'+fmt(a.reference)+'</tspan></tspan></text>';}).join('');
    const missing=axes.some(a=>a.current===null||a.reference===null);
    return '<figure class="hr-radar"><figcaption>'+(kind==='boss'?'Баллы навыков':'Средний балл по блокам')+' · 0–3</figcaption><svg viewBox="0 0 360 '+(kind==='boss'?355:315)+'" role="img" aria-label="Радар компетенций: AS IS и выбранный эталон"><title>'+axes.map(a=>esc(a.name)+': '+fmt(a.current)+' / '+fmt(a.reference)).join('; ')+'</title>'+[.5,1,1.5,2,2.5,3].map(v=>'<polygon class="hr-radar-ring" points="'+polygon(v)+'"/>').join('')+axes.map((_,i)=>{const p=at(i,3);return '<line class="hr-radar-axis" x1="'+cx+'" y1="'+cy+'" x2="'+p[0]+'" y2="'+p[1]+'"/>';}).join('')+series('reference')+series('current')+[0,1,2,3].map(v=>'<text class="hr-radar-tick" x="'+(cx+6)+'" y="'+(cy-radius*v/3-3)+'">'+v+'</text>').join('')+labels+'</svg><div class="hr-radar-legend"><span><i class="current"></i>AS IS</span><span><i class="reference"></i>Эталон</span></div>'+(missing?'<p class="hr-source">— Нет полной оценки</p>':'')+'</figure>';
  }
  function competenciesBase(person,data,state){
    const ref=data.references.find(r=>r.unit.task_id===state.reference),groups=comparison(person,ref,state.kind);
    const refs=[...data.references].sort((a,b)=>{const order=r=>{const i=careerGrades.findIndex(g=>norm(g)===norm(r.unit.grade));return i<0?99:i;};return order(a)-order(b);});
    const selected=state.skillGroups?.[state.kind],active=Number.isInteger(selected)&&selected>=0&&selected<groups.length?selected:0,group=groups[active];
    const groupTabs='<div class="hr-group-tabs" role="tablist" aria-label="Группы компетенций">'+groups.map((g,i)=>'<button type="button" id="hr-group-'+state.kind+'-'+i+'" role="tab" data-hr-group="'+i+'" aria-controls="hr-competency-group" aria-selected="'+(i===active)+'" tabindex="'+(i===active?'0':'-1')+'">'+skillGroupIcons[state.kind][i]+'<span>'+esc(g.name)+'</span></button>').join('')+'</div>';
    const groupPanel='<section id="hr-competency-group" class="hr-card hr-skill-group" role="tabpanel" aria-labelledby="hr-group-'+state.kind+'-'+active+'"><header><h3>'+esc(group.name)+'</h3></header>'+group.items.map(s=>'<button type="button" class="hr-skill" data-hr-skill="'+s.code+'" aria-haspopup="dialog" aria-label="'+esc(s.name)+'. Сейчас '+label(s.current)+', план '+label(s.target)+', эталон '+label(s.reference)+'"><span class="hr-skill-heading"><span>'+esc(s.name)+'</span><b>'+label(s.current)+'</b></span>'+levelBar(s)+'</button>').join('')+'</section>';
    const benchmark='<aside class="hr-card hr-benchmark hr-radar-panel"><div class="hr-benchmark-controls"><span class="hr-kicker">Сравнить с эталоном</span><div class="hr-grade-choices" role="group" aria-label="Эталон грейда">'+(refs.length?refs.map(r=>'<button data-hr-reference="'+esc(r.unit.task_id)+'" aria-pressed="'+(state.reference===r.unit.task_id)+'">'+esc(referenceLabel(r,data))+'</button>').join(''):'<p>Эталоны не найдены</p>')+'</div></div>'+radar(groups,state.kind)+'</aside>';
    return '<div class="hr-competency-page"><div class="hr-panel-top"><div class="hr-switch" role="group" aria-label="Набор компетенций">'+[['employee','Сотрудник'],['boss','Руководитель']].map(([k,t])=>'<button data-hr-kind="'+k+'" aria-pressed="'+(state.kind===k)+'">'+t+'</button>').join('')+'</div></div>'+developmentSummary(person,data,state.kind)+groupTabs+'<div class="hr-competency-layout">'+benchmark+'<div class="hr-group-content">'+groupPanel+'<div class="hr-skill-legend"><span><i class="hr-key"></i>AS IS</span><span><i class="hr-key target"></i>План</span><span><i class="hr-key reference"></i>Эталон</span></div></div></div></div>';
  }
  function development(person,data,kind){
    const calculated=calculatedGrade(person,data,kind),{current,grade}=calculated;
    const baseline=calculated.baseline??{card:null,count:0},nextGrade=calculated.next?.grade||'',next=calculated.next??{card:null,count:0};
    const reference=scoreProfile(baseline.card,kind),nextReference=scoreProfile(next.card,kind);
    const rows=comparison(person,baseline.card,kind).flatMap(g=>g.items).map(s=>({...s,actualPoints:gradePoints(s.current),referencePoints:gradePoints(s.reference)}));
    const comparable=rows.filter(s=>s.actualPoints!==null&&s.referencePoints!==null);
    const gaps=comparable.filter(s=>s.actualPoints<s.referencePoints).map(s=>({...s,gap:s.referencePoints-s.actualPoints})).sort((a,b)=>b.gap-a.gap||a.code.localeCompare(b.code));
    const noGaps=comparable.length===rows.length?gaps.length===0:gaps.length?false:null;
    const enough=current.total!==null&&nextReference.total!==null?current.total>=nextReference.total:null;
    const transition=!nextGrade?(grade?'none':'unknown'):enough===false||noGaps===false?'blocked':enough===true&&noGaps===true?'met':'unknown';
    return {grade,knownGrade:Boolean(grade),calculated,nextGrade,current,baseline,reference,next,nextReference,rows,comparable:comparable.length,gaps,noGaps,enough,transition};
  }
  function developmentSummary(person,data,kind){
    const d=development(person,data,kind),partial=d.comparable<d.rows.length;
    const gapValue=d.comparable===0?'—':partial?(d.gaps.length?'≥ '+d.gaps.length:'—'):String(d.gaps.length);
    const nextLabel=d.nextGrade||'—',nextNote=!d.nextGrade?(d.knownGrade?'Последний грейд':'Грейд не определён'):d.next.count>1?'Несколько эталонов':!d.next.card?'Эталон не найден':d.nextReference.total===null?'Эталон заполнен не полностью':'баллов эталона';
    return '<section class="hr-score-strip" aria-label="Статистика компетенций"><div class="hr-card hr-score-tile"><span class="hr-kicker">Текущий грейд</span><div class="hr-score-line"><strong class="hr-score-grade">'+esc(d.calculated.label)+'</strong><strong class="hr-score-number">'+fmt(d.current.total)+'</strong></div><span class="hr-score-caption">'+esc(d.calculated.reason||'баллов AS IS')+'</span></div><div class="hr-card hr-score-tile"><span class="hr-kicker">Следующий грейд</span><div class="hr-score-line"><strong class="hr-score-grade">'+esc(nextLabel)+'</strong><strong class="hr-score-number">'+fmt(d.nextReference.total)+'</strong></div><span class="hr-score-caption">'+nextNote+'</span></div><button class="hr-card hr-score-tile hr-gap-trigger" data-hr-gaps="true" aria-haspopup="dialog" aria-label="Открытые гепы к текущему грейду: '+gapValue+'. Открыть детализацию"><span class="hr-kicker">Гепы к текущему грейду</span><span class="hr-score-line"><strong class="hr-score-number">'+gapValue+'</strong><span class="hr-gap-link">Подробнее ↗</span></span><span class="hr-score-caption">'+(partial?'Сопоставлено '+d.comparable+' из '+d.rows.length:esc(d.grade||'Грейд не определён'))+'</span></button></section>';
  }
  function skillProfile(person,data,kind,code){
    const d=development(person,data,kind),skill=d.rows.find(s=>s.code===code);if(!skill)return null;
    const note=(ref,value)=>ref.count>1?'Несколько эталонов':!ref.card?'Эталон не найден':gradeIndex(value)<0?'Оценка не заполнена':'';
    const next=d.next.card?.['skills_'+kind]?.[code+'_current']??null;
    return {...skill,grade:d.grade,nextGrade:d.nextGrade,next,
      referenceNote:d.calculated.reason||note(d.baseline,skill.reference),nextNote:d.nextGrade?note(d.next,next):d.knownGrade?'Последний грейд':'Грейд не определён'};
  }
  function skillScale(skill){
    const marks=[{key:'actual',title:'Текущий балл',value:skill.current,grade:skill.grade,note:gradeIndex(skill.current)<0?'Оценка не заполнена':''},
      {key:'baseline',title:'Текущий эталонный балл',value:skill.reference,grade:skill.grade,note:skill.referenceNote},
      {key:'next',title:'Следующий эталонный балл',value:skill.next,grade:skill.nextGrade,note:skill.nextNote}];
    return '<section class="hr-skill-comparison" aria-label="Текущий балл и эталоны грейдов"><div class="hr-skill-metrics">'+marks.map(m=>'<div class="hr-skill-metric '+m.key+'"><span class="hr-metric-label"><i aria-hidden="true"></i>'+m.title+'</span><div><strong>'+label(m.value)+'</strong><span>'+esc(m.grade||'Грейд не указан')+'</span></div>'+(m.note?'<small>'+esc(m.note)+'</small>':'')+'</div>').join('')+'</div><div class="hr-profile-scale" aria-hidden="true">'+scale.map((g,i)=>'<div class="hr-profile-step '+(i===gradeIndex(skill.current)?'chosen':'')+'"><span>'+g+'</span><div class="hr-profile-markers">'+marks.map(m=>'<i class="'+m.key+(i===gradeIndex(m.value)?' marked':'')+'"></i>').join('')+'</div></div>').join('')+'</div></section>';
  }
  function docsLoading(title='Загружаем описание компетенции',source='Confluence'){
    return '<div class="hr-docs-loading" role="status"><div class="hr-docs-loading-title">'+esc(title)+(source?'<span>'+esc(source)+'</span>':'')+'</div><div class="hr-docs-progress" role="progressbar" aria-label="'+esc(title)+'"><span></span></div><div class="hr-docs-skeleton" aria-hidden="true"><i></i><i></i><i></i></div></div>';
  }
  function gapsDetail(person,data,kind){
    const d=development(person,data,kind);
    const issue=d.calculated.reason||(!d.baseline.card?'Эталон текущего грейда не найден.':d.comparable<d.rows.length?'Сопоставлено '+d.comparable+' из '+d.rows.length+' компетенций. Остальным не хватает оценки.':'');
    return '<h3 id="hr-skill-title">Гепы к текущему грейду</h3><p class="hr-gap-context">'+esc(d.calculated.label)+' · '+(d.comparable===d.rows.length?'Гепов: '+d.gaps.length:d.gaps.length?'Гепов: ≥ '+d.gaps.length:'Сравнение неполное')+'</p>'+(issue?'<p class="hr-note">'+esc(issue)+'</p>':'')+(d.gaps.length?'<div class="hr-gap-table-wrap"><table class="hr-gap-table"><thead><tr><th>Компетенция</th><th>AS IS</th><th>Эталон</th><th>Разрыв</th></tr></thead><tbody>'+d.gaps.map(s=>'<tr><th scope="row">'+esc(s.name)+'</th><td><b>'+label(s.current)+'</b><small>'+fmt(s.actualPoints)+' б.</small></td><td><b>'+label(s.reference)+'</b><small>'+fmt(s.referencePoints)+' б.</small></td><td class="hr-gap-points">−'+fmt(s.gap)+'</td></tr>').join('')+'</tbody></table></div>':!issue?'<p class="hr-gap-empty">Открытых гепов нет</p>':'');
  }
  function competencies(person,data,state){
    // Group selection affects only the visible skills, never totals or the radar.
    return competenciesBase(person,data,state);
  }
  // Only exact known competency names/aliases link IPR rows; never fuzzy matches.
  function iprSkillCode(row){
    const aliases={'Знание внутренней методологии и стандартов':'Внутренняя методология и стандарты','Инструменты формализации Требований':'Формализация требований'};
    const name=norm(row.skill),alias=Object.entries(aliases).find(([from])=>norm(from)===name)?.[1];
    const matches=['employee','boss'].flatMap(allSkills).filter(s=>norm(s.name)===norm(alias||name));
    return matches.length===1?matches[0].code:null;
  }
  function skillEvidence(person,skill,year){
    const rows=person.skills.filter(r=>!r.is_empty&&yearMatches(r.skills_year,year)&&iprSkillCode(r)===skill.code);
    return `<section class="hr-evidence"><h4>ИПР ${esc(yearLabel(year)||'все годы')}</h4>${rows.length?rows.map(r=>`<details><summary>${esc(yearLabel(yearKey(r.skills_year)))} · AS IS ${label(r.skill_asis)} → TO BE ${label(r.skill_tobe)} · ${r.skill_result_done?'результат описан':'результат не заполнен'}</summary>${prose('Что сделано',r.skill_result_done)}${prose('Обратная связь руководителя',r.skill_feedback)}</details>`).join(''):'<p class="hr-source">Нет записей по этой компетенции за выбранный год.</p>'}</section>`;
  }
  function kpi(person,state){
    const all=person.kpi.filter(r=>!r.is_empty),years=[...new Set([yearNow(),...all.map(r=>yearKey(r.kpi_year))])].sort().reverse();
    const annual=all.filter(r=>yearMatches(r.kpi_year,state.year)),horizons=[...new Set(annual.map(r=>r.kpi_horizont).filter(Boolean))];
    const rows=annual.filter(r=>(!state.horizon||r.kpi_horizont===state.horizon)&&(!state.goalQuery||[r.kpi_goal,r.kpi_category,r.kpi_type].join(' ').toLocaleLowerCase('ru').includes(state.goalQuery.toLocaleLowerCase('ru'))));
    const summary=goalSummary(rows);
    return `<div class="hr-controls">${select('year','Год',years,state.year,true)}${select('horizon','Горизонт',horizons,state.horizon,true)}<input id="hr-goal-search" class="hr-search" type="search" placeholder="Найти цель…" aria-label="Найти цель KPI" value="${esc(state.goalQuery)}"></div><div class="hr-card hr-kpi-summary"><div class="hr-metric"><strong>${summary.goals}</strong><small>целей в выборке</small></div><div class="hr-metric"><strong>${summary.facts} / ${summary.goals}</strong><small>с заполненным фактом</small></div><div class="hr-metric"><strong>${fmt(summary.weights)}%</strong><small>сумма весов выборки</small></div><p class="hr-source">План и факт — исходные значения. Формула достижения и правила премирования не заданы: премию здесь не рассчитываем.</p></div><div class="hr-goals">${rows.map(r=>`<details class="hr-card hr-goal"><summary><span class="hr-goal-title"><strong>${esc(r.kpi_goal||'Цель не заполнена')}</strong><small>${[r.kpi_horizont,r.kpi_category,r.kpi_type].filter(Boolean).map(esc).join(' · ')}${r.kpi_by_chief?' · от руководителя':''}</small></span><span class="hr-goal-number"><small>Вес</small><b>${fmt(r.kpi_weight)}%</b></span><span class="hr-goal-number"><small>План</small><b>${fmt(r.kpi_plan)}</b></span><span class="hr-goal-number ${num(r.kpi_fact)===null?'empty':''}"><small>Факт</small><b>${fmt(r.kpi_fact)}</b></span><span class="hr-goal-arrow" aria-hidden="true">›</span></summary><div class="hr-goal-body">${prose('Критерии успешности',r.kpi_acceptence_criteria)}${prose('Обратная связь руководителя',r.kpi_feedback)}<div class="hr-skill-legend">${[r.kpi_class,r.kpi_priority].filter(Boolean).map(t=>pill(t)).join('')}</div><span class="hr-prose-title">Вложения</span>${fileList(r.files)}</div></details>`).join('')||'<div class="hr-empty"><h3>Нет целей по выбранным условиям</h3><p>Выбери другой год, горизонт или очисти поиск.</p></div>'}</div>`;
  }
  function ipr(person,state){
    const all=person.skills.filter(r=>!r.is_empty),years=[...new Set([yearNow(),...all.map(r=>yearKey(r.skills_year))])].sort().reverse();
    const rows=all.filter(r=>yearMatches(r.skills_year,state.year)&&(!state.iprQuery||String(r.skill??'').toLocaleLowerCase('ru').includes(state.iprQuery.toLocaleLowerCase('ru'))));
    return `<div class="hr-controls">${select('year','Год развития',years,state.year,true)}<span class="hr-source">${rows.length} компетенций · ${rows.filter(r=>r.skill_result_done).length} с описанным результатом</span><input id="hr-ipr-search" class="hr-search" type="search" placeholder="Найти компетенцию…" aria-label="Найти компетенцию ИПР" value="${esc(state.iprQuery)}"></div><div class="hr-ipr-grid">${rows.map(r=>`<article class="hr-card hr-ipr-card"><div class="hr-ipr-tags"><span class="hr-kicker">${esc(r.skill_block||'Компетенция')}</span>${r.skills_by_chief?pill('От руководителя','accent'):''}</div><h3>${esc(r.skill||'Компетенция не указана')}</h3><div class="hr-grade-route"><div><small>AS IS</small><strong>${label(r.skill_asis)}</strong></div><span aria-hidden="true">→</span><div><small>TO BE</small><strong>${label(r.skill_tobe)}</strong></div>${pill(r.skill_result_done?'Результат описан':'Ожидает результата',r.skill_result_done?'good':'')}</div>${prose('Что сделано',r.skill_result_done)}<details><summary>Обратная связь</summary><p class="hr-prose">${esc(r.skill_feedback||'Пока не заполнена')}</p></details></article>`).join('')||'<div class="hr-empty"><h3>Нет пунктов ИПР</h3><p>Выбери другой год или очисти поиск.</p></div>'}</div><p class="hr-source" style="margin-top:15px">Описанный результат не означает, что навык подтверждён. AS IS / TO BE здесь — значения плана развития, а не автоматическое изменение профиля компетенций.</p>`;
  }
  function employee(person,data,kind='employee'){
    const u={...person.unit,grade:calculatedGrade(person,data,kind).label},c=person.check;
    return `<div class="hr-profile-grid"><section class="hr-card"><h3>Работа и команда</h3>${detailsRows([['Сотрудник',u.staff],['Статус',u.status],['Отдел · team',u.team],['Руководитель',u.chief],['Почта руководителя',u.chief_email],['Должность',u.position],['Грейд',u.grade],['Уровень управления',u.level],['Стримы',u.stream.join(' · ')],['Бизнес-опыт, лет',u.business_stage]])}</section><section class="hr-card"><h3>Контакты и рабочее место</h3>${detailsRows([['Почта',u.staff_email],['Телефон',u.phone],['Город',u.city],['Бизнес-центр',u.center],['Рабочее место',u.place],['День рождения',day(u.birthday)],['Фото',u.photo.length?'См. вложения ниже':'Нет вложения']])}${fileList(u.photo)}</section><section class="hr-card"><h3>Условия</h3>${detailsRows([['Оклад',null],['Справедливая стоимость',null],['Ожидания',fmt(u.expectations)],['Аура · исходное значение',u.aura],['Экспорт в BI',u.export_bi===null?'Не указано':u.export_bi?'Да':'Нет']],{hideSalary:true,compensation:person.compensation})}<span class="hr-prose-title">Оффер</span>${fileList(u.offer)}<p class="hr-source" style="margin-top:12px">Исходные значения из штатки. Валюта, период и состав выплат не выводятся из числа автоматически.</p></section><section class="hr-card"><h3>Даты и характеристика</h3><div class="hr-timeline">${[['Приём',u.date_in],['Перевод',u.date_transfer],['Увольнение',u.date_out]].map(([k,v])=>`<div><small>${k}</small><strong>${day(v)}</strong></div>`).join('')}</div>${prose('Характеристика',u.characteristic)}</section><section class="hr-card wide"><div class="hr-panel-top"><h3>Испытательный срок</h3>${pill('Окончание · '+day(c.check_end_date),u.status==='Испытательный срок'?'accent':'')}</div><p class="hr-prose">${esc(c.check_task||'Задача на испытательный срок не заполнена')}</p><div class="hr-check-grid">${[['Удалось',c.check_result_done],['Не удалось',c.check_result_fail],['Помогало',c.check_result_assist],['Мешало',c.check_result_disturb]].map(([k,v])=>`<div>${prose(k,v)}</div>`).join('')}</div>${prose('Обратная связь',c.check_feedback)}</section></div>`;
  }
  function createSyncClient({fetchImpl=(...args)=>fetch(...args),onState=()=>{},onComplete=()=>{},onDenied=()=>{},schedule=setTimeout,cancel=clearTimeout}={}){
    let state={status:'idle'},pending=false,timer=null,completedId=null;
    const update=value=>{state=value;onState({...state});};
    async function request(start=false,quiet=false){
      if(pending)return;pending=true;if(timer!==null){cancel(timer);timer=null;}
      if(start)update({status:'requesting'});
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),70000);
      try{
        const response=await fetchImpl('/api/hr/sync',{method:start?'POST':'GET',headers:{Accept:'application/json',...(start?{'Content-Type':'application/json'}:{})},...(start?{body:'{}'}:{}),credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(globalThis.UbaitAuth){try{await UbaitAuth.checked(response);}catch(e){throw Object.assign(e,{status:response.status});}}
        if(!response.ok)throw Object.assign(new Error('Не удалось проверить синхронизацию.'),{status:response.status});
        const result=await response.json();
        if(!['idle','running','completed','unconfirmed'].includes(result?.status)||(result.status!=='idle'&&typeof result.id!=='string'))throw new Error('Неверный ответ синхронизации.');
        if(result.status==='idle'&&['running','disconnected'].includes(state.status))update({status:'unconfirmed'});else update(result);
        if(result.status==='completed'&&result.id!==completedId){completedId=result.id;await onComplete();}
        if(result.status==='running')timer=schedule(()=>void request(),2000);
      }catch(e){
        if(e.status===401||e.status===403){update({status:'idle'});onDenied(e);}
        else if(!quiet||state.status!=='idle')update({status:'disconnected'});
      }finally{clearTimeout(timeout);pending=false;}
    }
    return {start:()=>request(true),check:(quiet=false)=>request(false,quiet),state:()=>({...state})};
  }
  const syncText=s=>s.status==='requesting'?'Запускаем загрузку из Pyrus…':s.status==='running'?'Синхронизация HR с Pyrus… Можно продолжать работу.':s.status==='completed'?(s.warnings?'HR обновлён. Есть замечания загрузки — администратор увидит их в n8n.':'HR и история оценок обновлены · '+timestamp(s.finished_at)):s.status==='unconfirmed'?'Не удалось подтвердить завершение. Проверь данные кнопкой ↻; если они не обновились — выполнение флоу в n8n.':s.status==='disconnected'?'Не удалось получить статус. Нажми «Проверить синхронизацию».':'';
  const reloaders=new WeakMap();
  const tabSetters=new WeakMap();
  function preload(root){
    if(!root)return;
    if(root.dataset.hrMounted==='true'){void reloaders.get(root)?.({silent:true});return;}
    mount(root);
  }
  function selectTab(root,key){
    if(!root||!Object.hasOwn(tabs,key))return false;
    root.dataset.hrSelectedTab=key;
    tabSetters.get(root)?.(key);
    return true;
  }
  function lastCompletedQuarter(date=new Date()){
    const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Moscow',year:'numeric',month:'numeric'}).formatToParts(date);
    const year=Number(parts.find(p=>p.type==='year').value),quarter=Math.ceil(Number(parts.find(p=>p.type==='month').value)/3);
    return quarter===1?{year:year-1,quarter:4}:{year,quarter:quarter-1};
  }
  async function requestKpiExport(period,{fetchImpl=fetch,signal}={}){
    const response=await fetchImpl('/api/hr/kpi-export',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
      credentials:'same-origin',cache:'no-store',body:JSON.stringify({year:period.year,quarter:period.quarter}),signal});
    if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
    if(!response.ok){let body;try{body=await response.json();}catch{}throw Object.assign(new Error(typeof body?.error==='string'?body.error:'Не удалось сформировать реестр. Повторите позже.'),{status:response.status});}
    if(!(response.headers.get('content-type')||'').startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))throw new Error('Вместо Excel получен другой ответ. Повторите позже.');
    const blob=await response.blob();if(!blob.size)throw new Error('Получен пустой файл реестра.');
    return {blob,filename:`Output_KPI_Report_${period.year}_Q${period.quarter}.xlsx`};
  }
  function mount(root){
    if(root.dataset.hrMounted==='true'){void reloaders.get(root)?.();return;}
    root.dataset.hrMounted='true';
    let data=null,loading=false,error='',denied=false,lastContent='',activeLoad=null;
    const payroll={...lastCompletedQuarter(),open:false,busy:false,message:'',error:false};
    let payrollController=null;
    function closePayroll(){payroll.open=false;payrollController?.abort();root.querySelector('#hr-payroll-dialog')?.close();}
    function payrollDialog(){
      return `<dialog id="hr-payroll-dialog" class="hr-dialog hr-payroll-dialog" aria-labelledby="hr-payroll-title"><div class="dialog-top"><h2 id="hr-payroll-title">Реестр на выплату</h2><button class="action" data-hr-payroll-close="true" aria-label="Закрыть выбор периода">Закрыть</button></div><div class="detail-body"><p class="hr-payroll-scope">Все доступные вам сотрудники. Выбор карточки и фильтры HR не ограничивают реестр.</p><label class="hr-payroll-year">Год<input id="hr-payroll-year" type="number" min="1900" max="9999" step="1" value="${esc(payroll.year)}" ${payroll.busy?'disabled':''}></label><div class="hr-payroll-quarters" role="group" aria-label="Квартал">${[1,2,3,4].map(q=>`<button type="button" data-hr-payroll-quarter="${q}" aria-pressed="${q===payroll.quarter}" ${payroll.busy?'disabled':''}>${q} квартал</button>`).join('')}</div><div id="hr-payroll-progress" class="hr-payroll-progress" role="status" ${payroll.busy?'':'hidden'}><progress aria-label="Формирование Excel"></progress><span>Формируем Excel…</span></div><p id="hr-payroll-message" class="hr-payroll-message" role="${payroll.error?'alert':'status'}" ${payroll.message?'':'hidden'}>${esc(payroll.message)}</p><div class="hr-payroll-footer"><button class="action" data-hr-payroll-close="true">Отмена</button><button class="action primary" data-hr-payroll-submit="true" ${payroll.busy?'disabled':''}>Сформировать Excel</button></div></div></dialog>`;
    }
    function paintPayroll(){
      const dialog=root.querySelector('#hr-payroll-dialog');if(!dialog)return;
      dialog.querySelectorAll('[data-hr-payroll-quarter],#hr-payroll-year,[data-hr-payroll-submit]').forEach(el=>{el.disabled=payroll.busy;});
      dialog.querySelectorAll('[data-hr-payroll-quarter]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.hrPayrollQuarter)===payroll.quarter)));
      dialog.setAttribute('aria-busy',String(payroll.busy));
      const progress=root.querySelector('#hr-payroll-progress');if(progress)progress.hidden=!payroll.busy;
      const message=root.querySelector('#hr-payroll-message');if(message){message.textContent=payroll.message;message.hidden=!payroll.message;message.setAttribute('role',payroll.error?'alert':'status');}
    }
    async function generatePayroll(){
      if(payroll.busy||data?.access?.can_export_kpi!==true)return;
      const input=root.querySelector('#hr-payroll-year'),year=Number(input?.value);
      if(!Number.isInteger(year)||year<1900||year>9999){payroll.message='Укажите год от 1900 до 9999.';payroll.error=true;paintPayroll();input?.focus();return;}
      payroll.year=year;payroll.busy=true;payroll.message='';payroll.error=false;paintPayroll();
      const controller=new AbortController();payrollController=controller;
      let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},70000);
      try{
        const result=await requestKpiExport({year,quarter:payroll.quarter},{signal:controller.signal});
        if(controller.signal.aborted)return;
        const address=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=address;link.download=result.filename;link.hidden=true;
        document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(address),60000);
        payroll.message='Реестр готов. Скачивание началось.';
      }catch(e){
        if(timedOut||!controller.signal.aborted){payroll.error=true;payroll.message=timedOut?'Формирование заняло больше минуты. Повторите позже.':e.message;}
        if(e.status===401||e.status===403)void load({silent:true});
      }finally{clearTimeout(timer);payrollController=null;payroll.busy=false;paintPayroll();}
    }
    const compUI=globalThis.UbaitCompensationUI.create({root,onSaved:()=>load({silent:true}),onDenied:()=>void load({silent:true}),notify:()=>{if(state.tab==='playground')render();}});
    const indexation={open:false,busy:false,message:'',error:false};let indexationController=null;
    function indexationDialog(){return '<dialog id="hr-indexation-dialog" class="hr-dialog hr-payroll-dialog" aria-labelledby="hr-indexation-title"><div class="dialog-top"><h2 id="hr-indexation-title">Реестр на индексацию</h2><button class="action" data-hr-indexation-close="true">Закрыть</button></div><div class="detail-body"><p class="hr-payroll-scope">Все доступные вам сотрудники со статусом «Работает». Текущие данные и сохранённая модель на момент формирования.</p><div id="hr-indexation-progress" class="hr-payroll-progress" role="status" hidden><progress aria-label="Формирование Excel"></progress><span>Формируем Excel…</span></div><p id="hr-indexation-message" class="hr-payroll-message" role="status" hidden></p><div class="hr-payroll-footer"><button class="action" data-hr-indexation-close="true">Отмена</button><button class="action primary" data-hr-indexation-submit="true">Сформировать Excel</button></div></div></dialog>';}
    function paintIndexation(){
      const progress=root.querySelector('#hr-indexation-progress'),message=root.querySelector('#hr-indexation-message');
      if(progress)progress.hidden=!indexation.busy;if(message){message.textContent=indexation.message;message.hidden=!indexation.message;message.setAttribute('role',indexation.error?'alert':'status');}
      root.querySelectorAll('[data-hr-indexation-submit]').forEach(b=>b.disabled=indexation.busy);
    }
    async function generateIndexation(){
      if(indexation.busy||data?.access?.can_export_indexation!==true)return;indexation.busy=true;indexation.message='';indexation.error=false;paintIndexation();
      const controller=new AbortController();indexationController=controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},70000);
      try{
        const response=await fetch('/api/hr/indexation-export',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:'{}',signal:controller.signal});
        if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
        if(!response.ok){const body=await response.json();throw Object.assign(new Error(body.error||'Не удалось сформировать реестр.'),{status:response.status});}
        if(!(response.headers.get('content-type')||'').startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))throw new Error('Сервис вернул другой формат файла.');
        const blob=await response.blob();if(controller.signal.aborted)return;if(!blob.size)throw new Error('Получен пустой файл.');
        const filename=response.headers.get('content-disposition')?.match(/filename="(UBAIT_Indexation_[a-zA-Z0-9_.-]+\.xlsx)"/)?.[1]||'UBAIT_Indexation.xlsx';
        const address=URL.createObjectURL(blob),link=document.createElement('a');link.href=address;link.download=filename;link.hidden=true;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(address),60000);
        indexation.message='Реестр готов. Скачивание началось.';
      }catch(e){if(timedOut||!controller.signal.aborted){indexation.error=true;indexation.message=timedOut?'Формирование заняло больше минуты. Повторите позже.':e.message;}if([401,403].includes(e.status))void load({silent:true});}
      finally{clearTimeout(timer);indexationController=null;indexation.busy=false;paintIndexation();}
    }
    const loadDocs=createDocsLoader(),loadHistory=createHistoryLoader();
    let openedSkill=null,historyController=null;
    const cancelHistory=()=>{historyController?.abort();historyController=null;openedSkill=null;};
    const sync=createSyncClient({onState:paintSync,onComplete:async()=>{if(activeLoad)await activeLoad;await load({silent:true});},onDenied:()=>{
      data=null;lastContent='';state.person='';state.reference='';denied=true;error='Доступ к HR изменился. Войди снова или обратись к администратору.';render();
    }});
    function paintSync(){
      const s=sync.state(),button=root.querySelector('#hr-push-sync'),message=root.querySelector('#hr-sync-state');
      if(button){button.disabled=!data||loading||['requesting','running'].includes(s.status);button.textContent=s.status==='disconnected'?'Проверить синхронизацию':['requesting','running'].includes(s.status)?'Синхронизация…':'Синхронизировать';button.setAttribute?.('aria-busy',String(['requesting','running'].includes(s.status)));}
      if(message){message.textContent=syncText(s);message.hidden=!message.textContent;}
    }
    const state={tab:Object.hasOwn(tabs,root.dataset.hrSelectedTab)?root.dataset.hrSelectedTab:'competencies',person:'',query:'',department:'',status:'',kind:'employee',skillGroups:{employee:0,boss:0},reference:'',referenceManual:false,year:yearNow(),horizon:'',goalQuery:'',iprQuery:''};
    const navigation=globalThis.document?.getElementById('hr-navigation');
    tabSetters.set(root,key=>{if(key==='playground'&&data?.access?.can_manage_compensation!==true)return;if(state.tab!==key){state.tab=key;render('hr-'+key+'-tab');}});
    const person=()=>data?.people.find(p=>p.unit.task_id===state.person);
    const filtered=()=>data.people.filter(p=>(!state.department||p.unit.team===state.department)&&(!state.status||p.unit.status===state.status)&&(!state.query||[title(p),p.unit.position,p.unit.team,p.unit.task_id].join(' ').toLocaleLowerCase('ru').includes(state.query.toLocaleLowerCase('ru'))));
    const spinner=()=>'<div class="hr-empty hr-loading" role="status"><span class="hr-spinner" aria-hidden="true"></span><h3>Загружаем штатные данные</h3><p>Сотрудники, компетенции, KPI и ИПР из БД</p></div>';
    function render(focusId,selection){
      cancelHistory();
      compUI.access(data?.access?.can_manage_compensation===true);
      if(state.tab==='playground'&&data?.access?.can_manage_compensation!==true)state.tab='employee';
      root.dataset.hrSelectedTab=state.tab;
      navigation?.querySelectorAll('[data-hr-tab]').forEach(button=>{button.hidden=button.dataset.hrTab==='playground'&&data?.access?.can_manage_compensation!==true;const active=button.dataset.hrTab===state.tab;button.setAttribute('aria-selected',String(active));button.setAttribute('tabindex',active?'0':'-1');});
      const menuState=document.getElementById('hr-navigation-state'),menuRetry=document.getElementById('hr-navigation-retry');
      if(menuState){menuState.textContent=!data?(loading?'Загружаем разделы…':error?'Не удалось загрузить HR':''):'';menuState.hidden=!menuState.textContent;}
      if(menuRetry){menuRetry.hidden=Boolean(data)||loading||!error;menuRetry.disabled=loading;}
      navigation?.setAttribute('aria-busy',String(loading&&!data));
      navigation?.dispatchEvent(new Event('hr-navigation-updated'));
      const accessLabel=data?.access?data.access.level+' · '+({self:'Мой профиль',department:'Мой отдел',all:'Все доступные сотрудники'}[data.access.scope]||'HR'):'';
      const nav=(navigation?'<div class="hr-subnav" role="group" aria-label="Обновление HR">':'<nav class="hr-subnav" role="tablist" aria-label="Разделы HR">'+Object.entries(tabs).filter(([k])=>k!=='playground'||data?.access?.can_manage_compensation===true).map(([k,t])=>'<button id="hr-'+k+'-tab" role="tab" data-hr-tab="'+k+'" aria-selected="'+(state.tab===k)+'" tabindex="'+(state.tab===k?'0':'-1')+'" aria-controls="hr-tab-content">'+t+'</button>').join(''))+(state.tab==='kpi'&&data?.access?.can_export_kpi===true?'<button id="hr-payroll-open" class="hr-payroll-trigger" data-hr-payroll-open="true">Сформировать реестр на выплату</button>':'')+(state.tab==='ipr'&&data?.access?.can_export_indexation===true?'<button id="hr-indexation-open" class="hr-payroll-trigger" data-hr-indexation-open="true">Сформировать реестр на индексацию</button>':'')+'<span class="hr-live" title="'+esc(accessLabel?accessLabel+' · Срез '+timestamp(data.generated_at):'Источник: штатный реестр 405691')+'">'+esc(accessLabel||'Штатка · БД')+'</span><button id="hr-push-sync" class="hr-push-sync" data-hr-sync="true" title="Загрузить изменения из Pyrus в БД и сохранить историю оценок">Синхронизировать</button><button class="hr-refresh" data-hr-refresh="true" '+(loading?'disabled':'')+' aria-label="Перечитать HR из БД" title="Перечитать данные и права доступа из БД" >↻</button>'+(navigation?'</div>':'</nav>')+'<div id="hr-sync-state" class="hr-sync-state" role="status" aria-live="polite" hidden></div>';
      if(!data){
        payroll.open=false;payrollController?.abort();indexation.open=false;indexationController?.abort();
        root.innerHTML=nav+(loading?spinner():'<div class="hr-empty" role="alert"><h3>'+(denied?'Доступ к HR не настроен':'HR не подключён')+'</h3><p>'+esc(error||'Нет ответа от HR API.')+'</p><button class="action" data-hr-refresh="true">Повторить загрузку</button></div>');
        paintSync();return;
      }
      const people=filtered(),oldPerson=state.person;
      if(!people.some(p=>p.unit.task_id===state.person))state.person=people[0]?.unit.task_id??'';
      const p=person();if(state.person!==oldPerson)state.referenceManual=false;
      if(!state.referenceManual)state.reference=defaultReference(p,data,state.kind);
      const departments=[...new Set(data.people.map(p=>p.unit.team).filter(Boolean))].sort(),statuses=[...new Set(data.people.map(p=>p.unit.status).filter(Boolean))].sort();
      const missing=p?.missing_blocks?.length?'<div class="hr-note">В БД не найдены блоки этой карточки: '+esc(p.missing_blocks.join(', '))+'. Поля этих блоков показаны пустыми. Проверь загрузку штатки.</div>':'';
      const same=p?.same_person_cards>1?'<div class="hr-note">У этого человека '+p.same_person_cards+' карточки в штатке. Сейчас открыта #'+esc(p.unit.task_id)+'; данные разных карточек не объединяются.</div>':'';
      root.innerHTML=nav+(state.tab==='playground'?'<section id="hr-tab-content" class="hr-content comp-workspace" role="tabpanel" aria-labelledby="hr-playground-tab">'+compUI.render()+'</section>':
        '<div class="hr-layout"><aside class="hr-directory" aria-label="Выбор сотрудника"><div class="hr-directory-top"><div class="hr-directory-label"><span>Карточки</span><span>'+people.length+' / '+data.people.length+'</span></div><input id="hr-person-search" type="search" class="hr-search" placeholder="ФИО или ID…" aria-label="Найти сотрудника" value="'+esc(state.query)+'">'+select('department','Отдел',departments,state.department,true)+select('status','Статус',statuses,state.status,true)+'</div><div class="hr-directory-list">'+(people.map(p=>'<button class="hr-person" data-hr-person="'+esc(p.unit.task_id)+'" aria-pressed="'+(state.person===p.unit.task_id)+'"><span class="hr-avatar" aria-hidden="true">'+initials(p.unit.staff||p.unit.status)+'</span><span><strong>'+esc(title(p))+'</strong><small>'+esc([p.unit.team,calculatedGrade(p,data,state.kind).label].filter(Boolean).join(' · '))+'</small><small>'+esc(p.unit.status||'Без статуса')+' · #'+esc(p.unit.task_id)+'</small></span></button>').join('')||'<p class="hr-source">Нет совпадений</p>')+'</div><footer class="hr-directory-footer">'+data.references.length+' эталонов<br>Изменено в Pyrus: '+esc(timestamp(data.meta.last_source_update))+'</footer></aside><div class="hr-detail">'+
        (p?'<header class="hr-identity"><span class="hr-avatar" aria-hidden="true">'+initials(p.unit.staff||p.unit.status)+'</span><div><h2>'+esc(title(p))+'</h2><p>'+esc([p.unit.position,p.unit.team].filter(Boolean).join(' · '))+' · <a href="https://pyrus.sovcombank.ru/t#id'+p.unit.task_id+'" target="_blank" rel="noopener noreferrer">#'+p.unit.task_id+' ↗</a></p></div><div class="hr-identity-tags">'+pill(calculatedGrade(p,data,state.kind).label,'accent')+pill(p.unit.status||'Без статуса')+'</div></header>':'')+
        '<section id="hr-tab-content" class="hr-content" role="tabpanel" aria-labelledby="hr-'+state.tab+'-tab">'+
        (!p?'<div class="hr-empty"><h3>Сотрудник не выбран</h3><p>Измени поиск или фильтры отдела и статуса. В списке только доступные тебе карточки.</p></div>':missing+same+(state.tab==='competencies'?competencies(p,data,state):state.tab==='kpi'?kpi(p,state):state.tab==='ipr'?ipr(p,state):employee(p,data,state.kind)))+
        '</section></div></div>')+'<dialog id="hr-skill-dialog" class="hr-dialog" aria-labelledby="hr-skill-title"><div class="dialog-top"><span class="hr-source" id="hr-dialog-label">Профиль навыка</span><button class="action" data-hr-close="true">Закрыть</button></div><div class="detail-body" id="hr-skill-body"></div></dialog>'+(data.access?.can_export_kpi===true?payrollDialog():'')+(data.access?.can_export_indexation===true?indexationDialog():'');
      root.querySelector('#hr-skill-dialog')?.addEventListener?.('close',cancelHistory);
      paintSync();
      const payrollModal=root.querySelector('#hr-payroll-dialog');
      if(payrollModal){payrollModal.addEventListener('cancel',()=>{payroll.open=false;payrollController?.abort();});if(payroll.open)payrollModal.showModal();paintPayroll();}
      else{payroll.open=false;payrollController?.abort();}
      const indexModal=root.querySelector('#hr-indexation-dialog');
      if(indexModal){indexModal.addEventListener('cancel',()=>{indexation.open=false;indexationController?.abort();});if(indexation.open)indexModal.showModal();paintIndexation();}else{indexation.open=false;indexationController?.abort();}
      if(state.tab==='playground'&&!compUI.loaded())void compUI.refresh();
      if(focusId){const el=root.querySelector('#'+focusId)||navigation?.querySelector('#'+focusId);el?.focus({preventScroll:true});if(selection&&el?.setSelectionRange)el.setSelectionRange(...selection);}
    }
    function load(options={}){
      if(activeLoad)return activeLoad;
      activeLoad=loadData(options).finally(()=>{activeLoad=null;});return activeLoad;
    }
    function selectSkillGroup(index){
      if(!Number.isInteger(index)||index<0||index>=definitions[state.kind].length)return;
      const content=root.querySelector('#hr-tab-content'),scrollTop=content?.scrollTop??0;
      state.skillGroups[state.kind]=index;render('hr-group-'+state.kind+'-'+index);
      const updated=root.querySelector('#hr-tab-content');if(updated)updated.scrollTop=scrollTop;
    }
    async function loadData({silent=false}={}){
      if(loading)return;loading=true;error='';denied=false;
      const background=silent&&Boolean(data);let changed=true;if(!background)render();
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
      try{
        const response=await fetch('/api/hr',{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
        if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
        let payload;try{payload=await response.json();}catch{throw new Error('Сервер HR вернул не JSON. Проверь публикацию флоу HR.');}
        if(!response.ok){denied=response.status===403;throw new Error(payload.error||'HR API: HTTP '+response.status+'.');}
        if(payload.access?.policy_version!==1)throw new Error('На сервере ещё не включены права HR. Загрузи обновление R8 целиком.');
        const loaded=parsePayload(payload),content=JSON.stringify([payload.access,payload.cards,payload.compensation_settings]);
        changed=content!==lastContent;lastContent=content;data=loaded;compUI.hydrate(data);
        if(!data.people.some(p=>p.unit.task_id===state.person)){
          state.person=data.access.employee_task_id;state.referenceManual=false;
        }
        if(state.reference&&!data.references.some(r=>r.unit.task_id===state.reference)){state.reference='';state.referenceManual=false;}
      }catch(e){data=null;lastContent='';state.person='';state.reference='';error=e.name==='AbortError'?'HR не ответил за 70 секунд. Проверь выполнение флоу HR в n8n.':e.message;}
      finally{clearTimeout(timer);loading=false;if(!background||changed||error)render();else paintSync();}
    }
    function skillDialog(code){
      const p=person(),skill=skillProfile(p,data,state.kind,code);if(!skill)return;
      cancelHistory();openedSkill={taskId:p.unit.task_id,kind:state.kind,code,skill,historyLoaded:false};
      root.querySelector('#hr-skill-dialog').dataset.mode='skill';
      root.querySelector('#hr-dialog-label').textContent='Профиль навыка';
      root.querySelector('#hr-skill-body').innerHTML='<span class="hr-kicker">'+(state.kind==='boss'?'Руководитель':'Сотрудник')+' · '+esc(skill.grade||'Грейд не указан')+'</span><h3 id="hr-skill-title">'+esc(skill.name)+'</h3>'+skillScale(skill)+
        '<div class="hr-skill-tabs" role="tablist" aria-label="Информация о компетенции">'+[['description','Описание'],['history','История оценок']].map(([key,title])=>'<button id="hr-skill-'+key+'-tab" role="tab" data-hr-skill-tab="'+key+'" aria-selected="'+(key==='description')+'" tabindex="'+(key==='description'?'0':'-1')+'" aria-controls="hr-skill-'+key+'-panel">'+title+'</button>').join('')+'</div>'+
        '<section id="hr-skill-description-panel" role="tabpanel" aria-labelledby="hr-skill-description-tab"><div id="hr-competency-docs" class="hr-docs-slot" data-code="'+esc(code)+'"></div><div class="hr-divider"></div><button class="action" data-hr-open-ipr="'+esc(skill.name)+'">Найти в годовом ИПР →</button>'+skillEvidence(p,skill,state.year)+'</section>'+
        '<section id="hr-skill-history-panel" role="tabpanel" aria-labelledby="hr-skill-history-tab" hidden><div id="hr-skill-history" class="hr-history" aria-live="polite"></div></section>';
      root.querySelector('#hr-skill-body').scrollTop=0;
      root.querySelector('#hr-skill-dialog').showModal();
      void showDocs(code);
    }
    function selectSkillTab(key,focus=false){
      if(!openedSkill||!['description','history'].includes(key))return;
      for(const name of ['description','history']){
        const tab=root.querySelector('#hr-skill-'+name+'-tab');tab.setAttribute('aria-selected',String(name===key));tab.setAttribute('tabindex',name===key?'0':'-1');
        root.querySelector('#hr-skill-'+name+'-panel').hidden=name!==key;
      }
      if(focus)root.querySelector('#hr-skill-'+key+'-tab').focus();
      if(key==='history'&&!openedSkill.historyLoaded&&!historyController)void showHistory();
    }
    async function showHistory(){
      const context=openedSkill,slot=root.querySelector('#hr-skill-history'),dialog=root.querySelector('#hr-skill-dialog');
      if(!context||!slot||!dialog.open)return;
      historyController?.abort();const controller=new AbortController();historyController=controller;
      const current=()=>openedSkill===context&&historyController===controller&&slot.isConnected&&dialog.open&&root.querySelector('#hr-skill-history')===slot;
      slot.innerHTML=docsLoading('Загружаем историю оценок','');
      try{const rows=await loadHistory(context.taskId,context.kind,context.code,{signal:controller.signal});
        if(current()){slot.innerHTML=skillHistory(rows,context.skill);context.historyLoaded=true;}
      }catch(e){if(current()){
        if(e.status===401||e.status===403){data=null;lastContent='';state.person='';state.reference='';denied=true;error=e.message;render();}
        else slot.innerHTML='<div class="hr-docs-error" role="status"><span>Не удалось загрузить историю оценок.</span><button class="action" data-hr-history-retry="true">Повторить</button></div>';
      }}finally{if(historyController===controller)historyController=null;}
    }
    async function showDocs(code){
      const slot=root.querySelector('#hr-competency-docs'),dialog=root.querySelector('#hr-skill-dialog');
      if(!slot||slot.dataset.code!==code)return;
      const current=()=>slot.isConnected&&dialog.open&&root.querySelector('#hr-competency-docs')===slot;
      slot.innerHTML=docsLoading();
      try{const doc=await loadDocs(code);if(current())slot.innerHTML=competencyGuide(doc);}
      catch{if(current())slot.innerHTML='<div class="hr-docs-error" role="status"><span>Не удалось загрузить описание.</span><button class="action" data-hr-docs-retry="'+esc(code)+'">Повторить</button></div>';}
    }
    root.addEventListener('click',e=>{
      const button=e.target.closest('button'),d=button?.dataset;if(!d)return;
      if(d.hrRefresh){void load();return;}
      if(!data)return;
      if(compUI.click(button))return;
      if(d.hrIndexationOpen&&data.access?.can_export_indexation===true){indexation.open=true;indexation.message='';indexation.error=false;paintIndexation();root.querySelector('#hr-indexation-dialog')?.showModal();return;}
      if(d.hrIndexationClose){indexation.open=false;indexationController?.abort();root.querySelector('#hr-indexation-dialog')?.close();return;}
      if(d.hrIndexationSubmit){void generateIndexation();return;}
      if(d.hrFair){const p=person(),value=root.querySelector('#hr-fair-value');if(!p||!value)return;const visible=button.getAttribute('aria-pressed')!=='true';value.textContent=visible?fmt(p.compensation?.fair_cost):'••••••';value.setAttribute('aria-label',visible?'Справедливая стоимость':'Справедливая стоимость скрыта');button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Скрыть справедливую стоимость':'Показать справедливую стоимость');button.title=visible?'Скрыть справедливую стоимость':'Показать справедливую стоимость';button.innerHTML=salaryIcons[visible?'hide':'show'];return;}
      if(d.hrPayrollClose){closePayroll();return;}
      if(d.hrPayrollOpen&&data.access?.can_export_kpi===true){if(!payroll.busy){Object.assign(payroll,lastCompletedQuarter(),{message:'',error:false});const input=root.querySelector('#hr-payroll-year');if(input)input.value=payroll.year;}payroll.open=true;paintPayroll();root.querySelector('#hr-payroll-dialog')?.showModal();return;}
      if(d.hrPayrollQuarter&&!payroll.busy){const q=Number(d.hrPayrollQuarter);if(q>=1&&q<=4)payroll.quarter=q;paintPayroll();return;}
      if(d.hrPayrollSubmit){void generatePayroll();return;}
      if(d.hrSalary){
        const p=person(),value=root.querySelector('#hr-salary-value');if(!p||!value)return;
        const visible=button.getAttribute('aria-pressed')!=='true';
        value.textContent=visible?fmt(p.unit.cost):'••••••';value.setAttribute('aria-label',visible?'Оклад':'Оклад скрыт');
        button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Скрыть оклад':'Показать оклад');button.title=visible?'Скрыть оклад':'Показать оклад';button.innerHTML=salaryIcons[visible?'hide':'show'];return;
      }
      if(d.hrSync){if(sync.state().status==='disconnected')void sync.check();else void sync.start();return;}
      if(d.hrClose){cancelHistory();root.querySelector('#hr-skill-dialog').close();return;}
      if(d.hrSkillTab){selectSkillTab(d.hrSkillTab);return;}
      if(d.hrHistoryRetry){void showHistory();return;}
      if(d.hrDocsRetry){void showDocs(d.hrDocsRetry);return;}
      if(d.hrGaps){cancelHistory();const dialog=root.querySelector('#hr-skill-dialog');dialog.dataset.mode='gaps';root.querySelector('#hr-dialog-label').textContent='Гепы';root.querySelector('#hr-skill-body').innerHTML=gapsDetail(person(),data,state.kind);dialog.showModal();return;}
      if(d.hrSkill){skillDialog(d.hrSkill,d.hrSkillReference);return;}
      if(d.hrGroup!==undefined){selectSkillGroup(Number(d.hrGroup));return;}
      if(d.hrOpenIpr){state.tab='ipr';state.iprQuery=d.hrOpenIpr;render('hr-ipr-tab');return;}
      if(d.hrTab&&Object.hasOwn(tabs,d.hrTab)&&(d.hrTab!=='playground'||data.access?.can_manage_compensation===true)){state.tab=d.hrTab;render('hr-'+d.hrTab+'-tab');return;}
      if(d.hrPerson&&data.people.some(p=>p.unit.task_id===d.hrPerson)){state.person=d.hrPerson;state.referenceManual=false;state.goalQuery='';state.iprQuery='';state.horizon='';render();return;}
      if(d.hrKind&&definitions[d.hrKind]){state.kind=d.hrKind;state.referenceManual=false;}
      else if(d.hrReference&&data.references.some(r=>r.unit.task_id===d.hrReference)){state.reference=d.hrReference;state.referenceManual=true;}
      else if(d.hrFilter&&['year','horizon','department','status'].includes(d.hrFilter)){state[d.hrFilter]=d.value??'';if(d.hrFilter==='year')state.horizon='';}
      else return;render();
    });
    root.addEventListener('change',e=>{if(data)compUI.change(e.target);});
    root.addEventListener('input',e=>{if(!data)return;if(compUI.input(e.target))return;if(e.target.id==='hr-payroll-year'){payroll.year=e.target.value;return;}const keys={'hr-person-search':'query','hr-goal-search':'goalQuery','hr-ipr-search':'iprQuery'},key=keys[e.target.id];if(!key)return;state[key]=e.target.value;render(e.target.id,[e.target.selectionStart,e.target.selectionEnd]);});
    root.addEventListener('keydown',e=>{if(!data)return;const groupTab=e.target.closest('[data-hr-group]');if(groupTab){const count=definitions[state.kind].length,index=Number(groupTab.dataset.hrGroup);let next;if(e.key==='ArrowRight')next=(index+1)%count;if(e.key==='ArrowLeft')next=(index+count-1)%count;if(e.key==='Home')next=0;if(e.key==='End')next=count-1;if(next!==undefined){e.preventDefault();selectSkillGroup(next);}return;}const skillTab=e.target.closest('[data-hr-skill-tab]');if(skillTab){let next;if(e.key==='Home')next='description';if(e.key==='End')next='history';if(['ArrowLeft','ArrowRight'].includes(e.key))next=skillTab.dataset.hrSkillTab==='description'?'history':'description';if(next){e.preventDefault();selectSkillTab(next,true);}return;}const tab=e.target.closest('[data-hr-tab]');if(!tab)return;const keys=Object.keys(tabs).filter(k=>k!=='playground'||data.access?.can_manage_compensation===true),index=keys.indexOf(state.tab);let next;if(e.key==='ArrowRight')next=keys[(index+1)%keys.length];if(e.key==='ArrowLeft')next=keys[(index+keys.length-1)%keys.length];if(e.key==='Home')next=keys[0];if(e.key==='End')next=keys.at(-1);if(next){e.preventDefault();state.tab=next;render('hr-'+next+'-tab');}});
    reloaders.set(root,async(options={})=>{await load(options);if(data)void sync.check(true);});
    // Recheck permissions when opening HR, returning to the page and every minute
    // while visible. Failed checks clear the previously displayed personnel data.
    if(globalThis.document&&typeof setInterval==='function'){
      const refreshVisible=()=>{if(!document.hidden&&!root.hidden){void load({silent:true});if(data)void sync.check(true);}};
      document.addEventListener('visibilitychange',refreshVisible);
      globalThis.addEventListener?.('focus',refreshVisible);
      globalThis.addEventListener?.('pageshow',e=>{if(e.persisted)refreshVisible();});
      setInterval(refreshVisible,60000);
    }
    void load().then(()=>{if(data)void sync.check(true);});
  }
  return {mount,preload,selectTab,parsePayload,matchEmployee,comparison,countSkills,goalSummary,gradeIndex,gradePoints,scoreProfile,calculatedGrade,development,developmentSummary,gapsDetail,radarAxes,radar,iprSkillCode,skillEvidence,scale,definitions,competencies,kpi,ipr,employee,defaultReference,referenceLabel,referenceMarkdown,descriptionBlocks,competencyGuide,createDocsLoader,skillProfile,skillScale,docsLoading,parseSkillHistory,createHistoryLoader,skillHistoryChart,skillHistory,createSyncClient,lastCompletedQuarter,requestKpiExport};
})();
