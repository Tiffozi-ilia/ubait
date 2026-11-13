import C from './compensation.js';
const fault=(status,message)=>Object.assign(new Error(message),{status});
export function createCompensationStore({fetchImpl=fetch,key=process.env.UBAIT_INTERNAL_KEY,pbPort=8090}={}){
 async function call(method,body){
  if(!key)throw fault(503,'Хранилище модели ещё не подключено. Перезапустите приложение после обновления.');
  let response;
  try{response=await fetchImpl(`http://127.0.0.1:${pbPort}/api/ubait/compensation`,{method,headers:{'X-UBAIT-Internal':key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw fault(503,'Не удалось связаться с хранилищем модели.');}
  if(response.status===409)throw fault(409,'Настройки уже изменены другим руководителем. Загрузите актуальную версию.');
  if(!response.ok)throw fault(503,'Не удалось прочитать или сохранить модель. Черновик сохранён в открытой вкладке.');
  let value;try{value=await response.json();}catch{throw fault(503,'Хранилище модели вернуло неверный ответ.');}
  if(value?.schema_version!==1||value.formula_version!==C.formulaVersion||!Number.isSafeInteger(value.revision)||value.revision<0||(!value.model&&value.revision!==0))throw fault(503,'Неверный формат сохранённой модели.');
  if(value.model)try{C.validateModel(value.model);}catch{throw fault(503,'В сохранённой модели некорректные коэффициенты.');}
  return value;
 }
 return {get:()=>call('GET'),save:(model,expected_revision,user)=>call('PUT',{model:C.validateModel(model),expected_revision,actor_id:user.id})};
}
