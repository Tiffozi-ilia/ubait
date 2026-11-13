/** Same-origin gateway with server-side PocketBase authentication.
 * No business DB access or calculations. n8n uses a server-only shared secret.
 * Static routes are allowlisted: source, workflow and credentials are never served.
 * A short shared cache + single-flight prevents 40 viewers from launching 40 queries.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {createAuth} from './auth.mjs';
import {authorizeHr} from './hr-access.mjs';
import {createCompensationApi,readCompensationBody} from './compensation-api.mjs';
// One competency per request. No retained results, cooldown or shared pending calls.
const WEBHOOK='https://n8n.ubait.ru/webhook/get_confluence_tree_storage_matrix';
export const isCompetencyId=value=>typeof value==='string'&&/^03\.01\.(?:01|02)\.\d{2}\.\d{2}$/.test(value);
const MAX_BYTES=8*1024*1024;
const invalid=()=>new Error('Invalid competency reference response');
const sourceLink=id=>'https://confluence.sovcombank.ru/pages/viewpage.action?pageId='+id;

function xmlText(value){
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,entity=>{
    const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    if(named[entity])return named[entity];
    const n=entity[2]?.toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));
    return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):entity;
  });
}

export function markdownFromStorage(storage){
  if(typeof storage!=='string'||storage.length>200000)throw invalid();
  const parts=[];
  // Extract only the markdown macro, never render Confluence storage as HTML.
  for(const macro of storage.matchAll(/<ac:structured-macro\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ac:structured-macro\s*>)/g)){
    if(!/\bac:name\s*=\s*(["'])markdown\1/.test(macro[1]))continue;
    if(!macro[2])continue;
    const body=macro[2].match(/<ac:plain-text-body\s*>([\s\S]*?)<\/ac:plain-text-body\s*>/);
    if(!body)continue;
    let text='';
    for(const token of body[1].matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)|(<)/g)){
      // CDATA is already literal Markdown: do not decode its entities a second time.
      if(token[1]!==undefined)text+=token[1];
      else if(token[2])text+=xmlText(token[2]);
      else throw invalid();
    }
    if(text.trim())parts.push(text.trim());
  }
  return parts.join('\n\n');
}

export function extractCompetencyDocs(payload,matrixId,loadedAt=Date.now()){
  if(!isCompetencyId(matrixId))throw invalid();
  if(Array.isArray(payload)&&payload.length!==1)throw invalid();
  const source=Array.isArray(payload)?payload[0]:payload;
  if(!source?.tree||source.tree.matrix_id!==matrixId||String(source.page_id)!==String(source.tree.id)||!Number.isInteger(source.total_pages))throw invalid();
  if(source.matrix_id!==undefined&&source.matrix_id!==matrixId)throw invalid();
  const stack=[{node:source.tree,depth:0}],pages=[],ids=new Set(),codes=new Set();
  while(stack.length){
    const {node,depth}=stack.pop();
    if(depth>20||pages.length>=2000||!node||!/^\d{1,20}$/.test(String(node.id))||ids.has(String(node.id))||!Array.isArray(node.children))throw invalid();
    ids.add(String(node.id));pages.push(node);
    if(node.matrix_id!==null&&node.matrix_id!==undefined){
      if(typeof node.matrix_id!=='string'||!/^\d{2}(?:\.\d{2}){1,8}$/.test(node.matrix_id)||codes.has(node.matrix_id))throw invalid();
      if(node.matrix_id!==matrixId&&!node.matrix_id.startsWith(matrixId+'.'))throw invalid();
      codes.add(node.matrix_id);
    }
    for(const child of node.children)stack.push({node:child,depth:depth+1});
  }
  if(pages.length!==source.total_pages||(source.descendant_pages!==undefined&&source.descendant_pages!==pages.length-1))throw invalid();
  const section=node=>{
    if(!node)return null;
    const markdown=markdownFromStorage(node.body?.storage?.value);
    return markdown?{markdown,page_id:String(node.id),url:sourceLink(node.id)}:null;
  };
  const page=source.tree,criteria=page.children.find(c=>c.matrix_id===matrixId+'.01');
  // Match the requested root and exact child codes; grade calculations stay in HR.
  const competency={description:section(page),criteria:section(criteria),
    positive:section(criteria?.children.find(c=>c.matrix_id===matrixId+'.01.01')),
    negative:section(criteria?.children.find(c=>c.matrix_id===matrixId+'.01.02'))};
  return {schema_version:2,matrix_id:matrixId,source_page_id:String(page.id),loaded_at:new Date(loadedAt).toISOString(),competency};
}

export function createCompetencyDocs({fetchImpl=fetch,now=Date.now,timeoutMs=60000}={}){
  const unavailable=()=>Object.assign(new Error('Описания компетенций временно недоступны.'),{status:503});
  return async function getDocs(matrixId){
    if(!isCompetencyId(matrixId))throw Object.assign(new Error('Неверный matrix_id компетенции.'),{status:400});
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        // Fixed destination and body. Never forward user cookies, PB tokens or the HR webhook secret.
        const response=await fetchImpl(new URL(WEBHOOK),{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','Cache-Control':'no-cache'},
          body:JSON.stringify({matrix_id:matrixId}),cache:'no-store',signal:controller.signal,redirect:'error'});
        if(!response.ok||!response.body||Number(response.headers.get('content-length'))>MAX_BYTES)throw invalid();
        const reader=response.body.getReader(),chunks=[];let size=0;
        try{
          for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw invalid();chunks.push(Buffer.from(value));}
        }catch(error){await reader.cancel().catch(()=>{});throw error;}
        return extractCompetencyDocs(JSON.parse(Buffer.concat(chunks).toString('utf8')),matrixId,now());
      }catch{throw unavailable();}
      finally{clearTimeout(timer);controller.abort();}
  };
}

export const BUILD_VERSION='2026.11.13-v2.10.2';

// Shared in-flight sync. Browsers poll this small status instead of holding an HTTP request open.
export function createHrSync({webhookUrl,webhookSecret,fetchImpl=fetch,now=Date.now,invalidate=()=>{},timeoutMs=900000}){
  let job=null;
  const snapshot=()=>job?{...job}:{status:'idle'};
  async function run(current){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const target=new URL(hrWebhookAddress(webhookUrl));target.pathname=target.pathname.replace(/\/reestr-hr-v1$/,'/reestr-hr-sync-v1');
      if(target.protocol!=='https:'||target.username||target.password||!/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret||''))throw new Error();
      const response=await fetchImpl(target,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-UBAIT-Key':webhookSecret},body:'{}',cache:'no-store',signal:controller.signal,redirect:'error'});
      if(!response.ok||!response.body||Number(response.headers.get('content-length'))>8192)throw new Error();
      const reader=response.body.getReader(),chunks=[];let size=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192)throw new Error();chunks.push(Buffer.from(value));}}catch(e){await reader.cancel().catch(()=>{});throw e;}
      const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(result?.schema_version!==1||result.dataset!=='hr_sync'||result.source_form_id!==405691||result.status!=='completed'||typeof result.warnings!=='boolean')throw new Error();
      invalidate();current.status='completed';current.warnings=result.warnings;
    }catch{
      // A network timeout does not prove that n8n rolled back: do not claim otherwise.
      invalidate();current.status='unconfirmed';
    }finally{clearTimeout(timer);controller.abort();current.finished_at=new Date(now()).toISOString();}
  }
  return {status:snapshot,start(){
    if(job?.status==='running')return snapshot();
    job={id:randomUUID(),status:'running',started_at:new Date(now()).toISOString()};
    void run(job);return snapshot();
  }};
}

export function isSkillHistoryRequest(taskId,kind,matrixId){
  return typeof taskId==='string'&&/^[1-9][0-9]{0,18}$/.test(taskId)&&BigInt(taskId)<=9223372036854775807n&&
    ['employee','boss'].includes(kind)&&isCompetencyId(matrixId)&&matrixId.startsWith(kind==='employee'?'03.01.01.':'03.01.02.');
}
export function scopeSkillHistory(payload,card,kind,matrixId){
  const bad=()=>{throw Object.assign(new Error('История оценок временно недоступна.'),{status:503});};
  if(payload?.schema_version!==1||payload.dataset!=='hr_skill_history'||payload.source_form_id!==405691||
    payload.task_id!==card.unit.task_id||payload.skill_block!==kind||payload.matrix_id!==matrixId||
    !Array.isArray(payload.entries)||payload.entries.length>10000)bad();
  const ids=new Set(),entries=[];
  const validGrade=g=>g===null||(typeof g==='string'&&/^[ABC][+-]?$/.test(g));
  const date=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(d)&&Number.isFinite(Date.parse(d));
  for(const r of payload.entries){
    if(!r||typeof r.id!=='string'||! /^[1-9][0-9]{0,18}$/.test(r.id)||ids.has(r.id)||
      r.task_id!==card.unit.task_id||r.skill_block!==kind||r.matrix_id!==matrixId||
      !(r.staff_id===null||(typeof r.staff_id==='string'&&/^[1-9][0-9]*$/.test(r.staff_id)))||
      typeof r.is_reference!=='boolean'||typeof r.is_baseline!=='boolean'||
      !validGrade(r.current_grade)||!validGrade(r.target_grade)||!date(r.created_at)||!date(r.recorded_at))bad();
    ids.add(r.id);
    // A reused Pyrus card must not expose a previous employee's assessments.
    if(r.staff_id!==(card.unit.staff_id==null?null:String(card.unit.staff_id))||r.is_reference!==(card.unit.status==='Эталон'))continue;
    entries.push({id:r.id,current_grade:r.current_grade,target_grade:r.target_grade,created_at:r.created_at,recorded_at:r.recorded_at,is_baseline:r.is_baseline});
  }
  entries.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||(BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0));
  return {schema_version:1,dataset:'hr_skill_history',source_form_id:405691,task_id:card.unit.task_id,
    skill_block:kind,matrix_id:matrixId,timezone:'Europe/Moscow',entries};
}

export function createSkillHistoryReader({webhookUrl,webhookSecret,fetchImpl=fetch,timeoutMs=65000}){
  return async(taskId,kind,matrixId)=>{
    const unavailable=()=>Object.assign(new Error('История оценок временно недоступна.'),{status:503});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const target=new URL(hrWebhookAddress(webhookUrl));
      target.pathname=target.pathname.replace(/\/reestr-hr-v1$/,'/reestr-hr-skills-history-v1');
      if(target.protocol!=='https:'||target.username||target.password||!/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret||''))throw unavailable();
      target.searchParams.set('task_id',taskId);target.searchParams.set('kind',kind);target.searchParams.set('matrix_id',matrixId);
      const response=await fetchImpl(target,{headers:{Accept:'application/json','X-UBAIT-Key':webhookSecret},
        cache:'no-store',signal:controller.signal,redirect:'error'});
      if(!response.ok||!response.body||Number(response.headers.get('content-length'))>2*1024*1024)throw unavailable();
      const reader=response.body.getReader(),chunks=[];let size=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw unavailable();chunks.push(Buffer.from(value));}}
      catch(e){await reader.cancel().catch(()=>{});throw e;}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }catch{throw unavailable();}finally{clearTimeout(timer);}
  };
}

export function hrWebhookAddress(mapAddress){
  if(!mapAddress)throw Object.assign(new Error('В Amvera не задана переменная STORY_MAP_WEBHOOK_URL.'),{status:503});
  let target;try{target=new URL(mapAddress);}catch{throw Object.assign(new Error('STORY_MAP_WEBHOOK_URL содержит неверный адрес.'),{status:503});}
  if(!/\/reestr-story-map-v1\/?$/.test(target.pathname))throw Object.assign(new Error('В STORY_MAP_WEBHOOK_URL ожидается путь reestr-story-map-v1 для автоматического подключения HR.'),{status:503});
  target.pathname=target.pathname.replace(/\/reestr-story-map-v1\/?$/,'/reestr-hr-v1');
  target.search='';target.hash='';return target.href;
}

const KPI_XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const kpiFault=(status,message)=>Object.assign(new Error(message),{status});
async function readKpiPeriod(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw kpiFault(415,'Нужен JSON-запрос.');
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>1024)throw kpiFault(413,'Слишком большой запрос.');chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw kpiFault(400,'Выберите год и квартал.');}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['year','quarter'].includes(k))||
    !Number.isInteger(body.year)||body.year<1900||body.year>9999||!Number.isInteger(body.quarter)||body.quarter<1||body.quarter>4)throw kpiFault(400,'Выберите корректный год и квартал.');
  return {year:body.year,quarter:body.quarter};
}
export function createKpiExporter({webhookUrl,webhookSecret,fetchImpl=fetch,timeoutMs=65000}){
  return async function exportKpi(period,scoped){
    if(scoped?.access?.can_export_kpi!==true)throw kpiFault(403,'Формирование реестра доступно только руководителям L0.');
    const allowed_task_ids=scoped.cards.filter(c=>c.unit.is_reference!==true&&c.unit.status!=='Эталон').map(c=>c.unit.task_id);
    let target;try{target=new URL(hrWebhookAddress(webhookUrl));target.pathname=target.pathname.replace(/reestr-hr-v1$/, 'reestr-kpi-excel-v1');}catch{throw kpiFault(503,'Проверьте настройку STORY_MAP_WEBHOOK_URL в Amvera.');}
    if(target.protocol!=='https:'||target.username||target.password||!/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret||''))throw kpiFault(503,'Проверьте адрес n8n и N8N_WEBHOOK_SECRET в Amvera.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json',Accept:KPI_XLSX+', application/json','X-UBAIT-Key':webhookSecret},
        body:JSON.stringify({...period,allowed_task_ids}),signal:controller.signal,redirect:'error'});
      const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      const limit=response.ok&&type===KPI_XLSX?50*1024*1024:64*1024;
      if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw kpiFault(502,'Файл реестра превышает допустимый размер.');}
      const reader=response.body?.getReader();if(!reader)throw kpiFault(502,'Сервис реестра вернул пустой ответ.');
      const chunks=[];let size=0;
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw kpiFault(502,'Ответ сервиса реестра слишком большой.');}chunks.push(Buffer.from(value));}
      const body=Buffer.concat(chunks);
      if(!response.ok||type!==KPI_XLSX){
        let code;try{code=JSON.parse(body.toString('utf8'))?.error?.code;}catch{}
        if(code==='NO_DATA')throw kpiFault(422,'За выбранный период нет данных для реестра. Выберите другой квартал.');
        if(response.status===404)throw kpiFault(503,'Флоу «UBAIT — KPI из базы → Excel v2» не активирован в n8n.');
        if([401,403].includes(response.status))throw kpiFault(503,'Проверьте Header Auth «UBAIT Site API» у вебхука реестра в n8n.');
        if(code==='DATABASE_READ_FAILED')throw kpiFault(503,'Не удалось прочитать KPI из БД. Повторите позже.');
        throw kpiFault(502,'Не удалось сформировать Excel. Проверьте выполнение флоу реестра в n8n.');
      }
      if(body.length<4||body.readUInt32LE(0)!==0x04034b50)throw kpiFault(502,'Сервис реестра вернул некорректный файл Excel.');
      return {body,filename:`Output_KPI_Report_${period.year}_Q${period.quarter}.xlsx`};
    }catch(error){
      if(error.status)throw error;
      throw kpiFault(504,controller.signal.aborted?'Формирование заняло больше минуты. Повторите позже.':'Сервис формирования реестра временно недоступен.');
    }finally{clearTimeout(timer);}
  };
}
export function createStoryMapServer({webhookUrl=process.env.STORY_MAP_WEBHOOK_URL, fetchImpl=fetch, now=Date.now, cacheMs=15000,
  webhookSecret=process.env.N8N_WEBHOOK_SECRET,origin=process.env.PUBLIC_ORIGIN,authOptions={},compensationStore}={}) {
  const auth=createAuth({origin,...authOptions});
  const htmlPath=new URL('./index.html',import.meta.url);
  function channel(kind){
   let cache=null,pending=null,generation=0;
   async function upstream() {
    if(cache && now()-cache.at<cacheMs) return cache.body;
    if(pending) return pending;
    const version=generation;
    const running=(async()=>{
      if(!webhookUrl) throw Object.assign(new Error('В Amvera не задана переменная STORY_MAP_WEBHOOK_URL.'),{status:503});
      let target;
      try { target=new URL(kind==='hr'?hrWebhookAddress(webhookUrl):webhookUrl); } catch(error) { if(error.status)throw error;throw Object.assign(new Error('STORY_MAP_WEBHOOK_URL содержит неверный адрес.'),{status:503}); }
      if(target.protocol!=='https:' || target.username || target.password) throw Object.assign(new Error('STORY_MAP_WEBHOOK_URL должен быть HTTPS-адресом без логина и пароля.'),{status:503});
      if(!/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret||''))throw Object.assign(new Error('В Amvera нужен N8N_WEBHOOK_SECRET: случайный секрет от 32 символов.'),{status:503});
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),65000);
      try {
        const response=await fetchImpl(target,{headers:{Accept:'application/json','X-UBAIT-Key':webhookSecret},signal:controller.signal,redirect:'error'});
        if(!response.ok) throw new Error(`Вебхук n8n${kind==='hr'?' HR':''} вернул HTTP ${response.status}. Проверьте активацию флоу${kind==='hr'?' «HR — реальные данные 405691»':''} и его выполнение.`);
        if(Number(response.headers.get('content-length'))>20*1024*1024) throw new Error('Ответ n8n больше 20 МБ — нужен компактный JSON Story Map.');
        const reader=response.body.getReader();const chunks=[];let size=0;
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20*1024*1024){await reader.cancel();throw new Error('Ответ n8n больше 20 МБ.');}chunks.push(Buffer.from(value));}
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Вебхук вернул не JSON. Проверьте последнюю ноду Respond to Webhook.');}
        if(kind==='hr'){
          if(data?.schema_version!==1||data.dataset!=='hr'||data.api_revision!==1||data.source_form_id!==405691||!Array.isArray(data.cards))throw new Error('Неверный ответ n8n HR: нужен флоу «HR — реальные данные 405691».');
        }else if(data?.schema_version!==1 || !Array.isArray(data.stories) || !Array.isArray(data.epics)) throw new Error('Неверный ответ n8n: ожидаются schema_version: 1, stories и epics.');
        const body=JSON.stringify(data);if(version===generation)cache={body,at:now()};return body;
      } finally { clearTimeout(timer); }
    })().catch(error=>{if(version===generation)cache=null;throw error;}).finally(()=>{if(pending===running)pending=null;});
    pending=running;
    return pending;
   }
   upstream.invalidate=()=>{generation++;cache=null;pending=null;};return upstream;
  }
  const upstream=channel('map'),hrUpstream=channel('hr');
  const compensation=createCompensationApi({getScoped:async(user,fresh)=>{if(fresh)hrUpstream.invalidate();return authorizeHr(JSON.parse(await hrUpstream()),user);},store:compensationStore,now});
  const competencyDocs=createCompetencyDocs({fetchImpl,now});
  const skillHistory=createSkillHistoryReader({webhookUrl,webhookSecret,fetchImpl});
  const hrSync=createHrSync({webhookUrl,webhookSecret,fetchImpl,now,invalidate:()=>hrUpstream.invalidate()});
  const exportKpi=createKpiExporter({webhookUrl,webhookSecret,fetchImpl});
  const kpiPending=new Set();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Strict-Transport-Security','max-age=86400');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Story-Map-Version',BUILD_VERSION);
    res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://local');
      if(url.pathname==='/healthz'&&['GET','HEAD'].includes(req.method))return json(200,{ok:true,version:BUILD_VERSION});
      if(url.pathname==='/auth/login'&&req.method==='POST')return json(200,await auth.login(req,res));
      if(url.pathname==='/auth/logout'&&req.method==='POST')return json(200,auth.logout(req,res));
      if(url.pathname==='/auth/change-password'&&req.method==='POST')return json(200,await auth.changePassword(req,res));
      if(auth.isAdminRoute(url.pathname))return await auth.proxyAdmin(req,res,url);
      const syncPost=url.pathname==='/api/hr/sync'&&req.method==='POST';
      const kpiPost=url.pathname==='/api/hr/kpi-export'&&req.method==='POST';
      const compensationWrite=(url.pathname==='/api/hr/compensation-settings'&&req.method==='PUT')||(url.pathname==='/api/hr/indexation-export'&&req.method==='POST');
      if(!['GET','HEAD'].includes(req.method)&&!syncPost&&!kpiPost&&!compensationWrite){res.setHeader('Allow','GET, HEAD');return json(405,{error:'Только GET.'});}
      if(['/login','/login.js','/login.css'].includes(url.pathname)){
        const name=url.pathname==='/login'?'login.html':url.pathname.slice(1);
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});
        return res.end(req.method==='HEAD'?undefined:await readFile(new URL('./'+name,import.meta.url)));
      }
      // Authenticate BEFORE reading HTML, assets, caches or calling n8n.
      let user;try{user=await auth.requireUser(req,res);}catch(e){
        if(e.status===401&&['/','/index.html'].includes(url.pathname)){res.writeHead(303,{Location:'/login'});return res.end();}
        return json(e.status||503,{error:e.status===401?'Войдите в систему.':'Сервис входа временно недоступен.'});
      }
      if(url.pathname==='/auth/me')return json(200,user);
      if(['/api/hr/compensation-settings','/api/hr/indexation-export'].includes(url.pathname)){
        res.setHeader('Vary','Cookie');
        const settings=url.pathname.endsWith('/compensation-settings'),allowed=settings?['GET','PUT']:['POST'];
        if(!allowed.includes(req.method)){res.setHeader('Allow',allowed.join(', '));return json(405,{error:'Метод не поддерживается.'});}
        if(req.method!=='GET'&&(req.headers.origin!==new URL(origin).origin||req.headers['sec-fetch-site']==='cross-site'))return json(403,{error:'Запрос разрешён только со страницы сайта.'});
        try{
          if(settings)return json(200,req.method==='GET'?await compensation.settings(user):await compensation.save(user,await readCompensationBody(req)));
          const result=await compensation.export(user,await readCompensationBody(req));
          res.writeHead(200,{'Content-Type':KPI_XLSX,'Content-Disposition':`attachment; filename="${result.filename}"`,'Content-Length':result.body.length});return res.end(result.body);
        }catch(error){return json(error.status||503,{error:error.status?error.message:'Не удалось выполнить операцию с моделью. Повторите позже.'});}
      }
      if(url.pathname==='/api/hr/kpi-export'){
        res.setHeader('Vary','Cookie');
        if(!kpiPost){res.setHeader('Allow','POST');return json(405,{error:'Только POST.'});}
        if(req.headers.origin!==new URL(origin).origin||req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Формирование разрешено только со страницы сайта.'});
        const period=await readKpiPeriod(req);
        if(kpiPending.has(user.id))return json(409,{error:'Реестр уже формируется. Дождитесь скачивания.'});
        kpiPending.add(user.id);
        try{
          // Fresh server-side scope; browser filters and selected employee never grant access.
          hrUpstream.invalidate();
          const scoped=authorizeHr(JSON.parse(await hrUpstream()),user);
          const result=await exportKpi(period,scoped);
          res.writeHead(200,{'Content-Type':KPI_XLSX,'Content-Disposition':`attachment; filename="${result.filename}"`,'Content-Length':result.body.length});
          return res.end(result.body);
        }catch(error){return json(error.status||502,{error:error.status?error.message:'Не удалось сформировать реестр. Повторите позже.'});}
        finally{kpiPending.delete(user.id);}
      }
      if(url.pathname==='/api/hr/sync'){
        res.setHeader('Vary','Cookie');
        if(syncPost&&(req.headers.origin!==new URL(origin).origin||req.headers['sec-fetch-site']==='cross-site'))return json(403,{error:'Запуск разрешён только со страницы сайта.'});
        // Starting the shared loader grants no extra read access to any HR record.
        authorizeHr(JSON.parse(await hrUpstream()),user);
        const status=syncPost?hrSync.start():hrSync.status();
        if(req.method==='HEAD'){res.writeHead(200);return res.end();}
        return json(syncPost?202:200,status);
      }
      if(url.pathname==='/api/competency-docs'){
        res.setHeader('Vary','Cookie');
        const matrixId=url.searchParams.get('matrix_id');
        if(url.searchParams.getAll('matrix_id').length!==1||!isCompetencyId(matrixId))return json(400,{error:'Нужен matrix_id одной компетенции.'});
        try{
          const body=await competencyDocs(matrixId);
          if(req.method==='HEAD'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end();}
          return json(200,body);
        }catch{return json(503,{error:'Описания компетенций временно недоступны.'});}
      }
      if(url.pathname==='/api/story-map'){
        const body=await upstream();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:body);
      }
      if(url.pathname==='/api/hr/skill-history'){
        res.setHeader('Vary','Cookie');
        const taskId=url.searchParams.get('task_id'),kind=url.searchParams.get('kind'),matrixId=url.searchParams.get('matrix_id');
        if(['task_id','kind','matrix_id'].some(k=>url.searchParams.getAll(k).length!==1)||!isSkillHistoryRequest(taskId,kind,matrixId))return json(400,{error:'Неверная карточка или компетенция.'});
        const scoped=authorizeHr(JSON.parse(await hrUpstream()),user);
        const card=scoped.cards.find(c=>c.unit.task_id===taskId);
        if(!card)return json(403,{error:'Нет доступа к истории этой карточки.'});
        const body=scopeSkillHistory(await skillHistory(taskId,kind,matrixId),card,kind,matrixId);
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
        return res.end(req.method==='HEAD'?undefined:JSON.stringify(body));
      }
      if(url.pathname==='/api/hr'){
        res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
        res.setHeader('Vary','Cookie');
        // The shared snapshot NEVER leaves the server. Reauthorize each response
        // for the freshly validated PocketBase identity, including cache hits.
        const body=JSON.stringify(await compensation.enrich(authorizeHr(JSON.parse(await hrUpstream()),user)));
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:body);
      }
      if(['/errors.js','/stat.js','/kanban.js','/hr-model.js','/compensation.js','/compensation-ui.js','/hr.js','/hr.css','/auth-client.js'].includes(url.pathname)){
        const source=await readFile(new URL('.'+url.pathname,import.meta.url),'utf8');
        res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:source);
      }
      if(url.pathname!=='/' && url.pathname!=='/index.html')return json(404,{error:'Не найдено.'});
      const html=await readFile(htmlPath,'utf8');
      const scriptHashes=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
      res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self' ${scriptHashes}; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(req.method==='HEAD'?undefined:html);
    }catch(error){
      const message=error.name==='AbortError'?'n8n не ответил за 65 секунд. Проверьте Executions в n8n.':error.message;
      // Never log upstream bodies, task records, tokens or SQL errors to the public response.
      const safe=(error.status&&error.status<500)||/^В |^STORY_MAP|^Вебхук|^Ответ|^Неверный ответ|^n8n /.test(message)?message:'Сервис временно недоступен. Проверьте настройки приложения.';
      json(error.status??502,{error:safe});
    }
  });
  server.requestTimeout=70000;server.headersTimeout=10000;
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Неверный PORT');
  const server=createStoryMapServer();
  server.listen(port,'0.0.0.0',()=>console.log(`Story Map ${BUILD_VERSION} listening on 0.0.0.0:${port}`));
  process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
