/* Read-only error rules. No fetches, writes or automatic corrections.
 * pct is latest monthly readiness, with STOP completed at its actual scope.
 * STOP is completed work. Trash never participates in diagnostics.
 */
globalThis.StoryMapErrors = (() => {
  const overdue=(item,limit)=>!item.isCompleted&&Number.isInteger(item.maturity_days)&&item.maturity_days>limit;
  const rules = [
    {id:'work-status', title:'Работа без статуса', description:'Утилизация больше 0% и меньше 100%, но статус не WIP и не STOP. STOP считается завершением работы и не является ошибкой.',
      test:s=>s.pct!==null&&s.pct>0&&s.pct<100&&s.lane!=='wip'&&String(s.status).trim().toLowerCase()!=='stop',
      reason:s=>`Утилизация ${s.pct}% · Статус: ${s.status||'не указан'}`},
    {id:'complete-status', title:'100%, но не завершена', description:'Утилизация равна 100%, но статус не Done и не STOP.',
      test:s=>s.pct===100&&s.lane!=='done'&&String(s.status).trim().toLowerCase()!=='stop', reason:s=>`Утилизация 100% · Статус: ${s.status||'не указан'}`},
    {id:'done-incomplete', title:'Done, но не 100%', description:'Статус Done, а текущая утилизация не равна 100% или не указана.',
      test:s=>s.lane==='done'&&s.pct!==100, reason:s=>s.pct===null?'Статус Done · Нет месячного факта':`Статус Done · Утилизация ${s.pct}%`},
    {id:'no-epic', title:'WIP без Эпика', description:'Задача в работе, но ссылка на эпик не заполнена.',
      test:s=>s.lane==='wip'&&s.epic_id==='unassigned', reason:s=>`Статус: ${s.status} · Эпик не указан`},
    {id:'no-project', title:'Эпик без Проекта', description:'К эпику не привязан проект. В карточках этого столбца — эпики, а не задачи.', epic:true,
      test:e=>!e.initiative_key&&e.project==='Без проекта',reason:()=> 'Проект не указан'},
    {id:'no-sp', title:'Без SP', description:'Задача в WIP, но оценка SP не заполнена. В расчётах отсутствие оценки даёт 0 SP. Явно указанная оценка 0 отличается от незаполненной.',
      test:s=>s.lane==='wip'&&(s.spEstimated===false||s.sp===null), reason:s=>`Статус: ${s.status} · ${s.spEstimated===false?'Оценка SP не заполнена · в расчётах 0 SP':'SP не рассчитан'}`},
    {id:'eternal-task',title:'Вечная задача',description:'Незавершённая задача: более 90 календарных дней от начала анализа. Done и STOP не включаются.',
      test:s=>overdue(s,90),reason:s=>`${s.maturity_days} дн. · Статус: ${s.status||'не указан'}`},
    {id:'eternal-epic',title:'Вечный эпик',description:'Незавершённый эпик: более 180 календарных дней от самого раннего начала анализа его задач.',epic:true,
      test:e=>overdue(e,180),reason:e=>`${e.maturity_days} дн. · Более 180 дней`},
    {id:'eternal-project',title:'Вечный проект',description:'Незавершённый проект или инициатива: более 360 календарных дней от самого раннего начала анализа его задач.',project:true,
      test:p=>overdue(p,360),reason:p=>`${p.maturity_days} дн. · Более 360 дней`},
  ];
  const worked=m=>globalThis.StoryMapModel.positive(m)||(/^\d{4}\.(0[1-9]|1[0-2])$/.test(m.month)&&m.start!==null&&m.end!==null&&m.end>m.start);
  function evaluate(model,input={}) {
    const M=globalThis.StoryMapModel, f={...M.defaults(),...input};
    const projectYears=new Map(model.projects.map(p=>[p.id,p.years]));
    const projectReadiness=new Map(model.projects.map(p=>[p.id,p.pct]));
    const range=(v,min,max)=>v===null||v===undefined?min===0&&max===100:v>=min&&v<=max;
    const readiness=(project,epic)=>range(projectReadiness.get(project),f.projectMin,f.projectMax)&&range(epic?.pct,f.epicMin,f.epicMax);
    const byYear=(years)=>!f.projectYear||(f.exclude?.projectYear?!years.has(f.projectYear):years.has(f.projectYear));
    const ownYears=stories=>new Set(stories.flatMap(s=>s.months.filter(worked).map(m=>m.month.slice(0,4))));
    const common=s=>{
      const periodHit=s.months.some(m=>worked(m)&&f.periods.some(p=>M.inPeriod(m.month,p)));
      return M.cutMatches(s,f)&&(!f.search||s.search.includes(f.search.trim().toLocaleLowerCase('ru')))
        &&(!f.periods.length||(f.exclude?.periods?!periodHit:periodHit));
    };
    const eligible=[...model.stories.values()].filter(s=>String(s.status).trim().toLowerCase()!=='trash'&&readiness(s.project_key||s.project,model.epics.get(s.epic_id))&&byYear(!s.initiative_key&&s.project==='Без проекта'?ownYears([s]):projectYears.get(s.project_key||s.project)||new Set())&&common(s));
    const columns=rules.map(rule=>({id:rule.id,title:rule.title,description:rule.description,epic:!!rule.epic,project:!!rule.project,items:[]}));
    for(let i=0;i<rules.length;i++){
      const rule=rules[i];
      if(rule.project){
        for(const p of model.projects){
          if(!p.initiative_key&&p.title==='Без проекта'||!rule.test(p)||!range(p.pct,f.projectMin,f.projectMax)||!byYear(p.years))continue;
          const query=f.search.trim().toLocaleLowerCase('ru'),projectHit=!query||[p.id,p.title].join(' ').toLocaleLowerCase('ru').includes(query);
          if(!p.epics.some(e=>range(e.pct,f.epicMin,f.epicMax)&&e.stories.some(s=>common({...s,search:projectHit?' '+query:s.search}))))continue;
          columns[i].items.push({id:p.id,kind:'project',title:p.title,ba:'',status:'Проект',sp:p.sp,pct:p.pct,reason:rule.reason(p),memberCount:p.epics.length});
        }
        continue;
      }
      if(!rule.epic){columns[i].items=eligible.filter(rule.test).map(s=>({id:s.id,kind:'story',afctData:s.afctData,title:s.title,ba:s.ba,status:s.status,sp:s.sp,pct:s.pct,reason:rule.reason(s),month:s.months.at(-1)?.month||null}));continue;}
      for(const e of model.epics.values()){
        if(e.missing||!rule.test(e)||!readiness(e.project_key||e.project,e)||!byYear(!e.initiative_key&&e.project==='Без проекта'?ownYears(e.stories):projectYears.get(e.project_key||e.project)||new Set()))continue;
        // Facets/periods require at least one matching member. Empty epics can
        // be inspected with all years and no story-level filter selections.
        const noStoryFilter=!f.periods.length&&!['stakeholder','direction','stream','department','ba','afct'].some(k=>f[k].length);
        const query=f.search.trim().toLocaleLowerCase('ru');
        const epicHit=!query||[e.id,e.title,e.code,e.reference].join(' ').toLocaleLowerCase('ru').includes(query);
        const memberHit=e.stories.some(s=>common({...s,search:epicHit?' '+query:s.search}));
        const emptyHit=!e.stories.length&&noStoryFilter&&epicHit&&M.cutMatches({project:e.project,project_key:e.project_key,initiative_type:e.initiative_type,monetized:e.monetized,facets:{}},f);
        if(!memberHit&&!emptyHit)continue;
        columns[i].items.push({id:e.id,kind:'epic',title:e.title,ba:'',status:'Эпик',sp:e.sp,pct:e.pct,reason:rule.reason(e),memberCount:e.stories.length});
      }
    }
    for(const c of columns)c.items.sort((a,b)=>a.title.localeCompare(b.title,'ru')||a.id.localeCompare(b.id));
    return {columns,taskCount:new Set(columns.flatMap(c=>c.items.filter(i=>i.kind==='story').map(i=>i.id))).size,
      epicCount:new Set(columns.flatMap(c=>c.items.filter(i=>i.kind==='epic').map(i=>i.id))).size,
      projectCount:new Set(columns.flatMap(c=>c.items.filter(i=>i.kind==='project').map(i=>i.id))).size,
      issueCount:columns.reduce((n,c)=>n+c.items.length,0)};
  }
  function render(result,{escape,fmt,limit=60}) {
    const columns=result.columns.filter(c=>c.items.length);
    if(!columns.length)return '<div class="empty-state">По выбранным условиям ошибок не найдено.</div>';
    return `<div class="error-board">${columns.map(c=>`<section class="error-column"><header><h2>${escape(c.title)} <span>${c.items.length}</span></h2><p>${escape(c.description)}</p></header><div class="error-list">${c.items.slice(0,limit).map(i=>`<button class="error-card" data-${i.kind}="${escape(i.id)}"><strong>${globalThis.UbaitAFCT.badge(i)}${escape(i.title)}</strong><span class="error-reason">${escape(i.reason)}</span>${i.month?`<small>Последний месяц: ${escape(i.month)}</small>`:''}<span class="error-card-footer"><span>${escape(i.ba|| (i.kind==='epic'?i.memberCount+' историй':i.kind==='project'?i.memberCount+' эпиков':'Аналитик не указан'))}</span><span>${fmt(i.sp)} SP</span></span></button>`).join('')}${c.items.length>limit?`<button class="more" data-error-more="true">Показать ещё (${c.items.length-limit})</button>`:''}</div></section>`).join('')}</div>`;
  }
  return {rules,evaluate,render,worked};
})();
