/* Shared AS IS matrix. Used unchanged by HR, compensation preview and server. */
(function(root){
'use strict';
  const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
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
  const allSkills=kind=>definitions[kind].flatMap(g=>g.items);
  function scoreProfile(person,kind){
    const record=person?.['skills_'+kind]??{},values=allSkills(kind).map(s=>gradePoints(record[s.code+'_current']));
    const assessed=values.filter(v=>v!==null),complete=assessed.length===values.length;
    const subtotal=assessed.reduce((s,v)=>s+v,0),stored=num(record['score_sum_asis_'+kind]);
    return {total:complete?subtotal:null,subtotal,assessed:assessed.length,count:values.length,stored,mismatch:complete&&stored!==null&&Math.abs(stored-subtotal)>.005};
  }
  function calculatedGrade(person,data,kind='employee'){
    const current=scoreProfile(person,kind);
    const bands=careerGrades.map(grade=>{
      const matches=(data?.references??[]).filter(r=>r.unit.status==='Эталон'&&norm(r.unit.grade)===norm(grade));
      const card=matches.length===1?matches[0]:null;
      return {grade,card,count:matches.length,score:scoreProfile(card,kind)};
    });
    const result={current,bands,grade:'',label:'Не определён',baseline:null,next:null,status:'incomplete',reason:'Оценено '+current.assessed+' из '+current.count};
    if(current.total===null)return result;
    const unavailable=bands.find(b=>b.count!==1||b.score.total===null);
    if(unavailable)return {...result,status:'references',reason:unavailable.count>1?'Несколько эталонов: '+unavailable.grade:!unavailable.count?'Нет эталона: '+unavailable.grade:'Не заполнен эталон: '+unavailable.grade};
    // Recalculate from AS IS, not the stored unit.grade or planned ratings.
    // Gaps are shown against the calculated grade; they do not lower the grade by points.
    const at=bands.reduce((best,b,i)=>current.total>=b.score.total?i:best,-1);
    if(at<0)return {...result,status:'below',label:'Ниже Юнлинга',reason:'Порог Юнлинга не достигнут',next:bands[0]};
    return {...result,status:'calculated',grade:bands[at].grade,label:bands[at].grade,reason:'',baseline:bands[at],next:bands[at+1]??null};
  }
function managementLevel(value){
  if(!['string','number'].includes(typeof value))return null;
  const key=String(value).trim().toUpperCase().replace(/[−–]/g,'-');
  if(['0','-0','L-0'].includes(key))return 0;
  if(['-1','L-1'].includes(key))return -1;
  if(['-2','L-2'].includes(key))return -2;
  return null;
}

const api={scale,gradeIndex,gradePoints,careerGrades,norm,definitions,scoreProfile,calculatedGrade,managementLevel};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.UbaitHRModel=api;
})(globalThis);
