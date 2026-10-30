/* Read-only error rules. No fetches, writes or automatic corrections.
 * pct is the latest monthly sprint_m_end, NOT a sum of SP or quarter plans.
 * A task may appear in several columns. STOP/Trash are deliberately included.
 */
globalThis.StoryMapErrors = (() => {
  const rules = [
    {id:'work-status', title:'Работа без статуса', description:'Текущий процент утилизации > 0% и < 100%, но статус не WIP. Включая STOP и Trash.',
      test:s=>s.pct!==null&&s.pct>0&&s.pct<100&&s.lane!=='wip',
      reason:s=>`Утилизация ${s.pct}% · Статус: ${s.status||'не указан'}`},
    {id:'complete-status', title:'100%, но не Done', description:'Текущий процент утилизации = 100%, а статус не Done.',
      test:s=>s.pct===100&&s.lane!=='done', reason:s=>`Утилизация 100% · Статус: ${s.status||'не указан'}`},
    {id:'done-incomplete', title:'Done, но не 100%', description:'Статус Done, а текущая утилизация не равна 100% или не указана.',
      test:s=>s.lane==='done'&&s.pct!==100, reason:s=>s.pct===null?'Статус Done · Нет месячного факта':`Статус Done · Утилизация ${s.pct}%`},
    {id:'no-epic', title:'WIP без Эпика', description:'Задача в работе, но ссылка на эпик не заполнена.',
      test:s=>s.lane==='wip'&&s.epic_id==='unassigned', reason:s=>`Статус: ${s.status} · Эпик не указан`},
    {id:'no-project', title:'Эпик без Проекта', description:'К эпику не привязан проект. В карточках этого столбца — эпики, а не задачи.', epic:true},
    {id:'no-sp', title:'Без SP', description:'Задача в WIP, но оценка SP не заполнена. Нулевая оценка не считается отсутствующей.',
      test:s=>s.lane==='wip'&&s.sp===null, reason:s=>`Статус: ${s.status} · SP не рассчитан`},
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
    const eligible=[...model.stories.values()].filter(s=>readiness(s.project,model.epics.get(s.epic_id))&&byYear(s.project==='Без проекта'?ownYears([s]):projectYears.get(s.project)||new Set())&&common(s));
    const columns=rules.map(rule=>({id:rule.id,title:rule.title,description:rule.description,epic:!!rule.epic,items:[]}));
    for(let i=0;i<rules.length;i++){
      const rule=rules[i];
      if(!rule.epic){columns[i].items=eligible.filter(rule.test).map(s=>({id:s.id,kind:'story',title:s.title,ba:s.ba,status:s.status,sp:s.sp,pct:s.pct,reason:rule.reason(s),month:s.months.at(-1)?.month||null}));continue;}
      for(const e of model.epics.values()){
        if(e.missing||e.project!=='Без проекта'||!readiness(e.project,e)||!byYear(ownYears(e.stories)))continue;
        // Facets/periods require at least one matching member. Empty epics can
        // be inspected with all years and no story-level filter selections.
        const noStoryFilter=!f.periods.length&&!['stakeholder','direction','stream','department','ba'].some(k=>f[k].length);
        const query=f.search.trim().toLocaleLowerCase('ru');
        const epicHit=!query||[e.id,e.title,e.code,e.reference].join(' ').toLocaleLowerCase('ru').includes(query);
        const memberHit=e.stories.some(s=>common({...s,search:epicHit?' '+query:s.search}));
        const emptyHit=!e.stories.length&&noStoryFilter&&epicHit&&M.cutMatches({project:e.project,facets:{}},f);
        if(!memberHit&&!emptyHit)continue;
        columns[i].items.push({id:e.id,kind:'epic',title:e.title,ba:'',status:'Эпик',sp:e.sp,pct:e.pct,reason:'Проект не указан',memberCount:e.stories.length});
      }
    }
    for(const c of columns)c.items.sort((a,b)=>a.title.localeCompare(b.title,'ru')||a.id.localeCompare(b.id));
    return {columns,taskCount:new Set(columns.flatMap(c=>c.items.filter(i=>i.kind==='story').map(i=>i.id))).size,
      epicCount:columns.find(c=>c.epic).items.length,issueCount:columns.reduce((n,c)=>n+c.items.length,0)};
  }
  function render(result,{escape,fmt,limit=60}) {
    const columns=result.columns.filter(c=>c.items.length);
    if(!columns.length)return '<div class="empty-state">По выбранным условиям ошибок не найдено.</div>';
    return `<div class="error-board">${columns.map(c=>`<section class="error-column"><header><h2>${escape(c.title)} <span>${c.items.length}</span></h2><p>${escape(c.description)}</p></header><div class="error-list">${c.items.slice(0,limit).map(i=>`<button class="error-card" data-${i.kind}="${escape(i.id)}"><strong>${escape(i.title)}</strong><span class="error-reason">${escape(i.reason)}</span>${i.month?`<small>Последний месяц: ${escape(i.month)}</small>`:''}<span class="error-card-footer"><span>${escape(i.ba|| (i.kind==='epic'?i.memberCount+' историй':'Аналитик не указан'))}</span><span>${fmt(i.sp)} SP</span></span></button>`).join('')}${c.items.length>limit?`<button class="more" data-error-more="true">Показать ещё (${c.items.length-limit})</button>`:''}</div></section>`).join('')}</div>`;
  }
  return {rules,evaluate,render,worked};
})();
