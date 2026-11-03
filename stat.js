/* Atomic task/month statistics. Never sums epic/project totals.
 * Current task BA and department. STOP retains all monthly utilization; Trash is excluded.
 * One distinct analyst = one FTE inside each scope. Group rates are recomputed
 * from totals/distinct people, never sums/averages of employee rates.
 */
globalThis.StoryMapStatistics = (() => {
  const groups={ba:'Аналитик',department:'Отдел',stream:'Стрим',stakeholder:'Заказчик',management:'Управление'};
  const monthValid=m=>/^\d{4}\.(0[1-9]|1[0-2])$/.test(m);
  const empty=()=>({sum:0,known:0,missing:0,negative:0,tasks:new Set(),active:new Set(),unassigned:false});
  const name=s=>s.ba.trim();
  const periodOf=(month,grain)=>grain==='year'?month.slice(0,4):grain==='quarter'?month.slice(0,4)+'.Q'+Math.ceil(Number(month.slice(5))/3):month;
  function calculate(model,input={},options={}) {
    const M=globalThis.StoryMapModel,f={...M.defaults(),...input};
    const grain=['month','quarter','year'].includes(options.grain)?options.grain:'month';
    const groupBy=Object.hasOwn(groups,options.groupBy)?options.groupBy:'department';
    const scope=[...model.stories.values()].filter(s=>String(s.status??'').trim().toLowerCase()!=='trash'&&M.cutMatches(s,f)&&(!f.search||s.search.includes(f.search.trim().toLocaleLowerCase('ru'))));
    const periodAllowed=month=>{
      if(!monthValid(month))return false;
      const yearHit=month.slice(0,4)===f.projectYear;
      if(f.projectYear&&(f.exclude?.projectYear?yearHit:!yearHit))return false;
      const hit=f.periods.some(p=>M.inPeriod(month,p));
      return !f.periods.length||(f.exclude?.periods?!hit:hit);
    };
    const periodSet=new Set(scope.flatMap(s=>s.months.filter(m=>periodAllowed(m.month)).map(m=>periodOf(m.month,grain))));
    if(f.projectYear&&!f.exclude?.projectYear)for(let m=1;m<=12;m++){const month=f.projectYear+'.'+String(m).padStart(2,'0');if(periodAllowed(month))periodSet.add(periodOf(month,grain));}
    const periods=[...periodSet].sort();
    const make=(id,title)=>({id,title,cells:new Map(periods.map(p=>[p,empty()])),total:empty(),people:new Set(),unknownPerson:false,employees:new Map()});
    const total=make('total','Итого по выборке'),rows=new Map();
    const assign=(cell,s,m)=>{cell.tasks.add(s.id);if(m.sp_utilized===null){cell.missing++;return;}cell.sum+=m.sp_utilized;cell.known++;if(m.sp_utilized<0)cell.negative++;if(m.sp_utilized>0&&name(s))cell.active.add(name(s));if(!name(s))cell.unassigned=true;};
    for(const s of scope){
      const title=groupBy==='management'?'Управление':s[groupBy]?.trim()||'Не указан';
      if(!rows.has(title))rows.set(title,make(title,title));
      const group=rows.get(title),person=name(s),personKey=person||'Без аналитика';
      if(!group.employees.has(personKey))group.employees.set(personKey,make(personKey,personKey));
      const employee=group.employees.get(personKey);
      for(const row of [total,group,employee]){if(person)row.people.add(person);else row.unknownPerson=true;}
      for(const m of s.months){if(!periodAllowed(m.month))continue;const key=periodOf(m.month,grain);
        for(const row of [total,group,employee]){assign(row.cells.get(key),s,m);assign(row.total,s,m);}
      }
    }
    const ordered=[...rows.values()].sort((a,b)=>a.title.localeCompare(b.title,'ru'));
    return {periods,rows:ordered,total,grain,groupBy,fteBasis:'scope',scopeTasks:scope.length,filter:f};
  }
  function value(row,cell,metric='sp',fteBasis='scope') {
    const fte=row.people.size;
    const unknown=row.unknownPerson;
    const sp=cell.known?cell.sum:cell.missing?null:0;
    return {value:metric==='rate'?(sp!==null&&fte&&!unknown?sp/fte:null):sp,fte,partial:cell.missing>0,unknown};
  }
  const plural={ba:'Аналитики',department:'Отделы',stream:'Стримы',stakeholder:'Заказчики',management:'Управление'};
  const monthNames=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const periodLabel=p=>p.includes('.Q')?['I','II','III','IV'][Number(p.at(-1))-1]+' кв. '+p.slice(0,4):p.includes('.')?monthNames[Number(p.slice(5))-1]+' '+p.slice(0,4):p;
  const selectedCell=(row,period)=>row.cells.get(period)||row.total;
  function periodTitle(report,focus){
    if(report.periods.includes(focus))return periodLabel(focus);
    const f=report.filter;
    if(f.periods.length)return (f.exclude?.periods?'Кроме: ':'')+f.periods.map(periodLabel).join(', ');
    return f.projectYear?(f.exclude?.projectYear?'Кроме ':'')+f.projectYear:'Все периоды';
  }
  function warnings(report,focus){
    const c=selectedCell(report.total,focus),messages=[];
    if(c.missing)messages.push(`${c.missing} месячных строк без рассчитанного SP: суммы неполные. Не использовать для премирования без проверки.`);
    if(report.total.unknownPerson)messages.push('Есть задачи без аналитика. Их SP включены в сумму, но производительность соответствующего разреза не рассчитывается.');
    if(c.negative)messages.push('Есть отрицательная утилизация. Она включена в суммы без исправлений.');
    return messages;
  }
  function render(report,{escape,fmt,metric='sp',focusPeriod='',sort='value',chartPage=null}) {
    const focus=report.periods.includes(focusPeriod)?focusPeriod:'',unit=metric==='rate'?'SP / ШЕ':'SP';
    const entries=report.rows.map(row=>({row,cell:selectedCell(row,focus),v:value(row,selectedCell(row,focus),metric)}));
    entries.sort((a,b)=>sort==='name'?a.row.title.localeCompare(b.row.title,'ru'):(b.v.value??-Infinity)-(a.v.value??-Infinity)||a.row.title.localeCompare(b.row.title,'ru'));
    const values=entries.map(e=>e.v.value).filter(v=>v!==null),low=Math.min(0,...values),high=Math.max(0,...values),span=high-low||1;
    const c=selectedCell(report.total,focus),sp=value(report.total,c),rate=value(report.total,c,'rate'),issues=warnings(report,focus);
    const number=v=>fmt(v.value)+(v.partial?' *':'');
    const maxPage=Math.max(0,Math.ceil(report.periods.length/12)-1),page=Math.max(0,Math.min(chartPage??maxPage,maxPage));
    const periods=report.periods.slice(page*12,page*12+12),trend=periods.map(p=>({p,v:value(report.total,report.total.cells.get(p),metric)}));
    const chartValues=trend.map(e=>e.v.value).filter(v=>v!==null),top=Math.max(0,...chartValues),bottom=Math.min(0,...chartValues),height=top-bottom||1,baseline=top/height*100;
    const rows=entries.map(({row,cell,v},i)=>`<button class="stat-rank-row" data-stat-row="${escape(row.id)}" aria-label="${escape(row.title)}, ${escape(number(v))} ${unit}. Открыть задачи"><span class="stat-position">${i+1}</span><span class="stat-name"><strong>${escape(row.title)}</strong><small>${report.groupBy==='ba'?'':row.people.size+' ШЕ · '}задач с фактом: ${cell.tasks.size}</small></span><span class="stat-meter ${v.value===null?'unknown':''}" aria-hidden="true"><i class="stat-zero" style="left:${-low/span*100}%"></i>${v.value===null?'':`<i class="stat-fill ${v.value<0?'negative':''}" style="left:${(Math.min(0,v.value)-low)/span*100}%;width:${Math.abs(v.value)/span*100}%"></i>`}</span><strong class="stat-value ${v.partial||v.value===null?'incomplete':''}">${number(v)}</strong><span class="stat-chevron" aria-hidden="true">›</span></button>`).join('');
    return `<div class="stat-dashboard"><section class="stat-ranking"><header class="stat-ranking-top"><div class="stat-group-switch" role="group" aria-label="Разрез статистики">${['ba','stream','stakeholder','department','management'].map(key=>`<button data-stats-group="${key}" aria-pressed="${report.groupBy===key}">${plural[key]}</button>`).join('')}</div><button class="stat-sort" data-stat-sort="${sort==='value'?'name':'value'}" title="${sort==='value'?'Сортировать по имени':'Сортировать по убыванию показателя'}">${sort==='value'?'↓ По '+unit:'А–Я'}</button></header><div class="stat-list-heading"><h2>${plural[report.groupBy]} <small>${entries.length}</small></h2><button class="stat-period-caption ${focus?'selected':''}" data-stat-period="" title="${focus?'Снять выбор периода':'Выбранный период'}" ${focus?'':'disabled'}>${escape(periodTitle(report,focus))}${focus?' ×':''}</button><span>${unit}</span></div><div class="stat-ranking-scroll" aria-label="Сравнение показателей">${rows||'<p class="stat-empty">По выбранным фильтрам нет задач.</p>'}</div><footer class="stat-list-footer">Нули включены · Нажми на строку, чтобы увидеть задачи</footer></section><aside class="stat-insights"><section class="stat-overview"><span class="stat-eyebrow">${escape(periodTitle(report,focus))} · вся выборка</span><div class="stat-primary-number"><strong>${number(metric==='rate'?rate:sp)}</strong><span>${unit}</span></div><div class="stat-secondary-metrics"><div><span>${metric==='rate'?'Освоено SP':'SP / 1 ШЕ'}</span><strong>${number(metric==='rate'?sp:rate)}</strong></div><div><span>Аналитиков</span><strong>${report.total.people.size}</strong></div><div><span>Задач с фактом</span><strong>${c.tasks.size}</strong></div></div></section><section class="stat-trend"><header><h3>Динамика</h3><div class="stat-grain-switch" role="group" aria-label="Период статистики">${[['month','Мес'],['quarter','Кв'],['year','Год']].map(([k,label])=>`<button data-stats-grain="${k}" aria-label="${k==='month'?'Месяцы':k==='quarter'?'Кварталы':'Годы'}" aria-pressed="${report.grain===k}">${label}</button>`).join('')}</div></header><div class="stat-chart" style="--period-count:${Math.max(1,periods.length)}">${trend.map(({p,v})=>`<button class="stat-period ${focus===p?'selected':''}" data-stat-period="${escape(p)}" aria-pressed="${focus===p}" aria-label="${escape(periodLabel(p))}: ${escape(number(v))} ${unit}" title="${escape(periodLabel(p))}: ${escape(number(v))} ${unit}"><span class="stat-column-track"><i class="stat-chart-zero" style="top:${baseline}%"></i>${v.value===null?'<span class="stat-missing">?</span>':`<i class="stat-column ${v.value<0?'negative':''}" style="top:${(top-Math.max(0,v.value))/height*100}%;height:${Math.abs(v.value)/height*100}%"></i>${v.value===0?`<i class="stat-dot" style="top:${baseline}%"></i>`:''}`}</span><small>${p.includes('.Q')?p.slice(5):p.includes('.')?monthNames[Number(p.slice(5))-1]:p}</small></button>`).join('')||'<p class="stat-empty">Нет периодов</p>'}</div><div class="stat-chart-footer"><span>${periods.length?escape(periodLabel(periods[0]))+' — '+escape(periodLabel(periods.at(-1))):''}</span>${maxPage?`<button data-stat-chart-page="${page-1}" ${page===0?'disabled':''} aria-label="Предыдущие периоды">‹</button><button data-stat-chart-page="${page+1}" ${page===maxPage?'disabled':''} aria-label="Следующие периоды">›</button>`:''}</div><p class="stat-chart-hint">Нажми на столбик — сравни показатели за этот период.</p></section><button class="stat-quality ${issues.length?'has-warning':''}" data-stat-info="true"><span>${issues.length?'⚠ Проверить данные · '+issues.length:'ⓘ Как считаем'}</span><span aria-hidden="true">›</span></button></aside></div>`;
  }
  function info(report,{escape,focusPeriod=''}){
    return `<h2 class="detail-title" id="detail-title">Как считаем</h2>${warnings(report,focusPeriod).map(m=>`<p class="warning">${escape(m)}</p>`).join('')}<div class="stat-info"><p><strong>1 аналитик = 1 ШЕ.</strong> В знаменателе все аналитики выбранного разреза, в том числе с 0 SP. Состав пока определяется по задачам; сотрудник без единой задачи в него не попадает.</p><p>SP / ШЕ = сумма освоенных SP / число уникальных аналитиков. В общем итоге каждый человек учитывается один раз.</p><p>Месяц, квартал и год — месячный факт. Квартальные планы не используются. Освоенные SP задач STOP учитываются в месяцах выполнения работы. Trash исключён. Задачи без эпика или проекта учитываются.</p><p>Отдел — unit.team из штатки. Связь: полное ФИО tasks.ba → unit.staff. Регистр, лишние пробелы и ё/е нормализуются. Если совпадение неоднозначно, отдел не подставляется. Для одного человека выбирается последняя актуальная карточка; это текущий отдел, не история переводов. Старый источник additional больше не используется.</p><p>Если у задачи несколько заказчиков или стримов, их сочетание показывается одной группой: SP между ними не делятся произвольно.</p><p>Знак * означает неполную сумму. Прочерк — показатель нельзя достоверно рассчитать; это не ноль.</p></div>`;
  }
  function detail(report,id,{escape,fmt,model,focusPeriod='',limit=40}){
    const row=report.rows.find(r=>r.id===id);if(!row)return null;
    const focus=report.periods.includes(focusPeriod)?focusPeriod:'',cell=selectedCell(row,focus),f=report.filter;
    const allowed=m=>monthValid(m.month)&&(!f.projectYear||(f.exclude?.projectYear?m.month.slice(0,4)!==f.projectYear:m.month.slice(0,4)===f.projectYear))&&(!f.periods.length||(f.exclude?.periods?!f.periods.some(p=>globalThis.StoryMapModel.inPeriod(m.month,p)):f.periods.some(p=>globalThis.StoryMapModel.inPeriod(m.month,p))))&&(!focus||periodOf(m.month,report.grain)===focus);
    const tasks=[...cell.tasks].map(id=>{const s=model.stories.get(id),months=s.months.filter(allowed),known=months.filter(m=>m.sp_utilized!==null);return {s,sp:known.length?known.reduce((a,m)=>a+m.sp_utilized,0):null,missing:months.length!==known.length};}).sort((a,b)=>(b.sp??-Infinity)-(a.sp??-Infinity)||a.s.title.localeCompare(b.s.title,'ru'));
    const rate=value(row,cell,'rate'),sp=value(row,cell);
    return `<h2 class="detail-title" id="detail-title">${escape(row.title)}</h2><p class="detail-path">${groups[report.groupBy]} · ${escape(periodTitle(report,focus))}</p><div class="stat-detail-metrics"><span><strong>${fmt(sp.value)}${sp.partial?' *':''}</strong> SP</span><span><strong>${fmt(rate.value)}</strong> SP / ШЕ</span><span><strong>${row.people.size}</strong> ШЕ</span></div>${cell.missing?'<p class="warning">* В сумме есть строки без рассчитанного SP.</p>':''}${row.unknownPerson?'<p class="warning">Не у всех задач указан аналитик: SP / ШЕ не рассчитан.</p>':''}<h3 class="stat-detail-heading">Задачи с фактом · ${tasks.length}</h3><div class="stat-task-list">${tasks.slice(0,limit).map(({s,sp,missing})=>`<button data-stat-task="${escape(s.id)}"><span><strong>${escape(s.title)}</strong><small>#${escape(s.id)} · ${escape(s.status)} · ${escape(s.ba||'Без аналитика')}</small></span><b>${fmt(sp)}${missing?' *':''} SP <span aria-hidden="true">›</span></b></button>`).join('')||'<p class="stat-empty">В этом периоде работы не зафиксированы. Аналитик остаётся в расчёте с 0 SP.</p>'}</div>${tasks.length>limit?`<button class="more stat-detail-more" data-stat-more="true">Показать ещё · осталось ${tasks.length-limit}</button>`:''}`;
  }
  return {calculate,render,value,groups,detail,info,selectedCell};
})();


