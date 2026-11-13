import C from './compensation.js';
import M from './hr-model.js';
import {createCompensationStore} from './compensation-store.mjs';
import {indexationXlsx} from './indexation-xlsx.mjs';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
export async function readCompensationBody(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw fault(415,'Нужен JSON-запрос.');
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw fault(413,'Слишком большой запрос.');chunks.push(chunk);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault(400,'Некорректный запрос.');}
 if(!body||Array.isArray(body)||typeof body!=='object')throw fault(400,'Некорректный запрос.');return body;
}
function publicModel(saved,scoped){
 const author=saved.updated_by,visible=author&&scoped.cards.some(c=>c.unit.status!=='Эталон'&&M.norm(c.unit.staff)===M.norm(author.full_name));
 return {...saved,updated_by:author?{label:visible?author.full_name:'Руководитель управления'}:null};
}
export function createCompensationApi({getScoped,store=createCompensationStore(),now=Date.now}){
 const pending=new Set();
 function context(scoped,saved){
  const source=C.references(scoped.cards);
  // Only the already authorized working cards enter any preview or aggregate.
  const cards=scoped.cards.filter(c=>c.unit.status==='Работает').map(c=>({unit:Object.fromEntries(['task_id','staff_id','staff','team','position','status','level','cost','last_modified_date'].map(k=>[k,c.unit[k]])),skills_employee:c.skills_employee,skills_boss:c.skills_boss}));
  return {saved:publicModel(saved,scoped),source,cards,hr_generated_at:scoped.generated_at,summary:C.analyze(cards,source,saved).summary};
 }
 async function authorized(user){const scoped=await getScoped(user,true);if(scoped.access.can_manage_compensation!==true)throw fault(403,'Этот раздел доступен только руководителям L0.');return scoped;}
 return {
  async enrich(scoped){
   let saved;try{saved=await store.get();}catch{return {...scoped,cards:scoped.cards.map(c=>({...c,compensation:{status:'unavailable',fair_cost:null,indexation:null,reason:C.reasons.unavailable}}))};}
   const source=C.references(scoped.cards),analysis=C.analyze(scoped.cards,source,saved),values=new Map(analysis.rows.map(r=>[r.card.unit.task_id,r.value]));
   return {...scoped,cards:scoped.cards.map(c=>({...c,compensation:values.get(c.unit.task_id)||C.calculate(c,source,saved)}))};
  },
  async settings(user){const scoped=await authorized(user);return context(scoped,await store.get());},
  async save(user,body){
   const scoped=await authorized(user);
   if(Object.keys(body).some(k=>!['model','expected_revision'].includes(k))||!own(body,'model')||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0)throw fault(400,'Нужны коэффициенты и версия модели.');
   let model;try{model=C.validateModel(body.model);}catch(e){throw fault(400,e.message);}
   const source=C.references(scoped.cards);if(source.base===null||!source.tracks.employee.valid||!source.tracks.boss.valid)throw fault(422,'Для сохранения нужны база Юнлинга и четыре полностью оценённых эталона в каждом треке.');
   // Reject overflow before publishing; every possible score must remain representable.
   try{C.fairCost(69,'employee',source,model);C.fairCost(30,'boss',source,model);}catch{throw fault(400,'Коэффициенты приводят к слишком большим суммам.');}
   const saved=await store.save(model,body.expected_revision,user);return context(scoped,saved);
  },
  async export(user,body){
   if(Object.keys(body).length)throw fault(400,'Реестр использует текущие данные и сохранённую модель; дополнительные параметры не нужны.');
   if(pending.has(user.id))throw fault(409,'Реестр уже формируется.');pending.add(user.id);
   try{
    const scoped=await authorized(user),saved=await store.get();
    if(!saved.model)throw fault(409,'Модель не настроена. Сохраните коэффициенты в Playgound.');
    const source=C.references(scoped.cards),analysis=C.analyze(scoped.cards,source,saved);
    if(!analysis.summary.employees)throw fault(422,'Нет доступных сотрудников со статусом «Работает».');
    if(analysis.summary.indexation===null)throw fault(422,'Итоговая сумма выходит за допустимый диапазон.');
    const generated_at=new Date(now()).toISOString();
    const body=indexationXlsx({analysis,source,saved,generated_at,hr_generated_at:scoped.generated_at});
    return {body,filename:'UBAIT_Indexation_'+generated_at.slice(0,10)+'_v'+saved.revision+'.xlsx'};
   }finally{pending.delete(user.id);}
  }
 };
}
