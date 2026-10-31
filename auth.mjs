import {randomBytes,createHash} from 'node:crypto';
import http from 'node:http';

const error=(status,message)=>Object.assign(new Error(message),{status});
const digest=s=>createHash('sha256').update(s).digest('hex');
export function publicOrigin(value,{development=false}={}){
  let u;try{u=new URL(value);}catch{throw error(503,'Задайте PUBLIC_ORIGIN — HTTPS-адрес сайта.');}
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(development&&u.protocol==='http:'&&u.hostname==='127.0.0.1')))throw error(503,'PUBLIC_ORIGIN должен быть HTTPS-адресом сайта без пути.');
  return u.origin;
}
export function createAuth({origin,fetchImpl=fetch,now=Date.now,pbPort=8090,development=false}={}){
  const site=publicOrigin(origin,{development});
  const cookieName=development?'ubait_dev_session':'__Host-ubait_session';
  const sessions=new Map(),attempts=new Map(),passwordChanges=new Set();let inFlightLogins=0;
  const cookie=(v,age)=>`${cookieName}=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${development?'':'; Secure'}`;
  const clear=res=>res.setHeader('Set-Cookie',cookie('',0));
  const sessionKey=req=>{
    const matches=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
    if(matches.length!==1)return null;
    const value=matches[0].slice(cookieName.length+1);return /^[\w-]{43}$/.test(value)?digest(value):null;
  };
  const sweep=()=>{for(const [k,s]of sessions)if(now()>s.until||now()-s.seen>2*3600_000)sessions.delete(k);for(const[k,v]of attempts)if(now()>v.until)attempts.delete(k);};
  function rate(key,limit,windowMs){
    sweep();if(attempts.size>10000)throw error(429,'Слишком много попыток. Повторите позже.');
    const r=attempts.get(key)||{count:0,until:now()+windowMs};r.count++;attempts.set(key,r);
    if(r.count>limit)throw error(429,'Слишком много попыток. Повторите позже.');
  }
  function sameOrigin(req){if(req.headers.origin!==site||req.headers['sec-fetch-site']==='cross-site')throw error(403,'Запрос разрешён только со страницы этого сайта.');}
  async function readJson(req){
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw error(415,'Нужен JSON-запрос.');
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw error(413,'Слишком большой запрос.');chunks.push(chunk);}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw error(400,'Неверный запрос.');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw error(400,'Неверный запрос.');
    return data;
  }
  async function pbAuth(path,body,token){
    let response;try{response=await fetchImpl(`http://127.0.0.1:${pbPort}/api/collections/app_users/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw error(503,'Сервис входа временно недоступен.');}
    if(!response.ok)throw error(response.status>=500||response.status===429?503:401,response.status>=500?'Сервис входа временно недоступен.':'Неверный логин или пароль, либо доступ отключён.');
    let data;try{data=await response.json();}catch{throw error(503,'Сервис входа временно недоступен.');}
    if(!data.token||data.record?.collectionName!=='app_users'||data.record.disabled!==false)throw error(401,'Доступ отключён.');
    return data;
  }
  async function requireUser(req,res){
    sweep();const key=sessionKey(req),s=sessions.get(key);if(!s){clear(res);throw error(401,'Войдите в систему.');}
    if(!s.pending)s.pending=pbAuth('auth-refresh',{},s.token).then(result=>{
      if(result.record.id!==s.record.id)throw error(401,'Сеанс недействителен.');
      s.token=result.token;s.record=result.record;
    }).finally(()=>{s.pending=null;});
    try{await s.pending;}catch(e){if(e.status===401){sessions.delete(key);clear(res);}throw e;}
    if(!sessions.has(key)||now()>s.until)throw error(401,'Сеанс завершён.');
    s.seen=now();return {id:s.record.id,username:s.record.username,full_name:s.record.full_name};
  }
  async function login(req,res){
    sameOrigin(req);
    const data=await readJson(req);
    if(typeof data.username!=='string'||typeof data.password!=='string'||data.username.length>80||data.password.length>1024)throw error(400,'Введите логин и пароль.');
    const username=data.username.trim().toLowerCase();
    rate('all-login',120,600_000);rate('login:'+digest(username),10,900_000);
    if(inFlightLogins>=6)throw error(429,'Слишком много попыток. Повторите позже.');
    inFlightLogins++;let result;try{result=await pbAuth('auth-with-password',{identity:username,password:data.password});}finally{inFlightLogins--;}
    const old=sessionKey(req);if(old)sessions.delete(old);
    if(sessions.size>=2000)throw error(503,'Достигнут лимит сеансов. Повторите позже.');
    const value=randomBytes(32).toString('base64url');
    sessions.set(digest(value),{token:result.token,record:result.record,until:now()+8*3600_000,seen:now(),pending:null});
    res.setHeader('Set-Cookie',cookie(value,8*3600));return {ok:true};
  }
  function logout(req,res){sameOrigin(req);sessions.delete(sessionKey(req));clear(res);res.setHeader('Clear-Site-Data','"cache"');return {ok:true};}
  async function changePassword(req,res){
    sameOrigin(req);
    const user=await requireUser(req,res);
    rate('password:'+user.id,8,900_000);rate('all-password',60,900_000);
    const data=await readJson(req),fields=['currentPassword','newPassword','confirmPassword'];
    if(Object.keys(data).some(k=>!fields.includes(k))||fields.some(k=>typeof data[k]!=='string'||!data[k].length||data[k].length>1024))throw error(400,'Заполните три поля пароля.');
    if(data.newPassword!==data.confirmPassword)throw error(400,'Новый пароль и повтор не совпадают.');
    if(data.newPassword===data.currentPassword)throw error(400,'Новый пароль должен отличаться от текущего.');
    if(passwordChanges.has(user.id)||passwordChanges.size>=4)throw error(429,'Смена пароля уже выполняется. Повторите позже.');
    const s=sessions.get(sessionKey(req));if(!s)throw error(401,'Сеанс завершён. Войдите снова.');
    const revoke=()=>{for(const[k,v]of sessions)if(v.record.id===user.id)sessions.delete(k);clear(res);res.setHeader('Clear-Site-Data','"cache"');};
    passwordChanges.add(user.id);
    try{
      let response;
      try{response=await fetchImpl(`http://127.0.0.1:${pbPort}/api/ubait/change-password`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:s.token},body:JSON.stringify(data),signal:AbortSignal.timeout(12000),redirect:'error'});}
      catch{revoke();throw error(503,'Не удалось подтвердить смену пароля. Войдите снова; если новый пароль не подходит, используйте прежний.');}
      if(response.status===401||response.status===403){revoke();throw error(401,'Сеанс завершён. Войдите снова.');}
      if(!response.ok){
        if(response.status===400){
          const result=await response.json().catch(()=>({}));
          const messages={invalid_current_password:'Текущий пароль неверный.',password_mismatch:'Новый пароль и повтор не совпадают.',same_password:'Новый пароль должен отличаться от текущего.'};
          if(messages[result.code])throw error(400,messages[result.code]);
          if(result.code==='password_policy'){
            const min=Number.isInteger(result.minLength)&&result.minLength>0&&result.minLength<=1024?` Минимальная длина: ${result.minLength} символов.`:'';
            throw error(400,'Новый пароль не соответствует требованиям, заданным администратором.'+min);
          }
        }
        throw error(503,'Смена пароля временно недоступна.');
      }
      // Token rotation in PocketBase also revokes sessions held by other processes.
      revoke();return {ok:true};
    }finally{passwordChanges.delete(user.id);}
  }
  // No arbitrary URL forwarding. PocketBase's own rules protect admin APIs.
  function isAdminRoute(path){return path==='/_/'||path.startsWith('/_/')||/^\/api\/(collections|settings|logs|backups|crons|health|realtime|files|batch|sql)(\/|$)/.test(path);}
  async function proxyAdmin(req,res,url){
    if(!['GET','HEAD','OPTIONS'].includes(req.method))sameOrigin(req);
    if(url.pathname.includes('auth-with-password'))rate('admin-login',30,900_000);
    // Only the gateway may authenticate app users; public self-service is unnecessary.
    if(/^\/api\/collections\/app_users\/(?!records(?:\/|$))/.test(url.pathname))throw error(403,'Используйте страницу входа сайта.');
    if(url.pathname.includes('auth-with-oauth2')||url.pathname.includes('request-otp')||url.pathname.includes('request-password-reset'))throw error(403,'Самостоятельное восстановление и регистрация отключены.');
    const headers={};for(const key of ['authorization','content-type','content-length','accept','last-event-id','range'])if(req.headers[key])headers[key]=req.headers[key];
    // Do not forward site session cookies, forwarded IP/host or upstream secrets.
    await new Promise(resolve=>{
      const upstream=http.request({hostname:'127.0.0.1',port:pbPort,path:url.pathname+url.search,method:req.method,headers},response=>{
        res.statusCode=response.statusCode;
        for(const key of ['content-type','content-length','content-encoding','content-range','accept-ranges','content-disposition'])if(response.headers[key])res.setHeader(key,response.headers[key]);
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        response.pipe(res);response.on('end',resolve);response.on('error',()=>{res.destroy();resolve();});
      });
      upstream.setTimeout(60000,()=>upstream.destroy());
      upstream.on('error',()=>{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Админка временно недоступна.'}));}else res.destroy();resolve();});
      let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>25*1024*1024){upstream.destroy();req.destroy();}});
      res.on('close',()=>upstream.destroy());req.pipe(upstream);
    });
  }
  return {requireUser,login,logout,changePassword,isAdminRoute,proxyAdmin};
}
