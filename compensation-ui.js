/* Shared-model administration. Drafts remain local until an explicit Save. */
globalThis.UbaitCompensationUI=(()=>{
'use strict';
const C=globalThis.UbaitCompensation,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
const stamp=v=>v?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(v)):'—';
const tracks={employee:'Бизнес-аналитики',boss:'Руководители'},transitions=['Юнлинг → Падаван','Падаван → Джедай','Джедай → Магистр'];
const moneyIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>';
function create({root,onSaved=()=>{},onDenied=()=>{},fetchImpl=(...args)=>fetch(...args),notify=()=>{}}){
 let ctx=null,draft=C.defaultModel(),baseline=JSON.stringify(draft),expected=0,loading=false,saving=false,error='',message='',conflict=false,filter='all',query='',enabled=false,generation=0,pending=null;
 const dirty=()=>JSON.stringify(draft)!==baseline;
 const model=()=>{try{return C.validateModel({management_base_multiplier:C.number(draft.management_base_multiplier),growth:{employee:draft.growth.employee.map(C.number),boss:draft.growth.boss.map(C.number)}});}catch{return null;}};
 const adopt=value=>{ctx=value;draft=structuredClone(value.saved.model||C.defaultModel());baseline=JSON.stringify(draft);expected=value.saved.revision;conflict=false;};
 async function request(method,body){
  const response=await fetchImpl('/api/hr/compensation-settings',{method,headers:{'Content-Type':'application/json',Accept:'application/json'},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});
  if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
  let result;try{result=await response.json();}catch{throw new Error('Не удалось прочитать ответ модели.');}
  if(!response.ok)throw Object.assign(new Error(result.error||'Операция не выполнена.'),{status:response.status});
  if(result.saved?.formula_version!==C.formulaVersion)throw new Error('Обновите страницу после обновления приложения.');
  if(!result.saved||!result.source||!Array.isArray(result.cards))throw new Error('Неверный ответ модели.');return result;
 }
 function access(allowed){
  enabled=allowed===true;if(!enabled){generation++;ctx=null;draft=C.defaultModel();baseline=JSON.stringify(draft);conflict=false;error='';message='';}
 }
 function refresh(){
  if(!enabled||pending||saving)return pending;
  loading=true;const id=generation;error='';paint();
  pending=(async()=>{try{const value=await request('GET');if(id!==generation||!enabled)return;if(dirty()){if(value.saved.revision!==expected)conflict=true;ctx=value;}else adopt(value);}
   catch(e){if(id!==generation)return;error=e.message;if([401,403].includes(e.status)){access(false);onDenied();}}
   finally{loading=false;pending=null;notify();}})();return pending;
 }
 async function save(){
  if(!enabled||saving)return;
  const value=model();if(!value){error='Введите коэффициент базы больше нуля и шесть коэффициентов роста не меньше нуля.';paint();return;}
  saving=true;error='';message='';paint();const id=generation;
  try{const result=await request('PUT',{model:value,expected_revision:expected,formula_version:C.formulaVersion});if(id!==generation||!enabled)return;adopt(result);message='Сохранено';await onSaved();}
  catch(e){if(id!==generation)return;error=e.message;if(e.status===409)conflict=true;if([401,403].includes(e.status)){access(false);onDenied();}}
  finally{saving=false;notify();}
 }
 function status(){
  const author=ctx?.saved.updated_by?.label;
  return `<div class="comp-save-state"><span>${saving?'Сохраняем…':loading?'Обновляем модель…':dirty()?'Есть несохранённые изменения':ctx?.saved.model?'Сохранено · версия '+ctx.saved.revision:'Модель не настроена'}</span>${author?'<small>'+esc(author)+' · '+esc(stamp(ctx.saved.updated_at))+'</small>':''}</div>`;
 }
 function messages(){return (conflict?'<div class="comp-alert" role="alert">Настройки уже изменены другим руководителем. Черновик сохранён здесь. Нажмите «Отменить изменения», чтобы принять сохранённую модель.<button class="action" data-comp-action="refresh">Обновить модель</button></div>':'')+(error?'<div class="comp-alert" role="alert">'+esc(error)+'</div>':'');}
 function results(){
  if(!ctx)return null;
  const current=model(),before=C.analyze(ctx.cards,ctx.source,ctx.saved);
  const after=current?C.analyze(ctx.cards,ctx.source,{revision:expected,model:current}):null;
  return {before,after,values:after||before,current};
 }
 function rowsHTML(){
  const r=results();if(!r)return '';
  const previous=new Map(r.before.rows.map(row=>[row.card.unit.task_id,row.value]));
  const normalize=v=>String(v??'').toLocaleLowerCase('ru').replace(/ё/g,'е');
  const selected=r.values.rows.filter(({card,value})=>(filter==='all'||filter==='positive'&&value.indexation_status==='ready'&&value.indexation>0||filter==='excluded'&&value.indexation_status!=='ready')&&normalize([card.unit.staff,card.unit.team,card.unit.position,value.grade].join(' ')).includes(normalize(query).trim()));
  selected.sort((a,b)=>(b.value.indexation??-1)-(a.value.indexation??-1)||String(a.card.unit.staff).localeCompare(String(b.card.unit.staff),'ru'));
  const cell=(label,value,cl='')=>'<td data-label="'+label+'" class="'+cl+'">'+value+'</td>';
  return selected.map(({card:c,value:v})=>{
   const prior=previous.get(c.unit.task_id),changed=dirty()&&r.after&&ctx.saved.model&&v.fair_cost!==null&&prior?.fair_cost!==null&&v.fair_cost!==prior?.fair_cost;
   const multiplier=v.applied_coefficients?.length?v.applied_coefficients.reduce((a,b)=>a*b,1):v.status==='ready'?1:null;
   const factors=v.applied_coefficients?.length>1?v.applied_coefficients.map(k=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(k)).join(' × '):'';
   const name='<strong>'+esc(c.unit.staff||'Без имени')+'</strong><small>'+esc(c.unit.team||'Отдел не указан')+'</small>'+(v.reason?'<span class="comp-row-reason">'+esc(v.reason)+'</span>':'');
   const fair='<strong>'+fmt(v.fair_cost)+'</strong>'+(changed?'<small>Сохранено: '+fmt(prior.fair_cost)+'</small>':'');
   return '<tr data-comp-person="'+esc(c.unit.task_id)+'"'+(v.indexation_status!=='ready'?' class="comp-row-incomplete"':'')+'>'+cell('Сотрудник',name,'comp-person')+cell('Грейд',esc(v.grade||'—')+'<small>'+esc(tracks[v.track]||'Уровень не указан')+'</small>')+cell('Баллы',fmt(v.score),'comp-number')+cell('Множитель',multiplier===null?'—':'×'+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:6}).format(multiplier)+(factors?'<small>'+esc(factors)+'</small>':''),'comp-number')+cell('Оклад',fmt(C.number(c.unit.cost)),'comp-number')+cell('Стоимость',fair,'comp-number comp-fair')+cell('Индексация','<strong>'+(v.indexation>0?'+':'')+fmt(v.indexation)+'</strong>','comp-number'+(v.indexation>0?' comp-increase':''))+'</tr>';
  }).join('')||'<tr><td colspan="7" class="comp-list-empty">'+(query||filter!=='all'?'Нет сотрудников по выбранным условиям':'Нет доступных сотрудников со статусом «Работает»')+'</td></tr>';
 }
 function summaryHTML(){
  const r=results();if(!r)return '';
  const {before,after,values}=r,delta=after&&after.summary.indexation!==null&&before.summary.indexation!==null&&ctx.saved.model?C.roundMoney(after.summary.indexation-before.summary.indexation):null;
  return '<div class="comp-total"><span>Индексация · '+(dirty()&&after?'предпросмотр':'сохранено')+'</span><strong>'+fmt((after||ctx.saved.model)&&values.summary.calculated?values.summary.indexation:null)+'</strong><small>'+(ctx.saved.model?'Сохранено: '+fmt(before.summary.calculated?before.summary.indexation:null):'Модель ещё не сохранена')+(delta!==null?' · изменение '+(delta>0?'+':'')+fmt(delta):'')+'</small></div><div class="comp-total-count"><strong>'+values.summary.calculated+' / '+values.summary.employees+'</strong><span>сотрудников рассчитано</span></div>';
 }
 function filtersHTML(){
  const r=results();if(!r)return '';
  return [['all','Все',r.values.summary.employees],['positive','С индексацией',r.values.summary.positive],['excluded','Без расчёта',r.values.summary.excluded]].map(([id,title,n])=>'<button type="button" data-comp-action="filter" data-comp-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+title+' <span>'+n+'</span></button>').join('');
 }
 function referencesHTML(){
  if(!ctx)return '';const current=model();
  return Object.entries(tracks).map(([kind,title])=>'<div class="comp-reference-track"><h4>'+title+'</h4>'+ctx.source.tracks[kind].bands.map(b=>{
   let price=null;if(current&&ctx.source.base!==null&&ctx.source.tracks[kind].valid)try{price=C.fairCost(b.score,kind,ctx.source,current);}catch{}
   return '<div><span>'+esc(b.grade)+'</span><span>'+fmt(b.score)+' б.</span><strong>'+fmt(price)+'</strong></div>';
  }).join('')+'</div>').join('');
 }
 function render(){
  if(!enabled)return '';
  if(!ctx)return '<section class="comp-page"><h2>Playgound</h2><div class="hr-empty" role="status">'+(loading?'Загружаем модель…':esc(error||'Модель ещё не загружена'))+'<button class="action" data-comp-action="refresh">Обновить</button></div></section>';
  const field=(id,value,label)=>'<input id="'+id+'" data-comp-field="'+id+'" type="text" inputmode="decimal" autocomplete="off" aria-label="'+label+'" value="'+esc(value??'')+'" '+(saving?'disabled':'')+'>';
  return `<section class="comp-page"><header class="comp-heading"><div>${moneyIcon}<h2>Playgound</h2></div><p>Настройте коэффициенты — результат сразу виден по каждому сотруднику.</p></header><div id="comp-messages">${messages()}</div><div class="comp-layout"><aside class="hr-card comp-settings" aria-label="Настройки стоимости"><h3>База расчёта</h3><div class="comp-base-row"><span>Юнлинг · БА</span><strong>${fmt(ctx.source.base)}</strong></div><label class="comp-base-row"><span>Коэффициент руководителя</span>${field('comp-management',draft.management_base_multiplier,'Коэффициент базы руководителя')}</label><div class="comp-base-row"><span>Юнлинг · руководитель</span><strong id="comp-management-base">${ctx.source.base!==null&&C.number(draft.management_base_multiplier)>0?fmt(ctx.source.base*C.number(draft.management_base_multiplier)):'—'}</strong></div><div class="comp-growth"><h3>При переходе на грейд</h3><p>1 — без надбавки · 1,2 — +20%<br>Пройденные коэффициенты перемножаются.</p><div class="comp-growth-heading"><span>Переход</span><span>БА</span><span>Рук.</span></div>${transitions.map((t,i)=>'<div class="comp-growth-row"><span>'+t+'</span>'+['employee','boss'].map(k=>field('comp-'+k+'-'+i,draft.growth[k][i],tracks[k]+': '+t)).join('')+'</div>').join('')}</div><div class="comp-formula">База × отношение баллов к Юнлингу × коэффициенты достигнутых грейдов</div><footer class="comp-settings-footer"><div id="comp-save-state">${status()}</div><button class="action" data-comp-action="reset" ${saving?'disabled':''}>Отменить изменения</button><button class="action primary" data-comp-action="save" ${saving||conflict?'disabled':''}>Сохранить</button></footer></aside><section class="comp-results" aria-label="Расчёт по сотрудникам"><div id="comp-summary" class="comp-summary">${summaryHTML()}</div><div class="comp-list-heading"><h3>Сотрудники</h3><span>Статус «Работает» · ${esc(stamp(ctx.hr_generated_at))}</span></div><div class="comp-list-controls"><div id="comp-list-filters" class="comp-list-filters" role="group" aria-label="Состав списка">${filtersHTML()}</div><input id="comp-search" data-comp-search="true" type="search" aria-label="Поиск сотрудника, отдела или грейда" placeholder="Сотрудник, отдел, грейд" value="${esc(query)}"></div><table class="comp-people-table"><colgroup><col style="width:25%"><col style="width:15%"><col style="width:7%"><col style="width:10%"><col style="width:13%"><col style="width:16%"><col style="width:14%"></colgroup><thead><tr><th scope="col">Сотрудник / отдел</th><th scope="col">Грейд</th><th scope="col">Баллы</th><th scope="col">Множитель</th><th scope="col">Оклад</th><th scope="col">Стоимость</th><th scope="col">Индексация</th></tr></thead><tbody id="comp-rows">${rowsHTML()}</tbody></table><details class="comp-reference"><summary>Пороги и стоимость эталонов</summary><div id="comp-references">${referencesHTML()}</div></details></section></div></section>`;
 }
 function paint(){
  const set=(id,html)=>{const el=root.querySelector('#'+id);if(el)el.innerHTML=html;};
  set('comp-save-state',status());set('comp-messages',messages());set('comp-summary',summaryHTML());set('comp-rows',rowsHTML());set('comp-list-filters',filtersHTML());set('comp-references',referencesHTML());
  const base=root.querySelector('#comp-management-base');if(base)base.textContent=ctx?.source.base!==null&&C.number(draft.management_base_multiplier)>0?fmt(ctx.source.base*C.number(draft.management_base_multiplier)):'—';
  root.querySelectorAll('[data-comp-field]').forEach(e=>e.disabled=saving);
  root.querySelectorAll('[data-comp-action]').forEach(e=>{e.disabled=saving||(e.dataset.compAction==='save'&&conflict);});
 }
 function click(button){const action=button?.dataset.compAction;if(!action)return false;if(action==='filter'){filter=button.dataset.compFilter;paint();root.querySelector('[data-comp-filter="'+filter+'"]')?.focus();}if(action==='refresh')void refresh();if(action==='save')void save();if(action==='reset'&&ctx&&!saving){adopt(ctx);error='';message='';notify();}return true;}
 function input(target){
  if(target?.dataset.compSearch){query=target.value;const rows=root.querySelector('#comp-rows');if(rows)rows.innerHTML=rowsHTML();return true;}
  const field=target?.dataset.compField;if(!field||saving)return false;
  if(field==='comp-management')draft.management_base_multiplier=target.value;
  else{const m=field.match(/^comp-(employee|boss)-([012])$/);if(!m)return false;draft.growth[m[1]][Number(m[2])]=target.value;}
  error='';message='';paint();return true;
 }
 const leave=e=>{if(enabled&&dirty()){e.preventDefault();e.returnValue='';}};globalThis.addEventListener?.('beforeunload',leave);
 return {access,refresh,render,paint,click,input,dirty,loaded:()=>Boolean(ctx)||Boolean(error)||loading,state:()=>({ctx,draft,expected,conflict,saving,dirty:dirty()})};
}
return {create};
})();
