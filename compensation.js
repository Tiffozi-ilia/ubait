/* One pure compensation model for browser preview, server cards and Excel. */
(function(root){
'use strict';
const M=typeof module!=='undefined'&&module.exports?require('./hr-model.js'):root.UbaitHRModel;
const formulaVersion='grade-step-score-v2';
const defaultModel=()=>({management_base_multiplier:null,growth:{employee:[1,1,1],boss:[1,1,1]}});
const number=v=>typeof v==='number'?Number.isFinite(v)?v:null:typeof v==='string'&&v.trim()!==''&&/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(v.trim())?Number.isFinite(Number(v.trim().replace(',','.')))?Number(v.trim().replace(',','.')):null:null;
function validateModel(value){
 if(!value||Object.keys(value).sort().join(',')!=='growth,management_base_multiplier'||!value.growth||Object.keys(value.growth).sort().join(',')!=='boss,employee')throw new Error('Нужны коэффициент базы руководителей и шесть коэффициентов роста.');
 const m=value.management_base_multiplier;
 if(typeof m!=='number'||!Number.isFinite(m)||m<=0)throw new Error('Коэффициент базы руководителей должен быть больше нуля.');
 for(const kind of ['employee','boss'])if(!Array.isArray(value.growth[kind])||value.growth[kind].length!==3||value.growth[kind].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))throw new Error('Коэффициенты роста должны быть числами не меньше нуля.');
 return {management_base_multiplier:m,growth:{employee:[...value.growth.employee],boss:[...value.growth.boss]}};
}
function references(cards){
 const refs=cards.filter(c=>c.unit.status==='Эталон');
 const young=refs.filter(c=>M.norm(c.unit.grade)===M.norm('Юнлинг'));
 const base=young.length===1?number(young[0].unit.cost):null;
 const out={base:base>0?base:null,base_task_id:young.length===1?young[0].unit.task_id:null,base_reason:young.length!==1?'Нужен единственный эталон Юнлинга':!(base>0)?'В эталоне Юнлинга не задан положительный оклад':'',tracks:{}};
 for(const kind of ['employee','boss']){
  const bands=M.careerGrades.map(grade=>{const match=refs.filter(c=>M.norm(c.unit.grade)===M.norm(grade));return {grade,count:match.length,task_id:match.length===1?match[0].unit.task_id:null,score:match.length===1?M.scoreProfile(match[0],kind).total:null};});
  const bad=bands.find(b=>b.count!==1||b.score===null),ascending=bands.every((b,i)=>b.score>0&&(!i||b.score>bands[i-1].score));
  out.tracks[kind]={bands,thresholds:bands.map(b=>b.score),valid:!bad&&ascending,reason:bad?(bad.count!==1?'Нужен единственный эталон: ':'Не заполнены оценки эталона: ')+bad.grade:!ascending?'Баллы эталонов должны строго возрастать':''};
 }
 return out;
}
// Decimal rational arithmetic avoids different kopeck rounding in UI and Excel.
const frac=n=>{const str=String(n).toLowerCase(),[mant,exp='0']=str.split('e'),negative=mant.startsWith('-'),digits=mant.replace(/^[+-]/,'').split('.'),shift=Number(exp)-(digits[1]?.length||0);let a=BigInt(digits.join(''))*(negative?-1n:1n),b=1n;if(shift<0)b=10n**BigInt(-shift);else a*=10n**BigInt(shift);return [a,b];};
const add=(x,y)=>[x[0]*y[1]+y[0]*x[1],x[1]*y[1]],mul=(x,y)=>[x[0]*y[0],x[1]*y[1]],div=(x,y)=>[x[0]*y[1],x[1]*y[0]];
const cents=x=>{const sign=x[0]<0n?-1n:1n,a=(x[0]<0n?-x[0]:x[0])*100n,q=(a*2n+x[1])/(2n*x[1])*sign;if(q>BigInt(Number.MAX_SAFE_INTEGER)||q<BigInt(-Number.MAX_SAFE_INTEGER))throw new Error('Сумма вне допустимого диапазона');return Number(q);};
const roundMoney=n=>cents(frac(n))/100;
function appliedCoefficients(score,thresholds,k){
 return k.filter((_,i)=>score>=thresholds[i+1]);
}
function stepCost(score,thresholds,baseFraction,k){
 if(!Number.isFinite(score)||score<0||thresholds.length!==4||!thresholds.every((t,i)=>Number.isFinite(t)&&t>0&&(!i||t>thresholds[i-1]))||k.length!==3||!k.every(v=>Number.isFinite(v)&&v>=0))throw new Error('Некорректные параметры расчёта');
 // A transition applies in full exactly at its reference threshold. Prior factors remain.
 let value=mul(baseFraction,div(frac(Math.max(score,thresholds[0])),frac(thresholds[0])));
 for(const coefficient of appliedCoefficients(score,thresholds,k))value=mul(value,frac(coefficient));
 return cents(value)/100;
}
function cost(score,thresholds,base,k){
 if(!Number.isFinite(base)||base<=0)throw new Error('Некорректная база');
 return stepCost(score,thresholds,frac(base),k);
}
function fairCost(score,kind,source,model){
 const baseFraction=kind==='boss'?mul(frac(source.base),frac(model.management_base_multiplier)):frac(source.base);
 return stepCost(score,source.tracks[kind].thresholds,baseFraction,model.growth[kind]);
}
const reasons={not_configured:'Модель не настроена',incomplete_scores:'Недостаточно оценок',invalid_reference:'Проверьте эталоны',unknown_track:'Не указан уровень управления',not_applicable:'Расчёт только для статуса «Работает»',invalid_amount:'Сумма вне допустимого диапазона',missing_salary:'Не указан оклад',invalid_salary:'Некорректный оклад',duplicate_employee:'Несколько действующих карточек сотрудника',unavailable:'Модель временно недоступна'};
function calculate(card,source,saved){
 const level=M.managementLevel(card.unit.level),track=level===-2?'employee':level===0||level===-1?'boss':null;
 const profile=track?M.scoreProfile(card,track):null;
 const result={status:'not_configured',track,score:profile?.total??null,assessed:profile?.assessed??0,count:profile?.count??0,fair_cost:null,indexation:null,indexation_status:'not_configured',grade:'',model_revision:saved?.revision??0,source_updated_at:card.unit.last_modified_date??null};
 const fail=(status,reason)=>({...result,status,indexation_status:status,reason:reason||reasons[status]});
 if(card.unit.status!=='Работает')return fail('not_applicable');
 if(!track)return fail('unknown_track');
 if(!saved?.model)return fail('not_configured');
 let model;try{model=validateModel(saved.model);}catch{return fail('not_configured');}
 if(profile.total===null)return fail('incomplete_scores');
 if(source.base===null||!source.tracks[track].valid)return fail('invalid_reference',source.base_reason||source.tracks[track].reason);
 const t=source.tracks[track].thresholds;result.grade=profile.total<t[0]?'Ниже порога Юнлинга':M.careerGrades[t.reduce((best,n,i)=>profile.total>=n?i:best,0)];
 const applied=appliedCoefficients(profile.total,t,model.growth[track]);
 result.applied_coefficients=applied;result.transition_multiplier=applied.reduce((a,b)=>a*b,1);
 let fair;try{fair=fairCost(profile.total,track,source,model);}catch{return fail('invalid_amount');}
 const salary=number(card.unit.cost);let indexation=null,indexation_status='ready',cost_after=null;
 if(salary===null)indexation_status=card.unit.cost===null||card.unit.cost===undefined||String(card.unit.cost).trim()===''?'missing_salary':'invalid_salary';
 else if(salary<0)indexation_status='invalid_salary';
 else try{indexation=Math.max(0,cents(add(frac(fair),mul(frac(salary),[-1n,1n]))))/100;cost_after=cents(add(frac(salary),frac(indexation)))/100;}catch{indexation_status='invalid_amount';}
 return {...result,status:'ready',fair_cost:fair,indexation,indexation_status,cost_after,reason:reasons[indexation_status]||''};
}
function analyze(cards,source,saved){
 const working=cards.filter(c=>c.unit.status==='Работает'),duplicate=new Set();
 for(const getter of [c=>c.unit.staff_id?String(c.unit.staff_id):'',c=>M.norm(c.unit.staff)]){const counts=new Map();for(const c of working){const key=getter(c);if(key)counts.set(key,(counts.get(key)||0)+1);}for(const c of working)if(counts.get(getter(c))>1)duplicate.add(c.unit.task_id);}
 const rows=working.map(card=>{const value=calculate(card,source,saved);return {card,value:duplicate.has(card.unit.task_id)?{...value,indexation:null,indexation_status:'duplicate_employee',reason:reasons.duplicate_employee}:value};});
 const ready=rows.filter(r=>r.value.indexation_status==='ready'),excluded=rows.filter(r=>r.value.indexation_status!=='ready');
 const totalCents=ready.reduce((sum,r)=>sum+BigInt(Math.round(r.value.indexation*100)),0n);
 return {rows,ready,excluded,summary:{employees:working.length,calculated:ready.length,positive:ready.filter(r=>r.value.indexation>0).length,indexation:totalCents<=BigInt(Number.MAX_SAFE_INTEGER)?Number(totalCents)/100:null,excluded:excluded.length}};
}
const api={formulaVersion,defaultModel,number,validateModel,references,roundMoney,appliedCoefficients,cost,fairCost,calculate,analyze,reasons};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.UbaitCompensation=api;
})(globalThis);
