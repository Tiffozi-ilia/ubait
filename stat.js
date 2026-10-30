/* Atomic task/month statistics. Never sums epic/project totals.
 * Current task BA and department; STOP/Trash are excluded by the model.
 * One distinct analyst = one FTE inside each scope. Group rates are recomputed
 * from totals/distinct people, never sums/averages of employee rates.
 */
globalThis.StoryMapStatistics = (() => {
  const groups={department:'Отдел',stream:'Стрим',stakeholder:'Заказчик',management:'Управление'};
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
    return {periods,rows:ordered,total,grain,groupBy,fteBasis:'scope',scopeTasks:scope.length};
  }
  function value(row,cell,metric='sp',fteBasis='scope') {
    const fte=row.people.size;
    const unknown=row.unknownPerson;
    const sp=cell.known?cell.sum:cell.missing?null:0;
    return {value:metric==='rate'?(sp!==null&&fte&&!unknown?sp/fte:null):sp,fte,partial:cell.missing>0,unknown};
  }
  function render(report,{escape,fmt,metric='sp',collapsed=new Set()}) {
    const cell=(row,c)=>{const v=value(row,c,metric,report.fteBasis),label=v.value===null?'—':fmt(v.value)+(v.partial?' *':'');
      const reason=`${fmt(c.sum)} SP · ${v.fte} ШЕ${v.unknown?' · Не у всех задач указан аналитик':''}${c.missing?' · '+c.missing+' строк без рассчитанного SP':''}`;
      return `<td class="number ${v.partial?'partial':''}" title="${escape(reason)}">${label}</td>`;};
    const header=report.grain==='month'?'Месяцы':report.grain==='quarter'?'Кварталы':'Годы';
    const years=[...new Set(report.periods.map(p=>p.slice(0,4)))];
    const label=p=>p.includes('.Q')?['I','II','III','IV'][Number(p.at(-1))-1]+' кв.':p.includes('.')?p.slice(5):p;
    const body=report.rows.map(r=>`<tr class="stats-group-row"><th><button data-department="${escape(r.id)}" aria-expanded="${!collapsed.has(r.id)}">${collapsed.has(r.id)?'▸':'▾'} ${escape(r.title)} <small>${r.people.size} ШЕ</small></button></th><th>Итого</th>${report.periods.map(p=>cell(r,r.cells.get(p))).join('')}${cell(r,r.total)}</tr>${collapsed.has(r.id)?'':[...r.employees.values()].sort((a,b)=>a.title.localeCompare(b.title,'ru')).map(e=>`<tr><th class="stats-department"></th><th class="stats-person">${escape(e.title)}</th>${report.periods.map(p=>cell(e,e.cells.get(p))).join('')}${cell(e,e.total)}</tr>`).join('')}`).join('');
    const total=value(report.total,report.total.total,metric,report.fteBasis);
    const basis='ШЕ — все аналитики выбранного разреза, включая тех, у кого 0 SP в периоде.';
    return `<div class="stats-summary"><div><small>Освоено SP</small><strong>${fmt(value(report.total,report.total.total,'sp').value)}${report.total.total.missing?' *':''}</strong></div><div><small>SP / 1 ШЕ за выбранный период</small><strong>${fmt(value(report.total,report.total.total,'rate',report.fteBasis).value)}</strong></div><div><small>Аналитиков · ШЕ</small><strong>${total.fte}</strong></div><div><small>Задач с месячными строками</small><strong>${report.total.total.tasks.size}</strong></div></div><p class="stats-note">${basis} 1 аналитик = 1 ШЕ. Состав определяется по задачам, не по штатному расписанию. Для итогов человек считается один раз. STOP и Trash исключены.</p>${report.total.total.missing?`<p class="stats-warning">* ${report.total.total.missing} месячных строк без рассчитанного SP: суммы неполные. Не использовать для премирования без проверки.</p>`:''}${report.total.unknownPerson?'<p class="stats-warning">Есть задачи без аналитика: SP показаны, производительность соответствующего разреза не рассчитывается.</p>':''}${report.total.total.negative?'<p class="stats-warning">Есть отрицательная утилизация. Она включена в суммы без исправлений.</p>':''}<div class="stats-table-wrap"><table class="stats-table"><caption>${metric==='rate'?'Производительность, SP на 1 ШЕ':'Освоенные SP'} · ${groups[report.groupBy]} · ${header}</caption><thead><tr><th rowspan="2">${groups[report.groupBy]}</th><th rowspan="2">Аналитик</th>${years.map(y=>`<th colspan="${report.periods.filter(p=>p.startsWith(y)).length}">${y}</th>`).join('')}<th rowspan="2">Итого</th></tr><tr>${report.periods.map(p=>`<th>${label(p)}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${report.periods.length+3}">Нет задач по выбранным условиям.</td></tr>`}</tbody><tfoot><tr><th>Итого по выборке</th><th></th>${report.periods.map(p=>cell(report.total,report.total.cells.get(p))).join('')}${cell(report.total,report.total.total)}</tr></tfoot></table></div><p class="stats-note">Квартал и год — сумма месячного факта. SP/ШЕ пересчитывается для каждого периода, а не складывается из коэффициентов. Задачи без эпика или проекта включены. При нескольких заказчиках или стримах у задачи группа сохраняется целиком, без выдуманного распределения SP.</p>`;
  }
  return {calculate,render,value,groups};
})();
