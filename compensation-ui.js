/* Shared-model administration. Drafts remain local until an explicit Save. */
globalThis.UbaitCompensationUI=(()=>{
'use strict';
const C=globalThis.UbaitCompensation,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
const stamp=v=>v?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(v)):'—';
const tracks={employee:'Бизнес-аналитики',boss:'Руководители'},transitions=['Юнлинг → Падаван','Падаван → Джедай','Джедай → Магистр'];
const moneyIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>';
function chart(kind,source,saved,draft,showSalaries,cards){
 const track=source.tracks[kind],valid=source.base!==null&&track.valid;
 if(!valid)return '<div class="comp-chart-empty">'+esc(source.base_reason||track.reason)+'</div>';
 const maximum=kind==='employee'?69:30;
 const curve=model=>{if(!model)return [];try{return Array.from({length:101},(_,i)=>[maximum*i/100,C.fairCost(maximum*i/100,kind,source,model)]);}catch{return [];}};
 const published=curve(saved),preview=curve(draft);
 const dots=showSalaries?cards.map(card=>({card,value:C.calculate(card,source,{revision:0,model:draft||saved})})).filter(r=>r.value.track===kind&&r.value.score!==null&&C.number(r.card.unit.cost)!==null&&C.number(r.card.unit.cost)>=0):[];
 if(!published.length&&!preview.length)return '<div class="comp-chart-empty">Задайте коэффициенты для предпросмотра</div>';
 const ymax=Math.max(1,...published.map(p=>p[1]),...preview.map(p=>p[1]),...dots.map(r=>C.number(r.card.unit.cost))),x=s=>62+s/maximum*490,y=c=>225-c/ymax*184;
 const path=points=>points.map(([s,c],i)=>(i?'L':'M')+x(s).toFixed(2)+','+y(c).toFixed(2)).join(' ');
 const marks=track.thresholds.map((t,i)=>`<line x1="${x(t)}" x2="${x(t)}" y1="35" y2="225" class="comp-grid" stroke-dasharray="3 5"/><text x="${x(t)}" y="246" text-anchor="middle">${fmt(t)}</text>`).join('');
 const grid=[0,.5,1].map(k=>`<line x1="62" x2="552" y1="${y(ymax*k)}" y2="${y(ymax*k)}" class="comp-grid"/><text x="54" y="${y(ymax*k)+4}" text-anchor="end">${fmt(ymax*k/1000)}k</text>`).join('');
 return `<svg class="comp-chart" viewBox="0 0 580 278" role="img" aria-label="${tracks[kind]}: стоимость по баллам AS IS"><text x="62" y="20">Справедливая стоимость</text>${grid}${marks}${published.length?'<path d="'+path(published)+'" class="comp-line saved"/>':''}${preview.length?'<path d="'+path(preview)+'" class="comp-line draft"/>':''}${dots.map(r=>`<circle cx="${x(r.value.score)}" cy="${y(C.number(r.card.unit.cost))}" r="3.5" class="comp-salary-dot"><title>${esc(r.card.unit.staff)} · ${fmt(C.number(r.card.unit.cost))}</title></circle>`).join('')}<text x="552" y="271" text-anchor="end">AS IS · баллы</text></svg>`;
}
function create({root,onSaved=()=>{},onDenied=()=>{},fetchImpl=(...args)=>fetch(...args),notify=()=>{}}){
 let ctx=null,draft=C.defaultModel(),baseline=JSON.stringify(draft),expected=0,loading=false,saving=false,error='',message='',conflict=false,showSalaries=false,enabled=false,generation=0,pending=null;
 const dirty=()=>JSON.stringify(draft)!==baseline;
 const model=()=>{try{return C.validateModel({management_base_multiplier:C.number(draft.management_base_multiplier),growth:{employee:draft.growth.employee.map(C.number),boss:draft.growth.boss.map(C.number)}});}catch{return null;}};
 const adopt=value=>{ctx=value;draft=structuredClone(value.saved.model||C.defaultModel());baseline=JSON.stringify(draft);expected=value.saved.revision;conflict=false;};
 async function request(method,body){
  const response=await fetchImpl('/api/hr/compensation-settings',{method,headers:{'Content-Type':'application/json',Accept:'application/json'},credentials:'same-origin',cache:'no-store',body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});
  if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
  let result;try{result=await response.json();}catch{throw new Error('Не удалось прочитать ответ модели.');}
  if(!response.ok)throw Object.assign(new Error(result.error||'Операция не выполнена.'),{status:response.status});
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
  try{const result=await request('PUT',{model:value,expected_revision:expected});if(id!==generation||!enabled)return;adopt(result);message='Сохранено';await onSaved();}
  catch(e){if(id!==generation)return;error=e.message;if(e.status===409)conflict=true;if([401,403].includes(e.status)){access(false);onDenied();}}
  finally{saving=false;notify();}
 }
 function status(){
  const author=ctx?.saved.updated_by?.label;
  return `<div class="comp-save-state"><span>${saving?'Сохраняем…':loading?'Обновляем модель…':dirty()?'Есть несохранённые изменения':ctx?.saved.model?'Сохранено · версия '+ctx.saved.revision:'Модель не настроена'}</span>${author?'<small>'+esc(author)+' · '+esc(stamp(ctx.saved.updated_at))+'</small>':''}</div>`;
 }
 function messages(){return (conflict?'<div class="comp-alert" role="alert">Настройки уже изменены другим руководителем. Черновик сохранён здесь. Нажмите «Отменить изменения», чтобы принять сохранённую модель.<button class="action" data-comp-action="refresh">Обновить модель</button></div>':'')+(error?'<div class="comp-alert" role="alert">'+esc(error)+'</div>':'')+(dirty()?'<p class="comp-note">Предпросмотр не меняет карточки сотрудников и реестр. Они используют сохранённую модель.</p>':'');}
 function preview(){
  if(!ctx)return '';
  const draftModel=model(),savedModel=ctx.saved.model,source=ctx.source;
  const before=C.analyze(ctx.cards,source,ctx.saved),after=draftModel?C.analyze(ctx.cards,source,{revision:expected,model:draftModel}):null;
  const values=after||before,delta=after&&after.summary.indexation!==null&&before.summary.indexation!==null&&ctx.saved.model?C.roundMoney(after.summary.indexation-before.summary.indexation):null;
  const metric=(label,value)=>'<div><small>'+label+'</small><strong>'+fmt(value)+'</strong></div>';
  const curves=Object.entries(tracks).map(([kind,title])=>{
   const thresholds=source.tracks[kind].bands;
   const at=(score,m)=>{if(score===null||!m||source.base===null||!source.tracks[kind].valid)return null;try{return C.fairCost(score,kind,source,m);}catch{return null;}};
   return `<section class="hr-card comp-curve"><h3>${title}</h3>${chart(kind,source,savedModel,draftModel,showSalaries,ctx.cards)}<div class="comp-thresholds">${thresholds.map(b=>`<div><small>${esc(b.grade)} · ${fmt(b.score)}</small><strong>${fmt(at(b.score,draftModel||savedModel))}</strong>${dirty()&&savedModel?'<span>Сохранено: '+fmt(at(b.score,savedModel))+'</span>':''}</div>`).join('')}</div></section>`;
  }).join('');
  return `<div class="comp-legend"><span><i class="saved"></i>Сохранённая модель</span><span><i class="draft"></i>Предпросмотр</span><label><input type="checkbox" data-comp-salaries="true" ${showSalaries?'checked':''}> Показать текущие оклады</label></div><div class="comp-curves">${curves}</div><section class="hr-card comp-impact"><h3>Влияние на оклады</h3><p class="comp-note">Доступные вам сотрудники со статусом «Работает» · срез ${esc(stamp(ctx.hr_generated_at))}</p><div class="comp-metrics">${metric('Рассчитано',values.summary.calculated)}${metric('С индексацией',values.summary.positive)}${metric('Индексация · сохранено',savedModel?before.summary.indexation:null)}${metric('Индексация · предпросмотр',after?.summary.indexation??null)}${metric('Разница',delta)}${metric('Не рассчитано',values.summary.excluded)}</div><details class="comp-people"><summary>Расчёт по сотрудникам · ${values.summary.employees}</summary><div class="comp-table-scroll"><table><thead><tr><th>Сотрудник / отдел</th><th>Трек / грейд</th><th>AS IS</th><th>Оклад</th><th>Стоимость</th><th>Индексация</th><th>Примечание</th></tr></thead><tbody>${values.rows.map(({card:c,value:v})=>`<tr><td>${esc(c.unit.staff)}<small>${esc(c.unit.team)}</small></td><td>${esc(tracks[v.track]||'—')}<small>${esc(v.grade)}</small></td><td>${fmt(v.score)}</td><td>${fmt(C.number(c.unit.cost))}</td><td>${fmt(v.fair_cost)}</td><td>${fmt(v.indexation)}</td><td>${esc(v.reason)}</td></tr>`).join('')}</tbody></table></div></details>${values.excluded.length?'<details class="comp-people"><summary>Не рассчитано · '+values.excluded.length+'</summary><ul>'+values.excluded.map(({card:c,value:v})=>'<li><strong>'+esc(c.unit.staff)+'</strong> — '+esc(v.reason)+'</li>').join('')+'</ul></details>':''}</section>`;
 }
 function render(){
  if(!enabled)return '';
  if(!ctx)return '<section class="comp-page"><h2>Playgound</h2><div class="hr-empty" role="status">'+(loading?'Загружаем модель…':esc(error||'Модель ещё не загружена'))+'<button class="action" data-comp-action="refresh">Обновить</button></div></section>';
  const field=(id,value,label)=>`<input id="${id}" data-comp-field="${id}" type="text" inputmode="decimal" autocomplete="off" aria-label="${label}" value="${esc(value??'')}" ${saving?'disabled':''}>`;
  return `<section class="comp-page"><header class="comp-heading"><div>${moneyIcon}<h2>Playgound</h2></div><p>Стоимость по текущим компетенциям</p></header><div id="comp-messages">${messages()}</div><section class="hr-card comp-settings"><div class="comp-base-grid"><div><span>База Юнлинга · БА</span><strong>${fmt(ctx.source.base)}</strong><small>Из эталона Юнлинга в реестре</small></div><label><span>Коэффициент базы руководителя</span>${field('comp-management',draft.management_base_multiplier,'Коэффициент базы руководителя')}</label><div><span>База Юнлинга · руководитель</span><strong id="comp-management-base">${ctx.source.base!==null&&C.number(draft.management_base_multiplier)>0?fmt(ctx.source.base*C.number(draft.management_base_multiplier)):'—'}</strong></div></div><div class="comp-growth"><div class="comp-growth-heading"><span>Рост между грейдами</span><span>БА</span><span>Руководитель</span></div>${transitions.map((t,i)=>'<div class="comp-growth-row"><span>'+t+'</span>'+['employee','boss'].map(k=>field('comp-'+k+'-'+i,draft.growth[k][i],tracks[k]+': '+t)).join('')+'</div>').join('')}</div><footer class="comp-settings-footer"><div id="comp-save-state">${status()}</div><button class="action" data-comp-action="reset" ${saving?'disabled':''}>Отменить изменения</button><button class="action primary" data-comp-action="save" ${saving||conflict?'disabled':''}>Сохранить</button></footer></section><div id="comp-preview">${preview()}</div></section>`;
 }
 function paint(){
  const set=(id,html)=>{const el=root.querySelector('#'+id);if(el)el.innerHTML=html;};
  set('comp-save-state',status());set('comp-messages',messages());set('comp-preview',preview());
  const base=root.querySelector('#comp-management-base');if(base)base.textContent=ctx?.source.base!==null&&C.number(draft.management_base_multiplier)>0?fmt(ctx.source.base*C.number(draft.management_base_multiplier)):'—';
  root.querySelectorAll('[data-comp-field]').forEach(e=>e.disabled=saving);
  root.querySelectorAll('[data-comp-action]').forEach(e=>{e.disabled=saving||(e.dataset.compAction==='save'&&conflict);});
 }
 function click(button){const action=button?.dataset.compAction;if(!action)return false;if(action==='refresh')void refresh();if(action==='save')void save();if(action==='reset'&&ctx&&!saving){adopt(ctx);error='';message='';notify();}return true;}
 function input(target){
  if(target?.dataset.compSalaries){showSalaries=target.checked;paint();return true;}
  const field=target?.dataset.compField;if(!field||saving)return false;
  if(field==='comp-management')draft.management_base_multiplier=target.value;
  else{const m=field.match(/^comp-(employee|boss)-([012])$/);if(!m)return false;draft.growth[m[1]][Number(m[2])]=target.value;}
  error='';message='';paint();return true;
 }
 const leave=e=>{if(enabled&&dirty()){e.preventDefault();e.returnValue='';}};globalThis.addEventListener?.('beforeunload',leave);
 return {access,refresh,render,paint,click,input,dirty,loaded:()=>Boolean(ctx)||Boolean(error)||loading,state:()=>({ctx,draft,expected,conflict,saving,dirty:dirty()})};
}
return {create,chart};
})();
