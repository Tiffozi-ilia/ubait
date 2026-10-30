// One container, two supervised processes. Only Node's 8080 port is public.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createStoryMapServer} from './server.mjs';
import {publicOrigin} from './auth.mjs';
import {checkWebhookProtection} from './check-access.mjs';

publicOrigin(process.env.PUBLIC_ORIGIN);
if(!/^[A-Za-z0-9_-]{32,256}$/.test(process.env.N8N_WEBHOOK_SECRET||''))throw new Error('Set N8N_WEBHOOK_SECRET (random, >=32 characters).');
let target;try{target=new URL(process.env.STORY_MAP_WEBHOOK_URL);}catch{throw new Error('Set STORY_MAP_WEBHOOK_URL to the existing HTTPS Story Map webhook.');}
if(target.protocol!=='https:'||target.username||target.password||!target.pathname.endsWith('/reestr-story-map-v1'))throw new Error('Set STORY_MAP_WEBHOOK_URL to the existing HTTPS Story Map webhook.');
await checkWebhookProtection(target.href);
const binary='/usr/local/bin/pocketbase',args=['--dir=/data/pocketbase','--migrationsDir=/app/pb_migrations','--automigrate=false'];
const init=spawn(binary,['migrate','up',...args],{stdio:'inherit'});
const [code]=await once(init,'exit');if(code!==0)throw new Error('PocketBase initialization failed. Check /data and initial administrator secrets.');
const pbEnv={...process.env};delete pbEnv.PB_ADMIN_PASSWORD;delete pbEnv.PB_ADMIN_EMAIL;
delete pbEnv.N8N_WEBHOOK_SECRET;delete pbEnv.STORY_MAP_WEBHOOK_URL;
delete process.env.PB_ADMIN_PASSWORD;delete process.env.PB_ADMIN_EMAIL;
const pb=spawn(binary,['serve','--http=127.0.0.1:8090',...args],{stdio:'inherit',env:pbEnv});
let server,closing=false;
function stop(exitCode=0){
 if(closing)return;closing=true;process.exitCode=exitCode;server?.closeAllConnections();server?.close();pb.kill('SIGTERM');
 const timer=setTimeout(()=>{pb.kill('SIGKILL');process.exit(exitCode);},8000);timer.unref();
 if(pb.exitCode!==null||pb.signalCode!==null)process.exit(exitCode);else pb.once('exit',()=>process.exit(exitCode));
}
process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
pb.on('error',()=>stop(1));pb.on('exit',()=>{if(!closing){console.error('PocketBase stopped; stopping the site.');stop(1);}});
let ready=false;
for(let i=0;i<60&&!closing;i++){
 try{const r=await fetch('http://127.0.0.1:8090/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
 await new Promise(r=>setTimeout(r,500));
}
if(!ready){console.error('PocketBase did not become ready.');stop(1);}
else{
 server=createStoryMapServer();server.on('error',()=>stop(1));
 server.listen(8080,'0.0.0.0',()=>console.log('UBAIT R8 ready on port 8080; authentication and HR authorization required.'));
}
