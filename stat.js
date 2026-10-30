/* Atomic task/month statistics. Never sums epic/project totals.
 * Current task BA and department; STOP/Trash are excluded by the model.
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
    const scope=[...model.stories.values()].filter(s=>M.cutMatches(s,f)&&(!f.search||s.search.includes(f.search.trim().toLocaleLowerCase('ru'))));
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
    return `<h2 class="detail-title" id="detail-title">Как считаем</h2>${warnings(report,focusPeriod).map(m=>`<p class="warning">${escape(m)}</p>`).join('')}<div class="stat-info"><p><strong>1 аналитик = 1 ШЕ.</strong> В знаменателе все аналитики выбранного разреза, в том числе с 0 SP. Состав пока определяется по задачам; сотрудник без единой задачи в него не попадает.</p><p>SP / ШЕ = сумма освоенных SP / число уникальных аналитиков. В общем итоге каждый человек учитывается один раз.</p><p>Месяц, квартал и год — месячный факт. Квартальные планы не используются. STOP и Trash исключены. Задачи без эпика или проекта учитываются.</p><p>Отдел — unit.team из штатки. Связь: полное ФИО tasks.ba → unit.staff. Регистр, лишние пробелы и ё/е нормализуются. Если совпадение неоднозначно, отдел не подставляется. Для одного человека выбирается последняя актуальная карточка; это текущий отдел, не история переводов. Старый источник additional больше не используется.</p><p>Если у задачи несколько заказчиков или стримов, их сочетание показывается одной группой: SP между ними не делятся произвольно.</p><p>Знак * означает неполную сумму. Прочерк — показатель нельзя достоверно рассчитать; это не ноль.</p></div>`;
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
