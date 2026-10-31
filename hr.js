/* HR R8 — server-authorized live data from /api/hr, no demo fallback.
 * Six existing tables: unit, check, skills_employee, skills_boss, kpi, skills.
 * Server-side PocketBase authentication is required for this endpoint.
 * KPI achievement/payments are NOT inferred from plan/fact.
 */
globalThis.UbaitHR=(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
  const fmt=v=>num(v)===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v));
  const day=v=>/^\d{4}-\d\d-\d\d$/.test(v??'')?v.slice(8)+'.'+v.slice(5,7)+'.'+v.slice(0,4):'—';
  const yearNow=()=>new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Moscow'}).format(new Date());
  const scale=['C −','C','C +','B −','B','B +','A −','A','A +'];
  const gradeIndex=v=>{const s=String(v??'').trim().replace(/[АВС]/g,c=>({'А':'A','В':'B','С':'C'}[c])).replace(/[−–]/g,'-').replace(/\s+/g,'');return ['C-','C','C+','B-','B','B+','A-','A','A+'].indexOf(s);};
  const label=v=>gradeIndex(v)<0?'—':scale[gradeIndex(v)];
  // Matrix supplied by the user: non-linear points, AS IS only.
  const points=[.5,.75,1,1.5,1.75,2,2.5,2.75,3];
  const gradePoints=v=>gradeIndex(v)<0?null:points[gradeIndex(v)];
  const careerGrades=['Юнлинг','Падаван','Джедай','Магистр'];
  const norm=v=>String(v??'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
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
  const initials=name=>esc(String(name??'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join(''));
  const title=p=>p.unit.staff||[p.unit.status,p.unit.position].filter(Boolean).join(' · ')||'Карточка #'+p.unit.task_id;
  const timestamp=v=>{const d=new Date(v);return v&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(d):'—';};
  const yearKey=v=>String(v??'').trim()||'__none__';
  const yearLabel=v=>v==='__none__'?'Без года':v;
  const yearMatches=(v,selected)=>!selected||yearKey(v)===selected;
  const byName=(a,b)=>title(a).localeCompare(title(b),'ru')||a.unit.task_id.localeCompare(b.unit.task_id);
  function parsePayload(payload){
    if(payload?.schema_version!==1||payload.dataset!=='hr'||payload.api_revision!==1||payload.source_form_id!==405691||!Array.isArray(payload.cards))throw new Error('HR API вернул другой формат. Нужен флоу «HR — реальные данные 405691».');
    const ids=new Set(),array=v=>Array.isArray(v)?v:[],object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    const cards=payload.cards.map(raw=>{
      if(!raw?.unit||typeof raw.unit.task_id!=='string'||!/^\d+$/.test(raw.unit.task_id)||ids.has(raw.unit.task_id))throw new Error('HR API: некорректный или повторный ID карточки.');
      ids.add(raw.unit.task_id);
      if(!Array.isArray(raw.kpi)||!Array.isArray(raw.skills))throw new Error('HR API: у карточки #'+raw.unit.task_id+' отсутствуют массивы KPI или ИПР.');
      const u={...raw.unit,stream:array(raw.unit.stream),photo:array(raw.unit.photo),offer:array(raw.unit.offer)};
      const missingBlocks=Array.isArray(raw.missing_blocks)?[...raw.missing_blocks]:[];
      for(const key of ['check','skills_employee','skills_boss'])if(!raw[key]&&!missingBlocks.includes(key))missingBlocks.push(key);
      for(const key of ['kpi','skills']){
        const rows=new Set();for(const r of raw[key]){
          if(!r||typeof r.row_id!=='string'||!/^\d+$/.test(r.row_id)||rows.has(r.row_id)||(r.task_id!==undefined&&String(r.task_id)!==u.task_id))throw new Error('HR API: некорректная строка '+key+' в карточке #'+u.task_id+'.');
          rows.add(r.row_id);
        }
      }
      return {...raw,unit:u,check:object(raw.check),skills_employee:object(raw.skills_employee),skills_boss:object(raw.skills_boss),missing_blocks:missingBlocks};
    });
    if(!payload.meta||Number(payload.meta.card_count)!==cards.length)throw new Error('HR API: число карточек в отчёте не совпадает с полученными данными. Проверь последний узел флоу HR.');
    const people=cards.filter(p=>p.unit.status!=='Эталон'),references=cards.filter(p=>p.unit.status==='Эталон');
    const active=['Работает','Испытательный срок','Декрет','Оформление','Вакансия (поиск)','Подбор','Уволен'];
    const rank=p=>{const at=active.indexOf(p.unit.status);return at<0?active.length:at;};
    people.sort((a,b)=>rank(a)-rank(b)||byName(a,b));
    references.sort((a,b)=>String(a.unit.grade??'').localeCompare(String(b.unit.grade??''),'ru')||byName(a,b));
    const duplicates=new Map();for(const p of people)if(p.unit.staff_id)duplicates.set(String(p.unit.staff_id),(duplicates.get(String(p.unit.staff_id))||0)+1);
    people.forEach(p=>p.same_person_cards=duplicates.get(String(p.unit.staff_id))||1);
    return {people,references,cards,year:yearNow(),meta:payload.meta,generated_at:payload.generated_at,access:payload.access};
  }
  function matchEmployee(data,fullName){
    const norm=v=>String(v||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');
    const matches=fullName?data.people.filter(p=>norm(p.unit.staff)===norm(fullName)):[];
    return {status:matches.length===1?'matched':matches.length?'ambiguous':'not_found',card:matches.length===1?matches[0]:null};
  }
  function referenceLabel(r,data){
    if(!r)return 'Эталон не выбран';
    const grade=r.unit.grade||'Без грейда';
    return data.references.filter(x=>x.unit.grade===r.unit.grade).length>1?grade+' · '+(r.unit.position||r.unit.team||'карточка')+' · #'+r.unit.task_id:grade;
  }
  function defaultReference(p,data){
    const matches=data.references.filter(r=>r.unit.grade===p?.unit.grade);
    return matches.length===1?matches[0].unit.task_id:'';
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
  const select=(key,title,values,current,all=false)=>`<details class="hr-pop"><summary>${esc(title)} · ${esc(yearLabel(current)||'Все')} ▾</summary><div role="group" aria-label="${esc(title)}">${(all?['',...values]:values).map(v=>`<button data-hr-filter="${key}" data-value="${esc(v)}" aria-pressed="${v===current}">${esc(yearLabel(v)||'Все')}</button>`).join('')}</div></details>`;
  const pill=(t,kind='')=>`<span class="hr-pill ${kind}">${esc(t)}</span>`;
  const prose=(title,text)=>`<span class="hr-prose-title">${esc(title)}</span><p class="hr-prose">${esc(text||'Не заполнено')}</p>`;
  const detailsRows=rows=>`<dl class="hr-data-list">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v??'—')}</dd>`).join('')}</dl>`;
  const fileList=files=>Array.isArray(files)&&files.length?files.map(f=>`<span class="hr-file">▧ ${esc(f?.name||f?.filename||'Вложение')}</span>`).join('')+'<span class="hr-source">Открыть вложения можно в карточке Pyrus по ссылке в шапке.</span>':'<span class="hr-source">Нет вложений</span>';
  const levelBar=s=>`<div class="hr-levels" aria-hidden="true">${scale.map((_,i)=>`<i class="${i<=gradeIndex(s.current)?'filled ':''}${i===gradeIndex(s.reference)?'reference ':''}${i===gradeIndex(s.target)?'target':''}"></i>`).join('')}</div>`;
  function constellation(groups,stats){
    const n=groups.length,points=groups.map((g,i)=>{const angle=-Math.PI/2+i*2*Math.PI/n;return {x:100+67*Math.cos(angle),y:85+61*Math.sin(angle),g};});
    return `<svg class="hr-orbit" viewBox="0 0 200 170" role="img" aria-label="Оценено ${stats.assessed} из ${stats.total} компетенций"><circle cx="100" cy="85" r="62" fill="none" stroke="var(--line)" stroke-dasharray="2 5"/>${points.map(({x,y,g})=>{const c=countSkills([g]);return `<line x1="100" y1="85" x2="${x}" y2="${y}" stroke="var(--line)"/><circle cx="${x}" cy="${y}" r="19" fill="var(--paper)" stroke="var(--hr-violet)" stroke-width="1.5"/><text x="${x}" y="${y+3}" text-anchor="middle">${c.assessed}/${c.total}</text><text class="hr-orbit-small" x="${x}" y="${y+30}" text-anchor="middle">${esc(g.short)}</text>`;}).join('')}<circle cx="100" cy="85" r="28" fill="var(--hr-soft)"/><text class="hr-orbit-total" x="100" y="86" text-anchor="middle">${stats.assessed}</text><text class="hr-orbit-small" x="100" y="101" text-anchor="middle">оценено</text></svg>`;
  }
  function competenciesBase(person,data,state){
    const ref=data.references.find(r=>r.unit.task_id===state.reference),groups=comparison(person,ref,state.kind),stats=countSkills(groups);
    const record=person['skills_'+state.kind]??{};
    return `<div class="hr-panel-top"><div class="hr-switch" role="group" aria-label="Набор компетенций">${[['employee','Сотрудник'],['boss','Руководитель']].map(([k,t])=>`<button data-hr-kind="${k}" aria-pressed="${state.kind===k}">${t}</button>`).join('')}</div><span class="hr-source">Шкала C − → A + · нажми на навык для деталей</span></div><div class="hr-competency-layout"><div><div class="hr-skill-grid">${groups.map(g=>{const s=countSkills([g]);return `<section class="hr-card hr-skill-group"><header><span class="hr-skill-icon" aria-hidden="true">${g.icon}</span><div><h3>${esc(g.name)}</h3><small>Оценено ${s.assessed} из ${s.total}</small></div></header>${g.items.map(s=>`<button class="hr-skill" data-hr-skill="${s.code}" aria-label="${esc(s.name)}. Сейчас ${label(s.current)}, план ${label(s.target)}, эталон ${label(s.reference)}"><span class="hr-skill-heading"><span>${esc(s.name)}</span><b>${label(s.current)}</b></span>${levelBar(s)}</button>`).join('')}</section>`;}).join('')}</div><div class="hr-skill-legend"><span><i class="hr-key"></i>Текущая оценка</span><span><i class="hr-key target"></i>План сотрудника</span><span><i class="hr-key reference"></i>Эталон грейда</span></div><p class="hr-source">Не заполнено — не равно C −. План и эталон не заменяют текущую оценку.</p></div><aside class="hr-card hr-benchmark"><span class="hr-kicker">Ориентир развития</span><h3>${esc(referenceLabel(ref,data))}</h3><p>Сравни профиль с эталоном грейда. Выбор ориентира не меняет грейд сотрудника.</p><div class="hr-grade-choices" role="group" aria-label="Эталон грейда">${data.references.length?data.references.map(r=>`<button data-hr-reference="${esc(r.unit.task_id)}" aria-pressed="${state.reference===r.unit.task_id}">${esc(referenceLabel(r,data))}</button>`).join(''):'<p>В БД нет карточек со статусом «Эталон».</p>'}</div>${constellation(groups,stats)}<div class="hr-benchmark-numbers"><div><strong>${stats.met}<small>из ${stats.comparable} сопоставимых</small></strong><small>не ниже ориентира</small></div><div><strong>${stats.planned}</strong><small>с плановой оценкой</small></div></div><div class="hr-divider"></div><p>Это сравнение отдельных навыков, не рейтинг людей и не расчёт премии.</p><div class="hr-divider"></div>${detailsRows([['Балл из реестра',fmt(record['score_sum_asis_'+state.kind])],['Коэф. грейда',fmt(record['cost_ratio_'+state.kind])]])}<p class="hr-source" style="margin-top:12px">Эталоны — только карточки со статусом «Эталон».</p></aside></div>`;
  }
  function scoreProfile(person,kind){
    const record=person?.['skills_'+kind]??{},values=allSkills(kind).map(s=>gradePoints(record[s.code+'_current']));
    const assessed=values.filter(v=>v!==null),complete=assessed.length===values.length;
    const subtotal=assessed.reduce((s,v)=>s+v,0),stored=num(record['score_sum_asis_'+kind]);
    return {total:complete?subtotal:null,subtotal,assessed:assessed.length,count:values.length,stored,mismatch:complete&&stored!==null&&Math.abs(stored-subtotal)>.005};
  }
  function development(person,data,kind){
    const current=scoreProfile(person,kind),grade=person.unit.grade||'',at=careerGrades.findIndex(g=>norm(g)===norm(grade));
    const find=g=>{const matches=g?data.references.filter(r=>norm(r.unit.grade)===norm(g)):[];return {card:matches.length===1?matches[0]:null,count:matches.length};};
    const baseline=find(grade),nextGrade=at>=0?careerGrades[at+1]||'':'',next=find(nextGrade);
    const reference=scoreProfile(baseline.card,kind),nextReference=scoreProfile(next.card,kind);
    const rows=comparison(person,baseline.card,kind).flatMap(g=>g.items).map(s=>({...s,actualPoints:gradePoints(s.current),referencePoints:gradePoints(s.reference)}));
    const comparable=rows.filter(s=>s.actualPoints!==null&&s.referencePoints!==null);
    const gaps=comparable.filter(s=>s.actualPoints<s.referencePoints).map(s=>({...s,gap:s.referencePoints-s.actualPoints})).sort((a,b)=>b.gap-a.gap||a.code.localeCompare(b.code));
    const noGaps=comparable.length===rows.length?gaps.length===0:gaps.length?false:null;
    const enough=current.total!==null&&nextReference.total!==null?current.total>=nextReference.total:null;
    const transition=!nextGrade?'none':enough===false||noGaps===false?'blocked':enough===true&&noGaps===true?'met':'unknown';
    return {grade,knownGrade:at>=0,nextGrade,current,baseline,reference,next,nextReference,rows,comparable:comparable.length,gaps,noGaps,enough,transition};
  }
  function developmentSummary(person,data,kind){
    const d=development(person,data,kind),delta=d.current.total!==null&&d.reference.total!==null?d.current.total-d.reference.total:null;
    const baselineIssue=!d.grade?'У сотрудника не указан грейд.':d.baseline.count>1?'Несколько эталонов текущего грейда — однозначное сравнение невозможно.':!d.baseline.card?'Не найден эталон текущего грейда.':d.reference.total===null?'В эталоне заполнены не все оценки AS IS.':'';
    const currentText=d.current.total===null?'Нет полного расчёта':delta===null?'Нет полного эталона':delta<0?'До эталона: '+fmt(-delta)+' балл.':delta===0?'Сумма равна эталону':'Выше эталона на '+fmt(delta)+' балл.';
    const nextText=d.transition==='met'?'Два числовых условия выполнены':d.transition==='blocked'?'Условия перехода пока не выполнены':d.transition==='unknown'?'Недостаточно данных для проверки':d.knownGrade?'В матрице нет следующего грейда':'Следующий грейд не определён';
    const condition=(value,text,detail)=>`<li class="${value===true?'met':value===false?'gap':'unknown'}"><span aria-hidden="true">${value===true?'✓':value===false?'○':'?'}</span><div>${text}<small>${detail}</small></div></li>`;
    return `<section class="hr-card hr-score-panel" aria-label="Баллы AS IS и условия перехода"><div class="hr-score-overview"><div class="hr-score-main"><span class="hr-kicker">Текущий балл · AS IS</span><div class="hr-score-value"><strong>${fmt(d.current.total)}</strong><span>/ ${fmt(d.reference.total)}</span></div><span class="hr-source">Эталон текущего грейда · ${esc(d.grade||'не указан')}</span><b class="hr-score-delta">${esc(currentText)}</b>${d.current.total===null?`<p class="hr-source">Оценено ${d.current.assessed} из ${d.current.count}. По заполненным: ${fmt(d.current.subtotal)} балл. — не полный итог.</p>`:''}${baselineIssue?`<p class="hr-source">${baselineIssue}</p>`:''}</div><div class="hr-score-gaps"><span class="hr-kicker">Гепы к текущему грейду</span><strong>${d.comparable===d.rows.length||d.gaps.length?d.gaps.length:'—'}</strong><span class="hr-source">${d.comparable===d.rows.length?'Проверены все '+d.rows.length+' компетенции':'Сопоставлено '+d.comparable+' из '+d.rows.length+'; пропуски не равны нулю'}</span><p class="hr-source">Высокая сумма не компенсирует гепы для перехода на следующий грейд.</p></div><div class="hr-score-next"><span class="hr-kicker">Следующий грейд${d.nextGrade?' · '+esc(d.nextGrade):''}</span><b>${nextText}</b>${d.nextGrade?`<ul>${condition(d.enough,'AS IS не ниже порога следующего грейда',fmt(d.current.total)+' / '+fmt(d.nextReference.total)+' балл.'+(d.next.count>1?' · несколько эталонов':!d.next.card?' · эталон не найден':''))}${condition(d.noGaps,'Нет гепов к текущему грейду',d.noGaps===true?'Все компетенции не ниже текущего эталона':d.gaps.length?'Открыто гепов: '+d.gaps.length:'Есть несопоставленные оценки')}</ul>`:''}<p class="hr-source">Это проверка числовых условий, не присвоение грейда. Итоговый скоринг и решение — после обсуждения проявленности.</p></div></div><details class="hr-score-details"><summary>Разрывы и расчёт по матрице${d.gaps.length?' · '+d.gaps.length+' гепов':''}</summary><div class="hr-score-details-body">${d.gaps.length?`<p class="hr-source">К текущему грейду, от большего разрыва к меньшему. Нажми на компетенцию для деталей и ИПР.</p><div class="hr-gap-list">${d.gaps.map(s=>`<button data-hr-skill="${s.code}" data-hr-skill-reference="${esc(d.baseline.card.unit.task_id)}"><span>${esc(s.name)}</span><span>${label(s.current)} → ${label(s.reference)}</span><strong>−${fmt(s.gap)} б.</strong></button>`).join('')}</div>`:`<p class="hr-source">${d.noGaps===true?'Гепов к текущему грейду нет. Можно обсуждать цель дальнейшего развития.':'Полнота оценок не позволяет подтвердить отсутствие гепов.'}</p>`}<div class="hr-point-scale" aria-label="Баллы уровней">${scale.map((v,i)=>`<span>${v}<b>${fmt(points[i])}</b></span>`).join('')}</div><p class="hr-source">AS IS — сумма текущих оценок в выбранной матрице. TO BE, отметки «&gt;&gt;&gt;» и оценки в годовом ИПР не участвуют. C = 0,75: это может означать недостаточную проявленность, а не «не умеет». Пустая оценка остаётся неизвестной.</p>${d.current.mismatch||d.reference.mismatch||d.nextReference.mismatch?`<p class="hr-source hr-score-warning">Сумма AS IS по шкале отличается от сохранённого итога в реестре.${d.current.mismatch?' Сотрудник: '+fmt(d.current.total)+' по оценкам / '+fmt(d.current.stored)+' в реестре.':''}${d.reference.mismatch?' Текущий эталон: '+fmt(d.reference.total)+' / '+fmt(d.reference.stored)+'.':''}${d.nextReference.mismatch?' Следующий эталон: '+fmt(d.nextReference.total)+' / '+fmt(d.nextReference.stored)+'.':''} Здесь показан расчёт по оценкам, данные БД не изменены.</p>`:''}<p class="hr-source">Данные не содержат отдельных этапов самооценки и итогового скоринга; текущая оценка не объявляется автоматически подтверждённой. Переход грейда и индексация — разные решения. Рыночная база и региональный коэффициент не заданы: сумму индексации не рассчитываем.</p></div></details></section>`;
  }
  function competencies(person,data,state){
    // Additive: existing cards, scales, comparison selector and infographic stay intact.
    return competenciesBase(person,data,state).replace('<div class="hr-competency-layout">',developmentSummary(person,data,state.kind)+'<div class="hr-competency-layout">');
  }
  // Only exact known competency names/aliases link IPR rows; never fuzzy matches.
  function iprSkillCode(row){
    const aliases={'Знание внутренней методологии и стандартов':'Внутренняя методология и стандарты','Инструменты формализации Требований':'Формализация требований'};
    const name=norm(row.skill),alias=Object.entries(aliases).find(([from])=>norm(from)===name)?.[1];
    const matches=['employee','boss'].flatMap(allSkills).filter(s=>norm(s.name)===norm(alias||name));
    return matches.length===1?matches[0].code:null;
  }
  function skillEvidence(person,skill,year){
    const rows=person.skills.filter(r=>!r.is_empty&&yearMatches(r.skills_year,year)&&iprSkillCode(r)===skill.code);
    return `<section class="hr-evidence"><h4>Проявленность · ИПР ${esc(yearLabel(year)||'все годы')}</h4><p class="hr-source">Ниже — записанные результаты и обратная связь, не автоматическое подтверждение оценки.</p>${rows.length?rows.map(r=>`<details><summary>${esc(yearLabel(yearKey(r.skills_year)))} · AS IS ${label(r.skill_asis)} → TO BE ${label(r.skill_tobe)} · ${r.skill_result_done?'результат описан':'результат не заполнен'}</summary>${prose('Что сделано',r.skill_result_done)}${prose('Обратная связь руководителя',r.skill_feedback)}</details>`).join(''):'<p class="hr-source">Связанный пункт ИПР за этот период не найден по точному названию компетенции. Это не означает отсутствия проявленности.</p>'}<p class="hr-source">Для итогового скоринга нужны рабочие примеры и наблюдаемые результаты. Подробные критерии проявленности этого навыка пока не подключены; сверяй примеры с матрицей компетенций.</p></section>`;
  }
  function kpi(person,state){
    const all=person.kpi.filter(r=>!r.is_empty),years=[...new Set([yearNow(),...all.map(r=>yearKey(r.kpi_year))])].sort().reverse();
    const annual=all.filter(r=>yearMatches(r.kpi_year,state.year)),horizons=[...new Set(annual.map(r=>r.kpi_horizont).filter(Boolean))];
    const rows=annual.filter(r=>(!state.horizon||r.kpi_horizont===state.horizon)&&(!state.goalQuery||[r.kpi_goal,r.kpi_category,r.kpi_type].join(' ').toLocaleLowerCase('ru').includes(state.goalQuery.toLocaleLowerCase('ru'))));
    const summary=goalSummary(rows);
    return `<div class="hr-controls">${select('year','Год',years,state.year,true)}${select('horizon','Горизонт',horizons,state.horizon,true)}<input id="hr-goal-search" class="hr-search" type="search" placeholder="Найти цель…" aria-label="Найти цель KPI" value="${esc(state.goalQuery)}"></div><div class="hr-card hr-kpi-summary"><div class="hr-metric"><strong>${summary.goals}</strong><small>целей в выборке</small></div><div class="hr-metric"><strong>${summary.facts} / ${summary.goals}</strong><small>с заполненным фактом</small></div><div class="hr-metric"><strong>${fmt(summary.weights)}%</strong><small>сумма весов выборки</small></div><p class="hr-source">План и факт — исходные значения. Формула достижения и правила премирования не заданы: премию здесь не рассчитываем.</p></div><div class="hr-goals">${rows.map(r=>`<details class="hr-card hr-goal"><summary><span class="hr-goal-title"><strong>${esc(r.kpi_goal||'Цель не заполнена')}</strong><small>${[r.kpi_horizont,r.kpi_category,r.kpi_type].filter(Boolean).map(esc).join(' · ')}${r.kpi_by_chief?' · от руководителя':''}</small></span><span class="hr-goal-number"><small>Вес</small><b>${fmt(r.kpi_weight)}%</b></span><span class="hr-goal-number"><small>План</small><b>${fmt(r.kpi_plan)}</b></span><span class="hr-goal-number ${num(r.kpi_fact)===null?'empty':''}"><small>Факт</small><b>${fmt(r.kpi_fact)}</b></span><span class="hr-goal-arrow" aria-hidden="true">›</span></summary><div class="hr-goal-body">${prose('Критерии успешности',r.kpi_acceptence_criteria)}${prose('Обратная связь руководителя',r.kpi_feedback)}<div class="hr-skill-legend">${[r.kpi_class,r.kpi_priority].filter(Boolean).map(t=>pill(t)).join('')}</div><span class="hr-prose-title">Вложения</span>${fileList(r.files)}</div></details>`).join('')||'<div class="hr-empty"><h3>Нет целей по выбранным условиям</h3><p>Выбери другой год, горизонт или очисти поиск.</p></div>'}</div>`;
  }
  function ipr(person,state){
    const all=person.skills.filter(r=>!r.is_empty),years=[...new Set([yearNow(),...all.map(r=>yearKey(r.skills_year))])].sort().reverse();
    const rows=all.filter(r=>yearMatches(r.skills_year,state.year)&&(!state.iprQuery||String(r.skill??'').toLocaleLowerCase('ru').includes(state.iprQuery.toLocaleLowerCase('ru'))));
    return `<div class="hr-controls">${select('year','Год развития',years,state.year,true)}<span class="hr-source">${rows.length} компетенций · ${rows.filter(r=>r.skill_result_done).length} с описанным результатом</span><input id="hr-ipr-search" class="hr-search" type="search" placeholder="Найти компетенцию…" aria-label="Найти компетенцию ИПР" value="${esc(state.iprQuery)}"></div><div class="hr-ipr-grid">${rows.map(r=>`<article class="hr-card hr-ipr-card"><div class="hr-ipr-tags"><span class="hr-kicker">${esc(r.skill_block||'Компетенция')}</span>${r.skills_by_chief?pill('От руководителя','accent'):''}</div><h3>${esc(r.skill||'Компетенция не указана')}</h3><div class="hr-grade-route"><div><small>AS IS</small><strong>${label(r.skill_asis)}</strong></div><span aria-hidden="true">→</span><div><small>TO BE</small><strong>${label(r.skill_tobe)}</strong></div>${pill(r.skill_result_done?'Результат описан':'Ожидает результата',r.skill_result_done?'good':'')}</div>${prose('Что сделано',r.skill_result_done)}<details><summary>Обратная связь</summary><p class="hr-prose">${esc(r.skill_feedback||'Пока не заполнена')}</p></details></article>`).join('')||'<div class="hr-empty"><h3>Нет пунктов ИПР</h3><p>Выбери другой год или очисти поиск.</p></div>'}</div><p class="hr-source" style="margin-top:15px">Описанный результат не означает, что навык подтверждён. AS IS / TO BE здесь — значения плана развития, а не автоматическое изменение профиля компетенций.</p>`;
  }
  function employee(person){
    const u=person.unit,c=person.check;
    return `<div class="hr-profile-grid"><section class="hr-card"><h3>Работа и команда</h3>${detailsRows([['Сотрудник',u.staff],['Статус',u.status],['Отдел · team',u.team],['Руководитель',u.chief],['Почта руководителя',u.chief_email],['Должность',u.position],['Грейд',u.grade],['Уровень управления',u.level],['Стримы',u.stream.join(' · ')],['Бизнес-опыт, лет',u.business_stage]])}</section><section class="hr-card"><h3>Контакты и рабочее место</h3>${detailsRows([['Почта',u.staff_email],['Телефон',u.phone],['Город',u.city],['Бизнес-центр',u.center],['Рабочее место',u.place],['День рождения',day(u.birthday)],['Фото',u.photo.length?'См. вложения ниже':'Нет вложения']])}${fileList(u.photo)}</section><section class="hr-card"><h3>Условия</h3>${detailsRows([['Оклад',fmt(u.cost)],['Ожидания',fmt(u.expectations)],['Аура · исходное значение',u.aura],['Экспорт в BI',u.export_bi===null?'Не указано':u.export_bi?'Да':'Нет']])}<span class="hr-prose-title">Оффер</span>${fileList(u.offer)}<p class="hr-source" style="margin-top:12px">Исходные значения из штатки. Валюта, период и состав выплат не выводятся из числа автоматически.</p></section><section class="hr-card"><h3>Даты и характеристика</h3><div class="hr-timeline">${[['Приём',u.date_in],['Перевод',u.date_transfer],['Увольнение',u.date_out]].map(([k,v])=>`<div><small>${k}</small><strong>${day(v)}</strong></div>`).join('')}</div>${prose('Характеристика',u.characteristic)}</section><section class="hr-card wide"><div class="hr-panel-top"><h3>Испытательный срок</h3>${pill('Окончание · '+day(c.check_end_date),u.status==='Испытательный срок'?'accent':'')}</div><p class="hr-prose">${esc(c.check_task||'Задача на испытательный срок не заполнена')}</p><div class="hr-check-grid">${[['Удалось',c.check_result_done],['Не удалось',c.check_result_fail],['Помогало',c.check_result_assist],['Мешало',c.check_result_disturb]].map(([k,v])=>`<div>${prose(k,v)}</div>`).join('')}</div>${prose('Обратная связь',c.check_feedback)}</section></div>`;
  }
  const reloaders=new WeakMap();
  function mount(root){
    if(root.dataset.hrMounted==='true'){void reloaders.get(root)?.();return;}
    root.dataset.hrMounted='true';
    let data=null,loading=false,error='',denied=false,lastContent='';
    const state={tab:'competencies',person:'',query:'',department:'',status:'',kind:'employee',reference:'',year:yearNow(),horizon:'',goalQuery:'',iprQuery:''};
    const person=()=>data?.people.find(p=>p.unit.task_id===state.person);
    const filtered=()=>data.people.filter(p=>(!state.department||p.unit.team===state.department)&&(!state.status||p.unit.status===state.status)&&(!state.query||[title(p),p.unit.position,p.unit.team,p.unit.task_id].join(' ').toLocaleLowerCase('ru').includes(state.query.toLocaleLowerCase('ru'))));
    const spinner=()=>'<div class="hr-empty hr-loading" role="status"><span class="hr-spinner" aria-hidden="true"></span><h3>Загружаем штатные данные</h3><p>Сотрудники, компетенции, KPI и ИПР из БД</p></div>';
    function render(focusId,selection){
      const accessLabel=data?.access?data.access.level+' · '+({self:'Мой профиль',department:'Мой отдел',all:'Все доступные сотрудники'}[data.access.scope]||'HR'):'';
      const nav='<nav class="hr-subnav" role="tablist" aria-label="Разделы HR">'+Object.entries(tabs).map(([k,t])=>'<button id="hr-'+k+'-tab" role="tab" data-hr-tab="'+k+'" aria-selected="'+(state.tab===k)+'" tabindex="'+(state.tab===k?'0':'-1')+'" aria-controls="hr-tab-content">'+t+'</button>').join('')+'<span class="hr-live" title="'+esc(accessLabel?accessLabel+' · Срез '+timestamp(data.generated_at):'Источник: штатный реестр 405691')+'">'+esc(accessLabel||'Штатка · БД')+'</span><button class="hr-refresh" data-hr-refresh="true" '+(loading?'disabled':'')+' aria-label="Обновить HR" title="Обновить данные и права доступа" >↻</button></nav>';
      if(!data){
        root.innerHTML=nav+(loading?spinner():'<div class="hr-empty" role="alert"><h3>'+(denied?'Доступ к HR не настроен':'HR не подключён')+'</h3><p>'+esc(error||'Нет ответа от HR API.')+'</p><button class="action" data-hr-refresh="true">Повторить загрузку</button></div>');
        return;
      }
      const people=filtered(),oldPerson=state.person;
      if(!people.some(p=>p.unit.task_id===state.person))state.person=people[0]?.unit.task_id??'';
      const p=person();if(state.person!==oldPerson)state.reference=defaultReference(p,data);
      const departments=[...new Set(data.people.map(p=>p.unit.team).filter(Boolean))].sort(),statuses=[...new Set(data.people.map(p=>p.unit.status).filter(Boolean))].sort();
      const missing=p?.missing_blocks?.length?'<div class="hr-note">В БД не найдены блоки этой карточки: '+esc(p.missing_blocks.join(', '))+'. Поля этих блоков показаны пустыми. Проверь загрузку штатки.</div>':'';
      const same=p?.same_person_cards>1?'<div class="hr-note">У этого человека '+p.same_person_cards+' карточки в штатке. Сейчас открыта #'+esc(p.unit.task_id)+'; данные разных карточек не объединяются.</div>':'';
      root.innerHTML=nav+
        '<div class="hr-layout"><aside class="hr-directory" aria-label="Выбор сотрудника"><div class="hr-directory-top"><div class="hr-directory-label"><span>Карточки</span><span>'+people.length+' / '+data.people.length+'</span></div><input id="hr-person-search" type="search" class="hr-search" placeholder="ФИО или ID…" aria-label="Найти сотрудника" value="'+esc(state.query)+'">'+select('department','Отдел',departments,state.department,true)+select('status','Статус',statuses,state.status,true)+'</div><div class="hr-directory-list">'+(people.map(p=>'<button class="hr-person" data-hr-person="'+esc(p.unit.task_id)+'" aria-pressed="'+(state.person===p.unit.task_id)+'"><span class="hr-avatar" aria-hidden="true">'+initials(p.unit.staff||p.unit.status)+'</span><span><strong>'+esc(title(p))+'</strong><small>'+esc([p.unit.team,p.unit.grade].filter(Boolean).join(' · ')||'Без отдела / грейда')+'</small><small>'+esc(p.unit.status||'Без статуса')+' · #'+esc(p.unit.task_id)+'</small></span></button>').join('')||'<p class="hr-source">Нет совпадений</p>')+'</div><footer class="hr-directory-footer">'+data.references.length+' эталонов · отдел из unit.team<br>Изменено в Pyrus: '+esc(timestamp(data.meta.last_source_update))+'</footer></aside><div class="hr-detail">'+
        (p?'<header class="hr-identity"><span class="hr-avatar" aria-hidden="true">'+initials(p.unit.staff||p.unit.status)+'</span><div><h2>'+esc(title(p))+'</h2><p>'+esc([p.unit.position,p.unit.team].filter(Boolean).join(' · '))+' · <a href="https://pyrus.sovcombank.ru/t#id'+p.unit.task_id+'" target="_blank" rel="noopener noreferrer">#'+p.unit.task_id+' ↗</a></p></div><div class="hr-identity-tags">'+pill(p.unit.grade||'Грейд не указан','accent')+pill(p.unit.status||'Без статуса')+'</div></header>':'')+
        '<section id="hr-tab-content" class="hr-content" role="tabpanel" aria-labelledby="hr-'+state.tab+'-tab">'+
        (!p?'<div class="hr-empty"><h3>Сотрудник не выбран</h3><p>Измени поиск или фильтры отдела и статуса. В списке только доступные тебе карточки.</p></div>':missing+same+(state.tab==='competencies'?competencies(p,data,state):state.tab==='kpi'?kpi(p,state):state.tab==='ipr'?ipr(p,state):employee(p)))+
        '</section></div></div><dialog id="hr-skill-dialog" class="hr-dialog" aria-labelledby="hr-skill-title"><div class="dialog-top"><span class="hr-source">Профиль навыка</span><button class="action" data-hr-close="true">Закрыть</button></div><div class="detail-body" id="hr-skill-body"></div></dialog>';
      if(focusId){const el=root.querySelector('#'+focusId);el?.focus({preventScroll:true});if(selection&&el?.setSelectionRange)el.setSelectionRange(...selection);}
    }
    async function load({silent=false}={}){
      if(loading)return;loading=true;error='';denied=false;
      const background=silent&&Boolean(data);let changed=true;if(!background)render();
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
      try{
        const response=await fetch('/api/hr',{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
        if(globalThis.UbaitAuth)await UbaitAuth.checked(response);
        let payload;try{payload=await response.json();}catch{throw new Error('Сервер HR вернул не JSON. Проверь публикацию флоу HR.');}
        if(!response.ok){denied=response.status===403;throw new Error(payload.error||'HR API: HTTP '+response.status+'.');}
        if(payload.access?.policy_version!==1)throw new Error('На сервере ещё не включены права HR. Загрузи обновление R8 целиком.');
        const loaded=parsePayload(payload),content=JSON.stringify([payload.access,payload.cards]);
        changed=content!==lastContent;lastContent=content;data=loaded;
        if(!data.people.some(p=>p.unit.task_id===state.person)){
          state.person=data.access.employee_task_id;state.reference=defaultReference(person(),data);
        }
        if(state.reference&&!data.references.some(r=>r.unit.task_id===state.reference))state.reference='';
      }catch(e){data=null;lastContent='';state.person='';state.reference='';error=e.name==='AbortError'?'HR не ответил за 70 секунд. Проверь выполнение флоу HR в n8n.':e.message;}
      finally{clearTimeout(timer);loading=false;if(!background||changed||error)render();}
    }
    function skillDialog(code,referenceId=state.reference){
      const p=person(),ref=data.references.find(r=>r.unit.task_id===referenceId),skill=comparison(p,ref,state.kind).flatMap(g=>g.items).find(s=>s.code===code);if(!skill)return;
      root.querySelector('#hr-skill-body').innerHTML='<span class="hr-kicker">'+(state.kind==='boss'?'Руководитель':'Сотрудник')+' · '+esc(referenceLabel(ref,data))+'</span><h3 id="hr-skill-title">'+esc(skill.name)+'</h3>'+detailsRows([['Текущая оценка',label(skill.current)],['План сотрудника',label(skill.target)],['Эталон '+referenceLabel(ref,data),label(skill.reference)],['Балл AS IS',fmt(gradePoints(skill.current))],['Балл эталона',fmt(gradePoints(skill.reference))]])+'<div class="hr-dialog-levels" aria-hidden="true">'+scale.map((g,i)=>'<span class="'+(i===gradeIndex(skill.current)?'chosen ':'')+(i===gradeIndex(skill.reference)?'reference':'')+'">'+g+'</span>').join('')+'</div><p class="hr-source">Фиолетовый — текущая оценка, золотая линия — выбранный эталон. План взят отдельно; грейд и выплаты автоматически не меняются.</p><div class="hr-divider"></div><button class="action" data-hr-open-ipr="'+esc(skill.name)+'">Найти в годовом ИПР →</button>';
      root.querySelector('#hr-skill-body').innerHTML+=skillEvidence(p,skill,state.year);
      root.querySelector('#hr-skill-dialog').showModal();
    }
    root.addEventListener('click',e=>{
      const button=e.target.closest('button'),d=button?.dataset;if(!d)return;
      if(d.hrRefresh){void load();return;}
      if(!data)return;
      if(d.hrClose){root.querySelector('#hr-skill-dialog').close();return;}
      if(d.hrSkill){skillDialog(d.hrSkill,d.hrSkillReference);return;}
      if(d.hrOpenIpr){state.tab='ipr';state.iprQuery=d.hrOpenIpr;render('hr-ipr-tab');return;}
      if(d.hrTab&&Object.hasOwn(tabs,d.hrTab)){state.tab=d.hrTab;render('hr-'+d.hrTab+'-tab');return;}
      if(d.hrPerson&&data.people.some(p=>p.unit.task_id===d.hrPerson)){state.person=d.hrPerson;state.reference=defaultReference(person(),data);state.goalQuery='';state.iprQuery='';state.horizon='';render();return;}
      if(d.hrKind&&definitions[d.hrKind])state.kind=d.hrKind;
      else if(d.hrReference&&data.references.some(r=>r.unit.task_id===d.hrReference))state.reference=d.hrReference;
      else if(d.hrFilter&&['year','horizon','department','status'].includes(d.hrFilter)){state[d.hrFilter]=d.value??'';if(d.hrFilter==='year')state.horizon='';}
      else return;render();
    });
    root.addEventListener('input',e=>{if(!data)return;const keys={'hr-person-search':'query','hr-goal-search':'goalQuery','hr-ipr-search':'iprQuery'},key=keys[e.target.id];if(!key)return;state[key]=e.target.value;render(e.target.id,[e.target.selectionStart,e.target.selectionEnd]);});
    root.addEventListener('keydown',e=>{if(!data)return;const tab=e.target.closest('[data-hr-tab]');if(!tab)return;const keys=Object.keys(tabs),index=keys.indexOf(state.tab);let next;if(e.key==='ArrowRight')next=keys[(index+1)%keys.length];if(e.key==='ArrowLeft')next=keys[(index+keys.length-1)%keys.length];if(e.key==='Home')next=keys[0];if(e.key==='End')next=keys.at(-1);if(next){e.preventDefault();state.tab=next;render('hr-'+next+'-tab');}});
    reloaders.set(root,load);
    // Recheck permissions when opening HR, returning to the page and every minute
    // while visible. Failed checks clear the previously displayed personnel data.
    if(globalThis.document&&typeof setInterval==='function'){
      const refreshVisible=()=>{if(!document.hidden&&!root.hidden)void load({silent:true});};
      document.addEventListener('visibilitychange',refreshVisible);
      globalThis.addEventListener?.('pageshow',e=>{if(e.persisted)refreshVisible();});
      setInterval(refreshVisible,60000);
    }
    void load();
  }
  return {mount,parsePayload,matchEmployee,comparison,countSkills,goalSummary,gradeIndex,gradePoints,scoreProfile,development,developmentSummary,iprSkillCode,skillEvidence,scale,definitions,competencies,kpi,ipr,employee,defaultReference,referenceLabel};
})();
