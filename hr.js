/* HR R5 — interface-only release. All data below are FICTIONAL.
 * No fetch, no personnel webhook, no real salary/contact/assessment values.
 * Shape follows reestr.unit/check/skills_employee/skills_boss/kpi/skills.
 * KPI achievement/payments are deliberately NOT inferred from plan/fact.
 */
globalThis.UbaitHR=(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
  const fmt=v=>num(v)===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v));
  const day=v=>/^\d{4}-\d\d-\d\d$/.test(v??'')?v.slice(8)+'.'+v.slice(5,7)+'.'+v.slice(0,4):'—';
  const yearNow=()=>new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Moscow'}).format(new Date());
  const scale=['C −','C','C +','B −','B','B +','A −','A','A +'];
  const gradeIndex=v=>{const s=String(v??'').trim().replaceAll('−','-').replace(/\s+/g,'');return ['C-','C','C+','B-','B','B+','A-','A','A+'].indexOf(s);};
  const label=v=>gradeIndex(v)<0?'—':scale[gradeIndex(v)];
  const definitions={employee:[
    {name:'Аналитическое мышление',icon:'◇',short:'Мышление',items:[['01.01','Решение проблем и принятие решений'],['01.02','Системное мышление'],['01.03','Визуальное мышление'],['01.04','Творческое мышление'],['01.06','Концептуальное мышление']]},
    {name:'Предметная область',icon:'◎',short:'Знания',items:[['02.01','Знание отрасли'],['02.02','Внутренняя методология и стандарты'],['02.03','Знание организации'],['02.04','Знание решения']]},
    {name:'Инструменты и технологии',icon:'⌘',short:'Инструменты',items:[['03.01','Инструментарий работы'],['03.02','Формализация требований'],['03.03','Инструменты методологий']]},
    {name:'Поведенческие компетенции',icon:'✧',short:'Поведение',items:[['04.01','Этика'],['04.02','Личная ответственность'],['04.03','Обучение'],['04.04','Надёжность'],['04.05','Организованность и тайм-менеджмент'],['04.06','Адаптируемость']]},
    {name:'Управленческие компетенции',icon:'⌁',short:'Лидерство',items:[['05.01','Фасилитация'],['05.02','Лидерство и влияние'],['05.03','Организация командной работы'],['05.04','Переговоры и разрешение конфликтов'],['05.05','Менторство']]}
  ],boss:[
    {name:'Административное управление',icon:'◇',short:'Управление',items:[['01.01','Управление ресурсами'],['01.02','Управление изменениями'],['01.03','Онбординг и адаптация'],['01.04','Эмоциональный интеллект']]},
    {name:'Функциональное управление',icon:'✧',short:'Лидерство',items:[['02.01','Адвокат клиента'],['02.02','Капитан команды'],['02.03','Архитектор решений'],['02.04','Стратег и тактик'],['02.05','Чемпион по обучению'],['02.06','Проводник к успеху']]}
  ]};
  for(const [kind,groups]of Object.entries(definitions))for(const group of groups)group.items=group.items.map(([suffix,name])=>({code:(kind==='employee'?'03.01.01.':'03.01.02.')+suffix,name}));
  const tabs={competencies:'Компетенции',kpi:'KPI',ipr:'ИПР',employee:'Сотрудник'};
  const allSkills=kind=>definitions[kind].flatMap(g=>g.items);
  const initials=name=>String(name).split(' ').slice(0,2).map(x=>x[0]).join('');
  function makeDemo(){
    const year=yearNow(),grades=['Юнлинг','Падаван','Джедай','Магистр'];
    const people=[['Лесная Мария','ОБАБО','Джедай','Работает'],['Северный Алексей','ОАДНО','Падаван','Работает'],['Мирная Анна','ОБАОФР','Джедай','Работает'],['Луговой Максим','ОРЦКС','Падаван','Испытательный срок'],['Речная Елена','ОБАБО','Магистр','Работает'],['Ясный Никита','ОАДНО','Юнлинг','Работает']].map(([staff,team,grade,status],i)=>{
      const unit={task_id:'demo-'+(i+1),staff_id:'demo-person-'+(i+1),staff,team,grade,status,is_reference:false,
        position:i===4?'Руководитель отдела':'Бизнес-аналитик',level:i===4?'-1':'-2',chief:'Речная Елена',
        stream:[['Демо · ДБО','Демо · Данные'],['Демо · Кредитование'],['Демо · Казначейство'],['Демо · Отчётность']][i%4],
        cost:150000+i*10000,expectations:i%2?null:190000,aura:100+i,business_stage:2+i,
        date_in:i===3?year+'-09-01':(Number(year)-2)+'-03-14',date_transfer:i===2?year+'-04-01':null,date_out:null,
        city:'Демонстрационный город',center:i%2?'Офис Б':'Офис А',place:'Рабочее место '+(10+i),
        staff_email:'demo'+(i+1)+'@example.invalid',phone:null,birthday:'1991-06-12',export_bi:true,
        characteristic:'Вымышленная карточка для проверки интерфейса. Ни одно значение не взято из штатки.',offer:[],photo:[]};
      const employee={},boss={};
      for(const [kind,record]of [['employee',employee],['boss',boss]])allSkills(kind).forEach((s,j)=>{
        const at=Math.max(0,Math.min(8,(i===4?6:i===5?2:4)+((j+i)%4)-1));
        record[s.code+'_current']=i===5&&j>6?null:scale[at];record[s.code+'_target']=j%3===0?scale[Math.min(8,at+1)]:null;
      });
      employee.score_sum_asis_employee=75+i;employee.cost_ratio_employee=1.2;boss.score_sum_asis_boss=i===4?84:null;boss.cost_ratio_boss=i===4?1.5:null;
      const check={check_end_date:i===3?year+'-12-01':(Number(year)-2)+'-06-14',check_task:'Самостоятельно провести анализ сценария и согласовать требования с заказчиком.',check_result_done:i===3?null:'Подготовлена модель процесса. Требования прошли командное ревью.',check_result_fail:null,check_result_assist:'Поддержка наставника и регулярные встречи с заказчиком.',check_result_disturb:i===3?'Часть доступов ещё оформляется.':null,check_feedback:i===3?'Промежуточная встреча: разобрать вопросы по методологии.':'Результаты обсуждены с руководителем.'};
      const goals=[['Качество требований','Доля требований, прошедших ревью без существенных замечаний.',95,91,35,'Качество'],['Предсказуемость поставки','Выполнение согласованного плана задач в установленный срок.',90,92,25,'Результат'],['Снижение возвратов','Количество возвратов на доработку. Здесь меньше — лучше.',3,2,20,'Качество'],['Развитие практики анализа','Провести внутренние встречи с разбором практик и примеров.',4,null,20,'Развитие']];
      const kpi=goals.map(([goal,criteria,plan,fact,weight,category],j)=>({task_id:unit.task_id,row_id:j,kpi_year:year,kpi_horizont:'4Q',kpi_goal:goal,kpi_acceptence_criteria:criteria,kpi_plan:plan,kpi_fact:fact,kpi_weight:weight,kpi_category:category,kpi_class:'Повторяемая',kpi_type:'KPI',kpi_priority:'Стандартное выполнение',kpi_by_chief:j<2,kpi_feedback:j===1?'Факт необходимо подтвердить перед итоговым согласованием.':null,files:[],is_empty:false}));
      kpi.push({...kpi[0],row_id:9,kpi_year:String(Number(year)-1),kpi_fact:94,kpi_horizont:'Год'});
      const selected=[allSkills('employee')[0],allSkills('employee')[3],allSkills('employee')[12],allSkills('employee')[18]];
      const skills=selected.map((s,j)=>({task_id:unit.task_id,row_id:j,skills_year:year,skill:s.name,skill_block:definitions.employee.find(g=>g.items.includes(s)).name,skill_asis:employee[s.code+'_current'],skill_tobe:employee[s.code+'_target']??'A −',skills_by_chief:j<2,skill_result_done:j===0?'Разобраны два кейса: сформулированы альтернативы, критерии выбора и последствия решения.':j===2?'Проведена встреча по обмену практиками с коллегами.':null,skill_feedback:j===0?'На следующем кейсе отдельно зафиксировать риски и допущения.':null,is_empty:false}));
      return {unit,check,skills_employee:employee,skills_boss:boss,kpi,skills};
    });
    const references=grades.map((grade,i)=>{
      const r={unit:{task_id:'demo-reference-'+i,status:'Эталон',grade,is_reference:true},skills_employee:{},skills_boss:{}};
      for(const kind of ['employee','boss'])allSkills(kind).forEach((s,j)=>r['skills_'+kind][s.code+'_current']=scale[Math.min(8,1+i*2+(j%3===0?1:0))]);
      return r;
    });
    return {demo:true,year,people,references};
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
  const select=(key,title,values,current,all=false)=>`<details class="hr-pop"><summary>${esc(title)} · ${esc(current||'Все')} ▾</summary><div role="group" aria-label="${esc(title)}">${(all?['',...values]:values).map(v=>`<button data-hr-filter="${key}" data-value="${esc(v)}" aria-pressed="${v===current}">${esc(v||'Все')}</button>`).join('')}</div></details>`;
  const pill=(t,kind='')=>`<span class="hr-pill ${kind}">${esc(t)}</span>`;
  const prose=(title,text)=>`<span class="hr-prose-title">${esc(title)}</span><p class="hr-prose">${esc(text||'Не заполнено')}</p>`;
  const detailsRows=rows=>`<dl class="hr-data-list">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v??'—')}</dd>`).join('')}</dl>`;
  const fileList=files=>files?.length?files.map(f=>`<span class="hr-file">▧ ${esc(f.name)}</span>`).join(''):'<span class="hr-source">Нет вложений</span>';
  const levelBar=s=>`<div class="hr-levels" aria-hidden="true">${scale.map((_,i)=>`<i class="${i<=gradeIndex(s.current)?'filled ':''}${i===gradeIndex(s.reference)?'reference ':''}${i===gradeIndex(s.target)?'target':''}"></i>`).join('')}</div>`;
  function constellation(groups,stats){
    const n=groups.length,points=groups.map((g,i)=>{const angle=-Math.PI/2+i*2*Math.PI/n;return {x:100+67*Math.cos(angle),y:85+61*Math.sin(angle),g};});
    return `<svg class="hr-orbit" viewBox="0 0 200 170" role="img" aria-label="Оценено ${stats.assessed} из ${stats.total} компетенций"><circle cx="100" cy="85" r="62" fill="none" stroke="var(--line)" stroke-dasharray="2 5"/>${points.map(({x,y,g})=>{const c=countSkills([g]);return `<line x1="100" y1="85" x2="${x}" y2="${y}" stroke="var(--line)"/><circle cx="${x}" cy="${y}" r="19" fill="var(--paper)" stroke="var(--hr-violet)" stroke-width="1.5"/><text x="${x}" y="${y+3}" text-anchor="middle">${c.assessed}/${c.total}</text><text class="hr-orbit-small" x="${x}" y="${y+30}" text-anchor="middle">${esc(g.short)}</text>`;}).join('')}<circle cx="100" cy="85" r="28" fill="var(--hr-soft)"/><text class="hr-orbit-total" x="100" y="86" text-anchor="middle">${stats.assessed}</text><text class="hr-orbit-small" x="100" y="101" text-anchor="middle">оценено</text></svg>`;
  }
  function competencies(person,data,state){
    const ref=data.references.find(r=>r.unit.grade===state.reference),groups=comparison(person,ref,state.kind),stats=countSkills(groups);
    const record=person['skills_'+state.kind];
    return `<div class="hr-panel-top"><div class="hr-switch" role="group" aria-label="Набор компетенций">${[['employee','Сотрудник'],['boss','Руководитель']].map(([k,t])=>`<button data-hr-kind="${k}" aria-pressed="${state.kind===k}">${t}</button>`).join('')}</div><span class="hr-source">Шкала C − → A + · нажми на навык для деталей</span></div><div class="hr-competency-layout"><div><div class="hr-skill-grid">${groups.map(g=>{const s=countSkills([g]);return `<section class="hr-card hr-skill-group"><header><span class="hr-skill-icon" aria-hidden="true">${g.icon}</span><div><h3>${esc(g.name)}</h3><small>Оценено ${s.assessed} из ${s.total}</small></div></header>${g.items.map(s=>`<button class="hr-skill" data-hr-skill="${s.code}" aria-label="${esc(s.name)}. Сейчас ${label(s.current)}, план ${label(s.target)}, эталон ${label(s.reference)}"><span class="hr-skill-heading"><span>${esc(s.name)}</span><b>${label(s.current)}</b></span>${levelBar(s)}</button>`).join('')}</section>`;}).join('')}</div><div class="hr-skill-legend"><span><i class="hr-key"></i>Текущая оценка</span><span><i class="hr-key target"></i>План сотрудника</span><span><i class="hr-key reference"></i>Эталон грейда</span></div><p class="hr-source">Не заполнено — не равно C −. План и эталон не заменяют текущую оценку.</p></div><aside class="hr-card hr-benchmark"><span class="hr-kicker">Ориентир развития</span><h3>${esc(state.reference)}</h3><p>Сравни профиль с эталоном грейда. Выбор ориентира не меняет грейд сотрудника.</p><div class="hr-grade-choices" role="group" aria-label="Эталон грейда">${data.references.map(r=>`<button data-hr-reference="${esc(r.unit.grade)}" aria-pressed="${state.reference===r.unit.grade}">${esc(r.unit.grade)}</button>`).join('')}</div>${constellation(groups,stats)}<div class="hr-benchmark-numbers"><div><strong>${stats.met}<small>из ${stats.comparable} сопоставимых</small></strong><small>не ниже ориентира</small></div><div><strong>${stats.planned}</strong><small>с плановой оценкой</small></div></div><div class="hr-divider"></div><p>Это сравнение отдельных навыков, не рейтинг людей и не расчёт премии.</p><div class="hr-divider"></div>${detailsRows([['Балл из реестра',fmt(record['score_sum_asis_'+state.kind])],['Коэф. грейда',fmt(record['cost_ratio_'+state.kind])]])}<p class="hr-source" style="margin-top:12px">Эталоны — только карточки со статусом «Эталон».</p></aside></div>`;
  }
  function kpi(person,state){
    const all=person.kpi.filter(r=>!r.is_empty),years=[...new Set(all.map(r=>r.kpi_year).filter(Boolean))].sort().reverse();
    const annual=all.filter(r=>r.kpi_year===state.year),horizons=[...new Set(annual.map(r=>r.kpi_horizont).filter(Boolean))];
    const rows=annual.filter(r=>(!state.horizon||r.kpi_horizont===state.horizon)&&(!state.goalQuery||[r.kpi_goal,r.kpi_category,r.kpi_type].join(' ').toLocaleLowerCase('ru').includes(state.goalQuery.toLocaleLowerCase('ru'))));
    const summary=goalSummary(rows);
    return `<div class="hr-controls">${select('year','Год',years,state.year)}${select('horizon','Горизонт',horizons,state.horizon,true)}<input id="hr-goal-search" class="hr-search" type="search" placeholder="Найти цель…" aria-label="Найти цель KPI" value="${esc(state.goalQuery)}"></div><div class="hr-card hr-kpi-summary"><div class="hr-metric"><strong>${summary.goals}</strong><small>целей в выборке</small></div><div class="hr-metric"><strong>${summary.facts} / ${summary.goals}</strong><small>с заполненным фактом</small></div><div class="hr-metric"><strong>${fmt(summary.weights)}%</strong><small>сумма весов выборки</small></div><p class="hr-source">План и факт — исходные значения. Формула достижения и правила премирования не заданы: премию здесь не рассчитываем.</p></div><div class="hr-goals">${rows.map(r=>`<details class="hr-card hr-goal"><summary><span class="hr-goal-title"><strong>${esc(r.kpi_goal||'Цель не заполнена')}</strong><small>${[r.kpi_horizont,r.kpi_category,r.kpi_type].filter(Boolean).map(esc).join(' · ')}${r.kpi_by_chief?' · от руководителя':''}</small></span><span class="hr-goal-number"><small>Вес</small><b>${fmt(r.kpi_weight)}%</b></span><span class="hr-goal-number"><small>План</small><b>${fmt(r.kpi_plan)}</b></span><span class="hr-goal-number ${num(r.kpi_fact)===null?'empty':''}"><small>Факт</small><b>${fmt(r.kpi_fact)}</b></span><span class="hr-goal-arrow" aria-hidden="true">›</span></summary><div class="hr-goal-body">${prose('Критерии успешности',r.kpi_acceptence_criteria)}${prose('Обратная связь руководителя',r.kpi_feedback)}<div class="hr-skill-legend">${[r.kpi_class,r.kpi_priority].filter(Boolean).map(t=>pill(t)).join('')}</div><span class="hr-prose-title">Вложения</span>${fileList(r.files)}</div></details>`).join('')||'<div class="hr-empty"><h3>Нет целей по выбранным условиям</h3><p>Выбери другой год, горизонт или очисти поиск.</p></div>'}</div>`;
  }
  function ipr(person,state){
    const all=person.skills.filter(r=>!r.is_empty),years=[...new Set(all.map(r=>r.skills_year).filter(Boolean))].sort().reverse();
    const rows=all.filter(r=>r.skills_year===state.year&&(!state.iprQuery||r.skill.toLocaleLowerCase('ru').includes(state.iprQuery.toLocaleLowerCase('ru'))));
    return `<div class="hr-controls">${select('year','Год развития',years,state.year)}<span class="hr-source">${rows.length} компетенций · ${rows.filter(r=>r.skill_result_done).length} с описанным результатом</span><input id="hr-ipr-search" class="hr-search" type="search" placeholder="Найти компетенцию…" aria-label="Найти компетенцию ИПР" value="${esc(state.iprQuery)}"></div><div class="hr-ipr-grid">${rows.map(r=>`<article class="hr-card hr-ipr-card"><div class="hr-ipr-tags"><span class="hr-kicker">${esc(r.skill_block||'Компетенция')}</span>${r.skills_by_chief?pill('От руководителя','accent'):''}</div><h3>${esc(r.skill)}</h3><div class="hr-grade-route"><div><small>AS IS</small><strong>${label(r.skill_asis)}</strong></div><span aria-hidden="true">→</span><div><small>TO BE</small><strong>${label(r.skill_tobe)}</strong></div>${pill(r.skill_result_done?'Результат описан':'Ожидает результата',r.skill_result_done?'good':'')}</div>${prose('Что сделано',r.skill_result_done)}<details><summary>Обратная связь</summary><p class="hr-prose">${esc(r.skill_feedback||'Пока не заполнена')}</p></details></article>`).join('')||'<div class="hr-empty"><h3>Нет пунктов ИПР</h3><p>Выбери другой год или очисти поиск.</p></div>'}</div><p class="hr-source" style="margin-top:15px">Описанный результат не означает, что навык подтверждён. AS IS / TO BE здесь — значения плана развития, а не автоматическое изменение профиля компетенций.</p>`;
  }
  function employee(person){
    const u=person.unit,c=person.check;
    return `<div class="hr-profile-grid"><section class="hr-card"><h3>Работа и команда</h3>${detailsRows([['Сотрудник',u.staff],['Статус',u.status],['Отдел · team',u.team],['Руководитель',u.chief],['Должность',u.position],['Грейд',u.grade],['Уровень управления',u.level],['Стримы',u.stream.join(' · ')],['Бизнес-опыт, лет',u.business_stage]])}</section><section class="hr-card"><h3>Контакты и рабочее место</h3>${detailsRows([['Почта',u.staff_email],['Телефон',u.phone],['Город',u.city],['Бизнес-центр',u.center],['Рабочее место',u.place],['День рождения',day(u.birthday)],['Фото',u.photo.length?'Есть вложение':'Нет вложения']])}</section><section class="hr-card"><h3>Условия</h3>${detailsRows([['Оклад',fmt(u.cost)],['Ожидания',fmt(u.expectations)],['Аура · исходное значение',u.aura],['Экспорт в BI',u.export_bi===null?'Не указано':u.export_bi?'Да':'Нет']])}<span class="hr-prose-title">Оффер</span>${fileList(u.offer)}<p class="hr-source" style="margin-top:12px">Все суммы вымышлены. Валюта, период и состав выплат не выводятся из числа автоматически.</p></section><section class="hr-card"><h3>Даты и характеристика</h3><div class="hr-timeline">${[['Приём',u.date_in],['Перевод',u.date_transfer],['Увольнение',u.date_out]].map(([k,v])=>`<div><small>${k}</small><strong>${day(v)}</strong></div>`).join('')}</div>${prose('Характеристика',u.characteristic)}</section><section class="hr-card wide"><div class="hr-panel-top"><h3>Испытательный срок</h3>${pill('Окончание · '+day(c.check_end_date),u.status==='Испытательный срок'?'accent':'')}</div><p class="hr-prose">${esc(c.check_task||'Задача на испытательный срок не заполнена')}</p><div class="hr-check-grid">${[['Удалось',c.check_result_done],['Не удалось',c.check_result_fail],['Помогало',c.check_result_assist],['Мешало',c.check_result_disturb]].map(([k,v])=>`<div>${prose(k,v)}</div>`).join('')}</div>${prose('Обратная связь',c.check_feedback)}</section></div>`;
  }
  function mount(root){
    if(root.dataset.hrMounted==='true')return;
    root.dataset.hrMounted='true';
    const data=makeDemo(),state={tab:'competencies',person:data.people[0].unit.task_id,query:'',department:'',kind:'employee',reference:'Джедай',year:data.year,horizon:'',goalQuery:'',iprQuery:''};
    const person=()=>data.people.find(p=>p.unit.task_id===state.person);
    const filtered=()=>data.people.filter(p=>(!state.department||p.unit.team===state.department)&&(!state.query||[p.unit.staff,p.unit.position,p.unit.team].join(' ').toLocaleLowerCase('ru').includes(state.query.toLocaleLowerCase('ru'))));
    function render(focusId,selection){
      const people=filtered();if(!people.some(p=>p.unit.task_id===state.person))state.person=people[0]?.unit.task_id??'';
      const p=person(),departments=[...new Set(data.people.map(p=>p.unit.team))].sort();
      root.innerHTML=`<nav class="hr-subnav" role="tablist" aria-label="Разделы HR">${Object.entries(tabs).map(([k,t])=>`<button id="hr-${k}-tab" role="tab" data-hr-tab="${k}" aria-selected="${state.tab===k}" tabindex="${state.tab===k?'0':'-1'}" aria-controls="hr-tab-content">${t}</button>`).join('')}<span class="hr-demo" title="Вымышленные люди и значения. Реальная штатка не запрашивается."><i></i>Демонстрационные данные</span></nav><div class="hr-layout"><aside class="hr-directory" aria-label="Выбор сотрудника"><div class="hr-directory-top"><div class="hr-directory-label"><span>Команда</span><span>${people.length}</span></div><input id="hr-person-search" type="search" class="hr-search" placeholder="Найти сотрудника…" aria-label="Найти сотрудника" value="${esc(state.query)}">${select('department','Отдел',departments,state.department,true)}</div><div class="hr-directory-list">${people.map(p=>`<button class="hr-person" data-hr-person="${p.unit.task_id}" aria-pressed="${state.person===p.unit.task_id}"><span class="hr-avatar" aria-hidden="true">${initials(p.unit.staff)}</span><span><strong>${esc(p.unit.staff)}</strong><small>${esc(p.unit.team)} · ${esc(p.unit.grade)}</small></span></button>`).join('')||'<p class="hr-source">Нет совпадений</p>'}</div><footer class="hr-directory-footer">Макет HR · данные вымышлены.<br>Рабочая штатка пока не подключена.</footer></aside><div class="hr-detail">${p?`<header class="hr-identity"><span class="hr-avatar" aria-hidden="true">${initials(p.unit.staff)}</span><div><h2>${esc(p.unit.staff)}</h2><p>${esc(p.unit.position)} · ${esc(p.unit.team)}</p></div><div class="hr-identity-tags">${pill(p.unit.grade,'accent')}${pill(p.unit.status)}</div></header>`:''}<section id="hr-tab-content" class="hr-content" role="tabpanel" aria-labelledby="hr-${state.tab}-tab">${!p?'<div class="hr-empty"><h3>Сотрудник не выбран</h3><p>Измени поиск или фильтр отдела.</p></div>':state.tab==='competencies'?competencies(p,data,state):state.tab==='kpi'?kpi(p,state):state.tab==='ipr'?ipr(p,state):employee(p)}</section></div><dialog id="hr-skill-dialog" class="hr-dialog" aria-labelledby="hr-skill-title"><div class="dialog-top"><span class="hr-source">Профиль навыка</span><button class="action" data-hr-close="true">Закрыть</button></div><div class="detail-body" id="hr-skill-body"></div></dialog>`;
      if(focusId){const el=root.querySelector('#'+focusId);el?.focus({preventScroll:true});if(selection&&el?.setSelectionRange)el.setSelectionRange(...selection);}
    }
    function skillDialog(code){
      const p=person(),ref=data.references.find(r=>r.unit.grade===state.reference),skill=comparison(p,ref,state.kind).flatMap(g=>g.items).find(s=>s.code===code);if(!skill)return;
      root.querySelector('#hr-skill-body').innerHTML=`<span class="hr-kicker">${state.kind==='boss'?'Руководитель':'Сотрудник'} · ${esc(state.reference)}</span><h3 id="hr-skill-title">${esc(skill.name)}</h3>${detailsRows([['Текущая оценка',label(skill.current)],['План сотрудника',label(skill.target)],['Эталон '+state.reference,label(skill.reference)]])}<div class="hr-dialog-levels" aria-hidden="true">${scale.map((g,i)=>`<span class="${i===gradeIndex(skill.current)?'chosen ':''}${i===gradeIndex(skill.reference)?'reference':''}">${g}</span>`).join('')}</div><p class="hr-source">Фиолетовый — текущая оценка, золотая линия — выбранный эталон. План взят отдельно; грейд и выплаты автоматически не меняются.</p><div class="hr-divider"></div><button class="action" data-hr-open-ipr="${esc(skill.name)}">Найти в годовом ИПР →</button>`;
      root.querySelector('#hr-skill-dialog').showModal();
    }
    root.addEventListener('click',e=>{
      const button=e.target.closest('button'),d=button?.dataset;if(!d)return;
      if(d.hrClose){root.querySelector('#hr-skill-dialog').close();return;}
      if(d.hrSkill){skillDialog(d.hrSkill);return;}
      if(d.hrOpenIpr){state.tab='ipr';state.iprQuery=d.hrOpenIpr;render('hr-ipr-tab');return;}
      if(d.hrTab&&Object.hasOwn(tabs,d.hrTab)){state.tab=d.hrTab;render('hr-'+d.hrTab+'-tab');return;}
      if(d.hrPerson){state.person=d.hrPerson;state.goalQuery='';state.iprQuery='';state.horizon='';render();return;}
      if(d.hrKind&&definitions[d.hrKind])state.kind=d.hrKind;
      else if(d.hrReference&&data.references.some(r=>r.unit.grade===d.hrReference))state.reference=d.hrReference;
      else if(d.hrFilter&&['year','horizon','department'].includes(d.hrFilter)){state[d.hrFilter]=d.value??'';if(d.hrFilter==='year')state.horizon='';}
      else return;
      render();
    });
    root.addEventListener('input',e=>{const keys={'hr-person-search':'query','hr-goal-search':'goalQuery','hr-ipr-search':'iprQuery'},key=keys[e.target.id];if(!key)return;state[key]=e.target.value;render(e.target.id,[e.target.selectionStart,e.target.selectionEnd]);});
    root.addEventListener('keydown',e=>{const tab=e.target.closest('[data-hr-tab]');if(!tab)return;const keys=Object.keys(tabs),index=keys.indexOf(state.tab);let next;if(e.key==='ArrowRight')next=keys[(index+1)%keys.length];if(e.key==='ArrowLeft')next=keys[(index+keys.length-1)%keys.length];if(e.key==='Home')next=keys[0];if(e.key==='End')next=keys.at(-1);if(next){e.preventDefault();state.tab=next;render('hr-'+next+'-tab');}});
    render();
  }
  return {mount,makeDemo,comparison,countSkills,goalSummary,gradeIndex,scale,definitions,competencies,kpi,ipr,employee};
})();