/* Kanban analytics: dated milestones, not sprint utilization. No network or HR data.
 * Exit date = next milestone date. Same-day entry/exit cancel in delta.
 * Current stock comes ONLY from tasks.status. Internal WIP moves cancel at its boundary.
 * Current STOP/Trash are excluded even when past milestones exist.
 */
globalThis.UbaitKanbanStatistics=(()=>{
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
 const defaults=()=>selectPeriod({mode:'flow',movement:'delta',metric:'tasks',selected:'in_progress',group:'department',page:0},'month',today());
 function bucket(date,grain){const d=new Date(date+'T00:00:00Z');if(grain==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return iso(d);}if(grain==='month')return date.slice(0,7)+'-01';if(grain==='quarter')return date.slice(0,4)+'-'+String(Math.floor((+date.slice(5,7)-1)/3)*3+1).padStart(2,'0')+'-01';if(grain==='year')return date.slice(0,4)+'-01-01';return date;}
 function periods(from,to,grain){const out=[];let d=new Date(bucket(from,grain)+'T00:00:00Z');while(iso(d)<=to){out.push(iso(d));if(grain==='year')d.setUTCFullYear(d.getUTCFullYear()+1);else if(grain==='month'||grain==='quarter')d.setUTCMonth(d.getUTCMonth()+(grain==='quarter'?3:1));else d.setUTCDate(d.getUTCDate()+(grain==='week'?7:1));}return out;}
 const endOf=(key,grain)=>{const d=new Date(key+'T00:00:00Z');if(grain==='year')d.setUTCFullYear(d.getUTCFullYear()+1);else if(grain==='month'||grain==='quarter')d.setUTCMonth(d.getUTCMonth()+(grain==='quarter'?3:1));else d.setUTCDate(d.getUTCDate()+(grain==='week'?7:1));return iso(new Date(+d-dayMs));};
 // A grain selects the actual interval for EVERY card, not a chart step.
 function selectPeriod(o,grain=o.grain,anchor=o.anchor||o.to||today()){
  if(grain==='range')return {...o,grain,page:0};
  if(!Object.hasOwn(grains,grain))grain='month';
  if(!validDate(anchor))return {...o,grain,anchor,from:'',to:'',page:0};
  const from=bucket(anchor,grain);return {...o,grain,anchor,from,to:endOf(from,grain),page:0};
 }
 function shiftPeriod(o,step){
  if(o.grain==='range'||!validDate(o.anchor))return o;
  const d=new Date(o.anchor+'T00:00:00Z');
  if(o.grain==='day'||o.grain==='week')d.setUTCDate(d.getUTCDate()+step*(o.grain==='week'?7:1));
  else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+step*(o.grain==='year'?12:o.grain==='quarter'?3:1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
  const anchor=iso(d);if(!validDate(anchor))return o;return selectPeriod(o,o.grain,anchor);
 }
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
  const calendar=o.mode==='flow'&&!rangeError&&o.grain!=='range'?periods(o.from,o.to,o.grain):[];
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
 const buttons=(items,key,active)=>`<div class="segmented" role="group" aria-label="${key==='grain'?'Период всех карточек':key==='metric'?'Единица объёма':key==='mode'?'Режим':key==='movement'?'Показатель движения':'Разрез'}">${Object.entries(items).map(([id,title])=>`<button data-k-${key}="${id}" aria-pressed="${id===active}">${title}</button>`).join('')}</div>`;
 function flowGrid(c,interactive=true){
  return `<div class="kb-flow-grid"><span></span><span>Пришло</span><span>Ушло</span><span>Δ</span>${[['tasks','Задачи'],['sp','SP']].map(([metric,label])=>`<span class="kb-flow-unit">${label}</span>${['incoming','outgoing','delta'].map(kind=>interactive?`<button class="kb-flow-number ${kind==='delta'?'kb-net':''}" data-k-card="${c.id}" data-k-cell="${kind}" aria-label="${esc(c.title)} · ${movements[kind]}: ${value(c[kind],metric,kind==='delta')} ${label}">${value(c[kind],metric,kind==='delta')}</button>`:`<strong class="kb-flow-number ${kind==='delta'?'kb-net':''}">${value(c[kind],metric,kind==='delta')}</strong>`).join('')}`).join('')}</div>`;
 }
 function intervalLabel(o){
  if(!validDate(o.from)||!validDate(o.to))return 'Выберите период';
  if(o.grain==='day')return dateLabel(o.from);
  if(o.grain==='month')return new Intl.DateTimeFormat('ru',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(o.from+'T00:00:00Z'));
  if(o.grain==='quarter'||o.grain==='year')return periodLabel(o.from,o.grain);
  return dateLabel(o.from)+' — '+dateLabel(o.to);
 }
 function render(r){
  const o=r.options,flow=o.mode==='flow',custom=o.grain==='range',unavailable=flow&&(!r.covered||r.rangeError);
  return `<div class="kb-controls">${buttons({flow:'Движение',stock:'Сейчас'},'mode',o.mode)}${flow?`${buttons({...grains,range:'Диапазон'},'grain',o.grain)}${custom?`<label>С <input type="date" data-k-date="from" value="${esc(o.from)}" min="1900-01-01" max="2199-12-31" aria-label="Начало диапазона"></label><label>По <input type="date" data-k-date="to" value="${esc(o.to)}" min="1900-01-01" max="2199-12-31" aria-label="Конец диапазона"></label>`:`<div class="kb-period-nav"><button class="action" data-k-shift="-1" aria-label="Предыдущий период" ${shiftPeriod(o,-1)===o?'disabled':''}>←</button><label class="kb-anchor"><input type="date" data-k-date="anchor" value="${esc(o.anchor)}" min="1900-01-01" max="2199-12-31" aria-label="Дата внутри выбранного периода" title="Выберите любую дату нужного периода"></label><button class="action" data-k-shift="1" aria-label="Следующий период" ${shiftPeriod(o,1)===o?'disabled':''}>→</button><button class="text-button" data-k-today>Текущий</button></div>`}`:`<span class="kb-note">Текущие статусы · срез ${dateLabel(r.asOf)}</span>`}</div>
   ${flow?`<div class="kb-period-heading" aria-live="polite"><strong>${esc(intervalLabel(o))}</strong>${!r.rangeError&&o.grain!=='day'?`<span>${dateLabel(o.from)} — ${dateLabel(o.to)}</span>`:''}<small>Все статусы · задачи и SP</small></div>`:''}
   ${unavailable?`<div class="kb-empty" role="status"><h2>${r.rangeError?'Проверьте диапазон':'Нужны даты переходов'}</h2><p>${esc(r.rangeError||'Обновите выдающий флоу Story Map до версии с Kanban. Текущие статусы уже доступны в режиме «Сейчас».')}</p></div>`:`
   <div class="kb-cards">${r.cards.map(c=>`<section class="kb-card" style="--series:${c.color}" aria-label="${esc(c.title)}"><h2 class="kb-card-label">${c.title}</h2>${flow?flowGrid(c):`<button class="kb-stock-total" data-k-card="${c.id}" aria-label="${esc(c.title)}: ${value(c,'tasks')} задач, ${value(c,'sp')} SP. Открыть задачи"><span><strong>${value(c,'tasks')}</strong><small>задач</small></span><span><strong>${value(c,'sp')}</strong><small>SP</small></span></button>`}</section>`).join('')}</div>
   ${r.cards.some(c=>flow?c.incoming.missing||c.outgoing.missing:c.missing)?'<p class="kb-warning">* Есть задачи без оценки SP. Показана известная сумма; количество задач полное.</p>':''}`}
   <div class="kb-bottom"><button class="text-button" data-k-info="true">Как считаем${r.issues.length?' · замечания: '+r.issues.length:''}</button>${!flow&&r.stock.some(s=>s.status==='other')?`<button class="text-button" data-k-unknown>Другие статусы: ${r.stock.filter(s=>s.status==='other').length} · открыть задачи</button>`:''}<span>Нормализованный объём · STOP и Trash исключены</span></div>`;
 }
 const css=`
 .app-panel[data-view="statistics"][data-statistics-mode="kanban"] #project-year,.app-panel[data-view="statistics"][data-statistics-mode="kanban"] #story-period{display:none}
 #kanban-statistics-view{padding:10px 16px 14px;overflow:auto}
 .kb-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.kb-controls label{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--sub)}.kb-controls input{border:1px solid var(--line);background:var(--paper);border-radius:6px;padding:5px 7px;font-size:12px;min-width:0}
 .kb-period-nav{display:flex;align-items:center;gap:6px}.kb-period-nav>.action{padding:5px 9px}.kb-period-nav>.text-button{font-size:11px;padding:5px}.kb-period-heading{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 14px}.kb-period-heading strong{font-size:17px;text-transform:capitalize}.kb-period-heading span{font-size:12px;color:var(--sub)}.kb-period-heading small{margin-left:auto;color:var(--sub);font-size:11px}
 .kb-note,.kb-bottom{font-size:11px;color:var(--sub)}.kb-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.kb-card{border:1px solid var(--line);border-top:3px solid var(--series);border-radius:7px;background:var(--paper);min-width:0;overflow:hidden}.kb-card-label{font-size:12px;font-weight:600;line-height:1.3;padding:10px 10px 8px;margin:0}.kb-card button{background:none;border:0;text-align:left;width:100%}.kb-card button:hover{background:var(--bg)}
 .kb-flow-grid{display:grid;grid-template-columns:38px repeat(3,minmax(0,1fr));gap:3px 0;padding:0 7px 9px;align-items:center;font-variant-numeric:tabular-nums}.kb-flow-grid>span{font-size:10px;color:var(--sub);text-align:center}.kb-flow-grid .kb-flow-unit{text-align:left}.kb-card .kb-flow-number,.kb-flow-number{display:block;min-width:0;padding:5px 2px;font-size:15px;line-height:1.2;text-align:center;font-weight:550;white-space:nowrap}.kb-card .kb-flow-number:nth-child(n+10){font-size:12px;letter-spacing:-.15px}.kb-flow-grid .kb-net{background:var(--soft);border-radius:4px;font-weight:700}.kb-stock-total{display:grid;grid-template-columns:1fr 1fr;padding:5px 12px 14px!important;gap:12px;font-variant-numeric:tabular-nums}.kb-stock-total strong{display:block;font-size:20px;font-weight:600}.kb-stock-total small{display:block;font-size:11px;color:var(--sub);margin-top:3px}
 .kb-bottom{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px}.kb-warning{font-size:11px;color:var(--danger);margin-top:14px}.kb-empty{padding:35px 20px;border:1px solid var(--line);border-radius:8px;background:var(--paper);text-align:center}.kb-empty h2{font-size:18px;margin-bottom:10px}.kb-empty p{color:var(--sub)}
 .kb-task{display:block;padding:12px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--ink)}.kb-task strong{font-size:13px}.kb-task small{display:block;color:var(--sub);margin-top:4px;font-size:11px}.kb-task:hover{color:var(--accent)}.kb-task-direction{font-weight:600;color:var(--accent);margin-right:8px}.kb-dialog{width:min(760px,94vw)}.kb-dialog .dialog-top h2{font-size:16px}.kb-detail-summary{font-size:13px;margin-bottom:12px}.kb-detail-summary .kb-flow-grid{max-width:500px;grid-template-columns:54px repeat(3,minmax(0,1fr));margin-bottom:14px}.kb-detail-summary .kb-flow-number{font-size:20px}.kb-detail-more{width:100%;margin-top:15px}.kb-method{margin:12px 0;font-size:13px;line-height:1.6}.kb-issue{padding:8px 0;border-bottom:1px solid var(--line);font-size:12px}
 @media(max-width:1100px){.kb-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:760px){#kanban-statistics-view{padding:8px}.kb-controls{gap:6px}.kb-controls .segmented{flex-wrap:wrap}.kb-controls .segmented button{padding:5px 6px}.kb-period-heading{gap:6px}.kb-period-heading small{margin-left:0}.kb-cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.kb-card-label{font-size:11px;padding:8px}.kb-flow-grid{grid-template-columns:34px repeat(3,minmax(0,1fr));padding:0 4px 6px}.kb-flow-grid>span{font-size:9px}.kb-card .kb-flow-number{font-size:13px}.kb-card .kb-flow-number:nth-child(n+10){font-size:11px}.kb-stock-total strong{font-size:17px}}
 @media(max-width:380px){.kb-cards{grid-template-columns:1fr}}
 `;
 let options=defaults(),report=null,root=null,detailRows=[],detailLimit=60,detailTitle='';
 function ensureStyle(){if(document.getElementById('kanban-style'))return;const style=document.createElement('style');style.id='kanban-style';style.textContent=css;document.head.append(style);}
 function dialog(){let d=document.getElementById('kanban-detail');if(d)return d;d=document.createElement('dialog');d.id='kanban-detail';d.className='kb-dialog';d.setAttribute('aria-labelledby','kb-detail-title');d.innerHTML='<div class="dialog-top"><h2 id="kb-detail-title"></h2><button class="action" data-k-close>Закрыть</button></div><div class="detail-body"></div>';document.body.append(d);d.addEventListener('click',e=>{if(e.target.closest('[data-k-close]'))d.close();if(e.target.closest('[data-k-more]')){detailLimit+=60;showDetails(detailRows,detailTitle,true);}});d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});return d;}
 function showMovement(rows,title,movement=options.movement){const filtered=options.mode==='stock'||movement==='delta'?rows:rows.filter(r=>r.direction===(movement==='incoming'?'in':'out'));showDetails(filtered,title+' · '+(options.mode==='stock'?'сейчас':movements[movement]+' · '+intervalLabel(options)));}
 function showDetails(rows,title,more=false){
  detailRows=rows;detailTitle=title;if(!more)detailLimit=60;const d=dialog(),total=summarize(rows),flow=rows.some(r=>r.direction),stats=flow?balance(rows):null;
  d.querySelector('h2').textContent=title;
  d.querySelector('.detail-body').innerHTML=`<div class="kb-detail-summary">${flow?flowGrid(stats,false):`${total.tasks} задач · ${value(total,'sp')} SP`}</div>${total.missing?'<p class="kb-warning">* SP рассчитан не у всех задач. Показана известная сумма.</p>':''}${rows.length?rows.slice(0,detailLimit).map(r=>`<a class="kb-task" href="https://pyrus.sovcombank.ru/t#id${encodeURIComponent(r.task.id)}" target="_blank" rel="noopener noreferrer"><strong>${r.direction?`<span class="kb-task-direction">${r.direction==='in'?'+ Пришло':'− Ушло'}</span>`:''}${esc(r.task.title)} ↗</strong><small>#${esc(r.task.id)} · ${esc(r.task.ba||'Аналитик не указан')} · ${r.task.sp===null||r.task.sp<0?'—':fmt(r.task.sp)} SP</small><small>${r.date?dateLabel(r.date)+' · ':''}Сейчас: ${esc(r.task.status||'не указан')} · ${esc(r.task.project)}</small></a>`).join(''):'<p class="kb-note">Нет задач по выбранным условиям.</p>'}${rows.length>detailLimit?`<button class="action kb-detail-more" data-k-more>Ещё ${Math.min(60,rows.length-detailLimit)} из ${rows.length-detailLimit}</button>`:''}`;
  if(!d.open)d.showModal();if(!more)d.querySelector('.detail-body').scrollTop=0;
 }
 function info(){const d=dialog();d.querySelector('h2').textContent='Как считаем Kanban';d.querySelector('.detail-body').innerHTML=`<p class="kb-method">Пришло — вход в статус, ушло — переход из него в следующий статус. Дельта = пришло − ушло, отдельно в задачах и SP. Вход и выход в один день дают 0.</p><p class="kb-method">WIP: вход из-за пределов рабочих статусов и выход за их пределы. Внутренние переходы не меняют общий WIP. «Сейчас» — только текущий tasks.status, а не остаток на конец исторического периода.</p><p class="kb-method">SP — текущая нормализованная оценка tasks.sp_true. Спринты и утилизация не участвуют. Во всех разрезах используются текущие назначения. STOP и Trash полностью исключены.</p><p class="kb-method">Даты включительно, календарь Москвы. Неделя — понедельник–воскресенье. Крайние периоды учитываются только в пределах выбранного диапазона. Год проектов, месяцы утилизации и готовность из других вкладок здесь не применяются.</p>${report.issues.length?`<h3>Замечания · ${report.issues.length}</h3>${report.issues.slice(0,100).map(i=>`<p class="kb-issue">#${esc(i.task.id)} · ${esc(i.reason)}</p>`).join('')}${report.issues.length>100?'<p class="kb-note">Показаны первые 100 замечаний.</p>':''}`:''}`;if(!d.open)d.showModal();d.querySelector('.detail-body').scrollTop=0;}
 function repaint(){report=calculate(root._model,root._filters,options);root.innerHTML=render(report);}
 function mount(container,model,filters){ensureStyle();root=container;root._model=model;root._filters=filters;
  if(!root._kanbanBound){root._kanbanBound=true;root.addEventListener('change',e=>{const key=e.target.dataset.kDate;if(key){if(key==='anchor')options=selectPeriod(options,options.grain,e.target.value);else{options={...options,[key]:e.target.value,grain:'range',page:0};if(validDate(e.target.value))options.anchor=e.target.value;}repaint();root.querySelector(`[data-k-date="${key}"]`)?.focus({preventScroll:true});}});
   root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
    if(d.kInfo){info();return;}
    if(d.kUnknown!==undefined){showDetails(report.stock.filter(s=>s.status==='other'),'Другие текущие статусы');return;}
    if(d.kCard){const card=report.cards.find(c=>c.id===d.kCard);showMovement(card.rows,card.title,d.kCell||options.movement);return;}
    let attr;
    if(d.kGrain){options=selectPeriod(options,d.kGrain);attr='data-k-grain';}
    else if(d.kShift){options=shiftPeriod(options,Number(d.kShift));attr='data-k-shift';}
    else if(d.kToday!==undefined){options=selectPeriod(options,options.grain,today());attr='data-k-today';}
    else if(d.kMode){options.mode=d.kMode;attr='data-k-mode';}
    if(attr){repaint();for(const next of root.querySelectorAll('['+attr+']'))if(next.getAttribute(attr)===b.getAttribute(attr)){next.focus({preventScroll:true});break;}}
   });}
  repaint();return report;
 }
 function reset(){options=defaults();}
 return {statuses,series,wip,grains,groups,currentStatus,validDate,bucket,periods,endOf,periodLabel,defaults,selectPeriod,shiftPeriod,calculate,summarize,balance,render,mount,reset};
})();
