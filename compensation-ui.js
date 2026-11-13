/* Shared-model administration. Drafts remain local until an explicit Save. */
globalThis.UbaitCompensationUI=(()=>{
'use strict';
const C=globalThis.UbaitCompensation,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
const factor=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:8}).format(v);
const stamp=v=>v&&!Number.isNaN(new Date(v).getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(v)):'—';
const tracks={employee:'Бизнес-аналитик',boss:'Руководитель'},transitions=['Юнлинг → Падаван','Падаван → Джедай','Джедай → Магистр'];
const sorts=[['delta-desc','Индексация ↓'],['delta-asc','Индексация ↑'],['name','ФИО · А–Я'],['score','Баллы ↓'],['fair','Стоимость ↓']];
const moneyIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>';
const chevron=open=>'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="'+(open?'m4 6 4 4 4-4':'m6 4 4 4-4 4')+'"/></svg>';
const normalize=v=>String(v??'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
const department=c=>String(c.unit.team||'').trim()||'Отдел не указан';
const summarize=rows=>{const ready=rows.filter(r=>r.value.indexation_status==='ready'),cents=ready.reduce((s,r)=>s+BigInt(Math.round(r.value.indexation*100)),0n);return {employees:rows.length,calculated:ready.length,positive:ready.filter(r=>r.value.indexation>0).length,total:ready.length&&cents<=BigInt(Number.MAX_SAFE_INTEGER)?Number(cents)/100:null};};
function create({root,onSaved=()=>{},onDenied=()=>{},fetchImpl=(...args)=>fetch(...args),notify=()=>{}}){
 let ctx=null,draft=C.defaultModel(),baseline=JSON.stringify(draft),expected=0,loading=false,saving=false,error='',conflict=false,filter='all',query='',enabled=false,generation=0,hydrationRevision=0,pending=null;
 let grouped=true,sort='delta-desc',settingsOpen=false,selected='',collapsed=new Set();
 const dirty=()=>JSON.stringify(draft)!==baseline;
 const model=()=>{try{return C.validateModel({management_base_multiplier:C.number(draft.management_base_multiplier),growth:{employee:draft.growth.employee.map(C.number),boss:draft.growth.boss.map(C.number)}});}catch{return null;}};
 const adopt=value=>{ctx=value;draft=structuredClone(value.saved.model||C.defaultModel());baseline=JSON.stringify(draft);expected=value.saved.revision;conflict=false;};
 function validate(value){
  if(value?.saved?.formula_version!==C.formulaVersion)throw new Error('Обновите страницу после обновления приложения.');
  if(!Number.isSafeInteger(value.saved.revision)||value.saved.revision<0||!value.source||!Array.isArray(value.cards))throw new Error('Неверный ответ модели.');
  return value;
 }
 function receive(value){
  validate(value);
  // A late HR refresh must not roll back a newer successful Save/settings response.
  if(ctx&&value.saved.revision<ctx.saved.revision)return;
  error='';if(dirty()){if(value.saved.revision!==expected)conflict=true;ctx=value;}else adopt(value);
 }
 function hydrate(data){
  access(data?.access?.can_manage_compensation===true);if(!enabled)return;
  const settings=data.compensation_settings;
  if(!settings)return; // Older servers remain usable via the explicit settings endpoint.
  hydrationRevision++;loading=false;
  if(settings.error){error=String(settings.error);ctx=null;return;}
  try{receive({...settings,cards:data.cards.filter(c=>c.unit.status==='Работает'),hr_generated_at:data.generated_at});}
  catch(e){error=e.message;ctx=null;}
 }
 async function request(method,body){
  const response=await fetchImpl('/api/hr/compensation-settings',{method,headers:{'Content-Type':'application/json',Accept:'application/json'},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});
  if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
  let result;try{result=await response.json();}catch{throw new Error('Не удалось прочитать ответ модели.');}
  if(!response.ok)throw Object.assign(new Error(result.error||'Операция не выполнена.'),{status:response.status});
  return validate(result);
 }
 function access(allowed){
  enabled=allowed===true;if(!enabled){generation++;ctx=null;draft=C.defaultModel();baseline=JSON.stringify(draft);expected=0;conflict=false;error='';selected='';collapsed.clear();}
 }
 function refresh(){
  if(!enabled||pending||saving)return pending;
  loading=true;const id=generation,hrRevision=hydrationRevision;error='';paint();
  pending=(async()=>{try{const value=await request('GET');if(id!==generation||hrRevision!==hydrationRevision||!enabled)return;receive(value);}
   catch(e){if(id!==generation||hrRevision!==hydrationRevision)return;error=e.message;if([401,403].includes(e.status)){access(false);onDenied();}}
   finally{loading=false;pending=null;notify();}})();return pending;
 }
 async function save(){
  if(!enabled||saving||conflict||!ctx)return;
  const value=model();if(!value){error='Введите коэффициент базы больше нуля и шесть коэффициентов роста не меньше нуля.';paint();return;}
  saving=true;error='';paint();const id=generation;
  try{const result=await request('PUT',{model:value,expected_revision:expected,formula_version:C.formulaVersion});if(id!==generation||!enabled)return;adopt(ctx&&ctx.saved.revision>result.saved.revision?ctx:result);await onSaved();}
  catch(e){if(id!==generation)return;error=e.message;if(e.status===409)conflict=true;if([401,403].includes(e.status)){access(false);onDenied();}}
  finally{saving=false;notify();}
 }
 function status(){
  const author=ctx?.saved.updated_by?.label;
  return `<div class="comp-save-state"><span>${saving?'Сохраняем…':loading?'Обновляем модель…':dirty()?'Есть несохранённые изменения':ctx?.saved.model?'Сохранено · версия '+ctx.saved.revision:'Модель не настроена'}</span>${author?'<small>'+esc(author)+' · '+esc(stamp(ctx.saved.updated_at))+'</small>':''}</div>`;
 }
 function messages(){return (conflict?'<div class="comp-alert" role="alert">Настройки уже изменены другим руководителем. Черновик сохранён здесь. Нажмите «Отменить изменения», чтобы принять сохранённую модель.<button class="action" data-comp-action="refresh">Обновить модель</button></div>':'')+(error?'<div class="comp-alert" role="alert">'+esc(error)+'</div>':dirty()&&!model()?'<div class="comp-alert" role="alert">Проверьте коэффициенты. Пока показан расчёт по сохранённой модели.</div>':'');}
 function results(){
  if(!ctx)return null;
  const current=model(),before=C.analyze(ctx.cards,ctx.source,ctx.saved);
  const after=current?C.analyze(ctx.cards,ctx.source,{revision:expected,model:current}):null,values=after||before;
  const selected=values.rows.filter(({card,value})=>(filter==='all'||filter==='positive'&&value.indexation_status==='ready'&&value.indexation>0||filter==='excluded'&&value.indexation_status!=='ready')&&normalize([card.unit.staff,card.unit.team,card.unit.position,value.grade].join(' ')).includes(normalize(query)));
  const byName=(a,b)=>String(a.card.unit.staff||'').localeCompare(String(b.card.unit.staff||''),'ru')||String(a.card.unit.task_id).localeCompare(String(b.card.unit.task_id));
  selected.sort((a,b)=>{
   if(sort==='name')return byName(a,b);
   const key=sort==='score'?'score':sort==='fair'?'fair_cost':'indexation',av=a.value[key],bv=b.value[key];
   if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;
   return (av==null?0:sort==='delta-asc'?av-bv:bv-av)||byName(a,b);
  });
  return {before,after,values,current,selected,previous:new Map(before.rows.map(row=>[row.card.unit.task_id,row.value]))};
 }
 function detailHTML(c,v,r){
  if(v.fair_cost===null)return '<div class="comp-detail"><strong>Расчёт недоступен</strong><p>'+esc(v.reason||'Недостаточно данных для расчёта.')+'</p></div>';
  const used=r.after?r.current:ctx.saved.model,base=ctx.source.base*(v.track==='boss'?used.management_base_multiplier:1),threshold=ctx.source.tracks[v.track].thresholds[0],floor=v.score<threshold;
  const factors=v.applied_coefficients?.length?v.applied_coefficients.map(factor).join(' × '):'1';
  const equation=fmt(base)+' × '+fmt(floor?threshold:v.score)+' / '+fmt(threshold)+' × '+factors+' = '+fmt(v.fair_cost);
  return '<div class="comp-detail"><div><strong>Расчёт стоимости</strong><span>'+equation+'</span></div><p>База × отношение баллов к Юнлингу × коэффициенты достигнутых грейдов'+(floor?'. До порога Юнлинга используется базовая стоимость.':'')+'</p>'+(v.reason?'<p class="comp-row-reason">'+esc(v.reason)+'</p>':'')+'</div>';
 }
 function personHTML(c,v,r){
  const prior=r.previous.get(c.unit.task_id),changed=dirty()&&r.after&&ctx.saved.model&&v.fair_cost!==null&&prior?.fair_cost!=null&&v.fair_cost!==prior.fair_cost,open=selected===c.unit.task_id;
  const cell=(label,value,cl='')=>'<td data-label="'+label+'" class="'+cl+'">'+value+'</td>';
  const name='<button class="comp-person-name" type="button" data-comp-action="person" data-comp-id="'+esc(c.unit.task_id)+'" aria-expanded="'+open+'" aria-controls="comp-detail-'+esc(c.unit.task_id)+'">'+esc(c.unit.staff||'Без имени')+'</button><small>'+esc([!grouped?department(c):'',tracks[v.track]||'Уровень не указан',v.score!==null?fmt(v.score)+' б.':''].filter(Boolean).join(' · '))+'</small>'+(v.reason?'<span class="comp-row-reason">'+esc(v.reason)+'</span>':'');
  const fair='<strong>'+fmt(v.fair_cost)+'</strong>'+(changed?'<small>Сохранено: '+fmt(prior.fair_cost)+'</small>':'');
  return '<tr data-comp-person="'+esc(c.unit.task_id)+'"'+(open?' class="comp-person-open"':'')+'>'+cell('Сотрудник',name,'comp-person')+cell('Грейд',esc(v.grade||'—'))+cell('Оклад',fmt(C.number(c.unit.cost)),'comp-number')+cell('Стоимость',fair,'comp-number comp-fair')+cell('Индексация','<strong>'+(v.indexation>0?'+':'')+fmt(v.indexation)+'</strong>','comp-number'+(v.indexation>0?' comp-increase':''))+'</tr><tr id="comp-detail-'+esc(c.unit.task_id)+'" class="comp-detail-row" '+(open?'':'hidden')+'><td colspan="5">'+(open?detailHTML(c,v,r):'')+'</td></tr>';
 }
 function rowsHTML(r=results()){
  if(!r)return '';
  const groups=new Map();for(const row of r.selected){const dept=grouped?department(row.card):'';if(!groups.has(dept))groups.set(dept,[]);groups.get(dept).push(row);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b,'ru')).map(([dept,rows])=>{
   const total=summarize(rows),open=!collapsed.has(dept);
   const header=grouped?'<tr class="comp-dept-row"><td colspan="5"><button class="comp-dept-heading" type="button" data-comp-action="department" data-comp-department="'+esc(dept)+'" aria-expanded="'+open+'"><span class="comp-dept-name">'+chevron(open)+esc(dept)+' <small>'+total.employees+' чел.</small></span><span class="comp-dept-total"><span>'+(query||filter!=='all'?'Индексация выборки':'Индексация отдела')+(total.calculated<total.employees?' · '+total.calculated+'/'+total.employees+' рассчитано':'')+'</span><strong>'+fmt(total.total)+'</strong></span></button></td></tr>':'';
   return header+(!grouped||open?rows.map(({card,value})=>personHTML(card,value,r)).join(''):'');
  }).join('')||'<tr><td colspan="5" class="comp-list-empty">'+(query||filter!=='all'?'Нет сотрудников по выбранным условиям':'Нет доступных сотрудников со статусом «Работает»')+'</td></tr>';
 }
 function summaryHTML(r=results()){
  if(!r)return '';
  const total=summarize(r.selected),previous=summarize(r.selected.map(row=>({value:r.previous.get(row.card.unit.task_id)}))),delta=dirty()&&r.after&&ctx.saved.model&&total.total!==null&&previous.total!==null?C.roundMoney(total.total-previous.total):null;
  return '<div class="comp-total"><strong>'+fmt(total.total)+'</strong><span>'+(query||filter!=='all'?'Индексация по выборке':'Индексация')+(dirty()&&r.after?' · предпросмотр':'')+'</span></div><div class="comp-summary-meta"><span><strong>'+total.calculated+' / '+total.employees+'</strong>рассчитано</span><span><strong>'+total.positive+'</strong>с индексацией</span>'+(delta!==null?'<span><strong>'+(delta>0?'+':'')+fmt(delta)+'</strong>к сохранённой модели</span>':'')+'</div>';
 }
 function filtersHTML(r=results()){
  if(!r)return '';
  return [['all','Все',r.values.summary.employees],['positive','С индексацией',r.values.summary.positive],['excluded','Без расчёта',r.values.summary.excluded]].map(([id,title,n])=>'<button type="button" data-comp-action="filter" data-comp-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+title+' <span>'+n+'</span></button>').join('');
 }
 function referencesHTML(){
  if(!ctx)return '';const current=model();
  return Object.entries(tracks).map(([kind,title])=>'<div class="comp-reference-track"><h4>'+title+'</h4>'+ctx.source.tracks[kind].bands.map(b=>{
   let price=null;if(current&&ctx.source.base!==null&&ctx.source.tracks[kind].valid)try{price=C.fairCost(b.score,kind,ctx.source,current);}catch{}
   return '<div><span>'+esc(b.grade)+'</span><span>'+fmt(b.score)+' б.</span><strong>'+fmt(price)+'</strong></div>';
  }).join('')+'</div>').join('');
 }
 const managementBase=()=>ctx&&ctx.source.base!==null&&C.number(draft.management_base_multiplier)>0?fmt(ctx.source.base*C.number(draft.management_base_multiplier)):'—';
 function render(){
  if(!enabled)return '';
  if(!ctx)return '<section class="comp-page"><h2>Playgound</h2><div class="hr-empty" role="status">'+(loading?'Загружаем модель…':esc(error||'Модель ещё не загружена'))+'<button class="action" data-comp-action="refresh">Обновить</button></div></section>';
  const r=results(),field=(id,value,label)=>'<input id="'+id+'" data-comp-field="'+id+'" type="text" inputmode="decimal" autocomplete="off" aria-label="'+label+'" value="'+esc(value??'')+'" '+(saving?'disabled':'')+'>';
  return `<section class="comp-page"><header class="comp-heading"><div>${moneyIcon}<h2>Playgound</h2></div></header><div id="comp-messages">${messages()}</div><div class="comp-model-strip"><div class="comp-model-values"><span>База Юнлинга · БА<strong>${fmt(ctx.source.base)}</strong></span><span>База руководителя<strong id="comp-management-base">${managementBase()}</strong></span><div id="comp-model-status">${status()}</div></div><button id="comp-settings-toggle" class="action comp-settings-toggle" type="button" data-comp-action="settings" aria-expanded="${settingsOpen}" aria-controls="comp-settings">${moneyIcon}Коэффициенты${chevron(settingsOpen)}</button></div><section id="comp-settings" class="hr-card comp-settings" aria-label="Настройки стоимости" ${settingsOpen?'':'hidden'}><div class="comp-settings-layout"><div class="comp-settings-base"><h3>База расчёта</h3><label class="comp-base-row"><span>Коэффициент руководителя</span>${field('comp-management',draft.management_base_multiplier,'Коэффициент базы руководителя')}</label><p>Надбавка включается при переходе на грейд.<br>1,2 означает +20%; коэффициенты перемножаются.</p></div><div class="comp-growth"><h3>При переходе на грейд</h3><div class="comp-growth-heading"><span>Переход</span><span>БА</span><span>Руководитель</span></div>${transitions.map((t,i)=>'<div class="comp-growth-row"><span>'+t+'</span>'+['employee','boss'].map(k=>field('comp-'+k+'-'+i,draft.growth[k][i],tracks[k]+': '+t)).join('')+'</div>').join('')}</div></div><footer class="comp-settings-footer"><div id="comp-save-state">${status()}</div><div class="comp-settings-actions"><button class="action" data-comp-action="reset" ${saving?'disabled':''}>Отменить изменения</button><button class="action primary" data-comp-action="save" ${saving||conflict||!r.current?'disabled':''}>Сохранить</button></div></footer></section><section class="comp-results" aria-label="Расчёт по сотрудникам"><div id="comp-summary" class="comp-summary">${summaryHTML(r)}</div><div class="comp-list-controls"><div id="comp-list-filters" class="comp-list-filters" role="group" aria-label="Состав списка">${filtersHTML(r)}</div><div class="comp-list-tools"><input id="comp-search" data-comp-search="true" type="search" aria-label="Поиск сотрудника, отдела или грейда" placeholder="Сотрудник, отдел, грейд" value="${esc(query)}"><select id="comp-sort" data-comp-sort="true" aria-label="Сортировка сотрудников">${sorts.map(([id,label])=>'<option value="'+id+'" '+(id===sort?'selected':'')+'>'+label+'</option>').join('')}</select></div></div><div class="comp-list-subtools"><span id="comp-group-hint">${grouped?'Сортировка внутри отделов':'Единый список сотрудников'}</span><button id="comp-group-toggle" type="button" class="comp-link" data-comp-action="group">${grouped?'Убрать группировку':'Сгруппировать по отделам'}</button></div><table class="comp-people-table"><colgroup><col style="width:38%"><col style="width:14%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup><thead><tr><th scope="col">Сотрудник</th><th scope="col">Грейд</th><th scope="col">Оклад</th><th scope="col">Стоимость</th><th scope="col">Индексация</th></tr></thead><tbody id="comp-rows">${rowsHTML(r)}</tbody></table><footer class="comp-source">Статус «Работает» · ${esc(stamp(ctx.hr_generated_at))}</footer><details class="comp-reference"><summary>Пороги и стоимость эталонов</summary><div id="comp-references">${referencesHTML()}</div></details></section></section>`;
 }
 function paint(){
  const r=results(),set=(id,html)=>{const el=root.querySelector('#'+id);if(el)el.innerHTML=html;};
  set('comp-save-state',status());set('comp-model-status',status());set('comp-messages',messages());set('comp-summary',summaryHTML(r));set('comp-rows',rowsHTML(r));set('comp-list-filters',filtersHTML(r));set('comp-references',referencesHTML());
  const base=root.querySelector('#comp-management-base');if(base)base.textContent=managementBase();
  const groupButton=root.querySelector('#comp-group-toggle');if(groupButton)groupButton.textContent=grouped?'Убрать группировку':'Сгруппировать по отделам';
  const hint=root.querySelector('#comp-group-hint');if(hint)hint.textContent=grouped?'Сортировка внутри отделов':'Единый список сотрудников';
  root.querySelectorAll('[data-comp-field]').forEach(e=>e.disabled=saving);
  root.querySelectorAll('[data-comp-action]').forEach(e=>{e.disabled=['save','reset','refresh'].includes(e.dataset.compAction)&&(saving||(e.dataset.compAction==='save'&&(conflict||!r?.current)));});
 }
 function click(button){
  const action=button?.dataset.compAction;if(!action)return false;
  if(action==='settings'){settingsOpen=!settingsOpen;const panel=root.querySelector('#comp-settings');if(panel)panel.hidden=!settingsOpen;button.setAttribute('aria-expanded',String(settingsOpen));button.innerHTML=moneyIcon+'Коэффициенты'+chevron(settingsOpen);}
  if(action==='filter'){filter=button.dataset.compFilter;paint();root.querySelector('[data-comp-filter="'+filter+'"]')?.focus({preventScroll:true});}
  if(action==='group'){grouped=!grouped;paint();}
  if(action==='department'){const dept=button.dataset.compDepartment;collapsed.has(dept)?collapsed.delete(dept):collapsed.add(dept);paint();Array.from(root.querySelectorAll('[data-comp-department]')).find(b=>b.dataset.compDepartment===dept)?.focus({preventScroll:true});}
  if(action==='person'){selected=selected===button.dataset.compId?'':button.dataset.compId;paint();root.querySelector('[data-comp-id="'+button.dataset.compId+'"]')?.focus({preventScroll:true});}
  if(action==='refresh')void refresh();if(action==='save')void save();
  if(action==='reset'&&ctx&&!saving){adopt(ctx);error='';notify();}
  return true;
 }
 function change(target){if(!target?.dataset.compSort)return false;if(sorts.some(([id])=>id===target.value)){sort=target.value;paint();}return true;}
 function input(target){
  if(target?.dataset.compSearch){query=target.value;paint();return true;}
  const field=target?.dataset.compField;if(!field||saving)return false;
  if(field==='comp-management')draft.management_base_multiplier=target.value;
  else{const m=field.match(/^comp-(employee|boss)-([012])$/);if(!m)return false;draft.growth[m[1]][Number(m[2])]=target.value;}
  error='';paint();return true;
 }
 const leave=e=>{if(enabled&&dirty()){e.preventDefault();e.returnValue='';}};globalThis.addEventListener?.('beforeunload',leave);
 return {access,hydrate,refresh,render,paint,click,input,change,dirty,loaded:()=>Boolean(ctx)||Boolean(error)||loading,state:()=>({ctx,draft,expected,conflict,saving,dirty:dirty()})};
}
return {create};
})();
