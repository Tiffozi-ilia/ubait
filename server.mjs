/** Same-origin gateway with server-side PocketBase authentication.
 * No business DB access or calculations. n8n uses a server-only shared secret.
 * Static routes are allowlisted: source, workflow and credentials are never served.
 * A short shared cache + single-flight prevents 40 viewers from launching 40 queries.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createAuth} from './auth.mjs';

export const BUILD_VERSION='2026.10.30-v2.5';

export function hrWebhookAddress(mapAddress){
  if(!mapAddress)throw Object.assign(new Error('В Amvera не задана переменная STORY_MAP_WEBHOOK_URL.'),{status:503});
  let target;try{target=new URL(mapAddress);}catch{throw Object.assign(new Error('STORY_MAP_WEBHOOK_URL содержит неверный адрес.'),{status:503});}
  if(!/\/reestr-story-map-v1\/?$/.test(target.pathname))throw Object.assign(new Error('В STORY_MAP_WEBHOOK_URL ожидается путь reestr-story-map-v1 для автоматического подключения HR.'),{status:503});
  target.pathname=target.pathname.replace(/\/reestr-story-map-v1\/?$/,'/reestr-hr-v1');
  target.search='';target.hash='';return target.href;
}

export function createStoryMapServer({webhookUrl=process.env.STORY_MAP_WEBHOOK_URL, fetchImpl=fetch, now=Date.now, cacheMs=15000,
  webhookSecret=process.env.N8N_WEBHOOK_SECRET,origin=process.env.PUBLIC_ORIGIN,authOptions={}}={}) {
  const auth=createAuth({origin,...authOptions});
  const htmlPath=new URL('./index.html',import.meta.url);
  function channel(kind){
   let cache=null,pending=null;
   return async function upstream() {
    if(cache && now()-cache.at<cacheMs) return cache.body;
    if(pending) return pending;
    pending=(async()=>{
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
        const body=JSON.stringify(data);cache={body,at:now()};return body;
      } finally { clearTimeout(timer); }
    })().catch(error=>{cache=null;throw error;}).finally(()=>{pending=null;});
    return pending;
   };
  }
  const upstream=channel('map'),hrUpstream=channel('hr');
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
      if(auth.isAdminRoute(url.pathname))return await auth.proxyAdmin(req,res,url);
      if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return json(405,{error:'Только GET.'});}
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
      if(url.pathname==='/api/story-map'){
        const body=await upstream();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:body);
      }
      if(url.pathname==='/api/hr'){
        res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
        const body=await hrUpstream();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:body);
      }
      if(['/errors.js','/stat.js','/hr.js','/hr.css','/auth-client.js'].includes(url.pathname)){
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
