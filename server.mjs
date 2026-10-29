/** Minimal same-origin bridge. No DB access, no business calculations, no user auth.
 * The only configurable upstream is STORY_MAP_WEBHOOK_URL (HTTPS).
 * Static routes are allowlisted: source, workflow and credentials are never served.
 * A short shared cache + single-flight prevents 40 viewers from launching 40 queries.
 */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const BUILD_VERSION='2026.10.29-v2.1';

export function createStoryMapServer({webhookUrl=process.env.STORY_MAP_WEBHOOK_URL, fetchImpl=fetch, now=Date.now, cacheMs=15000}={}) {
  let cache=null, pending=null;
  const htmlPath=new URL('./index.html',import.meta.url);
  async function upstream() {
    if(cache && now()-cache.at<cacheMs) return cache.body;
    if(pending) return pending;
    pending=(async()=>{
      if(!webhookUrl) throw Object.assign(new Error('В Amvera не задана переменная STORY_MAP_WEBHOOK_URL.'),{status:503});
      let target;
      try { target=new URL(webhookUrl); } catch { throw Object.assign(new Error('STORY_MAP_WEBHOOK_URL содержит неверный адрес.'),{status:503}); }
      if(target.protocol!=='https:' || target.username || target.password) throw Object.assign(new Error('STORY_MAP_WEBHOOK_URL должен быть HTTPS-адресом без логина и пароля.'),{status:503});
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),65000);
      try {
        const response=await fetchImpl(target,{headers:{Accept:'application/json'},signal:controller.signal,redirect:'error'});
        if(!response.ok) throw new Error(`Вебхук n8n вернул HTTP ${response.status}. Проверьте активацию флоу и его выполнение.`);
        if(Number(response.headers.get('content-length'))>20*1024*1024) throw new Error('Ответ n8n больше 20 МБ — нужен компактный JSON Story Map.');
        const reader=response.body.getReader();const chunks=[];let size=0;
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20*1024*1024){await reader.cancel();throw new Error('Ответ n8n больше 20 МБ.');}chunks.push(Buffer.from(value));}
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Вебхук вернул не JSON. Проверьте последнюю ноду Respond to Webhook.');}
        if(data?.schema_version!==1 || !Array.isArray(data.stories) || !Array.isArray(data.epics)) throw new Error('Неверный ответ n8n: ожидаются schema_version: 1, stories и epics.');
        const body=JSON.stringify(data);cache={body,at:now()};return body;
      } finally { clearTimeout(timer); }
    })().catch(error=>{cache=null;throw error;}).finally(()=>{pending=null;});
    return pending;
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Story-Map-Version',BUILD_VERSION);
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://local');
      if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return json(405,{error:'Только GET.'});}
      if(url.pathname==='/healthz')return json(200,{ok:true,version:BUILD_VERSION});
      if(url.pathname==='/api/story-map'){
        const body=await upstream();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});return res.end(req.method==='HEAD'?undefined:body);
      }
      if(url.pathname!=='/' && url.pathname!=='/index.html')return json(404,{error:'Не найдено.'});
      const html=await readFile(htmlPath,'utf8');
      const scriptHashes=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
      res.setHeader('Content-Security-Policy',`default-src 'none'; script-src ${scriptHashes}; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(req.method==='HEAD'?undefined:html);
    }catch(error){
      const message=error.name==='AbortError'?'n8n не ответил за 65 секунд. Проверьте Executions в n8n.':error.message;
      // Never log upstream bodies, task records, tokens or SQL errors to the public response.
      const safe=/^В |^STORY_MAP|^Вебхук|^Ответ|^Неверный ответ|^n8n /.test(message)?message:'Не удалось связаться с n8n. Проверьте адрес вебхука и доступность сервера.';
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
