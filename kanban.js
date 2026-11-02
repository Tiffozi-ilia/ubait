/* Kanban analytics: dated milestones, not sprint utilization. No network or HR data.
 * Exit date = next milestone date. Same-day entry/exit cancel in delta.
 * Current stock comes ONLY from tasks.status. Internal WIP moves cancel at its boundary.
 * Current STOP/Trash are excluded even when past milestones exist.
 */
globalThis.UbaitKanban=(()=>{
 'use strict';
 const statuses=[
  ['later','Later · Бэклог','#81909e'],['next','Next · В очереди','#9a86b6'],
  ['in_progress','В анализе','#477aa5'],['backlog_it','Передано ИТ','#517ca0'],
  ['change_request','Change Request','#b88036'],['in_progress_it','В работе ИТ','#7c6bad'],
  ['testing','Тестирование','#3d8a8f'],['in_review','ОПЭ','#638958'],['done','Done','#28836a']
 ].map(([id,title,color])=>({id,title,color}));
 const wip=new Set(['in_progress','backlog_it','change_request','in_progress_it','testing','in_review']);
 const series=[{id:'wip',title:'WIP · вся работа',color:'#896322'},...statuses];
 const grains={day:'День',week:'Неделя',month:'Месяц',quarter:'Квартал',year:'Год'};
 const groups={department:'Отдел',stream:'Стрим',stakeholder:'Заказчик',ba:'Аналитик',project:'Проект',direction:'Направление'};
 const normalize=v=>String(v??'').trim().toLocaleLowerCase('ru').replace(/\s+/g,' ');
 const aliases=new Map();
 for(const [id,values]of Object.entries({later:['later','later (бэклог)','бэклог','backlog'],next:['next','next (в очереди)','в очереди'],in_progress:['in progress','in progress (в анализе)','в анализе'],backlog_it:['backlog it','backlog it (передано ит)','передано ит'],change_request:['change request'],in_progress_it:['in progress it'],testing:['testing','тестирование'],in_review:['in review','in review (опэ)','опэ'],done:['done','готово'],stop:['stop'],trash:['trash']}))for(const v of [...values,'kanban_'+id])aliases.set(v,id);
 const currentStatus=v=>aliases.get(normalize(v))||'other';
 const dayMs=86400000;
 function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||+v.slice(0,4)<1900||+v.slice(0,4)>2199)return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;}
 const iso=d=>d.toISOString().slice(0,10);
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const movements={delta:'Дельта',incoming:'Пришло',outgoing:'Ушло'};
 const defaults=()=>({mode:'flow',movement:'delta',metric:'tasks',grain:'month',from:today().slice(0,4)+'-01-01',to:today(),selected:'in_progress',group:'department',page:0});
 function bucket(date,grain){const d=new Date(date+'T00:00:00Z');if(grain==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return iso(d);}if(grain==='month')return date.slice(0,7)+'-01';if(grain==='quarter')return date.slice(0,4)+'-'+String(Math.floor((+date.slice(5,7)-1)/3)*3+1).padStart(2,'0')+'-01';if(grain==='year')return date.slice(0,4)+'-01-01';return date;}
 function periods(from,to,grain){const out=[];let d=new Date(bucket(from,grain)+'T00:00:00Z');while(iso(d)<=to){out.push(iso(d));if(grain==='year')d.setUTCFullYear(d.getUTCFullYear()+1);else if(grain==='month'||grain==='quarter')d.setUTCMonth(d.getUTCMonth()+(grain==='quarter'?3:1));else d.setUTCDate(d.getUTCDate()+(grain==='week'?7:1));}return out;}
 const endOf=(key,grain)=>{const d=new Date(key+'T00:00:00Z');if(grain==='year')d.setUTCFullYear(d.getUTCFullYear()+1);else if(grain==='month'||grain==='quarter')d.setUTCMonth(d.getUTCMonth()+(grain==='quarter'?3:1));else d.setUTCDate(d.getUTCDate()+(grain==='week'?7:1));return iso(new Date(+d-dayMs));};
 const dateLabel=d=>d.slice(8)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
 function periodLabel(key,grain){if(grain==='year')return key.slice(0,4);if(grain==='quarter')return ['I','II','III','IV'][Math.floor((+key.slice(5,7)-1)/3)]+' кв. '+key.slice(0,4);if(grain==='month')return new Intl.DateTimeFormat('ru',{month:'short',timeZone:'UTC'}).format(new Date(key+'T00:00:00Z'))+' '+key.slice(2,4);if(grain==='week')return dateLabel(key)+' – '+dateLabel(endOf(key,grain));return dateLabel(key);}
 const summarize=rows=>{const tasks=new Map(rows.map(r=>[r.task.id,r.task]));let sp=0,missing=0;for(const s of tasks.values()){if(s.sp===null||!Number.isFinite(s.sp)||s.sp<0)missing++;else sp+=s.sp;}return {tasks:tasks.size,sp,missing};};
 // Movement sums are additive across dates. Missing SP cancels when the SAME task
 // enters and leaves within the interval; unknown SP never becomes a made-up value.
 function balance(rows){
  const incoming={tasks:0,sp:0,missing:0},outgoing={tasks:0,sp:0,missing:0},net=new Map();
  for(const r of rows){const s=r.direction==='out'?outgoing:incoming,sign=r.direction==='out'?-1:1;s.tasks++;
   if(r.task.sp===null||!Number.isFinite(r.task.sp)||r.task.sp<0)s.missing++;else s.sp+=r.task.sp;
   const item=net.get(r.task.id)||{task:r.task,count:0};item.count+=sign;net.set(r.task.id,item);
  }
  let missing=0,sp=0,known=0;for(const {task,count}of net.values()){if(!count)continue;if(task.sp===null||!Number.isFinite(task.sp)||task.sp<0)missing++;else{sp+=task.sp*count;known++;}}
  return {incoming,outgoing,delta:{tasks:incoming.tasks-outgoing.tasks,sp,missing,known},uniqueTasks:net.size};
 }
 function measure(rows,o){if(o.mode==='stock')return summarize(rows);const b=balance(rows);return {...b,...b[o.movement]};}
 function calculate(model,filters,options={}){
  const o={...defaults(),...options};
  const asOf=validDate(model.meta.duration_as_of)?model.meta.duration_as_of:today();
  const scope=[...model.stories.values()].filter(s=>!['stop','trash'].includes(currentStatus(s.status))&&globalThis.StoryMapModel.cutMatches(s,filters)&&(!filters.search||s.search.includes(filters.search.trim().toLocaleLowerCase('ru'))));
  const covered=model.meta.kanban_source==='reestr.kanban'&&scope.every(s=>Array.isArray(s.kanban));
  const rangeError=!validDate(o.from)||!validDate(o.to)?'Укажите обе даты диапазона.':o.from>o.to?'Начало диапазона должно быть не позже окончания.':null;
  const events=[],stock=[],issues=[];
  for(const task of scope){
   const status=currentStatus(task.status);stock.push({task,status,date:null});
   if(status==='other')issues.push({task,reason:'Текущий статус не распознан: '+(task.status||'не указан')});
   if(!covered)continue;
   const dates=new Map(),bad=new Set();
   for(const event of task.kanban){const id=String(event.status_code??'').replace(/^kanban_/,'');
    if(!statuses.some(s=>s.id===id)){if(id!=='stop'&&id!=='trash')issues.push({task,reason:'Неизвестный код этапа: '+String(event.status_code??'')});continue;}
    if(!validDate(event.date)||event.date>asOf){bad.add(id);issues.push({task,reason:'Некорректная или будущая дата этапа '+id});continue;}
    if(dates.has(id)&&dates.get(id)!==event.date){bad.add(id);issues.push({task,reason:'Несколько разных дат одного этапа '+id});}
    else dates.set(id,event.date);
   }
   for(const id of bad)dates.delete(id);
   if(!dates.size)issues.push({task,reason:'Нет дат переходов; задача видна только в режиме «Сейчас»'});
   // Dates are calendar days. Status order breaks ties, so intermediate same-day
   // stages each have +1 and -1; the final stage retains +1.
   const timeline=[...dates].map(([status,date])=>({status,date})).sort((a,b)=>a.date.localeCompare(b.date)||statuses.findIndex(s=>s.id===a.status)-statuses.findIndex(s=>s.id===b.status));
   for(let i=0;i<timeline.length;i++){
    const step=timeline[i],previous=timeline[i-1],next=timeline[i+1];
    events.push({task,...step,direction:'in'});
    if(next)events.push({task,status:step.status,date:next.date,direction:'out'});
    if(wip.has(step.status)&&(!previous||!wip.has(previous.status)))events.push({task,status:'wip',date:step.date,direction:'in'});
    if(wip.has(step.status)&&next&&!wip.has(next.status))events.push({task,status:'wip',date:next.date,direction:'out'});
   }
  }
  const inRange=r=>!rangeError&&r.date>=o.from&&r.date<=o.to;
  const flow=events.filter(inRange),raw=flow.filter(r=>r.status!=='wip'&&r.direction==='in');
  const rows=id=>o.mode==='stock'?stock.filter(r=>id==='wip'?wip.has(r.status):r.status===id):flow.filter(r=>r.status===id);
  const selected=rows(o.selected);
  const calendar=o.mode==='flow'&&!rangeError?periods(o.from,o.to,o.grain):[];
  const byPeriod=new Map(calendar.map(key=>[key,[]]));for(const r of selected)if(r.date)byPeriod.get(bucket(r.date,o.grain))?.push(r);
  const groupMap=new Map();let multiGroup=false;
  for(const r of selected){const values=o.group==='project'?[r.task.project]:r.task.facets[o.group]||[];const names=values.length?[...new Set(values)]:['Не указан'];if(names.length>1)multiGroup=true;for(const name of names){if(!groupMap.has(name))groupMap.set(name,[]);groupMap.get(name).push(r);}}
  const breakdown=[...groupMap].map(([name,rows])=>({name,rows,...measure(rows,o)})).sort((a,b)=>Math.abs(b[o.metric])-Math.abs(a[o.metric])||a.name.localeCompare(b.name,'ru'));
  return {options:o,asOf,covered,rangeError,scope,events,stock,issues,selected,multiGroup,breakdown,
   total:measure(selected,o),flowTasks:summarize(raw).tasks,transitionCount:raw.length,
   cards:series.map(s=>({...s,rows:rows(s.id),...measure(rows(s.id),o)})),
   periods:[...byPeriod].map(([key,rows])=>({key,rows,...measure(rows,o)}))};
 }
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(v);
 const value=(r,metric,signed=false)=>{const n=r[metric],unknown=metric==='sp'&&r.missing&&(r.known===0||r.known===undefined&&r.missing===r.tasks);return (unknown?'—':(signed&&n>0?'+':'')+fmt(n))+(metric==='sp'&&r.missing?' *':'');};
 const buttons=(items,key,active)=>`<div class="segmented" role="group" aria-label="${key==='grain'?'Шаг графика':key==='metric'?'Единица объёма':key==='mode'?'Режим':key==='movement'?'Показатель движения':'Разрез'}">${Object.entries(items).map(([id,title])=>`<button data-k-${key}="${id}" aria-pressed="${id===active}">${title}</button>`).join('')}</div>`;
 function flowGrid(c,interactive=true){
  return `<div class="kb-flow-grid"><span></span><span>Пришло</span><span>Ушло</span><span>Δ</span>${[['tasks','Задачи'],['sp','SP']].map(([metric,label])=>`<span class="kb-flow-unit">${label}</span>${['incoming','outgoing','delta'].map(kind=>interactive?`<button class="kb-flow-number ${kind==='delta'?'kb-net':''}" data-k-card="${c.id}" data-k-cell="${kind}" aria-label="${esc(c.title)} · ${movements[kind]}: ${value(c[kind],metric,kind==='delta')} ${label}">${value(c[kind],metric,kind==='delta')}</button>`:`<strong class="kb-flow-number ${kind==='delta'?'kb-net':''}">${value(c[kind],metric,kind==='delta')}</strong>`).join('')}`).join('')}</div>`;
 }
 function flowChart(r){
  const o=r.options,signed=o.movement==='delta',unit=o.metric==='sp'?'SP':'задач';
  const page=Math.max(0,Math.min(o.page,Math.max(0,Math.ceil(r.periods.length/12)-1))),shown=r.periods.slice(page*12,page*12+12),max=r.periods.reduce((m,p)=>Math.max(m,Math.abs(p[o.metric])),1);
  return `<div class="kb-graph-controls">${buttons(movements,'movement',o.movement)}${buttons({tasks:'Задачи',sp:'SP'},'metric',o.metric)}</div>
   <div class="kb-chart-title"><span>${dateLabel(o.from)} — ${dateLabel(o.to)}</span><span>${signed?'Δ = пришло − ушло · ':''}${unit}</span></div>
   <div class="kb-chart ${signed?'kb-signed':''}" style="--bars:${shown.length}">${shown.map(p=>{const n=p[o.metric],size=Math.abs(n)/max*(signed?48:100);return `<button class="kb-column" data-k-period="${p.key}" title="${esc(periodLabel(p.key,o.grain))}: ${value(p,o.metric,signed)} ${unit}" aria-label="${esc(periodLabel(p.key,o.grain))}: ${value(p,o.metric,signed)} ${unit}. Открыть задачи"><span class="kb-column-space"><b>${value(p,o.metric,signed)}</b><span class="kb-column-fill ${n<0?'negative':''} ${o.metric==='sp'&&p.missing?'partial':''}" style="height:${size}%;${signed?(n<0?'top:50%':'bottom:50%'):''}"></span></span><small>${esc(['week','day'].includes(o.grain)?dateLabel(p.key).slice(0,5):periodLabel(p.key,o.grain))}</small></button>`;}).join('')}</div>
   <footer><span>${o.grain==='week'?'Недели с понедельника. ':'Нажмите на столбец для детализации.'}</span>${r.periods.length>12?`<button class="action" data-k-page="${page-1}" ${page===0?'disabled':''} aria-label="Предыдущие периоды">←</button><span>${page+1} / ${Math.ceil(r.periods.length/12)}</span><button class="action" data-k-page="${page+1}" ${(page+1)*12>=r.periods.length?'disabled':''} aria-label="Следующие периоды">→</button>`:''}</footer>`;
 }
 function render(r){
  const o=r.options,flow=o.mode==='flow',signed=flow&&o.movement==='delta',chosen=series.find(s=>s.id===o.selected)||series[0],unit=o.metric==='sp'?'SP':'задач';
  const unavailable=flow&&(!r.covered||r.rangeError);
  return `<div class="kb-controls">${buttons({flow:'Движение',stock:'Сейчас'},'mode',o.mode)}${flow?`<label>С <input type="date" data-k-date="from" value="${esc(o.from)}" min="1900-01-01" max="2199-12-31" aria-label="Начало диапазона"></label><label>По <input type="date" data-k-date="to" value="${esc(o.to)}" min="1900-01-01" max="2199-12-31" aria-label="Конец диапазона"></label>${buttons(grains,'grain',o.grain)}`:`<span class="kb-note">Текущие статусы · срез ${dateLabel(r.asOf)}</span><div class="kb-units">${buttons({tasks:'Задачи',sp:'SP'},'metric',o.metric)}</div>`}</div>
   ${unavailable?`<div class="kb-empty" role="status"><h2>${r.rangeError?'Проверьте диапазон':'Нужны даты переходов'}</h2><p>${esc(r.rangeError||'Обновите выдающий флоу Story Map до версии с Kanban. Текущие статусы уже доступны в режиме «Сейчас».')}</p></div>`:`
   <div class="kb-cards ${flow?'kb-flow-cards':''}">${r.cards.map(c=>`<section class="kb-card ${c.id===o.selected?'selected':''}" style="--series:${c.color}"><button class="kb-card-label" data-k-selected="${c.id}" aria-pressed="${c.id===o.selected}">${c.title}</button>${flow?flowGrid(c):`<button class="kb-card-number" data-k-card="${c.id}" aria-label="${esc(c.title)}: ${value(c,o.metric)} ${unit}. Открыть задачи">${value(c,o.metric)}<small>${unit} ↗</small></button>`}</section>`).join('')}</div>
   <div class="kb-dashboard" style="--series:${chosen.color}"><section class="kb-chart-panel"><header><div><span class="kb-eyebrow">${flow?'ДВИЖЕНИЕ ЗА ПЕРИОД':'ОБЪЁМ СЕЙЧАС'}</span><h2>${flow?chosen.title:'Задачи в статусах'}</h2></div><button class="action" data-k-detail="selected">${flow?movements[o.movement]:chosen.title} · ${value(r.total,o.metric,signed)} ${unit} ↗</button></header>
   ${flow?flowChart(r):`<div class="kb-stock-bars">${r.cards.filter(c=>c.id!=='wip').map(c=>`<button data-k-card="${c.id}" style="--series:${c.color}"><span>${c.title}</span><span class="kb-meter"><i style="width:${c[o.metric]/Math.max(1,...r.cards.filter(x=>x.id!=='wip').map(x=>x[o.metric]))*100}%"></i></span><strong>${value(c,o.metric)}</strong></button>`).join('')}</div>`}
   ${r.cards.some(c=>flow?c.incoming.missing||c.outgoing.missing:c.missing)?'<p class="kb-warning">* Есть задачи без оценки SP. Показана известная сумма; количество задач полное.</p>':''}
   </section><section class="kb-breakdown"><header><h2>В разрезе</h2><span class="kb-note">${flow?movements[o.movement]+' · ':''}${unit}</span></header>${buttons(groups,'group',o.group)}<div class="kb-rank-list">${r.breakdown.length?r.breakdown.map((g,i)=>`<button class="kb-rank" data-k-group-detail="${i}"><span class="kb-rank-name">${esc(g.name)}<small>${flow?'Пришло '+g.incoming.tasks+' · ушло '+g.outgoing.tasks:g.tasks+' задач'}</small></span><span class="kb-meter"><i class="${g[o.metric]<0?'negative':''}" style="width:${Math.abs(g[o.metric])/Math.max(1,...r.breakdown.map(x=>Math.abs(x[o.metric])))*100}%"></i></span><strong>${value(g,o.metric,signed)}</strong></button>`).join(''):'<p class="kb-note">Нет движения по выбранным условиям.</p>'}</div>${r.multiGroup?'<p class="kb-note">Задача с несколькими значениями входит в каждое из них. Разрезы не суммируются.</p>':''}</section></div>`}
   <div class="kb-bottom"><button class="text-button" data-k-info="true">Как считаем${r.issues.length?' · замечания: '+r.issues.length:''}</button>${!flow&&r.stock.some(s=>s.status==='other')?`<button class="text-button" data-k-unknown>Другие статусы: ${r.stock.filter(s=>s.status==='other').length} · открыть задачи</button>`:''}<span>Нормализованный объём · STOP и Trash исключены</span></div>`;
 }
 const css=`
 .app-panel[data-view="kanban"] #project-year,.app-panel[data-view="kanban"] #story-period{display:none}
 #kanban-view{padding:10px 16px 14px;overflow:auto}.kb-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.kb-controls label{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--sub)}.kb-controls input{border:1px solid var(--line);background:var(--paper);border-radius:6px;padding:5px 7px;font-size:12px;min-width:0}.kb-units{margin-left:auto}.kb-note,.kb-summary,.kb-bottom{font-size:11px;color:var(--sub)}.kb-summary{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.kb-cards{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px;margin-bottom:14px}.kb-card{border:1px solid var(--line);border-top:3px solid var(--series);border-radius:7px;background:var(--paper);min-width:0;overflow:hidden}.kb-card.selected{background:var(--soft);border-color:var(--accent)}.kb-card button{background:none;border:0;text-align:left;width:100%;padding:8px 10px}.kb-card-label{font-size:11px;min-height:45px;display:flex;align-items:flex-start;line-height:1.3}.kb-card-number{font-size:clamp(16px,1.6vw,24px);font-weight:650;line-height:1.15;font-variant-numeric:tabular-nums}.kb-card-number small{display:block;font-size:10px;color:var(--sub);font-weight:400;margin-top:5px}.kb-card button:hover{background:var(--bg)}.kb-dashboard{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(290px,1fr);gap:14px;align-items:start}.kb-chart-panel,.kb-breakdown{border:1px solid var(--line);border-radius:9px;background:var(--paper);min-width:0;padding:16px}.kb-dashboard header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.kb-dashboard h2{font-size:17px}.kb-eyebrow{font-size:9px;letter-spacing:.1em;color:var(--sub)}.kb-chart-title{display:flex;justify-content:space-between;gap:10px;font-size:10px;color:var(--sub);margin-bottom:12px}.kb-chart{display:grid;grid-template-columns:repeat(var(--bars),minmax(0,1fr));gap:6px;padding-top:24px}.kb-column{padding:0;background:none;border:0;min-width:0;text-align:center}.kb-column-space{height:170px;position:relative;display:flex;align-items:flex-end;border-bottom:1px solid var(--line)}.kb-column-fill{display:block;width:100%;background:var(--series);border-radius:4px 4px 0 0;opacity:.75;min-height:1px}.kb-column:hover .kb-column-fill,.kb-column:focus-visible .kb-column-fill{opacity:1}.kb-column-space b{position:absolute;top:-23px;width:100%;font-size:10px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kb-column small{display:block;font-size:9px;color:var(--sub);padding-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kb-column-fill.partial{background:repeating-linear-gradient(45deg,var(--series) 0 4px,var(--track) 4px 7px)}.kb-chart-panel footer{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--sub);margin-top:20px}.kb-chart-panel footer>span:first-child{margin-right:auto}.kb-breakdown .segmented{flex-wrap:wrap;margin-bottom:10px}.kb-rank-list{max-height:270px;overflow:auto}.kb-rank{display:grid;grid-template-columns:minmax(90px,1.3fr) minmax(40px,1fr) 52px;align-items:center;gap:12px;background:none;border:0;border-bottom:1px solid var(--line);width:100%;padding:13px 0;text-align:left}.kb-rank:hover{background:var(--bg)}.kb-rank-name{font-size:12px;overflow-wrap:anywhere}.kb-rank-name small{display:block;font-size:10px;color:var(--sub);margin-top:2px}.kb-rank strong{text-align:right;font-size:14px;font-variant-numeric:tabular-nums}.kb-meter{display:block;background:var(--track);height:6px;border-radius:5px;overflow:hidden}.kb-meter i{display:block;height:100%;background:var(--series);border-radius:5px}.kb-bottom{display:flex;justify-content:space-between;gap:12px;margin-top:14px}.kb-stock-bars button{display:grid;grid-template-columns:145px minmax(40px,1fr) 60px;gap:15px;align-items:center;width:100%;padding:9px 0;background:none;border:0;text-align:left;font-size:12px}.kb-stock-bars button:hover{background:var(--bg)}.kb-stock-bars strong{text-align:right}.kb-warning{font-size:11px;color:var(--danger);margin-top:14px}.kb-empty{padding:50px 20px;border:1px solid var(--line);border-radius:8px;background:var(--paper);text-align:center}.kb-empty h2{font-size:18px;margin-bottom:10px}.kb-empty p{color:var(--sub)}.kb-task{display:block;padding:12px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink)}.kb-task strong{font-size:13px}.kb-task small{display:block;color:var(--sub);margin-top:4px;font-size:11px}.kb-task:hover{color:var(--accent)}.kb-dialog{width:min(760px,94vw)}.kb-dialog .dialog-top h2{font-size:16px}.kb-detail-summary{font-size:13px;margin-bottom:12px}.kb-detail-more{width:100%;margin-top:15px}.kb-method{margin:12px 0;font-size:13px;line-height:1.6}.kb-issue{padding:8px 0;border-bottom:1px solid var(--line);font-size:12px}
 @media(min-width:1550px){.kb-column-space{height:230px}.kb-rank-list{max-height:340px}}
 @media(max-width:1200px){.kb-cards{grid-template-columns:repeat(5,minmax(0,1fr))}.kb-card-label{min-height:30px;padding-bottom:0!important}.kb-card-number{font-size:21px}.kb-card-number small{display:inline;margin-left:6px}.kb-dashboard{grid-template-columns:minmax(0,1.4fr) minmax(270px,1fr)}.kb-column-space{height:140px}}
 @media(max-width:500px){.kb-cards{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
 @media(max-width:760px){#kanban-view{padding:8px}.kb-dashboard{grid-template-columns:1fr}.kb-controls{gap:6px}.kb-controls .segmented button{padding:5px 6px}.kb-summary{flex-wrap:wrap}.kb-cards{gap:4px}.kb-card button{padding:7px}.kb-card-number{font-size:18px}.kb-card-label{font-size:10px;min-height:38px}.kb-card-number small{display:block;margin-left:0}.kb-chart-panel,.kb-breakdown{padding:12px}.kb-chart{gap:3px}.kb-chart-panel header{flex-wrap:wrap}.kb-chart-panel .action{font-size:10px}.kb-bottom{flex-wrap:wrap}.kb-units{margin-left:0}.kb-column small{font-size:8px}}
 .kb-cards.kb-flow-cards{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.kb-flow-cards .kb-card-label{min-height:0;padding:7px 10px!important;font-size:12px;font-weight:600}
 .kb-flow-grid{display:grid;grid-template-columns:38px repeat(3,minmax(0,1fr));gap:2px 0;padding:0 7px 7px;align-items:center;font-variant-numeric:tabular-nums}
 .kb-flow-grid>span{font-size:10px;color:var(--sub);text-align:center}.kb-flow-grid .kb-flow-unit{text-align:left}
 .kb-card .kb-flow-number,.kb-flow-number{display:block;min-width:0;padding:4px 2px!important;font-size:15px;line-height:1.2;text-align:center;font-weight:550;white-space:nowrap}
 .kb-flow-cards .kb-flow-number:nth-child(n+10){font-size:12px;letter-spacing:-.15px}.kb-flow-grid .kb-net{background:var(--soft);border-radius:4px;font-weight:700}.kb-detail-summary .kb-flow-grid{max-width:500px;grid-template-columns:54px repeat(3,minmax(0,1fr));margin-bottom:14px}.kb-detail-summary .kb-flow-number{font-size:20px}
 .kb-graph-controls{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:14px}.kb-column-fill{min-height:0}.kb-signed .kb-column-space{border-bottom:0}.kb-signed .kb-column-space:after{content:'';position:absolute;top:50%;width:calc(100% + 6px);height:1px;background:var(--line)}.kb-signed .kb-column-fill{position:absolute}.kb-column-fill.negative{background:#ac7452;border-radius:0 0 4px 4px}.kb-meter i.negative{background:#ac7452}.kb-signed .kb-column-space b{top:-20px}.kb-task-direction{font-weight:600;color:var(--accent);margin-right:8px}
 .kb-column-space{height:130px}
 @media(min-width:1550px){.kb-column-space{height:200px}}
 @media(max-width:960px){.kb-cards.kb-flow-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:500px){.kb-cards.kb-flow-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}.kb-card .kb-flow-number{font-size:12px}.kb-flow-grid{grid-template-columns:34px repeat(3,minmax(0,1fr));padding:0 4px 5px}.kb-flow-grid>span{font-size:9px}}
 `;
 let options=defaults(),report=null,root=null,detailRows=[],detailLimit=60,detailTitle='';
 function ensureStyle(){if(document.getElementById('kanban-style'))return;const style=document.createElement('style');style.id='kanban-style';style.textContent=css;document.head.append(style);}
 function dialog(){let d=document.getElementById('kanban-detail');if(d)return d;d=document.createElement('dialog');d.id='kanban-detail';d.className='kb-dialog';d.setAttribute('aria-labelledby','kb-detail-title');d.innerHTML='<div class="dialog-top"><h2 id="kb-detail-title"></h2><button class="action" data-k-close>Закрыть</button></div><div class="detail-body"></div>';document.body.append(d);d.addEventListener('click',e=>{if(e.target.closest('[data-k-close]'))d.close();if(e.target.closest('[data-k-more]')){detailLimit+=60;showDetails(detailRows,detailTitle,true);}});d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});return d;}
 function showMovement(rows,title,movement=options.movement){const filtered=options.mode==='stock'||movement==='delta'?rows:rows.filter(r=>r.direction===(movement==='incoming'?'in':'out'));showDetails(filtered,title+' · '+(options.mode==='stock'?'сейчас':movements[movement]));}
 function showDetails(rows,title,more=false){
  detailRows=rows;detailTitle=title;if(!more)detailLimit=60;const d=dialog(),total=summarize(rows),flow=rows.some(r=>r.direction),stats=flow?balance(rows):null;
  d.querySelector('h2').textContent=title;
  d.querySelector('.detail-body').innerHTML=`<div class="kb-detail-summary">${flow?flowGrid(stats,false):`${total.tasks} задач · ${value(total,'sp')} SP`}</div>${total.missing?'<p class="kb-warning">* SP рассчитан не у всех задач. Показана известная сумма.</p>':''}${rows.length?rows.slice(0,detailLimit).map(r=>`<a class="kb-task" href="https://pyrus.sovcombank.ru/t#id${encodeURIComponent(r.task.id)}" target="_blank" rel="noopener noreferrer"><strong>${r.direction?`<span class="kb-task-direction">${r.direction==='in'?'+ Пришло':'− Ушло'}</span>`:''}${esc(r.task.title)} ↗</strong><small>#${esc(r.task.id)} · ${esc(r.task.ba||'Аналитик не указан')} · ${r.task.sp===null||r.task.sp<0?'—':fmt(r.task.sp)} SP</small><small>${r.date?dateLabel(r.date)+' · ':''}Сейчас: ${esc(r.task.status||'не указан')} · ${esc(r.task.project)}</small></a>`).join(''):'<p class="kb-note">Нет задач по выбранным условиям.</p>'}${rows.length>detailLimit?`<button class="action kb-detail-more" data-k-more>Ещё ${Math.min(60,rows.length-detailLimit)} из ${rows.length-detailLimit}</button>`:''}`;
  if(!d.open)d.showModal();if(!more)d.querySelector('.detail-body').scrollTop=0;
 }
 function info(){const d=dialog();d.querySelector('h2').textContent='Как считаем Kanban';d.querySelector('.detail-body').innerHTML=`<p class="kb-method">Пришло — вход в статус, ушло — переход из него в следующий статус. Дельта = пришло − ушло, отдельно в задачах и SP. Вход и выход в один день дают 0.</p><p class="kb-method">WIP: вход из-за пределов рабочих статусов и выход за их пределы. Внутренние переходы не меняют общий WIP. «Сейчас» — только текущий tasks.status, а не остаток на конец исторического периода.</p><p class="kb-method">SP — текущая нормализованная оценка tasks.sp_true. Спринты и утилизация не участвуют. Во всех разрезах используются текущие назначения. STOP и Trash полностью исключены.</p><p class="kb-method">Даты включительно, календарь Москвы. Неделя — понедельник–воскресенье. Крайние периоды учитываются только в пределах выбранного диапазона. Год проектов, месяцы утилизации и готовность из других вкладок здесь не применяются.</p>${report.issues.length?`<h3>Замечания · ${report.issues.length}</h3>${report.issues.slice(0,100).map(i=>`<p class="kb-issue">#${esc(i.task.id)} · ${esc(i.reason)}</p>`).join('')}${report.issues.length>100?'<p class="kb-note">Показаны первые 100 замечаний.</p>':''}`:''}`;if(!d.open)d.showModal();d.querySelector('.detail-body').scrollTop=0;}
 function repaint(){report=calculate(root._model,root._filters,options);root.innerHTML=render(report);}
 function mount(container,model,filters){ensureStyle();root=container;root._model=model;root._filters=filters;
  if(!root._kanbanBound){root._kanbanBound=true;root.addEventListener('change',e=>{const key=e.target.dataset.kDate;if(key){options[key]=e.target.value;options.page=0;repaint();root.querySelector(`[data-k-date="${key}"]`)?.focus();}});
   root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
    if(d.kInfo){info();return;}
    if(d.kUnknown!==undefined){showDetails(report.stock.filter(s=>s.status==='other'),'Другие текущие статусы');return;}
    if(d.kCard){const card=report.cards.find(c=>c.id===d.kCard);showMovement(card.rows,card.title,d.kCell||options.movement);return;}
    if(d.kDetail){showMovement(report.selected,series.find(s=>s.id===options.selected).title);return;}
    if(d.kPeriod){const p=report.periods.find(p=>p.key===d.kPeriod);showMovement(p.rows,series.find(s=>s.id===options.selected).title+' · '+periodLabel(p.key,options.grain));return;}
    if(d.kGroupDetail!==undefined){const g=report.breakdown[+d.kGroupDetail];showMovement(g.rows,g.name+' · '+series.find(s=>s.id===options.selected).title);return;}
    let attr;for(const key of ['mode','movement','metric','grain','selected','group','page']){const name='k'+key[0].toUpperCase()+key.slice(1);if(d[name]!==undefined){options[key]=key==='page'?Number(d[name]):d[name];if(key!=='page')options.page=0;attr='data-k-'+key;break;}}
    if(attr){repaint();for(const next of root.querySelectorAll('['+attr+']'))if(next.getAttribute(attr)===b.getAttribute(attr)){next.focus({preventScroll:true});break;}}
   });}
  repaint();return report;
 }
 function reset(){options=defaults();}
 return {statuses,series,wip,grains,groups,currentStatus,validDate,bucket,periods,endOf,periodLabel,defaults,calculate,summarize,balance,render,mount,reset};
})();
